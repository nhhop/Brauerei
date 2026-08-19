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

---

## 2026-05-30 — AnalogOutputActuator + HX711LoadCellSensor + Roadmap

**Ausgangslage:** SensActCtrl hatte keine Analogaktor-Klasse (PWM/DAC) und keinen Wägezellen-Sensor. BrewControl zeigte für Multi-Channel-Sensoren (HCSR04, YF-S201) zwei separate Delete/Reset-Buttons statt eines Buttons pro logischem Sensor.

### Quick-Fix Multi-Channel-Delete (BrewControl Frontend)

`BrewControl/web/src/app.tsx`: `sensorId`-Extraktion vor Basis-ID (Split am ersten `.`) — `onDelete`/`onReset` senden nun immer die Base-ID (`"tank"` statt `"tank.distance"`). Dokumentiert in PLAN.md als "Bekannte Einschränkungen" (gruppierte SensorCard als zukünftige Verbesserung).

### Part A — AnalogOutputActuator (SensActCtrl + BrewControl)

**Neue Dateien:**
- `SensActCtrl/src/actuators/AnalogOutputActuator.h` + `.cpp`
- `SensActCtrl/test/test_analog_output/test_analog_output.cpp` (14 Tests)

**Design-Abweichung vom Plan:** Statt separatem `setCalibration()` + `setMeta()` ein einziges `setRange(Quantity, unit, min, max, resolution)` — setzt Advertise-Meta und value→duty-Mapping-Range gemeinsam (vermeidet Dual-Range-Footgun, Simplicity First).

**Key-Details:**
- `enum class Mode : uint8_t { Pwm, Dac }` — DAC-Modus fixiert rawMax auf 255 (GPIO25/26), PWM nutzt LEDC (8-16 bit einstellbar, default 12 bit / 5 kHz)
- `static uint8_t nextChannel_` — simpels LEDC-Kanal-Pool (analogie HCSR04 ISR-Slot); langfristig in Pin-Manager
- `unit_[16]`-Buffer mit `strncpy` — DynamicItems übergibt cfg-backed `const char*`, kein Dangling
- `public valueToRaw(float) const` für native Tests (Spiegel von `AnalogInputSensor::rawToValue`)
- LEDC-API Core 2.x (`ledcSetup` / `ledcAttachPin` / `ledcWrite`) — espressif32 6.3.2 verifiziert
- Native-Stubs für `ledcSetup` / `ledcAttachPin` / `ledcWrite` / `dacWrite`

**Integration:**
- `SensActCtrl/src/SensActCtrl.h`: Include nach PulseOutputActuator
- `DynamicItems.cpp`: `"AnalogOutput"`-Branch liest `pin`, `mode` ("pwm"/"dac"), optional `freq`, `resolution_bits`, `value_min`/`value_max`/`unit` → `setRange(Quantity::Custom, ...)` wenn Range-Keys vorhanden
- `AddItemModal.tsx`: `'AnalogOutput'` in `ActuatorType`, PWM/DAC-Toggle, optionaler Custom-Range-Bereich (Min/Max/Unit)

### Part B — HX711LoadCellSensor (SensActCtrl + BrewControl)

**Neue Dateien:**
- `SensActCtrl/src/sensors/HX711LoadCellSensor.h` + `.cpp`
- `SensActCtrl/test/test_hx711/test_hx711.cpp` (10 Tests)

**Key-Details:**
- Eigener Bit-Bang-Treiber (kein externer Library-Dep), Gain 128 (25 SCK-Pulse)
- Non-blocking `tick()`: ARDUINO-Pfad liest nur wenn `digitalRead(dout)==LOW`; nativer Pfad via `injectRawForTest`
- `rawToMass(int32_t raw)` public für Tests: `(raw - offset_) * scale_`
- `tare()` setzt `offset_ = lastRaw_`
- `Quantity::Mass` bereits vorhanden (kein Enum-Change)
- `injectRawForTest(int32_t)` + natives `g_millis_hx711` im `#ifndef ARDUINO`-Block

**Integration:**
- `SensActCtrl/src/SensActCtrl.h`: Include nach HCSR04Sensor
- `DynamicItems.cpp`: `"HX711"`-Branch mit `dout`/`sck`/optional `scale`; `e->resetFn = [rawPtr]{ rawPtr->tare(); }` → `POST /api/sensors/:id/reset` löst Tare aus
- `AddItemModal.tsx`: `'HX711'` in `SensorType`, Felder für DOUT/SCK/Scale

**Hinweis:** Tare-Button im Frontend noch nicht sichtbar (nur API-Aufruf, `meta.kind` ist Continuous, nicht Cumulative). Folge-Aufgabe wenn UI-Ansicht benötigt.

### Roadmap in PLAN.md

Drei Roadmap-Einträge aufgenommen:
1. **Peripherie-Abstraktion** — `Peripheral`-Interface + Auto-Registry für OneWire/I2C/SPI/CAN-Busse (verallgemeinert `getOrCreateBus`)
2. **Pin-Manager** — Board-Capability-Map + `GET /api/pins` (auf Peripherie aufbauend)
3. **Interaktives LVGL-Display** — Snapshot-Consumer + Touch-Command-Quelle (LilyGo T-Display-S3-AMOLED)

### Verifikation

| Check | Resultat |
|---|---|
| `pio test -e native` (SensActCtrl) | 80/80 PASSED (56 alt + 14 neu AnalogOutput + 10 neu HX711) |
| `pnpm typecheck` (BrewControl/web) | Keine TypeScript-Fehler |
| `pio run -e esp32dev` (BrewControl/firmware) | SUCCESS, 77.3 % Flash |

---

## 2026-05-30 — DS18B20 Praxistest + Scan-Konflikt-Fix + DAC-Guard

**Ausgangslage:** DS18B20-Live-Reads waren als "ausstehend" markiert. Beim Praxistest wurden zwei Bugs gefunden: Bus-Scan lieferte Fehler auf Pins mit aktiver DynamicItems-OneWire-Instanz; `AnalogOutputActuator` verlinkte `dacWrite` auf ESP32-S3 nicht.

### DS18B20 Praxistest (LilyGo T-Display-S3-AMOLED, 192.168.178.87)

Sensor `hlt` — GPIO 21, ROM `28ff19c6a11605d3` — war bereits auf dem Gerät persistiert und lieferte ~26–28 °C live (ok=true). Sensor `mash_temp` — GPIO 1 (Demo, kein Hardware-Sensor) — lieferte korrekt -127 °C (ok=false). Nach Umstecken auf GPIO 1: `mash_temp` = 24–25 °C ok=true, `hlt` = -127 ok=false (ROM nicht gefunden). Beide Modi (Skip-ROM und ROM-Adresse) **bestätigt**.

### Fix A — OneWire-Scan-Konflikt (`/api/bus/scan`)

**Problem:** `WebUI.cpp` rief `DS18B20Sensor::scanBus(pin, ...)` auf, das intern eine neue `OneWire(pin)`-Instanz anlegt. Wenn `DynamicItems` bereits eine aktive `OneWire` auf demselben Pin hält, laufen zwei Software-OneWire-Treiber gleichzeitig auf derselben GPIO → HTTP-Fehler / falsche Reads.

**Fix (3 Dateien):**
- `DS18B20Sensor`: neue `static scanBus(OneWire& bus, ...)` Überladung; pin-Variante delegiert dorthin (DRY)
- `DynamicItems`: öffentliche `scanOneWireBus(pin, ...)` — sucht in `onewireBuses_` nach vorhandenem Bus für den Pin, nutzt ihn; sonst temporäre Instanz (kein Konflikt)
- `WebUI.cpp`: Lambda `[]` → `[this]`, Aufruf auf `items_.scanOneWireBus(pin, addrs, 8)`

**Verifikation:** Scan auf GPIO 21 (leer) → `{"devices":[]}` ✅; Scan auf GPIO 1 (Sensor drauf) → `{"address":"28ff19c6a11605d3"}` ✅; `mash_temp` liest danach weiterhin korrekt ✅.

### Fix B — `AnalogOutputActuator` DAC auf ESP32-S3

**Problem:** `dacWrite()` ist nur im Original-ESP32-Arduino-Core vorhanden (GPIO 25/26 DAC). ESP32-S2 und S3 haben kein DAC-Peripheral → Linker-Fehler beim `lilygo_t_display_s3_amoled`-Target.

**Fix:** Compile-Zeit-Define `SENSACTCTRL_HAS_DAC` — gesetzt wenn `CONFIG_IDF_TARGET_ESP32` (Original-ESP32) oder native Build (Stubs). Auf S2/S3: `begin()` stuft `Mode::Dac` auf `Mode::Pwm` herunter; `dacWrite`-Aufruf in `write()` ist wegkompiliert.

### Verifikation (gesamt)

| Check | Resultat |
|---|---|
| `pio test -e native` (SensActCtrl) | 80/80 PASSED |
| `pio run -e esp32dev` | SUCCESS, 77.3 % Flash |
| `pio run -e lilygo_t_display_s3_amoled` | SUCCESS (war vorher FAILED wegen dacWrite) |
| Flash + Scan GPIO 21 (leer) | `{"devices":[]}` — kein Fehler mehr |
| Flash + Scan GPIO 1 (Sensor drauf) | ROM-Adresse gefunden, Sensor liest weiterhin korrekt |

---

## 2026-05-30 — UI-Verbesserungen: Edit, ControllerCard, TwoPoint, Enable/Disable, Demo-Items

**Ausgangslage:** BrewControl hatte kein Edit-Interface (nur Add/Delete), ControllerCard zeigte nur ein JSON-Params-Textarea, kein Zweipunkt-Regler und drei hardcodierte Demo-Items in `main.cpp`.

### 1 — Bearbeitungsfunktion (Edit via Delete + POST)

**Ansatz:** Registry besitzt keine Update-Methode — Edit = DELETE altes Item + POST neue Config.

- `DynamicItems.cpp`: neue Methode `serializeConfig()` — liefert `{"sensors":[...],"actuators":[...],"controllers":[...]}` als JSON aus den gespeicherten `cfgJson`-Strings aller Items
- `DynamicItems.h`: Deklaration `String serializeConfig() const`
- `WebUI.cpp`: neuer Handler `GET /api/config` vor Static-Serve registriert
- `api.ts`: neue Funktion `getConfig(): Promise<ConfigSnapshot>`
- `types.ts`: Interface `ItemConfig = Record<string, unknown>`, `ConfigSnapshot`
- `app.tsx`: State `editItem: { role: Role; cfg: ItemConfig } | null`, Funktion `startEdit(role, id)` — ruft `getConfig()` auf, extrahiert cfgJson, setzt `editItem`
- `AddItemModal.tsx`: Props `editConfig?`, `editRole?`; `isEdit`-Flag; Felder vorbelegt aus cfgJson; Typ-/Rolle-Selector in Edit-Modus deaktiviert; Submit-Logik: DELETE → POST; Button-Labels Deutsch ("Erstellen"/"Speichern"/"Abbrechen")
- `SensorCard.tsx`, `ActuatorCard.tsx`: `onEdit?`-Prop + ✎-Schaltfläche

### 2 — ControllerCard: Ist-Wert, Ausgang, kein params-Textarea

- `ControllerCard.tsx` komplett neu: empfängt `sensors: Sensor[]` + `actuators: Actuator[]`
- Sensor-ID aus `params?.sensor` → live `linkedSensor.state.v` anzeigen (Ist-Wert)
- Aktor-ID aus `params?.actuator` → live `linkedActuator.state.v` formatiert anzeigen (Ausgang)
- params-JSON-Textarea entfernt
- `app.tsx`: `ControllerCard` erhält `sensors={snap.sensors}` + `actuators={snap.actuators}`

### 3 — Zweipunkt-Regler (TwoPoint)

**Library:** `TwoPointController` war bereits implementiert; `paramsJson()` um `sensor`/`actuator`/`enabled` erweitert; `setParamsJson()` liest `enabled`; `tick()` Guard `if (!enabled()) return`

**Firmware:** `DynamicItems.cpp` — neuer Branch `"TwoPoint"` in `addControllerNoBegin()`: liest `sensor`, `actuator`, `hyst_low`, `hyst_high`, `inverted`, `setpoint`

**Frontend:** `AddItemModal.tsx` — Controller-Typ-Buttons (PID / Zweipunkt), Felder `hystLow`, `hystHigh`, `inverted`-Checkbox

### 4 — Controller Enable/Disable

- `SensActCtrl/src/core/Controller.h`: `setEnabled(bool)` + `enabled()` mit `private bool enabled_ = true`
- `PIDController.cpp` + `TwoPointController.cpp`: Guard `if (!enabled()) return;` am Tick-Anfang; `enabled`-Key in `paramsJson()` + `setParamsJson()` (incl. `extractBool`-Helper in PID)
- `RegistrySnapshot.cpp`: `obj["enabled"] = c->enabled()` je Controller; `paramsBuf` 256 → 512 Bytes
- `api.ts`: `enableController(id, enabled)` — nutzt bestehenden `POST /api/controllers/:id/params`
- `ControllerCard.tsx`: ⏻-Button (grün=aktiv, grau=inaktiv), `opacity-60` wenn disabled

### 5 — Hardcodierte Demo-Items entfernt

- `main.cpp`: globale Objekte `DS18B20Sensor mashTemp`, `DigitalOutputActuator heater`, `PIDController pid` und alle zugehörigen Konstanten + setup()-Aufrufe entfernt
- Registry startet leer; `dynamicItems.loadFromSD(SD, registry)` füllt sie aus SD-Persistenz

### Verifikation

| Check | Resultat |
|---|---|
| `pio test -e native` (SensActCtrl) | 80/80 PASSED |
| `pnpm typecheck` (BrewControl/web) | 0 Fehler |
| `pio run -e lilygo_t_display_s3_amoled` | SUCCESS, RAM 14.7 %, Flash 14.5 % |

---

## 2026-05-30 — WebUI Handler-Reihenfolge: Aktor-Write-Bug

**Problem:** `POST /api/actuators/:id` (Aktor-Write aus dem UI, z.B. Relais-Toggle) lieferte `400 missing id`. Ursache: `AsyncCallbackJsonWebHandler("/api/actuators")` matcht intern via `startsWith("/api/actuators/")` und greift dadurch auf Sub-Pfade wie `/api/actuators/heater` zu — bevor der korrekte `BodyPrefixHandler` in der Handler-Liste erreicht wird.

**Fix:** `BrewControl/firmware/src/WebUI.cpp` — Registrierungsreihenfolge umgestellt:
- Delete- und BodyPrefixHandler (Write/Reset/Setpoint) **vor** den `AsyncCallbackJsonWebHandlers` registriert
- Mit Trailing-Slash greift `startsWith("/api/actuators/")` nicht für das reine `/api/actuators` (Create) → saubere Abgrenzung

**Commit:** `2202ff7`

**Verifikation:** Relais auf GPIO 2 toggle ✅

---

## 2026-05-31 — Multi-Dashboard-Feature mit SD-Persistenz

**Ausgangslage:** Die Browser-UI zeigte immer alle Sensoren/Aktoren/Regler in einer einzigen Ansicht. Für Brauabläufe (Maischen, Kochen, Gären) ist eine gefilterte Teilansicht pro Prozessschritt sinnvoll.

**Design-Entscheidung:** SD-Persistenz unter `/config/dashboards.json` (spiegelt `registry.json`-Muster); IDs per `random(0x1000000)` (Arduino-`random()` nutzt intern `esp_random()`). Sensoren speichern Base-IDs (Multi-Channel-Sensoren wie `"distance.raw"` / `"distance.cm"` teilen eine Base-ID `"distance"`).

### Backend (5 Dateien)

- **`DashboardStore.h/cpp`** (neu): CRUD-Klasse mit `DashboardCfg`-Struct (`id`, `name`, `sensors`, `actuators`, `controllers` als `std::vector<std::string>`). Methoden: `loadFromSD`, `saveToSD`, `serialize` (via ArduinoJson — korrekte JSON-Escaping), `add` (gibt generierte ID zurück), `update`, `remove`.
- **`WebUI.h/cpp`** (erweitert): Constructor nimmt `DashboardStore&`; 4 neue Routen:
  - `GET /api/dashboards` → `store_.serialize()`
  - `POST /api/dashboards` → `add()`, Response `201 {"id":"..."}`
  - `POST /api/dashboards/:id` → `update()` via `BodyPrefixHandler`
  - `DELETE /api/dashboards/:id` → `remove()` via `DeletePrefixHandler`
  - Handler-Reihenfolge: Delete + BodyPrefix vor `AsyncCallbackJsonWebHandler` (bewährtes Muster)
- **`main.cpp`** (erweitert): `BrewControl::DashboardStore dashboardStore` als Global; `dashboardStore.loadFromSD(SD)` im `if(sdOk)`-Block.

### Frontend (5 Dateien)

- **`types.ts`**: neues Interface `DashboardConfig` (`id`, `name`, `sensors[]`, `actuators[]`, `controllers[]`)
- **`api.ts`**: 4 neue Funktionen (`getDashboards`, `createDashboard`, `updateDashboard`, `deleteDashboard`)
- **`DashboardEditorModal.tsx`** (neu): Modal mit Name-Input + Checkbox-Listen pro Kategorie; Sensoren dedupliziert nach Base-ID; `useEffect` resettet auf `open`-Change; Button-Labels "Erstellen"/"Speichern"
- **`app.tsx`** (überarbeitet):
  - `type Tab = { kind: 'all' } | { kind: 'dashboard'; id: string }`
  - `filterSnap(snap, dash)`: filtert Sensoren per Base-ID-Mapping (`s.id.split('.')[0]`), Aktoren/Regler per exakter ID
  - Tab-Bar: "Alle" + Custom-Tabs (✎/×-Buttons) + "+ Neu"
  - `TabBtn` als `<div role="button">` (kein `<button>`) — erlaubt `<button>`-Elemente für Edit/Delete-Aktionen innen
  - `displaySnap = activeDash ? filterSnap(snap, activeDash) : snap` — ungefilterter `snap` weiterhin an `AddItemModal` + `DashboardEditorModal`

### Settings-Tab (gleiche Session)

`+ Hinzufügen` aus dem globalen Header entfernt und in einen neuen `⚙`-Tab (ganz rechts in der Tab-Bar) verschoben. Dashboard-Tabs sind damit reine Monitoring-Ansichten.

**`app.tsx`:**
- `Tab`-Typ um `{ kind: 'settings' }` erweitert
- Header: nur noch `Reset WiFi`-Button
- Tab-Bar: `⚙`-Tab mit `flex-1`-Spacer rechts positioniert
- Settings-Inhalt: `+ Hinzufügen`-Button über dem Grid, nur wenn `activeTab.kind === 'settings'`

**`AddItemModal.tsx`:** Optionaler `onCreated?: (role, id) => void`-Callback — wird nach jedem erfolgreichen Create aufgerufen (non-edit only).

**`DashboardEditorModal.tsx`:** Embeds `AddItemModal` als Sub-Modal (`z-50`, erscheint über dem Editor-Dialog). `+ Neues Gerät erstellen`-Link unter den Checkbox-Sektionen. `onCreated`-Callback hakt das neue Gerät automatisch an; SSE-Snapshot bringt es in die Checkbox-Liste.

**Hinweis:** HX711 Tare-Button war bereits implementiert via `s.meta.quantity === 'Mass'`-Bedingung in `app.tsx` — war fälschlicherweise noch als offen notiert.

### Verifikation

| Check | Resultat |
|---|---|
| `pnpm typecheck` (BrewControl/web) | 0 Fehler |
| Firmware-Compile-Smoke-Test | ausstehend |

---

## 2026-06-01 — Appearance-Settings: Design/Theme-Feature

**Ausgangslage:** BrewControl hatte kein Theme-System — alle Komponenten nutzten hardcodierte Tailwind-Klassen (`stone-*`, `bg-white`, `bg-stone-900`). Kein Dark-Mode, keine Akzentfarben, keine Settings-Infrastruktur für spätere Bereiche (Zeit, Backup, OTA).

**Scope:** Firmware-Persistenz + REST-API + CSS-Token-System + Theme-Logik + neue Settings-Navigationsstruktur + Refactor aller Komponenten.

### Backend (Firmware)

- **`SettingsStore.h/cpp`** (neu): hält `mode_`/`accent_`/`background_`-Felder mit Defaults (`"system"`, `"#d97706"`, `"neutral"`). Methoden `loadFromSD`, `saveToSD`, `serialize()`, `update(patch)` — `update()` merged Teilpatches, unbekannte Felder bleiben unberührt. Persistenz unter `/config/settings.json` (analog `DashboardStore`).
- **`WebUI.h/cpp`**: Constructor um `SettingsStore&`-Parameter erweitert; zwei neue Routen:
  - `GET /api/settings` → `settings_.serialize()` (200 application/json)
  - `POST /api/settings` via `AsyncCallbackJsonWebHandler` — Enum-Validierung für `mode` (light/dark/system) und `background` (neutral/warm/cool) sowie Hex-Format-Check für `accent` (`strlen==7 && a[0]=='#'`); `update()` + `saveToSD()` + 204; ungültige Werte → 400.
- **`main.cpp`**: `BrewControl::SettingsStore settingsStore` global; `settingsStore.loadFromSD(SD)` im `if(sdOk)`-Block; als 5. Argument an `WebUI`-Konstruktor.

### CSS-Token-System (Web)

`styles.css` — 8 semantische Tokens als CSS-Custom-Properties:

| Token | Hell-Wert | Dunkel-Wert |
|---|---|---|
| `--bg` | `#fafaf9` (stone-50) | `#1c1917` (stone-900) |
| `--surface` | `#ffffff` | `#292524` (stone-800) |
| `--fg` | `#1c1917` | `#fafaf9` |
| `--muted` | `#78716c` (stone-500) | `#a8a29e` (stone-400) |
| `--faint` | `#a8a29e` | `#57534e` (stone-600) |
| `--border` | `#e7e5e4` (stone-200) | `#44403c` (stone-700) |
| `--accent` | `#d97706` (Bernstein, Default) | via `theme.ts` |
| `--accent-fg` | `#ffffff` | via `theme.ts` (Luminanz-berechnet) |

Dark-Mode-Selector: `[data-theme="dark"]` (explizit) + `@media (prefers-color-scheme: dark) { :root:not([data-theme]) }` (System). Tönung-Overrides: `data-tint="warm"` / `data-tint="cool"` verschiebt nur `--bg`, `--surface` bleibt neutral.

Tailwind-4-Mapping via `@theme inline` — erzeugt `bg-bg`, `bg-surface`, `text-fg`, `text-muted`, `text-faint`, `border-border`, `bg-accent`, `text-accent-fg` sowie Opacity-Varianten (`bg-fg/5`, `bg-fg/10`, `bg-fg/80` etc.).

### theme.ts (Web)

- `applyTheme(settings)` — setzt `data-theme` (dark/light/absent für System), `data-tint` (warm/cool/absent für neutral), `--accent` + `--accent-fg` als Inline-CSS-Variablen auf `<html>`, schreibt localStorage-Cache.
- `loadCachedTheme()` — liest localStorage, gibt null bei Fehler zurück.
- Flash-Vermeidung: `App.useEffect` wendet gecachtes Theme sofort synchron an, dann `getSettings()` für Server-Abgleich.

### Settings-Navigation (Web)

Neue 3-Routen-Struktur statt bisherigem 1-Routen-`/settings`:
- `/settings` → `SettingsIndex` (Hub mit Kategorieliste)
- `/settings/appearance` → `AppearancePage` (Modus/Akzent/Tönung)
- `/settings/devices` → `DevicesPage` (= alter `SettingsPage`-Inhalt, `←` nach `/settings`)

`AppearancePage`: lädt Settings per `getSettings()`, optimistisches Apply via `applyTheme()` vor `updateSettings()`-Aufruf. Segmented-Buttons mit `bg-fg text-bg`-Aktivzustand. Akzent: 6 Presets (Bernstein, Kupfer, Blau, Grün, Rot, Violett) + nativer `<input type="color">`. Stale-Closure-Fix: `setSettings((prev) => ...)` statt Direktclosure — verhindert verlorene Updates beim schnellen Drag über den Color-Picker.

`SettingsIndex` und `AppearancePage` verwenden `_: { path?: string }` (kein Destructuring) — konsistent mit Preact-Router-Konvention.

### Komponenten-Refactor (Web)

Alle 7 bestehenden Komponenten/Pages auf semantische Klassen umgestellt — kein hardcodiertes `stone-*` mehr:

| Datei | Geänderte Klassen (Beispiele) |
|---|---|
| `SensorCard` | `bg-white→bg-surface`, `bg-stone-700→bg-accent` (Progress), `text-stone-400→text-faint` |
| `ActuatorCard` | `bg-stone-900 text-white→bg-fg text-bg`, `bg-stone-100→bg-fg/5` (OFF-Toggle) |
| `ControllerCard` | `border-stone-100→border-border/50` (disabled), `text-stone-300→text-faint` |
| `ConfirmModal` | `bg-white→bg-surface`, Confirm-Button `bg-fg hover:bg-fg/80 text-bg` |
| `DashboardEditorModal` | `accent-stone-800→accent-accent`, `focus:ring-stone-400→focus:ring-border` |
| `AddItemModal` | `inp`/`lbl`/`segBtn`-Konstanten auf Tokens, `bg-surface`/`text-fg` auf Inputs |
| `Dashboard` | `bg-stone-50→bg-bg`, `border-stone-900→border-accent` (aktiver Tab) |

### Verifikation

| Check | Resultat |
|---|---|
| `pio run -e esp32dev` (Firmware) | SUCCESS — 78 % Flash |
| `pnpm typecheck` (Web) | 0 Fehler |
| Kein `stone-*` verbleibend | ✓ (grep clean) |

### Commits

`6c19f6d` feat(fw): SettingsStore  
`3e2c5d2` feat(fw): GET/POST /api/settings  
`93807d7` fix(fw): settings POST handler vor serveStatic  
`a2c950c` feat(fw): wire SettingsStore in main  
`358ffad` feat(web): ThemeSettings/AppSettings + API  
`5842cdd` feat(web): CSS token system + Tailwind mapping  
`117d3d5` feat(web): theme.ts  
`027b4cf` feat(web): Settings hub + AppearancePage + DevicesPage  
`559ef2a` fix(web): functional setSettings (stale closure)  
`f7edee2` refactor(web): SensorCard/ActuatorCard/ControllerCard → tokens  
`1a1a212` refactor(web): alle Komponenten → semantische Tokens  
`5519f0e` fix(web): hover auf AddItemModal Submit-Button  
`c0e9375` fix: Hex-Validierung accent + unused path params

---

## 2026-06-01 — Routing-Refactor + UI-Verbesserungen

**Ausgangslage:** Das gesamte Dashboard-UI lebte in `app.tsx`. Settings war kein eigener Tab, sondern ein State-Toggle in derselben Komponente. Die × -Schaltfläche auf Cards löschte Geräte dauerhaft statt sie vom Dashboard zu entfernen.

### 1 — Routing mit preact-router

`preact-router@4.1.2` als Dependency hinzugefügt. Zwei echte Routen:

- `/` → `Dashboard` (Tab-Bar, Cards, Modals)
- `/settings` → `SettingsPage` (Geräteverwaltung)

`app.tsx` auf ~45 Zeilen reduziert: nur `useSnapshot`-Hook, `App`-Komponente (Router-Shell), `RebootingView`.

`useSnapshot` in `App` geliftet und als Prop an beide Pages übergeben — ein SSE-Kanal für beide Routen.

**ESP32 SPA-Fallback:** `WebUI.cpp` registriert `onNotFound`-Handler vor `server_.begin()` — liefert `index.html` für alle GET-Requests die nicht mit `/api/` beginnen. Ermöglicht Hard-Refresh auf `/settings` (Preact-Router übernimmt dann client-seitig).

### 2 — Code-Aufteilung in `src/pages/`

- **`src/pages/Dashboard.tsx`** (neu): enthält alles Dashboard-spezifische — Tab-Bar, filterSnap, Column, TabBtn, alle Modals, alle States
- **`src/pages/SettingsPage.tsx`** (neu): eigenständige Settings-Seite, Navigation zurück via `<a href="/">←</a>`

### 3 — SettingsPage: DeviceRow statt Live-Cards

Settings braucht keine Live-Werte, keine Regler-Steuerung. Eigene `DeviceRow`-Komponente:
- Name + Typ-Badge (Sensor: `meta.quantity`, Aktor: `meta.kind`, Regler: `"sensor → actuator"`)
- Edit (✎) + Delete (×)-Buttons

`SensorCard`, `ActuatorCard`, `ControllerCard`, `resetSensor` vollständig aus SettingsPage entfernt.

Multi-Channel-Sensoren dedupliziert nach Base-ID — `temp.0` + `temp.1` erscheinen als ein Eintrag `temp`.

Vertikal gestapelte Sections (Sensoren / Regler / Aktoren) statt 3-Spalten-Grid; + Hinzufügen-Button im Header rechts.

### 4 — Dashboard: × entfernt statt löscht

`onDelete` auf SensorCard/ActuatorCard/ControllerCard ruft jetzt `removeFromDashboard(role, id)` auf statt `setDeleteTarget`. Die Funktion aktualisiert die Dashboard-Config via `updateDashboard` und lokalen State — das Gerät bleibt im System, wird nur aus der Ansicht entfernt.

`deleteSensor`, `deleteActuator`, `deleteController` aus Dashboard-Imports entfernt. Löschen-`ConfirmModal` + zugehöriger State aus Dashboard entfernt.

### 5 — Tab-Bar: globaler Bearbeiten-Button

✎ und × wurden aus jedem Tab-Button entfernt (Tabs sind jetzt reine Klick-Targets).

Neuer einzelner `✎ Bearbeiten`-Button rechts neben der Tab-Leiste — erscheint nur wenn ein Dashboard aktiv ist, öffnet `DashboardEditorModal` für das aktive Dashboard.

### 6 — DashboardEditorModal: Löschen im Modal

`onDelete?: () => void`-Prop hinzugefügt. Wenn übergeben: roter `Löschen`-Button links unten im Footer (nur beim Bearbeiten, nicht beim Erstellen). Klick löscht das Dashboard und schließt den Modal.

### Verifikation

| Check | Resultat |
|---|---|
| `pnpm typecheck` (BrewControl/web) | 0 Fehler |
| Firmware-Compile-Smoke-Test | ausstehend |

---

## 2026-06-02 — Gärsteuerung: Dual-Output-Regler (Heizen + Kühlen)

**Ausgangslage:** Das `Controller`-Modell war strikt 1 Sensor → 1 Aktor. Eine Gärsteuerung
braucht 1 Sensor → 2 Aktoren (heizen + kühlen, Totband dazwischen). Frage des Nutzers: PID
für die Gärsteuerung mit zwei Ausgängen.

**Designweg (nach Diskussion):** Statt einer Klasse mit Modus-Schalter → **zwei
eigenständige Reglerklassen** als Geschwister von `PIDController`/`TwoPointController` (kein
gemeinsamer Basistyp, konsistent zum Library-Stil).

### Library (SensActCtrl) — 2 neue Klassen + 21 Tests (80 → 101 grün)

- **`DualStageController`** (`.h`/`.cpp`): Bang-Bang Heiz-+Kühlstufe. Heizen AN unter
  `sp − heatDiff`, AUS bei `sp`; Kühlen AN über `sp + coolDiff`, AUS bei `sp`. Anti-Short-Cycle
  auf der Kühlstufe (`coolMinOnMs`/`coolMinOffMs`, Kompressorschutz); ein per min-on gehaltener
  Kompressor hat Vorrang vor frischer Heizanforderung.
- **`SplitRangePIDController`** (`.h`/`.cpp`): selbst-enthaltener bipolarer PID (positional,
  Clamping-Anti-Windup, Output `[−1,+1]`), positiv heizt / negativ kühlt, Output-Totband
  `deadband`. **Kein** AutoTunePID, **kein** Refactor von `PIDController` (Surgical Changes).
- **Schutz vor zeitgleichem Einschalten** (beide): (1) strukturelle Mutual-Exclusion,
  (2) `heatDiff`/`coolDiff`/`deadband` auf ≥ 0 geklemmt, (3) harte Interlock-Schranke in
  `tick()` → bei Widerspruch beide aus. Optionale **Umschalt-Totzeit** `changeoverMs` (Default 0).
- **Fail-safe:** disabled oder ungültiges Reading → beide Aktoren auf 0 (kein hängender Heizer).
- Beide Aktoren optional (`nullptr`) → Heiz-only / Kühl-only ohne Sonderpfad.
- Native-Zeit-Hook (`dualStageSetMillisForTest` / `splitRangeSetMillisForTest`) für Cycle-/
  Changeover-Tests. `SensActCtrl.h` um beide Includes ergänzt.

### Firmware (BrewControl)

- `DynamicItems.h`: `CtrlEntry.coolActuatorId` (heat bleibt `actuatorId`).
- `DynamicItems.cpp`: zwei Factory-Branches `"DualStage"` / `"SplitRangePID"` (lesen `sensor`,
  `heat_actuator`, `cool_actuator` (mind. einer), `setpoint` + typ-spezifische Felder +
  `changeover_ms`). Lösch-Abhängigkeitsprüfung in `removeActuator` erweitert:
  `actuatorId == id || coolActuatorId == id` → referenzierter Kühl-Aktor blockiert.
- Neue Controller kommen über `#include <SensActCtrl.h>` mit; kein neuer Endpunkt.

### Frontend (BrewControl/web)

- `types.ts`: `ControllerParams` um `heatActuator`/`coolActuator`/`heatDiff`/`coolDiff`/
  `coolMinOnMs`/`coolMinOffMs`/`deadband`/`changeoverMs`/`heatOut`/`coolOut` erweitert.
- `AddItemModal.tsx`: `ControllerType` += `'DualStage' | 'SplitRangePID'`; zwei neue Typ-Buttons
  („Heizen/Kühlen (Zweipunkt/PID)"); gemeinsamer Sensor-Dropdown + zwei Aktor-Dropdowns
  (Heizung/Kühlung, je „— keiner —"); typ-spezifische Felder; Zeit-Felder im UI in **Sekunden**
  (×1000 → ms beim Submit); Edit-Preload + Reset-Defaults; Submit-Validierung (Sensor + mind.
  ein Aktor).
- `ControllerCard.tsx`: bei `heatActuator`/`coolActuator` zwei Ausgänge („Heizen"/„Kühlen")
  statt des einzelnen „Ausgang".

### Wire-Format
```json
POST /api/controllers
{ "type":"DualStage","id":"ferm","sensor":"ferm_temp",
  "heat_actuator":"heat_pad","cool_actuator":"fridge","setpoint":20.0,
  "heat_diff":0.5,"cool_diff":0.5,"cool_min_on_ms":120000,
  "cool_min_off_ms":180000,"changeover_ms":0 }
```

### Verifikation

| Check | Resultat |
|---|---|
| `pio test -e native` (SensActCtrl) | 101/101 PASSED (80 alt + 12 DualStage + 9 SplitRange) |
| `pio run -e esp32dev` (Firmware) | SUCCESS — 79.1 % Flash |
| `pnpm typecheck` (BrewControl/web) | 0 Fehler |

---

## 2026-06-02 — UI: Regler-Typ als gruppiertes Dropdown (PR #2)

**Ausgangslage:** Nach der Gärsteuerung gab es im `AddItemModal` vier Segment-Buttons für
den Regler-Typ (PID / Zweipunkt / Heizen-Kühlen-Zweipunkt / Heizen-Kühlen-PID) — bei vier
Typen unübersichtlich.

**Änderung (`AddItemModal.tsx`, nur Frontend):** Buttons → gruppiertes `<select>` (gleiches
`<optgroup>`-Muster wie der Sensortyp-Selektor):
- **Zweipunktregler:** Einfacher Zweipunktregler (`TwoPoint`), Dual-Stage-Regler (`DualStage`)
- **PID:** Einfacher PID-Regler (`PID`), Split-Range-PID-Regler (`SplitRangePID`)

Im Edit-Modus gesperrt (`disabled` + `opacity-60`), `title` für Barrierefreiheit. `segBtn`
bleibt für andere Selektoren in Gebrauch (kein Orphan). `pnpm typecheck` 0 Fehler.

---

## 2026-06-02 — PID-AutoTune über Web

**Ausgangslage:** `PIDController` kapselte AutoTune (autotune/isAutotuneRunning/isAutotuneDone,
Auto-Übernahme der Gains, `autotuneState` im paramsJson), aber `setParamsJson` konnte es nicht
starten und es gab keinen Stop.

**Library:** neue Methode `stopAutotune()` (Backend → Normal-Modus mit letzten Gains,
idempotent); `setParamsJson` liest Kommando-Feld `"autotune"`: `"start"` → `setEnabled(true)` +
`autotune(tuningMethod_)`, `"stop"` → `stopAutotune()`. Auto-Enable, weil AutoTune einen
tickenden Regler braucht. 4 neue native Tests (101 → 105).

**Firmware:** keine Änderung — Trigger läuft über die bestehende `POST /api/controllers/:id/params`-Route.

**Frontend:** `api.ts` `startAutotune(id, method)` / `stopAutotune(id)`; `types.ts` `Ku`/`Tu`
ergänzt; ControllerCard zeigt für PID-Regler (`params.Kp != null && params.heatActuator == null`)
ein Methoden-Dropdown (5 Algorithmen, Default Ziegler-Nichols) + Start-Button, bei `running`
einen Abbrechen-Button + Badge, bei `done` die ermittelten Gains.

**Randbedingung:** nur `PIDController`. `DualStage` (bang-bang) und `SplitRangePID` (PID ohne
AutoTune-Backend) bleiben außen vor. Fortschrittsanzeige als späteres Feature in PLAN.md vermerkt.

Spec: `docs/superpowers/specs/2026-06-02-pid-autotune-web-design.md`,
Plan: `docs/superpowers/plans/2026-06-02-pid-autotune-web.md`.

### Verifikation
| Check | Resultat |
|---|---|
| `pio test -e native` (SensActCtrl) | 105/105 PASSED (101 alt + 4 neu) |
| `pio run -e esp32dev` (Firmware) | SUCCESS — 79.1 % Flash |
| `pnpm typecheck` (BrewControl/web) | 0 Fehler |

**Offen:** E2E am echten PID-Regler (Status idle→running→done, übernommene Gains, Abbruch) —
in PLAN.md unter Hardware-Verifikation.

---

## 2026-06-02 — AutoTune für SplitRangePID (geteilte PidEngine)

**Ausgangslage:** `PIDController` konnte AutoTune (AutoTunePID-Backend via privater `Impl`),
`SplitRangePIDController` hatte einen selbst-geschriebenen PID ohne AutoTune.

**Library:** `PIDController::Impl` → `SensActCtrl::detail::PidEngine` (`src/controllers/detail/`)
extrahiert (AutoTunePID auf Arduino + Positional-PID-Fallback nativ); `TuningMethod` in eigenen
Header `controllers/TuningMethod.h` ausgelagert. Beide Regler halten `detail::PidEngine* engine_`
(forward-declariert → AutoTunePID leckt nicht in die Umbrella). `SplitRangePIDController` nutzt
die Engine mit Range [−1,+1] und bekommt dieselbe AutoTune-Oberfläche (`autotune`/`stopAutotune`/
Abschlusserkennung/`syncFromBackend`, `Ku`/`Tu`/`autotuneMethod`/`autotuneState` im JSON,
`"autotune":"start/stop"`-Trigger). Während des Tunes wird die Umschalt-Totzeit übersprungen
(Relay-Schwingung). 4 neue native Tests (105 → 109); bestehende test_pid (9) + test_splitrange (9)
unverändert grün (verhaltensneutral).

**Firmware:** keine Änderung — Trigger über die bestehende params-Route.

**Frontend:** ControllerCard-Bedingung `params.Kp != null && params.heatActuator == null` →
`params.Kp != null` (AutoTune-Block für PID *und* SplitRangePID).

**Randbedingung:** Relay-Autotune liefert einen Kompromiss-Gain-Satz über die gemischte
Heiz/Kühl-Strecke (kein getrenntes Tuning pro Richtung). `DualStage` (bang-bang) bleibt außen vor.

Spec: `docs/superpowers/specs/2026-06-02-splitrange-autotune-design.md`,
Plan: `docs/superpowers/plans/2026-06-02-splitrange-autotune.md`.

### Verifikation
| Check | Resultat |
|---|---|
| `pio test -e native` (SensActCtrl) | 109/109 |
| `pio run -e esp32dev` (Firmware) | SUCCESS |
| `pnpm typecheck` (BrewControl/web) | 0 Fehler |

**Offen:** E2E am echten SplitRangePID (idle→running→done, übernommene Gains, Abbruch) — in PLAN.md unter Hardware-Verifikation.

---

## 2026-06-03 — PIN-Invertierung

**Scope:** Feature-Track Welle 1. Kein Library-Code — beide Primitive (`DigitalInputSensor`,
`DigitalOutputActuator`) waren bereits fertig.

### DigitalInput-Sensor (neu in Factory + UI)

- `DynamicItems.cpp`: neuer Branch `"DigitalInput"` in `addSensorNoBegin()` — liest `pin` (Pflicht),
  `pullup`/`invert` (bool, Default false), `debounce_ms` (uint32, Default 0).
  `DigitalInputSensor.h` bereits in Umbrella-Include — kein neues `#include` nötig.
- `AddItemModal.tsx`: `SensorType += 'DigitalInput'`; neue `<optgroup label="Digital / Schalter">`;
  Formular (Pin / Invertieren-Checkbox / Pullup-Checkbox / Entprellung); Edit-Preload +
  Reset-Defaults + Submit.

### DigitalOutput-Invert (Durchreichen)

- `DynamicItems.cpp`: `bool invert = cfg["invert"] | false;` + `activeHigh = !invert` im
  DigitalOutput-Branch. Rückwärtskompatibel — fehlendes Feld → false → `activeHigh=true`.
- `AddItemModal.tsx`: neuer `invertOut`-State; Checkbox „Invertieren (active-low)" im
  DigitalOutput-Formular; Edit-Preload + Reset + Submit ergänzt.

### Wire-Format

```json
POST /api/sensors
{ "type":"DigitalInput", "id":"float_sw", "pin":15, "invert":true, "pullup":true, "debounce_ms":50 }

POST /api/actuators
{ "type":"DigitalOutput", "id":"ssr", "pin":2, "mode":"Binary", "invert":true }
```

### Verifikation

| Check | Resultat |
|---|---|
| `pio run -e esp32dev` | SUCCESS |
| `pio run -e lolin_s2_mini` | SUCCESS |
| `pio run -e lilygo_t_display_s3_amoled` | SUCCESS |
| `pnpm typecheck` | 0 Fehler |

---

## 2026-06-05 — Zeit & Formate (NTP-Sync + Zeitzone + Formateinstellungen)

**Ausgangslage:** Keine Zeitsynchronisation, keine Timestamps in Logs, kein konfiguriertes Zeitformat.

### Firmware (BrewControl)

- **`SettingsStore.h/cpp`**: neuer `"time"`-Toplevel-Block mit 5 Feldern: `ntpServer_` (default `"pool.ntp.org"`), `utcOffsetSec_` (int32_t, default 3600 = CET), `dstOffsetSec_` (int32_t, default 3600 = CEST), `timeFormat_` (`"24h"`/`"12h"`), `dateFormat_` (`"DD.MM.YYYY"`/`"MM/DD/YYYY"`/`"YYYY-MM-DD"`). Getter, load/save/serialize/update nach bewährtem Muster.
- **`main.cpp`**: `configTime(utcOffsetSec, dstOffsetSec, ntpServer)` direkt nach `settingsStore.loadFromSD()` — nutzt gespeicherte Werte, non-blocking (SNTP im Hintergrund).
- **`WebUI.cpp`**:
  - `kSnapshotCap` 4096 → 4160 (Puffer für serverTime-Suffix).
  - `makeSnapshot()`: hängt `,"serverTime":<unix-ts>}` vor das abschließende `}` des Registry-JSONs an, wenn `time(nullptr) > 946684800` (NTP synced, nach Jahr 2000).
  - POST `/api/settings`: `"time"`-Validierungsblock (Range-Check für Offsets, Enum-Check für Format-Strings). Nach `settings_.update()` + `saveToSD()` wird `configTime()` sofort neu aufgerufen — kein Reboot nötig.

### Frontend (BrewControl/web)

- **`types.ts`**: `TimeSettings`-Interface, `AppSettings` um `time?: TimeSettings` erweitert, `Snapshot` um `serverTime?: number` erweitert.
- **`time.ts`** (neu): `formatTime(ts, settings)`, `formatDate(ts, settings)`, `formatDateTime(ts, settings)` — verwendet Browser-`Date` mit Unix-Timestamp (Sekunden × 1000). Wird von Charts/Logs wiederverwendet.
- **`pages/TimePage.tsx`** (neu): Timezone-Dropdown (25 gängige Regionen → `utcOffsetSec`/`dstOffsetSec`), Zeitformat-Segmented-Buttons (24h/12h), Datumsformat-Segmented-Buttons, NTP-Server-Text-Input. Optimistisches Update-Muster (wie `AppearancePage`).
- **`pages/SettingsIndex.tsx`**: Live-Uhr ganz oben (Browser-`setInterval(1s)`, `new Date()`, formatiert mit gespeicherten Format-Settings). Neuer Nav-Eintrag „Zeit & Formate" → `/settings/time`.
- **`app.tsx`**: Route `/settings/time` → `TimePage` hinzugefügt.

### Wire-Format

```json
// GET/POST /api/settings
{ "time": { "ntpServer": "pool.ntp.org", "utcOffsetSec": 3600, "dstOffsetSec": 3600,
            "timeFormat": "24h", "dateFormat": "DD.MM.YYYY" } }

// SSE-Snapshot (nur wenn NTP synced)
{ "sensors": [...], "actuators": [...], "controllers": [...], "serverTime": 1748995200 }
```

### Verifikation

| Check | Resultat |
|---|---|
| `pnpm typecheck` | 0 Fehler |
| `pio run -e esp32dev` | SUCCESS — 62.3 % Flash, 15.5 % RAM |
| HW-E2E (NTP-Sync, Formatwechsel, serverTime im Snapshot) | ausstehend |

---

## 2026-08-12 — Sollwert-Ratenbegrenzung (RateLimitedController-Decorator)

**Ausgangslage:** Bei den Sollwert-Programmen (2026-06-08) wurde bewusst auf echtes Rampen verzichtet — der Sollwert springt sofort aufs Ziel. Wunsch: die Änderungsrate eines Sollwerts (z. B. °C/min beim Aufheizen) begrenzbar machen, um Bauteile vor zu schnellen Sprüngen zu schützen. Diskutiert und verworfen: Rate-Begrenzung direkt in der `Controller`-Basisklasse — die meisten Regler (z. B. `TwoPointController` an einem Relais) brauchen das nie. Stattdessen: **Decorator**, der einen bestehenden `Controller` umschließt.

### Library (SensActCtrl)

Neue Klasse `RateLimitedController` (`src/controllers/RateLimitedController.h/.cpp`) — implementiert `Controller`, hält eine nicht-besitzende `Controller&`-Referenz (Library-Konvention). `setSetpoint()` speichert nur das Ziel; `tick()` bewegt einen internen Ist-Sollwert pro Sekunde um max. `maxRatePerSec` und ruft **jeden Zyklus unbedingt** `inner_.setSetpoint(effective_)` auf, bevor an `inner_.tick()` delegiert wird — dadurch ist die Rampe selbstkorrigierend, ohne dass ein eingebetteter `"setpoint"`-Key aus `setParamsJson()` herausgeschnitten werden müsste. `setpoint()` liefert weiterhin das Ziel (nicht den Rampenwert) — konsistent mit allen anderen Reglern und dem Snapshot-Feld `obj["setpoint"]`. `enabled()`/`setEnabled()`/`begin()`/`end()` reichen unverändert an `inner_` durch (kein eigener Zustand, eine Quelle der Wahrheit). Erster `setSetpoint()`-Aufruf springt sofort (kein Rampen ab 0 beim Boot), jeder folgende rampt normal (`initialized_`-Flag). `paramsJson()` spleißt eigene Felder (`maxRatePerSec`, `effectiveSetpoint`) in das JSON des inneren Reglers. 11 neue native Tests (`test/test_ratelimited/`, u. a. Rampen-Kappung beide Richtungen, Zielerreichung ohne Überschwingen, Boot-Snap, `enabled`-Durchreichen, PID-Wrap-Smoke-Test für Typ-Agnostik).

### Firmware (BrewControl)

`DynamicItems.h`: `CtrlEntry` um `innerPtr` erweitert (hält den konkreten Regler, wenn gewrappt; `ptr` ist immer das bei der Registry registrierte Objekt). `DynamicItems.cpp`: `addControllerNoBegin()` baut jeden der vier Reglertypen wie bisher, wrapped aber **einmalig, gemeinsam für alle Typen** am Ende, wenn `max_rate_per_sec` (snake_case, Create-Config-Konvention) gesetzt ist. Keine Änderung an `WebUI.cpp`/`ProgramRunner.cpp` nötig — beide lösen den Controller bei jedem Aufruf frisch über `Registry::findController(id)` auf, laufen also transparent durch den Decorator, wenn er das registrierte Objekt ist.

### Frontend (BrewControl/web)

`types.ts`: `ControllerParams` um `maxRatePerSec?`/`effectiveSetpoint?` erweitert. `AddItemModal.tsx`: ein geteiltes, typ-unabhängiges Feld „Max. Änderungsrate (°/min, leer = unbegrenzt)" (nicht pro Reglertyp dupliziert), Anzeige in °/min, Umrechnung auf `max_rate_per_sec` beim Submit (÷60). `ControllerCard.tsx`: neue Zeile „Ziel: X · aktuell: Y (rampt)", nur sichtbar wenn `params.maxRatePerSec` gesetzt ist.

### Wire-Format

```json
POST /api/controllers
{ "type":"TwoPoint","id":"mash","sensor":"mlt","actuator":"heater",
  "setpoint":65,"hyst_low":-0.5,"hyst_high":0.5,"max_rate_per_sec":0.008333333 }

// Snapshot-params (zusätzlich zu den regulären Reglerfeldern)
{ "maxRatePerSec":0.0083, "effectiveSetpoint":42.3 }
```

### Verifikation

| Check | Resultat |
|---|---|
| `pio test -e native` (SensActCtrl) | 120/120 PASSED (109 alt + 11 neu) |
| `pio run -e esp32dev` | SUCCESS |
| `pio run -e lilygo_t_display_s3_amoled` | SUCCESS — 18,5 % Flash |
| `pnpm typecheck` / `pnpm build` | 0 Fehler |
| **HW-E2E (LilyGo T-Display-S3-AMOLED, geflasht über USB/COM9)** | **grün:** Boot-Snap (erster Sollwert springt, kein Rampen ab 0), Live-Rampen numerisch verifiziert (Δeffective ≈ Δt·Rate über mehrere Polls), `setSetpoint`/`setParamsJson` laufen korrekt durch den Decorator, AddItemModal-Rundlauf (Speichern → `/api/config` → Edit-Modal erneut öffnen → Wert exakt vorbelegt) gegen echtes Gerät (`brewcontrol.local`) |

**Nebenbefund (kein Bug):** Das innere `params.setpoint` (aus dem gewrappten Reglers eigenem `paramsJson()`) spiegelt während einer laufenden Rampe den Ist-Rampenwert, nicht das Ziel — erwartet, da `tick()` genau diesen Wert an `inner_.setSetpoint()` durchreicht. Das Top-Level-`setpoint`-Feld (vom Decorator) bleibt korrekt das Ziel; UI liest ausschließlich dieses Feld.

**Umgebungshinweis:** Auf dieser Maschine fehlte ein nativer GCC-Toolchain (nur ESP32-Xtensa/RISC-V-Toolchains via PlatformIO vorhanden). Behoben durch `winget install BrechtSanders.WinLibs.POSIX.UCRT` (Nutzer-Scope, kein Admin nötig) — Chocolatey scheiterte an fehlenden Admin-Rechten.

---

## 2026-08-13 — Aktor-Master-Schalter (EnableGuardActuator-Decorator)

**Ausgangslage:** Continuous-Aktoren (Slider im UI, z. B. `AnalogOutputActuator` für PWM/DAC) hatten keinen eigenständigen on/off-Status — „Aus" hieß bisher: Slider auf `min` ziehen, der zuletzt gesetzte Wert ging dabei verloren. Wunsch: ein echter Ein/Aus-Schalter, der den zuletzt gesetzten Wert merkt und beim Wiedereinschalten automatisch reaktiviert (Anwendungsfall: Rührwerk-Drehzahl). Bewusst nur für `Continuous`-Kind — `Binary`-Aktoren haben mit ihrem Toggle bereits ein on/off (der Wert *ist* der Schalter), `Discrete` (Zahl+Send) ist unbetroffen. Diskutiert und verworfen: Vererbungs-Umbau der Aktor-Klassen (z. B. „Binary als Basisklasse") — `write(0/1)` und `write(0.37)` haben keine gemeinsame Semantik, das hätte nur künstliche Kopplung erzeugt. Stattdessen wieder ein **Decorator**, exakt nach dem Vorbild von `RateLimitedController` (2026-08-12, s. o.) — dort bereits als Muster etabliert und hier 1:1 auf Aktoren übertragen.

### Library (SensActCtrl)

`core/Actuator.h`: zwei neue default-implementierte virtuelle Methoden `enabled()`/`setEnabled(bool)`, analog zum bestehenden `fault()`-Default-Pattern — bestehende Aktor-Klassen bleiben unverändert, melden einfach `enabled()==true`. Neue Klasse `EnableGuardActuator` (`src/actuators/EnableGuardActuator.h/.cpp`) — hält eine nicht-besitzende `Actuator&`-Referenz. `write(v)` merkt sich `v` als Ziel und schreibt bei deaktiviertem Zustand stattdessen `meta().min` an den inneren Aktor; `setEnabled(true)` spielt das gemerkte Ziel erneut ein (Aktor springt auf den zuletzt gesetzten Wert zurück, nicht auf `min`). `id()`/`meta()`/`begin()`/`end()`/`tick()`/`state()`/`fault()` reichen unverändert an `inner_` durch. 7 neue native Tests (`test/test_enable_guard_actuator/`): Passthrough bei enabled, Disable fährt auf min, Re-Enable stellt Ziel wieder her, Schreiben während disabled aktualisiert nur das Ziel, redundantes `setEnabled(true)` ist ein No-Op, Forwarding von id/meta/fault/state/tick.

### Firmware (BrewControl)

`DynamicItems.h`: `ActuatorEntry` um `innerPtr` erweitert (identisches Muster wie `CtrlEntry` bei `RateLimitedController`). `DynamicItems.cpp`, `addActuatorNoBegin()`: nach dem Bauen des konkreten Aktors automatischer Wrap in `EnableGuardActuator`, wenn `meta().kind == ValueKind::Continuous` — kein Opt-in-Config-Flag nötig (anders als `max_rate_per_sec` bei Reglern), da das Feature für alle Slider-Aktoren gilt. `removeActuator()` unverändert, `unique_ptr`-Destruktoren räumen `innerPtr`+`ptr` symmetrisch auf. `RegistrySnapshot.cpp`: `obj["enabled"] = a->enabled()` für jeden Aktor ergänzt (unconditional, mirrors die bestehende Controller-Zeile). `WebUI.cpp`, `/api/actuators/:id`-Handler: Validierung gelockert — `v` bleibt der Hauptpfad, `enabled` optional zusätzlich unterstützt, 400 nur wenn beide Felder fehlen.

### Frontend (BrewControl/web)

`types.ts`: `Actuator.enabled: boolean` ergänzt (mirrors `Controller.enabled`). `api.ts`: neue Funktion `enableActuator(id, enabled)`, Schwester von `writeActuator`. `ActuatorCard.tsx`: neuer ⏻-Toggle nur bei `meta.kind === 'Continuous'`, im Header neben dem Kind-Badge (Muster von `ControllerCard`s `toggleEnabled()` übernommen — eigener `toggling`-State); Slider bekommt `opacity-60` + `disabled`, solange `!enabled`. Binary/Discrete-Rendering unverändert.

### Verifikation

| Check | Resultat |
|---|---|
| `pio test -e native` (SensActCtrl) | 127/127 PASSED (120 alt + 7 neu) |
| `pio run -e esp32dev` | SUCCESS — 65.3 % Flash, 15.7 % RAM |
| `pnpm typecheck` | 0 Fehler |
| Browser-Check gegen echtes Gerät (`brewcontrol.local`, Dev-Server-Proxy) | Toggle erscheint korrekt nur bei den zwei Continuous-Aktoren (`kettle`, `dfsdfdf`), nicht beim Binary-Aktor (`pump`). Klick sendet korrekt `POST {"enabled":false}` ohne `v` |
| **HW-E2E (LilyGo T-Display-S3-AMOLED, geflasht über USB/COM9)** | **grün:** nach Flash meldet der Snapshot `enabled:true` für alle Aktoren (vorher fehlte das Feld komplett). Direkt gegen das Gerät verifiziert: `write 0.42` → `state.v=0.42`; `enabled:false` → `state.v=0` (min), `enabled` im Snapshot `false`; `enabled:true` → `state.v` springt automatisch zurück auf `0.42` — Restore-Verhalten bestätigt. Nebenbei bestätigt: der laufende `mash`-Regler (TwoPoint, Sensor unter Setpoint) treibt seinen Aktor `dfsdfdf` unverändert korrekt durch den Wrapper (transparent für Controller-gesteuerte Schreibzugriffe). `kettle` nach dem Test auf Ausgangswert (0.19) zurückgesetzt. |

---

## 2026-08-14 — Aktor-Intervallbetrieb (IntervalActuator-Decorator, konfigurierbare Zeitbasis)

**Ausgangslage:** Direkter Nachfolger des Aktor-Master-Schalters (s. o.). Wunsch: Aktoren, die im „Ein"-Zustand nicht dauerhaft, sondern in Intervallen laufen sollen (Rührwerk im Gärbehälter), Vorbild BrewTools (Slider zwischen „aus" und „dauerhaft an"). Im Gespräch geklärt: gilt für **alle** Aktor-Arten (nicht nur Continuous wie beim Master-Schalter — die Taktung ist eine automatische Zeitsteuerung obendrauf, kein redundantes zweites An/Aus); Zeitbasis muss frei konfigurierbar sein (nicht fest „X von 60 Minuten", sondern Zykluslänge + Einheit s/min/h); live editierbar auf der ActuatorCard, nicht nur im AddItemModal.

### Library (SensActCtrl)

`core/Actuator.h`: neues `IntervalConfig{bool has; uint32_t onSec; uint32_t periodSec;}` + zwei neue default-implementierte virtuelle Methoden `interval()`/`setInterval()`, analog zum `fault()`/`enabled()`-Muster. Neue Klasse `IntervalActuator` (`src/actuators/IntervalActuator.h/.cpp`) — Decorator nach `RateLimitedController`/`EnableGuardActuator`-Vorbild, generisch über `Actuator` (kennt keine Kind-Unterscheidung). Wire-Format immer Sekunden (mirrors `max_rate_per_sec`). `tick()`: rollierendes Fenster ab erstem Tick (millis-basiert, keine Wall-Clock/NTP-Abhängigkeit), `elapsed = (now-cycleStart) % periodMs`, Phasenwechsel treibt `inner_` auf `target_` (an) oder `meta().min` (aus). `write()` merkt Ziel, wirkt sofort nur in der An-Phase. `setInterval()` live änderbar, kein Zyklus-Reset nötig. **`EnableGuardActuator` musste um Forwarding von `interval()`/`setInterval()` ergänzt werden** — notwendig, damit die Werte durch einen weiter gewrappten `IntervalActuator` hindurch erreichbar bleiben (Registry hält nur den äußersten Pointer); symmetrisch reicht `IntervalActuator` `enabled()`/`setEnabled()` durch. 12 neue native Tests (`test/test_interval_actuator/`), u. a. Phasenwechsel bei 60 s **und** 3600 s Zyklen (Generik-Nachweis), Komposition mit `EnableGuardActuator` in Produktions-Reihenfolge (Master-Disable erzwingt aus unabhängig von der Intervall-Phase; Re-Enable während Intervall-aus-Phase bleibt aus statt erzwungen an).

### Firmware (BrewControl)

`DynamicItems.h`: `ActuatorEntry.innerPtr` (Einzelfeld) durch `chain`-Vektor ersetzt, da jetzt bis zu zwei Decorator-Schichten möglich sind (Interval + Enable). `DynamicItems.cpp`, `addActuatorNoBegin()`: neue Config-Felder `interval_on_sec`/`interval_period_sec` (Opt-in, anders als der automatische Master-Schalter) — wenn gesetzt, `IntervalActuator` gewrappt, **vor** dem bestehenden `EnableGuardActuator`-Check, sodass die Reihenfolge Enable(außen) → Interval(Mitte) → konkret(innen) entsteht. `WebUI.cpp`, `/api/actuators/:id`-Handler: um optionales `"interval":{"onSec","periodSec"}`-Objekt erweitert (dritte Möglichkeit neben `v`/`enabled`). `RegistrySnapshot.cpp`: `"interval"` conditional emittiert (mirrors `fault`).

### Frontend (BrewControl/web)

Neu: `src/intervalUnit.ts` — geteilte Konvertierung Sekunden ↔ Anzeige-Einheit (s/min/h), inkl. `pickIntervalUnit()`-Heuristik (verhindert Drift zwischen AddItemModal und ActuatorCard). `types.ts`: `Actuator.interval?: {onSec, periodSec}`. `api.ts`: `setActuatorInterval(id, onSec, periodSec)`. `AddItemModal.tsx`: neuer Konfigurationsblock „Intervallbetrieb" (Zykluslänge + Einheit-Dropdown + An-Anteil-Slider) in `DigitalOutput`- **und** `AnalogOutput`-Formular (IDS1/IDS2 bewusst ausgelassen — kein bestehender optionaler-Feld-Block dort, Anwendungsfall unklar); Edit-Prefill leitet die Anzeige-Einheit aus `periodSec` her. `ActuatorCard.tsx`: neuer Live-Slider für den An-Anteil, wenn `actuator.interval` gesetzt — **nur** der An-Anteil ist live editierbar (Zykluslänge/Einheit bleiben Modal-only, analog Setpoint-live-vs-Kp/Ki/Kd-Modal beim Regler).

### Verifikation

| Check | Resultat |
|---|---|
| `pio test -e native` (SensActCtrl) | 139/139 PASSED (127 alt + 12 neu) |
| `pio run -e esp32dev` | SUCCESS |
| `pnpm typecheck` | 0 Fehler |
| **HW-E2E (LilyGo T-Display-S3-AMOLED, geflasht über USB/COM9)** | **grün:** Testaktor mit 20s/60s-Schema angelegt — `write 0.8` sofort wirksam (An-Phase), nach >20s automatisch auf `0` gefallen (Aus-Phase), Live-`setInterval(50,60)` per Runtime-Endpoint sofort zurück auf `0.8` (kein Zyklus-Reset nötig) — exakt wie in den nativen Tests. **Bonus-Befund:** Boot-Reload aus `/config/registry.json` wrapped Aktoren beim Neustart korrekt neu (ein zuvor über UI mit Intervall angelegter Aktor kam nach dem Flash automatisch mit `interval`-Feld im Snapshot zurück). Testaktor + Test-Config danach entfernt/zurückgesetzt. |
| UI (Vite-Dev-Proxy) | AddItemModal-Feld rendert korrekt (Zykluslänge/Einheit/An-Anteil-Slider), rundet gegen alte **und** neue Firmware sauber ab (alte Firmware ignoriert unbekannte Felder stillschweigend, kein Crash). |

**Nebenbefund (kein Bug, während der Verifikation entdeckt):** Der Vite-Dev-Proxy (`VITE_ESP_HOST=http://brewcontrol.local`) lieferte zwischenzeitlich leere 500er auf alle `/api/*`-Requests — Ursache war eine transiente mDNS-Auflösung auf Windows-Seite (bekannte Einschränkung, s. `BrewControl/PLAN.md`), nicht die Firmware. Direktes Ansprechen der Geräte-IP umging das Problem zuverlässig.

**Vorfall (echter Bug, durch den HW-Test verursacht):** Der Test-Aktor (`iv_test`, AnalogOutput/PWM) wurde auf GPIO 2 angelegt, ohne auf Pin-Konflikte zu prüfen (keine Konflikt-Prüfung vorhanden — s. Roadmap „Pin-Manager"). GPIO 2 ist aber der OneWire-Pin des `mlt`-DS18B20-Sensors. `ledcAttachPin()` (in `AnalogOutputActuator::begin()`) routet den Pin fest durch die LEDC-Peripherie; weder `AnalogOutputActuator::end()` noch `DynamicItems::removeActuator()` lösen das beim Löschen wieder (kein `ledcDetachPin()`-Aufruf, `end()` wird beim Entfernen gar nicht erst aufgerufen) — der Sensor lieferte danach dauerhaft `ok:false`/`v:-127`, bis der Nutzer das Gerät manuell neu gestartet hat (GPIO/LEDC-Routing ist reine Laufzeit-Konfiguration, ein Reboot setzt sie zurück). **Nach Reboot bestätigt: Sensor liefert wieder Werte.** Der zugrundeliegende Fix (Aktoren beim Entfernen sauber freigeben) ist als eigener Task vorgemerkt, nicht Teil dieser Session.

---

## 2026-08-14 — Fix: GPIO/LEDC-Leak beim Entfernen von Aktoren/Sensoren

**Ausgangslage:** Direkter Folge-Fix zum obigen Vorfall (Aktor-Intervallbetrieb-Session, gleicher Tag). Zwei Lücken behoben, keine Konflikt-Prävention (bleibt Pin-Manager-Roadmap-Punkt).

### Fix 1 — `end()` fehlte beim Entfernen (BrewControl)

`DynamicItems.cpp`: `removeActuator()` und `removeSensor()` riefen bisher nur `reg.remove(ptr.get())` + Vector-Erase auf, nie `ptr->end()`. Beide Methoden rufen jetzt `(*it)->ptr->end()` vor dem Erase auf. `ptr` ist bei Aktoren immer die äußerste Decorator-Schicht (`EnableGuardActuator`/`IntervalActuator`) — beide reichen `end()` transparent an `inner_` durch (bestehendes Forwarding-Muster), erreicht also zuverlässig den konkreten Aktor am Ende der Kette.

### Fix 2 — `AnalogOutputActuator::end()` löste PWM-Pin nicht (SensActCtrl)

`end()` rief bisher nur `write(valueMin_)` auf (Duty-Cycle 0), ließ den Pin aber über die LEDC-Peripherie geroutet. Ergänzt: `ledcDetachPin(pin_)` im PWM-Fall. DAC-Modus bewusst ausgenommen — `dacWrite()` nutzt kein GPIO-Matrix-Routing wie LEDC, es gibt kein Pendant zu detachen (gegen ESP32-Arduino-Core-Header verifiziert).

**Tests:** 2 neue native Tests (`test_end_detaches_ledc_pin_in_pwm_mode`, `test_end_does_not_detach_ledc_pin_in_dac_mode`) — Zählerstand eines Native-Test-Hooks (`analogOutputActuatorLedcDetachCallCountForTest()`) vor/nach `end()`. `removeActuator()`/`removeSensor()` selbst sind nativ nicht testbar (`DynamicItems.cpp` hängt an `ArduinoJson`/`FS.h`/`OneWire` — kein natives Mock-Setup vorhanden, `[env:native]` in `BrewControl/firmware` deckt bisher nur reine Algorithmus-Files wie `TarExtractor` ab); Verifikation dort über Codelesen (`ptr->end()` steht jetzt eindeutig vor dem Erase) + Firmware-Compile.

### Verifikation

| Check | Resultat |
|---|---|
| `pio test -e native` (SensActCtrl) | 141/141 PASSED (139 alt + 2 neu) |
| `pio run -e esp32dev` | SUCCESS — 65.4 % Flash, 15.7 % RAM |
| `ledcDetachPin`-Symbol gegen ESP32-Arduino-Core geprüft | vorhanden (`esp32-hal-ledc.h`), bereits transitiv über `Arduino.h` verfügbar wie `ledcSetup`/`ledcAttachPin` |
| HW-Verifikation (Pin nach Löschen erneut mit Sensor testen) | **ausstehend** — kein Board für diese Session verfügbar; nächster praktischer Test: Aktor auf GPIO 2 anlegen, löschen, danach `mlt`-Sensor-Reads prüfen (ohne Reboot) |

---

## 2026-08-18 — Aktor-Sollwert vs. Ist-Wert (`target()`/`forceOutput()`, Decorator-Reihenfolge getauscht)

**⚠️ Zwischenstand, am Folgetag ersetzt.** Der hier beschriebene Ansatz (Decorator-Reihenfolge tauschen, `forceOutput()` einführen) wurde noch am 2026-08-19 durch einen Basisklassen-Umbau ersetzt — `EnableGuardActuator` existiert nicht mehr, `forceOutput()` ist wieder entfallen. Siehe den Eintrag „Aktor-Enable in die Actuator-Basisklasse" weiter unten für den aktuellen Stand. Dieser Eintrag bleibt als Protokoll der Diagnose stehen (Befund 1–3 sind weiterhin die korrekte Ursachenanalyse).

**Ausgangslage:** Nutzer-Befund an der `ActuatorCard`: stellt man den Master-Schalter auf „aus", springt der Wert-Slider auf 0; gleicher Effekt, wenn der Intervallbetrieb in die Aus-Phase schaltet. Frage war, ob das reines UI ist oder ob Decorator-Reihenfolge/Klassenstruktur (Binary als Basisklasse) angefasst werden muss.

**Diagnose — drei Befunde, nicht einer:**

1. **UI/Wire-Format:** Beide Decorator reichen `state()` unverändert an `inner_` durch, `state()` meldet also immer den *physikalischen* Ist-Wert. Das intern gemerkte `target_` (Restore-Wert bzw. An-Anteil) war nirgends nach außen sichtbar — `RegistrySnapshot` emittierte nur `state.v`, und genau daran hing der Slider.
2. **Target-Korruption:** `EnableGuardActuator::write()` schickte bei disabled *immer* `inner_.write(meta().min)` nach unten. Da `inner_` der `IntervalActuator` war, überschrieb das dessen `target_` — der An-Anteil ging bei jedem Disable und jedem Slider-Drag während disabled verloren.
3. **Der eigentlich gefährliche Befund (erst beim Testschreiben aufgefallen):** Befund 2 war *load-bearing*. Behebt man ihn allein, bleibt `IntervalActuator::target_` beim Disable korrekt erhalten — und beim nächsten Phasenwechsel auf „an" treibt `tick()` den Ausgang wieder hoch, **an einem ausgeschalteten Master-Schalter vorbei**. `tick()` läuft weiter, `EnableGuardActuator` sitzt darüber und sieht diesen Pfad nie. Vorher war das nur deshalb harmlos, weil der korrumpierte `target_` zufällig `min` war.

**Konsequenz — die Reihenfolge war doch relevant (Korrektur einer früheren Einschätzung im Gespräch):** Ein autonom treibender Decorator kann nicht von einem Gate *über* ihm kontrolliert werden. Der Master-Schalter muss deshalb **hardware-nah nach innen**, das Zeitschema nach außen: **Interval(außen) → Enable(innen) → konkret**. Nicht angefasst: Binary als Basisklasse — die Sollwert/Ist-Wert-Unterscheidung ist `ValueKind`-unabhängig (Interval wrapt alle Arten) und gehört generisch auf `Actuator`.

### Library (SensActCtrl)

`core/Actuator.h`: zwei neue default-implementierte virtuelle Methoden, viertes Vorkommen des `fault()`/`enabled()`/`interval()`-Musters — `target()` (zuletzt kommandierter Wert, Default `state()`) und `forceOutput(v)` (physikalisch treiben, ohne als Sollwert zu zählen, Default `write(v)`). Keine bestehende Aktor-Klasse musste angefasst werden.

`EnableGuardActuator`: `target()` meldet `target_`. `write()` reicht nur noch bei `enabled_` nach unten (statt `min` durchzuschieben). **`forceOutput()` überschrieben und mit demselben Gate versehen** — das ist der Kern von Befund 3: als innerste Schicht filtert der Guard jetzt *jeden* von oben kommenden Wert, egal ob Nutzer-Sollwert oder Zeitschema. Der Wert wird dabei als `target_` mitgeführt, damit Re-Enable dort weitermacht, wo das Schema gerade steht. `setEnabled()`: Enable-Pfad über `write()` (echter Sollwert), Disable-Pfad über `forceOutput(min)`.

`IntervalActuator`: `target()` meldet `target_`; `tick()`-Phasenwechsel treibt über `forceOutput()` statt `write()`. `forceOutput()` selbst reine Durchreiche.

`RegistrySnapshot.cpp`: neues Feld `"target"` unconditional (analog `enabled`).

**Tests:** 141 → 146. Neu u. a. `test_disabled_master_survives_an_interval_phase_flip_back_on` (Master aus, Phase kippt auf „an" → Ausgang muss auf min bleiben) und `test_force_output_is_gated_by_the_master_switch`. Komposition-Tests auf die neue Reihenfolge umgestellt. **Gegenprobe durchgeführt:** Gate in `forceOutput()` testweise entfernt → beide Tests schlagen fehl (`Expected 0 Was 0.8`), Gate zurück → grün. Die Tests sind also nicht vacuous.

### Firmware (BrewControl)

`DynamicItems.cpp`, `addActuatorNoBegin()`: die zwei Wrap-Blöcke getauscht — erst `EnableGuardActuator` (Continuous-only, innen), dann `IntervalActuator` (Opt-in, außen). Sonst unverändert; `chain`-Vektor und Kind-Prüfung tragen beide Reihenfolgen (alle Decorator reichen `meta()` durch).

### Frontend (BrewControl/web)

`types.ts`: `Actuator.target: number` (nicht-optional, analog `enabled`). `ActuatorCard.tsx`: `BinaryToggle`/`ContinuousSlider`/`DiscreteInput` binden an `target` statt `state.v`; `state` dadurch in der Komponente ungenutzt → aus der Destrukturierung entfernt. **Bewusst unverändert:** `ControllerCard.tsx` und `resolveRef()` in `api.ts` (Charts/Logs) — die wollen den echten physikalischen Ist-Wert, damit die Taktung im Trend-Chart weiter als Rechtecksignal sichtbar bleibt.

### Verifikation

| Check | Resultat |
|---|---|
| `pio test -e native` (SensActCtrl) | 146/146 PASSED (141 alt + 5 neu) |
| Gegenprobe: Gate entfernt | 2 Tests FAILED wie erwartet, danach wieder grün |
| `pio run -e esp32dev` (BrewControl) | SUCCESS — 65.4 % Flash, 15.7 % RAM (unverändert) |
| `pnpm typecheck` | 0 Fehler |
| **HW-E2E (LilyGo T-Display-S3-AMOLED, geflasht über USB/COM9)** | **grün** — verifiziert am vorhandenen Test-Aktor `dfsdfdf` (AnalogOutput/PWM, Pin 3, Intervall 1 s/2 s; kein Pin-Konflikt mit `mlt`/Pin 2 oder `durchfluss`/Pin 9, Kessel und Pumpe unangetastet). (1) Master an, `v=0.8`: `state.v` taktet sauber 0 ↔ 0,8 im 1s/2s-Rhythmus, `target` steht konstant auf 0,8 — der Slider würde nicht mehr mitspringen. (2) Master aus: `state.v` bleibt über ~3,5 volle Zyklen durchgehend 0, `target` weiter 0,8 — **genau die Regression aus Befund 3, die ohne das `forceOutput()`-Gate aufgetreten wäre.** (3) Master wieder an: springt zurück auf 0,8 und taktet weiter. Aktor danach auf `v=0` zurückgesetzt; `mlt` liefert unverändert Werte (24,875 °C, `ok:true`). |

**Nebenbefund (nicht angefasst):** `state.t` wird im Frontend nirgends ausgewertet — der „stale"-Badge in `SensorCard.tsx` hängt an `state.ok`. `BrewControl/PLAN.md` beschreibt dort noch die ursprüngliche Idee `(now - state.t) > 5000`. Bei Aktoren ist `t` ohnehin nur der Serialisierungszeitpunkt (`millis()`), trägt also keine Information.

---

## 2026-08-19 — Aktor-Enable in die Actuator-Basisklasse (`EnableGuardActuator` entfällt)

**Ausgangslage:** Neuer Nutzer-Befund direkt nach dem gestrigen Fix: Bei einem Aktor mit Intervallbetrieb dauert es nach dem Wiedereinschalten des Master-Schalters 3-4 Sekunden, bis er tatsächlich schaltet. Ursachensuche legte einen tieferliegenden Konstruktionsfehler frei, der über den reinen Latenz-Bug hinausging.

**Diagnose:** `EnableGuardActuator` gated den *Wertefluss* (`write()`/`forceOutput()`), nicht die *Ausgabe an die Hardware*. Der Zeitplan schrieb bei jedem Phasenwechsel in `EnableGuardActuator::target_` (auch während disabled, um korrekt „bereit" zu bleiben) — beim Re-Enable wurde exakt dieser gerade aktuelle Phasenwert reappliziert. War die Phase zufällig „aus", wartete die Freigabe bis zum nächsten planmäßigen An-Fenster. Diskussion mit dem Nutzer (s. Transkript) verwarf zunächst zwei Reparaturvarianten am bestehenden Decorator (Zyklus-Neustart im `IntervalActuator` erzwingen — bricht die Unabhängigkeit der beiden Decorator-Klassen, `IntervalActuator` müsste `EnableGuardActuator`s internen Zustand kennen) und landete stattdessen bei der Idee des Nutzers: **`EnableGuardActuator` ersatzlos streichen.** `enabled_` wird konkreter State auf `Actuator` selbst — analog zu `Controller.h`, das exakt so schon lange kein `EnableGuardController` braucht. Jede konkrete Aktor-Klasse gated ihren eigenen Ausgang an der Stelle, wo sie tatsächlich Hardware anfasst; `tick()` läuft ungestört weiter.

**Präzisierung unterwegs:** „Kein Pin auf aktiv" trägt nicht für jede Klasse. Eine Machbarkeitsprüfung (Explore-Agent) ergab: `IdsActuator`/`RemoteActuator` sprechen ein Keep-Alive-Protokoll — den Aufruf auszulassen hieße „verstummen", nicht „aus"; sie müssen aktiv „0"/`min` senden. `PulseOutputActuator` darf `tick()` nicht einfach weiterlaufen lassen, sonst „verbraucht" die Pulsqueue Pulse, die nie physisch stattfanden — hier muss `tick()` einfrieren. Der allgemeine Vertrag lautet deshalb „bring dich selbst in deinen inaktiven Zustand", nicht „setz keinen Pin".

**Startzustand-Frage:** Damit der Master-Schalter bei Binary-Aktoren dieselbe Bedeutung hat wie bei Continuous, muss der Wert feststehen (`target=1`) und allein der Schalter entscheiden — sonst wäre `enabled=true` bei `v=0` wirkungslos. Konsequenz: ein Binary-Aktor **startet disabled** (Nutzer-Idee, um zu verhindern, dass ein Reboot ein Relais von selbst schließt).

### Library (SensActCtrl)

`core/Actuator.h`: `target()` bleibt (pure-virtual jetzt, `state()` hat einen Default `enabled_ ? target() : meta().min`). `forceOutput()` ist wieder entfallen. Neu: `setEnabled()` ruft bei echter Zustandsänderung `applyEnabled(bool)` (protected, Default no-op) — der Hook, den jede Klasse für ihr eigenes „sicher aus" überschreibt.

Pro konkreter Klasse (alle in `SensActCtrl/src/actuators/` + `src/remote/RemoteActuator`):
- **`DigitalOutputActuator`**: einziger `digitalWrite`-Aufruf steckt in `applyPin()` — ein `if (!enabled_) on = false;` deckt Binary **und** TimeProportional gleichzeitig ab. Binary-Konstruktor setzt jetzt `state_=1.0f, enabled_=false` (Startzustand s.o.).
- **`AnalogOutputActuator`**: `write()` in `applyOutput()` extrahiert, PWM/DAC-Raw wird aus `enabled_ ? state_ : valueMin_` berechnet.
- **`PulseOutputActuator`**: `tick()` steigt bei `!enabled_` sofort aus (Queue eingefroren, nichts wird „abgearbeitet"); `applyEnabled(false)` bricht einen laufenden Puls sauber ab (`setPin(false)`, `phase_=Idle`) statt den Pin auf aktiv hängen zu lassen.
- **`IdsActuator`**: `cooker_->Update()`-Aufruf bleibt (Keep-Alive!), Argument wird zu `enabled_ ? power_ : 0`; `applyEnabled()` setzt `nextTickMs_=0`, damit die Änderung sofort statt erst nach ≤500 ms greift.
- **`RemoteActuator`**: `write()`/`applyEnabled()` publizieren aktiv `enabled_ ? value : meta_.min` statt nur bei echten Writes zu senden.
- **`MockActuator`** (Test): gated jetzt ebenfalls, `outputs`-Vektor zusätzlich zu `writes` für Assertions auf „was kam wirklich an".

`IntervalActuator`: `forceOutput()`-Aufrufe zurück auf `write()`. Neues `setEnabled()`: reicht an `inner_` durch **und** startet bei der Flanke aus→an den Zyklus neu (`cycleStartMs_=millis()`, `onPhase_=true`, Ziel sofort angewendet) — das ist der eigentliche Fix für die 3-4 Sekunden. Ausnahme `onSec_==0` (dauerhaft-aus-Schema): kein Neustart, bliebe ohnehin sofort wieder aus.

Gelöscht: `EnableGuardActuator.{h,cpp}`, `test/test_enable_guard_actuator/` (9 Tests). `DynamicItems.h`: `ActuatorEntry.chain`-Vektor zurückgebaut auf `innerPtr` (Einzelfeld, spiegelt `CtrlEntry`) — nur noch maximal eine Decorator-Schicht (`IntervalActuator`, opt-in) möglich.

**Neue Tests:** `test_digital_output/` komplett neu (8 Tests — die Klasse hatte vorher gar keine eigene Suite), inkl. Startzustand, active-low, TPO-Duty-Überleben. `test_analog_output`: 2 neue (Gate + Write-während-disabled). `test_pulse_output`: 3 neue (Queue-Freeze, Pin-Release mitten im Puls, Writes-während-disabled werden nicht verloren). `test_interval_actuator`: Komposition-Tests gegen einen gate-fähigen `MockActuator` neu geschrieben, plus `test_reenable_restarts_the_cycle_and_switches_immediately` (der eigentliche Regressionstest) und `test_reenable_on_a_permanently_off_schedule_stays_off` (Edge-Case `onSec=0`). **Gegenprobe:** Gate in `DigitalOutputActuator::applyPin()` testweise entfernt → 4 Tests schlagen fehl, zurückgesetzt → grün.

### Firmware (BrewControl)

`DynamicItems.cpp`, `addActuatorNoBegin()`: `EnableGuardActuator`-Wrap-Block komplett entfernt; `IntervalActuator` bleibt die einzige optionale Schicht, schreibt jetzt in `e->innerPtr` statt `e->chain`.

### Frontend (BrewControl/web)

Jede Aktor-Karte hat jetzt genau einen ⏻-Schalter (vorher nur Continuous), und der sendet überall nur `{enabled}` — kein kind-abhängiges Request-Format. Bei Binary ersetzt der Schalter den bisherigen Wert-Toggle komplett (Wert steht serverseitig fest auf 1); das bisherige `ON`/`OFF`-Label bleibt, zeigt aber jetzt `state.v` (physikalischer Ist-Zustand) statt der Schalterstellung — bei regler- oder intervallgetriebenen Binary-Aktoren sieht man so Freigabe und Ist-Zustand nebeneinander. `ActuatorCard.tsx`: `BinaryToggle` → `BinaryState` (reine Anzeige, kein `onChange`); kind-Gate vor dem ⏻-Button entfernt; Dimmung (`opacity-60`) jetzt an `enabled` statt `meta.kind==='Continuous' && !enabled`; Discrete/Cumulative-Eingabe zusätzlich `disabled={!enabled}`. `types.ts`: Kommentar bei `enabled` aktualisiert (gilt für alle Arten).

### Wire-Format

`enabled` unverändert (schon vorher unconditional emittiert und angenommen — nur bisher wirkungslos für Nicht-Continuous). Kein neues Feld, keine Breaking Change am JSON-Schema.

### Verifikation

| Check | Resultat |
|---|---|
| `pio test -e native` (SensActCtrl) | 150/150 PASSED (146 alt − 9 gelöscht + 13 neu) |
| Gegenprobe: Gate in `applyPin()` entfernt | 4 Tests FAILED wie erwartet, danach wieder grün |
| `pio run -e esp32dev` (BrewControl) | SUCCESS — 65,4 % Flash |
| `pnpm typecheck` | 0 Fehler |
| **HW-E2E (LilyGo T-Display-S3-AMOLED, geflasht über USB/COM9)** | **grün.** Nach Flash: `pump` (Binary) kommt mit `enabled:false, target:1, state.v:0` — Relais aus, aber scharf, kein Reboot-Autostart. **Kernnachweis Re-Enable-Latenz:** `dfsdfdf` (AnalogOutput/PWM, Pin 3) auf 10 s an / 60 s Periode gestellt, in die Aus-Phase gewartet, Schalter aus dann sofort wieder an → Aktor reagiert nach **0,27 s** (reine HTTP-Poll-Rundlaufzeit) statt der vorher möglichen bis zu 50 s. `mlt`-Sensor unverändert grün (25,3 °C). |
| **Frontend-Deploy auf SD** | `pnpm build:sd` → `tar -C dist -cf ../webui.tar .` (unkomprimiert, `./`-relative Pfade, plain + `.gz`-Geschwister nebeneinander) → `POST /api/update/assets` (Multipart-Feld `f`) → Swap auf `/www.new`→`/www` im nächsten Loop-Tick, kein Reboot nötig. Im Browser gegen das Gerät verifiziert: `kettle`/`dfsdfdf` (Continuous) je ein ⏻ + Slider, `pump` (Binary) nur noch ein ⏻ + ON/OFF-Label, Intervall-Sub-Slider bei `dfsdfdf` weiterhin sichtbar. |

**Nebenbefund:** Während der Verifikation stand `dfsdfdf.target` unerwartet auf `0.16` statt dem zuletzt per Skript gesetzten `0` — vermutlich eine parallele Interaktion mit dem Live-Gerät (Browser/Display) während der Session, nicht untersucht, da unkritisch für die Verifikation und der Aktor ein Test-Objekt ohne reale Funktion ist.

---

## 2026-08-19 — MQTT-Einstellungen (externer + embedded Broker)

**Ausgangslage:** Roadmap-Punkt aus Welle 3 (vorgemerkt 2026-08-12). BrewControl hatte keinerlei MQTT-Verdrahtung — Neuentwicklung, kein Ausbau. Zwei Modi gefordert: externer Broker (Host/Port/Creds/TLS) über die bestehende `SensActCtrl::MqttTransport` und ein embedded Broker direkt auf dem ESP32.

### Architektur-Entscheidungen (Planungssession)

- **`martin-ger/uMQTTBroker`** (ursprünglich in der Roadmap genannt) läuft nachweislich **nicht auf ESP32** (offenes, nie beantwortetes GitHub-Issue) — verworfen zugunsten von **`hsaturn/TinyMqtt`** (Broker+Client in einer Lib, ESP32-fähig), davon aber **nur die Broker-Rolle**; der eigene Publish-Pfad bleibt auf `MqttTransport`/PubSubClient, verbunden auf `127.0.0.1` im embedded-Modus — ein einziger Publish-Code-Pfad für beide Modi.
- **TinyMqtt-Auth-Lücke:** am echten Quellcode (v1.1.3) verifiziert — `checkUser`/`checkPassword` sind privat/nicht-virtuell, Credentials hartcodiert `"guest"/"guest"`, kein Setter; zusätzlich ein vom Maintainer selbst als FIXME markiertes Loch (Verbindung ganz ohne Credential-Flags wird akzeptiert). Gelöst über ein **Build-Zeit-Patch-Skript** (`tinymqtt_patch.py`, PlatformIO `pre:`-Script analog zu `version_flags.py`) — kein Fork, patcht den lib-Cache bei jedem Build idempotent (Sentinel-Kommentar).
- **Live-Tracking von Add/Remove statt Boot-Snapshot:** `RemotePublisher` hielt rohe Pointer ohne `detach()` — bei Live-Tracking hätte ein zur Laufzeit gelöschter Sensor/Aktor zu Use-after-free geführt (State-Publish auf totem Pointer; stale Lambda-Closure in `MqttTransport`s Subscription-Liste bei Aktoren/Controllern). Gelöst durch echtes `detach()` in der Library (siehe unten) statt der ursprünglich geplanten Vereinfachung „nur beim Boot verdrahten".
- **Flash-Budget-Spike** (realer `pio run` auf allen 3 Boards, nicht geschätzt): TinyMqtt-Broker allein +4 KB, zusammen mit `MqttTransport`/PubSubClient +10 KB auf allen Boards — weit unter der ~85 %-Gefahrenzone. Ergebnis: **kein Board-Fallback nötig**, `BREWCTL_HAS_EMBEDDED_MQTT_BROKER=1` gilt für alle 3 Envs (`${common.build_flags}`, nicht mehr pro Env unterschiedlich wie ursprünglich geplant).

### SensActCtrl (Library)

- **`MqttTransport`**: Konstruktor um optionale `username`/`password`-Parameter erweitert (rückwärtskompatibel, Default `""`); `attemptConnect_()` nutzt bei gesetztem Username PubSubClients `connect(id, user, pass)`-Überladung.
- **`ITransport`**: neue Methode `unsubscribe(topic)` mit nicht-brechendem Default (`{ return false; }`) — gleiches Muster wie seinerzeit `fault()` auf `Sensor`/`Actuator`. `MqttTransport` und `MockTransport` überschreiben sie (Eintrag aus der Subscription-Liste entfernen).
- **`RemotePublisher`**: neue `detach(const Sensor&)/detach(const Actuator&)/detach(const Controller&)` — entfernen passende Einträge per Pointer-Identität (bei Multi-Channel-Sensoren alle Kanäle), rufen für Aktor/Controller vorher `transport_->unsubscribe()` auf die Set-/Tune-Topics (entfernt die Closure, die sonst nach dem Löschen auf einen toten Pointer zeigen würde).
- **5 neue native Tests** in `test_remote.cpp` (Sensor-Detach stoppt State-Publish, Multi-Channel-Detach entfernt alle Kanäle, Aktor-Detach entfernt Subscription — direkter Beweis gegen den Use-after-free, Controller-Detach analog, Re-Attach nach Detach republiziert Meta korrekt). **150 → 155 native Tests grün.**

### BrewControl Firmware

- **`SettingsStore`**: vierte Sektion `mqtt` (enabled, mode, host, port, username, password, tls, clientId, topicPrefix) nach dem exakten Muster von `theme`/`firmware`/`time`; `serialize()` ergänzt read-only `embeddedBrokerSupported` (aus dem Compile-Flag).
- **`WebUI.cpp`**: vierter Validierungsblock in `POST /api/settings` (mode-Enum, Port-Range, `embedded` wird ohne Board-Capability mit 400 abgelehnt).
- **`DynamicItems`**: sechs optionale Hook-Setter (`setOnSensorAdded/Removing` usw., analog zum bestehenden `resetFn`-Pro-Item-Muster) — feuern in `addSensor/addActuator/addController` nach `begin()` bzw. in `removeSensor/removeActuator/removeController` unmittelbar vor dem jeweiligen `erase()` (Objekt zu dem Zeitpunkt noch gültig).
- **Neue Klasse `MqttService`** (`#ifdef ARDUINO`-Guard wie `IdsActuator.h`): baut je nach Modus einen embedded `TinyMqtt::MqttBroker` (+ `setAuth()` aus dem Patch) oder direkt den externen `WiFiClient`/`WiFiClientSecure`-Pfad auf (TLS via `setInsecure()`, gleiches Muster wie `FirmwareUpdater`), attacht beim Boot alle vorhandenen Registry-Items, registriert danach die `DynamicItems`-Hooks für Live-Tracking (Attach+erneutes `begin()` bei Add, `detach()` bei Remove — `begin()` ist idempotent, daher kein separater „publish one"-Pfad nötig).
- **`main.cpp`**: globale `MqttService`-Instanz, `begin()` nach `registry.begin()`/`dynamicItems.markInitialized()` (Hooks müssen stehen, bevor die Web-API Add/Remove bedienen kann), `tick()` in `loop()`.
- **`tinymqtt_patch.py`** + `platformio.ini`: TinyMqtt (`hsaturn/TinyMqtt.git#1.1.3` — PIO-Registry-Version 0.9.18 ist veraltet) + Patch-Script in `${common}`.

### Frontend

- `types.ts`: `MqttSettings`-Interface, `mqtt?` auf `AppSettings`.
- Neue Seite `pages/MqttPage.tsx` — **umgebaut nach Praxistest** (s.u.) auf das `NetworkPage.tsx`-mDNS-Muster statt `TimePage.tsx`/`AppearancePage.tsx`: Felder werden nur lokal editiert (kein Auto-Save pro Feld), ein einzelner „Speichern & Neustart"-Button (disabled bis sich etwas geändert hat, Diff via `JSON.stringify`) öffnet ein `ConfirmModal`, danach Vollbild-Reboot-Screen. Grund: die MQTT-Verbindung wird ohnehin nur beim Boot aufgebaut — ein Button, der explizit speichert *und* neu startet, ist ehrlicher als Auto-Save + passiver Hinweis-Banner. `WebUI.cpp`s `POST /api/settings`-Handler löst jetzt `rebootAtMs_` aus, wenn die Anfrage eine `mqtt`-Sektion enthält (analog zu `/api/network`). Modus-Segmented blendet „Eingebaut" aus wenn `embeddedBrokerSupported===false`, Host/Port/Zugangsdaten/TLS je nach Modus, Port springt beim TLS-Toggle zwischen 1883/8883 wenn noch auf Default.

**Praxistest (User, 2026-08-19):** Erfolgreich mit dem embedded TinyMqtt-Broker verbunden — sowohl mit als auch ohne Auth (bestätigt, dass der Build-Zeit-Patch die Zugangsdaten-Prüfung korrekt durchsetzt, wenn `setAuth()` gesetzt ist, und weiterhin offen bleibt, wenn nicht). Daraufhin Wunsch nach dem expliziten Speichern-&-Neustart-Button (s.o.), umgesetzt und gegen den Live-Zustand des Geräts (via Vite-Dev-Proxy) verifiziert: Seite lädt echte Gerätewerte (`enabled:true, mode:"embedded"` aus dem manuellen Test), Button korrekt disabled ohne Änderung, aktiviert sich nach Edit, Modal zeigt korrekten Text, Cancel verwirft ohne Seiteneffekt.
- Routing (`app.tsx`) + Hub-Eintrag (`SettingsIndex.tsx`, Icon `Radio`) unter `/settings/mqtt`.

### Verifikation

| Check | Resultat |
|---|---|
| `pio test -e native` (SensActCtrl) | 155/155 PASSED (150 alt + 5 neu Detach) |
| Flash-Spike (real gemessen, alle 3 Boards) | Baseline → +10 KB kombiniert, weit unter 85 % |
| `pio run` alle 3 Envs, vollständige Implementierung | esp32dev 67,2 %, lolin_s2_mini 64,0 %, LilyGo S3 19,1 % — SUCCESS |
| TinyMqtt-Patch: Anwendung + Idempotenz | verifiziert (zweiter Build-Lauf patcht nicht erneut, kein Fehler) |
| `MqttTransport`-Signatur (4-Arg alt + 6-Arg neu) | gegen echten Toolchain-Pin kompiliert (Spike in main.cpp, reverted) |
| `pnpm typecheck` + `pnpm build` (BrewControl/web) | 0 Fehler |
| Browser-Verifikation (Dev-Server, kein Live-Gerät) | `/settings/mqtt` lädt, Enable-Toggle klappt Formular auf, Modus/Host/Port/Zugangsdaten/TLS korrekt gerendert, TLS-Toggle springt Port 1883→8883, `/settings`-Hub zeigt neuen Eintrag, keine Konsolenfehler |

**Negativtest bestätigt (User, 2026-08-20):** Verbindung zum embedded Broker ganz ohne `-u`/`-P` bei aktivierter Auth wird korrekt abgelehnt — der TinyMqtt-Patch schließt die FIXME-Lücke damit nachweislich, nicht nur der Erfolgspfad (Creds korrekt / Auth aus) war schon verifiziert.

**Offen (HW-E2E):** externer Broker mit echtem Mosquitto/Home-Assistant (mit/ohne TLS), Live-Tracking am echten Gerät (Sensor zur Laufzeit hinzufügen/löschen, kein Crash).

### Nebenbefund beim ersten Flash-Versuch: SD-Concurrency-Bug gefunden + gefixt (2026-08-19/20)

Beim ersten Versuch, Firmware **und** UI auf das LilyGo-S3-Testgerät zu bringen: Firmware-Flash über USB lief jedes Mal sauber, aber `POST /api/update/assets` (UI-Tar-Upload) schlug reproduzierbar mit `extract failed` fehl — nach genauerem Debuggen (temporäre `Serial.printf`, danach vollständig zurückgesetzt) zeigte `TarExtractor::errorMsg()` `"write failed"`. Tar-Format als Ursache ausgeschlossen (GNU **und** explizites ustar getestet, Header-Bytes per `xxd` verifiziert). Kein Zusammenhang mit dem MQTT-Code — der Upload-Pfad wurde dabei nicht verändert.

Für die eigentliche Ursachenklärung an einen Subagent delegiert (`spawn_task`, Session `local_425c3ad9…`, eigener Worktree). Befund: **`loopTask` (Regler-/Logging-/Config-Persistenz) und `async_tcp` (jeder HTTP-Handler, inkl. Tar-Upload) griffen unsynchronisiert auf den nicht thread-sicheren SD/SdFat-Treiber zu** — die Kollision korrumpierte den Treiberzustand, oft dauerhaft bis zum Reset. Passte exakt zum beobachteten Muster (Schreiben schlägt fehl, nicht Öffnen; erster Versuch nach Boot manchmal ok, danach konsistent kaputt).

**Fix (PR #16, `bcf8ea2`, gemergt):** neuer globaler rekursiver Mutex `BrewControl/firmware/src/SdLock.h`, granular um jede einzelne SD-Operation gelegt (nicht um ganze Transfers), damit `loopTask` nie länger als einen einzelnen SD-I/O-Call blockiert. Angewendet in `SdTarSink`, `WebUI`, `FirmwareUpdater`, `LogStore`, `ProgramRunner`, `DynamicItems`, `SettingsStore`, `DashboardStore`. Nebenbei: `swapAssets_()` loggt jetzt einen fehlgeschlagenen `rename()` statt ihn zu verschlucken. Bekannte, bewusst offen gelassene Lücke: `serveStatic`/Log-CSV-Downloads laufen über ESPAsyncWebServers eigene SD-Lesekette außerhalb direkter Kontrolle, bleiben ungeschützt (kleineres Risiko — kurze Einzel-Reads statt langer Schreibserien).

**Merge + finale Verifikation:** lokale MQTT-Änderungen gestasht, `origin/main` (mit dem SD-Fix) per Fast-Forward gepullt, Stash zurückgespielt — sauberer Auto-Merge, keine Konflikte trotz Überlappung in `SettingsStore.cpp`/`WebUI.cpp`/`DynamicItems.cpp`. Danach kompletter Durchlauf: 155/155 native Tests, alle 3 Firmware-Envs SUCCESS (esp32dev 67,3 %, lolin_s2_mini 64,1 %, LilyGo S3 19,1 % Flash), `pnpm typecheck`/`build:sd` grün, geflasht auf COM9. **Repro-Test bestanden:** 5 Tar-Uploads hintereinander ohne Reset — alle 5× `HTTP 200`/`ok` (vorher spätestens beim zweiten Versuch zuverlässig fehlgeschlagen). Live-Gerät liefert danach bestätigt die neu gebaute UI aus (`index-DplkaDnS.js`/`index-CfaBl7O3.css`, beide `200`) — die MQTT-Settings-Seite ist damit erstmals tatsächlich auf dem Gerät erreichbar.

Commit: `0f85bb0` „feat: MQTT-Einstellungen (externer + embedded Broker)" (main, gepusht).
