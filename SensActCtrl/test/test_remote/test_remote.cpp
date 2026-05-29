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

// Two-channel sensor for multi-channel tests. Keys "a" (Temperature) and
// "b" (Humidity). Values set via valueA / valueB before tick().
class MockMultiSensor : public SensActCtrl::Sensor {
 public:
  explicit MockMultiSensor(const char* id) : id_(id) {}
  const char* id() const override { return id_; }
  size_t channelCount() const override { return 2; }
  SensActCtrl::Channel channel(size_t idx) const override {
    static const SensActCtrl::SensorMeta metaA{
        SensActCtrl::ValueKind::Continuous, SensActCtrl::Quantity::Temperature,
        "\xc2\xb0""C", -55.0f, 125.0f, 0.01f};
    static const SensActCtrl::SensorMeta metaB{
        SensActCtrl::ValueKind::Continuous, SensActCtrl::Quantity::Humidity,
        "%", 0.0f, 100.0f, 0.01f};
    if (idx == 0) return {"a", metaA, readA_};
    return {"b", metaB, readB_};
  }
  void tick() override {
    readA_ = {valueA, ++ts_, true};
    readB_ = {valueB, ts_, true};
  }
  float valueA = 20.0f;
  float valueB = 50.0f;
 private:
  const char* id_;
  SensActCtrl::Reading readA_{};
  SensActCtrl::Reading readB_{};
  uint32_t ts_ = 0;
};

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
  TEST_ASSERT_EQUAL_STRING("\xc2\xb0""C", remote.channel(0).meta.unit);
  TEST_ASSERT_EQUAL(static_cast<int>(Quantity::Temperature),
                    static_cast<int>(remote.channel(0).meta.quantity));

  // Drive a reading through publisher → transport → remote.
  src.value = 42.5f;
  src.valid = true;
  src.tick();
  pub.tick();

  const auto r = remote.channel(0).reading;
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

  TEST_ASSERT_EQUAL_STRING("\xc2\xb0""C", late.channel(0).meta.unit);
  TEST_ASSERT_TRUE(late.channel(0).reading.valid);
  TEST_ASSERT_FLOAT_WITHIN(0.001f, 23.7f, late.channel(0).reading.value);
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

void test_multichannel_both_channels_published() {
  MockTransport tx;
  MockMultiSensor src("mc");
  RemotePublisher pub(tx, "node-m");
  pub.attach(src);
  pub.setStateIntervalMs(0);
  pub.begin();
  src.tick();
  pub.tick();

  // Both channel state topics must exist
  TEST_ASSERT_FALSE(tx.lastPayload("sensactctrl/node-m/sensor/mc/a").empty());
  TEST_ASSERT_FALSE(tx.lastPayload("sensactctrl/node-m/sensor/mc/b").empty());
  // Flat (single-channel) topic must NOT be used for multi-channel sensor
  TEST_ASSERT_TRUE(tx.lastPayload("sensactctrl/node-m/sensor/mc").empty());
  // Retained meta for both channels
  TEST_ASSERT_FALSE(tx.lastPayload("sensactctrl/node-m/sensor/mc/a/meta").empty());
  TEST_ASSERT_FALSE(tx.lastPayload("sensactctrl/node-m/sensor/mc/b/meta").empty());
}

void test_multichannel_channel_values_correct() {
  MockTransport tx;
  MockMultiSensor src("mc3");
  RemotePublisher pub(tx, "node-q");
  pub.attach(src);
  pub.setStateIntervalMs(0);
  pub.begin();
  src.valueA = 42.5f;
  src.valueB = 77.0f;
  src.tick();
  pub.tick();

  // Channel "a" payload must contain 42.5, channel "b" must contain 77
  const std::string payA = tx.lastPayload("sensactctrl/node-q/sensor/mc3/a");
  const std::string payB = tx.lastPayload("sensactctrl/node-q/sensor/mc3/b");
  TEST_ASSERT_TRUE(payA.find("42.5") != std::string::npos);
  TEST_ASSERT_TRUE(payB.find("77") != std::string::npos);
}

void test_single_channel_flat_topic_unchanged() {
  MockTransport tx;
  MockSensor src("t_flat", tempMeta());  // single-channel, empty key
  RemotePublisher pub(tx, "node-o");
  pub.attach(src);
  pub.setStateIntervalMs(0);
  pub.begin();
  src.value = 25.0f;
  src.tick();
  pub.tick();

  // Must use flat topic — no channel key suffix
  TEST_ASSERT_FALSE(tx.lastPayload("sensactctrl/node-o/sensor/t_flat").empty());
  TEST_ASSERT_FALSE(tx.lastPayload("sensactctrl/node-o/sensor/t_flat/meta").empty());
}

void test_multichannel_remote_sensor_subscribes_channel() {
  MockTransport tx;
  MockMultiSensor src("mc2");
  RemotePublisher pub(tx, "node-n");
  pub.attach(src);
  pub.setStateIntervalMs(0);
  pub.begin();
  src.valueA = 42.5f;
  src.tick();
  pub.tick();

  // Late subscriber — meta + state replayed from retained cache.
  RemoteSensor remote(tx, "node-n", "mc2", "a");
  remote.begin();

  TEST_ASSERT_EQUAL_STRING("\xc2\xb0""C", remote.channel(0).meta.unit);
  TEST_ASSERT_TRUE(remote.channel(0).reading.valid);
  TEST_ASSERT_FLOAT_WITHIN(0.001f, 42.5f, remote.channel(0).reading.value);
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
  RUN_TEST(test_multichannel_both_channels_published);
  RUN_TEST(test_multichannel_channel_values_correct);
  RUN_TEST(test_single_channel_flat_topic_unchanged);
  RUN_TEST(test_multichannel_remote_sensor_subscribes_channel);
  return UNITY_END();
}
