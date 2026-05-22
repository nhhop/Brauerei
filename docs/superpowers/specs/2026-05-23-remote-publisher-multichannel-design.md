# RemotePublisher Multi-Channel — Design Spec

**Date:** 2026-05-23  
**Status:** Approved  
**Scope:** `SensActCtrl/src/remote/` + `SensActCtrl/test/test_remote/`

---

## Problem

`RemotePublisher` currently hardcodes `channel(0)` for both meta and state publishes
(RemotePublisher.cpp:52, :60). Sensors with multiple channels — BME280 (temp/hum/pres),
YF_S201 (rate/volume) — therefore only publish their first channel over MQTT/ESP-NOW.

`RemoteSensor` hardcodes `channelCount() = 1` and subscribes to the flat
`sensactctrl/<device>/sensor/<id>` topic, which means there is no way for a consumer
to receive channels beyond the first.

---

## Approach: SensorEntry-per-channel expansion (Approach A)

At `attach(Sensor&)` time, expand the sensor into N `SensorEntry` items — one per
channel. Each entry carries its own pre-built topics. The hot path (`tick()`) is
unchanged; it still iterates `sensors_` and calls `publishSensorMeta/State`.

### Backward compatibility rule

Single-channel sensors with an empty channel key (`channelCount() == 1 && key == ""`)
keep the existing flat topic schema:

```
sensactctrl/<device>/sensor/<id>        ← state
sensactctrl/<device>/sensor/<id>/meta   ← retained meta
```

Multi-channel sensors, or single-channel sensors with a named key, use a per-channel
schema:

```
sensactctrl/<device>/sensor/<id>/<channelKey>        ← state
sensactctrl/<device>/sensor/<id>/<channelKey>/meta   ← retained meta
```

Examples:
- DS18B20 `"mash_temp"`, channel key `""` → existing schema, no change
- BME280 `"ambient"`, channel key `"temp"` → `…/sensor/ambient/temp`
- YF_S201 `"wort_flow"`, channel key `"rate"` → `…/sensor/wort_flow/rate`

---

## Changes

### 1. `Topics.h` — two new helpers

```cpp
inline std::string sensorChannelState(const char* d, const char* id, const char* key) {
    return base(d, "sensor", id) + "/" + key;
}
inline std::string sensorChannelMeta(const char* d, const char* id, const char* key) {
    return sensorChannelState(d, id, key) + "/meta";
}
```

The existing `sensorState` / `sensorMeta` helpers stay untouched.

### 2. `RemotePublisher.h` — add `channelIdx` to `SensorEntry`

```cpp
struct SensorEntry {
    Sensor*     sensor;
    size_t      channelIdx;   // ← new
    std::string metaTopic;
    std::string stateTopic;
    uint32_t    lastPublishMs;
    bool        metaSent;
};
```

### 3. `RemotePublisher.cpp` — expand `attach(Sensor&)` + fix `channel(0)` reads

`attach` loops over all channels and pushes one entry per channel:

```cpp
void RemotePublisher::attach(Sensor& s) {
    const size_t n = s.channelCount();
    for (size_t i = 0; i < n; ++i) {
        const Channel ch = s.channel(i);
        SensorEntry e;
        e.sensor       = &s;
        e.channelIdx   = i;
        e.lastPublishMs = 0;
        e.metaSent     = false;
        const bool flat = (n == 1 && ch.key[0] == '\0');
        if (flat) {
            e.metaTopic  = remote::sensorMeta(deviceId_.c_str(), s.id());
            e.stateTopic = remote::sensorState(deviceId_.c_str(), s.id());
        } else {
            e.metaTopic  = remote::sensorChannelMeta(deviceId_.c_str(), s.id(), ch.key);
            e.stateTopic = remote::sensorChannelState(deviceId_.c_str(), s.id(), ch.key);
        }
        sensors_.push_back(std::move(e));
    }
}
```

`publishSensorMeta` and `publishSensorState` use `e.sensor->channel(e.channelIdx)`
instead of `channel(0)`:

```cpp
void RemotePublisher::publishSensorMeta(SensorEntry& e) {
    char buf[192];
    size_t n = remote::serializeSensorMeta(
        e.sensor->channel(e.channelIdx).meta, buf, sizeof(buf));
    ...
}

void RemotePublisher::publishSensorState(SensorEntry& e) {
    const Reading r = e.sensor->channel(e.channelIdx).reading;
    ...
}
```

### 4. `RemoteSensor.h/.cpp` — optional `channelKey` constructor parameter

```cpp
RemoteSensor(ITransport& transport, const char* deviceId,
             const char* sensorId, const char* channelKey = "");
```

If `channelKey` is empty (`""`): existing flat topic schema → all 5 existing tests
pass unmodified.

If non-empty: subscribe to `sensactctrl/<device>/sensor/<id>/<channelKey>` and
`…/<channelKey>/meta` instead.

The `channelKey` is stored in a `std::string channelKey_` member. `stateTopic_`
and `metaTopic_` are built in the constructor (or `begin()`) based on that value.

Consumer usage:

```cpp
RemoteSensor flowRate(t, "brew", "flow", "rate");    // YF_S201 rate channel
RemoteSensor flowVol (t, "brew", "flow", "volume");  // YF_S201 volume channel
RemoteSensor ambTemp (t, "brew", "ambient", "temp"); // BME280 temp channel
```

---

## Test plan

Three new tests in `test_remote.cpp`; inline `MockMultiSensor` (two channels,
keys `"a"` and `"b"`).

| Test | What it verifies |
|------|-----------------|
| `test_multichannel_both_channels_published` | Attach a 2-channel sensor; after `pub.begin()` + `pub.tick()`, transport has messages on `…/sensor/mc/a` and `…/sensor/mc/b` — not just `/mc`. Meta retained messages on `…/a/meta` and `…/b/meta`. |
| `test_multichannel_remote_sensor_subscribes_channel` | `RemoteSensor` with key `"a"` receives state from `…/sensor/mc/a`, not from the flat `…/sensor/mc` topic. |
| `test_single_channel_flat_topic_unchanged` | Single-channel, empty-key sensor still publishes to flat `…/sensor/<id>` — existing schema. Verifies backward compat at unit-test level. |

Existing 5 tests must pass without modification (they all use single-channel
`MockSensor` with empty key → flat topic → unchanged code path).

---

## ESP-NOW considerations

ESP-NOW has a hard 250-byte packet limit. Approach A sends one packet per channel,
keeping each packet small:

- State packet: `2 bytes overhead + ~40 bytes topic + ~30 bytes JSON ≈ 72 bytes`
- Well within the 250-byte limit even for the longest topic:
  `sensactctrl/brew/sensor/ambient/pres` = 36 chars → 2 + 36 + 30 = 68 bytes

No composite JSON (which would have exceeded the limit for 3-channel sensors) is needed.

---

## Out of scope

- Multi-channel actuators (none exist yet)
- Multi-channel `RemoteActuator` subscription
- `RemotePublisher` multi-channel for controllers
- MQTT wildcard subscriptions (`…/sensor/<id>/#`)

---

## Files to touch

| File | Change |
|------|--------|
| `SensActCtrl/src/remote/Topics.h` | +2 helpers |
| `SensActCtrl/src/remote/RemotePublisher.h` | +`channelIdx` field in `SensorEntry` |
| `SensActCtrl/src/remote/RemotePublisher.cpp` | expand `attach(Sensor&)`, fix `channel(0)` |
| `SensActCtrl/src/remote/RemoteSensor.h` | +`channelKey` ctor param + member |
| `SensActCtrl/src/remote/RemoteSensor.cpp` | topic routing based on `channelKey_` |
| `SensActCtrl/test/test_remote/test_remote.cpp` | +`MockMultiSensor` + 3 new tests |
