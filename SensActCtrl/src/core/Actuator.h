#pragma once

#include "ActuatorMeta.h"

namespace SensActCtrl {

// Actuator interface. Subclasses implement write/tick; tick() is called from
// Registry::tick() (Actuators-last phase) and drives any non-blocking
// outputs (TPO pulsing, pulse queue, …).
//
// Contract:
//   - write(v) commands a new setpoint in physical units (clamped to meta()
//     range by the subclass). For Binary actuators, v != 0 means "on".
//   - state() reports the most-recently-effective output (post-clamp).
class Actuator {
 public:
  virtual ~Actuator() = default;

  virtual const char* id() const = 0;
  virtual ActuatorMeta meta() const = 0;

  virtual void begin() {}
  virtual void end() {}
  virtual void tick() = 0;
  virtual void write(float value) = 0;
  virtual float state() const = 0;
};

}  // namespace SensActCtrl
