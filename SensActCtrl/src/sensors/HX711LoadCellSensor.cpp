#include "HX711LoadCellSensor.h"

#if defined(ARDUINO)
  #include <Arduino.h>
#else
  #include <stdint.h>
  static void    pinMode(int, int) {}
  static void    digitalWrite(int, int) {}
  static int     digitalRead(int) { return 1; }  // HIGH = not ready by default
  static void    delayMicroseconds(unsigned int) {}
  static uint32_t g_millis_hx711 = 0;
  static uint32_t millis() { return g_millis_hx711; }
  enum { INPUT = 0, OUTPUT = 1, HIGH = 1, LOW = 0 };
#endif

namespace SensActCtrl {

HX711LoadCellSensor::HX711LoadCellSensor(const char* id, int doutPin, int sckPin)
    : id_(id), doutPin_(doutPin), sckPin_(sckPin) {}

void HX711LoadCellSensor::begin() {
    pinMode(doutPin_, INPUT);
    pinMode(sckPin_,  OUTPUT);
    digitalWrite(sckPin_, LOW);
}

// Read 24-bit two's-complement value from HX711, then send 1 gain pulse (gain 128).
int32_t HX711LoadCellSensor::readRaw() {
    int32_t raw = 0;
    for (int i = 0; i < 24; ++i) {
        digitalWrite(sckPin_, HIGH);
        delayMicroseconds(1);
        raw = (raw << 1) | (digitalRead(doutPin_) ? 1 : 0);
        digitalWrite(sckPin_, LOW);
        delayMicroseconds(1);
    }
    // 25th pulse sets gain to 128 for next conversion.
    digitalWrite(sckPin_, HIGH);
    delayMicroseconds(1);
    digitalWrite(sckPin_, LOW);
    delayMicroseconds(1);
    // Sign-extend from 24 bits.
    if (raw & 0x800000) raw |= static_cast<int32_t>(0xFF000000);
    return raw;
}

void HX711LoadCellSensor::tick() {
#ifndef ARDUINO
    if (injected_) {
        lastRaw_         = injectedRaw_;
        reading_.value   = rawToMass(lastRaw_);
        reading_.valid   = true;
        reading_.timestampMs = millis();
        injected_ = false;
    }
#else
    if (digitalRead(doutPin_) != LOW) return;  // not ready
    lastRaw_             = readRaw();
    reading_.value       = rawToMass(lastRaw_);
    reading_.valid       = true;
    reading_.timestampMs = millis();
#endif
}

Channel HX711LoadCellSensor::channel(size_t) const {
    return {"mass",
            SensorMeta{ValueKind::Continuous, Quantity::Mass, "g", 0.0f, 5000.0f, 0.1f},
            reading_};
}

float HX711LoadCellSensor::rawToMass(int32_t raw) const {
    return static_cast<float>(raw - offset_) * scale_;
}

void HX711LoadCellSensor::setScale(float gPerCount) { scale_  = gPerCount; }
void HX711LoadCellSensor::setOffset(int32_t offset) { offset_ = offset;    }

void HX711LoadCellSensor::tare() {
    offset_ = lastRaw_;
}

#ifndef ARDUINO
void HX711LoadCellSensor::injectRawForTest(int32_t raw) {
    injected_    = true;
    injectedRaw_ = raw;
}
#endif

}  // namespace SensActCtrl
