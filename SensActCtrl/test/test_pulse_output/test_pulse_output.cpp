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

void setUp() {}
void tearDown() {}

int main(int, char**) {
  UNITY_BEGIN();
  RUN_TEST(test_write_five_pulses_produces_five_high_edges);
  RUN_TEST(test_zero_or_negative_write_is_noop);
  RUN_TEST(test_back_to_back_writes_accumulate);
  RUN_TEST(test_active_low_inverts_levels);
  return UNITY_END();
}
