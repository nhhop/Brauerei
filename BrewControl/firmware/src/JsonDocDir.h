#pragma once

#include <FS.h>

#include <string>

namespace BrewControl {

// A directory on the SD card holding one JSON document per file, <dir>/<id>.json,
// with no index: for the few documents of a kind (brewhouses, mash profiles), where listing
// returns the full objects anyway. The firmware does not interpret a document
// beyond its id. Every call takes SdLock itself; ids must pass isValidRecipeId.
namespace JsonDocDir {

// JSON array of all documents in `dir`; "[]" if there are none or `dir` is missing.
std::string list(fs::FS& fs, const char* dir);

// Creates or replaces <dir>/<id>.json via a temp file (see writeText).
// False if the id is invalid or the card refused the write.
bool write(fs::FS& fs, const char* dir, const char* id, const std::string& json);

// False if the document does not exist.
bool remove(fs::FS& fs, const char* dir, const char* id);

}  // namespace JsonDocDir
}  // namespace BrewControl
