#pragma once

#include <stdint.h>

namespace SensActCtrl {

// Mathematical nature of a sensor/actuator value. Orthogonal to Quantity.
enum class ValueKind : uint8_t {
  Binary,      // two states: 0 / 1 (switch, relay)
  Discrete,    // finite countable steps (multi-position switch, N pulses)
  Continuous,  // float, arbitrary resolution within range
  Cumulative,  // monotonically increasing total (pulse-counter, kWh)
};

inline const char* toString(ValueKind k) {
  switch (k) {
    case ValueKind::Binary:     return "Binary";
    case ValueKind::Discrete:   return "Discrete";
    case ValueKind::Continuous: return "Continuous";
    case ValueKind::Cumulative: return "Cumulative";
  }
  return "Unknown";
}

}  // namespace SensActCtrl
