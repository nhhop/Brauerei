#pragma once

#include <stdint.h>

#include "core/Sensor.h"

// Forward decls so this header doesn't pull OneWire/DallasTemperature into
// the umbrella include for sketches that don't use it.
class OneWire;
class DallasTemperature;

namespace SensActCtrl {

// DS18B20 1-wire thermometer.
//
// Asynchronous read: tick() drives a state machine:
//   IDLE → request temperature (non-blocking) → CONVERTING → READY
// After requesting, the sensor needs ~750 ms at 12-bit resolution before
// the result is available. tick() polls millis() and pulls the result when
// the conversion is due — never blocks the loop.
//
// Multiple devices on a shared bus are supported via 64-bit ROM addressing
// — pass the address; otherwise the sensor is the only one on its bus
// (constructor without address).
class DS18B20Sensor : public Sensor {
 public:
  // Constructor for a sensor that owns its bus. Pin must be the OneWire pin.
  DS18B20Sensor(const char* id, int pin, uint8_t resolutionBits = 12);

  // Constructor for shared bus. The OneWire instance must outlive this
  // sensor. address is the 8-byte ROM code; copied internally.
  DS18B20Sensor(const char* id, OneWire& bus, const uint8_t address[8],
                uint8_t resolutionBits = 12);

  ~DS18B20Sensor() override;

  const char* id() const override { return id_; }
  size_t  channelCount()      const override { return 1; }
  Channel channel(size_t)     const override;

  void begin() override;
  void tick() override;

  uint32_t conversionTimeMs() const { return conversionTimeMs_; }

  // Scans the OneWire bus on `pin`. Fills out[0..n-1] with ROM addresses.
  // Returns the number of devices found (≤ maxDevices).
  // Arduino-only; always returns 0 in native (non-hardware) builds.
  static uint8_t scanBus(int pin, uint8_t out[][8], uint8_t maxDevices);

  // Overload for callers that already own a OneWire instance on the pin.
  // Avoids creating a second conflicting driver on the same GPIO.
  static uint8_t scanBus(OneWire& bus, uint8_t out[][8], uint8_t maxDevices);

 private:
  enum class State : uint8_t { Idle, Converting };

  const char* id_;
  int pin_ = -1;
  uint8_t resolutionBits_;
  bool ownsBus_;
  OneWire* bus_ = nullptr;
  DallasTemperature* dallas_ = nullptr;
  uint8_t address_[8] = {};
  bool hasAddress_ = false;
  State state_ = State::Idle;
  uint32_t requestStartMs_ = 0;
  uint32_t conversionTimeMs_;
  Reading last_{};
};

}  // namespace SensActCtrl
