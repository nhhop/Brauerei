#pragma once

#include <stdint.h>
#include <map>
#include <string>
#include <utility>
#include <vector>

#include "transport/ITransport.h"

namespace SensActCtrl {

// ESP-Now transport. Connection-less 2.4 GHz broadcast — no broker, no
// WiFi association needed. Same wire format as MqttTransport (topic strings
// + JSON payloads) so payloads can be inspected uniformly across both
// transports.
//
// Wire framing (one ESP-Now packet, max 250 B total):
//   Data:             [0x01][u8 topic_len][topic chars][payload chars]
//   Retained-Request: [0x02]
//
// Retain emulation: publish(topic, payload, retained=true) caches the
// payload locally. On subscribe() (throttled to once per ~1 s across all
// subscriptions) the transport broadcasts a Retained-Request, prompting
// other nodes to re-broadcast their cached retained payloads. This gives
// late subscribers a quick path to the current meta + state without
// waiting for the next periodic publish.
//
// Peer model: broadcast-only (FF:FF:FF:FF:FF:FF). All nodes on the same
// WiFi channel see every packet.
class EspNowTransport : public ITransport {
 public:
  // channel: WiFi channel 1..13. Must match across all peers.
  explicit EspNowTransport(uint8_t channel = 1);
  ~EspNowTransport() override;

  bool publish(const char* topic, const char* payload, bool retained) override;
  bool subscribe(const char* topic, MessageCallback callback) override;
  void tick() override;
  bool connected() const override { return initialized_; }

  // Called from the static ESP-Now receive callback. Public so the static
  // bridge can reach it; not part of the user-facing API.
  void dispatchIncoming(const uint8_t* data, int length);

 private:
  bool initEspNow_();
  bool sendRaw_(const uint8_t* data, size_t len);
  bool sendDataPacket_(const char* topic, const char* payload);
  void sendRetainedRequest_();
  void handleRetainedRequest_();

  uint8_t channel_;
  bool initialized_ = false;
  uint32_t lastRetainedRequestMs_ = 0;
  std::vector<std::pair<std::string, MessageCallback>> subs_;
  std::map<std::string, std::string> retained_;
};

}  // namespace SensActCtrl
