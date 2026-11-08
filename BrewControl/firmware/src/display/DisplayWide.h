#pragma once

// The wide layout for the 1024 x 600 RGB panel of the Waveshare ESP32-S3-Touch-
// LCD-5B (mockup "Entwurf B"): a tab bar with the dashboards, an overview of
// tiles - one per controller, sensor and actuator - and, on a tap, a detail
// sheet with the big controls and a rail of all items on the left. A latched
// emergency stop covers everything with a red screen, the connection field in
// the tab bar opens a dialog with a QR code for the web UI.
//
// Same contract as DisplayPages (which this replaces on that board): everything
// runs on loopTask via lv_timer_handler(), items are looked up by id on every
// refresh and never held (AsyncTCP may delete one at any time), and no
// object is ever deleted from inside its own event - sheets, dialogs and
// rebuilds go through lv_async_call.
//
// Program, timer and chart items are not shown yet; they have no display
// counterpart (PLAN.md).

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

class DisplayWide {
 public:
  void begin(SensActCtrl::Registry& reg, DashboardStore& dashboards,
             ProgramRunner& programs, SettingsStore& settings, WebUI& webUI);

 private:
  enum class Kind : uint8_t { Sensor, Actuator, Controller };

  // What one item looks like right now: filled by info_(), used by the tile,
  // the rail row and the sheet alike.
  struct Info {
    char name[48] = "";
    char value[24] = "--";
    char unit[12] = "";
    char status[72] = "";   // why it may not be changed / the fault
    char outText[40] = "";  // controller output / actuator interval
    char lines[200] = "";   // multi-channel sensor: one line per channel
    float actual = NAN, target = NAN;
    float lo = 0, hi = 100, step = 1;
    int outPct = -1;        // share of the driven actuator's range, -1 none
    bool enabled = false;
    bool locked = false;    // read-only (e-stop, owner, removed)
    bool fault = false;     // status is a fault, not a lock reason
    bool binary = false;
    bool multi = false;     // sensor with several channels
    bool hasRange = false;
  };

  struct Item {
    Kind kind;
    std::string id;
    lv_obj_t* tile = nullptr;
    lv_obj_t* title = nullptr;
    lv_obj_t* value = nullptr;
    lv_obj_t* unit = nullptr;
    lv_obj_t* arc = nullptr;
    lv_obj_t* knob = nullptr;  // controller: the target on the ring
    lv_obj_t* soll = nullptr;
    lv_obj_t* out = nullptr;
    lv_obj_t* bar = nullptr;
    lv_obj_t* status = nullptr;
  };

  // The open detail sheet; root == nullptr when closed.
  struct Sheet {
    lv_obj_t* root = nullptr;
    size_t index = 0;  // into items_
    lv_obj_t* title = nullptr;
    lv_obj_t* sub = nullptr;
    lv_obj_t* sw = nullptr;       // master switch
    lv_obj_t* chip = nullptr;     // sensor status chip
    lv_obj_t* chipLabel = nullptr;
    lv_obj_t* value = nullptr;
    lv_obj_t* unit = nullptr;
    lv_obj_t* label = nullptr;    // "IST", range label, ...
    lv_obj_t* lines = nullptr;    // multi-channel sensor
    lv_obj_t* arc = nullptr;
    lv_obj_t* knob = nullptr;
    lv_obj_t* soll = nullptr;
    lv_obj_t* sollUnit = nullptr;
    lv_obj_t* out = nullptr;
    lv_obj_t* bar = nullptr;
    lv_obj_t* note = nullptr;
    lv_obj_t* toggle = nullptr;
    lv_obj_t* toggleLabel = nullptr;
    lv_obj_t* steps[4] = {};      // -big -small +small +big
    lv_obj_t* minMax[2] = {};     // range labels of a sensor
    std::vector<lv_obj_t*> rows;  // rail rows
    std::vector<lv_obj_t*> rowValue;
    float lo = 0, hi = 100, step = 1, big = 1;
    bool dragging = false;
  };

  void rebuild_();
  void buildTabs_();
  void buildTile_(Item& it, size_t index);
  void showPage_(size_t page);
  void applyEstop_();
  void refresh_();
  void refreshTiles_();
  void refreshSheet_();
  void refreshDialog_();

  bool info_(Kind kind, const std::string& id, Info& out) const;
  const char* lockReason_(Kind kind, const std::string& id, char* buf, size_t cap) const;
  void write_(Kind kind, const std::string& id, float v, float lo, float hi);
  void stepBy_(float delta);

  void openSheet_(size_t index);
  void closeSheet_();
  void buildRail_(lv_obj_t* parent, int active, bool red, std::vector<lv_obj_t*>* rows,
                  std::vector<lv_obj_t*>* values);
  void openDialog_();
  void closeDialog_();
  void showEstop_(bool on);

  static void onTimer_(lv_timer_t* t);
  static void onTab_(lv_event_t* e);
  static void onTile_(lv_event_t* e);
  static void onGesture_(lv_event_t* e);
  static void onBack_(lv_event_t* e);
  static void onRail_(lv_event_t* e);
  static void onSwitch_(lv_event_t* e);
  static void onToggle_(lv_event_t* e);
  static void onKnob_(lv_event_t* e);
  static void onStep_(lv_event_t* e);
  static void onWifi_(lv_event_t* e);
  static void onDialogClose_(lv_event_t* e);

  SensActCtrl::Registry* reg_ = nullptr;
  DashboardStore* dashboards_ = nullptr;
  ProgramRunner* programs_ = nullptr;
  SettingsStore* settings_ = nullptr;
  WebUI* webUI_ = nullptr;

  lv_color_t accent_;
  lv_color_t secondary_;

  lv_obj_t* root_ = nullptr;  // tabs, tiles, page dots - rebuilt as a whole
  std::vector<lv_obj_t*> tabs_;
  std::vector<lv_obj_t*> dots_;
  std::vector<Item> items_;
  Sheet sheet_;
  lv_obj_t* dialog_ = nullptr;      // scrim of the connection dialog
  lv_obj_t* dialogRssi_ = nullptr;
  lv_obj_t* dialogIp_ = nullptr;
  lv_obj_t* estop_ = nullptr;       // red cover while the stop is latched

  size_t dashIndex_ = 0;
  size_t page_ = 0;
  size_t pageCount_ = 1;
  size_t pendingOpen_ = 0;
  size_t pendingDash_ = 0;
  uint32_t builtRevision_ = 0;
  size_t builtItemCount_ = 0;
  uint32_t builtSettingsRevision_ = 0;
};

}  // namespace BrewControl

#endif  // BREWCTL_HAS_DISPLAY
