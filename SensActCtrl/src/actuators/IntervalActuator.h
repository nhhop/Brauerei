#pragma once

#include <stdint.h>

#include "core/Actuator.h"

namespace SensActCtrl {

// Decorator: wraps another Actuator with a duty-cycle schedule — "on" for
// onSec out of every periodSec, repeating. Generic over Actuator kind
// (Binary/Continuous/Discrete): it only ever drives the inner actuator to
// either the last-written target or meta().min, so it doesn't care what the
// value itself means.
//
// write(v) always remembers v as the target; it's applied to the inner
// actuator immediately only while currently in the "on" phase. tick() drives
// the inner actuator to target (entering "on") or meta().min (entering
// "off") whenever the phase flips. target() keeps reporting the remembered
// value across phase flips, even while state() reads min. The window is a
// rolling one starting at the first tick() (millis()-based, like
// RateLimitedController) — no wall-clock alignment, no NTP dependency.
//
// enabled()/setEnabled() forward to inner_, which is where the master switch
// actually lives (every Actuator has one). Switching back on restarts the
// cycle, so the actuator reacts immediately instead of idling out whatever
// was left of an off-window.
class IntervalActuator : public Actuator {
 public:
  IntervalActuator(Actuator& inner, uint32_t onSec, uint32_t periodSec);

  const char* id() const override { return inner_.id(); }
  ActuatorMeta meta() const override { return inner_.meta(); }

  void begin() override { inner_.begin(); }
  void end() override { inner_.end(); }
  void tick() override;
  float state() const override { return inner_.state(); }
  const char* fault() const override { return inner_.fault(); }
  float target() const override { return target_; }

  bool enabled() const override { return inner_.enabled(); }
  void setEnabled(bool e) override;

  void write(float v) override;

  IntervalConfig interval() const override { return {true, onSec_, periodSec_}; }
  void setInterval(uint32_t onSec, uint32_t periodSec) override;

 private:
  Actuator& inner_;
  uint32_t onSec_ = 0;
  uint32_t periodSec_ = 1;
  float target_ = 0.0f;
  bool onPhase_ = true;
  bool hasTicked_ = false;
  uint32_t cycleStartMs_ = 0;
};

#ifndef ARDUINO
// Test hook: native builds have no wall clock — set the value millis() returns.
void intervalActuatorSetMillisForTest(uint32_t ms);
#endif

}  // namespace SensActCtrl
