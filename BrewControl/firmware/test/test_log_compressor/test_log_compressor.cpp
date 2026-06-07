#include <unity.h>

#include <cmath>
#include <vector>

#include "LogCompressor.h"

using BrewControl::CompAlgo;
using BrewControl::LogCompressor;
using BrewControl::LogSample;

namespace {

// Feeds a sequence of multi-series rows; returns the rows the compressor emits.
std::vector<LogSample> run(LogCompressor& c, const std::vector<LogSample>& pts) {
  std::vector<LogSample> out;
  for (const auto& p : pts) {
    LogSample o;
    if (c.feed(p, o)) out.push_back(o);
  }
  return out;
}

// Builds a single-series row.
LogSample s1(time_t ts, float v) { return LogSample{ts, {v}}; }

LogCompressor make(CompAlgo algo, std::vector<float> tols, uint32_t maxGap = 100000) {
  LogCompressor c;
  c.configure(algo, maxGap, std::move(tols));
  return c;
}

}  // namespace

// ── None ────────────────────────────────────────────────────────────────────

void test_none_emits_every_row() {
  LogCompressor c = make(CompAlgo::None, {0.0f});
  auto e = run(c, {s1(0, 1), s1(1, 1), s1(2, 1), s1(3, 1)});
  TEST_ASSERT_EQUAL_size_t(4, e.size());
}

// ── First point ───────────────────────────────────────────────────────────────

void test_first_point_always_emitted() {
  LogCompressor c = make(CompAlgo::SwingingDoor, {0.5f});
  LogSample o;
  TEST_ASSERT_TRUE(c.feed(s1(0, 42), o));
  TEST_ASSERT_EQUAL_INT(0, (int)o.ts);
  TEST_ASSERT_FLOAT_WITHIN(0.001f, 42.0f, o.vals[0]);
}

// ── Swinging Door ─────────────────────────────────────────────────────────────

void test_sd_flat_collapses_to_one() {
  LogCompressor c = make(CompAlgo::SwingingDoor, {0.5f});
  auto e = run(c, {s1(0, 20), s1(2, 20), s1(4, 20), s1(6, 20), s1(8, 20)});
  // Only the anchor survives; the flat run is held in the buffer.
  TEST_ASSERT_EQUAL_size_t(1, e.size());
  TEST_ASSERT_EQUAL_INT(0, (int)e[0].ts);
}

void test_sd_ramp_then_flat_keeps_corner() {
  LogCompressor c = make(CompAlgo::SwingingDoor, {0.1f});
  // Perfect ramp slope +1/s for 5 s, then flat — the corner must be emitted.
  auto e = run(c, {
    s1(0, 0), s1(1, 1), s1(2, 2), s1(3, 3), s1(4, 4), s1(5, 5),
    s1(6, 5), s1(7, 5), s1(8, 5),
  });
  // Anchor at t0, plus the breakout when the slope flips to 0.
  TEST_ASSERT_TRUE(e.size() >= 2);
  TEST_ASSERT_EQUAL_INT(0, (int)e[0].ts);
  // The corner emitted is the last point still on the ramp (t5, value 5).
  TEST_ASSERT_EQUAL_INT(5, (int)e[1].ts);
  TEST_ASSERT_FLOAT_WITHIN(0.01f, 5.0f, e[1].vals[0]);
}

void test_sd_spike_breaks_out() {
  LogCompressor c = make(CompAlgo::SwingingDoor, {0.5f});
  auto e = run(c, {s1(0, 10), s1(1, 10), s1(2, 10), s1(3, 100)});
  TEST_ASSERT_EQUAL_size_t(2, e.size());
  // Breakout emits the buffered point just before the spike (t2).
  TEST_ASSERT_EQUAL_INT(2, (int)e[1].ts);
  TEST_ASSERT_FLOAT_WITHIN(0.01f, 10.0f, e[1].vals[0]);
}

void test_sd_timeout_forces_point() {
  LogCompressor c = make(CompAlgo::SwingingDoor, {0.5f}, /*maxGap=*/10);
  auto e = run(c, {s1(0, 5), s1(2, 5), s1(4, 5), s1(6, 5), s1(8, 5), s1(10, 5), s1(12, 5)});
  // t0 anchor + the timeout firing at t10 (emits the last buffered point, t8).
  TEST_ASSERT_EQUAL_size_t(2, e.size());
  TEST_ASSERT_EQUAL_INT(0, (int)e[0].ts);
  TEST_ASSERT_EQUAL_INT(8, (int)e[1].ts);
}

// ── Linear-interpolation filter ──────────────────────────────────────────────

void test_linear_collinear_dropped() {
  LogCompressor c = make(CompAlgo::Linear, {0.05f});
  auto e = run(c, {s1(0, 0), s1(1, 1), s1(2, 2), s1(3, 3)});
  TEST_ASSERT_EQUAL_size_t(1, e.size());
  TEST_ASSERT_EQUAL_INT(0, (int)e[0].ts);
}

void test_linear_offline_point_kept() {
  LogCompressor c = make(CompAlgo::Linear, {0.5f});
  // Middle point (t1) is far off the chord from (0,0) to (2,2).
  auto e = run(c, {s1(0, 0), s1(1, 5), s1(2, 2)});
  TEST_ASSERT_EQUAL_size_t(2, e.size());
  TEST_ASSERT_EQUAL_INT(1, (int)e[1].ts);
  TEST_ASSERT_FLOAT_WITHIN(0.01f, 5.0f, e[1].vals[0]);
}

// ── Multi-series ──────────────────────────────────────────────────────────────

void test_multiseries_or_trigger() {
  LogCompressor c = make(CompAlgo::SwingingDoor, {0.5f, 0.5f});
  // Series 0 stays flat; series 1 spikes at t3 → the row must be emitted.
  auto e = run(c, {
    LogSample{0, {10, 0}}, LogSample{1, {10, 0}},
    LogSample{2, {10, 0}}, LogSample{3, {10, 100}},
  });
  TEST_ASSERT_EQUAL_size_t(2, e.size());
  TEST_ASSERT_EQUAL_INT(2, (int)e[1].ts);
  TEST_ASSERT_FLOAT_WITHIN(0.01f, 10.0f, e[1].vals[0]);
  TEST_ASSERT_FLOAT_WITHIN(0.01f, 0.0f, e[1].vals[1]);
}

void test_nan_series_is_safe_and_passthrough() {
  LogCompressor c = make(CompAlgo::SwingingDoor, {0.5f, 0.5f});
  const float nan = std::nanf("");
  // Series 1 is always invalid; it must neither crash nor force a breakout.
  auto e = run(c, {
    LogSample{0, {10, nan}}, LogSample{2, {10, nan}},
    LogSample{4, {10, nan}}, LogSample{6, {10, nan}},
  });
  TEST_ASSERT_EQUAL_size_t(1, e.size());          // flat → collapses
  TEST_ASSERT_TRUE(std::isnan(e[0].vals[1]));     // invalid cell preserved
}

// ── Flush (disable path) ──────────────────────────────────────────────────────

void test_flush_emits_buffered_point() {
  LogCompressor c = make(CompAlgo::SwingingDoor, {0.5f});
  // Flat run: first point emitted, the rest buffered.
  run(c, {s1(0, 20), s1(2, 20), s1(4, 20), s1(6, 20)});
  LogSample out;
  TEST_ASSERT_TRUE(c.flush(out));            // buffered last point comes out
  TEST_ASSERT_EQUAL_INT(6, (int)out.ts);
  TEST_ASSERT_FLOAT_WITHIN(0.01f, 20.0f, out.vals[0]);
  // Nothing left pending after a flush.
  LogSample again;
  TEST_ASSERT_FALSE(c.flush(again));
}

void test_flush_noop_right_after_emit() {
  LogCompressor c = make(CompAlgo::SwingingDoor, {0.5f});
  LogSample out;
  c.feed(s1(0, 5), out);                     // first point emitted immediately
  LogSample f;
  TEST_ASSERT_FALSE(c.flush(f));             // p1 == emitted → nothing buffered
}

// ── Runner ────────────────────────────────────────────────────────────────────

void setUp(void) {}
void tearDown(void) {}

int main(int, char**) {
  UNITY_BEGIN();
  RUN_TEST(test_none_emits_every_row);
  RUN_TEST(test_first_point_always_emitted);
  RUN_TEST(test_sd_flat_collapses_to_one);
  RUN_TEST(test_sd_ramp_then_flat_keeps_corner);
  RUN_TEST(test_sd_spike_breaks_out);
  RUN_TEST(test_sd_timeout_forces_point);
  RUN_TEST(test_linear_collinear_dropped);
  RUN_TEST(test_linear_offline_point_kept);
  RUN_TEST(test_multiseries_or_trigger);
  RUN_TEST(test_nan_series_is_safe_and_passthrough);
  RUN_TEST(test_flush_emits_buffered_point);
  RUN_TEST(test_flush_noop_right_after_emit);
  return UNITY_END();
}
