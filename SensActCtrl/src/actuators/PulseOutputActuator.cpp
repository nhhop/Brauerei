#include "PulseOutputActuator.h"

#if defined(ARDUINO)
  #include <Arduino.h>
#else
  // Native test build: thin pin/clock surface so the actuator can be driven
  // deterministically. Tests poke nativehook::now_ms forward and assert on
  // nativehook::high_edges + last_level.
  #include <stdint.h>
  namespace SensActCtrl { namespace nativehook {
    uint32_t now_ms = 0;
    int last_pin = -1;
    int last_level = 0;
    int high_edges = 0;
    void reset() { now_ms = 0; last_pin = -1; last_level = 0; high_edges = 0; }
  }}
  enum { OUTPUT = 1, HIGH = 1, LOW = 0 };
  static void pinMode(int, int) {}
  static void digitalWrite(int p, int v) {
    using namespace SensActCtrl::nativehook;
    if (v == HIGH && last_level != HIGH) ++high_edges;
    last_pin = p;
    last_level = v;
  }
  static uint32_t millis() { return SensActCtrl::nativehook::now_ms; }
#endif

namespace SensActCtrl {

PulseOutputActuator::PulseOutputActuator(const char* id, int pin,
                                         uint32_t pulseWidthMs, uint32_t gapMs,
                                         bool activeHigh)
    : id_(id), pin_(pin),
      pulseWidthMs_(pulseWidthMs), gapMs_(gapMs),
      activeHigh_(activeHigh) {}

ActuatorMeta PulseOutputActuator::meta() const {
  return ActuatorMeta{ValueKind::Discrete, quantity_, unit_,
                      0.0f, 4294967295.0f, 1.0f};
}

void PulseOutputActuator::begin() {
  pinMode(pin_, OUTPUT);
  setPin(false);
}

void PulseOutputActuator::write(float v) {
  if (v <= 0.0f) return;
  uint32_t n = static_cast<uint32_t>(v + 0.5f);
  remaining_ += n;
}

void PulseOutputActuator::tick() {
  const uint32_t now = millis();

  switch (phase_) {
    case Phase::Idle:
      if (remaining_ > 0) {
        setPin(true);
        phase_ = Phase::PulseHigh;
        phaseStartMs_ = now;
      }
      break;
    case Phase::PulseHigh:
      if (now - phaseStartMs_ >= pulseWidthMs_) {
        setPin(false);
        phase_ = Phase::PulseLow;
        phaseStartMs_ = now;
        if (remaining_ > 0) --remaining_;
      }
      break;
    case Phase::PulseLow:
      if (now - phaseStartMs_ >= gapMs_) {
        if (remaining_ > 0) {
          setPin(true);
          phase_ = Phase::PulseHigh;
          phaseStartMs_ = now;
        } else {
          phase_ = Phase::Idle;
        }
      }
      break;
  }
}

void PulseOutputActuator::setPin(bool on) {
  const int level = (on == activeHigh_) ? HIGH : LOW;
  digitalWrite(pin_, level);
}

}  // namespace SensActCtrl
