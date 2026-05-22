#include "BME280Sensor.h"

#if defined(ARDUINO)
  #include <Arduino.h>
  #include <Wire.h>
  #include <Adafruit_BME280.h>
#else
  // Native build stub: BME280 is hardware-only.
  #include <stdint.h>
  static uint32_t millis() { return 0; }
  class Adafruit_BME280 {
   public:
    bool begin(uint8_t = 0x76) { return false; }
    float readTemperature() { return 25.0f; }
    float readHumidity() { return 50.0f; }
    float readPressure() { return 101325.0f; }
  };
#endif

namespace SensActCtrl {

BME280Sensor::BME280Sensor(const char* id, uint8_t i2cAddress)
    : id_(id), address_(i2cAddress) {}

BME280Sensor::~BME280Sensor() { delete dev_; }

void BME280Sensor::begin() {
  if (initialized_) return;
  dev_ = new Adafruit_BME280();
  dev_->begin(address_);
  initialized_ = true;
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
  if (!initialized_ || !dev_) return;

  const uint32_t now = millis();
  const float t = dev_->readTemperature();
  const float h = dev_->readHumidity();
  const float p = dev_->readPressure() / 100.0f;

  tempReading_ = {t, now, true};
  humReading_  = {h, now, true};
  presReading_ = {p, now, true};
}

}  // namespace SensActCtrl
