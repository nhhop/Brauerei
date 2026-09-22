#include "GY521TiltSensor.h"

#include <math.h>

namespace SensActCtrl {

GY521TiltSensor::GY521TiltSensor(const char* id, uint8_t i2cAddress)
    : id_(id), raw_(id, i2cAddress) {}

void GY521TiltSensor::tick() {
  raw_.tick();

  const Channel ax = raw_.channel(0);
  const Channel ay = raw_.channel(1);
  const Channel az = raw_.channel(2);
  const Channel gx = raw_.channel(3);
  if (!ax.reading.valid) return;

  const uint32_t now = ax.reading.timestampMs;
  const float angleAccel =
      atan2f(-ax.reading.value,
             sqrtf(ay.reading.value * ay.reading.value +
                   az.reading.value * az.reading.value)) *
      57.29577951308232f;

  float dt = 0.0f;
  if (hasLastTick_) dt = static_cast<float>(now - lastTickMs_) / 1000.0f;
  const float prevAngle = angle_.valid ? angle_.value : angleAccel;

  const float newAngle = complementaryStep(prevAngle, angleAccel,
                                            gx.reading.value, dt, kAlpha);

  angle_       = Reading{newAngle, now, true};
  lastTickMs_  = now;
  hasLastTick_ = true;
}

float GY521TiltSensor::complementaryStep(float prevAngle, float angleAccelDeg,
                                          float gyroRateDegPerS,
                                          float dtSeconds, float alpha) {
  const float gyroAngle = prevAngle + gyroRateDegPerS * dtSeconds;
  return alpha * gyroAngle + (1.0f - alpha) * angleAccelDeg;
}

}  // namespace SensActCtrl
