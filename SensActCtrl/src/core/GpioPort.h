#pragma once

#include <stdint.h>

namespace SensActCtrl {

// Digital pins of a port expander (PCF8575, ...). Lets DigitalOutputActuator
// and DigitalInputSensor drive a channel of a chip they know nothing else
// about. Meant for slow digital paths only: every call may be an I2C
// transfer, so no PWM, interrupts or bit-banged protocols on top of it.
class GpioPort {
 public:
  enum class Mode : uint8_t { Input, InputPullup, Output };

  virtual ~GpioPort() = default;

  // Number of channels; valid indices are 0..channels()-1.
  virtual uint8_t channels() const = 0;

  // Configure channel ch. A chip that cannot switch its pull-up treats Input
  // and InputPullup alike. false = the chip did not acknowledge.
  virtual bool pinMode(uint8_t ch, Mode m) = 0;

  // Drive output channel ch. false = the chip did not acknowledge, i.e. the
  // pin is NOT at the requested level.
  virtual bool write(uint8_t ch, bool high) = 0;

  // Level of channel ch into `high`. false = the chip did not answer and
  // `high` is unchanged.
  virtual bool read(uint8_t ch, bool& high) = 0;
};

}  // namespace SensActCtrl
