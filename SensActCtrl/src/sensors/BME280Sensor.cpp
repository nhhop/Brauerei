#include "BME280Sensor.h"

#include <math.h>

#if defined(ARDUINO)
  #include <Arduino.h>
  #include <Wire.h>
  #include <Adafruit_BME280.h>
#else
  // Native build stub: BME280 is hardware-only. The two globals let tests
  // play "module plugged in / pulled" and advance the clock.
  #include <stdint.h>
  namespace SensActCtrlTest {
  bool     bme280Present = true;
  uint32_t bme280NowMs   = 0;
  }
  static uint32_t millis() { return SensActCtrlTest::bme280NowMs; }
  class TwoWire {};
  class Adafruit_BME280 {
   public:
    bool begin(uint8_t = 0x76) { return SensActCtrlTest::bme280Present; }
    bool begin(uint8_t, TwoWire*) { return SensActCtrlTest::bme280Present; }
    float readTemperature() { return 25.0f; }
    float readHumidity() { return 50.0f; }
    float readPressure() { return 101325.0f; }
  };
#endif

namespace SensActCtrl {

BME280Sensor::BME280Sensor(const char* id, uint8_t i2cAddress)
    : id_(id), address_(i2cAddress) {}

BME280Sensor::BME280Sensor(const char* id, TwoWire& bus, uint8_t i2cAddress)
    : id_(id), address_(i2cAddress), bus_(&bus) {}

BME280Sensor::~BME280Sensor() { delete dev_; }

// Adafruit_BME280's read functions ignore I2C errors (they decode an
// uninitialised buffer), so a pulled module can only be told apart by probing
// the address ourselves.
bool BME280Sensor::devicePresent() const {
#if defined(ARDUINO)
  TwoWire& w = bus_ ? *bus_ : Wire;
  w.beginTransmission(address_);
  return w.endTransmission() == 0;
#else
  return SensActCtrlTest::bme280Present;
#endif
}

bool BME280Sensor::connect() {
  nextRetryMs_ = millis() + kRetryIntervalMs;
  initialized_ = bus_ ? dev_->begin(address_, bus_) : dev_->begin(address_);
  return initialized_;
}

void BME280Sensor::invalidate() {
  tempReading_ = humReading_ = presReading_ = Reading{};
}

void BME280Sensor::begin() {
  if (dev_) return;
  dev_ = new Adafruit_BME280();
  connect();
}

Channel BME280Sensor::channel(size_t idx) const {
  switch (idx) {
    case 0: return {"temp",
        SensorMeta{ValueKind::Continuous, Quantity::Temperature,
                   "\xc2\xb0""C", -40.0f, 85.0f, 0.01f},
        tempReading_};
    case 1: return {"hum",
        SensorMeta{ValueKind::Continuous, Quantity::Humidity,
                   "%RH", 0.0f, 100.0f, 0.01f},
        humReading_};
    default: return {"pres",
        SensorMeta{ValueKind::Continuous, Quantity::Pressure,
                   "hPa", 300.0f, 1100.0f, 0.01f},
        presReading_};
  }
}

void BME280Sensor::tick() {
  if (!dev_) return;  // begin() not called

  const uint32_t now = millis();
  if (!initialized_) {
    if (static_cast<int32_t>(now - nextRetryMs_) < 0) return;
    if (!connect()) return;
  } else if (!devicePresent()) {
    initialized_ = false;
    nextRetryMs_ = now + kRetryIntervalMs;
    invalidate();
    return;
  }

  const float t = dev_->readTemperature();
  const float h = dev_->readHumidity();
  const float p = dev_->readPressure() / 100.0f;
  if (isnan(t) || isnan(h) || isnan(p)) {
    invalidate();
    return;
  }

  tempReading_ = Reading{t, now, true};
  humReading_  = Reading{h, now, true};
  presReading_ = Reading{p, now, true};
}

}  // namespace SensActCtrl
