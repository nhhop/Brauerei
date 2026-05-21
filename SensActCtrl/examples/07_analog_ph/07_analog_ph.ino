// pH probe via analog input. Calibrate by reading raw ADC at pH 4.0 and
// pH 7.0 buffer solutions; enter those rawValues below.

#include <SensActCtrl.h>
using namespace SensActCtrl;

constexpr int kPhPin = 34;

// Replace with your own two-point calibration measurements.
constexpr int kRawAtPh4 = 2900;
constexpr int kRawAtPh7 = 2050;

AnalogInputSensor ph("ph", kPhPin);
Registry registry;
uint32_t nextLogMs = 0;

void setup() {
  Serial.begin(115200);
  delay(200);

#ifdef ESP32
  ph.setAttenuation(ADC_11db);
#endif
  // Two-point linear: extrapolate to 0..14 pH from the two calibration
  // points (so we can report values outside the typical buffer range
  // without clamping).
  ph.setCalibration(kRawAtPh4, kRawAtPh7, 4.0f, 7.0f);
  ph.setMeta(Quantity::pH, "pH", 0.0f, 14.0f, 0.01f);
  ph.setSmoothing(8);

  registry.add(&ph);
  registry.begin();
  Serial.println(F("07_analog_ph ready"));
}

void loop() {
  registry.tick();

  const uint32_t now = millis();
  if (now >= nextLogMs) {
    nextLogMs = now + 500;
    Serial.printf("pH=%.2f\n", ph.channel(0).reading.value);
  }
}
