# Brauerei Session-Log

Cross-Projekt-Log für Arbeiten, die beide Subprojekte betreffen.  
Projekt-spezifische Sessions: `SensActCtrl/session.md`, `BrewControl/SESSION.md`

---

## 2026-05-18 — Monorepo-Setup

**Ausgangslage:** BrewControl und SensActCtrl als zwei getrennte Ordner ohne gemeinsames git-Repo, je eigene CLAUDE.md/PLAN.md/SESSION.md.

**Ziel:** Einheitliche Entwicklungsumgebung (ein Repo, koordinierte Dokumentation), ohne Dateien zu verschieben.

**Durchgeführte Änderungen:**
- `git init` in `Brauerei/`
- `.gitignore` angelegt (`.pio/`, `node_modules/`, `web/dist/`, `.env.local`, `.claude/settings.local.json`)
- `.claude/settings.json` auf Root-Ebene (alle 6 Plugins, Superset aus beiden Sub-Projekten)
- `CLAUDE.md` auf Root-Ebene (gemeinsame Verhaltensrichtlinien + Monorepo-Überblick)
- `PLAN.md` auf Root-Ebene (Systemarchitektur-Überblick + Status)
- `SESSION.md` auf Root-Ebene (diese Datei)
- `SensActCtrl/CLAUDE.md` auf projekt-spezifische Infos gekürzt (Richtlinien → Root)
- `BrewControl/CLAUDE.md` auf projekt-spezifische Infos gekürzt (Richtlinien → Root)

**Kein Änderungsbedarf:** `BrewControl/firmware/platformio.ini` — `symlink://../../SensActCtrl` funktioniert bereits korrekt im Monorepo.

**Status nach Setup:** Beide Projekte vollständig im Repo, kompilier- und testbar wie zuvor.

---

## 2026-05-20 — Bus-Discovery-Feature (OneWire / DS18B20)

**Ausgangslage:** BrewControl unterstützte beim dynamischen Hinzufügen von DS18B20-
Sensoren nur Einzelsensor-Konfigurationen (nur Pin, keine ROM-Adresse). OneWire
erlaubt mehrere Sensoren auf einem Pin — diese sind ohne 64-bit-ROM-Adresse nicht
unterscheidbar.

**Änderungen in beiden Projekten:**

- `SensActCtrl/src/sensors/DS18B20Sensor.{h,cpp}`: neues `static scanBus(pin, out,
  maxDevices)` — enumeriert ROM-Adressen aller Geräte auf dem Bus.
- `BrewControl/firmware/src/DynamicItems.{h,cpp}`: Shared-Bus-Management
  (`onewireBuses_`), optionales `address`-Feld im DS18B20-Factory-Pfad,
  `parseHexAddress`-Helper.
- `BrewControl/firmware/src/WebUI.{h,cpp}`: neuer `GET /api/bus/scan?type=onewire&pin=N`.
- `BrewControl/web/src/`: `ScannedDevice`/`BusScanResult`-Types, `scanOneWireBus()`
  in `api.ts`, Scan-UI in `AddItemModal.tsx`.

**Wire-Format** des neuen Endpoints:
```json
GET /api/bus/scan?type=onewire&pin=4
→ {"type":"onewire","pin":4,"devices":[{"index":0,"address":"28ff64c8815604ef"},…]}
```

**Rückwärtskompatibel:** `POST /api/sensors {"type":"DS18B20","id":"x","pin":4}` ohne
`address`-Feld funktioniert weiterhin (Einzel-Bus-Modus).

Details: `BrewControl/SESSION.md`.

---

## 2026-05-20 — Playwright / Edge-Setup für Browser-UI-Tests

**Kontext:** Browser-UI-Test des Bus-Discovery-Features (AddItemModal + Delete-Button)
war nach dem Bus-Discovery-Feature als offen markiert. Erster Versuch in dieser Session.

**Problem:** Das Playwright-MCP-Plugin (`@playwright/mcp@latest`) ist per Default auf
`--browser chrome` konfiguriert und erwartet Chrome unter
`C:\Users\nhhop\AppData\Local\Google\Chrome\Application\chrome.exe`. Chrome ist auf
diesem System nicht installiert; Admin-Rechte für die System-Installation fehlen.

**Lösung (durchgeführt, wirksam nach Neustart):**

Beide `.mcp.json`-Dateien auf `--browser msedge` umgestellt — Edge ist unter
`C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe` installiert und von
Playwright direkt unterstützt:

- `C:\Users\nhhop\.claude\plugins\marketplaces\claude-plugins-official\external_plugins\playwright\.mcp.json`
- `C:\Users\nhhop\.claude\plugins\cache\claude-plugins-official\playwright\unknown\.mcp.json`

Geändert: `"args": ["@playwright/mcp@latest"]` → `"args": ["@playwright/mcp@latest", "--browser", "msedge"]`

**Wichtig:** Konfigurationsänderungen am MCP-Server werden erst nach einem Claude-Code-Neustart
wirksam. Ein Kill des laufenden Node-Prozesses während der Session trennt die Tools
dauerhaft für diese Session (kein Auto-Reconnect).

**Seiteneffekte bereinigt:**
- Temporäres `C:\Users\nhhop\AppData\Local\Google\Chrome\Application\chrome.exe`
  (Kopie von `msedge.exe`) wurde wieder gelöscht — war ein fehlgeschlagener Workaround.

**Browser-UI-Test durchgeführt (2026-05-20, nach Neustart):**

| Test | Resultat |
|---|---|
| Dashboard lädt mit ESP32-Daten (mash_temp stale, mash_pid, heater) | ✓ |
| AddItemModal öffnet per `+ Add Item` | ✓ |
| Sensor-Tab: OneWire-Pin-Input + Scan-Button (disabled ohne Pin) | ✓ |
| Scan-Button aktiv nach Pin-Eingabe, Scan-Request an ESP32 | ✓ |
| Scan liefert 0 Geräte (kein DS18B20 an GPIO 4) — kein Fehler | ✓ |
| Actuator-Tab: GPIO-Pin + Mode-Dropdown (TPO/SSR default) | ✓ |
| Controller-Tab: Sensor/Actuator-Dropdowns mit ESP32-Live-Items vorbelegt | ✓ |
| Cancel schließt AddItemModal | ✓ |
| `×`-Button auf Sensor-Card öffnet Delete-ConfirmModal mit korrektem Titel | ✓ |
| Cancel im Delete-Modal schließt ohne Löschen | ✓ |
| Backdrop-Click schließt Delete-Modal | ✓ |
| Console-Fehler: nur `favicon.ico 404` (harmlos) | ✓ |

**Befund (⚠ minor UX):** Nach einem Scan ohne Geräte zeigt das Sensor-Formular
denselben Hint-Text `"Scan to find devices on this bus."` wie vor dem Scan.
Kein visuelles Feedback ob der Scan überhaupt gelaufen ist und 0 Geräte gefunden
wurden vs. noch nicht gescannt. Nicht buggy, aber für Benutzer leicht verwirrend.

**Screenshots:** `.playwright-mcp/` — `01_dashboard.png`, `02_add_modal_sensor.png`,
`03_scan_no_devices.png`, `04_delete_confirm_modal.png`, `05_dashboard_final.png`

---

## 2026-05-21 — MAX31865 PT100/PT1000 Sensor + AddItemModal Redesign

**Ausgangslage:** BrewControl unterstützte nur DS18B20 (OneWire) als dynamisch
hinzufügbaren Temperatursensor. MAX31865 ist ein SPI-Chip für PT100/PT1000 RTD-Sensoren —
präziser und in der Brauerei für Hochtemperaturmessungen üblich.

**Änderungen in beiden Projekten:**

- `SensActCtrl/src/sensors/MAX31865Sensor.{h,cpp}`: neue Klasse `MAX31865Sensor`,
  implementiert `Sensor`-Interface. Liest synchron per SPI (~1 ms, kein State-Machine
  nötig). Hardware-SPI (nur CS-Pin) und Software-SPI (CS + CLK + MISO + MOSI)
  Konstruktoren. Enums `Wires` (Two/Three/Four) und `RtdType` (PT100/PT1000).
  `#ifndef ARDUINO`-Guard mit vollständigem Stub für native Builds.
- `SensActCtrl/test/test_max31865/test_max31865.cpp`: 3 Unity-Tests (meta, default
  reading, id). Gesamtzahl nativer Tests: 31 → 34.
- `SensActCtrl/library.json` + `library.properties`: `Adafruit MAX31865 library ^1.2.0`
  als neue Abhängigkeit eingetragen.
- `SensActCtrl/src/SensActCtrl.h`: `#include "sensors/MAX31865Sensor.h"` im
  Umbrella-Header ergänzt.
- `BrewControl/firmware/src/DynamicItems.cpp`: neuer Factory-Branch für `"MAX31865"` in
  `addSensorNoBegin()` — liest `cs`, `wires`, `rtd`, `rref`, optional `clk`/`miso`/`mosi`
  aus dem JSON-Config. Validierung: `cs >= 0`, `wires` 2–4, `rref > 0`, clk/miso/mosi
  vollständig wenn custom SPI. Alle 3 Boards (esp32dev, lolin_s2_mini,
  lilygo_t_display_s3_amoled) kompilieren.
- `BrewControl/web/src/components/AddItemModal.tsx`: vollständiges Redesign mit
  grupiertem `<optgroup>`-Dropdown für Sensortyp-Auswahl. DS18B20-Formular unverändert.
  Neues MAX31865-Formular: CS-Pin, Wires-Segment-Buttons, RTD-Segment-Buttons, Rref
  (auto-fill PT100↔PT1000, respektiert manuelle Änderungen via `rrefTouched`-Flag),
  aufklappbarer Custom-SPI-Bereich (CLK/MISO/MOSI).

**Wire-Format** für neuen Sensortyp:
```json
POST /api/sensors
{ "type":"MAX31865","id":"boil_temp","cs":5,"wires":3,"rtd":"PT100","rref":430.0 }
// mit custom SPI:
{ "type":"MAX31865","id":"boil_temp","cs":5,"clk":14,"miso":12,"mosi":13,"wires":3,"rtd":"PT100","rref":430.0 }
```

**Rückwärtskompatibel:** DS18B20-Pfad in DynamicItems und AddItemModal unverändert.

**Adafruit SW-SPI Konstruktor-Reihenfolge:** `(cs, mosi, miso, clk)` — nicht
`(cs, clk, miso, mosi)`. Wurde im Code-Review verifiziert gegen die Adafruit-Header.

**Design-Entscheidungen:**
- Synchroner SPI-Read in `tick()` (~1 ms) — kein State-Machine nötig (anders als DS18B20)
- Rref default: 430 Ω für PT100, 4300 Ω für PT1000 (entspricht Standard-Breakout-Boards)
- Forward-Deklaration `class Adafruit_MAX31865;` im Header verhindert Adafruit-Header-Pull
  in den Umbrella-Include

Details: Spec `docs/superpowers/specs/2026-05-21-max31865-sensor-design.md`,
Plan `docs/superpowers/plans/2026-05-21-max31865-sensor.md`.
