#pragma once

#include <stddef.h>

#include <string>

namespace BrewControl {

// What a program reports beyond its run state: a step with "notify" announces
// itself when it is entered, without holding the clock (a brew's rest timer,
// hop additions). Kept free of Arduino types so the native tests can use it.

// A notify step reports once per run, on its first forward entry — the rule its
// pulses follow — so "prev" then "next", or a reboot, do not repeat it.
inline bool notifiesOnEntry(bool notify, int idx, int reachedStep) {
  return notify && idx > reachedStep;
}

// How many bytes of `s` fit into `max` without splitting a UTF-8 character. A
// step's name goes into a fixed-width alert field; cut inside "°" or "ü" it
// would end in half a character, which is not valid JSON text.
inline size_t utf8PrefixLen(const char* s, size_t max) {
  size_t n = 0;
  while (n < max && s[n]) ++n;
  if (s[n]) {
    while (n > 0 && (static_cast<unsigned char>(s[n]) & 0xC0) == 0x80) --n;
  }
  return n;
}

// Title and body of a program alert's push. `detail` is the program event
// ("awaiting", "notify" or "done"), `step` the step's name, may be empty.
inline void describeProgramAlert(const char* detail, const std::string& name,
                                 const char* step, std::string& title,
                                 std::string& body) {
  const std::string s = step ? step : "";
  if (std::string(detail) == "awaiting") {
    title = "Schritt bestätigen";
    body  = s.empty() ? name + " wartet auf die Freigabe." : name + ": " + s;
  } else if (std::string(detail) == "notify") {
    title = name;
    body  = s.empty() ? "Nächster Schritt" : s;
  } else {
    title = "Programm fertig";
    body  = name + " ist durchgelaufen.";
  }
}

}  // namespace BrewControl
