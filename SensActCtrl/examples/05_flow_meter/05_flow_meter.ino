// Flow meter: YF-S201 hall-effect sensor on GPIO27.
// channel(0): flow rate in L/min (key="rate")
// channel(1): cumulative volume in L (key="volume")

#include <SensActCtrl.h>
using namespace SensActCtrl;

constexpr int kFlowPin = 27;

YF_S201Sensor flow("flow", kFlowPin);
Registry registry;
uint32_t nextLogMs = 0;

void setup() {
  Serial.begin(115200);
  delay(200);

  registry.add(&flow);
  registry.begin();
  Serial.println(F("05_flow_meter ready"));
}

void loop() {
  registry.tick();

  const uint32_t now = millis();
  if (now >= nextLogMs) {
    nextLogMs = now + 500;
    const auto rate   = flow.channel(0).reading;
    const auto volume = flow.channel(1).reading;
    Serial.printf("flow=%.2f L/min  vol=%.3f L\n", rate.value, volume.value);
  }
}
