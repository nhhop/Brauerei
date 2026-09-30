#pragma once

#include <cstdint>
#include <string>

namespace BrewControl {

// Decides when the runtime state (RuntimeState.h) is written: only when it
// differs from what was saved last, and only once it has held still for
// quietMs, so dragging a setpoint slider costs one flash write, not dozens.
// Arduino-free for the native tests.
class StateSaver {
 public:
  explicit StateSaver(uint32_t quietMs = 2000) : quietMs_(quietMs) {}

  // What the file holds now (at boot: the state just restored).
  void reset(const std::string& saved) {
    saved_ = saved;
    pending_ = false;
  }

  // Feeds the current state; true = write it now (it counts as saved then).
  bool due(uint32_t nowMs, const std::string& current) {
    if (current == saved_) {
      pending_ = false;
      return false;
    }
    if (!pending_ || current != candidate_) {
      candidate_ = current;
      changedMs_ = nowMs;
      pending_ = true;
      return false;
    }
    if (nowMs - changedMs_ < quietMs_) return false;
    saved_ = current;
    pending_ = false;
    return true;
  }

 private:
  uint32_t quietMs_;
  std::string saved_;
  std::string candidate_;
  uint32_t changedMs_ = 0;
  bool pending_ = false;
};

}  // namespace BrewControl
