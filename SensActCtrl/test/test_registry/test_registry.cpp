#include <unity.h>

#include "core/Registry.h"
#include "../mocks/MockSensor.h"
#include "../mocks/MockActuator.h"

using SensActCtrl::Registry;
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

void test_meta_kind_and_quantity() {
  MockSensor s("t1", tempMeta());
  TEST_ASSERT_EQUAL(ValueKind::Continuous, s.channel(0).meta.kind);
  TEST_ASSERT_EQUAL(Quantity::Temperature, s.channel(0).meta.quantity);
  TEST_ASSERT_EQUAL_STRING("\xc2\xb0""C", s.channel(0).meta.unit);
  TEST_ASSERT_FLOAT_WITHIN(0.001f, -55.0f, s.channel(0).meta.min);
  TEST_ASSERT_FLOAT_WITHIN(0.001f, 125.0f, s.channel(0).meta.max);
}

void test_registry_tick_order_sensor_then_actuator() {
  // Tick order must be Sensors → Actuators so a Controller (next test)
  // would see a fresh reading before it writes.
  MockSensor s("t1", tempMeta());
  MockActuator a("o1", switchMeta());
  Registry reg;
  reg.add(&s);
  reg.add(&a);

  reg.tick();
  TEST_ASSERT_EQUAL(1u, s.tickCount);
  TEST_ASSERT_EQUAL(1u, a.tickCount);
}

void test_registry_find_by_id() {
  MockSensor s1("t1", tempMeta());
  MockSensor s2("t2", tempMeta());
  MockActuator a1("o1", switchMeta());
  Registry reg;
  reg.add(&s1);
  reg.add(&s2);
  reg.add(&a1);

  TEST_ASSERT_EQUAL_PTR(&s1, reg.findSensor("t1"));
  TEST_ASSERT_EQUAL_PTR(&s2, reg.findSensor("t2"));
  TEST_ASSERT_NULL(reg.findSensor("t3"));
  TEST_ASSERT_EQUAL_PTR(&a1, reg.findActuator("o1"));
  TEST_ASSERT_NULL(reg.findActuator("nope"));
}

void test_registry_reading_propagates() {
  MockSensor s("t1", tempMeta());
  Registry reg;
  reg.add(&s);

  s.value = 42.5f;
  reg.tick();

  auto r = s.channel(0).reading;
  TEST_ASSERT_TRUE(r.valid);
  TEST_ASSERT_FLOAT_WITHIN(0.001f, 42.5f, r.value);
}

void test_registry_label_unset_by_default() {
  Registry reg;
  TEST_ASSERT_EQUAL_STRING("", reg.label("t1"));
}

void test_registry_label_get_set() {
  Registry reg;
  reg.setLabel("t1", "Maische");
  TEST_ASSERT_EQUAL_STRING("Maische", reg.label("t1"));
  TEST_ASSERT_EQUAL_STRING("", reg.label("unknown"));
}

void test_registry_label_overwrite() {
  Registry reg;
  reg.setLabel("t1", "Maische");
  reg.setLabel("t1", "Wuerze");
  TEST_ASSERT_EQUAL_STRING("Wuerze", reg.label("t1"));
}

void test_registry_label_clear() {
  Registry reg;
  reg.setLabel("t1", "Maische");
  reg.setLabel("t1", "");
  TEST_ASSERT_EQUAL_STRING("", reg.label("t1"));
}

void setUp() {}
void tearDown() {}

int main(int, char**) {
  UNITY_BEGIN();
  RUN_TEST(test_meta_kind_and_quantity);
  RUN_TEST(test_registry_tick_order_sensor_then_actuator);
  RUN_TEST(test_registry_find_by_id);
  RUN_TEST(test_registry_reading_propagates);
  RUN_TEST(test_registry_label_unset_by_default);
  RUN_TEST(test_registry_label_get_set);
  RUN_TEST(test_registry_label_overwrite);
  RUN_TEST(test_registry_label_clear);
  return UNITY_END();
}
