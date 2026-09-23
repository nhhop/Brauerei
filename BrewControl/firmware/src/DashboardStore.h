#pragma once

#include <ArduinoJson.h>
#include <FS.h>
#include <freertos/FreeRTOS.h>
#include <freertos/semphr.h>
#include <algorithm>
#include <string>
#include <utility>
#include <vector>

namespace BrewControl {

// Stores user-defined dashboard configurations.
// Each dashboard is a named subset of sensor/actuator/controller IDs.
// Persists to /config/dashboards.json on the SD filesystem.
class DashboardStore {
 public:
  void loadFromSD(fs::FS& sd);
  void saveToSD(fs::FS& sd) const;

  // Serializes all dashboards as a JSON array string.
  String serialize() const;

  // Creates a new dashboard from cfg {name, sensors[], actuators[], controllers[]}.
  // Returns the generated id.
  String add(const JsonObject& cfg);

  // Replaces an existing dashboard's fields. Returns false if id not found.
  bool update(const char* id, const JsonObject& cfg);

  // Removes a dashboard. Returns false if id not found.
  bool remove(const char* id);

  // Swaps a dashboard with its left/right neighbor (dir = -1 left, +1 right).
  // No-op (returns true, no change) if id sits at that edge already.
  // Returns false if id not found.
  bool move(const char* id, int dir);

  // Bumped by every load/add/update/remove/move, so a reader can tell that
  // its copy is stale without comparing contents.
  uint32_t revision() const { return revision_; }

  // Number of dashboards, and a copy of the item lists of the one at index
  // (0 = the leftmost tab in the UI; false if out of range). Safe to call
  // from loopTask while the AsyncTCP task edits the store.
  struct Items {
    std::string name;
    std::vector<std::string> sensors;
    std::vector<std::string> actuators;
    std::vector<std::string> controllers;
  };
  size_t count() const;
  bool dashboardAt(size_t index, Items& out) const;

 private:
  struct DashboardCfg {
    std::string id;
    std::string name;
    std::vector<std::string> sensors;
    std::vector<std::string> actuators;
    std::vector<std::string> controllers;
    std::vector<std::string> charts;       // referenced log/chart IDs
    std::vector<std::string> programs;     // referenced setpoint-program IDs
    std::vector<std::string> timers;       // referenced timer IDs
    // Per-widget display mode ("compact"/"gauge"), id -> mode. "normal" is
    // never stored — an id simply absent here means "normal". Opaque to the
    // firmware, interpreted only by the frontend.
    std::vector<std::pair<std::string, std::string>> sensorModes;
    std::vector<std::pair<std::string, std::string>> controllerModes;
    std::vector<std::pair<std::string, std::string>> timerModes;
    // How the widgets are arranged (tree of areas). Written and read by the
    // frontend only; the firmware stores and returns it verbatim. Null when a
    // dashboard has never been arranged, which makes the UI derive a default.
    JsonDocument layout;
  };

  std::vector<DashboardCfg> dashboards_;
  uint32_t revision_ = 0;

  // Guards dashboards_: the REST handlers write from the AsyncTCP task, the
  // display reads from loopTask. Recursive so saveToSD -> serialize while
  // locked doesn't self-deadlock.
  mutable SemaphoreHandle_t mutex_ = xSemaphoreCreateRecursiveMutex();

  static String generateId();
  static void fillFromJson(DashboardCfg& d, const JsonObject& cfg);
};

}  // namespace BrewControl
