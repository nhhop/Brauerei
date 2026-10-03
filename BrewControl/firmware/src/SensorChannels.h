#pragma once

#include <ArduinoJson.h>

#include <cstddef>
#include <cstdint>
#include <cstring>
#include <string>

namespace BrewControl {

// Channel selection of multi-channel sensors ("channels": [...]) and the
// one-time migration of GY521 items from before the GY521 had channels.
// Header-only and Arduino-free like BusConfig.h, so the native tests cover
// them; DynamicItems.cpp applies them.

// Parses the optional "channels" array of a multi-channel sensor config into a
// bit mask (bit i = keys[i]). Absent → defaultMask. Returns false with err set
// on a non-array, empty array or unknown key.
inline bool parseChannelMask(JsonObjectConst cfg, const char* const* keys, size_t n,
                             uint16_t defaultMask, uint16_t& mask, const char*& err) {
  mask = defaultMask;
  if (cfg["channels"].isNull()) return true;
  JsonArrayConst arr = cfg["channels"].as<JsonArrayConst>();
  if (arr.isNull()) { err = "channels must be an array"; return false; }
  mask = 0;
  for (JsonVariantConst v : arr) {
    const char* k = v | "";
    size_t i = 0;
    while (i < n && strcmp(k, keys[i]) != 0) ++i;
    if (i == n) { err = "unknown channel"; return false; }
    mask |= static_cast<uint16_t>(1u << i);
  }
  if (!mask) { err = "channels must not be empty"; return false; }
  return true;
}

// GY521 channel keys in mask-bit order (GY521TiltSensor::kChannel*).
constexpr const char* kGy521Channels[] = {"pitch", "roll", "tilt", "temp", "ax",
                                          "ay",    "az",   "gx",   "gy",   "gz"};
constexpr size_t kGy521ChannelCount = sizeof(kGy521Channels) / sizeof(kGy521Channels[0]);

// A GY521 stored before it had channels exposed only its tilt angle (what is
// now "pitch"), keyed "" (snapshot id "<id>"). Pin "pitch" ("<id>.pitch") and
// move a calibration of "" over to it. Returns true if cfg changed; the caller
// rewrites the refs to "sensor/<id>" elsewhere.
inline bool normalizeLegacyGy521(JsonObject cfg) {
  if (strcmp(cfg["type"] | "", "GY521") != 0 || !cfg["channels"].isNull()) return false;
  cfg["channels"].to<JsonArray>().add("pitch");
  for (JsonObject c : cfg["calibrations"].as<JsonArray>())
    if (strcmp(c["channel"] | "", "") == 0) c["channel"] = "pitch";
  return true;
}

// Replaces every string value equal to `from` (exactly) by `to`, at any depth.
// Returns true if anything changed.
inline bool renameRefs(JsonVariant v, const char* from, const char* to) {
  bool changed = false;
  if (v.is<JsonObject>()) {
    for (JsonPair p : v.as<JsonObject>()) changed |= renameRefs(p.value(), from, to);
  } else if (v.is<JsonArray>()) {
    for (JsonVariant e : v.as<JsonArray>()) changed |= renameRefs(e, from, to);
  } else if (v.is<const char*>() && strcmp(v.as<const char*>(), from) == 0) {
    v.set(std::string(to));
    changed = true;
  }
  return changed;
}

// renameRefs over /config/logs.json. A log whose series changed loses its
// "session", so the next sample starts a new CSV: the header of the open one
// still names the old ref, and the chart resolves live values by that header.
inline bool renameLogRefs(JsonArray logs, const char* from, const char* to) {
  bool changed = false;
  for (JsonObject l : logs) {
    if (!renameRefs(l, from, to)) continue;
    l.remove("session");
    changed = true;
  }
  return changed;
}

}  // namespace BrewControl
