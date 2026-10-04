#pragma once

#include <FS.h>

#include <string>

namespace BrewControl {

// Recipes live as one file each, /recipes/<id>.json, holding the JSON the web UI
// sent (the firmware does not interpret it beyond the id). One file per recipe
// keeps a save to a single small write and nothing in RAM between requests.
// /recipes/index.jsonl holds the list summaries (see RecipeFiles.h); the recipe
// files stay the truth, but a file put on the card by hand is not listed until
// it is saved through the API. Every call takes SdLock itself; ids must pass
// isValidRecipeId.
namespace RecipeStore {

// JSON array with one summary per recipe (id and the list fields). "[]" if there
// are none or the card is missing.
std::string list(fs::FS& fs);

// False if the recipe does not exist.
bool read(fs::FS& fs, const char* id, std::string& out);

// Creates or replaces the recipe and its index line (`summary`, see
// recipeSummaryLine). Files are written to a temp file first, so a power cut
// mid-save leaves the previous version in place. False if the card refused a write.
bool write(fs::FS& fs, const char* id, const std::string& json, const std::string& summary);

// False if the recipe does not exist; its index line goes either way.
bool remove(fs::FS& fs, const char* id);

}  // namespace RecipeStore
}  // namespace BrewControl
