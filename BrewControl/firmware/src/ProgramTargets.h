#pragma once

#include <ArduinoJson.h>

#include <algorithm>
#include <cmath>
#include <cstdint>
#include <string>
#include <utility>
#include <vector>

namespace BrewControl {

// One entry of a program step's "targets" map: a command for a controller or an
// actuator, addressed by its id (ids are unique across sensors, actuators and
// controllers, so no role prefix is needed). Mirrors the body of
// POST /api/actuators/<id>: every field is optional, and a field the command
// leaves out keeps whatever value it had. v is a controller's setpoint or an
// actuator's value; interval only means something to an actuator with a
// duty-cycle schedule (IntervalActuator).
//
// Kept free of Arduino and SensActCtrl types so the native tests can use it.
struct TargetCmd {
  std::string id;
  bool     hasV        = false;
  float    v           = 0.0f;
  bool     hasEnabled  = false;
  bool     enabled     = false;
  bool     hasInterval = false;
  uint32_t onSec       = 0;
  uint32_t periodSec   = 0;
};

inline bool hasAnyField(const TargetCmd& c) {
  return c.hasV || c.hasEnabled || c.hasInterval;
}

// Reads step["targets"] ({id: {v?, enabled?, interval?}}) into out, in document
// order. A non-finite v is dropped, and so is a command left with no field at
// all. Returns false on an invalid interval (periodSec 0 or onSec > periodSec),
// the same check POST /api/actuators/<id> applies.
//
// Legacy (steps before multi-target programs): a step with a scalar "setpoint"
// instead of "targets" becomes {legacyController: {v: setpoint, enabled: true}}
// — the old runner always enabled its controller when it applied a step.
// Profiles had no controller; they pass "" and get an unbound entry.
inline bool readTargets(JsonObjectConst step, const char* legacyController,
                        std::vector<TargetCmd>& out) {
  out.clear();
  JsonObjectConst targets = step["targets"];
  if (targets.isNull()) {
    JsonVariantConst sp = step["setpoint"];
    if (sp.is<float>() && std::isfinite(sp.as<float>())) {
      TargetCmd c;
      c.id         = legacyController ? legacyController : "";
      c.hasV       = true;
      c.v          = sp.as<float>();
      c.hasEnabled = true;
      c.enabled    = true;
      out.push_back(std::move(c));
    }
    return true;
  }

  for (JsonPairConst kv : targets) {
    JsonObjectConst o = kv.value();
    if (o.isNull()) continue;  // not an object
    TargetCmd c;
    c.id = kv.key().c_str();
    if (o["v"].is<float>() && std::isfinite(o["v"].as<float>())) {
      c.hasV = true;
      c.v    = o["v"].as<float>();
    }
    if (o["enabled"].is<bool>()) {
      c.hasEnabled = true;
      c.enabled    = o["enabled"].as<bool>();
    }
    JsonObjectConst iv = o["interval"];
    if (!iv.isNull()) {
      const uint32_t onSec     = iv["onSec"] | 0u;
      const uint32_t periodSec = iv["periodSec"] | 0u;
      if (periodSec == 0 || onSec > periodSec) return false;
      c.hasInterval = true;
      c.onSec       = onSec;
      c.periodSec   = periodSec;
    }
    if (!hasAnyField(c)) continue;
    out.push_back(std::move(c));
  }
  return true;
}

// Writes targets as step["targets"], each command with only the fields it has.
// Always emits the object, so an empty step reads back as "targets": {}.
inline void writeTargets(JsonObject step, const std::vector<TargetCmd>& targets) {
  JsonObject t = step["targets"].to<JsonObject>();
  for (const TargetCmd& c : targets) {
    JsonObject o = t[c.id].to<JsonObject>();
    if (c.hasEnabled) o["enabled"] = c.enabled;
    if (c.hasV) o["v"] = c.v;
    if (c.hasInterval) {
      JsonObject iv   = o["interval"].to<JsonObject>();
      iv["onSec"]     = c.onSec;
      iv["periodSec"] = c.periodSec;
    }
  }
}

// The state a program has built up by step k: for every id and every field, the
// last value any of steps 0..k set, ids in order of first appearance. Used to
// re-establish that state after a reboot or a "prev", where only replaying the
// current step would leave behind whatever later steps changed.
//
// isImpulse(id) marks pulse actuators, whose write(N) queues N more pulses: their
// v is an event rather than a state, so it never becomes part of the rebuilt
// state (their enabled and interval still do).
//
// Step is any type with a `targets` vector of TargetCmd (ProgramStep in the
// firmware, a minimal struct in the tests).
template <class Step, class IsImpulse>
std::vector<TargetCmd> effectiveTargets(const std::vector<Step>& steps, int k,
                                        IsImpulse isImpulse) {
  std::vector<TargetCmd> out;
  for (int i = 0; i <= k && i < (int)steps.size(); ++i) {
    for (const TargetCmd& c : steps[i].targets) {
      auto it = std::find_if(out.begin(), out.end(),
                             [&](const TargetCmd& e) { return e.id == c.id; });
      if (it == out.end()) {
        out.push_back(TargetCmd{});
        it = out.end() - 1;
        it->id = c.id;
      }
      if (c.hasEnabled) {
        it->hasEnabled = true;
        it->enabled    = c.enabled;
      }
      if (c.hasInterval) {
        it->hasInterval = true;
        it->onSec       = c.onSec;
        it->periodSec   = c.periodSec;
      }
      if (c.hasV && !isImpulse(c.id)) {
        it->hasV = true;
        it->v    = c.v;
      }
    }
  }
  // An impulse id that only ever carried a v has nothing left to re-apply.
  out.erase(std::remove_if(out.begin(), out.end(),
                           [](const TargetCmd& e) { return !hasAnyField(e); }),
            out.end());
  return out;
}

}  // namespace BrewControl
