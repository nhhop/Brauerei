#pragma once

#include <cmath>
#include <cstddef>
#include <cstdint>
#include <ctime>
#include <utility>
#include <vector>

namespace BrewControl {

enum class CompAlgo { None, Linear, SwingingDoor };

// One sampled row: all series read at the same timestamp. NAN = invalid/missing.
struct LogSample {
  time_t ts = 0;
  std::vector<float> vals;
};

// Streaming, causal data reducer for one log's multi-series rows. All series are
// sampled in lockstep at shared timestamps; a row is emitted when ANY series
// breaks its tolerance (or the safety timeout elapses), so the shared timestamp
// grid is preserved across the CSV. Both algorithms emit a (possibly buffered,
// earlier) row — the latest sample is held back until the next breakout.
//
//   Linear        — drop the middle of three points when it lies, within tol, on
//                   the chord between its neighbours.
//   SwingingDoor  — bounded-slope corridor (a.k.a. dead-band / sector); a single
//                   straight segment can replace an arbitrarily long run of
//                   points that all stay within tol.
//
// Pure C++ (no Arduino deps) so it can be unit-tested natively.
class LogCompressor {
 public:
  void configure(CompAlgo algo, uint32_t maxGapSec, std::vector<float> tols) {
    algo_ = algo;
    maxGapSec_ = maxGapSec;
    tols_ = std::move(tols);
    reset();
  }

  void reset() {
    init_ = false;
    hasP1_ = false;
    smin_.clear();
    smax_.clear();
  }

  // Feeds one sampled row. Returns true and fills `out` with the row to persist
  // (which may be an earlier buffered row). Returns false to drop the sample.
  bool feed(const LogSample& s, LogSample& out) {
    switch (algo_) {
      case CompAlgo::Linear:       return feedLinear(s, out);
      case CompAlgo::SwingingDoor: return feedSwingingDoor(s, out);
      case CompAlgo::None:
      default:                     out = s; return true;
    }
  }

 private:
  CompAlgo algo_ = CompAlgo::None;
  uint32_t maxGapSec_ = 600;
  std::vector<float> tols_;

  bool init_ = false;
  bool hasP1_ = false;            // linear only
  LogSample p0_;                  // linear: last committed; SDT: corridor start
  LogSample p1_;                  // linear: probe; SDT: last in-corridor point
  std::vector<float> smin_, smax_;  // SDT slope corridor, per series

  static bool valid(float v) { return !std::isnan(v); }

  bool timedOut(time_t now) const {
    return maxGapSec_ > 0 && (now - p0_.ts) >= static_cast<time_t>(maxGapSec_);
  }

  // ── Linear-interpolation filter ──────────────────────────────────────────
  bool feedLinear(const LogSample& s, LogSample& out) {
    if (!init_) { p0_ = s; init_ = true; out = s; return true; }
    if (!hasP1_) { p1_ = s; hasP1_ = true; return false; }
    if (timedOut(s.ts)) { out = p1_; p0_ = p1_; p1_ = s; return true; }

    const double ttot = static_cast<double>(s.ts - p0_.ts);
    bool keep = false;
    if (ttot > 0) {
      const double t1 = static_cast<double>(p1_.ts - p0_.ts);
      for (size_t i = 0; i < tols_.size(); ++i) {
        if (i >= s.vals.size() || i >= p0_.vals.size() || i >= p1_.vals.size()) break;
        if (!valid(p0_.vals[i]) || !valid(p1_.vals[i]) || !valid(s.vals[i])) continue;
        const double interp = p0_.vals[i] + (s.vals[i] - p0_.vals[i]) * (t1 / ttot);
        if (std::fabs(p1_.vals[i] - interp) > tols_[i]) { keep = true; break; }
      }
    }
    if (keep) { out = p1_; p0_ = p1_; p1_ = s; return true; }
    p1_ = s;
    return false;
  }

  // ── Swinging Door (bounded-slope corridor) ────────────────────────────────
  void recompute(const LogSample& start, const LogSample& pt) {
    const size_t n = tols_.size();
    smin_.assign(n, -INFINITY);
    smax_.assign(n, INFINITY);
    const double dt = static_cast<double>(pt.ts - start.ts);
    if (dt <= 0) return;
    for (size_t i = 0; i < n; ++i) {
      if (i >= start.vals.size() || i >= pt.vals.size()) break;
      if (!valid(start.vals[i]) || !valid(pt.vals[i])) continue;
      smax_[i] = ((pt.vals[i] + tols_[i]) - start.vals[i]) / dt;
      smin_[i] = ((pt.vals[i] - tols_[i]) - start.vals[i]) / dt;
    }
  }

  bool feedSwingingDoor(const LogSample& s, LogSample& out) {
    if (!init_) {
      p0_ = s;
      p1_ = s;
      init_ = true;
      smin_.assign(tols_.size(), -INFINITY);
      smax_.assign(tols_.size(), INFINITY);
      out = s;
      return true;
    }
    if (timedOut(s.ts)) {
      out = p1_; p0_ = p1_; p1_ = s; recompute(p0_, s); return true;
    }

    const double dt = static_cast<double>(s.ts - p0_.ts);
    bool breakout = false;
    std::vector<float> nmin = smin_, nmax = smax_;
    if (dt > 0) {
      for (size_t i = 0; i < tols_.size(); ++i) {
        if (i >= s.vals.size() || i >= p0_.vals.size()) break;
        if (!valid(p0_.vals[i]) || !valid(s.vals[i])) continue;
        const double sup  = ((s.vals[i] + tols_[i]) - p0_.vals[i]) / dt;
        const double slow = ((s.vals[i] - tols_[i]) - p0_.vals[i]) / dt;
        if (sup  < nmax[i]) nmax[i] = static_cast<float>(sup);
        if (slow > nmin[i]) nmin[i] = static_cast<float>(slow);
        if (nmin[i] > nmax[i]) { breakout = true; break; }
      }
    }
    if (breakout) {
      out = p1_; p0_ = p1_; p1_ = s; recompute(p0_, s); return true;
    }
    smin_ = nmin;
    smax_ = nmax;
    p1_ = s;
    return false;
  }
};

}  // namespace BrewControl
