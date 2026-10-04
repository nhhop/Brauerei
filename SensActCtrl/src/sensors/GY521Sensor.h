#pragma once

#include <stdint.h>

#include "core/Sensor.h"

// Forward decls to keep Adafruit_MPU6050/TwoWire out of the umbrella header.
class Adafruit_MPU6050;
class TwoWire;

namespace SensActCtrl {

// GY-521 breakout (MPU-6050 accelerometer + gyroscope), raw 6-axis readout
// plus the chip temperature.
//
// One instance exposes seven channels:
//   channel(0): AccelX  "g"    (key="ax")
//   channel(1): AccelY  "g"    (key="ay")
//   channel(2): AccelZ  "g"    (key="az")
//   channel(3): GyroX   "°/s"  (key="gx")
//   channel(4): GyroY   "°/s"  (key="gy")
//   channel(5): GyroZ   "°/s"  (key="gz")
//   channel(6): chip temperature "°C" (key="temp") -- the die, not the
//               surroundings; it reads a few degrees above room temperature.
//
// Without a device (wrong address, module unplugged) all channels stay
// invalid. A failed begin() is retried from tick() every kRetryIntervalMs, so a
// module plugged in later starts by itself; a module pulled while running is
// noticed by an address probe on every tick and goes invalid again.
//
// Building block for GY521TiltSensor, which derives a tilt angle from these
// raw axes and can pass them through; typically not registered on its own.
//
// Typical use:
//   GY521Sensor mpu("imu", 0x68);
//   registry.add(&mpu);
class GY521Sensor : public Sensor {
 public:
  explicit GY521Sensor(const char* id, uint8_t i2cAddress = 0x68);

  // Constructor for a bus the caller owns (e.g. BrewControl's shared board
  // I2C bus). The TwoWire instance must outlive this sensor.
  GY521Sensor(const char* id, TwoWire& bus, uint8_t i2cAddress = 0x68);

  ~GY521Sensor();

  const char* id()                const override { return id_; }
  size_t      channelCount()      const override { return 7; }
  Channel     channel(size_t idx) const override;

  void begin() override;
  void tick()  override;

 private:
  const char*       id_;
  uint8_t           address_;
  TwoWire*          bus_         = nullptr;
  Adafruit_MPU6050* dev_         = nullptr;
  bool              initialized_ = false;
  uint32_t          nextRetryMs_ = 0;

  static constexpr uint32_t kRetryIntervalMs = 5000;

  bool connect();
  bool devicePresent() const;
  void invalidate();

  Reading accelX_{};
  Reading accelY_{};
  Reading accelZ_{};
  Reading gyroX_{};
  Reading gyroY_{};
  Reading gyroZ_{};
  Reading temp_{};
};

}  // namespace SensActCtrl
