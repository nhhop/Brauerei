#pragma once

#include <string>

namespace SensActCtrl {
namespace remote {

// Topic builders for the SensActCtrl wire protocol. The prefix defaults to
// "sensactctrl" but can be overridden via RemotePublisher::setPrefix().
// All other parameters are device/kind/id.
//
// Flat schema  (single-channel, empty key):
//   <prefix>/<device>/sensor/<id>           state  (retained)
//   <prefix>/<device>/sensor/<id>/meta      meta   (retained)
//
// Channel schema (multi-channel or named-key):
//   <prefix>/<device>/sensor/<id>/<key>      channel state (retained)
//   <prefix>/<device>/sensor/<id>/<key>/meta channel meta  (retained)
//
// Actuator / Controller topics unchanged:
//   <prefix>/<device>/actuator/<id>          state  (retained)
//   <prefix>/<device>/actuator/<id>/meta     meta   (retained)
//   <prefix>/<device>/actuator/<id>/set      command
//   <prefix>/<device>/controller/<id>/meta   meta   (retained)
//   <prefix>/<device>/controller/<id>/tune   tune

inline std::string base(const char* device, const char* kind, const char* id,
                        const char* prefix = "sensactctrl") {
  return std::string(prefix) + "/" + device + "/" + kind + "/" + id;
}

inline std::string sensorState(const char* d, const char* id,
                               const char* prefix = "sensactctrl") {
  return base(d, "sensor", id, prefix);
}
inline std::string sensorMeta(const char* d, const char* id,
                              const char* prefix = "sensactctrl") {
  return sensorState(d, id, prefix) + "/meta";
}
inline std::string sensorChannelState(const char* d, const char* id, const char* key,
                                      const char* prefix = "sensactctrl") {
  return base(d, "sensor", id, prefix) + "/" + key;
}
inline std::string sensorChannelMeta(const char* d, const char* id, const char* key,
                                     const char* prefix = "sensactctrl") {
  return sensorChannelState(d, id, key, prefix) + "/meta";
}

inline std::string actuatorState(const char* d, const char* id,
                                 const char* prefix = "sensactctrl") {
  return base(d, "actuator", id, prefix);
}
inline std::string actuatorMeta(const char* d, const char* id,
                                const char* prefix = "sensactctrl") {
  return actuatorState(d, id, prefix) + "/meta";
}
inline std::string actuatorSet(const char* d, const char* id,
                               const char* prefix = "sensactctrl") {
  return actuatorState(d, id, prefix) + "/set";
}

inline std::string controllerMeta(const char* d, const char* id,
                                  const char* prefix = "sensactctrl") {
  return base(d, "controller", id, prefix) + "/meta";
}
inline std::string controllerTune(const char* d, const char* id,
                                  const char* prefix = "sensactctrl") {
  return base(d, "controller", id, prefix) + "/tune";
}

}  // namespace remote
}  // namespace SensActCtrl
