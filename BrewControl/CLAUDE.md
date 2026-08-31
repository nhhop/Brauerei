# CLAUDE.md — BrewControl

> **Hinweis:** Das Root-`CLAUDE.md` wird zuerst geladen und enthält die gemeinsamen Verhaltensrichtlinien (Think Before Coding, Simplicity First, Surgical Changes, Goal-Driven Execution). Dieses File enthält nur BrewControl-spezifischen Kontext.

## Projekt

BrewControl ist der Web-UI Consumer der SensActCtrl-Library (`../SensActCtrl/`). Es fügt HTTP + SSE Transport sowie eine Preact-SPA hinzu — keine neue Domain-Logik. Die Library ist frontend-agnostisch; `serializeRegistry()` liefert bereits das vollständige JSON-State.

**Status:** MVP (11 Build-Steps) abgeschlossen, E2E verifiziert auf LOLIN S2 Mini und LilyGo T-Display-S3-AMOLED-1.43. Details in `PLAN.md` und `SESSION.md`.

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

Fixiert in `PLAN.md`. Snapshot-Shape kommt aus `RegistrySnapshot.h` — `web/src/types.ts` spiegelt diese Form, kein paralleles Schema erfinden.

| Endpoint | Methode |
|----------|---------|
| `/api/snapshot` | GET |
| `/api/events` | GET (SSE) |
| `/api/actuators/:id` | POST `{"v":<float>}` |
| `/api/controllers/:id/setpoint` | POST `{"v":<float>}` |
| `/api/controllers/:id/params` | POST `{...}` |
| `/api/sensors` | POST / DELETE `:id` |
| `/api/admin/wifi-reset` | POST |

## Commands

```powershell
# Firmware (in firmware/)
pio run -e esp32dev              # compile-smoke
pio run -e esp32dev -t upload    # flash
pio device monitor               # serial @ 115200

# Web (in web/)
pnpm install
pnpm dev           # HMR :5173, /api → ESP32 (VITE_ESP_HOST in .env.local)
pnpm build         # → web/dist/, auf SD-Karte kopieren
pnpm typecheck
```

## Arbeitsregeln

- ESPAsyncWebServer-Dep ist auf `esp32async/`-Org gepinnt (post-Migration von `me-no-dev/`): `esp32async/ESPAsyncWebServer@^3.1.0` + `esp32async/AsyncTCP@^3.2.0`.
- `types.ts` immer mit `RegistrySnapshot.h` synchron halten — bei Library-Änderungen prüfen.
- SD-Pins für LilyGo T-Display-S3-AMOLED-1.43: CS=38, SCK=41, MOSI=39, MISO=40 (GPIO 33–37 durch OPI-PSRAM belegt).
- esp32dev/lolin_s2_mini nutzen LittleFS (kein SD-Slot) statt SD: `BREWCTL_USE_LITTLEFS`-Build-Flag,
  Partitionstabelle `partitions_4mb_littlefs.csv` (256 KB Datenpartition, siehe PLAN.md/README.md).
  `firmware/data/www/` enthält nur die gzippten UI-Assets (nicht die unkomprimierten Originale —
  ESPAsyncWebServer serviert .gz transparent); Deploy über `pio run -t uploadfs`, nicht Netzwerk-Upload.
- Plan / Status / Entscheidungen leben in `PLAN.md` und `SESSION.md` (ältere, abgeschlossene Einträge in `SESSION-archive.md`).
- Gefundene, aber bewusst nicht sofort gefixte Bugs/Einschränkungen (Out-of-Scope, Library-seitig statt BrewControl-seitig, o.ä.) immer zusätzlich zum SESSION.md-Eintrag in `PLAN.md` → „Bekannte Probleme" eintragen, statt nur im Session-Log zu vergraben.
- Wird ein solcher Eintrag später gefixt: **nicht** mit vollem Absatz in `PLAN.md` stehen lassen — das dupliziert den SESSION.md-Eintrag und lässt `PLAN.md` (Status-Dokument, keine Historie) unbegrenzt wachsen. Stattdessen auf eine Zeile kürzen (`~~Titel~~ — gefixt <Datum>, Details: SESSION.md`) und nach ein paar Sessions ganz entfernen. Die volle Erklärung (Root Cause, Umsetzung, Verifikation) lebt ausschließlich in `SESSION.md`.
