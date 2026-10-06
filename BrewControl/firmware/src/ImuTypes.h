#pragma once

#include <cstdint>
#include <cstring>

namespace BrewControl {

// The IMU item types: an ImuTiltSensor on one of SensActCtrl's 6-axis
// drivers. All sit on an I2C bus and share the channels (kGy521Channels) and
// the config keys ("address", "channels"); only the chip differs.
struct ImuType {
  const char* type;
  uint8_t     defaultAddress;
};
inline constexpr ImuType kImuTypes[] = {
    {"GY521", 0x68},    // MPU-6050
    {"QMI8658", 0x6B},  // e.g. onboard the Waveshare ESP32-S3-Touch-AMOLED-1.75
    {"BMI270", 0x68},   // e.g. onboard the M5Stack StopWatch
    {"BMI160", 0x68},
};

// nullptr if type is not an IMU type.
inline const ImuType* findImuType(const char* type) {
  for (const ImuType& t : kImuTypes)
    if (strcmp(t.type, type) == 0) return &t;
  return nullptr;
}

}  // namespace BrewControl
