#include <unity.h>

#include <string>
#include <vector>

#include "BoardPins.h"
#include "BusConfig.h"

using namespace BrewControl;

namespace {

JsonDocument parse(const char* json) {
  JsonDocument doc;
  TEST_ASSERT_TRUE(deserializeJson(doc, json) == DeserializationError::Ok);
  return doc;
}

bool parseDef(const char* json, BusDef& d, std::string& err) {
  JsonDocument doc = parse(json);
  return parseBusDef(doc.as<JsonObjectConst>(), d, err);
}

std::string errorOf(const char* json) {
  BusDef d;
  std::string err;
  TEST_ASSERT_FALSE(parseDef(json, d, err));
  return err;
}

// Runs the migration over one stored item and returns it re-serialized.
std::string migrate(const char* item, std::vector<BusDef>& buses, const Board& b,
                    bool expectChanged = true) {
  JsonDocument doc = parse(item);
  TEST_ASSERT_EQUAL(expectChanged, normalizeLegacyItem(doc.as<JsonObject>(), buses, b));
  std::string out;
  serializeJson(doc, out);
  return out;
}

std::vector<BusDef> lilygoFixed() {
  std::vector<BusDef> v;
  for (const FixedBus& f : kLilyGoAmoledBuses) v.push_back(busFromFixed(f));
  return v;
}

}  // namespace

void setUp() {}
void tearDown() {}

void test_parse_derives_id_from_pins() {
  BusDef d;
  std::string err;
  TEST_ASSERT_TRUE(parseDef(R"({"type":"i2c","sda":4,"scl":5,"label":"Zweitbus","id":"ignored"})", d, err));
  TEST_ASSERT_EQUAL_STRING("i2c-4-5", d.id.c_str());
  TEST_ASSERT_EQUAL_STRING("Zweitbus", d.label.c_str());
  TEST_ASSERT_EQUAL(-1, d.port);  // assigned by DynamicItems, not by the client

  TEST_ASSERT_TRUE(parseDef(R"({"type":"spi","clk":18,"miso":19,"mosi":23})", d, err));
  TEST_ASSERT_EQUAL_STRING("spi-18-19-23", d.id.c_str());
  TEST_ASSERT_TRUE(parseDef(R"({"type":"onewire","pin":4})", d, err));
  TEST_ASSERT_EQUAL_STRING("onewire-4", d.id.c_str());
}

void test_parse_rejects_bad_definitions() {
  TEST_ASSERT_EQUAL_STRING("unknown bus type", errorOf(R"({"type":"can","tx":4,"rx":5})").c_str());
  TEST_ASSERT_EQUAL_STRING("missing scl", errorOf(R"({"type":"i2c","sda":4})").c_str());
  TEST_ASSERT_EQUAL_STRING("missing pin", errorOf(R"({"type":"onewire","pin":-1})").c_str());
  TEST_ASSERT_EQUAL_STRING("sda and scl must differ", errorOf(R"({"type":"i2c","sda":4,"scl":4})").c_str());
  TEST_ASSERT_EQUAL_STRING("invalid port", errorOf(R"({"type":"i2c","sda":4,"scl":5,"port":2})").c_str());
  TEST_ASSERT_EQUAL_STRING("invalid port", errorOf(R"({"type":"onewire","pin":4,"port":0})").c_str());
  TEST_ASSERT_EQUAL_STRING("label too long",
      errorOf(R"({"type":"onewire","pin":4,"label":"123456789012345678901234567890123"})").c_str());
}

void test_stored_form_round_trips() {
  BusDef d;
  std::string err;
  TEST_ASSERT_TRUE(parseDef(R"({"type":"i2c","sda":4,"scl":5,"port":1})", d, err));
  JsonDocument doc;
  writeBusDef(d, doc.to<JsonObject>());
  std::string json;
  serializeJson(doc, json);
  TEST_ASSERT_EQUAL_STRING(R"({"id":"i2c-4-5","type":"i2c","sda":4,"scl":5,"port":1})", json.c_str());
}

// A re-pinned bus keeps its id; it is read back from storage only.
void test_stored_id_survives_pin_change() {
  const char* stored = R"({"id":"i2c-4-5","type":"i2c","sda":16,"scl":17,"port":1})";
  JsonDocument doc = parse(stored);
  BusDef d;
  std::string err;
  TEST_ASSERT_TRUE(parseBusDef(doc.as<JsonObjectConst>(), d, err, true));
  TEST_ASSERT_EQUAL_STRING("i2c-4-5", d.id.c_str());
  TEST_ASSERT_EQUAL(16, d.pins[0]);
  TEST_ASSERT_TRUE(parseBusDef(doc.as<JsonObjectConst>(), d, err));  // from the API
  TEST_ASSERT_EQUAL_STRING("i2c-16-17", d.id.c_str());
}

void test_fixed_bus_has_no_pin_uses() {
  const std::vector<BusDef> fixed = lilygoFixed();
  TEST_ASSERT_EQUAL(1, fixed.size());
  TEST_ASSERT_TRUE(fixed[0].fixed);
  TEST_ASSERT_EQUAL(0, fixed[0].port);
  TEST_ASSERT_EQUAL(3, fixed[0].reservedCount);
  std::vector<PinUse> uses;
  busPinUses(fixed[0], uses);
  TEST_ASSERT_EQUAL(0, uses.size());  // GPIO 6/7 are Reserved in the board table
}

void test_i2c_ports() {
  std::vector<BusDef> buses = lilygoFixed();
  TEST_ASSERT_EQUAL(1, freeI2cPort(buses));  // the fixed bus holds Wire
  BusDef d;
  std::string err;
  TEST_ASSERT_TRUE(parseDef(R"({"type":"i2c","sda":1,"scl":2})", d, err));
  d.port = freeI2cPort(buses);
  buses.push_back(d);
  TEST_ASSERT_EQUAL(-1, freeI2cPort(buses));
  TEST_ASSERT_EQUAL(2, busesOfType(buses, "i2c"));
  TEST_ASSERT_EQUAL(2, findBusType("i2c")->max);
  // Its own port counts as free when the bus itself is being checked.
  TEST_ASSERT_EQUAL(1, freeI2cPort(buses, "i2c-1-2"));
}

void test_migrate_ds18b20_shares_one_bus() {
  std::vector<BusDef> buses;
  TEST_ASSERT_EQUAL_STRING(R"({"type":"DS18B20","id":"t1","address":"28ff000000000001","bus":"onewire-4"})",
                           migrate(R"({"type":"DS18B20","id":"t1","pin":4,"address":"28ff000000000001"})",
                                   buses, kEsp32Dev).c_str());
  migrate(R"({"type":"DS18B20","id":"t2","pin":4})", buses, kEsp32Dev);
  TEST_ASSERT_EQUAL(1, buses.size());
  TEST_ASSERT_EQUAL_STRING("onewire-4", buses[0].id.c_str());
  TEST_ASSERT_EQUAL(4, buses[0].pins[0]);
  TEST_ASSERT_FALSE(buses[0].fixed);
}

void test_migrate_max31865() {
  std::vector<BusDef> buses;
  TEST_ASSERT_EQUAL_STRING(R"({"type":"MAX31865","id":"m","cs":5,"bus":"spi-18-19-23"})",
                           migrate(R"({"type":"MAX31865","id":"m","cs":5,"clk":18,"miso":19,"mosi":23})",
                                   buses, kEsp32Dev).c_str());
  // Hardware SPI and incomplete legacy lines stay as they are.
  migrate(R"({"type":"MAX31865","id":"m2","cs":4})", buses, kEsp32Dev, false);
  migrate(R"({"type":"MAX31865","id":"m3","cs":4,"clk":18})", buses, kEsp32Dev, false);
  TEST_ASSERT_EQUAL(1, buses.size());
}

void test_migrate_i2c_to_fixed_or_default_bus() {
  std::vector<BusDef> lilygo = lilygoFixed();
  TEST_ASSERT_EQUAL_STRING(R"({"type":"BME280","id":"b","bus":"i2c-board"})",
                           migrate(R"({"type":"BME280","id":"b"})", lilygo, kLilyGoAmoled).c_str());
  TEST_ASSERT_EQUAL(1, lilygo.size());

  std::vector<BusDef> esp;
  migrate(R"({"type":"GY521","id":"g","address":104})", esp, kEsp32Dev);
  migrate(R"({"type":"BME280","id":"b"})", esp, kEsp32Dev);
  TEST_ASSERT_EQUAL(1, esp.size());
  TEST_ASSERT_EQUAL_STRING("i2c-21-22", esp[0].id.c_str());
  TEST_ASSERT_EQUAL(0, esp[0].port);

  std::vector<BusDef> s2;
  migrate(R"({"type":"BME280","id":"b"})", s2, kLolinS2Mini);
  TEST_ASSERT_EQUAL_STRING("i2c-33-35", s2[0].id.c_str());
}

void test_migrate_leaves_current_configs_alone() {
  std::vector<BusDef> buses;
  migrate(R"({"type":"DS18B20","id":"t","bus":"onewire-4"})", buses, kEsp32Dev, false);
  migrate(R"({"type":"DigitalOutput","id":"a","pin":16})", buses, kEsp32Dev, false);
  TEST_ASSERT_EQUAL(0, buses.size());
}

void test_item_bus_types() {
  TEST_ASSERT_EQUAL_STRING("onewire", itemBusType("DS18B20"));
  TEST_ASSERT_EQUAL_STRING("spi", itemBusType("MAX31865"));
  TEST_ASSERT_EQUAL_STRING("i2c", itemBusType("GY521"));
  TEST_ASSERT_EQUAL_STRING("i2c", itemBusType("QMI8658"));
  TEST_ASSERT_EQUAL_STRING("i2c", itemBusType("BMI270"));
  TEST_ASSERT_EQUAL_STRING("i2c", itemBusType("BMI160"));
  TEST_ASSERT_NULL(itemBusType("DigitalOutput"));
}

int main(int, char**) {
  UNITY_BEGIN();
  RUN_TEST(test_parse_derives_id_from_pins);
  RUN_TEST(test_parse_rejects_bad_definitions);
  RUN_TEST(test_stored_form_round_trips);
  RUN_TEST(test_stored_id_survives_pin_change);
  RUN_TEST(test_fixed_bus_has_no_pin_uses);
  RUN_TEST(test_i2c_ports);
  RUN_TEST(test_migrate_ds18b20_shares_one_bus);
  RUN_TEST(test_migrate_max31865);
  RUN_TEST(test_migrate_i2c_to_fixed_or_default_bus);
  RUN_TEST(test_migrate_leaves_current_configs_alone);
  RUN_TEST(test_item_bus_types);
  return UNITY_END();
}
