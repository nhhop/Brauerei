// CH422G driver: write-only chip with a process-wide shadow, IO_OE for all
// eight IO pins, OC outputs as open-drain, cached input read, NACK.
#include <unity.h>

#include "devices/CH422G.h"

using namespace SensActCtrl;
using Mode = GpioPort::Mode;

// Native builds never touch the bus; any object will do as a stand-in.
class TwoWire {};

namespace {
CH422GTestState& hw() { return ch422gTestState(); }
}  // namespace

void setUp() {
  hw() = CH422GTestState{};
  ch422gResetShadow();
}
void tearDown() {}

void test_ten_channels() {
  TwoWire bus;
  TEST_ASSERT_EQUAL_UINT8(10, CH422G(bus).channels());
}

void test_begin_only_probes() {
  TwoWire bus;
  CH422G io(bus);
  TEST_ASSERT_TRUE(io.begin());
  TEST_ASSERT_EQUAL_UINT32(0, hw().writes);
  hw().ack = false;
  TEST_ASSERT_FALSE(io.begin());
}

void test_output_mode_and_latches() {
  TwoWire bus;
  CH422G io(bus);
  TEST_ASSERT_TRUE(io.pinMode(3, Mode::Output));
  TEST_ASSERT_EQUAL_HEX8(0x01, hw().set);  // IO_OE
  TEST_ASSERT_TRUE(io.write(3, false));
  TEST_ASSERT_EQUAL_HEX8(0xF7, hw().io);
  TEST_ASSERT_TRUE(io.write(5, false));
  TEST_ASSERT_EQUAL_HEX8(0xD7, hw().io);
  TEST_ASSERT_TRUE(io.write(3, true));
  TEST_ASSERT_EQUAL_HEX8(0xDF, hw().io);
}

void test_oc_channels_stay_push_pull_and_separate() {
  TwoWire bus;
  CH422G io(bus);
  TEST_ASSERT_TRUE(io.pinMode(9, Mode::Output));
  TEST_ASSERT_EQUAL_UINT32(0, hw().writes);  // always an output: nothing to set
  TEST_ASSERT_TRUE(io.write(9, false));
  TEST_ASSERT_EQUAL_HEX8(0x0D, hw().oc);  // OC1 low
  TEST_ASSERT_EQUAL_HEX8(0xFF, hw().io);
  bool high = true;
  TEST_ASSERT_TRUE(io.read(9, high));  // no read-back: the latch
  TEST_ASSERT_FALSE(high);
}

void test_shadow_is_shared_between_objects() {
  TwoWire bus;
  CH422G boardInit(bus);
  CH422G item(bus);
  boardInit.pinMode(1, Mode::Output);
  boardInit.write(1, false);
  item.write(2, false);  // must not set EXIO1 high again
  TEST_ASSERT_EQUAL_HEX8(0xF9, hw().io);
  item.pinMode(8, Mode::Output);
  TEST_ASSERT_EQUAL_HEX8(0x01, hw().set);  // OC channel: IO_OE untouched
}

void test_read_flips_outputs_to_input_for_one_transfer() {
  TwoWire bus;
  CH422G io(bus);
  io.pinMode(1, Mode::Output);  // IO_OE on
  const uint32_t before = hw().writes;
  hw().pins = 0xFE;  // EXIO0 low
  bool high = true;
  TEST_ASSERT_TRUE(io.read(0, high));
  TEST_ASSERT_FALSE(high);
  TEST_ASSERT_EQUAL_UINT32(before + 2, hw().writes);  // input, then output again
  TEST_ASSERT_EQUAL_HEX8(0x01, hw().set);
}

void test_read_without_output_mode_writes_nothing() {
  TwoWire bus;
  CH422G io(bus);
  bool high = false;
  TEST_ASSERT_TRUE(io.read(0, high));
  TEST_ASSERT_EQUAL_UINT32(0, hw().writes);
}

void test_input_mode_writes_nothing() {
  TwoWire bus;
  CH422G io(bus);
  TEST_ASSERT_TRUE(io.pinMode(0, Mode::InputPullup));
  TEST_ASSERT_EQUAL_UINT32(0, hw().writes);
}

void test_read_returns_pin_levels_and_is_cached() {
  TwoWire bus;
  CH422G io(bus);
  hw().pins = 0xEF;  // EXIO4 low
  bool high = true;
  TEST_ASSERT_TRUE(io.read(4, high));
  TEST_ASSERT_FALSE(high);
  TEST_ASSERT_TRUE(io.read(3, high));
  TEST_ASSERT_TRUE(high);
  TEST_ASSERT_EQUAL_UINT32(1, hw().reads);
  hw().nowMs += CH422G::kReadCacheMs;
  hw().pins = 0xFF;
  TEST_ASSERT_TRUE(io.read(4, high));
  TEST_ASSERT_TRUE(high);
}

void test_nack_is_reported() {
  TwoWire bus;
  CH422G io(bus);
  hw().ack = false;
  bool high = true;
  TEST_ASSERT_FALSE(io.read(0, high));
  TEST_ASSERT_TRUE(high);
  TEST_ASSERT_FALSE(io.write(0, false));
  TEST_ASSERT_FALSE(io.pinMode(0, Mode::Output));
}

void test_out_of_range_channel_is_refused() {
  TwoWire bus;
  CH422G io(bus);
  bool high = false;
  TEST_ASSERT_FALSE(io.pinMode(10, Mode::Output));
  TEST_ASSERT_FALSE(io.write(10, true));
  TEST_ASSERT_FALSE(io.read(10, high));
}

int main(int, char**) {
  UNITY_BEGIN();
  RUN_TEST(test_ten_channels);
  RUN_TEST(test_begin_only_probes);
  RUN_TEST(test_output_mode_and_latches);
  RUN_TEST(test_oc_channels_stay_push_pull_and_separate);
  RUN_TEST(test_shadow_is_shared_between_objects);
  RUN_TEST(test_read_flips_outputs_to_input_for_one_transfer);
  RUN_TEST(test_read_without_output_mode_writes_nothing);
  RUN_TEST(test_input_mode_writes_nothing);
  RUN_TEST(test_read_returns_pin_levels_and_is_cached);
  RUN_TEST(test_nack_is_reported);
  RUN_TEST(test_out_of_range_channel_is_refused);
  return UNITY_END();
}
