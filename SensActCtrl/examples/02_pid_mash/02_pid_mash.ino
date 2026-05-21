// PID mash control: DS18B20 + SSR in time-proportional mode + manual PID.
// Tune Kp/Ki/Kd values below or via setParamsJson at runtime.

#include <SensActCtrl.h>
using namespace SensActCtrl;

constexpr int kOneWirePin = 4;
constexpr int kSsrPin = 16;

DS18B20Sensor mashTemp("mash_temp", kOneWirePin);
DigitalOutputActuator heater("heater", kSsrPin,
                             DigitalOutputActuator::Mode::TimeProportional);
PIDController pid("mash_pid", mashTemp, heater, /*min=*/0.0f, /*max=*/1.0f);

Registry registry;
uint32_t nextLogMs = 0;

void setup() {
  Serial.begin(115200);
  delay(200);

  heater.setPeriodMs(2000);  // 2 s TPO cycle

  // Conservative starting point — refine via autotune sketch (03).
  pid.setTunings(/*Kp=*/8.0f, /*Ki=*/0.2f, /*Kd=*/0.5f);
  pid.enableAntiWindup(true, 0.8f);
  pid.setSetpoint(65.0f);  // 65 °C mash rest

  registry.add(&mashTemp);
  registry.add(&heater);
  registry.add(&pid);
  registry.begin();

  Serial.println(F("02_pid_mash ready"));
}

void loop() {
  registry.tick();

  const uint32_t now = millis();
  if (now >= nextLogMs) {
    nextLogMs = now + 1000;
    const auto r = mashTemp.channel(0).reading;
    Serial.printf("T=%.2f sp=%.2f duty=%.2f\n",
                  r.value, pid.setpoint(), heater.state());
  }
}
