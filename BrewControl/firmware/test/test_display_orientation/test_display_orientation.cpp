#include <unity.h>

#include <initializer_list>

#include "DisplayOrientation.h"

using namespace BrewControl;

void setUp() {}
void tearDown() {}

// Standing upright with the given side up: pitch > 0 lifts -X, roll > 0 lifts +Y.
void test_upright_sides_map_to_quadrants() {
  TEST_ASSERT_EQUAL(0, orientationFromTilt(80, 0, 0, false, 180));    // -X up
  TEST_ASSERT_EQUAL(90, orientationFromTilt(0, 80, 0, false, 0));     // +Y up
  TEST_ASSERT_EQUAL(180, orientationFromTilt(-80, 0, 0, false, 0));   // +X up
  TEST_ASSERT_EQUAL(270, orientationFromTilt(0, -80, 0, false, 0));   // -Y up
}

void test_flat_keeps_current() {
  TEST_ASSERT_EQUAL(270, orientationFromTilt(5, -10, 0, false, 270));
  TEST_ASSERT_EQUAL(90, orientationFromTilt(20, 20, 0, false, 90));  // 28° < 30°
}

void test_hysteresis_around_the_diagonal() {
  // Bearing 55° (just past the 45° diagonal from 0): stays at 0 within 45+15.
  TEST_ASSERT_EQUAL(0, orientationFromTilt(cosf(55 * 0.0174533f) * 60, sinf(55 * 0.0174533f) * 60,
                                           0, false, 0));
  // 65° is past the band: switches to 90.
  TEST_ASSERT_EQUAL(90, orientationFromTilt(cosf(65 * 0.0174533f) * 60, sinf(65 * 0.0174533f) * 60,
                                            0, false, 0));
  // And back: from 90, 35° is not yet enough, 25° is.
  TEST_ASSERT_EQUAL(90, orientationFromTilt(cosf(35 * 0.0174533f) * 60, sinf(35 * 0.0174533f) * 60,
                                            0, false, 90));
  TEST_ASSERT_EQUAL(0, orientationFromTilt(cosf(25 * 0.0174533f) * 60, sinf(25 * 0.0174533f) * 60,
                                           0, false, 90));
}

void test_offset_and_mirror() {
  // Mounted a quarter turn off: -X up means 90.
  TEST_ASSERT_EQUAL(90, orientationFromTilt(80, 0, 90, false, 0));
  TEST_ASSERT_EQUAL(180, orientationFromTilt(0, 80, 90, false, 0));
  // Mirrored: +Y up turns the other way.
  TEST_ASSERT_EQUAL(270, orientationFromTilt(0, 80, 0, true, 0));
  TEST_ASSERT_EQUAL(0, orientationFromTilt(0, 80, 90, true, 180));
}

void test_rotate_and_unrotate_are_inverse() {
  const int16_t n = 466;
  const int16_t pts[][2] = {{0, 0}, {465, 0}, {0, 465}, {100, 7}, {233, 400}};
  for (uint16_t deg : {0, 90, 180, 270}) {
    for (const auto& p : pts) {
      int16_t px, py, x, y;
      rotatePoint(deg, n, p[0], p[1], px, py);
      TEST_ASSERT_TRUE(px >= 0 && px < n && py >= 0 && py < n);
      unrotatePoint(deg, n, px, py, x, y);
      TEST_ASSERT_EQUAL(p[0], x);
      TEST_ASSERT_EQUAL(p[1], y);
    }
  }
  // 90° clockwise: the logical top-left lands top-right.
  int16_t px, py;
  rotatePoint(90, n, 0, 0, px, py);
  TEST_ASSERT_EQUAL(465, px);
  TEST_ASSERT_EQUAL(0, py);
}

void test_valid_rotations() {
  TEST_ASSERT_TRUE(isDisplayRotation(0));
  TEST_ASSERT_TRUE(isDisplayRotation(270));
  TEST_ASSERT_FALSE(isDisplayRotation(45));
  TEST_ASSERT_FALSE(isDisplayRotation(-90));
  TEST_ASSERT_FALSE(isDisplayRotation(360));
}

int main(int, char**) {
  UNITY_BEGIN();
  RUN_TEST(test_upright_sides_map_to_quadrants);
  RUN_TEST(test_flat_keeps_current);
  RUN_TEST(test_hysteresis_around_the_diagonal);
  RUN_TEST(test_offset_and_mirror);
  RUN_TEST(test_rotate_and_unrotate_are_inverse);
  RUN_TEST(test_valid_rotations);
  return UNITY_END();
}
