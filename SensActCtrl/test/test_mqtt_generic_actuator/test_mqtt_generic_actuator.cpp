#include <unity.h>

#include <cstring>

#include "actuators/MqttGenericActuator.h"

#include "../mocks/MockTransport.h"

using SensActCtrl::ActuatorMeta;
using SensActCtrl::MqttGenericActuator;
using SensActCtrl::Quantity;
using SensActCtrl::ValueKind;
using SensActCtrl::buildMqttPayload;
using SensActCtrl::test::MockTransport;

// ── buildMqttPayload ────────────────────────────────────────────────────────

void test_payload_simple_substitution() {
  char buf[32];
  TEST_ASSERT_TRUE(buildMqttPayload("{value}", 42.0f, buf, sizeof(buf)));
  TEST_ASSERT_EQUAL_STRING("42", buf);
}

void test_payload_fractional_and_negative() {
  char buf[32];
  TEST_ASSERT_TRUE(buildMqttPayload("v={value}", -3.5f, buf, sizeof(buf)));
  TEST_ASSERT_EQUAL_STRING("v=-3.5", buf);
}

void test_payload_multiple_placeholders() {
  char buf[32];
  TEST_ASSERT_TRUE(buildMqttPayload("{value}:{value}", 1.0f, buf, sizeof(buf)));
  TEST_ASSERT_EQUAL_STRING("1:1", buf);
}

void test_payload_no_placeholder_is_verbatim() {
  char buf[32];
  TEST_ASSERT_TRUE(buildMqttPayload("ON", 1.0f, buf, sizeof(buf)));
  TEST_ASSERT_EQUAL_STRING("ON", buf);
}

void test_payload_buffer_too_small_fails() {
  char buf[4];
  TEST_ASSERT_FALSE(buildMqttPayload("{value}", 12345.0f, buf, sizeof(buf)));
}

// ── MqttGenericActuator — Binary ────────────────────────────────────────────

void test_binary_write_on_publishes_on_payload() {
  MockTransport t;
  MqttGenericActuator a("plug", t, "cmnd/sonoff1/POWER", "ON", "OFF", false);
  a.setEnabled(true);
  t.clear();

  a.write(1.0f);

  TEST_ASSERT_EQUAL_STRING("ON", t.lastPayload("cmnd/sonoff1/POWER").c_str());
}

void test_binary_write_off_publishes_off_payload() {
  MockTransport t;
  MqttGenericActuator a("plug", t, "cmnd/sonoff1/POWER", "ON", "OFF", false);
  a.setEnabled(true);
  t.clear();

  a.write(0.0f);

  TEST_ASSERT_EQUAL_STRING("OFF", t.lastPayload("cmnd/sonoff1/POWER").c_str());
}

void test_binary_starts_disabled_and_writes_nothing() {
  MockTransport t;
  MqttGenericActuator a("plug", t, "cmnd/sonoff1/POWER", "ON", "OFF", false);

  TEST_ASSERT_FALSE(a.enabled());
  TEST_ASSERT_EQUAL_FLOAT(1.0f, a.target());
}

void test_binary_disable_publishes_off_actively() {
  MockTransport t;
  MqttGenericActuator a("plug", t, "cmnd/sonoff1/POWER", "ON", "OFF", false);
  a.setEnabled(true);
  a.write(1.0f);
  t.clear();

  a.setEnabled(false);

  TEST_ASSERT_EQUAL_STRING("OFF", t.lastPayload("cmnd/sonoff1/POWER").c_str());
  TEST_ASSERT_EQUAL_FLOAT(1.0f, a.target());  // target unaffected by enabled()
}

void test_binary_retained_flag_passed_through() {
  MockTransport t;
  MqttGenericActuator a("plug", t, "topic", "ON", "OFF", /*retained=*/true);
  a.setEnabled(true);

  a.write(1.0f);

  TEST_ASSERT_TRUE(t.published.back().retained);
}

void test_binary_meta_kind() {
  MockTransport t;
  MqttGenericActuator a("plug", t, "topic", "ON", "OFF", false);
  ActuatorMeta m = a.meta();
  TEST_ASSERT_EQUAL(static_cast<int>(ValueKind::Binary), static_cast<int>(m.kind));
}

// ── MqttGenericActuator — Continuous ────────────────────────────────────────

void test_continuous_write_substitutes_value() {
  MockTransport t;
  MqttGenericActuator a("dimmer", t, "cmnd/dimmer1/Dimmer", "{value}", 0.0f,
                        100.0f, 1.0f, "%", false);
  a.setEnabled(true);

  a.write(42.0f);

  TEST_ASSERT_EQUAL_STRING("42", t.lastPayload("cmnd/dimmer1/Dimmer").c_str());
}

void test_continuous_write_clamps_to_range() {
  MockTransport t;
  MqttGenericActuator a("dimmer", t, "topic", "{value}", 0.0f, 100.0f, 1.0f, "%",
                        false);
  a.setEnabled(true);

  a.write(150.0f);
  TEST_ASSERT_EQUAL_FLOAT(100.0f, a.target());

  a.write(-10.0f);
  TEST_ASSERT_EQUAL_FLOAT(0.0f, a.target());
}

void test_continuous_disabled_publishes_min() {
  MockTransport t;
  MqttGenericActuator a("dimmer", t, "topic", "{value}", 5.0f, 100.0f, 1.0f, "%",
                        false);
  // Continuous actuators start enabled (unlike Binary).
  a.write(42.0f);
  t.clear();

  a.setEnabled(false);

  TEST_ASSERT_EQUAL_STRING("5", t.lastPayload("topic").c_str());
}

void test_continuous_meta_kind_and_range() {
  MockTransport t;
  MqttGenericActuator a("dimmer", t, "topic", "{value}", 2.0f, 8.0f, 0.5f, "u",
                        false);
  ActuatorMeta m = a.meta();
  TEST_ASSERT_EQUAL(static_cast<int>(ValueKind::Continuous), static_cast<int>(m.kind));
  TEST_ASSERT_EQUAL_FLOAT(2.0f, m.min);
  TEST_ASSERT_EQUAL_FLOAT(8.0f, m.max);
  TEST_ASSERT_EQUAL_STRING("u", m.unit);
}

// ── fault() ──────────────────────────────────────────────────────────────

void test_fault_null_when_transport_connected() {
  MockTransport t;
  MqttGenericActuator a("plug", t, "topic", "ON", "OFF", false);
  TEST_ASSERT_NULL(a.fault());
}

void test_fault_reports_transport_error_message() {
  MockTransport t;
  t.setConnected(false);
  t.setLastErrorMessage("Verbindung fehlgeschlagen (Host/Port pruefen)");
  MqttGenericActuator a("plug", t, "topic", "ON", "OFF", false);

  TEST_ASSERT_EQUAL_STRING("Verbindung fehlgeschlagen (Host/Port pruefen)",
                           a.fault());
}

void test_fault_falls_back_to_generic_message() {
  MockTransport t;
  t.setConnected(false);
  MqttGenericActuator a("plug", t, "topic", "ON", "OFF", false);

  TEST_ASSERT_EQUAL_STRING("MQTT nicht verbunden", a.fault());
}

void setUp() {}
void tearDown() {}

int main(int, char**) {
  UNITY_BEGIN();

  RUN_TEST(test_payload_simple_substitution);
  RUN_TEST(test_payload_fractional_and_negative);
  RUN_TEST(test_payload_multiple_placeholders);
  RUN_TEST(test_payload_no_placeholder_is_verbatim);
  RUN_TEST(test_payload_buffer_too_small_fails);

  RUN_TEST(test_binary_write_on_publishes_on_payload);
  RUN_TEST(test_binary_write_off_publishes_off_payload);
  RUN_TEST(test_binary_starts_disabled_and_writes_nothing);
  RUN_TEST(test_binary_disable_publishes_off_actively);
  RUN_TEST(test_binary_retained_flag_passed_through);
  RUN_TEST(test_binary_meta_kind);

  RUN_TEST(test_continuous_write_substitutes_value);
  RUN_TEST(test_continuous_write_clamps_to_range);
  RUN_TEST(test_continuous_disabled_publishes_min);
  RUN_TEST(test_continuous_meta_kind_and_range);

  RUN_TEST(test_fault_null_when_transport_connected);
  RUN_TEST(test_fault_reports_transport_error_message);
  RUN_TEST(test_fault_falls_back_to_generic_message);

  return UNITY_END();
}
