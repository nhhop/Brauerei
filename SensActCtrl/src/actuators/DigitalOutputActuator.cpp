#include "DigitalOutputActuator.h"

#if defined(ARDUINO)
  #include <Arduino.h>
#else
  // Native test build: stub pin I/O.
  static void pinMode(int, int) {}
  static void digitalWrite(int, int) {}
  static uint32_t millis() { static uint32_t t = 0; t += 10; return t; }
  enum { OUTPUT = 1, HIGH = 1, LOW = 0 };
#endif

namespace SensActCtrl {

DigitalOutputActuator::DigitalOutputActuator(const char* id, int pin,
                                             Mode mode, bool activeHigh)
    : id_(id), pin_(pin), mode_(mode), activeHigh_(activeHigh) {}

ActuatorMeta DigitalOutputActuator::meta() const {
  if (mode_ == Mode::Binary) {
    return ActuatorMeta{ValueKind::Binary, Quantity::None, "",
                        0.0f, 1.0f, 1.0f};
  }
  return ActuatorMeta{ValueKind::Continuous, Quantity::DutyCycle, "",
                      0.0f, 1.0f, 0.01f};
}

void DigitalOutputActuator::end() {
  applyPin(false);  // drive output to safe (off) state
  state_ = 0.0f;
}

void DigitalOutputActuator::begin() {
  pinMode(pin_, OUTPUT);
  applyPin(false);
  cycleStartMs_ = millis();
}

void DigitalOutputActuator::write(float v) {
  if (mode_ == Mode::Binary) {
    state_ = (v != 0.0f) ? 1.0f : 0.0f;
    applyPin(state_ != 0.0f);
    return;
  }
  // TimeProportional: clamp to [0,1]; tick() drives the pin.
  if (v < 0.0f) v = 0.0f;
  if (v > 1.0f) v = 1.0f;
  state_ = v;
}

void DigitalOutputActuator::tick() {
  if (mode_ == Mode::Binary) return;
  const uint32_t now = millis();
  const uint32_t elapsed = now - cycleStartMs_;
  if (elapsed >= periodMs_) {
    cycleStartMs_ = now;  // start a new cycle
  }
  const uint32_t onMs = static_cast<uint32_t>(state_ * periodMs_);
  const bool on = (now - cycleStartMs_) < onMs;
  applyPin(on);
}

void DigitalOutputActuator::applyPin(bool on) {
  const int level = (on == activeHigh_) ? HIGH : LOW;
  digitalWrite(pin_, level);
}

}  // namespace SensActCtrl
