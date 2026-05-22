# IDS Induction Cooker Actuator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrate the IdsInductionCooker library into SensActCtrl as an `IdsActuator`, expose it via BrewControl firmware and web UI, and add a `fault()` interface to both Sensor and Actuator base classes.

**Architecture:** Fix the existing `IdsInductionCooker` library for ESP32 compatibility, then wrap it as `IdsActuator` in SensActCtrl (guarded by `#ifdef ARDUINO` so native tests are unaffected). BrewControl firmware gains an IDS1/IDS2 factory branch in `DynamicItems`. The web frontend adds a fault badge to sensor/actuator cards and an IDS form to `AddItemModal`.

**Tech Stack:** C++17, PlatformIO, ArduinoJson 7, Preact 10 + TypeScript 5 + Tailwind CSS 4, Unity test framework (native)

---

## File Map

| File | Action |
|------|--------|
| `IdsInductionCooker/src/IdsCooker.h` | Modify: fix pin defaults, constructor signature, add error getters |
| `IdsInductionCooker/src/IdsCooker.cpp` | Modify: fix ISR attr, constructor bodies, remove Serial, add getter impl |
| `SensActCtrl/src/core/Sensor.h` | Modify: add `fault()` default method |
| `SensActCtrl/src/core/Actuator.h` | Modify: add `fault()` default method |
| `SensActCtrl/test/mocks/MockActuator.h` | Modify: add `faultMsg` + `fault()` override |
| `SensActCtrl/test/mocks/MockSensor.h` | Modify: add `faultMsg` + `fault()` override |
| `SensActCtrl/test/test_snapshot/test_snapshot.cpp` | Modify: add 2 fault-field tests |
| `SensActCtrl/src/core/RegistrySnapshot.cpp` | Modify: emit `fault` field when non-null |
| `SensActCtrl/src/actuators/IdsActuator.h` | Create |
| `SensActCtrl/src/actuators/IdsActuator.cpp` | Create |
| `SensActCtrl/src/SensActCtrl.h` | Modify: add IdsActuator include (ARDUINO-guarded) |
| `BrewControl/firmware/platformio.ini` | Modify: add IdsInductionCooker symlink to `[common]` |
| `BrewControl/firmware/src/DynamicItems.cpp` | Modify: add IDS1/IDS2 factory branch |
| `BrewControl/web/src/types.ts` | Modify: add `fault?: string` to Sensor + Actuator |
| `BrewControl/web/src/components/SensorCard.tsx` | Modify: add fault badge |
| `BrewControl/web/src/components/ActuatorCard.tsx` | Modify: add fault badge |
| `BrewControl/web/src/components/AddItemModal.tsx` | Modify: add actuator type selector + IDS form |

---

## Task 1: Fix IdsInductionCooker Library

**Files:**
- Modify: `IdsInductionCooker/src/IdsCooker.h`
- Modify: `IdsInductionCooker/src/IdsCooker.cpp`

- [ ] **Step 1.1: Fix IdsCooker.h**

Replace the public section pin defaults and constructor signatures:

```diff
 public:
     IdsType IDS_TYPE = IdsType::IDS2;

-    unsigned char PIN_WHITE = D5;     // D5 RELAIS
-    unsigned char PIN_YELLOW = D6;    // D6 AUSGABE AN PLATTE
-    unsigned char PIN_INTERRUPT = D7; // D7 EINGABE VON PLATTE
+    unsigned char PIN_WHITE = 5;      // GPIO5 (≡ D5 on NodeMCU/ESP8266)
+    unsigned char PIN_YELLOW = 6;     // GPIO6 (≡ D6)
+    unsigned char PIN_INTERRUPT = 7;  // GPIO7 (≡ D7)

     IdsCooker(IdsType type);
-    IdsCooker(IdsType type, char white, char yellow, char interrupt);
+    IdsCooker(IdsType type, uint8_t white, uint8_t yellow, uint8_t interrupt);
     void Update(const int setpower);    
     void Init();    
+
+    int         getErrorCode() const;
+    const char* getError()     const;  // nullptr when no error
 };
```

Also add `#include <stdint.h>` below `#include <Arduino.h>` (line 4) if not already present.

- [ ] **Step 1.2: Fix ISR attribute in IdsCooker.cpp**

Find line 253 (the `ICACHE_RAM_ATTR` definition) and replace:

```diff
-void ICACHE_RAM_ATTR IdsCooker::readInputStatic()
+#ifdef ESP8266
+void ICACHE_RAM_ATTR IdsCooker::readInputStatic()
+#else
+void IRAM_ATTR IdsCooker::readInputStatic()
+#endif
```

- [ ] **Step 1.3: Fix constructor bodies in IdsCooker.cpp**

Replace both constructor bodies (lines 35–51):

```cpp
IdsCooker::IdsCooker(IdsType type)
{
    staticInduction = this;
    this->IDS_TYPE = type;
}

IdsCooker::IdsCooker(IdsType type, uint8_t white, uint8_t yellow, uint8_t interrupt)
{
    staticInduction = this;
    this->IDS_TYPE      = type;
    this->PIN_WHITE     = white;
    this->PIN_YELLOW    = yellow;
    this->PIN_INTERRUPT = interrupt;
}
```

- [ ] **Step 1.4: Remove Serial.println() calls from IdsCooker.cpp**

In `updatePower()` (~line 154), delete:
```cpp
            Serial.println("off");
```

In `updateError()` (~lines 352–354), delete:
```cpp
    Serial.println("error!");
    Serial.println(errorMessage);
```

- [ ] **Step 1.5: Add getError() and getErrorCode() implementations**

Append before the closing `}` of the file (after the last function):

```cpp
int IdsCooker::getErrorCode() const {
    return errorCode;
}

const char* IdsCooker::getError() const {
    return errorCode != 0 ? errorMessage.c_str() : nullptr;
}
```

- [ ] **Step 1.6: Commit**

```bash
cd C:\Users\nhhop\repos\IdsInductionCooker
git add src/IdsCooker.h src/IdsCooker.cpp
git commit -m "fix: ESP32 compatibility — ISR attr, pin defaults, constructor, error getters"
```

---

## Task 2: Add fault() to Sensor and Actuator Interfaces

**Files:**
- Modify: `SensActCtrl/src/core/Sensor.h`
- Modify: `SensActCtrl/src/core/Actuator.h`
- Modify: `SensActCtrl/test/mocks/MockActuator.h`
- Modify: `SensActCtrl/test/mocks/MockSensor.h`

- [ ] **Step 2.1: Add fault() to Sensor.h**

In `SensActCtrl/src/core/Sensor.h`, after `virtual void tick() = 0;` add:

```cpp
  virtual const char* fault() const { return nullptr; }
```

The Sensor class should now look like:
```cpp
class Sensor {
 public:
  virtual ~Sensor() = default;

  virtual const char* id()                const = 0;
  virtual size_t      channelCount()      const = 0;
  virtual Channel     channel(size_t idx) const = 0;

  virtual void begin() {}
  virtual void end()   {}
  virtual void tick()  = 0;
  virtual const char* fault() const { return nullptr; }
};
```

- [ ] **Step 2.2: Add fault() to Actuator.h**

In `SensActCtrl/src/core/Actuator.h`, after `virtual float state() const = 0;` add:

```cpp
  virtual const char* fault() const { return nullptr; }
```

- [ ] **Step 2.3: Add faultMsg + fault() to MockActuator.h**

In `SensActCtrl/test/mocks/MockActuator.h`, add after `uint32_t tickCount = 0;`:

```cpp
  const char* faultMsg = nullptr;
  const char* fault() const override { return faultMsg; }
```

- [ ] **Step 2.4: Add faultMsg + fault() to MockSensor.h**

In `SensActCtrl/test/mocks/MockSensor.h`, add after `uint32_t tickCount = 0;`:

```cpp
  const char* faultMsg = nullptr;
  const char* fault() const override { return faultMsg; }
```

- [ ] **Step 2.5: Run tests to verify no regressions**

```powershell
C:\Users\nhhop\.platformio\penv\Scripts\pio.exe test -e native
```

Expected: all 41 tests PASS.

- [ ] **Step 2.6: Commit**

```bash
git add SensActCtrl/src/core/Sensor.h SensActCtrl/src/core/Actuator.h
git add SensActCtrl/test/mocks/MockActuator.h SensActCtrl/test/mocks/MockSensor.h
git commit -m "feat(SensActCtrl): add fault() default to Sensor and Actuator interfaces"
```

---

## Task 3: Add fault Field to RegistrySnapshot

**Files:**
- Modify: `SensActCtrl/test/test_snapshot/test_snapshot.cpp`
- Modify: `SensActCtrl/src/core/RegistrySnapshot.cpp`

- [ ] **Step 3.1: Write failing tests**

Add two new test functions in `SensActCtrl/test/test_snapshot/test_snapshot.cpp`, before the `setUp()` function:

```cpp
void test_snapshot_actuator_fault_absent_when_null() {
  MockActuator heater("heater", switchMeta());  // faultMsg is nullptr by default
  Registry reg;
  reg.add(&heater);

  char buf[512];
  serializeRegistry(reg, buf, sizeof(buf));
  JsonDocument doc;
  deserializeJson(doc, buf);

  JsonObject a0 = doc["actuators"].as<JsonArray>()[0];
  TEST_ASSERT_TRUE(a0["fault"].isNull());
}

void test_snapshot_actuator_fault_present_when_set() {
  MockActuator heater("heater", switchMeta());
  heater.faultMsg = "E0: Kein Topf";
  Registry reg;
  reg.add(&heater);

  char buf[512];
  serializeRegistry(reg, buf, sizeof(buf));
  JsonDocument doc;
  deserializeJson(doc, buf);

  JsonObject a0 = doc["actuators"].as<JsonArray>()[0];
  TEST_ASSERT_EQUAL_STRING("E0: Kein Topf", a0["fault"].as<const char*>());
}
```

Also register them in `main()`:
```cpp
  RUN_TEST(test_snapshot_actuator_fault_absent_when_null);
  RUN_TEST(test_snapshot_actuator_fault_present_when_set);
```

- [ ] **Step 3.2: Run tests to verify they fail**

```powershell
C:\Users\nhhop\.platformio\penv\Scripts\pio.exe test -e native
```

Expected: the 2 new tests FAIL (fault field not yet emitted).

- [ ] **Step 3.3: Implement fault field in RegistrySnapshot.cpp**

In the actuator loop (around line 68–78 of `RegistrySnapshot.cpp`), add `fault` emission after the `state` block:

```cpp
  for (Actuator* a : reg.actuators()) {
    JsonObject obj = actuatorsArr.add<JsonObject>();
    obj["id"] = a->id();
    writeMeta(obj["meta"].to<JsonObject>(), a->meta());

    JsonObject state = obj["state"].to<JsonObject>();
    state["v"]  = a->state();
    state["t"]  = millis();
    state["ok"] = true;

    const char* f = a->fault();
    if (f) obj["fault"] = f;
  }
```

In the sensor/channel loop (around line 43–65), add `fault` emission after creating `obj`:

```cpp
      JsonObject obj = sensorsArr.add<JsonObject>();
      obj["id"] = entryId;
      writeMeta(obj["meta"].to<JsonObject>(), ch.meta);
      JsonObject state = obj["state"].to<JsonObject>();
      state["v"]  = ch.reading.value;
      state["t"]  = ch.reading.timestampMs;
      state["ok"] = ch.reading.valid;

      const char* f = s->fault();
      if (f) obj["fault"] = f;
```

- [ ] **Step 3.4: Run tests — all should pass**

```powershell
C:\Users\nhhop\.platformio\penv\Scripts\pio.exe test -e native
```

Expected: 43 tests PASS (41 original + 2 new).

- [ ] **Step 3.5: Commit**

```bash
git add SensActCtrl/test/test_snapshot/test_snapshot.cpp SensActCtrl/src/core/RegistrySnapshot.cpp
git commit -m "feat(SensActCtrl): emit fault field in RegistrySnapshot when non-null"
```

---

## Task 4: Create IdsActuator

**Files:**
- Create: `SensActCtrl/src/actuators/IdsActuator.h`
- Create: `SensActCtrl/src/actuators/IdsActuator.cpp`
- Modify: `SensActCtrl/src/SensActCtrl.h`

- [ ] **Step 4.1: Create IdsActuator.h**

Create `SensActCtrl/src/actuators/IdsActuator.h`:

```cpp
#pragma once

#ifdef ARDUINO

#include <memory>
#include <IdsCooker.h>
#include "core/Actuator.h"
#include "core/ActuatorMeta.h"

namespace SensActCtrl {

// Wraps IdsCooker (IDS1/IDS2 induction cooker) as a SensActCtrl Actuator.
// write(0.0–1.0) sets power; tick() drives Update() at ≤2 Hz to avoid
// blocking the loop for the ~246 ms sendCommand() call.
// fault() returns the cooker's last error string, or nullptr if no error.
class IdsActuator : public Actuator {
 public:
  IdsActuator(const char* id, IdsType type,
              uint8_t pinWhite, uint8_t pinYellow, uint8_t pinInterrupt);

  const char*  id()    const override { return id_; }
  ActuatorMeta meta()  const override;

  void        begin() override;
  void        end()   override {}
  void        tick()  override;
  void        write(float v) override;
  float       state() const override { return state_; }
  const char* fault() const override;

 private:
  const char*             id_;
  IdsType                 type_;
  std::unique_ptr<IdsCooker> cooker_;
  int                     power_      = 0;
  float                   state_      = 0.0f;
  unsigned long           nextTickMs_ = 0;
  static constexpr unsigned long kIntervalMs = 500;
};

}  // namespace SensActCtrl

#endif  // ARDUINO
```

- [ ] **Step 4.2: Create IdsActuator.cpp**

Create `SensActCtrl/src/actuators/IdsActuator.cpp`:

```cpp
#ifdef ARDUINO

#include "IdsActuator.h"
#include "core/Quantity.h"
#include "core/ValueKind.h"
#include <Arduino.h>

namespace SensActCtrl {

IdsActuator::IdsActuator(const char* id, IdsType type,
                         uint8_t pinWhite, uint8_t pinYellow, uint8_t pinInterrupt)
    : id_(id),
      type_(type),
      cooker_(new IdsCooker(type, pinWhite, pinYellow, pinInterrupt)) {}

ActuatorMeta IdsActuator::meta() const {
  float res = (type_ == IdsType::IDS1) ? 0.1f : 0.2f;
  return ActuatorMeta{ValueKind::Continuous, Quantity::DutyCycle, "", 0.0f, 1.0f, res};
}

void IdsActuator::begin() {
  cooker_->Init();
  nextTickMs_ = millis();
}

void IdsActuator::write(float v) {
  if (v < 0.0f) v = 0.0f;
  if (v > 1.0f) v = 1.0f;
  state_  = v;
  power_  = static_cast<int>(v * 100.0f + 0.5f);
}

void IdsActuator::tick() {
  unsigned long now = millis();
  if (now >= nextTickMs_) {
    cooker_->Update(power_);
    nextTickMs_ = now + kIntervalMs;
  }
}

const char* IdsActuator::fault() const {
  return cooker_->getError();
}

}  // namespace SensActCtrl

#endif  // ARDUINO
```

- [ ] **Step 4.3: Add IdsActuator to umbrella header**

In `SensActCtrl/src/SensActCtrl.h`, add after `#include "actuators/PulseOutputActuator.h"`:

```cpp
#ifdef ARDUINO
#include "actuators/IdsActuator.h"
#endif
```

- [ ] **Step 4.4: Run native tests (no new failures expected)**

```powershell
C:\Users\nhhop\.platformio\penv\Scripts\pio.exe test -e native
```

Expected: 43 tests PASS. IdsActuator.cpp compiles to nothing in native builds due to `#ifdef ARDUINO`.

- [ ] **Step 4.5: Commit**

```bash
git add SensActCtrl/src/actuators/IdsActuator.h SensActCtrl/src/actuators/IdsActuator.cpp SensActCtrl/src/SensActCtrl.h
git commit -m "feat(SensActCtrl): add IdsActuator wrapping IdsInductionCooker"
```

---

## Task 5: Update BrewControl Firmware

**Files:**
- Modify: `BrewControl/firmware/platformio.ini`
- Modify: `BrewControl/firmware/src/DynamicItems.cpp`

- [ ] **Step 5.1: Add IdsInductionCooker symlink to firmware platformio.ini**

In `BrewControl/firmware/platformio.ini`, update the `[common]` lib_deps:

```ini
lib_deps =
  symlink://../../SensActCtrl
  symlink://../../../IdsInductionCooker
  esp32async/ESPAsyncWebServer@^3.1.0
  esp32async/AsyncTCP@^3.2.0
```

- [ ] **Step 5.2: Add IDS1/IDS2 factory branch to DynamicItems.cpp**

In `BrewControl/firmware/src/DynamicItems.cpp`, inside `addActuatorNoBegin()`, find the `} else {` / `"unknown actuator type"` block and insert before it:

```cpp
  } else if (strcmp(type, "IDS1") == 0 || strcmp(type, "IDS2") == 0) {
    int pinW = cfg["pin_white"]     | -1;
    int pinY = cfg["pin_yellow"]    | -1;
    int pinI = cfg["pin_interrupt"] | -1;
    if (pinW < 0 || pinY < 0 || pinI < 0)
      return {false, "missing pin_white / pin_yellow / pin_interrupt"};
    auto itype = strcmp(type, "IDS1") == 0 ? IdsType::IDS1 : IdsType::IDS2;
    e->ptr = std::make_unique<IdsActuator>(
        e->id.c_str(), itype,
        static_cast<uint8_t>(pinW),
        static_cast<uint8_t>(pinY),
        static_cast<uint8_t>(pinI));
```

The full updated else-if chain in `addActuatorNoBegin()`:
```cpp
  if (strcmp(type, "DigitalOutput") == 0) {
    // ... existing code unchanged ...
  } else if (strcmp(type, "IDS1") == 0 || strcmp(type, "IDS2") == 0) {
    int pinW = cfg["pin_white"]     | -1;
    int pinY = cfg["pin_yellow"]    | -1;
    int pinI = cfg["pin_interrupt"] | -1;
    if (pinW < 0 || pinY < 0 || pinI < 0)
      return {false, "missing pin_white / pin_yellow / pin_interrupt"};
    auto itype = strcmp(type, "IDS1") == 0 ? IdsType::IDS1 : IdsType::IDS2;
    e->ptr = std::make_unique<IdsActuator>(
        e->id.c_str(), itype,
        static_cast<uint8_t>(pinW),
        static_cast<uint8_t>(pinY),
        static_cast<uint8_t>(pinI));
  } else {
    return {false, "unknown actuator type"};
  }
```

`IdsActuator` is available via `#include <SensActCtrl.h>` which is already in `DynamicItems.h`. `IdsType` comes from `<IdsCooker.h>` which is included transitively via `IdsActuator.h`.

- [ ] **Step 5.3: Compile-check**

```powershell
cd C:\Users\nhhop\repos\Brauerei\BrewControl\firmware
C:\Users\nhhop\.platformio\penv\Scripts\pio.exe run -e esp32dev
```

Expected: `SUCCESS` with no errors. Fix any compile errors before continuing.

- [ ] **Step 5.4: Commit**

```bash
git add BrewControl/firmware/platformio.ini BrewControl/firmware/src/DynamicItems.cpp
git commit -m "feat(BrewControl/firmware): IDS1/IDS2 actuator factory in DynamicItems"
```

---

## Task 6: Web Frontend — types, fault badges, AddItemModal

**Files:**
- Modify: `BrewControl/web/src/types.ts`
- Modify: `BrewControl/web/src/components/SensorCard.tsx`
- Modify: `BrewControl/web/src/components/ActuatorCard.tsx`
- Modify: `BrewControl/web/src/components/AddItemModal.tsx`

- [ ] **Step 6.1: Add fault? to types.ts**

In `BrewControl/web/src/types.ts`, update both `Sensor` and `Actuator` interfaces:

```ts
export interface Sensor {
  id: string;
  meta: ItemMeta;
  state: ItemState;
  fault?: string;
}

export interface Actuator {
  id: string;
  meta: ItemMeta;
  state: ItemState;
  fault?: string;
}
```

- [ ] **Step 6.2: Add fault badge to SensorCard.tsx**

In `BrewControl/web/src/components/SensorCard.tsx`, inside the returned JSX, add the fault badge after the progress bar section (before the closing `</div>`). The full component return becomes:

```tsx
  return (
    <div class="rounded-lg border border-stone-200 bg-white p-4 shadow-sm">
      <div class="flex items-center justify-between gap-2">
        <h3 class="font-medium text-stone-900">{id}</h3>
        <div class="flex items-center gap-2">
          <span class="text-xs text-stone-500">{meta.quantity}</span>
          {onReset && (
            <button type="button" onClick={onReset} title="Reset volume"
              class="text-stone-400 hover:text-blue-600 leading-none text-sm">↺</button>
          )}
          {onDelete && (
            <button type="button" onClick={onDelete} title="Delete"
              class="text-stone-400 hover:text-red-600 leading-none">×</button>
          )}
        </div>
      </div>
      <div class="mt-2 flex items-baseline gap-1">
        <span class="font-mono text-2xl tabular-nums text-stone-900">
          {live ? v.toFixed(2) : '—'}
        </span>
        <span class="text-sm text-stone-500">{meta.unit}</span>
        {!state.ok && (
          <span class="ml-auto rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-800">
            stale
          </span>
        )}
      </div>
      <div class="mt-3 h-1.5 overflow-hidden rounded-full bg-stone-100">
        <div
          class="h-full rounded-full bg-stone-700 transition-[width] duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div class="mt-1 flex justify-between text-[10px] text-stone-400">
        <span>{meta.min}</span>
        <span>{meta.max}</span>
      </div>
      {sensor.fault && (
        <div class="mt-2">
          <span class="rounded bg-yellow-100 px-1.5 py-0.5 text-xs text-yellow-800">
            {sensor.fault}
          </span>
        </div>
      )}
    </div>
  );
```

Note: `sensor.fault` requires destructuring `sensor` from props instead of just `{ id, meta, state }`. Update the destructuring:

```tsx
export function SensorCard({ sensor, onDelete, onReset }: { sensor: Sensor; onDelete?: () => void; onReset?: () => void }) {
  const { id, meta, state } = sensor;
  // ... rest unchanged, just add sensor.fault at the end
```

- [ ] **Step 6.3: Add fault badge to ActuatorCard.tsx**

In `BrewControl/web/src/components/ActuatorCard.tsx`, after the `{err && ...}` line and before the closing `</div>`, add:

```tsx
      {actuator.fault && (
        <div class="mt-2">
          <span class="rounded bg-yellow-100 px-1.5 py-0.5 text-xs text-yellow-800">
            {actuator.fault}
          </span>
        </div>
      )}
```

Also update the props destructuring to keep `actuator` in scope:

```tsx
export function ActuatorCard({ actuator, onDelete }: { actuator: Actuator; onDelete?: () => void }) {
  const { id, meta, state } = actuator;
  // ... rest unchanged
```

- [ ] **Step 6.4: Add actuator type selector + IDS form to AddItemModal.tsx**

Add `ActuatorType` type at the top of the file with the other types:
```tsx
type ActuatorType = 'DigitalOutput' | 'IDS1' | 'IDS2';
```

Add state for actuator type and IDS pins in the state declarations section (after the `mode` state):
```tsx
  const [actuatorType, setActuatorType] = useState<ActuatorType>('DigitalOutput');
  const [pinWhite, setPinWhite]         = useState('5');
  const [pinYellow, setPinYellow]       = useState('6');
  const [pinInterrupt, setPinInterrupt] = useState('7');
```

In the `useEffect` reset (inside `if (open)`), add:
```tsx
      setActuatorType('DigitalOutput');
      setPinWhite('5'); setPinYellow('6'); setPinInterrupt('7');
```

In `handleSubmit`, replace the `else if (role === 'actuator')` block:
```tsx
      } else if (role === 'actuator') {
        if (actuatorType === 'DigitalOutput') {
          const p = parseInt(pin, 10);
          if (isNaN(p)) throw new Error('invalid pin');
          await createActuator({ type: 'DigitalOutput', id: trimId, pin: p, mode });
        } else {
          const pw = parseInt(pinWhite, 10);
          const py = parseInt(pinYellow, 10);
          const pi = parseInt(pinInterrupt, 10);
          if (isNaN(pw) || isNaN(py) || isNaN(pi))
            throw new Error('all three pins required');
          await createActuator({
            type: actuatorType, id: trimId,
            pin_white: pw, pin_yellow: py, pin_interrupt: pi,
          });
        }
```

Replace the entire `{/* Actuator fields */}` section (lines 351–369) with:
```tsx
          {/* Actuator type selector */}
          {role === 'actuator' && (
            <div>
              <label class={lbl}>Actuator Type</label>
              <select value={actuatorType}
                onChange={(e) => setActuatorType((e.target as HTMLSelectElement).value as ActuatorType)}
                class={inp}>
                <optgroup label="GPIO">
                  <option value="DigitalOutput">DigitalOutput (Binary / TPO)</option>
                </optgroup>
                <optgroup label="Induktion">
                  <option value="IDS1">IDS1 (10 Stufen)</option>
                  <option value="IDS2">IDS2 (5 Stufen)</option>
                </optgroup>
              </select>
            </div>
          )}

          {/* DigitalOutput fields */}
          {role === 'actuator' && actuatorType === 'DigitalOutput' && (
            <>
              <div>
                <label class={lbl}>GPIO Pin</label>
                <input type="number" value={pin}
                  onInput={(e) => setPin((e.target as HTMLInputElement).value)}
                  placeholder="e.g. 16" class={inp} required />
              </div>
              <div>
                <label class={lbl}>Mode</label>
                <select value={mode}
                  onChange={(e) => setMode((e.target as HTMLSelectElement).value as typeof mode)}
                  class={inp}>
                  <option value="Binary">Binary (on/off)</option>
                  <option value="TimeProportional">Time-Proportional (TPO/SSR)</option>
                </select>
              </div>
            </>
          )}

          {/* IDS1 / IDS2 fields */}
          {role === 'actuator' && (actuatorType === 'IDS1' || actuatorType === 'IDS2') && (
            <div class="space-y-3">
              <div class="grid grid-cols-3 gap-2">
                {([
                  ['pin_white (Relais)', pinWhite, setPinWhite],
                  ['pin_yellow (Cmd)', pinYellow, setPinYellow],
                  ['pin_interrupt (FB)', pinInterrupt, setPinInterrupt],
                ] as const).map(([label, val, setter]) => (
                  <div key={label}>
                    <label class={lbl}>{label}</label>
                    <input type="number" value={val}
                      onInput={(e) => (setter as (v: string) => void)((e.target as HTMLInputElement).value)}
                      class={inp} />
                  </div>
                ))}
              </div>
              <p class="text-xs text-stone-400">
                Stufen: {actuatorType === 'IDS1' ? '10 (0–100 %)' : '5 (0, 20, 40, 60, 80, 100 %)'}.
                Standardpins entsprechen NodeMCU D5/D6/D7.
              </p>
            </div>
          )}
```

- [ ] **Step 6.5: Run typecheck**

```powershell
cd C:\Users\nhhop\repos\Brauerei\BrewControl\web
pnpm typecheck
```

Expected: 0 errors.

- [ ] **Step 6.6: Commit**

```bash
git add BrewControl/web/src/types.ts
git add BrewControl/web/src/components/SensorCard.tsx
git add BrewControl/web/src/components/ActuatorCard.tsx
git add BrewControl/web/src/components/AddItemModal.tsx
git commit -m "feat(BrewControl/web): fault badge on sensor/actuator cards + IDS1/IDS2 form"
```

---

## Self-Review Checklist

- [x] **Spec coverage:** Library fix ✓, fault() interface ✓, RegistrySnapshot ✓, IdsActuator ✓, platformio deps ✓, DynamicItems factory ✓, types.ts ✓, fault badges ✓, AddItemModal IDS form ✓
- [x] **No placeholders:** All steps have complete code
- [x] **Type consistency:** `IdsType::IDS1/IDS2` from IdsCooker.h used in DynamicItems and IdsActuator. `ActuatorMeta`/`ValueKind`/`Quantity` from SensActCtrl. `fault()` signature `const char*` consistent across Sensor.h, Actuator.h, IdsActuator, MockActuator, MockSensor, RegistrySnapshot, types.ts.
- [x] **IdsActuator include chain:** `SensActCtrl.h` → `#ifdef ARDUINO` → `IdsActuator.h` → `IdsCooker.h`. Native builds skip cleanly. BrewControl firmware gets IdsInductionCooker via symlink dep.
