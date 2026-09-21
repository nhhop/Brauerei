#include <unity.h>

#include "sensors/CalibratedSensor.h"
#include "../mocks/MockSensor.h"

using namespace SensActCtrl;
using SensActCtrl::test::MockSensor;

static SensorMeta contMeta() {
  return {ValueKind::Continuous, Quantity::Temperature, "C", -55.0f, 125.0f, 0.1f};
}

// Two channels like the YF-S201: continuous "rate" and cumulative "volume".
class TwoChannelSensor : public Sensor {
 public:
  const char* id() const override { return "yf"; }
  size_t channelCount() const override { return 2; }
  Channel channel(size_t i) const override {
    return i == 0
        ? Channel{"rate", {ValueKind::Continuous, Quantity::FlowRate, "L/min", 0, 30, 0.1f}, Reading(rate, 1, true)}
        : Channel{"volume", {ValueKind::Cumulative, Quantity::Volume, "L", 0, 1e6f, 0.01f}, Reading(volume, 1, true)};
  }
  void tick() override { ++ticks; }
  void begin() override { began = true; }
  void end() override { ended = true; }
  float rate = 0, volume = 0;
  int ticks = 0;
  bool began = false, ended = false;
};

void test_identity_by_default() {
  MockSensor m("t", contMeta());
  CalibratedSensor c(m);
  m.value = 21.5f;
  m.tick();
  TEST_ASSERT_EQUAL_STRING("t", c.id());
  TEST_ASSERT_EQUAL(1, c.channelCount());
  TEST_ASSERT_FLOAT_WITHIN(0.0001f, 21.5f, c.channel(0).reading.value);
  TEST_ASSERT_FLOAT_WITHIN(0.0001f, 21.5f, c.rawValue(0));
}

void test_offset() {
  // Thermometer reads 0.7 in ice water -> should be 0.
  MockSensor m("t", contMeta());
  CalibratedSensor c(m);
  m.value = 0.7f; m.tick();
  TEST_ASSERT_EQUAL(CalibratedSensor::Result::Ok, c.calibrateOffset(0, 0.7f, 0.0f));
  TEST_ASSERT_FLOAT_WITHIN(0.0001f, 0.0f, c.channel(0).reading.value);
  m.value = 65.7f; m.tick();
  TEST_ASSERT_FLOAT_WITHIN(0.0001f, 65.0f, c.channel(0).reading.value);
  // The raw value stays available for the calibration UI.
  TEST_ASSERT_FLOAT_WITHIN(0.0001f, 65.7f, c.rawValue(0));
}

void test_two_point() {
  // pH probe: raw 1443 -> pH 4, raw 2060 -> pH 7 (values from the design plan).
  MockSensor m("ph", {ValueKind::Continuous, Quantity::pH, "pH", 0, 14, 0.01f});
  CalibratedSensor c(m);
  TEST_ASSERT_EQUAL(CalibratedSensor::Result::Ok,
                    c.calibrateTwoPoint(0, 1443, 4, 2060, 7));
  m.value = 1000; m.tick();
  TEST_ASSERT_FLOAT_WITHIN(0.001f, 1.846f, c.channel(0).reading.value);
  m.value = 1443; m.tick();
  TEST_ASSERT_FLOAT_WITHIN(0.0001f, 4.0f, c.channel(0).reading.value);
  m.value = 2060; m.tick();
  TEST_ASSERT_FLOAT_WITHIN(0.0001f, 7.0f, c.channel(0).reading.value);
}

void test_two_point_equal_raw_is_rejected() {
  MockSensor m("ph", contMeta());
  CalibratedSensor c(m);
  TEST_ASSERT_EQUAL(CalibratedSensor::Result::InvalidPoints,
                    c.calibrateTwoPoint(0, 100, 4, 100, 7));
  // Rejected calibration leaves the identity in place.
  m.value = 50; m.tick();
  TEST_ASSERT_FLOAT_WITHIN(0.0001f, 50.0f, c.channel(0).reading.value);
}

void test_gain() {
  // Reads 4.6 L, real 5 L -> factor 5/4.6, through the origin.
  MockSensor m("f", contMeta());
  CalibratedSensor c(m);
  TEST_ASSERT_EQUAL(CalibratedSensor::Result::Ok, c.calibrateGain(0, 4.6f, 5.0f));
  m.value = 9.2f; m.tick();
  TEST_ASSERT_FLOAT_WITHIN(0.001f, 10.0f, c.channel(0).reading.value);
  m.value = 0.0f; m.tick();
  TEST_ASSERT_FLOAT_WITHIN(0.0001f, 0.0f, c.channel(0).reading.value);
}

void test_gain_with_zero_raw_is_rejected() {
  MockSensor m("f", contMeta());
  CalibratedSensor c(m);
  TEST_ASSERT_EQUAL(CalibratedSensor::Result::InvalidPoints, c.calibrateGain(0, 0.0f, 5.0f));
}

void test_offset_after_two_point_keeps_gain() {
  MockSensor m("ph", contMeta());
  CalibratedSensor c(m);
  c.calibrateTwoPoint(0, 1443, 4, 2060, 7);
  // Fine-tune the zero point only: raw 1443 should now read 4.5.
  TEST_ASSERT_EQUAL(CalibratedSensor::Result::Ok, c.calibrateOffset(0, 1443, 4.5f));
  m.value = 2060; m.tick();
  TEST_ASSERT_FLOAT_WITHIN(0.0001f, 7.5f, c.channel(0).reading.value);
}

void test_precision_with_large_raw_counts() {
  // HX711-like: ~8.4M counts. gain*raw+offset in float would lose the result;
  // the reference-point form must stay within a fraction of a gram.
  MockSensor m("w", {ValueKind::Continuous, Quantity::Mass, "g", 0, 5000, 0.1f});
  CalibratedSensor c(m);
  c.calibrateTwoPoint(0, 8400000.0f, 0.0f, 8500000.0f, 2000.0f);
  m.value = 8450000.0f; m.tick();
  TEST_ASSERT_FLOAT_WITHIN(0.1f, 1000.0f, c.channel(0).reading.value);
}

void test_invalid_reading_is_not_calibrated() {
  MockSensor m("t", contMeta());
  CalibratedSensor c(m);
  c.calibrateOffset(0, 1.0f, 0.0f);
  m.value = 5; m.valid = false; m.tick();
  TEST_ASSERT_FALSE(c.channel(0).reading.valid);
  TEST_ASSERT_FLOAT_WITHIN(0.0001f, 5.0f, c.channel(0).reading.value);
}

void test_multi_channel_and_cumulative_rules() {
  TwoChannelSensor s;
  CalibratedSensor c(s);
  TEST_ASSERT_EQUAL(2, c.channelCount());
  TEST_ASSERT_EQUAL_STRING("rate", c.channel(0).key);
  TEST_ASSERT_EQUAL_STRING("volume", c.channel(1).key);
  TEST_ASSERT_EQUAL(1, c.indexOfKey("volume"));
  TEST_ASSERT_EQUAL(-1, c.indexOfKey("nope"));

  // Cumulative: gain only.
  TEST_ASSERT_EQUAL(CalibratedSensor::Result::NotCalibratable, c.calibrateOffset(1, 1, 0));
  TEST_ASSERT_EQUAL(CalibratedSensor::Result::NotCalibratable, c.calibrateTwoPoint(1, 1, 0, 2, 3));
  TEST_ASSERT_EQUAL(CalibratedSensor::Result::Ok, c.calibrateGain(1, 4.6f, 5.0f));

  s.volume = 9.2f; s.rate = 3.0f;
  TEST_ASSERT_FLOAT_WITHIN(0.001f, 10.0f, c.channel(1).reading.value);
  // The other channel is unaffected.
  TEST_ASSERT_FLOAT_WITHIN(0.0001f, 3.0f, c.channel(0).reading.value);
  TEST_ASSERT_EQUAL(CalibratedSensor::Result::BadChannel, c.calibrateGain(2, 1, 1));
}

void test_binary_is_not_calibratable() {
  MockSensor m("d", {ValueKind::Binary, Quantity::None, "", 0, 1, 1});
  CalibratedSensor c(m);
  TEST_ASSERT_EQUAL(CalibratedSensor::Result::NotCalibratable, c.calibrateOffset(0, 1, 0));
}

void test_clear_restores_identity() {
  MockSensor m("t", contMeta());
  CalibratedSensor c(m);
  c.calibrateOffset(0, 1.0f, 0.0f);
  c.clear(0);
  m.value = 10; m.tick();
  TEST_ASSERT_FLOAT_WITHIN(0.0001f, 10.0f, c.channel(0).reading.value);
  TEST_ASSERT_FALSE(c.calibration(0).active);
}

void test_restore_from_persisted_values() {
  MockSensor m("t", contMeta());
  CalibratedSensor c(m);
  TEST_ASSERT_TRUE(c.setCalibration(0, 1443.0f, 4.0f, 0.004862f));
  m.value = 1443; m.tick();
  TEST_ASSERT_FLOAT_WITHIN(0.0001f, 4.0f, c.channel(0).reading.value);
  TEST_ASSERT_TRUE(c.calibration(0).active);
  TEST_ASSERT_FALSE(c.setCalibration(9, 0, 0, 1));
}

void test_forwarding() {
  TwoChannelSensor s;
  CalibratedSensor c(s);
  c.begin(); c.tick(); c.end();
  TEST_ASSERT_TRUE(s.began);
  TEST_ASSERT_TRUE(s.ended);
  TEST_ASSERT_EQUAL(1, s.ticks);

  MockSensor m("t", contMeta());
  CalibratedSensor c2(m);
  m.faultMsg = "boom";
  TEST_ASSERT_EQUAL_STRING("boom", c2.fault());
}

void setUp() {}
void tearDown() {}

int main(int, char**) {
  UNITY_BEGIN();
  RUN_TEST(test_identity_by_default);
  RUN_TEST(test_offset);
  RUN_TEST(test_two_point);
  RUN_TEST(test_two_point_equal_raw_is_rejected);
  RUN_TEST(test_gain);
  RUN_TEST(test_gain_with_zero_raw_is_rejected);
  RUN_TEST(test_offset_after_two_point_keeps_gain);
  RUN_TEST(test_precision_with_large_raw_counts);
  RUN_TEST(test_invalid_reading_is_not_calibrated);
  RUN_TEST(test_multi_channel_and_cumulative_rules);
  RUN_TEST(test_binary_is_not_calibratable);
  RUN_TEST(test_clear_restores_identity);
  RUN_TEST(test_restore_from_persisted_values);
  RUN_TEST(test_forwarding);
  return UNITY_END();
}
