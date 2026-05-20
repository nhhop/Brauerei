#pragma once

#include <stdint.h>

#include "core/Actuator.h"

namespace SensActCtrl {

// Non-blocking pulse generator. write(N) enqueues N pulses; tick() drives
// the GPIO through pulse-on/gap-off cycles using millis(). state() reports
// the number of pulses still outstanding.
//
// Use cases:
//   - stepper motor step inputs
//   - hop-dispenser actuators (1 pulse = 1 hop addition)
//   - dosing pumps (N pulses = N ml)
//
// Pulse width / gap are configurable; activeLevel selects HIGH-active or
// LOW-active pulses.
class PulseOutputActuator : public Actuator {
 public:
  PulseOutputActuator(const char* id, int pin,
                      uint32_t pulseWidthMs = 50,
                      uint32_t gapMs = 50,
                      bool activeHigh = true);

  const char* id() const override { return id_; }
  ActuatorMeta meta() const override;

  void begin() override;
  void tick() override;

  // write(N): enqueue N pulses (added to outstanding queue). Negative or
  // zero values are no-ops.
  void write(float v) override;

  // Outstanding pulses still to emit.
  float state() const override { return static_cast<float>(remaining_); }

  void setPulseWidthMs(uint32_t ms) { pulseWidthMs_ = ms; }
  void setGapMs(uint32_t ms) { gapMs_ = ms; }
  void setUnit(const char* unit) { unit_ = unit; }
  void setQuantity(Quantity q) { quantity_ = q; }

 private:
  enum class Phase : uint8_t { Idle, PulseHigh, PulseLow };

  void setPin(bool on);

  const char* id_;
  int pin_;
  uint32_t pulseWidthMs_;
  uint32_t gapMs_;
  bool activeHigh_;
  const char* unit_ = "pulses";
  Quantity quantity_ = Quantity::Count;
  uint32_t remaining_ = 0;
  uint32_t phaseStartMs_ = 0;
  Phase phase_ = Phase::Idle;
};

}  // namespace SensActCtrl
