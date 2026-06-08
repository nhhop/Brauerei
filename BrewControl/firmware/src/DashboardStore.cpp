#include "DashboardStore.h"

namespace BrewControl {

// ── Persistence ───────────────────────────────────────────────────────────────

void DashboardStore::loadFromSD(fs::FS& sd) {
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
    dashboards_.push_back(std::move(d));
  }
}

void DashboardStore::saveToSD(fs::FS& sd) const {
  sd.mkdir("/config");
  File f = sd.open("/config/dashboards.json", FILE_WRITE);
  if (!f) return;
  f.print(serialize());
  f.close();
}

// ── Serialization ─────────────────────────────────────────────────────────────

String DashboardStore::serialize() const {
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
}

String DashboardStore::add(const JsonObject& cfg) {
  DashboardCfg d;
  d.id = generateId().c_str();
  fillFromJson(d, cfg);
  String id = d.id.c_str();
  dashboards_.push_back(std::move(d));
  return id;
}

bool DashboardStore::update(const char* id, const JsonObject& cfg) {
  for (auto& d : dashboards_) {
    if (d.id == id) { fillFromJson(d, cfg); return true; }
  }
  return false;
}

bool DashboardStore::remove(const char* id) {
  for (auto it = dashboards_.begin(); it != dashboards_.end(); ++it) {
    if (it->id == id) { dashboards_.erase(it); return true; }
  }
  return false;
}

}  // namespace BrewControl
