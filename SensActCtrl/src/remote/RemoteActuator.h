#pragma once

#include <string>

#include "core/Actuator.h"
#include "transport/ITransport.h"

namespace SensActCtrl {

// Actuator proxy for a remote node. write(v) publishes a command on the
// publisher's `/set` topic; meta + state arrive via the publisher's retained
// topics (subscribed in begin()). state() reports the *reported* state from
// the remote node, not the last value we tried to write — that's what the
// remote actually did.
class RemoteActuator : public Actuator {
 public:
  RemoteActuator(ITransport& transport, const char* deviceId, const char* actuatorId);

  const char* id() const override { return actuatorId_.c_str(); }
  ActuatorMeta meta() const override { return meta_; }

  void begin() override;
  void tick() override {}
  void write(float value) override;
  float state() const override { return state_; }

 private:
  void onState(const char* payload, size_t length);
  void onMeta(const char* payload, size_t length);

  ITransport* transport_;
  std::string deviceId_;
  std::string actuatorId_;
  std::string stateTopic_;
  std::string metaTopic_;
  std::string setTopic_;
  std::string unitStorage_;
  ActuatorMeta meta_{};
  float state_ = 0.0f;
};

}  // namespace SensActCtrl
