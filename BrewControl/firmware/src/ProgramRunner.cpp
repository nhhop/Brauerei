#include "ProgramRunner.h"

#include <Arduino.h>
#include <string.h>

#include "SdLock.h"

namespace BrewControl {
namespace {

// RAII guard for the recursive programs_ mutex.
struct ScopedLock {
  SemaphoreHandle_t m;
  explicit ScopedLock(SemaphoreHandle_t s) : m(s) {
    if (m) xSemaphoreTakeRecursive(m, portMAX_DELAY);
  }
  ~ScopedLock() { if (m) xSemaphoreGiveRecursive(m); }
  ScopedLock(const ScopedLock&) = delete;
  ScopedLock& operator=(const ScopedLock&) = delete;
};

}  // namespace

ProgramRunner::ProgramRunner() : mutex_(xSemaphoreCreateRecursiveMutex()) {}

// ── Status mapping ──────────────────────────────────────────────────────────────

const char* ProgramRunner::statusToStr(Status s) {
  switch (s) {
    case Status::Running:  return "running";
    case Status::Awaiting: return "awaiting";
    case Status::Paused:   return "paused";
    case Status::Done:     return "done";
    case Status::Idle:
    default:               return "idle";
  }
}

ProgramRunner::Status ProgramRunner::statusFromStr(const char* s) {
  if (!s) return Status::Idle;
  if (strcmp(s, "running")  == 0) return Status::Running;
  if (strcmp(s, "awaiting") == 0) return Status::Awaiting;
  if (strcmp(s, "paused")   == 0) return Status::Paused;
  if (strcmp(s, "done")     == 0) return Status::Done;
  return Status::Idle;
}

// ── Parsing ─────────────────────────────────────────────────────────────────────

bool ProgramRunner::fillFromJson(Program& p, const JsonObject& cfg) {
  p.name = cfg["name"] | "Programm";
  if (!readSteps(cfg, p.steps)) return false;
  // "" only comes from a migrated profile — a program must name a real item.
  return !p.steps.empty() && !hasUnboundTarget(p.steps);
}

// ── Persistence ───────────────────────────────────────────────────────────────

void ProgramRunner::loadFromSD(fs::FS& sd) {
  ScopedLock lk(mutex_);
  SdLock sdLock;
  File f = sd.open("/config/programs.json");
  if (!f) return;
  JsonDocument doc;
  if (deserializeJson(doc, f) != DeserializationError::Ok) { f.close(); return; }
  f.close();

  for (JsonObject obj : doc.as<JsonArray>()) {
    Program p;
    p.id = obj["id"] | "";
    if (p.id.empty()) continue;
    if (!fillFromJson(p, obj)) continue;
    p.status            = statusFromStr(obj["status"] | "idle");
    p.currentStep       = obj["currentStep"] | 0;
    p.stepStartedEpoch  = (time_t)(obj["stepStartedEpoch"] | 0L);
    p.elapsedAtPauseSec = obj["elapsedAtPauseSec"] | 0;
    if (p.currentStep < 0 || p.currentStep >= (int)p.steps.size())
      p.currentStep = 0;
    // Files from before multi-target steps have no reachedStep; they had no
    // pulses either, so treating the current step as reached is exact.
    p.reachedStep = obj["reachedStep"] | p.currentStep;
    programs_.push_back(std::move(p));
  }
  needsResume_ = true;
}

void ProgramRunner::saveToSD(fs::FS& sd) const {
  ScopedLock lk(mutex_);
  SdLock sdLock;
  sd.mkdir("/config");
  File f = sd.open("/config/programs.json", FILE_WRITE);
  if (!f) return;
  f.print(serialize());
  f.close();
}

// ── Serialization ─────────────────────────────────────────────────────────────

String ProgramRunner::serialize() const {
  ScopedLock lk(mutex_);
  const time_t now = time(nullptr);
  JsonDocument doc;
  JsonArray arr = doc.to<JsonArray>();
  for (const auto& p : programs_) {
    JsonObject obj = arr.add<JsonObject>();
    obj["id"]   = p.id.c_str();
    obj["name"] = p.name.c_str();
    writeSteps(obj, p.steps);
    obj["status"]            = statusToStr(p.status);
    obj["currentStep"]       = p.currentStep;
    obj["reachedStep"]       = p.reachedStep;
    obj["stepStartedEpoch"]  = (long)p.stepStartedEpoch;
    obj["elapsedAtPauseSec"] = p.elapsedAtPauseSec;

    // Derived live status for the frontend (not load-bearing on read-back).
    if (p.currentStep >= 0 && p.currentStep < (int)p.steps.size()) {
      const ProgramStep& cur = p.steps[p.currentStep];
      long remaining = (long)cur.holdSec;
      if (cur.end == StepEnd::Sensor) {
        remaining = 0;  // sensor-triggered: no countdown
      } else if (p.status == Status::Running && now > 946684800L) {
        remaining = (long)cur.holdSec - (long)(now - p.stepStartedEpoch);
      } else if (p.status == Status::Paused) {
        remaining = (long)cur.holdSec - (long)p.elapsedAtPauseSec;
      } else if (p.status == Status::Awaiting || p.status == Status::Done) {
        remaining = 0;
      }
      if (remaining < 0) remaining = 0;
      obj["stepRemainingSec"] = remaining;
    }
  }
  String out;
  serializeJson(doc, out);
  return out;
}

// ── CRUD ──────────────────────────────────────────────────────────────────────

String ProgramRunner::generateId() {
  char buf[8];
  snprintf(buf, sizeof(buf), "p_%05lx", (unsigned long)(random(0x100000)));
  return String(buf);
}

void ProgramRunner::setStatus_(Program& p, Status s) {
  if (p.status == s) return;
  p.status = s;
  if (onStatusChanged_) onStatusChanged_(p.id.c_str(), p.name.c_str(), statusToStr(s));
}

ProgramRunner::Program* ProgramRunner::find_(const char* id) {
  for (auto& p : programs_)
    if (p.id == id) return &p;
  return nullptr;
}

String ProgramRunner::add(const JsonObject& cfg) {
  ScopedLock lk(mutex_);
  Program p;
  p.id = generateId().c_str();
  if (!fillFromJson(p, cfg)) return String();
  String id = p.id.c_str();
  programs_.push_back(std::move(p));
  return id;
}

bool ProgramRunner::update(const char* id, const JsonObject& cfg) {
  ScopedLock lk(mutex_);
  Program* p = find_(id);
  if (!p) return false;
  Program tmp;
  if (!fillFromJson(tmp, cfg)) return false;
  // Editing the definition resets the run to idle (step set / timing changed).
  p->name             = std::move(tmp.name);
  p->steps            = std::move(tmp.steps);
  p->condActive       = false;
  setStatus_(*p, Status::Idle);
  p->currentStep      = 0;
  p->reachedStep      = -1;
  p->stepStartedEpoch = 0;
  p->elapsedAtPauseSec = 0;
  return true;
}

bool ProgramRunner::remove(const char* id) {
  ScopedLock lk(mutex_);
  for (auto it = programs_.begin(); it != programs_.end(); ++it) {
    if (it->id == id) { programs_.erase(it); return true; }
  }
  return false;
}

// ── Step application ────────────────────────────────────────────────────────────

namespace {

// Pulse actuators report ValueKind::Discrete (PulseOutputActuator, or a
// RemoteActuator mirroring one): write(N) queues N more pulses instead of
// setting a level, so writing it again would e.g. drop the hops twice.
bool isImpulse(const SensActCtrl::Actuator& a) {
  return a.meta().kind == SensActCtrl::ValueKind::Discrete;
}

}  // namespace

void ProgramRunner::applyCmd_(SensActCtrl::Registry& reg, const TargetCmd& c,
                              bool withImpulse) {
  if (SensActCtrl::Controller* ctl = reg.findController(c.id.c_str())) {
    // Setpoint before enable, the order the runner has always used.
    if (c.hasV) ctl->setSetpoint(c.v);
    if (c.hasEnabled) ctl->setEnabled(c.enabled);
    return;
  }
  SensActCtrl::Actuator* a = reg.findActuator(c.id.c_str());
  if (!a) return;
  // Same field order as POST /api/actuators/<id>: enabled, interval, v.
  if (c.hasEnabled) a->setEnabled(c.enabled);
  if (c.hasInterval) a->setInterval(c.onSec, c.periodSec);
  if (!c.hasV) return;
  if (isImpulse(*a)) {
    if (!withImpulse || c.v <= 0) return;
    Serial.printf("Program: %s — %.0f pulse(s)\n", c.id.c_str(), c.v);
  }
  a->write(c.v);
}

void ProgramRunner::applyStepTargets_(Program& p, SensActCtrl::Registry& reg,
                                      bool withImpulse) {
  if (p.currentStep < 0 || p.currentStep >= (int)p.steps.size()) return;
  for (const TargetCmd& c : p.steps[p.currentStep].targets)
    applyCmd_(reg, c, withImpulse);
}

void ProgramRunner::applyState_(Program& p, SensActCtrl::Registry& reg) {
  auto impulse = [&reg](const std::string& id) {
    SensActCtrl::Actuator* a = reg.findActuator(id.c_str());
    return a && isImpulse(*a);
  };
  for (const TargetCmd& c : effectiveTargets(p.steps, p.currentStep, impulse))
    applyCmd_(reg, c, /*withImpulse=*/false);
}

void ProgramRunner::enterStep_(Program& p, SensActCtrl::Registry& reg, int idx,
                               time_t now) {
  p.currentStep       = idx;
  p.stepStartedEpoch  = now;
  p.elapsedAtPauseSec = 0;
  p.condActive        = false;
  setStatus_(p, Status::Running);
  const bool firstEntry = idx > p.reachedStep;
  if (firstEntry) p.reachedStep = idx;
  applyStepTargets_(p, reg, /*withImpulse=*/firstEntry);
}

void ProgramRunner::advance_(Program& p, SensActCtrl::Registry& reg,
                             time_t nowEpoch) {
  p.condActive = false;
  if (p.currentStep + 1 >= (int)p.steps.size()) {
    setStatus_(p, Status::Done);  // everything the program set stays applied
    return;
  }
  enterStep_(p, reg, p.currentStep + 1, nowEpoch);
}

bool ProgramRunner::targetsResolvable_(const Program& p,
                                       SensActCtrl::Registry& reg) {
  for (const auto& s : p.steps)
    for (const auto& c : s.targets)
      if (!reg.findController(c.id.c_str()) && !reg.findActuator(c.id.c_str()))
        return false;
  return true;
}

// ── Control ─────────────────────────────────────────────────────────────────────

ProgramRunner::Result ProgramRunner::control(const char* id, const char* action,
                                             SensActCtrl::Registry& reg) {
  ScopedLock lk(mutex_);
  Program* p = find_(id);
  if (!p) return {false, "not found"};
  if (!action) return {false, "unknown action"};
  const time_t now = time(nullptr);
  const Status st = p->status;

  if (strcmp(action, "start") == 0) {
    if (st != Status::Idle && st != Status::Done)
      return {false, "invalid action for state"};
    if (p->steps.empty()) return {false, "no steps"};
    p->reachedStep = -1;  // a new run: every step's pulses are due again
    enterStep_(*p, reg, 0, now);
    return {true};
  }

  if (strcmp(action, "pause") == 0) {
    if (st == Status::Running) {
      long elapsed = (long)(now - p->stepStartedEpoch);
      if (elapsed < 0) elapsed = 0;
      p->elapsedAtPauseSec = (uint32_t)elapsed;
    } else if (st == Status::Awaiting) {
      const ProgramStep& cur = p->steps[p->currentStep];
      p->elapsedAtPauseSec = cur.holdSec;
    } else {
      return {false, "invalid action for state"};
    }
    setStatus_(*p, Status::Paused);
    return {true};
  }

  if (strcmp(action, "resume") == 0) {
    if (st != Status::Paused) return {false, "invalid action for state"};
    p->condActive = false;
    p->stepStartedEpoch = now - (time_t)p->elapsedAtPauseSec;
    setStatus_(*p, Status::Running);
    applyStepTargets_(*p, reg, /*withImpulse=*/false);
    return {true};
  }

  if (strcmp(action, "stop") == 0) {
    if (st == Status::Idle) return {false, "invalid action for state"};
    setStatus_(*p, Status::Idle);
    p->currentStep       = 0;
    p->elapsedAtPauseSec = 0;
    return {true};  // everything the program set is left as-is
  }

  if (strcmp(action, "next") == 0) {
    if (st != Status::Running && st != Status::Paused && st != Status::Awaiting)
      return {false, "invalid action for state"};
    advance_(*p, reg, now);
    return {true};
  }

  if (strcmp(action, "prev") == 0) {
    if (st != Status::Running && st != Status::Paused && st != Status::Awaiting)
      return {false, "invalid action for state"};
    p->condActive = false;
    if (p->currentStep > 0) p->currentStep--;
    setStatus_(*p, Status::Running);
    p->stepStartedEpoch  = now;
    p->elapsedAtPauseSec = 0;
    // Replaying only the earlier step would leave whatever the later one
    // changed; rebuild the state up to here instead. Never re-fires pulses.
    applyState_(*p, reg);
    return {true};
  }

  return {false, "unknown action"};
}

// ── Tick ─────────────────────────────────────────────────────────────────────────

void ProgramRunner::tick(SensActCtrl::Registry& reg, fs::FS& sd,
                         time_t nowEpoch) {
  if (nowEpoch <= 946684800L) return;  // wait for a real clock (post-2000)

  ScopedLock lk(mutex_);

  // First valid-clock tick after boot: replay the active step's state onto the
  // freshly-constructed controllers/actuators so a resumed program keeps
  // driving. The whole state, not just the current step's commands — and no
  // pulses, reachedStep already counts this step as fired.
  if (needsResume_) {
    needsResume_ = false;
    for (auto& p : programs_) {
      if (p.status == Status::Running || p.status == Status::Awaiting ||
          p.status == Status::Paused) {
        applyState_(p, reg);
      }
    }
  }

  bool dirty = false;
  for (auto& p : programs_) {
    if (p.status != Status::Running) continue;
    if (p.currentStep < 0 || p.currentStep >= (int)p.steps.size()) continue;

    const ProgramStep& cur = p.steps[p.currentStep];
    bool fired;
    if (cur.end == StepEnd::Sensor) {
      // evalCondition returns false (and leaves the latch untouched) while the
      // ref cannot be resolved — the step then just keeps waiting.
      fired = evalCondition(reg, cur.cond, p.condActive) && p.condActive;
    } else {
      fired = (long)(nowEpoch - p.stepStartedEpoch) >= (long)cur.holdSec;
    }
    if (!fired) continue;
    // A target that no longer exists holds the program here instead of letting
    // it run on without it. Checked only once the step is due: tick() runs on
    // every loop pass, the scan over all steps' targets doesn't need to.
    if (!targetsResolvable_(p, reg)) continue;

    if (cur.confirm) {
      setStatus_(p, Status::Awaiting);  // wait for manual "next"
    } else {
      advance_(p, reg, nowEpoch);
    }
    dirty = true;
  }

  if (dirty) saveToSD(sd);
}

}  // namespace BrewControl
