#pragma once

#include <ArduinoJson.h>
#include <SensActCtrl.h>

#include <string>

namespace BrewControl {

// Resolving a "<role>/<snapshotId>" reference against the registry, plus the
// threshold condition built on top of it. Both are shared: LogStore uses the
// resolver for its series, AlarmStore uses the full condition for its rules,
// and setpoint-program steps can reuse the same condition shape later.

// Current value behind a ref. valid == false means the ref points at nothing,
// or the sensor has not produced a reading yet.
struct RefValue {
  float value = 0.0f;
  bool  valid = false;
  float res   = 0.0f;  // channel resolution, 0 when the role has none
};

// Roles: "sensor/<id>[.<channelKey>]", "actuator/<id>", "controller/<id>".
// An actuator resolves to its commanded state, a controller to its setpoint.
RefValue resolveRef(SensActCtrl::Registry& reg, const std::string& ref);

enum class CondOp { Gt, Lt };

// "<ref> <op> <value>" with a release band. hyst widens the exit threshold so a
// value sitting on the limit cannot chatter: Gt latches on at v > value and off
// only at v < value - hyst (mirrored for Lt). hyst == 0 is a plain comparison.
struct Condition {
  std::string ref;
  CondOp      op    = CondOp::Gt;
  float       value = 0.0f;
  float       hyst  = 0.0f;
};

// Reads {ref, op, value, hyst}. Returns false when ref is empty or value is not
// a finite number; op defaults to "gt" and hyst is clamped to >= 0.
bool conditionFromJson(Condition& c, JsonObjectConst o);
void conditionToJson(const Condition& c, JsonObject o);

// Updates `active` (the caller-owned latch) in place. Returns false and leaves
// the latch untouched when the ref cannot be resolved right now — a rule whose
// target was deleted neither fires nor clears. outValue, when given, receives
// the resolved value on success.
bool evalCondition(SensActCtrl::Registry& reg, const Condition& c, bool& active,
                   float* outValue = nullptr);

}  // namespace BrewControl
