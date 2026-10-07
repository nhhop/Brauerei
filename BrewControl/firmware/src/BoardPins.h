#pragma once

#include "BusConfig.h"
#include "PinMap.h"

namespace BrewControl {

// Pin tables for the boards BrewControl builds for (see platformio.ini).
// Chip facts from the Espressif datasheets (ADC channels, pull-ups) and the
// ESP32 errata (3.11: GPIO 36/39 glitch while the SAR ADC is powered); board
// wiring from the build flags, main.cpp and display/DisplayUI.cpp — keep them
// in sync when those change.
// GPIO 0 is the BOOT button everywhere, which main.cpp reads for the factory
// reset (kBootButtonPin), so it counts as reserved, not merely as strapping.

// ── esp32dev (ESP32-WROOM-32) ────────────────────────────────────────────────
inline constexpr PinDef kEsp32DevSpecial[] = {
    {0, PinClass::Reserved, "BOOT-Taste"},
    {1, PinClass::Risky, "UART0 TX (serielles Log)"},
    {2, PinClass::Risky, "Strapping-Pin"},
    {3, PinClass::Risky, "UART0 RX (serielles Log)"},
    {5, PinClass::Risky, "Strapping-Pin"},
    {6, PinClass::Forbidden, "Flash"},
    {7, PinClass::Forbidden, "Flash"},
    {8, PinClass::Forbidden, "Flash"},
    {9, PinClass::Forbidden, "Flash"},
    {10, PinClass::Forbidden, "Flash"},
    {11, PinClass::Forbidden, "Flash"},
    {12, PinClass::Risky, "Strapping-Pin (Flash-Spannung)"},
    {15, PinClass::Risky, "Strapping-Pin"},
};
inline constexpr Board kEsp32Dev = {
    pinRange(0, 19) | pinRange(21, 23) | pinRange(25, 27) | pinRange(32, 39),
    pinRange(34, 39),
    pinBit(25) | pinBit(26),
    kEsp32DevSpecial, sizeof(kEsp32DevSpecial) / sizeof(PinDef),
    8,
    pinRange(32, 39),
    pinBit(0) | pinBit(2) | pinBit(4) | pinRange(12, 15) | pinRange(25, 27),
    pinRange(34, 39),
    pinBit(36) | pinBit(39),
    pinBit(0) | pinBit(2) | pinBit(4) | pinRange(12, 15) | pinRange(25, 27) | pinRange(32, 39),
    true,  // ADC2 reads fail while Wi-Fi is on
    21, 22,  // Arduino-ESP32 default Wire pins (variants/esp32/pins_arduino.h)
};

// ── lolin_s2_mini (ESP32-S2FN4R2) ────────────────────────────────────────────
inline constexpr PinDef kLolinS2MiniSpecial[] = {
    {0, PinClass::Reserved, "BOOT-Taste"},
    {15, PinClass::Risky, "Onboard-LED"},
    {19, PinClass::Risky, "USB D- (Seriell + Upload)"},
    {20, PinClass::Risky, "USB D+ (Seriell + Upload)"},
    {26, PinClass::Forbidden, "PSRAM"},
    {27, PinClass::Forbidden, "Flash"},
    {28, PinClass::Forbidden, "Flash"},
    {29, PinClass::Forbidden, "Flash"},
    {30, PinClass::Forbidden, "Flash"},
    {31, PinClass::Forbidden, "Flash"},
    {32, PinClass::Forbidden, "Flash"},
    {43, PinClass::Risky, "UART0 TX"},
    {44, PinClass::Risky, "UART0 RX"},
    {45, PinClass::Risky, "Strapping-Pin (Flash-Spannung)"},
    {46, PinClass::Risky, "Strapping-Pin"},
};
inline constexpr Board kLolinS2Mini = {
    pinRange(0, 21) | pinRange(26, 46),
    pinBit(46),
    pinBit(17) | pinBit(18),
    kLolinS2MiniSpecial, sizeof(kLolinS2MiniSpecial) / sizeof(PinDef),
    4,
    pinRange(1, 10),
    pinRange(11, 20),
    pinBit(46),  // fixed pull-down
    0,
    pinRange(0, 21),
    false,  // ADC2 arbitrated with Wi-Fi
    33, 35,  // Arduino-ESP32 default Wire pins (variants/lolin_s2_mini/pins_arduino.h)
};

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
};
// Onboard devices sharing this board's I2C bus (BrewControl/CLAUDE.md).
inline constexpr AddrDef kLilyGoAmoledI2cReserved[] = {
    {0x51, "RTC (PCF8563)"},
    {0x5A, "Touch (CST9217)"},
    {0x6A, "PMU (SY6970)"},
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
    // No battery divider: the AXP2101 measures the cell (PLAN.md).
};
// Onboard devices sharing this board's I2C bus. Not the QMI8658 (0x6B): the
// IMU is meant to be added as a sensor item on this bus.
inline constexpr AddrDef kWaveshareAmoled175I2cReserved[] = {
    {0x18, "Audio-Codec (ES8311)"},
    {0x20, "Port-Expander (TCA9554)"},
    {0x34, "PMU (AXP2101)"},
    {0x40, "Mikrofon-ADC (ES7210)"},
    {0x51, "RTC (PCF85063)"},
    {0x5A, "Touch (CST9217)"},
};
inline constexpr FixedBus kWaveshareAmoled175Buses[] = {
    {"i2c-board", "i2c", {15, 14, -1},
     "Fest verdrahtet mit Touch, IMU, RTC, PMU und Audio",
     kWaveshareAmoled175I2cReserved, sizeof(kWaveshareAmoled175I2cReserved) / sizeof(AddrDef)},
};

#if defined(BREWCTL_BOARD_WAVESHARE_AMOLED175)
static_assert(BREWCTL_I2C_SDA == 15 && BREWCTL_I2C_SCL == 14,
              "update kWaveshareAmoled175Special and kWaveshareAmoled175Buses to the new I2C pins");
static_assert(BREWCTL_SD_MMC_CLK == 2 && BREWCTL_SD_MMC_CMD == 1 && BREWCTL_SD_MMC_D0 == 3,
              "update kWaveshareAmoled175Special to the new SD pins");
#endif

#if defined(CONFIG_IDF_TARGET_ESP32S3) && !defined(BREWCTL_BOARD_LILYGO_AMOLED) &&     !defined(BREWCTL_BOARD_WAVESHARE_AMOLED175)
#error "ESP32-S3 build without a BREWCTL_BOARD_* flag: the S3 boards differ in every pin"
#endif

// The table of the board this firmware is built for.
inline const Board& currentBoard() {
#if defined(BREWCTL_BOARD_WAVESHARE_AMOLED175)
  return kWaveshareAmoled175;
#elif defined(BREWCTL_BOARD_LILYGO_AMOLED)
  return kLilyGoAmoled;
#elif defined(CONFIG_IDF_TARGET_ESP32S2)
  return kLolinS2Mini;
#else
  return kEsp32Dev;
#endif
}

// The buses the current board wires itself (none on esp32dev/lolin_s2_mini:
// there every bus is user-defined), analogous to currentBoard().
inline std::vector<BusDef> currentFixedBuses() {
  std::vector<BusDef> out;
#if defined(BREWCTL_BOARD_WAVESHARE_AMOLED175)
  for (const FixedBus& f : kWaveshareAmoled175Buses) out.push_back(busFromFixed(f));
#elif defined(BREWCTL_BOARD_LILYGO_AMOLED)
  for (const FixedBus& f : kLilyGoAmoledBuses) out.push_back(busFromFixed(f));
#endif
  return out;
}

}  // namespace BrewControl
