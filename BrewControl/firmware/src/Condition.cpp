#include "Condition.h"

#include <math.h>
#include <string.h>

namespace BrewControl {

// ── Ref resolution ────────────────────────────────────────────────────────────

RefValue resolveRef(SensActCtrl::Registry& reg, const std::string& ref) {
  RefValue out;
  const size_t slash = ref.find('/');
  if (slash == std::string::npos) return out;
  const std::string role = ref.substr(0, slash);
  const std::string id   = ref.substr(slash + 1);

  if (role == "sensor") {
    // id is "<base>.<key>" or "<base>" for single-channel sensors.
    const size_t dot = id.find('.');
    const std::string base = (dot == std::string::npos) ? id : id.substr(0, dot);
    const std::string key  = (dot == std::string::npos) ? "" : id.substr(dot + 1);
    SensActCtrl::Sensor* s = reg.findSensor(base.c_str());
    if (!s) return out;
    for (size_t i = 0; i < s->channelCount(); ++i) {
      const SensActCtrl::Channel ch = s->channel(i);
      const char* ck = ch.key ? ch.key : "";
      if (key == ck) {
        out.value = ch.reading.value;
        out.valid = ch.reading.valid;
        out.res   = ch.meta.resolution;
        return out;
      }
    }
    return out;
  }

  if (role == "actuator") {
    SensActCtrl::Actuator* a = reg.findActuator(id.c_str());
    if (!a) return out;
    out.value = a->state();
    out.valid = true;
    out.res   = a->meta().resolution;
    return out;
  }

  if (role == "controller") {
    SensActCtrl::Controller* c = reg.findController(id.c_str());
    if (!c) return out;
    out.value = c->setpoint();
    out.valid = true;
    out.res   = 0.0f;
    return out;
  }

  return out;
}

// ── Condition ─────────────────────────────────────────────────────────────────

bool conditionFromJson(Condition& c, JsonObjectConst o) {
  c.ref = o["ref"] | "";
  if (c.ref.empty()) return false;

  const char* op = o["op"] | "gt";
  c.op = (strcmp(op, "lt") == 0) ? CondOp::Lt : CondOp::Gt;

  if (!o["value"].is<float>()) return false;
  c.value = o["value"].as<float>();
  if (!isfinite(c.value)) return false;

  c.hyst = o["hyst"] | 0.0f;
  if (!isfinite(c.hyst) || c.hyst < 0.0f) c.hyst = 0.0f;
  return true;
}

void conditionToJson(const Condition& c, JsonObject o) {
  o["ref"]   = c.ref.c_str();
  o["op"]    = (c.op == CondOp::Lt) ? "lt" : "gt";
  o["value"] = c.value;
  o["hyst"]  = c.hyst;
}

bool evalCondition(SensActCtrl::Registry& reg, const Condition& c, bool& active,
                   float* outValue) {
  const RefValue v = resolveRef(reg, c.ref);
  if (!v.valid) return false;
  if (outValue) *outValue = v.value;

  if (c.op == CondOp::Gt) {
    if (!active && v.value > c.value)             active = true;
    else if (active && v.value < c.value - c.hyst) active = false;
  } else {
    if (!active && v.value < c.value)             active = true;
    else if (active && v.value > c.value + c.hyst) active = false;
  }
  return true;
}

}  // namespace BrewControl
