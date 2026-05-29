#include "RemotePublisher.h"

#include "MetaJson.h"
#include "Topics.h"

#if defined(ARDUINO)
  #include <Arduino.h>
#else
  // Tests drive cadence via setStateIntervalMs(0); a constant millis is fine.
  static uint32_t millis() { return 0; }
#endif

namespace SensActCtrl {

RemotePublisher::RemotePublisher(ITransport& transport, const char* deviceId)
    : transport_(&transport), deviceId_(deviceId) {}

void RemotePublisher::attach(Sensor& s) {
  const size_t n = s.channelCount();
  const char*  p = prefix_.c_str();
  for (size_t i = 0; i < n; ++i) {
    const Channel ch = s.channel(i);
    SensorEntry e;
    e.sensor        = &s;
    e.channelIdx    = i;
    e.lastPublishMs = 0;
    e.metaSent      = false;
    const bool flat = (n == 1 && ch.key[0] == '\0');
    if (flat) {
      e.metaTopic  = remote::sensorMeta(deviceId_.c_str(), s.id(), p);
      e.stateTopic = remote::sensorState(deviceId_.c_str(), s.id(), p);
    } else {
      e.metaTopic  = remote::sensorChannelMeta(deviceId_.c_str(), s.id(), ch.key, p);
      e.stateTopic = remote::sensorChannelState(deviceId_.c_str(), s.id(), ch.key, p);
    }
    sensors_.push_back(std::move(e));
  }
}

void RemotePublisher::attach(Actuator& a) {
  const char* p = prefix_.c_str();
  ActuatorEntry e;
  e.actuator   = &a;
  e.metaTopic  = remote::actuatorMeta(deviceId_.c_str(), a.id(), p);
  e.stateTopic = remote::actuatorState(deviceId_.c_str(), a.id(), p);
  e.setTopic   = remote::actuatorSet(deviceId_.c_str(), a.id(), p);
  e.lastPublishMs = 0;
  e.metaSent   = false;
  e.subscribed = false;
  actuators_.push_back(std::move(e));
}

void RemotePublisher::attach(Controller& c) {
  const char* p = prefix_.c_str();
  ControllerEntry e;
  e.controller = &c;
  e.metaTopic  = remote::controllerMeta(deviceId_.c_str(), c.id(), p);
  e.tuneTopic  = remote::controllerTune(deviceId_.c_str(), c.id(), p);
  e.metaSent   = false;
  e.subscribed = false;
  controllers_.push_back(std::move(e));
}

void RemotePublisher::publishSensorMeta(SensorEntry& e) {
  char buf[192];
  size_t n = remote::serializeSensorMeta(
      e.sensor->channel(e.channelIdx).meta, buf, sizeof(buf));
  if (n == 0) return;
  if (transport_->publish(e.metaTopic.c_str(), buf, /*retained=*/true)) {
    e.metaSent = true;
  }
}

void RemotePublisher::publishSensorState(SensorEntry& e) {
  const Reading r = e.sensor->channel(e.channelIdx).reading;
  char buf[96];
  size_t n = remote::serializeState(r.value, r.timestampMs, r.valid, buf, sizeof(buf));
  if (n == 0) return;
  transport_->publish(e.stateTopic.c_str(), buf, /*retained=*/true);
}

void RemotePublisher::publishActuatorMeta(ActuatorEntry& e) {
  char buf[192];
  size_t n = remote::serializeActuatorMeta(e.actuator->meta(), buf, sizeof(buf));
  if (n == 0) return;
  if (transport_->publish(e.metaTopic.c_str(), buf, /*retained=*/true)) {
    e.metaSent = true;
  }
}

void RemotePublisher::publishActuatorState(ActuatorEntry& e) {
  char buf[96];
  size_t n = remote::serializeState(e.actuator->state(), millis(), /*ok=*/true,
                                    buf, sizeof(buf));
  if (n == 0) return;
  transport_->publish(e.stateTopic.c_str(), buf, /*retained=*/true);
}

void RemotePublisher::publishControllerMeta(ControllerEntry& e) {
  char buf[256];
  size_t n = e.controller->paramsJson(buf, sizeof(buf));
  if (n == 0) return;
  if (transport_->publish(e.metaTopic.c_str(), buf, /*retained=*/true)) {
    e.metaSent = true;
  }
}

void RemotePublisher::begin() {
  // Subscribe to actuator /set and controller /tune. Then publish all meta
  // retained (idempotent — if we end up reconnecting later, tick() handles
  // that by checking metaSent and prevConnected_).
  for (auto& e : actuators_) {
    if (!e.subscribed) {
      Actuator* a = e.actuator;
      transport_->subscribe(e.setTopic.c_str(),
          [a](const char*, const char* p, size_t /*n*/) {
            float v = 0.0f;
            if (remote::parseSetCommand(p, v)) a->write(v);
          });
      e.subscribed = true;
    }
  }
  for (auto& e : controllers_) {
    if (!e.subscribed) {
      Controller* c = e.controller;
      RemotePublisher* self = this;
      ControllerEntry* entry = &e;
      transport_->subscribe(e.tuneTopic.c_str(),
          [c, self, entry](const char*, const char* p, size_t /*n*/) {
            if (c->setParamsJson(p)) {
              self->publishControllerMeta(*entry);
            }
          });
      e.subscribed = true;
    }
  }

  for (auto& e : sensors_)     publishSensorMeta(e);
  for (auto& e : actuators_)   publishActuatorMeta(e);
  for (auto& e : controllers_) publishControllerMeta(e);

  prevConnected_ = transport_->connected();
}

void RemotePublisher::tick() {
  const bool connectedNow = transport_->connected();
  const bool justReconnected = connectedNow && !prevConnected_;
  prevConnected_ = connectedNow;
  if (!connectedNow) return;

  if (justReconnected) {
    for (auto& e : sensors_)     publishSensorMeta(e);
    for (auto& e : actuators_)   publishActuatorMeta(e);
    for (auto& e : controllers_) publishControllerMeta(e);
  }

  const uint32_t now = millis();
  for (auto& e : sensors_) {
    if (now - e.lastPublishMs >= stateIntervalMs_) {
      publishSensorState(e);
      e.lastPublishMs = now;
    }
  }
  for (auto& e : actuators_) {
    if (now - e.lastPublishMs >= stateIntervalMs_) {
      publishActuatorState(e);
      e.lastPublishMs = now;
    }
  }
}

}  // namespace SensActCtrl
