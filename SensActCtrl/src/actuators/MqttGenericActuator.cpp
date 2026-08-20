#include "MqttGenericActuator.h"

#include <stdio.h>
#include <string.h>

namespace SensActCtrl {

namespace {
constexpr char kPlaceholder[] = "{value}";
constexpr size_t kPlaceholderLen = sizeof(kPlaceholder) - 1;
}  // namespace

bool buildMqttPayload(const char* tmpl, float value, char* out, size_t outSize) {
  if (outSize == 0) return false;

  char valBuf[32];
  int valLen = snprintf(valBuf, sizeof(valBuf), "%g", static_cast<double>(value));
  if (valLen < 0) return false;

  size_t o = 0;
  for (const char* p = tmpl; *p;) {
    if (strncmp(p, kPlaceholder, kPlaceholderLen) == 0) {
      if (o + static_cast<size_t>(valLen) >= outSize) return false;
      memcpy(out + o, valBuf, static_cast<size_t>(valLen));
      o += static_cast<size_t>(valLen);
      p += kPlaceholderLen;
    } else {
      if (o + 1 >= outSize) return false;
      out[o++] = *p++;
    }
  }
  out[o] = '\0';
  return true;
}

MqttGenericActuator::MqttGenericActuator(const char* id, ITransport& transport,
                                         const char* topic, const char* onPayload,
                                         const char* offPayload, bool retained)
    : id_(id),
      transport_(&transport),
      topic_(topic),
      retained_(retained),
      isBinary_(true),
      onPayload_(onPayload ? onPayload : "ON"),
      offPayload_(offPayload ? offPayload : "OFF") {
  // The master switch is the on/off control here, so the value is fixed at
  // "on" and the actuator starts disabled — a boot must not flip a
  // third-party device on its own.
  target_ = 1.0f;
  enabled_ = false;
}

MqttGenericActuator::MqttGenericActuator(const char* id, ITransport& transport,
                                         const char* topic,
                                         const char* payloadTemplate, float min,
                                         float max, float resolution,
                                         const char* unit, bool retained)
    : id_(id),
      transport_(&transport),
      topic_(topic),
      retained_(retained),
      isBinary_(false),
      template_(payloadTemplate ? payloadTemplate : "{value}"),
      valueMin_(min),
      valueMax_(max),
      resolution_(resolution),
      unit_(unit ? unit : "") {}

ActuatorMeta MqttGenericActuator::meta() const {
  if (isBinary_) {
    return ActuatorMeta{ValueKind::Binary, Quantity::None, "", 0.0f, 1.0f, 1.0f};
  }
  return ActuatorMeta{ValueKind::Continuous, Quantity::Custom, unit_.c_str(),
                      valueMin_, valueMax_, resolution_};
}

void MqttGenericActuator::write(float value) {
  if (isBinary_) {
    target_ = (value != 0.0f) ? 1.0f : 0.0f;
  } else {
    if (value < valueMin_) value = valueMin_;
    if (value > valueMax_) value = valueMax_;
    target_ = value;
  }
  publishCurrent();
}

void MqttGenericActuator::publishCurrent() {
  // Single choke point — gates enabled_ before every publish, for both
  // write()-driven and applyEnabled()-driven calls, mirroring
  // DigitalOutputActuator::applyPin()/AnalogOutputActuator::applyOutput().
  const float v = enabled_ ? target_ : (isBinary_ ? 0.0f : valueMin_);
  if (isBinary_) {
    transport_->publish(topic_.c_str(),
                        (v != 0.0f) ? onPayload_.c_str() : offPayload_.c_str(),
                        retained_);
    return;
  }
  char buf[64];
  if (buildMqttPayload(template_.c_str(), v, buf, sizeof(buf))) {
    transport_->publish(topic_.c_str(), buf, retained_);
  }
}

const char* MqttGenericActuator::fault() const {
  if (transport_->connected()) return nullptr;
  const char* err = transport_->lastErrorMessage();
  return err[0] ? err : "MQTT nicht verbunden";
}

}  // namespace SensActCtrl
