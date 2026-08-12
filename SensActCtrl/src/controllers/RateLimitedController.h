#pragma once

#include <stdint.h>

#include "core/Controller.h"

namespace SensActCtrl {

// Decorator: wraps another Controller and limits how fast the *effective*
// setpoint handed to it may change, symmetric for rising and falling
// changes (one maxRatePerSec applies both ways). Opt-in only — wrap an
// existing controller instance to add ramping; unwrapped controllers pay no
// extra cost.
//
// tick() advances the ramp and unconditionally calls inner.setSetpoint(effective)
// every cycle before delegating to inner.tick() — this makes the ramp
// self-correcting even if something else nudges inner's setpoint out from
// under it (e.g. a raw setParamsJson() forwarded straight through).
//
// setpoint() returns the TARGET last passed to setSetpoint(), matching every
// other Controller and the snapshot's top-level "setpoint" field. The live
// ramped value is a derived/diagnostic quantity, exposed only via
// paramsJson()'s "effectiveSetpoint" key (and effectiveSetpoint()).
//
// enabled()/setEnabled() and begin()/end() forward to inner_ — the wrapper
// keeps no independent state, so there is exactly one source of truth for
// whether the underlying controller runs.
class RateLimitedController : public Controller {
 public:
  RateLimitedController(Controller& inner, float maxRatePerSec);

  const char* id() const override { return inner_.id(); }

  void begin() override { inner_.begin(); }
  void end() override { inner_.end(); }
  void tick() override;

  void setSetpoint(float setpoint) override;
  float setpoint() const override { return target_; }

  void setEnabled(bool e) override { inner_.setEnabled(e); }
  bool enabled() const override { return inner_.enabled(); }

  // 0 = unlimited (tick() snaps straight to target, same as unwrapped).
  void setMaxRatePerSec(float r) { maxRatePerSec_ = r < 0.0f ? 0.0f : r; }
  float maxRatePerSec() const { return maxRatePerSec_; }

  // Current ramped value actually fed to inner (diagnostic/UI use).
  float effectiveSetpoint() const { return effective_; }

  size_t paramsJson(char* buf, size_t bufSize) const override;
  bool setParamsJson(const char* json) override;

 private:
  Controller& inner_;
  float maxRatePerSec_;
  float target_ = 0.0f;
  float effective_ = 0.0f;
  bool initialized_ = false;
  bool hasTicked_ = false;
  uint32_t lastTickMs_ = 0;
};

#ifndef ARDUINO
// Test hook: native builds have no wall clock — set the value millis() returns.
void rateLimitedSetMillisForTest(uint32_t ms);
#endif

}  // namespace SensActCtrl
