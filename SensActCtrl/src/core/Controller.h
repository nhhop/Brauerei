#pragma once

#include <stddef.h>

namespace SensActCtrl {

// Controller interface. A controller binds one or more Sensors to one or
// more Actuators and computes a command in tick() based on the latest
// readings. Registry::tick() invokes Controllers between Sensors and
// Actuators, so a single loop()-pass already sees fresh readings turn into
// fresh actuator commands — no one-tick latency.
//
// paramsJson / setParamsJson provide a generic, frontend-agnostic way to
// serialize tunings (Kp/Ki/Kd, hysteresis, …). Subclasses also expose
// typed setters; the JSON layer exists for web frontends and remote
// transports that don't know each controller type.
//
// paramsJson:
//   buf:    output buffer (assumed non-null, size >= bufSize)
//   bufSize: capacity of buf in bytes
//   Returns number of bytes written (excluding null terminator). Returns 0
//   on failure or if buf is too small.
//
// setParamsJson:
//   json:   null-terminated JSON document with tuning fields. Unknown keys
//           are silently ignored. Returns true on parse success.
class Controller {
 public:
  virtual ~Controller() = default;

  virtual const char* id() const = 0;

  virtual void begin() {}
  virtual void end() {}
  virtual void tick() = 0;
  virtual void setSetpoint(float setpoint) = 0;
  virtual float setpoint() const = 0;

  virtual size_t paramsJson(char* buf, size_t bufSize) const = 0;
  virtual bool setParamsJson(const char* json) = 0;

  virtual void setEnabled(bool e) { enabled_ = e; }
  virtual bool enabled() const { return enabled_; }

 private:
  bool enabled_ = true;
};

}  // namespace SensActCtrl
