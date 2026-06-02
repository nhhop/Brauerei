# Spec: PID-AutoTune über Web

**Datum:** 2026-06-02
**Status:** Design freigegeben

## Kontext & Ziel

`PIDController` (SensActCtrl) kapselt bereits die AutoTunePID-Logik: `autotune(method)`,
`isAutotuneRunning()`, `isAutotuneDone()`, automatische Übernahme der ermittelten Gains in
`tick()`, sowie `autotuneState` (idle/running/done), `autotuneMethod`, `Ku`/`Tu` im
`paramsJson`. **Was fehlt:** ein Weg, AutoTune über die Web-API zu *starten* und *abzubrechen* —
`setParamsJson` setzt heute nur die Methode, löst aber nichts aus. Es gibt auch keinen
Stop/Abort.

Ziel: AutoTune über das bestehende Web-UI bedienbar machen (Start/Stop + Methodenwahl +
Statusanzeige), ohne neuen Endpunkt und ohne Refactor der getesteten Tuning-Logik.

## Randbedingungen

- AutoTune existiert nur in `PIDController`. `DualStageController` / `SplitRangePIDController`
  haben einen selbst-enthaltenen PID **ohne** AutoTune-Backend → **kein** AutoTune in v1.
- Das AutoTunePID-Backend ist Hardware-only (`#if defined(ARDUINO)`); nativ ist `startAutotune`
  ein No-Op und `isTuneMode()` liefert `false`. Native Tests verifizieren die **Verdrahtung**,
  nicht die reale Tuning-Schleife (Projektkonvention: AutoTune ist hardware-verifiziert).

## Trigger-Protokoll (Ansatz A — Kommando-Feld)

Start/Stop laufen über die bestehende Route `POST /api/controllers/:id/params` → `setParamsJson`.
Kein neuer Endpunkt, kein neuer Firmware-Handler (konsistent mit `enableController`).

```json
// Start (Methode optional; ohne Feld bleibt die zuletzt gesetzte Methode)
{ "autotune": "start", "autotuneMethod": "ZieglerNichols" }
// Stop / Abbruch
{ "autotune": "stop" }
```

Methodennamen wie in `paramsJson`: `ZieglerNichols`, `CohenCoon`, `IMC`, `TyreusLuyben`,
`LambdaTuning`.

## Komponenten

### 1. Library — `PIDController` (`PIDController.h` / `.cpp`)

- **Neu `void stopAutotune();`** — bricht einen laufenden Vorgang ab: Backend zurück in
  Normal-Modus mit den zuletzt bekannten manuellen Gains (`impl_->setManualGains(kp_,ki_,kd_)`),
  `autotuneStarted_ = false`, `autotuneCompleted_ = false`. Idempotent (kein Vorgang aktiv → no-op).
- **`setParamsJson` erweitern:** String-Feld `"autotune"` lesen:
  - `"start"` → falls `autotuneMethod` mitgegeben, erst `tuningMethod_` setzen; dann
    `setEnabled(true)` (**Auto-Enable**, s.u.) und `autotune(tuningMethod_)`.
  - `"stop"`  → `stopAutotune()`.
  - Reihenfolge: bestehende Feld-Verarbeitung (setpoint/Gains/method/enabled) bleibt; der
    `autotune`-Trigger wird **am Ende** ausgewertet, damit ein in derselben Nachricht
    mitgesendetes `autotuneMethod` schon gesetzt ist.
- **Auto-Enable beim Start:** AutoTune braucht einen tickenden Regler — `tick()` kehrt bei
  `!enabled()` früh zurück, dann gäbe es weder Fortschritt noch Abschlusserkennung. „Start"
  aktiviert den Regler implizit (der Klick bedeutet genau das).
- `paramsJson` bleibt unverändert.

### 2. Firmware

Keine Änderung. `POST /api/controllers/:id/params` → `setParamsJson` trägt den Trigger.

### 3. Frontend (BrewControl/web)

- **`api.ts`:** zwei dünne Wrapper um `setControllerParams`:
  - `startAutotune(id, method)` → `setControllerParams(id, { autotune: 'start', autotuneMethod: method })`
  - `stopAutotune(id)` → `setControllerParams(id, { autotune: 'stop' })`
- **`ControllerCard.tsx`:** AutoTune-Abschnitt **nur für PID-Regler**. PID-Erkennung:
  `params.Kp != null && params.heatActuator == null` (grenzt `SplitRangePID` aus, das ebenfalls
  `Kp` hat, aber `heatActuator` setzt).
  - Zustand `idle`: Methoden-`<select>` (5 Methoden, Default `ZieglerNichols`) + Button
    „AutoTune starten".
  - Zustand `running` (`params.autotuneState === 'running'`): „AutoTune läuft…"-Badge + Button
    „Abbrechen".
  - Zustand `done` (`params.autotuneState === 'done'`): kurze Anzeige der ermittelten Werte
    (`Kp`/`Ki`/`Kd`, optional `Ku`/`Tu`).
- **`types.ts`:** `ControllerParams` hat bereits `autotuneMethod?`/`autotuneState?` sowie
  `Kp/Ki/Kd`; `Ku?`/`Tu?` ergänzen (für die „done"-Anzeige; aktuell nicht im Interface).

### 4. Tests (SensActCtrl, nativ — `test/test_pid/`)

Ergänzende Unity-Tests (Verdrahtung, nicht reale Tuning-Schleife):
- `setParamsJson({"autotune":"start"})` → `paramsJson` enthält `"autotuneState":"running"` **und**
  der Regler ist enabled (Auto-Enable).
- `setParamsJson({"autotune":"start","autotuneMethod":"CohenCoon"})` → `autotuneMethod` ist
  `CohenCoon` und State `running`.
- `setParamsJson({"autotune":"stop"})` nach Start → State zurück auf `"idle"`, Regler-Gains
  unverändert (Normal-Modus).
- `stopAutotune()` ohne laufenden Vorgang → kein Crash, State bleibt `idle`.

## Datenfluss

```
UI (ControllerCard "AutoTune starten")
  → api.startAutotune(id, method)
  → POST /api/controllers/:id/params {"autotune":"start","autotuneMethod":...}
  → PIDController::setParamsJson → setEnabled(true) + autotune(method)
  → tick() (Registry-Loop) treibt das Backend; bei Abschluss übernimmt tick() die Gains
  → RegistrySnapshot/paramsJson → SSE → UI zeigt running → done + neue Gains
```

## Verifikation

- `pio test -e native` (SensActCtrl) — neue test_pid-Fälle grün, alle bestehenden grün.
- `pio run -e esp32dev` (Firmware) — Compile-Smoke SUCCESS.
- `pnpm typecheck` (BrewControl/web) — 0 Fehler.
- Manuell/Hardware (ausstehend, eigener Punkt): an einem realen PID-Regler AutoTune starten,
  Statuswechsel idle→running→done beobachten, übernommene Gains prüfen, Abbruch testen.

## Bewusst nicht enthalten (YAGNI)

- Kein AutoTune für `SplitRangePID`/`DualStage`.
- Kein Fortschrittsbalken/keine Restzeit (Backend liefert das nicht).
- Kein Persistieren des AutoTune-Zustands über Reboot (Vorgang ist transient).
