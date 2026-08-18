#include "DigitalOutputActuator.h"

#if defined(ARDUINO)
  #include <Arduino.h>
#else
  // Native test build: thin pin/clock surface so the actuator can be driven
  // deterministically. Tests poke digitalouthook::now_ms forward and assert
  // on last_level. (Own namespace — PulseOutputActuator has its own set, and
  // test_build_src=yes links every source into each test binary.)
  #include <stdint.h>
  namespace SensActCtrl { namespace digitalouthook {
    uint32_t now_ms = 0;
    int last_pin = -1;
    int last_level = 0;
    void reset() { now_ms = 0; last_pin = -1; last_level = 0; }
  }}
  enum { OUTPUT = 1, HIGH = 1, LOW = 0 };
  static void pinMode(int, int) {}
  static void digitalWrite(int p, int v) {
    SensActCtrl::digitalouthook::last_pin = p;
    SensActCtrl::digitalouthook::last_level = v;
  }
  static uint32_t millis() { return SensActCtrl::digitalouthook::now_ms; }
#endif

namespace SensActCtrl {

DigitalOutputActuator::DigitalOutputActuator(const char* id, int pin,
                                             Mode mode, bool activeHigh)
    : id_(id), pin_(pin), mode_(mode), activeHigh_(activeHigh) {
  if (mode_ == Mode::Binary) {
    // The master switch is the on/off control here, so the value is fixed at
    // "on" and the actuator starts disabled — a boot must not close a relay.
    state_ = 1.0f;
    enabled_ = false;
  }
}

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

void DigitalOutputActuator::applyEnabled(bool e) {
  if (mode_ == Mode::Binary) {
    applyPin(state_ != 0.0f);  // write()-driven: nothing else would re-apply
    return;
  }
  // TimeProportional recomputes the pin on every tick(), so enabling needs no
  // action here — driving state_ (a duty, not a level) would glitch it fully
  // on. Disabling is forced immediately rather than waiting for the tick.
  if (!e) applyPin(false);
}

void DigitalOutputActuator::applyPin(bool on) {
  // Single choke point for the whole class — gating here covers Binary
  // (write-driven) and TimeProportional (tick-driven) alike.
  if (!enabled_) on = false;
  const int level = (on == activeHigh_) ? HIGH : LOW;
  digitalWrite(pin_, level);
}

}  // namespace SensActCtrl
