// 09_remote_espnow / publisher
//
// Same shape as 08, but transport is ESP-Now — no WiFi association, no MQTT
// broker. Both nodes must run on the same channel (1 by default).
//
// Topics (broadcast, MQTT-compatible wire format):
//   sensactctrl/node-a/sensor/mash_temp        (retained state)
//   sensactctrl/node-a/sensor/mash_temp/meta   (retained meta)
//   sensactctrl/node-a/actuator/heater         (retained state)
//   sensactctrl/node-a/actuator/heater/meta    (retained meta)
//   sensactctrl/node-a/actuator/heater/set     (consumer writes here)

#include <SensActCtrl.h>
using namespace SensActCtrl;

constexpr uint8_t     kChannel  = 1;
constexpr const char* kDeviceId = "node-a";

constexpr int kOneWirePin = 4;
constexpr int kHeaterPin = 16;

EspNowTransport tx(kChannel);

DS18B20Sensor mashTemp("mash_temp", kOneWirePin);
DigitalOutputActuator heater("heater", kHeaterPin,
                             DigitalOutputActuator::Mode::TimeProportional);

Registry registry;
RemotePublisher publisher(tx, kDeviceId);

uint32_t nextLogMs = 0;

void setup() {
  Serial.begin(115200);
  delay(200);

  heater.setPeriodMs(2000);

  registry.add(&mashTemp);
  registry.add(&heater);
  registry.begin();

  publisher.attach(mashTemp);
  publisher.attach(heater);
  publisher.begin();

  Serial.println(F("09 publisher (ESP-Now) ready"));
}

void loop() {
  registry.tick();
  tx.tick();
  publisher.tick();

  const uint32_t now = millis();
  if (now >= nextLogMs) {
    nextLogMs = now + 1000;
    Serial.printf("T=%.2f heater=%.2f link=%d\n",
                  mashTemp.channel(0).reading.value, heater.state(), tx.connected());
  }
}
