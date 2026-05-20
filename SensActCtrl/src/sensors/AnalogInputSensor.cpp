#include "AnalogInputSensor.h"

#if defined(ARDUINO)
  #include <Arduino.h>
#else
  static int analogRead(int) { return 0; }
  static uint32_t millis() { return 0; }
#endif

namespace SensActCtrl {

AnalogInputSensor::AnalogInputSensor(const char* id, int pin)
    : id_(id), pin_(pin) {}

void AnalogInputSensor::setCalibration(int rawMin, int rawMax,
                                       float valueMin, float valueMax) {
  rawMin_ = rawMin;
  rawMax_ = rawMax;
  valueMin_ = valueMin;
  valueMax_ = valueMax;
}

void AnalogInputSensor::setSmoothing(uint8_t windowN) {
  if (windowN < 1) windowN = 1;
  if (windowN > kMaxWindow) windowN = kMaxWindow;
  window_ = windowN;
  sampleIdx_ = 0;
  sampleCount_ = 0;
}

void AnalogInputSensor::setMeta(Quantity q, const char* unit, float minPhys,
                                float maxPhys, float resolution) {
  meta_.quantity = q;
  meta_.unit = unit;
  meta_.min = minPhys;
  meta_.max = maxPhys;
  meta_.resolution = resolution;
}

void AnalogInputSensor::begin() {
#if defined(ARDUINO) && defined(ESP32)
  if (attenuation_ >= 0) {
    analogSetPinAttenuation(pin_, static_cast<adc_attenuation_t>(attenuation_));
  }
#else
  (void)attenuation_;
#endif
}

float AnalogInputSensor::rawToValue(float raw) const {
  const float rng = static_cast<float>(rawMax_ - rawMin_);
  if (rng == 0.0f) return valueMin_;
  const float t = (raw - rawMin_) / rng;
  return valueMin_ + t * (valueMax_ - valueMin_);
}

void AnalogInputSensor::tick() {
  const int raw = analogRead(pin_);

  float rawAvg = static_cast<float>(raw);
  if (window_ > 1) {
    samples_[sampleIdx_] = raw;
    sampleIdx_ = (sampleIdx_ + 1) % window_;
    if (sampleCount_ < window_) ++sampleCount_;
    long sum = 0;
    for (uint8_t i = 0; i < sampleCount_; ++i) sum += samples_[i];
    rawAvg = static_cast<float>(sum) / static_cast<float>(sampleCount_);
  }

  last_.value = rawToValue(rawAvg);
  last_.valid = true;
  last_.timestampMs = millis();
}

}  // namespace SensActCtrl
