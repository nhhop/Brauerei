#pragma once

#include <ArduinoJson.h>
#include <FS.h>
#include <SensActCtrl.h>
#ifdef ARDUINO
#include <actuators/IdsActuator.h>
#endif
#include <functional>
#include <memory>
#include <string>
#include <transport/ITransport.h>
#include <vector>

#include "BusConfig.h"
#include "DeviceConfig.h"
#include "I2cAddressMap.h"
#include "PeripheralRegistry.h"
#include "PinMap.h"

namespace BrewControl {

class WebhookService;

// Owns heap-allocated sensors/actuators/controllers created via the web API.
// All string IDs are stored in stable heap memory (inside unique_ptr<Entry>)
// so that id() pointers remain valid even if the entry vectors reallocate.
// Persists to /config/registry.json on the SD filesystem.
class DynamicItems {
 public:
  // conflict: the request clashes with the current state (pin taken, no RMT
  // channel left, still referenced by a controller) — callers send 409.
  struct Result { bool ok; const char* error = ""; bool conflict = false; };

  // Starts with the board's fixed buses (BoardPins.h currentFixedBuses).
  DynamicItems();

  // Create and register a new item. Calls item.begin() immediately (if
  // markInitialized() has already been called; otherwise begin() is deferred
  // to registry.begin(), which loadFromSD() relies on). Sensors and actuators
  // are checked against the board's pin table first (PinMap.h).
  Result addSensor(const JsonObject& cfg, SensActCtrl::Registry& reg);
  Result addActuator(const JsonObject& cfg, SensActCtrl::Registry& reg);
  Result addController(const JsonObject& cfg, SensActCtrl::Registry& reg);

  // Replace a dynamic item by a new config (full config, the id may change).
  // Pins are checked with the old item's own pins counted as free; then the
  // old item is removed and the new one created. If creating fails, the old
  // item is recreated from its saved config, so a failed edit loses nothing.
  // {false, "not a dynamic item"} → 404; a sensor/actuator still referenced
  // by a controller is refused with conflict set, as in remove*.
  Result replaceSensor(const char* oldId, const JsonObject& cfg, SensActCtrl::Registry& reg);
  Result replaceActuator(const char* oldId, const JsonObject& cfg, SensActCtrl::Registry& reg);
  Result replaceController(const char* oldId, const JsonObject& cfg, SensActCtrl::Registry& reg);

  // GPIOs occupied by the buses, sensors and actuators (GET /api/pins), plus
  // the deep-sleep wake pin.
  std::vector<PinUse> pinUses() const;

  // The wake pin from the energy settings (-1 = none), kept free of items.
  void setWakePin(int gpio, bool pullup) {
    wakePin_ = gpio;
    wakePullup_ = pullup;
  }

  // True if a dynamic controller drives this actuator (the check removeActuator
  // refuses on).
  bool drivenByController(const char* actuatorId) const;
  // Same for a sensor (or one of its channels) as a controller's input.
  bool referencedByController(const char* sensorId) const;

  // Copies each controller's live tunable parameters (gains, deadband,
  // hysteresis, differentials, cycle limits, changeover, rate limit) into its
  // stored config where they differ — an AutoTune result, a POST .../params
  // or a /tune message would otherwise be lost on the next reboot, and the
  // edit dialog would offer the old values. True if a config changed; the
  // caller persists with saveToSD().
  bool syncTunedParams();

  // Claims the board's fixed I2C bus once at boot (LilyGo: the display/touch
  // needs it before any dynamic item exists) and holds it forever. No-op on
  // boards without a fixed I2C bus.
  void acquireBoardI2cBus();

  // Bus definitions (BusConfig.h), GET/POST/PUT/DELETE /api/buses. A bus is
  // defined with its pins; items reference it by id. The bus may only go
  // while no item uses it; fixed buses never change (conflict). newId
  // receives the id derived from type and pins. updateBus keeps the id and
  // re-pins the running driver; on SPI the MAX31865s on it are rebuilt, which
  // a controller reference blocks. Errors point into busError_ (valid until
  // the next call).
  Result addBus(const JsonObject& def, std::string& newId);
  Result updateBus(const char* id, const JsonObject& def, SensActCtrl::Registry& reg);
  Result removeBus(const char* id);
  const BusDef* findBus(const char* id) const;
  // {buses: [definition + fixed/note/reserved/users], types: [...]}.
  void writeBuses(JsonObject out) const;

  // Peripheral devices (DeviceConfig.h), GET/POST/PUT/DELETE
  // /api/peripherals. A device sits on a defined bus at an address; items
  // reference its channels as "<id>:<channel>" in a pin field. The label may
  // always change; bus and address (and with them the id) only while no item
  // uses the device, which may only go then too (conflict). The address is
  // checked against the bus like an item's. Errors point into busError_.
  Result addDevice(const JsonObject& def, std::string& newId);
  Result updateDevice(const char* id, const JsonObject& def, std::string& newId);
  Result removeDevice(const char* id);
  const std::vector<DeviceDef>& devices() const { return devices_; }
  // {devices: [definition + cap/channels with their users], types: [...]}.
  void writeDevices(JsonObject out) const;

  // Unregister and free a dynamic item. Returns {false, reason} if the id is
  // not found in dynamic items (caller should send 405) or if a sensor /
  // actuator is still referenced by a dynamic controller (send 409).
  Result removeSensor(const char* id, SensActCtrl::Registry& reg);
  Result removeActuator(const char* id, SensActCtrl::Registry& reg);
  Result removeController(const char* id, SensActCtrl::Registry& reg);

  // Reset a sensor's accumulated state (e.g. YF_S201Sensor::resetVolume()).
  // Returns {false, reason} if sensor not found or does not support reset.
  Result resetSensor(const char* id);

  // Calibration (SensActCtrl::CalibratedSensor — every dynamic sensor is
  // wrapped). Values are persisted as the "calibrations" array of the sensor's
  // config; callers save afterwards (saveToSD).
  // getCalibration fills out["channels"] with the live raw/calibrated value
  // per channel. calibrateSensor takes {channel, mode: offset|gain|twopoint,
  // points: [{raw?, value}]}; an omitted raw means "the current live raw".
  // clearCalibration resets one channel, or all when channelKey is nullptr.
  Result getCalibration(const char* id, JsonDocument& out) const;
  Result calibrateSensor(const char* id, const JsonObjectConst& body);
  Result clearCalibration(const char* id, const char* channelKey);

  // Set (or, with label == "", clear) a dynamic item's display label. Unlike
  // an id change, this never touches removeSensor/removeActuator's
  // controller-reference check, so it works even while the item is wired to
  // a controller. Returns {false, "not a dynamic item"} if id is unknown.
  Result setSensorLabel(const char* id, SensActCtrl::Registry& reg, const char* label);
  Result setActuatorLabel(const char* id, SensActCtrl::Registry& reg, const char* label);
  Result setControllerLabel(const char* id, SensActCtrl::Registry& reg, const char* label);

  // Parse /config/registry.json and register items WITHOUT calling begin().
  // Call before registry.begin() so registry.begin() handles all items.
  // Items from before buses were configurable are moved onto buses
  // (normalizeLegacyItem) and the file is rewritten once.
  void loadFromSD(fs::FS& sd, SensActCtrl::Registry& reg);

  // Must be called after registry.begin(). Future add*() calls will then
  // call begin() on each newly created item.
  void markInitialized() { initialized_ = true; }

  // Write current dynamic item set to /config/registry.json.
  void saveToSD(fs::FS& sd) const;

  // Serialize original config JSON for all dynamic items and user-defined
  // buses (same shape as registry.json) — used by GET /api/config and backups.
  String serializeConfig() const;

  // Scans a defined bus and writes {bus, type, devices: [{index, address}]}:
  // DS18B20 ROM codes (16 hex chars) on OneWire, "0x5a"-style addresses on
  // I2C. Reuses the running driver if items use the bus, otherwise starts it
  // just for the scan. {false, "bus not found"} → 404; SPI cannot be
  // scanned → 400. Call under the RegistryLock.
  Result scanBus(const char* id, JsonObject out);

  // Optional observers, fired around add*()/remove*() (only for items added
  // after markInitialized() — loadFromSD() uses the NoBegin path and does not
  // trigger these). "Added" fires after the item's begin(); "Removing" fires
  // before the item is freed, so the callback can still safely reference it
  // (e.g. to detach it from a live subscriber like MqttService before the
  // unique_ptr destroys it). Multiple observers may register (each set*
  // call adds another one, in registration order) — MqttService,
  // WebhookService, WebSocketService, and EspNowPublishService all track
  // live add/remove independently.
  void setOnSensorAdded(std::function<void(SensActCtrl::Sensor&)> cb) { onSensorAdded_.push_back(std::move(cb)); }
  void setOnSensorRemoving(std::function<void(SensActCtrl::Sensor&)> cb) { onSensorRemoving_.push_back(std::move(cb)); }
  void setOnActuatorAdded(std::function<void(SensActCtrl::Actuator&)> cb) { onActuatorAdded_.push_back(std::move(cb)); }
  void setOnActuatorRemoving(std::function<void(SensActCtrl::Actuator&)> cb) { onActuatorRemoving_.push_back(std::move(cb)); }
  void setOnControllerAdded(std::function<void(SensActCtrl::Controller&)> cb) { onControllerAdded_.push_back(std::move(cb)); }
  void setOnControllerRemoving(std::function<void(SensActCtrl::Controller&)> cb) { onControllerRemoving_.push_back(std::move(cb)); }

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

  // Remote items with transport:"espnow" use this shared broadcast
  // transport. Nullable like mqttTransport_ (constructed only after WiFi
  // connects — see main.cpp) — must be set before loadFromSD()/add*() are
  // called for such items.
  void setEspNowTransport(SensActCtrl::ITransport* t) { espNowTransport_ = t; }

  // Remote items with transport:"websocket" all ride this one hub server
  // (WebSocketService). nullptr if the hub is disabled in settings — such
  // items are then rejected at load/add time. Must be set before
  // loadFromSD()/add*() are called for such items.
  void setWebSocketHubTransport(SensActCtrl::ITransport* t) { webSocketHubTransport_ = t; }

 private:
  struct SensorEntry {
    std::string id;
    std::string cfgJson;
    // The bus the sensor sits on (DS18B20, BME280/GY521, MAX31865 with a
    // bus), empty otherwise. Declared before the sensor so it outlives
    // it; dropping the entry releases the bus.
    PeripheralRegistry::Ref bus;
    // The peripheral device whose channel the sensor reads (DigitalInput on
    // a PCF8575), empty otherwise; outlives the sensor like bus.
    PeripheralRegistry::Ref dev;
    // innerPtr holds the concrete sensor; ptr is the CalibratedSensor wrapped
    // around it and is what's registered with the Registry (cal points at it).
    // Declared inner-first so the wrapper is destroyed before what it wraps.
    std::unique_ptr<SensActCtrl::Sensor> innerPtr;
    std::unique_ptr<SensActCtrl::Sensor> ptr;
    SensActCtrl::CalibratedSensor* cal = nullptr;
    std::function<void()> resetFn;  // non-null only for sensors that support reset
  };

  // Rewrites e.cfgJson: drops the legacy per-sensor calibration keys (HX711
  // scale, YF-S201 calibration, AnalogInput cal_*) and stores the current
  // calibration as the "calibrations" array.
  static void syncCalibrationConfig(SensorEntry& e);
  const SensorEntry* findSensorEntry(const char* id) const;
  SensorEntry* findSensorEntry(const char* id);
  struct ActuatorEntry {
    std::string id;
    std::string cfgJson;
    // The peripheral device whose channel the actuator drives (AnalogOutput
    // on an MCP4728, DigitalOutput on a PCF8575), empty otherwise. Declared before the actuator so the
    // device outlives it, as SensorEntry::bus does.
    PeripheralRegistry::Ref dev;
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

  // Shared buses and peripheral devices, created by their first user and
  // torn down with the last (PeripheralRegistry.h); a device is a user of its
  // bus. Declared before sensors_/actuators_ so that C++ destroys the items
  // first (reverse declaration order), then devices and buses.
  PeripheralRegistry peripherals_;
  // The board's fixed I2C bus, held for as long as acquireBoardI2cBus() has
  // been called (LilyGo: forever, from main.cpp) — see acquireBoardI2cBus().
  PeripheralRegistry::Ref boardI2cBus_;

  // Fixed buses first (never stored), then the user-defined ones in the
  // order they were added.
  std::vector<BusDef> buses_;
  std::string busError_;

  // The running driver of a defined bus, created on its first user.
  PeripheralRegistry::Ref acquireBus(const BusDef& d);
  // Ids of the items and devices referencing bus id.
  std::vector<std::string> busUsers(const std::string& id) const;
  // The user-defined buses as the JSON array stored in registry.json.
  std::string storedBusesJson() const;
  // Bus and device errors (the message lives in busError_).
  Result busFail(const std::string& msg, bool conflict);

  // In the order they were added; never more than one per bus address.
  std::vector<DeviceDef> devices_;
  // The running driver of a device, created on its first user; it holds its
  // bus. Empty if the device's bus is gone (cannot happen after a check).
  PeripheralRegistry::Ref acquireDevice(const DeviceDef& d);
  // The GPIO port of the device a "<device>:<channel>" pin names, acquired
  // into dev; nullptr if the device is unknown or has no such GPIO channel.
  SensActCtrl::GpioPort* acquireGpio(const PinRef& pin, PeripheralRegistry::Ref& dev);
  // Ids of the items using a channel of device id.
  std::vector<std::string> deviceUsers(const std::string& id) const;
  // The device's bus exists and has the right type, its address is free
  // there; replaceId's own address counts as free.
  Result checkDevice(const DeviceDef& d, const char* replaceId);
  std::string storedDevicesJson() const;

  // Entries are heap-allocated so that vector reallocation doesn't
  // invalidate id.c_str() pointers held by the library objects.
  std::vector<std::unique_ptr<SensorEntry>> sensors_;
  std::vector<std::unique_ptr<ActuatorEntry>> actuators_;
  std::vector<std::unique_ptr<CtrlEntry>> controllers_;

  bool initialized_ = false;

  std::vector<std::function<void(SensActCtrl::Sensor&)>> onSensorAdded_;
  std::vector<std::function<void(SensActCtrl::Sensor&)>> onSensorRemoving_;
  std::vector<std::function<void(SensActCtrl::Actuator&)>> onActuatorAdded_;
  std::vector<std::function<void(SensActCtrl::Actuator&)>> onActuatorRemoving_;
  std::vector<std::function<void(SensActCtrl::Controller&)>> onControllerAdded_;
  std::vector<std::function<void(SensActCtrl::Controller&)>> onControllerRemoving_;

  SensActCtrl::ITransport* mqttTransport_ = nullptr;
  WebhookService* webhookService_ = nullptr;
  SensActCtrl::ITransport* espNowTransport_ = nullptr;
  SensActCtrl::ITransport* webSocketHubTransport_ = nullptr;

  // Internal variants that do NOT call begin() — used by loadFromSD.
  Result addSensorNoBegin(const JsonObject& cfg, SensActCtrl::Registry& reg);
  Result addActuatorNoBegin(const JsonObject& cfg, SensActCtrl::Registry& reg);
  Result addControllerNoBegin(const JsonObject& cfg, SensActCtrl::Registry& reg);

  // add*() without the pin check — replace*() checks up front and must be
  // able to restore an old item even if its stored pins clash.
  Result addSensorUnchecked(const JsonObject& cfg, SensActCtrl::Registry& reg);
  Result addActuatorUnchecked(const JsonObject& cfg, SensActCtrl::Registry& reg);

  // Pin check against the board table; replaceId's own pins count as free.
  // The message of a failed check lives in pinError_, which Result.error then
  // points to (valid until the next check).
  Result checkPins(const JsonObject& cfg, const char* replaceId);
  std::string pinError_;
  int wakePin_ = -1;
  bool wakePullup_ = false;

  // I2C addresses occupied by the current sensors and devices (GET /api/pins
  // does not expose this — only create/replace check against it).
  std::vector<AddressUse> addressUses() const;

  // I2C address check against the reserved addresses of the item's bus and
  // the addresses already in use on it; replaceId's own address counts as free. The
  // message of a failed check lives in i2cAddressError_, which Result.error
  // then points to (valid until the next check).
  Result checkI2cAddress(const JsonObject& cfg, const char* replaceId);
  std::string i2cAddressError_;

  static bool parseHexAddress(const char* hex, uint8_t out[8]);

  // Resolves the ITransport for a "Remote" sensor/actuator from
  // cfg["transport"] ("mqtt", default, "webhook", "websocket" or "espnow") — shared by both
  // addSensorNoBegin and addActuatorNoBegin. On success sets *out and
  // returns {true}; on failure *out is untouched and the Result carries
  // the reason (missing transport / invalid config).
  Result resolveRemoteTransport(const JsonObject& cfg, SensActCtrl::ITransport** out);
};

}  // namespace BrewControl
