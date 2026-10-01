#include "MqttTransport.h"

#if defined(ARDUINO)

#include <Arduino.h>
#include <PubSubClient.h>
#include <freertos/FreeRTOS.h>
#include <freertos/task.h>

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
  // A running connect task owns client_ until it reports back.
  while (phase_.load() == kConnecting) delay(10);
  delete client_;
}

// client_ is ours (no connect task running) and the link is up. Caller task only.
bool MqttTransport::usable_() const {
  return client_ && phase_.load() == kIdle && client_->connected();
}

bool MqttTransport::publish(const char* topic, const char* payload, bool retained) {
  if (!usable_()) return false;
  return client_->publish(topic, payload, retained);
}

bool MqttTransport::subscribe(const char* topic, MessageCallback callback) {
  subs_.emplace_back(std::string(topic), std::move(callback));
  if (usable_()) {
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
  if (usable_()) {
    client_->unsubscribe(topic);
  }
  return found;
}

bool MqttTransport::connected() const {
  return linkUp_.load();
}

const char* MqttTransport::lastErrorMessage() const {
  if (linkUp_.load() || !client_) return "";
  // PubSubClient::state() codes, see PubSubClient.h.
  switch (state_.load()) {
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

void MqttTransport::connectTask_(void* arg) {
  auto* self = static_cast<MqttTransport*>(arg);
  self->connectOk_ =
      self->username_.empty()
          ? self->client_->connect(self->connectId_.c_str())
          : self->client_->connect(self->connectId_.c_str(), self->username_.c_str(),
                                   self->password_.c_str());
  self->phase_.store(kDone);
  vTaskDelete(nullptr);
}

void MqttTransport::startConnect_() {
  connectId_ = clientId_.empty() ? std::string(String(millis()).c_str()) : clientId_;
  phase_.store(kConnecting);
  // 8 KB covers a TLS handshake (WiFiClientSecure); freed when the task ends.
  if (xTaskCreate(connectTask_, "mqttConnect", 8192, this, 1, nullptr) != pdPASS) {
    connectOk_ = false;
    phase_.store(kDone);
  }
}

void MqttTransport::finishConnect_() {
  if (connectOk_) {
    for (auto& sub : subs_) {
      client_->subscribe(sub.first.c_str());
    }
    reconnectBackoffMs_ = 1000;
  } else {
    reconnectBackoffMs_ = (reconnectBackoffMs_ * 2 > 30000)
                            ? 30000
                            : reconnectBackoffMs_ * 2;
  }
  // Backoff counts from the end of the attempt, which can take seconds.
  lastConnectAttemptMs_ = millis();
  phase_.store(kIdle);
}

void MqttTransport::tick() {
  if (!client_ || phase_.load() == kConnecting) return;
  if (phase_.load() == kDone) finishConnect_();
  if (client_->connected()) client_->loop();
  linkUp_.store(client_->connected());
  state_.store(client_->state());
  if (!linkUp_.load() && millis() - lastConnectAttemptMs_ >= reconnectBackoffMs_) {
    startConnect_();
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

}  // namespace SensActCtrl

#endif
