// DigitalInputSensor on a port-expander channel: level, invert, debounce,
// and a missing expander as an invalid reading with fault().
#include <unity.h>
#include <stdint.h>

#include "sensors/DigitalInputSensor.h"

namespace SensActCtrl { namespace digitalinhook {
  extern uint32_t now_ms;
}}

using SensActCtrl::DigitalInputSensor;
using SensActCtrl::GpioPort;
using SensActCtrl::digitalinhook::now_ms;

namespace {
struct FakePort : GpioPort {
  uint8_t channels() const override { return 16; }
  bool pinMode(uint8_t ch, Mode m) override {
    lastCh = ch;
    mode = m;
    return true;
  }
  bool write(uint8_t, bool) override { return true; }
  bool read(uint8_t ch, bool& high) override {
    lastCh = ch;
    if (!ack) return false;
    high = level;
    return true;
  }
  int lastCh = -1;
  Mode mode = Mode::Output;
  bool level = true;
  bool ack = true;
};

float value(const DigitalInputSensor& s) { return s.channel(0).reading.value; }
bool valid(const DigitalInputSensor& s) { return s.channel(0).reading.valid; }
}  // namespace

void setUp() { now_ms = 0; }
void tearDown() {}

void test_begin_configures_the_channel() {
  FakePort port;
  DigitalInputSensor a("a", port, 5, true);
  a.begin();
  TEST_ASSERT_EQUAL(5, port.lastCh);
  TEST_ASSERT_TRUE(port.mode == GpioPort::Mode::InputPullup);
  DigitalInputSensor b("b", port, 6, false);
  b.begin();
  TEST_ASSERT_TRUE(port.mode == GpioPort::Mode::Input);
}

void test_reads_the_level_and_inverts() {
  FakePort port;
  DigitalInputSensor plain("plain", port, 0, true);
  DigitalInputSensor inv("inv", port, 0, true, true);
  port.level = false;
  plain.tick();
  inv.tick();
  TEST_ASSERT_TRUE(valid(plain));
  TEST_ASSERT_FLOAT_WITHIN(0.001f, 0.0f, value(plain));
  TEST_ASSERT_FLOAT_WITHIN(0.001f, 1.0f, value(inv));
}

void test_debounce_on_a_port_channel() {
  FakePort port;
  DigitalInputSensor s("s", port, 0, true, false, 50);
  port.level = false;
  s.tick();
  TEST_ASSERT_FLOAT_WITHIN(0.001f, 0.0f, value(s));
  port.level = true;
  now_ms = 10;
  s.tick();
  now_ms = 40;
  s.tick();
  TEST_ASSERT_FLOAT_WITHIN(0.001f, 0.0f, value(s));  // not stable for 50 ms yet
  now_ms = 70;
  s.tick();
  TEST_ASSERT_FLOAT_WITHIN(0.001f, 1.0f, value(s));
}

void test_missing_expander_is_invalid_with_fault() {
  FakePort port;
  DigitalInputSensor s("s", port, 0, true);
  s.tick();
  TEST_ASSERT_TRUE(valid(s));
  TEST_ASSERT_NULL(s.fault());
  port.ack = false;
  s.tick();
  TEST_ASSERT_FALSE(valid(s));
  TEST_ASSERT_NOT_NULL(s.fault());
  port.ack = true;
  s.tick();
  TEST_ASSERT_TRUE(valid(s));
  TEST_ASSERT_NULL(s.fault());
}

int main(int, char**) {
  UNITY_BEGIN();
  RUN_TEST(test_begin_configures_the_channel);
  RUN_TEST(test_reads_the_level_and_inverts);
  RUN_TEST(test_debounce_on_a_port_channel);
  RUN_TEST(test_missing_expander_is_invalid_with_fault);
  return UNITY_END();
}
