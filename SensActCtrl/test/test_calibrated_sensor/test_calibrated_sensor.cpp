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

// ── Polynomial (multi-point) calibration ─────────────────────────────────────

void test_poly_degree_one_matches_two_point() {
  // Same pH points as test_two_point; degree 1 must reproduce that line, and
  // raw 1000 lies outside the hull, so it also covers the linear continuation.
  MockSensor m("ph", {ValueKind::Continuous, Quantity::pH, "pH", 0, 14, 0.01f});
  CalibratedSensor c(m);
  const float raws[] = {1443, 2060}, vals[] = {4, 7};
  TEST_ASSERT_EQUAL(CalibratedSensor::Result::Ok, c.calibratePoly(0, raws, vals, 2, 1));
  m.value = 1443; m.tick();
  TEST_ASSERT_FLOAT_WITHIN(0.001f, 4.0f, c.channel(0).reading.value);
  m.value = 2060; m.tick();
  TEST_ASSERT_FLOAT_WITHIN(0.001f, 7.0f, c.channel(0).reading.value);
  m.value = 1000; m.tick();
  TEST_ASSERT_FLOAT_WITHIN(0.001f, 1.846f, c.channel(0).reading.value);
}

void test_poly_exact_interpolation_quadratic() {
  // Four points on v = raw^2, degree 2 -> the fit is exact.
  MockSensor m("t", contMeta());
  CalibratedSensor c(m);
  const float raws[] = {0, 1, 2, 3}, vals[] = {0, 1, 4, 9};
  TEST_ASSERT_EQUAL(CalibratedSensor::Result::Ok, c.calibratePoly(0, raws, vals, 4, 2));
  m.value = 1.5f; m.tick();
  TEST_ASSERT_FLOAT_WITHIN(0.001f, 2.25f, c.channel(0).reading.value);
  m.value = 0.5f; m.tick();
  TEST_ASSERT_FLOAT_WITHIN(0.001f, 0.25f, c.channel(0).reading.value);
  m.value = 2.5f; m.tick();
  TEST_ASSERT_FLOAT_WITHIN(0.001f, 6.25f, c.channel(0).reading.value);
}

void test_poly_least_squares_overdetermined() {
  // Five points, last one off the line by +1, degree 1: least squares gives
  // slope 22/10 = 2.2 and intercept 5.2 - 2.2*2 = 0.8.
  MockSensor m("t", contMeta());
  CalibratedSensor c(m);
  const float raws[] = {0, 1, 2, 3, 4}, vals[] = {1, 3, 5, 7, 10};
  TEST_ASSERT_EQUAL(CalibratedSensor::Result::Ok, c.calibratePoly(0, raws, vals, 5, 1));
  m.value = 0; m.tick();
  TEST_ASSERT_FLOAT_WITHIN(0.001f, 0.8f, c.channel(0).reading.value);
  m.value = 2; m.tick();
  TEST_ASSERT_FLOAT_WITHIN(0.001f, 5.2f, c.channel(0).reading.value);
  m.value = 4; m.tick();
  TEST_ASSERT_FLOAT_WITHIN(0.001f, 9.6f, c.channel(0).reading.value);
}

void test_poly_hx711_magnitude() {
  // 24-bit counts on a straight line, fitted as a cubic. Without centring and
  // scaling the raw values the normal equations reach ~1e41 and this fails.
  MockSensor m("w", {ValueKind::Continuous, Quantity::Mass, "g", 0, 5000, 0.1f});
  CalibratedSensor c(m);
  const float raws[] = {8400000.0f, 8450000.0f, 8500000.0f, 8550000.0f};
  const float vals[] = {0.0f, 1000.0f, 2000.0f, 3000.0f};
  TEST_ASSERT_EQUAL(CalibratedSensor::Result::Ok, c.calibratePoly(0, raws, vals, 4, 3));
  TEST_ASSERT_TRUE(c.calibration(0).rawScale > 0.0f);
  m.value = 8425000.0f; m.tick();
  TEST_ASSERT_FLOAT_WITHIN(0.5f, 500.0f, c.channel(0).reading.value);
  m.value = 8475000.0f; m.tick();
  TEST_ASSERT_FLOAT_WITHIN(0.5f, 1500.0f, c.channel(0).reading.value);
}

void test_poly_rejects_bad_input() {
  MockSensor m("t", contMeta());
  CalibratedSensor c(m);
  const float raws[] = {0, 1, 2, 3, 4, 5, 6, 7, 8};
  const float vals[] = {0, 1, 2, 3, 4, 5, 6, 7, 8};
  // Degree out of range.
  TEST_ASSERT_EQUAL(CalibratedSensor::Result::InvalidPoints,
                    c.calibratePoly(0, raws, vals, 4, 0));
  TEST_ASSERT_EQUAL(CalibratedSensor::Result::InvalidPoints,
                    c.calibratePoly(0, raws, vals, 4, 4));
  // Fewer than degree+1 points, and more than kMaxPoints.
  TEST_ASSERT_EQUAL(CalibratedSensor::Result::InvalidPoints,
                    c.calibratePoly(0, raws, vals, 2, 2));
  TEST_ASSERT_EQUAL(CalibratedSensor::Result::InvalidPoints,
                    c.calibratePoly(0, raws, vals, 9, 1));
  // Duplicate raw values, and a non-finite value.
  const float dupRaws[] = {100, 100, 200}, dupVals[] = {1, 2, 3};
  TEST_ASSERT_EQUAL(CalibratedSensor::Result::InvalidPoints,
                    c.calibratePoly(0, dupRaws, dupVals, 3, 1));
  const float nanVals[] = {0, NAN, 2, 3};
  TEST_ASSERT_EQUAL(CalibratedSensor::Result::InvalidPoints,
                    c.calibratePoly(0, raws, nanVals, 4, 1));
  // Every rejection leaves the identity in place.
  TEST_ASSERT_FALSE(c.calibration(0).active);
  m.value = 50; m.tick();
  TEST_ASSERT_FLOAT_WITHIN(0.0001f, 50.0f, c.channel(0).reading.value);
}

void test_poly_not_on_cumulative() {
  TwoChannelSensor inner;
  CalibratedSensor c(inner);
  const float raws[] = {0, 1, 2}, vals[] = {0, 1, 4};
  TEST_ASSERT_EQUAL(CalibratedSensor::Result::NotCalibratable,
                    c.calibratePoly(1, raws, vals, 3, 2));
  TEST_ASSERT_EQUAL(CalibratedSensor::Result::Ok,
                    c.calibratePoly(0, raws, vals, 3, 2));
}

void test_poly_is_replaced_by_linear_modes() {
  const float raws[] = {0, 1, 2, 3}, vals[] = {0, 1, 4, 9};
  // (a) two-point after poly: degree is dropped and the line takes over.
  {
    MockSensor m("t", contMeta());
    CalibratedSensor c(m);
    c.calibratePoly(0, raws, vals, 4, 2);
    TEST_ASSERT_EQUAL(CalibratedSensor::Result::Ok, c.calibrateTwoPoint(0, 0, 0, 2, 2));
    TEST_ASSERT_EQUAL(0, c.calibration(0).degree);
    m.value = 3; m.tick();
    TEST_ASSERT_FLOAT_WITHIN(0.001f, 3.0f, c.channel(0).reading.value);
  }
  // (b) restoring persisted linear values over a polynomial.
  {
    MockSensor m("t", contMeta());
    CalibratedSensor c(m);
    c.calibratePoly(0, raws, vals, 4, 2);
    TEST_ASSERT_TRUE(c.setCalibration(0, 1443.0f, 4.0f, 0.004862f));
    TEST_ASSERT_EQUAL(0, c.calibration(0).degree);
    TEST_ASSERT_EQUAL(0, c.calibration(0).pointCount);
    m.value = 1443; m.tick();
    TEST_ASSERT_FLOAT_WITHIN(0.0001f, 4.0f, c.channel(0).reading.value);
  }
  // (c) clear wipes the polynomial too; offset is refused while one is active.
  {
    MockSensor m("t", contMeta());
    CalibratedSensor c(m);
    c.calibratePoly(0, raws, vals, 4, 2);
    TEST_ASSERT_EQUAL(CalibratedSensor::Result::NotCalibratable,
                      c.calibrateOffset(0, 1.0f, 0.0f));
    c.clear(0);
    TEST_ASSERT_FALSE(c.calibration(0).active);
    TEST_ASSERT_EQUAL(0, c.calibration(0).degree);
    TEST_ASSERT_EQUAL(0, c.calibration(0).pointCount);
    m.value = 10; m.tick();
    TEST_ASSERT_FLOAT_WITHIN(0.0001f, 10.0f, c.channel(0).reading.value);
  }
}

void test_poly_extrapolation_is_linear() {
  // v = raw^2 on [0,3]; beyond the hull the tangent continues instead of the
  // parabola: P(3) + P'(3)*1 = 15, not 16.
  MockSensor m("t", contMeta());
  CalibratedSensor c(m);
  const float raws[] = {0, 1, 2, 3}, vals[] = {0, 1, 4, 9};
  c.calibratePoly(0, raws, vals, 4, 2);
  m.value = 4; m.tick();
  TEST_ASSERT_FLOAT_WITHIN(0.01f, 15.0f, c.channel(0).reading.value);
  m.value = -1; m.tick();
  TEST_ASSERT_FLOAT_WITHIN(0.01f, 0.0f, c.channel(0).reading.value);
}

void test_poly_refit_roundtrip() {
  // The stored points are the truth: feeding them back into a fresh sensor
  // reproduces the same curve. This is what happens on every reload.
  MockSensor m("t", contMeta());
  CalibratedSensor c(m);
  const float raws[] = {0, 1, 2, 3, 4}, vals[] = {1, 3, 5, 7, 10};
  c.calibratePoly(0, raws, vals, 5, 2);
  const CalibratedSensor::Calibration saved = c.calibration(0);
  TEST_ASSERT_EQUAL(5, saved.pointCount);
  TEST_ASSERT_EQUAL(2, saved.degree);

  MockSensor m2("t", contMeta());
  CalibratedSensor c2(m2);
  float rr[CalibratedSensor::kMaxPoints], vv[CalibratedSensor::kMaxPoints];
  for (size_t i = 0; i < saved.pointCount; ++i) {
    rr[i] = saved.points[i][0];
    vv[i] = saved.points[i][1];
  }
  TEST_ASSERT_EQUAL(CalibratedSensor::Result::Ok,
                    c2.calibratePoly(0, rr, vv, saved.pointCount, saved.degree));
  const float probes[] = {0.5f, 2.5f, 3.5f};
  for (float probe : probes) {
    m.value = probe;  m.tick();
    m2.value = probe; m2.tick();
    TEST_ASSERT_EQUAL_FLOAT(c.channel(0).reading.value, c2.channel(0).reading.value);
  }
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
  RUN_TEST(test_poly_degree_one_matches_two_point);
  RUN_TEST(test_poly_exact_interpolation_quadratic);
  RUN_TEST(test_poly_least_squares_overdetermined);
  RUN_TEST(test_poly_hx711_magnitude);
  RUN_TEST(test_poly_rejects_bad_input);
  RUN_TEST(test_poly_not_on_cumulative);
  RUN_TEST(test_poly_is_replaced_by_linear_modes);
  RUN_TEST(test_poly_extrapolation_is_linear);
  RUN_TEST(test_poly_refit_roundtrip);
  return UNITY_END();
}
