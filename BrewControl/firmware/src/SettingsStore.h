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

 private:
  String mode_       = "system";   // "light" | "dark" | "system"
  String accent_     = "#d97706";  // hex color
  String background_ = "neutral";  // "neutral" | "warm" | "cool"
  String fwChannel_   = "stable";  // "stable" | "preview"
  bool   fwAutoCheck_ = true;
};

}  // namespace BrewControl
