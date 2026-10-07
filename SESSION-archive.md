# Brauerei Session-Archiv

Ausgelagerte, abgeschlossene Session-Einträge — der aktuelle Stand steht in
[`PLAN.md`](PLAN.md), kurze chronologische Verweise in [`SESSION.md`](SESSION.md).
Hier die volle Detail-Historie, unverändert übernommen (Stand: Einträge bis
2026-09-30). Konsolidiert am 2026-08-31 aus den vormals getrennten Logs von SensActCtrl (`PLAN.md`/`session.md`),
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

## 2026-09-01 — Aufräumen: gemergte Branches/Worktree entfernt + Doku-Punkt geschlossen

Nach `git fetch --prune`: `docs/consolidate-plan-session` (PR #18),
`feat/sd-file-manager`, `claude/distracted-rubin-a1e377` waren gemergt und
remote gelöscht — lokale Branches + der Worktree
`.claude/worktrees/distracted-rubin-a1e377` entfernt. Offen bleibt nur
`feat/winui-design` (1 obsoleter Commit voraus / 37 hinter).
Bekannte-Probleme-Eintrag „Test-Sensor `sdfswdf` spurlos verschwunden"
gestrichen — nie reproduziert, Sensor manuell gelöscht.

## 2026-09-01 — HW-E2E: SD-Boot-Flash-Recovery (`FirmwareUpdater::flashFromSdImage()`)

Der seit 2026-06-05 nur build-verifizierte Recovery-Pfad (SD-Root
`/firmware.bin` wird beim Boot vor WiFi geflasht, dann gelöscht) am Gerät
verifiziert — komplett host-getrieben gegen die LilyGo T-Display-S3-AMOLED
(`192.168.178.87`), kein SD-Kartenausbau:

1. `firmware.bin` mit `BREWCTL_VERSION_OVERRIDE=sdflash-e2e` gebaut
   (1.319.744 B), per `POST /api/files/upload?path=/` auf den SD-Root.
2. Reboot via `POST /api/network {"hostname":"brewcontrol"}` (kein
   WLAN-Eingriff).
3. Nach ~15 s zurück: `GET /api/update/status` → `currentVersion` von
   `d6ccb81-dirty` auf `sdflash-e2e` gewechselt (= SD-Image ist die
   laufende Firmware), `firmware.bin` vom SD-Root verschwunden
   (Selbstlöschung nach erfolgreichem `Update.end`), Snapshot/WiFi/Config
   unverändert.
4. Restore: sauberes `firmware.bin` (ohne Override, `70faca4-dirty`)
   über denselben SD-Weg zurückgeflasht — zweiter erfolgreicher Durchlauf.

**Nebenbefund (→ PLAN.md Bekannte Einschränkungen):** Der erste
Restore-Upload landete truncated auf der SD (618.496 statt 1.319.744 B),
Handler meldete trotzdem `200 ok` — `POST /api/files/upload` ignoriert die
`File::write()`-Rückgabe. `flashFromSdImage()` verhielt sich dabei korrekt:
`Update.end(true)` wies das unvollständige Image ab, das Board bootete die
vorhandene Firmware weiter, die kaputte Datei blieb liegen (kein
Reflash-Loop). Nach Löschen + Re-Upload (mit Größencheck + Retry-Schleife)
lief der Restore sauber durch.

## 2026-09-01 — PLAN.md umstrukturiert: nur noch Offenes

Der User fand PLAN.md unübersichtlich (erledigter Status, durchgestrichene
Roadmap-Punkte und offene Einschränkungen gemischt). PLAN.md enthält jetzt
ausschließlich Offenes:

- **Entfernt:** „Aktueller Status"-Block (alle erledigten SensActCtrl-/
  BrewControl-Arbeiten — Historie steht chronologisch hier + in
  SESSION-archive.md), Architektur-Diagramm, Technologie-Stack, Boards-
  Tabelle (Referenz lebt in den READMEs), alle `~~…~~ ✓ erledigt`-Einträge
  aus der Roadmap und alle `✓`-Zeilen aus „Bekannte Einschränkungen".
- **Behalten/neu gegliedert:** kurzes Intro → „Bugs & bekannte
  Einschränkungen" → „Hardware-Verifikation offen" → „Backlog" (flache,
  grob priorisierte Liste, Abhängigkeiten inline; die bisherigen
  *Später:*-Vormerkungen als eigenständige Einträge) → „Größere Brocken
  (eigene Spec vor Umsetzung)" (Peripherie-Abstraktion, Pin-Manager,
  LVGL-Display, HTTPS-Support) → „Buckets".
- **Verworfen:** die alte Zweiteilung Architektur-Track / Feature-Track
  (+ Wellen 1/2/3) — die Achse trug nicht (LVGL-Display ist ein Feature,
  kein Rückgrat; von jeder Welle war das meiste erledigt). Ersetzt durch
  eine flache Backlog-Liste + separate „Größere Brocken".
- **Regel geändert:** Ein umgesetzter PLAN.md-Punkt wird künftig ersatzlos
  entfernt (kein `~~erledigt~~`, keine Pointer-Zeile) — Historie nur in
  SESSION.md. Nachgezogen in Root-`CLAUDE.md` → Dokumentation und
  `BrewControl/CLAUDE.md` → Arbeitsregeln.

## 2026-09-01 — API-Vertrag nach `BrewControl/docs/openapi.yaml` überführt

**Anlass:** Der „API-Vertrag"-Abschnitt in `BrewControl/README.md` dokumentierte
14 Endpoints, die Firmware registriert 41. Komplett undokumentiert waren
Data-Logs, Sollwert-Programme, Settings, Dashboards, SD-Dateimanager,
Backup/Restore, Firmware-Update-Status/Check/Install und Netzwerk. Dazu waren
Details falsch: die Delete-Routen der Dynamic Items antworten `405` (nicht `404`
wie behauptet), Erfolg ist durchgängig `204` statt `200`, Fehler-Bodies sind
`text/plain` statt JSON. `BrewControl/CLAUDE.md` führte eine zweite, noch
kürzere und ebenfalls veraltete Tabelle.

**Umsetzung:**

- **Neu: `BrewControl/docs/openapi.yaml`** (OpenAPI 3.1) — alle 41 Routen mit
  Query-/Path-Parametern, Request-Bodies, Status-Codes, den wörtlichen
  `text/plain`-Fehlermeldungen aus dem Code und vollständigen Schemas.
  Inhalt ausschließlich aus dem Code abgeleitet (`WebUI.cpp`,
  `RegistrySnapshot.cpp`, `DynamicItems.cpp`, `LogStore.cpp`,
  `ProgramRunner.cpp`, `SettingsStore.cpp`, `DashboardStore.cpp`,
  `FirmwareUpdater.cpp`), nicht aus der alten Doku. Beschreibungen auf
  Englisch (codenahes, maschinenlesbares Artefakt); README/PLAN/SESSION bleiben
  Deutsch. Explizit festgehalten: die vier Endpoints mit Reboot ~500 ms nach der
  Antwort, das SSE-Event `snapshot`, die snake_case-Anlege-Configs vs. die
  camelCase-Runtime-Params der Regler, und dass es keine Authentifizierung gibt.
  Bewusst *nicht* in der Spec: WiFi-Setup-Portal (eigener Server) sowie
  Static-Serving/SPA-Fallback.
- **Neu: `BrewControl/docs/redocly.yaml`** — Lint-Config; schaltet
  `security-defined` (es gibt keine Auth) und `operation-4xx-response` (mehrere
  Endpoints haben keinen Client-Fehlerpfad) ab.
- **`README.md`:** „API-Vertrag" auf eine Übersichtstabelle reduziert (eine
  Zeile pro Route: Endpoint / Methode / Zweck) plus Verweis auf die YAML —
  keine Bodies und Status-Codes mehr, die driften sonst wieder. Erhaltene
  Prosa: DS18B20-Multi-Sensor-Hinweis, Snapshot-Shape-Verweis, Persistenz.
  Dabei zwei Ungenauigkeiten korrigiert: `/config/registry.json` liegt auf SD
  *oder* LittleFS (nicht „auf der SD-Karte"), und der Multipart-Feldname `f` in
  den `curl`-Beispielen ist beliebig — die Firmware wertet ihn nicht aus.
- **`BrewControl/CLAUDE.md`:** stale Mini-Tabelle raus, Verweis auf die YAML
  rein (inkl. Korrektur `RegistrySnapshot.h` → `.cpp`); neue Arbeitsregel:
  Routen-Änderungen in `WebUI.cpp` im selben Commit in `openapi.yaml`
  nachziehen. Root-`CLAUDE.md` → Dokumentation um die Datei ergänzt.

**Verifikation:** `npx @redocly/cli lint --config BrewControl/docs/redocly.yaml
BrewControl/docs/openapi.yaml` → valide (1 Warning: kein `license`-Feld).
Routen-Abdeckung per Skript geprüft: alle 41 `server_.on`/`addHandler`-
Registrierungen aus `WebUI.cpp` haben ein Gegenstück in `paths:`, keine
verwaisten Pfade. Stichproben gegen den LilyGo S3 (192.168.178.87):
`/api/settings` liefert alle sechs Sektionen inkl. der live gespliceten
`connected`/`error`-Felder, `/api/update/status` matcht das Schema inkl.
`available: null`, `/api/network/scan` antwortet `202`. Die
`/api/files`-Stichproben liefen ins Leere, weil auf dem Board gerade keine
SD-Karte gemountet ist (`GET /` → 501, jeder Pfad „not a directory") — kein
Spec-Befund.

**Nebenbefunde** (dokumentiert, nicht gefixt — jetzt in PLAN.md → „Bugs &
bekannte Einschränkungen"): `types.ts` weicht an drei Stellen von der Wire-Form
ab (`ProgramConfig.stepStartedEpoch`/`elapsedAtPauseSec` fehlen,
`DashboardConfig.charts`/`.programs` und die fünf optionalen `AppSettings`-
Sektionen sind zu lose deklariert); die Create-Endpoints akzeptieren
bibliotheksbedingt auch GET/PUT/PATCH; `GET /api/settings` gibt
`mqtt.password` im Klartext zurück; `GET /api/snapshot` antwortet bei
Puffer-Überlauf mit einem leeren `200` statt einem Fehler.

## 2026-09-01 — Fix: `POST /api/files/upload` erkennt Short-Writes

**Root Cause:** Der Upload-Callback schrieb Chunks mit
`fileUpload_.write(data, len)` und ignorierte den Rückgabewert. Bei einem
Short-Write auf die SD-Karte (volles Medium, I/O-Fehler) wurde die Datei still
abgeschnitten, der Handler antwortete trotzdem `200 ok`. Beim
SD-Boot-Flash-HW-E2E am 2026-09-01 einmal getroffen: 1.319.744-B-`firmware.bin`
landete als 618.496 B auf dem SD-Root, Antwort `ok`.

**Umsetzung** (`BrewControl/firmware/src/WebUI.cpp`, analog zum bestehenden
`fileUploadRejected_`-Pfad im selben Handler und zum Fehlerpfad von
`/api/update/firmware` / `/api/update/assets`): Rückgabewert von `write()`
gegen `len` prüfen; bei Abweichung Datei schließen, die Teildatei per
`fs_.remove()` entfernen, `fileUploadRejected_` setzen und
`500 "write failed — partial file removed"` senden. Der Zielpfad wird dafür in
`WebUI::fileUploadPath_` gehalten (neu). `openapi.yaml`: Known-Issue-Notiz
entfernt, `500`-Response um den neuen Body ergänzt.

**Verifikation:** `pio run -e lilygo_t_display_s3_amoled` grün.
`npx @redocly/cli lint` weiterhin valide (nur die bekannte `license`-Warnung).
HW-E2E am LilyGo S3 (`192.168.178.87`, Firmware `2d429cd` per USB/COM9 geflasht)
am 2026-09-01 nachgeholt: (1) Happy Path auf der regulären Karte — 405 KB
hochgeladen, `200 ok`, SHA256 nach Download-Roundtrip identisch. (2) Overflow —
kleine FAT32-Karte manuell auf 256 KB frei befüllt, 2-MB-Upload → `500 "write
failed — partial file removed"`, `/api/files`-Listing zeigt keine Teildatei.
(3) Recovery — 100-KB-Datei danach wieder sauber `200 ok`, SHA256 identisch.

## 2026-09-01 — `web/src/types.ts` mit der Wire-Form synchronisiert

Erster der beim OpenAPI-Abgleich gefundenen Nebenbefunde geschlossen. Die drei
Firmware-Serializer als Referenz:

- `ProgramRunner::serialize()` emittiert `stepStartedEpoch` und
  `elapsedAtPauseSec` immer (persistierter Laufzeitstand) → in `ProgramConfig`
  als Pflichtfelder ergänzt.
- `DashboardStore::serialize()` schreibt `charts` und `programs` immer als Array
  (ggf. leer) → `DashboardConfig.charts`/`.programs` von `?:` auf Pflicht.
- `SettingsStore::serialize()` liefert immer alle sechs Sektionen → in
  `AppSettings` `firmware`/`time`/`mqtt`/`webhook`/`espnow` von `?:` auf Pflicht,
  ebenso `MqttSettings.embeddedBrokerSupported` (wird immer gesetzt).
  Der Patch-Pfad ist unberührt (`updateSettings(patch: Partial<AppSettings>)`).

Rein Typen-eng/-losigkeit, kein Laufzeitverhalten. Verifikation:
`pnpm typecheck` grün, keine Konsumenten betroffen.

## 2026-09-01 — Fix: `GET /api/snapshot` bei Puffer-Überlauf → `503`

**Root Cause:** `serializeRegistry()` gibt `0` zurück, wenn die Registry
`kSnapshotCap` (4160 B) sprengt, und lässt den Puffer unangetastet. `makeSnapshot()`
reichte in dem Fall einen nicht-null Puffer mit `n=0` zurück; der `/api/snapshot`-
Handler prüfte nur `!buf` und schickte `200` mit leerem Body. Die beiden SSE-Pfade
(`pushSnapshot_`/`sendSnapshotTo_`) hätten sogar den uninitialisierten Puffer als
C-String verschickt.

**Umsetzung** (`BrewControl/firmware/src/WebUI.cpp`): `makeSnapshot()` gibt bei
`n == 0` jetzt `nullptr` zurück — dieselbe Fehlersignalisierung wie bei OOM, die
alle drei Aufrufer bereits korrekt behandeln (Handler → `503`, SSE-Pfade →
Tick überspringen). Handler-Body von `OOM` auf `snapshot unavailable`
umbenannt (deckt beide Ursachen ab). `openapi.yaml`: `503`-Response und
Beschreibung entsprechend aktualisiert, Known-Issue-Hinweis raus.

**Verifikation:** `pio run -e lilygo_t_display_s3_amoled` grün, `redocly lint`
valide. HW-E2E am LilyGo S3 (`192.168.178.87`, Firmware aus diesem Stand per
USB/COM9): 23 DigitalInput-Sensoren zur Laufzeit angelegt, ab Sensor #23 (Snapshot
> 4160 B) antwortet `GET /api/snapshot` mit `503 "snapshot unavailable"` statt
leerem `200`; SSE-Stream im Normalfall unverändert. Testsensoren wieder gelöscht,
Snapshot zurück auf `200` / 1219 B.

## 2026-09-01 — Fix: `mqtt.password` als Write-only-Feld

**Root Cause:** Die gesamte API ist unauthentifiziert; `GET /api/settings` gab
das gespeicherte MQTT-Passwort im Klartext zurück (sichtbar in Browser-DevTools,
Screenshots, evtl. Logs).

**Umsetzung:**
- `WebUI.cpp` (`GET /api/settings`): `mqtt.password` wird vor dem Senden immer
  auf `""` überschrieben, zusätzlich `mqtt.passwordSet` (bool) eingespliced.
- `SettingsStore::update()`: leerer/fehlender `mqtt.password` lässt das
  gespeicherte Passwort unverändert; expliziter JSON-`null` löscht es. Nicht-
  leerer String setzt es. `serialize()`/`saveToSD()` unverändert — auf Flash und
  im Backup-Bundle liegt das Passwort weiterhin im Klartext (Restore braucht es).
- `MqttPage.tsx`: Passwort-Input zeigt bei `passwordSet` einen Platzhalter
  („gespeichert — leer lassen zum Behalten"); `DEFAULT` um `passwordSet` ergänzt.
- `types.ts`: `MqttSettings.password` als write-only kommentiert, `passwordSet`
  ergänzt.
- `openapi.yaml`: `MqttSettings`-Schema (`password` readOnly `const ""`,
  `passwordSet` neu), Endpoint-Beschreibungen `GET`/`POST /api/settings`,
  Backup-Bundle-Hinweis, Top-Level-„No authentication"-Absatz.

**Löschen im UI:** Nachgereicht — bei gespeichertem Passwort zeigt das leere
Feld ein „x"; Klick markiert „wird beim Speichern gelöscht" (rückgängig
machbar), `doSave` schickt dann `mqtt.password: null`.

**Verifikation:** `pio run -e lilygo_t_display_s3_amoled` grün, `pnpm typecheck`
grün, `redocly lint` valide. HW-E2E am LilyGo S3 (`192.168.178.87`, per USB/COM9):
`GET` zeigt nie das Passwort, `passwordSet` korrekt; Setzen (`"brewpass"`) →
`passwordSet:true`, Broker reconnected (`connected:true`); leerer Round-Trip
behält das Passwort; `null` löscht es (`passwordSet:false`); Backup-Bundle trägt
das Passwort weiter. Board am Ende mit leerem Passwort hinterlassen.

## 2026-09-02/03 — Settings-UI-Überarbeitung (5 Teilschritte)

Der Backlog-Cluster aus PLAN.md komplett abgearbeitet, ein Commit pro Punkt.
Reine Frontend-Arbeit — keine API-Änderung, `openapi.yaml`/`types.ts` unberührt.

**1. `PageShell` + Breitenbegrenzung.** Der Container-String
`min-h-full bg-bg p-4 text-fg md:p-6` war in 14 Seiten kopiert; die Karten liefen
auf breiten Screens über die volle Fensterbreite. Neue Komponente `PageShell`
kapselt den Container und legt eine zentrierte Spalte mit `max-w-4xl` (896 px)
darüber. `LogsPage`/`ArchivePage` nutzen `wide` (uPlot-Charts), `Dashboard` bleibt
unangetastet — sein `lg:flex`-Grid verträgt keinen zusätzlichen Wrapper.
Nebenbei den `FirmwarePage`-Ausreißer (`p-6`, „Lädt…") eingesammelt.

**2. Spinner + Skeleton.** Das Projekt hatte weder Spinner noch Skeleton — alle
Ladezustände waren nackter Text (8× „Laden…", 1× „Lädt…"), durchgehend als
Early-Return, wodurch Breadcrumb und Header verschwanden und beim Eintreffen der
Daten zurücksprangen. Neu: `Spinner` (WinUI-ProgressRing in `currentColor`,
Tailwind-`animate-spin` — keine eigenen Keyframes nötig) und `Skeleton`
(`SkeletonBar`/`SkeletonCard`/`SkeletonList`; `SkeletonCard` spiegelt die
Flächenklassen von `SettingsCard`, damit der Wechsel nichts verschiebt). Alle
Settings-Seiten halten ihren Header jetzt über der Ladeanzeige (`header`-Const
statt dupliziertem Breadcrumb). `LogsPage`/`ArchivePage` bekamen ein
`loaded`-Flag — sie konnten „lädt" bisher nicht von „leer" unterscheiden.
Spinner ersetzt die Busy-Texte in `ConfirmModal` (Label bleibt stehen, das
englische „Working…" entfällt), `FirmwarePage` und `NetworkPage`.

**3. Konnektivitäts-Unterseite.** Neue `ConnectivityPage` unter
`/settings/connectivity`; MQTT, Webhook und ESP-NOW auf
`/settings/connectivity/{mqtt,webhook,espnow}` umgezogen, damit URL und
Breadcrumb deckungsgleich bleiben. Index von 11 auf 9 Einträge.

**4. Geräteliste.** `DeviceRow` hatte die Flächenklassen von `SettingsCard`
dupliziert und eine vierte Badge-Variante (`bg-fg/10`) erfunden; die Icon-Buttons
hatten weder Padding noch Fokus-Ring; es gab keinen Empty-State; und
`startEdit()` verschluckte Fehler per `catch {}`, während der Klick auf den Stift
für die Dauer von `getConfig()` tot wirkte. Jetzt: `SettingsCard` mit dem Badge
als gedämpfte Zweitzeile, 32-px-Trefferflächen mit WinUI-Subtle-Hover, Spinner
auf der betroffenen Zeile, Fehlerausgabe, Empty-State.

**5. Filemanager.** `setDir()` aktualisierte die Pfadleiste sofort, während die
Tabelle bis zur Antwort von `listFiles()` noch die Dateien des *alten* Ordners
auflistete — die Seite behauptete kurzzeitig, diese Dateien lägen im neuen
Ordner. Beim ersten Mount blitzte zusätzlich „Leer" auf. Neues `dirLoading`-Flag
im `[dir]`-Effect: solange es steht, rendert der `tbody` Skeleton-Zeilen und die
Pfadleiste einen Spinner. Die In-Place-Refreshes nach Delete/Rename/Upload setzen
es bewusst nicht — dort ist der stehende Inhalt korrekt.

**Verifikation:** `pnpm typecheck` und `pnpm build` grün. Browser-Durchgang gegen
den LilyGo S3 (`brewcontrol.local`, 192.168.178.87) auf 1400×900 und 375×812, in
Light und Dark: 896-px-Spalte zentriert (mobil unverändert), Skeleton mit
stehendem Breadcrumb und ohne Layout-Sprung beim Umschalten, Spinner in
„Netzwerke suchen" und auf dem Stift der Geräteliste, alle drei neuen
Konnektivitäts-Routen als Deep-Link (SPA-Fallback am Gerät per curl bestätigt),
Filemanager beim Ordnerwechsel ohne widersprüchliche Liste und mit weiterhin
korrektem „Leer" bei tatsächlich leerem Verzeichnis. Console durchgehend
fehlerfrei. Nicht praktisch ausgelöst: der Empty-State der Geräteliste (Testboard
hat Items) und der `ConfirmModal`-Spinner (Auslösen hätte gelöscht bzw. rebootet)
— beide typgeprüft, der Spinner ist dieselbe Komponente wie in den verifizierten
Fällen.

**Nebenbefund (nicht gefixt, in PLAN.md eingetragen):** `GET /api/files` hängt
reproduzierbar auf `/logs/3ca049` (Verbindung steht, keine Antwort), ebenso
`GET /api/logs/3ca049/sessions`; andere Pfade inkl. `/www/assets` funktionieren.
Dazu: die englischen Default-Labels von `ConfirmModal` („Confirm"/„Cancel"), die
sechs Aufrufer ungesetzt lassen.

**Bewusst nicht angefasst:** die 3× duplizierte Save-Bar (Mqtt/Webhook/EspNow),
der 5× duplizierte Reboot-Vollbildschirm, die 2× nachgebaute ProgressBar und der
10× wiederholte `pl-9`-Ausricht-Hack in den Karten — jeweils außerhalb des
Auftrags.

## 2026-09-03 — Fix: `/api/files` und `/api/logs/:id/sessions` hängen auf einem Log-Session-Verzeichnis

**Root Cause (zwei Ebenen).** `LogStore::LogCfg::sessionStart` war reine
Laufzeit-State und wurde nie zurückgelesen — obwohl `serialize()` den `session`-Key
längst schreibt. Nach jedem Reboot war `sessionStart == 0`, und der nächste
Sample-Tick legte in `writeEmitted_` eine neue `/logs/<id>/<epoch>.csv` an. Bei den
im Betrieb üblichen Reboots (WiFi-Self-Heal `ESP.restart()` nach 5 min Link-Verlust,
jedes Reflash) füllt das ein Log-Verzeichnis über die Zeit mit dutzenden bis
hunderten Stub-CSVs; das Byte-Budget von `pruneToBudget_` (200 MB) löst bei 2-KB-
Dateien nie aus. Zweitens machten beide Endpunkte dieselbe Operation:
`serializeSessions` bzw. der `/api/files`-Listing-Zweig laufen synchron auf dem
AsyncTCP-Task durch einen `openNextFile()`-Sweep des ganzen Verzeichnisses unter
`SdLock` — pro Eintrag `open`+`name`+`size`+`close` über SPI-SD, JSON komplett im
RAM, `req->send()` erst nach dem kompletten Sweep. `Einträge × Pro-Eintrag-Kosten`
übersteigt den Client-Timeout; der Sweep hält dabei `SdLock` und pausiert
`LogStore::tick()` (die laufende Aufzeichnung). `/api/snapshot` bleibt ok, weil es
weder SD noch `SdLock` anfasst.

**Umsetzung** (Branch `fix/logs-session-dir-hang`, 2 Commits, firmware-only):

1. *Session über Reboots fortsetzen.* `loadFromSD` liest den `session`-Key;
   `tick()` persistiert nach einer Session-Neuanlage einmalig via `saveToSD`
   (Muster von `ProgramRunner::tick`); `writeEmitted_` schreibt die Kopfzeile auch,
   wenn eine fortgesetzte Session ihre Datei verloren hat (Karte gewechselt /
   extern gelöscht). Config-Änderung (`update()`) und „Löschen" (`clear()`) starten
   wie bisher eine frische Session.
2. *Session-Liste aus RAM-Spiegel.* `LogCfg` führt `std::vector<SessionMeta>`
   (`start`, `size`), gefüllt von `scanSessions_` einmalig beim Boot, in Step
   gehalten von `writeEmitted_` / `deleteSession` / `pruneToBudget_`.
   `serializeSessions` liest nur noch den Spiegel — kein SD-Zugriff, kein `SdLock`,
   sofortige Antwort. Response-Shape (`start`/`size`/`active`) unverändert, daher
   `openapi.yaml` / `types.ts` unangetastet.

`GET /api/files` behält seinen Sweep bewusst: generischer Dateimanager, und die
`/logs/<id>/`-Verzeichnisse bleiben mit der Session-Persistenz jetzt klein.
Zusätzlich `delay(0)` alle 64 Einträge im Boot-Scan (`scanSessions_` läuft in
`setup()` vor `webUI.begin()`), damit ein überraschend großes Verzeichnis den
Boot nicht wedged.

**Verifikation:** `pio run -e esp32dev` und `-e lilygo_t_display_s3_amoled` grün.
Baseline am LilyGo S3 reproduziert (`/api/logs/3ca049/sessions` und
`/api/files?path=/logs/3ca049` ohne Antwort, >60 s; `/api/files?path=/logs`
90 ms). Bereinigung: SD-Karte gezogen, `/logs/3ca049/` samt Demo-Log-Config
gelöscht. Firmware `9690d13` per OTA geflasht, dann Test-Log (2 s Intervall)
angelegt: `session` landet sofort in `/config/logs.json`; `.../sessions` liefert
den Eintrag in ~15 ms aus dem RAM-Spiegel; `/api/files` auf das Session-Verzeichnis
< 40 ms. Nach Reboot: `session`-Epoch unverändert, **eine** CSV mit **einer**
Kopfzeile, Zeilen laufen über die Reboot-Lücke im selben File weiter, Boot-Scan
füllt den Cache. Test-Log wieder entfernt.

**Nebenbefund:** die englischen `ConfirmModal`-Default-Labels
(„Confirm"/„Cancel") am 2026-09-03 gefixt (Eintrag unten).

## 2026-09-03 — Frontend: deutsche ConfirmModal-Defaults + Feedback nach leerem Bus-Scan

Zwei kleine UI-Punkte aus PLAN.md abgehakt.

1. *`ConfirmModal`-Default-Labels.* `confirmLabel`/`cancelLabel` defaulteten auf
   „Confirm"/„Cancel"; sieben Aufrufer (DevicesPage, EspNowPage, MqttPage,
   WebhookPage, NetworkPage 3×) setzen kein `cancelLabel` und zeigten dadurch
   einen „Cancel"-Button in der sonst deutschen UI. Defaults auf
   „Bestätigen"/„Abbrechen" umgestellt — eine Zeile in `ConfirmModal.tsx`, kein
   Aufrufer angefasst.
2. *Bus-Scan ohne Treffer.* Der Hint im DS18B20-Sensorformular
   (`AddItemModal.tsx`) war vor und nach einem ergebnislosen OneWire-Scan
   identisch. Neues `scanned`-Flag (true nach erfolgreichem Scan, zurückgesetzt
   bei Pin-Änderung / Modal-Open): vor dem Scan weiter „Scan ausführen um Geräte
   … zu finden", nach einem leeren Scan stattdessen ein `text-caution`-Hinweis
   „Kein Gerät auf diesem Bus gefunden — Verkabelung und Pull-up prüfen".

Keine API-Änderung. `pnpm typecheck` + `pnpm build` grün. Browser-Pane gegen das
Testboard (LilyGo S3-AMOLED): ConfirmModal auf der Geräteseite zeigt
„Abbrechen"/„Löschen". OneWire-Scan auf dem unbelegten GPIO 10 (Header-Pin, kein
Strapping/Flash, keine Config-Belegung) → `.../api/bus/scan` liefert `[]`, der
`text-caution`-Hinweis erscheint; Pin-Änderung setzt zurück auf „Scan ausführen
…". Board danach unverändert erreichbar (`/api/snapshot` 120 ms).

## 2026-09-03 — Fix: Collection-POST-Routen akzeptierten GET/PUT/PATCH statt `405`

**Root Cause.** Alle elf JSON-Body-Routen in `WebUI.cpp` (`/api/sensors`,
`/api/actuators`, `/api/controllers`, `/api/network`, `/api/dashboards`,
`/api/logs`, `/api/programs`, `/api/settings`, `/api/backup`,
`/api/files/mkdir`, `/api/files/rename`) hingen an
`AsyncCallbackJsonWebHandler`. Dessen Default-Methodenset ist
`HTTP_GET|POST|PUT|PATCH` und sein URI-Matcher ist ein Prefix-Matcher
(`^uri(/.*)?$`). Dadurch landete z.B. `GET /api/sensors` im Create-Handler und
antwortete `400 missing id` statt `405`; `PUT /api/dashboards` fiel (mangels
JSON-Content-Type) in den Catch-all → `404`.

**Umsetzung.** Neue `PostJsonHandler`-Klasse (anon. namespace in `WebUI.cpp`,
neben den bestehenden `BodyPrefixHandler`/`GetPrefixHandler`/`DeletePrefixHandler`):
exakter Pfad-Match statt Prefix, nur `POST`, parst den JSON-Body in einem Chunk
und übergibt eine `JsonVariant`. Jede andere Methode → `405 method not allowed`,
leerer Body → `400 missing body`, kaputtes JSON → `400 invalid JSON`, mehrere
Chunks → `413`. Alle elf `new AsyncCallbackJsonWebHandler(...)` 1:1 auf
`new PostJsonHandler(...)` umgestellt, die Handler-Lambdas unverändert.
`#include <AsyncJson.h>` in `WebUI.cpp` entfernt (nur noch von
`WiFiSetupPortal.cpp` mit eigenem Include genutzt). Da der Match jetzt exakt ist,
sind die „registered last / before create handler"-Ordnungs-Kommentare an den
Delete-/Body-Prefix-Handlern hinfällig und entfernt.

Der `GET /api/files`-Dateibrowser hing an einem Prefix-Match (`GetPrefixHandler`)
und fing dadurch auch `GET /api/files/mkdir` / `.../rename` ab (→ `400 missing
path` statt `405`). Auf zwei exakte Registrierungen umgestellt
(`server_.on(AsyncURIMatcher::exact("/api/files")…)` +
`…exact("/api/files/download")…`), sodass diese GETs zum jeweiligen
POST-only-`PostJsonHandler` durchfallen.

Kein OpenAPI-Vertrag betroffen — die dokumentierte Methode je Pfad bleibt gleich;
`405` für undokumentierte Methode+Pfad ist Standard und wird (wie `404` für
unbekannte Pfade) nicht als Vertrag geführt.

**Verifikation.** `pio run -e esp32dev` + `-e lilygo_t_display_s3_amoled` grün.
S3-AMOLED (`brewcontrol.local`) über USB geflasht, danach Methoden-Matrix:
`GET`/`PUT`/`PATCH`/`DELETE` auf `/api/sensors`, `/api/actuators`,
`/api/controllers` → `405`; `PUT /api/{dashboards,logs,settings,network}`,
`GET`/`PUT /api/files/mkdir`, `GET`/`PATCH /api/files/rename` → `405`;
`GET /api/{dashboards,logs,programs,settings,backup}`, `GET /api/files?path=/`
und `GET /api/files/download?path=…` weiter `200`. Echter Roundtrip
`POST /api/sensors {DS18B20,__mtest,pin 15}` → `204`, taucht im Snapshot auf,
`DELETE /api/sensors/__mtest` → `204`, wieder weg. `POST` mit kaputtem/leerem
Body → `400 invalid JSON` / `400 missing body`.

## 2026-09-03 — Settings-UI: zwei offene UI-Zustände am Gerät verifiziert; QEMU-Punkt entfernt

Die beiden seit dem WinUI-Redesign nur typgeprüften `DevicesPage`-Zustände am
esp32dev-Testboard (`brewcontrol-esp32dev.local`, leere Config) live
gegengecheckt — kein Reflash nötig, Create/Delete lief auf der vorhandenen
Firmware:

- **Empty-State der Geräteliste** — bei leerem Snapshot rendert
  `/settings/devices` „Noch keine Geräte konfiguriert — über ‚+ Hinzufügen'
  anlegen." statt einer leeren Seite. Screenshot im PR.
- **`Spinner` im `ConfirmModal`** — Test-Sensor (`DigitalInput __mtest`, Pin 34)
  angelegt, Löschen bestätigt; während des DELETE-Roundtrips zeigt der
  Löschen-Button den Spinner, beide Buttons sind `disabled`, Backdrop-Klick
  blockiert. Danach Modal zu, Item weg, Board sauber.

`PLAN.md` → „Bugs & bekannte Einschränkungen": beide Punkte raus. Ebenfalls
ersatzlos entfernt: die Alt-Notiz „QEMU/Simulation ist nicht viable" — das Thema
ist abschließend geklärt (keine WiFi-Emulation für ESP32, Verifikation läuft
immer am Gerät), die Historie steht in [SESSION-archive.md](SESSION-archive.md)
(Pre-MVP 2026-05-17–20). Kein Code, kein API-Vertrag betroffen.

## 2026-09-04 — Mobile FAB für Geräte/Logs-Hinzufügen und Datei-Upload

Die primären Aktions-Buttons (Geräte „+ Hinzufügen", Logs „+ Neues Log",
Dateiverwaltung „+ Ordner"/„Hochladen") saßen bislang nur im Seiten-Header —
auf Mobilgeräten mit dem Daumen schlecht erreichbar. Neue Komponente
`components/Fab.tsx` (`Fab` für Einzelaktion, `SpeedDialFab` für mehrere)
ersetzt sie unterhalb `md:` (768px) durch einen fixed Bottom-Right-Button;
ab `md:` bleiben die Header-Buttons unverändert, der FAB verschwindet.
Dateiverwaltung bekommt echten Speed-Dial (Tap fährt „Ordner“ + „Hochladen“
mit Labels aus). Eingebunden in `DevicesPage.tsx`, `LogsPage.tsx`,
`FilesPage.tsx`.

Dabei zwei Nebenbugs in `FilesPage.tsx` gefixt (User-Report per
Screenshot-Annotation): die Icons in den „+ Ordner"/„Hochladen"-Buttons waren
durch den Wechsel auf `hidden md:inline-flex` nicht mehr vertikal zentriert
(alter `-mt-0.5 inline`-Hack passte nicht mehr zum jetzt flexen Container —
gefixt mit `items-center` statt Margin-Hack); und lange Ordnernamen wurden bei
Zeilenumbruch zentriert statt linksbündig dargestellt (Ursache: `<button>` hat
laut Browser-UA-Stylesheet `text-align: center`, mit `text-left` übersteuert).

**Verifikation.** `pnpm typecheck` grün. Alle drei Seiten im Browser-Preview
(Mobile-Viewport 375×812) durchgeklickt: FAB öffnet Geräte-/Log-Modal direkt,
Speed-Dial fährt in Dateiverwaltung korrekt aus, `disabled`-Zustand
(`dirProtected`/laufender Upload) greift weiter. Ab `md:` (getestet bei
1280×900) FAB weg, Header-Buttons wie vorher. Kein Hardware-Test nötig (reine
Web-UI-Änderung).

## 2026-09-04 — Programmsteuerung: mobiles Bottom Sheet mit Drag-Geste + Redesign

Die `ProgramCard` (Programmsteuerung, z.B. Maischeprogramm mit
Fortsetzen/Zurück/Weiter/Stop) saß bei genau einem Dashboard-Programm auf
Mobile/Tablet `sticky` nahe dem oberen Rand — kollidierte beim Scrollen
visuell mit Chart-Inhalten darunter, schlecht mit dem Daumen erreichbar, und
die halbtransparente Fluent-Card (`bg-card`) ließ beliebigen Seiteninhalt
durchscheinen (User-Report per Screenshot-Annotation).

Umgebaut zu einem fixed Bottom Sheet (`components/ProgramCard.tsx`):
opaker/Acrylic-Hintergrund (`bg-surface-acrylic` + `backdrop-blur-md`, wie
die mobile `NavShell`-Kopfzeile — erst opak `bg-surface` versucht, dann auf
Wunsch des Users auf Acrylic umgestellt, da der Blur das Bleed-Through-Problem
löst ohne auf den Look verzichten zu müssen), abgerundete Oberkante,
Drag-Handle mit echter Swipe-Geste (Pointer-Events: `beginDrag`/`moveDrag`/
`endDrag`, `liveHeight`-State treibt `max-height` der Schrittliste live
während des Ziehens; Tap ohne nennenswerte Bewegung togglet stattdessen
direkt). `Dashboard.tsx` bekommt einen Bottom-Spacer, damit der fixed Sheet
den letzten Seiteninhalt nicht dauerhaft verdeckt. Desktop (`lg+`, normale
Sidebar-Card) und der Mehrfach-Programm-Fall (normale Inline-Card, kein
Sheet) bleiben unverändert.

Zusätzlich Redesign des Karteninhalts nach einem vom User gezeigten
Claude-Design-Mockup (Optik only, alle bestehenden Aktionen/Zustände
unverändert): Dokument-Icon + Status-Pill im Header (neuer `badgeAccent`-
Token in `ui.ts` ersetzt das hartkodierte Sky-Blau des „pausiert“-Zustands),
großer „Hero“-Block für den aktuellen Schritt (Schrittname, Countdown nur
bei `running`, Zieltemperatur, dünner Fortschrittsbalken, „X / Y min“),
nummerierte/Haken-Kreise in der Schrittliste, größere Icon-Buttons
(Play/Pause/SkipBack/SkipForward/Square) in einer per CSS-Grid
(`grid-flow-col auto-cols-fr`) gleichmäßig verteilten Zeile statt der alten
Text-Glyph-Buttons in `flex-wrap` (die bei schmaler Spalte auf zwei Zeilen
umbrachen und rechts Leerraum ließen). Die alte Mobile-Zusammenfassungs-Zeile
(„Einmaischen · 68° · noch 5:16“) entfällt, sobald der Hero-Block sichtbar
ist — reine Dopplung; bleibt für den Idle/Done-Fall (kein Hero) als einzige
Info-Quelle erhalten. `var(--accent)` durchgängig statt hartkodierter Farben,
bleibt mit der konfigurierbaren Akzentfarbe (`AppearancePage.tsx`) konsistent.

**Verifikation.** `pnpm typecheck` grün. Drag-Geste per dispatchten
`PointerEvent`s getestet (das Browser-Preview-Tool simuliert selbst keine
echten Pointer-Events für Drag) — Hoch-/Runterziehen und reiner Tap
funktionieren, kein Doppel-Toggle. Alle Programm-Status durchgespielt
(inkl. echtem Pause/Resume-Zyklus am Testboard) — Badges, Buttons, Hero-
Block reagieren korrekt. Desktop-Sidebar und Mehrfach-Programm-Fall ohne
Regression. Acrylic-Effekt per `getComputedStyle` verifiziert
(`backdrop-filter: blur(12px)`).

## 2026-09-04 — Profil-Bibliothek („Profilmanager")

Backlog-Punkt aus `PLAN.md` umgesetzt: wiederverwendbare Schritt-Vorlagen, die
sich in ein Sollwert-Programm kopieren lassen, statt jede Maische-/Gärfolge neu
einzutippen. Entscheidungen vorab mit dem User geklärt: Kategorien sind Pflicht
und werden als Tabs auf der Profile-Seite verwaltet (gleiche Mechanik wie die
Dashboard-Tabs), der Controller bleibt Sache des Programms, und ein Profil
anzuwenden **ersetzt** die vorhandenen Schritte nach Rückfrage.

**Firmware** — neuer `ProfileStore` (`firmware/src/ProfileStore.h/.cpp`) nach dem
Vorbild `DashboardStore`: `SdLock`, Silent-Return bei fehlender/kaputter Datei,
kein Mutex (nur REST-Handler im AsyncTCP-Task), Ids per `%06lx` wie Dashboards
und Logs. Persistenz in `/config/profiles.json` als
`{"categories":[…],"profiles":[…]}`; ein Profil ist `{id,name,category,steps[]}`
mit derselben Step-Form wie ein Programm (`name?`,`setpoint`,`holdSec`,`confirm`),
`name`/`confirm` werden beim Serialisieren weggelassen wenn leer/false. Kategorie
ist Pflichtfeld, deshalb kaskadiert `removeCategory()` in die enthaltenen Profile.
Routen in `WebUI.cpp` analog zum Dashboards-Block: `GET/POST /api/profiles`,
`POST/DELETE /api/profiles/:id`, plus `POST /api/profile-categories` und
`POST/DELETE /api/profile-categories/:id` — eigener Pfad-Stamm, damit weder der
`/api/profiles/`-Prefix-Handler noch eine Profil-Id die Kategorien verschattet;
kein eigenes GET, die Kategorien reisen in `GET /api/profiles` mit.

**Backup** — `GET /api/backup` bündelt jetzt zusätzlich `/config/profiles.json`.
Beim Restore ist die Sektion **optional** (Bundles älterer Firmware haben sie
nicht und bleiben importierbar); fehlt sie, bleibt die Datei unangetastet.
`version` bleibt 1, weil eine additive optionale Sektion keinen Konsumenten
bricht.

**Frontend** — neue Top-Level-Seite `/profiles` (`pages/ProfilesPage.tsx`,
Gerüst aus `LogsPage`) mit Kategorie-Tabs, „Kategorien"-Edit-Modus (Stift am
aktiven Tab, `+ Neu`), Profil-Rows mit „N Schritte · Dauer", Löschen über
`ConfirmModal` — beim Kategorie-Löschen mit Anzahl der betroffenen Profile im
Text. `components/ProfileEditorModal.tsx` ist der Schritt-Editor des Programms
ohne Regler-Select, dafür mit Kategorie-Select und (anders als das Original)
`pending`/`err`-State. Der `ProgramEditorModal` bekam zwei optionale Props:
`library` für „Aus Profil befüllen" (Select mit `optgroup` je Kategorie,
Rückfrage nur wenn schon Schritte erfasst sind) und `onSaveAsProfile` für die
Gegenrichtung — das Dashboard rendert dafür den `ProfileEditorModal` als
Geschwister nach dem Programm-Dialog, vorbefüllt mit Name und Schritten.
Nav-Eintrag in `NavShell.mainItems` deckt Desktop-Rail und Hamburger-Drawer ab
(dasselbe `<nav>`).

Drei kleine Extraktionen, jeweils durch den zweiten Consumer ausgelöst:
`TabBtn` aus `Dashboard.tsx` in `components/TabBtn.tsx`, `DashboardMetaModal` →
`components/NameModal.tsx` (generisch über `title`/`submitLabel`/`placeholder`,
`initial?: { name: string }`), und `fmtDuration` aus `ProgramCard.tsx`
exportiert.

**Verifikation:** `pio run -e esp32dev` und `-e lilygo_t_display_s3_amoled` grün;
`npx @redocly/cli lint` valide (nur die bekannte `license`-Warnung);
`pnpm typecheck` grün. UI-Flows im Dev-Server durchgespielt (Endpoints per
In-Page-Stub bedient, da das Testboard noch die alte Firmware fährt): Kategorie
anlegen/umbenennen, Profil anlegen (15 min → `holdSec` 900, Metazeile
„1 Schritt · 15:00"), Profil in ein leeres Programm übernehmen (ohne Rückfrage)
und in ein gefülltes (Rückfrage; Abbrechen lässt die Schritte stehen), Programm
als Profil speichern (Schritte inkl. Namen landen im neuen Profil),
Kategorie-Löschen mit Kaskade („… zusammen mit 2 Profilen darin") → Empty-State.
Hamburger-Drawer im Mobil-Viewport zeigt „Profile" zwischen Dashboard und
Einstellungen. Dabei gefunden und gefixt: das `initial`-Objekt für den
Profil-Editor wurde bei jedem Render neu erzeugt, wodurch der Hydration-Effekt
erneut feuerte und Eingaben zurücksetzen konnte — jetzt `useMemo`.

**HW-E2E** am LilyGo T-Display-S3-AMOLED (`brewcontrol.local` / 192.168.178.87),
Firmware `948c3c7` und UI-Paket per OTA eingespielt
(`/api/update/firmware` + `/api/update/assets`, beide `200 ok`, Assets-Upload
lief auf dem S3 wie erwartet durch): `GET /api/profiles` liefert direkt nach dem
Flash `{"categories":[],"profiles":[]}`. Kategorie anlegen → `201 {"id":"34489e"}`
(Format `^[0-9a-f]{6}$`, passt zur Spec), leerer Name → `400 invalid category`,
Profil mit unbekannter Kategorie → `400 invalid profile`. Profil mit drei
Schritten angelegt: der Schritt mit nicht-numerischem `setpoint` wurde still
verworfen, `confirm` nur beim gesetzten Schritt emittiert, `name` beim leeren
weggelassen. Umbenennen und Update je `204`, unbekannte Ids `404 not found` bzw.
`404 not found or invalid`. `/config/profiles.json` (165 B) auf der SD, Inhalt
identisch zur API-Antwort; nach einem Reboot (identische Firmware nochmal per OTA)
sind Kategorie und Profil unverändert da. Kategorie löschen → `204`, Bibliothek
danach leer (Kaskade greift). `GET /api/backup` enthält die `profiles`-Sektion in
der erwarteten Form. Die vom Board servierte UI (`/profiles` als Deep-Link → 200
über den SPA-Fallback) legt eine Kategorie an und zeigt Tab plus Empty-State,
keine Konsolenfehler.

**Dabei gefunden:** `POST /api/backup` scheiterte an jedem realistischen Bündel
mit `413 body too large` — siehe den eigenen Eintrag unten, der Fix kam direkt
hinterher. Danach ist auch der Optional-Pfad für `profiles` am Gerät bestätigt.

**Nebenbefund** (in `PLAN.md` → „Bugs & bekannte Einschränkungen" eingetragen,
nicht mitgefixt): Programm-Ids sind `p_XXXXX`, die OpenAPI-Spec pinnt sie auf
`^[0-9a-f]{6}$`; `Program.currentStep` ist als „-1 while idle" dokumentiert,
der Code setzt `0`.

## 2026-09-04 — Fix: `POST /api/backup` (Restore) scheiterte an jedem realen Bündel

**Root Cause:** `PostJsonHandler::handleBody()` und `BodyPrefixHandler::handleBody()`
(`firmware/src/WebUI.cpp`) akzeptierten nur Bodies, die in einem Stück ankommen
(`index == 0 && len == total`), und lehnten alles andere mit `413 body too large`
ab — es gab keine Body-Akkumulation. ESPAsyncWebServer liefert den Body aber
segmentweise, also scheitert jeder Request, der nicht in ein TCP-Segment passt
(~1,4 KB inkl. Header). Beim Backup-Restore steckt die ganze `/config` im Body:
das Bündel des LilyGo S3 ist 1656 B, der Restore war damit **unbenutzbar** —
auch über die UI, denn `restoreBackup()` (`web/src/api.ts`) postet dasselbe JSON.
Am Gerät eingegrenzt mit unschädlichen Proben (ungültiger `type`, wird vor jedem
Schreibzugriff abgewiesen): 1284 B → `400 not a brewcontrol backup`, ab 1384 B →
`413`. Vorbestehend; die Profil-Bibliothek hat das Bündel nur vergrößert.

**Umsetzung:** neuer Helper `collectBody()` im anonymen Namespace von `WebUI.cpp`,
beide Handler nutzen ihn. Einzel-Chunk-Bodies — der Normalfall für die kleinen
API-Payloads — gehen weiterhin ohne Kopie durch; größere sammeln sich in
`request->_tempObject`, das der Request-Destruktor freigibt (dasselbe Verfahren
wie im bibliothekseigenen `AsyncCallbackJsonWebHandler`). Obergrenze
`kMaxBodyBytes = 16384`; darüber weiterhin `413`, bei fehlgeschlagenem `malloc`
`500 out of memory`. `openapi.yaml`: `BodyTooLarge` neu beschrieben (nicht mehr
„kam nicht in einem Stück an", sondern „über 16 KB"), `/api/backup` um die bis
dahin gar nicht dokumentierte `413` und den `out of memory`-Fall ergänzt.

**Verifikation:** `pio run -e lilygo_t_display_s3_amoled` grün, `redocly lint`
valide. Am Board (Firmware per OTA): Proben 1368 B / 1684 B / 4984 B / 15984 B
kommen jetzt alle an (`400`, d.h. Body geparst), 16984 B → `413` wie vorgesehen.
Restore des Pre-OTA-Bündels **ohne** `profiles`-Sektion (1656 B) → `200 ok`,
Reboot, Dashboards und Settings restauriert, `/config/profiles.json` unangetastet
und die Bibliothek unverändert — der Optional-Pfad hält. Voller Roundtrip mit
einem Bündel **mit** Profilen (1872 B): exportieren, alle Kategorien löschen,
importieren → Kategorien und Profil kommen unverändert zurück. Randnotiz: die
allererste Anfrage direkt nach einem Boot lief einmal in ein `413`, danach nicht
mehr reproduzierbar — nicht weiter verfolgt.

## 2026-09-05 — HW-Nachtest: GPIO/LEDC-Leak-Fix (2026-08-14)

Der am 2026-08-14 umgesetzte Fix (`AnalogOutputActuator::end()` ruft
`ledcDetachPin()`; `DynamicItems::removeSensor`/`removeActuator` rufen beim
Löschen jetzt `end()`) hatte mangels Board keinen praktischen Nachtest —
jetzt am `esp32dev`-Testboard (192.168.178.74, zu Testbeginn leere Registry)
nachgeholt.

**Aufbau:** `AnalogOutputActuator` (PWM) auf GPIO4 angelegt, Jumperkabel
GPIO4 ↔ GPIO5, `DigitalInputSensor` mit `pullup:true` auf GPIO5 als Probe.
Baseline bestätigt: Aktor-Werte `v:1`/`v:0` spiegeln sich sofort und exakt in
der Probe — der aktive Push-Pull-Treiber überstimmt zuverlässig das schwache
interne Pull-up in beide Richtungen.

**Test:** Aktor bei `v:0` (GPIO4 aktiv LOW) ohne Reboot gelöscht. Direkt
danach blieb die Probe bei LOW — erwartet, da nichts den Pin zwischenzeitlich
auf `INPUT` umkonfiguriert (reines GPIO-Output-Register-Restverhalten, kein
Leak-Indiz für sich). Erst der eigentliche Nachtest laut PLAN.md-Formulierung
zeigt es: neuer `DigitalInputSensor` (`pullup:true`) exakt auf GPIO4 angelegt
(derselbe Pin wie der gelöschte Aktor) — `pinMode(INPUT_PULLUP)` greift
sauber, beide Pins (GPIO4 und die gejumperte Probe auf GPIO5) springen auf
HIGH. Kein LEDC-Kanal überschreibt den Pin mehr trotz `pinMode`-Wechsel — das
wäre bei unterbliebenem `ledcDetachPin()` der klassische ESP32-Fallstrick
(GPIO-Matrix-Routing überlebt einen reinen `pinMode()`-Aufruf).

**Ergebnis:** Fix bestätigt. Testsensoren wieder gelöscht, Board am Ende mit
leerer Registry hinterlassen (Ausgangszustand). PLAN.md-Eintrag entfernt.

## 2026-09-05 — PID-AutoTune: Fortschrittsanzeige + Korrektheits-Fix der Relay-Timing

Ausgangspunkt war der Backlog-Punkt „Fortschrittsanzeige/Restzeit" — bei der
Analyse aber ein grundlegenderer Bug gefunden: das vendorte `AutoTunePID`
(Tag `v1.1.6`, `SensActCtrl/library.json`) liest `currentInput` in
`performAutoTune()` nie, sondern kippt den Output stur alle 1000 ms für
`oscillationSteps` (Default 10) Schritte und berechnet Ku/Tu rein aus der
Wanduhr — für träge Prozesse (Kessel, Maischebottich) physikalisch
bedeutungslos (`Ku` reduziert sich algebraisch auf die Konstante `4/π`).
Vergleich mit dem Upstream-Repo zeigt: der `main`-Branch (Commit `34c6f39`,
kein Tag) hat eine vollständige Neufassung mit echter Hysterese-basierter
Relay-Rückkopplung (reagiert auf tatsächliche Sollwert-Kreuzungen, misst
reale Halbwellen-Perioden) und behebt nebenbei einen zweiten Bug
(Zähler/Zeitstempel waren `static`-Lokale statt Instanzfelder — mehrere
gleichzeitige AutoTune-Läufe hätten sich korrumpiert).

**Fix:** `library.json`-Pin auf den main-Commit umgestellt (Präzedenzfall für
Commit-Hash-Pins bereits vorhanden: `IdsInductionCooker.git#bf5be40`),
`PidEngine.h/.cpp` auf den neuen `atp::`-Namespace migriert. Da auch `main`
keinen Getter für den internen Halbwellen-Zähler/das konfigurierte
`oscillationSteps` hat: `PidEngine` ruft `setOscillationMode()` jetzt aktiv
selbst auf (nicht `setOscillationSteps()` direkt — das würde von einem
späteren `setOscillationMode()`-Aufruf überschrieben) und zählt reale Zyklen
über Flankenerkennung auf `getOutput()` (kippt bei jeder Kreuzung zwischen
zwei diskreten Werten — exakt, keine Off-by-one-Falle wie bei einer
`getTu()`-Änderungserkennung, die die erste Kreuzung verpasst hätte). Neue
Felder `autotuneCyclesObserved`/`autotuneCyclesTotal` in `paramsJson()`,
OpenAPI und `types.ts`. Frontend: neue Komponente `AutotuneProgress.tsx`
(horizontaler 3-Phasen-Stepper „Anfahren → Schwingung → Fertig" + %-Balken,
keine Zeitanzeige), in `ControllerCard.tsx` und `AddItemModal.tsx` eingesetzt.

**Bekannte Einschränkung:** `main` ist kein offizielles Release — Arduino-IDE-
Library-Manager-Nutzer (`library.properties`) bekämen weiterhin `v1.1.6`.
In PLAN.md vermerkt.

**Verifikation:** `pio test -e native` (SensActCtrl, 196 Tests inkl. 4 neue
grün), `pio run -e esp32dev` (BrewControl/firmware, zieht den neuen Pin,
kompiliert gegen `atp::`), `redocly lint` valide, `pnpm typecheck` clean.
Echte Zyklen-Numerik auf echter Hardware noch offen (PLAN.md-Hardware-Item
ergänzt).

## 2026-09-05 — Reihenfolge Auth/Push/HTTPS geklärt + Zugriffsschutz umgesetzt

**Auslöser:** Beobachtung, dass `esp-webPush` JWT-Klassen mitbringt, die man
„auch für Auth bräuchte" — plus die PLAN.md-Annahme, HTTPS sei harte
Voraussetzung für Push. Beide Annahmen halten der Prüfung nicht stand.

**Recherche-Ergebnis:**

- **Kein geteilter JWT-Baustein.** `esp-webPush` implementiert VAPID-JWT nach
  RFC 8292 (ES256/P-256-ECDSA über mbedTLS), um das *Gerät gegenüber dem
  Push-Service* zu authentisieren — lib-intern, nicht als allgemeine JWT-API
  exponiert. Ein Login braucht ein symmetrisches, kurzlebiges Session-Token;
  ECDSA-Verify pro API-Request wäre auf dem ESP32 die falsche Größenordnung.
  Gleicher Name, anderer Algorithmus, anderes Threat-Model.
- **`esp-webPush` braucht kein Server-TLS** — es ist HTTPS-*Client*, das läuft
  längst (`FirmwareUpdater.cpp:98`, `MqttService.cpp:56`). Der Secure-Context-
  Zwang trifft nur die Seite, die den Service Worker registriert.
- **Self-signed trägt für Push nicht** — Chrome verweigert SW-Registrierung bei
  Zertifikatsfehlern (w3c/ServiceWorker#1514, Chromium 40423989); der in
  PLAN.md notierte Weg „User akzeptiert einmalig" ist tot.
- **Server-TLS wäre teuer** — `esp32async/ESPAsyncWebServer`+`AsyncTCP` haben
  keinen Server-TLS-Pfad (me-no-dev#899; TLS nur client-seitig im
  tve/AsyncTCP-Fork), bliebe `esp_https_server` mit ~50 Routen, SSE und zwei
  Upload-Pfaden.

**Entschiedene Reihenfolge:** Auth → Web Push über gehosteten Bootstrap-Origin
→ HTTPS (entkoppelt, optional). Damit fällt der teuerste Punkt aus dem
kritischen Pfad, auch für Installationen bei anderen, die sonst zuhause
HTTPS einrichten müssten. Push-Design und HTTPS-Varianten stehen in PLAN.md.

**Umgesetzt: Stufe 1 — Zugriffsschutz (optional, Lesen frei, Schreiben
geschützt).**

Neue Klasse `AuthService.{h,cpp}`: salted, 10k-fach iteriertes SHA-256 über
`mbedtls_md` (versionsstabil über mbedTLS 2.x/3.x), Credentials in
`Preferences("brewctrl")` — derselben NVS-Namespace wie die WLAN-Daten. Das
hält das Secret aus `GET /api/settings`, aus dem Backup-Bundle und von der
SD-Karte fern und macht den bestehenden BOOT-Tasten-Factory-Reset
(`main.cpp:131`, `prefs.clear()`) ohne eine Zeile Extra-Code zum
„Passwort vergessen"-Pfad. Sessions: 4 Slots, opake 16-Byte-Tokens aus
`esp_random()`, 7 Tage Gleitablauf, wrap-sichere `millis()`-Vergleiche,
Constant-Time-Compare. Bewusst **nur RAM** — persistierte Sessions bräuchten
Epoch-Zeit statt `millis()` und damit einen synchronisierten NTP-Stand.

**Kein separates `enabled`-Flag:** `isConfigured()` ist die einzige Wahrheit.
Kein Passwort ⇒ jedes Gate ist ein No-op, Bestandsgeräte bleiben nach dem
Update unverändert offen. Schutz einschalten = Passwort setzen, ausschalten =
löschen.

**Cookie statt Bearer-Header**, weil `EventSource` keine Custom-Header setzen
kann — ein Token im Header hätte `/api/events` unlösbar gemacht. Cookies fahren
same-origin automatisch mit, deshalb blieben alle 31 `fetch()`-Aufrufstellen in
`api.ts` inhaltlich unangetastet.

**Gate-Schnitt in `WebUI.cpp`:** Die Prüfung sitzt in den drei generischen
Handler-Klassen (`BodyPrefixHandler`, `DeletePrefixHandler`, `PostJsonHandler`)
statt an ~30 Registrierungsstellen; `requireAuth()` nimmt `/api/auth/*` aus
(sonst wäre Login unmöglich). Explizit nachgezogen an den fünf Roh-Routen
(`wifi-reset`, `update/firmware`, `update/assets`, `files` DELETE,
`files/upload`). Die beiden OTA-Uploads brauchten dafür ein
`uploadUnauthorized_`-Flag analog zum vorhandenen `fileUploadRejected_` — ohne
das hätte der finale Chunk ein zweites Mal geantwortet.

**Nebenbei geschlossen:** `GET /api/backup` gab das MQTT-Passwort im Klartext
aus (`SettingsStore::serialize()` emittiert `mqtt.password`,
`WebUI.cpp:788` schwärzt es nur für `GET /api/settings`). Als einzige Leseroute
liegt das Backup jetzt hinter dem Gate.

**Frontend:** zentrale `failed()`-Fehlerbahn in `api.ts` (alle 30 identischen
Fehlerzeilen umgestellt), die bei 401 einmalig `bc:unauthorized` feuert;
`app.tsx` öffnet darauf das neue `LoginModal.tsx`. Neue Seite
`SecurityPage.tsx` (Einstellungen → Zugriffsschutz): einrichten, ändern,
aufheben, alle Sitzungen abmelden — ohne An/Aus-Toggle, passend zum
Firmware-Modell. Antwortet das Gerät nicht auf `/api/auth/status` (ältere
Firmware), zeigt die Seite das explizit an, statt „ungeschützt" zu raten oder
im Skeleton hängen zu bleiben.

**Verhalten bei Hostnamen-Änderung** (durchgespielt, kein Sonderfall-Code
nötig): Passwort überlebt (`POST /api/network` macht `putString`, kein
`clear()`), das Cookie nicht — es hängt am alten Host. Gleiches gilt schon
immer zwischen IP und `.local`: zwei Origins, zwei Anmeldungen. In README
dokumentiert.

**Grenze, bewusst so:** ohne TLS geht das Passwort beim Anmelden im Klartext
über das LAN. Schutz gegen Fehlbedienung und beiläufige Zugriffe, nicht gegen
einen aktiven Angreifer im Segment. Challenge-Response wurde verworfen — es
schließt nur passives Mitlesen, solange das JS selbst über http kommt.

**Verifikation:** `pio run -e esp32dev` grün, Δ gegen HEAD gemessen (Baseline-
Build mit zurückgesetzten Quellen): Flash 1 408 453 → 1 415 325 B (74,1 % →
74,5 %), RAM 52 128 → 52 320 B (+192 B). `pnpm typecheck` clean, `pnpm build`
grün, `redocly lint` valide (die bisher unterdrückte `security-defined`-Warnung
ist damit erledigt; `info-license` war schon vorher offen). Im Browser gegen
den Vite-Dev-Server geprüft: Settings-Eintrag da, Login-Modal rendert korrekt,
und der Degradationspfad griff live — das Gerät unter `brewcontrol.local`
läuft noch mit alter Firmware und antwortet 404 auf `/api/auth/status`.

**Hardware-E2E am LilyGo T-Display-S3-AMOLED (`brewcontrol.local`,
192.168.178.87) — vollständig grün.** Firmware geflasht (COM9, Hash verifiziert,
Flash 20,5 % / RAM 15,5 % auf dem 16-MB-Board), UI-Paket über
`POST /api/update/assets` nachgezogen (4,3 s, neues Bundle wird ausgeliefert).

Durchlauf in dieser Reihenfolge, jeweils per `curl`:

1. **Aus-Zustand als Regressionstest** — `/api/auth/status` meldet
   `{"enabled":false,"authenticated":true}`, Schreiben ohne Cookie `204`,
   `GET /api/backup` `200`, Login gegen ein passwortloses Gerät `409 no password
   configured`. Verhalten identisch zu vorher.
2. **Passwort gesetzt** (ohne `currentPassword`, wie vorgesehen) → `204` +
   `Set-Cookie`. Status ohne Cookie danach `{"enabled":true,"authenticated":false}`.
3. **Reads bleiben offen** — `/api/snapshot` und `/api/settings` je `200`.
4. **Writes gesperrt** — `POST /api/actuators/<id>`, `POST /api/settings`,
   `DELETE /api/actuators/<id>` je `401`.
5. **Gated read** — `GET /api/backup` ohne Cookie `401`, mit Cookie `200`.
6. **SSE** bleibt bei aktivem Schutz ohne Cookie offen (`200`,
   `text/event-stream`, laufende `snapshot`-Events).
7. **Negativtests** — falsches Passwort `401`, gefälschtes `bcsid` `401`,
   falsches `currentPassword` beim Ändern `403`.
8. **Cookie-Präfix-Falle** — `Cookie: xbcsid=<gültiges Token>` wird korrekt
   abgelehnt (`401`); die Separator-Prüfung in `sessionCookie()` greift.
9. **Reboot** (über `POST /api/network` mit unverändertem Hostnamen, selbst
   gated) — nach ~25 s wieder da: Passwort überlebt (`enabled:true`, NVS),
   Session nicht (altes Cookie → `401`, RAM-only wie entworfen).
10. **Aufgeräumt** — Schutz mit leerem Passwort aufgehoben, `Set-Cookie` mit
    `Max-Age=0`, Endzustand wieder `{"enabled":false,"authenticated":true}` und
    Schreiben ohne Cookie `204`.

**Falscher Alarm unterwegs:** `curl http://<ip>/api/events` antwortet `404`.
Nicht durch diese Änderung verursacht — die beiden Boards mit alter Firmware
(`.74`, `.82`) verhalten sich identisch. `AsyncEventSource::canHandle` verlangt
`Accept: text/event-stream`; mit dem Header kommt sauber `200` plus Event-Strom.
Für künftige SSE-Tests per curl also immer den Accept-Header mitgeben.

## 2026-09-06 — Fix: mobiles Programm-Bottom-Sheet verdeckte das letzte Listenelement

Das fixe Bottom Sheet (`ProgramCard` mit `fill`, seit 2026-09-04) liegt auf
Mobile bewusst über der gescrollten Dashboard-Liste. Der dafür vorgesehene
Platzhalter in `Dashboard.tsx` war fest auf `h-40` (10 rem) — sobald das Sheet
höher wurde (aktiver Hero-Block mit Fortschrittsbalken, oder per Drag auf
`max-h-[50vh]` aufgezogen), reichte der Abstand nicht und das unterste
Karten-/Listenelement blieb hinter dem Sheet unerreichbar.

Umsetzung: `ProgramCard` misst die eigene gerenderte Höhe per `ResizeObserver`
auf dem Root-Element und meldet sie über den neuen Callback `onSheetHeight`
(auf Desktop `0`, da das Sheet dort eine normale Spaltenkarte ist). `Dashboard`
hält die Höhe in `sheetH` und setzt den Platzhalter (`lg:hidden`) per Inline-
`style={{ height: sheetH }}` — wächst und schrumpft jetzt mit dem Sheet, auch
während des Drags. `pnpm typecheck` + `pnpm build` grün; HW-Verifikation am
Gerät steht noch aus.

## 2026-09-05 — Alarme & Schwellwerte + Notification/Alert-Center

Der Backlog-Punkt „Alarme & Schwellwerte" samt seiner Erweiterung
„Notification/Alert-Center" umgesetzt. Vorher war ein `fault()` nur als Badge
auf der jeweiligen Karte sichtbar — lag die Karte auf einem anderen
Dashboard-Tab, sah man ihn gar nicht; es gab keine Aggregation, keinen Verlauf,
und Grenzwerte auf Messwerte überhaupt nicht.

**Entscheidungen vorab** (mit dem Nutzer geklärt): Auswertung komplett in der
BrewControl-Firmware, SensActCtrl bleibt unangetastet — damit teilt sich der
später geplante Punkt „Sensorgetriggerte Schritte" die Condition-Struktur
direkt, beide liegen in BrewControl. Alle vier Trigger in v1. Alert-Verlauf im
RAM-Ring, Regeln persistiert. Eigenes SSE-Event statt Snapshot-Erweiterung,
weil dessen fester 4160-Byte-Puffer bei Überlauf den Push still verwirft.

**Firmware.** Neu `Condition.h/.cpp` — `LogStore::resolve()` als freie Funktion
`resolveRef()` herausgezogen (reiner Verschiebe-Schritt, `LogStore` ruft sie
jetzt auf) und um das wiederverwendbare Primitiv `Condition {ref, op, value,
hyst}` + `evalCondition()` mit Latch-Semantik ergänzt. Neu `AlarmStore.h/.cpp`
nach dem Store-Muster von `ProfileStore`/`LogStore`: Regeln in
`/config/alarms.json`, Alert-Ring (40 Einträge, feste `char`-Arrays statt
`std::string` — deterministische ~6 KB im `.bss` statt Heap-Fragmentierung neben
WiFi/AsyncTCP/SD), rekursiver Mutex wie bei den anderen Stores mit `tick()`.
Drei Detektoren im Tick: Schwellwerte mit Hysterese und `forSec`-Entprellung,
`fault()`-Flanken, AutoTune-Abschluss (per `strstr` über `paramsJson()`, weil
`Controller` keinen Autotune-Accessor auf dem Basis-Interface hat). Gelöschte
Items fallen per Mark-and-Sweep aus der Flanken-Tabelle — kein
`DynamicItems`-Observer nötig; eine Regel auf ein verschwundenes Item feuert
weder noch löscht sie sich, sondern meldet `resolved: false` und heilt, wenn das
Item zurückkommt.

`ProgramRunner` bekam `setOnStatusChanged()` plus ein privates `setStatus_()`,
über das alle neun Zuweisungsstellen laufen (die in `loadFromSD` bewusst nicht,
sonst würde der Boot Alerts für Übergänge von vor dem Reboot feuern).

**Zwei Details, die Ärger verhindern:** Der `AlarmStore` sendet nicht selbst,
sondern legt Alerts in eine Outbox, die `WebUI::tick()` mit max. 4 pro Durchlauf
leert — `raise_()` kann über den ProgramRunner-Callback auf dem AsyncTCP-Task
laufen und bleibt so allokations- und netzwerkfrei. Und anders als
`LogStore`/`ProgramRunner` wartet der Store *nicht* auf NTP: ein unterdrückter
Alert ist für immer weg, und die erste Minute nach dem Boot ist genau die, in
der ein Verdrahtungsfehler auffällt. Vor dem Sync ausgelöste Alerts tragen
`ts: 0`, die Entprellung läuft durchgehend auf `millis()`.

**API.** `GET/POST /api/alarms`, `POST/DELETE /api/alarms/<id>`,
`POST /api/alarms/<id>/enable`, `GET /api/alerts[?since=<seq>]`,
`POST /api/alerts/clear`, plus das SSE-Event `alert`. Auth kommt gratis über die
bestehenden Handler-Klassen; nur `/api/alerts/clear` (body-los) braucht
`requireAuth` von Hand. `?since=` ist der einzige Reparaturpfad und deckt
Kaltstart, Reconnect *und* von `AsyncEventSource` still verworfene Pushes mit
einem Mechanismus ab. `openapi.yaml` und die README-Routentabelle im selben
Zug nachgezogen, inkl. der bisher falschen Behauptung „The only event name is
`snapshot`".

**Frontend.** `subscribeEvents()` nimmt jetzt optional `onAlert` und `onOpen` —
eine EventSource für beide Event-Namen, weil jede Verbindung dem Gerät einen
SSE-Client-Slot kostet. Neu `AlertCenter.tsx` (Toast-Stack unten rechts plus
Slide-in-Panel an einer Glocke in der NavShell mit Aktiv-Zähler),
`AlarmEditorModal.tsx` und die Seite `/settings/alarms`. Die Firmware sendet
bewusst keine deutschen Texte — sie liefert strukturierte Felder, die deutsche
Formulierung entsteht in genau einer Funktion `alertText()`. Aktive Alarme
badgen zusätzlich die Sensor-/Aktorkarte. `styles.css` blieb unangetastet:
`--success/--caution/--critical/--accent` decken das Severity-Vokabular ab.

**Bewusst *kein* Alert-Center als eigene Route:** eine Seite ist genau dann
nicht erreichbar, wenn man sie braucht — man steht am Kessel auf dem Dashboard.
Deshalb Glocke plus Panel, das über jeder Seite aufgeht.

**Verifikation.** `pio run` grün für alle drei Board-Envs; RAM auf esp32dev
52320 → 58632 Byte, also die kalkulierten ~6 KB für den Ring.
`pio test -e native` grün in beiden Projekten (BrewControl 16, SensActCtrl 196).
`npx @redocly/cli lint` sauber (die eine `info-license`-Warnung ist vorbestehend).
`pnpm typecheck` und `pnpm build` grün.

Danach per Netzwerk-OTA auf den LilyGo (`brewcontrol.local`) geflasht und E2E
durchgespielt — Regeln auf den echten DS18B20 (`sensor/mlt`) und auf
`actuator/pump`:

1. **Schwellwert raise** — Regel `mlt > 20` angelegt, feuert innerhalb einer
   Sekunde: SSE-`alert` auf der Leitung, `active: true` mit `since`,
   Ring-Eintrag mit `v: 22.5`.
2. **Raise → cleared → raise** über `actuator/pump` (an/aus/an) — alle drei
   Flanken kamen als eigene SSE-Events, `cleared` korrekt mit `sev: info`.
3. **enable-Toggle** — Deaktivieren löscht den Latch und setzt
   `resolved: false`, Reaktivieren feuert neu.
4. **Tote Referenz** — Regel auf `sensor/gibtesnicht`: `resolved: false`,
   `active: false`, kein Alert, keine Löschung.
5. **Programm-Trigger** — Zweischritt-Programm mit `confirm` (Sollwert 0, damit
   der PID garantiert Ausgang 0 kommandiert): `awaiting` als Warnung, `done` als
   Info.
6. **Validierung** — fehlender Name/`cond`/`value` und kaputtes JSON je `400`,
   unbekannte Id bei POST und DELETE je `404`.
7. **`?since=`** — `since=2` liefert genau `[3, 4]`, `since=999` leer.
8. **Reboot** — Regeln überleben (`/config/alarms.json`), der Ring läuft bei
   `seq: 1` neu an, und der noch anstehende Schwellwert meldet sich beim ersten
   Tick von selbst wieder — genau das Verhalten, das den RAM-Ring vertretbar
   macht.
9. **UI gegen dasselbe Gerät** — Glocken-Zähler (1 → 2), „Grenzwert“-Badge auf
   Sensor- und Aktorkarte, Live-Toast unten rechts, Panel mit Verlauf in
   Geräte-Zeitformat, Severity-Filter, „Verlauf leeren“. Regelseite und Editor
   (Live-Kanalliste aus dem Snapshot, Validierung) in hellem und dunklem Theme.

Beim UI-Test fiel auf, dass der Rohwert als `aktuell 22.4375` erschien — der
Alert trägt keine Kanalauflösung, also rundet `alertText()` jetzt auf zwei
Nachkommastellen.

**Ein echter Fund im Testlauf:** `alarms_.tick()` stand zunächst vor dem
1-Hz-Gate in `WebUI::tick()` und lief damit bei jedem Loop-Durchlauf (~5 ms) —
inklusive `paramsJson()` für jeden Controller. Auf 1 Hz gezogen und mit einem
eigenen `lastAlarmMs_` versehen; die Entprellung hängt ohnehin an `millis()`,
nicht an der Tick-Zahl.

**Testartefakte entfernt:** Regeln, Testprogramm und Verlauf gelöscht, Pumpe und
`testpid` auf ihren Ausgangszustand zurückgesetzt.

**Noch offen:** die Trigger `fault()` und AutoTune — ersterer hätte auf dem
Board eine Umstellung des MQTT-Transports auf einen toten externen Host
gebraucht, letzterer einen vollständigen AutoTune-Durchlauf. Als eigener Punkt
in [PLAN.md](PLAN.md) notiert, zusammen mit der dabei aufgefallenen Lücke, dass
`GET /api/backup` weder Logs noch Programme noch Alarme mitnimmt.

## 2026-09-09 — Push-Notifications umgesetzt (esp-webPush, ein Keypair pro Installation)

**Auslöser:** Wunsch, Meldungen aufs Handy zu bekommen — bis dahin liefen alle
Alerts nur über SSE ins offene Dashboard, also genau dann nicht, wenn es zählt.

**Zwei Planannahmen fielen bei der Prüfung:**

- **Curier ist mit dieser Platform nicht baubar.** Weil `ESPToolKit/esp-webPush`
  seit 2026-08-03 archiviert ist, war zunächst der Nachfolger
  [ZekStack/curier](https://github.com/ZekStack/curier) gesetzt. Er nutzt
  `std::span` — libstdc++ liefert das erst ab GCC 10, `espressif32@6.10.0` pinnt
  für Arduino aber fest GCC 8.4. Der Compiler kennt `-std=gnu++20` nicht einmal
  dem Namen nach (nur `gnu++2a`), und unter `gnu++2a` verlor er zusätzlich die
  implizite Inline-Eigenschaft von `static constexpr`-Membern
  (`YF_S201Sensor::kHzPerLiterPerMin` → undefined reference). Curier hängt damit
  am Sprung auf Arduino Core 3 / ESP-IDF 5 — eigenes Vorhaben, steht in PLAN.md.
  Also esp-webPush auf seinem letzten Commit, bewusst nicht auf dem Tag `v2.0.0`:
  die TLS-Zertifikatsprüfung (`useTlsCertBundle`) kam erst danach, ohne sie hätte
  der Push-Request keine CA. Archiviert heißt: der SHA ist so unveränderlich wie
  ein Tag.
- **Die Trigger waren schon gebaut.** PLAN.md ging noch davon aus, Flankenerkennung
  für `fault()` und Programm-Ende müsse erfunden werden. Seit `c1a1b64` erzeugt
  `AlarmStore` aber genau diese vier Ereignisse fertig entprellt. Push hängt sich
  deshalb nur mit einem zweiten Lese-Cursor (`takePendingPush`) an denselben Ring,
  den `WebUI::tick()` schon für SSE leert — getrennte Cursor, damit sich beide
  Verbraucher keine Meldungen wegnehmen.

**Ein VAPID-Keypair pro Installation statt pro Gerät** (PLAN.md hatte pro Gerät
vorgesehen): Ein Browser hält pro Service-Worker-Scope genau ein Abo, fest
gebunden an einen `applicationServerKey`. Ein Keypair pro Gerät bräuchte damit
einen eigenen statischen Scope-Ordner je Gerät auf Pages plus eine Gerät→Platz-
Liste im Browser, die beim Löschen der Browserdaten verfällt. Die Bootstrap-Seite
erzeugt das Keypair stattdessen per WebCrypto, hält es in ihrem localStorage und
gibt es jedem Gerät mit; ein Gerät, das schon einen Key kennt, reicht ihn als
`?k=` mit. Ergebnis: ein Abo pro Browser für beliebig viele Geräte, kein
Krypto-Code auf dem ESP32, und nichts Geheimes im öffentlichen Repo.

**Umsetzung:** `PushService.{h,cpp}` nach dem `WebhookService`-Muster (Globale in
`main.cpp`, `begin()` nach dem STA-Connect, `tick()` im Loop). Keypair und bis zu
vier Abos in NVS, bewusst nicht in `/config/*.json`, damit sie aus
`GET /api/backup` herausbleiben — eine Endpoint-URL ist das einzige Geheimnis,
das eine fremde Benachrichtigung verhindert. Fünf Routen unter `/api/push/*`,
Schreibzugriffe automatisch über die vorhandenen Handler-Klassen auth-gated.
Neue statische Seite `BrewControl/push-bootstrap/` plus `.github/workflows/pages.yml`
(→ `nhhop.github.io/Brauerei/push/`), neue SPA-Seite
`/settings/notifications`.

Zwei Details, die Ärger gespart haben: `WebPushConfig` defaultet auf
`queueMemory = Psram`, das zwei der drei Boards nicht haben (→ `Internal`), und
der Worker-Stack-Default von 4 KB übersteht keinen TLS-Handshake (→ 12 KB, wie
das Upstream-Beispiel nahelegt). Die Klick-URL der Meldung wird bei *jedem* Push
frisch aus `WiFi.localIP()` gebaut statt aus dem Hostnamen — Android löst mDNS
nicht zuverlässig auf, und das Handy ist der ganze Zweck der Übung.

**Verifikation:** Alle drei Envs bauen; Flash `esp32dev` 75,3 % → 83,3 %
(+152 KB, im Wesentlichen TLS-Pfad und Zertifikats-Bundle), RAM +888 B.
`pnpm typecheck` und `pnpm build` grün, Redocly-Lint grün. Lokal verifiziert:
Redirector-Schutz der Bootstrap-Seite (`https://…`, fremde Hosts abgelehnt,
`.local` und private IPs akzeptiert), die WebCrypto-Formate (65-Byte-P-256-Punkt
mit `0x04`-Marker, 32-Byte-Privatschlüssel, unpadded base64url) und der
Fragment-Übergabepfad (`#push=…` → `POST /api/push/subscription` → `204`, Hash
danach aus der URL). Am Gerät (LilyGo S3, `brewcontrol.local`) nachgezogen: Firmware und UI
geflasht — das Board lief zuvor auf einem UI-Stand *vor* dem Alarm-Center, bei
gleichzeitig neuerer Firmware, weil damals `cdf5fe0-dirty` geflasht und die UI
nicht mit deployt worden war. Danach verifiziert: `GET /api/push` liefert den
erwarteten Zustand, `test`/`reset` `204`, Validierung `400`/`404`,
`GET /api/backup` enthält weder `privateKey` noch Endpoint-URL (der Grund für
NVS statt `/config/*.json`), Gerät über eine Minute stabil. Zustellung am 2026-09-10 bestätigt (nach dem Pages-Deploy
und dem Fix unten): Testmeldung und echte Trigger kommen an, auf Desktop und
Handy, auch bei geschlossenem Tab und geschlossenem Browser; ein Klick auf die
Meldung öffnet das Dashboard. Offen bleibt nur der Mehr-Geräte-Fall, siehe
PLAN.md. Automatisiert war das nicht zu prüfen: der Browser der Werkzeugkette
meldet `Notification.permission === "denied"` und verweigert die
SW-Registrierung.

## 2026-09-10 — Fix: zweiter Browser ersetzte das Abo des ersten

**Symptom:** Ein zweiter Browser einrichten warf das Abo des ersten raus — die
Liste blieb bei einem Eintrag.

**Root Cause:** Denkfehler in `push-bootstrap/app.js`. `resolveKeypair()` gab bei
einem per `?k=` übergebenen Gerätekey `{publicKey, privateKey: null}` zurück, und
der Aufrufer ersetzte das anschließend durch ein **frisch erzeugtes Keypair** —
mit dem Kommentar „nothing here can sign for it". Falsch: der Browser signiert
nichts, `pushManager.subscribe()` nimmt ausschließlich den *öffentlichen*
Schlüssel; signiert wird beim Senden auf dem Gerät, das die private Hälfte längst
hat. Der neue Schlüssel kam als Key-Wechsel beim Gerät an, und ein Key-Wechsel
verwirft per Design alle Abos (sie würden gegen den neuen Key nur 403 liefern).

**Umsetzung:** In `app.js` hat `?k=` jetzt Vorrang vor dem localStorage — das
Gerät ist der Anker, damit alle Geräte einer Installation dieselbe Subscription
bedienen. Der localStorage-Eintrag wird nur genutzt, wenn er zum Gerätekey passt
(dann reisen beide Hälften mit) oder wenn das Gerät noch gar keinen Key hat. Der
Neu-Erzeugen-Block ist ersatzlos weg. `PushService::setSubscription()` akzeptiert
dafür einen leeren `privateKey`, solange der `publicKey` der gespeicherte ist;
ein *unbekannter* Key braucht die private Hälfte weiterhin, sonst wäre er
unbrauchbar.

**Verifikation:** Am LilyGo S3 (`8d85d14-dirty`) direkt gegen die API geprüft —
zweiter Browser (gleicher `publicKey`, leerer `privateKey`, neuer Endpoint) →
`204`, Liste wächst auf zwei Abos, `publicKey` unverändert; unbekannter Key ohne
private Hälfte → `400`; Test-Eintrag wieder entfernt → `204`. Redocly-Lint grün. Nach dem Merge
vom Nutzer bestätigt: zwei echte Abos nebeneinander (Windows-Desktop und
FCM/Handy), beide bekommen die Meldungen.

## 2026-09-10 — esp32dev auf Stand gebracht, UI-Netzwerk-Deploy für LittleFS-Boards

**Auslöser:** Das esp32dev-Testboard hing 70 Commits zurück (Stand `3213288`,
LittleFS-Support vom 28.8.) — ohne Auth, Profile, Alarme und Push.

Firmware per OTA (`POST /api/update/firmware`) war unkritisch. Die UI dagegen
schien Handarbeit zu erfordern: `CLAUDE.md` schrieb dafür `pio run -t uploadfs`
vor und schloss den Netzwerk-Upload aus — und genau dieses Board hat keinen
zuverlässigen Auto-Reset, d.h. jemand muss den BOOT-Button halten.

**Erkenntnis:** Der Netzwerk-Upload funktioniert dort sehr wohl, er scheiterte
bisher nur am Paket. `pnpm build:sd` lässt die unkomprimierten Dateien neben den
`.gz` liegen, das übliche `webui.tar` ist damit ~440 KB und passt nicht in die
256-KB-Datenpartition. Ein Tar aus **nur den .gz-Dateien** ist ~100 KB — dieselbe
Diät, die `firmware/data/www` ohnehin hält, weil ESPAsyncWebServer `.gz`
transparent ausliefert. Upload in ~2 s, Swap sauber, `/www` danach byte-identisch
zum lokalen Build. Der auf dem LOLIN S2 Mini dokumentierte Abbruch bei ~65 KB
trat auf dem esp32dev nicht auf; für den LOLIN bleibt die Einschränkung bestehen.

Regel in `CLAUDE.md` entsprechend präzisiert (statt pauschalem Ausschluss) und
den Weg in `README.md` als eigenen Abschnitt ergänzt. Beide Boards laufen jetzt
auf `97cfdb6` mit identischer UI.

## 2026-09-10 — Fix: Push-Test crashte den esp32dev (IRAM statt DRAM)

**Symptom:** `POST /api/push/test` auf dem esp32dev lieferte keine Antwort; das
S3 beantwortete dieselbe Route in 0,1 s. Ein Poll-Loop zeigte nur einen einzelnen
Aussetzer, was zunächst gegen einen Reboot sprach.

**Root Cause:** Die serielle Konsole zeigte `Guru Meditation Error (LoadStoreError)`
plus Reboot — der Boot war schnell genug, dass der Poll ihn fast verpasste. Der
per `addr2line` dekodierte Backtrace führte von `PushService::tick()` über
`ESPWebPush::allocateItem()` bis in den `std::string`-Konstruktor von
`PushMessage`. Ursache war `cfg.queueMemory = WebPushQueueMemory::Internal`: das
mappt auf `MALLOC_CAP_INTERNAL`, was „nicht PSRAM" bedeutet und deshalb **IRAM
einschließt** — und IRAM erlaubt nur 32-Bit-Zugriffe. Auf dem esp32dev war der
DRAM knapp genug, dass `heap_caps_malloc` das Queue-Item dorthin legte; der
byteweise Zugriff des `std::string` löste den Panic aus. Auf dem S3 (PSRAM, mehr
freier DRAM) trat es nie auf.

**Umsetzung:** `WebPushQueueMemory::Any` (= `MALLOC_CAP_DEFAULT`, byte-adressierbar;
auf Boards ohne PSRAM ohnehin interner Speicher). Dazu im Test-Pfad von `tick()`
derselbe `initialized_`-Guard, den `send()` schon hatte — ohne ihn würde ein Test
auf einem nicht gestarteten Dienst in eine uninitialisierte Queue greifen.

**Verifikation:** Am esp32dev geflasht — `POST /api/push/test` antwortet `204` in
0,22 s, seriell 15 s lang keine Ausgabe (kein Crash), `lastError` leer.

## 2026-09-10 — Fix: neues Gerät entzog den anderen ihr Push-Abo

**Symptom:** Nach dem Einrichten des frisch geflashten esp32dev kamen auf dem PC
keine Meldungen des S3 mehr an — und umgekehrt hätte ein erneutes Einrichten des
S3 das esp32dev stillgelegt. Ping-Pong zwischen zwei Boards.

**Root Cause:** Die Bootstrap-Seite speicherte ihr Keypair nur, wenn sie es
*selbst erzeugt* hatte. Abonnierte sie mit einem per `?k=` gelieferten Gerätekey
(seit dem Fix vom selben Tag der Normalfall), blieb im localStorage der alte
Eintrag stehen. Kam danach ein Gerät **ohne** eigenen Key — frisch geflasht oder
zurückgesetzt —, fiel die Seite auf diesen veralteten Key zurück; das bestehende
Abo ist aber fest an den Key gebunden, mit dem es angelegt wurde, also musste sie
ab- und neu anmelden. Damit war genau das Abo entwertet, das auf den anderen
Geräten in NVS lag.

Der Browser kann das nicht allein auflösen: Die private Hälfte existiert nur auf
den Geräten, und die Seite kann beim Besuch von Gerät B nicht Gerät A fragen.

**Umsetzung:** Das Gerät reicht sein vollständiges Keypair selbst weiter. Neu ist
`GET /api/push/keypair` — die einzige Leseroute neben `GET /api/backup` mit
`requireAuth()`, weil sie den privaten Schlüssel herausgibt. Die SPA hängt ihn
beim Weiterleiten als **Fragment** (`#pk=…`) an die Bootstrap-URL, nie als
Query-Parameter: Fragmente werden nicht an den Server geschickt, landen also
nicht in GitHubs Logs. Die Seite liest ihn, entfernt ihn sofort per
`history.replaceState` aus der Adressleiste und legt das vollständige Paar in
ihren localStorage. Damit ist deren Kopie nie veraltet, und Reihenfolge wie
Browserwahl beim Einrichten sind egal. Ein Key ohne private Hälfte wird bewusst
**nicht** gespeichert — ein halbes Paar wäre schlimmer als keins.

**Verifikation:** Beide Boards auf `a95de04-dirty` geflasht,
`GET /api/push/keypair` liefert auf beiden 43 Zeichen base64url (32-Byte-Skalar).
Bootstrap-Logik lokal gegen `http://localhost` geprüft: Fragment wird gelesen,
verschwindet sofort aus der URL, das vollständige Paar landet im localStorage —
und ein Gerätekey *ohne* private Hälfte wird korrekt nicht gespeichert.

Nach dem Merge am Gerät bestätigt: beide Boards tragen denselben VAPID-Key und
beide dieselben zwei Abos (Windows-Desktop und FCM/Handy), Meldungen kommen von
beiden Geräten auf beiden Browsern an. Damit ist auch die Kernannahme des
Ein-Keypair-pro-Installation-Designs belegt — ein Abo pro Browser bedient
beliebig viele Geräte —, und der entsprechende Verifikationspunkt fällt aus
PLAN.md heraus. Einmalig war dafür noch das Zurücksetzen beider Boards nötig,
weil die divergierten Keys aus der Zeit vor dem Fix stammten; der Fix räumt
Bestehendes nicht rückwirkend auf.

## 2026-09-10 — PWA-Grundgerüst: Home-Screen-Start ohne Adressleiste

Ziel: das Dashboard am Kessel vom Home-Screen starten, ohne Browser-Adressleiste.

**Randbedingung:** Die Firmware liefert Klartext-HTTP; `http://<ip>` bzw.
`<host>.local` ist kein Secure Context. Der moderne Weg (Manifest +
`display: standalone` → WebAPK auf Android) ist genau darauf gated, und ein
Service Worker registriert sich dort ebenfalls nicht — dieselbe Wand wie beim
Push (siehe PLAN.md, HTTPS-Support). iOS dagegen prüft für Home-Screen-Apps
kein HTTPS: `apple-mobile-web-app-capable` plus Manifest genügen.

**Umsetzung:** Neues `web/public/` (gab es bisher nicht) mit `manifest.json`
und den vier Icons aus `push-bootstrap/` — kopiert, nicht verlinkt, weil das
Gerät im Brau-Netz kein Internet hat. Bewusst `.json` statt `.webmanifest`:
die MIME-Tabelle von ESPAsyncWebServer (`_setContentTypeFromPath`) kennt
`.webmanifest` nicht und lieferte `application/octet-stream`. `index.html`
bekommt Manifest-Link, `theme-color`, `mobile-web-app-capable`, die drei
`apple-*`-Tags und die Icon-Links. `black-translucent` und
`viewport-fit=cover` bewusst ausgelassen — beide schieben den Inhalt unter die
Statusleiste und verlangen dann `env(safe-area-inset-*)`-Padding, das es in
`styles.css` nirgends gibt. Keine Firmware-, keine API-Änderung.

**Verifikation:** Manifest im Browser geladen und geparst
(`Content-Type: application/json`, alle drei Icon-Einträge plus
apple-touch-icon und SVG-Favicon mit 200). Build und gzip-Roundtrip geprüft,
`firmware/data/www/` neu bestückt: 105,5 KB gz gegen 256 KB Partition, die
Icons kosten davon ~8 KB. Der eigentliche Test steht am Handy aus und liegt als
Verifikationspunkt in PLAN.md — offen ist vor allem, ob Chrome den Legacy-Pfad
`mobile-web-app-capable` (Vorgänger des Manifests, Chrome 31–38, seither
deprecated) heute noch bedient. Falls nicht, bliebe als Android-Weg ohne HTTPS
ein Vollbild-Button über die Fullscreen-API: die braucht keinen Secure Context,
aber eine transient activation, also einen echten Tap pro Sitzung.

**Nachtrag — Android:** Am Gerät bestätigt, dass Chrome den Legacy-Pfad nicht
mehr bedient: „Zum Startbildschirm hinzufügen" öffnet die SPA weiterhin mit
sichtbarer Adressleiste, `mobile-web-app-capable` allein trägt also nicht mehr.
Der Tag bleibt trotzdem drin — er kostet nichts und ist für Chromium-Forks noch
relevant. Als Ersatz gibt es jetzt einen Vollbild-Schalter in `NavShell.tsx`,
platziert in der ohnehin nur mobil sichtbaren Kopfleiste (`md:hidden`), rechts
neben dem Hamburger. Er ruft `requestFullscreen()` auf dem Wurzelelement auf:
kein Secure Context nötig, dafür eine transient activation — deshalb ein Button
und kein Aufruf beim Laden. Ein `fullscreenchange`-Listener hält Icon und
Tooltip synchron, auch wenn der Modus per Systemgeste verlassen wird.
Gerendert wird der Schalter nur bei `document.fullscreenEnabled`; auf dem
iPhone ist das `false` (Safari erlaubt Fullscreen dort nur für Video), dort
bleibt der Home-Screen-Weg über die `apple-*`-Tags der richtige.

**Verifikation Vollbild-Button:** Der Browser-Pane rendert die Seite in einem
iframe ohne Fullscreen-Permission (`requestFullscreen()` → „Permissions check
failed"), der echte Umschaltvorgang ließ sich dort also nicht auslösen. Geprüft
wurde stattdessen alles drumherum: Der Schalter erscheint bei 375 px Breite und
verschwindet bei 1280 px mit der Kopfleiste (`display: none`) — das Desktop-UI
bleibt unangetastet. Der Zustandspfad wurde direkt getrieben (gefälschtes
`fullscreenElement` plus `fullscreenchange`-Event): Tooltip wechselt
„Vollbild" → „Vollbild verlassen", Icon `maximize` → `minimize` und beim
Zurücksetzen wieder retour. `pnpm typecheck` sauber. Der Test am Handy steht
noch aus (PLAN.md).

**Nachtrag — Vollbild überlebt den Routenwechsel:** Am Handy fiel der Modus bei
jeder Navigation heraus, in Chrome, Edge *und* Firefox. Ursache ist nicht das
Frontend: gemessen im Dev-Server bleibt ein `window`-Marker über den Klick auf
einen Nav-Link erhalten, `performance.getEntriesByType('navigation')` steht
weiter bei einem Eintrag, `history.length` zählt hoch — es findet also keine
Dokument-Navigation statt, die Vollbild spec-konform beenden dürfte. Die Engines
steigen schlicht bei `history.pushState()` aus, und genau das ruft
preact-router in `route()` auf. Für Chromium ist das als Bug 138324 seit Jahren
offen dokumentiert („the fix for this is not trivial"), Gecko verhält sich
praktisch genauso.

Gegenmaßnahme ist die von Chrome selbst genannte: nach dem Routenwechsel neu
anfordern. `NavShell` merkt sich die Absicht des Nutzers in einem Ref und
stellt in einem `useEffect` auf `[path]` das Vollbild wieder her — das läuft
Millisekunden nach dem auslösenden Tap, also innerhalb dessen transient
activation. Wird der Request abgelehnt (Zurück-Taste, dahinter steckt keine
Geste), räumt der `catch` die Absicht ab, statt es bei jeder weiteren
Navigation erneut zu probieren. Gewolltes Verlassen — Wischgeste, Esc — wird
ohne Zeitstempel oder Klick-Listener davon unterschieden: ein
pushState-Austritt landet immer auf einer *neuen* URL, ein gewollter nicht. Der
`fullscreenchange`-Handler löscht die Absicht deshalb nur, wenn
`location.pathname` noch dem zuletzt gerenderten Pfad entspricht.

**Verifikation:** Der Browser-Pane verbietet echtes Vollbild (iframe ohne
Permission), also wurde die Engine gestellt — gefälschtes `fullscreenElement`
plus funktionierendes request/exit, alles andere echte Komponente. Sechs
Schritte durchgespielt: Schalter rein (Icon `minimize`), zweimal navigieren mit
simuliertem Engine-Austritt → bleibt drin und der Pfad wandert korrekt mit,
gewollt verlassen → Absicht fällt, danach navigieren → bleibt draußen.
`pnpm typecheck` sauber. Der Beleg am Gerät steht aus (PLAN.md).

Offen und bewusst nicht angefasst: die Streifen an Status- und Gestenleiste im
Vollbild (Chrome/Edge oben schwarz, Chrome unten schmal weiß; Firefox nutzt den
ganzen Schirm). Dafür bräuchte es `viewport-fit=cover` plus
`env(safe-area-inset-*)`-Padding an Kopfleiste, Seitenleiste, Scroll-Bereich
und FAB — eigener Change, siehe PLAN.md.

**Nachtrag 2 — erster Fix trug nicht.** Am esp32dev geflasht, keine Änderung:
Chrome, Edge und Firefox verlassen beim Navigieren weiterhin das Vollbild. Der
Fehler lag in einer Annahme über die Reihenfolge. Der Fix hing an einem
`useEffect` auf `[path]`, also am Re-Render, und setzte voraus, dass die
Engine `fullscreenchange` *davor* feuert. Tut sie das nicht, greifen beide
Zweige daneben: der Effekt sieht noch ein gesetztes `fullscreenElement` und
kehrt früh zurück, und der danach eintreffende Handler sieht den bereits
aktualisierten Pfad, hält den Austritt für gewollt und löscht die Absicht.

**Neuer Ansatz, ohne Reihenfolgen-Annahme:** Ein Klick-Listener in der
Capture-Phase hält den Zeitpunkt des letzten Taps fest. Der
`fullscreenchange`-Handler reagiert auf den Austritt selbst — liegt ein Tap
weniger als 1,5 s zurück, war es die Navigation, und das Vollbild wird per
`setTimeout(…, 0)` neu angefordert (die Engine soll den Austritt erst
abschließen); liegt kein Tap vor, war es Wischgeste, Esc oder Zurück-Taste, und
die Absicht fällt. Damit ist egal, wann die Engine das Event feuert. Der
`[path]`-Effekt und der Pfad-Vergleich sind entfallen.

**Verifikation:** Wieder mit gestellter Engine (der Browser-Pane verbietet
echtes Vollbild), diesmal beide Reihenfolgen durchgespielt — Austritt *vor* dem
Re-Render und Austritt *danach*: in beiden Fällen bleibt das Vollbild erhalten
und der Pfad wandert korrekt mit. Gewolltes Verlassen nach über 1,5 s ohne Tap
löscht die Absicht, anschließende Navigation holt nicht zurück. Der
Eintritts-Wechsel von `maximize` auf `minimize` passiert innerhalb von 50 ms.
`pnpm typecheck` sauber.

**Diagnoseseite `web/public/fstest.html`** (temporär, wieder entfernen, sobald
das Thema durch ist): unter `/fstest.html` erreichbar, ohne Framework. Sie
schaltet Vollbild ein, löst `history.pushState` aus und probiert den
Wiedereintritt in drei Varianten — sofort im Handler, `setTimeout(0)`,
`setTimeout(300)` —, protokolliert jedes `fullscreenchange` mit Zeitstempel,
zeigt per Microtask, ob das Event vor oder nach dem Rendern kommt, und gibt bei
Ablehnung Name und Meldung des Fehlers aus. Falls der neue Ansatz am Gerät
ebenfalls nicht trägt, liefert die Seite die Antwort, statt weiter zu raten.

**Nachtrag 3 — die Ursache ist nicht `pushState`.** Entscheidende Beobachtung
vom Gerät: zwischen den *Settings-Unterseiten* bleibt das Vollbild erhalten, nur
zwischen den drei Hauptbereichen (Dashboard / Profile / Einstellungen) bricht es
weg. Beide Wege laufen über dieselbe Mechanik — `<a href>`, von preact-router
abgefangen, `history.pushState`. Wäre pushState der Auslöser, müssten beide
scheitern. Damit ist die bisherige Diagnose hinfällig, und der zweite Fix
adressiert etwas, das gar nicht das Problem ist.

Weiter eingegrenzt, beides ausgeschlossen:
- **Bildschirmkante:** Das Vollbild überlebt das Antippen des Menü-Buttons oben
  links und bricht erst beim Antippen des Ziels — die obere Kante ist es also
  nicht.
- **Echte Dokument-Navigation:** Der frühere Marker-Test lief mit geschlossener
  Seitenleiste, also ohne das `setMobileOpen(false)` der Nav-Einträge.
  Nachgeholt mit *offener* Leiste: der Klick wird weiterhin abgefangen
  (`defaultPrevented === true`), der `window`-Marker überlebt,
  `performance.getEntriesByType('navigation')` bleibt bei einem Eintrag. Es
  lädt also nichts neu.

Übrig bleibt als Unterschied, dass ein Nav-Eintrag zusätzlich
`setMobileOpen(false)` auslöst und damit das Overlay-`div` aus dem DOM
entfernt, während die Karten in den Einstellungen nichts am Zustand ändern. Ob
das der Auslöser ist, lässt sich lokal nicht klären: der Browser-Pane rendert in
einem iframe ohne Fullscreen-Permission, echtes Vollbild ist dort nicht
auslösbar.

**Deshalb Messung statt weiterer Vermutung:** `web/src/fsdebug.ts` (temporär,
zusammen mit dem Aufruf in `main.tsx` wieder zu entfernen) schneidet Ereignisse
mit Zeitstempel mit — Klicks samt Ziel, `history.pushState` inklusive des
Zustands davor/danach/im Microtask, `fullscreenchange`, `fullscreenerror`,
`popstate`, `resize`, `visibilitychange`, `pagehide`. Anzeige in einem
eingeblendeten Panel mit Kopier-Knopf. Aktiv nur bei `?fsdebug=1` in der URL,
der Normalbetrieb bleibt unberührt. Lokal verifiziert: Klick-, pushState- und
Microtask-Zeilen erscheinen in der erwarteten Reihenfolge.

**Nachtrag 4 — Verdacht auf echten Dokument-Load.** Nächste Eingrenzung am
Gerät: vom Dashboard *weg* (zu Profilen, zu den Einstellungen) hält das
Vollbild, nur *zum* Dashboard hin bricht es — und dabei verschwindet auch die
Debug-Ausgabe. Das ist der eigentliche Hinweis: Das Panel hängt direkt an
`document.body`, außerhalb von `#app`; preact rendert nur in `#app` und kann
es gar nicht entfernen. Ist es weg, wurde das Dokument neu geladen — und beim
Neuladen von `/` fällt `?fsdebug=1` aus der URL, weshalb es sich nicht wieder
installiert. Ein echter Dokument-Load beendet Vollbild spec-konform, in jeder
Engine, und erklärt damit alle drei Browser auf einen Schlag.

Lokal ist das **nicht** reproduzierbar: mit offener Seitenleiste geprüft, sowohl
`href="/profiles"` als auch `href="/"` werden abgefangen
(`defaultPrevented === true`), Marker überlebt, ein Navigation-Entry. Das Gerät
verhält sich hier also anders als der Dev-Server, und die Ursache dafür ist noch
offen.

**Mitschnitt reload-fest gemacht:** `fsdebug.ts` wird jetzt über `?fsdebug=1`
scharf geschaltet und merkt sich das plus das Protokoll in `localStorage`
(`?fsdebug=0` schaltet ab und räumt auf). Nach einem Neuladen kommt das Panel
mit der bisherigen Historie zurück und schreibt eine Zeile
`=== DOKUMENT-START <url> typ=<navigate|reload|back_forward> ===`; dazu
kommen `beforeunload`/`pagehide` und eine Prüfung, ob das Panel aus dem DOM
entfernt wurde (unterscheidet DOM-Entfernung von Neuladen). Lokal verifiziert:
nach einem erzwungenen Load steht genau die Abfolge
`!! beforeunload` → `!! pagehide` → `=== DOKUMENT-START / typ=navigate ===`
im Protokoll.

**Nachtrag 5 — es war nie ein Fullscreen-Problem, sondern die Klick-Delegation.**
Der Mitschnitt vom Gerät zeigt beim Dashboard-Link genau das, was fehlt:

```
73598  CLICK  a href=/        fs=html
73603  !! beforeunload — Dokument wird verlassen
73643  !! pagehide
     0  === DOKUMENT-START  /  typ=navigate ===
```

Bei `/settings` und `/settings/security` steht dazwischen jeweils eine
`pushState`-Zeile, beim Dashboard-Link nicht. preact-router hat den Klick also
nicht genommen, der Browser hat den Link normal ausgeführt — echter
Dokument-Load, SPA neu gestartet, Vollbild spec-konform beendet. Das erklärt
alle drei Engines und auch, warum das Debug-Panel verschwand: es hängt an
`document.body` und war nach dem Load schlicht neu, ohne `?fsdebug=1` in der
URL gar nicht mehr aktiv.

preact-router nimmt Links über einen delegierten Click-Listener auf
`document`. Warum der auf dem Gerät ausgerechnet `href="/"` durchrutschen
ließ, ist offen — lokal ist es nicht reproduzierbar, dort wird derselbe Link
abgefangen und `exec('/', '/', {})` liefert einen Treffer. Statt weiter nach
dem Warum zu suchen, nimmt die Seitenleiste die Abhängigkeit jetzt heraus: der
`onClick` der Nav-Einträge ruft selbst `route(href)` auf, mit
`preventDefault()` und `stopPropagation()` — Letzteres, weil sonst die
Delegation zusätzlich greift und ein zweiter, identischer History-Eintrag
entsteht (im Protokoll als doppelte `pushState`-Zeile aufgefallen, bevor es
gefixt war). Modifier-Klicks und Mittelklick bleiben unangetastet, damit
„in neuem Tab öffnen" weiter funktioniert.

**Verifikation:** Drei Sprünge über die Seitenleiste (Dashboard → Profile →
Einstellungen) bei geöffneter mobiler Leiste: `history.length` wächst um genau
3, also ein Eintrag pro Sprung und keine Dubletten; `window`-Marker überlebt,
`performance.getEntriesByType('navigation')` bleibt bei einem Eintrag, im
Protokoll steht je Sprung genau eine `pushState`-Zeile und `abgefangen=JA`.
`pnpm typecheck` sauber.

Zwei Korrekturen an der Messung selbst, die dabei nötig waren: Der
Kopier-Knopf funktionierte am Gerät nicht, weil `navigator.clipboard` nur im
Secure Context existiert — jetzt mit `execCommand`-Fallback. Und die Zeile
`abgefangen=` kam aus einem zweiten Listener auf `document`, den
preact-router per `stopImmediatePropagation()` gerade dann verschluckt, wenn
es den Klick nimmt; sie wird jetzt verzögert aus dem Capture-Handler gelesen.

**Bestätigt und aufgeräumt.** Am Gerät geprüft: Vollbild bleibt beim Wechsel
zwischen Dashboard, Profilen und Einstellungen erhalten. Damit ist der
Dokument-Load weg und die Seitenleiste routet zuverlässig selbst.

Wieder entfernt: `src/fsdebug.ts` samt Aufruf in `main.tsx` und
`public/fstest.html`.

Ebenfalls entfernt — und das ist die eigentliche Lehre aus der Runde: die
Wiedereintritts-Mechanik im Vollbild-Schalter (Tap-Zeitstempel, 1,5-s-Fenster,
erneutes `requestFullscreen()` nach dem Austritt). Sie war für die falsche
Ursache gebaut. Der Mitschnitt belegt bei `/settings → /settings/security`
`pushState` mit durchgehend `fs=html`: client-seitiges Routing beendet das
Vollbild in keiner der drei Engines. Die Mechanik hat also nie etwas bewirkt und
hätte nur so ausgesehen, als sei sie nötig. Zurück bleibt der schlichte
Schalter plus ein `fullscreenchange`-Listener, der Icon und Tooltip führt.

Rückblickend gingen zwei Fix-Runden für eine Ursache drauf, die aus einer
plausiblen, aber ungeprüften Annahme stammte (Chromium-Bug 138324, „pushState
beendet Vollbild"). Widerlegt hat sie erst eine Beobachtung vom Gerät — dass
Settings-Unterseiten den Modus halten, obwohl sie denselben Mechanismus nutzen.
Der Weg dorthin war jedes Mal Messung statt Argument: Marker-Test gegen
Dokument-Load, Ereignis-Mitschnitt mit Zeitstempeln, `exec()` des Routers
direkt befragt.

**Verifikation nach dem Aufräumen:** Kein Debug-Panel mehr im DOM, Schalter
kippt in beide Richtungen (`maximize` ↔ `minimize`), drei Sprünge über die
Seitenleiste ergeben genau drei History-Einträge, Marker überlebt, ein
Navigation-Entry. `pnpm typecheck` sauber. Auslieferung: 105,8 KB gz gegen
256 KB Partition.

## 2026-09-10 — Safe-Area-Padding: Vollbild ohne Rand-Streifen

Nachdem der Vollbild-Schalter am Gerät trug, blieb der kosmetische Rest aus
PLAN.md: unter Chrome und Edge stand oben der Bereich der Statusleiste schwarz,
unter Chrome zusätzlich unten ein schmaler weißer Balken. Ursache ist kein
Fehler im Layout, sondern eine fehlende Erlaubnis — ohne `viewport-fit=cover`
schneidet die Engine das Layout-Viewport an den Systemleisten ab und füllt den
Rest selbst. Die Meta-Angabe in `index.html` ist jetzt gesetzt; damit reicht die
Seite unter die Leisten und muss ihre Inhalte selbst davon freihalten.

Die vier Insets liegen als `--safe-t/-r/-b/-l` in `styles.css` statt als
`env()` direkt an den Utilities. Das kostet eine Indirektion, kauft aber genau
das, woran die Vollbild-Runde davor gescheitert war: die Randfälle sind ohne
Gerät mit Kerbe messbar, indem man die Variablen überschreibt. Dazu `html {
background: var(--bg) }` — mit `viewport-fit=cover` endet das Layout nicht mehr
an der Gestenleiste, und ohne gestrichene Fläche bleibt der Streifen darunter
weiß.

Gepolstert wird nur, was an einer Bildschirmkante klebt, und jede Kante genau
einmal. Die Seitenleiste trägt alle drei Kanten selbst (als überlagernde
Schublade wie als statische Leiste ist sie das äußerste Element). Der
Scroll-Bereich bekommt unten und rechts, links dagegen nur unterhalb von `md:` —
darüber liegt die Leiste links von ihm und hat den Rand schon abgedeckt. Die
Kopfleiste wächst um den oberen Inset (`h-[calc(3rem+var(--safe-t))]` plus
`pt`), bleibt also randlos unter der Statusleiste liegen, während ihre Icons
darunter rutschen. Dazu die vier freistehenden Overlays, die keine Polsterung
von außen sehen können: FAB und Speed-Dial, der Toast-Stapel, das
Meldungs-Panel und das mobile Programm-Bottom-Sheet.

Bewusst ausgelassen: die Dialoge (`fixed inset-0` mit zentriertem Inhalt und
`p-4`) — zentrierter Inhalt gerät nicht unter eine Systemleiste.

**Verifikation** mit gefälschten Insets im Browser (48 px oben, 24 px unten):
Kopfleiste 96 px hoch bei 48 px `padding-top`, das Menü-Icon beginnt bei y=54 —
also sauber mittig im 48-px-Streifen darunter. Seitenleiste offen: oberster
Eintrag bei y=56, unterster mit 32 px Luft nach unten. Scroll-Bereich ganz nach
unten gefahren: 24 px zwischen Inhaltsende und Viewport-Unterkante, Chrome
rechnet die Polsterung des Scroll-Containers also mit. Quer (812×375, 44 px
seitlich): Leiste links um 44 px eingerückt, Scroll-Bereich links bei 0 und
rechts um 44 px — kein doppelter Rand. Die vier Overlay-Klassen einzeln
gemessen: FAB `bottom: 44px` / `right: 36px`, Toast 40/32, Panel `pt 48 / pb 24
/ pr 16`, Sheet `pb 40`.

Der wichtigste Beleg ist der Gegentest: mit echtem `env()` im normalen Tab
lösen alle vier Variablen zu `0px` auf, sämtliche Polsterungen stehen auf 0 und
die Kopfleiste ist wieder 48 px hoch. Außerhalb von Vollbild und
Home-Screen-Fenster ändert sich nichts. `pnpm typecheck` sauber, `pnpm build`
durch, die erzeugten Regeln stehen im gebauten CSS (Tailwind normalisiert
`calc(1.25rem+…)` selbst auf gültige Abstände). Der Beleg am Gerät steht aus
(PLAN.md).

## 2026-09-10 — Sensorgetriggerte Programm-Schritte

Backlog-Punkt aus PLAN.md: ein Schritt endete bisher nur über `holdSec` (Zeit).
Jetzt trägt jeder Schritt einen wählbaren Auslöser — `end: "hold"` (Default,
weggelassen) oder `end: "sensor"` mit einer `Condition` `{ref, op, value, hyst}`
aus `Condition.h` (unverändert von `AlarmStore`/`LogStore` übernommen: gleiche
`conditionFromJson`/`conditionToJson`/`evalCondition` mit Hysterese-Latch). Bei
`sensor` schaltet der Schritt automatisch weiter, sobald der Latch steigt;
`holdSec` wird dann ignoriert. Der Latch (`Step::condActive`) ist Laufzeit, nicht
persistiert, und wird bei jedem Schrittwechsel zurückgesetzt (`resetLatches_`).

Die „Freigabe abwarten"-Checkbox (`confirm`) bleibt unverändert und orthogonal:
sie greift nach dem Auslösen beider Trigger — `hold` + `confirm` ist exakt das
alte Verhalten, `sensor` + `confirm` wartet nach Erreichen der Bedingung auf
`next`. Kein Sicherheits-Timeout für Sensor-Schritte (unbegrenztes Warten,
`next`/`stop` bleiben verfügbar). Keine Migration: `end` fehlt in Altdateien →
`hold`; ältere Firmware auf einer neuen `programs.json` behandelt
`sensor`-Schritte als `hold`.

`ProgramRunner::tick` verzweigt die „Schritt fertig?"-Prüfung nach `end`, sonst
Struktur gleich. Frontend: neue `ProgramStep.end`/`cond`-Felder; die
`{ref, op, value, hyst}`-Form ist als `components/ConditionFields.tsx` aus dem
Alarm-Editor herausgezogen (`refGroups`/`unitOf` nun in `src/refs.ts`, auch vom
Log-Editor genutzt), fällt ohne Snapshot auf ein Freitext-Ref zurück (Profil-
Bibliothek hat keinen SSE-Feed). Programm- und Profil-Schritt-Editor bekommen je
ein Segmented „Zeit / Sensor"; `ProgramCard` zeigt für den aktiven Sensor-Schritt
Ziel + Bedingung + Live-Istwert (`resolveRef`) statt Countdown und lässt
Sensor-Schritte aus der Fortschrittsbalken-Rechnung.

**Verifikation:** `pio run -e esp32dev` grün, `redocly lint` ohne neue Fehler,
`pnpm typecheck`/`pnpm build` grün. E2E am echten Gärlauf steht aus (PLAN.md →
Hardware-Verifikation).

**Nachtrag (Nutzer-Feedback):** Firmware + UI auf `brewcontrol.local`
(LilyGo-S3, COM9) geflasht — bestehendes Programm lädt unverändert (Back-Compat
bestätigt), Programm-Editor zeigt das Sensor-Dropdown live. Danach auffiel:
die Profil-Seite (`/profiles`) zeigte für dieselbe `ConditionFields`-Komponente
nur ein Freitext-Ref-Feld statt des Dropdowns. Ursache war kein Komponenten-
Unterschied, sondern fehlende Prop-Weitergabe — `App()` (`app.tsx`) hält den
Live-`Snapshot` und reicht ihn an `Dashboard`/`DevicesPage`/`LogsPage`/
`AlarmsPage` durch, `ProfilesPage` fehlte dabei. Ergänzt (`app.tsx`,
`ProfilesPage.tsx`); `ProfileEditorModal`/`ConditionFields` brauchten keine
Änderung. `pnpm typecheck`/`pnpm build` grün, per `pnpm dev` gegen
`brewcontrol.local` (`VITE_ESP_HOST` braucht das Schema, `http://…`, sonst
`ENOTFOUND base.invalid`) verifiziert: Profil-Editor zeigt jetzt dasselbe
Dropdown wie der Programm-Editor.

## 2026-09-11 — Multi-Regler-Programme

Backlog-Punkt aus PLAN.md: ein Programmschritt steuert jetzt beliebig viele
Regler und Aktoren statt genau eines Reglers. Das Datenmodell ist in mehreren
Runden mit dem User entstanden (erst feste Spalten, dann Aktoren als Spalten,
am Ende die Map pro Schritt): `targets: {id: befehl}` nennt nur, was der
Schritt ändert, alles andere bleibt unverändert. Der Befehl ist **pro Feld**
`{v?, enabled?, interval?}` — dieselben Felder wie `POST /api/actuators/<id>`;
Anlass war ein Gärtank-Rührer, bei dem ein Programm Schalter, Drehzahl und
Intervall einzeln verstellen können soll. Weitere Entscheidungen: Aktoren
wirken nur bei Schrittbeginn (eine Hopfengabe bei Minute 30 heißt Schritt
teilen), kein implizites Einschalten mehr (der Editor setzt „Ein" beim ersten
Wert in einer leeren Zelle vor), Profile sind eine komplette Vorlage inklusive
Ids (kehrt die Entscheidung vom 04.09. um), Haltezeit wählbar in min/h/d. Ids
sind geräteweit eindeutig (`DynamicItems.cpp:44`), deshalb braucht es keinen
Rollen-Präfix; der Runner löst per `findController`, sonst `findActuator` auf.

**Laufzeit.** Vorwärts (`start`, `next`, Auto-Advance durch Zeit oder Sensor)
setzt nur die eigene Map des Schritts. `prev` und Boot-Resume dagegen stellen
den **zusammengesetzten Stand** der Schritte 0…k her — pro Id und pro Feld der
letzte Wert —, sonst bliebe nach „Zurück" stehen, was der spätere Schritt
geändert hat. Grenze: Werte, die das Programm erst später setzt, kann `prev`
nicht auf den Stand vor dem Programm zurückholen. Ausnahme Pulse-Aktoren
(`ValueKind::Discrete`, `write(N)` hängt N Impulse an): deren `v` ist ein
Ereignis, feuert nur beim ersten Vorwärts-Eintritt pro Lauf (`reachedStep`,
persistiert) und wird nie wiederholt — Hopfen lässt sich nicht zurückholen.
Fehlt eine Id, wartet das Programm wie bisher beim fehlenden Regler; der Scan
über alle Ziele läuft aber erst, wenn ein Schritt fällig ist, weil `tick()` in
jeder Loop-Runde aufgerufen wird.

**Firmware.** Neu `ProgramTargets.h` (header-only, nur ArduinoJson + std,
damit nativ testbar: `readTargets` inkl. Legacy-`setpoint`, `writeTargets`,
`effectiveTargets`) und `ProgramSteps.h/.cpp` (der geteilte Step für
`ProgramRunner` und `ProfileStore` inkl. `end`/`cond`). `ProgramRunner`:
`controller`, `EndMode` und `currentSetpoint` raus, `reachedStep` und
`condActive` rein — der Sensor-Latch aus PR #35 zieht vom Step ans Programm,
weil der Step-Struct jetzt geteilt ist und ohnehin nur der aktuelle Schritt
ausgewertet wird. Neue Pfade `applyCmd_` (Feldreihenfolge des
Actuator-Endpoints: `enabled`, `interval`, `v`; bei Reglern wie bisher erst
Sollwert, dann Schalter), `enterStep_`, `applyState_`. Legacy wird gelesen,
geschrieben wird nur das neue Format: `controller` + `setpoint` →
`{x: {v, enabled: true}}` (genau das alte Verhalten, `start` schaltete den
Regler immer ein), alte Profile ohne Regler → Id `""`, im Programm abgelehnt,
im Profil erlaubt.

**Dabei gefunden und mitbehoben (aus PR #35):** `ProfileStore` kannte
`end`/`cond` nicht und verwarf sie. Ein Sensor-Schritt kam deshalb aus der
Bibliothek als Zeit-Schritt mit `holdSec` 0 zurück und hätte in einem
Programm sofort weitergeschaltet. Root Cause: zwei getrennte Step-Structs,
PR #35 hatte nur den im Runner erweitert. Mit dem geteilten Step ist das
strukturell ausgeschlossen.

**API/Doku.** `openapi.yaml`: neues Schema `StepTarget` (verweist auf
`ActuatorWrite`), `ProgramStep.targets`, `Program.reachedStep`,
`ProgramInput` ohne `controller`, Legacy-Toleranz dokumentiert. Nebenbei die
Doku-Drift aus PLAN.md behoben: eigener Pfad-Parameter `ProgramId`
(`^p_[0-9a-f]{5}$`) statt `HexId` für `/api/programs/{id}` und `/control`,
Create-Response und `Program.id` angeglichen, `currentStep` „0 while idle".

**Frontend.** Neu `src/program.ts` (`targetKind`, `effectiveTargets` als
Spiegel der Firmware-Regel, `fmtTarget`, `HoldUnit` nach dem Muster von
`intervalUnit.ts`) und `components/ProgramStepsEditor.tsx`, der die zwei
duplizierten Schritt-Editoren aus Programm- und Profil-Dialog ersetzt (inkl.
Zeit/Sensor aus PR #35): Spaltenkopf „Steuert" mit Reglern und Aktoren —
Aktoren, die ein Regler als `actuator`/`heatActuator`/`coolActuator` treibt,
waren zunächst ausgeblendet (siehe Nachtrag) —, pro Zelle Schalter „—/Ein/Aus", Wert mit Einheit
(Binary ohne, Pulse als „Impulse") und bei Intervall-Aktoren „an … von …".
`draftProblem()` sagt im Dialog, warum Speichern gesperrt ist. `ProgramCard`
zeigt statt `setpoint°` den zusammengesetzten Stand als Chips (vom Schritt
selbst gesetzt hervorgehoben, geerbt neutral), Impulse mit ✓ sobald gefeuert,
im Kopf „Steuert: …" mit fehlenden Ids. `fmtDuration` ab 24 h als „5 d 03:00",
das trifft auch die Summen auf der Profilseite. `refs.ts` `unitOf` löst jetzt
auch `controller/<id>` über den Sensor des Reglers auf.

**Verifikation.** `pio test -e native` 30/30 (14 neue in
`test_program_targets`: Befehle mit einzelnen/allen Feldern, Reihenfolge,
Legacy mit/ohne Controller, verworfene Werte, kaputtes Intervall,
Round-Trip, zusammengesetzter Stand pro Feld inkl. Impuls-Ausnahme); dafür
bekam `[env:native]` ArduinoJson. `pio run` für `esp32dev` und
`lilygo_t_display_s3_amoled` grün, ohne Warnungen in den geänderten Dateien.
Redocly valide (nur die bekannte `license`-Warnung), `pnpm typecheck` und
`pnpm build` grün. UI im Dev-Server gegen In-Page-Stubs für Snapshot,
Programme und Profile (Gärtank-Szenario mit zwei Reglern, Rührer mit
Intervall, Pulse-Dropper, Binary-Ventil und einer an einen Regler gebundenen
Heizung; nichts ans Board geschrieben): Karte zeigt pro Feld korrekt
zusammengesetzt (Drehzahl aus Schritt 1, Intervall aus Schritt 2), Spalten-
Select blendet belegte Ids und die gebundene Heizung aus, Vorbelegung „Ein"
greift, leere Spalte sperrt Speichern mit Hinweis, gesendeter Body enthält nur
gesetzte Felder und rechnet Tage in Sekunden um, Legacy-Profil erscheint als
ungebundene Spalte (Programm- und Profil-Dialog), „Als Profil speichern"
trägt Spalten und Sensor-Schritt mit, Start/Weiter/Zurück setzen die Chips und
das ✓ wie erwartet; Desktop und 375 px geprüft. Dabei aufgefallen:
`` `${inp} w-NN` `` greift projektweit nicht (`w-full` gewinnt), der neue
Editor nutzt `w-20!` — in PLAN.md eingetragen.

**HW-E2E** am LilyGo (`brewcontrol.local`, 192.168.178.87), Firmware `df07d50`
und UI-Paket per OTA (`/api/update/firmware` 200 in 12 s, `/api/update/assets`
200 in 6 s), Board-Stand vorher in den Scratchpad gesichert. **Migration:** das
echte Alt-Programm „Hermann-Weizen" (7 Schritte, Regler `mash`) kam direkt nach
dem Boot als `targets: {"mash": {"enabled": true, "v": …}}` zurück, Umlaute,
`confirm` und `done`-Status erhalten, `reachedStep` = `currentStep`; die zwei
Alt-Profile als `""`-Spalte. Test-Items ohne GPIO als MQTT-Aktoren am
eingebetteten Broker (Relais Binary, Rührer Continuous mit Intervall 10/20 s,
`TwoPoint`-Regler auf `mlt` mit eigenem MQTT-Heizaktor). Abgelehnt mit
`400 invalid program`: leere Target-Id, Intervall `onSec > periodSec`. Lauf:
Start schaltet Regler/Relais/Rührer ein und setzt 30 bzw. 40 % + 10/20 s;
manuell Sollwert 33, Weiter in den Intervall-Schritt → 33 bleibt, Rührer nur
20/20, Drehzahl und Schalter unverändert; Zurück → 30 und 10/20 wieder da;
Weiter → wieder 20/20, 30 bleibt. **Reboot** mitten im Schritt (manuell vorher
33): danach Regler 30 (Config hätte 20), Relais an (Binary startet sonst aus),
Rührer 40 % + 20/20 (Config 10/20), Restzeit läuft auf der Wanduhr weiter.
Sensor-Schritt (`controller/test_regler > 40`) setzt beim Eintritt 35 und
wartet ohne Countdown, Sollwert 45 → schaltet weiter, der End-Schritt schaltet
Relais und Rührer aus und lässt Drehzahl/Intervall stehen, nach 60 s `done`.
**PR-#35-Fix:** Profil mit Sensor-Schritt (`hyst` 0.002) gespeichert und
zurückgelesen — `end`/`cond` vollständig da, auch nach einem zweiten Reboot,
ebenso die neu geschriebenen `""`-Profile. Die vom Board ausgelieferte UI zeigt
das migrierte Programm („Steuert: mash", „mash 35 °C" pro Schritt), keine
Konsolenfehler. Testartefakte (Programm, Profil, Regler, drei Aktoren) danach
gelöscht; die migrierten echten Daten bleiben. **Nicht am Gerät prüfbar:** der
Impuls-Pfad — `PulseOutput` ist kein dynamischer Aktor-Typ, ein Hopfen-Dropper
lässt sich also bisher gar nicht anlegen (PLAN.md → Backlog). Nach einem Reboot
wird ein `done`-Programm wie bisher nicht erneut angewandt.

**Bekannte Grenzen.** Nach einem Downgrade liest alte Firmware das neue
`programs.json` nicht, die Programme fallen weg. Beim Update erst die Firmware,
dann die UI einspielen: die neue UI wirft beim Rendern eines Programms im alten
Format (`step.targets` fehlt) — im Test mit dem Alt-Programm des LilyGo
gesehen, bevor die Stubs aktiv waren; die neue Firmware migriert beim Laden.

**Nachtrag (Nutzer-Feedback):** `dfsdfdf` auf dem S3 (AnalogOutput/PWM mit
Intervall) tauchte in der Spaltenauswahl nicht auf — der Editor blendete jeden
Aktor aus, den ein Regler treibt (`testpid` hat `actuator: dfsdfdf`), weil der
Regler den Wert sonst überschreibt. Das war zu grob: ein Regler schreibt nur
den Wert, Schalter und Intervall fasst er nie an. Nachgelesen in der Library:
PID und TwoPoint lassen ihren Aktor in Ruhe, solange sie aus sind
(`if (!enabled()) return;`), DualStage und SplitRangePID ziehen Heiz-/Kühlausgang
auch ausgeschaltet jede Runde auf 0 (`writeOff()`). Jetzt bietet der Editor alle
Aktoren an, gesteuerte in einer eigenen Gruppe „Aktoren (von Regler gesteuert)"
mit dem Reglernamen; die Zelle sagt es dazu — bei PID/TwoPoint „der Wert wirkt
nur, solange <Regler> aus ist", bei Heiz-/Kühlausgängen entfällt das Wertfeld
(ein schon gespeicherter Wert bleibt sichtbar). `StepTarget` in der OpenAPI um
denselben Satz ergänzt. Verifiziert per `pnpm dev` gegen das S3 (neue Firmware,
echte Daten, nichts gespeichert): Auswahl zeigt `kettle (mash)` und
`dfsdfdf (testpid)`, die `dfsdfdf`-Zelle Schalter, PWM-Wert, Intervall und den
Hinweis; `pnpm typecheck` grün, Redocly valide. Danach als UI-Paket aufs S3
geladen (`/api/update/assets` 200), Board serviert den neuen Build, Auswahl
und Hinweis am Gerät bestätigt.

**Nachtrag 2026-09-12 — Ablaufsteuerung stand einmal still.** Am Gerät blieb ein
laufendes Programm auf Schritt 1 stehen (60 s Haltezeit, Freigabe eingestellt):
nach 3021 s weiter `running`, kein Schrittwechsel, kein `awaiting`. Nach einem
Reboot lief dasselbe Programm sauber durch alle sieben Schritte und wartete am
Ende korrekt auf die Freigabe. Die Auswertung spricht gegen die Programmlogik
und für einen stehenden loopTask — `stepRemainingSec: 0` zeigt eine gültige Uhr
und abgelaufene Haltezeit, und `GET /api/programs` antwortete sofort, obwohl es
denselben Mutex nimmt wie `tick()`. Details, Verdächtige und die Messung, die
beim nächsten Auftreten **vor** dem Reboot zu machen ist, stehen in PLAN.md →
„Bugs & bekannte Einschränkungen". Auf Wunsch des Users nicht weiterverfolgt.

## 2026-09-12 — Pulse-Aktor anlegbar + `inp`-Breiten-Bug gefixt

**Pulse-Aktor.** `PulseOutputActuator` (Library) war zwar über `ValueKind::Discrete`
im `ProgramRunner` schon vollständig als Impuls-Ziel unterstützt, ließ sich aber
nirgends anlegen. Jetzt als `PulseOutput`-Typ in
`DynamicItems::addActuatorNoBegin()` verdrahtet (`pin`, `pulse_width_ms`,
`gap_ms`, `invert` — snake_case wie die übrigen Typen; kein neuer Include
nötig, `SensActCtrl.h` zieht den Header schon), im `AddItemModal` als
„Pulse (Hopfen-Dropper)" wählbar (GPIO-Pin, Pulsbreite/Pause in ms,
Invertieren-Checkbox), `docs/openapi.yaml`s `ActuatorCreate` um den Enum-Wert
und die beiden neuen Felder ergänzt. Kein Serialisierungs-Sonderfall nötig —
`DynamicItems` persistiert die rohe Config-JSON verbatim. Verifiziert:
Firmware-Compile-Smoke (`esp32dev`, grün), `pnpm typecheck`/`build` grün,
Redocly valide (nur die bekannte `license`-Warnung). Am laufenden LilyGo
(`brewcontrol.local`, echtes „Hermann-Weizen"-Programm currently in Schritt 6,
nicht angefasst) den Dialog geöffnet und einen Test-Aktor über den echten
`POST /api/actuators` angelegt — sauber mit `400 unknown actuator type`
abgelehnt, wie von der noch nicht geflashten Firmware erwartet, kein
Seiteneffekt. Firmware-Flash + der eigentliche Impuls-Test („v" feuert genau
einmal pro Lauf, nicht nach `prev`/`next`/Reboot) stehen noch aus — siehe
PLAN.md → „Hardware-Verifikation offen".

**Nachtrag — HW-Verifikation am LilyGo (2026-09-12).** Firmware
(`lilygo_t_display_s3_amoled`) und UI-Paket per Netzwerk-OTA aufgespielt
(`POST /api/update/firmware` + `/api/update/assets`, beide 200), während das
echte „Hermann-Weizen"-Programm auf Schritt 6 („Freigabe erforderlich") lief —
beide Reboots (Firmware-Flash + ein späterer Test-Reboot) überstand es
unangetastet (`status: awaiting`, `currentStep: 5` vorher/nachher identisch).
Test-Aktor `hop_dropper_test` (GPIO 17, frei — Pins 2/9/6/7/3/11 waren durch
bestehende Items belegt) angelegt: `meta.kind` kam korrekt als `"Discrete"`
zurück, direktes `write(20)` per `POST /api/actuators/<id>` zeigte die
Pulse-Queue sauber abzählend von 19 auf 0 draining. Mit einem echten
Test-Programm (eigener Schritt mit `hop_dropper_test.v=4`, dann Reboot mitten
im Schritt) alle drei Fälle aus PLAN.md bestätigt: (1) Eintritt in den
Impuls-Schritt queued die Pulse genau einmal (`target` sprang auf 4, drainte
dann normal), (2) `prev` gefolgt von `next` zurück in denselben (bereits
`reachedStep`) Schritt queued nichts nach (`target` blieb 0), (3) ein Reboot
mitten im Impuls-Schritt (referenceStep 1, `stepRemainingSec` ~3575 von 3600)
resumed korrekt (`stepRemainingSec` lief weiter, kein Sprung) ohne erneuten
Pulse (`target` blieb über mehrere schnelle Polls direkt nach dem Neustart bei
0). Test-Programm und Test-Aktor danach gelöscht, `GET /api/config` bestätigt
den Gerätestand wieder identisch zu vorher. Der Impuls-Pfad der
Multi-Regler-Programme ist damit vollständig E2E verifiziert — kein offener
Punkt aus PLAN.md „Hardware-Verifikation offen" mehr für diesen Feature-Zweig.

**`inp` `w-full`-Bug.** Die in PLAN.md dokumentierte Ursache (`.w-full` steht
im generierten CSS hinter `.w-20` etc. und gewinnt immer) am Fließband
behoben: `w-full` aus dem gemeinsamen `inp` (`web/src/ui.ts`) entfernt und an
jeder der ca. 130 Aufrufstellen, die volle Breite brauchen, explizit wieder
angehängt — bis auf die Stellen, die ohnehin `flex-1`/`min-w-0 flex-1` nutzen
(Breite kommt dort schon vom Flex-Layout, nicht von `inp`). `AddItemModal.tsx`
definiert `inp` lokal neu (`` `${inpBase} font-mono` ``) — dort genügte eine
einzige Änderung für alle ~69 Stellen der Datei. Die vorher betroffenen Stellen
(`TimePage` `w-56`/`w-48`, `NetworkPage` `w-40`, `LogEditorModal` `w-20`,
`ProgramEditorModal`s „Aus Profil befüllen"-Select `w-48`) greifen jetzt ohne
Änderung an ihrer eigenen Klasse — der `ProgramStepsEditor`-Workaround
(`w-NN!`-Suffix) bleibt unangetastet stehen (funktioniert weiterhin, jetzt nur
redundant). Verifiziert: `pnpm typecheck`/`build` grün; im Dev-Server gegen den
LilyGo (nur GET-Requests, keine Schreibzugriffe) `TimePage` (Zeitzone/NTP-Server
jetzt kompakt statt zeilenfüllend), `NetworkPage` (mDNS-Hostname kompakt),
`LogEditorModal` und `ProfileEditorModal`/Programm-Editor (weiterhin
volle Breite, keine Regression) geprüft.

## 2026-09-12 — Dashboard-UI: vier kleine Fixes

Vier Punkte aus PLAN.md „Bugs & bekannte Einschränkungen" und Backlog in einer
Session erledigt: (1) Programm-Poll in `Dashboard.tsx` von 2000ms auf 1000ms
(Countdown/Slider springen jetzt sekündlich statt im 2s-Takt). (2)
`ControllerCard.tsx` hielt den Setpoint-Input als lokalen State, der nur beim
Mount initialisiert wurde — externe Änderungen (Programm-Schritt setzt neuen
Setpoint, alle 1s per SSE-Snapshot gepusht) kamen nie an, erst ein Seiten-Reload
zeigte den neuen Wert. Fix: `useEffect(() => setSp(setpoint.toString()),
[setpoint])`, analog zum bestehenden Muster in `ActuatorCard.tsx`. (3)
Umbenennen einer Karte (Sensor/Aktor/Regler) läuft in `AddItemModal.tsx` als
Delete+Recreate unter neuer ID — Dashboards referenzieren Mitgliedschaft aber
über die alte ID-Liste, die Karte verschwand dadurch aus allen Dashboards.
`AddItemModal` meldet jetzt bei ID-Änderung `onRenamed(role, oldId, newId)`;
`Dashboard.tsx` ersetzt die alte ID in jedem Dashboard, das sie referenziert,
und persistiert das per `updateDashboard`. (4) Programm-Widget-Spalte war
schmaler als Sensoren/Regler/Aktoren-Spalten (fixe `w-80` neben einem
`flex-1`-Bereich, der selbst nochmal in 3 Spalten geteilt wurde). Äußerer
Container von Flex-Row auf CSS-Grid umgestellt (`lg:grid-cols-4` mit Programm,
sonst `lg:grid-cols-3`; Inhalt nimmt `lg:col-span-3`) — die verschachtelte
3-Spalten-Grid darin ist jetzt exakt so breit wie die Programm-Spalte.
Verifiziert: `pnpm typecheck` grün nach jeder Änderung; (2)-(4) nicht live am
Gerät getestet (kein Dev-Server mit echten Snapshot-Daten in der Session).

## 2026-09-12 — Bestätigungsdialog beim Umschalten fremdgesteuerter Aktoren/Regler

Backlog-Punkt umgesetzt: der Toggle auf Aktor- und Regler-Card schaltete bisher
sofort um, auch wenn ein aktiver Regler oder ein laufendes Programm das Item
gerade steuert — der manuelle Vorgang wurde dann im nächsten Tick wieder
überschrieben, ohne dass die UI das kommunizierte.

**Ownership-Erkennung** (neu, `web/src/ownership.ts`): weder Aktor noch Regler
tragen im Wire-Format einen Besitzer-Verweis — `controllerOwnerOf()` scannt
`params.actuator`/`heatActuator`/`coolActuator` aller Regler (gleiche Logik wie
das bestehende `drivenBy` in `ProgramStepsEditor.tsx`, hier isoliert für
Wiederverwendung), `programOwnerOf()` nutzt das vorhandene `programIds()` aus
`program.ts` gegen alle Programme mit Status `running`/`awaiting`/`paused`. Ein
deaktivierter Regler bzw. ein `idle`/`done`-Programm zählt nicht als Besitzer —
dann bleibt das Toggle-Verhalten unverändert.

**UI:** `ToggleSwitch` bekommt eine `mixed`-Prop, die den Knopf unabhängig vom
Schaltzustand mittig zeigt (Mittelstellung als Fremdsteuerungs-Indikator, wie
vom User vorgeschlagen). `ConfirmModal` um einen optionalen dritten Button
(`extraLabel`/`onExtra`) erweitert — additiv, alle 16 bestehenden binären
Aufrufstellen unverändert. `ActuatorCard`/`ControllerCard`: Toggle-Klick bei
aktivem Besitzer öffnet den Dialog statt direkt zu schalten (Abbrechen / nur
schalten / schalten + Besitzer deaktivieren-pausieren — Regler via
`enableController(id, false)`, Programm via `controlProgram(id, 'pause')`,
beide Endpoints bereits vorhanden). `Dashboard.tsx` reicht `controllers`/
`programs` an die Cards durch.

**Verifikation:** `pnpm typecheck` grün. Live gegen das LilyGo-S3-Testboard
(`brewcontrol.local`) im Browser-Pane: das laufende „Hermann-Weizen"-Programm
zeigte den Regler `mash` (Programmziel, Status `awaiting`) und den von `mash`
getriebenen Aktor `IDS1` (Controller-Ziel) beide mit Mittelstellung und
korrektem Dialogtext; „Abbrechen" ändert nichts, „Aktor schalten" schaltet
`IDS1` ohne den Regler anzufassen (per `aria-checked`/Titel-Attribut
bestätigt), danach wieder zurückgeschaltet — Board am Ende unverändert.
Ungeteste Aktoren/Regler ohne Besitzer zeigten weiterhin die normale
Links/Rechts-Stellung ohne Dialog.

**Nachtrag (Nutzer-Feedback):** der Extra-Button-Text ("Aktor schalten und
Regler deaktivieren") umbricht in der 3-Spalten-Gleichbreite des
`ConfirmModal`-Footers zu oft — Fix noch offen, siehe PLAN.md.

## 2026-09-12 — Dashboard: Regler über Programm-Widget, Grid-Reflow, größerer Chart

Backlog-Punkt „Sensor-/Aktor-/Controller-Grid: Anordnung überarbeiten" umgesetzt,
ausgelöst durch Nutzer-Feedback: ein einem Programm zugeordneter Regler (z. B.
`mash`, Ziel von „Hermann-Weizen") stand bisher getrennt vom Programm-Widget
unten im Regler-Grid, obwohl beide zusammengehören.

**`Dashboard.tsx`:** pro Programm wird jetzt der erste Regler, den es
referenziert (`programIds()`-Reihenfolge, wiederverwendet aus `program.ts`),
über statt neben dem zugehörigen `ProgramCard` gerendert — unabhängig vom
Laufstatus (auch idle/done), nur einmal vergeben falls mehrere Programme
denselben Regler referenzieren. Die bisherige `Column`-Gruppierung
(Sensoren/Regler/Aktoren als drei betitelte Spalten) ist aufgelöst: ein
einziges Grid rendert alle verbleibenden Karten (Sensoren → restliche Regler →
Aktoren) ohne Kategorie-Überschriften/Zähler und füllt Zeilen horizontal.

**Chart nutzt den Platz, den das aufgelöste Grid freigibt:** der
Hauptinhaltsbereich ist auf Desktop (`lg:`) eine Flex-Column mit voller Höhe;
der Chart-Bereich wächst per `flex-1`, das Karten-Grid bleibt `shrink-0` und
landet dadurch automatisch am unteren Rand. `ChartCard` bekommt eine neue
`fill`-Prop: ein `ResizeObserver` misst die vom Flex-Layout zugewiesene Höhe
und ruft darüber `setSize()` (kein Re-Fetch der Log-Daten bei reinem Resize).
Nur auf Desktop aktiv (`matchMedia('(min-width: 1024px)')`, dieselbe
Bedingung, die `ProgramCard` schon für den mobilen Fixed-Sheet-Check nutzt) —
mobil bleibt der Chart bei fester Höhe (240px) im normalen Dokumentfluss.
`LogsPage`/`ArchivePage` übergeben `fill` nicht und bleiben unverändert.

**Debugging-Fund unterwegs:** die erste Fassung ließ den Chart auf ~10.000px
wachsen — ein Resize-Feedback-Loop, weil dem Chart-Karten-`div` selbst
`lg:min-h-0` fehlte (Default `min-height:auto` verhindert das Schrumpfen auf
den vom Flex-Elternteil zugewiesenen Platz). Zweiter Fund: die „Kochen"-
Dashboard-Config referenziert einen längst gelöschten Log (`charts: ["42b70a"]`,
keine passende `logs`-Eintrag) — vorher harmlos (leere `space-y-4`-Box), nach
der Umstellung riss das dieselbe `min-h-[240px]`+`flex-1`-Fläche auf. Fix:
`Dashboard.tsx` filtert `activeDash.charts` jetzt zuerst gegen `logs` auf
tatsächlich vorhandene Einträge (`chartLogs`) und rendert den Chart-Bereich nur
dann, wenn davon mindestens einer übrig bleibt.

**Verifikation:** `pnpm typecheck` grün. Live gegen `brewcontrol.local` im
Browser-Pane geprüft: „Maischen" (Programm `awaiting`, Regler `mash` oben,
größerer Chart, Rest-Grid darunter), „Gärung" (Programm `idle`/„Bereit", Regler
`testpid` steht trotzdem oben — bestätigt „immer", nicht nur bei aktivem
Programm), „Kochen" (kein Programm, dangling Chart-Referenz — Grid oben ohne
Lücke). Fenstergröße 900px hoch vs. Standard: Chart-Höhe wuchs messbar mit
(229px → 361px). Mobile (375×812): Regler-Karte im normalen Fluss oben, Chart
feste Höhe, Programm-Karte weiterhin als Fixed-Bottom-Sheet, Rest-Grid
einspaltig — keine Regression. `LogsPage` (`/settings/logs`) unverändert mit
fester Chart-Höhe geprüft.

**Nachtrag (Nutzer-Feedback):** die uPlot-Legende ragte im Fill-Modus über den
unteren Kartenrand hinaus — `height` ist bei uPlot nur die Plot-/Achsenfläche,
die Legende kommt als eigene Zeile obendrauf, `el` hat im Fill-Modus aber eine
fixe CSS-Höhe (`h-full`), die beides fassen muss. Fix in `ChartCard.tsx`: die
tatsächlich gerenderte `.u-legend`-Höhe wird vor jedem `setSize()` gemessen und
von der Zielhöhe abgezogen (`fillHeight()`); da die Legende beim allerersten
Erstellen noch nicht existiert, folgt direkt nach `new uPlot(...)` ein
einmaliger Korrektur-Resize. Verifiziert bei zwei Fensterhöhen (900px und
700px) — Legende endet jeweils exakt an der Karten-Innenpadding-Kante, kein
Überstand mehr.

## 2026-09-12 — Regler-Card: kombinierter Ist/Soll-Slider + Regelbereich

Backlog-Punkt „Neues Regler-Design: Slider inkl. Sensorwert und Setpoint"
umgesetzt (linear; die zirkuläre Variante bleibt offen, siehe PLAN.md),
ausgelöst durch Nutzer-Wunsch nach einem Slider statt Zahlenfeld+Apply für
den Sollwert. Per Screenshot + Rückfragen geklärtes Interaktionskonzept: ein
Slider pro Regler, ein weißer Rundknopf = Sollwert (ziehbar), Track-Füllung
rot wenn Istwert < Sollwert (heizt noch), blau wenn darüber; Istwert selbst
nur als Text, kein eigener Marker. Sollwert-Text ist klickbar editierbar
(ersetzt Zahlenfeld+Apply). Der neue weiße-Knopf-Stil ist auch auf die
bestehenden Aktor-Slider (`ContinuousSlider`, `IntervalSlider`) übertragen.

**Neues Feld „Regelbereich" (`rangeMin`/`rangeMax`):** die Slider-Skala
sollte einstellbar sein, nicht starr an den Sensor-Messbereich gekoppelt.
Da SensActCtrl keinen festen `ControllerParams`-Struct hat (jeder
Controller-Typ baut `paramsJson()` von Hand), wanderte das neue Feld analog
zum bestehenden `enabled_`-Muster in die `Controller`-Basisklasse: privates
Feld-Paar + virtuelle `setRange()`/`rangeMin()`/`rangeMax()` mit
Default-Implementierung (`core/Controller.h`) — keine Änderung an den vier
Konstruktoren nötig, nur `paramsJson()` in `PIDController`/`TwoPointController`/
`DualStageController`/`SplitRangePIDController` um `rangeMin`/`rangeMax`
erweitert. Sentinel für „nicht gesetzt": `rangeMax <= rangeMin` (Default
0/0) — kein NaN in JSON, keine zusätzliche Bool-Flag. `DynamicItems.cpp`
ruft `concrete->setRange(...)` einmalig direkt nach dem Bauen der konkreten
Instanz, vor einem eventuellen `RateLimitedController`-Wrap (dessen
`paramsJson()` bettet das innere JSON ohnehin per `%s` ein — rangeMin/Max
erscheinen dadurch automatisch). Naming-Konvention wie bei `heat_actuator`/
`heatActuator` übernommen: `range_min`/`range_max` (Creation-Body,
snake_case) vs. `rangeMin`/`rangeMax` (Snapshot/Params, camelCase). Rein
additiv, keine SD-Migration nötig.

**Frontend:** neue geteilte `Slider`-Komponente (`components/Slider.tsx`) —
bleibt ein natives `<input type="range">` (Tastatur/Touch/A11y gratis), nur
Thumb/Track per CSS umgestylt (`.range-slider` in `styles.css`, weißer
Rundknopf statt `accent-color`), Füllfarbe per inline Gradient (Standardtrick,
da CSS allein „Füllung bis zum Thumb" bei nativen Range-Inputs nicht kann).
`ControllerCard.tsx` nutzt sie mit Fallback-Kette `params.rangeMin/Max` →
`linkedSensor.meta.min/max` → `0/100`. `AddItemModal.tsx`: neues
Formularfeld-Paar „Regelbereich" im typ-übergreifenden Controller-Block
(gilt für PID/TwoPoint/DualStage/SplitRangePID gleichermaßen), Platzhalter
zeigt den Messbereich des gewählten Sensors als Vorschlag, leer gelassen →
Feld wird nicht mitgesendet (Server-Default 0/0 → Sensor-Fallback greift).

**Verifikation:** `pio test -e native` (SensActCtrl) grün, 197 Tests inkl.
neuer `rangeMin`/`rangeMax`-Assertion in `test_pid.cpp`. `pio run -e esp32dev`
(BrewControl-Firmware) kompiliert. `npx @redocly/cli lint` gegen
`openapi.yaml` grün (`ControllerCreate.range_min/max`,
`ControllerParams.rangeMin/rangeMax` ergänzt). `pnpm typecheck` grün. Im
Browser-Pane gegen den `pnpm dev`-Mock geprüft: Slider-Drag ändert Farbe
live rot↔blau je nach Ist/Soll-Verhältnis, Klick auf den Sollwert-Text macht
ihn editierbar, Aktor-Slider (`ActuatorCard`) zeigen denselben weißen Knopf.
**Einschränkung:** der Dev-Mock-Server kennt `range_min`/`range_max` nicht
(eigene simulierte Params, keine echte Firmware) — dass das Feld tatsächlich
über `POST /api/controllers` persistiert und im Snapshot zurückkommt, ist
damit nicht end-to-end geprüft; siehe PLAN.md → Hardware-Verifikation offen.

**Nachtrag (Nutzer-Feedback, gleicher Tag):** die erste Fassung füllte den
Track bis zum Knopf (Sollwert) statt bis zum Istwert — der Knopf sollte laut
Vorgabe unabhängig vom farbigen Balken stehen, der Balken zeigt nur, wo der
Istwert im Regelbereich liegt. Zusätzlich fühlte sich das Ziehen "hakelig"
an. Root Cause für beides: `Slider` reichte jeden `onInput`-Tick des Drags
per `setSp()` bis in `ControllerCard` hoch — das ließ die ganze Karte
(ToggleSwitch, ConfirmModal, Ist/Ausgang-Zeile, …) bei jedem Maus-Pixel neu
rendern, und die Track-Füllung war direkt an den gezogenen Wert gekoppelt.
Fix in `Slider.tsx`: das Dragging bleibt jetzt vollständig lokal in der
Komponente (`useState`/`useEffect` wie schon in `ActuatorCard`s
`ContinuousSlider` vorgemacht) — nur das native `change`-Event (feuert genau
einmal, beim Loslassen) reicht per `onChange` nach oben durch, `onInput` ist
optional und wird von `ControllerCard` gar nicht mehr genutzt. Neue
`fillValue`-Prop entkoppelt die Balkenfüllung vom Thumb-Wert: die farbige
Leiste liegt jetzt als eigenes `position:absolute`-Div hinter einem
Track-transparenten `<input>`, `ControllerCard` übergibt dafür den Istwert
des Sensors, `ActuatorCard`s Slider lassen `fillValue` weg (Fallback = eigener
Wert, unverändertes Verhalten). Verifiziert im Browser-Pane: Balken folgt dem
Istwert unabhängig vom Knopf, Drag fühlt sich nativ/flüssig an, Sollwert-Text
und Farbe aktualisieren erst nach dem Loslassen (kein Netzwerk-Call während
des Ziehens mehr).

**Zweiter Nachtrag (gleicher Tag):** der weiße Knopf lag unter dem farbigen
Balken (Div mit `position:absolute` stapelt über dem nicht-positionierten
nativen `<input>`, unabhängig von der DOM-Reihenfolge) — Fix: `<input>`
bekommt selbst `position:relative`, damit beide Kinder im selben positionierten
Stacking-Kontext liegen und die DOM-Reihenfolge (Input nach dem Fülldiv)
gewinnt.

**Dritter Nachtrag:** trotz der lokalen Drag-State-Isolation blieb das Ziehen
weiter hakelig. Root Cause: der Regler in der Demo wird aktiv von einem
laufenden Programm gesteuert und ändert `setpoint` autonom im Sekundentakt
(beobachtet: Tausende Setpoint-POSTs, ganz ohne eigene Interaktion). Jede
externe `setpoint`-Änderung lief über `ControllerCard`s
`useEffect(() => setSp(setpoint.toString()), [setpoint])` in einen neuen
`value`-Prop an `Slider`, dessen eigener Resync-`useEffect` den lokalen
Drag-Wert mitten im Ziehen überschrieb — der Knopf sprang dadurch unter dem
Cursor auf den zuletzt bekannten Serverwert. Fix in `Slider.tsx`: ein
`dragging`-Ref, gesetzt via `onPointerDown` (deckt Maus/Touch/Pen einheitlich
ab) und zurückgesetzt via `onChange`/`onBlur`; der Resync-Effekt überspringt
`setLocal(value)`, solange `dragging.current` true ist. Betrifft nur
`Slider.tsx`, keine anderen Dateien. Verifikation war ungewöhnlich aufwändig:
synthetische `dispatchEvent('input', …)`-Tests in der Konsole lösten dabei
selbst ein natives `change` aus (Browser-Eigenheit bei nicht-getrusteten
Events auf `<input type=range>`, imitiert keinen echten Drag) und erzeugten
irreführende Fehlsignale — verifiziert wurde am Ende mit echten, getrusteten
Maus-Drags (`left_click_drag`): Regler-Slider landet exakt auf dem
gezogenen Wert trotz der ständigen Hintergrund-Updates des Demo-Programms,
Aktor-Slider (`IDS1`) weiterhin unverändert korrekt.

**Vierter Nachtrag:** Nutzer meldet weiterhin Springen beim Ziehen — auch bei
`testpid`, dessen `setpoint` nachweislich stabil ist (3× über 4s unverändert
per `/api/snapshot` geprüft), was die Autonomous-Churn-Erklärung aus dem
dritten Nachtrag widerlegt. Zu Recht eingewandter Einwand: ein echter,
handgeführter Maus-Drag unterscheidet sich von einem skriptgesteuerten
(egal ob synthetisches `dispatchEvent` oder CDP-`left_click_drag`) —
Letzterer generiert vermutlich nur wenige Zwischenpunkte statt der vielen
Events eines echten, oft nicht perfekt horizontalen Drags. Neue Hypothese:
verlässt der Cursor während eines echten Drags kurz die (nur 18px hohe)
Slider-Box, kann der Browser vorzeitig ein natives `change`-Event feuern,
obwohl die Maustaste noch gedrückt ist — bis jetzt hing das Zurücksetzen von
`dragging.current` an genau diesem `change`, wodurch der anschließende
Server-Roundtrip den Knopf mitten im (physisch noch laufenden) Drag
zurückgesetzt hätte. Fix: `dragging.current` hängt jetzt an
`onPointerUp`/`onPointerCancel` statt an `onChange` — `change` löst weiterhin
den Commit aus, beendet aber nicht mehr die Drag-Guard. **Nicht abschließend
verifiziert:** eigene Versuche, einen Drag außerhalb der Slider-Box per
`left_click_drag` zu simulieren, lieferten kein eindeutiges Bild (CDP
repliziert offenbar kein echtes Pointer-Capture-Verhalten).

**Fünfter Nachtrag:** Nutzer lieferte den entscheidenden Beleg — Chrome DevTools
Network-Tab zeigt beim Ziehen Dutzende `setpoint`-POSTs pro Sekunde. Damit
widerlegt: das native `change`-Event feuert in Chrome für `<input
type="range">` beim Maus-Drag **nicht** einmalig bei Loslassen (wie MDN nahelegt
und wie in den vorherigen Nachträgen angenommen), sondern fortlaufend während
des gesamten Ziehens — das erklärte sowohl den Netzwerk-Flood als auch das
Springen (jeder dieser Zwischen-Commits ging über `applySp()` zurück an den
Server und kam als neuer `setpoint`-Prop wieder rein). Nutzer schlug direkt den
richtigen Fix vor: Senden strikt an `pointerup` koppeln, nicht an `change`.
Umsetzung in `Slider.tsx`: `onInput`/`onChange` fassen `local`/`localRef` nur
noch lokal an, ein `commit()` (dedupliziert gegen den zuletzt gesendeten Wert
via `lastSent`-Ref) läuft ausschließlich über `onPointerUp` — `onChange` bleibt
nur als Fallback für den Tastatur-Pfad (Pfeiltasten ohne Pointer-Events) und
ist dabei durch `if (!dragging.current)` gegen doppeltes Senden nach einem
bereits erfolgten Pointer-Commit abgesichert. Verifiziert: bei einem
CDP-Drag (`left_click_drag`) läuft jetzt genau 1 `setpoint`-POST statt vieler,
Wert landet weiterhin exakt auf der gezogenen Position. Ob damit auch das vom
Nutzer gemeldete Netzwerk-Flooding bei echter Maus vollständig behoben ist,
steht noch aus — muss der Nutzer selbst mit echter Maus/DevTools
gegenprüfen, da CDP das reale `change`-Verhalten dieses Chrome/OS nicht
zuverlässig nachstellt (siehe vierter Nachtrag).

**Sechster Nachtrag:** Netzwerk-Flood war behoben, aber der Knopf sprang
weiterhin gelegentlich ("jedes zweite Mal") auf den vorherigen Wert zurück —
zusätzlich der Wunsch, den Sollwert beim Ziehen auch live im Textfeld zu
sehen (bisher erst nach dem Loslassen, seit dem dritten Nachtrag). Root
Cause des Zurückspringens: `ControllerCard.tsx`s Slider-`onChange`
(`(v) => { setSp(v.toString()); applySp(); }`) rief `applySp()` im selben
Tick wie `setSp()` auf — `applySp()` las `sp` aber aus dem **alten**
Closure (der State-Update von `setSp` wird erst beim nächsten Render
wirksam), schickte also nicht den frisch gezogenen Wert an den Server,
sondern den vorherigen. Traf der nächste Snapshot-Poll exakt in dem
Zeitfenster ein (abhängig von Float-Serialisierungs-Jitter, daher nur
gefühlt "jedes zweite Mal"), sprang der ControllerCard-`useEffect`
(`setSp(setpoint.toString())`) auf diesen alten Wert zurück. Fix:
`applySp(v?: number)` nimmt den Wert jetzt optional als Parameter, Slider-
`onChange` reicht ihn direkt durch (`applySp(v)`) statt sich auf den
Closure-`sp` zu verlassen; der Text-Input-Pfad (Enter/Blur) ruft weiter ohne
Argument auf (dort ist `sp` nicht veraltet, da Tippen über mehrere Render-
Zyklen läuft). Live-Textfeld-Update beim Ziehen wieder ergänzt: Slider
bekommt jetzt zusätzlich `onInput={(v) => setSp(v.toString())}` — rein
lokale State-Änderung, kein Netzwerk-Call, da nur `onChange` (nach wie vor
strikt an `pointerup` gekoppelt) tatsächlich sendet. Verifiziert: drei
aufeinanderfolgende Drags im Browser-Pane, per instrumentiertem `fetch` der
tatsächlich gesendete Wert mit dem angezeigten verglichen — stimmte jedes
Mal exakt überein, kein Zurückspringen auch nach 2s Wartezeit (Snapshot-Poll
sollte da längst durch sein).

## 2026-09-13 — Timer-Widget (Backlog-Punkt umgesetzt)

Freistehende Kitchen-Timer für Brau-Timings (Hopfengaben, Rührintervalle,
Rasten außerhalb eines Programms) — server-persistiert (übersteht Reboot und
Browser-Reload) und mit Push-Benachrichtigung beim Ablaufen, analog zum
bestehenden Programm-Feature. Ursprünglich als „Timer-Gruppe" mit mehreren
benannten Timern pro Widget geplant; nach Rückfrage stellte sich heraus, dass
einzelne, eigenständige Timer-Elemente gewünscht waren (wie Sensor-/Aktor-
Karten) — Gruppierung ersatzlos verworfen, dadurch entfielen auch die Fragen
nach ID-Eindeutigkeit über Gruppen hinweg und einem Pro-Timer-Notify-Flag
(jeder Timer benachrichtigt immer, ohne Opt-out).

**Firmware:** Neue Komponente `TimerStore.h/.cpp`, 1:1 nach dem Vorbild von
`ProgramRunner` — flache Liste von `{id, name, durationSec, status,
startedEpoch, elapsedAtPauseSec}`, wall-clock-epoch-basierte Persistenz nach
`/config/timers.json`, NTP-Gate (`nowEpoch > 946684800L`) wie bei
Programmen/Logs. `control()` kennt `start|pause|resume|stop` — kein `reset`
als eigene Action, da es mit `stop` identisch gewesen wäre (Redundanz beim
Implementieren aufgefallen und ersatzlos gestrichen). Neue Routen
`GET/POST /api/timers`, `POST/DELETE /api/timers/<id>`,
`POST /api/timers/<id>/control`, exakt nach dem `/api/programs`-Muster.
Ablauf feuert `AlarmStore::onTimerExpired` (neuer `AlertKind: timer`), darüber
`PushService::describe_` mit „Timer abgelaufen" — Kette 1:1 von
`onProgramStatus`/„Programm fertig" gespiegelt. `DashboardConfig` um
`timers: string[]` erweitert (`DashboardStore`, `types.ts`, `openapi.yaml`).

**Frontend:** `fmtDuration()` aus `ProgramCard.tsx` nach neuem
`web/src/format.ts` extrahiert (jetzt auch von `ProfilesPage.tsx` importiert).
Neue `TimerCard.tsx` (Card-Shell/Badge/Progressbar-Idiom wie `SensorCard`/
`ProgramCard`), im normalen Item-Grid neben Sensor-/Aktor-/Regler-Karten
platziert (kein eigener Spalten-/Bottom-Sheet-Sonderfall wie beim
Programm-Widget, da ein Timer nichts „claimt"). `Dashboard.tsx` pollt
`GET /api/timers` im 1s-Intervall, unabhängig von der SSE-Snapshot (gleiche
Begründung wie bei Programmen).

**Nachtrag (selber Tag):** Erste Version legte Timer über ein Inline-Formular
in `DashboardContentModal.tsx` an (Name + Minuten, kein Rename-Fluss). Zwei
Nutzer-Rückmeldungen dagegen: (1) Klick auf „Anlegen" tat sichtbar nichts —
Root Cause: das an diesem Gerät laufende `pnpm dev` proxied gegen ein echtes,
noch nicht neu geflashtes Board, `POST /api/timers` lief dort ins Leere
(404); `createTimer()` wurde aber `await`-los aufgerufen, die verworfene
Promise schluckte den Fehler komplett, ohne jede UI-Rückmeldung. (2) Wunsch
nach einem eigenen Modal statt Inline-Formular, um später weitere
Timer-Einstellungen unterzubringen. Fix: neue `TimerEditorModal.tsx` (Create
**und** Edit, Muster wie `NameModal`/`LogEditorModal`) — der Submit-Handler
awaitet `onSave` jetzt selbst und zeigt einen Fehlertext im Dialog, statt ihn
verschluckt als unhandled rejection verschwinden zu lassen. Damit auch der
Bearbeiten-Stift auf `TimerCard` verdrahtet (`openEditTimer`) — die zuvor als
bewusste Lücke vermerkte fehlende Rename/Dauer-Änderung ist damit erledigt,
kein separater PLAN.md-Eintrag mehr nötig. `DashboardContentModal.tsx`
behält nur noch die Checkbox-Auswahl bestehender Timer; „+ Neuen Timer
erstellen" öffnet jetzt das neue Modal (`onNewTimer`), analog zu „+ Neues
Programm erstellen". Im Browser gegen das reale (alte) Gerät nachgestellt:
Klick auf „Erstellen" zeigt jetzt sichtbar „Error: 404 Not Found" im Dialog
statt schweigend nichts zu tun.

**Verifiziert:** `pio run -e esp32dev` (Compile-Smoke, Flash 84.0%/RAM 18.2%),
`pio test -e native` (30/30 grün, unverändert — `TimerStore` selbst ist wie
`ProgramRunner` nicht nativ testbar, da es an Arduino/FreeRTOS/`SdLock`
hängt), `npx @redocly/cli lint` (grün), `pnpm typecheck` (grün), Fehlerpfad
im Browser gegen ein echtes (noch altes) Gerät nachgestellt. Der eigentliche
Funktionspfad (Timer anlegen und laufen lassen) steht noch aus — braucht ein
mit dieser Firmware neu geflashtes Board, siehe PLAN.md → Hardware-
Verifikation offen.

**Zweiter Nachtrag (selber Tag) — Hardware-E2E abgeschlossen:** LilyGo
T-Display-S3-AMOLED (COM9) geflasht. `pio run -t upload` scheiterte erst
zweimal mit „No serial data received" / „Unable to verify flash chip
connection" — deterministisch reproduzierbar, kein Flackern, deckt sich mit
der schon dokumentierten TinyUSB-CDC-Instabilität dieses Boards unter
Windows (siehe `BrewControl/CLAUDE.md`). Auch mit fest gepinntem
`upload_speed = 115200` (umgeht den sonst separaten „Changing baud rate"-
Schritt) kam die Verbindung nicht zuverlässig durch — der Nutzer hat
stattdessen manuell geflasht (BOOT gehalten + RESET angetippt, danach lief
der Upload durch). Die testweise ergänzte `upload_speed`-Zeile in
`platformio.ini` danach wieder entfernt, da sie das eigentliche Problem
nicht löste und nichts zur Sache tut.

Nach dem Flash lief das aktive Maischeprogramm (`Verzuckerungsrast`-Schritt)
nahtlos weiter — Beleg, dass `ProgramRunner`s Epochen-Persistenz auch einen
durch uns ausgelösten Neustart mitten im Lauf sauber übersteht, nicht nur
einen Stromausfall.

**Timer-Funktionstest am Gerät:** Über das Dashboard einen Timer „hopfengabe"
angelegt (Fehler aus dem ersten Nachtrag damit implizit miterledigt — Nutzer
bestätigte „funktioniert alles"), Start/Pause/Stop im Browser gegen das
Live-Gerät durchgeklickt, Countdown lief sichtbar.

**Push-Benachrichtigung:** vom Nutzer eigenständig geprüft, funktioniert.

**Reboot-Test (API-getrieben, ohne Board-Zugriff):** Timer per
`POST /api/timers/{id}/control {"action":"start"}` gestartet (`durationSec`
60, `startedEpoch` notiert), nach ~8 s per `POST /api/network
{"hostname":"brewcontrol"}` einen sicheren Reboot ausgelöst (ändert keine
WLAN-Daten, siehe Test-Boards-Memo), Gerät nach ~2 s wieder erreichbar.
**Beleg für einen echten Neustart:** `state.t` (millis seit Boot) aller
Sensoren/Aktoren im Snapshot lag bei ~40000 (40 s) statt der Stunden an
Laufzeit, die die Session vorher schon lief. `startedEpoch` blieb über den
Reboot hinweg unverändert; `remainingSec` fiel kontinuierlich nach
Wall-Clock (60→45→36→0), keine Rücksetzung auf `durationSec`, kein Einfrieren
— der Timer landete exakt zur richtigen Zeit auf `done`. Maischeprogramm und
Regler/Aktor-Zustand kamen ebenfalls unauffällig zurück. Damit sind beide
zuvor offenen Hardware-Verifikationspunkte (Reboot-Überleben, Push) erledigt
— Eintrag aus `PLAN.md` → Hardware-Verifikation entfernt.

## 2026-09-13 — Timer-Erweiterung: Uhrzeit-Modus, Start/Stop-Aktion, Wiederholen

Der freistehende Timer konnte bisher nur ablaufen und eine Push-Meldung
auslösen. Auf Wunsch erweitert um: (1) statt einer reinen Dauer auch eine
Zieluhrzeit einstellbar (`mode: duration|clock`, `timeOfDay: "HH:MM"`) —
praktisch fürs automatische Vorheizen zum Brautag-Start; (2) eine optionale
Start/Stop-Aktion auf einen Aktor, Regler oder ein Programm bei Ablauf
(`onExpire: {targetType, targetId, action}`); (3) Wiederholen, das im
Uhrzeit-Modus driftfrei auf „morgen selbe Zeit" rearmt und im Dauer-Modus
dieselbe Dauer erneut abzählt.

**Architektur:** `durationSec` bleibt die einzige Laufzeitgröße — im
Uhrzeit-Modus wird sie bei jedem Start/Rearm frisch aus `timeOfDay` berechnet
(`TimerSchedule.h`, neu, reine C++-Helfer analog `ProgramTargets.h`, nativ
getestet). Die Aktion feuert direkt in `TimerStore::tick()` gegen
`Registry`/`ProgramRunner` (dafür deren Referenzen neu in die Signatur
aufgenommen, ein Zeilen-Change am Aufrufer in `WebUI.cpp`) — das muss auch
ohne offenen Browser funktionieren. Locking geprüft: kein Deadlock-Pfad, da
weder `ProgramRunner` noch `Registry`/`Actuator`/`Controller` zurück in
`TimerStore` rufen, exakt das Muster, das `WebUI::tick()` mit
`programs_.tick(reg_, ...)` schon lebt.

**Umgesetzt:** `TimerStore.h/.cpp`, neue `TimerSchedule.h` + native Tests
(`test_timer_schedule`, 7 Fälle inkl. Mitternachts-Übergang und „exakter
Treffer rollt vollen Tag"), `WebUI.cpp` (Tick-Aufruf), `openapi.yaml`
(`TimerMode`, `TimerExpireAction`, erweiterte `TimerInput`/`Timer`-Schemas,
korrigierte Endpoint-Beschreibung), `types.ts`/`api.ts`,
`TimerEditorModal.tsx` (Dauer/Uhrzeit-Segmented, Wiederholen-Checkbox,
Aktion-Picker für Aktor/Regler/Programm mit Start/Stop), `TimerCard.tsx`
(Uhrzeit-Anzeige, Repeat-Icon, Aktionszeile). Abwärtskompatibel: alte
`timers.json`-Einträge ohne die neuen Felder laden über dieselben
`|`-Defaults wie bisher als normale Dauer-Timer.

**Verifikation:** `pio test -e native` (37/37, inkl. neuer
`test_timer_schedule`-Suite), `pio run -e esp32dev` + `-e
lilygo_t_display_s3_amoled` kompiliert, `npx @redocly/cli lint` sauber,
`pnpm typecheck` + `pnpm build` sauber.

**Hardware-E2E am LilyGo T-Display-S3-AMOLED (`brewcontrol.local`,
192.168.178.87, reine Testumgebung ohne reale Aktoren):** neue Firmware
geflasht (`pio run -e lilygo_t_display_s3_amoled -t upload --upload-port
COM9`, lief ohne manuellen BOOT/RESET-Eingriff durch — anders als beim S2
Mini nicht nötig). Danach per `curl` gegen die echte API getestet:
- Alter Timer „hopfengabe" (vor dem Feature angelegt, ohne `mode`/`repeat`/
  `onExpire` in `timers.json`) lädt nach dem Flash weiterhin korrekt als
  normaler Dauer-Timer — Abwärtskompatibilität bestätigt.
- Uhrzeit-Timer mit `onExpire` auf „Riptide Pumpe" (start), Ziel 2 Min. in der
  Zukunft: `durationSec` exakt korrekt aus der Ziel-Uhrzeit berechnet (80 s bis
  19:14 Uhr, real UTC+2 via Settings), nach Ablauf schaltete die Pumpe live um
  (`enabled:false→true`, `state.v:0→1`) — der Direktzugriff auf
  `Registry`/`ProgramRunner` aus `TimerStore::tick()` funktioniert ohne
  offenen Browser.
- Dauer-Timer (15 s) mit `repeat`: vier Zyklen beobachtet, `startedEpoch`
  sprang exakt im 15-s-Raster weiter, Status blieb durchgehend `running`
  (kein Zwischenstopp bei `done`).
- Uhrzeit-Timer mit `repeat`: nach dem ersten Ablauf sprang `durationSec` von
  55 auf exakt 86400 und `startedEpoch` wurde auf den exakten
  Ablaufzeitpunkt rebased (Status blieb `running`) — der drift-freie
  „morgen selbe Uhrzeit"-Rearm funktioniert wie geplant.
- Reboot-Test (sicherer Trigger über `POST /api/network` mit unverändertem
  Hostnamen) während ein Uhrzeit+Repeat+Aktion-Timer lief: nach dem Neustart
  (Uptime laut `state.t` ~22 s, also echter Reboot) waren `mode`, `timeOfDay`,
  `repeat`, `onExpire`, `startedEpoch` und `durationSec` unverändert erhalten,
  `remainingSec` lief nach Wall-Clock korrekt weiter statt zurückgesetzt zu
  werden.
- Alle Testtimer und der Pumpen-Zustand danach wieder aufgeräumt/zurückgesetzt.
  Nebenbefund (nicht durch diese Änderung verursacht, bestehendes Verhalten):
  der Reboot setzte den `mash`-Regler-Sollwert von einem manuell gesetzten
  Laufzeitwert (72 °C) auf den Config-Default (65 °C) zurück — das
  zugehörige Programm „Hermann-Weizen" stand dabei bereits auf `idle`, war
  also nicht aktiv am Steuern; nicht-programmgebundene Sollwerte werden beim
  Boot grundsätzlich nicht persistiert.

Damit ist der zuvor offene Hardware-Verifikationspunkt für die Timer-Erweiterung
erledigt — Eintrag aus `PLAN.md` entfernt.

## 2026-09-13 — Alternative Card-Darstellungen: Gauge & Kompakt für Sensor/Regler/Timer

Sensor-, Regler- und Timer-Cards hatten bisher nur eine feste Darstellung.
Ergänzt um zwei zusätzliche Anzeigevarianten pro Widget: **Gauge** (rundes
SVG-Gauge, ~doppelte Höhe) und **Kompakt** (~halbe Höhe). Absorbiert zwei
offene Backlog-Punkte: „Zirkuläre Variante des Regler-Sliders" (linear war
seit 2026-09-12 umgesetzt) und „Sensor-/Aktor-/Controller-Cards: feste
Höhe/Breite".

**Datenmodell:** additiv, kein Breaking Change — `DashboardConfig` bekommt
drei neue Maps (`sensorModes`/`controllerModes`/`timerModes`, id → `'compact'
| 'gauge'`); `'normal'` wird nie gespeichert, ein fehlender Eintrag heißt
implizit normal. Firmware (`DashboardStore.h/.cpp`) hält sie als
`vector<pair<string,string>>` neben den bestehenden ID-Listen, reine
Passthrough-Felder (Frontend interpretiert die Werte, Firmware nicht).
`docs/openapi.yaml` um `WidgetMode`-Schema + die drei Properties auf
`DashboardInput`/`Dashboard` ergänzt.

**Gauge-Primitive:** neue `Gauge.tsx` — 270°-Bogen (90°-Lücke unten mittig),
`pathLength={100}`-Trick für prozentuale `stroke-dasharray`-Füllung statt
Umfangsrechnung. Optionale `interactive`-Variante (nur vom Regler genutzt)
mit ziehbarem Thumb: Pointer-Winkel relativ zum SVG-Mittelpunkt berechnet
(`atan2`), Totzonen-Snap auf 0/100 % in der unteren Lücke, Commit-Semantik
1:1 von `Slider.tsx` übernommen (`onInput` laufend fürs visuelle Feedback,
`onChange` erst einmalig bei `pointerup`/`pointercancel` — vermeidet den dort
schon dokumentierten Chrome-Bug mit dauerfeuerndem `change`). Zusätzlich
`fillValue`-Prop (unabhängig vom Thumb-Wert), damit der Regler-Gauge wie der
lineare Slider gleichzeitig Ist (Füllbogen) und Soll (Thumb) zeigt.
Pfeiltasten-Nudge + `role="slider"`/`aria-value*` für Tastatur-Zugänglichkeit,
da ein SVG-Custom-Control die native Range-Semantik nicht mitbringt.

**Umschalten:** neuer Icon-Button (`CardModeButton.tsx`) direkt im
Card-Header, nur im Bearbeiten-Modus sichtbar, zyklisch normal → gauge →
compact → normal. `Dashboard.tsx` bekam dafür `cycleMode()` neben
`patchActiveDash`; `handleRenamed()` zieht beim Umbenennen eines Sensors/
Reglers dessen Modus-Eintrag mit um, sonst würde er stillschweigend auf
normal zurückfallen.

**Grid:** Dense-Packing (`[grid-auto-flow:dense]` +
`[grid-auto-rows:minmax(72px,auto)]`) statt der bisherigen gleichförmigen
Zeilenhöhe — Basis-Einheit 72 px, `row-span-1/2/4` für kompakt/normal/gauge
(2×72+Gap = exakt die bisherigen 160 px, war der Ableitungsanker für die
Einheit). `minmax(…, auto)` statt eines festen Werts, damit eine Karte, die
ihr Zeilenbudget sprengt (z. B. eine umbrechende Alarm-Badge), wächst statt
abzuschneiden. `ActuatorCard` bleibt inhaltlich unverändert, bekommt aber ein
hartkodiertes `row-span-2`, sonst würde Dense-Packing sie auf eine 72-px-Zeile
stauchen.

**Verifikation:** `pnpm typecheck` sauber, `npx @redocly/cli lint` sauber,
`pio run -e esp32dev` kompiliert die `DashboardStore`-Änderung fehlerfrei.
Live gegen `brewcontrol.local` (192.168.178.87, per `pnpm dev`-Proxy) im
Browser durchgeklickt: alle drei Widget-Typen durch alle drei Modi zyklen,
Dense-Grid-Packing bei gemischten Höhen (kein Clipping/Overlap), Regler-Gauge
per Drag über den vollen Bogen inkl. unterer Lücke gezogen — echter
`setControllerSetpoint`-Request feuerte laut Netzwerk-Log nur genau einmal
beim Loslassen, per `GET /api/snapshot` gegen das Gerät bestätigt (Sollwert
tatsächlich übernommen, danach wieder auf 65 °C zurückgesetzt), Klick-zum-
Bearbeiten-Eingabe im Gauge-Zentrum funktioniert trotz `pointer-events-none`-
Overlay (gezielt `pointer-events-auto` auf dem Center-Content). Dark/Light
manuell umgeschaltet, Gauge in beiden lesbar. **Nicht gemacht:** neue
Firmware wurde nicht auf das Testboard geflasht (siehe PLAN.md →
Hardware-Verifikation offen) — `sensorModes`/`controllerModes`/`timerModes`
liefen serverseitig deshalb nur gegen die alte Firmware, die das Feld beim
Speichern stillschweigend verwirft (Reload zeigte dadurch erwartungsgemäß
wieder „normal" — kein Frontend-Bug, nur alte Firmware auf dem Gerät).

## 2026-09-13 — Fix: ControllerCard/ActuatorCard zeigten verknüpfte Items auf anderen Tabs nicht an

**Root Cause:** `Dashboard.tsx` reichte `ControllerCard`/`ActuatorCard` die
Tab-gefilterte `displaySnap.sensors`/`.actuators`/`.controllers` (aus
`filterSnap`) statt des vollen Snapshots durch. Lag der per `params.sensor`/
`params.actuator` verknüpfte Sensor/Aktor eines Reglers (oder der steuernde
Regler eines Aktors) auf einem anderen Dashboard-Tab, fand der `.find()`-
Lookup ihn nicht — Ist-Wert, Ausgang, Regelbereich (Fallback auf 0–100) und
Einheit fehlten auf der Regler-Karte, die „Steuert von …"-Zuordnung auf der
Aktor-Karte ebenso.

**Umsetzung:** `sensors`/`actuators`/`controllers` an beiden `ControllerCard`-
Stellen und an `ActuatorCard` auf den ungefilterten `snap` umgestellt — die
Tab-Filterung (`displaySnap`) bestimmt weiterhin nur, welche Karten auf einem
Tab überhaupt erscheinen, nicht mehr, welche verknüpften Items eine Karte
auflösen kann.

**Verifikation:** `pnpm typecheck` grün. Live gegen `brewcontrol.local`
geprüft: Regler `testpid` (Sensor `mlt` + Aktor `kettle`, beide auf anderen
Tabs) zeigt auf dem „Gärung"-Tab jetzt korrekt Ist-Wert, Ausgang und den vom
Sensor geerbten Regelbereich.

## 2026-09-13 — Zugriffsschutz Stufe 2: auch die UI/Leseseite sperrbar

Bisheriger Schutz (Stufe 1, 2026-09-05) gilt nur für schreibende Routen;
Lesen — inklusive `index.html`/JS/CSS und `/api/snapshot` — blieb laut
README immer offen, auch bei gesetztem Passwort. PLAN.md-Punkt „Zugriffsschutz:
Option auch für die UI selbst anbieten" verlangte eine Option, das ebenfalls
zu sperren. Mit dem Nutzer geklärt (AskUserQuestion): volle Sperre (eigene
Login-Seite statt SPA-Gerüst mit leeren Daten) als eigener Schalter,
zusätzlich zum Passwort — das bisherige Verhalten bleibt Default.

**Mechanismus:** ein einziges neues `AuthService::uiProtected_`-Flag
(`Preferences`-Key `authUiLock`, nur bei gesetztem Passwort setzbar, wird
beim Passwort-Löschen automatisch mit zurückgesetzt — ein UI-Lock ohne
Passwort wäre unwiederherstellbar). Die eigentliche Sperre ist **ein**
`server_.addMiddleware(...)`-Callback in `WebUI::begin()`
(`ArMiddlewareCallback`, dokumentiert in ESPAsyncWebServer für genau diesen
Zweck: „check authentication") statt Änderungen an jeder einzelnen GET-Route
oder an `serveStatic`/`onNotFound` einzeln. Server-Middleware läuft laut
`AsyncWebServerRequest::_runMiddlewareChain()` vor **jedem** Handler — Static-
File-Handler, SPA-Fallback (`onNotFound`) und jede API-Route eingeschlossen —
und kann die Antwort selbst senden, ohne `next()` aufzurufen. Damit reicht ein
Gate für alles: bei aktivem UI-Schutz und fehlender Session bekommt jedes GET
außerhalb von `/api/` (also `/`, jede statische Datei, jeder SPA-Client-Pfad)
eine eingebettete, eigenständige Login-Seite (`kLockedPageHtml`, reines HTML/
CSS/JS ohne externe Requests, im Firmware-Binary statt unter `/www` — die
LittleFS-Boards haben nur 256 KB Datenpartition, und die Seite muss auch
während eines laufenden UI-Uploads erreichbar bleiben); jede andere Route
außer `/api/auth/*` (sonst wäre Einloggen selbst blockiert) bekommt `401`.
Die bestehenden `requireAuth()`-Aufrufe in den Schreib-Handlern bleiben
unverändert für den „nur Passwort"-Fall.

**Neue Route:** `POST /api/auth/ui-protection` (Body `{"enabled"}`), verlangt
wie `/api/auth/password` eine bestehende Session, plus `409` ohne
konfiguriertes Passwort. `GET /api/auth/status` liefert zusätzlich
`uiProtected`. Frontend: `SecurityPage.tsx` bekam eine neue `ToggleSwitch`-
Karte „Auch Lesen/UI sperren" (nur sichtbar bei gesetztem Passwort und
angemeldet); `LoginModal.tsx`/`app.tsx` blieben unverändert, da Unauthenti-
fizierte bei aktivem UI-Schutz ohnehin nie die SPA laden, sondern direkt die
Locked-Page von der Firmware bekommen.

**Bekannte, bewusst nicht behobene Lücke:** läuft ein Tab schon offen und die
Session läuft währenddessen ab (7-Tage-TTL oder „Alle Sitzungen abmelden"),
zeigt das bestehende dismissible `LoginModal` weiter Stale-Daten/Fehler statt
sofort zur Locked-Page zu wechseln — ein Reload holt sie. Für den seltenen
Fall kein zusätzlicher Code.

**Verifikation:** `pio run -e esp32dev` kompiliert (Flash 85 %, RAM 18 %),
`pnpm typecheck` grün, `npx @redocly/cli lint` sauber (`openapi.yaml`:
`AuthStatus`-Schema + neue Operation + `401` bei allen bisher immer-offenen
GET-Routen ergänzt). Hardware-E2E gegen `brewcontrol.local` (LilyGo
T-Display-S3-AMOLED) vom Nutzer bestätigt: Passwort setzen, „Auch Lesen/UI
sperren" aktivieren, abgemeldet liefert `GET /` die eingebettete Login-Seite
statt der SPA, Login auf der Locked-Page setzt das Cookie und schaltet frei,
Schalter wieder aus stellt den „nur Schreiben geschützt"-Zustand wieder her.

**Nebenbei:** Board landete während des Tests im gesperrten Zustand ohne
bekanntes Passwort (vermutlich Rest eines früheren Tests, nicht aus dieser
Session). Ohne erreichbaren BOOT-Button am Board (T-Display-S3-AMOLED-1.43-
1.75 hat laut Schaltplan zwei Taster `S1`/GPIO0 und `SW1`/EN direkt am
USB-C, aber die Reihenfolge „BOOT halten + RESET drücken" schickt den
ESP32-S3 stattdessen in den seriellen Download-Modus statt den App-seitigen
Recovery-Check in `main.cpp` auszulösen — hat hier nicht funktioniert) per
`esptool.py --chip esp32s3 --port COM9 erase_region 0x9000 0x5000` nur die
NVS-Partition gelöscht (Offset/Größe aus der kompilierten
`partitions.bin` dieses Envs verifiziert, `gen_esp32part.py`) — WLAN +
Auth-Passwort weg, Firmware/UI/SD unangetastet. Danach WLAN neu eingerichtet,
Zugriffsschutz war wieder aus. Für den nächsten Fall: welche Session/wer
zuletzt ein Testpasswort auf einem der drei Boards gesetzt hat, bleibt
ungeklärt — beim Verlassen einer Testsession den Zugriffsschutz wieder
aufheben, sonst sperrt es die nächste Session aus.

## 2026-09-14 — Dashboard-Chart: Legende in die Titelzeile (Desktop)

Auf Desktop-Breite verlor die uPlot-Legende unter dem Chart unnötig viel
Platz. Erster Versuch per reinem CSS (`.uplot { flex-direction:
column-reverse }` ab 768px) schob sie nur über den Chart in eine eigene
Zeile; auf Wunsch danach in die gleiche Zeile wie der Karten-Titel verschoben.
Dafür bekam `ChartCard.tsx` einen neuen `legendHost`-Prop: sobald gesetzt,
wird `.u-legend` nach dem Bau des uPlot-Charts per `appendChild` dorthin
verschoben (uPlot selbst kümmert sich nicht um den DOM-Elternteil seiner
Legende) und beim Unmount/Rebuild wieder geleert — `uPlot.destroy()` entfernt
nur die eigene Root, nicht Knoten, die vorher herausgelöst wurden.
`Dashboard.tsx` kapselt Titel+Chart jetzt in einer lokalen `ChartRow`-
Komponente mit einem Platzhalter-`div` in der Titelzeile als Legend-Ziel
(als State geführt, weil der Ref erst nach dem Mount existiert und ChartCard
den erneuten Effect-Lauf zum Verschieben braucht); aktiv nur wenn
`isDesktop` (matcht den bestehenden `lg`-Breakpoint des Dashboards).
LogsPage/ArchivePage bekommen keinen `legendHost` und behalten die CSS-
Fallback-Lösung (Legende weiterhin in eigener Zeile über dem Chart ab
768px). Mobil unverändert (Legende unter dem Chart). Verifiziert live gegen
das Testboard `192.168.178.87`: Legendenwerte aktualisieren sich mit dem
Snapshot, Edit-Modus (Titel + Legende + Entfernen-Button in einer Zeile)
kollidiert nicht.

## 2026-09-16 — Dashboard-Tabs im Bearbeiten-Modus neu anordnen

Tab-Reihenfolge war bisher fix (Array-Position von `DashboardConfig[]`,
kein `order`-Feld) — Erstellen/Umbenennen/Löschen gab es, aber kein
Umsortieren. Neue ◀/▶-Pfeile am aktiven Tab im `editMode` verschieben ihn
um eine Position; bewusst kein Drag & Drop, da die UI auch auf
Touchscreens am Braustand zuverlässig bedienbar sein muss, und bewusst nur
Nachbar-Vertauschung statt einer vollständigen Reorder-Route (reicht für
den Anwendungsfall). Neu: `DashboardStore::move(id, dir)` (swapped
Vector-Nachbarn, No-Op an den Rändern) + `POST /api/dashboards/{id}/move`
(`WebUI.cpp`, analog zum bestehenden `/control`-Pattern bei
Programs/Timers) + `moveDashboard()` in `api.ts` + `moveTab()` in
`Dashboard.tsx` (folgt dem bestehenden Await-vor-Commit-Pattern ohne
Optimistic-Rollback, wie `patchActiveDash`). `docs/openapi.yaml` +
README-Routentabelle im selben Commit ergänzt. Keine neuen nativen
Firmware-Tests — `DashboardStore` hat wegen FS/SdLock-Abhängigkeit generell
keine `native`-Testabdeckung (auch `add`/`update`/`remove` nicht), das für
ein Feature nachzuholen wäre Überkonstruktion. Verifiziert: `pio run -e
esp32dev` + `pio test -e native` (37 bestehende Tests weiter grün) +
Redocly-Lint + `pnpm typecheck`/`build`; UI zunächst live gegen
`192.168.178.87` mit der alten Firmware (ohne `/move`) getestet — Pfeile
erscheinen nur am aktiven Tab im Edit-Modus, Rand-Buttons korrekt disabled,
fehlschlagender `/move`-Call (404, altes Board) lässt die Tab-Reihenfolge
unverändert statt sie clientseitig zu verfälschen. Danach die neue
Firmware per Netzwerk-OTA auf dieselbe LilyGo S3 aufgespielt
(`curl -F f=@firmware.bin http://192.168.178.87/api/update/firmware`,
Reboot bestätigt über `/api/update/status`) und den echten Persistenz-Pfad
verifiziert: ◀/▶ verschiebt den Tab, `POST /api/dashboards/<id>/move` →
`204`, Reload behält die neue Reihenfolge (SD-persistiert). Anschließend
die ursprüngliche Tab-Reihenfolge wiederhergestellt. **Nebenbei entdeckt:**
`POST /api/update/assets` (UI-Tar-Upload) schlägt auf diesem Board jetzt
auch fehl (`extract failed`, sofort) — bisher nur auf LOLIN S2 Mini bekannt
und dort anders (Reset nach ~65 KB); vermutlich zwei verschiedene Ursachen,
nicht weiter verfolgt, siehe PLAN.md. Deshalb blieb die UI auf dem Board
bei der alten Firmware-Version im `index.html`, ändert aber nichts an der
Verifikation, da der Test über den lokalen `pnpm dev`-Server lief (nur die
Firmware/API musste aktuell sein).

Direkt danach Nutzer-Feedback zur mobilen Ansicht: Auf schmalen Breiten
saßen „Bearbeiten"/„Hinzufügen"+„Fertig" in derselben Zeile wie die Tabs
und quetschten den Tab-Streifen auf einen kaum bedienbaren Rest zusammen.
Die Buttons sitzen jetzt bei `max-width < 1024px` in der Titelzeile neben
„BrewControl" statt in der Tab-Zeile — dieselbe Logik (`dashActions()` in
`Dashboard.tsx`) wird zweimal gerendert, einmal `lg:hidden` im Header,
einmal `hidden lg:contents` in der Tab-Zeile (Breakpoint deckt sich mit dem
bereits vorhandenen `isDesktop`/`lg`-Umschaltpunkt für den Chart-Legende-
Umzug). Ab 1024px unverändert wie vorher. Verifiziert per `pnpm build` +
live im Browser bei 375px und 1280px Breite gegen das echte Testboard.

Nachgebessert: Im Header (`items-center`) saßen die Buttons zu hoch,
sichtbar gegenüber der Mittellinie von „BrewControl" (Nutzer-Screenshot mit
Markierung). Ursache: `mb-2` auf den Buttons, eigentlich nur für die
Baseline-Ausrichtung im Desktop-Tab-Streifen (`items-end`) gedacht, verzerrt
im Header die Zentrierung. `dashActions()` bekommt jetzt einen
`alignEnd`-Parameter — `true` im Tab-Streifen (mit `mb-2`), `false` im
Header (ohne). Verifiziert bei 375px (Buttons jetzt auf einer Linie mit dem
Titeltext) und 1280px (Tab-Streifen unverändert).

## 2026-09-16 — Log-Chart: zusätzliche Y-Achsen pro Einheit

Alle Reihen eines Logs lagen bisher auf einer Y-Skala; mischte man z. B.
Temperatur (0–100 °C) mit einem 0/1-Aktor, wurde die kleine Reihe zur
flachen Linie. `ChartCard.tsx` gruppiert die Reihen jetzt nach Einheit
(bestehendes `unitOf()` aus `refs.ts`, Regler-Sollwert = Einheit seines
Sensors) und legt pro Gruppe eine eigene uPlot-Skala an: erste Gruppe links,
weitere rechts. Einheitslose Reihen bekommen je eine eigene Achse (0/1-Relais
und 0–255-PWM wären sonst wieder gemischt). Die Einheit steht waagerecht unter der jeweiligen Achse (auf
Höhe der Zeit-Ticks, als HTML-Element im `.u-axis`-Div per `ready`-Hook
statt uPlots gedrehtem `label`); eine Achse
mit genau einer Reihe nimmt deren Linienfarbe an; nur die linke Achse zeichnet
Gitterlinien. Einheiten werden beim Chart-Aufbau festgelegt — ohne
Live-Snapshot (Archiv, LogsPage vor erstem SSE-Event) wird einmal
`/api/snapshot` geladen. Keine API-Änderung. Verifiziert: `pnpm typecheck`,
`pnpm dev` gegen `192.168.178.87` — Dashboard-Log „Maischen“
(`sensor/mlt` + `controller/mash` in °C links, `actuator/kettle` rechts 0–1
in Grün) und Archiv-Ansicht einer alten Session zeigen beide Achsen korrekt,
keine Console-Fehler.

## 2026-09-16 — WebSocket als vierter Remote-Transport (SensActCtrl + BrewControl)

Neben MQTT, ESP-NOW und Webhook gibt es jetzt `WebSocketTransport`: eine
dauerhafte, bidirektionale Verbindung ohne Broker. **Rollen (Hub-Modell):**
der veröffentlichende Knoten (Leaf) ist Client und verbindet sich zum
konsumierenden Knoten (Hub), der den Server betreibt — nur ein Client blockiert
beim Connect, und ein Leaf hat genau eine solche Verbindung; der Hub muss die
Leaves nicht kennen. Der Hub-Server ist eine Geräteeinstellung (läuft
unabhängig von Items) — Voraussetzung für die spätere Autodiscovery (in
PLAN.md vorgemerkt, Mechanismus mDNS-SD vs. UDP noch offen). Library:
`links2004/WebSockets` 2.7.3 (Server + Client, in `loop()` gepollt wie der
Webhook-`WebServer`); verworfen `esp_websocket_client` (eigener Task, ab IDF 5
nicht mehr im Framework) und `AsyncWebSocket` (nur Server, Async-Abhängigkeit
für die Library).

**Library:** `WebSocketProtocol.h` (ein Text-Frame pro Nachricht:
`D<topic>\n<payload>` bzw. `R` als Retained-Request, dazu URL-Parser nur für
`ws://`), `WebSocketTransport` (Server broadcastet an alle Clients, kein
Relaying zwischen Clients; Retain-Emulation wie ESP-NOW: wer Subscriptions
hat, fragt bei jeder neuen Verbindung und nach `subscribe()` — pro `tick()`
zusammengefasst — den Retained-Cache der Gegenseite ab; Heartbeat 5 s/3 s/2,
Reconnect-Abstand 5 s). `lastErrorMessage()` zeigt immer auf ein
String-Literal, weil WebUI es aus dem AsyncTCP-Task liest. Test
`test_websocket_protocol` (13 Fälle), Beispiel `11_remote_websocket`.
**BrewControl:** Settings-Abschnitt `websocket` (`hubEnabled`/`hubPort`,
`publishEnabled`/`hubUrl`/`clientId`/`topicPrefix`), `WebSocketService`
(Hub-Server + Publish-Client mit `RemotePublisher`), Remote-Items mit
`transport:"websocket"` ohne Zusatzfelder (ohne Hub: `websocket hub not
enabled`), `GET /api/settings` mit `connected`/`error`/`hubClients`,
`-DWEBSOCKETS_TCP_TIMEOUT=1000`; Frontend: neue Seite Einstellungen →
Konnektivität → WebSocket, WebSocket-Button im Remote-Dialog. openapi.yaml,
READMEs nachgezogen. Umgesetzt in einem eigenen Worktree
(`worktree-websocket-transport`), weil parallel eine andere Session im
Haupt-Checkout an der Dashboard-Sortierung arbeitete.

**Verifikation:** `pio test -e native` 210/210; Firmware für alle drei Envs,
Flash je ~+29,8 KB (esp32dev 85,0 → 86,6 %, S2 81,8 → 83,3 %, LilyGo
23,6 → 24,0 %), RAM +72–80 B, keine neuen Warnungen; beide Beispiele per
`pio ci` (mit `-std=gnu++17` — die dokumentierten Befehle scheitern bei allen
Beispielen an `IntervalActuator.h` unter gnu++11, vorbestehend, in PLAN.md);
`pnpm typecheck`/`build`; `redocly lint` valide. **Hardware** (LilyGo war
durch die andere Session belegt): esp32dev als Hub, LOLIN S2 Mini als Leaf,
beide per OTA. Ohne Hub wird ein WebSocket-Remote-Item abgelehnt,
Settings-Validierung greift (`hubUrl`, `hubPort`, `clientId`). Hub-Port nimmt
den Handshake an (`101`), Leaf `connected:true`, Hub `hubClients:1`. Auf dem
Hub nachträglich angelegte Remote-Items (DigitalInput GPIO0, LED GPIO15 am S2)
hatten Meta + State sofort (Retained-Request); `write 1` am Hub schaltete die
LED am Leaf, der Zustand kam zurück. Hub-Neustart: Leaf meldete nach ~2 s
„Keine Verbindung zum Server" und war nach ~7 s ohne Eingriff wieder
verbunden, die gespeicherten Remote-Items auf dem Hub bekamen Meta/State neu.
Loop-Blockade bei nicht antwortendem Hub (`ws://192.168.178.250:8081`) von
außen über den Sensor-Zeitstempel gemessen: ~1 s Stillstand alle ~6 s (max.
1002 ms), mit erreichbarem Hub keiner. Danach Test-Items gelöscht und
WebSocket auf beiden Boards wieder ausgeschaltet. **Nicht verifiziert:** zwei
Leaves gleichzeitig und die neue UI am Gerät — der UI-Tar-Upload passt auf
esp32dev nicht mehr in die LittleFS-Partition (neues JS 100 KB gzip, in
PLAN.md), und das Browser-Pane startet keinen Dev-Server aus dem Worktree;
beides als offener HW-Punkt in PLAN.md.

## 2026-09-16 — Tar-Upload-Fehler (S2 Mini, LilyGo S3): eingegrenzt, noch nicht HW-verifiziert

Ausgangspunkt: zwei in PLAN.md dokumentierte Tar-Upload-Fehler auf
verschiedenen Boards (S2 Mini: `Connection was reset` nach ~65 KB; LilyGo S3:
sofortiges `extract failed`). Erster Schritt war zu klären, ob der
`TarExtractor`-Parser selbst kaputt ist: ein nativer Test-Harness
(`TarExtractor.cpp` direkt kompiliert, echtes `webui.tar` aus `pnpm build:sd`
+ `tar -C dist -cf webui.tar .`, in willkürlich kleinen 173-Byte-Häppchen
gefüttert) extrahiert alle 16 Dateien fehlerfrei — der Parser ist raus als
Ursache, das Problem liegt im SD/LittleFS-I/O (`SdTarSink`) oder im
Restzustand von `/www.new`.

Zwei Fixes eingebaut: `SdTarSink.h` — `/www.new` wird vor jeder Extraktion
jetzt über das bestehende `removeRecursive_()` geleert statt über
`fs_.rmdir()`, das bei nicht-leerem Verzeichnis stillschweigend nichts tut;
ein vorheriger fehlgeschlagener Lauf konnte also Dateileichen hinterlassen,
in die der nächste Versuch dann hineingeschrieben hätte (`FILE_WRITE` hängt
auf dieser Plattform an, statt zu überschreiben). `WebUI.cpp` — die
500-Antwort auf `/api/update/assets` trägt jetzt `TarExtractor::errorMsg()`
(`open failed`/`write failed`/`close failed`) plus den zuletzt versuchten
Pfad (`SdTarSink::lastPath()`) statt nur der generischen Meldung; dieselbe
Zeile geht zusätzlich auf `Serial`. `docs/openapi.yaml` entsprechend
nachgezogen.

**Verifiziert:** `pio test -e native` (37/37 grün), `pio run` auf allen drei
Envs (esp32dev, lolin_s2_mini, lilygo_t_display_s3_amoled) kompiliert,
Redocly-Lint valide. **Nicht verifiziert:** ob das der tatsächliche Root
Cause ist — dafür fehlt ein Hardware-Testlauf mit der neuen Firmware auf S2
Mini und LilyGo, der jetzt aber die genaue Fehlerstelle statt nur „extract
failed" zeigen sollte. Bis dahin bleibt der Punkt offen in PLAN.md.

**Nachtrag — Cross-Session-Info aus der parallelen WebSocket-Session
(2026-09-16):** dort am echten esp32dev reproduziert, mit dem
Doku-empfohlenen gz-only-Tar (~133 KB, gewachsen seit dem 100-KB-Befund vom
2026-09-10). Ergebnis deckt sich mit der schon in PLAN.md vermuteten
Platzursache: `/www.new/assets/…js.gz` landet mit 0 Byte, `/www` bleibt
unverändert, geschätzt ~84 KB frei (4-KB-Block-Schätzung) gegen 100 KB neues
JS-Gzip — aber der Client bekommt dabei **gar keine Antwort**
(`curl: (56) Recv failure: Connection was reset`), nicht die von
`openapi.yaml` versprochene `500`. Das ist dasselbe Fehlerbild wie der
ältere S2-Mini-Befund (`Connection was reset`, gleiche 256-KB-Partition) —
naheliegende, aber noch unbestätigte Vermutung: S2 Mini und esp32dev könnten
dieselbe Platz-Ursache teilen, nicht die zwei getrennten Fehlerbilder, von
denen PLAN.md bisher ausging. Ob es tatsächlich crasht/rebootet (statt eines
sauberen I/O-Fehlers) wurde nicht per Serial geprüft. PLAN.md entsprechend
konsolidiert: LittleFS-Boards (Platz, vermutlich gemeinsame Ursache) jetzt
als ein Punkt geführt, LilyGo (SD-I/O, bestätigt kein Platzproblem) separat.

## 2026-09-16 — Remote-Discovery (MQTT + ESP-NOW) + ESP-NOW-Unicast für Befehle

Remote-Items mussten bisher komplett von Hand eingetragen werden (Gerät,
Remote-ID, Prefix, Kanal) — fehleranfällig, zumal BrewControl mit Prefix
`brewcontrol` publisht, Remote-Items aber `sensactctrl` vorbelegen. Jetzt gibt
es im Remote-Bereich des Hinzufügen-Dialogs „Geräte suchen".

**Entscheidungen:** Request/Response über Topics statt MAC-Pairing, einmal in
der Library über `ITransport` (läuft auf MQTT und ESP-NOW, später
WebSocket/Webhook). Retained-Announce + Last Will (Home-Assistant-Muster)
verworfen: braucht Wildcard-Subscribe (keiner unserer Transporte kann das),
hinterlässt Leichen am Broker und passt nicht zu ESP-NOW. ESP-NOW hybrid:
Adressierung bleibt deviceId/Topic (Hardwaretausch ohne Neu-Koppeln), aber
nicht-retained Befehle gehen unicast mit ACK.

**Umsetzung:**
- `SensActCtrl/src/remote/Discovery.{h,cpp}`: Protokoll (fixe Topics
  `sensactctrl/discover` + `/<scanner>`, `rid` gegen verspätete Antworten, eine
  Antwort pro Sensor-Kanal/Aktor wegen 250-Byte-Limit, Controller nicht
  gelistet) und `DiscoveryScanner` (thread-sicher, Anfrage geht nur aus
  `tick()` raus, 3-s-Fenster, Dedup, eigenes Gerät gefiltert, Ergebnis-TTL 30 s).
- `RemotePublisher` antwortet automatisch: Anfrage wird unter Mutex übergeben,
  `tick()` sendet nach Zufalls-Jitter (0–400 ms) ein Item pro Aufruf.
- `EspNowTransport` + neues `EspNowPeerTable.h`: Absender-MAC wird für
  abonnierte Topics gelernt; `publish(retained=false)` geht an den Sender des
  Eltern-Topics (`…/actuator/x/set` → Sender von `…/actuator/x`), LRU von max.
  16 Unicast-Peers, sonst Broadcast. Send-Callback meldet Zustellfehler in
  `lastErrorMessage()` (eigener String, den periodische Broadcasts nicht
  sofort überschreiben). Wire-Format unverändert. Nebeneffekt:
  Discovery-Antworten gehen ebenfalls unicast an den anfragenden Scanner.
- BrewControl: `RemoteDiscovery.h` (Scanner je Transport, eigene IDs wie
  `MqttService`/`EspNowPublishService`), `GET /api/remote/discover?transport=`
  im Muster von `/api/network/scan` (202 → 200, 409 wenn MQTT aus),
  `openapi.yaml` + README-Tabelle. Web: `discoverRemote()`, Liste gruppiert
  nach Gerät, gefiltert nach Sensor/Aktor, „bereits angelegt"-Markierung,
  Klick füllt Gerät/Remote-ID/Prefix/Kanal und leere lokale ID.

**Verifiziert:** `pio test -e native` alle Suites grün (neu: `test_discovery`
9, `test_espnow_peers` 5); `pio run` esp32dev, lolin_s2_mini,
lilygo_t_display_s3_amoled kompilieren; `pnpm typecheck` + `pnpm build`;
Redocly-Lint valide; Such-UI im Browser gegen `brewcontrol.local` mit
gestubbtem Endpoint (Liste, Sensor-Filter, Übernahme der Felder).
**Nicht verifiziert:** Hardware (nichts geflasht) → PLAN.md
„Hardware-Verifikation offen".

## 2026-09-16 — UI-Tar-Upload auf den 256-KB-LittleFS-Boards (esp32dev, lolin_s2_mini) gefixt

`POST /api/update/assets` schlug auf beiden LittleFS-Boards fehl, und statt der
dokumentierten `500` bekam der Client einen Connection-Reset.

**Root Cause (per Serial belegt):** `/www.new` wurde neben dem noch liegenden
`/www` entpackt. Die 256-KB-Partition fasst altes und neues Bundle aber nicht
gleichzeitig. esp32dev: 176 KB von 256 KB schon vor dem Entpacken belegt, frei
also ~86 KB gegen ~101 KB JS-Gzip. Der fehlende 500er ist ein **Crash**: Wenn
kein freier Block mehr da ist, gibt esp_littlefs keinen Fehler zurück, sondern
panict (`Guru Meditation Error: IntegerDivideByZero` in `lfs_alloc`, lfs.c:689,
Backtrace über `SdTarSink::writeCb` → `TarExtractor::feed`). Das Board bootet
mitten im Request neu. Der LOLIN zeigt dasselbe Muster (135 KB belegt, frei
~127 KB gegen ~120 KB plus Metadaten): Neustart mitten im Upload, curl
bekommt `(56)`. Den Panic-Text gibt das S2 über USB-CDC nicht mehr aus. Der
ältere Befund „Abbruch bei ~65 KB" war also dieselbe Ursache, nur knapper am
Limit.

**Entscheidung:** Drei Ansätze standen zur Wahl. Umgesetzt ist „`/www` vor dem
Entpacken leeren", ergänzt um eine eingebettete Notfall-Seite. Diff-Sync
verworfen: Vite hasht die Dateinamen, das große JS ändert sich also bei jedem
Build und muss trotzdem neben dem alten liegen. Code-Splitting verworfen: Die
Gesamtgröße bleibt gleich. Umpartitionieren geht nicht, die Firmware belegt
schon 1,65 MB des 1,86-MB-App-Slots. Das In-place-Verhalten hängt bewusst
**nicht** an `BREWCTL_USE_LITTLEFS`, sondern an einem eigenen Flag
`BREWCTL_ASSETS_IN_PLACE`. Ein künftiges Board ohne SD, aber mit größerer
Datenpartition behält den atomaren Tausch.

**Umsetzung:**
- `platformio.ini`: `-DBREWCTL_ASSETS_IN_PLACE=1` in `esp32dev` +
  `lolin_s2_mini`, mit Kommentar zur Partitionsgröße.
- `WebUI.cpp`: `kAssetTarget` (`/www` bzw. `/www.new`). Im In-place-Modus wird
  zu Beginn `/www` geleert. `/www.new` wird immer geleert, denn Reste früherer
  Versuche fressen Platz. Es gibt keinen Swap. `index.html(.gz)` wird als
  `.part` geschrieben und erst bei Erfolg umbenannt. So endet auch ein
  Verbindungsabbruch, der nie `final` erreicht, auf der Notfall-Seite statt
  in einer halben SPA.
- LittleFS-Guard: Vor jedem Archiv-Member prüft ein Wrapper um
  `SdTarSink::openCb()` den freien Platz (Größe + 1/64 + 2 Blöcke). Reicht er
  nicht, kommt `500 extract failed: not enough space (<member>, <size> bytes)`
  statt eines Panics. Dazu kommt eine knappe Serial-Zeile mit
  `LittleFS used/total` bei Start und Ende.
- `kRecoveryPageHtml` (Muster `kLockedPageHtml`): `onNotFound` liefert sie für
  Nicht-API-GETs, solange `/www/index.html(.gz)` fehlt. Die Seite bietet einen
  Tar-Upload plus ein optionales Passwort-Feld und gilt für alle Boards.
- `openapi.yaml`, `BrewControl/README.md`, `BrewControl/CLAUDE.md`
  nachgezogen. Der Punkt ist aus PLAN.md raus, der LilyGo-SD-Befund steht dort
  als eigener Punkt weiter.

**Verifiziert:** `pio test -e native` (SensActCtrl 224, Firmware 37 grün);
`pio run` für esp32dev, lolin_s2_mini, lilygo_t_display_s3_amoled; Redocly-Lint.
Hardware an **beiden** LittleFS-Boards per OTA, jeweils mit curl:
- gz-only-Tar → `200` in 2–4 s, neues Bundle wird ausgeliefert
  (esp32dev: 29 KB → 172 KB belegt).
- Erneuter Upload über bestehende UI → `200`.
- Volles Tar (522 KB) bzw. Tar mit `index.html.gz` zuerst plus 300-KB-Datei →
  `500 not enough space (…)`, kein Reboot, `GET /` liefert die Notfall-Seite.
- Per `--limit-rate` abgebrochener Upload → Notfall-Seite (esp32dev).
- Wiederherstellung per curl → UI wieder da. Die SPA lädt im Browser ohne
  Konsolenfehler. Der Upload-Flow der Notfall-Seite ist im Browser-Pane
  geprüft (Dummy-Tar → `200` → Reload).

**Nicht verifiziert:** Den Upload über die Notfall-Seite mit einem echten
UI-Tar gab es nur per curl; das Browser-Pane kann keine lokale Datei wählen.
Auf dem LilyGo (SD, ohne Flag) läuft der unveränderte Staged-Pfad, dort nicht
neu geflasht.

**Nebenbefund:** Mein PowerShell-Serial-Logger am nativen USB-CDC des S2 hat
das Board beim Schließen/Neuöffnen des Ports in den ROM-Download-Modus
geschickt (COM7, 303A:0002). Das Board war danach offline und wurde per USB
neu geflasht. Den S2-Port also nicht in einer Reopen-Schleife mit DTR-Toggle
mitschneiden.

## 2026-09-16 — UI-Tar-Upload auf dem LilyGo S3 (SD) gefixt: zu wenige offene Dateien

`POST /api/update/assets` scheiterte auf dem LilyGo sporadisch mit
`extract failed`, obwohl die SD genug Platz hat. Der native Test-Harness hatte
den Parser schon als Ursache ausgeschlossen.

**Eingrenzung am Gerät:**
- **Alte Firmware** (`02560d5-dirty`, 2,2 h Uptime, Datenlog aktiv): Das volle
  Tar (roh + gz, 522 KB) scheiterte nach 28 672 Byte der ersten Datei. Eine
  ältere Leiche `index-V1ocpu6Q.js` (225 280 Byte) lag noch in `/www/assets`.
  Das gz-only-Tar ging durch.
- **Nach OTA-Neustart:** Auf der aktuellen Firmware gingen 13 von 13 Uploads
  durch. Ein sauberer Build von `02560d5` schaffte ebenfalls 10 von 10.
  Die Änderungen aus 24b0eb7 waren also nicht der Fix, der Fehler hing am
  Laufzeitzustand.
- **Erste Hypothese:** ungeschützte SD-Lesezugriffe von ESPAsyncWebServer
  (bekannte `SdLock`-Lücke). Sie ist schwach, denn diese Lesezugriffe laufen
  im selben AsyncTCP-Task wie das Entpacken, und ein A/B-Test mit 3 Lesern
  blieb unauffällig.
- **Belastungstest mit 4 parallelen JS-Downloads:** 0 von 15 Uploads ok, alle
  mit `open failed (…)`. Das deutete auf `SD.begin()` mit dem Default
  `max_files = 5`: ESPAsyncWebServer hält jede ausgelieferte Datei für die
  ganze Übertragung offen.
- **Beleg für die Handle-Grenze:** Bei 6–8 gleichzeitigen Downloads bekamen
  einige Clients nur 2 589 Byte, also die Notfall-Seite. Das Öffnen der
  JS-Datei scheiterte, und `onNotFound` hielt die UI für fehlend.

**Root Cause:** Die Grenze von 5 gleichzeitig offenen Dateien auf der SD. Ein
Browser lädt UI-Assets bzw. Log-CSVs parallel, und das Datenlog braucht eine
weitere Datei. Liegt das Entpacken in einem solchen Moment, schlägt das
Öffnen fehl.

**Fix:** `main.cpp` mountet die SD mit `max_files = 16` (`kSdMaxOpenFiles`,
mit Kommentar). Das betrifft nur Boards mit SD. LittleFS hat eigene
Defaults und ist nicht betroffen.

**Verifiziert:** `pio test -e native` (37/37), `pio run` auf allen drei Envs.
Am LilyGo per OTA, das Datenlog vorübergehend auf 1 s gestellt:
- 4 JS-Leser + Log-CSV + Datei-Download → 12 von 12 Uploads ok (vorher 0 von 15).
- 8 JS-Leser → 8 von 8 ok.
- Tar-Upload während 8 gedrosselter Downloads → `200`, alle Downloads
  vollständig, keiner bekam die Notfall-Seite.
- UI danach aktuell. Das Log-Intervall steht wieder auf 5 s, `/stress` ist
  gelöscht.

**Nicht restlos geklärt:** Zweimal trat vor dem Fix unter Last statt
`open failed` ein `write failed` auf (einmal bei einem 50-KB-Datei-Upload,
einmal beim Tar). Mit `max_files = 16` gab es das in 20 Uploads unter
starker Last nicht mehr. Die Ursache ist unbelegt.

**Nebenbefunde:**
- Die Notfall-Seite unterscheidet nicht zwischen „fehlt" und „konnte nicht
  geöffnet werden" (neuer Punkt in PLAN.md).
- Direkt nach dem ersten OTA-Boot lieferte die SD einmal eine leere Registry
  und `/config: not a directory`. Nach einem weiteren Neustart war alles
  normal, nicht erneut aufgetreten.
- Jede Änderung einer Log-Konfiguration beginnt eine neue Log-Session. Vom
  Test liegen zwei zusätzliche archivierte Sessions auf dem Gerät, die alte
  ist erhalten.
- Das Öffnen von COM9 (USB-Serial-JTAG des S3) setzt das Board zurück.

## 2026-09-17 — Remote-Discovery + ESP-NOW-Unicast E2E am Gerät

Beide LittleFS-Boards (esp32dev = A, LOLIN S2 Mini = B) auf aktuellen
`main`-Stand geflasht und per HTTP gegeneinander getestet (Discovery über
ESP-NOW und MQTT, Remote-Item anlegen, `/set` über beide Transporte,
Verhalten bei Board-Ausfall/-Wiederkehr). Ergebnis: alle vier PLAN.md-Punkte
zu diesem Thema abgearbeitet und entfernt — Discovery findet die Items des
jeweils anderen Boards und filtert eigene korrekt heraus, `Remote`-Actuator
schaltet den echten Aktor auf dem Zielboard über beide Transporte, MQTT
(TCP-basiert) ist dabei durchgehend zuverlässig, ESP-NOW dagegen deutlich
verlustbehaftet (~1 von 8 Discovery-Scans erfolgreich trotz durchgehend
verbundener Boards) und ohne Retry-Mechanismus — das ist inhärent (einzelne
unbestätigte Pakete), aber jetzt als PLAN.md-Punkt festgehalten statt nur
vermutet. Dabei zwei weitere Befunde aufgedeckt: die ESP-NOW-Fehleranzeige
(`espnow.error`) kann nach einem erfolgreichen Write fälschlich auf
„fehlgeschlagen" hängen bleiben (Single-Slot-Overwrite eines älteren
Fehler-Reports, in PLAN.md dokumentiert), und das Öffnen des COM-Ports
resettet auch das esp32dev-Board (nicht nur den LilyGo S3 wie bisher
bekannt) — deshalb während des Tests komplett auf Serial-Zugriff verzichtet
und rein über HTTP verifiziert.

**Nachtrag — ESP-NOW-Discovery-Verlustrate behoben:** Root Cause für die
oben beschriebene ~1-von-8-Trefferquote gefunden: `WiFi.setSleep(false)`
fehlte nach dem STA-Connect. Ohne das aktiviert der ESP32 Modem-Sleep, sobald
die STA-Verbindung steht — der Funk döst zwischen den AP-Beacons, und
ESP-NOW-Pakete, die währenddessen eintreffen, gehen komplett verloren (kein
gelegentliches RF-Rauschen, sondern ein systematischer Effekt). Fix:
`WiFi.setSleep(false)` in `main.cpp` direkt nach dem WLAN-Connect, vor der
ESP-NOW-Initialisierung. Nach Reflash beider Boards: 7 von 10
Discovery-Versuchen erfolgreich (davor 1 von 8–10), ab dem vierten Versuch
durchgehend 7/7 — deutliche, reproduzierbare Verbesserung. Aktor-Write über
den Remote-Pfad weiterhin bestätigt funktionsfähig. Der Fehleranzeige-Bug
bleibt als eigener PLAN.md-Punkt offen (unabhängig von der Sleep-Ursache).

**Nebenbefund beim Reflash:** Nach dem zweiten Flash-Vorgang (mit dem
Sleep-Fix) blieb das esp32dev-Board kurzzeitig unerreichbar — weder WLAN
noch lesbarer Serial-Output (nur Rauschen). Ein manueller Power-Cycle durch
den Nutzer hat es zuverlässig zurückgeholt; Ursache nicht geklärt (möglich:
unsauberer BOOT-Button-Übergang beim vorherigen Upload-Versuch hat einen
inkonsistenten Flash-Zustand hinterlassen, der erst nach Reflash + kompletter
Power-Cycle sauber gebootet hat). Bei ähnlichem Verhalten künftig zuerst
Power-Cycle statt weiterer Serial-Diagnose versuchen.

Testkonfiguration (Sensoren/Aktoren/Transport-Settings) danach von beiden
Boards wieder entfernt.

## 2026-09-17 — Fix: ESP-NOW-Fehleranzeige blieb nach erfolgreicher Zustellung hängen

**Root Cause:** `EspNowTransport::onSendStatus()` (WiFi-Task) hat jeden
Zustellstatus nur in einem einzelnen Atomic (`deliveryReport_`) abgelegt;
`tick()` (loop-Task) hat davon nur den *zuletzt* eingetroffenen Report
gelesen und dabei alle dazwischen eingetroffenen überschrieben. Trafen
zwischen zwei `tick()`-Aufrufen ein Erfolg und danach noch ein älterer
Fehler-Callback eines parallel unterwegs gewesenen Pakets ein, gewann der
Fehler und blieb stehen — auch wenn der eigentliche Schreibvorgang
nachweislich angekommen war.

**Fix:** `deliveryErrorMsg_` wird jetzt direkt im Send-Callback
gesetzt/gecleart (mutex-geschützt), nicht mehr über `tick()` gepuffert —
jedes Ereignis wird einzeln und in der Reihenfolge verarbeitet, in der es
eintrifft. `EspNowTransport.h/.cpp` (SensActCtrl), kein API-Vertrag
betroffen.

**Verifiziert:** `pio test -e native` (224/224), `pio run` auf allen drei
Firmware-Envs. Am Gerät (esp32dev = A, LOLIN S2 Mini = B, echter
Power-Cycle von A statt nur ESP-NOW-Toggle, weil der Transport laut Design
auch bei `espnow.enabled=false` weiterläuft): Write bei abgestecktem A →
Fehleranzeige erscheint korrekt; A wieder angesteckt, Write erneut
erfolgreich → Fehleranzeige cleart sofort, kein Hängenbleiben mehr.
PLAN.md-Punkt entfernt.

## 2026-09-17 — Add-Item-Dialog: Discovery herausgelöst + 2-Step-Dialog

**Problem:** `AddItemModal.tsx` (1782 Z., ~70 `useState`, 16 nebeneinander
liegende `role && type`-Guards) war unübersichtlich, und Discovery lag
darin begraben: Remote-Discovery erschien erst nach Rolle → Typ `Remote` →
Transport `mqtt|espnow` — man musste also schon wissen, was man sucht,
bevor man suchen durfte.

**Umsetzung (reiner Layout-/Navigations-Umbau, Feldblöcke und
`handleSubmit` unverändert):**

- Zwei neue Aktions-Karten über der Geräteliste, jeweils nach dem Vorbild
  der WLAN-Suche in `NetworkPage` (Button im `control`-Slot von
  `SettingsCard`): „Geräte suchen“ (`DiscoverDevicesCard`) und „Gerät
  hinzufügen“ (drei Zeilen direkt in `DevicesPage`). Damit entfallen die
  Header-Buttons und der `SpeedDialFab` auf dieser Seite — die Aktionen
  stehen jetzt auf jeder Breite im Seitenfluss. Die Treffer klappen **in
  der Such-Karte selbst** auf statt in einem Dialog; gesucht werden **alle
  Quellen parallel**: `discoverRemote('mqtt')` + `discoverRemote('espnow')` +
  OneWire-Scan über alle bereits konfigurierten DS18B20-Pins (letztere
  sequenziell, weil `/api/bus/scan` synchron im AsyncTCP-Handler läuft).
  Jede Quelle rendert, sobald sie fertig ist; nicht verfügbare Transporte
  (409) werden still übersprungen, alles andere wird eine Notiz. Treffer
  sind nach Quelle gruppiert, Bekanntes ist „bereits angelegt“ markiert.
- Klick auf einen Treffer öffnet den Anlege-Dialog **vorausgefüllt**
  (neue Prop `prefill?: ItemPrefill`). Der Hydrations-Effect keyt weiter
  auf `[open]` — `prefill` gehört bewusst *nicht* in die Deps, sonst würde
  jeder SSE-Tick eine halb getippte Eingabe wegwischen; Vertrag: im selben
  Handler setzen, der den Dialog öffnet, in `onClose` wieder `null`.
- `AddItemModal` ist jetzt zweistufig: Schritt 1 ist der neue
  `ItemTypePicker` (Rolle über das gemeinsame `Segmented`, darunter der
  gruppierte Typ-Katalog aus dem neuen `itemTypes.ts` mit je einer
  Erklärzeile) statt der drei `<select><optgroup>`-Dropdowns; Schritt 2
  zeigt nur noch ID + die Felder dieses einen Typs. Edit öffnet direkt in
  Schritt 2 (die beiden `disabled`-Selects entfallen); die neue Unterzeile
  `Rolle · Typ` trägt die Information, die vorher nur im Select stand.
- Der DS18B20-Inline-Scan bleibt im Formular — er ist ein Feld-Helfer für
  einen manuell eingetippten Pin, keine Geräte-Suche.

Netto −150/+30 Zeilen in `AddItemModal.tsx`, ohne Churn in den
per-Typ-Feldblöcken. Keine Firmware-/Routen-Änderung, `openapi.yaml`
unberührt.

**Verifiziert:** `pnpm typecheck` + `pnpm build` grün. Gegen esp32dev live
durchgeklickt: Schritt 1/2 inkl. Zurück und Rollenwechsel, Edit eines
PID-Reglers (kein Zurück-Chevron, AutoTune intakt), verschachteltes
Öffnen aus „Dashboard-Inhalte“ (startet in Schritt 1), Suche findet alle
drei Quellen — OneWire GPIO 2 (`28:ff:19:…`, „bereits angelegt“),
`MQTT · brewcontrol-esp32dev` (Sensor) und `ESP-NOW · brewcontrol-lolin`
(Aktor `IDS1`) —, alle Prefill-Pfade inkl. sichtbar vorausgewählter
Bus-Adresse und automatisch auf „Aktor“ gewechselter Rolle, DS18B20
end-to-end angelegt und wieder gelöscht, kein Prefill-Leak beim nächsten
„+ Hinzufügen“, beide Karten bei 375×812. Keine Konsolenfehler.

**Nebenbefund:** ein Zwischenstand hatte beide Buttons in *einer* Karte —
zwei Buttons im `control`-Slot von `SettingsCard` sind `shrink-0`, während
der Textblock `flex-1 min-w-0` ist, also zerquetschen sie auf einem
375-px-Display den Titel auf wenige Zeichen pro Zeile. Eine Karte pro
Aktion umgeht das; wer je zwei Buttons in einen `control`-Slot legt,
läuft wieder hinein.

## 2026-09-17 — Dashboard-Inhalte-Dialog: Auswahlliste statt Checkbox-Wüste

`DashboardContentModal` bestand aus sechs `fieldset`-Blöcken mit nativen
Checkboxen im Flow-Umbruch: ~14 px Trefferfläche (schlecht am Tablet),
keine Hierarchie zwischen Gruppen und Inhalten, nur rohe IDs ohne Kontext,
kein Hinweis wie viel ausgewählt ist, und die drei
„+ Neues … erstellen“-Links sahen in `text-faint` wie deaktivierter Text
aus.

Ersetzt durch eine WinUI-ListView-artige Auswahlliste:

- Jeder Eintrag ist eine vollbreite Zeile (Rollen-Icon | Name | Detail |
  Checkbox, ~44 px hoch, ganze Zeile klickbar), ausgewählte Zeilen mit
  `bg-accent/10` + Accent-Icon.
- Die Detailspalte zeigt Live-Kontext aus dem Snapshot: Sensor-Messwert
  bzw. „n Kanäle“ bei Multi-Channel-IDs, An/Aus bei binären Aktoren,
  Sollwert beim Regler, Serien-/Schrittzahl bei Chart und Programm,
  Dauer beim Timer.
- Gruppenköpfe kleben beim Scrollen (`sticky top-0 bg-surface`) und
  tragen einen `n/m`-Zähler; im Kopf steht „x von y ausgewählt“.
- Suchfeld erst ab mehr als 8 Einträgen (`SEARCH_THRESHOLD`) — filtert
  über die Labels, leere Gruppen fallen weg, sonst „Keine Treffer“.
- Die Erstellen-Aktionen sind normale Zeilen mit Plus-Icon und stehen am
  Ende **ihrer** Gruppe („Neuer Sensor“ unter Sensoren usw.) statt als
  blasser Link-Block am Listenende. Charts haben keine — ein Chart wird
  auf seiner eigenen Seite angelegt. Eine leere Gruppe bleibt sichtbar,
  solange sie von hier aus befüllt werden kann, damit der erste Sensor
  eines frischen Geräts einen Klick entfernt ist. Während einer Suche
  sind die Zeilen ausgeblendet (kein Suchtreffer).

Dafür bekam `AddItemModal` eine optionale Prop `initialRole`: der
Typ-Picker startet auf der Rolle der angeklickten Gruppe, sein
Segmented-Control schaltet weiterhin frei um. Zwei Zeilen dort, sonst
keine Änderung an dem Dialog.

**Verifiziert:** `pnpm typecheck` grün. Live gegen `brewcontrol.local`
(LilyGo, 12 Einträge) durchgeklickt: Zeilenklick schaltet um und
aktualisiert Kopf- und Gruppenzähler, Suche „ma“ filtert auf Regler/
Charts/Programme, Scrollen mit klebenden Köpfen, Light- und Dark-Theme,
375x812. „Neuer Regler“ öffnet den Typ-Picker auf Regler, „Neuer Sensor“
auf Sensor (Rolle wechselt pro Klick, kein Hängenbleiben).
Abschließend mit „Abbrechen“ verlassen — keine Config auf dem Gerät
verändert. Keine Konsolenfehler.
---

## 2026-09-18 — WebSocket-Autodiscovery per mDNS + Kopplung durch Rückruf

**Ausgangslage:** Eine WebSocket-Remote-Verbindung musste an zwei Stellen von
Hand eingerichtet werden — die Hub-URL auf dem Sensor-Board, das Remote-Item auf
dem Gerät mit der UI. Eine wechselnde DHCP-IP brach sie.

**Verworfene Alternative — Rollentausch.** Naheliegend war, die Topologie
umzudrehen (Datenbesitzer = Server, Konsument = Client pro Peer). Die Library
könnte das sofort: `WebSocketTransport.h:23-25` hält ausdrücklich fest, dass die
Rollen nur bestimmen, *wer* verbindet, und die Retain-Emulation läuft
symmetrisch. Dagegen sprach der blockierende Connect: `WebSocketsClient::loop()`
verbindet synchron (bis `WEBSOCKETS_TCP_TIMEOUT`, hier 1 s) und wiederholt das
alle 5 s je unerreichbarem Peer — beim Rollentausch zahlt das genau das Board
mit dem Regler. Begrenzbar wäre es (Round-Robin über getrennte Peers), aber
belegen ließe sich das erst am Gerät.

**Umsetzung — Rückruf.** Die Topologie bleibt, wie sie ist; nur die
*Konfiguration* wandert auf das Gerät mit der UI:

1. **Jedes Board kündigt sich an.** `startMDNS()` in `main.cpp` inseriert
   zusätzlich `_sensactctrl._tcp` auf Port 80 — dem Port der HTTP-API, die jedes
   Board tatsächlich bedient — mit TXT `dev`, `prefix`, `ver` und `ws`
   (eigener Hub-Port, `0` = kein Hub). Der initiale `startMDNS()`-Aufruf
   wanderte dafür hinter `settingsStore.loadFromSD()`, weil die TXT-Records aus
   den Settings kommen; der Re-Announce bei `STA_GOT_IP` blieb unverändert.
2. **`MdnsBrowser`** (neu, `MdnsBrowser.h/.cpp`) durchsucht das LAN. Gleiche
   Zustandsmaschine wie `SensActCtrl::DiscoveryScanner` (3-s-Fenster, 30-s-TTL,
   `requestScan()`/`takeResults()` unter Mutex), damit der HTTP-Handler nur
   armen und abholen kann und die Query aus `loop()` läuft. Bewusst die
   asynchrone IDF-API (`mdns_query_async_new` + `mdns_query_async_get_results`
   mit Timeout 0), **nicht** `MDNS.queryService()` — das blockiert das ganze
   Suchfenster.
3. **`GET /api/remote/peers`** liefert die Boards im 202-Poll-Muster der
   übrigen Scans. Ob ein Board schon benutzt wird, berechnet das Frontend aus
   `GET /api/config`, das es für den Scan ohnehin lädt — dafür braucht die
   Firmware nichts zu wissen.
4. **`POST /api/remote/pair`** schickt dem Ziel-Board dessen eigene
   `POST /api/settings` mit `websocket.publishEnabled` + `hubUrl`. Kein neuer
   Endpoint auf der Empfängerseite: Validierung, Persistenz und Reboot sind
   dort schon implementiert. Der Aufruf läuft über `HTTPClient` aus
   `WebUI::tick()`, nicht aus dem Handler — der async_tcp-Task bedient jeden
   Request und den SSE-Stream, der darf für einen Netz-Roundtrip nicht stehen.
   Deshalb antwortet die Route `202` und `GET /api/remote/pair` liefert das
   Ergebnis (`200` gekoppelt, `401` Passwort nötig, `502` nicht erreichbar,
   `409` ohne eigenen Hub). Passwortgeschützte Ziele werden vorher über
   `/api/auth/login` angemeldet und das `bcsid`-Cookie mitgeschickt.
   Timeout 2 s, weil jede Sekunde davon eine Sekunde ohne Sensor-Tick ist.
5. **Item-Suche für WebSocket** ist damit die triviale Verdrahtung, die in
   PLAN.md stand: ein dritter `DiscoveryScanner` in `RemoteDiscovery` über
   `webSocketService.hubTransport()`, plus `websocket` im Transport-Enum von
   `/api/remote/discover`.

**Frontend:** `DiscoverDevicesCard` hat jetzt zwei Stufen — die Gruppe „Boards
im Netz" (Koppeln-Button, „dieses Gerät" beim eigenen Board, „gekoppelt" wenn
schon ein Item darauf zeigt, Passwortfeld erst wenn das Ziel `401` antwortet)
und darunter wie bisher die gefundenen Items, nun auch aus dem
WebSocket-Transport. `ItemPrefill.transport` kennt `websocket`; im
`AddItemModal` brauchte es kein neues Feld, weil der Hub geräteweit ist. Die
Hub-URL bleibt auf der WebSocket-Seite als Fallback stehen, mit einem Hinweis,
dass normalerweise vom Hub aus gekoppelt wird.

**Zwei Dinge fielen beim Selbst-Review auf und wurden gleich mit erledigt:**

- Die Pairing-Felder in `WebUI` werden vom async_tcp-Task gelesen und von
  loopTask geschrieben. Bei `int`/`bool` wäre das wie bei `rebootAtMs_`
  tolerierbar, bei `String` nicht: eine Zuweisung gibt den alten Puffer frei und
  kann dem Leser einen Dangling-Pointer hinterlassen — genau der Grund, warum
  `WebSocketTransport::lastError_` ein nacktes Literal ist. Jetzt unter
  `pairMutex_`, mit zwei Flags (`pairArmed_` = wartet auf tick(), `pairBusy_` =
  armiert oder unterwegs) und **ohne** gehaltene Sperre während des
  HTTP-Roundtrips, damit der GET-Poll nicht 2 s blockiert.
- `startMDNS()` läuft auf dem WiFi-Event-Task und ruft `MDNS.end()`; `mdns_free()`
  gibt dabei auch ein offenes Such-Objekt frei. Ein WLAN-Reconnect mitten im
  3-s-Scan wäre ein Use-after-free gewesen. `MdnsBrowser::abandonSearch()` wird
  jetzt vor `MDNS.end()` gerufen, `tick()` lässt den Zeiger daraufhin fallen
  (ohne `delete`) und fällt auf Idle zurück — der nächste Poll startet einfach
  neu.

**Keine Library-Änderung** — SensActCtrl blieb unangetastet.

**Verifiziert:** `pio test -e native` 224/224 grün (Regression),
`pio run` baut alle drei Envs (esp32dev 88.1 % Flash, lolin_s2_mini 84.9 %,
lilygo_t_display_s3_amoled 24.4 %),
`pnpm typecheck` + `pnpm build` grün, `redocly lint` sauber (nur die
vorbestehende `info-license`-Warnung). Der ganze UI-Ablauf gegen einen
HTTP-Mock im Scratchpad durchgespielt: Scan listet drei Boards (eigenes als
„dieses Gerät"), Koppeln setzt die Zeile auf „gekoppelt" und meldet „Board
gekoppelt, es startet jetzt neu", das geschützte Board antwortet `401` →
Passwortfeld → Erfolg, danach erscheint die Gruppe „WebSocket · kessel2" mit
ihren Items, und ein Klick darauf öffnet den Dialog mit `device=kessel2`,
`remote_id=kessel_temp`, Prefix und Transport-Schalter auf WebSocket.
MQTT/ESP-NOW-`409` werden weiterhin still übersprungen.

**Offen (in PLAN.md):** die Hardware-Verifikation am echten Board — insbesondere
ob `.local` in der gespeicherten `hubUrl` auflöst
(`CONFIG_LWIP_DNS_SUPPORT_MDNS_QUERIES=y` ist bisher nur aus der
Framework-Config belegt, nicht am Gerät). Neu notiert wurden außerdem der
`/set`-Broadcast im Hub (Unicast wäre ~15 Zeilen in der Library) und
„zuletzt gesehen" pro Remote-Item als Ersatz für den fehlenden Peer-Status.
---

## 2026-09-18 — mDNS-Kopplung E2E am Gerät + `self` entfernt

Hardware-Runde zur Autodiscovery (Eintrag oben), esp32dev als Hub/Master
(192.168.178.74), LOLIN S2 Mini als Leaf (192.168.178.82), LilyGo bewusst nur
als Zuschauer in der Suche. Alles über HTTP, kein Serial (Port-Open resettet
beide Boards, PLAN.md).

**Durchgelaufen:**

- Neue Firmware auf allen drei Boards, alle antworten auf `/api/remote/peers`.
- `409 websocket hub not enabled` ohne eigenen Hub, `400 missing host` ohne
  `host`.
- mDNS-Suche von allen drei Boards: jedes findet die beiden anderen, TXT `dev`
  und `prefix` korrekt. `ws` stimmt ebenfalls — nachdem A den Hub bekam, meldet
  die Suche von B aus `ws_port: 8081` für A und `0` für den LilyGo, auch nach
  A's Reboot (der Re-Announce bei `STA_GOT_IP` greift).
- Kopplung: `202` → `code 200`. B hat danach
  `hubUrl: ws://brewcontrol-esp32dev.local:8081` gespeichert und ist
  `connected=True`. **Damit ist die offene Frage beantwortet: `.local` löst am
  Gerät auf** (`CONFIG_LWIP_DNS_SUPPORT_MDNS_QUERIES=y` war bisher nur aus der
  Framework-Config belegt). A meldet stabil `hubClients=1`.
- Item-Suche `?transport=websocket` findet B's Items. Ein auf B **neu**
  angelegter Sensor (`DigitalInput` GPIO 3, Pullup — als Testsensor ohne
  Hardware) erscheint dabei ohne Reboot, die Live-Hooks des `RemotePublisher`
  greifen also auch hier.
- Remote-Sensor auf A: `v=1 ok=True`, Zeitstempel laufen im 2-s-Takt.
- `/set` von A auf B's Aktor `IDS1`: 0.1 kam innerhalb einer Sekunde an
  (`v=target=0.1`), danach sauber zurück auf 0.
- `401`-Pfad mit echtem Zugriffsschutz: Passwort auf B gesetzt → Kopplung ohne
  Passwort liefert `code 401` „Board … ist passwortgeschützt", mit Passwort
  `code 200` (der Login-plus-Cookie-Weg trägt also am Gerät). Passwort danach
  wieder entfernt.
- `502` bei unerreichbarem Board nach ~2 s (`kPairTimeoutMs`).
- **Die Auslagerung aus dem Handler ist belegt:** während loopTask 2 s im
  blockierenden Connect hing, hat `GET /api/remote/pair` weiter geantwortet und
  `state: running` geliefert.
- Reboot B: Reconnect von selbst nach ~4–6 s. Reboot A: das Remote-Item kommt
  aus `registry.json` zurück und B verbindet sich ohne erneutes Koppeln.
- A bleibt flüssig: Snapshot-Latenz 22–46 ms (zwei Ausreißer ~320 ms), keine
  Stalls in Sekunden-Größe — erwartungsgemäß, weil A in dieser Topologie nie
  selbst wählt.
- `hubClients` stand direkt nach B's Reboot kurz auf `2` (der alte Socket war
  noch gezählt) und fiel dann auf `1` — der Heartbeat räumt auf, kein Leck von
  Client-Slots (relevant, weil `WEBSOCKETS_SERVER_CLIENT_MAX` = 5 ist).

**Fund: `self` war toter Code.** Kein Board listet sich selbst — der
ESP32-mDNS-Responder beantwortet eigene Queries nicht, auf allen drei Boards
bestätigt. Das Feld war damit immer `false`, die „dieses Gerät"-Zeile in der UI
unerreichbar und die Aussage in `openapi.yaml`/`README.md` („This device is
reported too, marked `self`") falsch. Entfernt: `DiscoveredPeer::self` samt
`MdnsBrowser::begin()`/`ownHostname_` (die nur dafür existierten), das Feld in
der `/api/remote/peers`-Response, in `types.ts` und der UI-Zweig. Doku
korrigiert, dazu je ein Kommentar in `MdnsBrowser.h`, `WebUI.cpp` und
`types.ts`, damit das Feld nicht wieder eingebaut wird.

**Nebenbei bestätigt:** der Messwert auf A wurde beim Ausfall von B *nicht* als
veraltet markiert — der Backlog-Punkt „zuletzt gesehen pro Remote-Item" ist real
und nicht bloß theoretisch.

**Verifiziert:** `pio run -e esp32dev` und `-e lolin_s2_mini` bauen nach dem
Aufräumen weiter, `pnpm typecheck` + `build` grün, `redocly lint` sauber.

**Zustand der Testboards danach** (bewusst so gelassen): esp32dev ist Hub, sein
alter `publishEnabled` auf den LilyGo ist aus; S2 Mini ist an ihn gekoppelt und
hat den Testsensor `wstest`; esp32dev hat die Remote-Items `lolin_wstest` und
`lolin_ids1`.

## 2026-09-18 — Captive-Portal-UX angeglichen + Reload-mit-Retry in Preact übernommen

Zwei getrennte, aber verwandte Änderungen: (1) Captive Portal
(`WiFiSetupPortal.cpp`) und die Preact-Netzwerk-Settings-Seite
(`NetworkPage.tsx`) machten denselben WiFi-Connect-Flow mit unterschiedlicher
UX — echtes Code-Sharing würde bedeuten, dass der Portal-Server die gebaute
SPA aus dem (zum Portal-Zeitpunkt bereits gemounteten) Filesystem ausliefert;
bewusst verworfen (größerer Umbau, Risiko in restriktiven Captive-Portal-
WebViews, zusätzlicher Flash-Bedarf auf der knappen 256-KB-LittleFS-Partition).
Stattdessen die Netzwerkliste im Captive Portal von Hand an NetworkPage
angeglichen: Listen-Darstellung mit Signalbalken statt `<select>` (gleiche
RSSI-Bucket-Schwellen: ≥-55/-65/-75/-85 dBm → 4/3/2/1/0 Balken), Dedupe nach
SSID (stärkster Treffer gewinnt) + Sortierung nach Signal, "Enter network
manually"-Fallback — alles weiterhin reines Vanilla-JS/Inline-CSS ohne
Build-Schritt, nur `kSetupHtml` in `WiFiSetupPortal.cpp` geändert, Server-
Handler unangetastet.

(2) Die Reload-mit-Retry-Anzeige des Captive Portals (`afterSaved()`:
Countdown, periodischer `fetch(url,{mode:'no-cors'})`-Probe, Auto-Redirect
beim ersten Erfolg, garantierter Fallback-Link) als `ReloadRetry`-Komponente
nach Preact übernommen (`web/src/components/ReloadRetry.tsx`) und an die
Stelle der bisherigen statischen "Gerät startet neu…"-Blöcke gesetzt:
`NetworkPage.tsx` (WLAN-Wechsel/Hostname-Wechsel mit `{host}.local`-Ziel,
WLAN-Reset bewusst ohne Ziel — Board wird zum AP, nicht mehr über die
aktuelle Verbindung erreichbar), `EspNowPage.tsx`, `MqttPage.tsx`,
`WebhookPage.tsx`, `WebSocketPage.tsx`, `BackupPage.tsx` sowie neu
`FirmwarePage.tsx` (hatte bisher nach Update-Install gar keine Neustart-
Anzeige). Bei Ziel-Origin gleich der aktuellen Seite lädt `ReloadRetry` per
`location.reload()` (Pfad bleibt erhalten), bei Hostname-Wechsel per
`location.href` auf die neue `.local`-Adresse.

**Verifiziert:** `pio run -e esp32dev` kompiliert (Flash 88.3 %, RAM 18.2 %),
`pnpm typecheck` grün, alle geänderten Preact-Seiten im Dev-Server gegen ein
echtes Testboard ohne Konsolenfehler geladen (Netzwerk-, MQTT-, Backup- und
Firmware-Seite) — reboot-auslösende Aktionen dabei bewusst nicht angeklickt,
um das laufende physische Gerät nicht neu zu starten. Der tatsächliche
Auto-Reconnect-Erfolgsfall (Board antwortet nach echtem Reboot wieder) ist
damit nicht E2E getestet, die Logik ist aber ein direkter Port der bereits
produktiv laufenden Captive-Portal-Implementierung.

## 2026-09-18 — Fix: manueller Firmware-/UI-Upload zeigte weder Erfolg noch Fehler an

Nutzer-Nachfrage, ob das manuelle Hochladen des UI-Pakets einen Neustart
braucht, deckte einen Bug in `FirmwarePage.tsx` auf: der `.catch()`-Handler
beider Uploads (`Firmware (.bin)`/`UI-Paket (.tar)`) setzte den Fortschritt
bei einem Fehler auf `null` — der Ladebalken verschwand dabei kommentarlos,
ohne jede Fehlermeldung. Bei Erfolg blieb er dauerhaft bei „100%" hängen,
ebenfalls ohne Bestätigung. Laut `docs/openapi.yaml` reboottet nur der
Firmware-Upload (`POST /api/update/firmware`, ~500 ms nach der Antwort);
der UI-Paket-Upload (`POST /api/update/assets`) explizit **nicht** — der
Swap auf `/www` passiert im nächsten Main-Loop-Tick.

Fix: Firmware-Upload-Erfolg nutzt jetzt denselben `rebooting`-State/
`ReloadRetry` wie der GitHub-Install-Flow (Polling wird vorher gestoppt).
UI-Paket-Upload zeigt bei Erfolg eine grüne "UI-Paket installiert."-Zeile
(kein Reboot). Beide zeigen bei Fehler jetzt den tatsächlichen Server-Text
(z. B. `Bad Size` bzw. `extract failed: …`) statt stillschweigend zu
verschwinden.

**Verifiziert:** `pnpm typecheck` grün, Seite im Dev-Server gegen das
Testboard ohne Konsolenfehler geladen. Kein echter Upload getestet — Risiko,
über den echten Firmware-/Asset-Update-Endpoint des laufenden Geräts eine
kaputte Datei zu flashen.

## 2026-09-19 — Dashboard: Elemente per Drag & Drop anordnen

Die Dashboard-Anordnung war fest verdrahtet (Programm-Spalte, Chart-Bereich,
Karten-Grid in fester Reihenfolge). Jetzt liegt sie als Baum von Bereichen im
Dashboard selbst und ist im Bearbeiten-Modus per Drag & Drop veränderbar —
Vorbild war ein Docking-System im IDE-Stil (Nutzer-Referenz: Video zu
„Dynamix Layout").

**Entscheidungen (mit dem Nutzer geklärt):** Docking-Bereiche mit ziehbaren
Trennern statt eines festen Rasters; beliebig viele Kartengruppen, eine Karte
darf auch allein einen Bereich belegen; Speicherung am Gerät pro Dashboard; die
automatische Kopplung „erster Regler eines Programms steht über dem
Programm-Widget" entfällt ersatzlos (der Regler ist jetzt frei platzierbar); ein
Mehrkanal-Sensor bleibt eine Einheit (Ref über die Base-Id, Kanal-Cards
untereinander). Anordnen und Trenner nur im Bearbeiten-Modus; mobil (<1024 px)
wird der Baum in Lesereihenfolge linearisiert und ist dort nicht editierbar.

**Keine neue Dependency.** `dockview-core` (+85 KB gz) hätte das Bundle fast
verdoppelt, `@dynamix-layout/core` (7,5 KB gz) rechnet nur Geometrie, ist
Tab-zentriert und dokumentiert keinen Touch-Support. Die eigene Umsetzung kostet
**+3,9 KB gz** (JS 105,20 → 109,07 KB, gegen denselben Commit gemessen).

**Datenmodell:** `LayoutNode` = `{split:'row'|'col', sizes, children}` oder
`{items:[ref]}`; Refs tragen einen Typ-Präfix (`sensor/<baseId>`, `actuator/`,
`controller/`, `chart/`, `program/`, `timer/`), weil Charts, Programme und Timer
eigene Id-Räume haben. Ein Ref allein im Blatt füllt seinen Bereich (Chart und
Programm mit `fill`), mehrere fließen als Karten-Raster, in dem Chart und
Programm die ganze Zeile nehmen.

**`web/src/dashboardLayout.ts` (neu, reine Funktionen):** `memberRefs`,
`defaultLayout` (bildet die bisherige Anordnung nach, damit bestehende
Dashboards unverändert aussehen), `reconcile`, `normalize`, `moveRef`,
`resizeSplit`, `renameRef`, `linearize`. `moveRef` markiert die gezogene Ref
zuerst mit einem Platzhalter gleicher Länge, fügt dann am Ziel ein und entfernt
den Platzhalter erst danach — so bleiben Zielpfad und Einfüge-Index gültig,
unabhängig davon, woher die Karte kommt. `reconcile` läuft bei jedem Render:
tote Refs raus, neue kleine Karten an die letzte Kartengruppe, neue Charts und
Programme in einen eigenen Bereich, kaputtes JSON → Default-Anordnung.

**`web/src/components/DashboardLayout.tsx` (neu):** rekursives Flex-Rendering,
Trenner mit Pointer-Capture (Live-Entwurf im lokalen State, Commit erst bei
`pointerup`), Drag am Griff über der Karte (ab 4 px Bewegung), Hit-Test über die
Rects der `data-path`-Elemente, Overlay für Zielbereich und Einfüge-Marke,
Abbruch per Escape. Die Container tragen bewusst kein `transform`/`filter`:
`ConfirmModal` und die übrigen Dialoge rendern `fixed` ohne Portal und würden
sonst am Bereich statt am Fenster ausgerichtet (am laufenden UI gegengeprüft).
Die Render-Helfer sind einfache Funktionen statt verschachtelter Komponenten —
als Komponenten hätten sie bei jedem Snapshot (1 Hz) eine neue Identität und den
uPlot-Chart sekündlich neu aufgebaut.

**Firmware:** `DashboardStore::DashboardCfg` bekommt ein `JsonDocument layout`,
das die Firmware nur durchreicht (laden, serialisieren, in `fillFromJson`
ersetzen); fehlt der Schlüssel im Body, wird die Anordnung gelöscht — dieselbe
Replace-Semantik wie bei allen Listen. Damit das Frontend nie versehentlich ein
Feld verliert, schickt `Dashboard.tsx` jedes Update über ein neues `dashBody()`,
das immer den vollständigen Datensatz sendet (die Feldliste war seit den
Darstellungsmodi ohnehin an zwei Stellen dupliziert). `GET /api/backup` nutzt
`store_.serialize()`, das Layout ist damit automatisch im Backup;
`docs/openapi.yaml` kennt jetzt `DashboardLayoutNode`.

**Verifikation:** 22 Checks der reinen Layout-Funktionen per Wegwerf-Skript
(u.a. Verschieben in dieselbe Gruppe, letztes Item verlässt einen Bereich,
Kanten-Andocken im gleichgerichteten Split, kaputtes JSON, keine Duplikate);
`pnpm typecheck` grün; `pio run -e esp32dev` grün; Redocly valide (nur die
bekannte `license`-Warnung). Im Browser gegen einen lokalen Mock-Server geprüft
(das Testboard läuft noch ohne das Feld, und ein Schreibzugriff auf die echte
Gerätekonfiguration wäre für einen UI-Test zu invasiv): Default-Anordnung
identisch zur bisherigen, Andocken an eine Kante, Einsortieren an eine bestimmte
Position einer Gruppe, Trenner ziehen (Chart skaliert per ResizeObserver mit),
Persistenz über Reload, **genau ein POST pro Aktion**, ConfirmModal zentriert
über der ganzen Seite, Dashboard mit toter Chart-Referenz ohne leeren Bereich,
Entfernen klappt den Bereich zu, mobile Linearisierung inklusive
Programm-Bottom-Sheet.

**Unterwegs gefixt:** Die Andock-Zone war als 25 % der Bereichsgröße definiert —
bei 990 px Breite ein 247-px-Band, das die linke Hälfte der ersten Karte
verschluckte und die erste Position einer Gruppe unerreichbar machte. Jetzt
höchstens 64 px (und weiterhin maximal ein Viertel, damit kleine Bereiche eine
Mitte behalten).

**Bewusst so:** Das Entfernen einer Karte filtert deren Ref nur beim Rendern
heraus, die gespeicherte Anordnung behält sie bis zum nächsten Anordnen. Eine
später wieder hinzugefügte Karte landet dadurch an ihrem alten Platz (am UI
beobachtet und so belassen — Positionsgedächtnis ist hier das nützlichere
Verhalten); wirklich neue Karten hängen sich an die letzte Kartengruppe.

**Offen:** Der Escape-Abbruch ließ sich nicht automatisiert prüfen (die
Browser-Automatisierung kann keinen gedrückten Mausknopf halten). Die Persistenz
am echten Gerät steht bis zum nächsten Flash aus, siehe PLAN.md.

## 2026-09-19 — Dashboard-Layout: Kartenbereiche wachsen nicht mehr ins Leere

Nutzer-Feedback zum frisch gebauten Drag-&-Drop-Layout: die Ansicht im
Bearbeiten-Modus deckt sich nicht mit der danach. Ein Bereich, den man im
Bearbeiten-Modus so weit zusammenzieht, dass eine Scrollbar erscheint, ist
nach „Fertig“ zu groß für seine zwei Karten.

**Gemessen** (Maischen-Tab, 1600x1000): Layout-Gesamthöhe 851 px normal
gegen 801 px im Bearbeiten-Modus — das eingeblendete Hinweisfeld unter den
Tabs kostet 50 px. Dazu pro Bereich im Bearbeiten-Modus 2 px Rahmen +
16 px `p-2`, also 18 px weniger Inhaltshöhe. Da `sizes` reine Anteile sind
(Summe 1), skaliert derselbe Anteil auf zwei verschiedene Gesamthöhen —
der Inhalt darin aber nicht.

**Eigentliche Ursache** (Nutzer-Beobachtung, bestätigt): `fill` wird nur
von `ChartRow` und `ProgramCard` ausgewertet. Sensor-, Aktor-, Regler- und
Timer-Karten ignorieren es und behalten ihre `widgetSizeClass`-Höhe. Ein
Bereich aus reinen Karten kann zusätzliche Höhe also gar nicht nutzen —
sie wird immer zu Luft unter der letzten Karte.

Umsetzung:

- Neues `isRigid(node)` in `dashboardLayout.ts`: ein Teilbaum ist starr,
  wenn er nur Karten-Refs enthält (leerer Bereich zählt als flexibel, ein
  0-px-Slot wäre nicht mehr bedropbar).
- In `DashboardLayout` bekommt ein starres Kind einer **Spalten**-Teilung
  `flex: 0 1 auto` statt eines Anteils, nimmt also seine Inhaltshöhe und
  überlässt den Rest den flexiblen Geschwistern. Zeilen-Teilungen bleiben
  unverändert: die Breite entscheidet, wie viele Karten pro Reihe passen.
- Die Grow-Faktoren der flexiblen Kinder werden auf ihre Summe
  normalisiert. Ohne das blieb im Test Platz ungenutzt (Chart 379 statt
  631 px): Anteile summieren zu 1, fällt eines aus dem Wachsen heraus,
  verteilt Flexbox nur noch den entsprechenden Bruchteil des freien
  Platzes.
- Flexible Geschwister eines starren Bereichs bekommen `MIN_AREA_PX` als
  Untergrenze — sonst schrumpft bei zu kleinem Fenster ausschließlich der
  starre Bereich (Basis `auto`), und der flexible fiele auf 0 px.
- Ein Trenner neben einem starren Bereich hätte nichts zu verschieben und
  ist deshalb inert: keine Handler, kein Resize-Cursor, kein Hover — die
  Lücke bleibt gleich groß.

**Verifiziert** am LilyGo (1600x1000, Maischen): Kartenbereich 204 px =
exakt Inhaltshöhe, Chart 631 px, zusammen mit dem 16-px-Trenner genau die
851 px des Layouts. Im Bearbeiten-Modus 220 px Inhaltshöhe bei 220 px
Inhalt — keine Scrollbar mehr, der Unterschied sind nur noch die 16 px
Bearbeiten-Polsterung. Trenner-Klassen geprüft: der senkrechte behält
`cursor-col-resize` + Hover, der waagerechte über dem Kartenbereich ist
leer. Tabs Vorbereitung/Kochen gegengesehen, `pnpm typecheck` grün.

**Bewusst offen:** Das Hinweisfeld verkürzt weiterhin die flexiblen
Bereiche um 50 px, solange der Bearbeiten-Modus läuft (siehe PLAN.md) —
für Kartenbereiche ist der Effekt jetzt weg, Charts und Programme
skalieren dabei sauber mit.

## 2026-09-20 — Regler-Karten nach Vorlage + frei wählbare Sekundärfarbe

Nutzer-Vorlagen für alle drei Größen der Regler-Card. **Groß:** Ist links und
Soll rechts nebeneinander groß, darunter der Slider mit Min/Max, darunter
„Ausgang" mit Prozentwert und Balken. **Gauge:** Soll, Ist und Ausgang
untereinander im Kreis. **Kompakt:** dieselben drei Werte in einer Zeile über
einem schmalen Slider. Der Klick auf den Sollwert macht daraus in allen drei
Größen ein Eingabefeld (unverändert, nur die Schriftgröße passt sich an).

**Farben.** Der Sollwert ist weiß, der Istwert trägt die Akzentfarbe, und die
Füllung von Slider und Bogen ist **immer** Akzent — die bisherige Rotfärbung
unterhalb des Sollwerts entfällt (ausdrücklicher Wunsch: keine Zustandsfarbe an
dieser Stelle). Ausgangsbalken und -prozentwert nutzen eine neue
**Sekundärfarbe**, die wie die Akzentfarbe am Gerät liegt (`SettingsStore`,
`theme.ts` setzt `--secondary`/`--secondary-fg`, Einstellungen → Darstellung mit
sechs Vorgaben plus freier Wahl, Default `#22c55e`). Damit gilt sie geräteweit
und ist über `GET /api/backup` gesichert; `WebUI.cpp` validiert sie wie den
Akzent (`invalid secondary`), `docs/openapi.yaml` ist nachgezogen. Ältere Geräte
ohne das Feld fallen auf den Default zurück (`secondary?` in `ThemeSettings`).

**Ausgang in Prozent.** Der Wert wird jetzt einheitlich als Prozent des
Aktorbereichs gezeigt (vorher der Rohwert, sobald `max > 1`) — passend zum
Balken. Regler mit getrenntem Heiz-/Kühlausgang bekommen zwei Balken.

**Gauge aufgeräumt.** Min/Max sitzen jetzt in der Lücke des Bogens statt in
einer eigenen Zeile darunter (neuer `rangeLabels`-Schalter, auch von der
SensorCard genutzt). Die Gauge reservierte bisher ein **quadratisches** Feld,
obwohl der Bogen wegen der 90°-Lücke schon bei rund 80 % der Höhe endet — der
tote Streifen darunter ist weg, das Feld endet knapp unter den Bogenenden (aus
der Bogengeometrie gerechnet, nicht geschätzt: 185 statt 220 px bei `size=220`).
Dadurch passt die Gauge-Karte in `row-span-3` statt `row-span-4`
(`widgetSizeClass`, 248 statt 336 px) — 55 px toter Raum weniger pro Karte.
Linienstärke und Knopf sind auf die Maße des linearen Sliders umgerechnet
(6 px Spur, 18 px Knopf aus `styles.css`), vorher 15,4 bzw. 21,6 px.

**Verifikation:** `pnpm typecheck` grün, `pio run -e esp32dev` grün, Redocly
valide (nur die bekannte `license`-Warnung). Im Browser gegen den lokalen Mock
geprüft: alle drei Ansichten inklusive Klick-Edit am Sollwert, Umschalten der
Sekundärfarbe färbt Balken und Prozentwert sofort um und erreicht die API als
`theme.secondary`, Kartenhöhen nachgemessen (Gauge-Karte 251 px bei 250 px
Inhalt, vorher 336 bei 281), Bogenstärke 6 px und Knopf 18 px exakt wie beim
Slider.

**Offen:** Persistenz der Sekundärfarbe am echten Gerät, siehe PLAN.md — das
Testboard läuft weiter mit einer Firmware ohne das Feld.

## 2026-09-19 — Neue Menü-Seite „Rechner" (Brauprozess-Rechner)

Neue Hauptseite (`/rechner`, NavShell-Eintrag) mit 14 kleinen
Brauprozess-Rechnern in 6 Kategorien (Einheiten, Volumen, Mischen,
Effizienz, Karbonisierung, Messen) — bewusst ohne Rezept-Design-Rechner
(IBU, Farbe, Wasserchemie), die sind für eine spätere
„Rezeptentwicklung"-Funktion vorgesehen. Formeln zentral in
`web/src/gravityUnits.ts` (Plato/SG/Brix-Kern) und `web/src/brewMath.ts`
(restliche Formeln) als reine, ungetypte UI-freie TS-Funktionen — damit
später wiederverwendbar. `vitest` neu als Test-Runner eingeführt (bisher
keiner im Web-Frontend), 22 Tests für beide Module. Navigation:
Index-Seite mit Kategorie-Karten (`/rechner`, Muster wie `SettingsIndex`)
plus eine parametrisierte Detail-Seite (`/rechner/:calc`, Muster wie
`ArchivePage`s `:id`-Route) statt 14 einzelner Routen. Zwei zusätzliche
Shared-Components über den ursprünglichen Plan hinaus: `NumberField`
(beschriftete Zahlen-Eingabezeile, bei der Umsetzung als eindeutig fehlend
erkannt — jeder der 14 Rechner hätte sie sonst dupliziert) und
`GravityInput`/`CalcResult` wie geplant.

**Beim Verifizieren im Browser gefunden und korrigiert:** Der ursprünglich
geplante Zusatzmodus „ABV bei unbekannter Stammwürze" (Refraktometer +
Spindel kombiniert, ohne bekannte Stammwürze) lieferte bei realistischen
Testwerten (Brix 8, FG 1.010) negative Ergebnisse (−23,5 °P, −11,8 % vol)
— die zugrundeliegenden Koeffizienten (vermutlich mit der Balling-Formel
verwechselt statt der tatsächlichen Novotny-Formel) waren falsch. Statt
mit TODO-Markierung auszuliefern, wurde der Modus komplett entfernt; der
ABV-Rechner bietet in v1 nur den soliden, getesteten Modus mit bekannter
Stammwürze. Die Refraktometer-Korrektur selbst (Rechner 11) nutzt
dieselben verdächtigen Koeffizienten und bleibt mit TODO(verify)-Hinweis
drin, da ihr Ergebnis zumindest plausibel im Wertebereich liegt (siehe
PLAN.md „Bugs & bekannte Einschränkungen" für alle unverifizierten
Formelkonstanten). Alle anderen Formeln gegen Handrechnung/Referenzwerte
verifiziert (Zylinder-/Kegelstumpf-Volumen exakt hergeleitet und getestet,
Karbonisierung stöchiometrisch aus Molmassen abgeleitet statt aus
erinnerten Tabellenwerten).

## 2026-09-19 — Rechner: Novotny-Formel korrigiert (Refraktometer/ABV/Endvergärungsgrad)

Nutzer stellte die Excel-Datei
`StammwuerzeErmittlungAusBrixUndEsNachNovotnyLinear_V02.xlsx` (Weiß, O.,
V02, 2024) bereit — eine dokumentierte, quellenbasierte Umsetzung der
Novotný-Formel (Novotný, P. (2017), Zymurgy 40(4), 49–54; Ascher, T.,
BrauCampus Graz (2021)). Per `openpyxl` (musste erst installiert werden,
war entgegen der xlsx-Skill-Doku nicht vorhanden) Formeln und Werte aus
allen drei Tabs extrahiert und gegen die vorherige, aus Erinnerung
zusammengesetzte Implementierung abgeglichen — bestätigte den in der
Vorsession dokumentierten Verdacht: Die alte Formel wandte die
Balling-Koeffizienten (0.1808/0.8192) direkt auf den rohen Brix-Wert an,
statt die tatsächliche Novotný-Beziehung zu nutzen
(`SG = 1 + 0,006276·Bgc − 0,002349·Bwc`, mit Bgc = BCF-korrigierter
Brix-Wert). Ersetzt:

- `gravityUnits.ts`: `platoToSg`/`sgToPlato` sind jetzt exakte algebraische
  Inversen derselben Quadratik (`SG = (668−√(668²−820·(463+P)))/410`),
  statt zwei unabhängig gefitteter Näherungsformeln. Gegen das
  Excel-Rechenbeispiel exakt verifiziert (Es=3 → SG=1,0117373721335001,
  auf 9 Nachkommastellen getroffen).
- `brewMath.ts`: neue `apparentExtractFromRefractometer` (Tool A: OG
  bekannt, aktuellen Wert nur per Refraktometer schätzen) und
  `originalExtractFromDualMeasurement` (Tool B: OG unbekannt, aus
  Refraktometer+Spindel rekonstruieren — algebraische Auflösung derselben
  Gleichung nach der anderen Unbekannten) sowie `ballingBeerAnalysis`
  (Alc %w/w, %v/v, Ew, scheinbarer/realer Vergärungsgrad, nach Balling,
  gleiche Quelle). Alle vier gegen das Excel-Rechenbeispiel exakt
  verifiziert (bis auf Rundung in der letzten Dezimale).
- Der in der Vorsession entfernte Zusatzmodus „ABV bei unbekannter
  Stammwürze" (Refraktometer+Spindel-Doppelmessung) ist mit der jetzt
  korrekten Formel wieder in `CalcAbv.tsx` enthalten.
- Im Browser nachgeprüft: Refraktometer-Korrektur zeigt für OE 12°P/Brix
  6,4/BCF 1,03 jetzt plausibel 2,8°P (vorher fälschlich 9,0°P — höher als
  der rohe Brix-Wert, was für eine Alkoholkorrektur unmöglich ist).

`pnpm typecheck` und `pnpm test` grün (25 Tests, u. a. alle vier neuen
Referenzwerte exakt aus dem Excel-Beispiel). Offene TODO(verify)-Marker
für Einmaischtemperatur, Effizienz-Checkpoints und Karbonisierung bleiben
bestehen — siehe PLAN.md.

**Zur Nutzeranmerkung „Brix/Plato-Faktor 0,96":** Der allgemeine
Einheiten-Umrechner behandelt °Brix und °Plato bewusst 1:1 (beides
sucrose-äquivalente Massenprozent-Skalen, per Definition praktisch
identisch) — das ist korrekt und unverändert. Der vom Nutzer gemeinte
Faktor ist der geräteabhängige Refraktometer-Korrekturfaktor (hier „BCF"
genannt, Standard 1,03 laut Quelle, angewendet als Division Bgc=Bg/BCF),
der ausschließlich in den Refraktometer-Rechnern (11, 13) zum Tragen
kommt und dort jetzt korrekt als eigener, einstellbarer Eingabewert
vorhanden ist.

## 2026-09-19 — Not-Aus-Funktion (Hauptschalter)

Backlog-Punkt aus PLAN.md umgesetzt: ein Not-Aus-Button, persistent im
Nav-Fußbereich (Desktop-Sidebar + mobiler Header), unabhängig von der
aktuellen Seite erreichbar. Architekturfrage vorab mit dem Nutzer geklärt
(Scope, Persistenz, Reset, Platzierung), siehe Plan.

**Scope:** `POST /api/estop` (neuer Endpoint, `WebUI.cpp`) deaktiviert jeden
Aktor (`setEnabled(false)`) und pausiert jedes laufende/wartende Programm
sowie jeden laufenden Timer (neue `pauseAllRunning()`-Methoden auf
`ProgramRunner`/`TimerStore`, die intern über die bestehenden Ids die
vorhandene `control(id, "pause", …)`-Logik aufrufen — kein neuer Aktor-Code
in SensActCtrl nötig, `Actuator::setEnabled(false)` hält die Hardware-Ausgabe
bereits sicher inaktiv, selbst wenn ein Controller weiterschreibt). Bewusst
**nicht persistent** (reiner Laufzeit-Zustand, nach Reboot startet alles
normal) und **kein Sammel-Reset** — jeder Aktor/jedes Programm/jeder Timer
wird einzeln über die bestehenden Controls wieder aktiviert.

Frontend: `emergencyStop()` in `api.ts`, neuer `OctagonX`-Button (kritisch
eingefärbt, `text-critical`/`hover:bg-critical/10`) in `NavShell.tsx` an
beiden Stellen, ohne Confirm-Dialog (ein echter Not-Aus muss sofort wirken).
Erfolg ist über die SSE-getriebenen Karten sichtbar, kein zusätzlicher
globaler Banner-State.

`pio test -e native` (224/224), `pio run -e esp32dev` und `pnpm typecheck`
grün; OpenAPI-Lint sauber (`POST /api/estop` in `docs/openapi.yaml`
dokumentiert). Im Browser gegen ein Testboard geprüft: Klick löst korrekt
`POST /api/estop` aus (404 dort, weil das Board die alte Firmware ohne den
neuen Endpoint fährt — erwartet, kein Seiteneffekt), Fehler wird sauber
abgefangen. Echte Hardware-Verifikation (Aktor + laufendes Programm/Timer,
tatsächliches Abschalten/Pausieren, Reboot-Verhalten) steht noch aus —
absichtlich nicht an einem Board mit echten Aktoren/laufendem Sud
ausprobiert, siehe PLAN.md → Hardware-Verifikation offen.

## 2026-09-20 — Fix: leere AutoTune-Trennlinie auf der Regler-Karte

Nutzer-Fund an der neuen Gauge-Karte: unter dem Bogen stand eine freie
Trennlinie. Ursache ist der AutoTune-Block in `ControllerCard.tsx`, dessen
Container schon rendert, sobald ein PID überhaupt einen `autotuneState` trägt —
Inhalt gibt es aber nur bei `running` (Fortschrittsanzeige) und `done`
(übernommene Kp/Ki/Kd). Im Normalfall `idle` blieb dadurch ein leerer Kasten mit
oberer Trennlinie und zweimal 12 px Polsterung stehen. Die Bedingung prüft jetzt
genau die beiden Zustände mit Inhalt.

Altbestand, kein Folgefehler der Karten-Überarbeitung: vorher lagen unter dem
Bogen ohnehin die Min/Max-Zeile und rund 55 px toter Raum, seit die Karte eng
sitzt steht die Linie frei. `pnpm typecheck` grün.

## 2026-09-20 — Multi-Channel-Sensoren: Kanäle einzeln anlegen und platzieren

Auslöser: HCSR04 und YF-S201 erzeugten immer beide Kanäle, im Dashboard saßen sie
als gestapelter Block (Ref `sensor/<base>`) und rissen Leerraum ins Raster.
Ursache: ein Multi-Channel-Sensor ist ein `Sensor`-Objekt mit einem
Registry-Eintrag, die Kanäle entstehen erst im Snapshot (`RegistrySnapshot.cpp`).
Entscheidung: keine gruppierte Karte, stattdessen einzelne Kanalkarten; die
Gruppenkarte steht als eigener PLAN-Eintrag.

Umsetzung: `HCSR04Sensor`/`YF_S201Sensor` bekommen `setChannelMask()`
(Messung/ISR laufen unverändert, nur `channelCount()`/`channel()` filtern;
Default = alle, Maske ohne gültiges Bit wird ignoriert). `DynamicItems.cpp`
liest `channels` aus dem POST-Body (unbekannter Key, leeres Array und
`derived` ohne `factor` → 400; fehlt `channels`, bleiben alle Kanäle —
alte Configs laden unverändert), der Reset-Callback hängt nur noch am
`volume`-Kanal. `removeSensor` prüft Controller-Referenzen jetzt auch gegen
Kanal-IDs (`tank.derived`), vorher blockierte nur die nackte Basis-ID.
Frontend: Kanal-Häkchen im Add-Dialog (HCSR04: Distanz/Ableitung, YF-S201:
Durchfluss/Volumen; Ableitung braucht Faktor), Dashboard-Inhalte listen jeden
Kanal einzeln, `sensor/<base>.<channel>`-Refs rendern nur diesen Kanal,
Edit/Reset laufen weiter über die Basis-ID, ein Umbenennen zieht auch
Kanal-Refs mit. Bestehende Dashboards mit Basis-Ref rendern unverändert
gestapelt (kein Auto-Migrieren), der Eintrag bleibt im Dialog abwählbar.
`channels` ist in `openapi.yaml` dokumentiert.

Verifikation: `pio test -e native` für `test_hcsr04`/`test_yf_s201` (neue
Maskentests), `pio run -e esp32dev` und `pnpm typecheck` grün,
`redocly lint` valide. Hardware-Test durch den Nutzer erfolgreich (Kanalauswahl
beim Anlegen, einzelne Kanalkarten im Dashboard).

## 2026-09-20 — Quick-Wins: Notfall-Seite, ConfirmModal, OpenAPI, Kanalbezeichnung

Vier kleine Punkte aus PLAN.md abgearbeitet. (1) `onNotFound` in `WebUI.cpp`
liefert SPA-/Notfall-Seite nur noch für Pfade ohne Dateiendung; `/assets/x.js`
& Co. bekommen 404 statt HTML — ein SD-Lesefehler kann so keinem
`<script>`-Tag mehr die Notfall-Seite unterschieben. (2) `ConfirmModal`:
Abbrechen/Bestätigen stehen nebeneinander, der Extra-Button liegt volle Breite
darunter (Labels unverändert, brechen nicht mehr um). (3) `SensorCreate` in
`openapi.yaml`: `calibration` ist `number` (YF-S201, Hz je L/min), `rtd` ein
String `PT100`/`PT1000`. (4) `SensorCard` zeigt die Kanalbezeichnung
(`meta.quantity`) unter dem Titel; im Kompakt-Modus bleibt sie rechts, weil dort
die Höhe knapp ist.

Verifikation: `pnpm typecheck`, `pio run -e esp32dev`, `redocly lint` grün;
Sensorkarten im Browser gegen `pnpm dev` geprüft (kein Überlauf). Nicht
geprüft: `ConfirmModal` mit Extra-Button im Browser und die Notfall-Seite am
Gerät.

## 2026-09-20 — Persistenz-Verifikation am Gerät: Darstellungsmodi, Layout, Sekundärfarbe

Firmware `50f199c` (HEAD, sauberer Tree) per OTA (`POST /api/update/firmware`, kein
Serial) auf `brewcontrol-esp32dev` geflasht. Das Board hat lokal keine Aktoren,
nur ein Remote-Item auf das S2 (Ziel 0, nie beschrieben), keine Regler/Programme
und keinen Sud. Alle Reboots liefen über `POST /api/network` mit unverändertem
Hostnamen; Beleg jeweils über die Messzeit des lokalen Sensors (`t` fiel z. B.
von 36462 auf 18912).

Ergebnis: (1) `sensorModes`/`controllerModes`/`timerModes` und (2) `layout`
(verschachtelter Split) sind nach Speichern und echtem Reboot bytegleich
wieder da, auch in `GET /api/backup` und in der Roh-Datei
`/config/dashboards.json`. Ein Dashboard im Altformat (Backup-Restore ohne
Modi/Layout) lädt fehlerfrei, liefert leere Modi und kein `layout`-Feld.
Die UI (`pnpm dev` per `VITE_ESP_HOST`-Umgebungsvariable gegen das Board,
`.env.local` zeigt aufs LilyGo und blieb unangetastet) rendert Gauge/Kompakt und
die gespeicherte Anordnung nach Reload. (3) `theme.secondary`: eine alte
`settings.json` ohne das Feld fällt auf `#22c55e` zurück, `#ff8800` übersteht
Reboot, steht in `GET /api/settings`, `GET /api/backup` und der Roh-Datei;
`red`, `#12345`, `#1234567`, `22c55e0` liefern 400 `invalid secondary`.

Escape-Abbruch: Drag aktiv (Karte gedimmt), nach Escape weg, danach `pointerup`
ohne Request und ohne Layoutänderung; Kontrolllauf ohne Escape committete.
Beides mit synthetischen `PointerEvent`s und `setPointerCapture` als No-op
(echte Pointer-IDs lassen sich im Browser-Pane nicht erzeugen), die
Handler-Logik ist also echt, die Browser-Pointer-Erfassung nicht. Ein Drag mit
echtem Finger am Tablet bleibt offen (PLAN.md).

Befund: `POST /api/settings` prüft Farben nur auf Länge 7 und `#`; `#gggggg`
wurde angenommen und persistiert (PLAN.md, Bugs). Aufgeräumt: Testdashboard
gelöscht, `secondary` auf den Default zurückgesetzt, Registry unverändert zum
Backup vor dem Test.

## 2026-09-20 — „Gerät hinzufügen“ als 4-Schritt-Wizard (nach Design-Entwurf)

Grundlage waren zwei Entwürfe (Desktop + Mobile) für einen mehrschrittigen
Anlege-Dialog. Der bestehende Dialog ist darin integriert: seine per-Typ-Felder
sind jetzt Schritt 4.

**Umsetzung:**

- Neue Hülle `AddItemWizard.tsx` (~185 Z.) mit `ChoiceCard`: Scrim, responsives
  Panel, Desktop-Schrittleiste (240 px, Haken + gewählter Wert als Unterzeile,
  anklickbar bis `maxStep`), mobile Segmentleiste mit „Schritt X von 4“,
  Schritt-Titel und Footer. Responsive rein über Tailwind `md:` — kein
  `matchMedia`; DOM-Reihenfolge [Rail, Mobil-Header, Pane] ergibt mit
  `hidden md:flex` / `md:hidden` in beiden Layouts die richtige Abfolge.
  Mobil vollflächig ohne Scrim, ab `md` ein zentriertes 880×640-Panel.
- Schritte: 1 Art → 2 Kategorie → 3 Gerätetyp → 4 Konfiguration, danach ein
  Erfolgs-Screen. Kein Zusammenfassungs-Schritt (war im Entwurf, bewusst
  verworfen). Kategorien sind unverändert die `group`-Werte aus `itemTypes.ts`;
  eine Kategorie mit genau einem Typ wählt diesen vor, damit Schritt 3 dort ein
  „Weiter“ statt eines Klicks ohne Alternative ist.
- `itemTypes.ts` bekommt `ROLE_META` (Icon + Beschreibung je Rolle) und
  `CATEGORY_ICON` (Icon je Kategorie); `ITEM_TYPES` selbst unverändert,
  Reihenfolge und Anzahl der Kategorien werden daraus abgeleitet.
- **Bearbeiten und Discovery-Prefill nutzen den Wizard nicht** — sie behalten
  den kompakten Ein-Pane-Dialog. Dessen Zurück-Chevron ist entfallen: beim
  Bearbeiten gab es nie einen, und bei einem Discovery-Treffer steht der Typ
  durch den Scan fest. `ItemTypePicker.tsx` ist damit verwaist und gelöscht.
- Die ~880 Zeilen per-Typ-Feld-JSX wurden **byte-identisch** in eine lokale
  `fieldBlocks()` verschoben (mit `git diff -w` gegengeprüft) und werden von
  beiden Darstellungen aufgerufen. Eine Kindkomponente hätte ~70 Werte plus ~70
  Setter als Props gebraucht; die lokale Funktion schließt alles gratis ein.
- Form-Semantik: ein einziges `<form>` bleibt, aber der Primärbutton ist nur in
  Schritt 4 `type="submit"`, alle Karten/Rail-Buttons sind `type="button"`, und
  `onSubmit` bricht auf Schritt 1–3 ab. Es wird immer nur der aktive Schritt
  gerendert — ein verstecktes `required`-Feld würde den Submit sonst unsichtbar
  blockieren.
- `handleSubmit` schließt im Wizard nicht mehr sofort, sondern feuert
  `onCreated` (sobald das Item existiert) und zeigt den Erfolgs-Screen; jedes
  Schließen läuft über `closeWizard()`, das `created` vorher räumt — sonst
  blitzt der alte Screen beim nächsten Öffnen auf, weil der Reset-Effect erst
  nach dem Paint läuft.

**Verifiziert:** `pnpm typecheck`, `pnpm build`, `pnpm test` (25/25) grün.
Live gegen esp32dev: Wizard über Aktor→GPIO→DigitalOutput inkl. Singular
„1 Typ“ / „3 Typen“, MQTT-Kategorie wählt ihren einzigen Typ vor,
Rollenwechsel aus Schritt 4 heraus leert Schritte 2–4 und sperrt sie wieder,
Anlegen → Erfolgs-Screen → Fertig → Gerät in der Liste. Kompakter Pane beim
Bearbeiten (kein Chevron, AutoTune vorhanden). Verschachtelt aus
„Dashboard-Inhalte“: Wizard startet auf Schritt 1 mit vorgewähltem Sensor, nach
„Fertig“ ist das Content-Modal noch offen und der neue Sensor angehakt.
Mobil 375×812 wie im Entwurf. Testgeräte danach wieder gelöscht.

**Nebenbefund:** Enter im Formular löst im Browser-Pane keinen Submit aus —
auch im unveränderten kompakten Dialog nicht. Das ist die synthetische
Tastatureingabe der Automatisierung, keine Regression; am echten Gerät
unverändert.

## 2026-09-20 — Not-Aus am Gerät verifiziert (esp32dev)

Hardware-Verifikation von `POST /api/estop` am esp32dev (`192.168.178.74`, lokal
keine echten Aktoren; nur HTTP, kein Serial). Aufbau: `DigitalOutput`
`estop_led` (GPIO 16), `TwoPoint`-Regler darauf (Sensor: Remote-Binärwert
`lolin_wstest` = 1, Sollwert 10 — der Regler schreibt dadurch dauerhaft
`target=1`), Programm mit zwei 600-s-Schritten und ein 600-s-Timer, beide
gestartet. Vorher Backup + Snapshot gesichert.

**Ergebnis:** (a) nach dem Not-Aus `enabled=false` und `state.v=0` am Aktor,
obwohl der Regler weiter aktiv blieb und `target=1` schrieb — über drei
Messungen im Abstand von 4 s stabil. (b) Programm und Timer wechselten auf
`paused` und standen bei 591 s fest. (c) Nach dem Reboot (`POST /api/network`
mit unverändertem Hostnamen, `sensors[].state.t` sprang zurück) sind alle
Aktoren wieder `enabled=true`, der LED-Ausgang liegt wieder bei `v=1` — der
Aktor-Teil des Not-Aus ist nicht persistiert.

**Kein Befund:** Programm und Timer bleiben nach dem Reboot `paused` (Not-Aus
speichert sie per `saveToSD`) — beabsichtigt: nach einem Neustart soll nicht
dieselbe Situation, die den Not-Aus ausgelöst hat, von selbst wieder entstehen.
Die Aktor-Deaktivierung ist dagegen nicht persistiert. Die Aussage in
`openapi.yaml` („starts normally again“) wurde entsprechend präzisiert.
Testobjekte danach gelöscht, das Board ist wie vorher (`lolin_ids1`, `test`,
`lolin_wstest`).

## 2026-09-20 — Dashboard-Inhalte-Dialog nach Design W1 (ContentDialog)

`DashboardContentModal.tsx` an das überarbeitete WinUI-Design angeglichen:
720×640-Dialog mit Titel/Untertitel, immer sichtbarer Suche, Kategorie-Tabs
(„Alle“ + je Gruppe, Zähler ausgewählt/gesamt), Zusammenfassungszeile mit
Delta („n hinzugefügt · m entfernt“), „+ Neu…“-Button im Gruppen-Header,
Checkbox-Zeilen und Footer „Übernehmen“ (erst bei Änderungen aktiv) /
„Abbrechen“. Timer-Gruppe bleibt erhalten (im Design nicht vorgesehen).
Auf Mobil (<640 px) läuft die Tab-Leiste horizontal, die Scrollbar ist
versteckt und ein Ausblend-Verlauf am rechten Rand zeigt, dass es weitergeht.
Verifikation: `pnpm typecheck` grün; im Browser gegen das LilyGo geprüft
(Tabs, Suche inkl. Leerzustand, Delta-Zeile, Übernehmen-Status, Stapelung mit
dem Add-Wizard, Mobilansicht 375 px; ohne Speichern).

**Nebenfund — SESSION.md-Encoding:** Ein `Get-Content -Raw | Set-Content
-Encoding utf8` in Windows PowerShell 5.1 hat die Datei als cp1252 gelesen und
mit BOM zurückgeschrieben (Mojibake in allen Umlauten/Gedankenstrichen,
~2000 Zeilen Diff, Commit `d4e6631`). Repariert durch Neuaufbau aus der Fassung
vor dem Schaden (`b2be3a1`) plus diesem Eintrag; UTF-8 ohne BOM. Für
Doku-Edits Python mit explizitem `encoding="utf-8"` oder das Edit-Tool nutzen,
nicht die PS-5.1-Cmdlets.

## 2026-09-20 — Gruppenkarte für Multi-Channel-Sensoren + gemessene Raster-Spans

Auslöser: Seit dem Umbau auf einzelne Kanalkarten (50f199c) war die Basis-Ref
`sensor/tank` nur noch ein Stapel aus zwei vollen Karten und riss Leerraum ins
Raster. Gewünscht war eine Karte pro logischem Sensor mit einer Zeile je Kanal.

**Unterwegs gefunden — die eigentliche Ursache des Leerraums:** Die Zeilen-Spans
`row-span-1/2/3` (`ui.ts` → `widgetSizeClass`, `ActuatorCard`) sitzen auf der
Karte. Seit dem Drag-&-Drop-Umbau (3ddcaf6) ist das Grid-Kind aber der
`itemBox`-Wrapper in `DashboardLayout` — die Klassen waren seither wirkungslos.
Jede Karte belegte eine Auto-Zeile, deren Höhe die höchste Karte der Reihe
bestimmte; unter einer kompakten Karte (94 px) neben einer Gauge-Karte (263 px)
standen so ~170 px Luft. Der Versuch, die Spans wieder zu deklarieren, scheiterte
an den Zahlen selbst: die 72-px-Raster-Annahme stimmt für keine Karte mehr
(Regler-Karte 213 px statt 160). Statt einer Höhentabelle, die beim nächsten
Karten-Redesign wieder still veraltet, **misst** die Layout-Komponente jetzt:
ein `ResizeObserver` je Karte setzt `grid-row: span ceil((Höhe + 16) / 8)`, das
Kartenraster läuft auf 8-px-Zeilen ohne Zeilen-Gap (der Abstand steckt als
`pb-4` in der Karte — ein `row-gap` läge sonst zwischen *jeder* der kleinen
Zeilen). Ein Kartenbereich endet dadurch einen Abstand unter seiner letzten
Karte; die Spans in `widgetSizeClass` sind ersatzlos raus, die `min-h`-Böden
bleiben. Das gilt für das Desktop-Layout; die mobile Linearisierung
(`Dashboard.tsx` → `mobileBlocks`) behält ihr bisheriges Raster — einspaltig
gibt es nichts zu packen, ab `sm:` bleibt der alte Zustand.

**Gruppenkarte:** Neue `SensorGroupCard.tsx` — Titel = Basis-ID, je Kanal eine
Zeile (Label aus dem Kanalschlüssel, Wert/Einheit, im Modus „normal" Balken +
Min/Max, im Modus „kompakt" nur die Wertzeile), Reset-Knopf nur in der Zeile
eines kumulativen Kanals (ruft weiter `resetSensor(<Basis-ID>)`), Stift/× im
Kopf, `fault` einmal unter den Zeilen. Gauge gibt es pro Zeile bewusst nicht —
dafür bleibt der Kanal einzeln platzierbar. `Dashboard.tsx` rendert die
Gruppenkarte für eine Basis-Ref mit mehr als einem Kanal, sonst unverändert
`SensorCard`; bestehende `sensor/<base>`-Refs wechseln damit ohne Migration.
Der Zeilen-Modus liegt unter der Kanal-ID (`sensorModes['tank.distance']`) —
derselbe Schlüssel wie bei einer einzeln platzierten Kanalkarte, kein
Schema-Zusatz. Gelesen wird mit Rückfall auf die Basis-ID, ein Umschalten
materialisiert alle Kanäle und wirft den Basis-Schlüssel weg (Migration bei der
ersten Berührung). Im Inhalte-Dialog steht die Basis-ID jetzt als regulärer
Eintrag „Gruppenkarte · N Kanäle" über ihren Kanälen; Gruppe und Einzelkanal
dürfen gleichzeitig auf einem Dashboard liegen (bewusst, der Kanal erscheint
dann zweimal).

**Verifikation** im Browser-Pane gegen einen Wegwerf-Mock (Snapshot mit HCSR04-
und YF-S201-Kanälen, Regler, Aktoren, Chart; kein Zugriff auf ein echtes Board,
`.env.local` unangetastet): Gruppenkarte statt Stapel, gemessene Abstände
zwischen allen Karten 16–21 px und **kein** Loch mehr; Kartenbereich ohne
Phantom-Scrollbar (`scrollHeight == clientHeight`); Zeilen-Modus umschalten →
genau ein POST, Karte wächst 155→182 px, Span 20→23, übersteht den Reload;
Reset nur in der `volume`-Zeile und auf die Basis-ID; Drag der Gruppenkarte und
eines Charts in die Kartengruppe je ein POST, Chart weiter volle Breite;
Inhalte-Dialog mit Gruppen- und Kanal-Einträgen; Dark/Light und 375×812 (eine
Karte je Zeile, kein horizontales Scrollen). `pnpm typecheck`, `pnpm test` (25)
und `pnpm build` grün, `redocly lint` valide (nur die bekannte
`license`-Warnung). Firmware unverändert — `DashboardStore` behandelt
`sensorModes` als opake Key→String-Map; `openapi.yaml` beschreibt jetzt, dass
Dashboard-`sensors` Basis- **und** Kanal-IDs enthalten und welche Schlüssel in
`sensorModes` stehen. Am Gerät steht die Verifikation aus (PLAN.md).

**Nebenbefund:** `web/src/types.ts` kennt `Quantity` `Distance` nicht, obwohl
`Quantity.h` und `openapi.yaml` ihn führen (PLAN.md).

## 2026-09-20 — Not-Aus rastet ein und überlebt den Reboot

**Problem** (PLAN.md): `POST /api/estop` deaktivierte nur Aktoren, und zwar
ausschließlich im RAM. Nach einem Reboot regelten Regler sofort wieder — war
ein durchgehender Regler der Auslöser, entstand dieselbe Situation erneut,
obwohl Programme/Timer bewusst pausiert blieben. Beim Aufarbeiten fiel ein
zweites Loch ohne Reboot auf: Regler wurden gar nicht deaktiviert, liefen also
weiter und hätten einen einzeln wieder freigegebenen Aktor sofort getrieben.

**Umsetzung.** Der Not-Aus deaktiviert jetzt zusätzlich alle Regler und
*rastet ein*: `WebUI` führt ein `estop_`-Flag, persistiert es nach
`/config/estop.json` und wendet es in `loadEstop_()` aus `WebUI::begin()`
wieder an — also nach `registry.begin()`, bevor die erste Snapshot-Antwort
oder der erste Regler-Tick das Gerät sehen. Gelöst wird er über das neue
`DELETE /api/estop` (mit `requireAuth`; der POST bleibt bewusst offen, damit
ein Not-Aus auch aus gesperrter UI funktioniert). Die Freigabe schaltet
*nichts* wieder ein — Aktoren, Regler, Programme und Timer bleiben, wo der
Stopp sie hinterlassen hat, und werden einzeln über die normalen Bedienelemente
freigegeben. Der Snapshot trägt `estop` immer (nicht nur wenn aktiv), damit
„aus“ nicht mit „alte Firmware“ verwechselt wird; `EmergencyStopBanner`
zeigt daraufhin auf jeder Seite ein Banner mit Erklärung und Aufheben-Button.
`GET /api/backup` bleibt unberührt — ein Restore soll keinen fremden Not-Aus
einspielen.

**Verifikation.** `pio run -e esp32dev` grün, `pnpm typecheck` grün, Redocly
lint sauber. E2E am `brewcontrol-esp32dev` (OTA geflasht) mit einem
Wegwerf-Paar (`DigitalOutput` auf Pin 2 + `TwoPoint`-Regler, danach gelöscht):
Not-Aus → beide Aktoren und der Regler `enabled:false`, `estop:true`,
`/config/estop.json` = `{"active":true}`; Reboot über `POST /api/network` mit
unverändertem Hostnamen → nach 18 s Uptime unverändert alles abgeschaltet und
`estop:true`; `DELETE /api/estop` → `estop:false`, nichts wieder eingeschaltet;
erneuter Reboot → normaler Start (`lolin_ids1` und Regler wieder `enabled`).
Banner im Browser gegen dasselbe Board geprüft (Desktop + 375 px), Aufheben per
Klick lässt es über SSE verschwinden; auf dem Handy brach der Text neben dem
Button in eine schmale Spalte um → `basis-64` als Umbruchschwelle ergänzt.
Beim Diff-Review fiel auf, dass `saveEstop_()`/`loadEstop_()` den globalen
`SdLock` nicht nahmen, obwohl sie vom AsyncTCP-Task auf dieselbe Karte
schreiben wie loopTasks Logging — nachgezogen (Lock eng um die Datei-Operation,
nicht um das Abschalten) und der Stopp-/Reboot-/Freigabe-Zyklus danach auf dem
finalen Build noch einmal am Gerät durchlaufen.

**Nebenbefund** (in PLAN.md aufgenommen): `POST /api/estop` hat keinen
`requireAuth`-Aufruf, `openapi.yaml` versprach dort aber bisher einen `401`.
Das Verhalten ist so gewollt, die Spec war falsch — der `401` ist jetzt nur
noch beim DELETE dokumentiert.

## 2026-09-20 — Sammel-Commit: Farbvalidierung, `Distance`-Typ, `pio ci`-Flags

Drei kleine Punkte aus PLAN.md. (1) `POST /api/settings` prüft `theme.secondary`
und `theme.accent` jetzt auf `#` plus sechs Hex-Ziffern (`isHexColor()` in
`WebUI.cpp`), wie `openapi.yaml` es zusagt; `#gggggg` wird mit
`invalid secondary`/`invalid accent` abgewiesen. (2) `Quantity` in
`web/src/types.ts` kennt `Distance`. (3) Die `pio ci`-Aufrufe in den READMEs
von Beispiel 08–10 und im `platformio.ini`-Kommentar tragen die
C++17-Flags (`-std=gnu++17`, `build_unflags=-std=gnu++11`).

Verifikation: `pio run -e esp32dev` und `pnpm typecheck` grün. Nicht geprüft:
die Farbablehnung am laufenden Gerät.

## 2026-09-21 — AnalogInput als Sensortyp in BrewControl

`SensActCtrl::AnalogInputSensor` (ADC, Zwei-Punkt-Kalibrierung, Glättung)
existierte schon; es fehlte nur die Anbindung. Neuer Typ `AnalogInput` in
`DynamicItems.cpp` (Keys `pin`, `value_min`/`value_max` als Anzeigebereich,
`unit`, `resolution`, `smoothing`, optional `cal_raw1/cal_value1/cal_raw2/
cal_value2`), in `openapi.yaml` und im Hinzufügen-Dialog (`AddItemModal.tsx`,
`itemTypes.ts`). Ohne Kalibrierung wird der volle ADC-Bereich 0..4095 auf
`value_min..value_max` abgebildet, damit direkt nach dem Anlegen Werte in der
richtigen Größenordnung statt Rohcounts erscheinen. `rawMin/rawMax` der Library
sind die Rohwerte der zwei Kalibrierpunkte, keine Bereichsgrenzen — die Gerade
gilt auch außerhalb. Kein Clamping, ADC bleibt bei 12 Bit.

Der Hardware-Test deckte einen Library-Fehler auf: `AnalogInputSensor::setMeta`
speicherte nur den Zeiger auf die Einheit, der in das nach dem Anlegen
freigegebene JSON zeigte (Anzeige „xV��“). Jetzt wird der String kopiert
(`unitStorage_`, wie bei `MqttGenericSensor`); Regressionstest
`test_setmeta_copies_unit` (vorher rot, jetzt grün).

Verifikation: `pio test -e native` (231 Tests), `pio run -e esp32dev`,
`pnpm typecheck`, Redocly-Lint grün (Flash 89 %); Dialog im Browser gegen einen
Mock (Validierung, Anlegen, Bearbeiten-Vorbelegung). Am Board
`brewcontrol-esp32dev` (OTA) mit `AnalogOutput` (DAC, GPIO 25) → `AnalogInput`
(GPIO 34) verkabelt: ohne Kalibrierung liest der ADC 10–12 % zu niedrig
(ESP32-Nichtlinearität); mit Zwei-Punkt-Kalibrierung (0,5 V / 2,5 V) stimmen
1,0 / 1,65 V auf ≤ 0,012 V, an den Rändern 0 V → 0,085 V und 3,0 V → 3,12 V
(ADC-Totbereich/Sättigung). Sensor samt Kalibrierung überlebt einen Reboot.

## 2026-09-21 — Log-Chart: Zoom bleibt bei Live-Updates erhalten

Drag-Zoom (uPlot-Standard) sprang beim nächsten Snapshot zurück, weil
`ChartCard.tsx` bei jedem Live-Punkt `setData(data)` mit dem Default
`resetScales=true` aufrief. Jetzt wird vor dem Anhängen geprüft, ob die
X-Skala noch alle Daten umfasst (`isZoomed`); nur dann läuft der Graph
automatisch mit, sonst bleibt der gezoomte Ausschnitt stehen. Doppelklick
setzt den Zoom zurück (uPlot-Standard).

## 2026-09-21 — Generische Sensor-Kalibrierung (`CalibratedSensor`)

Ersetzt die Einzellösungen (HX711 `scale`/Tara, YF-S201 `calibration`,
AnalogInput `cal_*`) durch einen Mechanismus. Ausgangspunkt war die Beobachtung,
dass man die Rohwerte (ADC-Counts, Pulse) beim Kalibrieren gar nicht kennt.
Lösung: „roh" ist der **unkalibrierte Wert, den der Sensor ohnehin anzeigt**;
der Assistent greift ihn live ab (5 s Mittelwert), der Nutzer tippt nur die
Referenzwerte ein.

**Library:** `CalibratedSensor` (Decorator, wie `IntervalActuator` bei Aktoren)
rechnet pro Kanal `wert = valRef + gain · (roh − rawRef)` — Punkt-Steigungs-
Form statt `gain·roh + offset`, weil sie bei 24-Bit-HX711-Counts in float
genau bleibt (Test `test_precision_with_large_raw_counts`). Drei Arten:
Ein-Punkt-Offset (Steigung bleibt), Ein-Punkt-Faktor (durch den Nullpunkt),
Zwei-Punkt. Binary/Discrete-Kanäle sind nicht kalibrierbar, Cumulative nur per
Faktor (ein Offset würde den Zähler verfälschen).

**Firmware:** `DynamicItems` wickelt *jeden* dynamischen Sensor (Identität bis
zur Kalibrierung, dadurch kein Neuanlegen nötig; `innerPtr`/`ptr` wie bei
`ActuatorEntry`). Persistenz als `calibrations`-Array im Sensor-Config;
Altkeys werden beim Laden übernommen und aus der Config entfernt (HX711 `scale`
→ Gain, YF-S201 `calibration` → Gain `7,5/cal` auf `rate`+`volume`, AnalogInput
`cal_*` → Punkte auf den Full-Scale-Werten). Neue Routen
`GET|POST|DELETE /api/sensors/:id/calibration` (openapi.yaml + README). Der
Snapshot bleibt unverändert — die UI pollt den Rohwert über den GET.

**UI:** `CalibrateModal` (Kanal, Methode, „Messen"-Knopf je Punkt, Reset),
erreichbar in Einstellungen → Geräte und im Dashboard-Bearbeiten-Modus.
HX711-Tara ist jetzt ein Ein-Punkt-Offset und bleibt damit — anders als früher
(nur RAM) — über einen Reboot erhalten. `AddItemModal`: Felder `scale` und
`cal_*` entfernt, Bearbeiten reicht `calibrations` durch (Bearbeiten ist
Löschen + Neuanlegen). HC-SR04 „Ableitung" heißt jetzt „Umgerechneter Kanal":
es ist eine Einheiten-Umrechnung (cm → Liter) auf einem zweiten Kanal, keine
Kalibrierung; jeder der beiden Kanäle wird einzeln kalibriert.

Verifikation: `pio test -e native` (245 Tests, 14 neue), `pio run` für
esp32dev (Flash 89,4 %), lolin_s2_mini (86,3 %) und LilyGo, `pnpm typecheck`,
Redocly-Lint. Am `brewcontrol-esp32dev` (DAC GPIO 25 → ADC GPIO 34): Migration
eines echten `cal_*`-Eintrags, alle API-Fehlerfälle, Assistent im Browser
durchgespielt (Zurücksetzen, Zwei-Punkt mit gemessenen Rohwerten, Übernehmen),
danach 1,0 / 1,65 V auf ≤ 0,012 V; Bearbeiten-Speichern und Reboot erhalten
die Kalibrierung. HX711-/YF-Altkey-Migration per API mit freien Pins belegt.
Offen (PLAN.md): Tara/Faktor an echter Wägezelle und echtem YF-S201.

Verifikation: `pnpm typecheck` grün. Nicht geprüft: Verhalten im Browser
mit Live-Daten.

## 2026-09-21 — Not-Aus: neue Items starten nicht freigegeben

Root Cause: `loadEstop_()` und `POST /api/estop` schalten nur die zum Zeitpunkt
vorhandenen Aktoren/Regler ab; ein bei eingerastetem Not-Aus per
`POST /api/actuators` bzw. `/api/controllers` angelegtes Item kam mit seinem
Default (meist `enabled:true`) hoch. Fix in `WebUI.cpp`: beide Add-Handler
deaktivieren das neue Item, solange `estop_` gesetzt ist.

Verifikation: `pio run -e esp32dev` grün. Nicht geprüft: Anlegen am Gerät
während eines aktiven Not-Aus.

## 2026-09-21 — Backup: Logs, Programme, Alarme; Push-Abos dokumentiert

`GET /api/backup` enthält jetzt zusätzlich `logs`, `programs` und `alarms`
(optionale Sektionen, ältere Bundles bleiben importierbar; Restore validiert sie
als Arrays). Exportiert werden nur Definitionen: Log-`session`, Programm-Fortschritt
(jedes Programm als `idle` auf Schritt 0) und Alarm-Livezustand werden entfernt,
damit ein Restore — ggf. auf einem anderen Gerät — kein laufendes Programm
wieder anstößt und keine Log-Session auf eine fehlende CSV zeigt. Log-CSVs und
Alarm-Historie bleiben außen vor. Push-Abos bleiben bewusst draußen; die Folge
(nach Restore neu einrichten) steht jetzt in der README. `openapi.yaml` nachgezogen.

Verifikation: `pio run -e esp32dev` und Redocly-Lint grün. Nicht geprüft:
Export/Restore-Roundtrip am Gerät.

## 2026-09-22 — BrewControl: Formular-Dialoge mobil als Vollbild

Timer-/Programm-/Profil-/Log-/Alarm-Editor, Dashboard-Inhalt, Kalibrierung und
„Item bearbeiten“ sind unter `md` (768 px) jetzt ein Vollbild-Sheet wie der
„Gerät hinzufügen“-Wizard, darüber unverändert zentriert. Zentral über
`dialogScrim`/`dialogSheet` in `web/src/ui.ts`; die Scroll-Zone bekam `flex-1`,
damit der Footer unten klebt. Confirm-/Name-/Login-Dialog bleiben bewusst klein.

Verifikation: `pnpm typecheck` und `pnpm build` grün, `max-md:`-Klassen im
CSS-Bundle. Nicht geprüft: Sicht am Handy bzw. im Mobil-Viewport.

## 2026-09-22 — Spike: LVGL-Display auf dem AMOLED-1.75 (Branch `spike/lvgl-display`)

Machbarkeits-Spike zu `PLAN.md` → „Interaktives LVGL-Display". Nicht nach main
gemerged; der Code lebt auf `spike/lvgl-display`, hier stehen die Ergebnisse.

**Build-Seite steht.** Env `lilygo_t_display_s3_amoled` erweitert (kein
zweiter OTA-Varianten-Eintrag), Display-Code hinter `BREWCTL_HAS_DISPLAY`,
`lv_conf.h` nur über `-I src/display` sichtbar. LVGL 8.4 baut unter GCC 8.4 /
`gnu++17` ohne Murren.

| Build | Flash | RAM statisch |
|---|---|---|
| A — nur Metriken | 1.633.409 B (24,9 %) | 61.028 B (18,6 %) |
| B — + Display + LVGL | 1.982.141 B (30,2 %) | 112.036 B (34,2 %) |
| Δ | +348.732 B | +51.008 B |

Der RAM-Zuwachs ist fast ganz `LV_MEM_SIZE` (48 KB statisches Array); der
33,6-KB-Draw-Buffer kommt zur Laufzeit dazu. `esp32dev` baut **byte-identisch**
mit und ohne Spike-Code — die `#ifdef`-Kapselung ist dicht.

**LVGL braucht den Arduino-Core-3-Sprung nicht.** Der entsprechende Halbsatz in
`PLAN.md` ist damit erledigt. Die bequeme Treiber-Library allerdings schon:
Arduino_GFX ist aus der PlatformIO-Registry für S3 + Core 2 in keiner Version
baubar, die CO5300/SH8601 kennt (unter 1.6.1 fehlen sie, 1.6.1 scheitert am
falschen Guard in `Arduino_ESP32RGBPanel.h`, ab 1.6.2 kommt `esp32-hal-periman.h`
dazu; PlatformIO kompiliert jede `.cpp` einer Library, auch die ungenutzten
Backends). **LilyGos vendored Fork 1.3.7 baut dagegen problemlos** — der ist der
Weg, nicht ein selbstgeschriebener Treiber.

**Speicher reicht mit Abstand.** Am Gerät gemessen: PSRAM 8.385.767 B (davon
8.293.315 frei — die bislang nur behauptete `qio_opi`-Konfiguration greift also
wirklich), internes Heap 182 KB frei, größter DMA-Block 172 KB.

**Der `loop()`-Takt ist der kritische Befund, und er ist displayunabhängig.**
Schon ohne Display: avg 9,6 ms, p50 7 ms, aber **p99 160–170 ms, max 206–221 ms**.
118 von 6280 Durchläufen liegen im Band 100–250 ms — 1,96 pro Sekunde. Über
Abschnitts-Timer lokalisiert auf `registry.tick()` (max 186 ms; `webUI.tick()`
max 6 ms). Ursache: `IdsActuator` tickt alle 500 ms und `IdsCooker::sendCommand()`
bitbangt 33 Pulse mit `delayMicroseconds`. `setupCommands()` setzt jedes Bit auf
`SIGNAL_HIGH` 5120 µs oder `SIGNAL_LOW` 1280 µs, dahinter je 1280 µs Pause — ein
Kommando dauert damit **131–146 ms** (Vorspann 25 ms + 10 ms, dann 96–111 ms
Pulszug je nach Anzahl der Eins-Bits), protokollbedingt und im kooperativen Loop
unvermeidbar. Der Vorspann läuft über `millis2wait()` mit `yield()`, der Pulszug
über `delayMicroseconds()` ganz ohne. Konsequenz für das Display: die
Plan-Empfehlung „`lv_timer_handler()` aus `loop()`" trägt auf einem Board mit
IDS-Kocher **nicht** — zweimal pro Sekunde stünde die UI ~190 ms. Ein eigener,
auf Core 0 gepinnter LVGL-Task ist damit keine Rückfallebene mehr, sondern die
Ausgangslage. (Messmethodischer Hinweis: `enabled=false` am Aktor ändert nichts,
der Keep-Alive läuft unabhängig davon.)

**Pin-Konflikte in der Item-Konfiguration des Testboards** — behoben und
behalten: `Durchfluss` 9→8, `kettle` 6→21, `Riptide Pumpe` 7→47, `Agitator`
3→48, `IDS1` 7/9/11 → 1/42/18; `Füllhöhe` (HC-SR04, nie ein Messwert) und
`test_dac` (der S3 hat keinen DAC) entfernt. Vorher teilten sich GPIO 7, 9 und 11
je zwei Items: der IDS-Bitbang feuerte 33 Pulse in die RISING-ISR des
YF-S201 — daher meldete `Durchfluss.rate` konstant 9,02 L/min ohne angeschlossenen
Sensor. Seither 0. Umgestellt per `POST /api/backup` mit einem bearbeiteten
Bundle; das Original liegt gesichert. Die Firmware kann solche Überlagerungen
nicht erkennen — Beleg für den Pin-Manager im Backlog.

**Display-Hardware identifiziert.** Das Panel ist rund, 466×466, und trägt einen
**CO5300** mit **CST9217**-Touch — nicht den dokumentierten SH8601/FT3168.
Maßgeblich ist LilyGos `libraries/Mylibrary/pin_config.h`, die zwischen
`DO0143FAT01` (1.43", SH8601+FT3168), `H0175Y003AM` (1.75", CO5300+CST9217 —
dieses Board) und `DO0143FMST10` unterscheidet; die README-Tabelle beschreibt nur
die 1.43. Ein I²C-Scan am Gerät bestätigt das unabhängig: 0x51 (PCF8563),
0x5A (CST9217, **nicht** 0x38) und 0x6A (SY6970). Dieselbe Datei erklärt auch den
alten SD-Fehlversuch — dort steht `SD_CS 38` und separat
`BATTERY_VOLTAGE_ADC_DATA 4`, die README hatte beides zu „SD CS = 4" verschmolzen.
Ebenfalls dort aufgefallen: `Wire` steht auf diesem Variant per Default auf
SDA 18 / SCL 17, und **GPIO 17 ist der Panel-Reset** — heute latent, weil kein
I²C-Item konfiguriert ist. Pin-Belegung und Hinweise stehen jetzt in
`platformio.ini` und `BrewControl/CLAUDE.md`.

**Panel-Bring-up: offen.** Der selbstgeschriebene `Co5300Panel` bringt kein Bild,
obwohl Init-Sequenz und QSPI-Framing inzwischen deckungsgleich mit Arduino_GFX
sind (manuelles CS, `MULTILINE_CMD/ADDR`, `SPI_TRANS_USE_TXDATA` für kurze
Nutzlasten, `0xC4=0x80`, Pixelformat `0x55`, Spalten-Offset 6). Derselbe Pfad mit
LilyGos Arduino_GFX-1.3.7 zeigt dagegen sauber Farben und Text — **Hardware,
Verdrahtung und Pins sind also in Ordnung**, der Rest ist ein Fehler im eigenen
Treiber. Damit ist die Konsequenz klar: Arduino_GFX-1.3.7 vendoren statt selbst
schreiben. Nicht gemessen wurden fps, Touch und die Rückwirkung des Renderns auf
`loop()`.

Diagnosewerkzeug nebenbei: Boot-Log auf SD (`/spike-boot.log`, lesbar über
`GET /api/files/download`) plus I²C-Scan und Panel-Registerlesung. Auf einem
USB-CDC-Board ist das der einzige Weg an einen Panic zu kommen — der Port
re-enumeriert bei jedem Reset, `pio device monitor` sieht nichts. Erst damit fiel
auf, dass die erste „Boot-Schleife" ein eigener Fehler war: `lv_mem_monitor()`
stand unter `#ifdef BREWCTL_HAS_DISPLAY` statt unter der Stufe, in der `lv_init()`
tatsächlich läuft, sodass jede Anfrage an den Metrik-Port das Board panikte.

## 2026-09-22 — Multi-Point-Kalibrierung (Polynom-Fit) für `CalibratedSensor`

Vierter Kalibriermodus `poly` neben `offset`/`gain`/`twopoint`, durchgängig von
der Library über die HTTP-API bis in den Kalibrier-Dialog: Ausgleichspolynom vom
Grad 1–3 durch bis zu acht Stützpunkte, für Sensoren mit krummer Kennlinie
(Anlass: Tilt-Hydrometer nach iSpindel-Vorbild). Die drei linearen Modi bleiben
unverändert — `poly` mit Grad 1 ist zwar rechnerisch dasselbe wie `twopoint`,
aber die Punkt-Steigungs-Form ist der genauere Pfad bei 24-Bit-Rohwerten, und
bestehende Kalibrierungen bleiben ohne Migration lesbar.

**Entscheidungen.** *Kein `CurveFitting`-Dependency*, obwohl der PLAN-Eintrag
das vorschlug: die dort angenommene API (`fit.addPoint/fit/solve`) existiert
nicht, die reale Library hat `fitCurve(order, n, px, py, nCoeffs, coeffs)`,
inkludiert `<Arduino.h>` und ruft `Serial.print` — sie baut also nicht im
`native`-Test-Env, womit ausgerechnet die Fit-Mathematik untestbar wäre.
Stattdessen ein eigener Normalgleichungs-Solver (Gauß mit Spaltenpivotisierung,
in `double`, ~60 Zeilen, keine Allokation) direkt in `CalibratedSensor.cpp`; das
spart zugleich einen Eintrag in `library.json`/`library.properties` der
standalone-publizierbaren Library. *Persistiert werden die Stützpunkte*, nicht
die Koeffizienten — die UI braucht sie ohnehin für die Tabelle, einzelne Punkte
bleiben nachkorrigierbar, und der Fit wird beim Laden neu gerechnet. *Der Grad
ist wählbar* (1–3) statt aus der Punktzahl abgeleitet, damit bewusst geglättet
werden kann (z. B. sechs Punkte, Grad 2).

**Numerik.** Gefittet wird in der zentrierten und skalierten Koordinate
`u = (roh − rawRef)/rawScale` mit `rawRef` = Mittelwert und `rawScale` =
`max|roh − rawRef|`. Ohne das erreichen die Momente der Normalgleichungen bei
HX711-Zählern (~8,4 Mio.) Größenordnungen um `u⁶ ≈ 3e41` und das System ist auch
in `double` unbrauchbar; mit Skalierung liegt die Konditionszahl bei ~25.
`rawRef`/`rawScale` werden als `float` gespeichert und der Fit mit genau diesem
`float`-Wert gerechnet — bei 8,4e6 ist ein float-ULP 1,0, ein zwischen Fit und
Auswertung abweichendes Zentrum würde das Ergebnis verschieben. Außerhalb der
Stützstellen wird **tangential-linear** fortgesetzt statt das Polynom laufen zu
lassen: eine Kubik wird dort leicht unmonoton, eine Waage zeigte bei *mehr*
Gewicht *weniger* an. Bei Grad 1 ist diese Fortsetzung exakt die Zwei-Punkt-
Gerade.

**Zwei Fallstricke, die der Entwurf zunächst enthielt** (beide jetzt durch Tests
abgedeckt): die linearen Modi setzten nur `rawRef/valRef/gain` — auf einem
Ex-Poly-Kanal wäre `degree > 0` stehengeblieben und der Nutzer hätte sichtbar
ins Leere kalibriert; und `setCalibration` resettete den Kanal über eine
*positionale* Aggregat-Initialisierung (`Calibration{rawRef, valRef, gain,
true}`), die beim Anhängen neuer Member nur zufällig weiter stimmt. Beides auf
feldweises Zurücksetzen umgebaut. `calibrateOffset` auf einem aktiven
Poly-Kanal wird jetzt abgelehnt (`NotCalibratable`) statt „behält den Gain" auf
einen Konditionierungsrest anzuwenden.

**Firmware/API.** `calibrations` in der Sensor-Config trägt für Poly
`{channel, mode:"poly", degree, points:[{raw,value}]}` statt der drei
Linear-Zahlen — Einträge ohne `mode`-Key sind weiterhin die lineare Form und
werden unverändert gelesen. `GET …/calibration` liefert jetzt zusätzlich ein
`mode`-Feld (`linear`/`poly`), das bisher fehlte, sodass die UI den aktiven
Modus überhaupt erkennen kann. In `calibrateSensor` wurde das feste
`float raw[2]` auf `kMaxPoints` erweitert und die Schreibschleife zusätzlich
gegen Überlauf abgesichert; Grad-/Anzahlfehler bekommen eigene Fehlertexte statt
des generischen `invalid calibration points`. Höchstens ein Punkt darf „raw"
weglassen — mehrere wären derselbe Live-Messwert und der Fit singulär.

**Verifikation.** 254 native Unit-Tests grün, davon 9 neue für den Poly-Pfad
(exakte Interpolation, Ausgleichsfall mit analytisch bekannter Steigung 2,2,
HX711-Größenordnung, Extrapolation, Modus-Wechsel, Refit-Roundtrip,
Ablehnungen). Compile-Smoke für `esp32dev` und `lilygo_t_display_s3_amoled`,
OpenAPI-Lint, `pnpm typecheck`, 39 Frontend-Tests (14 neu in
`calibrationPoints.test.ts`). UI gegen einen Node-Mock im Browser geprüft:
Modus-Wechsel, Gradwahl (Zeilen werden auf `Grad+1` aufgefüllt), Hinzufügen und
Entfernen von Punkten, Entfernen am Minimum gesperrt, Validierungsmeldungen,
gesendeter POST-Body, mobiles Vollbild-Sheet.

**Hardware-Durchlauf am esp32dev** (`brewcontrol-esp32dev.local`, DAC Pin 25 →
ADC Pin 34, per OTA geflasht): Schon das Update selbst belegte die
Abwärtskompatibilität — die vorhandene lineare Kalibrierung
(`raw_ref 0.38909`, `gain 1.066575`) überstand es unverändert und wird jetzt als
`mode: "linear"` ausgewiesen. Danach vier Stützpunkte über die Schleife
aufgenommen und als Referenz jeweils `roh²` gesetzt; der Grad-2-Fit traf an drei
Prüfpunkten die Parabel auf vier Nachkommastellen (Abweichung 0,0000).
Unterhalb der Stützstellen lieferte er bei roh 0,0710 den Wert −0,0967 statt der
Parabel — exakt die Tangente `0,1521 + 0,78·(0,0710 − 0,39)`, womit die lineare
Fortsetzung am Gerät bestätigt ist. Die Config enthielt `mode/degree/points` und
keine Linear-Keys; nach einem Reboot waren die Stützpunkte identisch und der
nachgerechnete Fit lieferte denselben Wert (Abweichung 0,0000) — der Refit aus
der Config trägt also. `twopoint` auf denselben Kanal setzte `degree` zurück und
der Wert folgte der Geraden; `points`/`degree` verschwanden auch aus der Config.
Alle sieben Fehlerfälle antworteten mit den in `openapi.yaml` dokumentierten
Texten und ließen den Kanal unverändert. Board anschließend auf die
ursprüngliche Kalibrierung zurückgesetzt.

## 2026-09-23 — GY-521/MPU-6050 als Tilt-Hydrometer-Sensor

Umsetzung des PLAN.md-Punkts „MPU6050/GY-521 als neuer Sensor": ein GY-521
(MPU-6050, I²C) als Tilt-Hydrometer nach iSpindel-Vorbild — Neigungswinkel,
kalibrierbar gegen Stammwürze/SG.

**Architektur-Entscheidung.** Rohe Achsenwerte und abgeleiteter Winkel bewusst
in zwei Klassen getrennt (Nutzer-Vorgabe), per Komposition statt Vererbung
oder Referenz-Decorator: `GY521Sensor` (SensActCtrl) ist der rohe 6-Kanal-Sensor
(AccelX/Y/Z „g", GyroX/Y/Z „°/s", analog zu `BME280Sensor` inkl.
`#if defined(ARDUINO)`-Stub fürs native Testbuild). `GY521TiltSensor` hält
intern ein `GY521Sensor`-Member (Ownership, kein `Sensor&`-Wrapper — ein
Tilt-Sensor *ist kein* Rohsensor, er *nutzt* einen) und liefert einen einzigen
`angle`-Kanal über einen Komplementärfilter
(`angle = alpha·(prevAngle + gyroRate·dt) + (1-alpha)·angleAccel`, alpha=0,98,
`angleAccel = atan2(-ax, sqrt(ay²+az²))`). Die Filterberechnung ist als
statische `complementaryStep()` exponiert, damit sie ohne Hardware
deterministisch testbar ist. Die Dichte-Ableitung brauchte **keinen dritten
Baustein**: `DynamicItems.cpp` wrapped ohnehin jeden neu angelegten Sensor in
`CalibratedSensor`, der `angle`-Kanal bekommt die SG-Umrechnung also direkt
über die kürzlich gebaute Poly-Kalibrierung (`mode: poly`).

**Firmware/API.** Neuer `type: "GY521"`-Zweig in
`DynamicItems::addSensorNoBegin()` neben `BME280`, liest `address` (Default
`0x68`) und legt einen `GY521TiltSensor` an — läuft sonst durch denselben Pfad
wie jeder andere Sensortyp. `docs/openapi.yaml`: `GY521` im `SensorCreate.type`-
Enum, `address`-Feldbeschreibung um die numerische I2C-Adresse (BME280/GY521)
ergänzt. Abhängigkeit `Adafruit MPU6050` (+ transitiv Unified Sensor/BusIO,
beide schon vorhanden) in `SensActCtrl/library.json` ergänzt.

**Frontend.** Neue Kategorie „Beschleunigung / Tilt" (Compass-Icon) in
`itemTypes.ts`, `GY521` als `SensorType` in `AddItemModal.tsx` mit
I2C-Adress-Umschalter (0x68/0x69, analog zum BME280-Muster) und Edit-Restore.

**Verifikation.** Neue native Tests `test_gy521` (Kanalform/-metadaten,
Stub-Werte nach `begin()`) und `test_gy521_tilt` (Komplementärfilter-Numerik
über `complementaryStep()`, Kanalform, End-to-End gegen den `GY521Sensor`-Stub)
— alle 265 native Tests grün. Firmware kompiliert für `esp32dev`
(`Adafruit MPU6050` löst über `library.json` automatisch auf). OpenAPI-Lint
und `pnpm typecheck` grün. UI gegen einen Node-Mock im Browser durchgeklickt:
Kategorie „Beschleunigung / Tilt" mit Compass-Icon, Gerätetyp-Auswahl,
Adress-Umschalter, gesendeter POST-Body (`{type:"GY521",id,address}`) korrekt,
Erfolgsmeldung.

**Offen** (siehe PLAN.md → Hardware-Verifikation): welche Achsenkombination
und Vorzeichen die reale Einbaulage des Schwimmkörpers braucht, ist eine feste
Annahme ohne Hardware-Test — muss am echten GY-521 verifiziert/angepasst
werden, danach `poly`-Kalibrierung gegen reale SG-Messpunkte.

## 2026-09-23 — Anzeigename (Label) für Registry-Items + entkoppeltes Umbenennen

Umsetzung zweier zusammenhängender PLAN.md-Punkte: „Registry-Items haben
keinen Anzeigenamen" und „Umbenennen nicht möglich, wenn eine Zuordnung zu
einem Regler besteht". Statt die fehlende Referenz-Rewrite-Mechanik für
Controller→Sensor/Aktor-Verweise nachzurüsten, wurde ein vom stabilen `id()`
getrenntes, frei editierbares Label eingeführt — Umbenennen ist damit nie
mehr vom Delete+Recreate-Pfad (und dessen Regler-Referenz-Blockade in
`DynamicItems::removeSensor`/`removeActuator`) abhängig.

**Architektur-Entscheidung.** Label lebt als Registry-Konzept in SensActCtrl,
nicht nur firmware-seitig — `Registry::setLabel(id, label)`/`label(id)`
(neue private `std::map<std::string,std::string> labels_`), bewusst **kein**
Feld auf `Sensor`/`Actuator`/`Controller` selbst: kostet so nur Speicher für
Items, die tatsächlich ein Label bekommen, statt jedes Item-Objekt zu
vergrößern (auch bei reiner Standalone-Nutzung der Library ohne UI), und
lässt die drei Interfaces unangetastet. `RegistrySnapshot::serialize()`
emittiert `"label"` optional (nur wenn nicht leer) für Sensoren (pro
Sensor-`id()`, nicht pro Kanal), Aktoren und Regler.

**Firmware.** Kein neuer `LabelStore` — `main.cpp` legt keine nativen Items
an, jedes Item läuft über `DynamicItems`, also wird Label einfach ein
weiterer Key `"label"` im ohnehin persistierten `cfgJson`. Neue
`DynamicItems::setSensorLabel`/`setActuatorLabel`/`setControllerLabel()`
aktualisieren Registry-Label + `cfgJson`, ohne Delete/Recreate — funktionieren
also auch bei bestehender Regler-Zuordnung. Drei neue Endpoints
`POST /api/{sensors,actuators,controllers}/{id}/label`, einheitlich als
Suffix analog zu `/calibration`/`/reset`/`/setpoint`/`/params`.

**Frontend.** `AddItemModal.tsx` bekommt ein Anzeigename-Feld neben der ID.
Kernstück: `onlyLabelDiffers()` vergleicht die neu gebaute Config
strukturell (key-sortierter JSON-Dump, damit Objekt-Key-Reihenfolge keine
falsche „geändert"-Erkennung auslöst) gegen die persistierte — hat sich außer
dem Label nichts geändert, wird nur `set<Rolle>Label()` aufgerufen statt
Delete+Recreate. Karten (`SensorCard`/`ActuatorCard`/`ControllerCard`) und
die Regler-Verdrahtungs-Dropdowns zeigen `label || id`, die rohe ID bleibt
als Tooltip (`title`) sichtbar. Die vorbestehende 405-Fehlermeldung bei
blockiertem ID-Rename wird jetzt im Frontend in einen verständlichen Hinweis
übersetzt (Label-Alternative wird genannt).

**Verifikation.** Neue native Tests für `Registry::setLabel/label` (Get/Set/
Overwrite/Clear/Default-leer) und `RegistrySnapshot` (Label anwesend/
abwesend je Sensor/Aktor/Regler) — alle 271 native Tests grün. Firmware
kompiliert für `esp32dev` (Flash 90,3 %). Redocly-Lint auf `openapi.yaml`
grün (neue Endpoints + `label`-Feld in Response-/Create-Schemas). Frontend
`pnpm typecheck` + `pnpm build` grün. **Nicht geprüft** (kein Board in dieser
Session verfügbar): das eigentliche UI-Verhalten am Gerät — Label an einem
regler-verdrahteten Sensor ändern (kein 405 mehr), ID an demselben Sensor
ändern (verbesserte Fehlermeldung), Label-Anzeige in Karten/Dropdowns +
ID-Tooltip.

## 2026-09-23 — IdsInductionCooker: eine Quelle statt drei

Beim Vorbereiten des RMT-Umbaus aufgefallen, dass Änderungen am lokalen
IdsInductionCooker-Checkout **nie in der Firmware landeten**. Ursache: die Library kam über
zwei Wege gleichzeitig — `symlink://../../../IdsInductionCooker` aus `platformio.ini` und ein
`dependencies`-Eintrag per Git-URL `#bf5be40` in `SensActCtrl/library.json`. PlatformIO holte
daraufhin eine zweite Kopie nach `libdeps`, kompilierte **beide**, und setzte die gefetchte im
Link-Kommando **nach vorn**. Der Linker bedient sich aus dem ersten Archiv, das die Symbole
liefert — ausgeliefert wurde also der gepinnte SHA. Eine zum Test eingefügte `#warning`
erschien brav im Build-Log und war trotzdem wirkungslos. Im CI galt dasselbe, womit der
Sibling-Checkout in `release.yml` nie etwas bewirkt hat.

Vier Reparaturversuche blieben erfolglos, isoliert in einem Wegwerf-Projekt nachgestellt:
Namen von `library.properties` und `library.json` angleichen (PlatformIO holt dann unter dem
neuen Namen erneut), `lib_ignore` (kappt die Abhängigkeitsbeziehung mitsamt Include-Pfad,
Build bricht am fehlenden Header ab), die Library als Submodul unter `lib/` legen, und
`lib/` zusätzlich mit Umbenennung. **PlatformIO befolgt einen `dependencies`-Eintrag mit URL
bedingungslos**, unabhängig davon, was lokal vorliegt.

Methodischer Fehler dabei, der fast zu einer falschen Lösung geführt hätte: Die `lib/`-Variante
sah zunächst erfolgreich aus, weil `libdeps` beim Test noch stale war — ohne gelöschte
`integrity.dat` unterbleibt das Nachholen, und es sieht nach Deduplizierung aus. Erst die
vollständige Neuauflösung zeigte das echte Verhalten.

**Lösung:** der Symlink ist raus, `SensActCtrl/library.json` ist die einzige Quelle. Damit
entfällt auch die Pflicht, das Library-Repo als Sibling des Repo-Roots zu klonen, samt der
Junction-Krücke für git-Worktrees; `release.yml` braucht keinen zweiten Checkout und keine
verschachtelte `Brauerei/`-Ablage mehr. Gearbeitet wird künftig in einem beliebigen eigenen
Klon des Library-Repos: dort committen, pushen, danach den SHA in `library.json` bumpen — erst
der Bump wirkt. SensActCtrl bleibt dadurch standalone installierbar.

Verifikation: nach vollständiger Neuauflösung kompiliert in allen drei Envs **genau ein**
`IdsCooker.cpp.o`, und zwar aus `libdeps`; `pio run` grün für esp32dev (Flash 90,3 %),
lolin_s2_mini (87,1 %) und lilygo_t_display_s3_amoled (25,1 %).

## 2026-09-23 — IDS-Keep-Alive: Bit-Bang raus, RMT rein

`IdsCooker::sendCommand()` taktete das Funkprotokoll der Platte in Software aus — 25 ms
Vorspann, 10 ms Pause, dann 33 Bits à `delayMicroseconds(5120|1280)` plus je 1280 µs Lücke.
`IdsActuator::tick()` ruft das alle 500 ms auf, der loopTask stand also zweimal pro Sekunde.
Der Frame geht jetzt als 34 `rmt_data_t`-Items an die RMT-Peripherie, `sendCommand()` kehrt
sofort zurück.

**Gemessen am esp32dev-Testboard**, mit einem IDS1-Testitem (pin_white 16, pin_yellow 17,
pin_interrupt 23) und einer Drahtbrücke 17 → 18 auf einen Capture-Pin. Das Messwerkzeug lag
auf dem Wegwerf-Branch `spike/ids-rmt`: eine ISR legt 256 Flanken-Zeitstempel in einen
Ringpuffer, `GET :81/spike/capture` dekodiert daraus bis zu drei vollständige Frames. Zuerst
gegen den **bestehenden** Bit-Bang kalibriert — der dekodierte Bitstring war zeichengleich mit
`CMD[1]` aus der Tabelle, bevor irgendetwas umgebaut wurde.

| | Bit-Bang | RMT |
|---|---|---|
| `registry.tick()` max | 141 280 µs | **3 791 µs** |
| `loop()` p99 | 160 ms | **12 ms** |
| `loop()` max | 154 ms | **18 ms** |
| Durchläufe 100–250 ms | 58 von 3356 (1,98/s) | **0** |

**Der Umbau ist eine Korrektheitsreparatur, nicht nur eine Latenzverbesserung.** Das war die
offene Frage aus PLAN.md: `AsyncTCP` läuft mit Priorität 10 ohne Core-Bindung, der Bit-Bang
ist also preemptierbar — ob das die Pulse verfälscht, war ungeprüft. Unter moderater Last
(ein SSE-Abonnent, zwei parallele Downloads) waren **drei von neun** erfassten Frames
fehlerhaft: gekippte Bits, weil eine 1280-µs-Null über die Entscheidungsschwelle gedehnt wurde.
Die Abweichungen sprengten die Toleranzen der Library selbst — bis 1904 µs gegen
`SIGNAL_HIGH_TOL` 1500, bis 2709 µs gegen `SIGNAL_LOW_TOL` 500. Unter derselben Last liefert
der RMT-Pfad **alle** Bitstrings korrekt, mit 29–64 µs Abweichung.

Im Leerlauf ist der un-preemptierte Bit-Bang übrigens minimal präziser als RMT (5 µs gegen
19–50 µs); unter Last kehrt sich das um zwei Größenordnungen um. Beides liegt weit innerhalb
der Protokolltoleranz.

Drei Dinge, die beim Umbau nicht offensichtlich waren: `rmtSetTick()` muss **nach** `rmtInit()`
kommen, weil das clk_div auf 1 stehen lässt (12,5 ns/Tick), womit 25 ms nicht ins 15-Bit-Feld
`duration0` passen. Der Item-Puffer ist Member, nicht Stack — `rmt_write_items()` ist
dokumentiert als *„will not copy data, instead it will point to the original items"*. Und ein
`txEndMs`-Schutz verwirft einen Frame, solange noch einer läuft: `rmt_write_items()` nimmt die
Kanal-Semaphore mit `portMAX_DELAY`, ein zweiter Aufruf würde also genau so lange blockieren,
wie die Änderung einspart.

Der Ruhepegel ist damit LOW statt HIGH, ohne Zutun — die Peripherie setzt
`idle_level = RMT_IDLE_LEVEL_LOW`. Das ist auch der richtige Pegel, denn `readInput()` sucht
das Startbit auf einer steigenden Flanke. Das `digitalWrite(PIN_YELLOW, HIGH)` in `Init()` war
ein Artefakt und entfällt im RMT-Zweig.

**Destruktor** (`IdsCooker` hatte keinen): Der Umbau führt eine knappe Ressource ein, ein
RMT-TX-Kanal wird belegt und nie freigegeben. Neun Lösch-/Anlege-Zyklen auf das Item am
Testboard belegten es: `registry.tick()` max sprang auf 141 417 µs zurück, die Capture zeigte
die Bit-Bang-Signatur — `rmtInit()` lieferte `nullptr` und die Firmware fiel stillschweigend
zurück. Mit Destruktor bleiben es nach denselben neun Zyklen 2 796 µs. Das `detachInterrupt()`
darin repariert nebenbei ein älteres Leck: `staticInduction` blieb nach einem `DELETE` hängen
und die ISR schrieb in freigegebenen Speicher.

Arduino Core 3 hat eine inkompatible RMT-API, der ESP8266 gar keine: beide behalten über den
`IDS_USE_RMT`-Guard den unveränderten Software-Pfad, ebenso der Fall, dass kein Kanal frei ist.

Nebenbefund, als eigener PLAN.md-Punkt festgehalten: unter parallelen Datei-Downloads steigen
**alle** Abschnittstimer gleichzeitig (bis 414 ms, einmal 14,2 s in einem Durchlauf), und bei
3 SSE + 6 Downloads nahm das Board ~40 s lang auf beiden Ports keine Verbindung mehr an — ohne
Absturz, die Uptime lief durch. Das ist nicht der IDS; es wurde bisher nur von ihm überdeckt.

## 2026-09-23 — IDS-Induktionskocher: E2E mit der echten Platte

Der seit Projektbeginn offene E2E-Punkt ist erledigt. Gefahren am **esp32dev** statt wie geplant
am LilyGo: dort war die Messbrücke ohnehin gesteckt, und der LilyGo hat einen Pin-Konflikt
(GPIO 1 trägt den HLT-OneWire-Bus **und** `IDS1.pin_white`), der so nicht zum Blocker wurde. Die
Platte hängt über Optokoppler an pin_white 16 / pin_yellow 17 / pin_interrupt 23; das Relais
sitzt in der Platte und wird über Weiß geschaltet.

**Ergebnis:** Relais klickt, Platte läuft an, folgt den Stufen (bei 10 % taktet sie selbst ein
und aus — unterhalb ihrer Mindestleistung normal —, ab 30 % läuft sie durch), `fault: null` über
0 / 10 / 30 / 100 / 0 %. Das Ausschalten wirkt: unser `CMD[0]` beginnt mit `101`, die
Leistungskommandos mit `1001`, und das **Antwort-Präfix der Platte kippt genauso mit**. Sie
spiegelt also den Kommandotyp zurück, was stärker ist als `fault: null` allein.

Möglich wurde das, weil die Messbrücke auf die **Antwortleitung** umgesteckt wurde (23 → 18):
die Platte spricht dasselbe Protokoll, das Spike-Harness dekodiert ihre Frames also mit. Damit
liest man die Antwort direkt, statt `fault` glauben zu müssen — `fault: null` ist sonst von
„gar nichts empfangen“ nicht zu unterscheiden. Ihr Fehlercode steht in den Bits 13–16 und war
durchgehend 0.

### Drei Defekte im Empfangspfad, gefunden und behoben

**Auswertung kam einen Frame zu spät.** `inputCurrent < 34` wartete auf ein 34. Bit, das die
Platte nie sendet; `BtoI(13,4)` lief erst, wenn der nächste Frame schon begonnen hatte, und las
die Bits des vorherigen. Jetzt wird nach dem 33. ausgewertet. Nebenbei wurde `inputBuffer[33]`
beschrieben, ein Byte hinter dem Array — **der Backlog-Eintrag dazu war sachlich falsch**: der
getroffene Nachbar ist nicht `newError`, sondern ein Padding-Byte (`inputBuffer` endet auf
Offset 46, `powerSampletime` ist 4-Byte-aligned auf 48). Folgenlos, aber undefiniertes
Verhalten.

**Ein gestörter Puls hätte die Rückmeldung dauerhaft stillgelegt.** Traf eine Pulslänge weder
das HIGH- noch das LOW-Fenster, wurde sie ignoriert, `inputCurrent` blieb stehen und
`inputStarted` für immer true. Der alte Erholungspfad lief unbeabsichtigt über genau den
34.-Bit-Fehler oben — mit dessen Korrektur musste ein echter Resync her.

**Die Fehlermeldung war Zeigerarithmetik.** `errorMessage = "Fehler: " + errorCode;` ist
`const char* + int`. Als die Platte im Lauf tatsächlich einmal **Code 1** meldete, kam die
Push-Benachrichtigung als „Störung: ehler:“ an — der Zeiger war um ein Zeichen vorgerückt. Ab
Code 9 hätte er hinter das Literal gezeigt. Jetzt `String("Fehler ") + errorCode` (die
StringSumHelper-Überladungen verlangen einen `String` links, die umgekehrte Reihenfolge ist
nicht übersetzbar).

### Startfenster: vorbeugend geweitet, nicht akut repariert

`readInput()` akzeptierte Startpulse nur bis 35 ms; die Platte sendet bis 34,1 ms. Gemessen
wurden 113 Frames: Minimum 26 503 µs, Maximum 34 149 µs, **keiner über 35 ms**. Die alte Grenze
hat also nichts verschluckt, die Weitung auf 45 ms ist Vorsorge. Was bleibt: die Pulslängen sind
**diskret** (26,5 / 29,0 / 30,3 / 30,8 / 32,8 / 33,4 / 34,1 ms), und 11 der 113 Frames liegen in
der 34,1-ms-Klasse — also eine feste Nachrichtenklasse 851 µs unter der Abbruchkante, keine
zufällige Streuung. Gefahrlos ist die Weitung, weil ihre Frames lückenlos kommen (184 ms lang,
182 ms Abstand): zwischen 35 und 45 ms existiert gar kein HIGH-Intervall.

**Methodischer Fehler dabei, der die erste Messung wertlos machte:** das Harness suchte
Startpulse im selben Fenster 15–35 ms, das die Library benutzt — es konnte eine Verletzung
dieser Grenze also gar nicht beobachten, die Aussage „kein Frame über 35 ms“ war zirkulär. Erst
mit 60 ms im Harness wurde sie belastbar. Ein Messwerkzeug darf die zu prüfende Grenze nicht
teilen.

### Bewusst nicht geändert

**Der IDS-Sollwert übersteht keinen Neustart** — nach einem Reset steht `target` auf 0 und die
Platte kommt nicht von selbst wieder hoch. Das fällt beim Testen auf und sieht nach einem Mangel
aus, ist aber so gewollt (Nutzer-Entscheidung 2026-09-23): ein Induktionsfeld, das nach einem
unerwarteten Reset selbsttätig wieder anläuft, wäre das größere Problem. Kein Backlog-Punkt,
damit es niemand versehentlich „repariert“.

**Das Abschaltverhalten bei Fehlern** (`Update()` kehrt bei `errorCode != 0` sofort zurück und
sendet gar nichts mehr, auch kein „Aus“) bleibt als Backlog-Punkt offen — gleiche Kategorie,
Produktentscheidung. Der Code-1-Vorfall hat ihm einen realen Auslöser gegeben: hätte der Code
angestanden statt sich nach einer Sekunde selbst zu heilen, wäre die Platte stillschweigend sich
selbst überlassen gewesen.

### Nebenbei

Zwei anfängliche „Abstürze“ waren die Hand am Stecker, ein Klackern ein Wackelkontakt. Übrig
blieben zwei echte **Brownouts** (`reset=9`), solange das Board aus der Platte versorgt wurde —
mit eigener USB-Versorgung weg. Das ist auch elektrisch richtiger: zieht das Board seinen Strom
aus der Platte, ist die galvanische Trennung der Optokoppler ohnehin aufgehoben. Eine einzelne
`reset=4`-Panic aus derselben Phase blieb unerklärt und trat danach nicht wieder auf.

Fault-Beobachtung über drei Minuten bei 10 % nach dem Fix: 173 Abfragen, kein einziger Fehler. Code 1 kam nicht wieder, die errorMessage-Korrektur ist damit zur Laufzeit **unverifiziert** - belegt ist nur, dass die Konkatenation korrekt gebildet wird.

## 2026-09-23/24 — Interaktives Display auf dem AMOLED-1.75, Stufe 1 (Branch `feature/lvgl-display`)

Aus dem Spike vom 2026-09-22 wird ein Feature, das im Repo bleibt. Nutzer-Entscheidungen vorab:
- frisch ab main statt auf dem Spike-Branch weiterbauen;
- `lv_timer_handler()` aus `loop()` statt eigenem Task;
- als erste Stufe die Items eines Dashboards, ohne das Grid-Layout.

Gebaut und am Gerät (brewcontrol.local, per OTA) Schritt für Schritt mit dem Nutzer
abgenommen, in drei Stufen.

**Panel.** Der Treiber ist `vendor/Arduino_GFX-1.3.7`, eine gekürzte Kopie von LilyGos Fork:
14 Dateien statt 18 MB, die Quellen unverändert. Eingebunden wird er per `symlink://` nur im
AMOLED-Env; `esp32dev` und `lolin_s2_mini` blieben bis Stufe 2 **byte-gleich** (1.726.965 B
bzw. 1.665.382 B). Drei Dinge waren nicht offensichtlich:
- **Takt.** Die Library taktet QSPI per Default mit **8 MHz**, so lief auch das
  Referenzbild im Spike. Ein Vollbild hätte damit ~110 ms gekostet; jetzt sind es 40 MHz.
- **Mindestfenster.** Der CO5300 nimmt keine Fenster unter 2×2 Pixel an, deshalb gibt es einen
  `rounder_cb`.
- **Umlaute.** LVGLs eingebaute Montserrat-Fonts können nur ASCII plus °. „Kühlen“ oder
  „Füllhöhe“ hätten Lücken gehabt. Deshalb gibt es eigene Latin-1-Fonts (`lv_font_conv`, Quelle
  ist die TTF aus dem LVGL-Paket, Anleitung in `src/display/fonts/README.md`).

Nebenbei ist der `Wire`-Punkt aus PLAN.md erledigt. `main.cpp` startet `Wire` jetzt als
Erstes auf `BREWCTL_I2C_SDA/SCL`. Im Core-2-Quelltext geprüft: Ein späteres `Wire.begin()`
ohne Pins, etwa von BME280/GY521 über Adafruit BusIO, lässt einen laufenden Bus in Ruhe
(`Wire.cpp:300`).

**Touch.** Der Treiber ist SensorLib 0.5.0 (`TouchDrvCST92xx`), er baut unter Core 2 ohne
Anpassung. Die Touch-Ebene liegt um **180° gedreht** gegen das Panel (oben meldete unten,
links meldete rechts). Beim ersten Test kam gar kein Druck an: Ein bildschirmfüllendes `lv_obj`
ist in LVGL per Default klickbar und schluckt jeden Druck.

**Seiten und Bedienung.** Pro Item gibt es eine Wischseite, zuerst Regler, dann Sensoren, dann
Aktoren. Hoch/Runter wechselt das Dashboard. Die Befunde, die das Design bestimmt haben:
- Die Firmware prüft den Not-Aus beim Schreiben nicht. Das Display ist deshalb bei
  eingerastetem Not-Aus komplett gesperrt, zusätzlich wird der Hintergrund rot.
- „Fremdgesteuert“ prüfte bisher nur das Frontend (`ownership.ts`). Das Display übernimmt die
  Regeln, sperrt aber, statt nachzufragen.
- `DashboardStore` hatte weder einen C++-Lesezugriff noch eine Sperre. Er bekommt einen Mutex
  nach `ProgramRunner`-Muster, `revision()` und `count()`/`dashboardAt()`.
- Items werden auf dem AsyncTCP-Task ohne Sperre gelöscht. Deshalb hält das Display keine
  Zeiger und sucht jede Id bei jedem Refresh neu.

Neu in bestehenden Klassen: `WebUI::estopLatched()`, `ProgramRunner::activeOwnerOf()`, und
`SettingsStore` bekommt `revision()` sowie Getter für die Akzentfarben.

Das Bedienmodell hat sich in der Abnahme an vier Stellen gegen den Plan verschoben:
- **Master-Schalter.** Geplant war, dass das Display nie `setEnabled()` aufruft. In der Web-UI
  **ist** der Master-Schalter aber bei Binär-Aktoren der einzige Schalter. Das Display bildet
  das jetzt nach: ein großer Knopf bei Binär-Aktoren, ein Power-Knopf bei stetigen Aktoren und
  Reglern. Wird ein Regler abgeschaltet, gehen seine Ausgänge auf Ruhe, wie in
  `ControllerCard.doToggle()`.
- **Ring.** Ein `lv_arc` als Slider verschluckte Wischgesten auf der ganzen Seite. Beim Wischen
  wurde der Sollwert unbemerkt verstellt: Die API meldete danach 46,5 statt der eingetippten
  73,0. Jetzt ist der Ring reine Anzeige des Istwerts in der Akzentfarbe. Ein weißer Griff ist
  der Sollwert und das einzige Ziel zum Ziehen; geschrieben wird erst beim Loslassen.
- **Schritte.** Die ±-Knöpfe wurden durch unsichtbare Tippzonen direkt vor und hinter dem Griff
  ersetzt, die mit ihm mitwandern.
- **Ausgang.** „Ausgang n %“ steht einzeilig in der Sekundärfarbe unter dem Istwert. Bei
  Aktoren mit Intervall steht dort das Intervall.

Zwei Absicherungen kamen aus der eigenen Durchsicht:
- **Neuaufbau aus dem Event.** Ein Tile-Wechsel konnte einen Neuaufbau auslösen, der den
  Tileview in seinem eigenen Event gelöscht hätte. Heute frischt der Tile-Wechsel nur die Seite
  auf; der Neuaufbau läuft über den Timer, beim Dashboard-Wechsel per `lv_async_call`.
- **Poolgrenze.** Ein erschöpfter LVGL-Pool endet in `LV_ASSERT`s Endlosschleife, also im
  Watchdog-Reboot, und das bei jedem weiteren Boot wieder. Deshalb gibt es höchstens 16 Seiten.
  Der Pool hat jetzt 32 statt 48 KB, gemessen belegt waren höchstens 7,7 KB.

**Am Gerät abgenommen:**
- Farben, runder Rand, Umlaute.
- Touch an Rändern und Mitte.
- Alle Seiten des Test-Dashboards, veraltete Ids übersprungen.
- Griff, Tippzonen und Power-Knöpfe; die Web-UI folgt binnen 1 s.
- Not-Aus-Sperre samt rotem Hintergrund. Dafür wurde der Not-Aus per API ausgelöst und danach
  der vorige Zustand wiederhergestellt.
- Neuaufbau bei Dashboard-Umordnung ohne Neustart: Dashboard per API verschoben und
  zurückgeschoben.
- Dashboard-Wechsel per Wischen.

**Rückwirkung auf `loop()`**, gemessen auf dem Wegwerf-Branch `spike/lvgl-metrics` (`GET
:81/spike`):

| | Leerlauf, 60 s | Dauerwischen, 38 s |
|---|---|---|
| `loop()` p50 / p99 / max | 6 / 22 / 40 ms | 6 / 72 / 137 ms |
| `displayTick` Ø / max | 0,6 / 16 ms | 7 / 132 ms |
| Durchläufe ≥ 50 ms | 0 | 189 von 2990 |
| Pixel pro Sekunde | 70 k | 2,46 M (≈ 5 Vollbilder/s) |
| Flush je 40-Zeilen-Block, max | 2,1 ms | 2,4 ms |

Wie die Zahlen zu lesen sind:
- **Rendern, nicht Blit.** Ein Vollbild braucht bei 40 MHz ~25 ms Blit. Die Zeit geht in LVGLs
  Software-Rendering der Ringe und der großen Schrift.
- **Registry.** `registry.tick()` hat unabhängig vom Display Spitzen um 20 ms.
- **Heap.** 111 KB internes Heap frei, größter DMA-Block 94 KB.
- **Bewertung.** Der Nutzer empfand das Wischen als „flüssig genug“. Der Stau beim Wischen ist
  so akzeptiert und steht als Einschränkung in PLAN.md, samt eigenem LVGL-Task als Ausweg.

**Größen:**
- AMOLED-Env: Flash 1.953.285 B (+297 KB, 29,8 %), RAM statisch 93.844 B (+35 KB).
- `esp32dev`/`lolin_s2_mini`: +~650 B Flash, +16 B RAM, durch die gemeinsamen Store-Änderungen.

**Offen, in PLAN.md:**
- Layout spiegeln.
- Chart-, Programm- und Timer-Seiten.
- Burn-in-Schutz.
- Fremdgesteuerte Items: nachfragen statt sperren?
- Die GPL-3.0-Kopfzeile in `Arduino_CO5300.cpp`. Nutzer-Entscheidung: später ersetzen.
- Der ungesperrte `Registry::label()`-Zugriff.

## 2026-09-24 — IDS-Library: Fehlerpfad, Leistungsmischung, Idempotenz

Vier offene Punkte aus dem Backlog geschlossen, zwei davon am realen Gerät gemessen. Die
Induktionsplatte hing noch am esp32dev, und der Messaufbau war die verderbliche Ressource —
deshalb jetzt.

### Ein Fehler kappte den Kommandokanal

`Update()` kehrte bei jedem Fehlercode ≠ 0 sofort zurück, und `updateError()` lieferte `true`,
solange der Code anstand — nicht nur auf der Flanke. Damit fiel der **gesamte** Rumpf aus: der
übergebene Sollwert wurde verworfen, bevor ihn irgendwer sah, Relais und Stufe froren ein, und
es ging kein Frame mehr raus, auch kein „Aus“.

Der schärfste Beleg ist der Not-Aus. `POST /api/estop` setzt `setEnabled(false)` für jeden
Aktor; bei `IdsActuator` führt das über `applyEnabled()` zu `Update(0)` — und genau dort stand
der Return. **Solange ein Fehler anstand, erreichte der Not-Aus die Platte nicht.** Die Absicht
war an zwei Stellen dokumentiert (`Actuator.h` nennt `IdsActuator` namentlich: „must actively
command zero, because going silent would leave the far end running“; `IdsActuator.cpp`
wiederholt es), und eine Zeile in der Library hebelte beides aus.

Entscheidung (Nutzer, 2026-09-24): **ein Fehler der Platte ist nur Status.** Der Kommandokanal
bleibt offen, der Fehler geht wie bisher als `fault` nach oben. Ein erzwungenes Abschalten
gehört eine Schicht höher, wo es konfigurierbar ist — in der Library wäre es fest verdrahtet,
und ein kurz angehobener Topf würde einen Maischeschritt beenden.

**Am Gerät gemessen**, nicht nur hergeleitet. Fehlercode 1 tritt beim Neuanlegen des Aktors
reproduzierbar auf und steht genau eine Sekunde — also über zwei `Update()`-Aufrufe. Das
Spike-Harness zählt die Flanken auf der Kommandoleitung, ein vollständiger Frame sind 68:

| Firmware | Treffer | Flankenrate in der Fehlersekunde |
| --- | --- | --- |
| alt (`7e196eb`) | 2 | **68**, 68 |
| neu (`53c05a0`) | 3 | **136**, 136, 136 |

68 ist exakt ein Frame statt zwei — der frühe Return hat einen der beiden Aufrufe verschluckt.
Genau die vorhergesagte Signatur.

### Leistungsmischung rechnete mit IDS2s Raster

`updatePower()` teilte fest durch `20L`. Das ist die Stufenbreite von IDS2; IDS1 hat 10-%-Stufen
und bekam dadurch nur die halbe Low-Zeit. Die Stufenbreite kommt jetzt aus `PWR_STEPS`, nicht als
neue Konstante — eine feste `10 * IDS_TYPE` hätte denselben Fehler nur eine Generation
weitergereicht.

A/B bei kommandierten 45 %, je ~100 s bei 1-Hz-Abtastung der gesendeten Stufe:

| | P5 (50 %) | P4 (40 %) | Mittelleistung |
| --- | --- | --- | --- |
| vorher | 75,3 % | 23,7 % | **47,6 %** |
| nachher | 50,0 % | 50,0 % | **45,0 %** |

Betroffen war genau der Regelpfad, den `Maischen` benutzt.

### Init() war nicht idempotent

`setupCommands()` rechnete die `CMD`-Tabelle in-place in Pulsdauern um; ein zweiter Aufruf hätte
sie komplett auf `SIGNAL_LOW` gesetzt, jedes Kommando wäre zu 33 Null-Bits geworden. Statt einer
zweiten Tabelle (so stand es im Backlog) ist die Tabelle jetzt `static const` und `sendCommand()`
rechnet beim Senden um: weniger Code, und 1452 Byte weniger Heap je Instanz, weil sie ins Flash
wandert. Am Gerät mit drei Lösch-/Anlege-Zyklen geprüft — danach weiterhin korrekte Frames.

Dazu ~35 Zeilen auskommentierter Vorgangercode raus, und drei Member (`timeTurnedoff`,
`lastInterrupt`, `powerLast`) bekamen einen Initialisierer: sie hatten keinen, der Konstruktor
setzte sie nicht, und `IdsCooker` wird per `new` angelegt — `powerLast` steuert den Schaltzyklus.

### Was nicht funktioniert hat

**Der geplante Topf-Test fällt aus.** Die Annahme war, „Kein Topf“ sei der eine Fehler, den man
auf Zuruf erzeugen kann. Am Gerät: Topf bei 30 % und bei 100 % heruntergenommen, über 240 bzw.
85 Sekunden blieb `fault` **null**. Die Zuordnung „Code 2 = kein Topf“ stammt aus der Tabelle der
Library, nicht aus einer Beobachtung an dieser Platte. Damit gibt es derzeit keinen Weg, einen
IDS-Fehler absichtlich auszulösen; dass der Fehlerpfad trotzdem gemessen werden konnte, lag
allein daran, dass Code 1 beim Neuanlegen von selbst auftritt.

Das erste A/B zum Fehlerpfad ging ebenfalls daneben: vier Zyklen auf jeder Firmware, drei Treffer
auf der neuen und **null** auf der alten. Erst acht weitere Zyklen auf der alten brachten die
zwei Vergleichswerte. Mit n=4 hätte die Aussage nicht getragen.

### Harness

Die Kommandoleitung triggert über den Optokoppler doppelt — der Ring des Spike-Harness wrapte
in unter einer Sekunde. Zwei Bedingungen im Capture-ISR: eine Flanke ohne Pegelwechsel ist keine,
und ein Pegelwechsel innerhalb von 200 µs nach der letzten akzeptierten ist ein Glitch (kürzestes
echtes Intervall im Protokoll ist die 1280-µs-Lücke). Danach exakt 136 Flanken/s, `dropped`
bleibt im Dauerbetrieb auf 0 — die Doppeltrigger kamen aus dem Einschaltmoment des Relais.

Nebenbefund: `/spike/capture` liegt auf **Port 81**. Eine Abfrage auf Port 80 liefert die SPA und
sieht aus, als wäre das Harness nicht auf dem Board.

## 2026-09-25 — IDS: Interrupt pro Instanz, und Fehlercode 1 eingegrenzt

Anlass war eine Vergleichstabelle zur ISR der fremden Brausteuerung **Brautomat**, die
dieselbe IDS-Codebasis nutzt und deren Code nicht öffentlich ist. Zwei Zeilen daraus ließen
sich gegen unseren Code prüfen, der Rest nicht übernehmen.

### Was die fremde Tabelle beigetragen hat — und was nicht

**`attachInterruptArg()`** war dort bereits im Einsatz. Das ist genau unser Backlog-Punkt
„Nur eine IDS-Platte pro Gerät“: `staticInduction` war ein globaler Zeiger, den jeder
Konstruktor überschrieb, sodass eine zweite Instanz der ersten die Interrupt-Zustellung
stahl — still, denn nur die zuletzt angelegte bekam noch Rückmeldungen. Umgestellt.

**Nicht übernommen** wurden die ISR-Mikrooptimierungen. Ihre Laufzeitzahlen rechnen mit
„1 Hz Interrupt“, die Empfangsleitung trägt aber rund 190 Flanken/s, und 60–70 µs für eine
Bitentscheidung sind bei 240 MHz etwa 15 000 Takte — plausibel nur, wenn ihre ISR loggt
(der Text nennt „InnuLog“ als Kompatibilitätsanforderung). Vor allem aber wäre ihre
„schnellere“ Bitdekodierung über eine einzige Schwelle bei uns ein Rückschritt: damit
entfällt der `else`-Zweig, also genau der Resync, der seit 2026-09-23 verhindert, dass ein
gestörter Puls die Rückmeldung dauerhaft stilllegt. Unsere ISR kostet bei ~190 Flanken/s
großzügig gerechnet 0,1 % CPU; der Engpass war nie sie, sondern das 139-ms-Senden.

### Eine Fehlannahme, die etwas Besseres freilegte — und sich dann als folgenlos erwies

Die Zeile „Zustandsvariablen: statisch im IRAM“ ließ vermuten, dass unser Empfangspfad
abstürzen könnte: nur `readInputStatic()` trägt ein `IRAM_ATTR`, der Rumpf `readInput()`
und `BtoI()` liegen im Flash. Im Arduino-Core nachgesehen: `gpio_install_isr_service()`
bekommt `ARDUINO_ISR_FLAG`, und weil `CONFIG_ARDUINO_ISR_IRAM` in allen drei SDK-Configs
**nicht gesetzt** ist, ist dieses Flag `0`; auch `__onPinInterrupt`, `micros()` und
`__digitalRead()` liegen im Flash. Also **kein Absturz, sondern Maskierung** — der
GPIO-Interrupt ist während Flash-Zugriffen abgeschaltet. Unser `IRAM_ATTR` bringt in diesem
Build folglich gar nichts.

Daraus wurde die Hypothese, dass LittleFS-Schreibvorgänge Flanken verschlucken und ein
zerstörter Frame den ominösen Fehlercode 1 erzeugt. Sie passte gut — und ist **falsch**.
Drei Phasen à 180 s bei 30 %:

| Phase | Schreiblast | Fehler |
| --- | --- | --- |
| K | keine | 0 |
| F | 35 Konfig-Schreibvorgänge (`POST .../label`) | 0 |
| G | 17 Uploads à 16 KB (erzwingt Sektor-Löschungen) | 0 |

Die Maskierung ist real, hat auf den IDS-Empfangspfad aber keine messbare Wirkung. Damit
ist die Frage geschlossen — und festgehalten, damit sie niemand erneut herleitet.

### Fehlercode 1: der Auslöser ist das Relais

Was ihn zuverlässig auslöst, ist das **Neuanlegen des Aktors**: 11 von 12 Zyklen, jeweils
exakt 1,1 s danach, für rund eine Sekunde. Die frühere Streuung (3/4, dann 2/12) war
ausschließlich ein Abtastartefakt des 1-Hz-Pollings; mit 2 Hz ist es deterministisch.
`Init()` setzt `PIN_WHITE` auf LOW, das Relais trennt die Platte also kurz vom Netz — Code
1 ist damit höchstwahrscheinlich ihr Anlaufzustand und kein Fehler. Offen bleibt nur, dass
er als `fault` in UI und Push erscheint, obwohl er einen Normalvorgang beschreibt.

### Die Grenze, die der Fix *nicht* aufhebt

`attachInterruptArg()` beseitigt die Interrupt-Grenze, nicht die harte: **RMT-Kanäle**.
Pro Platte einer, und davon gibt es 8 (ESP32), 4 (ESP32-S2) bzw. 4 sendefähige (ESP32-S3).
Ist keiner frei, liefert `rmtInit()` `NULL` und `Init()` fällt stillschweigend auf den
Software-Pfad zurück — die überzählige Platte schlägt also nicht fehl, sie blockiert den
`loop()` mit ~139 ms je Frame und macht den RMT-Umbau für alle rückgängig. Jetzt am
Fallback kommentiert und als Punkt beim Pin-Manager vermerkt, weil es dieselbe Klasse ist
wie die Pin-Belegung: eine Hardware-Ressource, die die UI beliebig oft vergeben lässt.

### Verifikation

Der Regressionstest nutzt genau den Code-1-Effekt: tritt er nach dem ISR-Umbau weiterhin
auf, empfängt die ISR. Ohne Messharness ist `fault: null` sonst nicht von „gar nichts
empfangen“ zu unterscheiden. Vorher 4/4, nachher 7/8 — der eine Ausreißer war der erste
Zyklus direkt nach dem Reboot. Dazu drei Envs gebaut und 271/271 native Tests.

**Ungeprüft bleibt:** der Mehr-Platten-Fall selbst (nur eine Platte vorhanden) und die
ESP8266-Variante von `attachInterruptArg` (hier nicht übersetzbar).

## 2026-09-25 — IDS-Fehlercodes entprellt; kleine Punkte abgeräumt

### Fehlercode 1 ist ein Anlaufzustand — und wird nicht mehr gemeldet

Am Gerät gemessen: die Platte meldet Code 1 rund **0,9 s nach dem Schließen des Relais** und
hält ihn **0,3 bis 0,9 s**, also ein bis zwei Frames bei ~366 ms Frameabstand. Drei von drei
Zyklen, jeweils im selben Zeitfenster. Er beschreibt damit keinen Betriebszustand, sondern den
Anlauf — `Init()` zieht `PIN_WHITE` auf LOW und trennt die Platte kurz vom Netz.

Die Entprellung gehört auf **Frame-Ebene**, nicht auf `Update()`-Ebene: letztere läuft mit 2 Hz
und hat den Code zweimal hintereinander gesehen. Ein Code wird jetzt in der ISR erst nach drei
gleichen Frames übernommen (~1,1 s), die 0 gilt weiterhin sofort — später melden ist die
harmlose Richtung, später entwarnen nicht. Das ist unabhängig von Code 1 richtig: ein einzelner
gestörter Frame soll nie einen Alarm auslösen.

**Verifikation mit einem Haken.** Nach dem Fix: 0 Fehler in drei Zyklen. Das allein beweist
nichts, weil die Entprellung genau das bewirken soll — und weil `fault: null` seit jeher nicht
von „gar nichts empfangen“ zu unterscheiden ist. Vorher trug Code 1 diesen Beweis selbst; seit er
geschluckt wird, nicht mehr. Deshalb ein unabhängiger Nachweis: ein `DigitalInput` mit Pullup auf
denselben Pin 11 gelegt (dieselbe Konfiguration, die `IdsCooker` ohnehin setzt) und während des
Laufs abgetastet — **23 Proben LOW, 46 HIGH** von 69. Die Antwortleitung lebt, das Ausbleiben ist
die Entprellung. Sonde danach entfernt.

### Der Aufbau ist umgezogen — und stand zwischendurch still

Die Platte hängt nicht mehr am esp32dev, sondern an einem dritten S2-Board,
**`brewcontrol-brautomat`** (192.168.178.86, IDS1 auf pin_white 7 / pin_yellow 9 /
pin_interrupt 11). Dort kam zunächst **keine** Rückmeldung an, obwohl die Senderichtung
funktionierte (die Platte lief). Ursache war mechanisch: der Optokoppler ist gesockelt, und beim
Umbau war ein Pin verbogen und nicht in die Sockelleiste gelangt — vom Nutzer mit dem Multimeter
gefunden. Danach war Code 1 sofort wieder reproduzierbar.

**Eigener Fehler dabei:** Ich habe dreimal „Platte läuft an“ angekündigt und gemessen, obwohl der
Nutzer zuvor gesagt hatte, Platte *und* Board seien vom Strom. Als das Board zurückkam, habe ich
den Rest des Aufbaus stillschweigend mit angenommen. Eine Ankündigung ist wertlos, wenn der
Zustand nicht vorher verifiziert wird.

### Zwei kleine Punkte nebenbei

**Das `native`-Env von `BrewControl/firmware` war nie kaputt** — das war eine eigene
Fehldiagnose. `pio test -e native` fährt 37 Tests aus `test/` grün; mit `test_build_src = no` ist
`pio run` schlicht das falsche Kommando. Der Irrtum entstand, weil `CLAUDE.md` unter „Common
Commands“ nur das native-Env von SensActCtrl nannte. Beide stehen dort jetzt, samt Hinweis.

**Die Pin-Konflikte am LilyGo sind aufgelöst** (am Gerät, nicht im Repo). Die im Backlog
beschriebenen Konflikte auf GPIO 1 und 2 waren bereits behoben — dafür lag `IDS1.pin_white`
inzwischen zusammen mit `agitator` auf **GPIO 3**, einem **Strapping-Pin**, und unbemerkt
`Riptide Pumpe` auf **GPIO 4**, dem **Batteriespannungs-ADC** des Boards. Jetzt pin_white 9,
agitator 8, Pumpe 2; GPIO 3 und 4 sind frei. Binnen drei Tagen hat dieselbe Ursache zweimal
zugeschlagen — nichts prüft die Belegung, und die Board-Defaults kennen die vergebenen Pins
nicht. Der Punkt liegt jetzt beim Pin-Manager, zusammen mit dem RMT-Kanalbudget.

## 2026-09-25 — Burn-in-Schutz fürs AMOLED (Branch `feature/display-burnin`)

Das runde AMOLED zeigte seit Stufe 1 dauerhaft ein statisches Bild bei Helligkeit 160.

### Umsetzung

- **Einstellungen:** neue Sektion `display` in `SettingsStore`, wirkt live und löst
  keinen Neustart aus. Felder: `brightness` (63 %), `dimAfterSec` (120),
  `dimPercent` (20 %), `offAfterSec` (600), `pixelShift` (aus). Dazu kommt
  `supported` (read-only, `BREWCTL_HAS_DISPLAY`). Die Werte sind in
  `POST /api/settings` validiert und in `docs/openapi.yaml` beschrieben.
- **Web-UI:** eigene Seite Einstellungen › Gerätedisplay. Sie erscheint im Index
  nur, wenn `display.supported` gilt.
- **`DisplayUI`:** kennt die Zustände Awake, Dimmed und Off. Die Leerlaufzeit
  kommt aus `lv_disp_get_inactive_time()`.
  - Schwarz bedeutet Helligkeit 0 und kein `lv_timer_handler()`. Nur der Touch
    wird alle 30 ms abgefragt.
  - Der aufweckende Druck wird bis zum Loslassen als „released“ an LVGL
    gemeldet.
  - Der Not-Aus (`holdAwake`) und jeder neue Alert (`AlarmStore::lastSeq()`)
    wecken das Display.
- **Pixel-Shift:** in `DisplayPages` wandert der Tileview alle 60 s eine von 8
  Positionen auf einem Kreis mit 3 px Radius weiter. Der Screen ist nicht mehr
  scrollbar, damit der Überhang keinen Scrollbereich erzeugt.
- Die Grundhelligkeit kam während der Abnahme als Wunsch dazu. Sie ersetzt die
  feste Konstante 160, ihr Default 63 % entspricht dem bisherigen Wert.

### Fehler in der Abnahme: Wischen aus Schwarz ging durch

Aus dem gedimmten Zustand wurde der aufweckende Druck korrekt geschluckt. Aus
Schwarz dagegen blätterte ein Wischen und verstellte den Griff; am Gerät sprang
der Sollwert von 72 auf 82 und wurde per API zurückgesetzt.

**Ursache:** `TouchDrvCST92xx::getTouchPoints()` quittiert jeden Frame per ACK.
Beim Aufwachen lesen der Poll in `tick()` und direkt danach LVGLs
Nachhol-Durchlauf zweimal hintereinander. Der zweite Lesevorgang liefert „kein
Finger“, das Verschlucken endete, und der Rest des Wischens kam bei LVGL an.

**Fix:** Ein Finger gilt erst nach 150 ms ohne Berührung als losgelassen
(`kLiftMs`). Daraus ist eine neue Regel in `BrewControl/CLAUDE.md` geworden.

### Verifikation

- Gebaut wurden alle drei Envs. Flash gegenüber `origin/main`:

  | Env | Flash |
  |---|---|
  | esp32dev | +2 676 B |
  | lolin_s2_mini | +2 776 B |
  | LilyGo | +3 700 B |

  esp32dev und lolin wachsen gleich, weil SettingsStore und die WebUI-Validierung
  gemeinsam sind. RAM wächst um +16 B bzw. +48 B.
- Native-Tests: 37/37 in der Firmware, 271/271 in SensActCtrl. Typecheck und
  Redocly-Lint sind sauber, die Lint-Warnung `info-license` bestand schon vorher.
- UI gegen einen Node-Mock geprüft:
  - Patch-Bodies für alle fünf Felder,
  - unbekannte Werte werden als eigene Option angezeigt,
  - 375 px Breite in Hell und Dunkel,
  - bei `supported: false` gibt es keinen Index-Eintrag.
- Am LilyGo per OTA, die Zeiten per API verkürzt (15/30 s, dann 5/10 s). Vom
  Nutzer bestätigt:
  - Dimmen und Schwarz.
  - Aufwecken mit aktuellem Bild.
  - Aufweck-Tipp ohne Wirkung auf Power-Knopf, Griff, Tippzone und beim Wischen
    links/oben, aus gedimmt und aus schwarz. Nach dem Fix zeigte der
    Snapshot-Vergleich keine Änderung durch das Aufwecken.
  - Not-Aus: das Display wurde sofort hell und rot und blieb hell. Danach wurde
    der vorige Zustand samt Regler-Parametern wiederhergestellt und per Snapshot
    geprüft.
  - Eine Test-Alarmregel weckte das Display aus Schwarz; die Regel ist wieder
    gelöscht.
  - Grundhelligkeit 100 % und 20 % sowie Dimmstufe 5 % und 50 %; beide wirken
    live, auch im gedimmten Zustand.
  - Pixel-Shift mit vorübergehend 5 s / 10 px: das Bild bewegte sich,
    Bedienung normal, nach dem Ausschalten zentriert.
- Am Ende wurden die Default-Werte zurückgesetzt und die finale Firmware
  (60 s / 3 px) geflasht.

**Ungeprüft bleibt:** das Verhalten ohne Touch-Controller. Dann wecken nur
Not-Aus und Meldungen.

## 2026-09-25 — WebSocket-Hub: `/set` und `/tune` gezielt statt Broadcast

`WebSocketTransport` (Server-Rolle) lernt aus eingehenden Data-Frames, welcher Client-Slot welches
`<device>` liefert (`devicePeer_`, Device = Segment vor `/sensor|actuator|controller/`,
`websocket::deviceOfTopic()`), und schickt Topics auf `/set` bzw. `/tune` nur an diesen Slot.
Device unbekannt → Broadcast wie bisher. Das Mapping gilt pro Verbindung: bei Disconnect und beim
erneuten Connect desselben Slots werden dessen Einträge verworfen, bis wieder ein Frame kommt.
Verifikation: 273 native Tests grün (2 neue für `deviceOfTopic`/`isCommandTopic`),
`BrewControl/firmware` `pio run -e esp32dev` baut. **Am Gerät nicht geprüft** — das Mapping liegt im
ARDUINO-Zweig und ist nativ nicht testbar.

## 2026-09-26 — `loop()` unter Datei-Downloads: AsyncTCP auf Core 0, Watchdog auf dem loopTask

Offener Punkt vom 2026-09-23: Unter parallelen `GET /api/files/download` wurden **alle**
Abschnitte von `loop()` gleichzeitig langsam, auch solche, die das Dateisystem nie anfassen
(`registry.tick()` bis 188 ms). Zwei Hypothesen standen: **H1** AsyncTCP (Priorität 10, ohne
Core-Bindung) landet auf Core 1 und hungert den loopTask (Priorität 1) aus; **H2** LittleFS liest
aus dem internen Flash, und jeder SPI-Flash-Zugriff legt den Cache beider Cores still.

**Messung** auf dem Wegwerf-Branch `spike/loop-starvation` (Worktree): `loop()`-Periode als
Histogramm plus Zeit je Service-`tick()`, abrufbar über `GET :81/spike`; dazu
`GET :81/spike/fsread`, das eine Datei aus einem auf Core 0 gebundenen Task liest, ganz ohne
Netzwerk. Last jeweils 60 s mit 1 SSE-Abonnent + 2 Download-Schleifen auf das UI-Bundle (mehr
Verbindungen laufen ins lwIP-Socket-Limit, siehe 2026-09-23).

| Board / Fall | `loop()` p99 | max | Durchläufe > 50 ms |
|---|---|---|---|
| esp32dev Leerlauf | 13 ms | 18 ms | 0 |
| esp32dev Downloads | **71 ms** | **168 ms** | 126 |
| esp32dev nur Flash-Lesen auf Core 0 | 26 ms | 61 ms | 9 |
| esp32dev Downloads, AsyncTCP auf Core 0 | 29 ms | 45 ms | 0 |
| esp32dev Downloads, **Fix-Firmware** | **12 ms** | **33 ms** | 0 |
| LilyGo Leerlauf (mit Display) | 22 ms | 159 ms | 6 |
| LilyGo Downloads | **190 ms** | **400 ms** | 315 |
| LilyGo nur SD-Lesen auf Core 0 | 22 ms | 195 ms | 2 |
| LilyGo Downloads, AsyncTCP auf Core 0 | **24 ms** | 119 ms | 2 |
| S2 Leerlauf | 7 ms | 14 ms | 0 |
| S2 Downloads | **420 ms** | **576 ms** | 183 |
| S2 Downloads, AsyncTCP-Priorität 1 | **22 ms** | 34 ms | 0 |

**Ergebnis:** H1 ist die Ursache, auf allen drei Boards. Der Handler von `:81/spike` lief ungebunden
jedes Mal auf Core 1, gebunden auf Core 0. Am LilyGo (SD) bremst reines Lesen `loop()` überhaupt
nicht, dort ist es ausschließlich die Aushungerung — und sie ist dort stärker (`loop()` lief
unter Last nur noch mit einem Fünftel der Rate). H2 gibt es auf dem esp32dev messbar, aber klein
(p99 13 → 26 ms bei Dauerlesen), und unter echter Download-Last ist davon mit der Fix-Firmware
nichts mehr zu sehen. Der Download-Durchsatz ist gebunden wie ungebunden gleich (~190 KB/s für
das 124-KB-Bundle). Der 14,2-s-Ausreißer vom 2026-09-23 trat in keiner Messung wieder auf.

**Fix:** `-DCONFIG_ASYNC_TCP_RUNNING_CORE=0` in `[common]`. Der S2 hat nur einen Core, dort hilft
das nicht, und er war am schwersten betroffen. Für ihn setzt `[env:lolin_s2_mini]` zusätzlich
`-DCONFIG_ASYNC_TCP_PRIORITY=1`: Bei gleicher Priorität teilt der Scheduler die CPU zwischen
AsyncTCP und loopTask im Wechsel auf. Durchsatz unverändert (~300 KB/s), `/api/snapshot` unter
Download-Last 50–125 ms statt 20 ms — für die UI unkritisch. Auf den Dual-Core-Boards bleibt die
Priorität beim Library-Default.

**Watchdog auf dem loopTask** (Nutzer-Entscheidung): Die API läuft auf dem AsyncTCP-Task und
antwortet weiter, während `loop()` steht — genau so sah der Programm-Hänger vom 2026-09-12 aus.
`setup()` stellt am Ende den Task-Watchdog, den der Arduino-Core schon betreibt (5 s, beobachtet
IDLE0), per `esp_task_wdt_init(30, true)` auf 30 s um und meldet mit `enableLoopWDT()` den
loopTask an; der Core füttert ihn vor jedem `loop()`. `FirmwareUpdater::streamDownload()` füttert
ihn zusätzlich, weil ein OTA-Pull im loopTask länger laufen kann. Den Grund des letzten
Neustarts meldet `GET /api/update/status` als `resetReason`; die Firmware-Seite zeigt ihn an und
färbt ungeplante Neustarts (Watchdog, Absturz, Spannungseinbruch) rot. Einen Alert dafür gibt es
nicht, `AlarmStore` bräuchte eine neue Art — als eigener Punkt in PLAN.md.

**Verifikation:** `GET :81/spike/hang?s=40` blockiert den loopTask. Am esp32dev antwortete die
API währenddessen weiter (Uptime lief hoch), nach ~30 s startete das Board neu und meldete
`resetReason: "task_wdt"`. Am LilyGo dasselbe mit laufendem Programm „Hermann-Weizen“ im zweiten
Schritt (`currentStep: 1`, 60 s): nach dem Neustart lief es im selben Schritt mit unverändertem `stepStartedEpoch` weiter,
Restzeit passend zur Uhr (3 s), und schaltete danach regulär weiter. Der Stromlos-Zyklus meldete
`power_on`, OTA-Flashes `sw`. Zum Schluss laufen alle drei Boards auf der Fix-Firmware ohne
Messwerkzeug. Die Update-Prüfung beim Boot (TLS im loopTask) lief ohne Auslösen
durch. Checks: `pio run` für alle drei Envs, `pio test -e native` (37), `pnpm typecheck`,
`pnpm build`, OpenAPI-Lint.

**Zwischenfall am LilyGo:** Der erste `fsread`-Task gab nie ab und hungerte IDLE0 aus — Reset
durch den Task-Watchdog (`esp_reset_reason()` 6), zweimal mitten im SD-Lesen. Mit `vTaskDelay(1)`
nach jeder Datei lief er sauber. Nach dem nächsten OTA-Flash hing die SD-Karte nicht mehr ein
(Registry leer, Einstellungen auf Code-Defaults, auf die Karte wurde nichts geschrieben), auch
nicht nach zwei Software-Neustarts — die nehmen der Karte nicht den Strom. Nach einem
Stromlos-Zyklus war sie vollständig wieder da (Config, Logs, Items) — mit unveränderter
Fix-Firmware, die damit als Ursache ausscheidet. Der Lesepfad des Spikes war bewusst ungesperrt
wie `AsyncFileResponse`; daraus der neue PLAN.md-Punkt zum fehlenden `SdLock` bei Downloads auf
SD-Boards.

**Nachtrag — erstes Release und OTA-Pull:** `main` gepusht, Tag `v0.1.0` gesetzt (erster Tag im Repo), `release.yml` baute alle drei Images plus `webui.tar`. Am LilyGo `POST /api/update/check` → `updateAvailable: v0.1.0`, dann `POST /api/update/install`: ~13 s Asset-Download, ~30 s Firmware-Flash, zusammen gut 40 s im loopTask — länger als der 30-s-Watchdog, trotzdem `resetReason: "sw"`, das Füttern in `streamDownload()` wirkt. Danach `currentVersion: v0.1.0`, UI aus dem Release ausgeliefert, Items/Config/Logs unverändert. Auf den LittleFS-Boards bewusst nicht ausgelöst: `doInstall()` legt das Release-Tar neben `/www` ab, das passt nicht in die 256-KB-Partition (neuer PLAN.md-Punkt). esp32dev und beide S2 (`brewcontrol-lolin`, `brewcontrol-brautomat`) laufen auf `5213589`, inhaltlich gleich mit `v0.1.0`.

## 2026-09-26 — Pin-Manager Stufe 1 und Bearbeiten per PUT (Branch `feature/pin-manager`)

Anlass waren die Pin-Konflikte am LilyGo (zweimal in drei Tagen, einmal auf einem Strapping-Pin) und
der DAC-Aktor, der auch am S3 angeboten wurde. Bewusst **ohne** die Peripherie-Abstraktion: alle Pins
stehen unter festen Konfig-Schlüsseln in `DynamicItems.cpp`, geteilt wird nur OneWire und SPI.

### Umsetzung

- **`firmware/src/BoardPins.h`**: Tabelle je Board (esp32dev, lolin_s2_mini, LilyGo-AMOLED), gewählt
  per `CONFIG_IDF_TARGET_*`. Klassen `free`, `risky` (Strapping, USB, UART0, Batterie-ADC,
  Onboard-LED), `reserved` (BOOT-Taste, SD, I²C, Display, Touch-/RTC-Interrupt), `forbidden`
  (Flash/PSRAM); dazu Input-only, DAC-Pins und RMT-TX-Kanäle (8/4/4). SD- und I²C-Pins des LilyGo
  sind per `static_assert` an die Build-Flags gekoppelt.
- **`firmware/src/PinMap.h`** (header-only, nativ getestet): `collectPins` liest die Pins einer
  Item-Config, `checkItemPins` prüft ein neues/ersetzendes Item (400 unmöglich, 409 belegt/reserviert/
  kein RMT-Kanal, Warnungen für bedenkliche Pins), `findPinConflicts` findet Konflikte im Bestand,
  `writePinsJson` baut `GET /api/pins`. Ein Pin hat keine vorab festgelegte Rolle — das erste Item
  bestimmt sie, teilen dürfen nur Items derselben Bus-Art.
- **`DynamicItems`**: `addSensor`/`addActuator` prüfen die Pins; der Boot-Pfad (`NoBegin`) lädt
  unverändert und loggt Konflikte seriell (`[pins] GPIO …`). Neu `replaceSensor/Actuator/Controller`:
  Pins vorab prüfen (eigene zählen als frei), altes Item über `remove*` entfernen, neues über `add*`
  anlegen, bei Fehlschlag das alte aus seiner gespeicherten Config wiederherstellen, Listenposition
  beibehalten.
- **WebUI**: `PUT /api/{sensors,actuators,controllers}/{id}` (neue `PutJsonPrefixHandler`),
  `GET /api/pins`, 409 an den POST-Routen. OpenAPI und README-Routentabelle nachgezogen.
- **Frontend**: Bearbeiten nutzt `PUT` statt delete + create — ein abgelehntes Bearbeiten ließ früher
  das Item verschwinden. `PinHint` unter jedem Pin-Feld (frei / gemeinsamer Bus / bedenklich / belegt
  von X / vom Board belegt), Bestätigungs-Checkbox für bedenkliche Pins (die Firmware lässt sie zu),
  PWM/DAC-Auswahl nur bei Boards mit DAC, IDS-Typen gesperrt ohne freien RMT-Kanal,
  Konflikt-Banner auf der Geräte-Seite.
- **Nebenfund**: `BREWCTL_ONEWIRE_PIN`/`BREWCTL_SSR_PIN` wurden nirgends gelesen — die LilyGo-Konflikte
  kamen aus der Nutzer-Config, nicht aus Board-Defaults. Flags und die veraltete README-Pintabelle
  (`kOneWirePin`, `kSsrPin`) entfernt.
- **Gefunden**: `IDS1.pin_white` am LilyGo liegt seit der Bereinigung vom 2026-09-25 auf GPIO 9, der
  Touch-/RTC-Interrupt-Leitung — jetzt als Konflikt gemeldet, Punkt in PLAN.md.

### Verifikation

- Native Tests: 53/53 in der Firmware (16 neu in `test_pin_map`: Schlüssel je Typ, OneWire-/SPI-Teilen,
  CS exklusiv, Input-only, DAC, RMT-Budget, Ersetzen, Bestandskonflikte, JSON). Frontend: 46/46
  vitest (7 neu für `pins.ts`), Typecheck und Build sauber. Redocly-Lint sauber (bekannte
  `info-license`-Warnung).
- Alle drei Envs bauen.
- UI gegen einen Node-Mock (LilyGo-ähnliche Tabelle, IDS1 auf GPIO 9): Banner, Hinweis „bedenklich“
  bei GPIO 3, Speichern erst nach Haken und dann genau **ein** `PUT` (kein DELETE im Request-Log),
  GPIO 7 → 409 mit Text und Item bleibt auf GPIO 8, eigener Pin beim Bearbeiten „frei“,
  regler-verdrahteter IDS1 → verständliche Meldung, nichts verändert, PWM/DAC-Auswahl fehlt ohne DAC,
  IDS-Typen gesperrt bei 1/1 RMT-Kanälen.
- **Am LilyGo per OTA** (nach Merge von `main` inkl. `fix/loop-starvation`, `v0.1.0-3-gcb07334`):
  Config lädt unverändert, `GET /api/pins` meldet genau den GPIO-9-Konflikt (`IDS1.pin_white`),
  `rmtUsed` 1/4, kein DAC. Anlegen auf GPIO 2 → 409 „already used by Riptide Pumpe (pin)“,
  GPIO 7 → 409 reserviert (I2C), GPIO 30 → 400 Flash, GPIO 22 → 400 existiert nicht, DAC → 400
  „this board has no DAC“, zweiter DS18B20 auf dem OneWire-Pin 1 → 204. `PUT` auf einen Test-Aktor:
  Pin belegt → 409, Config ohne `pin` → 400 und das Item steht unverändert an seiner Stelle
  (Rückfall greift), gleiche ID, Umbenennen, Pin-Wechsel 47 → 48 → 3 → 204. `PUT` auf `IDS1` → 409
  (Regler `Maischen`), unbekanntes Item → 404. `PUT` auf den Regler (Kp 8 → 9, Sollwert 72 und
  `enabled` im Body) → übernommen, übersteht einen Neustart; danach zurück auf 8.
- **Eine Panic:** der erste `PUT` mit Umbenennen **und** Pin-Wechsel (47 → 3) endete in einem
  Neustart (`resetReason: panic`, nichts gespeichert, Config intakt). Fünf Wiederholungen derselben
  bzw. ähnlicher Änderungen liefen sauber. Wahrscheinlichste Ursache ist die bekannte fehlende Sperre
  zwischen Item-Änderungen (AsyncTCP, jetzt fest auf Core 0) und `registry.tick()`/Display im
  loopTask (Core 1) — derselbe Mechanismus trifft DELETE und POST. Nicht belegt, weil der Backtrace
  fehlt. PLAN.md-Punkt entsprechend erweitert.
- Nicht am Gerät geprüft: die UI-Pfade selbst (nur gegen den Mock), das RMT-Limit (nur eine Platte).

### Nachtrag: Registry-Sperre

Als Folge der Panic: `RegistryLock.h` (rekursiver Mutex nach dem Muster von `SdLock.h`). `loop()` hält
ihn um alles, was die Items durchläuft — `registry.tick()`, `webUI.tick()`, MQTT/Webhook/WebSocket/
ESP-NOW-Publisher und -Transports, Remote-Discovery, Display. Außerhalb bleiben OTA, Web Push, mDNS
und WLAN-Reconnect, weil sie lange blockieren können. Die REST-Handler nehmen ihn um jede
Item-Änderung (anlegen, ersetzen, löschen, Label, Kalibrierung, Reset) **mit 3 s Zeitlimit** — der
AsyncTCP-Task steht unter Watchdog und darf nicht auf einen hängenden `loop()` warten; sonst 503
`busy, retry`, nichts geändert. `saveToSD` läuft erst nach der Freigabe, damit gilt immer „Registry
vor SD“ (kein Deadlock). Die Not-Aus-Deaktivierung neuer oder ersetzter Items liegt mit in der Sperre,
vorher konnte ein frisches Item bei eingerastetem Not-Aus einen `tick()` lang aktiv sein. Der Not-Aus
selbst nimmt die Sperre bewusst nicht. OpenAPI: 503 an allen 15 betroffenen Operationen.

Verifikation: drei Envs bauen, 53/53 nativ, Redocly sauber. Am LilyGo per OTA 40 Runden aus
`PUT` (Umbenennen + Pin 47/48/3 im Wechsel), `POST` und `DELETE` eines DS18B20 auf dem OneWire-Pin —
120 × 204, kein Neustart (Uptime durchgehend, `resetReason: sw` vom OTA), Antwortzeit Median 256 ms,
Maximum 507 ms (überwiegend SD). Danach Ausgangszustand wiederhergestellt. Die ursprüngliche Panic
war nicht deterministisch reproduzierbar; dass die Sperre sie behebt, ist also plausibel, aber nicht
bewiesen. Display-Bedienung unter der Sperre vom Nutzer am Gerät bestätigt.

## 2026-09-26 — „Installieren“ auf allen Boards: nur `.gz` im Release, Update-Modus beim Boot

Nach `v0.1.0` war offen, dass „Installieren“ auf den 256-KB-Boards scheitert. Zwei Ursachen, und
beim Nachmessen kam eine dritte dazu.

**1. Release-Tar zu groß.** `release.yml` gzippte mit `gzip -k9`, das `webui.tar` enthielt jede
`.js`/`.css`/`.html` roh und gzip (~610 KB). Die Rohdateien braucht das Gerät nicht:
ESPAsyncWebServer liefert `.gz` transparent aus, `AsyncFileResponse` auch beim SPA-Fallback auf
`index.html`. Nutzer-Entscheidung: nur `.gz` ins Tar, kein Filter auf dem Gerät. `pnpm build:sd`
(`scripts/gzip-dist.js`) ersetzt die Originale jetzt durch ihre `.gz`, `release.yml` nutzt es —
~160 KB. Das normale `webui.tar` passt damit auch beim manuellen Upload auf die kleinen Boards.

**2. `doInstall()` ohne In-place-Logik.** Es entpackte immer nach `/www.new` neben `/www` und
prüfte den Platz nicht (ohne `littleFsHasRoomFor` panict esp_littlefs bei voller Partition). Die
Logik des manuellen Uploads — Ziel, Aufräumen, Platzprüfung, `index.html` als `.part` bis zum
Schluss — steckt jetzt in `src/AssetInstall.h` und wird von beiden Pfaden benutzt.

Released als `v0.1.1`. esp32dev und LilyGo installierten sauber, **beide S2 nicht**:
„asset download/extract failed“, der lolin scheiterte schon an der Prüfung. Die bisherige Meldung
verriet nichts; mit HTTP-/TLS-Fehler und Heap im Fehlertext zeigte sich
`SSL - Memory allocation failed` bei 58–68 KB freiem Heap und 32 KB größtem Block.

**3. TLS-Speicher auf dem S2.** Der vorkompilierte Core reserviert pro Verbindung feste
16-KB-mbedTLS-Puffer (`CONFIG_MBEDTLS_SSL_MAX_CONTENT_LEN=16384`, keine dynamischen Puffer), ein
Handshake braucht so ~50 KB mit zwei ~17-KB-Blöcken. Der S2 hat 320 KB internen RAM, im Betrieb
bleiben 58–65 KB, zerstückelt. Zusätzlich hielt `HTTPClient` bei der 302-Weiterleitung auf den
Asset-Host die erste TLS-Sitzung offen (`setURL()` setzt `_canReuse`). Die Weiterleitung von Hand
allein reichte nicht: In drei Runden scheiterte der brautomat zweimal (Handshake zu
`release-assets.githubusercontent.com` beim Firmware-Download), der lolin dreimal schon bei
`api.github.com`.

**Fix (Nutzer-Entscheidung „Update-Modus beim Boot“):** „Installieren“ schreibt den Kanal in NVS
(`brewctrl/ota_install`) und startet neu. `setup()` ruft direkt nach dem WLAN
`FirmwareUpdater::runPendingInstall()` auf, bevor ESP-NOW, MQTT, Registry und Webserver Heap
belegen; der Eintrag wird vor dem Versuch gelöscht, ein Absturz wird also nicht zur Boot-Schleife.
Erfolg → Neustart in die neue Firmware. Fehlschlag → Grund in `brewctrl/ota_error`, normaler Boot,
`begin()` zeigt ihn als `state: error` an (und hält damit die Boot-Auto-Prüfung davon ab, ihn zu
überschreiben). Mitgenommen: Weiterleitungen von Hand mit frischem Client je Hop; `/www` wird erst
geleert, wenn der Tar-Download mit 200 antwortet (vorher kostete ein reiner Netzwerkfehler auf den
kleinen Boards die UI); Fehlertexte nennen Host, HTTP-/TLS-Fehler und Heap. Die UI zeigte beim
Installieren ohnehin schon „Gerät startet neu“, am Frontend ändert sich nichts.

**Verifikation:** `pio run` alle drei Envs, `pio test -e native` (53), Typecheck, OpenAPI-Lint.
Manueller Upload des neuen `.gz`-Tars am lolin (in place) und LilyGo (staged) → 200, UI inkl.
SPA-Route über `index.html.gz`. „Installieren“ von `v0.1.1` im Update-Modus: **beide S2 je
3 von 3** (vorher 1 von 6), der lolin, obwohl seine Prüfung im Betrieb weiter scheitert; esp32dev
und LilyGo je 1 von 1. Danach überall `v0.1.1`, UI 200, Items unverändert, kein `/www.new`. Der
lolin meldete nach dem Boot sogar `noUpdate` — die Auto-Prüfung früh nach dem Boot kommt dort
durch. **Nicht provoziert:** der Fehlerpfad im Update-Modus (gespeicherter Fehler nach dem Boot),
es gab keinen billigen Weg, einen Download gezielt scheitern zu lassen.

## 2026-09-26 — Alert bei ungeplantem Neustart

Neue Alarm-Art `system` (`src` = `system/reset`): `setup()` fragt `FirmwareUpdater::unexpectedResetReason()`
und ruft bei `panic`/`int_wdt`/`task_wdt`/`wdt`/`brownout` `AlarmStore::onUnexpectedReset()` auf
(Severity `critical`, `detail` = Reset-Grund). Geplante Resets (`sw`, `power_on`, `external`,
`deep_sleep`) melden nichts. Frontend: `AlertKind` um `system` erweitert, Text in
`AlertCenter.alertText`; `PushService::describe_` und `openapi.yaml` nachgezogen.

**Push:** `PushService` verwirft Alerts ohne gültige Uhr, deshalb wird der Alert erst aus `loop()` erzeugt,
sobald NTP synchronisiert hat (Zeitstempel und Push kommen so durch); ohne WLAN/NTP nach 2 min trotzdem, dann
`ts: 0` und nur im Alert-Center. **Verifikation:** `pio run -e esp32dev`, Frontend-Typecheck, OpenAPI-Lint grün.
Am Gerät nicht ausgelöst (kein Watchdog-Reset provoziert).

## 2026-09-26 — RMT-Fallback der IDS-Platte wird gemeldet

**Problem:** Findet `IdsCooker::Init()` keinen freien RMT-Kanal, fiel es still auf das Software-Timing zurück
(~139 ms Blockade je Frame in `loop()`), ohne dass es jemand sah. Die Firmware lehnt überzählige Platten seit
dem Pin-Manager ab (409), die Library selbst nicht.

**Umsetzung:** `IdsInductionCooker` (`e4dbe90`): neues `rmtFallback()`, wahr nur wenn `rmtInit()` `NULL` lieferte
(auf Core 3 / ESP8266 bewusst falsch, dort ist Software-Timing der Normalfall). `IdsActuator::fault()` liefert
dann „Kein RMT-Kanal, Software-Timing blockiert“ (ein echter Cooker-Fehlercode hat Vorrang). SHA in
`SensActCtrl/library.json` gebumpt. **Verifikation:** `pio run -e esp32dev` grün; am Gerät nicht
ausgelöst (dafür wäre ein Kanalmangel nötig), keine native Tests, weil der Pfad hinter `ARDUINO` liegt.

## 2026-09-27 — Heap-Fresser: Messung mit `GET /api/diag/heap` (Branch `feat/heap-diag`)

**Anlass:** Auf den S2 scheitert „Auf Updates prüfen“ im Betrieb an TLS-Speicher, und niemand wusste,
wer den internen RAM belegt. **Umsetzung:** `src/HeapDiag.h` + `GET /api/diag/heap` (dauerhaft, nur API,
Nutzer-Entscheidung): interner Heap (`free`/`largest`/`minFree`), PSRAM, Heap nach jedem `setup()`-Block
(`boot`, Marken in `main.cpp` und vor `server_.begin()`) und Stack-Reserve der bekannten Tasks
(`xTaskGetHandle`; eine vollständige Task-Liste gibt der Core ohne Trace-Facility nicht her).

**Boot-Verlauf, interner Heap in KB (Abnahme je Block):**

| Block | lolin (S2) | brautomat (S2) | esp32dev | LilyGo (S3) |
|---|---|---|---|---|
| frei bei `setup()`-Start | 153,8 | 153,8 | 277,0 | 278,0 |
| WLAN | 35,7 | 35,7 | 50,5 | 38,1 |
| Settings + mDNS | 7,3 | 7,3 | 7,0 | 6,7 |
| Stores (Items, Logs, Programme …) | 3,8 | 2,5 | 5,6 | 16,7 |
| Registry + Publisher-Anbindung | 6,1 | 0,9 | 4,9 | 7,8 |
| Push (webpush-Task, nur wenn eingerichtet) | – | – | 18,0 | – |
| Routen registrieren (85 Handler) | 13,5 | ≈ 30,7 zus. | ≈ 27,9 zus. | ≈ 30,6 zus. |
| `server_.begin()` (async_tcp-Task, 16 KB Stack) | 17,0 | (mit Routen) | (mit Routen) | (mit Routen) |
| Display (LVGL) | – | – | – | 39,3 |
| **frei im Betrieb** | **~59** | **~71** | **~144** | **~110** (+8 MB PSRAM) |

Vor `setup()` fehlen auf dem S2 schon ~170 KB der 320 KB: 66 KB IRAM-Code (auf dem S2 aus demselben SRAM),
66 KB `.data`/`.bss`, dazu Caches und System-Tasks. WLAN-Puffer und IRAM-Umfang legt der vorkompilierte Core
fest — ohne eigenen Core-Build bzw. Core 3 nicht änderbar.

**Laufzeit (lolin):** SSE kostet wenig — 1 Client ~0,6 KB, 3 Clients ~6 KB; ein Client, der nicht liest,
staut nichts auf (Verdacht „32 × 4 KB Queue“ widerlegt). Ein UI-Seitenaufruf drückt kurzzeitig 20 KB, der
größte Block fällt dabei auf 9 KB, danach alles zurück. **Stacks:** `async_tcp` nutzt von 16 KB höchstens
~2 KB (S2) bzw. ~3,9 KB (S3); `loopTask` ~4,6 KB (S2) bzw. ~5,6 KB (esp32dev) von 8 KB.

**PSRAM:** Das S2 hat 2 MB PSRAM aktiv (Board-JSON setzt `BOARD_HAS_PSRAM`, Core-sdkconfig `CONFIG_SPIRAM`),
davon ~20 KB belegt. Der Kommentar in `PushService.cpp` („lolin_s2_mini hat keins“) ist korrigiert. mbedTLS
nutzt es nicht (`CONFIG_MBEDTLS_INTERNAL_MEM_ALLOC`).

**TLS-Befund:** „Auf Updates prüfen“ im Betrieb: lolin scheitert reproduzierbar („SSL - Memory allocation
failed“ bei 54 KB frei / 31,7 KB größter Block, `minFree` 13 KB), brautomat kommt durch (71 KB frei,
`minFree` 19 KB — der Handshake braucht also ~51 KB). **Experiment** (nicht committet):
`mbedtls_platform_set_calloc_free()` auf einen Allokator, der erst PSRAM, dann internen RAM nimmt — am lolin
**3 von 3** Prüfungen erfolgreich, `minFree` blieb bei 50 KB. Der Core baut mbedTLS mit
`MBEDTLS_PLATFORM_MEMORY`, der Umbieger greift also zur Laufzeit.

**Fix (Nutzer-Auswahl aus der Fix-Liste):** `tlsAllocToPsram()` in `main.cpp`, erste Zeile nach dem Boot-Log
(also auch vor dem Update-Modus): mbedTLS allokiert aus PSRAM, interner RAM bleibt Rückfall; ohne PSRAM
(esp32dev) unverändert. Damit ist der PLAN-Punkt „S2: Auf Updates prüfen scheitert im Betrieb“ erledigt.
**Nicht umgesetzt:** `async_tcp`-Stack 16 → 8 KB (vom Nutzer nicht gewählt); Routen-Handler zusammenlegen
(13,5 KB, großer Umbau) steht in PLAN.md.

**Verifikation:** `pio run` alle drei Envs, OpenAPI-Lint; `/api/diag/heap` auf allen vier Boards geprüft.
Mit dem Fix je 3 Prüfungen im Betrieb auf allen vier Boards: **12 von 12** erfolgreich; `minFree` lolin
50 KB (vorher 13), brautomat 64 KB (vorher 19). „Installieren“ am lolin im Update-Modus mit TLS im PSRAM →
`v0.1.2` sauber installiert, danach Fix-Stand per Push-OTA zurück, UI 200.

## 2026-09-27 — Pin-Manager Stufe 2: Fähigkeiten der Pins (ADC, Pull-up, Interrupt)

**Problem:** Stufe 1 prüfte nur Existenz, Klasse und Belegung eines Pins, nicht ob er kann, was das Feld
braucht. `analogRead` auf einem Pin ohne ADC oder auf ESP32-ADC2 (bei aktivem WLAN, also in BrewControl
immer) liefert still 0 — die Karte zeigt einen gültig aussehenden Wert. YF-S201 und der IDS-Interrupt setzen
`INPUT_PULLUP`, was auf ESP32-GPIO 34–39 und S2-GPIO 46 wirkungslos ist.

**Bestandsaufnahme:** ADC braucht nur `AnalogInput.pin`; Interrupts `YF-S201.pin`, `HCSR04.echo`,
`IDS*.pin_interrupt` (auf allen drei Chips kann jeder GPIO Interrupts, einzige Ausnahme ist die ESP32-Errata 3.11
zu GPIO 36/39); den internen Pull-up `YF-S201.pin`, `IDS*.pin_interrupt` und `DigitalInput` mit `pullup`.
Einen UART nutzt kein Item-Typ — die serielle Prüfung entfällt, bis ein solches Gerät kommt (PLAN.md).

**Umsetzung:** `Board` (`PinMap.h`) bekommt die Masken `adc1`, `adc2`, `noPullup`, `irqGlitch` und
`adc2BlockedByWifi`, `PinUse` die Bedarfs-Flags `analog`/`pullup`/`irq` (gesetzt in `collectPins`).
`checkItemPins`: `AnalogInput` ohne ADC → 400 `GPIO n has no ADC`, auf ESP32-ADC2 → 400
`GPIO n is on ADC2, which Wi-Fi blocks`; ADC2 am S2/S3 (Arbiter mit dem WLAN, einzelne Lesungen können
scheitern), fehlender Pull-up und der 36/39-Glitch sind Warnungen. `findPinConflicts` meldet Bestands-
Configs mit „kein ADC“ bzw. „ADC2 – bei WLAN nicht nutzbar“. `GET /api/pins` liefert je Pin `adc`,
`noPullup`, `irqGlitch` und `caps.adc2Wifi`. Frontend: `pinStatus`/`PinHint` kennen die Bedarfe (AI-Pin
`analog`, YF-S201 und IDS-Interrupt `pullup irq`, HC-SR04-Echo `irq`, DigitalInput `pullup` je nach Haken),
`riskyPins` nimmt die Fähigkeits-Warnungen in die Bestätigungsbox auf. OpenAPI, README („Pin-Prüfung“)
und PLAN.md (Pin-Manager nur noch Stufe 3) nachgezogen.

**Verifikation:** `pio test -e native` (58, davon 5 neue in `test_pin_map`), `pio run` für alle drei Envs,
`pnpm typecheck`/`vitest` (50)/`build`, OpenAPI-Lint. UI gegen den Node-Mock: AI-Pin 21 → rot
„kein ADC-Pin“, GPIO 12 (ADC2) → Warnung und Bestätigungsbox beim Speichern, YF-S201 auf einem Pin ohne
Pull-up → beide Warnungen. LilyGo per OTA (mit `main` inkl. Heap-Diagnose): `GET /api/pins` zeigt ADC1 an
1–10, ADC2 an 11–20, `adc2Wifi: shared`, keine Konflikte in der bestehenden Config; `AnalogInput` auf
GPIO 48 → 400 `GPIO 48 has no ADC`, auf GPIO 1 → 409 (HLT); auf GPIO 4 (Batterie-ADC) → 204 und misst
2,11 V; `PUT` desselben Sensors auf GPIO 48 → 400, der Sensor bleibt unverändert; danach gelöscht,
Config identisch mit dem Stand vor dem Test. ADC2 und die Pull-up-/Glitch-Warnungen nicht am Gerät
geprüft (am LilyGo liegen die freien ADC2-Pins nur auf USB 19/20, Pull-up/Glitch betrifft nur
esp32dev/S2) — die decken die nativen Tests ab.

## 2026-09-27 — Peripherie-Abstraktion Etappe 1: PeripheralRegistry für OneWire und SPI

**Ausgangslage:** `DynamicItems::getOrCreateBus` legte pro Pin eine `OneWire` in `onewireBuses_` an, aber nur
für DS18B20 mit `address`. Ohne Adresse baute sich der Sensor einen eigenen Treiber auf demselben GPIO.
Busse wurden nie abgebaut. MAX31865 mit `clk` bit-bangt pro Instanz; ein geteiltes SPI-Objekt gab es nicht.
`GET /api/bus/scan` lief ohne RegistryLock, bit-bangte also womöglich gleichzeitig mit `loop()` auf dem Pin.

**Entscheidungen** (Plan: `docs/superpowers/plans/2026-09-27-peripherie-etappe-1.md`): Die Registry liegt
in der **Firmware** (`src/PeripheralRegistry.h`, header-only, Arduino-frei). Die Library bekommt ihre Busse
schon heute per Dependency Injection; wann ein Bus entsteht und wann er wegfällt, ist Anwendungslogik.
So entsteht keine neue öffentliche Library-API. Das Interface hat `id`/`type`/`begin`/`end`, **kein
`tick`** (braucht noch kein Gerät). Die Nutzerzählung läuft über eine kopierbare RAII-`Ref`. `PinMap.h`
bleibt **getrennt**, weil die Pin-Prüfung vor der Instanz laufen muss und auch über nicht ladbare
Configs. SPI ist vorerst nur Buchführung, ohne Wechsel auf Hardware-SPI (ohne MAX31865-Hardware nicht
prüfbar). Andockpunkte für I²C und Fähigkeiten stehen im Plan.

**Umsetzung:** `PeripheralRegistry` (`acquire<T>(id, args…)` legt an oder findet, `begin()` beim ersten
Nutzer, `end()` und `delete` beim letzten). `DynamicItems`: `peripherals_` ersetzt `onewireBuses_` an
derselben Stelle (vor `sensors_`, wird also nach den Sensoren zerstört). `SensorEntry::bus` steht vor
dem Sensor. Neue Klassen `OneWireBus` (`onewire:<pin>`) und `SpiBus` (`spi:<clk>/<miso>/<mosi>`).
`replaceSensor` hält die `Ref` des alten Sensors, bis das Ersetzen fertig ist, sodass Ersetzen und
Wiederherstellen denselben Bus behalten. Alle DS18B20 hängen jetzt am Registry-Bus, dafür gibt es in
SensActCtrl den Konstruktor `DS18B20Sensor(id, OneWire&, bits)` (fremder Bus, ohne Adresse). Der Bus-Scan
läuft unter `RegistryTryLock`, deshalb in `openapi.yaml` 503 `RegistryBusy`. Doku: README beider
Projekte, PLAN.md (Etappen 2/3 offen, Pin-Manager 3a präzisiert).

**Verifikation:** Firmware `pio test -e native` 68/68 (10 neue in `test_peripheral_registry`: Teilen,
ersten löschen → Bus bleibt, letzten löschen → `end()`, Ersetzen am selben Pin → gleiche Instanz ohne
`end`/`begin`, gescheitertes Ersetzen + Wiederherstellen, Pin-Wechsel, Ref-Kopie/-Move). SensActCtrl
275/275 (2 neue in `test_ds18b20`). `pio run` für esp32dev, lolin_s2_mini, lilygo_t_display_s3_amoled;
OpenAPI-Lint. LilyGo per OTA (keine andere Session aktiv): `/api/config` vor und nach dem Flash
byte-identisch, HLT (Pin 1, adressiert) liefert weiter 22,56 °C, Scan auf Pin 1 findet ihn über den
Registry-Bus. Auf Pin 1 zusätzlich `T2` (Dummy-Adresse → `ok:false`, erwartet) und `T4` ohne Adresse
(liest das erste Gerät, 22,56 °C) angelegt, dann `PUT` T2 → T3 (204), `PUT` mit ungültiger Adresse →
400, T3 bleibt. T3 und T4 gelöscht: HLT lieferte in jedem Schritt Werte, kein Neustart (`resetReason`
`sw` vom OTA), die Config danach wieder identisch. Abbauen des letzten Nutzers am Gerät nicht
beobachtbar (HLT bleibt), das decken die nativen Tests ab.

## 2026-09-27 — Pin-Manager Stufe 3a: Pins vorschlagen (Branch `feature/pin-manager-3a`)

**Ziel:** Das Item-Formular schlägt je Pin-Feld passende GPIOs vor, statt dass man Nummern
auswendig kennen muss — freie Pins zuerst, bestehende Busse bevorzugt, bedenkliche gekennzeichnet.

**Befund vor der Umsetzung:** Die für „bestehenden Bus bevorzugen" nötige Information steckt
bereits in `GET /api/pins` — `PinMap.h::collectPins` setzt `Share::OneWire/Spi` pro `PinUse`,
`writePinsJson` schreibt das als `users[].share` (+ `key`) in die Antwort. Ein Pin mit einem
User `{share:"onewire", key:"pin"}` *ist* der Pin eines bestehenden OneWire-Busses. Die in
PLAN.md vorgesehene Erweiterung von `GET /api/pins` um Bus-Ids aus der `PeripheralRegistry`
(Etappe 1 der Peripherie-Abstraktion) war damit unnötig — reines Frontend-Feature, Firmware und
`PeripheralRegistry.h` unangetastet.

**Umsetzung:** `web/src/pins.ts::suggestPins(info, key, opts)` — filtert `info.pins` durch die
bestehende `pinStatus`-Logik (alles, was die schon als `error` einstuft, fällt raus: Board-Klasse,
falsche Richtung, belegt ohne kompatiblen Share, fehlende ADC-Fähigkeit), markiert Pins mit einem
kompatiblen Bus-User desselben Config-Keys als `bus: true` und sortiert Bus-Pins vor freien vor
bedenklichen. `opts.exclude` nimmt die GPIOs, die Schwester-Felder desselben Items schon gewählt
haben. `PinHint.tsx` rendert bei gesetztem `configKey` zusätzlich eine Reihe klickbarer Chips
unter dem Status-Text (gedeckelt auf 8), Klick ruft `onPick` und füllt das Feld — die freie
Eingabe bleibt unverändert möglich. `AddItemModal.tsx`: alle 12 bestehenden `PinHint`-Stellen
bekommen `configKey` + `onPick`, Mehrfeld-Items (MAX31865 CS/CLK/MISO/MOSI, HC-SR04 TRIG/ECHO,
HX711 DOUT/SCK, IDS White/Yellow/Interrupt) zusätzlich `exclude` mit den Werten ihrer
Geschwisterfelder.

**Verifikation:** `pnpm typecheck`, `pnpm test` (56/56, 11 neue Fälle in `pins.test.ts` für
`suggestPins`: nur ADC-Pins bei `analog`, keine Input-only-Pins bei `output`, bestehender
OneWire-Bus-Pin vorn, eigener Pin beim Bearbeiten zählt als frei, Exclude zwischen Schwesterfeldern,
leer ohne Pin-Daten), `pnpm build`. UI gegen einen Node-Mock im Scratchpad (esp32dev-ähnliche
Tabelle, ein bestehender DS18B20 auf GPIO 4 mit `share:onewire`, ein MAX31865 auf CLK 18/MISO
19/MOSI 23 mit `share:spi`): DS18B20-Formular zeigt „4 (Bus)" als ersten Chip, danach freie Pins
aufsteigend; MAX31865-Custom-SPI schlägt für CLK „18 (Bus)" vor, für MISO/MOSI die jeweils eigene
Bus-Leitung, und nach Wahl von CLK=18 fehlt 18 in den MISO/MOSI-Listen; HC-SR04 TRIG/ECHO schlagen
sich gegenseitig nichts vor (nach TRIG=2 verschwindet 2 aus ECHOs Liste, ein neunter Pin rutscht
nach). Nicht am echten Board geprüft (reines Frontend, keine Firmware-Änderung).

## 2026-09-27 — Firmware-Update-Seite: Layout + neue Systemstatus-Seite

Auf `/settings/firmware`: Hinweiskarte ans Seitenende verschoben, Installieren-Button
rechtsbündig, das "verfügbares Update"-Panel aus der GitHub-Karte (jetzt "Release-Kanal",
Untertitel entschärft) in die "Aktuelle Version"-Karte verschoben, dort "Letzter Neustart"
durch "Letzte Prüfung" ersetzt (neues Feld `lastCheckedAt` in `FirmwareUpdater`, gesetzt in
`doCheck()`, über `/api/update/status` exportiert). Der Neustart-Grund zieht auf eine neue
Seite `/settings/system` (Systemstatus, im Einstellungen-Index verlinkt) um, zusammen mit
Board-Infos (Variante + Hostname/IP/MAC aus `GET /api/network`), Version, Betriebszeit und
Speicherbelegung — letztere beide neu aus dem bisher ungenutzten `GET /api/diag/heap`
(`HeapDiag.h` bekam dafür ein `storage`-Feld, nur auf LittleFS-Boards). Zusätzlich eine
Karte "Aktive Störungen": reine Frontend-Auswertung von `GET /api/alerts` (letztes
`fault`-Ereignis pro `src`, nur `state === 'raised'` zählt als aktiv) — kein neuer Endpoint,
das bestehende Alert-System (`AlertCenter.tsx`) deckt Fehlermeldungen schon ab.

**Verifikation:** `pio run -e esp32dev` (compile-smoke, LittleFS-Zweig mitkompiliert),
Redocly-Lint grün, `pnpm typecheck` grün, Node-Mock-Preview: beide Seiten inkl. aktiver und
leerer Störungsliste geprüft.

## 2026-09-29 — Peripherie-Abstraktion Etappe 2: I²C-Bus, SDA/SCL-Pinbelegung und Adresskonflikt-Prüfung

**Ausgangslage:** BME280/GY521 hingen komplett an der `PeripheralRegistry` vorbei — sie riefen über
Adafruit-BusIO implizit `Wire.begin()` auf dem globalen `Wire` auf. Nur weil `main.cpp` `Wire` am
LilyGo vorab auf `BREWCTL_I2C_SDA/SCL` (7/6) zwang, landete das nicht auf den Board-Default-Pins
(SCL 17 = Display-Reset). Adresskonflikte (zwei Items mit derselben Adresse, oder eine Adresse, die
RTC/Touch/PMU des LilyGo belegen) prüfte nichts; `PinMap.h::collectPins` sagte für I²C-Items explizit
„fügt nichts hinzu", und auf esp32dev/lolin_s2_mini war nicht einmal SDA/SCL selbst als belegt geführt.

**Entscheidungen** (Plan von der Etappe-1-Session gegengelesen, zwei Korrekturrunden eingearbeitet):
- `I2cBus : Peripheral` (`DynamicItems.cpp`) ist der eine, boardfeste Bus (`i2c:<sda>/<scl>`, ohne
  `BREWCTL_I2C_SDA` `i2c:default`); `end()` bleibt bewusst No-op, weil am LilyGo auch Touch/RTC/PMU
  daran hängen, die die Registry nicht kennt.
- Am LilyGo claimt `main.cpp` den Bus jetzt über eine neue `DynamicItems::acquireBoardI2cBus()` (statt
  direkt `Wire.begin()`), gehalten in `boardI2cBus_` für die Lebensdauer von `DynamicItems` — dieselbe
  Regel wie im Etappe-1-Plandoc für feste Onboard-Nutzer. Das macht den Bus dort **immer** sichtbar,
  unabhängig von einem BME280/GY521-Item.
- `PinMap.h` bekommt `Share::I2c` und `Board.i2cSda/i2cScl` (esp32dev 21/22, lolin_s2_mini 33/35 —
  Arduino-ESP32-Defaults aus den jeweiligen `variants/*/pins_arduino.h`, LilyGo 7/6). `collectPins`
  fügt für BME280/GY521 SDA/SCL als `PinUse` hinzu, **außer** der Pin ist auf dem Board schon
  `PinClass::Reserved` — auf dem LilyGo ist das bereits der Fall (Touch/RTC/PMU), ein zweiter Eintrag
  hätte dort nur einen falschen 409/Konflikt erzeugt.
- Die I²C-**Adresse** prüft eine eigene, zu `PinMap.h` analoge Datei `I2cAddressMap.h`
  (`collectAddresses`, `checkItemAddress`) — bewusst getrennt vom Pin-Raum, dieselbe Trennungs-Logik
  wie „PeripheralRegistry bleibt getrennt von PinMap.h" aus Etappe 1. Reservierte Adressen
  (LilyGo: 0x51 RTC, 0x5A Touch, 0x6A PMU) stehen als neue `AddrDef`-Tabellen in `BoardPins.h`. Kein
  „kompatibler" Fall wie bei Pins — zwei Items dürfen nie dieselbe Adresse haben. Bewusst **nicht** in
  `GET /api/pins` gespiegelt (nur 409 bei Create/Replace) — Entscheidung, in PLAN.md festgehalten.
- `BME280Sensor`/`GY521Sensor`/`GY521TiltSensor` (SensActCtrl) bekommen wie `DS18B20Sensor` in Etappe 1
  eine `TwoWire&`-Konstruktor-Überladung für einen fremden Bus; die nativen Stubs brauchen dafür (anders
  als bei DS18B20) eine zweite `begin(addr, TwoWire*)`-Überladung und einen `class TwoWire {}`-Shim, weil
  diese Sensoren auch nativ getestet werden.
- `GET /api/bus/scan?type=i2c` scannt nur, wenn der Bus schon in der Registry existiert (sonst 409) —
  ein unclaimter Scan auf esp32dev/lolin_s2_mini könnte sonst die Default-Pins belegen, die ein anderes
  Item schon nutzt, und 127 Sondierungen ohne Pull-ups blockieren `loop()` unter dem `RegistryLock`
  spürbar; `Wire.setTimeOut(50)` deckelt das zusätzlich pro Adresse.

**Umsetzung:** neue Datei `I2cAddressMap.h`; `BoardPins.h` bekommt `i2cSda/i2cScl` je Board plus die
`AddrDef`-Reserved-Tabellen und `currentI2cReserved()`; `DynamicItems` bekommt `acquireBoardI2cBus()`,
`i2cBusExists()`, `scanI2cBus()`, `checkI2cAddress()`/`addressUses()` (mit eigenem `i2cAddressError_`
analog `pinError_`) und ruft `checkI2cAddress` in `addSensor`/`replaceSensor` neben `checkPins` auf;
`WebUI.cpp`s `/api/bus/scan` verzweigt jetzt auf `type`. `main.cpp` ruft `acquireBoardI2cBus()` statt
direkt `Wire.begin()`, das jetzt unbenutzte `#include <Wire.h>` dort entfernt. Doku: OpenAPI (`type`-Enum,
`BusScanResult` für beide Bus-Arten, neue 409-Texte), README (Abschnitt „Geteilte Busse"), PLAN.md
(Bus-Id im Item-Config, `tick()`, Bus-Vorschläge im Formular und die Folge der `/api/pins`-Entscheidung
bleiben offen), `web/src/types.ts` (`BusScanResult.pin` optional, `PinUser.share` um `'i2c'` erweitert).

**Verifikation:** SensActCtrl `pio test -e native` 279/279 (neue `test_bme280`-Datei, je ein neuer
Test in `test_gy521` und `test_gy521_tilt` für den fremden Bus).
BrewControl `pio test -e native` 75/75 (5 neue in `test_i2c_address_map`, 2 neue + Board-Parameter in
`test_pin_map` — inkl. explizit BME280 auf LilyGo → kein Pin-Konflikt, auf esp32dev → SDA/SCL belegt,
`DigitalOutput` auf GPIO 21 danach → 409). `pio run` für alle drei Envs, Redocly-Lint, `pnpm typecheck`
grün. Hardware-Verifikation am LilyGo steht noch aus (siehe PLAN.md, falls offen geblieben).

## 2026-09-30 — Bus-Schnittstellen: zentral definierte Busse + Settings-Seite

**Ausgangslage:** Die UI verriet nirgends, an welchen Pins I²C-Geräte angeschlossen werden. Am LilyGo
fand sich der feste I²C-Bus (SDA 7 / SCL 6) zunächst nur am Qwiic-Stecker, für den kein Kabel da war.
(Korrektur später am Tag: SDA/SCL liegen zusätzlich am Header, waren dort nur übersehen worden — für
den Umbau unerheblich, ein zweiter Bus hilft ohnehin bei Adresskonflikten.) Gewünscht: eine
Einstellungsseite, die alle Bus-Schnittstellen zeigt (I²C, OneWire, SPI, später CAN/RS485) und die
Pins umkonfigurieren lässt, wo die Hardware sie nicht festlegt.

**Entscheidungen** (mit dem User):
- **Busse werden zentral definiert** (Typ + Pins + optionales Label) statt implizit aus den Item-Pins
  abgeleitet; DS18B20/MAX31865/BME280/GY521 verweisen per `"bus": "<id>"` darauf. Damit erledigt:
  PLAN-Punkte „Bus-Id im Item-Config" (für I²C/OneWire/SPI) und „Bus-Vorschläge im Item-Formular"
  (SPI-Tripel gemischt vorgeschlagen — Bus-Pins tauchen im Item-Formular gar nicht mehr auf).
- **Zwei I²C-Busse** statt umkonfigurierbarem Board-Bus: der ESP32 hat zwei Controller (`Wire`,
  `Wire1`). Am LilyGo bleibt `i2c-board` fest (RTC/Touch/PMU, read-only, Hinweis „am Header und am
  Qwiic-Stecker"), daneben ist ein frei wählbarer Bus auf `Wire1` möglich — nützlich bei
  Adresskonflikten mit den Onboard-Geräten; esp32dev/lolin_s2_mini haben keinen festen Bus.
- **CAN/RS485** nur im Typ-Modell vorgesehen (`kBusTypes`), nicht anlegbar — kein Item-Typ, keine Hardware.
- Ablage als Array `buses` in `registry.json` (nicht in `settings.json`): Items und Busse bleiben in
  einer Datei konsistent, Backup/Restore und `GET /api/config` nehmen sie automatisch mit.
- Bus-Id = Typ + Pins (`i2c-4-5`, `onewire-4`, `spi-18-19-23`); Pins eines Busses ändern bzw. ihn
  löschen nur, solange kein Item daran hängt (409, sonst ließen sich laufende Treiber nicht sauber
  umziehen). Jeder I²C-Bus bekommt beim Anlegen fest einen Controller (`port`), damit ein Löschen eines
  anderen Busses ihn nie verschiebt.
- Bus-Pins gehören exklusiv dem Bus — das „Teilen per `Share`" aus dem Pin-Manager entfällt komplett
  (`Share` → `PinUse.bus`), `/api/pins` führt den Bus als Nutzer.

**Umsetzung:** neue Datei `BusConfig.h` (Typ-Tabelle, `parseBusDef`/`writeBusDef`, `busPinUses`,
`freeI2cPort`, `normalizeLegacyItem`); `BoardPins.h` mit `kLilyGoAmoledBuses`/`currentFixedBuses()` statt
`currentI2cReserved()`; `PinMap.h`: `collectPins` ohne Board-Parameter und ohne Bus-Leitungen, neue
`checkPinUses` (auch für Busse); `I2cAddressMap.h`: Adressen je Bus, Reserved nur am festen Bus.
`DynamicItems`: `buses_` (feste zuerst), `addBus`/`updateBus`/`removeBus`/`writeBuses`/`scanBus`,
`acquireBus` (Registry-Id = Bus-Id, `I2cBus(TwoWire&, sda, scl, keepRunning)` mit `Wire.end()` bei nicht
festen Bussen), Migration in `loadFromSD` mit einmaligem `saveToSD`. `WebUI.cpp`: `GET/POST /api/buses`,
`PUT/DELETE /api/buses/{id}`, `GET /api/bus/scan?bus=<id>` (ersetzt `type`/`pin`; ein unbenutzter Bus
wird nur für den Scan gestartet — die Etappe-2-Regel „nur scannen, wenn er existiert" entfällt, weil
die Pins eines definierten Busses geprüft sind). Web: neue Seite `/settings/buses` (`BusesPage.tsx`,
Scan, Anlegen/Bearbeiten/Löschen, gesperrte Pins bei genutzten Bussen, I²C bei 2 Bussen gesperrt),
Bus-Auswahl in `AddItemModal` (DS18B20-Scan über den gewählten Bus, MAX31865 „Hardware-SPI" oder Bus,
Feld „Custom SPI Pins" entfällt), `DiscoverDevicesCard` scannt die angelegten OneWire-Busse,
`pins.ts`/`PinHint` ohne Bus-Teilen. Doku: OpenAPI, README („Geteilte Busse", Routen, Pin-Prüfung),
PLAN.md (Reste: gemeinsamer Hardware-SPI-Treiber, Hardware-SPI-MAX31865 ohne Tracking, Bus-Pins bei
Nutzern ändern, I²C-Adressen im Formular).

**Einschränkung:** Die Migration stellt alte Items (DS18B20 `pin`, MAX31865 `clk/miso/mosi`, BME280/GY521
ohne `bus`) beim ersten Boot um und schreibt `registry.json` neu — ältere Firmware versteht das danach
nicht mehr; vor einem Downgrade das Backup von vorher einspielen.

**Verifikation:** BrewControl `pio test -e native` 85/85 (neu `test_bus_config` mit 10 Tests: Validierung,
Id-Ableitung, Controller-Zuordnung, Migration inkl. zwei DS18B20 auf einem Bus, LilyGo → `i2c-board`,
esp32dev → `i2c-21-22`, lolin → `i2c-33-35`; `test_pin_map`/`test_i2c_address_map` auf das Bus-Modell
umgestellt). `pio run` für alle drei Envs, Redocly-Lint, `pnpm typecheck`, `pnpm test` (57) und
`pnpm build` grün. UI gegen einen Node-Mock im Browser geprüft: Busseite mit festem LilyGo-Bus und
Anschluss-Hinweis, Scan (OneWire-ROMs, I²C mit benannten reservierten Adressen), Anlegen mit Konflikt (409 auf
GPIO 7) und mit freien Pins (→ `Wire1`), I²C danach im Anlegen-Dialog gesperrt, Pins eines genutzten
Busses gesperrt, BME280/DS18B20 im Item-Formular mit Bus-Auswahl (gesendet wird `bus`).

**Hardware (LilyGo, OTA, Backup vorher im Scratchpad):** Migration beim ersten Boot: `onewire-1` angelegt,
HLT misst weiter (23 °C), alle Items/Regler wieder da. Scan `i2c-board` → 0x51/0x5A/0x6A, `onewire-1` →
HLT-ROM. 409 am Gerät für: Bus auf GPIO 7, dritter I²C-Bus, Ausgang auf Bus-Leitung, 0x5A auf
`i2c-board`, doppelte Adresse auf einem Bus, Pins/Löschen eines genutzten Busses, festen Bus löschen;
0x5A auf dem zweiten Bus erlaubt, Label eines genutzten Busses änderbar. Echter GY-521 auf `i2c-48-3`
(SDA 48 / SCL 3, `Wire1`): Scan 0x68, Winkel flach ≈ −1 °; Modul abgezogen → kein Hänger. Zwei Befunde
(in PLAN.md): GY521 meldet ohne Gerät gültige Fantasiewerte (Library, älter als dieser Umbau), und ein
einmaliger `task_wdt`-Neustart beim allerersten GY521 auf dem leeren zweiten Bus, danach nicht mehr
reproduzierbar.

## 2026-09-29 — Energiemanagement Stufe 1: Einstellungsseite + Batteriequelle

Plan für den ganzen Energiemanagement-Punkt (Deep-Sleep, Wach-Pin, Kurz-Wach-Profil) mit den
Nutzer-Entscheidungen liegt in `docs/superpowers/plans/2026-09-29-energiemanagement.md`; umgesetzt
ist Stufe 1. Neue Seite `/settings/energy` („Energiemanagement“ im Einstellungen-Index, alle
Boards). Die Batterie ist bewusst **kein eigener Firmware-Pfad**, sondern ein normales
Sensor-Item, das die Seite auswählt (`energy.batterySensor` in `SettingsStore`, neuer neunter
Abschnitt in `/api/settings`, Validierung nur des Typs). Die Auswahl listet Sensoren mit Einheit
`V`/Größe `Voltage`, die Statuszeile zeigt Spannung und einen groben LiPo-Prozentwert
(`web/src/energy.ts`). „Batteriesensor anlegen“ erzeugt ein `AnalogInput` (0 … 3,3 V × Teiler,
Glättung 16, Label „Batterie“) und wählt es aus; die Voreinstellung kommt aus dem neuen
`battery`-Feld von `GET /api/pins` (`Board::batteryPin/batteryDivider`, bisher nur LilyGo:
GPIO 4, 1:2 — abgeleitet aus den 2,11 V am ADC vom 2026-09-26, am Gerät noch gegen ein Multimeter
zu prüfen). Auf dem Board-eigenen Batterie-Pin blendet die Seite den „bedenklich“-Hinweis des
PinHint aus.

**Verifikation:** `pio test -e native` (68/68, `test_pin_map` prüft das `battery`-Feld),
`pio run` für `lilygo_t_display_s3_amoled`, `esp32dev`, `lolin_s2_mini`, Redocly-Lint grün (nur
die bekannte `info-license`-Warnung), `pnpm typecheck`, `pnpm test` (60/60, neu
`energy.test.ts`), `pnpm build`. UI gegen Node-Mock im Scratchpad: Auswahl filtert auf
Spannungssensoren, Anlegen schickt `{"type":"AnalogInput","id":"battery","pin":4,"unit":"V",
"value_min":0,"value_max":6.6,"smoothing":16}` + Label + Settings-Patch, Auswahl übersteht
Reload. Nicht am echten Board geprüft.

**Nachtrag 2026-09-30 — eigener Sensortyp „Spannung“:** Auf Nutzerwunsch legt die Seite statt
eines `AnalogInput` mit Teilerverhältnis einen neuen Typ `Voltage` an, bei dem man neben dem Pin
die beiden Widerstände des Spannungsteilers angibt (`r1` Messpunkt→Pin, `r2` Pin→GND, kΩ,
`r1 = 0` = ohne Teiler). Library: `SensActCtrl::VoltageSensor` liest `analogReadMilliVolts()`
(eFuse-kalibriert, genauer als die lineare 3,3-V-Annahme des `AnalogInput`) und rechnet
`mV × (R1+R2)/R2`, `Quantity::Voltage`/`V`, Glättung bis 32. Firmware: Zweig in
`DynamicItems::addSensorNoBegin` (400 `invalid r1/r2`), ADC-Bedarf in `collectPins`,
`Board::batteryDivider` → `batteryR1/batteryR2` (LilyGo 100/100), `/api/pins` → `battery:
{gpio, r1, r2}`. Web: Typ „Spannung (Spannungsteiler)“ im Dialog „Gerät hinzufügen“, Energie-Seite
mit Feldern Pin/R1/R2. Kalibrierung, Persistenz und Bearbeiten laufen ohne weiteren Code mit.
**Verifikation:** SensActCtrl `pio test -e native` 279/279 (neu `test_voltage_sensor`), Firmware
68/68 (`test_pin_map`: Voltage ohne ADC → 400, `battery.r1/r2`), `pio run` alle drei Envs,
Redocly-Lint grün, `pnpm typecheck`/`test` (60/60)/`build`. Node-Mock: Energie-Seite vorbelegt
4/100/100 und schickt `{"type":"Voltage","id":"battery","pin":4,"r1":100,"r2":100,"smoothing":16}`;
„Gerät hinzufügen“ → Digital / Analog → Spannung schickt `{"type":"Voltage","id":"vtest","pin":5,
"r1":47,"r2":10,"smoothing":16}`. Am `brewcontrol-esp32dev` (OTA) vom Nutzer getestet: funktioniert.
Offen bleibt der Multimeter-Vergleich am LilyGo-Batterieeingang.

## 2026-09-30 — Zustand nach Neustart: Regler und Aktoren kommen zurück (Branch `feature/zustand-neustart`)

Vorab-PR zu Energiemanagement Stufe 2: Mit Deep-Sleep ist jedes Aufwachen ein Neustart, und bisher
ging dabei der Laufzeitzustand verloren — Regler starteten immer eingeschaltet mit dem Sollwert aus
der Anlege-Konfiguration, Aktoren im Konstruktor-Zustand (Relais aus, Analog auf `valueMin`);
`POST /api/actuators/{id}` und `…/setpoint` änderten nur das Live-Objekt. Nutzerwunsch: nach jedem
Neustart der zuletzt gültige Zustand — was aus war, bleibt aus, was an war, geht wieder an.

**Umsetzung:** `src/RuntimeState.h/.cpp` hält Regler (an/aus, Sollwert) und Aktoren (an/aus, Wert,
Intervall) in `/config/state.json`, im `targets`-Format der Programmschritte (`ProgramTargets.h`
`writeTargets`/`readTargets`); angewendet wird über dieselbe Logik wie ein Programmschritt
(`ProgramRunner::applyTarget` → `applyCmd_` ohne Impulse). Nicht gespeichert: der Wert eines Aktors,
den ein Regler ansteuert (`DynamicItems::drivenByController`, dieselbe Prüfung wie beim Löschen —
sonst schriebe ein PID sekündlich), und der Wert eines Impuls-Aktors. `loop()` erfasst den Zustand
jede Sekunde unter dem `RegistryLock`; `StateSaver.h` (nativ getestet) schreibt ihn erst, wenn er
sich 2 s nicht mehr geändert hat, und nur bei Abweichung vom gespeicherten Stand — das deckt alle
Schreibwege auf einmal ab (REST, Display, Timer, Programme, Not-Aus). Beim Boot wird nach
`registry.begin()` und vor `webUI.begin()` wiederhergestellt, ein eingerasteter Not-Aus gewinnt
also weiterhin; laufende Programme spielen ihren Zustand ohnehin neu ab. Die Library startet
Ausgänge unverändert sicher aus, das Wiederherstellen ist eine BrewControl-Entscheidung (README →
„Zustand nach Neustart“, mit Hinweis: ein Relais, das an war, geht nach Stromausfall wieder an).

**AutoTune-Ergebnisse** gingen bisher ebenfalls verloren: das AutoTune setzt Kp/Ki/Kd nur im
laufenden Regler, nach einem Neustart galten wieder die gespeicherten Gains — und wer danach den
Bearbeiten-Dialog speicherte, überschrieb die getunten Werte mit den alten (der Dialog ist aus der
Config vorbelegt). Jetzt vergleicht `DynamicItems::syncTunedGains()` im selben 1-s-Takt die
Live-Gains von PID/SplitRangePID (`kp()/ki()/kd()` am inneren Regler) mit `cfgJson` (relative
Toleranz wegen des Float-JSON-Round-Trips) und schreibt Abweichungen zurück (`saveToSD` unter dem
`RegistryLock`, kommt praktisch nur nach einem fertigen AutoTune oder einem `POST …/params` vor).

Beim Planen von Stufe 2 festgelegt (Plan-Doc, Abschnitt „Festlegungen 2026-09-30“): Regler
blockieren den Schlaf nicht, Programme/Timer kürzen das Intervall auf ihr nächstes festes Ereignis,
Aktoren vor dem Schlaf aus, GPIO 0 nicht als Wach-Pin, kein Update-Check im Kurz-Wach. Neu in
PLAN.md: übrige `/params`-Schlüssel (nicht Kp/Ki/Kd) überleben keinen Neustart (nur direkte API);
Wiederherstellen abhängig vom Neustart-Grund (zurückgestellt).

**Verifikation:** Firmware `pio test -e native` 90/90 (neu `test_state_saver`: unverändert → nie,
Änderung → nach 2 s Ruhe, weitere Änderung verschiebt, Zurückändern bricht ab, millis-Überlauf),
`pio run` esp32dev / lolin_s2_mini / lilygo_t_display_s3_amoled grün (esp32dev Flash 94,1 %),
Redocly-Lint grün (nur die bekannte `info-license`-Warnung). Am `brewcontrol-esp32dev` (OTA,
Config vorher gesichert): Test-Items `st_pwm` (AnalogOutput PWM, GPIO 27) und `st_pid` (PID auf
der DAC→ADC-Schleife `adc_test`→`dac_test`) angelegt, `st_pwm` v 0,4, `ids_spike` aus, `st_pid`
Sollwert 1,7 + `POST …/params {"Kp":5.5,"enabled":false}` → `state.json` enthielt genau das (ohne
`v` für den PID-geführten `dac_test`), `GET /api/config` Kp 5,5; nach Neustart
(`POST /api/network`, Hostname unverändert) derselbe Zustand. Not-Aus ausgelöst (PID vorher an),
Neustart → `estop: true`, alles aus. Danach Not-Aus gelöst, Test-Items gelöscht, Ausgangszustand
wiederhergestellt; die Config gleicht dem Backup bis auf die Bus-Migration aus dem Bus-PR (erster
Boot dieser Firmware auf dem Board). Nebenbefund: einzelne 503 „busy, retry“ auf gesperrten
Routen — per A/B mit dem unveränderten `main`-Build genauso (4/60 gegenüber 2/30), also nicht
von hier; neuer PLAN-Punkt.

## 2026-09-30 — Energiemanagement Stufe 2: Deep-Sleep (Branch `feature/deep-sleep`)

Deep-Sleep zwischen zwei Messungen nach dem Plan `docs/superpowers/plans/2026-09-29-energiemanagement.md`
(Festlegungen und Abweichungen dort, Doku `BrewControl/README.md` → „Deep-Sleep“). Neue Einstellungen
im Abschnitt `energy`: `deepSleep`, `sleepIntervalSec` (60–86400), `wakePin` (RTC-GPIO, Pflicht),
`wakeActiveLow`, `awakeTimeoutSec` (60–3600), `shortWakeWifi`; `GET` liefert zusätzlich `wakeCause`.
Das Kurz-Wach-Profil hat der Nutzer auf den WLAN-Schalter reduziert (Weboberfläche/Display im
Kurz-Wach immer aus, NTP mit WLAN immer, Datalog nach den Logs selbst).

- `WakeMode.h` (nativ getestet, `test_wake_mode`): Kurz- oder Voll-Wach, Schlafdauer (Intervall ab
  Aufwachen, gekürzt auf 1 s nach dem nächsten Programm-/Timer-Ereignis, min. 1 s), Ablauf des
  Kurz-Wach (Sensoren gemessen max. 3 s → Publisher verbunden max. 5 s → 1,5 s Nachlauf, hart 30 s).
- `EnergyManager.h/.cpp`: Weckgrund, Wach-Pin lesen, Ausgänge festklemmen (`gpio_hold_en`), Timer +
  ext0 scharf schalten, schlafen. `ProgramRunner`/`TimerStore::nextEventEpoch()`.
- `main.cpp`: Settings vor dem WLAN laden; Kurz-Wach mit einem WLAN-Versuch (8 s) oder keinem, kein
  Portal/mDNS/Webserver/Display/Update/Push; `webUI.begin(false)` wendet nur den Not-Aus an.
  `goToSleep()`: offenen Zustand sofort schreiben (`StateSaver::flush`), Aktoren aus (nicht
  gespeichert), 300 ms Nachlauf, Display aus, schlafen. ESP-NOW-Kanal in `RTC_DATA_ATTR`.
- Pin-Manager: Board-Maske `rtc`, `/api/pins` → `rtc`, `checkWakePin()` (GPIO 0 = BOOT-Taste
  reserviert → 409, kein RTC → 400), der Wach-Pin ist als `energy`/`wake_pin` für Items belegt.
- Web: Energie-Seite mit Gruppe „Deep-Sleep“ (explizites Speichern, Bestätigung beim
  Einschalten), `PinHint` mit `rtc`.

**Am Gerät gefunden und behoben:** (1) `PostJsonHandler` antwortet in `handleBody`, also vor der
Middleware — der Settings-POST zählte nicht als Zugriff, ein Board, das länger als der Timeout
unberührt lief, schlief direkt nach dem Einschalten von Deep-Sleep ein. Jetzt setzt auch
`handleBody` den Zugriffszeitpunkt. (2) Ohne WLAN blockierte der MQTT-Connect zum Hostnamen
~7 s je Versuch; das Kurz-Wach ohne WLAN überspringt jetzt MQTT/Webhook/WebSocket (~7,5 s statt
~20 s wach). Mit WLAN und unerreichbarem Broker bleiben ~18 s — Ursache des bekannten PLAN-Punkts
„`loop()` hält den `RegistryLock` > 3 s“, dort nachgetragen.

**Verifikation:** Firmware `pio test -e native` 99/99 (neu `test_wake_mode`, erweitert
`test_pin_map`/`test_state_saver`), `pio run` für alle drei Envs grün (esp32dev Flash 94,8 %),
Web `pnpm typecheck`/`test` (62)/`build` grün, Redocly-Lint grün (bekannte Warnung). Energie-Seite
gegen den Node-Mock durchgeklickt (Vorschläge nur RTC-Pins ohne GPIO 0, „kein RTC-Pin“ bei 42,
Bestätigung, Patch). Am `brewcontrol-esp32dev` per OTA: API-Validierung (400/409 wie oben,
Wach-Pin in `/api/pins` belegt, Item darauf → 409), dann vier Schlafläufe mit Wach-Pin 32,
Intervall und Timeout 60 s, beobachtet über COM6 (der CP2102 bleibt im Schlaf an; die Ausgabe
bricht je Boot nach ~3,6 s ab, weil der OneWire-Bus auf GPIO 1 = UART-TX liegt) und ein Log im
1-s-Takt: Voll-Wach schläft 60 s nach dem letzten Zugriff, Kurz-Wach-Zyklen im 60-s-Takt
(`DEEPSLEEP_RESET`), je Aufwachen Log-Zeilen mit Werten, `dac_test` bleibt auf 1,5, ein 150-s-Timer
kürzte den Schlaf auf sein Ende (Aufwachen 1 s danach); ohne WLAN ebenso, kein Absturz. Zurück in
Voll-Wach jeweils per COM6-Reset. Danach Test-Log/-Timer gelöscht, `dac_test` 0, Energie-
Einstellungen auf die Ausgangswerte. Nicht geprüft (PLAN „Deep-Sleep: Rest am Gerät“): Taster/
Jumper am Wach-Pin, Pegel der Ausgänge und Strom im Schlaf, S2/LilyGo, ESP-NOW-Empfang, Drift.
