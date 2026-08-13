#pragma once

#include <stdint.h>

#include "ActuatorMeta.h"

namespace SensActCtrl {

// Duty-cycle schedule reported by interval()/set via setInterval(). has=false
// (the default) means the actuator isn't interval-scheduled.
struct IntervalConfig {
  bool has = false;
  uint32_t onSec = 0;
  uint32_t periodSec = 0;
};

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
  virtual const char* fault() const { return nullptr; }

  // Master on/off switch, independent of write()'s value. Most actuators
  // ignore it (default: always enabled) — only decorators like
  // EnableGuardActuator give it real meaning.
  virtual bool enabled() const { return true; }
  virtual void setEnabled(bool) {}

  // Duty-cycle schedule (on-time per period). Most actuators ignore it —
  // only IntervalActuator gives it real meaning.
  virtual IntervalConfig interval() const { return {}; }
  virtual void setInterval(uint32_t /*onSec*/, uint32_t /*periodSec*/) {}
};

}  // namespace SensActCtrl
