#include "LogStore.h"

#include <Arduino.h>
#include <algorithm>
#include <math.h>
#include <stdlib.h>
#include <string.h>

namespace BrewControl {
namespace {

// Global storage budget for all CSV sessions under /logs. When exceeded, the
// oldest non-active sessions are deleted first.
constexpr uint64_t kLogBudgetBytes = 200ULL * 1024 * 1024;

CompAlgo algoFromStr(const char* s) {
  if (!s) return CompAlgo::None;
  if (strcmp(s, "linear") == 0)       return CompAlgo::Linear;
  if (strcmp(s, "swingingdoor") == 0) return CompAlgo::SwingingDoor;
  return CompAlgo::None;
}

const char* algoToStr(CompAlgo a) {
  switch (a) {
    case CompAlgo::Linear:       return "linear";
    case CompAlgo::SwingingDoor: return "swingingdoor";
    case CompAlgo::None:
    default:                     return "none";
  }
}

}  // namespace

// ── Persistence ───────────────────────────────────────────────────────────────

void LogStore::loadFromSD(fs::FS& sd) {
  File f = sd.open("/config/logs.json");
  if (!f) return;
  JsonDocument doc;
  if (deserializeJson(doc, f) != DeserializationError::Ok) { f.close(); return; }
  f.close();

  for (JsonObject obj : doc.as<JsonArray>()) {
    LogCfg l;
    l.id   = obj["id"]   | "";
    l.name = obj["name"] | "";
    if (l.id.empty() || l.name.empty()) continue;
    l.intervalSec = obj["intervalSec"] | 5;
    if (l.intervalSec == 0) l.intervalSec = 5;
    for (JsonObject s : obj["series"].as<JsonArray>()) {
      const char* ref = s["ref"] | "";
      if (!ref || !ref[0]) continue;
      Series ser;
      ser.ref = ref;
      ser.tol = s["tol"] | 0.0f;
      l.series.push_back(std::move(ser));
    }
    l.algo         = algoFromStr(obj["algo"] | "none");
    l.maxGapSec    = obj["maxGapSec"] | 600;
    l.enabled      = obj["enabled"] | true;
    l.bindEnableTo = obj["bindEnableTo"] | "";
    l.reconfigure();
    logs_.push_back(std::move(l));
  }
}

void LogStore::saveToSD(fs::FS& sd) const {
  sd.mkdir("/config");
  File f = sd.open("/config/logs.json", FILE_WRITE);
  if (!f) return;
  f.print(serialize());
  f.close();
}

// ── Serialization ─────────────────────────────────────────────────────────────

String LogStore::serialize() const {
  JsonDocument doc;
  JsonArray arr = doc.to<JsonArray>();
  for (const auto& l : logs_) {
    JsonObject obj = arr.add<JsonObject>();
    obj["id"]          = l.id.c_str();
    obj["name"]        = l.name.c_str();
    obj["intervalSec"] = l.intervalSec;
    obj["algo"]      = algoToStr(l.algo);
    obj["maxGapSec"] = l.maxGapSec;
    obj["enabled"]   = l.enabled;
    if (!l.bindEnableTo.empty()) obj["bindEnableTo"] = l.bindEnableTo.c_str();
    JsonArray sarr = obj["series"].to<JsonArray>();
    for (const auto& s : l.series) {
      JsonObject so = sarr.add<JsonObject>();
      so["ref"] = s.ref.c_str();
      so["tol"] = s.tol;
    }
    if (l.sessionStart > 0) obj["session"] = (long)l.sessionStart;
  }
  String out;
  serializeJson(doc, out);
  return out;
}

// ── CRUD ──────────────────────────────────────────────────────────────────────

String LogStore::generateId() {
  char buf[7];
  snprintf(buf, sizeof(buf), "%06lx", (unsigned long)(random(0x1000000)));
  return String(buf);
}

void LogStore::fillFromJson(LogCfg& l, const JsonObject& cfg) {
  l.name        = cfg["name"] | "Log";
  l.intervalSec = cfg["intervalSec"] | 5;
  if (l.intervalSec == 0) l.intervalSec = 5;
  l.series.clear();
  for (JsonObject s : cfg["series"].as<JsonArray>()) {
    const char* ref = s["ref"] | "";
    if (!ref || !ref[0]) continue;
    Series ser;
    ser.ref = ref;
    ser.tol = s["tol"] | 0.0f;
    l.series.push_back(std::move(ser));
  }
  l.algo         = algoFromStr(cfg["algo"] | "none");
  l.maxGapSec    = cfg["maxGapSec"] | 600;
  l.enabled      = cfg["enabled"] | true;
  l.bindEnableTo = cfg["bindEnableTo"] | "";
  l.reconfigure();
}

String LogStore::add(const JsonObject& cfg) {
  LogCfg l;
  l.id = generateId().c_str();
  fillFromJson(l, cfg);
  String id = l.id.c_str();
  logs_.push_back(std::move(l));
  return id;
}

bool LogStore::update(const char* id, const JsonObject& cfg) {
  for (auto& l : logs_) {
    if (l.id == id) {
      // Changing the series set changes the CSV header; start a fresh session
      // so old and new columns don't collide in one file.
      fillFromJson(l, cfg);
      l.sessionStart = 0;
      l.firstSample  = true;
      return true;
    }
  }
  return false;
}

bool LogStore::remove(const char* id) {
  for (auto it = logs_.begin(); it != logs_.end(); ++it) {
    if (it->id == id) { logs_.erase(it); return true; }
  }
  return false;
}

bool LogStore::setEnabled(const char* id, bool enabled) {
  for (auto& l : logs_) {
    if (l.id == id) { l.enabled = enabled; return true; }
  }
  return false;
}

bool LogStore::clear(const char* id) {
  for (auto& l : logs_) {
    if (l.id == id) {
      l.sessionStart  = 0;
      l.firstSample   = true;
      l.loggingActive = false;
      l.comp.reset();
      return true;
    }
  }
  return false;
}

String LogStore::serializeSessions(const char* id, fs::FS& sd) const {
  JsonDocument doc;
  JsonArray arr = doc.to<JsonArray>();
  for (const auto& l : logs_) {
    if (l.id != id) continue;
    char dirpath[40];
    snprintf(dirpath, sizeof(dirpath), "/logs/%s", l.id.c_str());
    File dir = sd.open(dirpath);
    if (dir && dir.isDirectory()) {
      File e = dir.openNextFile();
      while (e) {
        String raw = e.name();  // basename or full path, depending on core
        int sl = raw.lastIndexOf('/');
        String fn = (sl >= 0) ? raw.substring(sl + 1) : raw;
        if (fn.endsWith(".csv")) {
          long start = atol(fn.c_str());
          JsonObject o = arr.add<JsonObject>();
          o["start"]  = start;
          o["size"]   = (uint32_t)e.size();
          o["active"] = (l.sessionStart > 0 && (long)l.sessionStart == start);
        }
        e = dir.openNextFile();
      }
    }
    if (dir) dir.close();
    break;
  }
  String out;
  serializeJson(doc, out);
  return out;
}

bool LogStore::deleteSession(const char* id, time_t start, fs::FS& sd) {
  for (const auto& l : logs_) {
    if (l.id != id) continue;
    if (l.sessionStart > 0 && l.sessionStart == start) return false;  // active
    char path[48];
    snprintf(path, sizeof(path), "/logs/%s/%ld.csv", l.id.c_str(), (long)start);
    if (!sd.exists(path)) return false;
    return sd.remove(path);
  }
  return false;
}

// ── Series resolution ──────────────────────────────────────────────────────────

LogStore::Value LogStore::resolve(SensActCtrl::Registry& reg,
                                  const std::string& ref) {
  Value out;
  const size_t slash = ref.find('/');
  if (slash == std::string::npos) return out;
  const std::string role = ref.substr(0, slash);
  const std::string id   = ref.substr(slash + 1);

  if (role == "sensor") {
    // id is "<base>.<key>" or "<base>" for single-channel sensors.
    const size_t dot = id.find('.');
    const std::string base = (dot == std::string::npos) ? id : id.substr(0, dot);
    const std::string key  = (dot == std::string::npos) ? "" : id.substr(dot + 1);
    SensActCtrl::Sensor* s = reg.findSensor(base.c_str());
    if (!s) return out;
    for (size_t i = 0; i < s->channelCount(); ++i) {
      const SensActCtrl::Channel ch = s->channel(i);
      const char* ck = ch.key ? ch.key : "";
      if (key == ck) {
        out.value = ch.reading.value;
        out.valid = ch.reading.valid;
        out.res   = ch.meta.resolution;
        return out;
      }
    }
    return out;
  }

  if (role == "actuator") {
    SensActCtrl::Actuator* a = reg.findActuator(id.c_str());
    if (!a) return out;
    out.value = a->state();
    out.valid = true;
    out.res   = a->meta().resolution;
    return out;
  }

  if (role == "controller") {
    SensActCtrl::Controller* c = reg.findController(id.c_str());
    if (!c) return out;
    out.value = c->setpoint();
    out.valid = true;
    out.res   = 0.0f;
    return out;
  }

  return out;
}

// ── Sampling ───────────────────────────────────────────────────────────────────

String LogStore::sessionPath(const char* id, time_t start) const {
  for (const auto& l : logs_) {
    if (l.id != id) continue;
    const time_t s = (start > 0) ? start : l.sessionStart;
    if (s <= 0) return String();
    char p[48];
    snprintf(p, sizeof(p), "/logs/%s/%ld.csv", l.id.c_str(), (long)s);
    return String(p);
  }
  return String();
}

void LogStore::tick(SensActCtrl::Registry& reg, fs::FS& sd, time_t nowEpoch,
                    uint32_t nowMs) {
  if (nowEpoch <= 946684800L) return;  // wait for a real clock (post-2000)

  for (auto& l : logs_) {
    if (l.series.empty()) continue;

    // Effective enabled: a controller binding overrides the manual flag.
    bool eff = l.enabled;
    if (!l.bindEnableTo.empty()) {
      auto* c = reg.findController(l.bindEnableTo.c_str());
      if (c) eff = c->enabled();
    }

    if (!eff) {
      // On active→inactive transition, flush the buffered point so the session
      // ends on the last real reading.
      if (l.loggingActive) {
        LogSample out;
        if (l.comp.flush(out)) writeEmitted_(sd, l, out, nowEpoch);
        l.loggingActive = false;
      }
      continue;
    }
    l.loggingActive = true;

    const uint32_t intervalMs = l.intervalSec * 1000UL;
    if (!l.firstSample && (nowMs - l.lastSampleMs) < intervalMs) continue;
    l.firstSample = false;
    l.lastSampleMs = nowMs;

    // Resolve the current row, rounded to each channel's resolution.
    LogSample in;
    in.ts = nowEpoch;
    in.vals.reserve(l.series.size());
    for (const auto& s : l.series) {
      const Value v = resolve(reg, s.ref);
      float val = NAN;
      if (v.valid) {
        val = v.value;
        if (v.res > 0.0f) val = roundf(val / v.res) * v.res;
      }
      in.vals.push_back(val);
    }

    // Feed the compressor; only persist when it emits a (buffered) row.
    LogSample out;
    if (l.comp.feed(in, out)) writeEmitted_(sd, l, out, nowEpoch);
  }
}

void LogStore::writeEmitted_(fs::FS& sd, LogCfg& l, const LogSample& row,
                             time_t nowEpoch) {
  const bool created = (l.sessionStart == 0);
  if (created) {
    l.sessionStart = nowEpoch;
    sd.mkdir("/logs");
    char dir[40];
    snprintf(dir, sizeof(dir), "/logs/%s", l.id.c_str());
    sd.mkdir(dir);
    pruneToBudget_(sd);
  }
  char path[48];
  snprintf(path, sizeof(path), "/logs/%s/%ld.csv", l.id.c_str(),
           (long)l.sessionStart);

  File f = sd.open(path, FILE_APPEND);
  if (!f) return;

  if (created) {
    String header = "ts";
    for (const auto& s : l.series) { header += ','; header += s.ref.c_str(); }
    f.println(header);
  }

  String line = String((long)row.ts);
  for (float val : row.vals) {
    line += ',';
    if (!isnan(val)) {
      char num[16];
      snprintf(num, sizeof(num), "%.3f", val);
      line += num;
    }
    // NAN → empty cell
  }
  f.println(line);
  f.close();
}

void LogStore::pruneToBudget_(fs::FS& sd) {
  struct Entry { String path; uint32_t size; long start; bool active; };
  std::vector<Entry> entries;
  uint64_t total = 0;

  for (const auto& l : logs_) {
    char dirpath[40];
    snprintf(dirpath, sizeof(dirpath), "/logs/%s", l.id.c_str());
    File dir = sd.open(dirpath);
    if (!dir || !dir.isDirectory()) { if (dir) dir.close(); continue; }
    File e = dir.openNextFile();
    while (e) {
      String raw = e.name();
      int sl = raw.lastIndexOf('/');
      String fn = (sl >= 0) ? raw.substring(sl + 1) : raw;
      if (fn.endsWith(".csv")) {
        const long start = atol(fn.c_str());
        const uint32_t sz = (uint32_t)e.size();
        const bool active = (l.sessionStart > 0 && (long)l.sessionStart == start);
        total += sz;
        entries.push_back({String(dirpath) + "/" + fn, sz, start, active});
      }
      e = dir.openNextFile();
    }
    dir.close();
  }

  if (total <= kLogBudgetBytes) return;
  // Oldest first (smallest start epoch); never touch an active session.
  std::sort(entries.begin(), entries.end(),
            [](const Entry& a, const Entry& b) { return a.start < b.start; });
  for (auto& en : entries) {
    if (total <= kLogBudgetBytes) break;
    if (en.active) continue;
    if (sd.remove(en.path)) total -= en.size;
  }
}

}  // namespace BrewControl
