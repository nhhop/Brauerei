#pragma once

#ifdef ARDUINO

#include <SensActCtrl.h>
#include <memory>
#include <remote/RemotePublisher.h>
#include <string>
#include <transport/ITransport.h>
#include <transport/WebhookTransport.h>
#include <vector>

#include "DynamicItems.h"
#include "SettingsStore.h"

namespace BrewControl {

// Owns WebhookTransport instances for Remote (webhook) sensors/actuators,
// and — like MqttService — optionally publishes this device's own registry
// as a leaf over one of them.
//
// Consumer side: no broker/settings to manage, each transport is just a
// local HTTP server + a peer URL, always available, no boot-time
// enable/disable. DynamicItems calls getOrCreate() while wiring up a
// "Remote" item with transport:"webhook"; items that share a (listenPort,
// peerBaseUrl) pair (same remote node) reuse the same transport instead of
// opening a second server on the same port.
//
// Publish side: settings-gated (see beginPublish()) and boot-bound like
// MqttService — a settings change takes effect on the next reboot. Reuses
// getOrCreate() for its own transport, so a publish target that happens to
// match an existing consumer item's (port, peerUrl) shares the same
// WebhookTransport instead of opening a second server on the same port.
class WebhookService {
 public:
  SensActCtrl::ITransport& getOrCreate(uint16_t listenPort, const char* peerBaseUrl);

  // Must be called every loop() iteration — WebhookTransport's WebServer
  // only pumps incoming requests (and drains queued retained-pulls) inside
  // tick(), there's no async/interrupt path like ESPAsyncWebServer. Also
  // ticks the publish-side RemotePublisher (state re-publish cadence), if
  // beginPublish() created one.
  void tick();

  // No-op if !settings.webhookEnabled(). fallbackClientId is used when
  // settings.webhookClientId() is empty (normally the mDNS hostname). Only
  // creates the publisher — call attachExistingPublish() once the registry
  // is populated to mirror what's in it and start live tracking.
  void beginPublish(SettingsStore& settings, const String& fallbackClientId);

  // Boot-snapshot: attaches whatever the registry holds right now to the
  // internal publisher, then registers DynamicItems hooks for live
  // add/remove tracking. No-op if beginPublish() didn't create a publisher
  // (webhook publish disabled). Must run after the registry is populated
  // (and, for hook registration, before WebUI can serve add/remove
  // requests).
  void attachExistingPublish(SensActCtrl::Registry& registry, DynamicItems& items);

  // Live publish-transport connection state, surfaced read-only via
  // GET /api/settings. false when disabled/not yet begun.
  bool publishConnected() const { return publishTransport_ && publishTransport_->connected(); }
  const char* publishLastErrorMessage() const {
    return publishTransport_ ? publishTransport_->lastErrorMessage() : "";
  }

 private:
  struct Entry {
    uint16_t port;
    std::string peerUrl;
    std::unique_ptr<SensActCtrl::WebhookTransport> transport;
  };
  std::vector<std::unique_ptr<Entry>> transports_;

  // Publish side — publishTransport_ points into transports_ above (owned
  // there, not here) so a publish target sharing a (port, peerUrl) with a
  // consumer item reuses the same WebhookTransport.
  SensActCtrl::ITransport* publishTransport_ = nullptr;
  std::unique_ptr<SensActCtrl::RemotePublisher> publisher_;
};

}  // namespace BrewControl

#endif  // ARDUINO
