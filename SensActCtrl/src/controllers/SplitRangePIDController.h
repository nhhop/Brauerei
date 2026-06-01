#pragma once

#include <stddef.h>
#include <stdint.h>

#include "core/Controller.h"
#include "core/Sensor.h"
#include "core/Actuator.h"

namespace SensActCtrl {

// Split-range PID controller: one PID with a bipolar output drives a heating
// stage (positive output) and a cooling stage (negative output) from a single
// sensor. A neutral deadband around zero keeps both stages off near the
// setpoint.
//
//   out = PID(setpoint - input), clamped to [-1, +1]
//   out >  +deadband → heat = out   (cool off)
//   out <  -deadband → cool = -out  (heat off)
//   else             → both off
//
// Because there is a single scalar output, the two stages are mutually
// exclusive by construction (deadband is clamped to >= 0); a hard interlock in
// tick() is the last line of defence. Either actuator may be null.
//
// An optional changeover dead-time keeps both stages off for a while when the
// output flips sign. Fail-safe: on disable or an invalid reading both stages
// are driven off.
//
// Self-contained positional PID (clamping anti-windup) — no AutoTunePID
// dependency. tick() throttles the PID update to >= 100 ms.
class SplitRangePIDController : public Controller {
 public:
  SplitRangePIDController(const char* id, Sensor& sensor,
                          Actuator* heat, Actuator* cool);

  const char* id() const override { return id_; }

  void tick() override;
  void setSetpoint(float sp) override { setpoint_ = sp; }
  float setpoint() const override { return setpoint_; }

  void setTunings(float kp, float ki, float kd);
  float kp() const { return kp_; }
  float ki() const { return ki_; }
  float kd() const { return kd_; }

  // Neutral output deadband in output units (0..1), clamped to >= 0.
  void setDeadband(float d);
  float deadband() const { return deadband_; }

  // Changeover dead-time: when the output flips sign, the new stage may only
  // engage once the other has been off this long. 0 = off.
  void setChangeoverMs(uint32_t ms) { changeoverMs_ = ms; }
  uint32_t changeoverMs() const { return changeoverMs_; }

  // Last commanded outputs (0..1), for inspection / JSON.
  float heatOut() const { return heatOut_; }
  float coolOut() const { return coolOut_; }

  size_t paramsJson(char* buf, size_t bufSize) const override;
  bool setParamsJson(const char* json) override;

 private:
  void writeOff();
  float pidUpdate(float input, float dtSeconds);  // → [-1, +1]

  const char* id_;
  Sensor* sensor_;
  Actuator* heat_;
  Actuator* cool_;

  float setpoint_ = 0.0f;
  float kp_ = 0.0f;
  float ki_ = 0.0f;
  float kd_ = 0.0f;
  float deadband_ = 0.0f;
  uint32_t changeoverMs_ = 0;

  float integral_ = 0.0f;
  float lastError_ = 0.0f;
  float heatOut_ = 0.0f;
  float coolOut_ = 0.0f;

  bool started_ = false;
  uint32_t lastTickMs_ = 0;

  bool heatOn_ = false;
  bool coolOn_ = false;
  uint32_t heatOffSinceMs_ = 0;
  uint32_t coolOffSinceMs_ = 0;
  bool heatOffSeen_ = false;
  bool coolOffSeen_ = false;
};

#ifndef ARDUINO
// Test hook: native builds have no wall clock — set the value millis() returns.
void splitRangeSetMillisForTest(uint32_t ms);
#endif

}  // namespace SensActCtrl
