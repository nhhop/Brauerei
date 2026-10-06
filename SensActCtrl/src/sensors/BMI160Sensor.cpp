#include "BMI160Sensor.h"

#if defined(ARDUINO)
  #include <Arduino.h>
  #include <Wire.h>
#endif

namespace SensActCtrl {

namespace {
// Registers and values from the BMI160 datasheet.
constexpr uint8_t kRegChipId   = 0x00;
constexpr uint8_t kRegData     = 0x0C;  // gyro x/y/z, then accel x/y/z
constexpr uint8_t kRegTemp     = 0x20;
constexpr uint8_t kRegAccRange = 0x41;
constexpr uint8_t kRegGyrRange = 0x43;
constexpr uint8_t kRegCmd      = 0x7E;

constexpr uint8_t kChipId        = 0xD1;
constexpr uint8_t kCmdSoftReset  = 0xB6;
constexpr uint8_t kCmdAccNormal  = 0x11;
constexpr uint8_t kCmdGyrNormal  = 0x15;
constexpr uint8_t kAccRange4g    = 0x05;
constexpr uint8_t kGyrRange500   = 0x02;

constexpr float kAccLsbPerG    = 32768.0f / 4.0f;
constexpr float kGyrLsbPerDps  = 32768.0f / 500.0f;
constexpr float kTempLsbPerK   = 512.0f;   // 0 = 23 °C
constexpr float kTempZeroC     = 23.0f;

int16_t le16(const uint8_t* p) {
  return static_cast<int16_t>(static_cast<uint16_t>(p[0]) |
                              (static_cast<uint16_t>(p[1]) << 8));
}
}  // namespace

BMI160Sensor::BMI160Sensor(const char* id, uint8_t i2cAddress)
    : ImuSensor(id, nullptr, i2cAddress) {}

BMI160Sensor::BMI160Sensor(const char* id, TwoWire& bus, uint8_t i2cAddress)
    : ImuSensor(id, &bus, i2cAddress) {}

void BMI160Sensor::decode(const uint8_t data[12], const uint8_t temp[2],
                          float accelG[3], float gyroDps[3], float& tempC) {
  for (int i = 0; i < 3; ++i) {
    gyroDps[i] = le16(data + 2 * i) / kGyrLsbPerDps;
    accelG[i]  = le16(data + 6 + 2 * i) / kAccLsbPerG;
  }
  tempC = kTempZeroC + le16(temp) / kTempLsbPerK;
}

#if defined(ARDUINO)
bool BMI160Sensor::writeReg(uint8_t reg, uint8_t value) {
  TwoWire& w = wire();
  w.beginTransmission(address());
  w.write(reg);
  w.write(value);
  return w.endTransmission() == 0;
}

bool BMI160Sensor::readRegs(uint8_t reg, uint8_t* buf, uint8_t len) {
  TwoWire& w = wire();
  w.beginTransmission(address());
  w.write(reg);
  if (w.endTransmission(false) != 0) return false;
  if (w.requestFrom(address(), len) != len) return false;
  for (uint8_t i = 0; i < len; ++i) buf[i] = static_cast<uint8_t>(w.read());
  return true;
}
#else
bool BMI160Sensor::writeReg(uint8_t, uint8_t) { return true; }
bool BMI160Sensor::readRegs(uint8_t, uint8_t*, uint8_t) { return true; }
#endif

bool BMI160Sensor::connectDevice() {
#if defined(ARDUINO)
  uint8_t id = 0;
  if (!readRegs(kRegChipId, &id, 1) || id != kChipId) return false;
  if (!writeReg(kRegCmd, kCmdSoftReset)) return false;
  delay(10);
  // Both sensors start suspended; the gyro needs up to 80 ms to come up.
  if (!writeReg(kRegCmd, kCmdAccNormal)) return false;
  delay(5);
  if (!writeReg(kRegCmd, kCmdGyrNormal)) return false;
  delay(80);
  return writeReg(kRegAccRange, kAccRange4g) && writeReg(kRegGyrRange, kGyrRange500);
#else
  return stubConnect();
#endif
}

bool BMI160Sensor::readDevice(float accelG[3], float gyroDps[3], float& tempC) {
#if defined(ARDUINO)
  uint8_t data[12], temp[2];
  if (!readRegs(kRegData, data, sizeof(data))) return false;
  if (!readRegs(kRegTemp, temp, sizeof(temp))) return false;
  decode(data, temp, accelG, gyroDps, tempC);
  return true;
#else
  return stubRead(accelG, gyroDps, tempC);
#endif
}

}  // namespace SensActCtrl
