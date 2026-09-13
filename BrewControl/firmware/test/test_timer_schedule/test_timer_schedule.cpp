#include <unity.h>

#include <ctime>
#include <string>

#include "TimerSchedule.h"

using BrewControl::formatTimeOfDay;
using BrewControl::nextOccurrenceDurationSec;
using BrewControl::parseTimeOfDay;

namespace {

// Builds an epoch for a given time-of-day on a fixed reference date, using
// the host's *local* timezone (mktime, not timegm) so that
// nextOccurrenceDurationSec's localtime_r reads back exactly that
// time-of-day regardless of which timezone the test happens to run in.
time_t epochAt(int h, int m, int s = 0) {
  struct tm t {};
  t.tm_year  = 124;  // 2024 (post-2000, non-negotiable per the store's NTP gate)
  t.tm_mon   = 0;
  t.tm_mday  = 1;
  t.tm_hour  = h;
  t.tm_min   = m;
  t.tm_sec   = s;
  t.tm_isdst = -1;
  return mktime(&t);
}

uint32_t secOfDay(int h, int m) { return (uint32_t)(h * 3600 + m * 60); }

}  // namespace

// ── parseTimeOfDay / formatTimeOfDay ─────────────────────────────────────────

void test_parses_valid_times() {
  uint32_t s;
  TEST_ASSERT_TRUE(parseTimeOfDay("06:00", s));
  TEST_ASSERT_EQUAL_UINT32(secOfDay(6, 0), s);
  TEST_ASSERT_TRUE(parseTimeOfDay("23:59", s));
  TEST_ASSERT_EQUAL_UINT32(secOfDay(23, 59), s);
  TEST_ASSERT_TRUE(parseTimeOfDay("00:00", s));
  TEST_ASSERT_EQUAL_UINT32(0u, s);
}

void test_rejects_out_of_range_or_malformed() {
  uint32_t s;
  TEST_ASSERT_FALSE(parseTimeOfDay("24:00", s));
  TEST_ASSERT_FALSE(parseTimeOfDay("12:60", s));
  TEST_ASSERT_FALSE(parseTimeOfDay("", s));
  TEST_ASSERT_FALSE(parseTimeOfDay("aa:bb", s));
  TEST_ASSERT_FALSE(parseTimeOfDay("12", s));
}

void test_format_round_trips() {
  TEST_ASSERT_EQUAL_STRING("06:00", formatTimeOfDay(secOfDay(6, 0)).c_str());
  TEST_ASSERT_EQUAL_STRING("23:59", formatTimeOfDay(secOfDay(23, 59)).c_str());
  TEST_ASSERT_EQUAL_STRING("00:00", formatTimeOfDay(0).c_str());
}

// ── nextOccurrenceDurationSec ────────────────────────────────────────────────

void test_target_later_today() {
  // Now 06:00, target 08:00 -> 2h away.
  uint32_t d = nextOccurrenceDurationSec(secOfDay(8, 0), epochAt(6, 0));
  TEST_ASSERT_EQUAL_UINT32(2 * 3600u, d);
}

void test_target_already_passed_rolls_to_tomorrow() {
  // Now 08:00, target 06:00 -> 22h away (tomorrow).
  uint32_t d = nextOccurrenceDurationSec(secOfDay(6, 0), epochAt(8, 0));
  TEST_ASSERT_EQUAL_UINT32(22 * 3600u, d);
}

void test_exact_match_rolls_a_full_day_never_zero() {
  uint32_t d = nextOccurrenceDurationSec(secOfDay(6, 0), epochAt(6, 0));
  TEST_ASSERT_EQUAL_UINT32(86400u, d);
}

void test_midnight_crossing() {
  // Now 23:59, target 00:01 -> 2 minutes away, crossing midnight.
  uint32_t d = nextOccurrenceDurationSec(secOfDay(0, 1), epochAt(23, 59));
  TEST_ASSERT_EQUAL_UINT32(2 * 60u, d);
}

int main(int, char**) {
  UNITY_BEGIN();
  RUN_TEST(test_parses_valid_times);
  RUN_TEST(test_rejects_out_of_range_or_malformed);
  RUN_TEST(test_format_round_trips);
  RUN_TEST(test_target_later_today);
  RUN_TEST(test_target_already_passed_rolls_to_tomorrow);
  RUN_TEST(test_exact_match_rolls_a_full_day_never_zero);
  RUN_TEST(test_midnight_crossing);
  return UNITY_END();
}
