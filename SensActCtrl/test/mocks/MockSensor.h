#pragma once
#include "core/Sensor.h"

namespace SensActCtrl {
namespace test {

// Programmable sensor for unit tests. Set value/valid directly; tick()
// stamps the current value into the channel reading and bumps tickCount.
class MockSensor : public Sensor {
 public:
  MockSensor(const char* id, SensorMeta meta) : id_(id), meta_(meta) {}

  const char* id()            const override { return id_; }
  size_t      channelCount()  const override { return 1; }
  Channel     channel(size_t) const override { return {"", meta_, last_}; }

  void tick() override {
    last_.value       = value;
    last_.valid       = valid;
    last_.timestampMs = ++timestamp_;
    ++tickCount;
  }

  float    value     = 0.0f;
  bool     valid     = true;
  uint32_t tickCount = 0;

 private:
  const char* id_;
  SensorMeta  meta_;
  Reading     last_{};
  uint32_t    timestamp_ = 0;
};

}  // namespace test
}  // namespace SensActCtrl
