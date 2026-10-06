#pragma once

#include <stdint.h>

#include "ImuSensor.h"

// Forward decl to keep the SparkFun library out of the umbrella header.
class BMI270;

namespace SensActCtrl {

// Bosch BMI270 6-axis IMU (e.g. onboard the M5Stack StopWatch), raw readout
// through the SparkFun BMI270 Arduino Library -- the seven ImuSensor channels
// (ax, ay, az, gx, gy, gz, temp). I2C address 0x68 (SDO low) or 0x69. The
// chip needs Bosch's config blob uploaded at every start; the library does
// that in begin(), using its defaults (100 Hz, ±8 g, ±2000 °/s).
//
// Typical use:
//   BMI270Sensor imu("imu", Wire, 0x68);
//   registry.add(&imu);
class BMI270Sensor : public ImuSensor {
 public:
  explicit BMI270Sensor(const char* id, uint8_t i2cAddress = 0x68);

  // Constructor for a bus the caller owns (e.g. BrewControl's shared board
  // I2C bus). The TwoWire instance must outlive this sensor.
  BMI270Sensor(const char* id, TwoWire& bus, uint8_t i2cAddress = 0x68);

  ~BMI270Sensor();

 protected:
  bool connectDevice() override;
  bool readDevice(float accelG[3], float gyroDps[3], float& tempC) override;

 private:
  BMI270* dev_ = nullptr;
};

}  // namespace SensActCtrl
