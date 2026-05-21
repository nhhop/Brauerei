// BME280 logger: one I2C chip exposed as three Sensor channels
// (temperature, humidity, pressure). No actuator, no controller — pure
// sensorik. Default ESP32 I2C pins (SDA=21, SCL=22), default BME280
// address 0x76 (some breakouts strap SDO HIGH → 0x77; pass that to the
// BME280Bus ctor if so).

#include <Wire.h>

#include <SensActCtrl.h>
using namespace SensActCtrl;

BME280Bus bus(0x76);
BME280Sensor ambT("amb_t", bus, BME280Sensor::Measurement::Temperature);
BME280Sensor ambH("amb_h", bus, BME280Sensor::Measurement::Humidity);
BME280Sensor ambP("amb_p", bus, BME280Sensor::Measurement::Pressure);

Registry registry;
uint32_t nextLogMs = 0;

void setup() {
  Serial.begin(115200);
  delay(200);

  Wire.begin();

  registry.add(&ambT);
  registry.add(&ambH);
  registry.add(&ambP);
  registry.begin();

  Serial.println(F("04_bme280_logger ready"));
}

void loop() {
  registry.tick();

  const uint32_t now = millis();
  if (now >= nextLogMs) {
    nextLogMs = now + 1000;
    const auto t = ambT.channel(0).reading;
    const auto h = ambH.channel(0).reading;
    const auto p = ambP.channel(0).reading;
    Serial.printf("t=%lu T=%.2f\xc2\xb0""C  RH=%.1f%%  P=%.2fhPa  valid=%d\n",
                  (unsigned long)now, t.value, h.value, p.value, t.valid);
  }
}
