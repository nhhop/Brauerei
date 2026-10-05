#include "RecipeStore.h"

#include <Arduino.h>

#include "RecipeFiles.h"
#include "SdLock.h"
#include "SdText.h"

namespace BrewControl {
namespace RecipeStore {
namespace {

constexpr const char* kDir = "/recipes";
constexpr const char* kIndex = "/recipes/index.jsonl";

std::string pathOf(const char* id) { return std::string(kDir) + "/" + id + ".json"; }

// Drops the id's line from the index and appends `line` if given. A missing
// index counts as empty; nothing is written when nothing changes.
bool updateIndex(fs::FS& fs, const char* id, const std::string* line) {
  SdLock lock;  // read-modify-write
  std::string index;
  readText(fs, kIndex, index);
  const std::string next = spliceRecipeIndex(index, id, line);
  return next == index || writeText(fs, kDir, kIndex, next);
}

}  // namespace

std::string list(fs::FS& fs) {
  std::string index;
  readText(fs, kIndex, index);
  return recipeIndexToJsonArray(index);
}

bool read(fs::FS& fs, const char* id, std::string& out) {
  return isValidRecipeId(id) && readText(fs, pathOf(id), out);
}

bool write(fs::FS& fs, const char* id, const std::string& json, const std::string& summary) {
  if (!isValidRecipeId(id)) return false;
  // Recipe first: a cut in between leaves a recipe that is merely not listed.
  return writeText(fs, kDir, pathOf(id), json) && updateIndex(fs, id, &summary);
}

bool remove(fs::FS& fs, const char* id) {
  if (!isValidRecipeId(id)) return false;
  bool existed;
  {
    SdLock lock;
    existed = fs.remove(pathOf(id).c_str());
  }
  updateIndex(fs, id, nullptr);
  return existed;
}

}  // namespace RecipeStore
}  // namespace BrewControl
