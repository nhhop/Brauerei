#include "DisplayUI.h"

#ifdef BREWCTL_HAS_DISPLAY

#include <Wire.h>

#include "Ft3168Touch.h"
#include "Sh8601Panel.h"

#if BREWCTL_DISPLAY_STAGE >= 3
#include <lvgl.h>
#endif

#ifdef BREWCTL_SPIKE_METRICS
#include "../SpikeMetrics.h"
#endif

namespace BrewControl {
namespace {

Sh8601Panel g_panel;
bool g_panelUp = false;
Ft3168Touch g_touch;

#ifdef BREWCTL_SPIKE_METRICS
SpikeMetrics* g_metrics = nullptr;
#endif

constexpr uint16_t rgb565(uint8_t r, uint8_t g, uint8_t b) {
  return static_cast<uint16_t>(((r & 0xF8) << 8) | ((g & 0xFC) << 3) | (b >> 3));
}

// 60 lines of a 280 px panel = 33.6 kB. Single buffer on purpose: the blit uses
// spi_device_polling_transmit, so it blocks, and a second buffer would only
// cost another 33 kB of internal DMA heap without overlapping anything.
constexpr uint16_t kBufLines = 60;
constexpr size_t kBufBytes =
    static_cast<size_t>(BREWCTL_LCD_W) * kBufLines * 2;

#if BREWCTL_DISPLAY_STAGE >= 3

lv_disp_draw_buf_t g_drawBuf;
lv_disp_drv_t g_dispDrv;
lv_indev_drv_t g_indevDrv;
lv_color_t* g_buf1 = nullptr;

lv_obj_t* g_lblBigId = nullptr;
lv_obj_t* g_lblBigVal = nullptr;
lv_obj_t* g_lblCompact = nullptr;
lv_obj_t* g_arc = nullptr;
lv_obj_t* g_lblArc = nullptr;
lv_obj_t* g_bar = nullptr;
lv_obj_t* g_chart = nullptr;
lv_chart_series_t* g_series = nullptr;

void flushCb(lv_disp_drv_t* drv, const lv_area_t* area, lv_color_t* px) {
  const uint32_t t0 = micros();
  const int16_t w = area->x2 - area->x1 + 1;
  const int16_t h = area->y2 - area->y1 + 1;
  // LV_COLOR_16_SWAP is on, so the buffer already holds big-endian RGB565 -
  // exactly what the panel wants, no per-pixel conversion on the flush path.
  g_panel.blit(area->x1, area->y1, w, h, reinterpret_cast<const uint8_t*>(px),
               static_cast<size_t>(w) * h * 2);
#ifdef BREWCTL_SPIKE_METRICS
  if (g_metrics) g_metrics->recordFlush(w * h, micros() - t0);
#else
  (void)t0;
#endif
  lv_disp_flush_ready(drv);
}

void indevCb(lv_indev_drv_t*, lv_indev_data_t* data) {
  int16_t x = 0, y = 0;
  if (g_touch.read(&x, &y)) {
    data->point.x = x;
    data->point.y = y;
    data->state = LV_INDEV_STATE_PRESSED;
  } else {
    data->state = LV_INDEV_STATE_RELEASED;
  }
}

// The probe screen. Not a hello-world: it carries exactly the widget classes a
// mirrored dashboard config would need - a "normal" sensor card (big font, big
// invalidated area at 1 Hz), a "compact" one (many small invalidations), a
// "gauge" arc (the priciest LVGL primitive, redrawn every frame while dragged),
// an actuator bar, and a chart whose append invalidates the whole plot area
// once a second. Those are the two steady-state loads and the peak load.
void buildProbeScreen() {
  lv_obj_t* scr = lv_scr_act();
  lv_obj_set_style_bg_color(scr, lv_color_hex(0x101014), LV_PART_MAIN);

  g_lblBigId = lv_label_create(scr);
  lv_obj_set_style_text_font(g_lblBigId, &lv_font_montserrat_14, 0);
  lv_obj_set_style_text_color(g_lblBigId, lv_color_hex(0x8899AA), 0);
  lv_obj_align(g_lblBigId, LV_ALIGN_TOP_LEFT, 12, 10);
  lv_label_set_text(g_lblBigId, "--");

  g_lblBigVal = lv_label_create(scr);
  lv_obj_set_style_text_font(g_lblBigVal, &lv_font_montserrat_48, 0);
  lv_obj_set_style_text_color(g_lblBigVal, lv_color_hex(0xFFFFFF), 0);
  lv_obj_align(g_lblBigVal, LV_ALIGN_TOP_LEFT, 12, 28);
  lv_label_set_text(g_lblBigVal, "--");

  g_lblCompact = lv_label_create(scr);
  lv_obj_set_style_text_font(g_lblCompact, &lv_font_montserrat_28, 0);
  lv_obj_set_style_text_color(g_lblCompact, lv_color_hex(0xDDDDDD), 0);
  lv_obj_align(g_lblCompact, LV_ALIGN_TOP_LEFT, 12, 88);
  lv_label_set_text(g_lblCompact, "--");

  g_arc = lv_arc_create(scr);
  lv_obj_set_size(g_arc, 160, 160);
  lv_arc_set_rotation(g_arc, 135);
  lv_arc_set_bg_angles(g_arc, 0, 270);
  lv_obj_align(g_arc, LV_ALIGN_TOP_MID, 0, 130);

  g_lblArc = lv_label_create(scr);
  lv_obj_set_style_text_font(g_lblArc, &lv_font_montserrat_28, 0);
  lv_obj_set_style_text_color(g_lblArc, lv_color_hex(0xFFCC66), 0);
  lv_obj_align_to(g_lblArc, g_arc, LV_ALIGN_CENTER, 0, 0);
  lv_label_set_text(g_lblArc, "--");

  g_bar = lv_bar_create(scr);
  lv_obj_set_size(g_bar, 240, 18);
  lv_obj_align(g_bar, LV_ALIGN_TOP_MID, 0, 302);
  lv_bar_set_range(g_bar, 0, 100);

  g_chart = lv_chart_create(scr);
  lv_obj_set_size(g_chart, 256, 100);
  lv_obj_align(g_chart, LV_ALIGN_TOP_MID, 0, 334);
  lv_chart_set_type(g_chart, LV_CHART_TYPE_LINE);
  lv_chart_set_point_count(g_chart, 60);
  lv_chart_set_update_mode(g_chart, LV_CHART_UPDATE_MODE_SHIFT);
  g_series = lv_chart_add_series(g_chart, lv_color_hex(0x33AAFF),
                                 LV_CHART_AXIS_PRIMARY_Y);
}

#endif  // stage >= 3

}  // namespace

#ifdef BREWCTL_SPIKE_METRICS
void DisplayUI::setMetrics(SpikeMetrics* m) { g_metrics = m; }
#endif

void DisplayUI::begin(SensActCtrl::Registry& reg) {
  reg_ = &reg;

  // Claim the real I2C pins before anything else can call Wire.begin() with the
  // variant defaults (SDA 18 / SCL 17 - SCL 17 is the panel reset).
  Wire.begin(BREWCTL_TOUCH_SDA, BREWCTL_TOUCH_SCL, 400000);

  const Sh8601Panel::Pins pins = {BREWCTL_LCD_CS,  BREWCTL_LCD_SCK,
                                  BREWCTL_LCD_D0,  BREWCTL_LCD_D1,
                                  BREWCTL_LCD_D2,  BREWCTL_LCD_D3,
                                  BREWCTL_LCD_RST, BREWCTL_LCD_EN};
  g_panelUp = g_panel.begin(pins, BREWCTL_LCD_W, BREWCTL_LCD_H, kBufBytes);
  if (!g_panelUp) {
    Serial.println("Display: panel init failed");
    return;
  }
  g_panel.fill(0, 0, BREWCTL_LCD_W, BREWCTL_LCD_H, rgb565(0, 0, 0));

  g_touch.begin();
  Serial.printf("Display: panel %dx%d up, touch %s\n", BREWCTL_LCD_W,
                BREWCTL_LCD_H, g_touch.present() ? "found" : "MISSING");

#if BREWCTL_DISPLAY_STAGE == 1
  // Colour order and geometry check: the fills tell RGB from BGR, the 2 px
  // frame tells whether a row/column offset is needed.
  const uint16_t fills[] = {rgb565(255, 0, 0), rgb565(0, 255, 0),
                            rgb565(0, 0, 255)};
  for (uint16_t c : fills) {
    g_panel.fill(0, 0, BREWCTL_LCD_W, BREWCTL_LCD_H, c);
    delay(700);
  }
  g_panel.fill(0, 0, BREWCTL_LCD_W, BREWCTL_LCD_H, rgb565(0, 0, 0));
  const uint16_t white = rgb565(255, 255, 255);
  g_panel.fill(0, 0, BREWCTL_LCD_W, 2, white);
  g_panel.fill(0, BREWCTL_LCD_H - 2, BREWCTL_LCD_W, 2, white);
  g_panel.fill(0, 0, 2, BREWCTL_LCD_H, white);
  g_panel.fill(BREWCTL_LCD_W - 2, 0, 2, BREWCTL_LCD_H, white);
#elif BREWCTL_DISPLAY_STAGE == 2
  const uint16_t white = rgb565(255, 255, 255);
  g_panel.fill(0, 0, BREWCTL_LCD_W, 2, white);
  g_panel.fill(0, BREWCTL_LCD_H - 2, BREWCTL_LCD_W, 2, white);
  g_panel.fill(0, 0, 2, BREWCTL_LCD_H, white);
  g_panel.fill(BREWCTL_LCD_W - 2, 0, 2, BREWCTL_LCD_H, white);
#else
  g_buf1 = static_cast<lv_color_t*>(
      heap_caps_malloc(kBufBytes, MALLOC_CAP_DMA | MALLOC_CAP_INTERNAL));
  if (!g_buf1) {
    Serial.println("Display: draw buffer alloc failed");
    g_panelUp = false;
    return;
  }
  lv_init();
  lv_disp_draw_buf_init(&g_drawBuf, g_buf1, nullptr, kBufBytes / 2);

  lv_disp_drv_init(&g_dispDrv);
  g_dispDrv.hor_res = BREWCTL_LCD_W;
  g_dispDrv.ver_res = BREWCTL_LCD_H;
  g_dispDrv.flush_cb = flushCb;
  g_dispDrv.draw_buf = &g_drawBuf;
  lv_disp_drv_register(&g_dispDrv);

  lv_indev_drv_init(&g_indevDrv);
  g_indevDrv.type = LV_INDEV_TYPE_POINTER;
  g_indevDrv.read_cb = indevCb;
  lv_indev_drv_register(&g_indevDrv);

  buildProbeScreen();
  Serial.printf("Display: LVGL up, draw buffer %u B internal DMA\n",
                static_cast<unsigned>(kBufBytes));
#endif
}

void DisplayUI::tick() {
  if (!g_panelUp) return;
  const uint32_t t0 = micros();

#if BREWCTL_DISPLAY_STAGE == 2
  int16_t x = 0, y = 0;
  if (g_touch.read(&x, &y)) {
    // Painting where the controller claims the finger is verifies the axis
    // mapping by eye - far quicker than reading coordinates off a table.
    if (x >= 4 && y >= 4 && x < BREWCTL_LCD_W - 4 && y < BREWCTL_LCD_H - 4) {
      g_panel.fill(x - 4, y - 4, 8, 8, rgb565(0, 255, 0));
    }
  }
#elif BREWCTL_DISPLAY_STAGE >= 3
  lv_timer_handler();

  const uint32_t now = millis();
  if (now - lastRefreshMs_ >= 1000 && reg_) {
    lastRefreshMs_ = now;
    char buf[48];

    const auto& sensors = reg_->sensors();
    if (!sensors.empty()) {
      const auto& ch = sensors[0]->channel(0);
      lv_label_set_text(g_lblBigId, sensors[0]->id());
      snprintf(buf, sizeof(buf), "%.1f%s", ch.reading.value, ch.meta.unit);
      lv_label_set_text(g_lblBigVal, buf);
      lv_chart_set_next_value(g_chart, g_series,
                              static_cast<lv_coord_t>(ch.reading.value));
    }
    if (sensors.size() > 1) {
      const auto& ch = sensors[1]->channel(0);
      snprintf(buf, sizeof(buf), "%s  %.1f%s", sensors[1]->id(),
               ch.reading.value, ch.meta.unit);
      lv_label_set_text(g_lblCompact, buf);
    }

    const auto& controllers = reg_->controllers();
    if (!controllers.empty()) {
      auto* c = controllers[0];
      const float lo = c->rangeMin();
      const float hi = c->rangeMax() > c->rangeMin() ? c->rangeMax() : 100.0f;
      lv_arc_set_range(g_arc, static_cast<int16_t>(lo),
                       static_cast<int16_t>(hi));
      lv_arc_set_value(g_arc, static_cast<int16_t>(c->setpoint()));
      snprintf(buf, sizeof(buf), "%.0f", c->setpoint());
      lv_label_set_text(g_lblArc, buf);
    }

    const auto& actuators = reg_->actuators();
    if (!actuators.empty()) {
      auto* a = actuators[0];
      const float lo = a->meta().min;
      const float span = a->meta().max - lo;
      const int pct =
          span > 0 ? static_cast<int>((a->state() - lo) * 100 / span) : 0;
      lv_bar_set_value(g_bar, pct, LV_ANIM_OFF);
    }
  }
#endif

#ifdef BREWCTL_SPIKE_METRICS
  if (g_metrics) g_metrics->recordDisplayTick(micros() - t0);
#else
  (void)t0;
#endif
}

}  // namespace BrewControl

#endif  // BREWCTL_HAS_DISPLAY
