// 08_remote_mqtt / publisher
//
// One half of the two-node MQTT demo. This node owns the hardware: a DS18B20
// on GPIO4 and an SSR / heater on GPIO16. It publishes both via MQTT under
// device ID "node-a"; the consumer node subscribes to mash_temp and drives
// the heater remotely via /actuator/heater/set.
//
// Fill in WiFi + broker credentials below. Topics:
//   sensactctrl/node-a/sensor/mash_temp        (retained state)
//   sensactctrl/node-a/sensor/mash_temp/meta   (retained meta)
//   sensactctrl/node-a/actuator/heater         (retained state)
//   sensactctrl/node-a/actuator/heater/meta    (retained meta)
//   sensactctrl/node-a/actuator/heater/set     (subscribed; consumer writes here)

#include <WiFi.h>

#include <SensActCtrl.h>
using namespace SensActCtrl;

constexpr const char* kWifiSsid = "YOUR_SSID";
constexpr const char* kWifiPass = "YOUR_PASSWORD";
constexpr const char* kMqttHost = "broker.local";
constexpr uint16_t    kMqttPort = 1883;
constexpr const char* kDeviceId = "node-a";

constexpr int kOneWirePin = 4;
constexpr int kHeaterPin = 16;

WiFiClient net;
MqttTransport mqtt(net, kMqttHost, kMqttPort, kDeviceId);

DS18B20Sensor mashTemp("mash_temp", kOneWirePin);
DigitalOutputActuator heater("heater", kHeaterPin,
                             DigitalOutputActuator::Mode::TimeProportional);

Registry registry;
RemotePublisher publisher(mqtt, kDeviceId);

uint32_t nextLogMs = 0;

void setup() {
  Serial.begin(115200);
  delay(200);

  WiFi.begin(kWifiSsid, kWifiPass);
  while (WiFi.status() != WL_CONNECTED) {
    delay(250);
    Serial.print('.');
  }
  Serial.printf("\nWiFi up, IP=%s\n", WiFi.localIP().toString().c_str());

  heater.setPeriodMs(2000);  // 2 s SSR window

  registry.add(&mashTemp);
  registry.add(&heater);
  registry.begin();

  publisher.attach(mashTemp);
  publisher.attach(heater);
  publisher.begin();

  Serial.println(F("08 publisher ready"));
}

void loop() {
  registry.tick();
  mqtt.tick();
  publisher.tick();

  const uint32_t now = millis();
  if (now >= nextLogMs) {
    nextLogMs = now + 1000;
    Serial.printf("T=%.2f heater=%.2f mqtt=%d\n",
                  mashTemp.channel(0).reading.value,
                  heater.state(),
                  mqtt.connected());
  }
}
