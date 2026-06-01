#include "SplitRangePIDController.h"

#include <stdio.h>
#include <string.h>
#include <stdlib.h>

#if defined(ARDUINO)
  #include <Arduino.h>
#else
  static uint32_t g_mockMillis = 0;
  static uint32_t millis() { return g_mockMillis; }
  namespace SensActCtrl {
    void splitRangeSetMillisForTest(uint32_t ms) { g_mockMillis = ms; }
  }
#endif

namespace SensActCtrl {

SplitRangePIDController::SplitRangePIDController(const char* id, Sensor& sensor,
                                                 Actuator* heat, Actuator* cool)
    : id_(id), sensor_(&sensor), heat_(heat), cool_(cool) {}

void SplitRangePIDController::setTunings(float kp, float ki, float kd) {
  kp_ = kp; ki_ = ki; kd_ = kd;
}

void SplitRangePIDController::setDeadband(float d) {
  deadband_ = d < 0.0f ? 0.0f : d;
}

// Positional PID with clamping anti-windup; output range fixed to [-1, +1].
float SplitRangePIDController::pidUpdate(float input, float dtSeconds) {
  if (dtSeconds <= 0.0f) dtSeconds = 0.1f;
  const float error = setpoint_ - input;
  const float deriv = (error - lastError_) / dtSeconds;
  const float trial = integral_ + error * dtSeconds;
  const float trialOut = kp_ * error + ki_ * trial + kd_ * deriv;
  // Hold the integrator if it would push further past saturation.
  if (trialOut > 1.0f && error > 0.0f) {
    // saturating high while error pushes up — hold
  } else if (trialOut < -1.0f && error < 0.0f) {
    // saturating low while error pushes down — hold
  } else {
    integral_ = trial;
  }
  float out = kp_ * error + ki_ * integral_ + kd_ * deriv;
  if (out > 1.0f) out = 1.0f;
  if (out < -1.0f) out = -1.0f;
  lastError_ = error;
  return out;
}

void SplitRangePIDController::writeOff() {
  const uint32_t now = millis();
  if (heatOn_) { heatOn_ = false; heatOffSinceMs_ = now; heatOffSeen_ = true; }
  if (coolOn_) { coolOn_ = false; coolOffSinceMs_ = now; coolOffSeen_ = true; }
  heatOut_ = 0.0f;
  coolOut_ = 0.0f;
  if (heat_) heat_->write(0.0f);
  if (cool_) cool_->write(0.0f);
}

void SplitRangePIDController::tick() {
  if (!enabled()) { writeOff(); return; }

  const Reading r = sensor_->channel(0).reading;
  if (!r.valid) { writeOff(); return; }  // fail-safe: both off on dead sensor

  const uint32_t now = millis();
  const uint32_t elapsed = started_ ? (now - lastTickMs_) : 100;
  if (started_ && elapsed < 100) return;  // throttle PID to >= 100 ms
  started_ = true;
  lastTickMs_ = now;

  const float dt = static_cast<float>(elapsed) / 1000.0f;
  const float out = pidUpdate(r.value, dt);

  float heatCmd = (out >  deadband_) ? (out > 1.0f ? 1.0f : out) : 0.0f;
  float coolCmd = (out < -deadband_) ? (-out > 1.0f ? 1.0f : -out) : 0.0f;
  bool wantHeat = heatCmd > 0.0f;
  bool wantCool = coolCmd > 0.0f;

  // Changeover dead-time: a stage may only engage once the opposite has been
  // off long enough.
  if (changeoverMs_) {
    if (wantHeat && !heatOn_ &&
        (coolOn_ || (coolOffSeen_ && (now - coolOffSinceMs_) < changeoverMs_))) {
      heatCmd = 0.0f; wantHeat = false;
    }
    if (wantCool && !coolOn_ &&
        (heatOn_ || (heatOffSeen_ && (now - heatOffSinceMs_) < changeoverMs_))) {
      coolCmd = 0.0f; wantCool = false;
    }
  }

  // Hard interlock — never both on; on contradiction fail safe to off.
  if (wantHeat && wantCool) {
    heatCmd = 0.0f; coolCmd = 0.0f; wantHeat = false; wantCool = false;
  }

  if (wantHeat != heatOn_) {
    heatOn_ = wantHeat;
    if (!heatOn_) { heatOffSinceMs_ = now; heatOffSeen_ = true; }
  }
  if (wantCool != coolOn_) {
    coolOn_ = wantCool;
    if (!coolOn_) { coolOffSinceMs_ = now; coolOffSeen_ = true; }
  }

  heatOut_ = heatCmd;
  coolOut_ = coolCmd;
  if (heat_) heat_->write(heatCmd);
  if (cool_) cool_->write(coolCmd);
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

size_t SplitRangePIDController::paramsJson(char* buf, size_t bufSize) const {
  if (!buf || bufSize == 0) return 0;
  const int n = snprintf(buf, bufSize,
                         "{\"setpoint\":%.4f,\"Kp\":%.4f,\"Ki\":%.4f,\"Kd\":%.4f,"
                         "\"deadband\":%.4f,\"changeoverMs\":%u,"
                         "\"sensor\":\"%s\",\"heatActuator\":\"%s\","
                         "\"coolActuator\":\"%s\",\"enabled\":%s,"
                         "\"heatOut\":%.4f,\"coolOut\":%.4f}",
                         setpoint_, kp_, ki_, kd_, deadband_,
                         static_cast<unsigned>(changeoverMs_),
                         sensor_->id(),
                         heat_ ? heat_->id() : "",
                         cool_ ? cool_->id() : "",
                         enabled() ? "true" : "false",
                         heatOut_, coolOut_);
  if (n < 0 || static_cast<size_t>(n) >= bufSize) return 0;
  return static_cast<size_t>(n);
}

bool SplitRangePIDController::setParamsJson(const char* json) {
  if (!json) return false;
  float f = 0.0f;
  if (extractFloat(json, "setpoint", &f)) setpoint_ = f;
  bool gainsChanged = false;
  float kp = kp_, ki = ki_, kd = kd_;
  if (extractFloat(json, "Kp", &f)) { kp = f; gainsChanged = true; }
  if (extractFloat(json, "Ki", &f)) { ki = f; gainsChanged = true; }
  if (extractFloat(json, "Kd", &f)) { kd = f; gainsChanged = true; }
  if (gainsChanged) setTunings(kp, ki, kd);
  if (extractFloat(json, "deadband", &f)) setDeadband(f);
  uint32_t u = 0;
  if (extractU32(json, "changeoverMs", &u)) changeoverMs_ = u;
  bool b = true;
  if (extractBool(json, "enabled", &b)) setEnabled(b);
  return true;
}

}  // namespace SensActCtrl
