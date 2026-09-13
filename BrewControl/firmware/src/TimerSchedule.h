#pragma once

#include <cstdint>
#include <cstdio>
#include <ctime>
#include <string>

namespace BrewControl {

// Time-of-day helpers for the Timer's "clock" mode ({start now, countdown to
// the next occurrence of a fixed HH:MM"} rather than a plain duration).
//
// Kept free of Arduino and SensActCtrl types so the native tests can use it.

// Parses "HH:MM" (24h, zero-padded) into seconds-since-local-midnight.
// Returns false on malformed input or an out-of-range hour/minute.
inline bool parseTimeOfDay(const std::string& hhmm, uint32_t& outSecOfDay) {
  int h = -1, m = -1;
  char extra = 0;
  if (sscanf(hhmm.c_str(), "%d:%d%c", &h, &m, &extra) != 2) return false;
  if (h < 0 || h > 23 || m < 0 || m > 59) return false;
  outSecOfDay = (uint32_t)(h * 3600 + m * 60);
  return true;
}

// Formats secOfDay back to "HH:MM" (for serialize()).
inline std::string formatTimeOfDay(uint32_t secOfDay) {
  char buf[6];
  snprintf(buf, sizeof(buf), "%02u:%02u", (unsigned)(secOfDay / 3600) % 24,
           (unsigned)(secOfDay / 60) % 60);
  return std::string(buf);
}

// Seconds from fromEpoch until the next local occurrence of secOfDay. An exact
// match (fromEpoch's own time-of-day equals secOfDay) counts as "already
// passed" and rolls a full day forward, so this never returns 0.
inline uint32_t nextOccurrenceDurationSec(uint32_t secOfDay, time_t fromEpoch) {
  struct tm lt;
#if defined(_WIN32)
  localtime_s(&lt, &fromEpoch);  // reversed argument order vs. POSIX localtime_r
#else
  localtime_r(&fromEpoch, &lt);
#endif
  const uint32_t nowSecOfDay = (uint32_t)(lt.tm_hour * 3600 + lt.tm_min * 60 + lt.tm_sec);
  if (secOfDay > nowSecOfDay) return secOfDay - nowSecOfDay;
  return 86400u - (nowSecOfDay - secOfDay);
}

}  // namespace BrewControl
