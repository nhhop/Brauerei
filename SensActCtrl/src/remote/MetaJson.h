#pragma once

#include <stddef.h>
#include <string>

#include "core/ActuatorMeta.h"
#include "core/Quantity.h"
#include "core/SensorMeta.h"
#include "core/ValueKind.h"

namespace SensActCtrl {
namespace remote {

// Wire format helpers. Serialization writes the same shape that RemoteSensor /
// RemoteActuator expect on the other side:
//   Meta:  {"kind":"Continuous","quantity":"Temperature","unit":"°C","min":-55,"max":125,"res":0.0625}
//   State: {"v":65.4,"t":12345,"ok":true}
// JSON output is appended to a caller-provided char buffer; functions return
// the number of bytes written excluding the null terminator (0 on failure).

size_t serializeSensorMeta(const SensorMeta& m, char* buf, size_t cap);
size_t serializeActuatorMeta(const ActuatorMeta& m, char* buf, size_t cap);
size_t serializeState(float value, uint32_t timestampMs, bool ok,
                      char* buf, size_t cap);
size_t serializeSetCommand(float value, char* buf, size_t cap);

// Parsers mutate `out` in place. `unitOut` receives the unit string (caller
// owns the storage so meta.unit can point at .c_str()). Returns true on
// success — false on invalid JSON.
bool parseSensorMeta(const char* json, SensorMeta& out, std::string& unitOut);
bool parseActuatorMeta(const char* json, ActuatorMeta& out, std::string& unitOut);

// State payload: extracts value/timestamp/valid. Returns true on success.
bool parseState(const char* json, float& value, uint32_t& timestampMs, bool& ok);
bool parseSetCommand(const char* json, float& value);

ValueKind parseValueKind(const char* s);
Quantity parseQuantity(const char* s);

}  // namespace remote
}  // namespace SensActCtrl
