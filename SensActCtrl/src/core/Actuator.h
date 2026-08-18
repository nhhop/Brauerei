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
//   - target() reports that commanded value back, unaffected by enabled().
//   - state() reports what is actually driven right now — the target while
//     enabled, meta().min while disabled. Subclasses whose output isn't a
//     simple level (e.g. a pulse queue) override it.
//   - enabled() is a master switch orthogonal to the value: while false the
//     actuator must hold its output inactive without forgetting its target,
//     so re-enabling resumes where it left off. Subclasses enforce this at
//     the point they touch hardware — tick() keeps running, it just must not
//     drive anything active. What "inactive" means is per-subclass: a GPIO
//     class holds its pin at the non-active level, while an actuator talking
//     over a protocol (IdsActuator, RemoteActuator) must actively command
//     zero, because going silent would leave the far end running.
class Actuator {
 public:
  virtual ~Actuator() = default;

  virtual const char* id() const = 0;
  virtual ActuatorMeta meta() const = 0;

  virtual void begin() {}
  virtual void end() {}
  virtual void tick() = 0;
  virtual void write(float value) = 0;
  virtual float target() const = 0;
  virtual float state() const { return enabled_ ? target() : meta().min; }
  virtual const char* fault() const { return nullptr; }

  // Master on/off switch, independent of write()'s value.
  virtual void setEnabled(bool e) {
    if (e == enabled_) return;
    enabled_ = e;
    applyEnabled(e);
  }
  virtual bool enabled() const { return enabled_; }

  // Duty-cycle schedule (on-time per period). Most actuators ignore it —
  // only IntervalActuator gives it real meaning.
  virtual IntervalConfig interval() const { return {}; }
  virtual void setInterval(uint32_t /*onSec*/, uint32_t /*periodSec*/) {}

 protected:
  // Called on an actual enable-state change (never on a redundant set).
  // Subclasses bring their output into — or back out of — their inactive
  // state here. Default: nothing, for subclasses whose tick() already
  // re-evaluates the gate on its own.
  virtual void applyEnabled(bool /*e*/) {}

  bool enabled_ = true;
};

}  // namespace SensActCtrl
