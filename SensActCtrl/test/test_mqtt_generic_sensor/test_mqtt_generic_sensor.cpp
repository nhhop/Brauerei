#include <unity.h>

#include <cstring>

#include "sensors/MqttGenericSensor.h"

#include "../mocks/MockTransport.h"

using SensActCtrl::MqttGenericSensor;
using SensActCtrl::Quantity;
using SensActCtrl::ValueKind;
using SensActCtrl::parseMqttSensorPayload;
using SensActCtrl::test::MockTransport;

// ── parseMqttSensorPayload ──────────────────────────────────────────────────

void test_parse_raw_number() {
  float v = 0;
  TEST_ASSERT_TRUE(parseMqttSensorPayload("23.5", "", v));
  TEST_ASSERT_EQUAL_FLOAT(23.5f, v);
}

void test_parse_raw_negative_number() {
  float v = 0;
  TEST_ASSERT_TRUE(parseMqttSensorPayload("-3.25", "", v));
  TEST_ASSERT_EQUAL_FLOAT(-3.25f, v);
}

void test_parse_raw_garbage_fails() {
  float v = 0;
  TEST_ASSERT_FALSE(parseMqttSensorPayload("not-a-number", "", v));
}

void test_parse_json_field() {
  float v = 0;
  TEST_ASSERT_TRUE(parseMqttSensorPayload(
      "{\"temperature\":23.5,\"humidity\":60}", "temperature", v));
  TEST_ASSERT_EQUAL_FLOAT(23.5f, v);
}

void test_parse_json_missing_field_fails() {
  float v = 0;
  TEST_ASSERT_FALSE(
      parseMqttSensorPayload("{\"humidity\":60}", "temperature", v));
}

void test_parse_malformed_json_fails() {
  float v = 0;
  TEST_ASSERT_FALSE(parseMqttSensorPayload("{not json", "temperature", v));
}

// ── MqttGenericSensor ────────────────────────────────────────────────────────

void test_starts_invalid_before_first_message() {
  MockTransport t;
  MqttGenericSensor s("aussentemp", t, "zigbee2mqtt/aussensensor",
                      Quantity::Temperature, "\xc2\xb0""C", -40.0f, 80.0f, 0.1f);
  s.begin();

  TEST_ASSERT_FALSE(s.channel(0).reading.valid);
}

void test_raw_message_updates_reading() {
  MockTransport t;
  MqttGenericSensor s("aussentemp", t, "zigbee2mqtt/aussensensor",
                      Quantity::Temperature, "\xc2\xb0""C", -40.0f, 80.0f, 0.1f);
  s.begin();

  t.publish("zigbee2mqtt/aussensensor", "18.75", false);

  auto r = s.channel(0).reading;
  TEST_ASSERT_TRUE(r.valid);
  TEST_ASSERT_EQUAL_FLOAT(18.75f, r.value);
}

void test_json_field_message_updates_reading() {
  MockTransport t;
  MqttGenericSensor s("aussentemp", t, "zigbee2mqtt/aussensensor",
                      Quantity::Humidity, "%", 0.0f, 100.0f, 1.0f, "humidity");
  s.begin();

  t.publish("zigbee2mqtt/aussensensor",
            "{\"temperature\":18.75,\"humidity\":55.2}", false);

  auto r = s.channel(0).reading;
  TEST_ASSERT_TRUE(r.valid);
  TEST_ASSERT_EQUAL_FLOAT(55.2f, r.value);
}

void test_malformed_message_keeps_previous_reading() {
  MockTransport t;
  MqttGenericSensor s("aussentemp", t, "zigbee2mqtt/aussensensor",
                      Quantity::Temperature, "\xc2\xb0""C", -40.0f, 80.0f, 0.1f);
  s.begin();

  t.publish("zigbee2mqtt/aussensensor", "18.75", false);
  t.publish("zigbee2mqtt/aussensensor", "garbage", false);

  auto r = s.channel(0).reading;
  TEST_ASSERT_TRUE(r.valid);
  TEST_ASSERT_EQUAL_FLOAT(18.75f, r.value);
}

void test_meta_reflects_constructor_args() {
  MockTransport t;
  MqttGenericSensor s("aussentemp", t, "topic", Quantity::Pressure, "bar",
                      0.0f, 10.0f, 0.01f);
  auto m = s.channel(0).meta;
  TEST_ASSERT_EQUAL(static_cast<int>(ValueKind::Continuous), static_cast<int>(m.kind));
  TEST_ASSERT_EQUAL(static_cast<int>(Quantity::Pressure), static_cast<int>(m.quantity));
  TEST_ASSERT_EQUAL_STRING("bar", m.unit);
  TEST_ASSERT_EQUAL_FLOAT(0.0f, m.min);
  TEST_ASSERT_EQUAL_FLOAT(10.0f, m.max);
}

void test_channel_count_is_one() {
  MockTransport t;
  MqttGenericSensor s("x", t, "topic", Quantity::Custom, "", 0.0f, 1.0f, 0.01f);
  TEST_ASSERT_EQUAL_UINT(1, s.channelCount());
}

// ── fault() ──────────────────────────────────────────────────────────────

void test_fault_null_when_transport_connected() {
  MockTransport t;
  MqttGenericSensor s("x", t, "topic", Quantity::Custom, "", 0.0f, 1.0f, 0.01f);
  TEST_ASSERT_NULL(s.fault());
}

void test_fault_reports_transport_error_message() {
  MockTransport t;
  t.setConnected(false);
  t.setLastErrorMessage("Verbindung fehlgeschlagen (Host/Port pruefen)");
  MqttGenericSensor s("x", t, "topic", Quantity::Custom, "", 0.0f, 1.0f, 0.01f);

  TEST_ASSERT_EQUAL_STRING("Verbindung fehlgeschlagen (Host/Port pruefen)",
                           s.fault());
}

void test_fault_falls_back_to_generic_message() {
  MockTransport t;
  t.setConnected(false);
  MqttGenericSensor s("x", t, "topic", Quantity::Custom, "", 0.0f, 1.0f, 0.01f);

  TEST_ASSERT_EQUAL_STRING("MQTT nicht verbunden", s.fault());
}

void setUp() {}
void tearDown() {}

int main(int, char**) {
  UNITY_BEGIN();

  RUN_TEST(test_parse_raw_number);
  RUN_TEST(test_parse_raw_negative_number);
  RUN_TEST(test_parse_raw_garbage_fails);
  RUN_TEST(test_parse_json_field);
  RUN_TEST(test_parse_json_missing_field_fails);
  RUN_TEST(test_parse_malformed_json_fails);

  RUN_TEST(test_starts_invalid_before_first_message);
  RUN_TEST(test_raw_message_updates_reading);
  RUN_TEST(test_json_field_message_updates_reading);
  RUN_TEST(test_malformed_message_keeps_previous_reading);
  RUN_TEST(test_meta_reflects_constructor_args);
  RUN_TEST(test_channel_count_is_one);

  RUN_TEST(test_fault_null_when_transport_connected);
  RUN_TEST(test_fault_reports_transport_error_message);
  RUN_TEST(test_fault_falls_back_to_generic_message);

  return UNITY_END();
}
