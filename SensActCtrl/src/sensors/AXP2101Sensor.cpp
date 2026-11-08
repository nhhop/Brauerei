#include "AXP2101Sensor.h"

#if defined(ARDUINO)
  #include <Arduino.h>
  #include <Wire.h>
  #include <pmic/xpowers/axp2101/PmicAXP2101.hpp>
#else
  // Native build: the chip itself is played by PmuSensor's stub.
  class PmicAXP2101 {};
#endif

namespace SensActCtrl {

namespace {
const SensorMeta kSocMeta{ValueKind::Continuous, Quantity::Custom, "%",
                          0.0f, 100.0f, 1.0f};
}  // namespace

AXP2101Sensor::AXP2101Sensor(const char* id, uint8_t i2cAddress)
    : PmuSensor(id, nullptr, i2cAddress) {}

AXP2101Sensor::AXP2101Sensor(const char* id, TwoWire& bus, uint8_t i2cAddress)
    : PmuSensor(id, &bus, i2cAddress) {}

AXP2101Sensor::~AXP2101Sensor() { delete dev_; }

const SensorMeta& AXP2101Sensor::extraMeta() const { return kSocMeta; }

bool AXP2101Sensor::connectDevice() {
#if defined(ARDUINO)
  // A fresh driver per attempt, as in QMI8658Sensor. No SDA/SCL: the bus is
  // already running.
  delete dev_;
  dev_ = new PmicAXP2101();
  if (!dev_->begin(wire(), address())) return false;
  using Ch = PmicAdcBase::Channel;
  // The ADC channels convert continuously once enabled; the fuel gauge is a
  // module of its own.
  return dev_->adc().enableChannels(Ch::BAT_VOLTAGE | Ch::VBUS_VOLTAGE) &&
         dev_->enableModule(PmicAXP2101::Module::GAUGE, true);
#else
  return stubConnect();
#endif
}

bool AXP2101Sensor::readDevice(Sample& s) {
#if defined(ARDUINO)
  using Ch = PmicAdcBase::Channel;
  float vbat, vbus, soc;
  if (!dev_->adc().read(Ch::BAT_VOLTAGE, vbat) ||
      !dev_->adc().read(Ch::VBUS_VOLTAGE, vbus) ||
      !dev_->adc().read(Ch::BAT_PERCENTAGE, soc)) return false;
  const PmicChargerBase::Status st = dev_->charger().getStatus();
  s.batteryPresent = st.batteryPresent;
  s.vbatV    = vbat / 1000.0f;
  s.vbusV    = vbus / 1000.0f;
  s.extra    = st.batteryPresent ? soc : NAN;
  s.charging = st.charging;
  return true;
#else
  return stubRead(s);
#endif
}

}  // namespace SensActCtrl
