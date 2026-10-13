#pragma once

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
