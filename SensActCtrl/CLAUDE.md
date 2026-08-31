# CLAUDE.md — SensActCtrl

> **Hinweis:** Das Root-`CLAUDE.md` wird zuerst geladen und enthält die gemeinsamen Verhaltensrichtlinien (Think Before Coding, Simplicity First, Surgical Changes, Goal-Driven Execution). Dieses File enthält nur Library-spezifischen Kontext.

## Projekt

SensActCtrl ist eine wiederverwendbare ESP32-Library (PlatformIO, Arduino, C++17) für Sensoren, Aktoren und Regler. Sie stellt die Domain-Abstraktionen bereit, auf die BrewControl (Schwester-Projekt im Monorepo) aufbaut.

**Status:** Phase 1–3 komplett, 189+ native Tests grün. Details in [`../PLAN.md`](../PLAN.md) (Root) und [`../SESSION.md`](../SESSION.md); Architektur-/API-Referenz in [`README.md`](README.md).

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
- `library.json` / `library.properties` für Standalone-Publishing erhalten; `README.md` bewusst eigenständig verständlich halten (reist mit dem Paket, wenn die Library standalone gezogen wird — Rest des Monorepos ist dann nicht sichtbar).
- Plan / Status / Entscheidungen leben im Root-`PLAN.md`/`SESSION.md` — nicht mehr lokal (siehe Root-`CLAUDE.md` → Dokumentation).
