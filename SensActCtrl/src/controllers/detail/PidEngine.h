#pragma once

// INTERNAL HEADER — included only by controller .cpp files, never by a public
// or umbrella header. This is intentional: pulling <AutoTunePID.h> here
// (guarded by ARDUINO) does NOT leak the dependency into consumer sketches
// because no public header transitively includes this file.

#include <stdint.h>
#include "controllers/TuningMethod.h"

#if defined(ARDUINO)
  #include <AutoTunePID.h>
#endif

namespace SensActCtrl {

namespace detail {

// Geteilte PID-Compute- + AutoTune-Engine. Wrappt AutoTunePID auf Arduino;
// nativ Fallback auf einen kleinen Positional-PID mit gleichem Außenverhalten.
// Output wird auf [minOutput, maxOutput] (Konstruktor) geklemmt.
class PidEngine {
 public:
  PidEngine(float minOutput, float maxOutput);

  void  setSetpoint(float sp);
  void  setManualGains(float kp, float ki, float kd);
  void  enableInputFilter(float alpha);
  void  enableOutputFilter(float alpha);
  void  enableAntiWindup(bool enable, float threshold);
  void  startAutotune(TuningMethod method);
  bool  isTuneMode() const;
  float update(float input, float dtSeconds);
  void  readGains(float* kp, float* ki, float* kd, float* ku, float* tu);

  // AutoTune-Fortschritt. Ziel-Zyklenzahl wird aktiv über setOscillationMode()
  // konfiguriert statt aus dem Konstruktor-Default angenommen (die Lib hat
  // keinen Getter dafür). Zyklen werden über echte Ausgangs-Flanken gezählt,
  // nicht über getTu()-Änderungen (siehe .cpp: Off-by-one bei erster Kreuzung).
  int32_t autotuneOscillationSteps() const;  // tatsächlich konfigurierte Ziel-Halbwellenzahl
  int32_t autotuneObservedCycles() const;    // real erkannte Halbwellen bisher (exakt)

 private:
#if defined(ARDUINO)
  atp::AutoTunePID backend_;
#endif
  float minOutput_;
  float maxOutput_;
  float setpoint_ = 0.0f;
  float kp_ = 0.0f;
  float ki_ = 0.0f;
  float kd_ = 0.0f;
  int32_t oscillationSteps_ = 10;
  int32_t observedCycles_ = 0;
  bool  autotuneOutputPrimed_ = false;
  float lastObservedOutput_ = 0.0f;
#if !defined(ARDUINO)
  float integral_ = 0.0f;
  float lastError_ = 0.0f;
  bool  antiWindupEnabled_ = false;
  float antiWindupThreshold_ = 0.8f;
#endif
};

}  // namespace detail
}  // namespace SensActCtrl
