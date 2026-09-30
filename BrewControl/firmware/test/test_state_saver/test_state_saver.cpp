#include <unity.h>

#include "StateSaver.h"

using BrewControl::StateSaver;

void setUp() {}
void tearDown() {}

void test_unchanged_never_saves() {
  StateSaver s(2000);
  s.reset("a");
  TEST_ASSERT_FALSE(s.due(0, "a"));
  TEST_ASSERT_FALSE(s.due(10000, "a"));
}

void test_change_saves_after_quiet_time() {
  StateSaver s(2000);
  s.reset("a");
  TEST_ASSERT_FALSE(s.due(1000, "b"));  // change seen
  TEST_ASSERT_FALSE(s.due(2000, "b"));  // 1 s quiet
  TEST_ASSERT_TRUE(s.due(3000, "b"));   // 2 s quiet
  TEST_ASSERT_FALSE(s.due(4000, "b"));  // saved now
}

void test_further_change_restarts_quiet_time() {
  StateSaver s(2000);
  s.reset("a");
  TEST_ASSERT_FALSE(s.due(1000, "b"));
  TEST_ASSERT_FALSE(s.due(2500, "c"));  // slider still moving
  TEST_ASSERT_FALSE(s.due(4000, "c"));
  TEST_ASSERT_TRUE(s.due(4500, "c"));
}

void test_change_back_cancels() {
  StateSaver s(2000);
  s.reset("a");
  TEST_ASSERT_FALSE(s.due(1000, "b"));
  TEST_ASSERT_FALSE(s.due(2000, "a"));  // back to what is saved
  TEST_ASSERT_FALSE(s.due(5000, "a"));
  TEST_ASSERT_FALSE(s.due(6000, "b"));  // new change counts from here
  TEST_ASSERT_TRUE(s.due(8000, "b"));
}

void test_millis_wraparound() {
  StateSaver s(2000);
  s.reset("a");
  TEST_ASSERT_FALSE(s.due(0xFFFFFC00u, "b"));
  TEST_ASSERT_FALSE(s.due(0x00000100u, "b"));  // 1.28 s later
  TEST_ASSERT_TRUE(s.due(0x00000800u, "b"));   // 3.07 s later
}

void test_state_flush_writes_only_a_change() {
  StateSaver s;
  s.reset("a");
  TEST_ASSERT_FALSE(s.flush("a"));
  TEST_ASSERT_TRUE(s.flush("b"));   // pending or not: now
  TEST_ASSERT_FALSE(s.flush("b"));
  TEST_ASSERT_FALSE(s.due(10000, "b"));
}

int main(int, char**) {
  UNITY_BEGIN();
  RUN_TEST(test_unchanged_never_saves);
  RUN_TEST(test_change_saves_after_quiet_time);
  RUN_TEST(test_further_change_restarts_quiet_time);
  RUN_TEST(test_change_back_cancels);
  RUN_TEST(test_millis_wraparound);
  RUN_TEST(test_state_flush_writes_only_a_change);
  return UNITY_END();
}
