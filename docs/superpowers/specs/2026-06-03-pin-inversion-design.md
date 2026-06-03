# PIN-Invertierung — Design

**Datum:** 2026-06-03
**Status:** Genehmigt (brainstorming)
**Scope:** Feature-Track Welle 1 — „PIN-Invertierung: Umkehren der digitalen Pin-Readings und Writings"

## Problem

Digitale Pins sollen invertierbar sein — sowohl Eingänge (z.B. Schalter gegen GND, active-low)
als auch Ausgänge (active-low SSR/Relais).

Die Library-Primitive **können das bereits**:
- `DigitalInputSensor(id, pin, pullup, invert, debounceMs)` — `invert` macht den logischen
  „on"-Zustand LOW.
- `DigitalOutputActuator(id, pin, mode, activeHigh)` — `activeHigh=false` treibt den Pin
  für den logischen „on"-Zustand LOW.

Aber: Der Firmware-DigitalOutput-Branch reicht `activeHigh` nicht durch, und es gibt **gar
keinen** DigitalInput-Sensortyp in Firmware-Factory + Web-UI. Die `inverted`-Checkbox, die
heute existiert, gehört zum TwoPoint-**Regler** (Logik-Umkehr), nicht zum Pin.

## Nicht-Ziele

- **Kein Library-Code.** Beide Primitive existieren und sind verhaltensgetestet. Keine neuen
  Library-Unit-Tests.
- Kein eigener Endpunkt — bestehende `POST /api/sensors` / `POST /api/actuators`.
- Kein eigenes Binär-Rendering in der SensorCard (zeigt den Wert als 0/1 — für v1 akzeptiert).
- Kein Debounce für den Aktor (nicht sinnvoll für Ausgänge).

## Designentscheidungen

### Wire-Key `invert` (nicht `inverted`)

Beide neuen Felder heißen `invert` (Boolean, Default `false`) → konsistentes „Pin
invertieren"-Modell, UI-Checkbox „Invertieren". Bewusst **nicht** `inverted` — dieser Key ist
beim TwoPoint-Regler für die Logik-Umkehr vergeben (anderes Konzept, andere Rolle).

Aktor-Mapping: `activeHigh = !invert`. Sensor-Mapping: `invert` direkt an den Konstruktor.

### Persistenz

`serializeJson(cfg, e->cfgJson)` speichert die POST-Config wörtlich; `serializeConfig()`
emittiert sie zurück. Neue Felder round-trippen damit automatisch über SD-Persistenz und
Edit (DELETE + POST) — keine Änderung an Store/Serialisierung nötig.

## Komponente 1 — DigitalInput-Sensor (neu)

### Wire-Format
```json
POST /api/sensors
{ "type":"DigitalInput", "id":"float_sw", "pin":15,
  "invert":false, "pullup":true, "debounce_ms":50 }
```
Pflichtfeld: `pin`. Optional mit Defaults: `invert=false`, `pullup=false`, `debounce_ms=0`.

### Firmware — `DynamicItems.cpp::addSensorNoBegin`
Neuer Branch (nach dem HX711-Branch, vor dem `else { unknown }`):
```cpp
} else if (strcmp(type, "DigitalInput") == 0) {
  int pin = cfg["pin"] | -1;
  if (pin < 0) return {false, "missing pin"};
  bool pullup       = cfg["pullup"]      | false;
  bool invert       = cfg["invert"]      | false;
  uint32_t debounce = cfg["debounce_ms"] | 0u;
  e->ptr = std::make_unique<DigitalInputSensor>(
      e->id.c_str(), pin, pullup, invert, debounce);
}
```
`DigitalInputSensor.h` ist bereits über `SensActCtrl.h` verfügbar — kein neuer Include.

### Web — `AddItemModal.tsx`
- `SensorType` um `'DigitalInput'` erweitern.
- Sensortyp-Dropdown: neue `<optgroup label="Digital / Schalter">` mit
  `<option value="DigitalInput">Digitaler Eingang (GPIO)</option>`.
- Neues Formular (analog bestehender Sensor-Formulare), sichtbar wenn
  `role === 'sensor' && sensorType === 'DigitalInput'`:
  - Pin (number)
  - „Invertieren" (checkbox → `invert`)
  - „Pullup aktivieren" (checkbox → `pullup`)
  - „Entprellung (ms)" (number, 0 = aus → `debounce_ms`)
- Submit baut `cfg = { type:'DigitalInput', id, pin, invert, pullup, debounce_ms }`.
- Edit-Preload: Felder aus `editConfig` vorbelegen (`invert`/`pullup` via `Boolean(...)`,
  `debounce_ms` als Zahl).
- Reset-Defaults beim Öffnen analog zu den anderen Sensortypen.

## Komponente 2 — DigitalOutput-Aktor: Invertierung

### Wire-Format
```json
POST /api/actuators
{ "type":"DigitalOutput", "id":"ssr", "pin":2, "mode":"Binary", "invert":true }
```
Neues optionales Feld `invert` (Default `false`). Rückwärtskompatibel — fehlt das Feld,
verhält sich der Aktor wie bisher (`activeHigh=true`).

### Firmware — `DynamicItems.cpp::addActuatorNoBegin` (DigitalOutput-Branch)
```cpp
bool invert = cfg["invert"] | false;
auto* a = new DigitalOutputActuator(e->id.c_str(), pin, mode, /*activeHigh=*/!invert);
```
(ersetzt die bisherige 3-Arg-Konstruktion; `setPeriodMs`-Zweig unverändert.)

### Web — `AddItemModal.tsx`
- Neue „Invertieren (active-low)"-Checkbox im DigitalOutput-Formular.
- Submit ergänzt `invert` in der DigitalOutput-`cfg`.
- Edit-Preload: `setInvertOut(Boolean(editConfig.invert ?? false))` im DigitalOutput-Edit-Zweig.
- Eigener State (z.B. `invertOut`) — **nicht** der bestehende `inverted`-State (TwoPoint-Regler)
  wiederverwenden, um Konzept-Vermischung zu vermeiden.

## Verifikation (Erfolgskriterien)

| Check | Erwartung |
|---|---|
| `pio run -e esp32dev` (firmware) | SUCCESS |
| `pnpm typecheck` (web) | 0 Fehler |
| DigitalInput per UI anlegbar, erscheint als Karte | manuell / E2E |
| DigitalOutput mit `invert:true` togglet Pin invertiert | E2E am Gerät (optional) |
| Edit eines DigitalInput/DigitalOutput erhält invert/pullup/debounce | manuell |

## Betroffene Dateien

- `BrewControl/firmware/src/DynamicItems.cpp` — 1 neuer Sensor-Branch, 1 Zeile im Aktor-Branch
- `BrewControl/web/src/components/AddItemModal.tsx` — SensorType, optgroup, 2 Formulare,
  Submit-Logik, Edit-Preload, neuer `invertOut`-State
- (keine Library-Dateien)
