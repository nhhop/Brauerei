#include "Registry.h"

#include <algorithm>
#include <string.h>

namespace SensActCtrl {

void Registry::add(Sensor* s) { if (s) sensors_.push_back(s); }
void Registry::add(Actuator* a) { if (a) actuators_.push_back(a); }
void Registry::add(Controller* c) { if (c) controllers_.push_back(c); }

void Registry::remove(Sensor* s) {
  if (!s) return;
  s->end();
  sensors_.erase(std::remove(sensors_.begin(), sensors_.end(), s), sensors_.end());
}

void Registry::remove(Actuator* a) {
  if (!a) return;
  a->end();
  actuators_.erase(std::remove(actuators_.begin(), actuators_.end(), a), actuators_.end());
}

void Registry::remove(Controller* c) {
  if (!c) return;
  c->end();
  controllers_.erase(std::remove(controllers_.begin(), controllers_.end(), c), controllers_.end());
}

void Registry::begin() {
  for (auto* s : sensors_) s->begin();
  for (auto* c : controllers_) c->begin();
  for (auto* a : actuators_) a->begin();
}

void Registry::tick() {
  for (auto* s : sensors_) s->tick();
  for (auto* c : controllers_) c->tick();
  for (auto* a : actuators_) a->tick();
}

static bool idEquals(const char* a, const char* b) {
  if (!a || !b) return false;
  return strcmp(a, b) == 0;
}

Sensor* Registry::findSensor(const char* id) const {
  for (auto* s : sensors_) if (idEquals(s->id(), id)) return s;
  return nullptr;
}

Actuator* Registry::findActuator(const char* id) const {
  for (auto* a : actuators_) if (idEquals(a->id(), id)) return a;
  return nullptr;
}

Controller* Registry::findController(const char* id) const {
  for (auto* c : controllers_) if (idEquals(c->id(), id)) return c;
  return nullptr;
}

}  // namespace SensActCtrl
