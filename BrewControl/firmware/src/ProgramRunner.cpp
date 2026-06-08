#include "ProgramRunner.h"

#include <Arduino.h>
#include <math.h>
#include <string.h>

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
  p.name       = cfg["name"]       | "Programm";
  p.controller = cfg["controller"] | "";
  p.steps.clear();
  for (JsonObject s : cfg["steps"].as<JsonArray>()) {
    if (!s["setpoint"].is<float>()) continue;
    const float sp = s["setpoint"].as<float>();
    if (!isfinite(sp)) continue;
    Step st;
    st.name     = s["name"]    | "";
    st.setpoint = sp;
    st.holdSec  = s["holdSec"] | 0;
    st.confirm  = s["confirm"] | false;
    p.steps.push_back(std::move(st));
  }
  return !p.controller.empty() && !p.steps.empty();
}

// ── Persistence ───────────────────────────────────────────────────────────────

void ProgramRunner::loadFromSD(fs::FS& sd) {
  ScopedLock lk(mutex_);
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
    programs_.push_back(std::move(p));
  }
  needsResume_ = true;
}

void ProgramRunner::saveToSD(fs::FS& sd) const {
  ScopedLock lk(mutex_);
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
    obj["id"]         = p.id.c_str();
    obj["name"]       = p.name.c_str();
    obj["controller"] = p.controller.c_str();
    JsonArray sarr = obj["steps"].to<JsonArray>();
    for (const auto& s : p.steps) {
      JsonObject so = sarr.add<JsonObject>();
      if (!s.name.empty()) so["name"] = s.name.c_str();
      so["setpoint"] = s.setpoint;
      so["holdSec"]  = s.holdSec;
      if (s.confirm) so["confirm"] = true;
    }
    obj["status"]            = statusToStr(p.status);
    obj["currentStep"]       = p.currentStep;
    obj["stepStartedEpoch"]  = (long)p.stepStartedEpoch;
    obj["elapsedAtPauseSec"] = p.elapsedAtPauseSec;

    // Derived live status for the frontend (not load-bearing on read-back).
    if (p.currentStep >= 0 && p.currentStep < (int)p.steps.size()) {
      const Step& cur = p.steps[p.currentStep];
      obj["currentSetpoint"] = cur.setpoint;
      long remaining = (long)cur.holdSec;
      if (p.status == Status::Running && now > 946684800L) {
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
  p->controller       = std::move(tmp.controller);
  p->steps            = std::move(tmp.steps);
  p->status           = Status::Idle;
  p->currentStep      = 0;
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

void ProgramRunner::applyStep_(Program& p, SensActCtrl::Registry& reg,
                               bool enable) const {
  if (p.currentStep < 0 || p.currentStep >= (int)p.steps.size()) return;
  SensActCtrl::Controller* c = reg.findController(p.controller.c_str());
  if (!c) return;
  c->setSetpoint(p.steps[p.currentStep].setpoint);
  if (enable) c->setEnabled(true);
}

void ProgramRunner::advance_(Program& p, SensActCtrl::Registry& reg,
                             time_t nowEpoch) {
  if (p.currentStep + 1 >= (int)p.steps.size()) {
    p.status = Status::Done;  // last setpoint stays applied
    return;
  }
  p.currentStep++;
  p.status            = Status::Running;
  p.stepStartedEpoch  = nowEpoch;
  p.elapsedAtPauseSec = 0;
  applyStep_(p, reg, /*enable=*/true);
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
    p->currentStep       = 0;
    p->status            = Status::Running;
    p->stepStartedEpoch  = now;
    p->elapsedAtPauseSec = 0;
    applyStep_(*p, reg, /*enable=*/true);
    return {true};
  }

  if (strcmp(action, "pause") == 0) {
    if (st == Status::Running) {
      long elapsed = (long)(now - p->stepStartedEpoch);
      if (elapsed < 0) elapsed = 0;
      p->elapsedAtPauseSec = (uint32_t)elapsed;
    } else if (st == Status::Awaiting) {
      const Step& cur = p->steps[p->currentStep];
      p->elapsedAtPauseSec = cur.holdSec;
    } else {
      return {false, "invalid action for state"};
    }
    p->status = Status::Paused;
    return {true};
  }

  if (strcmp(action, "resume") == 0) {
    if (st != Status::Paused) return {false, "invalid action for state"};
    p->stepStartedEpoch = now - (time_t)p->elapsedAtPauseSec;
    p->status           = Status::Running;
    applyStep_(*p, reg, /*enable=*/true);
    return {true};
  }

  if (strcmp(action, "stop") == 0) {
    if (st == Status::Idle) return {false, "invalid action for state"};
    p->status            = Status::Idle;
    p->currentStep       = 0;
    p->elapsedAtPauseSec = 0;
    return {true};  // controller setpoint/enable left as-is
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
    if (p->currentStep > 0) p->currentStep--;
    p->status            = Status::Running;
    p->stepStartedEpoch  = now;
    p->elapsedAtPauseSec = 0;
    applyStep_(*p, reg, /*enable=*/true);
    return {true};
  }

  return {false, "unknown action"};
}

// ── Tick ─────────────────────────────────────────────────────────────────────────

void ProgramRunner::tick(SensActCtrl::Registry& reg, fs::FS& sd,
                         time_t nowEpoch) {
  if (nowEpoch <= 946684800L) return;  // wait for a real clock (post-2000)

  ScopedLock lk(mutex_);

  // First valid-clock tick after boot: re-apply the active step's setpoint to
  // the freshly-constructed controllers so a resumed program keeps driving.
  if (needsResume_) {
    needsResume_ = false;
    for (auto& p : programs_) {
      if (p.status == Status::Running || p.status == Status::Awaiting ||
          p.status == Status::Paused) {
        applyStep_(p, reg, /*enable=*/true);
      }
    }
  }

  bool dirty = false;
  for (auto& p : programs_) {
    if (p.status != Status::Running) continue;
    if (p.currentStep < 0 || p.currentStep >= (int)p.steps.size()) continue;
    if (!reg.findController(p.controller.c_str())) continue;  // orphaned → wait

    const Step& cur = p.steps[p.currentStep];
    long elapsed = (long)(nowEpoch - p.stepStartedEpoch);
    if (elapsed < (long)cur.holdSec) continue;

    if (cur.confirm) {
      p.status = Status::Awaiting;  // wait for manual "next"
    } else {
      advance_(p, reg, nowEpoch);
    }
    dirty = true;
  }

  if (dirty) saveToSD(sd);
}

}  // namespace BrewControl
