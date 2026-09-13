#pragma once

#include <ArduinoJson.h>
#include <FS.h>
#include <SensActCtrl.h>
#include <freertos/FreeRTOS.h>
#include <freertos/semphr.h>
#include <time.h>

#include <string>
#include <vector>

#include "Condition.h"

namespace BrewControl {

// Watches the registry and turns five things into a single stream of alerts:
// user-defined threshold rules, driver fault() strings, setpoint-program
// run-state changes, PID autotune completion, and timer expiry.
//
// Rules are persisted to /config/alarms.json; the alert history is a RAM ring
// that is deliberately lost on reboot — an active threshold or fault re-raises
// itself on the next tick anyway.
//
// Unlike LogStore and ProgramRunner this does NOT wait for NTP: an alert
// suppressed because the clock is unset is lost forever, and the first minute
// after boot is exactly when a wiring fault shows up. Alerts raised before the
// sync carry ts == 0; debounce runs on millis() throughout.
class AlarmStore {
 public:
  enum Severity : uint8_t { SevInfo = 0, SevWarning = 1, SevCritical = 2 };

  // Fixed-width POD so the ring is a deterministic ~5.8 KB in .bss instead of
  // 40 heap allocations next to WiFi, AsyncTCP and the SD buffers. Public
  // because PushService consumes alerts as structs rather than re-parsing the
  // JSON that takePending() emits.
  struct Alert {
    uint32_t seq  = 0;
    time_t   ts   = 0;
    float    v    = 0.0f;
    bool     hasV = false;
    uint8_t  sev  = SevWarning;
    bool     cleared = false;
    char     kind[10]   = "";  // threshold | fault | program | autotune | timer
    char     src[40]    = "";  // sensor/<id> | actuator/<id> | controller/<id> | program/<id> | timer/<id>
    char     name[32]   = "";
    char     rule[8]    = "";
    char     detail[48] = "";
  };

  AlarmStore();

  void loadFromSD(fs::FS& sd);
  void saveToSD(fs::FS& sd) const;

  // JSON array of rules incl. their live latch state. GET /api/alarms.
  String serialize() const;

  // Create from cfg {name, enabled?, severity?, forSec?, cond:{ref,op,value,hyst?}}.
  // Returns the generated id, or "" if the config is invalid.
  String add(const JsonObject& cfg);

  // Replace a rule's definition and reset its latch. False if id not found or
  // the new config is invalid.
  bool update(const char* id, const JsonObject& cfg);

  bool remove(const char* id);

  // Enable/disable without touching the definition. Disabling clears the latch
  // so re-enabling cannot emit a stale "cleared". False if id not found.
  bool setEnabled(const char* id, bool enabled);

  // JSON array of the alert ring, ascending by seq. sinceSeq > 0 returns only
  // alerts newer than that — the client's catch-up path after a reconnect or a
  // push the event source dropped. GET /api/alerts.
  String serializeAlerts(uint32_t sinceSeq = 0) const;

  // Empties the history. Leaves rule latches alone: a still-active alarm must
  // not re-fire just because the list was wiped.
  void clearAlerts();

  // Evaluates every enabled rule plus the built-in fault/autotune detectors.
  // nowEpoch stamps the alerts (0 before NTP sync), nowMs drives debounce and
  // the re-arm guard. Never touches the filesystem.
  void tick(SensActCtrl::Registry& reg, time_t nowEpoch, uint32_t nowMs);

  // Program run-state transition, pushed by ProgramRunner. Called with the
  // runner's lock held and possibly from the AsyncTCP task, so it only writes
  // into the ring — it must never call back into ProgramRunner.
  void onProgramStatus(const char* id, const char* name, const char* status,
                       time_t nowEpoch, uint32_t nowMs);

  // Timer expiry, pushed by TimerStore. Called with the store's lock held and
  // possibly from the AsyncTCP task, so it only writes into the ring — it must
  // never call back into TimerStore.
  void onTimerExpired(const char* id, const char* name, time_t nowEpoch,
                      uint32_t nowMs);

  // Pops the oldest alert not yet pushed over SSE as a JSON object string.
  // False when the outbox is empty. Sending happens in WebUI::tick so that
  // raise_() stays allocation- and network-free on whichever task called it.
  bool takePending(String& out);

  // Same outbox, second reader: PushService gets its own cursor so draining
  // for SSE and draining for Web Push cannot steal alerts from each other.
  // Also drained in WebUI::tick, on loopTask.
  bool takePendingPush(Alert& out);

 private:

  static constexpr size_t   kRing     = 40;
  static constexpr uint32_t kReArmMs  = 5000;   // per source, against flapping
  static constexpr uint32_t kMaxForSec = 3600;

  struct Rule {
    std::string id;
    std::string name;
    bool        enabled  = true;
    Severity    severity = SevWarning;
    Condition   cond;
    uint32_t    forSec   = 0;
    // Runtime latch (never persisted, never in the create/update body):
    bool     active     = false;  // hysteresis latch
    bool     firing     = false;  // debounce elapsed, "raised" already emitted
    bool     resolved   = false;  // ref pointed at a live value on the last tick
    uint32_t activeMs   = 0;      // millis() when `active` went true
    uint32_t lastRaiseMs = 0;
    time_t   since      = 0;      // epoch of the raise, 0 if pre-NTP
  };

  // Edge-detection state for one live registry item, rebuilt each tick by a
  // mark-and-sweep so deleted items drop out without a DynamicItems observer.
  struct EdgeState {
    std::string key;               // same shape as a ref
    std::string fault;             // last seen fault() text, "" = none
    bool        tuneDone    = false;
    bool        seen        = false;
    uint32_t    lastRaiseMs = 0;
  };

  std::vector<Rule>      rules_;
  std::vector<EdgeState> edges_;
  Alert    ring_[kRing];
  size_t   ringCount_ = 0;
  size_t   ringHead_  = 0;   // next write slot
  uint32_t nextSeq_   = 1;
  uint32_t pushedSeq_ = 0;   // highest seq already handed to takePending
  uint32_t pushedSeqPush_ = 0;  // ... and to takePendingPush, tracked apart

  // Guards rules_, edges_ and the ring. tick()/takePending() run on loopTask,
  // the REST handlers and onProgramStatus on the AsyncTCP task. Recursive so
  // saveToSD → serialize while locked doesn't self-deadlock.
  mutable SemaphoreHandle_t mutex_ = nullptr;

  Rule*      find_(const char* id);
  EdgeState& edge_(const std::string& key);

  // Appends to the ring. Caller holds the lock.
  void raise_(const char* kind, const char* src, const char* name,
              const char* rule, Severity sev, bool cleared, const float* v,
              const char* detail, time_t nowEpoch);
  void alertToJson_(const Alert& a, JsonObject o) const;

  void tickThresholds_(SensActCtrl::Registry& reg, time_t nowEpoch, uint32_t nowMs);
  void tickFaults_(SensActCtrl::Registry& reg, time_t nowEpoch, uint32_t nowMs);
  void tickAutotune_(SensActCtrl::Registry& reg, time_t nowEpoch);

  static String   generateId();
  static bool     fillFromJson(Rule& r, const JsonObject& cfg);
  static Severity severityFromStr(const char* s);
  static const char* severityToStr(Severity s);
};

}  // namespace BrewControl
