#include "GY521Sensor.h"

#if defined(ARDUINO)
  #include <Arduino.h>
  #include <Wire.h>
  #include <Adafruit_Sensor.h>
  #include <Adafruit_MPU6050.h>
#else
  // Native build stub: MPU-6050 is hardware-only.
  #include <stdint.h>
  static uint32_t millis() { return 0; }
  struct FakeVec3 { float x = 0.0f, y = 0.0f, z = 0.0f; };
  struct sensors_event_t { FakeVec3 acceleration; FakeVec3 gyro; };
  class Adafruit_MPU6050 {
   public:
    bool begin(uint8_t = 0x68) { return true; }
    bool getEvent(sensors_event_t* accel, sensors_event_t* gyro,
                  sensors_event_t*) {
      // Device lying flat: gravity along Z, no rotation.
      *accel = sensors_event_t{};
      accel->acceleration.z = 9.80665f;
      *gyro = sensors_event_t{};
      return true;
    }
  };
#endif

namespace SensActCtrl {

namespace {
constexpr float kGravity  = 9.80665f;   // m/s^2 per g, for the accel channels
constexpr float kRadToDeg = 57.29577951308232f;  // for the gyro channels
}  // namespace

GY521Sensor::GY521Sensor(const char* id, uint8_t i2cAddress)
    : id_(id), address_(i2cAddress) {}

GY521Sensor::~GY521Sensor() { delete dev_; }

void GY521Sensor::begin() {
  if (initialized_) return;
  dev_ = new Adafruit_MPU6050();
  dev_->begin(address_);
  initialized_ = true;
}

Channel GY521Sensor::channel(size_t idx) const {
  switch (idx) {
    case 0: return {"ax",
        SensorMeta{ValueKind::Continuous, Quantity::Custom, "g",
                   -16.0f, 16.0f, 0.001f}, accelX_};
    case 1: return {"ay",
        SensorMeta{ValueKind::Continuous, Quantity::Custom, "g",
                   -16.0f, 16.0f, 0.001f}, accelY_};
    case 2: return {"az",
        SensorMeta{ValueKind::Continuous, Quantity::Custom, "g",
                   -16.0f, 16.0f, 0.001f}, accelZ_};
    case 3: return {"gx",
        SensorMeta{ValueKind::Continuous, Quantity::Custom, "\xc2\xb0/s",
                   -2000.0f, 2000.0f, 0.01f}, gyroX_};
    case 4: return {"gy",
        SensorMeta{ValueKind::Continuous, Quantity::Custom, "\xc2\xb0/s",
                   -2000.0f, 2000.0f, 0.01f}, gyroY_};
    default: return {"gz",
        SensorMeta{ValueKind::Continuous, Quantity::Custom, "\xc2\xb0/s",
                   -2000.0f, 2000.0f, 0.01f}, gyroZ_};
  }
}

void GY521Sensor::tick() {
  if (!initialized_ || !dev_) return;

  sensors_event_t accel, gyro, temp;
  dev_->getEvent(&accel, &gyro, &temp);
  const uint32_t now = millis();

  accelX_ = Reading{accel.acceleration.x / kGravity, now, true};
  accelY_ = Reading{accel.acceleration.y / kGravity, now, true};
  accelZ_ = Reading{accel.acceleration.z / kGravity, now, true};
  gyroX_  = Reading{gyro.gyro.x * kRadToDeg, now, true};
  gyroY_  = Reading{gyro.gyro.y * kRadToDeg, now, true};
  gyroZ_  = Reading{gyro.gyro.z * kRadToDeg, now, true};
}

}  // namespace SensActCtrl
