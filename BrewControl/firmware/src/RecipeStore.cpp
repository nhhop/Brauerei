#include "RecipeStore.h"

#include <Arduino.h>

#include "RecipeFiles.h"
#include "SdLock.h"

namespace BrewControl {
namespace RecipeStore {
namespace {

constexpr const char* kDir = "/recipes";
constexpr const char* kIndex = "/recipes/index.jsonl";

std::string pathOf(const char* id) { return std::string(kDir) + "/" + id + ".json"; }

// Not readString(): it reads byte by byte, ~150 ms for a 5 KB recipe on the LilyGo.
bool readText(fs::FS& fs, const std::string& path, std::string& out) {
  SdLock lock;
  File f = fs.open(path.c_str());
  if (!f) return false;
  const bool isFile = !f.isDirectory();
  if (isFile) {
    out.clear();
    out.reserve(f.size());
    uint8_t chunk[512];
    for (int n = f.read(chunk, sizeof(chunk)); n > 0; n = f.read(chunk, sizeof(chunk))) {
      out.append(reinterpret_cast<const char*>(chunk), n);
    }
  }
  f.close();
  return isFile;
}

// Via a temp file, so a power cut mid-write leaves the previous content.
bool writeText(fs::FS& fs, const std::string& path, const std::string& text) {
  const std::string tmp = path + ".tmp";
  SdLock lock;
  fs.mkdir(kDir);
  File f = fs.open(tmp.c_str(), FILE_WRITE);
  if (!f) return false;
  const size_t n = f.write(reinterpret_cast<const uint8_t*>(text.data()), text.size());
  f.close();
  if (n != text.size()) { fs.remove(tmp.c_str()); return false; }
  fs.remove(path.c_str());  // rename does not overwrite on FAT
  return fs.rename(tmp.c_str(), path.c_str());
}

// Drops the id's line from the index and appends `line` if given. A missing
// index counts as empty; nothing is written when nothing changes.
bool updateIndex(fs::FS& fs, const char* id, const std::string* line) {
  SdLock lock;  // read-modify-write
  std::string index;
  readText(fs, kIndex, index);
  const std::string next = spliceRecipeIndex(index, id, line);
  return next == index || writeText(fs, kIndex, next);
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
  return writeText(fs, pathOf(id), json) && updateIndex(fs, id, &summary);
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
