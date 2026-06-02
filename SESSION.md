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
