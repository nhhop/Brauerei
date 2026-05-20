#include <unity.h>

#include <cstring>

#include "controllers/TwoPointController.h"
#include "remote/RemoteActuator.h"
#include "remote/RemotePublisher.h"
#include "remote/RemoteSensor.h"
#include "remote/Topics.h"

#include "../mocks/MockActuator.h"
#include "../mocks/MockSensor.h"
#include "../mocks/MockTransport.h"

using SensActCtrl::ActuatorMeta;
using SensActCtrl::Quantity;
using SensActCtrl::RemoteActuator;
using SensActCtrl::RemotePublisher;
using SensActCtrl::RemoteSensor;
using SensActCtrl::SensorMeta;
using SensActCtrl::TwoPointController;
using SensActCtrl::ValueKind;
using SensActCtrl::test::MockActuator;
using SensActCtrl::test::MockSensor;
using SensActCtrl::test::MockTransport;

static SensorMeta tempMeta() {
  return SensorMeta{ValueKind::Continuous, Quantity::Temperature, "\xc2\xb0""C",
                    -55.0f, 125.0f, 0.0625f};
}
static ActuatorMeta switchMeta() {
  return ActuatorMeta{ValueKind::Binary, Quantity::None, "", 0.0f, 1.0f, 1.0f};
}

void test_sensor_state_round_trip() {
  MockTransport tx;
  MockSensor src("mash_temp", tempMeta());
  RemotePublisher pub(tx, "node-a");
  pub.attach(src);
  pub.setStateIntervalMs(0);
  pub.begin();

  RemoteSensor remote(tx, "node-a", "mash_temp");
  remote.begin();  // retained meta replays into remote immediately

  // Meta should have arrived via retained replay.
  TEST_ASSERT_EQUAL_STRING("\xc2\xb0""C", remote.meta().unit);
  TEST_ASSERT_EQUAL(static_cast<int>(Quantity::Temperature),
                    static_cast<int>(remote.meta().quantity));

  // Drive a reading through publisher → transport → remote.
  src.value = 42.5f;
  src.valid = true;
  src.tick();
  pub.tick();

  const auto r = remote.lastReading();
  TEST_ASSERT_TRUE(r.valid);
  TEST_ASSERT_FLOAT_WITHIN(0.001f, 42.5f, r.value);
}

void test_actuator_set_command_routes_to_local_write() {
  MockTransport tx;
  MockActuator local("heater", switchMeta());
  RemotePublisher pub(tx, "node-b");
  pub.attach(local);
  pub.setStateIntervalMs(0);
  pub.begin();

  RemoteActuator remote(tx, "node-b", "heater");
  remote.begin();

  remote.write(1.0f);  // should route to local.write(1.0f) via /set topic

  TEST_ASSERT_EQUAL(1u, local.writes.size());
  TEST_ASSERT_FLOAT_WITHIN(0.001f, 1.0f, local.writes.back());
}

void test_actuator_state_round_trip() {
  MockTransport tx;
  MockActuator local("heater", switchMeta());
  RemotePublisher pub(tx, "node-c");
  pub.attach(local);
  pub.setStateIntervalMs(0);
  pub.begin();

  RemoteActuator remote(tx, "node-c", "heater");
  remote.begin();

  local.write(1.0f);  // also bumps local.state_ to 1
  pub.tick();         // publishes the state

  TEST_ASSERT_FLOAT_WITHIN(0.001f, 1.0f, remote.state());
  TEST_ASSERT_EQUAL_STRING("", remote.meta().unit);  // empty string for switchMeta
}

void test_meta_retained_replay_for_late_subscriber() {
  MockTransport tx;
  MockSensor src("amb_t", tempMeta());
  RemotePublisher pub(tx, "node-d");
  pub.attach(src);
  pub.setStateIntervalMs(0);
  pub.begin();
  src.value = 23.7f;
  src.tick();
  pub.tick();

  // Now a late RemoteSensor subscribes — must get meta AND last state via
  // retained replay (no further publishes needed).
  RemoteSensor late(tx, "node-d", "amb_t");
  late.begin();

  TEST_ASSERT_EQUAL_STRING("\xc2\xb0""C", late.meta().unit);
  TEST_ASSERT_TRUE(late.lastReading().valid);
  TEST_ASSERT_FLOAT_WITHIN(0.001f, 23.7f, late.lastReading().value);
}

void test_controller_tune_round_trip() {
  MockTransport tx;
  MockSensor s("t", tempMeta());
  MockActuator a("o", switchMeta());
  TwoPointController ctrl("mash_ctrl", s, a);
  ctrl.setSetpoint(60.0f);
  ctrl.setHysteresis(-0.5f, 0.5f);

  RemotePublisher pub(tx, "node-e");
  pub.attach(ctrl);
  pub.begin();

  // Inject a /tune payload that bumps setpoint to 75°C.
  const char* tuneTopic = "sensactctrl/node-e/controller/mash_ctrl/tune";
  const char* newParams = "{\"setpoint\":75.0,\"hystLow\":-1.0,"
                          "\"hystHigh\":1.0,\"inverted\":false}";
  tx.publish(tuneTopic, newParams, /*retained=*/false);

  TEST_ASSERT_FLOAT_WITHIN(0.001f, 75.0f, ctrl.setpoint());

  // Publisher should have re-emitted /meta with the new params (retained).
  const std::string meta = tx.lastPayload(
      "sensactctrl/node-e/controller/mash_ctrl/meta");
  TEST_ASSERT_TRUE(meta.find("75") != std::string::npos);
}

void setUp() {}
void tearDown() {}

int main(int, char**) {
  UNITY_BEGIN();
  RUN_TEST(test_sensor_state_round_trip);
  RUN_TEST(test_actuator_set_command_routes_to_local_write);
  RUN_TEST(test_actuator_state_round_trip);
  RUN_TEST(test_meta_retained_replay_for_late_subscriber);
  RUN_TEST(test_controller_tune_round_trip);
  return UNITY_END();
}
