# Appearance-Settings (Design/Theme) — Design

**Datum:** 2026-06-01
**Scope:** BrewControl (Firmware + Web)
**Roadmap:** Feature-Track, Welle 1 — erster Teil des Settings-Eimers

## Ziel

Geräteweit konfigurierbares Erscheinungsbild der Browser-UI: Hell/Dunkel/System,
Akzentfarbe (Presets + freier Picker), Hintergrund-Tönung (neutral/warm/kalt).
Die Einstellung wird auf dem ESP32 (SD) gespeichert und gilt für alle Clients.

Dieses Feature legt zugleich die **App-Settings-Infrastruktur** (Settings-Store
auf SD + API) an, die spätere Settings-Teile (z.B. *Zeit & Formate*) mitnutzen.

## Funktionaler Scope

- **Modus:** Hell / Dunkel / System (System folgt `prefers-color-scheme` des Clients)
- **Akzent:** 6 Presets (Bernstein `#d97706` als Default, Kupfer, Blau, Grün, Rot, Violett) + freier Hex-Picker
- **Hintergrund-Tönung:** Neutral (= aktuelle Stone-Palette, keine optische Änderung) / Warm / Kalt — rein per CSS
- **Bild/Textur als Hintergrund:** bewusst **nicht** in diesem Scope (spätere Erweiterung)

## Navigation

Settings wird zum **Hub mit Unterseiten** (saubere Trennung, erweiterbar):

| Route | Seite | Inhalt | `←` zurück zu |
|---|---|---|---|
| `/settings` | `SettingsIndex` (Hub) | Kategorie-Liste (Darstellung, Geräte; spätere je eine Zeile) | `/` (Dashboard) |
| `/settings/appearance` | `AppearancePage` (Darstellung) | Theme-Controls | `/settings` |
| `/settings/devices` | `DevicesPage` (Geräte) | heutige Geräteverwaltung | `/settings` |

Der `⚙`-Tab im Dashboard zeigt unverändert auf `/settings` (jetzt der Hub).

## Architektur

Das Theme ist der erste Eintrag eines neuen geräteweiten `AppSettings`-Stores
(SD + API). Angewendet wird es clientseitig über **semantische CSS-Token**
(CSS-Variablen → Tailwind-4-Theme), nicht über `dark:`-Varianten — so fallen
Dark-Mode, Akzent, Tönung und künftige Themes aus einer Quelle ohne Duplikation.

## Komponenten

### Firmware (spiegelt das `DashboardStore`-Muster)

- **`SettingsStore.h/cpp`** (neu) — hält einen App-Settings-JSON-Blob.
  - Methoden: `loadFromSD(fs::FS&)`, `saveToSD(fs::FS&) const`, `String serialize() const`, `update(const JsonObject&)`.
  - Persistenz: `/config/settings.json`. Fehlt die Datei → Defaults (kein Fehler).
  - JSON-Shape (erweiterbar):
    ```json
    { "theme": { "mode": "light|dark|system", "accent": "#d97706", "background": "neutral|warm|cool" } }
    ```
  - `update()` merged Teil-Patches in den bestehenden Blob (nicht ersetzen), damit
    spätere Settings-Bereiche koexistieren.
- **`WebUI.h/cpp`** — Konstruktor bekommt zusätzlich `SettingsStore&`; zwei Routen:
  - `GET /api/settings` → `store.serialize()`
  - `POST /api/settings` → Body in `JsonObject`, `store.update(...)`, `saveToSD`, `200`.
  - Handler-Reihenfolge unkritisch (keine `:id`-Subpfade) — als einfache Routen registrierbar.
- **`main.cpp`** — `SettingsStore settingsStore;` global; `settingsStore.loadFromSD(SD)`
  im `if(sdOk)`-Block; an `WebUI`-Konstruktor übergeben.

### Web

- **`styles.css`** — Token-Variablen + Tailwind-Mapping:
  - `:root` definiert die Hell-Tokens (= aktuelle Stone-Werte), `[data-theme="dark"]`
    die Dunkel-Tokens. System-Modus: `@media (prefers-color-scheme: dark)` setzt dieselben
    Dunkel-Tokens, solange kein explizites `data-theme` gesetzt ist.
  - Mapping in Tailwind via `@theme inline { --color-bg: var(--bg); --color-surface: var(--surface); … }`
    → erzeugt Utilities `bg-bg`, `bg-surface`, `text-fg`, `text-muted`, `text-faint`,
    `border-border`, `bg-accent`, `text-accent-fg` usw.
- **`theme.ts`** (neu) — wendet `ThemeSettings` auf `document.documentElement` an:
  - setzt/entfernt `data-theme` (bei `system` keins → Media-Query greift),
  - setzt `--accent` und berechnet `--accent-fg` automatisch (Luminanz → schwarz/weiß) für garantierten Kontrast,
  - setzt die Tönung (verschiebt nur `--bg`; Karten/`--surface` bleiben neutral).
  - Liest/schreibt einen **localStorage-Cache** des zuletzt angewandten Themes (nur Cache, nicht Quelle der Wahrheit).
- **`types.ts`** — `ThemeSettings { mode: 'light'|'dark'|'system'; accent: string; background: 'neutral'|'warm'|'cool' }`, `AppSettings { theme: ThemeSettings }`.
- **`api.ts`** — `getSettings(): Promise<AppSettings>`, `updateSettings(patch: Partial<AppSettings>): Promise<void>` (`POST /api/settings`).
- **`pages/SettingsIndex.tsx`** (neu) — Hub mit Kategorie-Zeilen (Link auf Unterseiten).
- **`pages/AppearancePage.tsx`** (neu) — Darstellung; Modus-Segmente, Akzent-Swatches + Picker,
  Tönungs-Segmente. Änderung greift sofort (optimistisch über `theme.ts`) + `updateSettings`.
- **`pages/DevicesPage.tsx`** (neu) — Inhalt der heutigen `SettingsPage.tsx` 1:1 verschoben;
  `←` zeigt auf `/settings` statt `/`.
- **`pages/SettingsPage.tsx`** entfällt (Inhalt → DevicesPage).
- **`app.tsx`** — drei Settings-Routen statt einer; beim Mount `getSettings()` laden +
  Theme anwenden (nach Sofort-Apply aus localStorage-Cache).
- **Refactor** — die bestehenden Komponenten (`SensorCard`, `ActuatorCard`,
  `ControllerCard`, `ConfirmModal`, `AddItemModal`, `DashboardEditorModal`, `Dashboard`,
  `DevicesPage`, `app`) von hartkodierten `stone-*`/`white`/`bg-stone-900`-Klassen auf
  die semantischen Klassen umstellen. Das ist der Hauptaufwand und Voraussetzung dafür,
  dass Theming überhaupt greift.

## Token-Set

`--bg` (Seite), `--surface` (Karten), `--text`/`--fg`, `--muted`, `--faint`, `--border`,
`--accent`, `--accent-fg` (Text auf Akzent).

- **Neutral** = aktuelle Stone-Palette → Default ändert die Optik nicht.
- **Warm/Kalt** verschieben nur `--bg` leicht ins Warme/Kalte; Karten (`--surface`) bleiben neutral.
- **Dark** = Stone-900-Flächen, Stone-800-Karten, helle Schrift (vgl. Mockup).

## Datenfluss

1. **Boot:** Firmware lädt `/config/settings.json` in den `SettingsStore`.
2. **Browser-Load:** App wendet sofort das im localStorage gecachte Theme an
   (kein Flash), holt parallel `GET /api/settings` und gleicht ab — bei Abweichung
   erneut anwenden + Cache aktualisieren.
3. **Änderung:** sofort auf `<html>` anwenden + `updateSettings` (`POST`).
4. **Bewusste Einschränkung:** andere offene Clients sehen die Änderung erst beim
   Reload — kein SSE-Push für Settings (Simplicity First).

## Fehlerbehandlung

- `GET /api/settings` ohne Datei → Default-JSON.
- `POST /api/settings` mit ungültigem Body → `400`.
- Frontend: Fetch-Fehler → Defaults + localStorage-Cache.
- Freier Picker: Hex validieren; `--accent-fg` automatisch per Luminanz für Kontrast.

## Testing / Verifikation

- **Firmware:** `pio run -e esp32dev` Compile-Smoke. `SettingsStore` ist FS-/JSON-Logik
  wie `DashboardStore` (dort kein Native-Test) → kein Unit-Test, manuelle Verifikation.
- **Web:** `pnpm typecheck`; manuell/Playwright: Toggle wirkt sofort, Reload behält Theme,
  System-Modus folgt OS-Einstellung, Akzent-Picker + Kontrast korrekt.

## Nicht im Scope (Vormerkung)

- Hintergrund **Bild/Textur** (Upload/Assets, Lesbarkeits-Overlay).
- SSE-Push von Settings an andere offene Clients.
- Weitere Settings-Bereiche (Zeit & Formate, Backup/Restore, OTA, Netzwerk) —
  nutzen aber denselben `SettingsStore` + Hub.
