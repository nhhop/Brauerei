#include <unity.h>
#include <stdint.h>

#include "actuators/DigitalOutputActuator.h"

// The native build of DigitalOutputActuator stubs digitalWrite/millis; these
// hooks let the tests observe the pin and drive the clock deterministically.
namespace SensActCtrl { namespace digitalouthook {
  extern int last_level;
  extern int last_pin;
  extern uint32_t now_ms;
  void reset();
}}

using SensActCtrl::DigitalOutputActuator;
using SensActCtrl::ValueKind;
using SensActCtrl::digitalouthook::last_level;
using SensActCtrl::digitalouthook::now_ms;

static void advanceMs(DigitalOutputActuator& a, uint32_t deltaMs, uint32_t step = 10) {
  uint32_t end = now_ms + deltaMs;
  while (now_ms < end) {
    now_ms += step;
    a.tick();
  }
}

// ── Binary mode: the master switch IS the control ────────────────────────

void test_binary_starts_disabled_and_armed() {
  SensActCtrl::digitalouthook::reset();
  DigitalOutputActuator a("relay", 5);
  // Value pinned at "on" so enable alone decides, but disabled so a boot
  // never energises the relay by itself.
  TEST_ASSERT_FALSE(a.enabled());
  TEST_ASSERT_FLOAT_WITHIN(0.001f, 1.0f, a.target());
  TEST_ASSERT_FLOAT_WITHIN(0.001f, 0.0f, a.state());
}

void test_binary_begin_leaves_pin_inactive_while_disabled() {
  SensActCtrl::digitalouthook::reset();
  DigitalOutputActuator a("relay", 5);
  a.begin();
  TEST_ASSERT_EQUAL(0, last_level);
}

void test_binary_enable_drives_pin_active() {
  SensActCtrl::digitalouthook::reset();
  DigitalOutputActuator a("relay", 5);
  a.begin();
  a.setEnabled(true);
  TEST_ASSERT_EQUAL(1, last_level);
  TEST_ASSERT_FLOAT_WITHIN(0.001f, 1.0f, a.state());

  a.setEnabled(false);
  TEST_ASSERT_EQUAL(0, last_level);
  TEST_ASSERT_FLOAT_WITHIN(0.001f, 0.0f, a.state());
  TEST_ASSERT_FLOAT_WITHIN(0.001f, 1.0f, a.target());  // still armed
}

void test_binary_active_low_inverts_the_gate() {
  SensActCtrl::digitalouthook::reset();
  DigitalOutputActuator a("relay", 5, DigitalOutputActuator::Mode::Binary,
                          /*activeHigh=*/false);
  a.begin();
  TEST_ASSERT_EQUAL(1, last_level);  // inactive == HIGH here
  a.setEnabled(true);
  TEST_ASSERT_EQUAL(0, last_level);  // active == LOW
  a.setEnabled(false);
  TEST_ASSERT_EQUAL(1, last_level);  // back to inactive, not stuck
}

void test_binary_write_while_disabled_does_not_reach_the_pin() {
  SensActCtrl::digitalouthook::reset();
  DigitalOutputActuator a("relay", 5);
  a.begin();
  a.write(1.0f);
  TEST_ASSERT_EQUAL(0, last_level);
  a.setEnabled(true);
  TEST_ASSERT_EQUAL(1, last_level);
}

// ── TimeProportional: tick()-driven, must be gated there too ─────────────

void test_tpo_starts_enabled_at_zero_duty() {
  SensActCtrl::digitalouthook::reset();
  DigitalOutputActuator a("heater", 6, DigitalOutputActuator::Mode::TimeProportional);
  TEST_ASSERT_TRUE(a.enabled());  // duty 0 is already inactive, no arming needed
  TEST_ASSERT_FLOAT_WITHIN(0.001f, 0.0f, a.target());
  TEST_ASSERT_EQUAL(static_cast<int>(ValueKind::Continuous),
                    static_cast<int>(a.meta().kind));
}

void test_tpo_disabled_keeps_pin_inactive_across_ticks() {
  SensActCtrl::digitalouthook::reset();
  DigitalOutputActuator a("heater", 6, DigitalOutputActuator::Mode::TimeProportional);
  a.begin();
  a.setPeriodMs(1000);
  a.write(1.0f);  // 100 % duty — would be solidly on
  advanceMs(a, 200);
  TEST_ASSERT_EQUAL(1, last_level);

  a.setEnabled(false);
  TEST_ASSERT_EQUAL(0, last_level);  // released immediately, not next cycle
  advanceMs(a, 3000);                // several full periods
  TEST_ASSERT_EQUAL(0, last_level);  // tick() never drives it active
}

void test_tpo_duty_survives_the_disable() {
  SensActCtrl::digitalouthook::reset();
  DigitalOutputActuator a("heater", 6, DigitalOutputActuator::Mode::TimeProportional);
  a.begin();
  a.setPeriodMs(1000);
  a.write(0.6f);
  a.setEnabled(false);
  advanceMs(a, 2000);
  // The guard used to clobber the concrete actuator's duty; now it stays put.
  TEST_ASSERT_FLOAT_WITHIN(0.001f, 0.6f, a.target());

  a.setEnabled(true);
  advanceMs(a, 100);
  TEST_ASSERT_EQUAL(1, last_level);  // resumes inside the on-window
  TEST_ASSERT_FLOAT_WITHIN(0.001f, 0.6f, a.state());
}

void setUp() {}
void tearDown() {}

// ── Port-expander channel ────────────────────────────────────────────────

namespace {
// Records what the actuator sends to its channel; `ack = false` plays an
// expander that does not answer.
struct FakePort : SensActCtrl::GpioPort {
  uint8_t channels() const override { return 16; }
  bool pinMode(uint8_t ch, Mode m) override {
    lastCh = ch;
    mode = m;
    return ack;
  }
  bool write(uint8_t ch, bool high) override {
    lastCh = ch;
    level = high;
    ++writes;
    return ack;
  }
  bool read(uint8_t, bool&) override { return false; }
  int lastCh = -1;
  Mode mode = Mode::Input;
  bool level = true;
  int writes = 0;
  bool ack = true;
};
}  // namespace

void test_port_begin_sets_output_and_writes_off() {
  SensActCtrl::digitalouthook::reset();
  FakePort port;
  DigitalOutputActuator a("relay", port, 7, DigitalOutputActuator::Mode::Binary, false);
  a.begin();
  TEST_ASSERT_EQUAL(7, port.lastCh);
  TEST_ASSERT_TRUE(port.mode == SensActCtrl::GpioPort::Mode::Output);
  TEST_ASSERT_EQUAL(1, port.writes);
  TEST_ASSERT_TRUE(port.level);  // active low: off = high
  TEST_ASSERT_EQUAL(-1, SensActCtrl::digitalouthook::last_pin);  // no GPIO touched
}

void test_port_binary_writes_on_change_and_refreshes() {
  SensActCtrl::digitalouthook::reset();
  FakePort port;
  DigitalOutputActuator a("relay", port, 0);
  a.begin();
  a.setEnabled(true);
  TEST_ASSERT_EQUAL(2, port.writes);
  TEST_ASSERT_TRUE(port.level);
  advanceMs(a, 990);
  TEST_ASSERT_EQUAL(2, port.writes);  // nothing changed yet
  advanceMs(a, 20);
  TEST_ASSERT_EQUAL(3, port.writes);  // refresh after kRefreshMs
  TEST_ASSERT_TRUE(port.level);
}

void test_port_tpo_writes_only_on_level_change() {
  SensActCtrl::digitalouthook::reset();
  FakePort port;
  DigitalOutputActuator a("ssr", port, 1, DigitalOutputActuator::Mode::TimeProportional);
  a.setPeriodMs(2000);
  a.begin();
  a.write(0.5f);
  const int before = port.writes;
  advanceMs(a, 900);  // 90 ticks inside the on phase
  TEST_ASSERT_TRUE(port.level);
  TEST_ASSERT_EQUAL(before + 1, port.writes);
  advanceMs(a, 200);  // into the off phase
  TEST_ASSERT_FALSE(port.level);
  TEST_ASSERT_EQUAL(before + 2, port.writes);
}

void test_port_disable_writes_off_at_once() {
  SensActCtrl::digitalouthook::reset();
  FakePort port;
  DigitalOutputActuator a("relay", port, 0);
  a.begin();
  a.setEnabled(true);
  TEST_ASSERT_TRUE(port.level);
  a.setEnabled(false);  // what the emergency stop does
  TEST_ASSERT_FALSE(port.level);
}

void test_port_nack_sets_and_clears_fault() {
  SensActCtrl::digitalouthook::reset();
  FakePort port;
  DigitalOutputActuator a("relay", port, 0);
  a.begin();
  TEST_ASSERT_NULL(a.fault());
  port.ack = false;
  a.setEnabled(true);
  TEST_ASSERT_NOT_NULL(a.fault());
  port.ack = true;
  advanceMs(a, 1010);  // the refresh succeeds again
  TEST_ASSERT_NULL(a.fault());
  TEST_ASSERT_TRUE(port.level);
}

void test_gpio_mode_has_no_fault() {
  SensActCtrl::digitalouthook::reset();
  DigitalOutputActuator a("relay", 5);
  a.begin();
  a.setEnabled(true);
  TEST_ASSERT_NULL(a.fault());
}

int main(int, char**) {
  UNITY_BEGIN();
  RUN_TEST(test_binary_starts_disabled_and_armed);
  RUN_TEST(test_binary_begin_leaves_pin_inactive_while_disabled);
  RUN_TEST(test_binary_enable_drives_pin_active);
  RUN_TEST(test_binary_active_low_inverts_the_gate);
  RUN_TEST(test_binary_write_while_disabled_does_not_reach_the_pin);
  RUN_TEST(test_tpo_starts_enabled_at_zero_duty);
  RUN_TEST(test_tpo_disabled_keeps_pin_inactive_across_ticks);
  RUN_TEST(test_tpo_duty_survives_the_disable);
  RUN_TEST(test_port_begin_sets_output_and_writes_off);
  RUN_TEST(test_port_binary_writes_on_change_and_refreshes);
  RUN_TEST(test_port_tpo_writes_only_on_level_change);
  RUN_TEST(test_port_disable_writes_off_at_once);
  RUN_TEST(test_port_nack_sets_and_clears_fault);
  RUN_TEST(test_gpio_mode_has_no_fault);
  return UNITY_END();
}

