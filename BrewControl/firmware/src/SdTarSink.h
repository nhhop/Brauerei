#pragma once

#include <Arduino.h>
#include <FS.h>

#include "TarExtractor.h"

namespace BrewControl {

// Produces TarExtractor callbacks that write each archived file into `fs` under
// `basePath`, creating intermediate directories as needed. One file is open at
// a time. Construct one SdTarSink per extraction run.
class SdTarSink {
 public:
  SdTarSink(fs::FS& fs, const char* basePath) : fs_(fs), base_(basePath) {}

  TarExtractor::OpenCb openCb() {
    return [this](const std::string& path, uint32_t) {
      String full = base_ + "/" + String(path.c_str());
      ensureParentDirs(full);
      if (cur_) cur_.close();
      cur_ = fs_.open(full, FILE_WRITE);
      return static_cast<bool>(cur_);
    };
  }

  TarExtractor::WriteCb writeCb() {
    return [this](const uint8_t* data, size_t len) {
      if (!cur_) return false;
      return cur_.write(data, len) == len;
    };
  }

  TarExtractor::CloseCb closeCb() {
    return [this]() {
      if (cur_) cur_.close();
      return true;
    };
  }

 private:
  void ensureParentDirs(const String& fullPath) {
    int slash = fullPath.indexOf('/', 1);
    while (slash > 0) {
      fs_.mkdir(fullPath.substring(0, slash));
      slash = fullPath.indexOf('/', slash + 1);
    }
  }

  fs::FS& fs_;
  String base_;
  File cur_;
};

}  // namespace BrewControl
