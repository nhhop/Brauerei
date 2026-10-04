#include <unity.h>

#include <string>
#include <vector>

#include "JsonDocFiles.h"

using namespace BrewControl;

void setUp() {}
void tearDown() {}

void test_document_file_names_give_their_id() {
  TEST_ASSERT_EQUAL_STRING("mgx4k2a1", jsonDocIdOf("mgx4k2a1.json").c_str());
  TEST_ASSERT_EQUAL_STRING("Sud-haus_2", jsonDocIdOf("Sud-haus_2.json").c_str());
}

// Depending on the core, File::name() is the base name or the full path.
void test_full_paths_give_the_id_of_the_base_name() {
  TEST_ASSERT_EQUAL_STRING("abc", jsonDocIdOf("/brewhouses/abc.json").c_str());
}

// A power cut mid-write leaves <id>.json.tmp behind; it must not be listed.
void test_temp_files_are_skipped() {
  TEST_ASSERT_EQUAL_STRING("", jsonDocIdOf("abc.json.tmp").c_str());
}

void test_foreign_names_are_skipped() {
  TEST_ASSERT_EQUAL_STRING("", jsonDocIdOf(".json").c_str());
  TEST_ASSERT_EQUAL_STRING("", jsonDocIdOf("abc.JSON").c_str());
  TEST_ASSERT_EQUAL_STRING("", jsonDocIdOf("abc.txt").c_str());
  TEST_ASSERT_EQUAL_STRING("", jsonDocIdOf("index.jsonl").c_str());
  TEST_ASSERT_EQUAL_STRING("", jsonDocIdOf("a b.json").c_str());
  TEST_ASSERT_EQUAL_STRING("", jsonDocIdOf("a.b.json").c_str());
  TEST_ASSERT_EQUAL_STRING("", jsonDocIdOf((std::string(33, 'a') + ".json")).c_str());
  TEST_ASSERT_EQUAL_STRING("", jsonDocIdOf("").c_str());
}

void test_join_builds_an_array() {
  TEST_ASSERT_EQUAL_STRING("[]", joinJsonArray({}).c_str());
  TEST_ASSERT_EQUAL_STRING("[{\"id\":\"a\"}]", joinJsonArray({"{\"id\":\"a\"}"}).c_str());
  TEST_ASSERT_EQUAL_STRING("[{\"id\":\"a\"},{\"id\":\"b\"}]",
                           joinJsonArray({"{\"id\":\"a\"}", "{\"id\":\"b\"}"}).c_str());
}

// An empty file would otherwise produce "[,…]".
void test_join_skips_empty_documents() {
  TEST_ASSERT_EQUAL_STRING("[{\"id\":\"b\"}]", joinJsonArray({"", "{\"id\":\"b\"}", ""}).c_str());
}

void test_joined_array_parses() {
  const std::string arr = joinJsonArray({"{\"id\":\"a\",\"name\":\"Sudhaus\"}", "{\"id\":\"b\"}"});
  JsonDocument doc;
  TEST_ASSERT_TRUE(deserializeJson(doc, arr) == DeserializationError::Ok);
  TEST_ASSERT_EQUAL(2, doc.as<JsonArrayConst>().size());
  TEST_ASSERT_EQUAL_STRING("Sudhaus", doc[0]["name"] | "");
}

int main(int, char**) {
  UNITY_BEGIN();
  RUN_TEST(test_document_file_names_give_their_id);
  RUN_TEST(test_full_paths_give_the_id_of_the_base_name);
  RUN_TEST(test_temp_files_are_skipped);
  RUN_TEST(test_foreign_names_are_skipped);
  RUN_TEST(test_join_builds_an_array);
  RUN_TEST(test_join_skips_empty_documents);
  RUN_TEST(test_joined_array_parses);
  return UNITY_END();
}
