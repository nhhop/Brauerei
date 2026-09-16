#pragma once

#include <cassert>
#include <stdint.h>
#include <mutex>
#include <string>
#include <vector>

#include "core/Actuator.h"
#include "core/Controller.h"
#include "core/Sensor.h"
#include "transport/ITransport.h"

namespace SensActCtrl {

// Publishes locally registered Sensors / Actuators / Controllers to a
// transport so remote consumers (RemoteSensor / RemoteActuator) see them.
//
// Topic schema (see Topics.h):
//   Sensor   : /sensor/<id>/meta (retained, once)  +  /sensor/<id> (retained, periodic)
//   Actuator : /actuator/<id>/meta (retained, once) + /actuator/<id> (retained, periodic)
//              subscribes /actuator/<id>/set and forwards to actuator.write()
//   Controller: /controller/<id>/meta (retained, paramsJson — refreshed after
//               every accepted /tune)
//               subscribes /controller/<id>/tune and forwards to setParamsJson()
//   Discovery: subscribes sensactctrl/discover and answers every request with
//              one response per sensor channel / actuator (see Discovery.h),
//              sent from tick() one item per call after a random start delay
//              so several devices don't answer in one burst.
//
// Lifecycle: attach() everything in setup(), then begin() to push retained
// meta. tick() must be called from loop() — it republishes state at
// stateIntervalMs cadence and republishes meta after a reconnect.
class RemotePublisher {
 public:
  RemotePublisher(ITransport& transport, const char* deviceId);

  void attach(Sensor& sensor);
  void attach(Actuator& actuator);
  void attach(Controller& controller);

  // Removes a previously attached item. Must be called BEFORE the underlying
  // object is destroyed (e.g. before a dynamic registry frees it) — this is
  // what makes detach-then-delete safe: without it, tick() would dereference
  // a dangling pointer on the next state-publish, and (for actuators /
  // controllers) a stale subscription callback capturing the dead pointer
  // would still fire on an incoming /set or /tune message.
  void detach(const Sensor& sensor);
  void detach(const Actuator& actuator);
  void detach(const Controller& controller);

  // Minimum gap between repeated state publishes per item. 0 = publish on
  // every tick(). Default 1000 ms.
  void setStateIntervalMs(uint32_t ms) { stateIntervalMs_ = ms; }

  // Upper bound of the random delay before answering a discovery request.
  // 0 = answer from the next tick(). Default 400 ms.
  void setDiscoveryJitterMs(uint32_t ms) { discoveryJitterMs_ = ms; }

  // Must be called before attach(). Overrides the default "sensactctrl" root.
  void setPrefix(const char* p) {
    assert(sensors_.empty() && actuators_.empty() && controllers_.empty());
    prefix_ = p;
  }

  void begin();
  void tick();

 private:
  struct SensorEntry {
    Sensor*     sensor;
    size_t      channelIdx;   // which channel this entry represents
    std::string metaTopic;
    std::string stateTopic;
    uint32_t    lastPublishMs;
    bool        metaSent;
  };
  struct ActuatorEntry {
    Actuator* actuator;
    std::string metaTopic;
    std::string stateTopic;
    std::string setTopic;
    uint32_t lastPublishMs;
    bool metaSent;
    bool subscribed;
  };
  struct ControllerEntry {
    Controller* controller;
    std::string metaTopic;
    std::string tuneTopic;
    bool metaSent;
    bool subscribed;
  };

  void publishSensorMeta(SensorEntry& e);
  void publishSensorState(SensorEntry& e);
  void publishActuatorMeta(ActuatorEntry& e);
  void publishActuatorState(ActuatorEntry& e);
  void publishControllerMeta(ControllerEntry& e);
  void onDiscoverRequest(const char* payload);
  void tickDiscovery(uint32_t now);

  ITransport* transport_;
  std::string deviceId_;
  std::vector<SensorEntry> sensors_;
  std::vector<ActuatorEntry> actuators_;
  std::vector<ControllerEntry> controllers_;
  uint32_t stateIntervalMs_ = 1000;
  std::string prefix_ = "sensactctrl";
  bool prevConnected_ = false;

  // Discovery responder. The request callback may run on another task (e.g.
  // the ESP-Now receive callback), so it only hands the request over under
  // the mutex; tick() adopts it and sends the answers.
  uint32_t discoveryJitterMs_ = 400;
  bool discoverSubscribed_ = false;
  std::mutex discoverMutex_;
  bool discoverPending_ = false;
  std::string discoverPendingReply_;
  uint32_t discoverPendingRid_ = 0;
  std::string discoverReply_;
  uint32_t discoverRid_ = 0;
  size_t discoverNext_ = 0;       // index over sensors_ then actuators_
  bool discoverActive_ = false;
  uint32_t discoverStartMs_ = 0;
  uint32_t discoverDelayMs_ = 0;
};

}  // namespace SensActCtrl
