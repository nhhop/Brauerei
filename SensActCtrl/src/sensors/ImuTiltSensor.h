#pragma once

#include <stdint.h>

#include <memory>

#include "ImuSensor.h"
#include "core/Sensor.h"

namespace SensActCtrl {

// Derives tilt angles from a 6-axis IMU (any ImuSensor: GY521Sensor,
// QMI8658Sensor, BMI270Sensor, BMI160Sensor). Owns its raw sensor -- a tilt
// sensor *uses* a raw 6-axis sensor, it isn't one, so composition rather than
// inheritance or a CalibratedSensor-style reference decorator.
//
// Channels, in this order (setChannelMask() picks which are exposed; default
// "pitch" only):
//   "pitch"  °   rotation about Y = how far the X axis points out of the
//                horizontal, atan2(-ax, sqrt(ay²+az²)), -90..90
//   "roll"   °   rotation about X = the same for the Y axis,
//                atan2(ay, sqrt(ax²+az²)), -90..90
//   "tilt"   °   angle of the Z axis against the vertical, whichever way it
//                leans: 0 flat, 90 on an edge, 180 upside down
//   "temp", "ax", "ay", "az", "gx", "gy", "gz"  passed through from the raw
//                ImuSensor
//   "dir"    °   the side that is up, in the chip's X/Y plane, as a bearing:
//                atan2(roll, pitch), 0..360 (0 = the -X side is up, 90 = Y,
//                180 = X, 270 = -Y; pitch is atan2(-ax, ...), so pitch > 0
//                lifts -X). Undefined -- invalid -- while the tilt (hypot of
//                pitch and roll) is below kDirMinTiltDeg. The direction a
//                spirit level's bubble moves in, seen with -X pointing up and
//                Y to the right.
// A rotation about Z (yaw) is not among them: gravity does not change with
// it, so without a magnetometer only the drifting gyro integral could tell.
//
// pitch and roll run through a complementary filter (time constant kTauS)
// that blends the gyro rate of their own axis (gy resp. gx) with the
// accelerometer angle, plus a slow integral term that learns the gyro's
// zero-rate offset -- without it the offset would hold the angle off by
// offset x kTauS. tilt comes from the accelerometer alone. All angles and the
// raw readout run regardless of the mask; it only decides which channels
// channelCount()/channel() expose.
//
// An angle channel is meant to be wrapped in a CalibratedSensor with a `poly`
// calibration (raw angle -> specific gravity), exactly like an iSpindel tilt
// hydrometer -- BrewControl's DynamicItems.cpp already wraps every sensor it
// creates that way, so no extra plumbing is needed here.
//
// Typical use:
//   ImuTiltSensor tilt("hydrometer",
//                      std::make_unique<BMI160Sensor>("hydrometer", Wire, 0x68));
//   registry.add(&tilt);
class ImuTiltSensor : public Sensor {
 public:
  // raw is typically created with the same id; it must not be null.
  ImuTiltSensor(const char* id, std::unique_ptr<ImuSensor> raw);

  // Channel mask bits, in exposed order.
  static constexpr uint16_t kChannelPitch = 0x001;
  static constexpr uint16_t kChannelRoll  = 0x002;
  static constexpr uint16_t kChannelTilt  = 0x004;
  static constexpr uint16_t kChannelTemp  = 0x008;
  static constexpr uint16_t kChannelAx    = 0x010;
  static constexpr uint16_t kChannelAy    = 0x020;
  static constexpr uint16_t kChannelAz    = 0x040;
  static constexpr uint16_t kChannelGx    = 0x080;
  static constexpr uint16_t kChannelGy    = 0x100;
  static constexpr uint16_t kChannelGz    = 0x200;
  static constexpr uint16_t kChannelDir   = 0x400;  // after gz: keeps the bits above stable
  static constexpr uint16_t kChannelAll   = 0x7FF;
  // Default: pitch only. A mask without any valid bit is ignored.
  void setChannelMask(uint16_t mask) {
    if (mask & kChannelAll) channelMask_ = mask & kChannelAll;
  }

  const char* id()                const override { return id_; }
  size_t      channelCount()      const override;
  Channel     channel(size_t idx) const override;

  void begin() override { raw_->begin(); }
  void end()   override { raw_->end(); }
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
  // Filter time constant: the gyro carries changes faster than this, the
  // accelerometer sets the angle over longer spans.
  static constexpr float kTauS = 0.5f;
  // Integral gain for the gyro offset (1/s²); learns it within ~20 s.
  static constexpr float kBiasGain = 0.1f;
  // Below this tilt the direction is noise: "dir" is invalid.
  static constexpr float kDirMinTiltDeg = 0.5f;

  void filter(Reading& angle, float& bias, float angleAccelDeg,
              float gyroRateDegPerS, float dt, uint32_t now);

  const char* id_;
  std::unique_ptr<ImuSensor> raw_;
  Reading     pitch_{};
  Reading     roll_{};
  Reading     tilt_{};
  Reading     dir_{};
  float      pitchBias_   = 0.0f;   // learned gyro offsets, °/s
  float       rollBias_    = 0.0f;
  uint16_t    channelMask_ = kChannelPitch;
  uint32_t    lastTickMs_  = 0;
  bool        hasLastTick_ = false;
};

}  // namespace SensActCtrl
