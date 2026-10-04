#include <unity.h>

#include <string>

#include "ReleaseFilter.h"

using namespace BrewControl;

void setUp() {}
void tearDown() {}

static const char* kRelease =
    "{\"tag_name\":\"v0.2.1-rc.1\",\"prerelease\":true,\"body\":\"notes\",\"id\":1,"
    "\"assets\":[{\"name\":\"webui.tar\",\"browser_download_url\":\"u1\",\"size\":5},"
    "{\"name\":\"webui-full.tar\",\"browser_download_url\":\"u2\",\"size\":6}]}";

// Regression: the preview channel got an empty document (object filter against
// an array) and so always reported "check failed".
void test_list_keeps_every_release_with_the_needed_fields() {
  std::string json = std::string("[") + kRelease + ",{\"tag_name\":\"v0.2.0\",\"prerelease\":false}]";
  JsonDocument filter;
  makeReleaseFilter(filter, true);
  JsonDocument doc;
  TEST_ASSERT_TRUE(deserializeJson(doc, json, DeserializationOption::Filter(filter)) == DeserializationError::Ok);

  JsonArray list = doc.as<JsonArray>();
  TEST_ASSERT_EQUAL(2, list.size());
  TEST_ASSERT_EQUAL_STRING("v0.2.1-rc.1", list[0]["tag_name"] | "");
  TEST_ASSERT_TRUE(list[0]["prerelease"].as<bool>());
  TEST_ASSERT_EQUAL_STRING("notes", list[0]["body"] | "");
  TEST_ASSERT_EQUAL(2, list[0]["assets"].as<JsonArray>().size());
  TEST_ASSERT_EQUAL_STRING("webui-full.tar", list[0]["assets"][1]["name"] | "");
  TEST_ASSERT_EQUAL_STRING("u2", list[0]["assets"][1]["browser_download_url"] | "");
  TEST_ASSERT_TRUE(list[0]["id"].isNull());  // unneeded fields stay out
  TEST_ASSERT_FALSE(list[1]["prerelease"].as<bool>());
}

void test_single_release_for_the_stable_channel() {
  JsonDocument filter;
  makeReleaseFilter(filter, false);
  JsonDocument doc;
  TEST_ASSERT_TRUE(deserializeJson(doc, kRelease, DeserializationOption::Filter(filter)) == DeserializationError::Ok);

  TEST_ASSERT_EQUAL_STRING("v0.2.1-rc.1", doc["tag_name"] | "");
  TEST_ASSERT_EQUAL(2, doc["assets"].as<JsonArray>().size());
  TEST_ASSERT_EQUAL_STRING("webui.tar", doc["assets"][0]["name"] | "");
  TEST_ASSERT_TRUE(doc["id"].isNull());
}

int main(int, char**) {
  UNITY_BEGIN();
  RUN_TEST(test_list_keeps_every_release_with_the_needed_fields);
  RUN_TEST(test_single_release_for_the_stable_channel);
  return UNITY_END();
}
