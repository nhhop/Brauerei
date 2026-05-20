#pragma once

#include <stdint.h>

#include "core/Actuator.h"

namespace SensActCtrl {

// GPIO output actuator with two modes:
//   - Binary:           write(0) = LOW, write(!=0) = HIGH.
//   - TimeProportional: write(0..1) sets duty-cycle over a configurable
//                       period. tick() handles the on/off pulsing in
//                       software — no hardware PWM channels consumed.
//
// activeHigh: if false, the logical "on" state drives the pin LOW (e.g. for
// active-low SSRs or relays).
class DigitalOutputActuator : public Actuator {
 public:
  enum class Mode : uint8_t { Binary, TimeProportional };

  DigitalOutputActuator(const char* id, int pin, Mode mode = Mode::Binary,
                        bool activeHigh = true);

  const char* id() const override { return id_; }
  ActuatorMeta meta() const override;

  void begin() override;
  void end() override;
  void tick() override;
  void write(float v) override;
  float state() const override { return state_; }

  // Period of one PWM cycle in TimeProportional mode (default 2000 ms).
  void setPeriodMs(uint32_t periodMs) { periodMs_ = periodMs; }
  uint32_t periodMs() const { return periodMs_; }

  Mode mode() const { return mode_; }

 private:
  void applyPin(bool on);

  const char* id_;
  int pin_;
  Mode mode_;
  bool activeHigh_;
  float state_ = 0.0f;         // last commanded value (post-clamp)
  uint32_t periodMs_ = 2000;
  uint32_t cycleStartMs_ = 0;
};

}  // namespace SensActCtrl
