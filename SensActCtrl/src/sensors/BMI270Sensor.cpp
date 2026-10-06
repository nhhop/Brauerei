#include "BMI270Sensor.h"

#if defined(ARDUINO)
  #include <Arduino.h>
  #include <Wire.h>
  #include <SparkFun_BMI270_Arduino_Library.h>
#else
  // Native build: the chip itself is played by ImuSensor's stub.
  class BMI270 {};
#endif

namespace SensActCtrl {

BMI270Sensor::BMI270Sensor(const char* id, uint8_t i2cAddress)
    : ImuSensor(id, nullptr, i2cAddress) {}

BMI270Sensor::BMI270Sensor(const char* id, TwoWire& bus, uint8_t i2cAddress)
    : ImuSensor(id, &bus, i2cAddress) {}

BMI270Sensor::~BMI270Sensor() { delete dev_; }

bool BMI270Sensor::connectDevice() {
#if defined(ARDUINO)
  // A fresh driver per attempt, so a failed config upload leaves no state.
  delete dev_;
  dev_ = new BMI270();
  return dev_->beginI2C(address(), wire()) == BMI2_OK;
#else
  return stubConnect();
#endif
}

bool BMI270Sensor::readDevice(float accelG[3], float gyroDps[3], float& tempC) {
#if defined(ARDUINO)
  if (dev_->getSensorData() != BMI2_OK) return false;
  accelG[0]  = dev_->data.accelX;
  accelG[1]  = dev_->data.accelY;
  accelG[2]  = dev_->data.accelZ;
  gyroDps[0] = dev_->data.gyroX;
  gyroDps[1] = dev_->data.gyroY;
  gyroDps[2] = dev_->data.gyroZ;
  if (dev_->getTemperature(&tempC) != BMI2_OK) tempC = NAN;
  return true;
#else
  return stubRead(accelG, gyroDps, tempC);
#endif
}

}  // namespace SensActCtrl
