#include "EspNowTransport.h"

#if defined(ARDUINO)

#include <Arduino.h>
#include <WiFi.h>
#include <esp_now.h>
#include <esp_wifi.h>

#include <cstdio>
#include <cstring>

namespace SensActCtrl {

namespace {

constexpr uint8_t kPacketData = 0x01;
constexpr uint8_t kPacketRetainedRequest = 0x02;
constexpr size_t kMaxPacket = 250;

EspNowTransport* g_active = nullptr;
const uint8_t kBroadcastMac[6] = {0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF};

void onRecv(const uint8_t* mac, const uint8_t* data, int len) {
  if (g_active) g_active->dispatchIncoming(mac, data, len);
}

void onSent(const uint8_t* mac, esp_now_send_status_t status) {
  if (g_active && mac) g_active->onSendStatus(mac, status == ESP_NOW_SEND_SUCCESS);
}

bool isBroadcast(const uint8_t* mac) {
  return std::memcmp(mac, kBroadcastMac, 6) == 0;
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
  esp_now_register_send_cb(onSent);

  peerChannel_ = staConnected ? 0 : channel_;
  esp_now_peer_info_t peer = {};
  std::memcpy(peer.peer_addr, kBroadcastMac, 6);
  peer.channel = peerChannel_;
  peer.encrypt = false;
  if (esp_now_add_peer(&peer) != ESP_OK) {
    esp_now_deinit();
    lastErrorMsg_ = "ESP-NOW-Broadcast-Peer konnte nicht hinzugefügt werden";
    return false;
  }
  lastErrorMsg_.clear();
  return true;
}

bool EspNowTransport::sendRaw_(const uint8_t* data, size_t len, const uint8_t* dest) {
  if (!initialized_ || len > kMaxPacket) return false;
  const bool ok = esp_now_send(dest, data, len) == ESP_OK;
  if (ok) {
    lastErrorMsg_.clear();
  } else {
    lastErrorMsg_ = "esp_now_send() fehlgeschlagen";
  }
  return ok;
}

bool EspNowTransport::sendDataPacket_(const char* topic, const char* payload,
                                      const uint8_t* dest) {
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
  return sendRaw_(buf, 2 + tlen + plen, dest);
}

bool EspNowTransport::ensurePeer_(const EspNowPeerTable::Mac& mac) {
  EspNowPeerTable::PeerUse use;
  {
    std::lock_guard<std::mutex> lock(peersMutex_);
    use = peers_.usePeer(mac);
  }
  if (use.evict) esp_now_del_peer(use.evicted.data());
  if (!use.isNew || esp_now_is_peer_exist(mac.data())) return true;

  esp_now_peer_info_t peer = {};
  std::memcpy(peer.peer_addr, mac.data(), 6);
  peer.channel = peerChannel_;
  peer.encrypt = false;
  if (esp_now_add_peer(&peer) == ESP_OK) return true;
  std::lock_guard<std::mutex> lock(peersMutex_);
  peers_.forgetPeer(mac);
  return false;
}

void EspNowTransport::sendRetainedRequest_() {
  uint8_t buf[1] = {kPacketRetainedRequest};
  sendRaw_(buf, 1, kBroadcastMac);
}

void EspNowTransport::handleRetainedRequest_() {
  for (const auto& kv : retained_) {
    sendDataPacket_(kv.first.c_str(), kv.second.c_str(), kBroadcastMac);
  }
}

bool EspNowTransport::publish(const char* topic, const char* payload, bool retained) {
  if (retained) {
    retained_[topic] = payload;
    return sendDataPacket_(topic, payload, kBroadcastMac);
  }
  EspNowPeerTable::Mac mac;
  bool known;
  {
    std::lock_guard<std::mutex> lock(peersMutex_);
    known = peers_.macForPublish(topic, mac);
  }
  if (known && initialized_ && ensurePeer_(mac)) {
    return sendDataPacket_(topic, payload, mac.data());
  }
  return sendDataPacket_(topic, payload, kBroadcastMac);
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

void EspNowTransport::onSendStatus(const uint8_t* mac, bool delivered) {
  if (isBroadcast(mac)) return;  // broadcasts are never ACKed — no signal
  std::lock_guard<std::mutex> lock(deliveryMutex_);
  if (delivered) {
    deliveryErrorMsg_.clear();
    return;
  }
  char msg[64];
  std::snprintf(msg, sizeof(msg),
                "Zustellung an %02X:%02X:%02X:%02X:%02X:%02X fehlgeschlagen",
                mac[0], mac[1], mac[2], mac[3], mac[4], mac[5]);
  deliveryErrorMsg_ = msg;
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

void EspNowTransport::dispatchIncoming(const uint8_t* mac, const uint8_t* data,
                                       int length) {
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
      bool learned = false;
      for (auto& sub : subs_) {
        if (sub.first == topic) {
          // Only subscribed topics are learned — bounds the table to what
          // this node actually consumes.
          if (!learned && mac) {
            std::lock_guard<std::mutex> lock(peersMutex_);
            peers_.learn(topic, mac);
            learned = true;
          }
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
  if (!lastErrorMsg_.empty()) return lastErrorMsg_.c_str();
  std::lock_guard<std::mutex> lock(deliveryMutex_);
  return deliveryErrorMsg_.c_str();
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
void EspNowTransport::dispatchIncoming(const uint8_t*, const uint8_t*, int) {}
void EspNowTransport::onSendStatus(const uint8_t*, bool) {}
bool EspNowTransport::initEspNow_() { return false; }
bool EspNowTransport::sendRaw_(const uint8_t*, size_t, const uint8_t*) { return false; }
bool EspNowTransport::sendDataPacket_(const char*, const char*, const uint8_t*) { return false; }
bool EspNowTransport::ensurePeer_(const EspNowPeerTable::Mac&) { return false; }
void EspNowTransport::sendRetainedRequest_() {}
void EspNowTransport::handleRetainedRequest_() {}
void EspNowTransport::requestRetained_() {}

}  // namespace SensActCtrl

#endif
