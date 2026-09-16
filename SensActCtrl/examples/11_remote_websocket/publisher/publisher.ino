// 11_remote_websocket / publisher
//
// Same shape as 08/09/10 but transported over a persistent WebSocket. This
// node is the *client*: it dials out to the consumer (the hub), which runs
// the WebSocket server. No broker, and the hub doesn't need to know this
// node's address — any number of publishers can connect to the same hub.
//
// State/meta flow to the hub, /set commands for the heater come back over
// the same connection.

#include <WiFi.h>

#include <SensActCtrl.h>
using namespace SensActCtrl;

constexpr const char* kWifiSsid  = "YOUR_SSID";
constexpr const char* kWifiPass  = "YOUR_PASSWORD";
constexpr const char* kServerUrl = "ws://192.168.1.51:8081";  // consumer (hub)
constexpr const char* kDeviceId  = "node-a";

constexpr int kOneWirePin = 4;
constexpr int kHeaterPin  = 16;

WebSocketTransport tx(kServerUrl);

DS18B20Sensor mashTemp("mash_temp", kOneWirePin);
DigitalOutputActuator heater("heater", kHeaterPin,
                             DigitalOutputActuator::Mode::TimeProportional);

Registry registry;
RemotePublisher publisher(tx, kDeviceId);

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

  heater.setPeriodMs(2000);

  registry.add(&mashTemp);
  registry.add(&heater);
  registry.begin();

  publisher.attach(mashTemp);
  publisher.attach(heater);
  publisher.begin();

  Serial.println(F("11 publisher (WebSocket client) ready"));
}

void loop() {
  registry.tick();
  tx.tick();
  publisher.tick();

  const uint32_t now = millis();
  if (now >= nextLogMs) {
    nextLogMs = now + 1000;
    Serial.printf("T=%.2f heater=%.2f connected=%d %s\n",
                  mashTemp.channel(0).reading.value, heater.state(),
                  tx.connected(), tx.lastErrorMessage());
  }
}
