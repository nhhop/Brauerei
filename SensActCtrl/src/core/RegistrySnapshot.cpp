#include "RegistrySnapshot.h"

#include <ArduinoJson.h>

#include "Actuator.h"
#include "Controller.h"
#include "Quantity.h"
#include "Registry.h"
#include "Sensor.h"
#include "ValueKind.h"

#if defined(ARDUINO)
  #include <Arduino.h>
#else
  // Native tests don't carry a millis() — actuator state-timestamps fall back
  // to 0 (consistent with the RemotePublisher native fallback).
  static uint32_t millis() { return 0; }
#endif

namespace SensActCtrl {

namespace {

template <typename Meta>
void writeMeta(JsonObject obj, const Meta& m) {
  obj["kind"]     = toString(m.kind);
  obj["quantity"] = toString(m.quantity);
  obj["unit"]     = m.unit ? m.unit : "";
  obj["min"]      = m.min;
  obj["max"]      = m.max;
  obj["res"]      = m.resolution;
}

}  // namespace

size_t serializeRegistry(const Registry& reg, char* buf, size_t cap) {
  if (!buf || cap == 0) return 0;

  JsonDocument doc;

  JsonArray sensorsArr = doc["sensors"].to<JsonArray>();
  for (Sensor* s : reg.sensors()) {
    JsonObject obj = sensorsArr.add<JsonObject>();
    obj["id"] = s->id();
    writeMeta(obj["meta"].to<JsonObject>(), s->meta());

    const Reading r = s->lastReading();
    JsonObject state = obj["state"].to<JsonObject>();
    state["v"]  = r.value;
    state["t"]  = r.timestampMs;
    state["ok"] = r.valid;
  }

  JsonArray actuatorsArr = doc["actuators"].to<JsonArray>();
  for (Actuator* a : reg.actuators()) {
    JsonObject obj = actuatorsArr.add<JsonObject>();
    obj["id"] = a->id();
    writeMeta(obj["meta"].to<JsonObject>(), a->meta());

    JsonObject state = obj["state"].to<JsonObject>();
    state["v"]  = a->state();
    state["t"]  = millis();
    state["ok"] = true;
  }

  JsonArray ctrlArr = doc["controllers"].to<JsonArray>();
  for (Controller* c : reg.controllers()) {
    JsonObject obj = ctrlArr.add<JsonObject>();
    obj["id"]       = c->id();
    obj["setpoint"] = c->setpoint();

    char paramsBuf[256];
    const size_t plen = c->paramsJson(paramsBuf, sizeof(paramsBuf));
    if (plen > 0) {
      JsonDocument paramsDoc;
      if (deserializeJson(paramsDoc, paramsBuf) == DeserializationError::Ok) {
        obj["params"] = paramsDoc;
      }
    }
  }

  // Reject up-front if the buffer can't hold the whole document plus the
  // null terminator — callers should never read truncated JSON.
  if (measureJson(doc) + 1 > cap) return 0;
  return serializeJson(doc, buf, cap);
}

}  // namespace SensActCtrl
