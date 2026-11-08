#include "CH422G.h"

#if defined(ARDUINO)
  #include <Arduino.h>
  #include <Wire.h>
#endif

#include <mutex>

namespace SensActCtrl {

namespace {
constexpr uint8_t kAddrSet = 0x24;  // system parameter
constexpr uint8_t kAddrOc  = 0x23;  // OC0..OC3 outputs
constexpr uint8_t kAddrIo  = 0x38;  // IO0..IO7 outputs
constexpr uint8_t kAddrIn  = 0x26;  // IO0..IO7 inputs

constexpr uint8_t kSetIoOe = 1u << 0;  // 1 = IO0..IO7 are outputs
constexpr uint32_t kInputSettleMs = 2;  // the chip needs this long to switch to input

// Power-up state of the chip: IO inputs, OC push-pull, all latches high.
struct Shadow {
  uint8_t set = 0x00;
  uint8_t oc = 0x0F;
  uint8_t io = 0xFF;
  uint8_t pins = 0xFF;
  bool pinsOk = false;
  bool pinsFetched = false;
  uint32_t pinsAtMs = 0;
};

Shadow& shadow() {
  static Shadow s;
  return s;
}

std::mutex& mutex() {
  static std::mutex m;
  return m;
}

uint32_t nowMs() {
#if defined(ARDUINO)
  return millis();
#else
  return ch422gTestState().nowMs;
#endif
}

bool writeByte(TwoWire& bus, uint8_t addr, uint8_t value) {
#if defined(ARDUINO)
  bus.beginTransmission(addr);
  bus.write(value);
  return bus.endTransmission() == 0;
#else
  (void)bus;
  CH422GTestState& s = ch422gTestState();
  ++s.writes;
  if (!s.ack) return false;
  if (addr == kAddrSet) s.set = value;
  else if (addr == kAddrOc) s.oc = value;
  else if (addr == kAddrIo) s.io = value;
  return true;
#endif
}

bool readByte(TwoWire& bus, uint8_t& value) {
#if defined(ARDUINO)
  if (bus.requestFrom(kAddrIn, static_cast<uint8_t>(1)) != 1) return false;
  value = static_cast<uint8_t>(bus.read());
  return true;
#else
  (void)bus;
  CH422GTestState& s = ch422gTestState();
  ++s.reads;
  if (!s.ack) return false;
  value = s.pins;
  return true;
#endif
}
}  // namespace

CH422G::CH422G(TwoWire& bus) : bus_(&bus) {}

bool CH422G::begin() {
  std::lock_guard<std::mutex> lock(mutex());
  uint8_t v = 0;
  return readByte(*bus_, v);
}

bool CH422G::pinMode(uint8_t ch, Mode m) {
  if (ch >= kChannels) return false;
  // The OC pins are always outputs; only the IO pins have a direction.
  if (m != Mode::Output || ch >= kIoChannels) return true;
  std::lock_guard<std::mutex> lock(mutex());
  Shadow& s = shadow();
  s.set |= kSetIoOe;
  return writeByte(*bus_, kAddrSet, s.set);
}

bool CH422G::write(uint8_t ch, bool high) {
  if (ch >= kChannels) return false;
  std::lock_guard<std::mutex> lock(mutex());
  Shadow& s = shadow();
  uint8_t& latch = ch < kIoChannels ? s.io : s.oc;
  const uint8_t bit = static_cast<uint8_t>(1u << (ch % kIoChannels));
  if (high) latch |= bit;
  else latch &= ~bit;
  return writeByte(*bus_, ch < kIoChannels ? kAddrIo : kAddrOc, latch);
}

bool CH422G::read(uint8_t ch, bool& high) {
  if (ch >= kChannels) return false;
  std::lock_guard<std::mutex> lock(mutex());
  Shadow& s = shadow();
  if (ch >= kIoChannels) {  // OC pins cannot be read: report the latch
    high = (s.oc >> (ch - kIoChannels)) & 1u;
    return true;
  }
  const uint32_t now = nowMs();
  if (!s.pinsFetched || now - s.pinsAtMs >= kReadCacheMs) {
    // Output pins read back what they drive, so the pins go to input for the
    // one transfer; the latches keep their value meanwhile. Whatever sits on
    // an output pin (reset, backlight, SD chip select) floats for that long.
    const bool wasOutput = (s.set & kSetIoOe) != 0;
    if (wasOutput) {
      writeByte(*bus_, kAddrSet, s.set & ~kSetIoOe);
#if defined(ARDUINO)
      delay(kInputSettleMs);  // Waveshare's demo waits as long; before it the pins still read the latch
#endif
    }
    s.pinsOk = readByte(*bus_, s.pins);
    if (wasOutput && !writeByte(*bus_, kAddrSet, s.set)) s.pinsOk = false;
    s.pinsFetched = true;
    s.pinsAtMs = now;
  }
  if (!s.pinsOk) return false;
  high = (s.pins >> ch) & 1u;
  return true;
}

#ifndef ARDUINO
CH422GTestState& ch422gTestState() {
  static CH422GTestState state;
  return state;
}

void ch422gResetShadow() {
  shadow() = Shadow{};
}
#endif

}  // namespace SensActCtrl
