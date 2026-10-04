#pragma once

#include <string>
#include <vector>

#include "RecipeFiles.h"

namespace BrewControl {

// Pure helpers for JsonDocDir: a directory holding one <id>.json per document.

// The id a directory entry stands for, "" if the entry is not a document: a
// temp file left by an interrupted write, or any other name. `name` may be the
// base name or the full path, depending on the core.
inline std::string jsonDocIdOf(const std::string& name) {
  const size_t slash = name.rfind('/');
  const std::string base = slash == std::string::npos ? name : name.substr(slash + 1);
  static const std::string kExt = ".json";
  if (base.size() <= kExt.size() || base.compare(base.size() - kExt.size(), kExt.size(), kExt) != 0) {
    return "";
  }
  const std::string id = base.substr(0, base.size() - kExt.size());
  return isValidRecipeId(id.c_str()) ? id : "";
}

// The documents as one JSON array; each is stored JSON already, so no parsing.
inline std::string joinJsonArray(const std::vector<std::string>& docs) {
  std::string out = "[";
  for (const std::string& doc : docs) {
    if (doc.empty()) continue;
    if (out.size() > 1) out += ',';
    out += doc;
  }
  return out + "]";
}

}  // namespace BrewControl
