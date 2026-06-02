#include "PidEngine.h"

#include "controllers/PIDController.h"  // vollständiges TuningMethod-Enum

#if defined(ARDUINO)
  #include <Arduino.h>
  #include <AutoTunePID.h>
  #define BC_USE_AUTOTUNEPID 1
#else
  #include <stdint.h>
  #define BC_USE_AUTOTUNEPID 0
#endif

namespace SensActCtrl {
namespace detail {

PidEngine::PidEngine(float minOutput, float maxOutput)
    :
#if BC_USE_AUTOTUNEPID
      backend_(minOutput, maxOutput, ::TuningMethod::ZieglerNichols),
#endif
      minOutput_(minOutput),
      maxOutput_(maxOutput) {}

void PidEngine::setSetpoint(float sp) {
  setpoint_ = sp;
#if BC_USE_AUTOTUNEPID
  backend_.setSetpoint(sp);
#endif
}

void PidEngine::setManualGains(float kp, float ki, float kd) {
  kp_ = kp; ki_ = ki; kd_ = kd;
#if BC_USE_AUTOTUNEPID
  backend_.setManualGains(kp, ki, kd);
  backend_.setOperationalMode(::OperationalMode::Normal);
#endif
}

void PidEngine::enableInputFilter(float alpha) {
#if BC_USE_AUTOTUNEPID
  backend_.enableInputFilter(alpha);
#else
  (void)alpha;
#endif
}

void PidEngine::enableOutputFilter(float alpha) {
#if BC_USE_AUTOTUNEPID
  backend_.enableOutputFilter(alpha);
#else
  (void)alpha;
#endif
}

void PidEngine::enableAntiWindup(bool enable, float threshold) {
#if BC_USE_AUTOTUNEPID
  backend_.enableAntiWindup(enable, threshold);
#else
  antiWindupEnabled_ = enable;
  antiWindupThreshold_ = threshold;
#endif
}

void PidEngine::startAutotune(TuningMethod method) {
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
  (void)method;  // nativ: no-op, AutoTune ist hardware-only
#endif
}

bool PidEngine::isTuneMode() const {
#if BC_USE_AUTOTUNEPID
  return backend_.getOperationalMode() == ::OperationalMode::Tune;
#else
  return false;
#endif
}

float PidEngine::update(float input, float dtSeconds) {
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

void PidEngine::readGains(float* kp, float* ki, float* kd, float* ku, float* tu) {
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

}  // namespace detail
}  // namespace SensActCtrl
