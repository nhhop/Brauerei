// TCA9554 driver: shadowed registers, begin() adopting the chip's state so
// channels the driver never touches stay as they are, read cache, NACK.
#include <unity.h>

#include "devices/TCA9554.h"

using namespace SensActCtrl;
using Mode = GpioPort::Mode;

// Native builds never touch the bus; any object will do as a stand-in.
class TwoWire {};

namespace {
Tca9554TestState& hw() { return tca9554TestState(); }
}  // namespace

void setUp() {
  hw() = Tca9554TestState{};
}
void tearDown() {}

void test_eight_channels_and_address() {
  TwoWire bus;
  TCA9554 port(bus, 0x21);
  TEST_ASSERT_EQUAL_UINT8(8, port.channels());
  TEST_ASSERT_EQUAL_UINT8(0x21, port.address());
  TEST_ASSERT_EQUAL_UINT8(0x20, TCA9554(bus).address());
}

void test_begin_adopts_latches_and_directions() {
  TwoWire bus;
  TCA9554 port(bus);
  hw().output = 0x7F;  // EXIO7 low, e.g. a GNSS held in reset by the board
  hw().config = 0x7F;  // ... and driven by it
  TEST_ASSERT_TRUE(port.begin());
  TEST_ASSERT_EQUAL_UINT32(0, hw().writes);  // begin itself writes nothing
  TEST_ASSERT_TRUE(port.pinMode(0, Mode::Output));
  TEST_ASSERT_TRUE(port.write(0, false));
  TEST_ASSERT_EQUAL_HEX8(0x7E, hw().output);
  TEST_ASSERT_EQUAL_HEX8(0x7E, hw().config);  // EXIO7 stays an output
}

void test_begin_without_answer_assumes_power_up_state() {
  TwoWire bus;
  TCA9554 port(bus);
  hw().ack = false;
  hw().output = 0x00;
  TEST_ASSERT_FALSE(port.begin());
  hw().ack = true;
  port.pinMode(2, Mode::Output);
  port.write(2, false);
  TEST_ASSERT_EQUAL_HEX8(0xFB, hw().output);
  TEST_ASSERT_EQUAL_HEX8(0xFB, hw().config);
}

void test_input_modes_are_alike_and_leave_the_latch() {
  TwoWire bus;
  TCA9554 port(bus);
  port.begin();
  port.pinMode(1, Mode::Output);
  port.write(1, false);
  port.pinMode(1, Mode::InputPullup);  // no pull-up on this chip: plain input
  TEST_ASSERT_EQUAL_HEX8(0xFF, hw().config);
  TEST_ASSERT_EQUAL_HEX8(0xFD, hw().output);
}

void test_read_returns_pin_levels_and_is_cached() {
  TwoWire bus;
  TCA9554 port(bus);
  port.begin();
  const uint32_t before = hw().reads;
  hw().pins = 0xEF;  // EXIO4 low
  bool high = true;
  TEST_ASSERT_TRUE(port.read(4, high));
  TEST_ASSERT_FALSE(high);
  TEST_ASSERT_TRUE(port.read(3, high));
  TEST_ASSERT_TRUE(high);
  TEST_ASSERT_EQUAL_UINT32(before + 1, hw().reads);  // one fetch for both
  hw().nowMs += TCA9554::kReadCacheMs;
  hw().pins = 0xFF;
  TEST_ASSERT_TRUE(port.read(4, high));
  TEST_ASSERT_TRUE(high);
}

void test_failed_fetch_is_reported_and_leaves_value() {
  TwoWire bus;
  TCA9554 port(bus);
  port.begin();
  hw().ack = false;
  bool high = true;
  TEST_ASSERT_FALSE(port.read(0, high));
  TEST_ASSERT_TRUE(high);
  TEST_ASSERT_FALSE(port.write(0, false));
  TEST_ASSERT_FALSE(port.pinMode(0, Mode::Output));
}

void test_out_of_range_channel_is_refused() {
  TwoWire bus;
  TCA9554 port(bus);
  bool high = false;
  TEST_ASSERT_FALSE(port.pinMode(8, Mode::Output));
  TEST_ASSERT_FALSE(port.write(8, true));
  TEST_ASSERT_FALSE(port.read(8, high));
}

int main(int, char**) {
  UNITY_BEGIN();
  RUN_TEST(test_eight_channels_and_address);
  RUN_TEST(test_begin_adopts_latches_and_directions);
  RUN_TEST(test_begin_without_answer_assumes_power_up_state);
  RUN_TEST(test_input_modes_are_alike_and_leave_the_latch);
  RUN_TEST(test_read_returns_pin_levels_and_is_cached);
  RUN_TEST(test_failed_fetch_is_reported_and_leaves_value);
  RUN_TEST(test_out_of_range_channel_is_refused);
  return UNITY_END();
}
