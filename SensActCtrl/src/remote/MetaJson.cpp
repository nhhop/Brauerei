#include "MetaJson.h"

#include <ArduinoJson.h>

namespace SensActCtrl {
namespace remote {

ValueKind parseValueKind(const char* s) {
  if (!s) return ValueKind::Continuous;
  std::string k(s);
  if (k == "Binary")     return ValueKind::Binary;
  if (k == "Discrete")   return ValueKind::Discrete;
  if (k == "Cumulative") return ValueKind::Cumulative;
  return ValueKind::Continuous;
}

Quantity parseQuantity(const char* s) {
  if (!s) return Quantity::None;
  std::string q(s);
  if (q == "Temperature") return Quantity::Temperature;
  if (q == "Humidity")    return Quantity::Humidity;
  if (q == "Pressure")    return Quantity::Pressure;
  if (q == "pH")          return Quantity::pH;
  if (q == "Voltage")     return Quantity::Voltage;
  if (q == "Current")     return Quantity::Current;
  if (q == "Power")       return Quantity::Power;
  if (q == "Energy")      return Quantity::Energy;
  if (q == "Mass")        return Quantity::Mass;
  if (q == "Volume")      return Quantity::Volume;
  if (q == "FlowRate")    return Quantity::FlowRate;
  if (q == "Frequency")   return Quantity::Frequency;
  if (q == "Duration")    return Quantity::Duration;
  if (q == "DutyCycle")   return Quantity::DutyCycle;
  if (q == "Count")       return Quantity::Count;
  if (q == "Custom")      return Quantity::Custom;
  return Quantity::None;
}

namespace {

template <typename Meta>
size_t serializeMetaImpl(const Meta& m, char* buf, size_t cap) {
  JsonDocument doc;
  doc["kind"] = toString(m.kind);
  doc["quantity"] = toString(m.quantity);
  doc["unit"] = m.unit ? m.unit : "";
  doc["min"] = m.min;
  doc["max"] = m.max;
  doc["res"] = m.resolution;
  return serializeJson(doc, buf, cap);
}

template <typename Meta>
bool parseMetaImpl(const char* json, Meta& out, std::string& unitOut) {
  JsonDocument doc;
  if (deserializeJson(doc, json)) return false;
  out.kind = parseValueKind(doc["kind"].as<const char*>());
  out.quantity = parseQuantity(doc["quantity"].as<const char*>());
  unitOut = doc["unit"].is<const char*>() ? doc["unit"].as<const char*>() : "";
  out.unit = unitOut.c_str();
  out.min = doc["min"].as<float>();
  out.max = doc["max"].as<float>();
  out.resolution = doc["res"].as<float>();
  return true;
}

}  // namespace

size_t serializeSensorMeta(const SensorMeta& m, char* buf, size_t cap) {
  return serializeMetaImpl(m, buf, cap);
}

size_t serializeActuatorMeta(const ActuatorMeta& m, char* buf, size_t cap) {
  return serializeMetaImpl(m, buf, cap);
}

size_t serializeState(float value, uint32_t timestampMs, bool ok,
                      char* buf, size_t cap) {
  JsonDocument doc;
  doc["v"] = value;
  doc["t"] = timestampMs;
  doc["ok"] = ok;
  return serializeJson(doc, buf, cap);
}

size_t serializeSetCommand(float value, char* buf, size_t cap) {
  JsonDocument doc;
  doc["v"] = value;
  return serializeJson(doc, buf, cap);
}

bool parseSensorMeta(const char* json, SensorMeta& out, std::string& unitOut) {
  return parseMetaImpl(json, out, unitOut);
}

bool parseActuatorMeta(const char* json, ActuatorMeta& out, std::string& unitOut) {
  return parseMetaImpl(json, out, unitOut);
}

bool parseState(const char* json, float& value, uint32_t& timestampMs, bool& ok) {
  JsonDocument doc;
  if (deserializeJson(doc, json)) return false;
  value = doc["v"].as<float>();
  timestampMs = doc["t"].as<uint32_t>();
  ok = doc["ok"].as<bool>();
  return true;
}

bool parseSetCommand(const char* json, float& value) {
  JsonDocument doc;
  if (deserializeJson(doc, json)) return false;
  value = doc["v"].as<float>();
  return true;
}

}  // namespace remote
}  // namespace SensActCtrl
