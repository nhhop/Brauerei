#include <unity.h>

#include <string>
#include <vector>

#include "ProgramTargets.h"

using BrewControl::TargetCmd;
using BrewControl::effectiveTargets;
using BrewControl::readTargets;
using BrewControl::writeTargets;

namespace {

// Parses one step object and reads its targets.
bool read(const char* json, std::vector<TargetCmd>& out, const char* legacy = "") {
  JsonDocument doc;
  TEST_ASSERT_TRUE(deserializeJson(doc, json) == DeserializationError::Ok);
  return readTargets(doc.as<JsonObjectConst>(), legacy, out);
}

std::vector<TargetCmd> read(const char* json, const char* legacy = "") {
  std::vector<TargetCmd> out;
  TEST_ASSERT_TRUE(read(json, out, legacy));
  return out;
}

// Minimal stand-in for ProgramStep — effectiveTargets only needs `targets`.
struct Step {
  std::vector<TargetCmd> targets;
};

Step step(const char* json) { return Step{read(json)}; }

const TargetCmd* find(const std::vector<TargetCmd>& v, const char* id) {
  for (const auto& c : v)
    if (c.id == id) return &c;
  return nullptr;
}

bool noImpulse(const std::string&) { return false; }

}  // namespace

// ── readTargets ─────────────────────────────────────────────────────────────

void test_reads_all_fields_in_document_order() {
  auto t = read(R"({"targets":{
      "ruehrer":{"enabled":true,"v":30,"interval":{"onSec":30,"periodSec":60}},
      "gaer_temp":{"v":10}}})");
  TEST_ASSERT_EQUAL_size_t(2, t.size());
  TEST_ASSERT_EQUAL_STRING("ruehrer", t[0].id.c_str());
  TEST_ASSERT_TRUE(t[0].hasEnabled && t[0].enabled);
  TEST_ASSERT_TRUE(t[0].hasV);
  TEST_ASSERT_FLOAT_WITHIN(0.001f, 30.0f, t[0].v);
  TEST_ASSERT_TRUE(t[0].hasInterval);
  TEST_ASSERT_EQUAL_UINT32(30, t[0].onSec);
  TEST_ASSERT_EQUAL_UINT32(60, t[0].periodSec);
  TEST_ASSERT_EQUAL_STRING("gaer_temp", t[1].id.c_str());
  TEST_ASSERT_TRUE(t[1].hasV);
  TEST_ASSERT_FALSE(t[1].hasEnabled);
  TEST_ASSERT_FALSE(t[1].hasInterval);
}

void test_single_field_commands() {
  auto t = read(R"({"targets":{"a":{"enabled":false},"b":{"interval":{"onSec":60,"periodSec":60}}}})");
  TEST_ASSERT_EQUAL_size_t(2, t.size());
  TEST_ASSERT_TRUE(t[0].hasEnabled);
  TEST_ASSERT_FALSE(t[0].enabled);
  TEST_ASSERT_FALSE(t[0].hasV);
  TEST_ASSERT_TRUE(t[1].hasInterval);
  TEST_ASSERT_FALSE(t[1].hasEnabled);
}

void test_empty_and_missing_targets_are_valid() {
  TEST_ASSERT_EQUAL_size_t(0, read(R"({"targets":{}})").size());
  TEST_ASSERT_EQUAL_size_t(0, read(R"({"holdSec":60})").size());
}

void test_non_finite_v_and_empty_commands_are_dropped() {
  // 1e999 overflows to inf when parsed; "x" is not a number; {} and a bare
  // number carry no usable field.
  auto t = read(R"({"targets":{"a":{"v":1e999},"b":{"v":"x"},"c":{},"d":5,"e":{"v":1}}})");
  TEST_ASSERT_EQUAL_size_t(1, t.size());
  TEST_ASSERT_EQUAL_STRING("e", t[0].id.c_str());
}

void test_invalid_interval_rejects() {
  std::vector<TargetCmd> out;
  TEST_ASSERT_FALSE(read(R"({"targets":{"a":{"interval":{"onSec":10,"periodSec":0}}}})", out));
  TEST_ASSERT_FALSE(read(R"({"targets":{"a":{"interval":{"onSec":70,"periodSec":60}}}})", out));
  TEST_ASSERT_TRUE(read(R"({"targets":{"a":{"interval":{"onSec":60,"periodSec":60}}}})", out));
}

void test_legacy_setpoint_with_controller() {
  auto t = read(R"({"setpoint":52,"holdSec":1200})", "maische_pid");
  TEST_ASSERT_EQUAL_size_t(1, t.size());
  TEST_ASSERT_EQUAL_STRING("maische_pid", t[0].id.c_str());
  TEST_ASSERT_TRUE(t[0].hasV);
  TEST_ASSERT_FLOAT_WITHIN(0.001f, 52.0f, t[0].v);
  TEST_ASSERT_TRUE(t[0].hasEnabled && t[0].enabled);  // old runner always enabled
  TEST_ASSERT_FALSE(t[0].hasInterval);
}

void test_legacy_profile_gets_unbound_entry() {
  auto t = read(R"({"setpoint":63})", "");
  TEST_ASSERT_EQUAL_size_t(1, t.size());
  TEST_ASSERT_EQUAL_STRING("", t[0].id.c_str());
}

void test_targets_win_over_legacy_setpoint() {
  auto t = read(R"({"setpoint":52,"targets":{"x":{"v":1}}})", "maische_pid");
  TEST_ASSERT_EQUAL_size_t(1, t.size());
  TEST_ASSERT_EQUAL_STRING("x", t[0].id.c_str());
}

// ── writeTargets ────────────────────────────────────────────────────────────

void test_write_round_trip_keeps_only_set_fields() {
  auto in = read(R"({"targets":{"ruehrer":{"interval":{"onSec":30,"periodSec":60}},"gaer_temp":{"enabled":true,"v":10},"":{"v":1}}})");
  JsonDocument doc;
  writeTargets(doc.to<JsonObject>(), in);
  std::string json;
  serializeJson(doc, json);
  TEST_ASSERT_EQUAL_STRING(
      R"({"targets":{"ruehrer":{"interval":{"onSec":30,"periodSec":60}},"gaer_temp":{"enabled":true,"v":10},"":{"v":1}}})",
      json.c_str());
}

void test_write_empty_step_emits_empty_object() {
  JsonDocument doc;
  writeTargets(doc.to<JsonObject>(), {});
  std::string json;
  serializeJson(doc, json);
  TEST_ASSERT_EQUAL_STRING(R"({"targets":{}})", json.c_str());
}

// ── effectiveTargets ─────────────────────────────────────────────────────────

void test_state_last_value_wins_per_field() {
  std::vector<Step> steps = {
      step(R"({"targets":{"ruehrer":{"enabled":true,"v":30,"interval":{"onSec":30,"periodSec":60}},"temp":{"enabled":true,"v":10}}})"),
      step(R"({"targets":{"ruehrer":{"interval":{"onSec":60,"periodSec":60}}}})"),
      step(R"({"targets":{"temp":{"v":16},"ruehrer":{"enabled":false}}})"),
  };
  auto s1 = effectiveTargets(steps, 1, noImpulse);
  const TargetCmd* r = find(s1, "ruehrer");
  TEST_ASSERT_NOT_NULL(r);
  TEST_ASSERT_TRUE(r->enabled);                        // from step 0
  TEST_ASSERT_FLOAT_WITHIN(0.001f, 30.0f, r->v);       // from step 0
  TEST_ASSERT_EQUAL_UINT32(60, r->onSec);              // step 1 overrides
  const TargetCmd* t = find(s1, "temp");
  TEST_ASSERT_FLOAT_WITHIN(0.001f, 10.0f, t->v);       // step 2 not reached yet

  auto s2 = effectiveTargets(steps, 2, noImpulse);
  TEST_ASSERT_FLOAT_WITHIN(0.001f, 16.0f, find(s2, "temp")->v);
  TEST_ASSERT_TRUE(find(s2, "temp")->enabled);          // still from step 0
  TEST_ASSERT_FALSE(find(s2, "ruehrer")->enabled);
  TEST_ASSERT_FLOAT_WITHIN(0.001f, 30.0f, find(s2, "ruehrer")->v);
}

void test_state_keeps_first_appearance_order() {
  std::vector<Step> steps = {
      step(R"({"targets":{"b":{"v":1}}})"),
      step(R"({"targets":{"a":{"v":1},"b":{"v":2}}})"),
  };
  auto s = effectiveTargets(steps, 1, noImpulse);
  TEST_ASSERT_EQUAL_size_t(2, s.size());
  TEST_ASSERT_EQUAL_STRING("b", s[0].id.c_str());
  TEST_ASSERT_EQUAL_STRING("a", s[1].id.c_str());
}

void test_state_excludes_impulse_v_but_keeps_its_enabled() {
  std::vector<Step> steps = {
      step(R"({"targets":{"dropper":{"enabled":true},"temp":{"v":10}}})"),
      step(R"({"targets":{"dropper":{"v":1}}})"),
      step(R"({"targets":{"pump":{"v":2}}})"),
  };
  auto isImpulse = [](const std::string& id) { return id == "dropper" || id == "pump"; };
  auto s = effectiveTargets(steps, 2, isImpulse);
  const TargetCmd* d = find(s, "dropper");
  TEST_ASSERT_NOT_NULL(d);
  TEST_ASSERT_TRUE(d->hasEnabled);
  TEST_ASSERT_FALSE(d->hasV);
  // pump only ever carried an impulse v — nothing left to re-apply.
  TEST_ASSERT_NULL(find(s, "pump"));
  TEST_ASSERT_NOT_NULL(find(s, "temp"));
}

void test_state_out_of_range_k() {
  std::vector<Step> steps = {step(R"({"targets":{"a":{"v":1}}})")};
  TEST_ASSERT_EQUAL_size_t(0, effectiveTargets(steps, -1, noImpulse).size());
  TEST_ASSERT_EQUAL_size_t(1, effectiveTargets(steps, 5, noImpulse).size());
}

// ── Runner ───────────────────────────────────────────────────────────────────

void setUp(void) {}
void tearDown(void) {}

int main(int, char**) {
  UNITY_BEGIN();
  RUN_TEST(test_reads_all_fields_in_document_order);
  RUN_TEST(test_single_field_commands);
  RUN_TEST(test_empty_and_missing_targets_are_valid);
  RUN_TEST(test_non_finite_v_and_empty_commands_are_dropped);
  RUN_TEST(test_invalid_interval_rejects);
  RUN_TEST(test_legacy_setpoint_with_controller);
  RUN_TEST(test_legacy_profile_gets_unbound_entry);
  RUN_TEST(test_targets_win_over_legacy_setpoint);
  RUN_TEST(test_write_round_trip_keeps_only_set_fields);
  RUN_TEST(test_write_empty_step_emits_empty_object);
  RUN_TEST(test_state_last_value_wins_per_field);
  RUN_TEST(test_state_keeps_first_appearance_order);
  RUN_TEST(test_state_excludes_impulse_v_but_keeps_its_enabled);
  RUN_TEST(test_state_out_of_range_k);
  return UNITY_END();
}
