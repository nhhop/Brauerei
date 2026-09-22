#include "Co5300Panel.h"

#ifdef BREWCTL_HAS_DISPLAY

#include <driver/spi_common.h>

namespace BrewControl {
namespace {

// CO5300 user commands (datasheet names kept for grep-ability).
constexpr uint8_t kSlpOut = 0x11;      // Sleep Out
constexpr uint8_t kInvOff = 0x20;      // Inversion Off
constexpr uint8_t kDispOn = 0x29;      // Display On
constexpr uint8_t kCaSet = 0x2A;       // Column Address Set
constexpr uint8_t kPaSet = 0x2B;       // Page Address Set
constexpr uint8_t kRamWr = 0x2C;       // Memory Write Start
constexpr uint8_t kPixFmt = 0x3A;      // Interface Pixel Format
constexpr uint8_t kSpiReadOn = 0x47;   // SPI read On
constexpr uint8_t kBrightness = 0x51;  // Brightness, normal mode
constexpr uint8_t kCtrlD1 = 0x53;      // Write CTRL Display1
constexpr uint8_t kWriteCe = 0x58;     // Write CE (contrast enhancement)
constexpr uint8_t kBrightHbm = 0x63;   // Brightness, HBM mode
constexpr uint8_t kPageSel = 0xFE;     // Command page select
constexpr uint8_t kSpiModeCtl = 0xC4;  // SPI mode control

// 0x55 is 16 bpp on the CO5300 — the SH8601 wants 0x05 for the same thing,
// which is one of the reasons an SH8601 init leaves this panel dark.
constexpr uint8_t kPixFmt16Bpp = 0x55;
constexpr uint8_t kSpiModeQuad = 0x80;
constexpr uint32_t kSlpOutDelayMs = 120;

// The 466-wide panel starts at column 6; LilyGo passes the same offset to
// Arduino_CO5300 for this board.
constexpr int16_t kColOffset = 6;

// QSPI framing, as the panel expects it: command and address always go out on
// one line with cmd 0x02; pixel payload goes out on four lines with cmd 0x32
// and address 0x3C00 (Memory Write Continue), after a plain 0x2C has opened
// the write. Anything else and the panel ignores the data.
constexpr uint8_t kCmdWrite = 0x02;
constexpr uint8_t kCmdRead = 0x03;
constexpr uint8_t kCmdPixels = 0x32;
constexpr uint32_t kAddrPixels = 0x003C00;

constexpr spi_host_device_t kHost = SPI2_HOST;
constexpr int kClockHz = 40 * 1000 * 1000;

}  // namespace

bool Co5300Panel::begin(const Pins& pins, int16_t width, int16_t height,
                        size_t maxTransferBytes) {
  pins_ = pins;
  width_ = width;
  height_ = height;

  if (pins_.en >= 0) {
    pinMode(pins_.en, OUTPUT);
    digitalWrite(pins_.en, HIGH);
  }
  pinMode(pins_.cs, OUTPUT);
  digitalWrite(pins_.cs, HIGH);

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
  dev.spics_io_num = -1;  // driven by hand, see csLow_()
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

  writeC8D8_(kPageSel, 0x00);
  // Without this the controller never enters quad mode and silently drops
  // every pixel write — the single most important line in this file.
  writeC8D8_(kSpiModeCtl, kSpiModeQuad);
  writeC8D8_(kPixFmt, kPixFmt16Bpp);
  writeC8D8_(kCtrlD1, 0x20);
  writeC8D8_(kBrightHbm, 0xFF);
  writeCommand_(kInvOff);
  writeCommand_(kDispOn);
  writeC8D8_(kWriteCe, 0x00);
  setBrightness(0xD0);
  delay(10);
  return true;
}

void Co5300Panel::csLow_() { digitalWrite(pins_.cs, LOW); }
void Co5300Panel::csHigh_() { digitalWrite(pins_.cs, HIGH); }

void Co5300Panel::writeCommand_(uint8_t cmd) {
  spi_transaction_t t = {};
  t.flags = SPI_TRANS_MULTILINE_CMD | SPI_TRANS_MULTILINE_ADDR;
  t.cmd = kCmdWrite;
  t.addr = static_cast<uint32_t>(cmd) << 8;
  t.length = 0;
  csLow_();
  spi_device_polling_transmit(dev_, &t);
  csHigh_();
}

void Co5300Panel::writeCommandData_(uint8_t cmd, const uint8_t* data,
                                    size_t len) {
  spi_transaction_t t = {};
  t.flags = SPI_TRANS_MULTILINE_CMD | SPI_TRANS_MULTILINE_ADDR;
  t.cmd = kCmdWrite;
  t.addr = static_cast<uint32_t>(cmd) << 8;
  t.length = len * 8;
  if (len <= 4) {
    // Payloads of four bytes or fewer ride inside the transaction struct.
    // Handing the driver a pointer instead would put a small stack array on a
    // DMA path that requires DMA-capable, word-aligned memory - which a local
    // array is not guaranteed to be. Arduino_GFX uses TXDATA here for exactly
    // this reason, and getting it wrong means the init commands never land,
    // so the panel stays dark and every register read comes back 0xFF.
    t.flags |= SPI_TRANS_USE_TXDATA;
    for (size_t i = 0; i < len; ++i) t.tx_data[i] = data[i];
  } else {
    t.tx_buffer = data;
  }
  csLow_();
  spi_device_polling_transmit(dev_, &t);
  csHigh_();
}

void Co5300Panel::writeC8D8_(uint8_t cmd, uint8_t value) {
  writeCommandData_(cmd, &value, 1);
}

void Co5300Panel::setAddrWindow_(int16_t x, int16_t y, int16_t w, int16_t h) {
  const uint16_t x0 = x + kColOffset;
  const uint16_t x1 = x0 + w - 1;
  const uint16_t y1 = y + h - 1;
  const uint8_t cols[4] = {
      static_cast<uint8_t>(x0 >> 8), static_cast<uint8_t>(x0),
      static_cast<uint8_t>(x1 >> 8), static_cast<uint8_t>(x1)};
  const uint8_t rows[4] = {
      static_cast<uint8_t>(y >> 8), static_cast<uint8_t>(y),
      static_cast<uint8_t>(y1 >> 8), static_cast<uint8_t>(y1)};
  writeCommandData_(kCaSet, cols, 4);
  writeCommandData_(kPaSet, rows, 4);
  writeCommand_(kRamWr);
}

void Co5300Panel::blit(int16_t x, int16_t y, int16_t w, int16_t h,
                       const uint8_t* data, size_t len) {
  if (!dev_) return;
  setAddrWindow_(x, y, w, h);

  spi_transaction_ext_t ext = {};
  ext.base.flags = SPI_TRANS_MODE_QIO;
  ext.base.cmd = kCmdPixels;
  ext.base.addr = kAddrPixels;
  ext.base.tx_buffer = data;
  ext.base.length = len * 8;
  csLow_();
  spi_device_polling_transmit(dev_, &ext.base);
  csHigh_();
}

bool Co5300Panel::readRegister(uint8_t reg, uint8_t* out, size_t len) {
  if (!dev_) return false;
  writeCommand_(kSpiReadOn);
  spi_transaction_t t = {};
  t.flags = SPI_TRANS_USE_RXDATA;
  t.cmd = kCmdRead;
  t.addr = static_cast<uint32_t>(reg) << 8;
  t.rxlength = len * 8;
  t.length = 0;
  csLow_();
  const esp_err_t err = spi_device_polling_transmit(dev_, &t);
  csHigh_();
  if (err != ESP_OK) return false;
  for (size_t i = 0; i < len && i < 4; ++i) out[i] = t.rx_data[i];
  return true;
}

void Co5300Panel::setBrightness(uint8_t value) {
  writeC8D8_(kBrightness, value);
}

void Co5300Panel::fill(int16_t x, int16_t y, int16_t w, int16_t h,
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
