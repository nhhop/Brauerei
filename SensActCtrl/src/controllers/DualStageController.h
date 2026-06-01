#pragma once

#include <stddef.h>
#include <stdint.h>

#include "core/Controller.h"
#include "core/Sensor.h"
#include "core/Actuator.h"

namespace SensActCtrl {

// Dual-stage bang-bang controller: one sensor drives a heating stage and a
// cooling stage with a deadband in between (fermentation-style heat/cool).
//
// Heating turns on below  setpoint - heatDiff and off at setpoint.
// Cooling turns on above  setpoint + coolDiff and off at setpoint.
// Because the heating region (< setpoint) and cooling region (> setpoint)
// never overlap (heatDiff/coolDiff are clamped to >= 0), the two stages are
// mutually exclusive by construction; a hard interlock in tick() is the
// last line of defence.
//
// Either actuator may be null (heat-only / cool-only setups).
//
// Cooling supports anti-short-cycle limits (compressor protection): once the
// cool stage switches it is held for at least minOn / minOff. An optional
// changeover dead-time keeps both stages off for a while when switching
// direction.
//
// Fail-safe: on disable or an invalid reading both stages are driven off.
class DualStageController : public Controller {
 public:
  DualStageController(const char* id, Sensor& sensor,
                      Actuator* heat, Actuator* cool);

  const char* id() const override { return id_; }

  void tick() override;
  void setSetpoint(float sp) override { setpoint_ = sp; }
  float setpoint() const override { return setpoint_; }

  // Both differentials are clamped to >= 0.
  void setDifferentials(float heatDiff, float coolDiff);
  float heatDiff() const { return heatDiff_; }
  float coolDiff() const { return coolDiff_; }

  // Anti-short-cycle for the cooling stage. 0 = off.
  void setCoolCycleLimits(uint32_t minOnMs, uint32_t minOffMs);
  uint32_t coolMinOnMs() const { return coolMinOnMs_; }
  uint32_t coolMinOffMs() const { return coolMinOffMs_; }

  // Changeover dead-time: when switching heat<->cool, the opposite stage may
  // only engage once the other has been off this long. 0 = off.
  void setChangeoverMs(uint32_t ms) { changeoverMs_ = ms; }
  uint32_t changeoverMs() const { return changeoverMs_; }

  // Last commanded outputs (0/1), for inspection / JSON.
  float heatOut() const { return heatOn_ ? 1.0f : 0.0f; }
  float coolOut() const { return coolOn_ ? 1.0f : 0.0f; }

  size_t paramsJson(char* buf, size_t bufSize) const override;
  bool setParamsJson(const char* json) override;

 private:
  void writeOff();

  const char* id_;
  Sensor* sensor_;
  Actuator* heat_;
  Actuator* cool_;

  float setpoint_ = 0.0f;
  float heatDiff_ = 0.5f;
  float coolDiff_ = 0.5f;
  uint32_t coolMinOnMs_ = 0;
  uint32_t coolMinOffMs_ = 0;
  uint32_t changeoverMs_ = 0;

  bool heatOn_ = false;
  bool coolOn_ = false;
  uint32_t coolOnSinceMs_ = 0;
  uint32_t coolOffSinceMs_ = 0;
  uint32_t heatOffSinceMs_ = 0;
  bool coolOffSeen_ = false;  // a real cool off-transition has happened
  bool heatOffSeen_ = false;  // a real heat off-transition has happened
};

#ifndef ARDUINO
// Test hook: native builds have no wall clock — set the value millis() returns.
void dualStageSetMillisForTest(uint32_t ms);
#endif

}  // namespace SensActCtrl
