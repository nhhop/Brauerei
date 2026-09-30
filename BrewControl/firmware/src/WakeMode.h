#pragma once

#include <cstdint>
#include <ctime>

namespace BrewControl {

// Deep-sleep decisions of EnergyManager, Arduino-free for the native tests.

// A timer wakeup (the sleep interval ran out) with deep sleep still on and
// the wake pin not held is a short wake: measure, publish, sleep again.
// Everything else — power-on, reset, the wake pin, deep sleep switched off
// in the meantime — is a full wake.
inline bool isShortWake(bool timerWakeup, bool deepSleep, bool pinActive) {
  return timerWakeup && deepSleep && !pinActive;
}

// The earlier of two event times (Unix s), 0 = no event.
inline time_t earlierEvent(time_t a, time_t b) {
  if (a == 0) return b;
  if (b == 0) return a;
  return a < b ? a : b;
}

// How long to sleep, in ms. The interval counts from the start of the wake
// (awakeMs are already spent), and ends one second after the next program
// or timer event (nextEvent, 0 = none) so that event is due on waking.
// At least one second.
inline uint64_t sleepMs(uint32_t intervalSec, uint32_t awakeMs, time_t now, time_t nextEvent) {
  int64_t ms = int64_t(intervalSec) * 1000 - awakeMs;
  if (nextEvent > 0) {
    const int64_t untilEvent = (int64_t(nextEvent) - now + 1) * 1000;
    if (untilEvent < ms) ms = untilEvent;
  }
  return ms < 1000 ? 1000 : uint64_t(ms);
}

// Course of a short wake: wait until every sensor has a reading, then until
// every enabled publisher is connected — each wait capped — then a tail,
// because the publishers send on their own 1 s cycle. sinceMs counts from
// the first loop() pass.
class ShortWake {
 public:
  static constexpr uint32_t kSensorWaitMs = 3000;  // DS18B20 needs ~750 ms
  static constexpr uint32_t kConnectWaitMs = 5000;
  static constexpr uint32_t kTailMs = 1500;
  static constexpr uint32_t kMaxMs = 30000;  // sleep, whatever hangs

  // True from the moment every sensor has read once (or the wait ran out):
  // only then may logs and programs use the values.
  bool sensorsSettled(uint32_t sinceMs, bool sensorsReady) {
    if (sensorsReady || sinceMs >= kSensorWaitMs) settled_ = true;
    return settled_;
  }

  // True = go to sleep.
  bool done(uint32_t sinceMs, bool connected) {
    if (sinceMs >= kMaxMs) return true;
    if (!ready_ && settled_ && (connected || sinceMs >= kConnectWaitMs)) {
      ready_ = true;
      readyMs_ = sinceMs;
    }
    return ready_ && sinceMs - readyMs_ >= kTailMs;
  }

 private:
  bool settled_ = false;
  bool ready_ = false;
  uint32_t readyMs_ = 0;
};

}  // namespace BrewControl
