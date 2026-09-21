#pragma once

// Minimal SH8601 AMOLED driver over QSPI for the T-Display-S3-AMOLED-1.75.
//
// Why not Arduino_GFX: that library cannot be built for an ESP32-S3 on
// arduino-esp32 2.x in any version that knows the SH8601. Versions below 1.6.1
// have no SH8601 at all; 1.6.1 fails because databus/Arduino_ESP32RGBPanel.h
// declares esp_rgb_panel_t only for ESP_ARDUINO_VERSION_MAJOR > 5 while the
// matching .cpp uses it for < 3; 1.6.2 and up include esp32-hal-periman.h, a
// core-3 header. PlatformIO compiles every .cpp of a library, so the unused
// parallel-RGB and SPI backends break the build regardless of what we include.
//
// LVGL renders everything itself and asks the panel for exactly one operation:
// blit a rectangle of RGB565. That is small enough to own outright — and it
// keeps the display off the critical path of the core-3 migration.

#ifdef BREWCTL_HAS_DISPLAY

#include <Arduino.h>
#include <driver/spi_master.h>

namespace BrewControl {

class Sh8601Panel {
 public:
  struct Pins {
    int8_t cs, sck, d0, d1, d2, d3, rst, en;
  };

  // maxTransferBytes must cover the largest blit in one go — that lets the SPI
  // driver own chip select and removes the multi-chunk continuation dance
  // (0x32/0x3C00 with CS held low) the generic libraries need.
  bool begin(const Pins& pins, int16_t width, int16_t height,
             size_t maxTransferBytes);

  // data is big-endian RGB565, w*h pixels. Blocking.
  void blit(int16_t x, int16_t y, int16_t w, int16_t h, const uint8_t* data,
            size_t len);

  // 0x00..0xFF. The panel has no backlight; brightness is a panel command.
  void setBrightness(uint8_t value);

  void fill(int16_t x, int16_t y, int16_t w, int16_t h, uint16_t color565);

  int16_t width() const { return width_; }
  int16_t height() const { return height_; }

 private:
  void writeCommand_(uint8_t cmd);
  void writeCommandData_(uint8_t cmd, const uint8_t* data, size_t len);
  void setAddrWindow_(int16_t x, int16_t y, int16_t w, int16_t h);

  spi_device_handle_t dev_ = nullptr;
  Pins pins_ = {};
  int16_t width_ = 0;
  int16_t height_ = 0;
};

}  // namespace BrewControl

#endif  // BREWCTL_HAS_DISPLAY
