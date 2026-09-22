#include "CalibratedSensor.h"

#include <math.h>
#include <string.h>

namespace SensActCtrl {
namespace {

// Horner evaluation of c[0] + c[1]*u + ... + c[d]*u^d, accumulated in double.
double horner(const float* c, int d, double u) {
  double y = c[d];
  for (int k = d - 1; k >= 0; --k) y = y * u + c[k];
  return y;
}

// Its derivative with respect to u.
double hornerDeriv(const float* c, int d, double u) {
  double y = c[d] * d;
  for (int k = d - 1; k >= 1; --k) y = y * u + c[k] * k;
  return y;
}

}  // namespace

float CalibratedSensor::evalPoly(const Calibration& c, float raw) {
  const double u = (static_cast<double>(raw) - c.rawRef) / c.rawScale;
  const int    d = c.degree;
  // Outside the fitted hull continue along the tangent instead of letting the
  // polynomial run (see the class comment). At degree 1 this is the line.
  if (u < c.uMin)
    return static_cast<float>(horner(c.coeffs, d, c.uMin) +
                              hornerDeriv(c.coeffs, d, c.uMin) * (u - c.uMin));
  if (u > c.uMax)
    return static_cast<float>(horner(c.coeffs, d, c.uMax) +
                              hornerDeriv(c.coeffs, d, c.uMax) * (u - c.uMax));
  return static_cast<float>(horner(c.coeffs, d, u));
}

Channel CalibratedSensor::channel(size_t idx) const {
  Channel ch = inner_.channel(idx);
  if (idx < kMaxChannels && cal_[idx].active && ch.reading.valid) {
    const Calibration& c = cal_[idx];
    ch.reading.value = c.degree > 0
                           ? evalPoly(c, ch.reading.value)
                           : c.valRef + c.gain * (ch.reading.value - c.rawRef);
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
  // "Keeps the existing gain" has no meaning on a polynomial channel, where
  // gain is a leftover of the fit. Clear the channel first.
  if (cal_[idx].active && cal_[idx].degree > 0) return Result::NotCalibratable;
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
  cal_[idx] = Calibration{};  // drops any polynomial on this channel
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
  cal_[idx] = Calibration{};  // drops any polynomial on this channel
  cal_[idx].rawRef = raw1;
  cal_[idx].valRef = value1;
  cal_[idx].gain   = (value2 - value1) / (raw2 - raw1);
  cal_[idx].active = true;
  return Result::Ok;
}

CalibratedSensor::Result CalibratedSensor::calibratePoly(size_t idx,
                                                         const float* raws,
                                                         const float* values,
                                                         size_t n, uint8_t degree) {
  const Result r = checkChannel(idx, /*allowOffset=*/true);
  if (r != Result::Ok) return r;
  if (degree < 1 || degree > kMaxDegree) return Result::InvalidPoints;
  if (n < static_cast<size_t>(degree) + 1u || n > kMaxPoints) return Result::InvalidPoints;
  for (size_t i = 0; i < n; ++i)
    if (!isfinite(raws[i]) || !isfinite(values[i])) return Result::InvalidPoints;

  // Centre and scale the raw values onto u in [-1, 1] before fitting. Without
  // it, HX711-sized counts (~8.4e6) drive the moments of the normal equations
  // up to u^6 ~ 3e41 and the system is unusable even in double.
  double sum = 0.0;
  for (size_t i = 0; i < n; ++i) sum += raws[i];
  const float rawRef = static_cast<float>(sum / n);
  double span = 0.0;
  for (size_t i = 0; i < n; ++i) {
    const double d = fabs(static_cast<double>(raws[i]) - rawRef);
    if (d > span) span = d;
  }
  if (span == 0.0) return Result::InvalidPoints;  // all raw values identical
  const float rawScale = static_cast<float>(span);

  // Fit against the stored floats, not the doubles above: at 8.4e6 a float ULP
  // is 1.0, and a centre that differs between fit and evaluation shifts the
  // result by a fraction of a count times the slope.
  double u[kMaxPoints];
  for (size_t i = 0; i < n; ++i)
    u[i] = (static_cast<double>(raws[i]) - rawRef) / rawScale;
  for (size_t i = 0; i < n; ++i)
    for (size_t j = i + 1; j < n; ++j)
      if (fabs(u[i] - u[j]) < 1e-6) return Result::InvalidPoints;

  // Normal equations M c = b, augmented as m[row][0..d] with m[row][d+1] = b.
  const int d = degree;
  double m[kMaxDegree + 1][kMaxDegree + 2] = {};
  for (size_t i = 0; i < n; ++i) {
    double pw[2 * kMaxDegree + 1];
    pw[0] = 1.0;
    for (int k = 1; k <= 2 * d; ++k) pw[k] = pw[k - 1] * u[i];
    for (int a = 0; a <= d; ++a) {
      for (int b = 0; b <= d; ++b) m[a][b] += pw[a + b];
      m[a][d + 1] += static_cast<double>(values[i]) * pw[a];
    }
  }

  // Gaussian elimination with partial pivoting. m[0][0] is exactly n (all
  // |u| <= 1), so the pivot threshold is relative to that.
  for (int col = 0; col <= d; ++col) {
    int piv = col;
    for (int row = col + 1; row <= d; ++row)
      if (fabs(m[row][col]) > fabs(m[piv][col])) piv = row;
    if (fabs(m[piv][col]) < 1e-12 * static_cast<double>(n)) return Result::InvalidPoints;
    if (piv != col)
      for (int k = col; k <= d + 1; ++k) {
        const double t = m[col][k];
        m[col][k] = m[piv][k];
        m[piv][k] = t;
      }
    for (int row = col + 1; row <= d; ++row) {
      const double f = m[row][col] / m[col][col];
      for (int k = col; k <= d + 1; ++k) m[row][k] -= f * m[col][k];
    }
  }
  double c[kMaxDegree + 1];
  for (int row = d; row >= 0; --row) {
    double s = m[row][d + 1];
    for (int k = row + 1; k <= d; ++k) s -= m[row][k] * c[k];
    c[row] = s / m[row][row];
  }
  for (int k = 0; k <= d; ++k)
    if (!isfinite(c[k])) return Result::InvalidPoints;

  // Only now touch the channel, so a rejected fit leaves it as it was.
  Calibration nc;  // default-constructed: drops any linear state
  nc.active     = true;
  nc.degree     = degree;
  nc.pointCount = static_cast<uint8_t>(n);
  nc.rawRef     = rawRef;
  nc.rawScale   = rawScale;
  double lo = u[0], hi = u[0];
  for (size_t i = 0; i < n; ++i) {
    nc.points[i][0] = raws[i];
    nc.points[i][1] = values[i];
    if (u[i] < lo) lo = u[i];
    if (u[i] > hi) hi = u[i];
  }
  nc.uMin = static_cast<float>(lo);
  nc.uMax = static_cast<float>(hi);
  for (int k = 0; k <= d; ++k) nc.coeffs[k] = static_cast<float>(c[k]);
  cal_[idx] = nc;
  return Result::Ok;
}

bool CalibratedSensor::setCalibration(size_t idx, float rawRef, float valRef,
                                      float gain) {
  if (checkChannel(idx, /*allowOffset=*/false) != Result::Ok) return false;
  if (!isfinite(rawRef) || !isfinite(valRef) || !isfinite(gain)) return false;
  cal_[idx] = Calibration{};  // reset by field, not positionally
  cal_[idx].rawRef = rawRef;
  cal_[idx].valRef = valRef;
  cal_[idx].gain   = gain;
  cal_[idx].active = true;
  return true;
}

void CalibratedSensor::clear(size_t idx) {
  if (idx < kMaxChannels) cal_[idx] = Calibration{};
}

CalibratedSensor::Calibration CalibratedSensor::calibration(size_t idx) const {
  return idx < kMaxChannels ? cal_[idx] : Calibration{};
}

}  // namespace SensActCtrl
