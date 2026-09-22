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

**HW-E2E** am LilyGo T-Display-S3-AMOLED (`brewcontrol.local` / 192.168.178.87),
Firmware `948c3c7` und UI-Paket per OTA eingespielt
(`/api/update/firmware` + `/api/update/assets`, beide `200 ok`, Assets-Upload
lief auf dem S3 wie erwartet durch): `GET /api/profiles` liefert direkt nach dem
Flash `{"categories":[],"profiles":[]}`. Kategorie anlegen → `201 {"id":"34489e"}`
(Format `^[0-9a-f]{6}$`, passt zur Spec), leerer Name → `400 invalid category`,
Profil mit unbekannter Kategorie → `400 invalid profile`. Profil mit drei
Schritten angelegt: der Schritt mit nicht-numerischem `setpoint` wurde still
verworfen, `confirm` nur beim gesetzten Schritt emittiert, `name` beim leeren
weggelassen. Umbenennen und Update je `204`, unbekannte Ids `404 not found` bzw.
`404 not found or invalid`. `/config/profiles.json` (165 B) auf der SD, Inhalt
identisch zur API-Antwort; nach einem Reboot (identische Firmware nochmal per OTA)
sind Kategorie und Profil unverändert da. Kategorie löschen → `204`, Bibliothek
danach leer (Kaskade greift). `GET /api/backup` enthält die `profiles`-Sektion in
der erwarteten Form. Die vom Board servierte UI (`/profiles` als Deep-Link → 200
über den SPA-Fallback) legt eine Kategorie an und zeigt Tab plus Empty-State,
keine Konsolenfehler.

**Dabei gefunden:** `POST /api/backup` scheiterte an jedem realistischen Bündel
mit `413 body too large` — siehe den eigenen Eintrag unten, der Fix kam direkt
hinterher. Danach ist auch der Optional-Pfad für `profiles` am Gerät bestätigt.

**Nebenbefund** (in `PLAN.md` → „Bugs & bekannte Einschränkungen" eingetragen,
nicht mitgefixt): Programm-Ids sind `p_XXXXX`, die OpenAPI-Spec pinnt sie auf
`^[0-9a-f]{6}$`; `Program.currentStep` ist als „-1 while idle" dokumentiert,
der Code setzt `0`.

## 2026-09-04 — Fix: `POST /api/backup` (Restore) scheiterte an jedem realen Bündel

**Root Cause:** `PostJsonHandler::handleBody()` und `BodyPrefixHandler::handleBody()`
(`firmware/src/WebUI.cpp`) akzeptierten nur Bodies, die in einem Stück ankommen
(`index == 0 && len == total`), und lehnten alles andere mit `413 body too large`
ab — es gab keine Body-Akkumulation. ESPAsyncWebServer liefert den Body aber
segmentweise, also scheitert jeder Request, der nicht in ein TCP-Segment passt
(~1,4 KB inkl. Header). Beim Backup-Restore steckt die ganze `/config` im Body:
das Bündel des LilyGo S3 ist 1656 B, der Restore war damit **unbenutzbar** —
auch über die UI, denn `restoreBackup()` (`web/src/api.ts`) postet dasselbe JSON.
Am Gerät eingegrenzt mit unschädlichen Proben (ungültiger `type`, wird vor jedem
Schreibzugriff abgewiesen): 1284 B → `400 not a brewcontrol backup`, ab 1384 B →
`413`. Vorbestehend; die Profil-Bibliothek hat das Bündel nur vergrößert.

**Umsetzung:** neuer Helper `collectBody()` im anonymen Namespace von `WebUI.cpp`,
beide Handler nutzen ihn. Einzel-Chunk-Bodies — der Normalfall für die kleinen
API-Payloads — gehen weiterhin ohne Kopie durch; größere sammeln sich in
`request->_tempObject`, das der Request-Destruktor freigibt (dasselbe Verfahren
wie im bibliothekseigenen `AsyncCallbackJsonWebHandler`). Obergrenze
`kMaxBodyBytes = 16384`; darüber weiterhin `413`, bei fehlgeschlagenem `malloc`
`500 out of memory`. `openapi.yaml`: `BodyTooLarge` neu beschrieben (nicht mehr
„kam nicht in einem Stück an", sondern „über 16 KB"), `/api/backup` um die bis
dahin gar nicht dokumentierte `413` und den `out of memory`-Fall ergänzt.

**Verifikation:** `pio run -e lilygo_t_display_s3_amoled` grün, `redocly lint`
valide. Am Board (Firmware per OTA): Proben 1368 B / 1684 B / 4984 B / 15984 B
kommen jetzt alle an (`400`, d.h. Body geparst), 16984 B → `413` wie vorgesehen.
Restore des Pre-OTA-Bündels **ohne** `profiles`-Sektion (1656 B) → `200 ok`,
Reboot, Dashboards und Settings restauriert, `/config/profiles.json` unangetastet
und die Bibliothek unverändert — der Optional-Pfad hält. Voller Roundtrip mit
einem Bündel **mit** Profilen (1872 B): exportieren, alle Kategorien löschen,
importieren → Kategorien und Profil kommen unverändert zurück. Randnotiz: die
allererste Anfrage direkt nach einem Boot lief einmal in ein `413`, danach nicht
mehr reproduzierbar — nicht weiter verfolgt.

## 2026-09-05 — HW-Nachtest: GPIO/LEDC-Leak-Fix (2026-08-14)

Der am 2026-08-14 umgesetzte Fix (`AnalogOutputActuator::end()` ruft
`ledcDetachPin()`; `DynamicItems::removeSensor`/`removeActuator` rufen beim
Löschen jetzt `end()`) hatte mangels Board keinen praktischen Nachtest —
jetzt am `esp32dev`-Testboard (192.168.178.74, zu Testbeginn leere Registry)
nachgeholt.

**Aufbau:** `AnalogOutputActuator` (PWM) auf GPIO4 angelegt, Jumperkabel
GPIO4 ↔ GPIO5, `DigitalInputSensor` mit `pullup:true` auf GPIO5 als Probe.
Baseline bestätigt: Aktor-Werte `v:1`/`v:0` spiegeln sich sofort und exakt in
der Probe — der aktive Push-Pull-Treiber überstimmt zuverlässig das schwache
interne Pull-up in beide Richtungen.

**Test:** Aktor bei `v:0` (GPIO4 aktiv LOW) ohne Reboot gelöscht. Direkt
danach blieb die Probe bei LOW — erwartet, da nichts den Pin zwischenzeitlich
auf `INPUT` umkonfiguriert (reines GPIO-Output-Register-Restverhalten, kein
Leak-Indiz für sich). Erst der eigentliche Nachtest laut PLAN.md-Formulierung
zeigt es: neuer `DigitalInputSensor` (`pullup:true`) exakt auf GPIO4 angelegt
(derselbe Pin wie der gelöschte Aktor) — `pinMode(INPUT_PULLUP)` greift
sauber, beide Pins (GPIO4 und die gejumperte Probe auf GPIO5) springen auf
HIGH. Kein LEDC-Kanal überschreibt den Pin mehr trotz `pinMode`-Wechsel — das
wäre bei unterbliebenem `ledcDetachPin()` der klassische ESP32-Fallstrick
(GPIO-Matrix-Routing überlebt einen reinen `pinMode()`-Aufruf).

**Ergebnis:** Fix bestätigt. Testsensoren wieder gelöscht, Board am Ende mit
leerer Registry hinterlassen (Ausgangszustand). PLAN.md-Eintrag entfernt.

## 2026-09-05 — PID-AutoTune: Fortschrittsanzeige + Korrektheits-Fix der Relay-Timing

Ausgangspunkt war der Backlog-Punkt „Fortschrittsanzeige/Restzeit" — bei der
Analyse aber ein grundlegenderer Bug gefunden: das vendorte `AutoTunePID`
(Tag `v1.1.6`, `SensActCtrl/library.json`) liest `currentInput` in
`performAutoTune()` nie, sondern kippt den Output stur alle 1000 ms für
`oscillationSteps` (Default 10) Schritte und berechnet Ku/Tu rein aus der
Wanduhr — für träge Prozesse (Kessel, Maischebottich) physikalisch
bedeutungslos (`Ku` reduziert sich algebraisch auf die Konstante `4/π`).
Vergleich mit dem Upstream-Repo zeigt: der `main`-Branch (Commit `34c6f39`,
kein Tag) hat eine vollständige Neufassung mit echter Hysterese-basierter
Relay-Rückkopplung (reagiert auf tatsächliche Sollwert-Kreuzungen, misst
reale Halbwellen-Perioden) und behebt nebenbei einen zweiten Bug
(Zähler/Zeitstempel waren `static`-Lokale statt Instanzfelder — mehrere
gleichzeitige AutoTune-Läufe hätten sich korrumpiert).

**Fix:** `library.json`-Pin auf den main-Commit umgestellt (Präzedenzfall für
Commit-Hash-Pins bereits vorhanden: `IdsInductionCooker.git#bf5be40`),
`PidEngine.h/.cpp` auf den neuen `atp::`-Namespace migriert. Da auch `main`
keinen Getter für den internen Halbwellen-Zähler/das konfigurierte
`oscillationSteps` hat: `PidEngine` ruft `setOscillationMode()` jetzt aktiv
selbst auf (nicht `setOscillationSteps()` direkt — das würde von einem
späteren `setOscillationMode()`-Aufruf überschrieben) und zählt reale Zyklen
über Flankenerkennung auf `getOutput()` (kippt bei jeder Kreuzung zwischen
zwei diskreten Werten — exakt, keine Off-by-one-Falle wie bei einer
`getTu()`-Änderungserkennung, die die erste Kreuzung verpasst hätte). Neue
Felder `autotuneCyclesObserved`/`autotuneCyclesTotal` in `paramsJson()`,
OpenAPI und `types.ts`. Frontend: neue Komponente `AutotuneProgress.tsx`
(horizontaler 3-Phasen-Stepper „Anfahren → Schwingung → Fertig" + %-Balken,
keine Zeitanzeige), in `ControllerCard.tsx` und `AddItemModal.tsx` eingesetzt.

**Bekannte Einschränkung:** `main` ist kein offizielles Release — Arduino-IDE-
Library-Manager-Nutzer (`library.properties`) bekämen weiterhin `v1.1.6`.
In PLAN.md vermerkt.

**Verifikation:** `pio test -e native` (SensActCtrl, 196 Tests inkl. 4 neue
grün), `pio run -e esp32dev` (BrewControl/firmware, zieht den neuen Pin,
kompiliert gegen `atp::`), `redocly lint` valide, `pnpm typecheck` clean.
Echte Zyklen-Numerik auf echter Hardware noch offen (PLAN.md-Hardware-Item
ergänzt).

## 2026-09-05 — Reihenfolge Auth/Push/HTTPS geklärt + Zugriffsschutz umgesetzt

**Auslöser:** Beobachtung, dass `esp-webPush` JWT-Klassen mitbringt, die man
„auch für Auth bräuchte" — plus die PLAN.md-Annahme, HTTPS sei harte
Voraussetzung für Push. Beide Annahmen halten der Prüfung nicht stand.

**Recherche-Ergebnis:**

- **Kein geteilter JWT-Baustein.** `esp-webPush` implementiert VAPID-JWT nach
  RFC 8292 (ES256/P-256-ECDSA über mbedTLS), um das *Gerät gegenüber dem
  Push-Service* zu authentisieren — lib-intern, nicht als allgemeine JWT-API
  exponiert. Ein Login braucht ein symmetrisches, kurzlebiges Session-Token;
  ECDSA-Verify pro API-Request wäre auf dem ESP32 die falsche Größenordnung.
  Gleicher Name, anderer Algorithmus, anderes Threat-Model.
- **`esp-webPush` braucht kein Server-TLS** — es ist HTTPS-*Client*, das läuft
  längst (`FirmwareUpdater.cpp:98`, `MqttService.cpp:56`). Der Secure-Context-
  Zwang trifft nur die Seite, die den Service Worker registriert.
- **Self-signed trägt für Push nicht** — Chrome verweigert SW-Registrierung bei
  Zertifikatsfehlern (w3c/ServiceWorker#1514, Chromium 40423989); der in
  PLAN.md notierte Weg „User akzeptiert einmalig" ist tot.
- **Server-TLS wäre teuer** — `esp32async/ESPAsyncWebServer`+`AsyncTCP` haben
  keinen Server-TLS-Pfad (me-no-dev#899; TLS nur client-seitig im
  tve/AsyncTCP-Fork), bliebe `esp_https_server` mit ~50 Routen, SSE und zwei
  Upload-Pfaden.

**Entschiedene Reihenfolge:** Auth → Web Push über gehosteten Bootstrap-Origin
→ HTTPS (entkoppelt, optional). Damit fällt der teuerste Punkt aus dem
kritischen Pfad, auch für Installationen bei anderen, die sonst zuhause
HTTPS einrichten müssten. Push-Design und HTTPS-Varianten stehen in PLAN.md.

**Umgesetzt: Stufe 1 — Zugriffsschutz (optional, Lesen frei, Schreiben
geschützt).**

Neue Klasse `AuthService.{h,cpp}`: salted, 10k-fach iteriertes SHA-256 über
`mbedtls_md` (versionsstabil über mbedTLS 2.x/3.x), Credentials in
`Preferences("brewctrl")` — derselben NVS-Namespace wie die WLAN-Daten. Das
hält das Secret aus `GET /api/settings`, aus dem Backup-Bundle und von der
SD-Karte fern und macht den bestehenden BOOT-Tasten-Factory-Reset
(`main.cpp:131`, `prefs.clear()`) ohne eine Zeile Extra-Code zum
„Passwort vergessen"-Pfad. Sessions: 4 Slots, opake 16-Byte-Tokens aus
`esp_random()`, 7 Tage Gleitablauf, wrap-sichere `millis()`-Vergleiche,
Constant-Time-Compare. Bewusst **nur RAM** — persistierte Sessions bräuchten
Epoch-Zeit statt `millis()` und damit einen synchronisierten NTP-Stand.

**Kein separates `enabled`-Flag:** `isConfigured()` ist die einzige Wahrheit.
Kein Passwort ⇒ jedes Gate ist ein No-op, Bestandsgeräte bleiben nach dem
Update unverändert offen. Schutz einschalten = Passwort setzen, ausschalten =
löschen.

**Cookie statt Bearer-Header**, weil `EventSource` keine Custom-Header setzen
kann — ein Token im Header hätte `/api/events` unlösbar gemacht. Cookies fahren
same-origin automatisch mit, deshalb blieben alle 31 `fetch()`-Aufrufstellen in
`api.ts` inhaltlich unangetastet.

**Gate-Schnitt in `WebUI.cpp`:** Die Prüfung sitzt in den drei generischen
Handler-Klassen (`BodyPrefixHandler`, `DeletePrefixHandler`, `PostJsonHandler`)
statt an ~30 Registrierungsstellen; `requireAuth()` nimmt `/api/auth/*` aus
(sonst wäre Login unmöglich). Explizit nachgezogen an den fünf Roh-Routen
(`wifi-reset`, `update/firmware`, `update/assets`, `files` DELETE,
`files/upload`). Die beiden OTA-Uploads brauchten dafür ein
`uploadUnauthorized_`-Flag analog zum vorhandenen `fileUploadRejected_` — ohne
das hätte der finale Chunk ein zweites Mal geantwortet.

**Nebenbei geschlossen:** `GET /api/backup` gab das MQTT-Passwort im Klartext
aus (`SettingsStore::serialize()` emittiert `mqtt.password`,
`WebUI.cpp:788` schwärzt es nur für `GET /api/settings`). Als einzige Leseroute
liegt das Backup jetzt hinter dem Gate.

**Frontend:** zentrale `failed()`-Fehlerbahn in `api.ts` (alle 30 identischen
Fehlerzeilen umgestellt), die bei 401 einmalig `bc:unauthorized` feuert;
`app.tsx` öffnet darauf das neue `LoginModal.tsx`. Neue Seite
`SecurityPage.tsx` (Einstellungen → Zugriffsschutz): einrichten, ändern,
aufheben, alle Sitzungen abmelden — ohne An/Aus-Toggle, passend zum
Firmware-Modell. Antwortet das Gerät nicht auf `/api/auth/status` (ältere
Firmware), zeigt die Seite das explizit an, statt „ungeschützt" zu raten oder
im Skeleton hängen zu bleiben.

**Verhalten bei Hostnamen-Änderung** (durchgespielt, kein Sonderfall-Code
nötig): Passwort überlebt (`POST /api/network` macht `putString`, kein
`clear()`), das Cookie nicht — es hängt am alten Host. Gleiches gilt schon
immer zwischen IP und `.local`: zwei Origins, zwei Anmeldungen. In README
dokumentiert.

**Grenze, bewusst so:** ohne TLS geht das Passwort beim Anmelden im Klartext
über das LAN. Schutz gegen Fehlbedienung und beiläufige Zugriffe, nicht gegen
einen aktiven Angreifer im Segment. Challenge-Response wurde verworfen — es
schließt nur passives Mitlesen, solange das JS selbst über http kommt.

**Verifikation:** `pio run -e esp32dev` grün, Δ gegen HEAD gemessen (Baseline-
Build mit zurückgesetzten Quellen): Flash 1 408 453 → 1 415 325 B (74,1 % →
74,5 %), RAM 52 128 → 52 320 B (+192 B). `pnpm typecheck` clean, `pnpm build`
grün, `redocly lint` valide (die bisher unterdrückte `security-defined`-Warnung
ist damit erledigt; `info-license` war schon vorher offen). Im Browser gegen
den Vite-Dev-Server geprüft: Settings-Eintrag da, Login-Modal rendert korrekt,
und der Degradationspfad griff live — das Gerät unter `brewcontrol.local`
läuft noch mit alter Firmware und antwortet 404 auf `/api/auth/status`.

**Hardware-E2E am LilyGo T-Display-S3-AMOLED (`brewcontrol.local`,
192.168.178.87) — vollständig grün.** Firmware geflasht (COM9, Hash verifiziert,
Flash 20,5 % / RAM 15,5 % auf dem 16-MB-Board), UI-Paket über
`POST /api/update/assets` nachgezogen (4,3 s, neues Bundle wird ausgeliefert).

Durchlauf in dieser Reihenfolge, jeweils per `curl`:

1. **Aus-Zustand als Regressionstest** — `/api/auth/status` meldet
   `{"enabled":false,"authenticated":true}`, Schreiben ohne Cookie `204`,
   `GET /api/backup` `200`, Login gegen ein passwortloses Gerät `409 no password
   configured`. Verhalten identisch zu vorher.
2. **Passwort gesetzt** (ohne `currentPassword`, wie vorgesehen) → `204` +
   `Set-Cookie`. Status ohne Cookie danach `{"enabled":true,"authenticated":false}`.
3. **Reads bleiben offen** — `/api/snapshot` und `/api/settings` je `200`.
4. **Writes gesperrt** — `POST /api/actuators/<id>`, `POST /api/settings`,
   `DELETE /api/actuators/<id>` je `401`.
5. **Gated read** — `GET /api/backup` ohne Cookie `401`, mit Cookie `200`.
6. **SSE** bleibt bei aktivem Schutz ohne Cookie offen (`200`,
   `text/event-stream`, laufende `snapshot`-Events).
7. **Negativtests** — falsches Passwort `401`, gefälschtes `bcsid` `401`,
   falsches `currentPassword` beim Ändern `403`.
8. **Cookie-Präfix-Falle** — `Cookie: xbcsid=<gültiges Token>` wird korrekt
   abgelehnt (`401`); die Separator-Prüfung in `sessionCookie()` greift.
9. **Reboot** (über `POST /api/network` mit unverändertem Hostnamen, selbst
   gated) — nach ~25 s wieder da: Passwort überlebt (`enabled:true`, NVS),
   Session nicht (altes Cookie → `401`, RAM-only wie entworfen).
10. **Aufgeräumt** — Schutz mit leerem Passwort aufgehoben, `Set-Cookie` mit
    `Max-Age=0`, Endzustand wieder `{"enabled":false,"authenticated":true}` und
    Schreiben ohne Cookie `204`.

**Falscher Alarm unterwegs:** `curl http://<ip>/api/events` antwortet `404`.
Nicht durch diese Änderung verursacht — die beiden Boards mit alter Firmware
(`.74`, `.82`) verhalten sich identisch. `AsyncEventSource::canHandle` verlangt
`Accept: text/event-stream`; mit dem Header kommt sauber `200` plus Event-Strom.
Für künftige SSE-Tests per curl also immer den Accept-Header mitgeben.

## 2026-09-06 — Fix: mobiles Programm-Bottom-Sheet verdeckte das letzte Listenelement

Das fixe Bottom Sheet (`ProgramCard` mit `fill`, seit 2026-09-04) liegt auf
Mobile bewusst über der gescrollten Dashboard-Liste. Der dafür vorgesehene
Platzhalter in `Dashboard.tsx` war fest auf `h-40` (10 rem) — sobald das Sheet
höher wurde (aktiver Hero-Block mit Fortschrittsbalken, oder per Drag auf
`max-h-[50vh]` aufgezogen), reichte der Abstand nicht und das unterste
Karten-/Listenelement blieb hinter dem Sheet unerreichbar.

Umsetzung: `ProgramCard` misst die eigene gerenderte Höhe per `ResizeObserver`
auf dem Root-Element und meldet sie über den neuen Callback `onSheetHeight`
(auf Desktop `0`, da das Sheet dort eine normale Spaltenkarte ist). `Dashboard`
hält die Höhe in `sheetH` und setzt den Platzhalter (`lg:hidden`) per Inline-
`style={{ height: sheetH }}` — wächst und schrumpft jetzt mit dem Sheet, auch
während des Drags. `pnpm typecheck` + `pnpm build` grün; HW-Verifikation am
Gerät steht noch aus.

## 2026-09-05 — Alarme & Schwellwerte + Notification/Alert-Center

Der Backlog-Punkt „Alarme & Schwellwerte" samt seiner Erweiterung
„Notification/Alert-Center" umgesetzt. Vorher war ein `fault()` nur als Badge
auf der jeweiligen Karte sichtbar — lag die Karte auf einem anderen
Dashboard-Tab, sah man ihn gar nicht; es gab keine Aggregation, keinen Verlauf,
und Grenzwerte auf Messwerte überhaupt nicht.

**Entscheidungen vorab** (mit dem Nutzer geklärt): Auswertung komplett in der
BrewControl-Firmware, SensActCtrl bleibt unangetastet — damit teilt sich der
später geplante Punkt „Sensorgetriggerte Schritte" die Condition-Struktur
direkt, beide liegen in BrewControl. Alle vier Trigger in v1. Alert-Verlauf im
RAM-Ring, Regeln persistiert. Eigenes SSE-Event statt Snapshot-Erweiterung,
weil dessen fester 4160-Byte-Puffer bei Überlauf den Push still verwirft.

**Firmware.** Neu `Condition.h/.cpp` — `LogStore::resolve()` als freie Funktion
`resolveRef()` herausgezogen (reiner Verschiebe-Schritt, `LogStore` ruft sie
jetzt auf) und um das wiederverwendbare Primitiv `Condition {ref, op, value,
hyst}` + `evalCondition()` mit Latch-Semantik ergänzt. Neu `AlarmStore.h/.cpp`
nach dem Store-Muster von `ProfileStore`/`LogStore`: Regeln in
`/config/alarms.json`, Alert-Ring (40 Einträge, feste `char`-Arrays statt
`std::string` — deterministische ~6 KB im `.bss` statt Heap-Fragmentierung neben
WiFi/AsyncTCP/SD), rekursiver Mutex wie bei den anderen Stores mit `tick()`.
Drei Detektoren im Tick: Schwellwerte mit Hysterese und `forSec`-Entprellung,
`fault()`-Flanken, AutoTune-Abschluss (per `strstr` über `paramsJson()`, weil
`Controller` keinen Autotune-Accessor auf dem Basis-Interface hat). Gelöschte
Items fallen per Mark-and-Sweep aus der Flanken-Tabelle — kein
`DynamicItems`-Observer nötig; eine Regel auf ein verschwundenes Item feuert
weder noch löscht sie sich, sondern meldet `resolved: false` und heilt, wenn das
Item zurückkommt.

`ProgramRunner` bekam `setOnStatusChanged()` plus ein privates `setStatus_()`,
über das alle neun Zuweisungsstellen laufen (die in `loadFromSD` bewusst nicht,
sonst würde der Boot Alerts für Übergänge von vor dem Reboot feuern).

**Zwei Details, die Ärger verhindern:** Der `AlarmStore` sendet nicht selbst,
sondern legt Alerts in eine Outbox, die `WebUI::tick()` mit max. 4 pro Durchlauf
leert — `raise_()` kann über den ProgramRunner-Callback auf dem AsyncTCP-Task
laufen und bleibt so allokations- und netzwerkfrei. Und anders als
`LogStore`/`ProgramRunner` wartet der Store *nicht* auf NTP: ein unterdrückter
Alert ist für immer weg, und die erste Minute nach dem Boot ist genau die, in
der ein Verdrahtungsfehler auffällt. Vor dem Sync ausgelöste Alerts tragen
`ts: 0`, die Entprellung läuft durchgehend auf `millis()`.

**API.** `GET/POST /api/alarms`, `POST/DELETE /api/alarms/<id>`,
`POST /api/alarms/<id>/enable`, `GET /api/alerts[?since=<seq>]`,
`POST /api/alerts/clear`, plus das SSE-Event `alert`. Auth kommt gratis über die
bestehenden Handler-Klassen; nur `/api/alerts/clear` (body-los) braucht
`requireAuth` von Hand. `?since=` ist der einzige Reparaturpfad und deckt
Kaltstart, Reconnect *und* von `AsyncEventSource` still verworfene Pushes mit
einem Mechanismus ab. `openapi.yaml` und die README-Routentabelle im selben
Zug nachgezogen, inkl. der bisher falschen Behauptung „The only event name is
`snapshot`".

**Frontend.** `subscribeEvents()` nimmt jetzt optional `onAlert` und `onOpen` —
eine EventSource für beide Event-Namen, weil jede Verbindung dem Gerät einen
SSE-Client-Slot kostet. Neu `AlertCenter.tsx` (Toast-Stack unten rechts plus
Slide-in-Panel an einer Glocke in der NavShell mit Aktiv-Zähler),
`AlarmEditorModal.tsx` und die Seite `/settings/alarms`. Die Firmware sendet
bewusst keine deutschen Texte — sie liefert strukturierte Felder, die deutsche
Formulierung entsteht in genau einer Funktion `alertText()`. Aktive Alarme
badgen zusätzlich die Sensor-/Aktorkarte. `styles.css` blieb unangetastet:
`--success/--caution/--critical/--accent` decken das Severity-Vokabular ab.

**Bewusst *kein* Alert-Center als eigene Route:** eine Seite ist genau dann
nicht erreichbar, wenn man sie braucht — man steht am Kessel auf dem Dashboard.
Deshalb Glocke plus Panel, das über jeder Seite aufgeht.

**Verifikation.** `pio run` grün für alle drei Board-Envs; RAM auf esp32dev
52320 → 58632 Byte, also die kalkulierten ~6 KB für den Ring.
`pio test -e native` grün in beiden Projekten (BrewControl 16, SensActCtrl 196).
`npx @redocly/cli lint` sauber (die eine `info-license`-Warnung ist vorbestehend).
`pnpm typecheck` und `pnpm build` grün.

Danach per Netzwerk-OTA auf den LilyGo (`brewcontrol.local`) geflasht und E2E
durchgespielt — Regeln auf den echten DS18B20 (`sensor/mlt`) und auf
`actuator/pump`:

1. **Schwellwert raise** — Regel `mlt > 20` angelegt, feuert innerhalb einer
   Sekunde: SSE-`alert` auf der Leitung, `active: true` mit `since`,
   Ring-Eintrag mit `v: 22.5`.
2. **Raise → cleared → raise** über `actuator/pump` (an/aus/an) — alle drei
   Flanken kamen als eigene SSE-Events, `cleared` korrekt mit `sev: info`.
3. **enable-Toggle** — Deaktivieren löscht den Latch und setzt
   `resolved: false`, Reaktivieren feuert neu.
4. **Tote Referenz** — Regel auf `sensor/gibtesnicht`: `resolved: false`,
   `active: false`, kein Alert, keine Löschung.
5. **Programm-Trigger** — Zweischritt-Programm mit `confirm` (Sollwert 0, damit
   der PID garantiert Ausgang 0 kommandiert): `awaiting` als Warnung, `done` als
   Info.
6. **Validierung** — fehlender Name/`cond`/`value` und kaputtes JSON je `400`,
   unbekannte Id bei POST und DELETE je `404`.
7. **`?since=`** — `since=2` liefert genau `[3, 4]`, `since=999` leer.
8. **Reboot** — Regeln überleben (`/config/alarms.json`), der Ring läuft bei
   `seq: 1` neu an, und der noch anstehende Schwellwert meldet sich beim ersten
   Tick von selbst wieder — genau das Verhalten, das den RAM-Ring vertretbar
   macht.
9. **UI gegen dasselbe Gerät** — Glocken-Zähler (1 → 2), „Grenzwert“-Badge auf
   Sensor- und Aktorkarte, Live-Toast unten rechts, Panel mit Verlauf in
   Geräte-Zeitformat, Severity-Filter, „Verlauf leeren“. Regelseite und Editor
   (Live-Kanalliste aus dem Snapshot, Validierung) in hellem und dunklem Theme.

Beim UI-Test fiel auf, dass der Rohwert als `aktuell 22.4375` erschien — der
Alert trägt keine Kanalauflösung, also rundet `alertText()` jetzt auf zwei
Nachkommastellen.

**Ein echter Fund im Testlauf:** `alarms_.tick()` stand zunächst vor dem
1-Hz-Gate in `WebUI::tick()` und lief damit bei jedem Loop-Durchlauf (~5 ms) —
inklusive `paramsJson()` für jeden Controller. Auf 1 Hz gezogen und mit einem
eigenen `lastAlarmMs_` versehen; die Entprellung hängt ohnehin an `millis()`,
nicht an der Tick-Zahl.

**Testartefakte entfernt:** Regeln, Testprogramm und Verlauf gelöscht, Pumpe und
`testpid` auf ihren Ausgangszustand zurückgesetzt.

**Noch offen:** die Trigger `fault()` und AutoTune — ersterer hätte auf dem
Board eine Umstellung des MQTT-Transports auf einen toten externen Host
gebraucht, letzterer einen vollständigen AutoTune-Durchlauf. Als eigener Punkt
in [PLAN.md](PLAN.md) notiert, zusammen mit der dabei aufgefallenen Lücke, dass
`GET /api/backup` weder Logs noch Programme noch Alarme mitnimmt.

## 2026-09-09 — Push-Notifications umgesetzt (esp-webPush, ein Keypair pro Installation)

**Auslöser:** Wunsch, Meldungen aufs Handy zu bekommen — bis dahin liefen alle
Alerts nur über SSE ins offene Dashboard, also genau dann nicht, wenn es zählt.

**Zwei Planannahmen fielen bei der Prüfung:**

- **Curier ist mit dieser Platform nicht baubar.** Weil `ESPToolKit/esp-webPush`
  seit 2026-08-03 archiviert ist, war zunächst der Nachfolger
  [ZekStack/curier](https://github.com/ZekStack/curier) gesetzt. Er nutzt
  `std::span` — libstdc++ liefert das erst ab GCC 10, `espressif32@6.10.0` pinnt
  für Arduino aber fest GCC 8.4. Der Compiler kennt `-std=gnu++20` nicht einmal
  dem Namen nach (nur `gnu++2a`), und unter `gnu++2a` verlor er zusätzlich die
  implizite Inline-Eigenschaft von `static constexpr`-Membern
  (`YF_S201Sensor::kHzPerLiterPerMin` → undefined reference). Curier hängt damit
  am Sprung auf Arduino Core 3 / ESP-IDF 5 — eigenes Vorhaben, steht in PLAN.md.
  Also esp-webPush auf seinem letzten Commit, bewusst nicht auf dem Tag `v2.0.0`:
  die TLS-Zertifikatsprüfung (`useTlsCertBundle`) kam erst danach, ohne sie hätte
  der Push-Request keine CA. Archiviert heißt: der SHA ist so unveränderlich wie
  ein Tag.
- **Die Trigger waren schon gebaut.** PLAN.md ging noch davon aus, Flankenerkennung
  für `fault()` und Programm-Ende müsse erfunden werden. Seit `c1a1b64` erzeugt
  `AlarmStore` aber genau diese vier Ereignisse fertig entprellt. Push hängt sich
  deshalb nur mit einem zweiten Lese-Cursor (`takePendingPush`) an denselben Ring,
  den `WebUI::tick()` schon für SSE leert — getrennte Cursor, damit sich beide
  Verbraucher keine Meldungen wegnehmen.

**Ein VAPID-Keypair pro Installation statt pro Gerät** (PLAN.md hatte pro Gerät
vorgesehen): Ein Browser hält pro Service-Worker-Scope genau ein Abo, fest
gebunden an einen `applicationServerKey`. Ein Keypair pro Gerät bräuchte damit
einen eigenen statischen Scope-Ordner je Gerät auf Pages plus eine Gerät→Platz-
Liste im Browser, die beim Löschen der Browserdaten verfällt. Die Bootstrap-Seite
erzeugt das Keypair stattdessen per WebCrypto, hält es in ihrem localStorage und
gibt es jedem Gerät mit; ein Gerät, das schon einen Key kennt, reicht ihn als
`?k=` mit. Ergebnis: ein Abo pro Browser für beliebig viele Geräte, kein
Krypto-Code auf dem ESP32, und nichts Geheimes im öffentlichen Repo.

**Umsetzung:** `PushService.{h,cpp}` nach dem `WebhookService`-Muster (Globale in
`main.cpp`, `begin()` nach dem STA-Connect, `tick()` im Loop). Keypair und bis zu
vier Abos in NVS, bewusst nicht in `/config/*.json`, damit sie aus
`GET /api/backup` herausbleiben — eine Endpoint-URL ist das einzige Geheimnis,
das eine fremde Benachrichtigung verhindert. Fünf Routen unter `/api/push/*`,
Schreibzugriffe automatisch über die vorhandenen Handler-Klassen auth-gated.
Neue statische Seite `BrewControl/push-bootstrap/` plus `.github/workflows/pages.yml`
(→ `nhhop.github.io/Brauerei/push/`), neue SPA-Seite
`/settings/notifications`.

Zwei Details, die Ärger gespart haben: `WebPushConfig` defaultet auf
`queueMemory = Psram`, das zwei der drei Boards nicht haben (→ `Internal`), und
der Worker-Stack-Default von 4 KB übersteht keinen TLS-Handshake (→ 12 KB, wie
das Upstream-Beispiel nahelegt). Die Klick-URL der Meldung wird bei *jedem* Push
frisch aus `WiFi.localIP()` gebaut statt aus dem Hostnamen — Android löst mDNS
nicht zuverlässig auf, und das Handy ist der ganze Zweck der Übung.

**Verifikation:** Alle drei Envs bauen; Flash `esp32dev` 75,3 % → 83,3 %
(+152 KB, im Wesentlichen TLS-Pfad und Zertifikats-Bundle), RAM +888 B.
`pnpm typecheck` und `pnpm build` grün, Redocly-Lint grün. Lokal verifiziert:
Redirector-Schutz der Bootstrap-Seite (`https://…`, fremde Hosts abgelehnt,
`.local` und private IPs akzeptiert), die WebCrypto-Formate (65-Byte-P-256-Punkt
mit `0x04`-Marker, 32-Byte-Privatschlüssel, unpadded base64url) und der
Fragment-Übergabepfad (`#push=…` → `POST /api/push/subscription` → `204`, Hash
danach aus der URL). Am Gerät (LilyGo S3, `brewcontrol.local`) nachgezogen: Firmware und UI
geflasht — das Board lief zuvor auf einem UI-Stand *vor* dem Alarm-Center, bei
gleichzeitig neuerer Firmware, weil damals `cdf5fe0-dirty` geflasht und die UI
nicht mit deployt worden war. Danach verifiziert: `GET /api/push` liefert den
erwarteten Zustand, `test`/`reset` `204`, Validierung `400`/`404`,
`GET /api/backup` enthält weder `privateKey` noch Endpoint-URL (der Grund für
NVS statt `/config/*.json`), Gerät über eine Minute stabil. Zustellung am 2026-09-10 bestätigt (nach dem Pages-Deploy
und dem Fix unten): Testmeldung und echte Trigger kommen an, auf Desktop und
Handy, auch bei geschlossenem Tab und geschlossenem Browser; ein Klick auf die
Meldung öffnet das Dashboard. Offen bleibt nur der Mehr-Geräte-Fall, siehe
PLAN.md. Automatisiert war das nicht zu prüfen: der Browser der Werkzeugkette
meldet `Notification.permission === "denied"` und verweigert die
SW-Registrierung.
## 2026-09-10 — Fix: zweiter Browser ersetzte das Abo des ersten

**Symptom:** Ein zweiter Browser einrichten warf das Abo des ersten raus — die
Liste blieb bei einem Eintrag.

**Root Cause:** Denkfehler in `push-bootstrap/app.js`. `resolveKeypair()` gab bei
einem per `?k=` übergebenen Gerätekey `{publicKey, privateKey: null}` zurück, und
der Aufrufer ersetzte das anschließend durch ein **frisch erzeugtes Keypair** —
mit dem Kommentar „nothing here can sign for it". Falsch: der Browser signiert
nichts, `pushManager.subscribe()` nimmt ausschließlich den *öffentlichen*
Schlüssel; signiert wird beim Senden auf dem Gerät, das die private Hälfte längst
hat. Der neue Schlüssel kam als Key-Wechsel beim Gerät an, und ein Key-Wechsel
verwirft per Design alle Abos (sie würden gegen den neuen Key nur 403 liefern).

**Umsetzung:** In `app.js` hat `?k=` jetzt Vorrang vor dem localStorage — das
Gerät ist der Anker, damit alle Geräte einer Installation dieselbe Subscription
bedienen. Der localStorage-Eintrag wird nur genutzt, wenn er zum Gerätekey passt
(dann reisen beide Hälften mit) oder wenn das Gerät noch gar keinen Key hat. Der
Neu-Erzeugen-Block ist ersatzlos weg. `PushService::setSubscription()` akzeptiert
dafür einen leeren `privateKey`, solange der `publicKey` der gespeicherte ist;
ein *unbekannter* Key braucht die private Hälfte weiterhin, sonst wäre er
unbrauchbar.

**Verifikation:** Am LilyGo S3 (`8d85d14-dirty`) direkt gegen die API geprüft —
zweiter Browser (gleicher `publicKey`, leerer `privateKey`, neuer Endpoint) →
`204`, Liste wächst auf zwei Abos, `publicKey` unverändert; unbekannter Key ohne
private Hälfte → `400`; Test-Eintrag wieder entfernt → `204`. Redocly-Lint grün. Nach dem Merge
vom Nutzer bestätigt: zwei echte Abos nebeneinander (Windows-Desktop und
FCM/Handy), beide bekommen die Meldungen.
## 2026-09-10 — esp32dev auf Stand gebracht, UI-Netzwerk-Deploy für LittleFS-Boards

**Auslöser:** Das esp32dev-Testboard hing 70 Commits zurück (Stand `3213288`,
LittleFS-Support vom 28.8.) — ohne Auth, Profile, Alarme und Push.

Firmware per OTA (`POST /api/update/firmware`) war unkritisch. Die UI dagegen
schien Handarbeit zu erfordern: `CLAUDE.md` schrieb dafür `pio run -t uploadfs`
vor und schloss den Netzwerk-Upload aus — und genau dieses Board hat keinen
zuverlässigen Auto-Reset, d.h. jemand muss den BOOT-Button halten.

**Erkenntnis:** Der Netzwerk-Upload funktioniert dort sehr wohl, er scheiterte
bisher nur am Paket. `pnpm build:sd` lässt die unkomprimierten Dateien neben den
`.gz` liegen, das übliche `webui.tar` ist damit ~440 KB und passt nicht in die
256-KB-Datenpartition. Ein Tar aus **nur den .gz-Dateien** ist ~100 KB — dieselbe
Diät, die `firmware/data/www` ohnehin hält, weil ESPAsyncWebServer `.gz`
transparent ausliefert. Upload in ~2 s, Swap sauber, `/www` danach byte-identisch
zum lokalen Build. Der auf dem LOLIN S2 Mini dokumentierte Abbruch bei ~65 KB
trat auf dem esp32dev nicht auf; für den LOLIN bleibt die Einschränkung bestehen.

Regel in `CLAUDE.md` entsprechend präzisiert (statt pauschalem Ausschluss) und
den Weg in `README.md` als eigenen Abschnitt ergänzt. Beide Boards laufen jetzt
auf `97cfdb6` mit identischer UI.
## 2026-09-10 — Fix: Push-Test crashte den esp32dev (IRAM statt DRAM)

**Symptom:** `POST /api/push/test` auf dem esp32dev lieferte keine Antwort; das
S3 beantwortete dieselbe Route in 0,1 s. Ein Poll-Loop zeigte nur einen einzelnen
Aussetzer, was zunächst gegen einen Reboot sprach.

**Root Cause:** Die serielle Konsole zeigte `Guru Meditation Error (LoadStoreError)`
plus Reboot — der Boot war schnell genug, dass der Poll ihn fast verpasste. Der
per `addr2line` dekodierte Backtrace führte von `PushService::tick()` über
`ESPWebPush::allocateItem()` bis in den `std::string`-Konstruktor von
`PushMessage`. Ursache war `cfg.queueMemory = WebPushQueueMemory::Internal`: das
mappt auf `MALLOC_CAP_INTERNAL`, was „nicht PSRAM" bedeutet und deshalb **IRAM
einschließt** — und IRAM erlaubt nur 32-Bit-Zugriffe. Auf dem esp32dev war der
DRAM knapp genug, dass `heap_caps_malloc` das Queue-Item dorthin legte; der
byteweise Zugriff des `std::string` löste den Panic aus. Auf dem S3 (PSRAM, mehr
freier DRAM) trat es nie auf.

**Umsetzung:** `WebPushQueueMemory::Any` (= `MALLOC_CAP_DEFAULT`, byte-adressierbar;
auf Boards ohne PSRAM ohnehin interner Speicher). Dazu im Test-Pfad von `tick()`
derselbe `initialized_`-Guard, den `send()` schon hatte — ohne ihn würde ein Test
auf einem nicht gestarteten Dienst in eine uninitialisierte Queue greifen.

**Verifikation:** Am esp32dev geflasht — `POST /api/push/test` antwortet `204` in
0,22 s, seriell 15 s lang keine Ausgabe (kein Crash), `lastError` leer.
## 2026-09-10 — Fix: neues Gerät entzog den anderen ihr Push-Abo

**Symptom:** Nach dem Einrichten des frisch geflashten esp32dev kamen auf dem PC
keine Meldungen des S3 mehr an — und umgekehrt hätte ein erneutes Einrichten des
S3 das esp32dev stillgelegt. Ping-Pong zwischen zwei Boards.

**Root Cause:** Die Bootstrap-Seite speicherte ihr Keypair nur, wenn sie es
*selbst erzeugt* hatte. Abonnierte sie mit einem per `?k=` gelieferten Gerätekey
(seit dem Fix vom selben Tag der Normalfall), blieb im localStorage der alte
Eintrag stehen. Kam danach ein Gerät **ohne** eigenen Key — frisch geflasht oder
zurückgesetzt —, fiel die Seite auf diesen veralteten Key zurück; das bestehende
Abo ist aber fest an den Key gebunden, mit dem es angelegt wurde, also musste sie
ab- und neu anmelden. Damit war genau das Abo entwertet, das auf den anderen
Geräten in NVS lag.

Der Browser kann das nicht allein auflösen: Die private Hälfte existiert nur auf
den Geräten, und die Seite kann beim Besuch von Gerät B nicht Gerät A fragen.

**Umsetzung:** Das Gerät reicht sein vollständiges Keypair selbst weiter. Neu ist
`GET /api/push/keypair` — die einzige Leseroute neben `GET /api/backup` mit
`requireAuth()`, weil sie den privaten Schlüssel herausgibt. Die SPA hängt ihn
beim Weiterleiten als **Fragment** (`#pk=…`) an die Bootstrap-URL, nie als
Query-Parameter: Fragmente werden nicht an den Server geschickt, landen also
nicht in GitHubs Logs. Die Seite liest ihn, entfernt ihn sofort per
`history.replaceState` aus der Adressleiste und legt das vollständige Paar in
ihren localStorage. Damit ist deren Kopie nie veraltet, und Reihenfolge wie
Browserwahl beim Einrichten sind egal. Ein Key ohne private Hälfte wird bewusst
**nicht** gespeichert — ein halbes Paar wäre schlimmer als keins.

**Verifikation:** Beide Boards auf `a95de04-dirty` geflasht,
`GET /api/push/keypair` liefert auf beiden 43 Zeichen base64url (32-Byte-Skalar).
Bootstrap-Logik lokal gegen `http://localhost` geprüft: Fragment wird gelesen,
verschwindet sofort aus der URL, das vollständige Paar landet im localStorage —
und ein Gerätekey *ohne* private Hälfte wird korrekt nicht gespeichert.

Nach dem Merge am Gerät bestätigt: beide Boards tragen denselben VAPID-Key und
beide dieselben zwei Abos (Windows-Desktop und FCM/Handy), Meldungen kommen von
beiden Geräten auf beiden Browsern an. Damit ist auch die Kernannahme des
Ein-Keypair-pro-Installation-Designs belegt — ein Abo pro Browser bedient
beliebig viele Geräte —, und der entsprechende Verifikationspunkt fällt aus
PLAN.md heraus. Einmalig war dafür noch das Zurücksetzen beider Boards nötig,
weil die divergierten Keys aus der Zeit vor dem Fix stammten; der Fix räumt
Bestehendes nicht rückwirkend auf.


## 2026-09-10 — PWA-Grundgerüst: Home-Screen-Start ohne Adressleiste

Ziel: das Dashboard am Kessel vom Home-Screen starten, ohne Browser-Adressleiste.

**Randbedingung:** Die Firmware liefert Klartext-HTTP; `http://<ip>` bzw.
`<host>.local` ist kein Secure Context. Der moderne Weg (Manifest +
`display: standalone` → WebAPK auf Android) ist genau darauf gated, und ein
Service Worker registriert sich dort ebenfalls nicht — dieselbe Wand wie beim
Push (siehe PLAN.md, HTTPS-Support). iOS dagegen prüft für Home-Screen-Apps
kein HTTPS: `apple-mobile-web-app-capable` plus Manifest genügen.

**Umsetzung:** Neues `web/public/` (gab es bisher nicht) mit `manifest.json`
und den vier Icons aus `push-bootstrap/` — kopiert, nicht verlinkt, weil das
Gerät im Brau-Netz kein Internet hat. Bewusst `.json` statt `.webmanifest`:
die MIME-Tabelle von ESPAsyncWebServer (`_setContentTypeFromPath`) kennt
`.webmanifest` nicht und lieferte `application/octet-stream`. `index.html`
bekommt Manifest-Link, `theme-color`, `mobile-web-app-capable`, die drei
`apple-*`-Tags und die Icon-Links. `black-translucent` und
`viewport-fit=cover` bewusst ausgelassen — beide schieben den Inhalt unter die
Statusleiste und verlangen dann `env(safe-area-inset-*)`-Padding, das es in
`styles.css` nirgends gibt. Keine Firmware-, keine API-Änderung.

**Verifikation:** Manifest im Browser geladen und geparst
(`Content-Type: application/json`, alle drei Icon-Einträge plus
apple-touch-icon und SVG-Favicon mit 200). Build und gzip-Roundtrip geprüft,
`firmware/data/www/` neu bestückt: 105,5 KB gz gegen 256 KB Partition, die
Icons kosten davon ~8 KB. Der eigentliche Test steht am Handy aus und liegt als
Verifikationspunkt in PLAN.md — offen ist vor allem, ob Chrome den Legacy-Pfad
`mobile-web-app-capable` (Vorgänger des Manifests, Chrome 31–38, seither
deprecated) heute noch bedient. Falls nicht, bliebe als Android-Weg ohne HTTPS
ein Vollbild-Button über die Fullscreen-API: die braucht keinen Secure Context,
aber eine transient activation, also einen echten Tap pro Sitzung.

**Nachtrag — Android:** Am Gerät bestätigt, dass Chrome den Legacy-Pfad nicht
mehr bedient: „Zum Startbildschirm hinzufügen" öffnet die SPA weiterhin mit
sichtbarer Adressleiste, `mobile-web-app-capable` allein trägt also nicht mehr.
Der Tag bleibt trotzdem drin — er kostet nichts und ist für Chromium-Forks noch
relevant. Als Ersatz gibt es jetzt einen Vollbild-Schalter in `NavShell.tsx`,
platziert in der ohnehin nur mobil sichtbaren Kopfleiste (`md:hidden`), rechts
neben dem Hamburger. Er ruft `requestFullscreen()` auf dem Wurzelelement auf:
kein Secure Context nötig, dafür eine transient activation — deshalb ein Button
und kein Aufruf beim Laden. Ein `fullscreenchange`-Listener hält Icon und
Tooltip synchron, auch wenn der Modus per Systemgeste verlassen wird.
Gerendert wird der Schalter nur bei `document.fullscreenEnabled`; auf dem
iPhone ist das `false` (Safari erlaubt Fullscreen dort nur für Video), dort
bleibt der Home-Screen-Weg über die `apple-*`-Tags der richtige.

**Verifikation Vollbild-Button:** Der Browser-Pane rendert die Seite in einem
iframe ohne Fullscreen-Permission (`requestFullscreen()` → „Permissions check
failed"), der echte Umschaltvorgang ließ sich dort also nicht auslösen. Geprüft
wurde stattdessen alles drumherum: Der Schalter erscheint bei 375 px Breite und
verschwindet bei 1280 px mit der Kopfleiste (`display: none`) — das Desktop-UI
bleibt unangetastet. Der Zustandspfad wurde direkt getrieben (gefälschtes
`fullscreenElement` plus `fullscreenchange`-Event): Tooltip wechselt
„Vollbild" → „Vollbild verlassen", Icon `maximize` → `minimize` und beim
Zurücksetzen wieder retour. `pnpm typecheck` sauber. Der Test am Handy steht
noch aus (PLAN.md).

**Nachtrag — Vollbild überlebt den Routenwechsel:** Am Handy fiel der Modus bei
jeder Navigation heraus, in Chrome, Edge *und* Firefox. Ursache ist nicht das
Frontend: gemessen im Dev-Server bleibt ein `window`-Marker über den Klick auf
einen Nav-Link erhalten, `performance.getEntriesByType('navigation')` steht
weiter bei einem Eintrag, `history.length` zählt hoch — es findet also keine
Dokument-Navigation statt, die Vollbild spec-konform beenden dürfte. Die Engines
steigen schlicht bei `history.pushState()` aus, und genau das ruft
preact-router in `route()` auf. Für Chromium ist das als Bug 138324 seit Jahren
offen dokumentiert („the fix for this is not trivial"), Gecko verhält sich
praktisch genauso.

Gegenmaßnahme ist die von Chrome selbst genannte: nach dem Routenwechsel neu
anfordern. `NavShell` merkt sich die Absicht des Nutzers in einem Ref und
stellt in einem `useEffect` auf `[path]` das Vollbild wieder her — das läuft
Millisekunden nach dem auslösenden Tap, also innerhalb dessen transient
activation. Wird der Request abgelehnt (Zurück-Taste, dahinter steckt keine
Geste), räumt der `catch` die Absicht ab, statt es bei jeder weiteren
Navigation erneut zu probieren. Gewolltes Verlassen — Wischgeste, Esc — wird
ohne Zeitstempel oder Klick-Listener davon unterschieden: ein
pushState-Austritt landet immer auf einer *neuen* URL, ein gewollter nicht. Der
`fullscreenchange`-Handler löscht die Absicht deshalb nur, wenn
`location.pathname` noch dem zuletzt gerenderten Pfad entspricht.

**Verifikation:** Der Browser-Pane verbietet echtes Vollbild (iframe ohne
Permission), also wurde die Engine gestellt — gefälschtes `fullscreenElement`
plus funktionierendes request/exit, alles andere echte Komponente. Sechs
Schritte durchgespielt: Schalter rein (Icon `minimize`), zweimal navigieren mit
simuliertem Engine-Austritt → bleibt drin und der Pfad wandert korrekt mit,
gewollt verlassen → Absicht fällt, danach navigieren → bleibt draußen.
`pnpm typecheck` sauber. Der Beleg am Gerät steht aus (PLAN.md).

Offen und bewusst nicht angefasst: die Streifen an Status- und Gestenleiste im
Vollbild (Chrome/Edge oben schwarz, Chrome unten schmal weiß; Firefox nutzt den
ganzen Schirm). Dafür bräuchte es `viewport-fit=cover` plus
`env(safe-area-inset-*)`-Padding an Kopfleiste, Seitenleiste, Scroll-Bereich
und FAB — eigener Change, siehe PLAN.md.

**Nachtrag 2 — erster Fix trug nicht.** Am esp32dev geflasht, keine Änderung:
Chrome, Edge und Firefox verlassen beim Navigieren weiterhin das Vollbild. Der
Fehler lag in einer Annahme über die Reihenfolge. Der Fix hing an einem
`useEffect` auf `[path]`, also am Re-Render, und setzte voraus, dass die
Engine `fullscreenchange` *davor* feuert. Tut sie das nicht, greifen beide
Zweige daneben: der Effekt sieht noch ein gesetztes `fullscreenElement` und
kehrt früh zurück, und der danach eintreffende Handler sieht den bereits
aktualisierten Pfad, hält den Austritt für gewollt und löscht die Absicht.

**Neuer Ansatz, ohne Reihenfolgen-Annahme:** Ein Klick-Listener in der
Capture-Phase hält den Zeitpunkt des letzten Taps fest. Der
`fullscreenchange`-Handler reagiert auf den Austritt selbst — liegt ein Tap
weniger als 1,5 s zurück, war es die Navigation, und das Vollbild wird per
`setTimeout(…, 0)` neu angefordert (die Engine soll den Austritt erst
abschließen); liegt kein Tap vor, war es Wischgeste, Esc oder Zurück-Taste, und
die Absicht fällt. Damit ist egal, wann die Engine das Event feuert. Der
`[path]`-Effekt und der Pfad-Vergleich sind entfallen.

**Verifikation:** Wieder mit gestellter Engine (der Browser-Pane verbietet
echtes Vollbild), diesmal beide Reihenfolgen durchgespielt — Austritt *vor* dem
Re-Render und Austritt *danach*: in beiden Fällen bleibt das Vollbild erhalten
und der Pfad wandert korrekt mit. Gewolltes Verlassen nach über 1,5 s ohne Tap
löscht die Absicht, anschließende Navigation holt nicht zurück. Der
Eintritts-Wechsel von `maximize` auf `minimize` passiert innerhalb von 50 ms.
`pnpm typecheck` sauber.

**Diagnoseseite `web/public/fstest.html`** (temporär, wieder entfernen, sobald
das Thema durch ist): unter `/fstest.html` erreichbar, ohne Framework. Sie
schaltet Vollbild ein, löst `history.pushState` aus und probiert den
Wiedereintritt in drei Varianten — sofort im Handler, `setTimeout(0)`,
`setTimeout(300)` —, protokolliert jedes `fullscreenchange` mit Zeitstempel,
zeigt per Microtask, ob das Event vor oder nach dem Rendern kommt, und gibt bei
Ablehnung Name und Meldung des Fehlers aus. Falls der neue Ansatz am Gerät
ebenfalls nicht trägt, liefert die Seite die Antwort, statt weiter zu raten.

**Nachtrag 3 — die Ursache ist nicht `pushState`.** Entscheidende Beobachtung
vom Gerät: zwischen den *Settings-Unterseiten* bleibt das Vollbild erhalten, nur
zwischen den drei Hauptbereichen (Dashboard / Profile / Einstellungen) bricht es
weg. Beide Wege laufen über dieselbe Mechanik — `<a href>`, von preact-router
abgefangen, `history.pushState`. Wäre pushState der Auslöser, müssten beide
scheitern. Damit ist die bisherige Diagnose hinfällig, und der zweite Fix
adressiert etwas, das gar nicht das Problem ist.

Weiter eingegrenzt, beides ausgeschlossen:
- **Bildschirmkante:** Das Vollbild überlebt das Antippen des Menü-Buttons oben
  links und bricht erst beim Antippen des Ziels — die obere Kante ist es also
  nicht.
- **Echte Dokument-Navigation:** Der frühere Marker-Test lief mit geschlossener
  Seitenleiste, also ohne das `setMobileOpen(false)` der Nav-Einträge.
  Nachgeholt mit *offener* Leiste: der Klick wird weiterhin abgefangen
  (`defaultPrevented === true`), der `window`-Marker überlebt,
  `performance.getEntriesByType('navigation')` bleibt bei einem Eintrag. Es
  lädt also nichts neu.

Übrig bleibt als Unterschied, dass ein Nav-Eintrag zusätzlich
`setMobileOpen(false)` auslöst und damit das Overlay-`div` aus dem DOM
entfernt, während die Karten in den Einstellungen nichts am Zustand ändern. Ob
das der Auslöser ist, lässt sich lokal nicht klären: der Browser-Pane rendert in
einem iframe ohne Fullscreen-Permission, echtes Vollbild ist dort nicht
auslösbar.

**Deshalb Messung statt weiterer Vermutung:** `web/src/fsdebug.ts` (temporär,
zusammen mit dem Aufruf in `main.tsx` wieder zu entfernen) schneidet Ereignisse
mit Zeitstempel mit — Klicks samt Ziel, `history.pushState` inklusive des
Zustands davor/danach/im Microtask, `fullscreenchange`, `fullscreenerror`,
`popstate`, `resize`, `visibilitychange`, `pagehide`. Anzeige in einem
eingeblendeten Panel mit Kopier-Knopf. Aktiv nur bei `?fsdebug=1` in der URL,
der Normalbetrieb bleibt unberührt. Lokal verifiziert: Klick-, pushState- und
Microtask-Zeilen erscheinen in der erwarteten Reihenfolge.

**Nachtrag 4 — Verdacht auf echten Dokument-Load.** Nächste Eingrenzung am
Gerät: vom Dashboard *weg* (zu Profilen, zu den Einstellungen) hält das
Vollbild, nur *zum* Dashboard hin bricht es — und dabei verschwindet auch die
Debug-Ausgabe. Das ist der eigentliche Hinweis: Das Panel hängt direkt an
`document.body`, außerhalb von `#app`; preact rendert nur in `#app` und kann
es gar nicht entfernen. Ist es weg, wurde das Dokument neu geladen — und beim
Neuladen von `/` fällt `?fsdebug=1` aus der URL, weshalb es sich nicht wieder
installiert. Ein echter Dokument-Load beendet Vollbild spec-konform, in jeder
Engine, und erklärt damit alle drei Browser auf einen Schlag.

Lokal ist das **nicht** reproduzierbar: mit offener Seitenleiste geprüft, sowohl
`href="/profiles"` als auch `href="/"` werden abgefangen
(`defaultPrevented === true`), Marker überlebt, ein Navigation-Entry. Das Gerät
verhält sich hier also anders als der Dev-Server, und die Ursache dafür ist noch
offen.

**Mitschnitt reload-fest gemacht:** `fsdebug.ts` wird jetzt über `?fsdebug=1`
scharf geschaltet und merkt sich das plus das Protokoll in `localStorage`
(`?fsdebug=0` schaltet ab und räumt auf). Nach einem Neuladen kommt das Panel
mit der bisherigen Historie zurück und schreibt eine Zeile
`=== DOKUMENT-START <url> typ=<navigate|reload|back_forward> ===`; dazu
kommen `beforeunload`/`pagehide` und eine Prüfung, ob das Panel aus dem DOM
entfernt wurde (unterscheidet DOM-Entfernung von Neuladen). Lokal verifiziert:
nach einem erzwungenen Load steht genau die Abfolge
`!! beforeunload` → `!! pagehide` → `=== DOKUMENT-START / typ=navigate ===`
im Protokoll.

**Nachtrag 5 — es war nie ein Fullscreen-Problem, sondern die Klick-Delegation.**
Der Mitschnitt vom Gerät zeigt beim Dashboard-Link genau das, was fehlt:

```
73598  CLICK  a href=/        fs=html
73603  !! beforeunload — Dokument wird verlassen
73643  !! pagehide
     0  === DOKUMENT-START  /  typ=navigate ===
```

Bei `/settings` und `/settings/security` steht dazwischen jeweils eine
`pushState`-Zeile, beim Dashboard-Link nicht. preact-router hat den Klick also
nicht genommen, der Browser hat den Link normal ausgeführt — echter
Dokument-Load, SPA neu gestartet, Vollbild spec-konform beendet. Das erklärt
alle drei Engines und auch, warum das Debug-Panel verschwand: es hängt an
`document.body` und war nach dem Load schlicht neu, ohne `?fsdebug=1` in der
URL gar nicht mehr aktiv.

preact-router nimmt Links über einen delegierten Click-Listener auf
`document`. Warum der auf dem Gerät ausgerechnet `href="/"` durchrutschen
ließ, ist offen — lokal ist es nicht reproduzierbar, dort wird derselbe Link
abgefangen und `exec('/', '/', {})` liefert einen Treffer. Statt weiter nach
dem Warum zu suchen, nimmt die Seitenleiste die Abhängigkeit jetzt heraus: der
`onClick` der Nav-Einträge ruft selbst `route(href)` auf, mit
`preventDefault()` und `stopPropagation()` — Letzteres, weil sonst die
Delegation zusätzlich greift und ein zweiter, identischer History-Eintrag
entsteht (im Protokoll als doppelte `pushState`-Zeile aufgefallen, bevor es
gefixt war). Modifier-Klicks und Mittelklick bleiben unangetastet, damit
„in neuem Tab öffnen" weiter funktioniert.

**Verifikation:** Drei Sprünge über die Seitenleiste (Dashboard → Profile →
Einstellungen) bei geöffneter mobiler Leiste: `history.length` wächst um genau
3, also ein Eintrag pro Sprung und keine Dubletten; `window`-Marker überlebt,
`performance.getEntriesByType('navigation')` bleibt bei einem Eintrag, im
Protokoll steht je Sprung genau eine `pushState`-Zeile und `abgefangen=JA`.
`pnpm typecheck` sauber.

Zwei Korrekturen an der Messung selbst, die dabei nötig waren: Der
Kopier-Knopf funktionierte am Gerät nicht, weil `navigator.clipboard` nur im
Secure Context existiert — jetzt mit `execCommand`-Fallback. Und die Zeile
`abgefangen=` kam aus einem zweiten Listener auf `document`, den
preact-router per `stopImmediatePropagation()` gerade dann verschluckt, wenn
es den Klick nimmt; sie wird jetzt verzögert aus dem Capture-Handler gelesen.

**Bestätigt und aufgeräumt.** Am Gerät geprüft: Vollbild bleibt beim Wechsel
zwischen Dashboard, Profilen und Einstellungen erhalten. Damit ist der
Dokument-Load weg und die Seitenleiste routet zuverlässig selbst.

Wieder entfernt: `src/fsdebug.ts` samt Aufruf in `main.tsx` und
`public/fstest.html`.

Ebenfalls entfernt — und das ist die eigentliche Lehre aus der Runde: die
Wiedereintritts-Mechanik im Vollbild-Schalter (Tap-Zeitstempel, 1,5-s-Fenster,
erneutes `requestFullscreen()` nach dem Austritt). Sie war für die falsche
Ursache gebaut. Der Mitschnitt belegt bei `/settings → /settings/security`
`pushState` mit durchgehend `fs=html`: client-seitiges Routing beendet das
Vollbild in keiner der drei Engines. Die Mechanik hat also nie etwas bewirkt und
hätte nur so ausgesehen, als sei sie nötig. Zurück bleibt der schlichte
Schalter plus ein `fullscreenchange`-Listener, der Icon und Tooltip führt.

Rückblickend gingen zwei Fix-Runden für eine Ursache drauf, die aus einer
plausiblen, aber ungeprüften Annahme stammte (Chromium-Bug 138324, „pushState
beendet Vollbild"). Widerlegt hat sie erst eine Beobachtung vom Gerät — dass
Settings-Unterseiten den Modus halten, obwohl sie denselben Mechanismus nutzen.
Der Weg dorthin war jedes Mal Messung statt Argument: Marker-Test gegen
Dokument-Load, Ereignis-Mitschnitt mit Zeitstempeln, `exec()` des Routers
direkt befragt.

**Verifikation nach dem Aufräumen:** Kein Debug-Panel mehr im DOM, Schalter
kippt in beide Richtungen (`maximize` ↔ `minimize`), drei Sprünge über die
Seitenleiste ergeben genau drei History-Einträge, Marker überlebt, ein
Navigation-Entry. `pnpm typecheck` sauber. Auslieferung: 105,8 KB gz gegen
256 KB Partition.

## 2026-09-10 — Safe-Area-Padding: Vollbild ohne Rand-Streifen

Nachdem der Vollbild-Schalter am Gerät trug, blieb der kosmetische Rest aus
PLAN.md: unter Chrome und Edge stand oben der Bereich der Statusleiste schwarz,
unter Chrome zusätzlich unten ein schmaler weißer Balken. Ursache ist kein
Fehler im Layout, sondern eine fehlende Erlaubnis — ohne `viewport-fit=cover`
schneidet die Engine das Layout-Viewport an den Systemleisten ab und füllt den
Rest selbst. Die Meta-Angabe in `index.html` ist jetzt gesetzt; damit reicht die
Seite unter die Leisten und muss ihre Inhalte selbst davon freihalten.

Die vier Insets liegen als `--safe-t/-r/-b/-l` in `styles.css` statt als
`env()` direkt an den Utilities. Das kostet eine Indirektion, kauft aber genau
das, woran die Vollbild-Runde davor gescheitert war: die Randfälle sind ohne
Gerät mit Kerbe messbar, indem man die Variablen überschreibt. Dazu `html {
background: var(--bg) }` — mit `viewport-fit=cover` endet das Layout nicht mehr
an der Gestenleiste, und ohne gestrichene Fläche bleibt der Streifen darunter
weiß.

Gepolstert wird nur, was an einer Bildschirmkante klebt, und jede Kante genau
einmal. Die Seitenleiste trägt alle drei Kanten selbst (als überlagernde
Schublade wie als statische Leiste ist sie das äußerste Element). Der
Scroll-Bereich bekommt unten und rechts, links dagegen nur unterhalb von `md:` —
darüber liegt die Leiste links von ihm und hat den Rand schon abgedeckt. Die
Kopfleiste wächst um den oberen Inset (`h-[calc(3rem+var(--safe-t))]` plus
`pt`), bleibt also randlos unter der Statusleiste liegen, während ihre Icons
darunter rutschen. Dazu die vier freistehenden Overlays, die keine Polsterung
von außen sehen können: FAB und Speed-Dial, der Toast-Stapel, das
Meldungs-Panel und das mobile Programm-Bottom-Sheet.

Bewusst ausgelassen: die Dialoge (`fixed inset-0` mit zentriertem Inhalt und
`p-4`) — zentrierter Inhalt gerät nicht unter eine Systemleiste.

**Verifikation** mit gefälschten Insets im Browser (48 px oben, 24 px unten):
Kopfleiste 96 px hoch bei 48 px `padding-top`, das Menü-Icon beginnt bei y=54 —
also sauber mittig im 48-px-Streifen darunter. Seitenleiste offen: oberster
Eintrag bei y=56, unterster mit 32 px Luft nach unten. Scroll-Bereich ganz nach
unten gefahren: 24 px zwischen Inhaltsende und Viewport-Unterkante, Chrome
rechnet die Polsterung des Scroll-Containers also mit. Quer (812×375, 44 px
seitlich): Leiste links um 44 px eingerückt, Scroll-Bereich links bei 0 und
rechts um 44 px — kein doppelter Rand. Die vier Overlay-Klassen einzeln
gemessen: FAB `bottom: 44px` / `right: 36px`, Toast 40/32, Panel `pt 48 / pb 24
/ pr 16`, Sheet `pb 40`.

Der wichtigste Beleg ist der Gegentest: mit echtem `env()` im normalen Tab
lösen alle vier Variablen zu `0px` auf, sämtliche Polsterungen stehen auf 0 und
die Kopfleiste ist wieder 48 px hoch. Außerhalb von Vollbild und
Home-Screen-Fenster ändert sich nichts. `pnpm typecheck` sauber, `pnpm build`
durch, die erzeugten Regeln stehen im gebauten CSS (Tailwind normalisiert
`calc(1.25rem+…)` selbst auf gültige Abstände). Der Beleg am Gerät steht aus
(PLAN.md).

## 2026-09-10 — Sensorgetriggerte Programm-Schritte

Backlog-Punkt aus PLAN.md: ein Schritt endete bisher nur über `holdSec` (Zeit).
Jetzt trägt jeder Schritt einen wählbaren Auslöser — `end: "hold"` (Default,
weggelassen) oder `end: "sensor"` mit einer `Condition` `{ref, op, value, hyst}`
aus `Condition.h` (unverändert von `AlarmStore`/`LogStore` übernommen: gleiche
`conditionFromJson`/`conditionToJson`/`evalCondition` mit Hysterese-Latch). Bei
`sensor` schaltet der Schritt automatisch weiter, sobald der Latch steigt;
`holdSec` wird dann ignoriert. Der Latch (`Step::condActive`) ist Laufzeit, nicht
persistiert, und wird bei jedem Schrittwechsel zurückgesetzt (`resetLatches_`).

Die „Freigabe abwarten"-Checkbox (`confirm`) bleibt unverändert und orthogonal:
sie greift nach dem Auslösen beider Trigger — `hold` + `confirm` ist exakt das
alte Verhalten, `sensor` + `confirm` wartet nach Erreichen der Bedingung auf
`next`. Kein Sicherheits-Timeout für Sensor-Schritte (unbegrenztes Warten,
`next`/`stop` bleiben verfügbar). Keine Migration: `end` fehlt in Altdateien →
`hold`; ältere Firmware auf einer neuen `programs.json` behandelt
`sensor`-Schritte als `hold`.

`ProgramRunner::tick` verzweigt die „Schritt fertig?"-Prüfung nach `end`, sonst
Struktur gleich. Frontend: neue `ProgramStep.end`/`cond`-Felder; die
`{ref, op, value, hyst}`-Form ist als `components/ConditionFields.tsx` aus dem
Alarm-Editor herausgezogen (`refGroups`/`unitOf` nun in `src/refs.ts`, auch vom
Log-Editor genutzt), fällt ohne Snapshot auf ein Freitext-Ref zurück (Profil-
Bibliothek hat keinen SSE-Feed). Programm- und Profil-Schritt-Editor bekommen je
ein Segmented „Zeit / Sensor"; `ProgramCard` zeigt für den aktiven Sensor-Schritt
Ziel + Bedingung + Live-Istwert (`resolveRef`) statt Countdown und lässt
Sensor-Schritte aus der Fortschrittsbalken-Rechnung.

**Verifikation:** `pio run -e esp32dev` grün, `redocly lint` ohne neue Fehler,
`pnpm typecheck`/`pnpm build` grün. E2E am echten Gärlauf steht aus (PLAN.md →
Hardware-Verifikation).

**Nachtrag (Nutzer-Feedback):** Firmware + UI auf `brewcontrol.local`
(LilyGo-S3, COM9) geflasht — bestehendes Programm lädt unverändert (Back-Compat
bestätigt), Programm-Editor zeigt das Sensor-Dropdown live. Danach auffiel:
die Profil-Seite (`/profiles`) zeigte für dieselbe `ConditionFields`-Komponente
nur ein Freitext-Ref-Feld statt des Dropdowns. Ursache war kein Komponenten-
Unterschied, sondern fehlende Prop-Weitergabe — `App()` (`app.tsx`) hält den
Live-`Snapshot` und reicht ihn an `Dashboard`/`DevicesPage`/`LogsPage`/
`AlarmsPage` durch, `ProfilesPage` fehlte dabei. Ergänzt (`app.tsx`,
`ProfilesPage.tsx`); `ProfileEditorModal`/`ConditionFields` brauchten keine
Änderung. `pnpm typecheck`/`pnpm build` grün, per `pnpm dev` gegen
`brewcontrol.local` (`VITE_ESP_HOST` braucht das Schema, `http://…`, sonst
`ENOTFOUND base.invalid`) verifiziert: Profil-Editor zeigt jetzt dasselbe
Dropdown wie der Programm-Editor.

## 2026-09-11 — Multi-Regler-Programme

Backlog-Punkt aus PLAN.md: ein Programmschritt steuert jetzt beliebig viele
Regler und Aktoren statt genau eines Reglers. Das Datenmodell ist in mehreren
Runden mit dem User entstanden (erst feste Spalten, dann Aktoren als Spalten,
am Ende die Map pro Schritt): `targets: {id: befehl}` nennt nur, was der
Schritt ändert, alles andere bleibt unverändert. Der Befehl ist **pro Feld**
`{v?, enabled?, interval?}` — dieselben Felder wie `POST /api/actuators/<id>`;
Anlass war ein Gärtank-Rührer, bei dem ein Programm Schalter, Drehzahl und
Intervall einzeln verstellen können soll. Weitere Entscheidungen: Aktoren
wirken nur bei Schrittbeginn (eine Hopfengabe bei Minute 30 heißt Schritt
teilen), kein implizites Einschalten mehr (der Editor setzt „Ein" beim ersten
Wert in einer leeren Zelle vor), Profile sind eine komplette Vorlage inklusive
Ids (kehrt die Entscheidung vom 04.09. um), Haltezeit wählbar in min/h/d. Ids
sind geräteweit eindeutig (`DynamicItems.cpp:44`), deshalb braucht es keinen
Rollen-Präfix; der Runner löst per `findController`, sonst `findActuator` auf.

**Laufzeit.** Vorwärts (`start`, `next`, Auto-Advance durch Zeit oder Sensor)
setzt nur die eigene Map des Schritts. `prev` und Boot-Resume dagegen stellen
den **zusammengesetzten Stand** der Schritte 0…k her — pro Id und pro Feld der
letzte Wert —, sonst bliebe nach „Zurück" stehen, was der spätere Schritt
geändert hat. Grenze: Werte, die das Programm erst später setzt, kann `prev`
nicht auf den Stand vor dem Programm zurückholen. Ausnahme Pulse-Aktoren
(`ValueKind::Discrete`, `write(N)` hängt N Impulse an): deren `v` ist ein
Ereignis, feuert nur beim ersten Vorwärts-Eintritt pro Lauf (`reachedStep`,
persistiert) und wird nie wiederholt — Hopfen lässt sich nicht zurückholen.
Fehlt eine Id, wartet das Programm wie bisher beim fehlenden Regler; der Scan
über alle Ziele läuft aber erst, wenn ein Schritt fällig ist, weil `tick()` in
jeder Loop-Runde aufgerufen wird.

**Firmware.** Neu `ProgramTargets.h` (header-only, nur ArduinoJson + std,
damit nativ testbar: `readTargets` inkl. Legacy-`setpoint`, `writeTargets`,
`effectiveTargets`) und `ProgramSteps.h/.cpp` (der geteilte Step für
`ProgramRunner` und `ProfileStore` inkl. `end`/`cond`). `ProgramRunner`:
`controller`, `EndMode` und `currentSetpoint` raus, `reachedStep` und
`condActive` rein — der Sensor-Latch aus PR #35 zieht vom Step ans Programm,
weil der Step-Struct jetzt geteilt ist und ohnehin nur der aktuelle Schritt
ausgewertet wird. Neue Pfade `applyCmd_` (Feldreihenfolge des
Actuator-Endpoints: `enabled`, `interval`, `v`; bei Reglern wie bisher erst
Sollwert, dann Schalter), `enterStep_`, `applyState_`. Legacy wird gelesen,
geschrieben wird nur das neue Format: `controller` + `setpoint` →
`{x: {v, enabled: true}}` (genau das alte Verhalten, `start` schaltete den
Regler immer ein), alte Profile ohne Regler → Id `""`, im Programm abgelehnt,
im Profil erlaubt.

**Dabei gefunden und mitbehoben (aus PR #35):** `ProfileStore` kannte
`end`/`cond` nicht und verwarf sie. Ein Sensor-Schritt kam deshalb aus der
Bibliothek als Zeit-Schritt mit `holdSec` 0 zurück und hätte in einem
Programm sofort weitergeschaltet. Root Cause: zwei getrennte Step-Structs,
PR #35 hatte nur den im Runner erweitert. Mit dem geteilten Step ist das
strukturell ausgeschlossen.

**API/Doku.** `openapi.yaml`: neues Schema `StepTarget` (verweist auf
`ActuatorWrite`), `ProgramStep.targets`, `Program.reachedStep`,
`ProgramInput` ohne `controller`, Legacy-Toleranz dokumentiert. Nebenbei die
Doku-Drift aus PLAN.md behoben: eigener Pfad-Parameter `ProgramId`
(`^p_[0-9a-f]{5}$`) statt `HexId` für `/api/programs/{id}` und `/control`,
Create-Response und `Program.id` angeglichen, `currentStep` „0 while idle".

**Frontend.** Neu `src/program.ts` (`targetKind`, `effectiveTargets` als
Spiegel der Firmware-Regel, `fmtTarget`, `HoldUnit` nach dem Muster von
`intervalUnit.ts`) und `components/ProgramStepsEditor.tsx`, der die zwei
duplizierten Schritt-Editoren aus Programm- und Profil-Dialog ersetzt (inkl.
Zeit/Sensor aus PR #35): Spaltenkopf „Steuert" mit Reglern und Aktoren —
Aktoren, die ein Regler als `actuator`/`heatActuator`/`coolActuator` treibt,
waren zunächst ausgeblendet (siehe Nachtrag) —, pro Zelle Schalter „—/Ein/Aus", Wert mit Einheit
(Binary ohne, Pulse als „Impulse") und bei Intervall-Aktoren „an … von …".
`draftProblem()` sagt im Dialog, warum Speichern gesperrt ist. `ProgramCard`
zeigt statt `setpoint°` den zusammengesetzten Stand als Chips (vom Schritt
selbst gesetzt hervorgehoben, geerbt neutral), Impulse mit ✓ sobald gefeuert,
im Kopf „Steuert: …" mit fehlenden Ids. `fmtDuration` ab 24 h als „5 d 03:00",
das trifft auch die Summen auf der Profilseite. `refs.ts` `unitOf` löst jetzt
auch `controller/<id>` über den Sensor des Reglers auf.

**Verifikation.** `pio test -e native` 30/30 (14 neue in
`test_program_targets`: Befehle mit einzelnen/allen Feldern, Reihenfolge,
Legacy mit/ohne Controller, verworfene Werte, kaputtes Intervall,
Round-Trip, zusammengesetzter Stand pro Feld inkl. Impuls-Ausnahme); dafür
bekam `[env:native]` ArduinoJson. `pio run` für `esp32dev` und
`lilygo_t_display_s3_amoled` grün, ohne Warnungen in den geänderten Dateien.
Redocly valide (nur die bekannte `license`-Warnung), `pnpm typecheck` und
`pnpm build` grün. UI im Dev-Server gegen In-Page-Stubs für Snapshot,
Programme und Profile (Gärtank-Szenario mit zwei Reglern, Rührer mit
Intervall, Pulse-Dropper, Binary-Ventil und einer an einen Regler gebundenen
Heizung; nichts ans Board geschrieben): Karte zeigt pro Feld korrekt
zusammengesetzt (Drehzahl aus Schritt 1, Intervall aus Schritt 2), Spalten-
Select blendet belegte Ids und die gebundene Heizung aus, Vorbelegung „Ein"
greift, leere Spalte sperrt Speichern mit Hinweis, gesendeter Body enthält nur
gesetzte Felder und rechnet Tage in Sekunden um, Legacy-Profil erscheint als
ungebundene Spalte (Programm- und Profil-Dialog), „Als Profil speichern"
trägt Spalten und Sensor-Schritt mit, Start/Weiter/Zurück setzen die Chips und
das ✓ wie erwartet; Desktop und 375 px geprüft. Dabei aufgefallen:
`` `${inp} w-NN` `` greift projektweit nicht (`w-full` gewinnt), der neue
Editor nutzt `w-20!` — in PLAN.md eingetragen.

**HW-E2E** am LilyGo (`brewcontrol.local`, 192.168.178.87), Firmware `df07d50`
und UI-Paket per OTA (`/api/update/firmware` 200 in 12 s, `/api/update/assets`
200 in 6 s), Board-Stand vorher in den Scratchpad gesichert. **Migration:** das
echte Alt-Programm „Hermann-Weizen" (7 Schritte, Regler `mash`) kam direkt nach
dem Boot als `targets: {"mash": {"enabled": true, "v": …}}` zurück, Umlaute,
`confirm` und `done`-Status erhalten, `reachedStep` = `currentStep`; die zwei
Alt-Profile als `""`-Spalte. Test-Items ohne GPIO als MQTT-Aktoren am
eingebetteten Broker (Relais Binary, Rührer Continuous mit Intervall 10/20 s,
`TwoPoint`-Regler auf `mlt` mit eigenem MQTT-Heizaktor). Abgelehnt mit
`400 invalid program`: leere Target-Id, Intervall `onSec > periodSec`. Lauf:
Start schaltet Regler/Relais/Rührer ein und setzt 30 bzw. 40 % + 10/20 s;
manuell Sollwert 33, Weiter in den Intervall-Schritt → 33 bleibt, Rührer nur
20/20, Drehzahl und Schalter unverändert; Zurück → 30 und 10/20 wieder da;
Weiter → wieder 20/20, 30 bleibt. **Reboot** mitten im Schritt (manuell vorher
33): danach Regler 30 (Config hätte 20), Relais an (Binary startet sonst aus),
Rührer 40 % + 20/20 (Config 10/20), Restzeit läuft auf der Wanduhr weiter.
Sensor-Schritt (`controller/test_regler > 40`) setzt beim Eintritt 35 und
wartet ohne Countdown, Sollwert 45 → schaltet weiter, der End-Schritt schaltet
Relais und Rührer aus und lässt Drehzahl/Intervall stehen, nach 60 s `done`.
**PR-#35-Fix:** Profil mit Sensor-Schritt (`hyst` 0.002) gespeichert und
zurückgelesen — `end`/`cond` vollständig da, auch nach einem zweiten Reboot,
ebenso die neu geschriebenen `""`-Profile. Die vom Board ausgelieferte UI zeigt
das migrierte Programm („Steuert: mash", „mash 35 °C" pro Schritt), keine
Konsolenfehler. Testartefakte (Programm, Profil, Regler, drei Aktoren) danach
gelöscht; die migrierten echten Daten bleiben. **Nicht am Gerät prüfbar:** der
Impuls-Pfad — `PulseOutput` ist kein dynamischer Aktor-Typ, ein Hopfen-Dropper
lässt sich also bisher gar nicht anlegen (PLAN.md → Backlog). Nach einem Reboot
wird ein `done`-Programm wie bisher nicht erneut angewandt.

**Bekannte Grenzen.** Nach einem Downgrade liest alte Firmware das neue
`programs.json` nicht, die Programme fallen weg. Beim Update erst die Firmware,
dann die UI einspielen: die neue UI wirft beim Rendern eines Programms im alten
Format (`step.targets` fehlt) — im Test mit dem Alt-Programm des LilyGo
gesehen, bevor die Stubs aktiv waren; die neue Firmware migriert beim Laden.

**Nachtrag (Nutzer-Feedback):** `dfsdfdf` auf dem S3 (AnalogOutput/PWM mit
Intervall) tauchte in der Spaltenauswahl nicht auf — der Editor blendete jeden
Aktor aus, den ein Regler treibt (`testpid` hat `actuator: dfsdfdf`), weil der
Regler den Wert sonst überschreibt. Das war zu grob: ein Regler schreibt nur
den Wert, Schalter und Intervall fasst er nie an. Nachgelesen in der Library:
PID und TwoPoint lassen ihren Aktor in Ruhe, solange sie aus sind
(`if (!enabled()) return;`), DualStage und SplitRangePID ziehen Heiz-/Kühlausgang
auch ausgeschaltet jede Runde auf 0 (`writeOff()`). Jetzt bietet der Editor alle
Aktoren an, gesteuerte in einer eigenen Gruppe „Aktoren (von Regler gesteuert)"
mit dem Reglernamen; die Zelle sagt es dazu — bei PID/TwoPoint „der Wert wirkt
nur, solange <Regler> aus ist", bei Heiz-/Kühlausgängen entfällt das Wertfeld
(ein schon gespeicherter Wert bleibt sichtbar). `StepTarget` in der OpenAPI um
denselben Satz ergänzt. Verifiziert per `pnpm dev` gegen das S3 (neue Firmware,
echte Daten, nichts gespeichert): Auswahl zeigt `kettle (mash)` und
`dfsdfdf (testpid)`, die `dfsdfdf`-Zelle Schalter, PWM-Wert, Intervall und den
Hinweis; `pnpm typecheck` grün, Redocly valide. Danach als UI-Paket aufs S3
geladen (`/api/update/assets` 200), Board serviert den neuen Build, Auswahl
und Hinweis am Gerät bestätigt.

**Nachtrag 2026-09-12 — Ablaufsteuerung stand einmal still.** Am Gerät blieb ein
laufendes Programm auf Schritt 1 stehen (60 s Haltezeit, Freigabe eingestellt):
nach 3021 s weiter `running`, kein Schrittwechsel, kein `awaiting`. Nach einem
Reboot lief dasselbe Programm sauber durch alle sieben Schritte und wartete am
Ende korrekt auf die Freigabe. Die Auswertung spricht gegen die Programmlogik
und für einen stehenden loopTask — `stepRemainingSec: 0` zeigt eine gültige Uhr
und abgelaufene Haltezeit, und `GET /api/programs` antwortete sofort, obwohl es
denselben Mutex nimmt wie `tick()`. Details, Verdächtige und die Messung, die
beim nächsten Auftreten **vor** dem Reboot zu machen ist, stehen in PLAN.md →
„Bugs & bekannte Einschränkungen". Auf Wunsch des Users nicht weiterverfolgt.

## 2026-09-12 — Pulse-Aktor anlegbar + `inp`-Breiten-Bug gefixt

**Pulse-Aktor.** `PulseOutputActuator` (Library) war zwar über `ValueKind::Discrete`
im `ProgramRunner` schon vollständig als Impuls-Ziel unterstützt, ließ sich aber
nirgends anlegen. Jetzt als `PulseOutput`-Typ in
`DynamicItems::addActuatorNoBegin()` verdrahtet (`pin`, `pulse_width_ms`,
`gap_ms`, `invert` — snake_case wie die übrigen Typen; kein neuer Include
nötig, `SensActCtrl.h` zieht den Header schon), im `AddItemModal` als
„Pulse (Hopfen-Dropper)" wählbar (GPIO-Pin, Pulsbreite/Pause in ms,
Invertieren-Checkbox), `docs/openapi.yaml`s `ActuatorCreate` um den Enum-Wert
und die beiden neuen Felder ergänzt. Kein Serialisierungs-Sonderfall nötig —
`DynamicItems` persistiert die rohe Config-JSON verbatim. Verifiziert:
Firmware-Compile-Smoke (`esp32dev`, grün), `pnpm typecheck`/`build` grün,
Redocly valide (nur die bekannte `license`-Warnung). Am laufenden LilyGo
(`brewcontrol.local`, echtes „Hermann-Weizen"-Programm currently in Schritt 6,
nicht angefasst) den Dialog geöffnet und einen Test-Aktor über den echten
`POST /api/actuators` angelegt — sauber mit `400 unknown actuator type`
abgelehnt, wie von der noch nicht geflashten Firmware erwartet, kein
Seiteneffekt. Firmware-Flash + der eigentliche Impuls-Test („v" feuert genau
einmal pro Lauf, nicht nach `prev`/`next`/Reboot) stehen noch aus — siehe
PLAN.md → „Hardware-Verifikation offen".

**Nachtrag — HW-Verifikation am LilyGo (2026-09-12).** Firmware
(`lilygo_t_display_s3_amoled`) und UI-Paket per Netzwerk-OTA aufgespielt
(`POST /api/update/firmware` + `/api/update/assets`, beide 200), während das
echte „Hermann-Weizen"-Programm auf Schritt 6 („Freigabe erforderlich") lief —
beide Reboots (Firmware-Flash + ein späterer Test-Reboot) überstand es
unangetastet (`status: awaiting`, `currentStep: 5` vorher/nachher identisch).
Test-Aktor `hop_dropper_test` (GPIO 17, frei — Pins 2/9/6/7/3/11 waren durch
bestehende Items belegt) angelegt: `meta.kind` kam korrekt als `"Discrete"`
zurück, direktes `write(20)` per `POST /api/actuators/<id>` zeigte die
Pulse-Queue sauber abzählend von 19 auf 0 draining. Mit einem echten
Test-Programm (eigener Schritt mit `hop_dropper_test.v=4`, dann Reboot mitten
im Schritt) alle drei Fälle aus PLAN.md bestätigt: (1) Eintritt in den
Impuls-Schritt queued die Pulse genau einmal (`target` sprang auf 4, drainte
dann normal), (2) `prev` gefolgt von `next` zurück in denselben (bereits
`reachedStep`) Schritt queued nichts nach (`target` blieb 0), (3) ein Reboot
mitten im Impuls-Schritt (referenceStep 1, `stepRemainingSec` ~3575 von 3600)
resumed korrekt (`stepRemainingSec` lief weiter, kein Sprung) ohne erneuten
Pulse (`target` blieb über mehrere schnelle Polls direkt nach dem Neustart bei
0). Test-Programm und Test-Aktor danach gelöscht, `GET /api/config` bestätigt
den Gerätestand wieder identisch zu vorher. Der Impuls-Pfad der
Multi-Regler-Programme ist damit vollständig E2E verifiziert — kein offener
Punkt aus PLAN.md „Hardware-Verifikation offen" mehr für diesen Feature-Zweig.

**`inp` `w-full`-Bug.** Die in PLAN.md dokumentierte Ursache (`.w-full` steht
im generierten CSS hinter `.w-20` etc. und gewinnt immer) am Fließband
behoben: `w-full` aus dem gemeinsamen `inp` (`web/src/ui.ts`) entfernt und an
jeder der ca. 130 Aufrufstellen, die volle Breite brauchen, explizit wieder
angehängt — bis auf die Stellen, die ohnehin `flex-1`/`min-w-0 flex-1` nutzen
(Breite kommt dort schon vom Flex-Layout, nicht von `inp`). `AddItemModal.tsx`
definiert `inp` lokal neu (`` `${inpBase} font-mono` ``) — dort genügte eine
einzige Änderung für alle ~69 Stellen der Datei. Die vorher betroffenen Stellen
(`TimePage` `w-56`/`w-48`, `NetworkPage` `w-40`, `LogEditorModal` `w-20`,
`ProgramEditorModal`s „Aus Profil befüllen"-Select `w-48`) greifen jetzt ohne
Änderung an ihrer eigenen Klasse — der `ProgramStepsEditor`-Workaround
(`w-NN!`-Suffix) bleibt unangetastet stehen (funktioniert weiterhin, jetzt nur
redundant). Verifiziert: `pnpm typecheck`/`build` grün; im Dev-Server gegen den
LilyGo (nur GET-Requests, keine Schreibzugriffe) `TimePage` (Zeitzone/NTP-Server
jetzt kompakt statt zeilenfüllend), `NetworkPage` (mDNS-Hostname kompakt),
`LogEditorModal` und `ProfileEditorModal`/Programm-Editor (weiterhin
volle Breite, keine Regression) geprüft.

## 2026-09-12 — Dashboard-UI: vier kleine Fixes

Vier Punkte aus PLAN.md „Bugs & bekannte Einschränkungen" und Backlog in einer
Session erledigt: (1) Programm-Poll in `Dashboard.tsx` von 2000ms auf 1000ms
(Countdown/Slider springen jetzt sekündlich statt im 2s-Takt). (2)
`ControllerCard.tsx` hielt den Setpoint-Input als lokalen State, der nur beim
Mount initialisiert wurde — externe Änderungen (Programm-Schritt setzt neuen
Setpoint, alle 1s per SSE-Snapshot gepusht) kamen nie an, erst ein Seiten-Reload
zeigte den neuen Wert. Fix: `useEffect(() => setSp(setpoint.toString()),
[setpoint])`, analog zum bestehenden Muster in `ActuatorCard.tsx`. (3)
Umbenennen einer Karte (Sensor/Aktor/Regler) läuft in `AddItemModal.tsx` als
Delete+Recreate unter neuer ID — Dashboards referenzieren Mitgliedschaft aber
über die alte ID-Liste, die Karte verschwand dadurch aus allen Dashboards.
`AddItemModal` meldet jetzt bei ID-Änderung `onRenamed(role, oldId, newId)`;
`Dashboard.tsx` ersetzt die alte ID in jedem Dashboard, das sie referenziert,
und persistiert das per `updateDashboard`. (4) Programm-Widget-Spalte war
schmaler als Sensoren/Regler/Aktoren-Spalten (fixe `w-80` neben einem
`flex-1`-Bereich, der selbst nochmal in 3 Spalten geteilt wurde). Äußerer
Container von Flex-Row auf CSS-Grid umgestellt (`lg:grid-cols-4` mit Programm,
sonst `lg:grid-cols-3`; Inhalt nimmt `lg:col-span-3`) — die verschachtelte
3-Spalten-Grid darin ist jetzt exakt so breit wie die Programm-Spalte.
Verifiziert: `pnpm typecheck` grün nach jeder Änderung; (2)-(4) nicht live am
Gerät getestet (kein Dev-Server mit echten Snapshot-Daten in der Session).

## 2026-09-12 — Bestätigungsdialog beim Umschalten fremdgesteuerter Aktoren/Regler

Backlog-Punkt umgesetzt: der Toggle auf Aktor- und Regler-Card schaltete bisher
sofort um, auch wenn ein aktiver Regler oder ein laufendes Programm das Item
gerade steuert — der manuelle Vorgang wurde dann im nächsten Tick wieder
überschrieben, ohne dass die UI das kommunizierte.

**Ownership-Erkennung** (neu, `web/src/ownership.ts`): weder Aktor noch Regler
tragen im Wire-Format einen Besitzer-Verweis — `controllerOwnerOf()` scannt
`params.actuator`/`heatActuator`/`coolActuator` aller Regler (gleiche Logik wie
das bestehende `drivenBy` in `ProgramStepsEditor.tsx`, hier isoliert für
Wiederverwendung), `programOwnerOf()` nutzt das vorhandene `programIds()` aus
`program.ts` gegen alle Programme mit Status `running`/`awaiting`/`paused`. Ein
deaktivierter Regler bzw. ein `idle`/`done`-Programm zählt nicht als Besitzer —
dann bleibt das Toggle-Verhalten unverändert.

**UI:** `ToggleSwitch` bekommt eine `mixed`-Prop, die den Knopf unabhängig vom
Schaltzustand mittig zeigt (Mittelstellung als Fremdsteuerungs-Indikator, wie
vom User vorgeschlagen). `ConfirmModal` um einen optionalen dritten Button
(`extraLabel`/`onExtra`) erweitert — additiv, alle 16 bestehenden binären
Aufrufstellen unverändert. `ActuatorCard`/`ControllerCard`: Toggle-Klick bei
aktivem Besitzer öffnet den Dialog statt direkt zu schalten (Abbrechen / nur
schalten / schalten + Besitzer deaktivieren-pausieren — Regler via
`enableController(id, false)`, Programm via `controlProgram(id, 'pause')`,
beide Endpoints bereits vorhanden). `Dashboard.tsx` reicht `controllers`/
`programs` an die Cards durch.

**Verifikation:** `pnpm typecheck` grün. Live gegen das LilyGo-S3-Testboard
(`brewcontrol.local`) im Browser-Pane: das laufende „Hermann-Weizen"-Programm
zeigte den Regler `mash` (Programmziel, Status `awaiting`) und den von `mash`
getriebenen Aktor `IDS1` (Controller-Ziel) beide mit Mittelstellung und
korrektem Dialogtext; „Abbrechen" ändert nichts, „Aktor schalten" schaltet
`IDS1` ohne den Regler anzufassen (per `aria-checked`/Titel-Attribut
bestätigt), danach wieder zurückgeschaltet — Board am Ende unverändert.
Ungeteste Aktoren/Regler ohne Besitzer zeigten weiterhin die normale
Links/Rechts-Stellung ohne Dialog.

**Nachtrag (Nutzer-Feedback):** der Extra-Button-Text ("Aktor schalten und
Regler deaktivieren") umbricht in der 3-Spalten-Gleichbreite des
`ConfirmModal`-Footers zu oft — Fix noch offen, siehe PLAN.md.

## 2026-09-12 — Dashboard: Regler über Programm-Widget, Grid-Reflow, größerer Chart

Backlog-Punkt „Sensor-/Aktor-/Controller-Grid: Anordnung überarbeiten" umgesetzt,
ausgelöst durch Nutzer-Feedback: ein einem Programm zugeordneter Regler (z. B.
`mash`, Ziel von „Hermann-Weizen") stand bisher getrennt vom Programm-Widget
unten im Regler-Grid, obwohl beide zusammengehören.

**`Dashboard.tsx`:** pro Programm wird jetzt der erste Regler, den es
referenziert (`programIds()`-Reihenfolge, wiederverwendet aus `program.ts`),
über statt neben dem zugehörigen `ProgramCard` gerendert — unabhängig vom
Laufstatus (auch idle/done), nur einmal vergeben falls mehrere Programme
denselben Regler referenzieren. Die bisherige `Column`-Gruppierung
(Sensoren/Regler/Aktoren als drei betitelte Spalten) ist aufgelöst: ein
einziges Grid rendert alle verbleibenden Karten (Sensoren → restliche Regler →
Aktoren) ohne Kategorie-Überschriften/Zähler und füllt Zeilen horizontal.

**Chart nutzt den Platz, den das aufgelöste Grid freigibt:** der
Hauptinhaltsbereich ist auf Desktop (`lg:`) eine Flex-Column mit voller Höhe;
der Chart-Bereich wächst per `flex-1`, das Karten-Grid bleibt `shrink-0` und
landet dadurch automatisch am unteren Rand. `ChartCard` bekommt eine neue
`fill`-Prop: ein `ResizeObserver` misst die vom Flex-Layout zugewiesene Höhe
und ruft darüber `setSize()` (kein Re-Fetch der Log-Daten bei reinem Resize).
Nur auf Desktop aktiv (`matchMedia('(min-width: 1024px)')`, dieselbe
Bedingung, die `ProgramCard` schon für den mobilen Fixed-Sheet-Check nutzt) —
mobil bleibt der Chart bei fester Höhe (240px) im normalen Dokumentfluss.
`LogsPage`/`ArchivePage` übergeben `fill` nicht und bleiben unverändert.

**Debugging-Fund unterwegs:** die erste Fassung ließ den Chart auf ~10.000px
wachsen — ein Resize-Feedback-Loop, weil dem Chart-Karten-`div` selbst
`lg:min-h-0` fehlte (Default `min-height:auto` verhindert das Schrumpfen auf
den vom Flex-Elternteil zugewiesenen Platz). Zweiter Fund: die „Kochen"-
Dashboard-Config referenziert einen längst gelöschten Log (`charts: ["42b70a"]`,
keine passende `logs`-Eintrag) — vorher harmlos (leere `space-y-4`-Box), nach
der Umstellung riss das dieselbe `min-h-[240px]`+`flex-1`-Fläche auf. Fix:
`Dashboard.tsx` filtert `activeDash.charts` jetzt zuerst gegen `logs` auf
tatsächlich vorhandene Einträge (`chartLogs`) und rendert den Chart-Bereich nur
dann, wenn davon mindestens einer übrig bleibt.

**Verifikation:** `pnpm typecheck` grün. Live gegen `brewcontrol.local` im
Browser-Pane geprüft: „Maischen" (Programm `awaiting`, Regler `mash` oben,
größerer Chart, Rest-Grid darunter), „Gärung" (Programm `idle`/„Bereit", Regler
`testpid` steht trotzdem oben — bestätigt „immer", nicht nur bei aktivem
Programm), „Kochen" (kein Programm, dangling Chart-Referenz — Grid oben ohne
Lücke). Fenstergröße 900px hoch vs. Standard: Chart-Höhe wuchs messbar mit
(229px → 361px). Mobile (375×812): Regler-Karte im normalen Fluss oben, Chart
feste Höhe, Programm-Karte weiterhin als Fixed-Bottom-Sheet, Rest-Grid
einspaltig — keine Regression. `LogsPage` (`/settings/logs`) unverändert mit
fester Chart-Höhe geprüft.

**Nachtrag (Nutzer-Feedback):** die uPlot-Legende ragte im Fill-Modus über den
unteren Kartenrand hinaus — `height` ist bei uPlot nur die Plot-/Achsenfläche,
die Legende kommt als eigene Zeile obendrauf, `el` hat im Fill-Modus aber eine
fixe CSS-Höhe (`h-full`), die beides fassen muss. Fix in `ChartCard.tsx`: die
tatsächlich gerenderte `.u-legend`-Höhe wird vor jedem `setSize()` gemessen und
von der Zielhöhe abgezogen (`fillHeight()`); da die Legende beim allerersten
Erstellen noch nicht existiert, folgt direkt nach `new uPlot(...)` ein
einmaliger Korrektur-Resize. Verifiziert bei zwei Fensterhöhen (900px und
700px) — Legende endet jeweils exakt an der Karten-Innenpadding-Kante, kein
Überstand mehr.

## 2026-09-12 — Regler-Card: kombinierter Ist/Soll-Slider + Regelbereich

Backlog-Punkt „Neues Regler-Design: Slider inkl. Sensorwert und Setpoint"
umgesetzt (linear; die zirkuläre Variante bleibt offen, siehe PLAN.md),
ausgelöst durch Nutzer-Wunsch nach einem Slider statt Zahlenfeld+Apply für
den Sollwert. Per Screenshot + Rückfragen geklärtes Interaktionskonzept: ein
Slider pro Regler, ein weißer Rundknopf = Sollwert (ziehbar), Track-Füllung
rot wenn Istwert < Sollwert (heizt noch), blau wenn darüber; Istwert selbst
nur als Text, kein eigener Marker. Sollwert-Text ist klickbar editierbar
(ersetzt Zahlenfeld+Apply). Der neue weiße-Knopf-Stil ist auch auf die
bestehenden Aktor-Slider (`ContinuousSlider`, `IntervalSlider`) übertragen.

**Neues Feld „Regelbereich" (`rangeMin`/`rangeMax`):** die Slider-Skala
sollte einstellbar sein, nicht starr an den Sensor-Messbereich gekoppelt.
Da SensActCtrl keinen festen `ControllerParams`-Struct hat (jeder
Controller-Typ baut `paramsJson()` von Hand), wanderte das neue Feld analog
zum bestehenden `enabled_`-Muster in die `Controller`-Basisklasse: privates
Feld-Paar + virtuelle `setRange()`/`rangeMin()`/`rangeMax()` mit
Default-Implementierung (`core/Controller.h`) — keine Änderung an den vier
Konstruktoren nötig, nur `paramsJson()` in `PIDController`/`TwoPointController`/
`DualStageController`/`SplitRangePIDController` um `rangeMin`/`rangeMax`
erweitert. Sentinel für „nicht gesetzt": `rangeMax <= rangeMin` (Default
0/0) — kein NaN in JSON, keine zusätzliche Bool-Flag. `DynamicItems.cpp`
ruft `concrete->setRange(...)` einmalig direkt nach dem Bauen der konkreten
Instanz, vor einem eventuellen `RateLimitedController`-Wrap (dessen
`paramsJson()` bettet das innere JSON ohnehin per `%s` ein — rangeMin/Max
erscheinen dadurch automatisch). Naming-Konvention wie bei `heat_actuator`/
`heatActuator` übernommen: `range_min`/`range_max` (Creation-Body,
snake_case) vs. `rangeMin`/`rangeMax` (Snapshot/Params, camelCase). Rein
additiv, keine SD-Migration nötig.

**Frontend:** neue geteilte `Slider`-Komponente (`components/Slider.tsx`) —
bleibt ein natives `<input type="range">` (Tastatur/Touch/A11y gratis), nur
Thumb/Track per CSS umgestylt (`.range-slider` in `styles.css`, weißer
Rundknopf statt `accent-color`), Füllfarbe per inline Gradient (Standardtrick,
da CSS allein „Füllung bis zum Thumb" bei nativen Range-Inputs nicht kann).
`ControllerCard.tsx` nutzt sie mit Fallback-Kette `params.rangeMin/Max` →
`linkedSensor.meta.min/max` → `0/100`. `AddItemModal.tsx`: neues
Formularfeld-Paar „Regelbereich" im typ-übergreifenden Controller-Block
(gilt für PID/TwoPoint/DualStage/SplitRangePID gleichermaßen), Platzhalter
zeigt den Messbereich des gewählten Sensors als Vorschlag, leer gelassen →
Feld wird nicht mitgesendet (Server-Default 0/0 → Sensor-Fallback greift).

**Verifikation:** `pio test -e native` (SensActCtrl) grün, 197 Tests inkl.
neuer `rangeMin`/`rangeMax`-Assertion in `test_pid.cpp`. `pio run -e esp32dev`
(BrewControl-Firmware) kompiliert. `npx @redocly/cli lint` gegen
`openapi.yaml` grün (`ControllerCreate.range_min/max`,
`ControllerParams.rangeMin/rangeMax` ergänzt). `pnpm typecheck` grün. Im
Browser-Pane gegen den `pnpm dev`-Mock geprüft: Slider-Drag ändert Farbe
live rot↔blau je nach Ist/Soll-Verhältnis, Klick auf den Sollwert-Text macht
ihn editierbar, Aktor-Slider (`ActuatorCard`) zeigen denselben weißen Knopf.
**Einschränkung:** der Dev-Mock-Server kennt `range_min`/`range_max` nicht
(eigene simulierte Params, keine echte Firmware) — dass das Feld tatsächlich
über `POST /api/controllers` persistiert und im Snapshot zurückkommt, ist
damit nicht end-to-end geprüft; siehe PLAN.md → Hardware-Verifikation offen.

**Nachtrag (Nutzer-Feedback, gleicher Tag):** die erste Fassung füllte den
Track bis zum Knopf (Sollwert) statt bis zum Istwert — der Knopf sollte laut
Vorgabe unabhängig vom farbigen Balken stehen, der Balken zeigt nur, wo der
Istwert im Regelbereich liegt. Zusätzlich fühlte sich das Ziehen "hakelig"
an. Root Cause für beides: `Slider` reichte jeden `onInput`-Tick des Drags
per `setSp()` bis in `ControllerCard` hoch — das ließ die ganze Karte
(ToggleSwitch, ConfirmModal, Ist/Ausgang-Zeile, …) bei jedem Maus-Pixel neu
rendern, und die Track-Füllung war direkt an den gezogenen Wert gekoppelt.
Fix in `Slider.tsx`: das Dragging bleibt jetzt vollständig lokal in der
Komponente (`useState`/`useEffect` wie schon in `ActuatorCard`s
`ContinuousSlider` vorgemacht) — nur das native `change`-Event (feuert genau
einmal, beim Loslassen) reicht per `onChange` nach oben durch, `onInput` ist
optional und wird von `ControllerCard` gar nicht mehr genutzt. Neue
`fillValue`-Prop entkoppelt die Balkenfüllung vom Thumb-Wert: die farbige
Leiste liegt jetzt als eigenes `position:absolute`-Div hinter einem
Track-transparenten `<input>`, `ControllerCard` übergibt dafür den Istwert
des Sensors, `ActuatorCard`s Slider lassen `fillValue` weg (Fallback = eigener
Wert, unverändertes Verhalten). Verifiziert im Browser-Pane: Balken folgt dem
Istwert unabhängig vom Knopf, Drag fühlt sich nativ/flüssig an, Sollwert-Text
und Farbe aktualisieren erst nach dem Loslassen (kein Netzwerk-Call während
des Ziehens mehr).

**Zweiter Nachtrag (gleicher Tag):** der weiße Knopf lag unter dem farbigen
Balken (Div mit `position:absolute` stapelt über dem nicht-positionierten
nativen `<input>`, unabhängig von der DOM-Reihenfolge) — Fix: `<input>`
bekommt selbst `position:relative`, damit beide Kinder im selben positionierten
Stacking-Kontext liegen und die DOM-Reihenfolge (Input nach dem Fülldiv)
gewinnt.

**Dritter Nachtrag:** trotz der lokalen Drag-State-Isolation blieb das Ziehen
weiter hakelig. Root Cause: der Regler in der Demo wird aktiv von einem
laufenden Programm gesteuert und ändert `setpoint` autonom im Sekundentakt
(beobachtet: Tausende Setpoint-POSTs, ganz ohne eigene Interaktion). Jede
externe `setpoint`-Änderung lief über `ControllerCard`s
`useEffect(() => setSp(setpoint.toString()), [setpoint])` in einen neuen
`value`-Prop an `Slider`, dessen eigener Resync-`useEffect` den lokalen
Drag-Wert mitten im Ziehen überschrieb — der Knopf sprang dadurch unter dem
Cursor auf den zuletzt bekannten Serverwert. Fix in `Slider.tsx`: ein
`dragging`-Ref, gesetzt via `onPointerDown` (deckt Maus/Touch/Pen einheitlich
ab) und zurückgesetzt via `onChange`/`onBlur`; der Resync-Effekt überspringt
`setLocal(value)`, solange `dragging.current` true ist. Betrifft nur
`Slider.tsx`, keine anderen Dateien. Verifikation war ungewöhnlich aufwändig:
synthetische `dispatchEvent('input', …)`-Tests in der Konsole lösten dabei
selbst ein natives `change` aus (Browser-Eigenheit bei nicht-getrusteten
Events auf `<input type=range>`, imitiert keinen echten Drag) und erzeugten
irreführende Fehlsignale — verifiziert wurde am Ende mit echten, getrusteten
Maus-Drags (`left_click_drag`): Regler-Slider landet exakt auf dem
gezogenen Wert trotz der ständigen Hintergrund-Updates des Demo-Programms,
Aktor-Slider (`IDS1`) weiterhin unverändert korrekt.

**Vierter Nachtrag:** Nutzer meldet weiterhin Springen beim Ziehen — auch bei
`testpid`, dessen `setpoint` nachweislich stabil ist (3× über 4s unverändert
per `/api/snapshot` geprüft), was die Autonomous-Churn-Erklärung aus dem
dritten Nachtrag widerlegt. Zu Recht eingewandter Einwand: ein echter,
handgeführter Maus-Drag unterscheidet sich von einem skriptgesteuerten
(egal ob synthetisches `dispatchEvent` oder CDP-`left_click_drag`) —
Letzterer generiert vermutlich nur wenige Zwischenpunkte statt der vielen
Events eines echten, oft nicht perfekt horizontalen Drags. Neue Hypothese:
verlässt der Cursor während eines echten Drags kurz die (nur 18px hohe)
Slider-Box, kann der Browser vorzeitig ein natives `change`-Event feuern,
obwohl die Maustaste noch gedrückt ist — bis jetzt hing das Zurücksetzen von
`dragging.current` an genau diesem `change`, wodurch der anschließende
Server-Roundtrip den Knopf mitten im (physisch noch laufenden) Drag
zurückgesetzt hätte. Fix: `dragging.current` hängt jetzt an
`onPointerUp`/`onPointerCancel` statt an `onChange` — `change` löst weiterhin
den Commit aus, beendet aber nicht mehr die Drag-Guard. **Nicht abschließend
verifiziert:** eigene Versuche, einen Drag außerhalb der Slider-Box per
`left_click_drag` zu simulieren, lieferten kein eindeutiges Bild (CDP
repliziert offenbar kein echtes Pointer-Capture-Verhalten).

**Fünfter Nachtrag:** Nutzer lieferte den entscheidenden Beleg — Chrome DevTools
Network-Tab zeigt beim Ziehen Dutzende `setpoint`-POSTs pro Sekunde. Damit
widerlegt: das native `change`-Event feuert in Chrome für `<input
type="range">` beim Maus-Drag **nicht** einmalig bei Loslassen (wie MDN nahelegt
und wie in den vorherigen Nachträgen angenommen), sondern fortlaufend während
des gesamten Ziehens — das erklärte sowohl den Netzwerk-Flood als auch das
Springen (jeder dieser Zwischen-Commits ging über `applySp()` zurück an den
Server und kam als neuer `setpoint`-Prop wieder rein). Nutzer schlug direkt den
richtigen Fix vor: Senden strikt an `pointerup` koppeln, nicht an `change`.
Umsetzung in `Slider.tsx`: `onInput`/`onChange` fassen `local`/`localRef` nur
noch lokal an, ein `commit()` (dedupliziert gegen den zuletzt gesendeten Wert
via `lastSent`-Ref) läuft ausschließlich über `onPointerUp` — `onChange` bleibt
nur als Fallback für den Tastatur-Pfad (Pfeiltasten ohne Pointer-Events) und
ist dabei durch `if (!dragging.current)` gegen doppeltes Senden nach einem
bereits erfolgten Pointer-Commit abgesichert. Verifiziert: bei einem
CDP-Drag (`left_click_drag`) läuft jetzt genau 1 `setpoint`-POST statt vieler,
Wert landet weiterhin exakt auf der gezogenen Position. Ob damit auch das vom
Nutzer gemeldete Netzwerk-Flooding bei echter Maus vollständig behoben ist,
steht noch aus — muss der Nutzer selbst mit echter Maus/DevTools
gegenprüfen, da CDP das reale `change`-Verhalten dieses Chrome/OS nicht
zuverlässig nachstellt (siehe vierter Nachtrag).

**Sechster Nachtrag:** Netzwerk-Flood war behoben, aber der Knopf sprang
weiterhin gelegentlich ("jedes zweite Mal") auf den vorherigen Wert zurück —
zusätzlich der Wunsch, den Sollwert beim Ziehen auch live im Textfeld zu
sehen (bisher erst nach dem Loslassen, seit dem dritten Nachtrag). Root
Cause des Zurückspringens: `ControllerCard.tsx`s Slider-`onChange`
(`(v) => { setSp(v.toString()); applySp(); }`) rief `applySp()` im selben
Tick wie `setSp()` auf — `applySp()` las `sp` aber aus dem **alten**
Closure (der State-Update von `setSp` wird erst beim nächsten Render
wirksam), schickte also nicht den frisch gezogenen Wert an den Server,
sondern den vorherigen. Traf der nächste Snapshot-Poll exakt in dem
Zeitfenster ein (abhängig von Float-Serialisierungs-Jitter, daher nur
gefühlt "jedes zweite Mal"), sprang der ControllerCard-`useEffect`
(`setSp(setpoint.toString())`) auf diesen alten Wert zurück. Fix:
`applySp(v?: number)` nimmt den Wert jetzt optional als Parameter, Slider-
`onChange` reicht ihn direkt durch (`applySp(v)`) statt sich auf den
Closure-`sp` zu verlassen; der Text-Input-Pfad (Enter/Blur) ruft weiter ohne
Argument auf (dort ist `sp` nicht veraltet, da Tippen über mehrere Render-
Zyklen läuft). Live-Textfeld-Update beim Ziehen wieder ergänzt: Slider
bekommt jetzt zusätzlich `onInput={(v) => setSp(v.toString())}` — rein
lokale State-Änderung, kein Netzwerk-Call, da nur `onChange` (nach wie vor
strikt an `pointerup` gekoppelt) tatsächlich sendet. Verifiziert: drei
aufeinanderfolgende Drags im Browser-Pane, per instrumentiertem `fetch` der
tatsächlich gesendete Wert mit dem angezeigten verglichen — stimmte jedes
Mal exakt überein, kein Zurückspringen auch nach 2s Wartezeit (Snapshot-Poll
sollte da längst durch sein).

## 2026-09-13 — Timer-Widget (Backlog-Punkt umgesetzt)

Freistehende Kitchen-Timer für Brau-Timings (Hopfengaben, Rührintervalle,
Rasten außerhalb eines Programms) — server-persistiert (übersteht Reboot und
Browser-Reload) und mit Push-Benachrichtigung beim Ablaufen, analog zum
bestehenden Programm-Feature. Ursprünglich als „Timer-Gruppe" mit mehreren
benannten Timern pro Widget geplant; nach Rückfrage stellte sich heraus, dass
einzelne, eigenständige Timer-Elemente gewünscht waren (wie Sensor-/Aktor-
Karten) — Gruppierung ersatzlos verworfen, dadurch entfielen auch die Fragen
nach ID-Eindeutigkeit über Gruppen hinweg und einem Pro-Timer-Notify-Flag
(jeder Timer benachrichtigt immer, ohne Opt-out).

**Firmware:** Neue Komponente `TimerStore.h/.cpp`, 1:1 nach dem Vorbild von
`ProgramRunner` — flache Liste von `{id, name, durationSec, status,
startedEpoch, elapsedAtPauseSec}`, wall-clock-epoch-basierte Persistenz nach
`/config/timers.json`, NTP-Gate (`nowEpoch > 946684800L`) wie bei
Programmen/Logs. `control()` kennt `start|pause|resume|stop` — kein `reset`
als eigene Action, da es mit `stop` identisch gewesen wäre (Redundanz beim
Implementieren aufgefallen und ersatzlos gestrichen). Neue Routen
`GET/POST /api/timers`, `POST/DELETE /api/timers/<id>`,
`POST /api/timers/<id>/control`, exakt nach dem `/api/programs`-Muster.
Ablauf feuert `AlarmStore::onTimerExpired` (neuer `AlertKind: timer`), darüber
`PushService::describe_` mit „Timer abgelaufen" — Kette 1:1 von
`onProgramStatus`/„Programm fertig" gespiegelt. `DashboardConfig` um
`timers: string[]` erweitert (`DashboardStore`, `types.ts`, `openapi.yaml`).

**Frontend:** `fmtDuration()` aus `ProgramCard.tsx` nach neuem
`web/src/format.ts` extrahiert (jetzt auch von `ProfilesPage.tsx` importiert).
Neue `TimerCard.tsx` (Card-Shell/Badge/Progressbar-Idiom wie `SensorCard`/
`ProgramCard`), im normalen Item-Grid neben Sensor-/Aktor-/Regler-Karten
platziert (kein eigener Spalten-/Bottom-Sheet-Sonderfall wie beim
Programm-Widget, da ein Timer nichts „claimt"). `Dashboard.tsx` pollt
`GET /api/timers` im 1s-Intervall, unabhängig von der SSE-Snapshot (gleiche
Begründung wie bei Programmen).

**Nachtrag (selber Tag):** Erste Version legte Timer über ein Inline-Formular
in `DashboardContentModal.tsx` an (Name + Minuten, kein Rename-Fluss). Zwei
Nutzer-Rückmeldungen dagegen: (1) Klick auf „Anlegen" tat sichtbar nichts —
Root Cause: das an diesem Gerät laufende `pnpm dev` proxied gegen ein echtes,
noch nicht neu geflashtes Board, `POST /api/timers` lief dort ins Leere
(404); `createTimer()` wurde aber `await`-los aufgerufen, die verworfene
Promise schluckte den Fehler komplett, ohne jede UI-Rückmeldung. (2) Wunsch
nach einem eigenen Modal statt Inline-Formular, um später weitere
Timer-Einstellungen unterzubringen. Fix: neue `TimerEditorModal.tsx` (Create
**und** Edit, Muster wie `NameModal`/`LogEditorModal`) — der Submit-Handler
awaitet `onSave` jetzt selbst und zeigt einen Fehlertext im Dialog, statt ihn
verschluckt als unhandled rejection verschwinden zu lassen. Damit auch der
Bearbeiten-Stift auf `TimerCard` verdrahtet (`openEditTimer`) — die zuvor als
bewusste Lücke vermerkte fehlende Rename/Dauer-Änderung ist damit erledigt,
kein separater PLAN.md-Eintrag mehr nötig. `DashboardContentModal.tsx`
behält nur noch die Checkbox-Auswahl bestehender Timer; „+ Neuen Timer
erstellen" öffnet jetzt das neue Modal (`onNewTimer`), analog zu „+ Neues
Programm erstellen". Im Browser gegen das reale (alte) Gerät nachgestellt:
Klick auf „Erstellen" zeigt jetzt sichtbar „Error: 404 Not Found" im Dialog
statt schweigend nichts zu tun.

**Verifiziert:** `pio run -e esp32dev` (Compile-Smoke, Flash 84.0%/RAM 18.2%),
`pio test -e native` (30/30 grün, unverändert — `TimerStore` selbst ist wie
`ProgramRunner` nicht nativ testbar, da es an Arduino/FreeRTOS/`SdLock`
hängt), `npx @redocly/cli lint` (grün), `pnpm typecheck` (grün), Fehlerpfad
im Browser gegen ein echtes (noch altes) Gerät nachgestellt. Der eigentliche
Funktionspfad (Timer anlegen und laufen lassen) steht noch aus — braucht ein
mit dieser Firmware neu geflashtes Board, siehe PLAN.md → Hardware-
Verifikation offen.

**Zweiter Nachtrag (selber Tag) — Hardware-E2E abgeschlossen:** LilyGo
T-Display-S3-AMOLED (COM9) geflasht. `pio run -t upload` scheiterte erst
zweimal mit „No serial data received" / „Unable to verify flash chip
connection" — deterministisch reproduzierbar, kein Flackern, deckt sich mit
der schon dokumentierten TinyUSB-CDC-Instabilität dieses Boards unter
Windows (siehe `BrewControl/CLAUDE.md`). Auch mit fest gepinntem
`upload_speed = 115200` (umgeht den sonst separaten „Changing baud rate"-
Schritt) kam die Verbindung nicht zuverlässig durch — der Nutzer hat
stattdessen manuell geflasht (BOOT gehalten + RESET angetippt, danach lief
der Upload durch). Die testweise ergänzte `upload_speed`-Zeile in
`platformio.ini` danach wieder entfernt, da sie das eigentliche Problem
nicht löste und nichts zur Sache tut.

Nach dem Flash lief das aktive Maischeprogramm (`Verzuckerungsrast`-Schritt)
nahtlos weiter — Beleg, dass `ProgramRunner`s Epochen-Persistenz auch einen
durch uns ausgelösten Neustart mitten im Lauf sauber übersteht, nicht nur
einen Stromausfall.

**Timer-Funktionstest am Gerät:** Über das Dashboard einen Timer „hopfengabe"
angelegt (Fehler aus dem ersten Nachtrag damit implizit miterledigt — Nutzer
bestätigte „funktioniert alles"), Start/Pause/Stop im Browser gegen das
Live-Gerät durchgeklickt, Countdown lief sichtbar.

**Push-Benachrichtigung:** vom Nutzer eigenständig geprüft, funktioniert.

**Reboot-Test (API-getrieben, ohne Board-Zugriff):** Timer per
`POST /api/timers/{id}/control {"action":"start"}` gestartet (`durationSec`
60, `startedEpoch` notiert), nach ~8 s per `POST /api/network
{"hostname":"brewcontrol"}` einen sicheren Reboot ausgelöst (ändert keine
WLAN-Daten, siehe Test-Boards-Memo), Gerät nach ~2 s wieder erreichbar.
**Beleg für einen echten Neustart:** `state.t` (millis seit Boot) aller
Sensoren/Aktoren im Snapshot lag bei ~40000 (40 s) statt der Stunden an
Laufzeit, die die Session vorher schon lief. `startedEpoch` blieb über den
Reboot hinweg unverändert; `remainingSec` fiel kontinuierlich nach
Wall-Clock (60→45→36→0), keine Rücksetzung auf `durationSec`, kein Einfrieren
— der Timer landete exakt zur richtigen Zeit auf `done`. Maischeprogramm und
Regler/Aktor-Zustand kamen ebenfalls unauffällig zurück. Damit sind beide
zuvor offenen Hardware-Verifikationspunkte (Reboot-Überleben, Push) erledigt
— Eintrag aus `PLAN.md` → Hardware-Verifikation entfernt.

## 2026-09-13 — Timer-Erweiterung: Uhrzeit-Modus, Start/Stop-Aktion, Wiederholen

Der freistehende Timer konnte bisher nur ablaufen und eine Push-Meldung
auslösen. Auf Wunsch erweitert um: (1) statt einer reinen Dauer auch eine
Zieluhrzeit einstellbar (`mode: duration|clock`, `timeOfDay: "HH:MM"`) —
praktisch fürs automatische Vorheizen zum Brautag-Start; (2) eine optionale
Start/Stop-Aktion auf einen Aktor, Regler oder ein Programm bei Ablauf
(`onExpire: {targetType, targetId, action}`); (3) Wiederholen, das im
Uhrzeit-Modus driftfrei auf „morgen selbe Zeit" rearmt und im Dauer-Modus
dieselbe Dauer erneut abzählt.

**Architektur:** `durationSec` bleibt die einzige Laufzeitgröße — im
Uhrzeit-Modus wird sie bei jedem Start/Rearm frisch aus `timeOfDay` berechnet
(`TimerSchedule.h`, neu, reine C++-Helfer analog `ProgramTargets.h`, nativ
getestet). Die Aktion feuert direkt in `TimerStore::tick()` gegen
`Registry`/`ProgramRunner` (dafür deren Referenzen neu in die Signatur
aufgenommen, ein Zeilen-Change am Aufrufer in `WebUI.cpp`) — das muss auch
ohne offenen Browser funktionieren. Locking geprüft: kein Deadlock-Pfad, da
weder `ProgramRunner` noch `Registry`/`Actuator`/`Controller` zurück in
`TimerStore` rufen, exakt das Muster, das `WebUI::tick()` mit
`programs_.tick(reg_, ...)` schon lebt.

**Umgesetzt:** `TimerStore.h/.cpp`, neue `TimerSchedule.h` + native Tests
(`test_timer_schedule`, 7 Fälle inkl. Mitternachts-Übergang und „exakter
Treffer rollt vollen Tag"), `WebUI.cpp` (Tick-Aufruf), `openapi.yaml`
(`TimerMode`, `TimerExpireAction`, erweiterte `TimerInput`/`Timer`-Schemas,
korrigierte Endpoint-Beschreibung), `types.ts`/`api.ts`,
`TimerEditorModal.tsx` (Dauer/Uhrzeit-Segmented, Wiederholen-Checkbox,
Aktion-Picker für Aktor/Regler/Programm mit Start/Stop), `TimerCard.tsx`
(Uhrzeit-Anzeige, Repeat-Icon, Aktionszeile). Abwärtskompatibel: alte
`timers.json`-Einträge ohne die neuen Felder laden über dieselben
`|`-Defaults wie bisher als normale Dauer-Timer.

**Verifikation:** `pio test -e native` (37/37, inkl. neuer
`test_timer_schedule`-Suite), `pio run -e esp32dev` + `-e
lilygo_t_display_s3_amoled` kompiliert, `npx @redocly/cli lint` sauber,
`pnpm typecheck` + `pnpm build` sauber.

**Hardware-E2E am LilyGo T-Display-S3-AMOLED (`brewcontrol.local`,
192.168.178.87, reine Testumgebung ohne reale Aktoren):** neue Firmware
geflasht (`pio run -e lilygo_t_display_s3_amoled -t upload --upload-port
COM9`, lief ohne manuellen BOOT/RESET-Eingriff durch — anders als beim S2
Mini nicht nötig). Danach per `curl` gegen die echte API getestet:
- Alter Timer „hopfengabe" (vor dem Feature angelegt, ohne `mode`/`repeat`/
  `onExpire` in `timers.json`) lädt nach dem Flash weiterhin korrekt als
  normaler Dauer-Timer — Abwärtskompatibilität bestätigt.
- Uhrzeit-Timer mit `onExpire` auf „Riptide Pumpe" (start), Ziel 2 Min. in der
  Zukunft: `durationSec` exakt korrekt aus der Ziel-Uhrzeit berechnet (80 s bis
  19:14 Uhr, real UTC+2 via Settings), nach Ablauf schaltete die Pumpe live um
  (`enabled:false→true`, `state.v:0→1`) — der Direktzugriff auf
  `Registry`/`ProgramRunner` aus `TimerStore::tick()` funktioniert ohne
  offenen Browser.
- Dauer-Timer (15 s) mit `repeat`: vier Zyklen beobachtet, `startedEpoch`
  sprang exakt im 15-s-Raster weiter, Status blieb durchgehend `running`
  (kein Zwischenstopp bei `done`).
- Uhrzeit-Timer mit `repeat`: nach dem ersten Ablauf sprang `durationSec` von
  55 auf exakt 86400 und `startedEpoch` wurde auf den exakten
  Ablaufzeitpunkt rebased (Status blieb `running`) — der drift-freie
  „morgen selbe Uhrzeit"-Rearm funktioniert wie geplant.
- Reboot-Test (sicherer Trigger über `POST /api/network` mit unverändertem
  Hostnamen) während ein Uhrzeit+Repeat+Aktion-Timer lief: nach dem Neustart
  (Uptime laut `state.t` ~22 s, also echter Reboot) waren `mode`, `timeOfDay`,
  `repeat`, `onExpire`, `startedEpoch` und `durationSec` unverändert erhalten,
  `remainingSec` lief nach Wall-Clock korrekt weiter statt zurückgesetzt zu
  werden.
- Alle Testtimer und der Pumpen-Zustand danach wieder aufgeräumt/zurückgesetzt.
  Nebenbefund (nicht durch diese Änderung verursacht, bestehendes Verhalten):
  der Reboot setzte den `mash`-Regler-Sollwert von einem manuell gesetzten
  Laufzeitwert (72 °C) auf den Config-Default (65 °C) zurück — das
  zugehörige Programm „Hermann-Weizen" stand dabei bereits auf `idle`, war
  also nicht aktiv am Steuern; nicht-programmgebundene Sollwerte werden beim
  Boot grundsätzlich nicht persistiert.

Damit ist der zuvor offene Hardware-Verifikationspunkt für die Timer-Erweiterung
erledigt — Eintrag aus `PLAN.md` entfernt.

## 2026-09-13 — Alternative Card-Darstellungen: Gauge & Kompakt für Sensor/Regler/Timer

Sensor-, Regler- und Timer-Cards hatten bisher nur eine feste Darstellung.
Ergänzt um zwei zusätzliche Anzeigevarianten pro Widget: **Gauge** (rundes
SVG-Gauge, ~doppelte Höhe) und **Kompakt** (~halbe Höhe). Absorbiert zwei
offene Backlog-Punkte: „Zirkuläre Variante des Regler-Sliders" (linear war
seit 2026-09-12 umgesetzt) und „Sensor-/Aktor-/Controller-Cards: feste
Höhe/Breite".

**Datenmodell:** additiv, kein Breaking Change — `DashboardConfig` bekommt
drei neue Maps (`sensorModes`/`controllerModes`/`timerModes`, id → `'compact'
| 'gauge'`); `'normal'` wird nie gespeichert, ein fehlender Eintrag heißt
implizit normal. Firmware (`DashboardStore.h/.cpp`) hält sie als
`vector<pair<string,string>>` neben den bestehenden ID-Listen, reine
Passthrough-Felder (Frontend interpretiert die Werte, Firmware nicht).
`docs/openapi.yaml` um `WidgetMode`-Schema + die drei Properties auf
`DashboardInput`/`Dashboard` ergänzt.

**Gauge-Primitive:** neue `Gauge.tsx` — 270°-Bogen (90°-Lücke unten mittig),
`pathLength={100}`-Trick für prozentuale `stroke-dasharray`-Füllung statt
Umfangsrechnung. Optionale `interactive`-Variante (nur vom Regler genutzt)
mit ziehbarem Thumb: Pointer-Winkel relativ zum SVG-Mittelpunkt berechnet
(`atan2`), Totzonen-Snap auf 0/100 % in der unteren Lücke, Commit-Semantik
1:1 von `Slider.tsx` übernommen (`onInput` laufend fürs visuelle Feedback,
`onChange` erst einmalig bei `pointerup`/`pointercancel` — vermeidet den dort
schon dokumentierten Chrome-Bug mit dauerfeuerndem `change`). Zusätzlich
`fillValue`-Prop (unabhängig vom Thumb-Wert), damit der Regler-Gauge wie der
lineare Slider gleichzeitig Ist (Füllbogen) und Soll (Thumb) zeigt.
Pfeiltasten-Nudge + `role="slider"`/`aria-value*` für Tastatur-Zugänglichkeit,
da ein SVG-Custom-Control die native Range-Semantik nicht mitbringt.

**Umschalten:** neuer Icon-Button (`CardModeButton.tsx`) direkt im
Card-Header, nur im Bearbeiten-Modus sichtbar, zyklisch normal → gauge →
compact → normal. `Dashboard.tsx` bekam dafür `cycleMode()` neben
`patchActiveDash`; `handleRenamed()` zieht beim Umbenennen eines Sensors/
Reglers dessen Modus-Eintrag mit um, sonst würde er stillschweigend auf
normal zurückfallen.

**Grid:** Dense-Packing (`[grid-auto-flow:dense]` +
`[grid-auto-rows:minmax(72px,auto)]`) statt der bisherigen gleichförmigen
Zeilenhöhe — Basis-Einheit 72 px, `row-span-1/2/4` für kompakt/normal/gauge
(2×72+Gap = exakt die bisherigen 160 px, war der Ableitungsanker für die
Einheit). `minmax(…, auto)` statt eines festen Werts, damit eine Karte, die
ihr Zeilenbudget sprengt (z. B. eine umbrechende Alarm-Badge), wächst statt
abzuschneiden. `ActuatorCard` bleibt inhaltlich unverändert, bekommt aber ein
hartkodiertes `row-span-2`, sonst würde Dense-Packing sie auf eine 72-px-Zeile
stauchen.

**Verifikation:** `pnpm typecheck` sauber, `npx @redocly/cli lint` sauber,
`pio run -e esp32dev` kompiliert die `DashboardStore`-Änderung fehlerfrei.
Live gegen `brewcontrol.local` (192.168.178.87, per `pnpm dev`-Proxy) im
Browser durchgeklickt: alle drei Widget-Typen durch alle drei Modi zyklen,
Dense-Grid-Packing bei gemischten Höhen (kein Clipping/Overlap), Regler-Gauge
per Drag über den vollen Bogen inkl. unterer Lücke gezogen — echter
`setControllerSetpoint`-Request feuerte laut Netzwerk-Log nur genau einmal
beim Loslassen, per `GET /api/snapshot` gegen das Gerät bestätigt (Sollwert
tatsächlich übernommen, danach wieder auf 65 °C zurückgesetzt), Klick-zum-
Bearbeiten-Eingabe im Gauge-Zentrum funktioniert trotz `pointer-events-none`-
Overlay (gezielt `pointer-events-auto` auf dem Center-Content). Dark/Light
manuell umgeschaltet, Gauge in beiden lesbar. **Nicht gemacht:** neue
Firmware wurde nicht auf das Testboard geflasht (siehe PLAN.md →
Hardware-Verifikation offen) — `sensorModes`/`controllerModes`/`timerModes`
liefen serverseitig deshalb nur gegen die alte Firmware, die das Feld beim
Speichern stillschweigend verwirft (Reload zeigte dadurch erwartungsgemäß
wieder „normal" — kein Frontend-Bug, nur alte Firmware auf dem Gerät).

## 2026-09-13 — Fix: ControllerCard/ActuatorCard zeigten verknüpfte Items auf anderen Tabs nicht an

**Root Cause:** `Dashboard.tsx` reichte `ControllerCard`/`ActuatorCard` die
Tab-gefilterte `displaySnap.sensors`/`.actuators`/`.controllers` (aus
`filterSnap`) statt des vollen Snapshots durch. Lag der per `params.sensor`/
`params.actuator` verknüpfte Sensor/Aktor eines Reglers (oder der steuernde
Regler eines Aktors) auf einem anderen Dashboard-Tab, fand der `.find()`-
Lookup ihn nicht — Ist-Wert, Ausgang, Regelbereich (Fallback auf 0–100) und
Einheit fehlten auf der Regler-Karte, die „Steuert von …"-Zuordnung auf der
Aktor-Karte ebenso.

**Umsetzung:** `sensors`/`actuators`/`controllers` an beiden `ControllerCard`-
Stellen und an `ActuatorCard` auf den ungefilterten `snap` umgestellt — die
Tab-Filterung (`displaySnap`) bestimmt weiterhin nur, welche Karten auf einem
Tab überhaupt erscheinen, nicht mehr, welche verknüpften Items eine Karte
auflösen kann.

**Verifikation:** `pnpm typecheck` grün. Live gegen `brewcontrol.local`
geprüft: Regler `testpid` (Sensor `mlt` + Aktor `kettle`, beide auf anderen
Tabs) zeigt auf dem „Gärung"-Tab jetzt korrekt Ist-Wert, Ausgang und den vom
Sensor geerbten Regelbereich.

## 2026-09-13 — Zugriffsschutz Stufe 2: auch die UI/Leseseite sperrbar

Bisheriger Schutz (Stufe 1, 2026-09-05) gilt nur für schreibende Routen;
Lesen — inklusive `index.html`/JS/CSS und `/api/snapshot` — blieb laut
README immer offen, auch bei gesetztem Passwort. PLAN.md-Punkt „Zugriffsschutz:
Option auch für die UI selbst anbieten" verlangte eine Option, das ebenfalls
zu sperren. Mit dem Nutzer geklärt (AskUserQuestion): volle Sperre (eigene
Login-Seite statt SPA-Gerüst mit leeren Daten) als eigener Schalter,
zusätzlich zum Passwort — das bisherige Verhalten bleibt Default.

**Mechanismus:** ein einziges neues `AuthService::uiProtected_`-Flag
(`Preferences`-Key `authUiLock`, nur bei gesetztem Passwort setzbar, wird
beim Passwort-Löschen automatisch mit zurückgesetzt — ein UI-Lock ohne
Passwort wäre unwiederherstellbar). Die eigentliche Sperre ist **ein**
`server_.addMiddleware(...)`-Callback in `WebUI::begin()`
(`ArMiddlewareCallback`, dokumentiert in ESPAsyncWebServer für genau diesen
Zweck: „check authentication") statt Änderungen an jeder einzelnen GET-Route
oder an `serveStatic`/`onNotFound` einzeln. Server-Middleware läuft laut
`AsyncWebServerRequest::_runMiddlewareChain()` vor **jedem** Handler — Static-
File-Handler, SPA-Fallback (`onNotFound`) und jede API-Route eingeschlossen —
und kann die Antwort selbst senden, ohne `next()` aufzurufen. Damit reicht ein
Gate für alles: bei aktivem UI-Schutz und fehlender Session bekommt jedes GET
außerhalb von `/api/` (also `/`, jede statische Datei, jeder SPA-Client-Pfad)
eine eingebettete, eigenständige Login-Seite (`kLockedPageHtml`, reines HTML/
CSS/JS ohne externe Requests, im Firmware-Binary statt unter `/www` — die
LittleFS-Boards haben nur 256 KB Datenpartition, und die Seite muss auch
während eines laufenden UI-Uploads erreichbar bleiben); jede andere Route
außer `/api/auth/*` (sonst wäre Einloggen selbst blockiert) bekommt `401`.
Die bestehenden `requireAuth()`-Aufrufe in den Schreib-Handlern bleiben
unverändert für den „nur Passwort"-Fall.

**Neue Route:** `POST /api/auth/ui-protection` (Body `{"enabled"}`), verlangt
wie `/api/auth/password` eine bestehende Session, plus `409` ohne
konfiguriertes Passwort. `GET /api/auth/status` liefert zusätzlich
`uiProtected`. Frontend: `SecurityPage.tsx` bekam eine neue `ToggleSwitch`-
Karte „Auch Lesen/UI sperren" (nur sichtbar bei gesetztem Passwort und
angemeldet); `LoginModal.tsx`/`app.tsx` blieben unverändert, da Unauthenti-
fizierte bei aktivem UI-Schutz ohnehin nie die SPA laden, sondern direkt die
Locked-Page von der Firmware bekommen.

**Bekannte, bewusst nicht behobene Lücke:** läuft ein Tab schon offen und die
Session läuft währenddessen ab (7-Tage-TTL oder „Alle Sitzungen abmelden"),
zeigt das bestehende dismissible `LoginModal` weiter Stale-Daten/Fehler statt
sofort zur Locked-Page zu wechseln — ein Reload holt sie. Für den seltenen
Fall kein zusätzlicher Code.

**Verifikation:** `pio run -e esp32dev` kompiliert (Flash 85 %, RAM 18 %),
`pnpm typecheck` grün, `npx @redocly/cli lint` sauber (`openapi.yaml`:
`AuthStatus`-Schema + neue Operation + `401` bei allen bisher immer-offenen
GET-Routen ergänzt). Hardware-E2E gegen `brewcontrol.local` (LilyGo
T-Display-S3-AMOLED) vom Nutzer bestätigt: Passwort setzen, „Auch Lesen/UI
sperren" aktivieren, abgemeldet liefert `GET /` die eingebettete Login-Seite
statt der SPA, Login auf der Locked-Page setzt das Cookie und schaltet frei,
Schalter wieder aus stellt den „nur Schreiben geschützt"-Zustand wieder her.

**Nebenbei:** Board landete während des Tests im gesperrten Zustand ohne
bekanntes Passwort (vermutlich Rest eines früheren Tests, nicht aus dieser
Session). Ohne erreichbaren BOOT-Button am Board (T-Display-S3-AMOLED-1.43-
1.75 hat laut Schaltplan zwei Taster `S1`/GPIO0 und `SW1`/EN direkt am
USB-C, aber die Reihenfolge „BOOT halten + RESET drücken" schickt den
ESP32-S3 stattdessen in den seriellen Download-Modus statt den App-seitigen
Recovery-Check in `main.cpp` auszulösen — hat hier nicht funktioniert) per
`esptool.py --chip esp32s3 --port COM9 erase_region 0x9000 0x5000` nur die
NVS-Partition gelöscht (Offset/Größe aus der kompilierten
`partitions.bin` dieses Envs verifiziert, `gen_esp32part.py`) — WLAN +
Auth-Passwort weg, Firmware/UI/SD unangetastet. Danach WLAN neu eingerichtet,
Zugriffsschutz war wieder aus. Für den nächsten Fall: welche Session/wer
zuletzt ein Testpasswort auf einem der drei Boards gesetzt hat, bleibt
ungeklärt — beim Verlassen einer Testsession den Zugriffsschutz wieder
aufheben, sonst sperrt es die nächste Session aus.

## 2026-09-14 — Dashboard-Chart: Legende in die Titelzeile (Desktop)

Auf Desktop-Breite verlor die uPlot-Legende unter dem Chart unnötig viel
Platz. Erster Versuch per reinem CSS (`.uplot { flex-direction:
column-reverse }` ab 768px) schob sie nur über den Chart in eine eigene
Zeile; auf Wunsch danach in die gleiche Zeile wie der Karten-Titel verschoben.
Dafür bekam `ChartCard.tsx` einen neuen `legendHost`-Prop: sobald gesetzt,
wird `.u-legend` nach dem Bau des uPlot-Charts per `appendChild` dorthin
verschoben (uPlot selbst kümmert sich nicht um den DOM-Elternteil seiner
Legende) und beim Unmount/Rebuild wieder geleert — `uPlot.destroy()` entfernt
nur die eigene Root, nicht Knoten, die vorher herausgelöst wurden.
`Dashboard.tsx` kapselt Titel+Chart jetzt in einer lokalen `ChartRow`-
Komponente mit einem Platzhalter-`div` in der Titelzeile als Legend-Ziel
(als State geführt, weil der Ref erst nach dem Mount existiert und ChartCard
den erneuten Effect-Lauf zum Verschieben braucht); aktiv nur wenn
`isDesktop` (matcht den bestehenden `lg`-Breakpoint des Dashboards).
LogsPage/ArchivePage bekommen keinen `legendHost` und behalten die CSS-
Fallback-Lösung (Legende weiterhin in eigener Zeile über dem Chart ab
768px). Mobil unverändert (Legende unter dem Chart). Verifiziert live gegen
das Testboard `192.168.178.87`: Legendenwerte aktualisieren sich mit dem
Snapshot, Edit-Modus (Titel + Legende + Entfernen-Button in einer Zeile)
kollidiert nicht.

## 2026-09-16 — Dashboard-Tabs im Bearbeiten-Modus neu anordnen

Tab-Reihenfolge war bisher fix (Array-Position von `DashboardConfig[]`,
kein `order`-Feld) — Erstellen/Umbenennen/Löschen gab es, aber kein
Umsortieren. Neue ◀/▶-Pfeile am aktiven Tab im `editMode` verschieben ihn
um eine Position; bewusst kein Drag & Drop, da die UI auch auf
Touchscreens am Braustand zuverlässig bedienbar sein muss, und bewusst nur
Nachbar-Vertauschung statt einer vollständigen Reorder-Route (reicht für
den Anwendungsfall). Neu: `DashboardStore::move(id, dir)` (swapped
Vector-Nachbarn, No-Op an den Rändern) + `POST /api/dashboards/{id}/move`
(`WebUI.cpp`, analog zum bestehenden `/control`-Pattern bei
Programs/Timers) + `moveDashboard()` in `api.ts` + `moveTab()` in
`Dashboard.tsx` (folgt dem bestehenden Await-vor-Commit-Pattern ohne
Optimistic-Rollback, wie `patchActiveDash`). `docs/openapi.yaml` +
README-Routentabelle im selben Commit ergänzt. Keine neuen nativen
Firmware-Tests — `DashboardStore` hat wegen FS/SdLock-Abhängigkeit generell
keine `native`-Testabdeckung (auch `add`/`update`/`remove` nicht), das für
ein Feature nachzuholen wäre Überkonstruktion. Verifiziert: `pio run -e
esp32dev` + `pio test -e native` (37 bestehende Tests weiter grün) +
Redocly-Lint + `pnpm typecheck`/`build`; UI zunächst live gegen
`192.168.178.87` mit der alten Firmware (ohne `/move`) getestet — Pfeile
erscheinen nur am aktiven Tab im Edit-Modus, Rand-Buttons korrekt disabled,
fehlschlagender `/move`-Call (404, altes Board) lässt die Tab-Reihenfolge
unverändert statt sie clientseitig zu verfälschen. Danach die neue
Firmware per Netzwerk-OTA auf dieselbe LilyGo S3 aufgespielt
(`curl -F f=@firmware.bin http://192.168.178.87/api/update/firmware`,
Reboot bestätigt über `/api/update/status`) und den echten Persistenz-Pfad
verifiziert: ◀/▶ verschiebt den Tab, `POST /api/dashboards/<id>/move` →
`204`, Reload behält die neue Reihenfolge (SD-persistiert). Anschließend
die ursprüngliche Tab-Reihenfolge wiederhergestellt. **Nebenbei entdeckt:**
`POST /api/update/assets` (UI-Tar-Upload) schlägt auf diesem Board jetzt
auch fehl (`extract failed`, sofort) — bisher nur auf LOLIN S2 Mini bekannt
und dort anders (Reset nach ~65 KB); vermutlich zwei verschiedene Ursachen,
nicht weiter verfolgt, siehe PLAN.md. Deshalb blieb die UI auf dem Board
bei der alten Firmware-Version im `index.html`, ändert aber nichts an der
Verifikation, da der Test über den lokalen `pnpm dev`-Server lief (nur die
Firmware/API musste aktuell sein).

Direkt danach Nutzer-Feedback zur mobilen Ansicht: Auf schmalen Breiten
saßen „Bearbeiten"/„Hinzufügen"+„Fertig" in derselben Zeile wie die Tabs
und quetschten den Tab-Streifen auf einen kaum bedienbaren Rest zusammen.
Die Buttons sitzen jetzt bei `max-width < 1024px` in der Titelzeile neben
„BrewControl" statt in der Tab-Zeile — dieselbe Logik (`dashActions()` in
`Dashboard.tsx`) wird zweimal gerendert, einmal `lg:hidden` im Header,
einmal `hidden lg:contents` in der Tab-Zeile (Breakpoint deckt sich mit dem
bereits vorhandenen `isDesktop`/`lg`-Umschaltpunkt für den Chart-Legende-
Umzug). Ab 1024px unverändert wie vorher. Verifiziert per `pnpm build` +
live im Browser bei 375px und 1280px Breite gegen das echte Testboard.

Nachgebessert: Im Header (`items-center`) saßen die Buttons zu hoch,
sichtbar gegenüber der Mittellinie von „BrewControl" (Nutzer-Screenshot mit
Markierung). Ursache: `mb-2` auf den Buttons, eigentlich nur für die
Baseline-Ausrichtung im Desktop-Tab-Streifen (`items-end`) gedacht, verzerrt
im Header die Zentrierung. `dashActions()` bekommt jetzt einen
`alignEnd`-Parameter — `true` im Tab-Streifen (mit `mb-2`), `false` im
Header (ohne). Verifiziert bei 375px (Buttons jetzt auf einer Linie mit dem
Titeltext) und 1280px (Tab-Streifen unverändert).

## 2026-09-16 — Log-Chart: zusätzliche Y-Achsen pro Einheit

Alle Reihen eines Logs lagen bisher auf einer Y-Skala; mischte man z. B.
Temperatur (0–100 °C) mit einem 0/1-Aktor, wurde die kleine Reihe zur
flachen Linie. `ChartCard.tsx` gruppiert die Reihen jetzt nach Einheit
(bestehendes `unitOf()` aus `refs.ts`, Regler-Sollwert = Einheit seines
Sensors) und legt pro Gruppe eine eigene uPlot-Skala an: erste Gruppe links,
weitere rechts. Einheitslose Reihen bekommen je eine eigene Achse (0/1-Relais
und 0–255-PWM wären sonst wieder gemischt). Die Einheit steht waagerecht unter der jeweiligen Achse (auf
Höhe der Zeit-Ticks, als HTML-Element im `.u-axis`-Div per `ready`-Hook
statt uPlots gedrehtem `label`); eine Achse
mit genau einer Reihe nimmt deren Linienfarbe an; nur die linke Achse zeichnet
Gitterlinien. Einheiten werden beim Chart-Aufbau festgelegt — ohne
Live-Snapshot (Archiv, LogsPage vor erstem SSE-Event) wird einmal
`/api/snapshot` geladen. Keine API-Änderung. Verifiziert: `pnpm typecheck`,
`pnpm dev` gegen `192.168.178.87` — Dashboard-Log „Maischen“
(`sensor/mlt` + `controller/mash` in °C links, `actuator/kettle` rechts 0–1
in Grün) und Archiv-Ansicht einer alten Session zeigen beide Achsen korrekt,
keine Console-Fehler.

## 2026-09-16 — WebSocket als vierter Remote-Transport (SensActCtrl + BrewControl)

Neben MQTT, ESP-NOW und Webhook gibt es jetzt `WebSocketTransport`: eine
dauerhafte, bidirektionale Verbindung ohne Broker. **Rollen (Hub-Modell):**
der veröffentlichende Knoten (Leaf) ist Client und verbindet sich zum
konsumierenden Knoten (Hub), der den Server betreibt — nur ein Client blockiert
beim Connect, und ein Leaf hat genau eine solche Verbindung; der Hub muss die
Leaves nicht kennen. Der Hub-Server ist eine Geräteeinstellung (läuft
unabhängig von Items) — Voraussetzung für die spätere Autodiscovery (in
PLAN.md vorgemerkt, Mechanismus mDNS-SD vs. UDP noch offen). Library:
`links2004/WebSockets` 2.7.3 (Server + Client, in `loop()` gepollt wie der
Webhook-`WebServer`); verworfen `esp_websocket_client` (eigener Task, ab IDF 5
nicht mehr im Framework) und `AsyncWebSocket` (nur Server, Async-Abhängigkeit
für die Library).

**Library:** `WebSocketProtocol.h` (ein Text-Frame pro Nachricht:
`D<topic>\n<payload>` bzw. `R` als Retained-Request, dazu URL-Parser nur für
`ws://`), `WebSocketTransport` (Server broadcastet an alle Clients, kein
Relaying zwischen Clients; Retain-Emulation wie ESP-NOW: wer Subscriptions
hat, fragt bei jeder neuen Verbindung und nach `subscribe()` — pro `tick()`
zusammengefasst — den Retained-Cache der Gegenseite ab; Heartbeat 5 s/3 s/2,
Reconnect-Abstand 5 s). `lastErrorMessage()` zeigt immer auf ein
String-Literal, weil WebUI es aus dem AsyncTCP-Task liest. Test
`test_websocket_protocol` (13 Fälle), Beispiel `11_remote_websocket`.
**BrewControl:** Settings-Abschnitt `websocket` (`hubEnabled`/`hubPort`,
`publishEnabled`/`hubUrl`/`clientId`/`topicPrefix`), `WebSocketService`
(Hub-Server + Publish-Client mit `RemotePublisher`), Remote-Items mit
`transport:"websocket"` ohne Zusatzfelder (ohne Hub: `websocket hub not
enabled`), `GET /api/settings` mit `connected`/`error`/`hubClients`,
`-DWEBSOCKETS_TCP_TIMEOUT=1000`; Frontend: neue Seite Einstellungen →
Konnektivität → WebSocket, WebSocket-Button im Remote-Dialog. openapi.yaml,
READMEs nachgezogen. Umgesetzt in einem eigenen Worktree
(`worktree-websocket-transport`), weil parallel eine andere Session im
Haupt-Checkout an der Dashboard-Sortierung arbeitete.

**Verifikation:** `pio test -e native` 210/210; Firmware für alle drei Envs,
Flash je ~+29,8 KB (esp32dev 85,0 → 86,6 %, S2 81,8 → 83,3 %, LilyGo
23,6 → 24,0 %), RAM +72–80 B, keine neuen Warnungen; beide Beispiele per
`pio ci` (mit `-std=gnu++17` — die dokumentierten Befehle scheitern bei allen
Beispielen an `IntervalActuator.h` unter gnu++11, vorbestehend, in PLAN.md);
`pnpm typecheck`/`build`; `redocly lint` valide. **Hardware** (LilyGo war
durch die andere Session belegt): esp32dev als Hub, LOLIN S2 Mini als Leaf,
beide per OTA. Ohne Hub wird ein WebSocket-Remote-Item abgelehnt,
Settings-Validierung greift (`hubUrl`, `hubPort`, `clientId`). Hub-Port nimmt
den Handshake an (`101`), Leaf `connected:true`, Hub `hubClients:1`. Auf dem
Hub nachträglich angelegte Remote-Items (DigitalInput GPIO0, LED GPIO15 am S2)
hatten Meta + State sofort (Retained-Request); `write 1` am Hub schaltete die
LED am Leaf, der Zustand kam zurück. Hub-Neustart: Leaf meldete nach ~2 s
„Keine Verbindung zum Server" und war nach ~7 s ohne Eingriff wieder
verbunden, die gespeicherten Remote-Items auf dem Hub bekamen Meta/State neu.
Loop-Blockade bei nicht antwortendem Hub (`ws://192.168.178.250:8081`) von
außen über den Sensor-Zeitstempel gemessen: ~1 s Stillstand alle ~6 s (max.
1002 ms), mit erreichbarem Hub keiner. Danach Test-Items gelöscht und
WebSocket auf beiden Boards wieder ausgeschaltet. **Nicht verifiziert:** zwei
Leaves gleichzeitig und die neue UI am Gerät — der UI-Tar-Upload passt auf
esp32dev nicht mehr in die LittleFS-Partition (neues JS 100 KB gzip, in
PLAN.md), und das Browser-Pane startet keinen Dev-Server aus dem Worktree;
beides als offener HW-Punkt in PLAN.md.

## 2026-09-16 — Tar-Upload-Fehler (S2 Mini, LilyGo S3): eingegrenzt, noch nicht HW-verifiziert

Ausgangspunkt: zwei in PLAN.md dokumentierte Tar-Upload-Fehler auf
verschiedenen Boards (S2 Mini: `Connection was reset` nach ~65 KB; LilyGo S3:
sofortiges `extract failed`). Erster Schritt war zu klären, ob der
`TarExtractor`-Parser selbst kaputt ist: ein nativer Test-Harness
(`TarExtractor.cpp` direkt kompiliert, echtes `webui.tar` aus `pnpm build:sd`
+ `tar -C dist -cf webui.tar .`, in willkürlich kleinen 173-Byte-Häppchen
gefüttert) extrahiert alle 16 Dateien fehlerfrei — der Parser ist raus als
Ursache, das Problem liegt im SD/LittleFS-I/O (`SdTarSink`) oder im
Restzustand von `/www.new`.

Zwei Fixes eingebaut: `SdTarSink.h` — `/www.new` wird vor jeder Extraktion
jetzt über das bestehende `removeRecursive_()` geleert statt über
`fs_.rmdir()`, das bei nicht-leerem Verzeichnis stillschweigend nichts tut;
ein vorheriger fehlgeschlagener Lauf konnte also Dateileichen hinterlassen,
in die der nächste Versuch dann hineingeschrieben hätte (`FILE_WRITE` hängt
auf dieser Plattform an, statt zu überschreiben). `WebUI.cpp` — die
500-Antwort auf `/api/update/assets` trägt jetzt `TarExtractor::errorMsg()`
(`open failed`/`write failed`/`close failed`) plus den zuletzt versuchten
Pfad (`SdTarSink::lastPath()`) statt nur der generischen Meldung; dieselbe
Zeile geht zusätzlich auf `Serial`. `docs/openapi.yaml` entsprechend
nachgezogen.

**Verifiziert:** `pio test -e native` (37/37 grün), `pio run` auf allen drei
Envs (esp32dev, lolin_s2_mini, lilygo_t_display_s3_amoled) kompiliert,
Redocly-Lint valide. **Nicht verifiziert:** ob das der tatsächliche Root
Cause ist — dafür fehlt ein Hardware-Testlauf mit der neuen Firmware auf S2
Mini und LilyGo, der jetzt aber die genaue Fehlerstelle statt nur „extract
failed" zeigen sollte. Bis dahin bleibt der Punkt offen in PLAN.md.

**Nachtrag — Cross-Session-Info aus der parallelen WebSocket-Session
(2026-09-16):** dort am echten esp32dev reproduziert, mit dem
Doku-empfohlenen gz-only-Tar (~133 KB, gewachsen seit dem 100-KB-Befund vom
2026-09-10). Ergebnis deckt sich mit der schon in PLAN.md vermuteten
Platzursache: `/www.new/assets/…js.gz` landet mit 0 Byte, `/www` bleibt
unverändert, geschätzt ~84 KB frei (4-KB-Block-Schätzung) gegen 100 KB neues
JS-Gzip — aber der Client bekommt dabei **gar keine Antwort**
(`curl: (56) Recv failure: Connection was reset`), nicht die von
`openapi.yaml` versprochene `500`. Das ist dasselbe Fehlerbild wie der
ältere S2-Mini-Befund (`Connection was reset`, gleiche 256-KB-Partition) —
naheliegende, aber noch unbestätigte Vermutung: S2 Mini und esp32dev könnten
dieselbe Platz-Ursache teilen, nicht die zwei getrennten Fehlerbilder, von
denen PLAN.md bisher ausging. Ob es tatsächlich crasht/rebootet (statt eines
sauberen I/O-Fehlers) wurde nicht per Serial geprüft. PLAN.md entsprechend
konsolidiert: LittleFS-Boards (Platz, vermutlich gemeinsame Ursache) jetzt
als ein Punkt geführt, LilyGo (SD-I/O, bestätigt kein Platzproblem) separat.

## 2026-09-16 — Remote-Discovery (MQTT + ESP-NOW) + ESP-NOW-Unicast für Befehle

Remote-Items mussten bisher komplett von Hand eingetragen werden (Gerät,
Remote-ID, Prefix, Kanal) — fehleranfällig, zumal BrewControl mit Prefix
`brewcontrol` publisht, Remote-Items aber `sensactctrl` vorbelegen. Jetzt gibt
es im Remote-Bereich des Hinzufügen-Dialogs „Geräte suchen".

**Entscheidungen:** Request/Response über Topics statt MAC-Pairing, einmal in
der Library über `ITransport` (läuft auf MQTT und ESP-NOW, später
WebSocket/Webhook). Retained-Announce + Last Will (Home-Assistant-Muster)
verworfen: braucht Wildcard-Subscribe (keiner unserer Transporte kann das),
hinterlässt Leichen am Broker und passt nicht zu ESP-NOW. ESP-NOW hybrid:
Adressierung bleibt deviceId/Topic (Hardwaretausch ohne Neu-Koppeln), aber
nicht-retained Befehle gehen unicast mit ACK.

**Umsetzung:**
- `SensActCtrl/src/remote/Discovery.{h,cpp}`: Protokoll (fixe Topics
  `sensactctrl/discover` + `/<scanner>`, `rid` gegen verspätete Antworten, eine
  Antwort pro Sensor-Kanal/Aktor wegen 250-Byte-Limit, Controller nicht
  gelistet) und `DiscoveryScanner` (thread-sicher, Anfrage geht nur aus
  `tick()` raus, 3-s-Fenster, Dedup, eigenes Gerät gefiltert, Ergebnis-TTL 30 s).
- `RemotePublisher` antwortet automatisch: Anfrage wird unter Mutex übergeben,
  `tick()` sendet nach Zufalls-Jitter (0–400 ms) ein Item pro Aufruf.
- `EspNowTransport` + neues `EspNowPeerTable.h`: Absender-MAC wird für
  abonnierte Topics gelernt; `publish(retained=false)` geht an den Sender des
  Eltern-Topics (`…/actuator/x/set` → Sender von `…/actuator/x`), LRU von max.
  16 Unicast-Peers, sonst Broadcast. Send-Callback meldet Zustellfehler in
  `lastErrorMessage()` (eigener String, den periodische Broadcasts nicht
  sofort überschreiben). Wire-Format unverändert. Nebeneffekt:
  Discovery-Antworten gehen ebenfalls unicast an den anfragenden Scanner.
- BrewControl: `RemoteDiscovery.h` (Scanner je Transport, eigene IDs wie
  `MqttService`/`EspNowPublishService`), `GET /api/remote/discover?transport=`
  im Muster von `/api/network/scan` (202 → 200, 409 wenn MQTT aus),
  `openapi.yaml` + README-Tabelle. Web: `discoverRemote()`, Liste gruppiert
  nach Gerät, gefiltert nach Sensor/Aktor, „bereits angelegt"-Markierung,
  Klick füllt Gerät/Remote-ID/Prefix/Kanal und leere lokale ID.

**Verifiziert:** `pio test -e native` alle Suites grün (neu: `test_discovery`
9, `test_espnow_peers` 5); `pio run` esp32dev, lolin_s2_mini,
lilygo_t_display_s3_amoled kompilieren; `pnpm typecheck` + `pnpm build`;
Redocly-Lint valide; Such-UI im Browser gegen `brewcontrol.local` mit
gestubbtem Endpoint (Liste, Sensor-Filter, Übernahme der Felder).
**Nicht verifiziert:** Hardware (nichts geflasht) → PLAN.md
„Hardware-Verifikation offen".

## 2026-09-16 — UI-Tar-Upload auf den 256-KB-LittleFS-Boards (esp32dev, lolin_s2_mini) gefixt

`POST /api/update/assets` schlug auf beiden LittleFS-Boards fehl, und statt der
dokumentierten `500` bekam der Client einen Connection-Reset.

**Root Cause (per Serial belegt):** `/www.new` wurde neben dem noch liegenden
`/www` entpackt. Die 256-KB-Partition fasst altes und neues Bundle aber nicht
gleichzeitig. esp32dev: 176 KB von 256 KB schon vor dem Entpacken belegt, frei
also ~86 KB gegen ~101 KB JS-Gzip. Der fehlende 500er ist ein **Crash**: Wenn
kein freier Block mehr da ist, gibt esp_littlefs keinen Fehler zurück, sondern
panict (`Guru Meditation Error: IntegerDivideByZero` in `lfs_alloc`, lfs.c:689,
Backtrace über `SdTarSink::writeCb` → `TarExtractor::feed`). Das Board bootet
mitten im Request neu. Der LOLIN zeigt dasselbe Muster (135 KB belegt, frei
~127 KB gegen ~120 KB plus Metadaten): Neustart mitten im Upload, curl
bekommt `(56)`. Den Panic-Text gibt das S2 über USB-CDC nicht mehr aus. Der
ältere Befund „Abbruch bei ~65 KB" war also dieselbe Ursache, nur knapper am
Limit.

**Entscheidung:** Drei Ansätze standen zur Wahl. Umgesetzt ist „`/www` vor dem
Entpacken leeren", ergänzt um eine eingebettete Notfall-Seite. Diff-Sync
verworfen: Vite hasht die Dateinamen, das große JS ändert sich also bei jedem
Build und muss trotzdem neben dem alten liegen. Code-Splitting verworfen: Die
Gesamtgröße bleibt gleich. Umpartitionieren geht nicht, die Firmware belegt
schon 1,65 MB des 1,86-MB-App-Slots. Das In-place-Verhalten hängt bewusst
**nicht** an `BREWCTL_USE_LITTLEFS`, sondern an einem eigenen Flag
`BREWCTL_ASSETS_IN_PLACE`. Ein künftiges Board ohne SD, aber mit größerer
Datenpartition behält den atomaren Tausch.

**Umsetzung:**
- `platformio.ini`: `-DBREWCTL_ASSETS_IN_PLACE=1` in `esp32dev` +
  `lolin_s2_mini`, mit Kommentar zur Partitionsgröße.
- `WebUI.cpp`: `kAssetTarget` (`/www` bzw. `/www.new`). Im In-place-Modus wird
  zu Beginn `/www` geleert. `/www.new` wird immer geleert, denn Reste früherer
  Versuche fressen Platz. Es gibt keinen Swap. `index.html(.gz)` wird als
  `.part` geschrieben und erst bei Erfolg umbenannt. So endet auch ein
  Verbindungsabbruch, der nie `final` erreicht, auf der Notfall-Seite statt
  in einer halben SPA.
- LittleFS-Guard: Vor jedem Archiv-Member prüft ein Wrapper um
  `SdTarSink::openCb()` den freien Platz (Größe + 1/64 + 2 Blöcke). Reicht er
  nicht, kommt `500 extract failed: not enough space (<member>, <size> bytes)`
  statt eines Panics. Dazu kommt eine knappe Serial-Zeile mit
  `LittleFS used/total` bei Start und Ende.
- `kRecoveryPageHtml` (Muster `kLockedPageHtml`): `onNotFound` liefert sie für
  Nicht-API-GETs, solange `/www/index.html(.gz)` fehlt. Die Seite bietet einen
  Tar-Upload plus ein optionales Passwort-Feld und gilt für alle Boards.
- `openapi.yaml`, `BrewControl/README.md`, `BrewControl/CLAUDE.md`
  nachgezogen. Der Punkt ist aus PLAN.md raus, der LilyGo-SD-Befund steht dort
  als eigener Punkt weiter.

**Verifiziert:** `pio test -e native` (SensActCtrl 224, Firmware 37 grün);
`pio run` für esp32dev, lolin_s2_mini, lilygo_t_display_s3_amoled; Redocly-Lint.
Hardware an **beiden** LittleFS-Boards per OTA, jeweils mit curl:
- gz-only-Tar → `200` in 2–4 s, neues Bundle wird ausgeliefert
  (esp32dev: 29 KB → 172 KB belegt).
- Erneuter Upload über bestehende UI → `200`.
- Volles Tar (522 KB) bzw. Tar mit `index.html.gz` zuerst plus 300-KB-Datei →
  `500 not enough space (…)`, kein Reboot, `GET /` liefert die Notfall-Seite.
- Per `--limit-rate` abgebrochener Upload → Notfall-Seite (esp32dev).
- Wiederherstellung per curl → UI wieder da. Die SPA lädt im Browser ohne
  Konsolenfehler. Der Upload-Flow der Notfall-Seite ist im Browser-Pane
  geprüft (Dummy-Tar → `200` → Reload).

**Nicht verifiziert:** Den Upload über die Notfall-Seite mit einem echten
UI-Tar gab es nur per curl; das Browser-Pane kann keine lokale Datei wählen.
Auf dem LilyGo (SD, ohne Flag) läuft der unveränderte Staged-Pfad, dort nicht
neu geflasht.

**Nebenbefund:** Mein PowerShell-Serial-Logger am nativen USB-CDC des S2 hat
das Board beim Schließen/Neuöffnen des Ports in den ROM-Download-Modus
geschickt (COM7, 303A:0002). Das Board war danach offline und wurde per USB
neu geflasht. Den S2-Port also nicht in einer Reopen-Schleife mit DTR-Toggle
mitschneiden.

## 2026-09-16 — UI-Tar-Upload auf dem LilyGo S3 (SD) gefixt: zu wenige offene Dateien

`POST /api/update/assets` scheiterte auf dem LilyGo sporadisch mit
`extract failed`, obwohl die SD genug Platz hat. Der native Test-Harness hatte
den Parser schon als Ursache ausgeschlossen.

**Eingrenzung am Gerät:**
- **Alte Firmware** (`02560d5-dirty`, 2,2 h Uptime, Datenlog aktiv): Das volle
  Tar (roh + gz, 522 KB) scheiterte nach 28 672 Byte der ersten Datei. Eine
  ältere Leiche `index-V1ocpu6Q.js` (225 280 Byte) lag noch in `/www/assets`.
  Das gz-only-Tar ging durch.
- **Nach OTA-Neustart:** Auf der aktuellen Firmware gingen 13 von 13 Uploads
  durch. Ein sauberer Build von `02560d5` schaffte ebenfalls 10 von 10.
  Die Änderungen aus 24b0eb7 waren also nicht der Fix, der Fehler hing am
  Laufzeitzustand.
- **Erste Hypothese:** ungeschützte SD-Lesezugriffe von ESPAsyncWebServer
  (bekannte `SdLock`-Lücke). Sie ist schwach, denn diese Lesezugriffe laufen
  im selben AsyncTCP-Task wie das Entpacken, und ein A/B-Test mit 3 Lesern
  blieb unauffällig.
- **Belastungstest mit 4 parallelen JS-Downloads:** 0 von 15 Uploads ok, alle
  mit `open failed (…)`. Das deutete auf `SD.begin()` mit dem Default
  `max_files = 5`: ESPAsyncWebServer hält jede ausgelieferte Datei für die
  ganze Übertragung offen.
- **Beleg für die Handle-Grenze:** Bei 6–8 gleichzeitigen Downloads bekamen
  einige Clients nur 2 589 Byte, also die Notfall-Seite. Das Öffnen der
  JS-Datei scheiterte, und `onNotFound` hielt die UI für fehlend.

**Root Cause:** Die Grenze von 5 gleichzeitig offenen Dateien auf der SD. Ein
Browser lädt UI-Assets bzw. Log-CSVs parallel, und das Datenlog braucht eine
weitere Datei. Liegt das Entpacken in einem solchen Moment, schlägt das
Öffnen fehl.

**Fix:** `main.cpp` mountet die SD mit `max_files = 16` (`kSdMaxOpenFiles`,
mit Kommentar). Das betrifft nur Boards mit SD. LittleFS hat eigene
Defaults und ist nicht betroffen.

**Verifiziert:** `pio test -e native` (37/37), `pio run` auf allen drei Envs.
Am LilyGo per OTA, das Datenlog vorübergehend auf 1 s gestellt:
- 4 JS-Leser + Log-CSV + Datei-Download → 12 von 12 Uploads ok (vorher 0 von 15).
- 8 JS-Leser → 8 von 8 ok.
- Tar-Upload während 8 gedrosselter Downloads → `200`, alle Downloads
  vollständig, keiner bekam die Notfall-Seite.
- UI danach aktuell. Das Log-Intervall steht wieder auf 5 s, `/stress` ist
  gelöscht.

**Nicht restlos geklärt:** Zweimal trat vor dem Fix unter Last statt
`open failed` ein `write failed` auf (einmal bei einem 50-KB-Datei-Upload,
einmal beim Tar). Mit `max_files = 16` gab es das in 20 Uploads unter
starker Last nicht mehr. Die Ursache ist unbelegt.

**Nebenbefunde:**
- Die Notfall-Seite unterscheidet nicht zwischen „fehlt" und „konnte nicht
  geöffnet werden" (neuer Punkt in PLAN.md).
- Direkt nach dem ersten OTA-Boot lieferte die SD einmal eine leere Registry
  und `/config: not a directory`. Nach einem weiteren Neustart war alles
  normal, nicht erneut aufgetreten.
- Jede Änderung einer Log-Konfiguration beginnt eine neue Log-Session. Vom
  Test liegen zwei zusätzliche archivierte Sessions auf dem Gerät, die alte
  ist erhalten.
- Das Öffnen von COM9 (USB-Serial-JTAG des S3) setzt das Board zurück.

## 2026-09-17 — Remote-Discovery + ESP-NOW-Unicast E2E am Gerät

Beide LittleFS-Boards (esp32dev = A, LOLIN S2 Mini = B) auf aktuellen
`main`-Stand geflasht und per HTTP gegeneinander getestet (Discovery über
ESP-NOW und MQTT, Remote-Item anlegen, `/set` über beide Transporte,
Verhalten bei Board-Ausfall/-Wiederkehr). Ergebnis: alle vier PLAN.md-Punkte
zu diesem Thema abgearbeitet und entfernt — Discovery findet die Items des
jeweils anderen Boards und filtert eigene korrekt heraus, `Remote`-Actuator
schaltet den echten Aktor auf dem Zielboard über beide Transporte, MQTT
(TCP-basiert) ist dabei durchgehend zuverlässig, ESP-NOW dagegen deutlich
verlustbehaftet (~1 von 8 Discovery-Scans erfolgreich trotz durchgehend
verbundener Boards) und ohne Retry-Mechanismus — das ist inhärent (einzelne
unbestätigte Pakete), aber jetzt als PLAN.md-Punkt festgehalten statt nur
vermutet. Dabei zwei weitere Befunde aufgedeckt: die ESP-NOW-Fehleranzeige
(`espnow.error`) kann nach einem erfolgreichen Write fälschlich auf
„fehlgeschlagen" hängen bleiben (Single-Slot-Overwrite eines älteren
Fehler-Reports, in PLAN.md dokumentiert), und das Öffnen des COM-Ports
resettet auch das esp32dev-Board (nicht nur den LilyGo S3 wie bisher
bekannt) — deshalb während des Tests komplett auf Serial-Zugriff verzichtet
und rein über HTTP verifiziert.

**Nachtrag — ESP-NOW-Discovery-Verlustrate behoben:** Root Cause für die
oben beschriebene ~1-von-8-Trefferquote gefunden: `WiFi.setSleep(false)`
fehlte nach dem STA-Connect. Ohne das aktiviert der ESP32 Modem-Sleep, sobald
die STA-Verbindung steht — der Funk döst zwischen den AP-Beacons, und
ESP-NOW-Pakete, die währenddessen eintreffen, gehen komplett verloren (kein
gelegentliches RF-Rauschen, sondern ein systematischer Effekt). Fix:
`WiFi.setSleep(false)` in `main.cpp` direkt nach dem WLAN-Connect, vor der
ESP-NOW-Initialisierung. Nach Reflash beider Boards: 7 von 10
Discovery-Versuchen erfolgreich (davor 1 von 8–10), ab dem vierten Versuch
durchgehend 7/7 — deutliche, reproduzierbare Verbesserung. Aktor-Write über
den Remote-Pfad weiterhin bestätigt funktionsfähig. Der Fehleranzeige-Bug
bleibt als eigener PLAN.md-Punkt offen (unabhängig von der Sleep-Ursache).

**Nebenbefund beim Reflash:** Nach dem zweiten Flash-Vorgang (mit dem
Sleep-Fix) blieb das esp32dev-Board kurzzeitig unerreichbar — weder WLAN
noch lesbarer Serial-Output (nur Rauschen). Ein manueller Power-Cycle durch
den Nutzer hat es zuverlässig zurückgeholt; Ursache nicht geklärt (möglich:
unsauberer BOOT-Button-Übergang beim vorherigen Upload-Versuch hat einen
inkonsistenten Flash-Zustand hinterlassen, der erst nach Reflash + kompletter
Power-Cycle sauber gebootet hat). Bei ähnlichem Verhalten künftig zuerst
Power-Cycle statt weiterer Serial-Diagnose versuchen.

Testkonfiguration (Sensoren/Aktoren/Transport-Settings) danach von beiden
Boards wieder entfernt.

## 2026-09-17 — Fix: ESP-NOW-Fehleranzeige blieb nach erfolgreicher Zustellung hängen

**Root Cause:** `EspNowTransport::onSendStatus()` (WiFi-Task) hat jeden
Zustellstatus nur in einem einzelnen Atomic (`deliveryReport_`) abgelegt;
`tick()` (loop-Task) hat davon nur den *zuletzt* eingetroffenen Report
gelesen und dabei alle dazwischen eingetroffenen überschrieben. Trafen
zwischen zwei `tick()`-Aufrufen ein Erfolg und danach noch ein älterer
Fehler-Callback eines parallel unterwegs gewesenen Pakets ein, gewann der
Fehler und blieb stehen — auch wenn der eigentliche Schreibvorgang
nachweislich angekommen war.

**Fix:** `deliveryErrorMsg_` wird jetzt direkt im Send-Callback
gesetzt/gecleart (mutex-geschützt), nicht mehr über `tick()` gepuffert —
jedes Ereignis wird einzeln und in der Reihenfolge verarbeitet, in der es
eintrifft. `EspNowTransport.h/.cpp` (SensActCtrl), kein API-Vertrag
betroffen.

**Verifiziert:** `pio test -e native` (224/224), `pio run` auf allen drei
Firmware-Envs. Am Gerät (esp32dev = A, LOLIN S2 Mini = B, echter
Power-Cycle von A statt nur ESP-NOW-Toggle, weil der Transport laut Design
auch bei `espnow.enabled=false` weiterläuft): Write bei abgestecktem A →
Fehleranzeige erscheint korrekt; A wieder angesteckt, Write erneut
erfolgreich → Fehleranzeige cleart sofort, kein Hängenbleiben mehr.
PLAN.md-Punkt entfernt.

## 2026-09-17 — Add-Item-Dialog: Discovery herausgelöst + 2-Step-Dialog

**Problem:** `AddItemModal.tsx` (1782 Z., ~70 `useState`, 16 nebeneinander
liegende `role && type`-Guards) war unübersichtlich, und Discovery lag
darin begraben: Remote-Discovery erschien erst nach Rolle → Typ `Remote` →
Transport `mqtt|espnow` — man musste also schon wissen, was man sucht,
bevor man suchen durfte.

**Umsetzung (reiner Layout-/Navigations-Umbau, Feldblöcke und
`handleSubmit` unverändert):**

- Zwei neue Aktions-Karten über der Geräteliste, jeweils nach dem Vorbild
  der WLAN-Suche in `NetworkPage` (Button im `control`-Slot von
  `SettingsCard`): „Geräte suchen“ (`DiscoverDevicesCard`) und „Gerät
  hinzufügen“ (drei Zeilen direkt in `DevicesPage`). Damit entfallen die
  Header-Buttons und der `SpeedDialFab` auf dieser Seite — die Aktionen
  stehen jetzt auf jeder Breite im Seitenfluss. Die Treffer klappen **in
  der Such-Karte selbst** auf statt in einem Dialog; gesucht werden **alle
  Quellen parallel**: `discoverRemote('mqtt')` + `discoverRemote('espnow')` +
  OneWire-Scan über alle bereits konfigurierten DS18B20-Pins (letztere
  sequenziell, weil `/api/bus/scan` synchron im AsyncTCP-Handler läuft).
  Jede Quelle rendert, sobald sie fertig ist; nicht verfügbare Transporte
  (409) werden still übersprungen, alles andere wird eine Notiz. Treffer
  sind nach Quelle gruppiert, Bekanntes ist „bereits angelegt“ markiert.
- Klick auf einen Treffer öffnet den Anlege-Dialog **vorausgefüllt**
  (neue Prop `prefill?: ItemPrefill`). Der Hydrations-Effect keyt weiter
  auf `[open]` — `prefill` gehört bewusst *nicht* in die Deps, sonst würde
  jeder SSE-Tick eine halb getippte Eingabe wegwischen; Vertrag: im selben
  Handler setzen, der den Dialog öffnet, in `onClose` wieder `null`.
- `AddItemModal` ist jetzt zweistufig: Schritt 1 ist der neue
  `ItemTypePicker` (Rolle über das gemeinsame `Segmented`, darunter der
  gruppierte Typ-Katalog aus dem neuen `itemTypes.ts` mit je einer
  Erklärzeile) statt der drei `<select><optgroup>`-Dropdowns; Schritt 2
  zeigt nur noch ID + die Felder dieses einen Typs. Edit öffnet direkt in
  Schritt 2 (die beiden `disabled`-Selects entfallen); die neue Unterzeile
  `Rolle · Typ` trägt die Information, die vorher nur im Select stand.
- Der DS18B20-Inline-Scan bleibt im Formular — er ist ein Feld-Helfer für
  einen manuell eingetippten Pin, keine Geräte-Suche.

Netto −150/+30 Zeilen in `AddItemModal.tsx`, ohne Churn in den
per-Typ-Feldblöcken. Keine Firmware-/Routen-Änderung, `openapi.yaml`
unberührt.

**Verifiziert:** `pnpm typecheck` + `pnpm build` grün. Gegen esp32dev live
durchgeklickt: Schritt 1/2 inkl. Zurück und Rollenwechsel, Edit eines
PID-Reglers (kein Zurück-Chevron, AutoTune intakt), verschachteltes
Öffnen aus „Dashboard-Inhalte“ (startet in Schritt 1), Suche findet alle
drei Quellen — OneWire GPIO 2 (`28:ff:19:…`, „bereits angelegt“),
`MQTT · brewcontrol-esp32dev` (Sensor) und `ESP-NOW · brewcontrol-lolin`
(Aktor `IDS1`) —, alle Prefill-Pfade inkl. sichtbar vorausgewählter
Bus-Adresse und automatisch auf „Aktor“ gewechselter Rolle, DS18B20
end-to-end angelegt und wieder gelöscht, kein Prefill-Leak beim nächsten
„+ Hinzufügen“, beide Karten bei 375×812. Keine Konsolenfehler.

**Nebenbefund:** ein Zwischenstand hatte beide Buttons in *einer* Karte —
zwei Buttons im `control`-Slot von `SettingsCard` sind `shrink-0`, während
der Textblock `flex-1 min-w-0` ist, also zerquetschen sie auf einem
375-px-Display den Titel auf wenige Zeichen pro Zeile. Eine Karte pro
Aktion umgeht das; wer je zwei Buttons in einen `control`-Slot legt,
läuft wieder hinein.

## 2026-09-17 — Dashboard-Inhalte-Dialog: Auswahlliste statt Checkbox-Wüste

`DashboardContentModal` bestand aus sechs `fieldset`-Blöcken mit nativen
Checkboxen im Flow-Umbruch: ~14 px Trefferfläche (schlecht am Tablet),
keine Hierarchie zwischen Gruppen und Inhalten, nur rohe IDs ohne Kontext,
kein Hinweis wie viel ausgewählt ist, und die drei
„+ Neues … erstellen“-Links sahen in `text-faint` wie deaktivierter Text
aus.

Ersetzt durch eine WinUI-ListView-artige Auswahlliste:

- Jeder Eintrag ist eine vollbreite Zeile (Rollen-Icon | Name | Detail |
  Checkbox, ~44 px hoch, ganze Zeile klickbar), ausgewählte Zeilen mit
  `bg-accent/10` + Accent-Icon.
- Die Detailspalte zeigt Live-Kontext aus dem Snapshot: Sensor-Messwert
  bzw. „n Kanäle“ bei Multi-Channel-IDs, An/Aus bei binären Aktoren,
  Sollwert beim Regler, Serien-/Schrittzahl bei Chart und Programm,
  Dauer beim Timer.
- Gruppenköpfe kleben beim Scrollen (`sticky top-0 bg-surface`) und
  tragen einen `n/m`-Zähler; im Kopf steht „x von y ausgewählt“.
- Suchfeld erst ab mehr als 8 Einträgen (`SEARCH_THRESHOLD`) — filtert
  über die Labels, leere Gruppen fallen weg, sonst „Keine Treffer“.
- Die Erstellen-Aktionen sind normale Zeilen mit Plus-Icon und stehen am
  Ende **ihrer** Gruppe („Neuer Sensor“ unter Sensoren usw.) statt als
  blasser Link-Block am Listenende. Charts haben keine — ein Chart wird
  auf seiner eigenen Seite angelegt. Eine leere Gruppe bleibt sichtbar,
  solange sie von hier aus befüllt werden kann, damit der erste Sensor
  eines frischen Geräts einen Klick entfernt ist. Während einer Suche
  sind die Zeilen ausgeblendet (kein Suchtreffer).

Dafür bekam `AddItemModal` eine optionale Prop `initialRole`: der
Typ-Picker startet auf der Rolle der angeklickten Gruppe, sein
Segmented-Control schaltet weiterhin frei um. Zwei Zeilen dort, sonst
keine Änderung an dem Dialog.

**Verifiziert:** `pnpm typecheck` grün. Live gegen `brewcontrol.local`
(LilyGo, 12 Einträge) durchgeklickt: Zeilenklick schaltet um und
aktualisiert Kopf- und Gruppenzähler, Suche „ma“ filtert auf Regler/
Charts/Programme, Scrollen mit klebenden Köpfen, Light- und Dark-Theme,
375x812. „Neuer Regler“ öffnet den Typ-Picker auf Regler, „Neuer Sensor“
auf Sensor (Rolle wechselt pro Klick, kein Hängenbleiben).
Abschließend mit „Abbrechen“ verlassen — keine Config auf dem Gerät
verändert. Keine Konsolenfehler.
---

## 2026-09-18 — WebSocket-Autodiscovery per mDNS + Kopplung durch Rückruf

**Ausgangslage:** Eine WebSocket-Remote-Verbindung musste an zwei Stellen von
Hand eingerichtet werden — die Hub-URL auf dem Sensor-Board, das Remote-Item auf
dem Gerät mit der UI. Eine wechselnde DHCP-IP brach sie.

**Verworfene Alternative — Rollentausch.** Naheliegend war, die Topologie
umzudrehen (Datenbesitzer = Server, Konsument = Client pro Peer). Die Library
könnte das sofort: `WebSocketTransport.h:23-25` hält ausdrücklich fest, dass die
Rollen nur bestimmen, *wer* verbindet, und die Retain-Emulation läuft
symmetrisch. Dagegen sprach der blockierende Connect: `WebSocketsClient::loop()`
verbindet synchron (bis `WEBSOCKETS_TCP_TIMEOUT`, hier 1 s) und wiederholt das
alle 5 s je unerreichbarem Peer — beim Rollentausch zahlt das genau das Board
mit dem Regler. Begrenzbar wäre es (Round-Robin über getrennte Peers), aber
belegen ließe sich das erst am Gerät.

**Umsetzung — Rückruf.** Die Topologie bleibt, wie sie ist; nur die
*Konfiguration* wandert auf das Gerät mit der UI:

1. **Jedes Board kündigt sich an.** `startMDNS()` in `main.cpp` inseriert
   zusätzlich `_sensactctrl._tcp` auf Port 80 — dem Port der HTTP-API, die jedes
   Board tatsächlich bedient — mit TXT `dev`, `prefix`, `ver` und `ws`
   (eigener Hub-Port, `0` = kein Hub). Der initiale `startMDNS()`-Aufruf
   wanderte dafür hinter `settingsStore.loadFromSD()`, weil die TXT-Records aus
   den Settings kommen; der Re-Announce bei `STA_GOT_IP` blieb unverändert.
2. **`MdnsBrowser`** (neu, `MdnsBrowser.h/.cpp`) durchsucht das LAN. Gleiche
   Zustandsmaschine wie `SensActCtrl::DiscoveryScanner` (3-s-Fenster, 30-s-TTL,
   `requestScan()`/`takeResults()` unter Mutex), damit der HTTP-Handler nur
   armen und abholen kann und die Query aus `loop()` läuft. Bewusst die
   asynchrone IDF-API (`mdns_query_async_new` + `mdns_query_async_get_results`
   mit Timeout 0), **nicht** `MDNS.queryService()` — das blockiert das ganze
   Suchfenster.
3. **`GET /api/remote/peers`** liefert die Boards im 202-Poll-Muster der
   übrigen Scans. Ob ein Board schon benutzt wird, berechnet das Frontend aus
   `GET /api/config`, das es für den Scan ohnehin lädt — dafür braucht die
   Firmware nichts zu wissen.
4. **`POST /api/remote/pair`** schickt dem Ziel-Board dessen eigene
   `POST /api/settings` mit `websocket.publishEnabled` + `hubUrl`. Kein neuer
   Endpoint auf der Empfängerseite: Validierung, Persistenz und Reboot sind
   dort schon implementiert. Der Aufruf läuft über `HTTPClient` aus
   `WebUI::tick()`, nicht aus dem Handler — der async_tcp-Task bedient jeden
   Request und den SSE-Stream, der darf für einen Netz-Roundtrip nicht stehen.
   Deshalb antwortet die Route `202` und `GET /api/remote/pair` liefert das
   Ergebnis (`200` gekoppelt, `401` Passwort nötig, `502` nicht erreichbar,
   `409` ohne eigenen Hub). Passwortgeschützte Ziele werden vorher über
   `/api/auth/login` angemeldet und das `bcsid`-Cookie mitgeschickt.
   Timeout 2 s, weil jede Sekunde davon eine Sekunde ohne Sensor-Tick ist.
5. **Item-Suche für WebSocket** ist damit die triviale Verdrahtung, die in
   PLAN.md stand: ein dritter `DiscoveryScanner` in `RemoteDiscovery` über
   `webSocketService.hubTransport()`, plus `websocket` im Transport-Enum von
   `/api/remote/discover`.

**Frontend:** `DiscoverDevicesCard` hat jetzt zwei Stufen — die Gruppe „Boards
im Netz" (Koppeln-Button, „dieses Gerät" beim eigenen Board, „gekoppelt" wenn
schon ein Item darauf zeigt, Passwortfeld erst wenn das Ziel `401` antwortet)
und darunter wie bisher die gefundenen Items, nun auch aus dem
WebSocket-Transport. `ItemPrefill.transport` kennt `websocket`; im
`AddItemModal` brauchte es kein neues Feld, weil der Hub geräteweit ist. Die
Hub-URL bleibt auf der WebSocket-Seite als Fallback stehen, mit einem Hinweis,
dass normalerweise vom Hub aus gekoppelt wird.

**Zwei Dinge fielen beim Selbst-Review auf und wurden gleich mit erledigt:**

- Die Pairing-Felder in `WebUI` werden vom async_tcp-Task gelesen und von
  loopTask geschrieben. Bei `int`/`bool` wäre das wie bei `rebootAtMs_`
  tolerierbar, bei `String` nicht: eine Zuweisung gibt den alten Puffer frei und
  kann dem Leser einen Dangling-Pointer hinterlassen — genau der Grund, warum
  `WebSocketTransport::lastError_` ein nacktes Literal ist. Jetzt unter
  `pairMutex_`, mit zwei Flags (`pairArmed_` = wartet auf tick(), `pairBusy_` =
  armiert oder unterwegs) und **ohne** gehaltene Sperre während des
  HTTP-Roundtrips, damit der GET-Poll nicht 2 s blockiert.
- `startMDNS()` läuft auf dem WiFi-Event-Task und ruft `MDNS.end()`; `mdns_free()`
  gibt dabei auch ein offenes Such-Objekt frei. Ein WLAN-Reconnect mitten im
  3-s-Scan wäre ein Use-after-free gewesen. `MdnsBrowser::abandonSearch()` wird
  jetzt vor `MDNS.end()` gerufen, `tick()` lässt den Zeiger daraufhin fallen
  (ohne `delete`) und fällt auf Idle zurück — der nächste Poll startet einfach
  neu.

**Keine Library-Änderung** — SensActCtrl blieb unangetastet.

**Verifiziert:** `pio test -e native` 224/224 grün (Regression),
`pio run` baut alle drei Envs (esp32dev 88.1 % Flash, lolin_s2_mini 84.9 %,
lilygo_t_display_s3_amoled 24.4 %),
`pnpm typecheck` + `pnpm build` grün, `redocly lint` sauber (nur die
vorbestehende `info-license`-Warnung). Der ganze UI-Ablauf gegen einen
HTTP-Mock im Scratchpad durchgespielt: Scan listet drei Boards (eigenes als
„dieses Gerät"), Koppeln setzt die Zeile auf „gekoppelt" und meldet „Board
gekoppelt, es startet jetzt neu", das geschützte Board antwortet `401` →
Passwortfeld → Erfolg, danach erscheint die Gruppe „WebSocket · kessel2" mit
ihren Items, und ein Klick darauf öffnet den Dialog mit `device=kessel2`,
`remote_id=kessel_temp`, Prefix und Transport-Schalter auf WebSocket.
MQTT/ESP-NOW-`409` werden weiterhin still übersprungen.

**Offen (in PLAN.md):** die Hardware-Verifikation am echten Board — insbesondere
ob `.local` in der gespeicherten `hubUrl` auflöst
(`CONFIG_LWIP_DNS_SUPPORT_MDNS_QUERIES=y` ist bisher nur aus der
Framework-Config belegt, nicht am Gerät). Neu notiert wurden außerdem der
`/set`-Broadcast im Hub (Unicast wäre ~15 Zeilen in der Library) und
„zuletzt gesehen" pro Remote-Item als Ersatz für den fehlenden Peer-Status.
---

## 2026-09-18 — mDNS-Kopplung E2E am Gerät + `self` entfernt

Hardware-Runde zur Autodiscovery (Eintrag oben), esp32dev als Hub/Master
(192.168.178.74), LOLIN S2 Mini als Leaf (192.168.178.82), LilyGo bewusst nur
als Zuschauer in der Suche. Alles über HTTP, kein Serial (Port-Open resettet
beide Boards, PLAN.md).

**Durchgelaufen:**

- Neue Firmware auf allen drei Boards, alle antworten auf `/api/remote/peers`.
- `409 websocket hub not enabled` ohne eigenen Hub, `400 missing host` ohne
  `host`.
- mDNS-Suche von allen drei Boards: jedes findet die beiden anderen, TXT `dev`
  und `prefix` korrekt. `ws` stimmt ebenfalls — nachdem A den Hub bekam, meldet
  die Suche von B aus `ws_port: 8081` für A und `0` für den LilyGo, auch nach
  A's Reboot (der Re-Announce bei `STA_GOT_IP` greift).
- Kopplung: `202` → `code 200`. B hat danach
  `hubUrl: ws://brewcontrol-esp32dev.local:8081` gespeichert und ist
  `connected=True`. **Damit ist die offene Frage beantwortet: `.local` löst am
  Gerät auf** (`CONFIG_LWIP_DNS_SUPPORT_MDNS_QUERIES=y` war bisher nur aus der
  Framework-Config belegt). A meldet stabil `hubClients=1`.
- Item-Suche `?transport=websocket` findet B's Items. Ein auf B **neu**
  angelegter Sensor (`DigitalInput` GPIO 3, Pullup — als Testsensor ohne
  Hardware) erscheint dabei ohne Reboot, die Live-Hooks des `RemotePublisher`
  greifen also auch hier.
- Remote-Sensor auf A: `v=1 ok=True`, Zeitstempel laufen im 2-s-Takt.
- `/set` von A auf B's Aktor `IDS1`: 0.1 kam innerhalb einer Sekunde an
  (`v=target=0.1`), danach sauber zurück auf 0.
- `401`-Pfad mit echtem Zugriffsschutz: Passwort auf B gesetzt → Kopplung ohne
  Passwort liefert `code 401` „Board … ist passwortgeschützt", mit Passwort
  `code 200` (der Login-plus-Cookie-Weg trägt also am Gerät). Passwort danach
  wieder entfernt.
- `502` bei unerreichbarem Board nach ~2 s (`kPairTimeoutMs`).
- **Die Auslagerung aus dem Handler ist belegt:** während loopTask 2 s im
  blockierenden Connect hing, hat `GET /api/remote/pair` weiter geantwortet und
  `state: running` geliefert.
- Reboot B: Reconnect von selbst nach ~4–6 s. Reboot A: das Remote-Item kommt
  aus `registry.json` zurück und B verbindet sich ohne erneutes Koppeln.
- A bleibt flüssig: Snapshot-Latenz 22–46 ms (zwei Ausreißer ~320 ms), keine
  Stalls in Sekunden-Größe — erwartungsgemäß, weil A in dieser Topologie nie
  selbst wählt.
- `hubClients` stand direkt nach B's Reboot kurz auf `2` (der alte Socket war
  noch gezählt) und fiel dann auf `1` — der Heartbeat räumt auf, kein Leck von
  Client-Slots (relevant, weil `WEBSOCKETS_SERVER_CLIENT_MAX` = 5 ist).

**Fund: `self` war toter Code.** Kein Board listet sich selbst — der
ESP32-mDNS-Responder beantwortet eigene Queries nicht, auf allen drei Boards
bestätigt. Das Feld war damit immer `false`, die „dieses Gerät"-Zeile in der UI
unerreichbar und die Aussage in `openapi.yaml`/`README.md` („This device is
reported too, marked `self`") falsch. Entfernt: `DiscoveredPeer::self` samt
`MdnsBrowser::begin()`/`ownHostname_` (die nur dafür existierten), das Feld in
der `/api/remote/peers`-Response, in `types.ts` und der UI-Zweig. Doku
korrigiert, dazu je ein Kommentar in `MdnsBrowser.h`, `WebUI.cpp` und
`types.ts`, damit das Feld nicht wieder eingebaut wird.

**Nebenbei bestätigt:** der Messwert auf A wurde beim Ausfall von B *nicht* als
veraltet markiert — der Backlog-Punkt „zuletzt gesehen pro Remote-Item" ist real
und nicht bloß theoretisch.

**Verifiziert:** `pio run -e esp32dev` und `-e lolin_s2_mini` bauen nach dem
Aufräumen weiter, `pnpm typecheck` + `build` grün, `redocly lint` sauber.

**Zustand der Testboards danach** (bewusst so gelassen): esp32dev ist Hub, sein
alter `publishEnabled` auf den LilyGo ist aus; S2 Mini ist an ihn gekoppelt und
hat den Testsensor `wstest`; esp32dev hat die Remote-Items `lolin_wstest` und
`lolin_ids1`.

## 2026-09-18 — Captive-Portal-UX angeglichen + Reload-mit-Retry in Preact übernommen

Zwei getrennte, aber verwandte Änderungen: (1) Captive Portal
(`WiFiSetupPortal.cpp`) und die Preact-Netzwerk-Settings-Seite
(`NetworkPage.tsx`) machten denselben WiFi-Connect-Flow mit unterschiedlicher
UX — echtes Code-Sharing würde bedeuten, dass der Portal-Server die gebaute
SPA aus dem (zum Portal-Zeitpunkt bereits gemounteten) Filesystem ausliefert;
bewusst verworfen (größerer Umbau, Risiko in restriktiven Captive-Portal-
WebViews, zusätzlicher Flash-Bedarf auf der knappen 256-KB-LittleFS-Partition).
Stattdessen die Netzwerkliste im Captive Portal von Hand an NetworkPage
angeglichen: Listen-Darstellung mit Signalbalken statt `<select>` (gleiche
RSSI-Bucket-Schwellen: ≥-55/-65/-75/-85 dBm → 4/3/2/1/0 Balken), Dedupe nach
SSID (stärkster Treffer gewinnt) + Sortierung nach Signal, "Enter network
manually"-Fallback — alles weiterhin reines Vanilla-JS/Inline-CSS ohne
Build-Schritt, nur `kSetupHtml` in `WiFiSetupPortal.cpp` geändert, Server-
Handler unangetastet.

(2) Die Reload-mit-Retry-Anzeige des Captive Portals (`afterSaved()`:
Countdown, periodischer `fetch(url,{mode:'no-cors'})`-Probe, Auto-Redirect
beim ersten Erfolg, garantierter Fallback-Link) als `ReloadRetry`-Komponente
nach Preact übernommen (`web/src/components/ReloadRetry.tsx`) und an die
Stelle der bisherigen statischen "Gerät startet neu…"-Blöcke gesetzt:
`NetworkPage.tsx` (WLAN-Wechsel/Hostname-Wechsel mit `{host}.local`-Ziel,
WLAN-Reset bewusst ohne Ziel — Board wird zum AP, nicht mehr über die
aktuelle Verbindung erreichbar), `EspNowPage.tsx`, `MqttPage.tsx`,
`WebhookPage.tsx`, `WebSocketPage.tsx`, `BackupPage.tsx` sowie neu
`FirmwarePage.tsx` (hatte bisher nach Update-Install gar keine Neustart-
Anzeige). Bei Ziel-Origin gleich der aktuellen Seite lädt `ReloadRetry` per
`location.reload()` (Pfad bleibt erhalten), bei Hostname-Wechsel per
`location.href` auf die neue `.local`-Adresse.

**Verifiziert:** `pio run -e esp32dev` kompiliert (Flash 88.3 %, RAM 18.2 %),
`pnpm typecheck` grün, alle geänderten Preact-Seiten im Dev-Server gegen ein
echtes Testboard ohne Konsolenfehler geladen (Netzwerk-, MQTT-, Backup- und
Firmware-Seite) — reboot-auslösende Aktionen dabei bewusst nicht angeklickt,
um das laufende physische Gerät nicht neu zu starten. Der tatsächliche
Auto-Reconnect-Erfolgsfall (Board antwortet nach echtem Reboot wieder) ist
damit nicht E2E getestet, die Logik ist aber ein direkter Port der bereits
produktiv laufenden Captive-Portal-Implementierung.

## 2026-09-18 — Fix: manueller Firmware-/UI-Upload zeigte weder Erfolg noch Fehler an

Nutzer-Nachfrage, ob das manuelle Hochladen des UI-Pakets einen Neustart
braucht, deckte einen Bug in `FirmwarePage.tsx` auf: der `.catch()`-Handler
beider Uploads (`Firmware (.bin)`/`UI-Paket (.tar)`) setzte den Fortschritt
bei einem Fehler auf `null` — der Ladebalken verschwand dabei kommentarlos,
ohne jede Fehlermeldung. Bei Erfolg blieb er dauerhaft bei „100%" hängen,
ebenfalls ohne Bestätigung. Laut `docs/openapi.yaml` reboottet nur der
Firmware-Upload (`POST /api/update/firmware`, ~500 ms nach der Antwort);
der UI-Paket-Upload (`POST /api/update/assets`) explizit **nicht** — der
Swap auf `/www` passiert im nächsten Main-Loop-Tick.

Fix: Firmware-Upload-Erfolg nutzt jetzt denselben `rebooting`-State/
`ReloadRetry` wie der GitHub-Install-Flow (Polling wird vorher gestoppt).
UI-Paket-Upload zeigt bei Erfolg eine grüne "UI-Paket installiert."-Zeile
(kein Reboot). Beide zeigen bei Fehler jetzt den tatsächlichen Server-Text
(z. B. `Bad Size` bzw. `extract failed: …`) statt stillschweigend zu
verschwinden.

**Verifiziert:** `pnpm typecheck` grün, Seite im Dev-Server gegen das
Testboard ohne Konsolenfehler geladen. Kein echter Upload getestet — Risiko,
über den echten Firmware-/Asset-Update-Endpoint des laufenden Geräts eine
kaputte Datei zu flashen.

## 2026-09-19 — Dashboard: Elemente per Drag & Drop anordnen

Die Dashboard-Anordnung war fest verdrahtet (Programm-Spalte, Chart-Bereich,
Karten-Grid in fester Reihenfolge). Jetzt liegt sie als Baum von Bereichen im
Dashboard selbst und ist im Bearbeiten-Modus per Drag & Drop veränderbar —
Vorbild war ein Docking-System im IDE-Stil (Nutzer-Referenz: Video zu
„Dynamix Layout").

**Entscheidungen (mit dem Nutzer geklärt):** Docking-Bereiche mit ziehbaren
Trennern statt eines festen Rasters; beliebig viele Kartengruppen, eine Karte
darf auch allein einen Bereich belegen; Speicherung am Gerät pro Dashboard; die
automatische Kopplung „erster Regler eines Programms steht über dem
Programm-Widget" entfällt ersatzlos (der Regler ist jetzt frei platzierbar); ein
Mehrkanal-Sensor bleibt eine Einheit (Ref über die Base-Id, Kanal-Cards
untereinander). Anordnen und Trenner nur im Bearbeiten-Modus; mobil (<1024 px)
wird der Baum in Lesereihenfolge linearisiert und ist dort nicht editierbar.

**Keine neue Dependency.** `dockview-core` (+85 KB gz) hätte das Bundle fast
verdoppelt, `@dynamix-layout/core` (7,5 KB gz) rechnet nur Geometrie, ist
Tab-zentriert und dokumentiert keinen Touch-Support. Die eigene Umsetzung kostet
**+3,9 KB gz** (JS 105,20 → 109,07 KB, gegen denselben Commit gemessen).

**Datenmodell:** `LayoutNode` = `{split:'row'|'col', sizes, children}` oder
`{items:[ref]}`; Refs tragen einen Typ-Präfix (`sensor/<baseId>`, `actuator/`,
`controller/`, `chart/`, `program/`, `timer/`), weil Charts, Programme und Timer
eigene Id-Räume haben. Ein Ref allein im Blatt füllt seinen Bereich (Chart und
Programm mit `fill`), mehrere fließen als Karten-Raster, in dem Chart und
Programm die ganze Zeile nehmen.

**`web/src/dashboardLayout.ts` (neu, reine Funktionen):** `memberRefs`,
`defaultLayout` (bildet die bisherige Anordnung nach, damit bestehende
Dashboards unverändert aussehen), `reconcile`, `normalize`, `moveRef`,
`resizeSplit`, `renameRef`, `linearize`. `moveRef` markiert die gezogene Ref
zuerst mit einem Platzhalter gleicher Länge, fügt dann am Ziel ein und entfernt
den Platzhalter erst danach — so bleiben Zielpfad und Einfüge-Index gültig,
unabhängig davon, woher die Karte kommt. `reconcile` läuft bei jedem Render:
tote Refs raus, neue kleine Karten an die letzte Kartengruppe, neue Charts und
Programme in einen eigenen Bereich, kaputtes JSON → Default-Anordnung.

**`web/src/components/DashboardLayout.tsx` (neu):** rekursives Flex-Rendering,
Trenner mit Pointer-Capture (Live-Entwurf im lokalen State, Commit erst bei
`pointerup`), Drag am Griff über der Karte (ab 4 px Bewegung), Hit-Test über die
Rects der `data-path`-Elemente, Overlay für Zielbereich und Einfüge-Marke,
Abbruch per Escape. Die Container tragen bewusst kein `transform`/`filter`:
`ConfirmModal` und die übrigen Dialoge rendern `fixed` ohne Portal und würden
sonst am Bereich statt am Fenster ausgerichtet (am laufenden UI gegengeprüft).
Die Render-Helfer sind einfache Funktionen statt verschachtelter Komponenten —
als Komponenten hätten sie bei jedem Snapshot (1 Hz) eine neue Identität und den
uPlot-Chart sekündlich neu aufgebaut.

**Firmware:** `DashboardStore::DashboardCfg` bekommt ein `JsonDocument layout`,
das die Firmware nur durchreicht (laden, serialisieren, in `fillFromJson`
ersetzen); fehlt der Schlüssel im Body, wird die Anordnung gelöscht — dieselbe
Replace-Semantik wie bei allen Listen. Damit das Frontend nie versehentlich ein
Feld verliert, schickt `Dashboard.tsx` jedes Update über ein neues `dashBody()`,
das immer den vollständigen Datensatz sendet (die Feldliste war seit den
Darstellungsmodi ohnehin an zwei Stellen dupliziert). `GET /api/backup` nutzt
`store_.serialize()`, das Layout ist damit automatisch im Backup;
`docs/openapi.yaml` kennt jetzt `DashboardLayoutNode`.

**Verifikation:** 22 Checks der reinen Layout-Funktionen per Wegwerf-Skript
(u.a. Verschieben in dieselbe Gruppe, letztes Item verlässt einen Bereich,
Kanten-Andocken im gleichgerichteten Split, kaputtes JSON, keine Duplikate);
`pnpm typecheck` grün; `pio run -e esp32dev` grün; Redocly valide (nur die
bekannte `license`-Warnung). Im Browser gegen einen lokalen Mock-Server geprüft
(das Testboard läuft noch ohne das Feld, und ein Schreibzugriff auf die echte
Gerätekonfiguration wäre für einen UI-Test zu invasiv): Default-Anordnung
identisch zur bisherigen, Andocken an eine Kante, Einsortieren an eine bestimmte
Position einer Gruppe, Trenner ziehen (Chart skaliert per ResizeObserver mit),
Persistenz über Reload, **genau ein POST pro Aktion**, ConfirmModal zentriert
über der ganzen Seite, Dashboard mit toter Chart-Referenz ohne leeren Bereich,
Entfernen klappt den Bereich zu, mobile Linearisierung inklusive
Programm-Bottom-Sheet.

**Unterwegs gefixt:** Die Andock-Zone war als 25 % der Bereichsgröße definiert —
bei 990 px Breite ein 247-px-Band, das die linke Hälfte der ersten Karte
verschluckte und die erste Position einer Gruppe unerreichbar machte. Jetzt
höchstens 64 px (und weiterhin maximal ein Viertel, damit kleine Bereiche eine
Mitte behalten).

**Bewusst so:** Das Entfernen einer Karte filtert deren Ref nur beim Rendern
heraus, die gespeicherte Anordnung behält sie bis zum nächsten Anordnen. Eine
später wieder hinzugefügte Karte landet dadurch an ihrem alten Platz (am UI
beobachtet und so belassen — Positionsgedächtnis ist hier das nützlichere
Verhalten); wirklich neue Karten hängen sich an die letzte Kartengruppe.

**Offen:** Der Escape-Abbruch ließ sich nicht automatisiert prüfen (die
Browser-Automatisierung kann keinen gedrückten Mausknopf halten). Die Persistenz
am echten Gerät steht bis zum nächsten Flash aus, siehe PLAN.md.

## 2026-09-19 — Dashboard-Layout: Kartenbereiche wachsen nicht mehr ins Leere

Nutzer-Feedback zum frisch gebauten Drag-&-Drop-Layout: die Ansicht im
Bearbeiten-Modus deckt sich nicht mit der danach. Ein Bereich, den man im
Bearbeiten-Modus so weit zusammenzieht, dass eine Scrollbar erscheint, ist
nach „Fertig“ zu groß für seine zwei Karten.

**Gemessen** (Maischen-Tab, 1600x1000): Layout-Gesamthöhe 851 px normal
gegen 801 px im Bearbeiten-Modus — das eingeblendete Hinweisfeld unter den
Tabs kostet 50 px. Dazu pro Bereich im Bearbeiten-Modus 2 px Rahmen +
16 px `p-2`, also 18 px weniger Inhaltshöhe. Da `sizes` reine Anteile sind
(Summe 1), skaliert derselbe Anteil auf zwei verschiedene Gesamthöhen —
der Inhalt darin aber nicht.

**Eigentliche Ursache** (Nutzer-Beobachtung, bestätigt): `fill` wird nur
von `ChartRow` und `ProgramCard` ausgewertet. Sensor-, Aktor-, Regler- und
Timer-Karten ignorieren es und behalten ihre `widgetSizeClass`-Höhe. Ein
Bereich aus reinen Karten kann zusätzliche Höhe also gar nicht nutzen —
sie wird immer zu Luft unter der letzten Karte.

Umsetzung:

- Neues `isRigid(node)` in `dashboardLayout.ts`: ein Teilbaum ist starr,
  wenn er nur Karten-Refs enthält (leerer Bereich zählt als flexibel, ein
  0-px-Slot wäre nicht mehr bedropbar).
- In `DashboardLayout` bekommt ein starres Kind einer **Spalten**-Teilung
  `flex: 0 1 auto` statt eines Anteils, nimmt also seine Inhaltshöhe und
  überlässt den Rest den flexiblen Geschwistern. Zeilen-Teilungen bleiben
  unverändert: die Breite entscheidet, wie viele Karten pro Reihe passen.
- Die Grow-Faktoren der flexiblen Kinder werden auf ihre Summe
  normalisiert. Ohne das blieb im Test Platz ungenutzt (Chart 379 statt
  631 px): Anteile summieren zu 1, fällt eines aus dem Wachsen heraus,
  verteilt Flexbox nur noch den entsprechenden Bruchteil des freien
  Platzes.
- Flexible Geschwister eines starren Bereichs bekommen `MIN_AREA_PX` als
  Untergrenze — sonst schrumpft bei zu kleinem Fenster ausschließlich der
  starre Bereich (Basis `auto`), und der flexible fiele auf 0 px.
- Ein Trenner neben einem starren Bereich hätte nichts zu verschieben und
  ist deshalb inert: keine Handler, kein Resize-Cursor, kein Hover — die
  Lücke bleibt gleich groß.

**Verifiziert** am LilyGo (1600x1000, Maischen): Kartenbereich 204 px =
exakt Inhaltshöhe, Chart 631 px, zusammen mit dem 16-px-Trenner genau die
851 px des Layouts. Im Bearbeiten-Modus 220 px Inhaltshöhe bei 220 px
Inhalt — keine Scrollbar mehr, der Unterschied sind nur noch die 16 px
Bearbeiten-Polsterung. Trenner-Klassen geprüft: der senkrechte behält
`cursor-col-resize` + Hover, der waagerechte über dem Kartenbereich ist
leer. Tabs Vorbereitung/Kochen gegengesehen, `pnpm typecheck` grün.

**Bewusst offen:** Das Hinweisfeld verkürzt weiterhin die flexiblen
Bereiche um 50 px, solange der Bearbeiten-Modus läuft (siehe PLAN.md) —
für Kartenbereiche ist der Effekt jetzt weg, Charts und Programme
skalieren dabei sauber mit.

## 2026-09-20 — Regler-Karten nach Vorlage + frei wählbare Sekundärfarbe

Nutzer-Vorlagen für alle drei Größen der Regler-Card. **Groß:** Ist links und
Soll rechts nebeneinander groß, darunter der Slider mit Min/Max, darunter
„Ausgang" mit Prozentwert und Balken. **Gauge:** Soll, Ist und Ausgang
untereinander im Kreis. **Kompakt:** dieselben drei Werte in einer Zeile über
einem schmalen Slider. Der Klick auf den Sollwert macht daraus in allen drei
Größen ein Eingabefeld (unverändert, nur die Schriftgröße passt sich an).

**Farben.** Der Sollwert ist weiß, der Istwert trägt die Akzentfarbe, und die
Füllung von Slider und Bogen ist **immer** Akzent — die bisherige Rotfärbung
unterhalb des Sollwerts entfällt (ausdrücklicher Wunsch: keine Zustandsfarbe an
dieser Stelle). Ausgangsbalken und -prozentwert nutzen eine neue
**Sekundärfarbe**, die wie die Akzentfarbe am Gerät liegt (`SettingsStore`,
`theme.ts` setzt `--secondary`/`--secondary-fg`, Einstellungen → Darstellung mit
sechs Vorgaben plus freier Wahl, Default `#22c55e`). Damit gilt sie geräteweit
und ist über `GET /api/backup` gesichert; `WebUI.cpp` validiert sie wie den
Akzent (`invalid secondary`), `docs/openapi.yaml` ist nachgezogen. Ältere Geräte
ohne das Feld fallen auf den Default zurück (`secondary?` in `ThemeSettings`).

**Ausgang in Prozent.** Der Wert wird jetzt einheitlich als Prozent des
Aktorbereichs gezeigt (vorher der Rohwert, sobald `max > 1`) — passend zum
Balken. Regler mit getrenntem Heiz-/Kühlausgang bekommen zwei Balken.

**Gauge aufgeräumt.** Min/Max sitzen jetzt in der Lücke des Bogens statt in
einer eigenen Zeile darunter (neuer `rangeLabels`-Schalter, auch von der
SensorCard genutzt). Die Gauge reservierte bisher ein **quadratisches** Feld,
obwohl der Bogen wegen der 90°-Lücke schon bei rund 80 % der Höhe endet — der
tote Streifen darunter ist weg, das Feld endet knapp unter den Bogenenden (aus
der Bogengeometrie gerechnet, nicht geschätzt: 185 statt 220 px bei `size=220`).
Dadurch passt die Gauge-Karte in `row-span-3` statt `row-span-4`
(`widgetSizeClass`, 248 statt 336 px) — 55 px toter Raum weniger pro Karte.
Linienstärke und Knopf sind auf die Maße des linearen Sliders umgerechnet
(6 px Spur, 18 px Knopf aus `styles.css`), vorher 15,4 bzw. 21,6 px.

**Verifikation:** `pnpm typecheck` grün, `pio run -e esp32dev` grün, Redocly
valide (nur die bekannte `license`-Warnung). Im Browser gegen den lokalen Mock
geprüft: alle drei Ansichten inklusive Klick-Edit am Sollwert, Umschalten der
Sekundärfarbe färbt Balken und Prozentwert sofort um und erreicht die API als
`theme.secondary`, Kartenhöhen nachgemessen (Gauge-Karte 251 px bei 250 px
Inhalt, vorher 336 bei 281), Bogenstärke 6 px und Knopf 18 px exakt wie beim
Slider.

**Offen:** Persistenz der Sekundärfarbe am echten Gerät, siehe PLAN.md — das
Testboard läuft weiter mit einer Firmware ohne das Feld.

## 2026-09-19 — Neue Menü-Seite „Rechner" (Brauprozess-Rechner)

Neue Hauptseite (`/rechner`, NavShell-Eintrag) mit 14 kleinen
Brauprozess-Rechnern in 6 Kategorien (Einheiten, Volumen, Mischen,
Effizienz, Karbonisierung, Messen) — bewusst ohne Rezept-Design-Rechner
(IBU, Farbe, Wasserchemie), die sind für eine spätere
„Rezeptentwicklung"-Funktion vorgesehen. Formeln zentral in
`web/src/gravityUnits.ts` (Plato/SG/Brix-Kern) und `web/src/brewMath.ts`
(restliche Formeln) als reine, ungetypte UI-freie TS-Funktionen — damit
später wiederverwendbar. `vitest` neu als Test-Runner eingeführt (bisher
keiner im Web-Frontend), 22 Tests für beide Module. Navigation:
Index-Seite mit Kategorie-Karten (`/rechner`, Muster wie `SettingsIndex`)
plus eine parametrisierte Detail-Seite (`/rechner/:calc`, Muster wie
`ArchivePage`s `:id`-Route) statt 14 einzelner Routen. Zwei zusätzliche
Shared-Components über den ursprünglichen Plan hinaus: `NumberField`
(beschriftete Zahlen-Eingabezeile, bei der Umsetzung als eindeutig fehlend
erkannt — jeder der 14 Rechner hätte sie sonst dupliziert) und
`GravityInput`/`CalcResult` wie geplant.

**Beim Verifizieren im Browser gefunden und korrigiert:** Der ursprünglich
geplante Zusatzmodus „ABV bei unbekannter Stammwürze" (Refraktometer +
Spindel kombiniert, ohne bekannte Stammwürze) lieferte bei realistischen
Testwerten (Brix 8, FG 1.010) negative Ergebnisse (−23,5 °P, −11,8 % vol)
— die zugrundeliegenden Koeffizienten (vermutlich mit der Balling-Formel
verwechselt statt der tatsächlichen Novotny-Formel) waren falsch. Statt
mit TODO-Markierung auszuliefern, wurde der Modus komplett entfernt; der
ABV-Rechner bietet in v1 nur den soliden, getesteten Modus mit bekannter
Stammwürze. Die Refraktometer-Korrektur selbst (Rechner 11) nutzt
dieselben verdächtigen Koeffizienten und bleibt mit TODO(verify)-Hinweis
drin, da ihr Ergebnis zumindest plausibel im Wertebereich liegt (siehe
PLAN.md „Bugs & bekannte Einschränkungen" für alle unverifizierten
Formelkonstanten). Alle anderen Formeln gegen Handrechnung/Referenzwerte
verifiziert (Zylinder-/Kegelstumpf-Volumen exakt hergeleitet und getestet,
Karbonisierung stöchiometrisch aus Molmassen abgeleitet statt aus
erinnerten Tabellenwerten).

## 2026-09-19 — Rechner: Novotny-Formel korrigiert (Refraktometer/ABV/Endvergärungsgrad)

Nutzer stellte die Excel-Datei
`StammwuerzeErmittlungAusBrixUndEsNachNovotnyLinear_V02.xlsx` (Weiß, O.,
V02, 2024) bereit — eine dokumentierte, quellenbasierte Umsetzung der
Novotný-Formel (Novotný, P. (2017), Zymurgy 40(4), 49–54; Ascher, T.,
BrauCampus Graz (2021)). Per `openpyxl` (musste erst installiert werden,
war entgegen der xlsx-Skill-Doku nicht vorhanden) Formeln und Werte aus
allen drei Tabs extrahiert und gegen die vorherige, aus Erinnerung
zusammengesetzte Implementierung abgeglichen — bestätigte den in der
Vorsession dokumentierten Verdacht: Die alte Formel wandte die
Balling-Koeffizienten (0.1808/0.8192) direkt auf den rohen Brix-Wert an,
statt die tatsächliche Novotný-Beziehung zu nutzen
(`SG = 1 + 0,006276·Bgc − 0,002349·Bwc`, mit Bgc = BCF-korrigierter
Brix-Wert). Ersetzt:

- `gravityUnits.ts`: `platoToSg`/`sgToPlato` sind jetzt exakte algebraische
  Inversen derselben Quadratik (`SG = (668−√(668²−820·(463+P)))/410`),
  statt zwei unabhängig gefitteter Näherungsformeln. Gegen das
  Excel-Rechenbeispiel exakt verifiziert (Es=3 → SG=1,0117373721335001,
  auf 9 Nachkommastellen getroffen).
- `brewMath.ts`: neue `apparentExtractFromRefractometer` (Tool A: OG
  bekannt, aktuellen Wert nur per Refraktometer schätzen) und
  `originalExtractFromDualMeasurement` (Tool B: OG unbekannt, aus
  Refraktometer+Spindel rekonstruieren — algebraische Auflösung derselben
  Gleichung nach der anderen Unbekannten) sowie `ballingBeerAnalysis`
  (Alc %w/w, %v/v, Ew, scheinbarer/realer Vergärungsgrad, nach Balling,
  gleiche Quelle). Alle vier gegen das Excel-Rechenbeispiel exakt
  verifiziert (bis auf Rundung in der letzten Dezimale).
- Der in der Vorsession entfernte Zusatzmodus „ABV bei unbekannter
  Stammwürze" (Refraktometer+Spindel-Doppelmessung) ist mit der jetzt
  korrekten Formel wieder in `CalcAbv.tsx` enthalten.
- Im Browser nachgeprüft: Refraktometer-Korrektur zeigt für OE 12°P/Brix
  6,4/BCF 1,03 jetzt plausibel 2,8°P (vorher fälschlich 9,0°P — höher als
  der rohe Brix-Wert, was für eine Alkoholkorrektur unmöglich ist).

`pnpm typecheck` und `pnpm test` grün (25 Tests, u. a. alle vier neuen
Referenzwerte exakt aus dem Excel-Beispiel). Offene TODO(verify)-Marker
für Einmaischtemperatur, Effizienz-Checkpoints und Karbonisierung bleiben
bestehen — siehe PLAN.md.

**Zur Nutzeranmerkung „Brix/Plato-Faktor 0,96":** Der allgemeine
Einheiten-Umrechner behandelt °Brix und °Plato bewusst 1:1 (beides
sucrose-äquivalente Massenprozent-Skalen, per Definition praktisch
identisch) — das ist korrekt und unverändert. Der vom Nutzer gemeinte
Faktor ist der geräteabhängige Refraktometer-Korrekturfaktor (hier „BCF"
genannt, Standard 1,03 laut Quelle, angewendet als Division Bgc=Bg/BCF),
der ausschließlich in den Refraktometer-Rechnern (11, 13) zum Tragen
kommt und dort jetzt korrekt als eigener, einstellbarer Eingabewert
vorhanden ist.

## 2026-09-19 — Not-Aus-Funktion (Hauptschalter)

Backlog-Punkt aus PLAN.md umgesetzt: ein Not-Aus-Button, persistent im
Nav-Fußbereich (Desktop-Sidebar + mobiler Header), unabhängig von der
aktuellen Seite erreichbar. Architekturfrage vorab mit dem Nutzer geklärt
(Scope, Persistenz, Reset, Platzierung), siehe Plan.

**Scope:** `POST /api/estop` (neuer Endpoint, `WebUI.cpp`) deaktiviert jeden
Aktor (`setEnabled(false)`) und pausiert jedes laufende/wartende Programm
sowie jeden laufenden Timer (neue `pauseAllRunning()`-Methoden auf
`ProgramRunner`/`TimerStore`, die intern über die bestehenden Ids die
vorhandene `control(id, "pause", …)`-Logik aufrufen — kein neuer Aktor-Code
in SensActCtrl nötig, `Actuator::setEnabled(false)` hält die Hardware-Ausgabe
bereits sicher inaktiv, selbst wenn ein Controller weiterschreibt). Bewusst
**nicht persistent** (reiner Laufzeit-Zustand, nach Reboot startet alles
normal) und **kein Sammel-Reset** — jeder Aktor/jedes Programm/jeder Timer
wird einzeln über die bestehenden Controls wieder aktiviert.

Frontend: `emergencyStop()` in `api.ts`, neuer `OctagonX`-Button (kritisch
eingefärbt, `text-critical`/`hover:bg-critical/10`) in `NavShell.tsx` an
beiden Stellen, ohne Confirm-Dialog (ein echter Not-Aus muss sofort wirken).
Erfolg ist über die SSE-getriebenen Karten sichtbar, kein zusätzlicher
globaler Banner-State.

`pio test -e native` (224/224), `pio run -e esp32dev` und `pnpm typecheck`
grün; OpenAPI-Lint sauber (`POST /api/estop` in `docs/openapi.yaml`
dokumentiert). Im Browser gegen ein Testboard geprüft: Klick löst korrekt
`POST /api/estop` aus (404 dort, weil das Board die alte Firmware ohne den
neuen Endpoint fährt — erwartet, kein Seiteneffekt), Fehler wird sauber
abgefangen. Echte Hardware-Verifikation (Aktor + laufendes Programm/Timer,
tatsächliches Abschalten/Pausieren, Reboot-Verhalten) steht noch aus —
absichtlich nicht an einem Board mit echten Aktoren/laufendem Sud
ausprobiert, siehe PLAN.md → Hardware-Verifikation offen.

## 2026-09-20 — Fix: leere AutoTune-Trennlinie auf der Regler-Karte

Nutzer-Fund an der neuen Gauge-Karte: unter dem Bogen stand eine freie
Trennlinie. Ursache ist der AutoTune-Block in `ControllerCard.tsx`, dessen
Container schon rendert, sobald ein PID überhaupt einen `autotuneState` trägt —
Inhalt gibt es aber nur bei `running` (Fortschrittsanzeige) und `done`
(übernommene Kp/Ki/Kd). Im Normalfall `idle` blieb dadurch ein leerer Kasten mit
oberer Trennlinie und zweimal 12 px Polsterung stehen. Die Bedingung prüft jetzt
genau die beiden Zustände mit Inhalt.

Altbestand, kein Folgefehler der Karten-Überarbeitung: vorher lagen unter dem
Bogen ohnehin die Min/Max-Zeile und rund 55 px toter Raum, seit die Karte eng
sitzt steht die Linie frei. `pnpm typecheck` grün.

## 2026-09-20 — Multi-Channel-Sensoren: Kanäle einzeln anlegen und platzieren

Auslöser: HCSR04 und YF-S201 erzeugten immer beide Kanäle, im Dashboard saßen sie
als gestapelter Block (Ref `sensor/<base>`) und rissen Leerraum ins Raster.
Ursache: ein Multi-Channel-Sensor ist ein `Sensor`-Objekt mit einem
Registry-Eintrag, die Kanäle entstehen erst im Snapshot (`RegistrySnapshot.cpp`).
Entscheidung: keine gruppierte Karte, stattdessen einzelne Kanalkarten; die
Gruppenkarte steht als eigener PLAN-Eintrag.

Umsetzung: `HCSR04Sensor`/`YF_S201Sensor` bekommen `setChannelMask()`
(Messung/ISR laufen unverändert, nur `channelCount()`/`channel()` filtern;
Default = alle, Maske ohne gültiges Bit wird ignoriert). `DynamicItems.cpp`
liest `channels` aus dem POST-Body (unbekannter Key, leeres Array und
`derived` ohne `factor` → 400; fehlt `channels`, bleiben alle Kanäle —
alte Configs laden unverändert), der Reset-Callback hängt nur noch am
`volume`-Kanal. `removeSensor` prüft Controller-Referenzen jetzt auch gegen
Kanal-IDs (`tank.derived`), vorher blockierte nur die nackte Basis-ID.
Frontend: Kanal-Häkchen im Add-Dialog (HCSR04: Distanz/Ableitung, YF-S201:
Durchfluss/Volumen; Ableitung braucht Faktor), Dashboard-Inhalte listen jeden
Kanal einzeln, `sensor/<base>.<channel>`-Refs rendern nur diesen Kanal,
Edit/Reset laufen weiter über die Basis-ID, ein Umbenennen zieht auch
Kanal-Refs mit. Bestehende Dashboards mit Basis-Ref rendern unverändert
gestapelt (kein Auto-Migrieren), der Eintrag bleibt im Dialog abwählbar.
`channels` ist in `openapi.yaml` dokumentiert.

Verifikation: `pio test -e native` für `test_hcsr04`/`test_yf_s201` (neue
Maskentests), `pio run -e esp32dev` und `pnpm typecheck` grün,
`redocly lint` valide. Hardware-Test durch den Nutzer erfolgreich (Kanalauswahl
beim Anlegen, einzelne Kanalkarten im Dashboard).

## 2026-09-20 — Quick-Wins: Notfall-Seite, ConfirmModal, OpenAPI, Kanalbezeichnung

Vier kleine Punkte aus PLAN.md abgearbeitet. (1) `onNotFound` in `WebUI.cpp`
liefert SPA-/Notfall-Seite nur noch für Pfade ohne Dateiendung; `/assets/x.js`
& Co. bekommen 404 statt HTML — ein SD-Lesefehler kann so keinem
`<script>`-Tag mehr die Notfall-Seite unterschieben. (2) `ConfirmModal`:
Abbrechen/Bestätigen stehen nebeneinander, der Extra-Button liegt volle Breite
darunter (Labels unverändert, brechen nicht mehr um). (3) `SensorCreate` in
`openapi.yaml`: `calibration` ist `number` (YF-S201, Hz je L/min), `rtd` ein
String `PT100`/`PT1000`. (4) `SensorCard` zeigt die Kanalbezeichnung
(`meta.quantity`) unter dem Titel; im Kompakt-Modus bleibt sie rechts, weil dort
die Höhe knapp ist.

Verifikation: `pnpm typecheck`, `pio run -e esp32dev`, `redocly lint` grün;
Sensorkarten im Browser gegen `pnpm dev` geprüft (kein Überlauf). Nicht
geprüft: `ConfirmModal` mit Extra-Button im Browser und die Notfall-Seite am
Gerät.

## 2026-09-20 — Persistenz-Verifikation am Gerät: Darstellungsmodi, Layout, Sekundärfarbe

Firmware `50f199c` (HEAD, sauberer Tree) per OTA (`POST /api/update/firmware`, kein
Serial) auf `brewcontrol-esp32dev` geflasht. Das Board hat lokal keine Aktoren,
nur ein Remote-Item auf das S2 (Ziel 0, nie beschrieben), keine Regler/Programme
und keinen Sud. Alle Reboots liefen über `POST /api/network` mit unverändertem
Hostnamen; Beleg jeweils über die Messzeit des lokalen Sensors (`t` fiel z. B.
von 36462 auf 18912).

Ergebnis: (1) `sensorModes`/`controllerModes`/`timerModes` und (2) `layout`
(verschachtelter Split) sind nach Speichern und echtem Reboot bytegleich
wieder da, auch in `GET /api/backup` und in der Roh-Datei
`/config/dashboards.json`. Ein Dashboard im Altformat (Backup-Restore ohne
Modi/Layout) lädt fehlerfrei, liefert leere Modi und kein `layout`-Feld.
Die UI (`pnpm dev` per `VITE_ESP_HOST`-Umgebungsvariable gegen das Board,
`.env.local` zeigt aufs LilyGo und blieb unangetastet) rendert Gauge/Kompakt und
die gespeicherte Anordnung nach Reload. (3) `theme.secondary`: eine alte
`settings.json` ohne das Feld fällt auf `#22c55e` zurück, `#ff8800` übersteht
Reboot, steht in `GET /api/settings`, `GET /api/backup` und der Roh-Datei;
`red`, `#12345`, `#1234567`, `22c55e0` liefern 400 `invalid secondary`.

Escape-Abbruch: Drag aktiv (Karte gedimmt), nach Escape weg, danach `pointerup`
ohne Request und ohne Layoutänderung; Kontrolllauf ohne Escape committete.
Beides mit synthetischen `PointerEvent`s und `setPointerCapture` als No-op
(echte Pointer-IDs lassen sich im Browser-Pane nicht erzeugen), die
Handler-Logik ist also echt, die Browser-Pointer-Erfassung nicht. Ein Drag mit
echtem Finger am Tablet bleibt offen (PLAN.md).

Befund: `POST /api/settings` prüft Farben nur auf Länge 7 und `#`; `#gggggg`
wurde angenommen und persistiert (PLAN.md, Bugs). Aufgeräumt: Testdashboard
gelöscht, `secondary` auf den Default zurückgesetzt, Registry unverändert zum
Backup vor dem Test.

## 2026-09-20 — „Gerät hinzufügen“ als 4-Schritt-Wizard (nach Design-Entwurf)

Grundlage waren zwei Entwürfe (Desktop + Mobile) für einen mehrschrittigen
Anlege-Dialog. Der bestehende Dialog ist darin integriert: seine per-Typ-Felder
sind jetzt Schritt 4.

**Umsetzung:**

- Neue Hülle `AddItemWizard.tsx` (~185 Z.) mit `ChoiceCard`: Scrim, responsives
  Panel, Desktop-Schrittleiste (240 px, Haken + gewählter Wert als Unterzeile,
  anklickbar bis `maxStep`), mobile Segmentleiste mit „Schritt X von 4“,
  Schritt-Titel und Footer. Responsive rein über Tailwind `md:` — kein
  `matchMedia`; DOM-Reihenfolge [Rail, Mobil-Header, Pane] ergibt mit
  `hidden md:flex` / `md:hidden` in beiden Layouts die richtige Abfolge.
  Mobil vollflächig ohne Scrim, ab `md` ein zentriertes 880×640-Panel.
- Schritte: 1 Art → 2 Kategorie → 3 Gerätetyp → 4 Konfiguration, danach ein
  Erfolgs-Screen. Kein Zusammenfassungs-Schritt (war im Entwurf, bewusst
  verworfen). Kategorien sind unverändert die `group`-Werte aus `itemTypes.ts`;
  eine Kategorie mit genau einem Typ wählt diesen vor, damit Schritt 3 dort ein
  „Weiter“ statt eines Klicks ohne Alternative ist.
- `itemTypes.ts` bekommt `ROLE_META` (Icon + Beschreibung je Rolle) und
  `CATEGORY_ICON` (Icon je Kategorie); `ITEM_TYPES` selbst unverändert,
  Reihenfolge und Anzahl der Kategorien werden daraus abgeleitet.
- **Bearbeiten und Discovery-Prefill nutzen den Wizard nicht** — sie behalten
  den kompakten Ein-Pane-Dialog. Dessen Zurück-Chevron ist entfallen: beim
  Bearbeiten gab es nie einen, und bei einem Discovery-Treffer steht der Typ
  durch den Scan fest. `ItemTypePicker.tsx` ist damit verwaist und gelöscht.
- Die ~880 Zeilen per-Typ-Feld-JSX wurden **byte-identisch** in eine lokale
  `fieldBlocks()` verschoben (mit `git diff -w` gegengeprüft) und werden von
  beiden Darstellungen aufgerufen. Eine Kindkomponente hätte ~70 Werte plus ~70
  Setter als Props gebraucht; die lokale Funktion schließt alles gratis ein.
- Form-Semantik: ein einziges `<form>` bleibt, aber der Primärbutton ist nur in
  Schritt 4 `type="submit"`, alle Karten/Rail-Buttons sind `type="button"`, und
  `onSubmit` bricht auf Schritt 1–3 ab. Es wird immer nur der aktive Schritt
  gerendert — ein verstecktes `required`-Feld würde den Submit sonst unsichtbar
  blockieren.
- `handleSubmit` schließt im Wizard nicht mehr sofort, sondern feuert
  `onCreated` (sobald das Item existiert) und zeigt den Erfolgs-Screen; jedes
  Schließen läuft über `closeWizard()`, das `created` vorher räumt — sonst
  blitzt der alte Screen beim nächsten Öffnen auf, weil der Reset-Effect erst
  nach dem Paint läuft.

**Verifiziert:** `pnpm typecheck`, `pnpm build`, `pnpm test` (25/25) grün.
Live gegen esp32dev: Wizard über Aktor→GPIO→DigitalOutput inkl. Singular
„1 Typ“ / „3 Typen“, MQTT-Kategorie wählt ihren einzigen Typ vor,
Rollenwechsel aus Schritt 4 heraus leert Schritte 2–4 und sperrt sie wieder,
Anlegen → Erfolgs-Screen → Fertig → Gerät in der Liste. Kompakter Pane beim
Bearbeiten (kein Chevron, AutoTune vorhanden). Verschachtelt aus
„Dashboard-Inhalte“: Wizard startet auf Schritt 1 mit vorgewähltem Sensor, nach
„Fertig“ ist das Content-Modal noch offen und der neue Sensor angehakt.
Mobil 375×812 wie im Entwurf. Testgeräte danach wieder gelöscht.

**Nebenbefund:** Enter im Formular löst im Browser-Pane keinen Submit aus —
auch im unveränderten kompakten Dialog nicht. Das ist die synthetische
Tastatureingabe der Automatisierung, keine Regression; am echten Gerät
unverändert.

## 2026-09-20 — Not-Aus am Gerät verifiziert (esp32dev)

Hardware-Verifikation von `POST /api/estop` am esp32dev (`192.168.178.74`, lokal
keine echten Aktoren; nur HTTP, kein Serial). Aufbau: `DigitalOutput`
`estop_led` (GPIO 16), `TwoPoint`-Regler darauf (Sensor: Remote-Binärwert
`lolin_wstest` = 1, Sollwert 10 — der Regler schreibt dadurch dauerhaft
`target=1`), Programm mit zwei 600-s-Schritten und ein 600-s-Timer, beide
gestartet. Vorher Backup + Snapshot gesichert.

**Ergebnis:** (a) nach dem Not-Aus `enabled=false` und `state.v=0` am Aktor,
obwohl der Regler weiter aktiv blieb und `target=1` schrieb — über drei
Messungen im Abstand von 4 s stabil. (b) Programm und Timer wechselten auf
`paused` und standen bei 591 s fest. (c) Nach dem Reboot (`POST /api/network`
mit unverändertem Hostnamen, `sensors[].state.t` sprang zurück) sind alle
Aktoren wieder `enabled=true`, der LED-Ausgang liegt wieder bei `v=1` — der
Aktor-Teil des Not-Aus ist nicht persistiert.

**Kein Befund:** Programm und Timer bleiben nach dem Reboot `paused` (Not-Aus
speichert sie per `saveToSD`) — beabsichtigt: nach einem Neustart soll nicht
dieselbe Situation, die den Not-Aus ausgelöst hat, von selbst wieder entstehen.
Die Aktor-Deaktivierung ist dagegen nicht persistiert. Die Aussage in
`openapi.yaml` („starts normally again“) wurde entsprechend präzisiert.
Testobjekte danach gelöscht, das Board ist wie vorher (`lolin_ids1`, `test`,
`lolin_wstest`).

## 2026-09-20 — Dashboard-Inhalte-Dialog nach Design W1 (ContentDialog)

`DashboardContentModal.tsx` an das überarbeitete WinUI-Design angeglichen:
720×640-Dialog mit Titel/Untertitel, immer sichtbarer Suche, Kategorie-Tabs
(„Alle“ + je Gruppe, Zähler ausgewählt/gesamt), Zusammenfassungszeile mit
Delta („n hinzugefügt · m entfernt“), „+ Neu…“-Button im Gruppen-Header,
Checkbox-Zeilen und Footer „Übernehmen“ (erst bei Änderungen aktiv) /
„Abbrechen“. Timer-Gruppe bleibt erhalten (im Design nicht vorgesehen).
Auf Mobil (<640 px) läuft die Tab-Leiste horizontal, die Scrollbar ist
versteckt und ein Ausblend-Verlauf am rechten Rand zeigt, dass es weitergeht.
Verifikation: `pnpm typecheck` grün; im Browser gegen das LilyGo geprüft
(Tabs, Suche inkl. Leerzustand, Delta-Zeile, Übernehmen-Status, Stapelung mit
dem Add-Wizard, Mobilansicht 375 px; ohne Speichern).

**Nebenfund — SESSION.md-Encoding:** Ein `Get-Content -Raw | Set-Content
-Encoding utf8` in Windows PowerShell 5.1 hat die Datei als cp1252 gelesen und
mit BOM zurückgeschrieben (Mojibake in allen Umlauten/Gedankenstrichen,
~2000 Zeilen Diff, Commit `d4e6631`). Repariert durch Neuaufbau aus der Fassung
vor dem Schaden (`b2be3a1`) plus diesem Eintrag; UTF-8 ohne BOM. Für
Doku-Edits Python mit explizitem `encoding="utf-8"` oder das Edit-Tool nutzen,
nicht die PS-5.1-Cmdlets.

## 2026-09-20 — Gruppenkarte für Multi-Channel-Sensoren + gemessene Raster-Spans

Auslöser: Seit dem Umbau auf einzelne Kanalkarten (50f199c) war die Basis-Ref
`sensor/tank` nur noch ein Stapel aus zwei vollen Karten und riss Leerraum ins
Raster. Gewünscht war eine Karte pro logischem Sensor mit einer Zeile je Kanal.

**Unterwegs gefunden — die eigentliche Ursache des Leerraums:** Die Zeilen-Spans
`row-span-1/2/3` (`ui.ts` → `widgetSizeClass`, `ActuatorCard`) sitzen auf der
Karte. Seit dem Drag-&-Drop-Umbau (3ddcaf6) ist das Grid-Kind aber der
`itemBox`-Wrapper in `DashboardLayout` — die Klassen waren seither wirkungslos.
Jede Karte belegte eine Auto-Zeile, deren Höhe die höchste Karte der Reihe
bestimmte; unter einer kompakten Karte (94 px) neben einer Gauge-Karte (263 px)
standen so ~170 px Luft. Der Versuch, die Spans wieder zu deklarieren, scheiterte
an den Zahlen selbst: die 72-px-Raster-Annahme stimmt für keine Karte mehr
(Regler-Karte 213 px statt 160). Statt einer Höhentabelle, die beim nächsten
Karten-Redesign wieder still veraltet, **misst** die Layout-Komponente jetzt:
ein `ResizeObserver` je Karte setzt `grid-row: span ceil((Höhe + 16) / 8)`, das
Kartenraster läuft auf 8-px-Zeilen ohne Zeilen-Gap (der Abstand steckt als
`pb-4` in der Karte — ein `row-gap` läge sonst zwischen *jeder* der kleinen
Zeilen). Ein Kartenbereich endet dadurch einen Abstand unter seiner letzten
Karte; die Spans in `widgetSizeClass` sind ersatzlos raus, die `min-h`-Böden
bleiben. Das gilt für das Desktop-Layout; die mobile Linearisierung
(`Dashboard.tsx` → `mobileBlocks`) behält ihr bisheriges Raster — einspaltig
gibt es nichts zu packen, ab `sm:` bleibt der alte Zustand.

**Gruppenkarte:** Neue `SensorGroupCard.tsx` — Titel = Basis-ID, je Kanal eine
Zeile (Label aus dem Kanalschlüssel, Wert/Einheit, im Modus „normal" Balken +
Min/Max, im Modus „kompakt" nur die Wertzeile), Reset-Knopf nur in der Zeile
eines kumulativen Kanals (ruft weiter `resetSensor(<Basis-ID>)`), Stift/× im
Kopf, `fault` einmal unter den Zeilen. Gauge gibt es pro Zeile bewusst nicht —
dafür bleibt der Kanal einzeln platzierbar. `Dashboard.tsx` rendert die
Gruppenkarte für eine Basis-Ref mit mehr als einem Kanal, sonst unverändert
`SensorCard`; bestehende `sensor/<base>`-Refs wechseln damit ohne Migration.
Der Zeilen-Modus liegt unter der Kanal-ID (`sensorModes['tank.distance']`) —
derselbe Schlüssel wie bei einer einzeln platzierten Kanalkarte, kein
Schema-Zusatz. Gelesen wird mit Rückfall auf die Basis-ID, ein Umschalten
materialisiert alle Kanäle und wirft den Basis-Schlüssel weg (Migration bei der
ersten Berührung). Im Inhalte-Dialog steht die Basis-ID jetzt als regulärer
Eintrag „Gruppenkarte · N Kanäle" über ihren Kanälen; Gruppe und Einzelkanal
dürfen gleichzeitig auf einem Dashboard liegen (bewusst, der Kanal erscheint
dann zweimal).

**Verifikation** im Browser-Pane gegen einen Wegwerf-Mock (Snapshot mit HCSR04-
und YF-S201-Kanälen, Regler, Aktoren, Chart; kein Zugriff auf ein echtes Board,
`.env.local` unangetastet): Gruppenkarte statt Stapel, gemessene Abstände
zwischen allen Karten 16–21 px und **kein** Loch mehr; Kartenbereich ohne
Phantom-Scrollbar (`scrollHeight == clientHeight`); Zeilen-Modus umschalten →
genau ein POST, Karte wächst 155→182 px, Span 20→23, übersteht den Reload;
Reset nur in der `volume`-Zeile und auf die Basis-ID; Drag der Gruppenkarte und
eines Charts in die Kartengruppe je ein POST, Chart weiter volle Breite;
Inhalte-Dialog mit Gruppen- und Kanal-Einträgen; Dark/Light und 375×812 (eine
Karte je Zeile, kein horizontales Scrollen). `pnpm typecheck`, `pnpm test` (25)
und `pnpm build` grün, `redocly lint` valide (nur die bekannte
`license`-Warnung). Firmware unverändert — `DashboardStore` behandelt
`sensorModes` als opake Key→String-Map; `openapi.yaml` beschreibt jetzt, dass
Dashboard-`sensors` Basis- **und** Kanal-IDs enthalten und welche Schlüssel in
`sensorModes` stehen. Am Gerät steht die Verifikation aus (PLAN.md).

**Nebenbefund:** `web/src/types.ts` kennt `Quantity` `Distance` nicht, obwohl
`Quantity.h` und `openapi.yaml` ihn führen (PLAN.md).

## 2026-09-20 — Not-Aus rastet ein und überlebt den Reboot

**Problem** (PLAN.md): `POST /api/estop` deaktivierte nur Aktoren, und zwar
ausschließlich im RAM. Nach einem Reboot regelten Regler sofort wieder — war
ein durchgehender Regler der Auslöser, entstand dieselbe Situation erneut,
obwohl Programme/Timer bewusst pausiert blieben. Beim Aufarbeiten fiel ein
zweites Loch ohne Reboot auf: Regler wurden gar nicht deaktiviert, liefen also
weiter und hätten einen einzeln wieder freigegebenen Aktor sofort getrieben.

**Umsetzung.** Der Not-Aus deaktiviert jetzt zusätzlich alle Regler und
*rastet ein*: `WebUI` führt ein `estop_`-Flag, persistiert es nach
`/config/estop.json` und wendet es in `loadEstop_()` aus `WebUI::begin()`
wieder an — also nach `registry.begin()`, bevor die erste Snapshot-Antwort
oder der erste Regler-Tick das Gerät sehen. Gelöst wird er über das neue
`DELETE /api/estop` (mit `requireAuth`; der POST bleibt bewusst offen, damit
ein Not-Aus auch aus gesperrter UI funktioniert). Die Freigabe schaltet
*nichts* wieder ein — Aktoren, Regler, Programme und Timer bleiben, wo der
Stopp sie hinterlassen hat, und werden einzeln über die normalen Bedienelemente
freigegeben. Der Snapshot trägt `estop` immer (nicht nur wenn aktiv), damit
„aus“ nicht mit „alte Firmware“ verwechselt wird; `EmergencyStopBanner`
zeigt daraufhin auf jeder Seite ein Banner mit Erklärung und Aufheben-Button.
`GET /api/backup` bleibt unberührt — ein Restore soll keinen fremden Not-Aus
einspielen.

**Verifikation.** `pio run -e esp32dev` grün, `pnpm typecheck` grün, Redocly
lint sauber. E2E am `brewcontrol-esp32dev` (OTA geflasht) mit einem
Wegwerf-Paar (`DigitalOutput` auf Pin 2 + `TwoPoint`-Regler, danach gelöscht):
Not-Aus → beide Aktoren und der Regler `enabled:false`, `estop:true`,
`/config/estop.json` = `{"active":true}`; Reboot über `POST /api/network` mit
unverändertem Hostnamen → nach 18 s Uptime unverändert alles abgeschaltet und
`estop:true`; `DELETE /api/estop` → `estop:false`, nichts wieder eingeschaltet;
erneuter Reboot → normaler Start (`lolin_ids1` und Regler wieder `enabled`).
Banner im Browser gegen dasselbe Board geprüft (Desktop + 375 px), Aufheben per
Klick lässt es über SSE verschwinden; auf dem Handy brach der Text neben dem
Button in eine schmale Spalte um → `basis-64` als Umbruchschwelle ergänzt.
Beim Diff-Review fiel auf, dass `saveEstop_()`/`loadEstop_()` den globalen
`SdLock` nicht nahmen, obwohl sie vom AsyncTCP-Task auf dieselbe Karte
schreiben wie loopTasks Logging — nachgezogen (Lock eng um die Datei-Operation,
nicht um das Abschalten) und der Stopp-/Reboot-/Freigabe-Zyklus danach auf dem
finalen Build noch einmal am Gerät durchlaufen.

**Nebenbefund** (in PLAN.md aufgenommen): `POST /api/estop` hat keinen
`requireAuth`-Aufruf, `openapi.yaml` versprach dort aber bisher einen `401`.
Das Verhalten ist so gewollt, die Spec war falsch — der `401` ist jetzt nur
noch beim DELETE dokumentiert.

## 2026-09-20 — Sammel-Commit: Farbvalidierung, `Distance`-Typ, `pio ci`-Flags

Drei kleine Punkte aus PLAN.md. (1) `POST /api/settings` prüft `theme.secondary`
und `theme.accent` jetzt auf `#` plus sechs Hex-Ziffern (`isHexColor()` in
`WebUI.cpp`), wie `openapi.yaml` es zusagt; `#gggggg` wird mit
`invalid secondary`/`invalid accent` abgewiesen. (2) `Quantity` in
`web/src/types.ts` kennt `Distance`. (3) Die `pio ci`-Aufrufe in den READMEs
von Beispiel 08–10 und im `platformio.ini`-Kommentar tragen die
C++17-Flags (`-std=gnu++17`, `build_unflags=-std=gnu++11`).

Verifikation: `pio run -e esp32dev` und `pnpm typecheck` grün. Nicht geprüft:
die Farbablehnung am laufenden Gerät.

## 2026-09-21 — AnalogInput als Sensortyp in BrewControl

`SensActCtrl::AnalogInputSensor` (ADC, Zwei-Punkt-Kalibrierung, Glättung)
existierte schon; es fehlte nur die Anbindung. Neuer Typ `AnalogInput` in
`DynamicItems.cpp` (Keys `pin`, `value_min`/`value_max` als Anzeigebereich,
`unit`, `resolution`, `smoothing`, optional `cal_raw1/cal_value1/cal_raw2/
cal_value2`), in `openapi.yaml` und im Hinzufügen-Dialog (`AddItemModal.tsx`,
`itemTypes.ts`). Ohne Kalibrierung wird der volle ADC-Bereich 0..4095 auf
`value_min..value_max` abgebildet, damit direkt nach dem Anlegen Werte in der
richtigen Größenordnung statt Rohcounts erscheinen. `rawMin/rawMax` der Library
sind die Rohwerte der zwei Kalibrierpunkte, keine Bereichsgrenzen — die Gerade
gilt auch außerhalb. Kein Clamping, ADC bleibt bei 12 Bit.

Der Hardware-Test deckte einen Library-Fehler auf: `AnalogInputSensor::setMeta`
speicherte nur den Zeiger auf die Einheit, der in das nach dem Anlegen
freigegebene JSON zeigte (Anzeige „xV��“). Jetzt wird der String kopiert
(`unitStorage_`, wie bei `MqttGenericSensor`); Regressionstest
`test_setmeta_copies_unit` (vorher rot, jetzt grün).

Verifikation: `pio test -e native` (231 Tests), `pio run -e esp32dev`,
`pnpm typecheck`, Redocly-Lint grün (Flash 89 %); Dialog im Browser gegen einen
Mock (Validierung, Anlegen, Bearbeiten-Vorbelegung). Am Board
`brewcontrol-esp32dev` (OTA) mit `AnalogOutput` (DAC, GPIO 25) → `AnalogInput`
(GPIO 34) verkabelt: ohne Kalibrierung liest der ADC 10–12 % zu niedrig
(ESP32-Nichtlinearität); mit Zwei-Punkt-Kalibrierung (0,5 V / 2,5 V) stimmen
1,0 / 1,65 V auf ≤ 0,012 V, an den Rändern 0 V → 0,085 V und 3,0 V → 3,12 V
(ADC-Totbereich/Sättigung). Sensor samt Kalibrierung überlebt einen Reboot.

## 2026-09-21 — Log-Chart: Zoom bleibt bei Live-Updates erhalten

Drag-Zoom (uPlot-Standard) sprang beim nächsten Snapshot zurück, weil
`ChartCard.tsx` bei jedem Live-Punkt `setData(data)` mit dem Default
`resetScales=true` aufrief. Jetzt wird vor dem Anhängen geprüft, ob die
X-Skala noch alle Daten umfasst (`isZoomed`); nur dann läuft der Graph
automatisch mit, sonst bleibt der gezoomte Ausschnitt stehen. Doppelklick
setzt den Zoom zurück (uPlot-Standard).

## 2026-09-21 — Generische Sensor-Kalibrierung (`CalibratedSensor`)

Ersetzt die Einzellösungen (HX711 `scale`/Tara, YF-S201 `calibration`,
AnalogInput `cal_*`) durch einen Mechanismus. Ausgangspunkt war die Beobachtung,
dass man die Rohwerte (ADC-Counts, Pulse) beim Kalibrieren gar nicht kennt.
Lösung: „roh" ist der **unkalibrierte Wert, den der Sensor ohnehin anzeigt**;
der Assistent greift ihn live ab (5 s Mittelwert), der Nutzer tippt nur die
Referenzwerte ein.

**Library:** `CalibratedSensor` (Decorator, wie `IntervalActuator` bei Aktoren)
rechnet pro Kanal `wert = valRef + gain · (roh − rawRef)` — Punkt-Steigungs-
Form statt `gain·roh + offset`, weil sie bei 24-Bit-HX711-Counts in float
genau bleibt (Test `test_precision_with_large_raw_counts`). Drei Arten:
Ein-Punkt-Offset (Steigung bleibt), Ein-Punkt-Faktor (durch den Nullpunkt),
Zwei-Punkt. Binary/Discrete-Kanäle sind nicht kalibrierbar, Cumulative nur per
Faktor (ein Offset würde den Zähler verfälschen).

**Firmware:** `DynamicItems` wickelt *jeden* dynamischen Sensor (Identität bis
zur Kalibrierung, dadurch kein Neuanlegen nötig; `innerPtr`/`ptr` wie bei
`ActuatorEntry`). Persistenz als `calibrations`-Array im Sensor-Config;
Altkeys werden beim Laden übernommen und aus der Config entfernt (HX711 `scale`
→ Gain, YF-S201 `calibration` → Gain `7,5/cal` auf `rate`+`volume`, AnalogInput
`cal_*` → Punkte auf den Full-Scale-Werten). Neue Routen
`GET|POST|DELETE /api/sensors/:id/calibration` (openapi.yaml + README). Der
Snapshot bleibt unverändert — die UI pollt den Rohwert über den GET.

**UI:** `CalibrateModal` (Kanal, Methode, „Messen"-Knopf je Punkt, Reset),
erreichbar in Einstellungen → Geräte und im Dashboard-Bearbeiten-Modus.
HX711-Tara ist jetzt ein Ein-Punkt-Offset und bleibt damit — anders als früher
(nur RAM) — über einen Reboot erhalten. `AddItemModal`: Felder `scale` und
`cal_*` entfernt, Bearbeiten reicht `calibrations` durch (Bearbeiten ist
Löschen + Neuanlegen). HC-SR04 „Ableitung" heißt jetzt „Umgerechneter Kanal":
es ist eine Einheiten-Umrechnung (cm → Liter) auf einem zweiten Kanal, keine
Kalibrierung; jeder der beiden Kanäle wird einzeln kalibriert.

Verifikation: `pio test -e native` (245 Tests, 14 neue), `pio run` für
esp32dev (Flash 89,4 %), lolin_s2_mini (86,3 %) und LilyGo, `pnpm typecheck`,
Redocly-Lint. Am `brewcontrol-esp32dev` (DAC GPIO 25 → ADC GPIO 34): Migration
eines echten `cal_*`-Eintrags, alle API-Fehlerfälle, Assistent im Browser
durchgespielt (Zurücksetzen, Zwei-Punkt mit gemessenen Rohwerten, Übernehmen),
danach 1,0 / 1,65 V auf ≤ 0,012 V; Bearbeiten-Speichern und Reboot erhalten
die Kalibrierung. HX711-/YF-Altkey-Migration per API mit freien Pins belegt.
Offen (PLAN.md): Tara/Faktor an echter Wägezelle und echtem YF-S201.

Verifikation: `pnpm typecheck` grün. Nicht geprüft: Verhalten im Browser
mit Live-Daten.

## 2026-09-21 — Not-Aus: neue Items starten nicht freigegeben

Root Cause: `loadEstop_()` und `POST /api/estop` schalten nur die zum Zeitpunkt
vorhandenen Aktoren/Regler ab; ein bei eingerastetem Not-Aus per
`POST /api/actuators` bzw. `/api/controllers` angelegtes Item kam mit seinem
Default (meist `enabled:true`) hoch. Fix in `WebUI.cpp`: beide Add-Handler
deaktivieren das neue Item, solange `estop_` gesetzt ist.

Verifikation: `pio run -e esp32dev` grün. Nicht geprüft: Anlegen am Gerät
während eines aktiven Not-Aus.

## 2026-09-21 — Backup: Logs, Programme, Alarme; Push-Abos dokumentiert

`GET /api/backup` enthält jetzt zusätzlich `logs`, `programs` und `alarms`
(optionale Sektionen, ältere Bundles bleiben importierbar; Restore validiert sie
als Arrays). Exportiert werden nur Definitionen: Log-`session`, Programm-Fortschritt
(jedes Programm als `idle` auf Schritt 0) und Alarm-Livezustand werden entfernt,
damit ein Restore — ggf. auf einem anderen Gerät — kein laufendes Programm
wieder anstößt und keine Log-Session auf eine fehlende CSV zeigt. Log-CSVs und
Alarm-Historie bleiben außen vor. Push-Abos bleiben bewusst draußen; die Folge
(nach Restore neu einrichten) steht jetzt in der README. `openapi.yaml` nachgezogen.

Verifikation: `pio run -e esp32dev` und Redocly-Lint grün. Nicht geprüft:
Export/Restore-Roundtrip am Gerät.

## 2026-09-22 — BrewControl: Formular-Dialoge mobil als Vollbild

Timer-/Programm-/Profil-/Log-/Alarm-Editor, Dashboard-Inhalt, Kalibrierung und
„Item bearbeiten“ sind unter `md` (768 px) jetzt ein Vollbild-Sheet wie der
„Gerät hinzufügen“-Wizard, darüber unverändert zentriert. Zentral über
`dialogScrim`/`dialogSheet` in `web/src/ui.ts`; die Scroll-Zone bekam `flex-1`,
damit der Footer unten klebt. Confirm-/Name-/Login-Dialog bleiben bewusst klein.

Verifikation: `pnpm typecheck` und `pnpm build` grün, `max-md:`-Klassen im
CSS-Bundle. Nicht geprüft: Sicht am Handy bzw. im Mobil-Viewport.

## 2026-09-22 — Spike: LVGL-Display auf dem AMOLED-1.75 (Branch `spike/lvgl-display`)

Machbarkeits-Spike zu `PLAN.md` → „Interaktives LVGL-Display". Nicht nach main
gemerged; der Code lebt auf `spike/lvgl-display`, hier stehen die Ergebnisse.

**Build-Seite steht.** Env `lilygo_t_display_s3_amoled` erweitert (kein
zweiter OTA-Varianten-Eintrag), Display-Code hinter `BREWCTL_HAS_DISPLAY`,
`lv_conf.h` nur über `-I src/display` sichtbar. LVGL 8.4 baut unter GCC 8.4 /
`gnu++17` ohne Murren.

| Build | Flash | RAM statisch |
|---|---|---|
| A — nur Metriken | 1.633.409 B (24,9 %) | 61.028 B (18,6 %) |
| B — + Display + LVGL | 1.982.141 B (30,2 %) | 112.036 B (34,2 %) |
| Δ | +348.732 B | +51.008 B |

Der RAM-Zuwachs ist fast ganz `LV_MEM_SIZE` (48 KB statisches Array); der
33,6-KB-Draw-Buffer kommt zur Laufzeit dazu. `esp32dev` baut **byte-identisch**
mit und ohne Spike-Code — die `#ifdef`-Kapselung ist dicht.

**LVGL braucht den Arduino-Core-3-Sprung nicht.** Der entsprechende Halbsatz in
`PLAN.md` ist damit erledigt. Die bequeme Treiber-Library allerdings schon:
Arduino_GFX ist aus der PlatformIO-Registry für S3 + Core 2 in keiner Version
baubar, die CO5300/SH8601 kennt (unter 1.6.1 fehlen sie, 1.6.1 scheitert am
falschen Guard in `Arduino_ESP32RGBPanel.h`, ab 1.6.2 kommt `esp32-hal-periman.h`
dazu; PlatformIO kompiliert jede `.cpp` einer Library, auch die ungenutzten
Backends). **LilyGos vendored Fork 1.3.7 baut dagegen problemlos** — der ist der
Weg, nicht ein selbstgeschriebener Treiber.

**Speicher reicht mit Abstand.** Am Gerät gemessen: PSRAM 8.385.767 B (davon
8.293.315 frei — die bislang nur behauptete `qio_opi`-Konfiguration greift also
wirklich), internes Heap 182 KB frei, größter DMA-Block 172 KB.

**Der `loop()`-Takt ist der kritische Befund, und er ist displayunabhängig.**
Schon ohne Display: avg 9,6 ms, p50 7 ms, aber **p99 160–170 ms, max 206–221 ms**.
118 von 6280 Durchläufen liegen im Band 100–250 ms — 1,96 pro Sekunde. Über
Abschnitts-Timer lokalisiert auf `registry.tick()` (max 186 ms; `webUI.tick()`
max 6 ms). Ursache: `IdsActuator` tickt alle 500 ms und `IdsCooker::sendCommand()`
bitbangt 33 Pulse mit `delayMicroseconds`. `setupCommands()` setzt jedes Bit auf
`SIGNAL_HIGH` 5120 µs oder `SIGNAL_LOW` 1280 µs, dahinter je 1280 µs Pause — ein
Kommando dauert damit **131–146 ms** (Vorspann 25 ms + 10 ms, dann 96–111 ms
Pulszug je nach Anzahl der Eins-Bits), protokollbedingt und im kooperativen Loop
unvermeidbar. Der Vorspann läuft über `millis2wait()` mit `yield()`, der Pulszug
über `delayMicroseconds()` ganz ohne. Konsequenz für das Display: die
Plan-Empfehlung „`lv_timer_handler()` aus `loop()`" trägt auf einem Board mit
IDS-Kocher **nicht** — zweimal pro Sekunde stünde die UI ~190 ms. Ein eigener,
auf Core 0 gepinnter LVGL-Task ist damit keine Rückfallebene mehr, sondern die
Ausgangslage. (Messmethodischer Hinweis: `enabled=false` am Aktor ändert nichts,
der Keep-Alive läuft unabhängig davon.)

**Pin-Konflikte in der Item-Konfiguration des Testboards** — behoben und
behalten: `Durchfluss` 9→8, `kettle` 6→21, `Riptide Pumpe` 7→47, `Agitator`
3→48, `IDS1` 7/9/11 → 1/42/18; `Füllhöhe` (HC-SR04, nie ein Messwert) und
`test_dac` (der S3 hat keinen DAC) entfernt. Vorher teilten sich GPIO 7, 9 und 11
je zwei Items: der IDS-Bitbang feuerte 33 Pulse in die RISING-ISR des
YF-S201 — daher meldete `Durchfluss.rate` konstant 9,02 L/min ohne angeschlossenen
Sensor. Seither 0. Umgestellt per `POST /api/backup` mit einem bearbeiteten
Bundle; das Original liegt gesichert. Die Firmware kann solche Überlagerungen
nicht erkennen — Beleg für den Pin-Manager im Backlog.

**Display-Hardware identifiziert.** Das Panel ist rund, 466×466, und trägt einen
**CO5300** mit **CST9217**-Touch — nicht den dokumentierten SH8601/FT3168.
Maßgeblich ist LilyGos `libraries/Mylibrary/pin_config.h`, die zwischen
`DO0143FAT01` (1.43", SH8601+FT3168), `H0175Y003AM` (1.75", CO5300+CST9217 —
dieses Board) und `DO0143FMST10` unterscheidet; die README-Tabelle beschreibt nur
die 1.43. Ein I²C-Scan am Gerät bestätigt das unabhängig: 0x51 (PCF8563),
0x5A (CST9217, **nicht** 0x38) und 0x6A (SY6970). Dieselbe Datei erklärt auch den
alten SD-Fehlversuch — dort steht `SD_CS 38` und separat
`BATTERY_VOLTAGE_ADC_DATA 4`, die README hatte beides zu „SD CS = 4" verschmolzen.
Ebenfalls dort aufgefallen: `Wire` steht auf diesem Variant per Default auf
SDA 18 / SCL 17, und **GPIO 17 ist der Panel-Reset** — heute latent, weil kein
I²C-Item konfiguriert ist. Pin-Belegung und Hinweise stehen jetzt in
`platformio.ini` und `BrewControl/CLAUDE.md`.

**Panel-Bring-up: offen.** Der selbstgeschriebene `Co5300Panel` bringt kein Bild,
obwohl Init-Sequenz und QSPI-Framing inzwischen deckungsgleich mit Arduino_GFX
sind (manuelles CS, `MULTILINE_CMD/ADDR`, `SPI_TRANS_USE_TXDATA` für kurze
Nutzlasten, `0xC4=0x80`, Pixelformat `0x55`, Spalten-Offset 6). Derselbe Pfad mit
LilyGos Arduino_GFX-1.3.7 zeigt dagegen sauber Farben und Text — **Hardware,
Verdrahtung und Pins sind also in Ordnung**, der Rest ist ein Fehler im eigenen
Treiber. Damit ist die Konsequenz klar: Arduino_GFX-1.3.7 vendoren statt selbst
schreiben. Nicht gemessen wurden fps, Touch und die Rückwirkung des Renderns auf
`loop()`.

Diagnosewerkzeug nebenbei: Boot-Log auf SD (`/spike-boot.log`, lesbar über
`GET /api/files/download`) plus I²C-Scan und Panel-Registerlesung. Auf einem
USB-CDC-Board ist das der einzige Weg an einen Panic zu kommen — der Port
re-enumeriert bei jedem Reset, `pio device monitor` sieht nichts. Erst damit fiel
auf, dass die erste „Boot-Schleife" ein eigener Fehler war: `lv_mem_monitor()`
stand unter `#ifdef BREWCTL_HAS_DISPLAY` statt unter der Stufe, in der `lv_init()`
tatsächlich läuft, sodass jede Anfrage an den Metrik-Port das Board panikte.

## 2026-09-22 — Multi-Point-Kalibrierung (Polynom-Fit) für `CalibratedSensor`

Vierter Kalibriermodus `poly` neben `offset`/`gain`/`twopoint`, durchgängig von
der Library über die HTTP-API bis in den Kalibrier-Dialog: Ausgleichspolynom vom
Grad 1–3 durch bis zu acht Stützpunkte, für Sensoren mit krummer Kennlinie
(Anlass: Tilt-Hydrometer nach iSpindel-Vorbild). Die drei linearen Modi bleiben
unverändert — `poly` mit Grad 1 ist zwar rechnerisch dasselbe wie `twopoint`,
aber die Punkt-Steigungs-Form ist der genauere Pfad bei 24-Bit-Rohwerten, und
bestehende Kalibrierungen bleiben ohne Migration lesbar.

**Entscheidungen.** *Kein `CurveFitting`-Dependency*, obwohl der PLAN-Eintrag
das vorschlug: die dort angenommene API (`fit.addPoint/fit/solve`) existiert
nicht, die reale Library hat `fitCurve(order, n, px, py, nCoeffs, coeffs)`,
inkludiert `<Arduino.h>` und ruft `Serial.print` — sie baut also nicht im
`native`-Test-Env, womit ausgerechnet die Fit-Mathematik untestbar wäre.
Stattdessen ein eigener Normalgleichungs-Solver (Gauß mit Spaltenpivotisierung,
in `double`, ~60 Zeilen, keine Allokation) direkt in `CalibratedSensor.cpp`; das
spart zugleich einen Eintrag in `library.json`/`library.properties` der
standalone-publizierbaren Library. *Persistiert werden die Stützpunkte*, nicht
die Koeffizienten — die UI braucht sie ohnehin für die Tabelle, einzelne Punkte
bleiben nachkorrigierbar, und der Fit wird beim Laden neu gerechnet. *Der Grad
ist wählbar* (1–3) statt aus der Punktzahl abgeleitet, damit bewusst geglättet
werden kann (z. B. sechs Punkte, Grad 2).

**Numerik.** Gefittet wird in der zentrierten und skalierten Koordinate
`u = (roh − rawRef)/rawScale` mit `rawRef` = Mittelwert und `rawScale` =
`max|roh − rawRef|`. Ohne das erreichen die Momente der Normalgleichungen bei
HX711-Zählern (~8,4 Mio.) Größenordnungen um `u⁶ ≈ 3e41` und das System ist auch
in `double` unbrauchbar; mit Skalierung liegt die Konditionszahl bei ~25.
`rawRef`/`rawScale` werden als `float` gespeichert und der Fit mit genau diesem
`float`-Wert gerechnet — bei 8,4e6 ist ein float-ULP 1,0, ein zwischen Fit und
Auswertung abweichendes Zentrum würde das Ergebnis verschieben. Außerhalb der
Stützstellen wird **tangential-linear** fortgesetzt statt das Polynom laufen zu
lassen: eine Kubik wird dort leicht unmonoton, eine Waage zeigte bei *mehr*
Gewicht *weniger* an. Bei Grad 1 ist diese Fortsetzung exakt die Zwei-Punkt-
Gerade.

**Zwei Fallstricke, die der Entwurf zunächst enthielt** (beide jetzt durch Tests
abgedeckt): die linearen Modi setzten nur `rawRef/valRef/gain` — auf einem
Ex-Poly-Kanal wäre `degree > 0` stehengeblieben und der Nutzer hätte sichtbar
ins Leere kalibriert; und `setCalibration` resettete den Kanal über eine
*positionale* Aggregat-Initialisierung (`Calibration{rawRef, valRef, gain,
true}`), die beim Anhängen neuer Member nur zufällig weiter stimmt. Beides auf
feldweises Zurücksetzen umgebaut. `calibrateOffset` auf einem aktiven
Poly-Kanal wird jetzt abgelehnt (`NotCalibratable`) statt „behält den Gain" auf
einen Konditionierungsrest anzuwenden.

**Firmware/API.** `calibrations` in der Sensor-Config trägt für Poly
`{channel, mode:"poly", degree, points:[{raw,value}]}` statt der drei
Linear-Zahlen — Einträge ohne `mode`-Key sind weiterhin die lineare Form und
werden unverändert gelesen. `GET …/calibration` liefert jetzt zusätzlich ein
`mode`-Feld (`linear`/`poly`), das bisher fehlte, sodass die UI den aktiven
Modus überhaupt erkennen kann. In `calibrateSensor` wurde das feste
`float raw[2]` auf `kMaxPoints` erweitert und die Schreibschleife zusätzlich
gegen Überlauf abgesichert; Grad-/Anzahlfehler bekommen eigene Fehlertexte statt
des generischen `invalid calibration points`. Höchstens ein Punkt darf „raw"
weglassen — mehrere wären derselbe Live-Messwert und der Fit singulär.

**Verifikation.** 254 native Unit-Tests grün, davon 9 neue für den Poly-Pfad
(exakte Interpolation, Ausgleichsfall mit analytisch bekannter Steigung 2,2,
HX711-Größenordnung, Extrapolation, Modus-Wechsel, Refit-Roundtrip,
Ablehnungen). Compile-Smoke für `esp32dev` und `lilygo_t_display_s3_amoled`,
OpenAPI-Lint, `pnpm typecheck`, 39 Frontend-Tests (14 neu in
`calibrationPoints.test.ts`). UI gegen einen Node-Mock im Browser geprüft:
Modus-Wechsel, Gradwahl (Zeilen werden auf `Grad+1` aufgefüllt), Hinzufügen und
Entfernen von Punkten, Entfernen am Minimum gesperrt, Validierungsmeldungen,
gesendeter POST-Body, mobiles Vollbild-Sheet. **Auf echter Hardware noch nicht
verifiziert** — das esp32dev mit der DAC→ADC-Schleife ist von der
IDS-Überarbeitung belegt; der Durchlauf steht als eigener Punkt in PLAN.md (der
S3 hat keinen DAC, taugt also nicht als Ersatz für gemessene Stützpunkte).
