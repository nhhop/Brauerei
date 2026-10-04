#pragma once

#include <ArduinoJson.h>
#include <string.h>

#include <string>

namespace BrewControl {

// A recipe id becomes a file name (/recipes/<id>.json), so it is limited to
// characters that cannot form a path. The web UI's ids (base36) fit easily.
inline bool isValidRecipeId(const char* id) {
  const size_t n = strlen(id);
  if (n == 0 || n > 32) return false;
  for (size_t i = 0; i < n; ++i) {
    const char c = id[i];
    const bool ok = (c >= '0' && c <= '9') || (c >= 'a' && c <= 'z') ||
                    (c >= 'A' && c <= 'Z') || c == '-' || c == '_';
    if (!ok) return false;
  }
  return true;
}

// The file name is the identity: a body whose "id" differs from the URL's would
// be stored under one id and listed under another.
inline bool recipeBodyMatchesId(JsonVariantConst body, const char* id) {
  return strcmp(body["id"] | "", id) == 0;
}

// ── The list index ────────────────────────────────────────────────────────────
// Listing by opening every recipe costs ~60 ms each on the SD card (measured on
// the LilyGo), which stalls the AsyncTCP task: 42 recipes took 2.7 s, and its
// watchdog fires at 5 s. So /recipes/index.jsonl keeps one summary per line, the
// fields the recipe list shows, and listing reads that single file.

// One index line: the id first (recipeLineHasId relies on it), then whichever of
// the list fields the recipe has. Compact JSON, so it never contains a newline.
inline std::string recipeSummaryLine(JsonVariantConst recipe, const char* id) {
  JsonDocument summary;
  summary["id"] = id;
  for (const char* key : {"name", "style", "volumeL", "status", "updatedAt"}) {
    if (!recipe[key].isNull()) summary[key] = recipe[key];
  }
  std::string line;
  serializeJson(summary, line);
  return line;
}

inline bool recipeLineHasId(const std::string& line, const char* id) {
  return line.rfind(std::string("{\"id\":\"") + id + "\"", 0) == 0;
}

// The index without the lines of `id`, then `line` appended when given.
inline std::string spliceRecipeIndex(const std::string& index, const char* id,
                                     const std::string* line) {
  std::string out;
  size_t pos = 0;
  while (pos < index.size()) {
    size_t end = index.find('\n', pos);
    if (end == std::string::npos) end = index.size();
    const std::string cur = index.substr(pos, end - pos);
    if (!cur.empty() && !recipeLineHasId(cur, id)) out += cur + '\n';
    pos = end + 1;
  }
  if (line) out += *line + '\n';
  return out;
}

// The index as the JSON array GET /api/recipes returns.
inline std::string recipeIndexToJsonArray(const std::string& index) {
  std::string out = "[";
  size_t pos = 0;
  while (pos < index.size()) {
    size_t end = index.find('\n', pos);
    if (end == std::string::npos) end = index.size();
    if (end > pos) {
      if (out.size() > 1) out += ',';
      out.append(index, pos, end - pos);
    }
    pos = end + 1;
  }
  return out + "]";
}

}  // namespace BrewControl
