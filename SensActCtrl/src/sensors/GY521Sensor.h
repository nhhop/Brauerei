#pragma once

#include <stdint.h>

#include "ImuSensor.h"

// Forward decl to keep Adafruit_MPU6050 out of the umbrella header.
class Adafruit_MPU6050;

namespace SensActCtrl {

// GY-521 breakout (MPU-6050 accelerometer + gyroscope), raw 6-axis readout
// plus the chip temperature -- the seven ImuSensor channels (ax, ay, az, gx,
// gy, gz, temp). I2C address 0x68 (AD0 low) or 0x69.
//
// Building block for GY521TiltSensor, which derives a tilt angle from these
// raw axes and can pass them through; typically not registered on its own.
//
// Typical use:
//   GY521Sensor mpu("imu", 0x68);
//   registry.add(&mpu);
class GY521Sensor : public ImuSensor {
 public:
  explicit GY521Sensor(const char* id, uint8_t i2cAddress = 0x68);

  // Constructor for a bus the caller owns (e.g. BrewControl's shared board
  // I2C bus). The TwoWire instance must outlive this sensor.
  GY521Sensor(const char* id, TwoWire& bus, uint8_t i2cAddress = 0x68);

  ~GY521Sensor();

  void begin() override;

 protected:
  bool connectDevice() override;
  bool readDevice(float accelG[3], float gyroDps[3], float& tempC) override;

 private:
  Adafruit_MPU6050* dev_ = nullptr;
};

}  // namespace SensActCtrl
