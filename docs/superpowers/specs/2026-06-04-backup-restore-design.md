# Backup & Restore — Design-Spec

**Datum:** 2026-06-04
**Status:** Design freigegeben, bereit für Implementierungsplan
**Kontext:** BrewControl persistiert seine gesamte Konfiguration in drei JSON-Dateien
unter `/config/` auf der SD-Karte. Bisher gibt es keinen Weg, diese Config zu
sichern oder auf ein anderes Gerät zu übertragen. Dieses Feature fügt einen
Export (Download) und Restore (Upload) der kompletten Konfiguration hinzu.

---

## Ziel

Ein Klick exportiert die gesamte Konfiguration als eine JSON-Datei; eine Datei
hochladen stellt sie wieder her (Replace-all) und startet das Gerät neu.

## Umfang

**Enthalten** (die drei `/config`-Dateien):
- `registry.json` — dynamische Sensoren/Aktoren/Regler (`DynamicItems`)
- `dashboards.json` — Dashboards (`DashboardStore`)
- `settings.json` — Theme + Firmware-Prefs (`SettingsStore`)

**Nicht enthalten:**
- WiFi-Zugangsdaten (liegen in NVS/Preferences, nicht in `/config`). Bewusst
  ausgeschlossen — hält das Backup portabel und vermeidet ein Klartext-Passwort
  in der heruntergeladenen Datei.
- Laufzeit-State (aktuelle Messwerte, Regler-Outputs) — nicht persistent.

## Entscheidungen (aus dem Brainstorming)

1. **Umfang:** nur Config (3 Dateien), kein WiFi.
2. **Restore-Verhalten:** Überschreiben + Reboot (Replace-all). Reuse des
   bestehenden Boot-Lade-Pfads statt Live-Re-Registrierung.
3. **Architektur:** Server-Endpoint `/api/backup` — die Firmware besitzt das
   Format, bündelt und validiert. Der Browser lädt nur eine Datei herunter/hoch.
4. **Restore-Schreibstrategie (Ansatz A):** die drei Sektionen verbatim in die
   `/config`-Dateien schreiben, dann rebooten. Die Sektionen sind byte-identisch
   mit dem, was die Stores ohnehin schreiben/lesen — keine neue
   Serialisierungslogik, kein Weg über die Store-`update()`-Methoden.

---

## Format

Eine JSON-Datei (typische Größe: wenige KB):

```json
{
  "type": "brewcontrol-backup",
  "version": 1,
  "firmwareVersion": "v0.0.1-test",
  "variant": "lilygo_t_display_s3_amoled",
  "registry":   { ... },
  "dashboards": [ ... ],
  "settings":   { ... }
}
```

- `type` / `version` — Identifikation + Forward-Compat-Guard.
- `firmwareVersion` / `variant` — informativ (welches Gerät/welche Firmware das
  Backup erzeugt hat); beim Restore **ignoriert**, kein Varianten-Matching.
- `registry` — exakt `DynamicItems::serializeConfig()` ↔ `/config/registry.json`.
- `dashboards` — exakt `DashboardStore::serialize()` ↔ `/config/dashboards.json`.
- `settings` — exakt `SettingsStore::serialize()` ↔ `/config/settings.json`.

Jede Sektion ist 1:1 das, was der jeweilige Store schon emittiert/konsumiert.

---

## Endpoints (in `WebUI`)

### `GET /api/backup`
Baut das Bündel aus den drei Stores und liefert es als Download:
- Antwort `200`, `Content-Type: application/json`,
  `Content-Disposition: attachment; filename="brewcontrol-backup.json"`.
- Body: das Format oben. Die drei Sektionen werden aus den `serialize()`-Strings
  der Stores in ein `JsonDocument` geparst und unter den Keys eingehängt.

### `POST /api/backup`
JSON-Body (Pattern wie `/api/settings`, `AsyncCallbackJsonWebHandler`):
1. **Validierung (vor jedem Schreibzugriff):**
   - Body ist ein JSON-Objekt.
   - `type == "brewcontrol-backup"`.
   - `version == 1` (höhere/unbekannte Version → 400 mit Hinweis).
   - `registry` ist ein Objekt, `dashboards` ist ein Array, `settings` ist ein
     Objekt — alle drei vorhanden.
   - Bei irgendeinem Fehler: `400` + Klartext-Grund, **nichts** wird geschrieben.
2. **Anwenden:** die drei Sektionen verbatim in `/config/registry.json`,
   `/config/dashboards.json`, `/config/settings.json` schreiben.
3. Antwort `200 "ok"`, danach Reboot über ein `tick()`-Flag (loopTask), analog
   zum OTA-Upload (`rebootAtMs_`).

**Routen-Reihenfolge:** beide vor `serveStatic` registrieren (wie die übrigen
`/api/*`-Routen).

---

## Web-UI

Neue Settings-Kachel **„Backup & Restore"** (`/settings/backup`), Aufbau analog zu
`FirmwarePage`:

- **Export:** Button → `GET /api/backup` → Datei als
  `brewcontrol-backup-<YYYY-MM-DD>.json` speichern. Das Datum wird client-seitig
  gesetzt (Gerät hat **noch** keine Echtzeituhr). Umsetzung via `fetch` → `Blob` →
  temporärer `<a download>`-Klick, damit der Dateiname kontrolliert werden kann.

  > **Zukunfts-Hook:** Sobald das geplante Feature *„Zeit & Formate — Uhrzeit-Sync"*
  > (root `PLAN.md`) gelandet ist, kann der Export ein `exportedAt`-Feld mit der
  > Geräte-Wall-Clock-Zeit ins Bündel schreiben und den Dateinamen daraus ableiten,
  > statt aus der Browser-Zeit. Bis dahin bleibt es client-seitig.
- **Import:** File-Picker (`.json`) → `ConfirmModal` (Warnung: „überschreibt die
  komplette Konfiguration und startet das Gerät neu") → Browser liest die Datei
  via `FileReader` als Text → `POST /api/backup` (Body = Dateitext) → bei `200`
  „Neustart…"-View (Pattern wie WiFi-Reset / `RebootingView`).
- Validierungsfehler vom Server (`400`) werden als Fehlermeldung angezeigt; die
  laufende Config bleibt unangetastet.

Kachel + Eintrag in `SettingsIndex`, Route in `app.tsx`.

---

## Fehlerbehandlung

- **Validierung vor Schreibzugriff:** ein kaputtes oder fremdes Backup darf die
  laufende Konfiguration niemals beschädigen. Erst vollständig prüfen, dann
  schreiben.
- **Replace-all:** der Restore ersetzt die gesamte Config. Kein Merge, keine
  ID-Kollisionsauflösung.
- **Reboot:** nach erfolgreichem Schreiben startet das Gerät neu; der normale
  Boot-Pfad (`loadFromSD`) lädt die wiederhergestellte Config. Tolerant gegenüber
  einzelnen kaputten Item-Einträgen (bestehendes Verhalten von `loadFromSD`).
- **Teil-Schreibfehler:** sollte das Schreiben einer der drei Dateien fehlschlagen
  (SD-Fehler), wird das im Log vermerkt; der Reboot lädt, was vorhanden ist. (Ein
  voll-atomarer Drei-Datei-Swap ist Out-of-Scope — SD-Schreibfehler sind selten
  und der Nutzer kann erneut importieren.)

## Komponenten & Grenzen

- **`WebUI`** — zwei neue Routen; nutzt die bestehenden Store-Referenzen
  (`DynamicItems`, `DashboardStore`, `SettingsStore`) zum Bündeln und schreibt
  beim Restore direkt die `/config`-Dateien. Reboot über das bestehende
  `rebootAtMs_`/`tick()`-Muster.
- **Stores** — unverändert; ihre `serialize()`-Ausgaben sind die Bündel-Sektionen.
  Falls eine kleine Hilfsfunktion zum direkten Schreiben einer Sektion in eine
  Datei sinnvoll ist, lebt sie in `WebUI` (kein Store-Umbau).
- **Web** — neue `BackupPage.tsx`, API-Funktionen in `api.ts`, Kachel in
  `SettingsIndex`, Route in `app.tsx`.

## Testing

- **Compile-Smoke** (alle drei Boards) + **`pnpm typecheck`/`build`**.
- **Validierungslogik:** der Restore-Validator (type/version/Sektionen) ist die
  einzige nicht-triviale Logik. Wenn er sich ohne Arduino-Kopplung
  herauslösen lässt, als host-getesteter Helfer (native env, wie `TarExtractor`);
  andernfalls per HW-E2E abgedeckt.
- **HW-E2E:** Export → Config ändern (Item löschen/hinzufügen, Theme ändern) →
  exportierte Datei importieren → Reboot → Config ist auf dem exportierten Stand.
  Negativtest: fremde/kaputte Datei → `400`, laufende Config unverändert.

## Out of Scope

- WiFi-Backup, granulare Teil-Auswahl beim Export, Merge-Restore, Live-Restore
  ohne Reboot, voll-atomarer Drei-Datei-Swap, Cloud-Sync, automatische/geplante
  Backups, Backup-Verschlüsselung.
