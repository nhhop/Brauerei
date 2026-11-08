// Compile and link check against Arduino Core 2 (ESP-IDF 4.4), built by
// `pio run -e esp32dev_core2` (see platformio.ini). Not an example: it only
// pulls in the classes with separate Core 2 / Core 3 code paths, so the
// linker resolves their framework calls (ledcSetup/ledcAttachPin, the IDF 4.4
// ESP-NOW callbacks). The rest of the library compiles anyway as a dependency.
#include <Arduino.h>
#include <SensActCtrl.h>

using SensActCtrl::AnalogOutputActuator;
using SensActCtrl::EspNowTransport;

static AnalogOutputActuator pwm("pwm", 25);
static AnalogOutputActuator dac("dac", 26, AnalogOutputActuator::Mode::Dac);
static EspNowTransport* espnow = nullptr;

void setup() {
  espnow = new EspNowTransport(1);
  pwm.begin();
  dac.begin();
  pwm.write(0.5f);
  espnow->publish("ci/core2", "{}", false);
}

void loop() {
  espnow->tick();
}
