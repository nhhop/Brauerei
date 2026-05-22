# IDS Induction Cooker Actuator — Design Spec

**Date:** 2026-05-22  
**Status:** Approved

---

## 1. Library Fix: IdsInductionCooker

**Repository:** `C:\Users\nhhop\repos\IdsInductionCooker`

### Problems to fix

| Problem | Fix |
|---------|-----|
| `ICACHE_RAM_ATTR` on ISR (ESP8266-only, fails on ESP32) | Replace with `#ifdef ESP8266 … #else IRAM_ATTR #endif` |
| Constructor ignores `type` and pin parameters (commented out) | Restore and activate pin assignment + type storage |
| `D5/D6/D7` defaults in header (ESP8266 names, not valid on ESP32) | Replace with integer literals `5, 6, 7`; document as ESP8266 equivalents |
| `Serial.println()` debug output hardcoded | Remove all `Serial.*` calls |
| Private `errorCode` / `errorMessage` with no public getters | Add `int getErrorCode() const` and `const char* getError() const` |

The fix targets both ESP8266 and ESP32. No logic changes — the timing protocol and power-level mapping remain identical.

---

## 2. fault() Interface (SensActCtrl)

A non-breaking default method is added to both base interfaces:

```cpp
// Sensor.h
virtual const char* fault() const { return nullptr; }

// Actuator.h
virtual const char* fault() const { return nullptr; }
```

`RegistrySnapshot::serializeRegistry()` emits `"fault": "<message>"` only when `fault() != nullptr`. When `nullptr`, the field is absent.

`web/src/types.ts`:
```ts
export interface Sensor  { /* ... */ fault?: string; }
export interface Actuator { /* ... */ fault?: string; }
```

`SensorCard.tsx` and `ActuatorCard.tsx` show a yellow warning badge when `fault` is set:
```tsx
{item.fault && (
  <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded">
    ⚠ {item.fault}
  </span>
)}
```

---

## 3. IdsActuator (SensActCtrl)

**New files:** `SensActCtrl/src/actuators/IdsActuator.h` + `IdsActuator.cpp`

```cpp
class IdsActuator : public Actuator {
  const char*   id_;
  IdsType       type_;
  IdsCooker     cooker_;
  int           power_ = 0;      // 0–100, quantized to valid IDS steps
  float         state_ = 0.0f;
  unsigned long nextTick_ = 0;
  static constexpr unsigned long kIntervalMs = 500;
 public:
  IdsActuator(const char* id, IdsType type,
              uint8_t pinWhite, uint8_t pinYellow, uint8_t pinInterrupt);

  void        begin()  override;
  void        tick()   override;   // calls cooker_.Update() max 2×/s
  void        write(float v) override; // 0.0–1.0, quantized
  float       state()  const override;
  ActuatorMeta meta()  const override; // Continuous, DutyCycle, [0,1]
  const char* fault()  const override; // cooker_.getError() or nullptr
};
```

**`write(float v)`:** clamps to [0,1], converts to `power_` quantized to valid steps:
- IDS1: 0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100 (10 levels)
- IDS2: 0, 25, 50, 75, 100 (5 levels)

**`tick()`:** calls `cooker_.Update(power_)` only when `millis() >= nextTick_`; then `nextTick_ += 500`. The ~246ms blocking per call is acceptable for brewing applications; ESP32 WiFi runs on a separate core.

**`#ifdef ARDUINO` guard:** entire `.cpp` wrapped so native test builds can include the header without GPIO/timing dependencies. No native unit tests for IdsActuator itself.

**Umbrella header:** `SensActCtrl/src/SensActCtrl.h` gets `#include "actuators/IdsActuator.h"`.

---

## 4. Dependency Management

`IdsInductionCooker` is linked via symlink — consistent with the existing `symlink://../../SensActCtrl` pattern.

**`BrewControl/firmware/platformio.ini`** (esp32dev + lilygo + lolin envs):
```ini
lib_deps =
    symlink://../../SensActCtrl
    symlink://../../../IdsInductionCooker
```

**`SensActCtrl/platformio.ini`** (esp32dev env only — native env needs no Arduino libs):
```ini
lib_deps =
    symlink://../../IdsInductionCooker
```

`IdsActuator.h` includes `<IdsCooker.h>` — PlatformIO resolves via symlink.

---

## 5. DynamicItems Factory (BrewControl Firmware)

New branch in `addActuatorNoBegin()` in `DynamicItems.cpp`:

```cpp
} else if (strcmp(type, "IDS1") == 0 || strcmp(type, "IDS2") == 0) {
  int pinW = cfg["pin_white"]     | -1;
  int pinY = cfg["pin_yellow"]    | -1;
  int pinI = cfg["pin_interrupt"] | -1;
  if (pinW < 0 || pinY < 0 || pinI < 0)
    return {false, "missing pin_white / pin_yellow / pin_interrupt"};
  auto itype = strcmp(type, "IDS1") == 0 ? IdsType::IDS1 : IdsType::IDS2;
  e->ptr = std::make_unique<IdsActuator>(
      e->id.c_str(), itype, pinW, pinY, pinI);
```

POST `/api/actuators` payload:
```json
{"type":"IDS1","id":"cooker","pin_white":5,"pin_yellow":6,"pin_interrupt":7}
```

Two separate type strings (`"IDS1"` / `"IDS2"`) consistent with existing sensor naming (`DS18B20`, `MAX31865`).

---

## 6. Web Frontend (BrewControl)

### types.ts
`fault?: string` on `Sensor` and `Actuator` interfaces.

### ActuatorCard.tsx + SensorCard.tsx
Yellow warning badge when `fault` is set (see Section 2).

### AddItemModal.tsx
New actuator type options: `IDS1 (10 Stufen)` and `IDS2 (5 Stufen)`.

Form fields when IDS1 or IDS2 selected:
- `pin_white` (default 5)
- `pin_yellow` (default 6)
- `pin_interrupt` (default 7)

Submit builds: `{ type: 'IDS1' | 'IDS2', id, pin_white, pin_yellow, pin_interrupt }`.

Manual control via the existing ActuatorCard slider (POST `/api/actuators/:id` with `{"v": 0.0–1.0}`). PID controller support is already covered by the existing PID factory — no new UI needed.

---

## Files to Create / Modify

| File | Action |
|------|--------|
| `IdsInductionCooker/src/IdsCooker.h` | Modify: fix ISR attr, pin defaults, add error getters |
| `IdsInductionCooker/src/IdsCooker.cpp` | Modify: fix ISR attr, constructor, remove Serial, implement getters |
| `SensActCtrl/src/core/Sensor.h` | Modify: add `fault()` default |
| `SensActCtrl/src/core/Actuator.h` | Modify: add `fault()` default |
| `SensActCtrl/src/core/RegistrySnapshot.cpp` | Modify: emit `fault` field when non-null |
| `SensActCtrl/src/actuators/IdsActuator.h` | Create |
| `SensActCtrl/src/actuators/IdsActuator.cpp` | Create |
| `SensActCtrl/src/SensActCtrl.h` | Modify: add IdsActuator include |
| `SensActCtrl/platformio.ini` | Modify: add IdsInductionCooker symlink to esp32dev env |
| `BrewControl/firmware/platformio.ini` | Modify: add IdsInductionCooker symlink |
| `BrewControl/firmware/src/DynamicItems.h` | Modify: add IdsActuator include |
| `BrewControl/firmware/src/DynamicItems.cpp` | Modify: add IDS1/IDS2 factory branch |
| `BrewControl/web/src/types.ts` | Modify: add `fault?` to Sensor + Actuator |
| `BrewControl/web/src/components/SensorCard.tsx` | Modify: add fault badge |
| `BrewControl/web/src/components/ActuatorCard.tsx` | Modify: add fault badge |
| `BrewControl/web/src/components/AddItemModal.tsx` | Modify: add IDS1/IDS2 form |
