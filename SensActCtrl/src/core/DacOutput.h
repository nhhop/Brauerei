#pragma once

#include <stdint.h>

namespace SensActCtrl {

// One analog output channel of an external DAC (MCP4728, ...). Lets
// AnalogOutputActuator drive a converter it knows nothing else about.
class DacOutput {
 public:
  virtual ~DacOutput() = default;

  // Largest raw code write() accepts (4095 for a 12-bit converter).
  virtual uint16_t rawMax() const = 0;

  // Drive the output to `raw` (clamped to rawMax()). false = the converter
  // did not acknowledge, i.e. the output is NOT at the requested level.
  virtual bool write(uint16_t raw) = 0;
};

}  // namespace SensActCtrl
