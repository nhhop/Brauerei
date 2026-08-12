#include <unity.h>

#include <string.h>

#include "controllers/RateLimitedController.h"
#include "controllers/TwoPointController.h"
#include "controllers/PIDController.h"
#include "../mocks/MockSensor.h"
#include "../mocks/MockActuator.h"

using SensActCtrl::RateLimitedController;
using SensActCtrl::rateLimitedSetMillisForTest;
using SensActCtrl::TwoPointController;
using SensActCtrl::PIDController;
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
static ActuatorMeta dutyMeta() {
  return ActuatorMeta{ValueKind::Continuous, Quantity::DutyCycle, "", 0.0f, 1.0f, 0.01f};
}

void test_ramp_up_capped_at_rate() {
  MockSensor s("t", tempMeta());
  MockActuator a("h", switchMeta());
  TwoPointController inner("ctrl", s, a);
  RateLimitedController rl(inner, 0.1f);  // 0.1 units/sec

  rateLimitedSetMillisForTest(0);
  rl.setSetpoint(20.0f);
  rl.tick();  // first tick: snaps to 20 (initialized_)
  TEST_ASSERT_FLOAT_WITHIN(0.001f, 20.0f, rl.effectiveSetpoint());

  rl.setSetpoint(30.0f);  // target jumps, effective must not
  TEST_ASSERT_FLOAT_WITHIN(0.001f, 20.0f, rl.effectiveSetpoint());

  rateLimitedSetMillisForTest(10000);  // +10s
  rl.tick();
  TEST_ASSERT_FLOAT_WITHIN(0.001f, 21.0f, rl.effectiveSetpoint());
  TEST_ASSERT_FLOAT_WITHIN(0.001f, 30.0f, rl.setpoint());  // target unaffected
}

void test_ramp_down_capped_at_rate() {
  MockSensor s("t", tempMeta());
  MockActuator a("h", switchMeta());
  TwoPointController inner("ctrl", s, a);
  RateLimitedController rl(inner, 0.1f);

  rateLimitedSetMillisForTest(0);
  rl.setSetpoint(30.0f);
  rl.tick();  // snaps to 30

  rl.setSetpoint(20.0f);
  rateLimitedSetMillisForTest(10000);
  rl.tick();
  TEST_ASSERT_FLOAT_WITHIN(0.001f, 29.0f, rl.effectiveSetpoint());
}

void test_reaches_target_without_overshoot() {
  MockSensor s("t", tempMeta());
  MockActuator a("h", switchMeta());
  TwoPointController inner("ctrl", s, a);
  RateLimitedController rl(inner, 0.1f);

  rateLimitedSetMillisForTest(0);
  rl.setSetpoint(20.0f);
  rl.tick();

  rl.setSetpoint(20.3f);  // residual diff (0.3) smaller than one 10s step (1.0)
  rateLimitedSetMillisForTest(10000);
  rl.tick();
  TEST_ASSERT_FLOAT_WITHIN(0.0001f, 20.3f, rl.effectiveSetpoint());  // lands exactly

  rateLimitedSetMillisForTest(20000);  // one more tick — must not overshoot past target
  rl.tick();
  TEST_ASSERT_FLOAT_WITHIN(0.0001f, 20.3f, rl.effectiveSetpoint());
}

void test_first_setpoint_snaps_instantly() {
  MockSensor s("t", tempMeta());
  MockActuator a("h", switchMeta());
  TwoPointController inner("ctrl", s, a);
  RateLimitedController rl(inner, 0.01f);  // very slow rate

  rateLimitedSetMillisForTest(0);
  rl.setSetpoint(65.0f);
  rl.tick();
  TEST_ASSERT_FLOAT_WITHIN(0.001f, 65.0f, rl.effectiveSetpoint());
}

void test_setpoint_returns_target_not_effective() {
  MockSensor s("t", tempMeta());
  MockActuator a("h", switchMeta());
  TwoPointController inner("ctrl", s, a);
  RateLimitedController rl(inner, 0.1f);

  rateLimitedSetMillisForTest(0);
  rl.setSetpoint(20.0f);
  rl.tick();

  rl.setSetpoint(30.0f);
  rateLimitedSetMillisForTest(1000);  // small tick — effective lags behind
  rl.tick();
  TEST_ASSERT_FLOAT_WITHIN(0.001f, 30.0f, rl.setpoint());
  TEST_ASSERT_TRUE(rl.effectiveSetpoint() < 30.0f);
}

void test_zero_rate_means_unlimited() {
  MockSensor s("t", tempMeta());
  MockActuator a("h", switchMeta());
  TwoPointController inner("ctrl", s, a);
  RateLimitedController rl(inner, 0.0f);

  rateLimitedSetMillisForTest(0);
  rl.setSetpoint(20.0f);
  rl.tick();

  rl.setSetpoint(90.0f);
  rateLimitedSetMillisForTest(1000);
  rl.tick();
  TEST_ASSERT_FLOAT_WITHIN(0.001f, 90.0f, rl.effectiveSetpoint());  // instant snap
}

void test_enabled_forwards_to_inner() {
  MockSensor s("t", tempMeta());
  MockActuator a("h", switchMeta());
  TwoPointController inner("ctrl", s, a);
  RateLimitedController rl(inner, 0.0f);

  TEST_ASSERT_TRUE(rl.enabled());
  rl.setEnabled(false);
  TEST_ASSERT_FALSE(inner.enabled());
  TEST_ASSERT_FALSE(rl.enabled());

  // Inner's own fail-safe (TwoPoint has no explicit "disabled" tick guard —
  // enabled() gating is a Controller-level concern the caller respects, not
  // enforced inside TwoPointController::tick()). Verify tick() still runs
  // through to inner without crashing/asserting when disabled.
  rateLimitedSetMillisForTest(0);
  rl.setSetpoint(20.0f);
  rl.tick();
  TEST_ASSERT_FLOAT_WITHIN(0.001f, 20.0f, rl.effectiveSetpoint());
}

void test_params_json_merges_inner_and_own_fields() {
  MockSensor s("t", tempMeta());
  MockActuator a("h", switchMeta());
  TwoPointController inner("ctrl", s, a);
  inner.setHysteresis(-1.0f, 1.0f);
  RateLimitedController rl(inner, 0.25f);

  rateLimitedSetMillisForTest(0);
  rl.setSetpoint(20.0f);
  rl.tick();

  char buf[512];
  size_t n = rl.paramsJson(buf, sizeof(buf));
  TEST_ASSERT_GREATER_THAN(0, n);
  TEST_ASSERT_NOT_NULL(strstr(buf, "\"hystLow\":-1.0000"));
  TEST_ASSERT_NOT_NULL(strstr(buf, "\"hystHigh\":1.0000"));
  TEST_ASSERT_NOT_NULL(strstr(buf, "\"maxRatePerSec\":0.2500"));
  TEST_ASSERT_NOT_NULL(strstr(buf, "\"effectiveSetpoint\":20.0000"));
  // Must still be well-formed JSON: exactly one trailing '}', no stray one
  // left over from the splice.
  TEST_ASSERT_EQUAL('}', buf[n - 1]);
}

void test_set_params_json_updates_rate_and_forwards_to_inner() {
  MockSensor s("t", tempMeta());
  MockActuator a("h", switchMeta());
  TwoPointController inner("ctrl", s, a);
  RateLimitedController rl(inner, 0.1f);

  TEST_ASSERT_TRUE(rl.setParamsJson("{\"maxRatePerSec\":0.2,\"hystLow\":-1.0}"));
  TEST_ASSERT_FLOAT_WITHIN(0.001f, 0.2f, rl.maxRatePerSec());
  TEST_ASSERT_FLOAT_WITHIN(0.001f, -1.0f, inner.hysteresisLow());
}

void test_wraps_pid_smoke() {
  MockSensor s("t", tempMeta());
  MockActuator a("h", dutyMeta());
  PIDController pid("ctrl", s, a, 0.0f, 1.0f);
  pid.setTunings(2.0f, 0.0f, 0.0f);  // pure proportional, easy to reason about
  RateLimitedController rl(pid, 0.0f);  // unlimited — isolate begin()/tick() forwarding

  rl.begin();  // must forward to pid.begin(), else engine gains never applied
  rl.setSetpoint(25.0f);

  s.value = 20.0f;  // 5 below setpoint
  s.valid = true;
  s.tick();
  rl.tick();
  TEST_ASSERT_TRUE(a.writes.size() > 0);
  TEST_ASSERT_TRUE(a.writes.back() > 0.0f);  // proportional term drove output up
}

void test_id_forwards_to_inner() {
  MockSensor s("t", tempMeta());
  MockActuator a("h", switchMeta());
  TwoPointController inner("my_ctrl_id", s, a);
  RateLimitedController rl(inner, 0.1f);
  TEST_ASSERT_EQUAL_STRING(inner.id(), rl.id());
}

void setUp() { rateLimitedSetMillisForTest(0); }
void tearDown() {}

int main(int, char**) {
  UNITY_BEGIN();
  RUN_TEST(test_ramp_up_capped_at_rate);
  RUN_TEST(test_ramp_down_capped_at_rate);
  RUN_TEST(test_reaches_target_without_overshoot);
  RUN_TEST(test_first_setpoint_snaps_instantly);
  RUN_TEST(test_setpoint_returns_target_not_effective);
  RUN_TEST(test_zero_rate_means_unlimited);
  RUN_TEST(test_enabled_forwards_to_inner);
  RUN_TEST(test_params_json_merges_inner_and_own_fields);
  RUN_TEST(test_set_params_json_updates_rate_and_forwards_to_inner);
  RUN_TEST(test_wraps_pid_smoke);
  RUN_TEST(test_id_forwards_to_inner);
  return UNITY_END();
}
