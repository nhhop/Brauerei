#include <unity.h>
#include "actuators/AnalogOutputActuator.h"
using namespace SensActCtrl;

void test_default_zero() {
    AnalogOutputActuator a("a", 1);
    TEST_ASSERT_EQUAL_UINT32(0, a.valueToRaw(0.0f));
}

void test_default_full() {
    AnalogOutputActuator a("a", 1);
    // 12-bit default → rawMax = 4095
    TEST_ASSERT_EQUAL_UINT32(4095, a.valueToRaw(1.0f));
}

void test_default_mid() {
    AnalogOutputActuator a("a", 1);
    // 0.5 * 4095 = 2047.5 → truncates to 2047
    TEST_ASSERT_EQUAL_UINT32(2047, a.valueToRaw(0.5f));
}

void test_clamp_below_min() {
    AnalogOutputActuator a("a", 1);
    TEST_ASSERT_EQUAL_UINT32(0, a.valueToRaw(-1.0f));
}

void test_clamp_above_max() {
    AnalogOutputActuator a("a", 1);
    TEST_ASSERT_EQUAL_UINT32(4095, a.valueToRaw(2.0f));
}

void test_set_range_calibration() {
    AnalogOutputActuator a("a", 1);
    a.setRange(Quantity::Temperature, "C", 0.0f, 100.0f, 0.1f);
    TEST_ASSERT_EQUAL_UINT32(0,    a.valueToRaw(0.0f));
    TEST_ASSERT_EQUAL_UINT32(4095, a.valueToRaw(100.0f));
    TEST_ASSERT_EQUAL_UINT32(2047, a.valueToRaw(50.0f));
}

void test_set_range_clamp() {
    AnalogOutputActuator a("a", 1);
    a.setRange(Quantity::Temperature, "C", 0.0f, 100.0f, 0.1f);
    TEST_ASSERT_EQUAL_UINT32(0,    a.valueToRaw(-10.0f));
    TEST_ASSERT_EQUAL_UINT32(4095, a.valueToRaw(200.0f));
}

void test_8bit_resolution() {
    AnalogOutputActuator a("a", 1);
    a.setResolutionBits(8);
    TEST_ASSERT_EQUAL_UINT32(255, a.valueToRaw(1.0f));
    TEST_ASSERT_EQUAL_UINT32(0,   a.valueToRaw(0.0f));
    // 0.5 * 255 = 127.5 → 127
    TEST_ASSERT_EQUAL_UINT32(127, a.valueToRaw(0.5f));
}

void test_dac_mode_raw_max() {
    AnalogOutputActuator a("a", 1, AnalogOutputActuator::Mode::Dac);
    TEST_ASSERT_EQUAL_UINT32(255, a.valueToRaw(1.0f));
    TEST_ASSERT_EQUAL_UINT32(0,   a.valueToRaw(0.0f));
}

void test_meta_defaults() {
    AnalogOutputActuator a("a", 1);
    ActuatorMeta m = a.meta();
    TEST_ASSERT_EQUAL(static_cast<int>(ValueKind::Continuous), static_cast<int>(m.kind));
    TEST_ASSERT_EQUAL(static_cast<int>(Quantity::DutyCycle),   static_cast<int>(m.quantity));
    TEST_ASSERT_FLOAT_WITHIN(0.001f, 0.0f,  m.min);
    TEST_ASSERT_FLOAT_WITHIN(0.001f, 1.0f,  m.max);
    TEST_ASSERT_FLOAT_WITHIN(0.001f, 0.01f, m.resolution);
}

void test_meta_after_set_range() {
    AnalogOutputActuator a("a", 1);
    a.setRange(Quantity::Mass, "g", 0.0f, 500.0f, 1.0f);
    ActuatorMeta m = a.meta();
    TEST_ASSERT_EQUAL(static_cast<int>(Quantity::Mass), static_cast<int>(m.quantity));
    TEST_ASSERT_FLOAT_WITHIN(0.001f, 0.0f,   m.min);
    TEST_ASSERT_FLOAT_WITHIN(0.001f, 500.0f, m.max);
}

void test_state_after_write() {
    AnalogOutputActuator a("a", 1);
    a.write(0.5f);
    TEST_ASSERT_FLOAT_WITHIN(0.001f, 0.5f, a.state());
}

void test_state_clamped_below() {
    AnalogOutputActuator a("a", 1);
    a.write(-1.0f);
    TEST_ASSERT_FLOAT_WITHIN(0.001f, 0.0f, a.state());
}

void test_state_clamped_above() {
    AnalogOutputActuator a("a", 1);
    a.write(2.0f);
    TEST_ASSERT_FLOAT_WITHIN(0.001f, 1.0f, a.state());
}

void test_end_detaches_ledc_pin_in_pwm_mode() {
    AnalogOutputActuator a("a", 1, AnalogOutputActuator::Mode::Pwm);
    a.begin();
    uint8_t before = analogOutputActuatorLedcDetachCallCountForTest();
    a.end();
    TEST_ASSERT_EQUAL_UINT8(before + 1, analogOutputActuatorLedcDetachCallCountForTest());
}

void test_end_does_not_detach_ledc_pin_in_dac_mode() {
    AnalogOutputActuator a("a", 1, AnalogOutputActuator::Mode::Dac);
    a.begin();
    uint8_t before = analogOutputActuatorLedcDetachCallCountForTest();
    a.end();
    TEST_ASSERT_EQUAL_UINT8(before, analogOutputActuatorLedcDetachCallCountForTest());
}

void test_disabled_drives_peripheral_to_min_but_keeps_target() {
    AnalogOutputActuator a("a", 1);
    a.begin();
    a.write(0.5f);
    TEST_ASSERT_EQUAL_UINT32(2047, analogOutputActuatorLastRawForTest());

    a.setEnabled(false);
    TEST_ASSERT_EQUAL_UINT32(0, analogOutputActuatorLastRawForTest());  // hw at min
    TEST_ASSERT_FLOAT_WITHIN(0.001f, 0.5f, a.target());  // setpoint remembered
    TEST_ASSERT_FLOAT_WITHIN(0.001f, 0.0f, a.state());   // …but nothing driven

    a.setEnabled(true);
    TEST_ASSERT_EQUAL_UINT32(2047, analogOutputActuatorLastRawForTest());  // resumed
    TEST_ASSERT_FLOAT_WITHIN(0.001f, 0.5f, a.state());
}

void test_write_while_disabled_updates_target_without_touching_peripheral() {
    AnalogOutputActuator a("a", 1);
    a.begin();
    a.setEnabled(false);
    a.write(0.75f);
    TEST_ASSERT_EQUAL_UINT32(0, analogOutputActuatorLastRawForTest());
    TEST_ASSERT_FLOAT_WITHIN(0.001f, 0.75f, a.target());

    a.setEnabled(true);
    TEST_ASSERT_EQUAL_UINT32(3071, analogOutputActuatorLastRawForTest());  // 0.75*4095
}

// --- external DAC (DacOutput) ------------------------------------------------

namespace {
struct FakeDac : DacOutput {
    uint16_t last   = 0xFFFF;
    int      writes = 0;
    bool     ok     = true;
    uint16_t rawMax() const override { return 4095; }
    bool write(uint16_t raw) override { last = raw; ++writes; return ok; }
};
}  // namespace

void test_ext_dac_levels() {
    FakeDac d;
    AnalogOutputActuator a("a", d);
    a.begin();
    TEST_ASSERT_EQUAL_UINT16(0, d.last);
    a.write(0.0f);    TEST_ASSERT_EQUAL_UINT16(0,    d.last);
    a.write(0.5f);    TEST_ASSERT_EQUAL_UINT16(2047, d.last);
    a.write(1.0f);    TEST_ASSERT_EQUAL_UINT16(4095, d.last);
}

void test_ext_dac_uses_converter_raw_max() {
    struct Dac8 : DacOutput {
        uint16_t last = 0;
        uint16_t rawMax() const override { return 255; }
        bool write(uint16_t raw) override { last = raw; return true; }
    } d;
    AnalogOutputActuator a("a", d);
    a.write(1.0f);
    TEST_ASSERT_EQUAL_UINT16(255, d.last);
    TEST_ASSERT_EQUAL_UINT32(255, a.rawMax());
}

void test_ext_dac_set_range() {
    FakeDac d;
    AnalogOutputActuator a("a", d);
    a.setRange(Quantity::Temperature, "C", 0.0f, 100.0f, 0.1f);
    a.write(50.0f);
    TEST_ASSERT_EQUAL_UINT16(2047, d.last);
    a.write(200.0f);
    TEST_ASSERT_EQUAL_UINT16(4095, d.last);
}

void test_ext_dac_disabled_writes_minimum_and_resumes() {
    FakeDac d;
    AnalogOutputActuator a("a", d);
    a.begin();
    a.write(0.5f);
    a.setEnabled(false);
    TEST_ASSERT_EQUAL_UINT16(0, d.last);
    TEST_ASSERT_FLOAT_WITHIN(0.001f, 0.5f, a.target());
    a.setEnabled(true);
    TEST_ASSERT_EQUAL_UINT16(2047, d.last);
}

void test_ext_dac_end_writes_minimum() {
    FakeDac d;
    AnalogOutputActuator a("a", d);
    a.begin();
    a.write(1.0f);
    a.end();
    TEST_ASSERT_EQUAL_UINT16(0, d.last);
}

void test_ext_dac_does_not_touch_ledc() {
    FakeDac d;
    AnalogOutputActuator a("a", d);
    uint8_t before = analogOutputActuatorLedcDetachCallCountForTest();
    a.begin();
    a.end();
    TEST_ASSERT_EQUAL_UINT8(before, analogOutputActuatorLedcDetachCallCountForTest());
}

void test_ext_dac_fault_follows_write_result() {
    FakeDac d;
    AnalogOutputActuator a("a", d);
    a.begin();
    TEST_ASSERT_NULL(a.fault());
    d.ok = false;
    a.write(0.5f);
    TEST_ASSERT_NOT_NULL(a.fault());
    d.ok = true;
    a.write(0.5f);
    TEST_ASSERT_NULL(a.fault());
}

void test_ext_dac_tick_refreshes_every_second() {
    analogOutputActuatorSetMillisForTest(10000);
    FakeDac d;
    AnalogOutputActuator a("a", d);
    a.begin();
    a.write(0.5f);
    const int writes = d.writes;
    analogOutputActuatorSetMillisForTest(10999);
    a.tick();
    TEST_ASSERT_EQUAL(writes, d.writes);
    // Re-plugged chip came back at 0 V: the refresh restores the value.
    d.last = 0;
    analogOutputActuatorSetMillisForTest(11000);
    a.tick();
    TEST_ASSERT_EQUAL(writes + 1, d.writes);
    TEST_ASSERT_EQUAL_UINT16(2047, d.last);
    a.tick();
    TEST_ASSERT_EQUAL(writes + 1, d.writes);
}

void test_ext_dac_refresh_detects_missing_chip_without_value_change() {
    analogOutputActuatorSetMillisForTest(20000);
    FakeDac d;
    AnalogOutputActuator a("a", d);
    a.begin();
    a.write(0.5f);
    d.ok = false;
    analogOutputActuatorSetMillisForTest(21000);
    a.tick();
    TEST_ASSERT_NOT_NULL(a.fault());
    d.ok = true;
    analogOutputActuatorSetMillisForTest(22000);
    a.tick();
    TEST_ASSERT_NULL(a.fault());
}

void test_ext_dac_refresh_keeps_disabled_minimum() {
    analogOutputActuatorSetMillisForTest(30000);
    FakeDac d;
    AnalogOutputActuator a("a", d);
    a.begin();
    a.write(0.5f);
    a.setEnabled(false);
    d.last = 0xFFFF;
    analogOutputActuatorSetMillisForTest(31000);
    a.tick();
    TEST_ASSERT_EQUAL_UINT16(0, d.last);
}

void test_gpio_actuator_tick_writes_nothing() {
    AnalogOutputActuator a("a", 1);
    a.begin();
    a.write(0.5f);
    const uint32_t raw = analogOutputActuatorLastRawForTest();
    analogOutputActuatorSetMillisForTest(1000000);
    a.tick();
    TEST_ASSERT_EQUAL_UINT32(raw, analogOutputActuatorLastRawForTest());
}

void test_gpio_actuator_has_no_fault() {
    AnalogOutputActuator a("a", 1);
    a.begin();
    a.write(0.5f);
    TEST_ASSERT_NULL(a.fault());
}

void setUp()    {}
void tearDown() {}

int main(int, char**) {
    UNITY_BEGIN();
    RUN_TEST(test_default_zero);
    RUN_TEST(test_default_full);
    RUN_TEST(test_default_mid);
    RUN_TEST(test_clamp_below_min);
    RUN_TEST(test_clamp_above_max);
    RUN_TEST(test_set_range_calibration);
    RUN_TEST(test_set_range_clamp);
    RUN_TEST(test_8bit_resolution);
    RUN_TEST(test_dac_mode_raw_max);
    RUN_TEST(test_meta_defaults);
    RUN_TEST(test_meta_after_set_range);
    RUN_TEST(test_state_after_write);
    RUN_TEST(test_state_clamped_below);
    RUN_TEST(test_state_clamped_above);
    RUN_TEST(test_end_detaches_ledc_pin_in_pwm_mode);
    RUN_TEST(test_end_does_not_detach_ledc_pin_in_dac_mode);
    RUN_TEST(test_disabled_drives_peripheral_to_min_but_keeps_target);
    RUN_TEST(test_write_while_disabled_updates_target_without_touching_peripheral);
    RUN_TEST(test_ext_dac_levels);
    RUN_TEST(test_ext_dac_uses_converter_raw_max);
    RUN_TEST(test_ext_dac_set_range);
    RUN_TEST(test_ext_dac_disabled_writes_minimum_and_resumes);
    RUN_TEST(test_ext_dac_end_writes_minimum);
    RUN_TEST(test_ext_dac_does_not_touch_ledc);
    RUN_TEST(test_ext_dac_fault_follows_write_result);
    RUN_TEST(test_ext_dac_tick_refreshes_every_second);
    RUN_TEST(test_ext_dac_refresh_detects_missing_chip_without_value_change);
    RUN_TEST(test_ext_dac_refresh_keeps_disabled_minimum);
    RUN_TEST(test_gpio_actuator_tick_writes_nothing);
    RUN_TEST(test_gpio_actuator_has_no_fault);
    return UNITY_END();
}
