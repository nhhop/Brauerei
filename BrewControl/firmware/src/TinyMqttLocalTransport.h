#pragma once

#ifdef ARDUINO
#ifdef BREWCTL_HAS_EMBEDDED_MQTT_BROKER

#include <TinyMqtt.h>
#include <string>
#include <utility>
#include <vector>
#include <transport/ITransport.h>

namespace BrewControl {

// SensActCtrl::ITransport implementation wrapping TinyMqtt's native
// in-process local client (MqttClient(&broker)) — no TCP/IP socket, no
// self-connect. Fixes the embedded-broker self-publish deadlock: a
// WiFiClient dialing this device's own IP (or 127.0.0.1) to reach its own
// TinyMqtt broker times out (PubSubClient state -4) regardless of which
// address is used — verified 2026-08-20, root cause not fully isolated
// (candidates: ESP32 lwIP loopback unsupported, AP not reflecting
// station-to-self traffic, or the blocking connect() starving the
// broker's own loop() of CPU before either side's timeout fires). TinyMqtt
// already solves exactly this "local publisher of the local broker" case
// via MqttClient's local-mode constructor (see its own
// examples/client-with-wifi) — connected() is true immediately, no
// handshake needed, publishes are delivered in-process.
class TinyMqttLocalTransport : public SensActCtrl::ITransport {
 public:
  TinyMqttLocalTransport(MqttBroker& broker, const char* clientId)
      : client_(&broker, clientId) {
    client_.setCallback(&TinyMqttLocalTransport::dispatch);
    active_ = this;
  }
  ~TinyMqttLocalTransport() override {
    if (active_ == this) active_ = nullptr;
  }

  bool publish(const char* topic, const char* payload, bool retained) override {
    return client_.publish(topic, payload, retained) == MqttOk;
  }

  bool subscribe(const char* topic, MessageCallback callback,
                 const void* owner = nullptr) override {
    subs_.push_back({topic, std::move(callback), owner});
    return client_.subscribe(topic) == MqttOk;
  }

  bool unsubscribe(const char* topic, const void* owner = nullptr) override {
    bool stillUsed = false;
    const bool found = eraseSubscriptions(subs_, topic, owner, &stillUsed);
    if (found && !stillUsed) client_.unsubscribe(topic);
    return found;
  }

  void tick() override { client_.loop(); }
  bool connected() const override { return const_cast<MqttClient&>(client_).connected(); }

 private:
  // TinyMqtt's MqttClient has one global function-pointer callback (not a
  // per-topic lambda list) — same constraint PubSubClient has, so this
  // mirrors MqttTransport's own dispatch-to-subscriber-list pattern.
  // Only one TinyMqttLocalTransport is expected per node (one embedded
  // broker, one local publisher).
  static void dispatch(const MqttClient*, const Topic& topic, const char* payload,
                       size_t len) {
    if (!active_) return;
    const std::string t(topic.c_str());
    for (auto& sub : active_->subs_) {
      if (sub.topic == t) sub.callback(t.c_str(), payload, len);
    }
  }

  static inline TinyMqttLocalTransport* active_ = nullptr;
  MqttClient client_;
  std::vector<Subscription> subs_;
};

}  // namespace BrewControl

#endif  // BREWCTL_HAS_EMBEDDED_MQTT_BROKER
#endif  // ARDUINO
