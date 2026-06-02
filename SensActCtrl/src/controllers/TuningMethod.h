#pragma once

#include <stdint.h>

namespace SensActCtrl {

// Tuning methods exposed by the PID wrapper. Names mirror AutoTunePID's enum
// 1:1 — the wrapper translates these to the backend's enum internally so
// the public API never leaks the AutoTunePID header.
enum class TuningMethod : uint8_t {
  ZieglerNichols,
  CohenCoon,
  IMC,
  TyreusLuyben,
  LambdaTuning,
};

}  // namespace SensActCtrl
