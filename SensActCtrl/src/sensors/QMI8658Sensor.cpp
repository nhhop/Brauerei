#include "QMI8658Sensor.h"

#if defined(ARDUINO)
  #include <Arduino.h>
  #include <Wire.h>
  #include <ImuDrv.hpp>  // SensorLib's current QMI8658 driver
#else
  // Native build: the chip itself is played by ImuSensor's stub.
  class SensorQMI8658 {};
#endif

namespace SensActCtrl {

#if defined(ARDUINO)
namespace {
constexpr float kGravity = 9.80665f;  // readAccel() reports m/s^2
}  // namespace
#endif

QMI8658Sensor::QMI8658Sensor(const char* id, uint8_t i2cAddress)
    : ImuSensor(id, nullptr, i2cAddress) {}

QMI8658Sensor::QMI8658Sensor(const char* id, TwoWire& bus, uint8_t i2cAddress)
    : ImuSensor(id, &bus, i2cAddress) {}

QMI8658Sensor::~QMI8658Sensor() { delete dev_; }

bool QMI8658Sensor::connectDevice() {
#if defined(ARDUINO)
  // A fresh driver per attempt: SensorLib's begin() is not meant to be
  // repeated on an instance whose first begin() failed.
  delete dev_;
  dev_ = new SensorQMI8658();
  // No SDA/SCL: the bus is already running; SensorLib's wire.begin() is then
  // a no-op.
  if (!dev_->begin(wire(), address())) return false;
  dev_->configAccel(AccelFullScaleRange::FS_4G, 125.0f);
  dev_->configGyro(GyroFullScaleRange::FS_500_DPS, 112.0f);
  return dev_->enableAccel() && dev_->enableGyro();
#else
  return stubConnect();
#endif
}

bool QMI8658Sensor::readDevice(float accelG[3], float gyroDps[3], float& tempC) {
#if defined(ARDUINO)
  AccelerometerData a;
  GyroscopeData g;
  if (!dev_->readAccel(a) || !dev_->readGyro(g)) return false;
  accelG[0]  = a.mps2.x / kGravity;
  accelG[1]  = a.mps2.y / kGravity;
  accelG[2]  = a.mps2.z / kGravity;
  gyroDps[0] = g.dps.x;
  gyroDps[1] = g.dps.y;
  gyroDps[2] = g.dps.z;
  tempC      = a.temperature;  // read along with the accel; NaN on error
  return true;
#else
  return stubRead(accelG, gyroDps, tempC);
#endif
}

}  // namespace SensActCtrl
