#include <unity.h>

#include <cstring>
#include <string>

#include "controllers/TwoPointController.h"
#include "remote/Discovery.h"
#include "remote/RemotePublisher.h"

#include "../mocks/MockActuator.h"
#include "../mocks/MockSensor.h"
#include "../mocks/MockTransport.h"

using SensActCtrl::ActuatorMeta;
using SensActCtrl::DiscoveryScanner;
using SensActCtrl::Quantity;
using SensActCtrl::RemotePublisher;
using SensActCtrl::SensorMeta;
using SensActCtrl::TwoPointController;
using SensActCtrl::ValueKind;
using SensActCtrl::remote::DiscoveredItem;
using SensActCtrl::test::MockActuator;
using SensActCtrl::test::MockSensor;
using SensActCtrl::test::MockTransport;

class TwoChannelSensor : public SensActCtrl::Sensor {
 public:
  const char* id() const override { return "flow"; }
  size_t channelCount() const override { return 2; }
  SensActCtrl::Channel channel(size_t idx) const override {
    static const SensorMeta rate{ValueKind::Continuous, Quantity::FlowRate,
                                 "L/min", 0.0f, 30.0f, 0.1f};
    static const SensorMeta vol{ValueKind::Cumulative, Quantity::Volume,
                                "L", 0.0f, 1000.0f, 0.01f};
    if (idx == 0) return {"rate", rate, reading_};
    return {"volume", vol, reading_};
  }
  void tick() override {}

 private:
  SensActCtrl::Reading reading_{};
};

static SensorMeta tempMeta() {
  return SensorMeta{ValueKind::Continuous, Quantity::Temperature, "\xc2\xb0""C",
                    -55.0f, 125.0f, 0.0625f};
}
static ActuatorMeta switchMeta() {
  return ActuatorMeta{ValueKind::Binary, Quantity::None, "", 0.0f, 1.0f, 1.0f};
}

static const DiscoveredItem* find(const std::vector<DiscoveredItem>& items,
                                  const char* id, const char* key = "") {
  for (const auto& i : items) {
    if (i.id == id && i.channelKey == key) return &i;
  }
  return nullptr;
}

// Runs a whole scan: request, publisher answers, window closes.
static std::vector<DiscoveredItem> runScan(DiscoveryScanner& scanner,
                                           RemotePublisher& pub, int ticks = 20) {
  scanner.requestScan();
  scanner.tick(1000);
  for (int i = 0; i < ticks; ++i) pub.tick();
  scanner.tick(1000 + DiscoveryScanner::kWindowMs);
  TEST_ASSERT_TRUE(scanner.status() == DiscoveryScanner::Status::Done);
  return scanner.takeResults();
}

void test_request_response_json_round_trip() {
  char buf[224];
  TEST_ASSERT_TRUE(SensActCtrl::remote::serializeDiscoverRequest(
      "sensactctrl/discover/bc", 7, buf, sizeof(buf)) > 0);
  std::string reply;
  uint32_t rid = 0;
  TEST_ASSERT_TRUE(SensActCtrl::remote::parseDiscoverRequest(buf, reply, rid));
  TEST_ASSERT_EQUAL_STRING("sensactctrl/discover/bc", reply.c_str());
  TEST_ASSERT_EQUAL_UINT32(7, rid);

  DiscoveredItem in{"node-a", "brewcontrol", "sensor", "mash", "rate", "FlowRate", "L/min"};
  TEST_ASSERT_TRUE(SensActCtrl::remote::serializeDiscoverResponse(9, in, buf, sizeof(buf)) > 0);
  DiscoveredItem out;
  TEST_ASSERT_TRUE(SensActCtrl::remote::parseDiscoverResponse(buf, rid, out));
  TEST_ASSERT_EQUAL_UINT32(9, rid);
  TEST_ASSERT_EQUAL_STRING("node-a", out.device.c_str());
  TEST_ASSERT_EQUAL_STRING("brewcontrol", out.prefix.c_str());
  TEST_ASSERT_EQUAL_STRING("rate", out.channelKey.c_str());
  TEST_ASSERT_EQUAL_STRING("L/min", out.unit.c_str());

  // Too small a buffer fails instead of emitting truncated JSON.
  TEST_ASSERT_EQUAL(0, SensActCtrl::remote::serializeDiscoverResponse(9, in, buf, 20));
  TEST_ASSERT_FALSE(SensActCtrl::remote::parseDiscoverResponse("{\"d\":\"x\"}", rid, out));
}

void test_scan_lists_sensors_channels_and_actuators() {
  MockTransport tx;
  MockSensor temp("mash_temp", tempMeta());
  TwoChannelSensor flow;
  MockActuator heater("heater", switchMeta());
  TwoPointController ctrl("ctrl", temp, heater);

  RemotePublisher pub(tx, "node-a");
  pub.setPrefix("brewcontrol");
  pub.setDiscoveryJitterMs(0);
  pub.attach(temp);
  pub.attach(flow);
  pub.attach(heater);
  pub.attach(ctrl);
  pub.begin();

  DiscoveryScanner scanner(tx, "bc");
  scanner.begin();
  const auto items = runScan(scanner, pub);

  TEST_ASSERT_EQUAL(4, items.size());  // controller not listed
  const DiscoveredItem* t = find(items, "mash_temp");
  TEST_ASSERT_NOT_NULL(t);
  TEST_ASSERT_EQUAL_STRING("node-a", t->device.c_str());
  TEST_ASSERT_EQUAL_STRING("brewcontrol", t->prefix.c_str());
  TEST_ASSERT_EQUAL_STRING("sensor", t->kind.c_str());
  TEST_ASSERT_EQUAL_STRING("Temperature", t->quantity.c_str());
  TEST_ASSERT_EQUAL_STRING("\xc2\xb0""C", t->unit.c_str());
  TEST_ASSERT_NOT_NULL(find(items, "flow", "rate"));
  TEST_ASSERT_NOT_NULL(find(items, "flow", "volume"));
  const DiscoveredItem* h = find(items, "heater");
  TEST_ASSERT_NOT_NULL(h);
  TEST_ASSERT_EQUAL_STRING("actuator", h->kind.c_str());

  // Results are handed over once, then the scanner is idle again.
  TEST_ASSERT_TRUE(scanner.status() == DiscoveryScanner::Status::Idle);
  TEST_ASSERT_EQUAL(0, scanner.takeResults().size());
}

void test_request_and_responses_not_retained() {
  MockTransport tx;
  MockSensor temp("t", tempMeta());
  RemotePublisher pub(tx, "node-a");
  pub.setDiscoveryJitterMs(0);
  pub.attach(temp);
  pub.begin();
  DiscoveryScanner scanner(tx, "bc");
  scanner.begin();
  tx.clear();
  runScan(scanner, pub);

  bool sawRequest = false, sawResponse = false;
  for (const auto& s : tx.published) {
    if (s.topic == "sensactctrl/discover") { sawRequest = true; TEST_ASSERT_FALSE(s.retained); }
    if (s.topic == "sensactctrl/discover/bc") { sawResponse = true; TEST_ASSERT_FALSE(s.retained); }
  }
  TEST_ASSERT_TRUE(sawRequest);
  TEST_ASSERT_TRUE(sawResponse);
}

void test_answers_one_item_per_tick() {
  MockTransport tx;
  MockSensor a("a", tempMeta());
  MockSensor b("b", tempMeta());
  RemotePublisher pub(tx, "node-a");
  pub.setDiscoveryJitterMs(0);
  pub.attach(a);
  pub.attach(b);
  pub.begin();
  DiscoveryScanner scanner(tx, "bc");
  scanner.begin();

  scanner.requestScan();
  scanner.tick(0);
  tx.clear();
  pub.tick();
  size_t responses = 0;
  for (const auto& s : tx.published) responses += s.topic == "sensactctrl/discover/bc";
  TEST_ASSERT_EQUAL(1, responses);
}

void test_own_device_filtered() {
  MockTransport tx;
  MockSensor temp("t", tempMeta());
  RemotePublisher own(tx, "bc");
  own.setDiscoveryJitterMs(0);
  own.attach(temp);
  own.begin();
  DiscoveryScanner scanner(tx, "bc");
  scanner.begin();
  TEST_ASSERT_EQUAL(0, runScan(scanner, own).size());
}

void test_duplicates_and_stale_rid_dropped() {
  MockTransport tx;
  DiscoveryScanner scanner(tx, "bc");
  scanner.begin();
  scanner.requestScan();
  scanner.tick(0);  // rid 1

  const char* ok = "{\"rid\":1,\"d\":\"n\",\"p\":\"\",\"k\":\"sensor\",\"id\":\"x\",\"ch\":\"\"}";
  const char* stale = "{\"rid\":0,\"d\":\"n\",\"p\":\"\",\"k\":\"sensor\",\"id\":\"y\",\"ch\":\"\"}";
  tx.publish("sensactctrl/discover/bc", ok, false);
  tx.publish("sensactctrl/discover/bc", ok, false);
  tx.publish("sensactctrl/discover/bc", stale, false);

  scanner.tick(DiscoveryScanner::kWindowMs);
  const auto items = scanner.takeResults();
  TEST_ASSERT_EQUAL(1, items.size());
  TEST_ASSERT_EQUAL_STRING("x", items[0].id.c_str());
}

void test_status_lifecycle_and_result_ttl() {
  MockTransport tx;
  DiscoveryScanner scanner(tx, "bc");
  scanner.begin();
  TEST_ASSERT_TRUE(scanner.status() == DiscoveryScanner::Status::Idle);
  scanner.requestScan();
  TEST_ASSERT_TRUE(scanner.status() == DiscoveryScanner::Status::Running);
  scanner.tick(100);
  scanner.tick(100 + DiscoveryScanner::kWindowMs - 1);
  TEST_ASSERT_TRUE(scanner.status() == DiscoveryScanner::Status::Running);
  scanner.tick(100 + DiscoveryScanner::kWindowMs);
  TEST_ASSERT_TRUE(scanner.status() == DiscoveryScanner::Status::Done);
  // Nobody fetched the results — they expire.
  scanner.tick(100 + DiscoveryScanner::kWindowMs + DiscoveryScanner::kResultTtlMs);
  TEST_ASSERT_TRUE(scanner.status() == DiscoveryScanner::Status::Idle);
}

void test_detach_during_answer_is_safe() {
  MockTransport tx;
  MockSensor a("a", tempMeta());
  MockSensor b("b", tempMeta());
  MockActuator h("h", switchMeta());
  RemotePublisher pub(tx, "node-a");
  pub.setDiscoveryJitterMs(0);
  pub.attach(a);
  pub.attach(b);
  pub.attach(h);
  pub.begin();
  DiscoveryScanner scanner(tx, "bc");
  scanner.begin();

  scanner.requestScan();
  scanner.tick(0);
  pub.tick();  // answers "a"
  pub.detach(b);
  pub.detach(h);
  for (int i = 0; i < 5; ++i) pub.tick();
  scanner.tick(DiscoveryScanner::kWindowMs);
  const auto items = scanner.takeResults();
  TEST_ASSERT_EQUAL(1, items.size());
  TEST_ASSERT_EQUAL_STRING("a", items[0].id.c_str());
}

void test_no_answer_while_disconnected() {
  MockTransport tx;
  MockSensor a("a", tempMeta());
  RemotePublisher pub(tx, "node-a");
  pub.setDiscoveryJitterMs(0);
  pub.attach(a);
  pub.begin();
  pub.tick();

  tx.publish("sensactctrl/discover", "{\"reply\":\"sensactctrl/discover/bc\",\"rid\":1}", false);
  tx.setConnected(false);
  tx.clear();
  pub.tick();
  TEST_ASSERT_EQUAL(0, tx.published.size());
}

void setUp() {}
void tearDown() {}

int main(int, char**) {
  UNITY_BEGIN();
  RUN_TEST(test_request_response_json_round_trip);
  RUN_TEST(test_scan_lists_sensors_channels_and_actuators);
  RUN_TEST(test_request_and_responses_not_retained);
  RUN_TEST(test_answers_one_item_per_tick);
  RUN_TEST(test_own_device_filtered);
  RUN_TEST(test_duplicates_and_stale_rid_dropped);
  RUN_TEST(test_status_lifecycle_and_result_ttl);
  RUN_TEST(test_detach_during_answer_is_safe);
  RUN_TEST(test_no_answer_while_disconnected);
  return UNITY_END();
}
