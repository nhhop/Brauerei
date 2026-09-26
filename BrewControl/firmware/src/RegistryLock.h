#pragma once

#include <freertos/FreeRTOS.h>
#include <freertos/semphr.h>

namespace BrewControl {

// Serializes structural changes to the item set against the code that walks
// it. loopTask (core 1) ticks the registry, the remote publishers and the
// display over the live Sensor/Actuator/Controller objects; the AsyncTCP task
// (core 0) creates, replaces and frees those objects for the REST routes.
// Without this lock a DELETE/PUT could free an item while loop() is calling
// into it — observed once as a panic on the LilyGo (2026-09-26).
//
// loopTask holds it (RegistryLock) around the item-walking part of loop();
// REST handlers take it (RegistryTryLock) around each items_ mutation only —
// never across SD I/O, so the order is always registry lock before SdLock.
// Recursive, like SdLock.
inline SemaphoreHandle_t registryMutex() {
  static SemaphoreHandle_t m = xSemaphoreCreateRecursiveMutex();
  return m;
}

class RegistryLock {
 public:
  RegistryLock() : m_(registryMutex()) { xSemaphoreTakeRecursive(m_, portMAX_DELAY); }
  ~RegistryLock() { xSemaphoreGiveRecursive(m_); }
  RegistryLock(const RegistryLock&) = delete;
  RegistryLock& operator=(const RegistryLock&) = delete;

 private:
  SemaphoreHandle_t m_;
};

// Bounded variant for the AsyncTCP task, which runs under the task watchdog
// and must not wait out a slow loop() (e.g. a blocking MQTT reconnect). Check
// locked(); release() early to do SD writes outside the lock.
class RegistryTryLock {
 public:
  explicit RegistryTryLock(uint32_t waitMs)
      : m_(registryMutex()),
        held_(xSemaphoreTakeRecursive(m_, pdMS_TO_TICKS(waitMs)) == pdTRUE) {}
  ~RegistryTryLock() { release(); }
  bool locked() const { return held_; }
  void release() {
    if (held_) xSemaphoreGiveRecursive(m_);
    held_ = false;
  }
  RegistryTryLock(const RegistryTryLock&) = delete;
  RegistryTryLock& operator=(const RegistryTryLock&) = delete;

 private:
  SemaphoreHandle_t m_;
  bool held_;
};

}  // namespace BrewControl
