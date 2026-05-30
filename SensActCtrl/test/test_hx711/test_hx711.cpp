#include <unity.h>
#include "sensors/HX711LoadCellSensor.h"
using namespace SensActCtrl;

// ── rawToMass ────────────────────────────────────────────────────────────────

void test_raw_to_mass_zero_offset_scale1() {
    HX711LoadCellSensor s("scale", 1, 2);
    // offset=0, scale=1 → rawToMass(1000) == 1000.0
    TEST_ASSERT_FLOAT_WITHIN(0.01f, 1000.0f, s.rawToMass(1000));
}

void test_raw_to_mass_with_offset() {
    HX711LoadCellSensor s("scale", 1, 2);
    // setOffset(100): rawToMass(1100) → (1100-100)*1.0 = 1000
    s.setOffset(100);
    TEST_ASSERT_FLOAT_WITHIN(0.01f, 1000.0f, s.rawToMass(1100));
}

void test_raw_to_mass_with_scale() {
    HX711LoadCellSensor s("scale", 1, 2);
    // scale = 0.5 g/count: rawToMass(2000) → 2000 * 0.5 = 1000
    s.setScale(0.5f);
    TEST_ASSERT_FLOAT_WITHIN(0.01f, 1000.0f, s.rawToMass(2000));
}

void test_raw_to_mass_offset_and_scale() {
    HX711LoadCellSensor s("scale", 1, 2);
    // offset=500, scale=0.5: rawToMass(2500) → (2500-500)*0.5 = 1000
    s.setOffset(500);
    s.setScale(0.5f);
    TEST_ASSERT_FLOAT_WITHIN(0.01f, 1000.0f, s.rawToMass(2500));
}

// ── tare ─────────────────────────────────────────────────────────────────────

void test_tare_zeros_current_reading() {
    HX711LoadCellSensor s("scale", 1, 2);
    s.setScale(1.0f);
    s.injectRawForTest(300);
    s.tick();  // captures raw=300 into last reading
    s.tare();  // offset_ = 300
    TEST_ASSERT_FLOAT_WITHIN(0.01f, 0.0f, s.rawToMass(300));
}

// ── ready gating ─────────────────────────────────────────────────────────────

void test_no_update_when_not_ready() {
    HX711LoadCellSensor s("scale", 1, 2);
    s.setScale(1.0f);
    // injectRawForTest without tick: channel value should stay invalid
    const Channel ch = s.channel(0);
    TEST_ASSERT_FALSE(ch.reading.valid);
}

void test_update_when_ready() {
    HX711LoadCellSensor s("scale", 1, 2);
    s.setScale(1.0f);
    s.injectRawForTest(500);
    s.tick();
    const Channel ch = s.channel(0);
    TEST_ASSERT_TRUE(ch.reading.valid);
    TEST_ASSERT_FLOAT_WITHIN(0.01f, 500.0f, ch.reading.value);
}

// ── meta ─────────────────────────────────────────────────────────────────────

void test_meta_quantity_is_mass() {
    HX711LoadCellSensor s("scale", 1, 2);
    TEST_ASSERT_EQUAL(static_cast<int>(Quantity::Mass),
                      static_cast<int>(s.channel(0).meta.quantity));
}

void test_meta_kind_is_continuous() {
    HX711LoadCellSensor s("scale", 1, 2);
    TEST_ASSERT_EQUAL(static_cast<int>(ValueKind::Continuous),
                      static_cast<int>(s.channel(0).meta.kind));
}

void test_channel_count_is_one() {
    HX711LoadCellSensor s("scale", 1, 2);
    TEST_ASSERT_EQUAL(1u, s.channelCount());
}

void setUp()    {}
void tearDown() {}

int main(int, char**) {
    UNITY_BEGIN();
    RUN_TEST(test_raw_to_mass_zero_offset_scale1);
    RUN_TEST(test_raw_to_mass_with_offset);
    RUN_TEST(test_raw_to_mass_with_scale);
    RUN_TEST(test_raw_to_mass_offset_and_scale);
    RUN_TEST(test_tare_zeros_current_reading);
    RUN_TEST(test_no_update_when_not_ready);
    RUN_TEST(test_update_when_ready);
    RUN_TEST(test_meta_quantity_is_mass);
    RUN_TEST(test_meta_kind_is_continuous);
    RUN_TEST(test_channel_count_is_one);
    return UNITY_END();
}
