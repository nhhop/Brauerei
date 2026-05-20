#include <unity.h>

#include "controllers/TwoPointController.h"
#include "../mocks/MockSensor.h"
#include "../mocks/MockActuator.h"

using SensActCtrl::TwoPointController;
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

void test_heating_turns_on_below_setpoint_minus_hyst() {
  MockSensor s("t1", tempMeta());
  MockActuator a("o1", switchMeta());
  TwoPointController c("ctrl", s, a);
  c.setSetpoint(60.0f);
  c.setHysteresis(-0.5f, 0.5f);

  s.value = 59.0f;  // below lowThresh (59.5)
  s.tick();
  c.tick();

  TEST_ASSERT_EQUAL(1u, a.writes.size());
  TEST_ASSERT_FLOAT_WITHIN(0.001f, 1.0f, a.writes.back());
}

void test_heating_turns_off_above_setpoint_plus_hyst() {
  MockSensor s("t1", tempMeta());
  MockActuator a("o1", switchMeta());
  TwoPointController c("ctrl", s, a);
  c.setSetpoint(60.0f);
  c.setHysteresis(-0.5f, 0.5f);

  s.value = 61.0f;
  s.tick();
  c.tick();

  TEST_ASSERT_EQUAL(1u, a.writes.size());
  TEST_ASSERT_FLOAT_WITHIN(0.001f, 0.0f, a.writes.back());
}

void test_deadband_holds_previous_state() {
  MockSensor s("t1", tempMeta());
  MockActuator a("o1", switchMeta());
  TwoPointController c("ctrl", s, a);
  c.setSetpoint(60.0f);
  c.setHysteresis(-0.5f, 0.5f);

  // First drive into ON state
  s.value = 59.0f;
  s.tick();
  c.tick();
  // Then move into deadband (between 59.5 and 60.5)
  s.value = 60.0f;
  s.tick();
  c.tick();

  TEST_ASSERT_EQUAL(2u, a.writes.size());
  TEST_ASSERT_FLOAT_WITHIN(0.001f, 1.0f, a.writes.back());  // still on

  // Now cross above high threshold
  s.value = 60.6f;
  s.tick();
  c.tick();
  TEST_ASSERT_FLOAT_WITHIN(0.001f, 0.0f, a.writes.back());
}

void test_inverted_cooling_logic() {
  MockSensor s("t1", tempMeta());
  MockActuator a("o1", switchMeta());
  TwoPointController c("ctrl", s, a);
  c.setSetpoint(20.0f);
  c.setHysteresis(-0.5f, 0.5f);
  c.setInverted(true);  // cooling: on above high, off below low

  s.value = 21.0f;  // above 20.5 → cool on
  s.tick();
  c.tick();
  TEST_ASSERT_FLOAT_WITHIN(0.001f, 1.0f, a.writes.back());

  s.value = 19.0f;  // below 19.5 → cool off
  s.tick();
  c.tick();
  TEST_ASSERT_FLOAT_WITHIN(0.001f, 0.0f, a.writes.back());
}

void test_invalid_reading_leaves_actuator_alone() {
  MockSensor s("t1", tempMeta());
  MockActuator a("o1", switchMeta());
  TwoPointController c("ctrl", s, a);
  c.setSetpoint(60.0f);

  s.valid = false;
  s.tick();
  c.tick();
  TEST_ASSERT_EQUAL(0u, a.writes.size());
}

void test_params_json_roundtrip() {
  MockSensor s("t1", tempMeta());
  MockActuator a("o1", switchMeta());
  TwoPointController c("ctrl", s, a);
  c.setSetpoint(63.5f);
  c.setHysteresis(-0.25f, 0.75f);
  c.setInverted(true);

  char buf[256];
  size_t n = c.paramsJson(buf, sizeof(buf));
  TEST_ASSERT_GREATER_THAN(0, n);

  TwoPointController c2("ctrl", s, a);
  TEST_ASSERT_TRUE(c2.setParamsJson(buf));
  TEST_ASSERT_FLOAT_WITHIN(0.001f, 63.5f, c2.setpoint());
  TEST_ASSERT_FLOAT_WITHIN(0.001f, -0.25f, c2.hysteresisLow());
  TEST_ASSERT_FLOAT_WITHIN(0.001f, 0.75f, c2.hysteresisHigh());
  TEST_ASSERT_TRUE(c2.inverted());
}

void setUp() {}
void tearDown() {}

int main(int, char**) {
  UNITY_BEGIN();
  RUN_TEST(test_heating_turns_on_below_setpoint_minus_hyst);
  RUN_TEST(test_heating_turns_off_above_setpoint_plus_hyst);
  RUN_TEST(test_deadband_holds_previous_state);
  RUN_TEST(test_inverted_cooling_logic);
  RUN_TEST(test_invalid_reading_leaves_actuator_alone);
  RUN_TEST(test_params_json_roundtrip);
  return UNITY_END();
}
