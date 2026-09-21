#pragma once

// Minimal FocalTech FT3168 reader for the T-Display-S3-AMOLED-1.75.
//
// The whole driver is the six registers below, so it does not justify pulling
// in SensorLib or Arduino_DriveBus. Polled from loop() — the INT line (GPIO 9)
// stays unused, which saves an ISR and matches how LVGL asks for input anyway
// (it polls its indev on its own schedule).

#ifdef BREWCTL_HAS_DISPLAY

#include <Arduino.h>

namespace BrewControl {

class Ft3168Touch {
 public:
  // Expects Wire to be begun already (shared with the PMU and the RTC).
  void begin();

  // Reads the controller. Returns true while a finger is down; x/y are then
  // panel coordinates. Cheap enough to call at LVGL's indev rate.
  bool read(int16_t* x, int16_t* y);

  // Raw ring buffer of the last samples, for the bring-up endpoint.
  struct Sample { int16_t x, y; uint32_t ms; };
  static constexpr size_t kHistory = 8;
  size_t history(Sample* out, size_t cap) const;

  bool present() const { return present_; }

 private:
  static constexpr uint8_t kAddr = 0x38;

  bool present_ = false;
  Sample history_[kHistory] = {};
  size_t historyPos_ = 0;
  size_t historyCount_ = 0;
};

}  // namespace BrewControl

#endif  // BREWCTL_HAS_DISPLAY
