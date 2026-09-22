// SensActCtrl/test/test_gy521/test_gy521.cpp
#include <unity.h>

#include "sensors/GY521Sensor.h"

using SensActCtrl::Channel;
using SensActCtrl::GY521Sensor;
using SensActCtrl::Quantity;
using SensActCtrl::ValueKind;

void test_channel_count_and_keys() {
  GY521Sensor s("imu", 0x68);
  TEST_ASSERT_EQUAL(6u, s.channelCount());
  TEST_ASSERT_EQUAL_STRING("ax", s.channel(0).key);
  TEST_ASSERT_EQUAL_STRING("ay", s.channel(1).key);
  TEST_ASSERT_EQUAL_STRING("az", s.channel(2).key);
  TEST_ASSERT_EQUAL_STRING("gx", s.channel(3).key);
  TEST_ASSERT_EQUAL_STRING("gy", s.channel(4).key);
  TEST_ASSERT_EQUAL_STRING("gz", s.channel(5).key);
}

void test_channel_meta() {
  GY521Sensor s("imu", 0x68);
  Channel accel = s.channel(0);
  TEST_ASSERT_EQUAL(ValueKind::Continuous, accel.meta.kind);
  TEST_ASSERT_EQUAL(Quantity::Custom,      accel.meta.quantity);
  TEST_ASSERT_EQUAL_STRING("g",            accel.meta.unit);

  Channel gyro = s.channel(3);
  TEST_ASSERT_EQUAL(ValueKind::Continuous, gyro.meta.kind);
  TEST_ASSERT_EQUAL(Quantity::Custom,      gyro.meta.quantity);
}

void test_readings_invalid_before_begin() {
  GY521Sensor s("imu", 0x68);
  s.tick();  // no begin() -> no-op
  TEST_ASSERT_FALSE(s.channel(0).reading.valid);
}

void test_tick_reports_stub_values_after_begin() {
  GY521Sensor s("imu", 0x68);
  s.begin();
  s.tick();
  // Native stub reports the device lying flat: az = 1 g, everything else 0.
  TEST_ASSERT_TRUE(s.channel(2).reading.valid);
  TEST_ASSERT_FLOAT_WITHIN(0.001f, 0.0f, s.channel(0).reading.value);
  TEST_ASSERT_FLOAT_WITHIN(0.001f, 0.0f, s.channel(1).reading.value);
  TEST_ASSERT_FLOAT_WITHIN(0.001f, 1.0f, s.channel(2).reading.value);
  TEST_ASSERT_FLOAT_WITHIN(0.001f, 0.0f, s.channel(3).reading.value);
  TEST_ASSERT_FLOAT_WITHIN(0.001f, 0.0f, s.channel(4).reading.value);
  TEST_ASSERT_FLOAT_WITHIN(0.001f, 0.0f, s.channel(5).reading.value);
}

void setUp() {}
void tearDown() {}

int main(int, char**) {
  UNITY_BEGIN();
  RUN_TEST(test_channel_count_and_keys);
  RUN_TEST(test_channel_meta);
  RUN_TEST(test_readings_invalid_before_begin);
  RUN_TEST(test_tick_reports_stub_values_after_begin);
  return UNITY_END();
}
