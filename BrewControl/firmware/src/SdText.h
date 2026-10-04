#pragma once

#include <FS.h>

#include <string>

namespace BrewControl {

// Whole-file text I/O for the small JSON files the web UI stores on the SD card
// (recipes, brewhouses, the brewery). Every call takes SdLock itself.

// Appends nothing and returns false if `path` is missing or a directory.
// Not readString(): it reads byte by byte, ~150 ms for a 5 KB file on the LilyGo.
bool readText(fs::FS& fs, const std::string& path, std::string& out);

// The rest of an open file into `out`, in blocks (see readText). No lock taken.
void readOpenFile(File& f, std::string& out);

// Via a temp file, so a power cut mid-write leaves the previous content.
// `dir` is created first when given. False if the card refused the write.
bool writeText(fs::FS& fs, const char* dir, const std::string& path, const std::string& text);

}  // namespace BrewControl
