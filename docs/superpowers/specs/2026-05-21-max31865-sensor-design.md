# Design: MAX31865 PT100/PT1000 Sensor + AddItemModal Redesign

**Datum:** 2026-05-21  
**Scope:** SensActCtrl Library + BrewControl Firmware + BrewControl Web

---

## Kontext

BrewControl unterstützt bisher nur DS18B20 (OneWire) als dynamisch hinzufügbaren Temperatursensor. Der MAX31865 ist ein SPI-Chip für PT100/PT1000 RTD-Sensoren — präziser als DS18B20 und in der Brauerei für Hochtemperaturmessungen üblich.

Mit zwei konfigurierbaren Sensortypen wird der "Add Item"-Dialog generisch genug, dass er künftige Typen (BME280, AnalogInput, …) aufnehmen kann, ohne jedes Mal neu entworfen zu werden.

---

## 1. SensActCtrl Library

### 1.1 Neue Klasse `MAX31865Sensor`

**Dateien:** `src/sensors/MAX31865Sensor.h`, `src/sensors/MAX31865Sensor.cpp`

**Schnittstelle:**

```cpp
namespace SensActCtrl {

class MAX31865Sensor : public Sensor {
 public:
  enum class Wires   : uint8_t { Two = 2, Three = 3, Four = 4 };
  enum class RtdType : uint8_t { PT100, PT1000 };

  // Hardware-SPI: CLK/MISO/MOSI = ESP32-VSPI-Defaults
  MAX31865Sensor(const char* id, int csPin,
                 Wires wires, RtdType rtd, float rref);

  // Software-SPI: alle 4 Pins explizit
  MAX31865Sensor(const char* id, int csPin, int clkPin, int misoPin, int mosiPin,
                 Wires wires, RtdType rtd, float rref);

  const char* id()            const override;
  SensorMeta  meta()          const override; // Temperature, "°C", -200..850, res=0.03125
  void        begin()         override;       // max_.begin(wires)
  void        tick()          override;       // readRTD → temperature(), Fault-Check
  Reading     lastReading()   const override;
};

} // namespace SensActCtrl
```

**Implementierungsdetails:**

- Forward-Deklaration von `Adafruit_MAX31865` im Header (kein Pull von Adafruit-Headern in den Umbrella-Include).
- `tick()` liest synchron: `max_.readRTD()` + `max_.temperature(rnominal, rref_)`. Kein State-Machine nötig — SPI-Read dauert ~1 ms, tolerierbar im Arduino loop.
- Fault-Handling: `max_.readFault()` nach jeder Messung; bei Fault → `Reading{NaN, millis(), false}` + `max_.clearFault()`.
- `rnominal`: 100.0 für PT100, 1000.0 für PT1000 (abgeleitet aus `RtdType`).
- **Native-Stub:** `begin()` und `tick()` sind No-Ops via `#ifndef ARDUINO`-Guard; `lastReading()` gibt `{NaN, 0, false}` zurück. Damit bleiben native Unit-Tests kompilierbar.

### 1.2 `library.json` — neue Abhängigkeit

```json
{
  "name": "Adafruit MAX31865 library",
  "owner": "adafruit",
  "version": "^1.2.0"
}
```

`Adafruit BusIO` ist bereits als Dep eingetragen.

### 1.3 Umbrella-Header `SensActCtrl.h`

`MAX31865Sensor.h` in den Umbrella-Include aufnehmen (analog DS18B20Sensor.h).

---

## 2. BrewControl Firmware

### 2.1 Wire-Format (POST /api/sensors)

```json
{
  "type":  "MAX31865",
  "id":    "boil_temp",
  "cs":    5,
  "wires": 3,
  "rtd":   "PT100",
  "rref":  430.0
}
```

Custom-SPI-Pins optional — nur wenn `clk` gesetzt, werden auch `miso` und `mosi` erwartet:

```json
{ "type": "MAX31865", "id": "boil_temp", "cs": 5,
  "clk": 14, "miso": 12, "mosi": 13,
  "wires": 3, "rtd": "PT100", "rref": 430.0 }
```

### 2.2 `DynamicItems.cpp` — Factory-Erweiterung

Neuer Branch in `addSensorNoBegin()` nach dem DS18B20-Zweig:

```cpp
} else if (strcmp(type, "MAX31865") == 0) {
  int cs = cfg["cs"] | -1;
  if (cs < 0) return {false, "missing cs"};

  int wires = cfg["wires"] | 2;
  if (wires < 2 || wires > 4) return {false, "invalid wires (2/3/4)"};

  const char* rtdStr = cfg["rtd"] | "PT100";
  auto rtd = strcmp(rtdStr, "PT1000") == 0
               ? MAX31865Sensor::RtdType::PT1000
               : MAX31865Sensor::RtdType::PT100;

  float defaultRref = (rtd == MAX31865Sensor::RtdType::PT100) ? 430.0f : 4300.0f;
  float rref = cfg["rref"] | defaultRref;

  auto wiresEnum = wires == 3 ? MAX31865Sensor::Wires::Three
                 : wires == 4 ? MAX31865Sensor::Wires::Four
                              : MAX31865Sensor::Wires::Two;

  int clk = cfg["clk"] | -1;
  if (clk >= 0) {
    int miso = cfg["miso"] | -1, mosi = cfg["mosi"] | -1;
    if (miso < 0 || mosi < 0) return {false, "clk set but miso/mosi missing"};
    e->ptr = std::make_unique<MAX31865Sensor>(
        e->id.c_str(), cs, clk, miso, mosi, wiresEnum, rtd, rref);
  } else {
    e->ptr = std::make_unique<MAX31865Sensor>(
        e->id.c_str(), cs, wiresEnum, rtd, rref);
  }
```

**Kein `DynamicItems.h`-Änderungsbedarf.** MAX31865 ist ein weiterer `SensorEntry`; SD-Persistenz und Remove-Logik funktionieren unverändert.

### 2.3 `DynamicItems.h` — kein neuer Include nötig

`DynamicItems.h` inkludiert bereits `<SensActCtrl.h>`. Sobald `MAX31865Sensor.h` in den Umbrella-Header aufgenommen wird (Schritt 1.3), ist die Klasse automatisch sichtbar.

---

## 3. BrewControl Web

### 3.1 `AddItemModal.tsx` — Redesign

**Strukturänderung:** Wenn Role = `'sensor'`, erscheint ein Sensor-Typ-Dropdown mit `<optgroup>`-Gruppen als erste Pflichtauswahl — bevor die typspezifischen Felder gerendert werden.

**Neuer State:**

```ts
const [sensorType, setSensorType] = useState<'DS18B20' | 'MAX31865'>('DS18B20');
// MAX31865-spezifisch:
const [csPin,     setCsPin]     = useState('');
const [wiresCount, setWiresCount] = useState<2|3|4>(2);
const [rtdType,   setRtdType]   = useState<'PT100'|'PT1000'>('PT100');
const [rref,      setRref]      = useState('430');
const [rrefTouched, setRrefTouched] = useState(false);
const [clkPin,    setClkPin]    = useState('');
const [misoPin,   setMisoPin]   = useState('');
const [mosiPin,   setMosiPin]   = useState('');
```

Reset beim Modal-Öffnen (`useEffect` auf `open`) setzt alle neuen States auf Defaults.

**Dropdown (wenn role === 'sensor'):**

```tsx
<select value={sensorType} onChange={e => setSensorType(e.target.value)}>
  <optgroup label="Temperatur">
    <option value="DS18B20">DS18B20 (OneWire)</option>
    <option value="MAX31865">MAX31865 (PT100/PT1000, SPI)</option>
  </optgroup>
  <optgroup label="Feuchte / Druck">
    <option disabled>BME280 (I²C)</option>
  </optgroup>
  <optgroup label="Analog / Digital">
    <option disabled>AnalogInput</option>
    <option disabled>DigitalInput</option>
  </optgroup>
  <optgroup label="Durchfluss">
    <option disabled>PulseCounter</option>
  </optgroup>
</select>
```

**MAX31865-Formularfelder:**

| Feld | Typ | Pflicht | Default |
|------|-----|---------|---------|
| CS Pin | number | ja | — |
| Wires | Segment-Buttons [2] [3] [4] | ja | 2 |
| RTD | Segment-Buttons [PT100] [PT1000] | ja | PT100 |
| Rref (Ω) | number | ja | 430 (PT100) / 4300 (PT1000), editierbar |
| Custom SPI (▶) | aufklappbar | nein | eingeklappt |
| └ CLK Pin | number | nein | — |
| └ MISO Pin | number | nein | — |
| └ MOSI Pin | number | nein | — |

**Rref Auto-Fill-Logik:** Wechselt der User PT100↔PT1000, springt Rref auf den neuen Default — aber nur wenn `rrefTouched === false`. Sobald der User den Rref-Wert manuell ändert, wird `rrefTouched = true` gesetzt und Auto-Fill deaktiviert.

**Validierung vor Submit:**

- `csPin` nicht leer und gültige Zahl
- Wenn `clkPin` gesetzt: `misoPin` und `mosiPin` ebenfalls gesetzt
- `rref > 0`

**`createSensor()`-Aufruf (MAX31865):**

```ts
await createSensor({
  type: 'MAX31865', id: trimId,
  cs: parseInt(csPin),
  wires: wiresCount,
  rtd: rtdType,
  rref: parseFloat(rref),
  ...(clkPin ? { clk: parseInt(clkPin), miso: parseInt(misoPin), mosi: parseInt(mosiPin) } : {}),
});
```

### 3.2 `types.ts` — keine Änderung

Der Snapshot-Shape ändert sich nicht. `SensorCard` rendert MAX31865 identisch zum DS18B20 (beide: `quantity: "Temperature"`, `unit: "°C"`).

### 3.3 `api.ts` — keine Änderung

`createSensor(cfg)` sendet das cfg-Objekt direkt als JSON-Body. Das funktioniert für beide Typen ohne Umbau.

---

## 4. Testing

### Unit-Tests (native, SensActCtrl)

- `MAX31865Sensor` kompiliert im native-Build (No-Op-Stub)
- `lastReading()` vor `begin()` gibt `{NaN, 0, false}` zurück (gleich wie DS18B20)
- Kein Hardware-Test möglich ohne echten Chip

### Compile-Smoke (BrewControl)

- `pio run -e esp32dev` muss grün sein nach allen Änderungen
- `pnpm typecheck` für das Frontend

### Manuelle E2E (mit Hardware)

- MAX31865-Breakout an ESP32 anschließen (CS, CLK, MISO, MOSI oder HW-SPI)
- `POST /api/sensors` mit MAX31865-Config → 204
- Snapshot zeigt neuen Sensor mit gültigem Temperaturwert
- Nach Reboot: Sensor aus SD geladen, Wert weiterhin gültig

---

## 5. Nicht in Scope

- Andere Sensortypen (BME280, AnalogInput, PulseCounter) als dynamische Factory-Typen — im Dropdown als `disabled` vorgemerkt
- Kalibrierung / Offset-Korrektur für PT100/PT1000
- Mehrere MAX31865 am selben Custom-SPI-Bus (jeder Sensor hat eigene Adafruit_MAX31865-Instanz mit eigenem CS)
