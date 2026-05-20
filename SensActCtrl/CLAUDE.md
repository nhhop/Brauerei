# CLAUDE.md — SensActCtrl

> **Hinweis:** Das Root-`CLAUDE.md` wird zuerst geladen und enthält die gemeinsamen Verhaltensrichtlinien (Think Before Coding, Simplicity First, Surgical Changes, Goal-Driven Execution). Dieses File enthält nur Library-spezifischen Kontext.

## Projekt

SensActCtrl ist eine wiederverwendbare ESP32-Library (PlatformIO, Arduino, C++17) für Sensoren, Aktoren und Regler. Sie stellt die Domain-Abstraktionen bereit, auf die BrewControl (Schwester-Projekt im Monorepo) aufbaut.

**Status:** Phase 1–3 komplett, 31/31 native Tests grün, 13 Beispiel-Sketches. Details in `PLAN.md` und `session.md`.

## Architektur

```
src/
├── core/         Reading, Quantity, ValueKind, Registry, RegistrySnapshot
├── sensors/      DS18B20, BME280, AnalogInput, DigitalInput, PulseCounter
├── actuators/    DigitalOutput (Binary + TPO), PulseOutput
├── controllers/  TwoPoint, PID (AutoTune-Wrapper)
├── transport/    ITransport, MqttTransport, EspNowTransport, WebhookTransport
└── remote/       RemoteSensor, RemoteActuator, RemotePublisher, MetaJson, Topics
```

`RegistrySnapshot::serialize()` emittiert den vollständigen JSON-State — BrewControl nutzt dieses Format direkt ohne eigene Serialisierung.

## Commands

```powershell
cd SensActCtrl
pio test -e native          # Unit-Tests (kein Hardware nötig)
pio run -e esp32dev         # Compile-Check gegen esp32dev-Target
```

## Arbeitsregeln

- Änderungen an der Library **immer** mit `pio test -e native` verifizieren.
- `RegistrySnapshot`-JSON-Shape ist Wire-Format für BrewControl — Breaking Changes koordinieren.
- `library.json` / `library.properties` für Standalone-Publishing erhalten.
- Plan / Status / Entscheidungen leben in `PLAN.md` und `session.md`.
