#pragma once

#include <ArduinoJson.h>
#include <FS.h>
#include <OneWire.h>
#include <SensActCtrl.h>
#include <memory>
#include <string>
#include <vector>

namespace BrewControl {

// Owns heap-allocated sensors/actuators/controllers created via the web API.
// All string IDs are stored in stable heap memory (inside unique_ptr<Entry>)
// so that id() pointers remain valid even if the entry vectors reallocate.
// Persists to /config/registry.json on the SD filesystem.
class DynamicItems {
 public:
  struct Result { bool ok; const char* error = ""; };

  // Create and register a new item. Calls item.begin() immediately (if
  // markInitialized() has already been called; otherwise begin() is deferred
  // to registry.begin(), which loadFromSD() relies on).
  Result addSensor(const JsonObject& cfg, SensActCtrl::Registry& reg);
  Result addActuator(const JsonObject& cfg, SensActCtrl::Registry& reg);
  Result addController(const JsonObject& cfg, SensActCtrl::Registry& reg);

  // Unregister and free a dynamic item. Returns {false, reason} if the id is
  // not found in dynamic items (caller should send 405) or if a sensor /
  // actuator is still referenced by a dynamic controller (send 409).
  Result removeSensor(const char* id, SensActCtrl::Registry& reg);
  Result removeActuator(const char* id, SensActCtrl::Registry& reg);
  Result removeController(const char* id, SensActCtrl::Registry& reg);

  // Parse /config/registry.json and register items WITHOUT calling begin().
  // Call before registry.begin() so registry.begin() handles all items.
  void loadFromSD(fs::FS& sd, SensActCtrl::Registry& reg);

  // Must be called after registry.begin(). Future add*() calls will then
  // call begin() on each newly created item.
  void markInitialized() { initialized_ = true; }

  // Write current dynamic item set to /config/registry.json.
  void saveToSD(fs::FS& sd) const;

 private:
  struct SensorEntry {
    std::string id;
    std::string cfgJson;
    std::unique_ptr<SensActCtrl::Sensor> ptr;
  };
  struct ActuatorEntry {
    std::string id;
    std::string cfgJson;
    std::unique_ptr<SensActCtrl::Actuator> ptr;
  };
  struct CtrlEntry {
    std::string id;
    std::string sensorId;
    std::string actuatorId;
    std::string cfgJson;
    std::unique_ptr<SensActCtrl::Controller> ptr;
  };

  // Shared OneWire bus instances keyed by pin. Declared before sensors_ so
  // that C++ destroys sensors first (reverse declaration order), then buses.
  struct BusEntry { int pin; std::unique_ptr<OneWire> ow; };
  std::vector<BusEntry> onewireBuses_;

  // Entries are heap-allocated so that vector reallocation doesn't
  // invalidate id.c_str() pointers held by the library objects.
  std::vector<std::unique_ptr<SensorEntry>> sensors_;
  std::vector<std::unique_ptr<ActuatorEntry>> actuators_;
  std::vector<std::unique_ptr<CtrlEntry>> controllers_;

  bool initialized_ = false;

  // Internal variants that do NOT call begin() — used by loadFromSD.
  Result addSensorNoBegin(const JsonObject& cfg, SensActCtrl::Registry& reg);
  Result addActuatorNoBegin(const JsonObject& cfg, SensActCtrl::Registry& reg);
  Result addControllerNoBegin(const JsonObject& cfg, SensActCtrl::Registry& reg);

  OneWire& getOrCreateBus(int pin);
  static bool parseHexAddress(const char* hex, uint8_t out[8]);
};

}  // namespace BrewControl
