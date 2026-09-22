#pragma once

#include <map>
#include <string>
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

  // Optional display label for an item, keyed by its id() — deliberately
  // separate from id() (which stays a fixed identifier set at construction
  // and used by controllers/alarms/logs/dashboards) so a UI-facing rename
  // never has to touch the id. Stored centrally here rather than as a field
  // on Sensor/Actuator/Controller: it costs memory only for items that
  // actually get one, instead of growing every item — including standalone
  // library uses with no UI at all — and leaves the item interfaces
  // untouched. label(id) returns "" (never nullptr) if unset or unknown.
  void setLabel(const char* id, const char* label);
  const char* label(const char* id) const;

 private:
  std::vector<Sensor*> sensors_;
  std::vector<Actuator*> actuators_;
  std::vector<Controller*> controllers_;
  std::map<std::string, std::string> labels_;
};

}  // namespace SensActCtrl
