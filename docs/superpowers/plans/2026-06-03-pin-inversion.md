# PIN-Invertierung Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Digitale Pin-Invertierung für Eingänge (`DigitalInput`-Sensor neu) und Ausgänge (`DigitalOutput`-Aktor, `invert`-Flag) durch Firmware-Factory + Web-UI verdrahten.

**Architecture:** Kein Library-Code — `DigitalInputSensor(invert, pullup, debounce)` und `DigitalOutputActuator(activeHigh)` existieren bereits. Einzige Arbeit: Firmware-Factory-Branch ergänzen, Web-Formulare + State + Submit + Edit-Preload ergänzen. Persistenz funktioniert automatisch via `serializeJson(cfg, e->cfgJson)`.

**Tech Stack:** C++17 / ArduinoJson 7 (Firmware), Preact 10 / TypeScript 5 (Web), PlatformIO native (kein Library-Test nötig).

---

### Task 1: Firmware — DigitalInput-Branch + DigitalOutput-Invert

**Files:**
- Modify: `BrewControl/firmware/src/DynamicItems.cpp`

- [ ] **Schritt 1: DigitalInput-Branch einfügen**

  In `addSensorNoBegin()`, direkt vor der `} else {`-Zeile (die „unknown sensor type" zurückgibt, nach dem HX711-Block, aktuell ~Zeile 100):

  ```cpp
    } else if (strcmp(type, "DigitalInput") == 0) {
      int pin = cfg["pin"] | -1;
      if (pin < 0) return {false, "missing pin"};
      bool pullup       = cfg["pullup"]      | false;
      bool invert       = cfg["invert"]      | false;
      uint32_t debounce = cfg["debounce_ms"] | 0u;
      e->ptr = std::make_unique<DigitalInputSensor>(
          e->id.c_str(), pin, pullup, invert, debounce);
  ```

  Der vollständige Block danach bleibt unverändert:
  ```cpp
    } else {
      return {false, "unknown sensor type"};
    }
  ```

- [ ] **Schritt 2: DigitalOutput-Invert verdrahten**

  In `addActuatorNoBegin()`, im DigitalOutput-Branch (aktuell ~Zeile 148), diese Zeile:
  ```cpp
      auto* a = new DigitalOutputActuator(e->id.c_str(), pin, mode);
  ```
  ersetzen durch:
  ```cpp
      bool invert = cfg["invert"] | false;
      auto* a = new DigitalOutputActuator(e->id.c_str(), pin, mode, /*activeHigh=*/!invert);
  ```

- [ ] **Schritt 3: Firmware kompilieren**

  ```powershell
  cd BrewControl/firmware
  pio run -e esp32dev
  ```
  Erwartung: `SUCCESS` — keine Fehler oder Warnungen.

- [ ] **Schritt 4: Commit**

  ```bash
  git add BrewControl/firmware/src/DynamicItems.cpp
  git commit -m "feat(fw): DigitalInput sensor factory + DigitalOutput invert pass-through"
  ```

---

### Task 2: Web — DigitalInput-Sensor (AddItemModal)

**Files:**
- Modify: `BrewControl/web/src/components/AddItemModal.tsx`

- [ ] **Schritt 1: SensorType um `'DigitalInput'` erweitern**

  Zeile 10, aktuelle Zeile:
  ```tsx
  type SensorType = 'DS18B20' | 'MAX31865' | 'YF-S201' | 'BME280' | 'HCSR04' | 'HX711';
  ```
  ersetzen durch:
  ```tsx
  type SensorType = 'DS18B20' | 'MAX31865' | 'YF-S201' | 'BME280' | 'HCSR04' | 'HX711' | 'DigitalInput';
  ```

- [ ] **Schritt 2: Vier neue States hinzufügen**

  Nach der `hx711Scale`-State-Deklaration (~Zeile 58), vier neue States einfügen:
  ```tsx
    // DigitalInput
    const [diPin, setDiPin] = useState('');
    const [diInvert, setDiInvert] = useState(false);
    const [diPullup, setDiPullup] = useState(false);
    const [diDebounce, setDiDebounce] = useState('0');
  ```

- [ ] **Schritt 3: Optgroup im Sensortyp-Dropdown ergänzen**

  Nach dem letzten `</optgroup>` (Gewicht/HX711, ~Zeile 446), vor dem schließenden `</select>`:
  ```tsx
                <optgroup label="Digital / Schalter">
                  <option value="DigitalInput">Digitaler Eingang (GPIO)</option>
                </optgroup>
  ```

- [ ] **Schritt 4: Edit-Preload-Branch ergänzen**

  Im `useEffect`, im Sensor-Edit-Zweig, nach dem HCSR04-Zweig (`} else if (t === 'HCSR04') { ... }`), direkt vor der schließenden `}` des `if (editRole === 'sensor')`:
  ```tsx
          } else if (t === 'DigitalInput') {
            setDiPin(String(editConfig.pin ?? ''));
            setDiInvert(Boolean(editConfig.invert ?? false));
            setDiPullup(Boolean(editConfig.pullup ?? false));
            setDiDebounce(String(editConfig.debounce_ms ?? '0'));
          }
  ```

- [ ] **Schritt 5: Reset-Defaults ergänzen**

  Im `else`-Zweig (neues Item, ~Zeile 208), nach der `setHx711Scale('');`-Zeile:
  ```tsx
        setDiPin(''); setDiInvert(false); setDiPullup(false); setDiDebounce('0');
  ```

- [ ] **Schritt 6: Submit-Logik ergänzen**

  In `handleSubmit()`, im Sensor-Zweig, nach dem HX711-Block (`} else if (sensorType === 'HX711') { ... }`), direkt vor dem `} else { // HCSR04`:
  ```tsx
          } else if (sensorType === 'DigitalInput') {
            const p = parseInt(diPin, 10);
            if (isNaN(p) || p < 0) throw new Error('Pin ungültig');
            cfg = {
              type: 'DigitalInput', id: trimId, pin: p,
              invert: diInvert, pullup: diPullup,
              debounce_ms: parseInt(diDebounce, 10) || 0,
            };
  ```

- [ ] **Schritt 7: Formular-JSX einfügen**

  Nach dem schließenden `)}` des HX711-Felder-Blocks (~Zeile 634), vor dem `{/* HCSR04 fields */}`-Kommentar:
  ```tsx
          {/* DigitalInput fields */}
          {role === 'sensor' && sensorType === 'DigitalInput' && (
            <div class="space-y-3">
              <div>
                <label class={lbl}>GPIO Pin</label>
                <input type="number" value={diPin}
                  onInput={(e) => setDiPin((e.target as HTMLInputElement).value)}
                  placeholder="z.B. 15" class={inp} required />
              </div>
              <div class="flex gap-4">
                <label class="flex items-center gap-2 text-sm text-fg cursor-pointer">
                  <input type="checkbox" checked={diInvert}
                    onChange={(e) => setDiInvert((e.target as HTMLInputElement).checked)} />
                  Invertieren
                </label>
                <label class="flex items-center gap-2 text-sm text-fg cursor-pointer">
                  <input type="checkbox" checked={diPullup}
                    onChange={(e) => setDiPullup((e.target as HTMLInputElement).checked)} />
                  Pullup aktivieren
                </label>
              </div>
              <div>
                <label class={lbl}>Entprellung (ms)</label>
                <input type="number" value={diDebounce} min="0"
                  onInput={(e) => setDiDebounce((e.target as HTMLInputElement).value)}
                  placeholder="0 = aus" class={inp} />
              </div>
            </div>
          )}
  ```

- [ ] **Schritt 8: TypeScript prüfen**

  ```powershell
  cd BrewControl/web
  pnpm typecheck
  ```
  Erwartung: `0 Fehler`.

- [ ] **Schritt 9: Commit**

  ```bash
  git add BrewControl/web/src/components/AddItemModal.tsx
  git commit -m "feat(web): DigitalInput Sensor — optgroup, Formular, Submit, Edit-Preload"
  ```

---

### Task 3: Web — DigitalOutput-Invert-Checkbox (AddItemModal)

**Files:**
- Modify: `BrewControl/web/src/components/AddItemModal.tsx`

- [ ] **Schritt 1: `invertOut`-State hinzufügen**

  Nach der `analogUnit`-State-Deklaration (~Zeile 82), neuen State einfügen:
  ```tsx
    const [invertOut, setInvertOut] = useState(false);
  ```

- [ ] **Schritt 2: Edit-Preload im DigitalOutput-Zweig ergänzen**

  Im `useEffect`, im Actuator-Edit-Zweig, DigitalOutput-Block (~Zeile 156-158):

  Aktuell:
  ```tsx
          if (t === 'DigitalOutput') {
            setPin(String(editConfig.pin ?? ''));
            setMode((editConfig.mode ?? 'Binary') as 'Binary' | 'TimeProportional');
  ```
  Ändern zu:
  ```tsx
          if (t === 'DigitalOutput') {
            setPin(String(editConfig.pin ?? ''));
            setMode((editConfig.mode ?? 'Binary') as 'Binary' | 'TimeProportional');
            setInvertOut(Boolean(editConfig.invert ?? false));
  ```

- [ ] **Schritt 3: Reset-Default ergänzen**

  Im `else`-Zweig (neues Item), nach der `setMode('TimeProportional');`-Zeile (~Zeile 218):
  ```tsx
        setInvertOut(false);
  ```

- [ ] **Schritt 4: Submit-Logik im DigitalOutput-Zweig aktualisieren**

  In `handleSubmit()`, im DigitalOutput-Submit-Zweig (~Zeile 324):

  Aktuell:
  ```tsx
            cfg = { type: 'DigitalOutput', id: trimId, pin: p, mode };
  ```
  Ändern zu:
  ```tsx
            cfg = { type: 'DigitalOutput', id: trimId, pin: p, mode, invert: invertOut };
  ```

- [ ] **Schritt 5: Checkbox ins DigitalOutput-Formular einfügen**

  Im JSX-Block `{/* DigitalOutput fields */}` (~Zeile 702-721), nach dem Mode-`<select>`-Block und vor dem schließenden `</>`:

  Aktuell endet der Block mit:
  ```tsx
              </div>
            </>
          )}
  ```
  Einfügen vor `</>`:
  ```tsx
              <label class="flex items-center gap-2 text-sm text-fg cursor-pointer">
                <input type="checkbox" checked={invertOut}
                  onChange={(e) => setInvertOut((e.target as HTMLInputElement).checked)} />
                Invertieren (active-low)
              </label>
  ```

- [ ] **Schritt 6: TypeScript prüfen**

  ```powershell
  cd BrewControl/web
  pnpm typecheck
  ```
  Erwartung: `0 Fehler`.

- [ ] **Schritt 7: Commit**

  ```bash
  git add BrewControl/web/src/components/AddItemModal.tsx
  git commit -m "feat(web): DigitalOutput Invert-Checkbox (active-low)"
  ```

---

### Task 4: Abschluss-Verifikation

**Files:** keine neuen Änderungen.

- [ ] **Schritt 1: Firmware nochmals kompilieren (alle drei Boards)**

  ```powershell
  cd BrewControl/firmware
  pio run -e esp32dev
  pio run -e lolin_s2_mini
  pio run -e lilygo_t_display_s3_amoled
  ```
  Erwartung: alle drei `SUCCESS`.

- [ ] **Schritt 2: Web TypeScript nochmals prüfen**

  ```powershell
  cd BrewControl/web
  pnpm typecheck
  ```
  Erwartung: `0 Fehler`.

- [ ] **Schritt 3: SESSION.md aktualisieren**

  In `SESSION.md` (Root), neuen Eintrag unten anhängen:

  ```markdown
  ## 2026-06-03 — PIN-Invertierung

  **Scope:** Feature-Track Welle 1. Kein Library-Code — beide Primitive (`DigitalInputSensor`,
  `DigitalOutputActuator`) waren bereits fertig.

  ### DigitalInput-Sensor (neu in Factory + UI)
  - `DynamicItems.cpp`: neuer Branch `"DigitalInput"` — liest `pin` (Pflicht), `pullup`/`invert`
    (bool, Default false), `debounce_ms` (uint32, Default 0).
  - `AddItemModal.tsx`: `SensorType += 'DigitalInput'`; neue `<optgroup label="Digital / Schalter">`;
    Formular (Pin / Invertieren / Pullup / Entprellung); Edit-Preload + Reset-Defaults + Submit.

  ### DigitalOutput-Invert (Durchreichen)
  - `DynamicItems.cpp`: `bool invert = cfg["invert"] | false;` + `activeHigh = !invert` im
    DigitalOutput-Branch. Rückwärtskompatibel (fehlendes Feld → false → `activeHigh=true`).
  - `AddItemModal.tsx`: neuer `invertOut`-State; Checkbox „Invertieren (active-low)" im Formular;
    Edit-Preload + Reset + Submit ergänzt.

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
  | `pnpm typecheck` | 0 Fehler |
  ```

- [ ] **Schritt 4: Final-Commit**

  ```bash
  git add SESSION.md
  git commit -m "docs: SESSION.md — PIN-Invertierung 2026-06-03"
  ```
