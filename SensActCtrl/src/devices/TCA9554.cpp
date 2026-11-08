#include "TCA9554.h"

#if defined(ARDUINO)
  #include <Arduino.h>
  #include <Wire.h>
#endif

namespace SensActCtrl {

namespace {
constexpr uint8_t kRegInput  = 0x00;
constexpr uint8_t kRegOutput = 0x01;
constexpr uint8_t kRegConfig = 0x03;

uint32_t nowMs() {
#if defined(ARDUINO)
  return millis();
#else
  return tca9554TestState().nowMs;
#endif
}
}  // namespace

TCA9554::TCA9554(TwoWire& bus, uint8_t i2cAddress)
    : bus_(&bus), address_(i2cAddress) {}

bool TCA9554::begin() {
  std::lock_guard<std::mutex> lock(mutex_);
  uint8_t out = 0, cfg = 0;
  if (readReg(kRegOutput, out) && readReg(kRegConfig, cfg)) {
    out_ = out;
    config_ = cfg;
    return true;
  }
  out_ = 0xFF;
  config_ = 0xFF;
  return false;
}

bool TCA9554::pinMode(uint8_t ch, Mode m) {
  if (ch >= kChannels) return false;
  std::lock_guard<std::mutex> lock(mutex_);
  const uint8_t bit = static_cast<uint8_t>(1u << ch);
  if (m == Mode::Output) config_ &= ~bit;
  else config_ |= bit;
  return writeReg(kRegConfig, config_);
}

bool TCA9554::write(uint8_t ch, bool high) {
  if (ch >= kChannels) return false;
  std::lock_guard<std::mutex> lock(mutex_);
  const uint8_t bit = static_cast<uint8_t>(1u << ch);
  if (high) out_ |= bit;
  else out_ &= ~bit;
  return writeReg(kRegOutput, out_);
}

bool TCA9554::read(uint8_t ch, bool& high) {
  if (ch >= kChannels) return false;
  std::lock_guard<std::mutex> lock(mutex_);
  const uint32_t now = nowMs();
  if (!pinsFetched_ || now - pinsAtMs_ >= kReadCacheMs) {
    pinsOk_ = readReg(kRegInput, pins_);
    pinsFetched_ = true;
    pinsAtMs_ = now;
  }
  if (!pinsOk_) return false;
  high = (pins_ >> ch) & 1u;
  return true;
}

bool TCA9554::writeReg(uint8_t reg, uint8_t value) {
#if defined(ARDUINO)
  bus_->beginTransmission(address_);
  bus_->write(reg);
  bus_->write(value);
  return bus_->endTransmission() == 0;
#else
  Tca9554TestState& s = tca9554TestState();
  s.address = address_;
  ++s.writes;
  if (!s.ack) return false;
  if (reg == kRegOutput) s.output = value;
  else if (reg == kRegConfig) s.config = value;
  return true;
#endif
}

bool TCA9554::readReg(uint8_t reg, uint8_t& value) {
#if defined(ARDUINO)
  bus_->beginTransmission(address_);
  bus_->write(reg);
  if (bus_->endTransmission(false) != 0) return false;
  if (bus_->requestFrom(address_, static_cast<uint8_t>(1)) != 1) return false;
  value = bus_->read();
  return true;
#else
  Tca9554TestState& s = tca9554TestState();
  s.address = address_;
  ++s.reads;
  if (!s.ack) return false;
  if (reg == kRegInput) value = s.pins;
  else if (reg == kRegOutput) value = s.output;
  else value = s.config;
  return true;
#endif
}

#ifndef ARDUINO
Tca9554TestState& tca9554TestState() {
  static Tca9554TestState state;
  return state;
}
#endif

}  // namespace SensActCtrl
