#include "EspNowTransport.h"

#if defined(ARDUINO)

#include <Arduino.h>
#include <WiFi.h>
#include <esp_now.h>
#include <esp_wifi.h>

#include <cstring>

namespace SensActCtrl {

namespace {

constexpr uint8_t kPacketData = 0x01;
constexpr uint8_t kPacketRetainedRequest = 0x02;
constexpr size_t kMaxPacket = 250;

EspNowTransport* g_active = nullptr;
const uint8_t kBroadcastMac[6] = {0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF};

void onRecv(const uint8_t* /*mac*/, const uint8_t* data, int len) {
  if (g_active) g_active->dispatchIncoming(data, len);
}

}  // namespace

EspNowTransport::EspNowTransport(uint8_t channel) : channel_(channel) {
  g_active = this;
  initialized_ = initEspNow_();
}

EspNowTransport::~EspNowTransport() {
  if (g_active == this) g_active = nullptr;
  if (initialized_) {
    esp_now_unregister_recv_cb();
    esp_now_deinit();
  }
}

bool EspNowTransport::initEspNow_() {
  // If a station link is already up (e.g. a host app using its own WiFi),
  // leave it alone and ride its channel — forcing WIFI_STA + a channel here
  // would tear down that connection. ESP-Now can coexist with an active STA
  // link as long as the peer uses the channel already in use (peer.channel
  // = 0 means "use current channel" per the ESP-IDF docs). Only when no STA
  // link exists do we own WiFi mode/channel outright, matching every
  // standalone example sketch that never touches WiFi.mode() itself.
  const bool staConnected = WiFi.isConnected();
  if (!staConnected) {
    WiFi.mode(WIFI_STA);
    WiFi.disconnect(false, true);
    esp_wifi_set_channel(channel_, WIFI_SECOND_CHAN_NONE);
  }

  if (esp_now_init() != ESP_OK) {
    lastErrorMsg_ = "esp_now_init() fehlgeschlagen";
    return false;
  }
  esp_now_register_recv_cb(onRecv);

  esp_now_peer_info_t peer = {};
  std::memcpy(peer.peer_addr, kBroadcastMac, 6);
  peer.channel = staConnected ? 0 : channel_;
  peer.encrypt = false;
  if (esp_now_add_peer(&peer) != ESP_OK) {
    esp_now_deinit();
    lastErrorMsg_ = "ESP-NOW-Broadcast-Peer konnte nicht hinzugefügt werden";
    return false;
  }
  lastErrorMsg_.clear();
  return true;
}

bool EspNowTransport::sendRaw_(const uint8_t* data, size_t len) {
  if (!initialized_ || len > kMaxPacket) return false;
  const bool ok = esp_now_send(kBroadcastMac, data, len) == ESP_OK;
  if (ok) {
    lastErrorMsg_.clear();
  } else {
    lastErrorMsg_ = "esp_now_send() fehlgeschlagen";
  }
  return ok;
}

bool EspNowTransport::sendDataPacket_(const char* topic, const char* payload) {
  const size_t tlen = std::strlen(topic);
  const size_t plen = std::strlen(payload);
  if (tlen == 0 || tlen > 255) {
    lastErrorMsg_ = "Ungültiges Topic";
    return false;
  }
  if (2 + tlen + plen > kMaxPacket) {
    lastErrorMsg_ = "Paket zu groß (" + std::to_string(2 + tlen + plen) +
                     " Byte, max " + std::to_string(kMaxPacket) + ") — verworfen";
    return false;
  }

  uint8_t buf[kMaxPacket];
  buf[0] = kPacketData;
  buf[1] = static_cast<uint8_t>(tlen);
  std::memcpy(buf + 2, topic, tlen);
  std::memcpy(buf + 2 + tlen, payload, plen);
  return sendRaw_(buf, 2 + tlen + plen);
}

void EspNowTransport::sendRetainedRequest_() {
  uint8_t buf[1] = {kPacketRetainedRequest};
  sendRaw_(buf, 1);
}

void EspNowTransport::handleRetainedRequest_() {
  for (const auto& kv : retained_) {
    sendDataPacket_(kv.first.c_str(), kv.second.c_str());
  }
}

bool EspNowTransport::publish(const char* topic, const char* payload, bool retained) {
  if (retained) retained_[topic] = payload;
  return sendDataPacket_(topic, payload);
}

bool EspNowTransport::subscribe(const char* topic, MessageCallback callback) {
  subs_.emplace_back(std::string(topic), std::move(callback));
  requestRetained_();
  return true;
}

void EspNowTransport::requestRetained_() {
  if (!initialized_) return;
  const uint32_t now = millis();
  if (lastRetainedRequestMs_ == 0 || (now - lastRetainedRequestMs_) >= kRetainedRequestThrottleMs) {
    lastRetainedRequestMs_ = now;
    retainedRequestPending_ = false;
    sendRetainedRequest_();
  } else {
    retainedRequestPending_ = true;
  }
}

void EspNowTransport::tick() {
  // A subscribe() inside the throttle window above defers here instead of
  // being dropped — catch up once the window has elapsed.
  if (retainedRequestPending_ && initialized_ &&
      (millis() - lastRetainedRequestMs_) >= kRetainedRequestThrottleMs) {
    lastRetainedRequestMs_ = millis();
    retainedRequestPending_ = false;
    sendRetainedRequest_();
  }
}

void EspNowTransport::dispatchIncoming(const uint8_t* data, int length) {
  if (length < 1) return;
  switch (data[0]) {
    case kPacketRetainedRequest:
      handleRetainedRequest_();
      return;
    case kPacketData: {
      if (length < 2) return;
      const uint8_t tlen = data[1];
      if (length < 2 + tlen) return;
      std::string topic(reinterpret_cast<const char*>(data + 2), tlen);
      std::string payload(reinterpret_cast<const char*>(data + 2 + tlen),
                          length - 2 - tlen);
      for (auto& sub : subs_) {
        if (sub.first == topic) {
          sub.second(topic.c_str(), payload.c_str(), payload.size());
        }
      }
      return;
    }
    default:
      return;
  }
}

const char* EspNowTransport::lastErrorMessage() const {
  return lastErrorMsg_.c_str();
}

}  // namespace SensActCtrl

#else  // !ARDUINO — native stub.

namespace SensActCtrl {

EspNowTransport::EspNowTransport(uint8_t channel) : channel_(channel) {}
EspNowTransport::~EspNowTransport() = default;
bool EspNowTransport::publish(const char*, const char*, bool) { return false; }
bool EspNowTransport::subscribe(const char*, MessageCallback) { return false; }
void EspNowTransport::tick() {}
const char* EspNowTransport::lastErrorMessage() const { return ""; }
void EspNowTransport::dispatchIncoming(const uint8_t*, int) {}
bool EspNowTransport::initEspNow_() { return false; }
bool EspNowTransport::sendRaw_(const uint8_t*, size_t) { return false; }
bool EspNowTransport::sendDataPacket_(const char*, const char*) { return false; }
void EspNowTransport::sendRetainedRequest_() {}
void EspNowTransport::handleRetainedRequest_() {}
void EspNowTransport::requestRetained_() {}

}  // namespace SensActCtrl

#endif
