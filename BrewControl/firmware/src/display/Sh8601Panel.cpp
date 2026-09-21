#include "Sh8601Panel.h"

#ifdef BREWCTL_HAS_DISPLAY

#include <driver/spi_common.h>

namespace BrewControl {
namespace {

// SH8601 user commands (datasheet names kept for grep-ability).
constexpr uint8_t kSlpOut = 0x11;   // Sleep Out
constexpr uint8_t kNorOn = 0x13;    // Normal Display Mode On
constexpr uint8_t kInvOff = 0x20;   // Inversion Off
constexpr uint8_t kDispOn = 0x29;   // Display On
constexpr uint8_t kCaSet = 0x2A;    // Column Address Set
constexpr uint8_t kPaSet = 0x2B;    // Page Address Set
constexpr uint8_t kRamWr = 0x2C;    // Memory Write Start
constexpr uint8_t kPixFmt = 0x3A;   // Interface Pixel Format
constexpr uint8_t kBrightness = 0x51;  // Write Display Brightness, normal mode
constexpr uint8_t kCtrlD1 = 0x53;   // Write CTRL Display1
constexpr uint8_t kWriteCe = 0x58;  // Write CE (contrast enhancement)

constexpr uint8_t kPixFmt16Bpp = 0x05;
constexpr uint32_t kSlpOutDelayMs = 120;

// QSPI framing, as the panel expects it: command and address always go out on
// one line with cmd 0x02; pixel payload goes out on four lines with cmd 0x32
// and address 0x3C00 (Memory Write Continue), after a plain 0x2C has opened the
// write. Anything else and the panel ignores the data.
constexpr uint8_t kCmdWrite = 0x02;
constexpr uint8_t kCmdPixels = 0x32;
constexpr uint32_t kAddrPixels = 0x003C00;

constexpr spi_host_device_t kHost = SPI2_HOST;
constexpr int kClockHz = 40 * 1000 * 1000;

}  // namespace

bool Sh8601Panel::begin(const Pins& pins, int16_t width, int16_t height,
                        size_t maxTransferBytes) {
  pins_ = pins;
  width_ = width;
  height_ = height;

  if (pins_.en >= 0) {
    pinMode(pins_.en, OUTPUT);
    digitalWrite(pins_.en, HIGH);
  }

  spi_bus_config_t bus = {};
  bus.data0_io_num = pins_.d0;
  bus.data1_io_num = pins_.d1;
  bus.sclk_io_num = pins_.sck;
  bus.data2_io_num = pins_.d2;
  bus.data3_io_num = pins_.d3;
  bus.data4_io_num = -1;
  bus.data5_io_num = -1;
  bus.data6_io_num = -1;
  bus.data7_io_num = -1;
  bus.max_transfer_sz = static_cast<int>(maxTransferBytes) + 64;
  bus.flags = SPICOMMON_BUSFLAG_MASTER | SPICOMMON_BUSFLAG_GPIO_PINS;
  if (spi_bus_initialize(kHost, &bus, SPI_DMA_CH_AUTO) != ESP_OK) return false;

  spi_device_interface_config_t dev = {};
  dev.command_bits = 8;
  dev.address_bits = 24;
  dev.mode = 0;
  dev.clock_speed_hz = kClockHz;
  dev.spics_io_num = pins_.cs;  // driver-owned: every blit is one transaction
  dev.queue_size = 1;
  dev.flags = SPI_DEVICE_HALFDUPLEX;
  if (spi_bus_add_device(kHost, &dev, &dev_) != ESP_OK) return false;

  if (pins_.rst >= 0) {
    pinMode(pins_.rst, OUTPUT);
    digitalWrite(pins_.rst, HIGH);
    delay(10);
    digitalWrite(pins_.rst, LOW);
    delay(10);
    digitalWrite(pins_.rst, HIGH);
    delay(200);
  }

  writeCommand_(kSlpOut);
  delay(kSlpOutDelayMs);

  writeCommand_(kNorOn);
  writeCommand_(kInvOff);
  const uint8_t bpp = kPixFmt16Bpp;
  writeCommandData_(kPixFmt, &bpp, 1);
  writeCommand_(kDispOn);
  const uint8_t ctrl = 0x28;  // brightness control on, display dimming on
  writeCommandData_(kCtrlD1, &ctrl, 1);
  const uint8_t ce = 0x00;  // contrast enhancement off
  writeCommandData_(kWriteCe, &ce, 1);
  setBrightness(0xD0);
  delay(10);
  return true;
}

void Sh8601Panel::writeCommand_(uint8_t cmd) {
  spi_transaction_t t = {};
  t.cmd = kCmdWrite;
  t.addr = static_cast<uint32_t>(cmd) << 8;
  t.length = 0;
  spi_device_polling_transmit(dev_, &t);
}

void Sh8601Panel::writeCommandData_(uint8_t cmd, const uint8_t* data,
                                    size_t len) {
  spi_transaction_t t = {};
  t.cmd = kCmdWrite;
  t.addr = static_cast<uint32_t>(cmd) << 8;
  t.tx_buffer = data;
  t.length = len * 8;
  spi_device_polling_transmit(dev_, &t);
}

void Sh8601Panel::setAddrWindow_(int16_t x, int16_t y, int16_t w, int16_t h) {
  const uint16_t x1 = x + w - 1;
  const uint16_t y1 = y + h - 1;
  const uint8_t cols[4] = {static_cast<uint8_t>(x >> 8), static_cast<uint8_t>(x),
                           static_cast<uint8_t>(x1 >> 8),
                           static_cast<uint8_t>(x1)};
  const uint8_t rows[4] = {static_cast<uint8_t>(y >> 8), static_cast<uint8_t>(y),
                           static_cast<uint8_t>(y1 >> 8),
                           static_cast<uint8_t>(y1)};
  writeCommandData_(kCaSet, cols, 4);
  writeCommandData_(kPaSet, rows, 4);
  writeCommand_(kRamWr);
}

void Sh8601Panel::blit(int16_t x, int16_t y, int16_t w, int16_t h,
                       const uint8_t* data, size_t len) {
  if (!dev_) return;
  setAddrWindow_(x, y, w, h);

  spi_transaction_ext_t ext = {};
  ext.base.flags = SPI_TRANS_MODE_QIO;
  ext.base.cmd = kCmdPixels;
  ext.base.addr = kAddrPixels;
  ext.base.tx_buffer = data;
  ext.base.length = len * 8;
  spi_device_polling_transmit(dev_, &ext.base);
}

void Sh8601Panel::setBrightness(uint8_t value) {
  writeCommandData_(kBrightness, &value, 1);
}

void Sh8601Panel::fill(int16_t x, int16_t y, int16_t w, int16_t h,
                       uint16_t color565) {
  if (!dev_) return;
  // One row at a time keeps the scratch buffer small; only used by the
  // stage-1/2 bring-up checks, never on the LVGL path.
  const size_t rowBytes = static_cast<size_t>(w) * 2;
  uint8_t* row = static_cast<uint8_t*>(
      heap_caps_malloc(rowBytes, MALLOC_CAP_DMA | MALLOC_CAP_INTERNAL));
  if (!row) return;
  for (int16_t i = 0; i < w; ++i) {
    row[i * 2] = color565 >> 8;
    row[i * 2 + 1] = color565 & 0xFF;
  }
  for (int16_t r = 0; r < h; ++r) blit(x, y + r, w, 1, row, rowBytes);
  heap_caps_free(row);
}

}  // namespace BrewControl

#endif  // BREWCTL_HAS_DISPLAY
