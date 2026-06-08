// BrewControl — concrete consumer sketch for SensActCtrl.
//
// Boot flow:
//   1. BOOT button held >5 s at power-on  → clear WiFi prefs (factory reset).
//   2. SD mount + /firmware.bin present   → flash it, delete it, reboot.
//   3. No SSID in NVS                     → run WiFiSetupPortal (AP), reboot.
//   4. STA connect (30 s timeout)         → fall back to portal on failure.
//   5. mDNS + Registry + WebUI            → loop().

#include <Arduino.h>
#include <ESPmDNS.h>
#include <Preferences.h>
#include <SD.h>
#include <SPI.h>
#include <SensActCtrl.h>
#include <WiFi.h>

#include "DashboardStore.h"
#include "DynamicItems.h"
#include "FirmwareUpdater.h"
#include "LogStore.h"
#include "ProgramRunner.h"
#include "SettingsStore.h"
#include "WebUI.h"
#include "WiFiSetupPortal.h"

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
constexpr char kHostname[] = "brewcontrol";

Registry registry;
BrewControl::DynamicItems dynamicItems;
BrewControl::DashboardStore dashboardStore;
BrewControl::SettingsStore settingsStore;
BrewControl::FirmwareUpdater firmwareUpdater(SD, settingsStore);
BrewControl::LogStore logStore;
BrewControl::ProgramRunner programRunner;
WebUI webUI(registry, SD, dynamicItems, dashboardStore, settingsStore, firmwareUpdater, logStore, programRunner);

// Configured mDNS hostname (NVS brewctrl/hostname, default kHostname). Global so
// the WiFi event handler can re-announce mDNS after a reconnect.
String hostname_;

// (Re-)start the mDNS responder. ESP32 mDNS typically does not survive a WiFi
// reconnect, so this runs on every STA_GOT_IP event, not just at boot.
static void startMDNS() {
  MDNS.end();
  if (MDNS.begin(hostname_.c_str())) {
    MDNS.addService("http", "tcp", 80);
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
                           const String& hostname) {
  WiFi.mode(WIFI_STA);
  WiFi.setHostname(hostname.c_str());  // registers with DHCP; must precede begin()
  WiFi.setAutoReconnect(true);
  WiFi.begin(ssid.c_str(), password.c_str());
  const uint32_t start = millis();
  while (WiFi.status() != WL_CONNECTED) {
    if (millis() - start >= kWiFiConnectTimeoutMs) return false;
    delay(200);
  }
  return true;
}

void setup() {
  Serial.begin(115200);
  // On USB-CDC (ESP32-S2/S3 with ARDUINO_USB_CDC_ON_BOOT=1), enumeration +
  // host-side connect take 1–2 s. Wait briefly so the first prints aren't
  // lost; cap at 3 s so a headless boot doesn't stall.
  const uint32_t waitStart = millis();
  while (!Serial && millis() - waitStart < 3000) delay(10);
  delay(200);
  Serial.println(F("BrewControl boot"));

  if (resetHeldAtBoot()) {
    Serial.println(F("Reset trigger — clearing WiFi prefs"));
    Preferences prefs;
    prefs.begin("brewctrl", false);
    prefs.clear();
    prefs.end();
  }

  // Mount SD early — before WiFi — so a firmware image placed on the card can be
  // flashed as a recovery path even without a network. On boards where the SD
  // slot uses non-default SPI pins (e.g. T-Display-S3 AMOLED on GPIO 36/35/37),
  // bring up an explicit HSPI instance first.
#ifdef BREWCTL_SD_SCK
  static SPIClass sdSpi(HSPI);
  sdSpi.begin(BREWCTL_SD_SCK, BREWCTL_SD_MISO, BREWCTL_SD_MOSI, kSdCsPin);
  const bool sdOk = SD.begin(kSdCsPin, sdSpi);
#else
  const bool sdOk = SD.begin(kSdCsPin);
#endif
  if (!sdOk) {
    Serial.println(F("SD mount FAILED — UI assets unavailable, API still works"));
  } else {
    Serial.println(F("SD mounted"));
    firmwareUpdater.flashFromSdImage();  // flashes /firmware.bin then reboots; returns if none
  }

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

  Serial.printf("WiFi connected, IP=%s\n", WiFi.localIP().toString().c_str());

  // Re-announce mDNS on every STA_GOT_IP (it doesn't survive reconnects). The
  // initial GOT_IP already fired during connectStation, so also start it once now.
  WiFi.onEvent([](WiFiEvent_t, WiFiEventInfo_t) { startMDNS(); },
               ARDUINO_EVENT_WIFI_STA_GOT_IP);
  startMDNS();

  if (sdOk) {
    dynamicItems.loadFromSD(SD, registry);
    dashboardStore.loadFromSD(SD);
    settingsStore.loadFromSD(SD);
    logStore.loadFromSD(SD);
    programRunner.loadFromSD(SD);
  }

  configTime(settingsStore.utcOffsetSec(), settingsStore.dstOffsetSec(),
             settingsStore.ntpServer().c_str());

  registry.begin();
  dynamicItems.markInitialized();  // future add*() calls will call begin()

  webUI.begin();
  firmwareUpdater.begin();
  Serial.println(F("BrewControl ready"));
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
  registry.tick();
  webUI.tick();
  firmwareUpdater.tick();
  maintainWiFi();
  delay(5);
}
