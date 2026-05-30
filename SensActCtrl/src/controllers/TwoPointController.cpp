#include "TwoPointController.h"

#include <stdio.h>
#include <string.h>
#include <stdlib.h>

namespace SensActCtrl {

TwoPointController::TwoPointController(const char* id, Sensor& sensor,
                                       Actuator& actuator)
    : id_(id), sensor_(&sensor), actuator_(&actuator) {}

void TwoPointController::tick() {
  if (!enabled()) return;
  const Reading r = sensor_->channel(0).reading;
  if (!r.valid) return;  // no reading yet — leave actuator alone

  const float lowThresh = setpoint_ + hystLow_;
  const float highThresh = setpoint_ + hystHigh_;

  if (!inverted_) {
    // Heating: turn on below low, off above high.
    if (r.value < lowThresh) currentlyOn_ = true;
    else if (r.value > highThresh) currentlyOn_ = false;
  } else {
    // Cooling: turn on above high, off below low.
    if (r.value > highThresh) currentlyOn_ = true;
    else if (r.value < lowThresh) currentlyOn_ = false;
  }

  actuator_->write(currentlyOn_ ? 1.0f : 0.0f);
}

// Tiny hand-rolled JSON parser: only handles flat {"k":num,...} input.
// Keeps the controller free of an ArduinoJson dependency for trivial blobs.
static bool extractFloat(const char* json, const char* key, float* out) {
  const size_t klen = strlen(key);
  const char* p = json;
  while ((p = strstr(p, "\""))) {
    const char* k = p + 1;
    const char* kend = strchr(k, '"');
    if (!kend) return false;
    if (static_cast<size_t>(kend - k) == klen && memcmp(k, key, klen) == 0) {
      const char* colon = strchr(kend, ':');
      if (!colon) return false;
      *out = static_cast<float>(strtod(colon + 1, nullptr));
      return true;
    }
    p = kend + 1;
  }
  return false;
}

static bool extractBool(const char* json, const char* key, bool* out) {
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
      while (*v == ' ') ++v;
      if (strncmp(v, "true", 4) == 0) { *out = true; return true; }
      if (strncmp(v, "false", 5) == 0) { *out = false; return true; }
      return false;
    }
    p = kend + 1;
  }
  return false;
}

size_t TwoPointController::paramsJson(char* buf, size_t bufSize) const {
  if (!buf || bufSize == 0) return 0;
  const int n = snprintf(buf, bufSize,
                         "{\"setpoint\":%.4f,\"hystLow\":%.4f,"
                         "\"hystHigh\":%.4f,\"inverted\":%s,"
                         "\"sensor\":\"%s\",\"actuator\":\"%s\","
                         "\"enabled\":%s}",
                         setpoint_, hystLow_, hystHigh_,
                         inverted_ ? "true" : "false",
                         sensor_->id(), actuator_->id(),
                         enabled() ? "true" : "false");
  if (n < 0 || static_cast<size_t>(n) >= bufSize) return 0;
  return static_cast<size_t>(n);
}

bool TwoPointController::setParamsJson(const char* json) {
  if (!json) return false;
  float f = 0.0f;
  if (extractFloat(json, "setpoint", &f)) setpoint_ = f;
  if (extractFloat(json, "hystLow", &f)) hystLow_ = f;
  if (extractFloat(json, "hystHigh", &f)) hystHigh_ = f;
  bool b = false;
  if (extractBool(json, "inverted", &b)) inverted_ = b;
  b = true;
  if (extractBool(json, "enabled", &b)) setEnabled(b);
  return true;
}

}  // namespace SensActCtrl
