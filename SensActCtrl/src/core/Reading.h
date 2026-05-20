#pragma once

#include <stdint.h>

namespace SensActCtrl {

// A single sensor sample. POD — copyable, no ownership.
//   value:       physical-unit value as defined by SensorMeta.unit.
//   timestampMs: millis() when the sample was taken. 0 means "no sample yet".
//   valid:       false until the sensor has produced a real reading.
struct Reading {
  float value = 0.0f;
  uint32_t timestampMs = 0;
  bool valid = false;
};

}  // namespace SensActCtrl
