// SensActCtrl/src/sensors/YF_S201Sensor.cpp
#include "YF_S201Sensor.h"

#if defined(ARDUINO)
  #include <Arduino.h>
#else
  #include <stdint.h>
  static void     pinMode(int, int) {}
  static int      digitalPinToInterrupt(int p) { return p; }
  static void     attachInterrupt(int, void(*)(), int) {}
  static uint32_t millis() { return 0; }
  enum { INPUT_PULLUP = 2, RISING = 1 };
#endif

namespace SensActCtrl {

// ── Static data ──────────────────────────────────────────────────────────────

YF_S201Sensor::PinState YF_S201Sensor::pinStates_[kMaxPins] = {};
int                     YF_S201Sensor::pinStateCount_        = 0;

// ── ISR trampolines (one per physical-pin slot) ──────────────────────────────

void YF_S201Sensor::isr0() { onEdge(0); }
void YF_S201Sensor::isr1() { onEdge(1); }
void YF_S201Sensor::isr2() { onEdge(2); }
void YF_S201Sensor::isr3() { onEdge(3); }

void YF_S201Sensor::onEdge(int idx) { ++pinStates_[idx].count; }

void (*YF_S201Sensor::isrFor(int idx))() {
  switch (idx) {
    case 0: return &isr0;
    case 1: return &isr1;
    case 2: return &isr2;
    case 3: return &isr3;
  }
  return nullptr;
}

// ── Constructor ──────────────────────────────────────────────────────────────

YF_S201Sensor::YF_S201Sensor(const char* id, int pin)
    : id_(id), pin_(pin) {}

// ── begin() ──────────────────────────────────────────────────────────────────

void YF_S201Sensor::begin() {
  // Reuse an existing slot if this pin is already registered.
  for (int i = 0; i < pinStateCount_; ++i) {
    if (pinStates_[i].pin == pin_) {
      pinIdx_          = i;
      ownsIsr_         = false;
      volumeBaseCount_ = pinStates_[i].count;
      lastWindowMs_    = millis();
      lastWindowCount_ = pinStates_[i].count;
      return;
    }
  }
  if (pinStateCount_ >= kMaxPins) return;  // no slot available
  pinIdx_                   = pinStateCount_++;
  pinStates_[pinIdx_].pin   = pin_;
  pinStates_[pinIdx_].count = 0;
  ownsIsr_                  = true;
  volumeBaseCount_           = 0;
  lastWindowMs_              = millis();
  lastWindowCount_           = 0;
  pinMode(pin_, INPUT_PULLUP);
  auto* isr = isrFor(pinIdx_);
  if (isr) attachInterrupt(digitalPinToInterrupt(pin_), isr, RISING);
}

// ── tick() ───────────────────────────────────────────────────────────────────

void YF_S201Sensor::tick() {
  if (pinIdx_ < 0) return;

  const uint32_t now   = millis();
  const uint32_t count = pinStates_[pinIdx_].count;

  // Rate: update once per window.
  const uint32_t elapsed = now - lastWindowMs_;
  if (elapsed >= kWindowMs) {
    const uint32_t delta = count - lastWindowCount_;
    const float hz = (elapsed > 0)
        ? static_cast<float>(delta) * 1000.0f / static_cast<float>(elapsed)
        : 0.0f;
    rateReading_.value       = hz / hzPerLPerMin_;
    rateReading_.valid       = true;
    rateReading_.timestampMs = now;
    lastWindowMs_            = now;
    lastWindowCount_         = count;
  }

  // Volume: always update (does not depend on elapsed time).
  const float pulsesPerLitre = hzPerLPerMin_ * 60.0f;
  const uint32_t accum       = count - volumeBaseCount_;
  volReading_.value          = static_cast<float>(accum) / pulsesPerLitre;
  volReading_.valid          = true;
  volReading_.timestampMs    = now;
}

// ── channel() ────────────────────────────────────────────────────────────────

Channel YF_S201Sensor::channel(size_t idx) const {
  if (idx == 0) {
    return {"rate",
            SensorMeta{ValueKind::Continuous, Quantity::FlowRate,
                       "L/min", 0.0f, 120.0f, 0.1f},
            rateReading_};
  }
  return {"volume",
          SensorMeta{ValueKind::Cumulative, Quantity::Volume,
                     "L", 0.0f, 100000.0f, 0.01f},
          volReading_};
}

// ── Helpers ──────────────────────────────────────────────────────────────────

void YF_S201Sensor::setCalibration(float hzPerLiterPerMin) {
  if (hzPerLiterPerMin > 0.0f) hzPerLPerMin_ = hzPerLiterPerMin;
}

void YF_S201Sensor::resetVolume() {
  if (pinIdx_ >= 0) volumeBaseCount_ = pinStates_[pinIdx_].count;
}

uint32_t YF_S201Sensor::rawCount() const {
  return (pinIdx_ >= 0) ? pinStates_[pinIdx_].count : 0;
}

void YF_S201Sensor::injectPulseForTest() {
  if (pinIdx_ >= 0) ++pinStates_[pinIdx_].count;
}

#ifndef ARDUINO
void YF_S201Sensor::resetForTest() {
  pinStateCount_ = 0;
  for (auto& ps : pinStates_) { ps.pin = -1; ps.count = 0; }
}
#endif

}  // namespace SensActCtrl
