#pragma once

class TwoWire;

namespace BrewControl {

// Board-specific bring-up on the board's own I2C bus, once per boot right after
// main.cpp has claimed that bus and before the display starts. A no-op on
// boards without anything to do there.
//
// Waveshare ESP32-S3-Touch-LCD-5B: the CH422G expander (0x23/0x24/0x26/0x38)
// holds the touch and panel reset, the backlight and the SD chip select, so it
// has to be set up before the SD mount.
void boardInit(TwoWire& wire);

}  // namespace BrewControl
