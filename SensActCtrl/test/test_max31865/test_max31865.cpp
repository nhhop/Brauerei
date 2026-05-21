#include <unity.h>
#include "sensors/MAX31865Sensor.h"

using SensActCtrl::MAX31865Sensor;
using SensActCtrl::SensorMeta;
using SensActCtrl::ValueKind;
using SensActCtrl::Quantity;
using SensActCtrl::Reading;

void test_meta_temperature_range() {
  MAX31865Sensor s("pt", 5, MAX31865Sensor::Wires::Two,
                   MAX31865Sensor::RtdType::PT100, 430.0f);
  SensorMeta m = s.meta();
  TEST_ASSERT_EQUAL(ValueKind::Continuous, m.kind);
  TEST_ASSERT_EQUAL(Quantity::Temperature, m.quantity);
  TEST_ASSERT_EQUAL_STRING("\xc2\xb0""C", m.unit);
  TEST_ASSERT_FLOAT_WITHIN(0.001f, -200.0f, m.min);
  TEST_ASSERT_FLOAT_WITHIN(0.001f,  850.0f, m.max);
  TEST_ASSERT_FLOAT_WITHIN(0.0001f, 0.03125f, m.resolution);
}

void test_default_reading_invalid() {
  MAX31865Sensor s("pt", 5, MAX31865Sensor::Wires::Three,
                   MAX31865Sensor::RtdType::PT1000, 4300.0f);
  Reading r = s.lastReading();
  TEST_ASSERT_FALSE(r.valid);
  TEST_ASSERT_EQUAL(0u, r.timestampMs);
}

void test_id_returns_given_string() {
  MAX31865Sensor s("boil_temp", 5, MAX31865Sensor::Wires::Two,
                   MAX31865Sensor::RtdType::PT100, 430.0f);
  TEST_ASSERT_EQUAL_STRING("boil_temp", s.id());
}

void setUp() {}
void tearDown() {}

int main(int, char**) {
  UNITY_BEGIN();
  RUN_TEST(test_meta_temperature_range);
  RUN_TEST(test_default_reading_invalid);
  RUN_TEST(test_id_returns_given_string);
  return UNITY_END();
}
