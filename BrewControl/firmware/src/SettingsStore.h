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

  // Bumped by loadFromSD and update, so a reader on another task can re-read
  // the String settings only after a change instead of on every tick.
  uint32_t revision() const { return revision_; }

  // Appearance: hex colors "#rrggbb" as chosen in the web UI.
  const String& accentColor() const { return accent_; }
  const String& secondaryColor() const { return secondary_; }

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

  // Webhook publish preferences (this device as a leaf, mirroring its own
  // registry to a peer over HTTP — separate from the per-item "Remote"
  // consumer config in DynamicItems).
  bool webhookEnabled() const { return webhookEnabled_; }
  uint16_t webhookListenPort() const { return webhookListenPort_; }
  const String& webhookPeerUrl() const { return webhookPeerUrl_; }
  const String& webhookClientId() const { return webhookClientId_; }
  const String& webhookTopicPrefix() const { return webhookTopicPrefix_; }

  // WebSocket preferences. Hub: this device runs the WebSocket server that
  // leaves connect to — "Remote" items with transport "websocket" in
  // DynamicItems ride it. Publish: this device as a leaf, mirroring its own
  // registry to a hub over a client connection.
  bool websocketHubEnabled() const { return websocketHubEnabled_; }
  uint16_t websocketHubPort() const { return websocketHubPort_; }
  bool websocketPublishEnabled() const { return websocketPublishEnabled_; }
  const String& websocketHubUrl() const { return websocketHubUrl_; }
  const String& websocketClientId() const { return websocketClientId_; }
  const String& websocketTopicPrefix() const { return websocketTopicPrefix_; }

  // ESP-NOW publish preferences (this device as a leaf, broadcasting its
  // own registry — no host/port/channel: rides the existing shared
  // broadcast transport).
  bool espnowEnabled() const { return espnowEnabled_; }
  const String& espnowClientId() const { return espnowClientId_; }
  const String& espnowTopicPrefix() const { return espnowTopicPrefix_; }

  // Burn-in protection of the device's own display (BREWCTL_HAS_DISPLAY);
  // stored on every board. Idle seconds until dimmed / dark, 0 = never.
  uint8_t displayBrightness() const { return displayBrightness_; }  // % of panel maximum
  uint32_t displayDimAfterSec() const { return displayDimAfterSec_; }
  uint8_t displayDimPercent() const { return displayDimPercent_; }  // % of displayBrightness
  uint32_t displayOffAfterSec() const { return displayOffAfterSec_; }
  bool displayPixelShift() const { return displayPixelShift_; }

  // Energy management: id of the sensor item that measures the battery
  // voltage ("" = none). The item itself is a normal sensor, usually of
  // type Voltage.
  const String& energyBatterySensor() const { return energyBatterySensor_; }

  // Deep sleep between measurements (EnergyManager). The wake pin is an RTC
  // GPIO (-1 = none; required while deepSleep is on). Held active it keeps
  // the device awake; a press wakes it fully for awakeTimeoutSec after the
  // last UI access. shortWakeWifi: a short wake (timer) connects to Wi-Fi —
  // without it only ESP-NOW publishes, on the last known channel.
  bool energyDeepSleep() const { return energyDeepSleep_; }
  uint32_t energySleepIntervalSec() const { return energySleepIntervalSec_; }
  int energyWakePin() const { return energyWakePin_; }
  bool energyWakeActiveLow() const { return energyWakeActiveLow_; }
  uint32_t energyAwakeTimeoutSec() const { return energyAwakeTimeoutSec_; }
  bool energyShortWakeWifi() const { return energyShortWakeWifi_; }

 private:
  uint32_t revision_ = 0;
  String mode_       = "system";   // "light" | "dark" | "system"
  String accent_     = "#0078d4";  // hex color (Windows accent blue)
  String secondary_  = "#22c55e";  // hex color (second series: controller output)
  String background_ = "neutral";  // "neutral" | "warm" | "cool"
  // Background gradient (web UI only — nothing in the firmware reads it).
  bool   gradientEnabled_   = false;
  String gradientFrom_      = "#0ea5e9";  // hex colors, hue/chroma of the three stops
  String gradientVia_       = "#6366f1";
  String gradientTo_        = "#0891b2";
  int    gradientAngle_     = 135;        // degrees, 0–360
  int    gradientIntensity_ = 15;         // 0–100
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

  bool     webhookEnabled_     = false;
  uint16_t webhookListenPort_  = 8080;
  String   webhookPeerUrl_     = "";
  String   webhookClientId_    = "";           // empty ⇒ falls back to mDNS hostname
  String   webhookTopicPrefix_ = "brewcontrol";

  bool     websocketHubEnabled_     = false;
  uint16_t websocketHubPort_        = 8081;
  bool     websocketPublishEnabled_ = false;
  String   websocketHubUrl_         = "";           // ws://host[:port][/path]
  String   websocketClientId_       = "";           // empty ⇒ falls back to mDNS hostname
  String   websocketTopicPrefix_    = "brewcontrol";

  bool     espnowEnabled_     = false;
  String   espnowClientId_    = "";           // empty ⇒ falls back to mDNS hostname
  String   espnowTopicPrefix_ = "brewcontrol";

  uint8_t  displayBrightness_  = 63;   // ~160/255, the level before it was adjustable
  uint32_t displayDimAfterSec_ = 120;
  uint8_t  displayDimPercent_  = 20;
  uint32_t displayOffAfterSec_ = 600;
  bool     displayPixelShift_  = false;

  String   energyBatterySensor_ = "";
  bool     energyDeepSleep_ = false;
  uint32_t energySleepIntervalSec_ = 300;
  int      energyWakePin_ = -1;
  bool     energyWakeActiveLow_ = true;
  uint32_t energyAwakeTimeoutSec_ = 300;
  bool     energyShortWakeWifi_ = true;

  void readEnergy_(const JsonObject& energy);
  void readGradient_(const JsonObject& gradient);
};

}  // namespace BrewControl
