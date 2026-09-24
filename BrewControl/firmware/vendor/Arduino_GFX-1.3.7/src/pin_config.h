// Stand-in for LilyGo's libraries/Mylibrary/pin_config.h.
//
// Arduino_TFT.cpp includes it only to pick the panel variant: the CO5300 on
// the T-Display-S3-AMOLED-1.75 accepts address windows no smaller than 2x2.
// Pins live in BrewControl's src/display/DisplayUI.h, not here.
#pragma once

#define H0175Y003AM  // 1.75" round, CO5300 + CST9217
