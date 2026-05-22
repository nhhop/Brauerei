# Brauerei — Systemarchitektur & Status

## Projektziel

Heimbrauerei-Steuerung auf ESP32-Basis: Sensoren (Temperatur, Druck, pH, Durchfluss), Aktoren (Heizung, Pumpen, Dispenser) und Regler (Zweipunkt, PID) werden über eine Browser-UI live überwacht und zur Laufzeit konfiguriert.

## Systemarchitektur

```
┌─────────────────────────────────────────────────────┐
│  Browser (Preact SPA, Tailwind)                     │
│  BrewControl/web/                                    │
│  - GET /api/snapshot  (initial state)               │
│  - GET /api/events    (SSE, 1 Hz push)              │
│  - POST /api/actuators/:id                          │
│  - POST /api/controllers/:id/setpoint               │
│  - POST /api/controllers/:id/params                 │
│  - POST /api/sensors, DELETE /api/sensors/:id       │
│  - POST /api/sensors/:id/reset                      │
│  - GET  /api/bus/scan?type=onewire&pin=N            │
│  - POST /api/admin/wifi-reset                       │
└────────────────────┬────────────────────────────────┘
                     │ WiFi / HTTP (ESPAsyncWebServer)
┌────────────────────▼────────────────────────────────┐
│  ESP32 Firmware                                     │
│  BrewControl/firmware/src/                          │
│  main.cpp      Boot, WiFi, Demo-Registry            │
│  WebUI.h/cpp   HTTP-API, SSE, SD-Static-Serve       │
│  WiFiSetup…    Captive Portal (erste Inbetriebnahme)│
│  DynamicItems  Laufzeit Add/Remove von Registry     │
│                                                     │
│  lib_dep: symlink://../../SensActCtrl               │
└────────────────────┬────────────────────────────────┘
                     │ C++ include
┌────────────────────▼────────────────────────────────┐
│  SensActCtrl Library                                │
│  SensActCtrl/src/                                   │
│  core/         Reading, Quantity, Registry,          │
│                Channel (multi-channel interface)    │
│  sensors/      DS18B20, BME280, Analog, Digital,    │
│                PulseCounter, MAX31865, YF_S201      │
│  actuators/    DigitalOutput (TPO), PulseOutput     │
│  controllers/  TwoPoint, PID (AutoTune)             │
│  transport/    MQTT, ESP-Now, Webhook               │
│  remote/       RemoteSensor/-Actuator/-Publisher    │
└─────────────────────────────────────────────────────┘
```

## Technologie-Stack

| Schicht | Technologie |
|---------|-------------|
| Library | C++17, PlatformIO, Arduino (ESP32) |
| Firmware | ESPAsyncWebServer 3.1, ArduinoJson 7, SD (SPI), Preferences |
| Frontend | Vite 7, Preact 10, Tailwind CSS 4, TypeScript 5, pnpm 11 |
| Tests | PlatformIO native (MinGW-w64 auf Windows) |

## Unterstützte Boards

| Board | Besonderheit |
|-------|-------------|
| esp32dev | Standard-Dev-Board, 240 MHz dual-core |
| lolin_s2_mini | Single-core, USB-CDC (TinyUSB), ARDUINO_USB_CDC_ON_BOOT=1 |
| lilygo_t_display_s3_amoled | S3 dual-core, 8 MB PSRAM, SD auf HSPI (38/41/39/40) |

## Aktueller Status (Stand 2026-05-22)

### SensActCtrl
- **Phase 1–3 abgeschlossen**: alle Abstraktionen, Sensor-/Aktor-/Regler-Implementierungen, drei Transporte
- **Multi-Channel Interface**: `Channel`-Struct, `channelCount()` / `channel(idx)` ersetzen `meta()` / `lastReading()`
- **41/41 native Tests grün**
- **13 Beispiel-Sketches** bauen für esp32dev (auf neue `channel()`-API migriert)
- Neue Sensoren: `MAX31865Sensor` (SPI, PT100/PT1000), `YF_S201Sensor` (Durchfluss + Volumen, 2 Kanäle)
- Details: `SensActCtrl/PLAN.md`, `SensActCtrl/session.md`

### BrewControl
- **MVP (11 Build-Steps) abgeschlossen**
- **E2E verifiziert** auf LOLIN S2 Mini und LilyGo T-Display-S3-AMOLED-1.43
- Laufzeit-Registry (Add/Remove) implementiert und getestet
- OneWire Bus-Scan (`GET /api/bus/scan`), Sensor-Reset (`POST /api/sensors/:id/reset`)
- AddItemModal unterstützt DS18B20 (mit Scan), MAX31865, YF-S201
- Build-Footprint: ~11 KB gzipped (Web), ~72 % Flash (Firmware)
- Details: `BrewControl/PLAN.md`, `BrewControl/SESSION.md`

## Bekannte Einschränkungen / Offene Punkte

- DS18B20 Live-Reads mit echter Sensorhardware ausstehend
- Heizung (SSR) unter Last mit Oszilloskop verifizieren
- OTA-Firmware-Update (noch nicht implementiert)
- QEMU/Simulation: nicht viable (kein WiFi-Emulation für ESP32)
- Reset-Button in SensorCard (UI-Trigger für `resetFlowVolume`)
- BME280 auf 3 Kanäle erweitern (Temp + Humidity + Pressure)
- `RemotePublisher` publiziert nur `channel(0)` — Multi-Channel via MQTT/ESP-NOW fehlt
- `examples/05_flow_meter` noch auf `PulseCounterSensor` — Beispiel mit `YF_S201Sensor` fehlt

## Weiterentwicklung

Änderungen die **nur die Library** betreffen → `SensActCtrl/` (mit Unit-Tests)  
Änderungen die **nur die UI** betreffen → `BrewControl/` (Firmware oder Web)  
Änderungen die **beide Seiten** berühren → hier im Root-`SESSION.md` protokollieren
