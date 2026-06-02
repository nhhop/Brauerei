#include <unity.h>
#include <string.h>

#include "controllers/SplitRangePIDController.h"
#include "../mocks/MockSensor.h"
#include "../mocks/MockActuator.h"

using SensActCtrl::SplitRangePIDController;
using SensActCtrl::splitRangeSetMillisForTest;
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
static ActuatorMeta pwmMeta() {
  return ActuatorMeta{ValueKind::Continuous, Quantity::None, "", 0.0f, 1.0f, 0.01f};
}

static void step(MockSensor& s, SplitRangePIDController& c, float v, uint32_t ms) {
  splitRangeSetMillisForTest(ms);
  s.value = v;
  s.tick();
  c.tick();
}

void test_positive_error_heats_only() {
  MockSensor s("t", tempMeta());
  MockActuator h("h", pwmMeta()), cl("c", pwmMeta());
  SplitRangePIDController c("ctrl", s, &h, &cl);
  c.setSetpoint(20.0f);
  c.setTunings(0.1f, 0.0f, 0.0f);

  step(s, c, 15.0f, 1000);  // error +5 → out +0.5 → heat
  TEST_ASSERT_TRUE(h.state() > 0.0f);
  TEST_ASSERT_FLOAT_WITHIN(0.001f, 0.0f, cl.state());
}

void test_negative_error_cools_only() {
  MockSensor s("t", tempMeta());
  MockActuator h("h", pwmMeta()), cl("c", pwmMeta());
  SplitRangePIDController c("ctrl", s, &h, &cl);
  c.setSetpoint(20.0f);
  c.setTunings(0.1f, 0.0f, 0.0f);

  step(s, c, 25.0f, 1000);  // error -5 → out -0.5 → cool
  TEST_ASSERT_TRUE(cl.state() > 0.0f);
  TEST_ASSERT_FLOAT_WITHIN(0.001f, 0.0f, h.state());
}

void test_deadband_both_off() {
  MockSensor s("t", tempMeta());
  MockActuator h("h", pwmMeta()), cl("c", pwmMeta());
  SplitRangePIDController c("ctrl", s, &h, &cl);
  c.setSetpoint(20.0f);
  c.setTunings(0.1f, 0.0f, 0.0f);
  c.setDeadband(0.5f);

  step(s, c, 18.0f, 1000);  // error +2 → out +0.2 < deadband → both off
  TEST_ASSERT_FLOAT_WITHIN(0.001f, 0.0f, h.state());
  TEST_ASSERT_FLOAT_WITHIN(0.001f, 0.0f, cl.state());
}

void test_output_clamped_to_one() {
  MockSensor s("t", tempMeta());
  MockActuator h("h", pwmMeta()), cl("c", pwmMeta());
  SplitRangePIDController c("ctrl", s, &h, &cl);
  c.setSetpoint(20.0f);
  c.setTunings(0.1f, 0.0f, 0.0f);

  step(s, c, 0.0f, 1000);  // error +20 → out 2.0 → clamped to 1.0
  TEST_ASSERT_FLOAT_WITHIN(0.001f, 1.0f, h.state());
}

void test_negative_deadband_clamped() {
  MockSensor s("t", tempMeta());
  MockActuator h("h", pwmMeta()), cl("c", pwmMeta());
  SplitRangePIDController c("ctrl", s, &h, &cl);
  c.setDeadband(-0.3f);
  TEST_ASSERT_FLOAT_WITHIN(0.001f, 0.0f, c.deadband());
}

void test_changeover_holds_both_off_on_sign_flip() {
  MockSensor s("t", tempMeta());
  MockActuator h("h", pwmMeta()), cl("c", pwmMeta());
  SplitRangePIDController c("ctrl", s, &h, &cl);
  c.setSetpoint(20.0f);
  c.setTunings(0.1f, 0.0f, 0.0f);
  c.setChangeoverMs(5000);

  step(s, c, 10.0f, 1000);  // error +10 → heat on
  TEST_ASSERT_TRUE(h.state() > 0.0f);
  step(s, c, 30.0f, 2000);  // flips to cool, but heat was on → both off
  TEST_ASSERT_FLOAT_WITHIN(0.001f, 0.0f, h.state());
  TEST_ASSERT_FLOAT_WITHIN(0.001f, 0.0f, cl.state());
  step(s, c, 30.0f, 3000);  // only 1 s since heat off → cool still blocked
  TEST_ASSERT_FLOAT_WITHIN(0.001f, 0.0f, cl.state());
  step(s, c, 30.0f, 8000);  // 6 s since heat off → cool allowed
  TEST_ASSERT_TRUE(cl.state() > 0.0f);
}

void test_disabled_drives_both_off() {
  MockSensor s("t", tempMeta());
  MockActuator h("h", pwmMeta()), cl("c", pwmMeta());
  SplitRangePIDController c("ctrl", s, &h, &cl);
  c.setSetpoint(20.0f);
  c.setTunings(0.1f, 0.0f, 0.0f);

  step(s, c, 10.0f, 1000);  // heat on
  c.setEnabled(false);
  step(s, c, 10.0f, 2000);  // disabled → both off
  TEST_ASSERT_FLOAT_WITHIN(0.001f, 0.0f, h.state());
  TEST_ASSERT_FLOAT_WITHIN(0.001f, 0.0f, cl.state());
}

void test_invalid_reading_drives_both_off() {
  MockSensor s("t", tempMeta());
  MockActuator h("h", pwmMeta()), cl("c", pwmMeta());
  SplitRangePIDController c("ctrl", s, &h, &cl);
  c.setSetpoint(20.0f);
  c.setTunings(0.1f, 0.0f, 0.0f);

  step(s, c, 10.0f, 1000);  // heat on
  splitRangeSetMillisForTest(2000);
  s.valid = false;
  s.tick();
  c.tick();
  TEST_ASSERT_FLOAT_WITHIN(0.001f, 0.0f, h.state());
  TEST_ASSERT_FLOAT_WITHIN(0.001f, 0.0f, cl.state());
}

void test_params_json_roundtrip() {
  MockSensor s("t", tempMeta());
  MockActuator h("h", pwmMeta()), cl("c", pwmMeta());
  SplitRangePIDController c("ctrl", s, &h, &cl);
  c.setSetpoint(20.5f);
  c.setTunings(1.5f, 0.2f, 0.05f);
  c.setDeadband(0.1f);
  c.setChangeoverMs(15000);
  c.setEnabled(false);

  char buf[384];
  size_t n = c.paramsJson(buf, sizeof(buf));
  TEST_ASSERT_GREATER_THAN(0, n);

  SplitRangePIDController c2("ctrl", s, &h, &cl);
  TEST_ASSERT_TRUE(c2.setParamsJson(buf));
  TEST_ASSERT_FLOAT_WITHIN(0.001f, 20.5f, c2.setpoint());
  TEST_ASSERT_FLOAT_WITHIN(0.001f, 1.5f, c2.kp());
  TEST_ASSERT_FLOAT_WITHIN(0.001f, 0.2f, c2.ki());
  TEST_ASSERT_FLOAT_WITHIN(0.001f, 0.05f, c2.kd());
  TEST_ASSERT_FLOAT_WITHIN(0.001f, 0.1f, c2.deadband());
  TEST_ASSERT_EQUAL_UINT32(15000u, c2.changeoverMs());
  TEST_ASSERT_FALSE(c2.enabled());
}

void test_autotune_start_runs_and_enables() {
  MockSensor s("t", tempMeta());
  MockActuator h("h", pwmMeta()), cl("c", pwmMeta());
  SplitRangePIDController c("ctrl", s, &h, &cl);
  c.setEnabled(false);

  TEST_ASSERT_TRUE(c.setParamsJson("{\"autotune\":\"start\"}"));
  TEST_ASSERT_TRUE(c.enabled());

  char buf[384];
  c.paramsJson(buf, sizeof(buf));
  TEST_ASSERT_NOT_NULL(strstr(buf, "\"autotuneState\":\"running\""));
}

void test_autotune_start_with_method() {
  MockSensor s("t", tempMeta());
  MockActuator h("h", pwmMeta()), cl("c", pwmMeta());
  SplitRangePIDController c("ctrl", s, &h, &cl);

  TEST_ASSERT_TRUE(c.setParamsJson(
      "{\"autotune\":\"start\",\"autotuneMethod\":\"IMC\"}"));
  char buf[384];
  c.paramsJson(buf, sizeof(buf));
  TEST_ASSERT_NOT_NULL(strstr(buf, "\"autotuneMethod\":\"IMC\""));
  TEST_ASSERT_NOT_NULL(strstr(buf, "\"autotuneState\":\"running\""));
}

void test_autotune_stop_returns_to_idle() {
  MockSensor s("t", tempMeta());
  MockActuator h("h", pwmMeta()), cl("c", pwmMeta());
  SplitRangePIDController c("ctrl", s, &h, &cl);

  c.setParamsJson("{\"autotune\":\"start\"}");
  c.setParamsJson("{\"autotune\":\"stop\"}");
  char buf[384];
  c.paramsJson(buf, sizeof(buf));
  TEST_ASSERT_NOT_NULL(strstr(buf, "\"autotuneState\":\"idle\""));
}

void test_stop_autotune_idempotent_when_idle() {
  MockSensor s("t", tempMeta());
  MockActuator h("h", pwmMeta()), cl("c", pwmMeta());
  SplitRangePIDController c("ctrl", s, &h, &cl);
  c.stopAutotune();
  char buf[384];
  c.paramsJson(buf, sizeof(buf));
  TEST_ASSERT_NOT_NULL(strstr(buf, "\"autotuneState\":\"idle\""));
}

void setUp() { splitRangeSetMillisForTest(0); }
void tearDown() {}

int main(int, char**) {
  UNITY_BEGIN();
  RUN_TEST(test_positive_error_heats_only);
  RUN_TEST(test_negative_error_cools_only);
  RUN_TEST(test_deadband_both_off);
  RUN_TEST(test_output_clamped_to_one);
  RUN_TEST(test_negative_deadband_clamped);
  RUN_TEST(test_changeover_holds_both_off_on_sign_flip);
  RUN_TEST(test_disabled_drives_both_off);
  RUN_TEST(test_invalid_reading_drives_both_off);
  RUN_TEST(test_params_json_roundtrip);
  RUN_TEST(test_autotune_start_runs_and_enables);
  RUN_TEST(test_autotune_start_with_method);
  RUN_TEST(test_autotune_stop_returns_to_idle);
  RUN_TEST(test_stop_autotune_idempotent_when_idle);
  return UNITY_END();
}
