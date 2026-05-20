#pragma once

#include <stdint.h>

#include "core/Sensor.h"

// Forward decl to keep Adafruit_BME280 out of the umbrella header.
class Adafruit_BME280;

namespace SensActCtrl {

// BME280 combined T/H/P sensor.
//
// One physical device exposes three measurements; this library models that
// as three independent Sensor instances sharing a single Adafruit_BME280
// handle. Construct one Channel sensor per quantity you care about — they
// share state and an internal mutable cache so only one I2C transaction
// per tick().
//
// Typical use:
//   BME280Bus bus(/*i2cAddress=*/0x76);
//   BME280Sensor temp("amb_t", bus, BME280Sensor::Channel::Temperature);
//   BME280Sensor hum ("amb_h", bus, BME280Sensor::Channel::Humidity);
//   BME280Sensor pres("amb_p", bus, BME280Sensor::Channel::Pressure);
class BME280Bus;

class BME280Sensor : public Sensor {
 public:
  enum class Channel : uint8_t { Temperature, Humidity, Pressure };

  BME280Sensor(const char* id, BME280Bus& bus, Channel channel);

  const char* id() const override { return id_; }
  SensorMeta meta() const override;

  void begin() override;
  void tick() override;
  Reading lastReading() const override { return last_; }

 private:
  const char* id_;
  BME280Bus* bus_;
  Channel channel_;
  Reading last_{};
};

// Shared handle for the underlying chip. Pass the I2C address (0x76 or
// 0x77 on most breakouts). begin() is invoked the first time any of the
// Sensor channels has its begin() called.
class BME280Bus {
 public:
  explicit BME280Bus(uint8_t i2cAddress = 0x76);
  ~BME280Bus();

  void begin();
  // Re-read the chip; cached by all three channels until next sample().
  // Returns true on a successful read.
  bool sample();

  float lastTempC() const { return tempC_; }
  float lastHumidity() const { return humidity_; }
  float lastPressureHpa() const { return pressureHpa_; }
  bool valid() const { return valid_; }

 private:
  uint8_t address_;
  Adafruit_BME280* dev_ = nullptr;
  bool initialized_ = false;
  bool valid_ = false;
  float tempC_ = 0.0f;
  float humidity_ = 0.0f;
  float pressureHpa_ = 0.0f;
};

}  // namespace SensActCtrl
