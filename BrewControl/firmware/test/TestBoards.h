#pragma once

#include "BoardPins.h"

namespace BrewControl {

// Test fixtures: the pin tables of esp32dev and lolin_s2_mini, which BrewControl no
// longer builds for (Arduino core 3, S3 only). Kept because they exercise the
// generic checks in PinMap/BusConfig for DAC pins, input-only pins, ADC2 under
// Wi-Fi and the ESP32 errata (3.11: GPIO 36/39 glitch while the SAR ADC is
// powered) - capabilities no S3 table has.

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

}  // namespace BrewControl
