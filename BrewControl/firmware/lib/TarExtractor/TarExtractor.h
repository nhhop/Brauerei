#pragma once

#include <cstddef>
#include <cstdint>
#include <functional>
#include <string>

namespace BrewControl {

// Streaming USTAR (tar) parser. Feed bytes in arbitrary chunk sizes; for each
// regular file the extractor calls onOpen(path, size), then onWrite(...) zero
// or more times, then onClose(). Directory entries and unsupported entry types
// are skipped. All filesystem coupling lives in the callbacks, so the parser is
// host-testable with an in-memory sink. On malformed input it latches an error
// (hasError()) and feed() returns false.
class TarExtractor {
 public:
  using OpenCb = std::function<bool(const std::string& path, uint32_t size)>;
  using WriteCb = std::function<bool(const uint8_t* data, size_t len)>;
  using CloseCb = std::function<bool()>;

  TarExtractor(OpenCb onOpen, WriteCb onWrite, CloseCb onClose);

  // Feed one chunk. Returns false once an error has been latched.
  bool feed(const uint8_t* data, size_t len);

  bool hasError() const { return error_; }
  const char* errorMsg() const { return errorMsg_; }

 private:
  bool fail(const char* msg);

  OpenCb onOpen_;
  WriteCb onWrite_;
  CloseCb onClose_;

  uint8_t header_[512];
  size_t headerFill_ = 0;  // bytes accumulated into header_
  bool inData_ = false;    // currently streaming file data / padding
  uint32_t remaining_ = 0;  // file bytes still to deliver to onWrite_
  uint32_t skip_ = 0;       // bytes to discard (padding or unsupported entry)
  bool error_ = false;
  const char* errorMsg_ = "";
};

}  // namespace BrewControl
