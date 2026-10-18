#include <unity.h>

#include <string>
#include <vector>

#include "SensorChannels.h"

using namespace BrewControl;

namespace {

JsonDocument parse(const char* json) {
  JsonDocument doc;
  TEST_ASSERT_TRUE(deserializeJson(doc, json) == DeserializationError::Ok);
  return doc;
}

std::string dump(const JsonDocument& doc) {
  std::string out;
  serializeJson(doc, out);
  return out;
}

const char* const kTwo[] = {"rate", "volume"};

bool mask(const char* json, uint16_t& m, const char*& err) {
  JsonDocument doc = parse(json);
  return parseChannelMask(doc.as<JsonObjectConst>(), kTwo, 2, 3, m, err);
}

struct FakeSensor {
  const char* sid;
  std::vector<const char*> keys;
  const char* id() const { return sid; }
  size_t channelCount() const { return keys.size(); }
  struct Ch { const char* key; };
  Ch channel(size_t i) const { return {keys[i]}; }
};
struct FakeReg {
  std::vector<FakeSensor> sensors;
  FakeSensor* findSensor(const char* id) {
    for (auto& s : sensors) if (strcmp(s.sid, id) == 0) return &s;
    return nullptr;
  }
};

}  // namespace

// ── parseChannelMask ─────────────────────────────────────────────────────────

void test_mask_absent_is_default() {
  uint16_t m = 0;
  const char* err = nullptr;
  TEST_ASSERT_TRUE(mask(R"({"type":"YF-S201"})", m, err));
  TEST_ASSERT_EQUAL_UINT16(3, m);
}

void test_mask_selects_keys_by_position() {
  uint16_t m = 0;
  const char* err = nullptr;
  TEST_ASSERT_TRUE(mask(R"({"channels":["volume"]})", m, err));
  TEST_ASSERT_EQUAL_UINT16(2, m);
}

void test_mask_rejects_unknown_empty_and_non_array() {
  uint16_t m = 0;
  const char* err = nullptr;
  TEST_ASSERT_FALSE(mask(R"({"channels":["rate","nope"]})", m, err));
  TEST_ASSERT_EQUAL_STRING("unknown channel", err);
  TEST_ASSERT_FALSE(mask(R"({"channels":[]})", m, err));
  TEST_ASSERT_EQUAL_STRING("channels must not be empty", err);
  TEST_ASSERT_FALSE(mask(R"({"channels":"rate"})", m, err));
  TEST_ASSERT_EQUAL_STRING("channels must be an array", err);
}

void test_mask_eleven_gy521_keys() {
  JsonDocument doc = parse(R"({"channels":["gz","pitch","temp","tilt","dir"]})");
  uint16_t m = 0;
  const char* err = nullptr;
  TEST_ASSERT_EQUAL(11, kGy521ChannelCount);
  TEST_ASSERT_TRUE(parseChannelMask(doc.as<JsonObjectConst>(), kGy521Channels,
                                    kGy521ChannelCount, 1, m, err));
  TEST_ASSERT_EQUAL_UINT16(0x400 | 0x200 | 0x001 | 0x008 | 0x004, m);
  // A key from before the angles were split up is unknown now.
  JsonDocument old = parse(R"({"channels":["angle"]})");
  TEST_ASSERT_FALSE(parseChannelMask(old.as<JsonObjectConst>(), kGy521Channels,
                                     kGy521ChannelCount, 1, m, err));
}

// ── normalizeLegacyGy521 ─────────────────────────────────────────────────────

void test_legacy_gy521_gets_pitch_channel() {
  JsonDocument doc = parse(R"({"type":"GY521","id":"gyro","bus":"i2c-board","address":104})");
  TEST_ASSERT_TRUE(normalizeLegacyGy521(doc.as<JsonObject>()));
  TEST_ASSERT_EQUAL_STRING(
      R"({"type":"GY521","id":"gyro","bus":"i2c-board","address":104,"channels":["pitch"]})",
      dump(doc).c_str());
}

void test_legacy_gy521_calibration_moves_to_pitch() {
  JsonDocument doc = parse(
      R"({"type":"GY521","id":"g","calibrations":[{"channel":"","raw_ref":1,"value_ref":0,"gain":1}]})");
  TEST_ASSERT_TRUE(normalizeLegacyGy521(doc.as<JsonObject>()));
  TEST_ASSERT_EQUAL_STRING("pitch", doc["calibrations"][0]["channel"] | "?");
}

void test_migrated_gy521_and_other_types_untouched() {
  JsonDocument gy = parse(R"({"type":"GY521","id":"g","channels":["ax"]})");
  TEST_ASSERT_FALSE(normalizeLegacyGy521(gy.as<JsonObject>()));
  TEST_ASSERT_EQUAL_STRING(R"({"type":"GY521","id":"g","channels":["ax"]})", dump(gy).c_str());

  JsonDocument bme = parse(R"({"type":"BME280","id":"b"})");
  TEST_ASSERT_FALSE(normalizeLegacyGy521(bme.as<JsonObject>()));
}

// ── renameRefs / renameLogRefs ──────────────────────────────────────────────

void test_rename_refs_exact_match_at_any_depth() {
  JsonDocument doc = parse(
      R"([{"name":"a","cond":{"ref":"sensor/gyro","op":"gt"}},)"
      R"({"steps":[{"cond":{"ref":"sensor/gyro2"}},{"cond":{"ref":"sensor/gyro.ax"}}]}])");
  TEST_ASSERT_TRUE(renameRefs(doc.as<JsonVariant>(), "sensor/gyro", "sensor/gyro.pitch"));
  TEST_ASSERT_EQUAL_STRING(
      R"([{"name":"a","cond":{"ref":"sensor/gyro.pitch","op":"gt"}},)"
      R"({"steps":[{"cond":{"ref":"sensor/gyro2"}},{"cond":{"ref":"sensor/gyro.ax"}}]}])",
      dump(doc).c_str());
  // Idempotent: nothing left to rename.
  TEST_ASSERT_FALSE(renameRefs(doc.as<JsonVariant>(), "sensor/gyro", "sensor/gyro.pitch"));
}

void test_rename_log_refs_starts_new_session_only_where_changed() {
  JsonDocument doc = parse(
      R"([{"id":"a","series":[{"ref":"sensor/gyro","tol":0}],"session":1700000000},)"
      R"({"id":"b","series":[{"ref":"sensor/HLT","tol":0}],"session":1700000001}])");
  TEST_ASSERT_TRUE(renameLogRefs(doc.as<JsonArray>(), "sensor/gyro", "sensor/gyro.pitch"));
  TEST_ASSERT_EQUAL_STRING("sensor/gyro.pitch", doc[0]["series"][0]["ref"] | "?");
  TEST_ASSERT_TRUE(doc[0]["session"].isNull());
  TEST_ASSERT_EQUAL(1700000001L, doc[1]["session"].as<long>());
}

void test_key_in_list_exact_match() {
  TEST_ASSERT_TRUE(keyInList("pitch,roll,tilt", "pitch"));
  TEST_ASSERT_TRUE(keyInList("pitch,roll,tilt", "roll"));
  TEST_ASSERT_TRUE(keyInList("pitch,roll,tilt", "tilt"));
  TEST_ASSERT_TRUE(keyInList("az", "az"));
  TEST_ASSERT_FALSE(keyInList("pitch,roll,tilt", "pit"));
  TEST_ASSERT_FALSE(keyInList("pitch,roll,tilt", "tilt2"));
  TEST_ASSERT_FALSE(keyInList("ax,ay", "a"));
  TEST_ASSERT_FALSE(keyInList("ax,ay", ""));
}

// ── resolveSensorChannel / sensorChannelRef ──────────────────────────────────

void test_resolve_channel_by_key() {
  FakeReg reg{{{"bme", {"temp", "hum", "press"}}, {"t1", {""}}}};
  size_t ch = 9;
  FakeSensor* s = resolveSensorChannel(reg, "bme.hum", ch);
  TEST_ASSERT_NOT_NULL(s);
  TEST_ASSERT_EQUAL(1u, ch);
  TEST_ASSERT_NULL(resolveSensorChannel(reg, "bme.nope", ch));
  TEST_ASSERT_NULL(resolveSensorChannel(reg, "x.temp", ch));
}

void test_resolve_bare_id_is_channel_zero() {
  FakeReg reg{{{"bme", {"temp", "hum"}}, {"t1", {""}}}};
  size_t ch = 9;
  TEST_ASSERT_NOT_NULL(resolveSensorChannel(reg, "bme", ch));
  TEST_ASSERT_EQUAL(0u, ch);
  TEST_ASSERT_NOT_NULL(resolveSensorChannel(reg, "t1", ch));
  TEST_ASSERT_EQUAL(0u, ch);
}

void test_resolve_exact_id_with_dot_wins() {
  FakeReg reg{{{"a.b", {""}}, {"a", {"b", "c"}}}};
  size_t ch = 9;
  FakeSensor* s = resolveSensorChannel(reg, "a.b", ch);
  TEST_ASSERT_EQUAL_STRING("a.b", s->sid);
  TEST_ASSERT_EQUAL(0u, ch);
  s = resolveSensorChannel(reg, "a.c", ch);
  TEST_ASSERT_EQUAL_STRING("a", s->sid);
  TEST_ASSERT_EQUAL(1u, ch);
}

void test_sensor_channel_ref_names_snapshot_id() {
  FakeSensor multi{"gyro", {"pitch", "roll"}};
  FakeSensor single{"t1", {""}};
  TEST_ASSERT_EQUAL_STRING("gyro.pitch", sensorChannelRef(multi, 0).c_str());
  TEST_ASSERT_EQUAL_STRING("gyro.roll", sensorChannelRef(multi, 1).c_str());
  TEST_ASSERT_EQUAL_STRING("t1", sensorChannelRef(single, 0).c_str());
}

void setUp() {}
void tearDown() {}

int main(int, char**) {
  UNITY_BEGIN();
  RUN_TEST(test_mask_absent_is_default);
  RUN_TEST(test_mask_selects_keys_by_position);
  RUN_TEST(test_mask_rejects_unknown_empty_and_non_array);
  RUN_TEST(test_mask_eleven_gy521_keys);
  RUN_TEST(test_legacy_gy521_gets_pitch_channel);
  RUN_TEST(test_legacy_gy521_calibration_moves_to_pitch);
  RUN_TEST(test_migrated_gy521_and_other_types_untouched);
  RUN_TEST(test_rename_refs_exact_match_at_any_depth);
  RUN_TEST(test_rename_log_refs_starts_new_session_only_where_changed);
  RUN_TEST(test_key_in_list_exact_match);
  RUN_TEST(test_resolve_channel_by_key);
  RUN_TEST(test_resolve_bare_id_is_channel_zero);
  RUN_TEST(test_resolve_exact_id_with_dot_wins);
  RUN_TEST(test_sensor_channel_ref_names_snapshot_id);
  return UNITY_END();
}
