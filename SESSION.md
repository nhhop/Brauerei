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
