#pragma once

#include <ArduinoJson.h>
#include <FS.h>
#include <OneWire.h>
#include <SensActCtrl.h>
#ifdef ARDUINO
#include <actuators/IdsActuator.h>
#endif
#include <functional>
#include <memory>
#include <string>
#include <transport/ITransport.h>
#include <vector>

namespace BrewControl {

class WebhookService;

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

  // Reset a sensor's accumulated state (e.g. YF_S201Sensor::resetVolume()).
  // Returns {false, reason} if sensor not found or does not support reset.
  Result resetSensor(const char* id);

  // Parse /config/registry.json and register items WITHOUT calling begin().
  // Call before registry.begin() so registry.begin() handles all items.
  void loadFromSD(fs::FS& sd, SensActCtrl::Registry& reg);

  // Must be called after registry.begin(). Future add*() calls will then
  // call begin() on each newly created item.
  void markInitialized() { initialized_ = true; }

  // Write current dynamic item set to /config/registry.json.
  void saveToSD(fs::FS& sd) const;

  // Serialize original config JSON for all dynamic items — used by GET /api/config.
  String serializeConfig() const;

  // Scan a OneWire bus for DS18B20 ROM addresses. Reuses an existing bus
  // instance managed by DynamicItems if the pin is already in use, to avoid
  // creating a second conflicting OneWire driver on the same GPIO.
  uint8_t scanOneWireBus(int pin, uint8_t out[][8], uint8_t maxDevices);

  // Optional observers, fired around add*()/remove*() (only for items added
  // after markInitialized() — loadFromSD() uses the NoBegin path and does not
  // trigger these). "Added" fires after the item's begin(); "Removing" fires
  // before the item is freed, so the callback can still safely reference it
  // (e.g. to detach it from a live subscriber like MqttService before the
  // unique_ptr destroys it).
  void setOnSensorAdded(std::function<void(SensActCtrl::Sensor&)> cb) { onSensorAdded_ = cb; }
  void setOnSensorRemoving(std::function<void(SensActCtrl::Sensor&)> cb) { onSensorRemoving_ = cb; }
  void setOnActuatorAdded(std::function<void(SensActCtrl::Actuator&)> cb) { onActuatorAdded_ = cb; }
  void setOnActuatorRemoving(std::function<void(SensActCtrl::Actuator&)> cb) { onActuatorRemoving_ = cb; }
  void setOnControllerAdded(std::function<void(SensActCtrl::Controller&)> cb) { onControllerAdded_ = cb; }
  void setOnControllerRemoving(std::function<void(SensActCtrl::Controller&)> cb) { onControllerRemoving_ = cb; }

  // Transport actuators that publish over MQTT themselves (e.g. "MqttGeneric")
  // use to reach the broker MqttService already manages. nullptr if MQTT is
  // disabled/unsupported — items of that type are then rejected at load/add
  // time. Must be set before loadFromSD()/addActuator() are called for such
  // items.
  void setMqttTransport(SensActCtrl::ITransport* t) { mqttTransport_ = t; }

  // Remote items with transport:"webhook" use this to get (or create) a
  // shared WebhookTransport for their (listen_port, peer_url) pair. Unlike
  // MQTT, always available — no settings toggle, no nullability to guard
  // against. Must be set before loadFromSD()/addSensor()/addActuator() are
  // called for such items.
  void setWebhookService(WebhookService* svc) { webhookService_ = svc; }

 private:
  struct SensorEntry {
    std::string id;
    std::string cfgJson;
    std::unique_ptr<SensActCtrl::Sensor> ptr;
    std::function<void()> resetFn;  // non-null only for sensors that support reset
  };
  struct ActuatorEntry {
    std::string id;
    std::string cfgJson;
    // innerPtr holds the concrete actuator when wrapped by IntervalActuator
    // (interval_period_sec set); ptr is always what's registered with the
    // Registry. Mirrors CtrlEntry below.
    std::unique_ptr<SensActCtrl::Actuator> innerPtr;
    std::unique_ptr<SensActCtrl::Actuator> ptr;
  };
  struct CtrlEntry {
    std::string id;
    std::string sensorId;
    std::string actuatorId;      // heating actuator for dual-output controllers
    std::string coolActuatorId;  // cooling actuator (DualStage / SplitRangePID)
    std::string cfgJson;
    // innerPtr holds the concrete controller when wrapped by RateLimitedController
    // (max_rate_per_sec set); ptr is always what's registered with the Registry.
    std::unique_ptr<SensActCtrl::Controller> innerPtr;
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

  std::function<void(SensActCtrl::Sensor&)> onSensorAdded_;
  std::function<void(SensActCtrl::Sensor&)> onSensorRemoving_;
  std::function<void(SensActCtrl::Actuator&)> onActuatorAdded_;
  std::function<void(SensActCtrl::Actuator&)> onActuatorRemoving_;
  std::function<void(SensActCtrl::Controller&)> onControllerAdded_;
  std::function<void(SensActCtrl::Controller&)> onControllerRemoving_;

  SensActCtrl::ITransport* mqttTransport_ = nullptr;
  WebhookService* webhookService_ = nullptr;

  // Internal variants that do NOT call begin() — used by loadFromSD.
  Result addSensorNoBegin(const JsonObject& cfg, SensActCtrl::Registry& reg);
  Result addActuatorNoBegin(const JsonObject& cfg, SensActCtrl::Registry& reg);
  Result addControllerNoBegin(const JsonObject& cfg, SensActCtrl::Registry& reg);

  OneWire& getOrCreateBus(int pin);
  static bool parseHexAddress(const char* hex, uint8_t out[8]);

  // Resolves the ITransport for a "Remote" sensor/actuator from
  // cfg["transport"] ("mqtt", default, or "webhook") — shared by both
  // addSensorNoBegin and addActuatorNoBegin. On success sets *out and
  // returns {true}; on failure *out is untouched and the Result carries
  // the reason (missing transport / invalid config).
  Result resolveRemoteTransport(const JsonObject& cfg, SensActCtrl::ITransport** out);
};

}  // namespace BrewControl
