#pragma once

#include <Arduino.h>
#include <ESPAsyncWebServer.h>
#include <FS.h>
#include <SensActCtrl.h>

#include <memory>
#include <mutex>

#include "AlarmStore.h"
#include "AuthService.h"
#include "DashboardStore.h"
#include "DynamicItems.h"
#include "EspNowPublishService.h"
#include "FirmwareUpdater.h"
#include "LogStore.h"
#include "MdnsBrowser.h"
#include "MqttService.h"
#include "ProfileStore.h"
#include "ProgramRunner.h"
#include "PushService.h"
#include "RemoteDiscovery.h"
#include "SdTarSink.h"
#include "SettingsStore.h"
#include "TarExtractor.h"
#include "TimerStore.h"
#include "WebSocketService.h"
#include "WebhookService.h"

namespace BrewControl {

// Browser-facing HTTP + SSE layer for a SensActCtrl Registry.
//
// Routes:
//   GET  /api/snapshot                      — current registry state (JSON)
//   GET  /api/events                        — SSE; "snapshot" event on
//                                             connect, every 1 s, and after
//                                             every write or add/remove, plus
//                                             an "alert" event per new alert
//   POST /api/sensors                       — create dynamic sensor
//   POST /api/actuators                     — create dynamic actuator
//   POST /api/controllers                   — create dynamic controller
//   DELETE /api/sensors/<id>               — remove dynamic sensor
//   DELETE /api/actuators/<id>             — remove dynamic actuator (405 if static)
//   DELETE /api/controllers/<id>           — remove dynamic controller (405 if static)
//   POST /api/actuators/<id>               — {"v":<float>} → Actuator::write
//   POST /api/controllers/<id>/setpoint    — {"v":<float>}
//   POST /api/controllers/<id>/params      — raw controller-params JSON
//   POST /api/estop                        — latch the emergency stop
//   DELETE /api/estop                      — release the latch (auth required)
//   POST /api/admin/wifi-reset             — clear WiFi creds, reboot
//   GET  /api/auth/status                  — {enabled, authenticated}
//   POST /api/auth/login                   — {"password":…} → session cookie
//   POST /api/auth/logout                  — drop this session
//   POST /api/auth/password                — set/change/clear device password
//   POST /api/auth/revoke-all              — drop every session
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
//   GET  /api/programs                     — list setpoint programs (JSON)
//   POST /api/programs                     — create setpoint program
//   POST /api/programs/<id>                — update setpoint program
//   DELETE /api/programs/<id>              — remove setpoint program
//   POST /api/programs/<id>/control        — {"action":start|pause|resume|stop|next|prev}
//   GET  /api/timers                       — list timers (JSON)
//   POST /api/timers                       — create timer
//   POST /api/timers/<id>                  — update timer (resets it to idle)
//   DELETE /api/timers/<id>                — remove timer
//   POST /api/timers/<id>/control          — {"action":start|pause|resume|stop}
//   GET  /api/alarms                       — list alarm rules incl. live state
//   POST /api/alarms                       — create alarm rule
//   POST /api/alarms/<id>                  — update alarm rule
//   POST /api/alarms/<id>/enable           — {"enabled":bool}
//   DELETE /api/alarms/<id>                — remove alarm rule
//   GET  /api/alerts[?since=<seq>]         — alert history (ascending seq)
//   POST /api/alerts/clear                 — empty the alert history
//   GET  /api/push                         — Web Push status + subscriptions
//   GET  /api/push/keypair                 — full VAPID pair (auth-gated)
//   POST /api/push/subscription            — store keypair + browser subscription
//   DELETE /api/push/subscription/<id>     — drop one subscription
//   POST /api/push/test                    — send a test notification
//   POST /api/push/reset                   — forget keypair and subscriptions
//   GET  /api/profiles                     — profile library {categories,profiles}
//   POST /api/profiles                     — create profile
//   POST /api/profiles/<id>                — update profile
//   DELETE /api/profiles/<id>              — remove profile
//   POST /api/profile-categories           — create profile category
//   POST /api/profile-categories/<id>      — rename profile category
//   DELETE /api/profile-categories/<id>    — remove category and its profiles
//   GET  /api/bus/scan?type=onewire&pin=N  — enumerate ROM addresses on OneWire bus
//   GET  /api/remote/discover?transport=mqtt|espnow|websocket
//                                          — async discovery of remote items
//                                            (202 while scanning → 200+JSON)
//   GET  /api/remote/peers                 — async mDNS browse for other
//                                            boards (202 → 200+JSON)
//   POST /api/remote/pair                  — {"host"[,"password"]} tell that
//                                            board to connect to our hub
//   GET  /api/remote/pair                  — result of the last pairing
//   GET  /api/files?path=<dir>             — list directory entries (JSON)
//   GET  /api/files/download?path=<file>   — download one file (attachment)
//   POST /api/files/upload?path=<dir>      — multipart upload into <dir> (field "f")
//   DELETE /api/files?path=<path>          — delete a file, or a directory recursively
//   POST /api/files/rename                 — {"from","to"} rename/move a file or directory
//   POST /api/files/mkdir                  — {"path"} create one new directory level
//   All mutating file ops reject paths under /www or /www.new (403) — the
//   running UI's own files and the OTA-asset staging dir are read-only.
//   GET  /*                                — SD static (default index.html)
//
// Access control is optional and off until a password is set (see
// AuthService). Once one is, every mutating route needs the session cookie
// from POST /api/auth/login; reads stay open, with GET /api/backup the one
// exception because its bundle carries the MQTT password.
//
// Concurrency: serializeRegistry runs from the AsyncTCP task while
// Registry::tick runs from loopTask. Reading values are non-atomic — a
// torn read is theoretically possible but tolerated for the dashboard use.
class WebUI {
 public:
  WebUI(SensActCtrl::Registry& reg, fs::FS& fs, DynamicItems& items,
        DashboardStore& store, SettingsStore& settings, FirmwareUpdater& updater,
        LogStore& logs, ProgramRunner& programs, TimerStore& timers,
        AlarmStore& alarms, ProfileStore& profiles, MqttService& mqtt,
        WebhookService& webhook, WebSocketService& websocket,
        EspNowPublishService& espnow, RemoteDiscovery& discovery,
        MdnsBrowser& peers, PushService& push, uint16_t port = 80);

  // Must be called after registry.begin() and dynamicItems.markInitialized().
  void begin();

  // Call once per loop() iteration. Broadcasts a fresh snapshot every 1 s.
  void tick();

  // Emergency stop latched (POST /api/estop, until DELETE /api/estop).
  bool estopLatched() const { return estop_; }

 private:
  void pushSnapshot_();
  void sendSnapshotTo_(AsyncEventSourceClient* client);
  void swapAssets_();
  // Writes one backup section (a JSON object/array) verbatim to `path`.
  bool writeSection_(const char* path, ArduinoJson::JsonVariantConst v);
  // Rejects relative paths and ".." traversal; when forMutation is true also
  // rejects anything under /www or /www.new (the running UI's own files and
  // the OTA-asset staging dir). Strips a trailing slash from `path` on
  // success. Sends the error response itself and returns false on rejection.
  bool validFilePath_(String& path, bool forMutation, AsyncWebServerRequest* req);
  // Recursively deletes a file or directory. Also used by swapAssets_.
  void removeRecursive_(const char* path);
  // Runs a pending POST /api/remote/pair from tick(), i.e. from loopTask:
  // HTTPClient is synchronous, and the async_tcp task must not be blocked for
  // the length of a network round trip (it serves every request and the SSE
  // stream). Same deferral as rebootAtMs_ below.
  void runPendingPairing_();
  // Emergency-stop latch, persisted to /config/estop.json so a reboot can't
  // quietly undo a stop. loadEstop_() runs from begin(), i.e. after
  // registry.begin() has put every item into its default state, and disables
  // actuators and controllers again when the latch survived the boot.
  void loadEstop_();
  void saveEstop_() const;

  SensActCtrl::Registry& reg_;
  fs::FS& fs_;
  DynamicItems& items_;
  DashboardStore& store_;
  SettingsStore& settings_;
  FirmwareUpdater& updater_;
  LogStore& logs_;
  ProgramRunner& programs_;
  TimerStore& timers_;
  AlarmStore& alarms_;
  ProfileStore& profiles_;
  MqttService& mqtt_;
  WebhookService& webhook_;
  WebSocketService& websocket_;
  EspNowPublishService& espnow_;
  RemoteDiscovery& discovery_;
  MdnsBrowser& peers_;
  PushService& push_;
  AuthService auth_;
  AsyncWebServer server_;
  AsyncEventSource events_;
  bool estop_ = false;  // latched emergency stop, mirrored in the snapshot
  uint32_t lastPushMs_ = 0;
  uint32_t lastAlarmMs_ = 0;
  uint32_t rebootAtMs_ = 0;

  // Pairing job, handed from the route handler (async_tcp task) to
  // runPendingPairing_() (loopTask). Guarded by pairMutex_ because these are
  // written on one task and read on the other, and a String assignment would
  // otherwise be able to hand the reader a freed buffer (same hazard that
  // keeps SensActCtrl's WebSocketTransport::lastError_ a bare literal).
  // pairArmed_: a job is waiting to be run. pairBusy_: armed or in flight —
  // what makes the route reject a second job and report "running".
  std::mutex pairMutex_;
  String pairHost_;
  String pairPassword_;
  bool pairArmed_ = false;
  bool pairBusy_ = false;
  bool pairDone_ = false;
  int pairCode_ = 0;          // HTTP status we report back, 0 = nothing yet
  String pairMessage_;

  std::unique_ptr<SdTarSink> assetSink_;
  std::unique_ptr<TarExtractor> assetTar_;
  bool assetSwapPending_ = false;
  String assetNoSpace_;  // set when the LittleFS free-space check aborted an upload

  File fileUpload_;
  String fileUploadPath_;
  bool fileUploadRejected_ = false;
  // Same idea as fileUploadRejected_, for the two OTA upload routes: an
  // unauthorized upload must be dropped on every later chunk too, or the
  // final chunk would answer a second time on top of the 401.
  bool uploadUnauthorized_ = false;
};

}  // namespace BrewControl
