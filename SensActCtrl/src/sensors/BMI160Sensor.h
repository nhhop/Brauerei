#pragma once

#include <stdint.h>

#include "ImuSensor.h"

namespace SensActCtrl {

// Bosch BMI160 6-axis IMU breakout, raw readout -- the seven ImuSensor
// channels (ax, ay, az, gx, gy, gz, temp). I2C address 0x68 (SDO low) or
// 0x69. A small register driver of its own (there is no maintained Arduino
// library, and the chip needs nothing but a few register writes). Configured
// for tilt work: ±4 g, ±500 °/s, 100 Hz.
//
// Typical use:
//   BMI160Sensor imu("imu", Wire, 0x69);
//   registry.add(&imu);
class BMI160Sensor : public ImuSensor {
 public:
  explicit BMI160Sensor(const char* id, uint8_t i2cAddress = 0x68);

  // Constructor for a bus the caller owns (e.g. BrewControl's shared board
  // I2C bus). The TwoWire instance must outlive this sensor.
  BMI160Sensor(const char* id, TwoWire& bus, uint8_t i2cAddress = 0x68);

  // Converts a burst read of DATA (0x0C..0x17: gyro x/y/z, then accel x/y/z,
  // each little-endian int16) and TEMPERATURE (0x20..0x21) at the configured
  // ranges. Exposed for unit tests without hardware.
  static void decode(const uint8_t data[12], const uint8_t temp[2],
                     float accelG[3], float gyroDps[3], float& tempC);

 protected:
  bool connectDevice() override;
  bool readDevice(float accelG[3], float gyroDps[3], float& tempC) override;

 private:
  bool writeReg(uint8_t reg, uint8_t value);
  bool readRegs(uint8_t reg, uint8_t* buf, uint8_t len);
};

}  // namespace SensActCtrl
