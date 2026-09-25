#pragma once

#include "PinMap.h"

namespace BrewControl {

// Pin tables for the three boards BrewControl builds for (see platformio.ini).
// Chip facts from the Espressif datasheets; board wiring from the build flags,
// main.cpp and display/DisplayUI.cpp — keep them in sync when those change.
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
};

#if defined(BREWCTL_I2C_SDA) && defined(BREWCTL_HAS_DISPLAY)
static_assert(BREWCTL_I2C_SDA == 7 && BREWCTL_I2C_SCL == 6,
              "update kLilyGoAmoledSpecial to the new I2C pins");
#endif
#if defined(BREWCTL_SD_CS) && defined(BREWCTL_HAS_DISPLAY)
static_assert(BREWCTL_SD_CS == 38 && BREWCTL_SD_MOSI == 39 &&
                  BREWCTL_SD_MISO == 40 && BREWCTL_SD_SCK == 41,
              "update kLilyGoAmoledSpecial to the new SD pins");
#endif

// The table of the board this firmware is built for.
inline const Board& currentBoard() {
#if defined(CONFIG_IDF_TARGET_ESP32S3)
  return kLilyGoAmoled;
#elif defined(CONFIG_IDF_TARGET_ESP32S2)
  return kLolinS2Mini;
#else
  return kEsp32Dev;
#endif
}

}  // namespace BrewControl
