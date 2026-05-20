#pragma once

#include "ValueKind.h"
#include "Quantity.h"

namespace SensActCtrl {

// Static description of an actuator. Identical structure & semantics to
// SensorMeta — range is the *commandable* range, not the observable one.
struct ActuatorMeta {
  ValueKind kind;
  Quantity quantity;
  const char* unit;
  float min;
  float max;
  float resolution;
};

}  // namespace SensActCtrl
