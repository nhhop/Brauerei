#pragma once

#include <ArduinoJson.h>
#include <FS.h>
#include <freertos/FreeRTOS.h>
#include <freertos/semphr.h>
#include <time.h>

#include "ProgramRunner.h"

#include <functional>
#include <string>
#include <vector>

namespace BrewControl {

// Freestanding kitchen-style countdown timers — hop additions, stirring
// intervals, rests outside a formal program. Each timer is its own top-level
// entity (like a sensor or actuator), not grouped.
//
// Timing uses the wall clock (time(nullptr)), persisted as an absolute epoch,
// so a running timer survives a reboot and resumes at the right remaining
// time. Like ProgramRunner the store is a no-op until NTP has synced
// (pre-2000 clock).
//
// Two definition modes: Duration (a fixed durationSec) or Clock (a fixed
// local time-of-day — "next occurrence" — see TimerSchedule.h). In Clock
// mode, durationSec is not user-configured: it is (re)computed at start and
// at each repeat re-arm as the seconds until the next occurrence, then the
// run behaves exactly like a Duration timer.
//
// A timer can optionally start or stop one actuator, controller or program
// when it expires (onExpire), fired directly against the Registry/
// ProgramRunner passed into tick() — this must work even with no browser
// open, e.g. an overnight "start preheating at 6:00" timer. If repeat is set,
// the timer re-arms immediately after the action fires instead of going
// Done; Clock mode re-arms to the same time tomorrow (rebased from the exact
// expiry instant, so it never drifts), Duration mode just recounts the same
// durationSec.
//
// Persists definitions AND runtime state to /config/timers.json.
class TimerStore {
 public:
  TimerStore();

  struct Result { bool ok; const char* error = ""; };

  void loadFromSD(fs::FS& sd);
  void saveToSD(fs::FS& sd) const;

  // JSON array of all timers (config + derived remainingSec). GET /api/timers.
  String serialize() const;

  // Create from cfg {name, durationSec}. Returns the generated id, or "" if
  // the config is invalid (empty name, durationSec <= 0).
  String add(const JsonObject& cfg);

  // Replace an existing timer's definition (resets it to idle). Returns false
  // if id not found or the new config is invalid.
  bool update(const char* id, const JsonObject& cfg);

  // Remove a timer. False if id not found.
  bool remove(const char* id);

  // Apply a control action: "start" | "pause" | "resume" | "stop".
  // Returns {false,reason} for unknown id (404), unknown action or an action
  // invalid for the current state (400). For a Clock-mode timer, "start"
  // (re)computes durationSec from the current wall clock.
  Result control(const char* id, const char* action);

  // Pause every currently running timer (emergency stop). Best-effort: timers
  // that are not running are simply skipped.
  void pauseAllRunning();

  // Advance running timers past their duration: fire the notification
  // callback and the optional onExpire action against reg/programs, then
  // either re-arm (repeat) or transition to "done". Persists on any
  // transition. nowEpoch is the wall-clock time (Unix s). No-op until
  // nowEpoch is a real (post-2000) time.
  void tick(SensActCtrl::Registry& reg, ProgramRunner& programs, fs::FS& sd,
            time_t nowEpoch);

  // Fired once per timer when it expires (Running -> Done, or a repeat
  // re-arm, via tick()). Runs on the loopTask, with this store's lock held,
  // so the callback must not call back into it. Restoring persisted state in
  // loadFromSD deliberately does not fire, nor does an already-Done timer on
  // a later tick.
  void setOnExpired(std::function<void(const char* id, const char* name)> cb) {
    onExpired_ = std::move(cb);
  }

 private:
  enum class Status { Idle, Running, Paused, Done };
  enum class Mode { Duration, Clock };
  enum class TargetKind { Actuator, Controller, Program };

  struct Timer {
    std::string id;
    std::string name;

    // Definition:
    Mode        mode         = Mode::Duration;
    uint32_t    durationSec  = 0;   // Duration mode: configured value.
                                     // Clock mode: computed at each start/re-arm.
    uint32_t    timeOfDaySec = 0;   // Clock mode only: local seconds-since-midnight.
    bool        repeat       = false;
    bool        hasOnExpire  = false;
    TargetKind  targetKind   = TargetKind::Actuator;
    std::string targetId;
    bool        targetStart  = false;  // true = start, false = stop

    // Runtime state (persisted for reboot-resume):
    Status   status            = Status::Idle;
    time_t   startedEpoch      = 0;  // wall-clock start while running
    uint32_t elapsedAtPauseSec = 0;  // frozen elapsed while paused
  };

  std::vector<Timer> timers_;

  // Guards timers_ against concurrent access from the AsyncTCP task (REST
  // handlers) and the loopTask (tick). Recursive so saveToSD -> serialize
  // while locked doesn't self-deadlock.
  mutable SemaphoreHandle_t mutex_ = nullptr;

  std::function<void(const char*, const char*)> onExpired_;

  Timer* find_(const char* id);

  static void fireOnExpire_(const Timer& t, SensActCtrl::Registry& reg,
                            ProgramRunner& programs);

  static String generateId();
  static bool   fillFromJson(Timer& t, const JsonObject& cfg);
  static const char* statusToStr(Status s);
  static Status statusFromStr(const char* s);
};

}  // namespace BrewControl
