#include "MCP4728.h"

#if defined(ARDUINO)
  #include <Arduino.h>
  #include <Wire.h>
#endif

namespace SensActCtrl {

MCP4728::MCP4728(TwoWire& bus, uint8_t i2cAddress)
    : bus_(&bus), address_(i2cAddress) {
  for (uint8_t i = 0; i < kChannels; ++i) outputs_[i].init(this, i);
}

DacOutput& MCP4728::channel(int index) {
  if (index < 0 || index >= kChannels) index = 0;
  return outputs_[index];
}

bool MCP4728::send(uint8_t ch, uint16_t raw) {
  if (raw > 4095) raw = 4095;
  // Multi-Write: 0b01000 DAC1 DAC0 UDAC, then VREF PD1 PD0 Gx D11..D8 and
  // D7..D0. VREF = VDD, PD = normal, Gx = x1, UDAC = 0 -> all control bits 0.
  const uint8_t frame[3] = {
      static_cast<uint8_t>(0x40 | (ch << 1)),
      static_cast<uint8_t>((raw >> 8) & 0x0F),
      static_cast<uint8_t>(raw & 0xFF),
  };
#if defined(ARDUINO)
  bus_->beginTransmission(address_);
  bus_->write(frame, sizeof(frame));
  return bus_->endTransmission() == 0;
#else
  Mcp4728TestState& s = mcp4728TestState();
  s.address = address_;
  for (int i = 0; i < 3; ++i) s.frame[i] = frame[i];
  ++s.frames;
  return s.ack;
#endif
}

#ifndef ARDUINO
Mcp4728TestState& mcp4728TestState() {
  static Mcp4728TestState state;
  return state;
}
#endif

}  // namespace SensActCtrl
