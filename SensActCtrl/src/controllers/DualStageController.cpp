#include "DualStageController.h"

#include <stdio.h>
#include <string.h>
#include <stdlib.h>

#if defined(ARDUINO)
  #include <Arduino.h>
#else
  static uint32_t g_mockMillis = 0;
  static uint32_t millis() { return g_mockMillis; }
  namespace SensActCtrl {
    void dualStageSetMillisForTest(uint32_t ms) { g_mockMillis = ms; }
  }
#endif

namespace SensActCtrl {

DualStageController::DualStageController(const char* id, Sensor& sensor,
                                         Actuator* heat, Actuator* cool)
    : id_(id), sensor_(&sensor), heat_(heat), cool_(cool) {}

void DualStageController::setDifferentials(float heatDiff, float coolDiff) {
  heatDiff_ = heatDiff < 0.0f ? 0.0f : heatDiff;
  coolDiff_ = coolDiff < 0.0f ? 0.0f : coolDiff;
}

void DualStageController::setCoolCycleLimits(uint32_t minOnMs, uint32_t minOffMs) {
  coolMinOnMs_ = minOnMs;
  coolMinOffMs_ = minOffMs;
}

void DualStageController::writeOff() {
  const uint32_t now = millis();
  if (heatOn_) { heatOn_ = false; heatOffSinceMs_ = now; heatOffSeen_ = true; }
  if (coolOn_) { coolOn_ = false; coolOffSinceMs_ = now; coolOffSeen_ = true; }
  if (heat_) heat_->write(0.0f);
  if (cool_) cool_->write(0.0f);
}

void DualStageController::tick() {
  if (!enabled()) { writeOff(); return; }

  const Reading r = sensor_->channel(0).reading;
  if (!r.valid) { writeOff(); return; }  // fail-safe: both off on dead sensor

  const uint32_t now = millis();

  // 1) Desired states from asymmetric hysteresis (on at the differential,
  //    off at the setpoint).
  bool wantHeat = heatOn_ ? (r.value < setpoint_)
                          : (r.value < setpoint_ - heatDiff_);
  bool wantCool = coolOn_ ? (r.value > setpoint_)
                          : (r.value > setpoint_ + coolDiff_);

  // 2) Cooling anti-short-cycle (compressor protection).
  if (wantCool && !coolOn_ && coolMinOffMs_ && coolOffSeen_ &&
      (now - coolOffSinceMs_) < coolMinOffMs_) {
    wantCool = false;  // still inside minimum-off window
  }
  if (!wantCool && coolOn_ && coolMinOnMs_ &&
      (now - coolOnSinceMs_) < coolMinOnMs_) {
    wantCool = true;   // hold for minimum-on
    wantHeat = false;  // a held compressor wins over a fresh heat demand
  }

  // 3) Changeover dead-time: a stage may only engage once the opposite has
  //    been off long enough.
  if (changeoverMs_) {
    if (wantHeat && !heatOn_ &&
        (coolOn_ || (coolOffSeen_ && (now - coolOffSinceMs_) < changeoverMs_))) {
      wantHeat = false;
    }
    if (wantCool && !coolOn_ &&
        (heatOn_ || (heatOffSeen_ && (now - heatOffSinceMs_) < changeoverMs_))) {
      wantCool = false;
    }
  }

  // 4) Hard interlock — never both on; on contradiction fail safe to off.
  if (wantHeat && wantCool) { wantHeat = false; wantCool = false; }

  // 5) Commit transitions + record timestamps.
  if (wantHeat != heatOn_) {
    heatOn_ = wantHeat;
    if (!heatOn_) { heatOffSinceMs_ = now; heatOffSeen_ = true; }
  }
  if (wantCool != coolOn_) {
    coolOn_ = wantCool;
    if (coolOn_) coolOnSinceMs_ = now;
    else { coolOffSinceMs_ = now; coolOffSeen_ = true; }
  }

  if (heat_) heat_->write(heatOn_ ? 1.0f : 0.0f);
  if (cool_) cool_->write(coolOn_ ? 1.0f : 0.0f);
}

// ---------------------------------------------------------------------------
// JSON — flat {"k":v,...}, hand-rolled to stay free of ArduinoJson.
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

static bool extractU32(const char* json, const char* key, uint32_t* out) {
  const char* v = nullptr;
  if (!jsonFindValue(json, key, &v)) return false;
  const double d = strtod(v, nullptr);
  *out = d < 0.0 ? 0u : static_cast<uint32_t>(d);
  return true;
}

static bool extractBool(const char* json, const char* key, bool* out) {
  const char* v = nullptr;
  if (!jsonFindValue(json, key, &v)) return false;
  if (strncmp(v, "true", 4) == 0) { *out = true; return true; }
  if (strncmp(v, "false", 5) == 0) { *out = false; return true; }
  return false;
}

size_t DualStageController::paramsJson(char* buf, size_t bufSize) const {
  if (!buf || bufSize == 0) return 0;
  const int n = snprintf(buf, bufSize,
                         "{\"setpoint\":%.4f,\"heatDiff\":%.4f,\"coolDiff\":%.4f,"
                         "\"coolMinOnMs\":%u,\"coolMinOffMs\":%u,\"changeoverMs\":%u,"
                         "\"sensor\":\"%s\",\"heatActuator\":\"%s\","
                         "\"coolActuator\":\"%s\",\"enabled\":%s,"
                         "\"heatOut\":%.4f,\"coolOut\":%.4f}",
                         setpoint_, heatDiff_, coolDiff_,
                         static_cast<unsigned>(coolMinOnMs_),
                         static_cast<unsigned>(coolMinOffMs_),
                         static_cast<unsigned>(changeoverMs_),
                         sensor_->id(),
                         heat_ ? heat_->id() : "",
                         cool_ ? cool_->id() : "",
                         enabled() ? "true" : "false",
                         heatOut(), coolOut());
  if (n < 0 || static_cast<size_t>(n) >= bufSize) return 0;
  return static_cast<size_t>(n);
}

bool DualStageController::setParamsJson(const char* json) {
  if (!json) return false;
  float f = 0.0f;
  if (extractFloat(json, "setpoint", &f)) setpoint_ = f;
  float hd = heatDiff_, cd = coolDiff_;
  bool diffChanged = false;
  if (extractFloat(json, "heatDiff", &f)) { hd = f; diffChanged = true; }
  if (extractFloat(json, "coolDiff", &f)) { cd = f; diffChanged = true; }
  if (diffChanged) setDifferentials(hd, cd);
  uint32_t u = 0;
  uint32_t mon = coolMinOnMs_, moff = coolMinOffMs_;
  bool cycleChanged = false;
  if (extractU32(json, "coolMinOnMs", &u))  { mon = u;  cycleChanged = true; }
  if (extractU32(json, "coolMinOffMs", &u)) { moff = u; cycleChanged = true; }
  if (cycleChanged) setCoolCycleLimits(mon, moff);
  if (extractU32(json, "changeoverMs", &u)) changeoverMs_ = u;
  bool b = true;
  if (extractBool(json, "enabled", &b)) setEnabled(b);
  return true;
}

}  // namespace SensActCtrl
