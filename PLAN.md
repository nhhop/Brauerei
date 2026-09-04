# Brauerei — Backlog & offene Punkte

Heimbrauerei-Steuerung auf ESP32-Basis: Library `SensActCtrl` (Sensor-/Aktor-/Regler-Primitive + Remote-Transporte) plus Web-UI-Consumer `BrewControl` (Firmware + Preact-SPA).

**Dieses Dokument enthält nur Offenes** — Bugs, bekannte Einschränkungen, Backlog und Gedanken zu neuen Features. Sobald ein Punkt umgesetzt ist, wandert er ersatzlos hier raus; die erledigte Historie steht chronologisch in [SESSION.md](SESSION.md) / [SESSION-archive.md](SESSION-archive.md). Architektur- und API-Referenz stehen in den READMEs ([SensActCtrl/README.md](SensActCtrl/README.md), [BrewControl/README.md](BrewControl/README.md)).

SensActCtrl und BrewControl werden gemeinsam geplant, unabhängig davon, welches Teilprojekt eine Änderung betrifft.

Jeder Punkt trägt am Ende eine Einschätzung *(Modell · Aufwand · Planmodus)*: **Modell** — Sonnet für klar umrissene Änderungen, Opus für Architektur-Entscheidungen und mehrdeutige/cross-cutting Aufgaben. **Aufwand** — klein (eine Datei/Klasse, unter einer Session), mittel (mehrere Dateien/Komponenten, eine Session), groß (mehrere Sessions, neue Architektur). **Plan** — ob vor der Umsetzung ein Plan (`EnterPlanMode`) sinnvoll ist, weil Scope oder Architektur noch Entscheidungen offen lässt; „ohne Plan" heißt direkt umsetzbar. Eigene Einschätzung, keine Garantie — bei Bedarf gemeinsam anpassen.

---

## Bugs & bekannte Einschränkungen

- **ESP-NOW verwirft Pakete >250 Byte silently.** `EspNowTransport::sendDataPacket_()` gibt bei Überschreitung `false` zurück, kein Retry. Betrifft v.a. Controller mit vielen Params (DualStage/SplitRangePID) — deren Meta-Publish kann dauerhaft scheitern. `lastErrorMessage()` zeigt seit 2026-08-29 „Paket zu groß (…)", aber nichts liest das aktiv aus/loggt es. *(Sonnet · mittel · mit Plan — Scope-Frage: nur loggen oder auch über API/UI surfacen)*
- **`POST /api/update/assets` (UI-Tar-Upload) bricht auf LOLIN S2 Mini ab** (`Connection was reset` nach ~65 KB, Board bleibt stabil, kein Crash). Vorbestehender Code-Pfad (`SdTarSink`/`TarExtractor`), auf LilyGo S3 nicht reproduziert. Nicht weiter untersucht (2026-08-29). *(Sonnet · mittel · mit Plan — Root Cause unklar, erst eingrenzen)*
- **`WebhookService::getOrCreate()` cached strikt nach `(port, peerUrl)`.** Zwei verschiedene Peers, die sich denselben lokalen Port teilen wollen, erzeugen zwei separate `WebServer`-Instanzen auf demselben physischen Port → Bind-Konflikt. Im Test 2026-08-29 umgangen (anderer Port für den zweiten Consumer), Cache-Design selbst nicht gefixt. *(Sonnet · mittel · mit Plan — Design-Entscheidung wie der Konflikt aufgelöst wird)*
- **LittleFS-Boards (esp32dev/lolin_s2_mini): kein Boot-Flash-Recovery, keine Log-Retention** (2026-08-28) — `FirmwareUpdater::flashFromSdImage()` passt nicht in die 256-KB-Datenpartition (Netzwerk-OTA unberührt); `LogStore` rotiert dort nicht, sollte nicht unbegrenzt loggen. *(Opus · groß · mit Plan — zwei Teilprobleme, berührt Partitionslayout)*
- **GPIO/LEDC-Leak-Fix (2026-08-14) ohne Hardware-Nachtest** — der Fix (`ledcDetachPin()` in `end()`, `removeActuator`/`removeSensor` rufen jetzt `end()`) ist umgesetzt, der praktische Nachtest („Pin nach Löschen ohne Reboot erneut mit Sensor belegen") blieb mangels Board offen. *(Sonnet · klein · ohne Plan — reine Verifikation, kein Code)*
- **Frontend: keine gruppierte SensorCard für Multi-Channel-Sensoren** — HCSR04 und YF-S201 erzeugen je 2 separate Karten (`tank.distance` / `tank.derived`, `flow.rate` / `flow.volume`). Verbesserung: `app.tsx` gruppiert Snapshot-Einträge nach Base-ID, eine Karte pro logischem Sensor mit mehreren Kanal-Zeilen; Delete-Button und Zähler zeigen dann logische Sensoren statt Kanäle. Quick-Fix für korrektes Delete/Reset ist drin (2026-05-30). ⚠️ Voraussetzung für „Gradienten/Ableitungen". *(Sonnet · mittel · mit Plan — Datenmodell-Entscheidung, wie Gruppierung durchgereicht wird)*
- **Programm-IDs und `currentStep` weichen von der OpenAPI-Spec ab** (gefunden 2026-09-04 beim Bau der Profil-Bibliothek). `ProgramRunner::generateId()` erzeugt `p_XXXXX` (`ProgramRunner.cpp:156`), die Spec pinnt Programm-Ids aber auf `HexId` `^[0-9a-f]{6}$` (`openapi.yaml` bei `/api/programs/{id}`, `Program.id`, `CreatedId`) — keine reale Programm-Id matcht das dokumentierte Pattern. Ebenso ist `Program.currentStep` als „-1 while idle" beschrieben, der Code setzt konsequent `0`. Reine Doku-Drift; Fix entweder Spec an den Code angleichen oder die ID-Erzeugung auf `%06lx` vereinheitlichen (betrifft nur neue Ids, bestehende Dashboard-Referenzen bleiben gültig). *(Sonnet · klein · ohne Plan)*
- **`pio device monitor` auf TinyUSB-CDC unter Windows instabil** (ESP32-S2 und -S3): Monitor verliert sporadisch Output. Workaround: PowerShell-Skript mit `System.IO.Ports.SerialPort`, DTR/RTS-Toggle für Reset, `ReadExisting()`-Loop (siehe `BrewControl/README.md`). Mögliche Permanent-Fixes: `--filter direct`, anderes Terminal (PuTTY/Tera Term), Monitor-Reconnect-Tuning. *(Sonnet · klein · ohne Plan — Workaround existiert schon, nur Komfort)*

## Hardware-Verifikation offen

- **SSR-Heizung unter Last mit Oszilloskop** — TPO-Schaltflanken prüfen. *(Sonnet · klein · ohne Plan)*
- **IDS-Induktionskocher E2E** mit echter Hardware. *(Sonnet · klein · ohne Plan)*
- **Gärsteuerung Dual-Output-Regler E2E am Gerät** — DualStage/SplitRangePID anlegen, beide Ausgänge live, Anti-Short-Cycle der Kühlstufe, Kühl-Aktor-Löschen-Block. *(Sonnet · mittel · ohne Plan — mehrere Szenarien, aber reine Verifikation)*
- **PID-AutoTune E2E am Gerät** — Status idle→running→done, übernommene Gains, Abbruch. Ebenso **SplitRangePID-AutoTune E2E**. *(Sonnet · klein · ohne Plan)*

---

## Backlog

Grob nach Bereitschaft / Aufwand; Abhängigkeiten stehen inline. Jeder Punkt bekommt bei Bedarf eine eigene Spec → Plan → Implementierung.

- **Sensor-Kalibrierung** — einheitliches Offset/Scale-Interface (ggf. Mehrpunkt) + UI; ersetzt die heutigen ad-hoc-Lösungen (HX711-`tare`, YF-S201-`calibration`, Analog-`setRange`). *(Opus · groß · mit Plan)*
- **PID-AutoTune — Fortschrittsanzeige/Restzeit** für den laufenden Vorgang (braucht zusätzliche Backend-Instrumentierung; die aktuelle UI zeigt nur idle/running/done). *(Sonnet · mittel · mit Plan — Instrumentierungs-Ansatz klären)*
- **Timer-Widget** — Dashboard-Element für Brau-Timings. *(Sonnet · mittel · mit Plan — UX/Datenmodell klären)*
- **Gradienten/Ableitungen (Library)** — rate-of-change als zusätzlicher Channel (°C/min, K/min, L/min²). ⚠️ Erst nach gruppierter SensorCard (s. Bugs), da sonst noch mehr Einzelkarten pro Sensor entstehen. *(Opus · groß · mit Plan)*
- **Alarme & Schwellwerte** — „Wert > X" → Warnung/Badge, baut auf `fault()` auf.
  - *Erweiterung:* **Notification/Alert-Center** — zentrale Toast-/Verlaufsansicht statt nur Karten-Badge, z.B. bei Fault, Programm-Ende, AutoTune-fertig. Baut auf dem Fluent/WinUI-Designsystem auf.
  - *(Opus · groß · mit Plan — beide Teile zusammen, cross-cutting UI-System)*
- **Datalog — API-seitige Dezimierung** (LTTB/Douglas-Peucker mit `?points=`) für sehr lange Archiv-Zeiträume; Live-Chart-Append an `intervalSec` angleichen (aktuell 1 Hz). *(Opus · groß · mit Plan — Algorithmus-Genauigkeit + API + Frontend)*
- **Mehrsprachigkeit** — Sprache auf der „Zeit & Region"-Seite wählbar (Umbenennung von „Zeit & Formate"). *(Opus · groß · mit Plan — i18n-Grundgerüst betrifft das ganze Frontend)*
- **Hardware-RTC (PCF8563)** als Fallback für Betrieb ohne WiFi — LilyGo T-Display-S3-AMOLED hat den Chip onboard; einmalige NTP-Sync schreibt in die RTC, danach zeitstempelstabil auch offline. *(Sonnet · mittel · mit Plan)*
- **Multi-Regler-Programme** (vorgemerkt 2026-08-12) — ein Schritt hält heute genau einen Sollwert für einen Controller. Besonders für die Gärung: pro Schritt mehrere Ziele koppeln — Temperatur (Heizen/Kühlen via `DualStage`/`SplitRangePID`), Druck (Ventil-Aktor), plus einmalige Aktor-Trigger zu einem Zeitpunkt (z.B. Hopfen-Dropper). Erweitert das `ProgramRunner`/`programs[]`-Schema: Liste von Zielen pro Schritt (`{controllerId, setpoint}[]`) plus optionale One-Shot-Aktor-Aktionen. Betrifft auch die Profil-Bibliothek. *(Opus · groß · mit Plan — Schema-Migration bestehender Programme)*
- **Sensorgetriggerte Schritte** (vorgemerkt 2026-08-12) — ein Schritt endet heute nur über `holdSec` (Zeit) oder `confirm` (manuelle Freigabe). Dritte Bedingung: Schrittende an einen Sensorwert koppeln, z.B. „Gravity < 1.010" beim Gären. Braucht eine generische Schwellwert-Bedingung (`{sensorId, op, value}`) im Schritt-Schema — teilt sich vermutlich Logik mit „Alarme & Schwellwerte". *(Opus · mittel · mit Plan — kleiner, falls Alarme & Schwellwerte schon steht)*
- **AP-Modus** als wählbare Alternative (Standalone ohne Router) — verschoben, weil ohne Internet kein NTP (bricht Datalog-Timestamps); sinnvoll zusammen mit Hardware-RTC. Ebenso statische IP / DHCP-Konfiguration. *(Sonnet · mittel · mit Plan — mehrere Netzwerk-Zustände sauber durchdenken)*
- **Zugriffsschutz / Auth** — bewusst niedrig priorisiert (Heimnetz), nur als Vormerkung. *(Opus · groß · mit Plan — sicherheitsrelevant, auch im Heimnetz sorgfältig entwerfen)*

## Größere Brocken (eigene Spec vor Umsetzung)

- **Peripherie-Abstraktion** — `Peripheral`-Interface (`id`, `type`, `begin`/`tick`/`end`) + `PeripheralRegistry`, das geteilte Busse (OneWire / I2C / SPI / CAN) beim ersten passenden Consumer automatisch anlegt. Sensoren/Aktoren referenzieren per Bus-Id oder hängen sich anhand der Pins automatisch an. Verallgemeinert die bestehende `getOrCreateBus`-Logik in `DynamicItems.cpp`, beseitigt die SPI-Pin-Duplizierung bei MAX31865. Port-Expander / CAN-Transceiver = spätere konkrete Peripherie auf derselben Naht (Hardware aktuell nicht vorhanden). Reines Rückgrat, kein User-Feature für sich — enabler für den Pin-Manager. *(Opus · groß · mit Plan)*
- **Pin-Manager** (firmware, auf Peripherie-Abstraktion aufbauend) — Board-Capability-Map (per Board-Define): Input-only Pins 34–39, Strapping-Pins, Flash/PSRAM-belegte Pins (z.B. 33–37 auf S3-AMOLED), DAC-Pins 25/26, Default I2C/SPI/UART. `GET /api/pins` liefert frei/belegt; Belegung = Peripherie (geteilt/beitrittsfähig) + Items mit exklusiven Pins. Stufen: Tier 1 Belegung + Map → Tier 2 Constraint-Query (interrupt-/serial-/dac-fähig) → Tier 3 Protokoll-Vorschläge (bestehende Bus-Peripherie bevorzugen). *(Opus · groß · mit Plan — setzt Peripherie-Abstraktion voraus)*
- **Interaktives LVGL-Display** (firmware, board-spezifisch) — Snapshot-Consumer (rendert Werte per LVGL) **und** Command-Quelle (Touch → `writeActuator` / `setSetpoint` über bestehende WebUI-Handler). Kein Aktor — eigene Klasse, LVGL gekapselt; stärkste Analogie ist `RemotePublisher`. Ziel-Board: LilyGo T-Display-S3-AMOLED. Profitiert vom Backlog: Charts, Timer und Sollwert-Rampen kann das Display mit anzeigen.
  - *Dazu:* **Firmware je nach Display laden** — passende Firmware-Variante online oder von SD-Karte laden (baut auf dem OTA-Varianten-Modell auf).
  - *(Opus · groß · mit Plan)*
- **HTTPS-Support** — Voraussetzung für **Push-Notifications via [ESPToolKit/esp-webPush](https://github.com/ESPToolKit/esp-webPush)**, da die Browser-Push-API nur über `https://` registriert. Plan: ESPAsyncWebServer + BearSSL via `ESPAsyncTCPSSL` oder Migration auf ESP-IDF-`esp_https_server`. Zert-Strategie: Self-signed (User akzeptiert einmalig) vs. mDNS-Hostname + Let's Encrypt über lokalen ACME-Proxy. Achtung: SSE über TLS verdoppelt grob den RAM-Footprint pro Client. *(Opus · groß · mit Plan — Zert-Strategie ist eine Architektur-Entscheidung)*

## Buckets (bei Gelegenheit)

- **Mobile Nutzung** (vorgemerkt 2026-08-12) — das Dashboard wird typischerweise am Kessel/Handy bedient, nicht am Desktop. Nach dem WinUI-Redesign prüfen: Touch-Ziele, Breakpoints, Lesbarkeit der Cards/NavShell auf kleinen Screens. *(Sonnet · mittel · mit Plan — Audit + mehrere Seiten systematisch durchgehen)*
