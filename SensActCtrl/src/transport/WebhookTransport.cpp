#include "WebhookTransport.h"

#if defined(ARDUINO)

#include <Arduino.h>
#include <HTTPClient.h>
#include <WebServer.h>
#include <WiFi.h>

namespace SensActCtrl {

namespace {

// Strip a leading '/' from a URL path so the remainder can be used as a topic.
const char* stripLeadingSlash(const char* s) {
  return (s && s[0] == '/') ? s + 1 : s;
}

}  // namespace

WebhookTransport::WebhookTransport(uint16_t listenPort, const char* peerBaseUrl)
    : listenPort_(listenPort),
      peerBaseUrl_(peerBaseUrl ? peerBaseUrl : "") {
  server_ = new WebServer(listenPort_);
}

WebhookTransport::~WebhookTransport() {
  if (server_) {
    if (serverStarted_) server_->stop();
    delete server_;
  }
}

bool WebhookTransport::ensureServerStarted_() {
  if (serverStarted_) return true;
  if (!WiFi.isConnected()) return false;

  server_->onNotFound([this]() {
    const String uri = server_->uri();
    const char* topic = stripLeadingSlash(uri.c_str());
    const HTTPMethod method = server_->method();

    if (method == HTTP_POST) {
      const String& body = server_->arg("plain");
      handleIncomingPost(topic, body.c_str(), body.length());
      server_->send(200, "text/plain", "ok");
      return;
    }
    if (method == HTTP_GET) {
      std::string out;
      if (retainedFor(topic, out)) {
        server_->send(200, "application/json", out.c_str());
      } else {
        server_->send(404, "text/plain", "no retained");
      }
      return;
    }
    server_->send(405, "text/plain", "method not allowed");
  });

  server_->begin();
  serverStarted_ = true;
  return true;
}

bool WebhookTransport::publish(const char* topic, const char* payload, bool retained) {
  if (retained) retained_[topic] = payload ? payload : "";
  if (peerBaseUrl_.empty() || !WiFi.isConnected()) return false;

  String url = peerBaseUrl_.c_str();
  if (!url.endsWith("/")) url += "/";
  url += topic;

  HTTPClient http;
  if (!http.begin(url)) return false;
  http.addHeader("Content-Type", "application/json");
  if (retained) http.addHeader("X-Retained", "1");
  const int code = http.POST(String(payload ? payload : ""));
  http.end();
  return code >= 200 && code < 300;
}

bool WebhookTransport::subscribe(const char* topic, MessageCallback callback) {
  subs_.emplace_back(std::string(topic), std::move(callback));
  if (!peerBaseUrl_.empty()) {
    pendingRetainedPulls_.emplace_back(topic);
  }
  return true;
}

void WebhookTransport::pullRetained_(const std::string& topic) {
  if (peerBaseUrl_.empty() || !WiFi.isConnected()) return;

  String url = peerBaseUrl_.c_str();
  if (!url.endsWith("/")) url += "/";
  url += topic.c_str();

  HTTPClient http;
  if (!http.begin(url)) return;
  const int code = http.GET();
  if (code >= 200 && code < 300) {
    const String body = http.getString();
    handleIncomingPost(topic.c_str(), body.c_str(), body.length());
  }
  http.end();
}

void WebhookTransport::tick() {
  if (!ensureServerStarted_()) return;
  server_->handleClient();

  if (!pendingRetainedPulls_.empty() && WiFi.isConnected()) {
    std::string t = std::move(pendingRetainedPulls_.front());
    pendingRetainedPulls_.erase(pendingRetainedPulls_.begin());
    pullRetained_(t);
  }
}

bool WebhookTransport::connected() const {
  return WiFi.isConnected();
}

void WebhookTransport::handleIncomingPost(const char* topic, const char* payload,
                                          size_t length) {
  std::string buf(payload ? payload : "", length);
  for (auto& sub : subs_) {
    if (sub.first == topic) {
      sub.second(topic, buf.c_str(), buf.size());
    }
  }
}

bool WebhookTransport::retainedFor(const char* topic, std::string& out) const {
  auto it = retained_.find(topic);
  if (it == retained_.end()) return false;
  out = it->second;
  return true;
}

}  // namespace SensActCtrl

#else  // !ARDUINO — native stub.

namespace SensActCtrl {

WebhookTransport::WebhookTransport(uint16_t listenPort, const char* peerBaseUrl)
    : listenPort_(listenPort),
      peerBaseUrl_(peerBaseUrl ? peerBaseUrl : "") {}
WebhookTransport::~WebhookTransport() = default;
bool WebhookTransport::publish(const char*, const char*, bool) { return false; }
bool WebhookTransport::subscribe(const char*, MessageCallback) { return false; }
void WebhookTransport::tick() {}
bool WebhookTransport::connected() const { return false; }
void WebhookTransport::handleIncomingPost(const char*, const char*, size_t) {}
bool WebhookTransport::retainedFor(const char*, std::string&) const { return false; }
bool WebhookTransport::ensureServerStarted_() { return false; }
void WebhookTransport::pullRetained_(const std::string&) {}

}  // namespace SensActCtrl

#endif
