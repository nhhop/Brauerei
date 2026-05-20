#pragma once

#include <string>

namespace SensActCtrl {
namespace remote {

// Topic builders for the SensActCtrl wire protocol. Strings allocate on
// the heap once at attach/construct time; the hot path uses pre-built
// topics. Schema (see PLAN.md):
//   sensactctrl/<device>/sensor/<id>          (retained)  state
//   sensactctrl/<device>/sensor/<id>/meta     (retained)  meta
//   sensactctrl/<device>/actuator/<id>        (retained)  state
//   sensactctrl/<device>/actuator/<id>/meta   (retained)  meta
//   sensactctrl/<device>/actuator/<id>/set                command
//   sensactctrl/<device>/controller/<id>/meta (retained)  meta
//   sensactctrl/<device>/controller/<id>/tune             tune

inline std::string base(const char* device, const char* kind, const char* id) {
  return std::string("sensactctrl/") + device + "/" + kind + "/" + id;
}

inline std::string sensorState(const char* d, const char* id) { return base(d, "sensor", id); }
inline std::string sensorMeta (const char* d, const char* id) { return sensorState(d, id) + "/meta"; }

inline std::string actuatorState(const char* d, const char* id) { return base(d, "actuator", id); }
inline std::string actuatorMeta (const char* d, const char* id) { return actuatorState(d, id) + "/meta"; }
inline std::string actuatorSet  (const char* d, const char* id) { return actuatorState(d, id) + "/set"; }

inline std::string controllerMeta(const char* d, const char* id) { return base(d, "controller", id) + "/meta"; }
inline std::string controllerTune(const char* d, const char* id) { return base(d, "controller", id) + "/tune"; }

}  // namespace remote
}  // namespace SensActCtrl
