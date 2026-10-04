#include <unity.h>

#include <string>

#include "RecipeFiles.h"

using namespace BrewControl;

void setUp() {}
void tearDown() {}

void test_ids_the_web_ui_generates_are_valid() {
  TEST_ASSERT_TRUE(isValidRecipeId("mgx4k2a1b2c3d4"));
  TEST_ASSERT_TRUE(isValidRecipeId("Pale-Ale_2"));
  TEST_ASSERT_TRUE(isValidRecipeId(std::string(32, 'a').c_str()));
}

// The id ends up in a file path.
void test_ids_that_could_form_a_path_are_rejected() {
  TEST_ASSERT_FALSE(isValidRecipeId(""));
  TEST_ASSERT_FALSE(isValidRecipeId(".."));
  TEST_ASSERT_FALSE(isValidRecipeId("../config/settings"));
  TEST_ASSERT_FALSE(isValidRecipeId("a/b"));
  TEST_ASSERT_FALSE(isValidRecipeId("a.json"));
  TEST_ASSERT_FALSE(isValidRecipeId("a b"));
  TEST_ASSERT_FALSE(isValidRecipeId(std::string(33, 'a').c_str()));
}

void test_body_must_carry_the_id_of_the_url() {
  JsonDocument doc;
  deserializeJson(doc, "{\"id\":\"abc\",\"name\":\"Pils\"}");
  TEST_ASSERT_TRUE(recipeBodyMatchesId(doc, "abc"));
  TEST_ASSERT_FALSE(recipeBodyMatchesId(doc, "abd"));

  JsonDocument noId;
  deserializeJson(noId, "{\"name\":\"Pils\"}");
  TEST_ASSERT_FALSE(recipeBodyMatchesId(noId, "abc"));

  JsonDocument numeric;
  deserializeJson(numeric, "{\"id\":1}");
  TEST_ASSERT_FALSE(recipeBodyMatchesId(numeric, "1"));
}

void test_summary_line_keeps_only_the_list_fields_and_starts_with_the_id() {
  JsonDocument doc;
  const char* recipe =
      "{\"id\":\"abc\",\"name\":\"Pils\\nmit Umbruch\",\"description\":\"long text\",\"style\":\"Pilsner\","
      "\"volumeL\":20,\"status\":\"draft\",\"updatedAt\":1700000000000,"
      "\"ingredients\":[{\"id\":\"i1\",\"name\":\"Pilsner Malz\",\"amount\":4.5}],"
      "\"mash\":[{\"tempC\":65}]}";
  TEST_ASSERT_TRUE(deserializeJson(doc, recipe) == DeserializationError::Ok);

  const std::string line = recipeSummaryLine(doc, "abc");
  TEST_ASSERT_EQUAL(0, line.rfind("{\"id\":\"abc\"", 0));
  TEST_ASSERT_TRUE(line.find('\n') == std::string::npos);  // the escaped \n stays escaped

  JsonDocument back;
  TEST_ASSERT_TRUE(deserializeJson(back, line) == DeserializationError::Ok);
  TEST_ASSERT_EQUAL_STRING("Pils\nmit Umbruch", back["name"] | "");
  TEST_ASSERT_EQUAL_STRING("Pilsner", back["style"] | "");
  TEST_ASSERT_EQUAL(20, back["volumeL"].as<int>());
  TEST_ASSERT_EQUAL_STRING("draft", back["status"] | "");
  TEST_ASSERT_EQUAL(1700000000000LL, back["updatedAt"].as<long long>());
  TEST_ASSERT_TRUE(back["ingredients"].isNull());
  TEST_ASSERT_TRUE(back["description"].isNull());
}

void test_summary_line_leaves_out_fields_the_recipe_lacks() {
  JsonDocument doc;
  deserializeJson(doc, "{\"id\":\"abc\",\"name\":\"Pils\"}");
  TEST_ASSERT_EQUAL_STRING("{\"id\":\"abc\",\"name\":\"Pils\"}", recipeSummaryLine(doc, "abc").c_str());
}

void test_index_line_is_matched_by_the_whole_id() {
  TEST_ASSERT_TRUE(recipeLineHasId("{\"id\":\"abc\",\"name\":\"x\"}", "abc"));
  TEST_ASSERT_TRUE(recipeLineHasId("{\"id\":\"abc\"}", "abc"));
  TEST_ASSERT_FALSE(recipeLineHasId("{\"id\":\"abcd\",\"name\":\"x\"}", "abc"));
  TEST_ASSERT_FALSE(recipeLineHasId("{\"id\":\"ab\"}", "abc"));
  TEST_ASSERT_FALSE(recipeLineHasId("{\"name\":\"x\",\"id\":\"abc\"}", "abc"));
}

void test_splice_adds_replaces_and_removes_one_line() {
  const std::string a = "{\"id\":\"a\",\"name\":\"A\"}";
  const std::string b = "{\"id\":\"b\",\"name\":\"B\"}";
  const std::string a2 = "{\"id\":\"a\",\"name\":\"A2\"}";

  std::string index = spliceRecipeIndex("", "a", &a);
  TEST_ASSERT_EQUAL_STRING((a + "\n").c_str(), index.c_str());

  index = spliceRecipeIndex(index, "b", &b);
  TEST_ASSERT_EQUAL_STRING((a + "\n" + b + "\n").c_str(), index.c_str());

  index = spliceRecipeIndex(index, "a", &a2);  // replaced, not duplicated
  TEST_ASSERT_EQUAL_STRING((b + "\n" + a2 + "\n").c_str(), index.c_str());

  index = spliceRecipeIndex(index, "b", nullptr);
  TEST_ASSERT_EQUAL_STRING((a2 + "\n").c_str(), index.c_str());

  // Removing an id that is not there changes nothing; callers skip the write.
  TEST_ASSERT_EQUAL_STRING(index.c_str(), spliceRecipeIndex(index, "zzz", nullptr).c_str());
}

void test_splice_drops_blank_lines_and_copes_with_a_missing_final_newline() {
  const std::string out = spliceRecipeIndex("{\"id\":\"a\"}\n\n{\"id\":\"b\"}", "x", nullptr);
  TEST_ASSERT_EQUAL_STRING("{\"id\":\"a\"}\n{\"id\":\"b\"}\n", out.c_str());
}

void test_index_becomes_a_json_array() {
  TEST_ASSERT_EQUAL_STRING("[]", recipeIndexToJsonArray("").c_str());
  TEST_ASSERT_EQUAL_STRING("[{\"id\":\"a\"}]", recipeIndexToJsonArray("{\"id\":\"a\"}\n").c_str());
  TEST_ASSERT_EQUAL_STRING("[{\"id\":\"a\"},{\"id\":\"b\"}]",
                           recipeIndexToJsonArray("{\"id\":\"a\"}\n\n{\"id\":\"b\"}").c_str());

  JsonDocument doc;
  TEST_ASSERT_TRUE(deserializeJson(doc, recipeIndexToJsonArray("{\"id\":\"a\"}\n{\"id\":\"b\"}\n")) ==
                   DeserializationError::Ok);
  TEST_ASSERT_EQUAL(2, doc.as<JsonArray>().size());
}

int main(int, char**) {
  UNITY_BEGIN();
  RUN_TEST(test_ids_the_web_ui_generates_are_valid);
  RUN_TEST(test_ids_that_could_form_a_path_are_rejected);
  RUN_TEST(test_body_must_carry_the_id_of_the_url);
  RUN_TEST(test_summary_line_keeps_only_the_list_fields_and_starts_with_the_id);
  RUN_TEST(test_summary_line_leaves_out_fields_the_recipe_lacks);
  RUN_TEST(test_index_line_is_matched_by_the_whole_id);
  RUN_TEST(test_splice_adds_replaces_and_removes_one_line);
  RUN_TEST(test_splice_drops_blank_lines_and_copes_with_a_missing_final_newline);
  RUN_TEST(test_index_becomes_a_json_array);
  return UNITY_END();
}
