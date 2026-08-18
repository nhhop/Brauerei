#pragma once

#include <vector>

#include "core/Actuator.h"

namespace SensActCtrl {
namespace test {

// Programmable actuator for unit tests. Records every write() so tests can
// assert on the sequence of commanded values, and models the master switch
// the way a real actuator does: `outputs` holds what actually reached the
// "hardware", which stays at meta().min while disabled.
class MockActuator : public Actuator {
 public:
  MockActuator(const char* id, ActuatorMeta meta) : id_(id), meta_(meta) {}

  const char* id() const override { return id_; }
  ActuatorMeta meta() const override { return meta_; }

  void tick() override { ++tickCount; }
  void write(float v) override { target_ = v; writes.push_back(v); applyOutput(); }
  float target() const override { return target_; }

  std::vector<float> writes;   // every commanded value, gated or not
  std::vector<float> outputs;  // what reached the hardware
  uint32_t tickCount = 0;
  const char* faultMsg = nullptr;
  const char* fault() const override { return faultMsg; }

  float output() const { return outputs.empty() ? meta_.min : outputs.back(); }

 protected:
  void applyEnabled(bool /*e*/) override { applyOutput(); }

 private:
  void applyOutput() { outputs.push_back(enabled_ ? target_ : meta_.min); }

  const char* id_;
  ActuatorMeta meta_;
  float target_ = 0.0f;
};

}  // namespace test
}  // namespace SensActCtrl
