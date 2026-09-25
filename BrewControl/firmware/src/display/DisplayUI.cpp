#include "DisplayUI.h"

#ifdef BREWCTL_HAS_DISPLAY

#include <Arduino.h>
#include <TouchDrv.hpp>
#include <Wire.h>
#include <databus/Arduino_ESP32QSPI.h>
#include <display/Arduino_CO5300.h>
#include <esp_heap_caps.h>
#include <lvgl.h>

#include "../SettingsStore.h"

namespace BrewControl {
namespace {

// Pin map as verified on the device 2026-09-22. Authoritative source is
// LilyGo's libraries/Mylibrary/pin_config.h (H0175Y003AM), not their README.
constexpr int8_t kLcdCs = 10;
constexpr int8_t kLcdSck = 12;
constexpr int8_t kLcdD0 = 11;
constexpr int8_t kLcdD1 = 13;
constexpr int8_t kLcdD2 = 14;
constexpr int8_t kLcdD3 = 15;
constexpr int8_t kLcdRst = 17;
constexpr int8_t kLcdEn = 16;  // panel power
constexpr int16_t kLcdW = 466;
constexpr int16_t kLcdH = 466;
constexpr uint8_t kColOffset = 6;  // RAM is 480 wide, glass is 466, centred

// The library defaults to 8 MHz, which makes a full-screen redraw (424 KiB)
// cost ~110 ms of loopTask time. Everything else on this bus is ours alone.
constexpr int32_t kSpiHz = 40000000;

// Panel brightness (register 0x51) is 0..255; the settings hold percentages.
// Never 0 while lit - that is the dark state.
uint8_t percentOf(uint32_t full, uint8_t pct) {
  const uint32_t v = full * pct / 100;
  return v ? static_cast<uint8_t>(v) : 1;
}

// While dark, lv_timer_handler() does not run, so the touch is polled here at
// LVGL's own read period (LV_INDEV_DEF_READ_PERIOD).
constexpr uint32_t kDarkPollMs = 30;

// Single buffer: the blit is a polling SPI transfer, so it blocks anyway and a
// second buffer would only cost internal DMA RAM without overlapping anything.
// Even line count, see rounder() - and the whole buffer must be DMA-capable,
// because Arduino_ESP32QSPI::writeBytes() hands it to the SPI driver as is.
constexpr uint16_t kBufLines = 40;
constexpr uint32_t kBufPx = static_cast<uint32_t>(kLcdW) * kBufLines;

// CST9217 on the shared I2C bus (RTC 0x51, PMU 0x6A), which main.cpp has
// already started on SDA 7 / SCL 6. Polled from LVGL; the interrupt line
// (GPIO 9, shared with the RTC) stays unused.
constexpr uint8_t kTouchAddr = 0x5A;

Arduino_CO5300* g_gfx = nullptr;
lv_disp_draw_buf_t g_drawBuf;
lv_disp_drv_t g_dispDrv;
TouchDrvCST92xx g_touch;
bool g_touchUp = false;
lv_indev_drv_t g_indevDrv;

// A touch on a dimmed or dark panel only wakes it: readTouch() reports
// "released" until the finger lifts, so LVGL never sees that press - no click,
// no knob drag, no gesture. g_touchWoke hands the wake-up to tick().
//
// "Lifted" means no finger for kLiftMs, not one empty read: getTouchPoints()
// acknowledges every frame, and a re-read before the controller's next frame
// comes back empty. Waking from dark reads twice in a row (tick()'s poll, then
// LVGL's catch-up) - an empty second read ended the swallow mid-swipe, and the
// rest of the swipe reached LVGL (seen on the device).
constexpr uint32_t kLiftMs = 150;
bool g_asleep = false;  // panel is dimmed or dark
bool g_swallow = false;
bool g_touchWoke = false;
uint32_t g_touchSeenMs = 0;  // last read with a finger on the glass

// Records a finger seen while dimmed or dark as a wake-up to be swallowed.
void noteTouch(bool touched) {
  if (touched) {
    g_touchSeenMs = millis();
    if (g_asleep && !g_swallow) {
      g_swallow = true;
      g_touchWoke = true;
    }
  } else if (millis() - g_touchSeenMs >= kLiftMs) {
    g_swallow = false;
  }
}

// The CO5300 ignores address windows narrower or shorter than 2 px, so every
// invalidated area is widened to start on an even and end on an odd pixel.
void rounder(lv_disp_drv_t*, lv_area_t* a) {
  a->x1 &= ~1;
  a->y1 &= ~1;
  a->x2 |= 1;
  a->y2 |= 1;
}

void flush(lv_disp_drv_t* drv, const lv_area_t* a, lv_color_t* px) {
  const int16_t w = a->x2 - a->x1 + 1;
  const int16_t h = a->y2 - a->y1 + 1;
  // LV_COLOR_16_SWAP=1: the buffer already holds big-endian RGB565, which the
  // panel takes byte for byte - no per-pixel conversion on this path.
  g_gfx->draw16bitBeRGBBitmap(a->x1, a->y1, reinterpret_cast<uint16_t*>(px), w,
                              h);
  lv_disp_flush_ready(drv);
}

void readTouch(lv_indev_drv_t*, lv_indev_data_t* data) {
  const TouchPoints& pts = g_touch.getTouchPoints();
  noteTouch(pts.hasPoints());
  if (pts.hasPoints() && !g_swallow) {
    const TouchPoint& p = pts.getPoint(0);
    // The touch layer sits rotated 180 deg against the panel (checked on the
    // device: a tap at the top edge reported the bottom, left reported right).
    data->point.x = kLcdW - 1 - p.x;
    data->point.y = kLcdH - 1 - p.y;
    data->state = LV_INDEV_STATE_PRESSED;
  } else {
    data->state = LV_INDEV_STATE_RELEASED;  // LVGL keeps the last point
  }
}

}  // namespace

void DisplayUI::begin(const SettingsStore& settings) {
  settings_ = &settings;
  pinMode(kLcdEn, OUTPUT);
  digitalWrite(kLcdEn, HIGH);

  auto* bus = new Arduino_ESP32QSPI(kLcdCs, kLcdSck, kLcdD0, kLcdD1, kLcdD2,
                                    kLcdD3);
  g_gfx = new Arduino_CO5300(bus, kLcdRst, 0 /* rotation */, false /* ips */,
                             kLcdW, kLcdH, kColOffset, 0, 0, 0);
  if (!g_gfx->begin(kSpiHz)) {
    Serial.println(F("Display: panel init failed"));
    return;
  }
  g_gfx->fillScreen(0x0000);
  // The init sequence leaves it at 0.
  brightness_ = percentOf(255, settings.displayBrightness());
  g_gfx->Display_Brightness(brightness_);

  auto* buf = static_cast<lv_color_t*>(heap_caps_malloc(
      kBufPx * sizeof(lv_color_t), MALLOC_CAP_DMA | MALLOC_CAP_INTERNAL));
  if (!buf) {
    Serial.println(F("Display: draw buffer alloc failed"));
    return;
  }

  lv_init();
  lv_disp_draw_buf_init(&g_drawBuf, buf, nullptr, kBufPx);
  lv_disp_drv_init(&g_dispDrv);
  g_dispDrv.hor_res = kLcdW;
  g_dispDrv.ver_res = kLcdH;
  g_dispDrv.flush_cb = flush;
  g_dispDrv.rounder_cb = rounder;
  g_dispDrv.draw_buf = &g_drawBuf;
  lv_disp_drv_register(&g_dispDrv);
  lv_disp_trig_activity(nullptr);  // idle time counts from here, not from boot

  // A missing touch leaves a read-only display, not a dead one.
  g_touchUp = g_touch.begin(Wire, kTouchAddr);
  if (g_touchUp) {
    lv_indev_drv_init(&g_indevDrv);
    g_indevDrv.type = LV_INDEV_TYPE_POINTER;
    g_indevDrv.read_cb = readTouch;
    lv_indev_drv_register(&g_indevDrv);
  }

  ready_ = true;
  Serial.printf("Display: %dx%d up, draw buffer %u B, touch %s\n", kLcdW,
                kLcdH, static_cast<unsigned>(kBufPx * sizeof(lv_color_t)),
                g_touchUp ? g_touch.getModelName() : "MISSING");
}

void DisplayUI::tick(bool holdAwake) {
  if (!ready_) return;
  if (power_ != Power::Off) {
    lv_timer_handler();
  } else if (g_touchUp && millis() - lastPollMs_ >= kDarkPollMs) {
    lastPollMs_ = millis();
    noteTouch(g_touch.getTouchPoints().hasPoints());
  }
  if (g_touchWoke || holdAwake) {
    g_touchWoke = false;
    lv_disp_trig_activity(nullptr);
  }

  // LVGL tracks the time since the last press itself; the lv_tick source is
  // millis(), so this is current even while lv_timer_handler() is paused.
  const uint32_t idle = lv_disp_get_inactive_time(nullptr);
  const uint32_t dimMs = settings_->displayDimAfterSec() * 1000UL;
  const uint32_t offMs = settings_->displayOffAfterSec() * 1000UL;
  Power next = Power::Awake;
  if (offMs && idle >= offMs)
    next = Power::Off;
  else if (dimMs && idle >= dimMs)
    next = Power::Dimmed;

  // Coming back from dark: let the pages catch up first (their refresh timer
  // is overdue and runs ahead of the render), so the panel does not light up
  // on the frame it went dark with.
  if (power_ == Power::Off && next != Power::Off) lv_timer_handler();
  power_ = next;
  g_asleep = next != Power::Awake;

  // Written only on a change, so a new brightness setting takes effect live.
  uint8_t level = percentOf(255, settings_->displayBrightness());
  if (next == Power::Off)
    level = 0;  // AMOLED: pixels off, nothing left to burn in
  else if (next == Power::Dimmed)
    level = percentOf(level, settings_->displayDimPercent());
  if (level != brightness_) {
    g_gfx->Display_Brightness(level);
    brightness_ = level;
  }
}

void DisplayUI::wake() {
  if (ready_) lv_disp_trig_activity(nullptr);
}

}  // namespace BrewControl

#endif  // BREWCTL_HAS_DISPLAY
