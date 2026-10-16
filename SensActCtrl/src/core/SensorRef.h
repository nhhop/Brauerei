#pragma once
#include <stddef.h>
#include <stdio.h>
#include "Sensor.h"

namespace SensActCtrl {

// Controller input reference: "<sensorId>" for single-value channels (empty
// key), "<sensorId>.<key>" otherwise — the same ID the snapshot uses.
inline void sensorRef(const Sensor& s, size_t channel, char* out, size_t n) {
  if (!out || n == 0) return;
  const char* key = s.channel(channel).key;
  if (key && key[0]) snprintf(out, n, "%s.%s", s.id(), key);
  else               snprintf(out, n, "%s", s.id());
}

// Out-of-range channel indices fall back to channel 0.
inline size_t clampChannel(const Sensor& s, size_t channel) {
  return channel < s.channelCount() ? channel : 0;
}

}  // namespace SensActCtrl
