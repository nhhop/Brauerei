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

HCSR04Sensor* HCSR04Sensor::instances_[kMaxSensors] = {};
int           HCSR04Sensor::instanceCount_           = 0;

void HCSR04Sensor::isr0() {}
void HCSR04Sensor::isr1() {}
void HCSR04Sensor::isr2() {}
void HCSR04Sensor::isr3() {}

void (*HCSR04Sensor::isrFor(int idx))() {
  (void)idx;
  return nullptr;
}

void HCSR04Sensor::onEcho(int) {}

HCSR04Sensor::HCSR04Sensor(const char* id, int trigPin, int echoPin)
    : id_(id), trigPin_(trigPin), echoPin_(echoPin) {}

void HCSR04Sensor::begin() {}

void HCSR04Sensor::tick() {}

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

void HCSR04Sensor::setScale(float factor, float offset, const char* unit) {
  scaleFactor_ = factor;
  scaleOffset_ = offset;
  strncpy(scaleUnit_, unit ? unit : "", 15);
  scaleUnit_[15] = '\0';
  hasScale_      = true;
}

void HCSR04Sensor::injectEchoForTest(uint32_t) {}

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
