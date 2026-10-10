# SensActCtrl

ESP32-Library für Sensoren, Aktoren und Controller. Liefert generische
Primitive (Wert lesen, Aktor schalten, Zwei-Punkt/PID regeln, …) hinter
einer einheitlichen API — lokal über GPIO/I2C/OneWire/SPI oder remote über
MQTT/ESP-Now/Webhooks/WebSockets, transparent aus Sicht des Reglers. Domain-Logik
(z.B. Brauerei-Rasten, Aquaristik-Profile, Gewächshaus-Kurven) bleibt im
Anwender-Sketch oder einem aufsetzenden Projekt (etwa
[`BrewControl`](https://github.com/nhhop/Brauerei/tree/main/BrewControl) für
Heim-/Hobbybrau).

> **Status:** Phase 1–3 vollständig (lokale Sensoren/Aktoren/Controller,
> Remote-Transport MQTT/ESP-Now/Webhook/WebSocket, Registry-JSON-Snapshot). 189+
> native Unit-Tests grün (`pio test -e native`).

## Architektur in einem Bild

```
Sensor ──┐
         ├──► Controller ──► Actuator
Sensor ──┘        ▲
                  └── setSetpoint(), Tuning via paramsJson()
```

Alle drei Rollen werden in einer zentralen `Registry` registriert; das
Sketch ruft pro `loop()`-Durchlauf einmal `registry.tick()` — die Registry
ruft intern in fester Reihenfolge **Sensoren → Controller → Aktoren** auf
(eliminiert eine Tick-Verzögerung zwischen Messung und Stellgröße). Lookup
per ID über `findSensor(id)`/`findActuator(id)`/`findController(id)`.

## Klassifizierung

Sensoren und Aktoren werden in zwei orthogonalen Achsen beschrieben:

- **`ValueKind`** — mathematische Natur des Wertes: `Binary` (zwei
  Zustände), `Discrete` (endlich/abzählbar, z.B. Mehrstufen-Schalter),
  `Continuous` (Float, beliebige Auflösung), `Cumulative` (monoton
  wachsend, z.B. Gesamtvolumen).
- **`Quantity`** — physikalische Messgröße (`Temperature`, `Humidity`,
  `Pressure`, `pH`, `Mass`, `Volume`, `FlowRate`, `DutyCycle`, `Count`, …).

Beispiele:

| Gerät                          | Kind         | Quantity      | Unit     |
|--------------------------------|--------------|---------------|----------|
| DS18B20 / MAX31865 Thermometer | Continuous   | Temperature   | `°C`     |
| SSR-Heizer (Time-Proportional) | Continuous   | DutyCycle     | (0..1)   |
| Schalter / Relais              | Binary       | None          |          |
| YF-S201 Durchflusssensor       | Continuous / Cumulative | FlowRate / Volume | `l/min` / `l` |
| HX711 Wägezelle                | Continuous   | Mass          | `kg`     |
| Hopfengabe-Dispenser           | Discrete     | Count         | `pulses` |

Jede Sensor-Instanz kann mehrere **Kanäle** haben (`channelCount()` +
`channel(idx)`, `Channel`-Struct aus `key`+`SensorMeta`+`Reading`) — z.B.
liefert `YF_S201Sensor` einen `"rate"`- und einen `"volume"`-Kanal aus
derselben Instanz. `YF_S201Sensor`, `HCSR04Sensor` und `ImuTiltSensor` lassen per
`setChannelMask()` nur einen Teil ihrer Kanäle nach außen zeigen (Messung
und ISR laufen unverändert; `channelCount()`/`channel()` liefern nur die
gewählten). Einkanalige Sensoren melden `channelCount()==1` mit
leerem Key (transparent für Flat-Topic-Konsumenten wie MQTT).

## Mini-Beispiel

```cpp
#include <SensActCtrl.h>
using namespace SensActCtrl;

DS18B20Sensor mashTemp("mash_temp", /*pin=*/4);
DigitalOutputActuator heater("heater", /*pin=*/16);
TwoPointController ctrl("mash_ctrl", mashTemp, heater);

Registry registry;

void setup() {
  Serial.begin(115200);
  ctrl.setHysteresis(/*low=*/-0.5f, /*high=*/+0.5f);
  ctrl.setSetpoint(65.0f);  // 65 °C

  registry.add(&mashTemp);
  registry.add(&heater);
  registry.add(&ctrl);
  registry.begin();
}

void loop() {
  registry.tick();
}
```

## Was die Library enthält

**Sensoren** (`src/sensors/`): `DigitalInputSensor`, `AnalogInputSensor`
(lineare Kalibrierung), `VoltageSensor` (Spannung hinter einem Spannungsteiler
R1/R2, z. B. Batterie, liest kalibrierte Millivolt per `analogReadMilliVolts`),
`PulseCounterSensor` (Total-/Rate-Modus),
`DS18B20Sensor` (OneWire, async; eigener Bus per Pin oder ein fremder
`OneWire&`, den sich mehrere Sensoren teilen — mit ROM-Adresse oder ohne, dann
erstes Gerät), `BME280Sensor` (I2C, Temp/Feuchte/Druck),
`MAX31865Sensor` (SPI, PT100/PT1000), `YF_S201Sensor` (Durchfluss +
Volumen, 2 Kanäle), 6-Achsen-IMUs über I2C mit gemeinsamer Basis `ImuSensor`
und identischen Kanälen (Beschleunigung `ax`/`ay`/`az` in g, Drehrate
`gx`/`gy`/`gz` in °/s, Chip-Temperatur `temp`; Retry und Hot-Plug wie beim
BME280): `GY521Sensor` (MPU-6050, Adafruit MPU6050), `QMI8658Sensor`
(SensorLib), `BMI270Sensor` (SparkFun BMI270) und `BMI160Sensor` (eigener
Registertreiber); `ImuTiltSensor` (Winkel aus einem eigenen `ImuSensor`,
`GY521TiltSensor` als Kurzform für den GY-521: `pitch` um Y und `roll` um X per Komplementärfilter mit
gelerntem Kreisel-Nullpunkt, `tilt` als Neigung der Z-Achse gegen die
Senkrechte, `dir` als Richtung der Neigung — Peilung der oberen Seite in
der X/Y-Ebene, `atan2(roll, pitch)`, 0…360° (0 = −X-Seite oben, 90 = +Y,
180 = +X, 270 = −Y), unter 0,5° Neigung ungültig; per `setChannelMask()` zusätzlich die Rohkanäle, bis zu 11;
kein Gierwinkel, der braucht ein Magnetometer), `HX711LoadCellSensor`
(Wägezelle, eigener Bit-Bang-Treiber), `MqttGenericSensor` (frei
konfigurierbarer Topic, roh oder JSON-Feld-Extraktion, für Fremdgeräte),
`CalibratedSensor` (Decorator: umhüllt einen beliebigen Sensor und rechnet
pro Kanal `wert = valRef + gain · (roh − rawRef)` — Ein-Punkt-Offset,
Ein-Punkt-Faktor oder Zwei-Punkt; „roh" ist der unkalibrierte Wert des
Sensors, `rawValue()` liefert ihn für Kalibrier-Oberflächen. Für krumme
Kennlinien zusätzlich `calibratePoly()`: Ausgleichspolynom vom Grad 1–3 durch
bis zu acht Stützpunkte, ausgewertet in der zentrierten und skalierten
Koordinate `u = (roh − rawRef)/rawScale` — ohne diese Skalierung wären die
Normalgleichungen bei 24-Bit-Rohwerten unbrauchbar. Außerhalb der Stützstellen
wird tangential-linear fortgesetzt, damit eine Kubik dort nicht unmonoton
wird; die Stützpunkte bleiben in `Calibration` erhalten, sodass eine Ober-
fläche einzelne korrigieren und der Fit nach einem Reload neu gerechnet werden
kann. Binary/Discrete-Kanäle sind nicht kalibrierbar, Cumulative nur per
Faktor; kalibrierbar sind die ersten vier Kanäle eines Sensors, weitere
werden unverändert durchgereicht).

**Aktoren** (`src/actuators/`): `DigitalOutputActuator` (binär oder
Time-Proportional/SSR, auf einem GPIO oder einem Port-Expander-Kanal über `GpioPort`), `PulseOutputActuator` (nicht-blockierende
Puls-Queue), `AnalogOutputActuator` (PWM, On-Chip-DAC oder externer DAC über `DacOutput`), `IdsActuator` (IDS1/IDS2
Induktionskochfeld, Arduino-only; sendet per RMT, `fault()` meldet neben Plattenfehlern
auch einen fehlenden RMT-Kanal, dann blockiert das Software-Timing `loop()` ~139 ms je Frame), `MqttGenericActuator` (frei
konfigurierbarer Topic + Payload-Template, für Fremdgeräte).

**Externe DACs** (`src/devices/`): `MCP4728` (4 × 12 Bit, I²C 0x60–0x67) ist
ein reiner Treiber, kein Sensor/Aktor. `channel(0..3)` liefert ein
`DacOutput` (`rawMax()`, `write(raw)`), das `AnalogOutputActuator(id, DacOutput&)`
statt eines GPIO bekommt — so geht ein Analogausgang auch auf Boards ohne
eigenen DAC:

```cpp
MCP4728 dac(Wire, 0x60);
AnalogOutputActuator boiler("boiler", dac.channel(0));
boiler.setRange(Quantity::Power, "%", 0, 100, 1);
```

Der Treiber nutzt nur den Multi-Write-Befehl: Referenz VDD, Gain ×1, Ausgang
folgt sofort der Bestätigung (UDAC = 0, der LDAC-Pin ist egal). Das EEPROM
wird nie beschrieben; nach dem Einschalten liegt der Ausgang auf dem dort
gespeicherten Wert (ab Werk 0 V) — den Chip daher nicht anderswo mit einem
Startwert ≠ 0 programmieren. Antwortet der Chip nicht, meldet der Aktor
`fault()`; der nächste erfolgreiche Write löscht den Fehler. `tick()` sendet
den Ausgangswert jede Sekunde erneut (`kRefreshMs`): Ein abgezogener und
wieder angesteckter Chip startet mit seinen EEPROM-Werten, bekommt so binnen
einer Sekunde die richtigen zurück, und ein fehlender Chip fällt auch ohne
Wertänderung auf. Eine neue I²C-Adresse programmiert die Library nicht.

**Port-Expander** (`src/devices/`): `PCF8575` (16 Pins P00–P07/P10–P17, I²C
0x20–0x27) implementiert `GpioPort` (`pinMode`/`write`/`read` je Kanal 0–15).
`DigitalOutputActuator(id, GpioPort&, ch, …)` und `DigitalInputSensor(id,
GpioPort&, ch, …)` nehmen einen Kanal statt eines GPIO — nur für langsame
Digitalpfade (kein PWM, keine Interrupts, keine Bit-Bang-Protokolle):

```cpp
PCF8575 io(Wire, 0x20);
io.begin();
DigitalOutputActuator pump("pump", io, 0, DigitalOutputActuator::Mode::Binary,
                           /*activeHigh=*/false);   // Relaismodul aktiv-low
DigitalInputSensor lid("lid", io, 8, /*pullup=*/true, /*invert=*/true);
```

Der PCF8575 ist quasi-bidirektional: 0 zieht hart nach Masse (~25 mA), 1 ist
nur ein schwacher Pull-up (~100 µA) und zugleich Eingang. Lasten gehören
deshalb zwischen Pin und VCC (aktiv-low) oder hinter einen Transistor;
Eingänge haben immer den schwachen Pull-up. Der Treiber hält ein
Schattenregister aller 16 Ausgänge, jeder Write schickt beide Bytes, Eingänge
immer als 1; Schatten und Transfer liegen unter einer Mutex, mehrere Tasks
dürfen also verschiedene Kanäle schreiben. `begin()` übernimmt die aktuellen
Latches des Chips, damit ein ESP-Neustart die anderen Kanäle nicht umschaltet.
`read()` holt den Port höchstens alle 20 ms (`kReadCacheMs`), N Eingänge
kosten so einen Transfer. Ausgänge schreibt der Aktor nur bei Pegelwechsel und
jede Sekunde neu (`kRefreshMs`) — ein wieder angesteckter Chip steht binnen
einer Sekunde wieder richtig. Antwortet der Chip nicht, melden Aktor und
Sensor `fault()`, der Sensor liefert dann ungültige Werte. **Einschaltzustand:**
Nach dem Einschalten stehen alle Pins auf 1, und ein Reset des ESP32 lässt
sie, wo sie waren, bis der Aktor sie neu setzt — sicherheitsrelevante
Ausgänge deshalb aktiv-low verdrahten.

**Controller** (`src/controllers/`): `TwoPointController` (Bang-Bang mit
Hysterese), `PIDController` (AutoTunePID-Wrapper, 5 Tuning-Algorithmen),
`DualStageController` (Bang-Bang Heizen+Kühlen, 1 Sensor → 2 Aktoren,
Anti-Short-Cycle), `SplitRangePIDController` (bipolarer PID −1..+1,
positiv heizt/negativ kühlt, ebenfalls AutoTune-fähig über eine geteilte
`detail::PidEngine`), `RateLimitedController` (Decorator, begrenzt die
Sollwert-Änderungsrate °/min für einen beliebigen Regler).

**Transport** (`src/transport/`): `ITransport`-Interface
(`publish`/`subscribe`/`tick`/`connected`/`lastErrorMessage`), Implementierungen
`MqttTransport` (PubSubClient-Wrapper, Reconnect-Backoff; der Verbindungsaufbau
läuft in einem kurzlebigen FreeRTOS-Task, `tick()` blockiert also auch bei
unerreichbarem Broker nicht; `connected()`/`lastErrorMessage()` sind aus jedem
Task lesbar, alle übrigen Methoden gehören in den Task, der `tick()` ruft), `EspNowTransport`
(Broadcast für Meta/State, Retain-Emulation via Retained-Request,
250-Byte-Paketlimit; nicht-retained Befehle wie `/set` gehen unicast mit
ESP-NOW-ACK an den Knoten, der das Eltern-Topic zuletzt gesendet hat — die
MAC wird aus empfangenen Paketen gelernt, nichts wird gespeichert; Ziel
unbekannt → Broadcast; Zustellfehler erscheinen in `lastErrorMessage()`),
`WebhookTransport` (HTTP-Push/Pull, peer-to-peer, Timeout+Backoff bei
unerreichbarem Peer), `WebSocketTransport` (dauerhafte bidirektionale
Verbindung ohne Broker über `links2004/WebSockets`; Server- oder Client-Rolle,
gedacht als Hub: veröffentlichende Knoten verbinden sich als Client zum
konsumierenden Knoten; Retain-Emulation via Retained-Request, Heartbeat;
`/set` und `/tune` gehen aus der Server-Rolle nur an den Client, der zuletzt
Frames dieses `<device>` geliefert hat — Mapping aus empfangenen Frames
gelernt, pro Verbindung, Ziel unbekannt → Broadcast).
Der Client-Connect blockiert bei unerreichbarem Server bis zu
`WEBSOCKETS_TCP_TIMEOUT` (Library-Default 5000 ms) pro Reconnect-Versuch —
`-DWEBSOCKETS_TCP_TIMEOUT=1000` in `build_flags` empfohlen.

**Remote** (`src/remote/`): `RemoteSensor`/`RemoteActuator` (proxyen einen
Sensor/Aktor eines anderen Knotens transparent über einen `ITransport&`),
`RemotePublisher` (veröffentlicht lokale Items automatisch: Meta retained
bei `attach()`, State zyklisch, Controller-Tuning eingehend über `/tune`).
Alle drei sind komplett transport-agnostisch. Topic-Schema
(`src/remote/Topics.h`, gilt für alle Transporte gleich):

```
<prefix>/<device>/sensor/<id>              State (retained)
<prefix>/<device>/sensor/<id>/meta         Meta  (retained)
<prefix>/<device>/sensor/<id>/<key>        Multi-Channel-Kanal-State
<prefix>/<device>/actuator/<id>            State (retained)
<prefix>/<device>/actuator/<id>/meta       Meta  (retained)
<prefix>/<device>/actuator/<id>/set        Command
<prefix>/<device>/controller/<id>/meta     Meta inkl. paramsJson (retained)
<prefix>/<device>/controller/<id>/tune     Tuning-Command
```

**Discovery** (`src/remote/Discovery.h`): Jeder `RemotePublisher` beantwortet
Suchanfragen automatisch; `DiscoveryScanner` ist die Gegenseite (Anfrage
senden, Antworten ~3 s sammeln, dedupliziert, eigenes Gerät gefiltert,
thread-sicher). Die Topics sind fix und prefix-unabhängig, damit man ohne
Kenntnis von Gerät oder Prefix suchen kann; beides ist nicht retained:

```
sensactctrl/discover             {"reply":"sensactctrl/discover/<scanner>","rid":7}
sensactctrl/discover/<scanner>   eine Antwort je Sensor-Kanal / Aktor:
  {"rid":7,"d":"node-a","p":"brewcontrol","k":"sensor","id":"mash_temp","ch":"","q":"Temperature","u":"°C"}
```

Der Publisher antwortet nach zufälliger Verzögerung (`setDiscoveryJitterMs()`,
Default 400 ms) ein Item pro `tick()`, damit mehrere Knoten nicht gleichzeitig
funken. Controller werden nicht gelistet.

Vier Zwei-Geräte-Beispiel-Sketches demonstrieren das Muster:
`examples/08_remote_mqtt/`, `09_remote_espnow/`, `10_remote_webhook/`,
`11_remote_websocket/` (je `publisher/` + `consumer/` + eigenem `README.md`).

**Snapshot** (`src/core/RegistrySnapshot.{h,cpp}`): freie Funktion
`serializeRegistry()` erzeugt einen vollständigen JSON-Snapshot der
Registry (Sensoren/Aktoren mit Meta+State+`fault`/`enabled`/`target`/
`interval`, Controller mit Setpoint+Params) — dasselbe Wire-Format wie die
MQTT-Topics. Frontend-agnostisch designt; `BrewControl` konsumiert dieses
Format direkt ohne eigene Serialisierung.

**Enable/Target/Interval** (`core/Actuator.h`, `core/Controller.h`): jeder
Aktor und Controller kennt `enabled()`/`setEnabled(bool)` (Master-Schalter,
gated am Punkt der Hardware-Ansteuerung); Aktoren zusätzlich `target()`
(zuletzt kommandierter Wert, unabhängig vom physischen `state()`) und
optional `interval()`/`setInterval()` (Ein/Aus-Taktung über eine
konfigurierbare Zeitbasis, `IntervalActuator`-Decorator).

Beispiele liegen unter `examples/`. Native Unit-Tests unter `test/` (laufen
ohne Hardware via `pio test -e native`).

## Design-Entscheidungen

- **Speicher:** `std::vector` für Registry-Listen — ESP32 hat genug Heap;
  die Registry wird im `setup()` befüllt und danach nicht mehr strukturell
  verändert (Add/Remove zur Laufzeit passiert auf Anwenderseite, z.B.
  BrewControls `DynamicItems`, nicht in der Registry selbst).
- **Threading:** Single-Thread — kein FreeRTOS-Task pro Sensor.
  `Registry::tick()` wird einmal pro `loop()`-Durchlauf aufgerufen und
  ruft intern alle Sensor-/Controller-/Aktor-`tick()`s in dieser
  Reihenfolge auf. Reicht für Sekunden-Takt-Anwendungen wie Brauen;
  könnte bei Bedarf in einen eigenen FreeRTOS-Task wandern, ohne dass sich
  die öffentliche API ändert.
- **Keine C++-Exceptions/RTTI** — Arduino-Standard.

## Lizenz

MIT.
