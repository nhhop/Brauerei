#include "PidEngine.h"

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

#if BC_USE_AUTOTUNEPID
// AutoTunePID (main-Branch, kein Tag — siehe SensActCtrl/library.json) hat
// keinen Getter für das intern konfigurierte oscillationSteps. setOscillationMode()
// überschreibt _oscillationSteps intern über ein eigenes Switch (Normal=10/
// Half=20/Mild=40) — dieses Mapping wird hier gespiegelt, damit unser
// getrackter Wert exakt dem entspricht, was wir der Engine selbst vorgeben.
static constexpr atp::OscillationMode kAutotuneOscillationMode = atp::OscillationMode::Normal;

static int32_t oscillationStepsForMode(atp::OscillationMode mode) {
  switch (mode) {
    case atp::OscillationMode::Normal: return 10;
    case atp::OscillationMode::Half:   return 20;
    case atp::OscillationMode::Mild:   return 40;
  }
  return 10;
}
#endif

PidEngine::PidEngine(float minOutput, float maxOutput)
    :
#if BC_USE_AUTOTUNEPID
      backend_(minOutput, maxOutput, atp::TuningMethod::ZieglerNichols),
#endif
      minOutput_(minOutput),
      maxOutput_(maxOutput) {
#if BC_USE_AUTOTUNEPID
  backend_.setOscillationMode(kAutotuneOscillationMode);
  oscillationSteps_ = oscillationStepsForMode(kAutotuneOscillationMode);
#endif
}

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
  backend_.setOperationalMode(atp::OperationalMode::Normal);
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
  atp::TuningMethod m = atp::TuningMethod::ZieglerNichols;
  switch (method) {
    case TuningMethod::ZieglerNichols: m = atp::TuningMethod::ZieglerNichols; break;
    case TuningMethod::CohenCoon:      m = atp::TuningMethod::CohenCoon; break;
    case TuningMethod::IMC:            m = atp::TuningMethod::IMC; break;
    case TuningMethod::TyreusLuyben:   m = atp::TuningMethod::TyreusLuyben; break;
    case TuningMethod::LambdaTuning:   m = atp::TuningMethod::LambdaTuning; break;
  }
  backend_.setTuningMethod(m);
  observedCycles_ = 0;
  autotuneOutputPrimed_ = false;
  backend_.setOperationalMode(atp::OperationalMode::Tune);
#else
  (void)method;  // nativ: no-op, AutoTune ist hardware-only
#endif
}

bool PidEngine::isTuneMode() const {
#if BC_USE_AUTOTUNEPID
  return backend_.getOperationalMode() == atp::OperationalMode::Tune;
#else
  return false;
#endif
}

float PidEngine::update(float input, float dtSeconds) {
#if BC_USE_AUTOTUNEPID
  (void)dtSeconds;
  // Tune-Status VOR dem Update erfassen: bei der letzten Kreuzung ändert die
  // Engine Ausgang und Modus atomar im selben Aufruf — ein Check danach würde
  // die letzte Kreuzung verpassen.
  const bool wasTuning = isTuneMode();
  backend_.update(input);
  if (wasTuning) {
    const float out = backend_.getOutput();
    if (!autotuneOutputPrimed_) {
      lastObservedOutput_ = out;  // erster Tick nach Start = Baseline, keine echte Flanke
      autotuneOutputPrimed_ = true;
    } else if (out != lastObservedOutput_) {
      lastObservedOutput_ = out;
      observedCycles_++;
    }
  }
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

int32_t PidEngine::autotuneOscillationSteps() const { return oscillationSteps_; }

int32_t PidEngine::autotuneObservedCycles() const { return observedCycles_; }

}  // namespace detail
}  // namespace SensActCtrl
