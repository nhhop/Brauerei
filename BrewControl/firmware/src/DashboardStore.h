#pragma once

#include <ArduinoJson.h>
#include <FS.h>
#include <string>
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

 private:
  struct DashboardCfg {
    std::string id;
    std::string name;
    std::vector<std::string> sensors;
    std::vector<std::string> actuators;
    std::vector<std::string> controllers;
    std::vector<std::string> charts;       // referenced log/chart IDs
  };

  std::vector<DashboardCfg> dashboards_;

  static String generateId();
  static void fillFromJson(DashboardCfg& d, const JsonObject& cfg);
};

}  // namespace BrewControl
