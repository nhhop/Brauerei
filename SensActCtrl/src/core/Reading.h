#pragma once

#include <stdint.h>

namespace SensActCtrl {

// A single sensor sample. POD — copyable, no ownership.
//   value:       physical-unit value as defined by SensorMeta.unit.
//   timestampMs: millis() when the sample was taken. 0 means "no sample yet".
//   valid:       false until the sensor has produced a real reading.
struct Reading {
  float    value       = 0.0f;
  uint32_t timestampMs = 0;
  bool     valid       = false;

  // Explicit constructor so brace-init works on C++11 toolchains that
  // disallow aggregate init when default member initialisers are present.
  Reading() = default;
  Reading(float v, uint32_t ts, bool ok) : value(v), timestampMs(ts), valid(ok) {}
};

}  // namespace SensActCtrl
