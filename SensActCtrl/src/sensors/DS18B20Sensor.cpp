#include "DS18B20Sensor.h"

#include <string.h>

#if defined(ARDUINO)
  #include <Arduino.h>
  #include <OneWire.h>
  #include <DallasTemperature.h>
#else
  // Native build: provide just enough shims for compilation. DS18B20 is
  // hardware-only — there's no unit test for it.
  #include <stdint.h>
  #define DEVICE_DISCONNECTED_C (-127.0f)
  static uint32_t millis() { return 0; }
  class OneWire { public: OneWire() {} explicit OneWire(int) {} };
  class DallasTemperature {
   public:
    explicit DallasTemperature(OneWire*) {}
    void begin() {}
    void setResolution(uint8_t) {}
    void setResolution(const uint8_t*, uint8_t) {}
    void setWaitForConversion(bool) {}
    void requestTemperatures() {}
    void requestTemperaturesByAddress(const uint8_t*) {}
    float getTempC(const uint8_t*) { return 25.0f; }
    float getTempCByIndex(int) { return 25.0f; }
  };
#endif

namespace SensActCtrl {

static uint32_t conversionMsFor(uint8_t bits) {
  // Datasheet: 12-bit ≈ 750 ms, halves per dropped bit.
  if (bits >= 12) return 750;
  if (bits == 11) return 375;
  if (bits == 10) return 188;
  return 94;  // 9-bit
}

DS18B20Sensor::DS18B20Sensor(const char* id, int pin, uint8_t resolutionBits)
    : id_(id), pin_(pin), resolutionBits_(resolutionBits),
      ownsBus_(true),
      conversionTimeMs_(conversionMsFor(resolutionBits)) {}

DS18B20Sensor::DS18B20Sensor(const char* id, OneWire& bus,
                             const uint8_t address[8], uint8_t resolutionBits)
    : id_(id), resolutionBits_(resolutionBits),
      ownsBus_(false), bus_(&bus),
      conversionTimeMs_(conversionMsFor(resolutionBits)) {
  memcpy(address_, address, 8);
  hasAddress_ = true;
}

DS18B20Sensor::~DS18B20Sensor() {
  delete dallas_;
  if (ownsBus_) delete bus_;
}

Channel DS18B20Sensor::channel(size_t) const {
  return {"", SensorMeta{ValueKind::Continuous, Quantity::Temperature,
                          "\xc2\xb0""C", -55.0f, 125.0f, 0.0625f}, last_};
}

void DS18B20Sensor::begin() {
  if (ownsBus_ && !bus_) bus_ = new OneWire(pin_);
  dallas_ = new DallasTemperature(bus_);
  dallas_->begin();
  if (hasAddress_) {
    dallas_->setResolution(address_, resolutionBits_);
  } else {
    dallas_->setResolution(resolutionBits_);
  }
  dallas_->setWaitForConversion(false);  // async mode
}

void DS18B20Sensor::tick() {
  const uint32_t now = millis();
  switch (state_) {
    case State::Idle:
      if (hasAddress_) {
        dallas_->requestTemperaturesByAddress(address_);
      } else {
        dallas_->requestTemperatures();
      }
      requestStartMs_ = now;
      state_ = State::Converting;
      break;
    case State::Converting:
      if (now - requestStartMs_ >= conversionTimeMs_) {
        const float t = hasAddress_ ? dallas_->getTempC(address_)
                                     : dallas_->getTempCByIndex(0);
        last_.value = t;
        last_.valid = (t != DEVICE_DISCONNECTED_C);
        last_.timestampMs = now;
        state_ = State::Idle;
      }
      break;
  }
}

uint8_t DS18B20Sensor::scanBus(OneWire& bus, uint8_t out[][8], uint8_t maxDevices) {
#if defined(ARDUINO)
  DallasTemperature dt(&bus);
  dt.begin();
  uint8_t n = dt.getDeviceCount();
  if (n > maxDevices) n = maxDevices;
  for (uint8_t i = 0; i < n; ++i) dt.getAddress(out[i], i);
  return n;
#else
  (void)bus; (void)out; (void)maxDevices;
  return 0;
#endif
}

uint8_t DS18B20Sensor::scanBus(int pin, uint8_t out[][8], uint8_t maxDevices) {
#if defined(ARDUINO)
  OneWire ow(pin);
  return scanBus(ow, out, maxDevices);
#else
  (void)pin; (void)out; (void)maxDevices;
  return 0;
#endif
}

}  // namespace SensActCtrl
