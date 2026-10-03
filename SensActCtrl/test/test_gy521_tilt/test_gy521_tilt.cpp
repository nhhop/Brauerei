// SensActCtrl/test/test_gy521_tilt/test_gy521_tilt.cpp
#include <unity.h>

#include "sensors/GY521TiltSensor.h"

using SensActCtrl::GY521TiltSensor;
using SensActCtrl::Quantity;
using SensActCtrl::ValueKind;

// Hooks defined by the native stub in GY521Sensor.cpp.
namespace SensActCtrlTest {
extern bool     gy521Present;
extern uint32_t gy521NowMs;
}  // namespace SensActCtrlTest

// ── complementaryStep() numerics (no hardware needed) ───────────────────────

void test_complementary_step_pure_accel_when_alpha_zero() {
  const float angle = GY521TiltSensor::complementaryStep(
      /*prevAngle=*/0.0f, /*angleAccelDeg=*/12.0f, /*gyroRateDegPerS=*/99.0f,
      /*dtSeconds=*/1.0f, /*alpha=*/0.0f);
  TEST_ASSERT_FLOAT_WITHIN(0.0001f, 12.0f, angle);
}

void test_complementary_step_pure_gyro_when_alpha_one() {
  const float angle = GY521TiltSensor::complementaryStep(
      /*prevAngle=*/10.0f, /*angleAccelDeg=*/-40.0f, /*gyroRateDegPerS=*/5.0f,
      /*dtSeconds=*/2.0f, /*alpha=*/1.0f);
  // prevAngle + gyroRate * dt = 10 + 5*2 = 20, accel term ignored.
  TEST_ASSERT_FLOAT_WITHIN(0.0001f, 20.0f, angle);
}

void test_complementary_step_blends_both_terms() {
  const float angle = GY521TiltSensor::complementaryStep(
      /*prevAngle=*/10.0f, /*angleAccelDeg=*/10.0f, /*gyroRateDegPerS=*/5.0f,
      /*dtSeconds=*/1.0f, /*alpha=*/0.98f);
  // gyroAngle = 10 + 5*1 = 15; 0.98*15 + 0.02*10 = 14.9
  TEST_ASSERT_FLOAT_WITHIN(0.0001f, 14.9f, angle);
}

void test_complementary_step_zero_dt_ignores_gyro_rate() {
  const float angle = GY521TiltSensor::complementaryStep(
      /*prevAngle=*/3.0f, /*angleAccelDeg=*/7.0f, /*gyroRateDegPerS=*/500.0f,
      /*dtSeconds=*/0.0f, /*alpha=*/0.98f);
  // gyroAngle = prevAngle (rate*dt = 0); 0.98*3 + 0.02*7 = 3.08
  TEST_ASSERT_FLOAT_WITHIN(0.0001f, 3.08f, angle);
}

// ── Channel shape ────────────────────────────────────────────────────────────

void test_channel_count_and_key() {
  GY521TiltSensor s("hydrometer", 0x68);
  TEST_ASSERT_EQUAL(1u, s.channelCount());
  TEST_ASSERT_EQUAL_STRING("", s.channel(0).key);
  TEST_ASSERT_EQUAL(ValueKind::Continuous, s.channel(0).meta.kind);
  TEST_ASSERT_EQUAL(Quantity::Custom,      s.channel(0).meta.quantity);
}

void test_readings_invalid_before_begin() {
  GY521TiltSensor s("hydrometer", 0x68);
  s.tick();  // no begin() -> inner GY521Sensor stays uninitialised
  TEST_ASSERT_FALSE(s.channel(0).reading.valid);
}

// ── tick() end-to-end against the native GY521Sensor stub ──────────────────

void test_tick_reports_zero_angle_when_flat() {
  GY521TiltSensor s("hydrometer", 0x68);
  s.begin();
  s.tick();
  // Native stub: az=1g, ax=ay=gyro=0 -> device lying flat -> angle ~ 0°.
  TEST_ASSERT_TRUE(s.channel(0).reading.valid);
  TEST_ASSERT_FLOAT_WITHIN(0.01f, 0.0f, s.channel(0).reading.value);
}

// ── Caller-owned bus (Peripherie-Abstraktion Etappe 2) ──────────────────────
// Same definition as the native shim in GY521Sensor.cpp, so the test can own
// a bus the way BrewControl's PeripheralRegistry does.
class TwoWire { public: TwoWire() {} };

void test_caller_bus_delegates_to_raw_sensor() {
  TwoWire bus;
  GY521TiltSensor tilt("hydrometer2", bus, 0x69);
  tilt.begin();
  tilt.tick();
  TEST_ASSERT_EQUAL_STRING("hydrometer2", tilt.id());
  TEST_ASSERT_TRUE(tilt.channel(0).reading.valid);
}


// ── Device absent / hot-plug ────────────────────────────────────────────────

void test_no_device_angle_invalid() {
  SensActCtrlTest::gy521Present = false;
  GY521TiltSensor s("hydrometer", 0x68);
  s.begin();
  s.tick();
  TEST_ASSERT_FALSE(s.channel(0).reading.valid);
}

void test_device_pulled_angle_invalid_then_recovers() {
  GY521TiltSensor s("hydrometer", 0x68);
  s.begin();
  s.tick();
  TEST_ASSERT_TRUE(s.channel(0).reading.valid);

  SensActCtrlTest::gy521Present = false;
  SensActCtrlTest::gy521NowMs += 100;
  s.tick();
  TEST_ASSERT_FALSE(s.channel(0).reading.valid);

  SensActCtrlTest::gy521Present = true;
  SensActCtrlTest::gy521NowMs += 10000;
  s.tick();
  TEST_ASSERT_TRUE(s.channel(0).reading.valid);
  TEST_ASSERT_FLOAT_WITHIN(0.01f, 0.0f, s.channel(0).reading.value);
}

void setUp() {
  SensActCtrlTest::gy521Present = true;
  SensActCtrlTest::gy521NowMs   = 0;
}
void tearDown() {}

int main(int, char**) {
  UNITY_BEGIN();
  RUN_TEST(test_complementary_step_pure_accel_when_alpha_zero);
  RUN_TEST(test_complementary_step_pure_gyro_when_alpha_one);
  RUN_TEST(test_complementary_step_blends_both_terms);
  RUN_TEST(test_complementary_step_zero_dt_ignores_gyro_rate);
  RUN_TEST(test_channel_count_and_key);
  RUN_TEST(test_readings_invalid_before_begin);
  RUN_TEST(test_tick_reports_zero_angle_when_flat);
  RUN_TEST(test_caller_bus_delegates_to_raw_sensor);
  RUN_TEST(test_no_device_angle_invalid);
  RUN_TEST(test_device_pulled_angle_invalid_then_recovers);
  return UNITY_END();
}
