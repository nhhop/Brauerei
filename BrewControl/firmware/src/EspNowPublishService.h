#pragma once

#ifdef ARDUINO

#include <SensActCtrl.h>
#include <memory>
#include <remote/RemotePublisher.h>
#include <transport/ITransport.h>

#include "DynamicItems.h"
#include "SettingsStore.h"

namespace BrewControl {

// Publishes this device's own registry as a leaf over the shared broadcast
// EspNowTransport (owned by main.cpp — this class only borrows a pointer to
// it, since that transport is constructed later, after WiFi connects, while
// this service is instantiated as a global before setup() runs).
//
// Mirrors MqttService's begin()/attachExisting()/tick() lifecycle. Unlike
// MQTT there's no broker/host/port/channel to configure — the transport
// already exists and rides the current WiFi channel; only enable + identity
// (clientId, topicPrefix) are settings-driven. Boot-bound like MqttService:
// a settings change takes effect on the next reboot.
class EspNowPublishService {
 public:
  // No-op if !settings.espnowEnabled(). fallbackClientId is used when
  // settings.espnowClientId() is empty (normally the mDNS hostname). Only
  // creates the publisher — call attachExisting() once the registry is
  // populated to mirror what's in it and start live tracking.
  void begin(SensActCtrl::ITransport& transport, SettingsStore& settings,
             const String& fallbackClientId);

  // Boot-snapshot: attaches whatever the registry holds right now to the
  // internal publisher, then registers DynamicItems hooks for live
  // add/remove tracking. No-op if begin() didn't create a publisher
  // (ESP-NOW publish disabled). Must run after the registry is populated
  // (and, for hook registration, before WebUI can serve add/remove
  // requests).
  void attachExisting(SensActCtrl::Registry& registry, DynamicItems& items);

  // EspNowTransport::tick() is currently a no-op (connectionless) but is
  // still called here, matching the library's own example sketches, in
  // case that changes. No-op if begin() didn't create a publisher.
  void tick();

  // Live connection state, surfaced read-only via GET /api/settings. false
  // when disabled/not yet begun.
  bool connected() const { return transport_ && transport_->connected(); }
  const char* lastErrorMessage() const {
    return transport_ ? transport_->lastErrorMessage() : "";
  }

 private:
  SensActCtrl::ITransport* transport_ = nullptr;
  std::unique_ptr<SensActCtrl::RemotePublisher> publisher_;
};

}  // namespace BrewControl

#endif  // ARDUINO
