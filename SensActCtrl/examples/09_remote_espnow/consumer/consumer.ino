// 09_remote_espnow / consumer
//
// Mirror of 08's consumer but over ESP-Now. RemoteSensor + RemoteActuator
// hang off the same EspNowTransport; the local PID controller is also
// published under "node-b" so a third ESP-Now node could retune it.

#include <SensActCtrl.h>
using namespace SensActCtrl;

constexpr uint8_t     kChannel      = 1;
constexpr const char* kRemoteDevice = "node-a";
constexpr const char* kLocalDevice  = "node-b";

EspNowTransport tx(kChannel);

RemoteSensor   mashTemp(tx, kRemoteDevice, "mash_temp");
RemoteActuator heater  (tx, kRemoteDevice, "heater");
PIDController  mashCtrl("mash_ctrl", mashTemp, heater, 0.0f, 1.0f);

Registry registry;
RemotePublisher publisher(tx, kLocalDevice);

uint32_t nextLogMs = 0;

void setup() {
  Serial.begin(115200);
  delay(200);

  mashCtrl.setTunings(2.0f, 0.05f, 0.0f);
  mashCtrl.setSetpoint(60.0f);

  registry.add(&mashTemp);
  registry.add(&heater);
  registry.add(&mashCtrl);
  registry.begin();

  publisher.attach(mashCtrl);
  publisher.begin();

  Serial.println(F("09 consumer (ESP-Now) ready"));
}

void loop() {
  registry.tick();
  tx.tick();
  publisher.tick();

  const uint32_t now = millis();
  if (now >= nextLogMs) {
    nextLogMs = now + 1000;
    const auto r = mashTemp.lastReading();
    Serial.printf("T_remote=%.2f valid=%d heater_state=%.2f sp=%.1f link=%d\n",
                  r.value, r.valid, heater.state(),
                  mashCtrl.setpoint(), tx.connected());
  }
}
