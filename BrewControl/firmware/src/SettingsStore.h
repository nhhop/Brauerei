// BrewControl/firmware/src/SettingsStore.h
#pragma once

#include <ArduinoJson.h>
#include <FS.h>

namespace BrewControl {

class SettingsStore {
 public:
  void loadFromSD(fs::FS& sd);
  void saveToSD(fs::FS& sd) const;
  String serialize() const;
  void update(const JsonObject& patch);

  // Firmware-update preferences.
  const String& firmwareChannel() const { return fwChannel_; }   // "stable" | "preview"
  bool firmwareAutoCheck() const { return fwAutoCheck_; }

  // Time preferences.
  const String& ntpServer() const { return ntpServer_; }
  int32_t utcOffsetSec() const { return utcOffsetSec_; }
  int32_t dstOffsetSec() const { return dstOffsetSec_; }
  const String& timeFormat() const { return timeFormat_; }   // "24h" | "12h"
  const String& dateFormat() const { return dateFormat_; }   // "DD.MM.YYYY" | "MM/DD/YYYY" | "YYYY-MM-DD"

  // MQTT preferences.
  bool mqttEnabled() const { return mqttEnabled_; }
  const String& mqttMode() const { return mqttMode_; }         // "external" | "embedded"
  const String& mqttHost() const { return mqttHost_; }
  uint16_t mqttPort() const { return mqttPort_; }
  const String& mqttUsername() const { return mqttUsername_; }
  const String& mqttPassword() const { return mqttPassword_; }
  bool mqttTls() const { return mqttTls_; }
  const String& mqttClientId() const { return mqttClientId_; }
  const String& mqttTopicPrefix() const { return mqttTopicPrefix_; }

 private:
  String mode_       = "system";   // "light" | "dark" | "system"
  String accent_     = "#0078d4";  // hex color (Windows accent blue)
  String background_ = "neutral";  // "neutral" | "warm" | "cool"
  String fwChannel_   = "stable";  // "stable" | "preview"
  bool   fwAutoCheck_ = true;

  String  ntpServer_    = "pool.ntp.org";
  int32_t utcOffsetSec_ = 3600;   // CET
  int32_t dstOffsetSec_ = 3600;   // CEST
  String  timeFormat_   = "24h";
  String  dateFormat_   = "DD.MM.YYYY";

  bool     mqttEnabled_     = false;
  String   mqttMode_        = "external";   // "external" | "embedded"
  String   mqttHost_        = "";
  uint16_t mqttPort_        = 1883;
  String   mqttUsername_    = "";
  String   mqttPassword_    = "";
  bool     mqttTls_         = false;
  String   mqttClientId_    = "";           // empty ⇒ MqttService falls back to mDNS hostname
  String   mqttTopicPrefix_ = "brewcontrol";
};

}  // namespace BrewControl
