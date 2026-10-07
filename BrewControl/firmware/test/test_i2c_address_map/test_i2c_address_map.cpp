#include <unity.h>

#include <string>
#include <vector>

#include "BoardPins.h"
#include "I2cAddressMap.h"

using namespace BrewControl;

namespace {

JsonDocument parse(const char* json) {
  JsonDocument doc;
  TEST_ASSERT_TRUE(deserializeJson(doc, json) == DeserializationError::Ok);
  return doc;
}

std::vector<AddressUse> usesOf(std::initializer_list<const char*> configs) {
  std::vector<AddressUse> uses;
  for (const char* c : configs) {
    JsonDocument doc = parse(c);
    collectAddresses(doc.as<JsonObjectConst>(), uses);
  }
  return uses;
}

AddressCheck check(const AddrDef* reserved, size_t reservedCount,
                   const std::vector<AddressUse>& uses, const char* cfg,
                   const char* replaceId = "") {
  JsonDocument doc = parse(cfg);
  return checkItemAddress(reserved, reservedCount, uses, doc.as<JsonObjectConst>(), replaceId);
}

}  // namespace

void setUp() {}
void tearDown() {}

void test_collect_keys_per_type() {
  auto u = usesOf({R"({"type":"BME280","id":"b"})"});
  TEST_ASSERT_EQUAL(1, u.size());
  TEST_ASSERT_EQUAL(0x76, u[0].addr);  // default

  u = usesOf({R"({"type":"BME280","id":"b","address":119})"});
  TEST_ASSERT_EQUAL(119, u[0].addr);

  u = usesOf({R"({"type":"GY521","id":"g"})"});
  TEST_ASSERT_EQUAL(1, u.size());
  TEST_ASSERT_EQUAL(0x68, u[0].addr);

  u = usesOf({R"({"type":"GY521","id":"g","bus":"i2c-4-5"})"});
  TEST_ASSERT_EQUAL_STRING("i2c-4-5", u[0].bus.c_str());

  u = usesOf({R"({"type":"QMI8658","id":"q"})", R"({"type":"BMI270","id":"b"})",
              R"({"type":"BMI160","id":"c","address":105})"});
  TEST_ASSERT_EQUAL(3, u.size());
  TEST_ASSERT_EQUAL(0x6B, u[0].addr);
  TEST_ASSERT_EQUAL(0x68, u[1].addr);
  TEST_ASSERT_EQUAL(0x69, u[2].addr);

  u = usesOf({R"({"type":"DS18B20","id":"t","bus":"onewire-4"})",
              R"({"type":"Remote","id":"r","device":"d","remote_id":"x"})"});
  TEST_ASSERT_EQUAL(0, u.size());
}

void test_same_address_on_two_buses_ok() {
  auto uses = usesOf({R"({"type":"BME280","id":"amb","bus":"i2c-board"})"});
  TEST_ASSERT_TRUE(check(nullptr, 0, uses, R"({"type":"BME280","id":"b2","bus":"i2c-4-5"})").ok);
  TEST_ASSERT_EQUAL(409, check(nullptr, 0, uses,
                               R"({"type":"BME280","id":"b2","bus":"i2c-board"})").status);
}

void test_free_address_ok() {
  auto r = check(nullptr, 0, {}, R"({"type":"BME280","id":"b"})");
  TEST_ASSERT_TRUE(r.ok);
}

void test_address_taken_is_409_naming_owner() {
  auto uses = usesOf({R"({"type":"BME280","id":"amb"})"});
  auto r = check(nullptr, 0, uses, R"({"type":"BME280","id":"b2"})");
  TEST_ASSERT_FALSE(r.ok);
  TEST_ASSERT_EQUAL(409, r.status);
  TEST_ASSERT_TRUE(r.error.find("amb") != std::string::npos);
  TEST_ASSERT_TRUE(r.error.find("0x76") != std::string::npos);

  // Different addresses on the same bus never conflict.
  TEST_ASSERT_TRUE(check(nullptr, 0, uses, R"({"type":"GY521","id":"g"})").ok);
}

void test_reserved_address_is_409() {
  const AddrDef reserved[] = {{0x51, "RTC (PCF8563)"}};
  auto r = check(reserved, 1, {}, R"({"type":"GY521","id":"g","address":81})");  // 0x51
  TEST_ASSERT_EQUAL(409, r.status);
  TEST_ASSERT_TRUE(r.error.find("RTC") != std::string::npos);

  // LilyGo's real fixed bus (BoardPins.h): touch's 0x5A blocks a BME280 there.
  const BusDef board = busFromFixed(kLilyGoAmoledBuses[0]);
  TEST_ASSERT_EQUAL(409, check(board.reserved, board.reservedCount, {},
                                R"({"type":"BME280","id":"b","bus":"i2c-board","address":90})").status);
}

void test_replace_ignores_own_address() {
  auto uses = usesOf({R"({"type":"BME280","id":"amb"})"});
  TEST_ASSERT_EQUAL(409, check(nullptr, 0, uses, R"({"type":"BME280","id":"amb2"})").status);
  TEST_ASSERT_TRUE(check(nullptr, 0, uses, R"({"type":"BME280","id":"amb"})", "amb").ok);
  // Renamed while replaced: still its own address.
  TEST_ASSERT_TRUE(check(nullptr, 0, uses, R"({"type":"BME280","id":"amb-renamed"})", "amb").ok);
}

int main(int, char**) {
  UNITY_BEGIN();
  RUN_TEST(test_collect_keys_per_type);
  RUN_TEST(test_free_address_ok);
  RUN_TEST(test_address_taken_is_409_naming_owner);
  RUN_TEST(test_same_address_on_two_buses_ok);
  RUN_TEST(test_reserved_address_is_409);
  RUN_TEST(test_replace_ignores_own_address);
  return UNITY_END();
}
