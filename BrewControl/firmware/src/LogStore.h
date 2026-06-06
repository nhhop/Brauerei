#pragma once

#include <ArduinoJson.h>
#include <FS.h>
#include <SensActCtrl.h>
#include <time.h>

#include <string>
#include <vector>

#include "LogCompressor.h"

namespace BrewControl {

// Stores user-defined data-log configurations and samples the registry into
// per-session CSV files on the SD card. A log config is also the chart config:
// the same series list drives both the CSV columns and the frontend plot.
//
// One CSV per session at /logs/<id>/<startEpoch>.csv with a shared timestamp
// column. Phase 1 samples at a fixed intervalSec (no dead-band yet) and rounds
// each value to the channel resolution. Invalid readings are written as empty
// cells. Persists the config list to /config/logs.json.
class LogStore {
 public:
  void loadFromSD(fs::FS& sd);
  void saveToSD(fs::FS& sd) const;

  // Serializes all log configs as a JSON array string (GET /api/logs).
  String serialize() const;

  // Creates a new log from cfg {name, intervalSec, series:[{ref,tol},…]}.
  // Returns the generated id.
  String add(const JsonObject& cfg);

  // Replaces an existing log's fields. Returns false if id not found.
  bool update(const char* id, const JsonObject& cfg);

  // Removes a log config (leaves its CSV sessions on disk). False if not found.
  bool remove(const char* id);

  // Enables/disables background logging without touching the session. False if
  // id not found. Persist with saveToSD afterwards.
  bool setEnabled(const char* id, bool enabled);

  // Closes the current session so the next sample starts a fresh timestamped
  // file. Does not delete anything. False if id not found.
  bool clear(const char* id);

  // JSON array of completed/active sessions for `id`:
  // [{"start":<epoch>,"size":<bytes>,"active":<bool>}, …]. "[]" if unknown id.
  String serializeSessions(const char* id, fs::FS& sd) const;

  // Deletes one session file (never the active one). False if not found/active.
  bool deleteSession(const char* id, time_t start, fs::FS& sd);

  // Samples every configured log whose interval has elapsed and appends a row
  // to its current session file. nowEpoch is the wall-clock time (Unix s) used
  // for the timestamp column; nowMs is millis() used for interval gating.
  // No-op for a log until nowEpoch is a real (post-2000) time.
  void tick(SensActCtrl::Registry& reg, fs::FS& sd, time_t nowEpoch,
            uint32_t nowMs);

  // Absolute path of a session CSV for `id`. start==0 → the current session.
  // Returns "" if the id is unknown (or no current session for start==0).
  String sessionPath(const char* id, time_t start = 0) const;

 private:
  struct Series {
    std::string ref;          // "<role>/<snapshotId>", e.g. "sensor/bme280.temp"
    float       tol = 0.0f;   // dead-band tolerance (unused in phase 1)
  };

  struct LogCfg {
    std::string id;
    std::string name;
    uint32_t    intervalSec = 5;
    std::vector<Series> series;
    CompAlgo    algo      = CompAlgo::None;
    uint32_t    maxGapSec = 600;   // safety point: force a row after this gap
    bool        enabled   = true;  // background logging on/off
    std::string bindEnableTo;      // controller id; if set, enabled follows it
    // Runtime state (not persisted):
    time_t        sessionStart = 0;  // 0 = no session file opened yet
    uint32_t      lastSampleMs = 0;
    bool          firstSample  = true;
    bool          loggingActive = false;  // last-tick effective-enabled state
    LogCompressor comp;

    // Rebuilds the compressor from the current series tolerances + algo.
    void reconfigure() {
      std::vector<float> tols;
      tols.reserve(series.size());
      for (const auto& s : series) tols.push_back(s.tol);
      comp.configure(algo, maxGapSec, std::move(tols));
    }
  };

  // Resolved current value of a single series.
  struct Value {
    float value = 0.0f;
    bool  valid = false;
    float res   = 0.0f;
  };

  static Value resolve(SensActCtrl::Registry& reg, const std::string& ref);

  std::vector<LogCfg> logs_;

  // Writes one emitted row to l's current session (creating it + header on
  // first write), then enforces the global storage budget. nowEpoch seeds a
  // new session's start time.
  void writeEmitted_(fs::FS& sd, LogCfg& l, const LogSample& row, time_t nowEpoch);

  // Deletes the oldest non-active session files across all logs until the
  // total /logs size is within the budget.
  void pruneToBudget_(fs::FS& sd);

  static String generateId();
  static void   fillFromJson(LogCfg& l, const JsonObject& cfg);
};

}  // namespace BrewControl
