// BrewControl — concrete consumer sketch for SensActCtrl.
//
// Boot flow:
//   1. BOOT button held >5 s at power-on  → clear WiFi prefs (factory reset).
//   2. SD mount + /firmware.bin present   → flash it, delete it, reboot.
//   3. No SSID in NVS                     → run WiFiSetupPortal (AP), reboot.
//   4. STA connect (30 s timeout)         → fall back to portal on failure.
//   5. mDNS + Registry + WebUI            → loop().
// A short wake from deep sleep (EnergyManager) takes the same path with one
// Wi-Fi attempt (or none), without portal, mDNS, web server and display.

#include <Arduino.h>
#include <ESPmDNS.h>
#include <Preferences.h>
#ifdef BREWCTL_USE_LITTLEFS
#include <LittleFS.h>
#else
#include <SD.h>
#endif
#include <SPI.h>
#include <SensActCtrl.h>
#include <Update.h>
#include <WiFi.h>
#include <esp_heap_caps.h>
#include <esp_task_wdt.h>
#include <mbedtls/platform.h>
#include <memory>

#include "AlarmStore.h"
#include "DashboardStore.h"
#include "DynamicItems.h"
#include "EnergyManager.h"
#include "EspNowPublishService.h"
#include "FirmwareUpdater.h"
#include "HeapDiag.h"
#include "LogStore.h"
#include "MdnsBrowser.h"
#include "MqttService.h"
#include "ProfileStore.h"
#include "ProgramRunner.h"
#include "PushService.h"
#include "RegistryLock.h"
#include "RemoteDiscovery.h"
#include "RuntimeState.h"
#include "SettingsStore.h"
#include "StateSaver.h"
#include "TimerStore.h"
#include "WakeMode.h"
#include "WebSocketService.h"
#include "WebUI.h"
#include "WebhookService.h"
#include "WiFiSetupPortal.h"
#include "display/DisplayPages.h"
#include "display/DisplayUI.h"

using namespace SensActCtrl;
using BrewControl::WebUI;
using BrewControl::WiFiSetupPortal;

// Pin assignments — board-specific overrides via build_flags in platformio.ini.
#ifndef BREWCTL_SD_CS
#define BREWCTL_SD_CS 5
#endif
constexpr int kSdCsPin = BREWCTL_SD_CS;  // ⚠ on esp32dev: strapping pin (MTDI) — see README
constexpr int kBootButtonPin = 0;
constexpr uint32_t kResetHoldMs = 5000;
constexpr uint32_t kWiFiConnectTimeoutMs = 30000;
constexpr uint32_t kShortWakeConnectTimeoutMs = 8000;
constexpr uint32_t kLoopWdtTimeoutS = 30;
constexpr char kHostname[] = "brewcontrol";

// FS-agnostic reference used everywhere below — WebUI and every *Store class
// already take generic fs::FS&, so only this alias (and the mount call in
// setup()) differ between boards with an SD reader and boards without one.
#ifdef BREWCTL_USE_LITTLEFS
fs::FS& deviceFs = LittleFS;
#else
fs::FS& deviceFs = SD;
#endif

Registry registry;
BrewControl::DynamicItems dynamicItems;
BrewControl::DashboardStore dashboardStore;
BrewControl::SettingsStore settingsStore;
BrewControl::FirmwareUpdater firmwareUpdater(deviceFs, settingsStore);
BrewControl::LogStore logStore;
BrewControl::ProgramRunner programRunner;
BrewControl::TimerStore timerStore;
BrewControl::AlarmStore alarmStore;
BrewControl::ProfileStore profileStore;
BrewControl::MqttService mqttService(registry, dynamicItems, settingsStore);
BrewControl::WebhookService webhookService;
BrewControl::WebSocketService webSocketService;
BrewControl::EspNowPublishService espNowPublishService;
BrewControl::PushService pushService;
BrewControl::RemoteDiscovery remoteDiscovery;
BrewControl::MdnsBrowser mdnsBrowser;
BrewControl::StateSaver stateSaver;
BrewControl::EnergyManager energy;
WebUI webUI(registry, deviceFs, dynamicItems, dashboardStore, settingsStore, firmwareUpdater, logStore, programRunner, timerStore, alarmStore, profileStore, mqttService, webhookService, webSocketService, espNowPublishService, remoteDiscovery, mdnsBrowser, pushService);
#ifdef BREWCTL_HAS_DISPLAY
BrewControl::DisplayUI displayUI;
BrewControl::DisplayPages displayPages;
#endif

// Constructed in setup() only after a successful STA connect (see initEspNow_()
// in the library: it rides the already-established WiFi channel instead of
// forcing one, so it must never be built before WiFi is up). No enable
// toggle — receiving broadcast packets is passive, negligible cost.
std::unique_ptr<EspNowTransport> espNowTransport;

// Short wake from deep sleep: measure, publish, sleep again (WakeMode.h).
static bool shortWake = false;
static BrewControl::ShortWake shortWakeCourse;
static uint32_t loopStartMs = 0;

// Channel of the last Wi-Fi connection, for ESP-NOW in a short wake without
// Wi-Fi. RTC memory survives deep sleep (not a power cycle), and a short wake
// always follows a deep sleep — so no flash write.
RTC_DATA_ATTR static uint8_t lastWifiChannel = 1;

// Configured mDNS hostname (NVS brewctrl/hostname, default kHostname). Global so
// the WiFi event handler can re-announce mDNS after a reconnect.
String hostname_;

// (Re-)start the mDNS responder. ESP32 mDNS typically does not survive a WiFi
// reconnect, so this runs on every STA_GOT_IP event, not just at boot.
static void startMDNS() {
  // Runs on the WiFi event task as well — tell the browser to let go of any
  // search object before mdns_free() takes it away underneath it.
  mdnsBrowser.abandonSearch();
  MDNS.end();
  if (MDNS.begin(hostname_.c_str())) {
    MDNS.addService("http", "tcp", 80);
    // Every board announces itself, not just the ones publishing data: this is
    // what MdnsBrowser looks for, and it lets third-party tools find the HTTP
    // API too. Port 80 = that API; the WebSocket hub port rides in the TXT
    // record, because the hub is optional and on a different port.
    const String device = settingsStore.websocketClientId().isEmpty()
                              ? hostname_
                              : settingsStore.websocketClientId();
    MDNS.addService(BrewControl::kServiceType, BrewControl::kServiceProto, 80);
    MDNS.addServiceTxt(BrewControl::kServiceType, BrewControl::kServiceProto, "dev", device.c_str());
    MDNS.addServiceTxt(BrewControl::kServiceType, BrewControl::kServiceProto, "prefix",
                       settingsStore.websocketTopicPrefix().c_str());
    MDNS.addServiceTxt(BrewControl::kServiceType, BrewControl::kServiceProto, "ver", BREWCTL_VERSION);
    MDNS.addServiceTxt(BrewControl::kServiceType, BrewControl::kServiceProto, "ws",
                       settingsStore.websocketHubEnabled()
                           ? String(settingsStore.websocketHubPort()).c_str()
                           : "0");
    Serial.printf("mDNS up: http://%s.local/\n", hostname_.c_str());
  } else {
    Serial.println(F("mDNS start failed"));
  }
}

static bool resetHeldAtBoot() {
  pinMode(kBootButtonPin, INPUT_PULLUP);
  if (digitalRead(kBootButtonPin) != LOW) return false;
  const uint32_t start = millis();
  while (digitalRead(kBootButtonPin) == LOW) {
    if (millis() - start >= kResetHoldMs) return true;
    delay(50);
  }
  return false;
}

static bool connectStation(const String& ssid, const String& password,
                           const String& hostname,
                           uint32_t timeoutMs = kWiFiConnectTimeoutMs) {
  WiFi.mode(WIFI_STA);
  WiFi.setHostname(hostname.c_str());  // registers with DHCP; must precede begin()
  WiFi.setAutoReconnect(true);
  WiFi.begin(ssid.c_str(), password.c_str());
  const uint32_t start = millis();
  while (WiFi.status() != WL_CONNECTED) {
    if (millis() - start >= timeoutMs) return false;
    delay(200);
  }
  return true;
}

// TLS buffers go to PSRAM where there is some. The prebuilt core allocates
// mbedTLS from internal RAM only (CONFIG_MBEDTLS_INTERNAL_MEM_ALLOC) with fixed
// 16 KB record buffers — a handshake takes ~50 KB, more than the S2 has left
// in one piece at runtime ("SSL - Memory allocation failed" on update checks,
// SESSION.md 2026-09-27). It is built with MBEDTLS_PLATFORM_MEMORY, so the
// allocator can be swapped at runtime. Internal RAM stays the fallback, and
// boards without PSRAM (esp32dev) are left as they are.
static void tlsAllocToPsram() {
  if (heap_caps_get_total_size(MALLOC_CAP_SPIRAM) == 0) return;
  mbedtls_platform_set_calloc_free(
      [](size_t n, size_t size) -> void* {
        void* p = heap_caps_calloc(n, size, MALLOC_CAP_SPIRAM | MALLOC_CAP_8BIT);
        return p ? p : heap_caps_calloc(n, size, MALLOC_CAP_INTERNAL | MALLOC_CAP_8BIT);
      },
      heap_caps_free);
}

// Set in setup() after an unplanned restart, cleared once the alert is raised.
static const char* pendingResetReason = nullptr;

void setup() {
  Serial.begin(115200);
  const char* wakeCause = BrewControl::EnergyManager::wakeCause();
  const bool timerWake = wakeCause && strcmp(wakeCause, "timer") == 0;
  // On USB-CDC (ESP32-S2/S3 with ARDUINO_USB_CDC_ON_BOOT=1), enumeration +
  // host-side connect take 1–2 s. Wait briefly so the first prints aren't
  // lost; cap at 3 s so a headless boot doesn't stall. Not on a timer
  // wakeup: that is back asleep within seconds.
  if (!timerWake) {
    const uint32_t waitStart = millis();
    while (!Serial && millis() - waitStart < 3000) delay(10);
    delay(200);
  }
  Serial.println(F("BrewControl boot"));
  tlsAllocToPsram();  // before anything opens a TLS connection
  BrewControl::HeapDiag::mark("start");

#ifdef BREWCTL_I2C_SDA
  // Boards whose variant header defaults Wire to the wrong pins: claim the
  // real bus before any item can, and hold it forever — the display/touch
  // needs it before any BME280/GY521 item exists. A later Wire.begin() (e.g.
  // via Adafruit BusIO in a dynamic item) is a no-op on an already running
  // bus - but on a fresh one it would pick the defaults, on the AMOLED-1.75
  // SCL 17 = panel reset.
  dynamicItems.acquireBoardI2cBus();
#endif

  if (!wakeCause && resetHeldAtBoot()) {
    Serial.println(F("Reset trigger — clearing WiFi prefs"));
    Preferences prefs;
    prefs.begin("brewctrl", false);
    prefs.clear();
    prefs.end();
  }

#ifdef BREWCTL_USE_LITTLEFS
  // Internal-flash boards (no SD slot): mount the LittleFS data partition —
  // holds /www (UI assets, written once via `pio run -t uploadfs`) and all
  // persisted config/logs. formatOnFail=true is a safety net for a
  // corrupt/never-formatted partition; a normal boot just mounts the image
  // uploadfs already wrote.
  const bool fsOk = LittleFS.begin(true);
  if (!fsOk) {
    Serial.println(F("LittleFS mount FAILED — UI assets unavailable, API still works"));
  } else {
    Serial.println(F("LittleFS mounted"));
    // Recovery path only works for images that fit the 256 KB data
    // partition — effectively unusable for real firmware.bin sizes on
    // these boards; network OTA (the normal path) is unaffected, it
    // doesn't touch the filesystem.
    firmwareUpdater.flashFromSdImage();
  }
#else
  // Mount SD early — before WiFi — so a firmware image placed on the card can be
  // flashed as a recovery path even without a network. On boards where the SD
  // slot uses non-default SPI pins (e.g. T-Display-S3 AMOLED on GPIO 36/35/37),
  // bring up an explicit HSPI instance first.
  // max_files 16 instead of the default 5: ESPAsyncWebServer keeps every file
  // it serves open for the whole transfer, and a browser loading the UI or
  // log charts fetches several in parallel. With 5, further opens failed —
  // UI uploads died with "open failed", assets got the fallback page.
  constexpr uint8_t kSdMaxOpenFiles = 16;
#ifdef BREWCTL_SD_SCK
  static SPIClass sdSpi(HSPI);
  sdSpi.begin(BREWCTL_SD_SCK, BREWCTL_SD_MISO, BREWCTL_SD_MOSI, kSdCsPin);
  const bool fsOk = SD.begin(kSdCsPin, sdSpi, 4000000, "/sd", kSdMaxOpenFiles);
#else
  const bool fsOk = SD.begin(kSdCsPin, SPI, 4000000, "/sd", kSdMaxOpenFiles);
#endif
  if (!fsOk) {
    Serial.println(F("SD mount FAILED — UI assets unavailable, API still works"));
  } else {
    Serial.println(F("SD mounted"));
    firmwareUpdater.flashFromSdImage();  // flashes /firmware.bin then reboots; returns if none
  }
#endif

  BrewControl::HeapDiag::mark("fs");

  // Before Wi-Fi: the energy settings decide how this boot goes on.
  if (fsOk) settingsStore.loadFromSD(deviceFs);
  shortWake = BrewControl::isShortWake(timerWake, settingsStore.energyDeepSleep(),
                                       energy.pinActive(settingsStore));
  dynamicItems.setWakePin(settingsStore.energyWakePin(), settingsStore.energyWakeActiveLow());
  if (shortWake) Serial.println(F("[energy] short wake"));

  Preferences prefs;
  prefs.begin("brewctrl", true);
  const String ssid = prefs.getString("ssid", "");
  const String password = prefs.getString("password", "");
  hostname_ = prefs.getString("hostname", kHostname);
  prefs.end();

  if (ssid.isEmpty()) {
    Serial.println(F("No WiFi creds — starting setup portal"));
    WiFiSetupPortal portal;
    portal.runUntilConfigured();  // never returns — ESP.restart()
  }

  // Creds exist: a failed connect is usually a transient outage (router
  // rebooting), not bad creds — retry for a few minutes before falling back to
  // the AP setup portal, so a reboot during a router outage can't strand us
  // there with valid credentials.
  bool connected = false;
  if (shortWake) {
    // One attempt, no portal: without Wi-Fi only ESP-NOW publishes.
    if (settingsStore.energyShortWakeWifi())
      connected = connectStation(ssid, password, hostname_, kShortWakeConnectTimeoutMs);
  } else {
    for (int attempt = 1; attempt <= 6 && !connected; ++attempt) {
      connected = connectStation(ssid, password, hostname_);
      if (!connected)
        Serial.printf("STA connect attempt %d/6 failed, retrying...\n", attempt);
    }
    if (!connected) {
      Serial.println(F("STA connect failed repeatedly — falling back to setup portal"));
      WiFiSetupPortal portal;
      portal.runUntilConfigured();
    }
  }

  if (connected) {
    lastWifiChannel = WiFi.channel();
    Serial.printf("WiFi connected, IP=%s\n", WiFi.localIP().toString().c_str());
  }
  BrewControl::HeapDiag::mark("wifi");

  // A pending release install runs here, while nothing but WiFi holds heap
  // yet — see FirmwareUpdater::runPendingInstall(). Reboots on success.
  firmwareUpdater.runPendingInstall();

  // Modem sleep drops ESP-NOW packets that arrive while the radio is
  // dozing between beacons — disable it so ESP-NOW is reliable alongside
  // the STA link.
  WiFi.setSleep(false);

  // STA is up — safe to bring up ESP-Now now (initEspNow_() rides the
  // current WiFi channel instead of forcing one, so it must come after this).
  // Without STA (short wake) it takes the channel of the last connection.
  espNowTransport = std::make_unique<EspNowTransport>(lastWifiChannel);
  BrewControl::HeapDiag::mark("espnow");

  // Re-announce mDNS on every STA_GOT_IP (it doesn't survive reconnects). The
  // initial GOT_IP already fired during connectStation, so also start it once
  // below — after the settings are loaded, because the announced TXT records
  // carry the WebSocket hub port and the device id from there.
  if (!shortWake) {
    WiFi.onEvent([](WiFiEvent_t, WiFiEventInfo_t) { startMDNS(); },
                 ARDUINO_EVENT_WIFI_STA_GOT_IP);
    startMDNS();
  }
  BrewControl::HeapDiag::mark("settings+mdns");

  mqttService.begin(hostname_);  // creates the transport (if enabled) before
                                  // dynamicItems.loadFromSD() constructs any
                                  // actuator that publishes over MQTT itself
  BrewControl::HeapDiag::mark("mqtt");
  webhookService.beginPublish(settingsStore, hostname_);  // no-op if disabled
  webSocketService.begin(settingsStore, hostname_);  // hub and/or publish, each no-op if disabled
  espNowPublishService.begin(*espNowTransport, settingsStore, hostname_);  // no-op if disabled
  BrewControl::HeapDiag::mark("publishers");
  dynamicItems.setMqttTransport(mqttService.transport());  // nullable
  dynamicItems.setWebhookService(&webhookService);  // always available, no toggle
  dynamicItems.setEspNowTransport(espNowTransport.get());  // always available, no toggle
  dynamicItems.setWebSocketHubTransport(webSocketService.hubTransport());  // nullable
  // Own ids = what our own publishers answer discovery with (same fallback
  // as MqttService / EspNowPublishService), so we don't list ourselves.
  remoteDiscovery.begin(
      mqttService.transport(),
      settingsStore.mqttClientId().isEmpty() ? hostname_ : settingsStore.mqttClientId(),
      espNowTransport.get(),
      settingsStore.espnowClientId().isEmpty() ? hostname_ : settingsStore.espnowClientId(),
      webSocketService.hubTransport(),
      settingsStore.websocketClientId().isEmpty() ? hostname_
                                                  : settingsStore.websocketClientId());
  BrewControl::HeapDiag::mark("discovery");

  if (fsOk) {
    dynamicItems.loadFromSD(deviceFs, registry);
    dashboardStore.loadFromSD(deviceFs);
    logStore.loadFromSD(deviceFs);
    programRunner.loadFromSD(deviceFs);
    timerStore.loadFromSD(deviceFs);
    alarmStore.loadFromSD(deviceFs);
    profileStore.loadFromSD(deviceFs);
  }
  BrewControl::HeapDiag::mark("stores");

  configTime(settingsStore.utcOffsetSec(), settingsStore.dstOffsetSec(),
             settingsStore.ntpServer().c_str());

  // Outputs held through a deep sleep stay at their off level until the
  // actuators take them over here.
  BrewControl::EnergyManager::releaseOutputs(dynamicItems.pinUses());
  registry.begin();
  dynamicItems.markInitialized();  // future add*() calls will call begin()
  mqttService.attachExisting();    // mirrors the registry + registers
                                    // DynamicItems hooks — must run before
                                    // webUI can serve add/remove requests
  webhookService.attachExistingPublish(registry, dynamicItems);
  webSocketService.attachExistingPublish(registry, dynamicItems);
  espNowPublishService.attachExisting(registry, dynamicItems);
  // Back to the last on/off, setpoints and values (RuntimeState.h) — before
  // webUI.begin(), whose latched emergency stop overrides them.
  if (fsOk) BrewControl::restoreState(deviceFs, registry);
  stateSaver.reset(BrewControl::captureState(registry, dynamicItems));
  BrewControl::HeapDiag::mark("registry");

  // Program run-state transitions feed the alert centre. Fires with the
  // runner's lock held, so the callback must not call back into it.
  programRunner.setOnStatusChanged(
      [](const char* id, const char* name, const char* status) {
        alarmStore.onProgramStatus(id, name, status, time(nullptr), millis());
      });

  // Timer expiry feeds the alert centre too. Fires with the store's lock
  // held, so the callback must not call back into it.
  timerStore.setOnExpired([](const char* id, const char* name) {
    alarmStore.onTimerExpired(id, name, time(nullptr), millis());
  });

  // Raised from loop() once NTP has synced: PushService drops alerts while the
  // clock is unset, and this one should reach the phone.
  pendingResetReason = BrewControl::FirmwareUpdater::unexpectedResetReason();

  webUI.begin(/*serve=*/!shortWake);  // a short wake only applies the latched stop
  if (!shortWake) {
    pushService.begin(hostname_);  // no-op until a browser subscribed
    BrewControl::HeapDiag::mark("push");
    firmwareUpdater.begin();
    BrewControl::HeapDiag::mark("webui");
#ifdef BREWCTL_HAS_DISPLAY
    displayUI.begin(settingsStore);
    if (displayUI.ready())
      displayPages.begin(registry, dashboardStore, programRunner, settingsStore,
                         webUI);
    BrewControl::HeapDiag::mark("display");
#endif
  }
  // Watchdog on loopTask. The web API runs on the AsyncTCP task and keeps
  // answering while loopTask hangs, so a stuck loop() (no control, no program
  // steps) would otherwise look healthy. 30 s is far above any legitimate
  // pass; the arduino core feeds the WDT before every loop(). Re-initialising
  // only changes timeout/panic of the TWDT the core already started (5 s, it
  // watches IDLE0), so idle starvation is now also reported after 30 s.
  // Programs and timers resume after the reboot from their persisted state.
  esp_task_wdt_init(kLoopWdtTimeoutS, /*panic=*/true);
  enableLoopWDT();
  loopStartMs = millis();
  Serial.println(F("BrewControl ready"));
}

// Publishers and transports; caller holds the RegistryLock. A short wake
// without Wi-Fi skips the Wi-Fi ones: their connect attempt cannot succeed
// (MQTT connects in a background task, the others may still block).
static void tickTransports() {
  if (!shortWake || WiFi.isConnected()) {
    mqttService.tick();
    webhookService.tick();
    webSocketService.tick();
  }
  if (espNowTransport) espNowTransport->tick();
  espNowPublishService.tick();
}

// Every sensor has a reading or reports a fault.
static bool sensorsHaveReadings() {
  for (Sensor* s : registry.sensors()) {
    if (s->fault()) continue;
    for (size_t i = 0; i < s->channelCount(); ++i)
      if (!s->channel(i).reading.valid) return false;
  }
  return true;
}

// Deep sleep until the interval or the next program or timer event is due.
// awakeMs: time already spent of the interval. The actuators go off first,
// without saving that — the wakeup restores them; a pending state change is
// written now.
[[noreturn]] static void goToSleep(uint32_t awakeMs) {
  {
    BrewControl::RegistryLock lock;
    const std::string state = BrewControl::captureState(registry, dynamicItems);
    if (stateSaver.flush(state)) BrewControl::saveState(deviceFs, state);
    for (Actuator* a : registry.actuators()) a->setEnabled(false);
  }
  // Protocol and remote actuators (IDS, MQTT, ESP-NOW) send their off here.
  const uint32_t start = millis();
  while (millis() - start < 300) {
    {
      BrewControl::RegistryLock lock;
      registry.tick();
      tickTransports();
    }
    delay(5);
  }
#ifdef BREWCTL_HAS_DISPLAY
  displayUI.off();
#endif
  const time_t next = BrewControl::earlierEvent(programRunner.nextEventEpoch(),
                                                timerStore.nextEventEpoch());
  energy.sleep(settingsStore,
               BrewControl::sleepMs(settingsStore.energySleepIntervalSec(), awakeMs,
                                    time(nullptr), next),
               dynamicItems.pinUses());
}

// Short wake: sleep again once the sensors have read and the enabled
// publishers are connected, after a tail for their 1 s send cycle.
static void shortWakeTick() {
  // A press on the wake pin makes it a full wake (a restart is no timer wakeup).
  if (energy.pinActive(settingsStore)) ESP.restart();
  const bool connected =
      WiFi.status() != WL_CONNECTED ||
      ((!settingsStore.mqttEnabled() || mqttService.connected()) &&
       (!settingsStore.webhookEnabled() || webhookService.publishConnected()) &&
       (!settingsStore.websocketPublishEnabled() || webSocketService.publishConnected()));
  if (shortWakeCourse.done(millis() - loopStartMs, connected)) goToSleep(millis());
}

// Full wake with deep sleep on: sleep after awakeTimeoutSec without web
// access, touch or held wake pin — not during a browser firmware upload.
static void fullWakeTick() {
  if (!settingsStore.energyDeepSleep()) return;
  static uint32_t lastCheckMs = 0;
  static uint32_t pinSeenMs = 0;
  const uint32_t now = millis();
  if (now - lastCheckMs < 1000) return;
  lastCheckMs = now;
  if (energy.pinActive(settingsStore)) pinSeenMs = now;
  uint32_t idleMs = now - pinSeenMs;
  idleMs = std::min(idleMs, now - webUI.lastActivityMs());
#ifdef BREWCTL_HAS_DISPLAY
  idleMs = std::min(idleMs, now - displayUI.lastTouchMs());
#endif
  if (idleMs < settingsStore.energyAwakeTimeoutSec() * 1000UL || Update.isRunning()) return;
  goToSleep(0);
}

// Self-healing WiFi: if the STA link drops (AP reboot, noise, wedged radio),
// nudge a reconnect every 30 s; reboot only as a last resort after 5 min of
// continuous loss. The long timeout is deliberate — a router reboot (~1–2 min)
// recovers via auto-reconnect well before it fires, so the device stays in STA
// instead of rebooting into the setup portal. Runs only after setup() connects.
static void maintainWiFi() {
  static uint32_t downSinceMs = 0;
  static uint32_t lastRetryMs = 0;
  if (WiFi.status() == WL_CONNECTED) { downSinceMs = 0; return; }
  const uint32_t now = millis();
  if (downSinceMs == 0) { downSinceMs = now; lastRetryMs = now; return; }
  if (now - lastRetryMs >= 30000) { lastRetryMs = now; WiFi.reconnect(); }
  if (now - downSinceMs >= 300000) ESP.restart();
}

void loop() {
  static uint32_t lastStateMs = 0;
  std::string state;
  {
    // Everything that walks the live items, so a REST handler cannot free
    // one mid-walk (RegistryLock.h). Long network waits stay outside.
    BrewControl::RegistryLock lock;
    registry.tick();
    // A short wake holds logs and programs back until the sensors have read
    // once — otherwise its only log row would be empty.
    if (!shortWake ||
        shortWakeCourse.sensorsSettled(millis() - loopStartMs, sensorsHaveReadings()))
      webUI.tick();
    tickTransports();
    remoteDiscovery.tick();
    if (millis() - lastStateMs >= 1000) {
      lastStateMs = millis();
      state = BrewControl::captureState(registry, dynamicItems);
      // Rare (a finished AutoTune), so written right here, under the lock
      // that keeps REST from changing the item list mid-save.
      if (dynamicItems.syncTunedParams()) dynamicItems.saveToSD(deviceFs);
    }
#ifdef BREWCTL_HAS_DISPLAY
    // A new alert wakes a dimmed or dark display, as the latched stop does.
    static uint32_t seenAlert = 0;
    const uint32_t alert = alarmStore.lastSeq();
    if (alert != seenAlert) {
      seenAlert = alert;
      displayUI.wake();
    }
    displayUI.tick(webUI.estopLatched());
#endif
  }
  // Written outside the registry lock: a slow SD write must not hold up REST.
  if (!state.empty() && stateSaver.due(millis(), state)) BrewControl::saveState(deviceFs, state);
  if (shortWake) {
    shortWakeTick();
    delay(5);
    return;
  }
  firmwareUpdater.tick();
  mdnsBrowser.tick(millis());
  // Wait for the clock so the alert carries a timestamp and can be pushed; give
  // up waiting after 2 min (no WiFi/NTP) so it still shows in the alert center.
  if (pendingResetReason && (time(nullptr) > 1600000000 || millis() > 120000)) {
    alarmStore.onUnexpectedReset(pendingResetReason, time(nullptr));
    pendingResetReason = nullptr;
  }
  pushService.tick();
  maintainWiFi();
  fullWakeTick();
  delay(5);
}
