# Multi-Channel Sensor Interface + YF-S201 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the single-value `Sensor` interface with a generic multi-channel API (`channel(idx)`), then implement `YF_S201Sensor` as the first multi-channel sensor (flow rate + volume), and wire it into the BrewControl firmware and web UI.

**Architecture:** Every `Sensor` now returns N `Channel` values (key + meta + reading). Single-channel sensors return `channelCount()=1` with `key=""`. Multi-channel sensors return composite IDs in the JSON snapshot (`"flow.rate"`, `"flow.volume"`). The web UI is unchanged — each channel appears as an independent sensor card.

**Tech Stack:** C++17 / PlatformIO native (library), ESPAsyncWebServer (firmware), Preact + TypeScript (web)

**Spec:** `docs/superpowers/specs/2026-05-21-multi-channel-sensor-yf-s201-design.md`

---

## File Map

**New files:**
- `SensActCtrl/src/core/Channel.h` — Channel struct (key + SensorMeta + Reading)
- `SensActCtrl/src/sensors/YF_S201Sensor.h` — YF-S201 header
- `SensActCtrl/src/sensors/YF_S201Sensor.cpp` — YF-S201 implementation
- `SensActCtrl/test/test_yf_s201/test_yf_s201.cpp` — 6 native tests

**Modified — library core:**
- `SensActCtrl/src/core/Sensor.h` — replace `meta()/lastReading()/read()` with `channelCount()/channel()`
- `SensActCtrl/src/core/RegistrySnapshot.cpp` — channel loop instead of single-value loop
- `SensActCtrl/src/SensActCtrl.h` — add `Channel.h` + `YF_S201Sensor.h`

**Modified — sensor/remote classes (same pattern, 7 files):**
- `SensActCtrl/src/sensors/DS18B20Sensor.{h,cpp}`
- `SensActCtrl/src/sensors/MAX31865Sensor.{h,cpp}`
- `SensActCtrl/src/sensors/BME280Sensor.{h,cpp}`
- `SensActCtrl/src/sensors/AnalogInputSensor.h` (inline)
- `SensActCtrl/src/sensors/DigitalInputSensor.{h,cpp}`
- `SensActCtrl/src/sensors/PulseCounterSensor.h` (inline)
- `SensActCtrl/src/remote/RemoteSensor.h` (inline)

**Modified — internal call sites:**
- `SensActCtrl/src/controllers/TwoPointController.cpp:14`
- `SensActCtrl/src/controllers/PIDController.cpp:240`
- `SensActCtrl/src/remote/RemotePublisher.cpp:52,60`

**Modified — tests:**
- `SensActCtrl/test/mocks/MockSensor.h`
- `SensActCtrl/test/test_registry/test_registry.cpp`
- `SensActCtrl/test/test_max31865/test_max31865.cpp`
- `SensActCtrl/test/test_analog_calibration/test_analog_calibration.cpp`
- `SensActCtrl/test/test_remote/test_remote.cpp`

**Modified — firmware:**
- `BrewControl/firmware/src/DynamicItems.h`
- `BrewControl/firmware/src/DynamicItems.cpp`
- `BrewControl/firmware/src/WebUI.cpp`

**Modified — web:**
- `BrewControl/web/src/api.ts`
- `BrewControl/web/src/components/AddItemModal.tsx`

---

## Task 1: Channel.h + new Sensor.h interface

**Files:**
- Create: `SensActCtrl/src/core/Channel.h`
- Modify: `SensActCtrl/src/core/Sensor.h`

- [ ] **Create `Channel.h`**

```cpp
// SensActCtrl/src/core/Channel.h
#pragma once
#include "Reading.h"
#include "SensorMeta.h"

namespace SensActCtrl {

// One named measurement from a Sensor. key="" means the channel's serialised
// ID equals the sensor's id(). A non-empty key like "rate" causes the
// serialiser to build the composite ID "sensorid.rate".
struct Channel {
  const char* key;
  SensorMeta  meta;
  Reading     reading;
};

}  // namespace SensActCtrl
```

- [ ] **Replace `Sensor.h`** — remove `meta()`, `lastReading()`, `read()`; add `channelCount()` and `channel()`

```cpp
// SensActCtrl/src/core/Sensor.h
#pragma once
#include "Channel.h"

namespace SensActCtrl {

// Sensor interface. tick() is called from Registry::tick() and drives any
// asynchronous read state machines.
//
// Every sensor exposes 1..N channels. Single-value sensors return
// channelCount()=1 with key="". Multi-channel sensors (YF-S201, DHT-11, …)
// return > 1 channels with short keys like "rate" / "volume".
class Sensor {
 public:
  virtual ~Sensor() = default;

  virtual const char* id()                const = 0;
  virtual size_t      channelCount()      const = 0;
  virtual Channel     channel(size_t idx) const = 0;

  virtual void begin() {}
  virtual void end()   {}
  virtual void tick()  = 0;
};

}  // namespace SensActCtrl
```

- [ ] **Commit**

```
git add SensActCtrl/src/core/Channel.h SensActCtrl/src/core/Sensor.h
git commit -m "feat(SensActCtrl): multi-channel Sensor interface — Channel struct + channelCount/channel()"
```

---

## Task 2: Adapt all single-channel sensor classes

**Files:** DS18B20, MAX31865, BME280, AnalogInput, DigitalInput, PulseCounter headers + their cpp files; RemoteSensor.h

Pattern for every class:
- Remove `SensorMeta meta() const override;` declaration
- Remove `Reading lastReading() const override { return last_; }` declaration
- Add `size_t channelCount() const override { return 1; }`
- Add `Channel channel(size_t) const override;` (or inline for simple cases)
- In the `.cpp`: replace `SensorClass::meta()` with `SensorClass::channel()`

- [ ] **DS18B20Sensor.h** — swap `meta()`/`lastReading()` for `channelCount()`/`channel()`

In `DS18B20Sensor.h`, replace:
```cpp
  SensorMeta meta() const override;
  // ...
  Reading lastReading() const override { return last_; }
```
with:
```cpp
  size_t  channelCount()      const override { return 1; }
  Channel channel(size_t)     const override;
```

- [ ] **DS18B20Sensor.cpp** — replace `meta()` with `channel()`

Replace the `DS18B20Sensor::meta()` function body (lines 59-62) with:
```cpp
Channel DS18B20Sensor::channel(size_t) const {
  return {"", SensorMeta{ValueKind::Continuous, Quantity::Temperature,
                          "\xc2\xb0""C", -55.0f, 125.0f, 0.0625f}, last_};
}
```

- [ ] **MAX31865Sensor.h** — same swap as DS18B20

Replace:
```cpp
  SensorMeta  meta()          const override;
  Reading     lastReading()   const override { return last_; }
```
with:
```cpp
  size_t  channelCount()      const override { return 1; }
  Channel channel(size_t)     const override;
```

- [ ] **MAX31865Sensor.cpp** — replace `meta()` with `channel()`

Find and replace the `MAX31865Sensor::meta()` function with:
```cpp
Channel MAX31865Sensor::channel(size_t) const {
  return {"", SensorMeta{ValueKind::Continuous, Quantity::Temperature,
                          "\xc2\xb0""C", -200.0f, 850.0f, 0.03125f}, last_};
}
```

- [ ] **BME280Sensor.h** — swap

Replace:
```cpp
  SensorMeta meta() const override;
  Reading lastReading() const override { return last_; }
```
with:
```cpp
  size_t  channelCount()      const override { return 1; }
  Channel channel(size_t)     const override;
```

- [ ] **BME280Sensor.cpp** — replace `meta()` with `channel()`

Replace the `BME280Sensor::meta()` function with:
```cpp
Channel BME280Sensor::channel(size_t) const {
  SensorMeta m{};
  switch (channel_) {
    case BME280Sensor::Channel::Temperature:
      m = SensorMeta{ValueKind::Continuous, Quantity::Temperature,
                     "\xc2\xb0""C", -40.0f, 85.0f, 0.01f};
      break;
    case BME280Sensor::Channel::Humidity:
      m = SensorMeta{ValueKind::Continuous, Quantity::Humidity,
                     "%RH", 0.0f, 100.0f, 0.01f};
      break;
    case BME280Sensor::Channel::Pressure:
      m = SensorMeta{ValueKind::Continuous, Quantity::Pressure,
                     "hPa", 300.0f, 1100.0f, 0.01f};
      break;
  }
  return {"", m, last_};
}
```

Note: `BME280Sensor::Channel` is the existing enum (Temperature/Humidity/Pressure); `SensActCtrl::Channel` is the new struct. The return type `Channel` in the out-of-line definition resolves to `SensActCtrl::Channel` (namespace scope); inside the body `BME280Sensor::Channel::Temperature` refers to the enum. No ambiguity.

- [ ] **AnalogInputSensor.h** — inline swap

Replace:
```cpp
  SensorMeta meta() const override { return meta_; }
  Reading lastReading() const override { return last_; }
```
with:
```cpp
  size_t  channelCount()      const override { return 1; }
  Channel channel(size_t)     const override { return {"", meta_, last_}; }
```

- [ ] **DigitalInputSensor.h** — swap declarations

Replace:
```cpp
  SensorMeta meta() const override;
  Reading lastReading() const override { return last_; }
```
with:
```cpp
  size_t  channelCount()      const override { return 1; }
  Channel channel(size_t)     const override;
```

- [ ] **DigitalInputSensor.cpp** — replace `meta()` with `channel()`

Replace `DigitalInputSensor::meta()` with:
```cpp
Channel DigitalInputSensor::channel(size_t) const {
  return {"", SensorMeta{ValueKind::Binary, Quantity::None, "",
                          0.0f, 1.0f, 1.0f}, last_};
}
```

- [ ] **PulseCounterSensor.h** — inline swap

Replace:
```cpp
  SensorMeta meta() const override { return meta_; }
  Reading lastReading() const override { return last_; }
```
with:
```cpp
  size_t  channelCount()      const override { return 1; }
  Channel channel(size_t)     const override { return {"", meta_, last_}; }
```

- [ ] **RemoteSensor.h** — inline swap

Replace:
```cpp
  SensorMeta meta() const override { return meta_; }
  Reading lastReading() const override { return last_; }
```
with:
```cpp
  size_t  channelCount()      const override { return 1; }
  Channel channel(size_t)     const override { return {"", meta_, last_}; }
```
Also update the comment on line 13: `"lastReading().valid stays false"` → `"channel(0).reading.valid stays false"`.

- [ ] **Commit**

```
git add SensActCtrl/src/sensors/ SensActCtrl/src/remote/RemoteSensor.h
git commit -m "refactor(SensActCtrl): adapt all single-channel sensors to channel() interface"
```

---

## Task 3: Fix internal call sites + RegistrySnapshot

**Files:**
- Modify: `SensActCtrl/src/controllers/TwoPointController.cpp`
- Modify: `SensActCtrl/src/controllers/PIDController.cpp`
- Modify: `SensActCtrl/src/remote/RemotePublisher.cpp`
- Modify: `SensActCtrl/src/core/RegistrySnapshot.cpp`

- [ ] **TwoPointController.cpp line 14** — `lastReading()` → `channel(0).reading`

```cpp
// Before:
const Reading r = sensor_->lastReading();
// After:
const Reading r = sensor_->channel(0).reading;
```

- [ ] **PIDController.cpp line 240** — same fix

```cpp
// Before:
const Reading r = sensor_->lastReading();
// After:
const Reading r = sensor_->channel(0).reading;
```

- [ ] **RemotePublisher.cpp** — fix both call sites

Line 52 (`publishSensorMeta`):
```cpp
// Before:
size_t n = remote::serializeSensorMeta(e.sensor->meta(), buf, sizeof(buf));
// After:
size_t n = remote::serializeSensorMeta(e.sensor->channel(0).meta, buf, sizeof(buf));
```

Line 60 (`publishSensorState`):
```cpp
// Before:
const Reading r = e.sensor->lastReading();
// After:
const Reading r = e.sensor->channel(0).reading;
```

- [ ] **RegistrySnapshot.cpp** — replace sensor loop with channel loop

Add `#include <cstdio>` after the existing includes.

Replace the `for (Sensor* s : reg.sensors())` block (lines 41-52) with:

```cpp
  JsonArray sensorsArr = doc["sensors"].to<JsonArray>();
  for (Sensor* s : reg.sensors()) {
    for (size_t i = 0; i < s->channelCount(); ++i) {
      const Channel ch = s->channel(i);
      char compositeId[64] = {};
      const char* entryId = s->id();
      if (ch.key[0] != '\0') {
        const size_t idLen  = strlen(s->id());
        const size_t keyLen = strlen(ch.key);
        if (idLen + 1 + keyLen < sizeof(compositeId)) {
          memcpy(compositeId, s->id(), idLen);
          compositeId[idLen] = '.';
          memcpy(compositeId + idLen + 1, ch.key, keyLen + 1);
          entryId = compositeId;
        }
      }
      JsonObject obj = sensorsArr.add<JsonObject>();
      obj["id"] = entryId;
      writeMeta(obj["meta"].to<JsonObject>(), ch.meta);
      JsonObject state = obj["state"].to<JsonObject>();
      state["v"]  = ch.reading.value;
      state["t"]  = ch.reading.timestampMs;
      state["ok"] = ch.reading.valid;
    }
  }
```

Also add `#include <cstring>` for `strlen`/`memcpy`.

- [ ] **Commit**

```
git add SensActCtrl/src/controllers/ SensActCtrl/src/remote/RemotePublisher.cpp SensActCtrl/src/core/RegistrySnapshot.cpp
git commit -m "refactor(SensActCtrl): update internal call sites and RegistrySnapshot for channel() API"
```

---

## Task 4: Fix tests + verify all 34 pass

**Files:**
- Modify: `SensActCtrl/test/mocks/MockSensor.h`
- Modify: `SensActCtrl/test/test_registry/test_registry.cpp`
- Modify: `SensActCtrl/test/test_max31865/test_max31865.cpp`
- Modify: `SensActCtrl/test/test_analog_calibration/test_analog_calibration.cpp`
- Modify: `SensActCtrl/test/test_remote/test_remote.cpp`

- [ ] **MockSensor.h** — implement new interface

Replace the entire file content:
```cpp
#pragma once
#include "core/Sensor.h"

namespace SensActCtrl {
namespace test {

// Programmable sensor for unit tests. Set value/valid directly; tick()
// stamps the current value into the channel reading and bumps tickCount.
class MockSensor : public Sensor {
 public:
  MockSensor(const char* id, SensorMeta meta) : id_(id), meta_(meta) {}

  const char* id()            const override { return id_; }
  size_t      channelCount()  const override { return 1; }
  Channel     channel(size_t) const override { return {"", meta_, last_}; }

  void tick() override {
    last_.value       = value;
    last_.valid       = valid;
    last_.timestampMs = ++timestamp_;
    ++tickCount;
  }

  float    value     = 0.0f;
  bool     valid     = true;
  uint32_t tickCount = 0;

 private:
  const char* id_;
  SensorMeta  meta_;
  Reading     last_{};
  uint32_t    timestamp_ = 0;
};

}  // namespace test
}  // namespace SensActCtrl
```

- [ ] **test_registry.cpp** — fix `meta()` and `lastReading()` calls

Lines 26-30, replace `s.meta()` → `s.channel(0).meta`:
```cpp
  TEST_ASSERT_EQUAL(ValueKind::Continuous, s.channel(0).meta.kind);
  TEST_ASSERT_EQUAL(Quantity::Temperature, s.channel(0).meta.quantity);
  TEST_ASSERT_EQUAL_STRING("\xc2\xb0""C", s.channel(0).meta.unit);
  TEST_ASSERT_FLOAT_WITHIN(0.001f, -55.0f, s.channel(0).meta.min);
  TEST_ASSERT_FLOAT_WITHIN(0.001f, 125.0f, s.channel(0).meta.max);
```

Line 71, replace `s.lastReading()` → `s.channel(0).reading`:
```cpp
  auto r = s.channel(0).reading;
```

- [ ] **test_max31865.cpp** — fix `meta()` and `lastReading()` calls

Line 13:
```cpp
  SensorMeta m = s.channel(0).meta;
```

Line 25:
```cpp
  Reading r = s.channel(0).reading;
```

- [ ] **test_analog_calibration.cpp** — fix `meta()` calls

Lines 25-26:
```cpp
  TEST_ASSERT_EQUAL_STRING("pH", a.channel(0).meta.unit);
  TEST_ASSERT_EQUAL(Quantity::pH, a.channel(0).meta.quantity);
```

- [ ] **test_remote.cpp** — fix `meta()` and `lastReading()` calls

Line 47: `remote.meta().unit` → `remote.channel(0).meta.unit`
Line 48-49: `remote.meta().quantity` → `remote.channel(0).meta.quantity`
Line 57: `remote.lastReading()` → `remote.channel(0).reading`
Line 94: `remote.meta().unit` → `remote.channel(0).meta.unit`
Line 113: `late.meta().unit` → `late.channel(0).meta.unit`
Line 114: `late.lastReading().valid` → `late.channel(0).reading.valid`
Line 115: `late.lastReading().value` → `late.channel(0).reading.value`

- [ ] **Run tests — expect 34 PASS**

```powershell
cd SensActCtrl
pio test -e native
```

Expected output ends with `34 Tests 0 Failures 0 Ignored`. If any test fails, fix before continuing.

- [ ] **Commit**

```
git add SensActCtrl/test/
git commit -m "test(SensActCtrl): update all tests to channel() API — 34 green"
```

---

## Task 5: YF_S201Sensor — failing tests + stub header

**Files:**
- Create: `SensActCtrl/src/sensors/YF_S201Sensor.h` (stub)
- Create: `SensActCtrl/test/test_yf_s201/test_yf_s201.cpp`

- [ ] **Create stub header `YF_S201Sensor.h`**

```cpp
// SensActCtrl/src/sensors/YF_S201Sensor.h
#pragma once
#include <stdint.h>
#include "core/Sensor.h"

namespace SensActCtrl {

// YF-S201 hall-effect water flow sensor.
// channel(0): FlowRate "L/min"  (key="rate")
// channel(1): Volume   "L"      (key="volume", Cumulative)
//
// Calibration: 7.5 Hz per L/min → kHzPerLiterPerMin = 7.5
// Pulses per litre: kHzPerLiterPerMin × 60 = 450
//
// ISR sharing: multiple instances on the same physical pin share one ISR
// counter via a static per-pin pool (max kMaxPins = 4 physical sensors).
class YF_S201Sensor : public Sensor {
 public:
  static constexpr float kHzPerLiterPerMin = 7.5f;
  static constexpr int   kMaxPins          = 4;

  YF_S201Sensor(const char* id, int pin);

  const char* id()                const override { return id_; }
  size_t      channelCount()      const override { return 2; }
  Channel     channel(size_t idx) const override;

  void begin() override;
  void tick()  override;

  // Override calibration (pulses/s per L/min). Default: kHzPerLiterPerMin.
  void setCalibration(float hzPerLiterPerMin);

  // Reset cumulative volume to zero.
  void resetVolume();

  // Raw ISR pulse count since begin() (or last ISR slot creation). For tests.
  uint32_t rawCount() const;

  // Simulate a hall-effect pulse without hardware. No-op on Arduino targets.
  void injectPulseForTest();

#ifndef ARDUINO
  // Reset all static ISR slots between tests.
  static void resetForTest();
#endif

 private:
  struct PinState {
    int              pin   = -1;
    volatile uint32_t count = 0;
  };
  static PinState pinStates_[kMaxPins];
  static int      pinStateCount_;

  static void isr0(); static void isr1();
  static void isr2(); static void isr3();
  static void (*isrFor(int idx))();
  static void onEdge(int pinIdx);

  const char* id_;
  int         pin_;
  int         pinIdx_         = -1;
  bool        ownsIsr_        = false;
  float       hzPerLPerMin_   = kHzPerLiterPerMin;

  uint32_t    volumeBaseCount_ = 0;
  uint32_t    lastWindowMs_    = 0;
  uint32_t    lastWindowCount_ = 0;
  static constexpr uint32_t kWindowMs = 1000;

  Reading rateReading_{};
  Reading volReading_{};
};

}  // namespace SensActCtrl
```

- [ ] **Create test file `test_yf_s201.cpp`**

```cpp
// SensActCtrl/test/test_yf_s201/test_yf_s201.cpp
#include <unity.h>
#include <ArduinoJson.h>
#include "sensors/YF_S201Sensor.h"
#include "core/Registry.h"
#include "core/RegistrySnapshot.h"

using SensActCtrl::YF_S201Sensor;
using SensActCtrl::Channel;
using SensActCtrl::Quantity;
using SensActCtrl::ValueKind;
using SensActCtrl::Registry;
using SensActCtrl::serializeRegistry;

// Inject N pulses into a sensor.
static void pulse(YF_S201Sensor& s, int n) {
  for (int i = 0; i < n; ++i) s.injectPulseForTest();
}

void test_channel_count_and_keys() {
  YF_S201Sensor s("flow", 4);
  TEST_ASSERT_EQUAL(2u, s.channelCount());
  TEST_ASSERT_EQUAL_STRING("rate",   s.channel(0).key);
  TEST_ASSERT_EQUAL_STRING("volume", s.channel(1).key);
}

void test_channel_meta() {
  YF_S201Sensor s("flow", 4);
  Channel rate = s.channel(0);
  Channel vol  = s.channel(1);

  TEST_ASSERT_EQUAL(Quantity::FlowRate,  rate.meta.quantity);
  TEST_ASSERT_EQUAL_STRING("L/min",      rate.meta.unit);
  TEST_ASSERT_EQUAL(ValueKind::Continuous, rate.meta.kind);

  TEST_ASSERT_EQUAL(Quantity::Volume,    vol.meta.quantity);
  TEST_ASSERT_EQUAL_STRING("L",          vol.meta.unit);
  TEST_ASSERT_EQUAL(ValueKind::Cumulative, vol.meta.kind);
}

void test_default_readings_invalid_before_tick() {
  YF_S201Sensor s("flow", 4);
  s.begin();
  TEST_ASSERT_FALSE(s.channel(0).reading.valid);
  TEST_ASSERT_FALSE(s.channel(1).reading.valid);
}

void test_volume_accumulates() {
  YF_S201Sensor s("flow", 4);
  s.begin();
  // 7.5 Hz/L/min × 60 s = 450 pulses per litre
  pulse(s, 450);
  s.tick();
  TEST_ASSERT_TRUE(s.channel(1).reading.valid);
  TEST_ASSERT_FLOAT_WITHIN(0.01f, 1.0f, s.channel(1).reading.value);
}

void test_reset_volume() {
  YF_S201Sensor s("flow", 4);
  s.begin();
  pulse(s, 450);
  s.tick();
  s.resetVolume();
  pulse(s, 450);
  s.tick();
  // After reset + 450 more pulses, volume must be 1 L (not 2 L).
  TEST_ASSERT_FLOAT_WITHIN(0.01f, 1.0f, s.channel(1).reading.value);
}

void test_snapshot_multi_channel_expansion() {
  YF_S201Sensor flow("flow", 4);
  flow.begin();
  pulse(flow, 450);
  flow.tick();

  Registry reg;
  reg.add(&flow);

  char buf[1024];
  size_t n = serializeRegistry(reg, buf, sizeof(buf));
  TEST_ASSERT_TRUE(n > 0);

  JsonDocument doc;
  TEST_ASSERT_FALSE(deserializeJson(doc, buf));

  JsonArray sensors = doc["sensors"].as<JsonArray>();
  TEST_ASSERT_EQUAL(2u, sensors.size());
  TEST_ASSERT_EQUAL_STRING("flow.rate",   sensors[0]["id"].as<const char*>());
  TEST_ASSERT_EQUAL_STRING("flow.volume", sensors[1]["id"].as<const char*>());
  TEST_ASSERT_EQUAL_STRING("FlowRate",    sensors[0]["meta"]["quantity"].as<const char*>());
  TEST_ASSERT_EQUAL_STRING("Volume",      sensors[1]["meta"]["quantity"].as<const char*>());
  TEST_ASSERT_FLOAT_WITHIN(0.05f, 1.0f,  sensors[1]["state"]["v"].as<float>());
}

void setUp() {
#ifndef ARDUINO
  YF_S201Sensor::resetForTest();
#endif
}
void tearDown() {}

int main(int, char**) {
  UNITY_BEGIN();
  RUN_TEST(test_channel_count_and_keys);
  RUN_TEST(test_channel_meta);
  RUN_TEST(test_default_readings_invalid_before_tick);
  RUN_TEST(test_volume_accumulates);
  RUN_TEST(test_reset_volume);
  RUN_TEST(test_snapshot_multi_channel_expansion);
  return UNITY_END();
}
```

- [ ] **Run tests — expect compile error or FAIL (no implementation yet)**

```powershell
cd SensActCtrl
pio test -e native
```

Expected: test_yf_s201 fails (linker error or assertion failures) — confirm it runs and fails before continuing.

---

## Task 6: YF_S201Sensor implementation + umbrella header

**Files:**
- Create: `SensActCtrl/src/sensors/YF_S201Sensor.cpp`
- Modify: `SensActCtrl/src/SensActCtrl.h`

- [ ] **Create `YF_S201Sensor.cpp`**

```cpp
// SensActCtrl/src/sensors/YF_S201Sensor.cpp
#include "YF_S201Sensor.h"

#if defined(ARDUINO)
  #include <Arduino.h>
#else
  #include <stdint.h>
  static void     pinMode(int, int) {}
  static int      digitalPinToInterrupt(int p) { return p; }
  static void     attachInterrupt(int, void(*)(), int) {}
  static uint32_t millis() { return 0; }
  enum { INPUT_PULLUP = 2, RISING = 1 };
#endif

namespace SensActCtrl {

// ── Static data ──────────────────────────────────────────────────────────────

YF_S201Sensor::PinState YF_S201Sensor::pinStates_[kMaxPins] = {};
int                     YF_S201Sensor::pinStateCount_        = 0;

// ── ISR trampolines (one per physical-pin slot) ──────────────────────────────

void YF_S201Sensor::isr0() { onEdge(0); }
void YF_S201Sensor::isr1() { onEdge(1); }
void YF_S201Sensor::isr2() { onEdge(2); }
void YF_S201Sensor::isr3() { onEdge(3); }

void YF_S201Sensor::onEdge(int idx) { ++pinStates_[idx].count; }

void (*YF_S201Sensor::isrFor(int idx))() {
  switch (idx) {
    case 0: return &isr0;
    case 1: return &isr1;
    case 2: return &isr2;
    case 3: return &isr3;
  }
  return nullptr;
}

// ── Constructor ──────────────────────────────────────────────────────────────

YF_S201Sensor::YF_S201Sensor(const char* id, int pin)
    : id_(id), pin_(pin) {}

// ── begin() ──────────────────────────────────────────────────────────────────

void YF_S201Sensor::begin() {
  // Reuse an existing slot if this pin is already registered.
  for (int i = 0; i < pinStateCount_; ++i) {
    if (pinStates_[i].pin == pin_) {
      pinIdx_          = i;
      ownsIsr_         = false;
      volumeBaseCount_ = pinStates_[i].count;
      lastWindowMs_    = millis();
      lastWindowCount_ = pinStates_[i].count;
      return;
    }
  }
  if (pinStateCount_ >= kMaxPins) return;  // no slot available
  pinIdx_                   = pinStateCount_++;
  pinStates_[pinIdx_].pin   = pin_;
  pinStates_[pinIdx_].count = 0;
  ownsIsr_                  = true;
  volumeBaseCount_           = 0;
  lastWindowMs_              = millis();
  lastWindowCount_           = 0;
  pinMode(pin_, INPUT_PULLUP);
  auto* isr = isrFor(pinIdx_);
  if (isr) attachInterrupt(digitalPinToInterrupt(pin_), isr, RISING);
}

// ── tick() ───────────────────────────────────────────────────────────────────

void YF_S201Sensor::tick() {
  if (pinIdx_ < 0) return;

  const uint32_t now   = millis();
  const uint32_t count = pinStates_[pinIdx_].count;

  // Rate: update once per window.
  const uint32_t elapsed = now - lastWindowMs_;
  if (elapsed >= kWindowMs) {
    const uint32_t delta = count - lastWindowCount_;
    const float hz = (elapsed > 0)
        ? static_cast<float>(delta) * 1000.0f / static_cast<float>(elapsed)
        : 0.0f;
    rateReading_.value       = hz / hzPerLPerMin_;
    rateReading_.valid       = true;
    rateReading_.timestampMs = now;
    lastWindowMs_            = now;
    lastWindowCount_         = count;
  }

  // Volume: always update (does not depend on elapsed time).
  const float pulsesPerLitre = hzPerLPerMin_ * 60.0f;
  const uint32_t accum       = count - volumeBaseCount_;
  volReading_.value          = static_cast<float>(accum) / pulsesPerLitre;
  volReading_.valid          = true;
  volReading_.timestampMs    = now;
}

// ── channel() ────────────────────────────────────────────────────────────────

Channel YF_S201Sensor::channel(size_t idx) const {
  if (idx == 0) {
    return {"rate",
            SensorMeta{ValueKind::Continuous, Quantity::FlowRate,
                       "L/min", 0.0f, 120.0f, 0.1f},
            rateReading_};
  }
  return {"volume",
          SensorMeta{ValueKind::Cumulative, Quantity::Volume,
                     "L", 0.0f, 100000.0f, 0.01f},
          volReading_};
}

// ── Helpers ──────────────────────────────────────────────────────────────────

void YF_S201Sensor::setCalibration(float hzPerLiterPerMin) {
  if (hzPerLiterPerMin > 0.0f) hzPerLPerMin_ = hzPerLiterPerMin;
}

void YF_S201Sensor::resetVolume() {
  if (pinIdx_ >= 0) volumeBaseCount_ = pinStates_[pinIdx_].count;
}

uint32_t YF_S201Sensor::rawCount() const {
  return (pinIdx_ >= 0) ? pinStates_[pinIdx_].count : 0;
}

void YF_S201Sensor::injectPulseForTest() {
  if (pinIdx_ >= 0) ++pinStates_[pinIdx_].count;
}

#ifndef ARDUINO
void YF_S201Sensor::resetForTest() {
  pinStateCount_ = 0;
  for (auto& ps : pinStates_) { ps.pin = -1; ps.count = 0; }
}
#endif

}  // namespace SensActCtrl
```

- [ ] **Update `SensActCtrl.h`** — add Channel.h and YF_S201Sensor.h

After `#include "core/Sensor.h"` add:
```cpp
#include "core/Channel.h"
```

After `#include "sensors/MAX31865Sensor.h"` add:
```cpp
#include "sensors/YF_S201Sensor.h"
```

- [ ] **Run tests — expect 40 PASS**

```powershell
cd SensActCtrl
pio test -e native
```

Expected: `40 Tests 0 Failures 0 Ignored`

- [ ] **Commit**

```
git add SensActCtrl/src/sensors/YF_S201Sensor.cpp SensActCtrl/src/SensActCtrl.h
git commit -m "feat(SensActCtrl): implement YF_S201Sensor — dual-channel flow rate + volume, 40 tests green"
```

---

## Task 7: Firmware — DynamicItems + WebUI

**Files:**
- Modify: `BrewControl/firmware/src/DynamicItems.h`
- Modify: `BrewControl/firmware/src/DynamicItems.cpp`
- Modify: `BrewControl/firmware/src/WebUI.cpp`

- [ ] **DynamicItems.h** — add `<functional>`, `resetFn` to `SensorEntry`, declare `resetSensor()`

Add `#include <functional>` to the existing includes.

Add `std::function<void()> resetFn;` as new last member of `SensorEntry`:
```cpp
  struct SensorEntry {
    std::string id;
    std::string cfgJson;
    std::unique_ptr<SensActCtrl::Sensor> ptr;
    std::function<void()> resetFn;  // non-null only for sensors that support reset
  };
```

Add public method declaration after `removeController`:
```cpp
  // Reset a sensor's accumulated state (e.g. YF_S201Sensor::resetVolume()).
  // Returns {false, reason} if sensor not found or does not support reset.
  Result resetSensor(const char* id);
```

- [ ] **DynamicItems.cpp** — add YF-S201 factory branch + `resetSensor()`

Add `#include <SensActCtrl.h>` already present — verify `YF_S201Sensor` is available (it is via the umbrella).

In `addSensorNoBegin()`, before the closing `else { return {false, "unknown sensor type"}; }`, add:

```cpp
  } else if (strcmp(type, "YF-S201") == 0) {
    int pin = cfg["pin"] | -1;
    if (pin < 0) return {false, "missing pin"};
    float cal = cfg["calibration"] | YF_S201Sensor::kHzPerLiterPerMin;
    if (cal <= 0.0f) return {false, "invalid calibration"};
    auto sensor = std::make_unique<YF_S201Sensor>(e->id.c_str(), pin);
    if (cal != YF_S201Sensor::kHzPerLiterPerMin) sensor->setCalibration(cal);
    YF_S201Sensor* rawPtr = sensor.get();
    e->ptr = std::move(sensor);
    e->resetFn = [rawPtr]() { rawPtr->resetVolume(); };
```

Add the `resetSensor()` implementation at the end of the Sensor section (after `addSensor()`):

```cpp
DynamicItems::Result DynamicItems::resetSensor(const char* id) {
  for (auto& e : sensors_) {
    if (e->id == id) {
      if (!e->resetFn) return {false, "sensor does not support reset"};
      e->resetFn();
      return {true};
    }
  }
  return {false, "sensor not found"};
}
```

- [ ] **WebUI.cpp** — add reset endpoint `POST /api/sensors/:id/reset`

Add after the existing `DELETE /api/sensors/` handler block:

```cpp
  // ── Reset sensor accumulated state (e.g. YF-S201 volume) ──────────────────
  server_.addHandler(new BodyPrefixHandler("/api/sensors/",
      [this](AsyncWebServerRequest* req, const uint8_t*, size_t) {
        const String url = req->url();
        if (!url.endsWith("/reset")) {
          req->send(405, "text/plain", "method not allowed");
          return;
        }
        // Extract id: between "/api/sensors/" and "/reset"
        String path = url.substring(strlen("/api/sensors/"));
        String id   = path.substring(0, path.length() - strlen("/reset"));
        auto r = items_.resetSensor(id.c_str());
        if (!r.ok) { req->send(400, "text/plain", r.error); return; }
        pushSnapshot_();
        req->send(204);
      }));
```

Note: `BodyPrefixHandler` is already defined at the top of `WebUI.cpp`. The POST body is `{}` (sent by `postJson`); `len=2` → the callback fires normally.

- [ ] **Compile check — all three boards**

```powershell
cd BrewControl/firmware
pio run -e esp32dev
pio run -e lolin_s2_mini
pio run -e lilygo_t_display_s3_amoled
```

Expected: `SUCCESS` for all three, no new errors.

- [ ] **Commit**

```
git add BrewControl/firmware/src/
git commit -m "feat(BrewControl/firmware): YF-S201 factory + resetSensor + /api/sensors/:id/reset"
```

---

## Task 8: Web — api.ts + AddItemModal + typecheck

**Files:**
- Modify: `BrewControl/web/src/api.ts`
- Modify: `BrewControl/web/src/components/AddItemModal.tsx`

- [ ] **api.ts** — add `resetFlowVolume`

After the `deleteSensor` function, add:

```ts
export function resetFlowVolume(id: string): Promise<void> {
  return postJson(`/api/sensors/${encodeURIComponent(id)}/reset`, {});
}
```

- [ ] **AddItemModal.tsx** — add YF-S201 sensor type

1. Extend the `SensorType` union:
```ts
type SensorType = 'DS18B20' | 'MAX31865' | 'YF-S201';
```

2. Add YF-S201 pin state variable (the existing `pin` state can be reused — YF-S201 only needs a pin).

3. Add `'YF-S201'` option in the sensor type `<optgroup>` dropdown (in the existing `<select>` for `sensorType`):
```tsx
<option value="YF-S201">YF-S201 (Durchfluss)</option>
```

4. Add the YF-S201 form block after the MAX31865 form block:

```tsx
{sensorType === 'YF-S201' && (
  <div class="space-y-3">
    <div>
      <label class="block text-xs text-zinc-400 mb-1">GPIO-Pin</label>
      <input
        type="number"
        placeholder="z.B. 4"
        value={pin}
        onInput={e => setPin((e.target as HTMLInputElement).value)}
        class="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm"
      />
    </div>
    <p class="text-xs text-zinc-500">
      Liefert zwei Kanäle: <strong>flow.rate</strong> (L/min) und{' '}
      <strong>flow.volume</strong> (L). Kalibrierung: 7,5 Hz/L·min.
    </p>
  </div>
)}
```

5. Add YF-S201 case in the submit handler (inside the `if (role === 'sensor')` block):

```tsx
} else if (sensorType === 'YF-S201') {
  const pinNum = parseInt(pin, 10);
  if (isNaN(pinNum) || pinNum < 0) { setErr('Ungültiger Pin'); setPending(false); return; }
  await createSensor({ type: 'YF-S201', id, pin: pinNum });
```

6. Add `'YF-S201'` reset in the `useEffect` cleanup (reset only the pin state, which is already reset by the existing `setPin('')` call).

- [ ] **Typecheck**

```powershell
cd BrewControl/web
pnpm typecheck
```

Expected: no errors.

- [ ] **Commit**

```
git add BrewControl/web/src/
git commit -m "feat(BrewControl/web): YF-S201 sensor form + resetFlowVolume API call"
```

---

## Self-review checklist

- [x] **Spec coverage:** Channel struct ✓, Sensor interface ✓, all 7 sensor classes ✓, RegistrySnapshot channel loop ✓, composite ID serialisation ✓, YF_S201Sensor (rate + volume + ISR sharing + resetVolume) ✓, DynamicItems factory ✓, reset endpoint ✓, web form ✓
- [x] **No placeholders:** all code blocks are complete
- [x] **Type consistency:** `Channel` used uniformly; `SensorMeta` struct shape unchanged; `Reading` struct shape unchanged; `channel(0).meta` / `channel(0).reading` consistent across tasks 3-4; `YF_S201Sensor::kHzPerLiterPerMin` referenced in both task 6 and 7
- [x] **BME280 naming:** `BME280Sensor::Channel::Temperature` enum vs `SensActCtrl::Channel` struct — addressed with explicit qualification in task 2
- [x] **Tests:** 34 existing → 40 after task 6 (6 new YF_S201 tests including multi-channel snapshot test)
