#pragma once

#include <stdint.h>

#include "core/Sensor.h"

namespace SensActCtrl {

// ESP32 ADC sensor with linear calibration and optional moving-average
// smoothing.
//
// Calibration: map [rawMin..rawMax] → [valueMin..valueMax]. Default is
// pass-through 0..4095. Outputs beyond rawMin/rawMax are extrapolated, not
// clamped.
//
// Smoothing: window N — average of the last N raw samples before scaling.
// Set N=1 to disable.
//
// Quantity/unit/range advertised via meta() are configurable so a single
// sensor type can advertise itself as a pH probe (0..14, "pH"), a voltage
// probe (0..3.3 V), a pressure probe, etc.
class AnalogInputSensor : public Sensor {
 public:
  // Constructor leaves the ADC in default attenuation; call setAttenuation
  // before begin() to change. attenuation is platform-specific (passed
  // through to analogSetPinAttenuation on ESP32).
  AnalogInputSensor(const char* id, int pin);

  const char* id() const override { return id_; }
  SensorMeta meta() const override { return meta_; }

  void begin() override;
  void tick() override;
  Reading lastReading() const override { return last_; }

  // Linear calibration: raw [rawMin..rawMax] → physical [valueMin..valueMax].
  void setCalibration(int rawMin, int rawMax, float valueMin, float valueMax);

  // Window size for moving average; N=1 disables (default).
  void setSmoothing(uint8_t windowN);

  // ESP32 ADC attenuation enum value; passed through verbatim on Arduino,
  // ignored on native builds.
  void setAttenuation(int attenuation) { attenuation_ = attenuation; }

  // Advertise this sensor's physical meaning to the registry / web frontend.
  void setMeta(Quantity q, const char* unit, float minPhys, float maxPhys,
               float resolution);

  // Exposed for unit tests of calibration math. Maps a raw ADC reading to
  // the configured physical-unit range without going through analogRead().
  float rawToValue(float raw) const;

 private:

  const char* id_;
  int pin_;
  int attenuation_ = -1;
  int rawMin_ = 0;
  int rawMax_ = 4095;
  float valueMin_ = 0.0f;
  float valueMax_ = 4095.0f;
  uint8_t window_ = 1;
  // Ring buffer for moving average. Max window 32; bigger sizes typically
  // aren't useful for brewing-frequency sampling.
  static constexpr uint8_t kMaxWindow = 32;
  int samples_[kMaxWindow] = {};
  uint8_t sampleIdx_ = 0;
  uint8_t sampleCount_ = 0;

  SensorMeta meta_{ValueKind::Continuous, Quantity::Voltage, "V",
                   0.0f, 3.3f, 0.001f};
  Reading last_{};
};

}  // namespace SensActCtrl
