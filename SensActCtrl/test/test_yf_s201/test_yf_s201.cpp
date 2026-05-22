// SensActCtrl/test/test_yf_s201/test_yf_s201.cpp
#include <unity.h>
#include <ArduinoJson.h>
#include "sensors/YF_S201Sensor.h"
#include "core/Registry.h"
#include "core/RegistrySnapshot.h"

using SensActCtrl::YF_S201Sensor;
using SensActCtrl::Channel;
using SensActCtrl::Quantity;
using SensActCtrl::ValueKind;
using SensActCtrl::Registry;
using SensActCtrl::serializeRegistry;

// Inject N pulses into a sensor.
static void pulse(YF_S201Sensor& s, int n) {
  for (int i = 0; i < n; ++i) s.injectPulseForTest();
}

void test_channel_count_and_keys() {
  YF_S201Sensor s("flow", 4);
  TEST_ASSERT_EQUAL(2u, s.channelCount());
  TEST_ASSERT_EQUAL_STRING("rate",   s.channel(0).key);
  TEST_ASSERT_EQUAL_STRING("volume", s.channel(1).key);
}

void test_channel_meta() {
  YF_S201Sensor s("flow", 4);
  Channel rate = s.channel(0);
  Channel vol  = s.channel(1);

  TEST_ASSERT_EQUAL(Quantity::FlowRate,  rate.meta.quantity);
  TEST_ASSERT_EQUAL_STRING("L/min",      rate.meta.unit);
  TEST_ASSERT_EQUAL(ValueKind::Continuous, rate.meta.kind);

  TEST_ASSERT_EQUAL(Quantity::Volume,    vol.meta.quantity);
  TEST_ASSERT_EQUAL_STRING("L",          vol.meta.unit);
  TEST_ASSERT_EQUAL(ValueKind::Cumulative, vol.meta.kind);
}

void test_default_readings_invalid_before_tick() {
  YF_S201Sensor s("flow", 4);
  s.begin();
  TEST_ASSERT_FALSE(s.channel(0).reading.valid);
  TEST_ASSERT_FALSE(s.channel(1).reading.valid);
}

void test_rate_calculates_correctly() {
  YF_S201Sensor s("flow", 4);
  s.begin();
  // 75 pulses in 1-second window → 75 Hz → 75/7.5 = 10 L/min
  pulse(s, 75);
  s.tick();
  TEST_ASSERT_TRUE(s.channel(0).reading.valid);
  TEST_ASSERT_FLOAT_WITHIN(0.1f, 10.0f, s.channel(0).reading.value);
}

void test_volume_accumulates() {
  YF_S201Sensor s("flow", 4);
  s.begin();
  // 7.5 Hz/L/min × 60 s = 450 pulses per litre
  pulse(s, 450);
  s.tick();
  TEST_ASSERT_TRUE(s.channel(1).reading.valid);
  TEST_ASSERT_FLOAT_WITHIN(0.01f, 1.0f, s.channel(1).reading.value);
}

void test_reset_volume() {
  YF_S201Sensor s("flow", 4);
  s.begin();
  pulse(s, 450);
  s.tick();
  s.resetVolume();
  pulse(s, 450);
  s.tick();
  // After reset + 450 more pulses, volume must be 1 L (not 2 L).
  TEST_ASSERT_FLOAT_WITHIN(0.01f, 1.0f, s.channel(1).reading.value);
}

void test_snapshot_multi_channel_expansion() {
  YF_S201Sensor flow("flow", 4);
  flow.begin();
  pulse(flow, 450);
  flow.tick();

  Registry reg;
  reg.add(&flow);

  char buf[1024];
  size_t n = serializeRegistry(reg, buf, sizeof(buf));
  TEST_ASSERT_TRUE(n > 0);

  JsonDocument doc;
  TEST_ASSERT_FALSE(deserializeJson(doc, buf));

  JsonArray sensors = doc["sensors"].as<JsonArray>();
  TEST_ASSERT_EQUAL(2u, sensors.size());
  TEST_ASSERT_EQUAL_STRING("flow.rate",   sensors[0]["id"].as<const char*>());
  TEST_ASSERT_EQUAL_STRING("flow.volume", sensors[1]["id"].as<const char*>());
  TEST_ASSERT_EQUAL_STRING("FlowRate",    sensors[0]["meta"]["quantity"].as<const char*>());
  TEST_ASSERT_EQUAL_STRING("Volume",      sensors[1]["meta"]["quantity"].as<const char*>());
  TEST_ASSERT_FLOAT_WITHIN(0.05f, 1.0f,  sensors[1]["state"]["v"].as<float>());
}

void setUp() {
#ifndef ARDUINO
  YF_S201Sensor::resetForTest();
#endif
}
void tearDown() {}

int main(int, char**) {
  UNITY_BEGIN();
  RUN_TEST(test_channel_count_and_keys);
  RUN_TEST(test_channel_meta);
  RUN_TEST(test_default_readings_invalid_before_tick);
  RUN_TEST(test_rate_calculates_correctly);
  RUN_TEST(test_volume_accumulates);
  RUN_TEST(test_reset_volume);
  RUN_TEST(test_snapshot_multi_channel_expansion);
  return UNITY_END();
}
