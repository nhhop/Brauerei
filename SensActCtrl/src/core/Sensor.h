#pragma once

#include "Reading.h"
#include "SensorMeta.h"

namespace SensActCtrl {

// Sensor interface. Subclasses implement read/tick; tick() is called from
// Registry::tick() (Sensors-first phase) and is responsible for driving any
// asynchronous read state machines (e.g. DS18B20 conversion timing).
//
// Contract:
//   - id() returns a stable string for lookup / publication. Never null.
//   - meta() returns a SensorMeta whose fields point at storage that
//     outlives the sensor (typically string literals).
//   - lastReading() returns the most recent reading produced by tick().
//     Until a valid read has occurred, valid=false.
//   - read() returns the same reading and may optionally force a refresh;
//     simple sensors can simply return lastReading().
class Sensor {
 public:
  virtual ~Sensor() = default;

  virtual const char* id() const = 0;
  virtual SensorMeta meta() const = 0;

  virtual void begin() {}
  virtual void end() {}
  virtual void tick() = 0;
  virtual Reading read() { return lastReading(); }
  virtual Reading lastReading() const = 0;
};

}  // namespace SensActCtrl
