# Brauerei Session-Log

Chronologisches Log für SensActCtrl + BrewControl — seit 2026-08-31 konsolidiert
(vorher getrennte Logs pro Teilprojekt). Aktueller Status/Roadmap:
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
[PLAN.md](PLAN.md) → Architektur-Track). Details:
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
