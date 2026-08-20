#pragma once

#include <stddef.h>
#include <string>

#include "core/Quantity.h"
#include "core/Sensor.h"
#include "core/SensorMeta.h"
#include "transport/ITransport.h"

namespace SensActCtrl {

// Sensor that subscribes to an arbitrary, user-configured MQTT topic instead
// of the fixed device/id scheme RemoteSensor uses — meant for reading
// third-party MQTT devices (e.g. a Zigbee2MQTT/Tasmota sensor), not another
// SensActCtrl node. Read-only: no meta publish, no state feedback beyond the
// payload itself.
//
// Payload parsing: if jsonField is empty, the payload is parsed as a raw
// number ("23.5"). If jsonField is set, the payload is parsed as a JSON
// object and the named top-level field is read as a number
// ({"temperature":23.5,...}, jsonField="temperature"). A malformed or
// unparsable payload is silently ignored — the previous reading (or the
// still-invalid initial one) is kept, mirroring RemoteSensor's tolerance of
// bad messages.
class MqttGenericSensor : public Sensor {
 public:
  MqttGenericSensor(const char* id, ITransport& transport, const char* topic,
                    Quantity quantity, const char* unit, float min, float max,
                    float resolution, const char* jsonField = "");

  const char* id() const override { return id_; }
  size_t channelCount() const override { return 1; }
  Channel channel(size_t) const override { return {"", meta_, reading_}; }

  void begin() override;
  void tick() override {}
  // Reuses the transport's own connection state — same status this sensor's
  // inbound broker already surfaces elsewhere (MqttService on BrewControl).
  const char* fault() const override;

 private:
  void onMessage(const char* payload, size_t length);

  const char* id_;
  ITransport* transport_;
  std::string topic_;
  std::string jsonField_;
  std::string unitStorage_;
  SensorMeta meta_;
  Reading reading_;
};

// Extracts a float from payload — a raw number if jsonField is empty,
// otherwise the named top-level field of a JSON object. Returns false if the
// payload can't be parsed that way (value is left untouched).
bool parseMqttSensorPayload(const char* payload, const char* jsonField,
                            float& value);

}  // namespace SensActCtrl
