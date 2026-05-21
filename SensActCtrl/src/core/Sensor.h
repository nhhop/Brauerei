#pragma once
#include "Channel.h"

namespace SensActCtrl {

// Sensor interface. tick() is called from Registry::tick() and drives any
// asynchronous read state machines.
//
// Every sensor exposes 1..N channels. Single-value sensors return
// channelCount()=1 with key="". Multi-channel sensors (YF-S201, DHT-11, …)
// return > 1 channels with short keys like "rate" / "volume".
class Sensor {
 public:
  virtual ~Sensor() = default;

  virtual const char* id()                const = 0;
  virtual size_t      channelCount()      const = 0;
  virtual Channel     channel(size_t idx) const = 0;

  virtual void begin() {}
  virtual void end()   {}
  virtual void tick()  = 0;
};

}  // namespace SensActCtrl
