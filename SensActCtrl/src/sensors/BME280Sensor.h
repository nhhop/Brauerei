#pragma once

#include <stdint.h>

#include "core/Sensor.h"

// Forward decls to keep Adafruit_BME280/TwoWire out of the umbrella header.
class Adafruit_BME280;
class TwoWire;

namespace SensActCtrl {

// BME280 combined T/H/P sensor.
//
// One instance exposes three channels:
//   channel(0): Temperature  "°C"   (key="temp")
//   channel(1): Humidity     "%RH"  (key="hum")
//   channel(2): Pressure     "hPa"  (key="pres")
//
// Typical use:
//   BME280Sensor bme("amb", 0x76);
//   registry.add(&bme);
class BME280Sensor : public Sensor {
 public:
  explicit BME280Sensor(const char* id, uint8_t i2cAddress = 0x76);

  // Constructor for a bus the caller owns (e.g. BrewControl's shared board
  // I2C bus). The TwoWire instance must outlive this sensor.
  BME280Sensor(const char* id, TwoWire& bus, uint8_t i2cAddress = 0x76);

  ~BME280Sensor();

  const char* id()                const override { return id_; }
  size_t      channelCount()      const override { return 3; }
  Channel     channel(size_t idx) const override;

  void begin() override;
  void tick()  override;

 private:
  const char*      id_;
  uint8_t          address_;
  TwoWire*         bus_      = nullptr;
  Adafruit_BME280* dev_     = nullptr;
  bool             initialized_ = false;

  Reading tempReading_{};
  Reading humReading_{};
  Reading presReading_{};
};

}  // namespace SensActCtrl
