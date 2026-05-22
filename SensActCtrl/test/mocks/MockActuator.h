#pragma once

#include <vector>

#include "core/Actuator.h"

namespace SensActCtrl {
namespace test {

// Programmable actuator for unit tests. Records every write() so tests can
// assert on the sequence of commanded values.
class MockActuator : public Actuator {
 public:
  MockActuator(const char* id, ActuatorMeta meta) : id_(id), meta_(meta) {}

  const char* id() const override { return id_; }
  ActuatorMeta meta() const override { return meta_; }

  void tick() override { ++tickCount; }
  void write(float v) override { state_ = v; writes.push_back(v); }
  float state() const override { return state_; }

  std::vector<float> writes;
  uint32_t tickCount = 0;
  const char* faultMsg = nullptr;
  const char* fault() const override { return faultMsg; }

 private:
  const char* id_;
  ActuatorMeta meta_;
  float state_ = 0.0f;
};

}  // namespace test
}  // namespace SensActCtrl
