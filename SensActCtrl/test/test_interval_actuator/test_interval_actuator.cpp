#include <unity.h>

#include "actuators/IntervalActuator.h"
#include "../mocks/MockActuator.h"

using SensActCtrl::IntervalActuator;
using SensActCtrl::intervalActuatorSetMillisForTest;
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
  TEST_ASSERT_FLOAT_WITHIN(0.001f, 0.7f, inner.output());

  intervalActuatorSetMillisForTest(59000);  // still within the 60s cycle
  iv.tick();
  TEST_ASSERT_FLOAT_WITHIN(0.001f, 0.7f, inner.output());
}

void test_always_off_when_on_is_zero() {
  MockActuator inner("m", dutyMeta());
  IntervalActuator iv(inner, /*onSec*/0, /*periodSec*/60);

  intervalActuatorSetMillisForTest(0);
  iv.tick();  // first tick already detects the off-phase
  TEST_ASSERT_FLOAT_WITHIN(0.001f, 0.0f, inner.output());  // meta().min

  iv.write(0.9f);  // slider moved while off-schedule — target updates, hw stays at min
  TEST_ASSERT_FLOAT_WITHIN(0.001f, 0.0f, inner.output());
}

void test_phase_flips_at_on_boundary_60s_cycle() {
  MockActuator inner("m", dutyMeta());
  IntervalActuator iv(inner, /*onSec*/20, /*periodSec*/60);

  intervalActuatorSetMillisForTest(0);
  iv.write(0.5f);
  iv.tick();
  TEST_ASSERT_FLOAT_WITHIN(0.001f, 0.5f, inner.output());  // on-phase

  intervalActuatorSetMillisForTest(19999);
  iv.tick();
  TEST_ASSERT_FLOAT_WITHIN(0.001f, 0.5f, inner.output());  // still on

  intervalActuatorSetMillisForTest(20000);
  iv.tick();
  TEST_ASSERT_FLOAT_WITHIN(0.001f, 0.0f, inner.output());  // off now

  intervalActuatorSetMillisForTest(59999);
  iv.tick();
  TEST_ASSERT_FLOAT_WITHIN(0.001f, 0.0f, inner.output());  // still off

  intervalActuatorSetMillisForTest(60000);  // new cycle
  iv.tick();
  TEST_ASSERT_FLOAT_WITHIN(0.001f, 0.5f, inner.output());  // back on
}

void test_phase_flips_at_on_boundary_3600s_cycle() {
  MockActuator inner("m", dutyMeta());
  IntervalActuator iv(inner, /*onSec*/1500, /*periodSec*/3600);  // 25/35 split

  intervalActuatorSetMillisForTest(0);
  iv.write(1.0f);
  iv.tick();
  TEST_ASSERT_FLOAT_WITHIN(0.001f, 1.0f, inner.output());

  intervalActuatorSetMillisForTest(1500u * 1000u - 1);
  iv.tick();
  TEST_ASSERT_FLOAT_WITHIN(0.001f, 1.0f, inner.output());

  intervalActuatorSetMillisForTest(1500u * 1000u);
  iv.tick();
  TEST_ASSERT_FLOAT_WITHIN(0.001f, 0.0f, inner.output());

  intervalActuatorSetMillisForTest(3600u * 1000u);
  iv.tick();
  TEST_ASSERT_FLOAT_WITHIN(0.001f, 1.0f, inner.output());
}

void test_set_interval_changes_schedule_live() {
  MockActuator inner("m", dutyMeta());
  IntervalActuator iv(inner, /*onSec*/10, /*periodSec*/60);

  intervalActuatorSetMillisForTest(0);
  iv.write(0.4f);
  iv.tick();  // on-phase, writes 0.4

  intervalActuatorSetMillisForTest(15000);  // past the 10s on-window
  iv.tick();  // flips off under the old schedule
  TEST_ASSERT_FLOAT_WITHIN(0.001f, 0.0f, inner.output());

  iv.setInterval(20, 60);  // widen on-window to 20s — elapsed(15s) is inside it again
  iv.tick();
  TEST_ASSERT_FLOAT_WITHIN(0.001f, 0.4f, inner.output());  // flips back on, no cycle reset needed
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

void test_target_survives_phase_flips() {
  MockActuator inner("m", dutyMeta());
  IntervalActuator iv(inner, /*onSec*/20, /*periodSec*/60);

  intervalActuatorSetMillisForTest(0);
  iv.write(0.5f);
  iv.tick();
  TEST_ASSERT_FLOAT_WITHIN(0.001f, 0.5f, iv.target());

  intervalActuatorSetMillisForTest(20000);
  iv.tick();  // off-phase
  TEST_ASSERT_FLOAT_WITHIN(0.001f, 0.0f, iv.state());   // hw off …
  TEST_ASSERT_FLOAT_WITHIN(0.001f, 0.5f, iv.target());  // … slider unmoved

  intervalActuatorSetMillisForTest(60000);
  iv.tick();  // back on
  TEST_ASSERT_FLOAT_WITHIN(0.001f, 0.5f, iv.target());
}

// ── Master switch, which now lives on the wrapped actuator itself ────────

void test_enabled_forwards_to_inner() {
  MockActuator inner("m", dutyMeta());
  IntervalActuator iv(inner, 10, 60);

  TEST_ASSERT_TRUE(iv.enabled());
  iv.setEnabled(false);
  TEST_ASSERT_FALSE(inner.enabled());
  TEST_ASSERT_FALSE(iv.enabled());
}

void test_master_disable_forces_off_regardless_of_interval_phase() {
  MockActuator inner("m", dutyMeta());
  IntervalActuator iv(inner, /*onSec*/60, /*periodSec*/60);  // always on-phase

  intervalActuatorSetMillisForTest(0);
  iv.write(0.8f);
  iv.tick();
  TEST_ASSERT_FLOAT_WITHIN(0.001f, 0.8f, inner.output());

  iv.setEnabled(false);
  TEST_ASSERT_FLOAT_WITHIN(0.001f, 0.0f, inner.output());  // off despite always-on schedule
  TEST_ASSERT_FLOAT_WITHIN(0.001f, 0.8f, iv.target());     // slider still shows what the user set
}

// The schedule keeps ticking while disabled; the gate lives in the concrete
// actuator, so a phase flip back to "on" must not reach the hardware.
void test_disabled_master_survives_an_interval_phase_flip_back_on() {
  MockActuator inner("m", dutyMeta());
  IntervalActuator iv(inner, /*onSec*/20, /*periodSec*/60);

  intervalActuatorSetMillisForTest(0);
  iv.write(0.8f);
  iv.tick();
  TEST_ASSERT_FLOAT_WITHIN(0.001f, 0.8f, inner.output());

  iv.setEnabled(false);
  TEST_ASSERT_FLOAT_WITHIN(0.001f, 0.0f, inner.output());

  intervalActuatorSetMillisForTest(20000);
  iv.tick();  // flips off while disabled
  TEST_ASSERT_FLOAT_WITHIN(0.001f, 0.0f, inner.output());

  intervalActuatorSetMillisForTest(60000);
  iv.tick();  // flips back ON while still disabled — must stay off
  TEST_ASSERT_FLOAT_WITHIN(0.001f, 0.0f, inner.output());
  TEST_ASSERT_FLOAT_WITHIN(0.001f, 0.8f, iv.target());
}

// Regression: re-enabling used to wait out the remainder of the off-window
// (reported as a 3-4 second delay on real hardware).
void test_reenable_restarts_the_cycle_and_switches_immediately() {
  MockActuator inner("m", dutyMeta());
  IntervalActuator iv(inner, /*onSec*/20, /*periodSec*/60);

  intervalActuatorSetMillisForTest(0);
  iv.write(0.6f);
  iv.tick();  // on-phase

  intervalActuatorSetMillisForTest(30000);
  iv.tick();  // deep inside the off-window
  TEST_ASSERT_FLOAT_WITHIN(0.001f, 0.0f, inner.output());

  iv.setEnabled(false);
  iv.setEnabled(true);  // user flips the switch back on, mid off-window
  TEST_ASSERT_FLOAT_WITHIN(0.001f, 0.6f, inner.output());  // immediate, no waiting

  // …and the restarted cycle runs a full on-window from here.
  intervalActuatorSetMillisForTest(49999);
  iv.tick();
  TEST_ASSERT_FLOAT_WITHIN(0.001f, 0.6f, inner.output());
  intervalActuatorSetMillisForTest(50000);
  iv.tick();
  TEST_ASSERT_FLOAT_WITHIN(0.001f, 0.0f, inner.output());
}

void test_reenable_on_a_permanently_off_schedule_stays_off() {
  MockActuator inner("m", dutyMeta());
  IntervalActuator iv(inner, /*onSec*/0, /*periodSec*/60);  // never on

  intervalActuatorSetMillisForTest(0);
  iv.write(0.6f);
  iv.tick();
  TEST_ASSERT_FLOAT_WITHIN(0.001f, 0.0f, inner.output());

  iv.setEnabled(false);
  iv.setEnabled(true);
  // No on-window exists to restart into, so the schedule keeps winning.
  TEST_ASSERT_FLOAT_WITHIN(0.001f, 0.0f, inner.output());
  TEST_ASSERT_FLOAT_WITHIN(0.001f, 0.6f, iv.target());
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
  RUN_TEST(test_target_survives_phase_flips);
  RUN_TEST(test_enabled_forwards_to_inner);
  RUN_TEST(test_master_disable_forces_off_regardless_of_interval_phase);
  RUN_TEST(test_disabled_master_survives_an_interval_phase_flip_back_on);
  RUN_TEST(test_reenable_restarts_the_cycle_and_switches_immediately);
  RUN_TEST(test_reenable_on_a_permanently_off_schedule_stays_off);
  return UNITY_END();
}
