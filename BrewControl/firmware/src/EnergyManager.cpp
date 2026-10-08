#include "EnergyManager.h"

#include <Arduino.h>
#include <driver/gpio.h>
#include <driver/rtc_io.h>
#include <esp_sleep.h>

#include "SettingsStore.h"

namespace BrewControl {

const char* EnergyManager::wakeCause() {
  switch (esp_sleep_get_wakeup_cause()) {
    case ESP_SLEEP_WAKEUP_TIMER: return "timer";
    case ESP_SLEEP_WAKEUP_EXT0:  return "pin";
    default:                     return nullptr;
  }
}

void EnergyManager::releaseOutputs(const std::vector<PinUse>& uses) {
  gpio_deep_sleep_hold_dis();
  for (const PinUse& u : uses)
    if (u.output && u.device.empty()) gpio_hold_dis(static_cast<gpio_num_t>(u.gpio));
}

bool EnergyManager::pinActive(const SettingsStore& s) {
  const int pin = s.energyWakePin();
  if (pin < 0) return false;
  if (pin != pin_ || s.energyWakeActiveLow() != activeLow_) {
    pin_ = pin;
    activeLow_ = s.energyWakeActiveLow();
    // After an ext0 wakeup the pin is still routed to the RTC domain.
    rtc_gpio_deinit(static_cast<gpio_num_t>(pin));
    pinMode(pin, activeLow_ ? INPUT_PULLUP : INPUT_PULLDOWN);
    delay(1);  // let the pull settle before the first read
  }
  return digitalRead(pin) == (activeLow_ ? LOW : HIGH);
}

void EnergyManager::sleep(const SettingsStore& s, uint64_t ms, const std::vector<PinUse>& uses) {
  // Without the hold the outputs float in deep sleep, and a relay module
  // that switches on a high level may pull in. Costs a few µA at most.
  // Device channels are not GPIOs (an MCP4728 keeps its outputs by itself).
  for (const PinUse& u : uses)
    if (u.output && u.device.empty()) gpio_hold_en(static_cast<gpio_num_t>(u.gpio));
  gpio_deep_sleep_hold_en();

  esp_sleep_enable_timer_wakeup(ms * 1000ULL);
  const int pin = s.energyWakePin();
  if (pin >= 0) {
    const auto g = static_cast<gpio_num_t>(pin);
    const bool low = s.energyWakeActiveLow();
    rtc_gpio_init(g);
    rtc_gpio_set_direction(g, RTC_GPIO_MODE_INPUT_ONLY);
    if (low) {
      rtc_gpio_pulldown_dis(g);
      rtc_gpio_pullup_en(g);
    } else {
      rtc_gpio_pullup_dis(g);
      rtc_gpio_pulldown_en(g);
    }
    esp_sleep_enable_ext0_wakeup(g, low ? 0 : 1);
  }
  Serial.printf("[energy] deep sleep for %llu ms\n", static_cast<unsigned long long>(ms));
  Serial.flush();
  esp_deep_sleep_start();
}

}  // namespace BrewControl
