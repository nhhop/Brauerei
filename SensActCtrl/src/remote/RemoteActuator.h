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

  // Defaults to actuatorId (the remote's own id) so standalone/example usage
  // — where the local proxy is naturally named after the remote actuator —
  // needs no extra call. Consumers that assign their own local id distinct
  // from the remote's (e.g. BrewControl's DynamicItems) override it via
  // setLocalId().
  const char* id() const override { return localId_.c_str(); }
  ActuatorMeta meta() const override { return meta_; }

  void begin() override;
  void tick() override {}
  void write(float value) override;
  float target() const override { return target_; }
  // The remote's reported state, ungated — it's what the far end actually
  // does, so it stands on its own rather than being derived from enabled().
  float state() const override { return state_; }

  // Must be called before begin(). Overrides the default "sensactctrl" root.
  void setPrefix(const char* p) { prefix_ = p; }

  // Must be called before registering with a Registry — id() is read at
  // add()/find() time. Overrides the default (actuatorId).
  void setLocalId(const char* id) { localId_ = id; }

 protected:
  void applyEnabled(bool e) override;

 private:
  void publishCommand(float value);
  void onState(const char* payload, size_t length);
  void onMeta(const char* payload, size_t length);

  ITransport* transport_;
  std::string deviceId_;
  std::string actuatorId_;
  std::string localId_;
  std::string stateTopic_;
  std::string metaTopic_;
  std::string setTopic_;
  std::string unitStorage_;
  std::string prefix_ = "sensactctrl";
  ActuatorMeta meta_{};
  float state_ = 0.0f;
  float target_ = 0.0f;
};

}  // namespace SensActCtrl
