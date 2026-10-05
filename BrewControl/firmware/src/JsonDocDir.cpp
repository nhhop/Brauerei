#include "JsonDocDir.h"

#include <Arduino.h>

#include <vector>

#include "JsonDocFiles.h"
#include "SdLock.h"
#include "SdText.h"

namespace BrewControl {
namespace JsonDocDir {
namespace {

std::string pathOf(const char* dir, const char* id) { return std::string(dir) + "/" + id + ".json"; }

}  // namespace

std::string list(fs::FS& fs, const char* dir) {
  std::vector<std::string> docs;
  SdLock lock;
  File d = fs.open(dir);
  if (d && d.isDirectory()) {
    // Read from the entry itself: opening each file again costs another ~30 ms.
    for (File e = d.openNextFile(); e; e = d.openNextFile()) {
      if (!e.isDirectory() && !jsonDocIdOf(e.name()).empty()) {
        docs.emplace_back();
        readOpenFile(e, docs.back());
      }
      e.close();
    }
  }
  if (d) d.close();
  return joinJsonArray(docs);
}

bool write(fs::FS& fs, const char* dir, const char* id, const std::string& json) {
  return isValidRecipeId(id) && writeText(fs, dir, pathOf(dir, id), json);
}

bool remove(fs::FS& fs, const char* dir, const char* id) {
  if (!isValidRecipeId(id)) return false;
  SdLock lock;
  return fs.remove(pathOf(dir, id).c_str());
}

}  // namespace JsonDocDir
}  // namespace BrewControl
