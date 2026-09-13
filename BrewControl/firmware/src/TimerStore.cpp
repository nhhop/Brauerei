#include "TimerStore.h"

#include <Arduino.h>
#include <string.h>

#include "SdLock.h"
#include "TimerSchedule.h"

namespace BrewControl {
namespace {

// RAII guard for the recursive timers_ mutex.
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

TimerStore::TimerStore() : mutex_(xSemaphoreCreateRecursiveMutex()) {}

// ── Status mapping ──────────────────────────────────────────────────────────────

const char* TimerStore::statusToStr(Status s) {
  switch (s) {
    case Status::Running: return "running";
    case Status::Paused:  return "paused";
    case Status::Done:    return "done";
    case Status::Idle:
    default:              return "idle";
  }
}

TimerStore::Status TimerStore::statusFromStr(const char* s) {
  if (!s) return Status::Idle;
  if (strcmp(s, "running") == 0) return Status::Running;
  if (strcmp(s, "paused")  == 0) return Status::Paused;
  if (strcmp(s, "done")    == 0) return Status::Done;
  return Status::Idle;
}

// ── Parsing ─────────────────────────────────────────────────────────────────────

bool TimerStore::fillFromJson(Timer& t, const JsonObject& cfg) {
  t.name = cfg["name"] | "Timer";
  if (t.name.empty()) return false;

  const char* modeStr = cfg["mode"] | "duration";
  if (strcmp(modeStr, "clock") == 0) {
    t.mode = Mode::Clock;
    if (!parseTimeOfDay(std::string(cfg["timeOfDay"] | ""), t.timeOfDaySec)) return false;
    t.durationSec = 0;  // computed at start/re-arm
  } else if (strcmp(modeStr, "duration") == 0) {
    t.mode = Mode::Duration;
    t.durationSec = cfg["durationSec"] | 0;
    if (t.durationSec == 0) return false;
    t.timeOfDaySec = 0;
  } else {
    return false;
  }

  t.repeat = cfg["repeat"] | false;

  t.hasOnExpire = false;
  JsonObjectConst oe = cfg["onExpire"];
  if (!oe.isNull()) {
    const char* kind = oe["targetType"] | "";
    const char* tid  = oe["targetId"]   | "";
    const char* act  = oe["action"]     | "";
    if (!*tid) return false;
    if      (strcmp(kind, "actuator")   == 0) t.targetKind = TargetKind::Actuator;
    else if (strcmp(kind, "controller") == 0) t.targetKind = TargetKind::Controller;
    else if (strcmp(kind, "program")    == 0) t.targetKind = TargetKind::Program;
    else return false;
    if      (strcmp(act, "start") == 0) t.targetStart = true;
    else if (strcmp(act, "stop")  == 0) t.targetStart = false;
    else return false;
    t.targetId    = tid;
    t.hasOnExpire = true;
  }
  return true;
}

// ── Persistence ───────────────────────────────────────────────────────────────

void TimerStore::loadFromSD(fs::FS& sd) {
  ScopedLock lk(mutex_);
  SdLock sdLock;
  File f = sd.open("/config/timers.json");
  if (!f) return;
  JsonDocument doc;
  if (deserializeJson(doc, f) != DeserializationError::Ok) { f.close(); return; }
  f.close();

  for (JsonObject obj : doc.as<JsonArray>()) {
    Timer t;
    t.id = obj["id"] | "";
    if (t.id.empty()) continue;
    if (!fillFromJson(t, obj)) continue;
    t.status            = statusFromStr(obj["status"] | "idle");
    t.startedEpoch      = (time_t)(obj["startedEpoch"] | 0L);
    t.elapsedAtPauseSec = obj["elapsedAtPauseSec"] | 0;
    timers_.push_back(std::move(t));
  }
}

void TimerStore::saveToSD(fs::FS& sd) const {
  ScopedLock lk(mutex_);
  SdLock sdLock;
  sd.mkdir("/config");
  File f = sd.open("/config/timers.json", FILE_WRITE);
  if (!f) return;
  f.print(serialize());
  f.close();
}

// ── Serialization ─────────────────────────────────────────────────────────────

String TimerStore::serialize() const {
  ScopedLock lk(mutex_);
  const time_t now = time(nullptr);
  JsonDocument doc;
  JsonArray arr = doc.to<JsonArray>();
  for (const auto& t : timers_) {
    JsonObject obj = arr.add<JsonObject>();
    obj["id"]                = t.id.c_str();
    obj["name"]              = t.name.c_str();
    obj["mode"]              = (t.mode == Mode::Clock) ? "clock" : "duration";
    if (t.mode == Mode::Clock) obj["timeOfDay"] = formatTimeOfDay(t.timeOfDaySec).c_str();
    obj["durationSec"]       = t.durationSec;
    obj["repeat"]            = t.repeat;
    if (t.hasOnExpire) {
      JsonObject oe = obj["onExpire"].to<JsonObject>();
      oe["targetType"] = (t.targetKind == TargetKind::Actuator)   ? "actuator"
                        : (t.targetKind == TargetKind::Controller) ? "controller"
                                                                    : "program";
      oe["targetId"]   = t.targetId.c_str();
      oe["action"]     = t.targetStart ? "start" : "stop";
    }
    obj["status"]            = statusToStr(t.status);
    obj["startedEpoch"]      = (long)t.startedEpoch;
    obj["elapsedAtPauseSec"] = t.elapsedAtPauseSec;

    // Derived live status for the frontend (not load-bearing on read-back).
    long remaining = (long)t.durationSec;
    if (t.status == Status::Running && now > 946684800L) {
      remaining = (long)t.durationSec - (long)(now - t.startedEpoch);
    } else if (t.status == Status::Paused) {
      remaining = (long)t.durationSec - (long)t.elapsedAtPauseSec;
    } else if (t.status == Status::Done) {
      remaining = 0;
    }
    if (remaining < 0) remaining = 0;
    obj["remainingSec"] = remaining;
  }
  String out;
  serializeJson(doc, out);
  return out;
}

// ── CRUD ──────────────────────────────────────────────────────────────────────

String TimerStore::generateId() {
  char buf[9];
  snprintf(buf, sizeof(buf), "tm_%05lx", (unsigned long)(random(0x100000)));
  return String(buf);
}

TimerStore::Timer* TimerStore::find_(const char* id) {
  for (auto& t : timers_)
    if (t.id == id) return &t;
  return nullptr;
}

String TimerStore::add(const JsonObject& cfg) {
  ScopedLock lk(mutex_);
  Timer t;
  t.id = generateId().c_str();
  if (!fillFromJson(t, cfg)) return String();
  String id = t.id.c_str();
  timers_.push_back(std::move(t));
  return id;
}

bool TimerStore::update(const char* id, const JsonObject& cfg) {
  ScopedLock lk(mutex_);
  Timer* t = find_(id);
  if (!t) return false;
  Timer tmp;
  if (!fillFromJson(tmp, cfg)) return false;
  // Editing the definition resets the run to idle (duration changed).
  t->name              = std::move(tmp.name);
  t->mode              = tmp.mode;
  t->durationSec       = tmp.durationSec;
  t->timeOfDaySec      = tmp.timeOfDaySec;
  t->repeat            = tmp.repeat;
  t->hasOnExpire       = tmp.hasOnExpire;
  t->targetKind        = tmp.targetKind;
  t->targetId          = std::move(tmp.targetId);
  t->targetStart       = tmp.targetStart;
  t->status            = Status::Idle;
  t->startedEpoch      = 0;
  t->elapsedAtPauseSec = 0;
  return true;
}

bool TimerStore::remove(const char* id) {
  ScopedLock lk(mutex_);
  for (auto it = timers_.begin(); it != timers_.end(); ++it) {
    if (it->id == id) { timers_.erase(it); return true; }
  }
  return false;
}

// ── Control ─────────────────────────────────────────────────────────────────────

TimerStore::Result TimerStore::control(const char* id, const char* action) {
  ScopedLock lk(mutex_);
  Timer* t = find_(id);
  if (!t) return {false, "not found"};
  if (!action) return {false, "unknown action"};
  const time_t now = time(nullptr);
  const Status st = t->status;

  if (strcmp(action, "start") == 0) {
    if (st != Status::Idle && st != Status::Done)
      return {false, "invalid action for state"};
    if (t->mode == Mode::Clock)
      t->durationSec = nextOccurrenceDurationSec(t->timeOfDaySec, now);
    t->status            = Status::Running;
    t->startedEpoch      = now;
    t->elapsedAtPauseSec = 0;
    return {true};
  }

  if (strcmp(action, "pause") == 0) {
    if (st != Status::Running) return {false, "invalid action for state"};
    long elapsed = (long)(now - t->startedEpoch);
    if (elapsed < 0) elapsed = 0;
    t->elapsedAtPauseSec = (uint32_t)elapsed;
    t->status            = Status::Paused;
    return {true};
  }

  if (strcmp(action, "resume") == 0) {
    if (st != Status::Paused) return {false, "invalid action for state"};
    t->startedEpoch = now - (time_t)t->elapsedAtPauseSec;
    t->status       = Status::Running;
    return {true};
  }

  if (strcmp(action, "stop") == 0) {
    if (st == Status::Idle) return {false, "invalid action for state"};
    t->status            = Status::Idle;
    t->startedEpoch      = 0;
    t->elapsedAtPauseSec = 0;
    return {true};
  }

  return {false, "unknown action"};
}

// ── Tick ─────────────────────────────────────────────────────────────────────────

void TimerStore::tick(SensActCtrl::Registry& reg, ProgramRunner& programs,
                      fs::FS& sd, time_t nowEpoch) {
  if (nowEpoch <= 946684800L) return;  // wait for a real clock (post-2000)

  ScopedLock lk(mutex_);
  bool dirty = false;
  for (auto& t : timers_) {
    if (t.status != Status::Running) continue;
    if ((long)(nowEpoch - t.startedEpoch) < (long)t.durationSec) continue;

    const time_t expiryEpoch = t.startedEpoch + (time_t)t.durationSec;
    dirty = true;

    if (onExpired_) onExpired_(t.id.c_str(), t.name.c_str());
    if (t.hasOnExpire) fireOnExpire_(t, reg, programs);

    if (t.repeat) {
      if (t.mode == Mode::Clock)
        t.durationSec = nextOccurrenceDurationSec(t.timeOfDaySec, expiryEpoch);
      // Duration mode: durationSec unchanged — same interval, recounted.
      t.startedEpoch      = expiryEpoch;  // rebase from the exact instant, not
                                           // "now", so a Clock re-arm never drifts
      t.elapsedAtPauseSec = 0;
    } else {
      t.status = Status::Done;
    }
  }
  if (dirty) saveToSD(sd);
}

void TimerStore::fireOnExpire_(const Timer& t, SensActCtrl::Registry& reg,
                               ProgramRunner& programs) {
  switch (t.targetKind) {
    case TargetKind::Actuator:
      if (auto* a = reg.findActuator(t.targetId.c_str())) a->setEnabled(t.targetStart);
      return;
    case TargetKind::Controller:
      if (auto* c = reg.findController(t.targetId.c_str())) c->setEnabled(t.targetStart);
      return;
    case TargetKind::Program:
      programs.control(t.targetId.c_str(), t.targetStart ? "start" : "stop", reg);
      return;
  }
}

}  // namespace BrewControl
