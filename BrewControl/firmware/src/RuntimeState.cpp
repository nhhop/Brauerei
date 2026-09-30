#include "RuntimeState.h"

#include <ArduinoJson.h>

#include <vector>

#include "ProgramRunner.h"
#include "ProgramTargets.h"
#include "SdLock.h"

namespace BrewControl {

namespace {
constexpr char kPath[] = "/config/state.json";
}  // namespace

std::string captureState(SensActCtrl::Registry& reg, const DynamicItems& items) {
  std::vector<TargetCmd> targets;
  for (auto* c : reg.controllers()) {
    TargetCmd t;
    t.id = c->id();
    t.hasEnabled = true;
    t.enabled = c->enabled();
    t.hasV = true;
    t.v = c->setpoint();
    targets.push_back(std::move(t));
  }
  for (auto* a : reg.actuators()) {
    TargetCmd t;
    t.id = a->id();
    t.hasEnabled = true;
    t.enabled = a->enabled();
    const SensActCtrl::IntervalConfig iv = a->interval();
    if (iv.has) {
      t.hasInterval = true;
      t.onSec = iv.onSec;
      t.periodSec = iv.periodSec;
    }
    // Discrete = pulse actuator (ProgramRunner's isImpulse): its v is an event.
    if (!items.drivenByController(a->id()) &&
        a->meta().kind != SensActCtrl::ValueKind::Discrete) {
      t.hasV = true;
      t.v = a->target();
    }
    targets.push_back(std::move(t));
  }
  JsonDocument doc;
  writeTargets(doc.to<JsonObject>(), targets);
  std::string out;
  serializeJson(doc, out);
  return out;
}

void saveState(fs::FS& fs, const std::string& json) {
  SdLock sdLock;
  fs.mkdir("/config");
  File f = fs.open(kPath, FILE_WRITE);
  if (!f) return;
  f.print(json.c_str());
  f.close();
}

void restoreState(fs::FS& fs, SensActCtrl::Registry& reg) {
  JsonDocument doc;
  {
    SdLock sdLock;
    File f = fs.open(kPath);
    if (!f) return;
    const bool ok = deserializeJson(doc, f) == DeserializationError::Ok;
    f.close();
    if (!ok) return;
  }
  std::vector<TargetCmd> targets;
  readTargets(doc.as<JsonObjectConst>(), "", targets);
  for (const TargetCmd& t : targets) ProgramRunner::applyTarget(reg, t);
  Serial.printf("runtime state restored (%u items)\n", static_cast<unsigned>(targets.size()));
}

}  // namespace BrewControl
