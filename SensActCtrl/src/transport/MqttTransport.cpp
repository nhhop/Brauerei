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
                             const char* clientId, const char* username,
                             const char* password)
    : host_(host), port_(port), clientId_(clientId ? clientId : ""),
      username_(username ? username : ""), password_(password ? password : "") {
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

bool MqttTransport::unsubscribe(const char* topic) {
  bool found = false;
  for (auto it = subs_.begin(); it != subs_.end();) {
    if (it->first == topic) {
      it = subs_.erase(it);
      found = true;
    } else {
      ++it;
    }
  }
  if (client_ && client_->connected()) {
    client_->unsubscribe(topic);
  }
  return found;
}

bool MqttTransport::connected() const {
  return client_ && client_->connected();
}

const char* MqttTransport::lastErrorMessage() const {
  if (connected() || !client_) return "";
  // PubSubClient::state() codes, see PubSubClient.h.
  switch (client_->state()) {
    case -4: return "Zeitüberschreitung beim Verbindungsaufbau";
    case -3: return "Verbindung verloren";
    case -2: return "Verbindung fehlgeschlagen (Host/Port prüfen)";
    case -1: return "Getrennt";
    case 1:  return "Falsches MQTT-Protokoll";
    case 2:  return "Ungültige Client-ID";
    case 3:  return "Broker nicht verfügbar";
    case 4:  return "Ungültige Zugangsdaten";
    case 5:  return "Nicht autorisiert";
    default: return "Unbekannter Fehler";
  }
}

bool MqttTransport::attemptConnect_() {
  const std::string id = clientId_.empty() ? std::string(String(millis()).c_str())
                                            : clientId_;
  bool ok = username_.empty()
              ? client_->connect(id.c_str())
              : client_->connect(id.c_str(), username_.c_str(), password_.c_str());
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

MqttTransport::MqttTransport(Client&, const char*, uint16_t port, const char* clientId,
                             const char* username, const char* password)
    : port_(port), clientId_(clientId ? clientId : ""),
      username_(username ? username : ""), password_(password ? password : "") {}
MqttTransport::~MqttTransport() = default;
bool MqttTransport::publish(const char*, const char*, bool) { return false; }
bool MqttTransport::subscribe(const char*, MessageCallback) { return false; }
bool MqttTransport::unsubscribe(const char*) { return false; }
void MqttTransport::tick() {}
bool MqttTransport::connected() const { return false; }
const char* MqttTransport::lastErrorMessage() const { return ""; }
void MqttTransport::dispatchIncoming(const char*, const uint8_t*, uint32_t) {}
bool MqttTransport::attemptConnect_() { return false; }

}  // namespace SensActCtrl

#endif
