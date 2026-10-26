// SensActCtrl/test/test_pmu_drivers/test_pmu_drivers.cpp
//
// SY6970Sensor and AXP2101Sensor on PmuSensor's channel layout, read
// interval, retry and hot-plug logic (the chips themselves are stubbed).
#include <unity.h>

#include <math.h>

#include "sensors/AXP2101Sensor.h"
#include "sensors/SY6970Sensor.h"

using SensActCtrl::AXP2101Sensor;
using SensActCtrl::PmuSensor;
using SensActCtrl::SY6970Sensor;
using SensActCtrl::ValueKind;

// Hooks defined by the native stub in PmuSensor.cpp.
namespace SensActCtrlTest {
extern bool     pmuPresent;
extern uint32_t pmuNowMs;
extern float    pmuVbatV;
extern float    pmuVbusV;
extern bool     pmuCharging;
extern bool     pmuBattery;
extern float    pmuExtra;
}  // namespace SensActCtrlTest

using namespace SensActCtrlTest;

namespace {
bool anyValid(const PmuSensor& s) {
  for (size_t i = 0; i < s.channelCount(); ++i)
    if (s.channel(i).reading.valid) return true;
  return false;
}

// Begin, read, lose the chip, get it back.
void checkDriver(PmuSensor& s, const char* extraKey) {
  TEST_ASSERT_EQUAL(4u, s.channelCount());
  const char* keys[] = {"vbat", "vbus", "charging", extraKey};
  for (size_t i = 0; i < 4; ++i) TEST_ASSERT_EQUAL_STRING(keys[i], s.channel(i).key);
  TEST_ASSERT_EQUAL_STRING("V", s.channel(0).meta.unit);
  TEST_ASSERT_TRUE(s.channel(2).meta.kind == ValueKind::Binary);

  s.tick();  // before begin(): nothing
  TEST_ASSERT_FALSE(anyValid(s));

  s.begin();
  s.tick();
  TEST_ASSERT_TRUE(s.channel(0).reading.valid);
  TEST_ASSERT_FLOAT_WITHIN(0.001f, 4.1f, s.channel(0).reading.value);
  TEST_ASSERT_FLOAT_WITHIN(0.001f, 0.0f, s.channel(1).reading.value);
  TEST_ASSERT_EQUAL_FLOAT(0.0f, s.channel(2).reading.value);

  pmuPresent = false;
  pmuNowMs += 1000;
  s.tick();
  TEST_ASSERT_FALSE(anyValid(s));

  pmuPresent = true;
  pmuNowMs += 10000;
  s.tick();
  TEST_ASSERT_TRUE(anyValid(s));
}
}  // namespace

void test_sy6970_driver() {
  SY6970Sensor s("pmu");
  checkDriver(s, "ichg");
  TEST_ASSERT_EQUAL_STRING("A", s.channel(3).meta.unit);
}

void test_axp2101_driver() {
  AXP2101Sensor s("pmu");
  checkDriver(s, "soc");
  TEST_ASSERT_EQUAL_STRING("%", s.channel(3).meta.unit);
}

void test_reads_at_most_once_per_second() {
  SY6970Sensor s("pmu");
  s.begin();
  s.tick();
  pmuVbatV = 3.7f;
  pmuNowMs += 500;
  s.tick();
  TEST_ASSERT_FLOAT_WITHIN(0.001f, 4.1f, s.channel(0).reading.value);
  pmuNowMs += 500;
  s.tick();
  TEST_ASSERT_FLOAT_WITHIN(0.001f, 3.7f, s.channel(0).reading.value);
}

void test_charging_usb_and_extra() {
  pmuVbusV    = 5.1f;
  pmuCharging = true;
  pmuExtra    = 63.0f;
  AXP2101Sensor s("pmu");
  s.begin();
  s.tick();
  TEST_ASSERT_FLOAT_WITHIN(0.001f, 5.1f, s.channel(1).reading.value);
  TEST_ASSERT_EQUAL_FLOAT(1.0f, s.channel(2).reading.value);
  TEST_ASSERT_TRUE(s.channel(3).reading.valid);
  TEST_ASSERT_EQUAL_FLOAT(63.0f, s.channel(3).reading.value);
}

void test_no_extra_value_is_invalid() {
  SY6970Sensor s("pmu");  // pmuExtra stays NaN
  s.begin();
  s.tick();
  TEST_ASSERT_FALSE(s.channel(3).reading.valid);
  TEST_ASSERT_TRUE(s.channel(2).reading.valid);
}

void test_no_battery_invalidates_vbat_only() {
  pmuBattery = false;
  pmuVbusV   = 5.0f;
  AXP2101Sensor s("pmu");
  s.begin();
  s.tick();
  TEST_ASSERT_FALSE(s.channel(0).reading.valid);
  TEST_ASSERT_TRUE(s.channel(1).reading.valid);

  pmuBattery = true;
  pmuVbatV   = 0.0f;  // SY6970 without a cell: raw 0
  SY6970Sensor t("pmu2");
  t.begin();
  t.tick();
  TEST_ASSERT_FALSE(t.channel(0).reading.valid);
}

void test_failed_connect_retries_after_five_seconds() {
  pmuPresent = false;
  SY6970Sensor s("pmu");
  s.begin();
  s.tick();
  TEST_ASSERT_FALSE(anyValid(s));
  pmuPresent = true;
  pmuNowMs += 4000;
  s.tick();
  TEST_ASSERT_FALSE(anyValid(s));
  pmuNowMs += 1000;
  s.tick();
  TEST_ASSERT_TRUE(anyValid(s));
}

// Same definition as the native shim in the drivers, so the test can own a
// bus the way BrewControl's PeripheralRegistry does.
class TwoWire { public: TwoWire() {} };

void test_caller_owned_bus() {
  TwoWire bus;
  SY6970Sensor  a("a", bus);
  AXP2101Sensor b("b", bus);
  a.begin(); b.begin();
  a.tick();  b.tick();
  TEST_ASSERT_TRUE(anyValid(a));
  TEST_ASSERT_TRUE(anyValid(b));
}

void setUp() {
  pmuPresent  = true;
  pmuNowMs    = 0;
  pmuVbatV    = 4.1f;
  pmuVbusV    = 0.0f;
  pmuCharging = false;
  pmuBattery  = true;
  pmuExtra    = NAN;
}
void tearDown() {}

int main(int, char**) {
  UNITY_BEGIN();
  RUN_TEST(test_sy6970_driver);
  RUN_TEST(test_axp2101_driver);
  RUN_TEST(test_reads_at_most_once_per_second);
  RUN_TEST(test_charging_usb_and_extra);
  RUN_TEST(test_no_extra_value_is_invalid);
  RUN_TEST(test_no_battery_invalidates_vbat_only);
  RUN_TEST(test_failed_connect_retries_after_five_seconds);
  RUN_TEST(test_caller_owned_bus);
  return UNITY_END();
}
