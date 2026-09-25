#include <unity.h>

#include <string>
#include <vector>

#include "BoardPins.h"
#include "PinMap.h"

using namespace BrewControl;

namespace {

JsonDocument parse(const char* json) {
  JsonDocument doc;
  TEST_ASSERT_TRUE(deserializeJson(doc, json) == DeserializationError::Ok);
  return doc;
}

std::vector<PinUse> usesOf(std::initializer_list<const char*> configs) {
  std::vector<PinUse> uses;
  for (const char* c : configs) {
    JsonDocument doc = parse(c);
    collectPins(doc.as<JsonObjectConst>(), uses);
  }
  return uses;
}

PinCheck check(const Board& b, const std::vector<PinUse>& uses, const char* cfg,
               const char* replaceId = "") {
  JsonDocument doc = parse(cfg);
  return checkItemPins(b, uses, doc.as<JsonObjectConst>(), replaceId);
}

}  // namespace

void setUp() {}
void tearDown() {}

void test_collect_keys_per_type() {
  auto u = usesOf({R"({"type":"IDS1","id":"ids","pin_white":9,"pin_yellow":42,"pin_interrupt":18})"});
  TEST_ASSERT_EQUAL(3, u.size());
  TEST_ASSERT_EQUAL_STRING("pin_white", u[0].key);
  TEST_ASSERT_TRUE(u[0].output);
  TEST_ASSERT_TRUE(u[1].rmt);
  TEST_ASSERT_FALSE(u[2].output);

  u = usesOf({R"({"type":"MAX31865","id":"m","cs":5,"clk":18,"miso":19,"mosi":23})"});
  TEST_ASSERT_EQUAL(4, u.size());
  TEST_ASSERT_TRUE(u[0].share == Share::None);
  TEST_ASSERT_TRUE(u[1].share == Share::Spi);

  u = usesOf({R"({"type":"MAX31865","id":"m","cs":5})"});  // default SPI bus
  TEST_ASSERT_EQUAL(1, u.size());

  u = usesOf({R"({"type":"HCSR04","id":"h","trig":4,"echo":5})",
              R"({"type":"HX711","id":"x","dout":16,"sck":17})"});
  TEST_ASSERT_EQUAL(4, u.size());
  TEST_ASSERT_TRUE(u[0].output);   // trig
  TEST_ASSERT_FALSE(u[1].output);  // echo
  TEST_ASSERT_FALSE(u[2].output);  // dout
  TEST_ASSERT_TRUE(u[3].output);   // sck
}

void test_collect_ignores_pinless_items() {
  auto u = usesOf({R"({"type":"BME280","id":"b","address":118})",
                   R"({"type":"Remote","id":"r","device":"d","remote_id":"x"})",
                   R"({"type":"PID","id":"p","sensor":"s","actuator":"a"})"});
  TEST_ASSERT_EQUAL(0, u.size());
}

void test_free_pin_ok() {
  auto r = check(kEsp32Dev, {}, R"({"type":"DigitalOutput","id":"a","pin":16})");
  TEST_ASSERT_TRUE(r.ok);
  TEST_ASSERT_EQUAL(0, r.warnings.size());
}

void test_pin_taken_is_409_naming_the_owner() {
  auto uses = usesOf({R"({"type":"DigitalOutput","id":"pump","pin":16})"});
  auto r = check(kEsp32Dev, uses, R"({"type":"DS18B20","id":"t","pin":16})");
  TEST_ASSERT_FALSE(r.ok);
  TEST_ASSERT_EQUAL(409, r.status);
  TEST_ASSERT_TRUE(r.error.find("pump") != std::string::npos);
}

void test_onewire_shared_between_ds18b20() {
  auto uses = usesOf({R"({"type":"DS18B20","id":"t1","pin":4,"address":"28FF000000000001"})"});
  auto r = check(kEsp32Dev, uses, R"({"type":"DS18B20","id":"t2","pin":4})");
  TEST_ASSERT_TRUE(r.ok);
  TEST_ASSERT_TRUE(findPinConflicts(kEsp32Dev, uses).empty());
}

void test_spi_shared_but_cs_exclusive() {
  auto uses = usesOf({R"({"type":"MAX31865","id":"m1","cs":5,"clk":18,"miso":19,"mosi":23})"});
  TEST_ASSERT_TRUE(check(kEsp32Dev, uses,
      R"({"type":"MAX31865","id":"m2","cs":4,"clk":18,"miso":19,"mosi":23})").ok);
  auto r = check(kEsp32Dev, uses,
      R"({"type":"MAX31865","id":"m2","cs":5,"clk":18,"miso":19,"mosi":23})");
  TEST_ASSERT_EQUAL(409, r.status);
  // SPI clock of a MAX31865 is no place for a relay.
  TEST_ASSERT_EQUAL(409, check(kEsp32Dev, uses,
      R"({"type":"DigitalOutput","id":"a","pin":18})").status);
}

void test_forbidden_and_missing_pins_are_400() {
  auto r = check(kEsp32Dev, {}, R"({"type":"DigitalOutput","id":"a","pin":6})");
  TEST_ASSERT_EQUAL(400, r.status);
  TEST_ASSERT_TRUE(r.error.find("Flash") != std::string::npos);
  TEST_ASSERT_EQUAL(400, check(kEsp32Dev, {}, R"({"type":"DigitalOutput","id":"a","pin":20})").status);
  TEST_ASSERT_EQUAL(400, check(kLilyGoAmoled, {}, R"({"type":"DigitalInput","id":"a","pin":35})").status);
}

void test_reserved_is_409() {
  auto r = check(kLilyGoAmoled, {}, R"({"type":"DigitalOutput","id":"a","pin":7})");
  TEST_ASSERT_EQUAL(409, r.status);
  TEST_ASSERT_TRUE(r.error.find("I2C") != std::string::npos);
  TEST_ASSERT_EQUAL(409, check(kEsp32Dev, {}, R"({"type":"DigitalInput","id":"a","pin":0})").status);
}

void test_input_only_rejects_outputs_only() {
  TEST_ASSERT_EQUAL(400, check(kEsp32Dev, {}, R"({"type":"DigitalOutput","id":"a","pin":34})").status);
  TEST_ASSERT_TRUE(check(kEsp32Dev, {}, R"({"type":"AnalogInput","id":"a","pin":34})").ok);
  TEST_ASSERT_EQUAL(400, check(kEsp32Dev, {}, R"({"type":"HCSR04","id":"h","trig":35,"echo":34})").status);
}

void test_same_pin_twice_in_one_item() {
  TEST_ASSERT_EQUAL(400, check(kEsp32Dev, {}, R"({"type":"HCSR04","id":"h","trig":4,"echo":4})").status);
}

void test_risky_pin_warns() {
  auto r = check(kLilyGoAmoled, {}, R"({"type":"DigitalOutput","id":"a","pin":3})");
  TEST_ASSERT_TRUE(r.ok);
  TEST_ASSERT_EQUAL(1, r.warnings.size());
  TEST_ASSERT_TRUE(r.warnings[0].find("Strapping") != std::string::npos);
}

void test_dac() {
  TEST_ASSERT_TRUE(check(kEsp32Dev, {}, R"({"type":"AnalogOutput","id":"a","pin":25,"mode":"dac"})").ok);
  TEST_ASSERT_EQUAL(400, check(kEsp32Dev, {}, R"({"type":"AnalogOutput","id":"a","pin":16,"mode":"dac"})").status);
  auto r = check(kLilyGoAmoled, {}, R"({"type":"AnalogOutput","id":"a","pin":47,"mode":"dac"})");
  TEST_ASSERT_EQUAL(400, r.status);
  TEST_ASSERT_TRUE(r.error.find("no DAC") != std::string::npos);
  TEST_ASSERT_TRUE(check(kLilyGoAmoled, {}, R"({"type":"AnalogOutput","id":"a","pin":47})").ok);
}

void test_rmt_budget() {
  auto uses = usesOf({
      R"({"type":"IDS1","id":"i1","pin_white":1,"pin_yellow":2,"pin_interrupt":5})",
      R"({"type":"IDS1","id":"i2","pin_white":8,"pin_yellow":18,"pin_interrupt":21})",
      R"({"type":"IDS2","id":"i3","pin_white":38,"pin_yellow":39,"pin_interrupt":40})",
      R"({"type":"IDS2","id":"i4","pin_white":41,"pin_yellow":42,"pin_interrupt":47})"});
  TEST_ASSERT_EQUAL(4, rmtItems(uses));
  auto r = check(kLolinS2Mini, uses,
      R"({"type":"IDS1","id":"i5","pin_white":10,"pin_yellow":11,"pin_interrupt":12})");
  TEST_ASSERT_EQUAL(409, r.status);
  TEST_ASSERT_TRUE(r.error.find("RMT") != std::string::npos);
  // Replacing one of the four frees its channel.
  TEST_ASSERT_TRUE(check(kLolinS2Mini, uses,
      R"({"type":"IDS1","id":"i4","pin_white":10,"pin_yellow":11,"pin_interrupt":12})", "i4").ok);
}

void test_replace_ignores_own_pins() {
  auto uses = usesOf({R"({"type":"DigitalOutput","id":"pump","pin":16})"});
  TEST_ASSERT_EQUAL(409, check(kEsp32Dev, uses, R"({"type":"DigitalOutput","id":"pump","pin":16})").status);
  TEST_ASSERT_TRUE(check(kEsp32Dev, uses, R"({"type":"DigitalOutput","id":"pump","pin":16})", "pump").ok);
  // Renamed while replaced: still its own pin.
  TEST_ASSERT_TRUE(check(kEsp32Dev, uses, R"({"type":"DigitalOutput","id":"pump2","pin":16})", "pump").ok);
}

void test_conflicts_in_stored_config() {
  // The LilyGo config from 2026-09-25: IDS1 and agitator both on GPIO 3,
  // IDS1 white wire on the touch interrupt line after the manual fix.
  auto uses = usesOf({
      R"({"type":"IDS1","id":"IDS1","pin_white":3,"pin_yellow":42,"pin_interrupt":18})",
      R"({"type":"DigitalOutput","id":"agitator","pin":3})",
      R"({"type":"DigitalOutput","id":"pump","pin":9})",
      R"({"type":"DS18B20","id":"t1","pin":1})",
      R"({"type":"DS18B20","id":"t2","pin":1})"});
  auto c = findPinConflicts(kLilyGoAmoled, uses);
  TEST_ASSERT_EQUAL(2, c.size());
  TEST_ASSERT_EQUAL(3, c[0].gpio);
  TEST_ASSERT_EQUAL(2, c[0].users.size());
  TEST_ASSERT_EQUAL(9, c[1].gpio);
  TEST_ASSERT_EQUAL_STRING("Touch-/RTC-Interrupt", c[1].reason.c_str());
}

void test_pins_json() {
  auto uses = usesOf({R"({"type":"DigitalOutput","id":"pump","pin":2})",
                      R"({"type":"IDS1","id":"IDS1","pin_white":9,"pin_yellow":42,"pin_interrupt":18})"});
  JsonDocument doc;
  writePinsJson(kLilyGoAmoled, "lilygo", uses, doc.to<JsonObject>());
  TEST_ASSERT_EQUAL_STRING("lilygo", doc["board"]);
  TEST_ASSERT_FALSE(doc["caps"]["dac"].as<bool>());
  TEST_ASSERT_EQUAL(4, doc["caps"]["rmtTx"].as<int>());
  TEST_ASSERT_EQUAL(1, doc["caps"]["rmtUsed"].as<int>());
  JsonArrayConst pins = doc["pins"];
  TEST_ASSERT_EQUAL(22 + 23, pins.size());  // GPIO 0–21 and 26–48
  JsonObjectConst p2 = pins[2];
  TEST_ASSERT_EQUAL(2, p2["gpio"].as<int>());
  TEST_ASSERT_EQUAL_STRING("free", p2["class"]);
  TEST_ASSERT_EQUAL_STRING("pump", p2["users"][0]["id"]);
  TEST_ASSERT_EQUAL_STRING("risky", pins[3]["class"]);
  TEST_ASSERT_EQUAL(1, doc["conflicts"].size());  // GPIO 9
}

int main(int, char**) {
  UNITY_BEGIN();
  RUN_TEST(test_collect_keys_per_type);
  RUN_TEST(test_collect_ignores_pinless_items);
  RUN_TEST(test_free_pin_ok);
  RUN_TEST(test_pin_taken_is_409_naming_the_owner);
  RUN_TEST(test_onewire_shared_between_ds18b20);
  RUN_TEST(test_spi_shared_but_cs_exclusive);
  RUN_TEST(test_forbidden_and_missing_pins_are_400);
  RUN_TEST(test_reserved_is_409);
  RUN_TEST(test_input_only_rejects_outputs_only);
  RUN_TEST(test_same_pin_twice_in_one_item);
  RUN_TEST(test_risky_pin_warns);
  RUN_TEST(test_dac);
  RUN_TEST(test_rmt_budget);
  RUN_TEST(test_replace_ignores_own_pins);
  RUN_TEST(test_conflicts_in_stored_config);
  RUN_TEST(test_pins_json);
  return UNITY_END();
}
