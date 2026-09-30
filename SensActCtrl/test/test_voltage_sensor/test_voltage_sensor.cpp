#include <unity.h>

#include "sensors/VoltageSensor.h"

using SensActCtrl::Quantity;
using SensActCtrl::VoltageSensor;

void test_divider_one_to_one() {
  // LiPo behind 100k/100k: 2.05 V at the pin → 4.10 V at the battery
  TEST_ASSERT_FLOAT_WITHIN(0.001f, 4.10f, VoltageSensor::dividerVolts(2050.0f, 100.0f, 100.0f));
}

void test_divider_uneven() {
  // 100k over 47k: factor 147/47
  TEST_ASSERT_FLOAT_WITHIN(0.001f, 1.0f * 147.0f / 47.0f,
                           VoltageSensor::dividerVolts(1000.0f, 100.0f, 47.0f));
}

void test_no_divider() {
  // R1 = 0 measures the pin directly
  TEST_ASSERT_FLOAT_WITHIN(0.001f, 1.234f, VoltageSensor::dividerVolts(1234.0f, 0.0f, 10.0f));
}

void test_meta() {
  VoltageSensor v("bat", /*pin=*/4, 100.0f, 100.0f);
  const auto meta = v.channel(0).meta;
  TEST_ASSERT_EQUAL(Quantity::Voltage, meta.quantity);
  TEST_ASSERT_EQUAL_STRING("V", meta.unit);
  TEST_ASSERT_FLOAT_WITHIN(0.001f, 6.6f, meta.max);
}

void setUp() {}
void tearDown() {}

int main(int, char**) {
  UNITY_BEGIN();
  RUN_TEST(test_divider_one_to_one);
  RUN_TEST(test_divider_uneven);
  RUN_TEST(test_no_divider);
  RUN_TEST(test_meta);
  return UNITY_END();
}
