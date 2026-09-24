#include "DisplayPages.h"

#ifdef BREWCTL_HAS_DISPLAY

#include <ArduinoJson.h>
#include <WiFi.h>

#include <cmath>
#include <cstring>

namespace BrewControl {
namespace {

using SensActCtrl::Actuator;
using SensActCtrl::Channel;
using SensActCtrl::Controller;
using SensActCtrl::Registry;
using SensActCtrl::Sensor;
using SensActCtrl::ValueKind;

constexpr uint32_t kRefreshMs = 500;
constexpr size_t kMaxPages = 16;  // ~1.5 kB LVGL pool each, see rebuild_()
constexpr int16_t kArcSize = 420;  // leaves a 23 px rim on the 466 px glass
constexpr int16_t kArcWidth = 22;
constexpr int16_t kCentre = 233;  // tile coordinates, panel is 466 x 466
constexpr float kRingRadius = kArcSize / 2 - kArcWidth / 2;
constexpr int16_t kKnobSize = 48;
// Tap zones for one step down/up sit this far before/after the knob along the
// ring - clear of the knob (about 14 deg wide), close enough to find by feel.
constexpr int16_t kZoneSize = 56;
constexpr float kZoneOffset = 22.0f / 270.0f;

// Vertical layout, offsets from the centre. Top to bottom: title (top-aligned),
// target, actual value, unit, output/interval, master switch, footer.
constexpr lv_coord_t kYTarget = -88;
constexpr lv_coord_t kYValue = -24;
constexpr lv_coord_t kYUnit = 28;
constexpr lv_coord_t kYOut = 62;
constexpr lv_coord_t kYSteps = 124;  // master switch below the output

const lv_color_t kDim = lv_color_hex(0x9AA0A6);
const lv_color_t kOff = lv_color_hex(0x303030);
const lv_color_t kAlert = lv_color_hex(0xEF5350);
const lv_color_t kEstopBg = lv_color_hex(0xB71C1C);

// "67.5" -> "67,5": the UI is German. One decimal below a resolution of 1.
void formatValue(char* buf, size_t cap, float v, float resolution) {
  if (!std::isfinite(v)) {
    snprintf(buf, cap, "--");
    return;
  }
  snprintf(buf, cap, "%.*f", resolution >= 1.0f ? 0 : 1, v);
  for (char* c = buf; *c; ++c)
    if (*c == '.') *c = ',';
}

// Only touch the label if the text changed - every set invalidates its area,
// and redrawing the big 64 px value twice a second for nothing costs loop time.
void setText(lv_obj_t* label, const char* text) {
  if (label && strcmp(lv_label_get_text(label), text) != 0)
    lv_label_set_text(label, text);
}

// Dashboard sensor ids are either a sensor id or "sensorId.channelKey".
// Returns the sensor and sets *channel (-1: all channels of a multi-channel
// sensor listed by its bare id).
Sensor* resolveSensor(const Registry& reg, const std::string& id, int* channel) {
  if (Sensor* s = reg.findSensor(id.c_str())) {
    *channel = s->channelCount() == 1 ? 0 : -1;
    return s;
  }
  const size_t dot = id.rfind('.');
  if (dot == std::string::npos) return nullptr;
  Sensor* s = reg.findSensor(id.substr(0, dot).c_str());
  if (!s) return nullptr;
  const char* key = id.c_str() + dot + 1;
  for (size_t i = 0; i < s->channelCount(); ++i) {
    if (strcmp(s->channel(i).key, key) == 0) {
      *channel = static_cast<int>(i);
      return s;
    }
  }
  return nullptr;
}

size_t itemCount(const Registry& reg) {
  return reg.sensors().size() + reg.actuators().size() + reg.controllers().size();
}

// A controller's params name its sensor and the actuator(s) it drives.
bool controllerParams(const Controller& c, JsonDocument& doc) {
  char buf[512];
  if (c.paramsJson(buf, sizeof(buf)) == 0) return false;
  return deserializeJson(doc, buf) == DeserializationError::Ok;
}

// Mirrors controllerOwnerOf() in web/src/ownership.ts.
const Controller* controllerOwnerOf(const Registry& reg, const char* id) {
  for (const Controller* c : reg.controllers()) {
    JsonDocument doc;
    if (!controllerParams(*c, doc)) continue;
    for (const char* key : {"actuator", "heatActuator", "coolActuator"}) {
      const char* a = doc[key] | "";
      if (strcmp(a, id) == 0) return c;
    }
  }
  return nullptr;
}

const char* displayName(const Registry& reg, const char* id) {
  const char* label = reg.label(id);
  return *label ? label : id;
}

lv_obj_t* makeLabel(lv_obj_t* parent, const lv_font_t* font, lv_color_t color,
                    lv_align_t align, lv_coord_t y) {
  lv_obj_t* l = lv_label_create(parent);
  lv_obj_set_style_text_font(l, font, 0);
  lv_obj_set_style_text_color(l, color, 0);
  lv_obj_set_style_text_align(l, LV_TEXT_ALIGN_CENTER, 0);
  lv_label_set_text(l, "");
  lv_obj_align(l, align, 0, y);
  return l;
}

// The ring shows the actual value and takes no touch at all; the knob on it
// is the target and the only thing to grab. An lv_arc that is its own slider
// swallowed swipes all over the page (checked on the device), and it could
// not show actual and target at once.
lv_obj_t* makeRing(lv_obj_t* parent, lv_color_t actual) {
  lv_obj_t* arc = lv_arc_create(parent);
  lv_obj_set_size(arc, kArcSize, kArcSize);
  lv_obj_center(arc);
  lv_arc_set_rotation(arc, 135);
  lv_arc_set_bg_angles(arc, 0, 270);
  lv_arc_set_range(arc, 0, 1000);  // mapped onto the page's lo..hi
  lv_obj_set_style_arc_width(arc, kArcWidth, LV_PART_MAIN);
  lv_obj_set_style_arc_width(arc, kArcWidth, LV_PART_INDICATOR);
  lv_obj_set_style_arc_color(arc, actual, LV_PART_INDICATOR);
  lv_obj_set_style_bg_opa(arc, LV_OPA_TRANSP, LV_PART_KNOB);
  lv_obj_clear_flag(arc, LV_OBJ_FLAG_CLICKABLE);
  return arc;
}

lv_obj_t* makeKnob(lv_obj_t* parent) {
  lv_obj_t* k = lv_obj_create(parent);
  lv_obj_set_size(k, kKnobSize, kKnobSize);
  lv_obj_set_style_radius(k, LV_RADIUS_CIRCLE, 0);
  lv_obj_set_style_bg_color(k, lv_color_white(), 0);
  lv_obj_set_style_bg_color(k, kOff, LV_STATE_DISABLED);
  lv_obj_set_style_border_width(k, 4, 0);
  lv_obj_set_style_border_color(k, lv_color_black(), 0);
  lv_obj_set_ext_click_area(k, 18);  // a fingertip is wider than the knob
  // Dragging the knob must move the knob - not scroll the tileview, and not
  // switch the dashboard when the drag happens to run vertically.
  lv_obj_clear_flag(k, LV_OBJ_FLAG_SCROLLABLE);
  lv_obj_clear_flag(k, LV_OBJ_FLAG_SCROLL_CHAIN);
  lv_obj_clear_flag(k, LV_OBJ_FLAG_GESTURE_BUBBLE);
  return k;
}

lv_obj_t* makeStepZone(lv_obj_t* parent) {
  lv_obj_t* z = lv_obj_create(parent);
  lv_obj_set_size(z, kZoneSize, kZoneSize);
  lv_obj_set_style_bg_opa(z, LV_OPA_TRANSP, 0);
  lv_obj_set_style_border_width(z, 0, 0);
  lv_obj_clear_flag(z, LV_OBJ_FLAG_SCROLLABLE);
  return z;
}

float valueToFraction(float v, float lo, float hi) {
  if (!(hi > lo) || !std::isfinite(v)) return 0;
  return std::fmin(std::fmax((v - lo) / (hi - lo), 0.0f), 1.0f);
}

void placeOnRing(lv_obj_t* obj, float fraction, int16_t size) {
  const float rad = (135.0f + 270.0f * fraction) * static_cast<float>(M_PI) / 180;
  lv_obj_set_pos(
      obj, static_cast<lv_coord_t>(kCentre + kRingRadius * cosf(rad) - size / 2),
      static_cast<lv_coord_t>(kCentre + kRingRadius * sinf(rad) - size / 2));
}

// The knob and its two step zones move together.
void placeKnob(lv_obj_t* knob, lv_obj_t* minus, lv_obj_t* plus, float fraction) {
  placeOnRing(knob, fraction, kKnobSize);
  placeOnRing(minus, fraction - kZoneOffset, kZoneSize);
  placeOnRing(plus, fraction + kZoneOffset, kZoneSize);
}

// Angle of a touch point around the centre, as a fraction of the 270 deg
// scale. The 90 deg gap at the bottom snaps to the nearer end.
float pointToFraction(const lv_point_t& pt) {
  const float deg =
      atan2f(pt.y - kCentre, pt.x - kCentre) * 180 / static_cast<float>(M_PI);
  float rel = fmodf(deg - 135.0f + 720.0f, 360.0f);
  if (rel > 270.0f) rel = rel > 315.0f ? 0.0f : 270.0f;
  return rel / 270.0f;
}

void setRingValue(lv_obj_t* arc, float v, float lo, float hi) {
  const int16_t pos =
      static_cast<int16_t>(std::lround(valueToFraction(v, lo, hi) * 1000));
  if (lv_arc_get_value(arc) != pos) lv_arc_set_value(arc, pos);
}

// "#rrggbb" as stored by the web UI's appearance settings.
lv_color_t parseColor(const String& hex, uint32_t fallback) {
  if (hex.length() != 7 || hex[0] != '#') return lv_color_hex(fallback);
  return lv_color_hex(strtoul(hex.c_str() + 1, nullptr, 16));
}

// Share of an actuator's range, as the web UI's ControllerCard shows it.
bool outputPercent(const Registry& reg, const char* id, int* pct) {
  const Actuator* a = *id ? reg.findActuator(id) : nullptr;
  if (!a) return false;
  const auto meta = a->meta();
  if (!(meta.max > meta.min)) return false;
  *pct = static_cast<int>(std::lround(
      valueToFraction(a->state(), meta.min, meta.max) * 100));
  return true;
}

void setLocked(lv_obj_t* obj, bool locked) {
  if (!obj) return;
  if (locked)
    lv_obj_add_state(obj, LV_STATE_DISABLED);
  else
    lv_obj_clear_state(obj, LV_STATE_DISABLED);
}

}  // namespace

// ── Setup ───────────────────────────────────────────────────────────────────

void DisplayPages::begin(Registry& reg, DashboardStore& dashboards,
                         ProgramRunner& programs, SettingsStore& settings,
                         WebUI& webUI) {
  reg_ = &reg;
  dashboards_ = &dashboards;
  programs_ = &programs;
  settings_ = &settings;
  webUI_ = &webUI;
  lv_obj_set_style_bg_color(lv_scr_act(), lv_color_black(), 0);
  // Gestures bubble up from whatever was touched; the screen outlives every
  // rebuild, so the handler is registered once, here.
  lv_obj_add_event_cb(lv_scr_act(), onGesture_, LV_EVENT_GESTURE, this);
  rebuild_();
  lv_timer_create(onTimer_, kRefreshMs, this);
}

void DisplayPages::rebuild_(bool keepPage) {
  // Keep the visible item across a rebuild if it is still there.
  std::string current;
  if (keepPage && tileview_ && !pages_.empty()) {
    const lv_obj_t* act = lv_tileview_get_tile_act(tileview_);
    const size_t idx = lv_obj_get_index(act);
    if (idx < pages_.size()) current = pages_[idx].id;
  }

  builtRevision_ = dashboards_->revision();
  builtItemCount_ = itemCount(*reg_);
  builtSettingsRevision_ = settings_->revision();
  // Same defaults as SettingsStore, in case the stored value is malformed.
  accent_ = parseColor(settings_->accentColor(), 0x0078D4);
  secondary_ = parseColor(settings_->secondaryColor(), 0x22C55E);
  pages_.clear();
  lv_obj_clean(lv_scr_act());

  // Controllers first - on a brewing rig they are what you walk up to.
  // Stale ids (items deleted since the dashboard was edited) are skipped.
  const size_t dashCount = dashboards_->count();
  if (dashIndex_ >= dashCount) dashIndex_ = dashCount ? dashCount - 1 : 0;
  DashboardStore::Items items;
  if (dashboards_->dashboardAt(dashIndex_, items)) {
    int ch;
    for (const std::string& id : items.controllers)
      if (reg_->findController(id.c_str())) pages_.push_back(Page{Kind::Controller, id});
    for (const std::string& id : items.sensors)
      if (resolveSensor(*reg_, id, &ch)) pages_.push_back(Page{Kind::Sensor, id});
    for (const std::string& id : items.actuators)
      if (reg_->findActuator(id.c_str())) pages_.push_back(Page{Kind::Actuator, id});
  }
  // Every page lives in LVGL's static pool (lv_conf.h: LV_MEM_SIZE), and an
  // exhausted pool ends in LV_ASSERT's endless loop - a watchdog reboot, and
  // the same again on the next boot. Better a truncated dashboard.
  if (pages_.size() > kMaxPages) pages_.resize(kMaxPages);

  tileview_ = lv_tileview_create(lv_scr_act());
  lv_obj_set_style_bg_color(tileview_, lv_color_black(), 0);
  lv_obj_set_scrollbar_mode(tileview_, LV_SCROLLBAR_MODE_OFF);
  lv_obj_add_event_cb(tileview_, onTileChanged_, LV_EVENT_VALUE_CHANGED, this);
  estopShown_ = false;
  applyEstop_();

  if (pages_.empty()) {
    buildInfoPage_(lv_tileview_add_tile(tileview_, 0, 0, LV_DIR_NONE));
    return;
  }
  size_t show = 0;
  for (size_t i = 0; i < pages_.size(); ++i) {
    lv_dir_t dir = LV_DIR_NONE;
    if (i > 0) dir = static_cast<lv_dir_t>(dir | LV_DIR_LEFT);
    if (i + 1 < pages_.size()) dir = static_cast<lv_dir_t>(dir | LV_DIR_RIGHT);
    lv_obj_t* tile = lv_tileview_add_tile(tileview_, i, 0, dir);
    buildPage_(pages_[i], tile, i, pages_.size());
    lv_obj_t* pager = lv_obj_get_child(tile, -1);
    lv_label_set_text_fmt(pager, "%s · %u / %u", items.name.c_str(),
                          static_cast<unsigned>(i + 1),
                          static_cast<unsigned>(pages_.size()));
    if (pages_[i].id == current) show = i;
  }
  lv_obj_set_tile_id(tileview_, show, 0, LV_ANIM_OFF);
  refreshPage_(pages_[show]);
}

void DisplayPages::buildInfoPage_(lv_obj_t* tile) {
  lv_obj_t* l = makeLabel(tile, &brew_font_28, lv_color_white(), LV_ALIGN_CENTER, 0);
  lv_label_set_text_fmt(l, "BrewControl\n%s.local\n%s", WiFi.getHostname(),
                        WiFi.localIP().toString().c_str());
  lv_obj_t* hint = makeLabel(tile, &brew_font_20, kDim, LV_ALIGN_CENTER, 110);
  DashboardStore::Items items;
  if (dashboards_->dashboardAt(dashIndex_, items))
    lv_label_set_text_fmt(hint, "Dashboard \"%s\"\nist leer.", items.name.c_str());
  else
    lv_label_set_text(hint, "Kein Dashboard angelegt.");
}

void DisplayPages::buildPage_(Page& p, lv_obj_t* tile, size_t /*index*/,
                              size_t /*count*/) {
  p.title = makeLabel(tile, &brew_font_28, lv_color_white(), LV_ALIGN_TOP_MID, 62);
  lv_label_set_long_mode(p.title, LV_LABEL_LONG_DOT);
  lv_obj_set_width(p.title, 300);
  p.value = makeLabel(tile, &brew_font_64, lv_color_white(), LV_ALIGN_CENTER, kYValue);
  p.unit = makeLabel(tile, &brew_font_28, kDim, LV_ALIGN_CENTER, kYUnit);
  p.footer = makeLabel(tile, &brew_font_20, kDim, LV_ALIGN_BOTTOM_MID, -44);
  lv_obj_set_width(p.footer, 280);
  lv_label_set_long_mode(p.footer, LV_LABEL_LONG_DOT);

  if (p.kind == Kind::Sensor) {
    p.sub = makeLabel(tile, &brew_font_28, lv_color_white(), LV_ALIGN_CENTER, 0);
  }

  else if (p.kind == Kind::Controller) {
    Controller* c = reg_->findController(p.id.c_str());
    p.lo = 0;
    p.hi = 100;
    if (c->rangeMax() > c->rangeMin()) {
      p.lo = c->rangeMin();
      p.hi = c->rangeMax();
    } else {
      JsonDocument doc;
      int ch;
      if (controllerParams(*c, doc)) {
        if (Sensor* s = resolveSensor(*reg_, doc["sensor"] | "", &ch);
            s && ch >= 0 && s->channel(ch).meta.max > s->channel(ch).meta.min) {
          p.lo = s->channel(ch).meta.min;
          p.hi = s->channel(ch).meta.max;
        }
      }
    }
    p.step = p.hi - p.lo >= 10 ? 0.5f : 0.1f;
    p.arc = makeRing(tile, accent_);
    p.sub = makeLabel(tile, &brew_font_28, lv_color_white(), LV_ALIGN_CENTER, kYTarget);
    p.out = makeLabel(tile, &brew_font_20, secondary_, LV_ALIGN_CENTER, kYOut);
    p.toggle = lv_btn_create(tile);
    lv_obj_set_size(p.toggle, 72, 72);
    lv_obj_align(p.toggle, LV_ALIGN_CENTER, 0, kYSteps);
  } else {
    buildActuator_(p, tile);
  }

  if (p.arc) {
    p.minus = makeStepZone(tile);
    p.plus = makeStepZone(tile);
    p.knob = makeKnob(tile);
    lv_obj_add_event_cb(p.knob, onKnob_, LV_EVENT_ALL, this);
    lv_obj_add_event_cb(p.minus, onStep_, LV_EVENT_CLICKED, this);
    lv_obj_add_event_cb(p.plus, onStep_, LV_EVENT_CLICKED, this);
  }
  if (p.toggle) {
    // The master switch, as in the web UI's cards - for a Binary actuator it
    // is the only control there is. Locked: dimmed, and the footer says why.
    lv_obj_set_style_radius(p.toggle, LV_RADIUS_CIRCLE, 0);
    lv_obj_set_style_bg_opa(p.toggle, LV_OPA_40, LV_STATE_DISABLED);
    p.toggleLabel = lv_label_create(p.toggle);
    lv_obj_set_style_text_font(p.toggleLabel, &brew_font_28, 0);
    lv_obj_set_style_text_opa(p.toggleLabel, LV_OPA_50, LV_STATE_DISABLED);
    lv_obj_center(p.toggleLabel);
    lv_obj_add_event_cb(p.toggle, onToggle_, LV_EVENT_CLICKED, this);
  }
  // Last child, so rebuild_() finds it without another Page field.
  makeLabel(tile, &brew_font_20, kDim, LV_ALIGN_BOTTOM_MID, -18);
}

void DisplayPages::buildActuator_(Page& p, lv_obj_t* tile) {
  Actuator* a = reg_->findActuator(p.id.c_str());
  const auto meta = a->meta();
  if (meta.kind == ValueKind::Binary) {
    lv_obj_add_flag(p.value, LV_OBJ_FLAG_HIDDEN);
    lv_obj_add_flag(p.unit, LV_OBJ_FLAG_HIDDEN);
    p.toggle = lv_btn_create(tile);
    lv_obj_set_size(p.toggle, 200, 200);
    lv_obj_center(p.toggle);
    p.out = makeLabel(tile, &brew_font_20, kDim, LV_ALIGN_CENTER, 128);
  } else {
    p.toggle = lv_btn_create(tile);
    lv_obj_set_size(p.toggle, 72, 72);
    lv_obj_align(p.toggle, LV_ALIGN_CENTER, 0, kYSteps);
    p.out = makeLabel(tile, &brew_font_20, kDim, LV_ALIGN_CENTER, kYOut);
    if (meta.kind == ValueKind::Continuous && meta.max > meta.min) {
      p.lo = meta.min;
      p.hi = meta.max;
      p.step = meta.resolution > 0 ? meta.resolution : (p.hi - p.lo) / 100;
      p.arc = makeRing(tile, accent_);
      p.sub = makeLabel(tile, &brew_font_28, lv_color_white(), LV_ALIGN_CENTER, kYTarget);
    }
  }
}

// ── Refresh ─────────────────────────────────────────────────────────────────

void DisplayPages::onTimer_(lv_timer_t* t) {
  static_cast<DisplayPages*>(t->user_data)->refresh_();
}

// Only the page, never a rebuild: that would delete the tileview from inside
// its own event. The timer picks up a pending rebuild half a second later.
void DisplayPages::onTileChanged_(lv_event_t* e) {
  static_cast<DisplayPages*>(lv_event_get_user_data(e))->refreshVisible_();
}

void DisplayPages::refresh_() {
  if (dashboards_->revision() != builtRevision_ ||
      itemCount(*reg_) != builtItemCount_ ||
      settings_->revision() != builtSettingsRevision_) {
    rebuild_();
    return;
  }
  refreshVisible_();
}

// Red background while the emergency stop is latched. Only on a change:
// setting a style invalidates the whole screen.
void DisplayPages::applyEstop_() {
  const bool estop = webUI_->estopLatched();
  if (estop == estopShown_) return;
  estopShown_ = estop;
  lv_obj_set_style_bg_color(tileview_, estop ? kEstopBg : lv_color_black(), 0);
}

void DisplayPages::refreshVisible_() {
  applyEstop_();
  if (pages_.empty()) return;
  // Only the visible page: it is the only one whose pixels matter, and it
  // keeps the per-tick cost flat however long the dashboard is.
  const size_t idx = lv_obj_get_index(lv_tileview_get_tile_act(tileview_));
  if (idx < pages_.size()) refreshPage_(pages_[idx]);
}

const char* DisplayPages::lockReason_(const Page& p, char* buf,
                                      size_t cap) const {
  if (webUI_->estopLatched()) return "NOT-AUS aktiv";
  std::string program;
  if (p.kind == Kind::Actuator) {
    const Actuator* a = reg_->findActuator(p.id.c_str());
    if (!a) return "entfernt";
    const Controller* c = controllerOwnerOf(*reg_, p.id.c_str());
    if (c && c->enabled()) {
      snprintf(buf, cap, "geregelt von %s", displayName(*reg_, c->id()));
      return buf;
    }
  } else if (p.kind == Kind::Controller) {
    if (!reg_->findController(p.id.c_str())) return "entfernt";
  } else {
    return nullptr;
  }
  if (programs_->activeOwnerOf(p.id.c_str(), program)) {
    snprintf(buf, cap, "Programm %s", program.c_str());
    return buf;
  }
  return nullptr;
}

void DisplayPages::refreshPage_(Page& p) {
  char buf[96];
  char reason[64];

  if (p.kind == Kind::Sensor) {
    int ch = 0;
    Sensor* s = resolveSensor(*reg_, p.id, &ch);
    if (!s) {
      setText(p.footer, "entfernt");
      return;
    }
    if (ch >= 0) {
      const Channel c = s->channel(ch);
      snprintf(buf, sizeof(buf), "%s%s%s", displayName(*reg_, s->id()),
               *c.key ? " · " : "", c.key);
      setText(p.title, buf);
      formatValue(buf, sizeof(buf), c.reading.valid ? c.reading.value : NAN,
                  c.meta.resolution);
      setText(p.value, buf);
      setText(p.unit, c.meta.unit);
    } else {
      // A multi-channel sensor listed by its bare id: all channels as lines.
      setText(p.title, displayName(*reg_, s->id()));
      std::string lines;
      for (size_t i = 0; i < s->channelCount(); ++i) {
        const Channel c = s->channel(i);
        char v[24];
        formatValue(v, sizeof(v), c.reading.valid ? c.reading.value : NAN,
                    c.meta.resolution);
        snprintf(buf, sizeof(buf), "%s%s: %s %s", i ? "\n" : "", c.key, v,
                 c.meta.unit);
        lines += buf;
      }
      setText(p.sub, lines.c_str());
    }
    const char* fault = s->fault();
    setText(p.footer, fault ? fault : "");
    lv_obj_set_style_text_color(p.footer, fault ? kAlert : kDim, 0);
    return;
  }

  const char* lock = nullptr;
  if (p.kind == Kind::Controller) {
    Controller* c = reg_->findController(p.id.c_str());
    if (!c) {
      setText(p.footer, "entfernt");
      return;
    }
    setText(p.title, displayName(*reg_, c->id()));
    // The process value comes from the controller's sensor (params.sensor);
    // Controller has no accessor for it.
    JsonDocument doc;
    Sensor* s = nullptr;
    int ch = 0;
    if (controllerParams(*c, doc)) s = resolveSensor(*reg_, doc["sensor"] | "", &ch);
    float actual = NAN;
    if (s && ch >= 0) {
      const Channel pv = s->channel(ch);
      if (pv.reading.valid) actual = pv.reading.value;
      formatValue(buf, sizeof(buf), actual, pv.meta.resolution);
      setText(p.value, buf);
      setText(p.unit, pv.meta.unit);
    } else {
      setText(p.value, "--");
    }
    setRingValue(p.arc, actual, p.lo, p.hi);
    setTarget_(p, c->setpoint());
    // Output below the actual value, like the web UI: the driven actuator's
    // share of its range, both stages for a dual-output controller.
    int heat = 0, cool = 0;
    const bool hasHeat = outputPercent(*reg_, doc["heatActuator"] | "", &heat);
    const bool hasCool = outputPercent(*reg_, doc["coolActuator"] | "", &cool);
    if (hasHeat || hasCool) {
      if (hasHeat && hasCool)
        snprintf(buf, sizeof(buf), "Heizen %d %% · Kühlen %d %%", heat, cool);
      else
        snprintf(buf, sizeof(buf), "%s %d %%", hasHeat ? "Heizen" : "Kühlen",
                 hasHeat ? heat : cool);
      setText(p.out, buf);
    } else if (outputPercent(*reg_, doc["actuator"] | "", &heat)) {
      snprintf(buf, sizeof(buf), "Ausgang %d %%", heat);
      setText(p.out, buf);
    } else {
      setText(p.out, "");
    }
    lock = lockReason_(p, reason, sizeof(reason));
    // The setpoint stays adjustable while the controller is off, as in the
    // web UI.
    setLocked(p.knob, lock);
    setLocked(p.minus, lock);
    setLocked(p.plus, lock);
    setText(p.toggleLabel, LV_SYMBOL_POWER);
    lv_obj_set_style_bg_color(p.toggle, c->enabled() ? accent_ : kOff, 0);
    setLocked(p.toggle, lock);
    if (!lock && !c->enabled()) lock = "Regler aus";
  } else {
    Actuator* a = reg_->findActuator(p.id.c_str());
    if (!a) {
      setText(p.footer, "entfernt");
      return;
    }
    setText(p.title, displayName(*reg_, a->id()));
    const auto meta = a->meta();
    const bool enabled = a->enabled();
    lock = lockReason_(p, reason, sizeof(reason));
    const bool binary = meta.kind == ValueKind::Binary;
    if (binary)
      setText(p.toggleLabel, enabled ? LV_SYMBOL_POWER " AN" : LV_SYMBOL_POWER " AUS");
    else
      setText(p.toggleLabel, LV_SYMBOL_POWER);
    lv_obj_set_style_bg_color(p.toggle, enabled ? accent_ : kOff, 0);
    setLocked(p.toggle, lock);
    if (!binary) {
      formatValue(buf, sizeof(buf), a->state(), meta.resolution);
      setText(p.value, buf);
      setText(p.unit, meta.unit);
      if (p.arc) {
        setRingValue(p.arc, a->state(), p.lo, p.hi);
        setTarget_(p, a->target());
        // Like the web UI's slider: no value while switched off.
        setLocked(p.knob, lock || !enabled);
        setLocked(p.minus, lock || !enabled);
        setLocked(p.plus, lock || !enabled);
      }
      if (!lock && !enabled) lock = "aus";
    }
    const auto iv = a->interval();
    if (iv.has) {
      snprintf(buf, sizeof(buf), "Intervall %u s / %u s",
               static_cast<unsigned>(iv.onSec), static_cast<unsigned>(iv.periodSec));
      setText(p.out, buf);
    } else {
      setText(p.out, "");
    }
    if (!lock && a->fault()) {
      setText(p.footer, a->fault());
      lv_obj_set_style_text_color(p.footer, kAlert, 0);
      return;
    }
  }
  setText(p.footer, lock ? lock : "");
  lv_obj_set_style_text_color(
      p.footer, webUI_->estopLatched() ? lv_color_white() : kDim, 0);
}

// ── Touch ───────────────────────────────────────────────────────────────────

void DisplayPages::write_(Page& p, float v) {
  char reason[64];
  if (lockReason_(p, reason, sizeof(reason))) return;  // raced a state change
  v = std::fmin(std::fmax(v, p.lo), p.hi);
  if (p.kind == Kind::Controller) {
    if (Controller* c = reg_->findController(p.id.c_str())) c->setSetpoint(v);
  } else if (Actuator* a = reg_->findActuator(p.id.c_str())) {
    if (!a->enabled()) return;
    a->write(v);
  }
  refreshPage_(p);
}

// Knob position and "Soll" label, unless the user is dragging the knob -
// then both belong to the drag until release.
void DisplayPages::setTarget_(Page& p, float v) {
  if (lv_obj_has_state(p.knob, LV_STATE_PRESSED)) return;
  placeKnob(p.knob, p.minus, p.plus, valueToFraction(v, p.lo, p.hi));
  char num[24], buf[32];
  formatValue(num, sizeof(num), v, p.step);
  snprintf(buf, sizeof(buf), "Soll %s", num);
  setText(p.sub, buf);
}

void DisplayPages::onKnob_(lv_event_t* e) {
  auto* self = static_cast<DisplayPages*>(lv_event_get_user_data(e));
  lv_obj_t* knob = lv_event_get_target(e);
  const lv_event_code_t code = lv_event_get_code(e);
  if (code != LV_EVENT_PRESSING && code != LV_EVENT_RELEASED) return;
  for (Page& p : self->pages_) {
    if (p.knob != knob) continue;
    lv_point_t pt;
    lv_indev_get_point(lv_indev_get_act(), &pt);
    const float t = pointToFraction(pt);
    const float v = std::round((p.lo + t * (p.hi - p.lo)) / p.step) * p.step;
    if (code == LV_EVENT_PRESSING) {
      // Live preview while dragging; written on release only, so a drag
      // across the range doesn't fire a stream of writes.
      placeKnob(knob, p.minus, p.plus, valueToFraction(v, p.lo, p.hi));
      char num[24], buf[32];
      formatValue(num, sizeof(num), v, p.step);
      snprintf(buf, sizeof(buf), "Soll %s", num);
      setText(p.sub, buf);
    } else {
      self->write_(p, v);
    }
    return;
  }
}

void DisplayPages::onToggle_(lv_event_t* e) {
  auto* self = static_cast<DisplayPages*>(lv_event_get_user_data(e));
  lv_obj_t* btn = lv_event_get_target(e);
  for (Page& p : self->pages_) {
    if (p.toggle != btn) continue;
    char reason[64];
    if (self->lockReason_(p, reason, sizeof(reason))) return;
    if (p.kind == Kind::Controller) {
      Controller* c = self->reg_->findController(p.id.c_str());
      if (!c) return;
      const bool turnOff = c->enabled();
      c->setEnabled(!turnOff);
      // Like ControllerCard.doToggle(): a controller switched off leaves its
      // outputs where it last drove them, so put them at rest.
      JsonDocument doc;
      if (turnOff && controllerParams(*c, doc)) {
        if (Actuator* a = self->reg_->findActuator(doc["actuator"] | ""))
          a->write(doc["min"] | 0.0f);
        for (const char* key : {"heatActuator", "coolActuator"})
          if (Actuator* a = self->reg_->findActuator(doc[key] | "")) a->write(0);
      }
    } else if (Actuator* a = self->reg_->findActuator(p.id.c_str())) {
      a->setEnabled(!a->enabled());
    }
    self->refreshPage_(p);
    return;
  }
}

void DisplayPages::onStep_(lv_event_t* e) {
  auto* self = static_cast<DisplayPages*>(lv_event_get_user_data(e));
  lv_obj_t* btn = lv_event_get_target(e);
  for (Page& p : self->pages_) {
    if (p.minus != btn && p.plus != btn) continue;
    float current;
    if (p.kind == Kind::Controller) {
      Controller* c = self->reg_->findController(p.id.c_str());
      if (!c) return;
      current = c->setpoint();
    } else {
      Actuator* a = self->reg_->findActuator(p.id.c_str());
      if (!a) return;
      current = a->target();
    }
    const float d = p.plus == btn ? p.step : -p.step;
    self->write_(p, std::round((current + d) / p.step) * p.step);
    return;
  }
}

// Up: next dashboard, down: previous - like scrolling a list. The rebuild runs
// asynchronously because this is called from inside an event of an object the
// rebuild deletes, and lv_indev_wait_release() keeps the release of this very
// swipe from counting as a click on whatever it started on.
void DisplayPages::onGesture_(lv_event_t* e) {
  auto* self = static_cast<DisplayPages*>(lv_event_get_user_data(e));
  lv_indev_t* indev = lv_indev_get_act();
  const lv_dir_t dir = lv_indev_get_gesture_dir(indev);
  size_t next = self->dashIndex_;
  if (dir == LV_DIR_TOP && next + 1 < self->dashboards_->count())
    ++next;
  else if (dir == LV_DIR_BOTTOM && next > 0)
    --next;
  else
    return;
  lv_indev_wait_release(indev);
  self->dashIndex_ = next;
  lv_async_call(
      [](void* p) { static_cast<DisplayPages*>(p)->rebuild_(false); }, self);
}

}  // namespace BrewControl

#endif  // BREWCTL_HAS_DISPLAY
