#include <unity.h>
#include <string.h>

#include "controllers/TwoPointController.h"
#include "controllers/PIDController.h"
#include "controllers/DualStageController.h"
#include "controllers/SplitRangePIDController.h"
#include "../mocks/MockSensor.h"
#include "../mocks/MockMultiSensor.h"
#include "../mocks/MockActuator.h"

using namespace SensActCtrl;
using SensActCtrl::test::MockActuator;
using SensActCtrl::test::MockMultiSensor;
using SensActCtrl::test::MockSensor;

static SensorMeta meta() {
  return SensorMeta{ValueKind::Continuous, Quantity::Temperature, "",
                    -55.0f, 125.0f, 0.0625f};
}
static ActuatorMeta switchMeta() {
  return ActuatorMeta{ValueKind::Binary, Quantity::None, "", 0.0f, 1.0f, 1.0f};
}

static bool has(const char* json, const char* needle) {
  return strstr(json, needle) != nullptr;
}

void test_twopoint_reads_selected_channel() {
  MockMultiSensor s("bme", meta());
  MockActuator a("o1", switchMeta());
  TwoPointController c("ctrl", s, a);
  c.setSetpoint(50.0f);
  c.setChannel(1);
  s.set(0, 10.0f);  // channel 0 far below the setpoint -> would switch on
  s.set(1, 80.0f);  // channel 1 far above -> must switch off
  c.tick();
  TEST_ASSERT_EQUAL(1u, a.writes.size());
  TEST_ASSERT_FLOAT_WITHIN(0.001f, 0.0f, a.writes.back());
}

void test_default_channel_is_zero() {
  MockMultiSensor s("bme", meta());
  MockActuator a("o1", switchMeta());
  TwoPointController c("ctrl", s, a);
  c.setSetpoint(50.0f);
  s.set(0, 10.0f);
  s.set(1, 80.0f);
  c.tick();
  TEST_ASSERT_FLOAT_WITHIN(0.001f, 1.0f, a.writes.back());
}

void test_out_of_range_channel_falls_back_to_zero() {
  MockMultiSensor s("bme", meta());
  MockActuator a("o1", switchMeta());
  TwoPointController c("ctrl", s, a);
  c.setChannel(7);
  TEST_ASSERT_EQUAL(0u, c.channel());
}

void test_params_json_names_channel_id() {
  MockMultiSensor s("bme", meta());
  MockActuator a("o1", switchMeta());
  TwoPointController c("ctrl", s, a);
  char buf[512];
  c.setChannel(1);
  TEST_ASSERT_TRUE(c.paramsJson(buf, sizeof buf) > 0);
  TEST_ASSERT_TRUE(has(buf, "\"sensor\":\"bme.hum\""));
}

void test_params_json_single_channel_keeps_bare_id() {
  MockSensor s("t1", meta());
  MockActuator a("o1", switchMeta());
  TwoPointController c("ctrl", s, a);
  char buf[512];
  TEST_ASSERT_TRUE(c.paramsJson(buf, sizeof buf) > 0);
  TEST_ASSERT_TRUE(has(buf, "\"sensor\":\"t1\""));
}

void test_pid_params_json_names_channel_id() {
  MockMultiSensor s("bme", meta());
  MockActuator a("o1", switchMeta());
  PIDController c("ctrl", s, a, 0.0f, 1.0f);
  char buf[768];
  c.setChannel(1);
  TEST_ASSERT_TRUE(c.paramsJson(buf, sizeof buf) > 0);
  TEST_ASSERT_TRUE(has(buf, "\"sensor\":\"bme.hum\""));
}

void test_dualstage_params_json_names_channel_id() {
  MockMultiSensor s("bme", meta());
  MockActuator h("h", switchMeta());
  MockActuator cl("c", switchMeta());
  DualStageController c("ctrl", s, &h, &cl);
  char buf[768];
  c.setChannel(1);
  TEST_ASSERT_TRUE(c.paramsJson(buf, sizeof buf) > 0);
  TEST_ASSERT_TRUE(has(buf, "\"sensor\":\"bme.hum\""));
}

void test_splitrange_params_json_names_channel_id() {
  MockMultiSensor s("bme", meta());
  MockActuator h("h", switchMeta());
  MockActuator cl("c", switchMeta());
  SplitRangePIDController c("ctrl", s, &h, &cl);
  char buf[768];
  c.setChannel(1);
  TEST_ASSERT_TRUE(c.paramsJson(buf, sizeof buf) > 0);
  TEST_ASSERT_TRUE(has(buf, "\"sensor\":\"bme.hum\""));
}

void setUp() {}
void tearDown() {}

int main(int, char**) {
  UNITY_BEGIN();
  RUN_TEST(test_twopoint_reads_selected_channel);
  RUN_TEST(test_default_channel_is_zero);
  RUN_TEST(test_out_of_range_channel_falls_back_to_zero);
  RUN_TEST(test_params_json_names_channel_id);
  RUN_TEST(test_params_json_single_channel_keeps_bare_id);
  RUN_TEST(test_pid_params_json_names_channel_id);
  RUN_TEST(test_dualstage_params_json_names_channel_id);
  RUN_TEST(test_splitrange_params_json_names_channel_id);
  return UNITY_END();
}
