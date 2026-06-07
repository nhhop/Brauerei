# Session — BrewControl Web-UI

Stand: 2026-05-17. Greenfield-Start. PLAN.md geschrieben und vom User
genehmigt; Implementierung noch nicht begonnen.

## Diese Session (2026-05-17)

1. **Exploration**: SensActCtrl-Library analysiert (`README.md`,
   `PLAN.md`, `session.md`, `src/SensActCtrl.h`, Core-Interfaces
   `Sensor.h`/`Actuator.h`/`Controller.h`, `Registry.h`,
   `RegistrySnapshot.{h,cpp}`, `WebhookTransport.{h,cpp}`, Controller-
   Tuning-API). Schlüssel-Erkenntnis: Library ist bereits frontend-
   agnostisch designt — `serializeRegistry()` liefert kompletten JSON-
   Snapshot, ArduinoJson v7 ist Dep, kein neuer Wire-Format-Code nötig.

2. **Anforderungs-Klärung mit User** (4 Runden Feedback auf den Plan):
   - Projekt-Platzierung: separates `BrewControl/` (nicht in
     SensActCtrl integriert).
   - Scope: Voll (Lesen + Schreiben — Aktoren schalten, Setpoints +
     PID-Tunings setzen).
   - UI-Stack: Vite + Preact + Tailwind + pnpm + TypeScript.
   - Asset-Delivery: SD-Karte (hot-swappable, kein Firmware-Reflash).
   - Live-Updates: SSE (statt Polling).
   - WiFi-Provisioning: Setup-Portal beim Erstboot + Reset-Trigger
     (kein hartcodierter SSID/Password).
   - Future-Work-Wünsche notiert: OTA, HTTPS (für esp-webPush),
     QEMU-Dev-Loop, WiFi-Reset zur Laufzeit, Runtime-Registrierung
     von Sensoren/Aktoren/Controllern via WebUI.

3. **Plan finalisiert** (`PLAN.md`):
   - 11 Build-Schritte (Firmware → WiFi-Portal → WebUI-Klasse →
     Demo-Sketch → Vite-Projekt → Types → API-Layer → Components →
     README → E2E-Test).
   - Architektur-Entscheidung **ESPAsyncWebServer** statt sync
     `WebServer` aus dem ESP-Core, weil SSE saubere persistente
     Verbindungen über `AsyncEventSource` braucht und AsyncTCP in
     eigenem FreeRTOS-Task läuft → blockiert `Registry::tick()` nicht.
   - `lib_deps = symlink://../../SensActCtrl` für direkte Library-
     Einbindung ohne Publish-Roundtrip.
   - API-Vertrag dokumentiert (GET /api/snapshot, GET /api/events SSE,
     POST /api/actuators/:id, /api/controllers/:id/setpoint,
     /api/controllers/:id/params).
   - MVP-Limitation explizit dokumentiert: Add/Remove von Registry-
     Items zur Laufzeit ist Future Work (Owning-Storage + Factory +
     Persistenz + Pin-Konflikt-Check + UI-Forms erfordert Library-
     Erweiterungen wie `end()`-Hooks und `bind()`-Pattern).

## Status pro Plan-Schritt

| Schritt | Status | Notiz |
|---|---|---|
| 1. Repo-Skeleton (`firmware/platformio.ini` + leerer `main.cpp`) | ✓ | 23 s Build, 20.0 % Flash |
| 2. Library-Einbindung (SensActCtrl + AsyncWebServer + AsyncTCP) | ✓ | Erst-Download ESP32-Toolchain, 81 s, 20.1 % Flash |
| 3. WiFi-Setup-Portal (`WiFiSetupPortal.{h,cpp}`) | ✓ | WPA2-AP `BrewControl-Setup` / `brew-setup`, Captive-Portal HTML inline (~2 KB) |
| 4. WebUI-Klasse (`WebUI.{h,cpp}`) | ✓ | Per-Item-Routen statt prefix-matching (s. Deviations) |
| 5. Demo-Sketch in `main.cpp` (DS18B20 + Heater + PID + Boot-Logic) | ✓ | + mDNS `brewcontrol.local`; Voll-Firmware 71.8 % Flash, 14.5 % RAM |
| 6. Vite-Projekt-Skelett (`web/`) | ✓ | Vite 7.3.3 + Preact 10.29 + Tailwind 4.3 + TS 5.9 |
| 7. TypeScript-Typen für Snapshot-Shape | ✓ | `web/src/types.ts`, abgeleitet aus `RegistrySnapshot.cpp:36-86` + Enum-Header |
| 8. API-Schicht (`api.ts`) | ✓ | `getSnapshot`, `subscribeEvents`, `writeActuator`, `setControllerSetpoint/Params` |
| 9. Karten-Komponenten (Sensor/Actuator/Controller) | ✓ | + `useSnapshot`-Hook + 3-Spalten-Grid; Build 12 Module / 11 KB gzip total |
| 10. README | ✓ | DE; Setup + Build + Deploy + Troubleshooting |
| 11. E2E-Test auf Hardware | ✓ | LOLIN S2 Mini (kein SD/DS18B20/SSR); Setup-Portal + STA + mDNS + alle API-Endpoints + SSE verifiziert; zwei Bugs gefixt |

## Offene Punkte / Annahmen

- **Hardware-Verfügbarkeit**: SensActCtrl-Session.md notiert, dass HW-
  Smoke-Tests verschoben sind, weil kein Mikrocontroller verfügbar ist.
  Selbe Constraint gilt hier — Schritte 1–10 sind hardware-frei
  durchführbar (Compile-Smoke via `pio run`), Schritt 11 erst nach
  Hardware-Zugang.
- **SD-Pinout**: Default `SD.begin(5)` (CS auf GPIO 5) — boardabhängig,
  in `main.cpp` als `kSdCsPin` konstante exponiert.
- **Vite-Dev-Proxy**: IP des ESP32 muss in `vite.config.ts` eingetragen
  werden, sobald STA-Verbindung steht.
- **AsyncWebServer-Versionen**: Plan referenziert `esp32async/ESPAsyncWebServer@^3.1.0`
  + `esp32async/AsyncTCP@^3.2.0` (Hauptzweig nach Migration vom
  `me-no-dev`-Org). Vor Implementierung Compile-Check, ob die Version
  noch aktuell ist.

## Plan-Review 2026-05-17 (context7-gestützt)

Library-Versionen verifiziert, PLAN.md überarbeitet. Geänderte Stellen:

- **Tailwind v3 → v4**: `@tailwindcss/vite`-Plugin, `@import "tailwindcss";`
  statt `@tailwind`-Directives, `tailwind.config.ts` + `postcss.config.js`
  + `autoprefixer` entfallen (Lightning CSS built-in).
- **Vite ^6.0.5 → ^7.0.0**: keine API-Brüche bei `base`/`server.proxy`,
  `assetsInlineLimit` (Default) gestrichen.
- **`vite.config.ts` Proxy**: ESP32-IP über `web/.env.local`
  (`VITE_ESP_HOST`), nicht hardcoded.
- **`packageManager: pnpm@10`** in `package.json` gegen Lock-Drift.
- **WebUI-Klasse**: `AsyncCallbackJsonWebHandler` statt manueller
  `onBody`-Akkumulation; `beginResponseStream` statt 4 KB-Stack-Buffer
  (AsyncTCP-Task-Stack ist ~4 KB gesamt); `setCacheControl` + gzip-Serve.
- **Build-Schritt**: Pre-gzip von `dist/*.{js,css,html}` vor SD-Copy.
- **WiFi-Setup-Portal**: Default-WPA2-Passwort statt offenem AP
  (Heim-WiFi-PW würde sonst im Klartext über die Luft gehen).
- **`platformio.ini`**: `monitor_filters = esp32_exception_decoder`.
- **`SD.begin`**: Strapping-Pin-Warnung für GPIO 5 (MTDI) im Plan, mit
  Fallback-Pin-Empfehlung für README.

ESPAsyncWebServer + AsyncTCP unter `esp32async/`-Org bestätigt (Plan war
richtig). Snapshot-Endpoint, Routen-Parsing via String-Split und
SSE-API (`onConnect`/`send(data, eventName, id)`) matchen die aktuelle
Library-API.

## Plan-Review #2 2026-05-17 (Sibling-Library-Verifikation + Architektur)

Zweiter Pass: Explore-Subagent gegen `../SensActCtrl/src/`, plus
eigenhändige Reads von `Registry.h`/`Sensor.h` zu Concurrency-Aspekten.

- **API-Verifikation 1:1 sauber** — alle 10 zitierten Calls
  (`serializeRegistry`, Registry-Lookups, Iteratoren, `Actuator::write`,
  `Controller::setSetpoint`/`setParamsJson`, `Registry::begin`/`tick`)
  existieren mit den im Plan zitierten Signaturen. Snapshot-Shape
  matcht `RegistrySnapshot.cpp:36–86` exakt (`params` ist nested
  JSON-Object). ArduinoJson v7 ist Transitive-Dep über `library.json`,
  kein expliziter `lib_deps`-Eintrag in `firmware/platformio.ini` nötig.
  Example `02_pid_mash.ino` referenziert das exakte Sketch-Pattern,
  das `main.cpp` adoptiert.
- **Concurrency-Hinweis** in § WebUI ergänzt: `serializeRegistry()`
  läuft im AsyncTCP-Task, `Registry::tick()` im loopTask — torn reads
  auf `Reading` (float+timestamp+ok) sind theoretisch möglich, für
  Dashboard tolerierbar; bei Bedarf `portMUX_TYPE` oder Latest-Snapshot-
  Buffer mit Pointer-Swap.
- **mDNS** in § main.cpp ergänzt: `MDNS.begin("brewcontrol")` +
  `addService("http","tcp",80)` → UI primär via
  `http://brewcontrol.local/`, IP nur Fallback. Verifikation-Schritt 2
  entsprechend angepasst.
- **WiFi-Reconnect-Negative-Test** als Eintrag 10 ergänzt: Router-Reboot
  / `WiFi.disconnect()`; UI + SSE müssen in ≤60 s resumen. `STA_GOT_IP`-
  Event-Hook für `server.begin()` nur, wenn Test fehlschlägt
  (Lazy-Optimierung).

## Nächster Schritt

MVP ist funktional verifiziert. Offene Punkte sind alle peripherie-
gebunden (kein SD-Modul / DS18B20 / SSR im aktuellen Setup):
- UI vom SD laden (statt nur curl gegen die API)
- DS18B20-Live-Reads + Stale-Badge mit echtem ok-Flag-Toggle
- Heater-TPO-Schalten validieren (Oszi / SSR-Last)
- Negative-Tests aus PLAN.md § Verifikation, die SD voraussetzen
  (Test 8: SD entfernen mid-flight)

## Implementierung 2026-05-18

Steps 1–10 in einer Session durchgebaut, jeder Step mit Compile-/Build-
Smoke verifiziert. Firmware kompiliert komplett (71.8 % Flash, 14.5 %
RAM); Web-Bundle 33 KB raw / 11 KB gzipped (12 Module).

**Deviations vs. PLAN.md:**

- **WebUI-Routen: per-item exact-match statt prefix-routing.**
  `AsyncCallbackJsonWebHandler` macht nur exact-URL-Match (kein
  Wildcard/Path-Template). PLAN.md's `parseIdAfter`-Sample war
  illustrativ; Implementierung iteriert `registry.actuators()` /
  `controllers()` in `WebUI::begin()` und registriert eine Route pro
  Item. Trade-off: bedingt, dass Registry vor `WebUI::begin()` voll
  populiert ist (im Demo-Sketch sowieso so). Unknown-IDs → 404
  automatisch (kein Handler matcht). Spart `parseIdAfter`-Helper-Code.

- **`packageManager: "pnpm@11.1.2"`** statt `pnpm@10` im Plan —
  pinned auf die lokal installierte Version.

- **pnpm 11 "approve-builds"-Gate stört.** pnpm 11 blockt esbuild's
  Post-Install-Script per Default; `pnpm.onlyBuiltDependencies` in
  package.json wird nicht respektiert. `pnpm build` triggert intern
  ein erneutes Install (`runDepsStatusCheck`), das wieder am Gate
  scheitert. Vite läuft trotzdem (esbuild-Binary kommt via optional
  dep `@esbuild/win32-x64`) wenn direkt aufgerufen:
  `node node_modules/vite/bin/vite.js build`. Permanente Fixes für
  Nutzer: einmalig `pnpm approve-builds esbuild` interaktiv. Im
  README troubleshooting-Block dokumentiert.

- **Vite-Build über direkten Node-Aufruf** statt `pnpm build` während
  der Implementation (s.o.) — Workaround, nicht Dauerzustand.

**Beobachtungen, die in PLAN.md noch nicht standen:**

- **SD-Karten-Fail ist nicht fatal:** API-Routen (snapshot, actuators,
  controllers, events) funktionieren weiter, nur `serveStatic` liefert
  nichts. UI lädt also nicht, aber `curl http://<ip>/api/snapshot` geht.
  In `main.cpp` als non-fatal mit Serial-Warning implementiert (statt
  PLAN.md's "Abbruch mit Serial-Fehler").

- **Bundle-Size 11 KB gzipped** (Skeleton + 3 Karten + Tailwind v4) —
  deutlich unter PLAN.md's 50–80 KB-Erwartung. Tailwind v4 + Lightning
  CSS shaken aggressiver als v3 + autoprefixer.

- **`tsconfig.json` `include`** auf `["src"]` reduziert — `vite.config.ts`
  würde `@types/node` brauchen (`process.cwd`), Vite parst die Config
  aber intern via esbuild und braucht keinen tsc-Check.

**Status der Pass-Reviews relativ zur Implementierung:**

Beide Reviews (context7 + sibling-API) haben sich gerechtfertigt: API-
Calls aus PLAN.md kompilierten ohne Korrektur gegen die Library; Tailwind
v4 / Vite 7 / AsyncCallbackJsonWebHandler / `beginResponseStream` haben
genau so funktioniert wie im Plan vorgesehen. mDNS-Add, Concurrency-
Hinweis-Block und WiFi-Reconnect-Test (Negative-Test 10) sind in den
finalen Plan eingegangen aber nicht implementiert (1: nur Doku im
WebUI.h-Kommentar; 2: implementiert im `main.cpp`; 3: HW-test, deferred).

## E2E-Test 2026-05-18 (LOLIN S2 Mini)

User hat ESP32-S2 Mini angeschlossen. Hardware ohne Peripherie (kein
SD, DS18B20, SSR) — Test focus auf Boot + Setup-Portal + API + SSE.

**Setup für S2:**

- `platformio.ini` umgebaut zu `[common]` + `[env:esp32dev]` +
  `[env:lolin_s2_mini]` (additiv, beide Boards parallel build-bar).
- S2-spezifisch: `-DARDUINO_USB_CDC_ON_BOOT=1` für Serial über USB-CDC.
- Build: Toolchain `toolchain-xtensa-esp32s2` per Erst-Download (~3 min);
  Footprint 67.7 % Flash / 16.4 % RAM (kleiner als ESP32 dank fehlendem
  Classic-BT).
- Flash-Mechanik: erste Flash braucht manuelles DFU (BOOT halten + RST
  kurz drücken). esptool kann den S2 nicht selbst rauskommen lassen aus
  Download-Mode — Warning "manual reset required" am Ende ist normal,
  trotz erfolgreichem Schreiben + Hash-verify.
- COM-Port-Tanz: ROM-DFU enumeriert als VID:PID 303A:0002 (üblicher-
  weise COM5), running Firmware als 303A:80C2 (TinyUSB-CDC, neuer COM-
  Port nach Reset — bei mir COM6). `pio device monitor` verliert die
  Connection beim Übergang, muss explizit auf den neuen Port verbinden.

**Bugs gefunden + gefixt:**

1. **`WiFi.mode(WIFI_AP)` reicht nicht für `scanNetworks()`** — pure
   AP-Mode hat keine STA-Capability; scanNetworks crashed den S2
   (single-core, kein definierbarer Fail-Pfad). Fix: `WIFI_AP_STA`
   in `WiFiSetupPortal.cpp`.

2. **Blocking `scanNetworks()` aus AsyncTCP-Task crashed weiterhin** —
   selbst mit AP_STA. Ursache: S2 single-core, AsyncTCP-Task blockt den
   WiFi-Driver, oder Stack-Overflow während Scan + JSON-Serialisierung.
   Fix: `WiFi.scanNetworks(/*async=*/true)` + Client-Polling (HTTP 202
   während running, 200 wenn fertig). HTML-Page macht Poll-Loop bis zu
   30 s. Side-Effect: erstes "Scanning..." dauert 2-5 s, ist aber stabil.

3. **Serial-Output nach Boot leer** — USB-CDC enumeriert ~1-2 s nach
   Boot; ersten `Serial.println`s gingen verloren. Fix: `while
   (!Serial && millis() < 3000) delay(10);` in `setup()` wartet auf
   Host-Connect, mit 3 s Headless-Fallback. Auf S2 mit pio monitor
   blieb der Pfad trotzdem leer — Bekanntes pio-Monitor + TinyUSB-CDC
   Buffering-Issue auf Windows. Nicht weiter verfolgt da E2E-Test
   ohne Serial möglich war (mDNS + curl).

**E2E-Test-Outcome:**

- Setup-Portal-AP `BrewControl-Setup` mit WPA2-Default-Passwort
  `brew-setup` sichtbar ✓
- Scan-Liste durchlief (nach async-Fix) ohne MC-Reset ✓
- Heim-WiFi-Auswahl + Submit → "Rebooting" → ESP.restart ✓
- STA-Connect zu Heim-WiFi (192.168.178.86) ✓
- mDNS-Resolve `brewcontrol.local` → 192.168.178.86, 3 ms ping
  (Windows 11 hat mDNS native, kein Bonjour nötig) ✓
- `GET /api/snapshot` → vollständiges JSON mit allen 3 Items ✓
- `POST /api/controllers/mash_pid/setpoint {"v":70.5}` → HTTP 204,
  Wert im nachfolgenden Snapshot reflected ✓
- `POST /api/actuators/heater {"v":0.7}` → HTTP 204, in Snapshot ✓
- `GET /api/events` mit `Accept: text/event-stream`-Header → SSE-
  Stream mit named "snapshot"-Events, aktuelle Werte ✓
- `POST /api/actuators/does_not_exist` → HTTP 404 (Per-Item-Routing
  führt zu sauberen 404s wie geplant) ✓
- Sensor `mash_temp` zeigt `state.ok=false, v=-127` — DS18B20-Driver
  liefert den korrekten "device disconnected"-Sentinel ohne Crash ✓

**Nicht testbar mangels Peripherie:**

- UI-Load vom SD (serveStatic-Pfad). API allein voll funktional.
- DS18B20-Live-Reads + state.ok-Toggle bei realem Sensor.
- Heater-TPO-Schalten unter Last (Oszi / SSR).
- Negative-Test 8 aus PLAN.md (SD entfernen mid-flight).

**Folge-PLAN-Edits (erledigt 2026-05-18):**

PLAN.md um die zwei behobenen Bugs + S2-Verifikations-Hinweis ergänzt:
- ✓ § WiFi-Setup-Portal: `WIFI_AP_STA` (statt nur `WIFI_AP`),
  async-scan-Pattern mit Client-Polling, Begründung "Crash auf
  ESP32-S2 single-core".
- ✓ § Verifikation: `pio monitor` auf S2 ist unzuverlässig; mDNS + curl
  als primärer Verifikations-Pfad dokumentiert.
- ✓ § Future Work: Serial-via-pio-monitor auf S2 mit Windows reliable
  bekommen (eventuell `--filter direct` + reconnect tuning).

## QEMU-Research-Spike 2026-05-18

User wollte QEMU als Hardware-freie Dev-Option angehen. Statt direkt zu
installieren erst Research zur aktuellen Lage — Ergebnis: **Spike
vertagt**, da QEMU für unseren Use-Case keinen Mehrwert bringt.

**Konkrete Befunde** (Quelle: github.com/espressif/qemu releases +
github.com/espressif/esp-toolchain-docs/blob/main/qemu/README.md):

- Latest Release `esp-develop-9.2.2-20260417` (19. April 2026), Prebuilt
  Windows x86_64 vorhanden — wäre also installier-bar.
- **Target-Support: ESP32, ESP32-S3, ESP32-C3. KEIN ESP32-S2.**
  Unsere reale HW (LOLIN S2 Mini) fällt raus; build-artifacts auf disk
  sind nur `lolin_s2_mini/*.bin`, kein `esp32dev`-build vorhanden.
- **WiFi: ❌** über alle Targets. Ersatz wäre Ethernet — würde
  `WiFiSetupPortal` + `main.cpp`-Boot-Flow + AsyncWebServer-WiFi-
  Bindung umbauen → kein "drop-in" mehr.
- **SD: nur ESP32 partielle Unterstützung** (S3/C3 ❌). SPI-`SD.begin`
  vermutlich → `SD_MMC`-Pfad nötig.
- Boot-Workflow wäre: `esptool merge_bin` (bootloader + partitions +
  firmware) → `qemu-system-xtensa -machine esp32 -drive
  file=flash.bin,if=mtd,format=raw -nographic -serial mon:stdio`.

**Entscheidung**: PLAN.md § QEMU-Dev-Option neu geschrieben mit den
konkreten Befunden statt vager Annahmen. Future-Work-Eintrag verkürzt
auf Re-Trigger-Bedingung (WiFi-Emulation in QEMU **oder** Projekt-Port
auf S3 + Ethernet-Pfad).

## WiFi-Reset zur Laufzeit 2026-05-18

PLAN.md-Future-Work-Punkt umgesetzt: Reset der WiFi-Credentials per
WebUI-Button statt nur per BOOT-Button-Power-On-Halten.

**Backend** (`firmware/src/WebUI.{h,cpp}`):
- Neuer Handler `POST /api/admin/wifi-reset` (kein Body).
- Klärt `Preferences("brewctrl")` (selber Pfad wie BOOT-Button in
  `main.cpp`), sendet 204, setzt `rebootAtMs_ = millis() + 500`.
- `tick()` ruft `ESP.restart()` sobald Deadline überschritten — gibt
  AsyncTCP Zeit, die Response zu flushen, ohne den Task zu blocken.
- Kein Auth (matched Rest der API, Hobby-LAN-Annahme — Diskussion siehe
  AskUser-Block diese Session).

**Frontend** (`web/src/`):
- Neue Komponente `components/ConfirmModal.tsx` — generisch (title +
  children + destructive-Variant + pending-State), Backdrop-Click +
  Cancel-Button schließen. Erstmal nur ein Aufrufer.
- `api.ts`: `wifiReset()`.
- `app.tsx`: in `<Dashboard>` und `<RebootingView>` aufgesplittet,
  `<App>` hält den `rebooting`-Toggle. Header bekommt einen kleinen
  outline-Button "Reset WiFi" rechts neben dem Titel.
- Erfolgs-Flow: POST 204 → `setRebooting(true)` → `<RebootingView>`
  rendert, useSnapshot unmounted (schließt SSE), Hinweis "connect to
  BrewControl-Setup AP".

**Footprint-Δ** (Compile-Smoke, kein E2E):
- esp32dev: 71.8 % → 71.9 % Flash, RAM unchanged (14.5 %).
- lolin_s2_mini: 67.7 % → 67.8 % Flash, RAM unchanged (16.4 %).
- Web-Bundle: 12 → 13 Module, 11 KB → 12 KB gzipped (Modal+Reset-State).

**Nicht implementiert (bewusst weggelassen):**
- ESC-Key-zum-Schließen des Modals.
- Body-Scroll-Lock während Modal offen ist.
- Auth/Token — siehe oben.

**Offen für Hardware-Test:**
- Verify end-to-end: Click → Confirm → 204 → Reboot → Setup-AP wieder
  sichtbar (gleicher Pfad wie BOOT-Button-Halten, sollte funktionieren).

## E2E auf LilyGo T-Display-S3-AMOLED-1.43 2026-05-18

User hat einen ESP32-S3 mit integriertem SD-Slot angeschlossen (T-Display-
S3-AMOLED-1.43, 466×466 round AMOLED, 16 MB Flash, 8 MB OPI PSRAM). Das
war der erste Test des kompletten SD-served-UI-Pfads (Test 8 aus
PLAN.md, seit Projekt-Start offen).

**Platformio-Setup:**

- Neuer `[env:lilygo_t_display_s3_amoled]`. Installierte
  `espressif32@6.3.2` kennt weder `lilygo-t-amoled` noch
  `esp32-s3-devkitm-1` als Board-ID; Fallback auf `lilygo-t-display-s3`
  (selber Chip, 16 MB, qio_opi, USB-CDC). Wir treiben das Display nicht
  an — LCD-vs-AMOLED ist firmware-irrelevant.
- Pin-Overrides via Build-Flags: `BREWCTL_SD_CS/SCK/MOSI/MISO` und neu
  `BREWCTL_ONEWIRE_PIN`/`BREWCTL_SSR_PIN`, damit die Demo-Pins (4/16)
  nicht mit board-spezifischer Belegung kollidieren. main.cpp hat
  `#ifndef`-Defaults und einen `#ifdef BREWCTL_SD_SCK`-Zweig, der eine
  explizite `SPIClass(HSPI)` mit den Custom-Pins aufzieht statt den
  Default-SPI-Bus zu nutzen.
- Footprint: 878 KB Flash, 47 KB RAM (kleinste der drei envs).

**Pin-Hunt — drei Iterationen:**

1. **5/35/36/37** (aus generischem "AMOLED"-Search-Hit, eigentlich 1.91-
   Variante): TG1WDT-Crash beim `SD.begin()`. **Root cause:** GPIO 33–37
   sind auf ESP32-S3 mit OPI-PSRAM intern vom PSRAM-Controller belegt;
   das Arduino-SPI hat versucht, die Pins zu hijacken, PSRAM-Access
   blockierte, IDLE-Task verhungerte, Task-Watchdog feuerte.
2. **4/41/39/40** (aus Search-Hit für "AMOLED-1.43-1.75"): Boot durch,
   aber `sdCommand(): Card Failed! cmd: 0x00` — SPI funktionierte, Karte
   antwortete nicht. MISO/MOSI-Swap gab identisches Verhalten.
3. **38/41/39/40** (user-verifiziert vom Board-Silkscreen): **funktioniert**.
   CS war's, nicht die Datenleitungen.

→ Lehre für die Doku: bei jeder neuen S3-AMOLED-Sub-Variante (1.43,
1.64, 1.75, 1.91, Plus, Touch) ist der SD-Pinout anders. Web-Quellen
verwechseln die Varianten regelmäßig; einzig verlässlich ist der
Silkscreen auf dem Board.

**Debug-Workflow, der sich gelohnt hat:**

- `pio device monitor` weiterhin unzuverlässig auf S3+TinyUSB+Windows
  (S2-Issue bleibt). **PowerShell-Workaround:**
  `System.IO.Ports.SerialPort COM7,115200,…; $port.Open(); DTR/RTS-Toggle
  für Reset; ReadExisting()-Loop`. Damit kann der Host das Board
  programmatisch reseten und den Boot-Output ohne pio-Monitor lesen —
  perfekt für automatisierte Diagnose-Iterationen.
- Auto-DFU funktionierte via `esptool` (`Hard resetting via RTS pin`),
  kein manueller BOOT+RST nötig — anders als beim S2.

**E2E-Verifikation komplett:**

| Test | Resultat |
|---|---|
| Erstboot ohne Creds → Setup-AP `BrewControl-Setup` (WPA2) | ✓ |
| Async-Scan + Heim-WiFi-Select + Submit + Reboot | ✓ |
| STA-Connect (192.168.178.87), mDNS `brewcontrol.local` | ✓ Serial / ✗ Windows-Resolver |
| `SD mounted` Serial-Output | ✓ (nach Pin-Korrektur) |
| `GET /` lädt index.html aus SD (397 B) | ✓ — Test 8 aus PLAN.md endlich grün |
| Browser-UI: 3 Spalten, alle Items, Stale-Badge für `mash_temp` (-127) | ✓ |
| `POST /actuators/heater {"v":0.6}` → 204, Snapshot reflektiert | ✓ |
| `POST /controllers/mash_pid/setpoint {"v":72.5}` → 204 | ✓ |
| `POST /actuators/does_not_exist` → 404 (Per-Item-Routing) | ✓ |
| SSE-Live-Updates im Browser | ✓ |
| **Neuer Reset-WiFi-Button → Confirm-Modal → 204 → Reboot → Setup-AP** | ✓ |

Damit ist auch die WiFi-Reset-Implementation dieser Session E2E
verifiziert (nicht nur Compile-Smoke).

**Verbleibende Offene Punkte (alle peripherie-gebunden):**

- DS18B20-Live-Reads mit echtem Sensor (heute zeigt `state.ok=false,
  v=-127` korrekt mit Stale-Badge)
- Heater-TPO-Schalten unter SSR-Last (Oszi)
- Negative-Test 8 aus PLAN.md "SD entfernen mid-flight" (heute nur
  "ohne SD booten" verifiziert)

**PLAN.md-Folgearbeiten:**

- § Verifikation: PowerShell-Serial-Reset-Trick dokumentieren als
  Workaround für unreliable `pio monitor` auf S3+Windows.
- README/§ Build-Reihenfolge: pro Board einen Pin-Map-Block (esp32dev:
  default 5/16/4; S2 Mini: default; AMOLED-1.43: 38/41/39/40 + OneWire/SSR
  auf 1/2).

## Runtime-Item-Add/Remove E2E-Test 2026-05-18 (T-Display-S3-AMOLED-1.43)

Feature implementiert (Details: kompakter Kontext-Summary): `DynamicItems`
mit owning-Storage, SD-Persistenz via `/config/registry.json`, 6 neue
Endpoints in WebUI, Preact-Frontend mit AddItemModal + Delete-Button.
Drei Build-Envs kompilieren (73.3 % Flash, 14.4 % RAM auf S3-AMOLED).
Web-Bundle: 14 Module, 9.95 KB gzip.

**E2E-Test-Outcome:**

| Test | Resultat |
|---|---|
| `GET /api/snapshot` → 3 statische Items (mash_temp, heater, mash_pid) | ✓ |
| `POST /api/sensors {"type":"DS18B20","id":"boil_temp","pin":5}` → 204, sofort im Snapshot | ✓ |
| `POST /api/actuators {"type":"DigitalOutput","id":"boil_heater","pin":16,"mode":"Binary"}` → 204 | ✓ |
| `POST /api/controllers {"type":"PID","id":"boil_pid","sensor":"boil_temp","actuator":"boil_heater",...}` → 204 | ✓ |
| `DELETE /api/sensors/mash_temp` (statisch) → 405 | ✓ |
| `DELETE /api/sensors/boil_temp` während `boil_pid` davon abhängt → 405 (Dependency-Guard) | ✓ |
| Delete in korrekter Reihenfolge Controller→Sensor→Aktor → 204 je | ✓ |
| `POST /api/sensors` mit bereits vorhandenem ID → 400 | ✓ |
| Reboot (via RTS-Puls): `persist_sensor` + `persist_relay` nach Reboot wieder da | ✓ |
| SD-Serve: `GET /` liefert gzip-komprimiertes index.html (267 B) | ✓ |
| SSE: dynamische Items erscheinen im event-stream | ✓ |

**Implementierungs-Deviations vs. PLAN.md (Future-Work-Eintrag):**

- `end()`-Hooks + `remove()` in SensActCtrl-Library nachgezogen (rückwärts-
  kompatibel: Default-Implementierungen als No-Op in Basis-Klassen).
- `DigitalOutputActuator::end()` setzt Pin auf sicheren Zustand (false).
- WebUI nutzt prefix-basiertes Routing über Custom-`AsyncWebHandler`-
  Subklassen (`BodyPrefixHandler`, `DeletePrefixHandler`) für die
  Create/Delete-Endpoints. `AsyncCallbackJsonWebHandler` (exact-URL) für
  die drei Create-Endpoints.
- DynamicItems-Storage: `std::vector<std::unique_ptr<Entry>>` mit
  heap-allozierten Entries — stabilisiert `id.c_str()`-Pointer bei
  Vektor-Reallokation.
- `/config`-Verzeichnis wird on-demand bei erstem `saveToSD()` angelegt;
  `loadFromSD()` ist tolerant bei fehlendem File (first boot).

**Verbleibende Offene Punkte:**

- DS18B20-Live-Reads mit echtem Sensor
- Heater-TPO-Schalten unter SSR-Last (Oszi)
- Negative-Test "SD entfernen mid-flight"
- Browser-UI-Test (AddItemModal, Delete-Button) — kein Playwright-Browser
  verfügbar in dieser Session; API vollständig verifiziert

## Bus-Discovery + Multi-Sensor OneWire 2026-05-20

Feature: Mehrere DS18B20-Sensoren an einem OneWire-Pin können jetzt über ihre
ROM-Adresse voneinander unterschieden werden. Dafür wurden drei Schichten erweitert.

**Motivation:** Beim Hinzufügen eines DS18B20 wurde bisher nur der GPIO-Pin
angegeben. OneWire erlaubt mehrere Sensoren auf einem Pin; ohne ROM-Adresse
sind sie nicht differenzierbar. Ohne Discovery-Endpoint muss der User die
64-bit-Adresse blind eintippen — nicht praxistauglich.

**Geänderte Dateien:**

*SensActCtrl Library:*
- `src/sensors/DS18B20Sensor.h/.cpp` — neues `static DS18B20Sensor::scanBus(pin,
  out, maxDevices)`: erstellt temporäre `OneWire`+`DallasTemperature`-Instanz,
  enumeriert alle Geräte via `getDeviceCount()`/`getAddress()`, gibt ROM-Adressen
  zurück. Arduino-only; native-Build-Stub gibt 0 zurück.

*BrewControl Firmware:*
- `DynamicItems.h` — neues `BusEntry`-Struct + `onewireBuses_`-Vektor (vor `sensors_`
  deklariert, korrekte Destruction-Order), private `getOrCreateBus(pin)` +
  `parseHexAddress(hex, out)`. Benötigt `<OneWire.h>`.
- `DynamicItems.cpp` — DS18B20-Factory extended: optionales `address`-Feld (16-Hex-
  String) → `DS18B20Sensor(id, sharedBus, addr)`; ohne Feld → altes
  Verhalten `DS18B20Sensor(id, pin)` (rückwärtskompatibel). `getOrCreateBus`/
  `parseHexAddress` implementiert.
- `WebUI.h/.cpp` — neuer `GET /api/bus/scan?type=onewire&pin=N`-Handler:
  ruft `DS18B20Sensor::scanBus()`, serialisiert Ergebnisse als JSON-Array
  `[{"index":0,"address":"28ff..."}]`.

*BrewControl Web:*
- `types.ts` — `ScannedDevice` + `BusScanResult` Interfaces
- `api.ts` — `scanOneWireBus(pin)`
- `AddItemModal.tsx` — Scan-Button neben Pin-Input; Ergebnis-Liste mit Radio-
  Buttons; 1 Gerät → Auto-Select; kein Scan → Single-Sensor-Modus wie bisher.
  `createSensor`-Call bekommt `address`-Feld wenn ausgewählt.

**Verifikation:**
- Firmware `esp32dev` kompiliert: `SUCCESS` (73.6 % Flash / 14.5 % RAM — unverändert)
- `pnpm typecheck`: keine Errors
- `pio test -e native`: MinGW nicht in PATH dieser Session — User muss mit
  `$env:PATH = "$env:USERPROFILE\.platformio\mingw64\bin;$env:PATH"` voranstellen
  (Setup in `SensActCtrl/session.md` dokumentiert)

**Caveat:** `scanBus` blockiert ~100 ms aus dem AsyncTCP-Task (einmalig, user-
ausgelöst). Wenn ein DS18B20 bereits auf dem selben Pin läuft, kann die parallele
OneWire-Aktivität dessen laufende Konversion abbrechen → einmaliges
`DEVICE_DISCONNECTED_C` im nächsten Reading. Harmlos für das Dashboard.

**Persistence:** `cfgJson` in `DynamicItems` speichert das komplette cfg-Object
inklusive `address`-Feld → Reload aus `/config/registry.json` nach Reboot
rekonstruiert die Shared-Bus-Instanz korrekt.

## Dev-Workflow-Verbesserungen 2026-05-18

**Lokaler Dev-Proxy:**

- `web/.env.local` angelegt mit `VITE_ESP_HOST=http://192.168.178.87`.
  `vite.config.ts` liest diesen Wert bereits (`loadEnv` + `server.proxy`),
  war bisher nur nicht dokumentiert.
- Workflow: `pnpm dev` → HMR auf `localhost:5173`, alle `/api/*`-Requests
  transparent an den ESP32 im Netz. SD-Karten-Deploy nur noch für
  Release-Builds nötig.

**pnpm-Build-Fix:**

- `pnpm approve-builds` (einmalig) behebt den pnpm-11-esbuild-Gate.
  Danach funktioniert `pnpm build` normal — der `node node_modules/vite/…`-
  Workaround aus der letzten Session entfällt.
- SESSION.md-Deviation-Notiz von 2026-05-18 bleibt korrekt für frische
  Checkouts ohne `approve-builds`.

**`build:sd`-Script:**

- `scripts/gzip-dist.js` extrahiert die gzip-Logik aus dem langen
  PowerShell-Oneliner.
- `package.json` bekommt `"build:sd": "vite build && node scripts/gzip-dist.js"`.
- SD-Deploy-Workflow jetzt: `pnpm build:sd` + `robocopy dist D:\ /E /NFL /NDL`.

---

## Session 2026-06-03 — OTA Firmware-Update (Code komplett, HW-E2E offen)

Plan [`docs/superpowers/plans/2026-06-03-firmware-update.md`](../docs/superpowers/plans/2026-06-03-firmware-update.md)
umgesetzt (Skill `superpowers:executing-plans`), Feature-Branch `feat/firmware-update`.

**Implementiert (Firmware):**
- `version_flags.py` + `src/version.h` — `BREWCTL_VERSION` (git-Tag) +
  `BREWCTL_VARIANT` (`${PIOENV}`) als Compile-Flags; `BREWCTL_VERSION_OVERRIDE`
  hat in CI Vorrang.
- `lib/TarExtractor/` — streaming USTAR-Parser, pure-C++, host-getestet
  (`[env:native]`, 4 Unity-Tests grün). Plan-Lücke gefixt: Unity braucht
  `setUp`/`tearDown`-Stubs.
- `src/SdTarSink.h` — TarExtractor-Callbacks → `fs::FS`.
- `src/FirmwareUpdater.{h,cpp}` — State-Machine, GitHub-Releases-Client
  (`WiFiClientSecure.setInsecure()`, ArduinoJson-Filter), blockierender
  Download/Flash auf dem loopTask via `tick()`; HTTP-Routen setzen nur Flags.
- `SettingsStore` — `firmware`-Sektion (channel/autoCheck) + Validierung.
- `WebUI` — `/api/update/{status,check,install,firmware,assets}`,
  `.bin`-Flash- und `.tar`-Extract-Upload-Handler, atomarer `/www`-Swap auf
  loopTask; Serve-Root von SD-Root → `/www` umgestellt.
- `main.cpp` — `FirmwareUpdater` instanziiert + verdrahtet.

**Implementiert (Web):** `types.ts` (`UpdateStatus`/`FirmwareSettings`),
`api.ts` (Update-Client + XHR-Upload mit Progress), `FirmwarePage.tsx`,
Route `/settings/firmware`, Settings-Kachel + „Update verfügbar"-Badge.

**CI:** `.github/workflows/release.yml` — Matrix baut `firmware-<env>.bin` +
`webui.tar` bei `v*`-Tag.

**Partition-Entscheidung (Task 12, vorgezogen):** Sobald der TLS-Pull-Pfad
gelinkt ist, springt esp32dev von 79 % → **92,6 %** App-Flash (lolin 88,3 %).
Zu eng für OTA → beide 4-MB-Envs auf `board_build.partitions = min_spiffs.csv`
(~1,9 MB Slots): esp32dev **61,7 %**, lolin **58,8 %**. LilyGo-S3 (16 MB)
unverändert (17,4 %). ⚠ Layout-Wechsel braucht **einmaligen USB-Flash**.

**Verifikation:** alle drei Boards `pio run` grün; `pio test -e native` 4/4;
`pnpm typecheck` + `pnpm build` grün.

**HW-E2E Phase A (Upload-Pfade) — erledigt auf LilyGo S3 (192.168.178.87):**
- A1 USB-Flash (min_spiffs-Layout) + SD `/www` → bootet, UI serviert aus `/www`.
- A2 `/api/update/status` → `variant:lilygo…`, korrekt. (Boot-Auto-Check meldet
  `error/check failed` — erwartet, da noch kein Release/public-Repo; kein Crash.)
- A3 `.bin`-OTA-Upload (1,14 MB) → `ok`, Flash, Reboot, Gerät wieder oben.
- A4 `.tar`-Upload → **Bug gefunden:** `tar -cf x .` emittiert `./`-Namen,
  `SdTarSink` baute `/www.new/./<name>` → SD-VFS lehnt ab → `extract failed`.
  **Gefixt** (`fix(fw): strip leading ./ in SdTarSink`, Commit 4d05e10): beide
  tar-Formen (`.` und `*`) extrahieren jetzt; UI nach Swap korrekt aus `/www`.
  **Relevant für CI:** `release.yml` nutzt die `.`-Form → ohne den Fix wäre der
  Server-Pull (Phase B) am Asset-Extract gescheitert.

**HW-E2E Phase B (Server-Pull) — erledigt auf LilyGo S3 (2026-06-04):**
- Repo `nhhop/Brauerei` public geschaltet; manuelles Test-Release `v0.0.1-test`
  mit allen 4 Assets (CI war zu dem Zeitpunkt noch kaputt, s. u.).
- `check` → `updateAvailable` v0.0.1-test; `install` → `downloading` (webui.tar
  extract + `/www`-Swap) → `flashing` (0→98 %) → Reboot → Gerät läuft danach
  `v0.0.1-test`, UI aus den gepullten Assets (`/` + gehashte Assets → 200).
  Bestätigt zugleich den `./`-Fix mit dem **CI-Format** `webui.tar`.
- Negativ-Varianten-Test entfällt: die Matrix baut alle 3 Varianten, also findet
  jede Variante ihr Asset.

**CI-Bugs (beim Tag-Push-Release entdeckt) — gefixt + verifiziert (2026-06-04):**
1. Firmware-Build brach, weil `platformio.ini` an `symlink://../../../IdsInductionCooker`
   hängt — ein **privates Sibling-Repo**, das `actions/checkout` nie auscheckte.
2. `action-gh-release` scheiterte mangels `permissions: contents: write`.
   Fix (`ci: fix release workflow …`, Commit 2c1decd): Brauerei + IdsInductionCooker
   als Siblings unter `$GITHUB_WORKSPACE` auschecken + `contents: write`. Voraussetzung:
   IdsInductionCooker **public**. Verifiziert: Run für `v0.0.1-test2` grün (2m11s),
   alle 4 Assets automatisch gebaut. Beide Test-Releases danach gelöscht.

**Merge:** PR #6 nach `main` gemergt (Merge-Commit 230fa11), Branch
`feat/firmware-update` lokal + remote gelöscht.

**SD-Karten-Migration:** erledigt — bestehende Karten auf `/www` umgestellt
(bzw. via `webui.tar`-Einspielung). Damit ist das OTA-Feature vollständig
abgeschlossen, keine offenen Punkte mehr.

---

## Session 2026-06-04 — Backup & Restore (Config-Export/Import)

Voller Superpowers-Zyklus: brainstorming → spec → writing-plans →
subagent-driven-development (frischer Implementer pro Task + Zwei-Stufen-Review)
→ HW-E2E → PR. Spec: [`docs/superpowers/specs/2026-06-04-backup-restore-design.md`](../docs/superpowers/specs/2026-06-04-backup-restore-design.md),
Plan: [`docs/superpowers/plans/2026-06-04-backup-restore.md`](../docs/superpowers/plans/2026-06-04-backup-restore.md).
Branch `feat/backup-restore`, **PR #7 gemergt** (Merge-Commit d72e5e8).

**Implementiert:**
- `WebUI` — `GET /api/backup` bündelt die 3 `/config`-Stores
  (`items_.serializeConfig()` Objekt, `store_.serialize()` Array,
  `settings_.serialize()` Objekt) zu einer JSON-Datei
  `{type,version,firmwareVersion,variant,registry,dashboards,settings}` mit
  `Content-Disposition`-Download. `POST /api/backup` (`AsyncCallbackJsonWebHandler`)
  validiert `type`/`version`/3 Sektions-Typen **vor** jedem Schreibzugriff,
  schreibt die Sektionen verbatim via `writeSection_` in die `/config`-Dateien,
  Reboot über `rebootAtMs_`. Restore = Replace-all + Reboot, reuse des
  Boot-Lade-Pfads (`loadFromSD`) — keine Store-Änderungen, keine neue
  Serialisierungslogik.
- Web — `downloadBackup()` (Blob-Download mit Datums-Dateiname) + `restoreBackup()`
  in `api.ts`; `BackupPage.tsx` (Export-Button, File-Import, `ConfirmModal`,
  „Neustart…"-View); Route `/settings/backup`; Settings-Kachel.

**Entscheidungen:** nur Config (kein WiFi); Ansatz A (verbatim schreiben + Reboot);
Server-Endpoint. Geräte-Zeitstempel als Zukunfts-Hook in der Spec (wartet auf das
„Zeit & Formate"-Feature).

**Review-Findings (übernommen):** File-Input-Reset bei Cancel/Error (sonst feuert
das erneute Wählen derselben Datei nicht), `kRebootDelayMs` statt Magic-500,
`serializeJson`-Rückgabe prüfen, klarere 500-Meldung bei Teil-Schreibfehler.
Eine stilistische Anmerkung (`confirmRestore` inline statt benannt) begründet
abgelehnt. Finaler Opus-Gesamt-Review: „Ready to merge".

**HW-E2E (LilyGo S3, neue Firmware per OTA aufgespielt):** Export → Theme-Akzent
als Canary auf `#123456` geändert → erfasstes Backup zurückgespielt (`200 ok`,
Reboot) → nach Reboot Akzent wieder `#d97706` (Restore verifiziert: settings.json
überschrieben + Boot-Load); Negativtest `{"foo":1}` → `400`, Config intakt. Kein
Bug gefunden. (Die BackupPage-UI selbst wurde nachträglich per `webui.tar` auf die
SD gespielt.)

## Session 2026-06-05 — SD-Boot-Firmware-Flash (Recovery-Pfad)

Vierter OTA-Weg neben Browser-Upload / GitHub-Pull / Auto-Check: eine
`/firmware.bin` im SD-Root wird beim nächsten Boot geflasht — funktioniert
**ohne WiFi** (Recovery / Erstinbetriebnahme).

**Implementiert:**
- `FirmwareUpdater::flashFromSdImage(path = "/firmware.bin")` — prüft `fs_.exists`,
  streamt die Datei in 1 KB-Blöcken durch `Update.begin(size)/write/end(true)`,
  löscht das Image und `ESP.restart()`. Guard gegen Reflash-Loop: schlägt das
  Löschen fehl, wird der Reboot übersprungen (neues Image ist bereits Boot-Target).
  Keine Versions-/Varianten-Prüfung — bewusst, damit Downgrade/Recovery geht.
- `main.cpp` — SD-Mount **vor** die WiFi-Logik gezogen (sonst kehrt das
  Setup-Portal bei fehlenden Creds nie zurück); direkt nach erfolgreichem Mount
  `firmwareUpdater.flashFromSdImage()`. Alter SD-Mount-Block nach mDNS entfernt,
  Boot-Flow-Kommentar aktualisiert.

**Verifikation:** `pio run -e esp32dev` SUCCESS (Flash 62.0 %, RAM 15.4 %).
HW-E2E am Gerät noch ausstehend.

---

## Session 2026-06-05 — UI-Fixes: PID-Regler Dashboard & AutoTune

Vier zusammenhängende UI-Fixes an `ControllerCard.tsx` und `AddItemModal.tsx`.
`pnpm typecheck` grün; keine HW-E2E nötig (reine Frontend-Änderungen).

**1. Aktor-Reset beim Ausschalten (`ControllerCard.tsx`)**

`toggleEnabled()` setzt nach `enableController(id, false)` alle verknüpften
Aktoren explizit auf den Minimalwert: single-Aktor auf `params.min ?? 0`,
dual heat/cool-Aktoren je auf `0`. Ohne diesen Reset blieb der letzte
PID-Ausgangswert im Aktor stehen.

**2. Setpoint nur im Dashboard**

Setpoint-Feld aus `AddItemModal` entfernt — war redundant (bereits im
Dashboard editierbar) und könnte beim delete+recreate-Edit-Mechanismus
einen unerwünschten Setpoint-Reset auslösen. Der `setpoint`-State und
die Übernahme in den `cfg`-Submit-Block bleiben erhalten (initiale
Konfiguration).

**3. AutoTune in Settings verschoben**

AutoTune-Controls (Methode-Selector, Starten/Abbrechen) aus
`ControllerCard` (Dashboard) in `AddItemModal` (Settings, Edit-Modus)
verschoben. Gründe: AutoTune läuft stundenlang; versehentliches Auslösen
während eines Braugangs vermeiden; Settings sind der natürliche Ort für
Parametrisierungs-Workflows. Gilt nur für `PID` und `SplitRangePID` beim
Bearbeiten — beim Neu-Anlegen kein AutoTune-Abschnitt. Save-Button im
Modal wird gesperrt solange `autotuneState === 'running'` (verhindert
Controller delete+recreate während laufendem AutoTune).

**4. AutoTune-Status implementiert**

Dashboard (`ControllerCard`): zeigt jetzt read-only-Status:
- `'running'` → amber „AutoTune läuft…"
- `'done'` → grüne Kp/Ki/Kd-Zeile (war schon teilweise vorhanden, bleibt)
- kein State / anderer Wert → kein UI-Element

Settings (`AddItemModal`): gleicher Status-Block + volle Steuerung.
`liveController` wird per `snap?.controllers.find(id)` aufgelöst —
`snap` wird bereits an das Modal übergeben, kein neuer Prop nötig.

**Geänderte Dateien:**
- `web/src/components/ControllerCard.tsx`
- `web/src/components/AddItemModal.tsx`

---

## 2026-06-06 — Datenlogging & Trend-Charts (Branch `feat/datalog`)

**Ausgangslage:** Zeit & Formate (NTP + `serverTime` im Snapshot) abgeschlossen — Voraussetzung für CSV-Timestamps. Design abgestimmt: Log-Config = Chart-Config, eine CSV pro Session mit gemeinsamem Zeitstempel, uPlot, standalone Logs mit Dashboard-Referenz.

**Phase 1 — Logging-Core (Firmware):**
- `LogStore.{h,cpp}`: Sampling der Registry in Sessions `/logs/<id>/<startEpoch>.csv`, Config in `/config/logs.json`. Serien-Refs `<rolle>/<snapshot-id>` (z.B. `sensor/bme280.temp`, `actuator/heizung`, `controller/maische`) lösen 1:1 gegen die Registry auf; Werte auf `meta.res` gerundet, ungültige Messung → leere Zelle; gewartet bis NTP gesynct.
- REST in `WebUI`: `GET/POST /api/logs`, `POST/DELETE /api/logs/:id`, `GET /api/logs/:id/data` + `/download`. Neuer `GetPrefixHandler` für GET mit Pfad-Param. `logs_.tick()` im bestehenden 1-Hz-`tick()`.

**Phase 2 — Chart-Frontend:**
- `pnpm add uplot`. `ChartCard` (uPlot): Hydration aus Session-CSV + Live-Append aus SSE-Snapshot (`serverTime` als x). Zentrale `LogsPage` (`/settings/logs`) + `LogEditorModal` (Serien aus Snapshot-Kanälen picken). `DashboardConfig.charts[]` (Firmware `DashboardStore` + Editor-Mehrfachauswahl + Render unter dem Grid).

**Phase 3 — Online-Kompression (deine `loggingkompression.md`):**
- `LogCompressor.h`: zwei reine, NaN-sichere C++-Filter — **Linear-Interpolation** und **Swinging Door** (= Bounding-Box/Sektor). Lockstep über alle Serien (gemeinsamer Zeitstempel; eine Zeile sobald eine Serie ihre Toleranz sprengt), Timeout-Stützpunkt (`maxGapSec`). Config: `algo` + `maxGapSec` + per-Serie `tol`. Editor-UI dafür.
- 12 native Unit-Tests (`test_log_compressor`): Plateau-Kollaps, Rampen-Ecke, Spike-Breakout, Timeout, kollineare Punkte, Multi-Serien-OR, NaN, flush.

**Phase 4 — Lifecycle & Retention:**
- Logging-Toggle (`enabled`) + Controller-Binding (`bindEnableTo` → `enabled` folgt `controller.enabled()`); Flush des gepufferten Punkts beim Deaktivieren.
- Clear/Session-Rotation (`POST /api/logs/:id/clear`), Archiv (`GET …/sessions`, session-Param für data/download, `DELETE …/sessions/<start>`), eigene `ArchivePage` (`/settings/logs/:id/archive`, read-only Chart pro Session).
- Globale Retention: 200 MB Budget über `/logs`, älteste (kleinster Start-Epoch) nicht-aktive Sessions zuerst gelöscht; `pruneToBudget_` bei Session-Anlage.

**Verifikation:** esp32dev SUCCESS (Flash ~63 %, RAM 15.5 %), `pnpm typecheck` 0 Fehler, 12/12 native Tests. **HW-E2E ausstehend** (keine Hardware verfügbar).

**Commits:** `b42bbac` (Phase 1–3) + Phase-4-Commit. Branch `feat/datalog`.

**Offen / Später:** API-Dezimierung (LTTB) für lange Archiv-Zeiträume; Live-Chart-Append an `intervalSec` angleichen (aktuell 1 Hz); `webui.tar` bleibt Build-Artefakt (nicht committed).

### HW-E2E auf LilyGo S3-AMOLED (2026-06-06)

Datalog-Feature end-to-end auf echter Hardware verifiziert (env `lilygo_t_display_s3_amoled`, COM7, WLAN/SD vorhanden, NTP gesynct → `serverTime` im Snapshot). Demo-Registry: Sensor `mlt`, Aktor `kettle`, keine Controller.

**Gefundener Bug (HW-only, gefixt):** `server_.on("/api/logs", HTTP_GET)` matcht in ESPAsyncWebServer auch Sub-Pfade (`/api/logs/:id/data` etc.) und war **vor** dem `GetPrefixHandler` registriert → `/data`, `/sessions`, `/download` lieferten die Log-Liste statt CSV/JSON. Fix: `GetPrefixHandler("/api/logs/")` vor die bare-GET-Liste registriert (Prefix-Handler ignoriert die slash-lose URL). Compile-Smoke konnte das nicht zeigen — nur HW-E2E.

**Verifiziert (alle grün):** NTP-Gating + echte Epoch-Timestamps; CSV-Header + Intervall + Leerzelle bei ungültiger Messung; Sessions-Liste + active-Flag + Session-Rotation bei Reboot; Dead-Band-Kompression (Swinging-Door-Log blieb 231 B über ~13 min konstant, `none`-Log wuchs alle 2s); `?session=`-Param für Archiv-CSV; Download-GET mit Content-Disposition; Schutz der aktiven Session vor Löschen; Löschen alter Sessions; enable-Toggle; clear/Rotation. UI per `webui.tar` über `/api/update/assets` eingespielt (ustar-Format nötig — Windows-bsdtar default „pax restricted" scheitert am `TarExtractor`).

**Offene Design-Frage:** Session-Rotation bei *jedem* Reboot — ein Stromausfall mitten im Braugang splittet das Log in zwei Sessions. Bewusst so (sessionStart ist runtime-only); evtl. später „jüngste Session fortsetzen wenn < N min alt".

### Playwright-UI-Tests Datalog-Frontend + Race-Condition-Fix (2026-06-07)

Browser-UI-Tests des Datalog-Frontends (Edge via Playwright-MCP) gegen `pnpm dev` (:5173 → ESP32 192.168.178.87, LilyGo S3-AMOLED auf COM7).

**Verifiziert (alle grün):** Dashboard mit Live-SSE (`mlt`/`kettle`); LogsPage listet Logs + rendert uPlot-Charts aus Session-CSV (Swinging-Door-Log sichtbar spärlichere Stützpunkte als `none`); LogEditorModal (Name/Intervall/Serien-Picker aus Live-Snapshot, Validierung, Kompressions-Dropdown blendet `maxGapSec` + per-Serie-`±tol` dynamisch ein); ArchivePage (Session-Liste mit Datum/Größe/active-Schutz, „Ansehen" → read-only Chart pro Session); Dashboard-Charts-Config (`DashboardConfig.charts` Mehrfachauswahl, Chart rendert unter dem Grid, persistiert nach `/api/dashboards`).

**Schwerer Bug gefunden + gefixt — Cross-Task-Race auf `logs_`:** Beim Anlegen eines Logs übers UI rebootete der ESP32 (~40 s; Ping ✓, HTTP tot; alle Sessions rotierten auf eine gemeinsame Boot-Epoch = Reboot-Beweis). Root Cause: die REST-Handler (AsyncTCP-Task) mutieren `std::vector<LogCfg> logs_` (`add`→`push_back`, `remove`→`erase`, …) **ohne Synchronisation** zum `loopTask`, der in `LogStore::tick()` jeden `loop()`-Durchlauf `for (auto& l : logs_)` iteriert. `push_back` mit Realloc gibt den alten Buffer frei, während `tick()` ihn liest → Use-after-free → Panic. Erklärt: 201-Response geht raus (`add()` fertig), Reboot *danach*; nur bei Realloc kritisch → `enable`/`clear` (In-Place) liefen in der HW-E2E „grün" trotz gleicher UB. Serial-Backtrace nicht erfassbar — S3 USB-CDC re-enumeriert beim Reset.

**Fix:** rekursiver FreeRTOS-Mutex (`xSemaphoreCreateRecursiveMutex`) als `LogStore`-Member, `ScopedLock` (RAII) am Anfang jeder Methode die `logs_` liest/mutiert (`load/saveToSD`, `serialize`, `add`, `update`, `remove`, `setEnabled`, `clear`, `serializeSessions`, `deleteSession`, `sessionPath`, `tick`). Rekursiv wegen `saveToSD`→`serialize`. [LogStore.h](firmware/src/LogStore.h) + [LogStore.cpp](firmware/src/LogStore.cpp).

**HW-verifiziert nach Reflash:** 4× `POST /api/logs` + 6× `DELETE` in Folge — kein Reboot, HTTP durchgehend 200, Boot-Session der Bestands-Logs stabil (nur neue Logs bekamen erwartungsgemäß eigene First-Sample-Sessions). Test-Logs danach gelöscht, Dashboard-Chart-Config zurückgesetzt → Ausgangszustand (nur `HW-Test-Raw` + `HW-SD`).

**Folge-Bug (Frontend, gefixt):** Das per-Serie-`±tol`-Feld im `LogEditorModal` ließ nur Ganzzahlen zu — ein controlled `<input type="number">` an numerischem State schrieb bei jedem Tastendruck `Number(value)` zurück; der Zwischenstand „0." liefert bei type=number `.value===""` → `0`, der Re-Render löschte den getippten Punkt („0.5" → „5"). Betraf beide Algorithmen (bei `fill_form` im ersten Test umgangen → unbemerkt). Fix: Toleranz als **String-State** halten (Zwischenstände überleben), `type="text" inputMode="decimal"`, Parse erst beim Submit inkl. deutschem Komma (`parseFloat(s.replace(',', '.'))`, Clamp ≥0). [LogEditorModal.tsx](web/src/components/LogEditorModal.tsx). Browser-verifiziert: „0.5" bleibt erhalten, „1,5" → `tol:1.5` auf dem Gerät.

### Chart-Fixes nach User-Feedback (2026-06-07)

Vier vom User gemeldete Chart-Probleme — Root Causes per Live-uPlot-Introspektion (`__u`-Debughook) gefunden, gefixt, am Gerät verifiziert.

1. **Zeitformat/Sekunden:** uPlot nutzte sein Default-Achsenformat (12h AM/PM, keine Sekunden), ignorierte die App-Zeiteinstellung. Fix: `ChartCard` lädt die Zeit-Settings (neuer gecachter `loadTimeSettings()` in [time.ts](web/src/time.ts)) und formatiert X-Achse (`axes[0].values` → `formatTime`, mit Sekunden) + Legenden-Zeit (`series[0].value` → `formatDateTime`) selbst. Achse zeigt jetzt z.B. `17:15:45`, Legende `07.06.2026 17:15:45`. (Datum nur noch in der Legende, nicht mehr als Achsen-Unterzeile.)
2. **Aktoren/Regler nicht live (erst nach Refresh):** `parseCsv` splittete auf `\n`, die Firmware schreibt aber CRLF (`println`) → die **letzte** CSV-Spalte trug ein `\r`. Der Header-Ref wurde zu `"…\r"`; `resolveRef` fand die Registry-id nicht → Live-Append schrieb `null` (CSV-Hydration tolerierte `\r` via `Number()`, daher OK nach Reload). Da die letzte Serie meist Aktor/Regler ist → genau das Symptom. Fix: `text.trim().split(/\r?\n/)` in [api.ts](web/src/api.ts).
3. **Linie überbrückt Logging-Pause:** Beim Stopp wurde kein Marker geschrieben → letzter Wert vor Stopp mit erstem danach verbunden. Fix zweiteilig: Firmware schreibt beim `eff`-`true→false`-Übergang eine **Leerzeile** (alle Zellen NaN) bei `sessionStart>0` ([LogStore.cpp](firmware/src/LogStore.cpp)); Frontend stoppt das Live-Anhängen bei `!log.enabled` und schiebt beim Übergang einen `null`-Punkt ein. Beides bricht die uPlot-Linie (`spanGaps:false`). HW-verifiziert: Regler aus/an → CSV-Leerzeile `…531,,,` zwischen den Werten, Chart bricht sauber.
4. **Interpolierte Hover-Werte (User-Frage):** Die Legende zeigte den nächstgelegenen Stützpunkt. Jetzt zeigt sie den **linear interpolierten** Wert an der exakten Cursor-X-Position (`series[i].value` → `interpAt()`, Binärsuche + Lerp, `null` über Gaps) — passend, da beide Kompressionsalgorithmen linear rekonstruieren.

**Hinweis:** Frontend-Fixes greifen erst nach `pnpm build` + Asset-Deploy (`webui.tar` → `/api/update/assets`) auf dem Gerät; Dev-Server (`pnpm dev`) hat sie sofort. Firmware-Fix (#3) ist auf den LilyGo S3 geflasht.

### Netzwerk/WLAN-Einstellungen (2026-06-07)

Neue Settings-Seite `/settings/network` „über das Captive-Portal hinaus" (Roadmap Welle 3). Scope nach Rücksprache: **STA-Features only** (AP-Modus bewusst verschoben — ohne Internet kein NTP → bricht das frische Datalog; ggf. später mit RTC). Statische IP ausgeklammert.

**Firmware:**
- `GET /api/network` — STA-Status (`connected`/`ssid`/`ip`/`rssi`/`mac`) + konfigurierter `hostname` aus NVS. `GET /api/network/scan` — async Scan (202 läuft → 200+JSON), gleiche Mechanik wie das Captive-Portal. `POST /api/network` — `{ssid,password}` und/oder `{hostname}` → NVS schreiben + Reboot (Creds/Hostname greifen erst beim Boot). Ein gemeinsamer `GetPrefixHandler("/api/network")` dispatcht GET-Status vs. `/scan` (bare `server_.on` würde via `Type::BackwardCompatible` `^uri(/.*)?$` den Sub-Pfad schlucken — gleiche Falle wie beim Logs-Fix). [WebUI.cpp](firmware/src/WebUI.cpp).
- **Hostname konfigurierbar:** war fix `kHostname="brewcontrol"`, jetzt aus NVS `brewctrl/hostname` (Default `kHostname`). `connectStation()` ruft `WiFi.setHostname()` vor `WiFi.begin()` (DHCP), `MDNS.begin(hostname)`. [main.cpp](firmware/src/main.cpp). Validierung `validHostname()` (1–32, lowercase alnum + Bindestrich, kein führender/abschließender). Hostname liegt im NVS bei den WLAN-Creds (Netzwerk-Identität, früh verfügbar, überlebt SD-Probleme) — **nicht** im Backup (konsistent mit „Backup = nur Config, kein WiFi").

**Frontend:**
- [NetworkPage.tsx](web/src/pages/NetworkPage.tsx): Status-Karte (Signal-Balken aus RSSI + dBm, IP, `hostname.local`, MAC); „WLAN wechseln" (Scan → dedupliziertes/sortiertes SSID-Dropdown + Passwort → ConfirmModal → Reboot-Screen); „Hostname" (Inline-Validierung spiegelt die Firmware-Regel, Speichern nur bei Änderung); „WLAN zurücksetzen" (hierher verschoben). Eigener Reboot-Vollbild-Status pro Aktion (Wechsel/Rename/Reset mit passendem Text).
- `getNetwork`/`scanNetworks` (Poll-Schleife wie Portal)/`setNetwork`/`setHostname` in [api.ts](web/src/api.ts); `NetworkStatus`/`ScanNetwork` in [types.ts](web/src/types.ts); Route + Nav-Eintrag.
- **„Reset WiFi" aus dem Dashboard-Header entfernt** (jetzt in der Netzwerk-Seite) → App-`rebooting`/`RebootingView` + Dashboard-`onReset`/`ConfirmModal`-Import wurden dadurch verwaist und mit-entfernt. [Dashboard.tsx](web/src/pages/Dashboard.tsx), [app.tsx](web/src/app.tsx).

**Verifikation:** esp32dev SUCCESS (Flash 63.6 %, RAM 15.5 %), `pnpm typecheck` 0 Fehler.

**HW-Vorfall + Härtung (2026-06-07):** Erster HW-Test: Hostname-Wechsel ✓, WLAN-Reset ✓ (Reconnect über `brewcontrol.local` ✓). Aber **Klick auf „Scan" im laufenden STA-Betrieb killte die WLAN-Verbindung** → Gerät unerreichbar, kam erst per **Power-Cycle** zurück (Serial zeigte nichts → kein Crash; der Boot-Banner wird nur beim Boot ausgegeben, das Gerät lief in `loop()` weiter, nur ohne Netz). Ursache: `WiFi.scanNetworks()` im verbundenen STA hoppt über die Kanäle, die Verbindung kam ohne Reboot nicht zurück (bekannt fragile Kombi ESP32-Scan + AsyncWebServer). Scan kurz entfernt, dann auf Userwunsch wieder rein — **mit Härtung statt Entfernung:**
- **WLAN-Watchdog** in `loop()` ([main.cpp](firmware/src/main.cpp) `maintainWiFi()`): STA down → nach 10 s `WiFi.reconnect()`, nach 60 s `ESP.restart()` (Boot reconnectet oder öffnet Portal). Self-Healing gegen Aussperren — egal ob Scan, AP-Reboot oder Funkloch. Plus `WiFi.setAutoReconnect(true)` in `connectStation()`.
- **Sanfterer Scan:** `WiFi.scanNetworks(async, hidden=false, passive=false, 100ms/Kanal)` (Default 300) — kürzere Verweildauer.
- **Resilienter Poll:** `scanNetworks()` in [api.ts](web/src/api.ts) bricht bei transientem Fetch-Fehler nicht mehr ab, sondern pollt weiter; Scan-Fehler im UI schaltet automatisch auf **manuelle SSID-Eingabe** (Toggle „Netzwerk manuell eingeben", auch für versteckte Netze). [NetworkPage.tsx](web/src/pages/NetworkPage.tsx).

Nach Härtung: esp32dev SUCCESS, `pnpm typecheck` 0 Fehler.

**HW-E2E grün (2026-06-07, LilyGo S3-AMOLED, COM7):** Firmware geflasht + Frontend per `webui.tar` (ustar) deployt. `GET /api/network` ✓ (connected, IP, RSSI, MAC, hostname). **Gehärteter Scan reproduziert das Lock-out *nicht* mehr:** Scan-Kickoff 202 → Ergebnis nach 1 s (5 Netze, signal-sortiert); Erreichbarkeit unmittelbar danach 10×/20 s durchgehend HTTP 200 — **kein** Verbindungsabriss (kürzere 100-ms-Dwell macht den Scan unauffällig, Watchdog als Netz). Hostname-Wechsel + WLAN-Reset bereits im ersten Test verifiziert.

**mDNS-Diagnose + Härtung (2026-06-07):** Nach dem Deploy schien `brewcontrol.local` „tot" (ping/curl scheiterten), die IP lief aber. Ursache war **kein** Geräte-Bug, sondern **Windows-Negativ-DNS-Cache**: eine mDNS-Anfrage lief während des `TarExtractor`+`/www`-Swaps (loopTask kurz blockiert) in den Timeout, Windows cachte das NXDOMAIN (~15 min). Beweis: `Resolve-DnsName` löste durchgehend korrekt auf, `ipconfig /flushdns` stellte ping/curl/Browser-Pfad sofort wieder her (3×/3× HTTP 200). Der ESP-Responder war immer gesund. **Latentes Risiko trotzdem geschlossen:** ESP32-mDNS überlebt einen WiFi-Reconnect i. d. R. nicht — und der neue Watchdog macht Reconnects wahrscheinlicher. Fix: `WiFi.onEvent(STA_GOT_IP)` → `startMDNS()` (`MDNS.end()`+`begin(hostname_)`) re-announced mDNS bei jedem (Re-)Connect ([main.cpp](firmware/src/main.cpp)). Nach Flash verifiziert: mDNS frisch hoch (4×/4× HTTP 200 über `brewcontrol.local`). Reconnect-Survival nur code-verifiziert (kein API-Weg, die STA gezielt zu trennen).

**Watchdog zu aggressiv → AP-Falle bei Router-Reboot (2026-06-08, gefixt):** Beim Testen des mDNS-Reconnects startete der User den Router neu — das Gerät landete im **Setup-AP**. Kette: Router weg → Watchdog rebootete schon nach **60 s** → Boot-`connectStation` (30 s Timeout) lief, während die FRITZ!Box noch hochfuhr → Portal-Fallback (`runUntilConfigured` blockiert für immer) → im AP gestrandet, obwohl Creds korrekt. Auto-Reconnect hätte den kurzen Ausfall sonst überbrückt. **Fix** ([main.cpp](firmware/src/main.cpp)): (1) Watchdog entschärft — Nudge alle 30 s, `ESP.restart()` erst nach **5 min** Dauerverlust (Router-Reboot ist da längst durch, bleibt in STA); (2) Boot **wiederholt** den Connect 6×30 s (~3 min), bevor das Portal kommt — ein Reboot während eines transienten Ausfalls strandet nicht mehr im AP. Recovery des gestrandeten Geräts: simpler Power-Cycle (Creds bleiben erhalten, Portal-Fallback löscht sie nicht). esp32dev SUCCESS; geflasht + HW-verifiziert: Gerät nach Flash sofort wieder in STA (mDNS + IP je HTTP 200).
