#pragma once

#include <stdint.h>

#include "core/Sensor.h"

namespace SensActCtrl {

// Edge-counting GPIO sensor. Two operating modes:
//   Total: monotonic counter (Cumulative). Reports total pulses since
//          begin(), optionally scaled by pulsesPerUnit (e.g. 450 pulses
//          per liter → reports Volume in l).
//   Rate:  pulses per second over a configurable averaging window. Reports
//          a Continuous value with quantity FlowRate / Frequency.
//
// Counting is done in an ISR — the counter is `volatile uint32_t`.
// tick() snapshots the counter, computes rate, and updates lastReading().
class PulseCounterSensor : public Sensor {
 public:
  enum class Mode : uint8_t { Total, Rate };
  enum class Edge : uint8_t { Rising, Falling, Change };

  PulseCounterSensor(const char* id, int pin, Mode mode, Edge edge = Edge::Rising);

  const char* id() const override { return id_; }
  size_t  channelCount()      const override { return 1; }
  Channel channel(size_t)     const override { return {"", meta_, last_}; }

  void begin() override;
  void tick() override;

  // Set how many raw pulses correspond to one physical unit. e.g. 450.0 →
  // a liter every 450 pulses; the reading then comes out in liters (Total)
  // or l/s scaled by configured windowMs (Rate).
  void setPulsesPerUnit(float pulsesPerUnit);
  void setRateWindowMs(uint32_t windowMs) { windowMs_ = windowMs; }
  void setMeta(Quantity q, const char* unit, float maxPhys, float resolution);

  // Raw pulse count since begin(). Useful for diagnostics / tests.
  uint32_t rawCount() const;

  // Test/test-hook: simulate an ISR pulse. No-op on Arduino targets in
  // production; tests for PulseCounter sit in the native test environment
  // where the real ISR doesn't fire.
  void injectPulseForTest();

 private:
  static constexpr int kMaxInstances = 8;
  static PulseCounterSensor* instances_[kMaxInstances];
  static int instanceCount_;

  static void isrTrampoline0();
  static void isrTrampoline1();
  static void isrTrampoline2();
  static void isrTrampoline3();
  static void isrTrampoline4();
  static void isrTrampoline5();
  static void isrTrampoline6();
  static void isrTrampoline7();
  static void (*trampolineFor(int idx))();

  void onEdge();

  const char* id_;
  int pin_;
  Mode mode_;
  Edge edge_;
  int instanceIdx_ = -1;
  float pulsesPerUnit_ = 1.0f;
  uint32_t windowMs_ = 1000;
  volatile uint32_t pulseCount_ = 0;

  // Rate-mode windowing
  uint32_t lastWindowMs_ = 0;
  uint32_t lastWindowCount_ = 0;

  SensorMeta meta_{ValueKind::Cumulative, Quantity::Count, "pulses",
                   0.0f, 4294967295.0f, 1.0f};
  Reading last_{};
};

}  // namespace SensActCtrl
