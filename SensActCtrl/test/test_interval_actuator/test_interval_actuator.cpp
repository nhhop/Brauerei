#include <unity.h>

#include "actuators/IntervalActuator.h"
#include "actuators/EnableGuardActuator.h"
#include "../mocks/MockActuator.h"

using SensActCtrl::IntervalActuator;
using SensActCtrl::intervalActuatorSetMillisForTest;
using SensActCtrl::EnableGuardActuator;
using SensActCtrl::ActuatorMeta;
using SensActCtrl::ValueKind;
using SensActCtrl::Quantity;
using SensActCtrl::test::MockActuator;

static ActuatorMeta dutyMeta() {
  return ActuatorMeta{ValueKind::Continuous, Quantity::DutyCycle, "", 0.0f, 1.0f, 0.01f};
}

// ── Isolated behavior ────────────────────────────────────────────────────

void test_always_on_when_on_equals_period() {
  MockActuator inner("m", dutyMeta());
  IntervalActuator iv(inner, /*onSec*/60, /*periodSec*/60);

  intervalActuatorSetMillisForTest(0);
  iv.write(0.7f);
  iv.tick();
  TEST_ASSERT_FLOAT_WITHIN(0.001f, 0.7f, inner.writes.back());

  intervalActuatorSetMillisForTest(59000);  // still within the 60s cycle
  iv.tick();
  TEST_ASSERT_FLOAT_WITHIN(0.001f, 0.7f, inner.writes.back());
}

void test_always_off_when_on_is_zero() {
  MockActuator inner("m", dutyMeta());
  IntervalActuator iv(inner, /*onSec*/0, /*periodSec*/60);

  intervalActuatorSetMillisForTest(0);
  iv.tick();  // first tick already detects the off-phase
  TEST_ASSERT_FLOAT_WITHIN(0.001f, 0.0f, inner.writes.back());  // meta().min

  iv.write(0.9f);  // slider moved while off-schedule — target updates, hw stays at min
  TEST_ASSERT_FLOAT_WITHIN(0.001f, 0.0f, inner.writes.back());
}

void test_phase_flips_at_on_boundary_60s_cycle() {
  MockActuator inner("m", dutyMeta());
  IntervalActuator iv(inner, /*onSec*/20, /*periodSec*/60);

  intervalActuatorSetMillisForTest(0);
  iv.write(0.5f);
  iv.tick();
  TEST_ASSERT_FLOAT_WITHIN(0.001f, 0.5f, inner.writes.back());  // on-phase

  intervalActuatorSetMillisForTest(19999);
  iv.tick();
  TEST_ASSERT_FLOAT_WITHIN(0.001f, 0.5f, inner.writes.back());  // still on

  intervalActuatorSetMillisForTest(20000);
  iv.tick();
  TEST_ASSERT_FLOAT_WITHIN(0.001f, 0.0f, inner.writes.back());  // off now

  intervalActuatorSetMillisForTest(59999);
  iv.tick();
  TEST_ASSERT_FLOAT_WITHIN(0.001f, 0.0f, inner.writes.back());  // still off

  intervalActuatorSetMillisForTest(60000);  // new cycle
  iv.tick();
  TEST_ASSERT_FLOAT_WITHIN(0.001f, 0.5f, inner.writes.back());  // back on
}

void test_phase_flips_at_on_boundary_3600s_cycle() {
  MockActuator inner("m", dutyMeta());
  IntervalActuator iv(inner, /*onSec*/1500, /*periodSec*/3600);  // 25/35 split

  intervalActuatorSetMillisForTest(0);
  iv.write(1.0f);
  iv.tick();
  TEST_ASSERT_FLOAT_WITHIN(0.001f, 1.0f, inner.writes.back());

  intervalActuatorSetMillisForTest(1500u * 1000u - 1);
  iv.tick();
  TEST_ASSERT_FLOAT_WITHIN(0.001f, 1.0f, inner.writes.back());

  intervalActuatorSetMillisForTest(1500u * 1000u);
  iv.tick();
  TEST_ASSERT_FLOAT_WITHIN(0.001f, 0.0f, inner.writes.back());

  intervalActuatorSetMillisForTest(3600u * 1000u);
  iv.tick();
  TEST_ASSERT_FLOAT_WITHIN(0.001f, 1.0f, inner.writes.back());
}

void test_set_interval_changes_schedule_live() {
  MockActuator inner("m", dutyMeta());
  IntervalActuator iv(inner, /*onSec*/10, /*periodSec*/60);

  intervalActuatorSetMillisForTest(0);
  iv.write(0.4f);
  iv.tick();  // on-phase, writes 0.4

  intervalActuatorSetMillisForTest(15000);  // past the 10s on-window
  iv.tick();  // flips off under the old schedule
  TEST_ASSERT_FLOAT_WITHIN(0.001f, 0.0f, inner.writes.back());

  iv.setInterval(20, 60);  // widen on-window to 20s — elapsed(15s) is inside it again
  iv.tick();
  TEST_ASSERT_FLOAT_WITHIN(0.001f, 0.4f, inner.writes.back());  // flips back on, no cycle reset needed
}

void test_set_interval_clamps_on_to_period() {
  MockActuator inner("m", dutyMeta());
  IntervalActuator iv(inner, /*onSec*/10, /*periodSec*/60);

  iv.setInterval(999, 30);  // onSec > periodSec
  auto cfg = iv.interval();
  TEST_ASSERT_EQUAL_UINT32(30u, cfg.periodSec);
  TEST_ASSERT_EQUAL_UINT32(30u, cfg.onSec);
}

void test_id_meta_fault_state_forward_to_inner() {
  MockActuator inner("stirrer", dutyMeta());
  inner.faultMsg = "jammed";
  IntervalActuator iv(inner, 30, 60);

  intervalActuatorSetMillisForTest(0);
  iv.write(0.4f);
  TEST_ASSERT_EQUAL_STRING("stirrer", iv.id());
  TEST_ASSERT_EQUAL(static_cast<int>(ValueKind::Continuous), static_cast<int>(iv.meta().kind));
  TEST_ASSERT_EQUAL_STRING("jammed", iv.fault());
  TEST_ASSERT_FLOAT_WITHIN(0.001f, 0.4f, iv.state());
}

void test_tick_forwards_to_inner() {
  MockActuator inner("m", dutyMeta());
  IntervalActuator iv(inner, 30, 60);

  intervalActuatorSetMillisForTest(0);
  iv.tick();
  iv.tick();
  TEST_ASSERT_EQUAL(2, inner.tickCount);
}

void test_interval_reports_has_true() {
  MockActuator inner("m", dutyMeta());
  IntervalActuator iv(inner, 25, 60);

  auto cfg = iv.interval();
  TEST_ASSERT_TRUE(cfg.has);
  TEST_ASSERT_EQUAL_UINT32(25u, cfg.onSec);
  TEST_ASSERT_EQUAL_UINT32(60u, cfg.periodSec);
}

// ── Composition, matching production wrap order: Enable(outer) → Interval(inner) ──

void test_enable_guard_forwards_interval_getter_and_setter() {
  MockActuator inner("m", dutyMeta());
  IntervalActuator iv(inner, 10, 60);
  EnableGuardActuator guard(iv);

  auto cfg = guard.interval();
  TEST_ASSERT_TRUE(cfg.has);
  TEST_ASSERT_EQUAL_UINT32(10u, cfg.onSec);

  guard.setInterval(45, 90);
  TEST_ASSERT_EQUAL_UINT32(45u, iv.interval().onSec);
  TEST_ASSERT_EQUAL_UINT32(90u, iv.interval().periodSec);
}

void test_master_disable_forces_off_regardless_of_interval_phase() {
  MockActuator inner("m", dutyMeta());
  IntervalActuator iv(inner, /*onSec*/60, /*periodSec*/60);  // always on-phase
  EnableGuardActuator guard(iv);

  intervalActuatorSetMillisForTest(0);
  guard.write(0.8f);
  iv.tick();  // let the interval layer actually drive inner once
  TEST_ASSERT_FLOAT_WITHIN(0.001f, 0.8f, inner.writes.back());

  guard.setEnabled(false);
  TEST_ASSERT_FLOAT_WITHIN(0.001f, 0.0f, inner.writes.back());  // forced off despite always-on schedule
}

void test_reenable_during_interval_off_phase_stays_off() {
  MockActuator inner("m", dutyMeta());
  IntervalActuator iv(inner, /*onSec*/0, /*periodSec*/60);  // always off-phase
  EnableGuardActuator guard(iv);

  intervalActuatorSetMillisForTest(0);
  guard.write(0.6f);
  iv.tick();
  TEST_ASSERT_FLOAT_WITHIN(0.001f, 0.0f, inner.writes.back());  // interval keeps it off

  guard.setEnabled(false);
  guard.setEnabled(true);
  // Re-enabling replays the target into IntervalActuator, which itself is
  // still in its off-phase — must not force the actuator on.
  TEST_ASSERT_FLOAT_WITHIN(0.001f, 0.0f, inner.writes.back());
}

void setUp() {}
void tearDown() {}

int main(int, char**) {
  UNITY_BEGIN();
  RUN_TEST(test_always_on_when_on_equals_period);
  RUN_TEST(test_always_off_when_on_is_zero);
  RUN_TEST(test_phase_flips_at_on_boundary_60s_cycle);
  RUN_TEST(test_phase_flips_at_on_boundary_3600s_cycle);
  RUN_TEST(test_set_interval_changes_schedule_live);
  RUN_TEST(test_set_interval_clamps_on_to_period);
  RUN_TEST(test_id_meta_fault_state_forward_to_inner);
  RUN_TEST(test_tick_forwards_to_inner);
  RUN_TEST(test_interval_reports_has_true);
  RUN_TEST(test_enable_guard_forwards_interval_getter_and_setter);
  RUN_TEST(test_master_disable_forces_off_regardless_of_interval_phase);
  RUN_TEST(test_reenable_during_interval_off_phase_stays_off);
  return UNITY_END();
}
