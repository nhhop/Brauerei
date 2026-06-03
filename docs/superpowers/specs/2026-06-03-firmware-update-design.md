# Spec: Firmware-Update (OTA, Browser-Upload, Server-Pull) — BrewControl

**Datum:** 2026-06-03
**Status:** Design abgestimmt, bereit für Implementierungsplan
**Scope:** BrewControl (Firmware + Web). SensActCtrl nur als Host-Test-Env für `TarExtractor`.

## Kontext

OTA-Firmware-Update steht in [BrewControl/PLAN.md](../../../BrewControl/PLAN.md) (Future Work)
und im Root-[PLAN.md](../../../PLAN.md) (Welle 3, Zeile 157–158) — letzteres mit dem
expliziten Hinweis, dass OTA **auch fürs Display-Nachrüsten** relevant ist
(„Firmware je nach Display laden, online oder SD-Karte"). Das interaktive
LVGL-Display ist board-spezifisch (Ziel: LilyGo T-Display-S3-AMOLED), d.h. ein
Release muss **mehrere Firmware-Varianten** anbieten und das Gerät die zu sich
passende ziehen.

BrewControl hat heute eine ausgebaute WebUI ([WebUI.cpp](../../../BrewControl/firmware/src/WebUI.cpp))
mit `/api/...`-Routen, SSE-Snapshot-Stream, SD-served Frontend, einem
`SettingsStore` (heute nur Theme) und einem Settings-Bereich in der Preact-SPA
(`/settings`, `/settings/appearance`, `/settings/devices`). Dieses Feature dockt
dort an: neuer Bereich `/settings/firmware`, neue `/api/update/…`-Routen, zwei
neue Firmware-Module.

## Ziel

Drei Wege, Firmware bzw. UI auf das Gerät zu bringen:

| Weg | Quelle | Ziel | Auslöser |
|-----|--------|------|----------|
| **Browser-Upload** | `.bin` / `.tar` vom PC | Flash bzw. SD | manueller File-Upload |
| **Server-Pull** | GitHub Release (`firmware-<variant>.bin` + `webui.tar`) | Flash + SD | Button „Installieren" nach Check |
| **Auto-Check** | GitHub API (nur Versions-Abfrage) | — | periodisch (täglich), zeigt nur Badge |

## Festgelegte Entscheidungen

- **Quelle = GitHub Releases.** `stable` = latest Release, `preview` = neuestes
  Pre-Release. Version = `tag_name`.
- **Zwei Asset-Typen pro Release:** `firmware-<variant>.bin` (eine pro Build-Env)
  + **eine** `webui.tar` (board-/varianten-unabhängig). Ein Pull aktualisiert
  Firmware **und** UI konsistent.
- **UI-Paket = unkomprimiertes TAR**, das die schon vor-gzippten Dateien
  (`index.html.gz`, `assets/*.js.gz`, …) enthält → Streaming-Entpacker auf dem
  ESP32, keine Dekomprimierungs-Lib. Derselbe Entpacker dient Upload **und** Pull.
- **HTTPS via `setInsecure`** (TLS-Verschlüsselung, keine Zert-Prüfung) — passt
  zum Hobby-LAN-Niveau, kein CA-Pflegeaufwand. Härtung siehe Future Work.
- **Auto-Check + manueller Flash:** Gerät prüft im Hintergrund, flasht nie ohne
  Klick.
- **Kein Code-Signing, kein API-Auth** in v1 — konsistent mit der bestehenden API.
- **Asset-Ordner-Update atomar:** TAR nach `/assets.new` entpacken → bei Erfolg
  altes `/assets` löschen + Rename. Keine Karteileichen, kein Halb-Zustand.

**Sicherheits-/Robustheits-Netz:** Browser-Upload (.bin) über lokales WiFi ist
der Rückfallweg, falls der GitHub-Pull je ausfällt; USB-Flash als letzte Instanz.
Kein Pfad kann das Gerät dauerhaft aussperren.

## Versionierungs- & Varianten-Modell

- Jede Firmware bettet **zwei** Build-Flags ein:
  - `BREWCTL_VERSION` = Release-Tag (z.B. `v1.4.0`)
  - `BREWCTL_VARIANT` = `${PIOENV}` (z.B. `esp32dev`, `lolin_s2_mini`,
    `lilygo_t_display_s3_amoled`)
- Beide werden vom PlatformIO-`extra_script` automatisch gesetzt
  (`BREWCTL_VERSION` aus `git describe --tags --always` lokal bzw. aus
  `GITHUB_REF`-Tag im CI; `BREWCTL_VARIANT` aus `env["PIOENV"]`). `version.h`
  liefert einen Default, falls das Flag fehlt.
- Ein späterer **LVGL-Display-Build** ist einfach eine neue Env
  (z.B. `lilygo_t_display_s3_amoled_lvgl`) → neue Variante, ohne Schema-Änderung.
- **Geräte-Logik beim Check:** im Release das Asset `firmware-${BREWCTL_VARIANT}.bin`
  suchen.
  - gefunden + Tag ≠ eigene Version → Update anbieten.
  - **nicht** gefunden → „Für diese Variante (`<id>`) gibt es in diesem Release
    kein Image" (graceful — statt etwas Falsches zu flashen).
- **Browser-Upload bleibt varianten-agnostisch:** wer manuell eine `.bin`
  hochlädt, ist selbst verantwortlich, die richtige zu nehmen (Warnhinweis in der
  UI). Varianten-Prüfung der hochgeladenen `.bin` = **Out of Scope v1**.

## Firmware-Architektur

### Neu: `TarExtractor` (`firmware/src/TarExtractor.h/.cpp`)

Streaming-USTAR-Parser. Bekommt Bytes häppchenweise (`feed(const uint8_t*, size_t)`),
schreibt pro Eintrag eine Datei nach `fs::FS&`. Kennt nur 512-Byte-Header-Blöcke
(Name + Oktal-Größe) + Daten-Padding auf 512 — keine Kompression, kein State außer
„aktuelle Datei + Restbytes". Eine Verantwortung, klare Schnittstelle, ohne
Hardware testbar (Bytes rein → Dateien raus). Wird von **Upload und Pull** geteilt.

- Ziel ist ein konfigurierbarer Basis-Pfad (`/assets.new`), damit die atomare
  Rename-Strategie aus dem Aufrufer kommt, nicht aus dem Extractor.
- Unterstützt Sub-Ordner (`assets/foo.js.gz`) — legt fehlende Verzeichnisse an.
- Robustheit: ungültiger Header / Größenüberlauf → Fehlerzustand, Aufrufer bricht ab.

### Neu: `FirmwareUpdater` (`firmware/src/FirmwareUpdater.h/.cpp`)

Orchestrator mit State-Machine:
`Idle → Checking → UpdateAvailable → Downloading → Flashing → Success | Error`.

- `checkGithub(channel)` — `GET api.github.com/repos/<repo>/releases/latest`
  (bzw. neuestes Pre-Release für `preview`), parst `tag_name` + `assets[]`,
  vergleicht mit `BREWCTL_VERSION`, hält Ergebnis im Status.
- `installFromGithub(channel)` — lädt `firmware-<variant>.bin` → `httpUpdate`
  (Flash) und `webui.tar` → `TarExtractor` (SD, atomar), dann Reboot.
- `tick()` — treibt Check und Pull **auf dem loopTask** (siehe Threading) und den
  Auto-Check-Timer.
- Status-Getter für die Status-API (state, currentVersion, variant, channel,
  autoCheck, available {version, notes}, progress 0..100, error).

### Threading-Modell (kritisch)

- **Server-Pull** (GitHub) ist ein blockierender HTTPClient-Download → läuft
  **niemals** im AsyncTCP-Callback, sondern auf dem **loopTask**: die HTTP-Route
  setzt nur ein „requested"-Flag + Parameter und antwortet sofort `202`;
  `FirmwareUpdater::tick()` führt den Download in der nächsten `loop()`-Iteration
  aus. So wird der Webserver nicht blockiert und der Task-Watchdog feuert nicht.
- **Browser-Upload** läuft inhärent im AsyncWebServer-Upload-Callback (Chunks im
  AsyncTCP-Task) → jeder Chunk geht direkt in `Update.write()` bzw.
  `TarExtractor::feed()`. Inkrementell, pro Chunk unkritisch (so macht es auch
  ElegantOTA).

### GitHub-Client-Details (sonst stille Fehler)

- **User-Agent-Header zwingend** — ohne UA antwortet die GitHub-API `403`.
- **Redirects folgen** — `browser_download_url` leitet auf
  `objects.githubusercontent.com` um → `setFollowRedirects(HTTPC_STRICT_FOLLOW_REDIRECTS)`.
- `setInsecure()` (WiFiClientSecure) für **beide** Hosts.
- Rate-Limit unauth.: 60/h pro IP — täglicher Auto-Check unkritisch.
- Releases-JSON ist groß → **ArduinoJson-Filter** auf `tag_name`, `prerelease`,
  `assets[].name`, `assets[].browser_download_url`; nicht komplett in den RAM.

### Erweiterungen am Bestehenden

- `SettingsStore` bekommt eine `firmware`-Sektion (`channel: "stable"|"preview"`,
  `autoCheck: bool`) — persistiert über Reboot, gleiche Lade-/Speicher-Mechanik
  wie Theme. Über das bestehende `/api/settings` (kein separater Config-Endpoint).
- `WebUI` hält eine `FirmwareUpdater&`-Referenz und registriert die Update-Routen.
- `main.cpp` instanziiert `FirmwareUpdater`, ruft im `loop()` `updater.tick()`.

## API-Vertrag

Alle unter `/api/update/…`:

| Endpoint | Methode | Body / Params | Wirkung |
|----------|---------|---------------|---------|
| `/api/update/status` | GET | — | `{state, currentVersion, variant, channel, autoCheck, available:{version,notes}|null, progress, error}` — von der UI gepollt. |
| `/api/update/check` | POST | `{"channel":...}` (opt., sonst Settings) | Setzt „check requested" → `202`. Ergebnis im Status. |
| `/api/update/install` | POST | `{"channel":...}` (opt.) | Setzt „install requested" → `202`. Pull+Flash auf loopTask, Fortschritt im Status. |
| `/api/update/firmware` | POST (multipart) | `.bin` | Browser-Upload → `Update.write` (Flash) → Reboot. |
| `/api/update/assets` | POST (multipart) | `.tar` | Browser-Upload → `TarExtractor` → SD (atomar `/assets.new`+Rename). |

`channel` + `autoCheck` werden über `/api/settings` (SettingsStore-`firmware`)
persistiert.

**Fortschritt = Polling, nicht SSE.** Während Check/Flash pollt die UI
`/api/update/status` (~1×/s). Bewusst entkoppelt vom Snapshot-SSE; beim
Flash/Reboot bricht die Verbindung ohnehin ab — Polling ist robuster.

## Web-UI

- Neue Kachel in [SettingsIndex.tsx](../../../BrewControl/web/src/pages/SettingsIndex.tsx):
  „Firmware-Update" → `/settings/firmware`.
- Neue Seite `pages/FirmwarePage.tsx`, Route in
  [app.tsx](../../../BrewControl/web/src/app.tsx). Aufbau:
  1. **Status-Kopf:** aktuelle Version + Variante (`v1.3.2 · lilygo_t_display_s3_amoled`).
  2. **Server-Update:** Channel-Auswahl (Stable/Preview) · Auto-Check-Toggle ·
     Button „Auf Updates prüfen" → verfügbare Version + Release-Notes → Button
     „Installieren" (über bestehende
     [ConfirmModal.tsx](../../../BrewControl/web/src/components/ConfirmModal.tsx))
     → Fortschrittsbalken → Reboot-Ansicht.
  3. **Manueller Upload:** zwei Dropzones — „Firmware (.bin)" und „UI-Paket (.tar)"
     — mit Upload-Progress (XHR `upload.onprogress`), Confirm vor Firmware-Flash.
  4. **Warnbanner:** „Nicht während eines laufenden Brauvorgangs aktualisieren."
- Badge „Update verfügbar" (wenn Auto-Check fündig) auf der Settings-Kachel und am
  Settings-Eingang im Dashboard.
- `api.ts`: `getUpdateStatus()`, `checkUpdate(channel)`, `installUpdate(channel)`,
  `uploadFirmware(file, onProgress)`, `uploadAssets(file, onProgress)`.
  `types.ts`: `UpdateStatus`, Erweiterung von `AppSettings` um `firmware`.

## GitHub-Release-Format & CI

- Repo: kompile-fester Default `-DBREWCTL_GITHUB_REPO="owner/repo"` (v1 Konstante;
  Override via Settings = Future Work).
- Tag = Version (`v1.4.0`). Stable = normales Release; Preview = Pre-Release-Flag.
- Assets: `firmware-<variant>.bin` (eine pro Env) + **eine** `webui.tar`.
- Gerät: `stable` → `GET /releases/latest`; `preview` → `GET /releases`, erstes
  mit `prerelease:true`.

**CI-Workflow** (`.github/workflows/release.yml`, neu): trigger auf Tag-Push
(`v*`). Matrix über die Envs → `pio run -e <env>`, `firmware.bin` → `firmware-<env>.bin`.
Web-Job: `pnpm build` + Pre-Gzip → `tar` → `webui.tar`. Alle Artefakte ans Release
(`softprops/action-gh-release`). Tag setzt `BREWCTL_VERSION` über den extra_script
(liest `GITHUB_REF`).

## Partition / Flash

- OTA braucht zwei App-Slots (`app0`/`app1` + `otadata`). esp32dev (4 MB)
  Default-Partition (`default.csv`) hat das: ~1.31 MB pro Slot.
- Neuer Footprint inkl. **WiFiClientSecure/mbedTLS** (TLS ~50–100 KB) muss in
  1.31 MB passen.
- **Verifikationsschritt:** `pio run -e esp32dev`, `RAM/Flash %`-Zeile prüfen.
  Falls App-Slot zu eng → `board_build.partitions = min_spiffs.csv` (~1.9 MB pro
  App-Slot; kein SPIFFS genutzt, Assets liegen auf SD). Reine `platformio.ini`-Zeile.
- ⚠ **Migrations-Caveat:** Wechsel des Partition-Layouts braucht **einmalig
  USB-Flash** (OTA kann das Layout des laufenden Images nicht ändern). Danach
  läuft OTA normal. Gehört in die README.

## Build-Phasen & Verifikation

Jede Firmware-Phase endet mit `pio run -e esp32dev` compile-smoke.

1. **Versions-/Varianten-Infrastruktur** — `extra_script` injiziert
   `BREWCTL_VERSION` + `BREWCTL_VARIANT`, `version.h`-Fallback.
   *Verify:* `/api/update/status`-Stub liefert `currentVersion` + `variant`.
2. **`TarExtractor`** (isoliert, host-getestet) — USTAR-Streaming → `fs::FS`.
   *Verify:* Host-Test im SensActCtrl-`native`-Env: TAR-Bytes → erwartete Dateien
   (Sub-Ordner `assets/`, Padding, mehrere Dateien).
3. **Browser-Upload Firmware (.bin)** — `/api/update/firmware` → `Update` → Reboot.
   *Verify (HW):* gebautes `.bin` hochladen → Reboot, Status zeigt neue Version.
4. **Browser-Upload Assets (.tar)** — `/api/update/assets` → `TarExtractor` → SD
   atomar. *Verify (HW):* `webui.tar` hochladen → UI lädt neu, alte Assets weg.
5. **`FirmwareUpdater` + GitHub-Check** — State-Machine, `checkGithub`,
   `/api/update/check`+`/status`, SettingsStore-`firmware`.
   *Verify (HW):* Check gegen echtes Test-Release → verfügbare Version + Notes;
   falsche Variante → graceful „kein Image".
6. **GitHub-Install (Pull)** — `installFromGithub`: `firmware-<variant>.bin` via
   `httpUpdate` + `webui.tar` via `TarExtractor`, auf loopTask.
   *Verify (HW):* Install aus Test-Release → FW + UI aktualisiert, Reboot.
7. **Auto-Check-Timer + Badge** — periodischer Check (täglich), persistenter
   Channel/Toggle, UI-Badge. *Verify (HW):* Timer verkürzt → Badge erscheint.
8. **Web-UI** — `FirmwarePage.tsx`, SettingsIndex-Kachel, `api.ts`/`types.ts`,
   Progress-Polling, ConfirmModals, Warnbanner.
   *Verify:* gegen Gerät via Dev-Proxy alle Flows klickbar.
9. **CI + README** — `.github/workflows/release.yml` (Matrix-Build →
   `firmware-<env>.bin` + `webui.tar`), README: Release-Prozess +
   Partition-Migrations-Caveat. *Verify:* Test-Tag gepusht → Release mit allen
   Assets.

**Querschnitt:** Compile-smoke pro Env nach Firmware-Änderungen; Host-Test für
`TarExtractor`; E2E auf realer HW (esp32dev + LilyGo S3) für die Flash-Pfade; ein
echtes GitHub-Test-Release für Check+Pull.

## Out of Scope (v1)

- Varianten-Prüfung der per Browser hochgeladenen `.bin`.
- `BREWCTL_GITHUB_REPO` als Laufzeit-Setting (v1: Kompile-Konstante).
- espota / ArduinoOTA-Netzwerk-Push (bewusst weggelassen).
- Rollback-Automatik bei fehlerhaftem Boot (`esp_ota_mark_app_valid` / Rollback) —
  kann später ergänzt werden; v1 verlässt sich auf die Browser-Upload-Rettung.

## Future Work — Härtung über Hobby hinaus

Wenn das Projekt aus der Hobby-Ecke heraus soll, gehören diese drei zusammen
(einzeln greifen sie zu kurz):

- **TLS-Cert-Pinning** — GitHubs Root-CAs (DigiCert **und** Sectigo) gepinnt statt
  `setInsecure`. Mehrere Roots gleichzeitig pinnen übersteht die meisten
  CA-Rotationen; bei Totalausfall einmalig per Browser-Upload neue Firmware mit
  aktualisierter CA einspielen.
- **API-Auth** — Token oder HTTP-Basic als Middleware vor den Update-Routen (und
  konsequenterweise vor der ganzen API).
- **Firmware-Code-Signing** — signierte Images + Verifikation vor dem Flash. Ohne
  das bleibt selbst mit Cert-Pinning + Auth die offene Flanke, dass ein
  manipuliertes Image geflasht wird.
