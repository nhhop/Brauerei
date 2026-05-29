# RemotePublisher Multi-Channel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish all channels of multi-channel sensors (BME280, YF_S201) over MQTT/ESP-NOW, and allow callers to override the `"sensactctrl"` topic prefix.

**Architecture:** Expand `RemotePublisher::attach(Sensor&)` into N `SensorEntry` items at attach-time (one per channel). Single-channel sensors with an empty key keep the existing flat topic schema for backward compat. Multi-channel sensors use `<prefix>/<device>/sensor/<id>/<channelKey>`. `RemoteSensor` gains an optional `channelKey` constructor param and a `setPrefix()` method to subscribe to the matching topic.

**Tech Stack:** C++17, PlatformIO native (MinGW-w64), Unity test framework. All changes are in `SensActCtrl/`. Run tests with `pio test -e native` from `SensActCtrl/`.

---

## File Map

| File | Change |
|------|--------|
| `SensActCtrl/src/remote/Topics.h` | Add optional `prefix` param to all helpers + two new channel helpers |
| `SensActCtrl/src/remote/RemotePublisher.h` | Add `channelIdx` to `SensorEntry`, add `setPrefix()`, add `prefix_` member |
| `SensActCtrl/src/remote/RemotePublisher.cpp` | Expand `attach(Sensor&)` to loop channels; fix `channel(0)` → `channel(channelIdx)`; pass prefix to topic helpers |
| `SensActCtrl/src/remote/RemoteSensor.h` | Add optional 4th ctor param `channelKey`, add `setPrefix()`, add `channelKey_`/`prefix_` members |
| `SensActCtrl/src/remote/RemoteSensor.cpp` | Move topic building from ctor to `begin()`; route based on `channelKey_` + `prefix_` |
| `SensActCtrl/test/test_remote/test_remote.cpp` | Add `MockMultiSensor` + 4 new tests |

---

## Task 1: Topics.h — prefix param + channel helpers

No new tests needed. These are pure additive changes; all existing tests must still pass afterwards.

**Files:**
- Modify: `SensActCtrl/src/remote/Topics.h`

- [ ] **Step 1: Replace Topics.h with the extended version**

Replace the entire file content:

```cpp
#pragma once

#include <string>

namespace SensActCtrl {
namespace remote {

// Topic builders for the SensActCtrl wire protocol. The prefix defaults to
// "sensactctrl" but can be overridden via RemotePublisher::setPrefix() /
// RemoteSensor::setPrefix(). All other parameters are device/kind/id.
//
// Flat schema  (single-channel, empty key):
//   <prefix>/<device>/sensor/<id>           state  (retained)
//   <prefix>/<device>/sensor/<id>/meta      meta   (retained)
//
// Channel schema (multi-channel or named-key):
//   <prefix>/<device>/sensor/<id>/<key>      channel state (retained)
//   <prefix>/<device>/sensor/<id>/<key>/meta channel meta  (retained)
//
// Actuator / Controller topics unchanged:
//   <prefix>/<device>/actuator/<id>          state  (retained)
//   <prefix>/<device>/actuator/<id>/meta     meta   (retained)
//   <prefix>/<device>/actuator/<id>/set      command
//   <prefix>/<device>/controller/<id>/meta   meta   (retained)
//   <prefix>/<device>/controller/<id>/tune   tune

inline std::string base(const char* device, const char* kind, const char* id,
                        const char* prefix = "sensactctrl") {
  return std::string(prefix) + "/" + device + "/" + kind + "/" + id;
}

inline std::string sensorState(const char* d, const char* id,
                               const char* prefix = "sensactctrl") {
  return base(d, "sensor", id, prefix);
}
inline std::string sensorMeta(const char* d, const char* id,
                              const char* prefix = "sensactctrl") {
  return sensorState(d, id, prefix) + "/meta";
}
inline std::string sensorChannelState(const char* d, const char* id, const char* key,
                                      const char* prefix = "sensactctrl") {
  return base(d, "sensor", id, prefix) + "/" + key;
}
inline std::string sensorChannelMeta(const char* d, const char* id, const char* key,
                                     const char* prefix = "sensactctrl") {
  return sensorChannelState(d, id, key, prefix) + "/meta";
}

inline std::string actuatorState(const char* d, const char* id,
                                 const char* prefix = "sensactctrl") {
  return base(d, "actuator", id, prefix);
}
inline std::string actuatorMeta(const char* d, const char* id,
                                const char* prefix = "sensactctrl") {
  return actuatorState(d, id, prefix) + "/meta";
}
inline std::string actuatorSet(const char* d, const char* id,
                               const char* prefix = "sensactctrl") {
  return actuatorState(d, id, prefix) + "/set";
}

inline std::string controllerMeta(const char* d, const char* id,
                                  const char* prefix = "sensactctrl") {
  return base(d, "controller", id, prefix) + "/meta";
}
inline std::string controllerTune(const char* d, const char* id,
                                  const char* prefix = "sensactctrl") {
  return base(d, "controller", id, prefix) + "/tune";
}

}  // namespace remote
}  // namespace SensActCtrl
```

- [ ] **Step 2: Run existing tests — all must still pass**

```powershell
cd SensActCtrl
pio test -e native
```

Expected: all existing tests pass (zero failures). If anything fails here, stop — the Topics.h change broke backward compat.

- [ ] **Step 3: Commit**

```powershell
git add SensActCtrl/src/remote/Topics.h
git commit -m "feat(remote): add prefix param + channel topic helpers to Topics.h"
```

---

## Task 2: RemotePublisher — multi-channel attach + prefix

**Files:**
- Modify: `SensActCtrl/src/remote/RemotePublisher.h`
- Modify: `SensActCtrl/src/remote/RemotePublisher.cpp`
- Modify: `SensActCtrl/test/test_remote/test_remote.cpp`

- [ ] **Step 1: Add MockMultiSensor + 3 failing tests to test_remote.cpp**

Add `MockMultiSensor` right after the closing brace of `using SensActCtrl::test::MockTransport;` block (after line 25) and before `static SensorMeta tempMeta()`:

```cpp
// Two-channel sensor for multi-channel tests. Keys "a" (Temperature) and
// "b" (Humidity). Values set via valueA / valueB before tick().
class MockMultiSensor : public SensActCtrl::Sensor {
 public:
  explicit MockMultiSensor(const char* id) : id_(id) {}
  const char* id() const override { return id_; }
  size_t channelCount() const override { return 2; }
  SensActCtrl::Channel channel(size_t idx) const override {
    static const SensActCtrl::SensorMeta metaA{
        SensActCtrl::ValueKind::Continuous, SensActCtrl::Quantity::Temperature,
        "\xc2\xb0""C", -55.0f, 125.0f, 0.01f};
    static const SensActCtrl::SensorMeta metaB{
        SensActCtrl::ValueKind::Continuous, SensActCtrl::Quantity::Humidity,
        "%", 0.0f, 100.0f, 0.01f};
    if (idx == 0) return {"a", metaA, readA_};
    return {"b", metaB, readB_};
  }
  void tick() override {
    readA_ = {valueA, ++ts_, true};
    readB_ = {valueB, ts_, true};
  }
  float valueA = 20.0f;
  float valueB = 50.0f;
 private:
  const char* id_;
  SensActCtrl::Reading readA_{};
  SensActCtrl::Reading readB_{};
  uint32_t ts_ = 0;
};
```

Then add these three tests before `void setUp()`:

```cpp
void test_multichannel_both_channels_published() {
  MockTransport tx;
  MockMultiSensor src("mc");
  RemotePublisher pub(tx, "node-m");
  pub.attach(src);
  pub.setStateIntervalMs(0);
  pub.begin();
  src.tick();
  pub.tick();

  // Both channel state topics must exist
  TEST_ASSERT_FALSE(tx.lastPayload("sensactctrl/node-m/sensor/mc/a").empty());
  TEST_ASSERT_FALSE(tx.lastPayload("sensactctrl/node-m/sensor/mc/b").empty());
  // Flat (single-channel) topic must NOT be used for multi-channel sensor
  TEST_ASSERT_TRUE(tx.lastPayload("sensactctrl/node-m/sensor/mc").empty());
  // Retained meta for both channels
  TEST_ASSERT_FALSE(tx.lastPayload("sensactctrl/node-m/sensor/mc/a/meta").empty());
  TEST_ASSERT_FALSE(tx.lastPayload("sensactctrl/node-m/sensor/mc/b/meta").empty());
}

void test_multichannel_channel_values_correct() {
  MockTransport tx;
  MockMultiSensor src("mc3");
  RemotePublisher pub(tx, "node-q");
  pub.attach(src);
  pub.setStateIntervalMs(0);
  pub.begin();
  src.valueA = 42.5f;
  src.valueB = 77.0f;
  src.tick();
  pub.tick();

  // Channel "a" payload must contain 42.5, channel "b" must contain 77
  const std::string payA = tx.lastPayload("sensactctrl/node-q/sensor/mc3/a");
  const std::string payB = tx.lastPayload("sensactctrl/node-q/sensor/mc3/b");
  TEST_ASSERT_TRUE(payA.find("42.5") != std::string::npos);
  TEST_ASSERT_TRUE(payB.find("77") != std::string::npos);
}

void test_single_channel_flat_topic_unchanged() {
  MockTransport tx;
  MockSensor src("t_flat", tempMeta());  // single-channel, empty key
  RemotePublisher pub(tx, "node-o");
  pub.attach(src);
  pub.setStateIntervalMs(0);
  pub.begin();
  src.value = 25.0f;
  src.tick();
  pub.tick();

  // Must use flat topic — no channel key suffix
  TEST_ASSERT_FALSE(tx.lastPayload("sensactctrl/node-o/sensor/t_flat").empty());
  TEST_ASSERT_FALSE(tx.lastPayload("sensactctrl/node-o/sensor/t_flat/meta").empty());
}
```

Register them in `main()`:

```cpp
RUN_TEST(test_multichannel_both_channels_published);
RUN_TEST(test_multichannel_channel_values_correct);
RUN_TEST(test_single_channel_flat_topic_unchanged);
```

- [ ] **Step 2: Run tests — expect compilation failure**

```powershell
pio test -e native
```

Expected: compilation error — `MockMultiSensor` is defined but `RemotePublisher` still hardcodes `channel(0)`. The test binary won't build yet.

- [ ] **Step 3: Update RemotePublisher.h — add channelIdx + setPrefix**

In `RemotePublisher.h`, change `SensorEntry` and add `setPrefix()` + `prefix_`:

```cpp
// --- SensorEntry struct (was 5 fields, now 6) ---
struct SensorEntry {
  Sensor*     sensor;
  size_t      channelIdx;   // which channel this entry represents
  std::string metaTopic;
  std::string stateTopic;
  uint32_t    lastPublishMs;
  bool        metaSent;
};
```

Add `setPrefix()` after `setStateIntervalMs()`:

```cpp
// Must be called before attach(). Overrides the default "sensactctrl" root.
void setPrefix(const char* p) { prefix_ = p; }
```

Add `prefix_` to the private member list after `stateIntervalMs_`:

```cpp
std::string prefix_ = "sensactctrl";
```

- [ ] **Step 4: Update RemotePublisher.cpp — expand attach + fix channel(0)**

Replace the `attach(Sensor&)` function:

```cpp
void RemotePublisher::attach(Sensor& s) {
  const size_t n = s.channelCount();
  const char*  p = prefix_.c_str();
  for (size_t i = 0; i < n; ++i) {
    const Channel ch = s.channel(i);
    SensorEntry e;
    e.sensor        = &s;
    e.channelIdx    = i;
    e.lastPublishMs = 0;
    e.metaSent      = false;
    const bool flat = (n == 1 && ch.key[0] == '\0');
    if (flat) {
      e.metaTopic  = remote::sensorMeta(deviceId_.c_str(), s.id(), p);
      e.stateTopic = remote::sensorState(deviceId_.c_str(), s.id(), p);
    } else {
      e.metaTopic  = remote::sensorChannelMeta(deviceId_.c_str(), s.id(), ch.key, p);
      e.stateTopic = remote::sensorChannelState(deviceId_.c_str(), s.id(), ch.key, p);
    }
    sensors_.push_back(std::move(e));
  }
}
```

Replace `attach(Actuator&)` to pass prefix:

```cpp
void RemotePublisher::attach(Actuator& a) {
  const char* p = prefix_.c_str();
  ActuatorEntry e;
  e.actuator   = &a;
  e.metaTopic  = remote::actuatorMeta(deviceId_.c_str(), a.id(), p);
  e.stateTopic = remote::actuatorState(deviceId_.c_str(), a.id(), p);
  e.setTopic   = remote::actuatorSet(deviceId_.c_str(), a.id(), p);
  e.lastPublishMs = 0;
  e.metaSent   = false;
  e.subscribed = false;
  actuators_.push_back(std::move(e));
}
```

Replace `attach(Controller&)` to pass prefix:

```cpp
void RemotePublisher::attach(Controller& c) {
  const char* p = prefix_.c_str();
  ControllerEntry e;
  e.controller = &c;
  e.metaTopic  = remote::controllerMeta(deviceId_.c_str(), c.id(), p);
  e.tuneTopic  = remote::controllerTune(deviceId_.c_str(), c.id(), p);
  e.metaSent   = false;
  e.subscribed = false;
  controllers_.push_back(std::move(e));
}
```

Replace `publishSensorMeta` to use `channelIdx`:

```cpp
void RemotePublisher::publishSensorMeta(SensorEntry& e) {
  char buf[192];
  size_t n = remote::serializeSensorMeta(
      e.sensor->channel(e.channelIdx).meta, buf, sizeof(buf));
  if (n == 0) return;
  if (transport_->publish(e.metaTopic.c_str(), buf, /*retained=*/true)) {
    e.metaSent = true;
  }
}
```

Replace `publishSensorState` to use `channelIdx`:

```cpp
void RemotePublisher::publishSensorState(SensorEntry& e) {
  const Reading r = e.sensor->channel(e.channelIdx).reading;
  char buf[96];
  size_t n = remote::serializeState(r.value, r.timestampMs, r.valid, buf, sizeof(buf));
  if (n == 0) return;
  transport_->publish(e.stateTopic.c_str(), buf, /*retained=*/true);
}
```

- [ ] **Step 5: Run tests — 3 new tests must pass, all existing tests must still pass**

```powershell
pio test -e native
```

Expected: all tests pass, including `test_multichannel_both_channels_published`, `test_multichannel_channel_values_correct`, `test_single_channel_flat_topic_unchanged`.

- [ ] **Step 6: Commit**

```powershell
git add SensActCtrl/src/remote/RemotePublisher.h SensActCtrl/src/remote/RemotePublisher.cpp SensActCtrl/test/test_remote/test_remote.cpp
git commit -m "feat(remote): expand RemotePublisher to publish all sensor channels"
```

---

## Task 3: RemoteSensor — channel key subscription

**Files:**
- Modify: `SensActCtrl/src/remote/RemoteSensor.h`
- Modify: `SensActCtrl/src/remote/RemoteSensor.cpp`
- Modify: `SensActCtrl/test/test_remote/test_remote.cpp`

- [ ] **Step 1: Write failing test**

Add this test before `void setUp()` in `test_remote.cpp`:

```cpp
void test_multichannel_remote_sensor_subscribes_channel() {
  MockTransport tx;
  MockMultiSensor src("mc2");
  RemotePublisher pub(tx, "node-n");
  pub.attach(src);
  pub.setStateIntervalMs(0);
  pub.begin();
  src.valueA = 42.5f;
  src.tick();
  pub.tick();

  // Late subscriber — meta + state replayed from retained cache.
  RemoteSensor remote(tx, "node-n", "mc2", "a");
  remote.begin();

  TEST_ASSERT_EQUAL_STRING("\xc2\xb0""C", remote.channel(0).meta.unit);
  TEST_ASSERT_TRUE(remote.channel(0).reading.valid);
  TEST_ASSERT_FLOAT_WITHIN(0.001f, 42.5f, remote.channel(0).reading.value);
}
```

Register it in `main()`:

```cpp
RUN_TEST(test_multichannel_remote_sensor_subscribes_channel);
```

- [ ] **Step 2: Run tests — expect compilation failure**

```powershell
pio test -e native
```

Expected: compilation error — `RemoteSensor` has no 4-argument constructor yet.

- [ ] **Step 3: Update RemoteSensor.h**

Change the constructor declaration and add `setPrefix()`, `channelKey_`, and `prefix_`:

```cpp
// Constructor — channelKey selects a named channel published by RemotePublisher.
// Leave channelKey empty ("") for single-channel (flat topic) sensors.
// Call setPrefix() before begin() if the publisher uses a custom prefix.
RemoteSensor(ITransport& transport, const char* deviceId, const char* sensorId,
             const char* channelKey = "");

void setPrefix(const char* p) { prefix_ = p; }
```

Add to the private section (after `unitStorage_`):

```cpp
std::string channelKey_;
std::string prefix_ = "sensactctrl";
```

- [ ] **Step 4: Update RemoteSensor.cpp — move topic building to begin()**

Replace the entire constructor and `begin()`:

```cpp
RemoteSensor::RemoteSensor(ITransport& transport, const char* deviceId,
                           const char* sensorId, const char* channelKey)
    : transport_(&transport),
      deviceId_(deviceId),
      sensorId_(sensorId),
      channelKey_(channelKey) {}

void RemoteSensor::begin() {
  const char* pfx = prefix_.c_str();
  const char* d   = deviceId_.c_str();
  const char* id  = sensorId_.c_str();
  if (channelKey_.empty()) {
    stateTopic_ = remote::sensorState(d, id, pfx);
    metaTopic_  = remote::sensorMeta(d, id, pfx);
  } else {
    stateTopic_ = remote::sensorChannelState(d, id, channelKey_.c_str(), pfx);
    metaTopic_  = remote::sensorChannelMeta(d, id, channelKey_.c_str(), pfx);
  }
  transport_->subscribe(metaTopic_.c_str(),
      [this](const char*, const char* p, size_t n) { onMeta(p, n); });
  transport_->subscribe(stateTopic_.c_str(),
      [this](const char*, const char* p, size_t n) { onState(p, n); });
}
```

- [ ] **Step 5: Run tests — all must pass**

```powershell
pio test -e native
```

Expected: all tests pass including `test_multichannel_remote_sensor_subscribes_channel`.

- [ ] **Step 6: Commit**

```powershell
git add SensActCtrl/src/remote/RemoteSensor.h SensActCtrl/src/remote/RemoteSensor.cpp SensActCtrl/test/test_remote/test_remote.cpp
git commit -m "feat(remote): add channelKey to RemoteSensor for multi-channel subscriptions"
```

---

## Task 4: Custom prefix round-trip test

**Files:**
- Modify: `SensActCtrl/test/test_remote/test_remote.cpp`

The `setPrefix()` method was already added to both classes in Tasks 2 and 3. This task verifies it works end-to-end.

- [ ] **Step 1: Write failing test**

Add before `void setUp()`:

```cpp
void test_custom_prefix_roundtrip() {
  MockTransport tx;
  MockSensor src("temp", tempMeta());
  RemotePublisher pub(tx, "node-p");
  pub.setPrefix("myapp");
  pub.attach(src);
  pub.setStateIntervalMs(0);
  pub.begin();
  src.value = 55.0f;
  src.tick();
  pub.tick();

  // Custom prefix must be used
  TEST_ASSERT_FALSE(tx.lastPayload("myapp/node-p/sensor/temp").empty());
  // Default prefix must NOT appear
  TEST_ASSERT_TRUE(tx.lastPayload("sensactctrl/node-p/sensor/temp").empty());

  // RemoteSensor with same prefix receives the state via retained replay.
  RemoteSensor remote(tx, "node-p", "temp");
  remote.setPrefix("myapp");
  remote.begin();
  TEST_ASSERT_TRUE(remote.channel(0).reading.valid);
  TEST_ASSERT_FLOAT_WITHIN(0.001f, 55.0f, remote.channel(0).reading.value);
}
```

Register it in `main()`:

```cpp
RUN_TEST(test_custom_prefix_roundtrip);
```

- [ ] **Step 2: Run tests — expect this one test to fail**

```powershell
pio test -e native
```

Expected: `test_custom_prefix_roundtrip` FAILS, all other tests PASS.

This test will fail because `RemotePublisher::attach()` passes prefix only if `setPrefix()` was called before `attach()`. If the implementation is correct from Task 2, this test should actually already pass — if so, skip straight to Step 3 (commit).

If it fails, the cause is likely that `setPrefix()` in `RemoteSensor` is not threaded into the topic build in `begin()`. Verify the `begin()` implementation matches Task 3, Step 4 exactly.

- [ ] **Step 3: Run final test suite — all tests must pass**

```powershell
pio test -e native
```

Expected: all tests pass (zero failures). Output ends with `OK (N tests, N assertions)`.

- [ ] **Step 4: Commit**

```powershell
git add SensActCtrl/test/test_remote/test_remote.cpp
git commit -m "test(remote): add custom prefix round-trip test"
```

---

## Task 5: Verify build for esp32dev target

Native tests run on host; also smoke-check that nothing broke for the actual firmware target.

- [ ] **Step 1: Compile for esp32dev**

```powershell
pio run -e esp32dev
```

Expected: `SUCCESS` with no errors. Warnings are acceptable.

- [ ] **Step 2: Commit if any fixes were needed**

If any `#ifdef ARDUINO` guards were missing or include paths needed adjustment, fix and commit:

```powershell
git add <changed files>
git commit -m "fix(remote): resolve esp32 compile issues after multichannel refactor"
```

---

## Done

After Task 5, the following is true:

- BME280 (3 channels: temp/hum/pres) and YF_S201 (2 channels: rate/volume) are fully published over MQTT/ESP-NOW
- Single-channel sensors (DS18B20, MAX31865, DigitalInput) use the unchanged flat topic schema
- Callers can override `"sensactctrl"` with `setPrefix()` on both publisher and subscriber
- All existing tests pass unmodified
- 4 new tests cover the new behavior
