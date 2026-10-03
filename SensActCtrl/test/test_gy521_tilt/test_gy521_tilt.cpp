// SensActCtrl/test/test_gy521_tilt/test_gy521_tilt.cpp
#include <unity.h>

#include <math.h>

#include "sensors/GY521TiltSensor.h"

using SensActCtrl::GY521TiltSensor;
using SensActCtrl::Quantity;
using SensActCtrl::ValueKind;

// Hooks defined by the native stub in GY521Sensor.cpp.
namespace SensActCtrlTest {
extern bool     gy521Present;
extern uint32_t gy521NowMs;
extern float    gy521AccelG[3];
extern float    gy521GyroDps[3];
}  // namespace SensActCtrlTest

using namespace SensActCtrlTest;

namespace {
constexpr float kDegToRad = 0.017453292519943295f;

void setAccel(float x, float y, float z) {
  gy521AccelG[0] = x; gy521AccelG[1] = y; gy521AccelG[2] = z;
}
void setGyro(float x, float y, float z) {
  gy521GyroDps[0] = x; gy521GyroDps[1] = y; gy521GyroDps[2] = z;
}
// n ticks, 10 ms apart.
void run(GY521TiltSensor& s, int n) {
  for (int i = 0; i < n; ++i) { gy521NowMs += 10; s.tick(); }
}
}  // namespace

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

void test_default_is_pitch_only() {
  GY521TiltSensor s("hydrometer", 0x68);
  TEST_ASSERT_EQUAL(1u, s.channelCount());
  TEST_ASSERT_EQUAL_STRING("pitch", s.channel(0).key);
  TEST_ASSERT_EQUAL(ValueKind::Continuous, s.channel(0).meta.kind);
  TEST_ASSERT_EQUAL(Quantity::Custom,      s.channel(0).meta.quantity);
}

void test_full_mask_exposes_all_channels_in_order() {
  GY521TiltSensor s("imu", 0x68);
  s.setChannelMask(0x3FF);
  TEST_ASSERT_EQUAL(10u, s.channelCount());
  const char* keys[] = {"pitch", "roll", "tilt", "temp", "ax", "ay", "az", "gx", "gy", "gz"};
  for (size_t i = 0; i < 10; ++i) TEST_ASSERT_EQUAL_STRING(keys[i], s.channel(i).key);
  TEST_ASSERT_EQUAL(Quantity::Temperature, s.channel(3).meta.quantity);
}

void test_partial_mask_maps_to_selected_channels() {
  GY521TiltSensor s("imu", 0x68);
  s.setChannelMask(GY521TiltSensor::kChannelTilt | GY521TiltSensor::kChannelAz);
  TEST_ASSERT_EQUAL(2u, s.channelCount());
  TEST_ASSERT_EQUAL_STRING("tilt", s.channel(0).key);
  TEST_ASSERT_EQUAL_STRING("az", s.channel(1).key);

  s.begin();
  s.tick();
  // Stub default: lying flat (az = 1 g).
  TEST_ASSERT_TRUE(s.channel(0).reading.valid);
  TEST_ASSERT_FLOAT_WITHIN(0.01f, 0.0f, s.channel(0).reading.value);
  TEST_ASSERT_FLOAT_WITHIN(0.001f, 1.0f, s.channel(1).reading.value);
}

void test_empty_mask_is_ignored() {
  GY521TiltSensor s("imu", 0x68);
  s.setChannelMask(GY521TiltSensor::kChannelPitch | GY521TiltSensor::kChannelGz);
  s.setChannelMask(0);
  TEST_ASSERT_EQUAL(2u, s.channelCount());
  TEST_ASSERT_EQUAL_STRING("gz", s.channel(1).key);
}

void test_angles_run_without_their_channels_exposed() {
  // The filters keep running while the angles are hidden, so turning them
  // back on needs no warm-up.
  GY521TiltSensor s("imu", 0x68);
  s.setChannelMask(GY521TiltSensor::kChannelAx);
  s.begin();
  s.tick();
  s.setChannelMask(GY521TiltSensor::kChannelPitch | GY521TiltSensor::kChannelRoll);
  TEST_ASSERT_TRUE(s.channel(0).reading.valid);
  TEST_ASSERT_TRUE(s.channel(1).reading.valid);
}

void test_readings_invalid_before_begin() {
  GY521TiltSensor s("hydrometer", 0x68);
  s.tick();  // no begin() -> inner GY521Sensor stays uninitialised
  TEST_ASSERT_FALSE(s.channel(0).reading.valid);
}

// ── Angles against the native stub ──────────────────────────────────────────

void test_flat_all_angles_zero() {
  GY521TiltSensor s("imu", 0x68);
  s.setChannelMask(0x007);
  s.begin();
  s.tick();
  for (size_t i = 0; i < 3; ++i) {
    TEST_ASSERT_TRUE(s.channel(i).reading.valid);
    TEST_ASSERT_FLOAT_WITHIN(0.01f, 0.0f, s.channel(i).reading.value);
  }
}

// Rotated +30° about Y: the X axis points 30° up out of the horizontal, the
// chip sees ax = -sin 30°, az = cos 30°.
void test_rotation_about_y_is_pitch() {
  setAccel(-sinf(30 * kDegToRad), 0.0f, cosf(30 * kDegToRad));
  GY521TiltSensor s("imu", 0x68);
  s.setChannelMask(0x007);
  s.begin();
  s.tick();
  TEST_ASSERT_FLOAT_WITHIN(0.05f, 30.0f, s.channel(0).reading.value);  // pitch
  TEST_ASSERT_FLOAT_WITHIN(0.05f, 0.0f,  s.channel(1).reading.value);  // roll
  TEST_ASSERT_FLOAT_WITHIN(0.05f, 30.0f, s.channel(2).reading.value);  // tilt
}

// Rotated +30° about X: ay = sin 30°, az = cos 30°.
void test_rotation_about_x_is_roll() {
  setAccel(0.0f, sinf(30 * kDegToRad), cosf(30 * kDegToRad));
  GY521TiltSensor s("imu", 0x68);
  s.setChannelMask(0x007);
  s.begin();
  s.tick();
  TEST_ASSERT_FLOAT_WITHIN(0.05f, 0.0f,  s.channel(0).reading.value);
  TEST_ASSERT_FLOAT_WITHIN(0.05f, 30.0f, s.channel(1).reading.value);
  TEST_ASSERT_FLOAT_WITHIN(0.05f, 30.0f, s.channel(2).reading.value);
}

// Standing on the long edge (X down) is pitch 90° and tilt 90°; upside down
// is tilt 180°, which pitch and roll cannot tell from flat.
void test_tilt_covers_the_full_range() {
  setAccel(-1.0f, 0.0f, 0.0f);
  GY521TiltSensor s("imu", 0x68);
  s.setChannelMask(0x007);
  s.begin();
  s.tick();
  TEST_ASSERT_FLOAT_WITHIN(0.05f, 90.0f, s.channel(0).reading.value);
  TEST_ASSERT_FLOAT_WITHIN(0.05f, 90.0f, s.channel(2).reading.value);

  setAccel(0.0f, 0.0f, -1.0f);
  run(s, 1);
  TEST_ASSERT_FLOAT_WITHIN(0.05f, 180.0f, s.channel(2).reading.value);
}

// Pitch follows the gyro's Y axis, roll its X axis: a short positive rate on
// one axis moves only its own angle ahead of the (unchanged) accelerometer.
void test_gyro_axes_feed_the_matching_angle() {
  GY521TiltSensor s("imu", 0x68);
  s.setChannelMask(0x003);
  s.begin();
  s.tick();
  setGyro(0.0f, 20.0f, 0.0f);
  run(s, 10);
  TEST_ASSERT_TRUE(s.channel(0).reading.value > 0.5f);                  // pitch moved
  TEST_ASSERT_FLOAT_WITHIN(0.01f, 0.0f, s.channel(1).reading.value);    // roll did not

  GY521TiltSensor r("imu", 0x68);
  r.setChannelMask(0x003);
  setGyro(0.0f, 0.0f, 0.0f);
  r.begin();
  r.tick();
  setGyro(20.0f, 0.0f, 0.0f);
  run(r, 10);
  TEST_ASSERT_FLOAT_WITHIN(0.01f, 0.0f, r.channel(0).reading.value);
  TEST_ASSERT_TRUE(r.channel(1).reading.value > 0.5f);
}

// A gyro zero-rate offset at rest would hold a plain complementary filter off
// by offset x time constant; the bias estimate pulls both angles back to the
// accelerometer.
void test_gyro_offset_is_learned() {
  GY521TiltSensor s("imu", 0x68);
  s.setChannelMask(0x003);
  setGyro(2.0f, -1.5f, 0.0f);
  s.begin();
  run(s, 1000);  // 10 s: still visibly off
  TEST_ASSERT_TRUE(fabsf(s.channel(1).reading.value) > 0.1f);
  run(s, 11000);  // 2 min in total
  TEST_ASSERT_FLOAT_WITHIN(0.05f, 0.0f, s.channel(0).reading.value);
  TEST_ASSERT_FLOAT_WITHIN(0.05f, 0.0f, s.channel(1).reading.value);
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

void test_no_device_all_channels_invalid() {
  gy521Present = false;
  GY521TiltSensor s("imu", 0x68);
  s.setChannelMask(0x3FF);
  s.begin();
  s.tick();
  for (size_t i = 0; i < s.channelCount(); ++i)
    TEST_ASSERT_FALSE(s.channel(i).reading.valid);
}

void test_device_pulled_angles_invalid_then_recover() {
  GY521TiltSensor s("hydrometer", 0x68);
  s.setChannelMask(0x007);
  s.begin();
  s.tick();
  TEST_ASSERT_TRUE(s.channel(0).reading.valid);

  gy521Present = false;
  gy521NowMs += 100;
  s.tick();
  for (size_t i = 0; i < 3; ++i) TEST_ASSERT_FALSE(s.channel(i).reading.valid);

  gy521Present = true;
  gy521NowMs += 10000;
  s.tick();
  for (size_t i = 0; i < 3; ++i) {
    TEST_ASSERT_TRUE(s.channel(i).reading.valid);
    TEST_ASSERT_FLOAT_WITHIN(0.01f, 0.0f, s.channel(i).reading.value);
  }
}

void setUp() {
  gy521Present = true;
  gy521NowMs   = 0;
  setAccel(0.0f, 0.0f, 1.0f);
  setGyro(0.0f, 0.0f, 0.0f);
}
void tearDown() {}

int main(int, char**) {
  UNITY_BEGIN();
  RUN_TEST(test_complementary_step_pure_accel_when_alpha_zero);
  RUN_TEST(test_complementary_step_pure_gyro_when_alpha_one);
  RUN_TEST(test_complementary_step_blends_both_terms);
  RUN_TEST(test_complementary_step_zero_dt_ignores_gyro_rate);
  RUN_TEST(test_default_is_pitch_only);
  RUN_TEST(test_full_mask_exposes_all_channels_in_order);
  RUN_TEST(test_partial_mask_maps_to_selected_channels);
  RUN_TEST(test_empty_mask_is_ignored);
  RUN_TEST(test_angles_run_without_their_channels_exposed);
  RUN_TEST(test_readings_invalid_before_begin);
  RUN_TEST(test_flat_all_angles_zero);
  RUN_TEST(test_rotation_about_y_is_pitch);
  RUN_TEST(test_rotation_about_x_is_roll);
  RUN_TEST(test_tilt_covers_the_full_range);
  RUN_TEST(test_gyro_axes_feed_the_matching_angle);
  RUN_TEST(test_gyro_offset_is_learned);
  RUN_TEST(test_caller_bus_delegates_to_raw_sensor);
  RUN_TEST(test_no_device_all_channels_invalid);
  RUN_TEST(test_device_pulled_angles_invalid_then_recover);
  return UNITY_END();
}
