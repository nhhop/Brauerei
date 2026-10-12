#include "RecipeStore.h"

#include <Arduino.h>

#include "RecipeFiles.h"
#include "SdLock.h"
#include "SdText.h"

namespace BrewControl {
namespace RecipeStore {
namespace {

std::string pathOf(const char* dir, const char* id) { return std::string(dir) + "/" + id + ".json"; }
std::string indexOf(const char* dir) { return std::string(dir) + "/index.jsonl"; }

// Drops the id's line from the index and appends `line` if given. A missing
// index counts as empty; nothing is written when nothing changes.
bool updateIndex(fs::FS& fs, const char* dir, const char* id, const std::string* line) {
  SdLock lock;  // read-modify-write
  std::string index;
  readText(fs, indexOf(dir), index);
  const std::string next = spliceRecipeIndex(index, id, line);
  return next == index || writeText(fs, dir, indexOf(dir), next);
}

}  // namespace

std::string list(fs::FS& fs, const char* dir) {
  std::string index;
  readText(fs, indexOf(dir), index);
  return recipeIndexToJsonArray(index);
}

bool read(fs::FS& fs, const char* id, std::string& out, const char* dir) {
  return isValidRecipeId(id) && readText(fs, pathOf(dir, id), out);
}

bool write(fs::FS& fs, const char* id, const std::string& json, const std::string& summary,
           const char* dir) {
  if (!isValidRecipeId(id)) return false;
  // Recipe first: a cut in between leaves a recipe that is merely not listed.
  return writeText(fs, dir, pathOf(dir, id), json) && updateIndex(fs, dir, id, &summary);
}

bool remove(fs::FS& fs, const char* id, const char* dir) {
  if (!isValidRecipeId(id)) return false;
  bool existed;
  {
    SdLock lock;
    existed = fs.remove(pathOf(dir, id).c_str());
  }
  updateIndex(fs, dir, id, nullptr);
  return existed;
}

}  // namespace RecipeStore
}  // namespace BrewControl
