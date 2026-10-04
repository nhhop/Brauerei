// SensActCtrl/test/test_gy521/test_gy521.cpp
#include <unity.h>

#include "sensors/GY521Sensor.h"

using SensActCtrl::Channel;
using SensActCtrl::GY521Sensor;
using SensActCtrl::Quantity;
using SensActCtrl::ValueKind;

// Hooks defined by the native stub in GY521Sensor.cpp.
namespace SensActCtrlTest {
extern bool     gy521Present;
extern uint32_t gy521NowMs;
}  // namespace SensActCtrlTest

void test_channel_count_and_keys() {
  GY521Sensor s("imu", 0x68);
  TEST_ASSERT_EQUAL(7u, s.channelCount());
  TEST_ASSERT_EQUAL_STRING("ax", s.channel(0).key);
  TEST_ASSERT_EQUAL_STRING("ay", s.channel(1).key);
  TEST_ASSERT_EQUAL_STRING("az", s.channel(2).key);
  TEST_ASSERT_EQUAL_STRING("gx", s.channel(3).key);
  TEST_ASSERT_EQUAL_STRING("gy", s.channel(4).key);
  TEST_ASSERT_EQUAL_STRING("gz", s.channel(5).key);
  TEST_ASSERT_EQUAL_STRING("temp", s.channel(6).key);
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

  Channel temp = s.channel(6);
  TEST_ASSERT_EQUAL(ValueKind::Continuous, temp.meta.kind);
  TEST_ASSERT_EQUAL(Quantity::Temperature, temp.meta.quantity);
  TEST_ASSERT_EQUAL_STRING("\xc2\xb0" "C",  temp.meta.unit);
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
  // Stub chip temperature.
  TEST_ASSERT_TRUE(s.channel(6).reading.valid);
  TEST_ASSERT_FLOAT_WITHIN(0.001f, 25.0f, s.channel(6).reading.value);
}

// ── Caller-owned bus (Peripherie-Abstraktion Etappe 2) ──────────────────────
// Same definition as the native shim in GY521Sensor.cpp, so the test can own
// a bus the way BrewControl's PeripheralRegistry does.
class TwoWire { public: TwoWire() {} };

void test_caller_bus_leaves_it_alone() {
  TwoWire* bus = new TwoWire();
  {
    GY521Sensor sensor("imu2", *bus, 0x69);
    sensor.begin();
    sensor.tick();
    TEST_ASSERT_EQUAL_STRING("imu2", sensor.id());
    TEST_ASSERT_EQUAL(7, sensor.channelCount());
  }
  delete bus;
}


// ── Device absent / hot-plug ────────────────────────────────────────────────

static bool anyValid(const GY521Sensor& s) {
  for (size_t i = 0; i < s.channelCount(); ++i)
    if (s.channel(i).reading.valid) return true;
  return false;
}

void test_no_device_readings_stay_invalid() {
  SensActCtrlTest::gy521Present = false;
  GY521Sensor s("imu", 0x68);
  s.begin();
  s.tick();
  TEST_ASSERT_FALSE(anyValid(s));
}

void test_device_plugged_in_later_starts_after_retry_interval() {
  SensActCtrlTest::gy521Present = false;
  GY521Sensor s("imu", 0x68);
  s.begin();
  s.tick();
  TEST_ASSERT_FALSE(anyValid(s));

  SensActCtrlTest::gy521Present = true;   // module plugged in
  SensActCtrlTest::gy521NowMs += 1000;    // before the retry interval
  s.tick();
  TEST_ASSERT_FALSE(anyValid(s));

  SensActCtrlTest::gy521NowMs += 5000;    // past the retry interval
  s.tick();
  TEST_ASSERT_TRUE(anyValid(s));
  TEST_ASSERT_FLOAT_WITHIN(0.001f, 1.0f, s.channel(2).reading.value);
}

void test_device_pulled_makes_readings_invalid() {
  GY521Sensor s("imu", 0x68);
  s.begin();
  s.tick();
  TEST_ASSERT_TRUE(anyValid(s));

  SensActCtrlTest::gy521Present = false;  // module pulled
  SensActCtrlTest::gy521NowMs += 100;
  s.tick();
  TEST_ASSERT_FALSE(anyValid(s));
}

void test_device_replugged_recovers() {
  GY521Sensor s("imu", 0x68);
  s.begin();
  s.tick();
  SensActCtrlTest::gy521Present = false;
  SensActCtrlTest::gy521NowMs += 100;
  s.tick();
  TEST_ASSERT_FALSE(anyValid(s));

  SensActCtrlTest::gy521Present = true;
  SensActCtrlTest::gy521NowMs += 10000;
  s.tick();
  TEST_ASSERT_TRUE(anyValid(s));
}

void test_retry_does_not_run_every_tick() {
  SensActCtrlTest::gy521Present = false;
  GY521Sensor s("imu", 0x68);
  s.begin();
  SensActCtrlTest::gy521Present = true;
  // Plugged in right after the failed begin(), but every tick is within the
  // retry interval: stays invalid until it elapses.
  for (int i = 0; i < 10; ++i) {
    SensActCtrlTest::gy521NowMs += 100;
    s.tick();
  }
  TEST_ASSERT_FALSE(anyValid(s));
}

void setUp() {
  SensActCtrlTest::gy521Present = true;
  SensActCtrlTest::gy521NowMs   = 0;
}
void tearDown() {}

int main(int, char**) {
  UNITY_BEGIN();
  RUN_TEST(test_channel_count_and_keys);
  RUN_TEST(test_channel_meta);
  RUN_TEST(test_readings_invalid_before_begin);
  RUN_TEST(test_tick_reports_stub_values_after_begin);
  RUN_TEST(test_caller_bus_leaves_it_alone);
  RUN_TEST(test_no_device_readings_stay_invalid);
  RUN_TEST(test_device_plugged_in_later_starts_after_retry_interval);
  RUN_TEST(test_device_pulled_makes_readings_invalid);
  RUN_TEST(test_device_replugged_recovers);
  RUN_TEST(test_retry_does_not_run_every_tick);
  return UNITY_END();
}
