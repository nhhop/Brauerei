// SensActCtrl/test/test_imu_drivers/test_imu_drivers.cpp
//
// QMI8658Sensor, BMI270Sensor and BMI160Sensor share ImuSensor's channel
// layout, retry and hot-plug logic (covered in depth by test_gy521); these
// tests check each driver is wired onto it, plus the BMI160's own register
// decoding and an ImuTiltSensor on a raw sensor other than the GY-521.
#include <unity.h>

#include <math.h>

#include <memory>

#include "sensors/BMI160Sensor.h"
#include "sensors/BMI270Sensor.h"
#include "sensors/ImuTiltSensor.h"
#include "sensors/QMI8658Sensor.h"

using SensActCtrl::BMI160Sensor;
using SensActCtrl::BMI270Sensor;
using SensActCtrl::ImuSensor;
using SensActCtrl::ImuTiltSensor;
using SensActCtrl::QMI8658Sensor;

// Hooks defined by the native stub in ImuSensor.cpp.
namespace SensActCtrlTest {
extern bool     imuPresent;
extern uint32_t imuNowMs;
extern float    imuAccelG[3];
extern float    imuGyroDps[3];
}  // namespace SensActCtrlTest

using namespace SensActCtrlTest;

namespace {
bool anyValid(const ImuSensor& s) {
  for (size_t i = 0; i < s.channelCount(); ++i)
    if (s.channel(i).reading.valid) return true;
  return false;
}

// Begin, read, pull the module, plug it back in.
void checkDriver(ImuSensor& s) {
  TEST_ASSERT_EQUAL(7u, s.channelCount());
  const char* keys[] = {"ax", "ay", "az", "gx", "gy", "gz", "temp"};
  for (size_t i = 0; i < 7; ++i) TEST_ASSERT_EQUAL_STRING(keys[i], s.channel(i).key);

  s.tick();  // before begin(): nothing
  TEST_ASSERT_FALSE(anyValid(s));

  s.begin();
  s.tick();
  TEST_ASSERT_TRUE(s.channel(2).reading.valid);
  TEST_ASSERT_FLOAT_WITHIN(0.001f, 1.0f, s.channel(2).reading.value);
  TEST_ASSERT_FLOAT_WITHIN(0.001f, 25.0f, s.channel(6).reading.value);

  imuPresent = false;
  imuNowMs += 100;
  s.tick();
  TEST_ASSERT_FALSE(anyValid(s));

  imuPresent = true;
  imuNowMs += 10000;
  s.tick();
  TEST_ASSERT_TRUE(anyValid(s));
}
}  // namespace

void test_qmi8658_driver() {
  QMI8658Sensor s("imu");
  checkDriver(s);
}

void test_bmi270_driver() {
  BMI270Sensor s("imu");
  checkDriver(s);
}

void test_bmi160_driver() {
  BMI160Sensor s("imu");
  checkDriver(s);
}

// Same definition as the native shim in the drivers, so the test can own a
// bus the way BrewControl's PeripheralRegistry does.
class TwoWire { public: TwoWire() {} };

void test_caller_owned_bus() {
  TwoWire bus;
  QMI8658Sensor q("q", bus, 0x6A);
  BMI270Sensor  b("b", bus, 0x69);
  BMI160Sensor  c("c", bus, 0x69);
  q.begin(); b.begin(); c.begin();
  q.tick();  b.tick();  c.tick();
  TEST_ASSERT_TRUE(anyValid(q));
  TEST_ASSERT_TRUE(anyValid(b));
  TEST_ASSERT_TRUE(anyValid(c));
}

// ── BMI160 register decoding ────────────────────────────────────────────────

void test_bmi160_decode_scales_and_byte_order() {
  // gyro x/y/z then accel x/y/z, little-endian int16.
  // ±500 °/s: 32768 LSB = 500 °/s; ±4 g: 8192 LSB = 1 g.
  const uint8_t data[12] = {
      0x00, 0x40,   // gx = 16384 -> 250 °/s
      0x00, 0xC0,   // gy = -16384 -> -250 °/s
      0x00, 0x00,   // gz = 0
      0x00, 0x20,   // ax = 8192 -> 1 g
      0x00, 0xF0,   // ay = -4096 -> -0.5 g
      0x00, 0x10};  // az = 4096 -> 0.5 g
  const uint8_t temp[2] = {0x00, 0x04};  // 1024 / 512 K = +2 K -> 25 °C
  float a[3], g[3], t;
  BMI160Sensor::decode(data, temp, a, g, t);
  TEST_ASSERT_FLOAT_WITHIN(0.01f, 250.0f, g[0]);
  TEST_ASSERT_FLOAT_WITHIN(0.01f, -250.0f, g[1]);
  TEST_ASSERT_FLOAT_WITHIN(0.01f, 0.0f, g[2]);
  TEST_ASSERT_FLOAT_WITHIN(0.0001f, 1.0f, a[0]);
  TEST_ASSERT_FLOAT_WITHIN(0.0001f, -0.5f, a[1]);
  TEST_ASSERT_FLOAT_WITHIN(0.0001f, 0.5f, a[2]);
  TEST_ASSERT_FLOAT_WITHIN(0.001f, 25.0f, t);
}

void test_bmi160_decode_temperature_below_zero_point() {
  const uint8_t data[12] = {};
  const uint8_t temp[2] = {0x00, 0xFE};  // -512 -> -1 K -> 22 °C
  float a[3], g[3], t;
  BMI160Sensor::decode(data, temp, a, g, t);
  TEST_ASSERT_FLOAT_WITHIN(0.001f, 22.0f, t);
}

// ── ImuTiltSensor on a non-GY521 raw sensor ─────────────────────────────────

void test_tilt_on_bmi160() {
  constexpr float kDegToRad = 0.017453292519943295f;
  imuAccelG[0] = -sinf(30 * kDegToRad);
  imuAccelG[2] = cosf(30 * kDegToRad);
  ImuTiltSensor s("hydrometer", std::make_unique<BMI160Sensor>("hydrometer", 0x69));
  s.setChannelMask(ImuTiltSensor::kChannelPitch | ImuTiltSensor::kChannelTilt |
                   ImuTiltSensor::kChannelTemp);
  s.begin();
  s.tick();
  TEST_ASSERT_EQUAL_STRING("hydrometer", s.id());
  TEST_ASSERT_FLOAT_WITHIN(0.05f, 30.0f, s.channel(0).reading.value);  // pitch
  TEST_ASSERT_FLOAT_WITHIN(0.05f, 30.0f, s.channel(1).reading.value);  // tilt
  TEST_ASSERT_EQUAL_STRING("temp", s.channel(2).key);
  TEST_ASSERT_FLOAT_WITHIN(0.001f, 25.0f, s.channel(2).reading.value);
}

void setUp() {
  imuPresent = true;
  imuNowMs   = 0;
  imuAccelG[0] = 0.0f; imuAccelG[1] = 0.0f; imuAccelG[2] = 1.0f;
  imuGyroDps[0] = imuGyroDps[1] = imuGyroDps[2] = 0.0f;
}
void tearDown() {}

int main(int, char**) {
  UNITY_BEGIN();
  RUN_TEST(test_qmi8658_driver);
  RUN_TEST(test_bmi270_driver);
  RUN_TEST(test_bmi160_driver);
  RUN_TEST(test_caller_owned_bus);
  RUN_TEST(test_bmi160_decode_scales_and_byte_order);
  RUN_TEST(test_bmi160_decode_temperature_below_zero_point);
  RUN_TEST(test_tilt_on_bmi160);
  return UNITY_END();
}
