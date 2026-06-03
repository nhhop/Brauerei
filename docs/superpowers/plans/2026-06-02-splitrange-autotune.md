# AutoTune für SplitRangePIDController — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** AutoTune auch für `SplitRangePIDController` ermöglichen, indem die AutoTunePID-Engine aus `PIDController` in eine gemeinsame `detail::PidEngine` herausgezogen und von beiden Reglern genutzt wird.

**Architecture:** `PIDController::Impl` → neue Klasse `SensActCtrl::detail::PidEngine` (AutoTunePID auf Arduino + Positional-PID-Fallback nativ). Beide Regler halten `detail::PidEngine* engine_` (forward-declariert → AutoTunePID leckt nicht in die Umbrella). `SplitRangePIDController` bekommt dieselbe AutoTune-Oberfläche wie `PIDController`; die bestehende Web-Verdrahtung (`"autotune":"start/stop"`, ControllerCard) wird wiederverwendet.

**Tech Stack:** C++17 / PlatformIO / Unity (Library), Preact + TypeScript (Web). AutoTunePID ist Arduino-only; native Tests prüfen die Verdrahtung.

**Branch:** `feat/splitrange-autotune` (bereits angelegt).

**Spec:** `docs/superpowers/specs/2026-06-02-splitrange-autotune-design.md`

---

## Task 1: `detail::PidEngine` extrahieren, `PIDController` umstellen (verhaltensneutral)

**Files:**
- Create: `SensActCtrl/src/controllers/detail/PidEngine.h`
- Create: `SensActCtrl/src/controllers/detail/PidEngine.cpp`
- Modify: `SensActCtrl/src/controllers/PIDController.h`
- Modify: `SensActCtrl/src/controllers/PIDController.cpp`
- Test (guard): `SensActCtrl/test/test_pid/test_pid.cpp` (unverändert — muss grün bleiben)

- [ ] **Step 1: `PidEngine.h` anlegen**

```cpp
#pragma once

#include <stdint.h>

#if defined(ARDUINO)
  #include <AutoTunePID.h>
#endif

namespace SensActCtrl {

enum class TuningMethod : uint8_t;  // vollständig definiert in controllers/PIDController.h

namespace detail {

// Geteilte PID-Compute- + AutoTune-Engine. Wrappt AutoTunePID auf Arduino;
// nativ Fallback auf einen kleinen Positional-PID mit gleichem Außenverhalten.
// Output wird auf [minOutput, maxOutput] (Konstruktor) geklemmt.
class PidEngine {
 public:
  PidEngine(float minOutput, float maxOutput);

  void  setSetpoint(float sp);
  void  setManualGains(float kp, float ki, float kd);
  void  enableInputFilter(float alpha);
  void  enableOutputFilter(float alpha);
  void  enableAntiWindup(bool enable, float threshold);
  void  startAutotune(TuningMethod method);
  bool  isTuneMode() const;
  float update(float input, float dtSeconds);
  void  readGains(float* kp, float* ki, float* kd, float* ku, float* tu);

 private:
#if defined(ARDUINO)
  AutoTunePID backend_;
#endif
  float minOutput_;
  float maxOutput_;
  float setpoint_ = 0.0f;
  float kp_ = 0.0f;
  float ki_ = 0.0f;
  float kd_ = 0.0f;
#if !defined(ARDUINO)
  float integral_ = 0.0f;
  float lastError_ = 0.0f;
  bool  antiWindupEnabled_ = false;
  float antiWindupThreshold_ = 0.8f;
#endif
};

}  // namespace detail
}  // namespace SensActCtrl
```

- [ ] **Step 2: `PidEngine.cpp` anlegen** (1:1 der bisherige `PIDController::Impl`)

```cpp
#include "detail/PidEngine.h"

#include "controllers/PIDController.h"  // vollständiges TuningMethod-Enum

#if defined(ARDUINO)
  #include <Arduino.h>
  #include <AutoTunePID.h>
  #define BC_USE_AUTOTUNEPID 1
#else
  #include <stdint.h>
  #define BC_USE_AUTOTUNEPID 0
#endif

namespace SensActCtrl {
namespace detail {

PidEngine::PidEngine(float minOutput, float maxOutput)
    :
#if BC_USE_AUTOTUNEPID
      backend_(minOutput, maxOutput, ::TuningMethod::ZieglerNichols),
#endif
      minOutput_(minOutput),
      maxOutput_(maxOutput) {}

void PidEngine::setSetpoint(float sp) {
  setpoint_ = sp;
#if BC_USE_AUTOTUNEPID
  backend_.setSetpoint(sp);
#endif
}

void PidEngine::setManualGains(float kp, float ki, float kd) {
  kp_ = kp; ki_ = ki; kd_ = kd;
#if BC_USE_AUTOTUNEPID
  backend_.setManualGains(kp, ki, kd);
  backend_.setOperationalMode(::OperationalMode::Normal);
#endif
}

void PidEngine::enableInputFilter(float alpha) {
#if BC_USE_AUTOTUNEPID
  backend_.enableInputFilter(alpha);
#else
  (void)alpha;
#endif
}

void PidEngine::enableOutputFilter(float alpha) {
#if BC_USE_AUTOTUNEPID
  backend_.enableOutputFilter(alpha);
#else
  (void)alpha;
#endif
}

void PidEngine::enableAntiWindup(bool enable, float threshold) {
#if BC_USE_AUTOTUNEPID
  backend_.enableAntiWindup(enable, threshold);
#else
  antiWindupEnabled_ = enable;
  antiWindupThreshold_ = threshold;
#endif
}

void PidEngine::startAutotune(TuningMethod method) {
#if BC_USE_AUTOTUNEPID
  ::TuningMethod m = ::TuningMethod::ZieglerNichols;
  switch (method) {
    case TuningMethod::ZieglerNichols: m = ::TuningMethod::ZieglerNichols; break;
    case TuningMethod::CohenCoon:      m = ::TuningMethod::CohenCoon; break;
    case TuningMethod::IMC:            m = ::TuningMethod::IMC; break;
    case TuningMethod::TyreusLuyben:   m = ::TuningMethod::TyreusLuyben; break;
    case TuningMethod::LambdaTuning:   m = ::TuningMethod::LambdaTuning; break;
  }
  backend_.setTuningMethod(m);
  backend_.setOperationalMode(::OperationalMode::Tune);
#else
  (void)method;  // nativ: no-op, AutoTune ist hardware-only
#endif
}

bool PidEngine::isTuneMode() const {
#if BC_USE_AUTOTUNEPID
  return backend_.getOperationalMode() == ::OperationalMode::Tune;
#else
  return false;
#endif
}

float PidEngine::update(float input, float dtSeconds) {
#if BC_USE_AUTOTUNEPID
  (void)dtSeconds;
  backend_.update(input);
  return backend_.getOutput();
#else
  if (dtSeconds <= 0.0f) dtSeconds = 0.1f;
  const float error = setpoint_ - input;
  const float deriv = (error - lastError_) / dtSeconds;
  float candidate = kp_ * error + ki_ * integral_ + ki_ * error * dtSeconds
                     + kd_ * deriv;
  float trial = integral_ + error * dtSeconds;
  float trialOut = kp_ * error + ki_ * trial + kd_ * deriv;
  if (trialOut > maxOutput_ && error > 0.0f) {
    // saturating high while error pushes up — hold integral
  } else if (trialOut < minOutput_ && error < 0.0f) {
    // saturating low while error pushes down — hold integral
  } else {
    integral_ = trial;
  }
  float output = kp_ * error + ki_ * integral_ + kd_ * deriv;
  if (output > maxOutput_) output = maxOutput_;
  if (output < minOutput_) output = minOutput_;
  lastError_ = error;
  (void)candidate;
  return output;
#endif
}

void PidEngine::readGains(float* kp, float* ki, float* kd, float* ku, float* tu) {
#if BC_USE_AUTOTUNEPID
  *kp = backend_.getKp();
  *ki = backend_.getKi();
  *kd = backend_.getKd();
  *ku = backend_.getKu();
  *tu = backend_.getTu();
  kp_ = *kp; ki_ = *ki; kd_ = *kd;
#else
  *kp = kp_; *ki = ki_; *kd = kd_;
  *ku = 0.0f; *tu = 0.0f;
#endif
}

}  // namespace detail
}  // namespace SensActCtrl
```

- [ ] **Step 3: `PIDController.h` auf `PidEngine` umstellen**

In `SensActCtrl/src/controllers/PIDController.h`: nach `namespace SensActCtrl {` (vor dem `enum class TuningMethod`) die Forward-Deklaration einfügen:

```cpp
namespace SensActCtrl {

namespace detail { class PidEngine; }

```

Im privaten Abschnitt die Zeile `class Impl;` **entfernen** und `Impl* impl_;` ersetzen:

```cpp
  // vorher: class Impl;   → entfernt
  // vorher: Impl* impl_;
  detail::PidEngine* engine_;
```

- [ ] **Step 4: `PIDController.cpp` auf `PidEngine` umstellen**

a) Den Kopf-Block ersetzen — AutoTunePID-Include + `BC_USE_AUTOTUNEPID` + die komplette `class PIDController::Impl { ... };` (gesamter Block „Backend implementation") **entfernen**. Stattdessen oben:

```cpp
#include "PIDController.h"

#include "detail/PidEngine.h"

#include <stdio.h>
#include <string.h>
#include <stdlib.h>
#include <math.h>

#if defined(ARDUINO)
  #include <Arduino.h>
#else
  #include <stdint.h>
  static uint32_t millis() {
    static uint32_t fake = 0;
    fake += 100;
    return fake;
  }
#endif

namespace SensActCtrl {
```

b) Konstruktor/Destruktor:

```cpp
PIDController::PIDController(const char* id, Sensor& sensor, Actuator& actuator,
                             float minOutput, float maxOutput)
    : id_(id),
      sensor_(&sensor),
      actuator_(&actuator),
      engine_(new detail::PidEngine(minOutput, maxOutput)),
      minOutput_(minOutput),
      maxOutput_(maxOutput) {}

PIDController::~PIDController() { delete engine_; }
```

c) Alle verbleibenden `impl_->` durch `engine_->` ersetzen (in `begin`, `setSetpoint`, `setTunings`, `enableInputFilter`, `enableOutputFilter`, `enableAntiWindup`, `autotune`, `stopAutotune`, `isAutotuneRunning`, `tick`, `syncFromBackend`). Es bleibt keine Referenz auf `impl_` oder `Impl` übrig.

- [ ] **Step 5: test_pid + volle Suite — müssen unverändert grün sein**

Run (PowerShell):
```powershell
$env:Path = "C:\Users\nhhop\.platformio\mingw64\bin;C:\Users\nhhop\.platformio\penv\Scripts;" + $env:Path
cd C:\Users\nhhop\repos\Brauerei\SensActCtrl
pio test -e native
```
Expected: 105/105 PASSED (unverändert — Beweis, dass die Extraktion verhaltensneutral ist).

- [ ] **Step 6: Commit**

```bash
git add SensActCtrl/src/controllers/detail/PidEngine.h SensActCtrl/src/controllers/detail/PidEngine.cpp SensActCtrl/src/controllers/PIDController.h SensActCtrl/src/controllers/PIDController.cpp
git commit -m "refactor(lib): PID-Engine in detail::PidEngine extrahieren (verhaltensneutral)"
```

---

## Task 2: `SplitRangePIDController` — Engine-Swap + AutoTune

**Files:**
- Modify: `SensActCtrl/src/controllers/SplitRangePIDController.h`
- Modify: `SensActCtrl/src/controllers/SplitRangePIDController.cpp`
- Test: `SensActCtrl/test/test_splitrange/test_splitrange.cpp`

- [ ] **Step 1: Failing-Tests ergänzen**

In `SensActCtrl/test/test_splitrange/test_splitrange.cpp` direkt **vor** `void setUp()` einfügen:

```cpp
void test_autotune_start_runs_and_enables() {
  MockSensor s("t", tempMeta());
  MockActuator h("h", pwmMeta()), cl("c", pwmMeta());
  SplitRangePIDController c("ctrl", s, &h, &cl);
  c.setEnabled(false);

  TEST_ASSERT_TRUE(c.setParamsJson("{\"autotune\":\"start\"}"));
  TEST_ASSERT_TRUE(c.enabled());

  char buf[384];
  c.paramsJson(buf, sizeof(buf));
  TEST_ASSERT_NOT_NULL(strstr(buf, "\"autotuneState\":\"running\""));
}

void test_autotune_start_with_method() {
  MockSensor s("t", tempMeta());
  MockActuator h("h", pwmMeta()), cl("c", pwmMeta());
  SplitRangePIDController c("ctrl", s, &h, &cl);

  TEST_ASSERT_TRUE(c.setParamsJson(
      "{\"autotune\":\"start\",\"autotuneMethod\":\"IMC\"}"));
  char buf[384];
  c.paramsJson(buf, sizeof(buf));
  TEST_ASSERT_NOT_NULL(strstr(buf, "\"autotuneMethod\":\"IMC\""));
  TEST_ASSERT_NOT_NULL(strstr(buf, "\"autotuneState\":\"running\""));
}

void test_autotune_stop_returns_to_idle() {
  MockSensor s("t", tempMeta());
  MockActuator h("h", pwmMeta()), cl("c", pwmMeta());
  SplitRangePIDController c("ctrl", s, &h, &cl);

  c.setParamsJson("{\"autotune\":\"start\"}");
  c.setParamsJson("{\"autotune\":\"stop\"}");
  char buf[384];
  c.paramsJson(buf, sizeof(buf));
  TEST_ASSERT_NOT_NULL(strstr(buf, "\"autotuneState\":\"idle\""));
}

void test_stop_autotune_idempotent_when_idle() {
  MockSensor s("t", tempMeta());
  MockActuator h("h", pwmMeta()), cl("c", pwmMeta());
  SplitRangePIDController c("ctrl", s, &h, &cl);
  c.stopAutotune();  // kein laufender Tune → sicherer No-Op
  char buf[384];
  c.paramsJson(buf, sizeof(buf));
  TEST_ASSERT_NOT_NULL(strstr(buf, "\"autotuneState\":\"idle\""));
}
```

In `main()` nach der letzten bestehenden `RUN_TEST`-Zeile (`test_params_json_roundtrip`) ergänzen:

```cpp
  RUN_TEST(test_autotune_start_runs_and_enables);
  RUN_TEST(test_autotune_start_with_method);
  RUN_TEST(test_autotune_stop_returns_to_idle);
  RUN_TEST(test_stop_autotune_idempotent_when_idle);
```

- [ ] **Step 2: Tests laufen — müssen fehlschlagen**

Run:
```powershell
pio test -e native -f test_splitrange
```
Expected: Kompilierfehler (`stopAutotune` etc. fehlen noch).

- [ ] **Step 3: `SplitRangePIDController.h` neu schreiben**

Datei `SensActCtrl/src/controllers/SplitRangePIDController.h` vollständig ersetzen:

```cpp
#pragma once

#include <stddef.h>
#include <stdint.h>

#include "core/Controller.h"
#include "core/Sensor.h"
#include "core/Actuator.h"
#include "controllers/PIDController.h"  // TuningMethod + detail::PidEngine forward-decl

namespace SensActCtrl {

// Split-range PID controller: one PID with a bipolar output drives a heating
// stage (positive output) and a cooling stage (negative output) from a single
// sensor. A neutral deadband around zero keeps both stages off near the
// setpoint.
//
//   out = PID(setpoint - input), clamped to [-1, +1]
//   out >  +deadband → heat = out   (cool off)
//   out <  -deadband → cool = -out  (heat off)
//   else             → both off
//
// Mutually exclusive by construction (single scalar output, deadband >= 0); a
// hard interlock in tick() is the last line of defence. Either actuator may be
// null. Optional changeover dead-time when the output flips sign (bypassed
// while AutoTune runs so the relay test isn't distorted). Fail-safe: on disable
// or invalid reading both stages are driven off.
//
// Uses the shared detail::PidEngine (AutoTunePID on hardware, positional-PID
// fallback natively), so it supports AutoTune like PIDController.
class SplitRangePIDController : public Controller {
 public:
  SplitRangePIDController(const char* id, Sensor& sensor,
                          Actuator* heat, Actuator* cool);
  ~SplitRangePIDController() override;

  SplitRangePIDController(const SplitRangePIDController&) = delete;
  SplitRangePIDController& operator=(const SplitRangePIDController&) = delete;

  const char* id() const override { return id_; }

  void begin() override;
  void tick() override;
  void setSetpoint(float sp) override;
  float setpoint() const override { return setpoint_; }

  void setTunings(float kp, float ki, float kd);
  float kp() const { return kp_; }
  float ki() const { return ki_; }
  float kd() const { return kd_; }

  // Neutral output deadband in output units (0..1), clamped to >= 0.
  void setDeadband(float d);
  float deadband() const { return deadband_; }

  // Changeover dead-time: when the output flips sign, the new stage may only
  // engage once the other has been off this long. 0 = off.
  void setChangeoverMs(uint32_t ms) { changeoverMs_ = ms; }
  uint32_t changeoverMs() const { return changeoverMs_; }

  // AutoTune (relay-feedback via the shared engine; hardware-only, no-op native).
  void autotune(TuningMethod method);
  void stopAutotune();
  bool isAutotuneRunning() const;
  bool isAutotuneDone() const;
  TuningMethod tuningMethod() const { return tuningMethod_; }

  // Last commanded outputs (0..1), for inspection / JSON.
  float heatOut() const { return heatOut_; }
  float coolOut() const { return coolOut_; }

  size_t paramsJson(char* buf, size_t bufSize) const override;
  bool setParamsJson(const char* json) override;

 private:
  void writeOff();
  void syncFromBackend();

  const char* id_;
  Sensor* sensor_;
  Actuator* heat_;
  Actuator* cool_;
  detail::PidEngine* engine_;

  float setpoint_ = 0.0f;
  float kp_ = 0.0f;
  float ki_ = 0.0f;
  float kd_ = 0.0f;
  float ku_ = 0.0f;
  float tu_ = 0.0f;
  float deadband_ = 0.0f;
  uint32_t changeoverMs_ = 0;

  TuningMethod tuningMethod_ = TuningMethod::ZieglerNichols;
  bool autotuneStarted_ = false;
  bool autotuneCompleted_ = false;

  float heatOut_ = 0.0f;
  float coolOut_ = 0.0f;

  bool started_ = false;
  uint32_t lastTickMs_ = 0;

  bool heatOn_ = false;
  bool coolOn_ = false;
  uint32_t heatOffSinceMs_ = 0;
  uint32_t coolOffSinceMs_ = 0;
  bool heatOffSeen_ = false;
  bool coolOffSeen_ = false;
};

#ifndef ARDUINO
void splitRangeSetMillisForTest(uint32_t ms);
#endif

}  // namespace SensActCtrl
```

- [ ] **Step 4: `SplitRangePIDController.cpp` neu schreiben**

Datei `SensActCtrl/src/controllers/SplitRangePIDController.cpp` vollständig ersetzen:

```cpp
#include "SplitRangePIDController.h"

#include "detail/PidEngine.h"

#include <stdio.h>
#include <string.h>
#include <stdlib.h>

#if defined(ARDUINO)
  #include <Arduino.h>
#else
  static uint32_t g_mockMillis = 0;
  static uint32_t millis() { return g_mockMillis; }
  namespace SensActCtrl {
    void splitRangeSetMillisForTest(uint32_t ms) { g_mockMillis = ms; }
  }
#endif

namespace SensActCtrl {

SplitRangePIDController::SplitRangePIDController(const char* id, Sensor& sensor,
                                                 Actuator* heat, Actuator* cool)
    : id_(id), sensor_(&sensor), heat_(heat), cool_(cool),
      engine_(new detail::PidEngine(-1.0f, 1.0f)) {}

SplitRangePIDController::~SplitRangePIDController() { delete engine_; }

void SplitRangePIDController::begin() {
  engine_->setSetpoint(setpoint_);
  engine_->setManualGains(kp_, ki_, kd_);
}

void SplitRangePIDController::setSetpoint(float sp) {
  setpoint_ = sp;
  engine_->setSetpoint(sp);
}

void SplitRangePIDController::setTunings(float kp, float ki, float kd) {
  kp_ = kp; ki_ = ki; kd_ = kd;
  engine_->setManualGains(kp, ki, kd);
}

void SplitRangePIDController::setDeadband(float d) {
  deadband_ = d < 0.0f ? 0.0f : d;
}

void SplitRangePIDController::autotune(TuningMethod method) {
  tuningMethod_ = method;
  autotuneStarted_ = true;
  autotuneCompleted_ = false;
  engine_->startAutotune(method);
}

void SplitRangePIDController::stopAutotune() {
  if (!autotuneStarted_) return;  // idempotent
  autotuneStarted_ = false;
  autotuneCompleted_ = false;
  engine_->setManualGains(kp_, ki_, kd_);  // Backend → Normal-Modus mit letzten Gains
}

bool SplitRangePIDController::isAutotuneRunning() const {
  return autotuneStarted_ && !autotuneCompleted_ && engine_->isTuneMode();
}

bool SplitRangePIDController::isAutotuneDone() const {
  return autotuneStarted_ && autotuneCompleted_;
}

void SplitRangePIDController::syncFromBackend() {
  engine_->readGains(&kp_, &ki_, &kd_, &ku_, &tu_);
}

void SplitRangePIDController::writeOff() {
  const uint32_t now = millis();
  if (heatOn_) { heatOn_ = false; heatOffSinceMs_ = now; heatOffSeen_ = true; }
  if (coolOn_) { coolOn_ = false; coolOffSinceMs_ = now; coolOffSeen_ = true; }
  heatOut_ = 0.0f;
  coolOut_ = 0.0f;
  if (heat_) heat_->write(0.0f);
  if (cool_) cool_->write(0.0f);
}

void SplitRangePIDController::tick() {
  if (!enabled()) { writeOff(); return; }

  const Reading r = sensor_->channel(0).reading;
  if (!r.valid) { writeOff(); return; }  // fail-safe: both off on dead sensor

  const uint32_t now = millis();
  const uint32_t elapsed = started_ ? (now - lastTickMs_) : 100;
  if (started_ && elapsed < 100) return;  // throttle to >= 100 ms
  started_ = true;
  lastTickMs_ = now;

  // Detect autotune completion: started + engine left Tune mode → done.
  if (autotuneStarted_ && !autotuneCompleted_ && !engine_->isTuneMode()) {
    autotuneCompleted_ = true;
    syncFromBackend();
  }
  const bool tuning = autotuneStarted_ && !autotuneCompleted_;

  const float dt = static_cast<float>(elapsed) / 1000.0f;
  const float out = engine_->update(r.value, dt);

  float heatCmd = (out >  deadband_) ? (out > 1.0f ? 1.0f : out) : 0.0f;
  float coolCmd = (out < -deadband_) ? (-out > 1.0f ? 1.0f : -out) : 0.0f;
  bool wantHeat = heatCmd > 0.0f;
  bool wantCool = coolCmd > 0.0f;

  // Changeover dead-time — skipped while tuning so the relay swing isn't distorted.
  if (changeoverMs_ && !tuning) {
    if (wantHeat && !heatOn_ &&
        (coolOn_ || (coolOffSeen_ && (now - coolOffSinceMs_) < changeoverMs_))) {
      heatCmd = 0.0f; wantHeat = false;
    }
    if (wantCool && !coolOn_ &&
        (heatOn_ || (heatOffSeen_ && (now - heatOffSinceMs_) < changeoverMs_))) {
      coolCmd = 0.0f; wantCool = false;
    }
  }

  // Hard interlock — never both on; on contradiction fail safe to off.
  if (wantHeat && wantCool) {
    heatCmd = 0.0f; coolCmd = 0.0f; wantHeat = false; wantCool = false;
  }

  if (wantHeat != heatOn_) {
    heatOn_ = wantHeat;
    if (!heatOn_) { heatOffSinceMs_ = now; heatOffSeen_ = true; }
  }
  if (wantCool != coolOn_) {
    coolOn_ = wantCool;
    if (!coolOn_) { coolOffSinceMs_ = now; coolOffSeen_ = true; }
  }

  heatOut_ = heatCmd;
  coolOut_ = coolCmd;
  if (heat_) heat_->write(heatCmd);
  if (cool_) cool_->write(coolCmd);
}

// ---------------------------------------------------------------------------
// JSON — flat {"k":v,...}, hand-rolled to stay free of ArduinoJson.
// ---------------------------------------------------------------------------

static const char* tuningMethodName(TuningMethod m) {
  switch (m) {
    case TuningMethod::ZieglerNichols: return "ZieglerNichols";
    case TuningMethod::CohenCoon:      return "CohenCoon";
    case TuningMethod::IMC:            return "IMC";
    case TuningMethod::TyreusLuyben:   return "TyreusLuyben";
    case TuningMethod::LambdaTuning:   return "LambdaTuning";
  }
  return "ZieglerNichols";
}

static bool parseTuningMethod(const char* s, size_t len, TuningMethod* out) {
  auto match = [&](const char* lit) {
    return strlen(lit) == len && strncmp(s, lit, len) == 0;
  };
  if (match("ZieglerNichols")) { *out = TuningMethod::ZieglerNichols; return true; }
  if (match("CohenCoon"))      { *out = TuningMethod::CohenCoon;      return true; }
  if (match("IMC"))            { *out = TuningMethod::IMC;            return true; }
  if (match("TyreusLuyben"))   { *out = TuningMethod::TyreusLuyben;   return true; }
  if (match("LambdaTuning"))   { *out = TuningMethod::LambdaTuning;   return true; }
  return false;
}

static bool jsonFindValue(const char* json, const char* key, const char** out) {
  const size_t klen = strlen(key);
  const char* p = json;
  while ((p = strstr(p, "\""))) {
    const char* k = p + 1;
    const char* kend = strchr(k, '"');
    if (!kend) return false;
    if (static_cast<size_t>(kend - k) == klen && memcmp(k, key, klen) == 0) {
      const char* colon = strchr(kend, ':');
      if (!colon) return false;
      const char* v = colon + 1;
      while (*v == ' ' || *v == '\t' || *v == '\n') ++v;
      *out = v;
      return true;
    }
    p = kend + 1;
  }
  return false;
}

static bool extractFloat(const char* json, const char* key, float* out) {
  const char* v = nullptr;
  if (!jsonFindValue(json, key, &v)) return false;
  *out = static_cast<float>(strtod(v, nullptr));
  return true;
}

static bool extractU32(const char* json, const char* key, uint32_t* out) {
  const char* v = nullptr;
  if (!jsonFindValue(json, key, &v)) return false;
  const double d = strtod(v, nullptr);
  *out = d < 0.0 ? 0u : static_cast<uint32_t>(d);
  return true;
}

static bool extractBool(const char* json, const char* key, bool* out) {
  const char* v = nullptr;
  if (!jsonFindValue(json, key, &v)) return false;
  if (strncmp(v, "true", 4) == 0) { *out = true; return true; }
  if (strncmp(v, "false", 5) == 0) { *out = false; return true; }
  return false;
}

static bool extractString(const char* json, const char* key,
                          const char** valOut, size_t* lenOut) {
  const char* v = nullptr;
  if (!jsonFindValue(json, key, &v)) return false;
  if (*v != '"') return false;
  const char* start = v + 1;
  const char* end = strchr(start, '"');
  if (!end) return false;
  *valOut = start;
  *lenOut = static_cast<size_t>(end - start);
  return true;
}

size_t SplitRangePIDController::paramsJson(char* buf, size_t bufSize) const {
  if (!buf || bufSize == 0) return 0;
  const char* state = autotuneCompleted_ ? "done"
                       : autotuneStarted_ ? "running" : "idle";
  const int n = snprintf(buf, bufSize,
                         "{\"setpoint\":%.4f,\"Kp\":%.4f,\"Ki\":%.4f,\"Kd\":%.4f,"
                         "\"Ku\":%.4f,\"Tu\":%.4f,\"deadband\":%.4f,"
                         "\"changeoverMs\":%u,\"sensor\":\"%s\","
                         "\"heatActuator\":\"%s\",\"coolActuator\":\"%s\","
                         "\"enabled\":%s,\"autotuneMethod\":\"%s\","
                         "\"autotuneState\":\"%s\","
                         "\"heatOut\":%.4f,\"coolOut\":%.4f}",
                         setpoint_, kp_, ki_, kd_, ku_, tu_, deadband_,
                         static_cast<unsigned>(changeoverMs_),
                         sensor_->id(),
                         heat_ ? heat_->id() : "",
                         cool_ ? cool_->id() : "",
                         enabled() ? "true" : "false",
                         tuningMethodName(tuningMethod_), state,
                         heatOut_, coolOut_);
  if (n < 0 || static_cast<size_t>(n) >= bufSize) return 0;
  return static_cast<size_t>(n);
}

bool SplitRangePIDController::setParamsJson(const char* json) {
  if (!json) return false;
  float f = 0.0f;
  if (extractFloat(json, "setpoint", &f)) setSetpoint(f);
  bool gainsChanged = false;
  float kp = kp_, ki = ki_, kd = kd_;
  if (extractFloat(json, "Kp", &f)) { kp = f; gainsChanged = true; }
  if (extractFloat(json, "Ki", &f)) { ki = f; gainsChanged = true; }
  if (extractFloat(json, "Kd", &f)) { kd = f; gainsChanged = true; }
  if (gainsChanged) setTunings(kp, ki, kd);
  if (extractFloat(json, "deadband", &f)) setDeadband(f);
  uint32_t u = 0;
  if (extractU32(json, "changeoverMs", &u)) changeoverMs_ = u;

  const char* mStr = nullptr;
  size_t mLen = 0;
  if (extractString(json, "autotuneMethod", &mStr, &mLen)) {
    TuningMethod tm;
    if (parseTuningMethod(mStr, mLen, &tm)) tuningMethod_ = tm;
  }
  bool b = true;
  if (extractBool(json, "enabled", &b)) setEnabled(b);

  const char* aStr = nullptr;
  size_t aLen = 0;
  if (extractString(json, "autotune", &aStr, &aLen)) {
    if (aLen == 5 && strncmp(aStr, "start", 5) == 0) {
      setEnabled(true);
      autotune(tuningMethod_);
    } else if (aLen == 4 && strncmp(aStr, "stop", 4) == 0) {
      stopAutotune();
    }
  }
  return true;
}

}  // namespace SensActCtrl
```

- [ ] **Step 5: test_splitrange + volle Suite — müssen grün sein**

Run:
```powershell
pio test -e native -f test_splitrange
pio test -e native
```
Expected: test_splitrange 13/13; volle Suite 109/109 (105 + 4 neu). Die bestehenden 9 SplitRange-Verhaltenstests bleiben grün → Engine-Swap verhaltensneutral.

- [ ] **Step 6: Commit**

```bash
git add SensActCtrl/src/controllers/SplitRangePIDController.h SensActCtrl/src/controllers/SplitRangePIDController.cpp SensActCtrl/test/test_splitrange/test_splitrange.cpp
git commit -m "feat(lib): AutoTune für SplitRangePIDController über geteilte PidEngine"
```

---

## Task 3: Frontend — AutoTune-Block auch für SplitRangePID

**Files:**
- Modify: `BrewControl/web/src/components/ControllerCard.tsx`

- [ ] **Step 1: PID-Erkennung erweitern**

In `BrewControl/web/src/components/ControllerCard.tsx` die Zeile

```tsx
  const isPid = params?.Kp != null && params?.heatActuator == null;
```

ersetzen durch (AutoTune-fähig = hat Kp; TwoPoint/DualStage haben keins):

```tsx
  const isPid = params?.Kp != null;
```

- [ ] **Step 2: Typecheck**

Run (PowerShell):
```powershell
cd C:\Users\nhhop\repos\Brauerei\BrewControl\web
pnpm exec tsc --noEmit
```
Expected: EXIT 0, keine Diagnostics.

- [ ] **Step 3: Commit**

```bash
git add BrewControl/web/src/components/ControllerCard.tsx
git commit -m "feat(web): AutoTune-Block auch für SplitRangePID-Regler anzeigen"
```

---

## Task 4: Firmware-Compile-Smoke + Doku

**Files:**
- Modify: `PLAN.md`
- Modify: `SESSION.md`

- [ ] **Step 1: Firmware kompilieren**

Run (PowerShell):
```powershell
$env:Path = "C:\Users\nhhop\.platformio\penv\Scripts;" + $env:Path
cd C:\Users\nhhop\repos\Brauerei\BrewControl\firmware
pio run -e esp32dev
```
Expected: `[SUCCESS]`. (Verifiziert, dass die Library-Refaktorierung auf dem ESP32-Target baut.)

- [ ] **Step 2: PLAN.md aktualisieren**

In `PLAN.md`, im Abschnitt „### SensActCtrl", den Dual-Output-Regler-Eintrag um einen Satz ergänzen (am Ende des Bullets anhängen):

```markdown
 PID-Engine in `detail::PidEngine` extrahiert (von `PIDController` + `SplitRangePIDController` geteilt); **SplitRangePID unterstützt jetzt AutoTune** (Relay über die geteilte Engine, Umschalt-Totzeit während des Tunes pausiert).
```

In `PLAN.md`, im Abschnitt „### BrewControl", den PID-AutoTune-Eintrag um einen Satz ergänzen:

```markdown
 Seit 2026-06-02 auch für `SplitRangePID`-Regler (geteilte `PidEngine`); ControllerCard zeigt den AutoTune-Block für alle PID-Familien-Regler (`params.Kp != null`).
```

- [ ] **Step 3: SESSION.md aktualisieren**

In `SESSION.md` ans Ende anhängen:

```markdown

---

## 2026-06-02 — AutoTune für SplitRangePID (geteilte PidEngine)

**Ausgangslage:** `PIDController` konnte AutoTune (AutoTunePID-Backend via privater `Impl`),
`SplitRangePIDController` hatte einen selbst-geschriebenen PID ohne AutoTune.

**Library:** `PIDController::Impl` → `SensActCtrl::detail::PidEngine` (`src/controllers/detail/`)
extrahiert (AutoTunePID auf Arduino + Positional-PID-Fallback nativ). Beide Regler halten
`detail::PidEngine* engine_` (forward-declariert → AutoTunePID leckt nicht in die Umbrella).
`SplitRangePIDController` nutzt die Engine mit Range [−1,+1] und bekommt dieselbe AutoTune-
Oberfläche (`autotune`/`stopAutotune`/Abschlusserkennung/`syncFromBackend`, `Ku`/`Tu`/
`autotuneMethod`/`autotuneState` im JSON, `"autotune":"start/stop"`-Trigger). Während des Tunes
wird die Umschalt-Totzeit übersprungen (Relay-Schwingung). 4 neue native Tests (105 → 109);
bestehende test_pid (9) + test_splitrange (9) unverändert grün (verhaltensneutral).

**Firmware:** keine Änderung — Trigger über die bestehende params-Route.

**Frontend:** ControllerCard-Bedingung `params.Kp != null && params.heatActuator == null` →
`params.Kp != null` (AutoTune-Block für PID *und* SplitRangePID).

**Randbedingung:** Relay-Autotune liefert einen Kompromiss-Gain-Satz über die gemischte
Heiz/Kühl-Strecke (kein getrenntes Tuning pro Richtung). `DualStage` (bang-bang) bleibt außen vor.

Spec: `docs/superpowers/specs/2026-06-02-splitrange-autotune-design.md`,
Plan: `docs/superpowers/plans/2026-06-02-splitrange-autotune.md`.

### Verifikation
| Check | Resultat |
|---|---|
| `pio test -e native` (SensActCtrl) | 109/109 |
| `pio run -e esp32dev` (Firmware) | SUCCESS |
| `pnpm typecheck` (BrewControl/web) | 0 Fehler |

**Offen:** E2E am echten SplitRangePID (idle→running→done, übernommene Gains, Abbruch) — in PLAN.md unter Hardware-Verifikation.
```

- [ ] **Step 4: Commit**

```bash
git add PLAN.md SESSION.md
git commit -m "docs: AutoTune für SplitRangePID — PLAN + SESSION"
```

---

## Verifikation (gesamt)

- `pio test -e native` (SensActCtrl): 109/109 (101 alt + 4 PID-Autotune + 4 SplitRange-Autotune; davon test_pid 9 + test_splitrange 13).
- `pio run -e esp32dev` (Firmware): SUCCESS.
- `pnpm exec tsc --noEmit` (Web): 0 Fehler.
- Manuell/Hardware (separater offener Punkt): SplitRangePID an echter Heiz/Kühl-Strecke autotunen → idle→running→done, übernommene Gains plausibel, Abbruch.
