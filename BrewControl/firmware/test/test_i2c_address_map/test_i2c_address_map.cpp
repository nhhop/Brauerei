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

  // Waveshare's fixed bus: the PMU blocks its address, the onboard QMI8658
  // (0x6B) stays free for its sensor item.
  const BusDef ws = busFromFixed(kWaveshareAmoled175Buses[0]);
  TEST_ASSERT_EQUAL(409, check(ws.reserved, ws.reservedCount, {},
                               R"({"type":"BMI160","id":"b","bus":"i2c-board","address":52})").status);  // 0x34
  TEST_ASSERT_TRUE(check(ws.reserved, ws.reservedCount, {},
                         R"({"type":"QMI8658","id":"q","bus":"i2c-board"})").ok);

  // StopWatch: the expander's 0x4F is taken, the onboard BMI270 (0x68) free.
  const BusDef m5 = busFromFixed(kM5StopWatchBuses[0]);
  TEST_ASSERT_EQUAL(409, check(m5.reserved, m5.reservedCount, {},
                               R"({"type":"BME280","id":"b","bus":"i2c-board","address":79})").status);
  TEST_ASSERT_TRUE(check(m5.reserved, m5.reservedCount, {},
                         R"({"type":"BMI270","id":"i","bus":"i2c-board"})").ok);
}

void test_replace_ignores_own_address() {
  auto uses = usesOf({R"({"type":"BME280","id":"amb"})"});
  TEST_ASSERT_EQUAL(409, check(nullptr, 0, uses, R"({"type":"BME280","id":"amb2"})").status);
  TEST_ASSERT_TRUE(check(nullptr, 0, uses, R"({"type":"BME280","id":"amb"})", "amb").ok);
  // Renamed while replaced: still its own address.
  TEST_ASSERT_TRUE(check(nullptr, 0, uses, R"({"type":"BME280","id":"amb-renamed"})", "amb").ok);
}

// ── Peripheral devices (DeviceConfig.h) ───────────────────────────────────

namespace {
DeviceDef device(const char* json) {
  JsonDocument doc = parse(json);
  DeviceDef d;
  std::string err;
  TEST_ASSERT_TRUE_MESSAGE(parseDeviceDef(doc.as<JsonObjectConst>(), d, err), err.c_str());
  return d;
}

AddressUse useOf(const DeviceDef& d) { return {d.id, d.bus, d.address}; }
}  // namespace

void test_device_addresses_are_collected() {
  std::vector<AddressUse> uses;
  collectDeviceAddresses({device(R"({"type":"mcp4728","bus":"i2c-board","address":97})")}, uses);
  TEST_ASSERT_EQUAL(1, uses.size());
  TEST_ASSERT_EQUAL_STRING("mcp4728-i2c-board-61", uses[0].item.c_str());
  TEST_ASSERT_EQUAL_STRING("i2c-board", uses[0].bus.c_str());
  TEST_ASSERT_EQUAL(0x61, uses[0].addr);
}

void test_device_and_sensor_share_one_address_space() {
  const DeviceDef dac = device(R"({"type":"mcp4728","bus":"i2c-board","address":96})");
  std::vector<AddressUse> uses;
  collectDeviceAddresses({dac}, uses);
  // A sensor on the device's address and bus is refused ...
  auto r = check(nullptr, 0, uses, R"({"type":"BME280","id":"b","bus":"i2c-board","address":96})");
  TEST_ASSERT_EQUAL(409, r.status);
  TEST_ASSERT_EQUAL_STRING("0x60 already used by mcp4728-i2c-board-60", r.error.c_str());
  // ... on another bus it is fine.
  TEST_ASSERT_TRUE(check(nullptr, 0, uses, R"({"type":"BME280","id":"b","bus":"i2c-4-5","address":96})").ok);

  // And the other way round: a device on a sensor's address.
  uses = usesOf({R"({"type":"BME280","id":"amb","bus":"i2c-board","address":96})"});
  r = checkAddressUse(nullptr, 0, uses, useOf(dac));
  TEST_ASSERT_EQUAL(409, r.status);
  TEST_ASSERT_EQUAL_STRING("0x60 already used by amb", r.error.c_str());
}

void test_device_on_reserved_address_is_409() {
  // No board reserves 0x60..0x67 today; the check itself is the same as for items.
  const AddrDef reserved[] = {{0x60, "Onboard-DAC"}};
  const DeviceDef dac = device(R"({"type":"mcp4728","bus":"i2c-board","address":96})");
  auto r = checkAddressUse(reserved, 1, {}, useOf(dac));
  TEST_ASSERT_EQUAL(409, r.status);
  TEST_ASSERT_EQUAL_STRING("0x60 is reserved on bus i2c-board (Onboard-DAC)", r.error.c_str());
}

void test_device_replace_ignores_own_address() {
  const DeviceDef dac = device(R"({"type":"mcp4728","bus":"i2c-board","address":96})");
  std::vector<AddressUse> uses;
  collectDeviceAddresses({dac}, uses);
  TEST_ASSERT_EQUAL(409, checkAddressUse(nullptr, 0, uses, useOf(dac)).status);
  TEST_ASSERT_TRUE(checkAddressUse(nullptr, 0, uses, useOf(dac), dac.id.c_str()).ok);
}

void test_expander_not_on_waveshare_tca9554() {
  // The Waveshare board's onboard TCA9554 answers on 0x20, the PCF8575's
  // factory address: there it has to be jumpered to 0x21..0x27.
  const BusDef ws = busFromFixed(kWaveshareAmoled175Buses[0]);
  const DeviceDef at20 = device(R"({"type":"pcf8575","bus":"i2c-board"})");
  auto r = checkAddressUse(ws.reserved, ws.reservedCount, {}, useOf(at20));
  TEST_ASSERT_EQUAL(409, r.status);
  TEST_ASSERT_EQUAL_STRING("0x20 is reserved on bus i2c-board (Port-Expander (TCA9554))",
                           r.error.c_str());
  const DeviceDef at21 = device(R"({"type":"pcf8575","bus":"i2c-board","address":33})");
  TEST_ASSERT_TRUE(checkAddressUse(ws.reserved, ws.reservedCount, {}, useOf(at21)).ok);
}

int main(int, char**) {
  UNITY_BEGIN();
  RUN_TEST(test_collect_keys_per_type);
  RUN_TEST(test_free_address_ok);
  RUN_TEST(test_address_taken_is_409_naming_owner);
  RUN_TEST(test_same_address_on_two_buses_ok);
  RUN_TEST(test_reserved_address_is_409);
  RUN_TEST(test_replace_ignores_own_address);
  RUN_TEST(test_device_addresses_are_collected);
  RUN_TEST(test_device_and_sensor_share_one_address_space);
  RUN_TEST(test_device_on_reserved_address_is_409);
  RUN_TEST(test_device_replace_ignores_own_address);
  RUN_TEST(test_expander_not_on_waveshare_tca9554);
  return UNITY_END();
}
