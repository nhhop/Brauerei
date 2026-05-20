#pragma once

#include <stddef.h>

namespace SensActCtrl {

class Registry;

// Serializes the full registry state into a single JSON document — intended
// as the "current state" payload that a web frontend pulls once and then
// refreshes (e.g. via polling or a server-sent event channel). Same field
// shapes as the MQTT wire format (see remote/MetaJson.cpp), so frontends
// that already speak the MQTT topics can reuse their parsers.
//
// Output shape:
//   {
//     "sensors": [
//       {"id":"mash_temp",
//        "meta": {"kind":"Continuous","quantity":"Temperature","unit":"°C","min":-55,"max":125,"res":0.0625},
//        "state": {"v":65.4,"t":12345,"ok":true}}
//     ],
//     "actuators": [
//       {"id":"heater",
//        "meta": {"kind":"Continuous","quantity":"DutyCycle","unit":"","min":0,"max":1,"res":0.01},
//        "state": {"v":0.5,"t":0,"ok":true}}
//     ],
//     "controllers": [
//       {"id":"mash_ctrl",
//        "setpoint": 65.0,
//        "params": {"Kp":2.5,"Ki":0.1,"Kd":0.0,...}}
//     ]
//   }
//
// `params` is the nested-object form of the controller's paramsJson() result
// (not a string), so frontends can address fields directly.
//
// Returns the number of bytes written (excluding the null terminator).
// Returns 0 if buf is null, cap is zero, or serialization overflows cap.
size_t serializeRegistry(const Registry& reg, char* buf, size_t cap);

}  // namespace SensActCtrl
