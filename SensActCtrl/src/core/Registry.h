#pragma once

#include <vector>

#include "Sensor.h"
#include "Actuator.h"
#include "Controller.h"

namespace SensActCtrl {

// Central holder of all sensors, actuators and controllers. Pointers are
// non-owning — the application owns the objects (typically file-scope
// globals in a sketch). Registry is normally populated once in setup() and
// not modified afterwards, so vector reallocation is not a runtime concern.
class Registry {
 public:
  Registry() = default;
  Registry(const Registry&) = delete;
  Registry& operator=(const Registry&) = delete;

  void add(Sensor* s);
  void add(Actuator* a);
  void add(Controller* c);

  // Calls end() on the item and removes it from the registry. No-op if null
  // or not found. The caller retains ownership and must free the object after.
  void remove(Sensor* s);
  void remove(Actuator* a);
  void remove(Controller* c);

  // Calls begin() on every registered item, in registration order within
  // each role and Sensors → Controllers → Actuators across roles.
  void begin();

  // Sensors → Controllers → Actuators in registration order within each role.
  // Should be called once per loop() iteration.
  void tick();

  Sensor* findSensor(const char* id) const;
  Actuator* findActuator(const char* id) const;
  Controller* findController(const char* id) const;

  // Iteration accessors — primarily for the future web-frontend snapshot.
  const std::vector<Sensor*>& sensors() const { return sensors_; }
  const std::vector<Actuator*>& actuators() const { return actuators_; }
  const std::vector<Controller*>& controllers() const { return controllers_; }

 private:
  std::vector<Sensor*> sensors_;
  std::vector<Actuator*> actuators_;
  std::vector<Controller*> controllers_;
};

}  // namespace SensActCtrl
