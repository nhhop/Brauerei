#pragma once

#ifdef ARDUINO

#include <SensActCtrl.h>
#include <memory>
#include <remote/RemotePublisher.h>
#include <transport/ITransport.h>
#include <transport/WebSocketTransport.h>

#include "DynamicItems.h"
#include "SettingsStore.h"

namespace BrewControl {

// Owns this device's WebSocket transports. Both halves are settings-gated
// and boot-bound like MqttService — a settings change takes effect on the
// next reboot.
//
// Hub: a WebSocketTransport server that leaves connect to. All "Remote"
// sensors/actuators with transport:"websocket" ride this one server
// (DynamicItems gets it via hubTransport()). It runs whether or not such an
// item exists yet, so a leaf can connect before the hub has any items.
//
// Publish: this device as a leaf — a WebSocketTransport client dialing
// settings.websocketHubUrl(), plus a RemotePublisher mirroring the registry
// over it (same attach/hook pattern as WebhookService).
class WebSocketService {
 public:
  // Creates the hub server if settings.websocketHubEnabled(), and the
  // publish client + publisher if settings.websocketPublishEnabled().
  // fallbackClientId is used when settings.websocketClientId() is empty
  // (normally the mDNS hostname). Call attachExistingPublish() once the
  // registry is populated.
  void begin(SettingsStore& settings, const String& fallbackClientId);

  // Boot-snapshot: attaches whatever the registry holds right now to the
  // publisher, then registers DynamicItems hooks for live add/remove
  // tracking. No-op if publish is disabled. Must run after the registry is
  // populated (and, for hook registration, before WebUI can serve
  // add/remove requests).
  void attachExistingPublish(SensActCtrl::Registry& registry, DynamicItems& items);

  // Must be called every loop() iteration — pumps both transports (the
  // WebSockets library is polled, not async) and the publisher.
  void tick();

  // nullptr when the hub is disabled.
  SensActCtrl::ITransport* hubTransport() { return hub_.get(); }
  // Leaves currently connected to the hub, surfaced read-only via
  // GET /api/settings. 0 when the hub is disabled.
  size_t hubClientCount() { return hub_ ? hub_->clientCount() : 0; }

  // Live publish-connection state, surfaced read-only via GET /api/settings.
  // false/"" when publish is disabled.
  bool publishConnected() const { return publishTransport_ && publishTransport_->connected(); }
  const char* publishLastErrorMessage() const {
    return publishTransport_ ? publishTransport_->lastErrorMessage() : "";
  }

 private:
  std::unique_ptr<SensActCtrl::WebSocketTransport> hub_;
  std::unique_ptr<SensActCtrl::WebSocketTransport> publishTransport_;
  std::unique_ptr<SensActCtrl::RemotePublisher> publisher_;
};

}  // namespace BrewControl

#endif  // ARDUINO
