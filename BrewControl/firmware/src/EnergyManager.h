#pragma once

#include <cstdint>
#include <vector>

#include "PinMap.h"

namespace BrewControl {

class SettingsStore;

// Deep sleep between measurements (README "Energiemanagement"). The decisions
// live in WakeMode.h; this is the ESP-IDF side: wake cause, wake pin, holding
// the outputs through the sleep, going to sleep.
class EnergyManager {
 public:
  // "timer" or "pin" when this boot is a wakeup from deep sleep, else nullptr.
  static const char* wakeCause();

  // Output pins held at their inactive level through the sleep stay held
  // until the actuators take them over: call right before registry.begin().
  static void releaseOutputs(const std::vector<PinUse>& uses);

  // The wake pin is at its active level (false without a wake pin).
  bool pinActive(const SettingsStore& s);

  // Holds every output pin at its current level — the caller has switched
  // the actuators off — arms the timer and the wake pin, and sleeps.
  [[noreturn]] void sleep(const SettingsStore& s, uint64_t ms, const std::vector<PinUse>& uses);

 private:
  int pin_ = -1;  // wake pin as last configured by pinActive()
  bool activeLow_ = true;
};

}  // namespace BrewControl
