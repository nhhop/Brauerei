#include "PmuSensor.h"

#if defined(ARDUINO)
  #include <Arduino.h>
  #include <Wire.h>
#else
  // Native build stub: PMUs are hardware-only. The globals let tests play
  // "chip answers / gone", advance the clock and set what the chip reports
  // (default: charged cell, no USB, not charging, no extra value).
  namespace SensActCtrlTest {
  bool     pmuPresent  = true;
  uint32_t pmuNowMs    = 0;
  float    pmuVbatV    = 4.1f;
  float    pmuVbusV    = 0.0f;
  bool     pmuCharging = false;
  bool     pmuBattery  = true;
  float    pmuExtra    = NAN;
  }
  static uint32_t millis() { return SensActCtrlTest::pmuNowMs; }
#endif

namespace SensActCtrl {

namespace {
const SensorMeta kVoltMeta{ValueKind::Continuous, Quantity::Voltage, "V",
                           0.0f, 20.0f, 0.001f};
const SensorMeta kChargingMeta{ValueKind::Binary, Quantity::None, "",
                               0.0f, 1.0f, 1.0f};
}  // namespace

#if defined(ARDUINO)
TwoWire& PmuSensor::wire() const { return bus_ ? *bus_ : Wire; }

bool PmuSensor::devicePresent() const {
  TwoWire& w = wire();
  w.beginTransmission(address_);
  return w.endTransmission() == 0;
}
#else
bool PmuSensor::devicePresent() const { return SensActCtrlTest::pmuPresent; }

bool PmuSensor::stubConnect() { return SensActCtrlTest::pmuPresent; }

bool PmuSensor::stubRead(Sample& s) {
  s.vbatV          = SensActCtrlTest::pmuVbatV;
  s.vbusV          = SensActCtrlTest::pmuVbusV;
  s.charging       = SensActCtrlTest::pmuCharging;
  s.batteryPresent = SensActCtrlTest::pmuBattery;
  s.extra          = SensActCtrlTest::pmuExtra;
  return true;
}
#endif

bool PmuSensor::connect() {
  nextRetryMs_ = millis() + kRetryIntervalMs;
  initialized_ = connectDevice();
  readOnce_    = false;
  return initialized_;
}

void PmuSensor::invalidate() {
  vbat_ = vbus_ = charging_ = extra_ = Reading{};
}

void PmuSensor::begin() {
  if (begun_) return;
  begun_ = true;
  connect();
}

Channel PmuSensor::channel(size_t idx) const {
  switch (idx) {
    case 0:  return {"vbat", kVoltMeta, vbat_};
    case 1:  return {"vbus", kVoltMeta, vbus_};
    case 2:  return {"charging", kChargingMeta, charging_};
    default: return {extraKey(), extraMeta(), extra_};
  }
}

void PmuSensor::tick() {
  if (!begun_) return;

  const uint32_t now = millis();
  if (!initialized_) {
    if (static_cast<int32_t>(now - nextRetryMs_) < 0) return;
    if (!connect()) return;
  } else if (readOnce_ && now - lastReadMs_ < kReadIntervalMs) {
    return;
  } else if (!devicePresent()) {
    initialized_ = false;
    nextRetryMs_ = now + kRetryIntervalMs;
    invalidate();
    return;
  }
  readOnce_   = true;
  lastReadMs_ = now;

  Sample s;
  if (!readDevice(s)) {
    invalidate();
    return;
  }
  // Without a cell the chips report 0 V (or the charge voltage): no value.
  const bool bat = s.batteryPresent && s.vbatV > 0.0f;
  vbat_     = Reading{s.vbatV, now, bat && s.vbatV == s.vbatV};
  vbus_     = Reading{s.vbusV, now, s.vbusV == s.vbusV};
  charging_ = Reading{s.charging ? 1.0f : 0.0f, now, true};
  extra_    = Reading{s.extra, now, s.extra == s.extra};
}

}  // namespace SensActCtrl
