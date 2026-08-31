# SensActCtrl

ESP32-Library für Sensoren, Aktoren und Controller. Liefert generische
Primitive (Wert lesen, Aktor schalten, Zwei-Punkt/PID regeln, …) hinter
einer einheitlichen API — lokal über GPIO/I2C/OneWire/SPI oder remote über
MQTT/ESP-Now/Webhooks, transparent aus Sicht des Reglers. Domain-Logik
(z.B. Brauerei-Rasten, Aquaristik-Profile, Gewächshaus-Kurven) bleibt im
Anwender-Sketch oder einem aufsetzenden Projekt (etwa
[`BrewControl`](https://github.com/nhhop/Brauerei/tree/main/BrewControl) für
Heim-/Hobbybrau).

> **Status:** Phase 1–3 vollständig (lokale Sensoren/Aktoren/Controller,
> Remote-Transport MQTT/ESP-Now/Webhook, Registry-JSON-Snapshot). 189+
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
derselben Instanz. Einkanalige Sensoren melden `channelCount()==1` mit
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
(lineare Kalibrierung), `PulseCounterSensor` (Total-/Rate-Modus),
`DS18B20Sensor` (OneWire, async), `BME280Sensor` (I2C, Temp/Feuchte/Druck),
`MAX31865Sensor` (SPI, PT100/PT1000), `YF_S201Sensor` (Durchfluss +
Volumen, 2 Kanäle), `HCSR04Sensor` (Ultraschall, 2 Kanäle), `HX711LoadCellSensor`
(Wägezelle, eigener Bit-Bang-Treiber), `MqttGenericSensor` (frei
konfigurierbarer Topic, roh oder JSON-Feld-Extraktion, für Fremdgeräte).

**Aktoren** (`src/actuators/`): `DigitalOutputActuator` (binär oder
Time-Proportional/SSR), `PulseOutputActuator` (nicht-blockierende
Puls-Queue), `AnalogOutputActuator` (PWM/DAC), `IdsActuator` (IDS1/IDS2
Induktionskochfeld, Arduino-only), `MqttGenericActuator` (frei
konfigurierbarer Topic + Payload-Template, für Fremdgeräte).

**Controller** (`src/controllers/`): `TwoPointController` (Bang-Bang mit
Hysterese), `PIDController` (AutoTunePID-Wrapper, 5 Tuning-Algorithmen),
`DualStageController` (Bang-Bang Heizen+Kühlen, 1 Sensor → 2 Aktoren,
Anti-Short-Cycle), `SplitRangePIDController` (bipolarer PID −1..+1,
positiv heizt/negativ kühlt, ebenfalls AutoTune-fähig über eine geteilte
`detail::PidEngine`), `RateLimitedController` (Decorator, begrenzt die
Sollwert-Änderungsrate °/min für einen beliebigen Regler).

**Transport** (`src/transport/`): `ITransport`-Interface
(`publish`/`subscribe`/`tick`/`connected`/`lastErrorMessage`), Implementierungen
`MqttTransport` (PubSubClient-Wrapper, Reconnect-Backoff), `EspNowTransport`
(Broadcast, Retain-Emulation via Retained-Request, 250-Byte-Paketlimit),
`WebhookTransport` (HTTP-Push/Pull, peer-to-peer, Timeout+Backoff bei
unerreichbarem Peer).

**Remote** (`src/remote/`): `RemoteSensor`/`RemoteActuator` (proxyen einen
Sensor/Aktor eines anderen Knotens transparent über einen `ITransport&`),
`RemotePublisher` (veröffentlicht lokale Items automatisch: Meta retained
bei `attach()`, State zyklisch, Controller-Tuning eingehend über `/tune`).
Alle drei sind komplett transport-agnostisch. Topic-Schema
(`src/remote/Topics.h`, gilt für alle drei Transporte gleich):

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

Drei Zwei-Geräte-Beispiel-Sketches demonstrieren das Muster:
`examples/08_remote_mqtt/`, `09_remote_espnow/`, `10_remote_webhook/` (je
`publisher/` + `consumer/` + eigenem `README.md`).

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
