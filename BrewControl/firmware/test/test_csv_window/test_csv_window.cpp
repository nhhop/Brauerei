#include <unity.h>

#include <algorithm>
#include <cstring>
#include <string>

#include "CsvWindow.h"

namespace {

// Reads from a string, as the firmware reads from the SD file.
struct StrRead {
  const std::string* s;
  size_t calls = 0;
  size_t operator()(size_t off, char* buf, size_t n) {
    ++calls;
    if (off >= s->size()) return 0;
    const size_t k = std::min(n, s->size() - off);
    memcpy(buf, s->data() + off, k);
    return k;
  }
};

const char* kHeader = "ts,sensor/a,actuator/b\r\n";

// Rows at ts = first, first+step, … (count of them).
std::string csv(long first, long step, int count, const char* eol = "\r\n") {
  std::string out = kHeader;
  for (int i = 0; i < count; ++i)
    out += std::to_string(first + i * step) + ",62.125," + (i % 2 ? "" : "1.000") + eol;
  return out;
}

// The window's text: the header and the rows.
std::string window(const std::string& s, bool hasFrom, long from, bool hasTo, long to) {
  StrRead r{&s};
  const CsvSpan w = csvWindow(r, s.size(), hasFrom, from, hasTo, to);
  return s.substr(0, w.headerLen) + s.substr(w.begin, w.end - w.begin);
}

// The ts of the rows in a window's text.
std::string tsList(const std::string& text) {
  std::string out;
  size_t pos = text.find('\n') + 1;
  while (pos < text.size()) {
    const size_t comma = text.find(',', pos);
    if (!out.empty()) out += ' ';
    out += text.substr(pos, comma - pos);
    pos = text.find('\n', pos) + 1;
    if (pos == 0) break;
  }
  return out;
}

}  // namespace

void setUp(void) {}
void tearDown(void) {}

void test_empty_file() {
  const std::string s;
  StrRead r{&s};
  const CsvSpan w = csvWindow(r, 0, true, 10, true, 20);
  TEST_ASSERT_EQUAL(0, w.headerLen);
  TEST_ASSERT_EQUAL(0, w.begin);
  TEST_ASSERT_EQUAL(0, w.end);
}

void test_header_only() {
  const std::string s = kHeader;
  TEST_ASSERT_EQUAL_STRING(kHeader, window(s, true, 10, true, 20).c_str());
}

void test_window_in_the_middle() {
  const std::string s = csv(100, 10, 10);  // 100 … 190
  TEST_ASSERT_EQUAL_STRING("130 140 150", tsList(window(s, true, 125, true, 155)).c_str());
  TEST_ASSERT_EQUAL(0, window(s, true, 125, true, 155).find(kHeader));
}

void test_bounds_on_a_row_are_inclusive() {
  const std::string s = csv(100, 10, 10);
  TEST_ASSERT_EQUAL_STRING("120 130 140", tsList(window(s, true, 120, true, 140)).c_str());
  TEST_ASSERT_EQUAL_STRING("100", tsList(window(s, true, 0, true, 100)).c_str());
  TEST_ASSERT_EQUAL_STRING("190", tsList(window(s, true, 190, true, 999)).c_str());
}

void test_window_before_and_after_the_data() {
  const std::string s = csv(100, 10, 10);
  TEST_ASSERT_EQUAL_STRING(kHeader, window(s, true, 0, true, 50).c_str());
  TEST_ASSERT_EQUAL_STRING(kHeader, window(s, true, 500, true, 600).c_str());
  TEST_ASSERT_EQUAL_STRING(kHeader, window(s, true, 600, true, 500).c_str());  // from after to
}

void test_one_side_open() {
  const std::string s = csv(100, 10, 10);
  TEST_ASSERT_EQUAL_STRING("170 180 190", tsList(window(s, true, 170, false, 0)).c_str());
  TEST_ASSERT_EQUAL_STRING("100 110", tsList(window(s, false, 0, true, 115)).c_str());
  TEST_ASSERT_EQUAL_STRING(s.c_str(), window(s, false, 0, false, 0).c_str());
}

void test_lf_line_ends() {
  const std::string s = csv(100, 10, 10, "\n");
  TEST_ASSERT_EQUAL_STRING("130 140 150", tsList(window(s, true, 125, true, 155)).c_str());
}

void test_last_row_without_line_end() {
  // The active session may be cut mid-row when its size is taken.
  std::string s = csv(100, 10, 3) + "130,62.1";
  TEST_ASSERT_EQUAL_STRING("120 130", tsList(window(s, true, 120, false, 0)).c_str());
}

void test_long_file_reads_little() {
  const std::string s = csv(1700000000, 10, 10000);
  StrRead r{&s};
  const CsvSpan w = csvWindow(r, s.size(), true, 1700000000 + 50000, true, 1700000000 + 50100);
  const std::string text = s.substr(w.begin, w.end - w.begin);
  TEST_ASSERT_EQUAL(0, text.find("1700050000,"));
  TEST_ASSERT_EQUAL(11, std::count(text.begin(), text.end(), '\n'));
  TEST_ASSERT_TRUE(r.calls < 200);
}

int main(int, char**) {
  UNITY_BEGIN();
  RUN_TEST(test_empty_file);
  RUN_TEST(test_header_only);
  RUN_TEST(test_window_in_the_middle);
  RUN_TEST(test_bounds_on_a_row_are_inclusive);
  RUN_TEST(test_window_before_and_after_the_data);
  RUN_TEST(test_one_side_open);
  RUN_TEST(test_lf_line_ends);
  RUN_TEST(test_last_row_without_line_end);
  RUN_TEST(test_long_file_reads_little);
  return UNITY_END();
}
