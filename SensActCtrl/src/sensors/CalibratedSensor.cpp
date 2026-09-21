#include "CalibratedSensor.h"

#include <math.h>
#include <string.h>

namespace SensActCtrl {

Channel CalibratedSensor::channel(size_t idx) const {
  Channel ch = inner_.channel(idx);
  if (idx < kMaxChannels && cal_[idx].active && ch.reading.valid) {
    const Calibration& c = cal_[idx];
    ch.reading.value = c.valRef + c.gain * (ch.reading.value - c.rawRef);
  }
  return ch;
}

int CalibratedSensor::indexOfKey(const char* key) const {
  const char* want = key ? key : "";
  const size_t n = inner_.channelCount();
  for (size_t i = 0; i < n; ++i) {
    const char* k = inner_.channel(i).key;
    if (strcmp(k ? k : "", want) == 0) return static_cast<int>(i);
  }
  return -1;
}

float CalibratedSensor::rawValue(size_t idx) const {
  if (idx >= inner_.channelCount()) return 0.0f;
  return inner_.channel(idx).reading.value;
}

CalibratedSensor::Result CalibratedSensor::checkChannel(size_t idx,
                                                        bool allowOffset) const {
  if (idx >= inner_.channelCount()) return Result::BadChannel;
  if (idx >= kMaxChannels) return Result::NotCalibratable;
  const ValueKind kind = inner_.channel(idx).meta.kind;
  if (kind == ValueKind::Binary || kind == ValueKind::Discrete)
    return Result::NotCalibratable;
  if (kind == ValueKind::Cumulative && allowOffset) return Result::NotCalibratable;
  return Result::Ok;
}

CalibratedSensor::Result CalibratedSensor::calibrateOffset(size_t idx, float raw,
                                                           float value) {
  const Result r = checkChannel(idx, /*allowOffset=*/true);
  if (r != Result::Ok) return r;
  if (!isfinite(raw) || !isfinite(value)) return Result::InvalidPoints;
  cal_[idx].rawRef = raw;
  cal_[idx].valRef = value;
  cal_[idx].active = true;  // gain unchanged (1 for a fresh channel)
  return Result::Ok;
}

CalibratedSensor::Result CalibratedSensor::calibrateGain(size_t idx, float raw,
                                                         float value) {
  const Result r = checkChannel(idx, /*allowOffset=*/false);
  if (r != Result::Ok) return r;
  if (!isfinite(raw) || !isfinite(value) || raw == 0.0f) return Result::InvalidPoints;
  cal_[idx].rawRef = 0.0f;
  cal_[idx].valRef = 0.0f;
  cal_[idx].gain   = value / raw;
  cal_[idx].active = true;
  return Result::Ok;
}

CalibratedSensor::Result CalibratedSensor::calibrateTwoPoint(size_t idx,
                                                             float raw1, float value1,
                                                             float raw2, float value2) {
  const Result r = checkChannel(idx, /*allowOffset=*/true);
  if (r != Result::Ok) return r;
  if (!isfinite(raw1) || !isfinite(raw2) || !isfinite(value1) || !isfinite(value2) ||
      raw1 == raw2)
    return Result::InvalidPoints;
  cal_[idx].rawRef = raw1;
  cal_[idx].valRef = value1;
  cal_[idx].gain   = (value2 - value1) / (raw2 - raw1);
  cal_[idx].active = true;
  return Result::Ok;
}

bool CalibratedSensor::setCalibration(size_t idx, float rawRef, float valRef,
                                      float gain) {
  if (checkChannel(idx, /*allowOffset=*/false) != Result::Ok) return false;
  if (!isfinite(rawRef) || !isfinite(valRef) || !isfinite(gain)) return false;
  cal_[idx] = Calibration{rawRef, valRef, gain, true};
  return true;
}

void CalibratedSensor::clear(size_t idx) {
  if (idx < kMaxChannels) cal_[idx] = Calibration{};
}

CalibratedSensor::Calibration CalibratedSensor::calibration(size_t idx) const {
  return idx < kMaxChannels ? cal_[idx] : Calibration{};
}

}  // namespace SensActCtrl
