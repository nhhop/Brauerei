#pragma once

#include <stdint.h>

#include "GY521Sensor.h"
#include "core/Sensor.h"

namespace SensActCtrl {

// Derives a single tilt-angle channel from a GY-521 (MPU-6050) using a
// complementary filter over the raw accelerometer + gyroscope axes. Owns its
// GY521Sensor -- a tilt sensor *uses* a raw 6-axis sensor, it isn't one, so
// composition rather than inheritance or a CalibratedSensor-style reference
// decorator.
//
// One instance exposes a single channel:
//   channel(0): tilt angle  "°"  (key="")
//
// The angle channel is meant to be wrapped in a CalibratedSensor with a
// `poly` calibration (raw angle -> specific gravity), exactly like an
// iSpindel tilt hydrometer -- BrewControl's DynamicItems.cpp already wraps
// every sensor it creates that way, so no extra plumbing is needed here.
//
// The accel axes (X/Z) and gyro axis (X) feeding the filter are a fixed,
// iSpindel-typical mounting assumption; verifying/tuning them against a real
// device is tracked separately (see PLAN.md/SESSION.md).
//
// Typical use:
//   GY521TiltSensor tilt("hydrometer", 0x68);
//   registry.add(&tilt);
class GY521TiltSensor : public Sensor {
 public:
  explicit GY521TiltSensor(const char* id, uint8_t i2cAddress = 0x68);

  const char* id()                const override { return id_; }
  size_t      channelCount()      const override { return 1; }
  Channel     channel(size_t idx) const override {
    (void)idx;
    return {"", meta_, angle_};
  }

  void begin() override { raw_.begin(); }
  void end()   override { raw_.end(); }
  void tick()  override;

  // One complementary-filter step, exposed for deterministic unit tests
  // without hardware: blends the gyro-integrated angle (prevAngle +
  // gyroRateDegPerS * dtSeconds) with the accelerometer-derived angle,
  // weighted by alpha (close to 1 favours the gyro, which drifts slowly but
  // isn't fooled by vessel motion; the accel term pulls it back to true
  // vertical over time).
  static float complementaryStep(float prevAngle, float angleAccelDeg,
                                  float gyroRateDegPerS, float dtSeconds,
                                  float alpha);

 private:
  static constexpr float kAlpha = 0.98f;

  const char* id_;
  GY521Sensor raw_;
  SensorMeta  meta_{ValueKind::Continuous, Quantity::Custom, "\xc2\xb0",
                    -180.0f, 180.0f, 0.1f};
  Reading     angle_{};
  uint32_t    lastTickMs_  = 0;
  bool        hasLastTick_ = false;
};

}  // namespace SensActCtrl
