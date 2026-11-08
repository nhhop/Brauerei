#include "BoardInit.h"

#include <Arduino.h>
#include <Wire.h>

#if defined(BREWCTL_BOARD_WAVESHARE_LCD5B)
#include <SensActCtrl.h>
#endif

namespace BrewControl {

#if defined(BREWCTL_BOARD_WAVESHARE_LCD5B)
void boardInit(TwoWire& wire) {
  // CH422G pins: EXIO1 touch reset, EXIO2 backlight, EXIO3 panel reset, EXIO4
  // SD chip select (low = selected, kept that way: the SD library only gets a
  // dummy GPIO for it), OD0/OD1 the outputs DO0/DO1 (start at 1, the chip's and
  // Waveshare's default; the polarity is unverified). Latches first, so the
  // pins come up in this state when the direction flips.
  SensActCtrl::CH422G io(wire);
  bool ok = io.begin();
  ok = io.write(1, true) && ok;
  ok = io.write(2, false) && ok;  // no picture yet: backlight off
  ok = io.write(3, true) && ok;
  ok = io.write(4, false) && ok;
  ok = io.write(8, true) && ok;
  ok = io.write(9, true) && ok;
  ok = io.pinMode(0, SensActCtrl::GpioPort::Mode::Output) && ok;
#ifdef BREWCTL_HAS_DISPLAY
  // GT911: INT (GPIO 4) low while the reset is released selects address 0x5D.
  pinMode(4, OUTPUT);
  digitalWrite(4, LOW);
  ok = io.write(1, false) && ok;
  delay(10);
  ok = io.write(1, true) && ok;
  delay(6);
  pinMode(4, INPUT);
  // Panel reset pulse; the driver starts the panel afterwards.
  ok = io.write(3, false) && ok;
  delay(10);
  ok = io.write(3, true) && ok;
  delay(60);
#endif
  Serial.printf("Board: CH422G init %s\n", ok ? "ok" : "FAILED");
}
#else
void boardInit(TwoWire&) {}
#endif

}  // namespace BrewControl
