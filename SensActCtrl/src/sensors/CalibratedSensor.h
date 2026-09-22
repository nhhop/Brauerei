#pragma once

#include <stddef.h>

#include "core/Sensor.h"

namespace SensActCtrl {

// Decorator: wraps any Sensor and applies a calibration per channel.
//
// Linear (the default form):
//   value = valRef + gain * (raw - rawRef)
// where "raw" is whatever the inner sensor reports (its uncalibrated value in
// the channel's unit). (rawRef, valRef) is a point the line passes through,
// gain is the slope. This is the point-slope form of gain*raw + offset; it is
// stored this way because it stays accurate for large raw values (24-bit HX711
// counts) where the offset form would cancel two nearly equal floats.
//
// Polynomial (degree 1..3, for non-linear characteristics such as a tilt
// hydrometer): a least-squares fit through up to kMaxPoints support points,
// evaluated in the centred and scaled coordinate u = (raw - rawRef)/rawScale.
// The support points are kept so a UI can correct a single one and so the fit
// can be recomputed after a reload; coeffs is the derived form. Outside the
// fitted hull [uMin, uMax] the curve continues along its tangent rather than
// running free -- a cubic easily turns non-monotonic there, which would make a
// scale read *less* at *more* load. At degree 1 that continuation is exactly
// the two-point line. degree == 0 means the linear form above is in use.
//
// Default per channel is the identity (gain = 1, rawRef = valRef = 0).
// id(), meta, begin/end/tick/fault are forwarded to the inner sensor; only
// reading.value of valid readings is rewritten. The uncalibrated value stays
// readable via rawValue() so a UI can capture it while calibrating.
//
// Binary/Discrete channels are not calibratable; Cumulative channels only take
// a gain (an offset or a polynomial would corrupt the running total).
class CalibratedSensor : public Sensor {
 public:
  static constexpr size_t  kMaxChannels = 4;
  static constexpr size_t  kMaxPoints   = 8;
  static constexpr uint8_t kMaxDegree   = 3;

  enum class Result : uint8_t {
    Ok,
    BadChannel,       // idx >= channelCount()
    NotCalibratable,  // Binary/Discrete channel, Cumulative + offset/two-point/poly,
                      // offset on top of a polynomial, or idx >= kMaxChannels
    InvalidPoints,    // equal raw values (two-point, poly), raw == 0 (gain),
                      // bad degree, or too few/many points for the degree
  };

  struct Calibration {
    float rawRef = 0.0f;
    float valRef = 0.0f;
    float gain   = 1.0f;
    bool  active = false;  // false = identity
    // --- polynomial; degree 0 means the linear fields above are in use ---
    // New members must only ever be appended: setCalibration() and clear()
    // reset a channel by assigning a default-constructed Calibration.
    uint8_t degree     = 0;
    uint8_t pointCount = 0;
    float points[kMaxPoints][2] = {};   // raw, value -- the refittable truth
    float coeffs[kMaxDegree + 1] = {};  // in u = (raw - rawRef) / rawScale
    float rawScale = 1.0f;
    float uMin = 0.0f;                  // hull of the support points, in u;
    float uMax = 0.0f;                  // outside it the tangent continues
  };

  explicit CalibratedSensor(Sensor& inner) : inner_(inner) {}

  const char* id()           const override { return inner_.id(); }
  size_t channelCount()      const override { return inner_.channelCount(); }
  Channel channel(size_t idx) const override;

  void begin() override { inner_.begin(); }
  void end()   override { inner_.end(); }
  void tick()  override { inner_.tick(); }
  const char* fault() const override { return inner_.fault(); }

  // Index of the channel with this key ("" for single-value sensors), or -1.
  int indexOfKey(const char* key) const;

  // The inner sensor's uncalibrated value for a channel (0 if idx is invalid).
  float rawValue(size_t idx) const;

  // One-point offset: the current raw reading `raw` should read `value`.
  // Keeps the channel's existing gain. Rejected on a polynomial channel, where
  // `gain` is a leftover of the fit -- clear it first.
  Result calibrateOffset(size_t idx, float raw, float value);
  // One-point gain: line through the origin, reading `raw` should read `value`.
  Result calibrateGain(size_t idx, float raw, float value);
  // Two-point: offset and slope from two reference readings.
  Result calibrateTwoPoint(size_t idx, float raw1, float value1,
                           float raw2, float value2);
  // Least-squares polynomial of `degree` (1..kMaxDegree) through n support
  // points; needs at least degree+1 of them and at most kMaxPoints, with
  // distinct raw values. Also the restore path for persisted points -- the fit
  // is recomputed rather than stored, so no separate setter is needed.
  // Nothing is written unless the whole fit succeeds.
  Result calibratePoly(size_t idx, const float* raws, const float* values,
                       size_t n, uint8_t degree);

  // Restore persisted linear values (as stored by calibration()). False if idx
  // is out of range or the channel is not calibratable.
  bool setCalibration(size_t idx, float rawRef, float valRef, float gain);

  void clear(size_t idx);
  Calibration calibration(size_t idx) const;

 private:
  Result checkChannel(size_t idx, bool allowOffset) const;
  static float evalPoly(const Calibration& c, float raw);

  Sensor& inner_;
  Calibration cal_[kMaxChannels] = {};
};

}  // namespace SensActCtrl
