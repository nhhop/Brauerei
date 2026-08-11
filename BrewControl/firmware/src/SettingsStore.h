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
};

}  // namespace BrewControl
