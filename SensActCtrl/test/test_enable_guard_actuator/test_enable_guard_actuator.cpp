#include <unity.h>

#include "actuators/EnableGuardActuator.h"
#include "../mocks/MockActuator.h"

using SensActCtrl::EnableGuardActuator;
using SensActCtrl::ActuatorMeta;
using SensActCtrl::ValueKind;
using SensActCtrl::Quantity;
using SensActCtrl::test::MockActuator;

static ActuatorMeta dutyMeta() {
  return ActuatorMeta{ValueKind::Continuous, Quantity::DutyCycle, "", 0.0f, 1.0f, 0.01f};
}

void test_enabled_by_default_passes_writes_through() {
  MockActuator inner("stirrer", dutyMeta());
  EnableGuardActuator guard(inner);

  TEST_ASSERT_TRUE(guard.enabled());
  guard.write(0.6f);
  TEST_ASSERT_EQUAL(1, inner.writes.size());
  TEST_ASSERT_FLOAT_WITHIN(0.001f, 0.6f, inner.writes.back());
}

void test_disable_drives_inner_to_min() {
  MockActuator inner("stirrer", dutyMeta());
  EnableGuardActuator guard(inner);

  guard.write(0.6f);
  guard.setEnabled(false);
  TEST_ASSERT_FALSE(guard.enabled());
  TEST_ASSERT_FLOAT_WITHIN(0.001f, 0.0f, inner.writes.back());  // meta().min == 0
}

void test_reenable_restores_last_target() {
  MockActuator inner("stirrer", dutyMeta());
  EnableGuardActuator guard(inner);

  guard.write(0.6f);
  guard.setEnabled(false);
  guard.setEnabled(true);
  TEST_ASSERT_TRUE(guard.enabled());
  TEST_ASSERT_FLOAT_WITHIN(0.001f, 0.6f, inner.writes.back());
}

void test_write_while_disabled_updates_target_but_not_inner() {
  MockActuator inner("stirrer", dutyMeta());
  EnableGuardActuator guard(inner);

  guard.write(0.6f);
  guard.setEnabled(false);
  guard.write(0.9f);  // slider moved while off — target updates, hw stays at min
  TEST_ASSERT_FLOAT_WITHIN(0.001f, 0.0f, inner.writes.back());

  guard.setEnabled(true);
  TEST_ASSERT_FLOAT_WITHIN(0.001f, 0.9f, inner.writes.back());  // resumes latest target
}

void test_redundant_set_enabled_is_a_no_op() {
  MockActuator inner("stirrer", dutyMeta());
  EnableGuardActuator guard(inner);

  guard.write(0.6f);
  size_t before = inner.writes.size();
  guard.setEnabled(true);  // already enabled — must not re-write
  TEST_ASSERT_EQUAL(before, inner.writes.size());
}

void test_id_meta_fault_state_forward_to_inner() {
  MockActuator inner("stirrer", dutyMeta());
  inner.faultMsg = "stalled";
  EnableGuardActuator guard(inner);

  guard.write(0.4f);
  TEST_ASSERT_EQUAL_STRING("stirrer", guard.id());
  TEST_ASSERT_EQUAL(static_cast<int>(ValueKind::Continuous), static_cast<int>(guard.meta().kind));
  TEST_ASSERT_EQUAL_STRING("stalled", guard.fault());
  TEST_ASSERT_FLOAT_WITHIN(0.001f, 0.4f, guard.state());
}

void test_tick_forwards_to_inner() {
  MockActuator inner("stirrer", dutyMeta());
  EnableGuardActuator guard(inner);

  guard.tick();
  guard.tick();
  TEST_ASSERT_EQUAL(2, inner.tickCount);
}

void setUp() {}
void tearDown() {}

int main(int, char**) {
  UNITY_BEGIN();
  RUN_TEST(test_enabled_by_default_passes_writes_through);
  RUN_TEST(test_disable_drives_inner_to_min);
  RUN_TEST(test_reenable_restores_last_target);
  RUN_TEST(test_write_while_disabled_updates_target_but_not_inner);
  RUN_TEST(test_redundant_set_enabled_is_a_no_op);
  RUN_TEST(test_id_meta_fault_state_forward_to_inner);
  RUN_TEST(test_tick_forwards_to_inner);
  return UNITY_END();
}
