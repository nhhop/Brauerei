#include <unity.h>

#include <string>
#include <vector>

#include "ProgramRamp.h"

using BrewControl::TargetCmd;
using BrewControl::rampFrom;
using BrewControl::rampShouldWrite;
using BrewControl::rampValue;
using BrewControl::rampedV;

namespace {

// Minimal stand-in for ProgramStep — the ramp only needs targets and rampSec.
struct Step {
  std::vector<TargetCmd> targets;
  uint32_t rampSec = 0;
};

TargetCmd v(const char* id, float value) {
  TargetCmd c;
  c.id   = id;
  c.hasV = true;
  c.v    = value;
  return c;
}

TargetCmd enabled(const char* id, bool on) {
  TargetCmd c;
  c.id         = id;
  c.hasEnabled = true;
  c.enabled    = on;
  return c;
}

const uint32_t DAY = 86400;

}  // namespace

void test_value_is_linear_and_ends_on_target() {
  TEST_ASSERT_FLOAT_WITHIN(0.001f, 12.0f, rampValue(12, 18, 0, 2 * DAY));
  TEST_ASSERT_FLOAT_WITHIN(0.001f, 15.0f, rampValue(12, 18, DAY, 2 * DAY));
  TEST_ASSERT_EQUAL_FLOAT(18.0f, rampValue(12, 18, 2 * DAY, 2 * DAY));
  TEST_ASSERT_EQUAL_FLOAT(18.0f, rampValue(12, 18, 5 * DAY, 2 * DAY));
  TEST_ASSERT_FLOAT_WITHIN(0.001f, 4.5f, rampValue(18, 0, 3 * DAY, 4 * DAY));  // downwards
  TEST_ASSERT_EQUAL_FLOAT(18.0f, rampValue(12, 18, 0, 0));  // no ramp: jump
}

void test_from_is_the_last_earlier_v() {
  std::vector<Step> steps = {
      {{v("gaer", 12), enabled("gaer", true)}},
      {{enabled("pumpe", true)}},
      {{v("gaer", 18)}, 2 * DAY},
  };
  float from = 0;
  TEST_ASSERT_TRUE(rampFrom(steps, 2, "gaer", from));
  TEST_ASSERT_EQUAL_FLOAT(12.0f, from);
  TEST_ASSERT_FALSE(rampFrom(steps, 0, "gaer", from));   // nothing before step 0
  TEST_ASSERT_FALSE(rampFrom(steps, 2, "pumpe", from));  // never got a v
}

void test_ramped_v_without_earlier_value_jumps() {
  std::vector<Step> steps = {{{v("gaer", 18)}, 2 * DAY}};
  TEST_ASSERT_EQUAL_FLOAT(18.0f, rampedV(steps, 0, steps[0].targets[0], 0));
}

void test_ramped_v_follows_elapsed_time() {
  std::vector<Step> steps = {{{v("gaer", 12)}}, {{v("gaer", 18)}, 2 * DAY}};
  const TargetCmd& c = steps[1].targets[0];
  TEST_ASSERT_EQUAL_FLOAT(12.0f, rampedV(steps, 1, c, 0));
  TEST_ASSERT_FLOAT_WITHIN(0.001f, 13.5f, rampedV(steps, 1, c, DAY / 2));
  TEST_ASSERT_EQUAL_FLOAT(18.0f, rampedV(steps, 1, c, UINT32_MAX));  // awaiting / done
}

void test_step_without_ramp_keeps_its_v() {
  std::vector<Step> steps = {{{v("gaer", 12)}}, {{v("gaer", 18)}}};
  TEST_ASSERT_EQUAL_FLOAT(18.0f, rampedV(steps, 1, steps[1].targets[0], 0));
}

// A dry hop splits a 2-day ramp 12 → 18 °C after one day: the first part ends
// at 15 °C, the second starts there.
void test_piecewise_ramp_over_two_steps() {
  std::vector<Step> steps = {
      {{v("gaer", 12)}},
      {{v("gaer", 15)}, DAY},
      {{v("gaer", 18)}, DAY},
  };
  TEST_ASSERT_EQUAL_FLOAT(12.0f, rampedV(steps, 1, steps[1].targets[0], 0));
  TEST_ASSERT_EQUAL_FLOAT(15.0f, rampedV(steps, 1, steps[1].targets[0], DAY));
  TEST_ASSERT_EQUAL_FLOAT(15.0f, rampedV(steps, 2, steps[2].targets[0], 0));
  TEST_ASSERT_FLOAT_WITHIN(0.001f, 16.5f, rampedV(steps, 2, steps[2].targets[0], DAY / 2));
}

void test_write_threshold() {
  TEST_ASSERT_FALSE(rampShouldWrite(12.0f, 12.04f, 18.0f));
  TEST_ASSERT_TRUE(rampShouldWrite(12.0f, 12.05f, 18.0f));
  TEST_ASSERT_TRUE(rampShouldWrite(11.0f, 10.9f, 0.0f));   // downwards
  TEST_ASSERT_TRUE(rampShouldWrite(17.98f, 18.0f, 18.0f)); // lands on the target
  TEST_ASSERT_FALSE(rampShouldWrite(18.0f, 18.0f, 18.0f));
}

void setUp(void) {}
void tearDown(void) {}

int main(int, char**) {
  UNITY_BEGIN();
  RUN_TEST(test_value_is_linear_and_ends_on_target);
  RUN_TEST(test_from_is_the_last_earlier_v);
  RUN_TEST(test_ramped_v_without_earlier_value_jumps);
  RUN_TEST(test_ramped_v_follows_elapsed_time);
  RUN_TEST(test_step_without_ramp_keeps_its_v);
  RUN_TEST(test_piecewise_ramp_over_two_steps);
  RUN_TEST(test_write_threshold);
  return UNITY_END();
}
