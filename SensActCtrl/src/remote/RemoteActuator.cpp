#include "RemoteActuator.h"

#include "MetaJson.h"
#include "Topics.h"

namespace SensActCtrl {

RemoteActuator::RemoteActuator(ITransport& transport, const char* deviceId,
                               const char* actuatorId)
    : transport_(&transport),
      deviceId_(deviceId),
      actuatorId_(actuatorId),
      localId_(actuatorId) {}

void RemoteActuator::begin() {
  const char* pfx = prefix_.c_str();
  const char* d   = deviceId_.c_str();
  const char* id  = actuatorId_.c_str();
  stateTopic_ = remote::actuatorState(d, id, pfx);
  metaTopic_  = remote::actuatorMeta(d, id, pfx);
  setTopic_   = remote::actuatorSet(d, id, pfx);

  transport_->subscribe(metaTopic_.c_str(),
                        [this](const char*, const char* p, size_t n) { onMeta(p, n); });
  transport_->subscribe(stateTopic_.c_str(),
                        [this](const char*, const char* p, size_t n) { onState(p, n); });
}

void RemoteActuator::write(float value) {
  target_ = value;
  publishCommand(enabled_ ? value : meta_.min);
}

void RemoteActuator::applyEnabled(bool /*e*/) {
  // Going silent wouldn't turn the remote off — it would just stop hearing
  // from us and keep running. Command the off value explicitly instead.
  // Note meta_ stays default-constructed until the retained meta topic
  // arrives, so min falls back to 0.0f before then.
  publishCommand(enabled_ ? target_ : meta_.min);
}

void RemoteActuator::publishCommand(float value) {
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
