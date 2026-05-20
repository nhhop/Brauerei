#include <unity.h>

#include <string.h>

#include "controllers/PIDController.h"
#include "../mocks/MockSensor.h"
#include "../mocks/MockActuator.h"

using SensActCtrl::PIDController;
using SensActCtrl::TuningMethod;
using SensActCtrl::SensorMeta;
using SensActCtrl::ActuatorMeta;
using SensActCtrl::ValueKind;
using SensActCtrl::Quantity;
using SensActCtrl::test::MockSensor;
using SensActCtrl::test::MockActuator;

static SensorMeta tempMeta() {
  return SensorMeta{ValueKind::Continuous, Quantity::Temperature, "\xc2\xb0""C",
                    -55.0f, 125.0f, 0.0625f};
}
static ActuatorMeta dutyMeta() {
  return ActuatorMeta{ValueKind::Continuous, Quantity::DutyCycle, "",
                      0.0f, 1.0f, 0.01f};
}

void test_manual_tuning_stored_and_readable() {
  MockSensor s("t1", tempMeta());
  MockActuator a("o1", dutyMeta());
  PIDController pid("pid", s, a, 0.0f, 1.0f);

  pid.setTunings(2.5f, 0.1f, 0.05f);
  TEST_ASSERT_FLOAT_WITHIN(0.001f, 2.5f, pid.kp());
  TEST_ASSERT_FLOAT_WITHIN(0.001f, 0.1f, pid.ki());
  TEST_ASSERT_FLOAT_WITHIN(0.001f, 0.05f, pid.kd());
}

void test_step_response_positive_error_produces_positive_output() {
  MockSensor s("t1", tempMeta());
  MockActuator a("o1", dutyMeta());
  PIDController pid("pid", s, a, 0.0f, 1.0f);
  pid.setTunings(0.5f, 0.0f, 0.0f);
  pid.setSetpoint(70.0f);
  pid.begin();

  s.value = 65.0f;  // error = +5 → output ≈ 0.5*5 clamped to 1.0
  s.tick();
  pid.tick();

  TEST_ASSERT_EQUAL(1u, a.writes.size());
  TEST_ASSERT_GREATER_THAN(0.0f, a.writes.back());
}

void test_step_response_negative_error_produces_zero_or_min_output() {
  MockSensor s("t1", tempMeta());
  MockActuator a("o1", dutyMeta());
  PIDController pid("pid", s, a, 0.0f, 1.0f);
  pid.setTunings(0.5f, 0.0f, 0.0f);
  pid.setSetpoint(60.0f);
  pid.begin();

  s.value = 70.0f;  // error = -10 → P term negative, clamps to 0
  s.tick();
  pid.tick();

  TEST_ASSERT_EQUAL(1u, a.writes.size());
  TEST_ASSERT_FLOAT_WITHIN(0.001f, 0.0f, a.writes.back());
}

void test_params_json_roundtrip() {
  MockSensor s("t1", tempMeta());
  MockActuator a("o1", dutyMeta());
  PIDController pid("pid", s, a, 0.0f, 1.0f);

  pid.setSetpoint(65.0f);
  pid.setTunings(3.0f, 0.2f, 0.01f);

  char buf[256];
  size_t n = pid.paramsJson(buf, sizeof(buf));
  TEST_ASSERT_GREATER_THAN(0, n);
  TEST_ASSERT_NOT_NULL(strstr(buf, "\"Kp\":3.0000"));
  TEST_ASSERT_NOT_NULL(strstr(buf, "\"Ki\":0.2000"));
  TEST_ASSERT_NOT_NULL(strstr(buf, "\"Kd\":0.0100"));
  TEST_ASSERT_NOT_NULL(strstr(buf, "\"setpoint\":65.0000"));
  TEST_ASSERT_NOT_NULL(strstr(buf, "\"autotuneState\":\"idle\""));

  PIDController pid2("pid", s, a, 0.0f, 1.0f);
  TEST_ASSERT_TRUE(pid2.setParamsJson(buf));
  TEST_ASSERT_FLOAT_WITHIN(0.001f, 65.0f, pid2.setpoint());
  TEST_ASSERT_FLOAT_WITHIN(0.001f, 3.0f, pid2.kp());
  TEST_ASSERT_FLOAT_WITHIN(0.001f, 0.2f, pid2.ki());
  TEST_ASSERT_FLOAT_WITHIN(0.001f, 0.01f, pid2.kd());
}

void test_invalid_reading_skips_tick() {
  MockSensor s("t1", tempMeta());
  MockActuator a("o1", dutyMeta());
  PIDController pid("pid", s, a, 0.0f, 1.0f);
  pid.setTunings(1.0f, 0.0f, 0.0f);
  pid.setSetpoint(50.0f);
  pid.begin();

  s.valid = false;
  s.tick();
  pid.tick();
  TEST_ASSERT_EQUAL(0u, a.writes.size());
}

void setUp() {}
void tearDown() {}

int main(int, char**) {
  UNITY_BEGIN();
  RUN_TEST(test_manual_tuning_stored_and_readable);
  RUN_TEST(test_step_response_positive_error_produces_positive_output);
  RUN_TEST(test_step_response_negative_error_produces_zero_or_min_output);
  RUN_TEST(test_params_json_roundtrip);
  RUN_TEST(test_invalid_reading_skips_tick);
  return UNITY_END();
}
