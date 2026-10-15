#include "PCF8575.h"

#if defined(ARDUINO)
  #include <Arduino.h>
  #include <Wire.h>
#endif

namespace SensActCtrl {

namespace {
uint32_t nowMs() {
#if defined(ARDUINO)
  return millis();
#else
  return pcf8575TestState().nowMs;
#endif
}
}  // namespace

PCF8575::PCF8575(TwoWire& bus, uint8_t i2cAddress)
    : bus_(&bus), address_(i2cAddress) {}

bool PCF8575::begin() {
  std::lock_guard<std::mutex> lock(mutex_);
  uint16_t v = 0;
  if (fetch(v)) {
    latch_ = v;
    return true;
  }
  latch_ = 0xFFFF;
  return false;
}

bool PCF8575::pinMode(uint8_t ch, Mode m) {
  if (ch >= kChannels) return false;
  std::lock_guard<std::mutex> lock(mutex_);
  const uint16_t bit = static_cast<uint16_t>(1u << ch);
  if (m == Mode::Output) inputs_ &= ~bit;
  else inputs_ |= bit;
  return send();
}

bool PCF8575::write(uint8_t ch, bool high) {
  if (ch >= kChannels) return false;
  std::lock_guard<std::mutex> lock(mutex_);
  const uint16_t bit = static_cast<uint16_t>(1u << ch);
  if (high) latch_ |= bit;
  else latch_ &= ~bit;
  return send();
}

bool PCF8575::read(uint8_t ch, bool& high) {
  if (ch >= kChannels) return false;
  std::lock_guard<std::mutex> lock(mutex_);
  const uint32_t now = nowMs();
  if (!pinsFetched_ || now - pinsAtMs_ >= kReadCacheMs) {
    pinsOk_ = fetch(pins_);
    pinsFetched_ = true;
    pinsAtMs_ = now;
  }
  if (!pinsOk_) return false;
  high = (pins_ >> ch) & 1u;
  return true;
}

bool PCF8575::send() {
  const uint16_t word = latch_ | inputs_;
#if defined(ARDUINO)
  // P00..P07 first, then P10..P17.
  const uint8_t frame[2] = {static_cast<uint8_t>(word & 0xFF),
                            static_cast<uint8_t>(word >> 8)};
  bus_->beginTransmission(address_);
  bus_->write(frame, sizeof(frame));
  return bus_->endTransmission() == 0;
#else
  Pcf8575TestState& s = pcf8575TestState();
  s.address = address_;
  s.written = word;
  ++s.writes;
  return s.ack;
#endif
}

bool PCF8575::fetch(uint16_t& v) {
#if defined(ARDUINO)
  if (bus_->requestFrom(address_, static_cast<uint8_t>(2)) != 2) return false;
  const uint8_t lo = bus_->read();
  const uint8_t hi = bus_->read();
  v = static_cast<uint16_t>(lo | (hi << 8));
  return true;
#else
  Pcf8575TestState& s = pcf8575TestState();
  s.address = address_;
  ++s.reads;
  if (!s.ack) return false;
  v = s.pins;
  return true;
#endif
}

#ifndef ARDUINO
Pcf8575TestState& pcf8575TestState() {
  static Pcf8575TestState state;
  return state;
}
#endif

}  // namespace SensActCtrl
