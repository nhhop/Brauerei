# SensActCtrl

ESP32-Library für Sensoren, Aktoren und Controller. Liefert generische
Primitive (Wert lesen, Aktor schalten, Zwei-Punkt/PID regeln, …) hinter
einer einheitlichen API — lokal über GPIO/I2C/OneWire oder remote über
MQTT/ESP-Now/Webhooks, transparent aus Sicht des Reglers. Domain-Logik
(z.B. Brauerei-Rasten, Aquaristik-Profile, Gewächshaus-Kurven) bleibt im
Anwender-Sketch oder einem aufsetzenden Projekt (etwa `BrewControll` für
Heim-/Hobbybrau).

> **Status:** Phase 1 (lokale Sensoren/Aktoren/Controller). Remote-Transport
> (MQTT, ESP-Now) ist Phase 2.

## Architektur in einem Bild

```
Sensor ──┐
         ├──► Controller ──► Actuator
Sensor ──┘        ▲
                  └── setSetpoint(), Tuning via paramsJson()
```

Alle drei Rollen werden in einer zentralen `Registry` registriert; das
Sketch ruft pro `loop()`-Durchlauf einmal `registry.tick()` — die Registry
ruft intern in fester Reihenfolge **Sensoren → Controller → Aktoren**.

## Klassifizierung

Sensoren und Aktoren werden in zwei orthogonalen Achsen beschrieben:

- **`ValueKind`** — mathematische Natur des Wertes
  (`Binary`, `Discrete`, `Continuous`, `Cumulative`).
- **`Quantity`** — physikalische Messgröße
  (`Temperature`, `Humidity`, `Pressure`, `pH`, `Volume`, `FlowRate`, …).

Beispiele:

| Gerät                          | Kind         | Quantity      | Unit     |
|--------------------------------|--------------|---------------|----------|
| DS18B20 Thermometer            | Continuous   | Temperature   | `°C`     |
| SSR-Heizer (Time-Proportional) | Continuous   | DutyCycle     | (0..1)   |
| Schalter / Relais              | Binary       | None          |          |
| Pulse-Counter (Total)          | Cumulative   | Volume        | `l`      |
| Hopfengabe-Dispenser           | Discrete     | Count         | `pulses` |

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

## Phase 1 — was bereits enthalten ist

Sensoren: `DigitalInputSensor`, `AnalogInputSensor`, `PulseCounterSensor`,
`DS18B20Sensor`, `BME280Sensor`.
Aktoren: `DigitalOutputActuator` (binär + time-proportional),
`PulseOutputActuator`.
Controller: `TwoPointController`, `PIDController` (intern AutoTunePID).

Beispiele liegen unter `examples/`. Native Unit-Tests unter `test/` (laufen
ohne Hardware via `pio test -e native`).

## Lizenz

MIT.
