#pragma once

#include <ArduinoJson.h>

#include <string>
#include <vector>

#include "Condition.h"
#include "ProgramTargets.h"

namespace BrewControl {

// How a program step ends: once its hold timer elapses, or once a threshold on
// a sensor ref is met.
enum class StepEnd { Hold, Sensor };

// One step of a setpoint program. Shared by ProgramRunner, which runs it, and
// ProfileStore, which keeps it as a template — one parser for both, so a field
// added to the step cannot silently get lost on the way through the library.
// Wire shape: {name?, targets, holdSec, confirm?, end?, cond?} (ProgramStep in
// the OpenAPI spec).
struct ProgramStep {
  std::string            name;               // optional, cosmetic
  std::vector<TargetCmd> targets;            // see ProgramTargets.h
  uint32_t               holdSec = 0;        // ignored when end == Sensor
  bool                   confirm = false;    // wait for a manual "next" once the step ends
  StepEnd                end     = StepEnd::Hold;
  Condition              cond;               // only meaningful when end == Sensor
};

// Reads cfg["steps"] into out. Returns false if a step is invalid: a broken
// interval in its targets, or end "sensor" with a malformed cond. cfg's legacy
// "controller" (programs before multi-target steps) feeds readTargets.
bool readSteps(JsonObjectConst cfg, std::vector<ProgramStep>& out);

// Writes steps as cfg["steps"]; name, confirm, end and cond are omitted while
// they hold their defaults.
void writeSteps(JsonObject cfg, const std::vector<ProgramStep>& steps);

// True if any step addresses the empty id "". Only a profile migrated from
// before multi-target steps has one; a program must not.
bool hasUnboundTarget(const std::vector<ProgramStep>& steps);

}  // namespace BrewControl
