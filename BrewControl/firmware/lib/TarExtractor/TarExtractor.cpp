#include "TarExtractor.h"

#include <cstring>

namespace BrewControl {
namespace {

// Parses a NUL/space-terminated octal field (tar stores sizes in octal ASCII).
uint32_t parseOctal(const uint8_t* field, size_t len) {
  uint32_t v = 0;
  for (size_t i = 0; i < len; ++i) {
    char c = static_cast<char>(field[i]);
    if (c < '0' || c > '7') break;  // stops at the space/NUL terminator
    v = (v << 3) + static_cast<uint32_t>(c - '0');
  }
  return v;
}

size_t fieldLen(const uint8_t* field, size_t maxLen) {
  size_t n = 0;
  while (n < maxLen && field[n] != '\0') ++n;
  return n;
}

bool isZeroBlock(const uint8_t* b) {
  for (size_t i = 0; i < 512; ++i)
    if (b[i] != 0) return false;
  return true;
}

}  // namespace

TarExtractor::TarExtractor(OpenCb onOpen, WriteCb onWrite, CloseCb onClose)
    : onOpen_(std::move(onOpen)),
      onWrite_(std::move(onWrite)),
      onClose_(std::move(onClose)) {}

bool TarExtractor::fail(const char* msg) {
  error_ = true;
  errorMsg_ = msg;
  return false;
}

bool TarExtractor::feed(const uint8_t* data, size_t len) {
  if (error_) return false;
  size_t i = 0;
  while (i < len) {
    if (inData_) {
      if (remaining_ > 0) {
        size_t take = len - i;
        if (take > remaining_) take = remaining_;
        if (!onWrite_(data + i, take)) return fail("write failed");
        i += take;
        remaining_ -= take;
        if (remaining_ == 0) {
          if (!onClose_()) return fail("close failed");
        }
        continue;
      }
      if (skip_ > 0) {
        size_t take = len - i;
        if (take > skip_) take = skip_;
        i += take;
        skip_ -= take;
      }
      if (remaining_ == 0 && skip_ == 0) inData_ = false;
      continue;
    }

    // Accumulate a full 512-byte header block.
    size_t need = 512 - headerFill_;
    size_t take = len - i;
    if (take > need) take = need;
    memcpy(header_ + headerFill_, data + i, take);
    headerFill_ += take;
    i += take;
    if (headerFill_ < 512) break;  // need more bytes for a complete header
    headerFill_ = 0;

    if (isZeroBlock(header_)) continue;  // end-of-archive marker block

    char typeflag = static_cast<char>(header_[156]);
    uint32_t size = parseOctal(header_ + 124, 12);
    uint32_t pad = (size % 512) ? (512 - (size % 512)) : 0;

    if (typeflag == '5') {  // directory — sinks create dirs lazily, nothing to do
      continue;
    }
    if (typeflag != '0' && typeflag != '\0') {  // symlink/hardlink/etc — skip
      skip_ = size + pad;
      remaining_ = 0;
      inData_ = (skip_ > 0);
      continue;
    }

    // Regular file. Build "<prefix>/<name>" (ustar long-name support).
    std::string name(reinterpret_cast<const char*>(header_),
                     fieldLen(header_, 100));
    size_t prefixLen = fieldLen(header_ + 345, 155);
    if (prefixLen > 0) {
      std::string prefix(reinterpret_cast<const char*>(header_ + 345), prefixLen);
      name = prefix + "/" + name;
    }

    if (!onOpen_(name, size)) return fail("open failed");
    remaining_ = size;
    skip_ = pad;
    inData_ = true;
    if (size == 0) {
      if (!onClose_()) return fail("close failed");
      if (skip_ == 0) inData_ = false;
    }
  }
  return true;
}

}  // namespace BrewControl
