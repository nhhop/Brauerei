#pragma once

#include <stdint.h>
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

  // Minimum gap between repeated state publishes per item. 0 = publish on
  // every tick(). Default 1000 ms.
  void setStateIntervalMs(uint32_t ms) { stateIntervalMs_ = ms; }

  void begin();
  void tick();

 private:
  struct SensorEntry {
    Sensor* sensor;
    std::string metaTopic;
    std::string stateTopic;
    uint32_t lastPublishMs;
    bool metaSent;
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

  ITransport* transport_;
  std::string deviceId_;
  std::vector<SensorEntry> sensors_;
  std::vector<ActuatorEntry> actuators_;
  std::vector<ControllerEntry> controllers_;
  uint32_t stateIntervalMs_ = 1000;
  bool prevConnected_ = false;
};

}  // namespace SensActCtrl
