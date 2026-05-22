// BME280 logger: one sensor instance with three channels
// (temperature, humidity, pressure). Default ESP32 I2C pins (SDA=21, SCL=22).
// Some breakouts strap SDO HIGH → address 0x77; pass that to the constructor.

#include <Wire.h>

#include <SensActCtrl.h>
using namespace SensActCtrl;

BME280Sensor bme("amb", 0x76);

Registry registry;
uint32_t nextLogMs = 0;

void setup() {
  Serial.begin(115200);
  delay(200);

  Wire.begin();

  registry.add(&bme);
  registry.begin();

  Serial.println(F("04_bme280_logger ready"));
}

void loop() {
  registry.tick();

  const uint32_t now = millis();
  if (now >= nextLogMs) {
    nextLogMs = now + 1000;
    const auto t = bme.channel(0).reading;
    const auto h = bme.channel(1).reading;
    const auto p = bme.channel(2).reading;
    Serial.printf("t=%lu T=%.2f\xc2\xb0""C  RH=%.1f%%  P=%.2fhPa  valid=%d\n",
                  (unsigned long)now, t.value, h.value, p.value, t.valid);
  }
}
