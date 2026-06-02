#pragma once

#include <stdint.h>

#include "core/Controller.h"
#include "core/Sensor.h"
#include "core/Actuator.h"
#include "controllers/TuningMethod.h"

namespace SensActCtrl {

namespace detail { class PidEngine; }

// PID controller. Wraps AutoTunePID (lily-osp/AutoTunePID) on Arduino/ESP32
// targets; on the native test environment falls back to a small handwritten
// PID with the same external behaviour for paramsJson/step-response tests.
//
// Output range is set in the constructor (e.g. 0..1 for a TPO-SSR). The
// wrapper enforces AutoTunePID's 100 ms minimum update interval: tick()
// calls into update() at most every 100 ms regardless of how often it is
// invoked from loop().
class PIDController : public Controller {
 public:
  PIDController(const char* id, Sensor& sensor, Actuator& actuator,
                float minOutput, float maxOutput);
  ~PIDController() override;

  PIDController(const PIDController&) = delete;
  PIDController& operator=(const PIDController&) = delete;

  const char* id() const override { return id_; }

  void begin() override;
  void tick() override;

  void setSetpoint(float sp) override;
  float setpoint() const override { return setpoint_; }

  // Manual tuning. Switches the backend into manual mode and stores the
  // gains in our own state for paramsJson.
  void setTunings(float kp, float ki, float kd);
  float kp() const { return kp_; }
  float ki() const { return ki_; }
  float kd() const { return kd_; }

  // Output limits — fixed at construction; getter for inspection.
  float minOutput() const { return minOutput_; }
  float maxOutput() const { return maxOutput_; }

  // Signal/anti-windup configuration — forwarded to the backend.
  void enableInputFilter(float alpha);
  void enableOutputFilter(float alpha);
  void enableAntiWindup(bool enable, float threshold = 0.8f);

  // AutoTune.
  void autotune(TuningMethod method);
  void stopAutotune();
  bool isAutotuneRunning() const;
  bool isAutotuneDone() const;
  TuningMethod tuningMethod() const { return tuningMethod_; }
  float ku() const { return ku_; }
  float tu() const { return tu_; }

  size_t paramsJson(char* buf, size_t bufSize) const override;
  bool setParamsJson(const char* json) override;

 private:
  // Pull Kp/Ki/Kd/Ku/Tu out of the backend (e.g. after autotune) into our
  // mirrored state so paramsJson reports current values.
  void syncFromBackend();

  const char* id_;
  Sensor* sensor_;
  Actuator* actuator_;
  detail::PidEngine* engine_;

  float setpoint_ = 0.0f;
  float minOutput_;
  float maxOutput_;
  float kp_ = 0.0f;
  float ki_ = 0.0f;
  float kd_ = 0.0f;
  float ku_ = 0.0f;
  float tu_ = 0.0f;
  TuningMethod tuningMethod_ = TuningMethod::ZieglerNichols;
  bool autotuneStarted_ = false;
  bool autotuneCompleted_ = false;
  uint32_t lastTickMs_ = 0;
};

}  // namespace SensActCtrl
