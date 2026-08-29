#pragma once

#include <stdint.h>
#include <map>
#include <string>
#include <utility>
#include <vector>

#include "transport/ITransport.h"

// Forward decl — keep WebServer.h out of consumer headers.
class WebServer;

namespace SensActCtrl {

// HTTP-webhook transport. Each node runs a small WebServer and POSTs to a
// peer's base URL. Same wire format as MqttTransport / EspNowTransport
// (topic strings + JSON payloads).
//
// URL mapping: a publish(topic, payload, retained) becomes
//   POST <peerBaseUrl>/<topic>     body = payload
//                                  header X-Retained: 1 (if retained)
// Incoming POSTs are dispatched to subscribers whose topic equals the URL
// path (leading slash stripped).
//
// Retain emulation: retained payloads are cached locally and served on
// GET /<topic>. subscribe() queues a "retained pull" that tick() executes
// once connected() — a blocking GET against the peer; the response body
// is dispatched into the local subscriber as if it arrived via POST. This
// gives late subscribers a quick path to current meta + state, parallel to
// MQTT's broker-side retain.
//
// connected() reflects WiFi association. Publish/GET silently fail when
// disconnected; no internal reconnect loop (caller manages WiFi).
//
// Outbound calls (publish POST, retained-pull GET) use a short HTTPClient
// timeout, and a failure puts the peer in a backoff window during which
// further outbound attempts are skipped without hitting the network at all.
// This bounds how much an unreachable peer can block the caller's loop()
// (was: one full HTTPClient default timeout per item, every tick).
class WebhookTransport : public ITransport {
 public:
  // listenPort: local HTTP server port (e.g. 8080).
  // peerBaseUrl: peer URL without trailing slash, e.g. "http://192.168.1.42:8080".
  //              Can be empty if this node only receives (no outbound publish).
  WebhookTransport(uint16_t listenPort, const char* peerBaseUrl);
  ~WebhookTransport() override;

  bool publish(const char* topic, const char* payload, bool retained) override;
  bool subscribe(const char* topic, MessageCallback callback) override;
  void tick() override;
  bool connected() const override;

  // Called from the WebServer route handlers. Public so the static bridge
  // can reach them; not part of the user-facing API.
  void handleIncomingPost(const char* topic, const char* payload, size_t length);
  bool retainedFor(const char* topic, std::string& out) const;

 private:
  bool ensureServerStarted_();
  void pullRetained_(const std::string& topic);
  bool inBackoff_() const;
  void onOutboundFailure_();
  void onOutboundSuccess_();

  // HTTPClient timeout for outbound POST/GET (ms). Bounds a single blocked
  // call instead of the library default (~5s).
  static constexpr uint32_t kHttpTimeoutMs = 800;
  // After an outbound failure, skip further outbound attempts to this peer
  // for this long — avoids re-blocking on every publish() while it's down.
  static constexpr uint32_t kBackoffMs = 5000;

  uint16_t listenPort_;
  std::string peerBaseUrl_;
  WebServer* server_ = nullptr;
  bool serverStarted_ = false;
  std::vector<std::pair<std::string, MessageCallback>> subs_;
  std::map<std::string, std::string> retained_;
  std::vector<std::string> pendingRetainedPulls_;
  bool hasFailure_ = false;
  unsigned long lastFailureMs_ = 0;
};

}  // namespace SensActCtrl
