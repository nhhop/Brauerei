#pragma once

#include <stdint.h>

#include "PmuSensor.h"

// Forward decl to keep SensorLib out of the umbrella header.
class PmicSY6970;

namespace SensActCtrl {

// Silergy SY6970 charger IC (e.g. onboard the LilyGo T-Display-S3-AMOLED),
// read through lewisxhe/SensorLib -- the PmuSensor channels vbat, vbus,
// charging plus the charge current (key="ichg", "A"). I2C address 0x6A.
//
// Note: SensorLib's begin() resets the chip, so its charge settings are back
// at the power-on defaults afterwards (and its watchdog is off).
//
// Typical use:
//   SY6970Sensor pmu("pmu", Wire);
//   registry.add(&pmu);
class SY6970Sensor : public PmuSensor {
 public:
  explicit SY6970Sensor(const char* id, uint8_t i2cAddress = 0x6A);

  // Constructor for a bus the caller owns (e.g. BrewControl's shared board
  // I2C bus). The TwoWire instance must outlive this sensor.
  SY6970Sensor(const char* id, TwoWire& bus, uint8_t i2cAddress = 0x6A);

  ~SY6970Sensor();

 protected:
  bool connectDevice() override;
  bool readDevice(Sample& s) override;
  const char*       extraKey()  const override { return "ichg"; }
  const SensorMeta& extraMeta() const override;

 private:
  PmicSY6970* dev_ = nullptr;
};

}  // namespace SensActCtrl
