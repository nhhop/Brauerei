#pragma once

#include <FS.h>
#include <SensActCtrl.h>

#include <string>

#include "DynamicItems.h"

namespace BrewControl {

// The runtime state of controllers and actuators — on/off, setpoint, value,
// interval — kept across reboots in /config/state.json, in the targets format
// of program steps (ProgramTargets.h). The library starts every relay off on
// purpose; BrewControl brings back the last state deliberately, so a relay
// that was on is on again after a power cut. A latched emergency stop still
// wins: WebUI::begin() applies it after restoreState().
//
// Not part of it: an actuator's value while a controller drives it (the
// controller rewrites it every tick) and a pulse actuator's value (an event,
// not a state).

// The current state as JSON ({"targets": {...}}).
std::string captureState(SensActCtrl::Registry& reg, const DynamicItems& items);

void saveState(fs::FS& fs, const std::string& json);

// Applies the saved state, if any; ids that no longer exist are skipped.
void restoreState(fs::FS& fs, SensActCtrl::Registry& reg);

}  // namespace BrewControl
