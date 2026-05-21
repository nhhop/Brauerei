// 10_remote_webhook / publisher
//
// Same shape as 08/09 but transported over plain HTTP webhooks. Both nodes
// run a small WebServer and POST to each other's URL. No broker, no ESP-Now
// channel coordination — just two WiFi clients on the same LAN.
//
// Wire format is unchanged from MQTT/ESP-Now (same topic strings, same JSON
// payloads); the URL path carries the topic, the body carries the payload.
//
// Endpoints exposed by this node:
//   POST /<topic>   accept incoming publish (consumer -> this node)
//   GET  /<topic>   return last retained payload (late-subscriber pull)

#include <WiFi.h>

#include <SensActCtrl.h>
using namespace SensActCtrl;

constexpr const char* kWifiSsid    = "YOUR_SSID";
constexpr const char* kWifiPass    = "YOUR_PASSWORD";
constexpr uint16_t    kListenPort  = 8080;
constexpr const char* kPeerBaseUrl = "http://192.168.1.51:8080";  // consumer
constexpr const char* kDeviceId    = "node-a";

constexpr int kOneWirePin = 4;
constexpr int kHeaterPin  = 16;

WebhookTransport tx(kListenPort, kPeerBaseUrl);

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

  Serial.println(F("10 publisher (Webhook) ready"));
}

void loop() {
  registry.tick();
  tx.tick();
  publisher.tick();

  const uint32_t now = millis();
  if (now >= nextLogMs) {
    nextLogMs = now + 1000;
    Serial.printf("T=%.2f heater=%.2f wifi=%d\n",
                  mashTemp.channel(0).reading.value, heater.state(),
                  tx.connected());
  }
}
