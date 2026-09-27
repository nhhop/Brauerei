# Peripherie-Abstraktion, Etappe 1: PeripheralRegistry für OneWire und SPI

Stand 2026-09-27 · Branch `feature/peripheral-registry` · Worktree `../Brauerei-peripherals`

## Ausgangslage (Ist)

- `DynamicItems::getOrCreateBus(pin)` legt pro Pin eine `OneWire`-Instanz in
  `onewireBuses_` an — **nur für adressierte DS18B20**. Ein DS18B20 ohne `address`
  baut sich über `DS18B20Sensor(id, pin)` eine eigene, private `OneWire` auf
  demselben GPIO. Busse werden **nie abgebaut**, `onewireBuses_` wächst nur.
- MAX31865 mit `clk` erzeugt in `begin()` einen eigenen `Adafruit_MAX31865` im
  Software-SPI-Modus (Bit-Bang, pro Instanz). Es gibt heute **kein geteiltes
  SPI-Objekt**; die „SPI-Pin-Duplizierung“ ist, dass jede Item-Config
  `clk/miso/mosi` wiederholt und jedes Item sie selbst treibt.
- `GET /api/bus/scan` ruft `scanOneWireBus()` **ohne RegistryLock** aus dem
  AsyncTCP-Task — der Scan bit-bangt also potentiell gleichzeitig mit
  `loop()`s DS18B20-Tick auf demselben Pin.
- Am LilyGo: `HLT` = DS18B20, Pin 1, mit Adresse → hängt heute schon am
  geteilten Bus.

## Entscheidungen

### 1. Wo es lebt: BrewControl-Firmware (nicht SensActCtrl)

`src/PeripheralRegistry.h` — header-only und Arduino-frei wie `PinMap.h`, damit
es im nativen Test-Env der Firmware läuft (`test_build_src = no`, `-Isrc`).
Die konkreten Busse (`OneWireBus`, `SpiBus`) sind Arduino-Code und stehen in
`DynamicItems.cpp`.

Begründung:
- Die Library ist schon richtig geschnitten: Sensoren bekommen ihren Bus per
  Dependency Injection (`DS18B20Sensor(id, OneWire&, addr)`). *Wer* einen Bus
  wann anlegt und abbaut, ist Anwendungslogik — bei BrewControl getrieben von
  Item-Configs, die zur Laufzeit per REST kommen und gehen. Ein
  Standalone-Sketch hält seine Busse einfach als globale Objekte.
- Keine neue öffentliche Library-API, die im Standalone-README gepflegt und
  stabil gehalten werden muss, solange es genau einen Verbraucher gibt.
- Umzug später billig: Die Registry kennt weder Arduino noch Item-Configs.
  Braucht ein Standalone-Sketch sie, wandert der Header nach `SensActCtrl/src/core/`.

**Einzige Library-Änderung:** neuer Konstruktor
`DS18B20Sensor(const char* id, OneWire& bus, uint8_t resolutionBits = 12)` —
geteilter Bus, *ohne* Adresse (erstes Gerät, wie der Pin-Konstruktor), Bus
gehört nicht dem Sensor. Damit hängen **alle** DS18B20 an der Registry, nicht
nur die adressierten; zwei `OneWire`-Treiber auf einem GPIO gibt es dann nicht
mehr. Verhalten sonst identisch (gleiche Dallas-Aufrufe).

### 2. Interface-Schnitt

```cpp
class Peripheral {
 public:
  virtual ~Peripheral() = default;
  virtual const char* type() const = 0;  // "onewire", "spi"
  virtual void begin() {}                // beim ersten Nutzer
  virtual void end() {}                  // nach dem letzten Nutzer, vor delete
  const std::string& id() const;         // "onewire:4", "spi:18/19/23"
};

class PeripheralRegistry {
 public:
  class Ref;  // RAII-Handle, kopierbar; jede Kopie zählt als Nutzer
  template <class T, class... Args>
  Ref acquire(const std::string& id, Args&&... ctorArgs);  // find-or-create + begin()
  Peripheral* find(const std::string& id) const;
  size_t users(const std::string& id) const;               // 0 = nicht vorhanden
  size_t size() const;
};
```

- **id** ist die Bus-Identität, abgeleitet aus Typ + Pins: `onewire:<pin>`,
  `spi:<clk>/<miso>/<mosi>`. Das Typ-Präfix macht Kollisionen zwischen Typen
  unmöglich; `Ref::as<T>()` castet deshalb ohne Laufzeit-Prüfung. Wird später
  eine Bus-Id in der Item-Config erlaubt, ist es genau diese Zeichenkette.
- **Nutzerzählung** = Anzahl lebender `Ref`s. `SensorEntry` bekommt
  `std::vector<PeripheralRegistry::Ref> buses`, **vor** `innerPtr` deklariert,
  damit der Sensor vor seinem Bus zerstört wird. Damit stimmt die Zählung auf
  jedem Pfad ohne Buchhaltung von Hand: `removeSensor` (Entry weg → Ref weg),
  fehlgeschlagenes `add*` (temporärer Entry weg → Ref weg), Boot (`loadFromSD`).
- **begin()** läuft beim ersten `acquire`, also schon im `loadFromSD`-Pfad vor
  `registry.begin()` — der Bus muss stehen, bevor ein Sensor-`begin()` ihn
  nutzt. **end()** + delete beim letzten Release.
- **tick()** kommt *nicht* ins Interface: OneWire und SPI brauchen keins, und
  ein leerer Aufruf in `loop()` wäre spekulativ. Andockpunkt für das erste
  Gerät, das es braucht (z. B. Expander mit Interrupt-Polling): virtuelle
  `tick()` mit leerem Default, aufgerufen in `loop()` **innerhalb** des
  bestehenden `RegistryLock`-Blocks vor `registry.tick()`.
- Registry liegt als Member `peripherals_` in `DynamicItems`, **vor** `sensors_`
  deklariert (wird nach allen Entries zerstört — ersetzt `onewireBuses_` an
  genau der Stelle).

### 3. Ersetzen per PUT

`replaceSensor` kopiert vor `replaceEntry` die Bus-Refs des alten Eintrags in
eine lokale Variable (`const auto held = entry->buses;`). Damit fällt die
Nutzerzahl beim Entfernen nie auf 0: Behält das neue Item den Pin, bekommt es
**dieselbe** Bus-Instanz (kein `end()`/`begin()`-Flattern); scheitert das neue
Item und das alte wird wiederhergestellt, ebenso. Wechselt der Pin, wird der
alte Bus nach dem Ersetzen mit dem Ende von `held` abgebaut. Der Template-Helper
`replaceEntry` bleibt unverändert. `replaceActuator`/`replaceController` sind
unberührt — kein Aktor und kein Regler nutzt heute einen Bus.

### 4. Nebenläufigkeit

Keine eigene Sperre. Die Registry ist bewusst nicht thread-safe und wird nur
angefasst, wo `RegistryLock` ohnehin gilt:
- `add*/remove*/replace*` — REST-Handler über `underRegistryLock`, Boot vor
  `loop()`.
- **Neu:** `GET /api/bus/scan` läuft unter `underRegistryLock`-Muster
  (`RegistryTryLock`, 503 „busy, retry“ bei Timeout). Grund: der Scan benutzt
  den Registry-eigenen Bus aus dem AsyncTCP-Task, während `loop()` darauf
  DS18B20 tickt. Kostet `loop()` die Dauer eines Scans (ein paar zehn ms pro
  Gerät), heute blockiert derselbe Scan den AsyncTCP-Task genauso lange.
  → `openapi.yaml`: `503` für `/api/bus/scan` nachtragen.
- Reihenfolge „Registry vor SD“ unverändert: Die Registry macht kein SD-I/O.

### 5. SPI in dieser Etappe

`SpiBus` hält nur `clk/miso/mosi`; `begin()`/`end()` sind leer. MAX31865 bekommt
seine Pins weiter selbst und bit-bangt wie bisher — **kein Wechsel auf
Hardware-SPI**: das wäre ein Verhaltenswechsel (SPI-Host-Belegung, auf dem
LilyGo nutzt die SD-Karte schon eine HSPI-Instanz) und ist ohne
MAX31865-Hardware nicht verifizierbar. Nutzen jetzt: das Item hängt
nachweislich am Bus (Nutzerzählung, Lebenszyklus), und Pin-Manager 3a kann
„vorhandene SPI-Leitungen“ aus der Registry vorschlagen. MAX31865 im
Hardware-SPI-Modus (ohne `clk`, globales `SPI` mit Board-Default-Pins) wird
**nicht** registriert — seine Pins kennt heute auch die Pin-Prüfung nicht.
Die eigentliche Entdoppelung (ein `SPIClass` pro Bus, Items referenzieren per
Bus-Id statt Pins zu wiederholen) bleibt Teil einer späteren Etappe.

### 6. Pin-Prüfung (`PinMap.h`) bleibt bewusst getrennt

`Share::OneWire/Spi` in `collectPins` wird **nicht** aus der Registry gespeist:
- Die Prüfung läuft, *bevor* es ein Objekt gibt (`checkItemPins` beim Anlegen,
  beim Ersetzen mit den eigenen Pins als frei), und über gespeicherte Configs,
  die gar nicht geladen werden konnten (`findPinConflicts` beim Boot). Die
  Registry kennt nur instanziierte Busse — sie hätte für genau diese Fälle
  keine Antwort.
- `PinMap.h` ist eine reine Funktion Config → Belegung, header-only und nativ
  getestet; eine Abhängigkeit auf Laufzeit-Objekte würde das aufgeben.
- Beide Seiten leiten sich aus denselben Config-Schlüsseln ab (`pin` bei
  DS18B20, `clk/miso/mosi` bei MAX31865). `Share` sagt „dieser Pin darf mit
  Gleichartigen geteilt werden“, die Registry „diese Items teilen sich zur
  Laufzeit dieses Objekt“ — Deklaration vs. Instanz.

### 7. Andockpunkte für später (nicht jetzt gebaut)

- **I²C:** `I2cBus : Peripheral` mit id `i2c:<sda>/<scl>` hält ein `TwoWire&`
  (Board-Bus `Wire` auf `BREWCTL_I2C_SDA/SCL`, der schon Reserved in der
  Pin-Tabelle ist). Library-Sensoren (BME280, GY-521) bekommen analog zu
  DS18B20 einen `TwoWire&`-Konstruktor. Onboard-Geräte (RTC, Touch, PMU) sind
  feste Nutzer, die `main.cpp` einmal acquired und nie freigibt.
- **Geräte am Bus:** ein `Peripheral` darf selbst Nutzer eines anderen sein
  (MCP4725 hält eine `Ref` auf `i2c:7/6`) — die Zählung trägt das ohne
  Erweiterung. id z. B. `mcp4725:0x60@i2c:7/6`.
- **Fähigkeiten anbieten:** kleine Library-Interfaces pro Fähigkeit
  (`DacOutput`, `GpioPort`), die ein Peripheriegerät zusätzlich implementiert;
  `AnalogOutputActuator` bekommt einen Konstruktor mit `DacOutput&`. Die
  Registry bekommt dafür eine Abfrage „wer bietet `dac`?“ (kein `dynamic_cast` —
  Arduino-ESP32 baut mit `-fno-rtti` → virtuelle `capabilities()`-Bitmaske
  am `Peripheral`). Diese Interfaces **müssen** in
  die Library, weil die Aktoren dort leben; das ist der Moment, die Registry
  mitzunehmen, falls ein Standalone-Fall existiert.
- **Bus-Id in der Item-Config:** optionales `bus: "spi:18/19/23"` statt
  wiederholter Pins; ohne Feld gilt die Pin-Ableitung wie heute.

## Schritte

1. `src/PeripheralRegistry.h` + `test/test_peripheral_registry/` (Firmware,
   nativ) — Tests mit Fake-Peripheral, das `begin/end` zählt:
   - zwei Nutzer teilen sich eine Instanz, `begin()` einmal
   - ersten freigeben → Bus bleibt, `end()` nicht gerufen
   - letzten freigeben → `end()` einmal, `find` liefert nullptr
   - Ersetzen (held-Kopie, alt weg, neu acquire) → gleiche Instanz, kein `end()`
   - Ersetzen mit gescheitertem Neu-Item + Wiederherstellen → gleiche Instanz
   - Ersetzen mit Pin-Wechsel → alter Bus nach Ende von `held` abgebaut
   - Ref kopieren/verschieben zählt korrekt; unterschiedliche ids = getrennte Busse
   → verify: `pio test -e native` (Firmware)
2. SensActCtrl: `DS18B20Sensor(id, OneWire&, bits)` + `test/test_ds18b20/`
   (Sensor auf fremdem Bus löscht ihn nicht; adressiert + unadressiert auf einem
   Bus) → verify: `pio test -e native` (SensActCtrl)
3. `DynamicItems`: `onewireBuses_`/`getOrCreateBus` → `peripherals_`,
   `OneWireBus`/`SpiBus`, `SensorEntry::buses`, `held` in `replaceSensor`,
   `scanOneWireBus` über `peripherals_.find`
4. `WebUI.cpp`: Bus-Scan unter Registry-Lock; `openapi.yaml` 503 → verify: redocly lint
5. Builds `esp32dev`, `lolin_s2_mini`, `lilygo_t_display_s3_amoled`
6. Gerät (LilyGo, OTA): vorher prüfen, ob eine andere Session Hardwaretests
   fährt; `GET /api/config` + `GET /api/backup` sichern; flashen;
   `/api/config` byte-identisch; `HLT` liefert Werte; zweiten DS18B20 auf Pin 1
   anlegen (per Scan-Adresse bzw. Dummy-Adresse), HLT liefert weiter, per PUT
   umbenennen, löschen, HLT liefert weiter; Config wieder identisch.
7. Doku: `PLAN.md` (Etappe 1 raus, Rest bleibt), `SESSION.md`,
   `BrewControl/README.md` (Abschnitt Busse), `SensActCtrl/README.md`
   (neuer DS18B20-Konstruktor).
