#pragma once

#include "../core/GpioPort.h"

#include <stdint.h>

// Forward decl to keep TwoWire out of the umbrella header.
class TwoWire;

namespace SensActCtrl {

// WCH CH422G: 8 bidirectional pins (IO0..IO7, "EXIO0..7") and four
// push-pull outputs (OC0..OC3) behind a register-less I2C
// interface - each function has an address of its own: system parameter
// 0x24, OC outputs 0x23, IO outputs 0x38, IO inputs 0x26. The chip cannot be
// read back, and the direction of IO0..IO7 is one bit for all eight (IO_OE).
//
// Channels 0..7 are IO0..IO7, 8 and 9 are OC0 and OC1 (the Waveshare
// ESP32-S3-Touch-LCD-5 wires only those two). Because the chip is write-only,
// the latches live in one process-wide shadow shared by every CH422G object:
// the board bring-up and the peripheral registry both talk to the same
// chip, and neither may forget what the other set. The fixed addresses allow
// one CH422G per boot anyway.
//
// pinMode(Output) on an IO channel sets IO_OE, which makes all eight pins
// outputs; pinMode(Input) leaves the chip alone. An output pin reads back
// what it drives, so read() flips IO_OE to input for one transfer and back
// (the latches keep their value; whatever hangs on an output pin floats for
// that moment, a few milliseconds: the chip needs 2 ms to switch). The OC pins are always push-pull outputs
// (the Waveshare demo uses them that way) and read back their latch.
// begin() only probes the chip and writes nothing.
//
// Thread-safe: shadow and transfer sit under one process-wide mutex.
class CH422G : public GpioPort {
 public:
  static constexpr uint8_t kChannels = 10;
  static constexpr uint8_t kIoChannels = 8;
  // read() fetches the IO pins at most this often.
  static constexpr uint32_t kReadCacheMs = 20;

  // The TwoWire instance must outlive this object.
  explicit CH422G(TwoWire& bus);

  // false = no answer.
  bool begin();

  uint8_t channels() const override { return kChannels; }
  bool pinMode(uint8_t ch, Mode m) override;
  bool write(uint8_t ch, bool high) override;
  bool read(uint8_t ch, bool& high) override;

 private:
  TwoWire* bus_;
};

#ifndef ARDUINO
// Test hooks: native builds have no I2C bus. The chip's four byte registers
// are kept here; `ack = false` plays a chip that does not answer, `nowMs` is
// the clock of the read cache, `pins` what the input address returns.
struct CH422GTestState {
  uint8_t  set    = 0x00;
  uint8_t  oc     = 0x0F;
  uint8_t  io     = 0xFF;
  uint8_t  pins   = 0xFF;
  uint32_t writes = 0;
  uint32_t reads  = 0;
  bool     ack    = true;
  uint32_t nowMs  = 0;
};
CH422GTestState& ch422gTestState();
// Back to the power-up shadow, as after a reboot.
void ch422gResetShadow();
#endif

}  // namespace SensActCtrl
