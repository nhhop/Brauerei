#pragma once

#include <string>

#include "core/Sensor.h"
#include "transport/ITransport.h"

namespace SensActCtrl {

// Sensor proxy for a remote node. Subscribes (on begin()) to the publisher's
// state + meta topics. Until the first meta retained message arrives,
// meta().unit is nullptr — frontends can treat that as "not yet known".
// channel(0).reading.valid stays false until the first state message arrives.
//
// Topics built from (deviceId, sensorId) per src/remote/Topics.h.
//
// Subscribes to a single (flat-topic) channel. For multi-channel sensors,
// construct one RemoteSensor per channel using the channelKey parameter.
class RemoteSensor : public Sensor {
 public:
  RemoteSensor(ITransport& transport, const char* deviceId, const char* sensorId);

  const char* id() const override { return sensorId_.c_str(); }
  size_t  channelCount()      const override { return 1; }
  Channel channel(size_t)     const override { return {"", meta_, last_}; }

  void begin() override;
  void tick() override {}

 private:
  void onState(const char* payload, size_t length);
  void onMeta(const char* payload, size_t length);

  ITransport* transport_;
  std::string deviceId_;
  std::string sensorId_;
  std::string stateTopic_;
  std::string metaTopic_;
  std::string unitStorage_;
  SensorMeta meta_{};
  Reading last_{};
};

}  // namespace SensActCtrl
