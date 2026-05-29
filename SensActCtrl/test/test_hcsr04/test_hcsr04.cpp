// SensActCtrl/test/test_hcsr04/test_hcsr04.cpp
#include <unity.h>
#include <ArduinoJson.h>
#include "sensors/HCSR04Sensor.h"
#include "core/Registry.h"
#include "core/RegistrySnapshot.h"

using SensActCtrl::HCSR04Sensor;
using SensActCtrl::Channel;
using SensActCtrl::Quantity;
using SensActCtrl::ValueKind;
using SensActCtrl::Registry;
using SensActCtrl::serializeRegistry;

// ── Structure tests (pass with stub) ─────────────────────────────────────────

void test_channel_count_and_keys() {
  HCSR04Sensor s("tank", 5, 18);
  TEST_ASSERT_EQUAL(2u, s.channelCount());
  TEST_ASSERT_EQUAL_STRING("distance", s.channel(0).key);
  TEST_ASSERT_EQUAL_STRING("derived",  s.channel(1).key);
}

void test_channel_meta_distance() {
  HCSR04Sensor s("tank", 5, 18);
  Channel ch = s.channel(0);
  TEST_ASSERT_EQUAL(Quantity::Distance,    ch.meta.quantity);
  TEST_ASSERT_EQUAL_STRING("cm",           ch.meta.unit);
  TEST_ASSERT_EQUAL(ValueKind::Continuous, ch.meta.kind);
}

void test_derived_invalid_without_scale() {
  HCSR04Sensor s("tank", 5, 18);
  TEST_ASSERT_FALSE(s.channel(1).reading.valid);
}

void test_readings_invalid_before_first_measurement() {
  HCSR04Sensor s("tank", 5, 18);
  s.begin();
  TEST_ASSERT_FALSE(s.channel(0).reading.valid);
  TEST_ASSERT_FALSE(s.channel(1).reading.valid);
}

// ── Behavioural tests (fail with stub) ───────────────────────────────────────

void test_distance_calculates_correctly() {
  HCSR04Sensor s("tank", 5, 18);
  s.begin();
  HCSR04Sensor::advanceMillisForTest(60);  // elapsed >= kIntervalMs → trigger fires
  s.tick();                                // → TRIGGERED
  s.injectEchoForTest(580);               // 580 µs / 58 = 10.0 cm → DONE
  s.tick();                                // processes DONE → valid reading
  TEST_ASSERT_TRUE(s.channel(0).reading.valid);
  TEST_ASSERT_FLOAT_WITHIN(0.1f, 10.0f, s.channel(0).reading.value);
}

void test_derived_with_scale_and_offset() {
  HCSR04Sensor s("tank", 5, 18);
  s.setScale(2.0f, 5.0f, "L");
  s.begin();
  HCSR04Sensor::advanceMillisForTest(60);
  s.tick();
  s.injectEchoForTest(580);  // 10 cm
  s.tick();
  // derived = 10 * 2 + 5 = 25
  TEST_ASSERT_TRUE(s.channel(1).reading.valid);
  TEST_ASSERT_FLOAT_WITHIN(0.1f, 25.0f, s.channel(1).reading.value);
  TEST_ASSERT_EQUAL_STRING("L", s.channel(1).meta.unit);
}

void test_timeout_invalidates_reading() {
  HCSR04Sensor s("tank", 5, 18);
  s.begin();
  // First measurement succeeds — establishes a valid reading.
  HCSR04Sensor::advanceMillisForTest(60);
  s.tick();
  s.injectEchoForTest(580);
  s.tick();
  TEST_ASSERT_TRUE(s.channel(0).reading.valid);  // sanity check
  // Second trigger times out.
  HCSR04Sensor::advanceMillisForTest(60);
  s.tick();                                // new trigger → TRIGGERED
  HCSR04Sensor::advanceMillisForTest(31);  // > kTimeoutMs (30 ms)
  s.tick();                                // timeout → reading.valid = false
  TEST_ASSERT_FALSE(s.channel(0).reading.valid);
}

void test_snapshot_channel_expansion() {
  HCSR04Sensor s("tank", 5, 18);
  s.setScale(1.0f, 0.0f, "cm");
  s.begin();
  HCSR04Sensor::advanceMillisForTest(60);
  s.tick();
  s.injectEchoForTest(580);
  s.tick();

  Registry reg;
  reg.add(&s);
  char buf[1024];
  size_t n = serializeRegistry(reg, buf, sizeof(buf));
  TEST_ASSERT_TRUE(n > 0);

  JsonDocument doc;
  TEST_ASSERT_FALSE(deserializeJson(doc, buf));

  JsonArray sensors = doc["sensors"].as<JsonArray>();
  TEST_ASSERT_EQUAL(2u, sensors.size());
  TEST_ASSERT_EQUAL_STRING("tank.distance", sensors[0]["id"].as<const char*>());
  TEST_ASSERT_EQUAL_STRING("tank.derived",  sensors[1]["id"].as<const char*>());
  TEST_ASSERT_EQUAL_STRING("Distance",      sensors[0]["meta"]["quantity"].as<const char*>());
  TEST_ASSERT_FLOAT_WITHIN(0.5f, 10.0f,    sensors[0]["state"]["v"].as<float>());
}

void setUp() {
#ifndef ARDUINO
  HCSR04Sensor::resetForTest();
#endif
}
void tearDown() {}

int main(int, char**) {
  UNITY_BEGIN();
  RUN_TEST(test_channel_count_and_keys);
  RUN_TEST(test_channel_meta_distance);
  RUN_TEST(test_derived_invalid_without_scale);
  RUN_TEST(test_readings_invalid_before_first_measurement);
  RUN_TEST(test_distance_calculates_correctly);
  RUN_TEST(test_derived_with_scale_and_offset);
  RUN_TEST(test_timeout_invalidates_reading);
  RUN_TEST(test_snapshot_channel_expansion);
  return UNITY_END();
}
