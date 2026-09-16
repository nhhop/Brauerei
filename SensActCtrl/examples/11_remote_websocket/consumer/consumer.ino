// 11_remote_websocket / consumer
//
// Mirror of 08/09/10's consumer, over WebSocket. This node is the hub: it
// runs the WebSocket *server* and binds RemoteSensor + RemoteActuator of a
// connecting publisher into a local PID controller. It never needs the
// publisher's address — the publisher connects here.

#include <WiFi.h>

#include <SensActCtrl.h>
using namespace SensActCtrl;

constexpr const char* kWifiSsid     = "YOUR_SSID";
constexpr const char* kWifiPass     = "YOUR_PASSWORD";
constexpr uint16_t    kListenPort   = 8081;
constexpr const char* kRemoteDevice = "node-a";

WebSocketTransport tx(kListenPort);

RemoteSensor   mashTemp(tx, kRemoteDevice, "mash_temp");
RemoteActuator heater  (tx, kRemoteDevice, "heater");
PIDController  mashCtrl("mash_ctrl", mashTemp, heater, 0.0f, 1.0f);

Registry registry;

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

  Serial.println(F("11 consumer (WebSocket server) ready"));
}

void loop() {
  registry.tick();
  tx.tick();

  const uint32_t now = millis();
  if (now >= nextLogMs) {
    nextLogMs = now + 1000;
    const auto r = mashTemp.channel(0).reading;
    Serial.printf("T_remote=%.2f valid=%d heater_state=%.2f sp=%.1f clients=%u\n",
                  r.value, r.valid, heater.state(), mashCtrl.setpoint(),
                  static_cast<unsigned>(tx.clientCount()));
  }
}
