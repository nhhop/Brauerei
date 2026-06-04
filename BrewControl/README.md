# BrewControl

Web-UI für ESP32-basierte Brausteuerungen, die auf der
[`SensActCtrl`](../SensActCtrl/)-Library aufsetzen. Live-Monitoring aller
registrierten Sensoren im Browser, Aktoren-Schalten und PID-/Setpoint-
Tuning zur Laufzeit über eine HTTP+SSE-API.

> **Status:** MVP vollständig + Laufzeit-Item-Add/Remove + Bus-Discovery.
> E2E auf LOLIN S2 Mini und LilyGo T-Display-S3-AMOLED-1.43 verifiziert.
> Verbleibende offene Punkte sind peripherie-gebunden (DS18B20 live reads,
> SSR, SD mid-flight) — siehe [`SESSION.md`](SESSION.md).

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

## Voraussetzungen

**Hardware:**
- ESP32 Dev-Board
- SD-Karten-Slot (SPI) — Default CS auf GPIO 5
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
| GPIO 5  | SD-Karte CS  ⚠           | `kSdCsPin`          |
| GPIO 16 | SSR (TPO-Modus)         | `kSsrPin`           |

⚠ **GPIO 5 ist Strapping-Pin (MTDI):** Wenn das SD-Modul CS/MISO beim
Boot low zieht, bootet der ESP32 in den falschen Modus. Lösung:
10 kΩ-Pull-up auf CS, oder `kSdCsPin = 15` (bzw. 13) in `main.cpp`
ändern.

**LOLIN S2 Mini (`lolin_s2_mini`)**

Kein onboard-SD-Slot — externer SPI-Breakout. Gleiche Pin-Defaults wie
`esp32dev` sofern nicht über Build-Flags überschrieben. Flash über DFU:
ersten Flash BOOT + RST halten, danach enumeriert die Firmware als neuer
COM-Port (TinyUSB-CDC).

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

## Web-UI bauen + auf SD deployen

```powershell
cd web
pnpm install                      # einmalig
pnpm build                        # → web/dist/  (Vite produziert ~11 KB gzip total)

# Pre-gzip (optional) — AsyncWebServer serviert .gz transparent bei
# Accept-Encoding: gzip; spart spürbar SPI-SD-Reads
Get-ChildItem .\dist -Recurse -Include *.js,*.css,*.html |
  ForEach-Object { & gzip -k9 -- $_.FullName }

# SD-Karten-Root (Laufwerksbuchstabe anpassen):
Copy-Item -Recurse -Force .\dist\* D:\
```

SD-Karte rausziehen, in den ESP32-Slot stecken — der Static-Serve-Handler
liefert ab sofort `index.html` + Assets unter `/`.

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

**Monitoring & Steuerung:**

| Endpoint                                | Methode | Body              | Wirkung                              |
|-----------------------------------------|---------|-------------------|--------------------------------------|
| `/api/snapshot`                         | GET     | —                 | Aktueller Registry-State (JSON)      |
| `/api/events`                           | GET     | (SSE)             | `snapshot`-Event nach Connect, alle 1 s, und nach jedem Write |
| `/api/actuators/<id>`                   | POST    | `{"v": <float>}`  | `Actuator::write(v)`                 |
| `/api/controllers/<id>/setpoint`        | POST    | `{"v": <float>}`  | `Controller::setSetpoint(v)`         |
| `/api/controllers/<id>/params`          | POST    | (Controller-JSON) | `Controller::setParamsJson(body)`    |
| `/api/admin/wifi-reset`                 | POST    | —                 | Löscht NVS-Credentials, rebootet in Setup-Portal |

**Laufzeit-Item-Verwaltung:**

| Endpoint                  | Methode | Body (Beispiel)                                              | Wirkung                     |
|---------------------------|---------|--------------------------------------------------------------|-----------------------------|
| `/api/sensors`            | POST    | `{"type":"DS18B20","id":"x","pin":4}`                       | Sensor anlegen + persistieren |
| `/api/sensors`            | POST    | `{"type":"DS18B20","id":"x","pin":4,"address":"28ff…"}`     | DS18B20 mit ROM-Adresse (Multi-Sensor-Bus) |
| `/api/sensors/<id>`       | DELETE  | —                                                            | Sensor entfernen (404 wenn statisch) |
| `/api/actuators`          | POST    | `{"type":"DigitalOutput","id":"x","pin":16,"mode":"Binary"}` | Aktor anlegen               |
| `/api/actuators/<id>`     | DELETE  | —                                                            | Aktor entfernen             |
| `/api/controllers`        | POST    | `{"type":"PID","id":"x","sensor":"s","actuator":"a",…}`     | Regler anlegen              |
| `/api/controllers/<id>`   | DELETE  | —                                                            | Regler entfernen            |

**Bus-Discovery:**

| Endpoint                               | Methode | Parameter          | Antwort                                          |
|----------------------------------------|---------|--------------------|--------------------------------------------------|
| `/api/bus/scan?type=onewire&pin=<N>`   | GET     | `type`, `pin`      | `{"type":"onewire","pin":4,"devices":[{"index":0,"address":"28ff64c8815604ef"},…]}` |

Mehrere DS18B20 auf einem Pin: erst scannen, dann jeden Sensor mit der
gefundenen `address` anlegen — der ESP32 verwaltet die Shared-Bus-Instanz intern.

Snapshot-Shape ist 1:1 zu `SensActCtrl/src/core/RegistrySnapshot.cpp` —
siehe [`web/src/types.ts`](web/src/types.ts) für die TypeScript-Form.

Dynamisch angelegte Items werden in `/config/registry.json` auf der SD-Karte
persistiert und nach Reboot automatisch wiederhergestellt.

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
Browser-EventSource reconnected nativ; UI sollte in ≤60 s resumen.
Falls nicht: `server.begin()` muss in einen `WiFi.onEvent(STA_GOT_IP)`-
Hook (nicht im MVP — siehe `PLAN.md` Verifikation Schritt 10).

## Firmware-Update

Drei Wege:
- **Server-Pull (GitHub):** `/settings/firmware` → Kanal (stable/preview) wählen →
  „Auf Updates prüfen" → „Installieren". Zieht `firmware-<variant>.bin` + `webui.tar`
  aus dem passenden Release. Repo `nhhop/Brauerei` muss **public** sein.
- **Browser-Upload:** dieselbe Seite — `.bin` (Firmware) bzw. `.tar` (UI-Paket).
- **USB (Brick-Rettung):** Bootet das Gerät nach einem fehlerhaften Flash nicht mehr,
  ist die WebUI weg → per Kabel `pio run -e <env> -t upload` neu flashen.

### UI liegt jetzt unter /www
Die SPA wird aus `/www` auf der SD-Karte serviert (vorher SD-Root). Beim Deploy:
`Copy-Item -Recurse -Force .\dist\* D:\www\`. Bestehende Karten: Assets nach `/www`
verschieben, oder einmal ein `webui.tar` über die UI einspielen (legt `/www` an).

### Release erstellen
`git tag vX.Y.Z && git push origin vX.Y.Z` → die GitHub-Action baut alle Board-
Varianten und hängt `firmware-<env>.bin` + `webui.tar` ans Release. Stable = normales
Release, Preview = als „Pre-release" markieren.

### Partition-Layout (min_spiffs)
OTA braucht zwei App-Slots. Der TLS-Pull-Pfad füllt den Default-OTA-App-Slot der
4-MB-Boards (esp32dev, lolin_s2_mini) auf >90 %; deshalb verwenden diese Envs
`board_build.partitions = min_spiffs.csv` (~1,9 MB App-Slots; SPIFFS ungenutzt, da
Assets auf SD liegen). **Wichtig:** Der Wechsel auf dieses Layout muss **einmalig per
USB** geflasht werden — OTA kann die Partitionstabelle nicht ändern. Danach laufen
OTA-Updates normal. Der LilyGo-S3 (16 MB) behält die Default-Tabelle (genug Platz).

## Weiteres

- [`PLAN.md`](PLAN.md) — Architektur-Vertrag, Build-Reihenfolge,
  Verifikations-Protokoll, Future Work
- [`SESSION.md`](SESSION.md) — Session-Log mit Status pro Build-Schritt
  und Pass-Reviews
- [`SensActCtrl/`](../SensActCtrl/) — die zugrundeliegende Library
