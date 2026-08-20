#pragma once

#include <stddef.h>
#include <string>

#include "core/Actuator.h"
#include "core/Quantity.h"
#include "core/ValueKind.h"
#include "transport/ITransport.h"

namespace SensActCtrl {

// Actuator that publishes to an arbitrary, user-configured MQTT topic instead
// of the fixed device/id scheme RemoteActuator uses — meant for driving
// third-party MQTT devices (e.g. a Tasmota/Sonoff smart plug under
// cmnd/sonoff1/POWER), not another SensActCtrl node. Write-only: no state/meta
// subscription, target() mirrors the last commanded value.
class MqttGenericActuator : public Actuator {
 public:
  // Binary: literal on/off payloads (e.g. "ON"/"OFF"). Starts armed-but-
  // disabled (target 1, enabled false), like DigitalOutputActuator's Binary
  // mode — a reboot must not switch a third-party device on by itself.
  MqttGenericActuator(const char* id, ITransport& transport, const char* topic,
                      const char* onPayload, const char* offPayload,
                      bool retained);

  // Continuous: payloadTemplate must contain the literal placeholder
  // "{value}", substituted with the commanded value formatted via "%g".
  MqttGenericActuator(const char* id, ITransport& transport, const char* topic,
                      const char* payloadTemplate, float min, float max,
                      float resolution, const char* unit, bool retained);

  const char* id() const override { return id_; }
  ActuatorMeta meta() const override;
  void tick() override {}
  void write(float value) override;
  float target() const override { return target_; }
  // Reuses the transport's own connection state — no separate publish
  // tracking, same status this actuator's outbound broker already surfaces
  // elsewhere (MqttService::connected()/lastErrorMessage() on BrewControl).
  const char* fault() const override;

 protected:
  void applyEnabled(bool /*e*/) override { publishCurrent(); }

 private:
  void publishCurrent();

  const char* id_;
  ITransport* transport_;
  std::string topic_;
  bool retained_;
  bool isBinary_;

  // Binary
  std::string onPayload_;
  std::string offPayload_;

  // Continuous
  std::string template_;
  float valueMin_ = 0.0f;
  float valueMax_ = 1.0f;
  float resolution_ = 0.01f;
  std::string unit_;

  float target_ = 0.0f;
};

// Replaces every occurrence of the literal "{value}" in tmpl with value
// (formatted via "%g"); copies tmpl verbatim if the placeholder isn't
// present. Returns false if the result doesn't fit in out[0..outSize).
bool buildMqttPayload(const char* tmpl, float value, char* out, size_t outSize);

}  // namespace SensActCtrl
