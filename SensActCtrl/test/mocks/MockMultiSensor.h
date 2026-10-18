#pragma once
#include "core/Sensor.h"

namespace SensActCtrl {
namespace test {

// Two-channel sensor ("temp" / "hum") with directly settable readings.
class MockMultiSensor : public Sensor {
 public:
  MockMultiSensor(const char* id, SensorMeta meta) : id_(id), meta_(meta) {}

  const char* id()           const override { return id_; }
  size_t      channelCount() const override { return 2; }
  Channel     channel(size_t i) const override {
    return {i == 0 ? "temp" : "hum", meta_, last_[i == 0 ? 0 : 1]};
  }

  void tick() override {}

  void set(size_t i, float v) {
    last_[i].value = v;
    last_[i].valid = true;
    last_[i].timestampMs = ++timestamp_;
  }

 private:
  const char* id_;
  SensorMeta  meta_;
  Reading     last_[2]{};
  uint32_t    timestamp_ = 0;
};

}  // namespace test
}  // namespace SensActCtrl
