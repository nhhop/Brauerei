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
    return UNITY_END();
}
