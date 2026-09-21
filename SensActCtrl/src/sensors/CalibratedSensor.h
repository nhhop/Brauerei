#pragma once

#include <stddef.h>

#include "core/Sensor.h"

namespace SensActCtrl {

// Decorator: wraps any Sensor and applies a linear calibration per channel,
//   value = valRef + gain * (raw - rawRef)
// where "raw" is whatever the inner sensor reports (its uncalibrated value in
// the channel's unit). (rawRef, valRef) is a point the line passes through,
// gain is the slope. This is the point-slope form of gain*raw + offset; it is
// stored this way because it stays accurate for large raw values (24-bit HX711
// counts) where the offset form would cancel two nearly equal floats.
//
// Default per channel is the identity (gain = 1, rawRef = valRef = 0).
// id(), meta, begin/end/tick/fault are forwarded to the inner sensor; only
// reading.value of valid readings is rewritten. The uncalibrated value stays
// readable via rawValue() so a UI can capture it while calibrating.
//
// Binary/Discrete channels are not calibratable; Cumulative channels only take
// a gain (an offset would corrupt the running total).
class CalibratedSensor : public Sensor {
 public:
  static constexpr size_t kMaxChannels = 4;

  enum class Result : uint8_t {
    Ok,
    BadChannel,       // idx >= channelCount()
    NotCalibratable,  // Binary/Discrete channel, Cumulative + offset/two-point, or idx >= kMaxChannels
    InvalidPoints,    // equal raw values (two-point) or raw == 0 (gain)
  };

  struct Calibration {
    float rawRef = 0.0f;
    float valRef = 0.0f;
    float gain   = 1.0f;
    bool  active = false;  // false = identity
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
  // Keeps the channel's existing gain.
  Result calibrateOffset(size_t idx, float raw, float value);
  // One-point gain: line through the origin, reading `raw` should read `value`.
  Result calibrateGain(size_t idx, float raw, float value);
  // Two-point: offset and slope from two reference readings.
  Result calibrateTwoPoint(size_t idx, float raw1, float value1,
                           float raw2, float value2);

  // Restore persisted values (as stored by calibration()). False if idx is out
  // of range or the channel is not calibratable.
  bool setCalibration(size_t idx, float rawRef, float valRef, float gain);

  void clear(size_t idx);
  Calibration calibration(size_t idx) const;

 private:
  Result checkChannel(size_t idx, bool allowOffset) const;

  Sensor& inner_;
  Calibration cal_[kMaxChannels] = {};
};

}  // namespace SensActCtrl
