// Two-point heater control with a DS18B20 and an SSR on GPIO16.
// Setpoint: 30 °C, hysteresis ±0.5 °C. Hold the sensor in hand to push
// past the upper threshold; the SSR LED should switch off.

#include <SensActCtrl.h>
using namespace SensActCtrl;

constexpr int kOneWirePin = 4;
constexpr int kHeaterPin = 16;

DS18B20Sensor mashTemp("mash_temp", kOneWirePin);
DigitalOutputActuator heater("heater", kHeaterPin,
                             DigitalOutputActuator::Mode::Binary);
TwoPointController ctrl("mash_ctrl", mashTemp, heater);

Registry registry;

uint32_t nextLogMs = 0;

void setup() {
  Serial.begin(115200);
  delay(200);

  ctrl.setHysteresis(-0.5f, 0.5f);
  ctrl.setSetpoint(30.0f);

  registry.add(&mashTemp);
  registry.add(&heater);
  registry.add(&ctrl);
  registry.begin();

  Serial.println(F("01_local_twopoint_heater ready"));
}

void loop() {
  registry.tick();

  const uint32_t now = millis();
  if (now >= nextLogMs) {
    nextLogMs = now + 1000;
    const auto r = mashTemp.channel(0).reading;
    Serial.printf("t=%lu T=%.2f valid=%d heater=%.0f\n",
                  (unsigned long)now, r.value, r.valid, heater.state());
  }
}
