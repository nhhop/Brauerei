#include "AlarmStore.h"

#include <Arduino.h>
#include <math.h>
#include <string.h>

#include "SdLock.h"

namespace BrewControl {
namespace {

// RAII guard for the recursive store mutex.
struct ScopedLock {
  SemaphoreHandle_t m;
  explicit ScopedLock(SemaphoreHandle_t s) : m(s) {
    if (m) xSemaphoreTakeRecursive(m, portMAX_DELAY);
  }
  ~ScopedLock() { if (m) xSemaphoreGiveRecursive(m); }
  ScopedLock(const ScopedLock&) = delete;
  ScopedLock& operator=(const ScopedLock&) = delete;
};

// Copies into a fixed-width field, always NUL-terminated.
template <size_t N>
void setField(char (&dst)[N], const char* src) {
  if (!src) { dst[0] = 0; return; }
  strncpy(dst, src, N - 1);
  dst[N - 1] = 0;
}

// Below this the system clock has not been set by NTP yet (2000-01-01).
constexpr time_t kClockValidEpoch = 946684800L;

}  // namespace

AlarmStore::AlarmStore() : mutex_(xSemaphoreCreateRecursiveMutex()) {}

// ── Persistence ───────────────────────────────────────────────────────────────

void AlarmStore::loadFromSD(fs::FS& sd) {
  ScopedLock lk(mutex_);
  SdLock sdLock;
  File f = sd.open("/config/alarms.json");
  if (!f) return;
  JsonDocument doc;
  if (deserializeJson(doc, f) != DeserializationError::Ok) { f.close(); return; }
  f.close();

  for (JsonObject obj : doc.as<JsonArray>()) {
    Rule r;
    r.id = obj["id"] | "";
    if (r.id.empty()) continue;
    if (!fillFromJson(r, obj)) continue;
    rules_.push_back(std::move(r));
  }
}

void AlarmStore::saveToSD(fs::FS& sd) const {
  ScopedLock lk(mutex_);
  SdLock sdLock;
  sd.mkdir("/config");
  File f = sd.open("/config/alarms.json", FILE_WRITE);
  if (!f) return;
  // Definitions only — serialize() additionally emits the live latch state.
  JsonDocument doc;
  JsonArray arr = doc.to<JsonArray>();
  for (const auto& r : rules_) {
    JsonObject o = arr.add<JsonObject>();
    o["id"]       = r.id.c_str();
    o["name"]     = r.name.c_str();
    o["enabled"]  = r.enabled;
    o["severity"] = severityToStr(r.severity);
    o["forSec"]   = r.forSec;
    conditionToJson(r.cond, o["cond"].to<JsonObject>());
  }
  String out;
  serializeJson(doc, out);
  f.print(out);
  f.close();
}

// ── Serialization ─────────────────────────────────────────────────────────────

String AlarmStore::serialize() const {
  ScopedLock lk(mutex_);
  JsonDocument doc;
  JsonArray arr = doc.to<JsonArray>();
  for (const auto& r : rules_) {
    JsonObject o = arr.add<JsonObject>();
    o["id"]       = r.id.c_str();
    o["name"]     = r.name.c_str();
    o["enabled"]  = r.enabled;
    o["severity"] = severityToStr(r.severity);
    o["forSec"]   = r.forSec;
    conditionToJson(r.cond, o["cond"].to<JsonObject>());
    // Live state (read-only) — lets the UI badge cards and list active alarms
    // without reconstructing them from the alert ring.
    o["active"]   = r.firing;
    o["since"]    = (long)r.since;
    o["resolved"] = r.resolved;
  }
  String out;
  serializeJson(doc, out);
  return out;
}

void AlarmStore::alertToJson_(const Alert& a, JsonObject o) const {
  o["seq"]   = a.seq;
  o["ts"]    = (long)a.ts;
  o["sev"]   = severityToStr((Severity)a.sev);
  o["state"] = a.cleared ? "cleared" : "raised";
  o["kind"]  = a.kind;
  o["src"]   = a.src;
  if (a.name[0])   o["name"]   = a.name;
  if (a.rule[0])   o["rule"]   = a.rule;
  if (a.detail[0]) o["detail"] = a.detail;
  if (a.hasV)      o["v"]      = a.v;
}

String AlarmStore::serializeAlerts(uint32_t sinceSeq) const {
  ScopedLock lk(mutex_);
  JsonDocument doc;
  JsonArray arr = doc.to<JsonArray>();
  // Walk oldest → newest so the array comes out ascending by seq.
  const size_t first = (ringHead_ + kRing - ringCount_) % kRing;
  for (size_t i = 0; i < ringCount_; ++i) {
    const Alert& a = ring_[(first + i) % kRing];
    if (a.seq <= sinceSeq) continue;
    alertToJson_(a, arr.add<JsonObject>());
  }
  String out;
  serializeJson(doc, out);
  return out;
}

void AlarmStore::clearAlerts() {
  ScopedLock lk(mutex_);
  ringCount_ = 0;
  ringHead_  = 0;
  pushedSeq_ = nextSeq_ - 1;  // don't re-push what was just discarded
}

bool AlarmStore::takePendingPush(Alert& out) {
  ScopedLock lk(mutex_);
  const size_t first = (ringHead_ + kRing - ringCount_) % kRing;
  for (size_t i = 0; i < ringCount_; ++i) {
    const Alert& a = ring_[(first + i) % kRing];
    if (a.seq <= pushedSeqPush_) continue;
    out = a;
    pushedSeqPush_ = a.seq;
    return true;
  }
  return false;
}

bool AlarmStore::takePending(String& out) {
  ScopedLock lk(mutex_);
  const size_t first = (ringHead_ + kRing - ringCount_) % kRing;
  for (size_t i = 0; i < ringCount_; ++i) {
    const Alert& a = ring_[(first + i) % kRing];
    if (a.seq <= pushedSeq_) continue;
    JsonDocument doc;
    alertToJson_(a, doc.to<JsonObject>());
    out = "";
    serializeJson(doc, out);
    pushedSeq_ = a.seq;
    return true;
  }
  return false;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

String AlarmStore::generateId() {
  char buf[7];
  snprintf(buf, sizeof(buf), "%06lx", (unsigned long)(random(0x1000000)));
  return String(buf);
}

AlarmStore::Severity AlarmStore::severityFromStr(const char* s) {
  if (!s) return SevWarning;
  if (strcmp(s, "info") == 0)     return SevInfo;
  if (strcmp(s, "critical") == 0) return SevCritical;
  return SevWarning;
}

const char* AlarmStore::severityToStr(Severity s) {
  switch (s) {
    case SevInfo:     return "info";
    case SevCritical: return "critical";
    case SevWarning:
    default:          return "warning";
  }
}

bool AlarmStore::fillFromJson(Rule& r, const JsonObject& cfg) {
  r.name = cfg["name"] | "";
  if (r.name.empty()) return false;
  if (!conditionFromJson(r.cond, cfg["cond"].as<JsonObjectConst>())) return false;
  r.enabled  = cfg["enabled"] | true;
  r.severity = severityFromStr(cfg["severity"] | "warning");
  r.forSec   = cfg["forSec"] | 0;
  if (r.forSec > kMaxForSec) r.forSec = kMaxForSec;
  return true;
}

AlarmStore::Rule* AlarmStore::find_(const char* id) {
  for (auto& r : rules_) {
    if (r.id == id) return &r;
  }
  return nullptr;
}

AlarmStore::EdgeState& AlarmStore::edge_(const std::string& key) {
  for (auto& e : edges_) {
    if (e.key == key) return e;
  }
  edges_.push_back(EdgeState());
  edges_.back().key = key;
  return edges_.back();
}

void AlarmStore::raise_(const char* kind, const char* src, const char* name,
                        const char* rule, Severity sev, bool cleared,
                        const float* v, const char* detail, time_t nowEpoch) {
  Alert& a = ring_[ringHead_];
  a = Alert();
  a.seq     = nextSeq_++;
  a.ts      = (nowEpoch > kClockValidEpoch) ? nowEpoch : 0;
  a.sev     = (uint8_t)sev;
  a.cleared = cleared;
  a.hasV    = (v != nullptr);
  if (v) a.v = *v;
  setField(a.kind, kind);
  setField(a.src, src);
  setField(a.name, name);
  setField(a.rule, rule);
  setField(a.detail, detail);

  ringHead_ = (ringHead_ + 1) % kRing;
  if (ringCount_ < kRing) ++ringCount_;
  // The ring just overwrote an entry that was never pushed — it is gone from
  // the outbox too; the client repairs via GET /api/alerts?since=<seq>.
  if (pushedSeq_ + kRing < a.seq) pushedSeq_ = a.seq - kRing;
}

// ── Rule CRUD ─────────────────────────────────────────────────────────────────

String AlarmStore::add(const JsonObject& cfg) {
  ScopedLock lk(mutex_);
  Rule r;
  if (!fillFromJson(r, cfg)) return String();
  r.id = generateId().c_str();
  String id = r.id.c_str();
  rules_.push_back(std::move(r));
  return id;
}

bool AlarmStore::update(const char* id, const JsonObject& cfg) {
  ScopedLock lk(mutex_);
  Rule* r = find_(id);
  if (!r) return false;
  Rule tmp;                             // validate before overwriting
  if (!fillFromJson(tmp, cfg)) return false;
  r->name     = std::move(tmp.name);
  r->enabled  = tmp.enabled;
  r->severity = tmp.severity;
  r->cond     = std::move(tmp.cond);
  r->forSec   = tmp.forSec;
  // A changed threshold invalidates the latch — re-evaluate from scratch.
  r->active = false;
  r->firing = false;
  r->since  = 0;
  return true;
}

bool AlarmStore::remove(const char* id) {
  ScopedLock lk(mutex_);
  for (auto it = rules_.begin(); it != rules_.end(); ++it) {
    if (it->id == id) { rules_.erase(it); return true; }
  }
  return false;
}

bool AlarmStore::setEnabled(const char* id, bool enabled) {
  ScopedLock lk(mutex_);
  Rule* r = find_(id);
  if (!r) return false;
  r->enabled = enabled;
  // Dropping the latch on disable: re-enabling must not emit a stale "cleared".
  if (!enabled) { r->active = false; r->firing = false; r->since = 0; }
  return true;
}

// ── Evaluation ────────────────────────────────────────────────────────────────

void AlarmStore::tick(SensActCtrl::Registry& reg, time_t nowEpoch, uint32_t nowMs) {
  ScopedLock lk(mutex_);
  for (auto& e : edges_) e.seen = false;
  tickThresholds_(reg, nowEpoch, nowMs);
  tickFaults_(reg, nowEpoch, nowMs);
  tickAutotune_(reg, nowEpoch);
  // Sweep: drop the state of items that left the registry. This is the whole
  // item-removal handling — no DynamicItems observer needed.
  for (auto it = edges_.begin(); it != edges_.end();) {
    it = it->seen ? it + 1 : edges_.erase(it);
  }
}

void AlarmStore::tickThresholds_(SensActCtrl::Registry& reg, time_t nowEpoch,
                                 uint32_t nowMs) {
  char detail[48];
  for (auto& r : rules_) {
    if (!r.enabled) { r.resolved = false; continue; }
    const bool was = r.active;
    float v = 0.0f;
    if (!evalCondition(reg, r.cond, r.active, &v)) {
      // Target gone or no reading yet — neither fire nor clear, just flag it.
      r.resolved = false;
      continue;
    }
    r.resolved = true;
    if (r.active && !was) r.activeMs = nowMs;

    if (r.active && !r.firing &&
        nowMs - r.activeMs >= r.forSec * 1000UL &&
        nowMs - r.lastRaiseMs >= kReArmMs) {
      snprintf(detail, sizeof(detail), "%s %.2f",
               r.cond.op == CondOp::Lt ? "<" : ">", (double)r.cond.value);
      raise_("threshold", r.cond.ref.c_str(), r.name.c_str(), r.id.c_str(),
             r.severity, false, &v, detail, nowEpoch);
      r.firing      = true;
      r.lastRaiseMs = nowMs;
      r.since       = (nowEpoch > kClockValidEpoch) ? nowEpoch : 0;
    } else if (!r.active && r.firing) {
      raise_("threshold", r.cond.ref.c_str(), r.name.c_str(), r.id.c_str(),
             SevInfo, true, &v, "", nowEpoch);
      r.firing = false;
      r.since  = 0;
    }
  }
}

void AlarmStore::tickFaults_(SensActCtrl::Registry& reg, time_t nowEpoch,
                             uint32_t nowMs) {
  // fault() is per item, not per channel, so the key carries no channel suffix.
  auto check = [&](const char* role, const char* id, const char* fault) {
    const std::string key = std::string(role) + "/" + id;
    EdgeState& e = edge_(key);
    e.seen = true;
    const std::string now = fault ? fault : "";
    if (now == e.fault) return;
    if (now.empty()) {
      raise_("fault", key.c_str(), id, "", SevInfo, true, nullptr, "", nowEpoch);
    } else if (e.fault.empty() || nowMs - e.lastRaiseMs >= kReArmMs) {
      raise_("fault", key.c_str(), id, "", SevWarning, false, nullptr,
             now.c_str(), nowEpoch);
      e.lastRaiseMs = nowMs;
    } else {
      return;  // text keeps changing — keep the old value until the guard lifts
    }
    e.fault = now;
  };

  for (auto* s : reg.sensors())   check("sensor", s->id(), s->fault());
  for (auto* a : reg.actuators()) check("actuator", a->id(), a->fault());
}

void AlarmStore::tickAutotune_(SensActCtrl::Registry& reg, time_t nowEpoch) {
  // Controller exposes no autotune accessor on the base interface — the state
  // is only observable through the params blob. Match the raw text instead of
  // parsing 512 bytes of JSON per controller per second.
  char buf[512];
  for (auto* c : reg.controllers()) {
    const std::string key = std::string("controller/") + c->id();
    EdgeState& e = edge_(key);
    e.seen = true;
    if (c->paramsJson(buf, sizeof buf) == 0) continue;
    const bool done = strstr(buf, "\"autotuneState\":\"done\"") != nullptr;
    if (done && !e.tuneDone) {
      raise_("autotune", key.c_str(), c->id(), "", SevInfo, false, nullptr, "",
             nowEpoch);
    }
    e.tuneDone = done;
  }
}

void AlarmStore::onProgramStatus(const char* id, const char* name,
                                 const char* status, time_t nowEpoch,
                                 uint32_t nowMs) {
  (void)nowMs;
  Severity sev;
  if (strcmp(status, "done") == 0)          sev = SevInfo;
  else if (strcmp(status, "awaiting") == 0) sev = SevWarning;
  else                                      return;  // the rest is not alertable

  ScopedLock lk(mutex_);
  const std::string src = std::string("program/") + id;
  raise_("program", src.c_str(), name, "", sev, false, nullptr, status, nowEpoch);
}

void AlarmStore::onTimerExpired(const char* id, const char* name,
                                time_t nowEpoch, uint32_t nowMs) {
  (void)nowMs;
  ScopedLock lk(mutex_);
  const std::string src = std::string("timer/") + id;
  raise_("timer", src.c_str(), name, "", SevInfo, false, nullptr, "", nowEpoch);
}

}  // namespace BrewControl
