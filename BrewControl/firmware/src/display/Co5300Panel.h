#pragma once

// CO5300 AMOLED driver over QSPI for the T-Display-S3-AMOLED-1.75.
//
// Which controller this board carries is not obvious from its name: LilyGo's
// libraries/Mylibrary/pin_config.h selects between
//   DO0143FAT01  1.43" SH8601 + FT3168
//   H0175Y003AM  1.75" CO5300 + CST9217   <- this board
//   DO0143FMST10 1.43" CO5300 + FT3168
// The README's pin/IC table only describes the 1.43. Confirmed on the device:
// an I2C scan finds the touch at 0x5A (CST9217), not 0x38 (FT3168).
//
// Why not Arduino_GFX: it cannot be built for an ESP32-S3 on arduino-esp32 2.x
// in any version that knows these panels. Below 1.6.1 they are missing; 1.6.1
// fails because databus/Arduino_ESP32RGBPanel.h declares esp_rgb_panel_t only
// for ESP_ARDUINO_VERSION_MAJOR > 5 while its .cpp uses it for < 3; 1.6.2 and
// up include esp32-hal-periman.h, a core-3 header. PlatformIO compiles every
// .cpp of a library, so the unused parallel-RGB and SPI backends break the
// build no matter what we include. LVGL renders everything itself and asks the
// panel for exactly one operation - blit a rectangle - so owning the driver is
// smaller than any workaround, and keeps the display off the critical path of
// the core-3 migration.

#ifdef BREWCTL_HAS_DISPLAY

#include <Arduino.h>
#include <driver/spi_master.h>

namespace BrewControl {

class Co5300Panel {
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

  // Reads len bytes from a panel register. The decisive bring-up test: a sane
  // answer proves the QSPI lines reach the controller, all-zero or all-0xFF
  // means they do not. Needs SPI-read mode (0x47) enabled first.
  bool readRegister(uint8_t reg, uint8_t* out, size_t len);

  int16_t width() const { return width_; }
  int16_t height() const { return height_; }

 private:
  void csLow_();
  void csHigh_();
  void writeCommand_(uint8_t cmd);
  void writeCommandData_(uint8_t cmd, const uint8_t* data, size_t len);
  void writeC8D8_(uint8_t cmd, uint8_t value);
  void setAddrWindow_(int16_t x, int16_t y, int16_t w, int16_t h);

  spi_device_handle_t dev_ = nullptr;
  Pins pins_ = {};
  int16_t width_ = 0;
  int16_t height_ = 0;
};

}  // namespace BrewControl

#endif  // BREWCTL_HAS_DISPLAY
