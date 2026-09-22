#pragma once

// Spike: drives the T-Display-S3-AMOLED-1.75 panel from loop().
//
// Staged so each bring-up risk is verifiable on its own (-DBREWCTL_DISPLAY_STAGE):
//   1  panel only, no LVGL   — colour fills + 1 px border: pin map, colour
//                              order, resolution, row/column offsets
//   2  + touch               — draws a dot where the controller says the finger
//                              is, which verifies the axis mapping by eye
//   3  + LVGL probe screen   — the widget classes a mirrored dashboard needs
//
// Pins default to LilyGo's documented map and can be overridden per build flag
// without touching code — their README already proved wrong once (SD CS).

#ifdef BREWCTL_HAS_DISPLAY

#include <Arduino.h>
#include <SensActCtrl.h>

#ifndef BREWCTL_DISPLAY_STAGE
#define BREWCTL_DISPLAY_STAGE 3
#endif

// Panel (QSPI) and touch (I2C) pin map.
#ifndef BREWCTL_LCD_CS
#define BREWCTL_LCD_CS 10
#endif
#ifndef BREWCTL_LCD_SCK
#define BREWCTL_LCD_SCK 12
#endif
#ifndef BREWCTL_LCD_D0
#define BREWCTL_LCD_D0 11
#endif
#ifndef BREWCTL_LCD_D1
#define BREWCTL_LCD_D1 13
#endif
#ifndef BREWCTL_LCD_D2
#define BREWCTL_LCD_D2 14
#endif
#ifndef BREWCTL_LCD_D3
#define BREWCTL_LCD_D3 15
#endif
#ifndef BREWCTL_LCD_RST
#define BREWCTL_LCD_RST 17
#endif
#ifndef BREWCTL_LCD_EN
#define BREWCTL_LCD_EN 16
#endif
// Round panel, confirmed by eye on the device 2026-09-22 - which matches the
// 2026-05-18 note in SESSION-archive ("466x466 round AMOLED", board in hand).
// LilyGo's wiki page for the 1.75 lists 280x456; that is a different build.
#ifndef BREWCTL_LCD_W
#define BREWCTL_LCD_W 466
#endif
#ifndef BREWCTL_LCD_H
#define BREWCTL_LCD_H 466
#endif
#ifndef BREWCTL_TOUCH_SDA
#define BREWCTL_TOUCH_SDA 7
#endif
#ifndef BREWCTL_TOUCH_SCL
#define BREWCTL_TOUCH_SCL 6
#endif

namespace BrewControl {

#ifdef BREWCTL_SPIKE_METRICS
class SpikeMetrics;
#endif

class DisplayUI {
 public:
  // Must run before Registry::begin(): it calls Wire.begin(SDA, SCL) with the
  // board's real I2C pins. The variant header defaults Wire to SDA 18 / SCL 17,
  // and SCL 17 is the panel reset line — an I2C sensor item would otherwise
  // clock the panel into reset.
  void begin(SensActCtrl::Registry& reg);

  void tick();

  // One-line panel/touch read-back from begin(), for the SD boot log.
  static const char* probeResult();

#ifdef BREWCTL_SPIKE_METRICS
  void setMetrics(SpikeMetrics* m);
#endif

 private:
  SensActCtrl::Registry* reg_ = nullptr;
  uint32_t lastRefreshMs_ = 0;
};

}  // namespace BrewControl

#endif  // BREWCTL_HAS_DISPLAY
