# Plan: Energiemanagement-Seite + Deep-Sleep-Betrieb

## Context

PLAN.md (Größere Brocken, 2026-09-22) wünscht iSpindel-artigen Batteriebetrieb: Einstellungsseite
„Energiemanagement“, Batteriespannung, Deep-Sleep zwischen Messungen und einen Wach-Pin, der
zwischen Kurz-Wach (messen → publizieren → schlafen) und Voll-Wach (UI etc.) unterscheidet.
Heute gibt es keinerlei Sleep-Code (nur `WiFi.setSleep(false)`), keinen Batterie-Code und kein
Messintervall; `setup()` blockiert bis zu 6×30 s auf WLAN und fällt sonst ins Setup-Portal.

**Nutzer-Entscheidungen (2026-09-29):**
- Kurz-Wach publiziert über **beide** Wege: WLAN + bestehende Transporte (MQTT/Webhook/WebSocket)
  **und** ESP-NOW. Ist WLAN im Kurz-Wach abgeschaltet, sendet ESP-NOW auf dem **zuletzt bekannten
  Kanal**, sonst ESP-NOW wie heute über die STA-Verbindung.
- Wach-Pin: **beides** — Pegel aktiv hält voll wach (Jumper); Flanke weckt per ext0, danach
  Voll-Wach mit Timeout, den UI-Zugriffe verlängern.
- Welche Funktionen im Kurz-Wach laufen, ist **konfigurierbar** (Display, Weboberfläche, WLAN,
  Update-Suche, …) — nicht board-spezifisch.
- Batterie = **normales Sensor-Item**, das auf der Seite als Batteriequelle ausgewählt wird
  (plus Knopf „anlegen“ mit Voreinstellung). Nachtrag 2026-09-30: dafür eigener Sensortyp
  `Voltage` („Spannung“) mit Pin und den Widerständen R1/R2 des Spannungsteilers, statt eines
  `AnalogInput` mit Teilerverhältnis.
- Messintervall = **nur Schlafdauer**. Im Dauer-Wach-Betrieb ändert sich an Messen/Publishen nichts.
- **Gestaffelt**: Stufe 1 und Stufe 2 getrennt mergebar.

## Arbeitsumgebung

- Umsetzung in einem **eigenen Git-Worktree** (`EnterWorktree`, Branch z. B.
  `feature/energiemanagement`), nicht im Haupt-Checkout. Stufe 1 und 2 als getrennte PRs
  (Stufe 2 auf Stufe 1 aufbauend bzw. nach deren Merge per `sync_with_base_branch`).
- Im Worktree zuerst `pnpm install` in `BrewControl/web`; `preview_start` serviert den
  Haupt-Checkout → UI-Prüfung über den Node-Mock mit dem `dist/` aus dem Worktree.
- Beim Aufräumen: `node_modules`-Junctions verhindern `git worktree remove` → Rest per
  `rmdir /s /q` nach Prüfung der Junction-Ziele.
- Als erstes diesen Plan nach `docs/superpowers/plans/2026-09-29-energiemanagement.md` im
  Worktree kopieren (wie bei Peripherie-Etappe 1).

---

## Stufe 1 — Energie-Seite + Batteriequelle

### Firmware
- `SettingsStore.h/.cpp`: neuer Abschnitt `energy` in load/serialize/update (Muster: `display`,
  SettingsStore.cpp ~L70/~L138/~L218). Stufe 1 nur `batterySensor` (Item-Id, `""` = keine).
- `WebUI.cpp` POST `/api/settings` (L1736ff): `energy.batterySensor` validieren (nur String-Typ, sonst 400;
  bewusst ohne Registry-Abgleich, verwaiste Id zeigt die UI). Kein Reboot.
- Neuer Sensortyp `Voltage`: `SensActCtrl::VoltageSensor` (`analogReadMilliVolts` ×
  (R1+R2)/R2, Glättung, `Quantity::Voltage`), Zweig in `DynamicItems::addSensorNoBegin`
  (`pin`, `r1` ≥ 0, `r2` > 0 in kΩ, `smoothing`), ADC-Bedarf in `PinMap.h` `collectPins`.
- `PinMap.h` `struct Board` (L34): optional `batteryPin`/`batteryR1`/`batteryR2` (nur LilyGo:
  GPIO 4, 100/100 kΩ für 1:2 laut LilyGo-Beispiel); `writePinsJson` gibt sie als
  `battery` aus, damit die UI die Voreinstellung kennt. `BoardPins.h` LilyGo-Tabelle ergänzen.
- `openapi.yaml`: `EnergySettings`-Schema, `AppSettings` (Abschnittszahl im Text), Patch-Schema,
  neue 400-Texte; `/api/pins` Board-Feld. Redocly-Lint.

### Web
- `types.ts`: `EnergySettings`, `AppSettings.energy`, `PinsInfo.battery?`.
- Neue Seite `pages/EnergyPage.tsx` (Muster `DisplayPage.tsx`: `SettingsGroup`/`SettingsCard`,
  Sofort-Speichern via `updateSettings({energy})`), Route `/settings/energy` in `app.tsx` mit
  `snap={snap}`, Eintrag in `SettingsIndex.tsx` `ENTRIES` (lucide `BatteryMedium`), Breadcrumb.
- Karte „Batterie“: Auswahl aus den Spannungssensoren (Einheit `V`/Größe `Voltage`) im
  Snapshot; Live-Spannung aus `snap` plus grober LiPo-Prozentwert (feste Kurve 3,3–4,2 V, reine
  UI-Funktion in `energy.ts` mit Vitest). Knopf „Batteriesensor anlegen“: erzeugt über die
  bestehende Item-Add-API einen `Voltage`-Sensor (Pin, R1, R2 aus `battery` bzw. leer mit
  `PinHint analog`, Smoothing 16) und wählt ihn aus; Hinweis auf Feinabgleich per Kalibrierung.
- Typ „Spannung“ auch im normalen Dialog „Gerät hinzufügen“ (`itemTypes.ts`, `AddItemModal.tsx`,
  `pins.ts` `needsOf`).
  Referenziertes Item gelöscht → „Sensor nicht gefunden“.

### Verifikation Stufe 1
`pnpm typecheck && pnpm test && pnpm build`; `pio run` für alle drei Envs; UI gegen Node-Mock
(Memory „BrewControl-UI ohne Gerät prüfen“) und am LilyGo: Sensor anlegen, auswählen, Spannung
mit Multimeter vergleichen, Reload behält Auswahl.

---

## Stufe 2 — Deep-Sleep, Wach-Pin, Kurz-Wach-Profil

### Umgesetzt 2026-09-30 — Abweichungen vom Text darunter
- **Kurz-Wach-Profil auf einen Schalter reduziert** (Nutzer): nur `shortWakeWifi`.
  Weboberfläche und Display sind im Kurz-Wach immer aus, NTP läuft mit WLAN immer mit,
  der Datalog folgt dem An/Aus der Logs. `lastWake` heißt `wakeCause` (`timer`/`pin`/null).
- **Ausgänge im Schlaf festgeklemmt** (`gpio_hold_en` + `gpio_deep_sleep_hold_en`), sonst
  hingen sie in der Luft; Freigabe erst direkt vor `registry.begin()`.
- Ein Druck auf den Wach-Pin im Kurz-Wach macht `ESP.restart()` (kein zweiter Bootpfad).
- Logs/Programme ticken im Kurz-Wach erst, wenn jeder Sensor einmal gemessen hat (sonst
  wäre die einzige Log-Zeile leer); ohne WLAN ticken MQTT/Webhook/WebSocket gar nicht
  (ihr Connect blockiert sonst ~7 s).
- Als Zugriff zählt jeder HTTP-Request — auch Body-Handler, die vor der Middleware
  antworten (sonst schlief das Gerät direkt nach dem Speichern ein) — ein offener
  Event-Stream und ein Display-Touch.

### Festlegungen 2026-09-30 (gehen dem Text darunter vor)
- **Voraussetzung umgesetzt:** Regler (an/aus, Sollwert) und Aktoren (an/aus, Wert, Intervall)
  kommen nach jedem Neustart — also auch nach jedem Aufwachen — in ihren letzten Zustand zurück
  (`src/RuntimeState.h`, `/config/state.json`, eigener PR vor Stufe 2).
- **Regler blockieren den Schlaf nicht**, sie regeln nur in den Wachphasen. Aus `sleepBlocked()`
  fallen Regler, Programme und Timer heraus; es bleibt das laufende Firmware-Update.
- **Programme und Timer kürzen das Schlafintervall** auf ihr nächstes festes Ereignis: Ende
  eines `Hold`-Schritts (`stepStartedEpoch + holdSec`), Timer-Ablauf (`startedEpoch +
  durationSec`). Sensor-Schritte und `Awaiting` haben kein festes Ende → normales Intervall.
  Im Kurz-Wach ticken deshalb Registry, Programme und Timer (Alarme/Push nicht).
- **Aktoren im Schlaf aus:** vor `esp_deep_sleep_start()` alle Ausgänge auf den inaktiven Pegel,
  ohne das in `state.json` zu speichern (das Aufwachen stellt den Zustand wieder her). Pegel
  halten kostet selbst kaum Strom, wohl aber die Last dahinter (Relaisspule ~70 mA, Modul-LED).
  Vor dem Schlaf einen noch nicht gespeicherten Zustand sofort schreiben.
- **Wach-Pin:** freier RTC-fähiger Pin; GPIO 0 bleibt gesperrt (Jumper = Download-Modus beim
  Einschalten, Werksreset). Andere Strapping-Pins → Warnung. Dauerhaft aktiv = bleibt wach;
  ein Druck während eines Kurz-Wach macht daraus Voll-Wach. `resetHeldAtBoot()` nur nach
  Power-on, nicht nach einem Aufwachen.
- **Entfällt:** `shortWake.updateCheck` (Ergebnis geht mit dem Schlaf verloren),
  `publishNow()` (Publisher senden ohnehin im 1-s-Takt → nach „alles gültig und verbunden“
  ~1,5 s nachlaufen), `LogStore::appendNow()` (der erste Log-Tick nach dem Boot schreibt
  sofort eine Zeile; Kompression greift über Schlafzyklen nicht).
- **ESP-NOW-Kanal** im RTC-Speicher (`RTC_DATA_ATTR`) statt NVS — Kurz-Wach folgt immer auf
  einen Deep-Sleep, kein Flash-Verschleiß.

### Einstellungen (`energy`-Abschnitt erweitert)
```json
"energy": {
  "batterySensor": "bat",
  "deepSleep": false,
  "sleepIntervalSec": 300,        // 60..86400
  "wakePin": -1,                  // RTC-fähiger GPIO, Pflicht wenn deepSleep=true
  "wakeActiveLow": true,          // true = gegen GND, interner Pull-up
  "awakeTimeoutSec": 300,         // Voll-Wach nach Tastendruck/Einschalten, 60..3600
  "shortWake": { "wifi": true, "webui": false, "display": false,
                 "updateCheck": false, "datalog": true, "ntp": true }
}
```
GET liefert zusätzlich read-only `lastWake: {cause: "timer"|"pin"|"power_on"|…, mode:
"short"|"full"}`. Änderungen an `deepSleep`/`wakePin`/`shortWake` wirken ab dem nächsten Aufwachen,
kein Reboot nötig.

**Validierung (400/409):** `deepSleep=true` ohne `wakePin` → 400 (sonst ist das Gerät nur per
Werksreset erreichbar); `wakePin` nicht RTC-fähig → 400; `wakePin` von einem Item belegt → 409.
`webui`/`ntp`/`updateCheck` ohne `wifi` werden akzeptiert, aber ignoriert (UI graut sie aus).

### Pin-Manager
- `PinMap.h`: neue Board-Maske `rtcGpio` (esp32dev: 0,2,4,12–15,25–27,32–39; S2/S3: 0–21) in allen
  drei Tabellen (`BoardPins.h`), `/api/pins` gibt `rtc: 1` je Pin aus; `PinNeeds`-Pendant `rtc`
  in `web/src/pins.ts` (+ Tests in `pins.test.ts` und `test_pin_map`).
- System-Pin-Belegung: der Wach-Pin wird als zusätzlicher `PinUse{id:"energy", key:"wake_pin"}`
  in `DynamicItems::pinUses()`-Konsumenten eingespeist (Item-Anlegen/Ersetzen DynamicItems.cpp
  ~L946/~L1025 und `GET /api/pins`, WebUI.cpp L1188), damit Items ihn nicht belegen können.

### Firmware-Kern: `src/EnergyManager.h/.cpp` + header-only `src/WakeMode.h`
- `WakeMode.h` (Arduino-frei, nativ testbar in `test/test_wake_mode/`):
  - `classify(cause, pinActive, deepSleepEnabled) → Short | Full` — Timer-Wakeup ohne aktiven
    Pin = Short; alles andere (Power-on, Reset, ext0, Pin aktiv, Sleep aus) = Full.
  - `mayFullSleep(now, lastActivity, timeout, pinActive, blockers) → bool`.
  - `sleepDurationUs(intervalSec, awakeMs)` (Wachzeit abziehen, Minimum 1 s).
- `EnergyManager`:
  - `beginEarly()` ganz am Anfang von `setup()`: liest `esp_sleep_get_wakeup_cause()`, Pin-Pegel
    (mit Pull-up), merkt Modus. Settings sind da noch nicht geladen → Short nur, wenn Ursache
    Timer ist (Timer wird nur mit aktiviertem Deep-Sleep gestellt); nach `settingsStore.load`
    wird bestätigt (Deep-Sleep inzwischen aus → Full).
  - `noteActivity()` — von der WebUI-Request-Middleware, SSE-Clients > 0 und Display-Touch.
  - `sleepBlocked()` — Programm läuft, Timer aktiv, Firmware-Update ≠ Idle, ein Regler ist
    enabled. (Aktoren sind im Schlaf stromlos → kein Deep-Sleep, solange etwas regelt.)
  - `enterDeepSleep()` — Display aus, WLAN/ESP-NOW stoppen, `esp_sleep_enable_timer_wakeup`,
    `esp_sleep_enable_ext0_wakeup(wakePin, !activeLow)` + `rtc_gpio_pullup_en` bei activeLow,
    `esp_deep_sleep_start()`.
  - Letzter ESP-NOW-Kanal: bei jeder STA-Verbindung `WiFi.channel()` in NVS
    (`brewctrl`/`espnow_ch`, nur bei Änderung schreiben).

### `main.cpp` — Kurz-Wach als Guards im bestehenden Ablauf (kein zweiter Bootpfad)
- `energy.beginEarly()` vor dem Serial-Warten; Short überspringt die 3,2 s Serial-Wartezeit und
  `resetHeldAtBoot()`.
- `settingsStore.loadFromSD` vor die WLAN-Verbindung ziehen (hängt nur am FS).
- WLAN: Short+`wifi` → **ein** Versuch mit ~8 s Timeout, kein Portal, bei Fehlschlag weiter ohne
  WLAN (ESP-NOW auf gemerktem Kanal). Short ohne `wifi` → kein STA, `EspNowTransport(lastCh)` —
  der Konstruktor kann das schon (EspNowTransport.cpp: ohne STA eigener Kanal).
- Übersprungen im Short je nach Profil: mDNS + `webUI.begin()` + Push (`webui`), `displayUI`
  (`display`), `firmwareUpdater.begin/tick` (`updateCheck`), `configTime` (`ntp`),
  `runPendingInstall`, `remoteDiscovery`. Nie im Short: Programme/Timer/Alarme-Tick.
- `loop()` im Short: nur `sensor->tick()` für `registry.sensors()` (keine Regler/Aktoren) +
  Publisher-Services + `espNowTransport->tick()`; dann `energy.shortWakeTick()`:
  1. warten bis jeder Sensor-Kanal `valid` mit `timestampMs` nach Boot hat oder `fault()` meldet
     (max. 3 s — DS18B20 braucht ~750 ms);
  2. warten bis jeder aktivierte Service `connected()` (max. ~5 s);
  3. einmal sofort publizieren: Services bekommen `publishNow()` (setzt State-Intervall ihres
     `RemotePublisher` auf 0 für einen Tick — keine Library-Änderung nötig); Meta geht beim
     Verbinden ohnehin raus;
  4. `datalog`: neue `LogStore::appendNow(reg, fs, epoch)` schreibt je Log eine Zeile, falls
     die Uhr gültig ist;
  5. ~300 ms Nachlauf (MQTT-/WebSocket-Loop, ESP-NOW-Send-Callbacks), dann `enterDeepSleep()`.
  - Harte Obergrenze 30 s Wachzeit ab Boot → schlafen, egal was hängt.
  - `webui` im Short aktiv und ein HTTP-Request kommt → Wechsel nach Full (Timeout läuft).
- `loop()` im Full bei `deepSleep=true`: `energy.tick()` → schlafen, sobald Pin inaktiv,
  `awakeTimeoutSec` seit letzter Aktivität verstrichen und nichts blockiert.
- Uhrzeit: Die ESP32-Systemzeit läuft im Deep-Sleep über den RTC-Timer weiter (am Gerät
  verifizieren, Drift des internen RC-Oszillators ~%); mit `ntp` wird bei jedem Kurz-Wach
  nachgestellt, gewartet wird nur, wenn die Uhr noch ungültig ist (max. 2 s). Ohne gültige Uhr
  schreibt der Datalog nichts (bestehendes Verhalten).

### Web (EnergyPage erweitert)
- Gruppe „Deep-Sleep“ mit explizitem Speichern + `ConfirmModal` (Muster `WebhookPage.tsx`: dirty
  via JSON-Vergleich, Fehler sichtbar), weil Aktivieren das Gerät einschlafen lässt.
- Felder: Toggle Deep-Sleep; Intervall als `ChoiceSelect` (1/5/15/30/60 min, 6/12/24 h);
  Wach-Pin (Zahl + `PinHint` mit `rtc`/`pullup`), Aktiv-Low-Toggle; Wach-Timeout.
- Gruppe „Im Kurz-Wach aktiv“: je Funktion ein `ToggleSwitch`; `display` nur bei
  `display.supported`; `webui`/`ntp`/`updateCheck` ausgegraut ohne `wifi`; Hinweis, welche
  Transporte ohne WLAN entfallen (nur ESP-NOW bleibt).
- Status-Zeile aus `lastWake`; Hinweis, wenn ein Regler enabled ist (blockiert Schlaf).
- `SystemStatusPage` zeigt `deep_sleep` schon an — nichts zu tun.

### Docs (je Stufe im selben Commit)
`openapi.yaml` (+ Lint), `BrewControl/README.md` neuer Abschnitt „Energiemanagement“,
PLAN.md-Eintrag nach Stufe 1 kürzen, nach Stufe 2 ersatzlos entfernen; SESSION.md-Einträge.

### Bewusst nicht enthalten
Unterspannungs-Abschaltung/längeres Intervall bei leerem Akku, Alarme/Push im Kurz-Wach,
Hardware-RTC (PCF8563), PMU SY6970 — bleiben/kommen als eigene PLAN.md-Punkte.

### Verifikation Stufe 2
1. `pio test -e native` in `BrewControl/firmware` (neue `test_wake_mode`, erweiterte
   `test_pin_map`) und `SensActCtrl` unverändert grün; `pio run` alle drei Envs.
2. `pnpm typecheck && pnpm test && pnpm build`.
3. Am Gerät (Lolin S2 + LilyGo; USB-CDC stirbt im Schlaf → Beobachtung über Broker/Empfänger):
   - Deep-Sleep 1 min, WLAN+MQTT: Broker-Zeitstempel im Minutentakt, `mosquitto_sub` zeigt
     Batterie- und Sensorwerte; Wachzeit pro Zyklus aus den Abständen abschätzen.
   - WLAN im Kurz-Wach aus, ESP-NOW an: zweites Board (dauerwach) empfängt Remote-Werte.
   - Taster am Wach-Pin: UI erreichbar, bleibt beim Klicken wach, schläft nach Timeout;
     Jumper: bleibt dauerhaft wach, `resetReason` nach Schlaf = `deep_sleep`.
   - Datalog-Zeilen mit plausiblen Zeitstempeln über mehrere Zyklen (Drift ohne NTP prüfen).
   - Regler enabled → schläft nicht; Validierung `deepSleep` ohne Wach-Pin → 400.

### Risiken
- GPIO 0 als Wach-Pin: Strapping-Pin (Jumper beim Einschalten = Bootloader) und
  `resetHeldAtBoot()` löscht nach 5 s Halten die WLAN-Daten → PinHint-Warnung, nur als Taster.
- Pegel der Aktor-Pins im Schlaf undefiniert (daher Schlaf-Sperre bei aktivem Regler).
