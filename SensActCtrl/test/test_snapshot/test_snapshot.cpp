#include <unity.h>

#include <ArduinoJson.h>

#include <cstring>

#include "controllers/TwoPointController.h"
#include "core/Registry.h"
#include "core/RegistrySnapshot.h"

#include "../mocks/MockActuator.h"
#include "../mocks/MockSensor.h"

using SensActCtrl::ActuatorMeta;
using SensActCtrl::Quantity;
using SensActCtrl::Registry;
using SensActCtrl::SensorMeta;
using SensActCtrl::TwoPointController;
using SensActCtrl::ValueKind;
using SensActCtrl::serializeRegistry;
using SensActCtrl::test::MockActuator;
using SensActCtrl::test::MockSensor;

static SensorMeta tempMeta() {
  return SensorMeta{ValueKind::Continuous, Quantity::Temperature, "\xc2\xb0""C",
                    -55.0f, 125.0f, 0.0625f};
}
static ActuatorMeta switchMeta() {
  return ActuatorMeta{ValueKind::Binary, Quantity::None, "", 0.0f, 1.0f, 1.0f};
}

void test_empty_registry_produces_empty_arrays() {
  Registry reg;
  char buf[256];
  size_t n = serializeRegistry(reg, buf, sizeof(buf));
  TEST_ASSERT_TRUE(n > 0);

  JsonDocument doc;
  TEST_ASSERT_FALSE(deserializeJson(doc, buf));
  TEST_ASSERT_TRUE(doc["sensors"].is<JsonArray>());
  TEST_ASSERT_TRUE(doc["actuators"].is<JsonArray>());
  TEST_ASSERT_TRUE(doc["controllers"].is<JsonArray>());
  TEST_ASSERT_EQUAL(0u, doc["sensors"].as<JsonArray>().size());
  TEST_ASSERT_EQUAL(0u, doc["actuators"].as<JsonArray>().size());
  TEST_ASSERT_EQUAL(0u, doc["controllers"].as<JsonArray>().size());
}

void test_snapshot_includes_sensor_and_actuator_meta_plus_state() {
  MockSensor temp("mash_temp", tempMeta());
  temp.value = 42.5f;
  temp.valid = true;
  temp.tick();  // stamp lastReading

  MockActuator heater("heater", switchMeta());
  heater.write(1.0f);

  Registry reg;
  reg.add(&temp);
  reg.add(&heater);

  char buf[1024];
  size_t n = serializeRegistry(reg, buf, sizeof(buf));
  TEST_ASSERT_TRUE(n > 0);

  JsonDocument doc;
  TEST_ASSERT_FALSE(deserializeJson(doc, buf));

  JsonArray sensors = doc["sensors"].as<JsonArray>();
  TEST_ASSERT_EQUAL(1u, sensors.size());
  JsonObject s0 = sensors[0];
  TEST_ASSERT_EQUAL_STRING("mash_temp", s0["id"].as<const char*>());
  TEST_ASSERT_EQUAL_STRING("Continuous", s0["meta"]["kind"].as<const char*>());
  TEST_ASSERT_EQUAL_STRING("Temperature", s0["meta"]["quantity"].as<const char*>());
  TEST_ASSERT_EQUAL_STRING("\xc2\xb0""C", s0["meta"]["unit"].as<const char*>());
  TEST_ASSERT_FLOAT_WITHIN(0.001f, -55.0f, s0["meta"]["min"].as<float>());
  TEST_ASSERT_FLOAT_WITHIN(0.001f, 125.0f, s0["meta"]["max"].as<float>());
  TEST_ASSERT_TRUE(s0["state"]["ok"].as<bool>());
  TEST_ASSERT_FLOAT_WITHIN(0.001f, 42.5f, s0["state"]["v"].as<float>());

  JsonArray actuators = doc["actuators"].as<JsonArray>();
  TEST_ASSERT_EQUAL(1u, actuators.size());
  JsonObject a0 = actuators[0];
  TEST_ASSERT_EQUAL_STRING("heater", a0["id"].as<const char*>());
  TEST_ASSERT_EQUAL_STRING("Binary", a0["meta"]["kind"].as<const char*>());
  TEST_ASSERT_EQUAL_STRING("None", a0["meta"]["quantity"].as<const char*>());
  TEST_ASSERT_FLOAT_WITHIN(0.001f, 1.0f, a0["state"]["v"].as<float>());
}

void test_snapshot_controller_params_are_nested_object() {
  MockSensor s("t", tempMeta());
  MockActuator a("o", switchMeta());
  TwoPointController ctrl("mash_ctrl", s, a);
  ctrl.setSetpoint(65.0f);
  ctrl.setHysteresis(-0.5f, 0.5f);

  Registry reg;
  reg.add(&s);
  reg.add(&a);
  reg.add(&ctrl);

  char buf[1024];
  size_t n = serializeRegistry(reg, buf, sizeof(buf));
  TEST_ASSERT_TRUE(n > 0);

  JsonDocument doc;
  TEST_ASSERT_FALSE(deserializeJson(doc, buf));

  JsonArray ctrls = doc["controllers"].as<JsonArray>();
  TEST_ASSERT_EQUAL(1u, ctrls.size());
  JsonObject c0 = ctrls[0];
  TEST_ASSERT_EQUAL_STRING("mash_ctrl", c0["id"].as<const char*>());
  TEST_ASSERT_FLOAT_WITHIN(0.001f, 65.0f, c0["setpoint"].as<float>());

  // params must be an object, not a string — frontend reads fields directly.
  TEST_ASSERT_TRUE(c0["params"].is<JsonObject>());
  TEST_ASSERT_FLOAT_WITHIN(0.001f, -0.5f, c0["params"]["hystLow"].as<float>());
  TEST_ASSERT_FLOAT_WITHIN(0.001f, 0.5f, c0["params"]["hystHigh"].as<float>());
}

void test_snapshot_returns_zero_on_too_small_buffer() {
  MockSensor temp("mash_temp", tempMeta());
  temp.value = 21.0f;
  temp.tick();
  Registry reg;
  reg.add(&temp);

  char tiny[16];
  size_t n = serializeRegistry(reg, tiny, sizeof(tiny));
  TEST_ASSERT_EQUAL(0u, n);
}

void setUp() {}
void tearDown() {}

int main(int, char**) {
  UNITY_BEGIN();
  RUN_TEST(test_empty_registry_produces_empty_arrays);
  RUN_TEST(test_snapshot_includes_sensor_and_actuator_meta_plus_state);
  RUN_TEST(test_snapshot_controller_params_are_nested_object);
  RUN_TEST(test_snapshot_returns_zero_on_too_small_buffer);
  return UNITY_END();
}
