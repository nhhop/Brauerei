#include <unity.h>

#include <string>

#include "ProgramEvents.h"

using BrewControl::describeProgramAlert;
using BrewControl::notifiesOnEntry;

namespace {

void describe(const char* detail, const char* step, std::string& title, std::string& body) {
  describeProgramAlert(detail, "Sud #3 Maischen", step, title, body);
}

}  // namespace

void setUp(void) {}
void tearDown(void) {}

// A run starts with reachedStep -1: every notify step reports once, going forward.
void test_notify_on_first_forward_entry(void) {
  TEST_ASSERT_TRUE(notifiesOnEntry(true, 0, -1));
  TEST_ASSERT_TRUE(notifiesOnEntry(true, 3, 2));
  TEST_ASSERT_FALSE(notifiesOnEntry(false, 3, 2));
}

// "prev" then "next" re-enters a step already reached: no second report.
void test_no_repeat_after_prev(void) {
  TEST_ASSERT_FALSE(notifiesOnEntry(true, 2, 2));
  TEST_ASSERT_FALSE(notifiesOnEntry(true, 1, 2));
}

void test_awaiting_names_the_step(void) {
  std::string t, b;
  describe("awaiting", "Aufheizen auf 72 °C", t, b);
  TEST_ASSERT_EQUAL_STRING("Schritt bestätigen", t.c_str());
  TEST_ASSERT_EQUAL_STRING("Sud #3 Maischen: Aufheizen auf 72 °C", b.c_str());
}

void test_awaiting_without_step_name(void) {
  std::string t, b;
  describe("awaiting", "", t, b);
  TEST_ASSERT_EQUAL_STRING("Sud #3 Maischen wartet auf die Freigabe.", b.c_str());
}

void test_notify_body_is_the_step(void) {
  std::string t, b;
  describe("notify", "Rast 63 °C · 30 min", t, b);
  TEST_ASSERT_EQUAL_STRING("Sud #3 Maischen", t.c_str());
  TEST_ASSERT_EQUAL_STRING("Rast 63 °C · 30 min", b.c_str());
}

void test_done(void) {
  std::string t, b;
  describe("done", "", t, b);
  TEST_ASSERT_EQUAL_STRING("Programm fertig", t.c_str());
  TEST_ASSERT_EQUAL_STRING("Sud #3 Maischen ist durchgelaufen.", b.c_str());
}

int main(int, char**) {
  UNITY_BEGIN();
  RUN_TEST(test_notify_on_first_forward_entry);
  RUN_TEST(test_no_repeat_after_prev);
  RUN_TEST(test_awaiting_names_the_step);
  RUN_TEST(test_awaiting_without_step_name);
  RUN_TEST(test_notify_body_is_the_step);
  RUN_TEST(test_done);
  return UNITY_END();
}
