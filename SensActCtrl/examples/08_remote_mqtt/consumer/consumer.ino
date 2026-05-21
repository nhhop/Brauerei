// 08_remote_mqtt / consumer
//
// Other half of the two-node MQTT demo. This node has no sensors/actuators —
// it binds a RemoteSensor (publisher's mash_temp) into a local PID
// controller, whose output drives the publisher's heater via RemoteActuator.
//
// The local controller is itself published under device ID "node-b" so a
// web frontend (or `mosquitto_pub`) can retune its Kp/Ki/Kd via:
//   mosquitto_pub -t sensactctrl/node-b/controller/mash_ctrl/tune \
//                 -m '{"Kp":3.0,"Ki":0.05,"Kd":0.0,"setpoint":65}'

#include <WiFi.h>

#include <SensActCtrl.h>
using namespace SensActCtrl;

constexpr const char* kWifiSsid = "YOUR_SSID";
constexpr const char* kWifiPass = "YOUR_PASSWORD";
constexpr const char* kMqttHost = "broker.local";
constexpr uint16_t    kMqttPort = 1883;
constexpr const char* kRemoteDevice = "node-a";
constexpr const char* kLocalDevice  = "node-b";

WiFiClient net;
MqttTransport mqtt(net, kMqttHost, kMqttPort, kLocalDevice);

RemoteSensor   mashTemp(mqtt, kRemoteDevice, "mash_temp");
RemoteActuator heater  (mqtt, kRemoteDevice, "heater");
PIDController  mashCtrl("mash_ctrl", mashTemp, heater, 0.0f, 1.0f);

Registry registry;
RemotePublisher publisher(mqtt, kLocalDevice);

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

  mashCtrl.setTunings(2.0f, 0.05f, 0.0f);
  mashCtrl.setSetpoint(60.0f);

  registry.add(&mashTemp);
  registry.add(&heater);
  registry.add(&mashCtrl);
  registry.begin();

  publisher.attach(mashCtrl);
  publisher.begin();

  Serial.println(F("08 consumer ready"));
}

void loop() {
  registry.tick();
  mqtt.tick();
  publisher.tick();

  const uint32_t now = millis();
  if (now >= nextLogMs) {
    nextLogMs = now + 1000;
    const auto r = mashTemp.channel(0).reading;
    Serial.printf("T_remote=%.2f valid=%d heater_state=%.2f sp=%.1f mqtt=%d\n",
                  r.value, r.valid, heater.state(),
                  mashCtrl.setpoint(), mqtt.connected());
  }
}
