#include "GY521Sensor.h"

#if defined(ARDUINO)
  #include <Arduino.h>
  #include <Wire.h>
  #include <Adafruit_Sensor.h>
  #include <Adafruit_MPU6050.h>
#else
  // Native build stub: MPU-6050 is hardware-only. The two globals let tests
  // play "module plugged in / pulled" and advance the clock.
  #include <stdint.h>
  namespace SensActCtrlTest {
  bool     gy521Present = true;
  uint32_t gy521NowMs   = 0;
  }
  static uint32_t millis() { return SensActCtrlTest::gy521NowMs; }
  struct FakeVec3 { float x = 0.0f, y = 0.0f, z = 0.0f; };
  struct sensors_event_t { FakeVec3 acceleration; FakeVec3 gyro; };
  class TwoWire {};
  class Adafruit_MPU6050 {
   public:
    bool begin(uint8_t = 0x68) { return SensActCtrlTest::gy521Present; }
    bool begin(uint8_t, TwoWire*, int32_t = 0) {
      return SensActCtrlTest::gy521Present;
    }
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

GY521Sensor::GY521Sensor(const char* id, TwoWire& bus, uint8_t i2cAddress)
    : id_(id), address_(i2cAddress), bus_(&bus) {}

GY521Sensor::~GY521Sensor() { delete dev_; }

// Adafruit_MPU6050::getEvent() always returns true and ignores I2C errors
// (it decodes an uninitialised buffer), so a pulled module can only be told
// apart by probing the address ourselves.
bool GY521Sensor::devicePresent() const {
#if defined(ARDUINO)
  TwoWire& w = bus_ ? *bus_ : Wire;
  w.beginTransmission(address_);
  return w.endTransmission() == 0;
#else
  return SensActCtrlTest::gy521Present;
#endif
}

bool GY521Sensor::connect() {
  nextRetryMs_ = millis() + kRetryIntervalMs;
  initialized_ = bus_ ? dev_->begin(address_, bus_) : dev_->begin(address_);
  return initialized_;
}

void GY521Sensor::invalidate() {
  accelX_ = accelY_ = accelZ_ = Reading{};
  gyroX_  = gyroY_  = gyroZ_  = Reading{};
}

void GY521Sensor::begin() {
  if (dev_) return;
  dev_ = new Adafruit_MPU6050();
  connect();
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
  if (!dev_) return;  // begin() not called

  const uint32_t now = millis();
  if (!initialized_) {
    if (static_cast<int32_t>(now - nextRetryMs_) < 0) return;
    if (!connect()) return;
  } else if (!devicePresent()) {
    initialized_ = false;
    nextRetryMs_ = now + kRetryIntervalMs;
    invalidate();
    return;
  }

  sensors_event_t accel, gyro, temp;
  if (!dev_->getEvent(&accel, &gyro, &temp)) {
    invalidate();
    return;
  }

  accelX_ = Reading{accel.acceleration.x / kGravity, now, true};
  accelY_ = Reading{accel.acceleration.y / kGravity, now, true};
  accelZ_ = Reading{accel.acceleration.z / kGravity, now, true};
  gyroX_  = Reading{gyro.gyro.x * kRadToDeg, now, true};
  gyroY_  = Reading{gyro.gyro.y * kRadToDeg, now, true};
  gyroZ_  = Reading{gyro.gyro.z * kRadToDeg, now, true};
}

}  // namespace SensActCtrl
