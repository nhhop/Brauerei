# Brauerei Session-Log

Chronologisches Log für SensActCtrl + BrewControl — seit 2026-08-31 konsolidiert
(vorher getrennte Logs pro Teilprojekt). Offene Punkte / Backlog:
[PLAN.md](PLAN.md). Volle Detail-Historie zu jedem Eintrag hier:
[SESSION-archive.md](SESSION-archive.md).

---

## 2026-05-16 – 2026-06-03 — SensActCtrl: Phase 1–3 Aufbau

Greenfield-Aufbau der Library: Core-Abstraktionen, lokale Sensoren/Aktoren,
TwoPoint-/PID-Regler, MQTT/ESP-NOW/Webhook-Transport, Remote-Wrapper,
Registry-JSON-Snapshot. Danach Multi-Channel-Interface, weitere
Sensoren/Aktoren, `fault()`/`enabled()`, Dual-Output-Regler, geteilte
`PidEngine`. Details: [SESSION-archive.md](SESSION-archive.md).

## 2026-05-17 – 2026-05-20 — BrewControl: Pre-MVP (Planung, Implementierung, erste E2E-Tests)

Web-UI-Projekt von Grund auf geplant und in 11 Build-Schritten umgesetzt
(Firmware, WiFi-Setup-Portal, WebUI-Klasse, Vite/Preact-Frontend), E2E auf
LOLIN S2 Mini und LilyGo T-Display-S3-AMOLED verifiziert, QEMU-Machbarkeit
geprüft und verworfen, WiFi-Reset zur Laufzeit + Runtime-Item-Add/Remove +
Bus-Discovery ergänzt. Details: [SESSION-archive.md](SESSION-archive.md).

## 2026-05-18 — Monorepo-Setup

git-Repo zusammengeführt, Root-CLAUDE.md/PLAN.md/SESSION.md angelegt.
Details: [SESSION-archive.md](SESSION-archive.md).

## 2026-05-20 — Bus-Discovery-Feature (OneWire/DS18B20)

`GET /api/bus/scan` + Scan-UI im AddItemModal für mehrere DS18B20 an einem
Pin. Details: [SESSION-archive.md](SESSION-archive.md).

## 2026-05-20 — Playwright/Edge-Setup für Browser-UI-Tests

Playwright-MCP auf Edge umgestellt (kein Chrome installiert); erster
Browser-UI-Testlauf gegen das Bus-Discovery-Feature. Details:
[SESSION-archive.md](SESSION-archive.md).

## 2026-05-21 — MAX31865-Sensor + AddItemModal-Redesign

Neuer PT100/PT1000-SPI-Sensor in der Library; AddItemModal auf gruppiertes
Dropdown umgebaut. Details: [SESSION-archive.md](SESSION-archive.md).

## 2026-05-21/22 — Multi-Channel-Sensor-Interface + YF-S201

Breaking Change: `Sensor`-API von `meta()`/`lastReading()` auf
`channelCount()`/`channel()` umgestellt; neuer Durchfluss-Sensor mit 2
Kanälen. Details: [SESSION-archive.md](SESSION-archive.md).

## 2026-05-22/23 — IDS-Induktionskocher als Aktor

`IdsActuator` (IDS1/IDS2) + `fault()`-Interface auf Sensor-/Actuator-
Basisklassen. Details: [SESSION-archive.md](SESSION-archive.md).

## 2026-05-29 — RemotePublisher Multi-Channel + konfigurierbares Topic-Prefix

Bisher publizierte `RemotePublisher` nur Kanal 0; jetzt alle Kanäle + frei
wählbares Topic-Prefix. Details: [SESSION-archive.md](SESSION-archive.md).

## 2026-05-30 — AnalogOutputActuator + HX711LoadCellSensor + Roadmap

Neuer PWM/DAC-Aktor und Wägezellen-Sensor; Roadmap-Einträge Peripherie-
Abstraktion/Pin-Manager/LVGL-Display aufgenommen (jetzt in
[PLAN.md](PLAN.md) → Größere Brocken). Details:
[SESSION-archive.md](SESSION-archive.md).

## 2026-05-30 — DS18B20-Praxistest + Scan-Konflikt-Fix + DAC-Guard

Erster Live-Sensor-Test; Bus-Scan-Konflikt mit aktiver OneWire-Instanz
gefixt; DAC-Downgrade auf ESP32-S2/S3 ohne DAC-Peripherie. Details:
[SESSION-archive.md](SESSION-archive.md).

## 2026-05-30 — UI: Edit-Funktion, ControllerCard, TwoPoint-Regler, Enable/Disable, Demo-Items entfernt

Bearbeiten via Delete+POST, Ist-Wert/Ausgang auf der ControllerCard,
Zweipunktregler, Controller-Enable/Disable, hardcodierte Demo-Items aus
`main.cpp` entfernt. Details: [SESSION-archive.md](SESSION-archive.md).

## 2026-05-30 — Fix: WebUI-Handler-Reihenfolge (Aktor-Write-Bug)

`POST /api/actuators/:id` lieferte 400, weil ein breiterer Handler zuerst
matchte — Registrierungsreihenfolge korrigiert. Details:
[SESSION-archive.md](SESSION-archive.md).

## 2026-05-31 — Multi-Dashboard-Feature + Settings-Tab

Benutzerdefinierte Dashboard-Tabs mit SD-Persistenz, `+ Hinzufügen` in
eigenen ⚙-Tab verschoben. Details: [SESSION-archive.md](SESSION-archive.md).

## 2026-06-01 — Appearance-Settings: Design/Theme-Feature

CSS-Token-System (hell/dunkel/System, Akzentfarbe), `SettingsStore`,
Settings-Hub mit Unterseiten. Details: [SESSION-archive.md](SESSION-archive.md).

## 2026-06-01 — Routing-Refactor + UI-Verbesserungen

`preact-router`, Code-Aufteilung in `src/pages/`, „× entfernt" statt
löscht auf dem Dashboard. Details: [SESSION-archive.md](SESSION-archive.md).

## 2026-06-02 — Gärsteuerung: Dual-Output-Regler (Heizen + Kühlen)

`DualStageController` + `SplitRangePIDController` (1 Sensor → 2 Aktoren) in
der Library, UI-Formulare in BrewControl. Danach: Regler-Typ-Dropdown
gruppiert, PID-AutoTune über Web, AutoTune auch für SplitRangePID (geteilte
`PidEngine`). Details: [SESSION-archive.md](SESSION-archive.md).

## 2026-06-03 — PIN-Invertierung

`invert`/`activeHigh` für DigitalInput/DigitalOutput end-to-end. Details:
[SESSION-archive.md](SESSION-archive.md).

## 2026-06-03 — BrewControl: OTA-Firmware-Update

Vier Update-Wege (Server-Pull/GitHub, Browser-Upload, SD-Boot-Flash-
Recovery, USB), CI-Matrix baut alle Board-Varianten, HW-E2E auf LilyGo S3
verifiziert. Details: [SESSION-archive.md](SESSION-archive.md).

## 2026-06-04 — BrewControl: Backup & Restore

`GET/POST /api/backup` bündelt die drei Config-Dateien, Restore =
Validieren + Verbatim-Schreiben + Reboot. Details:
[SESSION-archive.md](SESSION-archive.md).

## 2026-06-05 — Zeit & Formate (NTP + Zeitzone + Formateinstellungen)

NTP-Sync, konfigurierbare Zeitzone/Zeit-/Datumsformat, `serverTime` im
SSE-Snapshot. Details: [SESSION-archive.md](SESSION-archive.md).

## 2026-06-05 — BrewControl: SD-Boot-Firmware-Flash (Recovery) + UI-Fixes PID-Dashboard

Vierter OTA-Weg ohne WiFi (`/firmware.bin` im SD-Root); plus vier
zusammenhängende UI-Fixes an ControllerCard/AddItemModal (Aktor-Reset beim
Ausschalten, Setpoint nur im Dashboard, AutoTune in Settings verschoben,
AutoTune-Status). Details: [SESSION-archive.md](SESSION-archive.md).

## 2026-06-06/07 — BrewControl: Datenlogging & Trend-Charts

`LogStore` sampelt Serien in CSV-Sessions, Online-Kompression
(Linear/Swinging-Door), uPlot-Charts, Archiv-Seite, Retention. HW-E2E +
Playwright-UI-Tests grün; dabei ein Cross-Task-Race auf `logs_` gefunden und
per rekursivem Mutex gefixt, plus vier vom User gemeldete Chart-Bugs
(Zeitformat, Live-Werte, Logging-Pause-Marker, interpolierte Hover-Werte).
Details: [SESSION-archive.md](SESSION-archive.md).

## 2026-06-07 — BrewControl: Netzwerk/WLAN-Einstellungen (STA-Teil)

`/settings/network` (Status/Scan/WLAN-wechseln/mDNS-Hostname); Scan brach
anfangs die WLAN-Verbindung ab → WLAN-Watchdog + kürzere Scan-Dwell +
resilienter Frontend-Poll. Details: [SESSION-archive.md](SESSION-archive.md).

## 2026-06-08 — Sollwert-Programme / Maischeprofile

`ProgramRunner` treibt zeitgesteuerte Setpoint-Schritte mit Reboot-Resume
über Wall-Clock-Epoch; Dashboard-Widget mit Start/Pause/Stop/Weiter/Zurück.
Details: [SESSION-archive.md](SESSION-archive.md).

## 2026-07-10 — BrewControl: Fluent/WinUI-3-Redesign (Runde 1+2)

NavShell, Fluent-Design-Tokens, Akzentfarbe als Steuerfarbe, WinUI-Controls,
ContentDialog-Footer. Details: [SESSION-archive.md](SESSION-archive.md).

## 2026-07-11 — BrewControl: Dashboard-Layout (Programm-Sidebar + Compact/Sticky-Widget)

Programm-Sidebar links, rechter Scroll-Bereich, mobiles Accordion. Details:
[SESSION-archive.md](SESSION-archive.md).

## 2026-07-13 — BrewControl: Dashboard-Edit-Modus

Getrennte Zuständigkeiten: Edit-Modus-Toggle, Tab-Name-Modal, Inhalte-
Checkbox-Modal. Details: [SESSION-archive.md](SESSION-archive.md).

## 2026-07-13 – 2026-07-25 — BrewControl: WinUI-3-Politur Teil 1–5

Fünfteilige Konsistenz-Runde: semantisches Farbsystem, neutrale Palette +
Mica-Shell + Win11-Settings, Fluent-2-Karten-Tokens, Firmware-Seite, Icons +
Control-Positionen auf allen Settings-Seiten. Details:
[SESSION-archive.md](SESSION-archive.md).

## 2026-07-25 — BrewControl: Netzwerk-Seite — mDNS-Kartenlayout + Netzwerk-Liste

Nutzer-Mockup umgesetzt: mDNS-Karte neu, WLAN-Auswahl als anklickbare Liste
statt Dropdown, mehrere Feinschliff-Nachträge. Details:
[SESSION-archive.md](SESSION-archive.md).

## 2026-08-11 — BrewControl: Kleinere UI-Fixes + einheitliche Dashboard-Karten-Höhe

Fehlende Untertitel (Zeit & Formate), Einrückung (Firmware-Update),
Kartenabstand (Settings-Übersicht); Sensor-/Aktor-/Regler-Karten auf
einheitliche Mindesthöhe. Details: [SESSION-archive.md](SESSION-archive.md).

## 2026-08-12 — Sollwert-Ratenbegrenzung (RateLimitedController-Decorator)

Neuer Decorator begrenzt die Sollwert-Änderungsrate (°/min), typ-unabhängig
im UI. Details: [SESSION-archive.md](SESSION-archive.md).

## 2026-08-13 – 2026-08-19 — Aktor-Master-Schalter (mehrere Design-Iterationen)

Erst `EnableGuardActuator`-Decorator, dann bug-getriebene Iterationen (Ziel-
vs-Ist-Wert, Re-Enable-Latenz) — am Ende auf Nutzerwunsch ersatzlos in
konkreten State auf der `Actuator`-Basisklasse verlegt (analog
`Controller`), jede Aktor-Klasse gated ihren eigenen Ausgang selbst.
`target()` (Sollwert) ergänzt `state()` (Ist-Wert). Details:
[SESSION-archive.md](SESSION-archive.md).

## 2026-08-14 — Aktor-Intervallbetrieb (IntervalActuator-Decorator) + Fix: GPIO/LEDC-Leak

Konfigurierbare Ein/Aus-Taktung für alle Aktor-Arten; danach Fix für einen
beim Löschen nicht freigegebenen LEDC-Pin (fehlendes `end()`). Details:
[SESSION-archive.md](SESSION-archive.md).

## 2026-08-19 — BrewControl: MQTT-Einstellungen (extern + embedded Broker)

Externer Broker über `MqttTransport`, embedded Broker via `TinyMqtt` (mit
Build-Zeit-Auth-Patch), Live-Tracking von Add/Remove über neues
`RemotePublisher::detach()`. Nebenbefund: SD-Concurrency-Bug
(`loopTask`/`async_tcp` unsynchronisiert auf SD) gefunden und per globalem
Mutex gefixt. Details: [SESSION-archive.md](SESSION-archive.md).

## 2026-08-20 — BrewControl: MQTT Live-Tracking-Fixes + Verbindungsstatus im UI

Embedded Broker konnte anfangs nicht selbst publizieren (WiFiClient-
Loopback-Problem) → gelöst über TinyMqtts nativen In-Process-Client;
externer Broker gegen echtes Mosquitto (Auth/TLS) verifiziert;
Verbindungsstatus + Fehlertext in der UI ergänzt; Topic-Prefix/Client-ID
editierbar gemacht. Details: [SESSION-archive.md](SESSION-archive.md).

## 2026-08-21 — Generischer MQTT-Aktor + -Sensor

Frei konfigurierbarer Topic + Payload-Template/JSON-Feld-Extraktion für
Fremdgeräte (Sonoff/Tasmota-artig), unabhängig von SensActCtrls eigenem
device/id-Schema. Details: [SESSION-archive.md](SESSION-archive.md).

## 2026-08-21 — Kabellose SensActCtrl-Knoten über die Web-UI (MQTT + Webhook + ESP-NOW)

Echte Node-zu-Node-Anbindung über die bereits vorhandenen
`RemoteSensor`/`RemoteActuator`/`RemotePublisher`: `type:"Remote"` in
`DynamicItems`/`AddItemModal`, der Reihe nach für alle drei Transporte
umgesetzt und HW-verifiziert (inkl. Fix in
`EspNowTransport::initEspNow_()`, damit ESP-NOW BrewControls eigenes WLAN
nicht mehr kappt). Details: [SESSION-archive.md](SESSION-archive.md).

## 2026-08-21 — BrewControl: SD-Dateiverwaltung

Browse/Upload/Download/Löschen/Umbenennen auf der SD-Karte, `/www`/`/www.new`
geschützt. Details: [SESSION-archive.md](SESSION-archive.md).

## 2026-08-28 — BrewControl: LittleFS-Support für esp32dev/lolin_s2_mini

UI + Persistenz auf internem Flash statt SD für die beiden Boards ohne
SD-Slot; neue Partitionstabelle, HW-verifiziert auf beiden Boards. Details:
[SESSION-archive.md](SESSION-archive.md).

## 2026-08-29 — Fix: Eingebauter MQTT-Broker verwarf Retained-Messages

`retain_size=0` (Default) hielt keine einzige Retained-Message vor →
Consumer bekamen nie Meta von einem echten zweiten Board. Fix:
`retain_size=64`. Erster echter Zwei-Board-MQTT-Test (State **und** Meta)
grün. Details: [SESSION-archive.md](SESSION-archive.md).

## 2026-08-29 — Feature: Publish-Pfad für Webhook + ESP-NOW (symmetrisch zu MqttService)

BrewControl konnte die eigene Registry bisher nur über MQTT nach außen
anbieten — `WebhookService` um Publish erweitert, neue
`EspNowPublishService`, neue Settings-Seiten. Zwei-Board-HW-Tests für beide
Transporte grün (inkl. Negativtest: unerreichbarer Webhook-Peer blockiert
`loop()`). Details: [SESSION-archive.md](SESSION-archive.md).

## 2026-08-29 — Fix: Webhook-Publish blockiert `loop()` nicht mehr unbegrenzt + `lastErrorMessage()` für Webhook/ESP-NOW

Timeout (800ms) + Backoff (5s) statt unbegrenztem Block bei unerreichbarem
Peer; beide Transporte melden jetzt einen Klartext-Fehler statt immer `""`.
Details: [SESSION-archive.md](SESSION-archive.md).

## 2026-08-31 — Fix: ESP-NOW Meta an spät hinzugefügte Consumer

Ein spät angelegter `Remote`-Sensor bekam über ESP-NOW nie Meta (nur
State) — Throttle im Retained-Request unterdrückte den Request statt ihn
nachzuholen. Gefixt + über zwei physische Boards verifiziert. Details:
[SESSION-archive.md](SESSION-archive.md).

## 2026-08-31 — Feature: mDNS-Hostname bereits im Setup-Portal

Hostname jetzt schon im AP-Mode-Portal vergebbar (verhindert
Namenskonflikte beim parallelen Einrichten mehrerer Boards), Erfolgsseite
mit Link + Best-Effort-Auto-Redirect-Countdown. Details:
[SESSION-archive.md](SESSION-archive.md).

## 2026-08-31 — Fix: Direkte URLs zu Unterseiten lieferten weiße Seite + Feature: ESP-NOW-Icon

`vite.config.ts` `base: './'` → `base: '/'` (relative Asset-Pfade brechen
auf verschachtelten Client-Routen); ESP-NOW-Icon auf `SiEspressif`
(react-icons) umgestellt. Details: [SESSION-archive.md](SESSION-archive.md).

## 2026-08-31 — Doku-Konsolidierung: ein PLAN.md + ein SESSION.md fürs ganze Monorepo

Drei getrennte PLAN.md/SESSION.md-Paare (Root, SensActCtrl, BrewControl) +
eine BrewControl-eigene SESSION-archive.md auf dieses Root-Paar
konsolidiert (Grund: die beiden Teilprojekte werden nicht mehr unabhängig
geplant). Grundsätzliche, fürs Verständnis nötige Architektur-/API-Referenz
wandert aus den alten PLAN.md-Dokumenten in die jeweilige `README.md`
(SensActCtrl behält dafür seinen Standalone-Publish-Anspruch). Dabei auch:
Root-`PLAN.md`-Eintrag „Kabellose SensActCtrl-Knoten" nachträglich als
erledigt markiert (war fälschlich noch offen, obwohl seit 2026-08-21
komplett umgesetzt), plus vier bis dahin nirgends nachgetragene
Bekannte-Probleme-Einträge ergänzt (verschwundener Test-Sensor `sdfswdf`,
Bus-Scan-UX-Feedback, LittleFS-Boards ohne SD-Boot-Flash/Log-Retention,
GPIO/LEDC-Leak-Fix-Nachtest).

## 2026-09-01 — Aufräumen: gemergte Branches/Worktree entfernt + Doku-Punkt geschlossen

Nach `git fetch --prune`: `docs/consolidate-plan-session` (PR #18),
`feat/sd-file-manager`, `claude/distracted-rubin-a1e377` waren gemergt und
remote gelöscht — lokale Branches + der Worktree
`.claude/worktrees/distracted-rubin-a1e377` entfernt. Offen bleibt nur
`feat/winui-design` (1 obsoleter Commit voraus / 37 hinter).
Bekannte-Probleme-Eintrag „Test-Sensor `sdfswdf` spurlos verschwunden"
gestrichen — nie reproduziert, Sensor manuell gelöscht.

## 2026-09-01 — HW-E2E: SD-Boot-Flash-Recovery (`FirmwareUpdater::flashFromSdImage()`)

Der seit 2026-06-05 nur build-verifizierte Recovery-Pfad (SD-Root
`/firmware.bin` wird beim Boot vor WiFi geflasht, dann gelöscht) am Gerät
verifiziert — komplett host-getrieben gegen die LilyGo T-Display-S3-AMOLED
(`192.168.178.87`), kein SD-Kartenausbau:

1. `firmware.bin` mit `BREWCTL_VERSION_OVERRIDE=sdflash-e2e` gebaut
   (1.319.744 B), per `POST /api/files/upload?path=/` auf den SD-Root.
2. Reboot via `POST /api/network {"hostname":"brewcontrol"}` (kein
   WLAN-Eingriff).
3. Nach ~15 s zurück: `GET /api/update/status` → `currentVersion` von
   `d6ccb81-dirty` auf `sdflash-e2e` gewechselt (= SD-Image ist die
   laufende Firmware), `firmware.bin` vom SD-Root verschwunden
   (Selbstlöschung nach erfolgreichem `Update.end`), Snapshot/WiFi/Config
   unverändert.
4. Restore: sauberes `firmware.bin` (ohne Override, `70faca4-dirty`)
   über denselben SD-Weg zurückgeflasht — zweiter erfolgreicher Durchlauf.

**Nebenbefund (→ PLAN.md Bekannte Einschränkungen):** Der erste
Restore-Upload landete truncated auf der SD (618.496 statt 1.319.744 B),
Handler meldete trotzdem `200 ok` — `POST /api/files/upload` ignoriert die
`File::write()`-Rückgabe. `flashFromSdImage()` verhielt sich dabei korrekt:
`Update.end(true)` wies das unvollständige Image ab, das Board bootete die
vorhandene Firmware weiter, die kaputte Datei blieb liegen (kein
Reflash-Loop). Nach Löschen + Re-Upload (mit Größencheck + Retry-Schleife)
lief der Restore sauber durch.

## 2026-09-01 — PLAN.md umstrukturiert: nur noch Offenes

Der User fand PLAN.md unübersichtlich (erledigter Status, durchgestrichene
Roadmap-Punkte und offene Einschränkungen gemischt). PLAN.md enthält jetzt
ausschließlich Offenes:

- **Entfernt:** „Aktueller Status"-Block (alle erledigten SensActCtrl-/
  BrewControl-Arbeiten — Historie steht chronologisch hier + in
  SESSION-archive.md), Architektur-Diagramm, Technologie-Stack, Boards-
  Tabelle (Referenz lebt in den READMEs), alle `~~…~~ ✓ erledigt`-Einträge
  aus der Roadmap und alle `✓`-Zeilen aus „Bekannte Einschränkungen".
- **Behalten/neu gegliedert:** kurzes Intro → „Bugs & bekannte
  Einschränkungen" → „Hardware-Verifikation offen" → „Backlog" (flache,
  grob priorisierte Liste, Abhängigkeiten inline; die bisherigen
  *Später:*-Vormerkungen als eigenständige Einträge) → „Größere Brocken
  (eigene Spec vor Umsetzung)" (Peripherie-Abstraktion, Pin-Manager,
  LVGL-Display, HTTPS-Support) → „Buckets".
- **Verworfen:** die alte Zweiteilung Architektur-Track / Feature-Track
  (+ Wellen 1/2/3) — die Achse trug nicht (LVGL-Display ist ein Feature,
  kein Rückgrat; von jeder Welle war das meiste erledigt). Ersetzt durch
  eine flache Backlog-Liste + separate „Größere Brocken".
- **Regel geändert:** Ein umgesetzter PLAN.md-Punkt wird künftig ersatzlos
  entfernt (kein `~~erledigt~~`, keine Pointer-Zeile) — Historie nur in
  SESSION.md. Nachgezogen in Root-`CLAUDE.md` → Dokumentation und
  `BrewControl/CLAUDE.md` → Arbeitsregeln.

## 2026-09-01 — API-Vertrag nach `BrewControl/docs/openapi.yaml` überführt

**Anlass:** Der „API-Vertrag"-Abschnitt in `BrewControl/README.md` dokumentierte
14 Endpoints, die Firmware registriert 41. Komplett undokumentiert waren
Data-Logs, Sollwert-Programme, Settings, Dashboards, SD-Dateimanager,
Backup/Restore, Firmware-Update-Status/Check/Install und Netzwerk. Dazu waren
Details falsch: die Delete-Routen der Dynamic Items antworten `405` (nicht `404`
wie behauptet), Erfolg ist durchgängig `204` statt `200`, Fehler-Bodies sind
`text/plain` statt JSON. `BrewControl/CLAUDE.md` führte eine zweite, noch
kürzere und ebenfalls veraltete Tabelle.

**Umsetzung:**

- **Neu: `BrewControl/docs/openapi.yaml`** (OpenAPI 3.1) — alle 41 Routen mit
  Query-/Path-Parametern, Request-Bodies, Status-Codes, den wörtlichen
  `text/plain`-Fehlermeldungen aus dem Code und vollständigen Schemas.
  Inhalt ausschließlich aus dem Code abgeleitet (`WebUI.cpp`,
  `RegistrySnapshot.cpp`, `DynamicItems.cpp`, `LogStore.cpp`,
  `ProgramRunner.cpp`, `SettingsStore.cpp`, `DashboardStore.cpp`,
  `FirmwareUpdater.cpp`), nicht aus der alten Doku. Beschreibungen auf
  Englisch (codenahes, maschinenlesbares Artefakt); README/PLAN/SESSION bleiben
  Deutsch. Explizit festgehalten: die vier Endpoints mit Reboot ~500 ms nach der
  Antwort, das SSE-Event `snapshot`, die snake_case-Anlege-Configs vs. die
  camelCase-Runtime-Params der Regler, und dass es keine Authentifizierung gibt.
  Bewusst *nicht* in der Spec: WiFi-Setup-Portal (eigener Server) sowie
  Static-Serving/SPA-Fallback.
- **Neu: `BrewControl/docs/redocly.yaml`** — Lint-Config; schaltet
  `security-defined` (es gibt keine Auth) und `operation-4xx-response` (mehrere
  Endpoints haben keinen Client-Fehlerpfad) ab.
- **`README.md`:** „API-Vertrag" auf eine Übersichtstabelle reduziert (eine
  Zeile pro Route: Endpoint / Methode / Zweck) plus Verweis auf die YAML —
  keine Bodies und Status-Codes mehr, die driften sonst wieder. Erhaltene
  Prosa: DS18B20-Multi-Sensor-Hinweis, Snapshot-Shape-Verweis, Persistenz.
  Dabei zwei Ungenauigkeiten korrigiert: `/config/registry.json` liegt auf SD
  *oder* LittleFS (nicht „auf der SD-Karte"), und der Multipart-Feldname `f` in
  den `curl`-Beispielen ist beliebig — die Firmware wertet ihn nicht aus.
- **`BrewControl/CLAUDE.md`:** stale Mini-Tabelle raus, Verweis auf die YAML
  rein (inkl. Korrektur `RegistrySnapshot.h` → `.cpp`); neue Arbeitsregel:
  Routen-Änderungen in `WebUI.cpp` im selben Commit in `openapi.yaml`
  nachziehen. Root-`CLAUDE.md` → Dokumentation um die Datei ergänzt.

**Verifikation:** `npx @redocly/cli lint --config BrewControl/docs/redocly.yaml
BrewControl/docs/openapi.yaml` → valide (1 Warning: kein `license`-Feld).
Routen-Abdeckung per Skript geprüft: alle 41 `server_.on`/`addHandler`-
Registrierungen aus `WebUI.cpp` haben ein Gegenstück in `paths:`, keine
verwaisten Pfade. Stichproben gegen den LilyGo S3 (192.168.178.87):
`/api/settings` liefert alle sechs Sektionen inkl. der live gespliceten
`connected`/`error`-Felder, `/api/update/status` matcht das Schema inkl.
`available: null`, `/api/network/scan` antwortet `202`. Die
`/api/files`-Stichproben liefen ins Leere, weil auf dem Board gerade keine
SD-Karte gemountet ist (`GET /` → 501, jeder Pfad „not a directory") — kein
Spec-Befund.

**Nebenbefunde** (dokumentiert, nicht gefixt — jetzt in PLAN.md → „Bugs &
bekannte Einschränkungen"): `types.ts` weicht an drei Stellen von der Wire-Form
ab (`ProgramConfig.stepStartedEpoch`/`elapsedAtPauseSec` fehlen,
`DashboardConfig.charts`/`.programs` und die fünf optionalen `AppSettings`-
Sektionen sind zu lose deklariert); die Create-Endpoints akzeptieren
bibliotheksbedingt auch GET/PUT/PATCH; `GET /api/settings` gibt
`mqtt.password` im Klartext zurück; `GET /api/snapshot` antwortet bei
Puffer-Überlauf mit einem leeren `200` statt einem Fehler.

## 2026-09-01 — Fix: `POST /api/files/upload` erkennt Short-Writes

**Root Cause:** Der Upload-Callback schrieb Chunks mit
`fileUpload_.write(data, len)` und ignorierte den Rückgabewert. Bei einem
Short-Write auf die SD-Karte (volles Medium, I/O-Fehler) wurde die Datei still
abgeschnitten, der Handler antwortete trotzdem `200 ok`. Beim
SD-Boot-Flash-HW-E2E am 2026-09-01 einmal getroffen: 1.319.744-B-`firmware.bin`
landete als 618.496 B auf dem SD-Root, Antwort `ok`.

**Umsetzung** (`BrewControl/firmware/src/WebUI.cpp`, analog zum bestehenden
`fileUploadRejected_`-Pfad im selben Handler und zum Fehlerpfad von
`/api/update/firmware` / `/api/update/assets`): Rückgabewert von `write()`
gegen `len` prüfen; bei Abweichung Datei schließen, die Teildatei per
`fs_.remove()` entfernen, `fileUploadRejected_` setzen und
`500 "write failed — partial file removed"` senden. Der Zielpfad wird dafür in
`WebUI::fileUploadPath_` gehalten (neu). `openapi.yaml`: Known-Issue-Notiz
entfernt, `500`-Response um den neuen Body ergänzt.

**Verifikation:** `pio run -e lilygo_t_display_s3_amoled` grün.
`npx @redocly/cli lint` weiterhin valide (nur die bekannte `license`-Warnung).
HW-E2E am LilyGo S3 (`192.168.178.87`, Firmware `2d429cd` per USB/COM9 geflasht)
am 2026-09-01 nachgeholt: (1) Happy Path auf der regulären Karte — 405 KB
hochgeladen, `200 ok`, SHA256 nach Download-Roundtrip identisch. (2) Overflow —
kleine FAT32-Karte manuell auf 256 KB frei befüllt, 2-MB-Upload → `500 "write
failed — partial file removed"`, `/api/files`-Listing zeigt keine Teildatei.
(3) Recovery — 100-KB-Datei danach wieder sauber `200 ok`, SHA256 identisch.

## 2026-09-01 — `web/src/types.ts` mit der Wire-Form synchronisiert

Erster der beim OpenAPI-Abgleich gefundenen Nebenbefunde geschlossen. Die drei
Firmware-Serializer als Referenz:

- `ProgramRunner::serialize()` emittiert `stepStartedEpoch` und
  `elapsedAtPauseSec` immer (persistierter Laufzeitstand) → in `ProgramConfig`
  als Pflichtfelder ergänzt.
- `DashboardStore::serialize()` schreibt `charts` und `programs` immer als Array
  (ggf. leer) → `DashboardConfig.charts`/`.programs` von `?:` auf Pflicht.
- `SettingsStore::serialize()` liefert immer alle sechs Sektionen → in
  `AppSettings` `firmware`/`time`/`mqtt`/`webhook`/`espnow` von `?:` auf Pflicht,
  ebenso `MqttSettings.embeddedBrokerSupported` (wird immer gesetzt).
  Der Patch-Pfad ist unberührt (`updateSettings(patch: Partial<AppSettings>)`).

Rein Typen-eng/-losigkeit, kein Laufzeitverhalten. Verifikation:
`pnpm typecheck` grün, keine Konsumenten betroffen.

## 2026-09-01 — Fix: `GET /api/snapshot` bei Puffer-Überlauf → `503`

**Root Cause:** `serializeRegistry()` gibt `0` zurück, wenn die Registry
`kSnapshotCap` (4160 B) sprengt, und lässt den Puffer unangetastet. `makeSnapshot()`
reichte in dem Fall einen nicht-null Puffer mit `n=0` zurück; der `/api/snapshot`-
Handler prüfte nur `!buf` und schickte `200` mit leerem Body. Die beiden SSE-Pfade
(`pushSnapshot_`/`sendSnapshotTo_`) hätten sogar den uninitialisierten Puffer als
C-String verschickt.

**Umsetzung** (`BrewControl/firmware/src/WebUI.cpp`): `makeSnapshot()` gibt bei
`n == 0` jetzt `nullptr` zurück — dieselbe Fehlersignalisierung wie bei OOM, die
alle drei Aufrufer bereits korrekt behandeln (Handler → `503`, SSE-Pfade →
Tick überspringen). Handler-Body von `OOM` auf `snapshot unavailable`
umbenannt (deckt beide Ursachen ab). `openapi.yaml`: `503`-Response und
Beschreibung entsprechend aktualisiert, Known-Issue-Hinweis raus.

**Verifikation:** `pio run -e lilygo_t_display_s3_amoled` grün, `redocly lint`
valide. HW-E2E am LilyGo S3 (`192.168.178.87`, Firmware aus diesem Stand per
USB/COM9): 23 DigitalInput-Sensoren zur Laufzeit angelegt, ab Sensor #23 (Snapshot
> 4160 B) antwortet `GET /api/snapshot` mit `503 "snapshot unavailable"` statt
leerem `200`; SSE-Stream im Normalfall unverändert. Testsensoren wieder gelöscht,
Snapshot zurück auf `200` / 1219 B.

## 2026-09-01 — Fix: `mqtt.password` als Write-only-Feld

**Root Cause:** Die gesamte API ist unauthentifiziert; `GET /api/settings` gab
das gespeicherte MQTT-Passwort im Klartext zurück (sichtbar in Browser-DevTools,
Screenshots, evtl. Logs).

**Umsetzung:**
- `WebUI.cpp` (`GET /api/settings`): `mqtt.password` wird vor dem Senden immer
  auf `""` überschrieben, zusätzlich `mqtt.passwordSet` (bool) eingespliced.
- `SettingsStore::update()`: leerer/fehlender `mqtt.password` lässt das
  gespeicherte Passwort unverändert; expliziter JSON-`null` löscht es. Nicht-
  leerer String setzt es. `serialize()`/`saveToSD()` unverändert — auf Flash und
  im Backup-Bundle liegt das Passwort weiterhin im Klartext (Restore braucht es).
- `MqttPage.tsx`: Passwort-Input zeigt bei `passwordSet` einen Platzhalter
  („gespeichert — leer lassen zum Behalten"); `DEFAULT` um `passwordSet` ergänzt.
- `types.ts`: `MqttSettings.password` als write-only kommentiert, `passwordSet`
  ergänzt.
- `openapi.yaml`: `MqttSettings`-Schema (`password` readOnly `const ""`,
  `passwordSet` neu), Endpoint-Beschreibungen `GET`/`POST /api/settings`,
  Backup-Bundle-Hinweis, Top-Level-„No authentication"-Absatz.

**Löschen im UI:** Nachgereicht — bei gespeichertem Passwort zeigt das leere
Feld ein „x"; Klick markiert „wird beim Speichern gelöscht" (rückgängig
machbar), `doSave` schickt dann `mqtt.password: null`.

**Verifikation:** `pio run -e lilygo_t_display_s3_amoled` grün, `pnpm typecheck`
grün, `redocly lint` valide. HW-E2E am LilyGo S3 (`192.168.178.87`, per USB/COM9):
`GET` zeigt nie das Passwort, `passwordSet` korrekt; Setzen (`"brewpass"`) →
`passwordSet:true`, Broker reconnected (`connected:true`); leerer Round-Trip
behält das Passwort; `null` löscht es (`passwordSet:false`); Backup-Bundle trägt
das Passwort weiter. Board am Ende mit leerem Passwort hinterlassen.

## 2026-09-02/03 — Settings-UI-Überarbeitung (5 Teilschritte)

Der Backlog-Cluster aus PLAN.md komplett abgearbeitet, ein Commit pro Punkt.
Reine Frontend-Arbeit — keine API-Änderung, `openapi.yaml`/`types.ts` unberührt.

**1. `PageShell` + Breitenbegrenzung.** Der Container-String
`min-h-full bg-bg p-4 text-fg md:p-6` war in 14 Seiten kopiert; die Karten liefen
auf breiten Screens über die volle Fensterbreite. Neue Komponente `PageShell`
kapselt den Container und legt eine zentrierte Spalte mit `max-w-4xl` (896 px)
darüber. `LogsPage`/`ArchivePage` nutzen `wide` (uPlot-Charts), `Dashboard` bleibt
unangetastet — sein `lg:flex`-Grid verträgt keinen zusätzlichen Wrapper.
Nebenbei den `FirmwarePage`-Ausreißer (`p-6`, „Lädt…") eingesammelt.

**2. Spinner + Skeleton.** Das Projekt hatte weder Spinner noch Skeleton — alle
Ladezustände waren nackter Text (8× „Laden…", 1× „Lädt…"), durchgehend als
Early-Return, wodurch Breadcrumb und Header verschwanden und beim Eintreffen der
Daten zurücksprangen. Neu: `Spinner` (WinUI-ProgressRing in `currentColor`,
Tailwind-`animate-spin` — keine eigenen Keyframes nötig) und `Skeleton`
(`SkeletonBar`/`SkeletonCard`/`SkeletonList`; `SkeletonCard` spiegelt die
Flächenklassen von `SettingsCard`, damit der Wechsel nichts verschiebt). Alle
Settings-Seiten halten ihren Header jetzt über der Ladeanzeige (`header`-Const
statt dupliziertem Breadcrumb). `LogsPage`/`ArchivePage` bekamen ein
`loaded`-Flag — sie konnten „lädt" bisher nicht von „leer" unterscheiden.
Spinner ersetzt die Busy-Texte in `ConfirmModal` (Label bleibt stehen, das
englische „Working…" entfällt), `FirmwarePage` und `NetworkPage`.

**3. Konnektivitäts-Unterseite.** Neue `ConnectivityPage` unter
`/settings/connectivity`; MQTT, Webhook und ESP-NOW auf
`/settings/connectivity/{mqtt,webhook,espnow}` umgezogen, damit URL und
Breadcrumb deckungsgleich bleiben. Index von 11 auf 9 Einträge.

**4. Geräteliste.** `DeviceRow` hatte die Flächenklassen von `SettingsCard`
dupliziert und eine vierte Badge-Variante (`bg-fg/10`) erfunden; die Icon-Buttons
hatten weder Padding noch Fokus-Ring; es gab keinen Empty-State; und
`startEdit()` verschluckte Fehler per `catch {}`, während der Klick auf den Stift
für die Dauer von `getConfig()` tot wirkte. Jetzt: `SettingsCard` mit dem Badge
als gedämpfte Zweitzeile, 32-px-Trefferflächen mit WinUI-Subtle-Hover, Spinner
auf der betroffenen Zeile, Fehlerausgabe, Empty-State.

**5. Filemanager.** `setDir()` aktualisierte die Pfadleiste sofort, während die
Tabelle bis zur Antwort von `listFiles()` noch die Dateien des *alten* Ordners
auflistete — die Seite behauptete kurzzeitig, diese Dateien lägen im neuen
Ordner. Beim ersten Mount blitzte zusätzlich „Leer" auf. Neues `dirLoading`-Flag
im `[dir]`-Effect: solange es steht, rendert der `tbody` Skeleton-Zeilen und die
Pfadleiste einen Spinner. Die In-Place-Refreshes nach Delete/Rename/Upload setzen
es bewusst nicht — dort ist der stehende Inhalt korrekt.

**Verifikation:** `pnpm typecheck` und `pnpm build` grün. Browser-Durchgang gegen
den LilyGo S3 (`brewcontrol.local`, 192.168.178.87) auf 1400×900 und 375×812, in
Light und Dark: 896-px-Spalte zentriert (mobil unverändert), Skeleton mit
stehendem Breadcrumb und ohne Layout-Sprung beim Umschalten, Spinner in
„Netzwerke suchen" und auf dem Stift der Geräteliste, alle drei neuen
Konnektivitäts-Routen als Deep-Link (SPA-Fallback am Gerät per curl bestätigt),
Filemanager beim Ordnerwechsel ohne widersprüchliche Liste und mit weiterhin
korrektem „Leer" bei tatsächlich leerem Verzeichnis. Console durchgehend
fehlerfrei. Nicht praktisch ausgelöst: der Empty-State der Geräteliste (Testboard
hat Items) und der `ConfirmModal`-Spinner (Auslösen hätte gelöscht bzw. rebootet)
— beide typgeprüft, der Spinner ist dieselbe Komponente wie in den verifizierten
Fällen.

**Nebenbefund (nicht gefixt, in PLAN.md eingetragen):** `GET /api/files` hängt
reproduzierbar auf `/logs/3ca049` (Verbindung steht, keine Antwort), ebenso
`GET /api/logs/3ca049/sessions`; andere Pfade inkl. `/www/assets` funktionieren.
Dazu: die englischen Default-Labels von `ConfirmModal` („Confirm"/„Cancel"), die
sechs Aufrufer ungesetzt lassen.

**Bewusst nicht angefasst:** die 3× duplizierte Save-Bar (Mqtt/Webhook/EspNow),
der 5× duplizierte Reboot-Vollbildschirm, die 2× nachgebaute ProgressBar und der
10× wiederholte `pl-9`-Ausricht-Hack in den Karten — jeweils außerhalb des
Auftrags.

## 2026-09-03 — Fix: `/api/files` und `/api/logs/:id/sessions` hängen auf einem Log-Session-Verzeichnis

**Root Cause (zwei Ebenen).** `LogStore::LogCfg::sessionStart` war reine
Laufzeit-State und wurde nie zurückgelesen — obwohl `serialize()` den `session`-Key
längst schreibt. Nach jedem Reboot war `sessionStart == 0`, und der nächste
Sample-Tick legte in `writeEmitted_` eine neue `/logs/<id>/<epoch>.csv` an. Bei den
im Betrieb üblichen Reboots (WiFi-Self-Heal `ESP.restart()` nach 5 min Link-Verlust,
jedes Reflash) füllt das ein Log-Verzeichnis über die Zeit mit dutzenden bis
hunderten Stub-CSVs; das Byte-Budget von `pruneToBudget_` (200 MB) löst bei 2-KB-
Dateien nie aus. Zweitens machten beide Endpunkte dieselbe Operation:
`serializeSessions` bzw. der `/api/files`-Listing-Zweig laufen synchron auf dem
AsyncTCP-Task durch einen `openNextFile()`-Sweep des ganzen Verzeichnisses unter
`SdLock` — pro Eintrag `open`+`name`+`size`+`close` über SPI-SD, JSON komplett im
RAM, `req->send()` erst nach dem kompletten Sweep. `Einträge × Pro-Eintrag-Kosten`
übersteigt den Client-Timeout; der Sweep hält dabei `SdLock` und pausiert
`LogStore::tick()` (die laufende Aufzeichnung). `/api/snapshot` bleibt ok, weil es
weder SD noch `SdLock` anfasst.

**Umsetzung** (Branch `fix/logs-session-dir-hang`, 2 Commits, firmware-only):

1. *Session über Reboots fortsetzen.* `loadFromSD` liest den `session`-Key;
   `tick()` persistiert nach einer Session-Neuanlage einmalig via `saveToSD`
   (Muster von `ProgramRunner::tick`); `writeEmitted_` schreibt die Kopfzeile auch,
   wenn eine fortgesetzte Session ihre Datei verloren hat (Karte gewechselt /
   extern gelöscht). Config-Änderung (`update()`) und „Löschen" (`clear()`) starten
   wie bisher eine frische Session.
2. *Session-Liste aus RAM-Spiegel.* `LogCfg` führt `std::vector<SessionMeta>`
   (`start`, `size`), gefüllt von `scanSessions_` einmalig beim Boot, in Step
   gehalten von `writeEmitted_` / `deleteSession` / `pruneToBudget_`.
   `serializeSessions` liest nur noch den Spiegel — kein SD-Zugriff, kein `SdLock`,
   sofortige Antwort. Response-Shape (`start`/`size`/`active`) unverändert, daher
   `openapi.yaml` / `types.ts` unangetastet.

`GET /api/files` behält seinen Sweep bewusst: generischer Dateimanager, und die
`/logs/<id>/`-Verzeichnisse bleiben mit der Session-Persistenz jetzt klein.
Zusätzlich `delay(0)` alle 64 Einträge im Boot-Scan (`scanSessions_` läuft in
`setup()` vor `webUI.begin()`), damit ein überraschend großes Verzeichnis den
Boot nicht wedged.

**Verifikation:** `pio run -e esp32dev` und `-e lilygo_t_display_s3_amoled` grün.
Baseline am LilyGo S3 reproduziert (`/api/logs/3ca049/sessions` und
`/api/files?path=/logs/3ca049` ohne Antwort, >60 s; `/api/files?path=/logs`
90 ms). Bereinigung: SD-Karte gezogen, `/logs/3ca049/` samt Demo-Log-Config
gelöscht. Firmware `9690d13` per OTA geflasht, dann Test-Log (2 s Intervall)
angelegt: `session` landet sofort in `/config/logs.json`; `.../sessions` liefert
den Eintrag in ~15 ms aus dem RAM-Spiegel; `/api/files` auf das Session-Verzeichnis
< 40 ms. Nach Reboot: `session`-Epoch unverändert, **eine** CSV mit **einer**
Kopfzeile, Zeilen laufen über die Reboot-Lücke im selben File weiter, Boot-Scan
füllt den Cache. Test-Log wieder entfernt.

**Nebenbefund:** die englischen `ConfirmModal`-Default-Labels
(„Confirm"/„Cancel") am 2026-09-03 gefixt (Eintrag unten).

## 2026-09-03 — Frontend: deutsche ConfirmModal-Defaults + Feedback nach leerem Bus-Scan

Zwei kleine UI-Punkte aus PLAN.md abgehakt.

1. *`ConfirmModal`-Default-Labels.* `confirmLabel`/`cancelLabel` defaulteten auf
   „Confirm"/„Cancel"; sieben Aufrufer (DevicesPage, EspNowPage, MqttPage,
   WebhookPage, NetworkPage 3×) setzen kein `cancelLabel` und zeigten dadurch
   einen „Cancel"-Button in der sonst deutschen UI. Defaults auf
   „Bestätigen"/„Abbrechen" umgestellt — eine Zeile in `ConfirmModal.tsx`, kein
   Aufrufer angefasst.
2. *Bus-Scan ohne Treffer.* Der Hint im DS18B20-Sensorformular
   (`AddItemModal.tsx`) war vor und nach einem ergebnislosen OneWire-Scan
   identisch. Neues `scanned`-Flag (true nach erfolgreichem Scan, zurückgesetzt
   bei Pin-Änderung / Modal-Open): vor dem Scan weiter „Scan ausführen um Geräte
   … zu finden", nach einem leeren Scan stattdessen ein `text-caution`-Hinweis
   „Kein Gerät auf diesem Bus gefunden — Verkabelung und Pull-up prüfen".

Keine API-Änderung. `pnpm typecheck` + `pnpm build` grün. Browser-Pane gegen das
Testboard (LilyGo S3-AMOLED): ConfirmModal auf der Geräteseite zeigt
„Abbrechen"/„Löschen". OneWire-Scan auf dem unbelegten GPIO 10 (Header-Pin, kein
Strapping/Flash, keine Config-Belegung) → `.../api/bus/scan` liefert `[]`, der
`text-caution`-Hinweis erscheint; Pin-Änderung setzt zurück auf „Scan ausführen
…". Board danach unverändert erreichbar (`/api/snapshot` 120 ms).

## 2026-09-03 — Fix: Collection-POST-Routen akzeptierten GET/PUT/PATCH statt `405`

**Root Cause.** Alle elf JSON-Body-Routen in `WebUI.cpp` (`/api/sensors`,
`/api/actuators`, `/api/controllers`, `/api/network`, `/api/dashboards`,
`/api/logs`, `/api/programs`, `/api/settings`, `/api/backup`,
`/api/files/mkdir`, `/api/files/rename`) hingen an
`AsyncCallbackJsonWebHandler`. Dessen Default-Methodenset ist
`HTTP_GET|POST|PUT|PATCH` und sein URI-Matcher ist ein Prefix-Matcher
(`^uri(/.*)?$`). Dadurch landete z.B. `GET /api/sensors` im Create-Handler und
antwortete `400 missing id` statt `405`; `PUT /api/dashboards` fiel (mangels
JSON-Content-Type) in den Catch-all → `404`.

**Umsetzung.** Neue `PostJsonHandler`-Klasse (anon. namespace in `WebUI.cpp`,
neben den bestehenden `BodyPrefixHandler`/`GetPrefixHandler`/`DeletePrefixHandler`):
exakter Pfad-Match statt Prefix, nur `POST`, parst den JSON-Body in einem Chunk
und übergibt eine `JsonVariant`. Jede andere Methode → `405 method not allowed`,
leerer Body → `400 missing body`, kaputtes JSON → `400 invalid JSON`, mehrere
Chunks → `413`. Alle elf `new AsyncCallbackJsonWebHandler(...)` 1:1 auf
`new PostJsonHandler(...)` umgestellt, die Handler-Lambdas unverändert.
`#include <AsyncJson.h>` in `WebUI.cpp` entfernt (nur noch von
`WiFiSetupPortal.cpp` mit eigenem Include genutzt). Da der Match jetzt exakt ist,
sind die „registered last / before create handler"-Ordnungs-Kommentare an den
Delete-/Body-Prefix-Handlern hinfällig und entfernt.

Der `GET /api/files`-Dateibrowser hing an einem Prefix-Match (`GetPrefixHandler`)
und fing dadurch auch `GET /api/files/mkdir` / `.../rename` ab (→ `400 missing
path` statt `405`). Auf zwei exakte Registrierungen umgestellt
(`server_.on(AsyncURIMatcher::exact("/api/files")…)` +
`…exact("/api/files/download")…`), sodass diese GETs zum jeweiligen
POST-only-`PostJsonHandler` durchfallen.

Kein OpenAPI-Vertrag betroffen — die dokumentierte Methode je Pfad bleibt gleich;
`405` für undokumentierte Methode+Pfad ist Standard und wird (wie `404` für
unbekannte Pfade) nicht als Vertrag geführt.

**Verifikation.** `pio run -e esp32dev` + `-e lilygo_t_display_s3_amoled` grün.
S3-AMOLED (`brewcontrol.local`) über USB geflasht, danach Methoden-Matrix:
`GET`/`PUT`/`PATCH`/`DELETE` auf `/api/sensors`, `/api/actuators`,
`/api/controllers` → `405`; `PUT /api/{dashboards,logs,settings,network}`,
`GET`/`PUT /api/files/mkdir`, `GET`/`PATCH /api/files/rename` → `405`;
`GET /api/{dashboards,logs,programs,settings,backup}`, `GET /api/files?path=/`
und `GET /api/files/download?path=…` weiter `200`. Echter Roundtrip
`POST /api/sensors {DS18B20,__mtest,pin 15}` → `204`, taucht im Snapshot auf,
`DELETE /api/sensors/__mtest` → `204`, wieder weg. `POST` mit kaputtem/leerem
Body → `400 invalid JSON` / `400 missing body`.

## 2026-09-03 — Settings-UI: zwei offene UI-Zustände am Gerät verifiziert; QEMU-Punkt entfernt

Die beiden seit dem WinUI-Redesign nur typgeprüften `DevicesPage`-Zustände am
esp32dev-Testboard (`brewcontrol-esp32dev.local`, leere Config) live
gegengecheckt — kein Reflash nötig, Create/Delete lief auf der vorhandenen
Firmware:

- **Empty-State der Geräteliste** — bei leerem Snapshot rendert
  `/settings/devices` „Noch keine Geräte konfiguriert — über ‚+ Hinzufügen'
  anlegen." statt einer leeren Seite. Screenshot im PR.
- **`Spinner` im `ConfirmModal`** — Test-Sensor (`DigitalInput __mtest`, Pin 34)
  angelegt, Löschen bestätigt; während des DELETE-Roundtrips zeigt der
  Löschen-Button den Spinner, beide Buttons sind `disabled`, Backdrop-Klick
  blockiert. Danach Modal zu, Item weg, Board sauber.

`PLAN.md` → „Bugs & bekannte Einschränkungen": beide Punkte raus. Ebenfalls
ersatzlos entfernt: die Alt-Notiz „QEMU/Simulation ist nicht viable" — das Thema
ist abschließend geklärt (keine WiFi-Emulation für ESP32, Verifikation läuft
immer am Gerät), die Historie steht in [SESSION-archive.md](SESSION-archive.md)
(Pre-MVP 2026-05-17–20). Kein Code, kein API-Vertrag betroffen.

## 2026-09-04 — Mobile FAB für Geräte/Logs-Hinzufügen und Datei-Upload

Die primären Aktions-Buttons (Geräte „+ Hinzufügen", Logs „+ Neues Log",
Dateiverwaltung „+ Ordner"/„Hochladen") saßen bislang nur im Seiten-Header —
auf Mobilgeräten mit dem Daumen schlecht erreichbar. Neue Komponente
`components/Fab.tsx` (`Fab` für Einzelaktion, `SpeedDialFab` für mehrere)
ersetzt sie unterhalb `md:` (768px) durch einen fixed Bottom-Right-Button;
ab `md:` bleiben die Header-Buttons unverändert, der FAB verschwindet.
Dateiverwaltung bekommt echten Speed-Dial (Tap fährt „Ordner“ + „Hochladen“
mit Labels aus). Eingebunden in `DevicesPage.tsx`, `LogsPage.tsx`,
`FilesPage.tsx`.

Dabei zwei Nebenbugs in `FilesPage.tsx` gefixt (User-Report per
Screenshot-Annotation): die Icons in den „+ Ordner"/„Hochladen"-Buttons waren
durch den Wechsel auf `hidden md:inline-flex` nicht mehr vertikal zentriert
(alter `-mt-0.5 inline`-Hack passte nicht mehr zum jetzt flexen Container —
gefixt mit `items-center` statt Margin-Hack); und lange Ordnernamen wurden bei
Zeilenumbruch zentriert statt linksbündig dargestellt (Ursache: `<button>` hat
laut Browser-UA-Stylesheet `text-align: center`, mit `text-left` übersteuert).

**Verifikation.** `pnpm typecheck` grün. Alle drei Seiten im Browser-Preview
(Mobile-Viewport 375×812) durchgeklickt: FAB öffnet Geräte-/Log-Modal direkt,
Speed-Dial fährt in Dateiverwaltung korrekt aus, `disabled`-Zustand
(`dirProtected`/laufender Upload) greift weiter. Ab `md:` (getestet bei
1280×900) FAB weg, Header-Buttons wie vorher. Kein Hardware-Test nötig (reine
Web-UI-Änderung).

## 2026-09-04 — Programmsteuerung: mobiles Bottom Sheet mit Drag-Geste + Redesign

Die `ProgramCard` (Programmsteuerung, z.B. Maischeprogramm mit
Fortsetzen/Zurück/Weiter/Stop) saß bei genau einem Dashboard-Programm auf
Mobile/Tablet `sticky` nahe dem oberen Rand — kollidierte beim Scrollen
visuell mit Chart-Inhalten darunter, schlecht mit dem Daumen erreichbar, und
die halbtransparente Fluent-Card (`bg-card`) ließ beliebigen Seiteninhalt
durchscheinen (User-Report per Screenshot-Annotation).

Umgebaut zu einem fixed Bottom Sheet (`components/ProgramCard.tsx`):
opaker/Acrylic-Hintergrund (`bg-surface-acrylic` + `backdrop-blur-md`, wie
die mobile `NavShell`-Kopfzeile — erst opak `bg-surface` versucht, dann auf
Wunsch des Users auf Acrylic umgestellt, da der Blur das Bleed-Through-Problem
löst ohne auf den Look verzichten zu müssen), abgerundete Oberkante,
Drag-Handle mit echter Swipe-Geste (Pointer-Events: `beginDrag`/`moveDrag`/
`endDrag`, `liveHeight`-State treibt `max-height` der Schrittliste live
während des Ziehens; Tap ohne nennenswerte Bewegung togglet stattdessen
direkt). `Dashboard.tsx` bekommt einen Bottom-Spacer, damit der fixed Sheet
den letzten Seiteninhalt nicht dauerhaft verdeckt. Desktop (`lg+`, normale
Sidebar-Card) und der Mehrfach-Programm-Fall (normale Inline-Card, kein
Sheet) bleiben unverändert.

Zusätzlich Redesign des Karteninhalts nach einem vom User gezeigten
Claude-Design-Mockup (Optik only, alle bestehenden Aktionen/Zustände
unverändert): Dokument-Icon + Status-Pill im Header (neuer `badgeAccent`-
Token in `ui.ts` ersetzt das hartkodierte Sky-Blau des „pausiert“-Zustands),
großer „Hero“-Block für den aktuellen Schritt (Schrittname, Countdown nur
bei `running`, Zieltemperatur, dünner Fortschrittsbalken, „X / Y min“),
nummerierte/Haken-Kreise in der Schrittliste, größere Icon-Buttons
(Play/Pause/SkipBack/SkipForward/Square) in einer per CSS-Grid
(`grid-flow-col auto-cols-fr`) gleichmäßig verteilten Zeile statt der alten
Text-Glyph-Buttons in `flex-wrap` (die bei schmaler Spalte auf zwei Zeilen
umbrachen und rechts Leerraum ließen). Die alte Mobile-Zusammenfassungs-Zeile
(„Einmaischen · 68° · noch 5:16“) entfällt, sobald der Hero-Block sichtbar
ist — reine Dopplung; bleibt für den Idle/Done-Fall (kein Hero) als einzige
Info-Quelle erhalten. `var(--accent)` durchgängig statt hartkodierter Farben,
bleibt mit der konfigurierbaren Akzentfarbe (`AppearancePage.tsx`) konsistent.

**Verifikation.** `pnpm typecheck` grün. Drag-Geste per dispatchten
`PointerEvent`s getestet (das Browser-Preview-Tool simuliert selbst keine
echten Pointer-Events für Drag) — Hoch-/Runterziehen und reiner Tap
funktionieren, kein Doppel-Toggle. Alle Programm-Status durchgespielt
(inkl. echtem Pause/Resume-Zyklus am Testboard) — Badges, Buttons, Hero-
Block reagieren korrekt. Desktop-Sidebar und Mehrfach-Programm-Fall ohne
Regression. Acrylic-Effekt per `getComputedStyle` verifiziert
(`backdrop-filter: blur(12px)`).

## 2026-09-04 — Profil-Bibliothek („Profilmanager")

Backlog-Punkt aus `PLAN.md` umgesetzt: wiederverwendbare Schritt-Vorlagen, die
sich in ein Sollwert-Programm kopieren lassen, statt jede Maische-/Gärfolge neu
einzutippen. Entscheidungen vorab mit dem User geklärt: Kategorien sind Pflicht
und werden als Tabs auf der Profile-Seite verwaltet (gleiche Mechanik wie die
Dashboard-Tabs), der Controller bleibt Sache des Programms, und ein Profil
anzuwenden **ersetzt** die vorhandenen Schritte nach Rückfrage.

**Firmware** — neuer `ProfileStore` (`firmware/src/ProfileStore.h/.cpp`) nach dem
Vorbild `DashboardStore`: `SdLock`, Silent-Return bei fehlender/kaputter Datei,
kein Mutex (nur REST-Handler im AsyncTCP-Task), Ids per `%06lx` wie Dashboards
und Logs. Persistenz in `/config/profiles.json` als
`{"categories":[…],"profiles":[…]}`; ein Profil ist `{id,name,category,steps[]}`
mit derselben Step-Form wie ein Programm (`name?`,`setpoint`,`holdSec`,`confirm`),
`name`/`confirm` werden beim Serialisieren weggelassen wenn leer/false. Kategorie
ist Pflichtfeld, deshalb kaskadiert `removeCategory()` in die enthaltenen Profile.
Routen in `WebUI.cpp` analog zum Dashboards-Block: `GET/POST /api/profiles`,
`POST/DELETE /api/profiles/:id`, plus `POST /api/profile-categories` und
`POST/DELETE /api/profile-categories/:id` — eigener Pfad-Stamm, damit weder der
`/api/profiles/`-Prefix-Handler noch eine Profil-Id die Kategorien verschattet;
kein eigenes GET, die Kategorien reisen in `GET /api/profiles` mit.

**Backup** — `GET /api/backup` bündelt jetzt zusätzlich `/config/profiles.json`.
Beim Restore ist die Sektion **optional** (Bundles älterer Firmware haben sie
nicht und bleiben importierbar); fehlt sie, bleibt die Datei unangetastet.
`version` bleibt 1, weil eine additive optionale Sektion keinen Konsumenten
bricht.

**Frontend** — neue Top-Level-Seite `/profiles` (`pages/ProfilesPage.tsx`,
Gerüst aus `LogsPage`) mit Kategorie-Tabs, „Kategorien"-Edit-Modus (Stift am
aktiven Tab, `+ Neu`), Profil-Rows mit „N Schritte · Dauer", Löschen über
`ConfirmModal` — beim Kategorie-Löschen mit Anzahl der betroffenen Profile im
Text. `components/ProfileEditorModal.tsx` ist der Schritt-Editor des Programms
ohne Regler-Select, dafür mit Kategorie-Select und (anders als das Original)
`pending`/`err`-State. Der `ProgramEditorModal` bekam zwei optionale Props:
`library` für „Aus Profil befüllen" (Select mit `optgroup` je Kategorie,
Rückfrage nur wenn schon Schritte erfasst sind) und `onSaveAsProfile` für die
Gegenrichtung — das Dashboard rendert dafür den `ProfileEditorModal` als
Geschwister nach dem Programm-Dialog, vorbefüllt mit Name und Schritten.
Nav-Eintrag in `NavShell.mainItems` deckt Desktop-Rail und Hamburger-Drawer ab
(dasselbe `<nav>`).

Drei kleine Extraktionen, jeweils durch den zweiten Consumer ausgelöst:
`TabBtn` aus `Dashboard.tsx` in `components/TabBtn.tsx`, `DashboardMetaModal` →
`components/NameModal.tsx` (generisch über `title`/`submitLabel`/`placeholder`,
`initial?: { name: string }`), und `fmtDuration` aus `ProgramCard.tsx`
exportiert.

**Verifikation:** `pio run -e esp32dev` und `-e lilygo_t_display_s3_amoled` grün;
`npx @redocly/cli lint` valide (nur die bekannte `license`-Warnung);
`pnpm typecheck` grün. UI-Flows im Dev-Server durchgespielt (Endpoints per
In-Page-Stub bedient, da das Testboard noch die alte Firmware fährt): Kategorie
anlegen/umbenennen, Profil anlegen (15 min → `holdSec` 900, Metazeile
„1 Schritt · 15:00"), Profil in ein leeres Programm übernehmen (ohne Rückfrage)
und in ein gefülltes (Rückfrage; Abbrechen lässt die Schritte stehen), Programm
als Profil speichern (Schritte inkl. Namen landen im neuen Profil),
Kategorie-Löschen mit Kaskade („… zusammen mit 2 Profilen darin") → Empty-State.
Hamburger-Drawer im Mobil-Viewport zeigt „Profile" zwischen Dashboard und
Einstellungen. Dabei gefunden und gefixt: das `initial`-Objekt für den
Profil-Editor wurde bei jedem Render neu erzeugt, wodurch der Hydration-Effekt
erneut feuerte und Eingaben zurücksetzen konnte — jetzt `useMemo`.

**Offen:** E2E gegen echte Firmware auf dem Board (Flashen steht noch aus) —
Persistenz über Reboot, Backup-Roundtrip und Import eines Bundles ohne
`profiles`-Sektion sind damit noch nicht am Gerät bestätigt.

**Nebenbefund** (in `PLAN.md` → „Bugs & bekannte Einschränkungen" eingetragen,
nicht mitgefixt): Programm-Ids sind `p_XXXXX`, die OpenAPI-Spec pinnt sie auf
`^[0-9a-f]{6}$`; `Program.currentStep` ist als „-1 while idle" dokumentiert,
der Code setzt `0`.
