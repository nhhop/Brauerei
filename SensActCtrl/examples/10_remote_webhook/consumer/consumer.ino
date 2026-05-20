// 10_remote_webhook / consumer
//
// Mirror of 08/09's consumer but over plain HTTP webhooks. Binds
// RemoteSensor + RemoteActuator into a local PID controller; the controller
// is itself published under "node-b" so it can be retuned via HTTP:
//
//   curl -X POST http://<this-node>:8080/sensactctrl/node-b/controller/mash_ctrl/tune \
//        -H 'Content-Type: application/json' \
//        -d '{"Kp":3.0,"Ki":0.05,"Kd":0.0,"setpoint":65}'

#include <WiFi.h>

#include <SensActCtrl.h>
using namespace SensActCtrl;

constexpr const char* kWifiSsid    = "YOUR_SSID";
constexpr const char* kWifiPass    = "YOUR_PASSWORD";
constexpr uint16_t    kListenPort  = 8080;
constexpr const char* kPeerBaseUrl = "http://192.168.1.50:8080";  // publisher
constexpr const char* kRemoteDevice = "node-a";
constexpr const char* kLocalDevice  = "node-b";

WebhookTransport tx(kListenPort, kPeerBaseUrl);

RemoteSensor   mashTemp(tx, kRemoteDevice, "mash_temp");
RemoteActuator heater  (tx, kRemoteDevice, "heater");
PIDController  mashCtrl("mash_ctrl", mashTemp, heater, 0.0f, 1.0f);

Registry registry;
RemotePublisher publisher(tx, kLocalDevice);

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

  Serial.println(F("10 consumer (Webhook) ready"));
}

void loop() {
  registry.tick();
  tx.tick();
  publisher.tick();

  const uint32_t now = millis();
  if (now >= nextLogMs) {
    nextLogMs = now + 1000;
    const auto r = mashTemp.lastReading();
    Serial.printf("T_remote=%.2f valid=%d heater_state=%.2f sp=%.1f wifi=%d\n",
                  r.value, r.valid, heater.state(),
                  mashCtrl.setpoint(), tx.connected());
  }
}
