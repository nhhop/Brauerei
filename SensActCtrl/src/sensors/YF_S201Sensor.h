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
