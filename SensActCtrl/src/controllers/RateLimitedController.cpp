#include "RateLimitedController.h"

#include <stdio.h>
#include <string.h>
#include <stdlib.h>

#if defined(ARDUINO)
  #include <Arduino.h>
#else
  static uint32_t g_mockMillis = 0;
  static uint32_t millis() { return g_mockMillis; }
  namespace SensActCtrl {
    void rateLimitedSetMillisForTest(uint32_t ms) { g_mockMillis = ms; }
  }
#endif

namespace SensActCtrl {

RateLimitedController::RateLimitedController(Controller& inner, float maxRatePerSec)
    : inner_(inner), maxRatePerSec_(maxRatePerSec < 0.0f ? 0.0f : maxRatePerSec) {}

void RateLimitedController::setSetpoint(float sp) {
  target_ = sp;
  if (!initialized_) { effective_ = sp; initialized_ = true; }
}

void RateLimitedController::tick() {
  const uint32_t now = millis();
  const uint32_t elapsed = hasTicked_ ? (now - lastTickMs_) : 0;
  lastTickMs_ = now;
  hasTicked_ = true;

  if (maxRatePerSec_ > 0.0f && elapsed > 0) {
    const float maxStep = maxRatePerSec_ * (static_cast<float>(elapsed) / 1000.0f);
    const float diff = target_ - effective_;
    if (diff > maxStep) effective_ += maxStep;
    else if (diff < -maxStep) effective_ -= maxStep;
    else effective_ = target_;  // close enough — land exactly, no overshoot
  } else {
    effective_ = target_;
  }

  inner_.setSetpoint(effective_);
  inner_.tick();
}

// ---------------------------------------------------------------------------
// JSON — flat {"k":v,...}, hand-rolled to stay free of ArduinoJson (same
// idiom as DualStageController/PIDController).
// ---------------------------------------------------------------------------

static bool jsonFindValue(const char* json, const char* key, const char** out) {
  const size_t klen = strlen(key);
  const char* p = json;
  while ((p = strstr(p, "\""))) {
    const char* k = p + 1;
    const char* kend = strchr(k, '"');
    if (!kend) return false;
    if (static_cast<size_t>(kend - k) == klen && memcmp(k, key, klen) == 0) {
      const char* colon = strchr(kend, ':');
      if (!colon) return false;
      const char* v = colon + 1;
      while (*v == ' ' || *v == '\t' || *v == '\n') ++v;
      *out = v;
      return true;
    }
    p = kend + 1;
  }
  return false;
}

static bool extractFloat(const char* json, const char* key, float* out) {
  const char* v = nullptr;
  if (!jsonFindValue(json, key, &v)) return false;
  *out = static_cast<float>(strtod(v, nullptr));
  return true;
}

size_t RateLimitedController::paramsJson(char* buf, size_t bufSize) const {
  if (!buf || bufSize == 0) return 0;
  char innerBuf[400];  // headroom under the 512B RegistrySnapshot.cpp budget;
                        // current controllers' own output is <300B.
  size_t innerLen = inner_.paramsJson(innerBuf, sizeof(innerBuf));
  if (innerLen == 0 || innerBuf[innerLen - 1] != '}') return 0;
  innerBuf[innerLen - 1] = '\0';  // strip trailing '}', splice our keys in
  const int n = snprintf(buf, bufSize,
                         "%s,\"maxRatePerSec\":%.4f,\"effectiveSetpoint\":%.4f}",
                         innerBuf, maxRatePerSec_, effective_);
  if (n < 0 || static_cast<size_t>(n) >= bufSize) return 0;
  return static_cast<size_t>(n);
}

bool RateLimitedController::setParamsJson(const char* json) {
  if (!json) return false;
  float f = 0.0f;
  if (extractFloat(json, "maxRatePerSec", &f)) setMaxRatePerSec(f);
  // No need to intercept an embedded "setpoint" key here: tick() reasserts
  // inner_.setSetpoint(effective_) every cycle, so even if inner_'s own
  // setParamsJson() acts on "setpoint" directly, the ramp self-corrects
  // within one tick interval.
  return inner_.setParamsJson(json);
}

}  // namespace SensActCtrl
