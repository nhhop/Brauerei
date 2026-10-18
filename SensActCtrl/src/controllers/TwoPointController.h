#pragma once

#include "core/Controller.h"
#include "core/Sensor.h"
#include "core/SensorRef.h"
#include "core/Actuator.h"

namespace SensActCtrl {

// Bang-bang controller with asymmetric hysteresis.
//
// Default mode is heating:
//   reading < setpoint + hysteresisLow   → actuator on  (1)
//   reading > setpoint + hysteresisHigh  → actuator off (0)
//   in between → hold previous state.
//
// hysteresisLow is typically negative (e.g. -0.5) and hysteresisHigh
// positive (+0.5), giving a deadband around the setpoint.
//
// setInverted(true) reverses the logic for cooling applications.
class TwoPointController : public Controller {
 public:
  TwoPointController(const char* id, Sensor& sensor, Actuator& actuator);

  const char* id() const override { return id_; }

  void tick() override;
  void setSetpoint(float setpoint) override { setpoint_ = setpoint; }
  float setpoint() const override { return setpoint_; }

  void setHysteresis(float low, float high) { hystLow_ = low; hystHigh_ = high; }
  float hysteresisLow() const { return hystLow_; }
  float hysteresisHigh() const { return hystHigh_; }

  // Sensor channel used as input (default 0).
  void setChannel(size_t idx) { channel_ = clampChannel(*sensor_, idx); }
  size_t channel() const { return channel_; }

  void setInverted(bool inverted) { inverted_ = inverted; }
  bool inverted() const { return inverted_; }

  size_t paramsJson(char* buf, size_t bufSize) const override;
  bool setParamsJson(const char* json) override;

 protected:
  void applyEnabled(bool e) override;

 private:
  const char* id_;
  Sensor* sensor_;
  size_t channel_ = 0;
  Actuator* actuator_;
  float setpoint_ = 0.0f;
  float hystLow_ = -0.5f;
  float hystHigh_ = 0.5f;
  bool inverted_ = false;
  bool currentlyOn_ = false;
};

}  // namespace SensActCtrl
