#pragma once

// Panel + LVGL glue for the LilyGo T-Display-S3-AMOLED-1.75 (round 466x466
// CO5300 over QSPI). Only built where BREWCTL_HAS_DISPLAY is set; what is shown
// lives in DisplayPages, this class only gets pixels to the glass.
//
// Runs entirely on loopTask: tick() calls lv_timer_handler() from loop(), so
// every LVGL callback - and every Registry write a touch triggers - happens on
// the same task as registry.tick(). No locks, no queue.

#ifdef BREWCTL_HAS_DISPLAY

namespace BrewControl {

class DisplayUI {
 public:
  // Powers the panel up and registers the LVGL display driver. Leaves the
  // display dark (and tick() a no-op) if the panel does not answer or the
  // draw buffer cannot be allocated - the rest of the firmware keeps running.
  void begin();

  void tick();

  bool ready() const { return ready_; }

 private:
  bool ready_ = false;
};

}  // namespace BrewControl

#endif  // BREWCTL_HAS_DISPLAY
