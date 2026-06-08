# Sollwert-Programme (Maische-/Rampenprofile) — Design-Spec

**Datum:** 2026-06-08
**Status:** Design freigegeben, bereit für Implementierung
**Kontext:** BrewControl steuert Regler (PID, TwoPoint, DualStage, SplitRangePID)
über einen einzelnen Sollwert (`Controller::setSetpoint()`). Bisher muss der
Sollwert manuell gesetzt werden. Dieses Feature fügt zeitgesteuerte
**Sollwert-Folgen mit Rasten** hinzu (z.B. Maischeprofil 52 → 63 → 72 °C), die
den Sollwert eines Reglers über die Zeit automatisch durchschalten.

---

## Ziel

Ein benanntes Programm aus einer Liste von Schritten (`{ Name, Sollwert,
Haltezeit }`) durchläuft zeitgesteuert die Sollwerte eines gewählten Reglers.
Steuerbar über ein Dashboard-Widget (Start/Pause/Stop/Weiter/Zurück). Ein
laufendes Programm überlebt einen Reboot und setzt fort.

## Umfang

**Enthalten:**
- Programm-CRUD + SD-Persistenz (`/config/programs.json`).
- Zeitgesteuertes Durchschalten der Schritte über `Controller::setSetpoint()`.
- Reboot-Resume eines laufenden Programms.
- Optionale manuelle Freigabe (Bestätigung) pro Schritt.
- Dashboard-Widget mit Live-Status + Steuer-Buttons.

**Nicht enthalten:**
- Lineare Sollwert-Rampen (Interpolation über Zeit) — Schritt springt sofort auf
  den Zielwert; die Haltezeit zählt ab Schrittbeginn. Rampen ggf. später.
- Sensor-Feedback („Haltezeit startet erst, wenn Temperatur erreicht") — bewusst
  ausgelassen, hält v1 sensorfrei und simpel.
- Verschachtelte/parallele Programme, Hopfengaben-Sequenzen, sonstige
  Brau-Domänenlogik.

## Entscheidungen (aus dem Brainstorming)

1. **Schritt-Modell:** Sollwert springt sofort auf das Ziel, Halte-Timer zählt
   **ab Schrittbeginn** (kein Warten-bis-erreicht, keine Rampe). Schritt =
   `{ name?, setpoint, holdSec, confirm? }`.
2. **Manuelle Freigabe:** `confirm: true` pro Schritt → nach Ablauf der Haltezeit
   geht das Programm in den Zustand `awaiting` und wartet auf „Weiter".
3. **Reboot-Resume:** ja. Realisiert über **absolute Wall-Clock-Epoch** pro
   Schritt (`stepStartedEpoch`), nicht `millis()` → `elapsed = now − stepStartedEpoch`
   ist auch nach Reboot korrekt. Persistenz nur bei Zustandswechseln, kein
   periodisches Schreiben.
4. **Architektur:** BrewControl-Firmware-Feature (`ProgramRunner`), **keine
   Library-Änderung**. Maische-Profile sind laut SensActCtrl-PLAN.md bewusst
   außerhalb der Library; der Runner sitzt darüber und ruft nur `setSetpoint()`.
5. **UI:** eigenes Dashboard-Widget (kein Teil der ControllerCard), referenziert
   wie `charts[]` über `programs[]` in der Dashboard-Config.
6. **Regler-Bindung:** funktioniert mit jedem Reglertyp (alle haben
   `setSetpoint`). Start aktiviert den Regler implizit (`setEnabled(true)`).

---

## Datenmodell

Persistiert als JSON-Array in `/config/programs.json` (Definition **und**
Laufzustand in derselben Datei, damit Resume ohne Zweitdatei funktioniert):

```json
[
  {
    "id": "p_a1b2c3",
    "name": "Pils-Maische",
    "controller": "maische_pid",
    "steps": [
      { "name": "Eiweißrast",   "setpoint": 52, "holdSec": 1200, "confirm": false },
      { "name": "Maltoserast",  "setpoint": 63, "holdSec": 2700, "confirm": false },
      { "name": "Verzuckerung", "setpoint": 72, "holdSec": 1800, "confirm": true  },
      { "name": "Abmaischen",   "setpoint": 78, "holdSec": 600,  "confirm": false }
    ],
    "status": "running",
    "currentStep": 1,
    "stepStartedEpoch": 1749384000,
    "elapsedAtPauseSec": 0
  }
]
```

**Schritt-Felder:**
- `name` — optional, rein kosmetisch (Editor/Widget). Fallback: „Schritt N".
- `setpoint` — Zielwert, wird bei Schrittbeginn an den Regler übergeben.
- `holdSec` — Haltezeit ab Schrittbeginn.
- `confirm` — optional (Default `false`). `true` ⇒ `awaiting` nach Ablauf.

**Laufzustand (mitpersistiert):**
- `status` — `idle | running | awaiting | paused | done`.
- `currentStep` — 0-basierter Index des aktiven Schritts.
- `stepStartedEpoch` — Unix-s, Beginn des aktiven Schritts (gültig bei `running`).
- `elapsedAtPauseSec` — bei `paused` eingefrorene verstrichene Sekunden.

## Laufzustände

```
idle ──start──▶ running ──holdSec abgelaufen──▶ (confirm? awaiting : nächster Schritt)
                  │  ▲                                      │
              pause│  │resume                          next/▶
                  ▼  │                                      ▼
                paused                              … letzter Schritt → done
```

- **`running`**: Timer läuft. Pro Tick: `elapsed = now − stepStartedEpoch`. Bei
  `elapsed ≥ holdSec` → wenn `confirm` ⇒ `awaiting`, sonst Schritt-Advance.
- **`awaiting`**: Haltezeit erfüllt, Sollwert bleibt auf aktuellem Ziel, wartet
  auf `next`. Überlebt Reboot (Status persistiert).
- **`paused`**: Timer eingefroren (`elapsedAtPauseSec` gespeichert). Resume:
  `stepStartedEpoch = now − elapsedAtPauseSec`.
- **`done`**: alle Schritte durch. Letzter Sollwert bleibt stehen, Regler bleibt
  aktiv (kein Auto-Abschalten — der User entscheidet).

**Schritt-Advance** (intern): `currentStep++`; wenn über letzten Schritt hinaus →
`done`; sonst `setpoint` des neuen Schritts an Regler, `stepStartedEpoch = now`,
persistieren.

## Steuer-Aktionen (`control`)

`start | pause | resume | stop | next | prev`

| Aktion | Wirkung | gültig in |
|--------|---------|-----------|
| `start` | Schritt 0 beginnen, Regler aktivieren (`setEnabled(true)`), Sollwert setzen | `idle`, `done` |
| `pause` | Timer einfrieren (`elapsedAtPauseSec` merken) | `running`, `awaiting` |
| `resume` | Timer fortsetzen | `paused` |
| `stop` | Abbruch → `idle`, `currentStep = 0` (Regler/Sollwert unverändert gelassen) | jeder ≠ `idle` |
| `next` | nächsten Schritt sofort starten; zugleich **Bestätigung** im `awaiting`; auf letztem Schritt → `done` | `running`, `paused`, `awaiting` |
| `prev` | vorigen Schritt, Timer neu starten; auf Schritt 0 → Schritt 0 neu starten | `running`, `paused`, `awaiting` |

Ungültige Aktion für den aktuellen Status → no-op + `400`/Hinweis (oder
toleranter no-op `200`; Implementierung: `400 "invalid action for state"`).

## Zeit-Abhängigkeit (NTP)

Timing basiert auf `time(nullptr)` (Wall-Clock). Wie `LogStore` ist der Runner
ein **No-Op bis NTP synct** (Zeit < Jahr 2000). WiFi ist für die Web-UI ohnehin
Voraussetzung, NTP wird nach Connect konfiguriert. Reiner Offline-Betrieb (kein
Router/NTP) lässt Programm-Timing pausieren — akzeptierte v1-Grenze; eine
Hardware-RTC (PCF8563, root `PLAN.md`) würde das später lösen.

---

## Firmware

### `ProgramRunner.{h,cpp}` (neu, BrewControl)

Aufbau analog `LogStore`:
- `loadFromSD(fs::FS&)` / `saveToSD(fs::FS&) const` → `/config/programs.json`.
- `serialize() const` → JSON-Array mit **Config + abgeleitetem Live-Status**
  (zusätzlich pro Programm: `stepRemainingSec`, `currentSetpoint` zur direkten
  Anzeige — abgeleitet, nicht persistiert).
- `add(JsonObject) → id`, `update(id, JsonObject) → bool`, `remove(id) → bool`.
- `control(id, action) → Result` (start/pause/resume/stop/next/prev).
- `tick(SensActCtrl::Registry&, fs::FS&, time_t nowEpoch)` — schaltet laufende
  Programme weiter, ruft `controller->setSetpoint()` / `setEnabled(true)`,
  persistiert **nur bei Übergängen**.
- **Rekursiver FreeRTOS-Mutex** (`SemaphoreHandle_t`, wie `LogStore`): schützt
  `programs_` gegen gleichzeitigen Zugriff aus AsyncTCP-Task (REST-Handler) und
  loopTask (`tick`). Selbe Cross-Task-Race wie bei Datalog.
- Regler-Lookup über `registry.findController(id)`. Existiert der referenzierte
  Regler nicht (gelöscht), wird `tick` für dieses Programm zum no-op (kein Crash);
  Status bleibt, bis der User stoppt.
- **Resume:** `loadFromSD` lädt den Laufzustand; ein `pendingReapply_`-Flag sorgt
  dafür, dass der **erste `tick` nach Boot** den Sollwert des aktiven Schritts
  einmalig erneut an den (dann via `registry.begin()` initialisierten) Regler
  schreibt.

### `WebUI.{h,cpp}`

- Konstruktor erhält zusätzlich `ProgramRunner&` (wie `logStore`).
- Routen nach dem `/api/logs`-Muster (Prefix-Reihenfolge beachten — bare
  `/api/programs` matcht sonst auch Sub-Pfade, vgl. `GetPrefixHandler`-Hinweis;
  Sub-Pfad-Handler **vor** dem bare-Handler, alle **vor** `serveStatic`):
  - `GET  /api/programs` → `programs_.serialize()`
  - `POST /api/programs` → `add` + `saveToSD` → `201 {id}`
  - `POST /api/programs/:id` → `update` + `saveToSD` (BodyPrefixHandler)
  - `DELETE /api/programs/:id` → `remove` + `saveToSD` (DeletePrefixHandler)
  - `POST /api/programs/:id/control` → Body `{"action":"start"|…}` →
    `control` + `saveToSD` (BodyPrefixHandler; `/control`-Pfad vor `/:id`)
- `tick()`: `programs_.tick(reg_, fs_, time(nullptr));` (neben `logs_.tick`).

### `DashboardStore`

- `DashboardCfg` bekommt `std::vector<std::string> programs;` (analog `charts`).
- `fillFromJson` + `serialize` erweitern.

### `main.cpp`

- `BrewControl::ProgramRunner programRunner;` instanziieren, an `WebUI`-Ctor
  übergeben, `programRunner.loadFromSD(SD)` nach `registry`-Load. Resume läuft
  über `tick` (s.o.) — keine Extra-Boot-Logik nötig.

---

## Web-UI

### `types.ts`
- `ProgramStep { name?, setpoint, holdSec, confirm? }`
- `ProgramConfig { id, name, controller, steps, status, currentStep,
  stepRemainingSec?, currentSetpoint? }`
- `DashboardConfig.programs?: string[]`

### `api.ts`
- `getPrograms()`, `createProgram(cfg)`, `updateProgram(id, cfg)`,
  `deleteProgram(id)`, `controlProgram(id, action)`.

### `ProgramCard.tsx` (neu — Widget)
- Kopf: Name + Ziel-Regler.
- Schrittliste: jede Zeile `«Name» — «setpoint» °C · «holdSec»`, aktiver Schritt
  hervorgehoben; abgeschlossene abgehakt.
- Fortschritt: Balken + Restzeit des aktiven Schritts (`stepRemainingSec`).
- Buttons: ▶ Start / ⏸ Pause / ▶ Fortsetzen / ■ Stop / ◀ Zurück / Weiter ▶ —
  kontextabhängig sichtbar/aktiv (s. Aktions-Tabelle). Im `awaiting` „Weiter ▶"
  optisch hervorgehoben (Akzent), Hinweis „Freigabe erforderlich".
- **Live-Status per Polling** `GET /api/programs` (~2 s) — kein Eingriff in den
  SSE-Snapshot (Library-Serializer bleibt unangetastet).

### `ProgramEditorModal.tsx` (neu)
- Felder: Name, Regler-Dropdown (aus Snapshot-Controllern).
- Schritt-Zeilen: Name (optional), Sollwert, Haltezeit (UI in Minuten/Sekunden →
  Sekunden im Wire-Format), `confirm`-Checkbox; Hinzufügen/Entfernen/Reorder.
- Speichern → `createProgram` / `updateProgram`.

### `Dashboard.tsx` + `DashboardEditorModal.tsx`
- `programs`-Mehrfachauswahl im Dashboard-Editor (analog `charts`/`logs`).
- Dashboard rendert `ProgramCard` für jede `activeDash.programs`-Referenz
  (unterhalb der Karten/Charts).

---

## Fehlerbehandlung & Grenzen

- **Gelöschter Regler:** referenziert ein Programm einen nicht (mehr)
  existierenden Regler, ist `tick` ein no-op; das Widget zeigt einen Hinweis.
  (Optional: Löschen eines Reglers, der von einem Programm referenziert wird,
  blockieren — analog zur Aktor-Referenzprüfung in `DynamicItems`. Für v1
  **nicht** zwingend, da Programme separat sind; als Hinweis vermerkt.)
- **Sollwert-Konflikt:** ein laufendes Programm „besitzt" den Sollwert; eine
  manuelle Änderung über die ControllerCard wird beim nächsten Schritt
  überschrieben. v1: kein Lock, nur Hinweis im Widget.
- **Persistenz:** Schreiben nur bei Übergängen (start/pause/resume/stop/next/prev
  + Auto-Advance). Minimiert SD-Wear; Wall-Clock-Epoch macht periodische
  Checkpoints überflüssig.
- **Validierung:** `add`/`update` prüfen `controller` (nicht leer) und
  `steps` (≥ 1, jeder mit endlichem `setpoint`, `holdSec ≥ 0`). Fehler → `400`.

## Testing

- **Firmware Compile-Smoke** (`pio run -e esp32dev`) — Library bleibt unangetastet,
  native Tests unverändert grün.
- **`pnpm typecheck` + `pnpm build`.**
- **Playwright-UI:** Programm anlegen (Schritte mit/ohne Namen, confirm-Flag),
  Start → Status `running`, Buttons (Pause/Weiter/Zurück/Stop) schalten Status
  korrekt, `confirm`-Schritt blockiert in `awaiting` bis „Weiter".
- **HW-E2E (LilyGo S3):** Profil mit kurzen Haltezeiten anlegen, starten,
  Schrittwechsel + Sollwert am Regler live beobachten; `confirm`-Rast wartet;
  **Reboot mitten im Schritt → Resume an korrekter Stelle** (verbleibende Zeit
  stimmt ± Reboot-Dauer).

## Out of Scope

- Lineare Rampen (Sollwert-Interpolation), Sensor-Feedback-getriggerte Rasten,
  Schleifen/Wiederholungen, Verzweigungen, mehrere Programme gleichzeitig auf
  einem Regler, Hopfengaben-/Brau-Sequenzen, Auto-Abschalten am Programmende,
  Sollwert-Lock gegen manuelle Änderung, Offline-Timing ohne NTP/RTC.
