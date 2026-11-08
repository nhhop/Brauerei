#pragma once
// The rows of a log CSV ("ts,<refs…>" then one "<epoch>,<values…>" line per
// row) from `from` to `to`, found by a binary search over byte offsets so a
// long session is not read whole. Pure; `read(off, buf, n)` returns the bytes
// read at `off`, so the native tests can run it over a string.
//
// Assumes the rows are sorted by ts: LogStore appends only once the clock is
// real (LogStore::tick). A clock that jumps back mid-session leaves the
// window only approximately right.
#include <cstddef>
#include <cstdlib>

struct CsvSpan {
  size_t headerLen;  // bytes of the header line, with its line end
  size_t begin;      // first byte of the first row in the window
  size_t end;        // one past the last byte of the last row in the window
};

namespace csv_window_detail {

constexpr size_t kProbe = 32;

// The start of the first line at or after `off` (`off` itself if a line
// starts there), or `size`.
template <class Read>
size_t lineStart(Read& read, size_t size, size_t headerLen, size_t off) {
  if (off <= headerLen) return headerLen;
  char buf[kProbe];
  size_t pos = off - 1;  // a line starts at off if the byte before is '\n'
  while (pos < size) {
    const size_t n = read(pos, buf, kProbe);
    if (n == 0) return size;
    for (size_t i = 0; i < n; ++i)
      if (buf[i] == '\n') return pos + i + 1;
    pos += n;
  }
  return size;
}

// The ts of the line starting at `off`.
template <class Read>
long tsAt(Read& read, size_t off) {
  char buf[kProbe + 1];
  const size_t n = read(off, buf, kProbe);
  buf[n] = '\0';
  return atol(buf);  // stops at the comma
}

// The first line start whose ts is past the limit (ts >= limit, or ts > limit
// with `after`), else `size`. Searches the smallest offset whose next line
// qualifies; that is monotone in the offset because the rows are sorted.
template <class Read>
size_t firstFrom(Read& read, size_t size, size_t headerLen, long limit, bool after) {
  auto past = [&](size_t off) {
    const size_t s = lineStart(read, size, headerLen, off);
    if (s >= size) return true;
    const long ts = tsAt(read, s);
    return after ? ts > limit : ts >= limit;
  };
  size_t lo = headerLen, hi = size;
  while (lo < hi) {
    const size_t mid = lo + (hi - lo) / 2;
    if (past(mid)) hi = mid; else lo = mid + 1;
  }
  return lineStart(read, size, headerLen, lo);
}

}  // namespace csv_window_detail

// `hasFrom`/`hasTo` false: that side is open.
template <class Read>
CsvSpan csvWindow(Read& read, size_t size, bool hasFrom, long from, bool hasTo, long to) {
  using namespace csv_window_detail;
  // The header ends with the first '\n'.
  size_t headerLen = size;
  char buf[kProbe];
  for (size_t pos = 0; pos < size;) {
    const size_t n = read(pos, buf, kProbe);
    if (n == 0) break;
    size_t i = 0;
    while (i < n && buf[i] != '\n') ++i;
    if (i < n) { headerLen = pos + i + 1; break; }
    pos += n;
  }
  CsvSpan span{headerLen, headerLen, size};
  if (hasFrom) span.begin = firstFrom(read, size, headerLen, from, false);
  if (hasTo) span.end = firstFrom(read, size, headerLen, to, true);
  if (span.end < span.begin) span.end = span.begin;
  return span;
}
