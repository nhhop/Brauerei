#include "MqttTransport.h"

#if defined(ARDUINO)

#include <Arduino.h>
#include <PubSubClient.h>

namespace SensActCtrl {

namespace {

MqttTransport* g_active = nullptr;

void staticDispatch(char* topic, uint8_t* payload, unsigned int length) {
  if (g_active) g_active->dispatchIncoming(topic, payload, length);
}

}  // namespace

MqttTransport::MqttTransport(Client& netClient, const char* host, uint16_t port,
                             const char* clientId)
    : host_(host), port_(port), clientId_(clientId ? clientId : "") {
  client_ = new PubSubClient(netClient);
  client_->setServer(host_.c_str(), port_);
  client_->setCallback(staticDispatch);
  g_active = this;
}

MqttTransport::~MqttTransport() {
  if (g_active == this) g_active = nullptr;
  delete client_;
}

bool MqttTransport::publish(const char* topic, const char* payload, bool retained) {
  if (!client_ || !client_->connected()) return false;
  return client_->publish(topic, payload, retained);
}

bool MqttTransport::subscribe(const char* topic, MessageCallback callback) {
  subs_.emplace_back(std::string(topic), std::move(callback));
  if (client_ && client_->connected()) {
    client_->subscribe(topic);
  }
  return true;
}

bool MqttTransport::connected() const {
  return client_ && client_->connected();
}

bool MqttTransport::attemptConnect_() {
  bool ok = clientId_.empty()
              ? client_->connect(String(millis()).c_str())
              : client_->connect(clientId_.c_str());
  if (!ok) return false;
  for (auto& sub : subs_) {
    client_->subscribe(sub.first.c_str());
  }
  return true;
}

void MqttTransport::tick() {
  if (!client_) return;
  if (client_->connected()) {
    client_->loop();
    return;
  }
  const uint32_t now = millis();
  if (now - lastConnectAttemptMs_ < reconnectBackoffMs_) return;
  lastConnectAttemptMs_ = now;
  if (attemptConnect_()) {
    reconnectBackoffMs_ = 1000;
  } else {
    reconnectBackoffMs_ = (reconnectBackoffMs_ * 2 > 30000)
                            ? 30000
                            : reconnectBackoffMs_ * 2;
  }
}

void MqttTransport::dispatchIncoming(const char* topic, const uint8_t* payload,
                                     uint32_t length) {
  std::string buf(reinterpret_cast<const char*>(payload), length);
  for (auto& sub : subs_) {
    if (sub.first == topic) {
      sub.second(topic, buf.c_str(), buf.size());
    }
  }
}

}  // namespace SensActCtrl

#else  // !ARDUINO — native stub: link-safe but never used in tests.

namespace SensActCtrl {

MqttTransport::MqttTransport(Client&, const char*, uint16_t port, const char* clientId)
    : port_(port), clientId_(clientId ? clientId : "") {}
MqttTransport::~MqttTransport() = default;
bool MqttTransport::publish(const char*, const char*, bool) { return false; }
bool MqttTransport::subscribe(const char*, MessageCallback) { return false; }
void MqttTransport::tick() {}
bool MqttTransport::connected() const { return false; }
void MqttTransport::dispatchIncoming(const char*, const uint8_t*, uint32_t) {}
bool MqttTransport::attemptConnect_() { return false; }

}  // namespace SensActCtrl

#endif
