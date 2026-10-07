#include "BoardInit.h"

#include <Arduino.h>
#include <Wire.h>

namespace BrewControl {

#if defined(BREWCTL_BOARD_M5_STOPWATCH)
namespace {

constexpr uint8_t kPm1Addr = 0x6E;   // M5PM1 power manager
constexpr uint8_t kIoe1Addr = 0x4F;  // M5IOE1 I/O expander

// M5PM1 registers.
constexpr uint8_t kPm1PwrCfg = 0x06;  // bits 0x17: LED control, 3.3 V LDO, 3.3 V DC/DC, charging
constexpr uint8_t kPm1I2cCfg = 0x09;  // 0 = no I2C idle sleep
constexpr uint8_t kPm1WdtCnt = 0x0A;  // 0 = watchdog off

// M5IOE1 registers; "L" covers expander pins IO1..IO8 (bit n = IO(n+1)),
// "H" IO9..IO16.
constexpr uint8_t kIoeModeL = 0x03;  // 1 = output
constexpr uint8_t kIoeModeH = 0x04;
constexpr uint8_t kIoeOutL = 0x05;
constexpr uint8_t kIoeOutH = 0x06;
constexpr uint8_t kIoeDrvL = 0x13;   // 0 = push-pull
constexpr uint8_t kIoeDrvH = 0x14;
constexpr uint8_t kIoeI2cCfg = 0x23;  // 0 = no I2C idle sleep

// IO1 mux control, IO3 audio enable, IO4 touch reset, IO5 panel reset,
// IO8 panel supply (L3B_EN).
constexpr uint8_t kIoeOutputs = 0b10011101;
constexpr uint8_t kIoeHigh = 0b10011001;    // all of them high but audio
constexpr uint8_t kIoeResets = 0b00011000;  // IO4, IO5
constexpr uint8_t kIoePaH = 0b00000010;     // IO10: speaker amplifier

// Both chips sleep between I2C transactions until told otherwise; the first
// access after power-up may go unanswered, so it is retried for a while.
bool writeReg(TwoWire& w, uint8_t addr, uint8_t reg, uint8_t value, uint32_t retryMs = 0) {
  const uint32_t start = millis();
  do {
    w.beginTransmission(addr);
    w.write(reg);
    w.write(value);
    if (w.endTransmission() == 0) return true;
    delay(1);
  } while (millis() - start < retryMs);
  return false;
}

bool readReg(TwoWire& w, uint8_t addr, uint8_t reg, uint8_t& value) {
  w.beginTransmission(addr);
  w.write(reg);
  if (w.endTransmission(false) != 0) return false;
  if (w.requestFrom(addr, static_cast<uint8_t>(1)) != 1) return false;
  value = static_cast<uint8_t>(w.read());
  return true;
}

bool setBits(TwoWire& w, uint8_t addr, uint8_t reg, uint8_t mask, bool on) {
  uint8_t v = 0;
  if (!readReg(w, addr, reg, v)) return false;
  return writeReg(w, addr, reg, on ? (v | mask) : (v & ~mask));
}

}  // namespace

void boardInit(TwoWire& wire) {
  bool ok = writeReg(wire, kPm1Addr, kPm1I2cCfg, 0x00, 200) &&
            writeReg(wire, kPm1Addr, kPm1WdtCnt, 0x00) &&
            setBits(wire, kPm1Addr, kPm1PwrCfg, 0x17, true);
  ok = writeReg(wire, kIoe1Addr, kIoeI2cCfg, 0x00, 200) &&
       setBits(wire, kIoe1Addr, kIoeDrvL, kIoeOutputs, false) &&
       setBits(wire, kIoe1Addr, kIoeModeL, kIoeOutputs, true) &&
       setBits(wire, kIoe1Addr, kIoeOutL, kIoeHigh, true) && ok;
  delay(10);
  // Reset panel and touch.
  ok = setBits(wire, kIoe1Addr, kIoeOutL, kIoeResets, false) && ok;
  delay(8);
  ok = setBits(wire, kIoe1Addr, kIoeOutL, kIoeResets, true) && ok;
  delay(2);
  // Speaker amplifier off.
  ok = setBits(wire, kIoe1Addr, kIoeDrvH, kIoePaH, false) &&
       setBits(wire, kIoe1Addr, kIoeModeH, kIoePaH, true) &&
       setBits(wire, kIoe1Addr, kIoeOutH, kIoePaH, false) && ok;
  Serial.printf("Board: M5PM1/M5IOE1 init %s\n", ok ? "ok" : "FAILED");
}
#else
void boardInit(TwoWire&) {}
#endif

}  // namespace BrewControl
