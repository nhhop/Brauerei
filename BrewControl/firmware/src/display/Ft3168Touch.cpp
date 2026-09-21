#include "Ft3168Touch.h"

#ifdef BREWCTL_HAS_DISPLAY

#include <Wire.h>

namespace BrewControl {
namespace {

// FocalTech touch data block, read as one burst from 0x02:
//   0x02      number of touch points (low nibble)
//   0x03,0x04 X: high nibble of 0x03 is the event flag, low nibble is X[11:8]
//   0x05,0x06 Y: same layout
constexpr uint8_t kRegTouches = 0x02;
constexpr size_t kBlockLen = 5;

}  // namespace

void Ft3168Touch::begin() {
  Wire.beginTransmission(kAddr);
  present_ = (Wire.endTransmission() == 0);
}

bool Ft3168Touch::read(int16_t* x, int16_t* y) {
  if (!present_) return false;

  Wire.beginTransmission(kAddr);
  Wire.write(kRegTouches);
  if (Wire.endTransmission(false) != 0) return false;
  if (Wire.requestFrom(static_cast<int>(kAddr), static_cast<int>(kBlockLen)) !=
      static_cast<int>(kBlockLen)) {
    return false;
  }

  uint8_t b[kBlockLen];
  for (size_t i = 0; i < kBlockLen; ++i) b[i] = Wire.read();

  if ((b[0] & 0x0F) == 0) return false;

  const int16_t rx = static_cast<int16_t>(((b[1] & 0x0F) << 8) | b[2]);
  const int16_t ry = static_cast<int16_t>(((b[3] & 0x0F) << 8) | b[4]);

  history_[historyPos_] = {rx, ry, millis()};
  historyPos_ = (historyPos_ + 1) % kHistory;
  if (historyCount_ < kHistory) ++historyCount_;

  *x = rx;
  *y = ry;
  return true;
}

size_t Ft3168Touch::history(Sample* out, size_t cap) const {
  const size_t n = historyCount_ < cap ? historyCount_ : cap;
  for (size_t i = 0; i < n; ++i) {
    // Newest first.
    const size_t idx = (historyPos_ + kHistory - 1 - i) % kHistory;
    out[i] = history_[idx];
  }
  return n;
}

}  // namespace BrewControl

#endif  // BREWCTL_HAS_DISPLAY
