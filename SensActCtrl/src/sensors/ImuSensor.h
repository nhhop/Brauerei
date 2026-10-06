#pragma once

#include <stdint.h>

#include "core/Sensor.h"

// Forward decl to keep TwoWire out of the umbrella header.
class TwoWire;

namespace SensActCtrl {

// Common base of the 6-axis IMU drivers (GY521Sensor, QMI8658Sensor,
// BMI270Sensor, BMI160Sensor): raw accelerometer + gyroscope readout plus the
// chip temperature, the same seven channels whatever the chip:
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
// invalid. A failed connect is retried from tick() every kRetryIntervalMs, so a
// module plugged in later starts by itself; a module pulled while running is
// noticed by an address probe on every tick and goes invalid again (vendor
// drivers don't reliably report I2C errors on a read).
//
// A driver only implements connectDevice() and readDevice(). ImuTiltSensor
// derives tilt angles from any of them.
class ImuSensor : public Sensor {
 public:
  const char* id()                const override { return id_; }
  size_t      channelCount()      const override { return 7; }
  Channel     channel(size_t idx) const override;

  void begin() override;
  void tick()  override;

 protected:
  // bus == nullptr: the default Wire. A caller-owned bus must outlive this
  // sensor.
  ImuSensor(const char* id, TwoWire* bus, uint8_t i2cAddress)
      : id_(id), address_(i2cAddress), bus_(bus) {}

  // Brings the chip up (identify, configure). Called from begin() and then
  // every kRetryIntervalMs until it succeeds.
  virtual bool connectDevice() = 0;
  // One sample: accel in g, gyro in °/s, die temperature in °C. false = the
  // read failed (all channels go invalid until the next good one).
  virtual bool readDevice(float accelG[3], float gyroDps[3], float& tempC) = 0;

  uint8_t  address() const { return address_; }
#if defined(ARDUINO)
  TwoWire& wire() const;  // the caller's bus or the default Wire
#else
  // Native builds have no chip: drivers forward to these, which play back
  // the SensActCtrlTest::imu* hooks defined in ImuSensor.cpp.
  static bool stubConnect();
  static bool stubRead(float accelG[3], float gyroDps[3], float& tempC);
#endif

 private:
  static constexpr uint32_t kRetryIntervalMs = 5000;

  bool connect();
  bool devicePresent() const;
  void invalidate();

  const char* id_;
  uint8_t     address_;
  TwoWire*    bus_;
  bool        begun_       = false;
  bool        initialized_ = false;
  uint32_t    nextRetryMs_ = 0;

  Reading accel_[3]{};
  Reading gyro_[3]{};
  Reading temp_{};
};

}  // namespace SensActCtrl
