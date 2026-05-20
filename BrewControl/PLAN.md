# Plan: Web-UI für ESP32 mit SensActCtrl (BrewControl-Projekt)

## Context

`SensActCtrl` ist eine fertig ausgebaute ESP32-Library (Phase 1 + 2 + 3
komplett, 31/31 native Tests grün) mit Sensoren, Aktoren, Controllern
und drei Transport-Layern (MQTT, ESP-Now, Webhook). Sie wurde bewusst
**frontend-agnostisch** designt: `Registry::sensors()/actuators()/controllers()`
liefert Iteratoren über alle registrierten Objekte, und
[`serializeRegistry()`](../SensActCtrl/src/core/RegistrySnapshot.cpp)
erzeugt einen kompletten JSON-Snapshot (Meta + State + Setpoints + Params)
im selben Wire-Format wie die MQTT-Topics. PLAN.md der Library listet das
Web-Frontend explizit als künftigen Schritt — aber außerhalb des
Library-Scopes.

Dieser Plan baut das Web-Frontend in einem **separaten Projekt**
`BrewControl/` (Sibling von SensActCtrl im Workspace). BrewControl ist
heute leer (nur CLAUDE.md) und wird so zu einem konkreten Anwender-Sketch,
der die Library einbindet und eine moderne Web-UI für Live-Monitoring
und Tuning bietet.

**Ziel**: Browser-Dashboard, das alle in der Registry registrierten
Sensoren live anzeigt, Aktoren manuell schalten lässt und Controller-
Setpoints + PID-Tunings zur Laufzeit ändern kann. Vite + Preact +
Tailwind als Build-Stack, Auslieferung der gebauten Static-Files über
SD-Karte, Live-Updates per SSE. **WiFi-Provisioning** beim ersten Boot
über AP-/Setup-Portal (keine hartcodierten Credentials).

## Architektur

```
┌────────── Browser ───────────┐         ┌──────────── ESP32 ────────────┐
│ Preact-SPA (Tailwind)         │         │ AsyncWebServer (Port 80)      │
│ ├─ EventSource → /api/events  │ ◄─SSE──┤ ├─ AsyncEventSource (SSE)     │
│ ├─ fetch GET  /api/snapshot   │ ─HTTP──►│ ├─ /api/snapshot              │
│ ├─ fetch POST /api/actuators  │ ─HTTP──►│ ├─ /api/actuators/:id         │
│ ├─ fetch POST /api/controllers│ ─HTTP──►│ ├─ /api/controllers/:id/...   │
│ └─ Static asset requests      │ ─HTTP──►│ └─ serveStatic(SD, "/")       │
└───────────────────────────────┘         │                               │
                                          │   SensActCtrl::Registry        │
                                          │   ├─ Sensors  (tick → read)    │
                                          │   ├─ Controllers (tick → ctl) │
                                          │   └─ Actuators (tick → write) │
                                          └───────────────────────────────┘
                                                       │
                                                ┌──────┴──────┐
                                                │  SD-Karte    │
                                                │  index.html  │
                                                │  assets/*.js │
                                                │  assets/*.css│
                                                └──────────────┘
```

**Warum dieser Tech-Stack?**

- **`ESPAsyncWebServer`** statt sync `WebServer` aus dem ESP-Core: SSE
  braucht persistente Verbindungen — `AsyncEventSource` macht das in 3
  Zeilen, sync `WebServer` müsste mit `server.client()` von Hand
  streamen und würde `Registry::tick()` blockieren. AsyncTCP läuft in
  einem eigenen Task → keine Interferenz mit der Regler-Cadence.
- **Vite + Preact**: Preact (3 KB gzipped) statt React (44 KB) — passt
  zum Library-Stil ("Simplicity First"), gleiche API. Vite gibt
  HMR-Dev-Loop und produziert tree-shaken Bundle mit `base: './'` für
  relative Asset-Pfade (SD-Karte kennt keinen Server-Root).
- **Tailwind**: utility-first, kein CSS-Pfegeaufwand, JIT-Build
  produziert nur die tatsächlich genutzten Klassen (kleines Bundle).
- **SD-Karte** statt PROGMEM/LittleFS: Bundle (~50–80 KB nach gzip)
  ändert sich oft beim UI-Iterieren — SD ist hot-swappable, kein
  Firmware-Reflash. `SD`-Library (SPI) ist universell auf allen ESP32-
  Boards verfügbar.

## Projekt-Layout

```
BrewControl/
├── CLAUDE.md                  (bereits vorhanden)
├── PLAN.md                    (diese Datei)
├── SESSION.md                 (Session-Log, analog SensActCtrl/session.md)
├── README.md                  (neu — Setup + Build + Deploy)
├── firmware/                  (PlatformIO-Projekt)
│   ├── platformio.ini
│   └── src/
│       ├── main.cpp           (Boot-Logic: WiFi-Setup-Portal vs. STA + Loop)
│       ├── WiFiSetupPortal.h
│       ├── WiFiSetupPortal.cpp (AP + Captive-Portal + NVS-Persistence)
│       ├── WebUI.h
│       └── WebUI.cpp          (AsyncWebServer + API + SSE + SD-Serve)
└── web/                       (Vite + Preact + Tailwind v4)
    ├── package.json
    ├── pnpm-lock.yaml
    ├── .env.local             (gitignored: VITE_ESP_HOST=http://<ip>)
    ├── vite.config.ts
    ├── tsconfig.json
    ├── index.html
    └── src/
        ├── main.tsx
        ├── app.tsx
        ├── api.ts             (fetch + EventSource Wrapper)
        ├── types.ts           (TypeScript-Typen für Snapshot)
        ├── styles.css         (Tailwind directives)
        └── components/
            ├── SensorCard.tsx
            ├── ActuatorCard.tsx
            └── ControllerCard.tsx
```

## API-Vertrag

Alle Pfade unter `/api/...`. JSON-Bodies (Content-Type: application/json).

| Endpoint                                  | Methode | Body                  | Wirkung                                                    |
|-------------------------------------------|---------|-----------------------|------------------------------------------------------------|
| `/api/snapshot`                           | GET     | —                     | Ruft `serializeRegistry()`, liefert Full-State-Snapshot.   |
| `/api/events`                             | GET     | (SSE)                 | SSE-Stream: pusht Snapshot bei Connect + jede 1 s + nach jedem Write. |
| `/api/actuators/:id`                      | POST    | `{"v": <float>}`      | `registry.findActuator(id)->write(v)`                       |
| `/api/controllers/:id/setpoint`           | POST    | `{"v": <float>}`      | `registry.findController(id)->setSetpoint(v)`               |
| `/api/controllers/:id/params`             | POST    | `<roher params JSON>` | `registry.findController(id)->setParamsJson(body)`          |
| `/api/admin/wifi-reset`                   | POST    | —                     | Clears `Preferences("brewctrl")`, schedules reboot 500 ms later → Setup-Portal. |

Alle anderen Pfade → `server.serveStatic("/", SD, "/")` mit Fallback
auf `/index.html` für SPA-Routing.

**MVP-Scope (was Endpoints NICHT tun):** Items werden im Sketch
(`main.cpp`) als file-scope-Globals angelegt und in `registry.add(...)`
registriert — passend zum aktuellen `Registry`-Design (Pointer
non-owning, kein Lifecycle-Management). Endpoints zum Hinzufügen /
Entfernen von Sensoren/Aktoren/Controllern zur Laufzeit sind eine
fundamentale Erweiterung (Ownership, Persistenz, Pin-Konflikte) →
siehe "Future Work" für die Lösungsskizze. UI im MVP zeigt zwar an,
welche Items registriert sind, aber nicht "+ Add"-Buttons.

**Snapshot-Shape** (vorhandenes Format aus
[RegistrySnapshot.h](../SensActCtrl/src/core/RegistrySnapshot.h)):
```json
{
  "sensors":[{"id":"mash_temp","meta":{"kind":"Continuous","quantity":"Temperature","unit":"°C","min":-55,"max":125,"res":0.0625},"state":{"v":65.4,"t":12345,"ok":true}}],
  "actuators":[{"id":"heater","meta":{"kind":"Continuous","quantity":"DutyCycle","unit":"","min":0,"max":1,"res":0.01},"state":{"v":0.5,"t":0,"ok":true}}],
  "controllers":[{"id":"mash_ctrl","setpoint":65.0,"params":{"Kp":2.5,"Ki":0.1,"Kd":0.0}}]
}
```

## Kritische Dateien

### Firmware

**`BrewControl/firmware/platformio.ini`** (neu — Skelett unten, in der
gelebten Variante extrahiert in ein `[common]`-Section und pro Board
ein Env, das `${common.*}` referenziert. Aktuell drei Envs verifiziert:
`esp32dev`, `lolin_s2_mini`, `lilygo_t_display_s3_amoled`.)

```ini
[env:esp32dev]
platform = espressif32
board = esp32dev
framework = arduino
monitor_speed = 115200
monitor_filters = esp32_exception_decoder
lib_deps =
  symlink://../../SensActCtrl
  esp32async/ESPAsyncWebServer@^3.1.0
  esp32async/AsyncTCP@^3.2.0
build_flags = -std=gnu++17
build_unflags = -std=gnu++11
```

Board-spezifische Pin-Overrides via `-DBREWCTL_SD_CS/SCK/MOSI/MISO`,
`-DBREWCTL_ONEWIRE_PIN`, `-DBREWCTL_SSR_PIN` in den `build_flags` der
jeweiligen Env — siehe `main.cpp`-Beschreibung weiter unten für die
Caveats pro Board.

`symlink://../../SensActCtrl` lässt PIO die lokale Library direkt
einbinden — Änderungen an SensActCtrl sind sofort sichtbar, kein
Publish-Roundtrip nötig.

**`BrewControl/firmware/src/main.cpp`** (neu, ~80 Zeilen)

Beispiel-Setup (austauschbar — User kann eigene Sensoren/Aktoren/
Controller registrieren). Strukturanaloh zu
[`examples/02_pid_mash`](../SensActCtrl/examples/02_pid_mash/02_pid_mash.ino):
- **Boot-Logik**: `Preferences prefs("brewctrl", true)` lesen.
  - Wenn Reset-Taster (Default GPIO 0 = BOOT-Button) beim Boot >5 s
    gehalten wird → `prefs.clear()`.
  - Wenn keine `ssid`/`password` gespeichert → `WiFiSetupPortal portal;
    portal.runUntilConfigured();` (blockiert, bis Credentials gesetzt
    sind, dann Reboot via `ESP.restart()`).
  - Sonst → `WiFi.begin(ssid, password)`, Connect-Timeout 30 s, bei
    Fail → Setup-Portal-Fallback.
- **mDNS** nach STA-Connect-Erfolg: `MDNS.begin("brewcontrol");
  MDNS.addService("http", "tcp", 80);` (`#include <ESPmDNS.h>`). → UI
  ist unter `http://brewcontrol.local/` erreichbar, IP nur als Fallback.
- DS18B20 + DigitalOutputActuator(TPO) + PIDController als Demo-Setup.
- **SD-Init, board-konfigurierbar**: Pin-Defaults stehen als `#ifndef
  BREWCTL_SD_CS / SCK / MOSI / MISO` (analog für `ONEWIRE_PIN`/`SSR_PIN`)
  oben in `main.cpp`. Jede Env in `platformio.ini` kann sie per
  `-DBREWCTL_*` überschreiben. Wenn `BREWCTL_SD_SCK` definiert ist,
  zieht `main.cpp` eine eigene `SPIClass(HSPI)` mit den Custom-Pins auf,
  bevor `SD.begin(CS, sdSpi)` aufgerufen wird — sonst Default-SPI-Bus
  und `SD.begin(CS)`. SD-Mount-Fail ist **nicht** fatal: API + WebUI-
  Backend laufen weiter, nur `serveStatic` liefert nichts (verifiziert
  auf S2 + S3-AMOLED).

  **Board-spezifische Pinout-Caveats:**
  - **esp32dev** (Default): `kSdCsPin = 5`. ⚠ GPIO 5 ist Strapping-Pin
    (MTDI); manche SD-Breakouts ziehen CS/MISO beim Boot low und kippen
    den Boot-Modus. Lösung: 10k-Pull-up auf CS, oder bei Boot-Problemen
    `kSdCsPin = 15` (resp. 13).
  - **LolinS2 Mini**: identische Defaults — kein onboard-SD, externer
    Breakout (nicht E2E-getestet).
  - **LilyGo T-Display-S3-AMOLED-1.43**: SD-Slot onboard. Korrekte Pins
    laut Silkscreen: `CS=38, MOSI=39, MISO=40, SCK=41`. ⚠ **Achtung
    OPI-PSRAM**: GPIO 33–37 sind auf ESP32-S3-Varianten mit Octal-PSRAM
    intern vom PSRAM-Controller belegt — SPI-Pins MÜSSEN diesen Bereich
    meiden, sonst hängt `SD.begin()` und der Task-Watchdog feuert.
    OneWire/SSR-Demo-Pins ebenfalls von Defaults (4/16) verschieben, da
    GPIO 4 in einigen Mappings für SD/Display/Batterie reserviert ist.
  - Pinout-Quellen variieren zwischen den AMOLED-Sub-Varianten (1.43,
    1.64, 1.75, 1.91, Plus, Touch); **vor neuer Variante: Silkscreen am
    Board ablesen**, nicht Web-Snippets vertrauen.
- `WebUI webUI(registry, SD);` + `webUI.begin();` nach `registry.begin();`.
- `loop()`: `registry.tick(); webUI.tick();`.

**`BrewControl/firmware/src/WiFiSetupPortal.{h,cpp}`** (neu, ~120 Zeilen)

Eigene Implementierung statt `tzapu/WiFiManager`, weil wir bereits
AsyncWebServer im Stack haben — gleichen Server-Typ wiederverwenden ist
sauberer als zwei parallele HTTP-Stacks (`WiFiManager` nutzt sync
`WebServer`). Komponenten:
- `runUntilConfigured()`:
  1. `WiFi.mode(WIFI_AP_STA)` + `WiFi.softAP("BrewControl-Setup", kSetupPwd)`
     mit **fixem Default-Passwort** (`kSetupPwd`, z.B. auf Gehäuse-
     Aufkleber). ⚠ Offener AP wäre falsch hier: der User tippt sein
     **Heim-WiFi-Passwort** ins Setup-Formular — über offenes WiFi
     gingen Klartext-Credentials über die Luft. WPA2-PSK mit shared
     default secret reicht für Hobby-Use; für höhere Anforderungen
     → BLE-Provisioning (Future Work). **Warum AP_STA statt AP:** pure
     AP-Mode hat keine STA-Capability — `scanNetworks()` crasht den
     ESP32-S2 (single-core) ohne sauberen Fail-Pfad. AP_STA gibt der
     STA-Hälfte den Scanning-Stack, ohne dass schon eine STA-Connection
     besteht.
  2. `DNSServer dns; dns.start(53, "*", apIP)` → Captive-Portal-Effekt
     (jeder DNS-Lookup landet auf dem ESP32).
  3. `AsyncWebServer server(80)` mit Routen:
     - `GET /` → kleine, in C++-String eingebettete HTML-Page (Tailwind-
       freies Plain-HTML, ~3 KB) mit Scan-Liste + Input-Form.
     - `GET /api/scan` → **asynchroner Scan** mit Client-Polling:
       erster Call triggert `WiFi.scanNetworks(/*async=*/true)` und
       antwortet HTTP 202; Folge-Calls antworten HTTP 202 solange
       `scanComplete() == WIFI_SCAN_RUNNING` und HTTP 200 mit
       `[{"ssid":"...","rssi":-42,"open":false}, ...]`, sobald der
       Scan fertig ist. ⚠ **Warum nicht blockierend:** `WiFi.scanNetworks()`
       synchron aus dem AsyncTCP-Task crasht den S2 (single-core,
       Task blockt den WiFi-Driver bzw. Stack-Overflow durch Scan +
       JSON-Serialisierung). HTML-Seite macht eine Poll-Loop bis ≤30 s.
       Erstes "Scanning…" dauert 2–5 s, ist aber stabil.
     - `POST /api/connect` → Body `{"ssid":"...","password":"..."}` →
       in `Preferences` speichern, `ESP.restart()` nach 1 s Delay
       (damit Response noch durchgeht).
     - `onNotFound` → Redirect zu `/` (für Captive-Portal-Probe-URLs
       von iOS/Android).
  4. Schleife mit `dns.processNextRequest()`, bis Reset-Trigger
     (Setpoint im `Preferences` von `connect`-Handler gesetzt) +
     `delay(1000)` + `ESP.restart()`.

HTML der Setup-Seite ist als R"rawliteral(...)" PROGMEM-Konstante im
`.cpp` — Vanilla-JS-fetch zum Scannen + Submit, kein Build-Step.
Bewusst minimal, da es nur Initial-Setup ist.

**`BrewControl/firmware/src/WebUI.{h,cpp}`** (neu, ~150 Zeilen)

Klasse `WebUI` mit:
- Konstruktor `WebUI(Registry& reg, fs::FS& fs, uint16_t port = 80)`.
- `begin()` registriert Routen am internen `AsyncWebServer`:
  - `server.on("/api/snapshot", HTTP_GET, ...)` → `request->beginResponseStream("application/json")` und `serializeRegistry()` direkt in den Stream schreiben. **Kein 4 KB-Stack-Buffer** — der AsyncTCP-Task-Stack ist per Default ~4 KB *gesamt*; ein Snapshot-Buffer in dieser Größenordnung kann ihn überlaufen.
  - `events = new AsyncEventSource("/api/events"); server.addHandler(events); events->onConnect([this](AsyncEventSourceClient* c){ sendSnapshot_(c); });`
  - JSON-Body-Routen via **`AsyncCallbackJsonWebHandler`** (aus `AsyncJson.h`; ArduinoJson v7 ist über SensActCtrl bereits Transitive-Dep). Spart die manuelle `onBody`-Akkumulation (mehrere Aufrufe bei größeren Bodies sind ein bekannter Fußschuss). Eine Registrierung pro Endpoint:
    ```cpp
    auto* h = new AsyncCallbackJsonWebHandler("/api/actuators/", [&](auto* req, JsonVariant& json){
      auto id = parseIdAfter(req->url(), "/api/actuators/");
      if (auto* a = registry.findActuator(id)) { a->write(json["v"].as<float>()); pushSnapshot_(); req->send(204); }
      else req->send(404);
    });
    server.addHandler(h);
    ```
    Analog für `/api/controllers/:id/setpoint` und `/api/controllers/:id/params`.
  - Static-Fallback mit Cache-Header (gzip-Serving automatisch, siehe Build-Schritt):
    `server.serveStatic("/", fs, "/").setDefaultFile("index.html").setCacheControl("max-age=600");`
    AsyncWebServer serviert automatisch `foo.js.gz`, sofern die Datei neben `foo.js` liegt und der Client `Accept-Encoding: gzip` sendet.
- `tick()` ruft alle 1000 ms `pushSnapshot_()` auf (zyklisches SSE-Update).
- `sendSnapshot_(client?)`: `serializeRegistry()` in lokalen Buffer → `events->send(buf, "snapshot")` oder `client->send(buf, "snapshot")`.

Routen-Parsing der `:id`-Path-Params: AsyncWebServer hat keine
Route-Templates → einfacher String-Split auf `request->url()` nach dem
URL-Präfix. Im Plan-Code: helper `parseIdAfter(url, "/api/actuators/")`.

**Concurrency-Hinweis:** `serializeRegistry()` läuft aus dem AsyncTCP-
Task, `Registry::tick()` aus dem loopTask. `Reading`-Werte (float +
timestamp + ok-Flag) sind auf ESP32 nicht atomar gegen torn reads —
für den Dashboard-Use tolerierbar (sporadisches optisches Flackern,
kein Datenverlust). Wenn nötig: `portMUX_TYPE` um `tick()` und
`serializeRegistry()`, oder im loopTask einen Latest-Snapshot-Buffer
vorbereiten und nur den Buffer-Swap (Pointer) atomar synchronisieren.

### Frontend

**`BrewControl/web/package.json`** (neu)

```json
{
  "name": "brewcontrol-web",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "packageManager": "pnpm@10.0.0",
  "devDependencies": {
    "@preact/preset-vite": "^2.10.0",
    "@tailwindcss/vite": "^4.0.0",
    "tailwindcss": "^4.0.0",
    "typescript": "^5.7.2",
    "vite": "^7.0.0"
  },
  "dependencies": {
    "preact": "^10.25.0"
  }
}
```

**`BrewControl/web/vite.config.ts`** (neu)

```ts
import { defineConfig, loadEnv } from 'vite';
import preact from '@preact/preset-vite';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  return {
    plugins: [preact(), tailwindcss()],
    base: './',  // relative paths — SD-Karten-Root ist nicht "/"
    build: { outDir: 'dist', target: 'es2020' },
    server: {
      proxy: {
        '/api': env.VITE_ESP_HOST ?? 'http://192.168.4.1',
      },
    },
  };
});
```

Dev-Proxy: während `pnpm dev` läuft der Vite-Server lokal mit HMR, aber
API-Calls werden zum ESP32 geproxyt → schneller Iteration-Loop ohne
SD-Karten-Reflash bei UI-Änderungen. ESP32-IP wird **pro Entwickler** in
`web/.env.local` (gitignored) als `VITE_ESP_HOST=http://192.168.x.y`
gesetzt — kein Hardcoding im Repo, kein Branch-Drift.

**`BrewControl/web/src/types.ts`** (neu) — TypeScript-Typen 1:1 zum
Snapshot-Shape (Sensor, Actuator, Controller, Meta, State).

**`BrewControl/web/src/api.ts`** (neu) — `getSnapshot()`,
`subscribeEvents(onSnapshot)` (EventSource-Wrapper),
`writeActuator(id, v)`, `setControllerSetpoint(id, v)`,
`setControllerParams(id, paramsJson)`.

**`BrewControl/web/src/app.tsx`** (neu) — Top-Level: Hook
`useSnapshot()` abonniert SSE, dispatched in `useState`; rendert drei
Spalten (Sensoren/Controllers/Aktoren) mit Tailwind `grid`.

**`BrewControl/web/src/components/`** (neu, je ~30 Zeilen):
- **SensorCard**: zeigt ID, Quantity-Label, aktuellen Wert + Einheit,
  Bar-Indicator zwischen `meta.min/max`, "stale" badge wenn
  `(now - state.t) > 5000` ms.
- **ActuatorCard**: bei `kind=Binary` Toggle-Switch, bei
  `kind=Continuous` Slider 0..1, bei `kind=Discrete` Number-Input mit
  "Send"-Button → `writeActuator(id, v)`.
- **ControllerCard**: Setpoint-Input mit Live-Edit-and-Submit, Params
  als editierbarer JSON-Textarea mit "Apply"-Button →
  `setControllerParams(id, json)`.

**`BrewControl/web/src/styles.css`** (neu) — `@import "tailwindcss";`
(Tailwind v4: Content-Scanning automatisch, **kein** `tailwind.config.ts`,
**kein** `postcss.config.js`, **kein** `autoprefixer` mehr nötig.
Lightning CSS ist eingebaut. Custom-Theme via `@theme { --color-... }`
direkt in `styles.css`, falls Branding gebraucht wird.)

### Doku

**`BrewControl/README.md`** (neu) — Setup-Anleitung mit Build- und
Deploy-Steps (siehe Verifikation unten).

## Build-Reihenfolge

1. **Repo-Skeleton anlegen**: `BrewControl/firmware/` mit
   `platformio.ini` + leerem `src/main.cpp`. Verifikation:
   `pio run -e esp32dev` baut leeres Sketch durch.

2. **Library-Einbindung** in `platformio.ini`
   (`symlink://../../SensActCtrl` + AsyncWebServer + AsyncTCP).
   Verifikation: `#include <SensActCtrl.h>` in `main.cpp` kompiliert,
   ein lokales `Registry registry;` instanziiert ohne Fehler.

3. **WiFi-Setup-Portal** (`src/WiFiSetupPortal.{h,cpp}`) — AP +
   DNSServer + AsyncWebServer + `Preferences`-Persistence. Verifikation:
   Erstboot zeigt `BrewControl-Setup`-AP, Smartphone-Verbindung öffnet
   Captive-Portal mit Scan-Liste, Submit → Reboot → STA-Verbindung mit
   gespeicherten Credentials. Reset-Button >5 s → Setup-Portal wieder.

4. **WebUI-Klasse** (`src/WebUI.{h,cpp}`) — alle Routen, SSE-Source,
   Static-Serve, 1-Hz-Push. Verifikation: Build grün, ESP32 startet,
   Serial zeigt "WebUI started on port 80", `curl http://<ip>/api/snapshot`
   liefert valides JSON.

5. **Demo-Sketch** in `main.cpp` — Boot-Logic (Reset-Button-Check +
   Prefs-Read + STA-Connect-or-Portal) + DS18B20 + Heater +
   PIDController + WebUI-Wireup. Verifikation: Setpoint per `curl -X
   POST http://<ip>/api/controllers/mash_pid/setpoint -d '{"v":42}'`
   ändert `setpoint()` (sichtbar im nächsten Snapshot).

6. **Vite-Projekt** (`BrewControl/web/`) — `pnpm init`-Skelett,
   Vite + Preact + Tailwind, leere App rendert "Hello". Verifikation:
   `pnpm dev` öffnet Browser, `pnpm build` erzeugt `dist/index.html`.

7. **TypeScript-Typen** (`types.ts`) — Snapshot-Shape 1:1 nachgebaut.
   Verifikation: TS-Compiler hat keine Errors.

8. **API-Schicht** (`api.ts`) — `getSnapshot`, `subscribeEvents`,
   Mutationen. Verifikation: in der App in `useEffect` aufgerufen,
   Browser-DevTools zeigen 200-OK auf `/api/snapshot`.

9. **Drei Karten-Komponenten** mit minimalem Tailwind-Styling.
   Verifikation: alle Registry-Items rendern korrekt; manueller
   Aktor-Schalter triggert POST und Snapshot updated sich via SSE.

10. **README** mit Step-by-Step Setup/Build/Deploy.

11. **End-to-End-Test** auf realer Hardware (siehe Verifikation).

## Verifikation (End-to-End)

**Build & Deploy (einmalig pro UI-Änderung):**

```powershell
# Frontend bauen
cd BrewControl\web
pnpm install
pnpm build           # → BrewControl/web/dist/

# Pre-gzip JS/CSS/HTML — AsyncWebServer servt .gz automatisch bei
# Accept-Encoding: gzip; spart spürbar SPI-SD-Reads.
Get-ChildItem .\dist -Recurse -Include *.js,*.css,*.html |
  ForEach-Object { & gzip -k9 -- $_.FullName }

# Output auf SD-Karte kopieren (Beispiel: D: ist die SD-Karte)
Copy-Item -Recurse -Force .\dist\* D:\
# SD-Karte auswerfen, in ESP32-SD-Slot stecken (CS auf GPIO 5)

# Firmware (einmalig oder bei Code-Änderung)
cd ..\firmware
pio run -e esp32dev -t upload
pio device monitor
```

**Test-Sequenz (Erstboot):**

0. Erstboot ohne gespeicherte Credentials → Serial zeigt
   `No WiFi creds, starting setup portal`, ESP32 öffnet AP
   `BrewControl-Setup`. Smartphone-Verbindung → Captive-Portal poppt
   automatisch auf (oder `http://192.168.4.1/`). Scan-Button listet
   verfügbare Netze, Submit speichert in `Preferences` und rebootet.

**Test-Sequenz (Normalbetrieb):**

> **Hinweis ESP32-S2/S3 + TinyUSB-CDC unter Windows:** `pio device monitor`
> ist unzuverlässig (Monitor-Buffering verliert Output sporadisch trotz
> `while(!Serial && millis()<3000)`-Guard). Primärer Verifikations-Pfad
> ist daher **`curl` gegen die IP** — mDNS-Resolution ist unter
> Windows ebenfalls flaky, IP über Router oder Boot-Output ermitteln.
>
> **PowerShell-Workaround** wenn Serial gebraucht wird (z.B. Boot-
> Diagnose ohne pio-Monitor):
>
> ```powershell
> $port = New-Object System.IO.Ports.SerialPort COM7,115200,None,8,one
> $port.Open()
> # Auto-Reset via DTR/RTS-Toggle (gleiches Signal wie esptool):
> $port.DtrEnable = $false; $port.RtsEnable = $true
> Start-Sleep -Milliseconds 150
> $port.RtsEnable = $false; $port.DtrEnable = $true
> # Lese 10 s lang ein, dann schließen:
> $deadline = (Get-Date).AddSeconds(10); $buf = ""
> while ((Get-Date) -lt $deadline) { $buf += $port.ReadExisting(); Start-Sleep -Milliseconds 200 }
> $port.Close(); $buf
> ```
>
> Damit kann der Host das Board programmatisch reseten und den Boot-
> Output lesen — perfekt für automatisierte Diagnose-Iterationen.

1. Serial zeigt (sofern verfügbar): `WiFi connected, IP=192.168.x.y`,
   `SD mounted`, `WebUI started on port 80`. Auf S2 ggf. nur via
   `ping brewcontrol.local` die IP ermitteln.
2. Browser auf `http://brewcontrol.local/` (mDNS, Primär-URL) → Preact-UI
   lädt, 3 Spalten: `mash_temp`-Sensor mit Live-Wert, `heater`-Slider,
   `mash_pid`-Card. Fallback: `http://192.168.x.y/` über die IP aus Serial.
3. DevTools → Network → `events` (EventSource) zeigt Heartbeat-Events
   alle 1 s. Wert in der Sensor-Karte aktualisiert sich ohne Reload.
4. Heater-Slider auf 0.8 → POST `/api/actuators/heater` body `{"v":0.8}`
   → Serial zeigt `heater state=0.80`, nächster SSE-Snapshot enthält
   `state.v=0.80`.
5. Setpoint im UI von 65 → 70 ändern, "Apply" → POST
   `/api/controllers/mash_pid/setpoint` body `{"v":70}` → Snapshot
   reflektiert `setpoint=70`.
6. Params-Textarea: `{"Kp":12,"Ki":0.3,"Kd":1.0}` + Apply → POST
   `/api/controllers/mash_pid/params` → Snapshot zeigt neue Werte.

**Negative-Tests:**

7. `curl -X POST http://<ip>/api/actuators/does_not_exist -d '{"v":1}'`
   → HTTP 404.
8. SD-Karte entfernen, ESP32 rebooten → Serial zeigt `SD mount failed`;
   API-Routen funktionieren weiter; UI lädt nicht (erwartet). Karte
   einstecken → nach Reboot lädt UI wieder.
9. BOOT-Button (GPIO 0) beim Power-On gedrückt halten >5 s → Serial
   zeigt `Reset trigger, clearing prefs`, Reboot → Setup-Portal aktiv.
10. WiFi-Disconnect simulieren (Router rebooten, oder kurzfristig per
    Test-Endpoint `WiFi.disconnect()`): ESP32-Arduino reconnected
    automatisch (Default `WiFi.setAutoReconnect(true)`); Browser-
    EventSource reconnected nativ. **Erwartung:** UI lädt nach
    Reconnect weiter, SSE-Stream resumed in ≤60 s ohne manuellen
    Reload. Falls der AsyncWebServer-Listening-Socket nach Reconnect
    tot ist → `server.begin()` in einen `WiFi.onEvent(SYSTEM_EVENT_
    STA_GOT_IP, ...)`-Hook ziehen (in der Plan-Implementierung noch
    nicht vorgesehen — nur dann nachrüsten, wenn der Test fehlschlägt).

**Vite-Dev-Loop (während UI-Entwicklung):**

- `pnpm dev` im `web/` startet HMR-Server auf `http://localhost:5173`.
- `/api`-Calls werden zum ESP32 geproxyt (siehe `vite.config.ts`).
- UI-Änderungen sind sub-sekündlich im Browser sichtbar, ohne SD-Karte
  neu beschreiben zu müssen.

## QEMU-Dev-Option (Hardware-freie Entwicklung) — vertagt 2026-05-18

Research-Spike: Espressif-QEMU-Fork (https://github.com/espressif/qemu)
geprüft, latest Release `esp-develop-9.2.2-20260417` (19. April 2026)
mit Prebuilt-Binaries für Windows x86_64. Ergebnis: **für unseren
Use-Case derzeit kein Mehrwert** — Entscheidung gegen den Spike.

**Konkrete Befunde (statt Annahmen):**

- **Target-Support**: ESP32, ESP32-S3, ESP32-C3. **ESP32-S2 ist NICHT
  supported.** Unsere aktuelle Hardware (LOLIN S2 Mini) ist damit
  außen vor; wir müssten ausschließlich den `env:esp32dev`-Build
  benutzen, der gerade gar nicht gegen reale HW verifiziert ist.
- **WiFi: ❌** über alle Targets. Quelle:
  [esp-toolchain-docs/qemu](https://github.com/espressif/esp-toolchain-docs/blob/main/qemu/README.md).
  Ersatz wäre ein emulierter Ethernet-Controller — würde aber den
  `main.cpp`-Boot-Flow + `WiFiSetupPortal` von WiFi auf Ethernet
  umbauen, plus AsyncWebServer-seitige Anpassung. Das macht den Sinn
  des "drop-in QEMU-Smoke-Test" zunichte.
- **SD-Karte**: nur ESP32 hat partielle Unterstützung, S3/C3 ❌. SPI-
  `SD.begin(5)` müsste vermutlich durch `SD_MMC` ersetzt werden, was
  wieder ein HW-spezifischer Code-Pfad ist.
- **Was geht**: Boot-Smoke (Bootloader + Partition + Firmware-Image
  via `esptool merge_bin` zusammenführen, dann
  `qemu-system-xtensa -nographic -machine esp32 -serial mon:stdio
  -drive file=flash_image.bin,if=mtd,format=raw`), Serial-Output sehen,
  Registry-/Controller-Tick-Logik offline debuggen.
- **Was nicht geht**: WebUI-E2E, WiFi-Setup-Portal, SSE-Stream-Test —
  also genau der Hauptzweck dieses Projekts.

**Schlussfolgerung**: Die Kernfunktionalität von BrewControl (Web-UI
über WiFi, SD-served Frontend) ist in QEMU **nicht** emulierbar ohne
massive Eingriffe in den Production-Code. Ein reiner Boot-Smoke-Test
würde nur das absichern, was `pio run -e esp32dev` ohnehin im Compile-
Check abdeckt. Verbleibender Wert: headless CI-Smoke ohne HW — aber
das rechtfertigt aktuell den Setup-Aufwand nicht.

→ **In Future Work belassen**, mit der Bedingung: wieder aufgreifen,
sobald (a) Espressif-QEMU WiFi-Emulation bekommt **oder** (b) wir das
Projekt auf ESP32-S3 portieren und einen ESP-IDF-`esp_eth`-Pfad
einbauen, der parallel zum WiFi-Pfad genutzt werden kann.

## Out of Scope (für diesen Plan)

- Auth (HTTP-Basic, Token) — Hobby-LAN-Annahme, kann später als
  Middleware hinzukommen ohne API-Bruch.
- Charts / Historie — `serializeRegistry()` liefert nur aktuellen
  Punkt; Zeitreihen wären eigene Erweiterung (z.B. via InfluxDB oder
  ringbuffer).
- Domain-spezifische Brau-Profile (Maische-Rasten, Hopfengaben-
  Sequenzen) — laut SensActCtrl PLAN.md bewusst außerhalb der Library;
  dieser Plan baut nur die generische Web-Oberfläche, die für jedes
  SensActCtrl-Setup funktioniert. Brau-Logik kann in einem späteren
  Schritt obendrauf als zusätzliche Routen + UI-Tab kommen.

## Future Work (Backlog — eigene PRs nach MVP)

- **OTA-Update**: ESP32-Arduino bringt `ArduinoOTA` mit; AsyncWebServer
  hat zusätzlich `AsyncElegantOTA`/`ElegantOTA` für Browser-basierte
  Firmware-Uploads. Würde sich gut in einen `/admin`-Tab der bestehenden
  WebUI integrieren. Auch für die UI-Assets denkbar: Upload neuer
  `dist/`-Bundles direkt über die WebUI ins SD-FS (mit `request->_tempFile`
  und `events->send("reload")` an alle SSE-Clients).
- **HTTPS-Support**: Voraussetzung für **Push-Notifications via
  [ESPToolKit/esp-webPush](https://github.com/ESPToolKit/esp-webPush)**,
  da Browser-Push-API nur über `https://` registriert. Plan: ESPAsyncWebServer
  + BearSSL via `ESPAsyncTCPSSL` oder Migration auf ESP-IDF-`esp_https_server`.
  Zert-Strategie: Self-signed (User akzeptiert einmalig) vs.
  mDNS-Hostname + Let's Encrypt über lokalen ACME-Proxy. Bei der
  Implementierung beachten: SSE über TLS verdoppelt grob den RAM-Footprint
  pro Client.
- **QEMU-basierte Dev-Loop**: vertagt nach Research-Spike 2026-05-18
  (siehe QEMU-Sektion oben). Re-Trigger: Espressif-QEMU bekommt
  WiFi-Emulation, oder Projekt-Port auf ESP32-S3 + Ethernet-Pfad.
- ~~**WiFi-Reset im laufenden Betrieb**~~ — **erledigt 2026-05-18**:
  `POST /api/admin/wifi-reset` + UI-Button + ConfirmModal implementiert,
  E2E auf T-Display-S3-AMOLED verifiziert. Kein Token (Hobby-LAN-Annahme,
  matched Rest der API).

- **`pio device monitor` auf TinyUSB-CDC unter Windows stabilisieren**
  (sowohl ESP32-S2 als auch ESP32-S3 betroffen): pio-Monitor verliert
  sporadisch Output. **Workaround heute:** PowerShell-Skript mit
  `System.IO.Ports.SerialPort`, DTR/RTS-Toggle für Reset,
  `ReadExisting()`-Loop — programmatisch und reproduzierbar, gut für
  Diagnose-Iterationen. **Mögliche Permanent-Fixes:** `--filter direct`,
  anderes Terminal (PuTTY/Tera Term), oder Monitor-Reconnect-Tuning.

- **Runtime-Registrierung von Sensoren/Aktoren/Controllern via WebUI**
  (`POST /api/sensors`, `DELETE /api/sensors/:id`, analog für Aktoren
  und Controller). Nicht-trivial, weil mehrere Subsysteme betroffen:

  1. **Owning-Storage**: aktueller `Registry` nutzt non-owning `T*`. Ein
     `OwningRegistry`-Layer obendrauf (oder `std::unique_ptr`-Variante
     in der Library) wäre nötig, der heap-allokierte Instanzen besitzt
     und beim Remove sauber löscht. Alternative ohne Library-Change:
     BrewControl hält eine eigene `std::vector<std::unique_ptr<Sensor>>`
     als Owning-Storage und gibt Roh-Pointer an `registry.add(...)`.
  2. **Factory**: JSON wie `{"type":"DS18B20","id":"mash_temp","pin":4}`
     → konkretes Objekt. Erfordert eine `switch`/Type-Registry im Sketch,
     die alle gewünschten Typen kennt (Compile-Time-Opt-In via `#define`
     `BREWCTL_ENABLE_DS18B20`, weil sonst alle Library-Header inkludiert
     werden müssen → Flash-Bloat).
  3. **Persistenz**: `config/registry.json` auf SD-Karte. Beim Boot
     deserialisieren und Registry aufbauen; bei `POST /api/sensors`
     atomar updaten (write-temp + rename) und rebuild triggern. Aktuelle
     Items mit laufenden ISRs/Konversionen (PulseCounter, DS18B20)
     müssen vor Reconfig sauber `end()`-en — fehlt heute in der Library
     ein `Sensor::end()`/`Actuator::end()`-Lifecycle-Hook, der nachgezogen
     werden müsste.
  4. **Controller↔Sensor/Actuator-Binding**: aktuell C++-Referenzen im
     Konstruktor. Für Runtime-Binding bräuchten Controller einen
     ID-basierten Lookup-Pfad (`Controller::bind(Registry&)` mit
     `findSensor(id)`), und die JSON-Form müsste die Referenzen als
     IDs serialisieren.
  5. **Pin-Konflikt-Check**: bevor ein neues Item akzeptiert wird, muss
     gegen bestehende Pin-Belegungen geprüft werden. Erfordert ein
     `meta().pins()`-Konzept, das die Library aktuell nicht hat.
  6. **UI**: Add-Form pro Typ (DS18B20: Pin + ID; AnalogInput: Pin +
     Kalibrierung; PIDController: Sensor-ID + Aktor-ID + Output-Range)
     → wahrscheinlich JSON-Schema-getriebene Generation, damit pro
     neuem Typ kein eigener Form-Code nötig ist.

  → Reihenfolge eines möglichen Folge-Plans: erst Library um
  `end()`-Hooks + `bind()`-Pattern + `meta().pins()` ergänzen
  (mit Tests), dann in BrewControl Owning-Storage + Factory + JSON-Config
  + UI-Forms.
