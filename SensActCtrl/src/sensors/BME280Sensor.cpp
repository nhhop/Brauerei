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

BME280Bus::BME280Bus(uint8_t i2cAddress) : address_(i2cAddress) {}

BME280Bus::~BME280Bus() { delete dev_; }

void BME280Bus::begin() {
  if (initialized_) return;
  dev_ = new Adafruit_BME280();
  dev_->begin(address_);
  initialized_ = true;
}

bool BME280Bus::sample() {
  if (!initialized_ || !dev_) return false;
  tempC_ = dev_->readTemperature();
  humidity_ = dev_->readHumidity();
  pressureHpa_ = dev_->readPressure() / 100.0f;
  valid_ = true;
  return true;
}

BME280Sensor::BME280Sensor(const char* id, BME280Bus& bus, Channel channel)
    : id_(id), bus_(&bus), channel_(channel) {}

SensorMeta BME280Sensor::meta() const {
  switch (channel_) {
    case Channel::Temperature:
      return SensorMeta{ValueKind::Continuous, Quantity::Temperature,
                        "\xc2\xb0""C", -40.0f, 85.0f, 0.01f};
    case Channel::Humidity:
      return SensorMeta{ValueKind::Continuous, Quantity::Humidity, "%RH",
                        0.0f, 100.0f, 0.01f};
    case Channel::Pressure:
      return SensorMeta{ValueKind::Continuous, Quantity::Pressure, "hPa",
                        300.0f, 1100.0f, 0.01f};
  }
  return SensorMeta{};
}

void BME280Sensor::begin() { bus_->begin(); }

void BME280Sensor::tick() {
  // First channel to tick in a given loop iteration triggers a single chip
  // sample; downstream channels read from the cache. Cheap to over-call —
  // sample() just refreshes the cache each time tick() arrives.
  bus_->sample();
  if (!bus_->valid()) return;
  switch (channel_) {
    case Channel::Temperature: last_.value = bus_->lastTempC(); break;
    case Channel::Humidity:    last_.value = bus_->lastHumidity(); break;
    case Channel::Pressure:    last_.value = bus_->lastPressureHpa(); break;
  }
  last_.valid = true;
  last_.timestampMs = millis();
}

}  // namespace SensActCtrl
