#pragma once

#include <ArduinoJson.h>
#include <FS.h>
#include <freertos/FreeRTOS.h>
#include <freertos/semphr.h>
#include <time.h>

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
  // invalid for the current state (400).
  Result control(const char* id, const char* action);

  // Advance running timers past their duration to "done" and persist on
  // transitions. nowEpoch is the wall-clock time (Unix s). No-op until
  // nowEpoch is a real (post-2000) time.
  void tick(fs::FS& sd, time_t nowEpoch);

  // Fired once per timer when it expires (Running -> Done via tick()). Runs
  // on the loopTask, with this store's lock held, so the callback must not
  // call back into it. Restoring persisted state in loadFromSD deliberately
  // does not fire, nor does an already-Done timer on a later tick.
  void setOnExpired(std::function<void(const char* id, const char* name)> cb) {
    onExpired_ = std::move(cb);
  }

 private:
  enum class Status { Idle, Running, Paused, Done };

  struct Timer {
    std::string id;
    std::string name;
    uint32_t    durationSec = 0;
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

  static String generateId();
  static bool   fillFromJson(Timer& t, const JsonObject& cfg);
  static const char* statusToStr(Status s);
  static Status statusFromStr(const char* s);
};

}  // namespace BrewControl
