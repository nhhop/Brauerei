#pragma once

#include <Arduino.h>
#include <ArduinoJson.h>
#include <esp_heap_caps.h>
#include <freertos/FreeRTOS.h>
#include <freertos/task.h>

// Heap diagnostics for GET /api/diag/heap. mark() records the internal heap
// after each setup() block, so the deltas show what each subsystem takes at
// boot; writeJson() adds the live numbers, PSRAM and the stack reserve of the
// known tasks. Internal RAM is what matters: mbedTLS (CONFIG_MBEDTLS_INTERNAL_
// MEM_ALLOC) and DMA can only use it, and ESP.getFreeHeap() counts only it.
namespace BrewControl {
namespace HeapDiag {

struct Mark {
  const char* phase;  // string literal
  uint32_t free;
  uint32_t largest;
};

constexpr size_t kMaxMarks = 16;
inline Mark marks[kMaxMarks];
inline size_t markCount = 0;

inline void mark(const char* phase) {
  const uint32_t free = heap_caps_get_free_size(MALLOC_CAP_INTERNAL);
  const uint32_t largest = heap_caps_get_largest_free_block(MALLOC_CAP_INTERNAL);
  Serial.printf("[heap] %-14s free %6u  largest %6u\n", phase, free, largest);
  if (markCount < kMaxMarks) marks[markCount++] = {phase, free, largest};
}

// No trace facility in the prebuilt core, so no task list — look up the
// tasks we know by name; absent ones are skipped.
constexpr const char* kTaskNames[] = {
    "loopTask", "async_tcp", "webpush", "arduino_events", "wifi", "tiT",
    "sys_evt",  "esp_timer", "mdns",    "Tmr Svc",        "IDLE"};

inline void writeJson(JsonObject out) {
  out["uptimeS"] = millis() / 1000;

  JsonObject internal = out["internal"].to<JsonObject>();
  internal["free"] = heap_caps_get_free_size(MALLOC_CAP_INTERNAL);
  internal["largest"] = heap_caps_get_largest_free_block(MALLOC_CAP_INTERNAL);
  internal["minFree"] = heap_caps_get_minimum_free_size(MALLOC_CAP_INTERNAL);

  JsonObject psram = out["psram"].to<JsonObject>();
  psram["size"] = heap_caps_get_total_size(MALLOC_CAP_SPIRAM);
  psram["free"] = heap_caps_get_free_size(MALLOC_CAP_SPIRAM);
  psram["largest"] = heap_caps_get_largest_free_block(MALLOC_CAP_SPIRAM);

  JsonArray boot = out["boot"].to<JsonArray>();
  for (size_t i = 0; i < markCount; ++i) {
    JsonObject m = boot.add<JsonObject>();
    m["phase"] = marks[i].phase;
    m["free"] = marks[i].free;
    m["largest"] = marks[i].largest;
  }

  JsonArray tasks = out["tasks"].to<JsonArray>();
  for (const char* name : kTaskNames) {
    TaskHandle_t h = xTaskGetHandle(name);
    if (!h) continue;
    JsonObject t = tasks.add<JsonObject>();
    t["name"] = name;
    t["stackFree"] = uxTaskGetStackHighWaterMark(h);  // bytes on ESP-IDF
  }
}

}  // namespace HeapDiag
}  // namespace BrewControl
