#include "RemoteSensor.h"

#include "MetaJson.h"
#include "Topics.h"

namespace SensActCtrl {

RemoteSensor::RemoteSensor(ITransport& transport, const char* deviceId,
                           const char* sensorId, const char* channelKey)
    : transport_(&transport),
      deviceId_(deviceId),
      sensorId_(sensorId),
      channelKey_(channelKey) {}

void RemoteSensor::begin() {
  const char* pfx = prefix_.c_str();
  const char* d   = deviceId_.c_str();
  const char* id  = sensorId_.c_str();
  if (channelKey_.empty()) {
    stateTopic_ = remote::sensorState(d, id, pfx);
    metaTopic_  = remote::sensorMeta(d, id, pfx);
  } else {
    stateTopic_ = remote::sensorChannelState(d, id, channelKey_.c_str(), pfx);
    metaTopic_  = remote::sensorChannelMeta(d, id, channelKey_.c_str(), pfx);
  }
  transport_->subscribe(metaTopic_.c_str(),
      [this](const char*, const char* p, size_t n) { onMeta(p, n); });
  transport_->subscribe(stateTopic_.c_str(),
      [this](const char*, const char* p, size_t n) { onState(p, n); });
}

void RemoteSensor::onState(const char* payload, size_t /*length*/) {
  remote::parseState(payload, last_.value, last_.timestampMs, last_.valid);
}

void RemoteSensor::onMeta(const char* payload, size_t /*length*/) {
  remote::parseSensorMeta(payload, meta_, unitStorage_);
}

}  // namespace SensActCtrl
