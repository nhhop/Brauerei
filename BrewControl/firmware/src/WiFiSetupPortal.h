#pragma once

namespace BrewControl {

// AP-mode setup portal. Blocks until the user submits WiFi credentials
// through the captive-portal page, persists them to NVS (Preferences
// namespace "brewctrl", keys "ssid" / "password"), then ESP.restart()s.
// On the next boot, main.cpp reads the prefs and enters STA mode.
class WiFiSetupPortal {
 public:
  void runUntilConfigured();
};

}  // namespace BrewControl
