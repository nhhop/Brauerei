# BrewControl

Web-UI für ESP32-basierte Brausteuerungen, die auf der
[`SensActCtrl`](../SensActCtrl/)-Library aufsetzen. Live-Monitoring aller
registrierten Sensoren im Browser, Aktoren-Schalten und PID-/Setpoint-
Tuning zur Laufzeit über eine HTTP+SSE-API.

> **Status:** MVP + Laufzeit-Item-Add/Remove + Bus-Discovery + Datenlogging +
> Sollwert-Programme + MQTT/Webhook/ESP-NOW (lokal + Remote-Node) +
> WinUI-3-Fluent-Redesign, alle drei Boards (esp32dev, LOLIN S2 Mini,
> LilyGo T-Display-S3-AMOLED-1.43) hardware-verifiziert. Aktueller
> Gesamtstand/Roadmap: [`../PLAN.md`](../PLAN.md); Session-Historie:
> [`../SESSION.md`](../SESSION.md).

## Architektur

```
┌────────── Browser ───────────┐         ┌──────────── ESP32 ────────────┐
│ Preact-SPA (Tailwind v4)      │         │ AsyncWebServer (Port 80)      │
│ ├─ EventSource → /api/events  │ ◄─SSE──┤ ├─ AsyncEventSource (SSE)     │
│ ├─ fetch GET  /api/snapshot   │ ─HTTP──►│ ├─ /api/snapshot              │
│ ├─ fetch POST /api/actuators  │ ─HTTP──►│ ├─ /api/actuators/<id>        │
│ ├─ fetch POST /api/controllers│ ─HTTP──►│ ├─ /api/controllers/<id>/...  │
│ └─ Static asset requests      │ ─HTTP──►│ └─ serveStatic(SD, "/")       │
└───────────────────────────────┘         │   SensActCtrl::Registry        │
                                          │   ├─ Sensors (tick → read)     │
                                          │   ├─ Controllers (tick → ctl) │
                                          │   └─ Actuators (tick → write) │
                                          └───────────────────────────────┘
                                                       │
                                                ┌──────┴──────┐
                                                │  SD-Karte    │
                                                │  index.html  │
                                                │  assets/*    │
                                                └──────────────┘
```

Die Web-Assets liegen auf einer SD-Karte (hot-swappable, kein
Firmware-Reflash bei UI-Iteration). Live-Updates kommen per
Server-Sent-Events — jede 1 s und nach jedem Schreib-Request bekommt der
Browser einen vollständigen Snapshot.

### Architektur-Entscheidungen

- **`ESPAsyncWebServer`** statt sync `WebServer`: SSE braucht persistente
  Verbindungen — `AsyncEventSource` macht das in wenigen Zeilen, AsyncTCP
  läuft in einem eigenen Task und blockiert `Registry::tick()` nicht.
- **Vite + Preact** statt React: Preact (~3 KB gzipped) passt zum
  Library-Stil ("Simplicity First"), gleiche API, kleineres Bundle.
- **Tailwind CSS 4**: utility-first, kein `tailwind.config.ts`/
  `postcss.config.js`/`autoprefixer` mehr nötig (Lightning CSS eingebaut).
- **SD-Karte** (LilyGo S3) statt LittleFS: das UI-Bundle ändert sich oft
  beim Iterieren — SD ist hot-swappable, kein Reflash nötig.
  **esp32dev/lolin_s2_mini** haben keinen SD-Slot und laufen stattdessen
  auf einer internen LittleFS-Partition (`BREWCTL_USE_LITTLEFS`,
  `partitions_4mb_littlefs.csv`) — Hot-Swap-Vorteil entfällt dort, Deploy
  per `uploadfs` über USB (s. unten).
- **Concurrency:** `serializeRegistry()` läuft im AsyncTCP-Task,
  `Registry::tick()` im loopTask — `Reading`-Werte (float+timestamp+ok)
  sind auf ESP32 nicht atomar gegen torn reads, für den Dashboard-Use
  tolerierbar (sporadisches optisches Flackern, kein Datenverlust). SD/
  LittleFS-Zugriffe selbst sind über einen globalen rekursiven Mutex
  (`SdLock.h`) synchronisiert — Grund war ein realer Concurrency-Bug
  zwischen `loopTask` und `async_tcp` (siehe `SESSION.md` 2026-08-19/20).

## Voraussetzungen

**Hardware:**
- ESP32 Dev-Board
- SD-Karten-Slot (SPI) — nur für `lilygo_t_display_s3_amoled` (onboard-Slot). `esp32dev`
  und `lolin_s2_mini` brauchen **keine** SD-Karte mehr — UI und Config liegen bei denen
  auf einer internen LittleFS-Partition, siehe „Web-UI bauen + auf LittleFS deployen" unten.
- Optional: DS18B20 (1-Wire-Temp), SSR auf GPIO 16 für das Demo-Setup
- BOOT-Button auf GPIO 0 (auf allen Standard-Dev-Boards vorhanden)

**Tools:**
- [PlatformIO Core](https://platformio.org/install/cli) (z.B. via VSCode-
  Extension; CLI in `~/.platformio/penv/Scripts/pio`)
- [Node.js](https://nodejs.org/) ≥ 20 + [pnpm](https://pnpm.io/) ≥ 10
- Sibling-Checkout der Library:
  ```
  repos/
  ├── SensActCtrl/      # parent (https://...)
  └── BrewControl/      # this repo
  ```
  Wird via `lib_deps = symlink://../../SensActCtrl` eingebunden.

## Firmware bauen

```powershell
cd firmware
pio run -e esp32dev               # compile-smoke (~30 s nach erstem Toolchain-DL)
pio run -e esp32dev -t upload     # flash über USB
pio device monitor                # serial @ 115200, mit exception_decoder
```

Pins werden per `-DBREWCTL_*`-Build-Flags in `platformio.ini` pro Board
gesetzt; `main.cpp` hat `#ifndef`-Defaults für `esp32dev`.

**`esp32dev` (Defaults)**

| Pin     | Funktion                | Konstante           |
|---------|-------------------------|---------------------|
| GPIO 0  | BOOT/Reset-Trigger      | `kBootButtonPin`    |
| GPIO 4  | DS18B20 (1-Wire)        | `kOneWirePin`       |
| GPIO 16 | SSR (TPO-Modus)         | `kSsrPin`           |

Kein SD-Pin mehr im Standard-Build (`BREWCTL_USE_LITTLEFS=1`, s.u.) — `kSdCsPin`
(GPIO 5, ⚠ Strapping-Pin/MTDI) existiert im Code weiter, wird aber nur noch im
SD-Zweig verwendet, falls jemand `platformio.ini` lokal auf SD zurückstellt.

**LOLIN S2 Mini (`lolin_s2_mini`)**

Kein onboard-SD-Slot — läuft standardmäßig auf LittleFS (internes Flash), kein externer
SPI-Breakout nötig. Flash über DFU: ersten Flash BOOT + RST halten, danach enumeriert
die Firmware als neuer COM-Port (TinyUSB-CDC).

**LilyGo T-Display-S3-AMOLED-1.43 (`lilygo_t_display_s3_amoled`)**

| Pin     | Funktion                | Build-Flag                  |
|---------|-------------------------|-----------------------------|
| GPIO 38 | SD-Karte CS             | `BREWCTL_SD_CS=38`          |
| GPIO 41 | SD-Karte SCK            | `BREWCTL_SD_SCK=41`         |
| GPIO 39 | SD-Karte MOSI           | `BREWCTL_SD_MOSI=39`        |
| GPIO 40 | SD-Karte MISO           | `BREWCTL_SD_MISO=40`        |
| GPIO 1  | DS18B20 (1-Wire)        | `BREWCTL_ONEWIRE_PIN=1`     |
| GPIO 2  | SSR (TPO-Modus)         | `BREWCTL_SSR_PIN=2`         |

⚠ **OPI-PSRAM-Konflikt:** GPIO 33–37 sind auf ESP32-S3-Varianten mit
Octal-PSRAM intern vom PSRAM-Controller belegt. SPI-Pins müssen diesen
Bereich meiden — sonst hängt `SD.begin()` und der Task-Watchdog feuert.
**Pin-Quellen variieren zwischen AMOLED-Sub-Varianten** (1.43, 1.64,
1.75, 1.91, Plus, Touch) — vor einer neuen Variante Silkscreen am Board
ablesen, nicht Web-Snippets vertrauen.

## Web-UI bauen + auf SD deployen (`lilygo_t_display_s3_amoled`)

```powershell
cd web
pnpm install                      # einmalig
pnpm build                        # → web/dist/  (Vite produziert ~77 KB gzip total)

# Pre-gzip (optional) — AsyncWebServer serviert .gz transparent bei
# Accept-Encoding: gzip; spart spürbar SPI-SD-Reads
Get-ChildItem .\dist -Recurse -Include *.js,*.css,*.html |
  ForEach-Object { & gzip -k9 -- $_.FullName }

# SD-Karten-Root (Laufwerksbuchstabe anpassen):
Copy-Item -Recurse -Force .\dist\* D:\
```

SD-Karte rausziehen, in den ESP32-Slot stecken — der Static-Serve-Handler
liefert ab sofort `index.html` + Assets unter `/`.

## Web-UI bauen + auf LittleFS deployen (`esp32dev`, `lolin_s2_mini`)

Diese beiden Boards haben keinen SD-Slot — die UI landet stattdessen per USB auf einer
internen LittleFS-Partition (`pio run -t uploadfs`, s. „Partition-Layout" unten). Nur die
**gzippten** Assets werden geshippt (`ESPAsyncWebServer` serviert `.gz` transparent, auch
ohne die unkomprimierten Originale) — die volle `dist/` (roh+gzip, ~320 KB) passt nicht in
die 256-KB-Partition, nur-gzip (~77 KB) passt komfortabel:

```powershell
cd web
pnpm install                      # einmalig
pnpm build:sd                     # vite build + gzip (scripts/gzip-dist.js)

# Nur die .gz-Dateien nach firmware/data/www kopieren (Struktur erhalten)
Remove-Item -Recurse -Force ..\firmware\data\www -ErrorAction SilentlyContinue
Get-ChildItem -Recurse -File .\dist -Filter *.gz | ForEach-Object {
    $rel = $_.FullName.Substring((Resolve-Path .\dist).Path.Length + 1)
    $dest = Join-Path (Resolve-Path ..\firmware).Path "data\www\$rel"
    New-Item -ItemType Directory -Force (Split-Path $dest) | Out-Null
    Copy-Item $_.FullName $dest
}

cd ..\firmware
pio run -e esp32dev -t buildfs        # optional: Größen-Check ohne Hardware
pio run -e esp32dev -t uploadfs       # LittleFS-Image per USB flashen
pio run -e lolin_s2_mini -t uploadfs  # gleiches data/, zweites Board
```

`data/` ist projektweit geteilt zwischen allen Envs — **nicht** gegen
`lilygo_t_display_s3_amoled` ausführen (kein `littlefs`-Filesystem dort).

## Erstboot — WiFi-Setup-Portal

Ohne gespeicherte Credentials startet der ESP32 einen Access-Point:

- **SSID:** `BrewControl-Setup`
- **Passwort:** `brew-setup` (Default — pro Build überschreibbar via
  `-DBREWCTRL_SETUP_PWD=\"...\"`)

Smartphone/Laptop verbinden → das Captive-Portal poppt automatisch auf
(sonst `http://192.168.4.1/`). SSID auswählen, Heim-WiFi-Passwort
eintippen, "Connect" → ESP32 speichert in NVS und rebootet. Anschließend:

```
WiFi connected, IP=192.168.x.y
mDNS up: http://brewcontrol.local/
SD mounted
BrewControl ready
```

UI öffnen unter `http://brewcontrol.local/` (mDNS, Primär-URL) oder per
IP. Drei Spalten: Sensors / Controllers / Actuators.

**Factory-Reset:** BOOT-Button beim Power-On gedrückt halten >5 s →
Credentials werden gelöscht, Setup-Portal startet wieder.

## Dev-Workflow (Vite-HMR ohne SD-Reflash)

`pnpm dev` startet den Vite-Server auf `http://localhost:5173` mit
Hot-Module-Reload; API-Calls werden zum ESP32 geproxyt — keine
SD-Karten-Schreiborgie bei UI-Änderungen.

```powershell
cd web
echo "VITE_ESP_HOST=http://192.168.x.y" > .env.local   # IP aus Serial
pnpm dev
# Browser: http://localhost:5173/
```

`.env.local` ist gitignored — jeder Entwickler trägt seine ESP32-IP
selbst ein, kein Branch-Drift.

## API-Vertrag

Der vollständige Vertrag — Request-/Response-Schemas, Status-Codes, Fehler-Bodies
und Reboot-Verhalten — liegt maschinenlesbar in
[`docs/openapi.yaml`](docs/openapi.yaml) (OpenAPI 3.1, Single Source of Truth).
Hier steht nur die Übersicht, welche Route es gibt und wofür sie da ist.

| Endpoint | Methode | Zweck |
|----------|---------|-------|
| `/api/snapshot` | GET | Aktueller Registry-State |
| `/api/events` | GET | SSE-Stream: `snapshot`-Event nach Connect, alle 1 s und nach jedem Write |
| `/api/sensors` | POST | Sensor anlegen |
| `/api/sensors/<id>` | DELETE | Sensor entfernen |
| `/api/sensors/<id>/reset` | POST | Akkumulierten Sensorwert zurücksetzen (z.B. YF-S201-Volumen) |
| `/api/actuators` | POST | Aktor anlegen |
| `/api/actuators/<id>` | POST, DELETE | Wert / `enabled` / Takt-Intervall schreiben; Aktor entfernen |
| `/api/controllers` | POST | Regler anlegen |
| `/api/controllers/<id>` | DELETE | Regler entfernen |
| `/api/controllers/<id>/setpoint` | POST | Sollwert setzen |
| `/api/controllers/<id>/params` | POST | Regler-Parameter setzen |
| `/api/bus/scan` | GET | 1-Wire-Bus nach Geräten scannen |
| `/api/config` | GET | Gespeicherte Anlege-Configs aller dynamischen Items |
| `/api/dashboards` | GET, POST | Dashboards auflisten / anlegen |
| `/api/dashboards/<id>` | POST, DELETE | Dashboard ändern / löschen |
| `/api/logs` | GET, POST | Log-Konfigurationen auflisten / anlegen |
| `/api/logs/<id>` | POST, DELETE | Log-Konfiguration ändern / löschen |
| `/api/logs/<id>/enable` | POST | Logging an-/abschalten |
| `/api/logs/<id>/clear` | POST | Laufende Session schließen, neue beginnen |
| `/api/logs/<id>/sessions` | GET | Aufgezeichnete Sessions auflisten |
| `/api/logs/<id>/sessions/<start>` | DELETE | Eine Session löschen |
| `/api/logs/<id>/data` · `/download` | GET | Session als CSV (inline / als Download) |
| `/api/programs` | GET, POST | Sollwert-Programme auflisten / anlegen |
| `/api/programs/<id>` | POST, DELETE | Programm ändern / löschen |
| `/api/programs/<id>/control` | POST | `start`/`pause`/`resume`/`stop`/`next`/`prev` |
| `/api/profiles` | GET, POST | Profil-Bibliothek (Kategorien + Profile) lesen / Profil anlegen |
| `/api/profiles/<id>` | POST, DELETE | Profil ändern / löschen |
| `/api/profile-categories` | POST | Kategorie anlegen |
| `/api/profile-categories/<id>` | POST, DELETE | Kategorie umbenennen / mit ihren Profilen löschen |
| `/api/settings` | GET, POST | Theme, Zeit, Update-Kanal, MQTT/Webhook/ESP-NOW |
| `/api/network` | GET, POST | WLAN-Status abfragen; Credentials/Hostname setzen (rebootet) |
| `/api/network/scan` | GET | WLAN-Scan (async: erst `202`, dann `200`) |
| `/api/update/status` | GET | Updater-Zustand |
| `/api/update/check` · `/install` | POST | Server-Pull: prüfen / installieren |
| `/api/update/firmware` | POST | Firmware-`.bin` hochladen + flashen (rebootet) |
| `/api/update/assets` | POST | UI-Paket `webui.tar` hochladen + entpacken |
| `/api/backup` | GET, POST | Konfiguration (inkl. Profile) exportieren / importieren (Import rebootet) |
| `/api/files` | GET, DELETE | Verzeichnis listen / Datei oder Ordner löschen |
| `/api/files/download` · `/upload` | GET, POST | Datei herunterladen / hochladen |
| `/api/files/mkdir` · `/rename` | POST | Verzeichnis anlegen / umbenennen |
| `/api/admin/wifi-reset` | POST | NVS löschen, Reboot ins Setup-Portal |

Es gibt **keine Authentifizierung** — das Gerät gehört in ein vertrauenswürdiges
LAN. Erfolgreiche Schreib-Requests antworten mit `204` ohne Body, Fehler mit
`text/plain` und der nackten Meldung (kein JSON-Error-Objekt).

Mehrere DS18B20 auf einem Pin: erst scannen, dann jeden Sensor mit der
gefundenen `address` anlegen — der ESP32 verwaltet die Shared-Bus-Instanz intern.

Snapshot-Shape ist 1:1 zu `SensActCtrl/src/core/RegistrySnapshot.cpp` —
siehe [`web/src/types.ts`](web/src/types.ts) für die TypeScript-Form.

Dynamisch angelegte Items werden in `/config/registry.json` auf SD bzw. LittleFS
(je nach Board) persistiert und nach Reboot automatisch wiederhergestellt.

## Troubleshooting

**`pnpm install` blockt mit "[ERR_PNPM_IGNORED_BUILDS] esbuild"**
pnpm 11 verlangt explizite Approval von Post-Install-Scripts. Einmalig:
```
pnpm approve-builds esbuild
```
Oder als Workaround `vite` direkt via `node ./node_modules/vite/bin/vite.js build`
aufrufen — die Binary ist über `@esbuild/win32-x64` auch ohne Script da.

**SD mount FAILED nach Anstecken**
Strapping-Pin-Konflikt auf GPIO 5 (siehe oben). Pull-up auf CS oder
anderen Pin probieren.

**UI lädt, aber Sensor zeigt `—` + "stale" Badge**
`state.ok = false` aus der Library — Sensor-Treiber meldet Fehler.
Serial-Log liefert den Reading-Status pro `tick()`.

**SSE-Stream bricht nach WiFi-Reconnect ab**
Browser-EventSource reconnected nativ; UI sollte in ≤60 s resumen. Der
eingebaute WLAN-Watchdog (`maintainWiFi()` in `main.cpp`) reconnected bei
Verbindungsverlust selbständig; mDNS wird bei jedem `STA_GOT_IP`-Event neu
angemeldet (`startMDNS()`).

## Firmware-Update

Vier Wege:
- **Server-Pull (GitHub):** `/settings/firmware` → Kanal (stable/preview) wählen →
  „Auf Updates prüfen" → „Installieren". Zieht `firmware-<variant>.bin` + `webui.tar`
  aus dem passenden Release. Repo `nhhop/Brauerei` muss **public** sein.
- **Browser-Upload:** dieselbe Seite — `.bin` (Firmware) bzw. `.tar` (UI-Paket).
- **SD-Boot-Flash (Recovery, ohne WiFi):** Eine Datei `firmware.bin` in den
  **SD-Root** kopieren → beim nächsten Boot wird sie geflasht, danach gelöscht und
  das Gerät rebootet. Funktioniert vor der WiFi-Verbindung, also auch ohne Netz /
  bei fehlenden WiFi-Creds. Keine Versions-/Varianten-Prüfung — passende `.bin` für
  das Board selbst wählen. **Nur `lilygo_t_display_s3_amoled` (SD):** auf `esp32dev`/
  `lolin_s2_mini` passt eine reguläre `firmware.bin` (>1,3 MB) nicht auf die 256-KB-
  LittleFS-Partition — dort bleibt nur Netzwerk-OTA oder USB als Recovery-Weg.
- **USB (Brick-Rettung):** Bootet das Gerät nach einem fehlerhaften Flash nicht mehr,
  ist die WebUI weg → per Kabel `pio run -e <env> -t upload` neu flashen.

### UI liegt jetzt unter /www
Die SPA wird aus `/www` auf der SD-Karte serviert (vorher SD-Root). Beim Deploy:
`Copy-Item -Recurse -Force .\dist\* D:\www\`. Bestehende Karten: Assets nach `/www`
verschieben, oder einmal ein `webui.tar` über die UI einspielen (legt `/www` an).

### webui.tar manuell bauen
Das `webui.tar` ist das gebaute, **gzippte** `dist/` als Tar — Pfade relativ zur
dist-Wurzel (nicht unter `dist/`). Aus `web/`:

```powershell
pnpm build:sd            # vite build + gzip-dist (NICHT nur `pnpm build` — sonst fehlen die .gz)
tar -C dist -cf webui.tar .
```

Das ist exakt die Form, die auch die CI baut. Sie erzeugt `./`-präfixierte Namen;
die Firmware normalisiert die in `SdTarSink` weg (die Glob-Variante
`cd dist; tar -cf ../webui.tar *` ohne `./` geht ebenso). Aufspielen: über
`/settings/firmware` → „UI-Paket (.tar)", oder
`curl -F "f=@webui.tar" http://<ip>/api/update/assets`.

### firmware.bin manuell bauen
Die `firmware.bin` fällt bei jedem `pio run` ab. Aus `firmware/`:

```powershell
pio run -e esp32dev      # oder lolin_s2_mini / lilygo_t_display_s3_amoled
# Ergebnis: .pio\build\<env>\firmware.bin
```

Release-Benennung (wie die CI): `Copy-Item .pio\build\<env>\firmware.bin firmware-<env>.bin`.
Aufspielen: `/settings/firmware` → „Firmware (.bin)",
`curl -F "f=@.pio/build/<env>/firmware.bin" http://<ip>/api/update/firmware`,
als `firmware.bin` in den SD-Root kopieren (Boot-Flash, s.o.), oder
USB via `pio run -e <env> -t upload`. ⚠ Bei den 4-MB-Boards muss der **erste** Flash
mit dem `min_spiffs`-Layout per USB laufen (s. Partition-Layout unten).

Der Multipart-Feldname (`f` in den `curl`-Beispielen oben) ist beliebig — die
Firmware wertet ihn nicht aus und nimmt den ersten File-Part.

### Release erstellen
`git tag vX.Y.Z && git push origin vX.Y.Z` → die GitHub-Action baut alle Board-
Varianten und hängt `firmware-<env>.bin` + `webui.tar` ans Release. Stable = normales
Release, Preview = als „Pre-release" markieren.

### Partition-Layout (partitions_4mb_littlefs)
OTA braucht zwei App-Slots. Der TLS-Pull-Pfad füllt den Default-OTA-App-Slot der
4-MB-Boards (esp32dev, lolin_s2_mini) auf >90 %; deshalb verwenden diese Envs
`board_build.partitions = partitions_4mb_littlefs.csv` (~1,81 MB App-Slots, ~72,7 % belegt;
256-KB-Datenpartition, gemountet als LittleFS unter `BREWCTL_USE_LITTLEFS` — trägt UI +
Settings/Registry/Dashboards/Programme/Logs-Index). Herleitung von `min_spiffs.csv`
(dessen 128-KB-Datenpartition unbenutzt blieb, weil Assets damals auf SD lagen): je
64 KB von beiden App-Slots abgezwackt, komplett in die Datenpartition gesteckt.
**Wichtig:** Der Wechsel auf dieses Layout muss **einmalig per USB** geflasht werden —
OTA kann die Partitionstabelle nicht ändern. Danach laufen OTA-Updates normal (der
UI-Teil weiterhin nur über `uploadfs`/USB, s. oben — `webui.tar`-Netzwerk-Uploads
landen zwar auch im Dateisystem, aber der allererste Bootstrap eines leeren Boards
braucht `uploadfs`). Der LilyGo-S3 (16 MB) behält die Default-Tabelle + SD (genug Platz).
`LogStore` hat keine eingebaute Log-Rotation — auf diesen beiden Boards mit der
256-KB-Partition nicht unbegrenzt loggen.

## Weiteres

- [`../PLAN.md`](../PLAN.md) — Gesamtstatus + Roadmap (beide Teilprojekte)
- [`../SESSION.md`](../SESSION.md) / [`../SESSION-archive.md`](../SESSION-archive.md) — Session-Log
- [`SensActCtrl/`](../SensActCtrl/) — die zugrundeliegende Library
