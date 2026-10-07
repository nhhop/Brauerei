#include "DisplayUI.h"

#ifdef BREWCTL_HAS_DISPLAY

#include <Arduino.h>
#include <TouchDrv.hpp>
#include <Wire.h>
#include <databus/Arduino_ESP32QSPI.h>
#include <display/Arduino_CO5300.h>
#include <esp_heap_caps.h>
#include <lvgl.h>
#include <SensActCtrl.h>

#include <cstring>

#include "../DisplayOrientation.h"
#include "../SettingsStore.h"

namespace BrewControl {
namespace {

#if defined(BREWCTL_BOARD_M5_STOPWATCH)
// From M5GFX's StopWatch setup (the M5 docs page lists the data lines wrong).
// Panel reset and supply are M5IOE1 pins, handled by BoardInit.cpp, so the
// driver falls back to a software reset.
constexpr int8_t kLcdCs = 39;
constexpr int8_t kLcdSck = 40;
constexpr int8_t kLcdD0 = 41;
constexpr int8_t kLcdD1 = 42;
constexpr int8_t kLcdD2 = 46;
constexpr int8_t kLcdD3 = 45;
constexpr int8_t kLcdRst = -1;
constexpr int8_t kLcdEn = -1;
constexpr int8_t kTouchRst = -1;  // M5IOE1 IO4, reset in BoardInit.cpp
// CST820 (CST816 register set): reports 0..233, half the panel resolution, in
// the panel's own orientation (M5GFX: x/y_max 233, offset_rotation 0).
using TouchChip = TouchDrvCST816;
constexpr uint8_t kTouchAddr = 0x15;
constexpr int16_t kTouchScale = 2;
constexpr bool kTouchMirror = false;
#elif defined(BREWCTL_BOARD_WAVESHARE_AMOLED175)
// Waveshare's examples/arduino/libraries/Mylibrary/pin_config.h. No enable
// pin: the AXP2101 powers the panel by default.
constexpr int8_t kLcdCs = 12;
constexpr int8_t kLcdSck = 38;
constexpr int8_t kLcdD0 = 4;
constexpr int8_t kLcdD1 = 5;
constexpr int8_t kLcdD2 = 6;
constexpr int8_t kLcdD3 = 7;
constexpr int8_t kLcdRst = 39;
constexpr int8_t kLcdEn = -1;
constexpr int8_t kTouchRst = 40;
using TouchChip = TouchDrvCST92xx;
constexpr uint8_t kTouchAddr = 0x5A;
constexpr int16_t kTouchScale = 1;
// The touch layer sits rotated 180 deg against the panel (Waveshare's example
// mirrors both axes, as found on the LilyGo).
constexpr bool kTouchMirror = true;
#else
// LilyGo: pin map as verified on the device 2026-09-22. Authoritative source
// is LilyGo's libraries/Mylibrary/pin_config.h (H0175Y003AM), not their README.
constexpr int8_t kLcdCs = 10;
constexpr int8_t kLcdSck = 12;
constexpr int8_t kLcdD0 = 11;
constexpr int8_t kLcdD1 = 13;
constexpr int8_t kLcdD2 = 14;
constexpr int8_t kLcdD3 = 15;
constexpr int8_t kLcdRst = 17;
constexpr int8_t kLcdEn = 16;  // panel power
constexpr int8_t kTouchRst = -1;
using TouchChip = TouchDrvCST92xx;
constexpr uint8_t kTouchAddr = 0x5A;
constexpr int16_t kTouchScale = 1;
// The touch layer sits rotated 180 deg against the panel (checked on the
// device: a tap at the top edge reported the bottom, left reported right).
constexpr bool kTouchMirror = true;
#endif
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

// Touch (TouchChip above) on the board's shared I2C bus, which main.cpp has
// already started on BREWCTL_I2C_SDA/SCL. Polled from LVGL; the interrupt line
// stays unused.

// Rotation (DisplayOrientation.h): LVGL always renders upright; flush() turns
// each block onto the panel through a small strip buffer, readTouch() turns
// the touch back. The panel's own MADCTL flips are not used: they cannot do
// 90° on the CO5300, and a flip moves the 6 px column offset to the other
// side. The strip buffer comes from internal DMA RAM, not the LVGL pool, and
// only once the picture is first turned.
constexpr uint32_t kRotBufPx = 4096;
uint16_t* g_rotBuf = nullptr;
uint16_t g_rotation = 0;  // clockwise, 0/90/180/270

Arduino_CO5300* g_gfx = nullptr;
lv_disp_draw_buf_t g_drawBuf;
lv_disp_drv_t g_dispDrv;
TouchChip g_touch;
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

// Draws a block turned by g_rotation, a few panel rows at a time. Panel rows
// of a strip start even and end odd like the block itself (465 is odd, so the
// rounder's even/odd edges survive every rotation), as the CO5300 needs.
void flushRotated(const lv_area_t* a, const uint16_t* src) {
  const int16_t w = a->x2 - a->x1 + 1;
  int16_t ax, ay, bx, by;
  rotatePoint(g_rotation, kLcdW, a->x1, a->y1, ax, ay);
  rotatePoint(g_rotation, kLcdW, a->x2, a->y2, bx, by);
  const int16_t px0 = ax < bx ? ax : bx, py0 = ay < by ? ay : by;
  const int16_t pw = (ax < bx ? bx - ax : ax - bx) + 1;
  const int16_t ph = (ay < by ? by - ay : ay - by) + 1;
  const int16_t rows = static_cast<int16_t>((kRotBufPx / pw) & ~1u);
  for (int16_t j0 = 0; j0 < ph; j0 += rows) {
    const int16_t n = ph - j0 < rows ? ph - j0 : rows;
    uint16_t* out = g_rotBuf;
    for (int16_t j = j0; j < j0 + n; ++j) {
      for (int16_t i = 0; i < pw; ++i) {
        int16_t lx, ly;
        unrotatePoint(g_rotation, kLcdW, px0 + i, py0 + j, lx, ly);
        *out++ = src[(ly - a->y1) * w + (lx - a->x1)];
      }
    }
    g_gfx->draw16bitBeRGBBitmap(px0, py0 + j0, g_rotBuf, pw, n);
  }
}

void flush(lv_disp_drv_t* drv, const lv_area_t* a, lv_color_t* px) {
  // LV_COLOR_16_SWAP=1: the buffer already holds big-endian RGB565, which the
  // panel takes byte for byte - no per-pixel conversion on this path.
  if (g_rotation && g_rotBuf) {
    flushRotated(a, reinterpret_cast<uint16_t*>(px));
  } else {
    g_gfx->draw16bitBeRGBBitmap(a->x1, a->y1, reinterpret_cast<uint16_t*>(px),
                                a->x2 - a->x1 + 1, a->y2 - a->y1 + 1);
  }
  lv_disp_flush_ready(drv);
}

void readTouch(lv_indev_drv_t*, lv_indev_data_t* data) {
  const TouchPoints& pts = g_touch.getTouchPoints();
  noteTouch(pts.hasPoints());
  if (pts.hasPoints() && !g_swallow) {
    const TouchPoint& p = pts.getPoint(0);
    int16_t x = static_cast<int16_t>(p.x * kTouchScale);
    int16_t y = static_cast<int16_t>(p.y * kTouchScale);
    if (x > kLcdW - 1) x = kLcdW - 1;
    if (y > kLcdH - 1) y = kLcdH - 1;
    if (kTouchMirror) {
      x = kLcdW - 1 - x;
      y = kLcdH - 1 - y;
    }
    int16_t lx, ly;
    unrotatePoint(g_rotation, kLcdW, x, y, lx, ly);
    data->point.x = lx;
    data->point.y = ly;
    data->state = LV_INDEV_STATE_PRESSED;
  } else {
    data->state = LV_INDEV_STATE_RELEASED;  // LVGL keeps the last point
  }
}

}  // namespace

void DisplayUI::begin(const SettingsStore& settings, SensActCtrl::Registry& registry) {
  settings_ = &settings;
  registry_ = &registry;
  if (kLcdEn >= 0) {
    pinMode(kLcdEn, OUTPUT);
    digitalWrite(kLcdEn, HIGH);
  }

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
  if (kTouchRst >= 0) g_touch.setPins(kTouchRst, -1);  // begin() pulses it
  g_touchUp = g_touch.begin(Wire, kTouchAddr);
  if (g_touchUp) {
    lv_indev_drv_init(&g_indevDrv);
    g_indevDrv.type = LV_INDEV_TYPE_POINTER;
    g_indevDrv.read_cb = readTouch;
    lv_indev_drv_register(&g_indevDrv);
  }

  ready_ = true;
  lastOrientMs_ = millis() - kOrientPollMs;  // a fixed rotation applies from the first frame
  updateRotation_();
  Serial.printf("Display: %dx%d up, draw buffer %u B, touch %s\n", kLcdW,
                kLcdH, static_cast<unsigned>(kBufPx * sizeof(lv_color_t)),
                g_touchUp ? g_touch.getModelName() : "MISSING");
}

uint32_t DisplayUI::lastTouchMs() const {
  return ready_ ? millis() - lv_disp_get_inactive_time(nullptr) : 0;
}

void DisplayUI::off() {
  if (ready_) g_gfx->displayOff();
}

void DisplayUI::updateRotation_() {
  if (millis() - lastOrientMs_ < kOrientPollMs) return;
  lastOrientMs_ = millis();
  uint16_t want = settings_->displayRotation();
  const String& id = settings_->displayOrientationSensor();
  if (id.length()) {
    // Following a sensor: rotation is its mounting offset. A missing sensor,
    // or one without valid pitch and roll, leaves the picture as it is.
    want = g_rotation;
    if (SensActCtrl::Sensor* s = registry_->findSensor(id.c_str())) {
      float pitch = 0, roll = 0;
      bool hasPitch = false, hasRoll = false;
      for (size_t i = 0; i < s->channelCount(); ++i) {
        const SensActCtrl::Channel c = s->channel(i);
        if (!c.reading.valid) continue;
        if (strcmp(c.key, "pitch") == 0) {
          pitch = c.reading.value;
          hasPitch = true;
        } else if (strcmp(c.key, "roll") == 0) {
          roll = c.reading.value;
          hasRoll = true;
        }
      }
      if (hasPitch && hasRoll)
        want = orientationFromTilt(pitch, roll, settings_->displayRotation(),
                                   settings_->displayOrientationMirror(), g_rotation);
    }
  }
  if (want == g_rotation) return;
  if (want && !g_rotBuf) {
    g_rotBuf = static_cast<uint16_t*>(heap_caps_malloc(
        kRotBufPx * sizeof(uint16_t), MALLOC_CAP_DMA | MALLOC_CAP_INTERNAL));
    if (!g_rotBuf) {
      static bool logged = false;
      if (!logged) Serial.println(F("Display: rotation buffer alloc failed"));
      logged = true;
      return;
    }
  }
  g_rotation = want;
  lv_obj_invalidate(lv_scr_act());  // the whole picture, turned
}

void DisplayUI::tick(bool holdAwake) {
  if (!ready_) return;
  updateRotation_();
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
