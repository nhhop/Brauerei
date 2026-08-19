// BrewControl/firmware/src/SettingsStore.cpp
#include "SettingsStore.h"

#include "SdLock.h"

namespace BrewControl {

void SettingsStore::loadFromSD(fs::FS& sd) {
  SdLock sdLock;
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
  JsonObject t = doc["time"].as<JsonObject>();
  if (!t.isNull()) {
    if (const char* s = t["ntpServer"])  ntpServer_    = s;
    if (t["utcOffsetSec"].is<int>())     utcOffsetSec_ = t["utcOffsetSec"].as<int32_t>();
    if (t["dstOffsetSec"].is<int>())     dstOffsetSec_ = t["dstOffsetSec"].as<int32_t>();
    if (const char* f = t["timeFormat"]) timeFormat_   = f;
    if (const char* f = t["dateFormat"]) dateFormat_   = f;
  }
  JsonObject mqtt = doc["mqtt"].as<JsonObject>();
  if (!mqtt.isNull()) {
    if (mqtt["enabled"].is<bool>())        mqttEnabled_     = mqtt["enabled"].as<bool>();
    if (const char* m = mqtt["mode"])      mqttMode_        = m;
    if (const char* h = mqtt["host"])      mqttHost_        = h;
    if (mqtt["port"].is<int>())            mqttPort_        = mqtt["port"].as<uint16_t>();
    if (const char* u = mqtt["username"])  mqttUsername_    = u;
    if (const char* p = mqtt["password"])  mqttPassword_    = p;
    if (mqtt["tls"].is<bool>())            mqttTls_         = mqtt["tls"].as<bool>();
    if (const char* c = mqtt["clientId"])  mqttClientId_    = c;
    if (const char* p = mqtt["topicPrefix"]) mqttTopicPrefix_ = p;
  }
}

void SettingsStore::saveToSD(fs::FS& sd) const {
  SdLock sdLock;
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
  JsonObject t = doc["time"].to<JsonObject>();
  t["ntpServer"]    = ntpServer_.c_str();
  t["utcOffsetSec"] = utcOffsetSec_;
  t["dstOffsetSec"] = dstOffsetSec_;
  t["timeFormat"]   = timeFormat_.c_str();
  t["dateFormat"]   = dateFormat_.c_str();
  JsonObject mqtt = doc["mqtt"].to<JsonObject>();
  mqtt["enabled"]     = mqttEnabled_;
  mqtt["mode"]        = mqttMode_.c_str();
  mqtt["host"]        = mqttHost_.c_str();
  mqtt["port"]        = mqttPort_;
  mqtt["username"]    = mqttUsername_.c_str();
  mqtt["password"]    = mqttPassword_.c_str();
  mqtt["tls"]         = mqttTls_;
  mqtt["clientId"]    = mqttClientId_.c_str();
  mqtt["topicPrefix"] = mqttTopicPrefix_.c_str();
#ifdef BREWCTL_HAS_EMBEDDED_MQTT_BROKER
  mqtt["embeddedBrokerSupported"] = true;
#else
  mqtt["embeddedBrokerSupported"] = false;
#endif
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
  JsonObject t = patch["time"].as<JsonObject>();
  if (!t.isNull()) {
    if (const char* s = t["ntpServer"])  ntpServer_    = s;
    if (t["utcOffsetSec"].is<int>())     utcOffsetSec_ = t["utcOffsetSec"].as<int32_t>();
    if (t["dstOffsetSec"].is<int>())     dstOffsetSec_ = t["dstOffsetSec"].as<int32_t>();
    if (const char* f = t["timeFormat"]) timeFormat_   = f;
    if (const char* f = t["dateFormat"]) dateFormat_   = f;
  }
  JsonObject mqtt = patch["mqtt"].as<JsonObject>();
  if (!mqtt.isNull()) {
    if (mqtt["enabled"].is<bool>())        mqttEnabled_     = mqtt["enabled"].as<bool>();
    if (const char* m = mqtt["mode"])      mqttMode_        = m;
    if (const char* h = mqtt["host"])      mqttHost_        = h;
    if (mqtt["port"].is<int>())            mqttPort_        = mqtt["port"].as<uint16_t>();
    if (const char* u = mqtt["username"])  mqttUsername_    = u;
    if (const char* p = mqtt["password"])  mqttPassword_    = p;
    if (mqtt["tls"].is<bool>())            mqttTls_         = mqtt["tls"].as<bool>();
    if (const char* c = mqtt["clientId"])  mqttClientId_    = c;
    if (const char* p = mqtt["topicPrefix"]) mqttTopicPrefix_ = p;
    // "embeddedBrokerSupported" is read-only (server-computed) — never read from a patch.
  }
}

}  // namespace BrewControl
