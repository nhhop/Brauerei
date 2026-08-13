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
- **Aktor-Master-Schalter (2026-08-13):** `EnableGuardActuator`-Decorator (SensActCtrl) gibt Continuous-Aktoren (Slider) einen eigenständigen on/off-Status unabhängig vom Wert; merkt den zuletzt gesetzten Wert und stellt ihn beim Wiedereinschalten automatisch her. Automatisch für alle Continuous-Aktoren aktiv (kein Opt-in nötig); Binary/Discrete unverändert. ⏻-Button in `ActuatorCard`. HW-E2E auf LilyGo T-Display-S3-AMOLED grün (Restore-Verhalten direkt gegen das Gerät verifiziert).
- **Aktor-Intervallbetrieb (2026-08-14):** `IntervalActuator`-Decorator (SensActCtrl) taktet einen Aktor „an" für X von Y Sekunden, wiederholend; konfigurierbare Zeitbasis (Zykluslänge + Einheit s/min/h), Opt-in via `interval_on_sec`/`interval_period_sec`, gilt für alle Aktor-Arten (nicht nur Continuous). Komponiert mit dem Master-Schalter (Enable außen, Interval innen). Live editierbar auf der `ActuatorCard` (nur der An-Anteil; Zykluslänge/Einheit bleiben Modal-only) über einen neuen `interval`-Zweig am bestehenden `/api/actuators/:id`-Endpunkt. HW-E2E auf LilyGo T-Display-S3-AMOLED grün (Phasenwechsel + Live-Schedule-Änderung direkt gegen das Gerät verifiziert).
- Build-Footprint: ~11 KB gzipped (Web), ~14.5 % Flash / ~14.7 % RAM (lilygo_t_display_s3_amoled, 2026-05-30)
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
- **Generischer MQTT-Aktor**: Topic statt device id, vorgabe des messagebody als Template mit Platzhalter für on/off/value
→Ziel Sonoff oder andere Steckdosen ansteuern. Setzt die MQTT-Einstellungen unter Netzwerk voraus (s. Welle 3).
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
  - *Später (vorgemerkt 2026-08-12):* **MQTT-Einstellungen** auf `/settings/network` — Aktivieren/Deaktivieren + zwei Modi: (a) **externer Broker** (Host/Port/Creds/TLS, z.B. Home-Assistant-Mosquitto) — nutzt die bereits vorhandene `SensActCtrl`-`MQTT`-Transportklasse (`RemotePublisher`/`RemoteSensor`/`RemoteActuator`), die bisher nur code-seitig verdrahtet wird, nicht über Settings; (b) **Embedded Broker** direkt auf dem ESP32 (z.B. via `uMQTTBroker`-Library) für Setups ohne externe Infrastruktur. Voraussetzung/Zusammenspiel mit dem **Generischen MQTT-Aktor** (s.o., Welle 2) — beide brauchen dieselbe Broker-Verbindung.
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
- **Frontend: gruppierte SensorCard für Multi-Channel-Sensoren** — HCSR04 und YF-S201 erzeugen je 2 separate Karten (`tank.distance` / `tank.derived`, `flow.rate` / `flow.volume`). Verbesserung: `app.tsx` gruppiert Snapshot-Einträge nach Base-ID, eine Karte pro logischem Sensor mit mehreren Kanal-Zeilen. Delete-Button und Zähler zeigen dann korrekt logische Sensoren statt Kanäle. Quick-Fix für korrektes Delete/Reset bereits angewendet (2026-05-30).

## Weiterentwicklung

Änderungen die **nur die Library** betreffen → `SensActCtrl/` (mit Unit-Tests)  
Änderungen die **nur die UI** betreffen → `BrewControl/` (Firmware oder Web)  
Änderungen die **beide Seiten** berühren → hier im Root-`SESSION.md` protokollieren
