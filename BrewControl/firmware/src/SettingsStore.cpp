// BrewControl/firmware/src/SettingsStore.cpp
#include "SettingsStore.h"

namespace BrewControl {

void SettingsStore::loadFromSD(fs::FS& sd) {
  File f = sd.open("/config/settings.json");
  if (!f) return;
  JsonDocument doc;
  if (deserializeJson(doc, f) != DeserializationError::Ok) { f.close(); return; }
  f.close();
  JsonObject theme = doc["theme"].as<JsonObject>();
  if (!theme.isNull()) {
    if (const char* m = theme["mode"])       mode_       = m;
    if (const char* a = theme["accent"])     accent_     = a;
    if (const char* b = theme["background"]) background_ = b;
  }
  JsonObject fw = doc["firmware"].as<JsonObject>();
  if (!fw.isNull()) {
    if (const char* c = fw["channel"]) fwChannel_ = c;
    if (fw["autoCheck"].is<bool>())    fwAutoCheck_ = fw["autoCheck"].as<bool>();
  }
}

void SettingsStore::saveToSD(fs::FS& sd) const {
  sd.mkdir("/config");
  File f = sd.open("/config/settings.json", FILE_WRITE);
  if (!f) return;
  f.print(serialize());
  f.close();
}

String SettingsStore::serialize() const {
  JsonDocument doc;
  JsonObject theme = doc["theme"].to<JsonObject>();
  theme["mode"]       = mode_.c_str();
  theme["accent"]     = accent_.c_str();
  theme["background"] = background_.c_str();
  JsonObject fw = doc["firmware"].to<JsonObject>();
  fw["channel"]   = fwChannel_.c_str();
  fw["autoCheck"] = fwAutoCheck_;
  String out;
  serializeJson(doc, out);
  return out;
}

void SettingsStore::update(const JsonObject& patch) {
  JsonObject theme = patch["theme"].as<JsonObject>();
  if (!theme.isNull()) {
    if (const char* m = theme["mode"])       mode_       = m;
    if (const char* a = theme["accent"])     accent_     = a;
    if (const char* b = theme["background"]) background_ = b;
  }
  JsonObject fw = patch["firmware"].as<JsonObject>();
  if (!fw.isNull()) {
    if (const char* c = fw["channel"])  fwChannel_   = c;
    if (fw["autoCheck"].is<bool>())     fwAutoCheck_ = fw["autoCheck"].as<bool>();
  }
}

}  // namespace BrewControl
