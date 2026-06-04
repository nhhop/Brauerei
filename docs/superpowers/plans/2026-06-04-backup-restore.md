# Backup & Restore Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Export der gesamten BrewControl-Konfiguration als eine JSON-Datei und Restore (Upload → validieren → überschreiben → Reboot).

**Architecture:** Zwei neue Routen in der bestehenden `WebUI`: `GET /api/backup` bündelt die drei Store-`serialize()`-Ausgaben zu einer Datei; `POST /api/backup` validiert das Bündel, schreibt die drei Sektionen verbatim in `/config/{registry,dashboards,settings}.json` und triggert den bestehenden `rebootAtMs_`-Reboot. Der Boot-Pfad (`loadFromSD`) lädt die wiederhergestellte Config — keine Live-Re-Registrierung. Browser-Seite: eine `BackupPage` mit Export-Download und Import-Upload, Pattern wie `FirmwarePage`.

**Tech Stack:** ESPAsyncWebServer (`AsyncCallbackJsonWebHandler`), ArduinoJson v7, Preact + TypeScript (Vite). Kein neuer Firmware-Serialisierungscode — die Sektionen sind 1:1 die bestehenden Store-Ausgaben.

**Referenz-Spec:** [docs/superpowers/specs/2026-06-04-backup-restore-design.md](../specs/2026-06-04-backup-restore-design.md)

---

## File Structure

**Modifiziert (Firmware):**
- `BrewControl/firmware/src/WebUI.h` — Deklaration `writeSection_`-Helfer (private).
- `BrewControl/firmware/src/WebUI.cpp` — `#include "version.h"`, die zwei `/api/backup`-Routen in `begin()`, Definition `writeSection_`.

**Modifiziert (Web):**
- `BrewControl/web/src/api.ts` — `downloadBackup()`, `restoreBackup()`.
- `BrewControl/web/src/app.tsx` — Route `/settings/backup`.
- `BrewControl/web/src/pages/SettingsIndex.tsx` — Kachel „Backup & Restore".

**Neu (Web):**
- `BrewControl/web/src/pages/BackupPage.tsx` — Export/Import-Seite.

**Format-Referenz** (was die Routen bündeln/erwarten):
- `registry`-Sektion == `DynamicItems::serializeConfig()` → `{"sensors":[…],"actuators":[…],"controllers":[…]}` (Objekt).
- `dashboards`-Sektion == `DashboardStore::serialize()` → `[…]` (Array).
- `settings`-Sektion == `SettingsStore::serialize()` → `{"theme":{…},"firmware":{…}}` (Objekt).

---

## Phase 1 — Firmware: /api/backup-Routen

### Task 1: GET + POST /api/backup + writeSection_-Helfer

**Files:**
- Modify: `BrewControl/firmware/src/WebUI.h`
- Modify: `BrewControl/firmware/src/WebUI.cpp`

- [ ] **Step 1: `writeSection_`-Deklaration in WebUI.h**

In `BrewControl/firmware/src/WebUI.h`, neben den anderen privaten Methoden (`swapAssets_();`) ergänzen:

```cpp
  void swapAssets_();
  // Writes one backup section (a JSON object/array) verbatim to `path`.
  bool writeSection_(const char* path, ArduinoJson::JsonVariantConst v);
```

> Hinweis: `ArduinoJson.h` ist in `WebUI.cpp` bereits inkludiert; in `WebUI.h` ist
> `JsonVariantConst` über `SettingsStore.h` → `ArduinoJson.h` transitiv verfügbar.
> Falls der Build den Typ in `WebUI.h` nicht findet, `#include <ArduinoJson.h>`
> oben in `WebUI.h` ergänzen.

- [ ] **Step 2: `#include "version.h"` in WebUI.cpp**

In `BrewControl/firmware/src/WebUI.cpp`, bei den projektlokalen Includes (nach `#include <memory>`) ergänzen:

```cpp
#include "version.h"
```

(Liefert `BREWCTL_VERSION` / `BREWCTL_VARIANT` für die informativen Felder.)

- [ ] **Step 3: Routen in `begin()` registrieren**

In `BrewControl/firmware/src/WebUI.cpp`, **vor** der `server_.serveStatic("/", fs_, "/www")`-Zeile (zu den anderen `/api/*`-Routen) einfügen:

```cpp
  // ── Backup & Restore ───────────────────────────────────────────────────────
  // GET: bundle the three /config stores into one downloadable JSON file.
  server_.on("/api/backup", HTTP_GET, [this](AsyncWebServerRequest* req) {
    String out = "{\"type\":\"brewcontrol-backup\",\"version\":1,"
                 "\"firmwareVersion\":\"";
    out += BREWCTL_VERSION;
    out += "\",\"variant\":\"";
    out += BREWCTL_VARIANT;
    out += "\",\"registry\":";
    out += items_.serializeConfig();
    out += ",\"dashboards\":";
    out += store_.serialize();
    out += ",\"settings\":";
    out += settings_.serialize();
    out += "}";
    AsyncWebServerResponse* resp = req->beginResponse(200, "application/json", out);
    resp->addHeader("Content-Disposition",
                    "attachment; filename=\"brewcontrol-backup.json\"");
    req->send(resp);
  });

  // POST: validate a backup bundle, overwrite the three /config files, reboot.
  server_.addHandler(new AsyncCallbackJsonWebHandler("/api/backup",
      [this](AsyncWebServerRequest* req, JsonVariant& json) {
        if (!json.is<JsonObject>()) { req->send(400, "text/plain", "invalid JSON"); return; }
        JsonObject o = json.as<JsonObject>();
        if (strcmp(o["type"] | "", "brewcontrol-backup") != 0) {
          req->send(400, "text/plain", "not a brewcontrol backup"); return;
        }
        if ((o["version"] | 0) != 1) {
          req->send(400, "text/plain", "unsupported backup version"); return;
        }
        if (!o["registry"].is<JsonObject>())   { req->send(400, "text/plain", "missing registry");   return; }
        if (!o["dashboards"].is<JsonArray>())  { req->send(400, "text/plain", "missing dashboards");  return; }
        if (!o["settings"].is<JsonObject>())   { req->send(400, "text/plain", "missing settings");    return; }

        // Validation passed — only now touch the filesystem.
        if (!writeSection_("/config/registry.json",   o["registry"]) ||
            !writeSection_("/config/dashboards.json",  o["dashboards"]) ||
            !writeSection_("/config/settings.json",    o["settings"])) {
          req->send(500, "text/plain", "write failed"); return;
        }
        req->send(200, "text/plain", "ok");
        rebootAtMs_ = millis() + 500;
      }));
```

- [ ] **Step 4: `writeSection_`-Definition in WebUI.cpp**

In `BrewControl/firmware/src/WebUI.cpp`, nach der `WebUI::swapAssets_()`-Definition ergänzen:

```cpp
bool WebUI::writeSection_(const char* path, JsonVariantConst v) {
  fs_.mkdir("/config");
  File f = fs_.open(path, FILE_WRITE);
  if (!f) return false;
  serializeJson(v, f);
  f.close();
  return true;
}
```

- [ ] **Step 5: Compile-Smoke**

Run (PowerShell):
```powershell
cd BrewControl\firmware
pio run -e esp32dev
```
Expected: Build erfolgreich.

- [ ] **Step 6: Commit**

```bash
git add BrewControl/firmware/src/WebUI.h BrewControl/firmware/src/WebUI.cpp
git commit -m "feat(fw): /api/backup — config export + validated restore with reboot"
```

---

## Phase 2 — Web: API + Seite

### Task 2: API-Funktionen

**Files:**
- Modify: `BrewControl/web/src/api.ts`

- [ ] **Step 1: Export/Restore-Funktionen ergänzen**

In `BrewControl/web/src/api.ts`, am Ende ergänzen:

```ts
// ── Backup & Restore ───────────────────────────────────────────────────────────

export async function downloadBackup(): Promise<void> {
  const r = await fetch('/api/backup');
  if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
  const blob = await r.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `brewcontrol-backup-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// Posts the raw backup file text; on 200 the device reboots to apply.
export async function restoreBackup(text: string): Promise<void> {
  const r = await fetch('/api/backup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: text,
  });
  if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
}
```

- [ ] **Step 2: Typecheck**

```powershell
cd BrewControl\web
pnpm typecheck
```
Expected: keine Fehler.

- [ ] **Step 3: Commit**

```bash
git add BrewControl/web/src/api.ts
git commit -m "feat(web): backup download + restore API client"
```

### Task 3: BackupPage + Route + Settings-Kachel

**Files:**
- Create: `BrewControl/web/src/pages/BackupPage.tsx`
- Modify: `BrewControl/web/src/app.tsx`
- Modify: `BrewControl/web/src/pages/SettingsIndex.tsx`

- [ ] **Step 1: BackupPage schreiben**

Create `BrewControl/web/src/pages/BackupPage.tsx`:

```tsx
import { useState } from 'preact/hooks';
import { downloadBackup, restoreBackup } from '../api';
import { ConfirmModal } from '../components/ConfirmModal';

export function BackupPage(_: { path?: string }) {
  const [error, setError] = useState<string | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [restoring, setRestoring] = useState(false);
  const [done, setDone] = useState(false);

  if (done) {
    return (
      <div class="flex min-h-screen items-center justify-center bg-bg p-6 text-fg">
        <div class="max-w-md text-center">
          <h1 class="text-xl font-medium tracking-tight">Neustart…</h1>
          <p class="mt-3 text-sm text-muted">
            Konfiguration wiederhergestellt. Das Gerät startet neu — die Seite in
            ein paar Sekunden neu laden.
          </p>
        </div>
      </div>
    );
  }

  const confirmRestore = async () => {
    if (!pendingFile) return;
    setRestoring(true);
    setError(null);
    try {
      const text = await pendingFile.text();
      await restoreBackup(text);
      setDone(true);
    } catch (e) {
      setError(String(e));
      setRestoring(false);
      setPendingFile(null);
    }
  };

  return (
    <div class="min-h-screen bg-bg p-4 text-fg md:p-6">
      <header class="flex items-center gap-3">
        <a href="/settings" class="text-lg leading-none text-faint hover:text-fg">←</a>
        <h1 class="text-xl font-medium tracking-tight">Backup &amp; Restore</h1>
      </header>

      <section class="mt-6 rounded-lg border border-border bg-surface p-4 space-y-2">
        <div class="font-medium">Export</div>
        <div class="text-sm text-muted">
          Lädt die gesamte Konfiguration (Geräte, Dashboards, Einstellungen) als
          JSON-Datei herunter.
        </div>
        <button onClick={() => downloadBackup().catch((e) => setError(String(e)))}
          class="rounded-md bg-fg/5 px-3 py-1.5 text-sm font-medium hover:bg-fg/10">
          Backup herunterladen
        </button>
      </section>

      <section class="mt-4 rounded-lg border border-border bg-surface p-4 space-y-2">
        <div class="font-medium">Restore</div>
        <div class="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm">
          ⚠ Überschreibt die komplette Konfiguration und startet das Gerät neu.
        </div>
        <input type="file" accept=".json,application/json"
          class="mt-1 block w-full text-sm"
          onChange={(e) => {
            const f = (e.target as HTMLInputElement).files?.[0];
            if (f) setPendingFile(f);
          }} />
        {error && <div class="text-sm text-red-500">Fehler: {error}</div>}
      </section>

      <ConfirmModal open={pendingFile !== null} title="Backup wiederherstellen?"
        confirmLabel="Wiederherstellen" cancelLabel="Abbrechen" destructive
        pending={restoring}
        onCancel={() => { if (!restoring) setPendingFile(null); }}
        onConfirm={confirmRestore}>
        Die Datei <span class="font-mono">{pendingFile?.name}</span> ersetzt die
        komplette Konfiguration. Das Gerät startet danach neu.
      </ConfirmModal>
    </div>
  );
}
```

- [ ] **Step 2: Route registrieren**

In `BrewControl/web/src/app.tsx`, Import ergänzen:
```tsx
import { BackupPage } from './pages/BackupPage';
```
Und die Route innerhalb `<Router>` (neben `FirmwarePage`):
```tsx
      <BackupPage path="/settings/backup" />
```

- [ ] **Step 3: Settings-Kachel ergänzen**

In `BrewControl/web/src/pages/SettingsIndex.tsx`, **nach** dem Firmware-Update-Kachel-`<a>`-Block (vor dem schließenden `</div>` der Kachel-Liste) einfügen:

```tsx
        <a href="/settings/backup"
          class="flex items-center justify-between rounded-lg border border-border bg-surface px-4 py-3 hover:bg-fg/5">
          <div>
            <div class="font-medium">Backup &amp; Restore</div>
            <div class="text-xs text-muted">Konfiguration exportieren / wiederherstellen</div>
          </div>
          <span class="text-faint">›</span>
        </a>
```

- [ ] **Step 4: Typecheck + Build**

```powershell
cd BrewControl\web
pnpm typecheck
pnpm build
```
Expected: typecheck sauber, `dist/` erzeugt.

- [ ] **Step 5: Commit**

```bash
git add BrewControl/web/src/pages/BackupPage.tsx BrewControl/web/src/app.tsx BrewControl/web/src/pages/SettingsIndex.tsx
git commit -m "feat(web): backup & restore page, route, settings tile"
```

---

## Phase 3 — Hardware-Verifikation

### Task 4: E2E auf realem Board

> Kein Unit-Test: die einzige nicht-triviale Firmware-Logik (Bündel-Validierung)
> sind fünf Feld-Checks; abgedeckt durch Compile-Smoke + diese E2E-Checkliste
> (so in der Spec festgelegt). Voraussetzung: Board mit `/www`-UI geflasht (s.
> Firmware-Update-Deploy), erreichbar im LAN.

- [ ] **Step 1: Flashen + UI laden**

```powershell
cd BrewControl\web
pnpm build:sd
Copy-Item -Recurse -Force .\dist\* D:\www\
cd ..\firmware
pio run -e <env> -t upload
```
UI öffnen, IP notieren.

- [ ] **Step 2: Export**

`/settings/backup` → „Backup herunterladen". Erwartung: Datei `brewcontrol-backup-<datum>.json` lädt; enthält `"type":"brewcontrol-backup"`, `"version":1`, und die drei Sektionen `registry`/`dashboards`/`settings`.

Alternativ per curl: `curl http://<ip>/api/backup` → JSON wie oben.

- [ ] **Step 3: Config ändern, dann Restore**

Ein dynamisches Item anlegen oder löschen (oder Theme in den Einstellungen ändern). Dann auf `/settings/backup` die in Step 2 geladene Datei auswählen → ConfirmModal → „Wiederherstellen". Erwartung: `200`, „Neustart…"-View; Gerät rebootet; nach Reload ist die Config auf dem **exportierten** Stand (die Step-3-Änderung ist rückgängig).

- [ ] **Step 4: Negativtest — fremde/kaputte Datei**

Run: `curl -X POST http://<ip>/api/backup -H "Content-Type: application/json" -d '{"foo":1}'`
Erwartung: `400` mit `not a brewcontrol backup` (o. ä.); Gerät rebootet **nicht**; laufende Config unverändert.

- [ ] **Step 5: Commit (nur falls Fixes nötig waren)**

Falls bei der E2E Fixes nötig waren, mit `fix(...)` committen. Sonst kein Commit.

---

## Self-Review-Ergebnis (vom Plan-Autor)

- **Spec-Coverage:** Umfang nur 3 `/config`-Dateien (GET-Bündel + 3 Validierungs-Checks), Format mit `type`/`version`/`firmwareVersion`/`variant`/3 Sektionen (Task 1 Step 3), `GET /api/backup` Download mit `Content-Disposition` (Task 1), `POST /api/backup` validieren-vor-schreiben + Reboot (Task 1), Ansatz A verbatim-Schreiben via `writeSection_` (Task 1 Step 4), UI Export/Import + ConfirmModal + Neustart-View (Task 3), Replace-all + Validierung-vor-Schreiben + Negativtest (Task 1/4) — alle abgedeckt. Zukunfts-Hook Zeitstempel ist bewusst Out-of-Scope (wartet auf Uhrzeit-Sync-Feature).
- **Placeholder-Scan:** keine TBD/TODO; jeder Code-Step zeigt vollständigen Code.
- **Typ-Konsistenz:** `writeSection_(const char*, JsonVariantConst)` in Header (Step 1) und Definition (Step 4) identisch; `downloadBackup`/`restoreBackup` in api.ts (Task 2) und BackupPage (Task 3) gleich benannt; Member `items_`/`store_`/`settings_`/`fs_`/`rebootAtMs_` existieren bereits in `WebUI`; `ConfirmModal`-Props (`open`/`title`/`confirmLabel`/`cancelLabel`/`destructive`/`pending`/`onConfirm`/`onCancel`) wie in der Komponente definiert.
- **Bekannte Risiken:** (a) `JsonVariantConst` muss in `WebUI.h` auflösbar sein — Fallback `#include <ArduinoJson.h>` im Header notiert (Task 1 Step 1). (b) `AsyncCallbackJsonWebHandler` puffert den Body; ein Backup ist KB-groß (jede `cfgJson` ist klein), liegt im Rahmen des bestehenden `/api/settings`-Handlers. (c) Kein voll-atomarer Drei-Datei-Swap — bei seltenem SD-Schreibfehler lädt der Boot, was da ist; per Spec Out-of-Scope.
