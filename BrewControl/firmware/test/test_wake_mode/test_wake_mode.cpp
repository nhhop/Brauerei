#include <unity.h>

#include "WakeMode.h"

using namespace BrewControl;

void setUp() {}
void tearDown() {}

void test_short_only_on_timer_with_sleep_on_and_pin_released() {
  TEST_ASSERT_TRUE(isShortWake(true, true, false));
  TEST_ASSERT_FALSE(isShortWake(true, true, true));    // pin held: stay awake
  TEST_ASSERT_FALSE(isShortWake(true, false, false));  // deep sleep switched off
  TEST_ASSERT_FALSE(isShortWake(false, true, false));  // power-on, reset, pin
}

void test_earlier_event_ignores_none() {
  TEST_ASSERT_EQUAL(0, earlierEvent(0, 0));
  TEST_ASSERT_EQUAL(5, earlierEvent(0, 5));
  TEST_ASSERT_EQUAL(5, earlierEvent(5, 0));
  TEST_ASSERT_EQUAL(3, earlierEvent(5, 3));
}

void test_sleep_interval_counts_from_wake() {
  TEST_ASSERT_EQUAL_UINT64(300000, sleepMs(300, 0, 1000, 0));
  TEST_ASSERT_EQUAL_UINT64(296500, sleepMs(300, 3500, 1000, 0));
  TEST_ASSERT_EQUAL_UINT64(1000, sleepMs(60, 90000, 1000, 0));  // at least 1 s
}

void test_sleep_ends_after_next_event() {
  const time_t now = 1700000000;
  TEST_ASSERT_EQUAL_UINT64(121000, sleepMs(300, 0, now, now + 120));
  TEST_ASSERT_EQUAL_UINT64(300000, sleepMs(300, 0, now, now + 600));  // interval first
  TEST_ASSERT_EQUAL_UINT64(1000, sleepMs(300, 0, now, now - 5));      // overdue
}

void test_short_wake_waits_for_sensors_and_connection() {
  ShortWake w;
  TEST_ASSERT_FALSE(w.sensorsSettled(100, false));
  TEST_ASSERT_FALSE(w.done(100, true));  // connected, but no readings yet
  TEST_ASSERT_TRUE(w.sensorsSettled(800, true));
  TEST_ASSERT_FALSE(w.done(800, true));  // ready, tail starts
  TEST_ASSERT_TRUE(w.sensorsSettled(900, false));  // latched
  TEST_ASSERT_FALSE(w.done(2200, true));
  TEST_ASSERT_TRUE(w.done(2300, true));
}

void test_short_wake_caps_each_wait() {
  ShortWake sensors;  // a sensor never reads: 3 s, then the tail
  TEST_ASSERT_FALSE(sensors.sensorsSettled(2999, false));
  TEST_ASSERT_TRUE(sensors.sensorsSettled(3000, false));
  TEST_ASSERT_FALSE(sensors.done(3000, true));
  TEST_ASSERT_TRUE(sensors.done(4500, true));

  ShortWake broker;  // the broker never answers: 5 s, then the tail
  broker.sensorsSettled(500, true);
  TEST_ASSERT_FALSE(broker.done(4999, false));
  TEST_ASSERT_FALSE(broker.done(5000, false));
  TEST_ASSERT_TRUE(broker.done(6500, false));

  ShortWake flapping;  // connected once is enough
  flapping.sensorsSettled(500, true);
  TEST_ASSERT_FALSE(flapping.done(500, true));
  TEST_ASSERT_TRUE(flapping.done(2000, false));
}

void test_short_wake_hard_limit() {
  ShortWake w;
  TEST_ASSERT_TRUE(w.done(ShortWake::kMaxMs, false));
}

int main(int, char**) {
  UNITY_BEGIN();
  RUN_TEST(test_short_only_on_timer_with_sleep_on_and_pin_released);
  RUN_TEST(test_earlier_event_ignores_none);
  RUN_TEST(test_sleep_interval_counts_from_wake);
  RUN_TEST(test_sleep_ends_after_next_event);
  RUN_TEST(test_short_wake_waits_for_sensors_and_connection);
  RUN_TEST(test_short_wake_caps_each_wait);
  RUN_TEST(test_short_wake_hard_limit);
  return UNITY_END();
}
