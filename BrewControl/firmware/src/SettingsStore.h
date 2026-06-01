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

 private:
  String mode_       = "system";   // "light" | "dark" | "system"
  String accent_     = "#d97706";  // hex color
  String background_ = "neutral";  // "neutral" | "warm" | "cool"
};

}  // namespace BrewControl
