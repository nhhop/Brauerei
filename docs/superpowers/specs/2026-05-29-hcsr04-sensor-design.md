# HC-SR04 Ultraschall-Sensor — Design-Spec

**Datum:** 2026-05-29  
**Scope:** SensActCtrl Library + BrewControl Firmware + Web-Frontend  
**Status:** Approved

---

## Ziel

`HCSR04Sensor` integriert den HC-SR04-Ultraschall-Distanzsensor in SensActCtrl als
Zwei-Kanal-Sensor. Kanal 0 liefert die rohe Distanz in cm. Kanal 1 liefert einen
optionalen abgeleiteten Wert via linearer Transformation `distance * factor + offset`
(z. B. Füllstand, Gewicht, Winkel).

---

## Architektur

### Neue Dateien

- `SensActCtrl/src/sensors/HCSR04Sensor.h`
- `SensActCtrl/src/sensors/HCSR04Sensor.cpp`
- `SensActCtrl/test/test_hcsr04/test_hcsr04.cpp`

### Geänderte Dateien

- `SensActCtrl/src/core/Quantity.h` — `Distance` zwischen `Count` und `Custom` einfügen
- `SensActCtrl/src/SensActCtrl.h` — `#include "sensors/HCSR04Sensor.h"` ergänzen
- `BrewControl/firmware/src/DynamicItems.cpp` — Factory-Branch für `"HCSR04"`
- `BrewControl/web/src/components/AddItemModal.tsx` — HCSR04-Formular
- `BrewControl/web/src/types.ts` — keine Änderung nötig (generisches Sensor-Interface)

---

## Interface

```cpp
namespace SensActCtrl {

class HCSR04Sensor : public Sensor {
 public:
  static constexpr uint32_t kIntervalMs = 60;   // ms zwischen Messungen
  static constexpr uint32_t kTimeoutMs  = 30;   // ms Echo-Timeout
  static constexpr int      kMaxSensors = 4;    // max gleichzeitige Instanzen

  HCSR04Sensor(const char* id, int trigPin, int echoPin);

  // Optionale lineare Transformation für Kanal 1.
  // derived = distance * factor + offset
  // unit:   Einheitenstring für Kanal 1 (z. B. "L", "kg", "°"). Default: "".
  // Solange nicht aufgerufen: channel(1).reading.valid == false.
  void setScale(float factor, float offset = 0.0f, const char* unit = "");
  // unit wird intern in einen char-Puffer kopiert (max 15 Zeichen + '\0').
  // Ermöglicht Aufrufe mit temporären Strings aus DynamicItems/ArduinoJson.

  const char* id()                const override { return id_; }
  size_t      channelCount()      const override { return 2; }
  Channel     channel(size_t idx) const override;

  void begin() override;
  void tick()  override;

  // Simuliert eine Echo-Flanke ohne Hardware (nur für Tests).
  void injectEchoForTest(uint32_t durationUs);

#ifndef ARDUINO
  static void resetForTest();
  // Schiebt g_millis um ms vorwärts — für Timeout-Tests.
  static void advanceMillisForTest(uint32_t ms);
#endif

 private:
  // ...
};

}  // namespace SensActCtrl
```

---

## Kanäle

| idx | key        | Quantity          | Unit               | ValueKind    | Bereich       |
|-----|------------|-------------------|--------------------|--------------|---------------|
| 0   | `distance` | `Quantity::Distance` | `"cm"`          | Continuous   | 2 – 400 cm    |
| 1   | `derived`  | `Quantity::Custom`   | via `setScale()` | Continuous   | `-∞` – `+∞`   |

`channel(1).reading.valid` ist `false`, bis `setScale()` aufgerufen wurde.  
`channel(1).meta.unit` ist `""` (leerer String), bis `setScale()` aufgerufen wurde.  
`channel(0).reading.valid` ist `false`, bis die erste erfolgreiche Messung abgeschlossen ist.

---

## Messprinzip (Interrupt-basiert)

Der HC-SR04 arbeitet mit einem Trigger-Puls (10 µs) und einem ECHO-Pin, dessen
HIGH-Dauer proportional zur Distanz ist: `distance_cm = duration_us / 58.0f`.

### State Machine

```
IDLE
 └─(tick(), kIntervalMs abgelaufen)
   ├─ TRIG HIGH, delayMicroseconds(10), TRIG LOW
   └─► TRIGGERED
         └─(ECHO-ISR, rising edge)
           ├─ startUs_ = micros()
           └─► MEASURING
                 └─(ECHO-ISR, falling edge)
                   ├─ durationUs_ = micros() - startUs_
                   └─► DONE
                         └─(nächster tick())
                           ├─ distance = durationUs_ / 58.0f
                           ├─ update rateReading_ (+ optional derivedReading_)
                           └─► IDLE

TRIGGERED oder MEASURING:
  └─(tick(), millis() - triggerMs_ > kTimeoutMs)
    ├─ reading.valid = false
    └─► IDLE
```

### ISR-Design

- Statischer Instance-Pool: `HCSR04Sensor* instances_[kMaxSensors]`
- Jeder Slot hat ein ISR-Trampolin (`isr0`…`isr3`), ruft `onEcho(idx)` auf
- ISR-Modus: `CHANGE` — ein einziger ISR pro Slot erkennt Rising/Falling via `digitalRead()`
- `begin()` belegt den nächsten freien Slot; gibt einen Fehler (kein Slot) still zurück

```cpp
// ISR-Handler (läuft im Interrupt-Kontext)
static void onEcho(int idx) {
  auto* self = instances_[idx];
  if (!self) return;
  if (digitalRead(self->echoPin_) == HIGH) {
    if (self->state_ == TRIGGERED) {
      self->startUs_ = micros();
      self->state_   = MEASURING;
    }
  } else {
    if (self->state_ == MEASURING) {
      self->durationUs_ = micros() - self->startUs_;
      self->state_      = DONE;
    }
  }
}
```

### Trigger-Puls

`delayMicroseconds(10)` in `tick()` ist akzeptabel — 10 µs Blocking hat keinen
messbaren Einfluss auf die Loop-Performance.

---

## Quantity::Distance

`Quantity.h` erhält einen neuen Eintrag:

```cpp
enum class Quantity : uint8_t {
  // ...
  Count,
  Distance,   // NEU
  Custom,
};
```

`toString()` ergänzt: `case Quantity::Distance: return "Distance";`

---

## Native Build Guard

```cpp
#if defined(ARDUINO)
  #include <Arduino.h>
#else
  static void     pinMode(int, int) {}
  static void     digitalWrite(int, int) {}
  static int      digitalRead(int) { return 0; }
  static void     delayMicroseconds(unsigned int) {}
  static void     attachInterrupt(int, void(*)(), int) {}
  static int      digitalPinToInterrupt(int p) { return p; }
  static uint32_t g_micros  = 0;
  static uint32_t g_millis  = 0;
  static uint32_t micros()  { return g_micros; }
  static uint32_t millis()  { return g_millis; }
  enum { INPUT = 0, OUTPUT = 1, HIGH = 1, LOW = 0, CHANGE = 3 };
#endif
```

`injectEchoForTest(uint32_t durationUs)` setzt `durationUs_` und `state_ = DONE`
direkt, ohne echten ISR. `resetForTest()` leert den Instance-Pool und setzt
`g_micros`/`g_millis` zurück auf 0. `advanceMillisForTest(ms)` addiert `ms` auf
`g_millis` — für deterministische Timeout-Tests. `g_millis` inkrementiert sich
im Stub **nicht** automatisch (anders als YF_S201), damit Tests volle Kontrolle
über das Timing haben.

---

## Tests (native)

Neues Test-Target: `SensActCtrl/test/test_hcsr04/test_hcsr04.cpp`

| Test | Beschreibung |
|------|-------------|
| `test_channel_count_and_keys` | `channelCount() == 2`, keys `"distance"` + `"derived"` |
| `test_channel_meta_distance` | Quantity::Distance, unit "cm", Continuous |
| `test_derived_invalid_without_scale` | `channel(1).reading.valid == false` vor `setScale()` |
| `test_readings_invalid_before_first_measurement` | beide Kanäle invalid nach `begin()` |
| `test_distance_calculates_correctly` | inject 580 µs → 10.0 cm |
| `test_derived_with_scale_and_offset` | `setScale(2.0f, 5.0f, "L")`, inject 580 µs → derived = 10*2+5 = 25 |
| `test_timeout_invalidates_reading` | State bleibt TRIGGERED, tick() nach kTimeoutMs → valid = false |
| `test_snapshot_channel_expansion` | JSON: `"tank.distance"` + `"tank.derived"` |

Gesamtzahl nativer Tests: 48 → 56 (8 neue Tests).

---

## BrewControl — DynamicItems

Neuer Factory-Branch in `addSensorNoBegin()`:

```json
POST /api/sensors
{ "type":"HCSR04", "id":"tank", "trig":5, "echo":18 }
// mit Skalierung:
{ "type":"HCSR04", "id":"tank", "trig":5, "echo":18,
  "factor":-0.785, "offset":100.0, "unit":"L" }
```

Validierung: `trig >= 0`, `echo >= 0`. `factor`/`offset`/`unit` optional.

---

## BrewControl — AddItemModal

`SensorType` um `'HCSR04'` erweitern.

Formular-Felder:
- **TRIG Pin** (Zahl, required)
- **ECHO Pin** (Zahl, required)
- **Faktor** (float, optional, Placeholder `1.0`)
- **Offset** (float, optional, Placeholder `0.0`)
- **Einheit** (Text, optional, Placeholder `"cm"`)

Die drei Skalierungs-Felder in einer aufklappbaren Sektion `"Ableitung (optional)"` —
analog zur Custom-SPI-Sektion im MAX31865-Formular.

---

## Rückwärtskompatibilität

- Alle bestehenden Sensor-Klassen sind unverändert.
- `Quantity::Distance` ist ein neuer Enum-Wert; `toString()` hat bereits einen
  `default`-Pfad → keine Compiler-Warnings.
- `RegistrySnapshot` serialisiert `Quantity::Distance` korrekt als `"Distance"`.
