#pragma once

#include <stdint.h>

#include "core/Sensor.h"

// Forward decl to keep Adafruit_MPU6050 out of the umbrella header.
class Adafruit_MPU6050;

namespace SensActCtrl {

// GY-521 breakout (MPU-6050 accelerometer + gyroscope), raw 6-axis readout.
//
// One instance exposes six channels:
//   channel(0): AccelX  "g"    (key="ax")
//   channel(1): AccelY  "g"    (key="ay")
//   channel(2): AccelZ  "g"    (key="az")
//   channel(3): GyroX   "°/s"  (key="gx")
//   channel(4): GyroY   "°/s"  (key="gy")
//   channel(5): GyroZ   "°/s"  (key="gz")
//
// Building block for GY521TiltSensor, which derives a tilt angle from these
// raw axes; typically not registered on its own.
//
// Typical use:
//   GY521Sensor mpu("imu", 0x68);
//   registry.add(&mpu);
class GY521Sensor : public Sensor {
 public:
  explicit GY521Sensor(const char* id, uint8_t i2cAddress = 0x68);
  ~GY521Sensor();

  const char* id()                const override { return id_; }
  size_t      channelCount()      const override { return 6; }
  Channel     channel(size_t idx) const override;

  void begin() override;
  void tick()  override;

 private:
  const char*       id_;
  uint8_t           address_;
  Adafruit_MPU6050* dev_         = nullptr;
  bool              initialized_ = false;

  Reading accelX_{};
  Reading accelY_{};
  Reading accelZ_{};
  Reading gyroX_{};
  Reading gyroY_{};
  Reading gyroZ_{};
};

}  // namespace SensActCtrl
