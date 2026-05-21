# Design: Multi-Channel Sensor Interface + YF-S201

Datum: 2026-05-21  
Scope: SensActCtrl (Library) + BrewControl (Firmware + Web)

## Motivation

Das bisherige `Sensor`-Interface liefert genau einen `float`-Wert (`Reading`) pro Instanz.
Sensoren wie der YF-S201 (Durchfluss + Gesamtvolumen), der DHT-11 (Temperatur + Luftfeuchtigkeit)
oder der MPU-6050 (Gyro + Accelerometer) messen mehrere physikalische Größen gleichzeitig.
Die saubere Lösung ist keine Sonder-Abstraktion, sondern ein generalisiertes Interface:
**jeder Sensor gibt beliebig viele Kanäle zurück**.

## Architektur-Änderung: `Sensor`-Interface

### Neues `Channel`-Struct (`SensActCtrl/src/core/Channel.h`)

```cpp
struct Channel {
    const char* key;    // "" → ID des Kanals = Sensor-ID
                        // "rate" → ID wird "sensorid.rate"
    SensorMeta  meta;   // Quantity, unit, min/max/resolution
    Reading     reading; // value, timestampMs, valid
};
```

`Channel` ist ein kleines POD-Struct (alle Member werttypen / `const char*`-Pointer auf
String-Literale). Kopieren per Value ist auf Embedded-Targets unbedenklich.

### Geändertes `Sensor`-Interface (`SensActCtrl/src/core/Sensor.h`)

```cpp
class Sensor {
public:
    virtual ~Sensor() = default;

    virtual const char* id()                const = 0;
    virtual size_t      channelCount()      const = 0;
    virtual Channel     channel(size_t idx) const = 0;

    virtual void begin() {}
    virtual void end()   {}
    virtual void tick()  = 0;
};
```

Entfernt: `meta()`, `lastReading()`, `read()`.  
Alle Downstream-Konsumenten (RegistrySnapshot, Tests) nutzen `channel(idx)`.

## Adaption bestehender Single-Channel-Sensoren

Alle sechs bestehenden Sensor-Klassen (DS18B20, MAX31865, BME280, AnalogInput,
DigitalInput, PulseCounter) implementieren das neue Interface mit einem Kanal:

```cpp
size_t  channelCount()      const override { return 1; }
Channel channel(size_t)     const override { return {"", meta_, last_}; }
```

`meta_` und `last_` sind bereits als Member vorhanden — nur der Return-Pfad ändert sich.
Die Methoden `meta()` und `lastReading()` werden **entfernt**.

## Neue Klasse: `YF_S201Sensor`

Datei: `SensActCtrl/src/sensors/YF_S201Sensor.{h,cpp}`

### Kalibrierung

Der YF-S201 erzeugt 7,5 Impulse pro Sekunde je L/min Durchfluss:

- Durchflussrate: `Hz / 7.5` → L/min
- Gesamtvolumen: Impulse akkumulieren → `count / 450` → Liter
  (7,5 Hz × 60 s = 450 Impulse pro Liter bei 1 L/min)

Kalibrierungskonstante `kHzPerLiterPerMin = 7.5f` (Impulse/s je L/min) ist als
`static constexpr` definiert und kann per `setCalibration(float)` überschrieben werden.
Daraus abgeleitet: Impulse pro Liter = `kHzPerLiterPerMin × 60 = 450`.

### ISR-Sharing per statischem Pin-Pool

Mehrere Instanzen auf demselben physischen Pin (z. B. Rate-Sensor + Volume-Sensor in
Zukunft, oder Tests) teilen einen gemeinsamen Zähler:

```cpp
struct PinState {
    int pin = -1;
    volatile uint32_t count = 0;
};
static PinState pinStates_[kMaxPins];  // kMaxPins = 4
static int      pinStateCount_;
```

`begin()` sucht einen bestehenden `PinState` für den Pin und hängt keinen zweiten ISR
ein, wenn der Pin bereits registriert ist. Trampolin-Logik identisch zu `PulseCounterSensor`.

### Interface

```cpp
class YF_S201Sensor : public Sensor {
public:
    YF_S201Sensor(const char* id, int pin);

    const char* id()                const override { return id_; }
    size_t      channelCount()      const override { return 2; }
    Channel     channel(size_t idx) const override;

    void begin() override;
    void tick()  override;

    void setCalibration(float pulsesPerLiterMin);
    void resetVolume();   // Gesamtvolumen auf 0 zurücksetzen
    uint32_t rawCount() const;
};
```

`channel(0)` → `"rate"`, `FlowRate`, `"L/min"`  
`channel(1)` → `"volume"`, `Volume`, `"L"`, `ValueKind::Cumulative`

### Native-Build-Guard

Identisch zu MAX31865: `#ifndef ARDUINO`-Block mit Stubs für `pinMode`, `millis`,
`attachInterrupt`, `digitalPinToInterrupt`.

## RegistrySnapshot — Kanal-Iteration

`RegistrySnapshot::serialize()` wechselt von Sensor-Iteration zu Kanal-Iteration:

```
für jeden Sensor s in registry:
    für idx = 0 .. s.channelCount()-1:
        key = s.channel(idx).key
        id  = (key[0] == '\0') ? s.id() : (s.id() + "." + key)
        emit JSON-Objekt {id, quantity, unit, value, valid, ts}
```

**Wire-Format-Auswirkung:**
- Single-Channel-Sensoren (key `""`): JSON-Shape identisch zu heute — keine
  Frontend-Änderung für Bestandsdaten.
- `YF_S201Sensor`: liefert zwei JSON-Objekte `"flow.rate"` und `"flow.volume"`.

## BrewControl — Firmware

### DynamicItems

Neuer Factory-Branch für `"YF-S201"` in `addSensorNoBegin()`:

```json
POST /api/sensors
{ "type": "YF-S201", "id": "flow", "pin": 4 }
```

Felder: `id` (string), `pin` (int ≥ 0). Optional: `calibration` (float, Impulse pro
Liter·Minute, default 7.5).

Validierung: `pin >= 0`. Kein `mode`-Feld — der Sensor liefert immer beide Kanäle.

Ein `POST /api/sensors {"type":"YF-S201","id":"flow","pin":4}` registriert einen Sensor
der im SSE-Stream als `flow.rate` und `flow.volume` erscheint.

### Reset-Endpunkt

`POST /api/sensors/:id/reset` — setzt das Gesamtvolumen zurück (nützlich für
Befüll-Use-Case: neues Guss-Volumen abmessen). `:id` ist die Sensor-ID wie beim POST
registriert (z. B. `"flow"`), nicht die Kanal-ID (`"flow.volume"`). Der Sensor muss
`resetVolume()` exponieren; DynamicItems verwaltet den Zeiger auf die
`YF_S201Sensor`-Instanz separat vom generischen `Sensor*`.

## BrewControl — Web-Frontend

### `types.ts`

`Sensor`-Shape bleibt identisch (flat: `{id, quantity, unit, value, valid, ts}`).
Keine Änderung nötig — der Serializer expandiert Kanäle auf dieselbe Form.

### `AddItemModal.tsx`

Neuer Sensor-Typ `"YF-S201"` in der `<optgroup>`-Auswahl.  
Formular: nur **Pin**-Feld (+ optionale Kalibrierung). Kein Modus-Toggle —
beide Kanäle sind immer aktiv.

### `api.ts`

Neuer Aufruf `resetFlowVolume(id: string)` → `POST /api/sensors/:id/reset`.

### `SensorCard.tsx`

Keine Änderung — `flow.rate` und `flow.volume` erscheinen als zwei separate Karten
wie jeder andere Sensor.

## Tests

### Native Tests (SensActCtrl)

- Alle bestehenden Tests anpassen: `sensor.lastReading()` → `sensor.channel(0).reading`,
  `sensor.meta()` → `sensor.channel(0).meta`
- 3 neue Tests für `YF_S201Sensor`:
  - `test_yf_s201_meta`: channelCount=2, keys "rate"/"volume", korrekte Quantities
  - `test_yf_s201_rate`: Impulse injizieren → korrekte L/min-Berechnung
  - `test_yf_s201_volume`: Impulse injizieren → korrekte Liter-Akkumulation + resetVolume()

### Gesamtzahl nativer Tests: 34 → 37

## Offene Punkte / Entscheidungen

- `resetVolume()` via Web-UI: der Reset-Endpunkt ist im Design enthalten. UI-Trigger
  (Button auf SensorCard) ist bewusst aus dem Scope gelassen — kann in einer Folge-Session
  ergänzt werden.
- Kalibrierung: 7.5 Hz/L·min entspricht dem YF-S201-Datenblatt. Abweichungen zwischen
  Exemplaren (~±10 %) können per `calibration`-Feld bei der dynamischen Registrierung
  korrigiert werden.
- BME280: kann in einer Folge-Session auf 3 Kanäle (Temperatur, Luftfeuchtigkeit, Druck)
  umgestellt werden — die neue Interface-Architektur unterstützt das ohne weiteren
  Library-Umbau.
