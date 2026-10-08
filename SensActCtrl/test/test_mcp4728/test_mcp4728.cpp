// MCP4728 driver: Multi-Write frames per channel, clamping, NACK handling,
// and an AnalogOutputActuator running on top of a channel.
#include <unity.h>

#include "actuators/AnalogOutputActuator.h"
#include "devices/MCP4728.h"

using namespace SensActCtrl;

// Native builds never touch the bus; any object will do as a stand-in.
class TwoWire {};

namespace {
Mcp4728TestState& hw() { return mcp4728TestState(); }
}  // namespace

void setUp() {
  hw() = Mcp4728TestState{};
}
void tearDown() {}

void test_channels_report_12_bit() {
  TwoWire bus;
  MCP4728 dac(bus);
  for (int ch = 0; ch < MCP4728::kChannels; ++ch)
    TEST_ASSERT_EQUAL_UINT16(4095, dac.channel(ch).rawMax());
}

void test_default_address_and_getter() {
  TwoWire bus;
  TEST_ASSERT_EQUAL_UINT8(0x60, MCP4728(bus).address());
  TEST_ASSERT_EQUAL_UINT8(0x67, MCP4728(bus, 0x67).address());
}

void test_frame_for_channel_a() {
  TwoWire bus;
  MCP4728 dac(bus, 0x62);
  TEST_ASSERT_TRUE(dac.channel(0).write(0x0ABC));
  TEST_ASSERT_EQUAL_UINT32(1, hw().frames);
  TEST_ASSERT_EQUAL_UINT8(0x62, hw().address);
  TEST_ASSERT_EQUAL_HEX8(0x40, hw().frame[0]);  // multi-write, DAC A, UDAC 0
  TEST_ASSERT_EQUAL_HEX8(0x0A, hw().frame[1]);  // VREF=VDD, PD=0, Gx=x1, D11..D8
  TEST_ASSERT_EQUAL_HEX8(0xBC, hw().frame[2]);  // D7..D0
}

void test_command_byte_selects_channel() {
  TwoWire bus;
  MCP4728 dac(bus);
  const uint8_t expected[4] = {0x40, 0x42, 0x44, 0x46};
  for (int ch = 0; ch < 4; ++ch) {
    dac.channel(ch).write(1);
    TEST_ASSERT_EQUAL_HEX8(expected[ch], hw().frame[0]);
  }
}

void test_zero_and_full_scale() {
  TwoWire bus;
  MCP4728 dac(bus);
  dac.channel(3).write(0);
  TEST_ASSERT_EQUAL_HEX8(0x00, hw().frame[1]);
  TEST_ASSERT_EQUAL_HEX8(0x00, hw().frame[2]);
  dac.channel(3).write(4095);
  TEST_ASSERT_EQUAL_HEX8(0x0F, hw().frame[1]);
  TEST_ASSERT_EQUAL_HEX8(0xFF, hw().frame[2]);
}

void test_values_above_12_bit_are_clamped() {
  TwoWire bus;
  MCP4728 dac(bus);
  dac.channel(1).write(5000);
  // Must not spill into the reference/power-down/gain bits.
  TEST_ASSERT_EQUAL_HEX8(0x0F, hw().frame[1]);
  TEST_ASSERT_EQUAL_HEX8(0xFF, hw().frame[2]);
  dac.channel(1).write(0xFFFF);
  TEST_ASSERT_EQUAL_HEX8(0x0F, hw().frame[1]);
  TEST_ASSERT_EQUAL_HEX8(0xFF, hw().frame[2]);
}

void test_nack_returns_false() {
  TwoWire bus;
  MCP4728 dac(bus);
  hw().ack = false;
  TEST_ASSERT_FALSE(dac.channel(0).write(100));
  hw().ack = true;
  TEST_ASSERT_TRUE(dac.channel(0).write(100));
}

void test_out_of_range_channel_falls_back_to_a() {
  TwoWire bus;
  MCP4728 dac(bus);
  dac.channel(4).write(1);
  TEST_ASSERT_EQUAL_HEX8(0x40, hw().frame[0]);
  dac.channel(-1).write(1);
  TEST_ASSERT_EQUAL_HEX8(0x40, hw().frame[0]);
}

void test_actuator_full_scale_through_driver() {
  TwoWire bus;
  MCP4728 dac(bus);
  AnalogOutputActuator a("a", dac.channel(2));
  a.begin();
  TEST_ASSERT_EQUAL_HEX8(0x44, hw().frame[0]);
  TEST_ASSERT_EQUAL_HEX8(0x00, hw().frame[2]);  // begin() parks at the minimum
  a.write(1.0f);
  TEST_ASSERT_EQUAL_HEX8(0x0F, hw().frame[1]);
  TEST_ASSERT_EQUAL_HEX8(0xFF, hw().frame[2]);
  TEST_ASSERT_NULL(a.fault());
}

void test_actuator_nack_sets_and_clears_fault() {
  TwoWire bus;
  MCP4728 dac(bus);
  AnalogOutputActuator a("a", dac.channel(0));
  a.begin();
  hw().ack = false;
  a.write(0.5f);
  TEST_ASSERT_NOT_NULL(a.fault());
  hw().ack = true;
  a.write(0.5f);
  TEST_ASSERT_NULL(a.fault());
}

int main(int, char**) {
  UNITY_BEGIN();
  RUN_TEST(test_channels_report_12_bit);
  RUN_TEST(test_default_address_and_getter);
  RUN_TEST(test_frame_for_channel_a);
  RUN_TEST(test_command_byte_selects_channel);
  RUN_TEST(test_zero_and_full_scale);
  RUN_TEST(test_values_above_12_bit_are_clamped);
  RUN_TEST(test_nack_returns_false);
  RUN_TEST(test_out_of_range_channel_falls_back_to_a);
  RUN_TEST(test_actuator_full_scale_through_driver);
  RUN_TEST(test_actuator_nack_sets_and_clears_fault);
  return UNITY_END();
}
