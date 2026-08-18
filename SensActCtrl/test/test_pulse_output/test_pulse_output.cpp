#include <unity.h>
#include <stdint.h>

#include "actuators/PulseOutputActuator.h"

// Native build exposes a tiny clock+pin surface that the actuator's
// digitalWrite/millis fallbacks observe. Tests advance now_ms and inspect
// the captured edges.
namespace SensActCtrl { namespace nativehook {
  extern uint32_t now_ms;
  extern int last_pin;
  extern int last_level;
  extern int high_edges;
  void reset();
}}

using SensActCtrl::PulseOutputActuator;

static void advanceMs(PulseOutputActuator& a, uint32_t deltaMs,
                      uint32_t step = 1) {
  using SensActCtrl::nativehook::now_ms;
  uint32_t end = now_ms + deltaMs;
  while (now_ms < end) {
    now_ms += step;
    a.tick();
  }
}

void test_write_five_pulses_produces_five_high_edges() {
  using namespace SensActCtrl::nativehook;
  reset();
  PulseOutputActuator a("p", /*pin=*/5, /*width=*/10, /*gap=*/10, true);
  a.begin();
  a.write(5.0f);
  TEST_ASSERT_FLOAT_WITHIN(0.001f, 5.0f, a.state());

  // Drive long enough for 5 pulses: 5 * (10+10) = 100 ms (+ slack)
  advanceMs(a, 200);
  TEST_ASSERT_EQUAL(5, high_edges);
  TEST_ASSERT_FLOAT_WITHIN(0.001f, 0.0f, a.state());
}

void test_zero_or_negative_write_is_noop() {
  using namespace SensActCtrl::nativehook;
  reset();
  PulseOutputActuator a("p", /*pin=*/5, 10, 10, true);
  a.begin();
  a.write(0.0f);
  a.write(-3.0f);
  advanceMs(a, 100);
  TEST_ASSERT_EQUAL(0, high_edges);
}

void test_back_to_back_writes_accumulate() {
  using namespace SensActCtrl::nativehook;
  reset();
  PulseOutputActuator a("p", /*pin=*/5, 5, 5, true);
  a.begin();
  a.write(2.0f);
  a.write(3.0f);
  TEST_ASSERT_FLOAT_WITHIN(0.001f, 5.0f, a.state());
  advanceMs(a, 200);
  TEST_ASSERT_EQUAL(5, high_edges);
}

void test_active_low_inverts_levels() {
  using namespace SensActCtrl::nativehook;
  reset();
  PulseOutputActuator a("p", /*pin=*/5, 10, 10, /*activeHigh=*/false);
  a.begin();
  // After begin(), inactive level should be HIGH (1).
  TEST_ASSERT_EQUAL(1, last_level);
  a.write(1.0f);
  advanceMs(a, 5);  // mid pulse
  TEST_ASSERT_EQUAL(0, last_level);  // active = LOW
  advanceMs(a, 30);  // end of cycle
  TEST_ASSERT_EQUAL(1, last_level);  // back to inactive
}

// Disabling must freeze the queue, not swallow it: pulses that were never
// physically emitted have to still be outstanding afterwards.
void test_disabled_freezes_the_queue_without_emitting() {
  using namespace SensActCtrl::nativehook;
  reset();
  PulseOutputActuator a("p", /*pin=*/5, 10, 10, true);
  a.begin();
  a.write(5.0f);

  a.setEnabled(false);
  advanceMs(a, 500);  // way more than enough for all 5 pulses
  TEST_ASSERT_EQUAL(0, high_edges);
  TEST_ASSERT_FLOAT_WITHIN(0.001f, 5.0f, a.state());  // nothing consumed

  a.setEnabled(true);
  advanceMs(a, 500);
  TEST_ASSERT_EQUAL(5, high_edges);  // all of them still get emitted
  TEST_ASSERT_FLOAT_WITHIN(0.001f, 0.0f, a.state());
}

// A pulse in flight must not leave the pin stuck at its active level.
void test_disabling_mid_pulse_releases_the_pin() {
  using namespace SensActCtrl::nativehook;
  reset();
  PulseOutputActuator a("p", /*pin=*/5, /*width=*/50, /*gap=*/10, true);
  a.begin();
  a.write(1.0f);
  advanceMs(a, 20);                  // inside the 50 ms pulse
  TEST_ASSERT_EQUAL(1, last_level);  // active

  a.setEnabled(false);
  TEST_ASSERT_EQUAL(0, last_level);  // released immediately
  advanceMs(a, 200);
  TEST_ASSERT_EQUAL(0, last_level);  // and stays released
}

void test_writes_while_disabled_are_queued_not_lost() {
  using namespace SensActCtrl::nativehook;
  reset();
  PulseOutputActuator a("p", /*pin=*/5, 10, 10, true);
  a.begin();
  a.setEnabled(false);
  a.write(3.0f);
  advanceMs(a, 300);
  TEST_ASSERT_EQUAL(0, high_edges);
  TEST_ASSERT_FLOAT_WITHIN(0.001f, 3.0f, a.state());

  a.setEnabled(true);
  advanceMs(a, 300);
  TEST_ASSERT_EQUAL(3, high_edges);
}

void setUp() {}
void tearDown() {}

int main(int, char**) {
  UNITY_BEGIN();
  RUN_TEST(test_write_five_pulses_produces_five_high_edges);
  RUN_TEST(test_zero_or_negative_write_is_noop);
  RUN_TEST(test_back_to_back_writes_accumulate);
  RUN_TEST(test_active_low_inverts_levels);
  RUN_TEST(test_disabled_freezes_the_queue_without_emitting);
  RUN_TEST(test_disabling_mid_pulse_releases_the_pin);
  RUN_TEST(test_writes_while_disabled_are_queued_not_lost);
  return UNITY_END();
}
