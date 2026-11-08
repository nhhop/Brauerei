#pragma once

#include <cstdint>
#include <cstring>

namespace BrewControl {

// The PMU item types: one of SensActCtrl's PmuSensor drivers for the charger
// IC a battery board carries on its I2C bus. Same channels (vbat, vbus,
// charging + one chip-specific) and config keys ("address"); only the chip
// differs. Built only on boards with a fixed I2C bus (DynamicItems.cpp).
struct PmuType {
  const char* type;
  uint8_t     defaultAddress;
};
inline constexpr PmuType kPmuTypes[] = {
    {"SY6970", 0x6A},   // onboard the LilyGo T-Display-S3-AMOLED
    {"AXP2101", 0x34},  // onboard the Waveshare ESP32-S3-Touch-AMOLED-1.75
};

// nullptr if type is not a PMU type.
inline const PmuType* findPmuType(const char* type) {
  for (const PmuType& t : kPmuTypes)
    if (strcmp(t.type, type) == 0) return &t;
  return nullptr;
}

}  // namespace BrewControl
