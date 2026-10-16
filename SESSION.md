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

Gemergte Branches (`docs/consolidate-plan-session`, `feat/sd-file-manager`, `claude/distracted-rubin-a1e377`) und der zugehörige Worktree entfernt; offen blieb nur `feat/winui-design`. Der Bekannte-Probleme-Eintrag zum verschwundenen Test-Sensor `sdfswdf` wurde gestrichen (nie reproduziert).
Details: [SESSION-archive.md](SESSION-archive.md).

## 2026-09-01 — HW-E2E: SD-Boot-Flash-Recovery (`FirmwareUpdater::flashFromSdImage()`)

Der SD-Boot-Flash-Recovery-Pfad (`firmware.bin` im SD-Root wird beim Boot vor WiFi geflasht und gelöscht) am LilyGo T-Display-S3-AMOLED komplett host-getrieben verifiziert: Image per Upload auf die SD, Reboot, neue Version läuft, Datei verschwunden. Dabei fiel der Short-Write-Fehler des Datei-Uploads auf (siehe nächster Eintrag).
Details: [SESSION-archive.md](SESSION-archive.md).

## 2026-09-01 — PLAN.md umstrukturiert: nur noch Offenes

PLAN.md auf „nur Offenes“ umgebaut: Status-Block, Architekturdiagramm, Tech-Stack, Boards-Tabelle und alle erledigten Einträge entfernt; Gliederung jetzt Bugs/Einschränkungen → Hardware-Verifikation offen → Backlog.
Details: [SESSION-archive.md](SESSION-archive.md).

## 2026-09-01 — API-Vertrag nach `BrewControl/docs/openapi.yaml` überführt

Der API-Vertrag liegt jetzt in `BrewControl/docs/openapi.yaml` (OpenAPI 3.1, alle 41 Routen, vorher waren nur 14 dokumentiert und Details wie `405`/`204`/`text/plain`-Fehler falsch). README und CLAUDE.md verweisen darauf; die Spec ist Single Source of Truth.
Details: [SESSION-archive.md](SESSION-archive.md).

## 2026-09-01 — Fix: `POST /api/files/upload` erkennt Short-Writes

`POST /api/files/upload` prüft jetzt den Rückgabewert von `write()`: bei Short-Write wird die Teildatei entfernt und der Upload abgewiesen, statt still `200 ok` zu melden (Anlass: 1,3-MB-Firmware landete als 618 KB auf der SD).
Details: [SESSION-archive.md](SESSION-archive.md).

## 2026-09-01 — `web/src/types.ts` mit der Wire-Form synchronisiert

`web/src/types.ts` an die Wire-Form der Firmware-Serializer angeglichen: `stepStartedEpoch`/`elapsedAtPauseSec`, `charts`/`programs` und alle Settings-Sektionen sind jetzt Pflichtfelder.
Details: [SESSION-archive.md](SESSION-archive.md).

## 2026-09-01 — Fix: `GET /api/snapshot` bei Puffer-Überlauf → `503`

`GET /api/snapshot` liefert bei überlaufendem Snapshot-Puffer (`kSnapshotCap`) `503 snapshot unavailable` statt `200` mit leerem Body; die SSE-Pfade überspringen den Tick. OpenAPI nachgezogen.
Details: [SESSION-archive.md](SESSION-archive.md).

## 2026-09-01 — Fix: `mqtt.password` als Write-only-Feld

`mqtt.password` ist Write-only: `GET /api/settings` liefert nur `passwordSet`, leeres Feld im Update lässt das Passwort stehen, `null` löscht es. Die MQTT-Seite zeigt einen Platzhalter; Flash und Backup behalten das Klartext-Passwort.
Details: [SESSION-archive.md](SESSION-archive.md).

## 2026-09-02/03 — Settings-UI-Überarbeitung (5 Teilschritte)

Settings-UI in fünf Teilschritten überarbeitet (reine Frontend-Arbeit): `PageShell` mit Breitenbegrenzung, Spinner + Skeleton, neue Konnektivitäts-Unterseite, Geräteliste angeglichen, Filemanager-Pfadleiste/Ladezustand. Der Nebenbefund zum Hängen von `GET /api/files` ging nach PLAN.md (siehe nächster Eintrag).
Details: [SESSION-archive.md](SESSION-archive.md).

## 2026-09-03 — Fix: `/api/files` und `/api/logs/:id/sessions` hängen auf einem Log-Session-Verzeichnis

Root Cause: `LogStore::sessionStart` wurde nach dem Reboot nicht zurückgelesen, daher legte jeder Neustart eine neue Stub-CSV an, und `/api/files` bzw. `/api/logs/:id/sessions` liefen dann in einem langen, synchronen SD-Sweep auf dem AsyncTCP-Task. Behoben in `fix/logs-session-dir-hang`: Die Session wird über Reboots fortgesetzt, die Session-Liste kommt aus einem RAM-Spiegel ohne SD-Zugriff.
Details: [SESSION-archive.md](SESSION-archive.md).

## 2026-09-03 — Frontend: deutsche ConfirmModal-Defaults + Feedback nach leerem Bus-Scan

`ConfirmModal`-Defaults auf „Bestätigen“/„Abbrechen“ umgestellt; das DS18B20-Formular gibt nach einem Bus-Scan ohne Treffer eine eigene Rückmeldung.
Details: [SESSION-archive.md](SESSION-archive.md).

## 2026-09-03 — Fix: Collection-POST-Routen akzeptierten GET/PUT/PATCH statt `405`

Die elf JSON-Body-Routen hingen am `AsyncCallbackJsonWebHandler` und nahmen deshalb auch GET/PUT/PATCH an. Neue `PostJsonHandler`-Klasse in `WebUI.cpp` erzwingt POST und liefert sonst `405`; per Gerätetest mit echten Roundtrips verifiziert.
Details: [SESSION-archive.md](SESSION-archive.md).

## 2026-09-03 — Settings-UI: zwei offene UI-Zustände am Gerät verifiziert; QEMU-Punkt entfernt

Zwei bisher nur typgeprüfte UI-Zustände am esp32dev verifiziert (Empty-State der Geräteliste, Spinner im `ConfirmModal`); der QEMU-Punkt in PLAN.md entfiel.
Details: [SESSION-archive.md](SESSION-archive.md).

## 2026-09-04 — Mobile FAB für Geräte/Logs-Hinzufügen und Datei-Upload

Neue Komponente `Fab.tsx` (`Fab`, `SpeedDialFab`): Auf Mobilgeräten ersetzen Floating-Buttons die Header-Aktionen von Geräte-, Logs- und Dateiseite (Datei: Speed-Dial für „Ordner“/„Hochladen“). Zwei Icon-Nebenbugs in `FilesPage.tsx` gleich mit behoben.
Details: [SESSION-archive.md](SESSION-archive.md).

## 2026-09-04 — Programmsteuerung: mobiles Bottom Sheet mit Drag-Geste + Redesign

`ProgramCard` ist auf Mobile/Tablet jetzt ein fixes Bottom Sheet mit Drag-Geste und Acrylic-Hintergrund statt einer `sticky`-Karte; Hero-Block, Status-Badges und Buttons neu gestaltet. Am Testboard mit allen Programmzuständen durchgespielt.
Details: [SESSION-archive.md](SESSION-archive.md).

## 2026-09-04 — Profil-Bibliothek („Profilmanager")

Neue Profil-Bibliothek („Profilmanager“): wiederverwendbare Schrittvorlagen mit Kategorien als Tabs. Firmware `ProfileStore` (`/config/profiles.json`, REST-API, im Backup), Frontend-Seite `/profiles`, Anwenden ersetzt die Programmschritte nach Rückfrage. HW-E2E am LilyGo; dabei wurde der Restore-Bug gefunden (nächster Eintrag).
Details: [SESSION-archive.md](SESSION-archive.md).

## 2026-09-04 — Fix: `POST /api/backup` (Restore) scheiterte an jedem realen Bündel

`POST /api/backup` scheiterte an jedem Bündel, das nicht in ein TCP-Segment passt (~1,4 KB), weil die JSON-Handler keine Body-Segmente sammelten (`413`). Die Handler akkumulieren den Body jetzt über mehrere Chunks; Restore am Gerät wieder benutzbar.
Details: [SESSION-archive.md](SESSION-archive.md).

## 2026-09-05 — HW-Nachtest: GPIO/LEDC-Leak-Fix (2026-08-14)

Nachtest des GPIO/LEDC-Leak-Fixes vom 2026-08-14 am esp32dev mit Jumper GPIO4 → GPIO5: Nach Löschen des PWM-Aktors gibt der Pin den Treiber wirklich frei.
Details: [SESSION-archive.md](SESSION-archive.md).

## 2026-09-05 — PID-AutoTune: Fortschrittsanzeige + Korrektheits-Fix der Relay-Timing

Das vendorte `AutoTunePID` (v1.1.6) las den Messwert nie und leitete Ku/Tu rein aus der Wanduhr ab. `library.json` zeigt jetzt auf den `main`-Commit mit echter Hysterese-Relay-Rückkopplung; dazu Fortschrittsanzeige/Restzeit im AutoTune. Echte Zyklen-Numerik am Gerät blieb offen.
Details: [SESSION-archive.md](SESSION-archive.md).

## 2026-09-05 — Reihenfolge Auth/Push/HTTPS geklärt + Zugriffsschutz umgesetzt

Reihenfolge Auth → Web Push über gehosteten Bootstrap-Origin → HTTPS festgelegt (kein geteilter JWT-Baustein mit `esp-webPush`, HTTPS keine harte Voraussetzung für Push). Stufe 1 umgesetzt: optionaler Zugriffsschutz (Lesen frei, Schreiben nach Anmeldung) per Cookie-Session, Gate in den drei generischen Handlern von `WebUI.cpp`, Login im Frontend. Nebenbei: `GET /api/backup` gab das MQTT-Passwort im Klartext aus.
Details: [SESSION-archive.md](SESSION-archive.md).

## 2026-09-06 — Fix: mobiles Programm-Bottom-Sheet verdeckte das letzte Listenelement

Das mobile Programm-Bottom-Sheet verdeckte das letzte Listenelement, weil der Platzhalter fest `h-40` war. `ProgramCard` misst sich jetzt per `ResizeObserver` und meldet die Höhe an `Dashboard`, das den Platzhalter dynamisch setzt.
Details: [SESSION-archive.md](SESSION-archive.md).

## 2026-09-05 — Alarme & Schwellwerte + Notification/Alert-Center

Alarme & Schwellwerte samt Alert-Center umgesetzt, komplett in der BrewControl-Firmware: `Condition`/`AlarmStore`, REST-API `/api/alarms`, eigenes SSE-Alert-Event, Verlauf im RAM-Ring, Regeln persistiert. Frontend zeigt Alerts im Header-Center. Offen blieben die Trigger `fault()` und AutoTune am Gerät.
Details: [SESSION-archive.md](SESSION-archive.md).

## 2026-09-09 — Push-Notifications umgesetzt (esp-webPush, ein Keypair pro Installation)

Push-Notifications mit `esp-webPush` (Curier ließ sich mit GCC 8.4 nicht bauen): `PushService` im `WebhookService`-Muster, ein VAPID-Keypair pro Installation, gehostetes Bootstrap für die Browser-Abos. Ende-zu-Ende aufs Handy verifiziert, auch bei geschlossenem Browser.
Details: [SESSION-archive.md](SESSION-archive.md).

## 2026-09-10 — Fix: zweiter Browser ersetzte das Abo des ersten

Ein zweiter Browser verwarf das Abo des ersten: `push-bootstrap/app.js` erzeugte trotz übergebenem Gerätekey ein neues Keypair, und ein Key-Wechsel verwirft alle Abos. Der Browser nutzt jetzt den übergebenen öffentlichen Schlüssel.
Details: [SESSION-archive.md](SESSION-archive.md).

## 2026-09-10 — esp32dev auf Stand gebracht, UI-Netzwerk-Deploy für LittleFS-Boards

esp32dev (70 Commits zurück) per OTA aktualisiert. Der UI-Netzwerk-Upload klappt auch auf den 256-KB-LittleFS-Boards, wenn das Paket nur die `.gz`-Dateien enthält (~100 KB statt ~440 KB); CLAUDE.md entsprechend korrigiert.
Details: [SESSION-archive.md](SESSION-archive.md).

## 2026-09-10 — Fix: Push-Test crashte den esp32dev (IRAM statt DRAM)

`POST /api/push/test` crashte den esp32dev (`LoadStoreError`): `WebPushQueueMemory::Internal` schließt IRAM ein, das nur 32-Bit-Zugriffe erlaubt. Die Queue nutzt jetzt `WebPushQueueMemory::Any`; der Test-Pfad von `tick()` bekam zudem den `initialized_`-Guard.
Details: [SESSION-archive.md](SESSION-archive.md).

## 2026-09-10 — Fix: neues Gerät entzog den anderen ihr Push-Abo

Ein frisch eingerichtetes Gerät entzog den anderen das Push-Abo: Die Bootstrap-Seite speicherte das Keypair nur, wenn sie es selbst erzeugt hatte, und fiel bei einem Gerät ohne Key auf einen veralteten Eintrag zurück. Jetzt reicht das Gerät sein vollständiges Keypair selbst weiter, ein halbes Paar wird nie gespeichert. Am Gerät bestätigt: Ein Abo pro Browser bedient beliebig viele Geräte.
Details: [SESSION-archive.md](SESSION-archive.md).

## 2026-09-10 — PWA-Grundgerüst: Home-Screen-Start ohne Adressleiste

PWA-Grundgerüst, damit das Dashboard vom Home-Screen ohne Adressleiste startet: Manifest und Meta-Tags in `web/public/`, dazu ein Vollbild-Schalter. Auf Klartext-HTTP (kein Secure Context) gibt es unter Android keinen WebAPK. Das Vollbild brach beim Wechsel zum Dashboard ab; Ursache war nicht Fullscreen, sondern ein echter Dokument-Load, weil der Klick-Listener von preact-router den Link `href="/"` auf dem Gerät durchließ. Die Seitenleiste ruft jetzt selbst `route()` auf; temporäre Debug-Werkzeuge wurden wieder entfernt.
Details: [SESSION-archive.md](SESSION-archive.md).

## 2026-09-10 — Safe-Area-Padding: Vollbild ohne Rand-Streifen

`viewport-fit=cover` plus Safe-Area-Insets als `--safe-t/-r/-b/-l` in `styles.css`: Die Seite reicht jetzt unter Status- und Navigationsleiste und hält ihre Inhalte selbst davon frei, die Rand-Streifen im Vollbild sind weg.
Details: [SESSION-archive.md](SESSION-archive.md).

## 2026-09-10 — Sensorgetriggerte Programm-Schritte

Programmschritte können per `end: "sensor"` mit einer `Condition` (aus `Condition.h`, gleiche Hysterese-Latch-Logik wie bei Alarmen) enden statt nur über `holdSec`. Der Latch ist Laufzeitzustand und wird bei jedem Schrittwechsel zurückgesetzt; die „Freigabe abwarten“-Option bleibt orthogonal.
Details: [SESSION-archive.md](SESSION-archive.md).

## 2026-09-11 — Multi-Regler-Programme

Ein Programmschritt steuert jetzt beliebig viele Regler und Aktoren: `targets: {id: befehl}` nennt nur, was der Schritt ändert, der Befehl gilt pro Feld (`v`, `enabled`, `interval`). Aktoren wirken nur bei Schrittbeginn, ein implizites Einschalten gibt es nicht mehr. Firmware (`ProgramRunner`), Editor und Anzeige entsprechend umgebaut.
Details: [SESSION-archive.md](SESSION-archive.md).

## 2026-09-12 — Pulse-Aktor anlegbar + `inp`-Breiten-Bug gefixt

`PulseOutputActuator` ist über den Typ `PulseOutput` anlegbar (`DynamicItems`, `AddItemModal`, OpenAPI). Dazu ein Breiten-Bug bei `inp` behoben.
Details: [SESSION-archive.md](SESSION-archive.md).

## 2026-09-12 — Dashboard-UI: vier kleine Fixes

Vier kleine Dashboard-Fixes: Programm-Poll auf 1 s, Sollwert-Input der `ControllerCard` folgt externen Änderungen (`useEffect` auf `setpoint`), beim Umbenennen einer Karte werden die Dashboards mit der neuen ID nachgezogen, und die Programm-Spalte hat dieselbe Breite wie die übrigen Spalten (Grid statt Flex-Row).
Details: [SESSION-archive.md](SESSION-archive.md).

## 2026-09-12 — Bestätigungsdialog beim Umschalten fremdgesteuerter Aktoren/Regler

Das Umschalten eines Aktors oder Reglers, den ein Regler oder Programm steuert, fragt jetzt per Dialog nach. Neu `web/src/ownership.ts` (`controllerOwnerOf()`, `programOwnerOf()`), da das Wire-Format keinen Besitzer-Verweis trägt.
Details: [SESSION-archive.md](SESSION-archive.md).

## 2026-09-12 — Dashboard: Regler über Programm-Widget, Grid-Reflow, größerer Chart

Der zu einem Programm gehörende Regler steht jetzt über dem `ProgramCard` statt getrennt im Regler-Grid; das Grid ordnet sich entsprechend neu, der Chart wurde größer (`Dashboard.tsx`).
Details: [SESSION-archive.md](SESSION-archive.md).

## 2026-09-12 — Regler-Card: kombinierter Ist/Soll-Slider + Regelbereich

Neue Regler-Karte mit kombiniertem Ist/Soll-Slider: weißer Rundknopf = Sollwert (ziehbar), Track rot unter, blau über dem Sollwert, Sollwert-Text direkt editierbar, Regelbereich konfigurierbar. Der Knopf-Stil gilt auch für die Aktor-Slider. Die zirkuläre Variante blieb offen.
Details: [SESSION-archive.md](SESSION-archive.md).

## 2026-09-13 — Timer-Widget (Backlog-Punkt umgesetzt)

Freistehende Timer-Widgets für Brau-Timings (Hopfengaben, Rührintervalle, Rasten): server-persistiert, überleben Reboot und Reload, mit Push-Meldung beim Ablauf. Keine Gruppierung, jeder Timer ist ein eigenes Dashboard-Element.
Details: [SESSION-archive.md](SESSION-archive.md).

## 2026-09-13 — Timer-Erweiterung: Uhrzeit-Modus, Start/Stop-Aktion, Wiederholen

Timer erweitert um einen Uhrzeit-Modus (`mode: duration|clock`, `timeOfDay`), eine optionale Start/Stop-Aktion bei Ablauf (`onExpire`) auf Aktor, Regler oder Programm und eine Wiederholung (driftfrei auf „morgen selbe Zeit“ im Uhrzeit-Modus).
Details: [SESSION-archive.md](SESSION-archive.md).

## 2026-09-13 — Alternative Card-Darstellungen: Gauge & Kompakt für Sensor/Regler/Timer

Sensor-, Regler- und Timer-Karten gibt es zusätzlich als Gauge (rundes SVG, etwa doppelte Höhe) und Kompakt (etwa halbe Höhe). Additives Datenmodell: `sensorModes`/`controllerModes`/`timerModes` in `DashboardConfig`, „normal“ wird nicht gespeichert. Damit erledigt: zirkuläre Regler-Variante und feste Kartenhöhen.
Details: [SESSION-archive.md](SESSION-archive.md).

## 2026-09-13 — Fix: ControllerCard/ActuatorCard zeigten verknüpfte Items auf anderen Tabs nicht an

`ControllerCard` und `ActuatorCard` bekamen nur den Tab-gefilterten Snapshot und fanden verknüpfte Sensoren/Aktoren auf anderen Tabs nicht. Beide erhalten jetzt den vollen Snapshot für den Lookup.
Details: [SESSION-archive.md](SESSION-archive.md).

## 2026-09-13 — Zugriffsschutz Stufe 2: auch die UI/Leseseite sperrbar

Zugriffsschutz Stufe 2: Ein eigener Schalter (`AuthService::uiProtected_`, Preferences-Key `authUiLock`, nur bei gesetztem Passwort) sperrt auch UI-Dateien und Lese-Routen, mit eigener Login-Seite statt leerem SPA-Gerüst. Das bisherige Verhalten bleibt Default.
Details: [SESSION-archive.md](SESSION-archive.md).

## 2026-09-14 — Dashboard-Chart: Legende in die Titelzeile (Desktop)

Die uPlot-Legende des Dashboard-Charts sitzt auf Desktop in der Titelzeile (`legendHost`-Prop in `ChartCard.tsx`, `ChartRow` in `Dashboard.tsx`).
Details: [SESSION-archive.md](SESSION-archive.md).

## 2026-09-16 — Dashboard-Tabs im Bearbeiten-Modus neu anordnen

Dashboard-Tabs lassen sich im Bearbeiten-Modus per ◀/▶ verschieben (bewusst kein Drag & Drop wegen Touch): `DashboardStore::move()`, `POST /api/dashboards/{id}/move`, `moveDashboard()` im Frontend.
Details: [SESSION-archive.md](SESSION-archive.md).

## 2026-09-16 — Log-Chart: zusätzliche Y-Achsen pro Einheit

Log-Charts legen pro Einheit eine eigene Y-Achse an (erste links, weitere rechts, einheitslose Reihen je eine eigene), die Einheit steht waagerecht unter der Achse.
Details: [SESSION-archive.md](SESSION-archive.md).

## 2026-09-16 — WebSocket als vierter Remote-Transport (SensActCtrl + BrewControl)

`WebSocketTransport` als vierter Remote-Transport neben MQTT, ESP-NOW und Webhook: Hub-Modell, Leaf ist Client, Hub betreibt den Server (Geräteeinstellung). Library `links2004/WebSockets` 2.7.3, gepollt in `loop()`; in SensActCtrl und BrewControl (Einstellungsseite, Remote-Item) umgesetzt.
Details: [SESSION-archive.md](SESSION-archive.md).

## 2026-09-16 — Tar-Upload-Fehler (S2 Mini, LilyGo S3): eingegrenzt, noch nicht HW-verifiziert

Tar-Upload-Fehler auf S2 Mini und LilyGo eingegrenzt: Der `TarExtractor`-Parser ist per nativem Harness als Ursache ausgeschlossen; Verdacht auf Platz bei den LittleFS-Boards bzw. SD-I/O beim LilyGo. Noch nicht am Gerät verifiziert, PLAN.md entsprechend konsolidiert.
Details: [SESSION-archive.md](SESSION-archive.md).

## 2026-09-16 — Remote-Discovery (MQTT + ESP-NOW) + ESP-NOW-Unicast für Befehle

Remote-Discovery („Geräte suchen“) für MQTT und ESP-NOW über Request/Response-Topics, einmal in der Library über `ITransport`. Dazu ESP-NOW-Unicast für Befehle. Retained-Announce mit Last Will wurde verworfen.
Details: [SESSION-archive.md](SESSION-archive.md).

## 2026-09-16 — UI-Tar-Upload auf den 256-KB-LittleFS-Boards (esp32dev, lolin_s2_mini) gefixt

Der UI-Tar-Upload auf esp32dev und lolin_s2_mini crashte, weil `/www.new` neben dem alten `/www` nicht in die 256-KB-Partition passt und esp_littlefs bei vollem Speicher panict (`IntegerDivideByZero` in `lfs_alloc`). Jetzt wird `/www` vor dem Entpacken geleert (eigenes Flag `BREWCTL_ASSETS_IN_PLACE`) und eine eingebettete Notfall-Seite ausgeliefert.
Details: [SESSION-archive.md](SESSION-archive.md).

## 2026-09-16 — UI-Tar-Upload auf dem LilyGo S3 (SD) gefixt: zu wenige offene Dateien

Der Tar-Upload scheiterte auf dem LilyGo, weil die SD nur 5 gleichzeitig offene Dateien erlaubte. `main.cpp` mountet die SD jetzt mit `max_files = 16` (`kSdMaxOpenFiles`); danach gingen 13 von 13 Uploads durch.
Details: [SESSION-archive.md](SESSION-archive.md).

## 2026-09-17 — Remote-Discovery + ESP-NOW-Unicast E2E am Gerät

Discovery und ESP-NOW-Unicast zwischen esp32dev und LOLIN S2 Mini am Gerät getestet: Beide Transporte finden die Items des anderen Boards und schalten Remote-Aktoren korrekt. MQTT ist zuverlässig, ESP-NOW ohne Retry deutlich verlustbehaftet (~1 von 8 Discovery-Scans). Die zugehörigen PLAN.md-Punkte entfielen.
Details: [SESSION-archive.md](SESSION-archive.md).

## 2026-09-17 — Fix: ESP-NOW-Fehleranzeige blieb nach erfolgreicher Zustellung hängen

`EspNowTransport` hielt nur den zuletzt eingetroffenen Zustellstatus, sodass ein später Fehler-Callback eines anderen Pakets einen Erfolg überschrieb. `deliveryErrorMsg_` wird jetzt direkt im Send-Callback gepflegt.
Details: [SESSION-archive.md](SESSION-archive.md).

## 2026-09-17 — Add-Item-Dialog: Discovery herausgelöst + 2-Step-Dialog

Add-Item-Dialog umgebaut: Discovery liegt als eigene „Geräte suchen“-Karte über der Geräteliste (alle Quellen parallel, Treffer öffnen den Dialog vorausgefüllt), der Dialog hat zwei Schritte (`ItemTypePicker` mit Typ-Katalog aus `itemTypes.ts`, dann Felder). Reiner Layout-Umbau.
Details: [SESSION-archive.md](SESSION-archive.md).

## 2026-09-17 — Dashboard-Inhalte-Dialog: Auswahlliste statt Checkbox-Wüste

Der Dashboard-Inhalte-Dialog ist jetzt eine WinUI-artige Auswahlliste mit vollbreiten Zeilen statt Checkbox-Gruppen; die „+ Neues …“-Links sind sichtbar abgesetzt.
Details: [SESSION-archive.md](SESSION-archive.md).

## 2026-09-18 — WebSocket-Autodiscovery per mDNS + Kopplung durch Rückruf

WebSocket-Autodiscovery per mDNS: Die Topologie bleibt, nur die Kopplung erfolgt per Rückruf des Hubs, statt Hub-URL und Remote-Item von Hand einzutragen. `DiscoverDevicesCard` hat zwei Stufen. Keine Library-Änderung; die Hardware-Verifikation (v. a. `.local` in der `hubUrl`) blieb offen.
Details: [SESSION-archive.md](SESSION-archive.md).

## 2026-09-18 — mDNS-Kopplung E2E am Gerät + `self` entfernt

Die mDNS-Kopplung am Gerät verifiziert (esp32dev als Hub, LOLIN S2 Mini als Leaf, LilyGo als Zuschauer in der Suche), nur über HTTP. Dabei wurde der Eintrag `self` aus den Peers entfernt; die Testboards blieben in dieser Konstellation gekoppelt.
Details: [SESSION-archive.md](SESSION-archive.md).

## 2026-09-18 — Captive-Portal-UX angeglichen + Reload-mit-Retry in Preact übernommen

Netzwerkliste im Captive Portal (`WiFiSetupPortal.cpp`) von Hand an `NetworkPage` angeglichen (Liste mit Signalbalken statt `<select>`); gemeinsame SPA-Auslieferung im Portal bewusst verworfen. Der Reload-mit-Retry nach Reboot ist in die Preact-Seiten übernommen. Der Auto-Reconnect-Erfolgsfall wurde nicht E2E getestet.
Details: [SESSION-archive.md](SESSION-archive.md).

## 2026-09-18 — Fix: manueller Firmware-/UI-Upload zeigte weder Erfolg noch Fehler an

Der manuelle Firmware-/UI-Upload in `FirmwarePage.tsx` zeigte weder Erfolg noch Fehler an (Balken verschwand bzw. blieb bei 100 %). Beide Uploads melden jetzt Ergebnis und Fehler; der UI-Paket-Upload braucht laut OpenAPI keinen Neustart.
Details: [SESSION-archive.md](SESSION-archive.md).

## 2026-09-19 — Dashboard: Elemente per Drag & Drop anordnen

Dashboard-Layout als Baum von Bereichen im Dashboard selbst, im Bearbeiten-Modus per Drag & Drop veränderbar (Docking-Bereiche mit ziehbaren Trennern, beliebig viele Kartengruppen, Speicherung am Gerät pro Dashboard). Neu hinzugefügte Karten hängen sich an die letzte Kartengruppe. Escape-Abbruch und Persistenz am Gerät blieben ungeprüft.
Details: [SESSION-archive.md](SESSION-archive.md).

## 2026-09-19 — Dashboard-Layout: Kartenbereiche wachsen nicht mehr ins Leere

Kartenbereiche wuchsen im Layout ins Leere, weil die Bearbeiten-Ansicht (Rahmen, Padding) nicht zur normalen Ansicht passte. Gemessen und angeglichen; das Hinweisfeld verkürzt flexible Bereiche im Bearbeiten-Modus weiterhin um 50 px.
Details: [SESSION-archive.md](SESSION-archive.md).

## 2026-09-20 — Regler-Karten nach Vorlage + frei wählbare Sekundärfarbe

Regler-Karten in drei Größen nach Nutzer-Vorlage (groß, Gauge, kompakt): Soll weiß, Ist in Akzentfarbe, Füllung immer Akzent. Dazu eine frei wählbare Sekundärfarbe in den Darstellungs-Einstellungen.
Details: [SESSION-archive.md](SESSION-archive.md).

## 2026-09-19 — Neue Menü-Seite „Rechner" (Brauprozess-Rechner)

Neue Hauptseite „Rechner“ (`/rechner`) mit 14 Brauprozess-Rechnern in sechs Kategorien. Formeln in `web/src/gravityUnits.ts` und `web/src/brewMath.ts`; `vitest` als erster Test-Runner im Frontend (22 Tests).
Details: [SESSION-archive.md](SESSION-archive.md).

## 2026-09-19 — Rechner: Novotny-Formel korrigiert (Refraktometer/ABV/Endvergärungsgrad)

Die Refraktometer-/ABV-/Endvergärungsgrad-Rechnung wurde an der Excel-Vorlage zur Novotný-Formel (Weiß, V02) überprüft und korrigiert; die alte, aus der Erinnerung geschriebene Variante war falsch.
Details: [SESSION-archive.md](SESSION-archive.md).

## 2026-09-19 — Not-Aus-Funktion (Hauptschalter)

Not-Aus im Nav-Fußbereich (Desktop-Sidebar und mobiler Header): `POST /api/estop` deaktiviert alle Aktoren und pausiert Programme und laufende Timer (`pauseAllRunning()` auf `ProgramRunner`/`TimerStore`). Hardware-Verifikation folgte separat.
Details: [SESSION-archive.md](SESSION-archive.md).

## 2026-09-20 — Fix: leere AutoTune-Trennlinie auf der Regler-Karte

Der AutoTune-Block der `ControllerCard` rendert nur noch bei `running` und `done`; im Zustand `idle` blieb sonst ein leerer Kasten mit Trennlinie.
Details: [SESSION-archive.md](SESSION-archive.md).

## 2026-09-20 — Multi-Channel-Sensoren: Kanäle einzeln anlegen und platzieren

HCSR04 und YF-S201 lassen sich mit Kanalauswahl anlegen (`setChannelMask()`), im Dashboard erscheinen einzelne Kanalkarten statt eines gestapelten Blocks. Vom Nutzer am Gerät bestätigt.
Details: [SESSION-archive.md](SESSION-archive.md).

## 2026-09-20 — Quick-Wins: Notfall-Seite, ConfirmModal, OpenAPI, Kanalbezeichnung

Vier Quick-Wins: `onNotFound` liefert SPA-/Notfall-Seite nur noch für Pfade ohne Dateiendung, `ConfirmModal` mit nebeneinanderliegenden Buttons, `SensorCreate` in OpenAPI korrigiert, `SensorCard` zeigt die Kanalbezeichnung.
Details: [SESSION-archive.md](SESSION-archive.md).

## 2026-09-20 — Persistenz-Verifikation am Gerät: Darstellungsmodi, Layout, Sekundärfarbe

Am esp32dev per OTA bestätigt, dass Darstellungsmodi (`sensorModes`/`controllerModes`/`timerModes`), Layout und Sekundärfarbe einen echten Reboot bytegleich überleben.
Details: [SESSION-archive.md](SESSION-archive.md).

## 2026-09-20 — „Gerät hinzufügen“ als 4-Schritt-Wizard (nach Design-Entwurf)

„Gerät hinzufügen“ ist ein 4-Schritt-Wizard nach Design-Entwurf (neue Hülle `AddItemWizard.tsx` mit `ChoiceCard`, Schrittleiste auf Desktop, Segmentleiste mobil); die typspezifischen Felder bilden Schritt 4.
Details: [SESSION-archive.md](SESSION-archive.md).

## 2026-09-20 — Not-Aus am Gerät verifiziert (esp32dev)

Not-Aus am esp32dev verifiziert: Nach `POST /api/estop` steht der Aktor auf `enabled=false` und `v=0`, obwohl ein Regler weiter `target=1` schreibt; Programm und Timer pausiert. Das Einrasten kam im folgenden Eintrag.
Details: [SESSION-archive.md](SESSION-archive.md).

## 2026-09-20 — Dashboard-Inhalte-Dialog nach Design W1 (ContentDialog)

`DashboardContentModal` im WinUI-Design W1: 720×640-Dialog mit Suche, Kategorie-Tabs, Zusammenfassung mit Delta, Checkbox-Zeilen und „Übernehmen“/„Abbrechen“; mobil horizontale Tab-Leiste.
Details: [SESSION-archive.md](SESSION-archive.md).

## 2026-09-20 — Gruppenkarte für Multi-Channel-Sensoren + gemessene Raster-Spans

Gruppenkarte für Multi-Channel-Sensoren: eine Karte pro logischem Sensor mit einer Zeile je Kanal. Die eigentliche Ursache des Leerraums im Raster waren wirkungslose `row-span-*`-Klassen auf der Karte seit dem Drag-&-Drop-Umbau; die Spans werden jetzt gemessen. Die Verifikation am Gerät stand aus.
Details: [SESSION-archive.md](SESSION-archive.md).

## 2026-09-20 — Not-Aus rastet ein und überlebt den Reboot

Der Not-Aus deaktiviert jetzt auch alle Regler und rastet ein: `estop_` in `WebUI` wird persistiert und überlebt den Reboot, Freigabe geschieht bewusst. Nebenbefund: `POST /api/estop` hat kein `requireAuth`, die OpenAPI-Spec versprach fälschlich ein `401`.
Details: [SESSION-archive.md](SESSION-archive.md).

## 2026-09-20 — Sammel-Commit: Farbvalidierung, `Distance`-Typ, `pio ci`-Flags

Sammel-Commit: Farbvalidierung für `theme.secondary`/`theme.accent` (`isHexColor()`), `Distance` in `Quantity`, C++17-Flags in den `pio ci`-Aufrufen der Beispiele.
Details: [SESSION-archive.md](SESSION-archive.md).

## 2026-09-21 — AnalogInput als Sensortyp in BrewControl

`AnalogInput` als Sensortyp in `DynamicItems.cpp` angebunden (`pin`, Anzeigebereich, `unit`, `resolution`, `smoothing`, optionale Zwei-Punkt-Kalibrierung); in OpenAPI und im Hinzufügen-Dialog ergänzt.
Details: [SESSION-archive.md](SESSION-archive.md).

## 2026-09-21 — Log-Chart: Zoom bleibt bei Live-Updates erhalten

Der Drag-Zoom im Log-Chart bleibt bei Live-Updates stehen (`isZoomed`-Prüfung statt `resetScales=true` in `ChartCard.tsx`).
Details: [SESSION-archive.md](SESSION-archive.md).

## 2026-09-21 — Generische Sensor-Kalibrierung (`CalibratedSensor`)

`CalibratedSensor` als generischer Decorator ersetzt die Einzellösungen (HX711, YF-S201, AnalogInput): `wert = valRef + gain · (roh − rawRef)`. Der Assistent greift den Rohwert live ab (5-s-Mittel), der Nutzer tippt nur die Referenzwerte. Altkeys werden migriert; Tara/Faktor an Wägezelle und YF-S201 blieben offen.
Details: [SESSION-archive.md](SESSION-archive.md).

## 2026-09-21 — Not-Aus: neue Items starten nicht freigegeben

Bei eingerastetem Not-Aus angelegte Aktoren und Regler starten jetzt deaktiviert (Add-Handler in `WebUI.cpp` prüfen `estop_`).
Details: [SESSION-archive.md](SESSION-archive.md).

## 2026-09-21 — Backup: Logs, Programme, Alarme; Push-Abos dokumentiert

`GET /api/backup` enthält zusätzlich `logs`, `programs` und `alarms` (nur Definitionen, ohne Laufzeitzustand; ältere Bündel bleiben importierbar). Push-Abos bleiben draußen, die README erklärt das.
Details: [SESSION-archive.md](SESSION-archive.md).

## 2026-09-22 — BrewControl: Formular-Dialoge mobil als Vollbild

Formular-Dialoge (Timer, Programm, Profil, Log, Alarm, Dashboard-Inhalt, Kalibrierung, Item bearbeiten) sind unter 768 px Vollbild-Sheets, zentral über `dialogScrim`/`dialogSheet` in `web/src/ui.ts`.
Details: [SESSION-archive.md](SESSION-archive.md).

## 2026-09-22 — Spike: LVGL-Display auf dem AMOLED-1.75 (Branch `spike/lvgl-display`)

Machbarkeits-Spike zum interaktiven LVGL-Display auf dem AMOLED-1.75 (Branch `spike/lvgl-display`, nicht gemergt): LVGL 8.4 baut unter GCC 8.4, kostet etwa 349 KB Flash und 51 KB RAM, LilyGos vendored Arduino_GFX-Fork 1.3.7 ist der Treiber-Weg, PSRAM reicht. Kritischer Befund: Der `loop()`-Takt hat Ausreißer bis ~220 ms, verursacht vom Bit-Bang des `IdsActuator`, unabhängig vom Display.
Details: [SESSION-archive.md](SESSION-archive.md).

## 2026-09-22 — Multi-Point-Kalibrierung (Polynom-Fit) für `CalibratedSensor`

Vierter Kalibriermodus `poly` für `CalibratedSensor`: Ausgleichspolynom vom Grad 1–3 durch bis zu acht Stützpunkte, durchgängig von der Library über die HTTP-API bis in den Kalibrier-Dialog (Anlass: Tilt-Hydrometer nach iSpindel-Vorbild). Ohne externe Fit-Bibliothek; die linearen Modi bleiben unverändert.
Details: [SESSION-archive.md](SESSION-archive.md).

## 2026-09-23 — GY-521/MPU-6050 als Tilt-Hydrometer-Sensor

GY-521 (MPU-6050) als Tilt-Hydrometer: `GY521Sensor` liefert die rohen sechs Achsen, `GY521TiltSensor` leitet den Winkel ab (Komposition statt Vererbung), kalibrierbar gegen Stammwürze/SG.
Details: [SESSION-archive.md](SESSION-archive.md).

## 2026-09-23 — Anzeigename (Label) für Registry-Items + entkoppeltes Umbenennen

Registry-Items haben ein frei editierbares Anzeigename-Label, getrennt vom stabilen `id()` (`Registry::setLabel/label` in SensActCtrl, Feld im Hinzufügen-Dialog). Umbenennen hängt damit nicht mehr am Delete+Recreate-Pfad und dessen Regler-Referenz-Blockade (kein `405` mehr). Das Verhalten am Gerät blieb ungeprüft.
Details: [SESSION-archive.md](SESSION-archive.md).

## 2026-09-23 — IdsInductionCooker: eine Quelle statt drei

Änderungen am lokalen IdsInductionCooker-Checkout kamen nie in der Firmware an, weil die Library über den Symlink und zusätzlich per Git-SHA in `library.json` eingebunden war und der Linker die gepinnte Kopie bevorzugte. Der Symlink ist entfernt, `SensActCtrl/library.json` die einzige Quelle; jetzt kompiliert genau ein `IdsCooker.cpp.o`.
Details: [SESSION-archive.md](SESSION-archive.md).

## 2026-09-23 — IDS-Keep-Alive: Bit-Bang raus, RMT rein

`IdsCooker::sendCommand()` sendet den Frame statt per Bit-Bang (zweimal pro Sekunde Blockade des loopTask) als 34 `rmt_data_t`-Items über die RMT-Peripherie und kehrt sofort zurück. Am esp32dev gemessen; der Umbau ist zugleich eine Korrektheitsreparatur (u. a. fehlender Destruktor des `IdsCooker`). Nebenbefund: Unter parallelen Datei-Downloads wird der ganze `loop()` langsam.
Details: [SESSION-archive.md](SESSION-archive.md).

## 2026-09-23 — IDS-Induktionskocher: E2E mit der echten Platte

IDS-Induktionskocher E2E mit der echten Platte am esp32dev (Optokoppler an Weiß 16 / Gelb 17 / Interrupt 23): Relais schaltet, die Platte folgt den Stufen, `fault: null`. Drei Defekte im Empfangspfad wurden gefunden und behoben, das Startfenster vorbeugend geweitet.
Details: [SESSION-archive.md](SESSION-archive.md).

## 2026-09-23/24 — Interaktives Display auf dem AMOLED-1.75, Stufe 1 (Branch `feature/lvgl-display`)

Interaktives Display auf dem AMOLED-1.75, Stufe 1 (aus dem Spike, Branch `feature/lvgl-display`): LilyGos Arduino_GFX-Fork 1.3.7 als Panel-Treiber, SensorLib für den Touch, eine Wischseite pro Item (Regler, dann Sensoren), `lv_timer_handler()` aus `loop()`. Am Gerät mit dem Nutzer abgenommen; Burn-in-Schutz und weitere Punkte blieben in PLAN.md.
Details: [SESSION-archive.md](SESSION-archive.md).

## 2026-09-24 — IDS-Library: Fehlerpfad, Leistungsmischung, Idempotenz

IDS-Library, vier Punkte: Ein Fehlercode ≠ 0 kappte den ganzen Kommandokanal in `Update()`, die Leistungsmischung rechnete mit dem Raster der IDS2, `Init()` war nicht idempotent. Zwei davon am realen Gerät gemessen; der geplante Topf-Test fiel aus.
Details: [SESSION-archive.md](SESSION-archive.md).

## 2026-09-25 — IDS: Interrupt pro Instanz, und Fehlercode 1 eingegrenzt

IDS-Interrupt pro Instanz (`attachInterruptArg()` statt globalem Zeiger `staticInduction`), damit mehrere Platten pro Gerät möglich sind. Fehlercode 1 eingegrenzt: Auslöser ist das Relais. Der Mehr-Platten-Fall selbst blieb mangels zweiter Platte ungeprüft.
Details: [SESSION-archive.md](SESSION-archive.md).

## 2026-09-25 — IDS-Fehlercodes entprellt; kleine Punkte abgeräumt

IDS-Fehlercode 1 ist ein Anlaufzustand (~0,9 s nach Relais-Schließen, 0,3–0,9 s lang) und wird nicht mehr gemeldet; die Entprellung sitzt auf Frame-Ebene. Dazu kleinere Punkte abgeräumt, der Messaufbau war zwischendurch umgezogen.
Details: [SESSION-archive.md](SESSION-archive.md).

## 2026-09-25 — Burn-in-Schutz fürs AMOLED (Branch `feature/display-burnin`)

Burn-in-Schutz fürs AMOLED (Branch `feature/display-burnin`): neue Einstellungssektion `display` (`brightness`, `dimAfterSec`, `dimPercent`, `offAfterSec`, `pixelShift`, read-only `supported`), die live wirkt. In der Abnahme ging das Wischen aus Schwarz durch, das wurde behoben.
Details: [SESSION-archive.md](SESSION-archive.md).

## 2026-09-25 — WebSocket-Hub: `/set` und `/tune` gezielt statt Broadcast

`WebSocketTransport` (Server) merkt sich pro Client-Slot das `<device>` und schickt `/set` und `/tune` nur an diesen Slot (Broadcast, wenn unbekannt). 273 native Tests grün, am Gerät nicht geprüft.
Details: [SESSION-archive.md](SESSION-archive.md).

## 2026-09-26 — `loop()` unter Datei-Downloads: AsyncTCP auf Core 0, Watchdog auf dem loopTask

Unter parallelen Datei-Downloads wurde `loop()` insgesamt langsam: AsyncTCP lief ohne Core-Bindung auf Core 1 und hungerte den loopTask aus (H1 bestätigt, LittleFS-Cache nur klein). Fix: `-DCONFIG_ASYNC_TCP_RUNNING_CORE=0` und ein Watchdog auf dem loopTask. Nachtrag: erstes Release `v0.1.0` und OTA-Pull am LilyGo.
Details: [SESSION-archive.md](SESSION-archive.md).

## 2026-09-26 — Pin-Manager Stufe 1 und Bearbeiten per PUT (Branch `feature/pin-manager`)

Pin-Manager Stufe 1 (Branch `feature/pin-manager`): `BoardPins.h` mit Pin-Tabelle je Board und Klassen wie `free` und `risky`, Konfliktprüfung beim Anlegen, dazu Bearbeiten von Items per `PUT`. Anlass waren Pin-Konflikte am LilyGo; eine Registry-Sperre kam als Nachtrag.
Details: [SESSION-archive.md](SESSION-archive.md).

## 2026-09-26 — „Installieren“ auf allen Boards: nur `.gz` im Release, Update-Modus beim Boot

„Installieren“ auf den 256-KB-Boards: Das Release-`webui.tar` enthält nur noch die `.gz`-Dateien (`pnpm build:sd` / `scripts/gzip-dist.js`), und `doInstall()` läuft im Update-Modus beim Boot (Kanal in NVS), damit TLS-Speicher und Platz reichen. Auf allen Boards bis `v0.1.1` verifiziert.
Details: [SESSION-archive.md](SESSION-archive.md).

## 2026-09-26 — Alert bei ungeplantem Neustart

Neue Alarm-Art `system`: Bei ungeplantem Neustart (`panic`, `int_wdt`, `task_wdt`, `wdt`, `brownout`) erzeugt `AlarmStore::onUnexpectedReset()` einen kritischen Alert, der wegen Push erst nach NTP-Sync (oder nach 2 min) ausgelöst wird.
Details: [SESSION-archive.md](SESSION-archive.md).

## 2026-09-26 — RMT-Fallback der IDS-Platte wird gemeldet

Die IDS-Library meldet über `rmtFallback()`, wenn kein RMT-Kanal frei war und das Software-Timing (~139 ms Blockade je Frame) greift; `IdsActuator::fault()` zeigt das an. SHA in `library.json` gebumpt, am Gerät nicht geprüft.
Details: [SESSION-archive.md](SESSION-archive.md).

## 2026-09-27 — Heap-Fresser: Messung mit `GET /api/diag/heap` (Branch `feat/heap-diag`)

`GET /api/diag/heap` (Branch `feat/heap-diag`) misst interner Heap, PSRAM, Heap nach jedem `setup()`-Block und Stack-Reserven. Befund: „Auf Updates prüfen“ scheiterte auf den S2 an TLS-Speicher; `tlsAllocToPsram()` in `main.cpp` löst das (12 von 12 Prüfungen erfolgreich).
Details: [SESSION-archive.md](SESSION-archive.md).

## 2026-09-27 — Pin-Manager Stufe 2: Fähigkeiten der Pins (ADC, Pull-up, Interrupt)

Pin-Manager Stufe 2: Fähigkeiten der Pins (ADC, Pull-up, Interrupt) werden geprüft, damit z. B. `analogRead` auf ADC2 oder `INPUT_PULLUP` auf GPIO 34–39 nicht still falsche Werte liefert.
Details: [SESSION-archive.md](SESSION-archive.md).

## 2026-09-27 — Peripherie-Abstraktion Etappe 1: PeripheralRegistry für OneWire und SPI

Peripherie-Abstraktion Etappe 1: `PeripheralRegistry` (header-only, in der Firmware) verwaltet geteilte OneWire- und SPI-Busse mit Aufbau und Abbau nach Bedarf; `GET /api/bus/scan` läuft unter dem Registry-Lock. 68 native Tests, am Gerät mit DS18B20 verifiziert.
Details: [SESSION-archive.md](SESSION-archive.md).

## 2026-09-27 — Pin-Manager Stufe 3a: Pins vorschlagen (Branch `feature/pin-manager-3a`)

Pin-Manager Stufe 3a (Branch `feature/pin-manager-3a`): Das Item-Formular schlägt pro Pin-Feld passende GPIOs vor (`suggestPins()` in `web/src/pins.ts`), freie zuerst, bestehende Busse bevorzugt. Reines Frontend, nicht am Board geprüft.
Details: [SESSION-archive.md](SESSION-archive.md).

## 2026-09-27 — Firmware-Update-Seite: Layout + neue Systemstatus-Seite

Firmware-Seite umgebaut (Hinweiskarte, Release-Kanal, `lastCheckedAt`); der Neustart-Grund zog auf eine neue Seite `/settings/system` (Systemstatus mit Board-Infos, Version, Betriebszeit, Speicherbelegung).
Details: [SESSION-archive.md](SESSION-archive.md).

## 2026-09-29 — Peripherie-Abstraktion Etappe 2: I²C-Bus, SDA/SCL-Pinbelegung und Adresskonflikt-Prüfung

Peripherie-Abstraktion Etappe 2: I²C-Bus in der `PeripheralRegistry`, SDA/SCL je Board in `BoardPins.h`, Adresskonflikt-Prüfung über `I2cAddressMap.h` (inklusive RTC/Touch/PMU des LilyGo). Hardware-Verifikation am LilyGo stand aus.
Details: [SESSION-archive.md](SESSION-archive.md).

## 2026-09-30 — Bus-Schnittstellen: zentral definierte Busse + Settings-Seite

Zentral definierte Busse und eine Settings-Seite für alle Bus-Schnittstellen (`BusConfig.h`): I²C, OneWire, SPI mit umkonfigurierbaren Pins. Alte Items werden beim ersten Boot migriert, am LilyGo mit zweitem I²C-Bus (`Wire1`) geprüft. Zwei Befunde gingen nach PLAN.md (GY521 ohne Gerät, einmaliger `task_wdt`).
Details: [SESSION-archive.md](SESSION-archive.md).

## 2026-09-29 — Energiemanagement Stufe 1: Einstellungsseite + Batteriequelle

Energiemanagement Stufe 1: Seite `/settings/energy` mit Batteriequelle als normalem Sensor-Item (`energy.batterySensor` in `SettingsStore`), Statuszeile mit Spannung und grobem LiPo-Prozentwert. Gesamtplan in `docs/superpowers/plans/2026-09-29-energiemanagement.md`.
Details: [SESSION-archive.md](SESSION-archive.md).

## 2026-09-30 — Zustand nach Neustart: Regler und Aktoren kommen zurück (Branch `feature/zustand-neustart`)

Regler und Aktoren kommen nach einem Neustart im zuletzt gültigen Zustand zurück (`RuntimeState` in `/config/state.json`, Format wie die Programm-`targets`). Vorarbeit für Deep-Sleep, bei dem jedes Aufwachen ein Neustart ist.
Details: [SESSION-archive.md](SESSION-archive.md).

## 2026-09-30 — Energiemanagement Stufe 2: Deep-Sleep (Branch `feature/deep-sleep`)

Energiemanagement Stufe 2: Deep-Sleep zwischen zwei Messungen (`deepSleep`, `sleepIntervalSec`, `wakePin`, `awakeTimeoutSec`, `shortWakeWifi`; `wakeCause` im GET), Logik in `WakeMode.h`. Das Kurz-Wach-Profil beschränkt sich auf den WLAN-Schalter.
Details: [SESSION-archive.md](SESSION-archive.md).

## 2026-10-01 — MQTT-Verbindungsaufbau blockiert `loop()` nicht mehr (Branch `fix/mqtt-connect-nonblocking`)

**Root Cause:** `SensActCtrl::MqttTransport::tick()` rief bei getrennter Verbindung
`PubSubClient::connect()` synchron auf. Dazu gehören Namensauflösung (`hostByName`, im Core 2.x bis
15 s, bei `.local` ~7 s), TCP-Connect, ggf. TLS und das Warten auf CONNACK. BrewControl ruft das aus
`loop()` → `tickTransports()` unter dem `RegistryLock`. Bei unerreichbarem Broker stand der loopTask
deshalb alle ~30 s (Backoff-Maximum) für mehrere Sekunden: gesperrte REST-Routen antworteten 503,
Regler und TPO-Ausgänge wurden so lange nicht getickt, und ein Kurz-Wach mit WLAN dauerte ~18 s.

**Umsetzung (nur Library):** Der Connect läuft in einem kurzlebigen FreeRTOS-Task (`mqttConnect`,
8 KB Stack für TLS, löscht sich am Ende selbst). Ein atomares `phase_` (Idle/Connecting/Done) regelt
die Übergabe: Während des Connects fasst nur der Task den `PubSubClient` an, `tick()` kehrt sofort
zurück, `publish()` liefert `false`, `subscribe()` merkt nur vor. Im `Done`-Zustand holt `tick()` die
Abos nach und setzt den Backoff. Der zählt jetzt ab dem **Ende** des Versuchs. `connected()` und
`lastErrorMessage()` lesen gecachte Atomics, damit ist der Lesezugriff aus `GET /api/settings`
(AsyncTCP-Task) nebenbei threadsicher. In BrewControl hat sich nur ein Kommentar in `main.cpp`
geändert; dazu kommt `SensActCtrl/README.md`.

**Verifikation:** SensActCtrl `pio test -e native` 283/283, Firmware `pio test -e native` 99/99,
`pio run` für esp32dev, lolin_s2_mini und LilyGo grün. Am `brewcontrol-esp32dev` (Items: DS18B20 ohne
Fühler, GY521, WebSocket-Remote `lolin_wstest`) mit dem Broker-Host `brewcontrol-gibtsnicht.local`
jeweils 90 s Label-Schreiben im 0,5-s-Takt, dazu `sensors[adc_test].state.t` aus dem Snapshot:
- **alte Firmware:** 6 von 70 Antworten 503, Sensorwert stand bis 6,5 s;
- **neue Firmware (OTA):** 89 von 89 Antworten 204, Sensorwert stand höchstens 1,5 s (Messtakt).
- Heap: Der Connect-Task belegt kurz ~8,7 KB und gibt sie wieder frei, kein Drift über eine Minute.
- Positivfall gegen den eingebetteten Broker des LilyGo: Verbindung steht, ein `/set` auf `dac_test`
  über MQTT wirkt. Nach einem Neustart des LilyGo (Broker ohne Abos) verbindet sich das esp32dev
  wieder, und ein neues `/set` wirkt ebenfalls. Damit ist belegt, dass die Abos nachgeholt werden.
- Danach Broker-Host wieder `brewcontrol.local`, `dac_test` 0.

**Nicht gemessen:** die Dauer eines Kurz-Wachs mit WLAN bei unerreichbarem Broker. Der loopTask
blockiert dort nicht mehr; das Kurz-Wach wartet aber weiterhin bis zum Limit von `shortWakeCourse` auf
die Verbindung. WebSocket-Client und Webhook-POST laufen weiterhin synchron unter dem Lock, in der
Messung trugen sie aber nichts bei.

## 2026-10-02 — SD-Lesezugriffe von Downloads und UI-Auslieferung unter `SdLock` (Branch `fix/sd-download-lock`)

**Root Cause:** Vier Stellen lasen Dateien über die Bordmittel von ESPAsyncWebServer, alle ohne die globale
SD-Sperre: `GET /api/files/download`, `GET /api/logs/{id}/download|data`, der SPA-Fallback
(`req->send(fs_, …)` → `AsyncFileResponse`) und `serveStatic()`. `serveStatic()` öffnet die Datei schon beim
Routing (`canHandle`), liest dann für den ETag und überträgt die Datei stückweise in `_fillBuffer`. Alles davon
lief im AsyncTCP-Task, während der loopTask Logs und Configs schreibt. `SdLock.h` beschreibt genau diesen Fall:
Der SD-Treiber korrumpiert dabei still. Beim Spike vom 2026-09-26 endete das zweimal im Watchdog, danach ließ
sich die Karte erst nach einem Stromlos-Zyklus wieder einhängen.

**Umsetzung (`WebUI.cpp/.h`):** Neuer Helfer `WebUI::sendFile_()`. Er öffnet die Datei unter `SdLock` (`.gz`
zuerst, dann mit `Content-Encoding: gzip`) und antwortet über `req->beginResponse(type, len, filler)`. Der
Filler nimmt für jedes gelesene Stück `SdLock`. Die Datei hängt an einem `shared_ptr<LockedFile>`, dessen
Destruktor gesperrt schließt, sobald die Response freigegeben wird. Optional setzt er `Cache-Control` sowie
einen ETag aus `lastWrite` bzw. Größe und antwortet bei passendem `If-None-Match` mit 304. Alle vier Stellen
nutzen ihn. `serveStatic()` ist entfernt, die statische Auslieferung aus `/www` übernimmt `onNotFound` vor dem
bestehenden SPA-Fallback. Pfade mit `..` werden dort nicht ausgeliefert, `serveStatic()` hatte dafür keine
Prüfung. Der Content-Type kommt aus einer kleinen Endungstabelle (JS wie bisher `text/javascript`). Die API
bleibt unverändert, also keine Änderung an `openapi.yaml`. Einzige sichtbare Folge: Die ETags der `.gz`-Assets
werden einmalig neu berechnet (vorher CRC aus dem gzip-Trailer, jetzt `lastWrite`).

**Verifikation:** `pio run` für esp32dev, lolin_s2_mini und LilyGo grün.
- **LilyGo (SD), per OTA:** Mit der alten Firmware vorher Referenzantworten gezogen. JS-Bundle (statisch und
  per Datei-Download), `/`, die SPA-Route `/rechner` und der Log-Download sind byte-identisch (das Log nur bis
  zur alten Länge, es wächst weiter). Header geprüft: gzip-Encoding, `Cache-Control`, ETag, Content-Type,
  `attachment`. 304 bei passendem ETag; 404 für fehlendes Asset, fehlende Datei, Verzeichnis und
  `/../config/settings.json` (`--path-as-is`).
- **Lasttest:** Ein temporäres Log mit 1-s-Intervall ohne Kompression ließ den loopTask jede Sekunde auf die SD
  schreiben. Parallel liefen zwei Download-Schleifen (statisch und Datei-Download) plus ein SSE-Client über
  3 min. Ergebnis: 350 von 350 Downloads mit korrekter Prüfsumme, 204 Logzeilen ohne Lücke über 2 s, kein
  Neustart (`resetReason` blieb `sw`), Snapshot höchstens 2,2 s ohne neuen Messwert. Test-Log samt Verzeichnis
  danach gelöscht.
- **esp32dev (LittleFS), per OTA:** JS-Bundle, `/` und SPA-Route byte-identisch, 404 für fehlendes Asset.

## 2026-10-03 — GY521/BME280 ohne Gerät: ungültig statt Fantasiewerte (Branch `fix/gy521-no-device`)

**Root Cause:** `GY521Sensor::begin()` und `BME280Sensor::begin()` ignorierten den Rückgabewert des Treibers und
setzten `initialized_` immer. `tick()` las danach blind weiter und markierte das Ergebnis als gültig. Ein
Modul auf einer Adresse ohne Gerät lieferte so Werte aus einem uninitialisierten Stack-Puffer (am LilyGo
26–29 bzw. −48…−140 °) mit `ok: true`. Ein Abziehen im Betrieb blieb ebenfalls unbemerkt. Die Treiber helfen dabei
nicht: `Adafruit_MPU6050::getEvent()` gibt immer `true` zurück, `Adafruit_BME280::read24()` wertet I²C-Fehler nicht aus.
`GY521TiltSensor` hatte das Muster nicht selbst, ließ aber bei ungültigem Rohsensor den alten Winkel stehen.

**Umsetzung (SensActCtrl):** `GY521Sensor` und `BME280Sensor` merken das `begin()`-Ergebnis. Schlägt es fehl, versucht
`tick()` es alle 5 s erneut (`kRetryIntervalMs`, Vergleich über `int32_t`-Differenz, überlauffest). Bis dahin
bleiben alle Kanäle ungültig. Läuft das Modul, prüft jeder `tick()` vorab per Adress-Probe
(`beginTransmission`/`endTransmission` auf dem Bus des Sensors), ob es noch antwortet. Wenn nicht, werden die Kanäle
ungültig und der Retry beginnt. Der BME280 verwirft zusätzlich NaN-Messwerte. `GY521TiltSensor` setzt den Winkel
auf ungültig und den Filter zurück (nächster Winkel startet wieder aus der Beschleunigung). Die Probe dauert bei
vorhandenem Gerät Mikrosekunden, bei fehlendem ein NACK. Nur ein hängender Bus (keine Pull-ups) könnte bis zum
Wire-Timeout (50 ms) stehen, dann aber höchstens alle 5 s. Der native Stub bekommt Hooks
(`SensActCtrlTest::gy521Present/gy521NowMs`, `bme280Present/bme280NowMs`) für „Modul da/weg" und die Uhr. Die
API bleibt unverändert (keine Änderung an `openapi.yaml`), sichtbar ist nur `ok:false` statt falscher Werte.

**Verifikation:** Neue native Tests (vorher rot: kein Gerät, später angesteckt, abgezogen, wieder angesteckt, Retry
nicht bei jedem Tick; je für GY521, Tilt und BME280). `SensActCtrl` `pio test -e native` 294/294, `BrewControl/firmware`
`pio test -e native` 99/99, `pio run` für esp32dev, lolin_s2_mini und LilyGo grün.
- **LilyGo, per OTA, echter GY-521 (0x68 am Board-Bus):** Modul dran → Winkel gültig (≈ −1 °). GY521 auf 0x69 (ohne
  Gerät) → `ok:false`, bleibt es; danach gelöscht. Modul beim Start fehlend → `ok:false`, nach dem Anstecken läuft es
  ohne Neustart von selbst an. SDA im Betrieb abgezogen → sofort `ok:false`, Board läuft weiter.
- Beim Abziehen des ganzen Moduls startete das Board neu (`resetReason: power_on`, also Stromunterbrechung, nicht die
  Firmware).

## 2026-10-03 — GY-521 als Mehrkanal-Sensor (Branch `feat/gy521-channels`)

Umsetzung des PLAN.md-Backlog-Punkts: Ein GY521-Item hat jetzt einzeln wählbare Kanäle nach dem Muster von
YF-S201/HC-SR04. Unterwegs ist ein Fehler im Neigungsfilter aufgefallen und behoben worden.

**Entscheidungen** (mit dem Nutzer, teils im Lauf der Umsetzung revidiert):
- **Ein Sensor-Objekt:** `GY521TiltSensor` bekommt eine Kanalmaske und reicht die Rohkanäle seines eigenen
  `GY521Sensor`-Members durch, pro Tick bleibt es ein I²C-Zugriff. Zwei Item-Typen auf demselben Chip scheiterten
  ohnehin an der I²C-Adressprüfung.
- **Kanäle**, in dieser Reihenfolge (16-Bit-Maske):
  - `pitch`: Drehung um Y, die Neigung der X-Achse gegen die Waagerechte, −90…90°.
  - `roll`: Drehung um X, dasselbe für die Y-Achse.
  - `tilt`: Neigung der Z-Achse gegen die Senkrechte, 0…180°, unabhängig von der Kipprichtung; das ist die
    iSpindel-Größe.
  - `temp`: Chip-Temperatur in °C, liest einige Grad über Raumtemperatur.
  - `ax`/`ay`/`az` in g, `gx`/`gy`/`gz` in °/s.

  Einen Gierwinkel (Drehung um Z) gibt es nicht: Die Schwerkraft ändert sich dabei nicht, nur das Integral von `gz`
  bliebe, und das driftet. Als Kanal für Sensoren mit Magnetometer steht er im PLAN.md-Backlog. Zunächst war ein
  einzelner Winkel `angle` umgesetzt; als der Nutzer die Winkel um die anderen Achsen wollte, wurde daraus
  `pitch`/`roll`/`tilt`.
- **Alle Kanäle sind benannt** (`<id>.<key>`), statt den Winkel als Basiskanal unter der nackten ID zu lassen.
  Bestands-Referenzen werden dafür migriert. Physisch ist `pitch` Kanal 0, so wie der Winkel früher.
- **Fehlt `channels`, ist nur `pitch` aktiv**, die bisherige Bedeutung von GY521. Das ist bewusst anders als bei
  YF-S201/HC-SR04.
- **Kalibrierung bleibt bei `kMaxChannels = 4`.** Kurz war 8 umgesetzt; der Nutzer hat das verworfen, weil die Rohachsen
  keine Kalibrierung brauchen. Der Filter rechnet ohnehin mit den unkalibrierten Werten, eine Kalibrierung von `ax`
  verschöbe also nur die Anzeige. Deshalb stehen Winkel und `temp` vorn und sind bei jeder Auswahl kalibrierbar.
  Jede Checkbox bleibt einzeln wählbar.

**Filter-Fehler (Root Cause):**
- Der Beschleunigungswinkel `atan2(−ax, √(ay²+az²))` beschreibt eine Drehung um Y, integriert wurde aber die Drehrate
  um X (`gx`). Beim Kippen um Y folgte der Winkel deshalb nur über den 2-%-Beschleunigungsanteil, und eine Drehung um X
  verfälschte ihn.
- Außerdem integrierte der Filter den Nullpunkt-Versatz des Kreisels (am LilyGo ≈ 2 °/s) mit. Das ergab einen
  dauerhaften Fehler von Versatz × Zeitkonstante, gemessen +1,2°.
- **Fix:** `pitch` integriert `gy`, `roll` integriert `gx`. Der Filter arbeitet mit einer festen Zeitkonstante
  (`kTauS` 0,5 s, `alpha` aus `dt`) statt mit einem festen Faktor pro Tick. Ein Integralanteil (`kBiasGain` 0,1/s²)
  lernt den Versatz in ≈ 20 s. Bei einem Ausfall des Moduls werden die gelernten Versätze verworfen.

**Snapshot-Größe** (vorab gerechnet, am Gerät gemessen): Der LilyGo hatte 1552 B. Gerechnet waren ≈ 155–165 B je
Kanal im ungünstigsten Fall. Gemessen sind es mit allen zehn GY521-Kanälen 2965 B, die Kanäle selbst 1561 B, also
≈ 1,2 KB Luft bis `kSnapshotCap` (4160 B). Ein voller GY521 passt auf jedem Board, zwei lassen kaum Platz für den
Rest (in `openapi.yaml` vermerkt).

**Umsetzung:**
- **SensActCtrl:**
  - `GY521Sensor` liest die Temperatur aus `getEvent()` als siebten Kanal `temp`.
  - `GY521TiltSensor` mit `kChannelPitch … kChannelGz` und `setChannelMask(uint16_t)`; alle Winkel werden immer
    berechnet. Filter wie oben.
  - Der native Stub nimmt Beschleunigung und Drehrate per Test-Hook (`gy521AccelG`, `gy521GyroDps`).
  - Library-README nachgezogen.
- **Firmware:**
  - Neuer Header `SensorChannels.h` (Arduino-frei, nativ getestet) mit einem `parseChannelMask` für beliebig viele
    Keys (YF-S201/HC-SR04 verhalten sich gleich), `normalizeLegacyGy521` und `renameRefs`/`renameLogRefs`.
  - **Migration in `DynamicItems::loadFromSD`:** Ein GY521 ohne `channels` bekommt `["pitch"]`, eine Kalibrierung auf
    `channel: ""` wandert nach `pitch`. Noch bevor die übrigen Stores laden, werden exakte Treffer `sensor/<id>` in
    `logs.json`, `alarms.json`, `programs.json` und `profiles.json` zu `sensor/<id>.pitch`. Ein Log mit geänderter
    Serie beginnt eine neue CSV, weil das Chart Live-Werte über den CSV-Kopf auflöst; alte Sessions behalten ihren
    Kopf. `registry.json` wird zuletzt geschrieben, ein Absturz dazwischen wiederholt die idempotente Umbenennung.
  - Unverändert bleiben Dashboards (`sensor/<id>` heißt dort „ganzer Sensor“) und Regler (nackte ID, lesen
    `channel(0)` = `pitch`). Das MQTT-Topic wird `…/sensor/<id>/pitch`; kein Board abonniert es (geprüft).
  - `openapi.yaml`: Kanäle, Migration, geänderte Winkel-Kennlinie (eine vorhandene poly-Kalibrierung neu machen),
    Snapshot-Größe, Kalibrierbarkeit.
- **Web:** Zehn Checkboxen, gruppiert in Winkel (um Y / um X / gesamt), Beschleunigung, Drehrate und Temperatur.
  Gesendet wird in Firmware-Reihenfolge. Ein Bestandsitem ohne `channels` zeigt nur `pitch`.

**Verifikation:**
- **Tests und Builds:**
  - SensActCtrl `pio test -e native` 304/304. Neu: Kanalform und Maske, Vorzeichen von `pitch`/`roll`/`tilt` bei
    ±30°-Drehungen, `tilt` bis 180°, Kreiselachse je Winkel, Lernen des Versatzes, 4er-Kalibriergrenze.
  - Firmware `pio test -e native` 108/108 (+9 `test_sensor_channels`).
  - `pio run` für esp32dev, lolin_s2_mini und LilyGo grün, Redocly-Lint ohne neue Warnung.
  - Web: `pnpm typecheck`, `pnpm test` 62/62, `pnpm build`.
- **LilyGo (OTA, echter GY-521 am `i2c-board`), Migration:**
  - Ein Backup mit Legacy-`gyro` wurde zurückgespielt, mit Kalibrierung auf `""` und `sensor/gyro` in Log, Alarm,
    Programm und Profil.
  - Nach dem Boot steht überall `gyro.pitch`, die Kalibrierung liegt unter `pitch`. Das Log hat eine neue Session,
    das Dashboard ist unverändert (die Karte heißt jetzt „gyro.pitch“). Ein Neustart migriert nichts erneut.
  - Das erste Branch-Zwischenstadium (`gyro.angle`) wurde am Gerät genauso geprüft, einschließlich Reboot-Persistenz.
- **LilyGo, Display:** Die Gruppenseite zeigt alle zehn Zeilen; die oberste ragt am runden Rand ins Titel-Label
  (in PLAN.md, vom Nutzer als unkritisch eingestuft).
- **LilyGo, Kanäle:** Per Formular alle zehn gewählt; die Gruppenkarte zeigt sie, kalibrierbar sind genau
  `pitch`/`roll`/`tilt`/`temp`.
- **LilyGo, Versatz-Schätzung:** Flach nach einer Minute liegen `pitch`/`roll` ±0,1° am reinen Beschleunigungswinkel,
  vorher waren es konstant +1,2°.
- **Kipplagen** (vom Nutzer gestellt; Abweichungen von ±90/180 aus den Nullpunkt-Fehlern des Beschleunigungssensors,
  az 0,96 g flach, und schräg aufliegendem Modul):

  | Lage | `pitch` | `roll` | `tilt` |
  |---|---|---|---|
  | lange Kante | 86,6 | −1,2 | 93,0 |
  | kurze Kante | −3,4 | −83,5 | 95,5 |
  | kopfüber | −6,6 | 1,8 | 173,5 |

- **Langsames Kippen, mit 5 Hz aufgezeichnet:** `pitch` steigt mit rund 10 °/s bei `gy` +7…+10 °/s, `roll` fällt bei
  negativem `gx`. Die gefilterten Winkel liegen während der Bewegung ±1–3° am Beschleunigungswinkel; das
  Kreisel-Vorzeichen stimmt.
- **Nebenbefund:** Der Nutzer hatte zwischendurch den Test-Offset (+10° auf den Winkel) neu kalibriert. Er wurde dabei
  bei −2,5° Lage aufgenommen und verschob die Anzeige. Das war kein Fehler; der Offset ist inzwischen entfernt.

**Neu in PLAN.md:**
- „Regler können keine Kanal-ID `<id>.<key>` als Eingang nutzen“: bestand schon, betrifft durch die Migration jetzt auch
  GY521-Regler.
- „Gierwinkel für IMUs mit Magnetometer“.
- Der Tilt-Punkt ist auf das Offene reduziert: Einbaulage im Schwimmkörper und SG-Kalibrierung.

**Einschränkung:** Wie bei der Bus-Migration versteht ältere Firmware die migrierten Configs nicht mehr. Vor einem
Downgrade das Backup von vorher einspielen.

## 2026-10-03 — Dashboard-Sensorkarten mit Kanalauswahl (Branch `feat/dashboard-sensor-channels`)

Nutzerwunsch nach dem GY-521-Umbau: Im Dialog „Widgets zum Dashboard hinzufügen“ stand jeder Kanal eines
Mehrkanal-Sensors als eigene Zeile, beim GY-521 also elf Zeilen mit Gruppenkarte. Außerdem gab es pro Sensor höchstens
eine Gruppenkarte, und die zeigte immer alle Kanäle.

**Entscheidungen** (mit dem Nutzer):
- Pro Sensor gibt es im Dialog einen Eintrag. Beim Hinzufügen wählt man die Kanäle der Karte.
- Der Dialog dient nur noch zum Hinzufügen und bildet den Zustand des Dashboards nicht ab: Jeder Eintrag (alle
  Kategorien) hat einen Button „Hinzufügen“, Checkboxen und „x von y“-Zähler sind weg. Entfernt wird per × an der
  Karte. Was es pro Dashboard nur einmal gibt und schon drauf ist, steht ausgegraut als „Auf dem Dashboard“ da.
  Ein erster Entwurf mit aufklappbarer Kartenliste je Sensor wurde vom Nutzer verworfen.
- Ein Sensor darf mehrmals auf einem Dashboard stehen, jede Karte mit eigener Auswahl (z. B. Winkel und Beschleunigung).
- Nachträglich geändert wird die Auswahl über den Stift der Karte. „Sensor bearbeiten“ bekommt dafür einen eigenen
  Abschnitt „Auf dieser Karte anzeigen“, getrennt von den Kanälen, die der Sensor misst; die gelten für alle Dashboards,
  Logs und Alarme.

**Datenmodell, ohne neues Feld und ohne Migration:**
- `dashboard.sensors` bleibt ein String-Array, ein Eintrag ist eine Karte.
  - `gyro`: alle Kanäle, auch künftige.
  - `gyro.pitch`: ein Kanal.
  - `gyro.pitch,roll,tilt` (neu): diese Kanäle.
- Die Keys stehen in Kanalreihenfolge. Sind alle gewählt, wird die nackte ID gespeichert.
- Layout-Refs sind `sensor/<eintrag>`, mehrere Karten pro Sensor gehen deshalb ohne Modelländerung. Eine geänderte
  Auswahl behält über `renameRef` ihren Platz.
- `sensorModes` bleibt pro Kanal-ID; zeigen zwei Karten denselben Kanal, teilen sie sich dessen Modus.
- `DashboardStore` speichert die Strings unverändert und brauchte keine Änderung. Alte Einträge bleiben gültig.

**Umsetzung:**
- **Web:**
  - `dashboardLayout.ts`: `parseSensorEntry`, `sensorEntry`, `entryChannelIds`; `memberRefs` behält einen Eintrag,
    solange einer seiner Kanäle existiert. Neue Testdatei `dashboardLayout.test.ts` (13 Tests).
  - `Dashboard.tsx`: Filter und Rendern über den Parser. Der Stift reicht den Karteneintrag an den Dialog weiter.
    Umbenennen und Kartenänderung im selben Speichern ergeben ein Dashboard-Update. Beim Umbenennen wandern jetzt auch
    die Zeilenmodi der Kanäle mit (vorher nur die der eigenen Einträge).
  - `AddItemModal.tsx`: Abschnitt „Auf dieser Karte anzeigen“. Angeboten werden die im Formular gewählten Kanäle
    (GY521, YF-S201, HC-SR04), sonst die aus dem Snapshot. Ändert sich nur die Karte, wird der Sensor nicht neu
    angelegt. Ein neu angelegter Mehrkanal-Sensor kommt als eine Karte statt einer pro Kanal aufs Dashboard.
  - `DashboardContentModal.tsx` umgebaut: `onAdd(kind, id)` statt `onSave(members)`. Ein Klick fügt hinzu und
    schließt. Beim Mehrkanal-Sensor öffnet er zuerst eine eigene Ansicht „`<id>` hinzufügen“ mit Kanal-Checkboxen
    (alle vorbelegt, mit Live-Werten), danach „Übernehmen“ oder „Zurück“. Ein dort neu angelegtes Item landet sofort
    auf dem Dashboard.
- **Firmware-Display:** `keyInList` in `SensorChannels.h` (nativ getestet). `resolveSensor` erkennt die Kanalliste,
  und die Gruppenseite zeigt dann nur die gelisteten Kanäle.
- **`openapi.yaml`:** `sensors` und `sensorModes` beschreiben Listenform und mehrere Karten pro Sensor.

**Verifikation:**
- Web `pnpm typecheck`, `pnpm test` 75/75, `pnpm build`.
- Firmware `pio test -e native` 109/109; `pio run` für esp32dev, lolin_s2_mini und LilyGo grün. Redocly-Lint ohne neue
  Warnung.
- **Browser gegen einen Mock**, der GETs ans LilyGo durchreicht und Dashboards nur im RAM hält:
  - zwei `gyro`-Karten angelegt, „alle Kanäle“ abgewählt;
  - per Stift `temp` ergänzt: Die Karte blieb an ihrem Platz, und am Sensor kam nur das Label-POST an, kein Neuanlegen;
  - eine Karte auf `az` reduziert: Sie wird zur Einzelkarte.
- **LilyGo (OTA + UI-Paket):**
  - Dasselbe per echter UI, also `gyro.pitch,roll,tilt,temp` und `gyro.ax,ay,az`.
  - `temp`-Zeile auf kompakt.
  - Nach einem Neustart stehen beide Einträge und `gyro.temp: compact` in `/config/dashboards.json`, und das
    Dashboard sieht gleich aus. Damit ist der alte PLAN-Punkt „Gruppenkarte für Multi-Channel-Sensoren am Gerät“
    erledigt: Gruppenkarte, Zeilenmodus und Reboot sind am echten Board geprüft, `Durchfluss.rate` als Alt-Eintrag
    neben Chart und Programm unverändert.
  - Das runde Display zeigt pro Karte eine Seite mit genau den gewählten Kanälen (vom Nutzer bestätigt).
  - Umgebauter Dialog: `gyro` → Kanalauswahl `gx`/`gy`/`gz` → Übernehmen ergibt `gyro.gx,gy,gz`, der Dialog schließt.
    Der Aktor `kettle` wird per Klick hinzugefügt und steht danach ausgegraut da. `HLT` ist ausgegraut, `gyro` und
    `Durchfluss` bleiben hinzufügbar.

## 2026-10-03 — GY-521-Libelle auf Dashboard und Display (Branch `feat/gy521-libelle`)

Nutzerwunsch: Für den GY-521 eine Wasserwaage-Ansicht wie in einer Libellen-App, rund, mit `pitch` und `roll` auf einer
Karte. Der Screenshot zeigte außerdem eine Linie Zentrum → Blase mit einer Winkelangabe am Rand. Das ist **nicht** der
Neigungswinkel, sondern die Richtung des Ausschlags (im Uhrzeigersinn ab oben, hier 146,9°); die Neigung steht in den
beiden Digitalfeldern, „N“ bräuchte ein Magnetometer.

**Entscheidungen** (mit dem Nutzer):
- **Auslöser automatisch:** Eine Karte, deren Kanäle `pitch` **und** `roll` enthalten, ist eine Libelle. Kein neuer
  `WidgetMode`, kein neues Konfig-Feld; Firmware-`DashboardStore`, `types.ts` und die Shape der API bleiben unverändert.
  Eine Karte mit nur `pitch` bleibt eine normale Karte.
- **Display:** Eine Seite mit der Libelle, dahinter eine zweite mit den übrigen Kanälen (`tilt`, `dir`, `temp` …),
  nur wenn es welche gibt. Die Blase läuft über einen eigenen 80-ms-Timer, nur für die sichtbare Libelle-Seite.
- **Richtungslinie nur im Web.** Dazu ein neuer Sensorkanal `dir`, weil die Richtung sonst in keinem Wert steht.

**Umsetzung:**
- **Library:** `GY521TiltSensor` bekommt den Kanal `dir` (Maskenbit `kChannelDir = 0x400`, hinten angehängt, damit die
  übrigen Bits und ihre Tests stabil bleiben). `dir = atan2(roll, −pitch)`, 0…360° im Uhrzeigersinn ab der X-Achse, aus
  den **gefilterten** Winkeln; ungültig unter 0,5° Neigung. (Erste Fassung `atan2(roll, −pitch)`, nach dem Test am
  Gerät auf `atan2(roll, pitch)` gedreht, siehe unten.) `SensorChannels.h`: `"dir"` an `kGy521Channels`.
- **Gemeinsame Mathematik**, in Firmware und Web gespiegelt und je mit denselben Tests: `levelBubble()` in
  `firmware/src/LevelBubble.h` und `web/src/levelBubble.ts`. Radiale Klemmung auf den Einheitskreis, Vollausschlag
  ±15°, „waagerecht“ innerhalb ±1°, Richtung = Peilung der Blase. Bildschirm: Y-Seite oben (`roll` > 0) → Blase rechts,
  −X-Seite oben (`pitch` > 0) → Blase oben; dadurch stimmt die Randangabe mit dem Kanal `dir` überein.
- **Web:** `LevelCard.tsx` (SVG: Glas, Fadenkreuz, Zielring, Blase, gestrichelte Richtungslinie, Winkel am Rand, darunter
  Nick/Roll/Neigung und die übrigen Kanäle als Zeilen). `Dashboard.tsx` rendert sie statt der `SensorGroupCard`, wenn
  `levelChannels()` pitch und roll findet. `AddItemModal.tsx`: `dir` in Auswahl und Gruppe „Winkel“, Hinweis im Dialog.
- **Display:** `DisplayPages` bekommt `View::Level`/`View::Rest`. `rebuild_` legt zwei Seiten mit derselben Id an und
  bleibt nach einem Neuaufbau auf der gleichen. Kanal-Indizes von pitch/roll werden bei jedem Refresh neu gesucht, nicht
  gemerkt (der Sensor kann währenddessen bearbeitet werden).
- **Doku:** `openapi.yaml` (Kanal `dir`, Libelle-Satz bei `sensors`), `BrewControl/README.md` (Seitentabelle),
  `SensActCtrl/README.md`.

**Verifikation:**
- `pio test -e native`: SensActCtrl `test_gy521_tilt` 23/23 (neu: `dir` für 0/90/180/270/45°, flach ungültig, Maske),
  Firmware 117/117 (neu: `test_level_bubble`, `kGy521Channels` mit elf Schlüsseln). Web `pnpm test` 86/86, `pnpm typecheck`,
  `pnpm build`. Redocly-Lint ohne neue Warnung. `pio run` für `lilygo_t_display_s3_amoled` grün.
- Web gegen einen Node-Mock (Scratchpad): Blase wandert zur höheren Seite, grün und ohne Linie innerhalb ±1°, am Rand
  geklemmt, Randwinkel entspricht `dir`; Mobilbreite geprüft. Dabei fiel auf, dass das Randlabel bei seitlicher Neigung das
  Glas überlappte; der Abstand hängt jetzt von der Richtung ab.
- **Am Gerät geprüft (LilyGo, OTA + UI-Paket):** Display flüssig, Wischen und zweite Seite funktionieren. Nick war
  vertauscht: `pitch = atan2(−ax, …)` ist positiv, wenn die X-Seite *unten* liegt, `roll` positiv, wenn die Y-Seite
  *oben* liegt. Bildschirm-Zuordnung und `dir` auf `pitch` > 0 → oben gedreht (`dir = atan2(roll, pitch)`), danach
  bestätigt. Im Web ruckelte die Blase, weil der Snapshot nur einmal pro Sekunde kommt (`lastPushMs_`, 1000 ms):
  `LevelCard` gleitet jetzt per `requestAnimationFrame` zur neuen Position (Zeitkonstante 300 ms).
- **Skala (Nutzerwunsch: Blase blieb ab 15° am Rand hängen):** zweiteilig. 0–15° füllen die inneren 60 % des
  Radius (Empfindlichkeit wie vorher), 15–45° die äußeren 40 %; ein gestrichelter Ring bei 15° markiert den Wechsel.
  Ab 45° einer Achse (`max(|roll|, |pitch|)`, Rückkehr unter 43°) zeigt die Karte eine **gerade Libelle**. Das Kriterium
  ist die Achse, nicht `hypot` (30°/30° bleibt rund). Mathematik gespiegelt in `LevelBubble.h` / `levelBubble.ts`
  (`levelBubble`, `levelStraight`, `levelStraightMode`) mit denselben Tests (Firmware 122, Web 95).
- **Gerade Libelle zeigt die *andere* Achse (Nutzerkorrektur):** Erst zeigte sie die dominante Achse (−90…90°), und
  Nick lief waagerecht. Richtig ist: Steht das Gerät auf der Kante, bleibt die andere Achse auszurichten. Bei dominantem
  Nick läuft **Roll waagerecht**, bei dominantem Roll **Nick senkrecht** (oben = positiv, wie im Glas). Skala wie im Glas
  (fein bis 15°, Ende bei 45°), Marken bei 0 und ±15°, grün innerhalb ±1°; „senkrecht“ erscheint, wenn die dominante
  Achse bei 90° ± 1° liegt.
- **„Neigung“ auf der Karte** ist kein Kanal, sondern `hypot(roll, pitch)` (Länge der Richtungslinie); `tilt` ist der
  Winkel der Z-Achse und weicht bei großen Winkeln davon ab.
- **Offen am Gerät:** gerade Libelle am Display (Aussehen, Umschalten bei 45°), LVGL-Pool-Reserve bei 16 Seiten.

## 2026-10-01 – 2026-10-02 — Rezept- und Sud-Editor: UI-Entwurf (nur Design, kein Code)

Rezept- und Sud-Editor als Design-Canvas entworfen und Bildschirm für Bildschirm mit dem Nutzer verfeinert. Teil des
Entwurfs: Rezeptliste, Rezept-Tabs (Übersicht, Zutaten mit zwei Ansichten, Wasser, Brautag, Gärung, Sude),
Status und Versionen samt Vergleichsdialog, Stil- und Zutaten-Auswahl, Sud-Phasen mit Soll/Ist-Messwerten, Pumpen
und Gärplatz-Wahl sowie die Brauanlage, getrennt in Sudhaus und Gärkeller. Entscheidungen, Fachregeln und offene
Fragen: [BrewControl/docs/rezept-sud-editor.md](BrewControl/docs/rezept-sud-editor.md). Backlog-Eintrag in
PLAN.md → „Größere Brocken“. Keine Änderung an Firmware, Web-Code oder API.

## 2026-10-03 — Rezept-UI Grundstruktur (Branch `feature/rezept-sud-editor`)

Erste Umsetzung im Web-UI, bewusst schlicht und nur Frontend: Rezeptliste (`/rezepte`) und Bearbeiten-Seite
(`/rezepte/:id`) mit fünf Tabs (Übersicht, Zutaten, Maischen, Würzekochen, Gärung), Nav-Eintrag „Rezepte“.
Rezepte liegen vorläufig in `localStorage` (`web/src/recipes.ts`), das ist die einzige Persistenz-Schnittstelle
und später durch `/api/recipes` ersetzbar. Es gibt **eine gemeinsame Zutatenliste** mit Art und Zeitpunkt; die
Prozess-Tabs zeigen sie gefiltert, nichts wird doppelt gepflegt. Maischen ist nur ein einfacher Plan aus Rasten
(Name, °C, min, umsortierbar). Gärung hat eine einfache Phasenliste (Tage). Speichern ist explizit.
Nicht enthalten: Wasser- und Sude-Tab, Berechnungen, Versionen, Stil-Dialog, Zutaten-Backend, Firmware/API,
Opt-in-Flag und nachladbares Paket. Verifikation: `pnpm typecheck`, `pnpm build`, `pnpm test` (62 grün) und
Browser-Durchlauf über einen Node-Mock (anlegen, Zutat/Rasten, umsortieren, speichern, Reload, Konsole ohne Fehler).

## 2026-10-03 — Zutaten-Schema für die Rezeptverwaltung (Entwurf, Branch `feature/rezept-sud-editor`)

Schema für Katalog- und Nutzerzutaten als reine Typen entworfen: `BrewControl/web/src/ingredientCatalog.ts`, dazu
erfundene Beispieleinträge in `BrewControl/docs/zutaten-beispiele.json`. Nichts im Code nutzt es bisher. Eckpunkte:
Einheiten fest im Schema (`FIELD_UNITS`), Werte als `Range` mit `null` für „min.“ und „max.“; Fermentables in
Malz, Rohfrucht, Zucker und Extrakt geteilt; Kulturen als Union aus Hefe, Bakterien und Mischkultur; Hopfenform nur an
der Gabe im Rezept; Aromen mit Intensität 0 bis 5 aus einem Vokabular; Quellenfeld je Eintrag; Lagerposten (`StockLot`)
mit eigenen Datenblattwerten nur als Typ. Gegen Datenblätter von Weyermann, Yakima Chief/NZ Hops, Hopsteiner (Thiole)
und Lallemand geprüft; 13 echte Einträge daraus stehen in `BrewControl/web/public/catalog/zutaten-datenblaetter.json`. Zurückgestellte und offene Punkte stehen in PLAN.md beim Rezept- und Sud-Editor.

## 2026-10-04 — Zutatenkatalog im Rezept-UI (Branch `feature/rezept-sud-editor`)

Der Katalog wird jetzt im Frontend genutzt: `web/src/ingredientSource.ts` lädt `/catalog/zutaten-datenblaetter.json`
(statische Datei aus `web/public/catalog/`, vorher unter `docs/`) einmal pro Sitzung, hängt Nutzerzutaten aus
`localStorage` (`bc.userIngredients`, bisher ohne Oberfläche zum Anlegen) an und bietet `findIngredients` für die
Suche. Die Zutatenzeilen haben statt des freien Namensfelds `IngredientPicker`: Vorschläge nach Art, Auswahl setzt
`ingredientId` am Rezept, Weitertippen macht die Zeile wieder zu Freitext. Fehlt der Katalog, bleibt alles Freitext.
`ingredientSource.test.ts` deckt die Suche ab. Typecheck, 69 Tests und Build grün, Browser-Durchlauf über den Mock
(Vorschlag, Auswahl, Speichern, Entlinken). Nächster Schritt: Kennwerte aus den Zutaten berechnen.

## 2026-10-04 — Rezept-Kennwerte (Branch `feature/rezept-sud-editor`)

Die Karte „Kennwerte“ im Rezept rechnet jetzt Stammwürze, Restextrakt, Alkohol, Bittere und Farbe aus den
Katalog-verknüpften Zutaten (`web/src/recipeStats.ts`, Formeln in `brewMath.ts`). Zeilen ohne Katalogverknüpfung
zählen nicht mit und werden unter der Karte vermerkt.

- **Stammwürze:** Extrakt je Zeile aus `extractDryPct` und Feuchte, maischendes Vergärbares (Malz, Rohfrucht) mit der
  neuen Sudhausausbeute (`Recipe.efficiencyPct`, Standard 75 %), Zucker und Extrakt mit 100 %. Zucker zur Abfüllung
  oder Hauptgärung zählt nicht. `platoFromExtract` ist die Umkehrung der Bilanz aus `extractEfficiencyPercent`.
- **Farbe:** Morey (SRM = 1,4922 · MCU^0,6859, EBC = 1,97 · SRM). Der Schritt EBC → °L (Umkehrung von Daniels,
  SRM = 1,3546 · °L − 0,76) hat keine Primärquelle, er trägt ein `TODO(verify)`.
- **Alkohol:** Endvergärungsgrad der ersten verknüpften Hefe, dann `ballingBeerAnalysis`.
- **Bittere:** Tinseth, dazu mIBU (alchemyoverlord, nach Malowicki & Shellhammer 2005) für die Zeit nach Kochende
  bei der konstanten Whirlpool-Temperatur des Rezepts. Ohne Abkühlkurve und ohne die „ersten 5 Minuten“-Regel der
  Quelle. Kochgaben haben ein neues Feld `Ingredient.timeMin` („min vor Kochende“, fehlt = ganze Kochdauer),
  Vorderwürze zählt mit der ganzen Kochdauer. Hop Back, Dip, Maische und Gärung zählen nicht. Kochwürze und -menge
  sind durch Stammwürze und Ausschlagmenge genähert.
- **Nebenbei behoben** (aus dem Katalog-Eintrag): Das Vorschlagsfeld war durchsichtig (`bg-card`), jetzt `bg-surface`.
  Und `useCatalog` startete bei jedem Mount mit `null`, was beim Tabwechsel kurz „Katalog nicht geladen“ zeigte.
- **Prüfung:** Typecheck, 91 Tests, Build (JS gzip 142,4 kB, +1,3 kB). Browser über den Mock mit einem Rezept ohne
  `efficiencyPct`: 13,6 °P, IBU 21 mit 60 min und 14 mit 15 min (von Hand nachgerechnet), Alkohol 5,8 % vol nach
  Hefeauswahl, Vermerke für Freitext-Zeile und Trockenhopfen, keine Konsolenfehler.

## 2026-10-04 — Stilvergleich im Rezept (Branch `feature/rezept-sud-editor`)

Das Rezept lässt sich jetzt einem BJCP-2021-Stil zuordnen, die neue Stil-Karte in der Übersicht zeigt je Kennwert
(Stammwürze, Restextrakt, Alkohol, Bittere, Farbe) den Stilbereich als Balken mit dem Rezeptwert, „x von y im Stil“
und ein Abzeichen („im Stil“, „+1,6 über Stil“). Das Stilfeld ist ein Suchfeld (`StylePicker`), die Wahl setzt
`Recipe.styleId` und den Namen in `style`; Weitertippen macht es wieder zu Freitext. Altrezepte mit Freitextstil
funktionieren unverändert.

- **Daten:** `web/public/catalog/bjcp-2021.json`, 95 Stile, 3 kB gzip, nur Nummer, Name, Kategorie und die fünf
  Bereiche (OG/FG in SG, IBU, SRM, ABV). Erzeugt aus den beiden von bjcp.org verlinkten JSON-Konvertierungen
  (ascholer/bjcp-styleview, beerjson/bjcp-json), die bei 86 Stilen in allen zehn Werten übereinstimmen, und gegen das
  offizielle PDF (Fassung 1.25, Feb. 2025) geprüft: 73 Stile über einen Parser, 12 per Einzelsuche, 27B–27I einzeln.
  Die Quellen widersprachen sich bei Saison (Vereinigung aller Stärkestufen gegen Standardstufe) und Specialty IPA
  (Werte je Unterstil). Saison steht als Standardstufe/hell (5–7 % vol, SRM 5–14), 21B fehlt. Ebenfalls ohne feste
  Werte und deshalb nicht dabei: Kategorien 28–34, Kellerbier, die provisorischen X1–X5.
- **Code:** `styleSource.ts` (Laden, Suche), `styleCompare.ts` (reiner Vergleich, SG→°P per `sgToPlato`, SRM→EBC mit
  dem jetzt exportierten `EBC_PER_SRM`), `StylePicker.tsx`, `StyleCard.tsx`.
- **Lizenz:** Die BJCP verlangt für Apps eine Genehmigung und einen Hinweistext. Bis zur Zusage nennt die Karte nur
  Quelle und Copyright, der Satz „mit Genehmigung“ fehlt bewusst. PLAN.md hat dafür einen Punkt als Voraussetzung für
  Merge und Auslieferung.
- **Nebenbei behoben:** In `IngredientPicker` (und dem neuen `StylePicker`) blieb die Vorschlagsliste nach einer Auswahl
  zu, solange das Feld fokussiert blieb. Tippen öffnet sie jetzt wieder.
- **Prüfung:** Typecheck, 103 Tests, Build (JS gzip 143,7 kB). Browser über den Mock: „alt“ tippen, Altbier wählen,
  Karte zeigt fünf Zeilen mit nachgerechneten Bereichen (11,0–12,9 °P, 4,3–5,5 % vol, 25–50 IBU, 18–33 EBC), Tippen löscht
  die Verknüpfung, erneutes Tippen nach einer Auswahl öffnet die Liste, Speichern schreibt `styleId`, die Liste zeigt den
  Stilnamen, keine Konsolenfehler.

## 2026-10-04 — Rezepte als nachladbares Paket mit Opt-in (Branch `feature/rezept-sud-editor`)

Die Rezeptverwaltung ist jetzt ein optionales UI-Paket: Auf Boards ohne das Paket verschwinden Menüpunkt und Seiten,
und das Paket kostet dort keinen Flash. Der Anlass: Das Menü „Rezepte“ stand auf jedem Board, auch auf esp32dev und
lolin_s2_mini mit der 256-KB-Partition.

- **Paket:** Ordner `modules/recipes/` (Quelle `web/public/modules/recipes/`, vorher `public/catalog/`) mit
  `manifest.json`, Zutaten- und Stilkatalog und dem Chunk mit den Rezeptseiten. Einstieg ist `src/modules/recipes.ts`,
  `vite.config.ts` legt Chunks dieses Einstiegs nach `dist/modules/recipes/`. Der Chunk hat 7,4 kB gzip, das Hauptbundle
  sank von 143,7 auf 138,7 kB. Das Paket insgesamt wiegt etwa 15 kB gzip.
- **Opt-in ohne Firmware-Flag:** `src/optionalModules.ts` (`useModule`) holt `/modules/<name>/manifest.json` und prüft
  dessen Inhalt; vorhanden heißt eingeschaltet. Das Gerät antwortet auf fehlende Dateien mit Endung 404 (`onNotFound`
  in `WebUI.cpp`), nicht mit der Startseite. `NavShell` blendet „Rezepte“ aus, `RecipesRoute` lädt den Chunk erst bei
  Bedarf und zeigt sonst einen Hinweis („nicht installiert“, bzw. „unvollständig“, wenn das Manifest da ist, aber der
  Chunk fehlt). Eine neue API-Route gibt es nicht, `openapi.yaml` bleibt unberührt.
- **Auslieferung:** Ein „Installieren“ ersetzt das ganze `/www` und würde das Paket löschen. Deshalb baut
  `.github/workflows/release.yml` zwei Tars: `webui.tar` ohne `modules/` (155 KB, für Boards mit `BREWCTL_ASSETS_IN_PLACE`)
  und `webui-full.tar` (170 KB). `FirmwareUpdater::fetchReleaseMeta` nimmt auf Boards ohne die kleine Partition das volle
  Tar, mit Rückfall auf `webui.tar` für ältere Releases. README: beide Tars, und beim LittleFS-Deploy per `uploadfs`
  den Ordner `modules` aus `data/www` löschen.
- **Prüfung:** Typecheck, 103 Tests, Build. Browser über den Mock mit Paket (Liste, Editor, Direktaufruf, Kataloge aus dem
  neuen Pfad, Chunk lazy), ohne `dist/modules` (Menüpunkt weg, Hinweis, kein Konsolenfehler; der Mock liefert für
  fehlende Dateien die Startseite mit 200, die Inhaltsprüfung hat das als „fehlt“ gewertet) und mit Manifest, aber ohne
  Chunk (Meldung statt weißer Seite). Beide Tars gebaut und aufgelistet. Nachtrag: `pnpm build:lfs` (`scripts/copy-lfs.js`) legt `dist/` ohne `modules/` nach `firmware/data/www`, damit der `uploadfs`-Weg das Paket nicht versehentlich aufs schlanke Board bringt (156.009 Bytes, nur `.gz`, kein `modules/`). Der frühere README-Satz „passen nicht in die 256-KB-Partition“ war nicht gemessen und ist entfernt, der Grund ist Konsistenz mit dem schlanken `webui.tar`. Firmware: `pio run` für `esp32dev` (Flash 94,6 %, ein Vorher-Wert wurde nicht gemessen; die Änderung ist ein Zweizeiler) und `lilygo_t_display_s3_amoled` (SD-Zweig) baut. Eine native Teststrecke für den Updater gibt es nicht.
- **Offen:** Rezepte liegen weiter im `localStorage` (Schritt 3, `/api/recipes` auf SD, im PLAN.md).

## 2026-10-04 — Rechner ins nachladbare Paket (Branch `feature/rezept-sud-editor`)

Die Rechner unter `/rechner` (14 Rechner, `Calc*.tsx`, `brewMath.ts`, `gravityUnits.ts`) gehören jetzt zum Paket `recipes` und sind damit nur mit `modules/recipes/` sichtbar. Die Rechner wurden nur von ihren eigenen Seiten und vom Rezeptcode benutzt, deshalb zog Rollup sie ohne weitere Umbauten in den Paket-Chunk.

- **Umsetzung:** `src/modules/recipes.ts` exportiert zusätzlich `RechnerIndex` und `RechnerDetail`. `pages/RecipesRoute.tsx` heißt jetzt `pages/PackageRoutes.tsx` und enthält `RecipesRoute` und `RechnerRoute` über einen gemeinsamen Lade-Hook (`usePackage`), die Hinweistexte unterscheiden sich je Funktion. `app.tsx` importiert die Rechnerseiten nicht mehr statisch, der Menüpunkt „Rechner“ trägt `module: 'recipes'`. Der Paketname bleibt `recipes`, obwohl er jetzt auch die Rechner enthält; ein eigenes Paket wäre mit demselben Mechanismus möglich (`src/modules/<name>.ts`).
- **Größen:** Hauptbundle 138,7 → 133,1 kB gzip, Chunk 7,45 → 12,71 kB, `dist/modules` 20.137 Bytes, `dist` ohne `modules` jetzt 150.461 Bytes (vorher 156.009). `webui.tar` 163.840, `webui-full.tar` 184.320 Bytes (Tar-Blockpadding).
- **Prüfung:** Typecheck, 103 Tests, Build. Browser über den Mock: mit Paket Rechnerindex mit allen 14 Rechnern und Direktaufruf `/rechner/abv` mit Ergebnis (5,0 % vol), Chunk aus `/modules/recipes/`; ohne `dist/modules` beide Menüpunkte weg, Hinweis „Die Rechner sind auf diesem Gerät nicht installiert …“, kein Konsolenfehler.
- **Folge:** Boards mit `webui.tar` (esp32dev, lolin_s2_mini) haben die Rechner nicht mehr.

**Nachtrag, BJCP-Stilvergleich ausgeblendet:** Statt der ganzen Rezeptseiten ist nur der Stilvergleich aus: `STYLE_COMPARISON = import.meta.env.DEV` (`styleSource.ts`) schaltet `StylePicker` und `StyleCard` in `tabs.tsx`; im Build gibt es wieder das freie Stilfeld. `bjcp-2021.json` ist aus dem Index genommen und in `web/.gitignore`, bleibt lokal für `pnpm dev`. Damit enthält das Paket (und `webui-full.tar` aus der CI) keine BJCP-Daten; ein lokaler `pnpm build` nimmt die Datei weiter mit, weil sie im Arbeitsverzeichnis liegt. Die Rezeptseiten (Revert von `8973584`) und der Menüpunkt „Rezepte“ sind wieder sichtbar.

## 2026-10-04 — Update-Suche im Vorschau-Kanal: „check failed“ (Branch `feature/rezept-sud-editor`)

Auf dem LilyGo zeigte die Update-Suche im Kanal „Vorschau“ nur „check failed“, ohne Netzfehler in Klammern.

- **Root Cause:** `FirmwareUpdater::fetchReleaseMeta` wendete einen Objekt-Filter auf die Release-**Liste** (`/releases?per_page=10`) an. ArduinoJson wirft bei einem Objekt-Filter ein ganzes Array weg, das Dokument blieb leer, kein Release wurde gefunden, und `doCheck` meldete „check failed“. Der Stable-Kanal (`/releases/latest`, ein Objekt) war nie betroffen. Der Fehler steckt seit `ef8885e` im Code; der Vorschau-Kanal hat also nie funktioniert (Kommentar „the same filter applies element-wise“ war falsch). Reproduziert mit ArduinoJson 7.4.3 in einem Scratch-Programm: Objekt-Filter → 0 Elemente, Array-Filter `filter[0]` → beide Releases.
- **Fix:** `src/ReleaseFilter.h` (`makeReleaseFilter(filter, list)`) baut für die Liste `filter[0]`, für ein einzelnes Release das Objekt. Dazu `test/test_release_filter` (native), der mit dem alten Objekt-Filter „Expected 2 Was 0“ liefert und mit dem Fix besteht.
- **Prüfung:** `pio test -e native` 101 Tests grün, `pio run` für `esp32dev` (Flash 94,6 %) und `lilygo_t_display_s3_amoled` baut. Nicht auf dem Gerät geprüft.
- **Folge für den Test:** Das Release `v0.2.1-rc.1` enthält den Fehler noch. Ein Board mit dieser oder älterer Firmware sieht über „Vorschau“ nie ein Pre-release; die Firmware mit dem Fix muss einmal anders aufs Board (USB oder `POST /api/update/firmware`).

## 2026-10-04 — Update-Suche: chunked Antwort von GitHub (Branch `fix/update-check-chunked`)

Auch nach dem Filter-Fix (`e6165bb`) zeigte der Vorschau-Kanal am LilyGo nach einer Pause „check failed“, obwohl dieselbe Suche per `curl` gegen das Gerät mehrfach hintereinander gelang. Im UI-Klick reproduziert (14:16:57), unmittelbar danach klappte die Suche per `curl` wieder.

- **Root Cause:** Die API-Antwort für `/releases?per_page=10` hat `Cache-Control: max-age=60`. Ein Cache-Treffer kommt mit `Content-Length`, ein frischer Request mit `Transfer-Encoding: chunked` (mit `curl` und je einem eindeutigen Query-Parameter dreimal nachgestellt). `FirmwareUpdater::fetchReleaseMeta` liest `http.getStream()`, und der gibt die rohen Chunk-Größenzeilen an ArduinoJson weiter. Beginnt die Zeile nur mit Ziffern (`1000`), parst ArduinoJson sie als Zahl, meldet `Ok` und ignoriert den Rest; die Liste ist leer, kein Release, „check failed“ ohne Zusatz. Wiederholte Suchen innerhalb einer Minute trafen den Cache und liefen durch, daher der Eindruck „geht mit curl, nicht im UI“. Der Stable-Kanal ist nicht betroffen: `/releases/latest` kommt auch frisch mit `Content-Length`.
- **Fix:** `http.useHTTP10(true)` vor dem `GET()` in `fetchReleaseMeta`; GitHub antwortet dann ohne Chunk-Kodierung (mit `curl --http1.0` für Liste und `/latest` geprüft). Die beiden stillen Fehlerpfade geben jetzt einen Grund aus („no release in the response“, „release without tag_name“), damit ein erneuter Ausfall nicht mehr ohne Zusatz bleibt.
- **Prüfung:** `pio run` für `lilygo_t_display_s3_amoled` und `esp32dev` (Flash 94,8 %). Auf dem Gerät noch nicht geprüft: Nach dem Flashen >90 s nichts an die API schicken, dann im UI suchen (kalter Cache). Eine native Teststrecke für den HTTP-Pfad gibt es nicht.

## 2026-10-04 — Firmware-Seite: Reboot-Bildschirm beim Installieren fehlte (Branch `fix/update-install-screen`)

Nutzer: Beim Installieren einer Vorschau-Version erschien nach dem Bestätigungsdialog der Bildschirm „Update wird installiert…“ mit dem automatischen Neuladen nicht, bei der Stable-Version schon.

- **Befund:** `FirmwarePage.tsx` zeigte den Bildschirm nur im `.then()` des `POST /api/update/install` und hatte kein `.catch`. Die Firmware startet bewusst 200 ms nach dem `202` neu (`FirmwareUpdater::tick`); kommt die Antwort vorher nicht mehr an, bricht `fetch` mit einem `TypeError` ab, der Dialog schließt sich und nichts weiter passiert. Das lässt sich mit einem Mock nachstellen, der die Verbindung beim Install-POST trennt (Dialog zu, kein Bildschirm, Anfrage kam an). Im Code gibt es keinen Unterschied zwischen den Kanälen; warum es bei „Vorschau“ häufiger auftrat, ist nicht geklärt (vermutlich Timing zwischen dem Senden des `202` und dem Neustart, am Gerät nicht gemessen).
- **Fix:** Ein `TypeError` beim Install-POST gilt als „Gerät startet neu“ und zeigt den Reboot-Bildschirm. Eine echte HTTP-Antwort mit Fehler (z. B. 500) zeigt „Installation nicht gestartet: …“ auf der Seite, statt still zu verschwinden.
- **Prüfung:** Typecheck, 136 Tests. Browser gegen den Mock: abgebrochene Verbindung → Bildschirm mit Neuversuch-Zähler, HTTP 500 → Fehlertext, kein Bildschirm. Am Gerät nicht geprüft.

## 2026-10-04 — `pnpm build:tars` und Schalter für den BJCP-Testbuild (Branch `feat/build-tars`)

Auslöser: Auf dem LilyGo fehlten Rezepte und Rechner, weil ein Tar mit dem alten Befehl gebaut wurde (am Gerät: `/www` nur `index.html.gz` und `assets/`, kein `modules/`, `/modules/recipes/manifest.json` 404). Zwei Befehle für zwei Tars waren leicht zu verwechseln.

- **`pnpm build:tars`** (`scripts/make-tars.js`): `build:sd`, dann `webui.tar` (ohne `modules/`, über einen Zwischenordner `dist-slim`, damit `tar` mit relativen Pfaden und ohne `--exclude`-Eigenheiten auskommt) und `webui-full.tar`. Beide Tars sind in `.gitignore`. Geprüft: 163.840 und 184.320 Bytes wie bei den CI-Tars, schlank ohne `modules`-Einträge, voll mit `modules/recipes/…`.
- **BJCP im Testbuild:** `STYLE_COMPARISON` gilt jetzt auch mit `VITE_STYLE_COMPARISON=1` (Shell oder `.env.local`), und `vite.config.ts` löscht `bjcp-2021.json` aus `dist/`, wenn der Schalter fehlt (`public/` wird samt unversionierter Dateien kopiert; ein `build:sd` mit der Datei im Arbeitsverzeichnis hatte sie vorher mitgenommen). Geprüft mit der Datei in `public/`: ohne Schalter kein `bjcp` in `dist` und in beiden Tars, mit Schalter nur im vollen Tar (194.560 Bytes) und der Stil-Code im Chunk. Die Datei lässt sich aus der Historie holen (`git show 218ec58:BrewControl/web/public/catalog/bjcp-2021.json`, README).

**Nachtrag, Stilauswahl blieb leer (UTF-16):** Auf dem LilyGo war der Stilvergleich sichtbar, die Auswahl aber leer. Ursache: Die Datei wurde mit dem README-Befehl `git show … > bjcp-2021.json` in Windows PowerShell 5.1 angelegt; `>` schreibt dort UTF-16 mit BOM (33.192 statt 16.493 Bytes, `FF FE 7B 00 …`). Der Server lieferte die Datei korrekt (gzip, 200), aber `fetch(...).json()` scheitert an UTF-16, `useStyles` blieb `null` und still ohne Fehler. Fix: README nutzt `cmd /c "git show … > …"` (schreibt die Bytes unverändert, in PowerShell geprüft: 16.493 Bytes, gleiche MD5), und `vite.config.ts` bricht den Build mit `VITE_STYLE_COMPARISON=1` ab, wenn die Datei kein gültiges UTF-8-JSON ist (geprüft: UTF-16 mit Schalter → Fehler, ohne Schalter → Datei entfernt, korrekte Datei → Build ok). Die falsche Datei im Haupt-Checkout habe ich durch die korrekte aus der Historie ersetzt.

## 2026-10-04 — Web-UI: konfigurierbarer Hintergrund-Verlauf

Die Hintergrund-Tönung (neutral/warm/kalt) bekam einen optionalen Farbverlauf nach Vorbild eines Mockups im Windows-11-Mica-Stil.
Einstellungen → Darstellung → „Hintergrund-Verlauf“: Schalter, vier Presets (Aurora = Mockup, Glut, Wald, Dämmerung), drei Stopp-Farben, Richtung 0–360°, Intensität 0–100 %.

- **Modell:** `theme.gradient { enabled, from, via, to, angle, intensity }`, optional (ältere Geräte = aus). Die Stopps tragen nur Farbton und Sättigung; die Helligkeit bleibt die von `--bg` (`oklch(from var(--bg) l C H)`), deshalb funktioniert derselbe Verlauf in Hell und Dunkel und kombiniert sich mit der Tönung. Ohne Relative-Color-Support verwirft der Browser die Deklaration, es bleibt der flache `--bg`.
- **Durchscheinen:** Der Verlauf liegt fix auf `html` (`--bg-gradient`). Dafür verloren NavShell, PageShell, Dashboard (3×) und ReloadRetry ihr deckendes `bg-bg`; die ohnehin halbtransparenten Karten (`--card-bg`) zeigen ihn dann. Ohne Verlauf ändert sich nichts (`html` malt weiter `--bg`).
- **Firmware:** `SettingsStore` speichert/liefert das Objekt, `POST /api/settings` validiert Hex, Winkel und Intensität (400: `invalid gradient color|angle|intensity`); `openapi.yaml` nachgezogen (`GradientSettings`).
- **Verifikation:** `pnpm test` (141), `pnpm typecheck`, Redocly-Lint (nur die alte info-license-Warnung), `pio run -e esp32dev` grün. Im Browser (Mock) Dunkel und Hell geprüft: Aurora liefert `#162229 / #1c1f2f / #172226` gegen `#171f26 / #1c1e31 / #1a282f` im Mockup. Noch nicht auf einem Gerät geprüft.

## 2026-10-04 — Rezepte auf der SD-Karte statt im Browser (Branch `feat/recipes-sd`)

Der Rezeptspeicher lag im `localStorage`, also pro Browser und Gerät. Jetzt liegt jedes Rezept als `/recipes/<id>.json` auf der SD, die Seiten lesen und schreiben über `/api/recipes`.

- **API** (nur SD-Boards, auf den LittleFS-Boards per `#ifndef BREWCTL_USE_LITTLEFS` nicht gebaut): `GET /api/recipes` (Liste mit `id, name, style, volumeL, status, updatedAt`), `GET`, `PUT` (anlegen oder ersetzen, die ID wählt der Client) und `DELETE /api/recipes/<id>`. Vertrag in `docs/openapi.yaml`, Tabelle im README.
- **Firmware:** `RecipeStore.h/.cpp` (SD-Zugriff, jede Operation unter `SdLock`), `RecipeFiles.h` (reine Hilfen, nativ getestet). Die Firmware deutet ein Rezept nicht, nur die `id`. Die ID wird zum Dateinamen und ist auf 1–32 Zeichen `A-Za-z0-9_-` begrenzt; weicht die `id` im Body von der im Pfad ab, gibt es `400 id mismatch`. Geschrieben wird in `<name>.tmp` und dann umbenannt (FAT überschreibt beim Umbenennen nicht, daher vorher `remove`). Obergrenze je Rezept ist das 16-KB-Body-Limit.
- **Index statt Verzeichnislauf (am Gerät gemessen):** Die erste Fassung las für die Liste jedes Rezept. Am LilyGo kostet jedes `open()` etwa 30 ms und das Lesen von 5 KB noch einmal etwa 30 ms (`readString()` war mit 150 ms je Rezept noch dreimal langsamer, jetzt blockweise gelesen). 42 Rezepte brauchten 2,7 s, und das läuft im AsyncTCP-Task, dessen Watchdog bei 5 s auslöst, also schon ab rund 80 Rezepten. Deshalb führt die Firmware `/recipes/index.jsonl` mit einer Kopfzeile je Rezept (ID zuerst, kompaktes JSON, eine Zeile) und ändert sie bei jedem `PUT`/`DELETE`; die Liste liest nur diese Datei: 55–67 ms bei 40 Rezepten. Das Rezept wird zuerst geschrieben, dann der Index, ein Stromausfall dazwischen lässt ein Rezept zurück, das nur nicht gelistet ist. Von Hand kopierte Rezeptdateien stehen erst nach einem Speichern über die UI im Index; einen Wiederaufbau aus den Dateien gibt es bewusst nicht (er würde die Wartezeit wieder in den AsyncTCP-Task legen).
- **UI:** `web/src/recipes.ts` ist jetzt asynchron (`listRecipes`, `getRecipe`, `saveRecipe`, `deleteRecipe`); `RecipesPage` und `RecipeEditPage` laden per Effekt und zeigen „Lädt …“ sowie Fehlertexte, ein fehlgeschlagenes Speichern lässt das Rezept ungespeichert (Punkt am Knopf bleibt). `failed()` aus `api.ts` wird exportiert, damit ein 401 weiter den Login öffnet.
- **Übernahme:** `importLocalRecipes()` lädt beim ersten Öffnen der Rezeptseite Rezepte aus dem alten `localStorage` hoch, die das Gerät nicht kennt (das Gerät gewinnt bei gleicher ID, `updatedAt` bleibt erhalten) und löscht die lokale Kopie erst, wenn alles hochgeladen ist.
- **Prüfung:** Native Tests für die reinen Hilfen (9), Vitest für den Store gegen einen `fetch`-Mock (8, gesamt 144), Typecheck, OpenAPI-Lint (nur die bekannte `license`-Warnung). Gebaut für LilyGo und `esp32dev`; im `esp32dev`-Binary stecken keine `RecipeStore`-Symbole. **Am LilyGo** (Firmware und `webui-full.tar` hochgeladen): anlegen, ersetzen (kein Duplikat im Index, keine `.tmp` zurück), Umlaute und Zeilenumbrüche im Rezept, lesen, löschen (zweites Löschen `404`), ungültige IDs (`a.b`, `../config/x`, leer, 33 Zeichen, ID im Body abweichend oder fehlend, kein Objekt, kein JSON) alle `400`, 17 KB `413`, 40 Rezepte à 5 KB anlegen (19 s inklusive Prozessstart je Aufruf), Liste 55–67 ms, nach Neustart alles da; in der UI am Gerät: Import eines alten Browser-Rezepts, anlegen, ändern, speichern, neu laden, löschen, ohne Konsolenfehler. Testdaten danach vom Gerät gelöscht.
- **Offen:** Das Backup (`/api/backup`) enthält die Rezepte nicht (PLAN.md, Bugs & Einschränkungen).

## 2026-10-04 — Rezept-Sicherung (Export/Import auf der Backup-Seite)

Das Backup enthielt die Rezepte nicht, und ins Bündel ließen sie sich nicht legen: `POST /api/backup` puffert den Body im RAM (`kMaxBodyBytes` 16 KB). Statt Firmware-Umbau läuft die Sicherung im Browser über die vorhandene `/api/recipes`.

- **Umsetzung:** `web/src/recipes.ts` — `exportRecipes()` (Liste, dann jedes Rezept nacheinander, damit der AsyncTCP-Task nicht geflutet wird), `parseRecipeBundle()` (Typ, Version, Liste, ID-Regel wie `isValidRecipeId`), `importRecipes()` (nacheinander `PUT`, bricht beim ersten Fehler ab und nennt, wie viele schon drin sind; gleiche ID wird überschrieben, `updatedAt` bleibt). `BackupPage.tsx`: zwei Karten „Rezepte exportieren/importieren“ mit Bestätigungsdialog, nur sichtbar, wenn `useModule('recipes')` das Paket meldet (LittleFS-Boards und `webui.tar` ohne Paket sehen sie nicht). Format: `{type:"brewcontrol-recipes", version:1, recipes:[…]}`. Keine Firmware- und keine OpenAPI-Änderung.
- **Prüfung:** 6 neue Vitest-Fälle (Roundtrip mit Überschreiben und erhaltenem `updatedAt`, fünf Ablehnungsfälle ohne einen Request an das Gerät, Teilfehler meldet „1 von 3“; gesamt 156), Typecheck, Build. Im Browser gegen einen Node-Mock: Gruppe erscheint mit Manifest und fehlt ohne; Export, Rezept löschen, Import stellt beide Rezepte wieder her. **Am LilyGo** (`webui-full.tar` per `POST /api/update/assets` hochgeladen, Backup-Seite zeigt die Karten): Export mit einem Rezept; 40 Testrezepte à 5 KB (174 KB Datei) über den Import-Dialog eingespielt, 24 s, Liste danach 41 Einträge in 49 ms; Export aller 41 in 3,1 s, Inhalt (Umlaute, 4200 Zeichen, `updatedAt`) unverändert; fünf Rezepte gelöscht und den Export eingespielt (41 Rezepte, 40 s, alle fünf zurück); kein Watchdog (`resetReason` blieb `sw`). Testrezepte danach gelöscht. Der Restore in ein ganz leeres Rezeptverzeichnis wurde danach vom Nutzer am Gerät geprüft und funktioniert.
- **Nachtrag, Fortschrittsbalken im Import-Dialog:** `importRecipes(text, onProgress?)` meldet nach jedem geschriebenen Rezept `(done, total)`, der Dialog zeigt den Balken. Der bisher in `FirmwarePage.tsx` lokale `ProgressBar` ist nach `components/ProgressBar.tsx` gezogen und wird von beiden Seiten genutzt. Beim Bauen ein Fehler gefunden und behoben: `onProgress?.(++done, …)` wertet das Argument ohne Callback nicht aus, `done` blieb 0 (zwei Tests fingen es). Im Browser gegen den Mock mit 0,7 s je `PUT`: 0 → 17 → … → 83 %, danach schließt der Dialog mit „6 Rezepte eingespielt“. Neuer Test für die Fortschrittsmeldungen, gesamt 157.

## 2026-10-04 — Regler-Parameter über `/params` überleben den Neustart

Bisher schrieb nur `syncTunedGains` Kp/Ki/Kd aus dem laufenden Regler in die gespeicherte Konfiguration; alle anderen Schlüssel aus `POST /api/controllers/{id}/params` galten nur für das Live-Objekt und fielen beim Neustart zurück (betroffen war nur die direkte API, die UI speichert über den Bearbeiten-Dialog).

- **Umsetzung:** `DynamicItems::syncTunedGains` heißt jetzt `syncTunedParams` und gleicht je Reglertyp alle abstimmbaren Werte mit der Konfiguration ab, im 1-s-Takt aus `loop()` wie bisher: PID Kp/Ki/Kd; SplitRangePID zusätzlich `deadband`, `changeover_ms`; TwoPoint `hyst_low`, `hyst_high`, `inverted`; DualStage `heat_diff`, `cool_diff`, `cool_min_on_ms`, `cool_min_off_ms`, `changeover_ms`; bei vorhandenem Rate-Limit-Wrapper `max_rate_per_sec`. Quelle sind die **Live-Werte** über die Getter der Library, nicht der Request-Body: das deckt auch `/tune` über ESP-NOW ab, speichert eine von der Library begrenzte Eingabe so, wie sie wirkt, und braucht weder einen neuen Handler noch eine Sperre (läuft im selben Block wie bisher). Config-Defaults sind die von `addControllerNoBegin`, ein unveränderter Regler bleibt unangetastet.
- **Prüfung:** Kompiliert für `esp32dev`. Am `esp32dev` (OTA, Test-Regler nur auf `adc_test`/`dac_test`, kein Remote-Aktor): je ein TwoPoint-, DualStage-, PID- (mit `max_rate_per_sec`) und SplitRangePID-Regler angelegt, die Werte über `/params` gesetzt; nach 4 s standen sie in `registry.json` (`hyst_low -0.3`, `hyst_high 0.7`, `inverted true`, `heat_diff 0.8`, `cool_diff 0.9`, `cool_min_on_ms 60000`, `cool_min_off_ms 120000`, `changeover_ms 30000`/`45000`, `deadband 0.2`, `max_rate_per_sec 0.5`); nach einem Neustart zeigte der Snapshot dieselben Werte. Test-Regler danach gelöscht. Die Funktion hängt an Arduino-Typen, einen nativen Test gibt es dafür nicht.
- **Offen:** `autotuneMethod` — siehe nächster Eintrag.

## 2026-10-04 — `autotuneMethod` überlebt den Neustart

Letzte Lücke aus dem Eintrag davor: die Konfiguration kannte die Methode nicht, nach einem Neustart stand sie wieder auf `ZieglerNichols`.

- **Umsetzung:** Neuer Konfigurationsschlüssel `autotune_method` (PID, SplitRangePID; in `openapi.yaml` unter `ControllerCreate`). `addControllerNoBegin` spielt ihn über `setParamsJson({"autotuneMethod":…})` ein, `syncTunedParams` schreibt `tuningMethod()` des laufenden Reglers zurück, wenn er vom gespeicherten Wert (Standard `ZieglerNichols`) abweicht. Keine Änderung an der Library.
- **Prüfung:** Kompiliert für `esp32dev`. Am `esp32dev` (OTA): PID-Regler angelegt, `autotuneMethod` per `/params` auf `IMC` gesetzt, nach einem Neustart (Uptime-Zähler zurückgesetzt) zeigt der Snapshot weiter `IMC`. Test-Regler danach gelöscht.

## 2026-10-04 — Brauanlage, Etappe 1: Sudhaus-Modell (Branch `feat/brauanlage-sudhaus`)

Erste Etappe vor dem Wasser-Tab (Reihenfolge Anlage → Wasser-Tab → Versionen → Gärkeller → Sud). Anders als im ersten Konzept gibt es keine festen Gefäße mehr: Prozessschritte werden frei auf Behälter verteilt. Entscheidungen stehen in `BrewControl/docs/rezept-sud-editor.md` („Anlage“).

- **Firmware (nur SD-Boards):** eine Datei je Sudhaus, `/brewhouses/<id>.json`, ohne Index (`JsonDocDir`, reine Hilfen in `JsonDocFiles.h`, nativer Test `test_json_doc_files`), dazu `/brewery.json`. Routen `GET /api/brewhouses`, `PUT`/`DELETE /api/brewhouses/<id>` (400 `invalid id`/`id mismatch`, 413, 500), `GET`/`PUT /api/brewery` (404 bis zum ersten Speichern). `readText`/`writeText` sind ohne Verhaltensänderung aus `RecipeStore.cpp` nach `SdText` gewandert, `writeText` nimmt das Verzeichnis als Parameter. Die Liste liest jede Datei direkt aus dem Verzeichnis-Eintrag, statt sie ein zweites Mal zu öffnen.
- **Web:** `web/src/brewhouse.ts` mit Modell (Behälter, Geräte, Schritte, Transfers, Messungen; Brauerei-Ebene) und reinen Funktionen `heatingOf`, `checkBrewhouse`, `vesselLabel`, `assignStep`/`addDevice`/`removeVessel`/`removeDevice` und `TEMPLATES`. Seiten `BrewhousePage` (Brauerei-Karte, Sudhaus-Liste, Vorlagen-Dialog) und `BrewhouseEditPage` im Paket `recipes`, Route `/settings/anlage[/sudhaus/:id]`, Eintrag „Brauanlage“ nur mit Paket. Neue Entwürfe öffnen über `?vorlage=`/`?von=` und werden erst mit „Speichern“ angelegt.
- **Abweichungen vom Plan:** `updatedAt` ist wie beim Rezept eine Epoch-ms-Zahl, kein String. Die Vorlage „Leer“ besteht die Prüfung nicht (ihr fehlen die Pflichtschritte); alle anderen ja. Ein gelöschter Behälter nimmt den Ort seiner Geräte nicht mit: sonst würde eine Heizquelle darin stillschweigend zur Inline-Heizung („indirekt über RIMS-Rohr“), so meldet die Prüfung die Lücke. Die Vorlage „Maische-/Würzepfanne + Läuterbottich“ bekommt einen Einkocher für den Nachguss. Der „manuelle Sensor“ stand schon im Backlog und ist dort nur ergänzt.
- **Prüfung:** `pio test -e native` 140/140 (neu `test_json_doc_files`), `pio run` für `lilygo_t_display_s3_amoled` und `esp32dev`; im `esp32dev`-ELF kein `JsonDocDir` und keine `/api/brewhouses`-Strings. `pnpm test` 199/199 (42 in `brewhouse.test.ts`), `typecheck`, `build`; der Sudhaus-Code landet nur im Paket-Chunk. Redocly-Lint grün. UI gegen einen Node-Mock (`/api` + `dist`): jede Vorlage fehlerfrei, „angeschlossen“ ohne Verknüpfung sperrt das Speichern, Pumpe löschen → „indirekte Heizung braucht eine Umwälzpumpe“, Behälter löschen, fremde Registry-ID als „(fehlt)“, Einheiten-Hinweis, Sprung aus der Prüfung, Duplizieren/Löschen, Brauerei speichern, 375 px ohne Querscrollen.
- **Am LilyGo** (Firmware und `webui-full.tar` per OTA): `PUT` mit `a.b` → 400 `invalid id`, fremde Body-ID → 400 `id mismatch`, Array-Body → 400 `invalid JSON`, 17-KB-Body → 413, `DELETE` unbekannt → 404, `PUT /api/breweryX` → 404. In der UI 3-Kessel-HERMS angelegt, Heizstäbe mit Regler `Maischen` bzw. Aktor `kettle`, Pumpe mit `IDS1`, zwei Messungen mit `HLT` und `Durchfluss.volume` verknüpft (Einheiten-Hinweis bei `gyro.tilt` erschien), umbenannt, gespeichert. Fünf Sudhäuser listen in ~125 ms (11 KB), `PUT` ~0,1 s. Kopien in der UI gelöscht, Brauerei gespeichert. Nach einem Neustart (Laufzeit ~10 s, Regler wieder aktiv) sind Sudhaus, Verknüpfungen und Brauerei da, die Prüfung zeigt keine Hinweise; auf der SD liegen nur `/brewhouses/<id>.json` (2,2 KB) und `/brewery.json`, keine `.tmp`-Reste. Das Sudhaus „Testanlage HERMS“ und die Brauerei-Werte 19 °C / 11 °C sind auf dem Board geblieben.
- **Offen:** Sudhäuser im Backup, danach Etappe 2 (Wasser-Tab).

**Nachtrag 2026-10-05, Editor in Tabs mit Anlagenschema.** Der Nutzer fand die Editor-Seite zu lang. Nach einem Mockup (Canvas <https://claude.ai/artifact/FTzMBuDbcCZaksoJAXrASH>) hat der Editor jetzt Tabs (Übersicht · Behälter · Geräte · Schritte · Transfers · Messungen) mit Anzahl und Fehlerzahl je Tab, die Seite nutzt die volle Breite (max. 1280 px). Die Übersicht zeigt Allgemein, Prüfung und das Anlagenschema (`BrewhouseSchema.tsx`, Modell `schemaOf` in `brewhouse.ts`): Karten in Prozessreihenfolge, Pfeile zwischen Nachbarn durch die Lücke, alle anderen über Bahnen oberhalb (Umwälzung, auch als Schleife am selben Behälter) und unterhalb (Transfers); die Lage misst die Komponente nur an der Höhe der Kartenreihe. Karten, Schritt-Chips, Geräte und Pfeil-Beschriftungen springen in ihren Tab und scrollen zur Stelle, ebenso Prüfung und Fehlerzahl im Kopf. Geprüft: `pnpm test` 203/203 (4 neue Fälle zu `schemaOf`), `typecheck`, `build`; im Mock alle Vorlagen, Schleife beim Ein-Topf, untere Bahn bei Pfanne + Läuterbottich, Sprünge in jeden Tab, Fehlerzahl am Tab und rote Gerätezeile im Schema, 375 px ohne Seiten-Querscrollen. Abweichung vom Mockup: Am Handy scrollt das Schema seitlich statt senkrecht zu laufen (PLAN.md).

**Nachtrag 2026-10-06, Layout nach Nutzer-Mockup.** Der Nutzer hat die ersten drei Tabs im Browser umgebaut (HTML + Screenshots, nicht im Repo). Umgesetzt: Seite in der Breite der Einstellungen (`PageShell` ohne `wide`), nur das Schema blutet über ein `@container` um die Seite mit `cqw`-Rändern bis an den Fensterrand und scrollt links über die Spalte hinaus, statt dort abgeschnitten zu werden; Gruppenüberschriften im Einstellungs-Stil über den Karten statt Kartentitel, je Behälter, Gerät, Schritt, Transfer und Messung eine eigene Karte (auch in den drei Tabs ohne Mockup), die Sammel-Überschrift „Geräte“ entfällt; Allgemein und Prüfung untereinander; Schema ohne Hintergrundfläche, Legende als graue Zeile. Am Behälter fällt die Bezeichnungszeile unter dem Namen weg, das Art-Auswahlfeld zeigt stattdessen die passende Art (`vesselPreset` in `brewhouse.ts`, aus `vesselLabel` herausgelöst) oder „eigene Zusammenstellung“; vorher stand dort immer „— wählen —“. Geprüft: `pnpm test` 204/204, `typecheck`, `build`; im Mock Scroll-Bereich bündig mit `main` (kein Seiten-Querscrollen), erste Karte bündig mit der Spalte, Art-Feld nach Haken und Zurücksetzen, Sprung aus dem Schema, 375 px.

**Nachtrag 2026-10-06, Aufguss statt Pumpenfehler.** Entscheidung aus der Planung, die erst nach Umsetzungsbeginn kam: Maischen braucht immer eine Heizquelle; wer per Aufguss maischt, legt die Wasserquelle (notfalls den Wasserkocher) als Behälter mit Heizquelle an. Sitzt die Heizquelle beim Maischen in einem anderen Behälter ohne Spirale und ist keine Pumpe gewählt, liefert `heatingOf` jetzt `via: 'infusion'` („Aufguss aus …“, Karte „Aufguss“) statt des Fehlers „indirekte Heizung braucht eine Umwälzpumpe“; HERMS, RIMS-Rohr und alle anderen Schritte verlangen die Pumpe weiter (`needsPump`). Kühlen beim Maischen braucht kein Gerät, es geschieht durch Zubrühen (kaltes Wasser, Eis). Im Konzept nachgezogen: Zubrühen in beide Richtungen mit Grenzen Leitungswasser bis Siedepunkt, Dekoktion aus dem Sudhaus abgeleitet statt Schalter, Ausgangstemperatur des Hauptgusses = Leitungswasser der Brauerei-Ebene statt Annahme 14 °C. Geprüft: `pnpm test` 207/207 (3 neue Fälle, Kettle-RIMS-Fall jetzt mit Pumpe), `typecheck`; nicht im Browser angesehen, die Anzeige nutzt unverändert `heatingText`.

## 2026-10-06 — Wasser-Tab, Etappe 2a: Wassermengen (Branch `feat/wasser-mengen`)

Zweite Etappe des Rezept-Editors nach der Brauanlage. Die Etappe ist geteilt: 2a bringt die Wassermengen, 2b (eigener Plan) die Aufbereitung mit Salzen, Säuren, Wasserprofil und pH. Entscheidungen des Nutzers: Die Ausschlagmenge ist die Würze heiß im Kessel am Kochende, alles danach rechnet später die Abfüllmenge vorwärts. Der Treberverlust ist eine Vorgabe am Läuterbehälter, die das Rezept wie die Verdampfung überschreiben kann. Die Hopfenform kommt erst mit der Abfüllmenge.

- **Sudhaus:** `Vessel.grainAbsorptionLPerKg` (nur am Läuterbehälter im Editor, Platzhalter 0,96), `DEFAULT_GRAIN_ABSORPTION = 0.96` (Brewfather-Vorgabe, Literatur 0,8–1,0, Wert vom Nutzer) und `grainAbsorptionOf`; die Vorlagen haben Sack 0,6, Malzrohr 0,8 und Senkboden 0,96. Messungen umbenannt (Keys unverändert): `postBoilVolume` heißt „Ausschlagmenge“, `batchVolume` „Anstellwürze“. `OptNum` ist aus dem Sudhaus-Editor nach `pages/recipe/fields.tsx` gewandert und hat jetzt einen Platzhalter.
- **Rezept:** optionale Felder `brewhouseId` und `water` (`sparge`, `mashRatioLPerKg`, `spargeTempC`, `evaporationLPerH`, `grainAbsorptionLPerKg`), alte Rezepte lesen die Vorgaben 3,5 l/kg und 78 °C.
- **Rechnung** `web/src/recipeWater.ts` (rein): Ausschlag + Verdampfung = Pfannevoll; dazu Würzeverluste aus den Transfers von Maischen und Läutern (Leitung bei Pumpe ohne „kommt zurück“, Totraum des Quellbehälters bei Pumpe oder Schwerkraft, einmal je Behälter) und Treber = Gesamtwasser; Haupt-/Nachguss oder Vollguss (ohne Schritt Nachguss immer); Einfüllmenge je Guss mit Leitung und Totraum des Quellbehälters beim ersten Guss daraus. Hinweise ohne Sperre, darunter zu kleiner Koch- oder Maischbehälter (Verdrängung 0,75 l/kg aus dem Braumagazin, Wert vom Nutzer; sie dient nur dem Maischevolumen).
- **UI:** Editor lädt die Sudhäuser einmal je Rezept; Übersicht mit Select „Sudhaus“ („— keins —“, gelöschtes als „<id> (fehlt)“, ohne Sudhäuser Link „Brauanlage einrichten“). Neuer Tab „Wasser“ (`WaterTab.tsx`) zwischen Zutaten und Maischen: Kennzahlen mit „einfüllen x l“, Schalter „Mit Nachguss“ (beim Sudhaus ohne Nachguss gesperrt und begründet), Eingaben mit Platzhalter aus dem Sudhaus und Knopf „Sudhaus-Wert“, Balken mit Legende und Hover-Titel, Aufklappbereich „Berechnung“ mit Herkunft jeder Zahl. Für den Balken neue Tokens `--series-1…4` in `styles.css` (Kategorie-Palette, hell und dunkel mit dem Palette-Check der dataviz-Skill geprüft; Slots 3/4 unter 3:1 auf hell, deshalb Werte in der Legende). `Stat` zeigt Zahlen jetzt mit Komma, das betrifft auch die Kennwerte der Übersicht.
- **Prüfung:** `pnpm test` 218/218 (neu `recipeWater.test.ts` mit festen Zahlen je Vorlage Ein-Topf, Pfanne + Läuterbottich und 3-Kessel-HERMS, dazu Überschreibung, „kommt zurück“, Vollguss, Nachguss < 0, Hinweise; `grainAbsorptionOf` in `brewhouse.test.ts`), `typecheck`, `build`, Redocly-Lint (nur die bekannte `info-license`-Warnung). UI gegen einen Node-Mock (`/api/recipes`, `/api/brewhouses` + `dist`): HERMS-Zahlen wie im Test, Verdampfung überschreiben und zurücksetzen, „Berechnung“, Ein-Topf mit gesperrtem Schalter und Vollguss, gelöschtes Sudhaus, Treberverlust im Sudhaus-Editor, 375 px. Nicht am Gerät geprüft; die Firmware ändert sich nicht (Rezept und Sudhaus sind für sie opak).
- **Offen:** 2b Aufbereitung, Hopfenform und Abfüllmenge (PLAN.md).

## 2026-10-06 — IMUs QMI8658, BMI270, BMI160, Phase 1: Treiber und Item-Typen (Branch `feat/imu-treiber`)

Der Nutzer hat ein Waveshare ESP32-S3-Touch-AMOLED-1.75 (QMI8658), eine M5Stack StopWatch (BMI270) und ein BMI160-Breakout bestellt; Ziele sind Tilt-Hydrometer, rohe IMU-Werte und Display-Orientierung, beide Boards inklusive Display. Umgesetzt in vier Phasen mit je eigenem PR; dies ist Phase 1, die Boards und die Orientierung stehen als „Neue Boards“ in PLAN.md. Bewegungs-Kanal, Display-Wake und Deep-Sleep-Wake per IMU sind nur als Zukunfts-Punkte in PLAN.md.

- **Library:** neue Basis `ImuSensor` (sieben Kanäle ax…gz + temp, 5-s-Retry, Adress-Probe, Hot-Plug — vorher in `GY521Sensor`); ein Treiber implementiert nur `connectDevice()` und `readDevice()`. `GY521Sensor` darauf umgestellt, neu `QMI8658Sensor` (SensorLib 0.5.0, neuer `ImuDrv.hpp`-Treiber statt des als veraltet markierten, ±4 g/±500 °/s), `BMI270Sensor` (SparkFun BMI270 1.0.3 mit Bosch-Config-Blob, Library-Defaults) und `BMI160Sensor` (eigener Registertreiber, ±4 g/±500 °/s, `decode()` statisch und nativ getestet). `GY521TiltSensor` heißt generisch `ImuTiltSensor` und besitzt den Rohsensor als `unique_ptr<ImuSensor>`; `GY521TiltSensor` bleibt als Kurzform. Native Test-Hooks heißen jetzt `SensActCtrlTest::imu*` (vorher `gy521*`), gemeinsam für alle Treiber. Temperatur NaN → Kanal ungültig.
- **Firmware:** `ImuTypes.h` (Typ → Default-Adresse: GY521/BMI270/BMI160 0x68, QMI8658 0x6B); `itemBusType`, `collectAddresses` und der Factory-Zweig in `DynamicItems.cpp` nutzen sie. Kanäle, Maske und Kalibrierung wie beim GY521.
- **API/Web:** `openapi.yaml` (Typ-Enum, Bus, Adresse, Kanäle), drei Katalogeinträge in „Beschleunigung / Tilt“, `AddItemModal` nimmt für alle IMUs das GY521-Formular mit typabhängigen Adress-Buttons (QMI8658 0x6b/0x6a).
- **Prüfung:** SensActCtrl `pio test -e native` 315/315 (neu `test_imu_drivers`), Firmware 140/140, `pio run` für esp32dev, lolin_s2_mini, lilygo_t_display_s3_amoled; `pnpm typecheck`, `pnpm test` 218/218, Redocly-Lint wie auf main (1 vorbestehende Warnung). Formular im Browser gegen einen Proxy, der GETs ans LilyGo durchreicht und Schreibzugriffe abfängt: QMI8658 zeigt 0x6b/0x6a, BMI270 0x68/0x69, der abgefangene POST war `{"type":"QMI8658",…,"address":107,"channels":["pitch"]}`.
- **Kosten:** rund 35 KB Flash; esp32dev 95,0 → 96,9 % (PLAN.md).
- **Offen:** alles am Gerät — die Hardware ist noch nicht da (PLAN.md „Neue IMUs … am Gerät“).

## 2026-10-07 — Neue Boards, Phase 2: Board-Auswahl per Flag und Waveshare ESP32-S3-Touch-AMOLED-1.75 (Branch `feat/board-waveshare`)

Zweite von vier Phasen (Plan im Eintrag vom 2026-10-06, Reste in PLAN.md „Neue Boards“). Baut auf Phase 1 (`feat/imu-treiber`) auf, weil der QMI8658 des Boards ein normales IMU-Item wird.

- **Board-Auswahl:** `BoardPins.h` wählte das Board über `CONFIG_IDF_TARGET_ESP32S3` — jedes S3-Board wäre als LilyGo behandelt worden. Jetzt wählen `BREWCTL_BOARD_LILYGO_AMOLED` bzw. `BREWCTL_BOARD_WAVESHARE_AMOLED175` Pin-Tabelle, festen Bus und die `static_assert`s; ein S3-Build ohne Flag bricht mit `#error` ab. `DisplayUI.cpp` hat die Panel-/Touch-Pins je Board, `kLcdEn = -1` (Waveshare ohne Enable-Pin) und optional einen Touch-Reset-Pin, den SensorLib in `begin()` pulst.
- **Env `waveshare_s3_amoled_175`:** `esp32-s3-devkitc-1` mit den Speichereinstellungen des LilyGo-Boards (16 MB QIO, OPI-PSRAM, `default_16MB.csv`, USB-CDC). Pins aus Waveshares `pin_config.h` und `HARDWARE_REFERENCE.md`; die Display-Initialisierung von Waveshares LVGL-Beispiel passt zu unserem Stack (gleicher CO5300-Konstruktor mit Spaltenoffset 6, Touch auf beiden Achsen gespiegelt, keine PMU-Initialisierung nötig) — das im Plan genannte AXP2101-Risiko ist damit kleiner geworden. SD läuft im **SDMMC-1-Bit-Modus** (`BREWCTL_SD_MMC_*`, neuer Zweig in `main.cpp`, `deviceFs = SD_MMC`); sonst nutzt nichts den `SD`-Global direkt. Fester Bus `i2c-board` (15/14) reserviert PCF85063, AXP2101, ES8311, ES7210, TCA9554 und Touch, **nicht** den QMI8658 (0x6B). Release-Matrix um das Env ergänzt; es bekommt `webui-full.tar` (kein `BREWCTL_ASSETS_IN_PLACE`).
- **Prüfung:** Firmware `pio test -e native` 141/141 (neu `test_waveshare_board_pins`, Waveshare-Fall in `test_i2c_address_map`), `pio run` für alle vier Envs; im Waveshare-Image stecken SD_MMC und die Waveshare-Adresstabelle, nicht die des LilyGo; das LilyGo-Image ist byte-gleich groß wie vor der Änderung. Am LilyGo per OTA: bootet (`resetReason sw`), fester Bus mit den LilyGo-Adressen, GY-521 über den umgebauten `ImuTiltSensor` mit plausiblen Werten (az ≈ 0,96 g) — damit ist die Phase-1-Umstellung des GY-521 auch an echter Hardware bestätigt.
- **Offen:** alles am Waveshare selbst (PLAN.md „Waveshare … am Gerät“).

## 2026-10-07 — Neue Boards, Phase 3: M5Stack StopWatch (Branch `feat/board-m5-stopwatch`)

Dritte von vier Phasen, gestapelt auf Phase 2 (`feat/board-waveshare`). Die Hardware ist noch nicht da.

- **Quellen:** Die Pin-Tabelle auf docs.m5stack.com ist für das Display falsch (sie nennt TE = GPIO 38 als D0). Maßgeblich ist der StopWatch-Zweig der Autodetection in M5GFX (`src/M5GFX.cpp`): QSPI CS 39, SCLK 40, D0–D3 41/42/46/45, TE 38; Panel 480×480 RAM mit Offset 6; Touch CST820 auf 0x15 mit 0…233; M5PM1 auf 0x6E (ID 0x2050), M5IOE1 auf 0x4F. Tasten (A = GPIO 2, B = GPIO 1), I2S (15–18, 21) und Grove (10/11) aus M5Unified.
- **`src/BoardInit.cpp`** (neu): auf der StopWatch direkt nach dem Start des Board-Busses — M5PM1: I2C-Schlaf aus, Watchdog aus, `PWR_CFG |= 0x17` (3,3-V-LDO/DC-DC, Laden, LED); M5IOE1: I2C-Schlaf aus, IO1/3/4/5/8 als Push-Pull-Ausgänge, IO1/4/5/8 high, Panel- und Touch-Reset (IO5/IO4) pulsen, Lautsprecher-Verstärker (IO10) aus. Die erste Transaktion je Chip wird bis 200 ms wiederholt, weil beide zwischen Transaktionen schlafen. Auf den anderen Boards ein No-op.
- **Display:** `DisplayUI.cpp` wählt Touch-Chip, Adresse, Skalierung und Spiegelung je Board (`TouchChip`, `kTouchScale`, `kTouchMirror`); StopWatch: `TouchDrvCST816`, Faktor 2, keine Spiegelung, Panel-Reset per Software (Pin am Expander).
- **Env `m5stack_stopwatch`:** LittleFS auf der 3,4-MB-Datenpartition von `default_16MB.csv`, ohne `BREWCTL_ASSETS_IN_PLACE`. `FirmwareUpdater` nimmt für **alle** LittleFS-Boards `webui.tar`, nicht nur für die mit kleiner Partition — ohne SD gibt es keine Rezept-API, das Rezept-Paket aus `webui-full.tar` liefe ins Leere. Release-Matrix ergänzt. `main.cpp` braucht jetzt `<Wire.h>` selbst (kam vorher nur über SD/SPI mit).
- **Prüfung:** Firmware `pio test -e native` 142/142 (neu `test_m5_stopwatch_board_pins`, StopWatch-Fall in `test_i2c_address_map`), `pio run` für alle fünf Envs; im StopWatch-Image stecken BoardInit, die M5-Adresstabelle, CST820 und LittleFS. Am LilyGo per OTA, weil sich der Touch-Lesepfad geändert hat (Skalierung und Spiegelung über Konstanten).
- **Offen:** alles an der StopWatch selbst, dazu der Werksreset (keine BOOT-Taste an GPIO 0) — PLAN.md „M5Stack StopWatch am Gerät“.

## 2026-10-07 — Neue Boards, Phase 4: Display-Orientierung aus der IMU (Branch `feat/display-orientierung`)

Letzte der vier Phasen, gestapelt auf Phase 3 (`feat/board-m5-stopwatch`).

- **Settings:** `display.rotation` (0/90/180/270, sonst 400), `display.orientationSensor` (Item-Id, wie `energy.batterySensor` nicht gegen die Registry geprüft) und `display.orientationMirror`. Ohne Sensor ist `rotation` die feste Drehung, mit Sensor der Ausgleich der Einbaulage — ein Wert statt zweier, und die Web-UI benennt die Karte je nach Modus um. Der Spiegel-Schalter war nötig, weil eine IMU auf der Rückseite der Platine das Panel von hinten sieht und die Drehrichtung dann umkehrt; ein Winkel allein deckt das nicht ab.
- **`DisplayOrientation.h`** (rein, nativ getestet): Quadrant aus `atan2(roll, pitch)` (dieselbe Peilung wie der `dir`-Kanal) mit 15° Hysterese hinter der Diagonale und 30° Mindestneigung; `rotatePoint`/`unrotatePoint`. Pitch/Roll statt ax/ay, weil sie gefiltert sind und jedes IMU-Item sie in der Default-Maske hat.
- **Drehung in Software statt MADCTL:** Der CO5300 kann keine 90° (`Arduino_CO5300.cpp`), und ein X/Y-Flip schiebt den Spaltenoffset (480er RAM, 466er Glas, 6 px links / 8 px rechts) auf die andere Seite. LVGLs `sw_rotate` hätte für 90/270 bis zu 10 KB aus dem 32-KB-Pool geholt — der ist mit den Seiten schon knapp (Watchdog-Reboot bei vollem Pool). Stattdessen rendert LVGL immer aufrecht, `flush()` dreht jeden Block streifenweise durch einen eigenen 8-KB-Puffer (intern, DMA-fähig, erst bei der ersten Drehung allokiert), `readTouch()` dreht zurück. Der `rounder()` bleibt für alle Lagen gültig, weil 465 ungerade ist. Die Lage wird höchstens alle 250 ms geprüft, der Sensor jedes Mal per Id gesucht (kein gehaltener Item-Zeiger); ein Wechsel invalidiert den ganzen Bildschirm.
- **Prüfung:** Firmware `pio test -e native` 148/148 (neu `test_display_orientation`), `pio run` für alle fünf Envs, `pnpm typecheck`, `pnpm test` 218/218, Redocly-Lint wie zuvor. **Am LilyGo per OTA:** `rotation: 45` → 400; feste 90° — Bild und Touch korrekt (vom Nutzer bestätigt), interner Heap danach 90,7 KB frei; dann `orientationSensor: "gyro"` (externer GY-521) — in allen vier Lagen aufrecht, flach bleibt die Lage (vom Nutzer bestätigt), ganz ohne Ausgleich oder Spiegelung. Einstellungsseite im Browser gegen den Lese-Proxy: Umschalten auf „Fest“ benennt die Karte um, blendet den Spiegel-Schalter aus und schickt den richtigen Body. Das LilyGo folgt seitdem dem GY-521 (`display.orientationSensor = "gyro"`).
- **Offen:** Einbaulage-Ausgleich und Drehrichtung für die Onboard-IMUs von Waveshare und StopWatch — in den beiden „am Gerät“-Punkten in PLAN.md.

## 2026-10-07 — Wasser-Tab, Etappe 2b-1: Aufbereitung von Hand, High Gravity (Branch `feat/wasser-aufbereitung`)

Erster von drei PRs der Etappe 2b (Plan `wasserrechner-etappe-2b.md`, danach 2b-2 pH-Modelle, 2b-3 Automatik). Entscheidungen des Nutzers (2026-10-06/07): Zeitpunkt je Gabe statt Schalter („Brauwasser“ oder gezielt), geplanter Verschnitt gehört ins Rezept (Ort je Rezept, zuletzt geändert führt), Wasserprofile auf Brauerei-Ebene. Testfall ist die Analyse des Nutzers (WW Wittkoppenberg, 03.03.2026).

- **Chemie** `web/src/waterChem.ts` (rein): 13 Mittel nach MMuM (Salze in g, Säuren und CaCl₂-Lösung in ml mit Dichtetabelle), Mischung nach Volumen (Ionen, Alkalität, Carbonat), RA nach Troester in mEq/l (Säuren mit dem bei pH 5,4 dissoziierten Anteil, Kreide halb), Wasser-pH aus dem Kalk-Kohlensäure-Gleichgewicht per Bisektion, `acidForPh` invers dazu, Ionenbilanz.
- **Brauerei:** `Brewery.waters`/`defaultWaterId`; Abschnitt „Wasserprofile“ in der Karte Brauerei (`pages/WaterProfiles.tsx`, Liste plus Dialog mit Umrechnung aus KS4,3, Karbonat-, Calcium- und Magnesiumhärte, Hinweis ab 10 % Ionenbilanz-Abweichung). VE-Wasser ist fest eingebaut. `openapi.yaml` › `Brewery`/`WaterProfile`; Firmware unverändert.
- **Rezept/Katalog:** Zeitpunkte `water` („Brauwasser“) und `dilution` („Verschnitt“) nur für Hilfsstoffe, Scope `water`; `Ingredient.strengthPct`; `RecipeWater.sources`/`dilution`/`targetPh`. `Auxiliary.waterAgent` ersetzt das ungenutzte `ions`, 13 Katalogeinträge `aux:…` (Milchsäure 80 %, Phosphorsäure 75 %, Salz- und Schwefelsäure 10 %, CaCl₂-Lösung 33 %).
- **High Gravity** (`recipeWater.resolveDilution`): In der Pfanne kocht Ausschlag − Verschnitt, die Rückrechnung der Wassermengen beginnt dort; Hinweis mit „übernehmen“, wenn Pfannevoll nicht in den Kochbehälter passt. Im Gärbehälter kommt Ausschlag − Kühlschwund − Transferverluste ab Whirlpool an, die Stammwürze folgt aus der Massenbilanz. `calcStats(recipe, catalog, bh?)`: OG nach dem Verschnitt, IBU mit Pfannenmenge und -SG, verdünnt; beim Gärbehälter verdünnt sich auch die Farbe. Neue reine Hilfe `wortExtract`, `brewMath.volumeFromExtract`.
- **Aufbereitung** `web/src/recipeTreatment.ts` (rein) und Karte `TreatmentCard.tsx`: Spalten Hauptguss · Maische · Nachguss · Verschnitt (leere entfallen, mobil als Reiter), Ausgangswasser mit „+ x %“ Zweitwasser, Gaben mit Zeitpunkt, Menge, Konzentration, Brauwasser-Anteile ausgegraut, Ergebnis mit Vorher-Wert, Säurehilfe je Wasserspalte, „Berechnung“ und Hinweise. Wassermenge mit Abschnitt „Verschnitt“ und Balkensegment. Zutaten › Hilfsstoffe zeigen Katalog-Einheit und Konzentration. Übersicht: Karte „Charakter“ mit der SO₄:Cl-Skala des Hauptgusses.
- **Nachtrag nach Durchsicht des Nutzers:** Zeitpunkte „Würze vor dem Kochen“ (`preBoil`) und „Ausschlagwürze“ (`knockOut`) für Hilfsstoffe, auch im Tab Würzekochen; Spalten „Vor dem Kochen“ (Pfannevoll, Maische und Nachguss nach Volumen gemischt) und „Ausschlag“ (durch das Kochen konzentriert, mit einem Verschnitt in der Pfanne) nur bei Gaben dort, dazu immer „Gesamt“ (Beitrag von Wasser und Gaben zum Bier, mit einem Verschnitt im Gärbehälter; Malz-Ionen und Ausfällung nicht gerechnet). In diesen Spalten nur Ionen und SO₄ : Cl, der Würze-pH kommt mit 2b-2. Messungen `preBoilPh` und `postBoilPh` im Schritt Kochen.
- **Abweichungen vom Plan:** `WaterProfile` steht in `waterChem.ts` (die Chemie braucht es), `brewhouse.ts` importiert es. Die Rezept-Rechnung der Aufbereitung hat ein eigenes Modul `recipeTreatment.ts` statt `recipeWater.ts`. Die Gaben werden in ihrer Zeile bearbeitet (Name, Zeitpunkt, Gesamtmenge, Konzentration), die Spalten zeigen nur, was ankommt; der Canvas hatte je Spalte ein Eingabefeld. Phosphorsäure zählt mit allen drei pKa. Die Säurehilfe nimmt die erste gezielte Säure der Spalte. Ein Ortswechsel des Verschnitts behält die Menge, weil die Stammwürze dann eine andere Würze meint. Das Analyse-RA 2,28 mEq/l stimmt mit HCO₃ aus KS4,3 (3,73 × 61,02 = 227,6 mg/l); mit dem ausgewiesenen HCO₃ 224,5 mg/l sind es 2,23.
- **Prüfung:** `pnpm test` 245/245 (neu `waterChem.test.ts` 10, `recipeTreatment.test.ts` 8, High Gravity in `recipeWater.test.ts` und `recipeStats.test.ts`), `typecheck`, `build`, Redocly-Lint (nur die bekannte `info-license`-Warnung). UI über den Node-Mock im Scratchpad: Profil des Nutzers angelegt (RA 6,4 °dH), Pils mit 70 % VE, Säurehilfe Nachguss auf pH 5,8 legt 1,19 ml Milchsäure 80 % an (pH 5,80); 30 l Ausschlag im 20-l-Topf: Hinweis 13,0 l, 10 l in der Pfanne ↔ 12,3 °P in beide Richtungen, Wechsel auf Gärbehälter (27,8 l kommen an); Spalten Nachguss/Verschnitt ein- und ausgeblendet, 375 px ohne seitliches Scrollen; nach dem Nachtrag alle sieben Spalten bei Desktop-Breite ohne seitliches Scrollen, Calcium von 57 über 80 (2 g CaCl₂ vor dem Kochen) auf 77 mg/l im Ausschlag (× 1,2 Kochen, × 0,8 Verschnitt), die zwei pH-Messungen im Sudhaus-Editor.
- **Offen:** Dichten der Säuren (CRC aus dem Gedächtnis) und die Grenzen der SO₄:Cl-Skala gegen Quellen prüfen; 2b-2, 2b-3, CaO-Entcarbonisierung, Sud-Vorschläge aus Messwerten (PLAN.md).

## 2026-10-07 — Wasser-Tab, Etappe 2b-2: pH von Maische und Würze (Branch `feat/wasser-ph`)

Zweiter von drei PRs nach dem Plan `wasserrechner-etappe-2b.md`: pH-Schätzung für Maische und Würze mit Malzdaten, umschaltbar zwischen Troester und Kolbach, dazu eine Säure- und Basenhilfe.
- **Modelle** in `web/src/mashPh.ts` (rein). `Brewery.phModel` (`troester` als Vorgabe, oder `kolbach`) gilt für alle Rezepte, der Select steht in der Karte „Brauerei“, `openapi.yaml` › `Brewery` ist ergänzt. Troester 2009: pH der Schüttung in destilliertem Wasser plus (0,013·R + 0,013)·RA. Kolbach: nur RA mit Palmers Zielbereich nach Bierfarbe, ohne pH.
- **Entscheidung des Nutzers (Abweichung vom Plan):** Säure, die über die Alkalität des Wassers hinausgeht, läuft nicht linear über die RA. Sie wirkt auf die Pufferung der Schüttung: 38,5 mEq/(kg·pH) aus Troesters Maische-Titration, Literatur ≈ 40.
  - Grund: Troesters eigene Salzsäure-Reihe (Tabelle 3, Pilsner). Linear liegt sie bis 0,2 pH daneben, mit der Pufferung innerhalb 0,04.
  - Beispiel Pils (5 kg, 3,5 l/kg, 70 % VE) auf 5,4: 7,9 ml Milchsäure 80 %. Linear wären es 11,2 ml, „wie Malzsäure“ 4,7 ml.
- **Zweite Entscheidung:** Spezialmalz ohne Daten zählt bis 25 EBC wie Basismalz, darüber wie Karamellmalz. Der Plan sah immer Basismalz vor.
- **Malzdaten:** `Malt.distilledWaterPh`, `acidityMeqPerKg`, `lacticAcidPct`. Fehlen sie, wird nach Rolle geschätzt (mit Hinweis):
  - Basismalz 5,82 − 0,02·EBC
  - Karamellmalz 14 + 0,13·EBC mEq/kg
  - Röstmalz 40 mEq/kg
  - Sauermalz aus dem Milchsäuregehalt
  - Rohfrucht wie Basismalz
  - Unverknüpfte Malze bleiben außen vor.
  - Die Weyermann-Datenblätter im Katalog nennen keine dieser Werte, ergänzt wurde deshalb nichts.
- **Maische-Spalte:** Der pH steht vor und nach der Gabe „Maische nach pH-Messung“. Dafür hat `calcTreatment` den Zwischenzustand `mid`. Die Hilfe „Säure/Base berechnen“ hat Ziel 5,4 als Vorgabe und legt die Gabe mit Zeitpunkt `mashPh` an.
- **Würze:** Eine grobe Schätzung, die beim Maische-pH startet und die Pufferung je kg Schüttung behält.
  - Nachguss, Verschnitt und Gaben wirken mit Restalkalität × Menge. Das Kochen senkt um 0,15 (Troester: 0,1–0,2).
  - Säure- und Basenhilfe gibt es für „Vor dem Kochen“ und „Ausschlag“. Liegt der pH unter dem Ziel, legt sie Natron an (Kveik).
  - „Gesamt“ zeigt den Anstell-pH.
- **Weitere Änderungen:**
  - `RecipeWater.targetPh` hat jetzt den Schlüssel `PhKey` (dazu `mash`, `preBoil`, `knockOut`).
  - `suggestAcid` wurde zu `suggestAgent`, `waterChem.acidForPh` zur allgemeinen Bisektion `amountForPh`.
  - Neu ist `recipeStats.beerEbc`, die Farbe für Kolbach.
  - Der RA-Bezug bleibt bei pH 5,4: Mit dem geschätzten pH ändert sich der Anteil zwischen 5,2 und 5,8 um höchstens 2 %.
- **Prüfung:**
  - `pnpm test` 259/259, neu `mashPh.test.ts` 8 Tests.
  - Troester nachgerechnet:
    - Tabelle 2: Gerade mittig, Einzelmalze bis 0,3 daneben, R² 0,54.
    - Tabelle 3 Pils: ±0,05 über −5,6 bis 7,2 mEq/l; Mischungen ±0,1 ab −1,75.
    - Tabelle 5: ±0,05 mit Schätzung nach Rolle, ±0,065 mit gemessener Säure.
    - Den im Plan verlangten Rahmen von ±0,05 hält nicht jede Tabelle.
  - `recipeTreatment.test.ts` hat 6 neue Tests. `typecheck`, `build` und Redocly-Lint laufen (nur die bekannte `info-license`-Warnung).
  - UI im Node-Mock mit dem Profil des Nutzers:
    - Pils 70 % VE: Maische ≈ 5,79. Die Hilfe legt 7,88 ml Milchsäure „Maische nach pH-Messung“ an, danach ≈ 5,40.
    - Ausschlag auf 5,6: 4,91 g Natron (vorher 5,30).
    - Kolbach: Ziel-RA −4,3 bis −1,0 °dH bei 7 EBC, kein pH.
    - Ohne verknüpftes Malz nur Hinweise; 375 px ohne seitliches Scrollen.
- **Offen** (PLAN.md):
  - Übertragbarkeit der Pufferung auf die Würze (`TODO(verify)`)
  - Palmer-Geraden gegen das Buch prüfen
  - Schwächen aus Troesters Tabellen 3 und 6
  - Malzdaten nur im Katalog-JSON
  - 2b-3 Automatik

## 2026-10-07 — Wasser-Tab, Etappe 2b-3: Zielprofile und Automatik (Branch `feat/wasser-automatik`)

Dritter und letzter PR nach dem Plan `wasserrechner-etappe-2b.md`: Zielprofile, ein Vergleich des Hauptgusses mit dem Ziel und der Dialog „Automatisch“.
- **Entscheidungen des Nutzers (2026-10-07):**
  - Mitgelieferte Zielprofile von Brewer's Friend (Zusammenfassung der Zielprofile ihres Rechners), Dortmund und Burton entcarbonisiert, Wien von Palmer (How to Brew, Tab. 21). Palmers Städte-Tabelle wurde verworfen, weil Palmer selbst schreibt, dass einige Profile chemisch nicht aufgehen.
  - Die Automatik passt nur Ca, Mg, Na, Cl und SO₄ an und bietet keine Basen an. Die Alkalität regelt die Säure über den Ziel-pH der Maische. Mit HCO₃ in der Anpassung gäbe sie Natron, das die Säure gleich wieder neutralisiert, oder triebe den VE-Anteil hoch, wo die Säure das HCO₃ ohnehin wegnimmt.
  - Das Ziel wird im Rezept gespeichert (`RecipeWater.target`) und auch ohne Automatik verglichen, als eigene Spalte „Ziel“ mit der Abweichung des Hauptgusses.
  - Unter Kolbach stellt die Säure die Restalkalität der Maische auf die Mitte des Zielbereichs nach Bierfarbe.
- **Modul** `web/src/waterSolver.ts` (rein): `TARGET_PROFILES` (12 Profile mit Quelle in `note`), `targetProfiles`, `resolveTarget`, `nnls` (Lawson-Hanson) und `autoTreat`.
  - Der Löser sucht den VE-Anteil von 0 bis 100 % in 1-%-Schritten und passt je Anteil die Salze per NNLS in mEq/l an. Ist das Ziel über einen Bereich erreichbar, gewinnt der kleinste Anteil (Toleranz 1e-4 (mEq/l)²; ohne sie entschied Rundungsrauschen, z. B. 99 % statt 98 %).
  - Danach die Säure „Maische nach pH-Messung“ über `amountForPh` auf den Ziel-pH bzw. die Ziel-RA.
- **Daten:**
  - `WaterProfile.target?: true` für eigene Zielprofile in `Brewery.waters`. `recipeTreatment.sourceWaters` filtert sie aus Ausgangswasser, Standardwasser und dem Rückfall auf das erste Profil. `openapi.yaml` › `WaterProfile.target` ist ergänzt.
  - `Ingredient.auto?: true` markiert Gaben der Automatik. Ein erneuter Lauf ersetzt sie, Bearbeiten (Aufbereitung oder Zutaten) nimmt die Markierung weg.
  - `waterChem` exportiert `MOLAR`/`CHARGE` und hat `agentAmount` (mmol → g/ml) sowie den Typ `TargetIons`.
- **UI:**
  - Karte „Aufbereitung“ mit den Knöpfen „Ziel“ und „Automatisch“. Die Spalte „Ziel“ hat einen Select (eigene, mitgelieferte, „Eigene Werte“ mit Eingabe in der Spalte), Zielwerte mit Abweichung (hervorgehoben ab 20 % bzw. 10 mg/l) und ist auf dem Handy ein Reiter.
  - Der Dialog bietet Ziel, Salze, Säure, Anteil frei/fest und Ziel-pH der Maische. Die Vorschau zeigt Ziel/jetzt/Vorschlag und die Gaben (neu, entfällt, bleibt). Erst „Übernehmen“ schreibt.
  - Der Brauerei-Editor hat den Haken „Zielprofil“ und ein Abzeichen „Ziel“ in der Liste.
- **Prüfung:**
  - `pnpm test` 269/269, neu `waterSolver.test.ts` mit 9 Tests (NNLS, exakt erreichbares Ziel, Pilsen ≥ 85 % VE, keine negativen Mengen bei allen Profilen, Ersetzen der Auto-Gaben, Maische-pH, Kolbach-RA) und ein Test in `recipeTreatment.test.ts` (Zielprofil nie Ausgangswasser).
  - `typecheck`, `build` und Redocly-Lint laufen (nur die bekannte `info-license`-Warnung).
  - Löser mit dem Profil des Nutzers (Pils 5 kg, 20 l): Pilsen 93 % VE, „Hell, hopfig“ 98 %, „Ausgewogen“ 55 %, Dortmund 74 %, München 37 %; die Maische danach je ≈ 5,40, ein Lauf etwa 20 ms.
  - UI im Node-Mock: Ziel-Spalte mit Abweichungen, Dialog mit Vorschau, „Übernehmen“ (98 % VE, Gaben als „Brauwasser“, 5,38 ml Milchsäure nach pH-Messung). Dazu der Reiter „Ziel“ bei 375 px und ein eigenes Zielprofil im Brauerei-Editor (fehlt im Standardwasser).
- **Offen** (PLAN.md): Der Wasser-Tab ist damit fertig. Weiter offen sind CaO-Entcarbonisierung, im Sud Säure aus dem gemessenen pH und Verschnitt aus der gemessenen Stammwürze, sowie die pH-Punkte aus 2b-2.

## 2026-10-07 — SESSION.md aufgeräumt

Alle 107 Einträge vom 2026-09-01 bis 2026-09-30 sind unverändert nach
[SESSION-archive.md](SESSION-archive.md) gewandert; hier steht je ein Kurzabsatz
mit Verweis. Die Einträge ab 2026-10-01 bleiben voll. `SESSION.md` schrumpfte
von 6510 auf rund 1550 Zeilen (472 KB auf 150 KB), das Archiv wuchs auf rund
9300 Zeilen.

## 2026-10-08 — Einstellungsseite gegliedert, Logs in die Hauptnavigation

Die Einstellungsseite war eine flache Liste mit 17 Einträgen. Jetzt ist sie mit
dem vorhandenen `SettingsGroup` gegliedert und bleibt bewusst einspaltig:

- **Gruppen:** Brauanlage ohne Überschrift (nur mit Rezept-Paket), Hardware
  (Geräte, Bus-Schnittstellen, Gerätedisplay, Energiemanagement), Verbindungen
  (Netzwerk, Konnektivität), Oberfläche (Darstellung, Zeit & Formate), System
  (Systemstatus, Firmware-Update, Alarme & Benachrichtigungen, Backup & Restore,
  Dateiverwaltung, Zugriffsschutz). Gruppen ohne sichtbaren Eintrag entfallen.
- **Logs & Charts** steht in der Hauptnavigation unter `/logs` bzw.
  `/logs/:id/archive`. `/settings/logs…` leitet für alte Lesezeichen per
  `route(…, true)` um.
- **Alarme & Benachrichtigungen** (`/settings/meldungen`, `AlertsHubPage`) ist
  ein Hub wie Konnektivität. Die Karten zeigen die Zahl der Regeln, aktive Alarme
  und den Push-Status. Die Seiten selbst und ihre Routen bleiben getrennt, weil
  die Alarmliste (was) und die Push-Einrichtung (wohin) unterschiedlich gebaut
  sind. Sie bekommen nur einen dreistufigen Breadcrumb.
- **Prüfung:** `typecheck` und `build` laufen. Im Node-Mock geprüft:
  Einstellungsseite, Hub mit „1 aktiv“ und „inaktiv“, Umleitung von
  `/settings/logs` auf `/logs` mit aktivem Nav-Eintrag, Alarmseite bei 375 px.
  Konsole ohne Fehler.

## 2026-10-08 — Maischen-Tab Etappe 3a: Maischeplan, Wärmerechnung, Siedepunkt

Erster von vier PRs zum Maischen-Tab (Plan „Maischen-Tab Etappe 3“: 3a Plan und
Wärmerechnung, 3b Effizienz-Kette, 3c Maischprofile, 3d Dekoktion). Der Tab war eine
reine Rastenliste.

- **Modell** (`web/src/recipes.ts`): `MashStep` mit Art (`strike`, `doughIn`, `rest`,
  `infusion`, `decoction` erst in 3d), Zieltemperatur, Haltedauer, Schüttung und
  Zubrühen (`lead` Menge oder Temperatur, Eis). `Recipe.charges` und
  `Ingredient.chargeId` für Teilschüttungen. `normalizeMash` beim Laden: Einträge
  ohne Art fallen weg (keine Migration, Nutzerentscheidung), Wasser vorlegen und das
  erste Einmaischen stehen fest vorn. `addCharge`/`removeCharge` teilen bzw. führen
  Malz zusammen, die kg je Malz bleiben gleich.
- **Rechnung** (`web/src/mashPlan.ts`, rein): Wärmeäquivalent Wasser + 0,41 × Malz
  (Konstante jetzt `GRAIN_HEAT_RATIO` in `brewMath.ts`), Hauptguss-Temperatur,
  Mischtemperatur weiterer Schüttungen, Zubrühen in beide Richtungen und mit Eis,
  Grenzen Leitungswasser bis Siedepunkt, Heizzeit aus Heizrate oder geschätzt aus der
  Heizleistung (85 %), passives Abkühlen 0,2 K/min. Die Wassermenge zum Vorlegen
  (Hauptguss − Zubrühmengen) wird per Bisektion gelöst, weil nach Temperatur geführte
  Zubrühmengen mit der Maische wachsen. Im Aufguss-Sudhaus werden wärmere Rasten durch
  Zubrühen mit Siedepunkt-Wasser erreicht.
- **Siedepunkt:** `Brewery.altitudeM` (Karte „Brauerei“ mit berechnetem Siedepunkt),
  `pressureAtAltitudeHpa`/`boilingPointC` in `brewMath.ts`, neue Messung `airPressure`
  (Kochen, hPa/mbar). `hopIbu` skaliert die Kochausnutzung relativ zu 100 °C, Whirlpool
  wie bisher; `calcStats` bekommt die Brauerei. 500 m: 98,3 °C, im Mock 24 → 21 IBU.
- **UI:** `pages/recipe/MashTab.tsx` mit Kopfkarte, „Zutaten (Maische)“ mit
  Zwischenzeile je Schüttung (Name, Zeitpunkt, kg, %, EBC, °P), Split-Button
  „+ Schüttung“ mit Dialog „Schüttung aufteilen“, Maischeplan als Tabelle (Ziehgriff,
  mobil Pfeile, Split-Button „+ Rast“ mit Zubrühen, Einmaischen und sechs Rasten),
  `MashCurve.tsx` (uPlot, Rampen, Haltestufen, Zugaben). `IngredientCard` kann Gruppen
  und eine Markierung; der Zutaten-Tab zeigt die Schüttung. Die Übersicht zeigt die
  Gesamtdauer.
- **Doku:** Konzept-Doc (Maischen › Stand 3a, Brauerei-Höhe, Luftdruck), `openapi.yaml`
  (`Brewery.altitudeM`), PLAN.md (Näherungen des Maischeplans als offener Punkt).
- **Prüfung:** `pnpm test` (Siedepunkt, IBU bei 98 °C, `mashPlan.test.ts` mit Vorlegen,
  zweiter Schüttung, Zubrühen in beide Richtungen, Eis, Grenze nach Höhe, Heizzeit aus
  Rate und Leistung, Abkühlen, Aufguss, Überschuss; `normalizeMash` und Aufteilen),
  `typecheck`, `build`. Im Node-Mock: Weizen mit zwei Schüttungen und kaltem Zubrühen,
  Aufguss-Sudhaus (4,3 l kochend), altes Rezept ohne Plan, 500 m, Aufteilen 30 %,
  Ziehen samt Sperre über den festen Schritten, 375 px ohne Querscrollen.

## 2026-10-08 – 2026-10-09 — Peripherie-Abstraktion Etappe 3: externer DAC (MCP4728) (Branch `feat/peripherie-etappe-3`)

Geräte, die Fähigkeiten nachrüsten: Ein MCP4728 (4 × 12-Bit-DAC, I²C) gibt Boards ohne
eigenen DAC (LilyGo, Waveshare, StopWatch) echte Analogausgänge. Ein PR, je Etappe ein
Commit.

- **3a Library:** `core/DacOutput.h` (`rawMax()`, `write()`), neuer Konstruktor
  `AnalogOutputActuator(id, DacOutput&)` mit `fault()` „DAC antwortet nicht“, eigener
  Treiber `devices/MCP4728` (nur Multi-Write, Referenz VDD, Gain ×1, UDAC = 0, EEPROM nie
  beschrieben). Native Tests über einen Test-Hook statt `TwoWire`-Stub (Muster ImuSensor).
- **3b Firmware:** `DeviceConfig.h` (`kDeviceTypes`, Id `mcp4728-<bus>-<hh>`), Array
  `devices` in `registry.json` (geladen zwischen Bussen und Items), `/api/peripherals`
  (GET/POST/PUT/DELETE, Bus/Adresse nur ohne Nutzer). Kanal-Referenz
  `"<Geräte-Id>:<Kanal>"` im `pin`-Feld eines AnalogOutput mit `mode:"dac"`; eine Zahl
  bleibt der board-eigene DAC-Pin, keine Migration. `parsePinRef`, `PinUse.device`,
  Prüfungen 400/409, Gerätekanäle sind keine GPIOs (Konflikte, Deep-Sleep-Hold) und
  stehen in `GET /api/pins` unter `virtual`. Adressen je Bus gegen BME280/IMU geprüft,
  das Gerät zählt als Bus-Nutzer. `Mcp4728Device` hält eine `Ref` auf seinen Bus, der
  Aktor eine aufs Gerät; `PeripheralRegistry::release()` verschachtelt jetzt sicher
  (Slot vor dem Erase herausgelöst). OpenAPI, README.
- **3c Web:** Seite Einstellungen → Peripheriegeräte (`PeripheralsPage.tsx`: Karten mit
  Kanälen und Nutzern, „Prüfen“ per Bus-Scan, Anlegen mit Bus und Adresse 0x60–0x67).
  Im AnalogOutput-Formular PWM/DAC-Umschalter, sobald Board oder Gerät einen DAC hat
  (`availableCaps`), im DAC-Modus Auswahl aus Board-DAC-Pins und Gerätekanälen
  (`dacOutputs`), sonst ein Link auf die neue Seite. Bus-Seite nennt Geräte mit Namen.
- **3d Hardware (LilyGo, MCP4728 am Qwiic-Stecker, Multimeter):** Kanäle A–D liefern
  25/50/75/100 % von VDD (0,82 / 1,64 / 2,45 / 3,27 V bei 3,28 V), Zuordnung stimmt, UDAC = 0
  reicht. `enabled:false` legt 0 V an, Werte und Gerät überstehen einen Kaltstart, die
  Config nach dem Aufräumen ist identisch mit dem Backup. Display/Touch am selben Bus
  liefen bei allen Tests weiter. **Befund und Fix:** Nach Abziehen und Wiederanstecken
  startet der Chip mit seinen EEPROM-Werten (0 V); nur der danach beschriebene Kanal stand
  wieder richtig, die anderen blieben still auf 0 V bei „ok“, und ohne Write fiel ein
  fehlender Chip gar nicht auf. Jetzt schreibt `AnalogOutputActuator::tick()` einen
  externen DAC jede Sekunde neu (`kRefreshMs`): Abziehen meldet an allen Kanälen binnen
  1 s den Fehler (Alarm), danach stehen alle Spannungen wieder. Ein einmaliger
  HTTP-Ausfall von zwei Minuten blieb unerklärt und nicht reproduzierbar (PLAN.md).
- **PLAN.md:** Etappe 3 raus; offen bleiben Etappe 4 (Port-Expander) mit umformuliertem
  Pin-Manager-Punkt, interne Referenz/Adresse des MCP4728, der S2-DAC-Nebenbefund
  (`SOC_DAC_SUPPORTED`) und der HTTP-Ausfall; Flash-Eintrag auf 97,7 %.
- **Prüfung:** Library 337/337, Firmware 169/169 nativ, alle fünf Envs bauen (esp32dev
  97,7 %), Redocly-Lint, Web `typecheck`/`test` (273)/`build`, UI im Node-Mock und am
  LilyGo (Prüfen „antwortet“, Scan benennt 0x60, Bearbeiten lädt den Kanal).

## 2026-10-09 — Peripherie-Abstraktion Etappe 4: Port-Expander PCF8575 (Branch `feat/peripherie-etappe-4`)

Ein PCF8575 (16 Pins, I²C 0x20–0x27) liefert zusätzliche, langsame Digitalpins für
DigitalOutput (Binary/TPO) und DigitalInput (gepollt) — zugleich Pin-Manager Stufe 3b
„Pins von Port-Expandern“. Der Schnitt aus Etappe 3 blieb unverändert (Kanal-Referenz
`"<Geräte-Id>:<n>"`, `virtual[]`, `kDeviceTypes`, Fähigkeits-Hook am `Peripheral`). Ein PR,
je Teilschritt ein Commit.

- **4a Library:** `core/GpioPort.h` (`pinMode`/`write`/`read` je Kanal), Treiber
  `devices/PCF8575`: Schattenregister aller 16 Ausgänge, jeder Write schickt beide Bytes,
  Eingänge immer als 1 (quasi-bidirektional), `begin()` übernimmt die Latches des Chips (kein
  Umschalten der anderen Pins nach einem Reset), Port-Reads 20 ms gecacht, Schatten + Transfer
  unter einer Mutex. `DigitalOutputActuator`/`DigitalInputSensor` mit `GpioPort&` + Kanal; der
  Aktor schreibt einen Expander-Kanal nur bei Pegelwechsel und jede Sekunde neu (auch Binary),
  beide melden `fault()` „Port-Expander antwortet nicht“, der Sensor dann ungültige Werte.
- **4b Lock:** `POST /api/actuators/<id>` (v/enabled/interval) und `POST /api/estop` laufen
  jetzt unter dem `RegistryLock` (vorher im AsyncTCP-Task ohne Lock, PLAN-Eintrag vom selben
  Tag). Damit überschreibt weder ein TPO-`tick()` den Not-Aus noch der DAC-Refresh einen frisch
  gesetzten Wert, und Expander-Writes aus REST und `loop()` sind serialisiert. Der Not-Aus
  schaltet ohne Lock ab, wenn er ihn nicht binnen 3 s bekommt (nie 503). Zusätzlich die Mutex
  im Treiber, weil ESP-NOW-Befehle aus dem WiFi-Task ohne Lock schreiben — dieser Pfad selbst
  ist neuer PLAN-Eintrag.
- **4c Firmware:** `kDeviceTypes` mit `pcf8575` (`gpio`, 16, `inputsPullup`), Kanalnamen als
  Liste (`types[].channels` in `GET /api/peripherals` jetzt ein Array). Zulassung nur über
  Fähigkeiten in `collectPins`: DigitalOutput und DigitalInput `gpio`, PulseOutput abgetrennt;
  alle anderen Typen lehnen Gerätekanäle weiter mit 400 ab. DigitalInput ohne `pullup` auf dem
  PCF8575 → 400 (der Chip hat immer einen Pull-up). `Pcf8575Device` wie `Mcp4728Device`,
  `SensorEntry::dev` hält das Gerät auch über `PUT`. Waveshare: 0x20 ist über die reservierte
  TCA9554-Adresse gesperrt. OpenAPI, README (inkl. Einschaltzustand: Power-on High, ein
  ESP-Reset lässt die Ausgänge stehen → aktiv-low verdrahten).
- **4d Web:** `DigitalPinField` mit Umschalter GPIO | Port-Expander (Muster DAC-Auswahl),
  Auswahl der Kanäle P00–P17; `PinHint` zeigt den Status eines Refs und schlägt freie
  Expander-Pins als eigene Gruppe vor (mit Gerätename, sobald es mehrere gibt). Expander-
  Eingänge setzen und sperren „Pullup“, Expander-Ausgänge zeigen den Einschalt-Hinweis.
  Peripheriegeräte-Seite: PCF8575, Typwechsel setzt Bus und freie Adresse neu, reservierte
  Adressen des Board-Busses gesperrt.
- **Feste Onboard-Expander** (M5IOE1, TCA9554) nur skizziert: `currentFixedDevices()`,
  reservierte Kanäle, `BoardInit` über dieselbe `GpioPort`-Instanz — gebaut wird mit der
  Hardware (PLAN.md).
- **Prüfung:** Library 358/358, Firmware 174/174 nativ, alle fünf Envs bauen (esp32dev
  97,9 %, lolin_s2_mini 94,6 %), Redocly-Lint, Web `typecheck`/`test` (293)/`build`, UI im
  Node-Mock (Waveshare-Profil: Typwechsel wählt 0x22, weil 0x20 reserviert und 0x21 belegt;
  Bearbeiten lädt den Expander-Kanal, Chip-Klick wechselt die Quelle und setzt den Pull-up,
  `PUT` schickt den Ref).
- **Hardware (LilyGo, PCF8575 am Qwiic, NXP-Chip):** Antwortete zuerst nicht — Adress-Pads
  A0–A2 offen und Brücke VDD–VCC offen (VDD 2,45 V parasitär über SDA/SCL); beides gelötet,
  dann 0x20. Danach lasen Eingänge zufällig, Rohlesen über eine temporäre Diagnose-Route
  (nicht eingecheckt) zeigte: Writes und Reads kommen an, aber der Chip hält eine 1 nur kurz
  nach einem Write (seine ~100-µA-Quelle fehlt), offene/verkabelte Pins kippen im 50-Hz-Takt.
  Mit externem Pull-up (ESP-GPIO mit `INPUT_PULLUP` an der Brücke P00–P10) geprüft:
  Ein-/Ausschalten 100 % richtig an beiden Eingängen; Not-Aus gibt P00 sofort frei; TPO
  2 s/50 % mit Flanken alle 1,0 s; `PUT` mit Gerät behält den Kanal; Chip abziehen → `fault`
  und Alarm an allen fünf Items binnen ≤ 1 s, Snapshot weiter in 33–55 ms, Display bedienbar;
  wieder anstecken → Fault weg, TPO wieder richtig; nach Stromlos-Zyklus (die SD hing nach
  einem Power-on beim Verkabeln, bekannter LilyGo-Effekt) Gerät und Items aus der Config
  zurück und lauffähig. Negativfälle am Gerät: DigitalInput ohne `pullup` und PulseOutput auf
  dem Expander → 400. Aufgeräumt: `GET /api/config` byte-identisch mit dem Backup. Offen
  (PLAN.md): Eingang nur mit dem chip-eigenen Pull-up an einem unbeschädigten Modul.
  Nebenbei: GPIO 2 sah während des SD-Ausfalls frei aus, gehörte aber zu `agitator` —
  bei leerer Registry nie Pins aus `/api/pins` für Verkabelung nehmen.

## 2026-10-09 — Maischen-Tab Etappe 3b: Effizienz-Kette, Läutermodell, Stammwürze kalt

Zweiter PR zum Maischen-Tab. Quelle: Troester, „A Closer Look at Efficiency“ (NHC 2010) und
„Understanding Efficiency“ (braukaiser.com).

- **Begriffe, Nutzerentscheidung 2026-10-09:** Statt „Maische-Effizienz“ für die Konversion
  heißen die Glieder wie bei Malzknecht und Brewfather: Konversion × Läutereffizienz =
  Maischeeffizienz (Extrakt in der Pfanne / Potenzial, bisher im Rezept „Sudhausausbeute“
  genannt) × Würzeanteil = Brewhouse-Efficiency; dazu die Sudhausausbeute nach Narziss je kg
  Schüttung. Grundlage in der Karte „Brauerei“ (`Brewery.efficiencyBasis`): Konversion,
  Maischeeffizienz (Vorgabe, bisheriges Verhalten), Sudhausausbeute oder Brewhouse-Efficiency.
  Das Sudhaus-Feld `mashEfficiencyPct` heißt jetzt „Konversion“, neue Sudhäuser 80 %; das Rezept
  überschreibt es mit eigenem Feld `conversionPct`.
- **Läutermodell** (`web/src/efficiency.ts`, rein): Troesters Batch-Sparge-Modell, jeder Ablauf
  V nimmt V / (V + R) mit; R = Treberverlust + Würzeverluste vor dem Kochen + 0,62 l je kg
  gelöster Extrakt. Vollguss ist ein Ablauf, Batch Sparge hat n gleich große Gaben (Wasser-Tab,
  `water.spargeMethod`/`spargeBatches`), Fly Sparge zählt als 2 Gaben mit Hinweis; nur dort
  ersetzt ein Festwert `Brewhouse.lauterEfficiencyPct` die Näherung (Nutzerentscheidung). Die
  Rechnung iteriert, weil die Läutereffizienz am gelösten Extrakt und über einen nach
  Stammwürze geführten Verschnitt an den Wassermengen hängt. `wortExtract`/`calcStats` nehmen
  Sudhaus und Brauerei und rechnen den Extrakt über die Kette.
- **Stammwürze kalt** (Nutzerentscheidung): Der Extrakt der heißen Ausschlagmenge steht jetzt in
  Ausschlag × (1 − Abkühlschwund); vorher war die Stammwürze um den Schwund zu niedrig. Der
  Würzeanteil zählt deshalb nur Totraum und Transfers ab dem Whirlpool. Der Schalter
  „Menge = Ausschlag heiß / Anstellwürze kalt“ kommt mit dem Gärung-Tab (PLAN.md).
- **UI:** Übersicht mit dem Feld der Grundlage und der Kette in den Kennwerten (Eingabe als
  Abzeichen), Wasser-Tab mit Läutereffizienz, Verfahren und Gaben, Kopfkarte Maischen mit der
  Konversion, Sudhaus-Editor mit Konversion und Fly-Sparge-Festwert. Neue Messung
  `firstWortGravity` (Vorderwürze, Läutern). `Override` liegt jetzt in `fields.tsx`.
- **Doku:** Konzept-Doc (Rezept › Effizienz, Ausschlagmenge kalt, Sudhaus, Brauerei),
  `openapi.yaml` (`efficiencyBasis`, `mashEfficiencyPct`, `lauterEfficiencyPct`), PLAN.md
  (Näherungen der Kette inkl. Fly-Sparge-Modell, Schalter heiß/kalt beim Gärung-Tab, Rechner
  rechnet die Sudhausausbeute noch auf das Potenzial).
- **Prüfung:** `pnpm test` (`efficiency.test.ts`: Vollguss nach Troester 83/72 % bei 10/16 °P,
  Gaben +9/+3,4/+1,8, 30/70 −0,9, Fly, gleiche Stammwürze aus jeder Grundlage, Fixpunkt der
  Iteration, Starkbier, Hinweise, ohne Sudhaus; Stammwürze kalt in `recipeWater.test.ts`),
  `typecheck`, `build`, redocly. Im Node-Mock: Batch 1/2 Gaben 82/86 %, Fly 86 %, Vollguss
  73 %; Grundlage Konversion 75 %: Pils 5 kg 11,9 °P, Starkbier 10 kg nur 17,4 °P (Läutern
  83 → 62 %); 375 px ohne Querscrollen.

## 2026-10-09 — ESP32-S2: On-Chip-DAC statt stillem PWM-Fallback

- **Root Cause:** `AnalogOutputActuator.cpp` gab `dacWrite` nur für `CONFIG_IDF_TARGET_ESP32` frei.
  Der S2 hat aber einen DAC (GPIO 17/18, `SOC_DAC_SUPPORTED`), `kLolinS2Mini` meldete die Pins
  schon als `dac`; `mode:"dac"` fiel in `begin()` unbemerkt auf PWM zurück.
- **Umsetzung:** Guard auf `SOC_DAC_SUPPORTED` (`<soc/soc_caps.h>`) umgestellt; der S3 bleibt ohne DAC.
- **Prüfung:** Library 358/358 nativ; `lolin_s2_mini` (94,6 %), `esp32dev` (97,9 %) und
  `lilygo_t_display_s3_amoled` bauen, `dacWrite` steht im S2-ELF. Am `brewcontrol-brautomat`
  (OTA): DAC Pin 17 → `AnalogInput` Pin 6, ohne Glättung. Stabile, lineare Stufen ohne
  PWM-Rippel (0 → 0,21, 0,825 → 2,10, 1,65 → 4,05, 2,475 → 6,00, 3,3 → 6,60; Skala siehe PLAN.md).
  Ein erster Lauf mit schlecht steckendem Draht zeigte Rail-to-Rail-Rauschen und wäre als „PWM“
  fehlzudeuten gewesen — ohne Glättung messen und die Verdrahtung prüfen.
- **Nebenfund, gleich mitgefixt:** `AnalogInputSensor` rechnet mit Rohwerten 0–4095, der S2-Core
  liest aber standardmäßig 13 Bit — die Anzeige lag auf doppelter Skala (DAC 3,3 V →
  6,6). `begin()` setzt jetzt `analogReadResolution(12)` (ESP32 war schon 12 Bit). Erneut am S2
  gemessen: 0 → 0,10, 0,825 → 1,05, 1,65 → 2,03, 2,475 → 3,00, 3,3 → 3,30 V; der Rest ist
  ADC-Kennlinie (Offset unten, Sättigung oben), keine Skalenabweichung mehr.
  Am LilyGo (S3) mit 4,7-kΩ-Teiler an GPIO 5 (≈1,65 V): vorher 1,66 V, nachher 1,66 V — der
  S3-Core liest schon 12 Bit, der Fix ändert dort nichts.
- **PLAN.md:** S2-DAC-Punkt raus.

## 2026-10-09 — ESP-NOW: eingehende Pakete unter RegistryLock zustellen

- **Root Cause:** `EspNowTransport::dispatchIncoming` lief im WiFi-Task und rief die
  Subscriber-Callbacks direkt auf — für `/set` also `Actuator::write()` ohne `RegistryLock`,
  parallel zu `registry.tick()`. Gleiches für `retained_`/`subs_` bei Retained-Requests.
- **Umsetzung:** `dispatchIncoming` kopiert das Paket nur noch in eine begrenzte Queue
  (16 Einträge, bei voll wird das neueste verworfen); `tick()` leert sie und ruft die
  unveränderte Logik als `processIncoming_()` auf. `tick()` läuft in `loop()` unter dem Lock
  (`tickTransports()`), wie bei MQTT/WebSocket.
- **Prüfung:** Library 358/358 nativ, `esp32dev` und `lolin_s2_mini` bauen. Der Native-Stub hat
  kein ESP-NOW, die Queue ist nur am Gerät prüfbar. Zwei S2 (`brewcontrol-lolin` mit
  Test-DigitalOutput `entest` auf GPIO 5, `brewcontrol-brautomat` mit Remote-Aktor darauf, beide
  per OTA): Retained-Sync nach Reboot (Discovery fand alle Items), `/set` 1/0/1/0 kam jeweils an
  (Target + State folgen), 40 `/set` im Burst ohne Absturz (`resetReason` blieb `sw`). Den
  TPO-Überschreib-Race selbst nicht gezielt provoziert. Test-Items danach gelöscht.
## 2026-10-09 — Maischen-Tab Etappe 3c: Maischprofile

Dritter PR zum Maischen-Tab (Branch `feat/maische-3c`). Fast reine Musterarbeit nach den Sudhäusern.

- **Firmware:** `GET /api/mash-profiles`, `PUT`/`DELETE /api/mash-profiles/:id` über `JsonDocDir`
  (`/mashprofiles/<id>.json`, nur SD, kein Index), Prüfung nur der `id`. Die Reglerprogramme
  unter `/api/profiles` bleiben unberührt; im Code heißt das Ding `mashProfile`. `WebUI.h`,
  `openapi.yaml` (Tag „Mash profiles“, Schema `MashProfile`) und `README.md` im selben Zug.
- **Modell** (`web/src/mashProfiles.ts`): Name, Verfahren (freier Text), Beschreibung, `doughIn`
  (Temperatur, Dauer) und `steps` (nur Rast/Zubrühen mit Name, Temperatur, Dauer). **Abweichung vom
  Plan, bewusst:** Das feste Einmaischen gehört nicht als Schritt ins Profil, aber seine Temperatur
  und Dauer sind die erste Rast der Folge (Weizen: 45 °C zuerst), sonst ließen sich Weizen- und
  Eiweißrastprofile nicht abbilden. Laden setzt sie am festen Einmaischen und ersetzt alle weiteren
  Schritte; Zubrühen kommt mit Siedepunkt-Wasser (`lead: 'temp'`). Die Einmaisch-Schritte weiterer
  Schüttungen entfallen, die Bestätigung nennt sie.
- **Mitgeliefert:** Hochkurz, Einrast-Infusion, Weizen mit Ferulasäurerast, Klassisch mit
  Eiweißrast, Kombirast 66 °C, im Web-UI eingebaut und schreibgeschützt, nicht auf der SD.
  Die Werte sind Richtwerte aus gängiger Praxis und einem Artikel zu Hochkurz (`TODO(verify)`, PLAN.md).
- **UI:** `MashProfileDialog.tsx` (Liste, Editor, Duplizieren, Löschen, „Plan als Profil
  speichern“), im Maischeplan der Split-Button „Profile ▾“ (Pfeil lädt direkt, mit Bestätigung).
  Fällt die SD aus, bleiben die mitgelieferten Profile ladbar, Speichern/Duplizieren sind gesperrt.
- **Doku:** Konzept-Doc (Stand 3c, Ablage, Laden/Speichern), PLAN.md (3c erledigt; Backup der
  Maischprofile beim Sudhaus-Backup-Punkt; Richtwerte der mitgelieferten Profile).
- **Prüfung:** `pnpm test` (319, neu `mashProfiles.test.ts`: mitgelieferte Profile, Laden,
  Speichern aus dem Plan, Round-Trip, API), `typecheck`, `build`, redocly (nur die bekannte
  info-license-Warnung); `pio test -e native` (174), `pio run -e lilygo_t_display_s3_amoled`
  (32,2 %) und `-e esp32dev` (**97,9 % Flash, 1 860 097 von 1 900 544 Byte, 40 447 Byte frei**,
  prozentual unverändert gegenüber dem Stand vor 3c). Im Node-Mock: Laden mit Bestätigung,
  Duplizieren, Speichern aus dem Plan, Löschen, 375 px ohne Querscrollen, SD-Fehlerfall. Am LilyGo
  (OTA): PUT, `id mismatch`/`invalid id` → 400, Neustart, Profil noch da, DELETE → 204, zweites
  DELETE → 404.

## 2026-10-09 — Bus-Pins ändern, während Items daran hängen

- **Vorher:** `PUT /api/buses/{id}` mit neuen Pins lieferte 409, sobald ein Item oder Gerät am Bus
  hing. Die Bus-Id war aus den Pins abgeleitet und steckt in Item-Configs (`bus`), Geräten und
  deren Ids (`mcp4728-i2c-4-5-60`); ein Pinwechsel hätte alles umschreiben und neu aufbauen
  müssen, und regler-verdrahtete Items lassen sich nicht ersetzen.
- **Umsetzung:** Die Id ist nur noch der Startwert beim Anlegen und bleibt bei Pinwechseln
  stabil (`parseBusDef(..., fromStorage)` liest sie nur aus `registry.json`). `updateBus` prüft die
  neuen Pins gegen alle anderen Nutzer (`checkPinUses` mit Selbst-Ausnahme) und pinnt den
  laufenden Treiber um: `OneWireBus::repin` (`OneWire::begin`), `I2cBus::repin` (`Wire.end/begin`).
  Die Items halten nur Referenzen und bleiben unberührt, Regler ebenso. Einzige Ausnahme SPI: die
  MAX31865 kopieren die Pins im Konstruktor und werden per `replaceSensor` neu gebaut; hängt eine
  an einem Regler, gibt es vorab 409 (`referencedByController`, aus `removeSensor` herausgezogen).
  UI: Pin-Felder im Bus-Dialog nicht mehr gesperrt, Hinweis zum Umstecken. Löschen bleibt 409,
  solange Nutzer dranhängen. Bekannte Kleinigkeit: ein neuer Bus mit den alten Pins kollidiert
  mit der Id des umgepinnten (409 „already exists“).
- **Doku:** OpenAPI (PUT /api/buses/{id}), README „Geteilte Busse“, PLAN.md-Punkt entfernt.
- **Prüfung:** `pio test -e native` (175, neu `test_stored_id_survives_pin_change`),
  `pnpm typecheck`, redocly. Live-Umpinnen am Gerät: noch offen.
## 2026-10-09 — Link-Routing zentral (preact-router-Delegation)

Der Plan-Punkt „Klick-Delegation ließ am Gerät einen Link durchrutschen" ist erledigt.
Ein einziger Listener in `web/src/linkRouting.ts` (aus `main.tsx` installiert) routet alle
internen Links selbst; der Sonderweg in `NavShell` entfällt.

**Befund** (preact-router 4.1.2): Die Delegation hängt einmal auf `window`, sucht das `<a>`
erst zur Bubble-Zeit über `parentNode` und lässt den Browser navigieren, sobald `route()`
falsy liefert. Zwei Wege führen so zum echten Dokument-Load: das Klickziel wird von einem
Element-`onClick` vorher aus dem DOM genommen, oder zum Klickzeitpunkt matcht kein
registrierter Router. **Welcher davon am Gerät zutraf, ist nicht belegt** — der Fix macht
das Routing von beiden unabhängig, beweist aber nicht die Ursache.

**Umsetzung:** Capture-Listener löst den Link auf (vor jedem `onClick`), Bubble-Listener
routet mit `preventDefault()` + `stopImmediatePropagation()` (keine doppelte
History-Zeile); fällt `route()` durch, lädt `location.assign()` explizit. Nicht angefasst
werden Modifier-/Mittelklick, `target`≠`_self`, `native`/`data-native`, `//…`, externe URLs und
`/api/…` (Downloads). Reine Prüfung in `routableHref()`, Test `linkRouting.test.ts`.

**Verifikation:** `pnpm typecheck` sauber, `pnpm test` 321 grün. Chromium gegen `pnpm dev`:
Nav-Link ×2, Einstellungs-Karte und ein Link, der sich im `onClick` selbst entfernt, ergeben
je genau einen History-Eintrag, `window`-Marker überlebt, ein Navigation-Entry; Ctrl-Klick
schreibt keinen Eintrag. Nicht gemessen: Verhalten vor dem Fix für den Selbst-Entfern-Fall
und das Gerät selbst.

## 2026-10-09 — Maischen-Tab Etappe 3d: Dekoktion, Kochen im Maischbehälter, Profile mit Dekoktion

Vierter und letzter PR der Etappe 3 (Branch `feat/maische-3d`), reine Web-UI- und Doku-Arbeit, die
Firmware ist unverändert. Vor dem Start mit dem Nutzer geklärt (Plan `maische-etappe-3.md` gegen den
Code geprüft, keine Widersprüche, aber Lücken):

- **Entscheidungen:** Die Restmaische verliert während der Dekoktion den **Wärmeverlust des
  Maischbehälters** (neues Behälterfeld `heatLossKPerH`, Vorgabe 0 = hält) statt der 0,2 K/min des
  Abkühlens, die bei 45–90 min Dekoktion 9–18 K gekostet hätten. Die **Verdampfung** beim Kochen nimmt
  die Rate des Behälters aus dem Sudhaus und wirkt in Wärme- und Wasserbilanz. **Profile** können jetzt
  Dekoktionen und weitere Schüttungen tragen; neu mitgeliefert sind Ein-, Zwei- und
  Dreimaischverfahren und **Earls Kochmaische**. Der **Dekoktionsbehälter** wird abgeleitet: nicht der
  Maischbehälter, eigene Heizquelle, heizt nicht die Maische (HERMS-/Kettle-RIMS-/Aufguss-Behälter
  halten Wasser), der erste in Prozessreihenfolge. Für Earl: Profile tragen Schüttungsanteile (Laden
  teilt die erste Schüttung auf), und eine Rast am Siedepunkt kocht im direkt beheizten Maischbehälter.
- **Eigene Abweichung vom Vorschlag in der Rückfrage:** Die Heizzeit der Teilmaische kommt zuerst aus
  der Heizleistung für ihre Masse, die Heizrate des Schritts erst ohne Leistung, weil sie für den vollen
  Behälter gilt.
- **Rechnung** (`web/src/mashPlan.ts`): `walk()` führt Wasser und Malz getrennt. Dekoktion: Anteil am
  Maischevolumen, dick mit bis zu 2,1 l/kg (`THICK_DECOCTION_L_PER_KG`, `TODO(verify)`), dünn nur
  Flüssigkeit; Rasten und Kochen im Dekoktionsbehälter, Verdampfung, Restmaische mit Wärmeverlust,
  Mischtemperatur beim Zurückführen; führt die Temperatur, sucht eine Bisektion den Anteil. Eine dünne
  Dekoktion ohne Verlust und Verdampfung ergibt genau Troesters Faustformel (Test). Kochrast: Ziel ab
  Siedepunkt, Verdampfung des Maischbehälters, Hinweis außer bei direkter Heizung. Ohne
  Dekoktionsbehälter zählt eine Dekoktion als Rast, ein Hinweis nennt alle.
- **Wasser/Effizienz:** `mashEvaporationL` zählt zum Gesamtwasser (Nachguss, sonst Hauptguss),
  `calcWater` bekommt dafür optional die Brauerei (Siedepunkt); der erste Ablauf im Läutermodell ist um
  die Verdampfung kleiner.
- **Profile** (`web/src/mashProfiles.ts`): Schritt-Arten `decoction` und `doughIn` (`sharePct`),
  Zubrühen mit `waterTempC`; `applyMashProfile` arbeitet auf dem Rezept (Schüttungen, Zutaten),
  `profileLoadEffects` speist die Bestätigung, `profileOfPlan` speichert Dekoktionen und
  Schüttungsanteile. `splitCharge` aus `addCharge` herausgezogen. Earls Zubrühziel nach einem
  Probelauf auf 62 °C gesetzt (bei 66 °C hätte die Maltoserast wieder abkühlen müssen).
- **UI:** Dekoktion im Menü und in der Art-Auswahl (gesperrt ohne Dekoktionsbehälter), Felder Anteil,
  dick/dünn, Volumen, darunter Rasten, Kochdauer, Restmaische und Verdampfung; zweite, gestrichelte
  Linie im Temperaturverlauf; „Dekoktionen durch Rasten ersetzen“ in Übersicht und Maischen-Tab;
  Profil-Editor mit allen vier Arten; im Sudhaus „Wärmeverlust (K/h)“ am Maischbehälter und
  „Verdampfung“ auch am Dekoktionsbehälter und am direkt beheizten Maischbehälter.
- **Doku:** Konzept-Doc (Stand 3d), `openapi.yaml` (`BrewhouseVessel.heatLossKPerH`, Schritte von
  `MashProfile`), PLAN.md (3d raus; Näherungen der Dekoktion beim Punkt „Maischeplan rechnet mit
  Näherungen“; Quellen der neuen Richtwerte).
- **Prüfung:** `pnpm test` (347, neu u. a. Dekoktion und Kochrast in `mashPlan.test.ts`,
  `decoctionVesselOf`, Wasserbilanz, Läutermodell, Profile mit Schüttungen und Round-Trip,
  `MashCurve.test.ts`), `typecheck`, `build`, redocly (nur die bekannte info-license-Warnung). Im
  Node-Mock: Dreimaischverfahren auf „Pfanne + Läuterbottich“ (Anteile 28/28/32 %, 3:13 h, zweite
  Linie), Anteil ↔ Temperatur umschalten, Wasser-Tab mit 1,5 l Verdampfung beim Maischen, Wechsel auf
  2-Kessel-HERMS mit Warnung und Ersetzen, Earl auf dem Ein-Topf in 500 m (Aufteilung 80/20, Kochen bei
  98,3 °C, 0,8 l verdampft), Profil speichern mit Dekoktion und Schüttung, 3 K/h Wärmeverlust (Anteile
  32,8 → 36,3 %), 375 px ohne Querscrollen. Kein Gerätetest nötig, das Profil-JSON ist für die Firmware
  opak.

## 2026-10-10 — Maischprofil Weizen nach Herrmann (Maltaserast)

Kleiner Nachtrag zu Etappe 3d (Branch `feat/maische-herrmann`): ein weiteres mitgeliefertes Profil, ohne
Dekoktion, damit es auch ohne zweiten beheizten Behälter läuft. Das Modell trug es schon (Aufbau wie Earls
Kochmaische), es ist nur ein Eintrag in `BUILTIN_MASH_PROFILES`.

- **Ablauf:** erste Hälfte der Schüttung 62 °C 30 min, 72 °C 20 min; kaltes Wasser (12 °C) auf 46 °C; zweite
  Hälfte (50 %) dazu; Maltaserast 45 °C 40 min; 72 °C 20 min; 76 °C 5 min.
- **Quellen:** Die Quellen widersprechen sich in den Einzelwerten (Einmaischen bei 38, 43 oder 62 °C, mit
  oder ohne zwei Dekoktionen). Ablauf nach brewingforward.com „Maltase mash“ (Kunze, Esslinger),
  Aufteilung 50:50 nach edelstoffquest.wordpress.com. Herrmanns Dissertation (TU München, mediaTUM) wurde
  bewusst nicht gelesen (Nutzer-Entscheidung, zu umfangreich); Richtwerte mit `TODO(verify)`, PLAN.md.
- **Probelauf:** 5 kg (3 kg Weizen, 2 kg Pils), Pfanne + Läuterbottich: 9,5 l Wasser vorlegen, 8,0 l kaltes
  Wasser, nach der zweiten Schüttung 44,5 °C, Maltaserast heizt 0,5 K nach, 2:24 h; Ein-Topf (Vollguss):
  11,7 l kaltes Wasser, 45,0 °C. Keine Abkühl-Hinweise.
- **Prüfung:** `pnpm test` (350, neu: Aufbau des Herrmann-Profils, Round-Trip), `typecheck`, `build`.

## 2026-10-10 — Temperaturverlauf ohne Sudhaus

Am LilyGo fehlte der Temperaturverlauf im Maischen-Tab, im Mock nicht: Die Karte erschien nur mit Plan,
und `calcMash` braucht ein Sudhaus; die Rezepte auf dem Gerät hatten keins gewählt (vom Nutzer selbst
gefunden). Entscheidung: ohne Sudhaus ein vereinfachter Verlauf (Branch `feat/maische-verlauf-ohne-sudhaus`).

- **`outlineMash`** (`web/src/mashPlan.ts`): Zieltemperaturen und Haltezeiten ab dem Einmaischen, jeder
  Übergang ein Sprung, kein Wasser vorlegen; weitere Schüttungen und Rasten ohne Ziel behalten die vorige
  Temperatur, eine Kochrast endet am Siedepunkt der Brauerei, eine Dekoktion springt ohne eigene Linie.
- **UI:** Die Karte erscheint immer, ohne Sudhaus mit dem Hinweis „Ohne Sudhaus nur Zieltemperaturen
  und Haltezeiten, Übergänge als Sprung.“ `MashCurve`/`curveOf` nehmen dafür Zeilen statt des Plans.
- **Prüfung:** `pnpm test` (354, neu `outlineMash` und die Kurve ohne Sudhaus), `typecheck`, `build`; im
  Node-Mock Earls Kochmaische ohne Sudhaus (Stufen 62/72/100, Sprung durch das kalte Wasser, Punkt bei
  der zweiten Schüttung) und mit Sudhaus unverändert.
- **Nebenbefund:** Die Plantabelle ragt bei rund 800 px Fensterbreite über ihre Karte hinaus, offen in
  PLAN.md.

## 2026-10-10 — Maischplan: Raster nach Kartenbreite statt Fensterbreite

Die Plantabelle ragte bei rund 800 px Fensterbreite über ihre Karte hinaus (aus PLAN.md, dort entfernt).
Im Node-Mock bestätigt: Das Raster in `MashTab.tsx` (`GRID`) brauchte 860 px, die Karte war aber nur 696 px
(Seitenleiste eingeklappt) bzw. 512 px (ausgeklappt) breit, Überstand 198 bzw. 382 px.

- **Ursache anders als vermutet:** Nicht nur `md` ist zu früh. Die Karte hängt von der Seitenleiste
  (3,5 rem eingeklappt, 15 rem ausgeklappt) und von der Breitenkappung der `PageShell` (`max-w-4xl`) ab; mit
  ausgeklappter Seitenleiste lief das Raster auch bei 1024 px noch 158 px über (Karte 736 px). Ein Wechsel
  auf `lg` hätte diesen Fall offen gelassen.
- **Umsetzung:** Die Zeilenliste ist ein `@container`, alle Zeilenklassen (`GRID`, `StepRow`,
  `DecoctionCourse`) schalten bei 53,75 rem Kartenbreite (Mindestbreiten der Spalten plus Abstände) statt ab
  `md`: `md:` → `@[53.75rem]:`, `max-md:` → `@max-[53.75rem]:`. Darunter gilt der umgebrochene Fallback.
- **Prüfung:** `pnpm test` (354), `typecheck`, `build`; im Node-Mock (Rezepte „Dekoktion“ mit
  Zweimaischverfahren auf Pfanne + Läuterbottich und „Ohne Sudhaus“) bei 375, 800, 1024 und 1440 px, jeweils
  Seitenleiste ein- und ausgeklappt: `documentElement` und Inhaltsbereich ohne waagerechten Überstand, kein
  Element in `[data-step]` rechts über der Karte. Raster bei 896 px Karte (inklusive Dekoktions-Unterzeile),
  Umbruch bei 696 px und darunter.

## 2026-10-10 — Rezeptversionen Etappe 4a: Ablage, Liste, Auswahl, Menü

Erster PR der Etappe Versionen (Branch `feat/rezept-versionen`), ohne den Vergleichsdialog (4b). Vor dem
Start mit dem Nutzer geklärt:

- **Entscheidungen:** Jede Version ist ein **eigenes Rezept** mit eigener Datei, verknüpft über `rootId`
  (id der v1) und `version`; eingebettet ins Rezept-JSON wäre die 16-KB-Body-Grenze (`kMaxBodyBytes`) nach
  zwei, drei Versionen erreicht. Rezepte ohne die Felder sind v1, **keine Migration**. Bis zum Sud löst nur
  der Menüpunkt „Neue Version als Entwurf“ (bei fertigen Versionen) eine Version aus; 5a ergänzt die
  Konzept-Regel „Version mit Suden ändern = neue Version“. **Ältere Versionen sind bearbeitbar** (Vorschlag
  im Konzept war nur ansehen). Liste zeigt die neueste Version mit Abzeichen ab v2. Menü: Neue Version,
  Duplizieren, Exportieren (JSON), Diese Version löschen; BeerJSON statt BeerXML als offener Punkt.
- **Firmware:** `recipeSummaryLine` (`RecipeFiles.h`) übernimmt `rootId` und `version` in den Listenindex,
  keine neuen Routen. `openapi.yaml`: `RecipeSummary` um beide Felder, Beschreibungen von Tag, Liste und
  `Recipe`.
- **Web-UI:** `recipes.ts` mit `rootOf`/`versionOf`, `groupVersions`, `newVersion` (kopiert die geöffnete
  Version als nächste Nummer, Entwurf), `duplicateRecipe`, `deleteRecipeVersions`; `exportRecipes` nimmt
  optional nur bestimmte Versionen. Liste gruppiert, Löschen nimmt alle Versionen (Rückfrage nennt die
  Zahl). Editor-Kopf: Auswahlfeld ab zwei Versionen (Nummer, Datum des letzten Speicherns, Status), Wechsel
  fragt bei ungespeicherten Änderungen, „⋯“-Menü (Kopieren/Exportieren bei ungespeicherten Änderungen
  gesperrt). Übersicht: Karte „Versionen“ (`pages/recipe/Versions.tsx`). `MenuItem` aus `MashTab.tsx` nach
  `fields.tsx`, `saveJson` aus `BackupPage.tsx` nach `api.ts` (je zweiter Nutzer).
- **Doku:** Konzept-Doc (Stand 4a, ältere Versionen bearbeitbar, BeerJSON), PLAN.md (4a da, 4b als
  nächster Schritt, Regel für 5a, BeerJSON-Export).
- **Prüfung:** `pnpm test` (360, neu: Altbestand als v1, Gruppierung, `newVersion` auch von älterer
  Version, Duplizieren, Index-Felder und Löschen aller Versionen, Export einzelner Versionen), `typecheck`,
  `build`, redocly (nur die bekannte info-license-Warnung). Firmware: PlatformIO-Registry war in dieser
  Umgebung gesperrt, `test_recipe_files` deshalb von Hand mit g++, ArduinoJson 7.4.2 und Unity gebaut
  (10/10, neu `test_summary_line_carries_the_version_fields`); `pio test -e native`, die Builds
  `lilygo_t_display_s3_amoled`/`esp32dev` und der Gerätetest am LilyGo sind am 2026-10-12 nachgeholt
  (Nachtrag unten). Im Node-Mock
  mit Playwright: Liste mit v2-Abzeichen, Altrezept ohne Auswahlfeld, neue Version aus fertigem Rezept,
  Wechsel mit Rückfrage, v1 bearbeiten und speichern, Duplizieren, Export beider Versionen, Version löschen
  (danach öffnet die neueste), Rezept mit allen Versionen löschen, 375 px ohne Querscrollen (dabei den
  Kopf umbrechend gemacht, sonst lief das Status-Abzeichen rechts aus dem Bild).
- **Nachtrag 2026-10-12, Firmware und Gerät:** `pio test -e native` 176/176 (darunter
  `test_summary_line_carries_the_version_fields`), `pio run -e lilygo_t_display_s3_amoled` (32,2 %,
  2 109 873 von 6 553 600 Byte), `pio run -e esp32dev` (**98,0 % Flash, 1 861 753 von 1 900 544 Byte,
  38 791 Byte frei**). Gegenüber 3c (1 860 097 Byte) sind das 1 656 Byte mehr; ein Build des Stands
  direkt vor 4a (`1275ba8`) ergibt dieselben 1 861 753 Byte. 4a kostet auf esp32dev also nichts (die
  Rezeptrouten liegen hinter `#ifndef BREWCTL_USE_LITTLEFS`), der Zuwachs stammt aus dem ESP-NOW-Fix
  (#83) und dem Umpinnen von Bussen (#86). **Am LilyGo** (Firmware per OTA, `v0.5.0-78-ga5aff3e`; UI per
  `webui-full.tar` an `POST /api/update/assets`, mit `VITE_STYLE_COMPARISON=1` gebaut, damit der
  Stilvergleich auf dem Gerät bleibt):
  - Als Wurzel diente ein eigenes Testrezept (`hwtest4av1`) statt eines vorhandenen, damit das Löschen
    am Ende kein echtes Rezept trifft. `PUT /api/recipes/hwtest4av2` mit `rootId: hwtest4av1` und
    `version: 2` → 204.
  - `GET /api/recipes` führt `rootId` und `version` nur an diesem Eintrag, die drei älteren Einträge
    haben die Felder nicht.
  - Nach einem Neustart (`POST /api/network` mit unverändertem Hostnamen) unverändert. UI: eine Zeile
    „HW-Test 4a“ mit Abzeichen „v2“; im Editor das Auswahlfeld (v1 Fertig, v2 Entwurf) und die Karte
    „Versionen“.
  - „⋯ › Diese Version löschen“ entfernt Datei und Indexzeile der v2; „Rezept löschen“ in der Liste
    danach die v1. Beide `GET` liefern 404, `/recipes` enthält nur noch die zwei vorhandenen Rezepte.
  - Nebenbefund: Der erste UI-Upload scheiterte mit einem SD-Schreibfehler, der zweite lief durch
    (PLAN.md).

## 2026-10-12 — Rezeptversionen Etappe 4b: Vergleich

Zweiter PR der Etappe Versionen (Branch `feat/rezept-versionen-vergleich`, ab `dev`): der Vergleichsdialog.
Reine Web-UI-Arbeit, Firmware und `openapi.yaml` unverändert. Vor dem Start mit dem Nutzer geklärt:

- **Entscheidungen:** Zutaten erst über die Zeilen-id zuordnen, den Rest über Art, Katalogzutat (Freitext:
  Name) und Zeitpunkt; Maischschritte, Gärphasen und Teilschüttungen nur über die id. Wasser zeigt Eingaben
  und Mengen, keine Ionen und keinen pH nach der Aufbereitung. Zutaten stehen einmal, nach Art. Am Handy
  die Bezeichnung über zwei Werten nebeneinander. Vorgewählt Vorgänger gegen geöffnete Version. Geändert
  ist, was im angezeigten Text abweicht, Zahlen mit Differenz. **„vX übernehmen“ entfällt.** Die geöffnete
  Version geht mit dem Editor-Stand in den Vergleich („ungespeichert“).
- **Web-UI:** `recipeDiff.ts` (pur): `matchRows` (id, dann Schlüssel; Reihenfolge der rechten Seite,
  Entferntes hinter seinem Vorgänger), Umsortierung über die längste Folge in gleicher Reihenfolge, damit
  eingefügte Zeilen nichts verschieben, `deriveRecipe` (dieselbe Kette wie die Übersicht: `calcStats`,
  `calcWater`, `calcMash`), `diffRecipes` mit den sechs Bereichen. `pages/recipe/VersionCompareDialog.tsx`
  nach dem Muster von `MashProfileDialog` (`dialogScrim`/`dialogFrame`/`dialogSheet`), lädt die nicht
  geöffneten Versionen per `getRecipe` und hält sie im Dialog. `VersionsCard` mit Link „Vergleichen“,
  `OverviewTab` öffnet den Dialog, `RecipeEditPage` reicht `dirty` durch (`TabProps.dirty`).
- **Abweichungen vom Plan:** Die Konversion als eigene Zeile gibt es nur, wenn sie die Grundlage der
  Brauerei ist (sonst rechnet das Rezept nicht mit `conversionPct`). Sobald eine Seite mehrere
  Teilschüttungen hat, nennen beide Seiten die Schüttung (die ungeteilte „Schüttung 1“), sonst wäre jedes
  Malz allein deshalb geändert. „Nur Unterschiede“ kürzt geänderte Einträge auf ihre geänderten Felder.
- **Doku:** Konzept-Doc (Stand 4b, „Übernehmen“ gestrichen), PLAN.md (4b raus, nächster Schritt Sud 5a).
- **Prüfung:** `pnpm test` (378, neu 18 in `recipeDiff.test.ts`: Zuordnung über id und Schlüssel, gleiche
  Gaben in Listenreihenfolge, Reihenfolge mit Entferntem, Rundung, Differenztext, eingefügter und
  umsortierter Maischschritt, Teilschüttung nur rechts, fehlendes Sudhaus, alle Bereiche), `typecheck`,
  `build`. Im Node-Mock (Sudhaus aus der Vorlage „Maische-/Würzepfanne + Läuterbottich“, Brauerei mit zwei
  Wässern, ein Rezept mit v1 bis v3 und Unterschieden in jedem Bereich): v2 gegen v3 und v1 gegen v3 mit
  neu, geändert, entfernt und den Rechenwerten je Bereich; Auswahl sperrt die Version der anderen Seite;
  Ausschlagmenge im Editor ungespeichert geändert, der Dialog zeigt den Wert und „ungespeichert“; „Nur
  Unterschiede“ mit „Keine Unterschiede“ beim Würzekochen; 375 px ohne Querscrollen, Auswahlfelder bleiben
  oben stehen; Konsole ohne Fehler. Kein Gerätetest (die Firmware ist unverändert).
## 2026-10-12 — Log-Charts: umschaltbare Zeitachse

Bei langen Aufzeichnungen gingen die jüngsten Änderungen im Chart unter. Die Zeitachse lässt sich
jetzt je Log umschalten: **Linear** (wie bisher), **Log** (`−ln(1 + a/60 s)`) und **Quadr.**
(`−√a`), mit `a` = Alter gegenüber dem neuesten Punkt, der damit immer rechts steht und am breitesten ist.

- **Umsetzung Web:** `web/src/timeAxis.ts` (reine Funktionen: `makeScale`, `ageSplits`, `ageLabel`) und
  `ChartCard.tsx` mit einer uPlot-Skala `distr: 100` (`fwd`/`bwd`). Die Daten bleiben in Epoch-Sekunden,
  deshalb brauchten `cursorX`, `interpAt` und `isZoomed` keine Änderung. Ticks stehen in den nichtlinearen
  Modi bei runden Altern und tragen mehrzeilige Beschriftungen: Alter („−2 h“), Uhrzeit und, wenn der Tick
  an einem anderen Tag liegt als der neueste Punkt, das Datum. uPlots x-Achse hat feste 50 px, darum
  wächst sie über `axis.size` mit der Zeilenzahl. Umschalter `TimeAxisSwitch.tsx` im Kopf der
  Karte (Dashboard, Logs-Seite), das Archiv zeigt den gespeicherten Modus ohne Schalter.
  **Falle:** `distr: 100` erbt uPlots Tick-Filter der Log-Achse (`sc.log == 10`), der die meisten Splits
  auf `null` setzt — die Achse braucht ein eigenes `filter`.
- **Ablage:** pro Log auf dem Gerät (`LogConfig.timeAxis`, Default `linear`). Eigene Route
  `POST /api/logs/{id}/timeaxis` statt des normalen Updates, weil `LogStore::update()` die Session
  zurücksetzt; `fillFromJson` behält den gespeicherten Wert, wenn der Body keinen mitbringt.
  `openapi.yaml` (Schema `TimeAxis`) und README-Routentabelle im selben Zug.
- **Prüfung:** `pnpm test` (331, neu `timeAxis.test.ts`: Umkehrbarkeit, Monotonie, Splits),
  `typecheck`, `build`, redocly (nur die bekannte info-license-Warnung). Im Browser gegen einen
  Wegwerf-Mock: 3 Tage Daten mit schnellem Anstieg in den letzten 10 min, alle drei Modi, Legende
  liefert die Uhrzeit unter dem Cursor, die Route wird mit dem richtigen Body aufgerufen.
  **Nicht geprüft:** Firmware-Compile (`pio` ist in der Cloud-Umgebung nicht installiert), Flash-Größe
  des esp32dev (97,9 %, ~40 KB Luft; die Änderung ist klein) und alles am Gerät.
## 2026-10-12 — Zutaten-Seite mit eigenen Zutaten und Lager

Bisher gab es Zutaten nur als Vorschläge im Namensfeld des Rezepteditors, aus dem statischen Katalog.
Neu ist der Menüpunkt **Zutaten** (`/zutaten/<tab>`, Rezeptpaket): ein Tab je Art mit dem Lager dieser Art
oben und Katalog + eigenen Zutaten darunter, dazu „Lager gesamt“. Eigene Zutaten lassen sich anlegen,
Katalog- und eigene Zutaten als Lagerposten mit Menge, Jahrgang, Form, MHD und eigenen Datenblattwerten
übernehmen. Rezeptzeilen können auf einen Posten zeigen und rechnen dann mit dessen Werten (Branch
`zutaten-lager`, eigener Worktree).

- **Firmware:** zwei neue Sammlungen nach dem Muster der Sudhäuser, `/api/ingredients` (`/ingredients`)
  und `/api/stock` (`/stock`), über eine Hilfsfunktion `WebUI::serveJsonDocDir_` (nur SD-Boards). Die
  Routen der Sudhäuser und Maischprofile sind gleich gebaut und könnten sie ebenfalls nutzen, sind aber
  unverändert. `openapi.yaml` (Tag Ingredients, Schemas `UserIngredient`/`StockLot`) und
  README-Routentabelle im selben Zug.
- **Web:** `ingredientSource.ts` lädt Katalog, eigene Zutaten und Lager (ohne Gerät bleibt der Katalog
  nutzbar, `storeFailed`) und hat `reloadCatalog()` für die Seite; das Lesen aus `localStorage`
  (`bc.userIngredients`, nie geschrieben) entfällt. `stockLots.ts` (rein): `effectiveIngredient`,
  `withLotEntries`, `entryOf`; `Catalog.entries` hängt je Posten einen effektiven Eintrag mit der Id der
  Zutat an, darum finden einfache Id-Suchen weiter die Zutat. `Ingredient.stockLotId`, Rechnungen
  (`recipeStats`, `mashPh`, `recipeTreatment`, `IngredientCard`) über `entryOf`. Feldtabelle
  `ingredientFields.ts`; Seite `pages/IngredientsPage.tsx`, Dialoge in `pages/ingredients/`.
  Ids eigener Zutaten `user-…` statt `user:…` (Dateiname), Beispiel-JSON angepasst.
- **Prüfung:** `pnpm test` (409, neu `stockLots.test.ts`, Speicherzugriff und Lager-Suche in
  `ingredientSource.test.ts`, IBU mit Lagerposten in `recipeStats.test.ts`), `typecheck`, `build`,
  redocly (nur die bekannte info-license-Warnung). Im Browser gegen einen Wegwerf-Mock der Sammlungen:
  Motueka ins Lager mit Alpha 9,2, eigene Zutat angelegt, „Lager gesamt“, im Rezept den Posten gewählt —
  die Bittere steigt von 23 auf 31 IBU (Katalog 6,5–7,5 %); 390 px Breite ohne Querscrollen der Seite.
  Firmware-Compile und native Tests (176) nach dem Merge lokal vom Nutzer grün; in der Cloud-Umgebung
  ist die PlatformIO-Registry gesperrt. **Nicht geprüft:** alles am Gerät.
- **Nachtrag Hopfenlagerung:** Hopfen-Lagerposten erfassen Lagertemperatur, Verpackung (fünf Stufen
  wie in Hosoms Hop Freshness Calculator) und „Alpha-Wert vom“, die Zeile zeigt z. B. „−18 °C ·
  vakuumiert“. Noch ohne Rechnung; Modell und Faktoren für die spätere Alterung in PLAN.md.


## 2026-10-12 — Gärkeller: Gärplätze und Gebinde (Branch `feat/gaerkeller`)

Vor dem Sud (5a), damit er den Gärplatz später aus echten Daten wählen kann. Nur die Stammdaten; der
Belegungsplan kommt mit dem Sud. Entscheidungen und Begründung stehen in `rezept-sud-editor.md` › Gärkeller.

- **Ablage (Nutzerentscheidung):** zwei Sammlungen, je Objekt eine Datei, `/fermenters/<id>.json` und
  `/containers/<id>.json`, Routen `/api/fermenters` und `/api/containers` (GET, PUT/DELETE `/<id>`). Keine
  neue Firmware-Logik: zwei Konstanten und zwei Aufrufe der von der Zutaten-Session eingeführten
  `WebUI::serveJsonDocDir_`, im SD-Block (`#ifndef BREWCTL_USE_LITTLEFS`). `openapi.yaml` (Tag Cellar, Schemas
  `Fermenter`/`Container`), README-Routentabelle und der Routenkommentar in `WebUI.h` im selben Zug.
- **Remote (Nutzerentscheidung):** Remote-Sensoren und -Aktoren sind lokale Proxys im Snapshot, die
  Verknüpfung trägt sie schon. Einen Remote-Regler gibt es nicht (`Discovery.h`); der Regler läuft auf dem
  Board mit der Brauanlage, der Editor sagt das am Feld. Der Proxy steht als Punkt in PLAN.md.
- **Web:** `web/src/cellar.ts` (rein: Modell, `checkFermenter`/`checkContainer`, `setTempering`, Normalisierung,
  API) und `pages/CellarSection.tsx` (Listen und Dialoge) auf der Seite Brauanlage. Verknüpfung am Gärplatz:
  Temperierung (ohne, kühlen, heizen, beides), „von Hand“ oder angeschlossen mit Regler oder Aktor, dazu ein
  Temperaturfühler. Trubverlust und Abfüllverlust sind ohne Wert „wie im Rezept“ bzw. 0, es gibt keine erfundene
  Vorgabe. `Select`, `TextInput`, `Opt` und `itemText` sind aus `BrewhouseEditPage.tsx` nach `recipe/fields.tsx`
  gezogen (reine Verschiebung).
- **Backup (Nutzerentscheidung):** gemeinsam später; der Punkt in PLAN.md nennt Gärplätze und Gebinde.
- **Prüfung:** `pnpm test` 436 (neu `cellar.test.ts`, 27 Fälle: jeder Fehler- und Hinweisfall, Wechsel der
  Temperierung, Normalisierung, API mit `fetch`-Stub), `typecheck`, `build`, redocly (nur die bekannte
  info-license-Warnung). Bundle: Gärkeller-Code nur im Paket-Chunk (250,3 statt 238,9 kB, gzip 78,6 statt 75,7);
  das Basis-Bundle blieb bei 469,72 kB (gzip 147,48 statt 147,47, der Unterschied ist der Hash des Chunk-Namens),
  gebaut gegen den unveränderten `dev`-Stand. Im Browser (Playwright gegen einen Wegwerf-Mock): Speichern
  gesperrt ohne Namen und Volumen und bei „angeschlossen“ ohne Verknüpfung, Einheitenhinweis (Regler auf kg)
  sperrt nicht, Anlegen, Bearbeiten (Wechsel auf „ohne Temperierung“ verwirft den Regler, der Fühler bleibt),
  Keg-Hinweis, Bruchzahl als Anzahl gesperrt, Löschen, `PUT`/`DELETE` auf der gespeicherten ID, 375 px ohne
  Querscrollen.
- **Nicht in der Cloud geprüft** (PlatformIO ist dort nicht installiert, die Registry gesperrt), **nach dem
  Merge (#93) lokal vom Nutzer:** Firmware kompiliert, alle nativen Tests grün. `esp32dev`: Flash 98,0 %
  (1 862 805 von 1 900 544 Byte, 37 739 Byte frei), RAM 18,7 % (61 176 von 327 680 Byte). Die Erwartung
  „bleibt bei 1 860 097 Byte“ aus dem PR war falsch gestellt: Die Zahl stammte vom Stand vor mehreren
  Merges, und der letzte gemessene Wert vor #93 war 1 861 753 Byte (PLAN.md, esp32dev-Flash). Der Zuwachs von
  1 052 Byte gilt für alles, was seither in `dev` kam (u. a. die Zeitachsen-Route der Log-Charts, die Zutaten-
  und die Gärkeller-Routen); wie viel davon der Gärkeller ist, ist nicht getrennt gemessen. Die
  Gärkeller-Routen stehen im SD-Block und gehören nicht ins `esp32dev`-Image; ob `/api/fermenters` im ELF
  fehlt, ist nicht geprüft. Offen bleibt alles am Gerät; Punkt unter „Hardware-Verifikation offen“ in PLAN.md.
## 2026-10-12 — Sud 5a: das Gerüst

Der Sud ist in drei Etappen geteilt (5a Gerüst, 5b Brautag mit Messwerten, 5c Gärung, Reifung, Abfüllung mit
Belegungsplan). 5a legt das Datenmodell fest. Entscheidungen des Nutzers: Der Sud verweist auf die
Rezeptversion und kopiert beim Start Sudhaus, Brauerei, Gärplatz und die Werte seiner Zutaten; abgebucht wird
beim Start über einen Dialog; die Belegung steht im Sud-Index statt in `/bookings`; die Sicherung kommt schon
jetzt (Branch `feat/sud-geruest`, eigener Worktree).

- **Firmware:** `GET /api/brews`, `GET|PUT|DELETE /api/brews/{id}` mit Index wie die Rezepte. `RecipeStore`
  bekam einen Verzeichnis-Parameter (Standard `/recipes`), `RecipeFiles.h` den Helfer `summaryLineOf`;
  `recipeSummaryLine` nutzt ihn unverändert, neu `brewSummaryLine` mit allen Feldern, die der Belegungsplan
  braucht. `openapi.yaml` (Tag Brews, `BrewSummary`, `Brew`) und README im selben Zug.
- **Web:** `brews.ts` (Modell, Daten, Nummer, Belegung und Überschneidung, Speicher, Sicherung) und
  `brewStart.ts` (Kopien, Lagerplan, Abbuchen, Start), getrennt, damit die Sicherungsseite den Katalogcode
  nicht ins Hauptbundle zieht (der Sud-Export lädt per `import()`). `docBundle.ts`: gemeinsames Format für
  Rezept- und Sud-Sicherung, `recipes.ts` reicht durch. Seiten `BrewsPage` (`/sude`, Menüpunkt „Sude“),
  `BrewPage` (Kopf, Phasen-Tabs leer, „⋯“ mit Brautag starten, Abschließen, Löschen mit Zurückbuchen),
  `brew/StartBrewDialog`; im Rezept der Tab „Sude“ und die Versionsregel (Speichern einer Version mit Suden
  legt eine neue an, Löschen gesperrt, auch in der Rezeptliste; ohne geladene Sude ist Speichern gesperrt).
  `BackupPage`: die Rezept-Karten wurden zur Komponente `DocBackup`, die Sude nutzen sie mit.
- **Prüfung:** `pnpm test` (449, neu `brews.test.ts` mit 13 Tests), `typecheck`, `build` (Hauptbundle
  +1,3 KB, Sud-Export als eigener 2,7-KB-Chunk), redocly (bekannte info-license-Warnung). `RecipeFiles.h`
  samt neuen Tests mit g++ und Unity (von GitHub) außerhalb von PlatformIO gebaut: 12/12 grün;
  `RecipeStore.cpp` mit Stub-Headern auf Syntax geprüft. Im Browser gegen einen Wegwerf-Mock: Sud aus
  fertigem Rezept, Gärplatz wählen und speichern, Start bucht 30 g Motueka ab (250 → 220) und schreibt die
  Kopien, Rezept speichern legt v2 an, v1 und das Rezept lassen sich nicht löschen, Löschen mit Zurückbuchen
  (220 → 250), Sud-Export, 390 px ohne Querscrollen, Konsole ohne Fehler. Firmware-Compile und
  `pio test` (178) nach dem Merge lokal vom Nutzer grün; in der Cloud-Umgebung ist die PlatformIO-Registry
  gesperrt. **Nicht geprüft:** alles am Gerät (PLAN.md).

## 2026-10-13 — Rohstoffverwaltung: Entwurf im Design-Canvas

Im Canvas des Rezept- und Sud-Editors gibt es eine neue Reihe „Zutaten & Lager“: Lager-Übersicht, Katalog,
Einkaufsliste, Buchungs-Journal, dazu die Dialoge Lagerposten und Buchen sowie ein neuer Punkt in der
Navigationsleiste. Rezept › Zutaten und Übersicht zeigen Bestand, Fehlmengen und Zutatenkosten, Sud ›
Vorbereitung die gewählten Posten. Der Entwurf ist frei neu aufgebaut (eine Tabelle über alle Arten statt
eines Tabs je Art) und ergänzt Buchungen mit Verlauf, Reservierung, Meldebestand mit Einkaufsliste sowie
Preise und Kosten; es bleibt bei einem Lager. Die Vorschläge und offenen Punkte stehen in
`BrewControl/docs/rezept-sud-editor.md` › „Entwurf Rohstoffverwaltung“. **Nur Entwurf:** kein Code geändert,
die Seiten sind mit dem Nutzer noch nicht im Detail durchgesprochen und wurden nicht gerendert geprüft.

## 2026-10-13 — Sud 5b-1: Messwerte und Vorbereitung

Plan 5b (Brautag in vier Teil-Etappen, je Session und PR) ist jetzt in `BrewControl/docs/rezept-sud-editor.md`
› „Plan 5b“ eingetragen; der Doku-Commit der Planungssession fehlte. 5b-1 legt das Muster für alle
Brautag-Tabs. Entscheidungen des Nutzers: neuer Sudhaus-Messwert `strikeTemp`; Ist-Menge je Gabe unter der
Gruppe aus Zutat und Posten; Soll für Haupt- und Nachguss ist die Einfüllmenge; Branch `feat/sud-5b-1` mit
PR.

- **Rechnung:** `brewDay.ts` mit `brewTargets` (Kette der Rezept-Tabs auf den Kopien, mit dem Sudhaus des
  Suds), neu die Stammwürze vor dem Kochen (ohne Kochzucker) und die Vorderwürze nach Troesters Mash Gravity
  Test (`TODO(verify)`); `measuredEfficiency` als exakte Umkehrung (Maischeeffizienz, Sudhausausbeute,
  Konversion, Läutereffizienz); `deviation` mit den Toleranzen an einer Stelle. `wortExtract` gibt dafür
  Grist und `boilOtherKg` zurück.
- **Modell und Speichern:** `measurements`, `checked`, `rowAmounts`, `phaseNotes` am Sud, ohne Migration.
  `patchBrew` lädt frisch, setzt ein Feld und schreibt; auch das Kopf-Speichern setzt nur die Kopf-Felder,
  „Abschließen“ ebenso. `rebook`/`lotTarget`/`withBooking` in `brewStart.ts`.
- **UI:** `MeasureRow` (Soll, Ist, Abzeichen, Live-Wert eines verknüpften Fühlers mit „übernehmen“,
  Stammwürze in °P/SG/°Bx), `PrepTab` (Wasser mit Dosen zum Abhaken, Zutaten nach Art mit Ist-Mengen und
  Lagerwarnung, Notiz der Phase). Der Snapshot wird an die Sud-Seite durchgereicht.
- **Prüfung:** `pnpm test` (469, neu `brewDay.test.ts` mit 11 Tests, `brews.test.ts` +9), `typecheck`,
  `build` (Hauptbundle 471,03 kB, +0,03; Rezeptpaket +10,9 kB, gzip +3,8 kB), redocly (bekannte Warnung).
  Im Browser gegen einen Wegwerf-Mock (Vorlage `herms3`, Fühler für Hauptgusstemperatur und Spindel):
  Sollwerte vor dem Start, Start bucht ab, Messwert von Hand und per „übernehmen“, zwei Tabs setzen
  verschiedene Felder und behalten beide, Kopf-Speichern danach lässt die Messwerte stehen, Reload zeigt den
  Wert, Ist-Mengen buchen nach (5 → 5,4 kg) und zurück (→ 4,5 kg), Hopfen über den Bestand hinaus bleibt bei
  der Buchung mit Hinweis, 390 px ohne Querscrollen, Konsole ohne Fehler. **Größe:** 29 Rezeptzeilen, alle
  21 Messwerte, Haken, Ist-Mengen und Notiz: 9 539 Byte (Kopien 5,5 KB bei 8 eingefrorenen Zutaten; je
  weitere Zutat etwa 0,4 KB). Firmware unverändert. **Nicht geprüft:** alles am Gerät (PLAN.md).

## 2026-10-13 — Sud 5b-2: Maischen

Umsetzung von „Plan 5b › 5b-2“ in `BrewControl/docs/rezept-sud-editor.md` (Stand 5b-2 dort). Entscheidungen des
Nutzers: Aufheizen wartet auf „Weiter“, mit verknüpftem Fühler endet es von selbst und meldet sich per
`notify`; Säurevorschlag auch unter Kolbach; das Programm wird bei „Abschließen“/„Löschen“ des Suds und mit
„Timer abbrechen“ gelöscht; der Timer zeigt die Programm-Karte des Dashboards. Gearbeitet auf `dev` (die
Session war daran gebunden), kein eigener PR.

- **Firmware:** `ProgramStep.notify` (lesen/schreiben in `ProgramSteps.*`, damit auch in Profilen und Backup).
  `ProgramRunner::enterStep_` meldet beim ersten Vorwärts-Betreten (`notifiesOnEntry` in neuem header-only
  `ProgramEvents.h`, dieselbe Regel wie die Impulse), der Status-Callback trägt den Schrittnamen; `awaiting`
  nennt den aktuellen Schritt. `AlarmStore::Alert` hat `step[40]` (Ring ~7,4 KB statt ~5,8 KB), JSON `step`,
  `onProgramStatus` kennt `notify` (Info). Die Push-Texte für Programme stehen jetzt in
  `describeProgramAlert` (`ProgramEvents.h`). OpenAPI: `ProgramStep.notify`, `Alert.step`, `detail` `notify`.
- **Web:** `brewDay.ts` mit `mashAcidSuggestion` (Säurehilfe auf der am Messwert verankerten Mash-Spalte),
  Soll „pH Maische“ jetzt vor der Gabe nach pH-Messung, Soll „pH nach der Säure“ = Ziel-pH. Neu
  `brewPrograms.ts` (`mashTimerProgram`, `isRegulated`) und `pages/brew/MashTab.tsx` (pH und Säure,
  Vorderwürze mit Konversion, Rasten mit Ist-Temperatur, Timer mit `ProgramCard`). Ist-Mengen-Logik und
  `AmountInput` aus `PrepTab` nach `pages/brew/amounts.tsx` gezogen. Sud-Felder `restTemps`,
  `mashProgramId`. Meldungen zeigen den Schritt (`AlertCenter`), der Programm-Editor hat „Melden“, die
  Karte 🔔 und lässt „Steuert“ ohne Ziele weg.
- **Prüfung:** `pnpm test` (479; neu `brewPrograms.test.ts` 6, `brewDay.test.ts` +4), `typecheck`, `build`
  (Hauptbundle 471,57 kB, +0,54, gzip +0,16; Rezeptpaket +9,5 kB, gzip +2,8), redocly (bekannte Warnung).
  Firmware: `test_program_events` (6) und `test_program_targets` (14) mit g++, Unity und ArduinoJson 7.4.2 von
  GitHub grün; `ProgramSteps.cpp`, `ProgramRunner.cpp`, `AlarmStore.cpp` mit Stub-Headern ohne Fehler
  übersetzt, der Push-Zweig als Ausschnitt. Im Browser (Chromium per Skript) gegen einen Wegwerf-Mock
  (Vorlage `herms3`, Heizung von Hand, Fühler für Maischetemperatur und pH): Start bucht ab, pH 5,62 ergibt
  4,1 ml Milchsäure, „übernehmen“ bucht von 2 auf 4,1 ml nach (Lager 98 → 95,9), Vorderwürze ergibt die
  Konversion mit Abweichung, Rast-Ist bleibt nach dem Neuladen, „Maischen starten“ legt sechs Schritte an
  (Fühler-Ende und `notify` beim Aufheizen der Maische, `confirm` beim Hauptguss ohne Fühler), „Weiter“ geht
  weiter, „Timer abbrechen“ und „Abschließen“ löschen das Programm, 390 px ohne Querscrollen, Konsole ohne
  Fehler. Gefunden und behoben: Der Name der Schüttung stand auch bei nur einer im Schritt.
- **Nicht geprüft:** `pio test -e native` (erwartet 184), `pio run -e esp32dev` und alles am Gerät (PLAN.md).

## 2026-10-13 — Sud 5b-3: Würzekochen

Umsetzung von „Plan 5b › 5b-3“ in `BrewControl/docs/rezept-sud-editor.md` (Stand 5b-3 dort). Entscheidungen des
Nutzers: „Kochen starten“ beim Anheizen (Vorderwürze und Kochbeginn mit „Weiter“), das Programm führt den
Whirlpool mit, „min vor Kochende“ im Rezept für jede Kochgabe. Branch `feat/sud-5b-3`.

- **Web:** `brewPrograms.ts` mit `boilAdditions`, `boilTimerProgram` und `boilProgress`; `brewDay.ts` mit
  `withResults`, Soll für pH der Würze (nur mit Würze-Gabe) und Luftdruck. Neu `pages/brew/BoilTab.tsx`
  (Kochtimer mit Kopfzeile, Messwerte vor/nach dem Kochen mit Maischeeffizienz und Sudhausausbeute, Gaben
  mit Haken, Uhrzeit und Ist-Menge, Würze abzweigen) und `BrewTimer.tsx` (aus dem Rasten-Timer gezogen, von
  beiden Tabs genutzt). Sud-Felder `boilProgramId`, `addedAt`, Messwerte `speiseVolume`/`dipWortVolume`,
  Ergebnisfelder `ogPlato`, `ogActual`, `mashEffPct`, `yieldPct`, `bottledL`. Rezept-Tab „Sude“ mit Spalten
  und `EfficiencyChart.tsx`. `IngredientCard` zeigt das Zeitfeld für alle Kochgaben.
- **Firmware:** `brewSummaryLine` trägt die fünf Ergebnisfelder; `AlarmStore::setField` schneidet über
  `utf8PrefixLen` (`ProgramEvents.h`) an einer Zeichengrenze. OpenAPI: `BrewSummary` und die Beschreibung von
  `Brew`.
- **Beim Prüfen gefunden und behoben:** Zwei schnell hintereinander gestartete Feld-Speicherungen derselben
  Seite überschrieben einander (jede liest den Sud frisch); die Sud-Seite reiht sie jetzt auf. Betraf auch
  5b-1/5b-2. Die Haken im neuen Tab lasen die Checkbox erst beim Speichern und blieben leer.
- **Prüfung:** `pnpm test` (497; `brewPrograms.test.ts` +10, `brewDay.test.ts` +5, `brews.test.ts` +2,
  `EfficiencyChart.test.ts` 1), `typecheck`, `build` (Hauptbundle 471,59 kB, +0,01; Rezeptpaket 295,77 kB,
  +10,3, gzip +3,6), redocly (bekannte Warnung). Firmware: `pio test -e native` 186 grün (neu je ein Test in
  `test_recipe_files` und `test_program_events`), `pio run -e esp32dev` übersetzt, Flash 98,1 %
  (1 864 169 von 1 900 544 Byte, 36 375 frei). Damit sind auch die bei 5b-2 offenen lokalen Läufe erledigt.
  Im Browser gegen einen Wegwerf-Mock (Vorlage `herms3`, Programm-Uhr 20-fach): Start bucht ab, „Kochen
  starten“ legt sieben Schritte an (Vorderwürze und Kochbeginn mit `confirm`, „Noch 10 min“ mit drei Gaben
  und `notify`, Kochende, Whirlpool), „Weiter“ startet die Kochuhr, die Kopfzeile zählt Kochende und nächste
  Gabe, vier Haken auf einmal bleiben mit Uhrzeit, Ist-Menge 18 → 21 g bucht nach (Lager 82 → 79), Messwerte
  ergeben 72,2 % Maischeeffizienz und 55,2 % Sudhausausbeute, die Index-Zeile trägt die Ergebnisse, der
  Maischen-Timer läuft nach dem Umzug, „Timer abbrechen“ und „Abschließen“ löschen die Programme, der
  Rezept-Tab „Sude“ zeigt Spalten und Diagramm, 390 px ohne Querscrollen, Konsole ohne Fehler. Sud im Mock
  am Ende 5 672 Byte.
- **Nicht geprüft:** alles am Gerät (PLAN.md).

## 2026-10-13 — Sud 5b-4: Maischverlauf und Geräte

Umsetzung von „Plan 5b › 5b-4“ in `BrewControl/docs/rezept-sud-editor.md` (Stand 5b-4 dort). Entscheidungen des
Nutzers, abweichend vom Plan: Zeitanker ist das Einmaischen (Knopf „Eingemaischt“); das Diagramm steht in
jedem Maischen-Tab, nicht nur bei Regelung; die Liste zeigt Geräte statt Transfers, dazu Rührwerk, Ventile,
Kühler und Kondensator; Laufzeit und Menge werden nicht gespeichert; Läutern und Nachguss stehen in beiden
Tabs. Branch `feat/sud-5b-4` von `dev`. Nur Web, Firmware unverändert.

- **Web:** Neu `pages/brew/MashCourse.tsx` (Karte „Verlauf“: `sollCourse` legt die Maische-Linie aus
  `curveOf` am Einmaischen auf die Uhr, `pickLog` schlägt das Log mit dem Maischefühler vor, `sessionFor`
  wählt die Log-Session, `istCourse` schneidet Temperatur und Heizleistung auf das Fenster, `heatActuatorOf`
  findet den Aktor über den Regler der Heizquelle; uPlot mit `uPlot.join`, Live-Punkte alle 5 s),
  `brewDevices.ts` (Geräte der Schritte und Transfer-Pumpen, je Gerät eine Zeile) und
  `pages/brew/DeviceList.tsx` (Karte „Pumpen & Geräte“ mit Hauptschalter, Zustand und Sperre nach
  `ownership.ts`). Sud-Felder `logId` und `phaseStartedAt` mit `setPhaseStart`. `outputPct` aus
  `ControllerCard.tsx` exportiert. `MashTab` und `BoilTab` binden beides ein; der 5b-4-Hinweis bei
  geregelter Maische ist ersetzt. OpenAPI: Beschreibung von `Brew`.
- **Beim Prüfen gefunden und behoben:** Fehlte eine Spalte im Log, las `istCourse` die Zeitspalte als
  Temperatur (Test). Das Feld „Eingemaischt um“ las beim Verlassen den Wert aus dem Zustand statt aus dem
  Feld und konnte eine Eingabe verlieren. Die Legende zeigte als Soll den nächsten Eckpunkt des Plans; jetzt
  liest sie ihn linear dazwischen (`fillLinear`).
- **Prüfung:** `pnpm test` (510; neu `MashCourse.test.ts` 8, `brewDevices.test.ts` 4, `brews.test.ts` +1),
  `typecheck`, `build` (Hauptbundle 471,68 kB, +0,09; Rezeptpaket 304,33 kB, +8,6, gzip 96,06 kB), redocly
  (bekannte Warnung). Im Browser gegen einen Wegwerf-Mock (Vorlage `herms3` mit Regler an der Heizung,
  Pumpen, Rührwerk und Kühler auf Aktoren, Log mit einer Maische, die vor 50 min begann, Snapshot per SSE):
  Das Log mit dem Maischefühler ist vorgeschlagen, „Eingemaischt“ speichert Anker und `logId`, die auf
  −50 min geänderte Zeit legt die Soll-Kurve auf die Messung (63 °C, Rampe, 72 °C), Heizleistung aus der
  CSV, Live-Punkte laufen nach, die Legende liest Soll, Ist und Heizleistung; ein Log ohne Aktor bzw. ohne
  Fühler ergibt den jeweiligen Hinweis. Geräte: Pumpe 2 schaltet (`{"enabled":true}`), das Rührwerk auf
  seinem Minimum bekommt erst `{"v":100}`, Pumpe 1 ist durch einen Regler gesperrt, der Kühler im Koch-Tab
  durch ein Programm, ein Aktor, den es nicht gibt, steht als Hinweis da; Läutern und Nachguss in beiden
  Tabs. Sudhaus von Hand: Diagramm ohne Heizleistung, Timer und Rasten wie bisher, keine Geräte-Karte.
  390 px ohne Querscrollen, Konsole ohne Fehler. Sud im Mock 4 478 Byte, die beiden Felder kosten 59 Byte.
- **Nicht geprüft:** alles am Gerät, auch ein abgeschlossener Sud mit archivierter Log-Session und das
  Schalten bei eingerastetem Not-Aus (PLAN.md).

## 2026-10-14 — Sud 5b am LilyGo geprüft, vier Korrekturen

Die Prüfpunkte „Sud 5b-1 … 5b-4 am Gerät“ aus PLAN.md, am LilyGo (`v0.5.0-104-g43952e3`, Oberfläche aus
`dev` mit Stilvergleich) mit dem Nutzer. Für Timer in Minuten liegt auf dem Board das Rezept „Gerätetest“
(Rasten 23/26 °C je 1 min, 3 min Kochen mit Gaben bei 3/2/1/0 min), dazu die Sudhäuser „Gerätetest von Hand“
und „Gerätetest geregelt“ (aus „Ein-Topf“, Maischefühler = `HLT`, Rührwerk = `agitator`, Umwälzpumpe =
`kettle`) und die Sude #2 und #3; sie bleiben dort. Branch `fix/sud-5b-geraetepruefung`.

- **5b-1:** Start bucht ab (Lagerposten 5 → 4 kg), Messwert von Hand und „übernehmen“ vom Fühler (mit `src`),
  ein zweites Gerät, das zwischendurch ein anderes Feld schreibt, bleibt erhalten, die Ist-Menge bucht nach
  (→ 3,8 kg). Ein Sud-Dokument von 15 956 Byte wird gespeichert und identisch zurückgelesen, 16 756 Byte
  lehnt die Firmware mit 413 ab.
- **5b-2:** „Maischen starten“ legt fünf Schritte an; der Heiz-Schritt endet von selbst, sobald `HLT` über
  der Schwelle liegt (Fühler in der Hand), „Einmaischen“ wartet auf Freigabe. Fünf Meldungen mit
  Schrittnamen, fünf Pushes am Desktop, je einmal. Drei Neustarts per API (in einer Rast, in einem
  Fühler-Schritt, in einer Rast mit `notify`): Das Programm macht am selben Schritt weiter, die Uhr läuft
  durch (59 s → 39 s), keine Meldung wiederholt sich.
- **5b-3:** „Kochen starten“ legt acht Schritte an, ein Neustart mitten im Kochen ändert nichts. Lange
  Schrittnamen enden in der Meldung sauber nach 39 Byte („… 2,5 g Irish Mos“). Vier Haken in 1,5 s bleiben
  alle mit Uhrzeit, Ist-Menge und Messwerte bleiben; `ogPlato`, `ogActual`, `mashEffPct` und `yieldPct`
  stehen in `/brews/index.jsonl` und im Rezept-Tab „Sude“. „Abschließen“ löscht beide Programme.
- **5b-4:** Das Log mit dem Maischefühler ist vorgeschlagen, „Eingemaischt“ und die korrigierte Zeit legen
  die Soll-Kurve richtig, Ist und Heizleistung kommen aus dem Log (934 KB), ein Punkt kurz nach dem Laden
  stammt aus dem Live-Snapshot. Nach dem Leeren des Logs liest der Sud die archivierte Session
  (`?session=…`, 3,6 s). `agitator` und `kettle` lassen sich schalten; ein laufendes Programm und ein
  eingeschalteter Regler auf `kettle` sperren den Schalter mit Grund (beide Hilfsobjekte wieder gelöscht).
- **Gefunden und behoben:**
  - `ProgramCard` und `TimerCard` definierten ihre Knopf-Komponente `Btn` im Rumpf der Karte. Preact sah bei
    jedem Neuzeichnen (jede Sekunde) eine neue Komponente und baute „Zurück/Weiter/Stop“ neu auf; ein Tipp
    in diesem Moment konnte verloren gehen. `Btn` steht jetzt auf Modulebene. Am Gerät: dieselben Knoten
    über 4 s.
  - Ein Aktor im Intervall (`agitator`, 4 von 5 s) sprang in „Pumpen & Geräte“ zwischen 55 % und 0 %. Die
    Zeile zeigt jetzt den Sollwert, das Intervall steht im Tooltip. Am Gerät: 7 s lang 55 %.
  - Die Schwelle eines Fühler-Schritts war ungerundet („HLT > 22.76841“); jetzt auf 0,1 K (Test).
  - Bei eingerastetem Not-Aus ließ sich `agitator` über „Pumpen & Geräte“ wieder einschalten. Die Karte
    sperrt ihre Schalter jetzt („Not-Aus aktiv“, im Mock geprüft). Dass die Firmware die Freigabe annimmt
    und das Dashboard nicht sperrt, steht in PLAN.md.
- **Prüfung:** `pnpm test` (511, +1), `typecheck`, `build` (Hauptbundle 471,85 kB, +0,17).
- **Danach am Gerät:** Not-Aus aufgehoben, `agitator` (55 %), `IDS1` und Regler `Maischen` wie vorher
  eingeschaltet, `kettle` aus mit Sollwert 0,63. Lagerposten wieder 5 kg, die Abbuchungen aus den beiden
  Test-Suden genommen. Das Log „Maischen“ hat seit 00:10 eine neue Session.
- **Offen:** Beim Kochtimer sind vier von sieben Pushes bestätigt (PLAN.md).

## 2026-10-14 — Sud 5b-5: Maischprogramm für geregelte Maischen

PLAN.md › Rezept- und Sud-Editor, „Nächster Schritt“. Branch `feat/maischprogramm-geregelt`. Einzelheiten und
alle Entscheidungen des Nutzers: `BrewControl/docs/rezept-sud-editor.md` › „Stand 5b-5“.

- **Programm:** Bei geregelter Maische legt „Maischen starten“ ein Programm an, das dem Regler der
  Maisch-Heizquelle die Sollwerte setzt (`mashTimerProgram(…, control)`, `mashControlOf`). Aufheizen und
  Abkühlen setzen den Sollwert beim Beginn und enden am Fühler; ein Schritt mit Freigabe setzt nichts, der
  Schritt danach bringt die neue Temperatur. Der Hauptguss gehört dazu, wenn er am selben Regler hängt, und
  wartet nach dem Aufheizen auf „Weiter“. Am Ende hält „Maischen beendet“ den Sollwert bis zur Freigabe,
  dann gehen die Regler aus. Pumpe und Rührwerk schaltet das Programm nicht.
- **Dekoktion:** Ziehen, Rasten und Kochen der Teilmaische und Zurückgeben sind einzelne Schritte; der Regler
  der Maische ist währenddessen aus, ein Regler am Dekoktionskessel bekommt die Sollwerte.
- **Firmware:** „Stop“ schaltet alle Regler und Aktoren aus, die ein Programm anspricht
  (`ProgramRunner::control`, `targetIds` in `ProgramTargets.h`). Vorher blieb alles stehen, auch im
  Dashboard; das gilt jetzt für jedes Programm. `docs/openapi.yaml` und README nachgezogen.
- **Sud:** „Timer abbrechen“, „Abschließen“ und „Löschen“ stoppen ein laufendes Programm, bevor sie es
  löschen (`dropProgram`). Vor einem Start, der sofort heizt, fragt der Tab nach. „Weiter“ am Einmaischen
  setzt die Zeit „Eingemaischt“ (`mashedInAt`), auch beim Rasten-Timer von Hand.
- **Nebenbei geändert:** Ein Sudhaus mit Aufguss (Heizquelle am Regler, aber in einem anderen Behälter ohne
  Spirale und Pumpe) zählt nicht mehr als geregelt und bekommt den Rasten-Timer von Hand; der Regler hält
  dort das Wasser heiß, nicht die Maische.
- **Prüfung:** `pnpm test` (528, +17), `typecheck`, `build` (Hauptbundle 471,94 kB); `pio test -e native`
  (187, +1), `pio run` für `lilygo_t_display_s3_amoled` und `esp32dev`. Im Browser gegen einen Mock: Start
  mit Rückfrage, acht Schritte bis „Regler aus“ mit den Sollwerten am Mock-Regler, „Eingemaischt“ nach dem
  „Weiter“ am Einmaischen, Abbrechen (Stop, Löschen, Regler aus), die Hinweise zu Fühler, Umwälzpumpe und
  fehlendem Regler, Dekoktion mit Regler am zweiten Kessel (zwölf Schritte).
- **Nicht geprüft:** alles am Gerät (PLAN.md). Die SD-Karte des LilyGo hing während der Session nach einem
  Einschalten nicht ein, die Testdaten waren deshalb nicht lesbar.

## 2026-10-14 — Maischeplan: Restmaische halten, Aufheizzeit zählt zur Rast

Zwei Schalter aus der Planung des Maischprogramms (Entscheidungen des Nutzers vom 2026-10-14). Branch
`feat/maischplan-schalter`, aufbauend auf `feat/maischprogramm-geregelt`. Einzelheiten:
`BrewControl/docs/rezept-sud-editor.md` › „Stand 3e“ und „Stand 5b-5“. Nur Web.

- **Restmaische halten** (`Decoction.holdRest`, Haken je Dekoktion): Der Maischeplan rechnet die Restmaische
  ohne Wärmeverlust, wenn der Maischbehälter beheizt ist; sonst ein Hinweis. Das Maischprogramm lässt den
  Regler der Maische dann während der Dekoktion an.
- **Aufheizzeit zählt zur Rast** (`Recipe.mashRampInRest`, Haken unter dem Maischeplan): Die Dauer einer
  Rast läuft ab Beginn des Aufheizens oder Abkühlens; auf Temperatur bleibt Dauer minus Übergang, die
  Maischdauer wird kürzer. Gilt auch für die Rasten der Teilmaische. Im Programm entfällt für solche Rasten
  „Aufheizen auf T“: Die Rast setzt den Sollwert und läuft ihre ganze Dauer; von Hand meldet sie sich beim
  Beginn.
- **Versionsvergleich:** je eine Zeile für beide Schalter. Maischprofile tragen sie nicht.
- **Prüfung:** `pnpm test` (536, +8), `typecheck`, `build`. Im Browser gegen einen Mock: beide Haken im
  Rezept-Editor (Maischdauer 0:32 → 0:31 h im Prüfrezept, gespeichert als `holdRest` und `mashRampInRest`),
  im Sud das Programm mit beiden Schaltern (keine Aufheiz-Schritte, Rasten mit Sollwert, Regler der Maische
  bleibt bei der Dekoktion an).
- **Nicht geprüft:** am Gerät (PLAN.md, beim Prüfpunkt des Maischprogramms).

## 2026-10-14 — Maischprogramm am LilyGo geprüft, Regler-Ausgang bleibt stehen

Firmware und Oberfläche aus `dev` (`v0.5.0-113-gd48a5b6`, mit Stilvergleich) per OTA auf den LilyGo, Prüf-Sud #4
aus „Gerätetest“ mit „Gerätetest geregelt“, ohne Lagerbuchung gestartet und danach abgeschlossen. Keine Platte an
`IDS1`; die Fühler-Schritte wurden mit „Weiter“ übersprungen.

- **Geprüft:**
  - Rückfrage beim Start („… heizt auf 23,3 °C“), sieben Schritte wie erwartet.
  - Am Regler `Maischen` je Schritt der Sollwert: 23,3 → 23 → 26 °C; „Maischen beendet“ hält 26 °C, „Weiter“
    schaltet ihn aus, das Programm ist fertig.
  - „Weiter“ am Einmaischen setzt „Eingemaischt“ (10:17:27) und das Log.
  - „Stop“ in der Programm-Karte schaltet den Regler aus (neu in der Firmware). „Timer entfernen“ löscht ein
    gestopptes oder fertiges Programm nur. „Timer abbrechen“ stoppt, löscht und schaltet aus.
- **Gefunden:** Ein ausgeschalteter Regler lässt seinen Aktor auf dem letzten Wert stehen. Nach „Stop“ und „Regler
  aus“ stand `IDS1` auf 1, eine Platte hätte weitergeheizt. Ursache in SensActCtrl (`Controller::setEnabled` setzt
  nur ein Flag); gilt auch für den Dashboard-Schalter. Auf Wunsch des Nutzers erst in PLAN.md, nicht behoben.
- **Nicht geprüft:** das Ende der Fühler-Schritte bei echtem Heizen und der Haken „Aufheizzeit zählt zur Rast“ am
  Gerät (PLAN.md).
- **Danach am Gerät:** Regler `Maischen` an mit 16 °C (`IDS1` ging dadurch wieder auf 0), `agitator` 55 % im
  Intervall, `kettle` aus mit 0,63, keine Programme des Prüf-Suds, Lager unverändert 5 kg.

## 2026-10-14 — Sud 5c: Plan (nur Doku)

Planungssession für Gärung, Reifung, Abfüllung und den Belegungsplan; gebaut wird in eigenen Sessions.
Der Plan steht in `BrewControl/docs/rezept-sud-editor.md` › Plan 5c.

- **Befund:** Die Rezept-Seite der Gärung ist kaum gebaut. Es gibt nur Phasen mit Name, Temperatur und Dauer.
  Rampe, Druck, Karbonisierung, Hopfenform an der Gabe, Stopfen-Tag und Abfüllmenge fehlen. Die Formeln
  liegen in `brewMath.ts`, nur der Rechner nutzt sie. Deshalb kommt das Rezept zuerst.
- **Schnitt:** sechs PRs.
  - 5c-1: Rezept mit Gärführung, Karbonisierung und Abfüllmenge.
  - 5c-1b: Heiß/Kalt-Schalter.
  - 5c-2: Belegungsplan, Gärplatz-Wahl und Anstellen.
  - 5c-3: Gärprogramm mit Rampe in der Firmware und Stopfgaben.
  - 5c-4: Messreihen von Hand und Gärverlauf.
  - 5c-5: Reifung, Abfüllung, Bilanz und Index-Felder.
- **Entscheidungen:**
  - Der Belegungsplan steht oben auf der Sude-Liste.
  - Messreihen von Hand bekommen die neue Route `/api/brews/{id}/readings`.
  - Die Rampe kommt in die Firmware (`rampSec`).
  - Der Druck wird nur gemeldet.
  - Stopfgaben melden sich per `notify` bei Zugabe und Entnahme.
  - Am Programmende hält der Regler bis „Weiter“, dann geht er aus.
  - Die Index-Zeile bekommt Alkohol, Endvergärungsgrad und Restextrakt.
  - Der Gärplatz bekommt einen Dichtesensor.
  - Dip Hopping bekommt keinen Soll.
  - Mehrere Gebinde gibt es schon im Rezept.
- **Abhängigkeit:** 5c-3 braucht eine Lösung für den Regler, der beim Ausschalten seinen Aktor stehen lässt
  (PLAN.md › Bugs).
- **Doku:** Konzept-Doc (Plan 5c, Verweise in Gärung, Gärkeller, Anknüpfung, Offen) und PLAN.md (Punkt
  Rezept- und Sud-Editor, Manueller Sensor). Keine Code-Änderung.

## 2026-10-14 — Sud 5c-1: Rezept – Gärführung, Karbonisierung, Abfüllmenge

Umsetzung nach `BrewControl/docs/rezept-sud-editor.md` › Plan 5c › 5c-1, nur Web. Einzelheiten stehen dort unter
„Gärung › Stand 5c-1“.

- **Modell:** Phase mit `rampDays`, `pressureBar`; Rezept mit `pressureFermentation`, `trubLossL`, `carbonation`,
  `bottling.containers`; Hopfengabe mit `form`, `dryHopDay`, `dryHopDays`. Lot-Einträge im Katalog tragen ihre
  Form (`lotForm`), `hopFormOf` nimmt Zeile, dann Lager, dann T90.
- **Rechnung:** neues `web/src/fermentation.ts` (Hopfenaufnahme je Form, `wortDraw`, `calcBottling`,
  `calcCarbonation`). In `brewMath.ts` neu sind `krausenRackingPlato` und `forcedCarbonationBar`, beide
  `TODO(verify)`. Ein Plausibilitätstest liegt bei: 2,5 vol bei 4 °C ergibt etwa 0,8 bar, das Schlauchen liegt etwa
  0,8 °P über dem Restextrakt.
- **Entscheidungen des Nutzers:**
  - Hopfen im Kessel und Speise gehen schon jetzt überall ein: in `fermenterIntake`/`resolveDilution`, also auch in
    den Verschnitt im Gärbehälter, und in die Effizienz im Gärbehälter.
  - Abweichung, im Plan freigegeben: Die Effizienz zieht die Speise nicht ab, sonst entstünde bei der Grundlage
    „Brewhouse-Efficiency“ ein Zirkel.
  - Zwangskarbonisierung bei der Temperatur der letzten Phase; Trub ohne Angabe 0 l.
- **UI:** Gärung-Tab in eigener Datei mit den Karten Gärführung (Druck-Schalter, Rampe, Druck), Zutaten (Form,
  Stopfen), Karbonisierung und Abfüllmenge (Trub, Gebindezeilen mit Restzeile, Kennzahlen, Balken, Berechnung).
  Gärplätze und Gebinde lädt der Tab selbst. Der Versionsvergleich zeigt die neuen Felder.
- **Verifikation:**
  - `pnpm test` 553 grün (neu: `fermentation.test.ts` mit Bilanz der Kette, Gebinde-Restzeile, Hopfenform,
    Speise mit Verschnitt nach Stammwürze, Formeln; dazu ein Test im Versionsvergleich).
  - Zwei Erwartungen in `recipeStats.test.ts` sind angepasst, weil 20 g T90 im Kessel jetzt 0,1 l zurückhalten.
  - `pnpm typecheck`, `pnpm build`.
  - Browser gegen einen Node-Mock (25 l, Verschnitt 2 l im Gärbehälter, Hopfen T90/T45-Lager/Stopfen, Speise,
    Keg 19 l + Flaschen-Restzeile) bei 390 px ohne Querscrollen: Die Kette geht auf (25 + 2 = 26,9 l + Rundung),
    der Wasser-Tab zeigt dieselbe Anstellmenge. Zucker, Grünschlauchen, Zwangskarbonisierung und der Druckhinweis
    sind durchgeklickt.
  - Kein Gerät.

## 2026-10-14 — Sud 5c-1b: Heiß/Kalt-Schalter

Umsetzung nach `BrewControl/docs/rezept-sud-editor.md` › Plan 5c › 5c-1b, nur Web. Einzelheiten stehen dort unter
„Wasser › Wassermenge › Heiß/Kalt-Schalter“.

- **Modell:** `volumeBasis?: 'hot' | 'cold'` am Rezept, ohne Angabe heiß. Bei „kalt“ ist `volumeL` die Anstellwürze.
- **Rechnung:** `knockOutL` in `recipeStats.ts` löst die Vorwärtskette nach dem Ausschlag auf (Regula falsi), weil der
  Ausschlag über Effizienz, Speise und Verschnitt nach °P in sich selbst zurückwirkt. `pitchL` in `recipeWater.ts`
  ist jetzt die eine Definition der Anstellwürze (auch für `calcBottling`).
- **Leser:** Übersicht, Wasser, Maischen, Gärung, Versionsvergleich und `brewTargets` rechnen mit der Kopie aus
  `atKnockOut`. `calcTreatment` nimmt die Farbe jetzt vom Ausschlag aus `Water`, deshalb können Aufbereitung und
  Automatik beim Original-Rezept bleiben. Abweichung vom Doc-Wortlaut, im Plan freigegeben: Die Kettenfunktionen
  selbst lesen weiter `volumeL` (der Kopie), sonst würde die Lösung rekursiv.
- **Entscheidungen des Nutzers:**
  - Ist eine Anstellwürze nicht erreichbar, gibt es einen Hinweis, nichts wird gesperrt.
  - Umschalten rechnet die Menge um.
  - Die Rezeptliste bekommt keinen Bezug, das bleibt offen (PLAN.md).
- **UI:** Das Mengenfeld der Übersicht heißt „Ausschlagmenge“ oder „Anstellwürze“ und hat den Schalter heiß/kalt. Bei
  kalt zeigt es den Ausschlag darunter. In den Berechnungen von Wasser und Gärung steht „Rezept“ an der Anstellwürze.
  Der Versionsvergleich hat das Feld „Mengenbezug“.
- **Verifikation:**
  - `pnpm test` 576 grün, die bestehenden Tests sind unverändert. Neu sind die Rundreise heiß ↔ kalt in neun Fällen
    (ohne Sudhaus, Verluste, Speise, Verschnitt in Pfanne und Gärbehälter nach Menge und °P, Grundlagen
    Brewhouse-Efficiency und Konversion), dazu ohne Katalog, nicht erreichbar, Versionsvergleich und `brewTargets`.
  - `pnpm typecheck`, `pnpm build`.
  - Browser gegen den Mock aus 5c-1 bei 390 px ohne Querscrollen: Umschalten 25 l heiß → 21,3 l kalt bei gleichen
    Kennwerten, zurück wieder 25 l. Die Gärung rechnet vom Ausschlag 25,0 l auf 21,3 l Anstellwürze, der Wasser-Tab
    zeigt „Ausschlag (aus der Anstellwürze)“. Hinweis bei 1,5 l. Keine Konsolenfehler.
  - Kein Gerät.

## 2026-10-14 — Sud 5c-2: Belegungsplan, Gärplatz-Wahl, Anstellen

Umsetzung nach `BrewControl/docs/rezept-sud-editor.md` › Plan 5c › 5c-2, nur Web. Einzelheiten stehen dort unter
„Sud › Stand 5c-2“.

- **Belegungsplan** (`occupancy.ts`, `CellarPlan.tsx`) oben auf der Sude-Liste: acht Wochen ab der Vorwoche, eine
  Zeile je Gärplatz, belegt/reserviert/abgeschlossen, Überschneidung rot mit Hinweis, laufende Sude über ihre
  Belegung hinaus bis heute („überfällig“).
- **Tab Gärung** (`FermentTab.tsx`): Gärplatz nach dem Start wählen (erneuert `frozen.fermenter`, Optionen mit
  Belegung), Hinweise zu Volumen, Druck und Temperierung; Anstellen mit Anstellwürze, Stammwürze (neu
  `pitchGravity`), Anstelltemperatur und Gesamteffizienz als Ist; Gaben „Anstellen“ und „Dip Hopping“;
  „Angestellt“ mit Korrektur der Zeit, die Belegung wandert mit (`pitchBrew`); Gärführung mit aktueller Phase.
- **Rechnung:** `brewTargets` hat die Sollwerte des Anstellens und der Speise und nimmt den Trub des Gärplatzes.
  `measuredFermenterPct` rechnet die Gesamteffizienz zurück. Die Index-Zeile führt Soll und Ist der Stammwürze als
  Paar: an der Anstellwürze, sobald sie gemessen ist.
- **Entscheidungen des Nutzers:**
  - Neues Feld **Umgebungstemperatur am Gärplatz** (`ambientTempC`), weil der Gärplatz ein Behälter ist und an
    verschiedenen Orten stehen kann. Leer = kein Temperierungs-Hinweis, Toleranz 2 K.
  - Dip-Gaben in beiden Tabs mit demselben Zustand.
  - Die Sperre der Gärplatz-Wahl bei laufendem Gärprogramm kommt mit 5c-3.
- **Abweichung vom Plan:** Die Index-Zeile stellt auch `ogPlato` um, nicht nur `ogActual`.
- **Umbau:** Die Zeile einer Gabe (`AdditionRow`), die Effizienz-Zeile (`EffRow`) und `toLocalInput` sind geteilt.
  `Patch` kann Kopffelder in den Entwurf übernehmen, damit „Speichern“ sie nicht zurückschreibt.
- **Verifikation:**
  - `pnpm test` 596 grün (neu: `occupancy.test.ts`, dazu `pitchBrew`, Sollwerte des Anstellens, Trub des
    Gärplatzes, Rundreise der Gesamteffizienz, Paar-Regel der Index-Zeile, `fermentationSchedule`,
    `fermenterHints`).
  - `pnpm typecheck`, `pnpm build`, Redocly-Lint (`Fermenter.ambientTempC`, Beschreibung `ogPlato`/`ogActual`).
  - Browser gegen einen Mock bei 390 px ohne Querscrollen der Seite: Plan mit Überschneidung, überfällig, Blättern
    und „ohne Gärplatz“; Brautag starten, Gärplatz wechseln, Hinweise, „Angestellt“ und Korrektur der Zeit,
    Messwerte, Index-Zeile, Speise-Soll. Keine Konsolenfehler.
  - Kein Gerät.

## 2026-10-15 — Regler aus/an: sicherer Ausgang, Kopplung an den Aktor-Schalter

Bug aus PLAN.md (2026-10-14, „Ein ausgeschalteter Regler lässt seinen Aktor auf dem letzten Wert stehen“) und ein
zweiter, vom Nutzer beim Prüfen gemeldeter: Aktor aus, Regler ein → der Aktor bekam die richtige Leistung als Ziel,
blieb aber aus; die Regler-Karte zeigte 0 %, weil `Actuator::state()` bei ausgeschaltetem Aktor `min` meldet.

- **Root Cause:** `Controller::setEnabled` in SensActCtrl setzte nur ein Flag. PID und Zweipunkt kehren in `tick()`
  bei `!enabled()` sofort zurück und schreiben nichts mehr; DualStage/SplitRange schrieben erst im nächsten Tick 0.
  Dashboard (`ControllerCard`) und Display schrieben deshalb nach dem Ausschalten selbst `min`/0 — Programm-„Stop“,
  Programmschritte `{enabled:false}` und Timer hatten diesen Umweg nicht. Der Regler-Schalter wirkte außerdem nie
  auf den Hauptschalter des Aktors.
- **Entscheidung des Nutzers:** Der Regler-Schalter wird in beide Richtungen an den Hauptschalter seiner Aktoren
  gekoppelt.
- **Umsetzung:**
  - `Controller::setEnabled` nach dem Muster von `Actuator`: nur bei echtem Wechsel, ruft den neuen geschützten
    Hook `applyEnabled(bool)`. PID schreibt beim Ausschalten `minOutput`, Zweipunkt 0 (und vergisst „an“),
    DualStage/SplitRange `writeOff()`; danach werden die Aktoren aus- bzw. beim Einschalten eingeschaltet.
    `RateLimitedController` reicht weiter wie bisher.
  - Firmware: `POST /api/controllers/<id>/params` lehnt bei eingerastetem Not-Aus `enabled:true` und
    `autotune:"start"` mit 409 `estop latched` ab (sonst gäbe „Regler an“ die Aktoren frei); `openapi.yaml`
    nachgezogen. Der Schreib-Umweg im Display-Power-Knopf ist raus.
  - Web: Der Schreib-Umweg in `ControllerCard` ist raus. „Aktor schalten und Regler deaktivieren“ schaltet jetzt
    erst den Regler aus und dann den Aktor — sonst hätte das Ausschalten des Reglers den Aktor gleich wieder
    ausgeschaltet.
  - Neustart: `RuntimeState` stellt erst Regler, dann Aktoren wieder her, der gespeicherte Zustand bleibt also
    erhalten.
  - Doku: `SensActCtrl/README.md` (Semantik von `setEnabled` beim Controller), `BrewControl/README.md`
    (Display-Power-Knopf).
- **Verifikation:**
  - SensActCtrl `pio test -e native` 364 grün (neu: je Regler „Ausschalten schreibt den sicheren Wert sofort und
    schaltet die Aktoren aus“, „Einschalten schaltet sie ein“, wiederholtes Ausschalten schreibt nichts, Kopplung
    durch `RateLimitedController`; die neuen Tests schlugen vor der Umsetzung fehl).
  - BrewControl-Firmware `pio test -e native` 187 grün, `pio run -e esp32dev` und
    `-e lilygo_t_display_s3_amoled` erfolgreich (esp32dev Flash 98,1 %; LilyGo nur mit kurzem `PLATFORMIO_WORKSPACE_DIR`, weil der Worktree-Pfad beim Entpacken von WebSockets die Windows-Pfadgrenze sprengt).
  - Web `pnpm typecheck`, `pnpm test` 596 grün; Redocly-Lint ohne neue Warnung.
  - **Am LilyGo** (Firmware `v0.5.0-123-gee9741d-dirty` per OTA, UI mit Stilvergleich): Die Platte war nicht
    angeschlossen; ihre Anbindung ist laut Nutzer schon geprüft. Statt `IDS1` diente deshalb `agitator` (Relais mit
    LED) unter einem vorübergehenden Zweipunktregler `testregler` (`HLT` → `agitator`, 25 °C).
    - Per API: `IDS1` aus → `Maischen` an schaltet `IDS1` ein, aus schaltet ihn wieder aus (Ziel 0). Bei
      eingerastetem Not-Aus lehnt die Firmware `enabled:true` und `autotune:"start"` mit 409 ab, `enabled:false`
      geht durch.
    - Programm mit den Schritten „Regeln“ (15 s) und „Regler aus“: Zu Beginn von „Regler aus“ geht `agitator` im
      selben Moment auf 0 und aus. „Stop“ während „Regeln“ schaltet ebenso aus, der Start schaltet ihn wieder ein.
    - Vom Nutzer geprüft: Regler-Schalter im Dashboard (aus: LED aus, Aktor-Schalter aus; an: LED an, Schalter in
      Mittelstellung mit Hintergrund, Regler-Karte 100 %), Power-Knopf am Display, „Aktor schalten“ und „Aktor
      schalten und Regler deaktivieren“ (Regler aus, Aktor an mit 0). Danach hat der Nutzer noch mit einem
      binären Schalter getestet, auch das funktionierte.
    - Testregler und Testprogramm gelöscht; den übrigen Gerätezustand hat der Nutzer selbst eingestellt.
- **Offen gelassen (PLAN.md):** Reihenfolge Regler/Aktor im selben Programmschritt; großes dt im ersten PID-Schritt
  nach dem Wiedereinschalten.

## 2026-10-15 — Sud 5c-3: Gärprogramm, Firmware-Rampe, Stopfgaben

Umsetzung nach `BrewControl/docs/rezept-sud-editor.md` › Plan 5c › 5c-3, auf dem Regler-Fix von PR #107. Einzelheiten
stehen dort unter „Sud › Stand 5c-3“.

- **Firmware:** Schrittfeld `rampSec` (`ProgramSteps`, `openapi.yaml`, `types.ts`). Regler-Sollwerte laufen linear
  vom vorigen Wert des Programms; die Rechnung steckt rein in `ProgramRamp.h`, der `ProgramRunner` setzt sie beim
  Schrittbeginn, nach Neustart, `resume` und `prev` ein, führt sie im `tick` nach (je Sekunde, ab 0,05 K) und setzt
  das Ziel, wenn der Schritt endet oder auf Freigabe wartet. Eine Pause friert sie ein.
- **Web:** Feld „Rampe“ im Programm-Editor, ↗ in der Programmkarte. Generator `fermentationProgram` mit
  `fermentControlOf` und `dryHops`; Karte „Gärprogramm“ im Tab Gärung, Sperre der Gärplatz-Wahl, aktuelle Phase vom
  Programm; Stopfgaben zum Abhaken mit „entnommen“ (`DryHopList`), neuer Tab Reifung (`MaturationTab`).
- **Entscheidungen des Nutzers:**
  - Der Regler-Bug wird in einem eigenen PR vorher behoben (PR #107).
  - Der erste Programmschritt ist das Anstellen; die Anstellzeit kommt von dessen „Weiter“ (`pitchedAtOf`), ein
    Aufholen auf eine ältere Anstellzeit gibt es nicht. „Angestellt“ ist in diesem Schritt das „Weiter“.
  - Stopfgaben nach Zeitpunkt: Hauptgärung im Tab Gärung, Reifung im Tab Reifung.
- **Annahmen:** Tag d einer Stopfgabe = d × 24 h nach dem Anstellen. Gaben ohne Tag meldet das Programm nicht. Die
  erste Phase rampt nicht. Ohne Regler gibt es keinen Endschritt.
- **Nebenbei:** `AdditionRow` zeigt bei einer Gabe von einem anderen Tag das Datum zur Uhrzeit und nimmt einen
  Abschluss (`extra`) für den Haken „entnommen“.
- **Verifikation:**
  - Firmware `pio test -e native` 194 grün (neu: `test_program_ramp`, 7 Fälle: linear, Ende, kein Vorwert,
    stückweise, Schwelle). `pio run -e esp32dev` (Flash 98,2 %) und `-e lilygo_t_display_s3_amoled` erfolgreich.
  - Web `pnpm typecheck`, `pnpm test` 604 grün (neu: Generator mit Rampen-Teilung, gleichzeitige Gaben, Druck,
    ohne Regler, `pitchedAtOf`, `fermentControlOf`), `pnpm build`.
  - Redocly-Lint ohne neue Warnung.
  - Browser gegen einen Mock mit simuliertem Programm-Runner bei 390 px ohne Querscrollen: Start mit Rückfrage,
    „Angestellt“ schaltet das Programm weiter und übernimmt dessen Zeit, Sperre, aktuelle Phase vom Programm,
    Stopfgaben in beiden Tabs mit Speichern von `addedAt` und `removed:<id>`, Feld „Rampe“ mit Wert aus einem Profil.
  - **Am LilyGo geprüft** (Firmware `v0.5.0-127-g80be251-dirty` per OTA, UI `webui-full.tar` mit Stilvergleich):
    - Rampentest mit einem vorübergehenden Zweipunktregler `testregler` (`HLT` → `agitator`) und einem Programm von
      Hand (20 → 22 °C in 120 s): Der Sollwert folgt dem Erwartungswert in 0,05-K-Stufen und landet genau auf 22,00.
      Neustart nach 40 s der Rampe: weiter bei 20,77 (erwartet 20,78). Pause: bleibt bei 21,13, „Fortsetzen“ ohne
      Sprung (21,17 wie erwartet). „Weiter“ bei 20,45 setzt sofort 22,00. „Regler aus“ schaltet Regler und `agitator`
      aus. Die Meldung des Rampenschritts kommt.
    - Echtes Gärprogramm aus dem Tab Gärung: Rezept „Gerätetest“ v2 (`geraetetest-v2`, drei Phasen à 0,002 d mit
      Rampen, Stopfgaben Citra in der Hauptgärung und Mosaic in der Reifung), Gärplatz „Testgärplatz“ (`fm-test`) am
      `testregler`, Sud #5 „Gärtest 5c-3“ ohne Lagerbuchung. Rückfrage beim Start, „Angestellt“ schaltet das Programm
      weiter und übernimmt dessen Zeit, Gärplatz-Wahl gesperrt, aktuelle Phase vom Programm. Alle Schritte zur
      erwarteten Zeit, die Teilung der Kaltlagerungs-Rampe bei Mosaic genau auf 20,0 °C. Der Nutzer hat alle Pushes
      bekommen (Stopfen/Entnehmen beider Gaben, Freigabe, fertig). Haken „zugegeben“ und „entnommen“ in beiden Tabs
      gespeichert. „Weiter“ am Ende schaltet den Regler aus, „Abschließen“ nimmt das Programm mit.
    - Danach Testregler und Programme gelöscht, `agitator` auf 64 %, Intervall 4/5 s zurück. Rezept v2, Gärplatz
      und Sud #5 bleiben als Prüfdaten. `IDS1` steht nach dem OTA-Neustart auf 0 statt vorher 1 (Regler `Maischen`
      aus); laut Nutzer so lassen.

## 2026-10-15 — Sud 5c-4: Messungen von Hand und Gärverlauf

Umsetzung nach `BrewControl/docs/rezept-sud-editor.md` › Plan 5c › 5c-4. Einzelheiten stehen dort unter „Sud › Stand 5c-4“.

- **Firmware:** Route `GET/PUT /api/brews/<id>/readings` (`/brewreadings/<id>.json` über `JsonDocDir::write`, nur
  SD-Boards), `DELETE /api/brews/<id>` löscht die Messungen mit. Die Handler stehen vor denen von `/api/brews/<id>`;
  dazu bekamen `GetPrefixHandler` und `PutJsonPrefixHandler` ein optionales Suffix, und `brewReadingsId` in
  `RecipeFiles.h` holt die Id (nativ getestet). `openapi.yaml` (Pfad, Schema `BrewReadings`, `Fermenter.densitySensor`,
  `Brew.fermentLogId`) und die README-Tabelle sind nachgezogen.
- **Web:** `brewReadings.ts` (Modell, Laden/Speichern, `entryToReading`, `readingText`), Karte „Messungen“ in
  Gärung und Reifung, `densitySensor` am Gärplatz (Feld im Dialog, Hinweis bei fremder Einheit), Sud-Sicherung mit
  `readings`, `fermentSollCourse` (Plan als Linie in Tagen) und `fermentCourse.ts` (Spalten aus Plan, Log und
  Messungen), Karte „Gärverlauf“ (`FermentCourse`, uPlot mit °C links und °P rechts, Log-Wahl `fermentLogId`).
- **Annahmen:** Der Körper der Route ist ein Objekt `{ id, readings }`, weil `PutJsonPrefixHandler` nur Objekte
  nimmt. Die Grenze ist der Body von 16 KB (etwa 300 Messungen), kein eigener Check in der Firmware; das Web prüft
  vorher. Die neuen Typen stehen in `brewReadings.ts`, nicht in `types.ts` (dort stehen nur die Snapshot-Formen).
  Ein °Bx-Wert wird roh gespeichert und mit der Stammwürze (`pitchGravity`, sonst Soll) umgerechnet. `fermentLogId`
  wird nicht beim Anstellen gesetzt, ohne Wahl gilt das erste Log mit dem Fühler. Der Verlauf liegt nur im Tab
  Gärung, die Reifung hat nur die Karte „Messungen“.
- **Abweichung vom Plan:** Die Dichte-Eingabe ist ein eigenes Textfeld mit Einheiten-Schalter statt `GravityInput`,
  weil dieses den Wert bei jedem Tastendruck neu formatiert und eine Eingabe wie „1,0“ nicht zulässt. Die Liste
  zeigt die Messungen älteste zuerst (die Reihenfolge der Datei), nicht neueste zuerst.
- **Nebenbei:** `UNIT_FITS` aus `brewhouse.ts` ist jetzt exportiert (der Hinweis des Gärplatzes nimmt die Einheiten
  für °P), `makeBundle` hat einen Parameter `extra`.
- **Verifikation:**
  - Firmware `pio test -e native` 197 grün (neu: drei Fälle für `brewReadingsId`). `pio run -e esp32dev` (Flash 98,2 %,
    die Route ist dort nicht gebaut) und `-e lilygo_t_display_s3_amoled` erfolgreich.
  - Web `pnpm typecheck`, `pnpm test` 640 grün (neu: `brewReadings`, `fermentCourse`, `fermentSollCourse`, Sicherung
    mit und ohne Messungen, Dichtesensor-Hinweis), `pnpm build`.
  - Redocly-Lint ohne neue Warnung (nur die bekannte `info-license`).
  - Browser gegen einen Wegwerf-Mock mit Log, Regler und Spindel: Verlauf mit Plan, Ist, Regler-Soll, Dichte aus dem
    Log und Punkt einer Handmessung, Eintragen (SG → 5,6 °P) und Löschen, Karte in der Reifung, bei 375 px kein
    Querscrollen der Seite (nur die Tab-Leiste scrollt wie bisher).
  - **Kein Gerät:** Route, Löschen mit dem Sud und das Zurückspielen der Sicherung sind am Gerät nicht geprüft
    (PLAN.md › Hardware-Verifikation).
- **Offen gelassen (PLAN.md):** nur die jüngste Log-Session im Verlauf und das Laden der ganzen Session, Messungen
  nur löschbar, `tilt`-Sensoren nicht in °P umgerechnet.

## 2026-10-16 — Sud 5c-5: Reifung, Abfüllung, Bilanz, Index

Umsetzung nach `BrewControl/docs/rezept-sud-editor.md` › Plan 5c › 5c-5. Einzelheiten stehen dort unter „Sud › Stand 5c-5“.
Damit ist Plan 5c abgeschlossen.

- **Web:** `bottlingDay.ts` (`beerNow`, `carbonationNow`, `carbonationPlan`, Gebinde-Rechnungen), `brewDay.ts` (Soll für
  Restextrakt, Höchsttemperatur, Abfüllmenge; `BrewInputs.containers`, `BrewTargets.bottling`; `actualBeer`, `plannedBeer`;
  `withResults` mit den neuen Index-Feldern), `brews.ts` (`bottleBrew`, `setContainerCount`, `containerCounts`),
  `brewReadings.ts` (`lastGravity`), Tab Abfüllung (`BottlingTab`), Karte „Messwerte nach der Gärung“ in der Reifung
  (`FinishRow`), `MeasureRow` mit `suggest`, `ResultRow`, drei neue Spalten im Rezept-Tab „Sude“.
- **Firmware:** `brewSummaryLine` nimmt `abvPct`, `attenuationPct`, `fgPlato` auf (Test erweitert); `openapi.yaml` und die
  README-Zeile von `/api/brews` nachgezogen. Keine neue Route.
- **Annahmen** (beim Genehmigen des Plans genannt): Gebinde nicht eingefroren, live aus `/api/containers`; Ist-Jungbier aus der
  gemessenen Anstellwürze abzüglich Trub und Stopfhopfen plus Speise; Speise-Urteil mit dem Vergärungsgrad der Hefe; Ist-Alkohol nur
  mit Stammwürze der Anstellwürze (ohne Verschnitt im Kessel auch nach dem Kochen), ohne die Gärung der Speise; „Abgefüllt“ schließt
  den Sud nicht ab.
- **Abweichung vom Plan:** Die Spaltenköpfe des Rezept-Tabs „Sude“ (und die Namen der Spalten im Wert) wechseln von `sm` auf `xl`,
  weil die Zeile mit neun Spalten schon bei 820 px umbrach und die Werte dort ohne Namen standen. `bottledL` im Index wird jetzt wie
  die anderen Ergebnisse aus der Messung gesetzt und entfällt ohne sie (vorher blieb ein vorhandener Wert stehen; nichts schrieb ihn).
- **Verifikation:**
  - Web `pnpm typecheck`, `pnpm test` 668 grün (neu: `bottlingDay`, `lastGravity`, `bottleBrew`, `setContainerCount`,
    Soll und Index in `brewDay`, `calcCarbonation` mit Temperatur), `pnpm build`.
  - Firmware `pio test -e native` 197 grün; `pio run` für `esp32dev` (Flash 98,2 %, unverändert) und
    `lilygo_t_display_s3_amoled` (32,4 %) erfolgreich.
  - Redocly-Lint ohne neue Warnung (nur die bekannte `info-license`).
  - Browser gegen einen Wegwerf-Mock: Vorschläge übernehmen, Höchsttemperatur ändert Restkohlensäure und Zucker, Gebinde ändern,
    „Abgefüllt“ setzt `occupiedUntil`, Speise-Urteil, Bilanz, Spalten im Rezept-Tab; 375 und 820 px ohne Querscrollen.
  - **Kein Gerät:** das `PUT` mit den neuen Index-Feldern und die Spalten am echten Gerät sind nicht geprüft (PLAN.md ›
    Hardware-Verifikation).
- **Offen gelassen (PLAN.md):** Gebinde-Bestand wird nicht abgebucht; der Alkohol zählt die Gärung der Speise nicht mit.

## 2026-10-16 — Sud: Verkostung

Neuer Tab „Verkostung“ im Sud. Einzelheiten stehen in `BrewControl/docs/rezept-sud-editor.md` › „Verkostung (Stand 2026-10-16)“.

- **Entscheidungen des Nutzers:** mehrere Verkostungen je Sud mit Zeitpunkt; eigener Tab; Auswahl von Begriffen, nur der Genuss-Faktor
  ist eine Zahl (1 bis 5 Sterne); keine Anzeige in der Sudliste. Aufbau nach den fünf Phasen (Aussehen, Geruch, Antrunk, Haupttrunk,
  Nachtrunk) plus Fehlaromen und Gesamteindruck; Aromen nur beim Geruch und als Nachhall, nicht in jedem Trunk. Trübung als eine
  Skala (glanzfein bis opak) plus „nicht beurteilbar (zu dunkel)“; bei „Kein Schaum“ sind Schaumstruktur und -haltbarkeit gesperrt;
  keine Note für die technische Ausführung. Der erste Entwurf (Aromen in jedem Trunk, zwei Balance-Achsen) wurde noch am selben Tag
  umgebaut, bevor etwas committet war.
- **Firmware:** `GET/PUT /api/brews/<id>/tasting` (`/brewtasting/<id>.json`), Löschen mit dem Sud. `brewReadingsId` und
  `brewTastingId` teilen sich `brewSubId` (`RecipeFiles.h`). `openapi.yaml` (Pfad, Schema `BrewTasting`, `deleteBrew`) und die
  README (Tabelle, Sicherung) nachgezogen. Kein neues Index-Feld.
- **Web:** `brewTasting.ts` (Typen, Listen- und Auswahl-Funktionen, `fitsLimit`, Store), `tastingVocab.ts` (Aroma- und
  Fehlaroma-Begriffe, Auswahllisten mit Hinweisen), `ChipGroup`, `StarRating`, `TastingForm`, `TastingTab` (entprellter Autosave,
  Speichern beim Verlassen), `PHASES` um `tasting` erweitert, Export und Import der Sud-Sicherung um `tasting`. Etwa 12 voll
  ausgefüllte Verkostungen (1,2 KB) passen in das Dokument.
- **Begriffe:** eigene deutsche Fassung in der Art des Bier-Aromarads, kein BJCP-Text (Urheberrecht, öffentliches Repo).
  Die „häufigen Ursachen“ der Fehlaromen sind eine erste Fassung (PLAN.md).
- **Verifikation:**
  - Web `pnpm typecheck`, `pnpm test` 734 grün (neu: `brewTasting`, `tastingVocab`, Sicherung mit `tasting`), `pnpm build`.
  - Firmware `pio test -e native` 200 grün (neu: drei Tests für `brewTastingId` in `test_recipe_files`); `pio run` für `esp32dev`
    und `lilygo_t_display_s3_amoled` erfolgreich.
  - Redocly-Lint ohne neue Warnung (nur die bekannte `info-license`).
  - Browser gegen einen Wegwerf-Mock bei 375 px: Verkostung anlegen, Auswahl, Hinweis unter der gewählten Option, „Kein Schaum“
    sperrt Struktur und Haltbarkeit, Sterne setzen und löschen, Fehlaroma mit Stufe, Autosave, Reload (Gruppen mit Auswahl starten
    offen), Speichern beim Wechsel des Tabs, Löschen; kein Querscrollen. Firmware seit dem Umbau unverändert (die Compiles und
    Tests oben gelten weiter).
  - **Kein Gerät:** `GET/PUT /api/brews/<id>/tasting` am echten Gerät nicht geprüft (PLAN.md › Hardware-Verifikation).
- **Offen gelassen (PLAN.md):** Auswertung in Sudliste und Rezept; Begriffe und Ursachen mit Erfahrung durchsehen.

## 2026-10-16 — Geräteprüfung LilyGo: Messungen, Verkostung (API-Ebene)

- **Aufgespielt:** Firmware von `dev` (`lilygo_t_display_s3_amoled`, Flash 32,4 %) per `POST /api/update/firmware`. Vorher antworteten
  `/readings` und `/tasting` mit 404, weil die Datei fehlt – das ist auch der Sollzustand ohne Daten.
- **Geprüft** (Wegwerf-Sud `hwtest1`, danach gelöscht): `PUT` mit fremder Body-ID → 400 `id mismatch`, mit `a.b` → 400 `invalid id`;
  `PUT` beider Routen 204; die Dateien liegen als `/brewreadings/hwtest1.json` und `/brewtasting/hwtest1.json`; Neustart
  (`POST /api/network`), danach beide wieder lesbar und der Sud in `/api/brews`; `DELETE /api/brews/hwtest1` 204 räumt beide
  Dateien weg (Verzeichnisse leer).
- **Abfüllung (Index):** `PUT /api/brews/hwtest2` mit `fgPlato`, `abvPct`, `attenuationPct`, `bottledL` → 204; `GET /api/brews` und
  `/brews/index.jsonl` tragen die drei neuen Felder, nach dem Neustart unverändert; `DELETE` räumt Datei und Indexzeile weg.
- **Nicht geprüft:** Die Sud-Sicherung (Export/Import) läuft im Browser aus diesen Routen (es gibt kein `/api/brews/backup`) und
  wurde nicht durchgeklickt; Gärverlauf mit echtem Log und Spindel; die Spalten im Tab „Sude“ und „Abgefüllt“ im Belegungsplan
  in der Oberfläche.

## 2026-10-16 — Verkostung: eigene Aroma-Begriffe

- **Entscheidung (Nutzer):** Die mitgelieferten Begriffe, Ursachen und Hinweistexte passen so; eigene Begriffe sollen möglich sein,
  zunächst nur für die Aromen (Geruch und Nachhall), abgelegt in der Verkostung selbst (keine Firmware-Änderung, keine
  gerätweite Liste). Fehlaromen und Textur bleiben fest.
- **Umsetzung:** Ein getipptes Wort steht als `~Wort` in `aroma.descriptors` bzw. `finish.aftertaste` (`brewTasting.ts`:
  `addCustom`, `customTerms`, `isCustom`, `customLabel`, höchstens 40 Zeichen, doppelte Wörter ohne Beachtung der Groß-/Kleinschreibung
  ignoriert). `TastingForm.tsx` zeigt unter den Aroma-Gruppen „Eigene Begriffe“ mit Eingabefeld (Enter oder „Hinzufügen“);
  Wörter aus den anderen Verkostungen desselben Suds erscheinen als Vorschlag zum Anklicken, in beiden Aroma-Listen. Abwählen
  nimmt ein Wort, das sonst nirgends vorkommt, wieder weg. Über Sude hinweg muss man ein Wort neu tippen.
- **Verifikation:** `pnpm typecheck`, `pnpm test` 738 grün (vier neue Tests). Im Browser gegen das LilyGo (`pnpm dev`, Sud #5):
  „Pfirsich“ eingeben, gewählt in Geruch, als nicht gewählter Vorschlag im Nachhall, `GET /api/brews/<id>/tasting` zeigt
  `["~Pfirsich"]`; die Test-Verkostung danach gelöscht. **Nicht aufgespielt:** Das UI-Tar liegt nicht auf dem Gerät.

## 2026-10-16 — Regler mit Kanal-ID als Eingang

- **Problem:** Regler fanden ihren Sensor nur über die nackte ID und lasen immer `channel(0)`. Ein BME280 regelte so immer auf `temp`;
  `bme.hum` oder `gyro.roll` waren kein möglicher Eingang, und das Formular (das nur `<id>.<key>` anbietet) fand die gespeicherte
  nackte ID nicht in der Auswahl.
- **Umsetzung:** Die vier Regler (`TwoPoint`, `PID`, `DualStage`, `SplitRangePID`) haben `setChannel(idx)` und lesen diesen Kanal;
  `paramsJson` meldet `sensor` als Snapshot-ID (`core/SensorRef.h`: `<id>.<key>`, bei leerem Key die nackte ID). Die Firmware löst
  `cfg.sensor` mit `resolveSensorChannel` (`SensorChannels.h`) auf: exakte ID zuerst, sonst Split am letzten Punkt und Key-Suche.
  `addControllerNoBegin` speichert die kanonische ID in `cfgJson`; eine nackte ID eines Mehrkanal-Sensors (z. B. `gyro`) wird damit
  beim Laden zu `gyro.pitch` und `loadFromSD` schreibt die Registry zurück. `referencedByController` und die 409-Sperre griffen
  für `<id>.<key>` schon. `openapi.yaml` und der Kommentar in `brewPrograms.ts` nachgezogen; das Web-Formular brauchte keine Änderung,
  weil die gespeicherte Konfiguration jetzt immer die ID aus `snap.sensors` trägt.
- **Verifikation:** `pio test -e native` SensActCtrl 372 (neu: `test_controller_channel`, `MockMultiSensor`), Firmware 204 (neu:
  Resolver und `sensorChannelRef` in `test_sensor_channels`), `pnpm typecheck`, `brewPrograms.test.ts`, Redocly-Lint.
  **Nicht am Gerät geprüft:** Regler auf `bme.hum`/`gyro.roll`, Migration eines vorhandenen Reglers auf `gyro`.
  Downgrade: Ältere Firmware kennt `<id>.<key>` bei Reglern nicht (`sensor not found`); vorher die Registry-Sicherung zurückspielen.

## 2026-10-16 — Alkohol im Sud: Speise und Verschnitt im Kessel

- **Problem:** `actualBeer` rechnete Balling aus Stammwürze der Anstellwürze und Restextrakt. Die Gärung einer Speise in der Flasche
  (etwa 0,4 % vol) blieb außen vor, und bei einem Verschnitt im Kessel ohne gemessene Anstell-Stammwürze war der Alkohol leer.
- **Umsetzung:** (1) Mit Speise ist der Alkohol der des fertigen Biers: Jungbier-Anteil, verdünnt um die Speise (Mengen aus
  `beerNow`, gemessen sonst geplant), plus `speiseAlcoholPct(Zielmenge, Temperatur)` in `brewMath.ts` aus dem CO₂, das die Speise
  machen muss (2 Ethanol : 2 CO₂, 46,07 : 44,01). Das gilt für Soll (`plannedBeer`) und Ist, damit beide vergleichbar bleiben;
  der Endvergärungsgrad bleibt der der Hauptgärung. Neues Feld `BrewTargets.speiseTargetVol` (nur bei Karbonisierung `speise`).
  (2) Bei Verschnitt im Kessel nimmt `actualBeer` ohne gemessene Anstellwürze die geplante Stammwürze (`estimated`).
  Die Zeile „Alkohol“ in der Bilanz (`BottlingTab`) nennt „mit Speise“ und „Stammwürze aus dem Plan“, der Fußtext ist angepasst;
  die Index-Zeile (`abvPct`) trägt den neuen Wert.
- **Verifikation:** `pnpm typecheck`, `pnpm test` 744 grün (neu: `speiseAlcoholPct`, Speise im Ist und Soll mit gemessenen Mengen,
  Verschnitt mit und ohne gemessene Anstellwürze). **Nicht im Browser geprüft:** kein Sud mit Speise und Verschnitt zur Hand, die
  Änderung an der Oberfläche ist nur die Zeilenunterschrift. Das Rezept (`calcStats`/Rezeptseite) zeigt weiter den Alkohol des
  Jungbiers ohne Speise.

## 2026-10-17 — Programmschritt: erst Regler, dann Aktoren

- **Problem:** Seit Regler ihre Aktoren mit aus- und einschalten, wendete `ProgramRunner` die Ziele eines Schritts in ihrer Reihenfolge
  an. Stand der Aktor eines Reglers mit `enabled:true` vor dem Regler mit `enabled:false`, schaltete der Regler ihn gleich wieder
  aus. Die generierten Maischprogramme (`brewPrograms.ts`) stellen den Regler voran und waren nicht betroffen.
- **Umsetzung:** `controllersFirst` (`ProgramTargets.h`, stabile Aufteilung, rein und nativ testbar) bringt die Regler-Befehle vor die
  der Aktoren, jede Gruppe in ihrer Reihenfolge. `ProgramRunner::applyStepTargets_` (Schritt betreten) und `applyState_`
  (Fortsetzen nach Neustart, „Zurück“) nutzen es; die Rampe (`ramped_`) bleibt je Befehl. Einzelne Befehle über `applyTarget`
  sind davon nicht berührt.
- **Verifikation:** `pio test -e native` 206 grün (zwei neue Tests für `controllersFirst`), `pio run -e esp32dev` erfolgreich.
- **Am LilyGo** (Firmware `017c474` per OTA): Testregler `ordertest` (Zweipunkt `HLT` → `agitator`, Sollwert 50) und Programm mit
  Schritt 1 „Regler an“ und Schritt 2 mit `agitator` **vor** `ordertest` (`enabled:false`). Zur Gegenprobe der Mechanismus per
  REST in der falschen Reihenfolge (Aktor an, danach Regler aus): `agitator enabled=false`. Das Programm dagegen: nach „Weiter“
  `agitator enabled=true`, Regler aus; nach „Zurück“ und erneut „Weiter“ dasselbe; nach einem Neustart im Schritt 2 (Fortsetzen über
  `applyState_`) läuft das Programm weiter, `agitator` an, Regler aus. Aufgeräumt: Programm gestoppt und gelöscht, Regler gelöscht,
  `agitator` wieder auf an, Sollwert 0,07, Intervall 4/5 s; Aktoren und Regler stimmen mit dem Stand vor dem Test überein
  (Sicherung im Scratchpad).

## 2026-10-17 — Einheiten im Eingabefeld (wie im Canvas-Mockup)

- **Problem:** Einheiten standen als „(l)“ im Label über dem Feld (Rezept, Sud, Sudhaus, Lager, Zutaten, Geräte-Dialoge) oder als Text
  neben dem Feld (Rechner, Ist-Mengen im Sud). Das Canvas-Mockup (`.ninp`) setzt sie ins Feld.
- **Umsetzung:** `unitBox`/`unitInput`/`unitText` in `ui.ts` (Rahmen mit Fokus-Unterstrich per `focus-within`, rahmenloses rechtsbündiges
  Input mit `tabular-nums`, Einheit grau rechts, Spinner aus), dazu `components/UnitBox.tsx`. `NumInput`/`OptNum`/`Override`
  (`recipe/fields.tsx`) haben `unit?`, ohne Einheit bleibt alles wie vorher. Umgestellt: `NumberField` (Rechner), `AmountInput`, alle
  Rezept-/Sudhaus-/Gärkeller-/Lager-Felder (rund 45 Labels, auch `%`, `°C`, `°P`, `l/kg`), `FieldInput` (Einheit aus `ingredientFields.ts`,
  bei „von–bis“ an beiden Feldern) sowie die zehn Felder mit fester Einheit in `AddItemModal` und `EnergyPage` (ms, s, Ω, kΩ).
  Felder mit wählbarer Einheit (`GravityInput`, Zykluslänge, Haltezeit) und Felder ohne Einheit blieben unverändert.
- **Verifikation:** `pnpm typecheck` sauber, `pnpm test` 744 grün; im Browser mit dem Node-Mock geprüft: Rezept Übersicht und Wasser,
  Sudhaus bearbeiten, Rechner Maischeeffizienz (dunkel). **Nicht angesehen:** hell, schmale Breite, Tabellenzellen (Aufbereitung), die
  Geräte-Dialoge und die übrigen Felder der Sud-Seiten.

## 2026-10-17 — Wassermenge und Abfüllmenge wie im Mockup

Darstellung der Karten „Wassermenge“ (Rezept › Wasser) und „Abfüllmenge“ (Rezept › Gärung) ans Canvas-Mockup angeglichen: Überschrift außerhalb der Karte (`Section`), größere Kennzahlen (`Stat large`), runder Balken mit Punkt-Legende, „Berechnung“ als Akkordeon-Leiste mit Tabelle (Vorgabe · Volumen · Grundlage, Zwischensummen hervorgehoben). Neue Datei `web/src/pages/recipe/CalcTable.tsx` (`Section`, `Row`, `CalcTable`); Eingaben und Rechnung unverändert (Nutzerentscheidung: nur Darstellung). `pnpm typecheck` sauber, `pnpm test` 744 grün. **Nicht im Browser angesehen** (hell/dunkel, 390 px).
