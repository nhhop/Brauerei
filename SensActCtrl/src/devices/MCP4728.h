#pragma once

#include "../core/DacOutput.h"

#include <stdint.h>

// Forward decl to keep TwoWire out of the umbrella header.
class TwoWire;

namespace SensActCtrl {

// Microchip MCP4728: 4-channel, 12-bit I2C DAC (address 0x60..0x67, 0x60 from
// the factory).
//
// Only the "Multi-Write" command is used: reference VDD, gain x1, normal
// power, output updated as soon as the frame is acknowledged (UDAC = 0, the
// LDAC pin is irrelevant). The EEPROM is never written — after power-up the
// chip starts with its stored values (0 V from the factory), which is the
// safe state until the first write().
class MCP4728 {
 public:
  static constexpr int kChannels = 4;

  // The TwoWire instance must outlive this object.
  MCP4728(TwoWire& bus, uint8_t i2cAddress = 0x60);

  uint8_t address() const { return address_; }

  // Output channel 0..3 (A..D); out-of-range indices fall back to channel 0.
  // The returned reference lives as long as the MCP4728.
  DacOutput& channel(int index);

 private:
  class Output : public DacOutput {
   public:
    void init(MCP4728* dev, uint8_t ch) { dev_ = dev; ch_ = ch; }
    uint16_t rawMax() const override { return 4095; }
    bool write(uint16_t raw) override { return dev_->send(ch_, raw); }

   private:
    MCP4728* dev_ = nullptr;
    uint8_t  ch_  = 0;
  };

  bool send(uint8_t ch, uint16_t raw);

  TwoWire* bus_;
  uint8_t  address_;
  Output   outputs_[kChannels];
};

#ifndef ARDUINO
// Test hooks: native builds have no I2C bus, so send() records the last
// frame instead. `ack = false` plays a chip that does not answer.
struct Mcp4728TestState {
  uint8_t  address   = 0;
  uint8_t  frame[3]  = {0, 0, 0};
  uint32_t frames    = 0;
  bool     ack       = true;
};
Mcp4728TestState& mcp4728TestState();
#endif

}  // namespace SensActCtrl
