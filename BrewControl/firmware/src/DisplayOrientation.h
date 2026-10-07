#pragma once

#include <cmath>
#include <cstdint>

namespace BrewControl {

// Display rotation (clockwise, 0/90/180/270) from a tilt sensor's pitch and
// roll (ImuTiltSensor channels, °). Header-only so the native tests cover it.
//
// The side of the chip that points up has the bearing atan2(roll, pitch) in
// the chip's X/Y plane (the tilt sensor's "dir": 0 = -X up, 90 = +Y up). How
// that maps onto the panel depends on how the IMU is mounted: offsetDeg is the
// rotation to show while the -X side points up, and mirrored flips the sense of
// rotation (an IMU on the back of the board sees the panel from behind).
//
// Keeps current while the device lies (nearly) flat - then no side is up - and
// while the bearing has not left current's quadrant by more than the
// hysteresis, so holding it near a diagonal does not flip back and forth.
constexpr float kOrientMinTiltDeg = 30.0f;
constexpr float kOrientHysteresisDeg = 15.0f;

inline bool isDisplayRotation(int32_t deg) {
  return deg == 0 || deg == 90 || deg == 180 || deg == 270;
}

inline uint16_t orientationFromTilt(float pitchDeg, float rollDeg, uint16_t offsetDeg,
                                    bool mirrored, uint16_t current) {
  if (std::hypot(pitchDeg, rollDeg) < kOrientMinTiltDeg) return current;
  float bearing = std::atan2(rollDeg, pitchDeg) * 57.29578f;
  if (mirrored) bearing = -bearing;
  float a = std::fmod(bearing + offsetDeg, 360.0f);
  if (a < 0) a += 360.0f;
  // Angular distance from the current rotation, 0..180.
  float d = std::fabs(a - current);
  if (d > 180.0f) d = 360.0f - d;
  if (d <= 45.0f + kOrientHysteresisDeg) return current;
  return static_cast<uint16_t>(static_cast<int>(std::lround(a / 90.0f)) % 4 * 90);
}

// Panel coordinates of a point drawn at logical (x, y), for a square panel of
// side n rotated by deg clockwise.
inline void rotatePoint(uint16_t deg, int16_t n, int16_t x, int16_t y, int16_t& px, int16_t& py) {
  switch (deg) {
    case 90:  px = n - 1 - y; py = x; break;
    case 180: px = n - 1 - x; py = n - 1 - y; break;
    case 270: px = y; py = n - 1 - x; break;
    default:  px = x; py = y; break;
  }
}

// The inverse: the logical point under panel coordinates (px, py) - for touch.
inline void unrotatePoint(uint16_t deg, int16_t n, int16_t px, int16_t py, int16_t& x, int16_t& y) {
  switch (deg) {
    case 90:  x = py; y = n - 1 - px; break;
    case 180: x = n - 1 - px; y = n - 1 - py; break;
    case 270: x = n - 1 - py; y = px; break;
    default:  x = px; y = py; break;
  }
}

}  // namespace BrewControl
