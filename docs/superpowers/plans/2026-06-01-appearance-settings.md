# Appearance-Settings (Design/Theme) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement device-wide theme settings (dark/light/system, accent color, background tint) with SD persistence, new `/api/settings` REST routes, a CSS semantic token system, and a Settings hub with `/settings/appearance` + `/settings/devices` sub-pages.

**Architecture:** New `SettingsStore` (mirrors `DashboardStore`) persists `/config/settings.json`; `WebUI` gains `GET`/`POST /api/settings`; `styles.css` defines CSS custom property tokens mapped via `@theme inline` to Tailwind utilities; `theme.ts` applies `data-theme`/`data-tint` attributes + inline `--accent`/`--accent-fg`; all components migrate from hardcoded `stone-*` to semantic classes.

**Tech Stack:** C++17/ArduinoJson 7 (firmware), Preact 10/TypeScript/Tailwind CSS 4/Vite 7/pnpm (web)

---

## File Map

**New:** `firmware/src/SettingsStore.h`, `firmware/src/SettingsStore.cpp`, `web/src/theme.ts`, `web/src/pages/SettingsIndex.tsx`, `web/src/pages/AppearancePage.tsx`, `web/src/pages/DevicesPage.tsx`

**Modified:** `firmware/src/WebUI.h`, `firmware/src/WebUI.cpp`, `firmware/src/main.cpp`, `web/src/types.ts`, `web/src/api.ts`, `web/src/styles.css`, `web/src/app.tsx`, `web/src/components/SensorCard.tsx`, `web/src/components/ActuatorCard.tsx`, `web/src/components/ControllerCard.tsx`, `web/src/components/ConfirmModal.tsx`, `web/src/components/DashboardEditorModal.tsx`, `web/src/components/AddItemModal.tsx`, `web/src/pages/Dashboard.tsx`

**Deleted:** `web/src/pages/SettingsPage.tsx`

---

## Semantic Token Reference

These mappings are used throughout the refactor tasks:

| Old class | New class | Notes |
|-----------|-----------|-------|
| `bg-stone-50` | `bg-bg` | page background |
| `bg-white` | `bg-surface` | card / modal background |
| `text-stone-900` | `text-fg` | primary text |
| `text-stone-700` | `text-fg` | primary text (close enough) |
| `text-stone-600` | `text-muted` | secondary text |
| `text-stone-500` | `text-muted` | secondary text |
| `text-stone-400` | `text-faint` | tertiary / placeholder |
| `border-stone-200` | `border-border` | card borders |
| `border-stone-300` | `border-border` | input borders |
| `bg-stone-900 text-white` | `bg-fg text-bg` | primary dark button |
| `hover:bg-stone-800` | `hover:bg-fg/80` | primary button hover |
| `bg-stone-100 text-stone-700 hover:bg-stone-200` | `bg-fg/5 text-fg hover:bg-fg/10` | secondary button |
| `hover:text-stone-700` / `hover:text-stone-800` | `hover:text-fg` | icon hover |
| `accent-stone-900` / `accent-stone-800` | `accent-accent` | range/checkbox accent |
| `bg-stone-100` (track/badge bg) | `bg-fg/10` | subtle background |
| `bg-stone-700` (progress fill) | `bg-accent` | progress bar fill |
| `border-stone-900` (active tab) | `border-accent` | active tab underline |

---

## Task 1: SettingsStore (Firmware)

**Files:**
- Create: `BrewControl/firmware/src/SettingsStore.h`
- Create: `BrewControl/firmware/src/SettingsStore.cpp`

- [ ] **Step 1: Create SettingsStore.h**

```cpp
// BrewControl/firmware/src/SettingsStore.h
#pragma once

#include <ArduinoJson.h>
#include <FS.h>

namespace BrewControl {

class SettingsStore {
 public:
  void loadFromSD(fs::FS& sd);
  void saveToSD(fs::FS& sd) const;
  String serialize() const;
  void update(const JsonObject& patch);

 private:
  String mode_       = "system";   // "light" | "dark" | "system"
  String accent_     = "#d97706";  // hex color
  String background_ = "neutral";  // "neutral" | "warm" | "cool"
};

}  // namespace BrewControl
```

- [ ] **Step 2: Create SettingsStore.cpp**

```cpp
// BrewControl/firmware/src/SettingsStore.cpp
#include "SettingsStore.h"

namespace BrewControl {

void SettingsStore::loadFromSD(fs::FS& sd) {
  File f = sd.open("/config/settings.json");
  if (!f) return;
  JsonDocument doc;
  if (deserializeJson(doc, f) != DeserializationError::Ok) { f.close(); return; }
  f.close();
  JsonObject theme = doc["theme"].as<JsonObject>();
  if (!theme.isNull()) {
    if (const char* m = theme["mode"])       mode_       = m;
    if (const char* a = theme["accent"])     accent_     = a;
    if (const char* b = theme["background"]) background_ = b;
  }
}

void SettingsStore::saveToSD(fs::FS& sd) const {
  sd.mkdir("/config");
  File f = sd.open("/config/settings.json", FILE_WRITE);
  if (!f) return;
  f.print(serialize());
  f.close();
}

String SettingsStore::serialize() const {
  JsonDocument doc;
  JsonObject theme = doc["theme"].to<JsonObject>();
  theme["mode"]       = mode_.c_str();
  theme["accent"]     = accent_.c_str();
  theme["background"] = background_.c_str();
  String out;
  serializeJson(doc, out);
  return out;
}

void SettingsStore::update(const JsonObject& patch) {
  JsonObject theme = patch["theme"].as<JsonObject>();
  if (theme.isNull()) return;
  if (const char* m = theme["mode"])       mode_       = m;
  if (const char* a = theme["accent"])     accent_     = a;
  if (const char* b = theme["background"]) background_ = b;
}

}  // namespace BrewControl
```

- [ ] **Step 3: Compile smoke test**

```powershell
cd BrewControl/firmware
pio run -e esp32dev 2>&1 | Select-String -Pattern "error:|warning:|SUCCESS"
```
Expected: `SUCCESS`

- [ ] **Step 4: Commit**

```
git add BrewControl/firmware/src/SettingsStore.h BrewControl/firmware/src/SettingsStore.cpp
git commit -m "feat(fw): SettingsStore — theme settings persistence on SD"
```

---

## Task 2: WebUI — /api/settings routes

**Files:**
- Modify: `BrewControl/firmware/src/WebUI.h`
- Modify: `BrewControl/firmware/src/WebUI.cpp`

- [ ] **Step 1: Update WebUI.h**

In `WebUI.h`, add `#include "SettingsStore.h"` after the existing includes, update the constructor, and add a private member. Replace:

```cpp
  WebUI(SensActCtrl::Registry& reg, fs::FS& fs, DynamicItems& items,
        DashboardStore& store, uint16_t port = 80);
```

with:

```cpp
  WebUI(SensActCtrl::Registry& reg, fs::FS& fs, DynamicItems& items,
        DashboardStore& store, SettingsStore& settings, uint16_t port = 80);
```

Add `#include "SettingsStore.h"` to the includes block in WebUI.h. Add to private members:

```cpp
  SettingsStore& settings_;
```

- [ ] **Step 2: Update WebUI.cpp constructor signature and add routes**

In `WebUI.cpp`, replace the constructor definition:

```cpp
WebUI::WebUI(SensActCtrl::Registry& reg, fs::FS& fs, DynamicItems& items,
             DashboardStore& store, uint16_t port)
    : reg_(reg), fs_(fs), items_(items), store_(store), server_(port), events_("/api/events") {}
```

with:

```cpp
WebUI::WebUI(SensActCtrl::Registry& reg, fs::FS& fs, DynamicItems& items,
             DashboardStore& store, SettingsStore& settings, uint16_t port)
    : reg_(reg), fs_(fs), items_(items), store_(store), settings_(settings),
      server_(port), events_("/api/events") {}
```

Then add the two `/api/settings` handlers in `begin()`, right before the `serveStatic` line (after the dashboard handlers):

```cpp
  // ── Settings ──────────────────────────────────────────────────────────────
  server_.on("/api/settings", HTTP_GET, [this](AsyncWebServerRequest* req) {
    req->send(200, "application/json", settings_.serialize());
  });

  server_.addHandler(new AsyncCallbackJsonWebHandler("/api/settings",
      [this](AsyncWebServerRequest* req, JsonVariant& json) {
        if (!json.is<JsonObject>()) { req->send(400, "text/plain", "invalid JSON"); return; }
        settings_.update(json.as<JsonObject>());
        settings_.saveToSD(fs_);
        req->send(204);
      }));
```

- [ ] **Step 3: Compile smoke test**

```powershell
cd BrewControl/firmware
pio run -e esp32dev 2>&1 | Select-String -Pattern "error:|SUCCESS"
```
Expected: `SUCCESS`

- [ ] **Step 4: Commit**

```
git add BrewControl/firmware/src/WebUI.h BrewControl/firmware/src/WebUI.cpp
git commit -m "feat(fw): GET/POST /api/settings in WebUI"
```

---

## Task 3: main.cpp — wire SettingsStore

**Files:**
- Modify: `BrewControl/firmware/src/main.cpp`

- [ ] **Step 1: Add include, global, loadFromSD, and constructor arg**

Add `#include "SettingsStore.h"` after the `#include "DashboardStore.h"` line.

Replace the globals block:

```cpp
Registry registry;
BrewControl::DynamicItems dynamicItems;
BrewControl::DashboardStore dashboardStore;
WebUI webUI(registry, SD, dynamicItems, dashboardStore);
```

with:

```cpp
Registry registry;
BrewControl::DynamicItems dynamicItems;
BrewControl::DashboardStore dashboardStore;
BrewControl::SettingsStore settingsStore;
WebUI webUI(registry, SD, dynamicItems, dashboardStore, settingsStore);
```

In `setup()`, inside the `if (sdOk)` block, add `settingsStore.loadFromSD(SD);` after `dashboardStore.loadFromSD(SD);`:

```cpp
  if (sdOk) {
    dynamicItems.loadFromSD(SD, registry);
    dashboardStore.loadFromSD(SD);
    settingsStore.loadFromSD(SD);
  }
```

- [ ] **Step 2: Compile smoke test**

```powershell
cd BrewControl/firmware
pio run -e esp32dev 2>&1 | Select-String -Pattern "error:|SUCCESS"
```
Expected: `SUCCESS`

- [ ] **Step 3: Commit**

```
git add BrewControl/firmware/src/main.cpp
git commit -m "feat(fw): wire SettingsStore into main + WebUI"
```

---

## Task 4: types.ts + api.ts

**Files:**
- Modify: `BrewControl/web/src/types.ts`
- Modify: `BrewControl/web/src/api.ts`

- [ ] **Step 1: Add ThemeSettings and AppSettings to types.ts**

Append at the end of `types.ts`:

```typescript
export interface ThemeSettings {
  mode: 'light' | 'dark' | 'system';
  accent: string;
  background: 'neutral' | 'warm' | 'cool';
}

export interface AppSettings {
  theme: ThemeSettings;
}
```

- [ ] **Step 2: Add getSettings and updateSettings to api.ts**

Add this import at the top of `api.ts` (update the existing import line):

```typescript
import type { Snapshot, BusScanResult, ConfigSnapshot, DashboardConfig, AppSettings } from './types';
```

Append at the end of `api.ts`:

```typescript
// ── App Settings ─────────────────────────────────────────────────────────────

export async function getSettings(): Promise<AppSettings> {
  const r = await fetch('/api/settings');
  if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
  return (await r.json()) as AppSettings;
}

export function updateSettings(patch: Partial<AppSettings>): Promise<void> {
  return postJson('/api/settings', patch);
}
```

- [ ] **Step 3: Typecheck**

```powershell
cd BrewControl/web
pnpm typecheck
```
Expected: no errors

- [ ] **Step 4: Commit**

```
git add BrewControl/web/src/types.ts BrewControl/web/src/api.ts
git commit -m "feat(web): ThemeSettings/AppSettings types + getSettings/updateSettings API"
```

---

## Task 5: styles.css — CSS token system

**Files:**
- Modify: `BrewControl/web/src/styles.css`

- [ ] **Step 1: Replace styles.css with full token system**

```css
@import "tailwindcss";

/* ── Semantic tokens ─────────────────────────────────────────────────────── */

:root {
  --bg:         #fafaf9;   /* stone-50  — page background */
  --surface:    #ffffff;   /* white     — card / modal background */
  --fg:         #1c1917;   /* stone-900 — primary text */
  --muted:      #78716c;   /* stone-500 — secondary text */
  --faint:      #a8a29e;   /* stone-400 — placeholder / tertiary */
  --border:     #e7e5e4;   /* stone-200 — dividers / input borders */
  --accent:     #d97706;   /* amber-600 — default accent (overridden by theme.ts) */
  --accent-fg:  #ffffff;   /* contrast on accent (overridden by theme.ts) */
}

[data-theme="dark"] {
  --bg:         #1c1917;   /* stone-900 */
  --surface:    #292524;   /* stone-800 */
  --fg:         #fafaf9;   /* stone-50  */
  --muted:      #a8a29e;   /* stone-400 */
  --faint:      #57534e;   /* stone-600 */
  --border:     #44403c;   /* stone-700 */
}

@media (prefers-color-scheme: dark) {
  :root:not([data-theme]) {
    --bg:         #1c1917;
    --surface:    #292524;
    --fg:         #fafaf9;
    --muted:      #a8a29e;
    --faint:      #57534e;
    --border:     #44403c;
  }
}

/* ── Background tint overrides (only --bg shifts; --surface stays neutral) ── */

:root[data-tint="warm"] { --bg: #faf8f5; }
[data-theme="dark"][data-tint="warm"] { --bg: #201c17; }
@media (prefers-color-scheme: dark) {
  :root:not([data-theme])[data-tint="warm"] { --bg: #201c17; }
}

:root[data-tint="cool"] { --bg: #f7f9fa; }
[data-theme="dark"][data-tint="cool"] { --bg: #171a1e; }
@media (prefers-color-scheme: dark) {
  :root:not([data-theme])[data-tint="cool"] { --bg: #171a1e; }
}

/* ── Tailwind 4 utility mapping ──────────────────────────────────────────── */

@theme inline {
  --color-bg:         var(--bg);
  --color-surface:    var(--surface);
  --color-fg:         var(--fg);
  --color-muted:      var(--muted);
  --color-faint:      var(--faint);
  --color-border:     var(--border);
  --color-accent:     var(--accent);
  --color-accent-fg:  var(--accent-fg);
}
```

- [ ] **Step 2: Verify utilities are generated**

Start the dev server and open the browser console:

```powershell
cd BrewControl/web
pnpm dev
```

In the browser, open DevTools → Console and run:
```javascript
getComputedStyle(document.documentElement).getPropertyValue('--bg')
```
Expected: `#fafaf9` (or similar whitespace-trimmed value).

Add a test `<div class="bg-bg text-fg p-4">test</div>` temporarily to `index.html` to confirm the class exists in the generated CSS. Remove after confirming.

- [ ] **Step 3: Commit**

```
git add BrewControl/web/src/styles.css
git commit -m "feat(web): CSS semantic token system + Tailwind 4 utility mapping"
```

---

## Task 6: theme.ts

**Files:**
- Create: `BrewControl/web/src/theme.ts`

- [ ] **Step 1: Create theme.ts**

```typescript
// BrewControl/web/src/theme.ts
import type { ThemeSettings } from './types';

const STORAGE_KEY = 'brewctl-theme';

export function applyTheme(settings: ThemeSettings): void {
  const root = document.documentElement;

  if (settings.mode === 'dark') {
    root.setAttribute('data-theme', 'dark');
  } else if (settings.mode === 'light') {
    root.setAttribute('data-theme', 'light');
  } else {
    root.removeAttribute('data-theme');
  }

  root.style.setProperty('--accent', settings.accent);
  root.style.setProperty('--accent-fg', contrastColor(settings.accent));

  if (settings.background !== 'neutral') {
    root.setAttribute('data-tint', settings.background);
  } else {
    root.removeAttribute('data-tint');
  }

  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(settings)); } catch { /* storage unavailable */ }
}

export function loadCachedTheme(): ThemeSettings | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as ThemeSettings) : null;
  } catch {
    return null;
  }
}

function contrastColor(hex: string): string {
  if (hex.length < 7) return '#ffffff';
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.5 ? '#000000' : '#ffffff';
}
```

- [ ] **Step 2: Typecheck**

```powershell
cd BrewControl/web
pnpm typecheck
```
Expected: no errors

- [ ] **Step 3: Commit**

```
git add BrewControl/web/src/theme.ts
git commit -m "feat(web): theme.ts — apply data-theme/data-tint + accent CSS vars"
```

---

## Task 7: app.tsx — 3 routes + theme init

**Files:**
- Modify: `BrewControl/web/src/app.tsx`

- [ ] **Step 1: Replace app.tsx**

```typescript
// BrewControl/web/src/app.tsx
import { useEffect, useState } from 'preact/hooks';
import { Router } from 'preact-router';
import type { Snapshot } from './types';
import { getSnapshot, subscribeEvents, getSettings } from './api';
import { applyTheme, loadCachedTheme } from './theme';
import { Dashboard } from './pages/Dashboard';
import { SettingsIndex } from './pages/SettingsIndex';
import { AppearancePage } from './pages/AppearancePage';
import { DevicesPage } from './pages/DevicesPage';

function useSnapshot() {
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    getSnapshot()
      .then((s) => { if (alive) setSnap(s); })
      .catch((e) => { if (alive) setErr(String(e)); });
    const unsub = subscribeEvents((s) => { if (alive) setSnap(s); });
    return () => { alive = false; unsub(); };
  }, []);

  return { snap, err };
}

export function App() {
  const [rebooting, setRebooting] = useState(false);
  const { snap, err } = useSnapshot();

  useEffect(() => {
    const cached = loadCachedTheme();
    if (cached) applyTheme(cached);
    getSettings()
      .then((s) => applyTheme(s.theme))
      .catch(() => {});
  }, []);

  if (rebooting) return <RebootingView />;

  return (
    <Router>
      <Dashboard path="/" snap={snap} err={err} onReset={() => setRebooting(true)} />
      <SettingsIndex path="/settings" />
      <AppearancePage path="/settings/appearance" />
      <DevicesPage path="/settings/devices" snap={snap} />
    </Router>
  );
}

function RebootingView() {
  return (
    <div class="flex min-h-screen items-center justify-center bg-bg p-6 text-fg">
      <div class="max-w-md text-center">
        <h1 class="text-xl font-medium tracking-tight">Neustart…</h1>
        <p class="mt-3 text-sm text-muted">
          Das Gerät startet in den Setup-Modus. Mit dem WLAN
          <code class="mx-1 rounded bg-fg/10 px-1 font-mono">BrewControl-Setup</code>
          verbinden um neue Zugangsdaten einzutragen.
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

```powershell
cd BrewControl/web
pnpm typecheck
```
Expected: errors only for missing page files (will be fixed in Task 8)

- [ ] **Step 3: Commit** (after Task 8 typecheck passes)

---

## Task 8: New settings pages

**Files:**
- Create: `BrewControl/web/src/pages/SettingsIndex.tsx`
- Create: `BrewControl/web/src/pages/AppearancePage.tsx`
- Create: `BrewControl/web/src/pages/DevicesPage.tsx`
- Delete: `BrewControl/web/src/pages/SettingsPage.tsx`

- [ ] **Step 1: Create SettingsIndex.tsx**

```typescript
// BrewControl/web/src/pages/SettingsIndex.tsx
export function SettingsIndex({ path }: { path?: string }) {
  return (
    <div class="min-h-screen bg-bg p-4 text-fg md:p-6">
      <header class="flex items-center gap-3">
        <a href="/" class="text-lg leading-none text-faint hover:text-fg">←</a>
        <h1 class="text-xl font-medium tracking-tight">Einstellungen</h1>
      </header>
      <div class="mt-6 space-y-2">
        <a href="/settings/appearance"
          class="flex items-center justify-between rounded-lg border border-border bg-surface px-4 py-3 hover:bg-fg/5">
          <div>
            <div class="font-medium">Darstellung</div>
            <div class="text-xs text-muted">Modus, Akzentfarbe, Hintergrund</div>
          </div>
          <span class="text-faint">›</span>
        </a>
        <a href="/settings/devices"
          class="flex items-center justify-between rounded-lg border border-border bg-surface px-4 py-3 hover:bg-fg/5">
          <div>
            <div class="font-medium">Geräte</div>
            <div class="text-xs text-muted">Sensoren, Regler, Aktoren verwalten</div>
          </div>
          <span class="text-faint">›</span>
        </a>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create AppearancePage.tsx**

```typescript
// BrewControl/web/src/pages/AppearancePage.tsx
import { useState, useEffect } from 'preact/hooks';
import type { ThemeSettings } from '../types';
import { getSettings, updateSettings } from '../api';
import { applyTheme } from '../theme';

const ACCENT_PRESETS: { label: string; value: string }[] = [
  { label: 'Bernstein', value: '#d97706' },
  { label: 'Kupfer',    value: '#c2703d' },
  { label: 'Blau',      value: '#3b82f6' },
  { label: 'Grün',      value: '#22c55e' },
  { label: 'Rot',       value: '#ef4444' },
  { label: 'Violett',   value: '#8b5cf6' },
];

export function AppearancePage({ path }: { path?: string }) {
  const [settings, setSettings] = useState<ThemeSettings>({
    mode: 'system',
    accent: '#d97706',
    background: 'neutral',
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getSettings()
      .then((s) => { setSettings(s.theme); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  function update(partial: Partial<ThemeSettings>) {
    const next = { ...settings, ...partial };
    setSettings(next);
    applyTheme(next);
    updateSettings({ theme: next }).catch(() => {});
  }

  if (loading) return (
    <div class="min-h-screen bg-bg p-4 text-fg md:p-6">
      <p class="text-sm text-muted">Laden…</p>
    </div>
  );

  return (
    <div class="min-h-screen bg-bg p-4 text-fg md:p-6">
      <header class="mb-6 flex items-center gap-3">
        <a href="/settings" class="text-lg leading-none text-faint hover:text-fg">←</a>
        <h1 class="text-xl font-medium tracking-tight">Darstellung</h1>
      </header>

      <div class="space-y-5 rounded-lg border border-border bg-surface p-4">
        {/* Modus */}
        <div>
          <div class="mb-2 text-xs text-muted">Modus</div>
          <div class="inline-flex overflow-hidden rounded-lg border border-border text-sm">
            {(['light', 'dark', 'system'] as const).map((m) => (
              <button key={m} type="button"
                class={`px-4 py-1.5 transition-colors ${
                  settings.mode === m ? 'bg-fg text-bg' : 'text-muted hover:text-fg'
                }`}
                onClick={() => update({ mode: m })}>
                {m === 'light' ? 'Hell' : m === 'dark' ? 'Dunkel' : 'System'}
              </button>
            ))}
          </div>
        </div>

        {/* Akzentfarbe */}
        <div>
          <div class="mb-2 text-xs text-muted">Akzentfarbe</div>
          <div class="flex flex-wrap items-center gap-2">
            {ACCENT_PRESETS.map((p) => (
              <button key={p.value} type="button" title={p.label}
                onClick={() => update({ accent: p.value })}
                class="h-6 w-6 rounded-full transition-transform hover:scale-110"
                style={{
                  background: p.value,
                  boxShadow: settings.accent === p.value
                    ? `0 0 0 2px var(--bg), 0 0 0 4px ${p.value}` : 'none',
                }} />
            ))}
            <input type="color" value={settings.accent}
              onInput={(e) => update({ accent: (e.target as HTMLInputElement).value })}
              class="h-6 w-6 cursor-pointer rounded border border-border" title="Eigene Farbe" />
          </div>
        </div>

        {/* Hintergrund-Tönung */}
        <div>
          <div class="mb-2 text-xs text-muted">Hintergrund-Tönung</div>
          <div class="inline-flex overflow-hidden rounded-lg border border-border text-sm">
            {(['neutral', 'warm', 'cool'] as const).map((b) => (
              <button key={b} type="button"
                class={`px-4 py-1.5 transition-colors ${
                  settings.background === b ? 'bg-fg text-bg' : 'text-muted hover:text-fg'
                }`}
                onClick={() => update({ background: b })}>
                {b === 'neutral' ? 'Neutral' : b === 'warm' ? 'Warm' : 'Kalt'}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create DevicesPage.tsx** (SettingsPage content, `←` changed to `/settings`)

```typescript
// BrewControl/web/src/pages/DevicesPage.tsx
import { useState } from 'preact/hooks';
import type { Snapshot, ItemConfig } from '../types';
import { deleteSensor, deleteActuator, deleteController, getConfig } from '../api';
import { ConfirmModal } from '../components/ConfirmModal';
import { AddItemModal } from '../components/AddItemModal';

type Role = 'sensor' | 'actuator' | 'controller';

export function DevicesPage({ snap }: { snap: Snapshot | null; path?: string }) {
  const [addOpen, setAddOpen] = useState(false);
  const [editItem, setEditItem] = useState<{ role: Role; cfg: ItemConfig } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ role: Role; id: string } | null>(null);
  const [deletePending, setDeletePending] = useState(false);
  const [deleteErr, setDeleteErr] = useState<string | null>(null);

  async function startEdit(role: Role, id: string) {
    try {
      const config = await getConfig();
      const list = role === 'sensor' ? config.sensors
                 : role === 'actuator' ? config.actuators
                 : config.controllers;
      const cfg = list.find((c) => c.id === id);
      if (cfg) { setEditItem({ role, cfg }); setAddOpen(true); }
    } catch { /* ignore */ }
  }

  async function doDelete() {
    if (!deleteTarget) return;
    setDeletePending(true);
    setDeleteErr(null);
    try {
      if (deleteTarget.role === 'sensor') await deleteSensor(deleteTarget.id);
      else if (deleteTarget.role === 'actuator') await deleteActuator(deleteTarget.id);
      else await deleteController(deleteTarget.id);
      setDeleteTarget(null);
    } catch (e) {
      setDeleteErr(String(e));
    }
    setDeletePending(false);
  }

  const sensors = snap ? snap.sensors.filter((s, i, arr) => {
    const base = s.id.includes('.') ? s.id.split('.')[0] : s.id;
    return arr.findIndex((x) => (x.id.includes('.') ? x.id.split('.')[0] : x.id) === base) === i;
  }) : [];

  return (
    <div class="min-h-screen bg-bg p-4 text-fg md:p-6">
      <header class="flex items-center justify-between gap-3">
        <div class="flex items-center gap-3">
          <a href="/settings" class="text-lg leading-none text-faint hover:text-fg">←</a>
          <h1 class="text-xl font-medium tracking-tight">Geräte</h1>
        </div>
        <button type="button" onClick={() => setAddOpen(true)}
          class="rounded-md bg-fg px-3 py-1.5 text-xs font-medium text-bg hover:bg-fg/80">
          + Hinzufügen
        </button>
      </header>

      <div class="mt-6 space-y-6">
        {!snap && <p class="text-sm text-muted">Laden…</p>}

        {sensors.length > 0 && (
          <section>
            <h2 class="mb-2 text-sm font-medium uppercase tracking-wider text-muted">Sensoren</h2>
            <div class="space-y-2">
              {sensors.map((s) => {
                const base = s.id.includes('.') ? s.id.split('.')[0] : s.id;
                return (
                  <DeviceRow key={base} label={base} badge={s.meta.quantity}
                    onEdit={() => startEdit('sensor', base)}
                    onDelete={() => setDeleteTarget({ role: 'sensor', id: base })} />
                );
              })}
            </div>
          </section>
        )}

        {snap && snap.controllers.length > 0 && (
          <section>
            <h2 class="mb-2 text-sm font-medium uppercase tracking-wider text-muted">Regler</h2>
            <div class="space-y-2">
              {snap.controllers.map((c) => (
                <DeviceRow key={c.id} label={c.id}
                  badge={c.params?.sensor && c.params?.actuator
                    ? `${c.params.sensor} → ${c.params.actuator}`
                    : undefined}
                  onEdit={() => startEdit('controller', c.id)}
                  onDelete={() => setDeleteTarget({ role: 'controller', id: c.id })} />
              ))}
            </div>
          </section>
        )}

        {snap && snap.actuators.length > 0 && (
          <section>
            <h2 class="mb-2 text-sm font-medium uppercase tracking-wider text-muted">Aktoren</h2>
            <div class="space-y-2">
              {snap.actuators.map((a) => (
                <DeviceRow key={a.id} label={a.id} badge={a.meta.kind}
                  onEdit={() => startEdit('actuator', a.id)}
                  onDelete={() => setDeleteTarget({ role: 'actuator', id: a.id })} />
              ))}
            </div>
          </section>
        )}
      </div>

      <ConfirmModal open={deleteTarget !== null}
        title={`"${deleteTarget?.id}" löschen?`}
        destructive confirmLabel="Löschen" pending={deletePending}
        onCancel={() => { setDeleteTarget(null); setDeleteErr(null); }}
        onConfirm={doDelete}>
        <p>Das Item wird dauerhaft entfernt und die SD-Konfiguration aktualisiert.</p>
        {deleteErr && <p class="mt-2 text-red-600">{deleteErr}</p>}
      </ConfirmModal>

      <AddItemModal open={addOpen} snap={snap}
        onClose={() => { setAddOpen(false); setEditItem(null); }}
        editConfig={editItem?.cfg}
        editRole={editItem?.role} />
    </div>
  );
}

function DeviceRow({ label, badge, onEdit, onDelete }: {
  label: string; badge?: string; onEdit: () => void; onDelete: () => void;
}) {
  return (
    <div class="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface px-4 py-3">
      <div class="flex min-w-0 items-center gap-2">
        <span class="truncate font-medium">{label}</span>
        {badge && (
          <span class="shrink-0 rounded bg-fg/10 px-1.5 py-0.5 text-xs text-muted">{badge}</span>
        )}
      </div>
      <div class="flex shrink-0 items-center gap-3">
        <button type="button" onClick={onEdit} title="Bearbeiten"
          class="text-sm leading-none text-faint hover:text-fg">✎</button>
        <button type="button" onClick={onDelete} title="Löschen"
          class="leading-none text-faint hover:text-red-600">×</button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Delete SettingsPage.tsx**

```powershell
Remove-Item BrewControl/web/src/pages/SettingsPage.tsx
```

- [ ] **Step 5: Typecheck**

```powershell
cd BrewControl/web
pnpm typecheck
```
Expected: no errors

- [ ] **Step 6: Manual navigation test**

Start dev server (`pnpm dev`), open browser:
- Navigate to `/settings` → see hub with Darstellung + Geräte
- Click Darstellung → `/settings/appearance` with mode/accent/tint controls
- Click ← → back to `/settings`
- Click Geräte → `/settings/devices` with device list
- Click ← → back to `/settings`
- `⚙` from dashboard → `/settings` hub

- [ ] **Step 7: Commit tasks 7+8**

```
git add BrewControl/web/src/app.tsx BrewControl/web/src/pages/SettingsIndex.tsx BrewControl/web/src/pages/AppearancePage.tsx BrewControl/web/src/pages/DevicesPage.tsx
git commit -m "feat(web): Settings hub + AppearancePage + DevicesPage, 3-route navigation"
```

---

## Task 9: Refactor SensorCard, ActuatorCard, ControllerCard

**Files:**
- Modify: `BrewControl/web/src/components/SensorCard.tsx`
- Modify: `BrewControl/web/src/components/ActuatorCard.tsx`
- Modify: `BrewControl/web/src/components/ControllerCard.tsx`

- [ ] **Step 1: Replace SensorCard.tsx**

```typescript
// BrewControl/web/src/components/SensorCard.tsx
import type { Sensor } from '../types';

export function SensorCard({ sensor, onDelete, onReset, onEdit }: { sensor: Sensor; onDelete?: () => void; onReset?: () => void; onEdit?: () => void }) {
  const { id, meta, state } = sensor;
  const v = state.v;
  const live = state.ok && v != null && isFinite(v);
  const pct = live && meta.max > meta.min
    ? Math.max(0, Math.min(100, ((v - meta.min) / (meta.max - meta.min)) * 100))
    : 0;

  return (
    <div class="rounded-lg border border-border bg-surface p-4 shadow-sm">
      <div class="flex items-center justify-between gap-2">
        <h3 class="font-medium text-fg">{id}</h3>
        <div class="flex items-center gap-2">
          <span class="text-xs text-muted">{meta.quantity}</span>
          {onEdit && (
            <button type="button" onClick={onEdit} title="Bearbeiten"
              class="text-sm leading-none text-faint hover:text-fg">✎</button>
          )}
          {onReset && (
            <button type="button" onClick={onReset}
              title={meta.quantity === 'Mass' ? 'Tare' : 'Reset volume'}
              class="text-sm leading-none text-faint hover:text-blue-600">↺</button>
          )}
          {onDelete && (
            <button type="button" onClick={onDelete} title="Delete"
              class="leading-none text-faint hover:text-red-600">×</button>
          )}
        </div>
      </div>
      <div class="mt-2 flex items-baseline gap-1">
        <span class="font-mono text-2xl tabular-nums text-fg">
          {live ? v.toFixed(2) : '—'}
        </span>
        <span class="text-sm text-muted">{meta.unit}</span>
        {!state.ok && (
          <span class="ml-auto rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-800">
            stale
          </span>
        )}
      </div>
      <div class="mt-3 h-1.5 overflow-hidden rounded-full bg-fg/10">
        <div
          class="h-full rounded-full bg-accent transition-[width] duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div class="mt-1 flex justify-between text-[10px] text-faint">
        <span>{meta.min}</span>
        <span>{meta.max}</span>
      </div>
      {sensor.fault && (
        <span class="mt-2 inline-block rounded bg-yellow-100 px-2 py-0.5 text-xs text-yellow-800">
          ⚠ {sensor.fault}
        </span>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Replace ActuatorCard.tsx**

```typescript
// BrewControl/web/src/components/ActuatorCard.tsx
import { useState, useEffect } from 'preact/hooks';
import type { Actuator } from '../types';
import { writeActuator } from '../api';

export function ActuatorCard({ actuator, onDelete, onEdit }: { actuator: Actuator; onDelete?: () => void; onEdit?: () => void }) {
  const { id, meta, state } = actuator;
  const [pending, setPending] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function send(v: number) {
    setPending(true);
    setErr(null);
    try { await writeActuator(id, v); }
    catch (e) { setErr(String(e)); }
    finally { setPending(false); }
  }

  return (
    <div class="rounded-lg border border-border bg-surface p-4 shadow-sm">
      <div class="flex items-center justify-between gap-2">
        <h3 class="font-medium text-fg">{id}</h3>
        <div class="flex items-center gap-2">
          <span class="text-xs text-muted">{meta.kind}</span>
          {onEdit && (
            <button type="button" onClick={onEdit} title="Bearbeiten"
              class="text-sm leading-none text-faint hover:text-fg">✎</button>
          )}
          {onDelete && (
            <button type="button" onClick={onDelete} title="Löschen"
              class="leading-none text-faint hover:text-red-600">×</button>
          )}
        </div>
      </div>
      <div class="mt-3">
        {meta.kind === 'Binary' && (
          <BinaryToggle value={state.v ?? 0} disabled={pending} onChange={send} />
        )}
        {meta.kind === 'Continuous' && (
          <ContinuousSlider
            value={state.v ?? meta.min} min={meta.min} max={meta.max}
            step={meta.res || 0.01} unit={meta.unit} disabled={pending} onChange={send}
          />
        )}
        {(meta.kind === 'Discrete' || meta.kind === 'Cumulative') && (
          <DiscreteInput value={state.v ?? 0} disabled={pending} onSubmit={send} />
        )}
      </div>
      {err && <p class="mt-2 text-xs text-red-600">{err}</p>}
      {actuator.fault && (
        <span class="mt-2 inline-block rounded bg-yellow-100 px-2 py-0.5 text-xs text-yellow-800">
          ⚠ {actuator.fault}
        </span>
      )}
    </div>
  );
}

function BinaryToggle({ value, disabled, onChange }: { value: number; disabled: boolean; onChange: (v: number) => void }) {
  const on = value >= 0.5;
  return (
    <button
      class={`w-full rounded-md px-3 py-2 text-sm font-medium transition-colors disabled:opacity-50 ${
        on ? 'bg-fg text-bg' : 'bg-fg/5 text-muted hover:bg-fg/10'
      }`}
      disabled={disabled}
      onClick={() => onChange(on ? 0 : 1)}>
      {on ? 'ON' : 'OFF'}
    </button>
  );
}

function ContinuousSlider({ value, min, max, step, unit, disabled, onChange }: {
  value: number; min: number; max: number; step: number; unit: string;
  disabled: boolean; onChange: (v: number) => void;
}) {
  const [local, setLocal] = useState(value);
  useEffect(() => { setLocal(value); }, [value]);
  return (
    <div>
      <input type="range" min={min} max={max} step={step} value={local} disabled={disabled}
        onInput={(e) => setLocal(parseFloat((e.target as HTMLInputElement).value))}
        onChange={(e) => onChange(parseFloat((e.target as HTMLInputElement).value))}
        class="w-full accent-accent" />
      <div class="mt-1 flex justify-between text-xs text-muted">
        <span>{min}</span>
        <span class="font-mono text-fg">{local.toFixed(2)} {unit}</span>
        <span>{max}</span>
      </div>
    </div>
  );
}

function DiscreteInput({ value, disabled, onSubmit }: { value: number; disabled: boolean; onSubmit: (v: number) => void }) {
  const [v, setV] = useState(value.toString());
  return (
    <div class="flex gap-2">
      <input type="number" value={v}
        onInput={(e) => setV((e.target as HTMLInputElement).value)}
        disabled={disabled}
        class="w-full rounded border border-border bg-surface px-2 py-1 font-mono text-sm text-fg" />
      <button onClick={() => { const n = parseFloat(v); if (!isNaN(n)) onSubmit(n); }}
        disabled={disabled}
        class="rounded bg-fg px-3 py-1 text-sm text-bg disabled:opacity-50">
        Send
      </button>
    </div>
  );
}
```

- [ ] **Step 3: Replace ControllerCard.tsx**

```typescript
// BrewControl/web/src/components/ControllerCard.tsx
import { useState } from 'preact/hooks';
import type { Controller, Sensor, Actuator } from '../types';
import { setControllerSetpoint, enableController } from '../api';

interface Props {
  controller: Controller;
  sensors: Sensor[];
  actuators: Actuator[];
  onDelete?: () => void;
  onEdit?: () => void;
}

export function ControllerCard({ controller, sensors, actuators, onDelete, onEdit }: Props) {
  const { id, setpoint, enabled, params } = controller;
  const [sp, setSp] = useState(setpoint.toString());
  const [toggling, setToggling] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const linkedSensor = params?.sensor ? sensors.find((s) => s.id === params.sensor) : undefined;
  const linkedActuator = params?.actuator ? actuators.find((a) => a.id === params.actuator) : undefined;

  async function applySp() {
    const n = parseFloat(sp);
    if (isNaN(n)) { setErr('ungültiger Sollwert'); return; }
    setErr(null);
    try { await setControllerSetpoint(id, n); }
    catch (e) { setErr(String(e)); }
  }

  async function toggleEnabled() {
    setToggling(true);
    setErr(null);
    try { await enableController(id, !enabled); }
    catch (e) { setErr(String(e)); }
    finally { setToggling(false); }
  }

  function fmtActuatorOut(v: number | null, max: number): string {
    if (v == null || !isFinite(v)) return '—';
    return max <= 1 ? `${(v * 100).toFixed(0)}%` : v.toFixed(2);
  }

  return (
    <div class={`rounded-lg border bg-surface p-4 shadow-sm transition-opacity ${
      enabled ? 'border-border' : 'border-border/50 opacity-60'
    }`}>
      <div class="flex items-center justify-between gap-2">
        <h3 class="font-medium text-fg">{id}</h3>
        <div class="flex items-center gap-1.5">
          <button type="button" onClick={toggleEnabled} disabled={toggling}
            title={enabled ? 'Regler deaktivieren' : 'Regler aktivieren'}
            class={`text-base leading-none disabled:opacity-40 transition-colors ${
              enabled ? 'text-emerald-600 hover:text-faint' : 'text-faint hover:text-emerald-600'
            }`}>
            ⏻
          </button>
          {onEdit && (
            <button type="button" onClick={onEdit} title="Bearbeiten"
              class="text-sm leading-none text-faint hover:text-fg">✎</button>
          )}
          {onDelete && (
            <button type="button" onClick={onDelete} title="Löschen"
              class="leading-none text-faint hover:text-red-600">×</button>
          )}
        </div>
      </div>

      {(linkedSensor || linkedActuator) && (
        <div class="mt-2 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted">
          {linkedSensor && (
            <span>Ist:{' '}
              <span class="font-mono text-fg">
                {linkedSensor.state.v != null && isFinite(linkedSensor.state.v)
                  ? linkedSensor.state.v.toFixed(2) : '—'}
              </span>{' '}{linkedSensor.meta.unit}
            </span>
          )}
          {linkedActuator && (
            <span>Ausgang:{' '}
              <span class="font-mono text-fg">
                {fmtActuatorOut(linkedActuator.state.v, linkedActuator.meta.max)}
              </span>
            </span>
          )}
        </div>
      )}

      <div class="mt-3">
        <label for={`sp-${id}`} class="block text-xs text-muted">Setpoint</label>
        <div class="mt-1 flex gap-2">
          <input id={`sp-${id}`} type="number" step="any" value={sp}
            onInput={(e) => setSp((e.target as HTMLInputElement).value)}
            class="w-full rounded border border-border bg-surface px-2 py-1 font-mono text-sm text-fg" />
          <button onClick={applySp}
            class="rounded bg-fg px-3 py-1 text-sm text-bg hover:bg-fg/80">
            Apply
          </button>
        </div>
      </div>

      {err && <p class="mt-2 text-xs text-red-600">{err}</p>}
    </div>
  );
}
```

- [ ] **Step 4: Typecheck**

```powershell
cd BrewControl/web
pnpm typecheck
```
Expected: no errors

- [ ] **Step 5: Commit**

```
git add BrewControl/web/src/components/SensorCard.tsx BrewControl/web/src/components/ActuatorCard.tsx BrewControl/web/src/components/ControllerCard.tsx
git commit -m "refactor(web): SensorCard/ActuatorCard/ControllerCard → semantic tokens"
```

---

## Task 10: Refactor ConfirmModal, DashboardEditorModal, AddItemModal, Dashboard

**Files:**
- Modify: `BrewControl/web/src/components/ConfirmModal.tsx`
- Modify: `BrewControl/web/src/components/DashboardEditorModal.tsx`
- Modify: `BrewControl/web/src/components/AddItemModal.tsx`
- Modify: `BrewControl/web/src/pages/Dashboard.tsx`

- [ ] **Step 1: Replace ConfirmModal.tsx**

```typescript
// BrewControl/web/src/components/ConfirmModal.tsx
import type { ComponentChildren } from 'preact';

export function ConfirmModal({
  open, title, children, confirmLabel = 'Confirm', cancelLabel = 'Cancel',
  destructive = false, pending = false, onConfirm, onCancel,
}: {
  open: boolean; title: string; children: ComponentChildren;
  confirmLabel?: string; cancelLabel?: string; destructive?: boolean;
  pending?: boolean; onConfirm: () => void; onCancel: () => void;
}) {
  if (!open) return null;
  const confirmCls = destructive
    ? 'bg-red-600 hover:bg-red-700 text-white'
    : 'bg-fg hover:bg-fg/80 text-bg';
  return (
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={() => { if (!pending) onCancel(); }}>
      <div class="w-full max-w-md rounded-lg bg-surface p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}>
        <h2 class="text-base font-medium text-fg">{title}</h2>
        <div class="mt-2 text-sm text-muted">{children}</div>
        <div class="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onCancel} disabled={pending}
            class="rounded-md bg-fg/5 px-3 py-1.5 text-sm font-medium text-fg hover:bg-fg/10 disabled:opacity-50">
            {cancelLabel}
          </button>
          <button type="button" onClick={onConfirm} disabled={pending}
            class={`rounded-md px-3 py-1.5 text-sm font-medium disabled:opacity-50 ${confirmCls}`}>
            {pending ? 'Working…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Replace DashboardEditorModal.tsx**

```typescript
// BrewControl/web/src/components/DashboardEditorModal.tsx
import { useState, useEffect } from 'preact/hooks';
import type { Snapshot, DashboardConfig } from '../types';
import { AddItemModal } from './AddItemModal';

interface Props {
  open: boolean; snap: Snapshot | null; initial?: DashboardConfig;
  onSave: (name: string, sensors: string[], actuators: string[], controllers: string[]) => void;
  onDelete?: () => void; onClose: () => void;
}

export function DashboardEditorModal({ open, snap, initial, onSave, onDelete, onClose }: Props) {
  const [name, setName] = useState('');
  const [sensors, setSensors] = useState<Set<string>>(new Set());
  const [actuators, setActuators] = useState<Set<string>>(new Set());
  const [controllers, setControllers] = useState<Set<string>>(new Set());
  const [subAddOpen, setSubAddOpen] = useState(false);

  useEffect(() => {
    if (open) {
      setName(initial?.name ?? '');
      setSensors(new Set(initial?.sensors ?? []));
      setActuators(new Set(initial?.actuators ?? []));
      setControllers(new Set(initial?.controllers ?? []));
    }
  }, [open, initial]);

  if (!open) return null;

  const sensorIds = [...new Set(
    (snap?.sensors ?? []).map((s) => s.id.includes('.') ? s.id.split('.')[0] : s.id)
  )];
  const actuatorIds = (snap?.actuators ?? []).map((a) => a.id);
  const controllerIds = (snap?.controllers ?? []).map((c) => c.id);

  function toggle(set: Set<string>, setFn: (s: Set<string>) => void, id: string) {
    const next = new Set(set);
    if (next.has(id)) next.delete(id); else next.add(id);
    setFn(next);
  }

  function handleSubmit(e: Event) {
    e.preventDefault();
    if (!name.trim()) return;
    onSave(name.trim(), [...sensors], [...actuators], [...controllers]);
  }

  return (
    <>
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <form onSubmit={handleSubmit} class="w-full max-w-md rounded-xl bg-surface p-6 shadow-lg">
        <h2 class="mb-4 text-base font-medium text-fg">
          {initial ? 'Dashboard bearbeiten' : 'Neues Dashboard'}
        </h2>

        <label class="mb-4 block">
          <span class="text-xs text-muted">Name</span>
          <input class="mt-1 w-full rounded border border-border bg-surface px-2 py-1.5 text-sm text-fg focus:outline-none focus:ring-1 focus:ring-border"
            value={name} onInput={(e) => setName((e.target as HTMLInputElement).value)}
            placeholder="z.B. Maischen" autoFocus />
        </label>

        {sensorIds.length > 0 && (
          <fieldset class="mb-3">
            <legend class="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted">Sensoren</legend>
            <div class="flex flex-wrap gap-x-4 gap-y-1.5">
              {sensorIds.map((id) => (
                <label key={id} class="flex cursor-pointer items-center gap-1.5 text-sm text-fg">
                  <input type="checkbox" class="accent-accent"
                    checked={sensors.has(id)}
                    onChange={() => toggle(sensors, setSensors, id)} />
                  {id}
                </label>
              ))}
            </div>
          </fieldset>
        )}

        {actuatorIds.length > 0 && (
          <fieldset class="mb-3">
            <legend class="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted">Aktoren</legend>
            <div class="flex flex-wrap gap-x-4 gap-y-1.5">
              {actuatorIds.map((id) => (
                <label key={id} class="flex cursor-pointer items-center gap-1.5 text-sm text-fg">
                  <input type="checkbox" class="accent-accent"
                    checked={actuators.has(id)}
                    onChange={() => toggle(actuators, setActuators, id)} />
                  {id}
                </label>
              ))}
            </div>
          </fieldset>
        )}

        {controllerIds.length > 0 && (
          <fieldset class="mb-3">
            <legend class="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted">Regler</legend>
            <div class="flex flex-wrap gap-x-4 gap-y-1.5">
              {controllerIds.map((id) => (
                <label key={id} class="flex cursor-pointer items-center gap-1.5 text-sm text-fg">
                  <input type="checkbox" class="accent-accent"
                    checked={controllers.has(id)}
                    onChange={() => toggle(controllers, setControllers, id)} />
                  {id}
                </label>
              ))}
            </div>
          </fieldset>
        )}

        <button type="button" onClick={() => setSubAddOpen(true)}
          class="mt-1 text-xs text-faint hover:text-fg">
          + Neues Gerät erstellen
        </button>

        <div class="mt-4 flex items-center justify-between gap-2">
          {onDelete ? (
            <button type="button" onClick={onDelete} class="text-sm text-red-500 hover:text-red-700">
              Löschen
            </button>
          ) : <span />}
          <div class="flex gap-2">
            <button type="button" onClick={onClose}
              class="rounded-md border border-border px-3 py-1.5 text-sm text-muted hover:bg-fg/5">
              Abbrechen
            </button>
            <button type="submit" disabled={!name.trim()}
              class="rounded-md bg-fg px-3 py-1.5 text-sm text-bg hover:bg-fg/80 disabled:opacity-40">
              {initial ? 'Speichern' : 'Erstellen'}
            </button>
          </div>
        </div>
      </form>
    </div>

    <AddItemModal open={subAddOpen} snap={snap}
      onClose={() => setSubAddOpen(false)}
      onCreated={(role, id) => {
        if (role === 'sensor') toggle(sensors, setSensors, id);
        else if (role === 'actuator') toggle(actuators, setActuators, id);
        else toggle(controllers, setControllers, id);
      }} />
    </>
  );
}
```

- [ ] **Step 3: Update AddItemModal.tsx — replace the 3 style constants and button/container classes**

The only changes are the 3 style constants near line 329 and specific button/container classes. Replace:

```typescript
  const inp = 'w-full rounded border border-stone-300 px-2 py-1 font-mono text-sm';
  const lbl = 'block text-xs text-stone-500 mb-1';
  const segBtn = (active: boolean, disabled = false) =>
    `flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition-colors ${
      disabled ? 'opacity-50 cursor-not-allowed' :
      active ? 'bg-stone-900 text-white' : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
    }`;
```

with:

```typescript
  const inp = 'w-full rounded border border-border bg-surface px-2 py-1 font-mono text-sm text-fg';
  const lbl = 'block text-xs text-muted mb-1';
  const segBtn = (active: boolean, disabled = false) =>
    `flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition-colors ${
      disabled ? 'opacity-50 cursor-not-allowed' :
      active ? 'bg-fg text-bg' : 'bg-fg/5 text-muted hover:bg-fg/10'
    }`;
```

Replace the modal container opening tag (line ~342):

```typescript
        class="w-full max-w-md overflow-y-auto rounded-lg bg-white p-5 shadow-xl"
```

with:

```typescript
        class="w-full max-w-md overflow-y-auto rounded-lg bg-surface p-5 shadow-xl"
```

Replace the modal title (line ~347):

```typescript
        <h2 class="text-base font-medium text-stone-900">
```

with:

```typescript
        <h2 class="text-base font-medium text-fg">
```

Replace the Scan button (line ~454):

```typescript
                    class="rounded-md bg-stone-100 px-3 py-1.5 text-xs font-medium text-stone-700 hover:bg-stone-200 disabled:opacity-50">
```

with:

```typescript
                    class="rounded-md bg-fg/5 px-3 py-1.5 text-xs font-medium text-muted hover:bg-fg/10 disabled:opacity-50">
```

Replace scanned device address span (line ~468):

```typescript
                        <span class="font-mono text-xs text-stone-700">
```

with:

```typescript
                        <span class="font-mono text-xs text-fg">
```

Replace no-scan hint (line ~477):

```typescript
              <p class="text-xs text-stone-400">Scan ausführen…</p>
```

with:

```typescript
              <p class="text-xs text-faint">Scan ausführen um Geräte auf diesem Bus zu finden.</p>
```

Replace expand toggle buttons (lines ~517, ~596, ~685 — pattern `class="text-xs text-stone-500 hover:text-stone-700"`):

```typescript
                  class="text-xs text-stone-500 hover:text-stone-700">
```

with:

```typescript
                  class="text-xs text-muted hover:text-fg">
```

Replace YF-S201 and BME280 hint paragraphs (lines ~546, ~638, ~809):

```typescript
              <p class="text-xs text-stone-400">
```

with:

```typescript
              <p class="text-xs text-faint">
```

Replace TwoPoint checkbox label (line ~804):

```typescript
              <label class="flex items-center gap-2 text-sm text-stone-700 cursor-pointer">
```

with:

```typescript
              <label class="flex items-center gap-2 text-sm text-fg cursor-pointer">
```

Replace Cancel button (line ~820):

```typescript
              class="rounded-md bg-stone-100 px-3 py-1.5 text-sm font-medium text-stone-700 hover:bg-stone-200 disabled:opacity-50">
```

with:

```typescript
              class="rounded-md bg-fg/5 px-3 py-1.5 text-sm font-medium text-fg hover:bg-fg/10 disabled:opacity-50">
```

Replace Submit button (line ~823):

```typescript
              class="rounded-md bg-stone-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50">
```

with:

```typescript
              class="rounded-md bg-fg px-3 py-1.5 text-sm font-medium text-bg disabled:opacity-50">
```

- [ ] **Step 4: Update Dashboard.tsx — apply semantic classes**

In `Dashboard.tsx`, apply the following replacements throughout the file:

Page wrapper `div` (3 occurrences — error, loading, main):
```
class="min-h-screen bg-stone-50 p-4 text-stone-900 md:p-6"
→
class="min-h-screen bg-bg p-4 text-fg md:p-6"
```

Settings link and Reset WiFi button in header:
```
class="rounded-md border border-stone-300 bg-white px-3 py-1.5 text-xs font-medium text-stone-700 hover:bg-stone-100"
→
class="rounded-md border border-border bg-surface px-3 py-1.5 text-xs font-medium text-muted hover:bg-fg/10"
```

Tab bar border:
```
class="my-4 flex items-end gap-2 border-b border-stone-200"
→
class="my-4 flex items-end gap-2 border-b border-border"
```

Active tab (inside `TabBtn`):
```
'border-stone-900 font-medium text-stone-900'
→
'border-accent font-medium text-fg'
```

Inactive tab (inside `TabBtn`):
```
'border-transparent text-stone-500 hover:text-stone-800'
→
'border-transparent text-muted hover:text-fg'
```

New tab "+ Neu" button:
```
class="shrink-0 whitespace-nowrap border-b-2 border-transparent px-3 pb-2 pt-1.5 text-sm text-stone-500 hover:text-stone-800"
→
class="shrink-0 whitespace-nowrap border-b-2 border-transparent px-3 pb-2 pt-1.5 text-sm text-muted hover:text-fg"
```

Edit dashboard button:
```
class="mb-2 shrink-0 rounded-md border border-stone-300 bg-white px-3 py-1 text-xs text-stone-600 hover:bg-stone-100"
→
class="mb-2 shrink-0 rounded-md border border-border bg-surface px-3 py-1 text-xs text-muted hover:bg-fg/10"
```

Inline code in WiFi reset modal body:
```
<code class="mx-1 rounded bg-stone-100 px-1 font-mono">BrewControl-Setup</code>
→
<code class="mx-1 rounded bg-fg/10 px-1 font-mono">BrewControl-Setup</code>
```

Column header in `Column` component:
```
<h2 class="text-sm font-medium uppercase tracking-wider text-stone-500">{title}</h2>
<span class="text-xs text-stone-400">{count}</span>
→
<h2 class="text-sm font-medium uppercase tracking-wider text-muted">{title}</h2>
<span class="text-xs text-faint">{count}</span>
```

- [ ] **Step 5: Typecheck**

```powershell
cd BrewControl/web
pnpm typecheck
```
Expected: no errors

- [ ] **Step 6: Manual theme verification**

With `pnpm dev` running:
1. Navigate to `/settings/appearance`
2. Toggle Modus: Hell → Dunkel → System — verify page and all cards change
3. Click an accent preset — verify accent color applies to progress bars, active tab underline, accent elements
4. Open color picker and select a custom color — verify contrast (`--accent-fg`) auto-adjusts
5. Toggle Hintergrund-Tönung: Warm / Kalt / Neutral — verify page background shifts subtly, cards unchanged
6. Reload page — verify theme persists (no flash, settings restored from localStorage immediately)
7. Navigate to Dashboard — verify cards use semantic colors (no hardcoded stone-*)

- [ ] **Step 7: Commit**

```
git add BrewControl/web/src/components/ConfirmModal.tsx BrewControl/web/src/components/DashboardEditorModal.tsx BrewControl/web/src/components/AddItemModal.tsx BrewControl/web/src/pages/Dashboard.tsx
git commit -m "refactor(web): all components → semantic CSS tokens, dark mode ready"
```

---

## Final Integration Note

After all tasks are complete and firmware is flashed:

1. `pnpm build` → copy `web/dist/` to SD card
2. Power on ESP32 with SD card
3. Open browser → `http://brewcontrol.local/`
4. Navigate to `/settings/appearance`, change theme
5. Reload — verify theme persists from SD (not just localStorage)
6. Open a second browser tab — change theme in tab 1, reload tab 2 — verify both show same theme (SD is authoritative)
