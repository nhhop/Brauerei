#include "DisplayWide.h"

#ifdef BREWCTL_HAS_DISPLAY

#include <ArduinoJson.h>
#include <WiFi.h>

#include <algorithm>
#include <cmath>
#include <cstring>

#include "DisplayCommon.h"

namespace BrewControl {
using namespace dispcommon;
namespace {

using SensActCtrl::Channel;
using SensActCtrl::ValueKind;

constexpr uint32_t kRefreshMs = 500;
constexpr lv_coord_t kW = 1024, kH = 600;
constexpr lv_coord_t kTabH = 90;
constexpr lv_coord_t kWifiW = 89;  // square connection field at the right end of the tab bar
constexpr lv_coord_t kRailW = 96;
constexpr size_t kMaxItems = 32;  // ~1 kB LVGL pool each, see lv_conf.h
constexpr size_t kPerPage = 8;
constexpr lv_coord_t kCols = 4;
constexpr lv_coord_t kTileW = 236, kTileH = 215, kGap = 16;
constexpr lv_coord_t kGridX = 16, kGridY = kTabH + 16;

// Detail sheet: the regulator ring (centre and radius of the arc's track).
constexpr lv_coord_t kRingSize = 360, kRingX = 134, kRingY = 140, kRingWidth = 25;
constexpr float kRingCx = kRingX + kRingSize / 2.0f, kRingCy = kRingY + kRingSize / 2.0f;
constexpr float kRingR = kRingSize / 2.0f - kRingWidth / 2.0f;
constexpr lv_coord_t kKnob = 40;

const lv_color_t kPanel = lv_color_hex(0x17171A);
const lv_color_t kPanelEdge = lv_color_hex(0x2E2E34);
const lv_color_t kButton = lv_color_hex(0x1F1F24);
const lv_color_t kTrack = lv_color_hex(0x26262A);
const lv_color_t kRail = lv_color_hex(0x0E0E10);
const lv_color_t kRailActive = lv_color_hex(0x14283D);
const lv_color_t kActiveText = lv_color_hex(0x5BB0FF);
const lv_color_t kOk = lv_color_hex(0x4ADE80);

// ── Small widget helpers ────────────────────────────────────────────────────

lv_obj_t* box(lv_obj_t* parent, lv_coord_t x, lv_coord_t y, lv_coord_t w, lv_coord_t h,
              lv_color_t bg, lv_coord_t radius = 0, bool solid = true) {
  lv_obj_t* o = lv_obj_create(parent);
  lv_obj_remove_style_all(o);
  lv_obj_set_pos(o, x, y);
  lv_obj_set_size(o, w, h);
  lv_obj_set_style_bg_color(o, bg, 0);
  lv_obj_set_style_bg_opa(o, solid ? LV_OPA_COVER : LV_OPA_TRANSP, 0);
  lv_obj_set_style_radius(o, radius, 0);
  lv_obj_clear_flag(o, static_cast<lv_obj_flag_t>(LV_OBJ_FLAG_SCROLLABLE | LV_OBJ_FLAG_CLICKABLE));
  return o;
}

// Makes a box tappable, with a visible press.
void tappable(lv_obj_t* o) {
  lv_obj_add_flag(o, LV_OBJ_FLAG_CLICKABLE);
  lv_obj_set_style_bg_color(o, lv_color_hex(0x2C2C33), LV_STATE_PRESSED);
  lv_obj_set_style_bg_opa(o, LV_OPA_COVER, LV_STATE_PRESSED);
}

lv_obj_t* label(lv_obj_t* parent, const lv_font_t* font, lv_color_t color, lv_coord_t x,
                lv_coord_t y, const char* text = "", lv_coord_t w = 0,
                lv_text_align_t align = LV_TEXT_ALIGN_LEFT) {
  lv_obj_t* l = lv_label_create(parent);
  lv_obj_set_style_text_font(l, font, 0);
  lv_obj_set_style_text_color(l, color, 0);
  lv_obj_set_style_text_align(l, align, 0);
  lv_label_set_text(l, text);
  if (w > 0) {
    lv_obj_set_width(l, w);
    lv_label_set_long_mode(l, LV_LABEL_LONG_DOT);
  }
  lv_obj_set_pos(l, x, y);
  return l;
}

// A big value with its unit hanging off the baseline. Flex keeps the unit next
// to the value however wide the digits turn out.
lv_obj_t* valueRow(lv_obj_t* parent, lv_coord_t x, lv_coord_t y, lv_coord_t w, lv_coord_t h,
                   const lv_font_t* valueFont, lv_color_t valueColor, const lv_font_t* unitFont,
                   lv_obj_t** value, lv_obj_t** unit) {
  lv_obj_t* row = box(parent, x, y, w, h, lv_color_black(), 0, false);
  lv_obj_set_flex_flow(row, LV_FLEX_FLOW_ROW);
  lv_obj_set_flex_align(row, LV_FLEX_ALIGN_START, LV_FLEX_ALIGN_END, LV_FLEX_ALIGN_END);
  lv_obj_set_style_pad_column(row, 8, 0);
  *value = label(row, valueFont, valueColor, 0, 0);
  *unit = label(row, unitFont, kDim, 0, 0);
  return row;
}

lv_obj_t* bar(lv_obj_t* parent, lv_coord_t x, lv_coord_t y, lv_coord_t w, lv_coord_t h,
              lv_color_t fill) {
  lv_obj_t* b = lv_bar_create(parent);
  lv_obj_remove_style_all(b);
  lv_obj_set_pos(b, x, y);
  lv_obj_set_size(b, w, h);
  lv_bar_set_range(b, 0, 1000);
  lv_obj_set_style_bg_opa(b, LV_OPA_COVER, LV_PART_MAIN);
  lv_obj_set_style_bg_color(b, kTrack, LV_PART_MAIN);
  lv_obj_set_style_radius(b, h / 2, LV_PART_MAIN);
  lv_obj_set_style_bg_opa(b, LV_OPA_COVER, LV_PART_INDICATOR);
  lv_obj_set_style_bg_color(b, fill, LV_PART_INDICATOR);
  lv_obj_set_style_radius(b, h / 2, LV_PART_INDICATOR);
  return b;
}

void setBar(lv_obj_t* b, float fraction) {
  const int v = static_cast<int>(std::lround(fraction * 1000));
  if (lv_bar_get_value(b) != v) lv_bar_set_value(b, v, LV_ANIM_OFF);
}

// The actual value as a ring (a track plus an indicator, no knob, no touch).
lv_obj_t* ring(lv_obj_t* parent, lv_coord_t x, lv_coord_t y, lv_coord_t size, lv_coord_t width,
               lv_color_t actual) {
  lv_obj_t* arc = lv_arc_create(parent);
  lv_obj_set_pos(arc, x, y);
  lv_obj_set_size(arc, size, size);
  lv_arc_set_rotation(arc, 135);
  lv_arc_set_bg_angles(arc, 0, 270);
  lv_arc_set_range(arc, 0, 1000);
  lv_obj_set_style_arc_width(arc, width, LV_PART_MAIN);
  lv_obj_set_style_arc_width(arc, width, LV_PART_INDICATOR);
  lv_obj_set_style_arc_color(arc, kTrack, LV_PART_MAIN);
  lv_obj_set_style_arc_color(arc, actual, LV_PART_INDICATOR);
  lv_obj_set_style_arc_rounded(arc, true, LV_PART_MAIN);
  lv_obj_set_style_arc_rounded(arc, true, LV_PART_INDICATOR);
  lv_obj_set_style_bg_opa(arc, LV_OPA_TRANSP, LV_PART_KNOB);
  lv_obj_set_style_pad_all(arc, 0, LV_PART_KNOB);
  lv_obj_clear_flag(arc, LV_OBJ_FLAG_CLICKABLE);
  return arc;
}

void setRingValue(lv_obj_t* arc, float v, float lo, float hi) {
  const int16_t pos = static_cast<int16_t>(std::lround(valueToFraction(v, lo, hi) * 1000));
  if (lv_arc_get_value(arc) != pos) lv_arc_set_value(arc, pos);
}

lv_obj_t* knob(lv_obj_t* parent, lv_coord_t size, lv_coord_t edge, lv_color_t edgeColor) {
  lv_obj_t* k = box(parent, 0, 0, size, size, lv_color_white(), LV_RADIUS_CIRCLE);
  lv_obj_set_style_bg_color(k, kOff, LV_STATE_DISABLED);
  lv_obj_set_style_border_width(k, edge, 0);
  lv_obj_set_style_border_color(k, edgeColor, 0);
  return k;
}

// Places a knob on a ring that starts at 135 degrees and spans 270.
void placeOnRing(lv_obj_t* obj, float fraction, float cx, float cy, float r, lv_coord_t size) {
  const float rad = (135.0f + 270.0f * fraction) * static_cast<float>(M_PI) / 180;
  lv_obj_set_pos(obj, static_cast<lv_coord_t>(std::lround(cx + r * cosf(rad) - size / 2.0f)),
                 static_cast<lv_coord_t>(std::lround(cy + r * sinf(rad) - size / 2.0f)));
}

// Angle of a touch point around the sheet ring's centre as a fraction of the
// 270 degree scale; the 90 degree gap at the bottom snaps to the nearer end.
float pointToFraction(const lv_point_t& pt) {
  const float deg = atan2f(pt.y - kRingCy, pt.x - kRingCx) * 180 / static_cast<float>(M_PI);
  float rel = fmodf(deg - 135.0f + 720.0f, 360.0f);
  if (rel > 270.0f) rel = rel > 315.0f ? 0.0f : 270.0f;
  return rel / 270.0f;
}

void stepText(char* buf, size_t cap, char sign, float v) {
  snprintf(buf, cap, "%c%g", sign, v);
  for (char* c = buf; *c; ++c)
    if (*c == '.') *c = ',';
}

void restyleTab(lv_obj_t* tab, bool active, lv_color_t accent) {
  lv_obj_set_style_bg_color(tab, kRailActive, 0);
  lv_obj_set_style_bg_opa(tab, active ? LV_OPA_COVER : LV_OPA_TRANSP, 0);
  lv_obj_set_style_border_side(tab, LV_BORDER_SIDE_BOTTOM, 0);
  lv_obj_set_style_border_width(tab, 4, 0);
  lv_obj_set_style_border_color(tab, accent, 0);
  lv_obj_set_style_border_opa(tab, active ? LV_OPA_COVER : LV_OPA_TRANSP, 0);
}

}  // namespace

// ── Setup ───────────────────────────────────────────────────────────────────

void DisplayWide::begin(Registry& reg, DashboardStore& dashboards, ProgramRunner& programs,
                        SettingsStore& settings, WebUI& webUI) {
  reg_ = &reg;
  dashboards_ = &dashboards;
  programs_ = &programs;
  settings_ = &settings;
  webUI_ = &webUI;
  lv_obj_set_style_bg_color(lv_scr_act(), lv_color_black(), 0);
  lv_obj_clear_flag(lv_scr_act(), LV_OBJ_FLAG_SCROLLABLE);
  // Gestures bubble up from whatever was touched; the screen outlives every
  // rebuild, so the handler is registered once, here.
  lv_obj_add_event_cb(lv_scr_act(), onGesture_, LV_EVENT_GESTURE, this);
  root_ = box(lv_scr_act(), 0, 0, kW, kH, lv_color_black(), 0, false);
  rebuild_();
  lv_timer_create(onTimer_, kRefreshMs, this);
}

void DisplayWide::rebuild_() {
  closeDialog_();
  closeSheet_();
  builtRevision_ = dashboards_->revision();
  builtItemCount_ = itemCount(*reg_);
  builtSettingsRevision_ = settings_->revision();
  accent_ = parseColor(settings_->accentColor(), 0x0078D4);
  secondary_ = parseColor(settings_->secondaryColor(), 0x22C55E);
  items_.clear();
  tabs_.clear();
  dots_.clear();
  lv_obj_clean(root_);

  const size_t dashCount = dashboards_->count();
  if (dashIndex_ >= dashCount) dashIndex_ = dashCount ? dashCount - 1 : 0;
  DashboardStore::Items list;
  if (dashboards_->dashboardAt(dashIndex_, list)) {
    // Controllers first - on a brewing rig they are what you walk up to. Stale
    // ids (items deleted since the dashboard was edited) are skipped.
    int ch;
    for (const std::string& id : list.controllers)
      if (reg_->findController(id.c_str())) items_.push_back(Item{Kind::Controller, id});
    for (const std::string& id : list.sensors)
      if (resolveSensor(*reg_, id, &ch)) items_.push_back(Item{Kind::Sensor, id});
    for (const std::string& id : list.actuators)
      if (reg_->findActuator(id.c_str())) items_.push_back(Item{Kind::Actuator, id});
  }
  // Every tile lives in LVGL's pool; an exhausted pool ends in the watchdog.
  if (items_.size() > kMaxItems) items_.resize(kMaxItems);
  pageCount_ = std::max<size_t>(1, (items_.size() + kPerPage - 1) / kPerPage);
  if (page_ >= pageCount_) page_ = 0;

  buildTabs_();
  for (size_t i = 0; i < items_.size(); ++i) buildTile_(items_[i], i);
  if (items_.empty()) {
    lv_obj_t* l = label(root_, &brew_font_28, lv_color_white(), 0, 250,
                        "", kW, LV_TEXT_ALIGN_CENTER);
    char buf[160];
    snprintf(buf, sizeof(buf), "%s\nDashboard \"%s\" ist leer.", WiFi.localIP().toString().c_str(),
             list.name.c_str());
    lv_label_set_text(l, buf);
  }
  // Page dots, centred at the bottom.
  if (pageCount_ > 1) {
    const lv_coord_t w = static_cast<lv_coord_t>(pageCount_ * 16 - 8);
    for (size_t i = 0; i < pageCount_; ++i)
      dots_.push_back(box(root_, (kW - w) / 2 + static_cast<lv_coord_t>(i) * 16, kH - 24, 8, 8,
                          kOff, LV_RADIUS_CIRCLE));
  }
  showPage_(page_);
  applyEstop_();
  refreshTiles_();
}

void DisplayWide::buildTabs_() {
  lv_obj_t* bar = box(root_, 0, 0, kW, kTabH, kRail);
  lv_obj_set_style_border_side(bar, LV_BORDER_SIDE_BOTTOM, 0);
  lv_obj_set_style_border_width(bar, 1, 0);
  lv_obj_set_style_border_color(bar, kTrack, 0);
  const size_t n = std::max<size_t>(1, dashboards_->count());
  const lv_coord_t w =
      static_cast<lv_coord_t>(std::min<size_t>(200, (kW - kWifiW) / n));
  for (size_t i = 0; i < n; ++i) {
    DashboardStore::Items list;
    const bool has = dashboards_->dashboardAt(i, list);
    lv_obj_t* tab = box(bar, static_cast<lv_coord_t>(i) * w, 0, w, kTabH - 1, kRailActive);
    tappable(tab);
    restyleTab(tab, i == dashIndex_, accent_);
    char buf[32];
    snprintf(buf, sizeof(buf), "%u Elemente",
             static_cast<unsigned>(list.controllers.size() + list.sensors.size() +
                                   list.actuators.size()));
    label(tab, &brew_font_28, i == dashIndex_ ? kActiveText : lv_color_white(), 0, 16,
          has ? list.name.c_str() : "-", w, LV_TEXT_ALIGN_CENTER);
    label(tab, &brew_font_20, lv_color_white(), 0, 50, buf, w, LV_TEXT_ALIGN_CENTER);
    lv_obj_add_event_cb(tab, onTab_, LV_EVENT_CLICKED, this);
    tabs_.push_back(tab);
  }
  // The connection field: square, at the right end.
  lv_obj_t* wifi = box(bar, kW - kWifiW, 0, kWifiW, kTabH - 1, kRail);
  lv_obj_set_style_border_side(wifi, LV_BORDER_SIDE_LEFT, 0);
  lv_obj_set_style_border_width(wifi, 1, 0);
  lv_obj_set_style_border_color(wifi, kTrack, 0);
  tappable(wifi);
  lv_obj_t* icon = label(wifi, &brew_font_28, kDim, 0, 28, LV_SYMBOL_WIFI, kWifiW, LV_TEXT_ALIGN_CENTER);
  (void)icon;
  lv_obj_add_event_cb(wifi, onWifi_, LV_EVENT_CLICKED, this);
}

void DisplayWide::buildTile_(Item& it, size_t index) {
  const size_t slot = index % kPerPage;
  const lv_coord_t x = kGridX + static_cast<lv_coord_t>(slot % kCols) * (kTileW + kGap);
  const lv_coord_t y = kGridY + static_cast<lv_coord_t>(slot / kCols) * (kTileH + kGap);
  const bool ctl = it.kind == Kind::Controller;
  lv_obj_t* t = box(root_, x, y, kTileW, kTileH, lv_color_hex(ctl ? 0x0F1A26 : 0x121214), 20);
  lv_obj_set_style_border_width(t, ctl ? 2 : 1, 0);
  lv_obj_set_style_border_color(t, ctl ? accent_ : kTrack, 0);
  tappable(t);
  lv_obj_add_event_cb(t, onTile_, LV_EVENT_CLICKED, this);
  it.tile = t;
  it.title = label(t, &brew_font_20, lv_color_white(), 14, 12, "", 140);
  label(t, &brew_font_20, kDim, 150, 12,
        ctl ? "Regler" : it.kind == Kind::Sensor ? "Sensor" : "Aktor", 70, LV_TEXT_ALIGN_RIGHT);

  if (ctl) {
    it.arc = ring(t, 62, 38, 112, 12, accent_);
    it.value = label(t, &brew_font_28, lv_color_white(), 62, 70, "", 112, LV_TEXT_ALIGN_CENTER);
    it.unit = label(t, &brew_font_20, kDim, 62, 104, "", 112, LV_TEXT_ALIGN_CENTER);
    it.knob = knob(t, 18, 3, lv_color_hex(0x0F1A26));  // the target
    label(t, &brew_font_20, kDim, 14, 158, "SOLL");
    it.soll = label(t, &brew_font_28, lv_color_white(), 80, 152, "", 140, LV_TEXT_ALIGN_RIGHT);
    label(t, &brew_font_20, kDim, 14, 184, "AUSGANG");
    it.out = label(t, &brew_font_20, secondary_, 100, 184, "", 120, LV_TEXT_ALIGN_RIGHT);
  } else if (it.kind == Kind::Sensor) {
    lv_obj_t* row = valueRow(t, 14, 52, kTileW - 28, 80, &brew_font_64, lv_color_white(),
                             &brew_font_28, &it.value, &it.unit);
    (void)row;
    it.status = label(t, &brew_font_20, kOk, 14, 182, "", kTileW - 28);
  } else {
    // A binary actuator says "AN"/"AUS": letters, which only the 56 px font has.
    const Actuator* a = reg_->findActuator(it.id.c_str());
    const bool binary = a && a->meta().kind == ValueKind::Binary;
    lv_obj_t* row = valueRow(t, 14, 52, kTileW - 28, 80, binary ? &brew_font_56 : &brew_font_64,
                             secondary_, &brew_font_28, &it.value, &it.unit);
    (void)row;
    it.bar = bar(t, 14, 150, kTileW - 28, 14, secondary_);
    it.status = label(t, &brew_font_20, kDim, 14, 182, "", kTileW - 28);
  }
}

void DisplayWide::showPage_(size_t page) {
  page_ = std::min(page, pageCount_ - 1);
  for (size_t i = 0; i < items_.size(); ++i) {
    const bool shown = i / kPerPage == page_;
    if (lv_obj_has_flag(items_[i].tile, LV_OBJ_FLAG_HIDDEN) == shown) {
      if (shown) lv_obj_clear_flag(items_[i].tile, LV_OBJ_FLAG_HIDDEN);
      else lv_obj_add_flag(items_[i].tile, LV_OBJ_FLAG_HIDDEN);
    }
  }
  for (size_t i = 0; i < dots_.size(); ++i)
    lv_obj_set_style_bg_color(dots_[i], i == page_ ? lv_color_white() : kOff, 0);
}

// ── Data ────────────────────────────────────────────────────────────────────

const char* DisplayWide::lockReason_(Kind kind, const std::string& id, char* buf,
                                     size_t cap) const {
  if (webUI_->estopLatched()) return "NOT-AUS aktiv";
  std::string program;
  if (kind == Kind::Actuator) {
    const Actuator* a = reg_->findActuator(id.c_str());
    if (!a) return "entfernt";
    const Controller* c = controllerOwnerOf(*reg_, id.c_str());
    if (c && c->enabled()) {
      snprintf(buf, cap, "geregelt von %s", displayName(*reg_, c->id()));
      return buf;
    }
  } else if (kind == Kind::Controller) {
    if (!reg_->findController(id.c_str())) return "entfernt";
  } else {
    return nullptr;
  }
  if (programs_->activeOwnerOf(id.c_str(), program)) {
    snprintf(buf, cap, "Programm %s", program.c_str());
    return buf;
  }
  return nullptr;
}

bool DisplayWide::info_(Kind kind, const std::string& id, Info& o) const {
  char reason[64];
  if (kind == Kind::Sensor) {
    int ch = 0;
    Sensor* s = resolveSensor(*reg_, id, &ch);
    if (!s) return false;
    if (ch >= 0) {
      const Channel c = s->channel(ch);
      snprintf(o.name, sizeof(o.name), "%s%s%s", displayName(*reg_, s->id()),
               *c.key ? " · " : "", c.key);
      o.actual = c.reading.valid ? c.reading.value : NAN;
      formatValue(o.value, sizeof(o.value), o.actual, c.meta.resolution);
      snprintf(o.unit, sizeof(o.unit), "%s", c.meta.unit);
      o.lo = c.meta.min;
      o.hi = c.meta.max;
      o.hasRange = o.hi > o.lo;
    } else {
      // Several channels: the first one in the tile, all of them as lines.
      o.multi = true;
      snprintf(o.name, sizeof(o.name), "%s", displayName(*reg_, s->id()));
      const char* list = keyList(id);
      size_t used = 0;
      bool first = true;
      for (size_t i = 0; i < s->channelCount(); ++i) {
        const Channel c = s->channel(i);
        if (list && !keyInList(list, c.key)) continue;
        char v[24];
        formatValue(v, sizeof(v), c.reading.valid ? c.reading.value : NAN, c.meta.resolution);
        if (first) {
          snprintf(o.value, sizeof(o.value), "%s", v);
          snprintf(o.unit, sizeof(o.unit), "%s", c.meta.unit);
          first = false;
        }
        const int n = snprintf(o.lines + used, sizeof(o.lines) - used, "%s%s: %s %s",
                               used ? "\n" : "", c.key, v, c.meta.unit);
        if (n < 0 || used + n >= sizeof(o.lines)) break;
        used += n;
      }
    }
    if (const char* fault = s->fault()) {
      snprintf(o.status, sizeof(o.status), "%s", fault);
      o.fault = true;
    }
    return true;
  }

  if (kind == Kind::Controller) {
    Controller* c = reg_->findController(id.c_str());
    if (!c) return false;
    snprintf(o.name, sizeof(o.name), "%s", displayName(*reg_, c->id()));
    o.lo = 0;
    o.hi = 100;
    if (c->rangeMax() > c->rangeMin()) {
      o.lo = c->rangeMin();
      o.hi = c->rangeMax();
    }
    JsonDocument doc;
    Sensor* s = nullptr;
    int ch = 0;
    if (controllerParams(*c, doc)) s = resolveSensor(*reg_, doc["sensor"] | "", &ch);
    if (s && ch >= 0) {
      const Channel pv = s->channel(ch);
      if (!(c->rangeMax() > c->rangeMin()) && pv.meta.max > pv.meta.min) {
        o.lo = pv.meta.min;
        o.hi = pv.meta.max;
      }
      o.actual = pv.reading.valid ? pv.reading.value : NAN;
      formatValue(o.value, sizeof(o.value), o.actual, pv.meta.resolution);
      snprintf(o.unit, sizeof(o.unit), "%s", pv.meta.unit);
    }
    o.step = o.hi - o.lo >= 10 ? 0.5f : 0.1f;
    o.hasRange = true;
    o.target = c->setpoint();
    o.enabled = c->enabled();
    int heat = 0, cool = 0;
    const bool hasHeat = outputPercent(*reg_, doc["heatActuator"] | "", &heat);
    const bool hasCool = outputPercent(*reg_, doc["coolActuator"] | "", &cool);
    if (hasHeat || hasCool) {
      if (hasHeat && hasCool)
        snprintf(o.outText, sizeof(o.outText), "Heizen %d %% · Kühlen %d %%", heat, cool);
      else
        snprintf(o.outText, sizeof(o.outText), "%s %d %%", hasHeat ? "Heizen" : "Kühlen",
                 hasHeat ? heat : cool);
      o.outPct = hasHeat ? heat : cool;
    } else if (outputPercent(*reg_, doc["actuator"] | "", &heat)) {
      snprintf(o.outText, sizeof(o.outText), "%d %%", heat);
      o.outPct = heat;
    }
    if (const char* lock = lockReason_(kind, id, reason, sizeof(reason))) {
      o.locked = true;
      snprintf(o.status, sizeof(o.status), "%s", lock);
    } else if (!o.enabled) {
      snprintf(o.status, sizeof(o.status), "Regler aus");
    }
    return true;
  }

  Actuator* a = reg_->findActuator(id.c_str());
  if (!a) return false;
  snprintf(o.name, sizeof(o.name), "%s", displayName(*reg_, a->id()));
  const auto meta = a->meta();
  o.enabled = a->enabled();
  o.binary = meta.kind == ValueKind::Binary;
  snprintf(o.unit, sizeof(o.unit), "%s", o.binary ? "" : meta.unit);
  if (o.binary) {
    snprintf(o.value, sizeof(o.value), "%s", o.enabled ? "AN" : "AUS");
  } else {
    o.actual = a->state();
    formatValue(o.value, sizeof(o.value), o.actual, meta.resolution);
    if (meta.kind == ValueKind::Continuous && meta.max > meta.min) {
      o.hasRange = true;
      o.lo = meta.min;
      o.hi = meta.max;
      o.step = meta.resolution > 0 ? meta.resolution : (o.hi - o.lo) / 100;
      o.target = a->target();
    }
  }
  const auto iv = a->interval();
  if (iv.has)
    snprintf(o.outText, sizeof(o.outText), "Intervall %u s / %u s",
             static_cast<unsigned>(iv.onSec), static_cast<unsigned>(iv.periodSec));
  if (const char* lock = lockReason_(kind, id, reason, sizeof(reason))) {
    o.locked = true;
    snprintf(o.status, sizeof(o.status), "%s", lock);
  } else if (!o.binary && !o.enabled) {
    snprintf(o.status, sizeof(o.status), "aus");
  } else if (const char* fault = a->fault()) {
    snprintf(o.status, sizeof(o.status), "%s", fault);
    o.fault = true;
  }
  return true;
}

// ── Refresh ─────────────────────────────────────────────────────────────────

void DisplayWide::onTimer_(lv_timer_t* t) {
  static_cast<DisplayWide*>(t->user_data)->refresh_();
}

void DisplayWide::refresh_() {
  if (dashboards_->revision() != builtRevision_ || itemCount(*reg_) != builtItemCount_ ||
      settings_->revision() != builtSettingsRevision_) {
    rebuild_();
    return;
  }
  applyEstop_();
  if (sheet_.root) refreshSheet_();
  else refreshTiles_();
  if (dialog_) refreshDialog_();
}

void DisplayWide::refreshTiles_() {
  const size_t from = page_ * kPerPage, to = std::min(items_.size(), from + kPerPage);
  for (size_t i = from; i < to; ++i) {
    Item& it = items_[i];
    Info in;
    if (!info_(it.kind, it.id, in)) {
      setText(it.title, "entfernt");
      continue;
    }
    setText(it.title, in.name);
    setText(it.value, in.value);
    setText(it.unit, in.unit);
    if (it.kind == Kind::Controller) {
      setRingValue(it.arc, in.actual, in.lo, in.hi);
      placeOnRing(it.knob, valueToFraction(in.target, in.lo, in.hi), 62 + 56, 38 + 56, 50, 18);
      char num[24], buf[40];
      formatValue(num, sizeof(num), in.target, in.step);
      snprintf(buf, sizeof(buf), "%s %s", num, in.unit);
      setText(it.soll, buf);
      setText(it.out, in.outText);
    } else if (it.kind == Kind::Sensor) {
      setText(it.status, in.status[0] ? in.status : "ok");
      lv_obj_set_style_text_color(it.status, in.fault ? kAlert : kOk, 0);
    } else {
      if (it.bar) setBar(it.bar, in.hasRange ? valueToFraction(in.actual, in.lo, in.hi) : 0);
      setText(it.status, in.status);
      lv_obj_set_style_text_color(it.status, in.fault ? kAlert : kDim, 0);
    }
  }
}

// Red cover while the emergency stop is latched, built on the top layer so no
// rebuild touches it and it swallows every touch. Only on a change.
void DisplayWide::applyEstop_() {
  const bool estop = webUI_->estopLatched();
  if (estop != (estop_ != nullptr)) showEstop_(estop);
}

void DisplayWide::showEstop_(bool on) {
  if (!on) {
    lv_obj_del(estop_);
    estop_ = nullptr;
    return;
  }
  estop_ = box(lv_layer_top(), 0, 0, kW, kH, kEstopBg);
  lv_obj_add_flag(estop_, LV_OBJ_FLAG_CLICKABLE);
  buildRail_(estop_, -1, true, nullptr, nullptr);
  const lv_coord_t w = kW - kRailW;
  label(estop_, &brew_font_56, lv_color_white(), kRailW, 130, LV_SYMBOL_WARNING, w, LV_TEXT_ALIGN_CENTER);
  label(estop_, &brew_font_56, lv_color_white(), kRailW, 210, "NOT-AUS", w, LV_TEXT_ALIGN_CENTER);
  label(estop_, &brew_font_28, lv_color_white(), kRailW, 300, "Alle Regler und Ausgänge sind aus.",
        w, LV_TEXT_ALIGN_CENTER);
  lv_obj_t* hint = label(estop_, &brew_font_20, lv_color_hex(0xFFE3E3), kRailW + 190, 350, "", 548,
                         LV_TEXT_ALIGN_CENTER);
  lv_label_set_long_mode(hint, LV_LABEL_LONG_WRAP);
  lv_label_set_text(hint,
                    "Das Display ist gesperrt. Zum Freigeben in der Web-Oberfläche den Not-Aus "
                    "quittieren, danach Regler und Ausgänge einzeln wieder einschalten.");
}

// ── Rail (left of the sheet; dimmed red under the e-stop) ───────────────────

void DisplayWide::buildRail_(lv_obj_t* parent, int active, bool red,
                             std::vector<lv_obj_t*>* rows, std::vector<lv_obj_t*>* values) {
  const size_t n = items_.size();
  const lv_coord_t rowH = n <= 6 ? 100 : 75;
  lv_obj_t* rail = box(parent, 0, 0, kRailW, kH, red ? lv_color_hex(0x7F1414) : kRail);
  lv_obj_set_style_border_side(rail, LV_BORDER_SIDE_RIGHT, 0);
  lv_obj_set_style_border_width(rail, 1, 0);
  lv_obj_set_style_border_color(rail, red ? lv_color_hex(0x9E1B1B) : kTrack, 0);
  if (red) lv_obj_set_style_opa(rail, LV_OPA_80, 0);
  if (static_cast<lv_coord_t>(n) * rowH > kH) {
    lv_obj_add_flag(rail, LV_OBJ_FLAG_SCROLLABLE);
    lv_obj_set_scroll_dir(rail, LV_DIR_VER);
  }
  for (size_t i = 0; i < n; ++i) {
    Info in;
    char val[24] = "--", nm[48] = "";
    if (info_(items_[i].kind, items_[i].id, in)) {
      snprintf(val, sizeof(val), "%s", in.value);
      snprintf(nm, sizeof(nm), "%s", in.name);
      if (red && items_[i].kind != Kind::Sensor) snprintf(val, sizeof(val), "AUS");
    }
    const bool act = static_cast<int>(i) == active;
    lv_obj_t* row = box(rail, 0, static_cast<lv_coord_t>(i) * rowH, kRailW - 1, rowH,
                        kRailActive, 0, act);
    lv_obj_set_style_border_side(row, LV_BORDER_SIDE_LEFT, 0);
    lv_obj_set_style_border_width(row, 4, 0);
    lv_obj_set_style_border_color(row, accent_, 0);
    lv_obj_set_style_border_opa(row, act ? LV_OPA_COVER : LV_OPA_TRANSP, 0);
    if (!red) {
      tappable(row);
      lv_obj_add_event_cb(row, onRail_, LV_EVENT_CLICKED, this);
    }
    lv_obj_t* v = label(row, &brew_font_28, act ? kActiveText : lv_color_white(), 0,
                        rowH / 2 - 32, val, kRailW - 5, LV_TEXT_ALIGN_CENTER);
    label(row, &brew_font_20, red ? lv_color_hex(0xFFD7D7) : lv_color_white(), 0, rowH / 2 + 4,
          nm, kRailW - 5, LV_TEXT_ALIGN_CENTER);
    if (rows) rows->push_back(row);
    if (values) values->push_back(v);
  }
}

// ── Detail sheet ────────────────────────────────────────────────────────────

void DisplayWide::openSheet_(size_t index) {
  if (index >= items_.size()) return;
  closeSheet_();
  const Item& it = items_[index];
  Info in;
  if (!info_(it.kind, it.id, in)) return;
  Sheet& s = sheet_;
  s.index = index;
  s.lo = in.lo;
  s.hi = in.hi;
  s.step = in.step;
  s.big = (in.hi - in.lo) >= 20 ? (in.hi - in.lo) / 10 : in.step;
  s.root = box(lv_scr_act(), 0, 0, kW, kH, lv_color_black());
  lv_obj_add_flag(s.root, LV_OBJ_FLAG_CLICKABLE);  // the overview below must not get the taps
  lv_obj_t* r = s.root;

  buildRail_(r, static_cast<int>(index), false, &s.rows, &s.rowValue);

  lv_obj_t* back = box(r, 112, 8, 56, 56, kPanel, 16);
  lv_obj_set_style_border_width(back, 1, 0);
  lv_obj_set_style_border_color(back, kPanelEdge, 0);
  tappable(back);
  label(back, &brew_font_28, lv_color_white(), 0, 12, LV_SYMBOL_LEFT, 54, LV_TEXT_ALIGN_CENTER);
  lv_obj_add_event_cb(back, onBack_, LV_EVENT_CLICKED, this);
  s.title = label(r, &brew_font_28, lv_color_white(), 184, 6, "", 520);
  s.sub = label(r, &brew_font_20, kDim, 184, 42, "", 520);

  const bool ctl = it.kind == Kind::Controller;
  const bool act = it.kind == Kind::Actuator;
  if (ctl || (act && !in.binary)) {
    label(r, &brew_font_20, kDim, 700, 24, ctl ? "Regler" : "Ausgang", 190, LV_TEXT_ALIGN_RIGHT);
    s.sw = lv_switch_create(r);
    lv_obj_set_pos(s.sw, kW - 24 - 96, 12);
    lv_obj_set_size(s.sw, 96, 48);
    lv_obj_set_style_bg_color(s.sw, kTrack, LV_PART_MAIN);
    lv_obj_set_style_bg_color(s.sw, accent_, static_cast<lv_style_selector_t>(LV_PART_INDICATOR | LV_STATE_CHECKED));
    lv_obj_set_style_bg_color(s.sw, lv_color_white(), LV_PART_KNOB);
    lv_obj_add_event_cb(s.sw, onSwitch_, LV_EVENT_CLICKED, this);
  } else if (it.kind == Kind::Sensor) {
    s.chip = box(r, kW - 24 - 200, 14, 200, 36, lv_color_hex(0x0F2A1B), 8);
    s.chipLabel = label(s.chip, &brew_font_20, kOk, 0, 5, "", 200, LV_TEXT_ALIGN_CENTER);
  }

  if (ctl) {
    s.arc = ring(r, kRingX, kRingY, kRingSize, kRingWidth, accent_);
    s.label = label(r, &brew_font_20, kDim, kRingX, 232, "IST", kRingSize, LV_TEXT_ALIGN_CENTER);
    s.value = label(r, &brew_font_96, lv_color_white(), kRingX, 252, "", kRingSize, LV_TEXT_ALIGN_CENTER);
    s.unit = label(r, &brew_font_28, kDim, kRingX, 372, "", kRingSize, LV_TEXT_ALIGN_CENTER);
    s.knob = knob(r, kKnob, 4, lv_color_black());
    lv_obj_add_flag(s.knob, LV_OBJ_FLAG_CLICKABLE);
    lv_obj_set_ext_click_area(s.knob, 18);
    lv_obj_add_event_cb(s.knob, onKnob_, LV_EVENT_ALL, this);

    lv_obj_t* card = box(r, 528, 92, 472, 216, kPanel, 18);
    label(card, &brew_font_20, kDim, 20, 16, "SOLL");
    char stepBuf[32];
    formatValue(stepBuf, sizeof(stepBuf), in.step, in.step);
    char hint[48];
    snprintf(hint, sizeof(hint), "Schritt %s %s", stepBuf, in.unit);
    label(card, &brew_font_20, kDim, 20, 16, hint, 432, LV_TEXT_ALIGN_RIGHT);
    valueRow(card, 20, 42, 432, 80, &brew_font_64, lv_color_white(), &brew_font_28, &s.soll,
             &s.sollUnit);
    for (int i = 0; i < 2; ++i) {
      lv_obj_t* b = box(card, 20 + i * 224, 124, 208, 76, kButton, 16);
      lv_obj_set_style_border_width(b, 1, 0);
      lv_obj_set_style_border_color(b, kPanelEdge, 0);
      tappable(b);
      label(b, &brew_font_28, lv_color_white(), 0, 22, i ? LV_SYMBOL_PLUS : LV_SYMBOL_MINUS, 206,
            LV_TEXT_ALIGN_CENTER);
      lv_obj_add_event_cb(b, onStep_, LV_EVENT_CLICKED, this);
      s.steps[i ? 2 : 1] = b;
    }
    lv_obj_t* out = box(r, 528, 324, 472, 104, kPanel, 18);
    label(out, &brew_font_20, kDim, 20, 16, "AUSGANG");
    s.out = label(out, &brew_font_28, secondary_, 20, 10, "", 432, LV_TEXT_ALIGN_RIGHT);
    s.bar = bar(out, 20, 64, 432, 14, secondary_);
    s.note = label(r, &brew_font_20, kDim, 528, 444, "", 472);
  } else if (it.kind == Kind::Sensor) {
    if (in.multi) {
      s.lines = label(r, &brew_font_28, lv_color_white(), 152, 100, "", 820);
    } else {
      valueRow(r, 152, 96, 820, 130, &brew_font_96, lv_color_white(), &brew_font_28, &s.value,
               &s.unit);
      if (in.hasRange) {
        s.bar = bar(r, 152, 330, 820, 12, accent_);
        s.minMax[0] = label(r, &brew_font_20, kDim, 152, 352, "", 200);
        s.minMax[1] = label(r, &brew_font_20, kDim, 772, 352, "", 200, LV_TEXT_ALIGN_RIGHT);
      }
    }
    lv_obj_t* card = box(r, 152, 420, 820, 96, kPanel, 16);
    label(card, &brew_font_20, kDim, 18, 12, "QUELLE");
    label(card, &brew_font_28, lv_color_white(), 18, 40, it.id.c_str(), 780);
  } else if (in.binary) {
    s.toggle = box(r, 450, 150, 220, 220, kOff, 110);
    tappable(s.toggle);
    lv_obj_set_style_bg_color(s.toggle, lv_color_hex(0x2C2C33), LV_STATE_PRESSED);
    s.toggleLabel = label(s.toggle, &brew_font_56, lv_color_white(), 0, 80, "", 220, LV_TEXT_ALIGN_CENTER);
    lv_obj_add_event_cb(s.toggle, onToggle_, LV_EVENT_CLICKED, this);
    s.note = label(r, &brew_font_20, kDim, 152, 400, "", 820, LV_TEXT_ALIGN_CENTER);
  } else {
    valueRow(r, 152, 96, 820, 130, &brew_font_96, secondary_, &brew_font_28, &s.value, &s.unit);
    if (in.hasRange) {
      s.bar = bar(r, 152, 260, 820, 16, secondary_);
      s.minMax[0] = label(r, &brew_font_20, kDim, 152, 286, "", 200);
      s.minMax[1] = label(r, &brew_font_20, kDim, 772, 286, "", 200, LV_TEXT_ALIGN_RIGHT);
      const float amount[4] = {-s.big, -s.step, s.step, s.big};
      for (int i = 0; i < 4; ++i) {
        lv_obj_t* b = box(r, 152 + i * 208, 332, 196, 72, kButton, 16);
        lv_obj_set_style_border_width(b, 1, 0);
        lv_obj_set_style_border_color(b, kPanelEdge, 0);
        tappable(b);
        char t[16];
        stepText(t, sizeof(t), amount[i] < 0 ? '-' : '+', std::fabs(amount[i]));
        label(b, &brew_font_28, lv_color_white(), 0, 18, t, 194, LV_TEXT_ALIGN_CENTER);
        lv_obj_add_event_cb(b, onStep_, LV_EVENT_CLICKED, this);
        s.steps[i] = b;
      }
    }
    lv_obj_t* card = box(r, 152, 440, 820, 64, kPanel, 14);
    s.note = label(card, &brew_font_20, kDim, 18, 20, "", 784);
  }
  refreshSheet_();
}

void DisplayWide::closeSheet_() {
  if (!sheet_.root) return;
  lv_obj_del(sheet_.root);
  sheet_ = Sheet();
}

void DisplayWide::refreshSheet_() {
  Sheet& s = sheet_;
  if (!s.root || s.index >= items_.size()) return;
  const Item& it = items_[s.index];
  Info in;
  if (!info_(it.kind, it.id, in)) {
    setText(s.title, "entfernt");
    return;
  }
  setText(s.title, in.name);
  const char* kindName = it.kind == Kind::Controller ? "Regler" : it.kind == Kind::Sensor ? "Sensor" : "Aktor";
  char sub[64];
  snprintf(sub, sizeof(sub), "%s · %s", kindName, it.id.c_str());
  setText(s.sub, sub);

  // Rail: the other items' values stay live.
  for (size_t i = 0; i < s.rowValue.size() && i < items_.size(); ++i) {
    Info r;
    if (info_(items_[i].kind, items_[i].id, r)) setText(s.rowValue[i], r.value);
  }

  if (s.sw) {
    const bool on = in.enabled;
    if (lv_obj_has_state(s.sw, LV_STATE_CHECKED) != on) {
      if (on) lv_obj_add_state(s.sw, LV_STATE_CHECKED);
      else lv_obj_clear_state(s.sw, LV_STATE_CHECKED);
    }
    setLocked(s.sw, in.locked);
  }

  if (it.kind == Kind::Controller) {
    setText(s.value, in.value);
    setText(s.unit, in.unit);
    setRingValue(s.arc, in.actual, in.lo, in.hi);
    if (!s.dragging) {
      placeOnRing(s.knob, valueToFraction(in.target, in.lo, in.hi), kRingCx, kRingCy, kRingR, kKnob);
      char num[24];
      formatValue(num, sizeof(num), in.target, in.step);
      setText(s.soll, num);
      setText(s.sollUnit, in.unit);
    }
    setText(s.out, in.outText);
    setBar(s.bar, in.outPct >= 0 ? in.outPct / 100.0f : 0);
    setLocked(s.knob, in.locked);
    for (int i = 1; i <= 2; ++i) setLocked(s.steps[i], in.locked);
    setText(s.note, in.status);
  } else if (it.kind == Kind::Sensor) {
    if (s.chipLabel) {
      setText(s.chipLabel, in.fault ? in.status : "ok");
      lv_obj_set_style_text_color(s.chipLabel, in.fault ? kAlert : kOk, 0);
      lv_obj_set_style_bg_color(s.chip, lv_color_hex(in.fault ? 0x2A1212 : 0x0F2A1B), 0);
    }
    if (in.multi) {
      setText(s.lines, in.lines);
    } else {
      setText(s.value, in.value);
      setText(s.unit, in.unit);
      if (s.bar) {
        setBar(s.bar, valueToFraction(in.actual, in.lo, in.hi));
        char lo[24], hi[24], buf[32];
        formatValue(lo, sizeof(lo), in.lo, 1);
        formatValue(hi, sizeof(hi), in.hi, 1);
        snprintf(buf, sizeof(buf), "%s %s", lo, in.unit);
        setText(s.minMax[0], buf);
        snprintf(buf, sizeof(buf), "%s %s", hi, in.unit);
        setText(s.minMax[1], buf);
      }
    }
  } else if (in.binary) {
    setText(s.toggleLabel, in.value);
    lv_obj_set_style_bg_color(s.toggle, in.enabled ? accent_ : kOff, 0);
    setLocked(s.toggle, in.locked);
    setText(s.note, in.status[0] ? in.status : in.outText);
  } else {
    setText(s.value, in.value);
    setText(s.unit, in.unit);
    if (s.bar) {
      setBar(s.bar, valueToFraction(in.actual, in.lo, in.hi));
      char lo[24], hi[24];
      formatValue(lo, sizeof(lo), in.lo, in.step);
      formatValue(hi, sizeof(hi), in.hi, in.step);
      setText(s.minMax[0], lo);
      setText(s.minMax[1], hi);
    }
    for (lv_obj_t* b : s.steps)
      if (b) setLocked(b, in.locked || !in.enabled);
    char note[120];
    snprintf(note, sizeof(note), "%s%s%s", in.status, in.status[0] && in.outText[0] ? " · " : "",
             in.outText);
    setText(s.note, note[0] ? note : "Von Hand einstellbar.");
    lv_obj_set_style_text_color(s.note, in.fault ? kAlert : kDim, 0);
  }
}

// ── Connection dialog ───────────────────────────────────────────────────────

void DisplayWide::openDialog_() {
  if (dialog_) return;
  dialog_ = box(lv_layer_top(), 0, 0, kW, kH, lv_color_black());
  lv_obj_set_style_bg_opa(dialog_, LV_OPA_70, 0);
  lv_obj_add_flag(dialog_, LV_OBJ_FLAG_CLICKABLE);
  // 740 x 380, centred. Left: the code with its caption; right: the facts,
  // one row each (the address without "http://" - the code carries the full URL).
  lv_obj_t* card = box(dialog_, 142, 110, 740, 380, kRail, 24);
  lv_obj_set_style_border_width(card, 1, 0);
  lv_obj_set_style_border_color(card, kPanelEdge, 0);

  const String ip = WiFi.localIP().toString();
  char url[64];
  snprintf(url, sizeof(url), "http://%s/", ip.c_str());
  lv_obj_t* qr = lv_qrcode_create(card, 240, lv_color_black(), lv_color_white());
  lv_obj_set_pos(qr, 32, 32);
  lv_obj_set_style_border_color(qr, lv_color_white(), 0);
  lv_obj_set_style_border_width(qr, 10, 0);
  lv_qrcode_update(qr, url, static_cast<uint32_t>(strlen(url)));
  label(card, &brew_font_20, kDim, 32, 304, "Mit dem Handy scannen", 240, LV_TEXT_ALIGN_CENTER);

  constexpr lv_coord_t kX = 312, kColW = 396;  // right column: 312 .. 708
  label(card, &brew_font_28, lv_color_white(), kX, 30, LV_SYMBOL_WIFI "  Verbindung", kColW);
  const char* names[4] = {"WLAN", "ADRESSE", "IP", "SIGNAL"};
  lv_obj_t* vals[4];
  for (int i = 0; i < 4; ++i) {
    const lv_coord_t y = 86 + i * 48;
    box(card, kX, y, kColW, 1, kTrack);
    label(card, &brew_font_20, kDim, kX, y + 14, names[i]);
    vals[i] = label(card, &brew_font_20, lv_color_white(), kX + 100, y + 14, "", kColW - 100,
                    LV_TEXT_ALIGN_RIGHT);
  }
  lv_label_set_text(vals[0], WiFi.SSID().c_str());
  lv_label_set_text_fmt(vals[1], "%s.local", WiFi.getHostname());
  dialogIp_ = vals[2];
  dialogRssi_ = vals[3];
  lv_obj_t* close = box(card, kX, 292, kColW, 60, kButton, 16);
  lv_obj_set_style_border_width(close, 1, 0);
  lv_obj_set_style_border_color(close, kPanelEdge, 0);
  tappable(close);
  label(close, &brew_font_28, lv_color_white(), 0, 14, "Schließen", kColW - 2, LV_TEXT_ALIGN_CENTER);
  lv_obj_add_event_cb(close, onDialogClose_, LV_EVENT_CLICKED, this);
  refreshDialog_();
}

void DisplayWide::closeDialog_() {
  if (!dialog_) return;
  lv_obj_del(dialog_);
  dialog_ = dialogRssi_ = dialogIp_ = nullptr;
}

void DisplayWide::refreshDialog_() {
  setText(dialogIp_, WiFi.localIP().toString().c_str());
  char buf[32];
  const int rssi = WiFi.RSSI();
  snprintf(buf, sizeof(buf), "%d dBm · %s", rssi, rssi > -67 ? "gut" : rssi > -80 ? "mäßig" : "schwach");
  setText(dialogRssi_, WiFi.status() == WL_CONNECTED ? buf : "nicht verbunden");
}

// ── Touch ───────────────────────────────────────────────────────────────────

void DisplayWide::write_(Kind kind, const std::string& id, float v, float lo, float hi) {
  char reason[64];
  if (lockReason_(kind, id, reason, sizeof(reason))) return;  // raced a state change
  v = std::fmin(std::fmax(v, lo), hi);
  if (kind == Kind::Controller) {
    if (Controller* c = reg_->findController(id.c_str())) c->setSetpoint(v);
  } else if (Actuator* a = reg_->findActuator(id.c_str())) {
    if (!a->enabled()) return;
    a->write(v);
  }
  refreshSheet_();
}

void DisplayWide::stepBy_(float delta) {
  if (!sheet_.root || sheet_.index >= items_.size()) return;
  const Item& it = items_[sheet_.index];
  float current;
  if (it.kind == Kind::Controller) {
    Controller* c = reg_->findController(it.id.c_str());
    if (!c) return;
    current = c->setpoint();
  } else {
    Actuator* a = reg_->findActuator(it.id.c_str());
    if (!a) return;
    current = a->target();
  }
  const float st = sheet_.step > 0 ? sheet_.step : 1;
  write_(it.kind, it.id, std::round((current + delta) / st) * st, sheet_.lo, sheet_.hi);
}

void DisplayWide::onTab_(lv_event_t* e) {
  auto* self = static_cast<DisplayWide*>(lv_event_get_user_data(e));
  lv_obj_t* tab = lv_event_get_target(e);
  for (size_t i = 0; i < self->tabs_.size(); ++i) {
    if (self->tabs_[i] != tab) continue;
    if (i == self->dashIndex_) return;
    self->dashIndex_ = i;
    self->page_ = 0;
    lv_async_call([](void* p) { static_cast<DisplayWide*>(p)->rebuild_(); }, self);
    return;
  }
}

void DisplayWide::onTile_(lv_event_t* e) {
  auto* self = static_cast<DisplayWide*>(lv_event_get_user_data(e));
  lv_obj_t* tile = lv_event_get_target(e);
  for (size_t i = 0; i < self->items_.size(); ++i) {
    if (self->items_[i].tile != tile) continue;
    self->openSheet_(i);
    return;
  }
}

// Swipe left/right pages the overview; the release of this very swipe must not
// count as a tap on the tile it started on.
void DisplayWide::onGesture_(lv_event_t* e) {
  auto* self = static_cast<DisplayWide*>(lv_event_get_user_data(e));
  if (self->sheet_.root || self->dialog_ || self->estop_) return;
  lv_indev_t* indev = lv_indev_get_act();
  const lv_dir_t dir = lv_indev_get_gesture_dir(indev);
  size_t next = self->page_;
  if (dir == LV_DIR_LEFT && next + 1 < self->pageCount_) ++next;
  else if (dir == LV_DIR_RIGHT && next > 0) --next;
  else return;
  lv_indev_wait_release(indev);
  self->showPage_(next);
  self->refreshTiles_();
}

void DisplayWide::onBack_(lv_event_t* e) {
  auto* self = static_cast<DisplayWide*>(lv_event_get_user_data(e));
  lv_async_call(
      [](void* p) {
        auto* d = static_cast<DisplayWide*>(p);
        d->closeSheet_();
        d->refreshTiles_();
      },
      self);
}

void DisplayWide::onRail_(lv_event_t* e) {
  auto* self = static_cast<DisplayWide*>(lv_event_get_user_data(e));
  lv_obj_t* row = lv_event_get_target(e);
  for (size_t i = 0; i < self->sheet_.rows.size(); ++i) {
    if (self->sheet_.rows[i] != row) continue;
    if (i == self->sheet_.index) return;
    self->pendingOpen_ = i;
    lv_async_call([](void* p) { auto* d = static_cast<DisplayWide*>(p); d->openSheet_(d->pendingOpen_); }, self);
    return;
  }
}

void DisplayWide::onSwitch_(lv_event_t* e) {
  auto* self = static_cast<DisplayWide*>(lv_event_get_user_data(e));
  if (!self->sheet_.root || self->sheet_.index >= self->items_.size()) return;
  const Item& it = self->items_[self->sheet_.index];
  char reason[64];
  if (self->lockReason_(it.kind, it.id, reason, sizeof(reason))) {
    self->refreshSheet_();  // snap the switch back
    return;
  }
  if (it.kind == Kind::Controller) {
    if (Controller* c = self->reg_->findController(it.id.c_str()))
      c->setEnabled(!c->enabled());  // switches the actuators along (Controller.h)
  } else if (Actuator* a = self->reg_->findActuator(it.id.c_str())) {
    a->setEnabled(!a->enabled());
  }
  self->refreshSheet_();
}

void DisplayWide::onToggle_(lv_event_t* e) {
  onSwitch_(e);
}

void DisplayWide::onStep_(lv_event_t* e) {
  auto* self = static_cast<DisplayWide*>(lv_event_get_user_data(e));
  lv_obj_t* btn = lv_event_get_target(e);
  Sheet& s = self->sheet_;
  if (!s.root || s.index >= self->items_.size()) return;
  const float st = s.step;
  const float deltas[4] = {-s.big, -st, st, s.big};
  for (int i = 0; i < 4; ++i)
    if (s.steps[i] == btn) {
      self->stepBy_(deltas[i]);
      return;
    }
}

// The target knob: live preview while dragging, written on release only, so a
// drag across the range does not fire a stream of writes.
void DisplayWide::onKnob_(lv_event_t* e) {
  auto* self = static_cast<DisplayWide*>(lv_event_get_user_data(e));
  Sheet& s = self->sheet_;
  if (!s.root || s.index >= self->items_.size()) return;
  const lv_event_code_t code = lv_event_get_code(e);
  if (code != LV_EVENT_PRESSING && code != LV_EVENT_RELEASED && code != LV_EVENT_PRESSED) return;
  if (code == LV_EVENT_PRESSED) {
    s.dragging = true;
    return;
  }
  lv_point_t pt;
  lv_indev_get_point(lv_indev_get_act(), &pt);
  const float t = pointToFraction(pt);
  const float st = s.step > 0 ? s.step : 1;
  const float v = std::round((s.lo + t * (s.hi - s.lo)) / st) * st;
  if (code == LV_EVENT_PRESSING) {
    placeOnRing(s.knob, valueToFraction(v, s.lo, s.hi), kRingCx, kRingCy, kRingR, kKnob);
    char num[24];
    formatValue(num, sizeof(num), v, st);
    setText(s.soll, num);
  } else {
    s.dragging = false;
    const Item& it = self->items_[s.index];
    self->write_(it.kind, it.id, v, s.lo, s.hi);
  }
}

void DisplayWide::onWifi_(lv_event_t* e) {
  static_cast<DisplayWide*>(lv_event_get_user_data(e))->openDialog_();
}

void DisplayWide::onDialogClose_(lv_event_t* e) {
  auto* self = static_cast<DisplayWide*>(lv_event_get_user_data(e));
  lv_async_call([](void* p) { static_cast<DisplayWide*>(p)->closeDialog_(); }, self);
}

}  // namespace BrewControl

#endif  // BREWCTL_HAS_DISPLAY
