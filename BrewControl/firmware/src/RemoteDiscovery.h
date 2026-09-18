#pragma once

#include <Arduino.h>
#include <SensActCtrl.h>

#include <memory>

namespace BrewControl {

// Owns one DiscoveryScanner per transport that supports it, backing
// GET /api/remote/discover. Boot-bound like the transports themselves: MQTT
// only exists when enabled at boot, ESP-Now always, the WebSocket hub only
// when it is enabled.
//
// The WebSocket scanner runs on the hub transport, so it reaches exactly the
// leaves currently connected to this device (a server publishes to all its
// clients, and each answers only its own server). Boards are paired first —
// see POST /api/remote/pair — and their items show up here afterwards.
class RemoteDiscovery {
 public:
  // ownIds must match the device ids this board's own publishers use on each
  // transport, so their answers are filtered out of the list.
  void begin(SensActCtrl::ITransport* mqtt, const String& mqttOwnId,
             SensActCtrl::ITransport* espnow, const String& espnowOwnId,
             SensActCtrl::ITransport* websocket, const String& websocketOwnId) {
    if (mqtt) {
      mqtt_ = std::make_unique<SensActCtrl::DiscoveryScanner>(*mqtt, mqttOwnId.c_str());
      mqtt_->begin();
    }
    if (espnow) {
      espnow_ = std::make_unique<SensActCtrl::DiscoveryScanner>(*espnow, espnowOwnId.c_str());
      espnow_->begin();
    }
    if (websocket) {
      websocket_ =
          std::make_unique<SensActCtrl::DiscoveryScanner>(*websocket, websocketOwnId.c_str());
      websocket_->begin();
    }
  }

  void tick() {
    const uint32_t now = millis();
    if (mqtt_) mqtt_->tick(now);
    if (espnow_) espnow_->tick(now);
    if (websocket_) websocket_->tick(now);
  }

  // nullptr if the transport is unknown or not available on this boot.
  SensActCtrl::DiscoveryScanner* scanner(const String& transport) {
    if (transport == "mqtt") return mqtt_.get();
    if (transport == "espnow") return espnow_.get();
    if (transport == "websocket") return websocket_.get();
    return nullptr;
  }

 private:
  std::unique_ptr<SensActCtrl::DiscoveryScanner> mqtt_;
  std::unique_ptr<SensActCtrl::DiscoveryScanner> espnow_;
  std::unique_ptr<SensActCtrl::DiscoveryScanner> websocket_;
};

}  // namespace BrewControl
