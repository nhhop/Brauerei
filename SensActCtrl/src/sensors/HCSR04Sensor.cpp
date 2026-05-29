// SensActCtrl/src/sensors/HCSR04Sensor.cpp
#include "HCSR04Sensor.h"
#include <string.h>

#if defined(ARDUINO)
  #include <Arduino.h>
#else
  #include <stdint.h>
  static void     pinMode(int, int) {}
  static void     digitalWrite(int, int) {}
  static int      digitalRead(int) { return 0; }
  static void     delayMicroseconds(unsigned int) {}
  static void     attachInterrupt(int, void(*)(), int) {}
  static int      digitalPinToInterrupt(int p) { return p; }
  static uint32_t g_micros = 0;
  static uint32_t g_millis = 0;
  static uint32_t micros() { return g_micros; }
  static uint32_t millis() { return g_millis; }
  enum { INPUT = 0, OUTPUT = 1, HIGH = 1, LOW = 0, CHANGE = 3 };
#endif

namespace SensActCtrl {

// ── Static data ──────────────────────────────────────────────────────────────

HCSR04Sensor* HCSR04Sensor::instances_[kMaxSensors] = {};
int           HCSR04Sensor::instanceCount_           = 0;

// ── ISR trampolines ──────────────────────────────────────────────────────────

void HCSR04Sensor::isr0() { onEcho(0); }
void HCSR04Sensor::isr1() { onEcho(1); }
void HCSR04Sensor::isr2() { onEcho(2); }
void HCSR04Sensor::isr3() { onEcho(3); }

void (*HCSR04Sensor::isrFor(int idx))() {
  switch (idx) {
    case 0: return &isr0;
    case 1: return &isr1;
    case 2: return &isr2;
    case 3: return &isr3;
  }
  return nullptr;
}

// ── ISR handler (interrupt context on Arduino) ───────────────────────────────

void HCSR04Sensor::onEcho(int idx) {
  auto* self = instances_[idx];
  if (!self) return;
  if (digitalRead(self->echoPin_) == HIGH) {
    if (self->state_ == State::Triggered) {
      self->startUs_ = micros();
      self->state_   = State::Measuring;
    }
  } else {
    if (self->state_ == State::Measuring) {
      self->durationUs_ = micros() - self->startUs_;
      self->state_      = State::Done;
    }
  }
}

// ── Constructor ──────────────────────────────────────────────────────────────

HCSR04Sensor::HCSR04Sensor(const char* id, int trigPin, int echoPin)
    : id_(id), trigPin_(trigPin), echoPin_(echoPin) {}

// ── begin() ──────────────────────────────────────────────────────────────────

void HCSR04Sensor::begin() {
  if (instanceCount_ >= kMaxSensors) return;
  slotIdx_             = instanceCount_++;
  instances_[slotIdx_] = this;
  lastTriggerMs_       = millis();
  pinMode(trigPin_, OUTPUT);
  digitalWrite(trigPin_, LOW);
  pinMode(echoPin_, INPUT);
  auto* isr = isrFor(slotIdx_);
  if (isr) attachInterrupt(digitalPinToInterrupt(echoPin_), isr, CHANGE);
}

// ── tick() ───────────────────────────────────────────────────────────────────

void HCSR04Sensor::tick() {
  if (slotIdx_ < 0) return;

  const uint32_t now = millis();

  // Safe on single-core ESP32: ISR cannot preempt between these two reads.
  // A dual-core port would need noInterrupts()/interrupts() around the snapshot.
  if (state_ == State::Done) {
    const float dist         = static_cast<float>(durationUs_) / 58.0f;
    distReading_.value       = dist;
    distReading_.valid       = true;
    distReading_.timestampMs = now;
    if (hasScale_) {
      derivedReading_.value       = dist * scaleFactor_ + scaleOffset_;
      derivedReading_.valid       = true;
      derivedReading_.timestampMs = now;
    }
    state_         = State::Idle;
    lastTriggerMs_ = now;
    return;
  }

  if ((state_ == State::Triggered || state_ == State::Measuring) &&
      (now - triggerMs_ > kTimeoutMs)) {
    distReading_.valid = false;
    if (hasScale_) derivedReading_.valid = false;
    state_         = State::Idle;
    lastTriggerMs_ = now;
    return;
  }

  if (state_ == State::Idle && (now - lastTriggerMs_ >= kIntervalMs)) {
    triggerMs_ = now;
    state_     = State::Triggered;
    digitalWrite(trigPin_, HIGH);
    delayMicroseconds(10);
    digitalWrite(trigPin_, LOW);
  }
}

// ── channel() ────────────────────────────────────────────────────────────────

Channel HCSR04Sensor::channel(size_t idx) const {
  if (idx == 0) {
    return {"distance",
            SensorMeta{ValueKind::Continuous, Quantity::Distance,
                       "cm", 2.0f, 400.0f, 0.1f},
            distReading_};
  }
  return {"derived",
          SensorMeta{ValueKind::Continuous, Quantity::Custom,
                     hasScale_ ? scaleUnit_ : "", 0.0f, 0.0f, 0.0f},
          derivedReading_};
}

// ── setScale() ───────────────────────────────────────────────────────────────

void HCSR04Sensor::setScale(float factor, float offset, const char* unit) {
  scaleFactor_ = factor;
  scaleOffset_ = offset;
  strncpy(scaleUnit_, unit ? unit : "", 15);
  scaleUnit_[15] = '\0';
  hasScale_      = true;
}

// ── Test helpers ─────────────────────────────────────────────────────────────

void HCSR04Sensor::injectEchoForTest(uint32_t durationUs) {
  durationUs_ = durationUs;
  state_      = State::Done;
}

#ifndef ARDUINO
void HCSR04Sensor::resetForTest() {
  instanceCount_ = 0;
  for (auto& p : instances_) p = nullptr;
  g_micros = 0;
  g_millis = 0;
}

void HCSR04Sensor::advanceMillisForTest(uint32_t ms) {
  g_millis += ms;
}
#endif

}  // namespace SensActCtrl
