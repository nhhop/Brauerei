#include "VoltageSensor.h"

#if defined(ARDUINO)
  #include <Arduino.h>
#else
  static uint32_t analogReadMilliVolts(int) { return 0; }
  static uint32_t millis() { return 0; }
#endif

namespace SensActCtrl {

// Upper end of the advertised range: roughly the ADC's full scale at the
// default 11 dB attenuation, scaled up by the divider.
static constexpr float kPinFullScaleV = 3.3f;

VoltageSensor::VoltageSensor(const char* id, int pin, float r1, float r2)
    : id_(id), pin_(pin), r1_(r1), r2_(r2) {
  meta_.max = dividerVolts(kPinFullScaleV * 1000.0f, r1_, r2_);
}

float VoltageSensor::dividerVolts(float mv, float r1, float r2) {
  if (r2 <= 0.0f) return 0.0f;
  return mv / 1000.0f * (r1 + r2) / r2;
}

void VoltageSensor::setSmoothing(uint8_t windowN) {
  if (windowN < 1) windowN = 1;
  if (windowN > kMaxWindow) windowN = kMaxWindow;
  window_ = windowN;
  sampleIdx_ = 0;
  sampleCount_ = 0;
}

void VoltageSensor::tick() {
  const uint32_t mv = analogReadMilliVolts(pin_);

  float mvAvg = static_cast<float>(mv);
  if (window_ > 1) {
    samples_[sampleIdx_] = mv;
    sampleIdx_ = (sampleIdx_ + 1) % window_;
    if (sampleCount_ < window_) ++sampleCount_;
    uint32_t sum = 0;
    for (uint8_t i = 0; i < sampleCount_; ++i) sum += samples_[i];
    mvAvg = static_cast<float>(sum) / static_cast<float>(sampleCount_);
  }

  last_.value = dividerVolts(mvAvg, r1_, r2_);
  last_.valid = true;
  last_.timestampMs = millis();
}

}  // namespace SensActCtrl
