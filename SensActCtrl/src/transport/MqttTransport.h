#pragma once

#include <stdint.h>
#include <atomic>
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
// The connect itself (DNS, TCP, TLS, CONNACK — seconds against an unreachable
// broker) runs in a short-lived FreeRTOS task, so tick() never blocks. While
// that task runs it alone touches the PubSubClient; publish() returns false
// and subscribe() only records. connected() and lastErrorMessage() read
// cached state and are safe to call from any task.
//
// PubSubClient's single-callback API is dispatched here to a per-topic
// callback list (exact-topic match, no wildcard support). Only one
// MqttTransport instance can receive callbacks at a time (last-constructed
// wins) — typical sketches have a single transport per node.
class MqttTransport : public ITransport {
 public:
  MqttTransport(Client& netClient, const char* host, uint16_t port,
                const char* clientId, const char* username = "",
                const char* password = "");
  ~MqttTransport() override;

  bool publish(const char* topic, const char* payload, bool retained) override;
  bool subscribe(const char* topic, MessageCallback callback) override;
  bool unsubscribe(const char* topic) override;
  void tick() override;
  bool connected() const override;
  const char* lastErrorMessage() const override;

  // Invoked by the static PubSubClient callback. Public so the static
  // bridge function can reach it; not part of the user-facing API.
  void dispatchIncoming(const char* topic, const uint8_t* payload, uint32_t length);

 private:
  enum Phase : uint8_t { kIdle, kConnecting, kDone };

  void startConnect_();
  void finishConnect_();
  bool usable_() const;
  static void connectTask_(void* self);

  PubSubClient* client_ = nullptr;
  std::string host_;
  uint16_t port_;
  std::string clientId_;
  std::string username_;
  std::string password_;
  std::vector<std::pair<std::string, MessageCallback>> subs_;
  uint32_t lastConnectAttemptMs_ = 0;
  uint32_t reconnectBackoffMs_ = 1000;

  // Hand-over between tick() and the connect task: kConnecting gives the
  // task exclusive use of client_, kDone (written after connectOk_) hands
  // it back.
  std::atomic<uint8_t> phase_{kIdle};
  bool connectOk_ = false;
  std::string connectId_;  // client id of the running attempt
  std::atomic<bool> linkUp_{false};
  std::atomic<int> state_{-1};  // PubSubClient::state(), MQTT_DISCONNECTED
};

}  // namespace SensActCtrl
