// SensActCtrl/src/sensors/HCSR04Sensor.h
#pragma once
#include <stdint.h>
#include "core/Sensor.h"

namespace SensActCtrl {

class HCSR04Sensor : public Sensor {
 public:
  static constexpr uint32_t kIntervalMs = 60;  // ms between measurements
  static constexpr uint32_t kTimeoutMs  = 30;  // ms echo timeout
  static constexpr int      kMaxSensors = 4;   // max simultaneous instances

  HCSR04Sensor(const char* id, int trigPin, int echoPin);
  ~HCSR04Sensor();

  // Enable derived channel: derived = distance * factor + offset.
  // unit is copied internally into a 16-byte buffer (max 15 chars + '\0').
  // channel(1).reading.valid stays false until this is called.
  void setScale(float factor, float offset = 0.0f, const char* unit = "");

  // Expose only a subset of the channels (bit 0 = "distance", bit 1 = "derived").
  // The measurement itself always runs; the mask only filters channelCount() /
  // channel(). Default: both. A mask without any valid bit is ignored.
  static constexpr uint8_t kChannelDistance = 1;
  static constexpr uint8_t kChannelDerived  = 2;
  void setChannelMask(uint8_t mask) { if (mask & 3) channelMask_ = mask & 3; }

  const char* id()           const override { return id_; }
  size_t      channelCount() const override { return (channelMask_ & 1) + ((channelMask_ >> 1) & 1); }
  Channel     channel(size_t idx) const override;

  void begin() override;
  void tick()  override;

  // Bypass ISR for tests: sets durationUs_ and advances state to Done.
  void injectEchoForTest(uint32_t durationUs);

#ifndef ARDUINO
  // Reset static instance pool and timing counters between tests.
  static void resetForTest();
  // Advance g_millis by ms — for deterministic timeout tests.
  // g_millis does NOT auto-increment (unlike YF_S201Sensor::g_millisCounter).
  static void advanceMillisForTest(uint32_t ms);
#endif

 private:
  enum class State : uint8_t { Idle, Triggered, Measuring, Done };

  static HCSR04Sensor* instances_[kMaxSensors];
  static int           instanceCount_;

  static void isr0(); static void isr1();
  static void isr2(); static void isr3();
  static void (*isrFor(int idx))();
  static void onEcho(int idx);

  const char* id_;
  int         trigPin_;
  int         echoPin_;
  int         slotIdx_    = -1;
  uint8_t     channelMask_ = kChannelDistance | kChannelDerived;

  volatile State    state_      = State::Idle;
  volatile uint32_t startUs_    = 0;
  volatile uint32_t durationUs_ = 0;

  uint32_t lastTriggerMs_ = 0;
  uint32_t triggerMs_     = 0;

  bool  hasScale_      = false;
  float scaleFactor_   = 1.0f;
  float scaleOffset_   = 0.0f;
  char  scaleUnit_[16] = {};

  Reading distReading_{};
  Reading derivedReading_{};
};

}  // namespace SensActCtrl
