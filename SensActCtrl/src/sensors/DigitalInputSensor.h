#pragma once

#include <stdint.h>

#include "core/Sensor.h"

namespace SensActCtrl {

// GPIO input sensor with optional software debounce.
//   pullup: enables INPUT_PULLUP at begin().
//   invert: if true, the logical "on" state is LOW (e.g. button to GND).
//   debounceMs: ignore state flips faster than this; 0 disables debounce.
class DigitalInputSensor : public Sensor {
 public:
  DigitalInputSensor(const char* id, int pin,
                     bool pullup = false, bool invert = false,
                     uint32_t debounceMs = 0);

  const char* id() const override { return id_; }
  SensorMeta meta() const override;

  void begin() override;
  void tick() override;
  Reading lastReading() const override { return last_; }

 private:
  const char* id_;
  int pin_;
  bool pullup_;
  bool invert_;
  uint32_t debounceMs_;
  bool stableState_ = false;
  bool candidateState_ = false;
  uint32_t lastFlipMs_ = 0;
  Reading last_{};
};

}  // namespace SensActCtrl
