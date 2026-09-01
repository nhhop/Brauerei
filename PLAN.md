# Brauerei — Backlog & offene Punkte

Heimbrauerei-Steuerung auf ESP32-Basis: Library `SensActCtrl` (Sensor-/Aktor-/Regler-Primitive + Remote-Transporte) plus Web-UI-Consumer `BrewControl` (Firmware + Preact-SPA).

**Dieses Dokument enthält nur Offenes** — Bugs, bekannte Einschränkungen, Backlog und Gedanken zu neuen Features. Sobald ein Punkt umgesetzt ist, wandert er ersatzlos hier raus; die erledigte Historie steht chronologisch in [SESSION.md](SESSION.md) / [SESSION-archive.md](SESSION-archive.md). Architektur- und API-Referenz stehen in den READMEs ([SensActCtrl/README.md](SensActCtrl/README.md), [BrewControl/README.md](BrewControl/README.md)).

SensActCtrl und BrewControl werden gemeinsam geplant, unabhängig davon, welches Teilprojekt eine Änderung betrifft.

---

## Bugs & bekannte Einschränkungen

- **ESP-NOW verwirft Pakete >250 Byte silently.** `EspNowTransport::sendDataPacket_()` gibt bei Überschreitung `false` zurück, kein Retry. Betrifft v.a. Controller mit vielen Params (DualStage/SplitRangePID) — deren Meta-Publish kann dauerhaft scheitern. `lastErrorMessage()` zeigt seit 2026-08-29 „Paket zu groß (…)", aber nichts liest das aktiv aus/loggt es.
- **Create-Endpoints akzeptieren auch GET/PUT/PATCH** (2026-09-01) — `AsyncCallbackJsonWebHandler` matcht per Default `HTTP_GET|POST|PUT|PATCH`, und die URI-Matcher der Library sind Prefix-Matcher (`^uri(/.*)?$`). `GET /api/sensors` landet dadurch im Create-Handler und antwortet `400 missing id` statt `405`. Implementierungsartefakt, bewusst **nicht** in `openapi.yaml` als Vertrag dokumentiert.
- **`POST /api/update/assets` (UI-Tar-Upload) bricht auf LOLIN S2 Mini ab** (`Connection was reset` nach ~65 KB, Board bleibt stabil, kein Crash). Vorbestehender Code-Pfad (`SdTarSink`/`TarExtractor`), auf LilyGo S3 nicht reproduziert. Nicht weiter untersucht (2026-08-29).
- **`WebhookService::getOrCreate()` cached strikt nach `(port, peerUrl)`.** Zwei verschiedene Peers, die sich denselben lokalen Port teilen wollen, erzeugen zwei separate `WebServer`-Instanzen auf demselben physischen Port → Bind-Konflikt. Im Test 2026-08-29 umgangen (anderer Port für den zweiten Consumer), Cache-Design selbst nicht gefixt.
- **LittleFS-Boards (esp32dev/lolin_s2_mini): kein Boot-Flash-Recovery, keine Log-Retention** (2026-08-28) — `FirmwareUpdater::flashFromSdImage()` passt nicht in die 256-KB-Datenpartition (Netzwerk-OTA unberührt); `LogStore` rotiert dort nicht, sollte nicht unbegrenzt loggen.
- **GPIO/LEDC-Leak-Fix (2026-08-14) ohne Hardware-Nachtest** — der Fix (`ledcDetachPin()` in `end()`, `removeActuator`/`removeSensor` rufen jetzt `end()`) ist umgesetzt, der praktische Nachtest („Pin nach Löschen ohne Reboot erneut mit Sensor belegen") blieb mangels Board offen.
- **Frontend: keine gruppierte SensorCard für Multi-Channel-Sensoren** — HCSR04 und YF-S201 erzeugen je 2 separate Karten (`tank.distance` / `tank.derived`, `flow.rate` / `flow.volume`). Verbesserung: `app.tsx` gruppiert Snapshot-Einträge nach Base-ID, eine Karte pro logischem Sensor mit mehreren Kanal-Zeilen; Delete-Button und Zähler zeigen dann logische Sensoren statt Kanäle. Quick-Fix für korrektes Delete/Reset ist drin (2026-05-30). ⚠️ Voraussetzung für „Gradienten/Ableitungen".
- **Bus-Scan-UX: kein visuelles Feedback nach einem Scan ohne Treffer** (2026-05-20) — Hint-Text im Sensor-Formular ist vor und nach einem ergebnislosen OneWire-Scan identisch, nicht erkennbar ob überhaupt gescannt wurde. Nicht buggy, nur verwirrend.
- **`pio device monitor` auf TinyUSB-CDC unter Windows instabil** (ESP32-S2 und -S3): Monitor verliert sporadisch Output. Workaround: PowerShell-Skript mit `System.IO.Ports.SerialPort`, DTR/RTS-Toggle für Reset, `ReadExisting()`-Loop (siehe `BrewControl/README.md`). Mögliche Permanent-Fixes: `--filter direct`, anderes Terminal (PuTTY/Tera Term), Monitor-Reconnect-Tuning.
- QEMU/Simulation ist nicht viable (keine WiFi-Emulation für ESP32) — Verifikation läuft immer am Gerät.

## Hardware-Verifikation offen

- **SSR-Heizung unter Last mit Oszilloskop** — TPO-Schaltflanken prüfen.
- **IDS-Induktionskocher E2E** mit echter Hardware.
- **Gärsteuerung Dual-Output-Regler E2E am Gerät** — DualStage/SplitRangePID anlegen, beide Ausgänge live, Anti-Short-Cycle der Kühlstufe, Kühl-Aktor-Löschen-Block.
- **PID-AutoTune E2E am Gerät** — Status idle→running→done, übernommene Gains, Abbruch. Ebenso **SplitRangePID-AutoTune E2E**.

---

## Backlog

Grob nach Bereitschaft / Aufwand; Abhängigkeiten stehen inline. Jeder Punkt bekommt bei Bedarf eine eigene Spec → Plan → Implementierung.

- **Sensor-Kalibrierung** — einheitliches Offset/Scale-Interface (ggf. Mehrpunkt) + UI; ersetzt die heutigen ad-hoc-Lösungen (HX711-`tare`, YF-S201-`calibration`, Analog-`setRange`).
- **PID-AutoTune — Fortschrittsanzeige/Restzeit** für den laufenden Vorgang (braucht zusätzliche Backend-Instrumentierung; die aktuelle UI zeigt nur idle/running/done).
- **Timer-Widget** — Dashboard-Element für Brau-Timings.
- **Gradienten/Ableitungen (Library)** — rate-of-change als zusätzlicher Channel (°C/min, K/min, L/min²). ⚠️ Erst nach gruppierter SensorCard (s. Bugs), da sonst noch mehr Einzelkarten pro Sensor entstehen.
- **Alarme & Schwellwerte** — „Wert > X" → Warnung/Badge, baut auf `fault()` auf.
  - *Erweiterung:* **Notification/Alert-Center** — zentrale Toast-/Verlaufsansicht statt nur Karten-Badge, z.B. bei Fault, Programm-Ende, AutoTune-fertig. Baut auf dem Fluent/WinUI-Designsystem auf.
- **Datalog — API-seitige Dezimierung** (LTTB/Douglas-Peucker mit `?points=`) für sehr lange Archiv-Zeiträume; Live-Chart-Append an `intervalSec` angleichen (aktuell 1 Hz).
- **Mehrsprachigkeit** — Sprache auf der „Zeit & Region"-Seite wählbar (Umbenennung von „Zeit & Formate").
- **Hardware-RTC (PCF8563)** als Fallback für Betrieb ohne WiFi — LilyGo T-Display-S3-AMOLED hat den Chip onboard; einmalige NTP-Sync schreibt in die RTC, danach zeitstempelstabil auch offline.
- **Webhook-Sensor-Aktor.**
- **Profil-Bibliothek** (vorgemerkt 2026-08-12) — eigene Seite/Menüpunkt „Profile": wiederverwendbare Schritt-Vorlagen (Maischeplan, Gärverlauf) anlegen und benennen, statt Schritte bei jedem neuen Programm erneut einzutippen. Im `ProgramEditorModal` ein Profil auswählen → befüllt die Schritte einer konkreten `programs[]`-Instanz (Kopie, nicht Live-Referenz — Instanz bleibt unabhängig editierbar/lauffähig). Vermutlich analog `DashboardStore`/`SettingsStore`: eigener `ProfileStore` mit SD-Persistenz + REST (`GET/POST /api/profiles`, `POST/DELETE /api/profiles/:id`).
- **Multi-Regler-Programme** (vorgemerkt 2026-08-12) — ein Schritt hält heute genau einen Sollwert für einen Controller. Besonders für die Gärung: pro Schritt mehrere Ziele koppeln — Temperatur (Heizen/Kühlen via `DualStage`/`SplitRangePID`), Druck (Ventil-Aktor), plus einmalige Aktor-Trigger zu einem Zeitpunkt (z.B. Hopfen-Dropper). Erweitert das `ProgramRunner`/`programs[]`-Schema: Liste von Zielen pro Schritt (`{controllerId, setpoint}[]`) plus optionale One-Shot-Aktor-Aktionen. Betrifft auch die Profil-Bibliothek.
- **Sensorgetriggerte Schritte** (vorgemerkt 2026-08-12) — ein Schritt endet heute nur über `holdSec` (Zeit) oder `confirm` (manuelle Freigabe). Dritte Bedingung: Schrittende an einen Sensorwert koppeln, z.B. „Gravity < 1.010" beim Gären. Braucht eine generische Schwellwert-Bedingung (`{sensorId, op, value}`) im Schritt-Schema — teilt sich vermutlich Logik mit „Alarme & Schwellwerte".
- **AP-Modus** als wählbare Alternative (Standalone ohne Router) — verschoben, weil ohne Internet kein NTP (bricht Datalog-Timestamps); sinnvoll zusammen mit Hardware-RTC. Ebenso statische IP / DHCP-Konfiguration.
- **Zugriffsschutz / Auth** — bewusst niedrig priorisiert (Heimnetz), nur als Vormerkung.

## Größere Brocken (eigene Spec vor Umsetzung)

- **Peripherie-Abstraktion** — `Peripheral`-Interface (`id`, `type`, `begin`/`tick`/`end`) + `PeripheralRegistry`, das geteilte Busse (OneWire / I2C / SPI / CAN) beim ersten passenden Consumer automatisch anlegt. Sensoren/Aktoren referenzieren per Bus-Id oder hängen sich anhand der Pins automatisch an. Verallgemeinert die bestehende `getOrCreateBus`-Logik in `DynamicItems.cpp`, beseitigt die SPI-Pin-Duplizierung bei MAX31865. Port-Expander / CAN-Transceiver = spätere konkrete Peripherie auf derselben Naht (Hardware aktuell nicht vorhanden). Reines Rückgrat, kein User-Feature für sich — enabler für den Pin-Manager.
- **Pin-Manager** (firmware, auf Peripherie-Abstraktion aufbauend) — Board-Capability-Map (per Board-Define): Input-only Pins 34–39, Strapping-Pins, Flash/PSRAM-belegte Pins (z.B. 33–37 auf S3-AMOLED), DAC-Pins 25/26, Default I2C/SPI/UART. `GET /api/pins` liefert frei/belegt; Belegung = Peripherie (geteilt/beitrittsfähig) + Items mit exklusiven Pins. Stufen: Tier 1 Belegung + Map → Tier 2 Constraint-Query (interrupt-/serial-/dac-fähig) → Tier 3 Protokoll-Vorschläge (bestehende Bus-Peripherie bevorzugen).
- **Interaktives LVGL-Display** (firmware, board-spezifisch) — Snapshot-Consumer (rendert Werte per LVGL) **und** Command-Quelle (Touch → `writeActuator` / `setSetpoint` über bestehende WebUI-Handler). Kein Aktor — eigene Klasse, LVGL gekapselt; stärkste Analogie ist `RemotePublisher`. Ziel-Board: LilyGo T-Display-S3-AMOLED. Profitiert vom Backlog: Charts, Timer und Sollwert-Rampen kann das Display mit anzeigen.
  - *Dazu:* **Firmware je nach Display laden** — passende Firmware-Variante online oder von SD-Karte laden (baut auf dem OTA-Varianten-Modell auf).
- **HTTPS-Support** — Voraussetzung für **Push-Notifications via [ESPToolKit/esp-webPush](https://github.com/ESPToolKit/esp-webPush)**, da die Browser-Push-API nur über `https://` registriert. Plan: ESPAsyncWebServer + BearSSL via `ESPAsyncTCPSSL` oder Migration auf ESP-IDF-`esp_https_server`. Zert-Strategie: Self-signed (User akzeptiert einmalig) vs. mDNS-Hostname + Let's Encrypt über lokalen ACME-Proxy. Achtung: SSE über TLS verdoppelt grob den RAM-Footprint pro Client.

## Buckets (bei Gelegenheit)

- **Mobile Nutzung** (vorgemerkt 2026-08-12) — das Dashboard wird typischerweise am Kessel/Handy bedient, nicht am Desktop. Nach dem WinUI-Redesign prüfen: Touch-Ziele, Breakpoints, Lesbarkeit der Cards/NavShell auf kleinen Screens.
