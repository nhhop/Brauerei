#pragma once

#include <stdint.h>

#include "PmuSensor.h"

// Forward decl to keep SensorLib out of the umbrella header.
class PmicAXP2101;

namespace SensActCtrl {

// X-Powers AXP2101 power-management IC (e.g. onboard the Waveshare
// ESP32-S3-Touch-AMOLED-1.75), read through lewisxhe/SensorLib -- the
// PmuSensor channels vbat, vbus, charging plus the chip's fuel gauge (key=
// "soc", "%"). I2C address 0x34.
//
// Note: SensorLib's begin() switches the TS (battery NTC) measurement off,
// so charging is not blocked on boards without an NTC.
//
// Typical use:
//   AXP2101Sensor pmu("pmu", Wire);
//   registry.add(&pmu);
class AXP2101Sensor : public PmuSensor {
 public:
  explicit AXP2101Sensor(const char* id, uint8_t i2cAddress = 0x34);

  // Constructor for a bus the caller owns (e.g. BrewControl's shared board
  // I2C bus). The TwoWire instance must outlive this sensor.
  AXP2101Sensor(const char* id, TwoWire& bus, uint8_t i2cAddress = 0x34);

  ~AXP2101Sensor();

 protected:
  bool connectDevice() override;
  bool readDevice(Sample& s) override;
  const char*       extraKey()  const override { return "soc"; }
  const SensorMeta& extraMeta() const override;

 private:
  PmicAXP2101* dev_ = nullptr;
};

}  // namespace SensActCtrl
