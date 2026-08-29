# Session — BrewControl Web-UI

Stand: 2026-05-17. Greenfield-Start. PLAN.md geschrieben und vom User
genehmigt; Implementierung noch nicht begonnen.

## Pre-MVP: Planung, Implementierung, erste E2E-Tests (2026-05-17 – 2026-05-20)

Plan geschrieben und umgesetzt (11 Build-Steps), E2E auf LOLIN S2 Mini und
LilyGo T-Display-S3-AMOLED-1.43 verifiziert, QEMU-Machbarkeit geprüft und
verworfen, WiFi-Reset zur Laufzeit + Runtime-Item-Add/Remove implementiert,
Bus-Discovery-Feature (OneWire-Scan) ergänzt. Ausführliche Session-Logs:
[SESSION-archive.md](SESSION-archive.md).

---

## Session 2026-06-03 — OTA Firmware-Update (Code komplett, HW-E2E offen)

Plan [`docs/superpowers/plans/2026-06-03-firmware-update.md`](../docs/superpowers/plans/2026-06-03-firmware-update.md)
umgesetzt (Skill `superpowers:executing-plans`), Feature-Branch `feat/firmware-update`.

**Implementiert (Firmware):**
- `version_flags.py` + `src/version.h` — `BREWCTL_VERSION` (git-Tag) +
  `BREWCTL_VARIANT` (`${PIOENV}`) als Compile-Flags; `BREWCTL_VERSION_OVERRIDE`
  hat in CI Vorrang.
- `lib/TarExtractor/` — streaming USTAR-Parser, pure-C++, host-getestet
  (`[env:native]`, 4 Unity-Tests grün). Plan-Lücke gefixt: Unity braucht
  `setUp`/`tearDown`-Stubs.
- `src/SdTarSink.h` — TarExtractor-Callbacks → `fs::FS`.
- `src/FirmwareUpdater.{h,cpp}` — State-Machine, GitHub-Releases-Client
  (`WiFiClientSecure.setInsecure()`, ArduinoJson-Filter), blockierender
  Download/Flash auf dem loopTask via `tick()`; HTTP-Routen setzen nur Flags.
- `SettingsStore` — `firmware`-Sektion (channel/autoCheck) + Validierung.
- `WebUI` — `/api/update/{status,check,install,firmware,assets}`,
  `.bin`-Flash- und `.tar`-Extract-Upload-Handler, atomarer `/www`-Swap auf
  loopTask; Serve-Root von SD-Root → `/www` umgestellt.
- `main.cpp` — `FirmwareUpdater` instanziiert + verdrahtet.

**Implementiert (Web):** `types.ts` (`UpdateStatus`/`FirmwareSettings`),
`api.ts` (Update-Client + XHR-Upload mit Progress), `FirmwarePage.tsx`,
Route `/settings/firmware`, Settings-Kachel + „Update verfügbar"-Badge.

**CI:** `.github/workflows/release.yml` — Matrix baut `firmware-<env>.bin` +
`webui.tar` bei `v*`-Tag.

**Partition-Entscheidung (Task 12, vorgezogen):** Sobald der TLS-Pull-Pfad
gelinkt ist, springt esp32dev von 79 % → **92,6 %** App-Flash (lolin 88,3 %).
Zu eng für OTA → beide 4-MB-Envs auf `board_build.partitions = min_spiffs.csv`
(~1,9 MB Slots): esp32dev **61,7 %**, lolin **58,8 %**. LilyGo-S3 (16 MB)
unverändert (17,4 %). ⚠ Layout-Wechsel braucht **einmaligen USB-Flash**.

**Verifikation:** alle drei Boards `pio run` grün; `pio test -e native` 4/4;
`pnpm typecheck` + `pnpm build` grün.

**HW-E2E Phase A (Upload-Pfade) — erledigt auf LilyGo S3 (192.168.178.87):**
- A1 USB-Flash (min_spiffs-Layout) + SD `/www` → bootet, UI serviert aus `/www`.
- A2 `/api/update/status` → `variant:lilygo…`, korrekt. (Boot-Auto-Check meldet
  `error/check failed` — erwartet, da noch kein Release/public-Repo; kein Crash.)
- A3 `.bin`-OTA-Upload (1,14 MB) → `ok`, Flash, Reboot, Gerät wieder oben.
- A4 `.tar`-Upload → **Bug gefunden:** `tar -cf x .` emittiert `./`-Namen,
  `SdTarSink` baute `/www.new/./<name>` → SD-VFS lehnt ab → `extract failed`.
  **Gefixt** (`fix(fw): strip leading ./ in SdTarSink`, Commit 4d05e10): beide
  tar-Formen (`.` und `*`) extrahieren jetzt; UI nach Swap korrekt aus `/www`.
  **Relevant für CI:** `release.yml` nutzt die `.`-Form → ohne den Fix wäre der
  Server-Pull (Phase B) am Asset-Extract gescheitert.

**HW-E2E Phase B (Server-Pull) — erledigt auf LilyGo S3 (2026-06-04):**
- Repo `nhhop/Brauerei` public geschaltet; manuelles Test-Release `v0.0.1-test`
  mit allen 4 Assets (CI war zu dem Zeitpunkt noch kaputt, s. u.).
- `check` → `updateAvailable` v0.0.1-test; `install` → `downloading` (webui.tar
  extract + `/www`-Swap) → `flashing` (0→98 %) → Reboot → Gerät läuft danach
  `v0.0.1-test`, UI aus den gepullten Assets (`/` + gehashte Assets → 200).
  Bestätigt zugleich den `./`-Fix mit dem **CI-Format** `webui.tar`.
- Negativ-Varianten-Test entfällt: die Matrix baut alle 3 Varianten, also findet
  jede Variante ihr Asset.

**CI-Bugs (beim Tag-Push-Release entdeckt) — gefixt + verifiziert (2026-06-04):**
1. Firmware-Build brach, weil `platformio.ini` an `symlink://../../../IdsInductionCooker`
   hängt — ein **privates Sibling-Repo**, das `actions/checkout` nie auscheckte.
2. `action-gh-release` scheiterte mangels `permissions: contents: write`.
   Fix (`ci: fix release workflow …`, Commit 2c1decd): Brauerei + IdsInductionCooker
   als Siblings unter `$GITHUB_WORKSPACE` auschecken + `contents: write`. Voraussetzung:
   IdsInductionCooker **public**. Verifiziert: Run für `v0.0.1-test2` grün (2m11s),
   alle 4 Assets automatisch gebaut. Beide Test-Releases danach gelöscht.

**Merge:** PR #6 nach `main` gemergt (Merge-Commit 230fa11), Branch
`feat/firmware-update` lokal + remote gelöscht.

**SD-Karten-Migration:** erledigt — bestehende Karten auf `/www` umgestellt
(bzw. via `webui.tar`-Einspielung). Damit ist das OTA-Feature vollständig
abgeschlossen, keine offenen Punkte mehr.

---

## Session 2026-06-04 — Backup & Restore (Config-Export/Import)

Voller Superpowers-Zyklus: brainstorming → spec → writing-plans →
subagent-driven-development (frischer Implementer pro Task + Zwei-Stufen-Review)
→ HW-E2E → PR. Spec: [`docs/superpowers/specs/2026-06-04-backup-restore-design.md`](../docs/superpowers/specs/2026-06-04-backup-restore-design.md),
Plan: [`docs/superpowers/plans/2026-06-04-backup-restore.md`](../docs/superpowers/plans/2026-06-04-backup-restore.md).
Branch `feat/backup-restore`, **PR #7 gemergt** (Merge-Commit d72e5e8).

**Implementiert:**
- `WebUI` — `GET /api/backup` bündelt die 3 `/config`-Stores
  (`items_.serializeConfig()` Objekt, `store_.serialize()` Array,
  `settings_.serialize()` Objekt) zu einer JSON-Datei
  `{type,version,firmwareVersion,variant,registry,dashboards,settings}` mit
  `Content-Disposition`-Download. `POST /api/backup` (`AsyncCallbackJsonWebHandler`)
  validiert `type`/`version`/3 Sektions-Typen **vor** jedem Schreibzugriff,
  schreibt die Sektionen verbatim via `writeSection_` in die `/config`-Dateien,
  Reboot über `rebootAtMs_`. Restore = Replace-all + Reboot, reuse des
  Boot-Lade-Pfads (`loadFromSD`) — keine Store-Änderungen, keine neue
  Serialisierungslogik.
- Web — `downloadBackup()` (Blob-Download mit Datums-Dateiname) + `restoreBackup()`
  in `api.ts`; `BackupPage.tsx` (Export-Button, File-Import, `ConfirmModal`,
  „Neustart…"-View); Route `/settings/backup`; Settings-Kachel.

**Entscheidungen:** nur Config (kein WiFi); Ansatz A (verbatim schreiben + Reboot);
Server-Endpoint. Geräte-Zeitstempel als Zukunfts-Hook in der Spec (wartet auf das
„Zeit & Formate"-Feature).

**Review-Findings (übernommen):** File-Input-Reset bei Cancel/Error (sonst feuert
das erneute Wählen derselben Datei nicht), `kRebootDelayMs` statt Magic-500,
`serializeJson`-Rückgabe prüfen, klarere 500-Meldung bei Teil-Schreibfehler.
Eine stilistische Anmerkung (`confirmRestore` inline statt benannt) begründet
abgelehnt. Finaler Opus-Gesamt-Review: „Ready to merge".

**HW-E2E (LilyGo S3, neue Firmware per OTA aufgespielt):** Export → Theme-Akzent
als Canary auf `#123456` geändert → erfasstes Backup zurückgespielt (`200 ok`,
Reboot) → nach Reboot Akzent wieder `#d97706` (Restore verifiziert: settings.json
überschrieben + Boot-Load); Negativtest `{"foo":1}` → `400`, Config intakt. Kein
Bug gefunden. (Die BackupPage-UI selbst wurde nachträglich per `webui.tar` auf die
SD gespielt.)

## Session 2026-06-05 — SD-Boot-Firmware-Flash (Recovery-Pfad)

Vierter OTA-Weg neben Browser-Upload / GitHub-Pull / Auto-Check: eine
`/firmware.bin` im SD-Root wird beim nächsten Boot geflasht — funktioniert
**ohne WiFi** (Recovery / Erstinbetriebnahme).

**Implementiert:**
- `FirmwareUpdater::flashFromSdImage(path = "/firmware.bin")` — prüft `fs_.exists`,
  streamt die Datei in 1 KB-Blöcken durch `Update.begin(size)/write/end(true)`,
  löscht das Image und `ESP.restart()`. Guard gegen Reflash-Loop: schlägt das
  Löschen fehl, wird der Reboot übersprungen (neues Image ist bereits Boot-Target).
  Keine Versions-/Varianten-Prüfung — bewusst, damit Downgrade/Recovery geht.
- `main.cpp` — SD-Mount **vor** die WiFi-Logik gezogen (sonst kehrt das
  Setup-Portal bei fehlenden Creds nie zurück); direkt nach erfolgreichem Mount
  `firmwareUpdater.flashFromSdImage()`. Alter SD-Mount-Block nach mDNS entfernt,
  Boot-Flow-Kommentar aktualisiert.

**Verifikation:** `pio run -e esp32dev` SUCCESS (Flash 62.0 %, RAM 15.4 %).
HW-E2E am Gerät noch ausstehend.

---

## Session 2026-06-05 — UI-Fixes: PID-Regler Dashboard & AutoTune

Vier zusammenhängende UI-Fixes an `ControllerCard.tsx` und `AddItemModal.tsx`.
`pnpm typecheck` grün; keine HW-E2E nötig (reine Frontend-Änderungen).

**1. Aktor-Reset beim Ausschalten (`ControllerCard.tsx`)**

`toggleEnabled()` setzt nach `enableController(id, false)` alle verknüpften
Aktoren explizit auf den Minimalwert: single-Aktor auf `params.min ?? 0`,
dual heat/cool-Aktoren je auf `0`. Ohne diesen Reset blieb der letzte
PID-Ausgangswert im Aktor stehen.

**2. Setpoint nur im Dashboard**

Setpoint-Feld aus `AddItemModal` entfernt — war redundant (bereits im
Dashboard editierbar) und könnte beim delete+recreate-Edit-Mechanismus
einen unerwünschten Setpoint-Reset auslösen. Der `setpoint`-State und
die Übernahme in den `cfg`-Submit-Block bleiben erhalten (initiale
Konfiguration).

**3. AutoTune in Settings verschoben**

AutoTune-Controls (Methode-Selector, Starten/Abbrechen) aus
`ControllerCard` (Dashboard) in `AddItemModal` (Settings, Edit-Modus)
verschoben. Gründe: AutoTune läuft stundenlang; versehentliches Auslösen
während eines Braugangs vermeiden; Settings sind der natürliche Ort für
Parametrisierungs-Workflows. Gilt nur für `PID` und `SplitRangePID` beim
Bearbeiten — beim Neu-Anlegen kein AutoTune-Abschnitt. Save-Button im
Modal wird gesperrt solange `autotuneState === 'running'` (verhindert
Controller delete+recreate während laufendem AutoTune).

**4. AutoTune-Status implementiert**

Dashboard (`ControllerCard`): zeigt jetzt read-only-Status:
- `'running'` → amber „AutoTune läuft…"
- `'done'` → grüne Kp/Ki/Kd-Zeile (war schon teilweise vorhanden, bleibt)
- kein State / anderer Wert → kein UI-Element

Settings (`AddItemModal`): gleicher Status-Block + volle Steuerung.
`liveController` wird per `snap?.controllers.find(id)` aufgelöst —
`snap` wird bereits an das Modal übergeben, kein neuer Prop nötig.

**Geänderte Dateien:**
- `web/src/components/ControllerCard.tsx`
- `web/src/components/AddItemModal.tsx`

---

## 2026-06-06 — Datenlogging & Trend-Charts (Branch `feat/datalog`)

**Ausgangslage:** Zeit & Formate (NTP + `serverTime` im Snapshot) abgeschlossen — Voraussetzung für CSV-Timestamps. Design abgestimmt: Log-Config = Chart-Config, eine CSV pro Session mit gemeinsamem Zeitstempel, uPlot, standalone Logs mit Dashboard-Referenz.

**Phase 1 — Logging-Core (Firmware):**
- `LogStore.{h,cpp}`: Sampling der Registry in Sessions `/logs/<id>/<startEpoch>.csv`, Config in `/config/logs.json`. Serien-Refs `<rolle>/<snapshot-id>` (z.B. `sensor/bme280.temp`, `actuator/heizung`, `controller/maische`) lösen 1:1 gegen die Registry auf; Werte auf `meta.res` gerundet, ungültige Messung → leere Zelle; gewartet bis NTP gesynct.
- REST in `WebUI`: `GET/POST /api/logs`, `POST/DELETE /api/logs/:id`, `GET /api/logs/:id/data` + `/download`. Neuer `GetPrefixHandler` für GET mit Pfad-Param. `logs_.tick()` im bestehenden 1-Hz-`tick()`.

**Phase 2 — Chart-Frontend:**
- `pnpm add uplot`. `ChartCard` (uPlot): Hydration aus Session-CSV + Live-Append aus SSE-Snapshot (`serverTime` als x). Zentrale `LogsPage` (`/settings/logs`) + `LogEditorModal` (Serien aus Snapshot-Kanälen picken). `DashboardConfig.charts[]` (Firmware `DashboardStore` + Editor-Mehrfachauswahl + Render unter dem Grid).

**Phase 3 — Online-Kompression (deine `loggingkompression.md`):**
- `LogCompressor.h`: zwei reine, NaN-sichere C++-Filter — **Linear-Interpolation** und **Swinging Door** (= Bounding-Box/Sektor). Lockstep über alle Serien (gemeinsamer Zeitstempel; eine Zeile sobald eine Serie ihre Toleranz sprengt), Timeout-Stützpunkt (`maxGapSec`). Config: `algo` + `maxGapSec` + per-Serie `tol`. Editor-UI dafür.
- 12 native Unit-Tests (`test_log_compressor`): Plateau-Kollaps, Rampen-Ecke, Spike-Breakout, Timeout, kollineare Punkte, Multi-Serien-OR, NaN, flush.

**Phase 4 — Lifecycle & Retention:**
- Logging-Toggle (`enabled`) + Controller-Binding (`bindEnableTo` → `enabled` folgt `controller.enabled()`); Flush des gepufferten Punkts beim Deaktivieren.
- Clear/Session-Rotation (`POST /api/logs/:id/clear`), Archiv (`GET …/sessions`, session-Param für data/download, `DELETE …/sessions/<start>`), eigene `ArchivePage` (`/settings/logs/:id/archive`, read-only Chart pro Session).
- Globale Retention: 200 MB Budget über `/logs`, älteste (kleinster Start-Epoch) nicht-aktive Sessions zuerst gelöscht; `pruneToBudget_` bei Session-Anlage.

**Verifikation:** esp32dev SUCCESS (Flash ~63 %, RAM 15.5 %), `pnpm typecheck` 0 Fehler, 12/12 native Tests. **HW-E2E ausstehend** (keine Hardware verfügbar).

**Commits:** `b42bbac` (Phase 1–3) + Phase-4-Commit. Branch `feat/datalog`.

**Offen / Später:** API-Dezimierung (LTTB) für lange Archiv-Zeiträume; Live-Chart-Append an `intervalSec` angleichen (aktuell 1 Hz); `webui.tar` bleibt Build-Artefakt (nicht committed).

### HW-E2E auf LilyGo S3-AMOLED (2026-06-06)

Datalog-Feature end-to-end auf echter Hardware verifiziert (env `lilygo_t_display_s3_amoled`, COM7, WLAN/SD vorhanden, NTP gesynct → `serverTime` im Snapshot). Demo-Registry: Sensor `mlt`, Aktor `kettle`, keine Controller.

**Gefundener Bug (HW-only, gefixt):** `server_.on("/api/logs", HTTP_GET)` matcht in ESPAsyncWebServer auch Sub-Pfade (`/api/logs/:id/data` etc.) und war **vor** dem `GetPrefixHandler` registriert → `/data`, `/sessions`, `/download` lieferten die Log-Liste statt CSV/JSON. Fix: `GetPrefixHandler("/api/logs/")` vor die bare-GET-Liste registriert (Prefix-Handler ignoriert die slash-lose URL). Compile-Smoke konnte das nicht zeigen — nur HW-E2E.

**Verifiziert (alle grün):** NTP-Gating + echte Epoch-Timestamps; CSV-Header + Intervall + Leerzelle bei ungültiger Messung; Sessions-Liste + active-Flag + Session-Rotation bei Reboot; Dead-Band-Kompression (Swinging-Door-Log blieb 231 B über ~13 min konstant, `none`-Log wuchs alle 2s); `?session=`-Param für Archiv-CSV; Download-GET mit Content-Disposition; Schutz der aktiven Session vor Löschen; Löschen alter Sessions; enable-Toggle; clear/Rotation. UI per `webui.tar` über `/api/update/assets` eingespielt (ustar-Format nötig — Windows-bsdtar default „pax restricted" scheitert am `TarExtractor`).

**Offene Design-Frage:** Session-Rotation bei *jedem* Reboot — ein Stromausfall mitten im Braugang splittet das Log in zwei Sessions. Bewusst so (sessionStart ist runtime-only); evtl. später „jüngste Session fortsetzen wenn < N min alt".

### Playwright-UI-Tests Datalog-Frontend + Race-Condition-Fix (2026-06-07)

Browser-UI-Tests des Datalog-Frontends (Edge via Playwright-MCP) gegen `pnpm dev` (:5173 → ESP32 192.168.178.87, LilyGo S3-AMOLED auf COM7).

**Verifiziert (alle grün):** Dashboard mit Live-SSE (`mlt`/`kettle`); LogsPage listet Logs + rendert uPlot-Charts aus Session-CSV (Swinging-Door-Log sichtbar spärlichere Stützpunkte als `none`); LogEditorModal (Name/Intervall/Serien-Picker aus Live-Snapshot, Validierung, Kompressions-Dropdown blendet `maxGapSec` + per-Serie-`±tol` dynamisch ein); ArchivePage (Session-Liste mit Datum/Größe/active-Schutz, „Ansehen" → read-only Chart pro Session); Dashboard-Charts-Config (`DashboardConfig.charts` Mehrfachauswahl, Chart rendert unter dem Grid, persistiert nach `/api/dashboards`).

**Schwerer Bug gefunden + gefixt — Cross-Task-Race auf `logs_`:** Beim Anlegen eines Logs übers UI rebootete der ESP32 (~40 s; Ping ✓, HTTP tot; alle Sessions rotierten auf eine gemeinsame Boot-Epoch = Reboot-Beweis). Root Cause: die REST-Handler (AsyncTCP-Task) mutieren `std::vector<LogCfg> logs_` (`add`→`push_back`, `remove`→`erase`, …) **ohne Synchronisation** zum `loopTask`, der in `LogStore::tick()` jeden `loop()`-Durchlauf `for (auto& l : logs_)` iteriert. `push_back` mit Realloc gibt den alten Buffer frei, während `tick()` ihn liest → Use-after-free → Panic. Erklärt: 201-Response geht raus (`add()` fertig), Reboot *danach*; nur bei Realloc kritisch → `enable`/`clear` (In-Place) liefen in der HW-E2E „grün" trotz gleicher UB. Serial-Backtrace nicht erfassbar — S3 USB-CDC re-enumeriert beim Reset.

**Fix:** rekursiver FreeRTOS-Mutex (`xSemaphoreCreateRecursiveMutex`) als `LogStore`-Member, `ScopedLock` (RAII) am Anfang jeder Methode die `logs_` liest/mutiert (`load/saveToSD`, `serialize`, `add`, `update`, `remove`, `setEnabled`, `clear`, `serializeSessions`, `deleteSession`, `sessionPath`, `tick`). Rekursiv wegen `saveToSD`→`serialize`. [LogStore.h](firmware/src/LogStore.h) + [LogStore.cpp](firmware/src/LogStore.cpp).

**HW-verifiziert nach Reflash:** 4× `POST /api/logs` + 6× `DELETE` in Folge — kein Reboot, HTTP durchgehend 200, Boot-Session der Bestands-Logs stabil (nur neue Logs bekamen erwartungsgemäß eigene First-Sample-Sessions). Test-Logs danach gelöscht, Dashboard-Chart-Config zurückgesetzt → Ausgangszustand (nur `HW-Test-Raw` + `HW-SD`).

**Folge-Bug (Frontend, gefixt):** Das per-Serie-`±tol`-Feld im `LogEditorModal` ließ nur Ganzzahlen zu — ein controlled `<input type="number">` an numerischem State schrieb bei jedem Tastendruck `Number(value)` zurück; der Zwischenstand „0." liefert bei type=number `.value===""` → `0`, der Re-Render löschte den getippten Punkt („0.5" → „5"). Betraf beide Algorithmen (bei `fill_form` im ersten Test umgangen → unbemerkt). Fix: Toleranz als **String-State** halten (Zwischenstände überleben), `type="text" inputMode="decimal"`, Parse erst beim Submit inkl. deutschem Komma (`parseFloat(s.replace(',', '.'))`, Clamp ≥0). [LogEditorModal.tsx](web/src/components/LogEditorModal.tsx). Browser-verifiziert: „0.5" bleibt erhalten, „1,5" → `tol:1.5` auf dem Gerät.

### Chart-Fixes nach User-Feedback (2026-06-07)

Vier vom User gemeldete Chart-Probleme — Root Causes per Live-uPlot-Introspektion (`__u`-Debughook) gefunden, gefixt, am Gerät verifiziert.

1. **Zeitformat/Sekunden:** uPlot nutzte sein Default-Achsenformat (12h AM/PM, keine Sekunden), ignorierte die App-Zeiteinstellung. Fix: `ChartCard` lädt die Zeit-Settings (neuer gecachter `loadTimeSettings()` in [time.ts](web/src/time.ts)) und formatiert X-Achse (`axes[0].values` → `formatTime`, mit Sekunden) + Legenden-Zeit (`series[0].value` → `formatDateTime`) selbst. Achse zeigt jetzt z.B. `17:15:45`, Legende `07.06.2026 17:15:45`. (Datum nur noch in der Legende, nicht mehr als Achsen-Unterzeile.)
2. **Aktoren/Regler nicht live (erst nach Refresh):** `parseCsv` splittete auf `\n`, die Firmware schreibt aber CRLF (`println`) → die **letzte** CSV-Spalte trug ein `\r`. Der Header-Ref wurde zu `"…\r"`; `resolveRef` fand die Registry-id nicht → Live-Append schrieb `null` (CSV-Hydration tolerierte `\r` via `Number()`, daher OK nach Reload). Da die letzte Serie meist Aktor/Regler ist → genau das Symptom. Fix: `text.trim().split(/\r?\n/)` in [api.ts](web/src/api.ts).
3. **Linie überbrückt Logging-Pause:** Beim Stopp wurde kein Marker geschrieben → letzter Wert vor Stopp mit erstem danach verbunden. Fix zweiteilig: Firmware schreibt beim `eff`-`true→false`-Übergang eine **Leerzeile** (alle Zellen NaN) bei `sessionStart>0` ([LogStore.cpp](firmware/src/LogStore.cpp)); Frontend stoppt das Live-Anhängen bei `!log.enabled` und schiebt beim Übergang einen `null`-Punkt ein. Beides bricht die uPlot-Linie (`spanGaps:false`). HW-verifiziert: Regler aus/an → CSV-Leerzeile `…531,,,` zwischen den Werten, Chart bricht sauber.
4. **Interpolierte Hover-Werte (User-Frage):** Die Legende zeigte den nächstgelegenen Stützpunkt. Jetzt zeigt sie den **linear interpolierten** Wert an der exakten Cursor-X-Position (`series[i].value` → `interpAt()`, Binärsuche + Lerp, `null` über Gaps) — passend, da beide Kompressionsalgorithmen linear rekonstruieren.

**Hinweis:** Frontend-Fixes greifen erst nach `pnpm build` + Asset-Deploy (`webui.tar` → `/api/update/assets`) auf dem Gerät; Dev-Server (`pnpm dev`) hat sie sofort. Firmware-Fix (#3) ist auf den LilyGo S3 geflasht.

### Netzwerk/WLAN-Einstellungen (2026-06-07)

Neue Settings-Seite `/settings/network` „über das Captive-Portal hinaus" (Roadmap Welle 3). Scope nach Rücksprache: **STA-Features only** (AP-Modus bewusst verschoben — ohne Internet kein NTP → bricht das frische Datalog; ggf. später mit RTC). Statische IP ausgeklammert.

**Firmware:**
- `GET /api/network` — STA-Status (`connected`/`ssid`/`ip`/`rssi`/`mac`) + konfigurierter `hostname` aus NVS. `GET /api/network/scan` — async Scan (202 läuft → 200+JSON), gleiche Mechanik wie das Captive-Portal. `POST /api/network` — `{ssid,password}` und/oder `{hostname}` → NVS schreiben + Reboot (Creds/Hostname greifen erst beim Boot). Ein gemeinsamer `GetPrefixHandler("/api/network")` dispatcht GET-Status vs. `/scan` (bare `server_.on` würde via `Type::BackwardCompatible` `^uri(/.*)?$` den Sub-Pfad schlucken — gleiche Falle wie beim Logs-Fix). [WebUI.cpp](firmware/src/WebUI.cpp).
- **Hostname konfigurierbar:** war fix `kHostname="brewcontrol"`, jetzt aus NVS `brewctrl/hostname` (Default `kHostname`). `connectStation()` ruft `WiFi.setHostname()` vor `WiFi.begin()` (DHCP), `MDNS.begin(hostname)`. [main.cpp](firmware/src/main.cpp). Validierung `validHostname()` (1–32, lowercase alnum + Bindestrich, kein führender/abschließender). Hostname liegt im NVS bei den WLAN-Creds (Netzwerk-Identität, früh verfügbar, überlebt SD-Probleme) — **nicht** im Backup (konsistent mit „Backup = nur Config, kein WiFi").

**Frontend:**
- [NetworkPage.tsx](web/src/pages/NetworkPage.tsx): Status-Karte (Signal-Balken aus RSSI + dBm, IP, `hostname.local`, MAC); „WLAN wechseln" (Scan → dedupliziertes/sortiertes SSID-Dropdown + Passwort → ConfirmModal → Reboot-Screen); „Hostname" (Inline-Validierung spiegelt die Firmware-Regel, Speichern nur bei Änderung); „WLAN zurücksetzen" (hierher verschoben). Eigener Reboot-Vollbild-Status pro Aktion (Wechsel/Rename/Reset mit passendem Text).
- `getNetwork`/`scanNetworks` (Poll-Schleife wie Portal)/`setNetwork`/`setHostname` in [api.ts](web/src/api.ts); `NetworkStatus`/`ScanNetwork` in [types.ts](web/src/types.ts); Route + Nav-Eintrag.
- **„Reset WiFi" aus dem Dashboard-Header entfernt** (jetzt in der Netzwerk-Seite) → App-`rebooting`/`RebootingView` + Dashboard-`onReset`/`ConfirmModal`-Import wurden dadurch verwaist und mit-entfernt. [Dashboard.tsx](web/src/pages/Dashboard.tsx), [app.tsx](web/src/app.tsx).

**Verifikation:** esp32dev SUCCESS (Flash 63.6 %, RAM 15.5 %), `pnpm typecheck` 0 Fehler.

**HW-Vorfall + Härtung (2026-06-07):** Erster HW-Test: Hostname-Wechsel ✓, WLAN-Reset ✓ (Reconnect über `brewcontrol.local` ✓). Aber **Klick auf „Scan" im laufenden STA-Betrieb killte die WLAN-Verbindung** → Gerät unerreichbar, kam erst per **Power-Cycle** zurück (Serial zeigte nichts → kein Crash; der Boot-Banner wird nur beim Boot ausgegeben, das Gerät lief in `loop()` weiter, nur ohne Netz). Ursache: `WiFi.scanNetworks()` im verbundenen STA hoppt über die Kanäle, die Verbindung kam ohne Reboot nicht zurück (bekannt fragile Kombi ESP32-Scan + AsyncWebServer). Scan kurz entfernt, dann auf Userwunsch wieder rein — **mit Härtung statt Entfernung:**
- **WLAN-Watchdog** in `loop()` ([main.cpp](firmware/src/main.cpp) `maintainWiFi()`): STA down → nach 10 s `WiFi.reconnect()`, nach 60 s `ESP.restart()` (Boot reconnectet oder öffnet Portal). Self-Healing gegen Aussperren — egal ob Scan, AP-Reboot oder Funkloch. Plus `WiFi.setAutoReconnect(true)` in `connectStation()`.
- **Sanfterer Scan:** `WiFi.scanNetworks(async, hidden=false, passive=false, 100ms/Kanal)` (Default 300) — kürzere Verweildauer.
- **Resilienter Poll:** `scanNetworks()` in [api.ts](web/src/api.ts) bricht bei transientem Fetch-Fehler nicht mehr ab, sondern pollt weiter; Scan-Fehler im UI schaltet automatisch auf **manuelle SSID-Eingabe** (Toggle „Netzwerk manuell eingeben", auch für versteckte Netze). [NetworkPage.tsx](web/src/pages/NetworkPage.tsx).

Nach Härtung: esp32dev SUCCESS, `pnpm typecheck` 0 Fehler.

**HW-E2E grün (2026-06-07, LilyGo S3-AMOLED, COM7):** Firmware geflasht + Frontend per `webui.tar` (ustar) deployt. `GET /api/network` ✓ (connected, IP, RSSI, MAC, hostname). **Gehärteter Scan reproduziert das Lock-out *nicht* mehr:** Scan-Kickoff 202 → Ergebnis nach 1 s (5 Netze, signal-sortiert); Erreichbarkeit unmittelbar danach 10×/20 s durchgehend HTTP 200 — **kein** Verbindungsabriss (kürzere 100-ms-Dwell macht den Scan unauffällig, Watchdog als Netz). Hostname-Wechsel + WLAN-Reset bereits im ersten Test verifiziert.

**mDNS-Diagnose + Härtung (2026-06-07):** Nach dem Deploy schien `brewcontrol.local` „tot" (ping/curl scheiterten), die IP lief aber. Ursache war **kein** Geräte-Bug, sondern **Windows-Negativ-DNS-Cache**: eine mDNS-Anfrage lief während des `TarExtractor`+`/www`-Swaps (loopTask kurz blockiert) in den Timeout, Windows cachte das NXDOMAIN (~15 min). Beweis: `Resolve-DnsName` löste durchgehend korrekt auf, `ipconfig /flushdns` stellte ping/curl/Browser-Pfad sofort wieder her (3×/3× HTTP 200). Der ESP-Responder war immer gesund. **Latentes Risiko trotzdem geschlossen:** ESP32-mDNS überlebt einen WiFi-Reconnect i. d. R. nicht — und der neue Watchdog macht Reconnects wahrscheinlicher. Fix: `WiFi.onEvent(STA_GOT_IP)` → `startMDNS()` (`MDNS.end()`+`begin(hostname_)`) re-announced mDNS bei jedem (Re-)Connect ([main.cpp](firmware/src/main.cpp)). Nach Flash verifiziert: mDNS frisch hoch (4×/4× HTTP 200 über `brewcontrol.local`). Reconnect-Survival nur code-verifiziert (kein API-Weg, die STA gezielt zu trennen).

**Watchdog zu aggressiv → AP-Falle bei Router-Reboot (2026-06-08, gefixt):** Beim Testen des mDNS-Reconnects startete der User den Router neu — das Gerät landete im **Setup-AP**. Kette: Router weg → Watchdog rebootete schon nach **60 s** → Boot-`connectStation` (30 s Timeout) lief, während die FRITZ!Box noch hochfuhr → Portal-Fallback (`runUntilConfigured` blockiert für immer) → im AP gestrandet, obwohl Creds korrekt. Auto-Reconnect hätte den kurzen Ausfall sonst überbrückt. **Fix** ([main.cpp](firmware/src/main.cpp)): (1) Watchdog entschärft — Nudge alle 30 s, `ESP.restart()` erst nach **5 min** Dauerverlust (Router-Reboot ist da längst durch, bleibt in STA); (2) Boot **wiederholt** den Connect 6×30 s (~3 min), bevor das Portal kommt — ein Reboot während eines transienten Ausfalls strandet nicht mehr im AP. Recovery des gestrandeten Geräts: simpler Power-Cycle (Creds bleiben erhalten, Portal-Fallback löscht sie nicht). esp32dev SUCCESS; geflasht + HW-verifiziert: Gerät nach Flash sofort wieder in STA (mDNS + IP je HTTP 200).

---

## Sollwert-Programme / Maischeprofile (2026-06-08, Branch `feat/setpoint-programs`)

Roadmap Welle 2. Zeitgesteuerte Setpoint-Folge mit Rasten — treibt `Controller::setSetpoint()` durch eine Liste benannter Schritte. Spec: [docs/superpowers/specs/2026-06-08-setpoint-programs-design.md](../docs/superpowers/specs/2026-06-08-setpoint-programs-design.md).

**Designentscheidungen (mit User abgestimmt):**
- **Schritt-Modell:** Sollwert springt sofort aufs Ziel, Halte-Timer zählt **ab Schrittbeginn** (kein Warten-bis-erreicht, keine lineare Rampe → sensorfrei). Schritt = `{name?, setpoint, holdSec, confirm?}`; `name` optional/kosmetisch.
- **Manuelle Freigabe:** `confirm: true` → nach Ablauf der Haltezeit Zustand `awaiting`, wartet auf „Weiter".
- **Reboot-Resume:** ja. Timing über **absolute Wall-Clock-Epoch** pro Schritt (`stepStartedEpoch`), nicht `millis()` → `elapsed = now − stepStartedEpoch` auch nach Reboot korrekt; Persistenz nur bei Übergängen (kein periodisches Schreiben). No-op bis NTP synct (wie LogStore).
- **Architektur:** BrewControl-Firmware, **keine Library-Änderung** (Maische-Profile bewusst außerhalb SensActCtrl).
- **UI:** eigenes Dashboard-Widget, referenziert via `programs[]` (analog `charts[]`).

**Firmware:**
- [ProgramRunner.{h,cpp}](firmware/src/ProgramRunner.cpp) (neu) — analog `LogStore`: `loadFromSD`/`saveToSD` (`/config/programs.json`, Definition + Laufzustand), `serialize()` (Config + abgeleitete Live-Felder `stepRemainingSec`/`currentSetpoint`), `add`/`update`/`remove`, `control(id, action, reg)` (`start/pause/resume/stop/next/prev`), `tick(reg, sd, nowEpoch)`. **Rekursiver FreeRTOS-Mutex** gegen Cross-Task-Race (AsyncTCP-Handler vs. loopTask-`tick`) — dieselbe Klasse Bug wie beim Datalog. Zustände `idle/running/awaiting/paused/done`. `control` wendet den Sollwert sofort an (AsyncTCP, wie der bestehende `/setpoint`-Handler). Pause friert `elapsedAtPauseSec` ein, Resume rechnet `stepStartedEpoch = now − elapsed` zurück (konsistent über Pause + Reboot). Start aktiviert den Regler implizit (`setEnabled(true)`). Orphan-tolerant: fehlt der referenzierte Regler, ist `tick` ein no-op (kein Crash). Resume re-appliziert beim ersten valid-clock-Tick den Sollwert des aktiven Schritts (`needsResume_`).
- [WebUI.{h,cpp}](firmware/src/WebUI.cpp) — `ProgramRunner&` im Ctor; Routen nach `/api/logs`-Muster (Sub-Pfad-Handler vor bare-Handler, alle vor `serveStatic`): `GET/POST /api/programs`, `DELETE /api/programs/:id`, `POST /api/programs/:id` (update), `POST /api/programs/:id/control`. `control`-Fehler → 404 (unbekannte id) bzw. 400 (ungültige Aktion/Status). `tick()` ruft `programs_.tick(reg_, fs_, time(nullptr))`.
- [DashboardStore.{h,cpp}](firmware/src/DashboardStore.cpp) — `programs[]` zu `DashboardCfg` (load/serialize/fillFromJson, analog `charts`).
- [main.cpp](firmware/src/main.cpp) — `ProgramRunner programRunner;` instanziiert, an WebUI übergeben, `loadFromSD(SD)`.

**Frontend:**
- [types.ts](web/src/types.ts) — `ProgramStep`/`ProgramConfig`/`ProgramStatus`/`ProgramAction`; `DashboardConfig.programs?`.
- [api.ts](web/src/api.ts) — `getPrograms`/`createProgram`/`updateProgram`/`deleteProgram`/`controlProgram`.
- [ProgramCard.tsx](web/src/components/ProgramCard.tsx) (neu, Widget) — Schrittliste (aktiver Schritt hervorgehoben, erledigte durchgestrichen, `confirm`-Marker), Status-Badge, Restzeit am laufenden Schritt; Buttons kontextabhängig (Start/Pause/Fortsetzen/Zurück/Weiter/Stop), „Weiter" im `awaiting` als Akzent. Fehlender Regler → Steuerung deaktiviert + Hinweis.
- [ProgramEditorModal.tsx](web/src/components/ProgramEditorModal.tsx) (neu) — Name, Regler-Dropdown, Schritt-Zeilen (Name optional, Sollwert, Haltezeit **in Minuten** → ×60 ins Wire-Format, `confirm`-Checkbox, Reorder/Entfernen), Löschen im Edit-Modus.
- [Dashboard.tsx](web/src/pages/Dashboard.tsx) — Programme laden + **2-s-Polling** für Live-Status (kein SSE-Eingriff); ProgramCards für `activeDash.programs`; Editor-Handler (create/update/delete); `programs` in `saveDashboard`/`removeFromDashboard`. [DashboardEditorModal.tsx](web/src/components/DashboardEditorModal.tsx) — Programme-Checkboxen + „+ Neues Programm".

**Verifikation:** esp32dev **SUCCESS** (00:03:11); `pnpm typecheck` 0 Fehler; `pnpm build` ok (175 KB JS / 56 KB gzip).

**HW-E2E grün (2026-06-08, LilyGo S3-AMOLED, COM7):** Firmware (lilygo-Env) geflasht + GUI per `webui.tar` (ustar) über `POST /api/update/assets` deployt; `GET /api/programs` ✓ (neuer Endpunkt), Index ✓. **API-E2E gegen `mash`-Regler, 13/13 PASS:** create (Schrittnamen/confirm erhalten) → start (running, step0, mashSp=40, enabled) → Auto-Advance step0→1 nach hold (sp=50) → `confirm`-Schritt → `awaiting` (sp bleibt) → next → step2 (sp=60) → pause (Restzeit eingefroren) → resume → prev (step1, sp=50) → stop (idle, step0) → Negativtest `resume@idle` → 400 → delete. **Reboot-Resume verifiziert:** Programm mit 180-s-Schritt gestartet (Restzeit 179s), Power-Cycle mitten im Schritt → nach Boot weiterhin `running`/step0, Restzeit **112s** (die ~67s Stromlos-Zeit real mitgezählt — Wall-Clock-Epoch-Design bestätigt), `mash`-Sollwert auf 42 re-appliziert + reaktiviert. Aufgeräumt (Test-Programme gelöscht, `mash` deaktiviert).

## Session 2026-07-10 — Fluent/WinUI-3-Redesign des Web-Frontends

**Runde 1 (gemerged: PR #10 + #11):**
- `NavShell` (linke NavigationView-Rail, kompakt/expandiert via Hamburger, auf
  Mobile Overlay-Drawer mit Acrylic + Backdrop), `Breadcrumb`-Komponente statt
  Zurück-Pfeilen in allen 8 Settings-Unterseiten.
- Fluent-Design-Tokens in `styles.css` (`--elev-2/8/16/64`-Schatten, Acrylic-
  Surface, Segoe-UI-Font-Stack), `lucide-preact` als Icon-Paket (tree-shaked),
  Unicode-Glyphen (`✎`, `×`, `🗑`, `⚠`, `↺`) durch Icons ersetzt.
- Karten mit Elevation (`shadow-elev-2` → hover `elev-8`), Dialoge `elev-64`;
  gemeinsame Button-Konstanten in neuem `src/ui.ts`.

**Runde 2 (dieses Update — näher an echtes WinUI 3):**
- **Akzentfarbe als Steuerfarbe**: `btnPrimary` + alle 8 rohen `bg-fg`-Primär-
  Buttons + alle Segmented-Aktivzustände auf `bg-accent text-accent-fg`
  umgestellt (folgt der Laufzeit-Akzentfarbe aus `theme.ts`). NavShell-Aktiv-
  eintrag mit vertikalem Akzent-Pill (WinUI-NavigationView-Stil, Text bleibt fg).
- **WinUI-Controls**: kanonische `inp`-Konstante in `ui.ts` (Akzent-Unterstrich
  bei Fokus via Inset-Box-Shadow, kein Layout-Shift) — ~20 Roh-Input-Strings +
  AddItemModal-`inp` migriert. Neue `ToggleSwitch`-Komponente (role=switch),
  ersetzt LogsPage-Aktiv-Pill, ControllerCard-Power-Icon und ActuatorCard-
  BinaryToggle. Nackte Checkboxen → `accent-accent`.
- **Settings wie Windows 11**: Breadcrumb in Titelgröße (Eltern muted,
  aktueller Crumb semibold — wie Win11-Settings), SettingsIndex-Karten mit
  lucide-Icon links + ChevronRight, Titel-`h1` auf `text-2xl font-semibold`.
- **ContentDialog-Footer**: alle 5 Modals auf Content-/Footer-Zonen umgebaut
  (`dialogFrame` = flex-col + overflow-hidden, `dialogFooter` = abgesetzte
  Leiste mit Trennlinie, `dialogBtnRow` = gleich breite Buttons); bei
  scrollbaren Modals bleibt der Footer unterhalb des Scrollbereichs sichtbar.

**Verifikation:** `pnpm typecheck` + `pnpm build` grün (178,9 kB JS / 59,7 kB
gzip, kein Bundle-Sprung). Browser-E2E gegen echten ESP32 via Dev-Proxy
(`brewcontrol.local`): Nav-Pill, Akzent-Buttons/-Switches (Nutzer-Akzent Grün
schlägt überall durch), Fokus-Unterstrich, Win11-Settings-Karten, 3-stufige
Archiv-Breadcrumb, Dialog-Footer — jeweils hell/dunkel + Desktop/Mobile.

## Session 2026-07-11 — Dashboard-Layout: Programm-Sidebar + Compact/Sticky-Widget

**Kontext:** Ein auf einem anderen Rechner gebautes, aufs Gerät geflashtes
Dashboard-Layout lag ungepusht im Branch `feat/dashboard-layout` (Commit
00e0d92) — aber auf dem **Vor-NavShell-Stand** (Basis 0f83ac4, Zahnrad-Header,
`min-h-screen`/`h-screen`, `shadow-sm`). Ein Merge hätte NavShell + die
Fluent/WinUI-3-Arbeit (PR #10/#11/#12) zurückgerollt. Deshalb **nicht gemerged**,
sondern die Absicht adaptiert auf den aktuellen `main` übertragen (Branch
`feat/dashboard-layout-navshell`), alter Branch danach gelöscht.

**Änderungen (2 Dateien):**
- [ProgramCard.tsx](web/src/components/ProgramCard.tsx) — Mobile-Accordion:
  eingeklappt per Default, kompakte Ein-Zeilen-Zusammenfassung (aktiver Schritt +
  Sollwert + Restzeit/„Freigabe"/„pausiert" bzw. „N Schritte"), `▸`/`▾`-Toggle
  (`lg:hidden`); Desktop zeigt die Liste immer. Neues `fill`-Prop → bei einem
  einzigen Programm füllt die Karte die Spaltenhöhe (`lg:flex lg:h-full
  lg:flex-col`, Liste scrollt intern, Buttons `lg:mt-auto`). Auf Mobil/Tablet
  `max-lg:sticky` (Offset responsiv: `top-14` unter der Mobil-Toolbar, `top-2`
  auf Tablet). **Elevation-Klassen bewusst behalten** (kein `shadow-sm`-Rückfall).
- [Dashboard.tsx](web/src/pages/Dashboard.tsx) — Content-Umbau: Programm-Sidebar
  links (`lg:w-80`, `max-lg:contents` → fließt auf Mobil oben ein) + rechter
  Scroll-Bereich (Chart oben, Sensoren/Regler/Aktoren-Grid darunter). Root
  `lg:flex lg:h-full lg:flex-col lg:overflow-hidden` — **`h-full` statt `h-screen`**
  (füllt NavShells `<main>` statt des Viewports), Panes scrollen unabhängig, die
  Seite selbst nicht. Zahnrad-Header **nicht** zurückgeholt (NavShell übernimmt).

**Verifikation:** `pnpm typecheck` + `pnpm build` grün. Browser-E2E gegen echten
ESP32 (`brewcontrol.local`): Desktop — Programm-Sidebar links + rechter Pane,
`main.scrollHeight == clientHeight` (gemessen, keine Seiten-Scrollbar), Panes
scrollen unabhängig. Mobil — Programm oben kompakt eingeklappt, Accordion klappt
korrekt auf (Fortschritt sichtbar), Steuer-Buttons bleiben beim Scrollen sticky
unter der Toolbar. Keine Konsolen-Fehler.

## Session 2026-07-13 — Dashboard-Edit-Modus + Bearbeiten-Aufteilung

**Kontext:** Im Dashboard sollte das Bearbeiten überarbeitet werden. Bisher zeigte
jede Karte permanent ✎/× und ein einzelner „Bearbeiten"-Button öffnete einen
Sammel-Modal (Name + Mitgliedschafts-Checkboxen + Neu erstellen + Löschen).

**Ergebnis (Edit-Modus + getrennte Zuständigkeiten):**
- [Dashboard.tsx](web/src/pages/Dashboard.tsx) — Neuer `editMode`-Toggle: normal
  ist das Dashboard aufgeräumt (keine ✎/×, kein „+ Neu"), nur Laufzeit-Controls
  (Regler-Toggle, Aktor-Slider, Setpoint/Apply, Programm-Start/Stop, Tare). Der
  „Bearbeiten"-Button schaltet den Modus ein → Toolbar zeigt „＋ Hinzufügen" +
  „✓ Fertig" (Akzent), Karten zeigen ✎/× (durch bedingtes Durchreichen von
  `onEdit`/`onDelete` — Kartenkomponenten unverändert), Chart-Karten bekommen ×,
  „+ Neu" erscheint. Ein kompakter Hinweis-Streifen erklärt den Modus.
- **Tab-Name abgetrennt:** Stift am aktiven Tab → [DashboardMetaModal.tsx](web/src/components/DashboardMetaModal.tsx)
  (nur Name für Erstellen/Umbenennen + Löschen). „+ Neu" legt ein leeres
  Dashboard an und landet direkt im Edit-Modus.
- **Inhalte via Checkbox-Modal:** [DashboardContentModal.tsx](web/src/components/DashboardContentModal.tsx)
  — der bisherige Checkbox-Modal, aber **ohne** Namensfeld und Löschen (die liegen
  jetzt beim Tab-Stift). Öffnet über „＋ Hinzufügen".
- Alter [DashboardEditorModal.tsx] entfernt.

**Verworfener Zwischenstand:** Kurzzeitig war der Sammel-Modal in einen
Quick-Add-Picker (Antipp-Chips + Gruppen-„+") zerlegt; auf Nutzerwunsch zurück
zum Checkbox-Modal — nur die Tab-Namen-Trennung blieb.

**Verifikation:** `pnpm typecheck` + `pnpm build` grün (182 kB JS / 60,6 kB gzip).
Browser-E2E gegen echten ESP32 (`brewcontrol.local`): Normalansicht clean;
Edit-Modus mit Tab-Stift/+Neu/Hinzufügen/Fertig; „Hinzufügen" öffnet
„Dashboard-Inhalte" mit korrekt vorausgewählten Häkchen; Add/Remove end-to-end
(Regler in Kochen hinzugefügt, per × zurückgenommen); Meta-Modal; keine
Konsolen-Fehler.

## WinUI-3-Politur Teil 1–5 (2026-07-13 – 2026-07-25)

Fünfteilige Konsistenz-Runde auf dem bestehenden Fluent-Redesign:
semantisches Farbsystem, neutrale Palette + Mica-Shell + Win11-Settings,
Fluent-2-Karten-Tokens, Firmware-Seite, Icons + Control-Positionen auf
allen Settings-Seiten. Ausführliche Session-Logs:
[SESSION-archive.md](SESSION-archive.md).

## Session 2026-07-25 — Netzwerk-Seite: mDNS-Kartenlayout + Netzwerk-Liste statt Dropdown

Nutzer-Mockup (Screenshot) für die mDNS-Karte + Wunsch nach Listen- statt
Dropdown-Auswahl für „WLAN wechseln".

**mDNS-Karte** ([NetworkPage.tsx](web/src/pages/NetworkPage.tsx)): Titel
„Hostname" → „mDNS", neue `desc` „Name vergeben, unter dem das Gerät gefunden
werden kann". Input+„.local"+„Speichern" nicht mehr im `control`-Slot der
Kopfzeile, sondern als volle Zeile im Body (`justify-between`: Input+Suffix
links, Button rechts) — mehr Platz, matcht das Mockup exakt.

**WLAN wechseln — Liste statt Dropdown:** `<select>` ersetzt durch anklickbare
Zeilen (`SignalBars` + SSID links, Status rechts). State umgebaut: `selSsid`/
`manual` (boolean) → einheitliches `expanded: string | null` (SSID der
aufgeklappten Zeile, oder Sentinel `'manual'` für die freie Eingabe — nur eine
Zeile gleichzeitig aufgeklappt). Klick auf eine Zeile klappt darunter Passwort-
Feld + „Verbinden"-Button auf (`selectNet`, toggelt beim erneuten Klick zu).
Status pro Zeile: `text-success` „Verbunden" wenn `status.ssid === n.ssid`,
sonst „Offen" (`n.open`) oder „Gesichert" — Farben/Text exakt wie vom Nutzer
vorgegeben. „Netzwerk manuell eingeben" bleibt als Fallback-Link unten in der
Liste (Scan-Fehler klappt es automatisch auf, wie zuvor).

**Verifikation:** `pnpm typecheck` + `pnpm build` grün (186,6 kB JS / 62,7 kB
gzip). Browser gegen echten ESP32: Scan liefert echte Netzwerke (FRITZ!Box 7490
als „Verbunden" in Akzent-Grün, o2-WLAN-AB40 als „Gesichert"), Klick klappt
Passwort+Verbinden korrekt auf, „Netzwerk manuell eingeben" klappt die vorherige
Zeile ein und zeigt SSID+Passwort+Verbinden — hell und dunkel geprüft.

**Nachtrag — Feinschliff Netzwerk-Liste (Nutzerfeedback):**
- Verbundenes Netz zeigt kein Passwortfeld/Verbinden-Button mehr (Klick
  highlightet die Zeile weiterhin, aber `{isExpanded && !isConnected && …}`).
- Highlight (`bg-subtle-pressed`) liegt jetzt auf dem äußeren Zeilen-Container
  statt nur auf dem Button — Passwortfeld + Verbinden-Button sitzen dadurch
  sichtbar *innerhalb* derselben hervorgehobenen Box wie die Zeile.
- Status („Verbunden"/„Offen"/„Gesichert") von rechts neben der SSID nach
  darunter verschoben, `text-xs` (Verbunden zusätzlich `text-success`) —
  gleiches Muster wie `SettingsCard.desc`.
- Farbiger Indikator links an der ausgewählten Zeile (Akzent-Pill,
  `absolute left-0 h-4 w-[3px] rounded-full bg-accent`) — identisches Muster
  zum Nav-Aktiv-Eintrag in [NavShell.tsx](web/src/components/NavShell.tsx).

Verifiziert gegen echtes Gerät: FRITZ!Box-Zeile (verbunden) zeigt Pill + „Verbunden"
ohne Formularfelder; Klick auf o2-WLAN-AB40 klappt Passwort+Verbinden innerhalb
der hervorgehobenen Box auf, vorherige Zeile klappt korrekt ein — hell und dunkel.

**Nachtrag 2 — Icon-Flucht + Indikator-Höhe:** Liste bekam `-mx-4` (kompensiert
die Card-Padding `px-4`), jede Zeile `px-4` statt `px-3` → `SignalBars` sitzt
jetzt exakt auf gleicher X-Position wie das `Wifi`-Icon der Kartenüberschrift
(per `getBoundingClientRect` verifiziert: beide `left: 33px`). Akzent-Indikator
`h-4`→`h-6` (höher) und von der Zeilen-Hülle in den `<button>` verschoben
(`relative` jetzt am Button) — bleibt dadurch an der Kopfzeile zentriert statt
über die ganze (bei Passwort-Eingabe höhere) Box zu mitteln. Manual-Entry-Block
verlor sein Extra-`px-3` (war nur nötig, um mit dem alten Zeilen-Offset zu
fluchten; jetzt erbt er direkt die Card-Einrückung).

**Nachtrag 3 — Highlight als „floating chip" (Nutzer-Referenzbild, Windows-11-
Settings-WLAN-Liste):** `-mx-4`/`px-4` → `-mx-2`/`px-2` — Icon bleibt exakt auf
der Header-Flucht (33px, per `getBoundingClientRect` erneut bestätigt), aber die
Highlight-Box bekommt jetzt ~9px sichtbaren Abstand zum Kartenrand (gemessen)
+ `rounded-md` (6px) statt kantenbündig. `space-y-1` zwischen den Zeilen für
kleinen vertikalen Abstand. Indikator `h-6 w-[3px]` → `h-8 w-1` (32×4px, größer,
bleibt vertikal zentriert auf der Kopfzeile). Verifiziert per Computed-Style-
Messung (Box-Rect vs. Card-Rect) und Screenshot hell/dunkel gegen echtes Gerät.

**Nachtrag 4 — Indikator-Inset statt fixer Höhe + Text-Einrückung (Nutzerfeedback):**
- Indikator war trotz `top-1/2 -translate-y-1/2` nicht sauber mittig und zu breit
  (`w-1`=4px). Fix: `top-1.5 bottom-1.5 w-[3px]` statt `h-8 -translate-y-1/2` —
  fester Ober-/Unterabstand (6px) statt fixer Höhe, dadurch **konstruktiv**
  zentriert (Höhe ergibt sich aus `Containerhöhe − 2×6px`), unabhängig von der
  tatsächlichen Zeilenhöhe. Verifiziert: `gapTop === gapBottom === 6px` an zwei
  unabhängigen Zeilen.
- Passwortfeld + mDNS-Textbox waren bündig mit der Icon-Spalte statt mit dem
  Titel-Text eingerückt. Fix: Passwort-Zeile `px-2` → `pl-[42px] pr-2`
  (42px = Button-`px-2`(8) + `SignalBars`-Breite(22) + `gap-3`(12), exakt der
  X-Offset des SSID-Texts). mDNS-Inputzeile + Validierungstext bekommen `pl-9`
  (36px = Icon-Größe 20 + `SettingsCard`-`gap-x-4`(16), exakter Text-Offset des
  Headers). Verifiziert: `pwInputLeft === ssidTextLeft` und
  `mdnsInputLeft === mdnsDescLeft` (beide 67px bzw. 69px, exakte Übereinstimmung).

## Kleinere Fixes 2026-08-11

Zwei isolierte Nutzerfeedback-Punkte, unabhängig von der Netzwerk-Seite:

- **Zeit & Formate — fehlende Untertitel:** Die Karten „Zeitformat" und
  „Datumsformat" hatten (anders als alle anderen `SettingsCard`s auf der
  Seite) keinen `desc`-Text. Ergänzt: „12- oder 24-Stunden-Anzeige" bzw.
  „Reihenfolge von Tag, Monat und Jahr" ([TimePage.tsx](web/src/pages/TimePage.tsx)).
- **Firmware-Update — Einrückung „Manueller Upload":** Die beiden
  `FileUpload`-Zeilen („Firmware (.bin)", „UI-Paket (.tar)") saßen bündig
  am Kartenrand statt mit dem Beschreibungstext der Karte zu fluchten.
  Fix: `pl-9` (36px = Icon-Größe 20 + `SettingsCard`-`gap-x-4` 16, selbes
  Muster wie beim mDNS-Textfeld) auf den umgebenden `space-y-4`-Container
  ([FirmwarePage.tsx](web/src/pages/FirmwarePage.tsx)). Verifiziert per
  `getBoundingClientRect`: beide Label und der Karten-`desc` liegen exakt
  auf `left: 69px`.

**Verifikation:** `pnpm typecheck` + `pnpm build` grün (186.85 kB JS /
62.83 kB gzip). Browser-Check gegen echtes Gerät (`brewcontrol.local` via
Dev-Proxy): Zeit-Seite zeigt beide Untertitel; Firmware-Seite misst
`Firmware (.bin)`/`UI-Paket (.tar)`/Karten-`desc` alle auf identischer
X-Position.

**Nachtrag — Settings-Übersicht: oberer Kartenabstand:** Die Index-Seite
([SettingsIndex.tsx](web/src/pages/SettingsIndex.tsx)) hatte `header` ohne
`mb-6` und stattdessen `mt-4` auf der Kartenliste (16px Abstand), während
alle Unterseiten `header class="mb-6"` (24px) direkt vor der Kartenliste
nutzen. Fix: `mb-6` auf den Header verschoben, `mt-4` von der Kartenliste
entfernt — Muster jetzt identisch zu z. B. `AppearancePage.tsx`. Verifiziert
per `getBoundingClientRect`: Header-Unterkante 56px, erste Karte 80px
(24px Abstand) — auf `/settings` und `/settings/appearance` identisch.

## Dashboard-Karten: einheitliche Höhe 2026-08-11

Nutzerfeedback: Sensor-, Regler- und Aktor-Karten im Dashboard hatten je
nach Inhalt unterschiedliche Höhe (gemessen: Sensor 135px, Regler 149px,
Aktor 114px) — die Reihe wirkte dadurch uneben statt bündig.

**Fix:** gemeinsames `min-h-[160px]` auf den Karten-Root-`<div>` in
[SensorCard.tsx](web/src/components/SensorCard.tsx),
[ActuatorCard.tsx](web/src/components/ActuatorCard.tsx) und
[ControllerCard.tsx](web/src/components/ControllerCard.tsx) (160px orientiert
sich am bisher höchsten Fall, der Regler-Karte mit Setpoint-Zeile). Karten mit
mehr Inhalt (z. B. Regler mit sichtbarem AutoTune-Status) wachsen weiterhin
natürlich über die Mindesthöhe hinaus — das ist gewollt, betrifft aber nicht
den Normalfall.

**Verifikation:** `pnpm typecheck` + `pnpm build` grün. Browser-Check gegen
echtes Gerät auf beiden vorhandenen Dashboards („Maischen": 1 Sensor/1 Regler/
1 Aktor; „Kochen": 1 Sensor/2 Aktoren, keine Regler) — alle Karten messen
exakt 160px, `getBoundingClientRect` bestätigt identische Bottom-Kante
(837px) für alle drei Karten der ersten Reihe auf „Maischen". Dark-Mode
gegengecheckt; Höhe ist themeunabhängig (reine Layout-Eigenschaft).

## SD-Dateiverwaltung 2026-08-21

Neue Settings-Seite zum Browsen/Hoch-/Herunterladen/Löschen/Umbenennen/
Anlegen von Dateien und Ordnern auf der SD-Karte, mit `/www` und `/www.new`
(laufende UI-Dateien bzw. OTA-Asset-Staging) als geschützt — sonst könnte
sich die Seite über sich selbst die eigene Oberfläche wegschießen.

**Firmware** ([WebUI.h](firmware/src/WebUI.h), [WebUI.cpp](firmware/src/WebUI.cpp)):
`GET /api/files?path=`, `GET /api/files/download`, `POST /api/files/upload`
(multipart, Feld `f`), `DELETE /api/files`, `POST /api/files/rename`,
`POST /api/files/mkdir`. Neuer `validFilePath_()`-Guard (Traversal-Check +
403 auf `/www`/`/www.new` bei mutierenden Ops); `removeRecursive_()` aus der
bisherigen `swapAssets_`-Lambda extrahiert (jetzt einzige Kopie, von beiden
genutzt).

**Frontend** ([FilesPage.tsx](web/src/pages/FilesPage.tsx), neu): In-Page-
Pfad-Navigator, Tabelle mit Ordner/Datei-Icons, Inline-Rename, Inline-„Neuer
Ordner", `ConfirmModal` für Löschen, Upload mit Progress (bestehendes
`uploadFile`-XHR-Helper aus `api.ts` wiederverwendet). `/www`-Zeilen bzw.
das `/www`-Verzeichnis selbst zeigen deaktivierte Rename/Delete/Ordner/
Upload-Controls mit Tooltip „Geschützt — UI-Dateien" (reines UX — der
echte Schutz ist der Backend-403, das Gerät hat ohnehin keine Auth).

**Verifikation:** `pio run -e esp32dev` + `pnpm typecheck` grün. Auf
LilyGo T-Display-S3-AMOLED geflasht (nach zwei alten `pio device monitor`-
Prozessen, die COM9 blockiert hatten) und per `curl` durchgetestet: List/
Download/mkdir/rename/delete-Rundlauf inkl. 403 auf `/www` bei allen
mutierenden Ops, Upload-Roundtrip byte-identisch, `/www` nach abgelehntem
Upload-Versuch unverändert. Neues Web-UI-Bundle (`pnpm build:sd` + `tar` +
`/api/update/assets`) live aufgespielt und im Browser gegen das Gerät
durchgeklickt — „Dateiverwaltung" erscheint in den Einstellungen, `/www`-
Navigation zeigt die deaktivierten Controls live, während die Seite sich
selbst aus `/www` bedient (der eigentliche Self-Brick-Testfall).

## LittleFS-Unterstützung für esp32dev/lolin_s2_mini 2026-08-28

User hat zwei zusätzliche Testboards (esp32dev, lolin_s2_mini) ohne SD-
Kartenleser. Ziel: UI + Persistenz komplett auf internem Flash (LittleFS)
statt SD, ohne den SD-Pfad für den LilyGo S3 (hat onboard-SD-Slot) anzufassen.
Vorab per Explore-Agenten verifiziert: `WebUI` und alle Store-Klassen
(`DynamicItems`, `SettingsStore`, `LogStore`, `DashboardStore`,
`ProgramRunner`, `FirmwareUpdater`) nehmen schon generisches `fs::FS&` — nur
`main.cpp`s Mount-Aufruf ist SD-spezifisch. `ESPAsyncWebServer`s
`serveStatic()`/`send(FS&, path)` selbst im Quellcode gegengelesen
(`.pio/libdeps/.../WebHandlers.cpp:143-171`, `AsyncWebServerRequest.cpp:24-58`):
beide fallen transparent auf `<pfad>.gz` zurück, wenn die unkomprimierte Datei
fehlt — nur die gzippten Assets müssen aufs Board, nicht `dist/` komplett
(~77 KB statt ~320 KB, empirisch bestätigt: `buildfs` mit nur-gzip baut sauber
auf die exakte 256-KB-Partitionsgröße, volle `dist/` würde sie sprengen).

**Neue Partitionstabelle** ([partitions_4mb_littlefs.csv](firmware/partitions_4mb_littlefs.csv)):
abgeleitet von `min_spiffs.csv`, je 64 KB von beiden OTA-App-Slots (1,875 MB →
1,8125 MB) in die Datenpartition verschoben (128 KB → 256 KB). Bei aktueller
Flash-Nutzung (1.382.373 B nach den MQTT/Webhook/ESP-NOW-Änderungen dieser
Session) ergibt das ~72,7 % App-Slot-Belegung, ~27 % Puffer.

**Firmware** ([platformio.ini](firmware/platformio.ini), [main.cpp](firmware/src/main.cpp)):
`esp32dev`/`lolin_s2_mini` bekommen `-DBREWCTL_USE_LITTLEFS=1` +
`board_build.filesystem = littlefs` + die neue Partitionstabelle;
`lilygo_t_display_s3_amoled` unverändert. `main.cpp`: `#ifdef
BREWCTL_USE_LITTLEFS`-Zweig mountet `LittleFS.begin(true)` statt `SD.begin(...)`,
neuer `fs::FS& deviceFs`-Alias ersetzt alle direkten `SD`-Referenzen (reiner
Parameter-Swap, da alle Ziel-Signaturen schon `fs::FS&` waren), `sdOk` →
`fsOk` umbenannt (gilt jetzt für beide Dateisysteme). `SdLock` bewusst
unverändert um alle FS-Zugriffe behalten (generischer Mutex, kein SD-Detail).

**Deploy** ([firmware/data/www/](firmware/data/www/), gitignored Build-Artefakt
wie `.pio`): `pnpm build:sd` → nur `*.gz`-Dateien nach `firmware/data/www`
kopieren (Struktur erhalten) → `pio run -t uploadfs` pro Board flasht das
LittleFS-Image per USB. Ersetzt den SD-Card-Copy-Schritt für diese zwei Boards;
`webui.tar`-Netzwerk-Upload-Pfad bleibt unverändert nutzbar (schon FS-agnostisch).

**Bekannte Einschränkung, bewusst nicht gelöst:** `FirmwareUpdater::flashFromSdImage()`
(Offline-Boot-Flash-Recovery via `firmware.bin`) passt nicht mehr auf 256 KB —
Netzwerk-OTA (Normalfall) ist davon unberührt. `LogStore` hat keine Retention/
Rotation — auf 256 KB sollte auf diesen beiden Boards nicht unbegrenzt geloggt
werden.

**Verifikation:** `pio run -e esp32dev` (72,8 % Flash, passt exakt zur Planung),
`pio run -e lolin_s2_mini` (69,5 %), `pio run -e lilygo_t_display_s3_amoled`
(20,0 %, Regressions-Guard — unverändert) alle grün. `pio run -e esp32dev
-t buildfs` baut das LittleFS-Image (262.144 B = exakt Partitionsgröße) aus
`data/www` (76.439 B, nur gzip) erfolgreich; volle `dist/` (328.485 B, roh+gzip)
hätte nicht gepasst (rechnerisch bestätigt, nicht extra gebaut).

**Hardware-Verifikation LOLIN S2 Mini (2026-08-28, Folge-Session):** `uploadfs` +
`upload` per USB (COM-Port wechselt bei ESP32-S2 nativem USB zwischen Firmware-
und Download-Modus — `esptool` meldet nach dem Schreiben einen kosmetischen
Fehler „can not exit download mode over USB", Daten waren aber jeweils
„Hash of data verified"; nach manuellem Reset lief die Firmware normal).
Board unter `brewcontrol-lolin.local` erreichbar (bereits aus früherer Session
mit WLAN-Zugangsdaten versorgt). Verifiziert: `GET /` liefert die UI mit
`Content-Encoding: gzip` (bestätigt den `.gz`-only-Serve-Pfad live, nicht nur
aus dem Quellcode), `GET /api/files?path=/` zeigt `www`+`config` auf der
gemounteten LittleFS-Partition. Persistenz-Rundlauf: dynamischen Sensor
angelegt, Reboot über `POST /api/network` (gleicher Hostname erneut gesetzt —
löst Reboot aus ohne WLAN-Zugangsdaten zu ändern) ausgelöst, Sensor nach
Neustart weiterhin vorhanden (frischer Timestamp bestätigt echten Reboot).
Test-Sensor wieder gelöscht. LilyGo S3 (`brewcontrol.local`, SD-Pfad
unverändert) parallel als Regressions-Check bestätigt — weiterhin erreichbar.

**Hardware-Verifikation esp32dev (2026-08-28, gleiche Session):** Dieser
Dev-Kit-Klon geht nicht automatisch in den Download-Modus (`esptool`:
„Wrong boot mode detected (0x13)") — braucht für **jeden** Flash-Vorgang
manuell BOOT gedrückt halten + EN/RST antippen, dann BOOT weiter halten bis
`esptool` verbindet (klassischer Klon ohne zuverlässige Auto-Reset-Schaltung).
Danach `uploadfs` + `upload` erfolgreich. Board hatte keine gespeicherten
WLAN-Zugangsdaten (erster echter Boot) — Setup-Portal-AP „BrewControl-Setup"
kam hoch, User hat manuell verbunden, danach unter `brewcontrol-esp32dev.local`
erreichbar. Boot-Log **direkt** (nicht nur funktional erschlossen) bestätigt:
„LittleFS mounted". Gleicher Verifikations-Rundlauf wie beim LOLIN S2 Mini:
`GET /` mit `Content-Encoding: gzip`, `/api/files?path=/` zeigt `www` auf
LittleFS, dynamischer Sensor übersteht Reboot (via `/api/network`-Hostname-
Resubmit ausgelöst). Test-Sensor gelöscht. LOLIN S2 Mini + LilyGo S3 parallel
als Regression bestätigt — beide weiterhin erreichbar.

**Damit sind alle drei Boards (esp32dev, LOLIN S2 Mini via LittleFS; LilyGo S3
via SD) hardware-verifiziert.** Harmloser Nebenbefund im esp32dev-Boot-Log:
eine Core-Dump-Checksum-Warnung von einer alten Core-Dump-Partition (Offset
hat sich mit der neuen Partitionstabelle verschoben) — nicht fatal, ESP-IDF
ignoriert einen ungültigen Core-Dump einfach.

## 2026-08-29 — Bug gefunden + gefixt: eingebauter MQTT-Broker verwarf alle Retained-Messages

**Ausgangslage:** Alle drei Boards jetzt parallel online, damit erstmals der
in der Remote-Node-Session (2026-08-21) offen gelassene Punkt nachholbar:
echter State-Empfang von einem tatsächlichen zweiten Board (bisher nur „legt
korrekt an, zeigt sauber stale ohne Leaf" verifiziert). Kein extra Leaf-Sketch
nötig — `MqttService` verdrahtet bereits automatisch einen `RemotePublisher`,
der die komplette eigene Registry spiegelt, sobald MQTT aktiviert ist
([MqttService.cpp:62-96](firmware/src/MqttService.cpp)). LilyGo S3 lief bereits
mit aktiviertem eingebautem Broker (aus einer früheren Session). LOLIN S2 Mini
testweise als externer MQTT-Client auf LilyGos Broker konfiguriert
(`POST /api/settings`, `mode:"external"`, `host:<LilyGo-IP>`), dann per
`POST /api/sensors` ein `Remote`-Sensor (`transport:"mqtt"`, `device:"brewcontrol"`,
`remote_id:"mlt"`, `prefix:"brewcontrol"`) angelegt — zeigt auf LilyGos echten
`mlt`-Temperatursensor.

**Bug:** State kam korrekt an (`v` folgte live dem echten Sensorwert), aber
`meta` (kind/quantity/unit/min/max/res) blieb dauerhaft auf den Default-Werten
(`Binary`/`None`/`0`/`0`/`0`) — auch nach vollständigem Reboot von LOLIN (kein
Timing-Zufall). Root Cause im TinyMqtt-Quellcode nachgelesen: `RemotePublisher`
publiziert Meta nur einmal (bei `begin()`/Reconnect) mit `retained=true`, State
dagegen periodisch — ein neuer Subscriber lernt Meta also nur über eine
Retained-Message-Zustellung beim Subscribe. `MqttService.cpp:36` konstruierte
den eingebauten Broker aber als `MqttBroker(port)` ohne `retain_size` —
Default ist `0`, und TinyMqtts eigenes README sagt explizit „Supports retained
messages (not activated by default)". Bei `retain_size==0` tut
`MqttBroker::retain()` schlicht nichts — der eingebaute Broker hielt **keine**
einzige Retained-Message vor, unabhängig vom `retain`-Flag der Publisher.
Betrifft nur den eingebauten Broker-Modus; externe Broker (Mosquitto etc.)
sind vermutlich nicht betroffen (Retain dort standardmäßig aktiv), aber
ungetestet.

**Fix:** `MqttBroker(port, /*retain_size=*/64)` in
[MqttService.cpp:36](firmware/src/MqttService.cpp:36) — 64 Topic-Slots
(Sensor/Aktor je 2 Topics, Controller 1; aktuell 13 auf LilyGo, deutlicher
Puffer für Laufzeit-Wachstum via `DynamicItems`). `retain_size` ist eine
Obergrenze für die Anzahl **verschiedener** Topics mit Retained-Message
(LRU-Eviction des ältesten Topics bei Überlauf, kein Payload-Größen-Limit) —
im TinyMqtt-Quellcode verifiziert (`TinyMqtt.cpp:961-991`), nicht geraten.

**Verifikation:** `pio run` alle drei Envs grün (Flash-Werte unverändert
gegenüber der letzten Messung). LilyGo S3 geflasht (COM9, sauberer Reset via
RTS, keine manuellen Buttons nötig), komplette Registry (Sensoren, Aktoren,
laufendes `mash`-Programm) nach Reflash unverändert vorhanden — Regressions-
Check bestanden. Derselbe Zwei-Board-Test wiederholt: Meta kommt jetzt korrekt
an (`kind:"Continuous"`, `quantity:"Temperature"`, `unit:"°C"`, `min:-55`,
`max:125`, `res:0.0625` — identisch zu LilyGos echtem `mlt`-Sensor). Damit ist
der MQTT-Remote-Pfad jetzt vollständig E2E bestätigt (State **und** Meta, mit
echtem Leaf über zwei physische Boards). Test-Sensor gelöscht, LOLINs
MQTT-Settings zurückgesetzt (disabled, wie vor dem Test).

**Weiterhin offen:** Webhook- und ESP-NOW-Leaf-Test — dafür kann BrewControl
aktuell nicht als Sender auftreten (`RemotePublisher` ist nur an `MqttService`
verdrahtet, nicht an `WebhookService`/`EspNowTransport`); bräuchte entweder
einen Board mit dem Beispiel-Sketch ([10_remote_webhook](../SensActCtrl/examples/10_remote_webhook),
[09_remote_espnow](../SensActCtrl/examples/09_remote_espnow)) als Leaf, oder
ein neues Firmware-Feature („BrewControl sendet eigene Items auch über
Webhook/ESP-NOW") — noch nicht entschieden.

## 2026-08-29 — Feature: Publish-Pfad für Webhook + ESP-NOW (symmetrisch zu MqttService)

**Ausgangslage:** Direkte Folge des obigen MQTT-Zweitgeräte-Tests — Webhook und
ESP-NOW waren in der Firmware bisher nur Consumer-seitig verdrahtet
(`DynamicItems::resolveRemoteTransport()` reicht `type:"Remote"`-Items einen
Transport durch), es gab aber keinen Pfad, der die eigene Registry über diese
beiden Transporte nach außen anbietet — anders als MQTT, wo `MqttService`
das bereits automatisch tut. Auf Library-Ebene (SensActCtrl) war alles
Nötige schon vorhanden (`EspNowTransport`/`WebhookTransport` implementieren
beide `ITransport` wie `MqttTransport`, `RemotePublisher` ist transport-
agnostisch) — die Lücke war rein BrewControl-firmware- und Frontend-seitig.

**Umsetzung** (Details im Plan-Dokument dieser Session, hier nur die Kernpunkte):

- **`DynamicItems`**: die sechs Live-Add/Remove-Hooks (`setOnSensorAdded` etc.)
  waren `std::function`-Einzel-Member, die bei jedem `set...()`-Aufruf
  überschrieben wurden — `MqttService` belegte sie bereits, ein zweiter/dritter
  Aufrufer (Webhook/ESP-NOW-Publish) hätte MQTTs Live-Tracking klammheimlich
  kaputt gemacht. Auf `std::vector<std::function<...>>` umgebaut (mehrere
  Beobachter, in Registrierungsreihenfolge aufgerufen) — API-kompatibel zu
  bestehenden Aufrufern.
- **`SettingsStore`**: neue Felder `webhookEnabled/webhookListenPort/
  webhookPeerUrl/webhookClientId/webhookTopicPrefix` und
  `espnowEnabled/espnowClientId/espnowTopicPrefix`, dreifach gespiegelt
  (`loadFromSD`/`serialize`/`update`) nach dem bestehenden `mqtt*`-Muster.
  Kein Channel-Setting für ESP-NOW — reitet den bestehenden globalen
  `EspNowTransport` (fixer Channel 1).
- **`WebhookService`** um Publish-Fähigkeit erweitert (`beginPublish()`,
  `attachExistingPublish()`, `publishConnected()`/`publishLastErrorMessage()`)
  statt einer neuen Klasse — sie ist bereits Transport-Owner/Cache für diesen
  Transporttyp; ein Publish-Ziel reuse't `getOrCreate()` genau wie ein
  Consumer-Item.
- Neue Klasse **`EspNowPublishService`** (kein Analogon zum Erweitern
  vorhanden) — nimmt den bestehenden globalen `EspNowTransport` per Pointer
  entgegen (Konstruktor-Reihenfolge: der globale Service existiert vor
  `setup()`, der Transport erst danach).
- **`WebUI`**: Konstruktor um `WebhookService&`/`EspNowPublishService&`
  erweitert, `/api/settings` GET/POST um `webhook`/`espnow`-Sektionen ergänzt
  (Validierung + gemeinsamer Reboot-Trigger wie bei `mqtt`).
- **`main.cpp`**: neue Verdrahtung reihenfolgekritisch — `espNowPublishService.begin()`
  erst nach `espNowTransport`-Konstruktion UND `settingsStore.loadFromSD()`
  möglich, beide an der `mqttService.begin()`-Stelle bereits erfüllt.
- **Web-Frontend**: `WebhookSettings`/`EspNowSettings` in `types.ts`, neue
  Seiten `WebhookPage.tsx`/`EspNowPage.tsx` (Klon von `MqttPage.tsx`), zwei
  neue `SettingsIndex`-Einträge + Routen.

**Verifikation:** `pio run` alle drei Envs grün (esp32dev 73,2 % Flash,
lolin_s2_mini 69,9 %, lilygo_t_display_s3_amoled 20,1 % — je +0,5–0,8pp
gegenüber vorher). `pnpm typecheck` grün. Neue Settings-Seiten im Vite-Dev-
Server gegen echtes Board geprüft (Rendering, Icons, keine Konsolenfehler).
Beide Boards (LilyGo COM9, LOLIN COM5) per USB neu geflasht, UI-Bundle-Upload
auf LOLIN schlägt fehl (`Connection was reset` bei `/api/update/assets`,
unverändeter Asset-Upload-Pfad — siehe „Beiläufig gefunden" unten; nicht
blockierend, da alle Tests direkt über die API liefen).

Hardware-Test beider Boards live:
- **Webhook:** LOLIN (`enabled, listenPort:8080, peerUrl:""`) + LilyGo
  (`enabled, peerUrl:"http://192.168.178.82:8080"`) → LilyGos eigener
  Retained-Cache (`GET :8080/brewcontrol/lilygo/sensor/mlt/meta`) zeigt
  korrektes Meta+State direkt nach Boot — Publish-Pfad selbst bestätigt.
  `Remote`-Consumer-Sensor auf LOLIN (anderer lokaler Port 8081, da LOLINs
  eigener Publish-Transport bereits Port 8080 mit einem anderen Peer belegt —
  `WebhookService::getOrCreate()` cached strikt nach `(port,peerUrl)`-Paar,
  zwei verschiedene Peers auf demselben Port öffnen zwei `WebServer`-Instanzen
  auf demselben physischen Port; vorbestehendes Cache-Design, hier nicht
  angefasst) empfing nach einem sauberen Reboot Meta **und** State korrekt.
  Direkt nach dem Anlegen blieb Meta einmal aus (vermutlich transienter
  Zustand nach mehreren dynamischen Sensor-Add/Remove-Zyklen im selben
  Boot) — nach Reboot reproduzierbar korrekt.
  **Negativtest bestätigt das dokumentierte Blocking-Risiko:** Peer auf eine
  nicht erreichbare IP gesetzt → **alle** HTTP-Requests an das Board
  (auch `/api/snapshot`, unabhängig vom Webhook-Pfad) hingen ~2,5 s pro
  Versuch bzw. schlugen zeitweise ganz fehl, bis der Reboot mit
  deaktiviertem Webhook griff — `WebhookTransport::publish()` blockiert
  `loop()` mit `HTTPClient::POST`, wie in der Architektur-Bewertung erwartet.
- **ESP-NOW:** beide Boards `enabled:true` → `connected:true`.
  `Remote`-Consumer-Sensor auf LOLIN: **State kam sofort und zuverlässig an**
  (Live-Broadcast, mehrfach mit steigendem Timestamp bestätigt), **Meta blieb
  dauerhaft auf Default-Werten** — auch nach zwei sauberen Reboots beider
  Boards reproduzierbar, also kein Timing-Zufall. `EspNowTransport`s
  Retained-Request/Reply-Mechanismus (`subscribe()` broadcastet eine
  1-Byte-Anfrage, der Leaf soll seinen `retained_`-Cache daraufhin
  zurücksenden — im Quellcode korrekt aussehend, siehe `EspNowTransport.cpp`)
  liefert auf dieser Hardware in der Praxis kein Meta an spät hinzugefügte
  Subscriber. Reine SensActCtrl-Library-Charakteristik (Code hier nicht
  angefasst), nicht Teil dieses Scopes zu fixen — als offener Befund
  festgehalten (siehe unten).

Nach jedem Testblock: Test-Sensoren gelöscht, `webhook`/`espnow`-Settings auf
beiden Boards zurückgesetzt (disabled). Abschließender Regressions-Check:
LilyGos volle Registry (Sensoren/Aktoren/`mash`-Controller) und MQTT-Status
(embedded, connected) unverändert; LOLIN wieder leere Registry wie vor dem
Test.

**Bekannte, akzeptierte Einschränkungen** (dokumentiert, nicht Teil dieses Fixes):
- Webhook-Publish blockiert `loop()` bei unerreichbarem Peer (live bestätigt,
  s.o.) — `HTTPClient::POST` ist blockierend, Cadence passt für ~1 Hz State,
  nicht für einen dauerhaft unerreichbaren Peer.
- ESP-NOW verwirft Pakete >250 Byte silently (`EspNowTransport::sendDataPacket_`)
  — Controller mit vielen Params sind Kandidaten für permanent fehlendes Meta.
- **Neu gefunden:** ESP-NOW liefert Meta an spät hinzugefügte Subscriber über
  den Retained-Request-Mechanismus auf dieser Hardware nicht zuverlässig
  (State funktioniert einwandfrei) — reproduzierbar über zwei saubere Reboots,
  Ursache nicht weiter eingegrenzt (SensActCtrl-Library, außerhalb des Scopes
  dieser Änderung). Für ESP-NOW-Leafs bedeutet das: ein `Remote`-Sensor, der
  erst nach dem Leaf-Boot angelegt wird, bekommt aktuell nur State, kein Meta
  (kind/unit/min/max/res bleiben auf Default) — für BrewControls Dashboard
  praktisch relevant (Anzeige-Einheit/Skala fehlt), sollte bei Bedarf als
  eigener SensActCtrl-Bug untersucht werden.
- `lastErrorMessage()` liefert für Webhook/ESP-NOW strukturell immer `""`
  (nur `MqttTransport` überschreibt es) — kein Bug, nur beim Blick auf die
  Status-Anzeige in der UI zu beachten.

**Beiläufig gefunden (nicht behoben, nicht Teil dieses Scopes):** `POST
/api/update/assets` (UI-Tar-Upload) schlägt auf LOLIN S2 Mini reproduzierbar
mit `Connection was reset` nach ~65 KB fehl (Board bleibt danach stabil
erreichbar, kein Crash) — vorbestehender, unveränderter Code-Pfad
(`SdTarSink`/`TarExtractor`), nicht durch diese Änderung berührt. LilyGo S3
war vom selben Upload nicht betroffen (`HTTP 200`). Nicht weiter untersucht.

## 2026-08-29 — Fix: Webhook-Publish blockiert `loop()` nicht mehr unbegrenzt

**Ausgangslage:** Aus dem "Bekannte Probleme"-Backlog (siehe PLAN.md) —
`WebhookTransport::publish()`/`pullRetained_()` (SensActCtrl) machen einen
blockierenden `HTTPClient`-Call ohne Timeout. Bei unerreichbarem Peer hing
das Board für ~2,5s *pro Versuch*, und `RemotePublisher::tick()` versucht
das bei jedem Loop-Durchlauf erneut — spürbar auch für unbeteiligte Requests
wie `/api/snapshot`.

**Entscheidung:** Nutzer wollte prüfen, ob echtes Async (Option B: FreeRTOS-
Task + Queue, `HTTPClient`-Call komplett aus `loop()` raus) machbar ist.
Bewertet und verworfen — würde Multi-Threading in einen bisher komplett
single-threaded Layer einführen (Mutex um `retained_`/`subs_` nötig,
Thread-Safety-Review für `RemoteSensor`/`RemoteActuator`-Callbacks, kein
nativer Test für den `ARDUINO`-Pfad). Aufwand/Risiko für ein Hobby-Projekt
nicht gerechtfertigt, wenn der pragmatischere Fix denselben praktischen
Nutzen bringt. Stattdessen **Option A**: Timeout + Backoff, synchron.

**Umsetzung** (`SensActCtrl/src/transport/WebhookTransport.h`/`.cpp`):
- `http.setTimeout(800)` vor jedem `POST`/`GET` (statt `HTTPClient`-Default
  von mehreren Sekunden).
- Nach einem fehlgeschlagenen Outbound-Call (POST oder GET) 5s Backoff für
  den gesamten Transport (ein Peer pro Instanz) — in dem Fenster wird
  `publish()`/`pullRetained_()` sofort `false`/no-op zurückgegeben, **ohne**
  überhaupt einen Netzwerk-Call zu versuchen. Ein Erfolg setzt den Backoff
  zurück.
- Wraparound-sicherer `millis()`-Vergleich (`now - lastFailureMs_ <
  kBackoffMs`), gleiches Idiom wie in `RemotePublisher`.
- Native Stubs (`!ARDUINO`-Zweig) für die drei neuen privaten Helper
  ergänzt (No-ops), damit der native Build weiter linkt.

**Verifikation:**
1. `pio test -e native` (SensActCtrl): 192/192 Tests grün.
2. Compile-Smoke alle drei BrewControl-Envs (`esp32dev`, `lolin_s2_mini`,
   `lilygo_t_display_s3_amoled`): alle SUCCESS, Flash-Nutzung unverändert.
3. Hardware-Negativtest auf LilyGo (`192.168.178.87`): Webhook mit
   unerreichbarer `peerUrl` (`192.168.178.250:8080`) aktiviert, danach 14×
   `/api/snapshot` im ~0,7s-Abstand über ~10s gemessen. Vorher (2026-08-29,
   siehe oben): ~2,5s pro Request. Jetzt: durchgehend 72–173ms, kein
   einziger Ausreißer. Danach Webhook wieder deaktiviert, Board auf
   Baseline zurückgesetzt.

**Bewusst nicht gemacht:** echtes Async (Option B) — bleibt als möglicher
Folge-Schritt, falls die synchrone Backoff-Lösung sich in der Praxis als
nicht ausreichend erweist. `publish()`/`pullRetained_()` können weiterhin
kurz (bis 800ms) blockieren, wenn der Backoff gerade abgelaufen ist und ein
neuer Versuch fällig wird.

**Geänderte Dateien:** `SensActCtrl/src/transport/WebhookTransport.h`,
`SensActCtrl/src/transport/WebhookTransport.cpp`.

## 2026-08-29 — Fix: `lastErrorMessage()` für Webhook + ESP-NOW

**Ausgangslage:** Aus dem "Bekannte Probleme"-Backlog — nur `MqttTransport`
überschrieb `ITransport::lastErrorMessage()`; Webhook/ESP-NOW lieferten
strukturell immer `""`, egal was schiefging. Damit war die Fehler-Anzeige
in der Settings-UI für diese beiden Transporte tot.

**Umsetzung:**
- **`WebhookTransport`**: `lastErrorMessage()` überschrieben. Anders als
  bei MQTT (nur `!connected()`) wird der Text auch gezeigt, wenn
  `connected()==true` — `connected()` reflektiert bei Webhook nur WLAN, sagt
  aber nichts über Peer-Erreichbarkeit, und genau *das* ist der praktisch
  relevante Fehlerfall (siehe Timeout/Backoff-Fix von vorhin). Neuer Helper
  `describeHttpFailure(int code)` übersetzt `HTTPClient`-Fehlercodes
  (`HTTPC_ERROR_*`) und HTTP-Statuscodes in deutsche Kurztexte (z.B.
  "Verbindung zum Peer abgelehnt", "Peer antwortete mit HTTP 404"). Wird bei
  jedem fehlgeschlagenen `publish()`/`pullRetained_()` gesetzt, bei Erfolg
  geleert. `http.begin()`-Fehlschlag (ungültige URL) meldet jetzt ebenfalls
  einen Fehler statt nur `false` zurückzugeben.
- **`EspNowTransport`**: `lastErrorMessage()` überschrieben, deckt zwei
  Fälle ab: (a) Init-Fehler (`esp_now_init()`/`esp_now_add_peer()`
  fehlgeschlagen — vorher schon über `connected()==false` sichtbar, aber
  ohne Text) und (b) der aus dem Backlog bekannte, bisher komplett stille
  "Paket >250 Byte wird verworfen"-Fall (`sendDataPacket_()`) — jetzt z.B.
  "Paket zu groß (312 Byte, max 250) — verworfen". Der Drop selbst bleibt
  bestehen (kein Scope dieser Änderung), nur die Sichtbarkeit ist neu.
- Native Stubs (`!ARDUINO`) für beide Transporte um `lastErrorMessage() { return ""; }`
  ergänzt, sonst Linker-Fehler im nativen Build.
- Keine BrewControl-seitigen Änderungen nötig — `WebhookService`/
  `EspNowPublishService`/`WebUI.cpp` reichen `ITransport::lastErrorMessage()`
  bereits transparent bis in `/api/settings` durch (`webhook.error`/
  `espnow.error`).

**Verifikation:**
1. `pio test -e native` (SensActCtrl): 192/192 grün.
2. Compile-Smoke alle drei BrewControl-Envs: SUCCESS.
3. Hardware auf LilyGo: Webhook mit unerreichbarer `peerUrl` aktiviert →
   `GET /api/settings` zeigt `"webhook":{"error":"Verbindung zum Peer
   abgelehnt", ...}` statt `""`, Antwortzeit weiterhin ~100ms (Backoff aus
   dem vorherigen Fix bleibt intakt). Danach Webhook deaktiviert, `error`
   wieder `""` — Baseline wiederhergestellt.
4. ESP-NOW-Seite (Init-Fehler-Text, Paket-zu-groß-Text) **nicht** auf
   Hardware nachgestellt — kein Controller mit genug Params zur Hand, um
   die 250-Byte-Grenze gezielt zu reißen, und ein Init-Fehler ist auf
   funktionierender Hardware nicht provozierbar. Nur Compile-Smoke +
   Code-Review, gleicher Verifikationsstand wie der ursprüngliche
   250-Byte-Fund selbst.

**Geänderte Dateien:** `SensActCtrl/src/transport/WebhookTransport.h`/`.cpp`,
`SensActCtrl/src/transport/EspNowTransport.h`/`.cpp`.
