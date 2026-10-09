#include <unity.h>

#include <string>
#include <vector>

#include "DeviceConfig.h"

using namespace BrewControl;

namespace {

JsonDocument parse(const char* json) {
  JsonDocument doc;
  TEST_ASSERT_TRUE(deserializeJson(doc, json) == DeserializationError::Ok);
  return doc;
}

bool parseDef(const char* json, DeviceDef& d, std::string& err) {
  JsonDocument doc = parse(json);
  return parseDeviceDef(doc.as<JsonObjectConst>(), d, err);
}

DeviceDef ok(const char* json) {
  DeviceDef d;
  std::string err;
  TEST_ASSERT_TRUE_MESSAGE(parseDef(json, d, err), err.c_str());
  return d;
}

std::string errorOf(const char* json) {
  DeviceDef d;
  std::string err;
  TEST_ASSERT_FALSE(parseDef(json, d, err));
  return err;
}

}  // namespace

void setUp() {}
void tearDown() {}

void test_mcp4728_type_table() {
  const DeviceType* t = findDeviceType("mcp4728");
  TEST_ASSERT_NOT_NULL(t);
  TEST_ASSERT_EQUAL_STRING("i2c", t->bus);
  TEST_ASSERT_EQUAL(0x60, t->addrFirst);
  TEST_ASSERT_EQUAL(0x67, t->addrLast);
  TEST_ASSERT_EQUAL(0x60, t->addrDefault);
  TEST_ASSERT_EQUAL_STRING("dac", t->provides.cap);
  TEST_ASSERT_EQUAL(4, t->provides.count);
  TEST_ASSERT_EQUAL(4095, t->provides.rawMax);
  TEST_ASSERT_EQUAL_STRING("ABCD", t->provides.channelNames);
  TEST_ASSERT_NULL(findDeviceType("pcf8575"));
}

void test_parse_derives_id_from_type_bus_and_address() {
  DeviceDef d = ok(R"({"type":"mcp4728","bus":"i2c-board","address":96,"label":"DAC Kessel"})");
  TEST_ASSERT_EQUAL_STRING("mcp4728-i2c-board-60", d.id.c_str());
  TEST_ASSERT_EQUAL_STRING("i2c-board", d.bus.c_str());
  TEST_ASSERT_EQUAL(0x60, d.address);
  TEST_ASSERT_EQUAL_STRING("DAC Kessel", d.label.c_str());

  d = ok(R"({"type":"mcp4728","bus":"i2c-4-5","address":103})");
  TEST_ASSERT_EQUAL_STRING("mcp4728-i2c-4-5-67", d.id.c_str());
}

void test_given_id_is_ignored() {
  DeviceDef d = ok(R"({"id":"mine","type":"mcp4728","bus":"i2c-board","address":97})");
  TEST_ASSERT_EQUAL_STRING("mcp4728-i2c-board-61", d.id.c_str());
}

void test_address_defaults_to_factory_address() {
  DeviceDef d = ok(R"({"type":"mcp4728","bus":"i2c-board"})");
  TEST_ASSERT_EQUAL(0x60, d.address);
}

void test_parse_errors() {
  TEST_ASSERT_EQUAL_STRING("unknown device type", errorOf(R"({"type":"x","bus":"i2c-board"})").c_str());
  TEST_ASSERT_EQUAL_STRING("missing bus", errorOf(R"({"type":"mcp4728"})").c_str());
  TEST_ASSERT_EQUAL_STRING("address must be 0x60..0x67",
                           errorOf(R"({"type":"mcp4728","bus":"b","address":95})").c_str());
  TEST_ASSERT_EQUAL_STRING("address must be 0x60..0x67",
                           errorOf(R"({"type":"mcp4728","bus":"b","address":104})").c_str());
  TEST_ASSERT_EQUAL_STRING("address must be 0x60..0x67",
                           errorOf(R"({"type":"mcp4728","bus":"b","address":"0x60"})").c_str());
  TEST_ASSERT_EQUAL_STRING(
      "label too long",
      errorOf(R"({"type":"mcp4728","bus":"b","label":"123456789012345678901234567890123"})").c_str());
}

void test_stored_form_round_trips() {
  DeviceDef d = ok(R"({"type":"mcp4728","bus":"i2c-board","address":98,"label":"L"})");
  JsonDocument out;
  writeDeviceDef(d, out.to<JsonObject>());
  TEST_ASSERT_EQUAL_STRING("mcp4728-i2c-board-62", out["id"]);
  TEST_ASSERT_EQUAL(98, out["address"].as<int>());
  DeviceDef back;
  std::string err;
  TEST_ASSERT_TRUE(parseDeviceDef(out.as<JsonObjectConst>(), back, err));
  TEST_ASSERT_EQUAL_STRING(d.id.c_str(), back.id.c_str());
  TEST_ASSERT_EQUAL_STRING("L", back.label.c_str());

  // No label → no key.
  d = ok(R"({"type":"mcp4728","bus":"i2c-board"})");
  JsonDocument bare;
  writeDeviceDef(d, bare.to<JsonObject>());
  TEST_ASSERT_TRUE(bare["label"].isNull());
}

void test_devices_count_as_bus_users() {
  std::vector<DeviceDef> devices = {ok(R"({"type":"mcp4728","bus":"i2c-board","address":96})"),
                                    ok(R"({"type":"mcp4728","bus":"i2c-4-5","address":96})"),
                                    ok(R"({"type":"mcp4728","bus":"i2c-board","address":97})")};
  auto users = devicesOnBus(devices, "i2c-board");
  TEST_ASSERT_EQUAL(2, users.size());
  TEST_ASSERT_EQUAL_STRING("mcp4728-i2c-board-60", users[0].c_str());
  TEST_ASSERT_EQUAL_STRING("mcp4728-i2c-board-61", users[1].c_str());
  TEST_ASSERT_TRUE(devicesOnBus(devices, "onewire-4").empty());
  TEST_ASSERT_NOT_NULL(findDeviceDef(devices, "mcp4728-i2c-4-5-60"));
  TEST_ASSERT_NULL(findDeviceDef(devices, "mcp4728-i2c-4-5-61"));
}

int main(int, char**) {
  UNITY_BEGIN();
  RUN_TEST(test_mcp4728_type_table);
  RUN_TEST(test_parse_derives_id_from_type_bus_and_address);
  RUN_TEST(test_given_id_is_ignored);
  RUN_TEST(test_address_defaults_to_factory_address);
  RUN_TEST(test_parse_errors);
  RUN_TEST(test_stored_form_round_trips);
  RUN_TEST(test_devices_count_as_bus_users);
  return UNITY_END();
}
