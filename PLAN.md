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
│  - GET  /api/config  (cfgJson aller Items, Edit-UI) │
│  - GET  /api/dashboards                             │
│  - POST /api/dashboards (create, → 201 {id})        │
│  - POST /api/dashboards/:id (update)                │
│  - DELETE /api/dashboards/:id                       │
└────────────────────┬────────────────────────────────┘
                     │ WiFi / HTTP (ESPAsyncWebServer)
┌────────────────────▼────────────────────────────────┐
│  ESP32 Firmware                                     │
│  BrewControl/firmware/src/                          │
│  main.cpp      Boot, WiFi (keine Demo-Items mehr)   │
│  WebUI.h/cpp   HTTP-API, SSE, SD-Static-Serve       │
│  WiFiSetup…    Captive Portal (erste Inbetriebnahme)│
│  DynamicItems  Laufzeit Add/Remove von Registry     │
│  DashboardStore  SD-Persistenz für Dashboards       │
│                                                     │
│  lib_dep: symlink://../../SensActCtrl               │
│           symlink://../../../IdsInductionCooker    │
└────────────────────┬────────────────────────────────┘
                     │ C++ include
┌────────────────────▼────────────────────────────────┐
│  SensActCtrl Library                                │
│  SensActCtrl/src/                                   │
│  core/         Reading, Quantity, Registry,          │
│                Channel (multi-channel interface)    │
│  sensors/      DS18B20, BME280, Analog, Digital,    │
│                PulseCounter, MAX31865, YF_S201      │
│  actuators/    DigitalOutput (TPO), PulseOutput,   │
│                IdsActuator (IDS1/IDS2 Induktion)   │
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

## Aktueller Status (Stand 2026-05-31)

### SensActCtrl
- **Phase 1–3 abgeschlossen**: alle Abstraktionen, Sensor-/Aktor-/Regler-Implementierungen, drei Transporte
- **Multi-Channel Interface**: `Channel`-Struct, `channelCount()` / `channel(idx)` ersetzen `meta()` / `lastReading()`
- **80/80 native Tests grün**
- **13 Beispiel-Sketches** bauen für esp32dev (auf neue `channel()`-API migriert)
- Neue Sensoren: `MAX31865Sensor` (SPI, PT100/PT1000), `YF_S201Sensor` (Durchfluss + Volumen, 2 Kanäle), `HCSR04Sensor` (Ultraschall, 2 Kanäle: distance + derived), `HX711LoadCellSensor` (Wägezelle)
- Neue Aktoren: `IdsActuator` (IDS1/IDS2), `AnalogOutputActuator` (PWM/DAC, `SENSACTCTRL_HAS_DAC`-Guard)
- `fault()`-Interface: nicht-brechende Default-Methode auf `Sensor` + `Actuator`; `RegistrySnapshot` emittiert `"fault"` nur wenn gesetzt
- `Quantity::Distance` neu (zwischen `Count` und `Custom`)
- `Controller`-Basisklasse: `setEnabled(bool)` / `enabled()` — `PIDController` + `TwoPointController` respektieren Guard in `tick()`; `enabled` in `paramsJson` + `setParamsJson` + `RegistrySnapshot`
- Details: `SensActCtrl/PLAN.md`, `SensActCtrl/session.md`

### BrewControl
- **MVP (11 Build-Steps) abgeschlossen**
- **E2E verifiziert** auf LOLIN S2 Mini und LilyGo T-Display-S3-AMOLED-1.43
- Laufzeit-Registry (Add/Remove) implementiert und getestet
- OneWire Bus-Scan (`GET /api/bus/scan`), Sensor-Reset (`POST /api/sensors/:id/reset`)
- AddItemModal unterstützt DS18B20 (mit Scan), MAX31865, YF-S201, IDS1/IDS2 (Induktion), HC-SR04 (Ultraschall), HX711, AnalogOutput
- Fault-Badge in `SensorCard` + `ActuatorCard` (gelb, wenn `fault` im Snapshot gesetzt)
- **Edit-Funktion (2026-05-30):** Alle Items (Sensor/Aktor/Regler) editierbar via DELETE+POST; `/api/config` liefert cfgJson; AddItemModal im Edit-Modus vorbelegt und Typ-Selector gesperrt
- **ControllerCard (2026-05-30):** Ist-Wert (verlinkter Sensor), Reglerausgang (verlinkter Aktor), Enable/Disable-Toggle; params-Textarea entfernt
- **TwoPoint-Regler (2026-05-30):** DynamicItems-Branch + Frontend-Formular (hystLow, hystHigh, inverted)
- **Hardcodierte Demo-Items entfernt (2026-05-30):** `main.cpp` startet mit leerer Registry; SD-Konfiguration füllt sie
- **Multi-Dashboard (2026-05-31):** Benutzer-definierte Tabs; jedes Dashboard filtert Sensoren/Aktoren/Regler nach gewählter Teilmenge; SD-Persistenz unter `/config/dashboards.json`; `DashboardStore`-Klasse; 4 neue REST-Endpunkte; `DashboardEditorModal` im Frontend; `filterSnap()` mit Base-ID-Mapping für Multi-Channel-Sensoren
- **Settings-Tab (2026-05-31):** `⚙`-Tab ganz rechts; `+ Hinzufügen` aus globalem Header entfernt und dort positioniert; Dashboard-Tabs sind reine Monitoring-Ansichten; `DashboardEditorModal` embeds `AddItemModal` als Sub-Modal mit `onCreated`-Auto-Check
- Build-Footprint: ~11 KB gzipped (Web), ~14.5 % Flash / ~14.7 % RAM (lilygo_t_display_s3_amoled, 2026-05-30)
- Details: `BrewControl/PLAN.md`, `BrewControl/SESSION.md`

## Roadmap

### Peripherie-Abstraktion (Rückgrat, zuerst)

`Peripheral`-Interface (`id`, `type`, `begin`/`tick`/`end`) + `PeripheralRegistry`, das geteilte Busse (OneWire / I2C / SPI / CAN) beim ersten passenden Consumer automatisch anlegt. Sensoren/Aktoren referenzieren per Bus-Id oder hängen sich anhand der Pins automatisch an. Verallgemeinert die bestehende `getOrCreateBus`-Logik in `DynamicItems.cpp`, beseitigt die SPI-Pin-Duplizierung bei MAX31865. Port-Expander / CAN-Transceiver = spätere konkrete Peripherie auf derselben Naht (Hardware aktuell nicht vorhanden).

### Pin-Manager (firmware, auf Peripherie aufbauend)

Board-Capability-Map (per Board-Define ausgewählt): Input-only Pins 34–39, Strapping-Pins, Flash/PSRAM-belegte Pins (z.B. 33–37 auf S3-AMOLED), DAC-Pins 25/26, Default I2C/SPI/UART. `GET /api/pins` liefert frei/belegt; Belegung = Peripherie (geteilt/beitrittsfähig) + Items mit exklusiven Pins. Stufen: Tier 1 Belegung + Map → Tier 2 Constraint-Query (interrupt-/serial-/dac-fähig) → Tier 3 Protokoll-Vorschläge (bestehende Bus-Peripherie bevorzugen, ergibt sich aus Peripherie-Modell).

### Interaktives LVGL-Display (firmware, board-spezifisch)

Snapshot-Consumer (rendert Werte per LVGL) **und** Command-Quelle (Touch → `writeActuator` / `setSetpoint` über bestehende WebUI-Handler). Kein Aktor — eigene Klasse, LVGL gekapselt; stärkste Analogie ist `RemotePublisher`. Ziel-Board: LilyGo T-Display-S3-AMOLED. Größter Scope, eigene Spec vor Implementierung.

**Sequenz:** Peripherie-Rückgrat → Pin-Manager → Display (größtenteils unabhängig, zuletzt).

---

## Bekannte Einschränkungen / Offene Punkte

- Heizung (SSR) unter Last mit Oszilloskop verifizieren
- OTA-Firmware-Update (noch nicht implementiert)
- QEMU/Simulation: nicht viable (kein WiFi-Emulation für ESP32)
- `RemotePublisher` Multi-Channel via MQTT/ESP-NOW ✓ (2026-05-29)
- IDS-Induktionskocher E2E-Test mit echter Hardware ausstehend
- **Frontend: gruppierte SensorCard für Multi-Channel-Sensoren** — HCSR04 und YF-S201 erzeugen je 2 separate Karten (`tank.distance` / `tank.derived`, `flow.rate` / `flow.volume`). Verbesserung: `app.tsx` gruppiert Snapshot-Einträge nach Base-ID, eine Karte pro logischem Sensor mit mehreren Kanal-Zeilen. Delete-Button und Zähler zeigen dann korrekt logische Sensoren statt Kanäle. Quick-Fix für korrektes Delete/Reset bereits angewendet (2026-05-30).

## Weiterentwicklung

Änderungen die **nur die Library** betreffen → `SensActCtrl/` (mit Unit-Tests)  
Änderungen die **nur die UI** betreffen → `BrewControl/` (Firmware oder Web)  
Änderungen die **beide Seiten** berühren → hier im Root-`SESSION.md` protokollieren
