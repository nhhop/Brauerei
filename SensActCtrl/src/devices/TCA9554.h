#pragma once

#include "../core/GpioPort.h"

#include <stdint.h>

#include <mutex>

// Forward decl to keep TwoWire out of the umbrella header.
class TwoWire;

namespace SensActCtrl {

// TI TCA9554: 8-bit I2C port expander (address 0x20..0x27 via A0..A2) with
// real direction registers: Input 0x00, Output 0x01, Polarity 0x02, Config
// 0x03 (1 = input). Power-up: all pins inputs, output latches 1. There is no
// internal pull-up, so InputPullup is treated as Input.
//
// begin() adopts the chip's output latches and directions, so a channel this
// driver never touches (the Waveshare board wires four of them to its RTC,
// PMU, IMU and power button) keeps whatever the board or a reset left in
// it. A write sends only the one register it changes.
//
// Thread-safe: the shadow and the bus transfer sit under one mutex.
class TCA9554 : public GpioPort {
 public:
  static constexpr uint8_t kChannels = 8;
  // read() fetches the port at most this often; N inputs per loop() then
  // cost one transfer. A failed fetch is cached as well.
  static constexpr uint32_t kReadCacheMs = 20;

  // The TwoWire instance must outlive this object.
  TCA9554(TwoWire& bus, uint8_t i2cAddress = 0x20);

  uint8_t address() const { return address_; }

  // false = no answer; the shadow then assumes the power-up state.
  bool begin();

  uint8_t channels() const override { return kChannels; }
  bool pinMode(uint8_t ch, Mode m) override;
  bool write(uint8_t ch, bool high) override;
  bool read(uint8_t ch, bool& high) override;

 private:
  bool writeReg(uint8_t reg, uint8_t value);  // mutex_ held
  bool readReg(uint8_t reg, uint8_t& value);  // mutex_ held

  TwoWire* bus_;
  uint8_t  address_;
  uint8_t  out_    = 0xFF;  // output latches, bit n = channel n
  uint8_t  config_ = 0xFF;  // direction, 1 = input
  uint8_t  pins_   = 0xFF;  // last fetched pin levels
  bool     pinsOk_ = false;
  bool     pinsFetched_ = false;
  uint32_t pinsAtMs_ = 0;
  std::mutex mutex_;
};

#ifndef ARDUINO
// Test hooks: native builds have no I2C bus. The registers are kept here;
// `ack = false` plays a chip that does not answer, `nowMs` is the clock of
// the read cache. `pins` is what the input register returns.
struct Tca9554TestState {
  uint8_t  address = 0;
  uint8_t  output  = 0xFF;
  uint8_t  config  = 0xFF;
  uint8_t  pins    = 0xFF;
  uint32_t writes  = 0;
  uint32_t reads   = 0;
  bool     ack     = true;
  uint32_t nowMs   = 0;
};
Tca9554TestState& tca9554TestState();
#endif

}  // namespace SensActCtrl
