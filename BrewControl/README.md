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

### Ohne USB: UI über das Netzwerk aufspielen

`uploadfs` braucht die serielle Verbindung — beim esp32dev-Testboard heißt das,
den BOOT-Button von Hand zu halten (kein zuverlässiger Auto-Reset). Es geht auch
über `POST /api/update/assets`, wenn man dem Tar dieselbe Diät verordnet wie
`data/www`: **nur die `.gz`-Dateien**. Das übliche `webui.tar` aus dem
SD-Abschnitt oben enthält roh + gzip (~440 KB) und sprengt die 256-KB-Partition,
nur-gzip sind ~100 KB.

```bash
mkdir -p /tmp/gzonly/assets
cp web/dist/index.html.gz /tmp/gzonly/
cp web/dist/assets/*.gz   /tmp/gzonly/assets/
tar -C /tmp/gzonly -cf /tmp/webui-gz.tar .
curl -F "f=@/tmp/webui-gz.tar" http://<ip>/api/update/assets
```

Beide Boards entpacken das Tar **in-place**, gesteuert über das Build-Flag
`BREWCTL_ASSETS_IN_PLACE` in `platformio.ini`. Die 256-KB-Partition fasst altes
und neues Bundle nicht gleichzeitig, also wird `/www` vor dem Entpacken geleert,
statt erst nach `/www.new` zu entpacken und dann zu tauschen. Die UI ist während
des Uploads weg. Die API bleibt erreichbar. Schlägt der Upload fehl, zum Beispiel
bei `not enough space` oder einem Verbindungsabbruch, liefert jede Nicht-API-Seite
eine eingebaute Notfall-Seite, über die sich das Tar erneut hochladen lässt. Das
geht auch auf einem frisch geflashten Board mit leerem Dateisystem. `index.html`
wird erst nach vollständigem Entpacken freigeschaltet. Vor jeder Datei prüft die
Firmware den freien Platz, denn LittleFS crasht bei vollem Dateisystem mitten im
Schreiben (Panic in `lfs_alloc`), statt einen Fehler zurückzugeben.

Das Flag hängt **an der Partitionsgröße, nicht an LittleFS**. Ein Board ohne
SD-Slot, aber mit größerer Datenpartition (z. B. ein S3 mit 8/16 MB Flash) lässt
es weg und behält den atomaren `/www.new`-Tausch. Dort bleibt die alte UI bei
einem Fehlschlag erhalten.

Auf beiden Boards verifiziert (2026-09-16). Die Firmware selbst geht ohnehin per
OTA über `POST /api/update/firmware`.

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
| `/api/events` | GET | SSE-Stream: `snapshot`-Event nach Connect, alle 1 s und nach jedem Write; `alert`-Event je neuer Meldung |
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
| `/api/remote/discover` | GET | Remote-Items per MQTT/ESP-NOW suchen (async: erst `202`, dann `200`) |
| `/api/config` | GET | Gespeicherte Anlege-Configs aller dynamischen Items |
| `/api/dashboards` | GET, POST | Dashboards auflisten / anlegen |
| `/api/dashboards/<id>` | POST, DELETE | Dashboard ändern / löschen |
| `/api/dashboards/<id>/move` | POST | Dashboard eine Position nach links/rechts verschieben |
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
| `/api/timers` | GET, POST | Timer auflisten / anlegen |
| `/api/timers/<id>` | POST, DELETE | Timer ändern (setzt zurück auf `idle`) / löschen |
| `/api/timers/<id>/control` | POST | `start`/`pause`/`resume`/`stop` |
| `/api/alarms` | GET, POST | Alarmregeln auflisten (inkl. Live-Zustand) / anlegen |
| `/api/alarms/<id>` | POST, DELETE | Regel ändern / löschen |
| `/api/alarms/<id>/enable` | POST | Regel an-/abschalten |
| `/api/alerts` | GET | Meldungsverlauf; `?since=<seq>` holt nur Neueres nach |
| `/api/alerts/clear` | POST | Meldungsverlauf leeren |
| `/api/push` | GET | Push-Status, VAPID-Public-Key und eingerichtete Abos |
| `/api/push/keypair` | GET | Vollständiges VAPID-Keypair (auth-gated, wandert nur im URL-Fragment weiter) |
| `/api/push/subscription` | POST | Keypair + Browser-Abo speichern |
| `/api/push/subscription/<id>` | DELETE | Ein Abo entfernen |
| `/api/push/test` · `/reset` | POST | Testmeldung senden / Keypair und Abos verwerfen |
| `/api/profiles` | GET, POST | Profil-Bibliothek (Kategorien + Profile) lesen / Profil anlegen |
| `/api/profiles/<id>` | POST, DELETE | Profil ändern / löschen |
| `/api/profile-categories` | POST | Kategorie anlegen |
| `/api/profile-categories/<id>` | POST, DELETE | Kategorie umbenennen / mit ihren Profilen löschen |
| `/api/settings` | GET, POST | Theme, Zeit, Update-Kanal, MQTT/Webhook/WebSocket/ESP-NOW |
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
| `/api/auth/status` | GET | Ob ein Gerätepasswort gesetzt ist und ob dieser Client angemeldet ist |
| `/api/auth/login` · `/logout` | POST | Anmelden (Session-Cookie) / abmelden |
| `/api/auth/password` | POST | Passwort setzen, ändern oder (leer) löschen |
| `/api/auth/revoke-all` | POST | Alle Sitzungen abmelden |
| `/api/auth/ui-protection` | POST | UI-/Lesesperre an- oder abschalten (nur bei gesetztem Passwort) |

Erfolgreiche Schreib-Requests antworten mit `204` ohne Body, Fehler mit
`text/plain` und der nackten Meldung (kein JSON-Error-Objekt).

### Push-Benachrichtigungen (optional, standardmäßig aus)

Meldet dieselben Ereignisse wie das Alarm-Center — Grenzwert-Alarme, `fault()`,
Programm-Ende, wartende Schrittbestätigung, fertiger AutoTune — als
Browser-Benachrichtigung, auch bei geschlossenem Dashboard. Technisch derselbe
Alert-Ring aus `AlarmStore`, nur mit einem zweiten Lese-Cursor
(`takePendingPush`), damit sich SSE und Push nicht gegenseitig Meldungen
wegnehmen.

**Warum eine Seite bei GitHub Pages im Spiel ist:** `serviceWorker.register()`
und `pushManager.subscribe()` verlangen einen Secure Context, und die Firmware
liefert im Heimnetz Klartext-HTTP aus. Die statische Seite unter
`BrewControl/push-bootstrap/` (deployt nach
`https://nhhop.github.io/Brauerei/push/`) hält deshalb das Abo und reicht es per
Top-Level-Redirect im URL-Fragment ans Gerät zurück — https→http ist bei
Navigation erlaubt, anders als bei einem Fetch. Danach spricht das Gerät nur noch
ausgehend mit dem Push-Dienst, ein reiner HTTPS-Client wie `FirmwareUpdater`
und `MqttService` auch.

**Ein VAPID-Keypair pro Installation**, von der Bootstrap-Seite erzeugt und an
jedes Gerät weitergereicht. Grund: Ein Browser hält pro Service-Worker-Scope
genau *ein* Abo, fest gebunden an *einen* `applicationServerKey` — ein Keypair
pro Gerät bräuchte einen eigenen statischen Scope-Ordner je Gerät. So genügt ein
Abo pro Browser für beliebig viele Geräte; Gerät zwei ist ein Klick. Kennt ein
Gerät bereits einen Key, reicht die SPA ihn als `?k=` mit, damit ein zweiter
Browser gegen denselben Key abonniert.

Damit der Browser-Speicher nicht veraltet, reicht die SPA beim Einrichten das
vollständige Keypair des Geräts an die Bootstrap-Seite weiter — über
`GET /api/push/keypair` (auth-gated) und dann im **URL-Fragment**, das nie an
GitHubs Server geht. Ohne das behält ein Browser, der gegen einen vom Gerät
gelieferten Schlüssel abonniert hat, seinen eigenen alten im Speicher; das
nächste Gerät ohne eigenen Schlüssel bekäme diesen veralteten, müsste dafür neu
abonnieren — und würde damit allen anderen Geräten ihr Abo entziehen.

Keypair und Abos liegen in NVS und bewusst **nicht** in `/config/*.json` — so
bleiben sie aus `GET /api/backup` heraus. Eine Endpoint-URL ist das Einzige, was
zwischen einem Fremden und den eigenen Benachrichtigungen steht.

Einrichten: Einstellungen → Benachrichtigungen → „Auf diesem Gerät aktivieren".
Danach prüft „Testmeldung senden", ob es wirklich ankommt.

Grenzen:

- **iOS** liefert Push nur an Seiten, die auf dem Home-Bildschirm liegen. Die
  Bootstrap-Seite muss dort über „Teilen → Zum Home-Bildschirm" abgelegt und von
  dort geöffnet werden.
- Als **Absender** zeigt der Browser `github.io` an, nicht das Gerät — das
  vergibt der Browser nach der Herkunft der Seite und ist nicht änderbar.
- Die Pages-Seite ist eine **dauerhafte Abhängigkeit** für *neue* Abos.
  Bestehende laufen weiter, weil das Gerät danach direkt mit dem Push-Dienst
  spricht.
- **Vor dem NTP-Sync** wird nichts verschickt: ein VAPID-JWT trägt eine
  Ablaufzeit und braucht eine echte Uhr. Im Alarm-Center stehen diese Meldungen
  trotzdem.
- Der Klick auf eine Meldung öffnet die **aktuelle IP** des Geräts (bei jedem
  Push frisch gesetzt, nie beim Abo gespeichert) statt `<hostname>.local`, weil
  Android mDNS nicht zuverlässig auflöst.

Die Lib (`ESPToolKit/esp-webPush`) ist upstream archiviert und deshalb auf ihren
letzten Commit gepinnt; `esp_webpush_patch.py` ergänzt eine Deklaration, die
Arduino Core 2.x anders benennt. Details und der geplante Nachfolger stehen in
[`../PLAN.md`](../PLAN.md).

### Zugriffsschutz (optional, standardmäßig aus)

Ohne gesetztes Gerätepasswort ist jeder Endpoint offen — der Auslieferungs- und
Bestandszustand, das Verhalten ist identisch zu vorher. Ein Passwort
(`POST /api/auth/password`, oder Einstellungen → Zugriffsschutz) sperrt danach
**alle schreibenden** Endpoints hinter das Session-Cookie aus
`POST /api/auth/login`; Lesen bleibt offen. Einzige gesperrte Leseroute ist
`GET /api/backup` — das Bundle enthält das MQTT-Passwort im Klartext
(`GET /api/settings` schwärzt es, das Backup nicht).

Einen separaten An/Aus-Schalter gibt es nicht: das gesetzte Passwort *ist* der
Schutz, Löschen hebt ihn auf.

Ein weiterer, eigens umschaltbarer Schritt (`POST /api/auth/ui-protection`,
Einstellungen → Zugriffsschutz → „Auch Lesen/UI sperren"; nur bei gesetztem
Passwort verfügbar) sperrt zusätzlich alle Leserouten und die UI selbst. Ist
er aktiv, liefert das Gerät auf ein unauthentifiziertes `GET /` oder jede
statische Datei eine eigenständige Login-Seite statt der SPA, und jede
sonstige Route (`/api/snapshot`, `/api/settings`, `/api/events`, …) antwortet
mit `401` — offen bleibt nur `/api/auth/*`, damit die Anmeldung selbst
funktioniert. Passwort löschen schaltet auch diesen Schritt automatisch ab.

Ein paar Verhaltensweisen, die sich aus dem Cookie-Modell ergeben:

- Sitzungen liegen nur im RAM — jeder Reboot meldet alle ab.
- Das Cookie hängt am Host, für den es ausgestellt wurde. `http://192.168.1.50/`
  und `http://brewcontrol.local/` sind für den Browser zwei Origins, also zwei
  getrennte Anmeldungen. Nach einer Hostnamen-Änderung ist ebenfalls eine neue
  Anmeldung fällig — das Passwort selbst bleibt erhalten.
- Passwort vergessen: BOOT-Taste beim Einschalten halten. Das leert dieselbe
  NVS-Namespace wie der WLAN-Reset, also auch die Zugangsdaten.

Ohne TLS geht das Passwort beim Anmelden unverschlüsselt über das Netz. Der
Schutz ist gegen Fehlbedienung und beiläufige Zugriffe im Heimnetz gedacht,
nicht gegen einen aktiven Angreifer im selben Segment.

Nicht abgedeckt sind die eigenen Ports der Remote-Transporte: Webhook-Server
und WebSocket-Hub (Einstellungen → Konnektivität) nehmen Verbindungen ohne
Anmeldung an. Wer im Heimnetz den Hub-Port erreicht, kann dem Hub Werte für
Remote-Items unterschieben.

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
UI-Teil über `uploadfs`/USB oder ein gz-only-Tar per `POST /api/update/assets`, s. oben —
ein leeres Board zeigt dafür die eingebaute Notfall-Seite). Der LilyGo-S3 (16 MB) behält die Default-Tabelle + SD (genug Platz).
`LogStore` hat keine eingebaute Log-Rotation — auf diesen beiden Boards mit der
256-KB-Partition nicht unbegrenzt loggen.

## Weiteres

- [`../PLAN.md`](../PLAN.md) — Gesamtstatus + Roadmap (beide Teilprojekte)
- [`../SESSION.md`](../SESSION.md) / [`../SESSION-archive.md`](../SESSION-archive.md) — Session-Log
- [`SensActCtrl/`](../SensActCtrl/) — die zugrundeliegende Library
