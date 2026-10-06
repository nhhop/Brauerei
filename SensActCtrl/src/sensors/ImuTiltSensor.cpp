#include "ImuTiltSensor.h"

#include <utility>

#include <math.h>

namespace SensActCtrl {

namespace {
constexpr float kRadToDeg = 57.29577951308232f;

const SensorMeta kLevelMeta{ValueKind::Continuous, Quantity::Custom, "\xc2\xb0",
                            -90.0f, 90.0f, 0.1f};
const SensorMeta kTiltMeta{ValueKind::Continuous, Quantity::Custom, "\xc2\xb0",
                           0.0f, 180.0f, 0.1f};
const SensorMeta kDirMeta{ValueKind::Continuous, Quantity::Custom, "\xc2\xb0",
                          0.0f, 360.0f, 0.1f};
}  // namespace

ImuTiltSensor::ImuTiltSensor(const char* id, std::unique_ptr<ImuSensor> raw)
    : id_(id), raw_(std::move(raw)) {}

size_t ImuTiltSensor::channelCount() const {
  size_t n = 0;
  for (uint16_t m = channelMask_; m; m &= m - 1) ++n;
  return n;
}

Channel ImuTiltSensor::channel(size_t idx) const {
  // The idx-th set bit of the mask: bits 0..2 are the angles, bit 3 the raw
  // sensor's temperature (its channel 6), bits 4..9 its axes (channels 0..5),
  // bit 10 the direction.
  size_t bit = 0;
  for (; bit < 10; ++bit) {
    if (!(channelMask_ & (1u << bit))) continue;
    if (idx == 0) break;
    --idx;
  }
  switch (bit) {
    case 0:  return {"pitch", kLevelMeta, pitch_};
    case 1:  return {"roll",  kLevelMeta, roll_};
    case 2:  return {"tilt",  kTiltMeta,  tilt_};
    case 3:  return raw_->channel(6);
    case 10: return {"dir",   kDirMeta,   dir_};
    default: return raw_->channel(bit - 4);
  }
}

void ImuTiltSensor::filter(Reading& angle, float& bias, float angleAccelDeg,
                             float gyroRateDegPerS, float dt, uint32_t now) {
  const float prev  = angle.valid ? angle.value : angleAccelDeg;
  const float alpha = kTauS / (kTauS + dt);
  const float next  = complementaryStep(prev, angleAccelDeg,
                                        gyroRateDegPerS - bias, dt, alpha);
  // Running ahead of the accelerometer means the gyro reads too high.
  bias += kBiasGain * (next - angleAccelDeg) * dt;
  angle = Reading{next, now, true};
}

void ImuTiltSensor::tick() {
  raw_->tick();

  const Reading ax = raw_->channel(0).reading;
  const Reading ay = raw_->channel(1).reading;
  const Reading az = raw_->channel(2).reading;
  const Reading gx = raw_->channel(3).reading;
  const Reading gy = raw_->channel(4).reading;
  if (!ax.valid) {
    // Raw sensor lost (module pulled): drop the angles and restart the
    // filters from the accelerometer when it comes back -- maybe a different
    // module, so its offsets are learned anew.
    pitch_ = roll_ = tilt_ = dir_ = Reading{};
    pitchBias_ = rollBias_ = 0.0f;
    hasLastTick_ = false;
    return;
  }

  const uint32_t now = ax.timestampMs;
  float dt = 0.0f;
  if (hasLastTick_) dt = static_cast<float>(now - lastTickMs_) / 1000.0f;

  const float pitchAccel =
      atan2f(-ax.value, sqrtf(ay.value * ay.value + az.value * az.value)) * kRadToDeg;
  const float rollAccel =
      atan2f(ay.value, sqrtf(ax.value * ax.value + az.value * az.value)) * kRadToDeg;
  // A positive rotation about Y turns X upwards (pitch up), about X turns Y
  // upwards (roll up): each angle integrates the rate of its own axis.
  filter(pitch_, pitchBias_, pitchAccel, gy.value, dt, now);
  filter(roll_,  rollBias_,  rollAccel,  gx.value, dt, now);
  tilt_ = Reading{atan2f(sqrtf(ax.value * ax.value + ay.value * ay.value), az.value) * kRadToDeg,
                  now, true};
  // Which way the chip leans: the bearing of the high side, 0 = -X side up.
  if (hypotf(pitch_.value, roll_.value) < kDirMinTiltDeg) {
    dir_ = Reading{};
  } else {
    float dir = atan2f(roll_.value, pitch_.value) * kRadToDeg;
    if (dir < 0.0f) dir += 360.0f;
    dir_ = Reading{dir, now, true};
  }

  lastTickMs_  = now;
  hasLastTick_ = true;
}

float ImuTiltSensor::complementaryStep(float prevAngle, float angleAccelDeg,
                                          float gyroRateDegPerS,
                                          float dtSeconds, float alpha) {
  const float gyroAngle = prevAngle + gyroRateDegPerS * dtSeconds;
  return alpha * gyroAngle + (1.0f - alpha) * angleAccelDeg;
}

}  // namespace SensActCtrl
