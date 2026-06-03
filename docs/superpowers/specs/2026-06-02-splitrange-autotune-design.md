# Spec: AutoTune für SplitRangePIDController (geteilte PidEngine)

**Datum:** 2026-06-02
**Status:** Design freigegeben

## Kontext & Ziel

`PIDController` kann seit der letzten Iteration AutoTune über Web (`{"autotune":"start"|"stop"}`).
Das funktioniert, weil `PIDController` intern das AutoTunePID-Backend (Relay-Feedback, Ku/Tu)
über eine private `Impl`-Klasse kapselt. `SplitRangePIDController` hat dagegen einen
**selbst-geschriebenen** bipolaren PID (`pidUpdate`) **ohne** AutoTune-Algorithmus — dort gibt
es kein AutoTune.

Ziel: AutoTune auch für `SplitRangePIDController` verfügbar machen, indem die AutoTunePID-Engine
**aus `PIDController` herausgezogen** und von beiden Reglern geteilt wird. Die bereits gebaute
Web-Verdrahtung (`"autotune":"start/stop"`, ControllerCard) wird wiederverwendet.

## Randbedingungen & bewusste Entscheidungen

- **Verhaltensneutral für `PIDController`:** Die Extraktion ist eine mechanische Umstellung;
  die bestehenden 9 `test_pid`-Fälle sichern das ab.
- **AutoTunePID ist Arduino-only**; nativ greift der Fallback-PID. Native Tests prüfen die
  **Verdrahtung** (Zustandsübergänge), nicht die reale Tuning-Schleife (Projektkonvention).
- **Kompromiss-Gain-Satz:** Das Relay-Autotune um den Sollwert charakterisiert die *gemischte*
  Heiz/Kühl-Dynamik → ein gemeinsamer Gain-Satz. Konsistent mit der ohnehin geteilten
  Gain-Annahme des Split-Range-Ansatzes. **Kein** getrenntes Tuning pro Richtung (YAGNI).
- **Include-Hygiene:** AutoTunePID darf nicht in die Umbrella `SensActCtrl.h` lecken.

## Komponenten

### 1. Neue gemeinsame Engine — `src/controllers/detail/PidEngine.{h,cpp}`

Inhalt = die heutige `PIDController::Impl`, 1:1 herausgezogen und umbenannt. Öffentliche API:

```cpp
namespace SensActCtrl { namespace detail {
class PidEngine {
 public:
  PidEngine(float minOutput, float maxOutput);
  void  setSetpoint(float sp);
  void  setManualGains(float kp, float ki, float kd);
  void  enableInputFilter(float alpha);
  void  enableOutputFilter(float alpha);
  void  enableAntiWindup(bool enable, float threshold);
  void  startAutotune(TuningMethod method);
  bool  isTuneMode() const;
  float update(float input, float dtSeconds);                 // → [minOut, maxOut]
  void  readGains(float* kp, float* ki, float* kd, float* ku, float* tu);
};
}}  // namespace SensActCtrl::detail
```

- Der `AutoTunePID backend_`-Member steht in `PidEngine.h` unter `#if defined(ARDUINO)`;
  `PidEngine.h` inkludiert `AutoTunePID.h` ebenfalls nur guarded. Das ist unkritisch, weil
  `PidEngine.h` **ausschließlich** von den beiden Controller-`.cpp` inkludiert wird — die
  Regler-**Header** halten nur `detail::PidEngine* engine_` (forward-declariert), sodass
  AutoTunePID nicht in die Umbrella `SensActCtrl.h` leckt. (Native: kein `backend_`, der
  Fallback-PID nutzt die primitive State im `#else`-Zweig.)
- `TuningMethod`-Enum bleibt wie heute in `PIDController.h` (von `PidEngine.h` inkludiert) —
  **kein** Verschieben, um die öffentliche API stabil zu halten.

### 2. `PIDController` (`.h`/`.cpp`)

- Statt privater `class Impl;` + `Impl* impl_;` → `detail::PidEngine* engine_;`
  (forward-declariert im Header, heap-allokiert — Include-Hygiene wie bisher).
- Alle `impl_->…`-Aufrufe → `engine_->…`. Restliche Logik (Setpoint, Gains, `autotune`,
  `stopAutotune`, Abschlusserkennung in `tick()`, `syncFromBackend`, JSON) **unverändert**.
- Die `Impl`-Klasse wird aus `PIDController.cpp` entfernt (lebt jetzt in `PidEngine`).

### 3. `SplitRangePIDController` (`.h`/`.cpp`)

- **Header:** `detail::PidEngine* engine_;` (forward-declariert) ersetzt die handgeschriebenen
  PID-Felder `integral_`/`lastError_`. Neue AutoTune-Member analog `PIDController`:
  `tuningMethod_`, `autotuneStarted_`, `autotuneCompleted_`, `ku_`, `tu_`. Neue Methoden:
  `autotune(TuningMethod)`, `stopAutotune()`, `isAutotuneRunning()`, `isAutotuneDone()`.
- **`pidUpdate` entfällt** → `engine_` mit Range `[-1.0f, +1.0f]` im Konstruktor; `setTunings`
  ruft `engine_->setManualGains`. `setDeadband` bleibt.
- **`tick()`:**
  - Throttle ≥100 ms + Fail-safe (beide aus bei disabled/invalid) bleiben.
  - Abschlusserkennung wie `PIDController`: `started && !completed && !engine_->isTuneMode()`
    → `completed=true; syncFromBackend()`.
  - `out = engine_->update(r.value, dt)` (∈ [−1,+1]).
  - Heat/Cool-Mapping + Interlock bleiben.
  - **Während AutoTune (`autotuneStarted_ && !autotuneCompleted_`) wird die Umschalt-Totzeit
    übersprungen** — das erzwungene Off-Fenster würde die Relay-Schwingung/Tu-Messung
    verfälschen. Totband ist beim ±1-Relay irrelevant; Interlock + Fail-safe bleiben.
- **`autotune`/`stopAutotune`/`syncFromBackend`:** identisches Muster wie `PIDController`
  (`autotune` setzt Flags + `engine_->startAutotune`; `stopAutotune` idempotent +
  `engine_->setManualGains(kp_,ki_,kd_)`; `syncFromBackend` ruft `engine_->readGains`).
- **JSON:** `paramsJson` zusätzlich `Ku`/`Tu`/`autotuneMethod`/`autotuneState` (idle/running/done).
  `setParamsJson` liest `autotuneMethod` (Methode setzen) und das Kommando-Feld `"autotune"`:
  `"start"` → `setEnabled(true)` + `autotune(tuningMethod_)`, `"stop"` → `stopAutotune()`
  (am Ende, nach den übrigen Feldern).

### 4. Frontend (`ControllerCard.tsx`)

AutoTune-Block-Bedingung von `params.Kp != null && params.heatActuator == null` auf
**`params.Kp != null`** erweitern (PID *und* SplitRangePID; TwoPoint/DualStage haben kein `Kp`).
`types.ts` hat `Ku`/`Tu` bereits. Keine weitere Änderung.

### 5. Tests (SensActCtrl, nativ)

- `test_pid` (9) + `test_splitrange` (9) müssen **unverändert grün** bleiben → Beweis, dass
  Engine-Extraktion (PID) und Engine-Swap (SplitRange) verhaltensneutral sind.
- Neue `test_splitrange`-Fälle (Verdrahtung):
  - `setParamsJson({"autotune":"start"})` → `paramsJson` enthält `autotuneState":"running"` **und**
    Regler ist enabled.
  - `setParamsJson({"autotune":"start","autotuneMethod":"IMC"})` → `autotuneMethod":"IMC"` + running.
  - `setParamsJson({"autotune":"stop"})` nach Start → `autotuneState":"idle"`.
  - `stopAutotune()` ohne laufenden Vorgang → kein Crash, State `idle`.

## Datenfluss

```
UI (ControllerCard, SplitRangePID) "AutoTune starten"
  → api.startAutotune(id, method)  [bereits vorhanden]
  → POST /api/controllers/:id/params {"autotune":"start","autotuneMethod":...}
  → SplitRangePIDController::setParamsJson → setEnabled(true) + autotune(method)
  → tick(): engine_->update treibt das Relay über ±1 (heizen↔kühlen um Sollwert),
            Changeover-Totzeit pausiert; bei Abschluss syncFromBackend() übernimmt Gains
  → paramsJson (SSE) → UI: running → done + ermittelte Gains
```

## Verifikation

- `pio test -e native` (SensActCtrl): alle grün (105 vorher + 4 neue SplitRange-Autotune = 109).
- `pio run -e esp32dev` (Firmware): SUCCESS.
- `pnpm typecheck` (BrewControl/web): 0 Fehler.
- Manuell/Hardware (separater offener Punkt): SplitRangePID an echter Heiz/Kühl-Strecke
  autotunen, Status idle→running→done, übernommene Gains plausibel, Abbruch testen.

## Bewusst nicht enthalten (YAGNI)

- Kein getrenntes Tuning für Heiz- und Kühlseite (ein Kompromiss-Gain-Satz).
- Kein AutoTune für `DualStageController` (bang-bang, gegenstandslos).
- Keine Fortschrittsanzeige (separat in PLAN.md vorgemerkt).
