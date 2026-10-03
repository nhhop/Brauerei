#include <unity.h>

#include <cmath>

#include "LevelBubble.h"

using namespace BrewControl;

void test_level_sits_in_the_middle() {
  const LevelBubble b = levelBubble(0, 0);
  TEST_ASSERT_TRUE(b.valid);
  TEST_ASSERT_TRUE(b.level);
  TEST_ASSERT_FALSE(b.atRim);
  TEST_ASSERT_EQUAL_FLOAT(0.0f, b.x);
  TEST_ASSERT_EQUAL_FLOAT(0.0f, b.y);
  TEST_ASSERT_TRUE(std::isnan(b.dirDeg));
}

// Y side up (roll > 0) -> right; -X side up (pitch > 0) -> up. Half of the fine
// scale (7.5 of 15 degrees) is 0.3 of the radius.
void test_bubble_goes_to_the_high_side() {
  LevelBubble b = levelBubble(7.5f, 0);
  TEST_ASSERT_FLOAT_WITHIN(1e-4f, 0.3f, b.x);
  TEST_ASSERT_FLOAT_WITHIN(1e-4f, 0.0f, b.y);
  b = levelBubble(0, 7.5f);
  TEST_ASSERT_FLOAT_WITHIN(1e-4f, 0.0f, b.x);
  TEST_ASSERT_FLOAT_WITHIN(1e-4f, 0.3f, b.y);
}

void test_fine_scale_ends_at_60_percent_and_the_rim_is_45_degrees() {
  TEST_ASSERT_FLOAT_WITHIN(1e-4f, 0.6f, levelBubble(15, 0).x);
  TEST_ASSERT_FLOAT_WITHIN(1e-4f, 0.8f, levelBubble(30, 0).x);  // halfway through the outer part
  const LevelBubble rim = levelBubble(45, 0);
  TEST_ASSERT_FLOAT_WITHIN(1e-4f, 1.0f, rim.x);
  TEST_ASSERT_FALSE(rim.atRim);  // exactly at the rim is not beyond it
}

void test_bubble_keeps_moving_between_15_and_45_degrees() {
  float prev = levelBubble(15, 0).x;
  for (float a = 20; a <= 45; a += 5) {
    const float x = levelBubble(a, 0).x;
    TEST_ASSERT_TRUE(x > prev);
    prev = x;
  }
}

// Beyond the rim the lean is clamped by its length (1), not per axis (sqrt 2).
void test_clamp_is_radial() {
  const LevelBubble b = levelBubble(50, 50);
  TEST_ASSERT_TRUE(b.atRim);
  TEST_ASSERT_FLOAT_WITHIN(1e-4f, 1.0f, std::hypot(b.x, b.y));
  TEST_ASSERT_FLOAT_WITHIN(1e-4f, b.x, b.y);  // 45 deg: equal parts
}

void test_direction_is_the_clockwise_bearing_from_the_top() {
  TEST_ASSERT_FLOAT_WITHIN(0.01f, 0.0f,   levelBubble(0, 5).dirDeg);    // -X up
  TEST_ASSERT_FLOAT_WITHIN(0.01f, 90.0f,  levelBubble(5, 0).dirDeg);    // Y up
  TEST_ASSERT_FLOAT_WITHIN(0.01f, 180.0f, levelBubble(0, -5).dirDeg);   // X up
  TEST_ASSERT_FLOAT_WITHIN(0.01f, 270.0f, levelBubble(-5, 0).dirDeg);   // -Y up
  TEST_ASSERT_FLOAT_WITHIN(0.01f, 45.0f,  levelBubble(5, 5).dirDeg);
}

// The same bearing as the bubble's position, read off the screen - also on the
// squeezed part of the scale.
void test_direction_matches_the_bubble_position() {
  const LevelBubble b = levelBubble(20, 12);
  float bearing = std::atan2(b.x, b.y) * 57.29577951308232f;  // clockwise from up
  if (bearing < 0) bearing += 360.0f;
  TEST_ASSERT_FLOAT_WITHIN(0.01f, bearing, b.dirDeg);
}

void test_tolerance_and_undefined_direction() {
  TEST_ASSERT_TRUE(levelBubble(1.0f, 0).level);
  TEST_ASSERT_FALSE(levelBubble(1.01f, 0).level);
  TEST_ASSERT_TRUE(std::isnan(levelBubble(0.49f, 0).dirDeg));
  TEST_ASSERT_FALSE(std::isnan(levelBubble(0.5f, 0).dirDeg));
}

void test_invalid_input() {
  TEST_ASSERT_FALSE(levelBubble(NAN, 0).valid);
  TEST_ASSERT_FALSE(levelBubble(0, INFINITY).valid);
}

// ── Straight level ───────────────────────────────────────────────────────────

// The axis that is not dominant is the one left to level.
void test_straight_shows_the_axis_that_is_not_dominant_pitch_on_a_tie() {
  LevelStraight s = levelStraight(10, 60);  // Nick dominates -> Roll
  TEST_ASSERT_FALSE(s.axisIsPitch);
  TEST_ASSERT_EQUAL_FLOAT(10.0f, s.valueDeg);
  s = levelStraight(-70, 20);               // Roll dominates -> Nick
  TEST_ASSERT_TRUE(s.axisIsPitch);
  TEST_ASSERT_EQUAL_FLOAT(20.0f, s.valueDeg);
  TEST_ASSERT_TRUE(levelStraight(30, 30).axisIsPitch);
}

void test_straight_uses_the_fine_scale_of_the_round_glass() {
  TEST_ASSERT_FLOAT_WITHIN(1e-4f, 0.3f, levelStraight(7.5f, 80).x);
  TEST_ASSERT_FLOAT_WITHIN(1e-4f, 0.6f, levelStraight(15, 80).x);
  TEST_ASSERT_FLOAT_WITHIN(1e-4f, -0.8f, levelStraight(-30, 80).x);
  TEST_ASSERT_FLOAT_WITHIN(1e-4f, 1.0f, levelStraight(80, 45).x);
  TEST_ASSERT_FLOAT_WITHIN(1e-4f, 0.0f, levelStraight(0, 80).x);
}

void test_straight_is_level_and_upright() {
  TEST_ASSERT_TRUE(levelStraight(1, 80).level);
  TEST_ASSERT_FALSE(levelStraight(1.01f, 80).level);
  TEST_ASSERT_TRUE(levelStraight(2, 89).upright);
  TEST_ASSERT_TRUE(levelStraight(-89.5f, 0).upright);
  TEST_ASSERT_FALSE(levelStraight(2, 88.9f).upright);
  TEST_ASSERT_FALSE(levelStraight(NAN, 0).valid);
}

void test_mode_switches_at_45_and_back_at_43_degrees() {
  TEST_ASSERT_FALSE(levelStraightMode(false, 44.9f, 0));
  TEST_ASSERT_TRUE(levelStraightMode(false, 0, -45));
  TEST_ASSERT_TRUE(levelStraightMode(true, 44, 10));   // hysteresis
  TEST_ASSERT_FALSE(levelStraightMode(true, 42.9f, 10));
  // The dominant axis decides, not the combined tilt (hypot 42 here).
  TEST_ASSERT_FALSE(levelStraightMode(false, 30, 30));
  // Unreadable angles keep the mode.
  TEST_ASSERT_TRUE(levelStraightMode(true, NAN, 0));
  TEST_ASSERT_FALSE(levelStraightMode(false, 0, NAN));
}

void setUp() {}
void tearDown() {}

int main(int, char**) {
  UNITY_BEGIN();
  RUN_TEST(test_level_sits_in_the_middle);
  RUN_TEST(test_bubble_goes_to_the_high_side);
  RUN_TEST(test_fine_scale_ends_at_60_percent_and_the_rim_is_45_degrees);
  RUN_TEST(test_bubble_keeps_moving_between_15_and_45_degrees);
  RUN_TEST(test_clamp_is_radial);
  RUN_TEST(test_direction_is_the_clockwise_bearing_from_the_top);
  RUN_TEST(test_direction_matches_the_bubble_position);
  RUN_TEST(test_tolerance_and_undefined_direction);
  RUN_TEST(test_invalid_input);
  RUN_TEST(test_straight_shows_the_axis_that_is_not_dominant_pitch_on_a_tie);
  RUN_TEST(test_straight_uses_the_fine_scale_of_the_round_glass);
  RUN_TEST(test_straight_is_level_and_upright);
  RUN_TEST(test_mode_switches_at_45_and_back_at_43_degrees);
  return UNITY_END();
}
