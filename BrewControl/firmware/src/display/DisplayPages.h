#pragma once

// What the round display shows: one page per sensor, actuator and controller
// of a dashboard, swiped left/right; swiping up/down moves to the next or
// previous dashboard. The web grid layout is not interpreted. Built on
// DisplayUI, which owns the panel and the LVGL driver; everything here runs on
// loopTask via lv_timer_handler(), so touch actions call Registry directly,
// like registry.tick() does.
//
// Items are looked up by id on every refresh instead of holding pointers: the
// AsyncTCP task may delete one at any time (DynamicItems::remove*).
//
// Each actuator and controller page carries its master switch (setEnabled), as
// the web UI's cards do - for a Binary actuator that switch is the only control.
// Everything is read-only while the emergency stop is latched: the stop works
// by disabling every item, and the display must not undo it by accident. An
// actuator driven by an enabled controller or an active program is read-only
// too (the web UI asks for confirmation instead).

#ifdef BREWCTL_HAS_DISPLAY

#include <SensActCtrl.h>
#include <lvgl.h>

#include <string>
#include <vector>

#include "../DashboardStore.h"
#include "../ProgramRunner.h"
#include "../SettingsStore.h"
#include "../WebUI.h"

namespace BrewControl {

class DisplayPages {
 public:
  void begin(SensActCtrl::Registry& reg, DashboardStore& dashboards,
             ProgramRunner& programs, SettingsStore& settings, WebUI& webUI);

 private:
  enum class Kind : uint8_t { Sensor, Actuator, Controller };

  struct Page {
    Kind kind;
    std::string id;  // as listed in the dashboard; sensors may be "id.key"
    lv_obj_t* title = nullptr;
    lv_obj_t* value = nullptr;
    lv_obj_t* unit = nullptr;
    lv_obj_t* sub = nullptr;     // target ("Soll") / multi-channel lines
    lv_obj_t* out = nullptr;     // controller output / actuator interval
    lv_obj_t* footer = nullptr;
    lv_obj_t* arc = nullptr;     // ring: actual value, not touchable
    lv_obj_t* knob = nullptr;    // on the ring: target, the only grab point
    lv_obj_t* toggle = nullptr;  // master switch (actuator / controller)
    lv_obj_t* toggleLabel = nullptr;
    lv_obj_t* minus = nullptr;   // invisible tap zones on the ring, just
    lv_obj_t* plus = nullptr;    // before and after the knob: one step
    float lo = 0, hi = 100, step = 1;  // ring range in item units
  };

  void rebuild_(bool keepPage = true);
  void applyEstop_();
  void buildPage_(Page& p, lv_obj_t* tile, size_t index, size_t count);
  void buildActuator_(Page& p, lv_obj_t* tile);
  void buildInfoPage_(lv_obj_t* tile);
  void refresh_();
  void refreshVisible_();
  void refreshPage_(Page& p);

  // Why the item on p may not be changed from here; nullptr if it may.
  const char* lockReason_(const Page& p, char* buf, size_t cap) const;
  void write_(Page& p, float v);
  void setTarget_(Page& p, float v);

  static void onTimer_(lv_timer_t* t);
  static void onTileChanged_(lv_event_t* e);
  static void onKnob_(lv_event_t* e);
  static void onToggle_(lv_event_t* e);
  static void onStep_(lv_event_t* e);
  static void onGesture_(lv_event_t* e);

  SensActCtrl::Registry* reg_ = nullptr;
  DashboardStore* dashboards_ = nullptr;
  ProgramRunner* programs_ = nullptr;
  SettingsStore* settings_ = nullptr;
  WebUI* webUI_ = nullptr;

  // Appearance colors from the web UI settings: accent for the actual value
  // (ring, "on"), secondary for the controller output.
  lv_color_t accent_;
  lv_color_t secondary_;

  lv_obj_t* tileview_ = nullptr;
  std::vector<Page> pages_;
  uint32_t builtRevision_ = 0;
  size_t builtItemCount_ = 0;
  size_t dashIndex_ = 0;     // which dashboard is shown
  bool estopShown_ = false;  // red background is on
  uint32_t builtSettingsRevision_ = 0;
};

}  // namespace BrewControl

#endif  // BREWCTL_HAS_DISPLAY
