#pragma once

#include <stdint.h>
#include <string>
#include <utility>
#include <vector>

#include "transport/ITransport.h"

// Forward decls — keep PubSubClient/Arduino headers out of consumers.
class Client;
class PubSubClient;

namespace SensActCtrl {

// MQTT transport wrapping PubSubClient. Owns connection state; tick() drives
// reconnect with exponential backoff (capped at 30 s). Subscriptions are
// persistent — re-subscribed after every reconnect, callers register once.
//
// PubSubClient's single-callback API is dispatched here to a per-topic
// callback list (exact-topic match, no wildcard support). Only one
// MqttTransport instance can receive callbacks at a time (last-constructed
// wins) — typical sketches have a single transport per node.
class MqttTransport : public ITransport {
 public:
  MqttTransport(Client& netClient, const char* host, uint16_t port,
                const char* clientId);
  ~MqttTransport() override;

  bool publish(const char* topic, const char* payload, bool retained) override;
  bool subscribe(const char* topic, MessageCallback callback) override;
  void tick() override;
  bool connected() const override;

  // Invoked by the static PubSubClient callback. Public so the static
  // bridge function can reach it; not part of the user-facing API.
  void dispatchIncoming(const char* topic, const uint8_t* payload, uint32_t length);

 private:
  bool attemptConnect_();

  PubSubClient* client_ = nullptr;
  std::string host_;
  uint16_t port_;
  std::string clientId_;
  std::vector<std::pair<std::string, MessageCallback>> subs_;
  uint32_t lastConnectAttemptMs_ = 0;
  uint32_t reconnectBackoffMs_ = 1000;
};

}  // namespace SensActCtrl
