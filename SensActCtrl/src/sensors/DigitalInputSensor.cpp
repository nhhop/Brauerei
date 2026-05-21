#include "DigitalInputSensor.h"

#if defined(ARDUINO)
  #include <Arduino.h>
#else
  static void pinMode(int, int) {}
  static int digitalRead(int) { return 0; }
  static uint32_t millis() { return 0; }
  enum { INPUT = 0, INPUT_PULLUP = 2 };
#endif

namespace SensActCtrl {

DigitalInputSensor::DigitalInputSensor(const char* id, int pin, bool pullup,
                                       bool invert, uint32_t debounceMs)
    : id_(id), pin_(pin), pullup_(pullup), invert_(invert),
      debounceMs_(debounceMs) {}

Channel DigitalInputSensor::channel(size_t) const {
  return {"", SensorMeta{ValueKind::Binary, Quantity::None, "",
                          0.0f, 1.0f, 1.0f}, last_};
}

void DigitalInputSensor::begin() {
  pinMode(pin_, pullup_ ? INPUT_PULLUP : INPUT);
}

void DigitalInputSensor::tick() {
  const uint32_t now = millis();
  const int raw = digitalRead(pin_);
  bool readState = invert_ ? (raw == 0) : (raw != 0);

  if (debounceMs_ == 0) {
    stableState_ = readState;
  } else {
    if (readState != candidateState_) {
      candidateState_ = readState;
      lastFlipMs_ = now;
    } else if (readState != stableState_ &&
               (now - lastFlipMs_) >= debounceMs_) {
      stableState_ = readState;
    }
  }

  last_.value = stableState_ ? 1.0f : 0.0f;
  last_.valid = true;
  last_.timestampMs = now;
}

}  // namespace SensActCtrl
