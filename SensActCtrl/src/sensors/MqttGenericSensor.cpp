#include "MqttGenericSensor.h"

#include <ArduinoJson.h>
#include <stdlib.h>

#if defined(ARDUINO)
  #include <Arduino.h>
#else
  static uint32_t millis() { return 0; }
#endif

namespace SensActCtrl {

bool parseMqttSensorPayload(const char* payload, const char* jsonField,
                            float& value) {
  if (!payload) return false;

  if (!jsonField || !jsonField[0]) {
    char* end = nullptr;
    float v = strtof(payload, &end);
    if (end == payload) return false;  // no digits consumed
    value = v;
    return true;
  }

  JsonDocument doc;
  if (deserializeJson(doc, payload)) return false;
  auto field = doc[jsonField];
  if (field.isNull()) return false;
  value = field.as<float>();
  return true;
}

MqttGenericSensor::MqttGenericSensor(const char* id, ITransport& transport,
                                     const char* topic, Quantity quantity,
                                     const char* unit, float min, float max,
                                     float resolution, const char* jsonField)
    : id_(id),
      transport_(&transport),
      topic_(topic),
      jsonField_(jsonField ? jsonField : ""),
      unitStorage_(unit ? unit : "") {
  meta_ = SensorMeta{ValueKind::Continuous, quantity, unitStorage_.c_str(),
                     min, max, resolution};
}

void MqttGenericSensor::begin() {
  transport_->subscribe(topic_.c_str(),
      [this](const char*, const char* p, size_t n) { onMessage(p, n); });
}

void MqttGenericSensor::onMessage(const char* payload, size_t /*length*/) {
  float v;
  if (parseMqttSensorPayload(payload, jsonField_.c_str(), v)) {
    reading_ = Reading{v, millis(), true};
  }
}

const char* MqttGenericSensor::fault() const {
  if (transport_->connected()) return nullptr;
  const char* err = transport_->lastErrorMessage();
  return err[0] ? err : "MQTT nicht verbunden";
}

}  // namespace SensActCtrl
