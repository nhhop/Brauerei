#include "PIDController.h"

#include <stdio.h>
#include <string.h>
#include <stdlib.h>
#include <math.h>

// Backend selection: on Arduino targets we wrap AutoTunePID; on the native
// test environment we fall back to a small handwritten PID with the same
// external API so paramsJson and basic step-response tests stay portable.
// AutoTune itself is hardware-tested per the project plan.
#if defined(ARDUINO)
  #include <Arduino.h>
  #include <AutoTunePID.h>
  #define BC_USE_AUTOTUNEPID 1
#else
  #include <stdint.h>
  #define BC_USE_AUTOTUNEPID 0
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
// Backend implementation
// ---------------------------------------------------------------------------

class PIDController::Impl {
 public:
  Impl(float minOutput, float maxOutput)
      :
#if BC_USE_AUTOTUNEPID
        backend_(minOutput, maxOutput,
                 ::TuningMethod::ZieglerNichols),
#endif
        minOutput_(minOutput),
        maxOutput_(maxOutput) {}

  void setSetpoint(float sp) {
    setpoint_ = sp;
#if BC_USE_AUTOTUNEPID
    backend_.setSetpoint(sp);
#endif
  }

  void setManualGains(float kp, float ki, float kd) {
    kp_ = kp; ki_ = ki; kd_ = kd;
#if BC_USE_AUTOTUNEPID
    backend_.setManualGains(kp, ki, kd);
    backend_.setOperationalMode(::OperationalMode::Normal);
#endif
  }

  void enableInputFilter(float alpha) {
#if BC_USE_AUTOTUNEPID
    backend_.enableInputFilter(alpha);
#else
    (void)alpha;
#endif
  }

  void enableOutputFilter(float alpha) {
#if BC_USE_AUTOTUNEPID
    backend_.enableOutputFilter(alpha);
#else
    (void)alpha;
#endif
  }

  void enableAntiWindup(bool enable, float threshold) {
#if BC_USE_AUTOTUNEPID
    backend_.enableAntiWindup(enable, threshold);
#else
    antiWindupEnabled_ = enable;
    antiWindupThreshold_ = threshold;
#endif
  }

  void startAutotune(TuningMethod method) {
#if BC_USE_AUTOTUNEPID
    ::TuningMethod m = ::TuningMethod::ZieglerNichols;
    switch (method) {
      case TuningMethod::ZieglerNichols: m = ::TuningMethod::ZieglerNichols; break;
      case TuningMethod::CohenCoon:      m = ::TuningMethod::CohenCoon; break;
      case TuningMethod::IMC:            m = ::TuningMethod::IMC; break;
      case TuningMethod::TyreusLuyben:   m = ::TuningMethod::TyreusLuyben; break;
      case TuningMethod::LambdaTuning:   m = ::TuningMethod::LambdaTuning; break;
    }
    backend_.setTuningMethod(m);
    backend_.setOperationalMode(::OperationalMode::Tune);
#else
    (void)method;  // native: no-op, autotune is hardware-only
#endif
  }

  bool isTuneMode() const {
#if BC_USE_AUTOTUNEPID
    return backend_.getOperationalMode() == ::OperationalMode::Tune;
#else
    return false;
#endif
  }

  // Single PID update. Caller must throttle to >= 100 ms; we just compute.
  // Returns output in [minOutput, maxOutput].
  float update(float input, float dtSeconds) {
#if BC_USE_AUTOTUNEPID
    (void)dtSeconds;
    backend_.update(input);
    return backend_.getOutput();
#else
    // Simple positional PID with clamping anti-windup.
    if (dtSeconds <= 0.0f) dtSeconds = 0.1f;
    const float error = setpoint_ - input;
    const float deriv = (error - lastError_) / dtSeconds;
    float candidate = kp_ * error + ki_ * integral_ + ki_ * error * dtSeconds
                       + kd_ * deriv;
    // Tentatively integrate, then conditionally hold if clipping would
    // push the integrator further past saturation (classic clamping).
    float trial = integral_ + error * dtSeconds;
    float trialOut = kp_ * error + ki_ * trial + kd_ * deriv;
    if (trialOut > maxOutput_ && error > 0.0f) {
      // saturating high while error pushes up — hold integral
    } else if (trialOut < minOutput_ && error < 0.0f) {
      // saturating low while error pushes down — hold integral
    } else {
      integral_ = trial;
    }
    float output = kp_ * error + ki_ * integral_ + kd_ * deriv;
    if (output > maxOutput_) output = maxOutput_;
    if (output < minOutput_) output = minOutput_;
    lastError_ = error;
    (void)candidate;
    return output;
#endif
  }

  // Pull gains from backend (e.g. after autotune).
  void readGains(float* kp, float* ki, float* kd, float* ku, float* tu) {
#if BC_USE_AUTOTUNEPID
    *kp = backend_.getKp();
    *ki = backend_.getKi();
    *kd = backend_.getKd();
    *ku = backend_.getKu();
    *tu = backend_.getTu();
    kp_ = *kp; ki_ = *ki; kd_ = *kd;
#else
    *kp = kp_; *ki = ki_; *kd = kd_;
    *ku = 0.0f; *tu = 0.0f;
#endif
  }

 private:
#if BC_USE_AUTOTUNEPID
  AutoTunePID backend_;
#endif
  float minOutput_;
  float maxOutput_;
  float setpoint_ = 0.0f;
  float kp_ = 0.0f;
  float ki_ = 0.0f;
  float kd_ = 0.0f;
#if !BC_USE_AUTOTUNEPID
  float integral_ = 0.0f;
  float lastError_ = 0.0f;
  bool antiWindupEnabled_ = false;
  float antiWindupThreshold_ = 0.8f;
#endif
};

// ---------------------------------------------------------------------------
// PIDController
// ---------------------------------------------------------------------------

PIDController::PIDController(const char* id, Sensor& sensor, Actuator& actuator,
                             float minOutput, float maxOutput)
    : id_(id),
      sensor_(&sensor),
      actuator_(&actuator),
      impl_(new Impl(minOutput, maxOutput)),
      minOutput_(minOutput),
      maxOutput_(maxOutput) {}

PIDController::~PIDController() { delete impl_; }

void PIDController::begin() {
  impl_->setSetpoint(setpoint_);
  impl_->setManualGains(kp_, ki_, kd_);
}

void PIDController::setSetpoint(float sp) {
  setpoint_ = sp;
  impl_->setSetpoint(sp);
}

void PIDController::setTunings(float kp, float ki, float kd) {
  kp_ = kp; ki_ = ki; kd_ = kd;
  impl_->setManualGains(kp, ki, kd);
}

void PIDController::enableInputFilter(float alpha) {
  impl_->enableInputFilter(alpha);
}

void PIDController::enableOutputFilter(float alpha) {
  impl_->enableOutputFilter(alpha);
}

void PIDController::enableAntiWindup(bool enable, float threshold) {
  impl_->enableAntiWindup(enable, threshold);
}

void PIDController::autotune(TuningMethod method) {
  tuningMethod_ = method;
  autotuneStarted_ = true;
  autotuneCompleted_ = false;
  impl_->startAutotune(method);
}

bool PIDController::isAutotuneRunning() const {
  return autotuneStarted_ && !autotuneCompleted_ && impl_->isTuneMode();
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
  if (autotuneStarted_ && !autotuneCompleted_ && !impl_->isTuneMode()) {
    autotuneCompleted_ = true;
    syncFromBackend();
  }

  const float dtSec = static_cast<float>(elapsed) / 1000.0f;
  const float out = impl_->update(r.value, dtSec);
  actuator_->write(out);
  lastTickMs_ = now;
}

void PIDController::syncFromBackend() {
  impl_->readGains(&kp_, &ki_, &kd_, &ku_, &tu_);
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
  if (gainsChanged) impl_->setManualGains(kp_, ki_, kd_);

  const char* mStr = nullptr;
  size_t mLen = 0;
  if (extractString(json, "autotuneMethod", &mStr, &mLen)) {
    TuningMethod tm;
    if (parseTuningMethod(mStr, mLen, &tm)) tuningMethod_ = tm;
  }
  // min/max are construction-time only; ignored on parse.
  bool b = true;
  if (extractBool(json, "enabled", &b)) setEnabled(b);
  return true;
}

}  // namespace SensActCtrl
