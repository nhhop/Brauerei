#pragma once

#include <stdint.h>

#include "core/GpioPort.h"
#include "core/Sensor.h"

namespace SensActCtrl {

// GPIO input sensor with optional software debounce.
//   pullup: enables INPUT_PULLUP at begin().
//   invert: if true, the logical "on" state is LOW (e.g. button to GND).
//   debounceMs: ignore state flips faster than this; 0 disables debounce.
// On a GpioPort channel (port expander) a read the expander does not answer
// makes the reading invalid and shows as fault() until the next one works.
class DigitalInputSensor : public Sensor {
 public:
  DigitalInputSensor(const char* id, int pin,
                     bool pullup = false, bool invert = false,
                     uint32_t debounceMs = 0);
  // Channel ch of a port expander. The port must outlive the sensor.
  DigitalInputSensor(const char* id, GpioPort& port, uint8_t ch,
                     bool pullup = false, bool invert = false,
                     uint32_t debounceMs = 0);

  const char* id() const override { return id_; }
  size_t  channelCount()      const override { return 1; }
  Channel channel(size_t)     const override;

  void begin() override;
  void tick() override;
  const char* fault() const override {
    return portFault_ ? "Port-Expander antwortet nicht" : nullptr;
  }

 private:
  const char* id_;
  int pin_;
  GpioPort* port_ = nullptr;
  uint8_t ch_ = 0;
  bool portFault_ = false;
  bool pullup_;
  bool invert_;
  uint32_t debounceMs_;
  bool stableState_ = false;
  bool candidateState_ = false;
  uint32_t lastFlipMs_ = 0;
  Reading last_{};
};

}  // namespace SensActCtrl
