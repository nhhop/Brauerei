#include <unity.h>

#include <map>
#include <string>
#include <vector>

#include "TarExtractor.h"

using BrewControl::TarExtractor;

namespace {

// Appends one ustar file entry (512-byte header + data padded to 512) to `out`.
void appendEntry(std::vector<uint8_t>& out, const std::string& name,
                 const std::string& data) {
  uint8_t hdr[512] = {};
  memcpy(hdr, name.c_str(), name.size());        // name @ 0
  // size @ 124, 11 octal digits + NUL
  char oct[12];
  snprintf(oct, sizeof(oct), "%011o", static_cast<unsigned>(data.size()));
  memcpy(hdr + 124, oct, 11);
  hdr[156] = '0';                                 // typeflag = regular file
  memcpy(hdr + 257, "ustar", 5);                  // magic
  out.insert(out.end(), hdr, hdr + 512);
  out.insert(out.end(), data.begin(), data.end());
  size_t pad = (data.size() % 512) ? (512 - data.size() % 512) : 0;
  out.insert(out.end(), pad, 0);
}

// Builds the extractor with an in-memory sink backed by `files`.
struct MemSink {
  std::map<std::string, std::string> files;
  std::string current;
};

TarExtractor makeExtractor(MemSink& sink) {
  return TarExtractor(
      [&sink](const std::string& path, uint32_t) {
        sink.current = path;
        sink.files[path] = "";
        return true;
      },
      [&sink](const uint8_t* d, size_t n) {
        sink.files[sink.current].append(reinterpret_cast<const char*>(d), n);
        return true;
      },
      [&sink]() {
        sink.current.clear();
        return true;
      });
}

}  // namespace

void setUp() {}
void tearDown() {}

void test_single_file() {
  std::vector<uint8_t> tar;
  appendEntry(tar, "index.html.gz", "hello-world");
  MemSink sink;
  auto ex = makeExtractor(sink);
  TEST_ASSERT_TRUE(ex.feed(tar.data(), tar.size()));
  TEST_ASSERT_FALSE(ex.hasError());
  TEST_ASSERT_EQUAL_size_t(1, sink.files.size());
  TEST_ASSERT_EQUAL_STRING("hello-world", sink.files["index.html.gz"].c_str());
}

void test_subdir_and_multiple_files() {
  std::vector<uint8_t> tar;
  appendEntry(tar, "index.html.gz", "root");
  appendEntry(tar, "assets/app.js.gz", "javascript-bytes");
  appendEntry(tar, "assets/app.css.gz", "css");
  MemSink sink;
  auto ex = makeExtractor(sink);
  TEST_ASSERT_TRUE(ex.feed(tar.data(), tar.size()));
  TEST_ASSERT_EQUAL_size_t(3, sink.files.size());
  TEST_ASSERT_EQUAL_STRING("javascript-bytes",
                           sink.files["assets/app.js.gz"].c_str());
  TEST_ASSERT_EQUAL_STRING("css", sink.files["assets/app.css.gz"].c_str());
}

void test_chunked_one_byte_at_a_time() {
  std::vector<uint8_t> tar;
  appendEntry(tar, "assets/big.js.gz", std::string(1000, 'x'));
  MemSink sink;
  auto ex = makeExtractor(sink);
  for (size_t i = 0; i < tar.size(); ++i) {
    uint8_t b = tar[i];
    TEST_ASSERT_TRUE(ex.feed(&b, 1));
  }
  TEST_ASSERT_FALSE(ex.hasError());
  TEST_ASSERT_EQUAL_size_t(1000, sink.files["assets/big.js.gz"].size());
}

void test_empty_file() {
  std::vector<uint8_t> tar;
  appendEntry(tar, "empty", "");
  MemSink sink;
  auto ex = makeExtractor(sink);
  TEST_ASSERT_TRUE(ex.feed(tar.data(), tar.size()));
  TEST_ASSERT_EQUAL_size_t(1, sink.files.size());
  TEST_ASSERT_EQUAL_STRING("", sink.files["empty"].c_str());
}

int main(int, char**) {
  UNITY_BEGIN();
  RUN_TEST(test_single_file);
  RUN_TEST(test_subdir_and_multiple_files);
  RUN_TEST(test_chunked_one_byte_at_a_time);
  RUN_TEST(test_empty_file);
  return UNITY_END();
}
