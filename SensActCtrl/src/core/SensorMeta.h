#pragma once

#include "ValueKind.h"
#include "Quantity.h"

namespace SensActCtrl {

// Static description of a sensor. POD, designed to be read by web frontends
// and remote consumers via meta() so they know how to display/scale a value.
//   unit: short symbol ("°C", "%RH", "bar", "l/min", "pulses", ""). Must
//         outlive the SensorMeta (typically string literal).
//   min/max/resolution: physical-unit range and step. resolution=0 means
//         "no defined step" (e.g. fully continuous ADC).
struct SensorMeta {
  ValueKind kind;
  Quantity quantity;
  const char* unit;
  float min;
  float max;
  float resolution;
};

}  // namespace SensActCtrl
