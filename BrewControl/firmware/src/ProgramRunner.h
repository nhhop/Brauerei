#pragma once

#include <ArduinoJson.h>
#include <FS.h>
#include <SensActCtrl.h>
#include <freertos/FreeRTOS.h>
#include <freertos/semphr.h>
#include <time.h>

#include "ProgramSteps.h"

#include <functional>
#include <string>
#include <vector>

namespace BrewControl {

// Runs setpoint programs ("mash profiles", fermentation schedules) on top of the
// library's controllers and actuators. A program is a named list of steps
// { name?, targets, holdSec, confirm, end, cond } (see ProgramSteps.h). Each
// step's targets map names only the controllers/actuators it touches and, per
// id, only the fields it sets ({v?, enabled?, interval?}); everything else is
// left as it is. No ramping: values jump when the step begins. A step ends
// either when its hold timer elapses (end "hold", default) or when a threshold
// on a sensor ref is met (end "sensor"); an orthogonal `confirm` flag makes it
// wait for a manual "next" once that trigger fires instead of advancing.
//
// Entering a step forward (start, next, auto-advance) applies that step's own
// commands. After a reboot or a "prev" that is not enough — later steps may
// have changed things this one doesn't mention — so there the runner replays
// the state built up by steps 0..current instead (effectiveTargets). Pulse
// actuators are the exception: their v queues pulses rather than setting a
// level, so it fires only on the first forward entry into its step per run
// (tracked by reachedStep) and is never replayed.
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

  // Create from cfg {name, steps:[{name?,targets,holdSec,confirm?,end?,cond?}]}
  // (legacy {controller, steps:[{setpoint,…}]} is read too). Returns the
  // generated id, or "" if the config is invalid (no steps, a broken interval,
  // an "end":"sensor" step with a malformed "cond", or an empty target id).
  String add(const JsonObject& cfg);

  // Replace an existing program's definition (resets it to idle). Returns false
  // if id not found or the new config is invalid.
  bool update(const char* id, const JsonObject& cfg);

  // Remove a program. False if id not found.
  bool remove(const char* id);

  // Apply a control action: "start" | "pause" | "resume" | "stop" | "next" |
  // "prev". Applies the resulting targets immediately.
  // Returns {false,reason} for unknown id (404), unknown action or an action
  // invalid for the current state (400).
  Result control(const char* id, const char* action, SensActCtrl::Registry& reg);

  // Pause every currently running or awaiting program (emergency stop).
  // Best-effort: programs that are neither are simply skipped.
  void pauseAllRunning(SensActCtrl::Registry& reg);

  // Advance running programs whose step has ended, apply targets, and persist
  // on transitions. nowEpoch is the wall-clock time (Unix s). No-op
  // until nowEpoch is a real (post-2000) time.
  void tick(SensActCtrl::Registry& reg, fs::FS& sd, time_t nowEpoch);

  // Fired on every run-state transition after boot, with `status` as it
  // appears in serialize(). Runs on whichever task caused the transition —
  // loopTask from tick(), the AsyncTCP task from control() — and always with
  // this runner's lock held, so the callback must not call back into it.
  // Restoring persisted state in loadFromSD deliberately does not fire.
  void setOnStatusChanged(
      std::function<void(const char* id, const char* name, const char* status)> cb) {
    onStatusChanged_ = std::move(cb);
  }

 private:
  enum class Status { Idle, Running, Awaiting, Paused, Done };

  struct Program {
    std::string id;
    std::string name;
    std::vector<ProgramStep> steps;
    // Runtime state (persisted for reboot-resume):
    Status   status            = Status::Idle;
    int      currentStep       = 0;
    time_t   stepStartedEpoch  = 0;  // wall-clock start of the active step
    uint32_t elapsedAtPauseSec = 0;  // frozen elapsed while paused
    // Highest step entered forward in this run; -1 before start. A step's pulse
    // commands fire only when entering it pushes this up, so "prev" followed by
    // "next", or a reboot, never fires them twice.
    int      reachedStep       = -1;
    // Runtime, not persisted: hysteresis latch for the current step's sensor
    // condition, mirrors AlarmStore::Rule::active. Reset on every step
    // transition so a re-entered step re-evaluates from scratch.
    bool     condActive        = false;
  };

  std::vector<Program> programs_;

  // After loadFromSD, the first tick (once the clock is valid) replays the
  // active step's state onto the freshly-constructed controllers/actuators.
  bool needsResume_ = true;

  // Guards programs_ against concurrent access from the AsyncTCP task (REST
  // handlers) and the loopTask (tick). Recursive so saveToSD → serialize while
  // locked doesn't self-deadlock.
  mutable SemaphoreHandle_t mutex_ = nullptr;

  std::function<void(const char*, const char*, const char*)> onStatusChanged_;

  Program* find_(const char* id);

  // Single funnel for every run-state change after boot: assigns and, on a
  // real transition, notifies onStatusChanged_.
  void setStatus_(Program& p, Status s);

  // Apply one command to the controller or actuator it names; no-op if the id
  // no longer resolves. A pulse actuator's v is written only when withImpulse
  // is set (see the class comment).
  static void applyCmd_(SensActCtrl::Registry& reg, const TargetCmd& c,
                        bool withImpulse);

  // Apply the current step's own commands.
  static void applyStepTargets_(Program& p, SensActCtrl::Registry& reg,
                                bool withImpulse);

  // Replay the state built up by steps 0..currentStep, pulses excluded.
  static void applyState_(Program& p, SensActCtrl::Registry& reg);

  // Enter step idx forward: restart the timer, set Running, apply the step's
  // commands — its pulses too if idx is past reachedStep.
  void enterStep_(Program& p, SensActCtrl::Registry& reg, int idx, time_t now);

  // Move to the next step (or finish).
  void advance_(Program& p, SensActCtrl::Registry& reg, time_t nowEpoch);

  // False if any step's target id no longer resolves to a controller/actuator.
  static bool targetsResolvable_(const Program& p, SensActCtrl::Registry& reg);

  static String generateId();
  static bool   fillFromJson(Program& p, const JsonObject& cfg);
  static const char* statusToStr(Status s);
  static Status statusFromStr(const char* s);
};

}  // namespace BrewControl
