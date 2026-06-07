#pragma once

#include <Arduino.h>
#include <ESPAsyncWebServer.h>
#include <FS.h>
#include <SensActCtrl.h>

#include <memory>

#include "DashboardStore.h"
#include "DynamicItems.h"
#include "FirmwareUpdater.h"
#include "LogStore.h"
#include "SdTarSink.h"
#include "SettingsStore.h"
#include "TarExtractor.h"

namespace BrewControl {

// Browser-facing HTTP + SSE layer for a SensActCtrl Registry.
//
// Routes:
//   GET  /api/snapshot                      — current registry state (JSON)
//   GET  /api/events                        — SSE; "snapshot" event on
//                                             connect, every 1 s, and after
//                                             every write or add/remove
//   POST /api/sensors                       — create dynamic sensor
//   POST /api/actuators                     — create dynamic actuator
//   POST /api/controllers                   — create dynamic controller
//   DELETE /api/sensors/<id>               — remove dynamic sensor
//   DELETE /api/actuators/<id>             — remove dynamic actuator (405 if static)
//   DELETE /api/controllers/<id>           — remove dynamic controller (405 if static)
//   POST /api/actuators/<id>               — {"v":<float>} → Actuator::write
//   POST /api/controllers/<id>/setpoint    — {"v":<float>}
//   POST /api/controllers/<id>/params      — raw controller-params JSON
//   POST /api/admin/wifi-reset             — clear WiFi creds, reboot
//   GET  /api/network                      — STA status + hostname (JSON)
//   GET  /api/network/scan                 — async WiFi scan (202 → 200+JSON)
//   POST /api/network                      — set SSID/password and/or hostname, reboot
//   GET  /api/backup                       — download config bundle as JSON
//   POST /api/backup                       — restore config bundle, reboot
//   GET  /api/logs                         — list data-log configs (JSON)
//   POST /api/logs                         — create data-log config
//   POST /api/logs/<id>                    — update data-log config
//   DELETE /api/logs/<id>                  — remove data-log config
//   POST /api/logs/<id>/enable             — {"enabled":bool} toggle logging
//   POST /api/logs/<id>/clear              — start a fresh session
//   GET  /api/logs/<id>/data[?session=N]   — session CSV (current or archived)
//   GET  /api/logs/<id>/download[?session=N] — session CSV (attachment)
//   GET  /api/logs/<id>/sessions           — list sessions (JSON)
//   DELETE /api/logs/<id>/sessions/<start> — delete one archived session
//   GET  /api/bus/scan?type=onewire&pin=N  — enumerate ROM addresses on OneWire bus
//   GET  /*                                — SD static (default index.html)
//
// Concurrency: serializeRegistry runs from the AsyncTCP task while
// Registry::tick runs from loopTask. Reading values are non-atomic — a
// torn read is theoretically possible but tolerated for the dashboard use.
class WebUI {
 public:
  WebUI(SensActCtrl::Registry& reg, fs::FS& fs, DynamicItems& items,
        DashboardStore& store, SettingsStore& settings, FirmwareUpdater& updater,
        LogStore& logs, uint16_t port = 80);

  // Must be called after registry.begin() and dynamicItems.markInitialized().
  void begin();

  // Call once per loop() iteration. Broadcasts a fresh snapshot every 1 s.
  void tick();

 private:
  void pushSnapshot_();
  void sendSnapshotTo_(AsyncEventSourceClient* client);
  void swapAssets_();
  // Writes one backup section (a JSON object/array) verbatim to `path`.
  bool writeSection_(const char* path, ArduinoJson::JsonVariantConst v);

  SensActCtrl::Registry& reg_;
  fs::FS& fs_;
  DynamicItems& items_;
  DashboardStore& store_;
  SettingsStore& settings_;
  FirmwareUpdater& updater_;
  LogStore& logs_;
  AsyncWebServer server_;
  AsyncEventSource events_;
  uint32_t lastPushMs_ = 0;
  uint32_t rebootAtMs_ = 0;

  std::unique_ptr<SdTarSink> assetSink_;
  std::unique_ptr<TarExtractor> assetTar_;
  bool assetSwapPending_ = false;
};

}  // namespace BrewControl
