# Brauerei Session-Archiv

Ausgelagerte, abgeschlossene Session-Einträge — der aktuelle Stand steht in
[`PLAN.md`](PLAN.md), kurze chronologische Verweise in [`SESSION.md`](SESSION.md).
Hier die volle Detail-Historie, unverändert übernommen. Konsolidiert am
2026-08-31 aus den vormals getrennten Logs von SensActCtrl (`PLAN.md`/`session.md`),
BrewControl (`PLAN.md`/`SESSION.md`/`SESSION-archive.md`) und diesem Root-Log.

---

## SensActCtrl: Phase 1–3 Aufbau (2026-05-16 – 2026-06-03)

Stand: 2026-05-17. Greenfield-Start; PLAN.md vorgegeben, **Phase 1 + 2 +
Phase 3 (Items 10–12) komplett**: `EspNowTransport`, `WebhookTransport`
und `Registry`-JSON-Snapshot implementiert. Native Tests grün (31/31),
ESP32-Compile-Smoke aller 13 Beispiel-Targets grün. Hardware-Smoke-Tests
vom User explizit verschoben (kein Mikrocontroller).

**Diese Session (2026-05-17):**

1. **Phase-3-Item 12 (`Registry`-JSON-Snapshot)**:
   - `src/core/RegistrySnapshot.{h,cpp}` — freie Funktion
     `serializeRegistry(const Registry&, char* buf, size_t cap) → size_t`.
     Bewusst nicht in `Registry` selbst, damit `Registry.h` Arduino- und
     ArduinoJson-frei bleibt.
   - Output-Shape (ein Top-Level-Objekt):
     ```json
     {"sensors":[{"id":..,"meta":{..},"state":{"v":..,"t":..,"ok":..}}],
      "actuators":[{"id":..,"meta":{..},"state":{"v":..,"t":..,"ok":..}}],
      "controllers":[{"id":..,"setpoint":..,"params":{..}}]}
     ```
     Sub-Schemas identisch zum MQTT-Wire-Format (`MetaJson.cpp`), sodass
     Frontends die existierenden Parser wiederverwenden können. Wichtig:
     Controller-`params` wird als nested JsonObject eingebettet, **nicht**
     als String — `paramsJson()` wird intern via `deserializeJson` re-parsed
     und per `obj["params"] = paramsDoc` kopiert. Frontend addressiert
     Felder direkt (z.B. `params.Kp`).
   - Truncation-Schutz: `measureJson(doc) + 1 > cap → return 0`. Callers
     lesen nie truncated JSON.
   - `SensActCtrl.h` um neuen Header erweitert.
   - `test/test_snapshot/test_snapshot.cpp` — 4 Cases:
     leere Registry → leere Arrays / Sensor+Actuator Meta+State /
     Controller `params` als nested Object (nicht String) /
     `cap` zu klein → 0.
   - Native Tests: **31/31** grün (vorher 27 + 4 neue).
   - ESP32-Sanity-Build von `01_local_twopoint_heater` für `esp32dev`:
     OK (RAM 6.9 %, Flash 21.3 %).

2. **Phase-3-Item 11 (`WebhookTransport`)**:
   - `src/transport/WebhookTransport.{h,cpp}` — HTTP-Webhook-Transport,
     gleiches Wire-Format wie MQTT/EspNow (reuse `Topics.h` + `MetaJson`).
     URL-Mapping: `publish(topic, payload, retained)` → HTTP-POST an
     `${peerBaseUrl}/${topic}` mit `X-Retained:1`-Header bei retained.
     Eingehende POSTs an `/${topic}` werden gegen `subs_` gematcht und
     dispatched (Pfad ohne führenden `/` ist der Topic-String).
   - Retain-Emulation: lokaler Cache (`retained_`), Server liefert GET
     `/${topic}` → letzter cached Payload. `subscribe()` queued ein
     RetainedPull, `tick()` führt pro Tick max. einen blocking
     `HTTPClient::GET` aus → Response-Body landet im Subscribe-Callback,
     identisch zum POST-Pfad. Late-Subscriber sieht so meta + state
     sofort, analog zu MQTT retained und EspNow `RetainedRequest`.
   - Server: ESP32-Core-`WebServer` (sync). `tick()` ruft `handleClient()`.
     `ensureServerStarted_()` startet den Server lazy beim ersten `tick()`
     mit `WiFi.isConnected() == true`. Routen via `onNotFound`-Lambda
     (captures `this`; keine globalen statics nötig — pro Instanz eigener
     Port).
   - `connected()` reflektiert reines `WiFi.isConnected()`. Kein
     Reconnect-Loop — `publish()`/`GET` schlagen still fehl wenn WiFi
     down, Recovery passiert beim nächsten Aufruf nach Reassociation.
   - **Keine zusätzlichen `lib_deps`** — `HTTPClient` und `WebServer`
     sind beide Teil des Arduino-ESP32-Cores.
   - Native-Stub im selben `.cpp` (`#if defined(ARDUINO)`/`#else`).
   - Beispiel `10_remote_webhook/{publisher,consumer}/` parallel zu
     `08`/`09`, jeder Knoten kennt die Peer-URL via Const. README mit
     `curl`-Cookbook für GET `/meta` und POST `/tune`.
   - Compile-Smoke `10/publisher` + `10/consumer` für `esp32dev`: 2/2 OK.
   - Native Tests bleiben grün (27/27); Webhook ist Arduino-only,
     `test_remote` verifiziert Retain-Verhalten weiterhin transport-
     agnostisch über `MockTransport`.

**Frühere Session (2026-05-16):**

1. Lückenschluss-Sketch `04_bme280_logger` ergänzt — drei `BME280Sensor`-
   Channels (T/H/P) hinter einem geteilten `BME280Bus(0x76)` + `Wire.begin()`,
   sekündliches Serial-Log, analog zum Stil von 01/05.
2. ESP32-Compile-Smoke aller 7 Phase-1-Beispiele via `pio ci ... -b esp32dev`
   durchgezogen. Erstbau brachte drei reale Fehler, alle behoben:
   - **`lily-osp/AutoTunePID @ *` nicht in PIO-Registry** — `library.json`
     auf Git-URL umgestellt: `https://github.com/lily-osp/AutoTunePID.git#v1.1.6`
     (Tag-Pin für Reproduzierbarkeit).
   - **`Adafruit_BME280` braucht `Adafruit BusIO`** — fehlte transitiv,
     `adafruit/Adafruit BusIO@^1.16.1` als Dep ergänzt.
   - **`*Meta`-Brace-Init bricht unter C++11** — Default-Member-Initialisierer
     in `SensorMeta.h`/`ActuatorMeta.h` entfernt, damit die Structs unter
     Arduino-Default (gnu++11) wieder echte Aggregates sind. Native (gnu++17)
     wäre toleranter gewesen, daher rutschte das durch die Tests durch.
     Alle Construct-Sites verwenden ohnehin volle Brace-Init mit allen
     6 Feldern; `SensorMeta m{};` value-init'd weiterhin auf null.
3. **Phase 2 komplett**:
   - `src/transport/ITransport.h` — Interface (`publish`/`subscribe`/`tick`/
     `connected`), `std::function`-Callback für Captures, persistente
     Subscriptions (Transport-Impl re-subscribed nach Reconnect).
   - `src/transport/MqttTransport.{h,cpp}` — `PubSubClient`-Wrapper.
     Reconnect mit Exponential-Backoff (1 s → 30 s Cap). Single-Dispatcher
     via `g_active`-Pointer (PubSubClient hat statisches Callback). Header
     ist Arduino-frei (Forward-Decl von `Client` + `PubSubClient`); native
     Stub-Path liefert lauter `false`, sodass die TU link-safe ist.
   - `src/remote/MetaJson.{h,cpp}` — Wire-Format-Helfer (serialize/parse
     Meta + State + Set-Command), nutzt ArduinoJson v7 (`JsonDocument`).
   - `src/remote/Topics.h` — zentraler Topic-Builder, `SensActCtrl/<dev>/...`.
   - `src/remote/RemoteSensor.{h,cpp}` + `RemoteActuator.{h,cpp}` —
     proxies; `begin()` subscribed `meta` + `state` (retained → späte
     Subscriber sehen Vorgängerwerte sofort). `RemoteActuator::write(v)`
     publisht auf `/set`, `state()` reportet das vom Remote-Knoten
     gemeldete State.
   - `src/remote/RemotePublisher.{h,cpp}` — `attach(Sensor|Actuator|
     Controller)`. `begin()` subscribed für Aktoren `/set` und Controller
     `/tune`, dann erstes retained Meta-Pub. `tick()` re-publisht State
     mit konfigurierbarer Cadence (Default 1 s; auf 0 setzbar für Tests)
     und erneuert alle Metas nach Reconnect. Controller-`/meta` enthält
     `paramsJson` und wird nach jedem akzeptierten `/tune` aktualisiert.
   - `test/mocks/MockTransport.h` — In-Memory-Pub/Sub mit Retained-Replay,
     match per Exact-Topic.
   - `test/test_remote/test_remote.cpp` — 5 Round-Trip-Cases (Sensor-State,
     Aktor-Set → lokales `write`, Aktor-State-Report, Meta-Retained-Replay
     für späten Subscriber, Controller-Tune → setpoint+meta-Republish).
   - `examples/08_remote_mqtt/{publisher,consumer}/` — zwei Sketches.
     Publisher (`node-a`) owned DS18B20 + heater; Consumer (`node-b`)
     bindet `RemoteSensor` + `RemoteActuator` in lokalen `PIDController`
     und publisht den Controller selbst, sodass er per `/tune` erreichbar
     ist. README mit `mosquitto_sub/pub`-Cookbook.
4. Native Tests nach Phase-2-Code grün: **27/27** (22 Phase-1 + 5 `test_remote`).
5. Full Compile-Smoke (7 Phase-1 + 2 Phase-2-Sketches) für `esp32dev`: 9/9 OK.
6. **Phase-3-Item 10 (`EspNowTransport`)**:
   - `src/transport/EspNowTransport.{h,cpp}` — broadcast-only ESP-Now-Transport,
     gleiches Wire-Format wie MQTT (reuse `Topics.h` + `MetaJson`), eigenes
     1-Byte-Framing: `0x01` = Daten-Paket `[len][topic][payload]`, `0x02` =
     RetainedRequest. Retain-Emulation lokal: `publish(retained=true)` cached
     in `map<topic,payload>`; `subscribe()` triggert (throttled, max 1×/s) ein
     `RetainedRequest`-Broadcast, alle Publisher antworten mit Re-Broadcast
     ihres Caches → späte Subscriber sehen Meta + State sofort.
   - 250-B-ESP-Now-Limit respektiert (`sendDataPacket_` bricht früh ab).
   - Single-Dispatcher via `g_active` (wie `MqttTransport`).
   - Native-Stub im selben `.cpp` (`#if defined(ARDUINO)`/`#else`).
   - Beispiel `09_remote_espnow/{publisher,consumer}/` parallel zu `08`,
     aber ohne WiFi/Broker. README mit Channel-Hinweis und Packet-Budget-
     Erläuterung.
   - **Keine zusätzlichen `lib_deps`** — ESP-Now ist Teil des Arduino-ESP32-
     Core (`<esp_now.h>`, `<esp_wifi.h>`).
   - Compile-Smoke `09/publisher` + `09/consumer` für `esp32dev`: 2/2 OK.
   - Native Tests bleiben grün (27/27); EspNow ist Arduino-only, `test_remote`
     verifiziert Retain-Verhalten weiterhin generisch über `MockTransport`.

## Status pro Plan-Schritt

| Schritt | Status | Verifikation |
|---|---|---|
| 1. Library-Skeleton | ✅ | `library.json`, `library.properties`, `platformio.ini`, `src/SensActCtrl.h`, `README.md` |
| 2. Core | ✅ | `Reading`, `ValueKind`, `Quantity`, `SensorMeta`, `ActuatorMeta`, `Sensor`, `Actuator`, `Controller`, `Registry` — `test_registry` grün |
| 3. Controller | ✅ | `TwoPointController` + `PIDController` (AutoTunePID-Wrapper) — `test_twopoint`, `test_pid` grün |
| 4. Aktoren | ✅ | `DigitalOutputActuator` (binär + TPO), `PulseOutputActuator` — `test_pulse_output` grün |
| 5. Sensoren | ✅ | `DigitalInput`, `AnalogInput`, `PulseCounter`, `DS18B20`, `BME280` — `test_analog_calibration` grün |
| 6. Beispiele | ✅ | 13 Targets (`01`..`07` + `08_remote_mqtt/{publisher,consumer}` + `09_remote_espnow/{publisher,consumer}` + `10_remote_webhook/{publisher,consumer}`) bauen für `esp32dev` per `pio ci`. HW-Smoke-Tests bewusst verschoben. |
| 7. Transport | ✅ | `ITransport` + `MqttTransport` (PubSubClient-Wrapper, Reconnect-Backoff). Native Stub. |
| 8. Remote | ✅ | `RemoteSensor`, `RemoteActuator`, `RemotePublisher` (Meta-Austausch, `/set`, `/tune`, Retained-Replay) — `test_remote` grün (5 Cases). |
| 9. Beispiel 08 | ✅ (Code) | `08_remote_mqtt/{publisher,consumer}` + README mit `mosquitto`-Cookbook. |
| 10. EspNowTransport | ✅ | `src/transport/EspNowTransport.{h,cpp}` (Broadcast, Retain-Emulation via RetainedRequest, 250-B-Framing). Beispiel `09_remote_espnow/{publisher,consumer}` baut für `esp32dev`. |
| 11. WebhookTransport | ✅ | `src/transport/WebhookTransport.{h,cpp}` (HTTP-POST out via `HTTPClient`, sync `WebServer` in, Retain-Emulation via local cache + GET `/<topic>`). Beispiel `10_remote_webhook/{publisher,consumer}` baut für `esp32dev`. |
| 12. Registry-JSON-Snapshot | ✅ | `src/core/RegistrySnapshot.{h,cpp}` — freie Funktion `serializeRegistry()`. Wire-Format kompatibel zu MQTT-Topics; Controller-`params` als nested Object (Frontend-freundlich). `test_snapshot` grün (4 Cases). |

**Native Tests:** `pio test -e native` → **31/31 passed** in ~21 s.

## Abweichungen vom Plan

- **WebhookTransport-Server:** PLAN.md spricht von „einfachem AsyncWebServer";
  implementiert ist sync `WebServer` aus dem ESP32-Arduino-Core. Vorteil:
  null neue `lib_deps` (`AsyncTCP` + `ESPAsyncWebServer` entfallen). `tick()`
  ruft `handleClient()` poll-basiert — bei den hier üblichen Cadenzen
  (~1 Hz Publish, gelegentliche Tune-Requests) reicht das problemlos.
  Falls später eine Last entsteht, die parallele Requests rechtfertigt,
  kann auf `ESPAsyncWebServer` gewechselt werden, ohne dass das
  Wire-Format oder die `ITransport`-API sich ändert.
- **HTTPClient::POST-Overload:** Die Bytes-Variante
  `POST(uint8_t*, size_t)` nimmt non-const `uint8_t*`, was mit
  `const char*` payload kollidiert. Wir nutzen den `String`-Overload —
  Allokation pro publish ist bei unseren kleinen Payloads (Meta ~150 B,
  State ~50 B) vernachlässigbar.
- **AutoTunePID-API:** Real-Library hat kein `isAutotuneRunning()/isAutotuneDone()`
  und der Tuning-Wert heißt `LambdaTuning` (nicht `Lambda`). Wrapper baut
  Statusmethoden über `getOperationalMode()` (Tune-Modus → läuft; Wechsel
  zurück nach Normal → fertig). Unser eigenes `enum TuningMethod` listet
  `LambdaTuning` 1:1.
- **PID-Native-Fallback:** `PIDController.cpp` enthält einen kleinen
  handgeschriebenen PID (Path: `#if !defined(ARDUINO)`), damit native Tests
  ohne AutoTunePID/Arduino laufen. Wrapper-API ist identisch; AutoTune-Lauf
  selbst wird laut Plan an realer Last verifiziert (Sketch `03_pid_autotune`).
- **`platformio.ini`:** Top-Level `src_dir = examples/...` entfernt — PIO
  konnte sonst Library vs. App nicht unterscheiden, Test-Build zog die
  Library-`.cpp` nicht. Setup jetzt: `[platformio]` leer, nur
  `[env:native]` mit `test_build_src = yes` und `-Isrc`. ESP32-Beispiele
  werden über `pio ci examples/<name> -l . -b esp32dev` gebaut (im
  platformio.ini-Kopfkommentar dokumentiert).

## Native-Toolchain-Setup (einmalig in dieser Session erledigt)

Beim ersten Versuch war PlatformIO + Compiler nicht funktionsfähig:

1. **PlatformIO Core neu installiert.** Altes `~/.platformio/penv` zeigte auf
   verschwundenen Python — umbenannt zu `penv.broken-20260515133021`. Frisch
   via `get-platformio.py` → `~/.platformio/penv/Scripts/platformio.exe`.
2. **MinGW-w64 14.2 (UCRT, posix, SEH) portable** entpackt nach
   `~/.platformio/mingw64`. Quelle:
   `niXman/mingw-builds-binaries` Release `14.2.0-rt_v12-rev2`. Wird nicht
   in den System-PATH gehängt — nur Ad-hoc beim Test-Aufruf.

## Tests starten

```powershell
$env:PATH = "$env:USERPROFILE\.platformio\mingw64\bin;$env:PATH"
& "$env:USERPROFILE\.platformio\penv\Scripts\platformio.exe" test -e native
```

## Addendum 2026-05-20 — DS18B20::scanBus

Im Rahmen des BrewControl Bus-Discovery-Features wurde `DS18B20Sensor` um eine
statische Methode ergänzt:

```cpp
static uint8_t scanBus(int pin, uint8_t out[][8], uint8_t maxDevices);
```

Erstellt temporäre `OneWire`+`DallasTemperature`-Instanz, enumeriert via
`getDeviceCount()`/`getAddress()`, gibt ROM-Adressen zurück. Arduino-only
(`#if defined(ARDUINO)`); native-Build-Stub gibt 0. Kein neuer nativer Test
(hardware-only). Native Tests weiterhin 31/31.

## Sammel-Nachtrag 2026-05-21 – 2026-06-03

Die detaillierte, chronologische Cross-Projekt-History ab hier liegt im
**Root-`SESSION.md`** (Library-Änderungen wurden überwiegend zusammen mit
BrewControl-Änderungen gemacht). Hier nur die Library-relevanten Eckpunkte:

- **Multi-Channel-Sensor-Interface (Breaking Change):** `Sensor`-API von
  `meta()` + `lastReading()` auf `channelCount()` + `channel(size_t)` mit neuem
  `Channel`-Struct (`key`, `SensorMeta`, `Reading`) umgestellt. `RegistrySnapshot`
  expandiert Multi-Channel-Sensoren zu Composite-IDs (`"flow.rate"`/`"flow.volume"`).
  Alle Beispiel-Sketches mitmigriert.
- **Neue Sensoren:** `MAX31865Sensor` (PT100/PT1000, SPI), `YF_S201Sensor`
  (Durchfluss + Volumen, 2 Kanäle), `HCSR04Sensor` (Ultraschall, 2 Kanäle:
  distance + derived), `HX711LoadCellSensor` (Wägezelle, eigener Bit-Bang-Treiber).
- **Neue Aktoren:** `AnalogOutputActuator` (PWM/DAC, `SENSACTCTRL_HAS_DAC`-Guard
  für S2/S3), `IdsActuator` (IDS1/IDS2 Induktionskocher, wrappt externe
  `IdsInductionCooker`-Lib, Arduino-only).
- **`fault()`-Interface:** nicht-brechende Default-Methode auf `Sensor` + `Actuator`;
  `RegistrySnapshot` emittiert `"fault"` nur wenn gesetzt.
- **Controller-Basisklasse:** `setEnabled(bool)` / `enabled()`; alle Controller
  respektieren den Guard in `tick()`, `enabled` in JSON.
- **Neue Controller (Gärsteuerung, dual-output 1 Sensor → 2 Aktoren):**
  `DualStageController` (Bang-Bang Heizen+Kühlen, Anti-Short-Cycle auf der
  Kühlstufe, optionale Umschalt-Totzeit) und `SplitRangePIDController` (bipolarer
  PID −1..+1, positiv heizt/negativ kühlt). Beide: Fail-safe→beide-aus,
  strukturelle Mutual-Exclusion + Interlock.
- **PID-Engine extrahiert:** der AutoTunePID-Wrapper + native Fallback-PID liegt
  jetzt in `src/controllers/detail/PidEngine.{h,cpp}` (von `PIDController` **und**
  `SplitRangePIDController` geteilt); `TuningMethod` in eigenem Header
  `controllers/TuningMethod.h`. Include-Hygiene: AutoTunePID erreicht die Umbrella
  nicht (Regler-Header halten nur `detail::PidEngine*` forward-declariert).
- **AutoTune über Web:** `PIDController` **und** `SplitRangePIDController` lösen
  AutoTune über `setParamsJson` aus (Kommando-Feld `"autotune":"start"|"stop"`,
  `stopAutotune()`, Auto-Enable). Real-Tuning hardware-only (nativ No-Op).
- **`RemotePublisher` Multi-Channel + konfigurierbares Topic-Prefix** (per-Channel-
  Topics; Flat-Topic-Backward-Compat für Single-Channel-Sensoren).

**Native Tests:** 31 → **109/109** (u.a. test_max31865, test_yf_s201, test_hcsr04,
test_hx711, test_analog_output, test_dualstage, test_splitrange + erweiterte
test_pid/test_snapshot/test_remote).

## Offene Punkte

- **Hardware-Smoke-Tests** aus PLAN.md (PLAN §Verifikation) — verschoben bis
  Mikrocontroller verfügbar. Betrifft alle Beispiele inkl. der drei
  Remote-Sketches (`08` braucht zwei ESP32 + Broker; `09` braucht zwei
  ESP32 auf gleichem Channel; `10` braucht zwei ESP32 im selben LAN).
  - Emulator-Pfad (Wokwi-CLI) wurde diskutiert, aber Pro-Plan ($25/Mo) nötig
    → ausgelassen. Free-Tier-interaktive-Sim via `diagram.json` bleibt
    als Option im Hinterkopf, falls später gewünscht.
- **Phase 3 komplett.** Items 10 (`EspNowTransport`), 11 (`WebhookTransport`)
  und 12 (`Registry`-JSON-Snapshot) erledigt. Der eigentliche Web-Frontend
  ist explizit nicht Teil von PLAN.md und bleibt offen.
- **CI-Wrapper-Skript** (`scripts/build-all.ps1` o.ä.) — derzeit manuell
  sequenziell aus PowerShell. Optional formalisieren, falls CI dazukommt.

## Dateibaum (Stand 2026-06-03)

```
SensActCtrl/
├── library.json
├── library.properties
├── platformio.ini
├── README.md
├── PLAN.md
├── session.md
├── src/
│   ├── SensActCtrl.h
│   ├── core/         (Reading, Channel, ValueKind, Quantity, *Meta, Sensor/Actuator/Controller, Registry, RegistrySnapshot)
│   ├── controllers/  (TwoPointController, PIDController, DualStageController, SplitRangePIDController, TuningMethod.h, detail/PidEngine)
│   ├── actuators/    (DigitalOutputActuator, PulseOutputActuator, AnalogOutputActuator, IdsActuator)
│   ├── sensors/      (DigitalInput, AnalogInput, PulseCounter, DS18B20, BME280, MAX31865, YF_S201, HCSR04, HX711LoadCell)
│   ├── transport/    (ITransport, MqttTransport, EspNowTransport, WebhookTransport)
│   └── remote/       (Topics, MetaJson, RemoteSensor, RemoteActuator, RemotePublisher)
├── examples/         (01..07 + 08_remote_mqtt/{p,c} + 09_remote_espnow/{p,c} + 10_remote_webhook/{p,c})
└── test/
    ├── mocks/        (MockSensor, MockActuator, MockTransport)
    └── test_*        (registry, twopoint, pid, pulse_output, analog_calibration, remote, snapshot,
                       max31865, yf_s201, hcsr04, hx711, analog_output, dualstage, splitrange)
```

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

---

## 2026-08-20 — Live-Tracking-Test aufgedeckt: embedded Broker konnte nie eigene Daten publizieren

**Ausgangslage:** Geplanter Praxistest für Live-Tracking (Sensor/Aktor zur Laufzeit hinzufügen/löschen, MQTT beobachten). `mosquitto_sub`/`mosquitto_pub` lokal installiert (`choco install mosquitto`, Client-Tools unter `C:\Program Files\mosquitto\`). Erster Check vor dem eigentlichen Test: `mosquitto_sub -t 'brewcontrol/#'` liefert **nichts** — weder retained Meta noch periodische States, obwohl die Registry voller Sensoren/Aktoren/Regler ist (`mlt`, `kettle`, `mash`-Regler etc.).

### Ursache 1: ESP32 kann sich nicht selbst verbinden

Debug-Instrumentierung (`Serial.printf` in `MqttTransport::attemptConnect_`, danach entfernt) zeigt: `MqttService::tick()` läuft dauerhaft mit `connected=0`. `PubSubClient::state()` liefert konstant `-4` (`MQTT_CONNECTION_TIMEOUT`) — **sowohl** für `127.0.0.1` **als auch** für die echte WiFi-IP des Geräts (`WiFi.localIP()`, erster Fixversuch, hat das Problem nicht gelöst). Der eigene `WiFiClient` kann sich also nicht zu seinem eigenen, per `TinyMqtt::MqttBroker` gehosteten Broker verbinden — der Broker selbst funktioniert einwandfrei (externe `mosquitto_sub`/`mosquitto_pub`-Verbindungen liefen die ganze Zeit fehlerfrei). Exakte Ursache (ESP32-lwIP-Loopback grundsätzlich nicht geroutet vs. Fritzbox reflektiert keinen Traffic zurück zum selben Client vs. blockierender `connect()`-Call verhungert den Broker in der Single-Thread-`loop()`) nicht abschließend isoliert — aber irrelevant geworden, siehe Fix.

**Fix (User-Hinweis: "das war auch der Grund, warum ich diese Doppelstruktur mit PubSub abbauen wollte" → Blick ins offizielle TinyMqtt-Beispiel `examples/client-with-wifi/client-with-wifi.ino`):** TinyMqtt hat für genau diesen Fall einen **nativen In-Process-Client** — `MqttClient(&broker)` — der ganz ohne TCP/IP auskommt (Doku im Beispiel: "Reduces internal latency … Reduces wifi traffic … No need to have an external broker"). Neue Klasse `BrewControl/firmware/src/TinyMqttLocalTransport.h`: ein `SensActCtrl::ITransport`-Adapter um `TinyMqtt::MqttClient(&broker, clientId)` (mirrort `MqttTransport`s Single-Callback-Dispatch-Muster, da TinyMqtts `MqttClient::setCallback()` ebenfalls nur einen globalen Funktionspointer statt Pro-Topic-Callbacks kennt). `MqttService` hält `transport_` jetzt polymorph als `std::unique_ptr<SensActCtrl::ITransport>` — embedded Modus nutzt `TinyMqttLocalTransport` (kein `WiFiClient` mehr involviert), externer Modus bleibt unverändert bei `MqttTransport`/PubSubClient. Damit braucht der embedded Modus PubSubClient gar nicht mehr — die vom User schon länger gewünschte Auflösung der Doppelstruktur ergibt sich als Nebeneffekt des Fixes.

**Verifiziert:** `mosquitto_sub -t '#'` zeigt danach sofort alle Sensoren/Aktoren periodisch (`brewcontrol/brewcontrol/sensor/mlt`, `.../actuator/kettle`, …).

### Ursache 2 (Verdacht, dann widerlegt): vermeintliche Topic-Korruption

Beim anschließenden Live-Add-Test tauchte ein neu hinzugefügter Sensor unter `brewcontrol/brewcontrollo/sensor/livetest` auf — ein zusätzliches „lo" im Device-Namen, während zuvor beobachtete Boot-Zeit-Topics sauber `brewcontrol` zeigten. Erste Hypothese: Race Condition zwischen `async_tcp`-Task (Live-Add-Hook) und `loopTask` (`MqttService::tick()`), analog zum SD-Concurrency-Bug vom Vortag — dafür testweise `MqttLock.h` (rekursiver Mutex nach `SdLock`-Vorbild) gebaut, um `MqttService::tick()` und alle `DynamicItems`-Hooks herum, geflasht.

**User-Korrektur:** kein Bug — der mDNS-Hostname war zwischenzeitlich manuell umbenannt worden (`brewcontrol.local` war nicht mehr erreichbar), was einen Reboot auslöst; der Live-Add-Test lief bereits unter dem neuen Hostnamen, während die vorher beobachteten Topics noch vom alten Boot stammten. **`MqttLock.h` auf Nutzerentscheid wieder entfernt** — kein bewiesenes Problem, keine Änderung (Simplicity First). Das architektonische Risiko (TinyMqtt vermutlich ebenso wenig thread-sicher wie SdFat) bleibt als unbewiesene, aber nicht ausgeschlossene Möglichkeit im Hinterkopf, falls künftig ein echtes Symptom auftaucht.

### Live-Tracking-Test (nach dem Fix, sauber durchgeführt)

Alle Schritte über `curl` gegen die echte API (identischer Pfad wie die Web-UI):
1. **Add:** `POST /api/sensors` (DS18B20, unbenutzter Pin) → erscheint innerhalb von ~1 s auf MQTT, kein Neustart.
2. **Remove:** `DELETE /api/sensors/:id` → keine weiteren State-Publishes, Gerät bleibt erreichbar.
3. **Kritischer Test:** Aktor anlegen, Meta/State auf MQTT bestätigt, Aktor löschen, dann `mosquitto_pub` **manuell auf das alte `/set`-Topic** → keine Reaktion, **kein Crash**, Gerät antwortet danach weiter normal auf `/api/snapshot`. Das ist der direkte Beweis, dass `RemotePublisher::detach()` + `ITransport::unsubscribe()` die stale Subscription-Closure wirklich entfernen (der ursprüngliche Use-after-free-Vektor aus der Planungssession).
4. **Stresstest:** zwei Add/Remove-Zyklen direkt hintereinander (unbenutzte Sensor-IDs) — beide sauber abgeräumt, keine Waisen in der Registry, Gerät stabil.

Alle 4 Schritte bestanden. Damit sind sämtliche in der ursprünglichen Planungssession offen gelassenen HW-E2E-Punkte für Live-Tracking abgehakt.

### Verifikation

| Check | Resultat |
|---|---|
| `pio test -e native` (SensActCtrl) | 155/155 PASSED (unverändert, Fix betrifft nur BrewControl) |
| `pio run` alle 3 Envs | SUCCESS, Flash unverändert (esp32dev 67,4 %, lolin_s2_mini 64,2 %, LilyGo S3 19,1 %) |
| Embedded-Broker-Publish (`mosquitto_sub`) | Sensoren/Aktoren/Regler erscheinen live, retained Meta + periodische State-Updates |
| Live-Tracking (Add/Remove/Set-auf-gelöschtem-Aktor/Stresstest) | alle 4 grün, HW-verifiziert auf LilyGo S3 |

### Externer Broker gegen echtes Mosquitto — letzter offener HW-E2E-Punkt geschlossen

Lokaler Mosquitto-Broker auf dem Entwickler-PC (`choco install mosquitto` bringt neben den Client-Tools auch `mosquitto.exe` mit) als "externer" Broker für den ESP32 — Gerät und PC im selben LAN (192.168.178.x), Konfiguration jeweils per direktem `POST /api/settings` (derselbe Pfad wie die `/settings/mqtt`-Seite, inkl. automatischem Reboot).

Vier Szenarien, alle grün:
1. **Ohne Auth, plain TCP** (`allow_anonymous true`) — Gerät verbindet, publiziert alle Sensoren/Aktoren mit retained Meta + State (`mosquitto_sub` vom PC aus bestätigt).
2. **Mit Auth, korrekte Zugangsdaten** (`mosquitto_passwd`-Datei, `allow_anonymous false`) — verbindet und publiziert normal.
3. **Negativtest — Auth aktiv, aber Gerät noch ohne Zugangsdaten konfiguriert** (Broker-Log): `Sending CONNACK to brewcontrol (0, 5)` → `disconnected: not authorised` — korrekt abgelehnt, bevor die Zugangsdaten nachgereicht wurden.
4. **TLS + Auth** — selbstsigniertes Zertifikat (`openssl req -x509 ...`, 7 Tage), Broker-Listener auf 8883. Da `MqttService` für den externen Modus `WiFiClientSecure::setInsecure()` nutzt (keine Zertifikatsprüfung, gleiches Muster wie beim OTA-Update), war kein Zertifikat-Trust auf dem Gerät nötig — Broker-Log zeigt durchgehenden verschlüsselten `PUBLISH`-Stream vom Gerät; zusätzlich mit einem eigenen `mosquitto_sub --insecure` visuell bestätigt (der eigene Client brauchte `--insecure`, weil das Testzertifikat keine SAN-Erweiterung hat — rein clientseitige Cosmetics, nicht der ESP32 betreffend).

Gerät danach auf den stabilen Ausgangszustand zurückgesetzt (`mode:"embedded"`, Host/Creds geleert). Test-Broker, Zertifikat und Passwort-Datei lagen nur im Session-Scratchpad, nichts davon landet im Repo.

Damit ist der externe Broker-Modus vollständig HW-verifiziert (Auth, Auth-Negativtest, TLS) — der letzte offene HW-E2E-Punkt aus der MQTT-Planungssession ist geschlossen.

### Verbindungsstatus im UI (Nachfrage: "wird ein Fehler angezeigt, wenn die Verbindung zum Broker nicht zustande kommt?")

Antwort war bis dahin: nein, gar nicht — `GET /api/settings` lieferte nur die gespeicherte Konfiguration, keinen Live-Status; ein falsch konfigurierter Host wäre im UI unsichtbar geblieben. Nachgerüstet:

- `MqttService::connected()` — neuer Getter, `transport_ && transport_->connected()`.
- `WebUI` bekommt eine neue Konstruktor-Abhängigkeit `MqttService&` (main.cpp: `mqttService` war bereits vor `webUI` deklariert, keine Reihenfolge-Änderung nötig). `GET /api/settings`-Handler parst jetzt `settings_.serialize()` zurück in ein `JsonDocument`, spleißt `mqtt.connected` (live, nicht persistiert) rein und serialisiert neu — sauberer Schnitt, `SettingsStore` bleibt eine reine Persistenzklasse ohne Kenntnis von `MqttService`.
- Frontend: `MqttSettings.connected?: boolean`, neue "Status"-Card ganz oben (nur sichtbar wenn `enabled`), grüner/roter Badge ("Verbunden"/"Nicht verbunden").

**Verifiziert** (echtes Gerät, beide Richtungen): embedded Modus (immer verbunden, In-Process) → `"connected":true`; externer Modus mit absichtlich unerreichbarem Host (`192.168.178.250`) → `"connected":false`. Im Browser (Dev-Proxy gegen das Live-Gerät) bestätigt: Status-Card zeigt korrekt grünen "Verbunden"-Badge.

**Nachfrage: "macht die Statusanzeige beim eingebauten Broker Sinn?"** — nein. TinyMqtts lokaler Client (`MqttClient::connected()`) liefert für den In-Process-Fall (`local_broker!=nullptr and tcp_client==nullptr`) unbedingt `true`, sobald das Objekt existiert — es gibt dort keinen echten Verbindungsaufbau, der scheitern könnte. Die Karte würde im embedded Modus also immer grün bleiben und eine Healthcheck-Aussage vortäuschen, die es nicht gibt. **Status-Card jetzt nur noch sichtbar wenn `mode==='external'`** — dort ist der Status ein echtes Signal (Host/Port/Auth/Netzwerk können real fehlschlagen). Live gegengeprüft: embedded → keine Karte; extern + erreichbar → grüner Badge; extern + unerreichbar → roter Badge.

**Nachfrage: "gibt nur 'nicht verbunden', oder auch eine Fehlermeldung?"** — Erweiterung um `ITransport::lastErrorMessage()` (nicht-brechender Default `""`, gleiches Muster wie `unsubscribe()`/`fault()`), `MqttTransport` übersetzt `PubSubClient::state()` in deutsche Klartexte (Zeitüberschreitung, Verbindung fehlgeschlagen, ungültige Zugangsdaten, nicht autorisiert, …). `MqttService::lastErrorMessage()` reicht das durch (embedded Modus liefert immer `""`, da `TinyMqttLocalTransport` den Default erbt). `WebUI.cpp`s `GET /api/settings` spleißt zusätzlich `mqtt.error` rein. Frontend zeigt den Text als Beschreibung der Status-Card, sobald nicht verbunden.

**Verifiziert** (echtes Gerät, zwei unterschiedliche Fehlerursachen): unerreichbarer Host → `"Verbindung fehlgeschlagen (Host/Port prüfen)"` (PubSubClient state -2); falsches Passwort gegen einen Auth-Broker → `"Nicht autorisiert"` (state 5) — beide Texte im Browser korrekt als Card-Beschreibung neben dem roten Badge bestätigt.

---

## 2026-08-20 — Topic-Prefix + Client-ID in der UI editierbar

**Ausgangslage:** Nutzer wollte das MQTT-Topic-Präfix (bisher `brewcontrol/<mdns-name>/<device-id>/…` vermutet) konfigurierbar machen. Exploration ergab: Backend war bereits vollständig fertig — `SettingsStore` hält `mqttTopicPrefix_` (Default `"brewcontrol"`) und `mqttClientId_` (Default `""` ⇒ Fallback auf mDNS-Hostname) seit dem MQTT-Einstellungen-Feature vom Vortag, beide laden/persistieren/serialisieren korrekt und werden von `MqttService` vor jedem `attach()` an `RemotePublisher::setPrefix()` durchgereicht. Klarstellung fürs Nutzer-Mentalmodell: „mdns-name" und „device id" sind kein zwei getrennte Topic-Segmente, sondern ein einziges (`<prefix>/<device>/sensor/<id>/…`, `Topics.h`) — das `device`-Segment ist exakt die Client-ID (oder deren mDNS-Fallback). Einzige fehlende Stelle: `MqttPage.tsx` hatte für keins der beiden Felder ein Eingabefeld — sie konnten nur den gespeicherten Default annehmen.

**Änderungen:**
- `MqttPage.tsx`: neue `SettingsCard` „Topic & Client-ID" (Icon `Hash`, zwischen „Modus" und „Broker-Adresse", da modusunabhängig) mit zwei Textfeldern (`topicPrefix`, `clientId`); `desc` zeigt live das resultierende Topic-Schema (`<prefix>/<client-id oder "<mdns-hostname>">/sensor/<id>`) vor dem Speichern. Kein neuer State/API-Call — beide Felder existierten bereits in `MqttSettings` (`types.ts`) und laufen durch den bestehenden Save-Pfad.
- `WebUI.cpp` (`POST /api/settings`, mqtt-Validierungsblock): zwei neue Checks — `topicPrefix` darf nicht leer sein und kein `/` enthalten; `clientId` darf leer sein (gültiger Fallback-Wert), aber falls gesetzt ebenfalls kein `/` enthalten. Grund: `Topics.h::base()` baut Topics per naivem `prefix + "/" + device + "/" + …`-Concat — ein `/` in einem der beiden Felder würde den Topic-Baum strukturell korrumpieren.
- Nicht angefasst (bereits korrekt): `SettingsStore.{h,cpp}`, `MqttService.{h,cpp}`, `SensActCtrl/src/remote/Topics.h`, `RemotePublisher.h`, `types.ts`.

**Verifikation:**

| Check | Resultat |
|---|---|
| `pnpm typecheck` (BrewControl/web) | 0 Fehler |
| `pio run -e esp32dev` | SUCCESS, 67,5 % Flash (vorher 67,2 %) |
| Browser (Dev-Server, kein Live-Gerät) | `/settings/mqtt` lädt, neue Card zeigt beide Felder + Default-Schema-Text; Eingabe in Topic-Prefix/Client-ID aktualisiert den Schema-Hinweis live und korrekt; keine Konsolenfehler |

**Offen:** HW-E2E (Präfix/Client-ID am echten Gerät ändern, `mosquitto_sub` bestätigt neue Topic-Struktur; Negativtest `/`-im-Präfix → 400 mit sichtbarer Fehlermeldung im UI) — bisher nur Dev-Server ohne Live-Gerät verifiziert.

---

## 2026-08-21 — Generischer MQTT-Aktor

**Ausgangslage:** Letzter offener Roadmap-Punkt aus der MQTT-Planungssession (Welle 2): Topic statt device/id, Message-Body als Template mit Platzhalter für on/off/value, Ziel Sonoff/Tasmota-artige Fremdgeräte. Voraussetzung (MQTT-Verbindung konfigurierbar) war seit dem Vortag erfüllt.

### Architektur-Entscheidung (revidiert nach Nachfrage)

Erster Entwurf sah ein neues BrewControl-eigenes `IMqttPublisher`-Interface vor, um das Timing-Problem zu umgehen, dass `DynamicItems::loadFromSD()` vor `MqttService::begin()` lief (Aktoren aus der SD-Config wurden konstruiert, bevor überhaupt ein MQTT-Transport existierte). Auf Nachfrage ("können wir nicht dafür sorgen, dass die dynamic items erst nach dem mqttService::begin() geladen werden?") wurde die Boot-Reihenfolge stattdessen direkt umgebaut — mit einer Einschränkung, die den Ansatz sogar vereinfacht hat: `MqttService::begin()` erledigte bisher zwei Dinge in einem Aufruf (Transport erzeugen **und** alle bereits vorhandenen Registry-Items an den internen `RemotePublisher` anhängen). Ein reines Vorziehen von `loadFromSD()` hätte den zweiten Teil kaputt gemacht (Registry wäre zum Attach-Zeitpunkt noch leer gewesen). Gelöst durch Split in `begin()` (nur Transport+Publisher, läuft jetzt vor `loadFromSD()`) und `attachExisting()` (Boot-Snapshot-Attach + Hook-Registrierung, läuft unverändert an der alten Stelle nach `registry.begin()`/`markInitialized()`). Damit entfiel die Notwendigkeit für ein neues Interface komplett — der Aktor nimmt `SensActCtrl::ITransport&` direkt entgegen, exakt wie das bestehende `RemoteActuator`, und lebt entsprechend in der Library statt in der Firmware (keine spekulative Abstraktion, sondern Wiederverwendung des vorhandenen Interfaces).

**Fehlerverhalten (Nutzer-Entscheidung):** `fault()` delegiert reine an `ITransport::connected()`/`lastErrorMessage()` — kein eigenes Publish-Tracking, sondern derselbe Status, der auch auf `/settings/mqtt` angezeigt wird.

### SensActCtrl

- Neue Klasse `MqttGenericActuator` (`src/actuators/`, kein `#ifdef ARDUINO`-Guard): zwei Konstruktoren — Binary (literale `on_payload`/`off_payload`, startet armed-but-disabled wie `DigitalOutputActuator`s Binary-Modus) und Continuous (`payload_template` mit `{value}`-Platzhalter, Range/Unit wie `AnalogOutputActuator::setRange`). Einziger Choke-Point `publishCurrent()` (Muster: `applyPin()`/`applyOutput()`) — gated `enabled_` vor jedem Publish, sowohl von `write()` als auch von `applyEnabled()` aus.
- Freie Helper-Funktion `buildMqttPayload()` (Platzhalter-Ersetzung, `%g`-Formatierung) co-lokiert in derselben Datei — kein eigenes File, da nur dieser eine Aktor sie braucht.
- `MockTransport` (Test-Mock) um settable `connected`/`lastErrorMessage`-Zustand erweitert (vorher immer `connected()==true`, kein Weg `fault()` zu testen) — Default bleibt "immer verbunden", bestehende Tests unberührt.
- 17 neue native Tests (`test_mqtt_generic_actuator`): Payload-Template-Substitution (inkl. Puffer-zu-klein, mehrere Platzhalter, kein Platzhalter), Binary On/Off/Disable-aktiv-Off, Continuous-Clamping, `retained`-Durchreichung, `fault()` (verbunden/Fehlermeldung/Fallback-Text). **173/173 native Tests grün** (17 neu; die Gesamtzahl lag schon vor dieser Session über den zuletzt in PLAN.md vermerkten 155 — Differenz nicht weiter untersucht, keine der vorhandenen Tests betroffen von dieser Session).
- `SensActCtrl.h`-Umbrella um den neuen Include ergänzt.

### BrewControl Firmware

- **`MqttService::begin()` gesplittet** in `begin()` (Transport+Publisher, unverändert bis auf das Ende) und neue `attachExisting()` (Boot-Snapshot-Attach + Hook-Registrierung, 1:1 aus dem alten `begin()`-Ende übernommen); neuer Getter `transport()` (`SensActCtrl::ITransport*`, nullable).
- **`DynamicItems`**: neuer Setter `setMqttTransport(ITransport*)` + Member `mqttTransport_`; neuer Branch `"MqttGeneric"` in `addActuatorNoBegin()` (nach `AnalogOutput`), lehnt mit `{false, "mqtt not available"}` ab wenn kein Transport gesetzt ist (MQTT deaktiviert/nicht unterstützt) — `loadFromSD()` verwirft das `Result` still, kein Boot-Abbruch. Landet automatisch im bestehenden `IntervalActuator`-Wrap (Duty-Cycle ohne Sonderfall).
- **`main.cpp`**: `settingsStore.loadFromSD()` aus dem gemeinsamen `if(sdOk)`-Block vorgezogen (wird jetzt vor `mqttService.begin()` gebraucht); `mqttService.begin(hostname_)` + `dynamicItems.setMqttTransport(mqttService.transport())` laufen jetzt vor `dynamicItems.loadFromSD()`; `mqttService.attachExisting()` ersetzt den alten `begin()`-Aufruf an der ursprünglichen Stelle (nach `registry.begin()`/`markInitialized()`, vor `webUI.begin()`) — Timing dort unverändert.

### Frontend

- `AddItemModal.tsx`: `ActuatorType` um `'MqttGeneric'` erweitert, neue Dropdown-Option, vollständiges Formular (Topic, Retained, Art-Umschalter An/Aus vs. Wert, je nach Art unterschiedliche Felder), Edit-Populate- und Reset-Zweige, Submit-Validierung (Topic Pflicht, Payload-Template muss `{value}` enthalten, Wertebereich Min < Max). In den Intervall-Feld-Gate aufgenommen (Duty-Cycle-Betrieb ist backend-seitig generisch). `ActuatorCard.tsx`/`types.ts`/`api.ts`: **keine Änderungen** — Card dispatcht rein nach `meta.kind`, rendert Toggle/Slider automatisch korrekt inkl. Fault-Badge.

### Verifikation

| Check | Resultat |
|---|---|
| `pio test -e native` (SensActCtrl) | 173/173 PASSED (17 neu) |
| `pio run` alle 3 BrewControl-Boards | SUCCESS (esp32dev 67,6 %, minimal + gegenüber Vortag) |
| `pio test -e native` (BrewControl) | bestehende `test_log_compressor`/`test_tar_extractor` weiterhin grün (16 Tests, keine Regression) |
| `pnpm typecheck` + `pnpm build` (BrewControl/web) | 0 Fehler |
| Browser (Dev-Server gegen Live-Gerät, vor dem Flash) | Formular für Binary + Continuous korrekt gerendert; Submit gegen die **alte** Firmware liefert sauber `400 unknown actuator type` (kein Crash) — bestätigt Frontend-Wire-Format und Fehlerbehandlung schon vor dem Flash |

**HW-E2E (User: „kannst du ruhig flaschen, das ist nur eine Testumgebung"):** LilyGo S3 (COM9) neu geflasht. Nach Reboot: bestehende Config (Sensoren/Aktoren/Regler, pausiertes `mash`-Programm) unverändert vorhanden — **Regressionscheck bestanden**, internes MQTT-Mirroring zeigt sofort wieder alle Boot-Items (`mosquitto_sub -t '#'` gegen den eingebauten Broker). Direkt gegen die Geräte-API getestet (`curl`, gleicher Pfad wie die Web-UI):

1. **Binary:** Aktor angelegt (`brewcontrol/test/plug1`), Enable → publiziert aktiv `ON` (Value war schon auf „an" vorbelegt); `write(1)` → `ON`; `write(0)` → `OFF`.
2. **Master-Schalter:** `write(1)` → `ON`, dann `enabled:false` → publiziert aktiv `OFF` (nicht nur Stille) — Kontrakt „talking over a protocol muss aktiv aus kommandieren" bestätigt.
3. **Snapshot:** kein `fault`-Feld (eingebauter Broker immer verbunden), `enabled:false`, `target:1` (unverändert von `enabled()`), `state.v:0` — exakt wie spezifiziert.
4. **Internes Mirroring:** neuer Aktor erscheint automatisch unter `brewcontrol/brewcontrol/actuator/mqtt_test_plug` (Live-Add-Hook greift wie bei jedem anderen Aktor-Typ).
5. **Continuous:** Aktor angelegt (`brewcontrol/test/dimmer1`, Template `{value}`, Range 0–100); `write(42)` → `42`; `write(150)` → `100` (Clamping auf Max bestätigt).
6. Beide Test-Aktoren wieder gelöscht, Gerät danach auf den ursprünglichen Item-Satz zurückgeprüft (`mlt`, `durchfluss.rate/volume`, `sdfswdf`, `kettle`, `pump`, `dfsdfdf`, `mash`) — keine Waisen.

Alle 6 Schritte grün. Einzig eine echte Sonoff/Tasmota-Steckdose war nicht am Testgerät angeschlossen — der Payload-Inhalt (`"ON"`/`"OFF"`/formatierter Zahlenwert) entspricht aber exakt dem, was Tasmota-Firmware auf `cmnd/<device>/POWER` erwartet.

---

## 2026-08-21 — Generischer MQTT-Sensor

**Ausgangslage:** Direkte Anschlussfrage an den MQTT-Aktor: „bauen wir auch einen MQTT-Sensor?" — plus die größere, ursprünglich schon im Raum stehende Idee, kabellose Sensoren/Aktoren anzubinden (MQTT **und** ESP-NOW). Zwei getrennte Dinge identifiziert: (1) ein generischer MQTT-Sensor als Pendant zum Aktor (beliebiger Topic + Parse-Template, für Fremdgeräte), (2) echte SensActCtrl-Node-zu-Node-Anbindung über die bereits vorhandenen `RemoteSensor`/`RemoteActuator`/`RemotePublisher` + `ITransport`-Implementierungen (MQTT/ESP-NOW/Webhook), die bisher nirgends an `DynamicItems`/`AddItemModal` angebunden sind. User-Entscheidung: erst (1), danach (2) — (2) als eigener Roadmap-Punkt in PLAN.md vorgemerkt (Pairing/Discovery-UX für ESP-NOW ist eigener, größerer Scope).

### SensActCtrl

- Neue Klasse `MqttGenericSensor` (`src/sensors/`, kein `#ifdef ARDUINO`-Guard) — Pendant zu `MqttGenericActuator`: nimmt `ITransport&` direkt entgegen (wie `RemoteSensor`), abonniert einen frei konfigurierbaren Topic statt des festen device/id-Schemas. Payload-Parsing: leerer `jsonField` → Payload ist die rohe Zahl (`strtof`); gesetzter `jsonField` → Payload als JSON-Objekt geparst, benanntes Top-Level-Feld extrahiert (ArduinoJson, bereits bestehende SensActCtrl-Abhängigkeit, nativ nutzbar — kein neuer Dep). Fehlerhafte/nicht parsbare Nachrichten werden still ignoriert (vorheriger Wert bleibt stehen), exakt wie `RemoteSensor::onState` es bei ungültigem JSON schon handhabt (Precedent bewusst übernommen, kein neues Verhalten erfunden). `fault()` delegiert an `ITransport::connected()`/`lastErrorMessage()`, identisch zum Aktor.
- Freie Helper-Funktion `parseMqttSensorPayload()` co-lokiert in derselben Datei.
- `MockTransport::publish()` simuliert bereits eine eingehende Broker-Nachricht an alle passenden lokalen Subscriber (unverändert von der letzten Session) — direkt nutzbar für die neuen Tests, kein weiterer Mock-Ausbau nötig.
- 15 neue native Tests (`test_mqtt_generic_sensor`): Payload-Parsing (roh, JSON-Feld, fehlendes Feld, malformed JSON — beide Zweige), Reading-Update bei erster/fehlerhafter Nachricht (bleibt `valid` mit altem Wert stehen), Meta-Felder, `channelCount()==1`, `fault()` (verbunden/Fehlermeldung/Fallback). **189/189 native Tests grün** (15 neu; Gesamtzahl lag schon vor dieser Session — und vor der MQTT-Aktor-Session — über den zuletzt in PLAN.md vermerkten Ständen; Differenz nicht weiter verfolgt, keine bestehenden Tests betroffen).
- `SensActCtrl.h`-Umbrella ergänzt.

### BrewControl Firmware

- `DynamicItems::addSensorNoBegin` neuer Branch `"MqttGeneric"` (nach `DigitalInput`), nutzt denselben `mqttTransport_`, der schon für den Aktor gesetzt wird — keine weitere Wiring-Änderung nötig, die Boot-Reihenfolge-Arbeit aus der Aktor-Session trägt hier direkt mit. Lehnt ohne Transport mit `{false, "mqtt not available"}` ab, `loadFromSD()` verwirft das still (bestehendes Verhalten).
- Alle 3 Boards kompilieren, BrewControl-native Tests (`test_log_compressor`/`test_tar_extractor`) weiterhin grün.

### Frontend

- `AddItemModal.tsx`: `SensorType` um `'MqttGeneric'` erweitert, neue Optgroup „MQTT" im Sensor-Type-Dropdown. Formular teilt sich `mqttTopic`/`mqttUnit`/`mqttMin`/`mqttMax`/`mqttResolution` mit dem Aktor-Formular (gleiche Bedeutung, wird bei jedem Öffnen ohnehin zurückgesetzt) — nur `mqttJsonField` ist sensor-spezifisch neu. `SensorCard.tsx`: **keine Änderungen** — dispatcht bereits rein über `meta`/`state`/`fault`, unabhängig vom Sensortyp.

### Debugging-Umweg: vermeintlicher Boot-Crash nach dem zweiten Reflash

Nach dem Flash der Sensor-Firmware (LilyGo S3, COM9) war das Gerät weder per `brewcontrol.local` noch per seriellem Monitor erreichbar — auch nach mehreren Minuten Wartezeit und einem manuellen Reset-Versuch per `pyserial`-DTR/RTS-Toggle (der vermutlich selbst kontraproduktiv war: native USB-JTAG-Serial-Geräte reagieren auf rohe DTR/RTS-Pulse anders als auf esptool's korrekt sequenzierten Reset, im schlimmsten Fall Download-Mode statt Neustart). Ein zweiter sauberer Reflash (nur `pio run -t upload`, kein manuelles Port-Fummeln danach) zeigte weiterhin keine Serial-Ausgabe und keine mDNS-Antwort — bis der User bestätigte: **das Gerät war die ganze Zeit über die IP direkt erreichbar** (`192.168.178.87`). Ursache war ausschließlich mDNS/`*.local`-Auflösung, die von der Bash/curl-Umgebung dieser Session aus nicht funktionierte (auch `ping brewcontrol.local` von Windows aus schlug fehl) — kein Firmware-Problem. **Lehre für künftige Sessions:** bei Nichterreichbarkeit über `brewcontrol.local` zuerst die IP direkt probieren, bevor Zeit in Boot-Diagnose fließt; `pio device monitor` nach einem Reflash zeigt ohnehin nur Ausgaben, die *nach* dem Verbindungsaufbau anfallen — ein bereits sauber durchgebooteter, im `loop()` laufender ESP32 druckt dort erwartungsgemäß nichts mehr (kein periodisches Logging im Normalbetrieb), das ist für sich genommen kein Fehlersignal.

### HW-E2E (LilyGo S3, `192.168.178.87`)

Direkt gegen die Geräte-API getestet (`curl` + `mosquitto_pub`, gleicher Pfad wie die Web-UI):

1. **Roher Zahlwert:** Sensor angelegt (`brewcontrol/test/aussentemp`, Unit `°C`), `mosquitto_pub -m "18.75"` → Snapshot zeigt `state.v:18.75, ok:true`.
2. **JSON-Feld-Extraktion:** Sensor angelegt (`brewcontrol/test/klimasensor`, `json_field:"humidity"`), `mosquitto_pub -m '{"temperature":21.3,"humidity":55.8}'` → Snapshot zeigt `state.v:55.8` (korrektes Feld extrahiert, `temperature` ignoriert).
3. Beide Test-Sensoren wieder gelöscht, Gerät auf `mlt`, `durchfluss.rate/volume`, `kettle`, `pump`, `dfsdfdf`, `mash` zurückgeprüft — keine Waisen.
4. UI-Bundle neu gebaut (`pnpm build:sd`) und über `/api/update/assets` aufgespielt, Auslieferung des neuen JS-Bundles am Gerät bestätigt.

**Beobachtung (nicht abschließend geklärt):** der zuvor auf dem Gerät vorhandene Sensor `sdfswdf` (Test-Item aus einer früheren Session) fehlt seit diesem Durchlauf im Snapshot. Keine der hier durchgeführten Aktionen hat diesen Sensor absichtlich angefasst oder gelöscht — bleibt als offene Beobachtung, falls es beim nächsten Kontakt mit dem Gerät wieder auffällt.

---

## 2026-08-21 — Kabellose SensActCtrl-Knoten: Recherche + Plan für die nächste Session

**Ausgangslage:** Nach den beiden generischen MQTT-Typen (Sensor + Aktor, für Fremdgeräte) kam die ursprüngliche, größere Idee wieder auf: echte kabellose SensActCtrl-Knoten anbinden — ein zweiter ESP32 mit eigenen Sensoren/Aktoren, den man im BrewControl-Web-UI wie ein lokales Item bedient. Das ist etwas anderes als die generischen MQTT-Typen (beliebiger Topic/Payload für Fremdgeräte) — hier geht es um echtes SensActCtrl-Node-zu-Node-Protokoll. User-Entscheidung: alle drei vorhandenen Transporte (MQTT, Webhook, ESP-NOW mit Fix), aber **der Reihe nach**, nicht in einem Rutsch (Kontextfenster-Grund + generell sauberer). Dieser Eintrag ist der Fahrplan für morgen — **Schritt 1 (MQTT) ist startbereit**, Schritt 2/3 sind grob skizziert.

### Kernbefund aus der Recherche (per Explore-Agent + eigener Verifikation)

**`RemoteSensor`/`RemoteActuator`/`RemotePublisher` sind bereits vollständig fertig in SensActCtrl** (`src/remote/`) und komplett transport-agnostisch — sie nehmen nur `ITransport&`. Für alle drei Transporte werden **keine neuen SensActCtrl-Klassen** gebraucht, nur BrewControl-seitiges Wiring + UI. Das hält jeden der drei Schritte deutlich kleiner als die MQTT-Sensor/Aktor-Arbeit.

**Topic-Schema** (`SensActCtrl/src/remote/Topics.h`, gilt für MQTT **und** ESP-NOW **und** Webhook — alle drei teilen sich dasselbe Wire-Format über `MetaJson.h`):
```
<prefix>/<device>/sensor/<id>              state (retained)
<prefix>/<device>/sensor/<id>/meta         meta  (retained)
<prefix>/<device>/sensor/<id>/<key>        Multi-Channel-Kanal-State
<prefix>/<device>/actuator/<id>            state (retained)
<prefix>/<device>/actuator/<id>/meta       meta  (retained)
<prefix>/<device>/actuator/<id>/set        Command
```
`device` ist ein frei gewählter String (Hostname/Client-ID des Leaf-Knotens) — kein Auto-Discovery, muss im UI als Feld eingegeben werden (welcher Leaf-Knoten unter welchem Namen).

**Drei fertige Zwei-Geräte-Beispiel-Sketches** als Referenz: `SensActCtrl/examples/08_remote_mqtt/`, `09_remote_espnow/`, `10_remote_webhook/` (je `publisher/` + `consumer/` + `README.md`) — zeigen exakt das erwartete Verwendungsmuster.

**`RemoteSensor`/`RemoteActuator` sind bisher nirgends in BrewControl referenziert** (grep bestätigt) — nur `RemotePublisher` wird schon genutzt (`MqttService`, um BrewControls **eigene** Items nach außen zu spiegeln). Das Consumer-seitige Wiring ist komplett unbeackertes Terrain.

**Wichtiger Fund — ESP-NOW verträgt sich aktuell NICHT mit BrewControls eigenem WLAN:** `EspNowTransport::initEspNow_()` (`SensActCtrl/src/transport/EspNowTransport.cpp:43-44`) ruft beim Konstruieren unconditional `WiFi.disconnect(false, true)` + erzwingt einen Kanal — das würde BrewControls STA-Verbindung (Web-UI, mDNS, externer MQTT) kappen. Kein grundsätzliches ESP-NOW-Problem (ESP-NOW kann laut ESP-IDF-Doku parallel zu einer aktiven STA-Verbindung laufen, wenn man den Kanal von der bestehenden Verbindung übernimmt statt ihn zu erzwingen — `esp_now_peer_info_t.channel = 0` bedeutet "aktuellen Kanal verwenden", wenn STA schon verbunden ist), aber die Beispiel-Sketches sind reine Leaf-Knoten ohne eigenes WLAN-Bedürfnis, denen das nie auffiel. **Muss vor Schritt 3 gefixt werden** (Skizze unten).

**`WebhookTransport`** ist bidirektional (nicht nur push), aber **1 Instanz = 1 Peer + 1 lokaler Listen-Port** (`WebhookTransport(listenPort, peerBaseUrl)`, eigener synchroner `WebServer`, nicht der bestehende Async-Server). Für mehrere Remote-Webhook-Geräte braucht BrewControl mehrere Instanzen — mehr Wiring-Aufwand als MQTT/ESP-NOW (die beide „ein geteilter Bus, viele Geräte" sind).

### Schritt 1 — MQTT-Remote (startbereit für morgen)

- **`DynamicItems::addSensorNoBegin`/`addActuatorNoBegin`**: neuer Typ `"Remote"`. Cfg-Felder: `device` (Geräte-ID des Leaf-Knotens, Pflicht), `remote_id` (Sensor-/Aktor-ID auf dem Leaf, Pflicht), optional `prefix` (Default `"sensactctrl"`, muss zum Leaf passen), optional `channel_key` (Multi-Channel-Sensoren am Leaf). Baut `SensActCtrl::RemoteSensor`/`RemoteActuator` direkt auf dem schon vorhandenen `mqttTransport_` (derselbe Setter, den die beiden generischen MQTT-Typen schon nutzen) — gleiche Ablehnung `{false, "mqtt not available"}` ohne Transport. **Kein neuer Tick-Pump nötig** — läuft über `mqttService.tick()` mit (bereits durch die Recherche bestätigt: `Registry::tick()` ruft `RemoteSensor`/`RemoteActuator::tick()` auf, die sind No-Ops, den Transport pumpt `mqttService.tick()`).
- **`AddItemModal.tsx`**: neuer Typ „Remote (SensActCtrl-Knoten)" in Sensor- **und** Aktor-Dropdown (eigene Optgroup „Remote"), Felder Geräte-ID / Remote-ID / optional Topic-Prefix. `SensorCard`/`ActuatorCard`: keine Änderung erwartet (dispatchen generisch).
- **Verifikation:** native Tests brauchen vermutlich keine neuen — `RemoteSensor`/`RemoteActuator` sind schon in `test_remote.cpp` getestet, hier geht's nur um die `DynamicItems`-Verdrahtung (Firmware-seitig, kein neuer Library-Code). HW-E2E idealerweise mit einem zweiten geflashten Testgerät als Leaf (z.B. `08_remote_mqtt/publisher.ino` auf ein zweites Board, falls vorhanden) — sonst nur „legt korrekt an, zeigt sauber `stale`/kein Signal ohne Leaf" verifizieren.

### Schritt 2 — Webhook-Remote (danach)

Neue Klasse `BrewControl/firmware/src/WebhookService.h/.cpp` (Muster: `MqttService`, aber schlanker) — hält `vector<unique_ptr<SensActCtrl::WebhookTransport>>`, dedupliziert nach `(listenPort, peerBaseUrl)`, `getOrCreate(port, peerUrl) → ITransport&`. Eigener `tick()`-Aufruf in `main.cpp`s `loop()` nötig (kein Free-Ride wie bei MQTT). `DynamicItems` bekommt einen neuen Setter (Pointer auf `WebhookService`), `addSensorNoBegin`/`addActuatorNoBegin` ruft `getOrCreate()` für `transport:"webhook"`-Items. UI-Felder zusätzlich zu Geräte-ID/Remote-ID: `listen_port`, `peer_url`.

### Schritt 3 — ESP-NOW-Remote mit Fix (zuletzt)

**Library-Fix zuerst** (`SensActCtrl/src/transport/EspNowTransport.cpp`, `initEspNow_()`): nur noch `WiFi.disconnect()` + Kanal-Erzwingen, wenn **nicht** schon STA-verbunden (`WiFi.isConnected()`); wenn schon verbunden, WLAN unangetastet lassen und `peer.channel = 0` setzen (ESP-IDF: „aktuellen Kanal verwenden"). Rückwärtskompatibel zum Standalone-Fall (Beispiel-Sketches unverändert). Sollte vor der eigentlichen Konstruktion in `main.cpp` passieren — `EspNowTransport` erst **nach** erfolgreicher WLAN-Verbindung konstruieren (analog `mqttService.begin()`-Timing), nicht als früher globaler Objekt.

BrewControl: neues globales `std::unique_ptr<SensActCtrl::EspNowTransport>`, konstruiert in `setup()` nach WLAN-Connect (immer aktiv, kein Settings-Toggle nötig — Broadcast-Empfang ist passiv, keine nennenswerten Kosten). `DynamicItems`-Setter analog zu `mqttTransport_`. UI-Feld optional `channel` (leer = aktueller WLAN-Kanal).

**Verifikations-Einschränkung:** Kanal-Koexistenz mit aktiver STA-Verbindung ist reales RF-Verhalten, nativ nicht testbar — braucht echte Hardware, idealerweise zwei Geräte (BrewControl-Gerät + Leaf mit `09_remote_espnow/publisher.ino`), um zu bestätigen, dass ESP-NOW-Pakete ankommen **während** BrewControls eigenes Web-UI über WLAN weiter erreichbar bleibt (genau der Konflikt, den der Fix auflösen soll).

### Nächster Schritt morgen

Direkt mit **Schritt 1 (MQTT-Remote)** starten wie oben beschrieben — kleinster, sauberster Einstieg, keine offenen Fragen mehr.

## 2026-08-21 — Schritt 1 (MQTT-Remote) fertig, teilweise HW-verifiziert

**Library-Fix vorab nötig:** `RemoteActuator` hatte — anders als `RemoteSensor` — kein `setPrefix()`; Topics wurden fest im Konstruktor mit Default-Prefix gebaut. Der Plan sah für beide einen optionalen Prefix vor, also in SensActCtrl nachgezogen (`RemoteActuator.h/cpp`): Topics jetzt wie bei `RemoteSensor` erst in `begin()` gebaut, `setPrefix()` ergänzt. Neuer Test `test_actuator_custom_prefix_roundtrip` in `test_remote.cpp`. 190/190 native Tests grün.

**DynamicItems (`BrewControl/firmware/src/DynamicItems.cpp`):** neuer Typ `"Remote"` in `addSensorNoBegin`/`addActuatorNoBegin`, exakt wie geplant — `device`/`remote_id` Pflicht, `prefix`/`channel_key` (nur Sensor) optional, Ablehnung `{false, "mqtt not available"}` ohne `mqttTransport_`. Kein neuer Tick-Pump nötig (bestätigt).

**AddItemModal.tsx:** „Remote (SensActCtrl-Knoten)" in Sensor- und Aktor-Dropdown (eigene Optgroup), Felder Geräte-ID / Remote-ID / Kanal-Key (nur Sensor) / Topic-Prefix (alle optional außer Geräte-/Remote-ID). `pnpm typecheck` grün.

**Zweiter Library-Bug, live gefunden:** `RemoteSensor::id()`/`RemoteActuator::id()` gaben die **Remote-ID** zurück (`sensorId_`/`actuatorId_`), nicht die lokale `id`, unter der `DynamicItems` das Item in der `Registry` eindeutig führt. Die `Registry` (und damit Snapshot, Dashboard, Controller-Referenzen) keyed aber ausschließlich über `id()`. Symptom im Live-Test: Sensor als `test_remote_sensor` angelegt, im Snapshot erschien er als `mash_temp` (die Remote-ID). Fix in SensActCtrl: `setLocalId()` auf beiden Klassen ergänzt (Default bleibt die Remote-ID, rückwärtskompatibel zu Standalone-Sketches), `DynamicItems.cpp` ruft `setLocalId(e->id.c_str())` nach dem Konstruieren. Zwei neue Tests (`test_sensor_local_id_overrides_registry_id`, `test_actuator_local_id_overrides_registry_id`). 192/192 native Tests grün.

**Verifikation (final, nach dem id()-Fix):**
- Firmware compile-smoke (`esp32dev` + `lilygo_t_display_s3_amoled`) grün.
- SD-Karte des Testgeräts mountet zuverlässig (`"SD mounted"` im Boot-Log über zwei Neustarts hinweg bestätigt) — die anfängliche „SD nicht gemountet"-Vermutung war ein Irrtum, ausgelöst durch einen zu früh abgefragten Zustand kurz nach dem ersten Flash, kein echtes Problem.
- Eingebauten MQTT-Broker aktiviert, Remote-Sensor **und** Remote-Aktor live über die echte Firmware-API angelegt (`POST /api/sensors` / `/api/actuators`, `type:"Remote"`) — beide erscheinen im Snapshot korrekt unter der selbst vergebenen lokalen `id` (nicht der Remote-ID), Sensor zeigt sauber `"ok":false` (kein Signal ohne Leaf), Aktor `"ok":true` mit Default-Zustand. Test-Items nach Verifikation wieder gelöscht.
- **Weiterhin nicht verifiziert:** echter State-Empfang von einem tatsächlichen Leaf-Knoten (kein zweites Testgerät verfügbar). Bräuchte entweder ein zweites geflashtes Board (`08_remote_mqtt/publisher.ino`) oder manuelles Publizieren auf die erwarteten Topics zum Simulieren eines Leaf.

**Nächster Schritt:** **Schritt 2 (Webhook-Remote)** wie oben skizziert. Bei Gelegenheit: echten Leaf-State-Empfang mit zweitem Board nachverifizieren.

## 2026-08-21 — Schritt 2 (Webhook-Remote) fertig, HW-verifiziert

Wie geplant umgesetzt, keine Überraschungen:

- **`WebhookService.h/.cpp`** neu (`BrewControl/firmware/src/`) — schlanker als `MqttService`, kein Settings-Bezug: `getOrCreate(port, peerUrl) → ITransport&` dedupliziert nach `(listenPort, peerBaseUrl)`, `tick()` pumpt alle gehaltenen `WebhookTransport`-Instanzen (nötig, da `WebhookTransport` einen synchronen `WebServer` nutzt, kein Free-Ride wie bei MQTT/ESPAsyncWebServer).
- **`DynamicItems`**: `"Remote"`-Typ akzeptiert jetzt `transport: "mqtt"|"webhook"` (Default `mqtt`, bestehende Schritt-1-Items ohne das Feld funktionieren unverändert weiter). Neue private Hilfsmethode `resolveRemoteTransport()` löst pro Sensor/Aktor auf, teilt sich Sensor- und Aktor-Zweig. Webhook-Felder: `listen_port` (1–65535, Pflicht), `peer_url` (Pflicht).
- **`main.cpp`**: `WebhookService` konstruiert, `dynamicItems.setWebhookService(&webhookService)` (immer, kein Enable-Toggle — passiver HTTP-Server, keine nennenswerten Kosten), `webhookService.tick()` in `loop()`.
- **`AddItemModal.tsx`**: Transport-Umschalter (MQTT/Webhook) im Remote-Block für Sensor **und** Aktor, bei Webhook zusätzlich Lokaler-Port/Peer-URL-Felder.

**Verifikation:** Firmware compile-smoke grün, `pnpm typecheck` grün. Live auf dem LilyGo-S3-Testgerät: Remote-Sensor **und** -Aktor mit `transport:"webhook"` angelegt (204), lokaler HTTP-Server auf dem gewählten Port bestätigt erreichbar (`GET` liefert 404 „no retained" statt Timeout — Server läuft), beide erscheinen im Snapshot korrekt unter der lokalen ID. Dedup bestätigt (Sensor + Aktor teilen sich denselben `(8080, peer_url)`-Transport, keine Bind-Kollision). Validierungsfehler geprüft: fehlender `listen_port` → 400, unbekannter `transport`-Wert → 400. UI im Browser bestätigt (Feldwechsel MQTT↔Webhook). Test-Items wieder gelöscht.

**Nicht verifiziert (wie bei MQTT):** echter State-Empfang von einem tatsächlichen Leaf-Knoten — kein zweites Testgerät verfügbar, macht der User später selbst.

**Nächster Schritt:** **Schritt 3 (ESP-NOW-Remote mit Fix)** wie oben skizziert.

## 2026-08-21 — Schritt 3 (ESP-NOW-Remote mit Fix) fertig, HW-verifiziert

Wie geplant umgesetzt:

- **Library-Fix** (`SensActCtrl/src/transport/EspNowTransport.cpp`, `initEspNow_()`): `WiFi.mode(WIFI_STA)` + `WiFi.disconnect()` + Kanal-Erzwingen laufen nur noch, wenn **nicht** schon eine STA-Verbindung besteht (`WiFi.isConnected()`). Wenn schon verbunden: WLAN unangetastet, `peer.channel = 0` (ESP-IDF: „aktuellen Kanal verwenden"). Rückwärtskompatibel — alle Standalone-Beispiel-Sketches (die nie selbst verbunden sind) laufen unverändert über den alten Zweig. Kein natives Testen möglich (RF-Verhalten, ARDUINO-only Code), wie im Plan vermerkt.
- **`main.cpp`**: `std::unique_ptr<EspNowTransport> espNowTransport` als globales Objekt, **erst nach erfolgreichem WLAN-Connect** konstruiert (direkt nach der „WiFi connected"-Zeile) — genau der Timing-Punkt, den der Fix voraussetzt. Kein Settings-Toggle (immer aktiv, passiver Broadcast-Empfang). Kein `tick()`-Aufruf nötig (`EspNowTransport::tick()` ist ohnehin ein No-Op, verbindungslos).
- **Bewusst abgewichen vom ursprünglichen Plan-Entwurf:** kein UI-Feld „channel" ergänzt. Grund: da `espNowTransport` in `main.cpp` erst nach WLAN-Connect gebaut wird, ist `staConnected` in `initEspNow_()` in diesem Kontext **immer** `true` — der Channel-Parameter des Konstruktors wird dann nie verwendet (`peer.channel` ist immer `0`, „aktueller Kanal"). Ein UI-Override hätte also nie einen Effekt gehabt; das Plan-Notiz war vor dem eigentlichen Fix-Design geschrieben.
- **`DynamicItems`**: `"Remote"`-Typ akzeptiert jetzt zusätzlich `transport:"espnow"` (dritte Option neben `mqtt`/`webhook`), keine weiteren Cfg-Felder nötig (wie MQTT). Neuer `setEspNowTransport()`-Setter, nullable wie `setMqttTransport()`.
- **`AddItemModal.tsx`**: dritte Transport-Option „ESP-NOW" im Remote-Block (Sensor + Aktor), keine zusätzlichen Felder.

**Verifikation:** Firmware compile-smoke grün, 192/192 native Tests grün (unverändert, da ESP-NOW-Fix nicht nativ testbar ist), `pnpm typecheck` grün. Live auf dem LilyGo-S3-Testgerät: Boot-Log zeigt sauberen WLAN-Connect **nach** `EspNowTransport`-Konstruktion (kein Disconnect — genau das, was der Fix garantieren soll). Remote-Sensor **und** -Aktor mit `transport:"espnow"` angelegt (204), Web-UI/API bleiben währenddessen durchgehend erreichbar (200), beide Items erscheinen korrekt unter lokaler ID im Snapshot. UI im Browser bestätigt (dritte Transport-Option sichtbar). Test-Items wieder gelöscht.

**Nicht verifizierbar ohne zweites Testgerät (wie geplant):** echte Kanal-Koexistenz mit tatsächlichem RF-Traffic von einem zweiten ESP-NOW-Peer — die Grundvoraussetzung (WLAN bleibt während ESP-NOW-Betrieb stabil) ist bestätigt, der volle Zwei-Geräte-Beweis fehlt noch.

**Damit sind alle drei geplanten Schritte (MQTT, Webhook, ESP-NOW) für kabellose SensActCtrl-Knoten abgeschlossen.** Offener Punkt für später: Zweitgeräte-Test für alle drei Transporte (echter State-Empfang von einem Leaf-Knoten).

---

## Pre-MVP: Planung, Implementierung, erste E2E-Tests (2026-05-17 – 2026-05-20)

## Diese Session (2026-05-17)

1. **Exploration**: SensActCtrl-Library analysiert (`README.md`,
   `PLAN.md`, `session.md`, `src/SensActCtrl.h`, Core-Interfaces
   `Sensor.h`/`Actuator.h`/`Controller.h`, `Registry.h`,
   `RegistrySnapshot.{h,cpp}`, `WebhookTransport.{h,cpp}`, Controller-
   Tuning-API). Schlüssel-Erkenntnis: Library ist bereits frontend-
   agnostisch designt — `serializeRegistry()` liefert kompletten JSON-
   Snapshot, ArduinoJson v7 ist Dep, kein neuer Wire-Format-Code nötig.

2. **Anforderungs-Klärung mit User** (4 Runden Feedback auf den Plan):
   - Projekt-Platzierung: separates `BrewControl/` (nicht in
     SensActCtrl integriert).
   - Scope: Voll (Lesen + Schreiben — Aktoren schalten, Setpoints +
     PID-Tunings setzen).
   - UI-Stack: Vite + Preact + Tailwind + pnpm + TypeScript.
   - Asset-Delivery: SD-Karte (hot-swappable, kein Firmware-Reflash).
   - Live-Updates: SSE (statt Polling).
   - WiFi-Provisioning: Setup-Portal beim Erstboot + Reset-Trigger
     (kein hartcodierter SSID/Password).
   - Future-Work-Wünsche notiert: OTA, HTTPS (für esp-webPush),
     QEMU-Dev-Loop, WiFi-Reset zur Laufzeit, Runtime-Registrierung
     von Sensoren/Aktoren/Controllern via WebUI.

3. **Plan finalisiert** (`PLAN.md`):
   - 11 Build-Schritte (Firmware → WiFi-Portal → WebUI-Klasse →
     Demo-Sketch → Vite-Projekt → Types → API-Layer → Components →
     README → E2E-Test).
   - Architektur-Entscheidung **ESPAsyncWebServer** statt sync
     `WebServer` aus dem ESP-Core, weil SSE saubere persistente
     Verbindungen über `AsyncEventSource` braucht und AsyncTCP in
     eigenem FreeRTOS-Task läuft → blockiert `Registry::tick()` nicht.
   - `lib_deps = symlink://../../SensActCtrl` für direkte Library-
     Einbindung ohne Publish-Roundtrip.
   - API-Vertrag dokumentiert (GET /api/snapshot, GET /api/events SSE,
     POST /api/actuators/:id, /api/controllers/:id/setpoint,
     /api/controllers/:id/params).
   - MVP-Limitation explizit dokumentiert: Add/Remove von Registry-
     Items zur Laufzeit ist Future Work (Owning-Storage + Factory +
     Persistenz + Pin-Konflikt-Check + UI-Forms erfordert Library-
     Erweiterungen wie `end()`-Hooks und `bind()`-Pattern).

## Status pro Plan-Schritt

| Schritt | Status | Notiz |
|---|---|---|
| 1. Repo-Skeleton (`firmware/platformio.ini` + leerer `main.cpp`) | ✓ | 23 s Build, 20.0 % Flash |
| 2. Library-Einbindung (SensActCtrl + AsyncWebServer + AsyncTCP) | ✓ | Erst-Download ESP32-Toolchain, 81 s, 20.1 % Flash |
| 3. WiFi-Setup-Portal (`WiFiSetupPortal.{h,cpp}`) | ✓ | WPA2-AP `BrewControl-Setup` / `brew-setup`, Captive-Portal HTML inline (~2 KB) |
| 4. WebUI-Klasse (`WebUI.{h,cpp}`) | ✓ | Per-Item-Routen statt prefix-matching (s. Deviations) |
| 5. Demo-Sketch in `main.cpp` (DS18B20 + Heater + PID + Boot-Logic) | ✓ | + mDNS `brewcontrol.local`; Voll-Firmware 71.8 % Flash, 14.5 % RAM |
| 6. Vite-Projekt-Skelett (`web/`) | ✓ | Vite 7.3.3 + Preact 10.29 + Tailwind 4.3 + TS 5.9 |
| 7. TypeScript-Typen für Snapshot-Shape | ✓ | `web/src/types.ts`, abgeleitet aus `RegistrySnapshot.cpp:36-86` + Enum-Header |
| 8. API-Schicht (`api.ts`) | ✓ | `getSnapshot`, `subscribeEvents`, `writeActuator`, `setControllerSetpoint/Params` |
| 9. Karten-Komponenten (Sensor/Actuator/Controller) | ✓ | + `useSnapshot`-Hook + 3-Spalten-Grid; Build 12 Module / 11 KB gzip total |
| 10. README | ✓ | DE; Setup + Build + Deploy + Troubleshooting |
| 11. E2E-Test auf Hardware | ✓ | LOLIN S2 Mini (kein SD/DS18B20/SSR); Setup-Portal + STA + mDNS + alle API-Endpoints + SSE verifiziert; zwei Bugs gefixt |

## Offene Punkte / Annahmen

- **Hardware-Verfügbarkeit**: SensActCtrl-Session.md notiert, dass HW-
  Smoke-Tests verschoben sind, weil kein Mikrocontroller verfügbar ist.
  Selbe Constraint gilt hier — Schritte 1–10 sind hardware-frei
  durchführbar (Compile-Smoke via `pio run`), Schritt 11 erst nach
  Hardware-Zugang.
- **SD-Pinout**: Default `SD.begin(5)` (CS auf GPIO 5) — boardabhängig,
  in `main.cpp` als `kSdCsPin` konstante exponiert.
- **Vite-Dev-Proxy**: IP des ESP32 muss in `vite.config.ts` eingetragen
  werden, sobald STA-Verbindung steht.
- **AsyncWebServer-Versionen**: Plan referenziert `esp32async/ESPAsyncWebServer@^3.1.0`
  + `esp32async/AsyncTCP@^3.2.0` (Hauptzweig nach Migration vom
  `me-no-dev`-Org). Vor Implementierung Compile-Check, ob die Version
  noch aktuell ist.

## Plan-Review 2026-05-17 (context7-gestützt)

Library-Versionen verifiziert, PLAN.md überarbeitet. Geänderte Stellen:

- **Tailwind v3 → v4**: `@tailwindcss/vite`-Plugin, `@import "tailwindcss";`
  statt `@tailwind`-Directives, `tailwind.config.ts` + `postcss.config.js`
  + `autoprefixer` entfallen (Lightning CSS built-in).
- **Vite ^6.0.5 → ^7.0.0**: keine API-Brüche bei `base`/`server.proxy`,
  `assetsInlineLimit` (Default) gestrichen.
- **`vite.config.ts` Proxy**: ESP32-IP über `web/.env.local`
  (`VITE_ESP_HOST`), nicht hardcoded.
- **`packageManager: pnpm@10`** in `package.json` gegen Lock-Drift.
- **WebUI-Klasse**: `AsyncCallbackJsonWebHandler` statt manueller
  `onBody`-Akkumulation; `beginResponseStream` statt 4 KB-Stack-Buffer
  (AsyncTCP-Task-Stack ist ~4 KB gesamt); `setCacheControl` + gzip-Serve.
- **Build-Schritt**: Pre-gzip von `dist/*.{js,css,html}` vor SD-Copy.
- **WiFi-Setup-Portal**: Default-WPA2-Passwort statt offenem AP
  (Heim-WiFi-PW würde sonst im Klartext über die Luft gehen).
- **`platformio.ini`**: `monitor_filters = esp32_exception_decoder`.
- **`SD.begin`**: Strapping-Pin-Warnung für GPIO 5 (MTDI) im Plan, mit
  Fallback-Pin-Empfehlung für README.

ESPAsyncWebServer + AsyncTCP unter `esp32async/`-Org bestätigt (Plan war
richtig). Snapshot-Endpoint, Routen-Parsing via String-Split und
SSE-API (`onConnect`/`send(data, eventName, id)`) matchen die aktuelle
Library-API.

## Plan-Review #2 2026-05-17 (Sibling-Library-Verifikation + Architektur)

Zweiter Pass: Explore-Subagent gegen `../SensActCtrl/src/`, plus
eigenhändige Reads von `Registry.h`/`Sensor.h` zu Concurrency-Aspekten.

- **API-Verifikation 1:1 sauber** — alle 10 zitierten Calls
  (`serializeRegistry`, Registry-Lookups, Iteratoren, `Actuator::write`,
  `Controller::setSetpoint`/`setParamsJson`, `Registry::begin`/`tick`)
  existieren mit den im Plan zitierten Signaturen. Snapshot-Shape
  matcht `RegistrySnapshot.cpp:36–86` exakt (`params` ist nested
  JSON-Object). ArduinoJson v7 ist Transitive-Dep über `library.json`,
  kein expliziter `lib_deps`-Eintrag in `firmware/platformio.ini` nötig.
  Example `02_pid_mash.ino` referenziert das exakte Sketch-Pattern,
  das `main.cpp` adoptiert.
- **Concurrency-Hinweis** in § WebUI ergänzt: `serializeRegistry()`
  läuft im AsyncTCP-Task, `Registry::tick()` im loopTask — torn reads
  auf `Reading` (float+timestamp+ok) sind theoretisch möglich, für
  Dashboard tolerierbar; bei Bedarf `portMUX_TYPE` oder Latest-Snapshot-
  Buffer mit Pointer-Swap.
- **mDNS** in § main.cpp ergänzt: `MDNS.begin("brewcontrol")` +
  `addService("http","tcp",80)` → UI primär via
  `http://brewcontrol.local/`, IP nur Fallback. Verifikation-Schritt 2
  entsprechend angepasst.
- **WiFi-Reconnect-Negative-Test** als Eintrag 10 ergänzt: Router-Reboot
  / `WiFi.disconnect()`; UI + SSE müssen in ≤60 s resumen. `STA_GOT_IP`-
  Event-Hook für `server.begin()` nur, wenn Test fehlschlägt
  (Lazy-Optimierung).

## Nächster Schritt

MVP ist funktional verifiziert. Offene Punkte sind alle peripherie-
gebunden (kein SD-Modul / DS18B20 / SSR im aktuellen Setup):
- UI vom SD laden (statt nur curl gegen die API)
- DS18B20-Live-Reads + Stale-Badge mit echtem ok-Flag-Toggle
- Heater-TPO-Schalten validieren (Oszi / SSR-Last)
- Negative-Tests aus PLAN.md § Verifikation, die SD voraussetzen
  (Test 8: SD entfernen mid-flight)

## Implementierung 2026-05-18

Steps 1–10 in einer Session durchgebaut, jeder Step mit Compile-/Build-
Smoke verifiziert. Firmware kompiliert komplett (71.8 % Flash, 14.5 %
RAM); Web-Bundle 33 KB raw / 11 KB gzipped (12 Module).

**Deviations vs. PLAN.md:**

- **WebUI-Routen: per-item exact-match statt prefix-routing.**
  `AsyncCallbackJsonWebHandler` macht nur exact-URL-Match (kein
  Wildcard/Path-Template). PLAN.md's `parseIdAfter`-Sample war
  illustrativ; Implementierung iteriert `registry.actuators()` /
  `controllers()` in `WebUI::begin()` und registriert eine Route pro
  Item. Trade-off: bedingt, dass Registry vor `WebUI::begin()` voll
  populiert ist (im Demo-Sketch sowieso so). Unknown-IDs → 404
  automatisch (kein Handler matcht). Spart `parseIdAfter`-Helper-Code.

- **`packageManager: "pnpm@11.1.2"`** statt `pnpm@10` im Plan —
  pinned auf die lokal installierte Version.

- **pnpm 11 "approve-builds"-Gate stört.** pnpm 11 blockt esbuild's
  Post-Install-Script per Default; `pnpm.onlyBuiltDependencies` in
  package.json wird nicht respektiert. `pnpm build` triggert intern
  ein erneutes Install (`runDepsStatusCheck`), das wieder am Gate
  scheitert. Vite läuft trotzdem (esbuild-Binary kommt via optional
  dep `@esbuild/win32-x64`) wenn direkt aufgerufen:
  `node node_modules/vite/bin/vite.js build`. Permanente Fixes für
  Nutzer: einmalig `pnpm approve-builds esbuild` interaktiv. Im
  README troubleshooting-Block dokumentiert.

- **Vite-Build über direkten Node-Aufruf** statt `pnpm build` während
  der Implementation (s.o.) — Workaround, nicht Dauerzustand.

**Beobachtungen, die in PLAN.md noch nicht standen:**

- **SD-Karten-Fail ist nicht fatal:** API-Routen (snapshot, actuators,
  controllers, events) funktionieren weiter, nur `serveStatic` liefert
  nichts. UI lädt also nicht, aber `curl http://<ip>/api/snapshot` geht.
  In `main.cpp` als non-fatal mit Serial-Warning implementiert (statt
  PLAN.md's "Abbruch mit Serial-Fehler").

- **Bundle-Size 11 KB gzipped** (Skeleton + 3 Karten + Tailwind v4) —
  deutlich unter PLAN.md's 50–80 KB-Erwartung. Tailwind v4 + Lightning
  CSS shaken aggressiver als v3 + autoprefixer.

- **`tsconfig.json` `include`** auf `["src"]` reduziert — `vite.config.ts`
  würde `@types/node` brauchen (`process.cwd`), Vite parst die Config
  aber intern via esbuild und braucht keinen tsc-Check.

**Status der Pass-Reviews relativ zur Implementierung:**

Beide Reviews (context7 + sibling-API) haben sich gerechtfertigt: API-
Calls aus PLAN.md kompilierten ohne Korrektur gegen die Library; Tailwind
v4 / Vite 7 / AsyncCallbackJsonWebHandler / `beginResponseStream` haben
genau so funktioniert wie im Plan vorgesehen. mDNS-Add, Concurrency-
Hinweis-Block und WiFi-Reconnect-Test (Negative-Test 10) sind in den
finalen Plan eingegangen aber nicht implementiert (1: nur Doku im
WebUI.h-Kommentar; 2: implementiert im `main.cpp`; 3: HW-test, deferred).

## E2E-Test 2026-05-18 (LOLIN S2 Mini)

User hat ESP32-S2 Mini angeschlossen. Hardware ohne Peripherie (kein
SD, DS18B20, SSR) — Test focus auf Boot + Setup-Portal + API + SSE.

**Setup für S2:**

- `platformio.ini` umgebaut zu `[common]` + `[env:esp32dev]` +
  `[env:lolin_s2_mini]` (additiv, beide Boards parallel build-bar).
- S2-spezifisch: `-DARDUINO_USB_CDC_ON_BOOT=1` für Serial über USB-CDC.
- Build: Toolchain `toolchain-xtensa-esp32s2` per Erst-Download (~3 min);
  Footprint 67.7 % Flash / 16.4 % RAM (kleiner als ESP32 dank fehlendem
  Classic-BT).
- Flash-Mechanik: erste Flash braucht manuelles DFU (BOOT halten + RST
  kurz drücken). esptool kann den S2 nicht selbst rauskommen lassen aus
  Download-Mode — Warning "manual reset required" am Ende ist normal,
  trotz erfolgreichem Schreiben + Hash-verify.
- COM-Port-Tanz: ROM-DFU enumeriert als VID:PID 303A:0002 (üblicher-
  weise COM5), running Firmware als 303A:80C2 (TinyUSB-CDC, neuer COM-
  Port nach Reset — bei mir COM6). `pio device monitor` verliert die
  Connection beim Übergang, muss explizit auf den neuen Port verbinden.

**Bugs gefunden + gefixt:**

1. **`WiFi.mode(WIFI_AP)` reicht nicht für `scanNetworks()`** — pure
   AP-Mode hat keine STA-Capability; scanNetworks crashed den S2
   (single-core, kein definierbarer Fail-Pfad). Fix: `WIFI_AP_STA`
   in `WiFiSetupPortal.cpp`.

2. **Blocking `scanNetworks()` aus AsyncTCP-Task crashed weiterhin** —
   selbst mit AP_STA. Ursache: S2 single-core, AsyncTCP-Task blockt den
   WiFi-Driver, oder Stack-Overflow während Scan + JSON-Serialisierung.
   Fix: `WiFi.scanNetworks(/*async=*/true)` + Client-Polling (HTTP 202
   während running, 200 wenn fertig). HTML-Page macht Poll-Loop bis zu
   30 s. Side-Effect: erstes "Scanning..." dauert 2-5 s, ist aber stabil.

3. **Serial-Output nach Boot leer** — USB-CDC enumeriert ~1-2 s nach
   Boot; ersten `Serial.println`s gingen verloren. Fix: `while
   (!Serial && millis() < 3000) delay(10);` in `setup()` wartet auf
   Host-Connect, mit 3 s Headless-Fallback. Auf S2 mit pio monitor
   blieb der Pfad trotzdem leer — Bekanntes pio-Monitor + TinyUSB-CDC
   Buffering-Issue auf Windows. Nicht weiter verfolgt da E2E-Test
   ohne Serial möglich war (mDNS + curl).

**E2E-Test-Outcome:**

- Setup-Portal-AP `BrewControl-Setup` mit WPA2-Default-Passwort
  `brew-setup` sichtbar ✓
- Scan-Liste durchlief (nach async-Fix) ohne MC-Reset ✓
- Heim-WiFi-Auswahl + Submit → "Rebooting" → ESP.restart ✓
- STA-Connect zu Heim-WiFi (192.168.178.86) ✓
- mDNS-Resolve `brewcontrol.local` → 192.168.178.86, 3 ms ping
  (Windows 11 hat mDNS native, kein Bonjour nötig) ✓
- `GET /api/snapshot` → vollständiges JSON mit allen 3 Items ✓
- `POST /api/controllers/mash_pid/setpoint {"v":70.5}` → HTTP 204,
  Wert im nachfolgenden Snapshot reflected ✓
- `POST /api/actuators/heater {"v":0.7}` → HTTP 204, in Snapshot ✓
- `GET /api/events` mit `Accept: text/event-stream`-Header → SSE-
  Stream mit named "snapshot"-Events, aktuelle Werte ✓
- `POST /api/actuators/does_not_exist` → HTTP 404 (Per-Item-Routing
  führt zu sauberen 404s wie geplant) ✓
- Sensor `mash_temp` zeigt `state.ok=false, v=-127` — DS18B20-Driver
  liefert den korrekten "device disconnected"-Sentinel ohne Crash ✓

**Nicht testbar mangels Peripherie:**

- UI-Load vom SD (serveStatic-Pfad). API allein voll funktional.
- DS18B20-Live-Reads + state.ok-Toggle bei realem Sensor.
- Heater-TPO-Schalten unter Last (Oszi / SSR).
- Negative-Test 8 aus PLAN.md (SD entfernen mid-flight).

**Folge-PLAN-Edits (erledigt 2026-05-18):**

PLAN.md um die zwei behobenen Bugs + S2-Verifikations-Hinweis ergänzt:
- ✓ § WiFi-Setup-Portal: `WIFI_AP_STA` (statt nur `WIFI_AP`),
  async-scan-Pattern mit Client-Polling, Begründung "Crash auf
  ESP32-S2 single-core".
- ✓ § Verifikation: `pio monitor` auf S2 ist unzuverlässig; mDNS + curl
  als primärer Verifikations-Pfad dokumentiert.
- ✓ § Future Work: Serial-via-pio-monitor auf S2 mit Windows reliable
  bekommen (eventuell `--filter direct` + reconnect tuning).

## QEMU-Research-Spike 2026-05-18

User wollte QEMU als Hardware-freie Dev-Option angehen. Statt direkt zu
installieren erst Research zur aktuellen Lage — Ergebnis: **Spike
vertagt**, da QEMU für unseren Use-Case keinen Mehrwert bringt.

**Konkrete Befunde** (Quelle: github.com/espressif/qemu releases +
github.com/espressif/esp-toolchain-docs/blob/main/qemu/README.md):

- Latest Release `esp-develop-9.2.2-20260417` (19. April 2026), Prebuilt
  Windows x86_64 vorhanden — wäre also installier-bar.
- **Target-Support: ESP32, ESP32-S3, ESP32-C3. KEIN ESP32-S2.**
  Unsere reale HW (LOLIN S2 Mini) fällt raus; build-artifacts auf disk
  sind nur `lolin_s2_mini/*.bin`, kein `esp32dev`-build vorhanden.
- **WiFi: ❌** über alle Targets. Ersatz wäre Ethernet — würde
  `WiFiSetupPortal` + `main.cpp`-Boot-Flow + AsyncWebServer-WiFi-
  Bindung umbauen → kein "drop-in" mehr.
- **SD: nur ESP32 partielle Unterstützung** (S3/C3 ❌). SPI-`SD.begin`
  vermutlich → `SD_MMC`-Pfad nötig.
- Boot-Workflow wäre: `esptool merge_bin` (bootloader + partitions +
  firmware) → `qemu-system-xtensa -machine esp32 -drive
  file=flash.bin,if=mtd,format=raw -nographic -serial mon:stdio`.

**Entscheidung**: PLAN.md § QEMU-Dev-Option neu geschrieben mit den
konkreten Befunden statt vager Annahmen. Future-Work-Eintrag verkürzt
auf Re-Trigger-Bedingung (WiFi-Emulation in QEMU **oder** Projekt-Port
auf S3 + Ethernet-Pfad).

## WiFi-Reset zur Laufzeit 2026-05-18

PLAN.md-Future-Work-Punkt umgesetzt: Reset der WiFi-Credentials per
WebUI-Button statt nur per BOOT-Button-Power-On-Halten.

**Backend** (`firmware/src/WebUI.{h,cpp}`):
- Neuer Handler `POST /api/admin/wifi-reset` (kein Body).
- Klärt `Preferences("brewctrl")` (selber Pfad wie BOOT-Button in
  `main.cpp`), sendet 204, setzt `rebootAtMs_ = millis() + 500`.
- `tick()` ruft `ESP.restart()` sobald Deadline überschritten — gibt
  AsyncTCP Zeit, die Response zu flushen, ohne den Task zu blocken.
- Kein Auth (matched Rest der API, Hobby-LAN-Annahme — Diskussion siehe
  AskUser-Block diese Session).

**Frontend** (`web/src/`):
- Neue Komponente `components/ConfirmModal.tsx` — generisch (title +
  children + destructive-Variant + pending-State), Backdrop-Click +
  Cancel-Button schließen. Erstmal nur ein Aufrufer.
- `api.ts`: `wifiReset()`.
- `app.tsx`: in `<Dashboard>` und `<RebootingView>` aufgesplittet,
  `<App>` hält den `rebooting`-Toggle. Header bekommt einen kleinen
  outline-Button "Reset WiFi" rechts neben dem Titel.
- Erfolgs-Flow: POST 204 → `setRebooting(true)` → `<RebootingView>`
  rendert, useSnapshot unmounted (schließt SSE), Hinweis "connect to
  BrewControl-Setup AP".

**Footprint-Δ** (Compile-Smoke, kein E2E):
- esp32dev: 71.8 % → 71.9 % Flash, RAM unchanged (14.5 %).
- lolin_s2_mini: 67.7 % → 67.8 % Flash, RAM unchanged (16.4 %).
- Web-Bundle: 12 → 13 Module, 11 KB → 12 KB gzipped (Modal+Reset-State).

**Nicht implementiert (bewusst weggelassen):**
- ESC-Key-zum-Schließen des Modals.
- Body-Scroll-Lock während Modal offen ist.
- Auth/Token — siehe oben.

**Offen für Hardware-Test:**
- Verify end-to-end: Click → Confirm → 204 → Reboot → Setup-AP wieder
  sichtbar (gleicher Pfad wie BOOT-Button-Halten, sollte funktionieren).

## E2E auf LilyGo T-Display-S3-AMOLED-1.43 2026-05-18

User hat einen ESP32-S3 mit integriertem SD-Slot angeschlossen (T-Display-
S3-AMOLED-1.43, 466×466 round AMOLED, 16 MB Flash, 8 MB OPI PSRAM). Das
war der erste Test des kompletten SD-served-UI-Pfads (Test 8 aus
PLAN.md, seit Projekt-Start offen).

**Platformio-Setup:**

- Neuer `[env:lilygo_t_display_s3_amoled]`. Installierte
  `espressif32@6.3.2` kennt weder `lilygo-t-amoled` noch
  `esp32-s3-devkitm-1` als Board-ID; Fallback auf `lilygo-t-display-s3`
  (selber Chip, 16 MB, qio_opi, USB-CDC). Wir treiben das Display nicht
  an — LCD-vs-AMOLED ist firmware-irrelevant.
- Pin-Overrides via Build-Flags: `BREWCTL_SD_CS/SCK/MOSI/MISO` und neu
  `BREWCTL_ONEWIRE_PIN`/`BREWCTL_SSR_PIN`, damit die Demo-Pins (4/16)
  nicht mit board-spezifischer Belegung kollidieren. main.cpp hat
  `#ifndef`-Defaults und einen `#ifdef BREWCTL_SD_SCK`-Zweig, der eine
  explizite `SPIClass(HSPI)` mit den Custom-Pins aufzieht statt den
  Default-SPI-Bus zu nutzen.
- Footprint: 878 KB Flash, 47 KB RAM (kleinste der drei envs).

**Pin-Hunt — drei Iterationen:**

1. **5/35/36/37** (aus generischem "AMOLED"-Search-Hit, eigentlich 1.91-
   Variante): TG1WDT-Crash beim `SD.begin()`. **Root cause:** GPIO 33–37
   sind auf ESP32-S3 mit OPI-PSRAM intern vom PSRAM-Controller belegt;
   das Arduino-SPI hat versucht, die Pins zu hijacken, PSRAM-Access
   blockierte, IDLE-Task verhungerte, Task-Watchdog feuerte.
2. **4/41/39/40** (aus Search-Hit für "AMOLED-1.43-1.75"): Boot durch,
   aber `sdCommand(): Card Failed! cmd: 0x00` — SPI funktionierte, Karte
   antwortete nicht. MISO/MOSI-Swap gab identisches Verhalten.
3. **38/41/39/40** (user-verifiziert vom Board-Silkscreen): **funktioniert**.
   CS war's, nicht die Datenleitungen.

→ Lehre für die Doku: bei jeder neuen S3-AMOLED-Sub-Variante (1.43,
1.64, 1.75, 1.91, Plus, Touch) ist der SD-Pinout anders. Web-Quellen
verwechseln die Varianten regelmäßig; einzig verlässlich ist der
Silkscreen auf dem Board.

**Debug-Workflow, der sich gelohnt hat:**

- `pio device monitor` weiterhin unzuverlässig auf S3+TinyUSB+Windows
  (S2-Issue bleibt). **PowerShell-Workaround:**
  `System.IO.Ports.SerialPort COM7,115200,…; $port.Open(); DTR/RTS-Toggle
  für Reset; ReadExisting()-Loop`. Damit kann der Host das Board
  programmatisch reseten und den Boot-Output ohne pio-Monitor lesen —
  perfekt für automatisierte Diagnose-Iterationen.
- Auto-DFU funktionierte via `esptool` (`Hard resetting via RTS pin`),
  kein manueller BOOT+RST nötig — anders als beim S2.

**E2E-Verifikation komplett:**

| Test | Resultat |
|---|---|
| Erstboot ohne Creds → Setup-AP `BrewControl-Setup` (WPA2) | ✓ |
| Async-Scan + Heim-WiFi-Select + Submit + Reboot | ✓ |
| STA-Connect (192.168.178.87), mDNS `brewcontrol.local` | ✓ Serial / ✗ Windows-Resolver |
| `SD mounted` Serial-Output | ✓ (nach Pin-Korrektur) |
| `GET /` lädt index.html aus SD (397 B) | ✓ — Test 8 aus PLAN.md endlich grün |
| Browser-UI: 3 Spalten, alle Items, Stale-Badge für `mash_temp` (-127) | ✓ |
| `POST /actuators/heater {"v":0.6}` → 204, Snapshot reflektiert | ✓ |
| `POST /controllers/mash_pid/setpoint {"v":72.5}` → 204 | ✓ |
| `POST /actuators/does_not_exist` → 404 (Per-Item-Routing) | ✓ |
| SSE-Live-Updates im Browser | ✓ |
| **Neuer Reset-WiFi-Button → Confirm-Modal → 204 → Reboot → Setup-AP** | ✓ |

Damit ist auch die WiFi-Reset-Implementation dieser Session E2E
verifiziert (nicht nur Compile-Smoke).

**Verbleibende Offene Punkte (alle peripherie-gebunden):**

- DS18B20-Live-Reads mit echtem Sensor (heute zeigt `state.ok=false,
  v=-127` korrekt mit Stale-Badge)
- Heater-TPO-Schalten unter SSR-Last (Oszi)
- Negative-Test 8 aus PLAN.md "SD entfernen mid-flight" (heute nur
  "ohne SD booten" verifiziert)

**PLAN.md-Folgearbeiten:**

- § Verifikation: PowerShell-Serial-Reset-Trick dokumentieren als
  Workaround für unreliable `pio monitor` auf S3+Windows.
- README/§ Build-Reihenfolge: pro Board einen Pin-Map-Block (esp32dev:
  default 5/16/4; S2 Mini: default; AMOLED-1.43: 38/41/39/40 + OneWire/SSR
  auf 1/2).

## Runtime-Item-Add/Remove E2E-Test 2026-05-18 (T-Display-S3-AMOLED-1.43)

Feature implementiert (Details: kompakter Kontext-Summary): `DynamicItems`
mit owning-Storage, SD-Persistenz via `/config/registry.json`, 6 neue
Endpoints in WebUI, Preact-Frontend mit AddItemModal + Delete-Button.
Drei Build-Envs kompilieren (73.3 % Flash, 14.4 % RAM auf S3-AMOLED).
Web-Bundle: 14 Module, 9.95 KB gzip.

**E2E-Test-Outcome:**

| Test | Resultat |
|---|---|
| `GET /api/snapshot` → 3 statische Items (mash_temp, heater, mash_pid) | ✓ |
| `POST /api/sensors {"type":"DS18B20","id":"boil_temp","pin":5}` → 204, sofort im Snapshot | ✓ |
| `POST /api/actuators {"type":"DigitalOutput","id":"boil_heater","pin":16,"mode":"Binary"}` → 204 | ✓ |
| `POST /api/controllers {"type":"PID","id":"boil_pid","sensor":"boil_temp","actuator":"boil_heater",...}` → 204 | ✓ |
| `DELETE /api/sensors/mash_temp` (statisch) → 405 | ✓ |
| `DELETE /api/sensors/boil_temp` während `boil_pid` davon abhängt → 405 (Dependency-Guard) | ✓ |
| Delete in korrekter Reihenfolge Controller→Sensor→Aktor → 204 je | ✓ |
| `POST /api/sensors` mit bereits vorhandenem ID → 400 | ✓ |
| Reboot (via RTS-Puls): `persist_sensor` + `persist_relay` nach Reboot wieder da | ✓ |
| SD-Serve: `GET /` liefert gzip-komprimiertes index.html (267 B) | ✓ |
| SSE: dynamische Items erscheinen im event-stream | ✓ |

**Implementierungs-Deviations vs. PLAN.md (Future-Work-Eintrag):**

- `end()`-Hooks + `remove()` in SensActCtrl-Library nachgezogen (rückwärts-
  kompatibel: Default-Implementierungen als No-Op in Basis-Klassen).
- `DigitalOutputActuator::end()` setzt Pin auf sicheren Zustand (false).
- WebUI nutzt prefix-basiertes Routing über Custom-`AsyncWebHandler`-
  Subklassen (`BodyPrefixHandler`, `DeletePrefixHandler`) für die
  Create/Delete-Endpoints. `AsyncCallbackJsonWebHandler` (exact-URL) für
  die drei Create-Endpoints.
- DynamicItems-Storage: `std::vector<std::unique_ptr<Entry>>` mit
  heap-allozierten Entries — stabilisiert `id.c_str()`-Pointer bei
  Vektor-Reallokation.
- `/config`-Verzeichnis wird on-demand bei erstem `saveToSD()` angelegt;
  `loadFromSD()` ist tolerant bei fehlendem File (first boot).

**Verbleibende Offene Punkte:**

- DS18B20-Live-Reads mit echtem Sensor
- Heater-TPO-Schalten unter SSR-Last (Oszi)
- Negative-Test "SD entfernen mid-flight"
- Browser-UI-Test (AddItemModal, Delete-Button) — kein Playwright-Browser
  verfügbar in dieser Session; API vollständig verifiziert

## Bus-Discovery + Multi-Sensor OneWire 2026-05-20

Feature: Mehrere DS18B20-Sensoren an einem OneWire-Pin können jetzt über ihre
ROM-Adresse voneinander unterschieden werden. Dafür wurden drei Schichten erweitert.

**Motivation:** Beim Hinzufügen eines DS18B20 wurde bisher nur der GPIO-Pin
angegeben. OneWire erlaubt mehrere Sensoren auf einem Pin; ohne ROM-Adresse
sind sie nicht differenzierbar. Ohne Discovery-Endpoint muss der User die
64-bit-Adresse blind eintippen — nicht praxistauglich.

**Geänderte Dateien:**

*SensActCtrl Library:*
- `src/sensors/DS18B20Sensor.h/.cpp` — neues `static DS18B20Sensor::scanBus(pin,
  out, maxDevices)`: erstellt temporäre `OneWire`+`DallasTemperature`-Instanz,
  enumeriert alle Geräte via `getDeviceCount()`/`getAddress()`, gibt ROM-Adressen
  zurück. Arduino-only; native-Build-Stub gibt 0 zurück.

*BrewControl Firmware:*
- `DynamicItems.h` — neues `BusEntry`-Struct + `onewireBuses_`-Vektor (vor `sensors_`
  deklariert, korrekte Destruction-Order), private `getOrCreateBus(pin)` +
  `parseHexAddress(hex, out)`. Benötigt `<OneWire.h>`.
- `DynamicItems.cpp` — DS18B20-Factory extended: optionales `address`-Feld (16-Hex-
  String) → `DS18B20Sensor(id, sharedBus, addr)`; ohne Feld → altes
  Verhalten `DS18B20Sensor(id, pin)` (rückwärtskompatibel). `getOrCreateBus`/
  `parseHexAddress` implementiert.
- `WebUI.h/.cpp` — neuer `GET /api/bus/scan?type=onewire&pin=N`-Handler:
  ruft `DS18B20Sensor::scanBus()`, serialisiert Ergebnisse als JSON-Array
  `[{"index":0,"address":"28ff..."}]`.

*BrewControl Web:*
- `types.ts` — `ScannedDevice` + `BusScanResult` Interfaces
- `api.ts` — `scanOneWireBus(pin)`
- `AddItemModal.tsx` — Scan-Button neben Pin-Input; Ergebnis-Liste mit Radio-
  Buttons; 1 Gerät → Auto-Select; kein Scan → Single-Sensor-Modus wie bisher.
  `createSensor`-Call bekommt `address`-Feld wenn ausgewählt.

**Verifikation:**
- Firmware `esp32dev` kompiliert: `SUCCESS` (73.6 % Flash / 14.5 % RAM — unverändert)
- `pnpm typecheck`: keine Errors
- `pio test -e native`: MinGW nicht in PATH dieser Session — User muss mit
  `$env:PATH = "$env:USERPROFILE\.platformio\mingw64\bin;$env:PATH"` voranstellen
  (Setup in `SensActCtrl/session.md` dokumentiert)

**Caveat:** `scanBus` blockiert ~100 ms aus dem AsyncTCP-Task (einmalig, user-
ausgelöst). Wenn ein DS18B20 bereits auf dem selben Pin läuft, kann die parallele
OneWire-Aktivität dessen laufende Konversion abbrechen → einmaliges
`DEVICE_DISCONNECTED_C` im nächsten Reading. Harmlos für das Dashboard.

**Persistence:** `cfgJson` in `DynamicItems` speichert das komplette cfg-Object
inklusive `address`-Feld → Reload aus `/config/registry.json` nach Reboot
rekonstruiert die Shared-Bus-Instanz korrekt.

## Dev-Workflow-Verbesserungen 2026-05-18

**Lokaler Dev-Proxy:**

- `web/.env.local` angelegt mit `VITE_ESP_HOST=http://192.168.178.87`.
  `vite.config.ts` liest diesen Wert bereits (`loadEnv` + `server.proxy`),
  war bisher nur nicht dokumentiert.
- Workflow: `pnpm dev` → HMR auf `localhost:5173`, alle `/api/*`-Requests
  transparent an den ESP32 im Netz. SD-Karten-Deploy nur noch für
  Release-Builds nötig.

**pnpm-Build-Fix:**

- `pnpm approve-builds` (einmalig) behebt den pnpm-11-esbuild-Gate.
  Danach funktioniert `pnpm build` normal — der `node node_modules/vite/…`-
  Workaround aus der letzten Session entfällt.
- SESSION.md-Deviation-Notiz von 2026-05-18 bleibt korrekt für frische
  Checkouts ohne `approve-builds`.

**`build:sd`-Script:**

- `scripts/gzip-dist.js` extrahiert die gzip-Logik aus dem langen
  PowerShell-Oneliner.
- `package.json` bekommt `"build:sd": "vite build && node scripts/gzip-dist.js"`.
- SD-Deploy-Workflow jetzt: `pnpm build:sd` + `robocopy dist D:\ /E /NFL /NDL`.

---

## WinUI-3-Politur Teil 1–5 (2026-07-13 – 2026-07-25)

## Session 2026-07-13 — WinUI-3-Politur: semantisches Farbsystem

**Kontext:** Auf Wunsch „WinUI-3 verfeinern, ganzes Frontend". Kein Umbau,
sondern eine Konsistenz-/Politur-Runde auf dem bestehenden Fluent-Stil. Analyse
fand 44 hartcodierte Tailwind-Farbklassen über 15 Dateien + einen echten
Dark-Mode-Bug: Status-Badges als `bg-amber-100 text-amber-800` /
`bg-yellow-100 text-yellow-800` (Stale-/Fault-Badge) → helle Füllung + dunkler
Text auf dunkler Karte, unleserlich.

**Umgesetzt:**
- **Semantisches Farbsystem** ([styles.css](web/src/styles.css)): Tokens
  `--success/--caution/--critical` (Spiegel der WinUI `SystemFillColor`), pro
  Theme getunt (hell: #0f7b0f/#9a5b00/#c42b1c; dunkel: #6ccb5f/#fcd34d/#ff99a4),
  in `[data-theme=dark]` **und** im `prefers-color-scheme`-Media-Query (konsistent
  zur bestehenden Doppel-Definition). In `@theme inline` gemappt →
  `text-success/-caution/-critical`.
- **Geteilte Klassen** ([ui.ts](web/src/ui.ts)): Badge-Konstanten
  `badge{Caution,Success,Critical}` — getönte Füllung via
  `bg-[color-mix(in_srgb,var(--…)_16%,transparent)]` (mischt den Semantik-Ton
  über die Kartenfläche → adaptiert hell/dunkel automatisch) + legible Textfarbe.
  `btnPrimary/Secondary/Danger` um WinUI-Pressed (`active:`) + Focus-Stroke
  (`focus-visible:ring-…`) erweitert; `linkDanger` auf `text-critical`.
- **Roh-Farben migriert** (Karten, Modals, 7 Settings-Seiten): Stale-/Fault-
  Badges → `badgeCaution`; Programm-Status-Pills → Success/Caution-Tint;
  Fehlertexte/Delete-Hover `red-*` → `text-critical`/`hover:text-critical`;
  AutoTune läuft/fertig → `text-caution`/`text-success`; Sensor-Reset-Hover
  `blue` → `hover:text-accent`. **Bewusst belassen** (kein Bug, in beiden Themes
  lesbar): solider Danger-Button (`red-600`), alpha-getönte Info-Leisten
  (`amber-500/10`), solide Emphasis-Pills („aktiv"/„Update verfügbar"),
  `sky` „pausiert".

**Verifikation:** `pnpm typecheck` grün; `pnpm build` grün (182,5 kB JS /
60,7 kB gzip — kein Sprung; `color-mix`-Arbitrary-Values kompilieren). Browser
gegen echten ESP32 (`brewcontrol.local` via Dev-Proxy): Dashboard lädt mit Live-
Daten, keine Konsolen-Fehler. **Dark-Mode-Fix belegt** per Computed-Style-Probe:
`badgeCaution` liefert hell dunklen Text (#9a5b00) auf hellem 16%-Amber-Tint,
dunkel hellen Text (#fcd34d) auf dunklem 16%-Tint — beide lesbar, statt der alten
hellen Fläche auf dunkler Karte. (Screenshot-Capture der Preview timeoutet
umgebungsbedingt — visueller Beleg daher über read_page + Computed-Styles.)

## Session 2026-07-13 — WinUI-3-Politur Teil 2: neutrale Palette, Mica-Shell, Win11-Settings

**Kontext:** Nutzer-Feedback nach Teil 1: (1) Farbschema „gar nicht nach WinUI",
im Dark-Mode „alles irgendwie braun"; (2) Trennlinie + unterschiedliche
Hintergründe zwischen Seitenleiste und Inhalt passen nicht zu WinUI; (3) Settings
sollen sich mehr an Windows 11 anlehnen. Abgestimmt: Windows-Blau als Default,
Win11-Zeilenlook über **alle** Settings-Seiten.

**1. Palette entbraunt ([styles.css](web/src/styles.css)):** Das warme stone-*
verursachte den Braunstich. Ersetzt durch neutrale Windows-11-Grautöne (nur
Token-**Werte**, Namen unverändert → propagiert auf alle `bg-surface`/`bg-bg`/
Border/Text). Hell: `--bg #f3f3f3`, `--fg #1a1a1a`, `--border #e5e5e5`. Dunkel:
`--bg #202020`, `--surface #2b2b2b`, `--fg #fafafa`, `--border #363636`. Tints
(warm/kalt) auf die neutrale Basis rebased.

**2. Windows-Blau als Default-Akzent:** `--accent #0078d4` in styles.css;
AppearancePage-Initialwert + neues „Windows-Blau"-Preset an erster Stelle;
Firmware-Default [SettingsStore.h](firmware/src/SettingsStore.h) `#d97706`→`#0078d4`.
⚠ Greift nur bei **ungesetztem** Wert — Geräte mit gespeicherter Farbe (Testgerät:
Grün) behalten ihre Wahl; frische Config / Preset-Klick → Blau. Firmware-Default
braucht Reflash.

**3. Mica-Shell ([NavShell.tsx](web/src/components/NavShell.tsx)):** `border-r`
entfernt; Desktop-Nav `md:bg-transparent md:backdrop-blur-none` → teilt die
Shell-Fläche mit dem Content (durchgehendes Mica, keine Trennlinie, kein
Hintergrundunterschied). Mobile-Drawer behält Acrylic + Backdrop. Aktiv-Eintrag
weiter `bg-fg/5` + Akzent-Pill.

**4. Win11-Settings ([SettingsCard.tsx](web/src/components/SettingsCard.tsx), neu):**
`SettingsGroup` (optionaler uppercase-Sektionslabel) + `SettingsCard` (Icon +
Titel + Beschreibung links, Control/Chevron rechts, optional Full-width-`children`
für komplexe Controls; rendert als `a`/`button`/`div`). Alle 8 Seiten umgestellt:
Index (Kachel-Links + Update-Badge auf `badgeCaution`), Appearance (3 Control-
Zeilen), Devices (SettingsGroup je Rolle, DeviceRow `rounded-md`), Firmware
(Version/Server-Update/Upload als Cards, Warnleiste amber→Caution-Token), Backup
(Export/Restore-Cards, Warnleiste→Caution-Token), Time (Zeitzone/Format/NTP-Cards),
Network (Status/Wechseln/Hostname/Reset-Cards), Logs (Karten `rounded-md`).

**Verifikation:** `pnpm typecheck` grün; `pnpm build` grün (181,8 kB JS /
61,0 kB gzip — kein Sprung). Browser-Preview gegen echten ESP32
(`brewcontrol.local`, Screenshots funktionieren nach Öffnen des integrierten
Browsers): Dashboard + Settings-Index + Appearance + Network + Firmware je
**hell und dunkel** — neutrale Graustufen (kein Braun), Nav ohne Trennlinie/
gleiche Fläche, Win11-Zeilenkarten mit Titel/Desc/Control, Windows-Blau-Akzent
(per Override im Preview gezeigt — Testgerät speichert Grün), keine Konsolen-Fehler.

**Offen:** Deploy aufs Gerät via `pnpm build:sd` + `webui.tar` (bisher nur Dev-
Proxy). Firmware-Default-Akzent greift erst nach Reflash der Firmware.

## Session 2026-07-13 — WinUI-3-Politur Teil 3: Fluent-2-Karten-Tokens

**Kontext:** Nutzer hat im offiziellen MS-Figma die kanonischen Karten-Tokens
nachgeschlagen und wollte Kartenhintergrund + -rand exakt darauf. Bisher nutzten
Karten `bg-surface`/`border-border` (wie Inputs/Dialoge/Nav); der Dark-Rand
(`#363636`) war **heller** als die Fläche — Fluent macht es umgekehrt.

**Zielwerte (Fluent 2, als Alpha-Overlays):** CardBackgroundFillColorDefault
`#fff @ 70%` hell / `@ 5,14%` dunkel; CardStrokeColorDefault `#000 @ 5,78%` hell /
`@ 10%` dunkel.

**Umsetzung:**
- **Eigene Karten-Tokens** ([styles.css](web/src/styles.css)): `--card-bg` /
  `--card-border` (halbtransparent → komponieren über `--bg` inkl. Tint), in
  `:root`/dark/media-query; `@theme inline` → Utilities `bg-card` / `border-card`.
  `--surface`/`--border` **unverändert** (Controls behalten sichtbareren
  ControlStroke — WinUI-korrekt: ControlStroke ≠ CardStroke).
- **Karten migriert** `bg-surface`→`bg-card`, `border-border`→`border-card`:
  Sensor/Aktor/Regler/Programm-Cards, Chart-Wrapper, `SettingsCard`, Geräte-/
  Logs-/Zeit-/Archiv-Zeilen. ControllerCard konditionaler Rand
  (`border-card-border` / `…/50`) erhalten. Flache Zeilen bekamen `shadow-elev-2`
  (Fluent Card „shadow2"). **Nicht** angefasst: `inp`/`dialogFrame`,
  Mobile-Toolbar, Edit-Toolbar-Buttons.

**Verifikation:** typecheck + build grün (61,0 kB gzip). Browser hell+dunkel;
Computed-Style-Probe einer Karte trifft die Zielwerte exakt (hell
`rgba(255,255,255,0.7)` / Rand `rgba(0,0,0,0.06)`; dunkel `rgba(255,255,255,0.05)` /
Rand `rgba(0,0,0,0.1)` — dunkler als Fläche). Screenshots Dashboard + Settings je
hell/dunkel: Karten heben sich über Fläche + Kante + Schatten ab.

**Nachtrag — SubtleFill Hover/Pressed:** Nav-Menüpunkte nutzten `hover:bg-fg/5`
(Näherung, kein Pressed). Ersetzt durch exakte WinUI-`SubtleFillColor`-Tokens
`--subtle-hover` (Secondary) / `--subtle-pressed` (Tertiary): hell
`#000 @3,73%`/`@2,41%`, dunkel `#fff @6,05%`/`@4,19%`; gemappt zu
`bg-subtle-hover`/`bg-subtle-pressed`. NavShell (Menüpunkte aktiv+hover, Hamburger,
Mobile-Open) auf `hover:bg-subtle-hover active:bg-subtle-pressed`. Computed-Werte
treffen die Zielwerte exakt. `SettingsCard` (interaktive `a`/`button`-Varianten)
danach ebenfalls von `hover:bg-fg/5` auf die SubtleFill-Tokens umgestellt.
(Übrige `hover:bg-fg/10`-Stellen sind Buttons/Chips = ControlFill, bewusst nicht
angefasst.)

## Session 2026-07-13 — WinUI-3-Politur Teil 4: Firmware-Seite

Firmware-Update-Seite ([FirmwarePage.tsx](web/src/pages/FirmwarePage.tsx)) auf
WinUI-Muster gebracht:
- **Neue [Segmented.tsx](web/src/components/Segmented.tsx)** — wiederverwendbares
  Segmented-Control (bordered Pill-Gruppe, Akzent-Aktiv, SubtleFill-Hover/Pressed
  inaktiv). Kanal `stable/preview` → `Stabil`/`Vorschau` als Segmented (vorher zwei
  lose `bg-fg/5`-Pills). (AppearancePage-Segmenteds könnten später darauf migrieren.)
- **Auto-Check** von nackter Checkbox → eigene `SettingsCard`-Zeile mit
  `ToggleSwitch` (Label links, Schalter rechts).
- **Buttons** auf geteilte `btnSecondary` (Pressed/Focus) statt selbstgestyltem
  `bg-fg/5`; „Installieren" bleibt `btnPrimary`.
- **File-Upload** (`FileUpload`): nackter `<input type=file>` → versteckter Input +
  `btnSecondary` „Durchsuchen…" + Dateiname-Anzeige.

**Verifikation:** typecheck + build grün (61,2 kB gzip). Browser: Segmented,
Toggle-Zeile, gestylte Upload-Buttons — sauber im Win11-Look. („Fehler: check
failed" = erwartet ohne erreichbares Release, kein Design-Bug.)

**Nachtrag — Controls rechts (auf Nutzer-Mockup):** Bedienelemente in den
`control`-Slot (rechts) verschoben: „Auf Updates prüfen" in die „Aktuelle
Version"-Zeile (Version wandert als Mono-`desc` nach links), Segmented rechts in
die „Server-Update"-Zeile. `SettingsCard.desc` von `string` → `ComponentChildren`
(für die Mono-Version). Upload-Zeilen: Label + Dateiname links, „Durchsuchen…"
(`btnSecondary`) rechts — passt platztechnisch (gestapelt, nicht nebeneinander).
Verifiziert mit gemocktem `/api/update/status` (Gerät lieferte zeitweise HTTP 500
nach ~20 s — hängender Auto-Check, geräteseitig).

**Nachtrag — Icons + leerer-Children-Bug:** `SettingsCard.icon` gesetzt (`Package`/
`CloudDownload`/`RefreshCw`/`Upload`; `Github` existiert in `lucide-preact` nicht
mehr, daher `CloudDownload`). Dabei aufgefallen: die Server-Update-Karte hatte
sichtbar mehr Bottom-Padding als die anderen — Ursache war, dass `children` in
`SettingsCard` immer als (leeres) `<div class="space-y-3">` durchgereicht wurde,
auch ohne Fehler/Fortschritt/verfügbares Update → `{children && <div class="mt-3">}`
wrappte trotzdem. Fix: die `space-y-3`-Div nur rendern, wenn tatsächlich Inhalt da
ist (`st.available || downloading/flashing || error`). Danach Header-Icons auf die vier
Karten (`Package`/`CloudDownload`/`RefreshCw`/`Upload`; `Github` existiert in der
lucide-Version nicht mehr → `CloudDownload`).

## Session 2026-07-25 — WinUI-3-Politur Teil 5: Icons + Control-Positionen auf allen Settings-Seiten, TimePage-Uhr

Fortsetzung des Firmware-Musters auf die restlichen 6 Settings-Unterseiten
(Darstellung, Geräte, Backup, Zeit, Netzwerk, Logs) + Settings-Index bereits
vorher icon-versehen.

**Icons** (`SettingsCard.icon` bzw. neues `icon`-Prop an `DeviceRow`/Log-Zeile):
- Darstellung: `Contrast` (Modus), `Palette` (Akzentfarbe), `PaintBucket`
  (Hintergrund-Tönung).
- Geräte: `DeviceRow` bekommt ein Pflicht-`icon`-Prop, pro Rolle vom Aufrufer
  gesetzt — `Gauge` (Sensor), `SlidersHorizontal` (Regler), `Zap` (Aktor).
- Backup: `Download` (Export), `Upload` (Restore).
- Zeit: `Globe` (Zeitzone), `Clock` (Zeitformat), `CalendarDays` (Datumsformat),
  `Server` (NTP-Server).
- Netzwerk: `Signal` (Status), `Wifi` (WLAN wechseln), `Tag` (Hostname),
  `RotateCcw` (WLAN zurücksetzen).
- Logs: `LineChart` vor dem Lognamen in jeder Log-Zeile (kein `SettingsCard`,
  eigenes Listen-Layout).

**Controls nach rechts** (analog Firmware-Seite — Aktion/Eingabe in den
`control`-Slot, Beschreibungstext bleibt links):
- Netzwerk „WLAN wechseln": „Netzwerke suchen"-Button in `control`; Dropdown/
  Passwort/Verbinden bleiben als (jetzt korrekt geleerte) `children` darunter —
  Bug aus dem Firmware-Nachtrag (leere Children erzeugen trotzdem `mt-3`-Gap)
  hier direkt mit Guard vermieden (`{(scanErr || nets.length > 0 || manual) && …}`).
- Netzwerk „Hostname": Input + „.local" + „Speichern"-Button jetzt als eine Zeile
  in `control`; Validierungsfehler bleibt als (geguardete) `children`.
- Netzwerk „WLAN zurücksetzen": Button in `control`, `desc` bleibt links.
- Zeit „Zeitzone": Dropdown in `control`, UTC-Offset-Hinweis wandert nach `desc`.
- Zeit „NTP-Server": Input (schmaler, `w-48`) in `control`.
- Backup „Restore": nackter `<input type=file>` → verstecktes Input + `control`-
  Button „Durchsuchen…" (gleiches Pattern wie Firmware-`FileUpload`, hier ohne
  Progress-Bar da Restore über den `ConfirmModal`-Flow läuft, kein Direct-Upload).

**Segmented-Migration:** Die inline nachgebauten Segmented-Controls in Darstellung
(Modus, Hintergrund-Tönung) und Zeit (Zeitformat, Datumsformat) liefen noch auf
dem alten Pattern (`hover:text-fg` ohne SubtleFill, keine Pressed-States) —
jetzt auf die geteilte [Segmented.tsx](web/src/components/Segmented.tsx)
umgestellt (aus der Firmware-Session). Weniger Code, einheitliches Hover/Pressed.

**TimePage — Uhrzeit-Anzeige (Nutzerwunsch):** Box (`border`/`bg-card`/
`shadow-elev-2`) um die große Uhrzeit entfernt (`px-1`-Padding statt Card);
Schriftgröße `text-2xl` → `text-5xl`. Datum bleibt als `text-sm text-muted`
darunter.

**Nachtrag — SettingsCard.desc erweitert:** Prop-Typ von `string` → `ComponentChildren`
(bereits in der Firmware-Session gemacht, hier für die Zeitzone-Karte
wiederverwendet — UTC-Offset-Text mit interpolierten Werten statt reinem String).

**Verifikation:** `pnpm typecheck` + `pnpm build` grün (185,7 kB JS / 62,5 kB gzip,
kein nennenswerter Sprung). Browser gegen echten ESP32 (`brewcontrol.local`):
alle 7 Unterseiten hell/dunkel durchgeklickt (Screenshots funktionieren jetzt
zuverlässig — Timeout-Problem aus den Vorsessions trat nicht mehr auf, sobald
der Browser vorher schon offen war, wie vom Nutzer vermutet). Netzwerk-Scan
end-to-end gegen die echte Fritzbox getestet (5 Netzwerke gefunden, Dropdown +
Passwort-Feld + Verbinden-Button rendern korrekt nach dem Öffnen). Einziger
Stolperstein: ein transienter Vite-HMR-Fehler durch einen kurzzeitig unbalancierten
JSX-Tag während der LogsPage-Bearbeitung (vor dem Commit behoben, kein Rest im
finalen Diff) hatte kurzzeitig einen veralteten Render-State im Tab hinterlassen —
ein harter Reload hat das aufgelöst; kein tatsächlicher Code-Bug.

---

## Pre-MVP: Planung, Implementierung, erste E2E-Tests (2026-05-17 – 2026-05-20)

Plan geschrieben und umgesetzt (11 Build-Steps), E2E auf LOLIN S2 Mini und
LilyGo T-Display-S3-AMOLED-1.43 verifiziert, QEMU-Machbarkeit geprüft und
verworfen, WiFi-Reset zur Laufzeit + Runtime-Item-Add/Remove implementiert,
Bus-Discovery-Feature (OneWire-Scan) ergänzt. Ausführliche Session-Logs:
[SESSION-archive.md](SESSION-archive.md).

---

## Session 2026-06-03 — OTA Firmware-Update (Code komplett, HW-E2E offen)

Plan [`docs/superpowers/plans/2026-06-03-firmware-update.md`](../docs/superpowers/plans/2026-06-03-firmware-update.md)
umgesetzt (Skill `superpowers:executing-plans`), Feature-Branch `feat/firmware-update`.

**Implementiert (Firmware):**
- `version_flags.py` + `src/version.h` — `BREWCTL_VERSION` (git-Tag) +
  `BREWCTL_VARIANT` (`${PIOENV}`) als Compile-Flags; `BREWCTL_VERSION_OVERRIDE`
  hat in CI Vorrang.
- `lib/TarExtractor/` — streaming USTAR-Parser, pure-C++, host-getestet
  (`[env:native]`, 4 Unity-Tests grün). Plan-Lücke gefixt: Unity braucht
  `setUp`/`tearDown`-Stubs.
- `src/SdTarSink.h` — TarExtractor-Callbacks → `fs::FS`.
- `src/FirmwareUpdater.{h,cpp}` — State-Machine, GitHub-Releases-Client
  (`WiFiClientSecure.setInsecure()`, ArduinoJson-Filter), blockierender
  Download/Flash auf dem loopTask via `tick()`; HTTP-Routen setzen nur Flags.
- `SettingsStore` — `firmware`-Sektion (channel/autoCheck) + Validierung.
- `WebUI` — `/api/update/{status,check,install,firmware,assets}`,
  `.bin`-Flash- und `.tar`-Extract-Upload-Handler, atomarer `/www`-Swap auf
  loopTask; Serve-Root von SD-Root → `/www` umgestellt.
- `main.cpp` — `FirmwareUpdater` instanziiert + verdrahtet.

**Implementiert (Web):** `types.ts` (`UpdateStatus`/`FirmwareSettings`),
`api.ts` (Update-Client + XHR-Upload mit Progress), `FirmwarePage.tsx`,
Route `/settings/firmware`, Settings-Kachel + „Update verfügbar"-Badge.

**CI:** `.github/workflows/release.yml` — Matrix baut `firmware-<env>.bin` +
`webui.tar` bei `v*`-Tag.

**Partition-Entscheidung (Task 12, vorgezogen):** Sobald der TLS-Pull-Pfad
gelinkt ist, springt esp32dev von 79 % → **92,6 %** App-Flash (lolin 88,3 %).
Zu eng für OTA → beide 4-MB-Envs auf `board_build.partitions = min_spiffs.csv`
(~1,9 MB Slots): esp32dev **61,7 %**, lolin **58,8 %**. LilyGo-S3 (16 MB)
unverändert (17,4 %). ⚠ Layout-Wechsel braucht **einmaligen USB-Flash**.

**Verifikation:** alle drei Boards `pio run` grün; `pio test -e native` 4/4;
`pnpm typecheck` + `pnpm build` grün.

**HW-E2E Phase A (Upload-Pfade) — erledigt auf LilyGo S3 (192.168.178.87):**
- A1 USB-Flash (min_spiffs-Layout) + SD `/www` → bootet, UI serviert aus `/www`.
- A2 `/api/update/status` → `variant:lilygo…`, korrekt. (Boot-Auto-Check meldet
  `error/check failed` — erwartet, da noch kein Release/public-Repo; kein Crash.)
- A3 `.bin`-OTA-Upload (1,14 MB) → `ok`, Flash, Reboot, Gerät wieder oben.
- A4 `.tar`-Upload → **Bug gefunden:** `tar -cf x .` emittiert `./`-Namen,
  `SdTarSink` baute `/www.new/./<name>` → SD-VFS lehnt ab → `extract failed`.
  **Gefixt** (`fix(fw): strip leading ./ in SdTarSink`, Commit 4d05e10): beide
  tar-Formen (`.` und `*`) extrahieren jetzt; UI nach Swap korrekt aus `/www`.
  **Relevant für CI:** `release.yml` nutzt die `.`-Form → ohne den Fix wäre der
  Server-Pull (Phase B) am Asset-Extract gescheitert.

**HW-E2E Phase B (Server-Pull) — erledigt auf LilyGo S3 (2026-06-04):**
- Repo `nhhop/Brauerei` public geschaltet; manuelles Test-Release `v0.0.1-test`
  mit allen 4 Assets (CI war zu dem Zeitpunkt noch kaputt, s. u.).
- `check` → `updateAvailable` v0.0.1-test; `install` → `downloading` (webui.tar
  extract + `/www`-Swap) → `flashing` (0→98 %) → Reboot → Gerät läuft danach
  `v0.0.1-test`, UI aus den gepullten Assets (`/` + gehashte Assets → 200).
  Bestätigt zugleich den `./`-Fix mit dem **CI-Format** `webui.tar`.
- Negativ-Varianten-Test entfällt: die Matrix baut alle 3 Varianten, also findet
  jede Variante ihr Asset.

**CI-Bugs (beim Tag-Push-Release entdeckt) — gefixt + verifiziert (2026-06-04):**
1. Firmware-Build brach, weil `platformio.ini` an `symlink://../../../IdsInductionCooker`
   hängt — ein **privates Sibling-Repo**, das `actions/checkout` nie auscheckte.
2. `action-gh-release` scheiterte mangels `permissions: contents: write`.
   Fix (`ci: fix release workflow …`, Commit 2c1decd): Brauerei + IdsInductionCooker
   als Siblings unter `$GITHUB_WORKSPACE` auschecken + `contents: write`. Voraussetzung:
   IdsInductionCooker **public**. Verifiziert: Run für `v0.0.1-test2` grün (2m11s),
   alle 4 Assets automatisch gebaut. Beide Test-Releases danach gelöscht.

**Merge:** PR #6 nach `main` gemergt (Merge-Commit 230fa11), Branch
`feat/firmware-update` lokal + remote gelöscht.

**SD-Karten-Migration:** erledigt — bestehende Karten auf `/www` umgestellt
(bzw. via `webui.tar`-Einspielung). Damit ist das OTA-Feature vollständig
abgeschlossen, keine offenen Punkte mehr.

---

## Session 2026-06-04 — Backup & Restore (Config-Export/Import)

Voller Superpowers-Zyklus: brainstorming → spec → writing-plans →
subagent-driven-development (frischer Implementer pro Task + Zwei-Stufen-Review)
→ HW-E2E → PR. Spec: [`docs/superpowers/specs/2026-06-04-backup-restore-design.md`](../docs/superpowers/specs/2026-06-04-backup-restore-design.md),
Plan: [`docs/superpowers/plans/2026-06-04-backup-restore.md`](../docs/superpowers/plans/2026-06-04-backup-restore.md).
Branch `feat/backup-restore`, **PR #7 gemergt** (Merge-Commit d72e5e8).

**Implementiert:**
- `WebUI` — `GET /api/backup` bündelt die 3 `/config`-Stores
  (`items_.serializeConfig()` Objekt, `store_.serialize()` Array,
  `settings_.serialize()` Objekt) zu einer JSON-Datei
  `{type,version,firmwareVersion,variant,registry,dashboards,settings}` mit
  `Content-Disposition`-Download. `POST /api/backup` (`AsyncCallbackJsonWebHandler`)
  validiert `type`/`version`/3 Sektions-Typen **vor** jedem Schreibzugriff,
  schreibt die Sektionen verbatim via `writeSection_` in die `/config`-Dateien,
  Reboot über `rebootAtMs_`. Restore = Replace-all + Reboot, reuse des
  Boot-Lade-Pfads (`loadFromSD`) — keine Store-Änderungen, keine neue
  Serialisierungslogik.
- Web — `downloadBackup()` (Blob-Download mit Datums-Dateiname) + `restoreBackup()`
  in `api.ts`; `BackupPage.tsx` (Export-Button, File-Import, `ConfirmModal`,
  „Neustart…"-View); Route `/settings/backup`; Settings-Kachel.

**Entscheidungen:** nur Config (kein WiFi); Ansatz A (verbatim schreiben + Reboot);
Server-Endpoint. Geräte-Zeitstempel als Zukunfts-Hook in der Spec (wartet auf das
„Zeit & Formate"-Feature).

**Review-Findings (übernommen):** File-Input-Reset bei Cancel/Error (sonst feuert
das erneute Wählen derselben Datei nicht), `kRebootDelayMs` statt Magic-500,
`serializeJson`-Rückgabe prüfen, klarere 500-Meldung bei Teil-Schreibfehler.
Eine stilistische Anmerkung (`confirmRestore` inline statt benannt) begründet
abgelehnt. Finaler Opus-Gesamt-Review: „Ready to merge".

**HW-E2E (LilyGo S3, neue Firmware per OTA aufgespielt):** Export → Theme-Akzent
als Canary auf `#123456` geändert → erfasstes Backup zurückgespielt (`200 ok`,
Reboot) → nach Reboot Akzent wieder `#d97706` (Restore verifiziert: settings.json
überschrieben + Boot-Load); Negativtest `{"foo":1}` → `400`, Config intakt. Kein
Bug gefunden. (Die BackupPage-UI selbst wurde nachträglich per `webui.tar` auf die
SD gespielt.)

## Session 2026-06-05 — SD-Boot-Firmware-Flash (Recovery-Pfad)

Vierter OTA-Weg neben Browser-Upload / GitHub-Pull / Auto-Check: eine
`/firmware.bin` im SD-Root wird beim nächsten Boot geflasht — funktioniert
**ohne WiFi** (Recovery / Erstinbetriebnahme).

**Implementiert:**
- `FirmwareUpdater::flashFromSdImage(path = "/firmware.bin")` — prüft `fs_.exists`,
  streamt die Datei in 1 KB-Blöcken durch `Update.begin(size)/write/end(true)`,
  löscht das Image und `ESP.restart()`. Guard gegen Reflash-Loop: schlägt das
  Löschen fehl, wird der Reboot übersprungen (neues Image ist bereits Boot-Target).
  Keine Versions-/Varianten-Prüfung — bewusst, damit Downgrade/Recovery geht.
- `main.cpp` — SD-Mount **vor** die WiFi-Logik gezogen (sonst kehrt das
  Setup-Portal bei fehlenden Creds nie zurück); direkt nach erfolgreichem Mount
  `firmwareUpdater.flashFromSdImage()`. Alter SD-Mount-Block nach mDNS entfernt,
  Boot-Flow-Kommentar aktualisiert.

**Verifikation:** `pio run -e esp32dev` SUCCESS (Flash 62.0 %, RAM 15.4 %).
HW-E2E am Gerät noch ausstehend.

---

## Session 2026-06-05 — UI-Fixes: PID-Regler Dashboard & AutoTune

Vier zusammenhängende UI-Fixes an `ControllerCard.tsx` und `AddItemModal.tsx`.
`pnpm typecheck` grün; keine HW-E2E nötig (reine Frontend-Änderungen).

**1. Aktor-Reset beim Ausschalten (`ControllerCard.tsx`)**

`toggleEnabled()` setzt nach `enableController(id, false)` alle verknüpften
Aktoren explizit auf den Minimalwert: single-Aktor auf `params.min ?? 0`,
dual heat/cool-Aktoren je auf `0`. Ohne diesen Reset blieb der letzte
PID-Ausgangswert im Aktor stehen.

**2. Setpoint nur im Dashboard**

Setpoint-Feld aus `AddItemModal` entfernt — war redundant (bereits im
Dashboard editierbar) und könnte beim delete+recreate-Edit-Mechanismus
einen unerwünschten Setpoint-Reset auslösen. Der `setpoint`-State und
die Übernahme in den `cfg`-Submit-Block bleiben erhalten (initiale
Konfiguration).

**3. AutoTune in Settings verschoben**

AutoTune-Controls (Methode-Selector, Starten/Abbrechen) aus
`ControllerCard` (Dashboard) in `AddItemModal` (Settings, Edit-Modus)
verschoben. Gründe: AutoTune läuft stundenlang; versehentliches Auslösen
während eines Braugangs vermeiden; Settings sind der natürliche Ort für
Parametrisierungs-Workflows. Gilt nur für `PID` und `SplitRangePID` beim
Bearbeiten — beim Neu-Anlegen kein AutoTune-Abschnitt. Save-Button im
Modal wird gesperrt solange `autotuneState === 'running'` (verhindert
Controller delete+recreate während laufendem AutoTune).

**4. AutoTune-Status implementiert**

Dashboard (`ControllerCard`): zeigt jetzt read-only-Status:
- `'running'` → amber „AutoTune läuft…"
- `'done'` → grüne Kp/Ki/Kd-Zeile (war schon teilweise vorhanden, bleibt)
- kein State / anderer Wert → kein UI-Element

Settings (`AddItemModal`): gleicher Status-Block + volle Steuerung.
`liveController` wird per `snap?.controllers.find(id)` aufgelöst —
`snap` wird bereits an das Modal übergeben, kein neuer Prop nötig.

**Geänderte Dateien:**
- `web/src/components/ControllerCard.tsx`
- `web/src/components/AddItemModal.tsx`

---

## 2026-06-06 — Datenlogging & Trend-Charts (Branch `feat/datalog`)

**Ausgangslage:** Zeit & Formate (NTP + `serverTime` im Snapshot) abgeschlossen — Voraussetzung für CSV-Timestamps. Design abgestimmt: Log-Config = Chart-Config, eine CSV pro Session mit gemeinsamem Zeitstempel, uPlot, standalone Logs mit Dashboard-Referenz.

**Phase 1 — Logging-Core (Firmware):**
- `LogStore.{h,cpp}`: Sampling der Registry in Sessions `/logs/<id>/<startEpoch>.csv`, Config in `/config/logs.json`. Serien-Refs `<rolle>/<snapshot-id>` (z.B. `sensor/bme280.temp`, `actuator/heizung`, `controller/maische`) lösen 1:1 gegen die Registry auf; Werte auf `meta.res` gerundet, ungültige Messung → leere Zelle; gewartet bis NTP gesynct.
- REST in `WebUI`: `GET/POST /api/logs`, `POST/DELETE /api/logs/:id`, `GET /api/logs/:id/data` + `/download`. Neuer `GetPrefixHandler` für GET mit Pfad-Param. `logs_.tick()` im bestehenden 1-Hz-`tick()`.

**Phase 2 — Chart-Frontend:**
- `pnpm add uplot`. `ChartCard` (uPlot): Hydration aus Session-CSV + Live-Append aus SSE-Snapshot (`serverTime` als x). Zentrale `LogsPage` (`/settings/logs`) + `LogEditorModal` (Serien aus Snapshot-Kanälen picken). `DashboardConfig.charts[]` (Firmware `DashboardStore` + Editor-Mehrfachauswahl + Render unter dem Grid).

**Phase 3 — Online-Kompression (deine `loggingkompression.md`):**
- `LogCompressor.h`: zwei reine, NaN-sichere C++-Filter — **Linear-Interpolation** und **Swinging Door** (= Bounding-Box/Sektor). Lockstep über alle Serien (gemeinsamer Zeitstempel; eine Zeile sobald eine Serie ihre Toleranz sprengt), Timeout-Stützpunkt (`maxGapSec`). Config: `algo` + `maxGapSec` + per-Serie `tol`. Editor-UI dafür.
- 12 native Unit-Tests (`test_log_compressor`): Plateau-Kollaps, Rampen-Ecke, Spike-Breakout, Timeout, kollineare Punkte, Multi-Serien-OR, NaN, flush.

**Phase 4 — Lifecycle & Retention:**
- Logging-Toggle (`enabled`) + Controller-Binding (`bindEnableTo` → `enabled` folgt `controller.enabled()`); Flush des gepufferten Punkts beim Deaktivieren.
- Clear/Session-Rotation (`POST /api/logs/:id/clear`), Archiv (`GET …/sessions`, session-Param für data/download, `DELETE …/sessions/<start>`), eigene `ArchivePage` (`/settings/logs/:id/archive`, read-only Chart pro Session).
- Globale Retention: 200 MB Budget über `/logs`, älteste (kleinster Start-Epoch) nicht-aktive Sessions zuerst gelöscht; `pruneToBudget_` bei Session-Anlage.

**Verifikation:** esp32dev SUCCESS (Flash ~63 %, RAM 15.5 %), `pnpm typecheck` 0 Fehler, 12/12 native Tests. **HW-E2E ausstehend** (keine Hardware verfügbar).

**Commits:** `b42bbac` (Phase 1–3) + Phase-4-Commit. Branch `feat/datalog`.

**Offen / Später:** API-Dezimierung (LTTB) für lange Archiv-Zeiträume; Live-Chart-Append an `intervalSec` angleichen (aktuell 1 Hz); `webui.tar` bleibt Build-Artefakt (nicht committed).

### HW-E2E auf LilyGo S3-AMOLED (2026-06-06)

Datalog-Feature end-to-end auf echter Hardware verifiziert (env `lilygo_t_display_s3_amoled`, COM7, WLAN/SD vorhanden, NTP gesynct → `serverTime` im Snapshot). Demo-Registry: Sensor `mlt`, Aktor `kettle`, keine Controller.

**Gefundener Bug (HW-only, gefixt):** `server_.on("/api/logs", HTTP_GET)` matcht in ESPAsyncWebServer auch Sub-Pfade (`/api/logs/:id/data` etc.) und war **vor** dem `GetPrefixHandler` registriert → `/data`, `/sessions`, `/download` lieferten die Log-Liste statt CSV/JSON. Fix: `GetPrefixHandler("/api/logs/")` vor die bare-GET-Liste registriert (Prefix-Handler ignoriert die slash-lose URL). Compile-Smoke konnte das nicht zeigen — nur HW-E2E.

**Verifiziert (alle grün):** NTP-Gating + echte Epoch-Timestamps; CSV-Header + Intervall + Leerzelle bei ungültiger Messung; Sessions-Liste + active-Flag + Session-Rotation bei Reboot; Dead-Band-Kompression (Swinging-Door-Log blieb 231 B über ~13 min konstant, `none`-Log wuchs alle 2s); `?session=`-Param für Archiv-CSV; Download-GET mit Content-Disposition; Schutz der aktiven Session vor Löschen; Löschen alter Sessions; enable-Toggle; clear/Rotation. UI per `webui.tar` über `/api/update/assets` eingespielt (ustar-Format nötig — Windows-bsdtar default „pax restricted" scheitert am `TarExtractor`).

**Offene Design-Frage:** Session-Rotation bei *jedem* Reboot — ein Stromausfall mitten im Braugang splittet das Log in zwei Sessions. Bewusst so (sessionStart ist runtime-only); evtl. später „jüngste Session fortsetzen wenn < N min alt".

### Playwright-UI-Tests Datalog-Frontend + Race-Condition-Fix (2026-06-07)

Browser-UI-Tests des Datalog-Frontends (Edge via Playwright-MCP) gegen `pnpm dev` (:5173 → ESP32 192.168.178.87, LilyGo S3-AMOLED auf COM7).

**Verifiziert (alle grün):** Dashboard mit Live-SSE (`mlt`/`kettle`); LogsPage listet Logs + rendert uPlot-Charts aus Session-CSV (Swinging-Door-Log sichtbar spärlichere Stützpunkte als `none`); LogEditorModal (Name/Intervall/Serien-Picker aus Live-Snapshot, Validierung, Kompressions-Dropdown blendet `maxGapSec` + per-Serie-`±tol` dynamisch ein); ArchivePage (Session-Liste mit Datum/Größe/active-Schutz, „Ansehen" → read-only Chart pro Session); Dashboard-Charts-Config (`DashboardConfig.charts` Mehrfachauswahl, Chart rendert unter dem Grid, persistiert nach `/api/dashboards`).

**Schwerer Bug gefunden + gefixt — Cross-Task-Race auf `logs_`:** Beim Anlegen eines Logs übers UI rebootete der ESP32 (~40 s; Ping ✓, HTTP tot; alle Sessions rotierten auf eine gemeinsame Boot-Epoch = Reboot-Beweis). Root Cause: die REST-Handler (AsyncTCP-Task) mutieren `std::vector<LogCfg> logs_` (`add`→`push_back`, `remove`→`erase`, …) **ohne Synchronisation** zum `loopTask`, der in `LogStore::tick()` jeden `loop()`-Durchlauf `for (auto& l : logs_)` iteriert. `push_back` mit Realloc gibt den alten Buffer frei, während `tick()` ihn liest → Use-after-free → Panic. Erklärt: 201-Response geht raus (`add()` fertig), Reboot *danach*; nur bei Realloc kritisch → `enable`/`clear` (In-Place) liefen in der HW-E2E „grün" trotz gleicher UB. Serial-Backtrace nicht erfassbar — S3 USB-CDC re-enumeriert beim Reset.

**Fix:** rekursiver FreeRTOS-Mutex (`xSemaphoreCreateRecursiveMutex`) als `LogStore`-Member, `ScopedLock` (RAII) am Anfang jeder Methode die `logs_` liest/mutiert (`load/saveToSD`, `serialize`, `add`, `update`, `remove`, `setEnabled`, `clear`, `serializeSessions`, `deleteSession`, `sessionPath`, `tick`). Rekursiv wegen `saveToSD`→`serialize`. [LogStore.h](firmware/src/LogStore.h) + [LogStore.cpp](firmware/src/LogStore.cpp).

**HW-verifiziert nach Reflash:** 4× `POST /api/logs` + 6× `DELETE` in Folge — kein Reboot, HTTP durchgehend 200, Boot-Session der Bestands-Logs stabil (nur neue Logs bekamen erwartungsgemäß eigene First-Sample-Sessions). Test-Logs danach gelöscht, Dashboard-Chart-Config zurückgesetzt → Ausgangszustand (nur `HW-Test-Raw` + `HW-SD`).

**Folge-Bug (Frontend, gefixt):** Das per-Serie-`±tol`-Feld im `LogEditorModal` ließ nur Ganzzahlen zu — ein controlled `<input type="number">` an numerischem State schrieb bei jedem Tastendruck `Number(value)` zurück; der Zwischenstand „0." liefert bei type=number `.value===""` → `0`, der Re-Render löschte den getippten Punkt („0.5" → „5"). Betraf beide Algorithmen (bei `fill_form` im ersten Test umgangen → unbemerkt). Fix: Toleranz als **String-State** halten (Zwischenstände überleben), `type="text" inputMode="decimal"`, Parse erst beim Submit inkl. deutschem Komma (`parseFloat(s.replace(',', '.'))`, Clamp ≥0). [LogEditorModal.tsx](web/src/components/LogEditorModal.tsx). Browser-verifiziert: „0.5" bleibt erhalten, „1,5" → `tol:1.5` auf dem Gerät.

### Chart-Fixes nach User-Feedback (2026-06-07)

Vier vom User gemeldete Chart-Probleme — Root Causes per Live-uPlot-Introspektion (`__u`-Debughook) gefunden, gefixt, am Gerät verifiziert.

1. **Zeitformat/Sekunden:** uPlot nutzte sein Default-Achsenformat (12h AM/PM, keine Sekunden), ignorierte die App-Zeiteinstellung. Fix: `ChartCard` lädt die Zeit-Settings (neuer gecachter `loadTimeSettings()` in [time.ts](web/src/time.ts)) und formatiert X-Achse (`axes[0].values` → `formatTime`, mit Sekunden) + Legenden-Zeit (`series[0].value` → `formatDateTime`) selbst. Achse zeigt jetzt z.B. `17:15:45`, Legende `07.06.2026 17:15:45`. (Datum nur noch in der Legende, nicht mehr als Achsen-Unterzeile.)
2. **Aktoren/Regler nicht live (erst nach Refresh):** `parseCsv` splittete auf `\n`, die Firmware schreibt aber CRLF (`println`) → die **letzte** CSV-Spalte trug ein `\r`. Der Header-Ref wurde zu `"…\r"`; `resolveRef` fand die Registry-id nicht → Live-Append schrieb `null` (CSV-Hydration tolerierte `\r` via `Number()`, daher OK nach Reload). Da die letzte Serie meist Aktor/Regler ist → genau das Symptom. Fix: `text.trim().split(/\r?\n/)` in [api.ts](web/src/api.ts).
3. **Linie überbrückt Logging-Pause:** Beim Stopp wurde kein Marker geschrieben → letzter Wert vor Stopp mit erstem danach verbunden. Fix zweiteilig: Firmware schreibt beim `eff`-`true→false`-Übergang eine **Leerzeile** (alle Zellen NaN) bei `sessionStart>0` ([LogStore.cpp](firmware/src/LogStore.cpp)); Frontend stoppt das Live-Anhängen bei `!log.enabled` und schiebt beim Übergang einen `null`-Punkt ein. Beides bricht die uPlot-Linie (`spanGaps:false`). HW-verifiziert: Regler aus/an → CSV-Leerzeile `…531,,,` zwischen den Werten, Chart bricht sauber.
4. **Interpolierte Hover-Werte (User-Frage):** Die Legende zeigte den nächstgelegenen Stützpunkt. Jetzt zeigt sie den **linear interpolierten** Wert an der exakten Cursor-X-Position (`series[i].value` → `interpAt()`, Binärsuche + Lerp, `null` über Gaps) — passend, da beide Kompressionsalgorithmen linear rekonstruieren.

**Hinweis:** Frontend-Fixes greifen erst nach `pnpm build` + Asset-Deploy (`webui.tar` → `/api/update/assets`) auf dem Gerät; Dev-Server (`pnpm dev`) hat sie sofort. Firmware-Fix (#3) ist auf den LilyGo S3 geflasht.

### Netzwerk/WLAN-Einstellungen (2026-06-07)

Neue Settings-Seite `/settings/network` „über das Captive-Portal hinaus" (Roadmap Welle 3). Scope nach Rücksprache: **STA-Features only** (AP-Modus bewusst verschoben — ohne Internet kein NTP → bricht das frische Datalog; ggf. später mit RTC). Statische IP ausgeklammert.

**Firmware:**
- `GET /api/network` — STA-Status (`connected`/`ssid`/`ip`/`rssi`/`mac`) + konfigurierter `hostname` aus NVS. `GET /api/network/scan` — async Scan (202 läuft → 200+JSON), gleiche Mechanik wie das Captive-Portal. `POST /api/network` — `{ssid,password}` und/oder `{hostname}` → NVS schreiben + Reboot (Creds/Hostname greifen erst beim Boot). Ein gemeinsamer `GetPrefixHandler("/api/network")` dispatcht GET-Status vs. `/scan` (bare `server_.on` würde via `Type::BackwardCompatible` `^uri(/.*)?$` den Sub-Pfad schlucken — gleiche Falle wie beim Logs-Fix). [WebUI.cpp](firmware/src/WebUI.cpp).
- **Hostname konfigurierbar:** war fix `kHostname="brewcontrol"`, jetzt aus NVS `brewctrl/hostname` (Default `kHostname`). `connectStation()` ruft `WiFi.setHostname()` vor `WiFi.begin()` (DHCP), `MDNS.begin(hostname)`. [main.cpp](firmware/src/main.cpp). Validierung `validHostname()` (1–32, lowercase alnum + Bindestrich, kein führender/abschließender). Hostname liegt im NVS bei den WLAN-Creds (Netzwerk-Identität, früh verfügbar, überlebt SD-Probleme) — **nicht** im Backup (konsistent mit „Backup = nur Config, kein WiFi").

**Frontend:**
- [NetworkPage.tsx](web/src/pages/NetworkPage.tsx): Status-Karte (Signal-Balken aus RSSI + dBm, IP, `hostname.local`, MAC); „WLAN wechseln" (Scan → dedupliziertes/sortiertes SSID-Dropdown + Passwort → ConfirmModal → Reboot-Screen); „Hostname" (Inline-Validierung spiegelt die Firmware-Regel, Speichern nur bei Änderung); „WLAN zurücksetzen" (hierher verschoben). Eigener Reboot-Vollbild-Status pro Aktion (Wechsel/Rename/Reset mit passendem Text).
- `getNetwork`/`scanNetworks` (Poll-Schleife wie Portal)/`setNetwork`/`setHostname` in [api.ts](web/src/api.ts); `NetworkStatus`/`ScanNetwork` in [types.ts](web/src/types.ts); Route + Nav-Eintrag.
- **„Reset WiFi" aus dem Dashboard-Header entfernt** (jetzt in der Netzwerk-Seite) → App-`rebooting`/`RebootingView` + Dashboard-`onReset`/`ConfirmModal`-Import wurden dadurch verwaist und mit-entfernt. [Dashboard.tsx](web/src/pages/Dashboard.tsx), [app.tsx](web/src/app.tsx).

**Verifikation:** esp32dev SUCCESS (Flash 63.6 %, RAM 15.5 %), `pnpm typecheck` 0 Fehler.

**HW-Vorfall + Härtung (2026-06-07):** Erster HW-Test: Hostname-Wechsel ✓, WLAN-Reset ✓ (Reconnect über `brewcontrol.local` ✓). Aber **Klick auf „Scan" im laufenden STA-Betrieb killte die WLAN-Verbindung** → Gerät unerreichbar, kam erst per **Power-Cycle** zurück (Serial zeigte nichts → kein Crash; der Boot-Banner wird nur beim Boot ausgegeben, das Gerät lief in `loop()` weiter, nur ohne Netz). Ursache: `WiFi.scanNetworks()` im verbundenen STA hoppt über die Kanäle, die Verbindung kam ohne Reboot nicht zurück (bekannt fragile Kombi ESP32-Scan + AsyncWebServer). Scan kurz entfernt, dann auf Userwunsch wieder rein — **mit Härtung statt Entfernung:**
- **WLAN-Watchdog** in `loop()` ([main.cpp](firmware/src/main.cpp) `maintainWiFi()`): STA down → nach 10 s `WiFi.reconnect()`, nach 60 s `ESP.restart()` (Boot reconnectet oder öffnet Portal). Self-Healing gegen Aussperren — egal ob Scan, AP-Reboot oder Funkloch. Plus `WiFi.setAutoReconnect(true)` in `connectStation()`.
- **Sanfterer Scan:** `WiFi.scanNetworks(async, hidden=false, passive=false, 100ms/Kanal)` (Default 300) — kürzere Verweildauer.
- **Resilienter Poll:** `scanNetworks()` in [api.ts](web/src/api.ts) bricht bei transientem Fetch-Fehler nicht mehr ab, sondern pollt weiter; Scan-Fehler im UI schaltet automatisch auf **manuelle SSID-Eingabe** (Toggle „Netzwerk manuell eingeben", auch für versteckte Netze). [NetworkPage.tsx](web/src/pages/NetworkPage.tsx).

Nach Härtung: esp32dev SUCCESS, `pnpm typecheck` 0 Fehler.

**HW-E2E grün (2026-06-07, LilyGo S3-AMOLED, COM7):** Firmware geflasht + Frontend per `webui.tar` (ustar) deployt. `GET /api/network` ✓ (connected, IP, RSSI, MAC, hostname). **Gehärteter Scan reproduziert das Lock-out *nicht* mehr:** Scan-Kickoff 202 → Ergebnis nach 1 s (5 Netze, signal-sortiert); Erreichbarkeit unmittelbar danach 10×/20 s durchgehend HTTP 200 — **kein** Verbindungsabriss (kürzere 100-ms-Dwell macht den Scan unauffällig, Watchdog als Netz). Hostname-Wechsel + WLAN-Reset bereits im ersten Test verifiziert.

**mDNS-Diagnose + Härtung (2026-06-07):** Nach dem Deploy schien `brewcontrol.local` „tot" (ping/curl scheiterten), die IP lief aber. Ursache war **kein** Geräte-Bug, sondern **Windows-Negativ-DNS-Cache**: eine mDNS-Anfrage lief während des `TarExtractor`+`/www`-Swaps (loopTask kurz blockiert) in den Timeout, Windows cachte das NXDOMAIN (~15 min). Beweis: `Resolve-DnsName` löste durchgehend korrekt auf, `ipconfig /flushdns` stellte ping/curl/Browser-Pfad sofort wieder her (3×/3× HTTP 200). Der ESP-Responder war immer gesund. **Latentes Risiko trotzdem geschlossen:** ESP32-mDNS überlebt einen WiFi-Reconnect i. d. R. nicht — und der neue Watchdog macht Reconnects wahrscheinlicher. Fix: `WiFi.onEvent(STA_GOT_IP)` → `startMDNS()` (`MDNS.end()`+`begin(hostname_)`) re-announced mDNS bei jedem (Re-)Connect ([main.cpp](firmware/src/main.cpp)). Nach Flash verifiziert: mDNS frisch hoch (4×/4× HTTP 200 über `brewcontrol.local`). Reconnect-Survival nur code-verifiziert (kein API-Weg, die STA gezielt zu trennen).

**Watchdog zu aggressiv → AP-Falle bei Router-Reboot (2026-06-08, gefixt):** Beim Testen des mDNS-Reconnects startete der User den Router neu — das Gerät landete im **Setup-AP**. Kette: Router weg → Watchdog rebootete schon nach **60 s** → Boot-`connectStation` (30 s Timeout) lief, während die FRITZ!Box noch hochfuhr → Portal-Fallback (`runUntilConfigured` blockiert für immer) → im AP gestrandet, obwohl Creds korrekt. Auto-Reconnect hätte den kurzen Ausfall sonst überbrückt. **Fix** ([main.cpp](firmware/src/main.cpp)): (1) Watchdog entschärft — Nudge alle 30 s, `ESP.restart()` erst nach **5 min** Dauerverlust (Router-Reboot ist da längst durch, bleibt in STA); (2) Boot **wiederholt** den Connect 6×30 s (~3 min), bevor das Portal kommt — ein Reboot während eines transienten Ausfalls strandet nicht mehr im AP. Recovery des gestrandeten Geräts: simpler Power-Cycle (Creds bleiben erhalten, Portal-Fallback löscht sie nicht). esp32dev SUCCESS; geflasht + HW-verifiziert: Gerät nach Flash sofort wieder in STA (mDNS + IP je HTTP 200).

---

## Sollwert-Programme / Maischeprofile (2026-06-08, Branch `feat/setpoint-programs`)

Roadmap Welle 2. Zeitgesteuerte Setpoint-Folge mit Rasten — treibt `Controller::setSetpoint()` durch eine Liste benannter Schritte. Spec: [docs/superpowers/specs/2026-06-08-setpoint-programs-design.md](../docs/superpowers/specs/2026-06-08-setpoint-programs-design.md).

**Designentscheidungen (mit User abgestimmt):**
- **Schritt-Modell:** Sollwert springt sofort aufs Ziel, Halte-Timer zählt **ab Schrittbeginn** (kein Warten-bis-erreicht, keine lineare Rampe → sensorfrei). Schritt = `{name?, setpoint, holdSec, confirm?}`; `name` optional/kosmetisch.
- **Manuelle Freigabe:** `confirm: true` → nach Ablauf der Haltezeit Zustand `awaiting`, wartet auf „Weiter".
- **Reboot-Resume:** ja. Timing über **absolute Wall-Clock-Epoch** pro Schritt (`stepStartedEpoch`), nicht `millis()` → `elapsed = now − stepStartedEpoch` auch nach Reboot korrekt; Persistenz nur bei Übergängen (kein periodisches Schreiben). No-op bis NTP synct (wie LogStore).
- **Architektur:** BrewControl-Firmware, **keine Library-Änderung** (Maische-Profile bewusst außerhalb SensActCtrl).
- **UI:** eigenes Dashboard-Widget, referenziert via `programs[]` (analog `charts[]`).

**Firmware:**
- [ProgramRunner.{h,cpp}](firmware/src/ProgramRunner.cpp) (neu) — analog `LogStore`: `loadFromSD`/`saveToSD` (`/config/programs.json`, Definition + Laufzustand), `serialize()` (Config + abgeleitete Live-Felder `stepRemainingSec`/`currentSetpoint`), `add`/`update`/`remove`, `control(id, action, reg)` (`start/pause/resume/stop/next/prev`), `tick(reg, sd, nowEpoch)`. **Rekursiver FreeRTOS-Mutex** gegen Cross-Task-Race (AsyncTCP-Handler vs. loopTask-`tick`) — dieselbe Klasse Bug wie beim Datalog. Zustände `idle/running/awaiting/paused/done`. `control` wendet den Sollwert sofort an (AsyncTCP, wie der bestehende `/setpoint`-Handler). Pause friert `elapsedAtPauseSec` ein, Resume rechnet `stepStartedEpoch = now − elapsed` zurück (konsistent über Pause + Reboot). Start aktiviert den Regler implizit (`setEnabled(true)`). Orphan-tolerant: fehlt der referenzierte Regler, ist `tick` ein no-op (kein Crash). Resume re-appliziert beim ersten valid-clock-Tick den Sollwert des aktiven Schritts (`needsResume_`).
- [WebUI.{h,cpp}](firmware/src/WebUI.cpp) — `ProgramRunner&` im Ctor; Routen nach `/api/logs`-Muster (Sub-Pfad-Handler vor bare-Handler, alle vor `serveStatic`): `GET/POST /api/programs`, `DELETE /api/programs/:id`, `POST /api/programs/:id` (update), `POST /api/programs/:id/control`. `control`-Fehler → 404 (unbekannte id) bzw. 400 (ungültige Aktion/Status). `tick()` ruft `programs_.tick(reg_, fs_, time(nullptr))`.
- [DashboardStore.{h,cpp}](firmware/src/DashboardStore.cpp) — `programs[]` zu `DashboardCfg` (load/serialize/fillFromJson, analog `charts`).
- [main.cpp](firmware/src/main.cpp) — `ProgramRunner programRunner;` instanziiert, an WebUI übergeben, `loadFromSD(SD)`.

**Frontend:**
- [types.ts](web/src/types.ts) — `ProgramStep`/`ProgramConfig`/`ProgramStatus`/`ProgramAction`; `DashboardConfig.programs?`.
- [api.ts](web/src/api.ts) — `getPrograms`/`createProgram`/`updateProgram`/`deleteProgram`/`controlProgram`.
- [ProgramCard.tsx](web/src/components/ProgramCard.tsx) (neu, Widget) — Schrittliste (aktiver Schritt hervorgehoben, erledigte durchgestrichen, `confirm`-Marker), Status-Badge, Restzeit am laufenden Schritt; Buttons kontextabhängig (Start/Pause/Fortsetzen/Zurück/Weiter/Stop), „Weiter" im `awaiting` als Akzent. Fehlender Regler → Steuerung deaktiviert + Hinweis.
- [ProgramEditorModal.tsx](web/src/components/ProgramEditorModal.tsx) (neu) — Name, Regler-Dropdown, Schritt-Zeilen (Name optional, Sollwert, Haltezeit **in Minuten** → ×60 ins Wire-Format, `confirm`-Checkbox, Reorder/Entfernen), Löschen im Edit-Modus.
- [Dashboard.tsx](web/src/pages/Dashboard.tsx) — Programme laden + **2-s-Polling** für Live-Status (kein SSE-Eingriff); ProgramCards für `activeDash.programs`; Editor-Handler (create/update/delete); `programs` in `saveDashboard`/`removeFromDashboard`. [DashboardEditorModal.tsx](web/src/components/DashboardEditorModal.tsx) — Programme-Checkboxen + „+ Neues Programm".

**Verifikation:** esp32dev **SUCCESS** (00:03:11); `pnpm typecheck` 0 Fehler; `pnpm build` ok (175 KB JS / 56 KB gzip).

**HW-E2E grün (2026-06-08, LilyGo S3-AMOLED, COM7):** Firmware (lilygo-Env) geflasht + GUI per `webui.tar` (ustar) über `POST /api/update/assets` deployt; `GET /api/programs` ✓ (neuer Endpunkt), Index ✓. **API-E2E gegen `mash`-Regler, 13/13 PASS:** create (Schrittnamen/confirm erhalten) → start (running, step0, mashSp=40, enabled) → Auto-Advance step0→1 nach hold (sp=50) → `confirm`-Schritt → `awaiting` (sp bleibt) → next → step2 (sp=60) → pause (Restzeit eingefroren) → resume → prev (step1, sp=50) → stop (idle, step0) → Negativtest `resume@idle` → 400 → delete. **Reboot-Resume verifiziert:** Programm mit 180-s-Schritt gestartet (Restzeit 179s), Power-Cycle mitten im Schritt → nach Boot weiterhin `running`/step0, Restzeit **112s** (die ~67s Stromlos-Zeit real mitgezählt — Wall-Clock-Epoch-Design bestätigt), `mash`-Sollwert auf 42 re-appliziert + reaktiviert. Aufgeräumt (Test-Programme gelöscht, `mash` deaktiviert).

## Session 2026-07-10 — Fluent/WinUI-3-Redesign des Web-Frontends

**Runde 1 (gemerged: PR #10 + #11):**
- `NavShell` (linke NavigationView-Rail, kompakt/expandiert via Hamburger, auf
  Mobile Overlay-Drawer mit Acrylic + Backdrop), `Breadcrumb`-Komponente statt
  Zurück-Pfeilen in allen 8 Settings-Unterseiten.
- Fluent-Design-Tokens in `styles.css` (`--elev-2/8/16/64`-Schatten, Acrylic-
  Surface, Segoe-UI-Font-Stack), `lucide-preact` als Icon-Paket (tree-shaked),
  Unicode-Glyphen (`✎`, `×`, `🗑`, `⚠`, `↺`) durch Icons ersetzt.
- Karten mit Elevation (`shadow-elev-2` → hover `elev-8`), Dialoge `elev-64`;
  gemeinsame Button-Konstanten in neuem `src/ui.ts`.

**Runde 2 (dieses Update — näher an echtes WinUI 3):**
- **Akzentfarbe als Steuerfarbe**: `btnPrimary` + alle 8 rohen `bg-fg`-Primär-
  Buttons + alle Segmented-Aktivzustände auf `bg-accent text-accent-fg`
  umgestellt (folgt der Laufzeit-Akzentfarbe aus `theme.ts`). NavShell-Aktiv-
  eintrag mit vertikalem Akzent-Pill (WinUI-NavigationView-Stil, Text bleibt fg).
- **WinUI-Controls**: kanonische `inp`-Konstante in `ui.ts` (Akzent-Unterstrich
  bei Fokus via Inset-Box-Shadow, kein Layout-Shift) — ~20 Roh-Input-Strings +
  AddItemModal-`inp` migriert. Neue `ToggleSwitch`-Komponente (role=switch),
  ersetzt LogsPage-Aktiv-Pill, ControllerCard-Power-Icon und ActuatorCard-
  BinaryToggle. Nackte Checkboxen → `accent-accent`.
- **Settings wie Windows 11**: Breadcrumb in Titelgröße (Eltern muted,
  aktueller Crumb semibold — wie Win11-Settings), SettingsIndex-Karten mit
  lucide-Icon links + ChevronRight, Titel-`h1` auf `text-2xl font-semibold`.
- **ContentDialog-Footer**: alle 5 Modals auf Content-/Footer-Zonen umgebaut
  (`dialogFrame` = flex-col + overflow-hidden, `dialogFooter` = abgesetzte
  Leiste mit Trennlinie, `dialogBtnRow` = gleich breite Buttons); bei
  scrollbaren Modals bleibt der Footer unterhalb des Scrollbereichs sichtbar.

**Verifikation:** `pnpm typecheck` + `pnpm build` grün (178,9 kB JS / 59,7 kB
gzip, kein Bundle-Sprung). Browser-E2E gegen echten ESP32 via Dev-Proxy
(`brewcontrol.local`): Nav-Pill, Akzent-Buttons/-Switches (Nutzer-Akzent Grün
schlägt überall durch), Fokus-Unterstrich, Win11-Settings-Karten, 3-stufige
Archiv-Breadcrumb, Dialog-Footer — jeweils hell/dunkel + Desktop/Mobile.

## Session 2026-07-11 — Dashboard-Layout: Programm-Sidebar + Compact/Sticky-Widget

**Kontext:** Ein auf einem anderen Rechner gebautes, aufs Gerät geflashtes
Dashboard-Layout lag ungepusht im Branch `feat/dashboard-layout` (Commit
00e0d92) — aber auf dem **Vor-NavShell-Stand** (Basis 0f83ac4, Zahnrad-Header,
`min-h-screen`/`h-screen`, `shadow-sm`). Ein Merge hätte NavShell + die
Fluent/WinUI-3-Arbeit (PR #10/#11/#12) zurückgerollt. Deshalb **nicht gemerged**,
sondern die Absicht adaptiert auf den aktuellen `main` übertragen (Branch
`feat/dashboard-layout-navshell`), alter Branch danach gelöscht.

**Änderungen (2 Dateien):**
- [ProgramCard.tsx](web/src/components/ProgramCard.tsx) — Mobile-Accordion:
  eingeklappt per Default, kompakte Ein-Zeilen-Zusammenfassung (aktiver Schritt +
  Sollwert + Restzeit/„Freigabe"/„pausiert" bzw. „N Schritte"), `▸`/`▾`-Toggle
  (`lg:hidden`); Desktop zeigt die Liste immer. Neues `fill`-Prop → bei einem
  einzigen Programm füllt die Karte die Spaltenhöhe (`lg:flex lg:h-full
  lg:flex-col`, Liste scrollt intern, Buttons `lg:mt-auto`). Auf Mobil/Tablet
  `max-lg:sticky` (Offset responsiv: `top-14` unter der Mobil-Toolbar, `top-2`
  auf Tablet). **Elevation-Klassen bewusst behalten** (kein `shadow-sm`-Rückfall).
- [Dashboard.tsx](web/src/pages/Dashboard.tsx) — Content-Umbau: Programm-Sidebar
  links (`lg:w-80`, `max-lg:contents` → fließt auf Mobil oben ein) + rechter
  Scroll-Bereich (Chart oben, Sensoren/Regler/Aktoren-Grid darunter). Root
  `lg:flex lg:h-full lg:flex-col lg:overflow-hidden` — **`h-full` statt `h-screen`**
  (füllt NavShells `<main>` statt des Viewports), Panes scrollen unabhängig, die
  Seite selbst nicht. Zahnrad-Header **nicht** zurückgeholt (NavShell übernimmt).

**Verifikation:** `pnpm typecheck` + `pnpm build` grün. Browser-E2E gegen echten
ESP32 (`brewcontrol.local`): Desktop — Programm-Sidebar links + rechter Pane,
`main.scrollHeight == clientHeight` (gemessen, keine Seiten-Scrollbar), Panes
scrollen unabhängig. Mobil — Programm oben kompakt eingeklappt, Accordion klappt
korrekt auf (Fortschritt sichtbar), Steuer-Buttons bleiben beim Scrollen sticky
unter der Toolbar. Keine Konsolen-Fehler.

## Session 2026-07-13 — Dashboard-Edit-Modus + Bearbeiten-Aufteilung

**Kontext:** Im Dashboard sollte das Bearbeiten überarbeitet werden. Bisher zeigte
jede Karte permanent ✎/× und ein einzelner „Bearbeiten"-Button öffnete einen
Sammel-Modal (Name + Mitgliedschafts-Checkboxen + Neu erstellen + Löschen).

**Ergebnis (Edit-Modus + getrennte Zuständigkeiten):**
- [Dashboard.tsx](web/src/pages/Dashboard.tsx) — Neuer `editMode`-Toggle: normal
  ist das Dashboard aufgeräumt (keine ✎/×, kein „+ Neu"), nur Laufzeit-Controls
  (Regler-Toggle, Aktor-Slider, Setpoint/Apply, Programm-Start/Stop, Tare). Der
  „Bearbeiten"-Button schaltet den Modus ein → Toolbar zeigt „＋ Hinzufügen" +
  „✓ Fertig" (Akzent), Karten zeigen ✎/× (durch bedingtes Durchreichen von
  `onEdit`/`onDelete` — Kartenkomponenten unverändert), Chart-Karten bekommen ×,
  „+ Neu" erscheint. Ein kompakter Hinweis-Streifen erklärt den Modus.
- **Tab-Name abgetrennt:** Stift am aktiven Tab → [DashboardMetaModal.tsx](web/src/components/DashboardMetaModal.tsx)
  (nur Name für Erstellen/Umbenennen + Löschen). „+ Neu" legt ein leeres
  Dashboard an und landet direkt im Edit-Modus.
- **Inhalte via Checkbox-Modal:** [DashboardContentModal.tsx](web/src/components/DashboardContentModal.tsx)
  — der bisherige Checkbox-Modal, aber **ohne** Namensfeld und Löschen (die liegen
  jetzt beim Tab-Stift). Öffnet über „＋ Hinzufügen".
- Alter [DashboardEditorModal.tsx] entfernt.

**Verworfener Zwischenstand:** Kurzzeitig war der Sammel-Modal in einen
Quick-Add-Picker (Antipp-Chips + Gruppen-„+") zerlegt; auf Nutzerwunsch zurück
zum Checkbox-Modal — nur die Tab-Namen-Trennung blieb.

**Verifikation:** `pnpm typecheck` + `pnpm build` grün (182 kB JS / 60,6 kB gzip).
Browser-E2E gegen echten ESP32 (`brewcontrol.local`): Normalansicht clean;
Edit-Modus mit Tab-Stift/+Neu/Hinzufügen/Fertig; „Hinzufügen" öffnet
„Dashboard-Inhalte" mit korrekt vorausgewählten Häkchen; Add/Remove end-to-end
(Regler in Kochen hinzugefügt, per × zurückgenommen); Meta-Modal; keine
Konsolen-Fehler.

## WinUI-3-Politur Teil 1–5 (2026-07-13 – 2026-07-25)

Fünfteilige Konsistenz-Runde auf dem bestehenden Fluent-Redesign:
semantisches Farbsystem, neutrale Palette + Mica-Shell + Win11-Settings,
Fluent-2-Karten-Tokens, Firmware-Seite, Icons + Control-Positionen auf
allen Settings-Seiten. Ausführliche Session-Logs:
[SESSION-archive.md](SESSION-archive.md).

## Session 2026-07-25 — Netzwerk-Seite: mDNS-Kartenlayout + Netzwerk-Liste statt Dropdown

Nutzer-Mockup (Screenshot) für die mDNS-Karte + Wunsch nach Listen- statt
Dropdown-Auswahl für „WLAN wechseln".

**mDNS-Karte** ([NetworkPage.tsx](web/src/pages/NetworkPage.tsx)): Titel
„Hostname" → „mDNS", neue `desc` „Name vergeben, unter dem das Gerät gefunden
werden kann". Input+„.local"+„Speichern" nicht mehr im `control`-Slot der
Kopfzeile, sondern als volle Zeile im Body (`justify-between`: Input+Suffix
links, Button rechts) — mehr Platz, matcht das Mockup exakt.

**WLAN wechseln — Liste statt Dropdown:** `<select>` ersetzt durch anklickbare
Zeilen (`SignalBars` + SSID links, Status rechts). State umgebaut: `selSsid`/
`manual` (boolean) → einheitliches `expanded: string | null` (SSID der
aufgeklappten Zeile, oder Sentinel `'manual'` für die freie Eingabe — nur eine
Zeile gleichzeitig aufgeklappt). Klick auf eine Zeile klappt darunter Passwort-
Feld + „Verbinden"-Button auf (`selectNet`, toggelt beim erneuten Klick zu).
Status pro Zeile: `text-success` „Verbunden" wenn `status.ssid === n.ssid`,
sonst „Offen" (`n.open`) oder „Gesichert" — Farben/Text exakt wie vom Nutzer
vorgegeben. „Netzwerk manuell eingeben" bleibt als Fallback-Link unten in der
Liste (Scan-Fehler klappt es automatisch auf, wie zuvor).

**Verifikation:** `pnpm typecheck` + `pnpm build` grün (186,6 kB JS / 62,7 kB
gzip). Browser gegen echten ESP32: Scan liefert echte Netzwerke (FRITZ!Box 7490
als „Verbunden" in Akzent-Grün, o2-WLAN-AB40 als „Gesichert"), Klick klappt
Passwort+Verbinden korrekt auf, „Netzwerk manuell eingeben" klappt die vorherige
Zeile ein und zeigt SSID+Passwort+Verbinden — hell und dunkel geprüft.

**Nachtrag — Feinschliff Netzwerk-Liste (Nutzerfeedback):**
- Verbundenes Netz zeigt kein Passwortfeld/Verbinden-Button mehr (Klick
  highlightet die Zeile weiterhin, aber `{isExpanded && !isConnected && …}`).
- Highlight (`bg-subtle-pressed`) liegt jetzt auf dem äußeren Zeilen-Container
  statt nur auf dem Button — Passwortfeld + Verbinden-Button sitzen dadurch
  sichtbar *innerhalb* derselben hervorgehobenen Box wie die Zeile.
- Status („Verbunden"/„Offen"/„Gesichert") von rechts neben der SSID nach
  darunter verschoben, `text-xs` (Verbunden zusätzlich `text-success`) —
  gleiches Muster wie `SettingsCard.desc`.
- Farbiger Indikator links an der ausgewählten Zeile (Akzent-Pill,
  `absolute left-0 h-4 w-[3px] rounded-full bg-accent`) — identisches Muster
  zum Nav-Aktiv-Eintrag in [NavShell.tsx](web/src/components/NavShell.tsx).

Verifiziert gegen echtes Gerät: FRITZ!Box-Zeile (verbunden) zeigt Pill + „Verbunden"
ohne Formularfelder; Klick auf o2-WLAN-AB40 klappt Passwort+Verbinden innerhalb
der hervorgehobenen Box auf, vorherige Zeile klappt korrekt ein — hell und dunkel.

**Nachtrag 2 — Icon-Flucht + Indikator-Höhe:** Liste bekam `-mx-4` (kompensiert
die Card-Padding `px-4`), jede Zeile `px-4` statt `px-3` → `SignalBars` sitzt
jetzt exakt auf gleicher X-Position wie das `Wifi`-Icon der Kartenüberschrift
(per `getBoundingClientRect` verifiziert: beide `left: 33px`). Akzent-Indikator
`h-4`→`h-6` (höher) und von der Zeilen-Hülle in den `<button>` verschoben
(`relative` jetzt am Button) — bleibt dadurch an der Kopfzeile zentriert statt
über die ganze (bei Passwort-Eingabe höhere) Box zu mitteln. Manual-Entry-Block
verlor sein Extra-`px-3` (war nur nötig, um mit dem alten Zeilen-Offset zu
fluchten; jetzt erbt er direkt die Card-Einrückung).

**Nachtrag 3 — Highlight als „floating chip" (Nutzer-Referenzbild, Windows-11-
Settings-WLAN-Liste):** `-mx-4`/`px-4` → `-mx-2`/`px-2` — Icon bleibt exakt auf
der Header-Flucht (33px, per `getBoundingClientRect` erneut bestätigt), aber die
Highlight-Box bekommt jetzt ~9px sichtbaren Abstand zum Kartenrand (gemessen)
+ `rounded-md` (6px) statt kantenbündig. `space-y-1` zwischen den Zeilen für
kleinen vertikalen Abstand. Indikator `h-6 w-[3px]` → `h-8 w-1` (32×4px, größer,
bleibt vertikal zentriert auf der Kopfzeile). Verifiziert per Computed-Style-
Messung (Box-Rect vs. Card-Rect) und Screenshot hell/dunkel gegen echtes Gerät.

**Nachtrag 4 — Indikator-Inset statt fixer Höhe + Text-Einrückung (Nutzerfeedback):**
- Indikator war trotz `top-1/2 -translate-y-1/2` nicht sauber mittig und zu breit
  (`w-1`=4px). Fix: `top-1.5 bottom-1.5 w-[3px]` statt `h-8 -translate-y-1/2` —
  fester Ober-/Unterabstand (6px) statt fixer Höhe, dadurch **konstruktiv**
  zentriert (Höhe ergibt sich aus `Containerhöhe − 2×6px`), unabhängig von der
  tatsächlichen Zeilenhöhe. Verifiziert: `gapTop === gapBottom === 6px` an zwei
  unabhängigen Zeilen.
- Passwortfeld + mDNS-Textbox waren bündig mit der Icon-Spalte statt mit dem
  Titel-Text eingerückt. Fix: Passwort-Zeile `px-2` → `pl-[42px] pr-2`
  (42px = Button-`px-2`(8) + `SignalBars`-Breite(22) + `gap-3`(12), exakt der
  X-Offset des SSID-Texts). mDNS-Inputzeile + Validierungstext bekommen `pl-9`
  (36px = Icon-Größe 20 + `SettingsCard`-`gap-x-4`(16), exakter Text-Offset des
  Headers). Verifiziert: `pwInputLeft === ssidTextLeft` und
  `mdnsInputLeft === mdnsDescLeft` (beide 67px bzw. 69px, exakte Übereinstimmung).

## Kleinere Fixes 2026-08-11

Zwei isolierte Nutzerfeedback-Punkte, unabhängig von der Netzwerk-Seite:

- **Zeit & Formate — fehlende Untertitel:** Die Karten „Zeitformat" und
  „Datumsformat" hatten (anders als alle anderen `SettingsCard`s auf der
  Seite) keinen `desc`-Text. Ergänzt: „12- oder 24-Stunden-Anzeige" bzw.
  „Reihenfolge von Tag, Monat und Jahr" ([TimePage.tsx](web/src/pages/TimePage.tsx)).
- **Firmware-Update — Einrückung „Manueller Upload":** Die beiden
  `FileUpload`-Zeilen („Firmware (.bin)", „UI-Paket (.tar)") saßen bündig
  am Kartenrand statt mit dem Beschreibungstext der Karte zu fluchten.
  Fix: `pl-9` (36px = Icon-Größe 20 + `SettingsCard`-`gap-x-4` 16, selbes
  Muster wie beim mDNS-Textfeld) auf den umgebenden `space-y-4`-Container
  ([FirmwarePage.tsx](web/src/pages/FirmwarePage.tsx)). Verifiziert per
  `getBoundingClientRect`: beide Label und der Karten-`desc` liegen exakt
  auf `left: 69px`.

**Verifikation:** `pnpm typecheck` + `pnpm build` grün (186.85 kB JS /
62.83 kB gzip). Browser-Check gegen echtes Gerät (`brewcontrol.local` via
Dev-Proxy): Zeit-Seite zeigt beide Untertitel; Firmware-Seite misst
`Firmware (.bin)`/`UI-Paket (.tar)`/Karten-`desc` alle auf identischer
X-Position.

**Nachtrag — Settings-Übersicht: oberer Kartenabstand:** Die Index-Seite
([SettingsIndex.tsx](web/src/pages/SettingsIndex.tsx)) hatte `header` ohne
`mb-6` und stattdessen `mt-4` auf der Kartenliste (16px Abstand), während
alle Unterseiten `header class="mb-6"` (24px) direkt vor der Kartenliste
nutzen. Fix: `mb-6` auf den Header verschoben, `mt-4` von der Kartenliste
entfernt — Muster jetzt identisch zu z. B. `AppearancePage.tsx`. Verifiziert
per `getBoundingClientRect`: Header-Unterkante 56px, erste Karte 80px
(24px Abstand) — auf `/settings` und `/settings/appearance` identisch.

## Dashboard-Karten: einheitliche Höhe 2026-08-11

Nutzerfeedback: Sensor-, Regler- und Aktor-Karten im Dashboard hatten je
nach Inhalt unterschiedliche Höhe (gemessen: Sensor 135px, Regler 149px,
Aktor 114px) — die Reihe wirkte dadurch uneben statt bündig.

**Fix:** gemeinsames `min-h-[160px]` auf den Karten-Root-`<div>` in
[SensorCard.tsx](web/src/components/SensorCard.tsx),
[ActuatorCard.tsx](web/src/components/ActuatorCard.tsx) und
[ControllerCard.tsx](web/src/components/ControllerCard.tsx) (160px orientiert
sich am bisher höchsten Fall, der Regler-Karte mit Setpoint-Zeile). Karten mit
mehr Inhalt (z. B. Regler mit sichtbarem AutoTune-Status) wachsen weiterhin
natürlich über die Mindesthöhe hinaus — das ist gewollt, betrifft aber nicht
den Normalfall.

**Verifikation:** `pnpm typecheck` + `pnpm build` grün. Browser-Check gegen
echtes Gerät auf beiden vorhandenen Dashboards („Maischen": 1 Sensor/1 Regler/
1 Aktor; „Kochen": 1 Sensor/2 Aktoren, keine Regler) — alle Karten messen
exakt 160px, `getBoundingClientRect` bestätigt identische Bottom-Kante
(837px) für alle drei Karten der ersten Reihe auf „Maischen". Dark-Mode
gegengecheckt; Höhe ist themeunabhängig (reine Layout-Eigenschaft).

## SD-Dateiverwaltung 2026-08-21

Neue Settings-Seite zum Browsen/Hoch-/Herunterladen/Löschen/Umbenennen/
Anlegen von Dateien und Ordnern auf der SD-Karte, mit `/www` und `/www.new`
(laufende UI-Dateien bzw. OTA-Asset-Staging) als geschützt — sonst könnte
sich die Seite über sich selbst die eigene Oberfläche wegschießen.

**Firmware** ([WebUI.h](firmware/src/WebUI.h), [WebUI.cpp](firmware/src/WebUI.cpp)):
`GET /api/files?path=`, `GET /api/files/download`, `POST /api/files/upload`
(multipart, Feld `f`), `DELETE /api/files`, `POST /api/files/rename`,
`POST /api/files/mkdir`. Neuer `validFilePath_()`-Guard (Traversal-Check +
403 auf `/www`/`/www.new` bei mutierenden Ops); `removeRecursive_()` aus der
bisherigen `swapAssets_`-Lambda extrahiert (jetzt einzige Kopie, von beiden
genutzt).

**Frontend** ([FilesPage.tsx](web/src/pages/FilesPage.tsx), neu): In-Page-
Pfad-Navigator, Tabelle mit Ordner/Datei-Icons, Inline-Rename, Inline-„Neuer
Ordner", `ConfirmModal` für Löschen, Upload mit Progress (bestehendes
`uploadFile`-XHR-Helper aus `api.ts` wiederverwendet). `/www`-Zeilen bzw.
das `/www`-Verzeichnis selbst zeigen deaktivierte Rename/Delete/Ordner/
Upload-Controls mit Tooltip „Geschützt — UI-Dateien" (reines UX — der
echte Schutz ist der Backend-403, das Gerät hat ohnehin keine Auth).

**Verifikation:** `pio run -e esp32dev` + `pnpm typecheck` grün. Auf
LilyGo T-Display-S3-AMOLED geflasht (nach zwei alten `pio device monitor`-
Prozessen, die COM9 blockiert hatten) und per `curl` durchgetestet: List/
Download/mkdir/rename/delete-Rundlauf inkl. 403 auf `/www` bei allen
mutierenden Ops, Upload-Roundtrip byte-identisch, `/www` nach abgelehntem
Upload-Versuch unverändert. Neues Web-UI-Bundle (`pnpm build:sd` + `tar` +
`/api/update/assets`) live aufgespielt und im Browser gegen das Gerät
durchgeklickt — „Dateiverwaltung" erscheint in den Einstellungen, `/www`-
Navigation zeigt die deaktivierten Controls live, während die Seite sich
selbst aus `/www` bedient (der eigentliche Self-Brick-Testfall).

## LittleFS-Unterstützung für esp32dev/lolin_s2_mini 2026-08-28

User hat zwei zusätzliche Testboards (esp32dev, lolin_s2_mini) ohne SD-
Kartenleser. Ziel: UI + Persistenz komplett auf internem Flash (LittleFS)
statt SD, ohne den SD-Pfad für den LilyGo S3 (hat onboard-SD-Slot) anzufassen.
Vorab per Explore-Agenten verifiziert: `WebUI` und alle Store-Klassen
(`DynamicItems`, `SettingsStore`, `LogStore`, `DashboardStore`,
`ProgramRunner`, `FirmwareUpdater`) nehmen schon generisches `fs::FS&` — nur
`main.cpp`s Mount-Aufruf ist SD-spezifisch. `ESPAsyncWebServer`s
`serveStatic()`/`send(FS&, path)` selbst im Quellcode gegengelesen
(`.pio/libdeps/.../WebHandlers.cpp:143-171`, `AsyncWebServerRequest.cpp:24-58`):
beide fallen transparent auf `<pfad>.gz` zurück, wenn die unkomprimierte Datei
fehlt — nur die gzippten Assets müssen aufs Board, nicht `dist/` komplett
(~77 KB statt ~320 KB, empirisch bestätigt: `buildfs` mit nur-gzip baut sauber
auf die exakte 256-KB-Partitionsgröße, volle `dist/` würde sie sprengen).

**Neue Partitionstabelle** ([partitions_4mb_littlefs.csv](firmware/partitions_4mb_littlefs.csv)):
abgeleitet von `min_spiffs.csv`, je 64 KB von beiden OTA-App-Slots (1,875 MB →
1,8125 MB) in die Datenpartition verschoben (128 KB → 256 KB). Bei aktueller
Flash-Nutzung (1.382.373 B nach den MQTT/Webhook/ESP-NOW-Änderungen dieser
Session) ergibt das ~72,7 % App-Slot-Belegung, ~27 % Puffer.

**Firmware** ([platformio.ini](firmware/platformio.ini), [main.cpp](firmware/src/main.cpp)):
`esp32dev`/`lolin_s2_mini` bekommen `-DBREWCTL_USE_LITTLEFS=1` +
`board_build.filesystem = littlefs` + die neue Partitionstabelle;
`lilygo_t_display_s3_amoled` unverändert. `main.cpp`: `#ifdef
BREWCTL_USE_LITTLEFS`-Zweig mountet `LittleFS.begin(true)` statt `SD.begin(...)`,
neuer `fs::FS& deviceFs`-Alias ersetzt alle direkten `SD`-Referenzen (reiner
Parameter-Swap, da alle Ziel-Signaturen schon `fs::FS&` waren), `sdOk` →
`fsOk` umbenannt (gilt jetzt für beide Dateisysteme). `SdLock` bewusst
unverändert um alle FS-Zugriffe behalten (generischer Mutex, kein SD-Detail).

**Deploy** ([firmware/data/www/](firmware/data/www/), gitignored Build-Artefakt
wie `.pio`): `pnpm build:sd` → nur `*.gz`-Dateien nach `firmware/data/www`
kopieren (Struktur erhalten) → `pio run -t uploadfs` pro Board flasht das
LittleFS-Image per USB. Ersetzt den SD-Card-Copy-Schritt für diese zwei Boards;
`webui.tar`-Netzwerk-Upload-Pfad bleibt unverändert nutzbar (schon FS-agnostisch).

**Bekannte Einschränkung, bewusst nicht gelöst:** `FirmwareUpdater::flashFromSdImage()`
(Offline-Boot-Flash-Recovery via `firmware.bin`) passt nicht mehr auf 256 KB —
Netzwerk-OTA (Normalfall) ist davon unberührt. `LogStore` hat keine Retention/
Rotation — auf 256 KB sollte auf diesen beiden Boards nicht unbegrenzt geloggt
werden.

**Verifikation:** `pio run -e esp32dev` (72,8 % Flash, passt exakt zur Planung),
`pio run -e lolin_s2_mini` (69,5 %), `pio run -e lilygo_t_display_s3_amoled`
(20,0 %, Regressions-Guard — unverändert) alle grün. `pio run -e esp32dev
-t buildfs` baut das LittleFS-Image (262.144 B = exakt Partitionsgröße) aus
`data/www` (76.439 B, nur gzip) erfolgreich; volle `dist/` (328.485 B, roh+gzip)
hätte nicht gepasst (rechnerisch bestätigt, nicht extra gebaut).

**Hardware-Verifikation LOLIN S2 Mini (2026-08-28, Folge-Session):** `uploadfs` +
`upload` per USB (COM-Port wechselt bei ESP32-S2 nativem USB zwischen Firmware-
und Download-Modus — `esptool` meldet nach dem Schreiben einen kosmetischen
Fehler „can not exit download mode over USB", Daten waren aber jeweils
„Hash of data verified"; nach manuellem Reset lief die Firmware normal).
Board unter `brewcontrol-lolin.local` erreichbar (bereits aus früherer Session
mit WLAN-Zugangsdaten versorgt). Verifiziert: `GET /` liefert die UI mit
`Content-Encoding: gzip` (bestätigt den `.gz`-only-Serve-Pfad live, nicht nur
aus dem Quellcode), `GET /api/files?path=/` zeigt `www`+`config` auf der
gemounteten LittleFS-Partition. Persistenz-Rundlauf: dynamischen Sensor
angelegt, Reboot über `POST /api/network` (gleicher Hostname erneut gesetzt —
löst Reboot aus ohne WLAN-Zugangsdaten zu ändern) ausgelöst, Sensor nach
Neustart weiterhin vorhanden (frischer Timestamp bestätigt echten Reboot).
Test-Sensor wieder gelöscht. LilyGo S3 (`brewcontrol.local`, SD-Pfad
unverändert) parallel als Regressions-Check bestätigt — weiterhin erreichbar.

**Hardware-Verifikation esp32dev (2026-08-28, gleiche Session):** Dieser
Dev-Kit-Klon geht nicht automatisch in den Download-Modus (`esptool`:
„Wrong boot mode detected (0x13)") — braucht für **jeden** Flash-Vorgang
manuell BOOT gedrückt halten + EN/RST antippen, dann BOOT weiter halten bis
`esptool` verbindet (klassischer Klon ohne zuverlässige Auto-Reset-Schaltung).
Danach `uploadfs` + `upload` erfolgreich. Board hatte keine gespeicherten
WLAN-Zugangsdaten (erster echter Boot) — Setup-Portal-AP „BrewControl-Setup"
kam hoch, User hat manuell verbunden, danach unter `brewcontrol-esp32dev.local`
erreichbar. Boot-Log **direkt** (nicht nur funktional erschlossen) bestätigt:
„LittleFS mounted". Gleicher Verifikations-Rundlauf wie beim LOLIN S2 Mini:
`GET /` mit `Content-Encoding: gzip`, `/api/files?path=/` zeigt `www` auf
LittleFS, dynamischer Sensor übersteht Reboot (via `/api/network`-Hostname-
Resubmit ausgelöst). Test-Sensor gelöscht. LOLIN S2 Mini + LilyGo S3 parallel
als Regression bestätigt — beide weiterhin erreichbar.

**Damit sind alle drei Boards (esp32dev, LOLIN S2 Mini via LittleFS; LilyGo S3
via SD) hardware-verifiziert.** Harmloser Nebenbefund im esp32dev-Boot-Log:
eine Core-Dump-Checksum-Warnung von einer alten Core-Dump-Partition (Offset
hat sich mit der neuen Partitionstabelle verschoben) — nicht fatal, ESP-IDF
ignoriert einen ungültigen Core-Dump einfach.

## 2026-08-29 — Bug gefunden + gefixt: eingebauter MQTT-Broker verwarf alle Retained-Messages

**Ausgangslage:** Alle drei Boards jetzt parallel online, damit erstmals der
in der Remote-Node-Session (2026-08-21) offen gelassene Punkt nachholbar:
echter State-Empfang von einem tatsächlichen zweiten Board (bisher nur „legt
korrekt an, zeigt sauber stale ohne Leaf" verifiziert). Kein extra Leaf-Sketch
nötig — `MqttService` verdrahtet bereits automatisch einen `RemotePublisher`,
der die komplette eigene Registry spiegelt, sobald MQTT aktiviert ist
([MqttService.cpp:62-96](firmware/src/MqttService.cpp)). LilyGo S3 lief bereits
mit aktiviertem eingebautem Broker (aus einer früheren Session). LOLIN S2 Mini
testweise als externer MQTT-Client auf LilyGos Broker konfiguriert
(`POST /api/settings`, `mode:"external"`, `host:<LilyGo-IP>`), dann per
`POST /api/sensors` ein `Remote`-Sensor (`transport:"mqtt"`, `device:"brewcontrol"`,
`remote_id:"mlt"`, `prefix:"brewcontrol"`) angelegt — zeigt auf LilyGos echten
`mlt`-Temperatursensor.

**Bug:** State kam korrekt an (`v` folgte live dem echten Sensorwert), aber
`meta` (kind/quantity/unit/min/max/res) blieb dauerhaft auf den Default-Werten
(`Binary`/`None`/`0`/`0`/`0`) — auch nach vollständigem Reboot von LOLIN (kein
Timing-Zufall). Root Cause im TinyMqtt-Quellcode nachgelesen: `RemotePublisher`
publiziert Meta nur einmal (bei `begin()`/Reconnect) mit `retained=true`, State
dagegen periodisch — ein neuer Subscriber lernt Meta also nur über eine
Retained-Message-Zustellung beim Subscribe. `MqttService.cpp:36` konstruierte
den eingebauten Broker aber als `MqttBroker(port)` ohne `retain_size` —
Default ist `0`, und TinyMqtts eigenes README sagt explizit „Supports retained
messages (not activated by default)". Bei `retain_size==0` tut
`MqttBroker::retain()` schlicht nichts — der eingebaute Broker hielt **keine**
einzige Retained-Message vor, unabhängig vom `retain`-Flag der Publisher.
Betrifft nur den eingebauten Broker-Modus; externe Broker (Mosquitto etc.)
sind vermutlich nicht betroffen (Retain dort standardmäßig aktiv), aber
ungetestet.

**Fix:** `MqttBroker(port, /*retain_size=*/64)` in
[MqttService.cpp:36](firmware/src/MqttService.cpp:36) — 64 Topic-Slots
(Sensor/Aktor je 2 Topics, Controller 1; aktuell 13 auf LilyGo, deutlicher
Puffer für Laufzeit-Wachstum via `DynamicItems`). `retain_size` ist eine
Obergrenze für die Anzahl **verschiedener** Topics mit Retained-Message
(LRU-Eviction des ältesten Topics bei Überlauf, kein Payload-Größen-Limit) —
im TinyMqtt-Quellcode verifiziert (`TinyMqtt.cpp:961-991`), nicht geraten.

**Verifikation:** `pio run` alle drei Envs grün (Flash-Werte unverändert
gegenüber der letzten Messung). LilyGo S3 geflasht (COM9, sauberer Reset via
RTS, keine manuellen Buttons nötig), komplette Registry (Sensoren, Aktoren,
laufendes `mash`-Programm) nach Reflash unverändert vorhanden — Regressions-
Check bestanden. Derselbe Zwei-Board-Test wiederholt: Meta kommt jetzt korrekt
an (`kind:"Continuous"`, `quantity:"Temperature"`, `unit:"°C"`, `min:-55`,
`max:125`, `res:0.0625` — identisch zu LilyGos echtem `mlt`-Sensor). Damit ist
der MQTT-Remote-Pfad jetzt vollständig E2E bestätigt (State **und** Meta, mit
echtem Leaf über zwei physische Boards). Test-Sensor gelöscht, LOLINs
MQTT-Settings zurückgesetzt (disabled, wie vor dem Test).

**Weiterhin offen:** Webhook- und ESP-NOW-Leaf-Test — dafür kann BrewControl
aktuell nicht als Sender auftreten (`RemotePublisher` ist nur an `MqttService`
verdrahtet, nicht an `WebhookService`/`EspNowTransport`); bräuchte entweder
einen Board mit dem Beispiel-Sketch ([10_remote_webhook](../SensActCtrl/examples/10_remote_webhook),
[09_remote_espnow](../SensActCtrl/examples/09_remote_espnow)) als Leaf, oder
ein neues Firmware-Feature („BrewControl sendet eigene Items auch über
Webhook/ESP-NOW") — noch nicht entschieden.

## 2026-08-29 — Feature: Publish-Pfad für Webhook + ESP-NOW (symmetrisch zu MqttService)

**Ausgangslage:** Direkte Folge des obigen MQTT-Zweitgeräte-Tests — Webhook und
ESP-NOW waren in der Firmware bisher nur Consumer-seitig verdrahtet
(`DynamicItems::resolveRemoteTransport()` reicht `type:"Remote"`-Items einen
Transport durch), es gab aber keinen Pfad, der die eigene Registry über diese
beiden Transporte nach außen anbietet — anders als MQTT, wo `MqttService`
das bereits automatisch tut. Auf Library-Ebene (SensActCtrl) war alles
Nötige schon vorhanden (`EspNowTransport`/`WebhookTransport` implementieren
beide `ITransport` wie `MqttTransport`, `RemotePublisher` ist transport-
agnostisch) — die Lücke war rein BrewControl-firmware- und Frontend-seitig.

**Umsetzung** (Details im Plan-Dokument dieser Session, hier nur die Kernpunkte):

- **`DynamicItems`**: die sechs Live-Add/Remove-Hooks (`setOnSensorAdded` etc.)
  waren `std::function`-Einzel-Member, die bei jedem `set...()`-Aufruf
  überschrieben wurden — `MqttService` belegte sie bereits, ein zweiter/dritter
  Aufrufer (Webhook/ESP-NOW-Publish) hätte MQTTs Live-Tracking klammheimlich
  kaputt gemacht. Auf `std::vector<std::function<...>>` umgebaut (mehrere
  Beobachter, in Registrierungsreihenfolge aufgerufen) — API-kompatibel zu
  bestehenden Aufrufern.
- **`SettingsStore`**: neue Felder `webhookEnabled/webhookListenPort/
  webhookPeerUrl/webhookClientId/webhookTopicPrefix` und
  `espnowEnabled/espnowClientId/espnowTopicPrefix`, dreifach gespiegelt
  (`loadFromSD`/`serialize`/`update`) nach dem bestehenden `mqtt*`-Muster.
  Kein Channel-Setting für ESP-NOW — reitet den bestehenden globalen
  `EspNowTransport` (fixer Channel 1).
- **`WebhookService`** um Publish-Fähigkeit erweitert (`beginPublish()`,
  `attachExistingPublish()`, `publishConnected()`/`publishLastErrorMessage()`)
  statt einer neuen Klasse — sie ist bereits Transport-Owner/Cache für diesen
  Transporttyp; ein Publish-Ziel reuse't `getOrCreate()` genau wie ein
  Consumer-Item.
- Neue Klasse **`EspNowPublishService`** (kein Analogon zum Erweitern
  vorhanden) — nimmt den bestehenden globalen `EspNowTransport` per Pointer
  entgegen (Konstruktor-Reihenfolge: der globale Service existiert vor
  `setup()`, der Transport erst danach).
- **`WebUI`**: Konstruktor um `WebhookService&`/`EspNowPublishService&`
  erweitert, `/api/settings` GET/POST um `webhook`/`espnow`-Sektionen ergänzt
  (Validierung + gemeinsamer Reboot-Trigger wie bei `mqtt`).
- **`main.cpp`**: neue Verdrahtung reihenfolgekritisch — `espNowPublishService.begin()`
  erst nach `espNowTransport`-Konstruktion UND `settingsStore.loadFromSD()`
  möglich, beide an der `mqttService.begin()`-Stelle bereits erfüllt.
- **Web-Frontend**: `WebhookSettings`/`EspNowSettings` in `types.ts`, neue
  Seiten `WebhookPage.tsx`/`EspNowPage.tsx` (Klon von `MqttPage.tsx`), zwei
  neue `SettingsIndex`-Einträge + Routen.

**Verifikation:** `pio run` alle drei Envs grün (esp32dev 73,2 % Flash,
lolin_s2_mini 69,9 %, lilygo_t_display_s3_amoled 20,1 % — je +0,5–0,8pp
gegenüber vorher). `pnpm typecheck` grün. Neue Settings-Seiten im Vite-Dev-
Server gegen echtes Board geprüft (Rendering, Icons, keine Konsolenfehler).
Beide Boards (LilyGo COM9, LOLIN COM5) per USB neu geflasht, UI-Bundle-Upload
auf LOLIN schlägt fehl (`Connection was reset` bei `/api/update/assets`,
unverändeter Asset-Upload-Pfad — siehe „Beiläufig gefunden" unten; nicht
blockierend, da alle Tests direkt über die API liefen).

Hardware-Test beider Boards live:
- **Webhook:** LOLIN (`enabled, listenPort:8080, peerUrl:""`) + LilyGo
  (`enabled, peerUrl:"http://192.168.178.82:8080"`) → LilyGos eigener
  Retained-Cache (`GET :8080/brewcontrol/lilygo/sensor/mlt/meta`) zeigt
  korrektes Meta+State direkt nach Boot — Publish-Pfad selbst bestätigt.
  `Remote`-Consumer-Sensor auf LOLIN (anderer lokaler Port 8081, da LOLINs
  eigener Publish-Transport bereits Port 8080 mit einem anderen Peer belegt —
  `WebhookService::getOrCreate()` cached strikt nach `(port,peerUrl)`-Paar,
  zwei verschiedene Peers auf demselben Port öffnen zwei `WebServer`-Instanzen
  auf demselben physischen Port; vorbestehendes Cache-Design, hier nicht
  angefasst) empfing nach einem sauberen Reboot Meta **und** State korrekt.
  Direkt nach dem Anlegen blieb Meta einmal aus (vermutlich transienter
  Zustand nach mehreren dynamischen Sensor-Add/Remove-Zyklen im selben
  Boot) — nach Reboot reproduzierbar korrekt.
  **Negativtest bestätigt das dokumentierte Blocking-Risiko:** Peer auf eine
  nicht erreichbare IP gesetzt → **alle** HTTP-Requests an das Board
  (auch `/api/snapshot`, unabhängig vom Webhook-Pfad) hingen ~2,5 s pro
  Versuch bzw. schlugen zeitweise ganz fehl, bis der Reboot mit
  deaktiviertem Webhook griff — `WebhookTransport::publish()` blockiert
  `loop()` mit `HTTPClient::POST`, wie in der Architektur-Bewertung erwartet.
- **ESP-NOW:** beide Boards `enabled:true` → `connected:true`.
  `Remote`-Consumer-Sensor auf LOLIN: **State kam sofort und zuverlässig an**
  (Live-Broadcast, mehrfach mit steigendem Timestamp bestätigt), **Meta blieb
  dauerhaft auf Default-Werten** — auch nach zwei sauberen Reboots beider
  Boards reproduzierbar, also kein Timing-Zufall. `EspNowTransport`s
  Retained-Request/Reply-Mechanismus (`subscribe()` broadcastet eine
  1-Byte-Anfrage, der Leaf soll seinen `retained_`-Cache daraufhin
  zurücksenden — im Quellcode korrekt aussehend, siehe `EspNowTransport.cpp`)
  liefert auf dieser Hardware in der Praxis kein Meta an spät hinzugefügte
  Subscriber. Reine SensActCtrl-Library-Charakteristik (Code hier nicht
  angefasst), nicht Teil dieses Scopes zu fixen — als offener Befund
  festgehalten (siehe unten).

Nach jedem Testblock: Test-Sensoren gelöscht, `webhook`/`espnow`-Settings auf
beiden Boards zurückgesetzt (disabled). Abschließender Regressions-Check:
LilyGos volle Registry (Sensoren/Aktoren/`mash`-Controller) und MQTT-Status
(embedded, connected) unverändert; LOLIN wieder leere Registry wie vor dem
Test.

**Bekannte, akzeptierte Einschränkungen** (dokumentiert, nicht Teil dieses Fixes):
- Webhook-Publish blockiert `loop()` bei unerreichbarem Peer (live bestätigt,
  s.o.) — `HTTPClient::POST` ist blockierend, Cadence passt für ~1 Hz State,
  nicht für einen dauerhaft unerreichbaren Peer.
- ESP-NOW verwirft Pakete >250 Byte silently (`EspNowTransport::sendDataPacket_`)
  — Controller mit vielen Params sind Kandidaten für permanent fehlendes Meta.
- **Neu gefunden:** ESP-NOW liefert Meta an spät hinzugefügte Subscriber über
  den Retained-Request-Mechanismus auf dieser Hardware nicht zuverlässig
  (State funktioniert einwandfrei) — reproduzierbar über zwei saubere Reboots,
  Ursache nicht weiter eingegrenzt (SensActCtrl-Library, außerhalb des Scopes
  dieser Änderung). Für ESP-NOW-Leafs bedeutet das: ein `Remote`-Sensor, der
  erst nach dem Leaf-Boot angelegt wird, bekommt aktuell nur State, kein Meta
  (kind/unit/min/max/res bleiben auf Default) — für BrewControls Dashboard
  praktisch relevant (Anzeige-Einheit/Skala fehlt), sollte bei Bedarf als
  eigener SensActCtrl-Bug untersucht werden.
- `lastErrorMessage()` liefert für Webhook/ESP-NOW strukturell immer `""`
  (nur `MqttTransport` überschreibt es) — kein Bug, nur beim Blick auf die
  Status-Anzeige in der UI zu beachten.

**Beiläufig gefunden (nicht behoben, nicht Teil dieses Scopes):** `POST
/api/update/assets` (UI-Tar-Upload) schlägt auf LOLIN S2 Mini reproduzierbar
mit `Connection was reset` nach ~65 KB fehl (Board bleibt danach stabil
erreichbar, kein Crash) — vorbestehender, unveränderter Code-Pfad
(`SdTarSink`/`TarExtractor`), nicht durch diese Änderung berührt. LilyGo S3
war vom selben Upload nicht betroffen (`HTTP 200`). Nicht weiter untersucht.

## 2026-08-29 — Fix: Webhook-Publish blockiert `loop()` nicht mehr unbegrenzt

**Ausgangslage:** Aus dem "Bekannte Probleme"-Backlog (siehe PLAN.md) —
`WebhookTransport::publish()`/`pullRetained_()` (SensActCtrl) machen einen
blockierenden `HTTPClient`-Call ohne Timeout. Bei unerreichbarem Peer hing
das Board für ~2,5s *pro Versuch*, und `RemotePublisher::tick()` versucht
das bei jedem Loop-Durchlauf erneut — spürbar auch für unbeteiligte Requests
wie `/api/snapshot`.

**Entscheidung:** Nutzer wollte prüfen, ob echtes Async (Option B: FreeRTOS-
Task + Queue, `HTTPClient`-Call komplett aus `loop()` raus) machbar ist.
Bewertet und verworfen — würde Multi-Threading in einen bisher komplett
single-threaded Layer einführen (Mutex um `retained_`/`subs_` nötig,
Thread-Safety-Review für `RemoteSensor`/`RemoteActuator`-Callbacks, kein
nativer Test für den `ARDUINO`-Pfad). Aufwand/Risiko für ein Hobby-Projekt
nicht gerechtfertigt, wenn der pragmatischere Fix denselben praktischen
Nutzen bringt. Stattdessen **Option A**: Timeout + Backoff, synchron.

**Umsetzung** (`SensActCtrl/src/transport/WebhookTransport.h`/`.cpp`):
- `http.setTimeout(800)` vor jedem `POST`/`GET` (statt `HTTPClient`-Default
  von mehreren Sekunden).
- Nach einem fehlgeschlagenen Outbound-Call (POST oder GET) 5s Backoff für
  den gesamten Transport (ein Peer pro Instanz) — in dem Fenster wird
  `publish()`/`pullRetained_()` sofort `false`/no-op zurückgegeben, **ohne**
  überhaupt einen Netzwerk-Call zu versuchen. Ein Erfolg setzt den Backoff
  zurück.
- Wraparound-sicherer `millis()`-Vergleich (`now - lastFailureMs_ <
  kBackoffMs`), gleiches Idiom wie in `RemotePublisher`.
- Native Stubs (`!ARDUINO`-Zweig) für die drei neuen privaten Helper
  ergänzt (No-ops), damit der native Build weiter linkt.

**Verifikation:**
1. `pio test -e native` (SensActCtrl): 192/192 Tests grün.
2. Compile-Smoke alle drei BrewControl-Envs (`esp32dev`, `lolin_s2_mini`,
   `lilygo_t_display_s3_amoled`): alle SUCCESS, Flash-Nutzung unverändert.
3. Hardware-Negativtest auf LilyGo (`192.168.178.87`): Webhook mit
   unerreichbarer `peerUrl` (`192.168.178.250:8080`) aktiviert, danach 14×
   `/api/snapshot` im ~0,7s-Abstand über ~10s gemessen. Vorher (2026-08-29,
   siehe oben): ~2,5s pro Request. Jetzt: durchgehend 72–173ms, kein
   einziger Ausreißer. Danach Webhook wieder deaktiviert, Board auf
   Baseline zurückgesetzt.

**Bewusst nicht gemacht:** echtes Async (Option B) — bleibt als möglicher
Folge-Schritt, falls die synchrone Backoff-Lösung sich in der Praxis als
nicht ausreichend erweist. `publish()`/`pullRetained_()` können weiterhin
kurz (bis 800ms) blockieren, wenn der Backoff gerade abgelaufen ist und ein
neuer Versuch fällig wird.

**Geänderte Dateien:** `SensActCtrl/src/transport/WebhookTransport.h`,
`SensActCtrl/src/transport/WebhookTransport.cpp`.

## 2026-08-29 — Fix: `lastErrorMessage()` für Webhook + ESP-NOW

**Ausgangslage:** Aus dem "Bekannte Probleme"-Backlog — nur `MqttTransport`
überschrieb `ITransport::lastErrorMessage()`; Webhook/ESP-NOW lieferten
strukturell immer `""`, egal was schiefging. Damit war die Fehler-Anzeige
in der Settings-UI für diese beiden Transporte tot.

**Umsetzung:**
- **`WebhookTransport`**: `lastErrorMessage()` überschrieben. Anders als
  bei MQTT (nur `!connected()`) wird der Text auch gezeigt, wenn
  `connected()==true` — `connected()` reflektiert bei Webhook nur WLAN, sagt
  aber nichts über Peer-Erreichbarkeit, und genau *das* ist der praktisch
  relevante Fehlerfall (siehe Timeout/Backoff-Fix von vorhin). Neuer Helper
  `describeHttpFailure(int code)` übersetzt `HTTPClient`-Fehlercodes
  (`HTTPC_ERROR_*`) und HTTP-Statuscodes in deutsche Kurztexte (z.B.
  "Verbindung zum Peer abgelehnt", "Peer antwortete mit HTTP 404"). Wird bei
  jedem fehlgeschlagenen `publish()`/`pullRetained_()` gesetzt, bei Erfolg
  geleert. `http.begin()`-Fehlschlag (ungültige URL) meldet jetzt ebenfalls
  einen Fehler statt nur `false` zurückzugeben.
- **`EspNowTransport`**: `lastErrorMessage()` überschrieben, deckt zwei
  Fälle ab: (a) Init-Fehler (`esp_now_init()`/`esp_now_add_peer()`
  fehlgeschlagen — vorher schon über `connected()==false` sichtbar, aber
  ohne Text) und (b) der aus dem Backlog bekannte, bisher komplett stille
  "Paket >250 Byte wird verworfen"-Fall (`sendDataPacket_()`) — jetzt z.B.
  "Paket zu groß (312 Byte, max 250) — verworfen". Der Drop selbst bleibt
  bestehen (kein Scope dieser Änderung), nur die Sichtbarkeit ist neu.
- Native Stubs (`!ARDUINO`) für beide Transporte um `lastErrorMessage() { return ""; }`
  ergänzt, sonst Linker-Fehler im nativen Build.
- Keine BrewControl-seitigen Änderungen nötig — `WebhookService`/
  `EspNowPublishService`/`WebUI.cpp` reichen `ITransport::lastErrorMessage()`
  bereits transparent bis in `/api/settings` durch (`webhook.error`/
  `espnow.error`).

**Verifikation:**
1. `pio test -e native` (SensActCtrl): 192/192 grün.
2. Compile-Smoke alle drei BrewControl-Envs: SUCCESS.
3. Hardware auf LilyGo: Webhook mit unerreichbarer `peerUrl` aktiviert →
   `GET /api/settings` zeigt `"webhook":{"error":"Verbindung zum Peer
   abgelehnt", ...}` statt `""`, Antwortzeit weiterhin ~100ms (Backoff aus
   dem vorherigen Fix bleibt intakt). Danach Webhook deaktiviert, `error`
   wieder `""` — Baseline wiederhergestellt.
4. ESP-NOW-Seite (Init-Fehler-Text, Paket-zu-groß-Text) **nicht** auf
   Hardware nachgestellt — kein Controller mit genug Params zur Hand, um
   die 250-Byte-Grenze gezielt zu reißen, und ein Init-Fehler ist auf
   funktionierender Hardware nicht provozierbar. Nur Compile-Smoke +
   Code-Review, gleicher Verifikationsstand wie der ursprüngliche
   250-Byte-Fund selbst.

**Geänderte Dateien:** `SensActCtrl/src/transport/WebhookTransport.h`/`.cpp`,
`SensActCtrl/src/transport/EspNowTransport.h`/`.cpp`.

## 2026-08-31 — Fix: ESP-NOW Meta an spät hinzugefügte Consumer

**Ausgangslage:** Aus dem "Bekannte Probleme"-Backlog — ein erst nach dem
Leaf-Boot angelegter `Remote`-Sensor über ESP-NOW bekommt zuverlässig
State, aber Meta (kind/unit/min/max/res) bleibt auf Default, reproduzierbar
über zwei saubere Reboots. Ein Explore-Agent hat den Retained-Request/Reply-
Mechanismus in `EspNowTransport` durchgetraced und zwei zusammenhängende
Ursachen gefunden.

**Root Cause:**
- **Bug A:** `EspNowTransport::subscribe()` (`EspNowTransport.cpp:124-132`
  vor dem Fix) sendet einen Retained-Request-Broadcast nur, wenn seit dem
  letzten Request >1s vergangen ist — sonst passiert gar nichts, der
  Request wird nicht nachgeholt. `lastRetainedRequestMs_` ist ein einziger,
  transport-weiter Zeitstempel, nicht pro Topic. Beim Boot rufen viele
  Stellen kurz hintereinander `subscribe()` auf derselben Transport-Instanz
  auf: `Registry::begin()` iteriert alle Sensoren synchron, jeder
  `RemoteSensor`/`RemoteActuator` subscribed 2× (Meta + State), danach
  hängt `EspNowPublishService::attachExisting()` noch mehr `subscribe()`-
  Aufrufe für lokale Actuator-/Controller-Topics an. Nur der erste Aufruf
  in diesem Burst broadcastet tatsächlich — alle anderen (deterministisch
  abhängig von der Item-Reihenfolge in `registry.json`) verlieren ihre
  Chance auf Meta permanent. State ist davon nicht betroffen, weil
  `RemotePublisher` State periodisch neu published; Meta wird nur einmal in
  `begin()` published und hat sonst keine zweite Chance außer eben diesem
  Retained-Request.
- **Bug B (Voraussetzung für den Fix):** `EspNowTransport::tick()` war ein
  reines No-Op und wurde für Boards, die ESP-NOW nur konsumieren (lokales
  Publish deaktiviert), nie aufgerufen — `EspNowPublishService::tick()`
  tickte den Transport nur `if (settings.espnowEnabled())`, obwohl der
  Transport laut `main.cpp`-Kommentar "always available, no toggle" für
  Consumer ist. Ein Fix, der sich auf `tick()` verlässt, hätte für genau
  das im Bug beschriebene Szenario (reiner Consumer) stumm nicht gegriffen.

**Umsetzung:**
- `EspNowTransport`: Throttle bleibt (max. 1 Broadcast/s), aber ein
  unterdrückter Request wird jetzt gemerkt (`retainedRequestPending_`) und
  in `tick()` nachgeholt, sobald das Zeitfenster um ist — kein Subscribe
  geht mehr endgültig leer aus. Neuer privater Helper `requestRetained_()`
  kapselt die Throttle-Entscheidung. `kRetainedRequestThrottleMs`-Konstante
  statt Magic Number, wraparound-sicherer `millis()`-Vergleich (gleiches
  Idiom wie `WebhookTransport::inBackoff_()`). Native Stub-Branch um leere
  `requestRetained_()`-Definition ergänzt.
- `main.cpp`: `espNowTransport->tick()` jetzt direkt in `loop()`
  aufgerufen, unabhängig von `espNowPublishService` (die Instanz gehört
  ohnehin `main.cpp`).
- `EspNowPublishService::tick()`: `transport_->tick()` entfernt (nur noch
  `publisher_->tick()`), um Doppel-Tick zu vermeiden, wenn Publish aktiv
  ist. Doc-Kommentar entsprechend angepasst.
- Kein Umbau von `EspNowPublishService::connected()`/`lastErrorMessage()`
  (bleiben publish-gated) — separate, vorbestehende Einschränkung, nicht
  Teil dieses Bugs (s. Bekannte Probleme).

**Verifikation:**
1. `pio test -e native` (SensActCtrl): 192/192 grün.
2. Compile-Smoke alle drei BrewControl-Envs (`esp32dev`, `lolin_s2_mini`,
   `lilygo_t_display_s3_amoled`): SUCCESS.
3. **Hardware-Test.** LilyGo (COM9) direkt geflasht. LOLIN S2 Mini (COM5)
   ließ sich zunächst trotz 5 Versuchen nicht in den Bootloader-Modus
   versetzen (`Could not open COM5, the port doesn't exist` — der
   1200bps-Touch-Reset über die native USB-CDC-Schnittstelle griff nicht);
   nach manuellem Eingriff (Board von Hand in den Flash-Modus versetzt)
   erschien es als COM7 (`303A:0002`, ROM-Download-Modus) und ließ sich
   darüber flashen. `esptool` konnte den Download-Modus danach nicht
   automatisch verlassen (`chip was placed into download mode using
   GPIO0` — erwartet bei manuellem GPIO0-Trigger), ein manueller
   Reset/Repower brachte es zurück in die neue Firmware.
   Testaufbau: LOLIN als Publisher (`espnow.enabled:true`, Sensor
   `test_temp` Typ `DS18B20`, Meta `°C`/-55/125/0.0625). LilyGo als reiner
   Consumer (`espnow.enabled:false` — genau der Bug-B-Fall), `Remote`-Sensor
   `remote_test_temp` (`transport:"espnow"`, `device:"brewcontrol-lolin"`,
   `remote_id:"test_temp"`) **nach** LilyGos Boot hinzugefügt. Ergebnis: Meta
   kam sofort korrekt an (`unit:"°C", min:-55, max:125, res:0.0625` statt
   RemoteSensor-Default). Danach LilyGo zweimal sauber rebootet (Item ist
   jetzt persistiert) — beide Male kam Meta unmittelbar nach Boot korrekt
   an, kein einziger Fall von Default-Meta. Bug damit sowohl im Late-Add-
   als auch im Boot-Repro-Fall behoben.
4. Cleanup: Test-Sensoren auf beiden Boards gelöscht, ESP-NOW-Publish auf
   LOLIN wieder deaktiviert, Baseline auf beiden Boards per `/api/settings`
   bzw. `/api/snapshot` bestätigt.

**Bewusst nicht gemacht:** eine unbestätigte Zusatzbeobachtung des Explore-
Agents — `handleRetainedRequest_()` dumped beim Empfang eines Requests die
komplette `retained_`-Map ungebremst (kein Pacing zwischen den
`esp_now_send()`-Aufrufen); da Meta-Topics lexikographisch immer direkt
hinter ihrem State-Topic sortieren, könnten gerade die späteren (Meta-)
Pakete in diesem Burst eher verloren gehen. Nicht verifizierbar ohne
Sendestatistiken, daher nicht gefixt. Im Hardware-Test (ein Sensor mit
Meta) nicht aufgetreten — bei Boards mit deutlich mehr retained Topics
bleibt das ein möglicher Verdächtiger, falls Meta dort weiterhin
unzuverlässig ankommt.

**Geänderte Dateien:** `SensActCtrl/src/transport/EspNowTransport.h`/`.cpp`,
`BrewControl/firmware/src/main.cpp`,
`BrewControl/firmware/src/EspNowPublishService.h`/`.cpp`.

## 2026-08-31 — Feature: mDNS-Hostname bereits im Setup-Portal vergeben

**Ausgangslage:** Beim Einrichten der drei Testboards fiel auf, dass der
mDNS-Hostname bisher erst *nach* dem ersten Boot über `POST /api/network`
in der normalen Web-UI änderbar war. Bis dahin läuft jedes frisch
geflashte Board unter dem Default `"brewcontrol"` (`main.cpp:47`) — bei
mehreren parallel eingerichteten Boards im selben Netz ein
Namenskonflikt. Wunsch: Hostname schon im AP-Mode-Setup-Portal mit
abfragen, damit jedes Board von Anfang an eindeutig heißt, plus ein
Hinweis/Redirect auf der Erfolgsseite nach dem Reboot.

**Entscheidungen (mit User abgestimmt):**
- Kein Live-mDNS-Konflikt-Check vor dem Speichern (kein testweises
  Verbinden ins Zielnetz während des Setups) — nur Format-Validierung wie
  bei `/api/network`. Löst das eigentliche Problem (alle Boards defaulten
  auf `"brewcontrol"`) strukturell, ohne die Komplexität/Fehleranfälligkeit
  eines Verbindungsaufbaus im Setup-Flow.
- Post-Reboot-UX kombiniert: statischer, klickbarer Link auf
  `http://<hostname>.local/` als garantiert funktionierender Fallback,
  zusätzlich Best-Effort-Auto-Redirect per JS-Polling (nur wirksam, wenn
  das Client-Gerät selbst wieder ins Zielnetz wechselt — auf Mobil-OS teils
  automatisch der Fall).

**Umsetzung:**
- `WiFiSetupPortal.cpp`: drittes Formularfeld `#host` (Placeholder
  `"brewcontrol"`, optional — leer = Default bleibt). `/api/connect`-Handler
  liest `hostname` zusätzlich aus dem JSON-Body, lowercased + validiert,
  bei Erfolg `prefs.putString("hostname", …)` (derselbe Preferences-Key,
  den auch `main.cpp` beim Boot liest und `/api/network` schreibt — kein
  neuer Persistenz-Pfad).
- `validHostname()` aus `WebUI.cpp` in eine neue gemeinsame Header-Datei
  `Hostname.h` gezogen (statt dupliziert) — von `WebUI.cpp` und
  `WiFiSetupPortal.cpp` eingebunden.
- Erfolgsseite (`afterSaved()` in `kSetupHtml`): Text + `<a>`-Link auf
  `http://<hostname>.local/`, darunter ein Live-Countdown „Next attempt in
  Ns (attempt N)" bis zum nächsten Erreichbarkeits-Check (`fetch(url,
  {mode:'no-cors'})` alle 5s — Intervall nach User-Feedback von
  ursprünglich 3s auf 5s angepasst). Bei Erfolg `location.href` auf den
  Link, sonst läuft der Countdown weiter.

**Verifikation:**
1. Compile-Smoke alle drei Envs (`esp32dev`, `lolin_s2_mini`,
   `lilygo_t_display_s3_amoled`): SUCCESS (dreimal — initiale Umsetzung,
   Countdown-Anzeige, 3s→5s-Anpassung).
2. Hardware-Test auf LOLIN S2 Mini (COM5, unproblematischer Flash diesmal —
   kein Bootloader-Problem wie beim vorherigen Fix): Board per
   BOOT-Button-Hold in den AP-Mode versetzt, mit `BrewControl-Setup`
   verbunden, im Portal Ziel-SSID + Hostname `brewcontrol-test` gesetzt.
   Nach Submit: Link + Countdown korrekt angezeigt, Board danach unter
   `brewcontrol-test.local` erreichbar (per `curl` bestätigt). Nach der
   Countdown-UX-Ergänzung erneut per Portal getestet — Countdown zählt
   sichtbar runter, Attempt-Zähler hochgezählt; vom User bestätigt
   („klappt"). Baseline (`brewcontrol-lolin`) wurde vom User im selben
   Testdurchlauf wiederhergestellt.

**Geänderte Dateien:** `BrewControl/firmware/src/WiFiSetupPortal.h`/`.cpp`,
`BrewControl/firmware/src/WebUI.cpp`,
`BrewControl/firmware/src/Hostname.h` (neu).

## 2026-08-31 — Fix: Direkte URLs zu Unterseiten liefern weiße Seite + Feature: ESP-NOW-Icon

**Ausgangslage:** `http://brewcontrol-esp32dev.local/settings/network` per direkter
URL-Eingabe oder Reload → weiße Seite. `http://.../settings` (eine Ebene) funktionierte.

**Root Cause:** `web/vite.config.ts` hatte `base: './'` (Kommentar: „SD-Karten-Root ist
nicht '/'" — falsche Annahme). Das erzeugt relative Asset-URLs im gebauten
`index.html` (`./assets/index-*.js`). Der Browser löst relative URLs gegen den
*URL-Pfad* auf, nicht gegen den physischen SD/LittleFS-Pfad: unter `/settings`
(ein Segment) landet die Auflösung zufällig richtig bei `/assets/...`, unter
`/settings/network` (zwei Segmente) dagegen bei `/settings/assets/...` — 404, JS lädt
nicht, weiße Seite. Serverseitig war das SPA-Fallback (`WebUI.cpp` `onNotFound` →
`index.html`) die ganze Zeit korrekt und lieferte auf beiden Pfaden identisches HTML
(per `curl` verifiziert) — der Bug lag rein im Client-Bundling, nicht im Firmware-Code.

**Fix:** `base: '/'` — absolute Asset-Pfade. Der Server mapped die Web-Root-URL `/`
immer auf den SD/LittleFS-Ordner `/www`, unabhängig vom physischen Pfad, `/` ist also
die korrekte Basis.

**Zusätzlich (User-Wunsch):** ESP-NOW-Icon auf `/settings` und `/settings/espnow` von
lucide-preact `Antenna` auf `<SiEspressif />` (react-icons) umgestellt.
`react-icons` + `@types/react` (nur als Typ-Dependency — react-icons' `.d.ts` braucht
`React.SVGAttributes` für `className`) als neue Dependencies. Laufzeit-Aliasing von
`react`/`react-dom` auf `preact/compat` übernimmt bereits `@preact/preset-vite`
(kein zusätzliches Alias-Setup nötig). Da react-icons' `className`-Prop nicht zum
bestehenden `class`-Prop-Vertrag der `LucideIcon`/`SettingsCard`-Typen passt, neuer
kleiner Adapter `web/src/components/EspressifIcon.tsx` (typisiert als `LucideIcon`,
übersetzt `class` → `className`) statt die bestehenden Icon-Typen aufzuweichen.

**Verifikation:**
1. `pnpm typecheck` + `pnpm build` (web/): grün, `dist/index.html` zeigt jetzt
   `/assets/...` statt `./assets/...`.
2. `pnpm dev`-Preview: direkter Aufruf `/settings/espnow` und `/settings/network` ohne
   Reload-Probleme, Icon korrekt gerendert, keine Konsolenfehler.
3. Hardware: `pnpm build:sd` + Assets nach `firmware/data/www` kopiert (dokumentierter
   Ablauf aus `README.md`) + `pio run -e lolin_s2_mini -t uploadfs` (USB, COM5) auf das
   LOLIN-Testboard. Danach per Browser direkt `http://192.168.178.82/settings/network`
   aufgerufen (nicht über Client-Navigation) — lädt korrekt, kein weißer Screen, keine
   Konsolenfehler. Icon auf `/settings` und `/settings/espnow` verifiziert.
   `pio run -e esp32dev -t buildfs` als Größen-Check (Bundle jetzt ~84 KB gzip durch
   react-icons/preact-compat, passt weiterhin komfortabel in die 256-KB-Partition).

**Geänderte Dateien:** `BrewControl/web/vite.config.ts`,
`BrewControl/web/src/pages/SettingsIndex.tsx`,
`BrewControl/web/src/pages/EspNowPage.tsx`,
`BrewControl/web/src/components/EspressifIcon.tsx` (neu),
`BrewControl/web/package.json`/`pnpm-lock.yaml`.
