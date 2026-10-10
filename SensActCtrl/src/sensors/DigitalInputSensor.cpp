#include "DigitalInputSensor.h"

#if defined(ARDUINO)
  #include <Arduino.h>
#else
  // Native test build: tests poke digitalinhook::now_ms forward. (Own
  // namespace — test_build_src=yes links every source into each binary.)
  #include <stdint.h>
  namespace SensActCtrl { namespace digitalinhook {
    uint32_t now_ms = 0;
  }}
  static void pinMode(int, int) {}
  static int digitalRead(int) { return 0; }
  static uint32_t millis() { return SensActCtrl::digitalinhook::now_ms; }
  enum { INPUT = 0, INPUT_PULLUP = 2 };
#endif

namespace SensActCtrl {

DigitalInputSensor::DigitalInputSensor(const char* id, int pin, bool pullup,
                                       bool invert, uint32_t debounceMs)
    : id_(id), pin_(pin), pullup_(pullup), invert_(invert),
      debounceMs_(debounceMs) {}

DigitalInputSensor::DigitalInputSensor(const char* id, GpioPort& port, uint8_t ch,
                                       bool pullup, bool invert, uint32_t debounceMs)
    : DigitalInputSensor(id, -1, pullup, invert, debounceMs) {
  port_ = &port;
  ch_ = ch;
}

Channel DigitalInputSensor::channel(size_t) const {
  return {"", SensorMeta{ValueKind::Binary, Quantity::None, "",
                          0.0f, 1.0f, 1.0f}, last_};
}

void DigitalInputSensor::begin() {
  if (port_)
    port_->pinMode(ch_, pullup_ ? GpioPort::Mode::InputPullup : GpioPort::Mode::Input);
  else
    pinMode(pin_, pullup_ ? INPUT_PULLUP : INPUT);
}

void DigitalInputSensor::tick() {
  const uint32_t now = millis();
  int raw = 0;
  if (port_) {
    bool high = false;
    portFault_ = !port_->read(ch_, high);
    if (portFault_) {
      last_.valid = false;
      last_.timestampMs = now;
      return;
    }
    raw = high ? 1 : 0;
  } else {
    raw = digitalRead(pin_);
  }
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
