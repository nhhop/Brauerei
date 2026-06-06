#include "LogStore.h"

#include <Arduino.h>
#include <math.h>
#include <string.h>

namespace BrewControl {
namespace {

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
    l.algo      = algoFromStr(obj["algo"] | "none");
    l.maxGapSec = obj["maxGapSec"] | 600;
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
  l.algo      = algoFromStr(cfg["algo"] | "none");
  l.maxGapSec = cfg["maxGapSec"] | 600;
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

String LogStore::sessionPath(const char* id) const {
  for (const auto& l : logs_) {
    if (l.id == id && l.sessionStart > 0) {
      char p[48];
      snprintf(p, sizeof(p), "/logs/%s/%ld.csv", l.id.c_str(),
               (long)l.sessionStart);
      return String(p);
    }
  }
  return String();
}

void LogStore::tick(SensActCtrl::Registry& reg, fs::FS& sd, time_t nowEpoch,
                    uint32_t nowMs) {
  if (nowEpoch <= 946684800L) return;  // wait for a real clock (post-2000)

  for (auto& l : logs_) {
    if (l.series.empty()) continue;
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
    if (!l.comp.feed(in, out)) continue;

    const bool created = (l.sessionStart == 0);
    if (created) {
      l.sessionStart = nowEpoch;
      sd.mkdir("/logs");
      char dir[40];
      snprintf(dir, sizeof(dir), "/logs/%s", l.id.c_str());
      sd.mkdir(dir);
    }
    char path[48];
    snprintf(path, sizeof(path), "/logs/%s/%ld.csv", l.id.c_str(),
             (long)l.sessionStart);

    File f = sd.open(path, FILE_APPEND);
    if (!f) continue;

    if (created) {
      String header = "ts";
      for (const auto& s : l.series) { header += ','; header += s.ref.c_str(); }
      f.println(header);
    }

    String row = String((long)out.ts);
    for (float val : out.vals) {
      row += ',';
      if (!isnan(val)) {
        char num[16];
        snprintf(num, sizeof(num), "%.3f", val);
        row += num;
      }
      // NAN → empty cell
    }
    f.println(row);
    f.close();
  }
}

}  // namespace BrewControl
