#pragma once

#include <Arduino.h>
#include <SensActCtrl.h>

#include <memory>

namespace BrewControl {

// Owns one DiscoveryScanner per transport that supports it, backing
// GET /api/remote/discover. Boot-bound like the transports themselves: MQTT
// only exists when enabled at boot, ESP-Now always.
class RemoteDiscovery {
 public:
  // ownIds must match the device ids this board's own publishers use on each
  // transport, so their answers are filtered out of the list.
  void begin(SensActCtrl::ITransport* mqtt, const String& mqttOwnId,
             SensActCtrl::ITransport* espnow, const String& espnowOwnId) {
    if (mqtt) {
      mqtt_ = std::make_unique<SensActCtrl::DiscoveryScanner>(*mqtt, mqttOwnId.c_str());
      mqtt_->begin();
    }
    if (espnow) {
      espnow_ = std::make_unique<SensActCtrl::DiscoveryScanner>(*espnow, espnowOwnId.c_str());
      espnow_->begin();
    }
  }

  void tick() {
    const uint32_t now = millis();
    if (mqtt_) mqtt_->tick(now);
    if (espnow_) espnow_->tick(now);
  }

  // nullptr if the transport is unknown or not available on this boot.
  SensActCtrl::DiscoveryScanner* scanner(const String& transport) {
    if (transport == "mqtt") return mqtt_.get();
    if (transport == "espnow") return espnow_.get();
    return nullptr;
  }

 private:
  std::unique_ptr<SensActCtrl::DiscoveryScanner> mqtt_;
  std::unique_ptr<SensActCtrl::DiscoveryScanner> espnow_;
};

}  // namespace BrewControl
