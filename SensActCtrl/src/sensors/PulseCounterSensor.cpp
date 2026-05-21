#include "PulseCounterSensor.h"

#if defined(ARDUINO)
  #include <Arduino.h>
#else
  static void pinMode(int, int) {}
  static int digitalPinToInterrupt(int p) { return p; }
  static void attachInterrupt(int, void (*)(), int) {}
  static uint32_t millis() { return 0; }
  enum { INPUT = 0, INPUT_PULLUP = 2, RISING = 1, FALLING = 2, CHANGE = 3 };
#endif

namespace SensActCtrl {

PulseCounterSensor* PulseCounterSensor::instances_[kMaxInstances] = {nullptr};
int PulseCounterSensor::instanceCount_ = 0;

// ISR trampolines: 8 distinct entry points dispatch into the matching
// instance, since attachInterrupt cannot take a member-function pointer.
void PulseCounterSensor::isrTrampoline0() { if (instances_[0]) instances_[0]->onEdge(); }
void PulseCounterSensor::isrTrampoline1() { if (instances_[1]) instances_[1]->onEdge(); }
void PulseCounterSensor::isrTrampoline2() { if (instances_[2]) instances_[2]->onEdge(); }
void PulseCounterSensor::isrTrampoline3() { if (instances_[3]) instances_[3]->onEdge(); }
void PulseCounterSensor::isrTrampoline4() { if (instances_[4]) instances_[4]->onEdge(); }
void PulseCounterSensor::isrTrampoline5() { if (instances_[5]) instances_[5]->onEdge(); }
void PulseCounterSensor::isrTrampoline6() { if (instances_[6]) instances_[6]->onEdge(); }
void PulseCounterSensor::isrTrampoline7() { if (instances_[7]) instances_[7]->onEdge(); }

void (*PulseCounterSensor::trampolineFor(int idx))() {
  switch (idx) {
    case 0: return &isrTrampoline0;
    case 1: return &isrTrampoline1;
    case 2: return &isrTrampoline2;
    case 3: return &isrTrampoline3;
    case 4: return &isrTrampoline4;
    case 5: return &isrTrampoline5;
    case 6: return &isrTrampoline6;
    case 7: return &isrTrampoline7;
  }
  return nullptr;
}

PulseCounterSensor::PulseCounterSensor(const char* id, int pin, Mode mode,
                                       Edge edge)
    : id_(id), pin_(pin), mode_(mode), edge_(edge) {
  if (mode_ == Mode::Total) {
    meta_.kind = ValueKind::Cumulative;
    meta_.quantity = Quantity::Count;
  } else {
    meta_.kind = ValueKind::Continuous;
    meta_.quantity = Quantity::Frequency;
    meta_.unit = "Hz";
  }
}

void PulseCounterSensor::setPulsesPerUnit(float pulsesPerUnit) {
  if (pulsesPerUnit > 0.0f) pulsesPerUnit_ = pulsesPerUnit;
}

void PulseCounterSensor::setMeta(Quantity q, const char* unit, float maxPhys,
                                 float resolution) {
  meta_.quantity = q;
  meta_.unit = unit;
  meta_.max = maxPhys;
  meta_.resolution = resolution;
}

uint32_t PulseCounterSensor::rawCount() const { return pulseCount_; }

void PulseCounterSensor::onEdge() { ++pulseCount_; }

void PulseCounterSensor::injectPulseForTest() { onEdge(); }

void PulseCounterSensor::begin() {
  pinMode(pin_, INPUT_PULLUP);
  if (instanceCount_ < kMaxInstances) {
    instanceIdx_ = instanceCount_;
    instances_[instanceIdx_] = this;
    ++instanceCount_;
    int edge = RISING;
    switch (edge_) {
      case Edge::Rising:  edge = RISING; break;
      case Edge::Falling: edge = FALLING; break;
      case Edge::Change:  edge = CHANGE; break;
    }
    auto* trampoline = trampolineFor(instanceIdx_);
    if (trampoline) {
      attachInterrupt(digitalPinToInterrupt(pin_), trampoline, edge);
    }
  }
  lastWindowMs_ = millis();
  lastWindowCount_ = pulseCount_;
}

void PulseCounterSensor::tick() {
  const uint32_t now = millis();
  const uint32_t snapshot = pulseCount_;

  if (mode_ == Mode::Total) {
    last_.value = static_cast<float>(snapshot) / pulsesPerUnit_;
  } else {
    // Rate: pulses per windowMs_ scaled to per-second, divided by pulsesPerUnit.
    const uint32_t elapsed = now - lastWindowMs_;
    if (elapsed >= windowMs_) {
      const uint32_t delta = snapshot - lastWindowCount_;
      const float perSec = (elapsed > 0)
          ? (static_cast<float>(delta) * 1000.0f / static_cast<float>(elapsed))
          : 0.0f;
      last_.value = perSec / pulsesPerUnit_;
      lastWindowMs_ = now;
      lastWindowCount_ = snapshot;
    }
  }
  last_.valid = true;
  last_.timestampMs = now;
}

}  // namespace SensActCtrl
