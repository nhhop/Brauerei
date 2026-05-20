#include "RemoteSensor.h"

#include "MetaJson.h"
#include "Topics.h"

namespace SensActCtrl {

RemoteSensor::RemoteSensor(ITransport& transport, const char* deviceId,
                           const char* sensorId)
    : transport_(&transport),
      deviceId_(deviceId),
      sensorId_(sensorId),
      stateTopic_(remote::sensorState(deviceId, sensorId)),
      metaTopic_(remote::sensorMeta(deviceId, sensorId)) {}

void RemoteSensor::begin() {
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
