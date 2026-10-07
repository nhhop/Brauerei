#pragma once

class TwoWire;

namespace BrewControl {

// Board-specific bring-up on the board's own I2C bus, once per boot right after
// main.cpp has claimed that bus and before the display starts. A no-op on
// boards without anything to do there.
//
// M5Stack StopWatch: the M5PM1 power manager (0x6E) and the M5IOE1 expander
// (0x4F) sit between the ESP32-S3 and the display - panel supply and the panel
// and touch reset lines are expander pins. Sequence as in M5GFX's StopWatch
// autodetect (src/M5GFX.cpp), which is the only working reference.
void boardInit(TwoWire& wire);

}  // namespace BrewControl
