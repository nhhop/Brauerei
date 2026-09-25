#pragma once

#include <stddef.h>
#include <stdint.h>
#include <map>
#include <string>
#include <utility>
#include <vector>

#include "transport/ITransport.h"

// Forward decls — keep the WebSockets library headers out of consumer
// headers (they would otherwise meet e.g. ESPAsyncWebServer's
// AsyncWebSocket.h in the same translation unit).
class WebSocketsServer;
class WebSocketsClient;

namespace SensActCtrl {

// WebSocket transport (links2004/WebSockets). One persistent, bidirectional
// connection per peer, no broker. Same wire payloads as the other transports
// (topic strings + JSON payloads); framing lives in WebSocketProtocol.h.
//
// Roles only decide who connects, not who may publish or subscribe. The
// intended topology is a hub: publishing nodes (RemotePublisher) are clients
// that dial out to the consuming node (RemoteSensor / RemoteActuator), which
// runs the server. State/meta flow towards the hub, /set and /tune commands
// flow back over the same connection.
//
// publish(): a client sends to its server; a server sends to *all* connected
// clients (each filters by topic) — except /set and /tune commands: the server
// learns from incoming frames which client delivers which <device> and sends
// such a command to that client only. Device not learned yet (or its client
// disconnected) → broadcast. A server never relays one client's messages to
// another — it is not a broker.
//
// Retain emulation (same idea as EspNowTransport): retained payloads are
// cached locally. A side that has subscriptions sends a Retained-Request on
// every new connection and after subscribe() (coalesced to one per tick());
// the other side answers with its whole retained cache, to the requester
// only. Late subscribers thus get current meta + state immediately.
//
// connected(): client — WebSocket handshake established (heartbeat pings
// detect a server that vanished without closing the socket). Server — WiFi
// up and listening; clientCount() tells how many clients are attached.
// Nothing happens while WiFi is down; the caller manages WiFi.
//
// Blocking: while the server is unreachable, a client's TCP connect blocks
// tick() for up to WEBSOCKETS_TCP_TIMEOUT (library default 5000 ms — set
// e.g. -DWEBSOCKETS_TCP_TIMEOUT=1000 in build_flags), at most once per
// kReconnectIntervalMs. A server accepts at most WEBSOCKETS_SERVER_CLIENT_MAX
// clients (library default 5).
class WebSocketTransport : public ITransport {
 public:
  // Server: accept client connections on listenPort.
  explicit WebSocketTransport(uint16_t listenPort);
  // Client: connect to serverUrl, "ws://host[:port][/path]". An unparsable
  // URL leaves the transport permanently disconnected (see lastErrorMessage()).
  explicit WebSocketTransport(const char* serverUrl);
  ~WebSocketTransport() override;

  bool publish(const char* topic, const char* payload, bool retained) override;
  bool subscribe(const char* topic, MessageCallback callback) override;
  bool unsubscribe(const char* topic) override;
  void tick() override;
  bool connected() const override;
  // Client only; empty while connected. A server has nothing to report.
  const char* lastErrorMessage() const override;

  // Server: number of connected clients. Client: 1 while connected, else 0.
  size_t clientCount();

  // Called from the library's event callbacks. Public so the lambdas can
  // reach them without dragging WStype_t into this header; not part of the
  // user-facing API. `peer` is the server-side client number (0 for a client).
  void onPeerConnected(uint8_t peer);
  void onPeerDisconnected();
  void onText(uint8_t peer, const char* data, size_t length);

  // Reconnect attempt spacing for a client while the server is unreachable.
  static constexpr uint32_t kReconnectIntervalMs = 5000;
  // Heartbeat (both roles): ping every kPingIntervalMs, drop the connection
  // after kMissedPongs pings without a pong within kPongTimeoutMs.
  static constexpr uint32_t kPingIntervalMs = 5000;
  static constexpr uint32_t kPongTimeoutMs = 3000;
  static constexpr uint8_t kMissedPongs = 2;

 private:
  // Sends a text frame to one server-side client, or (kAllPeers) to every
  // client resp. the server.
  bool send_(int peer, const char* data, size_t length);
  bool send_(int peer, const std::string& wire) { return send_(peer, wire.data(), wire.size()); }
  static constexpr int kAllPeers = -1;
  // Server: drops the learned device→peer entries of a client slot.
  void forgetPeer_(uint8_t peer);

  WebSocketsServer* server_ = nullptr;
  WebSocketsClient* client_ = nullptr;
  bool serverStarted_ = false;
  bool clientConnected_ = false;
  bool retainedRequestPending_ = false;
  std::vector<std::pair<std::string, MessageCallback>> subs_;
  std::map<std::string, std::string> retained_;
  // Server: which client slot last delivered a frame for a <device>.
  std::map<std::string, uint8_t> devicePeer_;
  // Always points at a string literal: it's read from other tasks (e.g. a
  // web handler reporting status) while tick() may switch it, and a pointer
  // swap can't leave a reader with a freed buffer the way std::string can.
  const char* lastError_ = "";
};

}  // namespace SensActCtrl
