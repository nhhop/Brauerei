# Session — Phase 1 + 2 + 3 komplett

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
