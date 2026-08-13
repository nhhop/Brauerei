#pragma once

#include "core/Actuator.h"

namespace SensActCtrl {

// Decorator: wraps another Actuator with an independent on/off master
// switch, on top of whatever value the wrapped actuator already accepts.
// Intended for Continuous-kind actuators (sliders), where "off" isn't
// otherwise distinguishable from "value == min" the way it is for Binary
// (the value already IS the on/off state) or Discrete (explicit send).
//
// write(v) always remembers v as the target; while disabled, the inner
// actuator is instead driven to meta().min. Re-enabling replays the last
// target so the actuator resumes at its previous value instead of staying
// at min.
class EnableGuardActuator : public Actuator {
 public:
  explicit EnableGuardActuator(Actuator& inner) : inner_(inner) {}

  const char* id() const override { return inner_.id(); }
  ActuatorMeta meta() const override { return inner_.meta(); }

  void begin() override { inner_.begin(); }
  void end() override { inner_.end(); }
  void tick() override { inner_.tick(); }
  float state() const override { return inner_.state(); }
  const char* fault() const override { return inner_.fault(); }

  void write(float v) override;

  void setEnabled(bool e) override;
  bool enabled() const override { return enabled_; }

  // Transparent forwarding — lets a further-wrapped IntervalActuator (or any
  // future decorator) stay reachable through this one, since the Registry
  // only ever holds the outermost pointer.
  IntervalConfig interval() const override { return inner_.interval(); }
  void setInterval(uint32_t onSec, uint32_t periodSec) override { inner_.setInterval(onSec, periodSec); }

 private:
  Actuator& inner_;
  bool enabled_ = true;
  float target_ = 0.0f;
};

}  // namespace SensActCtrl
