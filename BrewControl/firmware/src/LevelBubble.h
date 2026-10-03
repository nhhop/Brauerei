#pragma once

#include <cmath>

namespace BrewControl {

// Where the bubble of the GY-521 spirit level sits in its glass. Header-only and
// Arduino-free like SensorChannels.h, so the native tests cover it; the display
// draws the result. Mirrors levelBubble() in web/src/levelBubble.ts - change
// both together.
//
// The bubble moves towards the high side. On screen x is right and y is up, in
// the unit disc: roll > 0 (the chip's Y side up) puts the bubble right, pitch > 0
// (its -X side up: pitch is atan2(-ax, ...)) puts it up. dirDeg is the same
// bearing, clockwise from the top, as the GY521TiltSensor "dir" channel:
// atan2(roll, pitch).
//
// Two scales in the round glass: the first kLevelInnerDeg of tilt fill the inner
// kLevelInnerFrac of the radius (the range that matters for levelling), the rest
// up to kLevelOuterDeg is squeezed into the outer ring, so the bubble keeps
// moving instead of sticking to the rim. From kLevelStraightOnDeg on, the
// dominant axis (a device standing on an edge) gives way to a straight level of
// the other axis; back below kLevelStraightOffDeg.
constexpr float kLevelInnerDeg = 15.0f;       // tilt at the end of the fine scale
constexpr float kLevelInnerFrac = 0.6f;       // ...which is this share of the radius
constexpr float kLevelOuterDeg = 45.0f;       // tilt at the rim
constexpr float kLevelStraightOnDeg = 45.0f;
constexpr float kLevelStraightOffDeg = 43.0f;  // hysteresis: no flicker around 45
constexpr float kLevelToleranceDeg = 1.0f;     // "level" within this
constexpr float kLevelDirMinDeg = 0.5f;        // below this the direction is noise

struct LevelBubble {
  bool valid = false;  // roll and pitch are finite
  float x = 0;
  float y = 0;
  float magnitudeDeg = 0;                // hypot(roll, pitch)
  float dirDeg = NAN;                    // 0..360, NAN while undefined
  bool atRim = false;                    // tilt beyond kLevelOuterDeg
  bool level = false;                    // within kLevelToleranceDeg
};

// Distance from the centre (0..1) for a tilt, on the two-part scale.
inline float levelBubbleRadius(float magnitudeDeg) {
  if (magnitudeDeg <= kLevelInnerDeg) return kLevelInnerFrac * magnitudeDeg / kLevelInnerDeg;
  if (magnitudeDeg >= kLevelOuterDeg) return 1.0f;
  return kLevelInnerFrac + (1.0f - kLevelInnerFrac) * (magnitudeDeg - kLevelInnerDeg) /
                               (kLevelOuterDeg - kLevelInnerDeg);
}

inline LevelBubble levelBubble(float rollDeg, float pitchDeg) {
  LevelBubble b;
  if (!std::isfinite(rollDeg) || !std::isfinite(pitchDeg)) return b;
  b.valid = true;
  b.magnitudeDeg = std::hypot(rollDeg, pitchDeg);
  b.level = b.magnitudeDeg <= kLevelToleranceDeg;
  // Radial: the bubble keeps the direction of the lean whatever the scale.
  b.atRim = b.magnitudeDeg > kLevelOuterDeg;
  if (b.magnitudeDeg > 0) {
    const float k = levelBubbleRadius(b.magnitudeDeg) / b.magnitudeDeg;
    b.x = rollDeg * k;
    b.y = pitchDeg * k;
  }
  if (b.magnitudeDeg >= kLevelDirMinDeg) {
    float dir = std::atan2(rollDeg, pitchDeg) * 57.29577951308232f;
    if (dir < 0.0f) dir += 360.0f;
    b.dirDeg = dir;
  }
  return b;
}

// The straight level of a device standing on an edge. The dominant axis is the
// one the device stands on; what is left to level is the *other* one, so that
// is the axis shown: Roll on a horizontal tube when Nick dominates, Nick on an
// upright tube (up is positive) when Roll does. The bubble goes right resp. up
// for a positive angle, on the same two-part scale as the round glass
// (x = -1..1 is -45..45 degrees). `level` is within the tolerance of 0;
// `upright` says the dominant axis is within it of 90.
struct LevelStraight {
  bool valid = false;
  bool axisIsPitch = true;  // the axis shown: the smaller of the two, pitch on a tie
  float valueDeg = 0;
  float x = 0;
  bool level = false;
  bool upright = false;
};

inline LevelStraight levelStraight(float rollDeg, float pitchDeg) {
  LevelStraight s;
  if (!std::isfinite(rollDeg) || !std::isfinite(pitchDeg)) return s;
  s.valid = true;
  const bool pitchDominant = std::fabs(pitchDeg) > std::fabs(rollDeg);
  s.axisIsPitch = !pitchDominant;
  s.valueDeg = pitchDominant ? rollDeg : pitchDeg;
  s.x = std::copysign(levelBubbleRadius(std::fabs(s.valueDeg)), s.valueDeg);
  s.level = std::fabs(s.valueDeg) <= kLevelToleranceDeg;
  s.upright = std::fmax(std::fabs(rollDeg), std::fabs(pitchDeg)) >= 90.0f - kLevelToleranceDeg;
  return s;
}

// Round or straight, with a hysteresis around the switch. Unreadable angles
// keep the previous mode.
inline bool levelStraightMode(bool wasStraight, float rollDeg, float pitchDeg) {
  if (!std::isfinite(rollDeg) || !std::isfinite(pitchDeg)) return wasStraight;
  const float dominant = std::fmax(std::fabs(rollDeg), std::fabs(pitchDeg));
  return wasStraight ? dominant >= kLevelStraightOffDeg : dominant >= kLevelStraightOnDeg;
}

}  // namespace BrewControl
