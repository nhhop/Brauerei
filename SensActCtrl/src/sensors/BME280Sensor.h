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
// Without a device (wrong address, module unplugged) all channels stay
// invalid. A failed begin() is retried from tick() every kRetryIntervalMs, so a
// module plugged in later starts by itself; a module pulled while running is
// noticed by an address probe on every tick and goes invalid again.
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
  uint32_t         nextRetryMs_ = 0;

  static constexpr uint32_t kRetryIntervalMs = 5000;

  bool connect();
  bool devicePresent() const;
  void invalidate();

  Reading tempReading_{};
  Reading humReading_{};
  Reading presReading_{};
};

}  // namespace SensActCtrl
