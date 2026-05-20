# Plan: SensActCtrl — Sensor/Aktor-Library für ESP32

## Context

Greenfield-Projekt: Eine wiederverwendbare ESP32-Library, die Sensoren, Aktoren
und Controller (Zwei-Punkt, PID) in einer einheitlichen API zusammenführt.
Besonderheit: Sensoren und Aktoren können nicht nur lokal (I2C, OneWire, GPIO)
angeschlossen sein, sondern auch auf **anderen ESP32-Knoten** liegen und über
ein austauschbares Transport-Layer (MQTT, ESP-Now, Webhooks) angesprochen
werden — aus Sicht eines Controllers ist das transparent.

Anwendungsfälle: alles, was Sensoren liest und Aktoren ansteuert — Heim-/
Hobbybrau-Steuerungen (z.B. das separate `BrewControll`-Projekt, das auf
dieser Library aufsetzt), Aquaristik, Gewächshaus-Klima, Trocken-/Räucher-
schränke, … Domain-Logik (Maische-Rasten, Hopfengaben, Gärführung etc.)
bleibt **außerhalb** der Library — die Library liefert nur die Primitive.

Konfiguration erfolgt zunächst code-basiert über eine Registry-API. Ein
späteres Web-Frontend (out of scope dieses Plans) soll diese Registry zur
Laufzeit lesen/manipulieren können, daher wird die API frontend-agnostisch
designt.

## Tech-Stack

- **Framework**: PlatformIO + Arduino-Core für ESP32
- **Sprache**: C++ (C++17, wie ESP32-Arduino-Core unterstützt)
- **Library-Layout**: Standard PlatformIO-Library (`library.json` + `src/`)
- **Externe Libraries** (als `lib_deps`):
  - `paulstoffregen/OneWire` + `milesburton/DallasTemperature` (DS18B20)
  - `adafruit/Adafruit BME280 Library` + `adafruit/Adafruit Unified Sensor`
  - `lily-osp/AutoTunePID` (PID-Backend mit AutoTune-Algorithmen —
    Ziegler-Nichols, Cohen-Coon, IMC, Tyreus-Luyben, Lambda; MIT-Lizenz;
    non-blocking `update(input)`; min. Aufruf-Intervall 100 ms — für
    Brauerei-Frequenzen unproblematisch).
  - `knolleary/PubSubClient` (MQTT, später)
  - `bblanchon/ArduinoJson` (Payload-Serialisierung)

## Architektur

### Kernabstraktionen (`src/core/`)

```
Sensor (abstract)               Actuator (abstract)         Controller (abstract)
  + id() : const char*           + id() : const char*        + tick() : void
  + meta() : SensorMeta          + meta() : ActuatorMeta     + setSetpoint(float)
  + read() : Reading             + write(float v)            + paramsJson(buf) : void
  + tick() : void                + state() : float           + setParamsJson(buf): bool
  + lastReading() : Reading      + tick() : void
```

- `Reading` (POD): `float value; uint32_t timestampMs; bool valid;`
- **Klassifizierung in zwei orthogonalen Achsen** (gilt für Sensoren *und*
  Aktoren):

  1. `ValueKind` — beschreibt die *mathematische Natur* des Wertes:
     - `Binary` — zwei Zustände (0/1). Bsp.: Schalter, Relais.
     - `Discrete` — endlich/abzählbar viele Zustände (ganzzahlig).
       Bsp.: Mehrstufen-Schalter, Pulse-Output (N Pulse).
     - `Continuous` — Float, beliebige Auflösung im Bereich. Bsp.:
       Temperaturmessung, Duty-Cycle eines SSR.
     - `Cumulative` — monoton wachsender Wert. Bsp.: Pulse-Counter
       Total, Gesamt-Liter, Stromzähler-kWh.

  2. `Quantity` — beschreibt die *physikalische Messgröße*, was
     gemessen/gesteuert wird. Nur sinnvoll bei `Continuous` und
     `Cumulative`; bei `Binary`/`Discrete` typischerweise `None`.
     Werte: `None, Temperature, Humidity, Pressure, pH, Voltage, Current,
     Power, Energy, Mass, Volume, FlowRate, Frequency, Duration,
     DutyCycle, Count, Custom`.

  Die beiden Achsen sind orthogonal — `Continuous + Temperature` ist
  ein Thermometer, `Continuous + DutyCycle` ein TPO-SSR, `Cumulative +
  Volume` ein Liter-Zähler, `Discrete + Count` ein Hopfengabe-Aktor.

- `SensorMeta` (POD):
  ```cpp
  struct SensorMeta {
    ValueKind kind;
    Quantity  quantity;
    const char* unit;     // "°C", "%RH", "bar", "l/min", "pulses", ""
    float min;
    float max;
    float resolution;
  };
  ```
- `ActuatorMeta` (POD): gleiche Struktur, gleiche Semantik (Kind ×
  Quantity × unit × range × resolution).
- `tick()` wird vom `Registry`/Sketch periodisch aus `loop()` aufgerufen.
  Sensoren mit langer Konversionszeit (DS18B20 ~750 ms @ 12-bit) starten
  Reads asynchron und bringen sie im nächsten `tick()` ein — **kein
  `delay()` in der Hot-Loop**.
- IDs sind kurze, eindeutige `const char*` (z.B. `"mash_temp"`), damit ein
  späteres Web-Frontend und Remote-Knoten sie referenzieren können.
- **Controller-Tuning**: jeder konkrete Controller exponiert typisierte
  Setter (z.B. `PIDController::setTunings(Kp, Ki, Kd)`,
  `TwoPointController::setHysteresis(low, high)`). Zusätzlich liefert die
  Basisklasse `paramsJson(buf)`/`setParamsJson(buf)` — generische
  JSON-Serialisierung der Tuning-Parameter, damit das spätere Web-Frontend
  und Remote-Transports einheitlich auf alle Controller zugreifen können,
  ohne pro Typ Code schreiben zu müssen.

### Registry (`src/core/Registry.h`)

Zentrale Instanz, die alle Sensoren/Aktoren/Controller hält. Storage:
`std::vector<Sensor*>`, `std::vector<Actuator*>`, `std::vector<Controller*>`
(ESP32 hat genug Heap; Registry wird im `setup()` einmalig befüllt und
danach nicht mehr modifiziert, daher keine Fragmentierungs-Risiken).

**Lifecycle** — so wird sie genutzt:

```cpp
SensActCtrl::Registry registry;          // global

void setup() {
  registry.add(&mashTemp);                // DS18B20Sensor
  registry.add(&heater);                  // DigitalOutputActuator (TPO)
  registry.add(&pid);                     // PIDController(mashTemp, heater)
  registry.begin();                       // ruft begin() auf allen Items
}

void loop() {
  registry.tick();                        // einziger Aufruf im loop
}
```

`Registry::tick()` iteriert intern in fester Reihenfolge **Sensoren →
Controller → Aktoren** und ruft auf jedem registrierten Objekt dessen
`tick()` auf:

1. **Sensoren** zuerst → frische `Reading`s liegen vor.
2. **Controller** lesen diese Readings und berechnen Stellgrößen, schreiben
   sie via `Actuator::write(...)` in die Aktoren.
3. **Aktoren** zuletzt → können in ihrem `tick()` z.B. TPO-Pulse oder
   die PulseOutput-Queue weitertakten, basierend auf gerade gesetzten
   Werten.

Diese Reihenfolge eliminiert eine Tick-Verzögerung zwischen Messung
und Stellgröße. Lookup per ID (`findSensor(id)`, `findActuator(id)`,
`findController(id)`).

Keine eigene Persistenz — Persistenz/JSON-Snapshot kommen erst mit dem
Web-Frontend, die Registry stellt aber bereits Iteratoren zur Verfügung,
damit das später additiv ergänzt werden kann.

### Lokale Sensoren (`src/sensors/`)

- `DS18B20Sensor` — wrappt OneWire-Bus + 64-bit ROM-Code, asynchrone
  Konversion via Zustandsmaschine (`IDLE → CONVERTING → READY`).
  Meta: kind=`Continuous`, quantity=`Temperature`, unit `"°C"`,
  range −55..125, resolution 0.0625 (12-bit).
- `BME280Sensor` — pro Messgröße (Temp/Feuchte/Druck) **eine** Sensor-
  Instanz, die sich einen geteilten `Adafruit_BME280`-Handle teilt.
  Alle drei: kind=`Continuous`. Quantities: `Temperature` (°C),
  `Humidity` (%RH), `Pressure` (hPa).
- `DigitalInputSensor` — GPIO mit optionalem Software-Debounce; `value`
  ist 0.0/1.0. Meta: kind=`Binary`, quantity=`None`, unit `""`,
  range 0..1, resolution 1.
- `AnalogInputSensor` — ESP32-ADC (`analogRead`). Konfigurierbar:
  - ADC-Attenuation (`ADC_ATTEN_DB_*` → bestimmt phys. Eingangsspannung).
  - **Lineare Kalibrierung**: `setCalibration(rawMin, rawMax, valueMin,
    valueMax)` skaliert Rohwert auf physikalische Einheit (z.B. pH 0..14,
    Druck 0..3 bar). Default: pass-through 0..4095.
  - Optionales gleitendes Mittel (N letzte Reads).
  - Meta: kind=`Continuous`. Quantity, unit, range über Konstruktor/
    Setter konfigurierbar (Anwendungs-spezifisch; z.B. `pH`/"pH"/0..14
    oder `Voltage`/"V"/0..3.3 oder `Custom`/freier String).
- `PulseCounterSensor` — zählt Flanken auf einem GPIO via Interrupt.
  Zwei Betriebsmodi mit unterschiedlicher Klassifikation:
  - `Total` (monoton steigender Zähler) → kind=`Cumulative`,
    quantity=`Count` (default) oder `Volume`/`Energy`/`Custom` bei
    Skalierung. Bsp.: Gesamtdurchfluss in Litern.
  - `Rate` (Pulse pro Zeitfenster) → kind=`Continuous`,
    quantity=`FlowRate`/`Frequency`/`Custom`. Bsp.: Flow l/min.
  - Optionale `pulsesPerUnit`-Skalierung wandelt rohe Pulse in
    physikalische Einheit.

### Lokale Aktoren (`src/actuators/`)

- `DigitalOutputActuator` — GPIO-Aktor mit zwei Modi:
  1. **Binär**: `write(0.0)` = LOW, sonst HIGH.
     Meta: kind=`Binary`, quantity=`None`, range 0..1, resolution 1.
  2. **Time-Proportional** (für SSR/Heizstab): `write(0..1)` setzt
     Duty-Cycle über eine konfigurierbare Periode (z.B. 2 s). `tick()`
     übernimmt das Pulsen, kein PWM-Hardware-Konflikt mit anderen GPIOs.
     Meta: kind=`Continuous`, quantity=`DutyCycle`, unit `""` oder `"%"`,
     range 0..1, resolution z.B. 0.01.
- `PulseOutputActuator` — Gegenstück zu `PulseCounterSensor`.
  `write(N)` enqueued **N Pulse**, die nicht-blockierend via `tick()`
  auf einen GPIO ausgegeben werden. Konfigurierbar: `pulseWidthMs`,
  `gapMs`, `activeLevel` (HIGH/LOW). `state()` = noch ausstehende Pulse.
  Anwendung: Schrittmotor-Pulse, Hopfengabe-Automat (1 Puls = 1
  Hopfengabe), Dosierpumpe (N Pulse = N ml). Meta: kind=`Discrete`,
  quantity=`Count` (oder `Volume`/`Mass`/`Custom`), unit `"pulses"`
  oder skaliert, range 0..uint32-Max, resolution 1.

### Controller (`src/controllers/`)

- `TwoPointController` — Bang-Bang mit Hysterese (`hysteresisLow`,
  `hysteresisHigh`). Bindet 1 Sensor → 1 Aktor. Tuning-API:
  `setHysteresis(low, high)`, `setInverted(bool)` (Heizen vs. Kühlen).
- `PIDController` — **wrappt `AutoTunePID`** (lily-osp/AutoTunePID) als
  internes Backend. Vorteile gegenüber Eigenbau:
  - Bewährte AutoTune-Algorithmen (Ziegler-Nichols, Cohen-Coon, IMC,
    Tyreus-Luyben, Lambda) bereits integriert.
  - Input/Output-Filter und Anti-Windup eingebaut.
  - Kp/Ki/Kd sind nach AutoTune über Accessoren auslesbar — wir können
    sie über `paramsJson` exportieren und persistieren.

  Unsere Wrapper-API (passt zum `Controller`-Interface):
  - `setTunings(Kp, Ki, Kd)` → forwarded zu `setManualGains(...)`.
  - `setOutputLimits(min, max)` → über Konstruktor von `AutoTunePID`.
  - `setSetpoint(float)` und intern `update(reading.value)` im `tick()`.
  - `enableInputFilter(float alpha)` / `enableOutputFilter(float alpha)`
    → durchgereicht.
  - `enableAntiWindup(bool, float threshold)` → durchgereicht.
  - `setOperationalMode(OperationalMode)` / `setOscillationMode(
    OscillationMode)` → durchgereicht.
  - **AutoTune-API — alle 5 Methoden zugänglich**:
    - Eigenes `enum class TuningMethod { ZieglerNichols, CohenCoon,
      IMC, TyreusLuyben, Lambda }` (1:1 zur AutoTunePID-internen Enum).
    - `autotune(TuningMethod)` startet den Lauf;
    - `isAutotuneRunning()` / `isAutotuneDone()` zur Statusabfrage;
    - Nach Abschluss sind die Werte via `getKp()` / `getKi()` /
      `getKd()` (und für Reverse-Engineering der Strecke `getKu()` /
      `getTu()`) abrufbar und werden in `paramsJson` mit ausgegeben.
  - **Rate-Limiting**: `tick()` ruft `update()` höchstens alle 100 ms
    (AutoTunePID-Constraint) — saubere Kapselung; Sketches müssen das
    nicht selbst beachten.

- Beide Controller serialisieren ihre Tuning-Parameter über
  `paramsJson(buf)` / `setParamsJson(buf)`. Beispiel für `PIDController`:
  `{"Kp":2.5,"Ki":0.1,"Kd":0.0,"Ku":4.8,"Tu":12.0,"min":0,"max":1,
  "autotuneMethod":"ZieglerNichols","autotuneState":"done"}`. Das macht
  Runtime-Tuning (jetzt über Sketch, später via Web-Frontend/MQTT)
  trivial, ohne dass die Library jeden Controller-Typ einzeln kennen
  muss.

### Transport-Layer (`src/transport/`) — Phase 2

```
ITransport (interface)
  + publish(topic, payload, retained) : bool
  + subscribe(topic, callback) : bool
  + tick() : void
```

- `MqttTransport` wrappt `PubSubClient`. Topic-Schema:
  - Sensor-Meta:    `sensactctrl/<deviceId>/sensor/<id>/meta`   (retained)
  - Sensor-State:   `sensactctrl/<deviceId>/sensor/<id>`        (retained)
  - Aktor-Meta:     `sensactctrl/<deviceId>/actuator/<id>/meta` (retained)
  - Aktor-State:    `sensactctrl/<deviceId>/actuator/<id>`      (retained)
  - Aktor-Command:  `sensactctrl/<deviceId>/actuator/<id>/set`
  - Controller-Meta: `sensactctrl/<deviceId>/controller/<id>/meta` (retained)
  - Controller-Tune: `sensactctrl/<deviceId>/controller/<id>/tune`
  - State-Payload:  `{"v":65.4,"t":12345,"ok":true}`
  - Meta-Payload:   `{"kind":"Continuous","quantity":"Temperature","unit":"°C","min":-55,"max":125,"res":0.0625}`

### Remote-Wrapper (`src/remote/`) — Phase 2

- `RemoteSensor` — implementiert `Sensor`-Interface, hält intern letzte
  empfangene `Reading` **und** die zuletzt empfangene `SensorMeta`. Beim
  Subscribe werden beide Topics abonniert (State + Meta). Aus Sicht eines
  Controllers identisch zu einem lokalen Sensor — auch `meta()` liefert
  die remote gemeldete Konfiguration (Einheit, Range, Auflösung). Bis
  erstes Meta-Paket eingetroffen ist, signalisiert `meta().unit == nullptr`
  bzw. `lastReading().valid == false`, dass der Sensor noch nicht
  verfügbar ist.
- `RemoteActuator` — analog. `write(v)` publisht auf `/set`-Topic, Meta &
  State werden remote bezogen.
- `RemotePublisher`-Helper, der einen **lokalen** Sensor/Aktor/Controller
  automatisch via Transport veröffentlicht: bei `attach()` wird einmalig
  die Meta retained gesendet, in `tick()` zyklisch State (oder
  Change-triggered). Für Controller wird auf den `/tune`-Topic gehört und
  Eingehendes via `setParamsJson()` angewendet — so kann ein Remote-Knoten
  (oder später das Web-Frontend) PID-Werte tunen.

## Projekt-Layout

```
SensActCtrl/
├── library.json                # PlatformIO-Manifest (name, version, deps)
├── library.properties          # Arduino-Lib-Manifest (für Kompat.)
├── README.md
├── CLAUDE.md                   # bereits vorhanden
├── platformio.ini              # für Beispiele
├── src/
│   ├── SensActCtrl.h          # Umbrella-Header
│   ├── core/
│   │   ├── Reading.h
│   │   ├── ValueKind.h          # enum class ValueKind
│   │   ├── Quantity.h           # enum class Quantity + toString()
│   │   ├── SensorMeta.h
│   │   ├── ActuatorMeta.h
│   │   ├── Sensor.h
│   │   ├── Actuator.h
│   │   ├── Controller.h
│   │   └── Registry.{h,cpp}
│   ├── sensors/
│   │   ├── DS18B20Sensor.{h,cpp}
│   │   ├── BME280Sensor.{h,cpp}
│   │   ├── DigitalInputSensor.{h,cpp}
│   │   ├── AnalogInputSensor.{h,cpp}
│   │   └── PulseCounterSensor.{h,cpp}
│   ├── actuators/
│   │   ├── DigitalOutputActuator.{h,cpp}
│   │   └── PulseOutputActuator.{h,cpp}
│   ├── controllers/
│   │   ├── TwoPointController.{h,cpp}
│   │   └── PIDController.{h,cpp}
│   ├── transport/              # Phase 2
│   │   ├── ITransport.h
│   │   └── MqttTransport.{h,cpp}
│   └── remote/                 # Phase 2
│       ├── RemoteSensor.{h,cpp}
│       ├── RemoteActuator.{h,cpp}
│       └── RemotePublisher.{h,cpp}
├── examples/
│   ├── 01_local_twopoint_heater/    # DS18B20 + SSR + Hysterese
│   ├── 02_pid_mash/                 # DS18B20 + SSR (TPO) + PID (manuell)
│   ├── 03_pid_autotune/             # PID mit AutoTune-Lauf (Methode via Sketch wählbar)
│   ├── 04_bme280_logger/            # BME280, nur Sensorik
│   ├── 05_flow_meter/               # PulseCounter im Rate-Modus, l/min
│   ├── 06_hop_dispenser/            # PulseOutput: N Hopfengaben auf Knopfdruck
│   ├── 07_analog_ph/                # AnalogInput mit Kalibrierung auf pH 0..14
│   └── 08_remote_mqtt/              # zwei Knoten inkl. Meta-Austausch (Phase 2)
└── test/                            # native (ohne HW), unity-basiert
    ├── test_registry/
    ├── test_twopoint/
    └── test_pid/
```

## Build-Reihenfolge

### Phase 1 — Lokales MVP (eine PR)

Reihenfolge der Implementierung:

1. **Library-Skeleton**: `library.json`, `library.properties`, `platformio.ini`,
   Umbrella-Header, README-Stub. *Verifikation*: `pio pkg pack` läuft fehlerfrei.
2. **Kernabstraktionen**: `Reading`, `ValueKind`, `Quantity`, `SensorMeta`,
   `ActuatorMeta`, `Sensor`, `Actuator`, `Controller` (inkl.
   `paramsJson`/`setParamsJson`), `Registry`. *Verifikation*: Unit-Test
   (native env) instanziiert eine `Registry` und einen Dummy-Sensor, prüft
   `meta()` mit Kind × Quantity × Unit.
3. **Controller**: `TwoPointController` mit Unit-Test (Mock-Sensor/Aktor,
   Sequenz aus Werten → erwartete Aktor-States). Anschließend `PIDController`
   (AutoTunePID-Wrapper) mit Unit-Test (Step-Response, Manual-Tuning,
   Tuning-Round-Trip via `paramsJson`). AutoTune-Lauf wird in einem
   Hardware-Beispiel statt im Unit-Test verifiziert (braucht reale Last).
4. **Lokale Aktoren**: `DigitalOutputActuator` (binär zuerst, dann
   time-proportional) → `PulseOutputActuator` (Unit-Test: `write(5)`
   führt nach `5*(width+gap)` Millisekunden zu 5 Flanken auf Mock-GPIO).
5. **Lokale Sensoren** in dieser Reihenfolge (steigende Komplexität, jeweils
   schnell auf HW testbar):
   - `DigitalInputSensor` (keine externe Lib)
   - `AnalogInputSensor` (ADC, lineare Kalibrierung)
   - `PulseCounterSensor` (ISR-basiert, Total/Rate-Modi)
   - `DS18B20Sensor` (OneWire + DallasTemperature)
   - `BME280Sensor` (I2C + Adafruit-Stack)
6. **Beispiele**: `01_local_twopoint_heater`, `02_pid_mash` (manueller
   PID), `03_pid_autotune` (AutoTune-Lauf), `05_flow_meter`,
   `06_hop_dispenser` (zentral, weil PulseCounter+PulseOutput zusammen
   geprüft werden können), `07_analog_ph`. Kompilieren auf HW, manuell
   getestet — im README als Smoke-Tests beschrieben.

*Phase-1-Done-Kriterium*: Sketch `01_local_twopoint_heater` regelt einen
SSR-Heizer auf Setpoint mit Hysterese; serielle Ausgabe zeigt Reading-Werte
und Aktor-State; `pio test -e native` ist grün.

### Phase 2 — Transport & Remote (separate PR)

7. `ITransport`-Interface + `MqttTransport`.
8. `RemoteSensor`, `RemoteActuator`, `RemotePublisher` — inklusive
   Meta-Austausch (retained Topics) und Controller-Tuning via `/tune`.
9. Beispiel `08_remote_mqtt` — zwei ESP32, einer publisht DS18B20 (inkl.
   Meta), der andere regelt damit lokalen Aktor und tuned dessen PID via
   MQTT.

### Phase 3+ — Erweiterungen (eigene PRs, nicht Teil dieses Plans)

10. `EspNowTransport`.
11. `WebhookTransport` (HTTP-POST, eingehend via einfachem AsyncWebServer).
12. JSON-Snapshot der Registry → Vorbereitung Web-Frontend.

## Verifikation

**Phase 1:**
- `pio test -e native` für Unit-Tests von `Registry`, `TwoPointController`,
  `PIDController`, `PulseOutputActuator`, `AnalogInputSensor`-Kalibrierung
  und `paramsJson`-Round-Trip. Tests verwenden Mock-Sensoren/Aktoren
  (in `test/mocks/`), keine echte HW nötig.
- `pio run -e esp32dev` baut alle Beispiele.
- Hardware-Smoke-Tests:
  - `01_local_twopoint_heater`: Setpoint = 30 °C, Hysterese ±0.5 °C,
    DS18B20 in Hand, SSR-LED beobachten. Erwartung: LED an unter 29.5 °C,
    aus über 30.5 °C, dazwischen behält letzten Zustand.
  - `03_pid_autotune`: AutoTune-Lauf mit Ziegler-Nichols an einer realen
    thermischen Last (z.B. kleine Heizmatte + DS18B20). Erwartung: Lauf
    terminiert nicht-blockierend, danach gibt `paramsJson` plausible
    Kp/Ki/Kd zurück, manueller Step bringt Regelung in Setpoint.
  - `06_hop_dispenser`: Knopfdruck (DigitalInput) löst `PulseOutputActuator
    .write(3)` aus → 3 saubere Pulse auf SSR-LED, mit korrektem Pulsweite/
    Pause; danach geht `state()` zurück auf 0.
  - `07_analog_ph`: Kalibriert auf bekannte Spannungsteiler-Werte, Plot
    via Serial-Plotter zeigt korrekte pH-Skalierung.

**Phase 2:**
- Lokaler Mosquitto-Broker.
- `mosquitto_sub -t 'sensactctrl/#' -v` zeigt Sensor-Updates **und Meta**
  des publishenden Knotens (z.B. `/sensor/mash_temp/meta` mit Einheit °C).
- Steuernder Knoten regelt korrekt anhand des Remote-Sensors (Test: Sensor
  in warmes Wasser → SSR auf publishendem Knoten geht aus).
- `mosquitto_pub` auf `/controller/<id>/tune` mit neuem PID-JSON ändert
  Regelverhalten zur Laufzeit (Verifikation: Serial-Logs des Reglers).

## Kritische Dateien

Die wichtigsten zu schreibenden Dateien (für Code-Review-Priorisierung):

- `src/core/Sensor.h`, `Actuator.h`, `Controller.h`, plus `SensorMeta.h`,
  `ActuatorMeta.h` — definieren das Vertragsmodell inkl. Metadaten, jede
  spätere Änderung bricht alle abhängigen Klassen.
- `src/core/Registry.{h,cpp}` — zentraler Lifecycle, Iteration für späteres
  Web-Frontend.
- `src/controllers/PIDController.cpp` — numerisch sensitiv (Anti-Windup, dt
  aus Timestamps, Tuning-API), höchstes Bug-Risiko.
- `src/sensors/DS18B20Sensor.cpp` — async State-Machine, blockiert sonst.
- `src/sensors/PulseCounterSensor.cpp` — ISR + Volatile-Counter, klassische
  Race-Quelle.
- `src/actuators/PulseOutputActuator.cpp` — Pulse-Queue + nicht-blockierende
  State-Machine; muss mit DigitalOutput-TPO koexistieren.
- `src/transport/MqttTransport.cpp` (Phase 2) — Reconnect-Logik, Topic-Schema.
- `src/remote/RemoteSensor.cpp` (Phase 2) — definiert das Wire-Protokoll
  (State + Meta) zwischen Knoten.

## Offene Entscheidungen (für Implementierungsstart erstmal akzeptiert)

- **Memory**: `std::vector` für Registry-Listen — ESP32 hat genug Heap, vor
  Fragmentierung schützt die Tatsache, dass die Registry beim Setup einmalig
  befüllt und danach nicht mehr modifiziert wird (bis Web-Frontend kommt).
- **Threading**: Single-Thread / nur `loop()`, kein FreeRTOS-Task pro Sensor.
  `Registry::tick()` wird **einmal pro `loop()`-Durchlauf** vom Sketch
  aufgerufen und ruft seinerseits die `tick()`-Funktionen aller registrierten
  Sensoren, Controller und Aktoren in dieser Reihenfolge auf (siehe
  Registry-Section). Sollte für die Brewing-Frequenzen (Sekunden-Takt)
  reichen. Falls später nötig, kann `Registry::tick()` in einen eigenen
  FreeRTOS-Task wandern, ohne dass sich die öffentliche API ändert.
- **C++-Exceptions / RTTI**: aus, Arduino-Standard.
