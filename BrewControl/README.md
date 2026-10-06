# BrewControl

Web-UI für ESP32-basierte Brausteuerungen, die auf der
[`SensActCtrl`](../SensActCtrl/)-Library aufsetzen. Live-Monitoring aller
registrierten Sensoren im Browser, Aktoren-Schalten und PID-/Setpoint-
Tuning zur Laufzeit über eine HTTP+SSE-API.

> **Status:** MVP + Laufzeit-Item-Add/Remove + Bus-Discovery + Datenlogging +
> Sollwert-Programme + MQTT/Webhook/ESP-NOW (lokal + Remote-Node) +
> WinUI-3-Fluent-Redesign + rundes Touch-Display (AMOLED-1.75), alle drei Boards (esp32dev, LOLIN S2 Mini,
> LilyGo T-Display-S3-AMOLED-1.75) hardware-verifiziert. Aktueller
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
│ └─ Static asset requests      │ ─HTTP──►│ └─ onNotFound → /www (SD)     │
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
  Dieser Task (Priorität 10) ist per `CONFIG_ASYNC_TCP_RUNNING_CORE=0`
  auf Core 0 gebunden, damit Core 1 dem loopTask (Priorität 1) bleibt —
  ungebunden hungerte er ihn beim Streamen von Dateien aus
  (`loop()`-p99 bis 190 ms, siehe `SESSION.md` 2026-09-26). Der S2 hat
  nur einen Core; dort läuft AsyncTCP stattdessen mit Priorität 1, gleich
  dem loopTask (`CONFIG_ASYNC_TCP_PRIORITY` in `[env:lolin_s2_mini]`).
- **Watchdog auf dem loopTask** (30 s): Die Web-API läuft auf dem
  AsyncTCP-Task und antwortet auch dann weiter, wenn `loop()` hängt — ohne
  Watchdog wirkte das Gerät gesund, während Regler und Programme standen.
  Jetzt startet es neu, Programme/Timer setzen aus ihrem gespeicherten
  Zustand fort, und `GET /api/update/status` meldet den Grund
  (`resetReason`, Anzeige auf der Firmware-Seite). Wer im loopTask bewusst
  länger als ein paar Sekunden arbeitet, ruft zwischendurch
  `feedLoopWDT()` (wie `FirmwareUpdater::streamDownload()`).
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
  Das gilt auch für Datei-Downloads und die statische UI-Auslieferung:
  `WebUI::sendFile_()` liest jedes Stück unter `SdLock`, statt
  `AsyncFileResponse`/`serveStatic()` ungesperrt im AsyncTCP-Task lesen zu lassen.

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

Board-Pins (SD, I²C) werden per `-DBREWCTL_*`-Build-Flags in `platformio.ini`
pro Board gesetzt; `main.cpp` hat `#ifndef`-Defaults für `esp32dev`. Die Pins
der Sensoren und Aktoren legt nicht die Firmware fest, sondern die Nutzer-Config
(siehe „Pin-Prüfung“ unten).

**`esp32dev` (Defaults)**

| Pin     | Funktion                | Konstante           |
|---------|-------------------------|---------------------|
| GPIO 0  | BOOT/Reset-Trigger      | `kBootButtonPin`    |

Kein SD-Pin mehr im Standard-Build (`BREWCTL_USE_LITTLEFS=1`, s.u.) — `kSdCsPin`
(GPIO 5, ⚠ Strapping-Pin/MTDI) existiert im Code weiter, wird aber nur noch im
SD-Zweig verwendet, falls jemand `platformio.ini` lokal auf SD zurückstellt.

**LOLIN S2 Mini (`lolin_s2_mini`)**

Kein onboard-SD-Slot — läuft standardmäßig auf LittleFS (internes Flash), kein externer
SPI-Breakout nötig. Flash über DFU: ersten Flash BOOT + RST halten, danach enumeriert
die Firmware als neuer COM-Port (TinyUSB-CDC).

**LilyGo T-Display-S3-AMOLED-1.75 (`lilygo_t_display_s3_amoled`)**

| Pin     | Funktion                | Build-Flag                  |
|---------|-------------------------|-----------------------------|
| GPIO 38 | SD-Karte CS             | `BREWCTL_SD_CS=38`          |
| GPIO 41 | SD-Karte SCK            | `BREWCTL_SD_SCK=41`         |
| GPIO 39 | SD-Karte MOSI           | `BREWCTL_SD_MOSI=39`        |
| GPIO 40 | SD-Karte MISO           | `BREWCTL_SD_MISO=40`        |
| GPIO 7  | I²C SDA (Touch/RTC/PMU) | `BREWCTL_I2C_SDA=7`         |
| GPIO 6  | I²C SCL                 | `BREWCTL_I2C_SCL=6`         |

Dazu das Display auf GPIO 10–17 (`src/display/DisplayUI.cpp`) und die
Touch-/RTC-Interrupt-Leitung auf GPIO 9 (von der Firmware nicht genutzt, aber
elektrisch belegt).

⚠ **OPI-PSRAM-Konflikt:** GPIO 33–37 sind auf ESP32-S3-Varianten mit
Octal-PSRAM intern vom PSRAM-Controller belegt. SPI-Pins müssen diesen
Bereich meiden — sonst hängt `SD.begin()` und der Task-Watchdog feuert.
**Pin-Quellen variieren zwischen AMOLED-Sub-Varianten** (1.43, 1.64,
1.75, 1.91, Plus, Touch) — vor einer neuen Variante Silkscreen am Board
ablesen, nicht Web-Snippets vertrauen.

### Pin-Prüfung

`src/BoardPins.h` beschreibt je Board jeden GPIO: **frei**, **bedenklich**
(funktioniert, hat aber eine Zweitaufgabe — Strapping-Pin, USB, UART0,
Batterie-ADC), **reserviert** (vom Board selbst belegt — SD, Display, I²C,
BOOT-Taste) oder **verboten** (Flash/PSRAM); dazu Input-only-Pins, DAC- und
ADC-Pins, Pins ohne internen Pull-up und die Zahl sendefähiger RMT-Kanäle. `src/PinMap.h` prüft damit jedes Anlegen
(`POST`) und Ersetzen (`PUT`) von Sensoren und Aktoren:

- Ein Pin hat keine vorab festgelegte Rolle — das erste Item oder der erste Bus
  auf einem freien Pin bestimmt sie, und jeder Pin hat genau einen Nutzer.
  Leitungen, die sich mehrere Geräte teilen, gehören einem Bus (siehe „Geteilte
  Busse“); die Items darauf verweisen nur auf den Bus. Alles andere → **409** mit
  dem Namen des Belegers.
- Verbotene oder nicht vorhandene Pins, Ausgänge auf Input-only-Pins und
  `mode: dac` ohne DAC → **400**; reservierte Pins → **409**.
- Jede IDS-Platte braucht einen RMT-Sendekanal (ESP32: 8, S2/S3: 4); sind alle
  vergeben → **409** statt des stillen, blockierenden Software-Fallbacks.
- Fähigkeiten je Pin (ADC1/ADC2, fehlender interner Pull-up, Interrupt-Errata)
  werden gegen den Bedarf des Feldes geprüft: `AnalogInput` und `Voltage` brauchen einen
  ADC-Pin, sonst **400**. ADC2 ist mit aktivem WLAN am ESP32 nicht lesbar
  (**400**), am S2/S3 teilt er sich den ADC mit dem WLAN und einzelne Messungen
  können ausfallen (Warnung). YF-S201, IDS-Interrupt und `DigitalInput` mit
  `pullup` warnen auf Pins ohne internen Pull-up (ESP32 34–39, S2 46). Interrupts
  (YF-S201, HC-SR04-Echo, IDS) warnen am ESP32 auf GPIO 36/39 (Errata 3.11,
  Fehlauslöser). Serielle Schnittstellen nutzt noch kein Item-Typ.
- Bedenkliche Pins und Fähigkeits-Warnungen lässt die Firmware zu; die Web-UI
  fragt vor dem Speichern nach.
- Das Item-Formular und die Bus-Seite schlagen je Pin-Feld passende GPIOs vor
  (`web/src/pins.ts::suggestPins`, ausschließlich aus `GET /api/pins` abgeleitet): freie
  Pins zuerst, bedenkliche danach und als solche markiert; Pins, die ein anderes Feld
  desselben Items schon gewählt hat, werden nicht doppelt vorgeschlagen. Reiner Vorschlag
  per Klick — die freie Eingabe bleibt.
- Konflikte in einer bereits gespeicherten Config werden trotzdem geladen (ein
  stillschweigend fehlender Heizungs-Aktor wäre schlimmer), seriell geloggt
  (`[pins] GPIO …`), in `GET /api/pins` gemeldet und auf der Geräte-Seite als
  Banner angezeigt.

Bearbeiten in der UI nutzt `PUT` (Ersetzen in einem Schritt): Scheitert die neue
Config, bleibt das alte Item unverändert bestehen. Ein Sensor oder Aktor, der an
einem Regler hängt, lässt sich weiterhin nicht ersetzen (409) — nur der
Anzeigename.

### Geteilte Busse

Busse sind eigene, zentral definierte Objekte (`src/BusConfig.h`), gepflegt unter
**Einstellungen → Bus-Schnittstellen** bzw. `/api/buses` und gespeichert als Array
`buses` in `/config/registry.json` (damit auch in `GET /api/config` und im Backup).
Die Id ergibt sich aus Typ und Pins:

- **`onewire-<pin>`**: ein `OneWire`-Treiber, den alle DS18B20 mit `"bus"` darauf nutzen,
  mit oder ohne `address`.
- **`spi-<clk>-<miso>-<mosi>`**: MAX31865 mit `"bus"`. Vorerst nur Buchführung, denn jeder
  MAX31865 treibt die Leitungen weiter selbst per Software-SPI; sein `cs` bleibt ein
  eigener Pin des Items. MAX31865 ohne `bus` (Hardware-SPI mit den Board-Default-Pins)
  hängt an keinem Bus.
- **`i2c-<sda>-<scl>`**: BME280 und die IMUs (GY521, QMI8658, BMI270, BMI160). Der ESP32 hat zwei I2C-Controller, also
  höchstens zwei I2C-Busse; jeder bekommt beim Anlegen einen fest (`port`: 0 = `Wire`,
  1 = `Wire1`), damit er nie wechselt, solange Items darauf laufen.
- **Feste Busse** des Boards (`BoardPins.h`, nie gespeichert, nicht änderbar): am LilyGo
  `i2c-board` (SDA 7 / SCL 6, `Wire`) mit RTC 0x51, Touch 0x5A und PMU 0x6A; SDA/SCL liegen
  am Header und am Qwiic-Stecker, eigene Sensoren können also mit auf diesen Bus.
  `main.cpp` claimt ihn beim Boot über `DynamicItems::acquireBoardI2cBus()` und hält ihn für
  immer. Seine Pins schützt die `Reserved`-Klasse der Pin-Tabelle; ein zweiter, frei
  wählbarer I2C-Bus (`Wire1`) steht daneben zur Verfügung, etwa wenn ein Sensor eine Adresse
  braucht, die am Board-Bus schon belegt ist. esp32dev/lolin_s2_mini haben keine festen Busse.

Bus-Pins gehören exklusiv dem Bus: `GET /api/pins` führt den Bus als Nutzer (`bus: true`),
ein Item oder zweiter Bus auf derselben Leitung ist ein **409**. Die Pins eines Busses
lassen sich nur ändern und der Bus nur löschen, solange kein Item daran hängt (**409**,
die Meldung nennt die Items); das Label geht immer. Die I2C-**Adresse** prüft
`I2cAddressMap.h` je Bus: zwei Items auf demselben Bus dürfen nie dieselbe Adresse haben,
auf zwei Bussen schon; reservierte Adressen gelten nur für den festen Bus — beides nur beim
Anlegen/Ersetzen (409), nicht in `GET /api/pins`.

Den laufenden Treiber verwaltet `src/PeripheralRegistry.h` unter der Bus-Id: angelegt
(`begin()`) mit dem ersten Item und nach dem letzten wieder abgebaut (`end()`, bei I2C
`Wire.end()` — außer am festen Bus, an dem auch Touch hängt). Die Nutzer zählt eine
`PeripheralRegistry::Ref` im Sensor-Eintrag von `DynamicItems`. `PUT` hält den Bus des
alten Sensors fest, bis das Ersetzen fertig ist. `GET /api/bus/scan?bus=<id>` nutzt den
laufenden Treiber mit oder startet ihn nur für den Scan (I2C mit 50 ms Timeout je
Adresse; SPI lässt sich nicht scannen). Die Registry hat keine eigene Sperre und wird
nur unter dem `RegistryLock` angefasst — Bus-Änderungen und Scan können deshalb mit
**503** abbrechen.

**Migration:** Configs von vor den Bus-Definitionen (DS18B20 `pin`, MAX31865
`clk`/`miso`/`mosi`, BME280/GY521 ohne `bus`) stellt `normalizeLegacyItem` beim Laden um —
auch nach dem Einspielen eines alten Backups — und schreibt `registry.json` einmal neu.
BME280/GY521 landen am LilyGo auf `i2c-board`, sonst auf `i2c-21-22` (esp32dev) bzw.
`i2c-33-35` (lolin_s2_mini), den bisherigen Arduino-Default-Pins. Eine ältere Firmware
versteht die umgestellten Items nicht mehr — vor einem Downgrade das Backup von vorher
einspielen.

## Web-UI bauen + auf SD deployen (`lilygo_t_display_s3_amoled`)

```powershell
cd web
pnpm install                      # einmalig
pnpm build:sd                     # → web/dist/, nur .gz (scripts/gzip-dist.js)
# AsyncWebServer serviert .gz transparent, auch für index.html beim SPA-Fallback;
# spart spürbar SPI-SD-Reads

# SD-Karten-Root (Laufwerksbuchstabe anpassen):
Copy-Item -Recurse -Force .\dist\* D:\
```

SD-Karte rausziehen, in den ESP32-Slot stecken — der Static-Serve-Handler
liefert ab sofort `index.html` + Assets unter `/`.

`dist/modules/` enthält die **optionalen UI-Pakete** (derzeit `recipes`: Rezeptverwaltung
mit Zutaten- und Stilkatalog sowie die Rechner unter `/rechner`). Sie gehören mit auf die
SD-Karte; fehlt der Ordner, blendet die UI die Funktion aus (Menüpunkte „Rezepte“ und
„Rechner“ weg, `/rezepte` und `/rechner` zeigen einen Hinweis). Ein Paket ist
vorhanden, wenn `/modules/<name>/manifest.json` ausgeliefert wird (`web/src/optionalModules.ts`).
Die Rezepte selbst liegen einzeln auf der SD-Karte unter `/recipes/<id>.json` (`/api/recipes`,
nur SD-Boards, bis 16 KB je Rezept), dazu eine Indexdatei `/recipes/index.jsonl` mit den
Listenfeldern, die die Firmware bei jedem Speichern und Löschen mitführt. Von Hand auf die Karte
kopierte Rezeptdateien erscheinen erst in der Liste, wenn sie über die UI gespeichert werden.
Rezepte, die früher im `localStorage` des Browsers angelegt
wurden, lädt die Rezeptseite beim ersten Öffnen einmalig aufs Gerät hoch. Das Backup
(`/api/backup`) enthält sie nicht — der Restore nimmt höchstens 16 KB Body an. Stattdessen hat
„Backup & Restore“ (nur mit installiertem Rezept-Paket) einen eigenen Rezept-Export/-Import: Der
Browser lädt alle Rezepte über `/api/recipes` zu einer Datei `brewcontrol-recipes-<datum>.json`
(`{type:"brewcontrol-recipes", version:1, recipes:[…]}`) zusammen und spielt sie beim Import einzeln
per `PUT` zurück (gleiche ID wird überschrieben, kein Neustart).

## Web-UI bauen + auf LittleFS deployen (`esp32dev`, `lolin_s2_mini`)

Diese beiden Boards haben keinen SD-Slot — die UI landet stattdessen per USB auf einer
internen LittleFS-Partition (`pio run -t uploadfs`, s. „Partition-Layout" unten). Nur die
**gzippten** Assets werden geshippt (die Firmware serviert `.gz` transparent, auch
ohne die unkomprimierten Originale). `pnpm build:sd` ersetzt jede Datei durch ihre `.gz`
(~150 KB), roh + gzip passte nicht in die 256-KB-Partition:

```powershell
cd web
pnpm install                      # einmalig
pnpm build:lfs                    # build:sd + dist/ (ohne modules/) nach ../firmware/data/www

cd ..\firmware
pio run -e esp32dev -t buildfs        # optional: Größen-Check ohne Hardware
pio run -e esp32dev -t uploadfs       # LittleFS-Image per USB flashen
pio run -e lolin_s2_mini -t uploadfs  # gleiches data/, zweites Board
```

`pnpm build:lfs` lässt `dist/modules/` bewusst weg: Die optionalen UI-Pakete (Rezepte) sind
für diese Boards nicht vorgesehen, und ein späteres „Installieren“ mit dem schlanken
`webui.tar` würde sie ohnehin wieder löschen. Ein Ordner `data/www/modules` von Hand
bringt das Paket trotzdem aufs Board, das ist dann deine Entscheidung.

`data/` ist projektweit geteilt zwischen allen Envs — **nicht** gegen
`lilygo_t_display_s3_amoled` ausführen (kein `littlefs`-Filesystem dort).

### Ohne USB: UI über das Netzwerk aufspielen

`uploadfs` braucht die serielle Verbindung — beim esp32dev-Testboard heißt das,
den BOOT-Button von Hand zu halten (kein zuverlässiger Auto-Reset). Ohne USB geht
es über `POST /api/update/assets` mit dem normalen `webui.tar` (siehe
„webui.tar und webui-full.tar manuell bauen“ unten, ~150 KB, nur `.gz`) oder über „Installieren“
aus einem Release, das dasselbe Tar mitbringt:

```bash
curl -F "f=@webui.tar" http://<ip>/api/update/assets
```

Beide Boards entpacken das Tar **in-place**, gesteuert über das Build-Flag
`BREWCTL_ASSETS_IN_PLACE` in `platformio.ini` — beim Upload wie beim
„Installieren“ (gemeinsame Logik in `src/AssetInstall.h`). Die 256-KB-Partition fasst altes
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

## Rundes Touch-Display (nur `lilygo_t_display_s3_amoled`)

Das 466×466-AMOLED des LilyGo T-Display-S3-AMOLED-1.75 zeigt die Items eines
Dashboards als Seiten: zuerst Regler, dann Sensoren, dann Aktoren, maximal 16.
Links/rechts wischen blättert die Seiten, hoch/runter wechselt das Dashboard.
Das Grid-Layout der Web-UI wird nicht nachgebildet. Ids, zu denen es kein Item
mehr gibt, werden übersprungen. Ändern sich Dashboards, Items oder die
Akzentfarben, baut das Display ohne Neustart neu auf.

| Seite | Anzeige | Bedienung |
|---|---|---|
| Regler | Ring = Istwert (Akzentfarbe), weißer Griff = Sollwert, „Ausgang n %“ (Sekundärfarbe) | Griff ziehen; Tippzonen direkt vor/hinter dem Griff = −/+ ein Schritt; Power-Knopf |
| Stetiger Aktor | Ring = Zustand, Griff = Vorgabe, ggf. Intervall | Griff, Tippzonen, Power-Knopf |
| Binärer Aktor | großer Knopf AN/AUS | Knopf = Master-Schalter, wie in der Web-UI |
| Sensor | Wert + Einheit, bei Mehrkanal-Sensoren alle Kanäle | — |
| Libelle (GY-521 mit `pitch` und `roll`) | Glas mit Fadenkreuz, Blase wandert zur höheren Seite (die ersten 15° füllen die inneren 60 % des Radius, bis 45° am Rand gestaucht, grün innerhalb ±1°), darunter Nick und Roll. Ab 45° einer Achse (Gerät steht auf der Kante) eine gerade Libelle der *anderen* Achse, die es noch auszurichten gilt: bei dominantem Nick Roll waagerecht, bei dominantem Roll Nick senkrecht (oben = positiv); gleiche Skala wie das Glas (fein bis 15°, Ende bei 45°), grün innerhalb ±1°, „senkrecht“ wenn die dominante Achse bei 90° liegt. Weitere Kanäle (`tilt`, `dir`, …) auf einer zweiten Seite direkt danach | — |

**Gesperrt** (die Fußzeile nennt den Grund) ist eine Seite in diesen Fällen:
- Der **Not-Aus** ist eingerastet. Dann wird zusätzlich der Hintergrund rot.
  Das ist strenger als die Web-UI: Am Gerät soll man den Not-Aus nicht aus
  Versehen aufheben können.
- Ein Aktor wird von einem aktiven Regler oder einem laufenden Programm
  gesteuert. Die Web-UI fragt in diesem Fall nach, das Display sperrt.

**Burn-in-Schutz:** Ohne Berührung dimmt das Display und wird später schwarz
(Helligkeit 0, beim AMOLED sind die Pixel dann aus). Eingestellt wird das unter
Einstellungen › Gerätedisplay (`display.*` in `/api/settings`, wirkt ohne
Neustart):

| Einstellung | Default | Bedeutung |
|---|---|---|
| Helligkeit | 63 % | normale Helligkeit, Anteil des Panel-Maximums (63 % = der frühere feste Wert 160/255) |
| Dimmen nach | 2 min | Zeit ohne Berührung; „Nie“ = 0 |
| Helligkeit gedimmt | 20 % | Anteil der eingestellten Helligkeit |
| Ausschalten nach | 10 min | Zeit ohne Berührung; „Nie“ = 0 |
| Pixel-Shift | aus | verschiebt das Bild jede Minute um 3 px, im Kreis über 8 Positionen |

- **Aufwecken:** Ein Tipp weckt das Display. Dieser erste Druck erreicht LVGL
  nie, er löst also weder Power-Knopf noch Tippzone, Griff oder Wischen aus.
  Erst der nächste Druck zählt. Das gilt aus dem gedimmten wie aus dem
  schwarzen Zustand.
- **Not-Aus** hält das Display voll hell, solange er eingerastet ist. Nach dem
  Aufheben läuft die Wartezeit von vorn.
- **Jede neue Meldung** der Alarm-Zentrale weckt das Display, auch
  „aufgehoben“-Meldungen.
- **Schwarz heißt: kein Rendern.** `lv_timer_handler()` läuft dann gar nicht,
  nur der Touch wird alle 30 ms abgefragt. Beim Aufwachen holt ein
  `lv_timer_handler()` die Werte nach, bevor die Helligkeit hochgeht, damit
  kein veraltetes Bild aus dem Panel-RAM aufblitzt.

**Architektur:** `src/display/DisplayUI` übernimmt Panel, Touch und LVGL-Treiber.
`src/display/DisplayPages` liefert die Inhalte. `lv_timer_handler()` läuft aus
`loop()`, also im selben Task wie `registry.tick()`; es gibt keine Sperren und
keine Command-Queue. Items werden bei jedem Refresh per Id gesucht, weil der
AsyncTCP-Task sie jederzeit löschen darf. Gemessen (2026-09-24, siehe
`SESSION.md`): Im Ruhebetrieb liegt `loop()` bei p99 22 ms. Beim Dauerwischen
steigt p99 auf 72 ms und das Maximum auf 137 ms, verursacht vom
Software-Rendering, nicht vom Blit.

**Bausteine:** LVGL 8.4 (`src/display/lv_conf.h`, nur für dieses Env sichtbar);
Panel-Treiber `vendor/Arduino_GFX-1.3.7` (gekürzte Kopie von LilyGos Fork, siehe
dortiges README); Touch per SensorLib (`TouchDrvCST92xx`); eigene Latin-1-Fonts
in `src/display/fonts/`, weil LVGLs Montserrat keine Umlaute kennt. Alles steht
hinter `BREWCTL_HAS_DISPLAY`, die anderen Envs bauen unverändert.

**Fallstricke:**
- Der QSPI-Takt steht auf 40 MHz. Der Library-Default von 8 MHz kostet
  ~110 ms pro Vollbild.
- Der CO5300 nimmt nur Fenster ab 2×2 Pixel an. Deshalb gibt es einen
  `rounder_cb`.
- Die Touch-Ebene ist um 180° gegen das Panel gedreht.
- `TouchDrvCST92xx::getTouchPoints()` quittiert jeden gelesenen Frame. Ein
  zweites Lesen vor dem nächsten Frame liefert „kein Finger“. Deshalb gilt ein
  Finger beim Aufwecken erst nach 150 ms ohne Berührung als losgelassen
  (`kLiftMs`), nicht schon nach einem leeren Lesevorgang.
- `Wire` muss vor allem anderen auf SDA 7 / SCL 6 laufen
  (`BREWCTL_I2C_SDA/SCL`), weil der Variant-Default SCL 17 der Panel-Reset
  ist.

## Zustand nach Neustart

Regler und Aktoren kommen nach jedem Neustart in ihren letzten Zustand
zurück (`src/RuntimeState.h`, Datei `/config/state.json`):

- Regler: an/aus und Sollwert.
- Aktoren: an/aus, Wert und Intervall. Nicht gespeichert wird der Wert eines
  Aktors, den ein Regler ansteuert (der Regler setzt ihn selbst), und der
  Wert eines Impuls-Aktors (ein Ereignis, kein Zustand).
- `loop()` vergleicht den Zustand jede Sekunde mit dem gespeicherten und
  schreibt ihn, sobald er sich 2 s lang nicht mehr geändert hat. Das deckt
  alle Wege ab: REST, Display, Timer, Programme, Not-Aus.
- Ein eingerasteter **Not-Aus gewinnt**: `WebUI::begin()` wendet ihn nach der
  Wiederherstellung an. Laufende Programme spielen ihren Zustand ohnehin neu
  ab.
- ⚠ Ein Relais, das vor einem Stromausfall an war, schaltet danach wieder
  ein. Die Library selbst startet jeden Ausgang aus; das Wiederherstellen
  ist eine bewusste Entscheidung von BrewControl.
- **Geänderte Regler-Parameter** bleiben ebenfalls: Weichen die Parameter
  eines Reglers (Kp/Ki/Kd, `deadband`, `hystLow`/`hystHigh`, `inverted`,
  `heatDiff`/`coolDiff`, `coolMinOnMs`/`coolMinOffMs`, `changeoverMs`,
  `maxRatePerSec`, `autotuneMethod`) von seiner gespeicherten Konfiguration ab
  (fertiges AutoTune, `POST …/params` oder eine `/tune`-Nachricht), schreibt
  `loop()` sie in die Konfiguration zurück (`DynamicItems::syncTunedParams`,
  höchstens eine Sekunde später). Damit überstehen sie den Neustart, landen im
  Backup, und der Bearbeiten-Dialog zeigt sie an.

## Energiemanagement

Einstellungen → Energiemanagement (`/settings/energy`, Abschnitt `energy` in
`/config/settings.json`): Batteriespannung und Deep-Sleep (Plan:
`docs/superpowers/plans/2026-09-29-energiemanagement.md`).

### Batterie

- Die Batterie ist ein **normales Sensor-Item**, meist vom Typ `Voltage`
  („Spannung“). Die Seite wählt es nur aus (`energy.batterySensor`); zur Wahl
  stehen alle Sensoren mit Einheit `V` bzw. Größe `Voltage`. Publish, Datalog,
  Dashboard und Kalibrierung laufen dadurch wie bei jedem Sensor.
- Der Typ `Voltage` (`SensActCtrl::VoltageSensor`) misst hinter einem
  Spannungsteiler `Messpunkt – R1 – ADC-Pin – R2 – GND`: Konfiguration `pin`,
  `r1`/`r2` in kΩ (nur das Verhältnis zählt, `r1 = 0` = ohne Teiler), Glättung
  (Default 16). Er liest mit `analogReadMilliVolts()`, also mit der ab Werk im
  eFuse hinterlegten ADC-Kalibrierung, und rechnet `mV × (R1+R2)/R2`. Am Pin
  sind bei der Standard-Dämpfung höchstens ca. 3,1 V messbar. Feinabgleich
  gegen ein Multimeter über die normale Kalibrierung.
- „Batteriesensor anlegen“ legt so ein Item an (Glättung 16, Beschriftung
  „Batterie“). Boards mit eigenem Batterie-Messeingang liefern Pin und
  Widerstände in `GET /api/pins` → `battery` (Tabelle in `BoardPins.h`, bisher
  nur LilyGo: GPIO 4, 100/100 kΩ für das Verhältnis 1:2).
- Die Prozentangabe ist eine grobe LiPo-Kennlinie in der UI (`web/src/energy.ts`),
  gilt nur für eine Zelle ohne Last und nicht beim Laden.

### Deep-Sleep

Mit `energy.deepSleep` schläft das Gerät zwischen zwei Messungen
(`src/EnergyManager.h`, Entscheidungen in `src/WakeMode.h`). Jedes Aufwachen
ist ein Neustart; Regler und Aktoren kommen über den gespeicherten Zustand
zurück (siehe „Zustand nach Neustart“).

- **Kurz-Wach** (Timer-Wakeup, Wach-Pin nicht aktiv): `setup()` läuft wie
  sonst, aber mit einem WLAN-Versuch (8 s, kein Portal) — oder ganz ohne WLAN,
  wenn `shortWakeWifi` aus ist; dann sendet nur ESP-NOW, auf dem Kanal der
  letzten WLAN-Verbindung (`RTC_DATA_ATTR`). Kein Webserver, kein mDNS, kein
  Display, keine Update-Suche, keine Alarme/Push. `loop()` tickt Registry,
  Publisher, Logs, Programme und Timer; Logs und Programme erst, wenn jeder
  Sensor einmal gemessen hat (max. 3 s), sonst wäre die einzige Log-Zeile
  leer. Danach wartet es, bis MQTT/Webhook/WebSocket verbunden sind (max. 5 s),
  läuft 1,5 s nach (die Publisher senden im 1-s-Takt) und schläft wieder;
  spätestens 30 s nach dem Start von `loop()`. Ein Druck auf den Wach-Pin
  während eines Kurz-Wach startet voll wach neu.
- **Voll-Wach** (Einschalten, Reset, Wach-Pin): normaler Betrieb. Das Gerät
  schläft wieder ein, wenn `awakeTimeoutSec` lang kein HTTP-Zugriff, kein
  Display-Touch und kein aktiver Wach-Pin kam. Eine offene Seite (Event-
  Stream) zählt als Zugriff, ein Browser-Firmware-Upload verhindert den Schlaf.
- **Schlafdauer:** das Intervall ab Beginn des Kurz-Wach (nach Voll-Wach das
  volle Intervall), gekürzt auf 1 s nach dem nächsten festen Ereignis eines
  laufenden Programms (Ende eines Halte-Schritts) oder Timers (Ablauf).
  Sensor-Schritte und wartende Programme haben kein festes Ende.
- **Regler** blockieren den Schlaf nicht; sie regeln nur, solange das Gerät
  wach ist.
- **Aktoren sind im Schlaf aus:** vor dem Einschlafen wird ein noch nicht
  gespeicherter Zustand sofort geschrieben, dann gehen alle Aktoren aus (nicht
  gespeichert), Protokoll-Aktoren (IDS, Remote) bekommen 300 ms, um ihr Aus zu
  senden, und die Ausgangs-Pins werden im inaktiven Pegel festgeklemmt
  (`gpio_hold_en`, kostet wenige µA). Ohne das hingen sie im Schlaf in der
  Luft. Beim Aufwachen bleiben sie geklemmt, bis die Aktoren sie in
  `registry.begin()` übernehmen — kein Zucken beim Aufwachen.
- **Wach-Pin** (`wakePin`, Pflicht bei Deep-Sleep): ein RTC-GPIO (`rtc` in
  `GET /api/pins`; esp32dev 2, 4, 12–15, 25–27, 32–39, S2/S3 1–21), gegen GND
  mit internem Pull-up oder gegen 3,3 V mit Pull-down. GPIO 0 ist gesperrt
  (Jumper beim Einschalten = Download-Modus, 5 s Halten = Werksreset), andere
  Strapping-Pins werden als bedenklich angezeigt, GPIO 34–39 haben keinen
  internen Pull-up. Er ist für Items belegt wie ein Item-Pin. Ein Jumper hält
  das Gerät dauerhaft wach. Der Werksreset über GPIO 0 greift nach einem
  Aufwachen nicht, nur nach Einschalten/Reset.
- Die Uhr läuft im Schlaf auf dem RTC-Timer weiter (Drift des internen
  Oszillators, einige Prozent); mit WLAN stellt NTP sie bei jedem Aufwachen
  nach.
- `GET /api/settings` → `energy.wakeCause` (`timer`, `pin`, `null`);
  `GET /api/update/status` → `resetReason: deep_sleep`.
- Aus dem Schlaf zurückholen: Wach-Pin, Einschalten oder Reset — danach ist
  das Gerät `awakeTimeoutSec` lang erreichbar, um Deep-Sleep abzuschalten.

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
| `/api/sensors/<id>` | PUT, DELETE | Sensor ersetzen (Bearbeiten; bei Fehler bleibt der alte) / entfernen |
| `/api/sensors/<id>/reset` | POST | Akkumulierten Sensorwert zurücksetzen (z.B. YF-S201-Volumen) |
| `/api/sensors/<id>/calibration` | GET / POST / DELETE | Live-Rohwert + kalibrierter Wert je Kanal; Kanal kalibrieren (Offset / Faktor / Zwei-Punkt / Mehrpunkt-Kurve); Kalibrierung zurücksetzen |
| `/api/sensors/<id>/label` | POST | Anzeigename setzen/löschen (unabhängig von `id`, funktioniert auch bei Regler-Zuordnung) |
| `/api/actuators` | POST | Aktor anlegen |
| `/api/actuators/<id>` | POST, PUT, DELETE | Wert / `enabled` / Takt-Intervall schreiben; Aktor ersetzen (Bearbeiten); Aktor entfernen |
| `/api/actuators/<id>/label` | POST | Anzeigename setzen/löschen (unabhängig von `id`, funktioniert auch bei Regler-Zuordnung) |
| `/api/controllers` | POST | Regler anlegen |
| `/api/controllers/<id>` | PUT, DELETE | Regler ersetzen (Bearbeiten) / entfernen |
| `/api/controllers/<id>/setpoint` | POST | Sollwert setzen |
| `/api/controllers/<id>/params` | POST | Regler-Parameter setzen |
| `/api/controllers/<id>/label` | POST | Anzeigename setzen/löschen |
| `/api/estop` | POST, DELETE | Not-Aus auslösen (rastet ein, überlebt Neustart) / Verriegelung aufheben |
| `/api/buses` | GET, POST | Busse (OneWire, SPI, I2C) inkl. fester Board-Busse auflisten / anlegen |
| `/api/buses/<id>` | PUT, DELETE | Bus ändern (Pins nur ohne Nutzer) / löschen |
| `/api/bus/scan` | GET | Definierten Bus (`?bus=<id>`) nach Geräten scannen |
| `/api/remote/discover` | GET | Remote-Items per MQTT/ESP-NOW/WebSocket suchen (async: erst `202`, dann `200`) |
| `/api/remote/peers` | GET | Andere Boards im LAN per mDNS suchen (async: erst `202`, dann `200`) |
| `/api/remote/pair` | GET, POST | Kopplungsergebnis lesen / ein Board an den eigenen Hub koppeln |
| `/api/config` | GET | Gespeicherte Anlege-Configs aller dynamischen Items und Busse |
| `/api/pins` | GET | GPIO-Tabelle des Boards: frei / bedenklich / reserviert / verboten, Nutzer je Pin, Konflikte |
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
| `/api/recipes` | GET | Rezeptliste (Kopfdaten), nur SD-Boards |
| `/api/recipes/<id>` | GET, PUT, DELETE | Rezept lesen / anlegen oder ersetzen / löschen (`/recipes/<id>.json` auf der SD) |
| `/api/brewhouses` | GET | alle Sudhäuser, vollständig (`/brewhouses/<id>.json`, kein Index), nur SD-Boards |
| `/api/brewhouses/<id>` | PUT, DELETE | Sudhaus anlegen oder ersetzen / löschen |
| `/api/brewery` | GET, PUT | Brauerei-Vorgaben aller Sudhäuser (`/brewery.json`, `404` bis zum ersten Speichern) |
| `/api/settings` | GET, POST | Theme, Zeit, Update-Kanal, MQTT/Webhook/WebSocket/ESP-NOW, Gerätedisplay |
| `/api/network` | GET, POST | WLAN-Status abfragen; Credentials/Hostname setzen (rebootet) |
| `/api/network/scan` | GET | WLAN-Scan (async: erst `202`, dann `200`) |
| `/api/diag/heap` | GET | Heap-Diagnose: interner RAM, PSRAM, Heap-Verlauf beim Boot, Stack-Reserve der Tasks |
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

### Boards im LAN finden und koppeln (WebSocket)

Jedes Board kündigt sich per mDNS als `_sensactctrl._tcp` auf Port 80 an — dem
Port seiner HTTP-API — mit den TXT-Records `dev` (Device-Id), `prefix`
(Topic-Prefix), `ver` (Firmware) und `ws` (eigener Hub-Port, `0` wenn kein Hub
läuft). Damit finden sich Boards gegenseitig, und Fremdsysteme finden sie
ebenfalls.

Ablauf in der UI (Einstellungen → Geräte → „Geräte suchen"):

1. `GET /api/remote/peers` durchsucht das LAN und listet die gefundenen Boards.
   Das eigene Board steht nie in der Liste — der ESP32-mDNS-Responder
   beantwortet seine eigenen Anfragen nicht.
2. „Koppeln" schickt `POST /api/remote/pair`. Das Gerät ruft daraufhin die
   **eigene** `POST /api/settings` des Ziel-Boards auf und setzt dort
   `websocket.publishEnabled` und `websocket.hubUrl` auf
   `ws://<eigener-hostname>.local:<hubPort>`. Das Ziel-Board persistiert das,
   startet neu und verbindet sich von selbst.
3. Beim nächsten Scan liefert
   `GET /api/remote/discover?transport=websocket` die Sensoren und Aktoren des
   gekoppelten Boards, aus denen sich `Remote`-Items anlegen lassen.

Die Richtung ist bewusst so: konfiguriert wird auf dem Gerät mit der UI, aber
gewählt wird die TCP-Verbindung weiterhin vom Sensor-Board — `WebSocketsClient`
verbindet blockierend, und dieser Stall soll nicht auf dem Board mit dem Regler
landen. Die gespeicherte Hub-Adresse ist ein `.local`-Name, ein DHCP-Wechsel
bricht sie also nicht.

Voraussetzung: auf dem koppelnden Gerät muss der Hub aktiv sein (Einstellungen
→ Konnektivität → WebSocket), sonst antwortet `/api/remote/pair` mit `409`. Ist
das Ziel-Board passwortgeschützt, antwortet es mit `401`; die UI fragt dann nach
dessen Passwort.

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
zwischen einem Fremden und den eigenen Benachrichtigungen steht. Folge: Nach einem
Restore auf ein anderes Gerät müssen Benachrichtigungen neu eingerichtet werden.

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

**Gerät startet unerwartet neu, Firmware-Seite zeigt „Letzter Neustart: Watchdog“**
`resetReason: "task_wdt"` heißt: `loop()` kam 30 s lang nicht herum, der
Watchdog hat neu gestartet. Das ist ein echter Hänger im loopTask (oder,
seltener, ein Task auf Core 0, der nie abgibt) — den Umstand notieren
(was lief, welche Aktion kurz vorher) und im `PLAN.md`-Punkt zur stehen
gebliebenen Ablaufsteuerung nachtragen.

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
  (SD-Boards: `webui-full.tar`) aus dem passenden Release. Repo `nhhop/Brauerei` muss **public** sein.
  „Installieren“ startet das Gerät zuerst neu in einen **Update-Modus**: Die
  Downloads laufen früh im Boot, direkt nach dem WLAN und bevor Webserver, MQTT
  und die übrigen Dienste Heap belegen (`FirmwareUpdater::runPendingInstall()`).
  Grund ist der S2: Jeder TLS-Handshake braucht dort ~50 KB mit zwei
  zusammenhängenden ~17-KB-Blöcken (feste 16-KB-mbedTLS-Puffer im vorkompilierten
  Core), im laufenden Betrieb sind nur 58–65 KB frei und zerstückelt. Während der
  Installation ist das Gerät 30–60 s nicht erreichbar. Scheitert sie, bootet es
  normal, und die Firmware-Seite zeigt den Grund. Seit 2026-09-27 legt die Firmware
  die TLS-Puffer auf Boards mit PSRAM (S2, S3) ins PSRAM (`tlsAllocToPsram()` in
  `main.cpp`); damit kommt auch die reine Prüfung im Betrieb auf dem S2 durch. Der
  Update-Modus bleibt als Reserve für den großen Download. Heap-Stand abfragen:
  `GET /api/diag/heap`.
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

### webui.tar und webui-full.tar manuell bauen
Es gibt zwei UI-Pakete, beide das gebaute, **gzippte** `dist/` als Tar, nur `.gz`-Dateien,
Pfade relativ zur dist-Wurzel (nicht unter `dist/`):

- `webui.tar` (~150 KB) ohne `modules/` für die Boards mit der 256-KB-Partition
  (`esp32dev`, `lolin_s2_mini`, Build-Flag `BREWCTL_ASSETS_IN_PLACE`).
- `webui-full.tar` (~170 KB) mit `modules/` (optionale Pakete, derzeit Rezepte und Rechner) für die
  Boards mit SD-Karte. Ein „Installieren“ ersetzt das ganze `/www`; deshalb nimmt die
  Firmware auf diesen Boards das volle Tar, sonst wäre das Paket danach weg. Ältere
  Releases ohne `webui-full.tar` fallen auf `webui.tar` zurück.

Aus `web/`:

```powershell
pnpm build:tars          # build:sd + beide Tars: web/webui.tar und web/webui-full.tar
```

`pnpm build:tars` baut dieselben Tars wie die CI (`scripts/make-tars.js`; gleiche Größen).
Von Hand geht es so, wobei `pnpm build:sd` (NICHT nur `pnpm build`, sonst fehlen die `.gz`)
vorher laufen muss:

```powershell
tar -C dist --exclude=./modules -cf webui.tar .
tar -C dist -cf webui-full.tar .
```

Die CI erzeugt `./`-präfixierte Namen;
die Firmware normalisiert die in `SdTarSink` weg (die Glob-Variante
`cd dist; tar -cf ../webui.tar *` ohne `./` geht ebenso). Aufspielen: über
`/settings/firmware` → „UI-Paket (.tar)", oder
`curl -F "f=@webui.tar" http://<ip>/api/update/assets` (SD-Boards mit Rezepten:
`webui-full.tar`). Ein SD-Board mit dem schlanken `webui.tar` hat weder Rezepte noch Rechner.

#### Lokaler Test mit den BJCP-Stilwerten
Der Stilvergleich ist in Builds aus, bis die BJCP zugestimmt hat (PLAN.md), und
`bjcp-2021.json` liegt nicht im Repo. Für einen lokalen Test-Build die Datei aus der
Historie holen und den Schalter setzen; die Datei ist in `.gitignore`:

```powershell
cmd /c "git show 218ec58:BrewControl/web/public/catalog/bjcp-2021.json > BrewControl\web\public\modules\recipes\bjcp-2021.json"
cd BrewControl/web
$env:VITE_STYLE_COMPARISON = '1'     # oder VITE_STYLE_COMPARISON=1 in web/.env.local
pnpm build:tars                      # nur webui-full.tar enthält die Daten
Remove-Item Env:VITE_STYLE_COMPARISON
```

⚠ Die Datei **nicht** mit der PowerShell-Umleitung (`>`) anlegen: Windows PowerShell 5.1 schreibt
dann UTF-16 mit BOM, der Browser kann das nicht als JSON lesen, und die Stilauswahl bleibt
leer. Darum `cmd /c`, das die Bytes unverändert schreibt; der Build bricht bei so einer
Datei mit einer Fehlermeldung ab.

Ohne den Schalter entfernt `vite.config.ts` die Datei wieder aus `dist/`, auch wenn sie
in `public/` liegt. Ein so gebautes Tar nicht verteilen und nicht in ein Release packen.

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
Varianten und hängt `firmware-<env>.bin` + `webui.tar` + `webui-full.tar` ans Release. Stable = normales
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
