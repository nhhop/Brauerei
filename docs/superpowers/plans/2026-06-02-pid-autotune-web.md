# PID-AutoTune über Web — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** AutoTune eines `PIDController` über die Web-UI starten und abbrechen (Methodenwahl + Statusanzeige), ohne neuen Endpunkt.

**Architecture:** Start/Stop laufen als Kommando-Feld `"autotune":"start"|"stop"` über die bestehende Route `POST /api/controllers/:id/params` → `PIDController::setParamsJson`. Die Library bekommt eine neue `stopAutotune()`-Methode; `setParamsJson` löst Start (mit Auto-Enable) bzw. Stop aus. Frontend: zwei API-Wrapper + ein AutoTune-Abschnitt in der ControllerCard (nur für PID-Regler).

**Tech Stack:** C++17 / PlatformIO / Unity (Library), Preact + TypeScript (Web). AutoTune-Backend ist Hardware-only; native Tests prüfen die Verdrahtung.

**Branch:** `feat/pid-autotune-web` (bereits angelegt).

**Spec:** `docs/superpowers/specs/2026-06-02-pid-autotune-web-design.md`

---

## Task 1: Library — `stopAutotune()` + AutoTune-Trigger in `setParamsJson`

**Files:**
- Modify: `SensActCtrl/src/controllers/PIDController.h` (Deklaration `stopAutotune()`)
- Modify: `SensActCtrl/src/controllers/PIDController.cpp` (`stopAutotune()` + `setParamsJson`)
- Test: `SensActCtrl/test/test_pid/test_pid.cpp`

- [ ] **Step 1: Failing-Tests schreiben**

In `SensActCtrl/test/test_pid/test_pid.cpp` direkt **vor** `void setUp() {}` einfügen:

```cpp
void test_autotune_start_runs_and_enables() {
  MockSensor s("t1", tempMeta());
  MockActuator a("o1", dutyMeta());
  PIDController pid("pid", s, a, 0.0f, 1.0f);
  pid.setEnabled(false);

  TEST_ASSERT_TRUE(pid.setParamsJson("{\"autotune\":\"start\"}"));
  TEST_ASSERT_TRUE(pid.enabled());  // Auto-Enable beim Start

  char buf[256];
  pid.paramsJson(buf, sizeof(buf));
  TEST_ASSERT_NOT_NULL(strstr(buf, "\"autotuneState\":\"running\""));
}

void test_autotune_start_with_method() {
  MockSensor s("t1", tempMeta());
  MockActuator a("o1", dutyMeta());
  PIDController pid("pid", s, a, 0.0f, 1.0f);

  TEST_ASSERT_TRUE(pid.setParamsJson(
      "{\"autotune\":\"start\",\"autotuneMethod\":\"CohenCoon\"}"));
  char buf[256];
  pid.paramsJson(buf, sizeof(buf));
  TEST_ASSERT_NOT_NULL(strstr(buf, "\"autotuneMethod\":\"CohenCoon\""));
  TEST_ASSERT_NOT_NULL(strstr(buf, "\"autotuneState\":\"running\""));
}

void test_autotune_stop_returns_to_idle() {
  MockSensor s("t1", tempMeta());
  MockActuator a("o1", dutyMeta());
  PIDController pid("pid", s, a, 0.0f, 1.0f);

  pid.setParamsJson("{\"autotune\":\"start\"}");
  pid.setParamsJson("{\"autotune\":\"stop\"}");
  char buf[256];
  pid.paramsJson(buf, sizeof(buf));
  TEST_ASSERT_NOT_NULL(strstr(buf, "\"autotuneState\":\"idle\""));
}

void test_stop_autotune_idempotent_when_idle() {
  MockSensor s("t1", tempMeta());
  MockActuator a("o1", dutyMeta());
  PIDController pid("pid", s, a, 0.0f, 1.0f);
  pid.stopAutotune();  // kein laufender Tune → sicherer No-Op
  char buf[256];
  pid.paramsJson(buf, sizeof(buf));
  TEST_ASSERT_NOT_NULL(strstr(buf, "\"autotuneState\":\"idle\""));
}
```

In `main()` die vier `RUN_TEST`-Zeilen nach `RUN_TEST(test_invalid_reading_skips_tick);` ergänzen:

```cpp
  RUN_TEST(test_autotune_start_runs_and_enables);
  RUN_TEST(test_autotune_start_with_method);
  RUN_TEST(test_autotune_stop_returns_to_idle);
  RUN_TEST(test_stop_autotune_idempotent_when_idle);
```

- [ ] **Step 2: Tests laufen lassen — müssen fehlschlagen**

Run (PowerShell):
```powershell
$env:Path = "C:\Users\nhhop\.platformio\mingw64\bin;C:\Users\nhhop\.platformio\penv\Scripts;" + $env:Path
cd C:\Users\nhhop\repos\Brauerei\SensActCtrl
pio test -e native -f test_pid
```
Expected: Kompilierfehler `'stopAutotune' is not a member of ...` (Methode fehlt noch).

- [ ] **Step 3: `stopAutotune()` deklarieren**

In `SensActCtrl/src/controllers/PIDController.h`, direkt nach `void autotune(TuningMethod method);`:

```cpp
  void autotune(TuningMethod method);
  void stopAutotune();
```

- [ ] **Step 4: `stopAutotune()` implementieren**

In `SensActCtrl/src/controllers/PIDController.cpp`, direkt nach der `autotune(...)`-Methode (vor `isAutotuneRunning`):

```cpp
void PIDController::stopAutotune() {
  if (!autotuneStarted_) return;  // idempotent — kein laufender Vorgang
  autotuneStarted_ = false;
  autotuneCompleted_ = false;
  impl_->setManualGains(kp_, ki_, kd_);  // Backend → Normal-Modus mit letzten Gains
}
```

- [ ] **Step 5: AutoTune-Trigger in `setParamsJson` ergänzen**

In `SensActCtrl/src/controllers/PIDController.cpp`, in `setParamsJson`, direkt **vor** `return true;` einfügen (nach dem bestehenden `enabled`-Block):

```cpp
  const char* aStr = nullptr;
  size_t aLen = 0;
  if (extractString(json, "autotune", &aStr, &aLen)) {
    if (aLen == 5 && strncmp(aStr, "start", 5) == 0) {
      setEnabled(true);            // AutoTune braucht einen tickenden Regler
      autotune(tuningMethod_);     // tuningMethod_ wurde oben ggf. aktualisiert
    } else if (aLen == 4 && strncmp(aStr, "stop", 4) == 0) {
      stopAutotune();
    }
  }
```

- [ ] **Step 6: Tests laufen lassen — müssen bestehen**

Run:
```powershell
pio test -e native -f test_pid
```
Expected: alle test_pid-Fälle PASSED (inkl. der vier neuen).

- [ ] **Step 7: Volle native Suite — keine Regression**

Run:
```powershell
pio test -e native
```
Expected: alle Tests PASSED (vorher 101, jetzt 105).

- [ ] **Step 8: Commit**

```bash
git add SensActCtrl/src/controllers/PIDController.h SensActCtrl/src/controllers/PIDController.cpp SensActCtrl/test/test_pid/test_pid.cpp
git commit -m "feat(lib): PIDController AutoTune start/stop über setParamsJson"
```

---

## Task 2: Frontend — `types.ts` (Ku/Tu) + `api.ts` (start/stop)

**Files:**
- Modify: `BrewControl/web/src/types.ts` (`ControllerParams`)
- Modify: `BrewControl/web/src/api.ts`

- [ ] **Step 1: `ControllerParams` um Ku/Tu ergänzen**

In `BrewControl/web/src/types.ts`, im Interface `ControllerParams` in der PID-Gruppe (nach `Kd?: number;`):

```ts
  Kp?: number;
  Ki?: number;
  Kd?: number;
  Ku?: number;
  Tu?: number;
```

- [ ] **Step 2: API-Wrapper ergänzen**

In `BrewControl/web/src/api.ts`, direkt nach der `enableController`-Funktion:

```ts
export function startAutotune(id: string, method: string): Promise<void> {
  return setControllerParams(id, { autotune: 'start', autotuneMethod: method });
}

export function stopAutotune(id: string): Promise<void> {
  return setControllerParams(id, { autotune: 'stop' });
}
```

- [ ] **Step 3: Typecheck**

Run (PowerShell):
```powershell
cd C:\Users\nhhop\repos\Brauerei\BrewControl\web
pnpm exec tsc --noEmit
```
Expected: EXIT 0, keine Diagnostics.

- [ ] **Step 4: Commit**

```bash
git add BrewControl/web/src/types.ts BrewControl/web/src/api.ts
git commit -m "feat(web): api startAutotune/stopAutotune + Ku/Tu in ControllerParams"
```

---

## Task 3: Frontend — AutoTune-Abschnitt in `ControllerCard`

**Files:**
- Modify: `BrewControl/web/src/components/ControllerCard.tsx`

- [ ] **Step 1: Imports + Methoden-Konstante**

In `BrewControl/web/src/components/ControllerCard.tsx`, die Import-Zeile für `api` erweitern:

```tsx
import { setControllerSetpoint, enableController, startAutotune, stopAutotune } from '../api';
```

Oben im Modul (nach den Imports, vor `interface Props`):

```tsx
const AUTOTUNE_METHODS = [
  'ZieglerNichols', 'CohenCoon', 'IMC', 'TyreusLuyben', 'LambdaTuning',
] as const;
```

- [ ] **Step 2: State + Handler + PID-Erkennung**

Innerhalb der `ControllerCard`-Funktion, nach den bestehenden `useState`-Zeilen (z.B. nach `const [err, setErr] = useState<string | null>(null);`):

```tsx
  const [atMethod, setAtMethod] = useState('ZieglerNichols');
  const [atBusy, setAtBusy] = useState(false);

  const isPid = params?.Kp != null && params?.heatActuator == null;
  const autotuneState = params?.autotuneState as string | undefined;

  async function onStartAutotune() {
    setAtBusy(true); setErr(null);
    try { await startAutotune(id, atMethod); }
    catch (e) { setErr(String(e)); }
    finally { setAtBusy(false); }
  }

  async function onStopAutotune() {
    setAtBusy(true); setErr(null);
    try { await stopAutotune(id); }
    catch (e) { setErr(String(e)); }
    finally { setAtBusy(false); }
  }
```

- [ ] **Step 3: AutoTune-UI-Block einfügen**

In `ControllerCard.tsx`, direkt **vor** der Zeile `{err && <p class="mt-2 text-xs text-red-600">{err}</p>}` einfügen:

```tsx
      {isPid && (
        <div class="mt-3 border-t border-border/50 pt-3">
          {autotuneState === 'running' ? (
            <div class="flex items-center justify-between gap-2">
              <span class="text-xs text-amber-600">AutoTune läuft…</span>
              <button type="button" onClick={onStopAutotune} disabled={atBusy}
                class="rounded bg-fg/5 px-2 py-1 text-xs text-fg hover:bg-fg/10 disabled:opacity-50">
                Abbrechen
              </button>
            </div>
          ) : (
            <div class="flex flex-wrap items-center gap-2">
              <select value={atMethod} title="AutoTune-Methode"
                onChange={(e) => setAtMethod((e.target as HTMLSelectElement).value)}
                class="rounded border border-border bg-surface px-2 py-1 text-xs text-fg">
                {AUTOTUNE_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
              <button type="button" onClick={onStartAutotune} disabled={atBusy}
                class="rounded bg-fg px-2 py-1 text-xs text-bg hover:bg-fg/80 disabled:opacity-50">
                AutoTune starten
              </button>
              {autotuneState === 'done' && (
                <span class="text-xs text-emerald-600 font-mono">
                  Kp {Number(params?.Kp).toFixed(2)} · Ki {Number(params?.Ki).toFixed(2)} · Kd {Number(params?.Kd).toFixed(2)}
                </span>
              )}
            </div>
          )}
        </div>
      )}
```

- [ ] **Step 4: Typecheck**

Run:
```powershell
cd C:\Users\nhhop\repos\Brauerei\BrewControl\web
pnpm exec tsc --noEmit
```
Expected: EXIT 0, keine Diagnostics.

- [ ] **Step 5: Commit**

```bash
git add BrewControl/web/src/components/ControllerCard.tsx
git commit -m "feat(web): AutoTune-Steuerung (Start/Stop/Methode/Status) in ControllerCard"
```

---

## Task 4: Firmware-Compile-Smoke + Doku

**Files:**
- Modify: `PLAN.md` (Status BrewControl)
- Modify: `SESSION.md` (Cross-Projekt-Eintrag)

- [ ] **Step 1: Firmware kompilieren**

Run (PowerShell):
```powershell
$env:Path = "C:\Users\nhhop\.platformio\penv\Scripts;" + $env:Path
cd C:\Users\nhhop\repos\Brauerei\BrewControl\firmware
pio run -e esp32dev
```
Expected: `[SUCCESS]`. (Keine Firmware-Code-Änderung — verifiziert nur, dass die Library-Änderung sauber baut.)

- [ ] **Step 2: PLAN.md aktualisieren**

In `PLAN.md`, im Abschnitt „### BrewControl" einen Status-Punkt ergänzen (oberhalb des Gärsteuerungs-Eintrags):

```markdown
- **PID-AutoTune über Web (2026-06-02):** Start/Stop + Methodenwahl (5 Algorithmen) + Statusanzeige (idle/running/done) in der ControllerCard; Trigger als `{"autotune":"start"|"stop"}` über `POST /api/controllers/:id/params` (kein neuer Endpunkt); `PIDController::stopAutotune()` neu, Start aktiviert den Regler implizit. Nur PID-Regler. Reale Tuning-Schleife hardware-verifiziert (nativ No-Op).
```

- [ ] **Step 3: SESSION.md aktualisieren**

In `SESSION.md` ans Ende einen neuen Eintrag anhängen:

```markdown

---

## 2026-06-02 — PID-AutoTune über Web

**Ausgangslage:** `PIDController` kapselte AutoTune (autotune/isAutotuneRunning/isAutotuneDone, Auto-Übernahme der Gains, `autotuneState` im paramsJson), aber `setParamsJson` konnte es nicht starten und es gab keinen Stop.

**Library:** neue Methode `stopAutotune()` (Backend → Normal-Modus mit letzten Gains, idempotent); `setParamsJson` liest Kommando-Feld `"autotune"`: `"start"` → `setEnabled(true)` + `autotune(tuningMethod_)`, `"stop"` → `stopAutotune()`. 4 neue native Tests (101 → 105).

**Firmware:** keine Änderung — Trigger läuft über die bestehende params-Route.

**Frontend:** `api.ts` `startAutotune(id, method)` / `stopAutotune(id)`; `types.ts` `Ku`/`Tu` ergänzt; ControllerCard zeigt für PID-Regler (`Kp != null && heatActuator == null`) Methoden-Dropdown (5 Algorithmen, Default Ziegler-Nichols) + Start-Button, bei `running` Abbrechen-Button + Badge, bei `done` die ermittelten Gains.

**Randbedingung:** nur `PIDController`. `DualStage` (bang-bang) und `SplitRangePID` (PID ohne AutoTune-Backend) bleiben außen vor. Fortschrittsanzeige als späteres Feature in PLAN.md vermerkt.

### Verifikation
| Check | Resultat |
|---|---|
| `pio test -e native` (SensActCtrl) | 105/105 |
| `pio run -e esp32dev` (Firmware) | SUCCESS |
| `pnpm typecheck` (BrewControl/web) | 0 Fehler |
```

- [ ] **Step 4: Commit**

```bash
git add PLAN.md SESSION.md
git commit -m "docs: PID-AutoTune über Web — PLAN + SESSION"
```

---

## Verifikation (gesamt)

- `pio test -e native` (SensActCtrl): 105/105 grün (101 alt + 4 neu).
- `pio run -e esp32dev` (Firmware): SUCCESS.
- `pnpm exec tsc --noEmit` (Web): 0 Fehler.
- Manuell/Hardware (separater offener Punkt): an realem PID-Regler AutoTune starten → Status idle→running→done, übernommene Gains prüfen, Abbruch testen.
