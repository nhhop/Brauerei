// Hop dispenser: a button (DigitalInputSensor) triggers a pulse-output
// actuator to drop a configurable number of hops, one solenoid pulse per
// hop addition.

#include <SensActCtrl.h>
using namespace SensActCtrl;

constexpr int kButtonPin = 32;
constexpr int kSolenoidPin = 17;
constexpr float kHopsPerPress = 3.0f;

DigitalInputSensor button("button", kButtonPin,
                          /*pullup=*/true, /*invert=*/true,
                          /*debounceMs=*/30);
PulseOutputActuator dispenser("hop_dispenser", kSolenoidPin,
                              /*pulseWidth=*/250,
                              /*gap=*/500,
                              /*activeHigh=*/true);
Registry registry;
bool prev = false;

void setup() {
  Serial.begin(115200);
  delay(200);

  dispenser.setUnit("hops");
  dispenser.setQuantity(Quantity::Count);

  registry.add(&button);
  registry.add(&dispenser);
  registry.begin();
  Serial.println(F("06_hop_dispenser ready (press button to dispense)"));
}

void loop() {
  registry.tick();

  const bool pressed = button.channel(0).reading.value > 0.5f;
  if (pressed && !prev) {
    dispenser.write(kHopsPerPress);
    Serial.printf("Queued %d hops; outstanding=%.0f\n",
                  (int)kHopsPerPress, dispenser.state());
  }
  prev = pressed;
}
