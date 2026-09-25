#include "WebSocketTransport.h"

#if defined(ARDUINO)

#include <Arduino.h>
#include <WebSocketsClient.h>
#include <WebSocketsServer.h>
#include <WiFi.h>

#include <iterator>

#include "WebSocketProtocol.h"

namespace SensActCtrl {

namespace {

const char kRetainedRequest[] = {websocket::kFrameRetainedRequest};
const char kNotConnected[] = "Keine Verbindung zum Server";

}  // namespace

WebSocketTransport::WebSocketTransport(uint16_t listenPort) {
  server_ = new WebSocketsServer(listenPort);
  server_->onEvent([this](uint8_t num, WStype_t type, uint8_t* payload, size_t length) {
    switch (type) {
      case WStype_CONNECTED: forgetPeer_(num); onPeerConnected(num); break;
      case WStype_DISCONNECTED: forgetPeer_(num); break;
      case WStype_TEXT: onText(num, reinterpret_cast<const char*>(payload), length); break;
      default: break;
    }
  });
  server_->enableHeartbeat(kPingIntervalMs, kPongTimeoutMs, kMissedPongs);
}

WebSocketTransport::WebSocketTransport(const char* serverUrl) {
  websocket::Url url;
  if (!websocket::parseUrl(serverUrl, url)) {
    lastError_ = "Ungültige Server-URL (erwartet ws://host[:port][/pfad])";
    return;
  }
  lastError_ = kNotConnected;
  client_ = new WebSocketsClient();
  client_->onEvent([this](WStype_t type, uint8_t* payload, size_t length) {
    switch (type) {
      case WStype_CONNECTED: onPeerConnected(0); break;
      case WStype_DISCONNECTED: onPeerDisconnected(); break;
      case WStype_TEXT: onText(0, reinterpret_cast<const char*>(payload), length); break;
      default: break;
    }
  });
  // begin() only stores the target; the connect itself happens inside loop().
  client_->begin(url.host.c_str(), url.port, url.path.c_str());
  client_->setReconnectInterval(kReconnectIntervalMs);
  client_->enableHeartbeat(kPingIntervalMs, kPongTimeoutMs, kMissedPongs);
}

WebSocketTransport::~WebSocketTransport() {
  if (server_) {
    if (serverStarted_) server_->close();
    delete server_;
  }
  if (client_) {
    client_->disconnect();
    delete client_;
  }
}

bool WebSocketTransport::publish(const char* topic, const char* payload, bool retained) {
  const std::string wire = websocket::encodeData(topic, payload);
  if (wire.empty()) return false;
  if (retained) retained_[topic] = payload ? payload : "";
  if (!connected()) return false;
  // Hub: a command goes only to the peer that delivered that device's frames.
  // Device not learned yet (or peer gone) → broadcast, as before.
  int to = kAllPeers;
  if (server_ && websocket::isCommandTopic(topic)) {
    const auto it = devicePeer_.find(websocket::deviceOfTopic(topic));
    if (it != devicePeer_.end()) to = it->second;
  }
  return send_(to, wire);
}

bool WebSocketTransport::subscribe(const char* topic, MessageCallback callback) {
  subs_.emplace_back(std::string(topic), std::move(callback));
  retainedRequestPending_ = true;
  return true;
}

bool WebSocketTransport::unsubscribe(const char* topic) {
  bool found = false;
  for (auto it = subs_.begin(); it != subs_.end();) {
    if (it->first == topic) {
      it = subs_.erase(it);
      found = true;
    } else {
      ++it;
    }
  }
  return found;
}

void WebSocketTransport::tick() {
  if (!WiFi.isConnected()) return;
  if (server_) {
    if (!serverStarted_) {
      server_->begin();
      serverStarted_ = true;
    }
    server_->loop();
  } else if (client_) {
    client_->loop();
  } else {
    return;  // client with an invalid URL
  }

  // Coalesces a burst of subscribe() calls (e.g. at boot) into one request.
  // Not connected yet: nothing lost — onPeerConnected() asks anyway.
  if (retainedRequestPending_) {
    retainedRequestPending_ = false;
    if (connected()) send_(kAllPeers, kRetainedRequest, sizeof(kRetainedRequest));
  }
}

bool WebSocketTransport::connected() const {
  if (!WiFi.isConnected()) return false;
  return server_ ? serverStarted_ : clientConnected_;
}

const char* WebSocketTransport::lastErrorMessage() const {
  return lastError_;
}

size_t WebSocketTransport::clientCount() {
  if (server_) return serverStarted_ ? static_cast<size_t>(server_->connectedClients(false)) : 0;
  return connected() ? 1 : 0;
}

void WebSocketTransport::onPeerConnected(uint8_t peer) {
  if (client_) {
    clientConnected_ = true;
    lastError_ = "";
  }
  if (!subs_.empty()) {
    send_(server_ ? peer : kAllPeers, kRetainedRequest, sizeof(kRetainedRequest));
  }
}

void WebSocketTransport::onPeerDisconnected() {
  clientConnected_ = false;
  lastError_ = kNotConnected;
}

void WebSocketTransport::onText(uint8_t peer, const char* data, size_t length) {
  const websocket::Frame f = websocket::decodeFrame(data, length);
  switch (f.type) {
    case websocket::FrameType::Data:
      if (server_) {
        const std::string device = websocket::deviceOfTopic(f.topic);
        if (!device.empty()) devicePeer_[device] = peer;
      }
      for (auto& sub : subs_) {
        if (sub.first == f.topic) {
          sub.second(f.topic.c_str(), f.payload.c_str(), f.payload.size());
        }
      }
      return;
    case websocket::FrameType::RetainedRequest: {
      const int to = server_ ? peer : kAllPeers;
      for (const auto& kv : retained_) {
        send_(to, websocket::encodeData(kv.first.c_str(), kv.second.c_str()));
      }
      return;
    }
    default:
      return;
  }
}

void WebSocketTransport::forgetPeer_(uint8_t peer) {
  for (auto it = devicePeer_.begin(); it != devicePeer_.end();) {
    it = it->second == peer ? devicePeer_.erase(it) : std::next(it);
  }
}

bool WebSocketTransport::send_(int peer, const char* data, size_t length) {
  if (server_) {
    return peer == kAllPeers ? server_->broadcastTXT(data, length)
                             : server_->sendTXT(static_cast<uint8_t>(peer), data, length);
  }
  return client_ && client_->sendTXT(data, length);
}

}  // namespace SensActCtrl

#else  // !ARDUINO — native stub.

namespace SensActCtrl {

WebSocketTransport::WebSocketTransport(uint16_t) {}
WebSocketTransport::WebSocketTransport(const char*) {}
WebSocketTransport::~WebSocketTransport() = default;
bool WebSocketTransport::publish(const char*, const char*, bool) { return false; }
bool WebSocketTransport::subscribe(const char*, MessageCallback) { return false; }
bool WebSocketTransport::unsubscribe(const char*) { return false; }
void WebSocketTransport::tick() {}
bool WebSocketTransport::connected() const { return false; }
const char* WebSocketTransport::lastErrorMessage() const { return ""; }
size_t WebSocketTransport::clientCount() { return 0; }
void WebSocketTransport::onPeerConnected(uint8_t) {}
void WebSocketTransport::onPeerDisconnected() {}
void WebSocketTransport::onText(uint8_t, const char*, size_t) {}
void WebSocketTransport::forgetPeer_(uint8_t) {}
bool WebSocketTransport::send_(int, const char*, size_t) { return false; }

}  // namespace SensActCtrl

#endif
