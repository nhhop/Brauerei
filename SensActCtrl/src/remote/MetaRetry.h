#pragma once

#include <stdint.h>

namespace SensActCtrl {
namespace remote {

// RemoteSensor/RemoteActuator: a state message without meta means the
// publisher is alive but its retained meta never arrived (an ESP-NOW broadcast
// lost on air). They then ask for the retained messages again — on the 1st,
// 2nd, 4th ... 64th state without meta, then on every 64th, so a meta that can
// never be sent (too large for the transport) costs only a rare replay.
// statesWithoutMeta counts from 1.
inline bool shouldRequestMeta(uint32_t statesWithoutMeta) {
  const uint32_t n = statesWithoutMeta;
  if (n == 0) return false;
  return n >= 64 ? n % 64 == 0 : (n & (n - 1)) == 0;
}

}  // namespace remote
}  // namespace SensActCtrl
