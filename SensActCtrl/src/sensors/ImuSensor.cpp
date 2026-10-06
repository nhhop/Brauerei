#include "ImuSensor.h"

#if defined(ARDUINO)
  #include <Arduino.h>
  #include <Wire.h>
#else
  // Native build stub: IMUs are hardware-only. The globals let tests play
  // "module plugged in / pulled", advance the clock and set what the chip
  // reports (accel in g, gyro in °/s; default: lying flat, at rest, 25 °C).
  namespace SensActCtrlTest {
  bool     imuPresent     = true;
  uint32_t imuNowMs       = 0;
  float    imuAccelG[3]   = {0.0f, 0.0f, 1.0f};
  float    imuGyroDps[3]  = {0.0f, 0.0f, 0.0f};
  float    imuTempC       = 25.0f;
  }
  static uint32_t millis() { return SensActCtrlTest::imuNowMs; }
#endif

namespace SensActCtrl {

namespace {
const SensorMeta kAccelMeta{ValueKind::Continuous, Quantity::Custom, "g",
                            -16.0f, 16.0f, 0.001f};
const SensorMeta kGyroMeta{ValueKind::Continuous, Quantity::Custom, "\xc2\xb0/s",
                           -2000.0f, 2000.0f, 0.01f};
const SensorMeta kTempMeta{ValueKind::Continuous, Quantity::Temperature, "\xc2\xb0" "C",
                           -40.0f, 85.0f, 0.01f};
const char* const kKeys[] = {"ax", "ay", "az", "gx", "gy", "gz"};
}  // namespace

#if defined(ARDUINO)
TwoWire& ImuSensor::wire() const { return bus_ ? *bus_ : Wire; }

bool ImuSensor::devicePresent() const {
  TwoWire& w = wire();
  w.beginTransmission(address_);
  return w.endTransmission() == 0;
}
#else
bool ImuSensor::devicePresent() const { return SensActCtrlTest::imuPresent; }

bool ImuSensor::stubConnect() { return SensActCtrlTest::imuPresent; }

bool ImuSensor::stubRead(float accelG[3], float gyroDps[3], float& tempC) {
  for (int i = 0; i < 3; ++i) {
    accelG[i]  = SensActCtrlTest::imuAccelG[i];
    gyroDps[i] = SensActCtrlTest::imuGyroDps[i];
  }
  tempC = SensActCtrlTest::imuTempC;
  return true;
}
#endif

bool ImuSensor::connect() {
  nextRetryMs_ = millis() + kRetryIntervalMs;
  initialized_ = connectDevice();
  return initialized_;
}

void ImuSensor::invalidate() {
  for (int i = 0; i < 3; ++i) accel_[i] = gyro_[i] = Reading{};
  temp_ = Reading{};
}

void ImuSensor::begin() {
  if (begun_) return;
  begun_ = true;
  connect();
}

Channel ImuSensor::channel(size_t idx) const {
  if (idx < 3) return {kKeys[idx], kAccelMeta, accel_[idx]};
  if (idx < 6) return {kKeys[idx], kGyroMeta, gyro_[idx - 3]};
  return {"temp", kTempMeta, temp_};
}

void ImuSensor::tick() {
  if (!begun_) return;

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

  float a[3], g[3], t;
  if (!readDevice(a, g, t)) {
    invalidate();
    return;
  }
  for (int i = 0; i < 3; ++i) {
    accel_[i] = Reading{a[i], now, true};
    gyro_[i]  = Reading{g[i], now, true};
  }
  temp_ = Reading{t, now, t == t};  // NaN: the driver could not read it
}

}  // namespace SensActCtrl
