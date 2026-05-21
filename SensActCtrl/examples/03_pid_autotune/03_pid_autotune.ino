// Drive a single autotune run against a real thermal load, then dump the
// resulting PID gains via paramsJson. Use those values in 02_pid_mash.
//
// Wiring identical to 02_pid_mash. Place the sensor in good thermal
// contact with the heating element and start with the kettle near the
// target temperature.

#include <SensActCtrl.h>
using namespace SensActCtrl;

constexpr int kOneWirePin = 4;
constexpr int kSsrPin = 16;

DS18B20Sensor mashTemp("mash_temp", kOneWirePin);
DigitalOutputActuator heater("heater", kSsrPin,
                             DigitalOutputActuator::Mode::TimeProportional);
PIDController pid("mash_pid", mashTemp, heater, 0.0f, 1.0f);

Registry registry;
uint32_t nextLogMs = 0;
bool autotuneReported = false;

void setup() {
  Serial.begin(115200);
  delay(200);

  heater.setPeriodMs(2000);
  pid.setSetpoint(65.0f);

  registry.add(&mashTemp);
  registry.add(&heater);
  registry.add(&pid);
  registry.begin();

  // Choose your tuning method here. Ziegler-Nichols is a sane default.
  pid.autotune(TuningMethod::ZieglerNichols);
  Serial.println(F("Autotune started — keep the load stable until 'done'"));
}

void loop() {
  registry.tick();

  const uint32_t now = millis();
  if (now >= nextLogMs) {
    nextLogMs = now + 2000;
    const auto r = mashTemp.channel(0).reading;
    Serial.printf("T=%.2f sp=%.2f duty=%.2f running=%d done=%d\n",
                  r.value, pid.setpoint(), heater.state(),
                  pid.isAutotuneRunning(), pid.isAutotuneDone());
  }

  if (pid.isAutotuneDone() && !autotuneReported) {
    autotuneReported = true;
    char buf[256];
    if (pid.paramsJson(buf, sizeof(buf)) > 0) {
      Serial.print(F("Autotune result: "));
      Serial.println(buf);
    }
  }
}
