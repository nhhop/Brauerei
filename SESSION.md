# Brauerei Session-Log

Cross-Projekt-Log für Arbeiten, die beide Subprojekte betreffen.  
Projekt-spezifische Sessions: `SensActCtrl/session.md`, `BrewControl/SESSION.md`

---

## 2026-05-18 — Monorepo-Setup

**Ausgangslage:** BrewControl und SensActCtrl als zwei getrennte Ordner ohne gemeinsames git-Repo, je eigene CLAUDE.md/PLAN.md/SESSION.md.

**Ziel:** Einheitliche Entwicklungsumgebung (ein Repo, koordinierte Dokumentation), ohne Dateien zu verschieben.

**Durchgeführte Änderungen:**
- `git init` in `Brauerei/`
- `.gitignore` angelegt (`.pio/`, `node_modules/`, `web/dist/`, `.env.local`, `.claude/settings.local.json`)
- `.claude/settings.json` auf Root-Ebene (alle 6 Plugins, Superset aus beiden Sub-Projekten)
- `CLAUDE.md` auf Root-Ebene (gemeinsame Verhaltensrichtlinien + Monorepo-Überblick)
- `PLAN.md` auf Root-Ebene (Systemarchitektur-Überblick + Status)
- `SESSION.md` auf Root-Ebene (diese Datei)
- `SensActCtrl/CLAUDE.md` auf projekt-spezifische Infos gekürzt (Richtlinien → Root)
- `BrewControl/CLAUDE.md` auf projekt-spezifische Infos gekürzt (Richtlinien → Root)

**Kein Änderungsbedarf:** `BrewControl/firmware/platformio.ini` — `symlink://../../SensActCtrl` funktioniert bereits korrekt im Monorepo.

**Status nach Setup:** Beide Projekte vollständig im Repo, kompilier- und testbar wie zuvor.

---

## 2026-05-20 — Bus-Discovery-Feature (OneWire / DS18B20)

**Ausgangslage:** BrewControl unterstützte beim dynamischen Hinzufügen von DS18B20-
Sensoren nur Einzelsensor-Konfigurationen (nur Pin, keine ROM-Adresse). OneWire
erlaubt mehrere Sensoren auf einem Pin — diese sind ohne 64-bit-ROM-Adresse nicht
unterscheidbar.

**Änderungen in beiden Projekten:**

- `SensActCtrl/src/sensors/DS18B20Sensor.{h,cpp}`: neues `static scanBus(pin, out,
  maxDevices)` — enumeriert ROM-Adressen aller Geräte auf dem Bus.
- `BrewControl/firmware/src/DynamicItems.{h,cpp}`: Shared-Bus-Management
  (`onewireBuses_`), optionales `address`-Feld im DS18B20-Factory-Pfad,
  `parseHexAddress`-Helper.
- `BrewControl/firmware/src/WebUI.{h,cpp}`: neuer `GET /api/bus/scan?type=onewire&pin=N`.
- `BrewControl/web/src/`: `ScannedDevice`/`BusScanResult`-Types, `scanOneWireBus()`
  in `api.ts`, Scan-UI in `AddItemModal.tsx`.

**Wire-Format** des neuen Endpoints:
```json
GET /api/bus/scan?type=onewire&pin=4
→ {"type":"onewire","pin":4,"devices":[{"index":0,"address":"28ff64c8815604ef"},…]}
```

**Rückwärtskompatibel:** `POST /api/sensors {"type":"DS18B20","id":"x","pin":4}` ohne
`address`-Feld funktioniert weiterhin (Einzel-Bus-Modus).

Details: `BrewControl/SESSION.md`.

---

## 2026-05-20 — Playwright / Edge-Setup für Browser-UI-Tests

**Kontext:** Browser-UI-Test des Bus-Discovery-Features (AddItemModal + Delete-Button)
war nach dem Bus-Discovery-Feature als offen markiert. Erster Versuch in dieser Session.

**Problem:** Das Playwright-MCP-Plugin (`@playwright/mcp@latest`) ist per Default auf
`--browser chrome` konfiguriert und erwartet Chrome unter
`C:\Users\nhhop\AppData\Local\Google\Chrome\Application\chrome.exe`. Chrome ist auf
diesem System nicht installiert; Admin-Rechte für die System-Installation fehlen.

**Lösung (durchgeführt, wirksam nach Neustart):**

Beide `.mcp.json`-Dateien auf `--browser msedge` umgestellt — Edge ist unter
`C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe` installiert und von
Playwright direkt unterstützt:

- `C:\Users\nhhop\.claude\plugins\marketplaces\claude-plugins-official\external_plugins\playwright\.mcp.json`
- `C:\Users\nhhop\.claude\plugins\cache\claude-plugins-official\playwright\unknown\.mcp.json`

Geändert: `"args": ["@playwright/mcp@latest"]` → `"args": ["@playwright/mcp@latest", "--browser", "msedge"]`

**Wichtig:** Konfigurationsänderungen am MCP-Server werden erst nach einem Claude-Code-Neustart
wirksam. Ein Kill des laufenden Node-Prozesses während der Session trennt die Tools
dauerhaft für diese Session (kein Auto-Reconnect).

**Seiteneffekte bereinigt:**
- Temporäres `C:\Users\nhhop\AppData\Local\Google\Chrome\Application\chrome.exe`
  (Kopie von `msedge.exe`) wurde wieder gelöscht — war ein fehlgeschlagener Workaround.

**Browser-UI-Test durchgeführt (2026-05-20, nach Neustart):**

| Test | Resultat |
|---|---|
| Dashboard lädt mit ESP32-Daten (mash_temp stale, mash_pid, heater) | ✓ |
| AddItemModal öffnet per `+ Add Item` | ✓ |
| Sensor-Tab: OneWire-Pin-Input + Scan-Button (disabled ohne Pin) | ✓ |
| Scan-Button aktiv nach Pin-Eingabe, Scan-Request an ESP32 | ✓ |
| Scan liefert 0 Geräte (kein DS18B20 an GPIO 4) — kein Fehler | ✓ |
| Actuator-Tab: GPIO-Pin + Mode-Dropdown (TPO/SSR default) | ✓ |
| Controller-Tab: Sensor/Actuator-Dropdowns mit ESP32-Live-Items vorbelegt | ✓ |
| Cancel schließt AddItemModal | ✓ |
| `×`-Button auf Sensor-Card öffnet Delete-ConfirmModal mit korrektem Titel | ✓ |
| Cancel im Delete-Modal schließt ohne Löschen | ✓ |
| Backdrop-Click schließt Delete-Modal | ✓ |
| Console-Fehler: nur `favicon.ico 404` (harmlos) | ✓ |

**Befund (⚠ minor UX):** Nach einem Scan ohne Geräte zeigt das Sensor-Formular
denselben Hint-Text `"Scan to find devices on this bus."` wie vor dem Scan.
Kein visuelles Feedback ob der Scan überhaupt gelaufen ist und 0 Geräte gefunden
wurden vs. noch nicht gescannt. Nicht buggy, aber für Benutzer leicht verwirrend.

**Screenshots:** `.playwright-mcp/` — `01_dashboard.png`, `02_add_modal_sensor.png`,
`03_scan_no_devices.png`, `04_delete_confirm_modal.png`, `05_dashboard_final.png`

---

## 2026-05-21 — MAX31865 PT100/PT1000 Sensor + AddItemModal Redesign

**Ausgangslage:** BrewControl unterstützte nur DS18B20 (OneWire) als dynamisch
hinzufügbaren Temperatursensor. MAX31865 ist ein SPI-Chip für PT100/PT1000 RTD-Sensoren —
präziser und in der Brauerei für Hochtemperaturmessungen üblich.

**Änderungen in beiden Projekten:**

- `SensActCtrl/src/sensors/MAX31865Sensor.{h,cpp}`: neue Klasse `MAX31865Sensor`,
  implementiert `Sensor`-Interface. Liest synchron per SPI (~1 ms, kein State-Machine
  nötig). Hardware-SPI (nur CS-Pin) und Software-SPI (CS + CLK + MISO + MOSI)
  Konstruktoren. Enums `Wires` (Two/Three/Four) und `RtdType` (PT100/PT1000).
  `#ifndef ARDUINO`-Guard mit vollständigem Stub für native Builds.
- `SensActCtrl/test/test_max31865/test_max31865.cpp`: 3 Unity-Tests (meta, default
  reading, id). Gesamtzahl nativer Tests: 31 → 34.
- `SensActCtrl/library.json` + `library.properties`: `Adafruit MAX31865 library ^1.2.0`
  als neue Abhängigkeit eingetragen.
- `SensActCtrl/src/SensActCtrl.h`: `#include "sensors/MAX31865Sensor.h"` im
  Umbrella-Header ergänzt.
- `BrewControl/firmware/src/DynamicItems.cpp`: neuer Factory-Branch für `"MAX31865"` in
  `addSensorNoBegin()` — liest `cs`, `wires`, `rtd`, `rref`, optional `clk`/`miso`/`mosi`
  aus dem JSON-Config. Validierung: `cs >= 0`, `wires` 2–4, `rref > 0`, clk/miso/mosi
  vollständig wenn custom SPI. Alle 3 Boards (esp32dev, lolin_s2_mini,
  lilygo_t_display_s3_amoled) kompilieren.
- `BrewControl/web/src/components/AddItemModal.tsx`: vollständiges Redesign mit
  grupiertem `<optgroup>`-Dropdown für Sensortyp-Auswahl. DS18B20-Formular unverändert.
  Neues MAX31865-Formular: CS-Pin, Wires-Segment-Buttons, RTD-Segment-Buttons, Rref
  (auto-fill PT100↔PT1000, respektiert manuelle Änderungen via `rrefTouched`-Flag),
  aufklappbarer Custom-SPI-Bereich (CLK/MISO/MOSI).

**Wire-Format** für neuen Sensortyp:
```json
POST /api/sensors
{ "type":"MAX31865","id":"boil_temp","cs":5,"wires":3,"rtd":"PT100","rref":430.0 }
// mit custom SPI:
{ "type":"MAX31865","id":"boil_temp","cs":5,"clk":14,"miso":12,"mosi":13,"wires":3,"rtd":"PT100","rref":430.0 }
```

**Rückwärtskompatibel:** DS18B20-Pfad in DynamicItems und AddItemModal unverändert.

**Adafruit SW-SPI Konstruktor-Reihenfolge:** `(cs, mosi, miso, clk)` — nicht
`(cs, clk, miso, mosi)`. Wurde im Code-Review verifiziert gegen die Adafruit-Header.

**Design-Entscheidungen:**
- Synchroner SPI-Read in `tick()` (~1 ms) — kein State-Machine nötig (anders als DS18B20)
- Rref default: 430 Ω für PT100, 4300 Ω für PT1000 (entspricht Standard-Breakout-Boards)
- Forward-Deklaration `class Adafruit_MAX31865;` im Header verhindert Adafruit-Header-Pull
  in den Umbrella-Include

Details: Spec `docs/superpowers/specs/2026-05-21-max31865-sensor-design.md`,
Plan `docs/superpowers/plans/2026-05-21-max31865-sensor.md`.

**Bugfix (nach Merge):** `useEffect`-Dependency in `AddItemModal.tsx` war durch Code-Review
fälschlicherweise auf `[open, snap]` geändert worden. `snap` ändert sich bei jedem
SSE-Event vom ESP32 — das resettet das komplette Formular (inkl. `sensorType` zurück zu
'DS18B20') solange das Modal offen ist. Revert auf `[open]`. Die Controller-Dropdown-
Optionen werden ohnehin live aus `snap` im JSX gerendert; nur der initiale Selektionswert
(`sensorId`/`actuatorId`) wird beim Öffnen gesetzt — das ist korrekt. (commit `c5ba31c`)

---

## 2026-05-21/22 — Multi-Channel Sensor Interface + YF-S201

**Ausgangslage:** Das `Sensor`-Interface lieferte genau einen `float`-Wert pro Instanz.
Sensoren wie der YF-S201 (Durchfluss + Gesamtvolumen) konnten nicht sauber abgebildet werden.

**Architektur-Änderung:**
- Neues `Channel`-Struct (`key`, `SensorMeta`, `Reading`) in `SensActCtrl/src/core/Channel.h`
- `Sensor`-Interface: `meta()` + `lastReading()` → `channelCount()` + `channel(size_t idx)` (Breaking Change)
- `RegistrySnapshot`: Single-Loop → Doppel-Loop mit Composite-ID (`"flow.rate"`, `"flow.volume"`)
- `BME280Sensor::Channel`-Enum → `BME280Sensor::Measurement` (Konflikt mit neuem `SensActCtrl::Channel`-Struct)

**Neue Klasse `YF_S201Sensor`:**
- 2 Kanäle: `"rate"` (FlowRate, L/min, Continuous) + `"volume"` (Volume, L, Cumulative)
- Kalibrierung: `kHzPerLiterPerMin = 7.5f` → 450 Impulse/Liter
- ISR-Sharing: statischer Pin-Pool (`PinState[4]`) — mehrere Instanzen auf demselben Pin teilen einen ISR-Zähler
- `resetVolume()`: setzt `volumeBaseCount_` auf aktuellen Zählerstand
- Native-Build-Guard: `millis()`-Stub mit Zeitfortschritt (+1000ms/Aufruf) damit Rate-Window in Tests feuert

**Firmware (BrewControl):**
- `DynamicItems`: `SensorEntry` erhält `std::function<void()> resetFn`, neuer `resetSensor()`-Endpunkt
- `WebUI`: `POST /api/sensors/:id/reset` (extrahiert Sensor-ID zwischen Prefix und `/reset`-Suffix)
- `POST /api/sensors { "type":"YF-S201", "id":"flow", "pin":4 }` optional `calibration`-Feld

**Web-Frontend:**
- `api.ts`: `resetFlowVolume(id)` → `POST /api/sensors/:id/reset`
- `AddItemModal.tsx`: `SensorType` um `'YF-S201'` erweitert, neues Formular (Pin + Infotext zu dual channels)

**Tests:** 34 → 41 native Tests grün (6 neue YF_S201-Tests inkl. Rate-Kalibrierung + Snapshot-Expansion)

**Nebenfixes:**
- Alle 13 Beispiel-Sketches auf neue `channel()`-API migriert
- `SensActCtrl/src/core/Sensor.h`: `#include <stddef.h>` ergänzt (latenter `size_t`-Fehler auf ESP32-Targets)
- `gcc`-Pfad für native Tests auf diesem System: `C:\Users\nhhop\.platformio\mingw64\bin`

**Offene Punkte (Folge-Sessions):**
- `RemotePublisher` publiziert nur `channel(0)` — Multi-Channel via MQTT/ESP-NOW nicht abgedeckt
- `examples/05_flow_meter` noch auf `PulseCounterSensor` — Folge-Beispiel mit `YF_S201Sensor` fehlt

Commits: `b8f76f0` → `7ca6bb2` (10 Commits, gepusht auf `origin/main`)

---

## 2026-05-22/23 — IDS Induktionskocher als Aktor

**Ausgangslage:** BrewControl unterstützte als dynamischen Aktor nur `DigitalOutput` (GPIO
on/off / TPO). IDS-Induktionskochfelder werden über ein proprietäres Infrarot-ähnliches
Protokoll (Timing-Bits via GPIO) angesteuert — eine bestehende Arduino-Library
`IdsInductionCooker` (Repo `C:\Users\nhhop\repos\IdsInductionCooker`) existiert, war aber
ESP8266-only und hatte keine öffentlichen Fehler-Getter.

**Änderungen in beiden Projekten:**

### IdsInductionCooker Library (separates Repo, Commit `bf5be40`)
- ISR-Attribut: `ICACHE_RAM_ATTR` → `#ifdef ESP8266 ICACHE_RAM_ATTR #else IRAM_ATTR #endif`
- Constructor-Body aktiviert (Zuweisung `IDS_TYPE`, `PIN_WHITE`, `PIN_YELLOW`, `PIN_INTERRUPT`)
- Pin-Defaults korrigiert: `14/12/13` (NodeMCU D5/D6/D7, tatsächliche GPIO-Nummern)
- `Serial.*`-Debug-Ausgaben entfernt
- Neue Public-Getter: `int getErrorCode() const` + `const String& getError() const`

### SensActCtrl (Commits `87effa2` → `7b31f94`)
- `Sensor.h` + `Actuator.h`: nicht-brechende Default-Methode `virtual const char* fault() const { return nullptr; }`
- `RegistrySnapshot.cpp`: emittiert `"fault"` im JSON nur wenn `fault() != nullptr`
- `test/mocks/MockSensor.h` + `MockActuator.h`: `faultMsg`-Feld + `fault()`-Override
- `test/test_snapshot/`: 2 neue Tests (`fault_absent_when_null`, `fault_present_when_set`)
- Neue Klasse `IdsActuator` (`.h` + `.cpp`):
  - Wraps `std::unique_ptr<IdsCooker>` (Singleton-Problem mit value-Member gelöst)
  - `write(float v)`: 0.0–1.0, quantisiert auf gültige IDS-Stufen
  - `tick()`: ruft `cooker_->Update(power_)` max. 2×/s auf (500 ms Rate-Limit)
  - `fault()`: gibt `getError().c_str()` zurück wenn `getErrorCode() != 0`
  - `#ifdef ARDUINO`-Guard: unsichtbar für native Builds (kein Arduino.h-Pullback)
- `SensActCtrl.h`: `#include "actuators/IdsActuator.h"` unter `#ifdef ARDUINO`

**Neue Sensortypen:** keine. Neue Aktoren: `IdsActuator` (IDS1 = 10 Stufen, IDS2 = 5 Stufen).

**Wire-Format** für neuen Aktor:
```json
POST /api/actuators
{ "type":"IDS1", "id":"cooker", "pin_white":14, "pin_yellow":12, "pin_interrupt":13 }
```

### BrewControl Firmware (Commit `2df3eaa`)
- `platformio.ini`: `symlink://../../../IdsInductionCooker` als zusätzliche lib_dep im `[common]`-Block
- `DynamicItems.h`: `#include <actuators/IdsActuator.h>` unter `#ifdef ARDUINO`
- `DynamicItems.cpp`: neuer Factory-Branch `"IDS1"` / `"IDS2"` in `addActuatorNoBegin()` — liest `pin_white`, `pin_yellow`, `pin_interrupt` (Default -1, Fehler wenn fehlend)

### BrewControl Web-Frontend (Commits `9d0125c`, `69521a3`)
- `types.ts`: `fault?: string` auf `Sensor`- und `Actuator`-Interface
- `SensorCard.tsx` + `ActuatorCard.tsx`: gelbes Warning-Badge wenn `fault` gesetzt
- `AddItemModal.tsx`:
  - `ActuatorType = 'DigitalOutput' | 'IDS1' | 'IDS2'`
  - Actuator-Type-Dropdown (statt bisheriger direkter GPIO-Eingabe)
  - IDS-Formular: 3 Pin-Felder (`White/Relais`, `Yellow/Cmd`, `Interrupt`) mit Defaults 14/12/13

**Tests:** 41 → 43 native Tests grün.

**Design-Entscheidungen:**
- `std::unique_ptr<IdsCooker>` statt Value-Member: `IdsCooker::staticInduction`-Singleton wird bei Move/Copy nicht ungültig
- `#ifdef ARDUINO`-Guard um IdsActuator: native Tests bleiben ohne Arduino.h-Dependency kompilierbar
- `fault()` gibt `nullptr` zurück (statt leeren String) damit `RegistrySnapshot` das Feld korrekt weglässt
- Pin-Defaults 14/12/13 (D5/D6/D7 NodeMCU) statt 5/6/7 aus originaler Library

**Offene Punkte:**
- E2E-Test mit echtem IDS-Induktionskochfeld ausstehend
- Nur `tick()` aufgerufen, wenn `millis() >= nextTickMs_` — bei blockierendem `sendCommand()` (~246 ms) kann das bei sehr schnellen Loops zweimal pro Sekunde auftreten (bewusste Akzeptanz)

Commits: `bf5be40` (IdsInductionCooker), `87effa2` → `69521a3` (Brauerei, 6 Commits)

---

## 2026-05-29 — RemotePublisher Multi-Channel + konfigurierbares Topic-Prefix

**Ausgangslage:** `RemotePublisher` publizierte für alle Sensoren nur `channel(0)` hardcoded.
Sensoren mit mehreren Kanälen (BME280: temp/hum/pres, YF_S201: rate/volume) wurden damit
unvollständig über MQTT/ESP-NOW veröffentlicht. `RemoteSensor` konnte nur einen einzigen
Kanal (Flat-Topic) abonnieren.

**Änderungen in SensActCtrl (6 Commits, `2a1acab` → `f1a247e`):**

### Topics.h
- Optionaler `prefix`-Parameter (Default `"sensactctrl"`) auf `base()` und allen bestehenden
  Helpers (`sensorState/Meta`, `actuatorState/Meta/Set`, `controllerMeta/Tune`)
- Zwei neue Helpers: `sensorChannelState(d, id, key, prefix)` und
  `sensorChannelMeta(d, id, key, prefix)` → Schema: `<prefix>/<device>/sensor/<id>/<key>`

### RemotePublisher
- `SensorEntry` erhält Feld `size_t channelIdx`
- `attach(Sensor&)` iteriert jetzt alle Kanäle (`channelCount()`), erstellt einen `SensorEntry`
  pro Kanal. Backward-Compat-Regel: `channelCount()==1 && key[0]=='\0'` → Flat-Topic (alte
  Sensor-Typen unverändert); sonst per-Channel-Topic
- `publishSensorMeta/State` nutzen `channel(channelIdx)` statt `channel(0)`
- Neue Methode `setPrefix(const char*)` — muss vor `attach()` aufgerufen werden; `assert()`
  fängt falsche Reihenfolge

### RemoteSensor
- Optionaler 4th Constructor-Parameter `const char* channelKey = ""` (bestehende 3-Arg-Calls
  unverändert)
- Neue Methode `setPrefix(const char*)` — muss vor `begin()` aufgerufen werden
- Topic-Aufbau aus Konstruktor in `begin()` verschoben; routed auf Flat- oder Channel-Topic
  je nach `channelKey_`

**Consumer-Usage (Beispiel):**
```cpp
RemotePublisher pub(t, "brew");
pub.setPrefix("home/brewery");   // optional
pub.attach(bme280);              // → home/brewery/brew/sensor/ambient/temp|hum|pres
pub.begin();

RemoteSensor ambTemp(t, "brew", "ambient", "temp");
ambTemp.setPrefix("home/brewery");
ambTemp.begin();
```

**Tests:** 43 → 48 native Tests grün. Neue Tests:
- `test_multichannel_both_channels_published`
- `test_multichannel_channel_values_correct`
- `test_single_channel_flat_topic_unchanged`
- `test_multichannel_remote_sensor_subscribes_channel`
- `test_custom_prefix_roundtrip`

**Nebenfixes (pre-existing, gefunden beim ESP32-Compile-Check):**
- `SensActCtrl/src/core/Reading.h`: expliziter `Reading(float, uint32_t, bool)`-Konstruktor
  ergänzt — GCC 8.4 (ESP32, C++11) lehnte Brace-Init bei Struct mit Default-Member-Initializern ab
- `SensActCtrl/library.json`: `IdsInductionCooker` als Git-Dep eingetragen (war bisher nur via
  BrewControl-Symlink verfügbar, fehlte für Standalone-`pio ci`-Builds)

**Dokumentation aktualisiert:**
- `PLAN.md` (Root): `RemotePublisher Multi-Channel`-Eintrag als erledigt markiert,
  `examples/05_flow_meter`-Punkt gestrichen (war bereits mit `YF_S201Sensor` implementiert)

Commits: `2a1acab` → `f1a247e` (6 Commits, lokal auf `main`, noch nicht gepusht)
