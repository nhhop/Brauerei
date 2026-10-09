#pragma once

#include "../core/GpioPort.h"

#include <stdint.h>

#include <mutex>

// Forward decl to keep TwoWire out of the umbrella header.
class TwoWire;

namespace SensActCtrl {

// NXP/TI PCF8575: 16-bit I2C port expander (address 0x20..0x27 via A0..A2),
// channels 0..7 = P00..P07, 8..15 = P10..P17. No registers: a write sends
// both port bytes, a read returns both pin bytes.
//
// The pins are quasi-bidirectional: 0 sinks hard (~25 mA), 1 is only a weak
// pull-up (~100 µA) and doubles as input. So the driver keeps one shadow of
// all 16 output latches, every write sends all of them, and input channels
// are always sent as 1. Loads belong between the pin and VCC (active low) or
// behind a transistor. After power-up all pins are 1; a reset of the ESP32
// leaves them where they were.
//
// Thread-safe: the shadow and the bus transfer sit under one mutex, so two
// tasks writing different channels can never send a stale shadow.
class PCF8575 : public GpioPort {
 public:
  static constexpr uint8_t kChannels = 16;
  // read() fetches the port at most this often; N inputs per loop() then
  // cost one transfer. A failed fetch is cached as well.
  static constexpr uint32_t kReadCacheMs = 20;

  // The TwoWire instance must outlive this object.
  PCF8575(TwoWire& bus, uint8_t i2cAddress = 0x20);

  uint8_t address() const { return address_; }

  // Adopts the chip's current latches as the shadow, so the first write
  // leaves the other channels as they are (after a reset or deep-sleep
  // wake). A pin reading 0 is at ground already, latching 0 keeps it there.
  // false = no answer; the shadow then assumes the power-up state (all 1).
  bool begin();

  uint8_t channels() const override { return kChannels; }
  bool pinMode(uint8_t ch, Mode m) override;
  bool write(uint8_t ch, bool high) override;
  bool read(uint8_t ch, bool& high) override;

 private:
  bool send();               // mutex_ held
  bool fetch(uint16_t& v);   // mutex_ held

  TwoWire* bus_;
  uint8_t  address_;
  uint16_t latch_  = 0xFFFF;  // output levels, bit n = channel n
  uint16_t inputs_ = 0;       // channels configured as input, sent as 1
  uint16_t pins_   = 0xFFFF;  // last fetched pin levels
  bool     pinsOk_ = false;
  bool     pinsFetched_ = false;
  uint32_t pinsAtMs_ = 0;
  std::mutex mutex_;
};

#ifndef ARDUINO
// Test hooks: native builds have no I2C bus. send() records the port word,
// fetch() returns `pins`; `ack = false` plays a chip that does not answer.
// `nowMs` is the clock of the read cache.
struct Pcf8575TestState {
  uint8_t  address = 0;
  uint16_t written = 0xFFFF;
  uint32_t writes  = 0;
  uint16_t pins    = 0xFFFF;
  uint32_t reads   = 0;
  bool     ack     = true;
  uint32_t nowMs   = 0;
};
Pcf8575TestState& pcf8575TestState();
#endif

}  // namespace SensActCtrl
