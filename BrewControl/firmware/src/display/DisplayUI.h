#pragma once

// Panel + LVGL glue for the LilyGo T-Display-S3-AMOLED-1.75 (round 466x466
// CO5300 over QSPI). Only built where BREWCTL_HAS_DISPLAY is set; what is shown
// lives in DisplayPages, this class only gets pixels to the glass.
//
// Runs entirely on loopTask: tick() calls lv_timer_handler() from loop(), so
// every LVGL callback - and every Registry write a touch triggers - happens on
// the same task as registry.tick(). No locks, no queue.
//
// Burn-in protection: without a touch the panel dims, then goes dark, as set
// in SettingsStore (display.*). The touch that wakes it is withheld from LVGL
// until the finger lifts, so it cannot switch, step or swipe anything. While
// dark nothing is rendered - lv_timer_handler() does not run at all, only the
// touch controller is polled.

#ifdef BREWCTL_HAS_DISPLAY

#include <cstdint>

namespace BrewControl {

class SettingsStore;

class DisplayUI {
 public:
  // Powers the panel up and registers the LVGL display driver. Leaves the
  // display dark (and tick() a no-op) if the panel does not answer or the
  // draw buffer cannot be allocated - the rest of the firmware keeps running.
  void begin(const SettingsStore& settings);

  // holdAwake (the latched emergency stop) keeps full brightness and restarts
  // the idle time on every call.
  void tick(bool holdAwake);

  // Full brightness from the next tick on, idle time restarts - for events
  // worth a look, such as a new alert.
  void wake();

  bool ready() const { return ready_; }

 private:
  enum class Power : uint8_t { Awake, Dimmed, Off };

  bool ready_ = false;
  const SettingsStore* settings_ = nullptr;
  Power power_ = Power::Awake;
  uint8_t brightness_ = 0;   // last value written to the panel
  uint32_t lastPollMs_ = 0;  // touch poll while dark
};

}  // namespace BrewControl

#endif  // BREWCTL_HAS_DISPLAY
