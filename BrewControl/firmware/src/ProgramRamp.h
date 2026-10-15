#pragma once

#include <cmath>
#include <cstdint>
#include <string>
#include <vector>

#include "ProgramTargets.h"

namespace BrewControl {

// Setpoint ramps of program steps (ProgramStep::rampSec). A controller target
// with a v runs linearly over rampSec from the value the program gave that
// controller in an earlier step to the step's v; without an earlier value it
// jumps. The ramp is a function of the step definitions and the elapsed step
// time only, so a reboot replays it from stepStartedEpoch.
//
// Kept free of Arduino and SensActCtrl types so the native tests can use it.

// Smallest change a running ramp writes (K): finer steps only cost writes
// (every setpoint change ends up in state.json).
constexpr float kRampStepK = 0.05f;

// The v the program last gave id in steps 0..k-1, where a ramp in step k
// starts. False if none.
template <class Step>
bool rampFrom(const std::vector<Step>& steps, int k, const std::string& id, float& from) {
  for (const TargetCmd& c : effectiveTargets(steps, k - 1, [](const std::string&) { return false; }))
    if (c.id == id && c.hasV) {
      from = c.v;
      return true;
    }
  return false;
}

// Linear from `from` to `to` over rampSec; `to` from the end of the ramp on.
inline float rampValue(float from, float to, uint32_t elapsedSec, uint32_t rampSec) {
  if (rampSec == 0 || elapsedSec >= rampSec) return to;
  return from + (to - from) * ((float)elapsedSec / (float)rampSec);
}

// Whether a ramp at `value` should overwrite a setpoint at `current`: once it
// moved by kRampStepK, and once more to land exactly on `to`.
inline bool rampShouldWrite(float current, float value, float to) {
  const float d = std::fabs(value - current);
  return d >= kRampStepK || (value == to && d > 1e-4f);
}

// The v command c of step k stands for after elapsedSec of that step: ramped
// when the step has a rampSec and the program set c.id before, else c.v.
// Step is any type with `targets` and `rampSec` (ProgramStep, or a minimal
// struct in the tests).
template <class Step>
float rampedV(const std::vector<Step>& steps, int k, const TargetCmd& c, uint32_t elapsedSec) {
  float from;
  const uint32_t rampSec = steps[k].rampSec;
  if (!c.hasV || rampSec == 0 || !rampFrom(steps, k, c.id, from)) return c.v;
  return rampValue(from, c.v, elapsedSec, rampSec);
}

}  // namespace BrewControl
