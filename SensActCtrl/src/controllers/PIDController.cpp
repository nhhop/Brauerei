#include "PIDController.h"

#include "detail/PidEngine.h"

#include <stdio.h>
#include <string.h>
#include <stdlib.h>
#include <math.h>

#if defined(ARDUINO)
  #include <Arduino.h>
#else
  #include <stdint.h>
  static uint32_t millis() {
    // Native tests don't need a real wall clock; rate-limiting is exercised
    // with explicit dt via the simple-PID code path below.
    static uint32_t fake = 0;
    fake += 100;
    return fake;
  }
#endif

namespace SensActCtrl {

// ---------------------------------------------------------------------------
// PIDController
// ---------------------------------------------------------------------------

PIDController::PIDController(const char* id, Sensor& sensor, Actuator& actuator,
                             float minOutput, float maxOutput)
    : id_(id),
      sensor_(&sensor),
      actuator_(&actuator),
      engine_(new detail::PidEngine(minOutput, maxOutput)),
      minOutput_(minOutput),
      maxOutput_(maxOutput) {}

PIDController::~PIDController() { delete engine_; }

void PIDController::begin() {
  engine_->setSetpoint(setpoint_);
  engine_->setManualGains(kp_, ki_, kd_);
}

void PIDController::setSetpoint(float sp) {
  setpoint_ = sp;
  engine_->setSetpoint(sp);
}

void PIDController::setTunings(float kp, float ki, float kd) {
  kp_ = kp; ki_ = ki; kd_ = kd;
  engine_->setManualGains(kp, ki, kd);
}

void PIDController::enableInputFilter(float alpha) {
  engine_->enableInputFilter(alpha);
}

void PIDController::enableOutputFilter(float alpha) {
  engine_->enableOutputFilter(alpha);
}

void PIDController::enableAntiWindup(bool enable, float threshold) {
  engine_->enableAntiWindup(enable, threshold);
}

void PIDController::autotune(TuningMethod method) {
  tuningMethod_ = method;
  autotuneStarted_ = true;
  autotuneCompleted_ = false;
  engine_->startAutotune(method);
}

void PIDController::stopAutotune() {
  if (!autotuneStarted_) return;  // idempotent — kein laufender Vorgang
  autotuneStarted_ = false;
  autotuneCompleted_ = false;
  engine_->setManualGains(kp_, ki_, kd_);  // Backend → Normal-Modus mit letzten Gains
}

bool PIDController::isAutotuneRunning() const {
  return autotuneStarted_ && !autotuneCompleted_ && engine_->isTuneMode();
}

bool PIDController::isAutotuneDone() const {
  return autotuneStarted_ && autotuneCompleted_;
}

void PIDController::tick() {
  if (!enabled()) return;
  const uint32_t now = millis();
  const uint32_t elapsed = (lastTickMs_ == 0) ? 100 : (now - lastTickMs_);
  // AutoTunePID's contract: don't call update() faster than every 100 ms.
  if (lastTickMs_ != 0 && elapsed < 100) return;

  const Reading r = sensor_->channel(0).reading;
  if (!r.valid) { lastTickMs_ = now; return; }

  // Detect autotune completion: started + backend left Tune mode → done.
  if (autotuneStarted_ && !autotuneCompleted_ && !engine_->isTuneMode()) {
    autotuneCompleted_ = true;
    syncFromBackend();
  }

  const float dtSec = static_cast<float>(elapsed) / 1000.0f;
  const float out = engine_->update(r.value, dtSec);
  actuator_->write(out);
  lastTickMs_ = now;
}

void PIDController::syncFromBackend() {
  engine_->readGains(&kp_, &ki_, &kd_, &ku_, &tu_);
}

// ---------------------------------------------------------------------------
// JSON serialization — hand-rolled for the flat {"k":v,...} shape so the
// controller stays decoupled from ArduinoJson.
// ---------------------------------------------------------------------------

static const char* tuningMethodName(TuningMethod m) {
  switch (m) {
    case TuningMethod::ZieglerNichols: return "ZieglerNichols";
    case TuningMethod::CohenCoon:      return "CohenCoon";
    case TuningMethod::IMC:            return "IMC";
    case TuningMethod::TyreusLuyben:   return "TyreusLuyben";
    case TuningMethod::LambdaTuning:   return "LambdaTuning";
  }
  return "ZieglerNichols";
}

static bool parseTuningMethod(const char* s, size_t len, TuningMethod* out) {
  auto match = [&](const char* lit) {
    return strlen(lit) == len && strncmp(s, lit, len) == 0;
  };
  if (match("ZieglerNichols")) { *out = TuningMethod::ZieglerNichols; return true; }
  if (match("CohenCoon"))      { *out = TuningMethod::CohenCoon;      return true; }
  if (match("IMC"))            { *out = TuningMethod::IMC;            return true; }
  if (match("TyreusLuyben"))   { *out = TuningMethod::TyreusLuyben;   return true; }
  if (match("LambdaTuning"))   { *out = TuningMethod::LambdaTuning;   return true; }
  return false;
}

static bool jsonFindKey(const char* json, const char* key,
                        const char** valueStart) {
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
      *valueStart = v;
      return true;
    }
    p = kend + 1;
  }
  return false;
}

static bool extractFloat(const char* json, const char* key, float* out) {
  const char* v = nullptr;
  if (!jsonFindKey(json, key, &v)) return false;
  *out = static_cast<float>(strtod(v, nullptr));
  return true;
}

static bool extractBool(const char* json, const char* key, bool* out) {
  const char* v = nullptr;
  if (!jsonFindKey(json, key, &v)) return false;
  if (strncmp(v, "true", 4) == 0)  { *out = true;  return true; }
  if (strncmp(v, "false", 5) == 0) { *out = false; return true; }
  return false;
}

static bool extractString(const char* json, const char* key,
                          const char** valOut, size_t* lenOut) {
  const char* v = nullptr;
  if (!jsonFindKey(json, key, &v)) return false;
  if (*v != '"') return false;
  const char* start = v + 1;
  const char* end = strchr(start, '"');
  if (!end) return false;
  *valOut = start;
  *lenOut = static_cast<size_t>(end - start);
  return true;
}

size_t PIDController::paramsJson(char* buf, size_t bufSize) const {
  if (!buf || bufSize == 0) return 0;
  const char* state = autotuneCompleted_ ? "done"
                       : autotuneStarted_ ? "running" : "idle";
  const int n = snprintf(buf, bufSize,
                         "{\"setpoint\":%.4f,\"Kp\":%.4f,\"Ki\":%.4f,"
                         "\"Kd\":%.4f,\"Ku\":%.4f,\"Tu\":%.4f,"
                         "\"min\":%.4f,\"max\":%.4f,"
                         "\"sensor\":\"%s\",\"actuator\":\"%s\","
                         "\"enabled\":%s,"
                         "\"autotuneMethod\":\"%s\","
                         "\"autotuneState\":\"%s\"}",
                         setpoint_, kp_, ki_, kd_, ku_, tu_,
                         minOutput_, maxOutput_,
                         sensor_->id(), actuator_->id(),
                         enabled() ? "true" : "false",
                         tuningMethodName(tuningMethod_), state);
  if (n < 0 || static_cast<size_t>(n) >= bufSize) return 0;
  return static_cast<size_t>(n);
}

bool PIDController::setParamsJson(const char* json) {
  if (!json) return false;
  float f = 0.0f;
  bool gainsChanged = false;
  if (extractFloat(json, "setpoint", &f)) setSetpoint(f);
  if (extractFloat(json, "Kp", &f)) { kp_ = f; gainsChanged = true; }
  if (extractFloat(json, "Ki", &f)) { ki_ = f; gainsChanged = true; }
  if (extractFloat(json, "Kd", &f)) { kd_ = f; gainsChanged = true; }
  if (gainsChanged) engine_->setManualGains(kp_, ki_, kd_);

  const char* mStr = nullptr;
  size_t mLen = 0;
  if (extractString(json, "autotuneMethod", &mStr, &mLen)) {
    TuningMethod tm;
    if (parseTuningMethod(mStr, mLen, &tm)) tuningMethod_ = tm;
  }
  // min/max are construction-time only; ignored on parse.
  bool b = true;
  if (extractBool(json, "enabled", &b)) setEnabled(b);

  const char* aStr = nullptr;
  size_t aLen = 0;
  if (extractString(json, "autotune", &aStr, &aLen)) {
    if (aLen == 5 && strncmp(aStr, "start", 5) == 0) {
      setEnabled(true);            // AutoTune braucht einen tickenden Regler
      autotune(tuningMethod_);     // tuningMethod_ wurde oben ggf. aktualisiert
    } else if (aLen == 4 && strncmp(aStr, "stop", 4) == 0) {
      stopAutotune();
    }
  }
  return true;
}

}  // namespace SensActCtrl
