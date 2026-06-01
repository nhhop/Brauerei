#include <unity.h>

#include "controllers/DualStageController.h"
#include "../mocks/MockSensor.h"
#include "../mocks/MockActuator.h"

using SensActCtrl::DualStageController;
using SensActCtrl::dualStageSetMillisForTest;
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
static ActuatorMeta switchMeta() {
  return ActuatorMeta{ValueKind::Binary, Quantity::None, "", 0.0f, 1.0f, 1.0f};
}

// Drive the sensor to a value and run one controller tick at time `ms`.
static void step(MockSensor& s, DualStageController& c, float v, uint32_t ms) {
  dualStageSetMillisForTest(ms);
  s.value = v;
  s.tick();
  c.tick();
}

void test_heat_on_below_setpoint_minus_diff() {
  MockSensor s("t", tempMeta());
  MockActuator h("h", switchMeta()), cl("c", switchMeta());
  DualStageController c("ctrl", s, &h, &cl);
  c.setSetpoint(20.0f);
  c.setDifferentials(0.5f, 0.5f);

  step(s, c, 19.0f, 1000);  // < 19.5 → heat on
  TEST_ASSERT_FLOAT_WITHIN(0.001f, 1.0f, h.state());
  TEST_ASSERT_FLOAT_WITHIN(0.001f, 0.0f, cl.state());
}

void test_heat_off_at_setpoint() {
  MockSensor s("t", tempMeta());
  MockActuator h("h", switchMeta()), cl("c", switchMeta());
  DualStageController c("ctrl", s, &h, &cl);
  c.setSetpoint(20.0f);
  c.setDifferentials(0.5f, 0.5f);

  step(s, c, 19.0f, 1000);  // heat on
  step(s, c, 20.0f, 2000);  // reaches setpoint → heat off
  TEST_ASSERT_FLOAT_WITHIN(0.001f, 0.0f, h.state());
}

void test_cool_on_above_setpoint_plus_diff() {
  MockSensor s("t", tempMeta());
  MockActuator h("h", switchMeta()), cl("c", switchMeta());
  DualStageController c("ctrl", s, &h, &cl);
  c.setSetpoint(20.0f);
  c.setDifferentials(0.5f, 0.5f);

  step(s, c, 21.0f, 1000);  // > 20.5 → cool on
  TEST_ASSERT_FLOAT_WITHIN(0.001f, 1.0f, cl.state());
  TEST_ASSERT_FLOAT_WITHIN(0.001f, 0.0f, h.state());
}

void test_cool_off_at_setpoint() {
  MockSensor s("t", tempMeta());
  MockActuator h("h", switchMeta()), cl("c", switchMeta());
  DualStageController c("ctrl", s, &h, &cl);
  c.setSetpoint(20.0f);
  c.setDifferentials(0.5f, 0.5f);

  step(s, c, 21.0f, 1000);  // cool on
  step(s, c, 20.0f, 2000);  // reaches setpoint → cool off
  TEST_ASSERT_FLOAT_WITHIN(0.001f, 0.0f, cl.state());
}

void test_deadband_both_off() {
  MockSensor s("t", tempMeta());
  MockActuator h("h", switchMeta()), cl("c", switchMeta());
  DualStageController c("ctrl", s, &h, &cl);
  c.setSetpoint(20.0f);
  c.setDifferentials(0.5f, 0.5f);

  step(s, c, 20.0f, 1000);  // inside deadband from a cold start
  TEST_ASSERT_FLOAT_WITHIN(0.001f, 0.0f, h.state());
  TEST_ASSERT_FLOAT_WITHIN(0.001f, 0.0f, cl.state());
}

void test_negative_diff_clamped_never_both_on() {
  MockSensor s("t", tempMeta());
  MockActuator h("h", switchMeta()), cl("c", switchMeta());
  DualStageController c("ctrl", s, &h, &cl);
  c.setSetpoint(20.0f);
  c.setDifferentials(-2.0f, -3.0f);  // clamped to 0/0
  TEST_ASSERT_FLOAT_WITHIN(0.001f, 0.0f, c.heatDiff());
  TEST_ASSERT_FLOAT_WITHIN(0.001f, 0.0f, c.coolDiff());

  step(s, c, 20.0f, 1000);  // exactly at setpoint → neither region
  TEST_ASSERT_FALSE(h.state() > 0.0f && cl.state() > 0.0f);
  TEST_ASSERT_FLOAT_WITHIN(0.001f, 0.0f, h.state());
  TEST_ASSERT_FLOAT_WITHIN(0.001f, 0.0f, cl.state());
}

void test_cool_min_off_blocks_restart() {
  MockSensor s("t", tempMeta());
  MockActuator h("h", switchMeta()), cl("c", switchMeta());
  DualStageController c("ctrl", s, &h, &cl);
  c.setSetpoint(20.0f);
  c.setDifferentials(0.5f, 0.5f);
  c.setCoolCycleLimits(0, 5000);  // min-off 5 s

  step(s, c, 21.0f, 1000);  // cool on
  step(s, c, 19.0f, 2000);  // cool off (off-time stamped at 2000)
  step(s, c, 21.0f, 3000);  // wants cool but only 1 s since off → blocked
  TEST_ASSERT_FLOAT_WITHIN(0.001f, 0.0f, cl.state());
  step(s, c, 21.0f, 8000);  // 6 s since off → allowed
  TEST_ASSERT_FLOAT_WITHIN(0.001f, 1.0f, cl.state());
}

void test_cool_min_on_holds() {
  MockSensor s("t", tempMeta());
  MockActuator h("h", switchMeta()), cl("c", switchMeta());
  DualStageController c("ctrl", s, &h, &cl);
  c.setSetpoint(20.0f);
  c.setDifferentials(0.5f, 0.5f);
  c.setCoolCycleLimits(5000, 0);  // min-on 5 s

  step(s, c, 21.0f, 1000);  // cool on (on-time stamped at 1000)
  step(s, c, 19.0f, 2000);  // wants off but only 1 s on → held
  TEST_ASSERT_FLOAT_WITHIN(0.001f, 1.0f, cl.state());
  step(s, c, 19.0f, 7000);  // 6 s on → released
  TEST_ASSERT_FLOAT_WITHIN(0.001f, 0.0f, cl.state());
}

void test_changeover_keeps_both_off() {
  MockSensor s("t", tempMeta());
  MockActuator h("h", switchMeta()), cl("c", switchMeta());
  DualStageController c("ctrl", s, &h, &cl);
  c.setSetpoint(20.0f);
  c.setDifferentials(0.5f, 0.5f);
  c.setChangeoverMs(5000);

  step(s, c, 19.0f, 1000);  // heat on
  step(s, c, 21.0f, 2000);  // heat off; cool blocked (heat was on)
  TEST_ASSERT_FLOAT_WITHIN(0.001f, 0.0f, h.state());
  TEST_ASSERT_FLOAT_WITHIN(0.001f, 0.0f, cl.state());
  step(s, c, 21.0f, 3000);  // only 1 s since heat off → cool still blocked
  TEST_ASSERT_FLOAT_WITHIN(0.001f, 0.0f, cl.state());
  step(s, c, 21.0f, 8000);  // 6 s since heat off → cool allowed
  TEST_ASSERT_FLOAT_WITHIN(0.001f, 1.0f, cl.state());
}

void test_disabled_drives_both_off() {
  MockSensor s("t", tempMeta());
  MockActuator h("h", switchMeta()), cl("c", switchMeta());
  DualStageController c("ctrl", s, &h, &cl);
  c.setSetpoint(20.0f);
  c.setDifferentials(0.5f, 0.5f);

  step(s, c, 19.0f, 1000);  // heat on
  c.setEnabled(false);
  step(s, c, 19.0f, 2000);  // disabled → both off
  TEST_ASSERT_FLOAT_WITHIN(0.001f, 0.0f, h.state());
  TEST_ASSERT_FLOAT_WITHIN(0.001f, 0.0f, cl.state());
}

void test_invalid_reading_drives_both_off() {
  MockSensor s("t", tempMeta());
  MockActuator h("h", switchMeta()), cl("c", switchMeta());
  DualStageController c("ctrl", s, &h, &cl);
  c.setSetpoint(20.0f);
  c.setDifferentials(0.5f, 0.5f);

  step(s, c, 19.0f, 1000);  // heat on
  dualStageSetMillisForTest(2000);
  s.valid = false;
  s.tick();
  c.tick();
  TEST_ASSERT_FLOAT_WITHIN(0.001f, 0.0f, h.state());
  TEST_ASSERT_FLOAT_WITHIN(0.001f, 0.0f, cl.state());
}

void test_params_json_roundtrip() {
  MockSensor s("t", tempMeta());
  MockActuator h("h", switchMeta()), cl("c", switchMeta());
  DualStageController c("ctrl", s, &h, &cl);
  c.setSetpoint(18.5f);
  c.setDifferentials(0.75f, 0.25f);
  c.setCoolCycleLimits(120000, 180000);
  c.setChangeoverMs(30000);
  c.setEnabled(false);

  char buf[384];
  size_t n = c.paramsJson(buf, sizeof(buf));
  TEST_ASSERT_GREATER_THAN(0, n);

  DualStageController c2("ctrl", s, &h, &cl);
  TEST_ASSERT_TRUE(c2.setParamsJson(buf));
  TEST_ASSERT_FLOAT_WITHIN(0.001f, 18.5f, c2.setpoint());
  TEST_ASSERT_FLOAT_WITHIN(0.001f, 0.75f, c2.heatDiff());
  TEST_ASSERT_FLOAT_WITHIN(0.001f, 0.25f, c2.coolDiff());
  TEST_ASSERT_EQUAL_UINT32(120000u, c2.coolMinOnMs());
  TEST_ASSERT_EQUAL_UINT32(180000u, c2.coolMinOffMs());
  TEST_ASSERT_EQUAL_UINT32(30000u, c2.changeoverMs());
  TEST_ASSERT_FALSE(c2.enabled());
}

void setUp() { dualStageSetMillisForTest(0); }
void tearDown() {}

int main(int, char**) {
  UNITY_BEGIN();
  RUN_TEST(test_heat_on_below_setpoint_minus_diff);
  RUN_TEST(test_heat_off_at_setpoint);
  RUN_TEST(test_cool_on_above_setpoint_plus_diff);
  RUN_TEST(test_cool_off_at_setpoint);
  RUN_TEST(test_deadband_both_off);
  RUN_TEST(test_negative_diff_clamped_never_both_on);
  RUN_TEST(test_cool_min_off_blocks_restart);
  RUN_TEST(test_cool_min_on_holds);
  RUN_TEST(test_changeover_keeps_both_off);
  RUN_TEST(test_disabled_drives_both_off);
  RUN_TEST(test_invalid_reading_drives_both_off);
  RUN_TEST(test_params_json_roundtrip);
  return UNITY_END();
}
