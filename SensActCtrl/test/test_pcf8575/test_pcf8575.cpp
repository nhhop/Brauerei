// PCF8575 driver: shadow register across channels, inputs held at 1, byte
// order, read cache, NACK handling, and the actuator/sensor on top of it.
#include <unity.h>

#include "actuators/DigitalOutputActuator.h"
#include "devices/PCF8575.h"
#include "sensors/DigitalInputSensor.h"

using namespace SensActCtrl;
using Mode = GpioPort::Mode;

// Native builds never touch the bus; any object will do as a stand-in.
class TwoWire {};

namespace {
Pcf8575TestState& hw() { return pcf8575TestState(); }
}  // namespace

void setUp() {
  hw() = Pcf8575TestState{};
}
void tearDown() {}

void test_sixteen_channels_and_address() {
  TwoWire bus;
  PCF8575 port(bus, 0x23);
  TEST_ASSERT_EQUAL_UINT8(16, port.channels());
  TEST_ASSERT_EQUAL_UINT8(0x23, port.address());
  TEST_ASSERT_EQUAL_UINT8(0x20, PCF8575(bus).address());
}

void test_begin_adopts_the_latches() {
  TwoWire bus;
  PCF8575 port(bus);
  hw().pins = 0xFF0F;  // P04..P07 sinking, e.g. relays left on before a reset
  TEST_ASSERT_TRUE(port.begin());
  TEST_ASSERT_EQUAL_UINT32(0, hw().writes);  // begin itself sends nothing
  TEST_ASSERT_TRUE(port.pinMode(0, Mode::Output));
  TEST_ASSERT_TRUE(port.write(0, false));
  // P00 now low, P04..P07 stay low, the rest stays high.
  TEST_ASSERT_EQUAL_HEX16(0xFF0E, hw().written);
}

void test_begin_without_answer_assumes_power_up_state() {
  TwoWire bus;
  PCF8575 port(bus);
  hw().ack = false;
  hw().pins = 0x0000;
  TEST_ASSERT_FALSE(port.begin());
  hw().ack = true;
  port.pinMode(3, Mode::Output);
  port.write(3, false);
  TEST_ASSERT_EQUAL_HEX16(0xFFF7, hw().written);
}

void test_write_keeps_other_channels() {
  TwoWire bus;
  PCF8575 port(bus);
  port.begin();
  const uint8_t outs[] = {0, 9, 15};
  for (uint8_t ch : outs) port.pinMode(ch, Mode::Output);
  port.write(0, false);
  port.write(9, false);
  port.write(15, false);
  TEST_ASSERT_EQUAL_HEX16(0x7DFE, hw().written);
  port.write(9, true);
  TEST_ASSERT_EQUAL_HEX16(0x7FFE, hw().written);
  TEST_ASSERT_EQUAL_UINT8(0x20, hw().address);
}

void test_inputs_are_always_sent_high() {
  TwoWire bus;
  PCF8575 port(bus);
  hw().pins = 0x0000;  // a pressed button reads 0 at begin()
  port.begin();
  port.pinMode(1, Mode::InputPullup);
  TEST_ASSERT_EQUAL_HEX16(0x0002, hw().written);
  port.pinMode(2, Mode::Input);  // no switchable pull-up: same as InputPullup
  TEST_ASSERT_EQUAL_HEX16(0x0006, hw().written);
  // An output write must not pull the inputs down.
  port.pinMode(0, Mode::Output);
  port.write(0, true);
  TEST_ASSERT_EQUAL_HEX16(0x0007, hw().written);
  port.write(1, false);  // a write to an input channel is ignored on the wire
  TEST_ASSERT_EQUAL_HEX16(0x0007, hw().written);
  // Back to output: the channel follows its latch again.
  port.pinMode(1, Mode::Output);
  TEST_ASSERT_EQUAL_HEX16(0x0005, hw().written);
}

void test_read_returns_pin_levels() {
  TwoWire bus;
  PCF8575 port(bus);
  hw().pins = 0x8001;  // P00 and P17 high
  bool high = false;
  TEST_ASSERT_TRUE(port.read(0, high));
  TEST_ASSERT_TRUE(high);
  TEST_ASSERT_TRUE(port.read(1, high));
  TEST_ASSERT_FALSE(high);
  TEST_ASSERT_TRUE(port.read(15, high));
  TEST_ASSERT_TRUE(high);
}

void test_reads_are_cached_per_window() {
  TwoWire bus;
  PCF8575 port(bus);
  bool high = false;
  for (uint8_t ch = 0; ch < 16; ++ch) port.read(ch, high);
  TEST_ASSERT_EQUAL_UINT32(1, hw().reads);
  hw().pins = 0x0000;
  hw().nowMs = PCF8575::kReadCacheMs - 1;
  port.read(0, high);
  TEST_ASSERT_TRUE(high);  // still the cached value
  TEST_ASSERT_EQUAL_UINT32(1, hw().reads);
  hw().nowMs = PCF8575::kReadCacheMs;
  port.read(0, high);
  TEST_ASSERT_FALSE(high);
  TEST_ASSERT_EQUAL_UINT32(2, hw().reads);
}

void test_nack_fails_write_and_read() {
  TwoWire bus;
  PCF8575 port(bus);
  hw().ack = false;
  TEST_ASSERT_FALSE(port.write(0, false));
  bool high = true;
  TEST_ASSERT_FALSE(port.read(0, high));
  TEST_ASSERT_TRUE(high);  // untouched
  // The failure is cached too: no bus hammering within the window.
  port.read(1, high);
  TEST_ASSERT_EQUAL_UINT32(1, hw().reads);
  hw().ack = true;
  hw().nowMs = PCF8575::kReadCacheMs;
  TEST_ASSERT_TRUE(port.read(1, high));
}

void test_out_of_range_channel_is_refused() {
  TwoWire bus;
  PCF8575 port(bus);
  bool high = false;
  TEST_ASSERT_FALSE(port.write(16, true));
  TEST_ASSERT_FALSE(port.pinMode(16, Mode::Output));
  TEST_ASSERT_FALSE(port.read(16, high));
  TEST_ASSERT_EQUAL_UINT32(0, hw().writes);
}

void test_actuator_and_sensor_share_the_port() {
  TwoWire bus;
  PCF8575 port(bus);
  port.begin();
  DigitalInputSensor button("btn", port, 8, true, true);
  DigitalOutputActuator relay("relay", port, 0, DigitalOutputActuator::Mode::Binary, false);
  button.begin();
  relay.begin();
  relay.setEnabled(true);  // active low: on = 0
  TEST_ASSERT_EQUAL_HEX16(0xFFFE, hw().written);
  hw().pins = 0xFEFE;  // button on P10 pressed to GND
  hw().nowMs = 100;
  button.tick();
  TEST_ASSERT_TRUE(button.channel(0).reading.valid);
  TEST_ASSERT_FLOAT_WITHIN(0.001f, 1.0f, button.channel(0).reading.value);
  relay.setEnabled(false);
  TEST_ASSERT_EQUAL_HEX16(0xFFFF, hw().written);
}

void test_unplugged_expander_faults_both() {
  TwoWire bus;
  PCF8575 port(bus);
  port.begin();
  DigitalInputSensor button("btn", port, 8, true);
  DigitalOutputActuator relay("relay", port, 0);
  button.begin();
  relay.begin();
  hw().ack = false;
  hw().nowMs = 100;
  relay.setEnabled(true);
  button.tick();
  TEST_ASSERT_NOT_NULL(relay.fault());
  TEST_ASSERT_NOT_NULL(button.fault());
  TEST_ASSERT_FALSE(button.channel(0).reading.valid);
}

int main(int, char**) {
  UNITY_BEGIN();
  RUN_TEST(test_sixteen_channels_and_address);
  RUN_TEST(test_begin_adopts_the_latches);
  RUN_TEST(test_begin_without_answer_assumes_power_up_state);
  RUN_TEST(test_write_keeps_other_channels);
  RUN_TEST(test_inputs_are_always_sent_high);
  RUN_TEST(test_read_returns_pin_levels);
  RUN_TEST(test_reads_are_cached_per_window);
  RUN_TEST(test_nack_fails_write_and_read);
  RUN_TEST(test_out_of_range_channel_is_refused);
  RUN_TEST(test_actuator_and_sensor_share_the_port);
  RUN_TEST(test_unplugged_expander_faults_both);
  return UNITY_END();
}
