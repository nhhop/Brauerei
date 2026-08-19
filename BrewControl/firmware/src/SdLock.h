#pragma once

#include <freertos/FreeRTOS.h>
#include <freertos/semphr.h>

namespace BrewControl {

// Global mutex serializing every SD-card access across tasks. REST handlers
// (multipart upload, JSON POST/DELETE) run on the AsyncTCP task while sensor
// logging and config persistence run on loopTask; the SD/SdFat driver
// underneath is not safe for concurrent access from two tasks — it silently
// corrupts, causing later writes to fail until reboot. Take an SdLock around
// each individual filesystem operation (one open/write/close, one directory
// sweep) rather than around a whole multi-step transfer, so loopTask's
// control loop is never blocked for longer than a single SD I/O call.
// Recursive so a locked call that invokes another locked helper doesn't
// self-deadlock.
inline SemaphoreHandle_t sdMutex() {
  static SemaphoreHandle_t m = xSemaphoreCreateRecursiveMutex();
  return m;
}

class SdLock {
 public:
  SdLock() : m_(sdMutex()) { xSemaphoreTakeRecursive(m_, portMAX_DELAY); }
  ~SdLock() { xSemaphoreGiveRecursive(m_); }
  SdLock(const SdLock&) = delete;
  SdLock& operator=(const SdLock&) = delete;

 private:
  SemaphoreHandle_t m_;
};

}  // namespace BrewControl
