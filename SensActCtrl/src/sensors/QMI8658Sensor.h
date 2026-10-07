#pragma once

#include <stdint.h>

#include "ImuSensor.h"

// Forward decl to keep SensorLib out of the umbrella header.
class SensorQMI8658;

namespace SensActCtrl {

// QST QMI8658 6-axis IMU (e.g. onboard the Waveshare ESP32-S3-Touch-AMOLED-
// 1.75), raw readout through lewisxhe/SensorLib -- the seven ImuSensor
// channels (ax, ay, az, gx, gy, gz, temp). I2C address 0x6B (SA0 high, the
// usual wiring) or 0x6A. Configured for tilt work: ±4 g, ±500 °/s, ~125 Hz.
//
// Typical use:
//   QMI8658Sensor imu("imu", Wire, 0x6B);
//   registry.add(&imu);
class QMI8658Sensor : public ImuSensor {
 public:
  explicit QMI8658Sensor(const char* id, uint8_t i2cAddress = 0x6B);

  // Constructor for a bus the caller owns (e.g. BrewControl's shared board
  // I2C bus). The TwoWire instance must outlive this sensor.
  QMI8658Sensor(const char* id, TwoWire& bus, uint8_t i2cAddress = 0x6B);

  ~QMI8658Sensor();

 protected:
  bool connectDevice() override;
  bool readDevice(float accelG[3], float gyroDps[3], float& tempC) override;

 private:
  SensorQMI8658* dev_ = nullptr;
};

}  // namespace SensActCtrl
