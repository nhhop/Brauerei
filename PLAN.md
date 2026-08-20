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
│  - GET  /api/settings                               │
│  - POST /api/settings  (partial patch)              │
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
│  SettingsStore   SD-Persistenz für App-Settings     │
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

## Aktueller Status (Stand 2026-06-01)

### SensActCtrl
- **Phase 1–3 abgeschlossen**: alle Abstraktionen, Sensor-/Aktor-/Regler-Implementierungen, drei Transporte
- **Multi-Channel Interface**: `Channel`-Struct, `channelCount()` / `channel(idx)` ersetzen `meta()` / `lastReading()`
- **101/101 native Tests grün**
- **13 Beispiel-Sketches** bauen für esp32dev (auf neue `channel()`-API migriert)
- Neue Sensoren: `MAX31865Sensor` (SPI, PT100/PT1000), `YF_S201Sensor` (Durchfluss + Volumen, 2 Kanäle), `HCSR04Sensor` (Ultraschall, 2 Kanäle: distance + derived), `HX711LoadCellSensor` (Wägezelle)
- Neue Aktoren: `IdsActuator` (IDS1/IDS2), `AnalogOutputActuator` (PWM/DAC, `SENSACTCTRL_HAS_DAC`-Guard)
- `fault()`-Interface: nicht-brechende Default-Methode auf `Sensor` + `Actuator`; `RegistrySnapshot` emittiert `"fault"` nur wenn gesetzt
- `Quantity::Distance` neu (zwischen `Count` und `Custom`)
- `Controller`-Basisklasse: `setEnabled(bool)` / `enabled()` — `PIDController` + `TwoPointController` respektieren Guard in `tick()`; `enabled` in `paramsJson` + `setParamsJson` + `RegistrySnapshot`
- **MQTT-Detach (2026-08-19):** `RemotePublisher::detach(Sensor&/Actuator&/Controller&)` + `ITransport::unsubscribe()` (nicht-brechender Default) — sicheres Live-Entfernen angehängter Items, verhindert Use-after-free bei zur Laufzeit gelöschten Aktoren/Controllern (stale Subscription-Closures). `MqttTransport`-Konstruktor um optionale `username`/`password` erweitert.
- **Generischer MQTT-Aktor (2026-08-21):** `MqttGenericActuator` (`actuators/`) — publiziert auf einen frei konfigurierbaren Topic statt des festen device/id-Schemas, mit Payload-Template (`{value}`-Platzhalter) oder zwei literalen An/Aus-Payloads; für Fremdgeräte wie Sonoff/Tasmota-Steckdosen gedacht, nicht für SensActCtrl-Node-zu-Node-Talk (dafür bleibt `RemoteActuator`). Nimmt `ITransport&` direkt entgegen (kein neues Interface), `fault()` delegiert an `ITransport::connected()`/`lastErrorMessage()` — kein eigenes Publish-Tracking. Choke-Point-Pattern wie `DigitalOutputActuator::applyPin()`. 173 native Tests grün (17 neu).
- **Generischer MQTT-Sensor (2026-08-21):** `MqttGenericSensor` (`sensors/`) — abonniert einen frei konfigurierbaren Topic, parst den Payload entweder als rohe Zahl oder (via `json_field`) als benanntes Top-Level-Feld eines JSON-Objekts (z.B. Zigbee2MQTT-artige Geräte, `{"temperature":23.5,"humidity":60}`). Symmetrisch zum Aktor: `ITransport&` direkt, `fault()` delegiert genauso. Fehlerhafte/nicht parsbare Nachrichten werden still ignoriert (letzter gültiger Wert bleibt stehen), analog zu `RemoteSensor`s Toleranz. 189 native Tests grün (15 neu, plus 1 vorbestehende, ungeklärte Differenz — s. SESSION.md).
- **Dual-Output-Regler (Gärsteuerung, 2026-06-02):** `DualStageController` (Bang-Bang Heizen+Kühlen, Totband über Heiz-/Kühl-Differenzial, Anti-Short-Cycle auf der Kühlstufe) + `SplitRangePIDController` (bipolarer PID −1..+1, positiv heizt / negativ kühlt, Output-Totband). Beide: 1 Sensor → 2 Aktoren (beide optional), Fail-safe→beide-aus bei dead sensor/disabled, strukturelle Mutual-Exclusion + harte Interlock-Schranke + optionale Umschalt-Totzeit `changeoverMs`. Eigenständige Geschwister von PID/TwoPoint (kein gemeinsamer Basistyp), selbst-enthaltener PID (kein AutoTunePID, PIDController unverändert) PID-Engine in `detail::PidEngine` extrahiert (von `PIDController` + `SplitRangePIDController` geteilt); **SplitRangePID unterstützt jetzt AutoTune** (Relay über die geteilte Engine, Umschalt-Totzeit während des Tunes pausiert).
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
- **PID-AutoTune über Web (2026-06-02):** Start/Stop + Methodenwahl (5 Algorithmen) + Statusanzeige (idle/running/done) in der ControllerCard; Trigger als `{"autotune":"start"|"stop"}` über `POST /api/controllers/:id/params` (kein neuer Endpunkt); `PIDController::stopAutotune()` neu, Start aktiviert den Regler implizit. Nur PID-Regler. Reale Tuning-Schleife hardware-verifiziert (nativ No-Op). Seit 2026-06-02 auch für `SplitRangePID`-Regler (geteilte `PidEngine`); ControllerCard zeigt den AutoTune-Block für alle PID-Familien-Regler (`params.Kp != null`).
- **Gärsteuerung — Dual-Output-Regler (2026-06-02):** zwei neue Reglertypen im AddItemModal — „Heizen/Kühlen (Zweipunkt)" = `DualStage`, „Heizen/Kühlen (PID)" = `SplitRangePID`; gemeinsamer Sensor-Dropdown + zwei Aktor-Dropdowns (Heizung/Kühlung, je optional); ControllerCard zeigt zwei Ausgänge (Heizen/Kühlen); Zeit-Felder im UI in Sekunden (×1000 → ms im Wire-Format); `CtrlEntry.coolActuatorId` + erweiterte Lösch-Abhängigkeitsprüfung (referenzierter Kühl-Aktor blockiert); kein neuer Endpunkt, zwei neue `type`-Werte für `POST /api/controllers`. **Regler-Typ-Auswahl als gruppiertes Dropdown** (`<optgroup>` Zweipunktregler / PID statt Segment-Buttons, 2026-06-02)
- **Appearance-Settings / Design-Theme (2026-06-01):** `SettingsStore` (SD-Persistenz unter `/config/settings.json`); `GET/POST /api/settings` mit Enum-Validierung (mode, background) und Hex-Check (accent); CSS-Token-System (8 semantische Variablen `--bg/--surface/--fg/--muted/--faint/--border/--accent/--accent-fg`, Hell/Dunkel/System via `data-theme`, Tönung via `data-tint`); `theme.ts` mit Flash-Vermeidung per localStorage-Cache; Settings-Hub (`/settings`) mit Unterseiten `Darstellung` (`/settings/appearance`) + `Geräte` (`/settings/devices`); alle UI-Komponenten auf semantische Klassen umgestellt (Dark-Mode ready); Settings-Store-Infrastruktur für spätere Settings-Bereiche (Zeit & Formate etc.)
- **Sollwert-Programme / Maischeprofile (2026-06-08):** `ProgramRunner` (Firmware) treibt zeitgesteuert `Controller::setSetpoint()` durch eine Liste benannter Schritte (`{name?, setpoint, holdSec, confirm?}`); Sollwert springt aufs Ziel, Halte-Timer ab Schrittbeginn. Zustände `idle/running/awaiting/paused/done`; Steuerung `start/pause/resume/stop/next/prev`; `confirm`-Schritt wartet auf manuelle Freigabe (`awaiting`). Reboot-Resume über absolute Wall-Clock-Epoch pro Schritt (Persistenz nur bei Übergängen, no-op bis NTP synct, wie LogStore); rekursiver FreeRTOS-Mutex. Dashboard-Widget `ProgramCard` (Polling `GET /api/programs` ~2 s, kein SSE-Eingriff) + `ProgramEditorModal`; Dashboard-Referenz via `programs[]` (analog `charts[]`). Endpunkte `GET/POST /api/programs`, `POST/DELETE /api/programs/:id`, `POST /api/programs/:id/control`. Keine Library-Änderung.
- **Sollwert-Ratenbegrenzung (2026-08-12):** `RateLimitedController`-Decorator (SensActCtrl) begrenzt die Änderungsrate eines Sollwerts (°/min); optional pro Regler via `max_rate_per_sec`.
- **Aktor-Master-Schalter (2026-08-13, umgebaut 2026-08-19):** `enabled()`/`setEnabled()` sind konkreter State direkt auf der `Actuator`-Basisklasse (analog `Controller.h`, kein Decorator mehr — der ursprüngliche `EnableGuardActuator` ist ersatzlos entfallen). Jede Aktor-Klasse gated ihren eigenen physikalischen Ausgang an der Stelle, wo sie die Hardware anfasst (`DigitalOutputActuator`: `applyPin()`, deckt Binary **und** TimeProportional; `AnalogOutputActuator`: PWM/DAC-Raw; `PulseOutputActuator`: friert die Pulsqueue ein statt Pulse zu verschlucken; `IdsActuator`/`RemoteActuator`: senden aktiv „aus" statt zu verstummen, da beide ein Keep-Alive-Protokoll sprechen). Gilt jetzt für **alle** Aktor-Arten (vorher nur Continuous). Bei Binary ist der Schalter die einzige Bedienung — Wert fest auf „an", Aktor startet disabled (Reboot schließt nie ein Relais von selbst); das ON/OFF-Label zeigt den physikalischen Ist-Zustand statt der Schalterstellung. Ein ⏻-Button pro Karte, nie zwei. HW-E2E: Re-Enable während laufendem Intervall 0,27 s (vorher bis zu 50 s, s. u.).
- **Aktor-Intervallbetrieb (2026-08-14):** `IntervalActuator`-Decorator (SensActCtrl) taktet einen Aktor „an" für X von Y Sekunden, wiederholend; konfigurierbare Zeitbasis (Zykluslänge + Einheit s/min/h), Opt-in via `interval_on_sec`/`interval_period_sec`, gilt für alle Aktor-Arten (nicht nur Continuous). Wrapt den konkreten Aktor direkt — der Master-Schalter lebt in diesem selbst (s. o.), keine zweite Decorator-Schicht mehr nötig. Live editierbar auf der `ActuatorCard` (nur der An-Anteil; Zykluslänge/Einheit bleiben Modal-only) über einen `interval`-Zweig am bestehenden `/api/actuators/:id`-Endpunkt. Re-Enable startet den Zyklus neu (sofortiges An-Fenster statt Warten auf die alte Taktung). HW-E2E auf LilyGo T-Display-S3-AMOLED grün.
- **Aktor-Sollwert vs. Ist-Wert (2026-08-18/19):** `target()` (zuletzt kommandierter Wert) ergänzt `state()` (physikalischer Ist-Wert) auf der `Actuator`-Schnittstelle. Behebt, dass der Bedien-Slider auf 0 sprang, sobald der Master-Schalter aus war oder ein Intervall in der Aus-Phase steckte — Controls binden an das neue Snapshot-Feld `target`, Charts/Logs weiter an `state.v`. Ursprünglich (08-18) als Decorator-Reihenfolge-Tausch + `forceOutput()`-Methode gelöst; dieser Zwischenstand wurde noch am selben Tag durch den Basisklassen-Umbau oben ersetzt (`forceOutput()` ist wieder entfallen, `target()` blieb). 150 native Tests grün.
- **MQTT-Einstellungen (2026-08-19/20):** `/settings/mqtt` — externer Broker (Host/Port/Creds/TLS) oder embedded Broker (`hsaturn/TinyMqtt`, Build-Zeit-Auth-Patch); `MqttService` verdrahtet `SettingsStore`+`DynamicItems`, Sensoren/Aktoren/Regler werden live nachgeführt. Alle 3 Boards unterstützt (`BREWCTL_HAS_EMBEDDED_MQTT_BROKER`), Flash-Kosten real gemessen: +10 KB kombiniert. HW-verifiziert auf LilyGo S3 (User: embedded Broker mit/ohne Auth erfolgreich verbunden). Commit `0f85bb0`.
  - **Nachbesserung (2026-08-20):** der embedded Modus konnte anfangs keine eigenen Daten publizieren — `WiFiClient` kann sich auf diesem Gerät nicht selbst verbinden (weder `127.0.0.1` noch die eigene WiFi-IP, `PubSubClient state -4`). Gefixt durch `TinyMqttLocalTransport` (neuer `ITransport`-Adapter um TinyMqtts eigenen In-Process-Client `MqttClient(&broker)`, kein TCP mehr im embedded Pfad) — löst nebenbei die Doppelstruktur mit PubSubClient auf, die embedded Modus vorher unnötig mitschleppte. Live-Tracking danach vollständig HW-verifiziert (Add/Remove/Set-auf-gelöschtem-Aktor/Stresstest). **Externer Broker-Modus ebenfalls vollständig HW-verifiziert** (2026-08-20, lokaler Mosquitto als Testbroker): ohne Auth, mit Auth, Auth-Negativtest, TLS+Auth — alle vier grün. Damit sind **alle** HW-E2E-Punkte aus der MQTT-Planungssession abgeschlossen. Details: `SESSION.md` (Root, 2026-08-20).
- **Generischer MQTT-Aktor (2026-08-21):** `AddItemModal` — Aktor-Typ „MQTT Generic", Topic + Retained + An/Aus- oder Wert-Formular (Payload-Template); `ActuatorCard` unverändert (dispatcht nur nach `meta.kind`). `DynamicItems::addActuatorNoBegin` neuer `"MqttGeneric"`-Branch, gated auf einen neuen `setMqttTransport(ITransport*)`-Setter. **Boot-Reihenfolge umgebaut:** `MqttService::begin()` in `begin()` (Transport+Publisher) und `attachExisting()` (Boot-Snapshot-Attach + Hook-Registrierung) gesplittet — `begin()` läuft jetzt vor `dynamicItems.loadFromSD()` (dafür `settingsStore.loadFromSD()` vorgezogen), `attachExisting()` an der alten Stelle nach `registry.begin()`/`markInitialized()`, Verhalten dort unverändert. Damit existiert der Transport (oder ist definitiv `nullptr`), bevor ein persistierter `MqttGeneric`-Aktor konstruiert wird; ohne MQTT wird ein solcher Aktor beim Laden übersprungen statt zu crashen. Alle 3 Boards kompilieren (Flash minimal +). HW-E2E auf LilyGo S3 verifiziert.
- **Generischer MQTT-Sensor (2026-08-21):** `AddItemModal` — Sensor-Typ „MQTT Generic" (neue Optgroup „MQTT"), Topic + optionales JSON-Feld + Min/Max/Schritt/Einheit; `SensorCard` unverändert. `DynamicItems::addSensorNoBegin` neuer `"MqttGeneric"`-Branch, nutzt denselben `mqttTransport_`. HW-E2E auf LilyGo S3 verifiziert: roher Zahlwert und JSON-Feld-Extraktion aus Multi-Feld-Payload beide korrekt im Snapshot angekommen.
- Build-Footprint: ~11 KB gzipped (Web), ~14.5 % Flash / ~14.7 % RAM (lilygo_t_display_s3_amoled, 2026-05-30); mit MQTT (2026-08-19): esp32dev 67.2 %, lolin_s2_mini 64.0 %, LilyGo S3 19.1 % Flash
- Details: `BrewControl/PLAN.md`, `BrewControl/SESSION.md`

## Roadmap

Zwei **parallele Tracks** ohne feste Reihenfolge zueinander — je nach Lust und verfügbarer Hardware mal am Rückgrat (Architektur), mal an Features arbeiten. Daneben zwei „bei Gelegenheit"-Buckets (UI-Polish, Hardware-Verifikation).

### Architektur-Track (Rückgrat)

#### Peripherie-Abstraktion (zuerst im Track)

`Peripheral`-Interface (`id`, `type`, `begin`/`tick`/`end`) + `PeripheralRegistry`, das geteilte Busse (OneWire / I2C / SPI / CAN) beim ersten passenden Consumer automatisch anlegt. Sensoren/Aktoren referenzieren per Bus-Id oder hängen sich anhand der Pins automatisch an. Verallgemeinert die bestehende `getOrCreateBus`-Logik in `DynamicItems.cpp`, beseitigt die SPI-Pin-Duplizierung bei MAX31865. Port-Expander / CAN-Transceiver = spätere konkrete Peripherie auf derselben Naht (Hardware aktuell nicht vorhanden).

#### Pin-Manager (firmware, auf Peripherie aufbauend)

Board-Capability-Map (per Board-Define ausgewählt): Input-only Pins 34–39, Strapping-Pins, Flash/PSRAM-belegte Pins (z.B. 33–37 auf S3-AMOLED), DAC-Pins 25/26, Default I2C/SPI/UART. `GET /api/pins` liefert frei/belegt; Belegung = Peripherie (geteilt/beitrittsfähig) + Items mit exklusiven Pins. Stufen: Tier 1 Belegung + Map → Tier 2 Constraint-Query (interrupt-/serial-/dac-fähig) → Tier 3 Protokoll-Vorschläge (bestehende Bus-Peripherie bevorzugen, ergibt sich aus Peripherie-Modell).

#### Interaktives LVGL-Display (firmware, board-spezifisch)

Snapshot-Consumer (rendert Werte per LVGL) **und** Command-Quelle (Touch → `writeActuator` / `setSetpoint` über bestehende WebUI-Handler). Kein Aktor — eigene Klasse, LVGL gekapselt; stärkste Analogie ist `RemotePublisher`. Ziel-Board: LilyGo T-Display-S3-AMOLED. Größter Scope, eigene Spec vor Implementierung. Profitiert vom Feature-Track: Charts, Timer und Sollwert-Rampen kann das Display mit anzeigen.

**Track-interne Sequenz:** Peripherie-Rückgrat → Pin-Manager → Display (größtenteils unabhängig, zuletzt).

### Feature-Track (Wellen)

Innerhalb einer Welle grob nach Reihenfolge; jeder Punkt bekommt bei Bedarf eine eigene Spec → Plan → Implementierung.

**Welle 1 — Bestehendes besser machen (self-contained, hoher Sofortnutzen)**
- ~~**PIN-Invertierung**~~ ✓ — erledigt 2026-06-03 (DigitalInput `invert` + DigitalOutput `activeHigh`/active-low, Library→Firmware→Frontend end-to-end; Commits `941da78`/`2e0b57c`)
- **Sensor-Kalibrierung** — einheitliches Offset/Scale-Interface (ggf. Mehrpunkt) + UI; ersetzt die heutigen ad-hoc-Lösungen (HX711-`tare`, YF-S201-`calibration`, Analog-`setRange`).
- **PID-AutoTune über Web** — Start/Stop/Status für die bestehende AutoTune-Logik über API + UI (Algorithmus existiert in der Library).
  - *Später:* Fortschrittsanzeige/Restzeit für den laufenden AutoTune-Vorgang (braucht zusätzliche Instrumentierung im Backend; v1 zeigt nur idle/running/done).
- ~~**Design/Theme-Einstellungen**~~ ✓ — abgeschlossen 2026-06-01 (s. Aktueller Status).
- ~~**Aktor-Master-Schalter**~~ ✓ — abgeschlossen 2026-08-13 (s. Aktueller Status; `EnableGuardActuator`-Decorator, on/off unabhängig vom Slider-Wert mit Restore-Verhalten).
- ~~**Zeit & Formate**~~ ✓ — abgeschlossen 2026-06-05: NTP-Sync (`configTime()`) nach WiFi-Connect; konfigurierbare Zeitzone (UTC-Offset + DST), Zeitformat (24h/12h), Datumsformat (DD.MM.YYYY / MM/DD/YYYY / YYYY-MM-DD), NTP-Server; `serverTime` im SSE-Snapshot (Unix-Timestamp, nur wenn NTP synced); Live-Uhr auf Settings-Hub; `/settings/time`-Unterseite mit Zeitzone-Dropdown (25 Regionen).
  - *Später:* Mehrsprachigkeit — Sprache in „Zeit & Region"-Seite wählbar (Umbenennung von „Zeit & Formate").
  - *Später:* Hardware-RTC (PCF8563) als Fallback für Betrieb ohne WiFi — LilyGo T-Display-S3-AMOLED hat den Chip onboard; einmalige NTP-Sync schreibt in RTC, danach zeitstempelstabil auch offline.

**Welle 2 — Prozess-Features (greifen ineinander)**
- **Gradienten/Ableitungen (Library)** — rate-of-change als zusätzlicher Channel (°C/min, K/min, L/min²). ⚠️ Voraussetzung: gruppierte SensorCard (s.u.), da hierdurch weitere Kanäle pro Sensor entstehen.
- **Datenlogging & Trend-Charts** ✓ — abgeschlossen 2026-06-06 (Branch `feat/datalog`): Log-Config = Chart-Config; `LogStore` sampelt Serien (`sensor/…`, `actuator/…`, `controller/…`) in Sessions `/logs/<id>/<start>.csv`. Online-Datenreduktion `LogCompressor` mit zwei Algorithmen (Linear-Interpolation + Swinging Door, NaN-sicher, Lockstep über Serien, Timeout-Stützpunkt, 12 native Tests). uPlot-`ChartCard` (CSV-Hydration + Live aus SSE), zentrale `/settings/logs`-Verwaltung, Dashboard-Referenz via `charts[]`. Lifecycle: Logging-Toggle, Controller-Binding, Clear/Session-Rotation, Archiv-Seite (`/settings/logs/:id/archive`), globale Retention (200 MB, älteste Sessions zuerst). HW-E2E auf LilyGo S3-AMOLED verifiziert (2026-06-06). Playwright-UI-Tests aller Frontend-Flächen grün (2026-06-07); dabei Cross-Task-Race auf `logs_` (AsyncTCP-Handler vs. `loopTask`-`tick()`) gefunden & per rekursivem FreeRTOS-Mutex gefixt, HW-verifiziert.
  - *Später:* API-seitige Dezimierung (LTTB/Douglas-Peucker mit `?points=`) für sehr lange Archiv-Zeiträume; Live-Chart-Append an `intervalSec` angleichen (aktuell 1 Hz).
- **Sollwert-Rampen / Maischeprofile** ✓ — abgeschlossen 2026-06-08 (Branch `feat/setpoint-programs`): zeitgesteuerte Setpoint-Folge mit benannten Schritten `{name?, setpoint, holdSec, confirm?}`; Sollwert springt aufs Ziel, Halte-Timer ab Schrittbeginn (keine Rampe/kein Sensor-Feedback in v1). `ProgramRunner` (BrewControl-Firmware, keine Library-Änderung) treibt `Controller::setSetpoint()`; Reboot-Resume über absolute Wall-Clock-Epoch pro Schritt; rekursiver Mutex gegen Cross-Task-Race. Dashboard-Widget (`ProgramCard`, Polling) mit Start/Pause/Stop/Weiter/Zurück + optionaler manueller Freigabe pro Schritt (`awaiting`); `ProgramEditorModal`; Dashboard-Referenz via `programs[]`. Endpunkte `GET/POST /api/programs`, `POST/DELETE /api/programs/:id`, `POST /api/programs/:id/control`. Spec: [docs/superpowers/specs/2026-06-08-setpoint-programs-design.md](docs/superpowers/specs/2026-06-08-setpoint-programs-design.md). esp32dev SUCCESS, `pnpm typecheck`/`build` grün. **HW-E2E grün (2026-06-08, LilyGo S3):** komplette Zustandsmaschine (start/auto-advance/awaiting/next/pause/resume/prev/stop/Negativtest/delete) + **Reboot-Resume** (Restzeit zählt über Stromlos-Phase real weiter, Sollwert re-appliziert) verifiziert.
  - *Später (vorgemerkt 2026-08-12):* **Profil-Bibliothek** — eigene Seite/Menüpunkt „Profile": wiederverwendbare Schritt-Vorlagen (Maischeplan, Gärverlauf) anlegen und benennen, statt Schritte bei jedem neuen Programm erneut einzutippen. Im `ProgramEditorModal` ein Profil auswählen → befüllt die Schritte einer konkreten `programs[]`-Instanz (Kopie, nicht Live-Referenz — Instanz bleibt unabhängig editierbar/lauffähig, auch wenn das Profil später geändert wird). Vermutlich analog `DashboardStore`/`SettingsStore`: eigener `ProfileStore` mit SD-Persistenz + REST (`GET/POST /api/profiles`, `POST/DELETE /api/profiles/:id`).
  - *Später (vorgemerkt 2026-08-12):* **Multi-Regler-Programme** — ein Schritt hält heute genau einen Sollwert für einen Controller. Besonders für die Gärung wäre es interessant, pro Schritt mehrere Ziele zu koppeln: Temperatur (Heizen/Kühlen via `DualStage`/`SplitRangePID`), Druck (Ventil-Aktor), plus einmalige Aktor-Trigger zu einem Zeitpunkt im Programm (z.B. Hopfen-Dropper, der auslöst statt dauerhaft einen Sollwert zu halten). Würde das `ProgramRunner`/`programs[]`-Schema erweitern: Liste von Zielen pro Schritt (`{controllerId, setpoint}[]`) plus optionale One-Shot-Aktor-Aktionen statt nur einem Sollwert. Betrifft auch die Profil-Bibliothek (s.o.) — Profile müssten dann mehrere Regler-/Aktor-Ziele pro Schritt referenzieren können.
  - *Später (vorgemerkt 2026-08-12):* **Sensorgetriggerte Schritte** — ein Schritt endet heute nur über `holdSec` (Zeit) oder `confirm` (manuelle Freigabe). Sinnvolle dritte Bedingung: Schrittende an einen Sensorwert koppeln, z.B. „Gravity < 1.010" beim Gären, statt/zusätzlich zur Haltezeit. Braucht eine generische Schwellwert-Bedingung (`{sensorId, op, value}`) im Schritt-Schema — lässt sich vermutlich mit der Auswertungslogik von Alarme & Schwellwerte (s.o.) teilen.
- **Timer-Widget** — Dashboard-Element für Brau-Timings.
- **Alarme & Schwellwerte** — „Wert > X" → Warnung/Badge, baut auf `fault()` auf.
  - *Erweiterung (vorgemerkt 2026-08-12):* **Notification/Alert-Center** — zentrale Toast-/Verlaufsansicht statt nur Karten-Badge, z.B. bei Fault, Programm-Ende, AutoTune-fertig. Baut auf dem neuen Fluent/WinUI-Designsystem auf (passt zu den kürzlichen NavShell-/Settings-Arbeiten).
- ~~**Generischer MQTT-Aktor**~~ ✓ — abgeschlossen 2026-08-21 (s. Aktueller Status; `MqttGenericActuator` in SensActCtrl, frei konfigurierbarer Topic + Payload-Template, für Sonoff/Tasmota-artige Fremdgeräte). HW-E2E auf LilyGo S3 verifiziert (Binary + Continuous, Master-Schalter, Clamping); nur die tatsächliche Sonoff/Tasmota-Steckdose selbst nicht am Gerät angeschlossen getestet.
- ~~**Generischer MQTT-Sensor**~~ ✓ — abgeschlossen 2026-08-21 (s. Aktueller Status; `MqttGenericSensor`, frei konfigurierbarer Topic, roher Zahlwert oder JSON-Feld-Extraktion). HW-E2E auf LilyGo S3 verifiziert (beide Payload-Modi).
- **Kabellose SensActCtrl-Knoten über die Web-UI** (Recherche + Plan 2026-08-21, s. `SESSION.md`) — `RemoteSensor`/`RemoteActuator`/`RemotePublisher` existieren in der Library vollständig und sind komplett transport-agnostisch (`ITransport&`), aber nirgends an `DynamicItems`/`AddItemModal` angebunden. Anders als die generischen MQTT-Sensor/Aktor-Typen (beliebiger Topic, für Fremdgeräte) geht es hier um echte SensActCtrl-Node-zu-Node-Kommunikation (ein zweiter ESP32, der sich per Meta/State-Protokoll bei BrewControl anmeldet). Geplant in drei Schritten, der Reihe nach: (1) **MQTT** — startbereit, reuse `mqttTransport_`, kein neuer Tick-Pump. (2) **Webhook** — neue `WebhookService`-Klasse (mehrere Peer/Port-Paare), eigener Tick-Pump. (3) **ESP-NOW** — braucht vorher einen Fix in `EspNowTransport::initEspNow_()` (`EspNowTransport.cpp:43-44` trennt aktuell unconditional das WLAN; Fix: nur trennen wenn nicht schon STA-verbunden, sonst `peer.channel=0` = aktuellen Kanal übernehmen), sonst reißt es BrewControls eigenes WLAN weg.
- ~~**Aktor-Intervallbetrieb / Duty-Cycle**~~ ✓ — abgeschlossen 2026-08-14 (s. Aktueller Status; `IntervalActuator`-Decorator, konfigurierbare Zeitbasis statt fest „X/60 Minuten", live editierbarer An-Anteil auf der ActuatorCard).


**Welle 3 — Infrastruktur (größere Brocken / später)**
- ~~**Backup & Restore**~~ — **erledigt 2026-06-04** (Spec:
  [docs/superpowers/specs/2026-06-04-backup-restore-design.md](docs/superpowers/specs/2026-06-04-backup-restore-design.md)):
  `GET/POST /api/backup` bündelt die 3 `/config`-Dateien zu einer JSON-Datei;
  Restore validiert-vor-Schreiben, überschreibt + Reboot (Boot-Lade-Pfad).
  Settings-Seite „Backup & Restore". Nur Config, kein WiFi. HW-E2E auf LilyGo S3
  verifiziert (export → mutate → restore → verify + Negativtest); PR #7 gemergt.
- **Webhook-Sensor-Aktor**
- ~~**OTA-Firmware-Update**~~ — **erledigt 2026-06-03** (Spec:
  [docs/superpowers/specs/2026-06-03-firmware-update-design.md](docs/superpowers/specs/2026-06-03-firmware-update-design.md)):
  drei Wege — Browser-Upload (`.bin`/`.tar`), GitHub-Release-Pull, täglicher
  Auto-Check. Varianten-Modell pro Board-Env; UI serviert aus `/www` (atomarer
  Swap). 4-MB-Boards auf `min_spiffs.csv` (OTA-Headroom). HW-E2E auf LilyGo S3
  verifiziert (Upload + Server-Pull); CI-Release-Pipeline grün; PR #6 gemergt.
  - **SD-Boot-Flash (Recovery, 2026-06-05):** `/firmware.bin` im SD-Root wird
    beim Boot geflasht (vor WiFi → funktioniert ohne Netzwerk), danach gelöscht;
    `FirmwareUpdater::flashFromSdImage()`. Build grün. HW-E2E ausstehend:
    `firmware.bin` auf SD-Root legen, Boot beobachten (Serial: „SD firmware image …
    flashing" → „SD firmware flashed — rebooting"), Datei danach weg prüfen.
  - -> auch für das hinzufügen von Displays relevant. Firmware je nach Display laden (online oder SD-Karte)
- **Netzwerk/WLAN-Einstellungen** — *STA-Teil erledigt 2026-06-07* (Branch `feat/datalog`): Settings-Seite `/settings/network` mit Status (SSID/IP/RSSI/MAC/Hostname), WLAN-Wechsel (Scan + Creds → Reboot) und konfigurierbarem mDNS-Hostname (NVS `brewctrl/hostname`); „Reset WiFi" vom Dashboard hierher verschoben. Endpunkte `GET/POST /api/network` + `GET /api/network/scan`. **HW-E2E grün** (LilyGo S3, 2026-06-07): Status/Scan/Hostname/Reset verifiziert. Scan im laufenden STA brach anfangs die Verbindung ab → gehärtet: WLAN-Watchdog in `loop()` (`maintainWiFi()`: reconnect nach 10 s, reboot nach 60 s) + kürzere Scan-Dwell (100 ms) + resilienter Frontend-Poll mit manuellem SSID-Fallback.
  - *Später:* AP-Modus als wählbare Alternative (Standalone ohne Router) — verschoben, weil ohne Internet kein NTP (bricht Datalog-Timestamps); sinnvoll zusammen mit Hardware-RTC (PCF8563). Statische IP / DHCP-Konfiguration.
  - ~~**MQTT-Einstellungen**~~ ✓ — abgeschlossen 2026-08-19: eigene Seite `/settings/mqtt`. Speichern läuft über einen expliziten „Speichern & Neustart"-Button (Muster: `NetworkPage.tsx`s mDNS-Sektion) statt Auto-Save — die Verbindung wird ohnehin nur beim Boot aufgebaut, ein Reboot-Button ist ehrlicher als ein Hinweis-Banner. Zwei Modi: (a) **externer Broker** (Host/Port/Creds/TLS) über die bestehende `MqttTransport`/PubSubClient (jetzt mit Username/Password); (b) **embedded Broker** via `hsaturn/TinyMqtt` (nicht `uMQTTBroker` — läuft nicht auf ESP32), nur dessen Broker-Rolle, eigener Publish-Pfad bleibt einheitlich über `MqttTransport` auf `127.0.0.1`. TinyMqtts fehlende Auth-Konfigurierbarkeit über ein Build-Zeit-Patch-Skript geschlossen (kein Fork). Sensoren/Aktoren/Regler werden **live** nachgeführt (`RemotePublisher::detach()`, neu in der Library) statt nur beim Boot — Verbindungseinstellungen selbst bleiben boot-gebunden. Flash-Spike real gemessen: alle 3 Boards tragen den embedded Broker (+10 KB kombiniert), kein Board-Fallback nötig. Voraussetzung für den **Generischen MQTT-Aktor** (s.o.) bleibt erfüllt. Details: `SESSION.md` (Root, 2026-08-19).
- **Zugriffsschutz / Auth** — bewusst niedrig priorisiert (Heimnetz), nur als Vormerkung.

### Buckets (bei Gelegenheit)

- **UI-Polish — gruppierte SensorCard für Multi-Channel-Sensoren** (Details s. Bekannte Einschränkungen). ⚠️ Vor Gradienten/Ableitungen umsetzen.
- **Mobile Nutzung** (vorgemerkt 2026-08-12) — Dashboard wird typischerweise am Kessel/Handy bedient, nicht am Desktop. Nach dem WinUI-Redesign prüfen: Touch-Ziele, Breakpoints, Lesbarkeit der Cards/NavShell auf kleinen Screens.
- **Hardware-Verifikation** — IDS-Induktionskocher E2E-Test, SSR-Heizung unter Last mit Oszilloskop, **Gärsteuerung Dual-Output-Regler E2E am Gerät** (DualStage/SplitRangePID anlegen, beide Ausgänge live, Kompressor-Anti-Short-Cycle, Kühl-Aktor-Löschen-Block), **PID-AutoTune E2E am Gerät** (Status idle→running→done, übernommene Gains, Abbruch). SplitRangePID-AutoTune E2E am Gerät.

---

## Bekannte Einschränkungen / Offene Punkte

- Heizung (SSR) unter Last mit Oszilloskop verifizieren
- OTA-Firmware-Update ✓ (2026-06-04; HW-E2E auf LilyGo S3 verifiziert, CI grün, gemergt)
- QEMU/Simulation: nicht viable (kein WiFi-Emulation für ESP32)
- `RemotePublisher` Multi-Channel via MQTT/ESP-NOW ✓ (2026-05-29)
- IDS-Induktionskocher E2E-Test mit echter Hardware ausstehend
- **SD-Concurrency-Bug** ✓ — behoben 2026-08-20 (PR #16, `bcf8ea2`): `loopTask` und `async_tcp` griffen unsynchronisiert auf den nicht thread-sicheren SD/SdFat-Treiber zu (korrumpierte Treiberzustand, u.a. Ursache für den reproduzierbaren `POST /api/update/assets`-Fehlschlag). Fix: globaler rekursiver Mutex `SdLock.h`, granular um jede einzelne SD-Operation. HW-verifiziert: 5 Tar-Uploads hintereinander ohne Reset, alle erfolgreich (vorher spätestens beim zweiten Versuch kaputt). Details: `SESSION.md` (Root, 2026-08-19/20).
- **Frontend: gruppierte SensorCard für Multi-Channel-Sensoren** — HCSR04 und YF-S201 erzeugen je 2 separate Karten (`tank.distance` / `tank.derived`, `flow.rate` / `flow.volume`). Verbesserung: `app.tsx` gruppiert Snapshot-Einträge nach Base-ID, eine Karte pro logischem Sensor mit mehreren Kanal-Zeilen. Delete-Button und Zähler zeigen dann korrekt logische Sensoren statt Kanäle. Quick-Fix für korrektes Delete/Reset bereits angewendet (2026-05-30).

## Weiterentwicklung

Änderungen die **nur die Library** betreffen → `SensActCtrl/` (mit Unit-Tests)  
Änderungen die **nur die UI** betreffen → `BrewControl/` (Firmware oder Web)  
Änderungen die **beide Seiten** berühren → hier im Root-`SESSION.md` protokollieren
