# CLAUDE.md — Brauerei Monorepo

This file provides shared guidance for Claude Code when working anywhere in this repository. Each sub-project loads this file first, then its own CLAUDE.md with project-specific details.

## Monorepo-Struktur

```
Brauerei/
├── SensActCtrl/   ESP32-Library: generische Sensor/Aktor/Regler-Primitive + Remote-Transporte
└── BrewControl/   Web-UI Consumer: Firmware (ESPAsyncWebServer) + Preact-SPA (Vite)
```

**Verhältnis:** SensActCtrl stellt die Domain-Abstraktionen bereit (`Registry`, `Sensor`, `Actuator`, `Controller`, `RegistrySnapshot`). BrewControl nutzt diese Library unverändert und fügt HTTP + SSE Transport sowie das Browser-Frontend hinzu. Die Library ist frontend-agnostisch — `serializeRegistry()` emittiert bereits das vollständige JSON-State.

**SensActCtrl bleibt standalone veröffentlichbar** (library.json / library.properties sind unverändert).

**lib_dep:** `BrewControl/firmware/platformio.ini` referenziert die Library via `symlink://../../SensActCtrl` — kein Publish-Umweg nötig.

## Common Commands

```powershell
# SensActCtrl — Unit-Tests (native, kein Hardware nötig)
cd SensActCtrl
pio test -e native

# BrewControl — Firmware
cd BrewControl/firmware
pio run -e esp32dev              # compile-smoke
pio run -e esp32dev -t upload    # flash
pio device monitor               # serial @ 115200

# BrewControl — Web-Frontend
cd BrewControl/web
pnpm install
pnpm dev                         # HMR auf :5173, /api → ESP32
pnpm build                       # → web/dist/, auf SD-Karte kopieren
pnpm typecheck
```

## Dokumentation

- **`PLAN.md`** (Root): Systemarchitektur-Überblick und Status beider Projekte
- **`SESSION.md`** (Root): Cross-projekt Session-Log für Arbeiten, die beide Projekte betreffen
- **`SensActCtrl/CLAUDE.md`**: Library-spezifischer Kontext
- **`SensActCtrl/PLAN.md`** / **`SensActCtrl/session.md`**: Detaillierte Library-History
- **`BrewControl/CLAUDE.md`**: BrewControl-spezifischer Kontext
- **`BrewControl/PLAN.md`** / **`BrewControl/SESSION.md`**: Detaillierte BrewControl-History

Vor substanziellen Änderungen: sub-projekt PLAN.md lesen. SESSION.md danach aktualisieren.

---

## Verhaltensrichtlinien

Diese Richtlinien gelten für alle Arbeiten im Repository.

### 1. Think Before Coding

**Keine Annahmen. Keine versteckte Verwirrung. Tradeoffs benennen.**

Vor der Implementierung:
- Annahmen explizit formulieren. Bei Unsicherheit fragen.
- Bei mehreren Interpretationen alle nennen — nicht still eine wählen.
- Wenn ein einfacherer Ansatz existiert, sagen. Zurückdrängen wenn gerechtfertigt.
- Bei Unklarheit: stoppen, benennen was unklar ist, fragen.

### 2. Simplicity First

**Minimaler Code der das Problem löst. Nichts Spekulatives.**

- Keine Features über das Verlangte hinaus.
- Keine Abstraktionen für Einzel-Use-Code.
- Keine "Flexibilität" oder "Konfigurierbarkeit" die nicht verlangt wurde.
- Kein Error-Handling für unmögliche Szenarien.
- Wenn 200 Zeilen, die 50 sein könnten: neu schreiben.

Frage: "Würde ein Senior-Engineer das als überkompliziert bezeichnen?" Wenn ja: vereinfachen.

### 3. Surgical Changes

**Nur anfassen was notwendig ist. Nur den eigenen Müll aufräumen.**

Beim Editieren von bestehendem Code:
- Keinen benachbarten Code, Kommentare oder Formatierung "verbessern".
- Nichts refaktoren was nicht kaputt ist.
- Bestehenden Stil matchen, auch wenn man es anders machen würde.
- Wenn unbenutzter Code auffällt: erwähnen — nicht löschen.

Wenn eigene Änderungen Orphans erzeugen:
- Imports/Variablen/Funktionen entfernen die durch die eigenen Änderungen unbenutzt wurden.
- Vorher existierenden Dead-Code nicht entfernen, außer explizit verlangt.

Test: Jede geänderte Zeile sollte direkt auf das User-Request zurückführen.

### 4. Goal-Driven Execution

**Erfolgskriterien definieren. Loop bis verifiziert.**

Tasks in verifizierbare Ziele überführen:
- "Validierung hinzufügen" → "Tests für ungültige Inputs schreiben, dann grün machen"
- "Bug fixen" → "Test schreiben der den Bug reproduziert, dann grün machen"
- "X refaktoren" → "Tests vor und nach dem Refactor grün halten"

Für Multi-Step-Tasks einen kurzen Plan formulieren:
```
1. [Schritt] → verify: [Check]
2. [Schritt] → verify: [Check]
```

---

**Dokumentationssprache:** Plan/Session-Docs sind auf Deutsch; Code-Identifier und Inline-Kommentare bleiben Englisch.
