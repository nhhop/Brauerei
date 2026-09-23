#pragma once

// What the round display shows. Built on top of DisplayUI (which owns the
// panel and the LVGL driver); all code here runs on loopTask via
// lv_timer_handler().

#ifdef BREWCTL_HAS_DISPLAY

namespace BrewControl {

class DisplayPages {
 public:
  void begin();
};

}  // namespace BrewControl

#endif  // BREWCTL_HAS_DISPLAY
