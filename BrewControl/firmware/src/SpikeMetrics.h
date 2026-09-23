#pragma once

// Throwaway instrumentation for the spike/lvgl-display branch.
//
// Answers one question with numbers instead of guesses: what does driving an
// LVGL panel from loop() cost the rest of the firmware? Everything the spike
// needs to decide that is derivable from the loop() period, because
// WebUI::tick() gates its 1 Hz SSE push on millis() and registry.tick() is the
// first statement in loop() — SSE jitter and controller cycle time ARE the
// loop period. See the plan for the full argument.
//
// Serves its own AsyncWebServer on port 81 so WebUI.cpp stays untouched (and
// docs/openapi.yaml with it). Deleted together with the branch.

#ifdef BREWCTL_SPIKE_METRICS

#include <Arduino.h>
#include <FS.h>

namespace BrewControl {

class SpikeMetrics {
 public:
  // Appends "<millis>,<resetReason>,<tag>" to /spike-boot.log. USB-CDC serial
  // is useless here - the port re-enumerates on every reset, so a boot loop
  // never gets its panic text out. A file on SD survives the reboot and is
  // readable over the existing GET /api/files/download.
  static void logBoot(fs::FS& fs, const char* tag);

  // Starts the metrics server. Safe to call before WiFi is up.
  void begin();

  // Call once as the first statement in loop(). Measures the period between
  // consecutive calls, which includes the trailing delay(5).
  void onLoop();

  // Optional detail counters, called from the display code when present.
  void recordDisplayTick(uint32_t us);
  void recordFlush(uint32_t pixels, uint32_t us);

  // Per-section timing, to attribute a long loop() to a culprit instead of
  // guessing. kSections slots, named in kSectionNames.
  enum Section { kRegistry = 0, kWebUi, kOtherServices, kSectionCount };
  void recordSection(Section s, uint32_t us);

 private:
  // Histogram: [0..99] = 1 ms each, [100..189] = 10 ms each, [190] = >= 1 s.
  static constexpr size_t kBuckets = 191;

  void resetWindow_(uint32_t nowUs);
  size_t percentileMs_(uint32_t permille) const;
  size_t buildJson_(char* out, size_t cap) const;

  uint32_t lastLoopUs_ = 0;
  uint32_t windowStartMs_ = 0;

  uint32_t loopCount_ = 0;
  uint32_t loopMinUs_ = 0xFFFFFFFF;
  uint32_t loopMaxUs_ = 0;
  uint64_t loopSumUs_ = 0;
  uint32_t buckets_[kBuckets] = {};

  uint32_t dispCount_ = 0;
  uint32_t dispMaxUs_ = 0;
  uint64_t dispSumUs_ = 0;

  uint32_t flushCount_ = 0;
  uint32_t flushMaxUs_ = 0;
  uint64_t flushPixels_ = 0;

  uint32_t secCount_[kSectionCount] = {};
  uint32_t secMaxUs_[kSectionCount] = {};
  uint64_t secSumUs_[kSectionCount] = {};

  // Set by the HTTP handler (AsyncTCP task), consumed in onLoop() (loopTask) so
  // the counters are only ever written from one thread.
  volatile bool resetPending_ = false;
};

}  // namespace BrewControl

#endif  // BREWCTL_SPIKE_METRICS
