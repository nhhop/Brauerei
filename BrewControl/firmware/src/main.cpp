// BrewControl — concrete consumer sketch for SensActCtrl.
//
// Boot flow:
//   1. BOOT button held >5 s at power-on  → clear WiFi prefs (factory reset).
//   2. No SSID in NVS                     → run WiFiSetupPortal (AP), reboot.
//   3. STA connect (30 s timeout)         → fall back to portal on failure.
//   4. mDNS + SD + Registry + WebUI       → loop().

#include <Arduino.h>
#include <ESPmDNS.h>
#include <Preferences.h>
#include <SD.h>
#include <SPI.h>
#include <SensActCtrl.h>
#include <WiFi.h>

#include "DynamicItems.h"
#include "WebUI.h"
#include "WiFiSetupPortal.h"

using namespace SensActCtrl;
using BrewControl::WebUI;
using BrewControl::WiFiSetupPortal;

// Pin assignments — defaults for esp32dev/S2 dev boards. Board-specific
// overrides via build_flags (see platformio.ini per-env BREWCTL_* macros).
#ifndef BREWCTL_ONEWIRE_PIN
#define BREWCTL_ONEWIRE_PIN 4
#endif
#ifndef BREWCTL_SSR_PIN
#define BREWCTL_SSR_PIN 16
#endif
#ifndef BREWCTL_SD_CS
#define BREWCTL_SD_CS 5
#endif
constexpr int kOneWirePin = BREWCTL_ONEWIRE_PIN;
constexpr int kSsrPin = BREWCTL_SSR_PIN;
constexpr int kSdCsPin = BREWCTL_SD_CS;  // ⚠ on esp32dev: strapping pin (MTDI) — see README
constexpr int kBootButtonPin = 0;
constexpr uint32_t kResetHoldMs = 5000;
constexpr uint32_t kWiFiConnectTimeoutMs = 30000;
constexpr char kHostname[] = "brewcontrol";

DS18B20Sensor mashTemp("mash_temp", kOneWirePin);
DigitalOutputActuator heater("heater", kSsrPin,
                             DigitalOutputActuator::Mode::TimeProportional);
PIDController pid("mash_pid", mashTemp, heater, /*min=*/0.0f, /*max=*/1.0f);

Registry registry;
BrewControl::DynamicItems dynamicItems;
WebUI webUI(registry, SD, dynamicItems);

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

static bool connectStation(const String& ssid, const String& password) {
  WiFi.mode(WIFI_STA);
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

  Preferences prefs;
  prefs.begin("brewctrl", true);
  const String ssid = prefs.getString("ssid", "");
  const String password = prefs.getString("password", "");
  prefs.end();

  if (ssid.isEmpty()) {
    Serial.println(F("No WiFi creds — starting setup portal"));
    WiFiSetupPortal portal;
    portal.runUntilConfigured();  // never returns — ESP.restart()
  }

  if (!connectStation(ssid, password)) {
    Serial.println(F("STA connect failed — falling back to setup portal"));
    WiFiSetupPortal portal;
    portal.runUntilConfigured();
  }

  Serial.printf("WiFi connected, IP=%s\n", WiFi.localIP().toString().c_str());

  if (MDNS.begin(kHostname)) {
    MDNS.addService("http", "tcp", 80);
    Serial.printf("mDNS up: http://%s.local/\n", kHostname);
  } else {
    Serial.println(F("mDNS start failed"));
  }

  // On boards where the SD slot is wired to non-default SPI pins (e.g.
  // T-Display-S3 AMOLED uses GPIO 36/35/37), bring up an HSPI instance with
  // explicit pin mapping before SD.begin. On other boards SD.begin uses the
  // default SPI bus.
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
  }

  heater.setPeriodMs(2000);
  pid.setTunings(/*Kp=*/8.0f, /*Ki=*/0.2f, /*Kd=*/0.5f);
  pid.enableAntiWindup(true, 0.8f);
  pid.setSetpoint(65.0f);

  registry.add(&mashTemp);
  registry.add(&heater);
  registry.add(&pid);

  // Load additional items persisted from the web UI. Called after the static
  // items are registered so dynamic controllers can reference them by id.
  if (sdOk) dynamicItems.loadFromSD(SD, registry);

  registry.begin();
  dynamicItems.markInitialized();  // future add*() calls will call begin()

  webUI.begin();
  Serial.println(F("BrewControl ready"));
}

void loop() {
  registry.tick();
  webUI.tick();
  delay(5);
}
