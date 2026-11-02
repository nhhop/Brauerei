#pragma once

#include "BusConfig.h"
#include "PinMap.h"

namespace BrewControl {

// Pin tables for the boards BrewControl builds for (see platformio.ini): ESP32-S3
// only since Arduino core 3. Chip facts from the Espressif datasheets (ADC
// channels, pull-ups); board wiring from the build flags, main.cpp and
// display/DisplayUI.cpp — keep them in sync when those change. The former
// esp32dev and lolin_s2_mini tables live on as test fixtures
// (test/TestBoards.h), because they exercise checks (DAC, input-only pins,
// ADC2 under Wi-Fi, errata) that no S3 table triggers.
// GPIO 0 is the BOOT button everywhere, which main.cpp reads for the factory
// reset (kBootButtonPin), so it counts as reserved, not merely as strapping.

// ── lilygo_t_display_s3_amoled (ESP32-S3R8, T-Display-S3-AMOLED-1.75) ────────
// No DAC; only RMT channels 0–3 can transmit. SD, I2C and display pins as in
// platformio.ini / DisplayUI.cpp (BrewControl/CLAUDE.md has the full list).
inline constexpr PinDef kLilyGoAmoledSpecial[] = {
    {0, PinClass::Reserved, "BOOT-Taste"},
    {3, PinClass::Risky, "Strapping-Pin"},
    {4, PinClass::Risky, "Batteriespannungs-ADC"},
    {6, PinClass::Reserved, "I2C SCL (Touch, RTC, PMU)"},
    {7, PinClass::Reserved, "I2C SDA (Touch, RTC, PMU)"},
    {9, PinClass::Reserved, "Touch-/RTC-Interrupt"},
    {10, PinClass::Reserved, "Display"},
    {11, PinClass::Reserved, "Display"},
    {12, PinClass::Reserved, "Display"},
    {13, PinClass::Reserved, "Display"},
    {14, PinClass::Reserved, "Display"},
    {15, PinClass::Reserved, "Display"},
    {16, PinClass::Reserved, "Display-Versorgung"},
    {17, PinClass::Reserved, "Display-Reset"},
    {19, PinClass::Risky, "USB D- (Seriell + Upload)"},
    {20, PinClass::Risky, "USB D+ (Seriell + Upload)"},
    {26, PinClass::Forbidden, "Flash"},
    {27, PinClass::Forbidden, "Flash"},
    {28, PinClass::Forbidden, "Flash"},
    {29, PinClass::Forbidden, "Flash"},
    {30, PinClass::Forbidden, "Flash"},
    {31, PinClass::Forbidden, "Flash"},
    {32, PinClass::Forbidden, "Flash"},
    {33, PinClass::Forbidden, "Octal-PSRAM"},
    {34, PinClass::Forbidden, "Octal-PSRAM"},
    {35, PinClass::Forbidden, "Octal-PSRAM"},
    {36, PinClass::Forbidden, "Octal-PSRAM"},
    {37, PinClass::Forbidden, "Octal-PSRAM"},
    {38, PinClass::Reserved, "SD-Karte CS"},
    {39, PinClass::Reserved, "SD-Karte MOSI"},
    {40, PinClass::Reserved, "SD-Karte MISO"},
    {41, PinClass::Reserved, "SD-Karte SCK"},
    {43, PinClass::Risky, "UART0 TX"},
    {44, PinClass::Risky, "UART0 RX"},
    {45, PinClass::Risky, "Strapping-Pin (Flash-Spannung)"},
    {46, PinClass::Risky, "Strapping-Pin"},
};
inline constexpr Board kLilyGoAmoled = {
    pinRange(0, 21) | pinRange(26, 48),
    0,
    0,
    kLilyGoAmoledSpecial, sizeof(kLilyGoAmoledSpecial) / sizeof(PinDef),
    4,
    pinRange(1, 10),
    pinRange(11, 20),
    0,
    0,
    pinRange(0, 21),
    false,  // ADC2 arbitrated with Wi-Fi
    7, 6,  // BREWCTL_I2C_SDA/SCL — see static_assert below
    4,      // BATTERY_VOLTAGE_ADC_DATA in LilyGo's pin_config.h
    100.0f, // 1:2 divider: GPIO 4 read 2.11 V on a charged cell (SESSION.md).
    100.0f, // Actual resistor values unknown, only the ratio matters.
    "SY6970", 0x6A,
};
// Onboard devices sharing this board's I2C bus (BrewControl/CLAUDE.md). The
// PMU is read through a sensor item of its own type.
inline constexpr AddrDef kLilyGoAmoledI2cReserved[] = {
    {0x51, "RTC (PCF8563)"},
    {0x5A, "Touch (CST9217)"},
    {0x6A, "PMU (SY6970)", "SY6970"},
};
inline constexpr FixedBus kLilyGoAmoledBuses[] = {
    {"i2c-board", "i2c", {7, 6, -1},
     "Fest verdrahtet mit RTC, Touch und PMU; SDA/SCL liegen am Header und am Qwiic-Stecker",
     kLilyGoAmoledI2cReserved, sizeof(kLilyGoAmoledI2cReserved) / sizeof(AddrDef)},
};

#if defined(BREWCTL_BOARD_LILYGO_AMOLED)
static_assert(BREWCTL_I2C_SDA == 7 && BREWCTL_I2C_SCL == 6,
              "update kLilyGoAmoledSpecial and kLilyGoAmoledBuses to the new I2C pins");
static_assert(BREWCTL_SD_CS == 38 && BREWCTL_SD_MOSI == 39 &&
                  BREWCTL_SD_MISO == 40 && BREWCTL_SD_SCK == 41,
              "update kLilyGoAmoledSpecial to the new SD pins");
#endif

// ── waveshare_s3_amoled_175 (ESP32-S3R8, ESP32-S3-Touch-AMOLED-1.75) ────────
// Same chip as the LilyGo; wiring from Waveshare's HARDWARE_REFERENCE.md and
// pin_config.h (see platformio.ini). Free for items are only GPIO 13, 17, 18,
// 47 and 48; 16 and the USB/UART pins work with a warning.
inline constexpr PinDef kWaveshareAmoled175Special[] = {
    {0, PinClass::Reserved, "BOOT-Taste"},
    {1, PinClass::Reserved, "SD-Karte CMD"},
    {2, PinClass::Reserved, "SD-Karte CLK"},
    {3, PinClass::Reserved, "SD-Karte D0"},
    {4, PinClass::Reserved, "Display"},
    {5, PinClass::Reserved, "Display"},
    {6, PinClass::Reserved, "Display"},
    {7, PinClass::Reserved, "Display"},
    {8, PinClass::Reserved, "Audio (I2S)"},
    {9, PinClass::Reserved, "Audio (I2S)"},
    {10, PinClass::Reserved, "Audio (I2S)"},
    {11, PinClass::Reserved, "Touch-Interrupt"},
    {12, PinClass::Reserved, "Display"},
    {14, PinClass::Reserved, "I2C SCL (Touch, IMU, RTC, PMU, Audio)"},
    {15, PinClass::Reserved, "I2C SDA (Touch, IMU, RTC, PMU, Audio)"},
    {16, PinClass::Risky, "Audio-MCLK laut Waveshare-Beispiel"},
    {19, PinClass::Risky, "USB D- (Seriell + Upload)"},
    {20, PinClass::Risky, "USB D+ (Seriell + Upload)"},
    {21, PinClass::Reserved, "IMU-Interrupt"},
    {26, PinClass::Forbidden, "Flash"},
    {27, PinClass::Forbidden, "Flash"},
    {28, PinClass::Forbidden, "Flash"},
    {29, PinClass::Forbidden, "Flash"},
    {30, PinClass::Forbidden, "Flash"},
    {31, PinClass::Forbidden, "Flash"},
    {32, PinClass::Forbidden, "Flash"},
    {33, PinClass::Forbidden, "Octal-PSRAM"},
    {34, PinClass::Forbidden, "Octal-PSRAM"},
    {35, PinClass::Forbidden, "Octal-PSRAM"},
    {36, PinClass::Forbidden, "Octal-PSRAM"},
    {37, PinClass::Forbidden, "Octal-PSRAM"},
    {38, PinClass::Reserved, "Display"},
    {39, PinClass::Reserved, "Display-Reset"},
    {40, PinClass::Reserved, "Touch-Reset"},
    {41, PinClass::Reserved, "SD-Karte D3"},
    {42, PinClass::Reserved, "Audio (I2S)"},
    {43, PinClass::Risky, "UART0 TX"},
    {44, PinClass::Risky, "UART0 RX"},
    {45, PinClass::Reserved, "Audio (I2S)"},
    {46, PinClass::Reserved, "Audio-Verstärker"},
};
inline constexpr Board kWaveshareAmoled175 = {
    pinRange(0, 21) | pinRange(26, 48),
    0,
    0,
    kWaveshareAmoled175Special, sizeof(kWaveshareAmoled175Special) / sizeof(PinDef),
    4,
    pinRange(1, 10),
    pinRange(11, 20),
    0,
    0,
    pinRange(0, 21),
    false,  // ADC2 arbitrated with Wi-Fi
    15, 14,  // BREWCTL_I2C_SDA/SCL — see static_assert below
    -1, 0, 0,  // No battery divider: the AXP2101 measures the cell.
    "AXP2101", 0x34,
};
// Onboard devices sharing this board's I2C bus. Not the QMI8658 (0x6B): the
// IMU is meant to be added as a sensor item on this bus; the PMU is read
// through a sensor item of its own type.
inline constexpr AddrDef kWaveshareAmoled175I2cReserved[] = {
    {0x18, "Audio-Codec (ES8311)"},
    {0x20, "Port-Expander (TCA9554)"},
    {0x34, "PMU (AXP2101)", "AXP2101"},
    {0x40, "Mikrofon-ADC (ES7210)"},
    {0x51, "RTC (PCF85063)"},
    {0x5A, "Touch (CST9217)"},
};
inline constexpr FixedBus kWaveshareAmoled175Buses[] = {
    {"i2c-board", "i2c", {15, 14, -1},
     "Fest verdrahtet mit Touch, IMU, RTC, PMU und Audio",
     kWaveshareAmoled175I2cReserved, sizeof(kWaveshareAmoled175I2cReserved) / sizeof(AddrDef)},
};
// EXIO0..2 are free (test points only), EXIO3..6 are inputs the board wires to
// RTC, power button, PMU and IMU, EXIO7 is the GNSS reset (Waveshare
// HARDWARE_REFERENCE.md). The driver adopts the chip's state, so channels no
// item takes stay as the board left them.
inline constexpr ChannelNote kWaveshareAmoled175ExpanderNotes[] = {
    {3, true, "RTC-Interrupt (PCF85063)"},
    {4, true, "PWR-Taste"},
    {5, true, "PMU-Interrupt (AXP2101)"},
    {6, true, "IMU-Interrupt (QMI8658)"},
    {7, false, "GNSS-Reset (LC76G)"},
};

#if defined(BREWCTL_BOARD_WAVESHARE_AMOLED175)
static_assert(BREWCTL_I2C_SDA == 15 && BREWCTL_I2C_SCL == 14,
              "update kWaveshareAmoled175Special and kWaveshareAmoled175Buses to the new I2C pins");
static_assert(BREWCTL_SD_MMC_CLK == 2 && BREWCTL_SD_MMC_CMD == 1 && BREWCTL_SD_MMC_D0 == 3,
              "update kWaveshareAmoled175Special to the new SD pins");
#endif

// ── m5stack_stopwatch (ESP32-S3R8, M5Stack StopWatch) ────────────────────────
// Wiring from M5GFX's and M5Unified's StopWatch code (the M5 docs page has the
// display data lines wrong). No SD; display, touch reset and supply partly sit
// behind the M5IOE1 expander (BoardInit.cpp).
inline constexpr PinDef kM5StopWatchSpecial[] = {
    {0, PinClass::Reserved, "BOOT (Strapping, Werksreset beim Start)"},
    {1, PinClass::Reserved, "Taste B"},
    {2, PinClass::Reserved, "Taste A"},
    {3, PinClass::Risky, "Strapping-Pin"},
    {13, PinClass::Reserved, "Touch-Interrupt"},
    {15, PinClass::Reserved, "Audio (I2S)"},
    {16, PinClass::Reserved, "Audio (I2S)"},
    {17, PinClass::Reserved, "Audio (I2S)"},
    {18, PinClass::Reserved, "Audio (I2S)"},
    {19, PinClass::Risky, "USB D- (Seriell + Upload)"},
    {20, PinClass::Risky, "USB D+ (Seriell + Upload)"},
    {21, PinClass::Reserved, "Audio (I2S)"},
    {26, PinClass::Forbidden, "Flash"},
    {27, PinClass::Forbidden, "Flash"},
    {28, PinClass::Forbidden, "Flash"},
    {29, PinClass::Forbidden, "Flash"},
    {30, PinClass::Forbidden, "Flash"},
    {31, PinClass::Forbidden, "Flash"},
    {32, PinClass::Forbidden, "Flash"},
    {33, PinClass::Forbidden, "Octal-PSRAM"},
    {34, PinClass::Forbidden, "Octal-PSRAM"},
    {35, PinClass::Forbidden, "Octal-PSRAM"},
    {36, PinClass::Forbidden, "Octal-PSRAM"},
    {37, PinClass::Forbidden, "Octal-PSRAM"},
    {38, PinClass::Reserved, "Display (TE)"},
    {39, PinClass::Reserved, "Display"},
    {40, PinClass::Reserved, "Display"},
    {41, PinClass::Reserved, "Display"},
    {42, PinClass::Reserved, "Display"},
    {43, PinClass::Risky, "UART0 TX"},
    {44, PinClass::Risky, "UART0 RX"},
    {45, PinClass::Reserved, "Display"},
    {46, PinClass::Reserved, "Display"},
    {47, PinClass::Reserved, "I2C SDA (Touch, IMU, RTC, PMU, Expander, Audio)"},
    {48, PinClass::Reserved, "I2C SCL (Touch, IMU, RTC, PMU, Expander, Audio)"},
};
inline constexpr Board kM5StopWatch = {
    pinRange(0, 21) | pinRange(26, 48),
    0,
    0,
    kM5StopWatchSpecial, sizeof(kM5StopWatchSpecial) / sizeof(PinDef),
    4,
    pinRange(1, 10),
    pinRange(11, 20),
    0,
    0,
    pinRange(0, 21),
    false,  // ADC2 arbitrated with Wi-Fi
    47, 48,  // BREWCTL_I2C_SDA/SCL — see static_assert below
    // No battery divider: the M5PM1 measures the cell (PLAN.md).
};
// Onboard devices sharing this board's I2C bus. Not the BMI270 (0x68): the
// IMU is meant to be added as a sensor item on this bus.
inline constexpr AddrDef kM5StopWatchI2cReserved[] = {
    {0x15, "Touch (CST820)"},
    {0x18, "Audio-Codec (ES8311)"},
    {0x32, "RTC (RX8130)"},
    {0x4F, "Port-Expander (M5IOE1)"},
    {0x6E, "PMU (M5PM1)"},
};
inline constexpr FixedBus kM5StopWatchBuses[] = {
    {"i2c-board", "i2c", {47, 48, -1},
     "Fest verdrahtet mit Touch, IMU, RTC, PMU, Port-Expander und Audio",
     kM5StopWatchI2cReserved, sizeof(kM5StopWatchI2cReserved) / sizeof(AddrDef)},
};

#if defined(BREWCTL_BOARD_M5_STOPWATCH)
static_assert(BREWCTL_I2C_SDA == 47 && BREWCTL_I2C_SCL == 48,
              "update kM5StopWatchSpecial and kM5StopWatchBuses to the new I2C pins");
#endif

// ── waveshare_s3_lcd_5b (ESP32-S3-WROOM-1-N16R8, ESP32-S3-Touch-LCD-5B) ─────
// Wiring from docs.waveshare.com/ESP32-S3-Touch-LCD-5. 1024x600 parallel-RGB
// panel on 16 GPIOs plus DE/VSYNC/HSYNC/PCLK; the panel and touch reset, the
// backlight and the SD chip select sit behind the CH422G (BoardInit.cpp). Free
// for items: only GPIO 6 - and that one is the SD library's dummy chip select.
inline constexpr PinDef kWaveshareLcd5bSpecial[] = {
    {0, PinClass::Reserved, "BOOT-Taste, Display (RGB G3)"},
    {1, PinClass::Reserved, "Display (RGB R3)"},
    {2, PinClass::Reserved, "Display (RGB R4)"},
    {3, PinClass::Reserved, "Display (VSYNC)"},
    {4, PinClass::Reserved, "Touch-Interrupt"},
    {5, PinClass::Reserved, "Display (DE)"},
    {6, PinClass::Reserved, "SD-Bibliothek: Attrappe fuer den Chip-Select (liegt am CH422G)"},
    {7, PinClass::Reserved, "Display (PCLK)"},
    {8, PinClass::Reserved, "I2C SDA (Touch, RTC, CH422G)"},
    {9, PinClass::Reserved, "I2C SCL (Touch, RTC, CH422G)"},
    {10, PinClass::Reserved, "Display (RGB B7)"},
    {11, PinClass::Reserved, "SD-Karte MOSI"},
    {12, PinClass::Reserved, "SD-Karte SCK"},
    {13, PinClass::Reserved, "SD-Karte MISO"},
    {14, PinClass::Reserved, "Display (RGB B3)"},
    {15, PinClass::Reserved, "CAN TX"},
    {16, PinClass::Reserved, "CAN RX"},
    {17, PinClass::Reserved, "Display (RGB B6)"},
    {18, PinClass::Reserved, "Display (RGB B5)"},
    {19, PinClass::Risky, "USB D- (Seriell + Upload)"},
    {20, PinClass::Risky, "USB D+ (Seriell + Upload)"},
    {21, PinClass::Reserved, "Display (RGB G7)"},
    {26, PinClass::Forbidden, "Flash"},
    {27, PinClass::Forbidden, "Flash"},
    {28, PinClass::Forbidden, "Flash"},
    {29, PinClass::Forbidden, "Flash"},
    {30, PinClass::Forbidden, "Flash"},
    {31, PinClass::Forbidden, "Flash"},
    {32, PinClass::Forbidden, "Flash"},
    {33, PinClass::Forbidden, "Octal-PSRAM"},
    {34, PinClass::Forbidden, "Octal-PSRAM"},
    {35, PinClass::Forbidden, "Octal-PSRAM"},
    {36, PinClass::Forbidden, "Octal-PSRAM"},
    {37, PinClass::Forbidden, "Octal-PSRAM"},
    {38, PinClass::Reserved, "Display (RGB B4)"},
    {39, PinClass::Reserved, "Display (RGB G2)"},
    {40, PinClass::Reserved, "Display (RGB R7)"},
    {41, PinClass::Reserved, "Display (RGB R6)"},
    {42, PinClass::Reserved, "Display (RGB R5)"},
    {43, PinClass::Reserved, "RS485 TXD"},
    {44, PinClass::Reserved, "RS485 RXD"},
    {45, PinClass::Reserved, "Display (RGB G4)"},
    {46, PinClass::Reserved, "Display (HSYNC)"},
    {47, PinClass::Reserved, "Display (RGB G6)"},
    {48, PinClass::Reserved, "Display (RGB G5)"},
};
inline constexpr Board kWaveshareLcd5b = {
    pinRange(0, 21) | pinRange(26, 48),
    0,
    0,
    kWaveshareLcd5bSpecial, sizeof(kWaveshareLcd5bSpecial) / sizeof(PinDef),
    4,
    pinRange(1, 10),
    pinRange(11, 20),
    0,
    0,
    pinRange(0, 21),
    false,  // ADC2 arbitrated with Wi-Fi
    8, 9,   // BREWCTL_I2C_SDA/SCL — see static_assert below
    // No battery divider and no PMU: the board has a charger, but nothing to read.
};
// Onboard devices sharing this board's I2C bus. The CH422G answers on four
// addresses at once (one per function); Waveshare asks to keep the whole
// 0x20..0x27 and 0x30..0x3F ranges free, but only these four are taken.
inline constexpr AddrDef kWaveshareLcd5bI2cReserved[] = {
    {0x23, "Port-Expander (CH422G, OC-Ausgaenge)"},
    {0x24, "Port-Expander (CH422G, Einstellung)"},
    {0x26, "Port-Expander (CH422G, Eingaenge)"},
    {0x38, "Port-Expander (CH422G, IO-Ausgaenge)"},
    {0x51, "RTC (PCF85063)"},
    {0x5D, "Touch (GT911)"},
};
inline constexpr FixedBus kWaveshareLcd5bBuses[] = {
    {"i2c-board", "i2c", {8, 9, -1},
     "Fest verdrahtet mit Touch, RTC und Port-Expander",
     kWaveshareLcd5bI2cReserved, sizeof(kWaveshareLcd5bI2cReserved) / sizeof(AddrDef)},
};
// EXIO0 and EXIO5 are the optically isolated inputs DI0 and DI1, EXIO1..4 are
// the touch reset, backlight, panel reset and SD chip select, EXIO6/7 are not
// wired. OD0/OD1 are the outputs DO0/DO1 and free. Measured on the device with
// a pull-up to 3.3 V: 0 sinks the terminal to ground, 1 reads 3.3 V; without
// the pull-up it floats (0 V). Open-drain, so a load that switches to ground
// is "on" at 0.
inline constexpr ChannelNote kWaveshareLcd5bExpanderNotes[] = {
    {0, true, "DI0 (Optokoppler-Eingang)"},
    {1, false, "Touch-Reset"},
    {2, false, "Display-Hintergrundbeleuchtung"},
    {3, false, "Display-Reset"},
    {4, false, "SD-Karte CS"},
    {5, true, "DI1 (Optokoppler-Eingang)"},
};

#if defined(BREWCTL_BOARD_WAVESHARE_LCD5B)
static_assert(BREWCTL_I2C_SDA == 8 && BREWCTL_I2C_SCL == 9,
              "update kWaveshareLcd5bSpecial and kWaveshareLcd5bBuses to the new I2C pins");
static_assert(BREWCTL_SD_CS == 6 && BREWCTL_SD_MOSI == 11 && BREWCTL_SD_MISO == 13 &&
                  BREWCTL_SD_SCK == 12,
              "update kWaveshareLcd5bSpecial to the new SD pins");
#endif

#if defined(ARDUINO) && !defined(BREWCTL_BOARD_LILYGO_AMOLED) && \
    !defined(BREWCTL_BOARD_WAVESHARE_AMOLED175) && !defined(BREWCTL_BOARD_M5_STOPWATCH) && \
    !defined(BREWCTL_BOARD_WAVESHARE_LCD5B)
#error "Build without a BREWCTL_BOARD_* flag: only the S3 boards in platformio.ini are supported"
#endif

// The table of the board this firmware is built for.
inline const Board& currentBoard() {
#if defined(BREWCTL_BOARD_M5_STOPWATCH)
  return kM5StopWatch;
#elif defined(BREWCTL_BOARD_WAVESHARE_LCD5B)
  return kWaveshareLcd5b;
#elif defined(BREWCTL_BOARD_WAVESHARE_AMOLED175)
  return kWaveshareAmoled175;
#else
  // BREWCTL_BOARD_LILYGO_AMOLED, and the native unit tests (which pass their
  // board explicitly and never call this).
  return kLilyGoAmoled;
#endif
}

// The buses the current board wires itself, analogous to currentBoard().
inline std::vector<BusDef> currentFixedBuses() {
  std::vector<BusDef> out;
#if defined(BREWCTL_BOARD_M5_STOPWATCH)
  for (const FixedBus& f : kM5StopWatchBuses) out.push_back(busFromFixed(f));
#elif defined(BREWCTL_BOARD_WAVESHARE_LCD5B)
  for (const FixedBus& f : kWaveshareLcd5bBuses) out.push_back(busFromFixed(f));
#elif defined(BREWCTL_BOARD_WAVESHARE_AMOLED175)
  for (const FixedBus& f : kWaveshareAmoled175Buses) out.push_back(busFromFixed(f));
#elif defined(BREWCTL_BOARD_LILYGO_AMOLED)
  for (const FixedBus& f : kLilyGoAmoledBuses) out.push_back(busFromFixed(f));
#endif
  return out;
}

// The peripheral devices the current board wires itself (the two Waveshare
// boards have one each: the TCA9554 / the CH422G), analogous to
// currentFixedBuses().
inline std::vector<DeviceDef> currentFixedDevices() {
  std::vector<DeviceDef> out;
#if defined(BREWCTL_BOARD_WAVESHARE_AMOLED175) || defined(BREWCTL_BOARD_WAVESHARE_LCD5B)
  DeviceDef d;
#if defined(BREWCTL_BOARD_WAVESHARE_LCD5B)
  d.type = findDeviceType("ch422g");
  d.address = 0x24;
  d.notes = kWaveshareLcd5bExpanderNotes;
  d.noteCount = sizeof(kWaveshareLcd5bExpanderNotes) / sizeof(ChannelNote);
#else
  d.type = findDeviceType("tca9554");
  d.address = 0x20;
  d.notes = kWaveshareAmoled175ExpanderNotes;
  d.noteCount = sizeof(kWaveshareAmoled175ExpanderNotes) / sizeof(ChannelNote);
#endif
  d.bus = "i2c-board";
  d.id = deviceIdFor(*d.type, d.bus, d.address);
  d.label = "Onboard-Expander";
  d.fixed = true;
  out.push_back(d);
#endif
  return out;
}

}  // namespace BrewControl
