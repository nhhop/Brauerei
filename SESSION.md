# Brauerei Session-Log

Chronologisches Log fÃ¼r SensActCtrl + BrewControl â€” seit 2026-08-31 konsolidiert
(vorher getrennte Logs pro Teilprojekt). Offene Punkte / Backlog:
[PLAN.md](PLAN.md). Volle Detail-Historie zu jedem Eintrag hier:
[SESSION-archive.md](SESSION-archive.md).

---

## 2026-05-16 â€“ 2026-06-03 â€” SensActCtrl: Phase 1â€“3 Aufbau

Greenfield-Aufbau der Library: Core-Abstraktionen, lokale Sensoren/Aktoren,
TwoPoint-/PID-Regler, MQTT/ESP-NOW/Webhook-Transport, Remote-Wrapper,
Registry-JSON-Snapshot. Danach Multi-Channel-Interface, weitere
Sensoren/Aktoren, `fault()`/`enabled()`, Dual-Output-Regler, geteilte
`PidEngine`. Details: [SESSION-archive.md](SESSION-archive.md).

## 2026-05-17 â€“ 2026-05-20 â€” BrewControl: Pre-MVP (Planung, Implementierung, erste E2E-Tests)

Web-UI-Projekt von Grund auf geplant und in 11 Build-Schritten umgesetzt
(Firmware, WiFi-Setup-Portal, WebUI-Klasse, Vite/Preact-Frontend), E2E auf
LOLIN S2 Mini und LilyGo T-Display-S3-AMOLED verifiziert, QEMU-Machbarkeit
geprÃ¼ft und verworfen, WiFi-Reset zur Laufzeit + Runtime-Item-Add/Remove +
Bus-Discovery ergÃ¤nzt. Details: [SESSION-archive.md](SESSION-archive.md).

## 2026-05-18 â€” Monorepo-Setup

git-Repo zusammengefÃ¼hrt, Root-CLAUDE.md/PLAN.md/SESSION.md angelegt.
Details: [SESSION-archive.md](SESSION-archive.md).

## 2026-05-20 â€” Bus-Discovery-Feature (OneWire/DS18B20)

`GET /api/bus/scan` + Scan-UI im AddItemModal fÃ¼r mehrere DS18B20 an einem
Pin. Details: [SESSION-archive.md](SESSION-archive.md).

## 2026-05-20 â€” Playwright/Edge-Setup fÃ¼r Browser-UI-Tests

Playwright-MCP auf Edge umgestellt (kein Chrome installiert); erster
Browser-UI-Testlauf gegen das Bus-Discovery-Feature. Details:
[SESSION-archive.md](SESSION-archive.md).

## 2026-05-21 â€” MAX31865-Sensor + AddItemModal-Redesign

Neuer PT100/PT1000-SPI-Sensor in der Library; AddItemModal auf gruppiertes
Dropdown umgebaut. Details: [SESSION-archive.md](SESSION-archive.md).

## 2026-05-21/22 â€” Multi-Channel-Sensor-Interface + YF-S201

Breaking Change: `Sensor`-API von `meta()`/`lastReading()` auf
`channelCount()`/`channel()` umgestellt; neuer Durchfluss-Sensor mit 2
KanÃ¤len. Details: [SESSION-archive.md](SESSION-archive.md).

## 2026-05-22/23 â€” IDS-Induktionskocher als Aktor

`IdsActuator` (IDS1/IDS2) + `fault()`-Interface auf Sensor-/Actuator-
Basisklassen. Details: [SESSION-archive.md](SESSION-archive.md).

## 2026-05-29 â€” RemotePublisher Multi-Channel + konfigurierbares Topic-Prefix

Bisher publizierte `RemotePublisher` nur Kanal 0; jetzt alle KanÃ¤le + frei
wÃ¤hlbares Topic-Prefix. Details: [SESSION-archive.md](SESSION-archive.md).

## 2026-05-30 â€” AnalogOutputActuator + HX711LoadCellSensor + Roadmap

Neuer PWM/DAC-Aktor und WÃ¤gezellen-Sensor; Roadmap-EintrÃ¤ge Peripherie-
Abstraktion/Pin-Manager/LVGL-Display aufgenommen (jetzt in
[PLAN.md](PLAN.md) â†’ GrÃ¶ÃŸere Brocken). Details:
[SESSION-archive.md](SESSION-archive.md).

## 2026-05-30 â€” DS18B20-Praxistest + Scan-Konflikt-Fix + DAC-Guard

Erster Live-Sensor-Test; Bus-Scan-Konflikt mit aktiver OneWire-Instanz
gefixt; DAC-Downgrade auf ESP32-S2/S3 ohne DAC-Peripherie. Details:
[SESSION-archive.md](SESSION-archive.md).

## 2026-05-30 â€” UI: Edit-Funktion, ControllerCard, TwoPoint-Regler, Enable/Disable, Demo-Items entfernt

Bearbeiten via Delete+POST, Ist-Wert/Ausgang auf der ControllerCard,
Zweipunktregler, Controller-Enable/Disable, hardcodierte Demo-Items aus
`main.cpp` entfernt. Details: [SESSION-archive.md](SESSION-archive.md).

## 2026-05-30 â€” Fix: WebUI-Handler-Reihenfolge (Aktor-Write-Bug)

`POST /api/actuators/:id` lieferte 400, weil ein breiterer Handler zuerst
matchte â€” Registrierungsreihenfolge korrigiert. Details:
[SESSION-archive.md](SESSION-archive.md).

## 2026-05-31 â€” Multi-Dashboard-Feature + Settings-Tab

Benutzerdefinierte Dashboard-Tabs mit SD-Persistenz, `+ HinzufÃ¼gen` in
eigenen âš™-Tab verschoben. Details: [SESSION-archive.md](SESSION-archive.md).

## 2026-06-01 â€” Appearance-Settings: Design/Theme-Feature

CSS-Token-System (hell/dunkel/System, Akzentfarbe), `SettingsStore`,
Settings-Hub mit Unterseiten. Details: [SESSION-archive.md](SESSION-archive.md).

## 2026-06-01 â€” Routing-Refactor + UI-Verbesserungen

`preact-router`, Code-Aufteilung in `src/pages/`, â€žÃ— entfernt" statt
lÃ¶scht auf dem Dashboard. Details: [SESSION-archive.md](SESSION-archive.md).

## 2026-06-02 â€” GÃ¤rsteuerung: Dual-Output-Regler (Heizen + KÃ¼hlen)

`DualStageController` + `SplitRangePIDController` (1 Sensor â†’ 2 Aktoren) in
der Library, UI-Formulare in BrewControl. Danach: Regler-Typ-Dropdown
gruppiert, PID-AutoTune Ã¼ber Web, AutoTune auch fÃ¼r SplitRangePID (geteilte
`PidEngine`). Details: [SESSION-archive.md](SESSION-archive.md).

## 2026-06-03 â€” PIN-Invertierung

`invert`/`activeHigh` fÃ¼r DigitalInput/DigitalOutput end-to-end. Details:
[SESSION-archive.md](SESSION-archive.md).

## 2026-06-03 â€” BrewControl: OTA-Firmware-Update

Vier Update-Wege (Server-Pull/GitHub, Browser-Upload, SD-Boot-Flash-
Recovery, USB), CI-Matrix baut alle Board-Varianten, HW-E2E auf LilyGo S3
verifiziert. Details: [SESSION-archive.md](SESSION-archive.md).

## 2026-06-04 â€” BrewControl: Backup & Restore

`GET/POST /api/backup` bÃ¼ndelt die drei Config-Dateien, Restore =
Validieren + Verbatim-Schreiben + Reboot. Details:
[SESSION-archive.md](SESSION-archive.md).

## 2026-06-05 â€” Zeit & Formate (NTP + Zeitzone + Formateinstellungen)

NTP-Sync, konfigurierbare Zeitzone/Zeit-/Datumsformat, `serverTime` im
SSE-Snapshot. Details: [SESSION-archive.md](SESSION-archive.md).

## 2026-06-05 â€” BrewControl: SD-Boot-Firmware-Flash (Recovery) + UI-Fixes PID-Dashboard

Vierter OTA-Weg ohne WiFi (`/firmware.bin` im SD-Root); plus vier
zusammenhÃ¤ngende UI-Fixes an ControllerCard/AddItemModal (Aktor-Reset beim
Ausschalten, Setpoint nur im Dashboard, AutoTune in Settings verschoben,
AutoTune-Status). Details: [SESSION-archive.md](SESSION-archive.md).

## 2026-06-06/07 â€” BrewControl: Datenlogging & Trend-Charts

`LogStore` sampelt Serien in CSV-Sessions, Online-Kompression
(Linear/Swinging-Door), uPlot-Charts, Archiv-Seite, Retention. HW-E2E +
Playwright-UI-Tests grÃ¼n; dabei ein Cross-Task-Race auf `logs_` gefunden und
per rekursivem Mutex gefixt, plus vier vom User gemeldete Chart-Bugs
(Zeitformat, Live-Werte, Logging-Pause-Marker, interpolierte Hover-Werte).
Details: [SESSION-archive.md](SESSION-archive.md).

## 2026-06-07 â€” BrewControl: Netzwerk/WLAN-Einstellungen (STA-Teil)

`/settings/network` (Status/Scan/WLAN-wechseln/mDNS-Hostname); Scan brach
anfangs die WLAN-Verbindung ab â†’ WLAN-Watchdog + kÃ¼rzere Scan-Dwell +
resilienter Frontend-Poll. Details: [SESSION-archive.md](SESSION-archive.md).

## 2026-06-08 â€” Sollwert-Programme / Maischeprofile

`ProgramRunner` treibt zeitgesteuerte Setpoint-Schritte mit Reboot-Resume
Ã¼ber Wall-Clock-Epoch; Dashboard-Widget mit Start/Pause/Stop/Weiter/ZurÃ¼ck.
Details: [SESSION-archive.md](SESSION-archive.md).

## 2026-07-10 â€” BrewControl: Fluent/WinUI-3-Redesign (Runde 1+2)

NavShell, Fluent-Design-Tokens, Akzentfarbe als Steuerfarbe, WinUI-Controls,
ContentDialog-Footer. Details: [SESSION-archive.md](SESSION-archive.md).

## 2026-07-11 â€” BrewControl: Dashboard-Layout (Programm-Sidebar + Compact/Sticky-Widget)

Programm-Sidebar links, rechter Scroll-Bereich, mobiles Accordion. Details:
[SESSION-archive.md](SESSION-archive.md).

## 2026-07-13 â€” BrewControl: Dashboard-Edit-Modus

Getrennte ZustÃ¤ndigkeiten: Edit-Modus-Toggle, Tab-Name-Modal, Inhalte-
Checkbox-Modal. Details: [SESSION-archive.md](SESSION-archive.md).

## 2026-07-13 â€“ 2026-07-25 â€” BrewControl: WinUI-3-Politur Teil 1â€“5

FÃ¼nfteilige Konsistenz-Runde: semantisches Farbsystem, neutrale Palette +
Mica-Shell + Win11-Settings, Fluent-2-Karten-Tokens, Firmware-Seite, Icons +
Control-Positionen auf allen Settings-Seiten. Details:
[SESSION-archive.md](SESSION-archive.md).

## 2026-07-25 â€” BrewControl: Netzwerk-Seite â€” mDNS-Kartenlayout + Netzwerk-Liste

Nutzer-Mockup umgesetzt: mDNS-Karte neu, WLAN-Auswahl als anklickbare Liste
statt Dropdown, mehrere Feinschliff-NachtrÃ¤ge. Details:
[SESSION-archive.md](SESSION-archive.md).

## 2026-08-11 â€” BrewControl: Kleinere UI-Fixes + einheitliche Dashboard-Karten-HÃ¶he

Fehlende Untertitel (Zeit & Formate), EinrÃ¼ckung (Firmware-Update),
Kartenabstand (Settings-Ãœbersicht); Sensor-/Aktor-/Regler-Karten auf
einheitliche MindesthÃ¶he. Details: [SESSION-archive.md](SESSION-archive.md).

## 2026-08-12 â€” Sollwert-Ratenbegrenzung (RateLimitedController-Decorator)

Neuer Decorator begrenzt die Sollwert-Ã„nderungsrate (Â°/min), typ-unabhÃ¤ngig
im UI. Details: [SESSION-archive.md](SESSION-archive.md).

## 2026-08-13 â€“ 2026-08-19 â€” Aktor-Master-Schalter (mehrere Design-Iterationen)

Erst `EnableGuardActuator`-Decorator, dann bug-getriebene Iterationen (Ziel-
vs-Ist-Wert, Re-Enable-Latenz) â€” am Ende auf Nutzerwunsch ersatzlos in
konkreten State auf der `Actuator`-Basisklasse verlegt (analog
`Controller`), jede Aktor-Klasse gated ihren eigenen Ausgang selbst.
`target()` (Sollwert) ergÃ¤nzt `state()` (Ist-Wert). Details:
[SESSION-archive.md](SESSION-archive.md).

## 2026-08-14 â€” Aktor-Intervallbetrieb (IntervalActuator-Decorator) + Fix: GPIO/LEDC-Leak

Konfigurierbare Ein/Aus-Taktung fÃ¼r alle Aktor-Arten; danach Fix fÃ¼r einen
beim LÃ¶schen nicht freigegebenen LEDC-Pin (fehlendes `end()`). Details:
[SESSION-archive.md](SESSION-archive.md).

## 2026-08-19 â€” BrewControl: MQTT-Einstellungen (extern + embedded Broker)

Externer Broker Ã¼ber `MqttTransport`, embedded Broker via `TinyMqtt` (mit
Build-Zeit-Auth-Patch), Live-Tracking von Add/Remove Ã¼ber neues
`RemotePublisher::detach()`. Nebenbefund: SD-Concurrency-Bug
(`loopTask`/`async_tcp` unsynchronisiert auf SD) gefunden und per globalem
Mutex gefixt. Details: [SESSION-archive.md](SESSION-archive.md).

## 2026-08-20 â€” BrewControl: MQTT Live-Tracking-Fixes + Verbindungsstatus im UI

Embedded Broker konnte anfangs nicht selbst publizieren (WiFiClient-
Loopback-Problem) â†’ gelÃ¶st Ã¼ber TinyMqtts nativen In-Process-Client;
externer Broker gegen echtes Mosquitto (Auth/TLS) verifiziert;
Verbindungsstatus + Fehlertext in der UI ergÃ¤nzt; Topic-Prefix/Client-ID
editierbar gemacht. Details: [SESSION-archive.md](SESSION-archive.md).

## 2026-08-21 â€” Generischer MQTT-Aktor + -Sensor

Frei konfigurierbarer Topic + Payload-Template/JSON-Feld-Extraktion fÃ¼r
FremdgerÃ¤te (Sonoff/Tasmota-artig), unabhÃ¤ngig von SensActCtrls eigenem
device/id-Schema. Details: [SESSION-archive.md](SESSION-archive.md).

## 2026-08-21 â€” Kabellose SensActCtrl-Knoten Ã¼ber die Web-UI (MQTT + Webhook + ESP-NOW)

Echte Node-zu-Node-Anbindung Ã¼ber die bereits vorhandenen
`RemoteSensor`/`RemoteActuator`/`RemotePublisher`: `type:"Remote"` in
`DynamicItems`/`AddItemModal`, der Reihe nach fÃ¼r alle drei Transporte
umgesetzt und HW-verifiziert (inkl. Fix in
`EspNowTransport::initEspNow_()`, damit ESP-NOW BrewControls eigenes WLAN
nicht mehr kappt). Details: [SESSION-archive.md](SESSION-archive.md).

## 2026-08-21 â€” BrewControl: SD-Dateiverwaltung

Browse/Upload/Download/LÃ¶schen/Umbenennen auf der SD-Karte, `/www`/`/www.new`
geschÃ¼tzt. Details: [SESSION-archive.md](SESSION-archive.md).

## 2026-08-28 â€” BrewControl: LittleFS-Support fÃ¼r esp32dev/lolin_s2_mini

UI + Persistenz auf internem Flash statt SD fÃ¼r die beiden Boards ohne
SD-Slot; neue Partitionstabelle, HW-verifiziert auf beiden Boards. Details:
[SESSION-archive.md](SESSION-archive.md).

## 2026-08-29 â€” Fix: Eingebauter MQTT-Broker verwarf Retained-Messages

`retain_size=0` (Default) hielt keine einzige Retained-Message vor â†’
Consumer bekamen nie Meta von einem echten zweiten Board. Fix:
`retain_size=64`. Erster echter Zwei-Board-MQTT-Test (State **und** Meta)
grÃ¼n. Details: [SESSION-archive.md](SESSION-archive.md).

## 2026-08-29 â€” Feature: Publish-Pfad fÃ¼r Webhook + ESP-NOW (symmetrisch zu MqttService)

BrewControl konnte die eigene Registry bisher nur Ã¼ber MQTT nach auÃŸen
anbieten â€” `WebhookService` um Publish erweitert, neue
`EspNowPublishService`, neue Settings-Seiten. Zwei-Board-HW-Tests fÃ¼r beide
Transporte grÃ¼n (inkl. Negativtest: unerreichbarer Webhook-Peer blockiert
`loop()`). Details: [SESSION-archive.md](SESSION-archive.md).

## 2026-08-29 â€” Fix: Webhook-Publish blockiert `loop()` nicht mehr unbegrenzt + `lastErrorMessage()` fÃ¼r Webhook/ESP-NOW

Timeout (800ms) + Backoff (5s) statt unbegrenztem Block bei unerreichbarem
Peer; beide Transporte melden jetzt einen Klartext-Fehler statt immer `""`.
Details: [SESSION-archive.md](SESSION-archive.md).

## 2026-08-31 â€” Fix: ESP-NOW Meta an spÃ¤t hinzugefÃ¼gte Consumer

Ein spÃ¤t angelegter `Remote`-Sensor bekam Ã¼ber ESP-NOW nie Meta (nur
State) â€” Throttle im Retained-Request unterdrÃ¼ckte den Request statt ihn
nachzuholen. Gefixt + Ã¼ber zwei physische Boards verifiziert. Details:
[SESSION-archive.md](SESSION-archive.md).

## 2026-08-31 â€” Feature: mDNS-Hostname bereits im Setup-Portal

Hostname jetzt schon im AP-Mode-Portal vergebbar (verhindert
Namenskonflikte beim parallelen Einrichten mehrerer Boards), Erfolgsseite
mit Link + Best-Effort-Auto-Redirect-Countdown. Details:
[SESSION-archive.md](SESSION-archive.md).

## 2026-08-31 â€” Fix: Direkte URLs zu Unterseiten lieferten weiÃŸe Seite + Feature: ESP-NOW-Icon

`vite.config.ts` `base: './'` â†’ `base: '/'` (relative Asset-Pfade brechen
auf verschachtelten Client-Routen); ESP-NOW-Icon auf `SiEspressif`
(react-icons) umgestellt. Details: [SESSION-archive.md](SESSION-archive.md).

## 2026-08-31 â€” Doku-Konsolidierung: ein PLAN.md + ein SESSION.md fÃ¼rs ganze Monorepo

Drei getrennte PLAN.md/SESSION.md-Paare (Root, SensActCtrl, BrewControl) +
eine BrewControl-eigene SESSION-archive.md auf dieses Root-Paar
konsolidiert (Grund: die beiden Teilprojekte werden nicht mehr unabhÃ¤ngig
geplant). GrundsÃ¤tzliche, fÃ¼rs VerstÃ¤ndnis nÃ¶tige Architektur-/API-Referenz
wandert aus den alten PLAN.md-Dokumenten in die jeweilige `README.md`
(SensActCtrl behÃ¤lt dafÃ¼r seinen Standalone-Publish-Anspruch). Dabei auch:
Root-`PLAN.md`-Eintrag â€žKabellose SensActCtrl-Knoten" nachtrÃ¤glich als
erledigt markiert (war fÃ¤lschlich noch offen, obwohl seit 2026-08-21
komplett umgesetzt), plus vier bis dahin nirgends nachgetragene
Bekannte-Probleme-EintrÃ¤ge ergÃ¤nzt (verschwundener Test-Sensor `sdfswdf`,
Bus-Scan-UX-Feedback, LittleFS-Boards ohne SD-Boot-Flash/Log-Retention,
GPIO/LEDC-Leak-Fix-Nachtest).

## 2026-09-01 â€” AufrÃ¤umen: gemergte Branches/Worktree entfernt + Doku-Punkt geschlossen

Nach `git fetch --prune`: `docs/consolidate-plan-session` (PR #18),
`feat/sd-file-manager`, `claude/distracted-rubin-a1e377` waren gemergt und
remote gelÃ¶scht â€” lokale Branches + der Worktree
`.claude/worktrees/distracted-rubin-a1e377` entfernt. Offen bleibt nur
`feat/winui-design` (1 obsoleter Commit voraus / 37 hinter).
Bekannte-Probleme-Eintrag â€žTest-Sensor `sdfswdf` spurlos verschwunden"
gestrichen â€” nie reproduziert, Sensor manuell gelÃ¶scht.

## 2026-09-01 â€” HW-E2E: SD-Boot-Flash-Recovery (`FirmwareUpdater::flashFromSdImage()`)

Der seit 2026-06-05 nur build-verifizierte Recovery-Pfad (SD-Root
`/firmware.bin` wird beim Boot vor WiFi geflasht, dann gelÃ¶scht) am GerÃ¤t
verifiziert â€” komplett host-getrieben gegen die LilyGo T-Display-S3-AMOLED
(`192.168.178.87`), kein SD-Kartenausbau:

1. `firmware.bin` mit `BREWCTL_VERSION_OVERRIDE=sdflash-e2e` gebaut
   (1.319.744 B), per `POST /api/files/upload?path=/` auf den SD-Root.
2. Reboot via `POST /api/network {"hostname":"brewcontrol"}` (kein
   WLAN-Eingriff).
3. Nach ~15 s zurÃ¼ck: `GET /api/update/status` â†’ `currentVersion` von
   `d6ccb81-dirty` auf `sdflash-e2e` gewechselt (= SD-Image ist die
   laufende Firmware), `firmware.bin` vom SD-Root verschwunden
   (SelbstlÃ¶schung nach erfolgreichem `Update.end`), Snapshot/WiFi/Config
   unverÃ¤ndert.
4. Restore: sauberes `firmware.bin` (ohne Override, `70faca4-dirty`)
   Ã¼ber denselben SD-Weg zurÃ¼ckgeflasht â€” zweiter erfolgreicher Durchlauf.

**Nebenbefund (â†’ PLAN.md Bekannte EinschrÃ¤nkungen):** Der erste
Restore-Upload landete truncated auf der SD (618.496 statt 1.319.744 B),
Handler meldete trotzdem `200 ok` â€” `POST /api/files/upload` ignoriert die
`File::write()`-RÃ¼ckgabe. `flashFromSdImage()` verhielt sich dabei korrekt:
`Update.end(true)` wies das unvollstÃ¤ndige Image ab, das Board bootete die
vorhandene Firmware weiter, die kaputte Datei blieb liegen (kein
Reflash-Loop). Nach LÃ¶schen + Re-Upload (mit GrÃ¶ÃŸencheck + Retry-Schleife)
lief der Restore sauber durch.

## 2026-09-01 â€” PLAN.md umstrukturiert: nur noch Offenes

Der User fand PLAN.md unÃ¼bersichtlich (erledigter Status, durchgestrichene
Roadmap-Punkte und offene EinschrÃ¤nkungen gemischt). PLAN.md enthÃ¤lt jetzt
ausschlieÃŸlich Offenes:

- **Entfernt:** â€žAktueller Status"-Block (alle erledigten SensActCtrl-/
  BrewControl-Arbeiten â€” Historie steht chronologisch hier + in
  SESSION-archive.md), Architektur-Diagramm, Technologie-Stack, Boards-
  Tabelle (Referenz lebt in den READMEs), alle `~~â€¦~~ âœ“ erledigt`-EintrÃ¤ge
  aus der Roadmap und alle `âœ“`-Zeilen aus â€žBekannte EinschrÃ¤nkungen".
- **Behalten/neu gegliedert:** kurzes Intro â†’ â€žBugs & bekannte
  EinschrÃ¤nkungen" â†’ â€žHardware-Verifikation offen" â†’ â€žBacklog" (flache,
  grob priorisierte Liste, AbhÃ¤ngigkeiten inline; die bisherigen
  *SpÃ¤ter:*-Vormerkungen als eigenstÃ¤ndige EintrÃ¤ge) â†’ â€žGrÃ¶ÃŸere Brocken
  (eigene Spec vor Umsetzung)" (Peripherie-Abstraktion, Pin-Manager,
  LVGL-Display, HTTPS-Support) â†’ â€žBuckets".
- **Verworfen:** die alte Zweiteilung Architektur-Track / Feature-Track
  (+ Wellen 1/2/3) â€” die Achse trug nicht (LVGL-Display ist ein Feature,
  kein RÃ¼ckgrat; von jeder Welle war das meiste erledigt). Ersetzt durch
  eine flache Backlog-Liste + separate â€žGrÃ¶ÃŸere Brocken".
- **Regel geÃ¤ndert:** Ein umgesetzter PLAN.md-Punkt wird kÃ¼nftig ersatzlos
  entfernt (kein `~~erledigt~~`, keine Pointer-Zeile) â€” Historie nur in
  SESSION.md. Nachgezogen in Root-`CLAUDE.md` â†’ Dokumentation und
  `BrewControl/CLAUDE.md` â†’ Arbeitsregeln.

## 2026-09-01 â€” API-Vertrag nach `BrewControl/docs/openapi.yaml` Ã¼berfÃ¼hrt

**Anlass:** Der â€žAPI-Vertrag"-Abschnitt in `BrewControl/README.md` dokumentierte
14 Endpoints, die Firmware registriert 41. Komplett undokumentiert waren
Data-Logs, Sollwert-Programme, Settings, Dashboards, SD-Dateimanager,
Backup/Restore, Firmware-Update-Status/Check/Install und Netzwerk. Dazu waren
Details falsch: die Delete-Routen der Dynamic Items antworten `405` (nicht `404`
wie behauptet), Erfolg ist durchgÃ¤ngig `204` statt `200`, Fehler-Bodies sind
`text/plain` statt JSON. `BrewControl/CLAUDE.md` fÃ¼hrte eine zweite, noch
kÃ¼rzere und ebenfalls veraltete Tabelle.

**Umsetzung:**

- **Neu: `BrewControl/docs/openapi.yaml`** (OpenAPI 3.1) â€” alle 41 Routen mit
  Query-/Path-Parametern, Request-Bodies, Status-Codes, den wÃ¶rtlichen
  `text/plain`-Fehlermeldungen aus dem Code und vollstÃ¤ndigen Schemas.
  Inhalt ausschlieÃŸlich aus dem Code abgeleitet (`WebUI.cpp`,
  `RegistrySnapshot.cpp`, `DynamicItems.cpp`, `LogStore.cpp`,
  `ProgramRunner.cpp`, `SettingsStore.cpp`, `DashboardStore.cpp`,
  `FirmwareUpdater.cpp`), nicht aus der alten Doku. Beschreibungen auf
  Englisch (codenahes, maschinenlesbares Artefakt); README/PLAN/SESSION bleiben
  Deutsch. Explizit festgehalten: die vier Endpoints mit Reboot ~500 ms nach der
  Antwort, das SSE-Event `snapshot`, die snake_case-Anlege-Configs vs. die
  camelCase-Runtime-Params der Regler, und dass es keine Authentifizierung gibt.
  Bewusst *nicht* in der Spec: WiFi-Setup-Portal (eigener Server) sowie
  Static-Serving/SPA-Fallback.
- **Neu: `BrewControl/docs/redocly.yaml`** â€” Lint-Config; schaltet
  `security-defined` (es gibt keine Auth) und `operation-4xx-response` (mehrere
  Endpoints haben keinen Client-Fehlerpfad) ab.
- **`README.md`:** â€žAPI-Vertrag" auf eine Ãœbersichtstabelle reduziert (eine
  Zeile pro Route: Endpoint / Methode / Zweck) plus Verweis auf die YAML â€”
  keine Bodies und Status-Codes mehr, die driften sonst wieder. Erhaltene
  Prosa: DS18B20-Multi-Sensor-Hinweis, Snapshot-Shape-Verweis, Persistenz.
  Dabei zwei Ungenauigkeiten korrigiert: `/config/registry.json` liegt auf SD
  *oder* LittleFS (nicht â€žauf der SD-Karte"), und der Multipart-Feldname `f` in
  den `curl`-Beispielen ist beliebig â€” die Firmware wertet ihn nicht aus.
- **`BrewControl/CLAUDE.md`:** stale Mini-Tabelle raus, Verweis auf die YAML
  rein (inkl. Korrektur `RegistrySnapshot.h` â†’ `.cpp`); neue Arbeitsregel:
  Routen-Ã„nderungen in `WebUI.cpp` im selben Commit in `openapi.yaml`
  nachziehen. Root-`CLAUDE.md` â†’ Dokumentation um die Datei ergÃ¤nzt.

**Verifikation:** `npx @redocly/cli lint --config BrewControl/docs/redocly.yaml
BrewControl/docs/openapi.yaml` â†’ valide (1 Warning: kein `license`-Feld).
Routen-Abdeckung per Skript geprÃ¼ft: alle 41 `server_.on`/`addHandler`-
Registrierungen aus `WebUI.cpp` haben ein GegenstÃ¼ck in `paths:`, keine
verwaisten Pfade. Stichproben gegen den LilyGo S3 (192.168.178.87):
`/api/settings` liefert alle sechs Sektionen inkl. der live gespliceten
`connected`/`error`-Felder, `/api/update/status` matcht das Schema inkl.
`available: null`, `/api/network/scan` antwortet `202`. Die
`/api/files`-Stichproben liefen ins Leere, weil auf dem Board gerade keine
SD-Karte gemountet ist (`GET /` â†’ 501, jeder Pfad â€žnot a directory") â€” kein
Spec-Befund.

**Nebenbefunde** (dokumentiert, nicht gefixt â€” jetzt in PLAN.md â†’ â€žBugs &
bekannte EinschrÃ¤nkungen"): `types.ts` weicht an drei Stellen von der Wire-Form
ab (`ProgramConfig.stepStartedEpoch`/`elapsedAtPauseSec` fehlen,
`DashboardConfig.charts`/`.programs` und die fÃ¼nf optionalen `AppSettings`-
Sektionen sind zu lose deklariert); die Create-Endpoints akzeptieren
bibliotheksbedingt auch GET/PUT/PATCH; `GET /api/settings` gibt
`mqtt.password` im Klartext zurÃ¼ck; `GET /api/snapshot` antwortet bei
Puffer-Ãœberlauf mit einem leeren `200` statt einem Fehler.

## 2026-09-01 â€” Fix: `POST /api/files/upload` erkennt Short-Writes

**Root Cause:** Der Upload-Callback schrieb Chunks mit
`fileUpload_.write(data, len)` und ignorierte den RÃ¼ckgabewert. Bei einem
Short-Write auf die SD-Karte (volles Medium, I/O-Fehler) wurde die Datei still
abgeschnitten, der Handler antwortete trotzdem `200 ok`. Beim
SD-Boot-Flash-HW-E2E am 2026-09-01 einmal getroffen: 1.319.744-B-`firmware.bin`
landete als 618.496 B auf dem SD-Root, Antwort `ok`.

**Umsetzung** (`BrewControl/firmware/src/WebUI.cpp`, analog zum bestehenden
`fileUploadRejected_`-Pfad im selben Handler und zum Fehlerpfad von
`/api/update/firmware` / `/api/update/assets`): RÃ¼ckgabewert von `write()`
gegen `len` prÃ¼fen; bei Abweichung Datei schlieÃŸen, die Teildatei per
`fs_.remove()` entfernen, `fileUploadRejected_` setzen und
`500 "write failed â€” partial file removed"` senden. Der Zielpfad wird dafÃ¼r in
`WebUI::fileUploadPath_` gehalten (neu). `openapi.yaml`: Known-Issue-Notiz
entfernt, `500`-Response um den neuen Body ergÃ¤nzt.

**Verifikation:** `pio run -e lilygo_t_display_s3_amoled` grÃ¼n.
`npx @redocly/cli lint` weiterhin valide (nur die bekannte `license`-Warnung).
HW-E2E am LilyGo S3 (`192.168.178.87`, Firmware `2d429cd` per USB/COM9 geflasht)
am 2026-09-01 nachgeholt: (1) Happy Path auf der regulÃ¤ren Karte â€” 405 KB
hochgeladen, `200 ok`, SHA256 nach Download-Roundtrip identisch. (2) Overflow â€”
kleine FAT32-Karte manuell auf 256 KB frei befÃ¼llt, 2-MB-Upload â†’ `500 "write
failed â€” partial file removed"`, `/api/files`-Listing zeigt keine Teildatei.
(3) Recovery â€” 100-KB-Datei danach wieder sauber `200 ok`, SHA256 identisch.

## 2026-09-01 â€” `web/src/types.ts` mit der Wire-Form synchronisiert

Erster der beim OpenAPI-Abgleich gefundenen Nebenbefunde geschlossen. Die drei
Firmware-Serializer als Referenz:

- `ProgramRunner::serialize()` emittiert `stepStartedEpoch` und
  `elapsedAtPauseSec` immer (persistierter Laufzeitstand) â†’ in `ProgramConfig`
  als Pflichtfelder ergÃ¤nzt.
- `DashboardStore::serialize()` schreibt `charts` und `programs` immer als Array
  (ggf. leer) â†’ `DashboardConfig.charts`/`.programs` von `?:` auf Pflicht.
- `SettingsStore::serialize()` liefert immer alle sechs Sektionen â†’ in
  `AppSettings` `firmware`/`time`/`mqtt`/`webhook`/`espnow` von `?:` auf Pflicht,
  ebenso `MqttSettings.embeddedBrokerSupported` (wird immer gesetzt).
  Der Patch-Pfad ist unberÃ¼hrt (`updateSettings(patch: Partial<AppSettings>)`).

Rein Typen-eng/-losigkeit, kein Laufzeitverhalten. Verifikation:
`pnpm typecheck` grÃ¼n, keine Konsumenten betroffen.

## 2026-09-01 â€” Fix: `GET /api/snapshot` bei Puffer-Ãœberlauf â†’ `503`

**Root Cause:** `serializeRegistry()` gibt `0` zurÃ¼ck, wenn die Registry
`kSnapshotCap` (4160 B) sprengt, und lÃ¤sst den Puffer unangetastet. `makeSnapshot()`
reichte in dem Fall einen nicht-null Puffer mit `n=0` zurÃ¼ck; der `/api/snapshot`-
Handler prÃ¼fte nur `!buf` und schickte `200` mit leerem Body. Die beiden SSE-Pfade
(`pushSnapshot_`/`sendSnapshotTo_`) hÃ¤tten sogar den uninitialisierten Puffer als
C-String verschickt.

**Umsetzung** (`BrewControl/firmware/src/WebUI.cpp`): `makeSnapshot()` gibt bei
`n == 0` jetzt `nullptr` zurÃ¼ck â€” dieselbe Fehlersignalisierung wie bei OOM, die
alle drei Aufrufer bereits korrekt behandeln (Handler â†’ `503`, SSE-Pfade â†’
Tick Ã¼berspringen). Handler-Body von `OOM` auf `snapshot unavailable`
umbenannt (deckt beide Ursachen ab). `openapi.yaml`: `503`-Response und
Beschreibung entsprechend aktualisiert, Known-Issue-Hinweis raus.

**Verifikation:** `pio run -e lilygo_t_display_s3_amoled` grÃ¼n, `redocly lint`
valide. HW-E2E am LilyGo S3 (`192.168.178.87`, Firmware aus diesem Stand per
USB/COM9): 23 DigitalInput-Sensoren zur Laufzeit angelegt, ab Sensor #23 (Snapshot
> 4160 B) antwortet `GET /api/snapshot` mit `503 "snapshot unavailable"` statt
leerem `200`; SSE-Stream im Normalfall unverÃ¤ndert. Testsensoren wieder gelÃ¶scht,
Snapshot zurÃ¼ck auf `200` / 1219 B.

## 2026-09-01 â€” Fix: `mqtt.password` als Write-only-Feld

**Root Cause:** Die gesamte API ist unauthentifiziert; `GET /api/settings` gab
das gespeicherte MQTT-Passwort im Klartext zurÃ¼ck (sichtbar in Browser-DevTools,
Screenshots, evtl. Logs).

**Umsetzung:**
- `WebUI.cpp` (`GET /api/settings`): `mqtt.password` wird vor dem Senden immer
  auf `""` Ã¼berschrieben, zusÃ¤tzlich `mqtt.passwordSet` (bool) eingespliced.
- `SettingsStore::update()`: leerer/fehlender `mqtt.password` lÃ¤sst das
  gespeicherte Passwort unverÃ¤ndert; expliziter JSON-`null` lÃ¶scht es. Nicht-
  leerer String setzt es. `serialize()`/`saveToSD()` unverÃ¤ndert â€” auf Flash und
  im Backup-Bundle liegt das Passwort weiterhin im Klartext (Restore braucht es).
- `MqttPage.tsx`: Passwort-Input zeigt bei `passwordSet` einen Platzhalter
  (â€žgespeichert â€” leer lassen zum Behalten"); `DEFAULT` um `passwordSet` ergÃ¤nzt.
- `types.ts`: `MqttSettings.password` als write-only kommentiert, `passwordSet`
  ergÃ¤nzt.
- `openapi.yaml`: `MqttSettings`-Schema (`password` readOnly `const ""`,
  `passwordSet` neu), Endpoint-Beschreibungen `GET`/`POST /api/settings`,
  Backup-Bundle-Hinweis, Top-Level-â€žNo authentication"-Absatz.

**LÃ¶schen im UI:** Nachgereicht â€” bei gespeichertem Passwort zeigt das leere
Feld ein â€žx"; Klick markiert â€žwird beim Speichern gelÃ¶scht" (rÃ¼ckgÃ¤ngig
machbar), `doSave` schickt dann `mqtt.password: null`.

**Verifikation:** `pio run -e lilygo_t_display_s3_amoled` grÃ¼n, `pnpm typecheck`
grÃ¼n, `redocly lint` valide. HW-E2E am LilyGo S3 (`192.168.178.87`, per USB/COM9):
`GET` zeigt nie das Passwort, `passwordSet` korrekt; Setzen (`"brewpass"`) â†’
`passwordSet:true`, Broker reconnected (`connected:true`); leerer Round-Trip
behÃ¤lt das Passwort; `null` lÃ¶scht es (`passwordSet:false`); Backup-Bundle trÃ¤gt
das Passwort weiter. Board am Ende mit leerem Passwort hinterlassen.

## 2026-09-02/03 â€” Settings-UI-Ãœberarbeitung (5 Teilschritte)

Der Backlog-Cluster aus PLAN.md komplett abgearbeitet, ein Commit pro Punkt.
Reine Frontend-Arbeit â€” keine API-Ã„nderung, `openapi.yaml`/`types.ts` unberÃ¼hrt.

**1. `PageShell` + Breitenbegrenzung.** Der Container-String
`min-h-full bg-bg p-4 text-fg md:p-6` war in 14 Seiten kopiert; die Karten liefen
auf breiten Screens Ã¼ber die volle Fensterbreite. Neue Komponente `PageShell`
kapselt den Container und legt eine zentrierte Spalte mit `max-w-4xl` (896 px)
darÃ¼ber. `LogsPage`/`ArchivePage` nutzen `wide` (uPlot-Charts), `Dashboard` bleibt
unangetastet â€” sein `lg:flex`-Grid vertrÃ¤gt keinen zusÃ¤tzlichen Wrapper.
Nebenbei den `FirmwarePage`-AusreiÃŸer (`p-6`, â€žLÃ¤dtâ€¦") eingesammelt.

**2. Spinner + Skeleton.** Das Projekt hatte weder Spinner noch Skeleton â€” alle
LadezustÃ¤nde waren nackter Text (8Ã— â€žLadenâ€¦", 1Ã— â€žLÃ¤dtâ€¦"), durchgehend als
Early-Return, wodurch Breadcrumb und Header verschwanden und beim Eintreffen der
Daten zurÃ¼cksprangen. Neu: `Spinner` (WinUI-ProgressRing in `currentColor`,
Tailwind-`animate-spin` â€” keine eigenen Keyframes nÃ¶tig) und `Skeleton`
(`SkeletonBar`/`SkeletonCard`/`SkeletonList`; `SkeletonCard` spiegelt die
FlÃ¤chenklassen von `SettingsCard`, damit der Wechsel nichts verschiebt). Alle
Settings-Seiten halten ihren Header jetzt Ã¼ber der Ladeanzeige (`header`-Const
statt dupliziertem Breadcrumb). `LogsPage`/`ArchivePage` bekamen ein
`loaded`-Flag â€” sie konnten â€žlÃ¤dt" bisher nicht von â€žleer" unterscheiden.
Spinner ersetzt die Busy-Texte in `ConfirmModal` (Label bleibt stehen, das
englische â€žWorkingâ€¦" entfÃ¤llt), `FirmwarePage` und `NetworkPage`.

**3. KonnektivitÃ¤ts-Unterseite.** Neue `ConnectivityPage` unter
`/settings/connectivity`; MQTT, Webhook und ESP-NOW auf
`/settings/connectivity/{mqtt,webhook,espnow}` umgezogen, damit URL und
Breadcrumb deckungsgleich bleiben. Index von 11 auf 9 EintrÃ¤ge.

**4. GerÃ¤teliste.** `DeviceRow` hatte die FlÃ¤chenklassen von `SettingsCard`
dupliziert und eine vierte Badge-Variante (`bg-fg/10`) erfunden; die Icon-Buttons
hatten weder Padding noch Fokus-Ring; es gab keinen Empty-State; und
`startEdit()` verschluckte Fehler per `catch {}`, wÃ¤hrend der Klick auf den Stift
fÃ¼r die Dauer von `getConfig()` tot wirkte. Jetzt: `SettingsCard` mit dem Badge
als gedÃ¤mpfte Zweitzeile, 32-px-TrefferflÃ¤chen mit WinUI-Subtle-Hover, Spinner
auf der betroffenen Zeile, Fehlerausgabe, Empty-State.

**5. Filemanager.** `setDir()` aktualisierte die Pfadleiste sofort, wÃ¤hrend die
Tabelle bis zur Antwort von `listFiles()` noch die Dateien des *alten* Ordners
auflistete â€” die Seite behauptete kurzzeitig, diese Dateien lÃ¤gen im neuen
Ordner. Beim ersten Mount blitzte zusÃ¤tzlich â€žLeer" auf. Neues `dirLoading`-Flag
im `[dir]`-Effect: solange es steht, rendert der `tbody` Skeleton-Zeilen und die
Pfadleiste einen Spinner. Die In-Place-Refreshes nach Delete/Rename/Upload setzen
es bewusst nicht â€” dort ist der stehende Inhalt korrekt.

**Verifikation:** `pnpm typecheck` und `pnpm build` grÃ¼n. Browser-Durchgang gegen
den LilyGo S3 (`brewcontrol.local`, 192.168.178.87) auf 1400Ã—900 und 375Ã—812, in
Light und Dark: 896-px-Spalte zentriert (mobil unverÃ¤ndert), Skeleton mit
stehendem Breadcrumb und ohne Layout-Sprung beim Umschalten, Spinner in
â€žNetzwerke suchen" und auf dem Stift der GerÃ¤teliste, alle drei neuen
KonnektivitÃ¤ts-Routen als Deep-Link (SPA-Fallback am GerÃ¤t per curl bestÃ¤tigt),
Filemanager beim Ordnerwechsel ohne widersprÃ¼chliche Liste und mit weiterhin
korrektem â€žLeer" bei tatsÃ¤chlich leerem Verzeichnis. Console durchgehend
fehlerfrei. Nicht praktisch ausgelÃ¶st: der Empty-State der GerÃ¤teliste (Testboard
hat Items) und der `ConfirmModal`-Spinner (AuslÃ¶sen hÃ¤tte gelÃ¶scht bzw. rebootet)
â€” beide typgeprÃ¼ft, der Spinner ist dieselbe Komponente wie in den verifizierten
FÃ¤llen.

**Nebenbefund (nicht gefixt, in PLAN.md eingetragen):** `GET /api/files` hÃ¤ngt
reproduzierbar auf `/logs/3ca049` (Verbindung steht, keine Antwort), ebenso
`GET /api/logs/3ca049/sessions`; andere Pfade inkl. `/www/assets` funktionieren.
Dazu: die englischen Default-Labels von `ConfirmModal` (â€žConfirm"/â€žCancel"), die
sechs Aufrufer ungesetzt lassen.

**Bewusst nicht angefasst:** die 3Ã— duplizierte Save-Bar (Mqtt/Webhook/EspNow),
der 5Ã— duplizierte Reboot-Vollbildschirm, die 2Ã— nachgebaute ProgressBar und der
10Ã— wiederholte `pl-9`-Ausricht-Hack in den Karten â€” jeweils auÃŸerhalb des
Auftrags.

## 2026-09-03 â€” Fix: `/api/files` und `/api/logs/:id/sessions` hÃ¤ngen auf einem Log-Session-Verzeichnis

**Root Cause (zwei Ebenen).** `LogStore::LogCfg::sessionStart` war reine
Laufzeit-State und wurde nie zurÃ¼ckgelesen â€” obwohl `serialize()` den `session`-Key
lÃ¤ngst schreibt. Nach jedem Reboot war `sessionStart == 0`, und der nÃ¤chste
Sample-Tick legte in `writeEmitted_` eine neue `/logs/<id>/<epoch>.csv` an. Bei den
im Betrieb Ã¼blichen Reboots (WiFi-Self-Heal `ESP.restart()` nach 5 min Link-Verlust,
jedes Reflash) fÃ¼llt das ein Log-Verzeichnis Ã¼ber die Zeit mit dutzenden bis
hunderten Stub-CSVs; das Byte-Budget von `pruneToBudget_` (200 MB) lÃ¶st bei 2-KB-
Dateien nie aus. Zweitens machten beide Endpunkte dieselbe Operation:
`serializeSessions` bzw. der `/api/files`-Listing-Zweig laufen synchron auf dem
AsyncTCP-Task durch einen `openNextFile()`-Sweep des ganzen Verzeichnisses unter
`SdLock` â€” pro Eintrag `open`+`name`+`size`+`close` Ã¼ber SPI-SD, JSON komplett im
RAM, `req->send()` erst nach dem kompletten Sweep. `EintrÃ¤ge Ã— Pro-Eintrag-Kosten`
Ã¼bersteigt den Client-Timeout; der Sweep hÃ¤lt dabei `SdLock` und pausiert
`LogStore::tick()` (die laufende Aufzeichnung). `/api/snapshot` bleibt ok, weil es
weder SD noch `SdLock` anfasst.

**Umsetzung** (Branch `fix/logs-session-dir-hang`, 2 Commits, firmware-only):

1. *Session Ã¼ber Reboots fortsetzen.* `loadFromSD` liest den `session`-Key;
   `tick()` persistiert nach einer Session-Neuanlage einmalig via `saveToSD`
   (Muster von `ProgramRunner::tick`); `writeEmitted_` schreibt die Kopfzeile auch,
   wenn eine fortgesetzte Session ihre Datei verloren hat (Karte gewechselt /
   extern gelÃ¶scht). Config-Ã„nderung (`update()`) und â€žLÃ¶schen" (`clear()`) starten
   wie bisher eine frische Session.
2. *Session-Liste aus RAM-Spiegel.* `LogCfg` fÃ¼hrt `std::vector<SessionMeta>`
   (`start`, `size`), gefÃ¼llt von `scanSessions_` einmalig beim Boot, in Step
   gehalten von `writeEmitted_` / `deleteSession` / `pruneToBudget_`.
   `serializeSessions` liest nur noch den Spiegel â€” kein SD-Zugriff, kein `SdLock`,
   sofortige Antwort. Response-Shape (`start`/`size`/`active`) unverÃ¤ndert, daher
   `openapi.yaml` / `types.ts` unangetastet.

`GET /api/files` behÃ¤lt seinen Sweep bewusst: generischer Dateimanager, und die
`/logs/<id>/`-Verzeichnisse bleiben mit der Session-Persistenz jetzt klein.
ZusÃ¤tzlich `delay(0)` alle 64 EintrÃ¤ge im Boot-Scan (`scanSessions_` lÃ¤uft in
`setup()` vor `webUI.begin()`), damit ein Ã¼berraschend groÃŸes Verzeichnis den
Boot nicht wedged.

**Verifikation:** `pio run -e esp32dev` und `-e lilygo_t_display_s3_amoled` grÃ¼n.
Baseline am LilyGo S3 reproduziert (`/api/logs/3ca049/sessions` und
`/api/files?path=/logs/3ca049` ohne Antwort, >60 s; `/api/files?path=/logs`
90 ms). Bereinigung: SD-Karte gezogen, `/logs/3ca049/` samt Demo-Log-Config
gelÃ¶scht. Firmware `9690d13` per OTA geflasht, dann Test-Log (2 s Intervall)
angelegt: `session` landet sofort in `/config/logs.json`; `.../sessions` liefert
den Eintrag in ~15 ms aus dem RAM-Spiegel; `/api/files` auf das Session-Verzeichnis
< 40 ms. Nach Reboot: `session`-Epoch unverÃ¤ndert, **eine** CSV mit **einer**
Kopfzeile, Zeilen laufen Ã¼ber die Reboot-LÃ¼cke im selben File weiter, Boot-Scan
fÃ¼llt den Cache. Test-Log wieder entfernt.

**Nebenbefund:** die englischen `ConfirmModal`-Default-Labels
(â€žConfirm"/â€žCancel") am 2026-09-03 gefixt (Eintrag unten).

## 2026-09-03 â€” Frontend: deutsche ConfirmModal-Defaults + Feedback nach leerem Bus-Scan

Zwei kleine UI-Punkte aus PLAN.md abgehakt.

1. *`ConfirmModal`-Default-Labels.* `confirmLabel`/`cancelLabel` defaulteten auf
   â€žConfirm"/â€žCancel"; sieben Aufrufer (DevicesPage, EspNowPage, MqttPage,
   WebhookPage, NetworkPage 3Ã—) setzen kein `cancelLabel` und zeigten dadurch
   einen â€žCancel"-Button in der sonst deutschen UI. Defaults auf
   â€žBestÃ¤tigen"/â€žAbbrechen" umgestellt â€” eine Zeile in `ConfirmModal.tsx`, kein
   Aufrufer angefasst.
2. *Bus-Scan ohne Treffer.* Der Hint im DS18B20-Sensorformular
   (`AddItemModal.tsx`) war vor und nach einem ergebnislosen OneWire-Scan
   identisch. Neues `scanned`-Flag (true nach erfolgreichem Scan, zurÃ¼ckgesetzt
   bei Pin-Ã„nderung / Modal-Open): vor dem Scan weiter â€žScan ausfÃ¼hren um GerÃ¤te
   â€¦ zu finden", nach einem leeren Scan stattdessen ein `text-caution`-Hinweis
   â€žKein GerÃ¤t auf diesem Bus gefunden â€” Verkabelung und Pull-up prÃ¼fen".

Keine API-Ã„nderung. `pnpm typecheck` + `pnpm build` grÃ¼n. Browser-Pane gegen das
Testboard (LilyGo S3-AMOLED): ConfirmModal auf der GerÃ¤teseite zeigt
â€žAbbrechen"/â€žLÃ¶schen". OneWire-Scan auf dem unbelegten GPIO 10 (Header-Pin, kein
Strapping/Flash, keine Config-Belegung) â†’ `.../api/bus/scan` liefert `[]`, der
`text-caution`-Hinweis erscheint; Pin-Ã„nderung setzt zurÃ¼ck auf â€žScan ausfÃ¼hren
â€¦". Board danach unverÃ¤ndert erreichbar (`/api/snapshot` 120 ms).

## 2026-09-03 â€” Fix: Collection-POST-Routen akzeptierten GET/PUT/PATCH statt `405`

**Root Cause.** Alle elf JSON-Body-Routen in `WebUI.cpp` (`/api/sensors`,
`/api/actuators`, `/api/controllers`, `/api/network`, `/api/dashboards`,
`/api/logs`, `/api/programs`, `/api/settings`, `/api/backup`,
`/api/files/mkdir`, `/api/files/rename`) hingen an
`AsyncCallbackJsonWebHandler`. Dessen Default-Methodenset ist
`HTTP_GET|POST|PUT|PATCH` und sein URI-Matcher ist ein Prefix-Matcher
(`^uri(/.*)?$`). Dadurch landete z.B. `GET /api/sensors` im Create-Handler und
antwortete `400 missing id` statt `405`; `PUT /api/dashboards` fiel (mangels
JSON-Content-Type) in den Catch-all â†’ `404`.

**Umsetzung.** Neue `PostJsonHandler`-Klasse (anon. namespace in `WebUI.cpp`,
neben den bestehenden `BodyPrefixHandler`/`GetPrefixHandler`/`DeletePrefixHandler`):
exakter Pfad-Match statt Prefix, nur `POST`, parst den JSON-Body in einem Chunk
und Ã¼bergibt eine `JsonVariant`. Jede andere Methode â†’ `405 method not allowed`,
leerer Body â†’ `400 missing body`, kaputtes JSON â†’ `400 invalid JSON`, mehrere
Chunks â†’ `413`. Alle elf `new AsyncCallbackJsonWebHandler(...)` 1:1 auf
`new PostJsonHandler(...)` umgestellt, die Handler-Lambdas unverÃ¤ndert.
`#include <AsyncJson.h>` in `WebUI.cpp` entfernt (nur noch von
`WiFiSetupPortal.cpp` mit eigenem Include genutzt). Da der Match jetzt exakt ist,
sind die â€žregistered last / before create handler"-Ordnungs-Kommentare an den
Delete-/Body-Prefix-Handlern hinfÃ¤llig und entfernt.

Der `GET /api/files`-Dateibrowser hing an einem Prefix-Match (`GetPrefixHandler`)
und fing dadurch auch `GET /api/files/mkdir` / `.../rename` ab (â†’ `400 missing
path` statt `405`). Auf zwei exakte Registrierungen umgestellt
(`server_.on(AsyncURIMatcher::exact("/api/files")â€¦)` +
`â€¦exact("/api/files/download")â€¦`), sodass diese GETs zum jeweiligen
POST-only-`PostJsonHandler` durchfallen.

Kein OpenAPI-Vertrag betroffen â€” die dokumentierte Methode je Pfad bleibt gleich;
`405` fÃ¼r undokumentierte Methode+Pfad ist Standard und wird (wie `404` fÃ¼r
unbekannte Pfade) nicht als Vertrag gefÃ¼hrt.

**Verifikation.** `pio run -e esp32dev` + `-e lilygo_t_display_s3_amoled` grÃ¼n.
S3-AMOLED (`brewcontrol.local`) Ã¼ber USB geflasht, danach Methoden-Matrix:
`GET`/`PUT`/`PATCH`/`DELETE` auf `/api/sensors`, `/api/actuators`,
`/api/controllers` â†’ `405`; `PUT /api/{dashboards,logs,settings,network}`,
`GET`/`PUT /api/files/mkdir`, `GET`/`PATCH /api/files/rename` â†’ `405`;
`GET /api/{dashboards,logs,programs,settings,backup}`, `GET /api/files?path=/`
und `GET /api/files/download?path=â€¦` weiter `200`. Echter Roundtrip
`POST /api/sensors {DS18B20,__mtest,pin 15}` â†’ `204`, taucht im Snapshot auf,
`DELETE /api/sensors/__mtest` â†’ `204`, wieder weg. `POST` mit kaputtem/leerem
Body â†’ `400 invalid JSON` / `400 missing body`.

## 2026-09-03 â€” Settings-UI: zwei offene UI-ZustÃ¤nde am GerÃ¤t verifiziert; QEMU-Punkt entfernt

Die beiden seit dem WinUI-Redesign nur typgeprÃ¼ften `DevicesPage`-ZustÃ¤nde am
esp32dev-Testboard (`brewcontrol-esp32dev.local`, leere Config) live
gegengecheckt â€” kein Reflash nÃ¶tig, Create/Delete lief auf der vorhandenen
Firmware:

- **Empty-State der GerÃ¤teliste** â€” bei leerem Snapshot rendert
  `/settings/devices` â€žNoch keine GerÃ¤te konfiguriert â€” Ã¼ber â€š+ HinzufÃ¼gen'
  anlegen." statt einer leeren Seite. Screenshot im PR.
- **`Spinner` im `ConfirmModal`** â€” Test-Sensor (`DigitalInput __mtest`, Pin 34)
  angelegt, LÃ¶schen bestÃ¤tigt; wÃ¤hrend des DELETE-Roundtrips zeigt der
  LÃ¶schen-Button den Spinner, beide Buttons sind `disabled`, Backdrop-Klick
  blockiert. Danach Modal zu, Item weg, Board sauber.

`PLAN.md` â†’ â€žBugs & bekannte EinschrÃ¤nkungen": beide Punkte raus. Ebenfalls
ersatzlos entfernt: die Alt-Notiz â€žQEMU/Simulation ist nicht viable" â€” das Thema
ist abschlieÃŸend geklÃ¤rt (keine WiFi-Emulation fÃ¼r ESP32, Verifikation lÃ¤uft
immer am GerÃ¤t), die Historie steht in [SESSION-archive.md](SESSION-archive.md)
(Pre-MVP 2026-05-17â€“20). Kein Code, kein API-Vertrag betroffen.

## 2026-09-04 â€” Mobile FAB fÃ¼r GerÃ¤te/Logs-HinzufÃ¼gen und Datei-Upload

Die primÃ¤ren Aktions-Buttons (GerÃ¤te â€ž+ HinzufÃ¼gen", Logs â€ž+ Neues Log",
Dateiverwaltung â€ž+ Ordner"/â€žHochladen") saÃŸen bislang nur im Seiten-Header â€”
auf MobilgerÃ¤ten mit dem Daumen schlecht erreichbar. Neue Komponente
`components/Fab.tsx` (`Fab` fÃ¼r Einzelaktion, `SpeedDialFab` fÃ¼r mehrere)
ersetzt sie unterhalb `md:` (768px) durch einen fixed Bottom-Right-Button;
ab `md:` bleiben die Header-Buttons unverÃ¤ndert, der FAB verschwindet.
Dateiverwaltung bekommt echten Speed-Dial (Tap fÃ¤hrt â€žOrdnerâ€œ + â€žHochladenâ€œ
mit Labels aus). Eingebunden in `DevicesPage.tsx`, `LogsPage.tsx`,
`FilesPage.tsx`.

Dabei zwei Nebenbugs in `FilesPage.tsx` gefixt (User-Report per
Screenshot-Annotation): die Icons in den â€ž+ Ordner"/â€žHochladen"-Buttons waren
durch den Wechsel auf `hidden md:inline-flex` nicht mehr vertikal zentriert
(alter `-mt-0.5 inline`-Hack passte nicht mehr zum jetzt flexen Container â€”
gefixt mit `items-center` statt Margin-Hack); und lange Ordnernamen wurden bei
Zeilenumbruch zentriert statt linksbÃ¼ndig dargestellt (Ursache: `<button>` hat
laut Browser-UA-Stylesheet `text-align: center`, mit `text-left` Ã¼bersteuert).

**Verifikation.** `pnpm typecheck` grÃ¼n. Alle drei Seiten im Browser-Preview
(Mobile-Viewport 375Ã—812) durchgeklickt: FAB Ã¶ffnet GerÃ¤te-/Log-Modal direkt,
Speed-Dial fÃ¤hrt in Dateiverwaltung korrekt aus, `disabled`-Zustand
(`dirProtected`/laufender Upload) greift weiter. Ab `md:` (getestet bei
1280Ã—900) FAB weg, Header-Buttons wie vorher. Kein Hardware-Test nÃ¶tig (reine
Web-UI-Ã„nderung).

## 2026-09-04 â€” Programmsteuerung: mobiles Bottom Sheet mit Drag-Geste + Redesign

Die `ProgramCard` (Programmsteuerung, z.B. Maischeprogramm mit
Fortsetzen/ZurÃ¼ck/Weiter/Stop) saÃŸ bei genau einem Dashboard-Programm auf
Mobile/Tablet `sticky` nahe dem oberen Rand â€” kollidierte beim Scrollen
visuell mit Chart-Inhalten darunter, schlecht mit dem Daumen erreichbar, und
die halbtransparente Fluent-Card (`bg-card`) lieÃŸ beliebigen Seiteninhalt
durchscheinen (User-Report per Screenshot-Annotation).

Umgebaut zu einem fixed Bottom Sheet (`components/ProgramCard.tsx`):
opaker/Acrylic-Hintergrund (`bg-surface-acrylic` + `backdrop-blur-md`, wie
die mobile `NavShell`-Kopfzeile â€” erst opak `bg-surface` versucht, dann auf
Wunsch des Users auf Acrylic umgestellt, da der Blur das Bleed-Through-Problem
lÃ¶st ohne auf den Look verzichten zu mÃ¼ssen), abgerundete Oberkante,
Drag-Handle mit echter Swipe-Geste (Pointer-Events: `beginDrag`/`moveDrag`/
`endDrag`, `liveHeight`-State treibt `max-height` der Schrittliste live
wÃ¤hrend des Ziehens; Tap ohne nennenswerte Bewegung togglet stattdessen
direkt). `Dashboard.tsx` bekommt einen Bottom-Spacer, damit der fixed Sheet
den letzten Seiteninhalt nicht dauerhaft verdeckt. Desktop (`lg+`, normale
Sidebar-Card) und der Mehrfach-Programm-Fall (normale Inline-Card, kein
Sheet) bleiben unverÃ¤ndert.

ZusÃ¤tzlich Redesign des Karteninhalts nach einem vom User gezeigten
Claude-Design-Mockup (Optik only, alle bestehenden Aktionen/ZustÃ¤nde
unverÃ¤ndert): Dokument-Icon + Status-Pill im Header (neuer `badgeAccent`-
Token in `ui.ts` ersetzt das hartkodierte Sky-Blau des â€žpausiertâ€œ-Zustands),
groÃŸer â€žHeroâ€œ-Block fÃ¼r den aktuellen Schritt (Schrittname, Countdown nur
bei `running`, Zieltemperatur, dÃ¼nner Fortschrittsbalken, â€žX / Y minâ€œ),
nummerierte/Haken-Kreise in der Schrittliste, grÃ¶ÃŸere Icon-Buttons
(Play/Pause/SkipBack/SkipForward/Square) in einer per CSS-Grid
(`grid-flow-col auto-cols-fr`) gleichmÃ¤ÃŸig verteilten Zeile statt der alten
Text-Glyph-Buttons in `flex-wrap` (die bei schmaler Spalte auf zwei Zeilen
umbrachen und rechts Leerraum lieÃŸen). Die alte Mobile-Zusammenfassungs-Zeile
(â€žEinmaischen Â· 68Â° Â· noch 5:16â€œ) entfÃ¤llt, sobald der Hero-Block sichtbar
ist â€” reine Dopplung; bleibt fÃ¼r den Idle/Done-Fall (kein Hero) als einzige
Info-Quelle erhalten. `var(--accent)` durchgÃ¤ngig statt hartkodierter Farben,
bleibt mit der konfigurierbaren Akzentfarbe (`AppearancePage.tsx`) konsistent.

**Verifikation.** `pnpm typecheck` grÃ¼n. Drag-Geste per dispatchten
`PointerEvent`s getestet (das Browser-Preview-Tool simuliert selbst keine
echten Pointer-Events fÃ¼r Drag) â€” Hoch-/Runterziehen und reiner Tap
funktionieren, kein Doppel-Toggle. Alle Programm-Status durchgespielt
(inkl. echtem Pause/Resume-Zyklus am Testboard) â€” Badges, Buttons, Hero-
Block reagieren korrekt. Desktop-Sidebar und Mehrfach-Programm-Fall ohne
Regression. Acrylic-Effekt per `getComputedStyle` verifiziert
(`backdrop-filter: blur(12px)`).

## 2026-09-04 â€” Profil-Bibliothek (â€žProfilmanager")

Backlog-Punkt aus `PLAN.md` umgesetzt: wiederverwendbare Schritt-Vorlagen, die
sich in ein Sollwert-Programm kopieren lassen, statt jede Maische-/GÃ¤rfolge neu
einzutippen. Entscheidungen vorab mit dem User geklÃ¤rt: Kategorien sind Pflicht
und werden als Tabs auf der Profile-Seite verwaltet (gleiche Mechanik wie die
Dashboard-Tabs), der Controller bleibt Sache des Programms, und ein Profil
anzuwenden **ersetzt** die vorhandenen Schritte nach RÃ¼ckfrage.

**Firmware** â€” neuer `ProfileStore` (`firmware/src/ProfileStore.h/.cpp`) nach dem
Vorbild `DashboardStore`: `SdLock`, Silent-Return bei fehlender/kaputter Datei,
kein Mutex (nur REST-Handler im AsyncTCP-Task), Ids per `%06lx` wie Dashboards
und Logs. Persistenz in `/config/profiles.json` als
`{"categories":[â€¦],"profiles":[â€¦]}`; ein Profil ist `{id,name,category,steps[]}`
mit derselben Step-Form wie ein Programm (`name?`,`setpoint`,`holdSec`,`confirm`),
`name`/`confirm` werden beim Serialisieren weggelassen wenn leer/false. Kategorie
ist Pflichtfeld, deshalb kaskadiert `removeCategory()` in die enthaltenen Profile.
Routen in `WebUI.cpp` analog zum Dashboards-Block: `GET/POST /api/profiles`,
`POST/DELETE /api/profiles/:id`, plus `POST /api/profile-categories` und
`POST/DELETE /api/profile-categories/:id` â€” eigener Pfad-Stamm, damit weder der
`/api/profiles/`-Prefix-Handler noch eine Profil-Id die Kategorien verschattet;
kein eigenes GET, die Kategorien reisen in `GET /api/profiles` mit.

**Backup** â€” `GET /api/backup` bÃ¼ndelt jetzt zusÃ¤tzlich `/config/profiles.json`.
Beim Restore ist die Sektion **optional** (Bundles Ã¤lterer Firmware haben sie
nicht und bleiben importierbar); fehlt sie, bleibt die Datei unangetastet.
`version` bleibt 1, weil eine additive optionale Sektion keinen Konsumenten
bricht.

**Frontend** â€” neue Top-Level-Seite `/profiles` (`pages/ProfilesPage.tsx`,
GerÃ¼st aus `LogsPage`) mit Kategorie-Tabs, â€žKategorien"-Edit-Modus (Stift am
aktiven Tab, `+ Neu`), Profil-Rows mit â€žN Schritte Â· Dauer", LÃ¶schen Ã¼ber
`ConfirmModal` â€” beim Kategorie-LÃ¶schen mit Anzahl der betroffenen Profile im
Text. `components/ProfileEditorModal.tsx` ist der Schritt-Editor des Programms
ohne Regler-Select, dafÃ¼r mit Kategorie-Select und (anders als das Original)
`pending`/`err`-State. Der `ProgramEditorModal` bekam zwei optionale Props:
`library` fÃ¼r â€žAus Profil befÃ¼llen" (Select mit `optgroup` je Kategorie,
RÃ¼ckfrage nur wenn schon Schritte erfasst sind) und `onSaveAsProfile` fÃ¼r die
Gegenrichtung â€” das Dashboard rendert dafÃ¼r den `ProfileEditorModal` als
Geschwister nach dem Programm-Dialog, vorbefÃ¼llt mit Name und Schritten.
Nav-Eintrag in `NavShell.mainItems` deckt Desktop-Rail und Hamburger-Drawer ab
(dasselbe `<nav>`).

Drei kleine Extraktionen, jeweils durch den zweiten Consumer ausgelÃ¶st:
`TabBtn` aus `Dashboard.tsx` in `components/TabBtn.tsx`, `DashboardMetaModal` â†’
`components/NameModal.tsx` (generisch Ã¼ber `title`/`submitLabel`/`placeholder`,
`initial?: { name: string }`), und `fmtDuration` aus `ProgramCard.tsx`
exportiert.

**Verifikation:** `pio run -e esp32dev` und `-e lilygo_t_display_s3_amoled` grÃ¼n;
`npx @redocly/cli lint` valide (nur die bekannte `license`-Warnung);
`pnpm typecheck` grÃ¼n. UI-Flows im Dev-Server durchgespielt (Endpoints per
In-Page-Stub bedient, da das Testboard noch die alte Firmware fÃ¤hrt): Kategorie
anlegen/umbenennen, Profil anlegen (15 min â†’ `holdSec` 900, Metazeile
â€ž1 Schritt Â· 15:00"), Profil in ein leeres Programm Ã¼bernehmen (ohne RÃ¼ckfrage)
und in ein gefÃ¼lltes (RÃ¼ckfrage; Abbrechen lÃ¤sst die Schritte stehen), Programm
als Profil speichern (Schritte inkl. Namen landen im neuen Profil),
Kategorie-LÃ¶schen mit Kaskade (â€žâ€¦ zusammen mit 2 Profilen darin") â†’ Empty-State.
Hamburger-Drawer im Mobil-Viewport zeigt â€žProfile" zwischen Dashboard und
Einstellungen. Dabei gefunden und gefixt: das `initial`-Objekt fÃ¼r den
Profil-Editor wurde bei jedem Render neu erzeugt, wodurch der Hydration-Effekt
erneut feuerte und Eingaben zurÃ¼cksetzen konnte â€” jetzt `useMemo`.

**HW-E2E** am LilyGo T-Display-S3-AMOLED (`brewcontrol.local` / 192.168.178.87),
Firmware `948c3c7` und UI-Paket per OTA eingespielt
(`/api/update/firmware` + `/api/update/assets`, beide `200 ok`, Assets-Upload
lief auf dem S3 wie erwartet durch): `GET /api/profiles` liefert direkt nach dem
Flash `{"categories":[],"profiles":[]}`. Kategorie anlegen â†’ `201 {"id":"34489e"}`
(Format `^[0-9a-f]{6}$`, passt zur Spec), leerer Name â†’ `400 invalid category`,
Profil mit unbekannter Kategorie â†’ `400 invalid profile`. Profil mit drei
Schritten angelegt: der Schritt mit nicht-numerischem `setpoint` wurde still
verworfen, `confirm` nur beim gesetzten Schritt emittiert, `name` beim leeren
weggelassen. Umbenennen und Update je `204`, unbekannte Ids `404 not found` bzw.
`404 not found or invalid`. `/config/profiles.json` (165 B) auf der SD, Inhalt
identisch zur API-Antwort; nach einem Reboot (identische Firmware nochmal per OTA)
sind Kategorie und Profil unverÃ¤ndert da. Kategorie lÃ¶schen â†’ `204`, Bibliothek
danach leer (Kaskade greift). `GET /api/backup` enthÃ¤lt die `profiles`-Sektion in
der erwarteten Form. Die vom Board servierte UI (`/profiles` als Deep-Link â†’ 200
Ã¼ber den SPA-Fallback) legt eine Kategorie an und zeigt Tab plus Empty-State,
keine Konsolenfehler.

**Dabei gefunden:** `POST /api/backup` scheiterte an jedem realistischen BÃ¼ndel
mit `413 body too large` â€” siehe den eigenen Eintrag unten, der Fix kam direkt
hinterher. Danach ist auch der Optional-Pfad fÃ¼r `profiles` am GerÃ¤t bestÃ¤tigt.

**Nebenbefund** (in `PLAN.md` â†’ â€žBugs & bekannte EinschrÃ¤nkungen" eingetragen,
nicht mitgefixt): Programm-Ids sind `p_XXXXX`, die OpenAPI-Spec pinnt sie auf
`^[0-9a-f]{6}$`; `Program.currentStep` ist als â€ž-1 while idle" dokumentiert,
der Code setzt `0`.

## 2026-09-04 â€” Fix: `POST /api/backup` (Restore) scheiterte an jedem realen BÃ¼ndel

**Root Cause:** `PostJsonHandler::handleBody()` und `BodyPrefixHandler::handleBody()`
(`firmware/src/WebUI.cpp`) akzeptierten nur Bodies, die in einem StÃ¼ck ankommen
(`index == 0 && len == total`), und lehnten alles andere mit `413 body too large`
ab â€” es gab keine Body-Akkumulation. ESPAsyncWebServer liefert den Body aber
segmentweise, also scheitert jeder Request, der nicht in ein TCP-Segment passt
(~1,4 KB inkl. Header). Beim Backup-Restore steckt die ganze `/config` im Body:
das BÃ¼ndel des LilyGo S3 ist 1656 B, der Restore war damit **unbenutzbar** â€”
auch Ã¼ber die UI, denn `restoreBackup()` (`web/src/api.ts`) postet dasselbe JSON.
Am GerÃ¤t eingegrenzt mit unschÃ¤dlichen Proben (ungÃ¼ltiger `type`, wird vor jedem
Schreibzugriff abgewiesen): 1284 B â†’ `400 not a brewcontrol backup`, ab 1384 B â†’
`413`. Vorbestehend; die Profil-Bibliothek hat das BÃ¼ndel nur vergrÃ¶ÃŸert.

**Umsetzung:** neuer Helper `collectBody()` im anonymen Namespace von `WebUI.cpp`,
beide Handler nutzen ihn. Einzel-Chunk-Bodies â€” der Normalfall fÃ¼r die kleinen
API-Payloads â€” gehen weiterhin ohne Kopie durch; grÃ¶ÃŸere sammeln sich in
`request->_tempObject`, das der Request-Destruktor freigibt (dasselbe Verfahren
wie im bibliothekseigenen `AsyncCallbackJsonWebHandler`). Obergrenze
`kMaxBodyBytes = 16384`; darÃ¼ber weiterhin `413`, bei fehlgeschlagenem `malloc`
`500 out of memory`. `openapi.yaml`: `BodyTooLarge` neu beschrieben (nicht mehr
â€žkam nicht in einem StÃ¼ck an", sondern â€žÃ¼ber 16 KB"), `/api/backup` um die bis
dahin gar nicht dokumentierte `413` und den `out of memory`-Fall ergÃ¤nzt.

**Verifikation:** `pio run -e lilygo_t_display_s3_amoled` grÃ¼n, `redocly lint`
valide. Am Board (Firmware per OTA): Proben 1368 B / 1684 B / 4984 B / 15984 B
kommen jetzt alle an (`400`, d.h. Body geparst), 16984 B â†’ `413` wie vorgesehen.
Restore des Pre-OTA-BÃ¼ndels **ohne** `profiles`-Sektion (1656 B) â†’ `200 ok`,
Reboot, Dashboards und Settings restauriert, `/config/profiles.json` unangetastet
und die Bibliothek unverÃ¤ndert â€” der Optional-Pfad hÃ¤lt. Voller Roundtrip mit
einem BÃ¼ndel **mit** Profilen (1872 B): exportieren, alle Kategorien lÃ¶schen,
importieren â†’ Kategorien und Profil kommen unverÃ¤ndert zurÃ¼ck. Randnotiz: die
allererste Anfrage direkt nach einem Boot lief einmal in ein `413`, danach nicht
mehr reproduzierbar â€” nicht weiter verfolgt.

## 2026-09-05 â€” HW-Nachtest: GPIO/LEDC-Leak-Fix (2026-08-14)

Der am 2026-08-14 umgesetzte Fix (`AnalogOutputActuator::end()` ruft
`ledcDetachPin()`; `DynamicItems::removeSensor`/`removeActuator` rufen beim
LÃ¶schen jetzt `end()`) hatte mangels Board keinen praktischen Nachtest â€”
jetzt am `esp32dev`-Testboard (192.168.178.74, zu Testbeginn leere Registry)
nachgeholt.

**Aufbau:** `AnalogOutputActuator` (PWM) auf GPIO4 angelegt, Jumperkabel
GPIO4 â†” GPIO5, `DigitalInputSensor` mit `pullup:true` auf GPIO5 als Probe.
Baseline bestÃ¤tigt: Aktor-Werte `v:1`/`v:0` spiegeln sich sofort und exakt in
der Probe â€” der aktive Push-Pull-Treiber Ã¼berstimmt zuverlÃ¤ssig das schwache
interne Pull-up in beide Richtungen.

**Test:** Aktor bei `v:0` (GPIO4 aktiv LOW) ohne Reboot gelÃ¶scht. Direkt
danach blieb die Probe bei LOW â€” erwartet, da nichts den Pin zwischenzeitlich
auf `INPUT` umkonfiguriert (reines GPIO-Output-Register-Restverhalten, kein
Leak-Indiz fÃ¼r sich). Erst der eigentliche Nachtest laut PLAN.md-Formulierung
zeigt es: neuer `DigitalInputSensor` (`pullup:true`) exakt auf GPIO4 angelegt
(derselbe Pin wie der gelÃ¶schte Aktor) â€” `pinMode(INPUT_PULLUP)` greift
sauber, beide Pins (GPIO4 und die gejumperte Probe auf GPIO5) springen auf
HIGH. Kein LEDC-Kanal Ã¼berschreibt den Pin mehr trotz `pinMode`-Wechsel â€” das
wÃ¤re bei unterbliebenem `ledcDetachPin()` der klassische ESP32-Fallstrick
(GPIO-Matrix-Routing Ã¼berlebt einen reinen `pinMode()`-Aufruf).

**Ergebnis:** Fix bestÃ¤tigt. Testsensoren wieder gelÃ¶scht, Board am Ende mit
leerer Registry hinterlassen (Ausgangszustand). PLAN.md-Eintrag entfernt.

## 2026-09-05 â€” PID-AutoTune: Fortschrittsanzeige + Korrektheits-Fix der Relay-Timing

Ausgangspunkt war der Backlog-Punkt â€žFortschrittsanzeige/Restzeit" â€” bei der
Analyse aber ein grundlegenderer Bug gefunden: das vendorte `AutoTunePID`
(Tag `v1.1.6`, `SensActCtrl/library.json`) liest `currentInput` in
`performAutoTune()` nie, sondern kippt den Output stur alle 1000 ms fÃ¼r
`oscillationSteps` (Default 10) Schritte und berechnet Ku/Tu rein aus der
Wanduhr â€” fÃ¼r trÃ¤ge Prozesse (Kessel, Maischebottich) physikalisch
bedeutungslos (`Ku` reduziert sich algebraisch auf die Konstante `4/Ï€`).
Vergleich mit dem Upstream-Repo zeigt: der `main`-Branch (Commit `34c6f39`,
kein Tag) hat eine vollstÃ¤ndige Neufassung mit echter Hysterese-basierter
Relay-RÃ¼ckkopplung (reagiert auf tatsÃ¤chliche Sollwert-Kreuzungen, misst
reale Halbwellen-Perioden) und behebt nebenbei einen zweiten Bug
(ZÃ¤hler/Zeitstempel waren `static`-Lokale statt Instanzfelder â€” mehrere
gleichzeitige AutoTune-LÃ¤ufe hÃ¤tten sich korrumpiert).

**Fix:** `library.json`-Pin auf den main-Commit umgestellt (PrÃ¤zedenzfall fÃ¼r
Commit-Hash-Pins bereits vorhanden: `IdsInductionCooker.git#bf5be40`),
`PidEngine.h/.cpp` auf den neuen `atp::`-Namespace migriert. Da auch `main`
keinen Getter fÃ¼r den internen Halbwellen-ZÃ¤hler/das konfigurierte
`oscillationSteps` hat: `PidEngine` ruft `setOscillationMode()` jetzt aktiv
selbst auf (nicht `setOscillationSteps()` direkt â€” das wÃ¼rde von einem
spÃ¤teren `setOscillationMode()`-Aufruf Ã¼berschrieben) und zÃ¤hlt reale Zyklen
Ã¼ber Flankenerkennung auf `getOutput()` (kippt bei jeder Kreuzung zwischen
zwei diskreten Werten â€” exakt, keine Off-by-one-Falle wie bei einer
`getTu()`-Ã„nderungserkennung, die die erste Kreuzung verpasst hÃ¤tte). Neue
Felder `autotuneCyclesObserved`/`autotuneCyclesTotal` in `paramsJson()`,
OpenAPI und `types.ts`. Frontend: neue Komponente `AutotuneProgress.tsx`
(horizontaler 3-Phasen-Stepper â€žAnfahren â†’ Schwingung â†’ Fertig" + %-Balken,
keine Zeitanzeige), in `ControllerCard.tsx` und `AddItemModal.tsx` eingesetzt.

**Bekannte EinschrÃ¤nkung:** `main` ist kein offizielles Release â€” Arduino-IDE-
Library-Manager-Nutzer (`library.properties`) bekÃ¤men weiterhin `v1.1.6`.
In PLAN.md vermerkt.

**Verifikation:** `pio test -e native` (SensActCtrl, 196 Tests inkl. 4 neue
grÃ¼n), `pio run -e esp32dev` (BrewControl/firmware, zieht den neuen Pin,
kompiliert gegen `atp::`), `redocly lint` valide, `pnpm typecheck` clean.
Echte Zyklen-Numerik auf echter Hardware noch offen (PLAN.md-Hardware-Item
ergÃ¤nzt).

## 2026-09-05 â€” Reihenfolge Auth/Push/HTTPS geklÃ¤rt + Zugriffsschutz umgesetzt

**AuslÃ¶ser:** Beobachtung, dass `esp-webPush` JWT-Klassen mitbringt, die man
â€žauch fÃ¼r Auth brÃ¤uchte" â€” plus die PLAN.md-Annahme, HTTPS sei harte
Voraussetzung fÃ¼r Push. Beide Annahmen halten der PrÃ¼fung nicht stand.

**Recherche-Ergebnis:**

- **Kein geteilter JWT-Baustein.** `esp-webPush` implementiert VAPID-JWT nach
  RFC 8292 (ES256/P-256-ECDSA Ã¼ber mbedTLS), um das *GerÃ¤t gegenÃ¼ber dem
  Push-Service* zu authentisieren â€” lib-intern, nicht als allgemeine JWT-API
  exponiert. Ein Login braucht ein symmetrisches, kurzlebiges Session-Token;
  ECDSA-Verify pro API-Request wÃ¤re auf dem ESP32 die falsche GrÃ¶ÃŸenordnung.
  Gleicher Name, anderer Algorithmus, anderes Threat-Model.
- **`esp-webPush` braucht kein Server-TLS** â€” es ist HTTPS-*Client*, das lÃ¤uft
  lÃ¤ngst (`FirmwareUpdater.cpp:98`, `MqttService.cpp:56`). Der Secure-Context-
  Zwang trifft nur die Seite, die den Service Worker registriert.
- **Self-signed trÃ¤gt fÃ¼r Push nicht** â€” Chrome verweigert SW-Registrierung bei
  Zertifikatsfehlern (w3c/ServiceWorker#1514, Chromium 40423989); der in
  PLAN.md notierte Weg â€žUser akzeptiert einmalig" ist tot.
- **Server-TLS wÃ¤re teuer** â€” `esp32async/ESPAsyncWebServer`+`AsyncTCP` haben
  keinen Server-TLS-Pfad (me-no-dev#899; TLS nur client-seitig im
  tve/AsyncTCP-Fork), bliebe `esp_https_server` mit ~50 Routen, SSE und zwei
  Upload-Pfaden.

**Entschiedene Reihenfolge:** Auth â†’ Web Push Ã¼ber gehosteten Bootstrap-Origin
â†’ HTTPS (entkoppelt, optional). Damit fÃ¤llt der teuerste Punkt aus dem
kritischen Pfad, auch fÃ¼r Installationen bei anderen, die sonst zuhause
HTTPS einrichten mÃ¼ssten. Push-Design und HTTPS-Varianten stehen in PLAN.md.

**Umgesetzt: Stufe 1 â€” Zugriffsschutz (optional, Lesen frei, Schreiben
geschÃ¼tzt).**

Neue Klasse `AuthService.{h,cpp}`: salted, 10k-fach iteriertes SHA-256 Ã¼ber
`mbedtls_md` (versionsstabil Ã¼ber mbedTLS 2.x/3.x), Credentials in
`Preferences("brewctrl")` â€” derselben NVS-Namespace wie die WLAN-Daten. Das
hÃ¤lt das Secret aus `GET /api/settings`, aus dem Backup-Bundle und von der
SD-Karte fern und macht den bestehenden BOOT-Tasten-Factory-Reset
(`main.cpp:131`, `prefs.clear()`) ohne eine Zeile Extra-Code zum
â€žPasswort vergessen"-Pfad. Sessions: 4 Slots, opake 16-Byte-Tokens aus
`esp_random()`, 7 Tage Gleitablauf, wrap-sichere `millis()`-Vergleiche,
Constant-Time-Compare. Bewusst **nur RAM** â€” persistierte Sessions brÃ¤uchten
Epoch-Zeit statt `millis()` und damit einen synchronisierten NTP-Stand.

**Kein separates `enabled`-Flag:** `isConfigured()` ist die einzige Wahrheit.
Kein Passwort â‡’ jedes Gate ist ein No-op, BestandsgerÃ¤te bleiben nach dem
Update unverÃ¤ndert offen. Schutz einschalten = Passwort setzen, ausschalten =
lÃ¶schen.

**Cookie statt Bearer-Header**, weil `EventSource` keine Custom-Header setzen
kann â€” ein Token im Header hÃ¤tte `/api/events` unlÃ¶sbar gemacht. Cookies fahren
same-origin automatisch mit, deshalb blieben alle 31 `fetch()`-Aufrufstellen in
`api.ts` inhaltlich unangetastet.

**Gate-Schnitt in `WebUI.cpp`:** Die PrÃ¼fung sitzt in den drei generischen
Handler-Klassen (`BodyPrefixHandler`, `DeletePrefixHandler`, `PostJsonHandler`)
statt an ~30 Registrierungsstellen; `requireAuth()` nimmt `/api/auth/*` aus
(sonst wÃ¤re Login unmÃ¶glich). Explizit nachgezogen an den fÃ¼nf Roh-Routen
(`wifi-reset`, `update/firmware`, `update/assets`, `files` DELETE,
`files/upload`). Die beiden OTA-Uploads brauchten dafÃ¼r ein
`uploadUnauthorized_`-Flag analog zum vorhandenen `fileUploadRejected_` â€” ohne
das hÃ¤tte der finale Chunk ein zweites Mal geantwortet.

**Nebenbei geschlossen:** `GET /api/backup` gab das MQTT-Passwort im Klartext
aus (`SettingsStore::serialize()` emittiert `mqtt.password`,
`WebUI.cpp:788` schwÃ¤rzt es nur fÃ¼r `GET /api/settings`). Als einzige Leseroute
liegt das Backup jetzt hinter dem Gate.

**Frontend:** zentrale `failed()`-Fehlerbahn in `api.ts` (alle 30 identischen
Fehlerzeilen umgestellt), die bei 401 einmalig `bc:unauthorized` feuert;
`app.tsx` Ã¶ffnet darauf das neue `LoginModal.tsx`. Neue Seite
`SecurityPage.tsx` (Einstellungen â†’ Zugriffsschutz): einrichten, Ã¤ndern,
aufheben, alle Sitzungen abmelden â€” ohne An/Aus-Toggle, passend zum
Firmware-Modell. Antwortet das GerÃ¤t nicht auf `/api/auth/status` (Ã¤ltere
Firmware), zeigt die Seite das explizit an, statt â€žungeschÃ¼tzt" zu raten oder
im Skeleton hÃ¤ngen zu bleiben.

**Verhalten bei Hostnamen-Ã„nderung** (durchgespielt, kein Sonderfall-Code
nÃ¶tig): Passwort Ã¼berlebt (`POST /api/network` macht `putString`, kein
`clear()`), das Cookie nicht â€” es hÃ¤ngt am alten Host. Gleiches gilt schon
immer zwischen IP und `.local`: zwei Origins, zwei Anmeldungen. In README
dokumentiert.

**Grenze, bewusst so:** ohne TLS geht das Passwort beim Anmelden im Klartext
Ã¼ber das LAN. Schutz gegen Fehlbedienung und beilÃ¤ufige Zugriffe, nicht gegen
einen aktiven Angreifer im Segment. Challenge-Response wurde verworfen â€” es
schlieÃŸt nur passives Mitlesen, solange das JS selbst Ã¼ber http kommt.

**Verifikation:** `pio run -e esp32dev` grÃ¼n, Î” gegen HEAD gemessen (Baseline-
Build mit zurÃ¼ckgesetzten Quellen): Flash 1 408 453 â†’ 1 415 325 B (74,1 % â†’
74,5 %), RAM 52 128 â†’ 52 320 B (+192 B). `pnpm typecheck` clean, `pnpm build`
grÃ¼n, `redocly lint` valide (die bisher unterdrÃ¼ckte `security-defined`-Warnung
ist damit erledigt; `info-license` war schon vorher offen). Im Browser gegen
den Vite-Dev-Server geprÃ¼ft: Settings-Eintrag da, Login-Modal rendert korrekt,
und der Degradationspfad griff live â€” das GerÃ¤t unter `brewcontrol.local`
lÃ¤uft noch mit alter Firmware und antwortet 404 auf `/api/auth/status`.

**Hardware-E2E am LilyGo T-Display-S3-AMOLED (`brewcontrol.local`,
192.168.178.87) â€” vollstÃ¤ndig grÃ¼n.** Firmware geflasht (COM9, Hash verifiziert,
Flash 20,5 % / RAM 15,5 % auf dem 16-MB-Board), UI-Paket Ã¼ber
`POST /api/update/assets` nachgezogen (4,3 s, neues Bundle wird ausgeliefert).

Durchlauf in dieser Reihenfolge, jeweils per `curl`:

1. **Aus-Zustand als Regressionstest** â€” `/api/auth/status` meldet
   `{"enabled":false,"authenticated":true}`, Schreiben ohne Cookie `204`,
   `GET /api/backup` `200`, Login gegen ein passwortloses GerÃ¤t `409 no password
   configured`. Verhalten identisch zu vorher.
2. **Passwort gesetzt** (ohne `currentPassword`, wie vorgesehen) â†’ `204` +
   `Set-Cookie`. Status ohne Cookie danach `{"enabled":true,"authenticated":false}`.
3. **Reads bleiben offen** â€” `/api/snapshot` und `/api/settings` je `200`.
4. **Writes gesperrt** â€” `POST /api/actuators/<id>`, `POST /api/settings`,
   `DELETE /api/actuators/<id>` je `401`.
5. **Gated read** â€” `GET /api/backup` ohne Cookie `401`, mit Cookie `200`.
6. **SSE** bleibt bei aktivem Schutz ohne Cookie offen (`200`,
   `text/event-stream`, laufende `snapshot`-Events).
7. **Negativtests** â€” falsches Passwort `401`, gefÃ¤lschtes `bcsid` `401`,
   falsches `currentPassword` beim Ã„ndern `403`.
8. **Cookie-PrÃ¤fix-Falle** â€” `Cookie: xbcsid=<gÃ¼ltiges Token>` wird korrekt
   abgelehnt (`401`); die Separator-PrÃ¼fung in `sessionCookie()` greift.
9. **Reboot** (Ã¼ber `POST /api/network` mit unverÃ¤ndertem Hostnamen, selbst
   gated) â€” nach ~25 s wieder da: Passwort Ã¼berlebt (`enabled:true`, NVS),
   Session nicht (altes Cookie â†’ `401`, RAM-only wie entworfen).
10. **AufgerÃ¤umt** â€” Schutz mit leerem Passwort aufgehoben, `Set-Cookie` mit
    `Max-Age=0`, Endzustand wieder `{"enabled":false,"authenticated":true}` und
    Schreiben ohne Cookie `204`.

**Falscher Alarm unterwegs:** `curl http://<ip>/api/events` antwortet `404`.
Nicht durch diese Ã„nderung verursacht â€” die beiden Boards mit alter Firmware
(`.74`, `.82`) verhalten sich identisch. `AsyncEventSource::canHandle` verlangt
`Accept: text/event-stream`; mit dem Header kommt sauber `200` plus Event-Strom.
FÃ¼r kÃ¼nftige SSE-Tests per curl also immer den Accept-Header mitgeben.

## 2026-09-06 â€” Fix: mobiles Programm-Bottom-Sheet verdeckte das letzte Listenelement

Das fixe Bottom Sheet (`ProgramCard` mit `fill`, seit 2026-09-04) liegt auf
Mobile bewusst Ã¼ber der gescrollten Dashboard-Liste. Der dafÃ¼r vorgesehene
Platzhalter in `Dashboard.tsx` war fest auf `h-40` (10 rem) â€” sobald das Sheet
hÃ¶her wurde (aktiver Hero-Block mit Fortschrittsbalken, oder per Drag auf
`max-h-[50vh]` aufgezogen), reichte der Abstand nicht und das unterste
Karten-/Listenelement blieb hinter dem Sheet unerreichbar.

Umsetzung: `ProgramCard` misst die eigene gerenderte HÃ¶he per `ResizeObserver`
auf dem Root-Element und meldet sie Ã¼ber den neuen Callback `onSheetHeight`
(auf Desktop `0`, da das Sheet dort eine normale Spaltenkarte ist). `Dashboard`
hÃ¤lt die HÃ¶he in `sheetH` und setzt den Platzhalter (`lg:hidden`) per Inline-
`style={{ height: sheetH }}` â€” wÃ¤chst und schrumpft jetzt mit dem Sheet, auch
wÃ¤hrend des Drags. `pnpm typecheck` + `pnpm build` grÃ¼n; HW-Verifikation am
GerÃ¤t steht noch aus.

## 2026-09-05 â€” Alarme & Schwellwerte + Notification/Alert-Center

Der Backlog-Punkt â€žAlarme & Schwellwerte" samt seiner Erweiterung
â€žNotification/Alert-Center" umgesetzt. Vorher war ein `fault()` nur als Badge
auf der jeweiligen Karte sichtbar â€” lag die Karte auf einem anderen
Dashboard-Tab, sah man ihn gar nicht; es gab keine Aggregation, keinen Verlauf,
und Grenzwerte auf Messwerte Ã¼berhaupt nicht.

**Entscheidungen vorab** (mit dem Nutzer geklÃ¤rt): Auswertung komplett in der
BrewControl-Firmware, SensActCtrl bleibt unangetastet â€” damit teilt sich der
spÃ¤ter geplante Punkt â€žSensorgetriggerte Schritte" die Condition-Struktur
direkt, beide liegen in BrewControl. Alle vier Trigger in v1. Alert-Verlauf im
RAM-Ring, Regeln persistiert. Eigenes SSE-Event statt Snapshot-Erweiterung,
weil dessen fester 4160-Byte-Puffer bei Ãœberlauf den Push still verwirft.

**Firmware.** Neu `Condition.h/.cpp` â€” `LogStore::resolve()` als freie Funktion
`resolveRef()` herausgezogen (reiner Verschiebe-Schritt, `LogStore` ruft sie
jetzt auf) und um das wiederverwendbare Primitiv `Condition {ref, op, value,
hyst}` + `evalCondition()` mit Latch-Semantik ergÃ¤nzt. Neu `AlarmStore.h/.cpp`
nach dem Store-Muster von `ProfileStore`/`LogStore`: Regeln in
`/config/alarms.json`, Alert-Ring (40 EintrÃ¤ge, feste `char`-Arrays statt
`std::string` â€” deterministische ~6 KB im `.bss` statt Heap-Fragmentierung neben
WiFi/AsyncTCP/SD), rekursiver Mutex wie bei den anderen Stores mit `tick()`.
Drei Detektoren im Tick: Schwellwerte mit Hysterese und `forSec`-Entprellung,
`fault()`-Flanken, AutoTune-Abschluss (per `strstr` Ã¼ber `paramsJson()`, weil
`Controller` keinen Autotune-Accessor auf dem Basis-Interface hat). GelÃ¶schte
Items fallen per Mark-and-Sweep aus der Flanken-Tabelle â€” kein
`DynamicItems`-Observer nÃ¶tig; eine Regel auf ein verschwundenes Item feuert
weder noch lÃ¶scht sie sich, sondern meldet `resolved: false` und heilt, wenn das
Item zurÃ¼ckkommt.

`ProgramRunner` bekam `setOnStatusChanged()` plus ein privates `setStatus_()`,
Ã¼ber das alle neun Zuweisungsstellen laufen (die in `loadFromSD` bewusst nicht,
sonst wÃ¼rde der Boot Alerts fÃ¼r ÃœbergÃ¤nge von vor dem Reboot feuern).

**Zwei Details, die Ã„rger verhindern:** Der `AlarmStore` sendet nicht selbst,
sondern legt Alerts in eine Outbox, die `WebUI::tick()` mit max. 4 pro Durchlauf
leert â€” `raise_()` kann Ã¼ber den ProgramRunner-Callback auf dem AsyncTCP-Task
laufen und bleibt so allokations- und netzwerkfrei. Und anders als
`LogStore`/`ProgramRunner` wartet der Store *nicht* auf NTP: ein unterdrÃ¼ckter
Alert ist fÃ¼r immer weg, und die erste Minute nach dem Boot ist genau die, in
der ein Verdrahtungsfehler auffÃ¤llt. Vor dem Sync ausgelÃ¶ste Alerts tragen
`ts: 0`, die Entprellung lÃ¤uft durchgehend auf `millis()`.

**API.** `GET/POST /api/alarms`, `POST/DELETE /api/alarms/<id>`,
`POST /api/alarms/<id>/enable`, `GET /api/alerts[?since=<seq>]`,
`POST /api/alerts/clear`, plus das SSE-Event `alert`. Auth kommt gratis Ã¼ber die
bestehenden Handler-Klassen; nur `/api/alerts/clear` (body-los) braucht
`requireAuth` von Hand. `?since=` ist der einzige Reparaturpfad und deckt
Kaltstart, Reconnect *und* von `AsyncEventSource` still verworfene Pushes mit
einem Mechanismus ab. `openapi.yaml` und die README-Routentabelle im selben
Zug nachgezogen, inkl. der bisher falschen Behauptung â€žThe only event name is
`snapshot`".

**Frontend.** `subscribeEvents()` nimmt jetzt optional `onAlert` und `onOpen` â€”
eine EventSource fÃ¼r beide Event-Namen, weil jede Verbindung dem GerÃ¤t einen
SSE-Client-Slot kostet. Neu `AlertCenter.tsx` (Toast-Stack unten rechts plus
Slide-in-Panel an einer Glocke in der NavShell mit Aktiv-ZÃ¤hler),
`AlarmEditorModal.tsx` und die Seite `/settings/alarms`. Die Firmware sendet
bewusst keine deutschen Texte â€” sie liefert strukturierte Felder, die deutsche
Formulierung entsteht in genau einer Funktion `alertText()`. Aktive Alarme
badgen zusÃ¤tzlich die Sensor-/Aktorkarte. `styles.css` blieb unangetastet:
`--success/--caution/--critical/--accent` decken das Severity-Vokabular ab.

**Bewusst *kein* Alert-Center als eigene Route:** eine Seite ist genau dann
nicht erreichbar, wenn man sie braucht â€” man steht am Kessel auf dem Dashboard.
Deshalb Glocke plus Panel, das Ã¼ber jeder Seite aufgeht.

**Verifikation.** `pio run` grÃ¼n fÃ¼r alle drei Board-Envs; RAM auf esp32dev
52320 â†’ 58632 Byte, also die kalkulierten ~6 KB fÃ¼r den Ring.
`pio test -e native` grÃ¼n in beiden Projekten (BrewControl 16, SensActCtrl 196).
`npx @redocly/cli lint` sauber (die eine `info-license`-Warnung ist vorbestehend).
`pnpm typecheck` und `pnpm build` grÃ¼n.

Danach per Netzwerk-OTA auf den LilyGo (`brewcontrol.local`) geflasht und E2E
durchgespielt â€” Regeln auf den echten DS18B20 (`sensor/mlt`) und auf
`actuator/pump`:

1. **Schwellwert raise** â€” Regel `mlt > 20` angelegt, feuert innerhalb einer
   Sekunde: SSE-`alert` auf der Leitung, `active: true` mit `since`,
   Ring-Eintrag mit `v: 22.5`.
2. **Raise â†’ cleared â†’ raise** Ã¼ber `actuator/pump` (an/aus/an) â€” alle drei
   Flanken kamen als eigene SSE-Events, `cleared` korrekt mit `sev: info`.
3. **enable-Toggle** â€” Deaktivieren lÃ¶scht den Latch und setzt
   `resolved: false`, Reaktivieren feuert neu.
4. **Tote Referenz** â€” Regel auf `sensor/gibtesnicht`: `resolved: false`,
   `active: false`, kein Alert, keine LÃ¶schung.
5. **Programm-Trigger** â€” Zweischritt-Programm mit `confirm` (Sollwert 0, damit
   der PID garantiert Ausgang 0 kommandiert): `awaiting` als Warnung, `done` als
   Info.
6. **Validierung** â€” fehlender Name/`cond`/`value` und kaputtes JSON je `400`,
   unbekannte Id bei POST und DELETE je `404`.
7. **`?since=`** â€” `since=2` liefert genau `[3, 4]`, `since=999` leer.
8. **Reboot** â€” Regeln Ã¼berleben (`/config/alarms.json`), der Ring lÃ¤uft bei
   `seq: 1` neu an, und der noch anstehende Schwellwert meldet sich beim ersten
   Tick von selbst wieder â€” genau das Verhalten, das den RAM-Ring vertretbar
   macht.
9. **UI gegen dasselbe GerÃ¤t** â€” Glocken-ZÃ¤hler (1 â†’ 2), â€žGrenzwertâ€œ-Badge auf
   Sensor- und Aktorkarte, Live-Toast unten rechts, Panel mit Verlauf in
   GerÃ¤te-Zeitformat, Severity-Filter, â€žVerlauf leerenâ€œ. Regelseite und Editor
   (Live-Kanalliste aus dem Snapshot, Validierung) in hellem und dunklem Theme.

Beim UI-Test fiel auf, dass der Rohwert als `aktuell 22.4375` erschien â€” der
Alert trÃ¤gt keine KanalauflÃ¶sung, also rundet `alertText()` jetzt auf zwei
Nachkommastellen.

**Ein echter Fund im Testlauf:** `alarms_.tick()` stand zunÃ¤chst vor dem
1-Hz-Gate in `WebUI::tick()` und lief damit bei jedem Loop-Durchlauf (~5 ms) â€”
inklusive `paramsJson()` fÃ¼r jeden Controller. Auf 1 Hz gezogen und mit einem
eigenen `lastAlarmMs_` versehen; die Entprellung hÃ¤ngt ohnehin an `millis()`,
nicht an der Tick-Zahl.

**Testartefakte entfernt:** Regeln, Testprogramm und Verlauf gelÃ¶scht, Pumpe und
`testpid` auf ihren Ausgangszustand zurÃ¼ckgesetzt.

**Noch offen:** die Trigger `fault()` und AutoTune â€” ersterer hÃ¤tte auf dem
Board eine Umstellung des MQTT-Transports auf einen toten externen Host
gebraucht, letzterer einen vollstÃ¤ndigen AutoTune-Durchlauf. Als eigener Punkt
in [PLAN.md](PLAN.md) notiert, zusammen mit der dabei aufgefallenen LÃ¼cke, dass
`GET /api/backup` weder Logs noch Programme noch Alarme mitnimmt.

## 2026-09-09 â€” Push-Notifications umgesetzt (esp-webPush, ein Keypair pro Installation)

**AuslÃ¶ser:** Wunsch, Meldungen aufs Handy zu bekommen â€” bis dahin liefen alle
Alerts nur Ã¼ber SSE ins offene Dashboard, also genau dann nicht, wenn es zÃ¤hlt.

**Zwei Planannahmen fielen bei der PrÃ¼fung:**

- **Curier ist mit dieser Platform nicht baubar.** Weil `ESPToolKit/esp-webPush`
  seit 2026-08-03 archiviert ist, war zunÃ¤chst der Nachfolger
  [ZekStack/curier](https://github.com/ZekStack/curier) gesetzt. Er nutzt
  `std::span` â€” libstdc++ liefert das erst ab GCC 10, `espressif32@6.10.0` pinnt
  fÃ¼r Arduino aber fest GCC 8.4. Der Compiler kennt `-std=gnu++20` nicht einmal
  dem Namen nach (nur `gnu++2a`), und unter `gnu++2a` verlor er zusÃ¤tzlich die
  implizite Inline-Eigenschaft von `static constexpr`-Membern
  (`YF_S201Sensor::kHzPerLiterPerMin` â†’ undefined reference). Curier hÃ¤ngt damit
  am Sprung auf Arduino Core 3 / ESP-IDF 5 â€” eigenes Vorhaben, steht in PLAN.md.
  Also esp-webPush auf seinem letzten Commit, bewusst nicht auf dem Tag `v2.0.0`:
  die TLS-ZertifikatsprÃ¼fung (`useTlsCertBundle`) kam erst danach, ohne sie hÃ¤tte
  der Push-Request keine CA. Archiviert heiÃŸt: der SHA ist so unverÃ¤nderlich wie
  ein Tag.
- **Die Trigger waren schon gebaut.** PLAN.md ging noch davon aus, Flankenerkennung
  fÃ¼r `fault()` und Programm-Ende mÃ¼sse erfunden werden. Seit `c1a1b64` erzeugt
  `AlarmStore` aber genau diese vier Ereignisse fertig entprellt. Push hÃ¤ngt sich
  deshalb nur mit einem zweiten Lese-Cursor (`takePendingPush`) an denselben Ring,
  den `WebUI::tick()` schon fÃ¼r SSE leert â€” getrennte Cursor, damit sich beide
  Verbraucher keine Meldungen wegnehmen.

**Ein VAPID-Keypair pro Installation statt pro GerÃ¤t** (PLAN.md hatte pro GerÃ¤t
vorgesehen): Ein Browser hÃ¤lt pro Service-Worker-Scope genau ein Abo, fest
gebunden an einen `applicationServerKey`. Ein Keypair pro GerÃ¤t brÃ¤uchte damit
einen eigenen statischen Scope-Ordner je GerÃ¤t auf Pages plus eine GerÃ¤tâ†’Platz-
Liste im Browser, die beim LÃ¶schen der Browserdaten verfÃ¤llt. Die Bootstrap-Seite
erzeugt das Keypair stattdessen per WebCrypto, hÃ¤lt es in ihrem localStorage und
gibt es jedem GerÃ¤t mit; ein GerÃ¤t, das schon einen Key kennt, reicht ihn als
`?k=` mit. Ergebnis: ein Abo pro Browser fÃ¼r beliebig viele GerÃ¤te, kein
Krypto-Code auf dem ESP32, und nichts Geheimes im Ã¶ffentlichen Repo.

**Umsetzung:** `PushService.{h,cpp}` nach dem `WebhookService`-Muster (Globale in
`main.cpp`, `begin()` nach dem STA-Connect, `tick()` im Loop). Keypair und bis zu
vier Abos in NVS, bewusst nicht in `/config/*.json`, damit sie aus
`GET /api/backup` herausbleiben â€” eine Endpoint-URL ist das einzige Geheimnis,
das eine fremde Benachrichtigung verhindert. FÃ¼nf Routen unter `/api/push/*`,
Schreibzugriffe automatisch Ã¼ber die vorhandenen Handler-Klassen auth-gated.
Neue statische Seite `BrewControl/push-bootstrap/` plus `.github/workflows/pages.yml`
(â†’ `nhhop.github.io/Brauerei/push/`), neue SPA-Seite
`/settings/notifications`.

Zwei Details, die Ã„rger gespart haben: `WebPushConfig` defaultet auf
`queueMemory = Psram`, das zwei der drei Boards nicht haben (â†’ `Internal`), und
der Worker-Stack-Default von 4 KB Ã¼bersteht keinen TLS-Handshake (â†’ 12 KB, wie
das Upstream-Beispiel nahelegt). Die Klick-URL der Meldung wird bei *jedem* Push
frisch aus `WiFi.localIP()` gebaut statt aus dem Hostnamen â€” Android lÃ¶st mDNS
nicht zuverlÃ¤ssig auf, und das Handy ist der ganze Zweck der Ãœbung.

**Verifikation:** Alle drei Envs bauen; Flash `esp32dev` 75,3 % â†’ 83,3 %
(+152 KB, im Wesentlichen TLS-Pfad und Zertifikats-Bundle), RAM +888 B.
`pnpm typecheck` und `pnpm build` grÃ¼n, Redocly-Lint grÃ¼n. Lokal verifiziert:
Redirector-Schutz der Bootstrap-Seite (`https://â€¦`, fremde Hosts abgelehnt,
`.local` und private IPs akzeptiert), die WebCrypto-Formate (65-Byte-P-256-Punkt
mit `0x04`-Marker, 32-Byte-PrivatschlÃ¼ssel, unpadded base64url) und der
Fragment-Ãœbergabepfad (`#push=â€¦` â†’ `POST /api/push/subscription` â†’ `204`, Hash
danach aus der URL). Am GerÃ¤t (LilyGo S3, `brewcontrol.local`) nachgezogen: Firmware und UI
geflasht â€” das Board lief zuvor auf einem UI-Stand *vor* dem Alarm-Center, bei
gleichzeitig neuerer Firmware, weil damals `cdf5fe0-dirty` geflasht und die UI
nicht mit deployt worden war. Danach verifiziert: `GET /api/push` liefert den
erwarteten Zustand, `test`/`reset` `204`, Validierung `400`/`404`,
`GET /api/backup` enthÃ¤lt weder `privateKey` noch Endpoint-URL (der Grund fÃ¼r
NVS statt `/config/*.json`), GerÃ¤t Ã¼ber eine Minute stabil. Zustellung am 2026-09-10 bestÃ¤tigt (nach dem Pages-Deploy
und dem Fix unten): Testmeldung und echte Trigger kommen an, auf Desktop und
Handy, auch bei geschlossenem Tab und geschlossenem Browser; ein Klick auf die
Meldung Ã¶ffnet das Dashboard. Offen bleibt nur der Mehr-GerÃ¤te-Fall, siehe
PLAN.md. Automatisiert war das nicht zu prÃ¼fen: der Browser der Werkzeugkette
meldet `Notification.permission === "denied"` und verweigert die
SW-Registrierung.
## 2026-09-10 â€” Fix: zweiter Browser ersetzte das Abo des ersten

**Symptom:** Ein zweiter Browser einrichten warf das Abo des ersten raus â€” die
Liste blieb bei einem Eintrag.

**Root Cause:** Denkfehler in `push-bootstrap/app.js`. `resolveKeypair()` gab bei
einem per `?k=` Ã¼bergebenen GerÃ¤tekey `{publicKey, privateKey: null}` zurÃ¼ck, und
der Aufrufer ersetzte das anschlieÃŸend durch ein **frisch erzeugtes Keypair** â€”
mit dem Kommentar â€žnothing here can sign for it". Falsch: der Browser signiert
nichts, `pushManager.subscribe()` nimmt ausschlieÃŸlich den *Ã¶ffentlichen*
SchlÃ¼ssel; signiert wird beim Senden auf dem GerÃ¤t, das die private HÃ¤lfte lÃ¤ngst
hat. Der neue SchlÃ¼ssel kam als Key-Wechsel beim GerÃ¤t an, und ein Key-Wechsel
verwirft per Design alle Abos (sie wÃ¼rden gegen den neuen Key nur 403 liefern).

**Umsetzung:** In `app.js` hat `?k=` jetzt Vorrang vor dem localStorage â€” das
GerÃ¤t ist der Anker, damit alle GerÃ¤te einer Installation dieselbe Subscription
bedienen. Der localStorage-Eintrag wird nur genutzt, wenn er zum GerÃ¤tekey passt
(dann reisen beide HÃ¤lften mit) oder wenn das GerÃ¤t noch gar keinen Key hat. Der
Neu-Erzeugen-Block ist ersatzlos weg. `PushService::setSubscription()` akzeptiert
dafÃ¼r einen leeren `privateKey`, solange der `publicKey` der gespeicherte ist;
ein *unbekannter* Key braucht die private HÃ¤lfte weiterhin, sonst wÃ¤re er
unbrauchbar.

**Verifikation:** Am LilyGo S3 (`8d85d14-dirty`) direkt gegen die API geprÃ¼ft â€”
zweiter Browser (gleicher `publicKey`, leerer `privateKey`, neuer Endpoint) â†’
`204`, Liste wÃ¤chst auf zwei Abos, `publicKey` unverÃ¤ndert; unbekannter Key ohne
private HÃ¤lfte â†’ `400`; Test-Eintrag wieder entfernt â†’ `204`. Redocly-Lint grÃ¼n. Nach dem Merge
vom Nutzer bestÃ¤tigt: zwei echte Abos nebeneinander (Windows-Desktop und
FCM/Handy), beide bekommen die Meldungen.
## 2026-09-10 â€” esp32dev auf Stand gebracht, UI-Netzwerk-Deploy fÃ¼r LittleFS-Boards

**AuslÃ¶ser:** Das esp32dev-Testboard hing 70 Commits zurÃ¼ck (Stand `3213288`,
LittleFS-Support vom 28.8.) â€” ohne Auth, Profile, Alarme und Push.

Firmware per OTA (`POST /api/update/firmware`) war unkritisch. Die UI dagegen
schien Handarbeit zu erfordern: `CLAUDE.md` schrieb dafÃ¼r `pio run -t uploadfs`
vor und schloss den Netzwerk-Upload aus â€” und genau dieses Board hat keinen
zuverlÃ¤ssigen Auto-Reset, d.h. jemand muss den BOOT-Button halten.

**Erkenntnis:** Der Netzwerk-Upload funktioniert dort sehr wohl, er scheiterte
bisher nur am Paket. `pnpm build:sd` lÃ¤sst die unkomprimierten Dateien neben den
`.gz` liegen, das Ã¼bliche `webui.tar` ist damit ~440 KB und passt nicht in die
256-KB-Datenpartition. Ein Tar aus **nur den .gz-Dateien** ist ~100 KB â€” dieselbe
DiÃ¤t, die `firmware/data/www` ohnehin hÃ¤lt, weil ESPAsyncWebServer `.gz`
transparent ausliefert. Upload in ~2 s, Swap sauber, `/www` danach byte-identisch
zum lokalen Build. Der auf dem LOLIN S2 Mini dokumentierte Abbruch bei ~65 KB
trat auf dem esp32dev nicht auf; fÃ¼r den LOLIN bleibt die EinschrÃ¤nkung bestehen.

Regel in `CLAUDE.md` entsprechend prÃ¤zisiert (statt pauschalem Ausschluss) und
den Weg in `README.md` als eigenen Abschnitt ergÃ¤nzt. Beide Boards laufen jetzt
auf `97cfdb6` mit identischer UI.
## 2026-09-10 â€” Fix: Push-Test crashte den esp32dev (IRAM statt DRAM)

**Symptom:** `POST /api/push/test` auf dem esp32dev lieferte keine Antwort; das
S3 beantwortete dieselbe Route in 0,1 s. Ein Poll-Loop zeigte nur einen einzelnen
Aussetzer, was zunÃ¤chst gegen einen Reboot sprach.

**Root Cause:** Die serielle Konsole zeigte `Guru Meditation Error (LoadStoreError)`
plus Reboot â€” der Boot war schnell genug, dass der Poll ihn fast verpasste. Der
per `addr2line` dekodierte Backtrace fÃ¼hrte von `PushService::tick()` Ã¼ber
`ESPWebPush::allocateItem()` bis in den `std::string`-Konstruktor von
`PushMessage`. Ursache war `cfg.queueMemory = WebPushQueueMemory::Internal`: das
mappt auf `MALLOC_CAP_INTERNAL`, was â€žnicht PSRAM" bedeutet und deshalb **IRAM
einschlieÃŸt** â€” und IRAM erlaubt nur 32-Bit-Zugriffe. Auf dem esp32dev war der
DRAM knapp genug, dass `heap_caps_malloc` das Queue-Item dorthin legte; der
byteweise Zugriff des `std::string` lÃ¶ste den Panic aus. Auf dem S3 (PSRAM, mehr
freier DRAM) trat es nie auf.

**Umsetzung:** `WebPushQueueMemory::Any` (= `MALLOC_CAP_DEFAULT`, byte-adressierbar;
auf Boards ohne PSRAM ohnehin interner Speicher). Dazu im Test-Pfad von `tick()`
derselbe `initialized_`-Guard, den `send()` schon hatte â€” ohne ihn wÃ¼rde ein Test
auf einem nicht gestarteten Dienst in eine uninitialisierte Queue greifen.

**Verifikation:** Am esp32dev geflasht â€” `POST /api/push/test` antwortet `204` in
0,22 s, seriell 15 s lang keine Ausgabe (kein Crash), `lastError` leer.
## 2026-09-10 â€” Fix: neues GerÃ¤t entzog den anderen ihr Push-Abo

**Symptom:** Nach dem Einrichten des frisch geflashten esp32dev kamen auf dem PC
keine Meldungen des S3 mehr an â€” und umgekehrt hÃ¤tte ein erneutes Einrichten des
S3 das esp32dev stillgelegt. Ping-Pong zwischen zwei Boards.

**Root Cause:** Die Bootstrap-Seite speicherte ihr Keypair nur, wenn sie es
*selbst erzeugt* hatte. Abonnierte sie mit einem per `?k=` gelieferten GerÃ¤tekey
(seit dem Fix vom selben Tag der Normalfall), blieb im localStorage der alte
Eintrag stehen. Kam danach ein GerÃ¤t **ohne** eigenen Key â€” frisch geflasht oder
zurÃ¼ckgesetzt â€”, fiel die Seite auf diesen veralteten Key zurÃ¼ck; das bestehende
Abo ist aber fest an den Key gebunden, mit dem es angelegt wurde, also musste sie
ab- und neu anmelden. Damit war genau das Abo entwertet, das auf den anderen
GerÃ¤ten in NVS lag.

Der Browser kann das nicht allein auflÃ¶sen: Die private HÃ¤lfte existiert nur auf
den GerÃ¤ten, und die Seite kann beim Besuch von GerÃ¤t B nicht GerÃ¤t A fragen.

**Umsetzung:** Das GerÃ¤t reicht sein vollstÃ¤ndiges Keypair selbst weiter. Neu ist
`GET /api/push/keypair` â€” die einzige Leseroute neben `GET /api/backup` mit
`requireAuth()`, weil sie den privaten SchlÃ¼ssel herausgibt. Die SPA hÃ¤ngt ihn
beim Weiterleiten als **Fragment** (`#pk=â€¦`) an die Bootstrap-URL, nie als
Query-Parameter: Fragmente werden nicht an den Server geschickt, landen also
nicht in GitHubs Logs. Die Seite liest ihn, entfernt ihn sofort per
`history.replaceState` aus der Adressleiste und legt das vollstÃ¤ndige Paar in
ihren localStorage. Damit ist deren Kopie nie veraltet, und Reihenfolge wie
Browserwahl beim Einrichten sind egal. Ein Key ohne private HÃ¤lfte wird bewusst
**nicht** gespeichert â€” ein halbes Paar wÃ¤re schlimmer als keins.

**Verifikation:** Beide Boards auf `a95de04-dirty` geflasht,
`GET /api/push/keypair` liefert auf beiden 43 Zeichen base64url (32-Byte-Skalar).
Bootstrap-Logik lokal gegen `http://localhost` geprÃ¼ft: Fragment wird gelesen,
verschwindet sofort aus der URL, das vollstÃ¤ndige Paar landet im localStorage â€”
und ein GerÃ¤tekey *ohne* private HÃ¤lfte wird korrekt nicht gespeichert.

Nach dem Merge am GerÃ¤t bestÃ¤tigt: beide Boards tragen denselben VAPID-Key und
beide dieselben zwei Abos (Windows-Desktop und FCM/Handy), Meldungen kommen von
beiden GerÃ¤ten auf beiden Browsern an. Damit ist auch die Kernannahme des
Ein-Keypair-pro-Installation-Designs belegt â€” ein Abo pro Browser bedient
beliebig viele GerÃ¤te â€”, und der entsprechende Verifikationspunkt fÃ¤llt aus
PLAN.md heraus. Einmalig war dafÃ¼r noch das ZurÃ¼cksetzen beider Boards nÃ¶tig,
weil die divergierten Keys aus der Zeit vor dem Fix stammten; der Fix rÃ¤umt
Bestehendes nicht rÃ¼ckwirkend auf.


## 2026-09-10 â€” PWA-GrundgerÃ¼st: Home-Screen-Start ohne Adressleiste

Ziel: das Dashboard am Kessel vom Home-Screen starten, ohne Browser-Adressleiste.

**Randbedingung:** Die Firmware liefert Klartext-HTTP; `http://<ip>` bzw.
`<host>.local` ist kein Secure Context. Der moderne Weg (Manifest +
`display: standalone` â†’ WebAPK auf Android) ist genau darauf gated, und ein
Service Worker registriert sich dort ebenfalls nicht â€” dieselbe Wand wie beim
Push (siehe PLAN.md, HTTPS-Support). iOS dagegen prÃ¼ft fÃ¼r Home-Screen-Apps
kein HTTPS: `apple-mobile-web-app-capable` plus Manifest genÃ¼gen.

**Umsetzung:** Neues `web/public/` (gab es bisher nicht) mit `manifest.json`
und den vier Icons aus `push-bootstrap/` â€” kopiert, nicht verlinkt, weil das
GerÃ¤t im Brau-Netz kein Internet hat. Bewusst `.json` statt `.webmanifest`:
die MIME-Tabelle von ESPAsyncWebServer (`_setContentTypeFromPath`) kennt
`.webmanifest` nicht und lieferte `application/octet-stream`. `index.html`
bekommt Manifest-Link, `theme-color`, `mobile-web-app-capable`, die drei
`apple-*`-Tags und die Icon-Links. `black-translucent` und
`viewport-fit=cover` bewusst ausgelassen â€” beide schieben den Inhalt unter die
Statusleiste und verlangen dann `env(safe-area-inset-*)`-Padding, das es in
`styles.css` nirgends gibt. Keine Firmware-, keine API-Ã„nderung.

**Verifikation:** Manifest im Browser geladen und geparst
(`Content-Type: application/json`, alle drei Icon-EintrÃ¤ge plus
apple-touch-icon und SVG-Favicon mit 200). Build und gzip-Roundtrip geprÃ¼ft,
`firmware/data/www/` neu bestÃ¼ckt: 105,5 KB gz gegen 256 KB Partition, die
Icons kosten davon ~8 KB. Der eigentliche Test steht am Handy aus und liegt als
Verifikationspunkt in PLAN.md â€” offen ist vor allem, ob Chrome den Legacy-Pfad
`mobile-web-app-capable` (VorgÃ¤nger des Manifests, Chrome 31â€“38, seither
deprecated) heute noch bedient. Falls nicht, bliebe als Android-Weg ohne HTTPS
ein Vollbild-Button Ã¼ber die Fullscreen-API: die braucht keinen Secure Context,
aber eine transient activation, also einen echten Tap pro Sitzung.

**Nachtrag â€” Android:** Am GerÃ¤t bestÃ¤tigt, dass Chrome den Legacy-Pfad nicht
mehr bedient: â€žZum Startbildschirm hinzufÃ¼gen" Ã¶ffnet die SPA weiterhin mit
sichtbarer Adressleiste, `mobile-web-app-capable` allein trÃ¤gt also nicht mehr.
Der Tag bleibt trotzdem drin â€” er kostet nichts und ist fÃ¼r Chromium-Forks noch
relevant. Als Ersatz gibt es jetzt einen Vollbild-Schalter in `NavShell.tsx`,
platziert in der ohnehin nur mobil sichtbaren Kopfleiste (`md:hidden`), rechts
neben dem Hamburger. Er ruft `requestFullscreen()` auf dem Wurzelelement auf:
kein Secure Context nÃ¶tig, dafÃ¼r eine transient activation â€” deshalb ein Button
und kein Aufruf beim Laden. Ein `fullscreenchange`-Listener hÃ¤lt Icon und
Tooltip synchron, auch wenn der Modus per Systemgeste verlassen wird.
Gerendert wird der Schalter nur bei `document.fullscreenEnabled`; auf dem
iPhone ist das `false` (Safari erlaubt Fullscreen dort nur fÃ¼r Video), dort
bleibt der Home-Screen-Weg Ã¼ber die `apple-*`-Tags der richtige.

**Verifikation Vollbild-Button:** Der Browser-Pane rendert die Seite in einem
iframe ohne Fullscreen-Permission (`requestFullscreen()` â†’ â€žPermissions check
failed"), der echte Umschaltvorgang lieÃŸ sich dort also nicht auslÃ¶sen. GeprÃ¼ft
wurde stattdessen alles drumherum: Der Schalter erscheint bei 375 px Breite und
verschwindet bei 1280 px mit der Kopfleiste (`display: none`) â€” das Desktop-UI
bleibt unangetastet. Der Zustandspfad wurde direkt getrieben (gefÃ¤lschtes
`fullscreenElement` plus `fullscreenchange`-Event): Tooltip wechselt
â€žVollbild" â†’ â€žVollbild verlassen", Icon `maximize` â†’ `minimize` und beim
ZurÃ¼cksetzen wieder retour. `pnpm typecheck` sauber. Der Test am Handy steht
noch aus (PLAN.md).

**Nachtrag â€” Vollbild Ã¼berlebt den Routenwechsel:** Am Handy fiel der Modus bei
jeder Navigation heraus, in Chrome, Edge *und* Firefox. Ursache ist nicht das
Frontend: gemessen im Dev-Server bleibt ein `window`-Marker Ã¼ber den Klick auf
einen Nav-Link erhalten, `performance.getEntriesByType('navigation')` steht
weiter bei einem Eintrag, `history.length` zÃ¤hlt hoch â€” es findet also keine
Dokument-Navigation statt, die Vollbild spec-konform beenden dÃ¼rfte. Die Engines
steigen schlicht bei `history.pushState()` aus, und genau das ruft
preact-router in `route()` auf. FÃ¼r Chromium ist das als Bug 138324 seit Jahren
offen dokumentiert (â€žthe fix for this is not trivial"), Gecko verhÃ¤lt sich
praktisch genauso.

GegenmaÃŸnahme ist die von Chrome selbst genannte: nach dem Routenwechsel neu
anfordern. `NavShell` merkt sich die Absicht des Nutzers in einem Ref und
stellt in einem `useEffect` auf `[path]` das Vollbild wieder her â€” das lÃ¤uft
Millisekunden nach dem auslÃ¶senden Tap, also innerhalb dessen transient
activation. Wird der Request abgelehnt (ZurÃ¼ck-Taste, dahinter steckt keine
Geste), rÃ¤umt der `catch` die Absicht ab, statt es bei jeder weiteren
Navigation erneut zu probieren. Gewolltes Verlassen â€” Wischgeste, Esc â€” wird
ohne Zeitstempel oder Klick-Listener davon unterschieden: ein
pushState-Austritt landet immer auf einer *neuen* URL, ein gewollter nicht. Der
`fullscreenchange`-Handler lÃ¶scht die Absicht deshalb nur, wenn
`location.pathname` noch dem zuletzt gerenderten Pfad entspricht.

**Verifikation:** Der Browser-Pane verbietet echtes Vollbild (iframe ohne
Permission), also wurde die Engine gestellt â€” gefÃ¤lschtes `fullscreenElement`
plus funktionierendes request/exit, alles andere echte Komponente. Sechs
Schritte durchgespielt: Schalter rein (Icon `minimize`), zweimal navigieren mit
simuliertem Engine-Austritt â†’ bleibt drin und der Pfad wandert korrekt mit,
gewollt verlassen â†’ Absicht fÃ¤llt, danach navigieren â†’ bleibt drauÃŸen.
`pnpm typecheck` sauber. Der Beleg am GerÃ¤t steht aus (PLAN.md).

Offen und bewusst nicht angefasst: die Streifen an Status- und Gestenleiste im
Vollbild (Chrome/Edge oben schwarz, Chrome unten schmal weiÃŸ; Firefox nutzt den
ganzen Schirm). DafÃ¼r brÃ¤uchte es `viewport-fit=cover` plus
`env(safe-area-inset-*)`-Padding an Kopfleiste, Seitenleiste, Scroll-Bereich
und FAB â€” eigener Change, siehe PLAN.md.

**Nachtrag 2 â€” erster Fix trug nicht.** Am esp32dev geflasht, keine Ã„nderung:
Chrome, Edge und Firefox verlassen beim Navigieren weiterhin das Vollbild. Der
Fehler lag in einer Annahme Ã¼ber die Reihenfolge. Der Fix hing an einem
`useEffect` auf `[path]`, also am Re-Render, und setzte voraus, dass die
Engine `fullscreenchange` *davor* feuert. Tut sie das nicht, greifen beide
Zweige daneben: der Effekt sieht noch ein gesetztes `fullscreenElement` und
kehrt frÃ¼h zurÃ¼ck, und der danach eintreffende Handler sieht den bereits
aktualisierten Pfad, hÃ¤lt den Austritt fÃ¼r gewollt und lÃ¶scht die Absicht.

**Neuer Ansatz, ohne Reihenfolgen-Annahme:** Ein Klick-Listener in der
Capture-Phase hÃ¤lt den Zeitpunkt des letzten Taps fest. Der
`fullscreenchange`-Handler reagiert auf den Austritt selbst â€” liegt ein Tap
weniger als 1,5 s zurÃ¼ck, war es die Navigation, und das Vollbild wird per
`setTimeout(â€¦, 0)` neu angefordert (die Engine soll den Austritt erst
abschlieÃŸen); liegt kein Tap vor, war es Wischgeste, Esc oder ZurÃ¼ck-Taste, und
die Absicht fÃ¤llt. Damit ist egal, wann die Engine das Event feuert. Der
`[path]`-Effekt und der Pfad-Vergleich sind entfallen.

**Verifikation:** Wieder mit gestellter Engine (der Browser-Pane verbietet
echtes Vollbild), diesmal beide Reihenfolgen durchgespielt â€” Austritt *vor* dem
Re-Render und Austritt *danach*: in beiden FÃ¤llen bleibt das Vollbild erhalten
und der Pfad wandert korrekt mit. Gewolltes Verlassen nach Ã¼ber 1,5 s ohne Tap
lÃ¶scht die Absicht, anschlieÃŸende Navigation holt nicht zurÃ¼ck. Der
Eintritts-Wechsel von `maximize` auf `minimize` passiert innerhalb von 50 ms.
`pnpm typecheck` sauber.

**Diagnoseseite `web/public/fstest.html`** (temporÃ¤r, wieder entfernen, sobald
das Thema durch ist): unter `/fstest.html` erreichbar, ohne Framework. Sie
schaltet Vollbild ein, lÃ¶st `history.pushState` aus und probiert den
Wiedereintritt in drei Varianten â€” sofort im Handler, `setTimeout(0)`,
`setTimeout(300)` â€”, protokolliert jedes `fullscreenchange` mit Zeitstempel,
zeigt per Microtask, ob das Event vor oder nach dem Rendern kommt, und gibt bei
Ablehnung Name und Meldung des Fehlers aus. Falls der neue Ansatz am GerÃ¤t
ebenfalls nicht trÃ¤gt, liefert die Seite die Antwort, statt weiter zu raten.

**Nachtrag 3 â€” die Ursache ist nicht `pushState`.** Entscheidende Beobachtung
vom GerÃ¤t: zwischen den *Settings-Unterseiten* bleibt das Vollbild erhalten, nur
zwischen den drei Hauptbereichen (Dashboard / Profile / Einstellungen) bricht es
weg. Beide Wege laufen Ã¼ber dieselbe Mechanik â€” `<a href>`, von preact-router
abgefangen, `history.pushState`. WÃ¤re pushState der AuslÃ¶ser, mÃ¼ssten beide
scheitern. Damit ist die bisherige Diagnose hinfÃ¤llig, und der zweite Fix
adressiert etwas, das gar nicht das Problem ist.

Weiter eingegrenzt, beides ausgeschlossen:
- **Bildschirmkante:** Das Vollbild Ã¼berlebt das Antippen des MenÃ¼-Buttons oben
  links und bricht erst beim Antippen des Ziels â€” die obere Kante ist es also
  nicht.
- **Echte Dokument-Navigation:** Der frÃ¼here Marker-Test lief mit geschlossener
  Seitenleiste, also ohne das `setMobileOpen(false)` der Nav-EintrÃ¤ge.
  Nachgeholt mit *offener* Leiste: der Klick wird weiterhin abgefangen
  (`defaultPrevented === true`), der `window`-Marker Ã¼berlebt,
  `performance.getEntriesByType('navigation')` bleibt bei einem Eintrag. Es
  lÃ¤dt also nichts neu.

Ãœbrig bleibt als Unterschied, dass ein Nav-Eintrag zusÃ¤tzlich
`setMobileOpen(false)` auslÃ¶st und damit das Overlay-`div` aus dem DOM
entfernt, wÃ¤hrend die Karten in den Einstellungen nichts am Zustand Ã¤ndern. Ob
das der AuslÃ¶ser ist, lÃ¤sst sich lokal nicht klÃ¤ren: der Browser-Pane rendert in
einem iframe ohne Fullscreen-Permission, echtes Vollbild ist dort nicht
auslÃ¶sbar.

**Deshalb Messung statt weiterer Vermutung:** `web/src/fsdebug.ts` (temporÃ¤r,
zusammen mit dem Aufruf in `main.tsx` wieder zu entfernen) schneidet Ereignisse
mit Zeitstempel mit â€” Klicks samt Ziel, `history.pushState` inklusive des
Zustands davor/danach/im Microtask, `fullscreenchange`, `fullscreenerror`,
`popstate`, `resize`, `visibilitychange`, `pagehide`. Anzeige in einem
eingeblendeten Panel mit Kopier-Knopf. Aktiv nur bei `?fsdebug=1` in der URL,
der Normalbetrieb bleibt unberÃ¼hrt. Lokal verifiziert: Klick-, pushState- und
Microtask-Zeilen erscheinen in der erwarteten Reihenfolge.

**Nachtrag 4 â€” Verdacht auf echten Dokument-Load.** NÃ¤chste Eingrenzung am
GerÃ¤t: vom Dashboard *weg* (zu Profilen, zu den Einstellungen) hÃ¤lt das
Vollbild, nur *zum* Dashboard hin bricht es â€” und dabei verschwindet auch die
Debug-Ausgabe. Das ist der eigentliche Hinweis: Das Panel hÃ¤ngt direkt an
`document.body`, auÃŸerhalb von `#app`; preact rendert nur in `#app` und kann
es gar nicht entfernen. Ist es weg, wurde das Dokument neu geladen â€” und beim
Neuladen von `/` fÃ¤llt `?fsdebug=1` aus der URL, weshalb es sich nicht wieder
installiert. Ein echter Dokument-Load beendet Vollbild spec-konform, in jeder
Engine, und erklÃ¤rt damit alle drei Browser auf einen Schlag.

Lokal ist das **nicht** reproduzierbar: mit offener Seitenleiste geprÃ¼ft, sowohl
`href="/profiles"` als auch `href="/"` werden abgefangen
(`defaultPrevented === true`), Marker Ã¼berlebt, ein Navigation-Entry. Das GerÃ¤t
verhÃ¤lt sich hier also anders als der Dev-Server, und die Ursache dafÃ¼r ist noch
offen.

**Mitschnitt reload-fest gemacht:** `fsdebug.ts` wird jetzt Ã¼ber `?fsdebug=1`
scharf geschaltet und merkt sich das plus das Protokoll in `localStorage`
(`?fsdebug=0` schaltet ab und rÃ¤umt auf). Nach einem Neuladen kommt das Panel
mit der bisherigen Historie zurÃ¼ck und schreibt eine Zeile
`=== DOKUMENT-START <url> typ=<navigate|reload|back_forward> ===`; dazu
kommen `beforeunload`/`pagehide` und eine PrÃ¼fung, ob das Panel aus dem DOM
entfernt wurde (unterscheidet DOM-Entfernung von Neuladen). Lokal verifiziert:
nach einem erzwungenen Load steht genau die Abfolge
`!! beforeunload` â†’ `!! pagehide` â†’ `=== DOKUMENT-START / typ=navigate ===`
im Protokoll.

**Nachtrag 5 â€” es war nie ein Fullscreen-Problem, sondern die Klick-Delegation.**
Der Mitschnitt vom GerÃ¤t zeigt beim Dashboard-Link genau das, was fehlt:

```
73598  CLICK  a href=/        fs=html
73603  !! beforeunload â€” Dokument wird verlassen
73643  !! pagehide
     0  === DOKUMENT-START  /  typ=navigate ===
```

Bei `/settings` und `/settings/security` steht dazwischen jeweils eine
`pushState`-Zeile, beim Dashboard-Link nicht. preact-router hat den Klick also
nicht genommen, der Browser hat den Link normal ausgefÃ¼hrt â€” echter
Dokument-Load, SPA neu gestartet, Vollbild spec-konform beendet. Das erklÃ¤rt
alle drei Engines und auch, warum das Debug-Panel verschwand: es hÃ¤ngt an
`document.body` und war nach dem Load schlicht neu, ohne `?fsdebug=1` in der
URL gar nicht mehr aktiv.

preact-router nimmt Links Ã¼ber einen delegierten Click-Listener auf
`document`. Warum der auf dem GerÃ¤t ausgerechnet `href="/"` durchrutschen
lieÃŸ, ist offen â€” lokal ist es nicht reproduzierbar, dort wird derselbe Link
abgefangen und `exec('/', '/', {})` liefert einen Treffer. Statt weiter nach
dem Warum zu suchen, nimmt die Seitenleiste die AbhÃ¤ngigkeit jetzt heraus: der
`onClick` der Nav-EintrÃ¤ge ruft selbst `route(href)` auf, mit
`preventDefault()` und `stopPropagation()` â€” Letzteres, weil sonst die
Delegation zusÃ¤tzlich greift und ein zweiter, identischer History-Eintrag
entsteht (im Protokoll als doppelte `pushState`-Zeile aufgefallen, bevor es
gefixt war). Modifier-Klicks und Mittelklick bleiben unangetastet, damit
â€žin neuem Tab Ã¶ffnen" weiter funktioniert.

**Verifikation:** Drei SprÃ¼nge Ã¼ber die Seitenleiste (Dashboard â†’ Profile â†’
Einstellungen) bei geÃ¶ffneter mobiler Leiste: `history.length` wÃ¤chst um genau
3, also ein Eintrag pro Sprung und keine Dubletten; `window`-Marker Ã¼berlebt,
`performance.getEntriesByType('navigation')` bleibt bei einem Eintrag, im
Protokoll steht je Sprung genau eine `pushState`-Zeile und `abgefangen=JA`.
`pnpm typecheck` sauber.

Zwei Korrekturen an der Messung selbst, die dabei nÃ¶tig waren: Der
Kopier-Knopf funktionierte am GerÃ¤t nicht, weil `navigator.clipboard` nur im
Secure Context existiert â€” jetzt mit `execCommand`-Fallback. Und die Zeile
`abgefangen=` kam aus einem zweiten Listener auf `document`, den
preact-router per `stopImmediatePropagation()` gerade dann verschluckt, wenn
es den Klick nimmt; sie wird jetzt verzÃ¶gert aus dem Capture-Handler gelesen.

**BestÃ¤tigt und aufgerÃ¤umt.** Am GerÃ¤t geprÃ¼ft: Vollbild bleibt beim Wechsel
zwischen Dashboard, Profilen und Einstellungen erhalten. Damit ist der
Dokument-Load weg und die Seitenleiste routet zuverlÃ¤ssig selbst.

Wieder entfernt: `src/fsdebug.ts` samt Aufruf in `main.tsx` und
`public/fstest.html`.

Ebenfalls entfernt â€” und das ist die eigentliche Lehre aus der Runde: die
Wiedereintritts-Mechanik im Vollbild-Schalter (Tap-Zeitstempel, 1,5-s-Fenster,
erneutes `requestFullscreen()` nach dem Austritt). Sie war fÃ¼r die falsche
Ursache gebaut. Der Mitschnitt belegt bei `/settings â†’ /settings/security`
`pushState` mit durchgehend `fs=html`: client-seitiges Routing beendet das
Vollbild in keiner der drei Engines. Die Mechanik hat also nie etwas bewirkt und
hÃ¤tte nur so ausgesehen, als sei sie nÃ¶tig. ZurÃ¼ck bleibt der schlichte
Schalter plus ein `fullscreenchange`-Listener, der Icon und Tooltip fÃ¼hrt.

RÃ¼ckblickend gingen zwei Fix-Runden fÃ¼r eine Ursache drauf, die aus einer
plausiblen, aber ungeprÃ¼ften Annahme stammte (Chromium-Bug 138324, â€žpushState
beendet Vollbild"). Widerlegt hat sie erst eine Beobachtung vom GerÃ¤t â€” dass
Settings-Unterseiten den Modus halten, obwohl sie denselben Mechanismus nutzen.
Der Weg dorthin war jedes Mal Messung statt Argument: Marker-Test gegen
Dokument-Load, Ereignis-Mitschnitt mit Zeitstempeln, `exec()` des Routers
direkt befragt.

**Verifikation nach dem AufrÃ¤umen:** Kein Debug-Panel mehr im DOM, Schalter
kippt in beide Richtungen (`maximize` â†” `minimize`), drei SprÃ¼nge Ã¼ber die
Seitenleiste ergeben genau drei History-EintrÃ¤ge, Marker Ã¼berlebt, ein
Navigation-Entry. `pnpm typecheck` sauber. Auslieferung: 105,8 KB gz gegen
256 KB Partition.

## 2026-09-10 â€” Safe-Area-Padding: Vollbild ohne Rand-Streifen

Nachdem der Vollbild-Schalter am GerÃ¤t trug, blieb der kosmetische Rest aus
PLAN.md: unter Chrome und Edge stand oben der Bereich der Statusleiste schwarz,
unter Chrome zusÃ¤tzlich unten ein schmaler weiÃŸer Balken. Ursache ist kein
Fehler im Layout, sondern eine fehlende Erlaubnis â€” ohne `viewport-fit=cover`
schneidet die Engine das Layout-Viewport an den Systemleisten ab und fÃ¼llt den
Rest selbst. Die Meta-Angabe in `index.html` ist jetzt gesetzt; damit reicht die
Seite unter die Leisten und muss ihre Inhalte selbst davon freihalten.

Die vier Insets liegen als `--safe-t/-r/-b/-l` in `styles.css` statt als
`env()` direkt an den Utilities. Das kostet eine Indirektion, kauft aber genau
das, woran die Vollbild-Runde davor gescheitert war: die RandfÃ¤lle sind ohne
GerÃ¤t mit Kerbe messbar, indem man die Variablen Ã¼berschreibt. Dazu `html {
background: var(--bg) }` â€” mit `viewport-fit=cover` endet das Layout nicht mehr
an der Gestenleiste, und ohne gestrichene FlÃ¤che bleibt der Streifen darunter
weiÃŸ.

Gepolstert wird nur, was an einer Bildschirmkante klebt, und jede Kante genau
einmal. Die Seitenleiste trÃ¤gt alle drei Kanten selbst (als Ã¼berlagernde
Schublade wie als statische Leiste ist sie das Ã¤uÃŸerste Element). Der
Scroll-Bereich bekommt unten und rechts, links dagegen nur unterhalb von `md:` â€”
darÃ¼ber liegt die Leiste links von ihm und hat den Rand schon abgedeckt. Die
Kopfleiste wÃ¤chst um den oberen Inset (`h-[calc(3rem+var(--safe-t))]` plus
`pt`), bleibt also randlos unter der Statusleiste liegen, wÃ¤hrend ihre Icons
darunter rutschen. Dazu die vier freistehenden Overlays, die keine Polsterung
von auÃŸen sehen kÃ¶nnen: FAB und Speed-Dial, der Toast-Stapel, das
Meldungs-Panel und das mobile Programm-Bottom-Sheet.

Bewusst ausgelassen: die Dialoge (`fixed inset-0` mit zentriertem Inhalt und
`p-4`) â€” zentrierter Inhalt gerÃ¤t nicht unter eine Systemleiste.

**Verifikation** mit gefÃ¤lschten Insets im Browser (48 px oben, 24 px unten):
Kopfleiste 96 px hoch bei 48 px `padding-top`, das MenÃ¼-Icon beginnt bei y=54 â€”
also sauber mittig im 48-px-Streifen darunter. Seitenleiste offen: oberster
Eintrag bei y=56, unterster mit 32 px Luft nach unten. Scroll-Bereich ganz nach
unten gefahren: 24 px zwischen Inhaltsende und Viewport-Unterkante, Chrome
rechnet die Polsterung des Scroll-Containers also mit. Quer (812Ã—375, 44 px
seitlich): Leiste links um 44 px eingerÃ¼ckt, Scroll-Bereich links bei 0 und
rechts um 44 px â€” kein doppelter Rand. Die vier Overlay-Klassen einzeln
gemessen: FAB `bottom: 44px` / `right: 36px`, Toast 40/32, Panel `pt 48 / pb 24
/ pr 16`, Sheet `pb 40`.

Der wichtigste Beleg ist der Gegentest: mit echtem `env()` im normalen Tab
lÃ¶sen alle vier Variablen zu `0px` auf, sÃ¤mtliche Polsterungen stehen auf 0 und
die Kopfleiste ist wieder 48 px hoch. AuÃŸerhalb von Vollbild und
Home-Screen-Fenster Ã¤ndert sich nichts. `pnpm typecheck` sauber, `pnpm build`
durch, die erzeugten Regeln stehen im gebauten CSS (Tailwind normalisiert
`calc(1.25rem+â€¦)` selbst auf gÃ¼ltige AbstÃ¤nde). Der Beleg am GerÃ¤t steht aus
(PLAN.md).

## 2026-09-10 â€” Sensorgetriggerte Programm-Schritte

Backlog-Punkt aus PLAN.md: ein Schritt endete bisher nur Ã¼ber `holdSec` (Zeit).
Jetzt trÃ¤gt jeder Schritt einen wÃ¤hlbaren AuslÃ¶ser â€” `end: "hold"` (Default,
weggelassen) oder `end: "sensor"` mit einer `Condition` `{ref, op, value, hyst}`
aus `Condition.h` (unverÃ¤ndert von `AlarmStore`/`LogStore` Ã¼bernommen: gleiche
`conditionFromJson`/`conditionToJson`/`evalCondition` mit Hysterese-Latch). Bei
`sensor` schaltet der Schritt automatisch weiter, sobald der Latch steigt;
`holdSec` wird dann ignoriert. Der Latch (`Step::condActive`) ist Laufzeit, nicht
persistiert, und wird bei jedem Schrittwechsel zurÃ¼ckgesetzt (`resetLatches_`).

Die â€žFreigabe abwarten"-Checkbox (`confirm`) bleibt unverÃ¤ndert und orthogonal:
sie greift nach dem AuslÃ¶sen beider Trigger â€” `hold` + `confirm` ist exakt das
alte Verhalten, `sensor` + `confirm` wartet nach Erreichen der Bedingung auf
`next`. Kein Sicherheits-Timeout fÃ¼r Sensor-Schritte (unbegrenztes Warten,
`next`/`stop` bleiben verfÃ¼gbar). Keine Migration: `end` fehlt in Altdateien â†’
`hold`; Ã¤ltere Firmware auf einer neuen `programs.json` behandelt
`sensor`-Schritte als `hold`.

`ProgramRunner::tick` verzweigt die â€žSchritt fertig?"-PrÃ¼fung nach `end`, sonst
Struktur gleich. Frontend: neue `ProgramStep.end`/`cond`-Felder; die
`{ref, op, value, hyst}`-Form ist als `components/ConditionFields.tsx` aus dem
Alarm-Editor herausgezogen (`refGroups`/`unitOf` nun in `src/refs.ts`, auch vom
Log-Editor genutzt), fÃ¤llt ohne Snapshot auf ein Freitext-Ref zurÃ¼ck (Profil-
Bibliothek hat keinen SSE-Feed). Programm- und Profil-Schritt-Editor bekommen je
ein Segmented â€žZeit / Sensor"; `ProgramCard` zeigt fÃ¼r den aktiven Sensor-Schritt
Ziel + Bedingung + Live-Istwert (`resolveRef`) statt Countdown und lÃ¤sst
Sensor-Schritte aus der Fortschrittsbalken-Rechnung.

**Verifikation:** `pio run -e esp32dev` grÃ¼n, `redocly lint` ohne neue Fehler,
`pnpm typecheck`/`pnpm build` grÃ¼n. E2E am echten GÃ¤rlauf steht aus (PLAN.md â†’
Hardware-Verifikation).

**Nachtrag (Nutzer-Feedback):** Firmware + UI auf `brewcontrol.local`
(LilyGo-S3, COM9) geflasht â€” bestehendes Programm lÃ¤dt unverÃ¤ndert (Back-Compat
bestÃ¤tigt), Programm-Editor zeigt das Sensor-Dropdown live. Danach auffiel:
die Profil-Seite (`/profiles`) zeigte fÃ¼r dieselbe `ConditionFields`-Komponente
nur ein Freitext-Ref-Feld statt des Dropdowns. Ursache war kein Komponenten-
Unterschied, sondern fehlende Prop-Weitergabe â€” `App()` (`app.tsx`) hÃ¤lt den
Live-`Snapshot` und reicht ihn an `Dashboard`/`DevicesPage`/`LogsPage`/
`AlarmsPage` durch, `ProfilesPage` fehlte dabei. ErgÃ¤nzt (`app.tsx`,
`ProfilesPage.tsx`); `ProfileEditorModal`/`ConditionFields` brauchten keine
Ã„nderung. `pnpm typecheck`/`pnpm build` grÃ¼n, per `pnpm dev` gegen
`brewcontrol.local` (`VITE_ESP_HOST` braucht das Schema, `http://â€¦`, sonst
`ENOTFOUND base.invalid`) verifiziert: Profil-Editor zeigt jetzt dasselbe
Dropdown wie der Programm-Editor.

## 2026-09-11 â€” Multi-Regler-Programme

Backlog-Punkt aus PLAN.md: ein Programmschritt steuert jetzt beliebig viele
Regler und Aktoren statt genau eines Reglers. Das Datenmodell ist in mehreren
Runden mit dem User entstanden (erst feste Spalten, dann Aktoren als Spalten,
am Ende die Map pro Schritt): `targets: {id: befehl}` nennt nur, was der
Schritt Ã¤ndert, alles andere bleibt unverÃ¤ndert. Der Befehl ist **pro Feld**
`{v?, enabled?, interval?}` â€” dieselben Felder wie `POST /api/actuators/<id>`;
Anlass war ein GÃ¤rtank-RÃ¼hrer, bei dem ein Programm Schalter, Drehzahl und
Intervall einzeln verstellen kÃ¶nnen soll. Weitere Entscheidungen: Aktoren
wirken nur bei Schrittbeginn (eine Hopfengabe bei Minute 30 heiÃŸt Schritt
teilen), kein implizites Einschalten mehr (der Editor setzt â€žEin" beim ersten
Wert in einer leeren Zelle vor), Profile sind eine komplette Vorlage inklusive
Ids (kehrt die Entscheidung vom 04.09. um), Haltezeit wÃ¤hlbar in min/h/d. Ids
sind gerÃ¤teweit eindeutig (`DynamicItems.cpp:44`), deshalb braucht es keinen
Rollen-PrÃ¤fix; der Runner lÃ¶st per `findController`, sonst `findActuator` auf.

**Laufzeit.** VorwÃ¤rts (`start`, `next`, Auto-Advance durch Zeit oder Sensor)
setzt nur die eigene Map des Schritts. `prev` und Boot-Resume dagegen stellen
den **zusammengesetzten Stand** der Schritte 0â€¦k her â€” pro Id und pro Feld der
letzte Wert â€”, sonst bliebe nach â€žZurÃ¼ck" stehen, was der spÃ¤tere Schritt
geÃ¤ndert hat. Grenze: Werte, die das Programm erst spÃ¤ter setzt, kann `prev`
nicht auf den Stand vor dem Programm zurÃ¼ckholen. Ausnahme Pulse-Aktoren
(`ValueKind::Discrete`, `write(N)` hÃ¤ngt N Impulse an): deren `v` ist ein
Ereignis, feuert nur beim ersten VorwÃ¤rts-Eintritt pro Lauf (`reachedStep`,
persistiert) und wird nie wiederholt â€” Hopfen lÃ¤sst sich nicht zurÃ¼ckholen.
Fehlt eine Id, wartet das Programm wie bisher beim fehlenden Regler; der Scan
Ã¼ber alle Ziele lÃ¤uft aber erst, wenn ein Schritt fÃ¤llig ist, weil `tick()` in
jeder Loop-Runde aufgerufen wird.

**Firmware.** Neu `ProgramTargets.h` (header-only, nur ArduinoJson + std,
damit nativ testbar: `readTargets` inkl. Legacy-`setpoint`, `writeTargets`,
`effectiveTargets`) und `ProgramSteps.h/.cpp` (der geteilte Step fÃ¼r
`ProgramRunner` und `ProfileStore` inkl. `end`/`cond`). `ProgramRunner`:
`controller`, `EndMode` und `currentSetpoint` raus, `reachedStep` und
`condActive` rein â€” der Sensor-Latch aus PR #35 zieht vom Step ans Programm,
weil der Step-Struct jetzt geteilt ist und ohnehin nur der aktuelle Schritt
ausgewertet wird. Neue Pfade `applyCmd_` (Feldreihenfolge des
Actuator-Endpoints: `enabled`, `interval`, `v`; bei Reglern wie bisher erst
Sollwert, dann Schalter), `enterStep_`, `applyState_`. Legacy wird gelesen,
geschrieben wird nur das neue Format: `controller` + `setpoint` â†’
`{x: {v, enabled: true}}` (genau das alte Verhalten, `start` schaltete den
Regler immer ein), alte Profile ohne Regler â†’ Id `""`, im Programm abgelehnt,
im Profil erlaubt.

**Dabei gefunden und mitbehoben (aus PR #35):** `ProfileStore` kannte
`end`/`cond` nicht und verwarf sie. Ein Sensor-Schritt kam deshalb aus der
Bibliothek als Zeit-Schritt mit `holdSec` 0 zurÃ¼ck und hÃ¤tte in einem
Programm sofort weitergeschaltet. Root Cause: zwei getrennte Step-Structs,
PR #35 hatte nur den im Runner erweitert. Mit dem geteilten Step ist das
strukturell ausgeschlossen.

**API/Doku.** `openapi.yaml`: neues Schema `StepTarget` (verweist auf
`ActuatorWrite`), `ProgramStep.targets`, `Program.reachedStep`,
`ProgramInput` ohne `controller`, Legacy-Toleranz dokumentiert. Nebenbei die
Doku-Drift aus PLAN.md behoben: eigener Pfad-Parameter `ProgramId`
(`^p_[0-9a-f]{5}$`) statt `HexId` fÃ¼r `/api/programs/{id}` und `/control`,
Create-Response und `Program.id` angeglichen, `currentStep` â€ž0 while idle".

**Frontend.** Neu `src/program.ts` (`targetKind`, `effectiveTargets` als
Spiegel der Firmware-Regel, `fmtTarget`, `HoldUnit` nach dem Muster von
`intervalUnit.ts`) und `components/ProgramStepsEditor.tsx`, der die zwei
duplizierten Schritt-Editoren aus Programm- und Profil-Dialog ersetzt (inkl.
Zeit/Sensor aus PR #35): Spaltenkopf â€žSteuert" mit Reglern und Aktoren â€”
Aktoren, die ein Regler als `actuator`/`heatActuator`/`coolActuator` treibt,
waren zunÃ¤chst ausgeblendet (siehe Nachtrag) â€”, pro Zelle Schalter â€žâ€”/Ein/Aus", Wert mit Einheit
(Binary ohne, Pulse als â€žImpulse") und bei Intervall-Aktoren â€žan â€¦ von â€¦".
`draftProblem()` sagt im Dialog, warum Speichern gesperrt ist. `ProgramCard`
zeigt statt `setpointÂ°` den zusammengesetzten Stand als Chips (vom Schritt
selbst gesetzt hervorgehoben, geerbt neutral), Impulse mit âœ“ sobald gefeuert,
im Kopf â€žSteuert: â€¦" mit fehlenden Ids. `fmtDuration` ab 24 h als â€ž5 d 03:00",
das trifft auch die Summen auf der Profilseite. `refs.ts` `unitOf` lÃ¶st jetzt
auch `controller/<id>` Ã¼ber den Sensor des Reglers auf.

**Verifikation.** `pio test -e native` 30/30 (14 neue in
`test_program_targets`: Befehle mit einzelnen/allen Feldern, Reihenfolge,
Legacy mit/ohne Controller, verworfene Werte, kaputtes Intervall,
Round-Trip, zusammengesetzter Stand pro Feld inkl. Impuls-Ausnahme); dafÃ¼r
bekam `[env:native]` ArduinoJson. `pio run` fÃ¼r `esp32dev` und
`lilygo_t_display_s3_amoled` grÃ¼n, ohne Warnungen in den geÃ¤nderten Dateien.
Redocly valide (nur die bekannte `license`-Warnung), `pnpm typecheck` und
`pnpm build` grÃ¼n. UI im Dev-Server gegen In-Page-Stubs fÃ¼r Snapshot,
Programme und Profile (GÃ¤rtank-Szenario mit zwei Reglern, RÃ¼hrer mit
Intervall, Pulse-Dropper, Binary-Ventil und einer an einen Regler gebundenen
Heizung; nichts ans Board geschrieben): Karte zeigt pro Feld korrekt
zusammengesetzt (Drehzahl aus Schritt 1, Intervall aus Schritt 2), Spalten-
Select blendet belegte Ids und die gebundene Heizung aus, Vorbelegung â€žEin"
greift, leere Spalte sperrt Speichern mit Hinweis, gesendeter Body enthÃ¤lt nur
gesetzte Felder und rechnet Tage in Sekunden um, Legacy-Profil erscheint als
ungebundene Spalte (Programm- und Profil-Dialog), â€žAls Profil speichern"
trÃ¤gt Spalten und Sensor-Schritt mit, Start/Weiter/ZurÃ¼ck setzen die Chips und
das âœ“ wie erwartet; Desktop und 375 px geprÃ¼ft. Dabei aufgefallen:
`` `${inp} w-NN` `` greift projektweit nicht (`w-full` gewinnt), der neue
Editor nutzt `w-20!` â€” in PLAN.md eingetragen.

**HW-E2E** am LilyGo (`brewcontrol.local`, 192.168.178.87), Firmware `df07d50`
und UI-Paket per OTA (`/api/update/firmware` 200 in 12 s, `/api/update/assets`
200 in 6 s), Board-Stand vorher in den Scratchpad gesichert. **Migration:** das
echte Alt-Programm â€žHermann-Weizen" (7 Schritte, Regler `mash`) kam direkt nach
dem Boot als `targets: {"mash": {"enabled": true, "v": â€¦}}` zurÃ¼ck, Umlaute,
`confirm` und `done`-Status erhalten, `reachedStep` = `currentStep`; die zwei
Alt-Profile als `""`-Spalte. Test-Items ohne GPIO als MQTT-Aktoren am
eingebetteten Broker (Relais Binary, RÃ¼hrer Continuous mit Intervall 10/20 s,
`TwoPoint`-Regler auf `mlt` mit eigenem MQTT-Heizaktor). Abgelehnt mit
`400 invalid program`: leere Target-Id, Intervall `onSec > periodSec`. Lauf:
Start schaltet Regler/Relais/RÃ¼hrer ein und setzt 30 bzw. 40 % + 10/20 s;
manuell Sollwert 33, Weiter in den Intervall-Schritt â†’ 33 bleibt, RÃ¼hrer nur
20/20, Drehzahl und Schalter unverÃ¤ndert; ZurÃ¼ck â†’ 30 und 10/20 wieder da;
Weiter â†’ wieder 20/20, 30 bleibt. **Reboot** mitten im Schritt (manuell vorher
33): danach Regler 30 (Config hÃ¤tte 20), Relais an (Binary startet sonst aus),
RÃ¼hrer 40 % + 20/20 (Config 10/20), Restzeit lÃ¤uft auf der Wanduhr weiter.
Sensor-Schritt (`controller/test_regler > 40`) setzt beim Eintritt 35 und
wartet ohne Countdown, Sollwert 45 â†’ schaltet weiter, der End-Schritt schaltet
Relais und RÃ¼hrer aus und lÃ¤sst Drehzahl/Intervall stehen, nach 60 s `done`.
**PR-#35-Fix:** Profil mit Sensor-Schritt (`hyst` 0.002) gespeichert und
zurÃ¼ckgelesen â€” `end`/`cond` vollstÃ¤ndig da, auch nach einem zweiten Reboot,
ebenso die neu geschriebenen `""`-Profile. Die vom Board ausgelieferte UI zeigt
das migrierte Programm (â€žSteuert: mash", â€žmash 35 Â°C" pro Schritt), keine
Konsolenfehler. Testartefakte (Programm, Profil, Regler, drei Aktoren) danach
gelÃ¶scht; die migrierten echten Daten bleiben. **Nicht am GerÃ¤t prÃ¼fbar:** der
Impuls-Pfad â€” `PulseOutput` ist kein dynamischer Aktor-Typ, ein Hopfen-Dropper
lÃ¤sst sich also bisher gar nicht anlegen (PLAN.md â†’ Backlog). Nach einem Reboot
wird ein `done`-Programm wie bisher nicht erneut angewandt.

**Bekannte Grenzen.** Nach einem Downgrade liest alte Firmware das neue
`programs.json` nicht, die Programme fallen weg. Beim Update erst die Firmware,
dann die UI einspielen: die neue UI wirft beim Rendern eines Programms im alten
Format (`step.targets` fehlt) â€” im Test mit dem Alt-Programm des LilyGo
gesehen, bevor die Stubs aktiv waren; die neue Firmware migriert beim Laden.

**Nachtrag (Nutzer-Feedback):** `dfsdfdf` auf dem S3 (AnalogOutput/PWM mit
Intervall) tauchte in der Spaltenauswahl nicht auf â€” der Editor blendete jeden
Aktor aus, den ein Regler treibt (`testpid` hat `actuator: dfsdfdf`), weil der
Regler den Wert sonst Ã¼berschreibt. Das war zu grob: ein Regler schreibt nur
den Wert, Schalter und Intervall fasst er nie an. Nachgelesen in der Library:
PID und TwoPoint lassen ihren Aktor in Ruhe, solange sie aus sind
(`if (!enabled()) return;`), DualStage und SplitRangePID ziehen Heiz-/KÃ¼hlausgang
auch ausgeschaltet jede Runde auf 0 (`writeOff()`). Jetzt bietet der Editor alle
Aktoren an, gesteuerte in einer eigenen Gruppe â€žAktoren (von Regler gesteuert)"
mit dem Reglernamen; die Zelle sagt es dazu â€” bei PID/TwoPoint â€žder Wert wirkt
nur, solange <Regler> aus ist", bei Heiz-/KÃ¼hlausgÃ¤ngen entfÃ¤llt das Wertfeld
(ein schon gespeicherter Wert bleibt sichtbar). `StepTarget` in der OpenAPI um
denselben Satz ergÃ¤nzt. Verifiziert per `pnpm dev` gegen das S3 (neue Firmware,
echte Daten, nichts gespeichert): Auswahl zeigt `kettle (mash)` und
`dfsdfdf (testpid)`, die `dfsdfdf`-Zelle Schalter, PWM-Wert, Intervall und den
Hinweis; `pnpm typecheck` grÃ¼n, Redocly valide. Danach als UI-Paket aufs S3
geladen (`/api/update/assets` 200), Board serviert den neuen Build, Auswahl
und Hinweis am GerÃ¤t bestÃ¤tigt.

**Nachtrag 2026-09-12 â€” Ablaufsteuerung stand einmal still.** Am GerÃ¤t blieb ein
laufendes Programm auf Schritt 1 stehen (60 s Haltezeit, Freigabe eingestellt):
nach 3021 s weiter `running`, kein Schrittwechsel, kein `awaiting`. Nach einem
Reboot lief dasselbe Programm sauber durch alle sieben Schritte und wartete am
Ende korrekt auf die Freigabe. Die Auswertung spricht gegen die Programmlogik
und fÃ¼r einen stehenden loopTask â€” `stepRemainingSec: 0` zeigt eine gÃ¼ltige Uhr
und abgelaufene Haltezeit, und `GET /api/programs` antwortete sofort, obwohl es
denselben Mutex nimmt wie `tick()`. Details, VerdÃ¤chtige und die Messung, die
beim nÃ¤chsten Auftreten **vor** dem Reboot zu machen ist, stehen in PLAN.md â†’
â€žBugs & bekannte EinschrÃ¤nkungen". Auf Wunsch des Users nicht weiterverfolgt.

## 2026-09-12 â€” Pulse-Aktor anlegbar + `inp`-Breiten-Bug gefixt

**Pulse-Aktor.** `PulseOutputActuator` (Library) war zwar Ã¼ber `ValueKind::Discrete`
im `ProgramRunner` schon vollstÃ¤ndig als Impuls-Ziel unterstÃ¼tzt, lieÃŸ sich aber
nirgends anlegen. Jetzt als `PulseOutput`-Typ in
`DynamicItems::addActuatorNoBegin()` verdrahtet (`pin`, `pulse_width_ms`,
`gap_ms`, `invert` â€” snake_case wie die Ã¼brigen Typen; kein neuer Include
nÃ¶tig, `SensActCtrl.h` zieht den Header schon), im `AddItemModal` als
â€žPulse (Hopfen-Dropper)" wÃ¤hlbar (GPIO-Pin, Pulsbreite/Pause in ms,
Invertieren-Checkbox), `docs/openapi.yaml`s `ActuatorCreate` um den Enum-Wert
und die beiden neuen Felder ergÃ¤nzt. Kein Serialisierungs-Sonderfall nÃ¶tig â€”
`DynamicItems` persistiert die rohe Config-JSON verbatim. Verifiziert:
Firmware-Compile-Smoke (`esp32dev`, grÃ¼n), `pnpm typecheck`/`build` grÃ¼n,
Redocly valide (nur die bekannte `license`-Warnung). Am laufenden LilyGo
(`brewcontrol.local`, echtes â€žHermann-Weizen"-Programm currently in Schritt 6,
nicht angefasst) den Dialog geÃ¶ffnet und einen Test-Aktor Ã¼ber den echten
`POST /api/actuators` angelegt â€” sauber mit `400 unknown actuator type`
abgelehnt, wie von der noch nicht geflashten Firmware erwartet, kein
Seiteneffekt. Firmware-Flash + der eigentliche Impuls-Test (â€žv" feuert genau
einmal pro Lauf, nicht nach `prev`/`next`/Reboot) stehen noch aus â€” siehe
PLAN.md â†’ â€žHardware-Verifikation offen".

**Nachtrag â€” HW-Verifikation am LilyGo (2026-09-12).** Firmware
(`lilygo_t_display_s3_amoled`) und UI-Paket per Netzwerk-OTA aufgespielt
(`POST /api/update/firmware` + `/api/update/assets`, beide 200), wÃ¤hrend das
echte â€žHermann-Weizen"-Programm auf Schritt 6 (â€žFreigabe erforderlich") lief â€”
beide Reboots (Firmware-Flash + ein spÃ¤terer Test-Reboot) Ã¼berstand es
unangetastet (`status: awaiting`, `currentStep: 5` vorher/nachher identisch).
Test-Aktor `hop_dropper_test` (GPIO 17, frei â€” Pins 2/9/6/7/3/11 waren durch
bestehende Items belegt) angelegt: `meta.kind` kam korrekt als `"Discrete"`
zurÃ¼ck, direktes `write(20)` per `POST /api/actuators/<id>` zeigte die
Pulse-Queue sauber abzÃ¤hlend von 19 auf 0 draining. Mit einem echten
Test-Programm (eigener Schritt mit `hop_dropper_test.v=4`, dann Reboot mitten
im Schritt) alle drei FÃ¤lle aus PLAN.md bestÃ¤tigt: (1) Eintritt in den
Impuls-Schritt queued die Pulse genau einmal (`target` sprang auf 4, drainte
dann normal), (2) `prev` gefolgt von `next` zurÃ¼ck in denselben (bereits
`reachedStep`) Schritt queued nichts nach (`target` blieb 0), (3) ein Reboot
mitten im Impuls-Schritt (referenceStep 1, `stepRemainingSec` ~3575 von 3600)
resumed korrekt (`stepRemainingSec` lief weiter, kein Sprung) ohne erneuten
Pulse (`target` blieb Ã¼ber mehrere schnelle Polls direkt nach dem Neustart bei
0). Test-Programm und Test-Aktor danach gelÃ¶scht, `GET /api/config` bestÃ¤tigt
den GerÃ¤testand wieder identisch zu vorher. Der Impuls-Pfad der
Multi-Regler-Programme ist damit vollstÃ¤ndig E2E verifiziert â€” kein offener
Punkt aus PLAN.md â€žHardware-Verifikation offen" mehr fÃ¼r diesen Feature-Zweig.

**`inp` `w-full`-Bug.** Die in PLAN.md dokumentierte Ursache (`.w-full` steht
im generierten CSS hinter `.w-20` etc. und gewinnt immer) am FlieÃŸband
behoben: `w-full` aus dem gemeinsamen `inp` (`web/src/ui.ts`) entfernt und an
jeder der ca. 130 Aufrufstellen, die volle Breite brauchen, explizit wieder
angehÃ¤ngt â€” bis auf die Stellen, die ohnehin `flex-1`/`min-w-0 flex-1` nutzen
(Breite kommt dort schon vom Flex-Layout, nicht von `inp`). `AddItemModal.tsx`
definiert `inp` lokal neu (`` `${inpBase} font-mono` ``) â€” dort genÃ¼gte eine
einzige Ã„nderung fÃ¼r alle ~69 Stellen der Datei. Die vorher betroffenen Stellen
(`TimePage` `w-56`/`w-48`, `NetworkPage` `w-40`, `LogEditorModal` `w-20`,
`ProgramEditorModal`s â€žAus Profil befÃ¼llen"-Select `w-48`) greifen jetzt ohne
Ã„nderung an ihrer eigenen Klasse â€” der `ProgramStepsEditor`-Workaround
(`w-NN!`-Suffix) bleibt unangetastet stehen (funktioniert weiterhin, jetzt nur
redundant). Verifiziert: `pnpm typecheck`/`build` grÃ¼n; im Dev-Server gegen den
LilyGo (nur GET-Requests, keine Schreibzugriffe) `TimePage` (Zeitzone/NTP-Server
jetzt kompakt statt zeilenfÃ¼llend), `NetworkPage` (mDNS-Hostname kompakt),
`LogEditorModal` und `ProfileEditorModal`/Programm-Editor (weiterhin
volle Breite, keine Regression) geprÃ¼ft.

## 2026-09-12 â€” Dashboard-UI: vier kleine Fixes

Vier Punkte aus PLAN.md â€žBugs & bekannte EinschrÃ¤nkungen" und Backlog in einer
Session erledigt: (1) Programm-Poll in `Dashboard.tsx` von 2000ms auf 1000ms
(Countdown/Slider springen jetzt sekÃ¼ndlich statt im 2s-Takt). (2)
`ControllerCard.tsx` hielt den Setpoint-Input als lokalen State, der nur beim
Mount initialisiert wurde â€” externe Ã„nderungen (Programm-Schritt setzt neuen
Setpoint, alle 1s per SSE-Snapshot gepusht) kamen nie an, erst ein Seiten-Reload
zeigte den neuen Wert. Fix: `useEffect(() => setSp(setpoint.toString()),
[setpoint])`, analog zum bestehenden Muster in `ActuatorCard.tsx`. (3)
Umbenennen einer Karte (Sensor/Aktor/Regler) lÃ¤uft in `AddItemModal.tsx` als
Delete+Recreate unter neuer ID â€” Dashboards referenzieren Mitgliedschaft aber
Ã¼ber die alte ID-Liste, die Karte verschwand dadurch aus allen Dashboards.
`AddItemModal` meldet jetzt bei ID-Ã„nderung `onRenamed(role, oldId, newId)`;
`Dashboard.tsx` ersetzt die alte ID in jedem Dashboard, das sie referenziert,
und persistiert das per `updateDashboard`. (4) Programm-Widget-Spalte war
schmaler als Sensoren/Regler/Aktoren-Spalten (fixe `w-80` neben einem
`flex-1`-Bereich, der selbst nochmal in 3 Spalten geteilt wurde). Ã„uÃŸerer
Container von Flex-Row auf CSS-Grid umgestellt (`lg:grid-cols-4` mit Programm,
sonst `lg:grid-cols-3`; Inhalt nimmt `lg:col-span-3`) â€” die verschachtelte
3-Spalten-Grid darin ist jetzt exakt so breit wie die Programm-Spalte.
Verifiziert: `pnpm typecheck` grÃ¼n nach jeder Ã„nderung; (2)-(4) nicht live am
GerÃ¤t getestet (kein Dev-Server mit echten Snapshot-Daten in der Session).

## 2026-09-12 â€” BestÃ¤tigungsdialog beim Umschalten fremdgesteuerter Aktoren/Regler

Backlog-Punkt umgesetzt: der Toggle auf Aktor- und Regler-Card schaltete bisher
sofort um, auch wenn ein aktiver Regler oder ein laufendes Programm das Item
gerade steuert â€” der manuelle Vorgang wurde dann im nÃ¤chsten Tick wieder
Ã¼berschrieben, ohne dass die UI das kommunizierte.

**Ownership-Erkennung** (neu, `web/src/ownership.ts`): weder Aktor noch Regler
tragen im Wire-Format einen Besitzer-Verweis â€” `controllerOwnerOf()` scannt
`params.actuator`/`heatActuator`/`coolActuator` aller Regler (gleiche Logik wie
das bestehende `drivenBy` in `ProgramStepsEditor.tsx`, hier isoliert fÃ¼r
Wiederverwendung), `programOwnerOf()` nutzt das vorhandene `programIds()` aus
`program.ts` gegen alle Programme mit Status `running`/`awaiting`/`paused`. Ein
deaktivierter Regler bzw. ein `idle`/`done`-Programm zÃ¤hlt nicht als Besitzer â€”
dann bleibt das Toggle-Verhalten unverÃ¤ndert.

**UI:** `ToggleSwitch` bekommt eine `mixed`-Prop, die den Knopf unabhÃ¤ngig vom
Schaltzustand mittig zeigt (Mittelstellung als Fremdsteuerungs-Indikator, wie
vom User vorgeschlagen). `ConfirmModal` um einen optionalen dritten Button
(`extraLabel`/`onExtra`) erweitert â€” additiv, alle 16 bestehenden binÃ¤ren
Aufrufstellen unverÃ¤ndert. `ActuatorCard`/`ControllerCard`: Toggle-Klick bei
aktivem Besitzer Ã¶ffnet den Dialog statt direkt zu schalten (Abbrechen / nur
schalten / schalten + Besitzer deaktivieren-pausieren â€” Regler via
`enableController(id, false)`, Programm via `controlProgram(id, 'pause')`,
beide Endpoints bereits vorhanden). `Dashboard.tsx` reicht `controllers`/
`programs` an die Cards durch.

**Verifikation:** `pnpm typecheck` grÃ¼n. Live gegen das LilyGo-S3-Testboard
(`brewcontrol.local`) im Browser-Pane: das laufende â€žHermann-Weizen"-Programm
zeigte den Regler `mash` (Programmziel, Status `awaiting`) und den von `mash`
getriebenen Aktor `IDS1` (Controller-Ziel) beide mit Mittelstellung und
korrektem Dialogtext; â€žAbbrechen" Ã¤ndert nichts, â€žAktor schalten" schaltet
`IDS1` ohne den Regler anzufassen (per `aria-checked`/Titel-Attribut
bestÃ¤tigt), danach wieder zurÃ¼ckgeschaltet â€” Board am Ende unverÃ¤ndert.
Ungeteste Aktoren/Regler ohne Besitzer zeigten weiterhin die normale
Links/Rechts-Stellung ohne Dialog.

**Nachtrag (Nutzer-Feedback):** der Extra-Button-Text ("Aktor schalten und
Regler deaktivieren") umbricht in der 3-Spalten-Gleichbreite des
`ConfirmModal`-Footers zu oft â€” Fix noch offen, siehe PLAN.md.

## 2026-09-12 â€” Dashboard: Regler Ã¼ber Programm-Widget, Grid-Reflow, grÃ¶ÃŸerer Chart

Backlog-Punkt â€žSensor-/Aktor-/Controller-Grid: Anordnung Ã¼berarbeiten" umgesetzt,
ausgelÃ¶st durch Nutzer-Feedback: ein einem Programm zugeordneter Regler (z. B.
`mash`, Ziel von â€žHermann-Weizen") stand bisher getrennt vom Programm-Widget
unten im Regler-Grid, obwohl beide zusammengehÃ¶ren.

**`Dashboard.tsx`:** pro Programm wird jetzt der erste Regler, den es
referenziert (`programIds()`-Reihenfolge, wiederverwendet aus `program.ts`),
Ã¼ber statt neben dem zugehÃ¶rigen `ProgramCard` gerendert â€” unabhÃ¤ngig vom
Laufstatus (auch idle/done), nur einmal vergeben falls mehrere Programme
denselben Regler referenzieren. Die bisherige `Column`-Gruppierung
(Sensoren/Regler/Aktoren als drei betitelte Spalten) ist aufgelÃ¶st: ein
einziges Grid rendert alle verbleibenden Karten (Sensoren â†’ restliche Regler â†’
Aktoren) ohne Kategorie-Ãœberschriften/ZÃ¤hler und fÃ¼llt Zeilen horizontal.

**Chart nutzt den Platz, den das aufgelÃ¶ste Grid freigibt:** der
Hauptinhaltsbereich ist auf Desktop (`lg:`) eine Flex-Column mit voller HÃ¶he;
der Chart-Bereich wÃ¤chst per `flex-1`, das Karten-Grid bleibt `shrink-0` und
landet dadurch automatisch am unteren Rand. `ChartCard` bekommt eine neue
`fill`-Prop: ein `ResizeObserver` misst die vom Flex-Layout zugewiesene HÃ¶he
und ruft darÃ¼ber `setSize()` (kein Re-Fetch der Log-Daten bei reinem Resize).
Nur auf Desktop aktiv (`matchMedia('(min-width: 1024px)')`, dieselbe
Bedingung, die `ProgramCard` schon fÃ¼r den mobilen Fixed-Sheet-Check nutzt) â€”
mobil bleibt der Chart bei fester HÃ¶he (240px) im normalen Dokumentfluss.
`LogsPage`/`ArchivePage` Ã¼bergeben `fill` nicht und bleiben unverÃ¤ndert.

**Debugging-Fund unterwegs:** die erste Fassung lieÃŸ den Chart auf ~10.000px
wachsen â€” ein Resize-Feedback-Loop, weil dem Chart-Karten-`div` selbst
`lg:min-h-0` fehlte (Default `min-height:auto` verhindert das Schrumpfen auf
den vom Flex-Elternteil zugewiesenen Platz). Zweiter Fund: die â€žKochen"-
Dashboard-Config referenziert einen lÃ¤ngst gelÃ¶schten Log (`charts: ["42b70a"]`,
keine passende `logs`-Eintrag) â€” vorher harmlos (leere `space-y-4`-Box), nach
der Umstellung riss das dieselbe `min-h-[240px]`+`flex-1`-FlÃ¤che auf. Fix:
`Dashboard.tsx` filtert `activeDash.charts` jetzt zuerst gegen `logs` auf
tatsÃ¤chlich vorhandene EintrÃ¤ge (`chartLogs`) und rendert den Chart-Bereich nur
dann, wenn davon mindestens einer Ã¼brig bleibt.

**Verifikation:** `pnpm typecheck` grÃ¼n. Live gegen `brewcontrol.local` im
Browser-Pane geprÃ¼ft: â€žMaischen" (Programm `awaiting`, Regler `mash` oben,
grÃ¶ÃŸerer Chart, Rest-Grid darunter), â€žGÃ¤rung" (Programm `idle`/â€žBereit", Regler
`testpid` steht trotzdem oben â€” bestÃ¤tigt â€žimmer", nicht nur bei aktivem
Programm), â€žKochen" (kein Programm, dangling Chart-Referenz â€” Grid oben ohne
LÃ¼cke). FenstergrÃ¶ÃŸe 900px hoch vs. Standard: Chart-HÃ¶he wuchs messbar mit
(229px â†’ 361px). Mobile (375Ã—812): Regler-Karte im normalen Fluss oben, Chart
feste HÃ¶he, Programm-Karte weiterhin als Fixed-Bottom-Sheet, Rest-Grid
einspaltig â€” keine Regression. `LogsPage` (`/settings/logs`) unverÃ¤ndert mit
fester Chart-HÃ¶he geprÃ¼ft.

**Nachtrag (Nutzer-Feedback):** die uPlot-Legende ragte im Fill-Modus Ã¼ber den
unteren Kartenrand hinaus â€” `height` ist bei uPlot nur die Plot-/AchsenflÃ¤che,
die Legende kommt als eigene Zeile obendrauf, `el` hat im Fill-Modus aber eine
fixe CSS-HÃ¶he (`h-full`), die beides fassen muss. Fix in `ChartCard.tsx`: die
tatsÃ¤chlich gerenderte `.u-legend`-HÃ¶he wird vor jedem `setSize()` gemessen und
von der ZielhÃ¶he abgezogen (`fillHeight()`); da die Legende beim allerersten
Erstellen noch nicht existiert, folgt direkt nach `new uPlot(...)` ein
einmaliger Korrektur-Resize. Verifiziert bei zwei FensterhÃ¶hen (900px und
700px) â€” Legende endet jeweils exakt an der Karten-Innenpadding-Kante, kein
Ãœberstand mehr.

## 2026-09-12 â€” Regler-Card: kombinierter Ist/Soll-Slider + Regelbereich

Backlog-Punkt â€žNeues Regler-Design: Slider inkl. Sensorwert und Setpoint"
umgesetzt (linear; die zirkulÃ¤re Variante bleibt offen, siehe PLAN.md),
ausgelÃ¶st durch Nutzer-Wunsch nach einem Slider statt Zahlenfeld+Apply fÃ¼r
den Sollwert. Per Screenshot + RÃ¼ckfragen geklÃ¤rtes Interaktionskonzept: ein
Slider pro Regler, ein weiÃŸer Rundknopf = Sollwert (ziehbar), Track-FÃ¼llung
rot wenn Istwert < Sollwert (heizt noch), blau wenn darÃ¼ber; Istwert selbst
nur als Text, kein eigener Marker. Sollwert-Text ist klickbar editierbar
(ersetzt Zahlenfeld+Apply). Der neue weiÃŸe-Knopf-Stil ist auch auf die
bestehenden Aktor-Slider (`ContinuousSlider`, `IntervalSlider`) Ã¼bertragen.

**Neues Feld â€žRegelbereich" (`rangeMin`/`rangeMax`):** die Slider-Skala
sollte einstellbar sein, nicht starr an den Sensor-Messbereich gekoppelt.
Da SensActCtrl keinen festen `ControllerParams`-Struct hat (jeder
Controller-Typ baut `paramsJson()` von Hand), wanderte das neue Feld analog
zum bestehenden `enabled_`-Muster in die `Controller`-Basisklasse: privates
Feld-Paar + virtuelle `setRange()`/`rangeMin()`/`rangeMax()` mit
Default-Implementierung (`core/Controller.h`) â€” keine Ã„nderung an den vier
Konstruktoren nÃ¶tig, nur `paramsJson()` in `PIDController`/`TwoPointController`/
`DualStageController`/`SplitRangePIDController` um `rangeMin`/`rangeMax`
erweitert. Sentinel fÃ¼r â€žnicht gesetzt": `rangeMax <= rangeMin` (Default
0/0) â€” kein NaN in JSON, keine zusÃ¤tzliche Bool-Flag. `DynamicItems.cpp`
ruft `concrete->setRange(...)` einmalig direkt nach dem Bauen der konkreten
Instanz, vor einem eventuellen `RateLimitedController`-Wrap (dessen
`paramsJson()` bettet das innere JSON ohnehin per `%s` ein â€” rangeMin/Max
erscheinen dadurch automatisch). Naming-Konvention wie bei `heat_actuator`/
`heatActuator` Ã¼bernommen: `range_min`/`range_max` (Creation-Body,
snake_case) vs. `rangeMin`/`rangeMax` (Snapshot/Params, camelCase). Rein
additiv, keine SD-Migration nÃ¶tig.

**Frontend:** neue geteilte `Slider`-Komponente (`components/Slider.tsx`) â€”
bleibt ein natives `<input type="range">` (Tastatur/Touch/A11y gratis), nur
Thumb/Track per CSS umgestylt (`.range-slider` in `styles.css`, weiÃŸer
Rundknopf statt `accent-color`), FÃ¼llfarbe per inline Gradient (Standardtrick,
da CSS allein â€žFÃ¼llung bis zum Thumb" bei nativen Range-Inputs nicht kann).
`ControllerCard.tsx` nutzt sie mit Fallback-Kette `params.rangeMin/Max` â†’
`linkedSensor.meta.min/max` â†’ `0/100`. `AddItemModal.tsx`: neues
Formularfeld-Paar â€žRegelbereich" im typ-Ã¼bergreifenden Controller-Block
(gilt fÃ¼r PID/TwoPoint/DualStage/SplitRangePID gleichermaÃŸen), Platzhalter
zeigt den Messbereich des gewÃ¤hlten Sensors als Vorschlag, leer gelassen â†’
Feld wird nicht mitgesendet (Server-Default 0/0 â†’ Sensor-Fallback greift).

**Verifikation:** `pio test -e native` (SensActCtrl) grÃ¼n, 197 Tests inkl.
neuer `rangeMin`/`rangeMax`-Assertion in `test_pid.cpp`. `pio run -e esp32dev`
(BrewControl-Firmware) kompiliert. `npx @redocly/cli lint` gegen
`openapi.yaml` grÃ¼n (`ControllerCreate.range_min/max`,
`ControllerParams.rangeMin/rangeMax` ergÃ¤nzt). `pnpm typecheck` grÃ¼n. Im
Browser-Pane gegen den `pnpm dev`-Mock geprÃ¼ft: Slider-Drag Ã¤ndert Farbe
live rotâ†”blau je nach Ist/Soll-VerhÃ¤ltnis, Klick auf den Sollwert-Text macht
ihn editierbar, Aktor-Slider (`ActuatorCard`) zeigen denselben weiÃŸen Knopf.
**EinschrÃ¤nkung:** der Dev-Mock-Server kennt `range_min`/`range_max` nicht
(eigene simulierte Params, keine echte Firmware) â€” dass das Feld tatsÃ¤chlich
Ã¼ber `POST /api/controllers` persistiert und im Snapshot zurÃ¼ckkommt, ist
damit nicht end-to-end geprÃ¼ft; siehe PLAN.md â†’ Hardware-Verifikation offen.

**Nachtrag (Nutzer-Feedback, gleicher Tag):** die erste Fassung fÃ¼llte den
Track bis zum Knopf (Sollwert) statt bis zum Istwert â€” der Knopf sollte laut
Vorgabe unabhÃ¤ngig vom farbigen Balken stehen, der Balken zeigt nur, wo der
Istwert im Regelbereich liegt. ZusÃ¤tzlich fÃ¼hlte sich das Ziehen "hakelig"
an. Root Cause fÃ¼r beides: `Slider` reichte jeden `onInput`-Tick des Drags
per `setSp()` bis in `ControllerCard` hoch â€” das lieÃŸ die ganze Karte
(ToggleSwitch, ConfirmModal, Ist/Ausgang-Zeile, â€¦) bei jedem Maus-Pixel neu
rendern, und die Track-FÃ¼llung war direkt an den gezogenen Wert gekoppelt.
Fix in `Slider.tsx`: das Dragging bleibt jetzt vollstÃ¤ndig lokal in der
Komponente (`useState`/`useEffect` wie schon in `ActuatorCard`s
`ContinuousSlider` vorgemacht) â€” nur das native `change`-Event (feuert genau
einmal, beim Loslassen) reicht per `onChange` nach oben durch, `onInput` ist
optional und wird von `ControllerCard` gar nicht mehr genutzt. Neue
`fillValue`-Prop entkoppelt die BalkenfÃ¼llung vom Thumb-Wert: die farbige
Leiste liegt jetzt als eigenes `position:absolute`-Div hinter einem
Track-transparenten `<input>`, `ControllerCard` Ã¼bergibt dafÃ¼r den Istwert
des Sensors, `ActuatorCard`s Slider lassen `fillValue` weg (Fallback = eigener
Wert, unverÃ¤ndertes Verhalten). Verifiziert im Browser-Pane: Balken folgt dem
Istwert unabhÃ¤ngig vom Knopf, Drag fÃ¼hlt sich nativ/flÃ¼ssig an, Sollwert-Text
und Farbe aktualisieren erst nach dem Loslassen (kein Netzwerk-Call wÃ¤hrend
des Ziehens mehr).

**Zweiter Nachtrag (gleicher Tag):** der weiÃŸe Knopf lag unter dem farbigen
Balken (Div mit `position:absolute` stapelt Ã¼ber dem nicht-positionierten
nativen `<input>`, unabhÃ¤ngig von der DOM-Reihenfolge) â€” Fix: `<input>`
bekommt selbst `position:relative`, damit beide Kinder im selben positionierten
Stacking-Kontext liegen und die DOM-Reihenfolge (Input nach dem FÃ¼lldiv)
gewinnt.

**Dritter Nachtrag:** trotz der lokalen Drag-State-Isolation blieb das Ziehen
weiter hakelig. Root Cause: der Regler in der Demo wird aktiv von einem
laufenden Programm gesteuert und Ã¤ndert `setpoint` autonom im Sekundentakt
(beobachtet: Tausende Setpoint-POSTs, ganz ohne eigene Interaktion). Jede
externe `setpoint`-Ã„nderung lief Ã¼ber `ControllerCard`s
`useEffect(() => setSp(setpoint.toString()), [setpoint])` in einen neuen
`value`-Prop an `Slider`, dessen eigener Resync-`useEffect` den lokalen
Drag-Wert mitten im Ziehen Ã¼berschrieb â€” der Knopf sprang dadurch unter dem
Cursor auf den zuletzt bekannten Serverwert. Fix in `Slider.tsx`: ein
`dragging`-Ref, gesetzt via `onPointerDown` (deckt Maus/Touch/Pen einheitlich
ab) und zurÃ¼ckgesetzt via `onChange`/`onBlur`; der Resync-Effekt Ã¼berspringt
`setLocal(value)`, solange `dragging.current` true ist. Betrifft nur
`Slider.tsx`, keine anderen Dateien. Verifikation war ungewÃ¶hnlich aufwÃ¤ndig:
synthetische `dispatchEvent('input', â€¦)`-Tests in der Konsole lÃ¶sten dabei
selbst ein natives `change` aus (Browser-Eigenheit bei nicht-getrusteten
Events auf `<input type=range>`, imitiert keinen echten Drag) und erzeugten
irrefÃ¼hrende Fehlsignale â€” verifiziert wurde am Ende mit echten, getrusteten
Maus-Drags (`left_click_drag`): Regler-Slider landet exakt auf dem
gezogenen Wert trotz der stÃ¤ndigen Hintergrund-Updates des Demo-Programms,
Aktor-Slider (`IDS1`) weiterhin unverÃ¤ndert korrekt.

**Vierter Nachtrag:** Nutzer meldet weiterhin Springen beim Ziehen â€” auch bei
`testpid`, dessen `setpoint` nachweislich stabil ist (3Ã— Ã¼ber 4s unverÃ¤ndert
per `/api/snapshot` geprÃ¼ft), was die Autonomous-Churn-ErklÃ¤rung aus dem
dritten Nachtrag widerlegt. Zu Recht eingewandter Einwand: ein echter,
handgefÃ¼hrter Maus-Drag unterscheidet sich von einem skriptgesteuerten
(egal ob synthetisches `dispatchEvent` oder CDP-`left_click_drag`) â€”
Letzterer generiert vermutlich nur wenige Zwischenpunkte statt der vielen
Events eines echten, oft nicht perfekt horizontalen Drags. Neue Hypothese:
verlÃ¤sst der Cursor wÃ¤hrend eines echten Drags kurz die (nur 18px hohe)
Slider-Box, kann der Browser vorzeitig ein natives `change`-Event feuern,
obwohl die Maustaste noch gedrÃ¼ckt ist â€” bis jetzt hing das ZurÃ¼cksetzen von
`dragging.current` an genau diesem `change`, wodurch der anschlieÃŸende
Server-Roundtrip den Knopf mitten im (physisch noch laufenden) Drag
zurÃ¼ckgesetzt hÃ¤tte. Fix: `dragging.current` hÃ¤ngt jetzt an
`onPointerUp`/`onPointerCancel` statt an `onChange` â€” `change` lÃ¶st weiterhin
den Commit aus, beendet aber nicht mehr die Drag-Guard. **Nicht abschlieÃŸend
verifiziert:** eigene Versuche, einen Drag auÃŸerhalb der Slider-Box per
`left_click_drag` zu simulieren, lieferten kein eindeutiges Bild (CDP
repliziert offenbar kein echtes Pointer-Capture-Verhalten).

**FÃ¼nfter Nachtrag:** Nutzer lieferte den entscheidenden Beleg â€” Chrome DevTools
Network-Tab zeigt beim Ziehen Dutzende `setpoint`-POSTs pro Sekunde. Damit
widerlegt: das native `change`-Event feuert in Chrome fÃ¼r `<input
type="range">` beim Maus-Drag **nicht** einmalig bei Loslassen (wie MDN nahelegt
und wie in den vorherigen NachtrÃ¤gen angenommen), sondern fortlaufend wÃ¤hrend
des gesamten Ziehens â€” das erklÃ¤rte sowohl den Netzwerk-Flood als auch das
Springen (jeder dieser Zwischen-Commits ging Ã¼ber `applySp()` zurÃ¼ck an den
Server und kam als neuer `setpoint`-Prop wieder rein). Nutzer schlug direkt den
richtigen Fix vor: Senden strikt an `pointerup` koppeln, nicht an `change`.
Umsetzung in `Slider.tsx`: `onInput`/`onChange` fassen `local`/`localRef` nur
noch lokal an, ein `commit()` (dedupliziert gegen den zuletzt gesendeten Wert
via `lastSent`-Ref) lÃ¤uft ausschlieÃŸlich Ã¼ber `onPointerUp` â€” `onChange` bleibt
nur als Fallback fÃ¼r den Tastatur-Pfad (Pfeiltasten ohne Pointer-Events) und
ist dabei durch `if (!dragging.current)` gegen doppeltes Senden nach einem
bereits erfolgten Pointer-Commit abgesichert. Verifiziert: bei einem
CDP-Drag (`left_click_drag`) lÃ¤uft jetzt genau 1 `setpoint`-POST statt vieler,
Wert landet weiterhin exakt auf der gezogenen Position. Ob damit auch das vom
Nutzer gemeldete Netzwerk-Flooding bei echter Maus vollstÃ¤ndig behoben ist,
steht noch aus â€” muss der Nutzer selbst mit echter Maus/DevTools
gegenprÃ¼fen, da CDP das reale `change`-Verhalten dieses Chrome/OS nicht
zuverlÃ¤ssig nachstellt (siehe vierter Nachtrag).

**Sechster Nachtrag:** Netzwerk-Flood war behoben, aber der Knopf sprang
weiterhin gelegentlich ("jedes zweite Mal") auf den vorherigen Wert zurÃ¼ck â€”
zusÃ¤tzlich der Wunsch, den Sollwert beim Ziehen auch live im Textfeld zu
sehen (bisher erst nach dem Loslassen, seit dem dritten Nachtrag). Root
Cause des ZurÃ¼ckspringens: `ControllerCard.tsx`s Slider-`onChange`
(`(v) => { setSp(v.toString()); applySp(); }`) rief `applySp()` im selben
Tick wie `setSp()` auf â€” `applySp()` las `sp` aber aus dem **alten**
Closure (der State-Update von `setSp` wird erst beim nÃ¤chsten Render
wirksam), schickte also nicht den frisch gezogenen Wert an den Server,
sondern den vorherigen. Traf der nÃ¤chste Snapshot-Poll exakt in dem
Zeitfenster ein (abhÃ¤ngig von Float-Serialisierungs-Jitter, daher nur
gefÃ¼hlt "jedes zweite Mal"), sprang der ControllerCard-`useEffect`
(`setSp(setpoint.toString())`) auf diesen alten Wert zurÃ¼ck. Fix:
`applySp(v?: number)` nimmt den Wert jetzt optional als Parameter, Slider-
`onChange` reicht ihn direkt durch (`applySp(v)`) statt sich auf den
Closure-`sp` zu verlassen; der Text-Input-Pfad (Enter/Blur) ruft weiter ohne
Argument auf (dort ist `sp` nicht veraltet, da Tippen Ã¼ber mehrere Render-
Zyklen lÃ¤uft). Live-Textfeld-Update beim Ziehen wieder ergÃ¤nzt: Slider
bekommt jetzt zusÃ¤tzlich `onInput={(v) => setSp(v.toString())}` â€” rein
lokale State-Ã„nderung, kein Netzwerk-Call, da nur `onChange` (nach wie vor
strikt an `pointerup` gekoppelt) tatsÃ¤chlich sendet. Verifiziert: drei
aufeinanderfolgende Drags im Browser-Pane, per instrumentiertem `fetch` der
tatsÃ¤chlich gesendete Wert mit dem angezeigten verglichen â€” stimmte jedes
Mal exakt Ã¼berein, kein ZurÃ¼ckspringen auch nach 2s Wartezeit (Snapshot-Poll
sollte da lÃ¤ngst durch sein).

## 2026-09-13 â€” Timer-Widget (Backlog-Punkt umgesetzt)

Freistehende Kitchen-Timer fÃ¼r Brau-Timings (Hopfengaben, RÃ¼hrintervalle,
Rasten auÃŸerhalb eines Programms) â€” server-persistiert (Ã¼bersteht Reboot und
Browser-Reload) und mit Push-Benachrichtigung beim Ablaufen, analog zum
bestehenden Programm-Feature. UrsprÃ¼nglich als â€žTimer-Gruppe" mit mehreren
benannten Timern pro Widget geplant; nach RÃ¼ckfrage stellte sich heraus, dass
einzelne, eigenstÃ¤ndige Timer-Elemente gewÃ¼nscht waren (wie Sensor-/Aktor-
Karten) â€” Gruppierung ersatzlos verworfen, dadurch entfielen auch die Fragen
nach ID-Eindeutigkeit Ã¼ber Gruppen hinweg und einem Pro-Timer-Notify-Flag
(jeder Timer benachrichtigt immer, ohne Opt-out).

**Firmware:** Neue Komponente `TimerStore.h/.cpp`, 1:1 nach dem Vorbild von
`ProgramRunner` â€” flache Liste von `{id, name, durationSec, status,
startedEpoch, elapsedAtPauseSec}`, wall-clock-epoch-basierte Persistenz nach
`/config/timers.json`, NTP-Gate (`nowEpoch > 946684800L`) wie bei
Programmen/Logs. `control()` kennt `start|pause|resume|stop` â€” kein `reset`
als eigene Action, da es mit `stop` identisch gewesen wÃ¤re (Redundanz beim
Implementieren aufgefallen und ersatzlos gestrichen). Neue Routen
`GET/POST /api/timers`, `POST/DELETE /api/timers/<id>`,
`POST /api/timers/<id>/control`, exakt nach dem `/api/programs`-Muster.
Ablauf feuert `AlarmStore::onTimerExpired` (neuer `AlertKind: timer`), darÃ¼ber
`PushService::describe_` mit â€žTimer abgelaufen" â€” Kette 1:1 von
`onProgramStatus`/â€žProgramm fertig" gespiegelt. `DashboardConfig` um
`timers: string[]` erweitert (`DashboardStore`, `types.ts`, `openapi.yaml`).

**Frontend:** `fmtDuration()` aus `ProgramCard.tsx` nach neuem
`web/src/format.ts` extrahiert (jetzt auch von `ProfilesPage.tsx` importiert).
Neue `TimerCard.tsx` (Card-Shell/Badge/Progressbar-Idiom wie `SensorCard`/
`ProgramCard`), im normalen Item-Grid neben Sensor-/Aktor-/Regler-Karten
platziert (kein eigener Spalten-/Bottom-Sheet-Sonderfall wie beim
Programm-Widget, da ein Timer nichts â€žclaimt"). `Dashboard.tsx` pollt
`GET /api/timers` im 1s-Intervall, unabhÃ¤ngig von der SSE-Snapshot (gleiche
BegrÃ¼ndung wie bei Programmen).

**Nachtrag (selber Tag):** Erste Version legte Timer Ã¼ber ein Inline-Formular
in `DashboardContentModal.tsx` an (Name + Minuten, kein Rename-Fluss). Zwei
Nutzer-RÃ¼ckmeldungen dagegen: (1) Klick auf â€žAnlegen" tat sichtbar nichts â€”
Root Cause: das an diesem GerÃ¤t laufende `pnpm dev` proxied gegen ein echtes,
noch nicht neu geflashtes Board, `POST /api/timers` lief dort ins Leere
(404); `createTimer()` wurde aber `await`-los aufgerufen, die verworfene
Promise schluckte den Fehler komplett, ohne jede UI-RÃ¼ckmeldung. (2) Wunsch
nach einem eigenen Modal statt Inline-Formular, um spÃ¤ter weitere
Timer-Einstellungen unterzubringen. Fix: neue `TimerEditorModal.tsx` (Create
**und** Edit, Muster wie `NameModal`/`LogEditorModal`) â€” der Submit-Handler
awaitet `onSave` jetzt selbst und zeigt einen Fehlertext im Dialog, statt ihn
verschluckt als unhandled rejection verschwinden zu lassen. Damit auch der
Bearbeiten-Stift auf `TimerCard` verdrahtet (`openEditTimer`) â€” die zuvor als
bewusste LÃ¼cke vermerkte fehlende Rename/Dauer-Ã„nderung ist damit erledigt,
kein separater PLAN.md-Eintrag mehr nÃ¶tig. `DashboardContentModal.tsx`
behÃ¤lt nur noch die Checkbox-Auswahl bestehender Timer; â€ž+ Neuen Timer
erstellen" Ã¶ffnet jetzt das neue Modal (`onNewTimer`), analog zu â€ž+ Neues
Programm erstellen". Im Browser gegen das reale (alte) GerÃ¤t nachgestellt:
Klick auf â€žErstellen" zeigt jetzt sichtbar â€žError: 404 Not Found" im Dialog
statt schweigend nichts zu tun.

**Verifiziert:** `pio run -e esp32dev` (Compile-Smoke, Flash 84.0%/RAM 18.2%),
`pio test -e native` (30/30 grÃ¼n, unverÃ¤ndert â€” `TimerStore` selbst ist wie
`ProgramRunner` nicht nativ testbar, da es an Arduino/FreeRTOS/`SdLock`
hÃ¤ngt), `npx @redocly/cli lint` (grÃ¼n), `pnpm typecheck` (grÃ¼n), Fehlerpfad
im Browser gegen ein echtes (noch altes) GerÃ¤t nachgestellt. Der eigentliche
Funktionspfad (Timer anlegen und laufen lassen) steht noch aus â€” braucht ein
mit dieser Firmware neu geflashtes Board, siehe PLAN.md â†’ Hardware-
Verifikation offen.

**Zweiter Nachtrag (selber Tag) â€” Hardware-E2E abgeschlossen:** LilyGo
T-Display-S3-AMOLED (COM9) geflasht. `pio run -t upload` scheiterte erst
zweimal mit â€žNo serial data received" / â€žUnable to verify flash chip
connection" â€” deterministisch reproduzierbar, kein Flackern, deckt sich mit
der schon dokumentierten TinyUSB-CDC-InstabilitÃ¤t dieses Boards unter
Windows (siehe `BrewControl/CLAUDE.md`). Auch mit fest gepinntem
`upload_speed = 115200` (umgeht den sonst separaten â€žChanging baud rate"-
Schritt) kam die Verbindung nicht zuverlÃ¤ssig durch â€” der Nutzer hat
stattdessen manuell geflasht (BOOT gehalten + RESET angetippt, danach lief
der Upload durch). Die testweise ergÃ¤nzte `upload_speed`-Zeile in
`platformio.ini` danach wieder entfernt, da sie das eigentliche Problem
nicht lÃ¶ste und nichts zur Sache tut.

Nach dem Flash lief das aktive Maischeprogramm (`Verzuckerungsrast`-Schritt)
nahtlos weiter â€” Beleg, dass `ProgramRunner`s Epochen-Persistenz auch einen
durch uns ausgelÃ¶sten Neustart mitten im Lauf sauber Ã¼bersteht, nicht nur
einen Stromausfall.

**Timer-Funktionstest am GerÃ¤t:** Ãœber das Dashboard einen Timer â€žhopfengabe"
angelegt (Fehler aus dem ersten Nachtrag damit implizit miterledigt â€” Nutzer
bestÃ¤tigte â€žfunktioniert alles"), Start/Pause/Stop im Browser gegen das
Live-GerÃ¤t durchgeklickt, Countdown lief sichtbar.

**Push-Benachrichtigung:** vom Nutzer eigenstÃ¤ndig geprÃ¼ft, funktioniert.

**Reboot-Test (API-getrieben, ohne Board-Zugriff):** Timer per
`POST /api/timers/{id}/control {"action":"start"}` gestartet (`durationSec`
60, `startedEpoch` notiert), nach ~8 s per `POST /api/network
{"hostname":"brewcontrol"}` einen sicheren Reboot ausgelÃ¶st (Ã¤ndert keine
WLAN-Daten, siehe Test-Boards-Memo), GerÃ¤t nach ~2 s wieder erreichbar.
**Beleg fÃ¼r einen echten Neustart:** `state.t` (millis seit Boot) aller
Sensoren/Aktoren im Snapshot lag bei ~40000 (40 s) statt der Stunden an
Laufzeit, die die Session vorher schon lief. `startedEpoch` blieb Ã¼ber den
Reboot hinweg unverÃ¤ndert; `remainingSec` fiel kontinuierlich nach
Wall-Clock (60â†’45â†’36â†’0), keine RÃ¼cksetzung auf `durationSec`, kein Einfrieren
â€” der Timer landete exakt zur richtigen Zeit auf `done`. Maischeprogramm und
Regler/Aktor-Zustand kamen ebenfalls unauffÃ¤llig zurÃ¼ck. Damit sind beide
zuvor offenen Hardware-Verifikationspunkte (Reboot-Ãœberleben, Push) erledigt
â€” Eintrag aus `PLAN.md` â†’ Hardware-Verifikation entfernt.

## 2026-09-13 â€” Timer-Erweiterung: Uhrzeit-Modus, Start/Stop-Aktion, Wiederholen

Der freistehende Timer konnte bisher nur ablaufen und eine Push-Meldung
auslÃ¶sen. Auf Wunsch erweitert um: (1) statt einer reinen Dauer auch eine
Zieluhrzeit einstellbar (`mode: duration|clock`, `timeOfDay: "HH:MM"`) â€”
praktisch fÃ¼rs automatische Vorheizen zum Brautag-Start; (2) eine optionale
Start/Stop-Aktion auf einen Aktor, Regler oder ein Programm bei Ablauf
(`onExpire: {targetType, targetId, action}`); (3) Wiederholen, das im
Uhrzeit-Modus driftfrei auf â€žmorgen selbe Zeit" rearmt und im Dauer-Modus
dieselbe Dauer erneut abzÃ¤hlt.

**Architektur:** `durationSec` bleibt die einzige LaufzeitgrÃ¶ÃŸe â€” im
Uhrzeit-Modus wird sie bei jedem Start/Rearm frisch aus `timeOfDay` berechnet
(`TimerSchedule.h`, neu, reine C++-Helfer analog `ProgramTargets.h`, nativ
getestet). Die Aktion feuert direkt in `TimerStore::tick()` gegen
`Registry`/`ProgramRunner` (dafÃ¼r deren Referenzen neu in die Signatur
aufgenommen, ein Zeilen-Change am Aufrufer in `WebUI.cpp`) â€” das muss auch
ohne offenen Browser funktionieren. Locking geprÃ¼ft: kein Deadlock-Pfad, da
weder `ProgramRunner` noch `Registry`/`Actuator`/`Controller` zurÃ¼ck in
`TimerStore` rufen, exakt das Muster, das `WebUI::tick()` mit
`programs_.tick(reg_, ...)` schon lebt.

**Umgesetzt:** `TimerStore.h/.cpp`, neue `TimerSchedule.h` + native Tests
(`test_timer_schedule`, 7 FÃ¤lle inkl. Mitternachts-Ãœbergang und â€žexakter
Treffer rollt vollen Tag"), `WebUI.cpp` (Tick-Aufruf), `openapi.yaml`
(`TimerMode`, `TimerExpireAction`, erweiterte `TimerInput`/`Timer`-Schemas,
korrigierte Endpoint-Beschreibung), `types.ts`/`api.ts`,
`TimerEditorModal.tsx` (Dauer/Uhrzeit-Segmented, Wiederholen-Checkbox,
Aktion-Picker fÃ¼r Aktor/Regler/Programm mit Start/Stop), `TimerCard.tsx`
(Uhrzeit-Anzeige, Repeat-Icon, Aktionszeile). AbwÃ¤rtskompatibel: alte
`timers.json`-EintrÃ¤ge ohne die neuen Felder laden Ã¼ber dieselben
`|`-Defaults wie bisher als normale Dauer-Timer.

**Verifikation:** `pio test -e native` (37/37, inkl. neuer
`test_timer_schedule`-Suite), `pio run -e esp32dev` + `-e
lilygo_t_display_s3_amoled` kompiliert, `npx @redocly/cli lint` sauber,
`pnpm typecheck` + `pnpm build` sauber.

**Hardware-E2E am LilyGo T-Display-S3-AMOLED (`brewcontrol.local`,
192.168.178.87, reine Testumgebung ohne reale Aktoren):** neue Firmware
geflasht (`pio run -e lilygo_t_display_s3_amoled -t upload --upload-port
COM9`, lief ohne manuellen BOOT/RESET-Eingriff durch â€” anders als beim S2
Mini nicht nÃ¶tig). Danach per `curl` gegen die echte API getestet:
- Alter Timer â€žhopfengabe" (vor dem Feature angelegt, ohne `mode`/`repeat`/
  `onExpire` in `timers.json`) lÃ¤dt nach dem Flash weiterhin korrekt als
  normaler Dauer-Timer â€” AbwÃ¤rtskompatibilitÃ¤t bestÃ¤tigt.
- Uhrzeit-Timer mit `onExpire` auf â€žRiptide Pumpe" (start), Ziel 2 Min. in der
  Zukunft: `durationSec` exakt korrekt aus der Ziel-Uhrzeit berechnet (80 s bis
  19:14 Uhr, real UTC+2 via Settings), nach Ablauf schaltete die Pumpe live um
  (`enabled:falseâ†’true`, `state.v:0â†’1`) â€” der Direktzugriff auf
  `Registry`/`ProgramRunner` aus `TimerStore::tick()` funktioniert ohne
  offenen Browser.
- Dauer-Timer (15 s) mit `repeat`: vier Zyklen beobachtet, `startedEpoch`
  sprang exakt im 15-s-Raster weiter, Status blieb durchgehend `running`
  (kein Zwischenstopp bei `done`).
- Uhrzeit-Timer mit `repeat`: nach dem ersten Ablauf sprang `durationSec` von
  55 auf exakt 86400 und `startedEpoch` wurde auf den exakten
  Ablaufzeitpunkt rebased (Status blieb `running`) â€” der drift-freie
  â€žmorgen selbe Uhrzeit"-Rearm funktioniert wie geplant.
- Reboot-Test (sicherer Trigger Ã¼ber `POST /api/network` mit unverÃ¤ndertem
  Hostnamen) wÃ¤hrend ein Uhrzeit+Repeat+Aktion-Timer lief: nach dem Neustart
  (Uptime laut `state.t` ~22 s, also echter Reboot) waren `mode`, `timeOfDay`,
  `repeat`, `onExpire`, `startedEpoch` und `durationSec` unverÃ¤ndert erhalten,
  `remainingSec` lief nach Wall-Clock korrekt weiter statt zurÃ¼ckgesetzt zu
  werden.
- Alle Testtimer und der Pumpen-Zustand danach wieder aufgerÃ¤umt/zurÃ¼ckgesetzt.
  Nebenbefund (nicht durch diese Ã„nderung verursacht, bestehendes Verhalten):
  der Reboot setzte den `mash`-Regler-Sollwert von einem manuell gesetzten
  Laufzeitwert (72 Â°C) auf den Config-Default (65 Â°C) zurÃ¼ck â€” das
  zugehÃ¶rige Programm â€žHermann-Weizen" stand dabei bereits auf `idle`, war
  also nicht aktiv am Steuern; nicht-programmgebundene Sollwerte werden beim
  Boot grundsÃ¤tzlich nicht persistiert.

Damit ist der zuvor offene Hardware-Verifikationspunkt fÃ¼r die Timer-Erweiterung
erledigt â€” Eintrag aus `PLAN.md` entfernt.

## 2026-09-13 â€” Alternative Card-Darstellungen: Gauge & Kompakt fÃ¼r Sensor/Regler/Timer

Sensor-, Regler- und Timer-Cards hatten bisher nur eine feste Darstellung.
ErgÃ¤nzt um zwei zusÃ¤tzliche Anzeigevarianten pro Widget: **Gauge** (rundes
SVG-Gauge, ~doppelte HÃ¶he) und **Kompakt** (~halbe HÃ¶he). Absorbiert zwei
offene Backlog-Punkte: â€žZirkulÃ¤re Variante des Regler-Sliders" (linear war
seit 2026-09-12 umgesetzt) und â€žSensor-/Aktor-/Controller-Cards: feste
HÃ¶he/Breite".

**Datenmodell:** additiv, kein Breaking Change â€” `DashboardConfig` bekommt
drei neue Maps (`sensorModes`/`controllerModes`/`timerModes`, id â†’ `'compact'
| 'gauge'`); `'normal'` wird nie gespeichert, ein fehlender Eintrag heiÃŸt
implizit normal. Firmware (`DashboardStore.h/.cpp`) hÃ¤lt sie als
`vector<pair<string,string>>` neben den bestehenden ID-Listen, reine
Passthrough-Felder (Frontend interpretiert die Werte, Firmware nicht).
`docs/openapi.yaml` um `WidgetMode`-Schema + die drei Properties auf
`DashboardInput`/`Dashboard` ergÃ¤nzt.

**Gauge-Primitive:** neue `Gauge.tsx` â€” 270Â°-Bogen (90Â°-LÃ¼cke unten mittig),
`pathLength={100}`-Trick fÃ¼r prozentuale `stroke-dasharray`-FÃ¼llung statt
Umfangsrechnung. Optionale `interactive`-Variante (nur vom Regler genutzt)
mit ziehbarem Thumb: Pointer-Winkel relativ zum SVG-Mittelpunkt berechnet
(`atan2`), Totzonen-Snap auf 0/100 % in der unteren LÃ¼cke, Commit-Semantik
1:1 von `Slider.tsx` Ã¼bernommen (`onInput` laufend fÃ¼rs visuelle Feedback,
`onChange` erst einmalig bei `pointerup`/`pointercancel` â€” vermeidet den dort
schon dokumentierten Chrome-Bug mit dauerfeuerndem `change`). ZusÃ¤tzlich
`fillValue`-Prop (unabhÃ¤ngig vom Thumb-Wert), damit der Regler-Gauge wie der
lineare Slider gleichzeitig Ist (FÃ¼llbogen) und Soll (Thumb) zeigt.
Pfeiltasten-Nudge + `role="slider"`/`aria-value*` fÃ¼r Tastatur-ZugÃ¤nglichkeit,
da ein SVG-Custom-Control die native Range-Semantik nicht mitbringt.

**Umschalten:** neuer Icon-Button (`CardModeButton.tsx`) direkt im
Card-Header, nur im Bearbeiten-Modus sichtbar, zyklisch normal â†’ gauge â†’
compact â†’ normal. `Dashboard.tsx` bekam dafÃ¼r `cycleMode()` neben
`patchActiveDash`; `handleRenamed()` zieht beim Umbenennen eines Sensors/
Reglers dessen Modus-Eintrag mit um, sonst wÃ¼rde er stillschweigend auf
normal zurÃ¼ckfallen.

**Grid:** Dense-Packing (`[grid-auto-flow:dense]` +
`[grid-auto-rows:minmax(72px,auto)]`) statt der bisherigen gleichfÃ¶rmigen
ZeilenhÃ¶he â€” Basis-Einheit 72 px, `row-span-1/2/4` fÃ¼r kompakt/normal/gauge
(2Ã—72+Gap = exakt die bisherigen 160 px, war der Ableitungsanker fÃ¼r die
Einheit). `minmax(â€¦, auto)` statt eines festen Werts, damit eine Karte, die
ihr Zeilenbudget sprengt (z. B. eine umbrechende Alarm-Badge), wÃ¤chst statt
abzuschneiden. `ActuatorCard` bleibt inhaltlich unverÃ¤ndert, bekommt aber ein
hartkodiertes `row-span-2`, sonst wÃ¼rde Dense-Packing sie auf eine 72-px-Zeile
stauchen.

**Verifikation:** `pnpm typecheck` sauber, `npx @redocly/cli lint` sauber,
`pio run -e esp32dev` kompiliert die `DashboardStore`-Ã„nderung fehlerfrei.
Live gegen `brewcontrol.local` (192.168.178.87, per `pnpm dev`-Proxy) im
Browser durchgeklickt: alle drei Widget-Typen durch alle drei Modi zyklen,
Dense-Grid-Packing bei gemischten HÃ¶hen (kein Clipping/Overlap), Regler-Gauge
per Drag Ã¼ber den vollen Bogen inkl. unterer LÃ¼cke gezogen â€” echter
`setControllerSetpoint`-Request feuerte laut Netzwerk-Log nur genau einmal
beim Loslassen, per `GET /api/snapshot` gegen das GerÃ¤t bestÃ¤tigt (Sollwert
tatsÃ¤chlich Ã¼bernommen, danach wieder auf 65 Â°C zurÃ¼ckgesetzt), Klick-zum-
Bearbeiten-Eingabe im Gauge-Zentrum funktioniert trotz `pointer-events-none`-
Overlay (gezielt `pointer-events-auto` auf dem Center-Content). Dark/Light
manuell umgeschaltet, Gauge in beiden lesbar. **Nicht gemacht:** neue
Firmware wurde nicht auf das Testboard geflasht (siehe PLAN.md â†’
Hardware-Verifikation offen) â€” `sensorModes`/`controllerModes`/`timerModes`
liefen serverseitig deshalb nur gegen die alte Firmware, die das Feld beim
Speichern stillschweigend verwirft (Reload zeigte dadurch erwartungsgemÃ¤ÃŸ
wieder â€žnormal" â€” kein Frontend-Bug, nur alte Firmware auf dem GerÃ¤t).

## 2026-09-13 â€” Fix: ControllerCard/ActuatorCard zeigten verknÃ¼pfte Items auf anderen Tabs nicht an

**Root Cause:** `Dashboard.tsx` reichte `ControllerCard`/`ActuatorCard` die
Tab-gefilterte `displaySnap.sensors`/`.actuators`/`.controllers` (aus
`filterSnap`) statt des vollen Snapshots durch. Lag der per `params.sensor`/
`params.actuator` verknÃ¼pfte Sensor/Aktor eines Reglers (oder der steuernde
Regler eines Aktors) auf einem anderen Dashboard-Tab, fand der `.find()`-
Lookup ihn nicht â€” Ist-Wert, Ausgang, Regelbereich (Fallback auf 0â€“100) und
Einheit fehlten auf der Regler-Karte, die â€žSteuert von â€¦"-Zuordnung auf der
Aktor-Karte ebenso.

**Umsetzung:** `sensors`/`actuators`/`controllers` an beiden `ControllerCard`-
Stellen und an `ActuatorCard` auf den ungefilterten `snap` umgestellt â€” die
Tab-Filterung (`displaySnap`) bestimmt weiterhin nur, welche Karten auf einem
Tab Ã¼berhaupt erscheinen, nicht mehr, welche verknÃ¼pften Items eine Karte
auflÃ¶sen kann.

**Verifikation:** `pnpm typecheck` grÃ¼n. Live gegen `brewcontrol.local`
geprÃ¼ft: Regler `testpid` (Sensor `mlt` + Aktor `kettle`, beide auf anderen
Tabs) zeigt auf dem â€žGÃ¤rung"-Tab jetzt korrekt Ist-Wert, Ausgang und den vom
Sensor geerbten Regelbereich.

## 2026-09-13 â€” Zugriffsschutz Stufe 2: auch die UI/Leseseite sperrbar

Bisheriger Schutz (Stufe 1, 2026-09-05) gilt nur fÃ¼r schreibende Routen;
Lesen â€” inklusive `index.html`/JS/CSS und `/api/snapshot` â€” blieb laut
README immer offen, auch bei gesetztem Passwort. PLAN.md-Punkt â€žZugriffsschutz:
Option auch fÃ¼r die UI selbst anbieten" verlangte eine Option, das ebenfalls
zu sperren. Mit dem Nutzer geklÃ¤rt (AskUserQuestion): volle Sperre (eigene
Login-Seite statt SPA-GerÃ¼st mit leeren Daten) als eigener Schalter,
zusÃ¤tzlich zum Passwort â€” das bisherige Verhalten bleibt Default.

**Mechanismus:** ein einziges neues `AuthService::uiProtected_`-Flag
(`Preferences`-Key `authUiLock`, nur bei gesetztem Passwort setzbar, wird
beim Passwort-LÃ¶schen automatisch mit zurÃ¼ckgesetzt â€” ein UI-Lock ohne
Passwort wÃ¤re unwiederherstellbar). Die eigentliche Sperre ist **ein**
`server_.addMiddleware(...)`-Callback in `WebUI::begin()`
(`ArMiddlewareCallback`, dokumentiert in ESPAsyncWebServer fÃ¼r genau diesen
Zweck: â€žcheck authentication") statt Ã„nderungen an jeder einzelnen GET-Route
oder an `serveStatic`/`onNotFound` einzeln. Server-Middleware lÃ¤uft laut
`AsyncWebServerRequest::_runMiddlewareChain()` vor **jedem** Handler â€” Static-
File-Handler, SPA-Fallback (`onNotFound`) und jede API-Route eingeschlossen â€”
und kann die Antwort selbst senden, ohne `next()` aufzurufen. Damit reicht ein
Gate fÃ¼r alles: bei aktivem UI-Schutz und fehlender Session bekommt jedes GET
auÃŸerhalb von `/api/` (also `/`, jede statische Datei, jeder SPA-Client-Pfad)
eine eingebettete, eigenstÃ¤ndige Login-Seite (`kLockedPageHtml`, reines HTML/
CSS/JS ohne externe Requests, im Firmware-Binary statt unter `/www` â€” die
LittleFS-Boards haben nur 256 KB Datenpartition, und die Seite muss auch
wÃ¤hrend eines laufenden UI-Uploads erreichbar bleiben); jede andere Route
auÃŸer `/api/auth/*` (sonst wÃ¤re Einloggen selbst blockiert) bekommt `401`.
Die bestehenden `requireAuth()`-Aufrufe in den Schreib-Handlern bleiben
unverÃ¤ndert fÃ¼r den â€žnur Passwort"-Fall.

**Neue Route:** `POST /api/auth/ui-protection` (Body `{"enabled"}`), verlangt
wie `/api/auth/password` eine bestehende Session, plus `409` ohne
konfiguriertes Passwort. `GET /api/auth/status` liefert zusÃ¤tzlich
`uiProtected`. Frontend: `SecurityPage.tsx` bekam eine neue `ToggleSwitch`-
Karte â€žAuch Lesen/UI sperren" (nur sichtbar bei gesetztem Passwort und
angemeldet); `LoginModal.tsx`/`app.tsx` blieben unverÃ¤ndert, da Unauthenti-
fizierte bei aktivem UI-Schutz ohnehin nie die SPA laden, sondern direkt die
Locked-Page von der Firmware bekommen.

**Bekannte, bewusst nicht behobene LÃ¼cke:** lÃ¤uft ein Tab schon offen und die
Session lÃ¤uft wÃ¤hrenddessen ab (7-Tage-TTL oder â€žAlle Sitzungen abmelden"),
zeigt das bestehende dismissible `LoginModal` weiter Stale-Daten/Fehler statt
sofort zur Locked-Page zu wechseln â€” ein Reload holt sie. FÃ¼r den seltenen
Fall kein zusÃ¤tzlicher Code.

**Verifikation:** `pio run -e esp32dev` kompiliert (Flash 85 %, RAM 18 %),
`pnpm typecheck` grÃ¼n, `npx @redocly/cli lint` sauber (`openapi.yaml`:
`AuthStatus`-Schema + neue Operation + `401` bei allen bisher immer-offenen
GET-Routen ergÃ¤nzt). Hardware-E2E gegen `brewcontrol.local` (LilyGo
T-Display-S3-AMOLED) vom Nutzer bestÃ¤tigt: Passwort setzen, â€žAuch Lesen/UI
sperren" aktivieren, abgemeldet liefert `GET /` die eingebettete Login-Seite
statt der SPA, Login auf der Locked-Page setzt das Cookie und schaltet frei,
Schalter wieder aus stellt den â€žnur Schreiben geschÃ¼tzt"-Zustand wieder her.

**Nebenbei:** Board landete wÃ¤hrend des Tests im gesperrten Zustand ohne
bekanntes Passwort (vermutlich Rest eines frÃ¼heren Tests, nicht aus dieser
Session). Ohne erreichbaren BOOT-Button am Board (T-Display-S3-AMOLED-1.43-
1.75 hat laut Schaltplan zwei Taster `S1`/GPIO0 und `SW1`/EN direkt am
USB-C, aber die Reihenfolge â€žBOOT halten + RESET drÃ¼cken" schickt den
ESP32-S3 stattdessen in den seriellen Download-Modus statt den App-seitigen
Recovery-Check in `main.cpp` auszulÃ¶sen â€” hat hier nicht funktioniert) per
`esptool.py --chip esp32s3 --port COM9 erase_region 0x9000 0x5000` nur die
NVS-Partition gelÃ¶scht (Offset/GrÃ¶ÃŸe aus der kompilierten
`partitions.bin` dieses Envs verifiziert, `gen_esp32part.py`) â€” WLAN +
Auth-Passwort weg, Firmware/UI/SD unangetastet. Danach WLAN neu eingerichtet,
Zugriffsschutz war wieder aus. FÃ¼r den nÃ¤chsten Fall: welche Session/wer
zuletzt ein Testpasswort auf einem der drei Boards gesetzt hat, bleibt
ungeklÃ¤rt â€” beim Verlassen einer Testsession den Zugriffsschutz wieder
aufheben, sonst sperrt es die nÃ¤chste Session aus.

## 2026-09-14 â€” Dashboard-Chart: Legende in die Titelzeile (Desktop)

Auf Desktop-Breite verlor die uPlot-Legende unter dem Chart unnÃ¶tig viel
Platz. Erster Versuch per reinem CSS (`.uplot { flex-direction:
column-reverse }` ab 768px) schob sie nur Ã¼ber den Chart in eine eigene
Zeile; auf Wunsch danach in die gleiche Zeile wie der Karten-Titel verschoben.
DafÃ¼r bekam `ChartCard.tsx` einen neuen `legendHost`-Prop: sobald gesetzt,
wird `.u-legend` nach dem Bau des uPlot-Charts per `appendChild` dorthin
verschoben (uPlot selbst kÃ¼mmert sich nicht um den DOM-Elternteil seiner
Legende) und beim Unmount/Rebuild wieder geleert â€” `uPlot.destroy()` entfernt
nur die eigene Root, nicht Knoten, die vorher herausgelÃ¶st wurden.
`Dashboard.tsx` kapselt Titel+Chart jetzt in einer lokalen `ChartRow`-
Komponente mit einem Platzhalter-`div` in der Titelzeile als Legend-Ziel
(als State gefÃ¼hrt, weil der Ref erst nach dem Mount existiert und ChartCard
den erneuten Effect-Lauf zum Verschieben braucht); aktiv nur wenn
`isDesktop` (matcht den bestehenden `lg`-Breakpoint des Dashboards).
LogsPage/ArchivePage bekommen keinen `legendHost` und behalten die CSS-
Fallback-LÃ¶sung (Legende weiterhin in eigener Zeile Ã¼ber dem Chart ab
768px). Mobil unverÃ¤ndert (Legende unter dem Chart). Verifiziert live gegen
das Testboard `192.168.178.87`: Legendenwerte aktualisieren sich mit dem
Snapshot, Edit-Modus (Titel + Legende + Entfernen-Button in einer Zeile)
kollidiert nicht.

## 2026-09-16 â€” Dashboard-Tabs im Bearbeiten-Modus neu anordnen

Tab-Reihenfolge war bisher fix (Array-Position von `DashboardConfig[]`,
kein `order`-Feld) â€” Erstellen/Umbenennen/LÃ¶schen gab es, aber kein
Umsortieren. Neue â—€/â–¶-Pfeile am aktiven Tab im `editMode` verschieben ihn
um eine Position; bewusst kein Drag & Drop, da die UI auch auf
Touchscreens am Braustand zuverlÃ¤ssig bedienbar sein muss, und bewusst nur
Nachbar-Vertauschung statt einer vollstÃ¤ndigen Reorder-Route (reicht fÃ¼r
den Anwendungsfall). Neu: `DashboardStore::move(id, dir)` (swapped
Vector-Nachbarn, No-Op an den RÃ¤ndern) + `POST /api/dashboards/{id}/move`
(`WebUI.cpp`, analog zum bestehenden `/control`-Pattern bei
Programs/Timers) + `moveDashboard()` in `api.ts` + `moveTab()` in
`Dashboard.tsx` (folgt dem bestehenden Await-vor-Commit-Pattern ohne
Optimistic-Rollback, wie `patchActiveDash`). `docs/openapi.yaml` +
README-Routentabelle im selben Commit ergÃ¤nzt. Keine neuen nativen
Firmware-Tests â€” `DashboardStore` hat wegen FS/SdLock-AbhÃ¤ngigkeit generell
keine `native`-Testabdeckung (auch `add`/`update`/`remove` nicht), das fÃ¼r
ein Feature nachzuholen wÃ¤re Ãœberkonstruktion. Verifiziert: `pio run -e
esp32dev` + `pio test -e native` (37 bestehende Tests weiter grÃ¼n) +
Redocly-Lint + `pnpm typecheck`/`build`; UI zunÃ¤chst live gegen
`192.168.178.87` mit der alten Firmware (ohne `/move`) getestet â€” Pfeile
erscheinen nur am aktiven Tab im Edit-Modus, Rand-Buttons korrekt disabled,
fehlschlagender `/move`-Call (404, altes Board) lÃ¤sst die Tab-Reihenfolge
unverÃ¤ndert statt sie clientseitig zu verfÃ¤lschen. Danach die neue
Firmware per Netzwerk-OTA auf dieselbe LilyGo S3 aufgespielt
(`curl -F f=@firmware.bin http://192.168.178.87/api/update/firmware`,
Reboot bestÃ¤tigt Ã¼ber `/api/update/status`) und den echten Persistenz-Pfad
verifiziert: â—€/â–¶ verschiebt den Tab, `POST /api/dashboards/<id>/move` â†’
`204`, Reload behÃ¤lt die neue Reihenfolge (SD-persistiert). AnschlieÃŸend
die ursprÃ¼ngliche Tab-Reihenfolge wiederhergestellt. **Nebenbei entdeckt:**
`POST /api/update/assets` (UI-Tar-Upload) schlÃ¤gt auf diesem Board jetzt
auch fehl (`extract failed`, sofort) â€” bisher nur auf LOLIN S2 Mini bekannt
und dort anders (Reset nach ~65 KB); vermutlich zwei verschiedene Ursachen,
nicht weiter verfolgt, siehe PLAN.md. Deshalb blieb die UI auf dem Board
bei der alten Firmware-Version im `index.html`, Ã¤ndert aber nichts an der
Verifikation, da der Test Ã¼ber den lokalen `pnpm dev`-Server lief (nur die
Firmware/API musste aktuell sein).

Direkt danach Nutzer-Feedback zur mobilen Ansicht: Auf schmalen Breiten
saÃŸen â€žBearbeiten"/â€žHinzufÃ¼gen"+â€žFertig" in derselben Zeile wie die Tabs
und quetschten den Tab-Streifen auf einen kaum bedienbaren Rest zusammen.
Die Buttons sitzen jetzt bei `max-width < 1024px` in der Titelzeile neben
â€žBrewControl" statt in der Tab-Zeile â€” dieselbe Logik (`dashActions()` in
`Dashboard.tsx`) wird zweimal gerendert, einmal `lg:hidden` im Header,
einmal `hidden lg:contents` in der Tab-Zeile (Breakpoint deckt sich mit dem
bereits vorhandenen `isDesktop`/`lg`-Umschaltpunkt fÃ¼r den Chart-Legende-
Umzug). Ab 1024px unverÃ¤ndert wie vorher. Verifiziert per `pnpm build` +
live im Browser bei 375px und 1280px Breite gegen das echte Testboard.

Nachgebessert: Im Header (`items-center`) saÃŸen die Buttons zu hoch,
sichtbar gegenÃ¼ber der Mittellinie von â€žBrewControl" (Nutzer-Screenshot mit
Markierung). Ursache: `mb-2` auf den Buttons, eigentlich nur fÃ¼r die
Baseline-Ausrichtung im Desktop-Tab-Streifen (`items-end`) gedacht, verzerrt
im Header die Zentrierung. `dashActions()` bekommt jetzt einen
`alignEnd`-Parameter â€” `true` im Tab-Streifen (mit `mb-2`), `false` im
Header (ohne). Verifiziert bei 375px (Buttons jetzt auf einer Linie mit dem
Titeltext) und 1280px (Tab-Streifen unverÃ¤ndert).

## 2026-09-16 â€” Log-Chart: zusÃ¤tzliche Y-Achsen pro Einheit

Alle Reihen eines Logs lagen bisher auf einer Y-Skala; mischte man z. B.
Temperatur (0â€“100 Â°C) mit einem 0/1-Aktor, wurde die kleine Reihe zur
flachen Linie. `ChartCard.tsx` gruppiert die Reihen jetzt nach Einheit
(bestehendes `unitOf()` aus `refs.ts`, Regler-Sollwert = Einheit seines
Sensors) und legt pro Gruppe eine eigene uPlot-Skala an: erste Gruppe links,
weitere rechts. Einheitslose Reihen bekommen je eine eigene Achse (0/1-Relais
und 0â€“255-PWM wÃ¤ren sonst wieder gemischt). Die Einheit steht waagerecht unter der jeweiligen Achse (auf
HÃ¶he der Zeit-Ticks, als HTML-Element im `.u-axis`-Div per `ready`-Hook
statt uPlots gedrehtem `label`); eine Achse
mit genau einer Reihe nimmt deren Linienfarbe an; nur die linke Achse zeichnet
Gitterlinien. Einheiten werden beim Chart-Aufbau festgelegt â€” ohne
Live-Snapshot (Archiv, LogsPage vor erstem SSE-Event) wird einmal
`/api/snapshot` geladen. Keine API-Ã„nderung. Verifiziert: `pnpm typecheck`,
`pnpm dev` gegen `192.168.178.87` â€” Dashboard-Log â€žMaischenâ€œ
(`sensor/mlt` + `controller/mash` in Â°C links, `actuator/kettle` rechts 0â€“1
in GrÃ¼n) und Archiv-Ansicht einer alten Session zeigen beide Achsen korrekt,
keine Console-Fehler.

## 2026-09-16 â€” WebSocket als vierter Remote-Transport (SensActCtrl + BrewControl)

Neben MQTT, ESP-NOW und Webhook gibt es jetzt `WebSocketTransport`: eine
dauerhafte, bidirektionale Verbindung ohne Broker. **Rollen (Hub-Modell):**
der verÃ¶ffentlichende Knoten (Leaf) ist Client und verbindet sich zum
konsumierenden Knoten (Hub), der den Server betreibt â€” nur ein Client blockiert
beim Connect, und ein Leaf hat genau eine solche Verbindung; der Hub muss die
Leaves nicht kennen. Der Hub-Server ist eine GerÃ¤teeinstellung (lÃ¤uft
unabhÃ¤ngig von Items) â€” Voraussetzung fÃ¼r die spÃ¤tere Autodiscovery (in
PLAN.md vorgemerkt, Mechanismus mDNS-SD vs. UDP noch offen). Library:
`links2004/WebSockets` 2.7.3 (Server + Client, in `loop()` gepollt wie der
Webhook-`WebServer`); verworfen `esp_websocket_client` (eigener Task, ab IDF 5
nicht mehr im Framework) und `AsyncWebSocket` (nur Server, Async-AbhÃ¤ngigkeit
fÃ¼r die Library).

**Library:** `WebSocketProtocol.h` (ein Text-Frame pro Nachricht:
`D<topic>\n<payload>` bzw. `R` als Retained-Request, dazu URL-Parser nur fÃ¼r
`ws://`), `WebSocketTransport` (Server broadcastet an alle Clients, kein
Relaying zwischen Clients; Retain-Emulation wie ESP-NOW: wer Subscriptions
hat, fragt bei jeder neuen Verbindung und nach `subscribe()` â€” pro `tick()`
zusammengefasst â€” den Retained-Cache der Gegenseite ab; Heartbeat 5 s/3 s/2,
Reconnect-Abstand 5 s). `lastErrorMessage()` zeigt immer auf ein
String-Literal, weil WebUI es aus dem AsyncTCP-Task liest. Test
`test_websocket_protocol` (13 FÃ¤lle), Beispiel `11_remote_websocket`.
**BrewControl:** Settings-Abschnitt `websocket` (`hubEnabled`/`hubPort`,
`publishEnabled`/`hubUrl`/`clientId`/`topicPrefix`), `WebSocketService`
(Hub-Server + Publish-Client mit `RemotePublisher`), Remote-Items mit
`transport:"websocket"` ohne Zusatzfelder (ohne Hub: `websocket hub not
enabled`), `GET /api/settings` mit `connected`/`error`/`hubClients`,
`-DWEBSOCKETS_TCP_TIMEOUT=1000`; Frontend: neue Seite Einstellungen â†’
KonnektivitÃ¤t â†’ WebSocket, WebSocket-Button im Remote-Dialog. openapi.yaml,
READMEs nachgezogen. Umgesetzt in einem eigenen Worktree
(`worktree-websocket-transport`), weil parallel eine andere Session im
Haupt-Checkout an der Dashboard-Sortierung arbeitete.

**Verifikation:** `pio test -e native` 210/210; Firmware fÃ¼r alle drei Envs,
Flash je ~+29,8 KB (esp32dev 85,0 â†’ 86,6 %, S2 81,8 â†’ 83,3 %, LilyGo
23,6 â†’ 24,0 %), RAM +72â€“80 B, keine neuen Warnungen; beide Beispiele per
`pio ci` (mit `-std=gnu++17` â€” die dokumentierten Befehle scheitern bei allen
Beispielen an `IntervalActuator.h` unter gnu++11, vorbestehend, in PLAN.md);
`pnpm typecheck`/`build`; `redocly lint` valide. **Hardware** (LilyGo war
durch die andere Session belegt): esp32dev als Hub, LOLIN S2 Mini als Leaf,
beide per OTA. Ohne Hub wird ein WebSocket-Remote-Item abgelehnt,
Settings-Validierung greift (`hubUrl`, `hubPort`, `clientId`). Hub-Port nimmt
den Handshake an (`101`), Leaf `connected:true`, Hub `hubClients:1`. Auf dem
Hub nachtrÃ¤glich angelegte Remote-Items (DigitalInput GPIO0, LED GPIO15 am S2)
hatten Meta + State sofort (Retained-Request); `write 1` am Hub schaltete die
LED am Leaf, der Zustand kam zurÃ¼ck. Hub-Neustart: Leaf meldete nach ~2 s
â€žKeine Verbindung zum Server" und war nach ~7 s ohne Eingriff wieder
verbunden, die gespeicherten Remote-Items auf dem Hub bekamen Meta/State neu.
Loop-Blockade bei nicht antwortendem Hub (`ws://192.168.178.250:8081`) von
auÃŸen Ã¼ber den Sensor-Zeitstempel gemessen: ~1 s Stillstand alle ~6 s (max.
1002 ms), mit erreichbarem Hub keiner. Danach Test-Items gelÃ¶scht und
WebSocket auf beiden Boards wieder ausgeschaltet. **Nicht verifiziert:** zwei
Leaves gleichzeitig und die neue UI am GerÃ¤t â€” der UI-Tar-Upload passt auf
esp32dev nicht mehr in die LittleFS-Partition (neues JS 100 KB gzip, in
PLAN.md), und das Browser-Pane startet keinen Dev-Server aus dem Worktree;
beides als offener HW-Punkt in PLAN.md.

## 2026-09-16 â€” Tar-Upload-Fehler (S2 Mini, LilyGo S3): eingegrenzt, noch nicht HW-verifiziert

Ausgangspunkt: zwei in PLAN.md dokumentierte Tar-Upload-Fehler auf
verschiedenen Boards (S2 Mini: `Connection was reset` nach ~65 KB; LilyGo S3:
sofortiges `extract failed`). Erster Schritt war zu klÃ¤ren, ob der
`TarExtractor`-Parser selbst kaputt ist: ein nativer Test-Harness
(`TarExtractor.cpp` direkt kompiliert, echtes `webui.tar` aus `pnpm build:sd`
+ `tar -C dist -cf webui.tar .`, in willkÃ¼rlich kleinen 173-Byte-HÃ¤ppchen
gefÃ¼ttert) extrahiert alle 16 Dateien fehlerfrei â€” der Parser ist raus als
Ursache, das Problem liegt im SD/LittleFS-I/O (`SdTarSink`) oder im
Restzustand von `/www.new`.

Zwei Fixes eingebaut: `SdTarSink.h` â€” `/www.new` wird vor jeder Extraktion
jetzt Ã¼ber das bestehende `removeRecursive_()` geleert statt Ã¼ber
`fs_.rmdir()`, das bei nicht-leerem Verzeichnis stillschweigend nichts tut;
ein vorheriger fehlgeschlagener Lauf konnte also Dateileichen hinterlassen,
in die der nÃ¤chste Versuch dann hineingeschrieben hÃ¤tte (`FILE_WRITE` hÃ¤ngt
auf dieser Plattform an, statt zu Ã¼berschreiben). `WebUI.cpp` â€” die
500-Antwort auf `/api/update/assets` trÃ¤gt jetzt `TarExtractor::errorMsg()`
(`open failed`/`write failed`/`close failed`) plus den zuletzt versuchten
Pfad (`SdTarSink::lastPath()`) statt nur der generischen Meldung; dieselbe
Zeile geht zusÃ¤tzlich auf `Serial`. `docs/openapi.yaml` entsprechend
nachgezogen.

**Verifiziert:** `pio test -e native` (37/37 grÃ¼n), `pio run` auf allen drei
Envs (esp32dev, lolin_s2_mini, lilygo_t_display_s3_amoled) kompiliert,
Redocly-Lint valide. **Nicht verifiziert:** ob das der tatsÃ¤chliche Root
Cause ist â€” dafÃ¼r fehlt ein Hardware-Testlauf mit der neuen Firmware auf S2
Mini und LilyGo, der jetzt aber die genaue Fehlerstelle statt nur â€žextract
failed" zeigen sollte. Bis dahin bleibt der Punkt offen in PLAN.md.

**Nachtrag â€” Cross-Session-Info aus der parallelen WebSocket-Session
(2026-09-16):** dort am echten esp32dev reproduziert, mit dem
Doku-empfohlenen gz-only-Tar (~133 KB, gewachsen seit dem 100-KB-Befund vom
2026-09-10). Ergebnis deckt sich mit der schon in PLAN.md vermuteten
Platzursache: `/www.new/assets/â€¦js.gz` landet mit 0 Byte, `/www` bleibt
unverÃ¤ndert, geschÃ¤tzt ~84 KB frei (4-KB-Block-SchÃ¤tzung) gegen 100 KB neues
JS-Gzip â€” aber der Client bekommt dabei **gar keine Antwort**
(`curl: (56) Recv failure: Connection was reset`), nicht die von
`openapi.yaml` versprochene `500`. Das ist dasselbe Fehlerbild wie der
Ã¤ltere S2-Mini-Befund (`Connection was reset`, gleiche 256-KB-Partition) â€”
naheliegende, aber noch unbestÃ¤tigte Vermutung: S2 Mini und esp32dev kÃ¶nnten
dieselbe Platz-Ursache teilen, nicht die zwei getrennten Fehlerbilder, von
denen PLAN.md bisher ausging. Ob es tatsÃ¤chlich crasht/rebootet (statt eines
sauberen I/O-Fehlers) wurde nicht per Serial geprÃ¼ft. PLAN.md entsprechend
konsolidiert: LittleFS-Boards (Platz, vermutlich gemeinsame Ursache) jetzt
als ein Punkt gefÃ¼hrt, LilyGo (SD-I/O, bestÃ¤tigt kein Platzproblem) separat.

## 2026-09-16 â€” Remote-Discovery (MQTT + ESP-NOW) + ESP-NOW-Unicast fÃ¼r Befehle

Remote-Items mussten bisher komplett von Hand eingetragen werden (GerÃ¤t,
Remote-ID, Prefix, Kanal) â€” fehleranfÃ¤llig, zumal BrewControl mit Prefix
`brewcontrol` publisht, Remote-Items aber `sensactctrl` vorbelegen. Jetzt gibt
es im Remote-Bereich des HinzufÃ¼gen-Dialogs â€žGerÃ¤te suchen".

**Entscheidungen:** Request/Response Ã¼ber Topics statt MAC-Pairing, einmal in
der Library Ã¼ber `ITransport` (lÃ¤uft auf MQTT und ESP-NOW, spÃ¤ter
WebSocket/Webhook). Retained-Announce + Last Will (Home-Assistant-Muster)
verworfen: braucht Wildcard-Subscribe (keiner unserer Transporte kann das),
hinterlÃ¤sst Leichen am Broker und passt nicht zu ESP-NOW. ESP-NOW hybrid:
Adressierung bleibt deviceId/Topic (Hardwaretausch ohne Neu-Koppeln), aber
nicht-retained Befehle gehen unicast mit ACK.

**Umsetzung:**
- `SensActCtrl/src/remote/Discovery.{h,cpp}`: Protokoll (fixe Topics
  `sensactctrl/discover` + `/<scanner>`, `rid` gegen verspÃ¤tete Antworten, eine
  Antwort pro Sensor-Kanal/Aktor wegen 250-Byte-Limit, Controller nicht
  gelistet) und `DiscoveryScanner` (thread-sicher, Anfrage geht nur aus
  `tick()` raus, 3-s-Fenster, Dedup, eigenes GerÃ¤t gefiltert, Ergebnis-TTL 30 s).
- `RemotePublisher` antwortet automatisch: Anfrage wird unter Mutex Ã¼bergeben,
  `tick()` sendet nach Zufalls-Jitter (0â€“400 ms) ein Item pro Aufruf.
- `EspNowTransport` + neues `EspNowPeerTable.h`: Absender-MAC wird fÃ¼r
  abonnierte Topics gelernt; `publish(retained=false)` geht an den Sender des
  Eltern-Topics (`â€¦/actuator/x/set` â†’ Sender von `â€¦/actuator/x`), LRU von max.
  16 Unicast-Peers, sonst Broadcast. Send-Callback meldet Zustellfehler in
  `lastErrorMessage()` (eigener String, den periodische Broadcasts nicht
  sofort Ã¼berschreiben). Wire-Format unverÃ¤ndert. Nebeneffekt:
  Discovery-Antworten gehen ebenfalls unicast an den anfragenden Scanner.
- BrewControl: `RemoteDiscovery.h` (Scanner je Transport, eigene IDs wie
  `MqttService`/`EspNowPublishService`), `GET /api/remote/discover?transport=`
  im Muster von `/api/network/scan` (202 â†’ 200, 409 wenn MQTT aus),
  `openapi.yaml` + README-Tabelle. Web: `discoverRemote()`, Liste gruppiert
  nach GerÃ¤t, gefiltert nach Sensor/Aktor, â€žbereits angelegt"-Markierung,
  Klick fÃ¼llt GerÃ¤t/Remote-ID/Prefix/Kanal und leere lokale ID.

**Verifiziert:** `pio test -e native` alle Suites grÃ¼n (neu: `test_discovery`
9, `test_espnow_peers` 5); `pio run` esp32dev, lolin_s2_mini,
lilygo_t_display_s3_amoled kompilieren; `pnpm typecheck` + `pnpm build`;
Redocly-Lint valide; Such-UI im Browser gegen `brewcontrol.local` mit
gestubbtem Endpoint (Liste, Sensor-Filter, Ãœbernahme der Felder).
**Nicht verifiziert:** Hardware (nichts geflasht) â†’ PLAN.md
â€žHardware-Verifikation offen".

## 2026-09-16 â€” UI-Tar-Upload auf den 256-KB-LittleFS-Boards (esp32dev, lolin_s2_mini) gefixt

`POST /api/update/assets` schlug auf beiden LittleFS-Boards fehl, und statt der
dokumentierten `500` bekam der Client einen Connection-Reset.

**Root Cause (per Serial belegt):** `/www.new` wurde neben dem noch liegenden
`/www` entpackt. Die 256-KB-Partition fasst altes und neues Bundle aber nicht
gleichzeitig. esp32dev: 176 KB von 256 KB schon vor dem Entpacken belegt, frei
also ~86 KB gegen ~101 KB JS-Gzip. Der fehlende 500er ist ein **Crash**: Wenn
kein freier Block mehr da ist, gibt esp_littlefs keinen Fehler zurÃ¼ck, sondern
panict (`Guru Meditation Error: IntegerDivideByZero` in `lfs_alloc`, lfs.c:689,
Backtrace Ã¼ber `SdTarSink::writeCb` â†’ `TarExtractor::feed`). Das Board bootet
mitten im Request neu. Der LOLIN zeigt dasselbe Muster (135 KB belegt, frei
~127 KB gegen ~120 KB plus Metadaten): Neustart mitten im Upload, curl
bekommt `(56)`. Den Panic-Text gibt das S2 Ã¼ber USB-CDC nicht mehr aus. Der
Ã¤ltere Befund â€žAbbruch bei ~65 KB" war also dieselbe Ursache, nur knapper am
Limit.

**Entscheidung:** Drei AnsÃ¤tze standen zur Wahl. Umgesetzt ist â€ž`/www` vor dem
Entpacken leeren", ergÃ¤nzt um eine eingebettete Notfall-Seite. Diff-Sync
verworfen: Vite hasht die Dateinamen, das groÃŸe JS Ã¤ndert sich also bei jedem
Build und muss trotzdem neben dem alten liegen. Code-Splitting verworfen: Die
GesamtgrÃ¶ÃŸe bleibt gleich. Umpartitionieren geht nicht, die Firmware belegt
schon 1,65 MB des 1,86-MB-App-Slots. Das In-place-Verhalten hÃ¤ngt bewusst
**nicht** an `BREWCTL_USE_LITTLEFS`, sondern an einem eigenen Flag
`BREWCTL_ASSETS_IN_PLACE`. Ein kÃ¼nftiges Board ohne SD, aber mit grÃ¶ÃŸerer
Datenpartition behÃ¤lt den atomaren Tausch.

**Umsetzung:**
- `platformio.ini`: `-DBREWCTL_ASSETS_IN_PLACE=1` in `esp32dev` +
  `lolin_s2_mini`, mit Kommentar zur PartitionsgrÃ¶ÃŸe.
- `WebUI.cpp`: `kAssetTarget` (`/www` bzw. `/www.new`). Im In-place-Modus wird
  zu Beginn `/www` geleert. `/www.new` wird immer geleert, denn Reste frÃ¼herer
  Versuche fressen Platz. Es gibt keinen Swap. `index.html(.gz)` wird als
  `.part` geschrieben und erst bei Erfolg umbenannt. So endet auch ein
  Verbindungsabbruch, der nie `final` erreicht, auf der Notfall-Seite statt
  in einer halben SPA.
- LittleFS-Guard: Vor jedem Archiv-Member prÃ¼ft ein Wrapper um
  `SdTarSink::openCb()` den freien Platz (GrÃ¶ÃŸe + 1/64 + 2 BlÃ¶cke). Reicht er
  nicht, kommt `500 extract failed: not enough space (<member>, <size> bytes)`
  statt eines Panics. Dazu kommt eine knappe Serial-Zeile mit
  `LittleFS used/total` bei Start und Ende.
- `kRecoveryPageHtml` (Muster `kLockedPageHtml`): `onNotFound` liefert sie fÃ¼r
  Nicht-API-GETs, solange `/www/index.html(.gz)` fehlt. Die Seite bietet einen
  Tar-Upload plus ein optionales Passwort-Feld und gilt fÃ¼r alle Boards.
- `openapi.yaml`, `BrewControl/README.md`, `BrewControl/CLAUDE.md`
  nachgezogen. Der Punkt ist aus PLAN.md raus, der LilyGo-SD-Befund steht dort
  als eigener Punkt weiter.

**Verifiziert:** `pio test -e native` (SensActCtrl 224, Firmware 37 grÃ¼n);
`pio run` fÃ¼r esp32dev, lolin_s2_mini, lilygo_t_display_s3_amoled; Redocly-Lint.
Hardware an **beiden** LittleFS-Boards per OTA, jeweils mit curl:
- gz-only-Tar â†’ `200` in 2â€“4 s, neues Bundle wird ausgeliefert
  (esp32dev: 29 KB â†’ 172 KB belegt).
- Erneuter Upload Ã¼ber bestehende UI â†’ `200`.
- Volles Tar (522 KB) bzw. Tar mit `index.html.gz` zuerst plus 300-KB-Datei â†’
  `500 not enough space (â€¦)`, kein Reboot, `GET /` liefert die Notfall-Seite.
- Per `--limit-rate` abgebrochener Upload â†’ Notfall-Seite (esp32dev).
- Wiederherstellung per curl â†’ UI wieder da. Die SPA lÃ¤dt im Browser ohne
  Konsolenfehler. Der Upload-Flow der Notfall-Seite ist im Browser-Pane
  geprÃ¼ft (Dummy-Tar â†’ `200` â†’ Reload).

**Nicht verifiziert:** Den Upload Ã¼ber die Notfall-Seite mit einem echten
UI-Tar gab es nur per curl; das Browser-Pane kann keine lokale Datei wÃ¤hlen.
Auf dem LilyGo (SD, ohne Flag) lÃ¤uft der unverÃ¤nderte Staged-Pfad, dort nicht
neu geflasht.

**Nebenbefund:** Mein PowerShell-Serial-Logger am nativen USB-CDC des S2 hat
das Board beim SchlieÃŸen/NeuÃ¶ffnen des Ports in den ROM-Download-Modus
geschickt (COM7, 303A:0002). Das Board war danach offline und wurde per USB
neu geflasht. Den S2-Port also nicht in einer Reopen-Schleife mit DTR-Toggle
mitschneiden.

## 2026-09-16 â€” UI-Tar-Upload auf dem LilyGo S3 (SD) gefixt: zu wenige offene Dateien

`POST /api/update/assets` scheiterte auf dem LilyGo sporadisch mit
`extract failed`, obwohl die SD genug Platz hat. Der native Test-Harness hatte
den Parser schon als Ursache ausgeschlossen.

**Eingrenzung am GerÃ¤t:**
- **Alte Firmware** (`02560d5-dirty`, 2,2 h Uptime, Datenlog aktiv): Das volle
  Tar (roh + gz, 522 KB) scheiterte nach 28 672 Byte der ersten Datei. Eine
  Ã¤ltere Leiche `index-V1ocpu6Q.js` (225 280 Byte) lag noch in `/www/assets`.
  Das gz-only-Tar ging durch.
- **Nach OTA-Neustart:** Auf der aktuellen Firmware gingen 13 von 13 Uploads
  durch. Ein sauberer Build von `02560d5` schaffte ebenfalls 10 von 10.
  Die Ã„nderungen aus 24b0eb7 waren also nicht der Fix, der Fehler hing am
  Laufzeitzustand.
- **Erste Hypothese:** ungeschÃ¼tzte SD-Lesezugriffe von ESPAsyncWebServer
  (bekannte `SdLock`-LÃ¼cke). Sie ist schwach, denn diese Lesezugriffe laufen
  im selben AsyncTCP-Task wie das Entpacken, und ein A/B-Test mit 3 Lesern
  blieb unauffÃ¤llig.
- **Belastungstest mit 4 parallelen JS-Downloads:** 0 von 15 Uploads ok, alle
  mit `open failed (â€¦)`. Das deutete auf `SD.begin()` mit dem Default
  `max_files = 5`: ESPAsyncWebServer hÃ¤lt jede ausgelieferte Datei fÃ¼r die
  ganze Ãœbertragung offen.
- **Beleg fÃ¼r die Handle-Grenze:** Bei 6â€“8 gleichzeitigen Downloads bekamen
  einige Clients nur 2 589 Byte, also die Notfall-Seite. Das Ã–ffnen der
  JS-Datei scheiterte, und `onNotFound` hielt die UI fÃ¼r fehlend.

**Root Cause:** Die Grenze von 5 gleichzeitig offenen Dateien auf der SD. Ein
Browser lÃ¤dt UI-Assets bzw. Log-CSVs parallel, und das Datenlog braucht eine
weitere Datei. Liegt das Entpacken in einem solchen Moment, schlÃ¤gt das
Ã–ffnen fehl.

**Fix:** `main.cpp` mountet die SD mit `max_files = 16` (`kSdMaxOpenFiles`,
mit Kommentar). Das betrifft nur Boards mit SD. LittleFS hat eigene
Defaults und ist nicht betroffen.

**Verifiziert:** `pio test -e native` (37/37), `pio run` auf allen drei Envs.
Am LilyGo per OTA, das Datenlog vorÃ¼bergehend auf 1 s gestellt:
- 4 JS-Leser + Log-CSV + Datei-Download â†’ 12 von 12 Uploads ok (vorher 0 von 15).
- 8 JS-Leser â†’ 8 von 8 ok.
- Tar-Upload wÃ¤hrend 8 gedrosselter Downloads â†’ `200`, alle Downloads
  vollstÃ¤ndig, keiner bekam die Notfall-Seite.
- UI danach aktuell. Das Log-Intervall steht wieder auf 5 s, `/stress` ist
  gelÃ¶scht.

**Nicht restlos geklÃ¤rt:** Zweimal trat vor dem Fix unter Last statt
`open failed` ein `write failed` auf (einmal bei einem 50-KB-Datei-Upload,
einmal beim Tar). Mit `max_files = 16` gab es das in 20 Uploads unter
starker Last nicht mehr. Die Ursache ist unbelegt.

**Nebenbefunde:**
- Die Notfall-Seite unterscheidet nicht zwischen â€žfehlt" und â€žkonnte nicht
  geÃ¶ffnet werden" (neuer Punkt in PLAN.md).
- Direkt nach dem ersten OTA-Boot lieferte die SD einmal eine leere Registry
  und `/config: not a directory`. Nach einem weiteren Neustart war alles
  normal, nicht erneut aufgetreten.
- Jede Ã„nderung einer Log-Konfiguration beginnt eine neue Log-Session. Vom
  Test liegen zwei zusÃ¤tzliche archivierte Sessions auf dem GerÃ¤t, die alte
  ist erhalten.
- Das Ã–ffnen von COM9 (USB-Serial-JTAG des S3) setzt das Board zurÃ¼ck.

## 2026-09-17 â€” Remote-Discovery + ESP-NOW-Unicast E2E am GerÃ¤t

Beide LittleFS-Boards (esp32dev = A, LOLIN S2 Mini = B) auf aktuellen
`main`-Stand geflasht und per HTTP gegeneinander getestet (Discovery Ã¼ber
ESP-NOW und MQTT, Remote-Item anlegen, `/set` Ã¼ber beide Transporte,
Verhalten bei Board-Ausfall/-Wiederkehr). Ergebnis: alle vier PLAN.md-Punkte
zu diesem Thema abgearbeitet und entfernt â€” Discovery findet die Items des
jeweils anderen Boards und filtert eigene korrekt heraus, `Remote`-Actuator
schaltet den echten Aktor auf dem Zielboard Ã¼ber beide Transporte, MQTT
(TCP-basiert) ist dabei durchgehend zuverlÃ¤ssig, ESP-NOW dagegen deutlich
verlustbehaftet (~1 von 8 Discovery-Scans erfolgreich trotz durchgehend
verbundener Boards) und ohne Retry-Mechanismus â€” das ist inhÃ¤rent (einzelne
unbestÃ¤tigte Pakete), aber jetzt als PLAN.md-Punkt festgehalten statt nur
vermutet. Dabei zwei weitere Befunde aufgedeckt: die ESP-NOW-Fehleranzeige
(`espnow.error`) kann nach einem erfolgreichen Write fÃ¤lschlich auf
â€žfehlgeschlagen" hÃ¤ngen bleiben (Single-Slot-Overwrite eines Ã¤lteren
Fehler-Reports, in PLAN.md dokumentiert), und das Ã–ffnen des COM-Ports
resettet auch das esp32dev-Board (nicht nur den LilyGo S3 wie bisher
bekannt) â€” deshalb wÃ¤hrend des Tests komplett auf Serial-Zugriff verzichtet
und rein Ã¼ber HTTP verifiziert.

**Nachtrag â€” ESP-NOW-Discovery-Verlustrate behoben:** Root Cause fÃ¼r die
oben beschriebene ~1-von-8-Trefferquote gefunden: `WiFi.setSleep(false)`
fehlte nach dem STA-Connect. Ohne das aktiviert der ESP32 Modem-Sleep, sobald
die STA-Verbindung steht â€” der Funk dÃ¶st zwischen den AP-Beacons, und
ESP-NOW-Pakete, die wÃ¤hrenddessen eintreffen, gehen komplett verloren (kein
gelegentliches RF-Rauschen, sondern ein systematischer Effekt). Fix:
`WiFi.setSleep(false)` in `main.cpp` direkt nach dem WLAN-Connect, vor der
ESP-NOW-Initialisierung. Nach Reflash beider Boards: 7 von 10
Discovery-Versuchen erfolgreich (davor 1 von 8â€“10), ab dem vierten Versuch
durchgehend 7/7 â€” deutliche, reproduzierbare Verbesserung. Aktor-Write Ã¼ber
den Remote-Pfad weiterhin bestÃ¤tigt funktionsfÃ¤hig. Der Fehleranzeige-Bug
bleibt als eigener PLAN.md-Punkt offen (unabhÃ¤ngig von der Sleep-Ursache).

**Nebenbefund beim Reflash:** Nach dem zweiten Flash-Vorgang (mit dem
Sleep-Fix) blieb das esp32dev-Board kurzzeitig unerreichbar â€” weder WLAN
noch lesbarer Serial-Output (nur Rauschen). Ein manueller Power-Cycle durch
den Nutzer hat es zuverlÃ¤ssig zurÃ¼ckgeholt; Ursache nicht geklÃ¤rt (mÃ¶glich:
unsauberer BOOT-Button-Ãœbergang beim vorherigen Upload-Versuch hat einen
inkonsistenten Flash-Zustand hinterlassen, der erst nach Reflash + kompletter
Power-Cycle sauber gebootet hat). Bei Ã¤hnlichem Verhalten kÃ¼nftig zuerst
Power-Cycle statt weiterer Serial-Diagnose versuchen.

Testkonfiguration (Sensoren/Aktoren/Transport-Settings) danach von beiden
Boards wieder entfernt.

## 2026-09-17 â€” Fix: ESP-NOW-Fehleranzeige blieb nach erfolgreicher Zustellung hÃ¤ngen

**Root Cause:** `EspNowTransport::onSendStatus()` (WiFi-Task) hat jeden
Zustellstatus nur in einem einzelnen Atomic (`deliveryReport_`) abgelegt;
`tick()` (loop-Task) hat davon nur den *zuletzt* eingetroffenen Report
gelesen und dabei alle dazwischen eingetroffenen Ã¼berschrieben. Trafen
zwischen zwei `tick()`-Aufrufen ein Erfolg und danach noch ein Ã¤lterer
Fehler-Callback eines parallel unterwegs gewesenen Pakets ein, gewann der
Fehler und blieb stehen â€” auch wenn der eigentliche Schreibvorgang
nachweislich angekommen war.

**Fix:** `deliveryErrorMsg_` wird jetzt direkt im Send-Callback
gesetzt/gecleart (mutex-geschÃ¼tzt), nicht mehr Ã¼ber `tick()` gepuffert â€”
jedes Ereignis wird einzeln und in der Reihenfolge verarbeitet, in der es
eintrifft. `EspNowTransport.h/.cpp` (SensActCtrl), kein API-Vertrag
betroffen.

**Verifiziert:** `pio test -e native` (224/224), `pio run` auf allen drei
Firmware-Envs. Am GerÃ¤t (esp32dev = A, LOLIN S2 Mini = B, echter
Power-Cycle von A statt nur ESP-NOW-Toggle, weil der Transport laut Design
auch bei `espnow.enabled=false` weiterlÃ¤uft): Write bei abgestecktem A â†’
Fehleranzeige erscheint korrekt; A wieder angesteckt, Write erneut
erfolgreich â†’ Fehleranzeige cleart sofort, kein HÃ¤ngenbleiben mehr.
PLAN.md-Punkt entfernt.

## 2026-09-17 â€” Add-Item-Dialog: Discovery herausgelÃ¶st + 2-Step-Dialog

**Problem:** `AddItemModal.tsx` (1782 Z., ~70 `useState`, 16 nebeneinander
liegende `role && type`-Guards) war unÃ¼bersichtlich, und Discovery lag
darin begraben: Remote-Discovery erschien erst nach Rolle â†’ Typ `Remote` â†’
Transport `mqtt|espnow` â€” man musste also schon wissen, was man sucht,
bevor man suchen durfte.

**Umsetzung (reiner Layout-/Navigations-Umbau, FeldblÃ¶cke und
`handleSubmit` unverÃ¤ndert):**

- Zwei neue Aktions-Karten Ã¼ber der GerÃ¤teliste, jeweils nach dem Vorbild
  der WLAN-Suche in `NetworkPage` (Button im `control`-Slot von
  `SettingsCard`): â€žGerÃ¤te suchenâ€œ (`DiscoverDevicesCard`) und â€žGerÃ¤t
  hinzufÃ¼genâ€œ (drei Zeilen direkt in `DevicesPage`). Damit entfallen die
  Header-Buttons und der `SpeedDialFab` auf dieser Seite â€” die Aktionen
  stehen jetzt auf jeder Breite im Seitenfluss. Die Treffer klappen **in
  der Such-Karte selbst** auf statt in einem Dialog; gesucht werden **alle
  Quellen parallel**: `discoverRemote('mqtt')` + `discoverRemote('espnow')` +
  OneWire-Scan Ã¼ber alle bereits konfigurierten DS18B20-Pins (letztere
  sequenziell, weil `/api/bus/scan` synchron im AsyncTCP-Handler lÃ¤uft).
  Jede Quelle rendert, sobald sie fertig ist; nicht verfÃ¼gbare Transporte
  (409) werden still Ã¼bersprungen, alles andere wird eine Notiz. Treffer
  sind nach Quelle gruppiert, Bekanntes ist â€žbereits angelegtâ€œ markiert.
- Klick auf einen Treffer Ã¶ffnet den Anlege-Dialog **vorausgefÃ¼llt**
  (neue Prop `prefill?: ItemPrefill`). Der Hydrations-Effect keyt weiter
  auf `[open]` â€” `prefill` gehÃ¶rt bewusst *nicht* in die Deps, sonst wÃ¼rde
  jeder SSE-Tick eine halb getippte Eingabe wegwischen; Vertrag: im selben
  Handler setzen, der den Dialog Ã¶ffnet, in `onClose` wieder `null`.
- `AddItemModal` ist jetzt zweistufig: Schritt 1 ist der neue
  `ItemTypePicker` (Rolle Ã¼ber das gemeinsame `Segmented`, darunter der
  gruppierte Typ-Katalog aus dem neuen `itemTypes.ts` mit je einer
  ErklÃ¤rzeile) statt der drei `<select><optgroup>`-Dropdowns; Schritt 2
  zeigt nur noch ID + die Felder dieses einen Typs. Edit Ã¶ffnet direkt in
  Schritt 2 (die beiden `disabled`-Selects entfallen); die neue Unterzeile
  `Rolle Â· Typ` trÃ¤gt die Information, die vorher nur im Select stand.
- Der DS18B20-Inline-Scan bleibt im Formular â€” er ist ein Feld-Helfer fÃ¼r
  einen manuell eingetippten Pin, keine GerÃ¤te-Suche.

Netto âˆ’150/+30 Zeilen in `AddItemModal.tsx`, ohne Churn in den
per-Typ-FeldblÃ¶cken. Keine Firmware-/Routen-Ã„nderung, `openapi.yaml`
unberÃ¼hrt.

**Verifiziert:** `pnpm typecheck` + `pnpm build` grÃ¼n. Gegen esp32dev live
durchgeklickt: Schritt 1/2 inkl. ZurÃ¼ck und Rollenwechsel, Edit eines
PID-Reglers (kein ZurÃ¼ck-Chevron, AutoTune intakt), verschachteltes
Ã–ffnen aus â€žDashboard-Inhalteâ€œ (startet in Schritt 1), Suche findet alle
drei Quellen â€” OneWire GPIO 2 (`28:ff:19:â€¦`, â€žbereits angelegtâ€œ),
`MQTT Â· brewcontrol-esp32dev` (Sensor) und `ESP-NOW Â· brewcontrol-lolin`
(Aktor `IDS1`) â€”, alle Prefill-Pfade inkl. sichtbar vorausgewÃ¤hlter
Bus-Adresse und automatisch auf â€žAktorâ€œ gewechselter Rolle, DS18B20
end-to-end angelegt und wieder gelÃ¶scht, kein Prefill-Leak beim nÃ¤chsten
â€ž+ HinzufÃ¼genâ€œ, beide Karten bei 375Ã—812. Keine Konsolenfehler.

**Nebenbefund:** ein Zwischenstand hatte beide Buttons in *einer* Karte â€”
zwei Buttons im `control`-Slot von `SettingsCard` sind `shrink-0`, wÃ¤hrend
der Textblock `flex-1 min-w-0` ist, also zerquetschen sie auf einem
375-px-Display den Titel auf wenige Zeichen pro Zeile. Eine Karte pro
Aktion umgeht das; wer je zwei Buttons in einen `control`-Slot legt,
lÃ¤uft wieder hinein.

## 2026-09-17 â€” Dashboard-Inhalte-Dialog: Auswahlliste statt Checkbox-WÃ¼ste

`DashboardContentModal` bestand aus sechs `fieldset`-BlÃ¶cken mit nativen
Checkboxen im Flow-Umbruch: ~14 px TrefferflÃ¤che (schlecht am Tablet),
keine Hierarchie zwischen Gruppen und Inhalten, nur rohe IDs ohne Kontext,
kein Hinweis wie viel ausgewÃ¤hlt ist, und die drei
â€ž+ Neues â€¦ erstellenâ€œ-Links sahen in `text-faint` wie deaktivierter Text
aus.

Ersetzt durch eine WinUI-ListView-artige Auswahlliste:

- Jeder Eintrag ist eine vollbreite Zeile (Rollen-Icon | Name | Detail |
  Checkbox, ~44 px hoch, ganze Zeile klickbar), ausgewÃ¤hlte Zeilen mit
  `bg-accent/10` + Accent-Icon.
- Die Detailspalte zeigt Live-Kontext aus dem Snapshot: Sensor-Messwert
  bzw. â€žn KanÃ¤leâ€œ bei Multi-Channel-IDs, An/Aus bei binÃ¤ren Aktoren,
  Sollwert beim Regler, Serien-/Schrittzahl bei Chart und Programm,
  Dauer beim Timer.
- GruppenkÃ¶pfe kleben beim Scrollen (`sticky top-0 bg-surface`) und
  tragen einen `n/m`-ZÃ¤hler; im Kopf steht â€žx von y ausgewÃ¤hltâ€œ.
- Suchfeld erst ab mehr als 8 EintrÃ¤gen (`SEARCH_THRESHOLD`) â€” filtert
  Ã¼ber die Labels, leere Gruppen fallen weg, sonst â€žKeine Trefferâ€œ.
- Die Erstellen-Aktionen sind normale Zeilen mit Plus-Icon und stehen am
  Ende **ihrer** Gruppe (â€žNeuer Sensorâ€œ unter Sensoren usw.) statt als
  blasser Link-Block am Listenende. Charts haben keine â€” ein Chart wird
  auf seiner eigenen Seite angelegt. Eine leere Gruppe bleibt sichtbar,
  solange sie von hier aus befÃ¼llt werden kann, damit der erste Sensor
  eines frischen GerÃ¤ts einen Klick entfernt ist. WÃ¤hrend einer Suche
  sind die Zeilen ausgeblendet (kein Suchtreffer).

DafÃ¼r bekam `AddItemModal` eine optionale Prop `initialRole`: der
Typ-Picker startet auf der Rolle der angeklickten Gruppe, sein
Segmented-Control schaltet weiterhin frei um. Zwei Zeilen dort, sonst
keine Ã„nderung an dem Dialog.

**Verifiziert:** `pnpm typecheck` grÃ¼n. Live gegen `brewcontrol.local`
(LilyGo, 12 EintrÃ¤ge) durchgeklickt: Zeilenklick schaltet um und
aktualisiert Kopf- und GruppenzÃ¤hler, Suche â€žmaâ€œ filtert auf Regler/
Charts/Programme, Scrollen mit klebenden KÃ¶pfen, Light- und Dark-Theme,
375x812. â€žNeuer Reglerâ€œ Ã¶ffnet den Typ-Picker auf Regler, â€žNeuer Sensorâ€œ
auf Sensor (Rolle wechselt pro Klick, kein HÃ¤ngenbleiben).
AbschlieÃŸend mit â€žAbbrechenâ€œ verlassen â€” keine Config auf dem GerÃ¤t
verÃ¤ndert. Keine Konsolenfehler.
---

## 2026-09-18 â€” WebSocket-Autodiscovery per mDNS + Kopplung durch RÃ¼ckruf

**Ausgangslage:** Eine WebSocket-Remote-Verbindung musste an zwei Stellen von
Hand eingerichtet werden â€” die Hub-URL auf dem Sensor-Board, das Remote-Item auf
dem GerÃ¤t mit der UI. Eine wechselnde DHCP-IP brach sie.

**Verworfene Alternative â€” Rollentausch.** Naheliegend war, die Topologie
umzudrehen (Datenbesitzer = Server, Konsument = Client pro Peer). Die Library
kÃ¶nnte das sofort: `WebSocketTransport.h:23-25` hÃ¤lt ausdrÃ¼cklich fest, dass die
Rollen nur bestimmen, *wer* verbindet, und die Retain-Emulation lÃ¤uft
symmetrisch. Dagegen sprach der blockierende Connect: `WebSocketsClient::loop()`
verbindet synchron (bis `WEBSOCKETS_TCP_TIMEOUT`, hier 1 s) und wiederholt das
alle 5 s je unerreichbarem Peer â€” beim Rollentausch zahlt das genau das Board
mit dem Regler. Begrenzbar wÃ¤re es (Round-Robin Ã¼ber getrennte Peers), aber
belegen lieÃŸe sich das erst am GerÃ¤t.

**Umsetzung â€” RÃ¼ckruf.** Die Topologie bleibt, wie sie ist; nur die
*Konfiguration* wandert auf das GerÃ¤t mit der UI:

1. **Jedes Board kÃ¼ndigt sich an.** `startMDNS()` in `main.cpp` inseriert
   zusÃ¤tzlich `_sensactctrl._tcp` auf Port 80 â€” dem Port der HTTP-API, die jedes
   Board tatsÃ¤chlich bedient â€” mit TXT `dev`, `prefix`, `ver` und `ws`
   (eigener Hub-Port, `0` = kein Hub). Der initiale `startMDNS()`-Aufruf
   wanderte dafÃ¼r hinter `settingsStore.loadFromSD()`, weil die TXT-Records aus
   den Settings kommen; der Re-Announce bei `STA_GOT_IP` blieb unverÃ¤ndert.
2. **`MdnsBrowser`** (neu, `MdnsBrowser.h/.cpp`) durchsucht das LAN. Gleiche
   Zustandsmaschine wie `SensActCtrl::DiscoveryScanner` (3-s-Fenster, 30-s-TTL,
   `requestScan()`/`takeResults()` unter Mutex), damit der HTTP-Handler nur
   armen und abholen kann und die Query aus `loop()` lÃ¤uft. Bewusst die
   asynchrone IDF-API (`mdns_query_async_new` + `mdns_query_async_get_results`
   mit Timeout 0), **nicht** `MDNS.queryService()` â€” das blockiert das ganze
   Suchfenster.
3. **`GET /api/remote/peers`** liefert die Boards im 202-Poll-Muster der
   Ã¼brigen Scans. Ob ein Board schon benutzt wird, berechnet das Frontend aus
   `GET /api/config`, das es fÃ¼r den Scan ohnehin lÃ¤dt â€” dafÃ¼r braucht die
   Firmware nichts zu wissen.
4. **`POST /api/remote/pair`** schickt dem Ziel-Board dessen eigene
   `POST /api/settings` mit `websocket.publishEnabled` + `hubUrl`. Kein neuer
   Endpoint auf der EmpfÃ¤ngerseite: Validierung, Persistenz und Reboot sind
   dort schon implementiert. Der Aufruf lÃ¤uft Ã¼ber `HTTPClient` aus
   `WebUI::tick()`, nicht aus dem Handler â€” der async_tcp-Task bedient jeden
   Request und den SSE-Stream, der darf fÃ¼r einen Netz-Roundtrip nicht stehen.
   Deshalb antwortet die Route `202` und `GET /api/remote/pair` liefert das
   Ergebnis (`200` gekoppelt, `401` Passwort nÃ¶tig, `502` nicht erreichbar,
   `409` ohne eigenen Hub). PasswortgeschÃ¼tzte Ziele werden vorher Ã¼ber
   `/api/auth/login` angemeldet und das `bcsid`-Cookie mitgeschickt.
   Timeout 2 s, weil jede Sekunde davon eine Sekunde ohne Sensor-Tick ist.
5. **Item-Suche fÃ¼r WebSocket** ist damit die triviale Verdrahtung, die in
   PLAN.md stand: ein dritter `DiscoveryScanner` in `RemoteDiscovery` Ã¼ber
   `webSocketService.hubTransport()`, plus `websocket` im Transport-Enum von
   `/api/remote/discover`.

**Frontend:** `DiscoverDevicesCard` hat jetzt zwei Stufen â€” die Gruppe â€žBoards
im Netz" (Koppeln-Button, â€ždieses GerÃ¤t" beim eigenen Board, â€žgekoppelt" wenn
schon ein Item darauf zeigt, Passwortfeld erst wenn das Ziel `401` antwortet)
und darunter wie bisher die gefundenen Items, nun auch aus dem
WebSocket-Transport. `ItemPrefill.transport` kennt `websocket`; im
`AddItemModal` brauchte es kein neues Feld, weil der Hub gerÃ¤teweit ist. Die
Hub-URL bleibt auf der WebSocket-Seite als Fallback stehen, mit einem Hinweis,
dass normalerweise vom Hub aus gekoppelt wird.

**Zwei Dinge fielen beim Selbst-Review auf und wurden gleich mit erledigt:**

- Die Pairing-Felder in `WebUI` werden vom async_tcp-Task gelesen und von
  loopTask geschrieben. Bei `int`/`bool` wÃ¤re das wie bei `rebootAtMs_`
  tolerierbar, bei `String` nicht: eine Zuweisung gibt den alten Puffer frei und
  kann dem Leser einen Dangling-Pointer hinterlassen â€” genau der Grund, warum
  `WebSocketTransport::lastError_` ein nacktes Literal ist. Jetzt unter
  `pairMutex_`, mit zwei Flags (`pairArmed_` = wartet auf tick(), `pairBusy_` =
  armiert oder unterwegs) und **ohne** gehaltene Sperre wÃ¤hrend des
  HTTP-Roundtrips, damit der GET-Poll nicht 2 s blockiert.
- `startMDNS()` lÃ¤uft auf dem WiFi-Event-Task und ruft `MDNS.end()`; `mdns_free()`
  gibt dabei auch ein offenes Such-Objekt frei. Ein WLAN-Reconnect mitten im
  3-s-Scan wÃ¤re ein Use-after-free gewesen. `MdnsBrowser::abandonSearch()` wird
  jetzt vor `MDNS.end()` gerufen, `tick()` lÃ¤sst den Zeiger daraufhin fallen
  (ohne `delete`) und fÃ¤llt auf Idle zurÃ¼ck â€” der nÃ¤chste Poll startet einfach
  neu.

**Keine Library-Ã„nderung** â€” SensActCtrl blieb unangetastet.

**Verifiziert:** `pio test -e native` 224/224 grÃ¼n (Regression),
`pio run` baut alle drei Envs (esp32dev 88.1 % Flash, lolin_s2_mini 84.9 %,
lilygo_t_display_s3_amoled 24.4 %),
`pnpm typecheck` + `pnpm build` grÃ¼n, `redocly lint` sauber (nur die
vorbestehende `info-license`-Warnung). Der ganze UI-Ablauf gegen einen
HTTP-Mock im Scratchpad durchgespielt: Scan listet drei Boards (eigenes als
â€ždieses GerÃ¤t"), Koppeln setzt die Zeile auf â€žgekoppelt" und meldet â€žBoard
gekoppelt, es startet jetzt neu", das geschÃ¼tzte Board antwortet `401` â†’
Passwortfeld â†’ Erfolg, danach erscheint die Gruppe â€žWebSocket Â· kessel2" mit
ihren Items, und ein Klick darauf Ã¶ffnet den Dialog mit `device=kessel2`,
`remote_id=kessel_temp`, Prefix und Transport-Schalter auf WebSocket.
MQTT/ESP-NOW-`409` werden weiterhin still Ã¼bersprungen.

**Offen (in PLAN.md):** die Hardware-Verifikation am echten Board â€” insbesondere
ob `.local` in der gespeicherten `hubUrl` auflÃ¶st
(`CONFIG_LWIP_DNS_SUPPORT_MDNS_QUERIES=y` ist bisher nur aus der
Framework-Config belegt, nicht am GerÃ¤t). Neu notiert wurden auÃŸerdem der
`/set`-Broadcast im Hub (Unicast wÃ¤re ~15 Zeilen in der Library) und
â€žzuletzt gesehen" pro Remote-Item als Ersatz fÃ¼r den fehlenden Peer-Status.
---

## 2026-09-18 â€” mDNS-Kopplung E2E am GerÃ¤t + `self` entfernt

Hardware-Runde zur Autodiscovery (Eintrag oben), esp32dev als Hub/Master
(192.168.178.74), LOLIN S2 Mini als Leaf (192.168.178.82), LilyGo bewusst nur
als Zuschauer in der Suche. Alles Ã¼ber HTTP, kein Serial (Port-Open resettet
beide Boards, PLAN.md).

**Durchgelaufen:**

- Neue Firmware auf allen drei Boards, alle antworten auf `/api/remote/peers`.
- `409 websocket hub not enabled` ohne eigenen Hub, `400 missing host` ohne
  `host`.
- mDNS-Suche von allen drei Boards: jedes findet die beiden anderen, TXT `dev`
  und `prefix` korrekt. `ws` stimmt ebenfalls â€” nachdem A den Hub bekam, meldet
  die Suche von B aus `ws_port: 8081` fÃ¼r A und `0` fÃ¼r den LilyGo, auch nach
  A's Reboot (der Re-Announce bei `STA_GOT_IP` greift).
- Kopplung: `202` â†’ `code 200`. B hat danach
  `hubUrl: ws://brewcontrol-esp32dev.local:8081` gespeichert und ist
  `connected=True`. **Damit ist die offene Frage beantwortet: `.local` lÃ¶st am
  GerÃ¤t auf** (`CONFIG_LWIP_DNS_SUPPORT_MDNS_QUERIES=y` war bisher nur aus der
  Framework-Config belegt). A meldet stabil `hubClients=1`.
- Item-Suche `?transport=websocket` findet B's Items. Ein auf B **neu**
  angelegter Sensor (`DigitalInput` GPIO 3, Pullup â€” als Testsensor ohne
  Hardware) erscheint dabei ohne Reboot, die Live-Hooks des `RemotePublisher`
  greifen also auch hier.
- Remote-Sensor auf A: `v=1 ok=True`, Zeitstempel laufen im 2-s-Takt.
- `/set` von A auf B's Aktor `IDS1`: 0.1 kam innerhalb einer Sekunde an
  (`v=target=0.1`), danach sauber zurÃ¼ck auf 0.
- `401`-Pfad mit echtem Zugriffsschutz: Passwort auf B gesetzt â†’ Kopplung ohne
  Passwort liefert `code 401` â€žBoard â€¦ ist passwortgeschÃ¼tzt", mit Passwort
  `code 200` (der Login-plus-Cookie-Weg trÃ¤gt also am GerÃ¤t). Passwort danach
  wieder entfernt.
- `502` bei unerreichbarem Board nach ~2 s (`kPairTimeoutMs`).
- **Die Auslagerung aus dem Handler ist belegt:** wÃ¤hrend loopTask 2 s im
  blockierenden Connect hing, hat `GET /api/remote/pair` weiter geantwortet und
  `state: running` geliefert.
- Reboot B: Reconnect von selbst nach ~4â€“6 s. Reboot A: das Remote-Item kommt
  aus `registry.json` zurÃ¼ck und B verbindet sich ohne erneutes Koppeln.
- A bleibt flÃ¼ssig: Snapshot-Latenz 22â€“46 ms (zwei AusreiÃŸer ~320 ms), keine
  Stalls in Sekunden-GrÃ¶ÃŸe â€” erwartungsgemÃ¤ÃŸ, weil A in dieser Topologie nie
  selbst wÃ¤hlt.
- `hubClients` stand direkt nach B's Reboot kurz auf `2` (der alte Socket war
  noch gezÃ¤hlt) und fiel dann auf `1` â€” der Heartbeat rÃ¤umt auf, kein Leck von
  Client-Slots (relevant, weil `WEBSOCKETS_SERVER_CLIENT_MAX` = 5 ist).

**Fund: `self` war toter Code.** Kein Board listet sich selbst â€” der
ESP32-mDNS-Responder beantwortet eigene Queries nicht, auf allen drei Boards
bestÃ¤tigt. Das Feld war damit immer `false`, die â€ždieses GerÃ¤t"-Zeile in der UI
unerreichbar und die Aussage in `openapi.yaml`/`README.md` (â€žThis device is
reported too, marked `self`") falsch. Entfernt: `DiscoveredPeer::self` samt
`MdnsBrowser::begin()`/`ownHostname_` (die nur dafÃ¼r existierten), das Feld in
der `/api/remote/peers`-Response, in `types.ts` und der UI-Zweig. Doku
korrigiert, dazu je ein Kommentar in `MdnsBrowser.h`, `WebUI.cpp` und
`types.ts`, damit das Feld nicht wieder eingebaut wird.

**Nebenbei bestÃ¤tigt:** der Messwert auf A wurde beim Ausfall von B *nicht* als
veraltet markiert â€” der Backlog-Punkt â€žzuletzt gesehen pro Remote-Item" ist real
und nicht bloÃŸ theoretisch.

**Verifiziert:** `pio run -e esp32dev` und `-e lolin_s2_mini` bauen nach dem
AufrÃ¤umen weiter, `pnpm typecheck` + `build` grÃ¼n, `redocly lint` sauber.

**Zustand der Testboards danach** (bewusst so gelassen): esp32dev ist Hub, sein
alter `publishEnabled` auf den LilyGo ist aus; S2 Mini ist an ihn gekoppelt und
hat den Testsensor `wstest`; esp32dev hat die Remote-Items `lolin_wstest` und
`lolin_ids1`.

## 2026-09-18 â€” Captive-Portal-UX angeglichen + Reload-mit-Retry in Preact Ã¼bernommen

Zwei getrennte, aber verwandte Ã„nderungen: (1) Captive Portal
(`WiFiSetupPortal.cpp`) und die Preact-Netzwerk-Settings-Seite
(`NetworkPage.tsx`) machten denselben WiFi-Connect-Flow mit unterschiedlicher
UX â€” echtes Code-Sharing wÃ¼rde bedeuten, dass der Portal-Server die gebaute
SPA aus dem (zum Portal-Zeitpunkt bereits gemounteten) Filesystem ausliefert;
bewusst verworfen (grÃ¶ÃŸerer Umbau, Risiko in restriktiven Captive-Portal-
WebViews, zusÃ¤tzlicher Flash-Bedarf auf der knappen 256-KB-LittleFS-Partition).
Stattdessen die Netzwerkliste im Captive Portal von Hand an NetworkPage
angeglichen: Listen-Darstellung mit Signalbalken statt `<select>` (gleiche
RSSI-Bucket-Schwellen: â‰¥-55/-65/-75/-85 dBm â†’ 4/3/2/1/0 Balken), Dedupe nach
SSID (stÃ¤rkster Treffer gewinnt) + Sortierung nach Signal, "Enter network
manually"-Fallback â€” alles weiterhin reines Vanilla-JS/Inline-CSS ohne
Build-Schritt, nur `kSetupHtml` in `WiFiSetupPortal.cpp` geÃ¤ndert, Server-
Handler unangetastet.

(2) Die Reload-mit-Retry-Anzeige des Captive Portals (`afterSaved()`:
Countdown, periodischer `fetch(url,{mode:'no-cors'})`-Probe, Auto-Redirect
beim ersten Erfolg, garantierter Fallback-Link) als `ReloadRetry`-Komponente
nach Preact Ã¼bernommen (`web/src/components/ReloadRetry.tsx`) und an die
Stelle der bisherigen statischen "GerÃ¤t startet neuâ€¦"-BlÃ¶cke gesetzt:
`NetworkPage.tsx` (WLAN-Wechsel/Hostname-Wechsel mit `{host}.local`-Ziel,
WLAN-Reset bewusst ohne Ziel â€” Board wird zum AP, nicht mehr Ã¼ber die
aktuelle Verbindung erreichbar), `EspNowPage.tsx`, `MqttPage.tsx`,
`WebhookPage.tsx`, `WebSocketPage.tsx`, `BackupPage.tsx` sowie neu
`FirmwarePage.tsx` (hatte bisher nach Update-Install gar keine Neustart-
Anzeige). Bei Ziel-Origin gleich der aktuellen Seite lÃ¤dt `ReloadRetry` per
`location.reload()` (Pfad bleibt erhalten), bei Hostname-Wechsel per
`location.href` auf die neue `.local`-Adresse.

**Verifiziert:** `pio run -e esp32dev` kompiliert (Flash 88.3 %, RAM 18.2 %),
`pnpm typecheck` grÃ¼n, alle geÃ¤nderten Preact-Seiten im Dev-Server gegen ein
echtes Testboard ohne Konsolenfehler geladen (Netzwerk-, MQTT-, Backup- und
Firmware-Seite) â€” reboot-auslÃ¶sende Aktionen dabei bewusst nicht angeklickt,
um das laufende physische GerÃ¤t nicht neu zu starten. Der tatsÃ¤chliche
Auto-Reconnect-Erfolgsfall (Board antwortet nach echtem Reboot wieder) ist
damit nicht E2E getestet, die Logik ist aber ein direkter Port der bereits
produktiv laufenden Captive-Portal-Implementierung.

## 2026-09-18 â€” Fix: manueller Firmware-/UI-Upload zeigte weder Erfolg noch Fehler an

Nutzer-Nachfrage, ob das manuelle Hochladen des UI-Pakets einen Neustart
braucht, deckte einen Bug in `FirmwarePage.tsx` auf: der `.catch()`-Handler
beider Uploads (`Firmware (.bin)`/`UI-Paket (.tar)`) setzte den Fortschritt
bei einem Fehler auf `null` â€” der Ladebalken verschwand dabei kommentarlos,
ohne jede Fehlermeldung. Bei Erfolg blieb er dauerhaft bei â€ž100%" hÃ¤ngen,
ebenfalls ohne BestÃ¤tigung. Laut `docs/openapi.yaml` reboottet nur der
Firmware-Upload (`POST /api/update/firmware`, ~500 ms nach der Antwort);
der UI-Paket-Upload (`POST /api/update/assets`) explizit **nicht** â€” der
Swap auf `/www` passiert im nÃ¤chsten Main-Loop-Tick.

Fix: Firmware-Upload-Erfolg nutzt jetzt denselben `rebooting`-State/
`ReloadRetry` wie der GitHub-Install-Flow (Polling wird vorher gestoppt).
UI-Paket-Upload zeigt bei Erfolg eine grÃ¼ne "UI-Paket installiert."-Zeile
(kein Reboot). Beide zeigen bei Fehler jetzt den tatsÃ¤chlichen Server-Text
(z. B. `Bad Size` bzw. `extract failed: â€¦`) statt stillschweigend zu
verschwinden.

**Verifiziert:** `pnpm typecheck` grÃ¼n, Seite im Dev-Server gegen das
Testboard ohne Konsolenfehler geladen. Kein echter Upload getestet â€” Risiko,
Ã¼ber den echten Firmware-/Asset-Update-Endpoint des laufenden GerÃ¤ts eine
kaputte Datei zu flashen.

## 2026-09-19 â€” Dashboard: Elemente per Drag & Drop anordnen

Die Dashboard-Anordnung war fest verdrahtet (Programm-Spalte, Chart-Bereich,
Karten-Grid in fester Reihenfolge). Jetzt liegt sie als Baum von Bereichen im
Dashboard selbst und ist im Bearbeiten-Modus per Drag & Drop verÃ¤nderbar â€”
Vorbild war ein Docking-System im IDE-Stil (Nutzer-Referenz: Video zu
â€žDynamix Layout").

**Entscheidungen (mit dem Nutzer geklÃ¤rt):** Docking-Bereiche mit ziehbaren
Trennern statt eines festen Rasters; beliebig viele Kartengruppen, eine Karte
darf auch allein einen Bereich belegen; Speicherung am GerÃ¤t pro Dashboard; die
automatische Kopplung â€žerster Regler eines Programms steht Ã¼ber dem
Programm-Widget" entfÃ¤llt ersatzlos (der Regler ist jetzt frei platzierbar); ein
Mehrkanal-Sensor bleibt eine Einheit (Ref Ã¼ber die Base-Id, Kanal-Cards
untereinander). Anordnen und Trenner nur im Bearbeiten-Modus; mobil (<1024 px)
wird der Baum in Lesereihenfolge linearisiert und ist dort nicht editierbar.

**Keine neue Dependency.** `dockview-core` (+85 KB gz) hÃ¤tte das Bundle fast
verdoppelt, `@dynamix-layout/core` (7,5 KB gz) rechnet nur Geometrie, ist
Tab-zentriert und dokumentiert keinen Touch-Support. Die eigene Umsetzung kostet
**+3,9 KB gz** (JS 105,20 â†’ 109,07 KB, gegen denselben Commit gemessen).

**Datenmodell:** `LayoutNode` = `{split:'row'|'col', sizes, children}` oder
`{items:[ref]}`; Refs tragen einen Typ-PrÃ¤fix (`sensor/<baseId>`, `actuator/`,
`controller/`, `chart/`, `program/`, `timer/`), weil Charts, Programme und Timer
eigene Id-RÃ¤ume haben. Ein Ref allein im Blatt fÃ¼llt seinen Bereich (Chart und
Programm mit `fill`), mehrere flieÃŸen als Karten-Raster, in dem Chart und
Programm die ganze Zeile nehmen.

**`web/src/dashboardLayout.ts` (neu, reine Funktionen):** `memberRefs`,
`defaultLayout` (bildet die bisherige Anordnung nach, damit bestehende
Dashboards unverÃ¤ndert aussehen), `reconcile`, `normalize`, `moveRef`,
`resizeSplit`, `renameRef`, `linearize`. `moveRef` markiert die gezogene Ref
zuerst mit einem Platzhalter gleicher LÃ¤nge, fÃ¼gt dann am Ziel ein und entfernt
den Platzhalter erst danach â€” so bleiben Zielpfad und EinfÃ¼ge-Index gÃ¼ltig,
unabhÃ¤ngig davon, woher die Karte kommt. `reconcile` lÃ¤uft bei jedem Render:
tote Refs raus, neue kleine Karten an die letzte Kartengruppe, neue Charts und
Programme in einen eigenen Bereich, kaputtes JSON â†’ Default-Anordnung.

**`web/src/components/DashboardLayout.tsx` (neu):** rekursives Flex-Rendering,
Trenner mit Pointer-Capture (Live-Entwurf im lokalen State, Commit erst bei
`pointerup`), Drag am Griff Ã¼ber der Karte (ab 4 px Bewegung), Hit-Test Ã¼ber die
Rects der `data-path`-Elemente, Overlay fÃ¼r Zielbereich und EinfÃ¼ge-Marke,
Abbruch per Escape. Die Container tragen bewusst kein `transform`/`filter`:
`ConfirmModal` und die Ã¼brigen Dialoge rendern `fixed` ohne Portal und wÃ¼rden
sonst am Bereich statt am Fenster ausgerichtet (am laufenden UI gegengeprÃ¼ft).
Die Render-Helfer sind einfache Funktionen statt verschachtelter Komponenten â€”
als Komponenten hÃ¤tten sie bei jedem Snapshot (1 Hz) eine neue IdentitÃ¤t und den
uPlot-Chart sekÃ¼ndlich neu aufgebaut.

**Firmware:** `DashboardStore::DashboardCfg` bekommt ein `JsonDocument layout`,
das die Firmware nur durchreicht (laden, serialisieren, in `fillFromJson`
ersetzen); fehlt der SchlÃ¼ssel im Body, wird die Anordnung gelÃ¶scht â€” dieselbe
Replace-Semantik wie bei allen Listen. Damit das Frontend nie versehentlich ein
Feld verliert, schickt `Dashboard.tsx` jedes Update Ã¼ber ein neues `dashBody()`,
das immer den vollstÃ¤ndigen Datensatz sendet (die Feldliste war seit den
Darstellungsmodi ohnehin an zwei Stellen dupliziert). `GET /api/backup` nutzt
`store_.serialize()`, das Layout ist damit automatisch im Backup;
`docs/openapi.yaml` kennt jetzt `DashboardLayoutNode`.

**Verifikation:** 22 Checks der reinen Layout-Funktionen per Wegwerf-Skript
(u.a. Verschieben in dieselbe Gruppe, letztes Item verlÃ¤sst einen Bereich,
Kanten-Andocken im gleichgerichteten Split, kaputtes JSON, keine Duplikate);
`pnpm typecheck` grÃ¼n; `pio run -e esp32dev` grÃ¼n; Redocly valide (nur die
bekannte `license`-Warnung). Im Browser gegen einen lokalen Mock-Server geprÃ¼ft
(das Testboard lÃ¤uft noch ohne das Feld, und ein Schreibzugriff auf die echte
GerÃ¤tekonfiguration wÃ¤re fÃ¼r einen UI-Test zu invasiv): Default-Anordnung
identisch zur bisherigen, Andocken an eine Kante, Einsortieren an eine bestimmte
Position einer Gruppe, Trenner ziehen (Chart skaliert per ResizeObserver mit),
Persistenz Ã¼ber Reload, **genau ein POST pro Aktion**, ConfirmModal zentriert
Ã¼ber der ganzen Seite, Dashboard mit toter Chart-Referenz ohne leeren Bereich,
Entfernen klappt den Bereich zu, mobile Linearisierung inklusive
Programm-Bottom-Sheet.

**Unterwegs gefixt:** Die Andock-Zone war als 25 % der BereichsgrÃ¶ÃŸe definiert â€”
bei 990 px Breite ein 247-px-Band, das die linke HÃ¤lfte der ersten Karte
verschluckte und die erste Position einer Gruppe unerreichbar machte. Jetzt
hÃ¶chstens 64 px (und weiterhin maximal ein Viertel, damit kleine Bereiche eine
Mitte behalten).

**Bewusst so:** Das Entfernen einer Karte filtert deren Ref nur beim Rendern
heraus, die gespeicherte Anordnung behÃ¤lt sie bis zum nÃ¤chsten Anordnen. Eine
spÃ¤ter wieder hinzugefÃ¼gte Karte landet dadurch an ihrem alten Platz (am UI
beobachtet und so belassen â€” PositionsgedÃ¤chtnis ist hier das nÃ¼tzlichere
Verhalten); wirklich neue Karten hÃ¤ngen sich an die letzte Kartengruppe.

**Offen:** Der Escape-Abbruch lieÃŸ sich nicht automatisiert prÃ¼fen (die
Browser-Automatisierung kann keinen gedrÃ¼ckten Mausknopf halten). Die Persistenz
am echten GerÃ¤t steht bis zum nÃ¤chsten Flash aus, siehe PLAN.md.

## 2026-09-19 â€” Dashboard-Layout: Kartenbereiche wachsen nicht mehr ins Leere

Nutzer-Feedback zum frisch gebauten Drag-&-Drop-Layout: die Ansicht im
Bearbeiten-Modus deckt sich nicht mit der danach. Ein Bereich, den man im
Bearbeiten-Modus so weit zusammenzieht, dass eine Scrollbar erscheint, ist
nach â€žFertigâ€œ zu groÃŸ fÃ¼r seine zwei Karten.

**Gemessen** (Maischen-Tab, 1600x1000): Layout-GesamthÃ¶he 851 px normal
gegen 801 px im Bearbeiten-Modus â€” das eingeblendete Hinweisfeld unter den
Tabs kostet 50 px. Dazu pro Bereich im Bearbeiten-Modus 2 px Rahmen +
16 px `p-2`, also 18 px weniger InhaltshÃ¶he. Da `sizes` reine Anteile sind
(Summe 1), skaliert derselbe Anteil auf zwei verschiedene GesamthÃ¶hen â€”
der Inhalt darin aber nicht.

**Eigentliche Ursache** (Nutzer-Beobachtung, bestÃ¤tigt): `fill` wird nur
von `ChartRow` und `ProgramCard` ausgewertet. Sensor-, Aktor-, Regler- und
Timer-Karten ignorieren es und behalten ihre `widgetSizeClass`-HÃ¶he. Ein
Bereich aus reinen Karten kann zusÃ¤tzliche HÃ¶he also gar nicht nutzen â€”
sie wird immer zu Luft unter der letzten Karte.

Umsetzung:

- Neues `isRigid(node)` in `dashboardLayout.ts`: ein Teilbaum ist starr,
  wenn er nur Karten-Refs enthÃ¤lt (leerer Bereich zÃ¤hlt als flexibel, ein
  0-px-Slot wÃ¤re nicht mehr bedropbar).
- In `DashboardLayout` bekommt ein starres Kind einer **Spalten**-Teilung
  `flex: 0 1 auto` statt eines Anteils, nimmt also seine InhaltshÃ¶he und
  Ã¼berlÃ¤sst den Rest den flexiblen Geschwistern. Zeilen-Teilungen bleiben
  unverÃ¤ndert: die Breite entscheidet, wie viele Karten pro Reihe passen.
- Die Grow-Faktoren der flexiblen Kinder werden auf ihre Summe
  normalisiert. Ohne das blieb im Test Platz ungenutzt (Chart 379 statt
  631 px): Anteile summieren zu 1, fÃ¤llt eines aus dem Wachsen heraus,
  verteilt Flexbox nur noch den entsprechenden Bruchteil des freien
  Platzes.
- Flexible Geschwister eines starren Bereichs bekommen `MIN_AREA_PX` als
  Untergrenze â€” sonst schrumpft bei zu kleinem Fenster ausschlieÃŸlich der
  starre Bereich (Basis `auto`), und der flexible fiele auf 0 px.
- Ein Trenner neben einem starren Bereich hÃ¤tte nichts zu verschieben und
  ist deshalb inert: keine Handler, kein Resize-Cursor, kein Hover â€” die
  LÃ¼cke bleibt gleich groÃŸ.

**Verifiziert** am LilyGo (1600x1000, Maischen): Kartenbereich 204 px =
exakt InhaltshÃ¶he, Chart 631 px, zusammen mit dem 16-px-Trenner genau die
851 px des Layouts. Im Bearbeiten-Modus 220 px InhaltshÃ¶he bei 220 px
Inhalt â€” keine Scrollbar mehr, der Unterschied sind nur noch die 16 px
Bearbeiten-Polsterung. Trenner-Klassen geprÃ¼ft: der senkrechte behÃ¤lt
`cursor-col-resize` + Hover, der waagerechte Ã¼ber dem Kartenbereich ist
leer. Tabs Vorbereitung/Kochen gegengesehen, `pnpm typecheck` grÃ¼n.

**Bewusst offen:** Das Hinweisfeld verkÃ¼rzt weiterhin die flexiblen
Bereiche um 50 px, solange der Bearbeiten-Modus lÃ¤uft (siehe PLAN.md) â€”
fÃ¼r Kartenbereiche ist der Effekt jetzt weg, Charts und Programme
skalieren dabei sauber mit.

## 2026-09-20 â€” Regler-Karten nach Vorlage + frei wÃ¤hlbare SekundÃ¤rfarbe

Nutzer-Vorlagen fÃ¼r alle drei GrÃ¶ÃŸen der Regler-Card. **GroÃŸ:** Ist links und
Soll rechts nebeneinander groÃŸ, darunter der Slider mit Min/Max, darunter
â€žAusgang" mit Prozentwert und Balken. **Gauge:** Soll, Ist und Ausgang
untereinander im Kreis. **Kompakt:** dieselben drei Werte in einer Zeile Ã¼ber
einem schmalen Slider. Der Klick auf den Sollwert macht daraus in allen drei
GrÃ¶ÃŸen ein Eingabefeld (unverÃ¤ndert, nur die SchriftgrÃ¶ÃŸe passt sich an).

**Farben.** Der Sollwert ist weiÃŸ, der Istwert trÃ¤gt die Akzentfarbe, und die
FÃ¼llung von Slider und Bogen ist **immer** Akzent â€” die bisherige RotfÃ¤rbung
unterhalb des Sollwerts entfÃ¤llt (ausdrÃ¼cklicher Wunsch: keine Zustandsfarbe an
dieser Stelle). Ausgangsbalken und -prozentwert nutzen eine neue
**SekundÃ¤rfarbe**, die wie die Akzentfarbe am GerÃ¤t liegt (`SettingsStore`,
`theme.ts` setzt `--secondary`/`--secondary-fg`, Einstellungen â†’ Darstellung mit
sechs Vorgaben plus freier Wahl, Default `#22c55e`). Damit gilt sie gerÃ¤teweit
und ist Ã¼ber `GET /api/backup` gesichert; `WebUI.cpp` validiert sie wie den
Akzent (`invalid secondary`), `docs/openapi.yaml` ist nachgezogen. Ã„ltere GerÃ¤te
ohne das Feld fallen auf den Default zurÃ¼ck (`secondary?` in `ThemeSettings`).

**Ausgang in Prozent.** Der Wert wird jetzt einheitlich als Prozent des
Aktorbereichs gezeigt (vorher der Rohwert, sobald `max > 1`) â€” passend zum
Balken. Regler mit getrenntem Heiz-/KÃ¼hlausgang bekommen zwei Balken.

**Gauge aufgerÃ¤umt.** Min/Max sitzen jetzt in der LÃ¼cke des Bogens statt in
einer eigenen Zeile darunter (neuer `rangeLabels`-Schalter, auch von der
SensorCard genutzt). Die Gauge reservierte bisher ein **quadratisches** Feld,
obwohl der Bogen wegen der 90Â°-LÃ¼cke schon bei rund 80 % der HÃ¶he endet â€” der
tote Streifen darunter ist weg, das Feld endet knapp unter den Bogenenden (aus
der Bogengeometrie gerechnet, nicht geschÃ¤tzt: 185 statt 220 px bei `size=220`).
Dadurch passt die Gauge-Karte in `row-span-3` statt `row-span-4`
(`widgetSizeClass`, 248 statt 336 px) â€” 55 px toter Raum weniger pro Karte.
LinienstÃ¤rke und Knopf sind auf die MaÃŸe des linearen Sliders umgerechnet
(6 px Spur, 18 px Knopf aus `styles.css`), vorher 15,4 bzw. 21,6 px.

**Verifikation:** `pnpm typecheck` grÃ¼n, `pio run -e esp32dev` grÃ¼n, Redocly
valide (nur die bekannte `license`-Warnung). Im Browser gegen den lokalen Mock
geprÃ¼ft: alle drei Ansichten inklusive Klick-Edit am Sollwert, Umschalten der
SekundÃ¤rfarbe fÃ¤rbt Balken und Prozentwert sofort um und erreicht die API als
`theme.secondary`, KartenhÃ¶hen nachgemessen (Gauge-Karte 251 px bei 250 px
Inhalt, vorher 336 bei 281), BogenstÃ¤rke 6 px und Knopf 18 px exakt wie beim
Slider.

**Offen:** Persistenz der SekundÃ¤rfarbe am echten GerÃ¤t, siehe PLAN.md â€” das
Testboard lÃ¤uft weiter mit einer Firmware ohne das Feld.

## 2026-09-19 â€” Neue MenÃ¼-Seite â€žRechner" (Brauprozess-Rechner)

Neue Hauptseite (`/rechner`, NavShell-Eintrag) mit 14 kleinen
Brauprozess-Rechnern in 6 Kategorien (Einheiten, Volumen, Mischen,
Effizienz, Karbonisierung, Messen) â€” bewusst ohne Rezept-Design-Rechner
(IBU, Farbe, Wasserchemie), die sind fÃ¼r eine spÃ¤tere
â€žRezeptentwicklung"-Funktion vorgesehen. Formeln zentral in
`web/src/gravityUnits.ts` (Plato/SG/Brix-Kern) und `web/src/brewMath.ts`
(restliche Formeln) als reine, ungetypte UI-freie TS-Funktionen â€” damit
spÃ¤ter wiederverwendbar. `vitest` neu als Test-Runner eingefÃ¼hrt (bisher
keiner im Web-Frontend), 22 Tests fÃ¼r beide Module. Navigation:
Index-Seite mit Kategorie-Karten (`/rechner`, Muster wie `SettingsIndex`)
plus eine parametrisierte Detail-Seite (`/rechner/:calc`, Muster wie
`ArchivePage`s `:id`-Route) statt 14 einzelner Routen. Zwei zusÃ¤tzliche
Shared-Components Ã¼ber den ursprÃ¼nglichen Plan hinaus: `NumberField`
(beschriftete Zahlen-Eingabezeile, bei der Umsetzung als eindeutig fehlend
erkannt â€” jeder der 14 Rechner hÃ¤tte sie sonst dupliziert) und
`GravityInput`/`CalcResult` wie geplant.

**Beim Verifizieren im Browser gefunden und korrigiert:** Der ursprÃ¼nglich
geplante Zusatzmodus â€žABV bei unbekannter StammwÃ¼rze" (Refraktometer +
Spindel kombiniert, ohne bekannte StammwÃ¼rze) lieferte bei realistischen
Testwerten (Brix 8, FG 1.010) negative Ergebnisse (âˆ’23,5 Â°P, âˆ’11,8 % vol)
â€” die zugrundeliegenden Koeffizienten (vermutlich mit der Balling-Formel
verwechselt statt der tatsÃ¤chlichen Novotny-Formel) waren falsch. Statt
mit TODO-Markierung auszuliefern, wurde der Modus komplett entfernt; der
ABV-Rechner bietet in v1 nur den soliden, getesteten Modus mit bekannter
StammwÃ¼rze. Die Refraktometer-Korrektur selbst (Rechner 11) nutzt
dieselben verdÃ¤chtigen Koeffizienten und bleibt mit TODO(verify)-Hinweis
drin, da ihr Ergebnis zumindest plausibel im Wertebereich liegt (siehe
PLAN.md â€žBugs & bekannte EinschrÃ¤nkungen" fÃ¼r alle unverifizierten
Formelkonstanten). Alle anderen Formeln gegen Handrechnung/Referenzwerte
verifiziert (Zylinder-/Kegelstumpf-Volumen exakt hergeleitet und getestet,
Karbonisierung stÃ¶chiometrisch aus Molmassen abgeleitet statt aus
erinnerten Tabellenwerten).

## 2026-09-19 â€” Rechner: Novotny-Formel korrigiert (Refraktometer/ABV/EndvergÃ¤rungsgrad)

Nutzer stellte die Excel-Datei
`StammwuerzeErmittlungAusBrixUndEsNachNovotnyLinear_V02.xlsx` (WeiÃŸ, O.,
V02, 2024) bereit â€” eine dokumentierte, quellenbasierte Umsetzung der
NovotnÃ½-Formel (NovotnÃ½, P. (2017), Zymurgy 40(4), 49â€“54; Ascher, T.,
BrauCampus Graz (2021)). Per `openpyxl` (musste erst installiert werden,
war entgegen der xlsx-Skill-Doku nicht vorhanden) Formeln und Werte aus
allen drei Tabs extrahiert und gegen die vorherige, aus Erinnerung
zusammengesetzte Implementierung abgeglichen â€” bestÃ¤tigte den in der
Vorsession dokumentierten Verdacht: Die alte Formel wandte die
Balling-Koeffizienten (0.1808/0.8192) direkt auf den rohen Brix-Wert an,
statt die tatsÃ¤chliche NovotnÃ½-Beziehung zu nutzen
(`SG = 1 + 0,006276Â·Bgc âˆ’ 0,002349Â·Bwc`, mit Bgc = BCF-korrigierter
Brix-Wert). Ersetzt:

- `gravityUnits.ts`: `platoToSg`/`sgToPlato` sind jetzt exakte algebraische
  Inversen derselben Quadratik (`SG = (668âˆ’âˆš(668Â²âˆ’820Â·(463+P)))/410`),
  statt zwei unabhÃ¤ngig gefitteter NÃ¤herungsformeln. Gegen das
  Excel-Rechenbeispiel exakt verifiziert (Es=3 â†’ SG=1,0117373721335001,
  auf 9 Nachkommastellen getroffen).
- `brewMath.ts`: neue `apparentExtractFromRefractometer` (Tool A: OG
  bekannt, aktuellen Wert nur per Refraktometer schÃ¤tzen) und
  `originalExtractFromDualMeasurement` (Tool B: OG unbekannt, aus
  Refraktometer+Spindel rekonstruieren â€” algebraische AuflÃ¶sung derselben
  Gleichung nach der anderen Unbekannten) sowie `ballingBeerAnalysis`
  (Alc %w/w, %v/v, Ew, scheinbarer/realer VergÃ¤rungsgrad, nach Balling,
  gleiche Quelle). Alle vier gegen das Excel-Rechenbeispiel exakt
  verifiziert (bis auf Rundung in der letzten Dezimale).
- Der in der Vorsession entfernte Zusatzmodus â€žABV bei unbekannter
  StammwÃ¼rze" (Refraktometer+Spindel-Doppelmessung) ist mit der jetzt
  korrekten Formel wieder in `CalcAbv.tsx` enthalten.
- Im Browser nachgeprÃ¼ft: Refraktometer-Korrektur zeigt fÃ¼r OE 12Â°P/Brix
  6,4/BCF 1,03 jetzt plausibel 2,8Â°P (vorher fÃ¤lschlich 9,0Â°P â€” hÃ¶her als
  der rohe Brix-Wert, was fÃ¼r eine Alkoholkorrektur unmÃ¶glich ist).

`pnpm typecheck` und `pnpm test` grÃ¼n (25 Tests, u. a. alle vier neuen
Referenzwerte exakt aus dem Excel-Beispiel). Offene TODO(verify)-Marker
fÃ¼r Einmaischtemperatur, Effizienz-Checkpoints und Karbonisierung bleiben
bestehen â€” siehe PLAN.md.

**Zur Nutzeranmerkung â€žBrix/Plato-Faktor 0,96":** Der allgemeine
Einheiten-Umrechner behandelt Â°Brix und Â°Plato bewusst 1:1 (beides
sucrose-Ã¤quivalente Massenprozent-Skalen, per Definition praktisch
identisch) â€” das ist korrekt und unverÃ¤ndert. Der vom Nutzer gemeinte
Faktor ist der gerÃ¤teabhÃ¤ngige Refraktometer-Korrekturfaktor (hier â€žBCF"
genannt, Standard 1,03 laut Quelle, angewendet als Division Bgc=Bg/BCF),
der ausschlieÃŸlich in den Refraktometer-Rechnern (11, 13) zum Tragen
kommt und dort jetzt korrekt als eigener, einstellbarer Eingabewert
vorhanden ist.

## 2026-09-19 â€” Not-Aus-Funktion (Hauptschalter)

Backlog-Punkt aus PLAN.md umgesetzt: ein Not-Aus-Button, persistent im
Nav-FuÃŸbereich (Desktop-Sidebar + mobiler Header), unabhÃ¤ngig von der
aktuellen Seite erreichbar. Architekturfrage vorab mit dem Nutzer geklÃ¤rt
(Scope, Persistenz, Reset, Platzierung), siehe Plan.

**Scope:** `POST /api/estop` (neuer Endpoint, `WebUI.cpp`) deaktiviert jeden
Aktor (`setEnabled(false)`) und pausiert jedes laufende/wartende Programm
sowie jeden laufenden Timer (neue `pauseAllRunning()`-Methoden auf
`ProgramRunner`/`TimerStore`, die intern Ã¼ber die bestehenden Ids die
vorhandene `control(id, "pause", â€¦)`-Logik aufrufen â€” kein neuer Aktor-Code
in SensActCtrl nÃ¶tig, `Actuator::setEnabled(false)` hÃ¤lt die Hardware-Ausgabe
bereits sicher inaktiv, selbst wenn ein Controller weiterschreibt). Bewusst
**nicht persistent** (reiner Laufzeit-Zustand, nach Reboot startet alles
normal) und **kein Sammel-Reset** â€” jeder Aktor/jedes Programm/jeder Timer
wird einzeln Ã¼ber die bestehenden Controls wieder aktiviert.

Frontend: `emergencyStop()` in `api.ts`, neuer `OctagonX`-Button (kritisch
eingefÃ¤rbt, `text-critical`/`hover:bg-critical/10`) in `NavShell.tsx` an
beiden Stellen, ohne Confirm-Dialog (ein echter Not-Aus muss sofort wirken).
Erfolg ist Ã¼ber die SSE-getriebenen Karten sichtbar, kein zusÃ¤tzlicher
globaler Banner-State.

`pio test -e native` (224/224), `pio run -e esp32dev` und `pnpm typecheck`
grÃ¼n; OpenAPI-Lint sauber (`POST /api/estop` in `docs/openapi.yaml`
dokumentiert). Im Browser gegen ein Testboard geprÃ¼ft: Klick lÃ¶st korrekt
`POST /api/estop` aus (404 dort, weil das Board die alte Firmware ohne den
neuen Endpoint fÃ¤hrt â€” erwartet, kein Seiteneffekt), Fehler wird sauber
abgefangen. Echte Hardware-Verifikation (Aktor + laufendes Programm/Timer,
tatsÃ¤chliches Abschalten/Pausieren, Reboot-Verhalten) steht noch aus â€”
absichtlich nicht an einem Board mit echten Aktoren/laufendem Sud
ausprobiert, siehe PLAN.md â†’ Hardware-Verifikation offen.

## 2026-09-20 â€” Fix: leere AutoTune-Trennlinie auf der Regler-Karte

Nutzer-Fund an der neuen Gauge-Karte: unter dem Bogen stand eine freie
Trennlinie. Ursache ist der AutoTune-Block in `ControllerCard.tsx`, dessen
Container schon rendert, sobald ein PID Ã¼berhaupt einen `autotuneState` trÃ¤gt â€”
Inhalt gibt es aber nur bei `running` (Fortschrittsanzeige) und `done`
(Ã¼bernommene Kp/Ki/Kd). Im Normalfall `idle` blieb dadurch ein leerer Kasten mit
oberer Trennlinie und zweimal 12 px Polsterung stehen. Die Bedingung prÃ¼ft jetzt
genau die beiden ZustÃ¤nde mit Inhalt.

Altbestand, kein Folgefehler der Karten-Ãœberarbeitung: vorher lagen unter dem
Bogen ohnehin die Min/Max-Zeile und rund 55 px toter Raum, seit die Karte eng
sitzt steht die Linie frei. `pnpm typecheck` grÃ¼n.

## 2026-09-20 â€” Multi-Channel-Sensoren: KanÃ¤le einzeln anlegen und platzieren

AuslÃ¶ser: HCSR04 und YF-S201 erzeugten immer beide KanÃ¤le, im Dashboard saÃŸen sie
als gestapelter Block (Ref `sensor/<base>`) und rissen Leerraum ins Raster.
Ursache: ein Multi-Channel-Sensor ist ein `Sensor`-Objekt mit einem
Registry-Eintrag, die KanÃ¤le entstehen erst im Snapshot (`RegistrySnapshot.cpp`).
Entscheidung: keine gruppierte Karte, stattdessen einzelne Kanalkarten; die
Gruppenkarte steht als eigener PLAN-Eintrag.

Umsetzung: `HCSR04Sensor`/`YF_S201Sensor` bekommen `setChannelMask()`
(Messung/ISR laufen unverÃ¤ndert, nur `channelCount()`/`channel()` filtern;
Default = alle, Maske ohne gÃ¼ltiges Bit wird ignoriert). `DynamicItems.cpp`
liest `channels` aus dem POST-Body (unbekannter Key, leeres Array und
`derived` ohne `factor` â†’ 400; fehlt `channels`, bleiben alle KanÃ¤le â€”
alte Configs laden unverÃ¤ndert), der Reset-Callback hÃ¤ngt nur noch am
`volume`-Kanal. `removeSensor` prÃ¼ft Controller-Referenzen jetzt auch gegen
Kanal-IDs (`tank.derived`), vorher blockierte nur die nackte Basis-ID.
Frontend: Kanal-HÃ¤kchen im Add-Dialog (HCSR04: Distanz/Ableitung, YF-S201:
Durchfluss/Volumen; Ableitung braucht Faktor), Dashboard-Inhalte listen jeden
Kanal einzeln, `sensor/<base>.<channel>`-Refs rendern nur diesen Kanal,
Edit/Reset laufen weiter Ã¼ber die Basis-ID, ein Umbenennen zieht auch
Kanal-Refs mit. Bestehende Dashboards mit Basis-Ref rendern unverÃ¤ndert
gestapelt (kein Auto-Migrieren), der Eintrag bleibt im Dialog abwÃ¤hlbar.
`channels` ist in `openapi.yaml` dokumentiert.

Verifikation: `pio test -e native` fÃ¼r `test_hcsr04`/`test_yf_s201` (neue
Maskentests), `pio run -e esp32dev` und `pnpm typecheck` grÃ¼n,
`redocly lint` valide. Hardware-Test durch den Nutzer erfolgreich (Kanalauswahl
beim Anlegen, einzelne Kanalkarten im Dashboard).

## 2026-09-20 â€” Quick-Wins: Notfall-Seite, ConfirmModal, OpenAPI, Kanalbezeichnung

Vier kleine Punkte aus PLAN.md abgearbeitet. (1) `onNotFound` in `WebUI.cpp`
liefert SPA-/Notfall-Seite nur noch fÃ¼r Pfade ohne Dateiendung; `/assets/x.js`
& Co. bekommen 404 statt HTML â€” ein SD-Lesefehler kann so keinem
`<script>`-Tag mehr die Notfall-Seite unterschieben. (2) `ConfirmModal`:
Abbrechen/BestÃ¤tigen stehen nebeneinander, der Extra-Button liegt volle Breite
darunter (Labels unverÃ¤ndert, brechen nicht mehr um). (3) `SensorCreate` in
`openapi.yaml`: `calibration` ist `number` (YF-S201, Hz je L/min), `rtd` ein
String `PT100`/`PT1000`. (4) `SensorCard` zeigt die Kanalbezeichnung
(`meta.quantity`) unter dem Titel; im Kompakt-Modus bleibt sie rechts, weil dort
die HÃ¶he knapp ist.

Verifikation: `pnpm typecheck`, `pio run -e esp32dev`, `redocly lint` grÃ¼n;
Sensorkarten im Browser gegen `pnpm dev` geprÃ¼ft (kein Ãœberlauf). Nicht
geprÃ¼ft: `ConfirmModal` mit Extra-Button im Browser und die Notfall-Seite am
GerÃ¤t.

## 2026-09-20 â€” Persistenz-Verifikation am GerÃ¤t: Darstellungsmodi, Layout, SekundÃ¤rfarbe

Firmware `50f199c` (HEAD, sauberer Tree) per OTA (`POST /api/update/firmware`, kein
Serial) auf `brewcontrol-esp32dev` geflasht. Das Board hat lokal keine Aktoren,
nur ein Remote-Item auf das S2 (Ziel 0, nie beschrieben), keine Regler/Programme
und keinen Sud. Alle Reboots liefen Ã¼ber `POST /api/network` mit unverÃ¤ndertem
Hostnamen; Beleg jeweils Ã¼ber die Messzeit des lokalen Sensors (`t` fiel z. B.
von 36462 auf 18912).

Ergebnis: (1) `sensorModes`/`controllerModes`/`timerModes` und (2) `layout`
(verschachtelter Split) sind nach Speichern und echtem Reboot bytegleich
wieder da, auch in `GET /api/backup` und in der Roh-Datei
`/config/dashboards.json`. Ein Dashboard im Altformat (Backup-Restore ohne
Modi/Layout) lÃ¤dt fehlerfrei, liefert leere Modi und kein `layout`-Feld.
Die UI (`pnpm dev` per `VITE_ESP_HOST`-Umgebungsvariable gegen das Board,
`.env.local` zeigt aufs LilyGo und blieb unangetastet) rendert Gauge/Kompakt und
die gespeicherte Anordnung nach Reload. (3) `theme.secondary`: eine alte
`settings.json` ohne das Feld fÃ¤llt auf `#22c55e` zurÃ¼ck, `#ff8800` Ã¼bersteht
Reboot, steht in `GET /api/settings`, `GET /api/backup` und der Roh-Datei;
`red`, `#12345`, `#1234567`, `22c55e0` liefern 400 `invalid secondary`.

Escape-Abbruch: Drag aktiv (Karte gedimmt), nach Escape weg, danach `pointerup`
ohne Request und ohne LayoutÃ¤nderung; Kontrolllauf ohne Escape committete.
Beides mit synthetischen `PointerEvent`s und `setPointerCapture` als No-op
(echte Pointer-IDs lassen sich im Browser-Pane nicht erzeugen), die
Handler-Logik ist also echt, die Browser-Pointer-Erfassung nicht. Ein Drag mit
echtem Finger am Tablet bleibt offen (PLAN.md).

Befund: `POST /api/settings` prÃ¼ft Farben nur auf LÃ¤nge 7 und `#`; `#gggggg`
wurde angenommen und persistiert (PLAN.md, Bugs). AufgerÃ¤umt: Testdashboard
gelÃ¶scht, `secondary` auf den Default zurÃ¼ckgesetzt, Registry unverÃ¤ndert zum
Backup vor dem Test.

## 2026-09-20 â€” â€žGerÃ¤t hinzufÃ¼genâ€œ als 4-Schritt-Wizard (nach Design-Entwurf)

Grundlage waren zwei EntwÃ¼rfe (Desktop + Mobile) fÃ¼r einen mehrschrittigen
Anlege-Dialog. Der bestehende Dialog ist darin integriert: seine per-Typ-Felder
sind jetzt Schritt 4.

**Umsetzung:**

- Neue HÃ¼lle `AddItemWizard.tsx` (~185 Z.) mit `ChoiceCard`: Scrim, responsives
  Panel, Desktop-Schrittleiste (240 px, Haken + gewÃ¤hlter Wert als Unterzeile,
  anklickbar bis `maxStep`), mobile Segmentleiste mit â€žSchritt X von 4â€œ,
  Schritt-Titel und Footer. Responsive rein Ã¼ber Tailwind `md:` â€” kein
  `matchMedia`; DOM-Reihenfolge [Rail, Mobil-Header, Pane] ergibt mit
  `hidden md:flex` / `md:hidden` in beiden Layouts die richtige Abfolge.
  Mobil vollflÃ¤chig ohne Scrim, ab `md` ein zentriertes 880Ã—640-Panel.
- Schritte: 1 Art â†’ 2 Kategorie â†’ 3 GerÃ¤tetyp â†’ 4 Konfiguration, danach ein
  Erfolgs-Screen. Kein Zusammenfassungs-Schritt (war im Entwurf, bewusst
  verworfen). Kategorien sind unverÃ¤ndert die `group`-Werte aus `itemTypes.ts`;
  eine Kategorie mit genau einem Typ wÃ¤hlt diesen vor, damit Schritt 3 dort ein
  â€žWeiterâ€œ statt eines Klicks ohne Alternative ist.
- `itemTypes.ts` bekommt `ROLE_META` (Icon + Beschreibung je Rolle) und
  `CATEGORY_ICON` (Icon je Kategorie); `ITEM_TYPES` selbst unverÃ¤ndert,
  Reihenfolge und Anzahl der Kategorien werden daraus abgeleitet.
- **Bearbeiten und Discovery-Prefill nutzen den Wizard nicht** â€” sie behalten
  den kompakten Ein-Pane-Dialog. Dessen ZurÃ¼ck-Chevron ist entfallen: beim
  Bearbeiten gab es nie einen, und bei einem Discovery-Treffer steht der Typ
  durch den Scan fest. `ItemTypePicker.tsx` ist damit verwaist und gelÃ¶scht.
- Die ~880 Zeilen per-Typ-Feld-JSX wurden **byte-identisch** in eine lokale
  `fieldBlocks()` verschoben (mit `git diff -w` gegengeprÃ¼ft) und werden von
  beiden Darstellungen aufgerufen. Eine Kindkomponente hÃ¤tte ~70 Werte plus ~70
  Setter als Props gebraucht; die lokale Funktion schlieÃŸt alles gratis ein.
- Form-Semantik: ein einziges `<form>` bleibt, aber der PrimÃ¤rbutton ist nur in
  Schritt 4 `type="submit"`, alle Karten/Rail-Buttons sind `type="button"`, und
  `onSubmit` bricht auf Schritt 1â€“3 ab. Es wird immer nur der aktive Schritt
  gerendert â€” ein verstecktes `required`-Feld wÃ¼rde den Submit sonst unsichtbar
  blockieren.
- `handleSubmit` schlieÃŸt im Wizard nicht mehr sofort, sondern feuert
  `onCreated` (sobald das Item existiert) und zeigt den Erfolgs-Screen; jedes
  SchlieÃŸen lÃ¤uft Ã¼ber `closeWizard()`, das `created` vorher rÃ¤umt â€” sonst
  blitzt der alte Screen beim nÃ¤chsten Ã–ffnen auf, weil der Reset-Effect erst
  nach dem Paint lÃ¤uft.

**Verifiziert:** `pnpm typecheck`, `pnpm build`, `pnpm test` (25/25) grÃ¼n.
Live gegen esp32dev: Wizard Ã¼ber Aktorâ†’GPIOâ†’DigitalOutput inkl. Singular
â€ž1 Typâ€œ / â€ž3 Typenâ€œ, MQTT-Kategorie wÃ¤hlt ihren einzigen Typ vor,
Rollenwechsel aus Schritt 4 heraus leert Schritte 2â€“4 und sperrt sie wieder,
Anlegen â†’ Erfolgs-Screen â†’ Fertig â†’ GerÃ¤t in der Liste. Kompakter Pane beim
Bearbeiten (kein Chevron, AutoTune vorhanden). Verschachtelt aus
â€žDashboard-Inhalteâ€œ: Wizard startet auf Schritt 1 mit vorgewÃ¤hltem Sensor, nach
â€žFertigâ€œ ist das Content-Modal noch offen und der neue Sensor angehakt.
Mobil 375Ã—812 wie im Entwurf. TestgerÃ¤te danach wieder gelÃ¶scht.

**Nebenbefund:** Enter im Formular lÃ¶st im Browser-Pane keinen Submit aus â€”
auch im unverÃ¤nderten kompakten Dialog nicht. Das ist die synthetische
Tastatureingabe der Automatisierung, keine Regression; am echten GerÃ¤t
unverÃ¤ndert.

## 2026-09-20 â€” Not-Aus am GerÃ¤t verifiziert (esp32dev)

Hardware-Verifikation von `POST /api/estop` am esp32dev (`192.168.178.74`, lokal
keine echten Aktoren; nur HTTP, kein Serial). Aufbau: `DigitalOutput`
`estop_led` (GPIO 16), `TwoPoint`-Regler darauf (Sensor: Remote-BinÃ¤rwert
`lolin_wstest` = 1, Sollwert 10 â€” der Regler schreibt dadurch dauerhaft
`target=1`), Programm mit zwei 600-s-Schritten und ein 600-s-Timer, beide
gestartet. Vorher Backup + Snapshot gesichert.

**Ergebnis:** (a) nach dem Not-Aus `enabled=false` und `state.v=0` am Aktor,
obwohl der Regler weiter aktiv blieb und `target=1` schrieb â€” Ã¼ber drei
Messungen im Abstand von 4 s stabil. (b) Programm und Timer wechselten auf
`paused` und standen bei 591 s fest. (c) Nach dem Reboot (`POST /api/network`
mit unverÃ¤ndertem Hostnamen, `sensors[].state.t` sprang zurÃ¼ck) sind alle
Aktoren wieder `enabled=true`, der LED-Ausgang liegt wieder bei `v=1` â€” der
Aktor-Teil des Not-Aus ist nicht persistiert.

**Kein Befund:** Programm und Timer bleiben nach dem Reboot `paused` (Not-Aus
speichert sie per `saveToSD`) â€” beabsichtigt: nach einem Neustart soll nicht
dieselbe Situation, die den Not-Aus ausgelÃ¶st hat, von selbst wieder entstehen.
Die Aktor-Deaktivierung ist dagegen nicht persistiert. Die Aussage in
`openapi.yaml` (â€žstarts normally againâ€œ) wurde entsprechend prÃ¤zisiert.
Testobjekte danach gelÃ¶scht, das Board ist wie vorher (`lolin_ids1`, `test`,
`lolin_wstest`).

## 2026-09-20 â€” Dashboard-Inhalte-Dialog nach Design W1 (ContentDialog)

`DashboardContentModal.tsx` an das Ã¼berarbeitete WinUI-Design angeglichen:
720Ã—640-Dialog mit Titel/Untertitel, immer sichtbarer Suche, Kategorie-Tabs
(â€žAlleâ€œ + je Gruppe, ZÃ¤hler ausgewÃ¤hlt/gesamt), Zusammenfassungszeile mit
Delta (â€žn hinzugefÃ¼gt Â· m entferntâ€œ), â€ž+ Neuâ€¦â€œ-Button im Gruppen-Header,
Checkbox-Zeilen und Footer â€žÃœbernehmenâ€œ (erst bei Ã„nderungen aktiv) /
â€žAbbrechenâ€œ. Timer-Gruppe bleibt erhalten (im Design nicht vorgesehen).
Verifikation: `pnpm typecheck` grÃ¼n; visuell noch nicht im Browser geprÃ¼ft.

