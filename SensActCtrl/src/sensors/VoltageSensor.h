#pragma once

#include <stdint.h>

#include "core/Sensor.h"

namespace SensActCtrl {

// Voltage behind a resistive divider on an ESP32 ADC pin, e.g. a battery.
//
//   measured point ── R1 ── ADC pin ── R2 ── GND
//
// Reads calibrated millivolts (analogReadMilliVolts, which applies the
// chip's eFuse ADC calibration) and scales them by (R1 + R2) / R2. R1 = 0
// measures the pin directly. Only the ratio matters, so any unit works for
// the resistors as long as both use the same one.
//
// Smoothing: window N — average of the last N millivolt samples. N=1
// disables.
class VoltageSensor : public Sensor {
 public:
  VoltageSensor(const char* id, int pin, float r1, float r2);

  const char* id() const override { return id_; }
  size_t  channelCount()      const override { return 1; }
  Channel channel(size_t)     const override { return {"", meta_, last_}; }

  void begin() override {}
  void tick() override;

  // Window size for moving average; N=1 disables (default).
  void setSmoothing(uint8_t windowN);

  void setResolution(float resolution) { meta_.resolution = resolution; }

  // Exposed for unit tests: millivolts at the pin → volts at the measured
  // point.
  static float dividerVolts(float mv, float r1, float r2);

 private:
  const char* id_;
  int pin_;
  float r1_;
  float r2_;
  uint8_t window_ = 1;
  static constexpr uint8_t kMaxWindow = 32;
  uint32_t samples_[kMaxWindow] = {};
  uint8_t sampleIdx_ = 0;
  uint8_t sampleCount_ = 0;

  SensorMeta meta_{ValueKind::Continuous, Quantity::Voltage, "V",
                   0.0f, 3.3f, 0.01f};
  Reading last_{};
};

}  // namespace SensActCtrl
