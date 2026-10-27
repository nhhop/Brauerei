# CLAUDE.md — BrewControl

> **Hinweis:** Das Root-`CLAUDE.md` wird zuerst geladen und enthält die gemeinsamen Verhaltensrichtlinien (Think Before Coding, Simplicity First, Surgical Changes, Goal-Driven Execution). Dieses File enthält nur BrewControl-spezifischen Kontext.

## Projekt

BrewControl ist der Web-UI Consumer der SensActCtrl-Library (`../SensActCtrl/`). Es fügt HTTP + SSE Transport sowie eine Preact-SPA hinzu — keine neue Domain-Logik. Die Library ist frontend-agnostisch; `serializeRegistry()` liefert bereits das vollständige JSON-State.

**Status:** MVP + Laufzeit-Item-Add/Remove + Datenlogging + Sollwert-Programme + MQTT/Webhook/ESP-NOW + WinUI-3-Redesign, alle drei Boards hardware-verifiziert. Details in [`../PLAN.md`](../PLAN.md) (Root) und [`../SESSION.md`](../SESSION.md); Architektur-/API-Referenz in [`README.md`](README.md).

## Architektur

**`firmware/`** — PlatformIO, Arduino, C++17, ESPAsyncWebServer
- `main.cpp` — Boot, WiFi (Preferences), Demo-Registry, SD-Init, WebUI-Start
- `WebUI.h/cpp` — `/api/snapshot`, `/api/events` (SSE), POST/DELETE-Handler, SD-Static-Serve
- `WiFiSetupPortal.h/cpp` — Captive-Portal AP bei Erstinbetriebnahme / BOOT-Button-Hold
- `DynamicItems.h/cpp` — Laufzeit-Add/Remove von Sensoren/Aktoren/Reglern + SD-Persistenz

**`web/`** — Vite 7, Preact 10, Tailwind CSS 4, TypeScript, pnpm
- `app.tsx` — Dashboard (SSE-Subscription, 3-Spalten-Grid)
- `api.ts` — Fetch + EventSource Wrapper
- `types.ts` — TypeScript-Interfaces, spiegeln `RegistrySnapshot.h` (nicht abweichen!)
- `components/` — SensorCard, ActuatorCard, ControllerCard, ConfirmModal, AddItemModal

**lib_dep:** `firmware/platformio.ini` → `symlink://../../SensActCtrl` (kein Publish-Umweg)

## API-Vertrag

Fixiert in [`docs/openapi.yaml`](docs/openapi.yaml) (OpenAPI 3.1, Single Source of Truth) — [`README.md`](README.md) führt nur die Routen-Übersichtstabelle. Snapshot-Shape kommt aus `RegistrySnapshot.cpp` — `web/src/types.ts` spiegelt diese Form, kein paralleles Schema erfinden.

## Commands

```powershell
# Firmware (in firmware/)
pio run -e lilygo_t_display_s3_amoled              # compile-smoke
pio run -e lilygo_t_display_s3_amoled -t upload    # flash
pio device monitor               # serial @ 115200

# Web (in web/)
pnpm install
pnpm dev           # HMR :5173, /api → ESP32 (VITE_ESP_HOST in .env.local)
pnpm build         # → web/dist/, auf SD-Karte kopieren
pnpm typecheck
```

## Arbeitsregeln

- ESPAsyncWebServer-Dep ist auf `esp32async/`-Org gepinnt (post-Migration von `me-no-dev/`): `esp32async/ESPAsyncWebServer@^3.1.0` + `esp32async/AsyncTCP@^3.2.0`.
- **`IdsInductionCooker` kommt ausschließlich über `SensActCtrl/library.json`** (Git-URL + SHA).
  Kein lokaler Checkout nötig, kein Sibling, kein Submodul — PlatformIO holt die Library selbst.
  **Arbeiten daran:** in einem beliebigen eigenen Klon des Library-Repos editieren, dort
  committen und pushen, danach den SHA in `SensActCtrl/library.json` bumpen. Erst dieser Bump
  wirkt sich auf den Build aus.
  **Warum nicht zusätzlich per `symlink://` einbinden:** PlatformIO befolgt den URL-Eintrag
  bedingungslos. Lag die Library zusätzlich als Symlink (oder als Submodul unter `lib/`) vor,
  wurde eine **zweite** Kopie nach `libdeps` geholt, **beide** kompiliert, und die gefetchte im
  Link-Kommando **nach vorn** gesetzt — ausgeliefert wurde also der gepinnte SHA, während
  Änderungen am lokalen Arbeitsbaum stillschweigend verfielen. Erfolglos geprüft (2026-09-23):
  Namen angleichen, `lib_ignore`, Platzierung unter `lib/`, `lib/` plus Umbenennung.
  `symlink://../../SensActCtrl` ist davon nicht betroffen — SensActCtrl wird von niemandem
  zusätzlich per URL deklariert.
- Jede Änderung an einer HTTP-Route in `firmware/src/WebUI.cpp` — neuer Endpoint, neuer Body-Key,
  geänderter Status-Code oder Fehlertext, geänderte Response-Shape — **im selben Commit** in
  [`docs/openapi.yaml`](docs/openapi.yaml) nachziehen; kommt eine Route dazu oder fällt eine weg,
  zusätzlich die Übersichtstabelle in `README.md`. Ändert sich eine Response-Shape, auch
  `web/src/types.ts` prüfen. Verifikation:
  `npx @redocly/cli lint --config BrewControl/docs/redocly.yaml BrewControl/docs/openapi.yaml`.
- `types.ts` immer mit `RegistrySnapshot.h` synchron halten — bei Library-Änderungen prüfen.
- SD-Pins für LilyGo T-Display-S3-AMOLED-1.75: CS=38, SCK=41, MOSI=39, MISO=40 (GPIO 33–37 durch OPI-PSRAM belegt).
- Display-Hardware desselben Boards (am Gerät verifiziert 2026-09-22):
  rundes 466×466-AMOLED auf **CO5300** über QSPI (CS 10, SCLK 12, D0 11, D1 13, D2 14, D3 15,
  RST 17, EN 16), Touch **CST9217** auf I²C 0x5A (SDA 7 / SCL 6, geteilt mit PCF8563 0x51 und
  SY6970 0x6A). Maßgeblich ist LilyGos `libraries/Mylibrary/pin_config.h`, **nicht** die
  README-Tabelle — die beschreibt nur die 1.43 (SH8601 + FT3168). ⚠ `Wire` steht auf diesem
  Variant per Default auf SDA 18 / SCL 17, und GPIO 17 ist der Panel-Reset. Deshalb startet
  `main.cpp` `Wire` als Allererstes auf `BREWCTL_I2C_SDA/SCL`.
- **Waveshare ESP32-S3-Touch-AMOLED-1.75** (`waveshare_s3_amoled_175`, seit 2026-10-07, am
  Gerät seit 2026-10-19 geprüft): gleicher Chip und gleiches Panel wie das LilyGo, andere Pins —
  QSPI CS 12, SCLK 38, D0–D3 4–7, RST 39, **kein** EN-Pin; Touch CST9217 0x5A (INT 11, RST 40);
  I²C SDA 15 / SCL 14 mit QMI8658 0x6B (normales Item), PCF85063 0x51, AXP2101 0x34, ES8311
  0x18, ES7210 0x40, TCA9554 0x20; SD per **SDMMC 1-Bit** (CLK 2, CMD 1, D0 3,
  `BREWCTL_SD_MMC_*`). Quelle: Waveshares `pin_config.h`/`HARDWARE_REFERENCE.md`.
- **M5Stack StopWatch** (`m5stack_stopwatch`, seit 2026-10-07, am Gerät noch nicht geprüft):
  gleicher Chip und gleiches Panel, **kein SD** (LittleFS, 3,4 MB). Maßgeblich ist der
  StopWatch-Code in **M5GFX** (`src/M5GFX.cpp`) und M5Unified, **nicht** docs.m5stack.com — die
  Doku nennt GPIO 38 (TE) als D0. QSPI CS 39, SCLK 40, D0–D3 41/42/46/45; Panel-Reset,
  -Versorgung und Touch-Reset hängen am Expander **M5IOE1** (0x4F), Watchdog und 3,3-V-Rails am
  **M5PM1** (0x6E) — beides in `src/BoardInit.cpp`, vor dem Display. Touch CST820 (0x15,
  `TouchDrvCST816`) mit halber Auflösung. I²C SDA 47 / SCL 48, BMI270 0x68 als normales Item.
- **Board-Auswahl per Build-Flag**: `BREWCTL_BOARD_LILYGO_AMOLED`,
  `BREWCTL_BOARD_WAVESHARE_AMOLED175` bzw. `BREWCTL_BOARD_M5_STOPWATCH` wählen Pin-Tabelle und festen Bus (`BoardPins.h`) und die
  Display-Pins (`DisplayUI.cpp`). Ein Target-Build ohne Flag bricht mit `#error` ab; seit Arduino
  Core 3 gibt es nur noch S3-Boards. Die Tabellen von esp32dev und lolin_s2_mini liegen als
  Test-Fixture in `firmware/test/TestBoards.h` (sie decken DAC, Input-only-Pins, ADC2 und Errata ab).
  `BREWCTL_ASSETS_IN_PLACE` samt Notfall-Upload-Seite bleibt bewusst im Code, ohne Env.
- Das Display wird seit 2026-09-24 angesteuert, Code in `src/display/`: `DisplayUI` übernimmt
  Panel, Touch und LVGL, `DisplayPages` die Inhalte. Alles steht hinter `BREWCTL_HAS_DISPLAY`.
  Einen Überblick gibt `README.md` → „Rundes Touch-Display“. Regeln:
  - **LVGL läuft aus `loop()`**, im selben Task wie `registry.tick()`. Touch-Aktionen rufen die
    Registry direkt auf. Über einen Refresh hinaus **keine Item-Zeiger halten**, weil der
    AsyncTCP-Task Items jederzeit löschen darf.
  - Nie einen Neuaufbau aus dem Event eines Objekts heraus starten, das dabei gelöscht wird.
    Stattdessen `lv_async_call` oder den Refresh-Timer nehmen.
  - Bei eingerastetem Not-Aus ist das Display komplett gesperrt. Die Besitz-Regeln
    (Regler/Programm) spiegeln `web/src/ownership.ts`.
  - Panel-Treiber ist ausschließlich `vendor/Arduino_GFX-1.3.7` (gekürzt, Quellen unverändert).
    **Keinen eigenen CO5300-Treiber schreiben:** Der Spike vom 2026-09-22 bekam damit trotz
    identischer Init-Sequenz kein Bild.
  - Umlaute gibt es nur mit den eigenen Fonts in `src/display/fonts/`; die eingebauten
    `lv_font_montserrat_*` haben keine. Wie man die Fonts neu erzeugt, steht im README dort.
  - Jede Seite belegt LVGL-Pool (`LV_MEM_SIZE` 32 KB im PSRAM über `LV_MEM_POOL_ALLOC`, etwa 1,5 KB pro Seite). Ist der Pool
    voll, endet das im Watchdog-Reboot. Deshalb gilt die Grenze `kMaxPages`.
  - Ist das Display schwarz (Burn-in-Schutz), läuft `lv_timer_handler()` nicht. Auch die
    Timer von `DisplayPages` stehen dann still und laufen erst nach dem Aufwecken nach.
    Nichts, was ohne Display weiterlaufen muss, gehört in einen LVGL-Timer.
  - **Wecken bei Bewegung** (`DisplayUI::motionWake_()`) liest den Kanal `motion` des
    `orientationSensor`-Items alle 250 ms direkt aus der Registry — nicht aus einem
    LVGL-Timer, weil der bei schwarzem Display steht. Der Kanal muss im Item gewählt sein
    (kein eingebauter Zwang, damit die Kanalwahl die einzige Quelle bleibt).
  - Den Touch nur über `readTouch()` bzw. `noteTouch()` in `DisplayUI.cpp` lesen. Jeder
    `getTouchPoints()`-Aufruf quittiert den Frame, ein zweiter Leser sieht leere Frames.
  - **Drehung** (`display.rotation`/`orientationSensor`, seit 2026-10-07) passiert nur in
    `DisplayUI.cpp`: LVGL kennt sie nicht und rendert aufrecht; `flush()` dreht beim Blit,
    `readTouch()` dreht zurück (`DisplayOrientation.h`). Seiten-Code muss nichts davon wissen.
    Der `rounder()` bleibt gültig, weil 465 ungerade ist — bei einem Panel mit gerader
    Kantenlänge nicht mehr.
- `m5stack_stopwatch` nutzt LittleFS (kein SD-Slot) statt SD: `BREWCTL_USE_LITTLEFS`-Build-Flag,
  Datenpartition 3,4 MB aus `default_16MB.csv`. `firmware/data/www/` enthält nur die gzippten
  UI-Assets, **ohne `modules/`**: `pnpm build:lfs` (in `web/`) baut und legt das so ab. Deploy über
  `pio run -e m5stack_stopwatch -t uploadfs` (USB), `POST /api/update/assets` oder „Installieren“
  mit dem schlanken `webui.tar` (Auswahl in `FirmwareUpdater::fetchReleaseMeta`). Upload und
  „Installieren“ teilen sich die Logik in `src/AssetInstall.h` — dort ändern, nicht in einem der
  beiden Aufrufer. Seit esp32dev und lolin_s2_mini entfernt sind (Arduino Core 3, 2026-10-27),
  setzt kein Env mehr `BREWCTL_ASSETS_IN_PLACE` (`/www` vor dem Entpacken leeren, für die frühere
  256-KB-Partition); der Code dafür steht noch.
- Plan / Status / Entscheidungen leben im Root-`PLAN.md`/`SESSION.md`/`SESSION-archive.md` — nicht mehr lokal (siehe Root-`CLAUDE.md` → Dokumentation).
- Gefundene, aber bewusst nicht sofort gefixte Bugs/Einschränkungen (Out-of-Scope, Library-seitig statt BrewControl-seitig, o.ä.) immer zusätzlich zum Root-SESSION.md-Eintrag im Root-`PLAN.md` → „Bugs & bekannte Einschränkungen" eintragen, statt nur im Session-Log zu vergraben.
- Wird ein solcher Eintrag später gefixt: den Punkt **ersatzlos aus `PLAN.md` entfernen** (kein durchgestrichener „erledigt"-Eintrag, keine Pointer-Zeile) und stattdessen einen SESSION.md-Eintrag mit Root Cause / Umsetzung / Verifikation anlegen. `PLAN.md` führt nur Offenes.
