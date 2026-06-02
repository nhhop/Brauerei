#pragma once

#include <stdint.h>

#if defined(ARDUINO)
  #include <AutoTunePID.h>
#endif

namespace SensActCtrl {

enum class TuningMethod : uint8_t;  // vollständig definiert in controllers/PIDController.h

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

 private:
#if defined(ARDUINO)
  AutoTunePID backend_;
#endif
  float minOutput_;
  float maxOutput_;
  float setpoint_ = 0.0f;
  float kp_ = 0.0f;
  float ki_ = 0.0f;
  float kd_ = 0.0f;
#if !defined(ARDUINO)
  float integral_ = 0.0f;
  float lastError_ = 0.0f;
  bool  antiWindupEnabled_ = false;
  float antiWindupThreshold_ = 0.8f;
#endif
};

}  // namespace detail
}  // namespace SensActCtrl
