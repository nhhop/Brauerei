#pragma once

#ifdef ARDUINO

#include <Client.h>
#include <SensActCtrl.h>
#include <memory>
#include <remote/RemotePublisher.h>
#include <transport/MqttTransport.h>

#ifdef BREWCTL_HAS_EMBEDDED_MQTT_BROKER
#include <TinyMqtt.h>
#endif

#include "DynamicItems.h"
#include "SettingsStore.h"

namespace BrewControl {

// Owns the optional MQTT wiring: an embedded broker (TinyMqtt, LAN-only,
// broker-auth via a build-time patch — see tinymqtt_patch.py) and/or a
// client connection (SensActCtrl::MqttTransport/PubSubClient) that publishes
// the Registry's sensors/actuators/controllers via RemotePublisher. In
// embedded mode the client connects to the broker we just started on
// 127.0.0.1 — RemotePublisher never talks to TinyMqtt directly, so both
// modes share one publishing code path.
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

 private:
  SensActCtrl::Registry& registry_;
  DynamicItems& items_;
  SettingsStore& settings_;

  std::unique_ptr<Client> netClient_;
#ifdef BREWCTL_HAS_EMBEDDED_MQTT_BROKER
  std::unique_ptr<MqttBroker> broker_;
#endif
  std::unique_ptr<SensActCtrl::MqttTransport> transport_;
  std::unique_ptr<SensActCtrl::RemotePublisher> publisher_;
};

}  // namespace BrewControl

#endif  // ARDUINO
