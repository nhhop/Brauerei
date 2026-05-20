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
  WiFi.mode(WIFI_STA);
  WiFi.disconnect(false, true);
  esp_wifi_set_channel(channel_, WIFI_SECOND_CHAN_NONE);

  if (esp_now_init() != ESP_OK) return false;
  esp_now_register_recv_cb(onRecv);

  esp_now_peer_info_t peer = {};
  std::memcpy(peer.peer_addr, kBroadcastMac, 6);
  peer.channel = channel_;
  peer.encrypt = false;
  if (esp_now_add_peer(&peer) != ESP_OK) {
    esp_now_deinit();
    return false;
  }
  return true;
}

bool EspNowTransport::sendRaw_(const uint8_t* data, size_t len) {
  if (!initialized_ || len > kMaxPacket) return false;
  return esp_now_send(kBroadcastMac, data, len) == ESP_OK;
}

bool EspNowTransport::sendDataPacket_(const char* topic, const char* payload) {
  const size_t tlen = std::strlen(topic);
  const size_t plen = std::strlen(payload);
  if (tlen == 0 || tlen > 255) return false;
  if (2 + tlen + plen > kMaxPacket) return false;

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
  const uint32_t now = millis();
  if (initialized_ && (now - lastRetainedRequestMs_ > 1000 || lastRetainedRequestMs_ == 0)) {
    lastRetainedRequestMs_ = now;
    sendRetainedRequest_();
  }
  return true;
}

void EspNowTransport::tick() {
  // Connection-less; nothing to drive periodically.
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

}  // namespace SensActCtrl

#else  // !ARDUINO — native stub.

namespace SensActCtrl {

EspNowTransport::EspNowTransport(uint8_t channel) : channel_(channel) {}
EspNowTransport::~EspNowTransport() = default;
bool EspNowTransport::publish(const char*, const char*, bool) { return false; }
bool EspNowTransport::subscribe(const char*, MessageCallback) { return false; }
void EspNowTransport::tick() {}
void EspNowTransport::dispatchIncoming(const uint8_t*, int) {}
bool EspNowTransport::initEspNow_() { return false; }
bool EspNowTransport::sendRaw_(const uint8_t*, size_t) { return false; }
bool EspNowTransport::sendDataPacket_(const char*, const char*) { return false; }
void EspNowTransport::sendRetainedRequest_() {}
void EspNowTransport::handleRetainedRequest_() {}

}  // namespace SensActCtrl

#endif
