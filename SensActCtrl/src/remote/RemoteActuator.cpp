#include "RemoteActuator.h"

#include "MetaJson.h"
#include "Topics.h"

namespace SensActCtrl {

RemoteActuator::RemoteActuator(ITransport& transport, const char* deviceId,
                               const char* actuatorId)
    : transport_(&transport),
      deviceId_(deviceId),
      actuatorId_(actuatorId),
      stateTopic_(remote::actuatorState(deviceId, actuatorId)),
      metaTopic_(remote::actuatorMeta(deviceId, actuatorId)),
      setTopic_(remote::actuatorSet(deviceId, actuatorId)) {}

void RemoteActuator::begin() {
  transport_->subscribe(metaTopic_.c_str(),
                        [this](const char*, const char* p, size_t n) { onMeta(p, n); });
  transport_->subscribe(stateTopic_.c_str(),
                        [this](const char*, const char* p, size_t n) { onState(p, n); });
}

void RemoteActuator::write(float value) {
  char buf[64];
  size_t n = remote::serializeSetCommand(value, buf, sizeof(buf));
  if (n == 0) return;
  transport_->publish(setTopic_.c_str(), buf, /*retained=*/false);
}

void RemoteActuator::onState(const char* payload, size_t /*length*/) {
  float v;
  uint32_t t;
  bool ok;
  if (remote::parseState(payload, v, t, ok) && ok) {
    state_ = v;
  }
}

void RemoteActuator::onMeta(const char* payload, size_t /*length*/) {
  remote::parseActuatorMeta(payload, meta_, unitStorage_);
}

}  // namespace SensActCtrl
