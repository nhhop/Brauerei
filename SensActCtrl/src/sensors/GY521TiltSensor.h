#pragma once

#include <stdint.h>

#include <memory>

#include "GY521Sensor.h"
#include "ImuTiltSensor.h"

namespace SensActCtrl {

// ImuTiltSensor on a GY-521 (MPU-6050) -- shorthand that creates the raw
// GY521Sensor itself. Channels, mask and filter as in ImuTiltSensor.
//
// Typical use:
//   GY521TiltSensor tilt("hydrometer", 0x68);
//   registry.add(&tilt);
class GY521TiltSensor : public ImuTiltSensor {
 public:
  explicit GY521TiltSensor(const char* id, uint8_t i2cAddress = 0x68)
      : ImuTiltSensor(id, std::make_unique<GY521Sensor>(id, i2cAddress)) {}

  // Constructor for a bus the caller owns (e.g. BrewControl's shared board
  // I2C bus). The TwoWire instance must outlive this sensor.
  GY521TiltSensor(const char* id, TwoWire& bus, uint8_t i2cAddress = 0x68)
      : ImuTiltSensor(id, std::make_unique<GY521Sensor>(id, bus, i2cAddress)) {}
};

}  // namespace SensActCtrl
