#include "MqttService.h"

#ifdef ARDUINO

#include <Arduino.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>

#ifdef BREWCTL_HAS_EMBEDDED_MQTT_BROKER
#include "TinyMqttLocalTransport.h"
#endif

namespace BrewControl {

using SensActCtrl::Actuator;
using SensActCtrl::Controller;
using SensActCtrl::MqttTransport;
using SensActCtrl::RemotePublisher;
using SensActCtrl::Sensor;

MqttService::MqttService(SensActCtrl::Registry& registry, DynamicItems& items,
                         SettingsStore& settings)
    : registry_(registry), items_(items), settings_(settings) {}

void MqttService::begin(const String& fallbackClientId) {
  if (!settings_.mqttEnabled()) return;

  const String clientId = settings_.mqttClientId().isEmpty()
                              ? fallbackClientId
                              : settings_.mqttClientId();
  const bool embedded = settings_.mqttMode() == "embedded";
  const uint16_t port = settings_.mqttPort();

  if (embedded) {
#ifdef BREWCTL_HAS_EMBEDDED_MQTT_BROKER
    broker_ = std::make_unique<MqttBroker>(port);
    if (!settings_.mqttUsername().isEmpty()) {
      broker_->setAuth(settings_.mqttUsername().c_str(), settings_.mqttPassword().c_str());
    }
    broker_->begin();
    // In-process local client — no socket, no self-connect. See class
    // comment in MqttService.h for why this replaced dialing our own
    // MqttTransport/PubSubClient at 127.0.0.1 / WiFi.localIP().
    transport_ = std::make_unique<TinyMqttLocalTransport>(*broker_, clientId.c_str());
#else
    Serial.println(F("MqttService: embedded broker not supported on this build — MQTT disabled"));
    return;
#endif
  } else {
    if (settings_.mqttTls()) {
      auto secure = std::make_unique<WiFiClientSecure>();
      secure->setInsecure();
      netClient_ = std::move(secure);
    } else {
      netClient_ = std::make_unique<WiFiClient>();
    }
    transport_ = std::make_unique<MqttTransport>(
        *netClient_, settings_.mqttHost().c_str(), port, clientId.c_str(),
        settings_.mqttUsername().c_str(), settings_.mqttPassword().c_str());
  }

  publisher_ = std::make_unique<RemotePublisher>(*transport_, clientId.c_str());
  publisher_->setPrefix(settings_.mqttTopicPrefix().c_str());

  // Boot snapshot: attach whatever the registry holds right now.
  for (auto* s : registry_.sensors())     publisher_->attach(*s);
  for (auto* a : registry_.actuators())   publisher_->attach(*a);
  for (auto* c : registry_.controllers()) publisher_->attach(*c);
  publisher_->begin();

  // Live tracking: mirror future add/remove via DynamicItems. begin() after
  // attach() is idempotent (retained publishes, subscribed-guard) — cheap
  // enough to re-run on every add rather than adding a narrower "publish one"
  // path to RemotePublisher.
  items_.setOnSensorAdded([this](Sensor& s) {
    if (publisher_) { publisher_->attach(s); publisher_->begin(); }
  });
  items_.setOnSensorRemoving([this](Sensor& s) {
    if (publisher_) publisher_->detach(s);
  });
  items_.setOnActuatorAdded([this](Actuator& a) {
    if (publisher_) { publisher_->attach(a); publisher_->begin(); }
  });
  items_.setOnActuatorRemoving([this](Actuator& a) {
    if (publisher_) publisher_->detach(a);
  });
  items_.setOnControllerAdded([this](Controller& c) {
    if (publisher_) { publisher_->attach(c); publisher_->begin(); }
  });
  items_.setOnControllerRemoving([this](Controller& c) {
    if (publisher_) publisher_->detach(c);
  });
}

void MqttService::tick() {
#ifdef BREWCTL_HAS_EMBEDDED_MQTT_BROKER
  if (broker_) broker_->loop();
#endif
  if (transport_) transport_->tick();
  if (publisher_) publisher_->tick();
}

}  // namespace BrewControl

#endif  // ARDUINO
