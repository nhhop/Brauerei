#pragma once

#ifdef ARDUINO

#include <Client.h>
#include <SensActCtrl.h>
#include <memory>
#include <remote/RemotePublisher.h>
#include <transport/ITransport.h>
#include <transport/MqttTransport.h>

#ifdef BREWCTL_HAS_EMBEDDED_MQTT_BROKER
#include <TinyMqtt.h>
#endif

#include "DynamicItems.h"
#include "SettingsStore.h"

namespace BrewControl {

// Owns the optional MQTT wiring: an embedded broker (TinyMqtt, LAN-only,
// broker-auth via a build-time patch — see tinymqtt_patch.py) and/or a
// client connection that publishes the Registry's sensors/actuators/
// controllers via RemotePublisher.
//
// The two modes use two different SensActCtrl::ITransport implementations
// (RemotePublisher only cares that it's an ITransport, not which one):
// external mode dials out over real TCP via SensActCtrl::MqttTransport
// (PubSubClient); embedded mode uses TinyMqttLocalTransport, an in-process
// wrapper around TinyMqtt's own local MqttClient(&broker). Embedded mode
// deliberately does NOT route the self-publish through PubSubClient/TCP —
// a WiFiClient dialing this device's own IP (or 127.0.0.1) to reach its
// own broker times out (PubSubClient state -4) regardless of which
// address is used, verified 2026-08-20. TinyMqtt's local client sidesteps
// the whole problem: no socket, no self-connect, delivery is a direct
// in-process call.
//
// Item tracking (which sensors/actuators/controllers are published) is
// live: this registers itself as a DynamicItems observer so attach()/
// detach() run as items are added/removed at runtime. Broker connection
// settings (host/port/mode/TLS) are boot-bound — a settings change takes
// effect on the next reboot, same as WiFi settings.
class MqttService {
 public:
  MqttService(SensActCtrl::Registry& registry, DynamicItems& items,
              SettingsStore& settings);

  // No-op if !settings.mqttEnabled(). fallbackClientId is used when
  // settings.mqttClientId() is empty (normally the mDNS hostname).
  void begin(const String& fallbackClientId);
  void tick();

  // Live transport connection state (false when disabled/not yet connected/
  // reconnecting). Surfaced read-only via GET /api/settings so the UI can
  // show whether the configured broker is actually reachable.
  bool connected() const { return transport_ && transport_->connected(); }

  // Human-readable reason when !connected() (empty otherwise). Only
  // MqttTransport (external mode) has anything specific to say —
  // TinyMqttLocalTransport's connected() can't meaningfully fail once
  // constructed, so this is "" in embedded mode.
  const char* lastErrorMessage() const {
    return transport_ ? transport_->lastErrorMessage() : "";
  }

 private:
  SensActCtrl::Registry& registry_;
  DynamicItems& items_;
  SettingsStore& settings_;

  std::unique_ptr<Client> netClient_;  // external mode only (WiFiClient/WiFiClientSecure)
#ifdef BREWCTL_HAS_EMBEDDED_MQTT_BROKER
  std::unique_ptr<MqttBroker> broker_;
#endif
  std::unique_ptr<SensActCtrl::ITransport> transport_;
  std::unique_ptr<SensActCtrl::RemotePublisher> publisher_;
};

}  // namespace BrewControl

#endif  // ARDUINO
