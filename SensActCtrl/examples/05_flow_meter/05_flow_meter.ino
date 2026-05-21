// Flow meter: hall-effect sensor (e.g. YF-S201, ~450 pulses/litre) on
// GPIO27 reports volumetric flow in l/min.

#include <SensActCtrl.h>
using namespace SensActCtrl;

constexpr int kFlowPin = 27;

PulseCounterSensor flow("flow", kFlowPin,
                        PulseCounterSensor::Mode::Rate,
                        PulseCounterSensor::Edge::Rising);
Registry registry;
uint32_t nextLogMs = 0;

void setup() {
  Serial.begin(115200);
  delay(200);

  // YF-S201: 7.5 Hz per l/min ≈ 450 pulses/l. Set pulsesPerUnit so the
  // reading comes out in l/s; multiply by 60 for l/min in the print.
  flow.setPulsesPerUnit(7.5f);  // Hz → l/min directly when window=1000 ms
  flow.setRateWindowMs(1000);
  flow.setMeta(Quantity::FlowRate, "l/min", 30.0f, 0.01f);

  registry.add(&flow);
  registry.begin();
  Serial.println(F("05_flow_meter ready"));
}

void loop() {
  registry.tick();

  const uint32_t now = millis();
  if (now >= nextLogMs) {
    nextLogMs = now + 500;
    Serial.printf("flow=%.2f l/min raw=%lu\n",
                  flow.channel(0).reading.value,
                  (unsigned long)flow.rawCount());
  }
}
