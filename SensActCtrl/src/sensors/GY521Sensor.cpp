#include "GY521Sensor.h"

#if defined(ARDUINO)
  #include <Arduino.h>
  #include <Wire.h>
  #include <Adafruit_Sensor.h>
  #include <Adafruit_MPU6050.h>
#else
  // Native build: the chip itself is played by ImuSensor's stub.
  class Adafruit_MPU6050 {};
#endif

namespace SensActCtrl {

#if defined(ARDUINO)
namespace {
constexpr float kGravity  = 9.80665f;   // m/s^2 per g, for the accel channels
constexpr float kRadToDeg = 57.29577951308232f;  // for the gyro channels
}  // namespace
#endif

GY521Sensor::GY521Sensor(const char* id, uint8_t i2cAddress)
    : ImuSensor(id, nullptr, i2cAddress) {}

GY521Sensor::GY521Sensor(const char* id, TwoWire& bus, uint8_t i2cAddress)
    : ImuSensor(id, &bus, i2cAddress) {}

GY521Sensor::~GY521Sensor() { delete dev_; }

void GY521Sensor::begin() {
  if (!dev_) dev_ = new Adafruit_MPU6050();
  ImuSensor::begin();
}

bool GY521Sensor::connectDevice() {
#if defined(ARDUINO)
  return dev_->begin(address(), &wire());
#else
  return stubConnect();
#endif
}

// Adafruit_MPU6050::getEvent() always returns true and ignores I2C errors
// (it decodes an uninitialised buffer) -- ImuSensor's address probe is what
// tells a pulled module apart.
bool GY521Sensor::readDevice(float accelG[3], float gyroDps[3], float& tempC) {
#if defined(ARDUINO)
  sensors_event_t accel, gyro, temp;
  if (!dev_->getEvent(&accel, &gyro, &temp)) return false;
  accelG[0]  = accel.acceleration.x / kGravity;
  accelG[1]  = accel.acceleration.y / kGravity;
  accelG[2]  = accel.acceleration.z / kGravity;
  gyroDps[0] = gyro.gyro.x * kRadToDeg;
  gyroDps[1] = gyro.gyro.y * kRadToDeg;
  gyroDps[2] = gyro.gyro.z * kRadToDeg;
  tempC      = temp.temperature;
  return true;
#else
  return stubRead(accelG, gyroDps, tempC);
#endif
}

}  // namespace SensActCtrl
