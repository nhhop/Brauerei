#include "SY6970Sensor.h"

#if defined(ARDUINO)
  #include <Arduino.h>
  #include <Wire.h>
  #include <pmic/silergy/sy6970/PmicSY6970.hpp>
#else
  // Native build: the chip itself is played by PmuSensor's stub.
  class PmicSY6970 {};
#endif

namespace SensActCtrl {

namespace {
const SensorMeta kChargeCurrentMeta{ValueKind::Continuous, Quantity::Current, "A",
                                    0.0f, 5.0f, 0.05f};
}  // namespace

SY6970Sensor::SY6970Sensor(const char* id, uint8_t i2cAddress)
    : PmuSensor(id, nullptr, i2cAddress) {}

SY6970Sensor::SY6970Sensor(const char* id, TwoWire& bus, uint8_t i2cAddress)
    : PmuSensor(id, &bus, i2cAddress) {}

SY6970Sensor::~SY6970Sensor() { delete dev_; }

const SensorMeta& SY6970Sensor::extraMeta() const { return kChargeCurrentMeta; }

bool SY6970Sensor::connectDevice() {
#if defined(ARDUINO)
  // A fresh driver per attempt, as in QMI8658Sensor. No SDA/SCL: the bus is
  // already running.
  delete dev_;
  dev_ = new PmicSY6970();
  if (!dev_->begin(wire(), address())) return false;
  // One-shot conversions are started by read() without waiting for them, so
  // every read would return the previous (after the reset: zero) result.
  return dev_->adc().setContinuousMode(true);
#else
  return stubConnect();
#endif
}

bool SY6970Sensor::readDevice(Sample& s) {
#if defined(ARDUINO)
  using Ch = PmicAdcBase::Channel;
  float vbat, vbus, ichg;
  if (!dev_->adc().read(Ch::BAT_VOLTAGE, vbat) ||
      !dev_->adc().read(Ch::VBUS_VOLTAGE, vbus) ||
      !dev_->adc().read(Ch::BAT_CURRENT, ichg)) return false;
  // Not isCharging(): that is also true once the cell is full.
  using St = PmicChargerBase::ChargingStatus;
  const St state = dev_->charger().getStatus().chargingStatus;
  s.vbatV    = vbat / 1000.0f;
  s.vbusV    = vbus / 1000.0f;
  s.extra    = ichg / 1000.0f;
  s.charging = state == St::PRE_CHARGE || state == St::FAST_CHARGE;
  return true;
#else
  return stubRead(s);
#endif
}

}  // namespace SensActCtrl
