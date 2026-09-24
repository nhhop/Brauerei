#include "DashboardStore.h"

#include "SdLock.h"

namespace BrewControl {
namespace {

// RAII guard for the recursive dashboards_ mutex (same as ProgramRunner's).
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

// ── Persistence ───────────────────────────────────────────────────────────────

void DashboardStore::loadFromSD(fs::FS& sd) {
  ScopedLock lk(mutex_);
  SdLock sdLock;
  File f = sd.open("/config/dashboards.json");
  if (!f) return;
  JsonDocument doc;
  if (deserializeJson(doc, f) != DeserializationError::Ok) { f.close(); return; }
  f.close();

  for (JsonObject obj : doc.as<JsonArray>()) {
    DashboardCfg d;
    d.id   = obj["id"]   | "";
    d.name = obj["name"] | "";
    if (d.id.empty() || d.name.empty()) continue;
    for (JsonVariant v : obj["sensors"].as<JsonArray>())
      if (const char* s = v.as<const char*>()) d.sensors.push_back(s);
    for (JsonVariant v : obj["actuators"].as<JsonArray>())
      if (const char* s = v.as<const char*>()) d.actuators.push_back(s);
    for (JsonVariant v : obj["controllers"].as<JsonArray>())
      if (const char* s = v.as<const char*>()) d.controllers.push_back(s);
    for (JsonVariant v : obj["charts"].as<JsonArray>())
      if (const char* s = v.as<const char*>()) d.charts.push_back(s);
    for (JsonVariant v : obj["programs"].as<JsonArray>())
      if (const char* s = v.as<const char*>()) d.programs.push_back(s);
    for (JsonVariant v : obj["timers"].as<JsonArray>())
      if (const char* s = v.as<const char*>()) d.timers.push_back(s);
    for (JsonPair kv : obj["sensorModes"].as<JsonObject>())
      if (const char* v = kv.value().as<const char*>()) d.sensorModes.push_back({kv.key().c_str(), v});
    for (JsonPair kv : obj["controllerModes"].as<JsonObject>())
      if (const char* v = kv.value().as<const char*>()) d.controllerModes.push_back({kv.key().c_str(), v});
    for (JsonPair kv : obj["timerModes"].as<JsonObject>())
      if (const char* v = kv.value().as<const char*>()) d.timerModes.push_back({kv.key().c_str(), v});
    if (obj["layout"].is<JsonObject>()) d.layout.set(obj["layout"]);
    dashboards_.push_back(std::move(d));
  }
  ++revision_;
}

void DashboardStore::saveToSD(fs::FS& sd) const {
  SdLock sdLock;
  sd.mkdir("/config");
  File f = sd.open("/config/dashboards.json", FILE_WRITE);
  if (!f) return;
  f.print(serialize());
  f.close();
}

// ── Serialization ─────────────────────────────────────────────────────────────

String DashboardStore::serialize() const {
  ScopedLock lk(mutex_);
  JsonDocument doc;
  JsonArray arr = doc.to<JsonArray>();
  for (const auto& d : dashboards_) {
    JsonObject obj = arr.add<JsonObject>();
    obj["id"]   = d.id.c_str();
    obj["name"] = d.name.c_str();
    JsonArray s = obj["sensors"].to<JsonArray>();
    for (const auto& id : d.sensors)     s.add(id.c_str());
    JsonArray a = obj["actuators"].to<JsonArray>();
    for (const auto& id : d.actuators)   a.add(id.c_str());
    JsonArray c = obj["controllers"].to<JsonArray>();
    for (const auto& id : d.controllers) c.add(id.c_str());
    JsonArray ch = obj["charts"].to<JsonArray>();
    for (const auto& id : d.charts)      ch.add(id.c_str());
    JsonArray pr = obj["programs"].to<JsonArray>();
    for (const auto& id : d.programs)    pr.add(id.c_str());
    JsonArray tm = obj["timers"].to<JsonArray>();
    for (const auto& id : d.timers)      tm.add(id.c_str());
    JsonObject sm = obj["sensorModes"].to<JsonObject>();
    for (const auto& kv : d.sensorModes)     sm[kv.first.c_str()] = kv.second.c_str();
    JsonObject cm = obj["controllerModes"].to<JsonObject>();
    for (const auto& kv : d.controllerModes) cm[kv.first.c_str()] = kv.second.c_str();
    JsonObject tmo = obj["timerModes"].to<JsonObject>();
    for (const auto& kv : d.timerModes)      tmo[kv.first.c_str()] = kv.second.c_str();
    // Omitted entirely when unset, so an un-arranged dashboard stays as small
    // as before and the UI can tell "never arranged" from "arranged".
    if (!d.layout.isNull()) obj["layout"] = d.layout;
  }
  String out;
  serializeJson(doc, out);
  return out;
}

// ── CRUD ──────────────────────────────────────────────────────────────────────

String DashboardStore::generateId() {
  char buf[7];
  snprintf(buf, sizeof(buf), "%06lx", (unsigned long)(random(0x1000000)));
  return String(buf);
}

void DashboardStore::fillFromJson(DashboardCfg& d, const JsonObject& cfg) {
  d.name = cfg["name"] | "Dashboard";
  d.sensors.clear();
  d.actuators.clear();
  d.controllers.clear();
  d.charts.clear();
  d.programs.clear();
  d.timers.clear();
  d.sensorModes.clear();
  d.controllerModes.clear();
  d.timerModes.clear();
  d.layout.clear();
  for (JsonVariant v : cfg["sensors"].as<JsonArray>())
    if (const char* s = v.as<const char*>()) d.sensors.push_back(s);
  for (JsonVariant v : cfg["actuators"].as<JsonArray>())
    if (const char* s = v.as<const char*>()) d.actuators.push_back(s);
  for (JsonVariant v : cfg["controllers"].as<JsonArray>())
    if (const char* s = v.as<const char*>()) d.controllers.push_back(s);
  for (JsonVariant v : cfg["charts"].as<JsonArray>())
    if (const char* s = v.as<const char*>()) d.charts.push_back(s);
  for (JsonVariant v : cfg["programs"].as<JsonArray>())
    if (const char* s = v.as<const char*>()) d.programs.push_back(s);
  for (JsonVariant v : cfg["timers"].as<JsonArray>())
    if (const char* s = v.as<const char*>()) d.timers.push_back(s);
  for (JsonPair kv : cfg["sensorModes"].as<JsonObject>())
    if (const char* v = kv.value().as<const char*>()) d.sensorModes.push_back({kv.key().c_str(), v});
  for (JsonPair kv : cfg["controllerModes"].as<JsonObject>())
    if (const char* v = kv.value().as<const char*>()) d.controllerModes.push_back({kv.key().c_str(), v});
  for (JsonPair kv : cfg["timerModes"].as<JsonObject>())
    if (const char* v = kv.value().as<const char*>()) d.timerModes.push_back({kv.key().c_str(), v});
  // Replace semantics like every list above: a body without "layout" clears it.
  if (cfg["layout"].is<JsonObject>()) d.layout.set(cfg["layout"]);
}

String DashboardStore::add(const JsonObject& cfg) {
  DashboardCfg d;
  d.id = generateId().c_str();
  fillFromJson(d, cfg);
  String id = d.id.c_str();
  ScopedLock lk(mutex_);
  dashboards_.push_back(std::move(d));
  ++revision_;
  return id;
}

bool DashboardStore::update(const char* id, const JsonObject& cfg) {
  ScopedLock lk(mutex_);
  for (auto& d : dashboards_) {
    if (d.id == id) { fillFromJson(d, cfg); ++revision_; return true; }
  }
  return false;
}

bool DashboardStore::remove(const char* id) {
  ScopedLock lk(mutex_);
  for (auto it = dashboards_.begin(); it != dashboards_.end(); ++it) {
    if (it->id == id) { dashboards_.erase(it); ++revision_; return true; }
  }
  return false;
}

bool DashboardStore::move(const char* id, int dir) {
  ScopedLock lk(mutex_);
  auto it = std::find_if(dashboards_.begin(), dashboards_.end(),
      [&](const DashboardCfg& d) { return d.id == id; });
  if (it == dashboards_.end()) return false;
  size_t i = std::distance(dashboards_.begin(), it);
  if (dir < 0 && i == 0) return true;                        // already leftmost: no-op
  if (dir > 0 && i + 1 >= dashboards_.size()) return true;    // already rightmost: no-op
  size_t j = (dir < 0) ? i - 1 : i + 1;
  std::swap(dashboards_[i], dashboards_[j]);
  ++revision_;
  return true;
}

size_t DashboardStore::count() const {
  ScopedLock lk(mutex_);
  return dashboards_.size();
}

bool DashboardStore::dashboardAt(size_t index, Items& out) const {
  ScopedLock lk(mutex_);
  if (index >= dashboards_.size()) return false;
  const DashboardCfg& d = dashboards_[index];
  out.name = d.name;
  out.sensors = d.sensors;
  out.actuators = d.actuators;
  out.controllers = d.controllers;
  return true;
}

}  // namespace BrewControl
