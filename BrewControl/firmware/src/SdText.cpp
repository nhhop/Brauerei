#include "SdText.h"

#include <Arduino.h>

#include "SdLock.h"

namespace BrewControl {

void readOpenFile(File& f, std::string& out) {
  out.clear();
  out.reserve(f.size());
  uint8_t chunk[512];
  for (int n = f.read(chunk, sizeof(chunk)); n > 0; n = f.read(chunk, sizeof(chunk))) {
    out.append(reinterpret_cast<const char*>(chunk), n);
  }
}

bool readText(fs::FS& fs, const std::string& path, std::string& out) {
  SdLock lock;
  File f = fs.open(path.c_str());
  if (!f) return false;
  const bool isFile = !f.isDirectory();
  if (isFile) readOpenFile(f, out);
  f.close();
  return isFile;
}

bool writeText(fs::FS& fs, const char* dir, const std::string& path, const std::string& text) {
  const std::string tmp = path + ".tmp";
  SdLock lock;
  if (dir) fs.mkdir(dir);
  File f = fs.open(tmp.c_str(), FILE_WRITE);
  if (!f) return false;
  const size_t n = f.write(reinterpret_cast<const uint8_t*>(text.data()), text.size());
  f.close();
  if (n != text.size()) { fs.remove(tmp.c_str()); return false; }
  fs.remove(path.c_str());  // rename does not overwrite on FAT
  return fs.rename(tmp.c_str(), path.c_str());
}

}  // namespace BrewControl
