#pragma once

#include <stdint.h>

namespace SensActCtrl {

// Physical quantity being measured / actuated. Orthogonal to ValueKind.
// Use `None` for Binary/Discrete signals without a physical meaning.
enum class Quantity : uint8_t {
  None,
  Temperature,
  Humidity,
  Pressure,
  pH,
  Voltage,
  Current,
  Power,
  Energy,
  Mass,
  Volume,
  FlowRate,
  Frequency,
  Duration,
  DutyCycle,
  Count,
  Custom,
};

inline const char* toString(Quantity q) {
  switch (q) {
    case Quantity::None:        return "None";
    case Quantity::Temperature: return "Temperature";
    case Quantity::Humidity:    return "Humidity";
    case Quantity::Pressure:    return "Pressure";
    case Quantity::pH:          return "pH";
    case Quantity::Voltage:     return "Voltage";
    case Quantity::Current:     return "Current";
    case Quantity::Power:       return "Power";
    case Quantity::Energy:      return "Energy";
    case Quantity::Mass:        return "Mass";
    case Quantity::Volume:      return "Volume";
    case Quantity::FlowRate:    return "FlowRate";
    case Quantity::Frequency:   return "Frequency";
    case Quantity::Duration:    return "Duration";
    case Quantity::DutyCycle:   return "DutyCycle";
    case Quantity::Count:       return "Count";
    case Quantity::Custom:      return "Custom";
  }
  return "Unknown";
}

}  // namespace SensActCtrl
