#include "ProgramSteps.h"

#include <string.h>

namespace BrewControl {

bool readSteps(JsonObjectConst cfg, std::vector<ProgramStep>& out) {
  out.clear();
  const char* legacyController = cfg["controller"] | "";
  for (JsonObjectConst s : cfg["steps"].as<JsonArrayConst>()) {
    ProgramStep st;
    st.name    = s["name"]    | "";
    st.holdSec = s["holdSec"] | 0;
    st.confirm = s["confirm"] | false;
    if (!readTargets(s, legacyController, st.targets)) return false;
    if (strcmp(s["end"] | "hold", "sensor") == 0) {
      st.end = StepEnd::Sensor;
      if (!conditionFromJson(st.cond, s["cond"].as<JsonObjectConst>())) return false;
    }
    out.push_back(std::move(st));
  }
  return true;
}

void writeSteps(JsonObject cfg, const std::vector<ProgramStep>& steps) {
  JsonArray arr = cfg["steps"].to<JsonArray>();
  for (const auto& s : steps) {
    JsonObject so = arr.add<JsonObject>();
    if (!s.name.empty()) so["name"] = s.name.c_str();
    writeTargets(so, s.targets);
    so["holdSec"] = s.holdSec;
    if (s.confirm) so["confirm"] = true;
    if (s.end == StepEnd::Sensor) {
      so["end"] = "sensor";
      conditionToJson(s.cond, so["cond"].to<JsonObject>());
    }
  }
}

bool hasUnboundTarget(const std::vector<ProgramStep>& steps) {
  for (const auto& s : steps)
    for (const auto& t : s.targets)
      if (t.id.empty()) return true;
  return false;
}

}  // namespace BrewControl
