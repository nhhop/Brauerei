#pragma once

#include <ArduinoJson.h>
#include <FS.h>
#include <SensActCtrl.h>
#include <freertos/FreeRTOS.h>
#include <freertos/semphr.h>
#include <time.h>

#include <string>
#include <vector>

namespace BrewControl {

// Runs time-driven setpoint programs ("mash profiles") on top of the library's
// controllers. A program is a named list of steps { name?, setpoint, holdSec,
// confirm }; the runner walks the steps and drives the bound controller's
// setpoint over time. No sensor feedback and no ramping: the setpoint jumps to
// each step's target and the hold timer counts from the moment the step begins.
//
// Timing uses the wall clock (time(nullptr)), persisted as an absolute epoch per
// step, so a running program survives a reboot and resumes at the right place.
// Like LogStore the runner is a no-op until NTP has synced (pre-2000 clock).
//
// Persists definitions AND runtime state to /config/programs.json.
class ProgramRunner {
 public:
  ProgramRunner();

  struct Result { bool ok; const char* error = ""; };

  void loadFromSD(fs::FS& sd);
  void saveToSD(fs::FS& sd) const;

  // JSON array of all programs (config + derived live status). GET /api/programs.
  String serialize() const;

  // Create from cfg {name, controller, steps:[{name?,setpoint,holdSec,confirm?}]}.
  // Returns the generated id, or "" if the config is invalid (no controller or
  // no valid steps).
  String add(const JsonObject& cfg);

  // Replace an existing program's definition (resets it to idle). Returns false
  // if id not found or the new config is invalid.
  bool update(const char* id, const JsonObject& cfg);

  // Remove a program. False if id not found.
  bool remove(const char* id);

  // Apply a control action: "start" | "pause" | "resume" | "stop" | "next" |
  // "prev". Applies the resulting setpoint to the bound controller immediately.
  // Returns {false,reason} for unknown id (404), unknown action or an action
  // invalid for the current state (400).
  Result control(const char* id, const char* action, SensActCtrl::Registry& reg);

  // Advance running programs whose hold time has elapsed, apply setpoints, and
  // persist on transitions. nowEpoch is the wall-clock time (Unix s). No-op
  // until nowEpoch is a real (post-2000) time.
  void tick(SensActCtrl::Registry& reg, fs::FS& sd, time_t nowEpoch);

 private:
  enum class Status { Idle, Running, Awaiting, Paused, Done };

  struct Step {
    std::string name;          // optional, cosmetic
    float       setpoint = 0;
    uint32_t    holdSec  = 0;
    bool        confirm  = false;
  };

  struct Program {
    std::string id;
    std::string name;
    std::string controller;    // bound controller id
    std::vector<Step> steps;
    // Runtime state (persisted for reboot-resume):
    Status   status            = Status::Idle;
    int      currentStep       = 0;
    time_t   stepStartedEpoch  = 0;  // wall-clock start of the active step
    uint32_t elapsedAtPauseSec = 0;  // frozen elapsed while paused
  };

  std::vector<Program> programs_;

  // After loadFromSD, the first tick (once the clock is valid) re-applies the
  // active step's setpoint to the freshly-constructed controller.
  bool needsResume_ = true;

  // Guards programs_ against concurrent access from the AsyncTCP task (REST
  // handlers) and the loopTask (tick). Recursive so saveToSD → serialize while
  // locked doesn't self-deadlock.
  mutable SemaphoreHandle_t mutex_ = nullptr;

  Program* find_(const char* id);

  // Apply the current step's setpoint to the bound controller; enable it too
  // when `enable` is set. No-op if the controller no longer exists.
  void applyStep_(Program& p, SensActCtrl::Registry& reg, bool enable) const;

  // Move to the next step (or finish). Applies the new setpoint and restarts the
  // timer at nowEpoch.
  void advance_(Program& p, SensActCtrl::Registry& reg, time_t nowEpoch);

  static String generateId();
  static bool   fillFromJson(Program& p, const JsonObject& cfg);
  static const char* statusToStr(Status s);
  static Status statusFromStr(const char* s);
};

}  // namespace BrewControl
