#include <unity.h>

#include "sensors/AnalogInputSensor.h"

using SensActCtrl::AnalogInputSensor;
using SensActCtrl::Quantity;

void test_default_passthrough() {
  AnalogInputSensor a("a", /*pin=*/34);
  TEST_ASSERT_FLOAT_WITHIN(0.001f, 0.0f, a.rawToValue(0.0f));
  TEST_ASSERT_FLOAT_WITHIN(0.001f, 4095.0f, a.rawToValue(4095.0f));
  TEST_ASSERT_FLOAT_WITHIN(0.001f, 2047.5f, a.rawToValue(2047.5f));
}

void test_ph_calibration() {
  // Typical pH-probe: raw 100 → pH 0, raw 3000 → pH 14
  AnalogInputSensor a("ph", /*pin=*/34);
  a.setCalibration(100, 3000, 0.0f, 14.0f);
  a.setMeta(Quantity::pH, "pH", 0.0f, 14.0f, 0.01f);

  TEST_ASSERT_FLOAT_WITHIN(0.001f, 0.0f, a.rawToValue(100.0f));
  TEST_ASSERT_FLOAT_WITHIN(0.001f, 14.0f, a.rawToValue(3000.0f));
  // Midpoint raw 1550 → pH 7
  TEST_ASSERT_FLOAT_WITHIN(0.01f, 7.0f, a.rawToValue(1550.0f));
  TEST_ASSERT_EQUAL_STRING("pH", a.channel(0).meta.unit);
  TEST_ASSERT_EQUAL(Quantity::pH, a.channel(0).meta.quantity);
}

void test_extrapolation_outside_calibration_range() {
  AnalogInputSensor a("p", /*pin=*/34);
  a.setCalibration(0, 4095, 0.0f, 3.0f);  // pressure 0..3 bar
  // Below raw 0 → negative pressure (intentional; not clamped)
  TEST_ASSERT_FLOAT_WITHIN(0.01f, -1.5f, a.rawToValue(-2047.5f));
  // Above raw 4095 → above 3 bar
  TEST_ASSERT_FLOAT_WITHIN(0.01f, 4.5f, a.rawToValue(6142.5f));
}

void setUp() {}
void tearDown() {}

int main(int, char**) {
  UNITY_BEGIN();
  RUN_TEST(test_default_passthrough);
  RUN_TEST(test_ph_calibration);
  RUN_TEST(test_extrapolation_outside_calibration_range);
  return UNITY_END();
}
