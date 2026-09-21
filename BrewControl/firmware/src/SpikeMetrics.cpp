#include "SpikeMetrics.h"

#ifdef BREWCTL_SPIKE_METRICS

#include <ESPAsyncWebServer.h>
#include <WiFi.h>
#include <esp_heap_caps.h>

#ifdef BREWCTL_HAS_DISPLAY
#include <lvgl.h>
#endif

namespace BrewControl {
namespace {

AsyncWebServer g_server(81);

// Reading the counters from the AsyncTCP task while loopTask writes them is a
// benign race: every field is a 32/64-bit scalar, and a torn histogram only
// shifts a percentile by one sample. Not worth a mutex in throwaway code —
// worth a mutex in anything that ships.
SpikeMetrics* g_self = nullptr;

uint32_t bucketFor(uint32_t us) {
  const uint32_t ms = us / 1000;
  if (ms < 100) return ms;
  if (ms < 1000) return 100 + (ms - 100) / 10;
  return 190;
}

// Upper edge of a bucket, in ms.
uint32_t bucketMs(size_t i) {
  if (i < 100) return static_cast<uint32_t>(i) + 1;
  if (i < 190) return 100 + (static_cast<uint32_t>(i) - 100 + 1) * 10;
  return 1000;
}

}  // namespace

void SpikeMetrics::resetWindow_(uint32_t nowUs) {
  loopCount_ = 0;
  loopMinUs_ = 0xFFFFFFFF;
  loopMaxUs_ = 0;
  loopSumUs_ = 0;
  for (size_t i = 0; i < kBuckets; ++i) buckets_[i] = 0;
  dispCount_ = 0;
  dispMaxUs_ = 0;
  dispSumUs_ = 0;
  flushCount_ = 0;
  flushMaxUs_ = 0;
  flushPixels_ = 0;
  windowStartMs_ = nowUs / 1000;
}

void SpikeMetrics::onLoop() {
  const uint32_t nowUs = micros();
  if (resetPending_) {
    resetPending_ = false;
    resetWindow_(nowUs);
    lastLoopUs_ = nowUs;
    return;
  }
  if (lastLoopUs_ != 0) {
    const uint32_t dt = nowUs - lastLoopUs_;  // wraps correctly on uint32
    ++loopCount_;
    loopSumUs_ += dt;
    if (dt < loopMinUs_) loopMinUs_ = dt;
    if (dt > loopMaxUs_) loopMaxUs_ = dt;
    ++buckets_[bucketFor(dt)];
  }
  lastLoopUs_ = nowUs;
}

void SpikeMetrics::recordDisplayTick(uint32_t us) {
  ++dispCount_;
  dispSumUs_ += us;
  if (us > dispMaxUs_) dispMaxUs_ = us;
}

void SpikeMetrics::recordFlush(uint32_t pixels, uint32_t us) {
  ++flushCount_;
  flushPixels_ += pixels;
  if (us > flushMaxUs_) flushMaxUs_ = us;
}

size_t SpikeMetrics::percentileMs_(uint32_t permille) const {
  if (loopCount_ == 0) return 0;
  const uint32_t target = (loopCount_ * permille) / 1000;
  uint32_t seen = 0;
  for (size_t i = 0; i < kBuckets; ++i) {
    seen += buckets_[i];
    if (seen >= target) return bucketMs(i);
  }
  return bucketMs(kBuckets - 1);
}

size_t SpikeMetrics::buildJson_(char* out, size_t cap) const {
  // Coarse buckets from the fine histogram, matching the plan's table.
  uint32_t lt5 = 0, lt10 = 0, lt20 = 0, lt50 = 0, lt100 = 0, lt250 = 0, ge250 = 0;
  for (size_t i = 0; i < kBuckets; ++i) {
    const uint32_t n = buckets_[i];
    const uint32_t ms = bucketMs(i);
    if (ms <= 5) lt5 += n;
    else if (ms <= 10) lt10 += n;
    else if (ms <= 20) lt20 += n;
    else if (ms <= 50) lt50 += n;
    else if (ms <= 100) lt100 += n;
    else if (ms <= 250) lt250 += n;
    else ge250 += n;
  }

  const uint32_t nowMs = millis();
  const uint32_t windowMs = nowMs - windowStartMs_;
  const uint32_t avgUs = loopCount_ ? static_cast<uint32_t>(loopSumUs_ / loopCount_) : 0;
  const uint32_t dispAvgUs = dispCount_ ? static_cast<uint32_t>(dispSumUs_ / dispCount_) : 0;
  const uint32_t fps = windowMs ? static_cast<uint32_t>((flushCount_ * 1000ULL) / windowMs) : 0;
  const uint32_t pxPerSec = windowMs ? static_cast<uint32_t>((flushPixels_ * 1000ULL) / windowMs) : 0;

#ifdef BREWCTL_HAS_DISPLAY
  lv_mem_monitor_t mem;
  lv_mem_monitor(&mem);
  const uint32_t lvUsed = mem.used_pct, lvFrag = mem.frag_pct, lvMax = mem.max_used;
  const int hasDisplay = 1;
#else
  const uint32_t lvUsed = 0, lvFrag = 0, lvMax = 0;
  const int hasDisplay = 0;
#endif

  return snprintf(
      out, cap,
      "{\"build\":{\"variant\":\"%s\",\"hasDisplay\":%d},"
      "\"uptimeMs\":%u,\"windowMs\":%u,"
      "\"loop\":{\"n\":%u,\"minUs\":%u,\"avgUs\":%u,\"maxUs\":%u,"
      "\"p50Ms\":%u,\"p99Ms\":%u,"
      "\"buckets\":{\"lt5\":%u,\"lt10\":%u,\"lt20\":%u,\"lt50\":%u,"
      "\"lt100\":%u,\"lt250\":%u,\"ge250\":%u}},"
      "\"displayTick\":{\"n\":%u,\"avgUs\":%u,\"maxUs\":%u},"
      "\"flush\":{\"calls\":%u,\"fps\":%u,\"pixelsPerSec\":%u,\"maxUs\":%u},"
      "\"heap\":{\"free\":%u,\"minFree\":%u,\"internalFree\":%u,\"dmaLargest\":%u},"
      "\"psram\":{\"size\":%u,\"free\":%u,\"minFree\":%u},"
      "\"lvgl\":{\"usedPct\":%u,\"fragPct\":%u,\"maxUsed\":%u},"
      "\"wifi\":{\"rssi\":%d,\"ip\":\"%s\"}}",
      BREWCTL_VARIANT, hasDisplay,
      nowMs, windowMs,
      loopCount_, loopMinUs_ == 0xFFFFFFFF ? 0 : loopMinUs_, avgUs, loopMaxUs_,
      static_cast<uint32_t>(percentileMs_(500)), static_cast<uint32_t>(percentileMs_(990)),
      lt5, lt10, lt20, lt50, lt100, lt250, ge250,
      dispCount_, dispAvgUs, dispMaxUs_,
      flushCount_, fps, pxPerSec, flushMaxUs_,
      ESP.getFreeHeap(), ESP.getMinFreeHeap(),
      heap_caps_get_free_size(MALLOC_CAP_INTERNAL | MALLOC_CAP_8BIT),
      heap_caps_get_largest_free_block(MALLOC_CAP_DMA | MALLOC_CAP_INTERNAL),
      ESP.getPsramSize(), ESP.getFreePsram(), ESP.getMinFreePsram(),
      lvUsed, lvFrag, lvMax,
      WiFi.RSSI(), WiFi.localIP().toString().c_str());
}

void SpikeMetrics::begin() {
  g_self = this;
  resetWindow_(micros());

  g_server.on("/spike", HTTP_GET, [](AsyncWebServerRequest* req) {
    if (!g_self) { req->send(503); return; }
    if (req->hasParam("reset")) g_self->resetPending_ = true;
    static char buf[1400];
    const size_t n = g_self->buildJson_(buf, sizeof(buf));
    if (n == 0 || n >= sizeof(buf)) { req->send(500, "text/plain", "json overflow"); return; }
    req->send(200, "application/json", buf);
  });
  g_server.begin();
}

}  // namespace BrewControl

#endif  // BREWCTL_SPIKE_METRICS
