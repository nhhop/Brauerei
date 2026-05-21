#include "MAX31865Sensor.h"

#include <stdint.h>

#if defined(ARDUINO)
  #include <Arduino.h>
  #include <Adafruit_MAX31865.h>
#else
  // Native-Stub: nur Kompilierung sicherstellen, kein Hardware-Zugriff.
  #include <math.h>   // NAN
  typedef enum { MAX31865_2WIRE = 2, MAX31865_3WIRE = 3, MAX31865_4WIRE = 4 }
      max31865_numwires_t;
  class Adafruit_MAX31865 {
   public:
    explicit Adafruit_MAX31865(int8_t) {}
    Adafruit_MAX31865(int8_t, int8_t, int8_t, int8_t) {}
    void    begin(max31865_numwires_t) {}
    float   temperature(float, float) { return 0.0f; }
    uint8_t readFault() { return 0; }
    void    clearFault() {}
  };
  static uint32_t millis() { return 0; }
#endif

namespace SensActCtrl {

// ── Constructors ──────────────────────────────────────────────────────────

MAX31865Sensor::MAX31865Sensor(const char* id, int csPin,
                                Wires wires, RtdType rtd, float rref)
    : id_(id), csPin_(csPin), wires_(wires), rtd_(rtd), rref_(rref) {}

MAX31865Sensor::MAX31865Sensor(const char* id, int csPin,
                                int clkPin, int misoPin, int mosiPin,
                                Wires wires, RtdType rtd, float rref)
    : id_(id), csPin_(csPin),
      clkPin_(clkPin), misoPin_(misoPin), mosiPin_(mosiPin),
      wires_(wires), rtd_(rtd), rref_(rref) {}

MAX31865Sensor::~MAX31865Sensor() { delete max_; }

// ── SensorMeta ────────────────────────────────────────────────────────────

SensorMeta MAX31865Sensor::meta() const {
  // PT100 and PT1000 share the same temperature range (-200..850 °C).
  // Resolution: 15-bit ADC → ~0.03125 °C per LSB.
  return SensorMeta{ValueKind::Continuous, Quantity::Temperature,
                    "\xc2\xb0""C", -200.0f, 850.0f, 0.03125f};
}

// ── begin / tick ──────────────────────────────────────────────────────────

void MAX31865Sensor::begin() {
#if defined(ARDUINO)
  if (clkPin_ >= 0) {
    // Adafruit SW-SPI constructor: (cs, mosi, miso, clk)
    max_ = new Adafruit_MAX31865(
        static_cast<int8_t>(csPin_),
        static_cast<int8_t>(mosiPin_),
        static_cast<int8_t>(misoPin_),
        static_cast<int8_t>(clkPin_));
  } else {
    max_ = new Adafruit_MAX31865(static_cast<int8_t>(csPin_));
  }
  const max31865_numwires_t w =
      wires_ == Wires::Three ? MAX31865_3WIRE :
      wires_ == Wires::Four  ? MAX31865_4WIRE : MAX31865_2WIRE;
  max_->begin(w);
#endif
}

void MAX31865Sensor::tick() {
#if defined(ARDUINO)
  if (!max_) return;
  const float rnominal = (rtd_ == RtdType::PT1000) ? 1000.0f : 100.0f;
  const float t = max_->temperature(rnominal, rref_);
  const uint8_t fault = max_->readFault();
  const uint32_t now = millis();
  if (fault) {
    max_->clearFault();
    last_.value = 0.0f;
    last_.timestampMs = now;
    last_.valid = false;
  } else {
    last_.value = t;
    last_.timestampMs = now;
    last_.valid = true;
  }
#endif
}

}  // namespace SensActCtrl
