#pragma once

#include <ArduinoJson.h>

#include <cstdint>
#include <cstring>
#include <string>
#include <vector>

namespace BrewControl {

// GPIO bookkeeping for dynamic items: which pins a board has, which of them
// are off limits or a bad idea, and which ones the configured items occupy.
// Header-only and Arduino-free so the checks run in the native tests; the
// concrete board tables live in BoardPins.h.
//
// A pin's role is not predefined — the first item or bus that picks a free
// pin owns it; anything else on the same pin is a conflict. Shared lines
// (OneWire, SPI, I2C) belong to a bus definition (BusConfig.h), which the
// items on it reference by id instead of repeating the pins.

enum class PinClass : uint8_t {
  Free,
  Forbidden,  // wired to flash/PSRAM — using it crashes the chip
  Reserved,   // taken by the board itself (SD, display, I2C, BOOT button)
  Risky,      // works, but has a side job (strapping, USB, UART0, ADC divider)
};

struct PinDef {
  uint8_t gpio;
  PinClass cls;
  const char* note;
};

struct Board {
  uint64_t exists;     // bit n set = GPIO n exists on this chip
  uint64_t inputOnly;
  uint64_t dac;
  const PinDef* special;
  size_t specialCount;
  uint8_t rmtTx;       // RMT channels that can transmit (one per IDS cooker)
  uint64_t adc1;
  uint64_t adc2;
  uint64_t noPullup;   // no internal pull-up (INPUT_PULLUP does nothing)
  uint64_t irqGlitch;  // spurious interrupts from a chip erratum
  bool adc2BlockedByWifi;  // true: ADC2 reads fail while Wi-Fi runs (ESP32);
                           // false: shared with Wi-Fi, single reads may fail
  // Arduino's default Wire pins. BME280/GY521 configs from before buses were
  // configurable sat there implicitly; BusConfig.h migrates them onto an I2C
  // bus with these pins (unless the board has a fixed I2C bus).
  int i2cSda;
  int i2cScl;
  // Onboard battery voltage divider, -1 = none. Only a preset for the
  // battery sensor the energy settings page offers to create.
  // Divider resistors in kΩ: R1 from the battery to the pin, R2 to GND.
  int batteryPin = -1;
  float batteryR1 = 0;
  float batteryR2 = 0;
};

struct PinUse {
  std::string item;  // item id, or bus id when bus is set
  const char* key;   // config key, a string literal
  int gpio;
  bool bus;          // a line of a bus definition (BusConfig.h)
  bool output;
  bool rmt;         // occupies an RMT TX channel
  bool analog;      // read with analogRead()
  bool pullup;      // relies on the internal pull-up
  bool irq;         // attachInterrupt() on this pin
};

struct PinCheck {
  bool ok = true;
  int status = 200;  // 400 invalid pin, 409 pin taken / no RMT channel left
  std::string error;
  std::vector<std::string> warnings;  // risky pins and weak capabilities, for the UI to confirm
};

struct PinConflict {
  int gpio;
  std::string reason;
  std::vector<const PinUse*> users;
};

constexpr uint64_t pinBit(int gpio) {
  return (gpio >= 0 && gpio < 64) ? (uint64_t{1} << gpio) : 0;
}

constexpr uint64_t pinRange(int from, int to) {
  uint64_t m = 0;
  for (int g = from; g <= to; ++g) m |= pinBit(g);
  return m;
}

inline bool pinExists(const Board& b, int gpio) {
  return (b.exists & pinBit(gpio)) != 0;
}

// Class and note of a GPIO, not counting what the items use.
inline PinClass classifyPin(const Board& b, int gpio, const char** note = nullptr) {
  for (size_t i = 0; i < b.specialCount; ++i) {
    if (b.special[i].gpio == gpio) {
      if (note) *note = b.special[i].note;
      return b.special[i].cls;
    }
  }
  if (note) *note = "";
  return PinClass::Free;
}

// Why an analog input cannot work on gpio, or nullptr if it can. Wi-Fi is
// always on in BrewControl (station or setup AP).
inline const char* adcProblem(const Board& b, int gpio) {
  if (b.adc1 & pinBit(gpio)) return nullptr;
  if (!(b.adc2 & pinBit(gpio))) return "kein ADC";
  return b.adc2BlockedByWifi ? "ADC2 – bei WLAN nicht nutzbar" : nullptr;
}

inline const char* pinClassName(PinClass c) {
  switch (c) {
    case PinClass::Forbidden: return "forbidden";
    case PinClass::Reserved:  return "reserved";
    case PinClass::Risky:     return "risky";
    default:                  return "free";
  }
}

// Appends the GPIOs one item config occupies. Keys mirror
// DynamicItems::add{Sensor,Actuator}NoBegin; types without pins of their own
// (remote, MQTT, controllers, BME280/GY521/DS18B20 on a bus) add nothing.
// Bus lines are counted once, for the bus (BusConfig.h busPinUses).
inline void collectPins(JsonObjectConst cfg, std::vector<PinUse>& out) {
  const char* type = cfg["type"] | "";
  const char* id   = cfg["id"]   | "";
  enum : uint8_t { Out = 1, Rmt = 2, Analog = 4, Pullup = 8, Irq = 16 };
  auto add = [&](const char* key, uint8_t f = 0) {
    if (!cfg[key].is<int>()) return;
    const int gpio = cfg[key].as<int>();
    if (gpio < 0) return;
    out.push_back({id, key, gpio, false, (f & Out) != 0, (f & Rmt) != 0,
                   (f & Analog) != 0, (f & Pullup) != 0, (f & Irq) != 0});
  };
  auto is = [&](const char* t) { return strcmp(type, t) == 0; };

  if (is("MAX31865")) {
    add("cs", Out);
  } else if (is("YF-S201")) {
    add("pin", Pullup | Irq);
  } else if (is("DigitalInput")) {
    add("pin", (cfg["pullup"] | false) ? Pullup : 0);
  } else if (is("AnalogInput") || is("Voltage")) {
    add("pin", Analog);
  } else if (is("HCSR04")) {
    add("trig", Out);
    add("echo", Irq);
  } else if (is("HX711")) {
    add("dout");
    add("sck", Out);
  } else if (is("DigitalOutput") || is("PulseOutput") || is("AnalogOutput")) {
    add("pin", Out);
  } else if (is("IDS1") || is("IDS2")) {
    add("pin_white", Out);
    add("pin_yellow", Out | Rmt);
    add("pin_interrupt", Pullup | Irq);
  }
}

// Number of items holding an RMT TX channel, not counting excludeItem.
inline size_t rmtItems(const std::vector<PinUse>& uses, const std::string& excludeItem = "") {
  std::vector<std::string> seen;
  for (const PinUse& u : uses) {
    if (!u.rmt || u.item == excludeItem) continue;
    bool dup = false;
    for (const auto& s : seen) dup |= (s == u.item);
    if (!dup) seen.push_back(u.item);
  }
  return seen.size();
}

// Checks the pins of one new or replacing item or bus (mine) against the
// board and the pins already in use. replaceId names the item or bus being
// replaced, whose own pins do not count as taken.
inline PinCheck checkPinUses(const Board& b, const std::vector<PinUse>& uses,
                             const std::vector<PinUse>& mine, const char* replaceId = "") {
  PinCheck r;
  auto fail = [&](int status, const std::string& msg) {
    r.ok = false;
    r.status = status;
    r.error = msg;
    return r;
  };
  const std::string replace = replaceId ? replaceId : "";

  for (size_t i = 0; i < mine.size(); ++i) {
    const PinUse& u = mine[i];
    const std::string g = "GPIO " + std::to_string(u.gpio);
    if (!pinExists(b, u.gpio)) return fail(400, g + " does not exist on this board");
    const char* note = "";
    const PinClass cls = classifyPin(b, u.gpio, &note);
    if (cls == PinClass::Forbidden) return fail(400, g + " is not usable (" + note + ")");
    if (cls == PinClass::Reserved) return fail(409, g + " is reserved by the board (" + note + ")");
    if (u.output && (b.inputOnly & pinBit(u.gpio)))
      return fail(400, g + " is input-only (" + u.key + ")");
    for (size_t j = 0; j < i; ++j) {
      if (mine[j].gpio == u.gpio)
        return fail(400, g + " used twice (" + mine[j].key + ", " + u.key + ")");
    }
    for (const PinUse& e : uses) {
      if (e.item == replace || e.gpio != u.gpio) continue;
      return fail(409, g + " already used by " + (e.bus ? "bus " : "") + e.item +
                           " (" + e.key + ")");
    }
    if (u.analog) {
      if (!(b.adc1 & pinBit(u.gpio)) && !(b.adc2 & pinBit(u.gpio)))
        return fail(400, g + " has no ADC");
      if (adcProblem(b, u.gpio)) return fail(400, g + " is on ADC2, which Wi-Fi blocks");
    }
    if (cls == PinClass::Risky) r.warnings.push_back(g + ": " + note);
    if (u.analog && (b.adc2 & pinBit(u.gpio)))
      r.warnings.push_back(g + ": ADC2 – Messung kann bei WLAN-Verkehr ausfallen");
    if (u.pullup && (b.noPullup & pinBit(u.gpio)))
      r.warnings.push_back(g + ": kein interner Pull-up – externen Widerstand vorsehen");
    if (u.irq && (b.irqGlitch & pinBit(u.gpio)))
      r.warnings.push_back(g + ": Fehlauslöser möglich (ESP32-Errata)");
  }

  bool needsRmt = false;
  for (const PinUse& u : mine) needsRmt |= u.rmt;
  if (needsRmt && rmtItems(uses, replace) >= b.rmtTx)
    return fail(409, "no free RMT channel (" + std::to_string(b.rmtTx) + " in use)");

  return r;
}

// Checks a new or replacing item config against the board and the pins
// already in use (see checkPinUses).
inline PinCheck checkItemPins(const Board& b, const std::vector<PinUse>& uses,
                              JsonObjectConst cfg, const char* replaceId = "") {
  std::vector<PinUse> mine;
  collectPins(cfg, mine);
  PinCheck r = checkPinUses(b, uses, mine, replaceId);
  if (!r.ok) return r;

  const char* type = cfg["type"] | "";
  if (strcmp(type, "AnalogOutput") == 0 && strcmp(cfg["mode"] | "", "dac") == 0) {
    const int pin = cfg["pin"] | -1;
    if (!(b.dac & pinBit(pin))) {
      r.ok = false;
      r.status = 400;
      r.error = b.dac ? "GPIO " + std::to_string(pin) + " has no DAC"
                      : std::string("this board has no DAC");
    }
  }
  return r;
}

// Conflicts already present in a loaded config: two users on one
// GPIO, an item on a pin the board reserves or forbids, or an analog input
// without a usable ADC (reason is shown in the UI as is). Risky pins are not
// conflicts — the pin list shows them.
inline std::vector<PinConflict> findPinConflicts(const Board& b,
                                                 const std::vector<PinUse>& uses) {
  std::vector<PinConflict> out;
  auto entry = [&](int gpio, const std::string& reason) -> PinConflict& {
    for (auto& c : out)
      if (c.gpio == gpio && c.reason == reason) return c;
    out.push_back({gpio, reason, {}});
    return out.back();
  };
  auto addUser = [](PinConflict& c, const PinUse* u) {
    for (const PinUse* x : c.users) if (x == u) return;
    c.users.push_back(u);
  };
  for (size_t i = 0; i < uses.size(); ++i) {
    const PinUse& u = uses[i];
    const char* note = "";
    const PinClass cls = classifyPin(b, u.gpio, &note);
    if (!pinExists(b, u.gpio)) {
      addUser(entry(u.gpio, "existiert auf diesem Board nicht"), &u);
    } else if (cls == PinClass::Forbidden || cls == PinClass::Reserved) {
      addUser(entry(u.gpio, note), &u);
    } else if (u.analog && adcProblem(b, u.gpio)) {
      addUser(entry(u.gpio, adcProblem(b, u.gpio)), &u);
    }
    for (size_t j = 0; j < i; ++j) {
      const PinUse& e = uses[j];
      if (e.gpio != u.gpio) continue;
      PinConflict& c = entry(u.gpio, "mehrfach belegt");
      addUser(c, &e);
      addUser(c, &u);
    }
  }
  return out;
}

// GET /api/pins body: every GPIO the chip has, with class, capabilities and
// the items using it, plus the conflicts found in the current config.
inline void writePinsJson(const Board& b, const char* boardName,
                          const std::vector<PinUse>& uses, JsonObject out) {
  out["board"] = boardName;
  JsonObject caps = out["caps"].to<JsonObject>();
  caps["dac"] = b.dac != 0;
  caps["rmtTx"] = b.rmtTx;
  caps["rmtUsed"] = rmtItems(uses);
  caps["adc2Wifi"] = b.adc2BlockedByWifi ? "blocked" : "shared";
  if (b.batteryPin >= 0) {
    JsonObject bat = out["battery"].to<JsonObject>();
    bat["gpio"] = b.batteryPin;
    bat["r1"] = b.batteryR1;
    bat["r2"] = b.batteryR2;
  }

  auto writeUsers = [](JsonArray arr, const PinUse& u) {
    JsonObject o = arr.add<JsonObject>();
    o["id"] = u.item;
    o["key"] = u.key;
    if (u.bus) o["bus"] = true;
  };

  JsonArray pins = out["pins"].to<JsonArray>();
  for (int g = 0; g < 64; ++g) {
    if (!pinExists(b, g)) continue;
    const char* note = "";
    const PinClass cls = classifyPin(b, g, &note);
    JsonObject p = pins.add<JsonObject>();
    p["gpio"] = g;
    p["class"] = pinClassName(cls);
    if (note[0]) p["note"] = note;
    if (b.inputOnly & pinBit(g)) p["inputOnly"] = true;
    if (b.dac & pinBit(g)) p["dac"] = true;
    if (b.adc1 & pinBit(g)) p["adc"] = 1;
    if (b.adc2 & pinBit(g)) p["adc"] = 2;
    if (b.noPullup & pinBit(g)) p["noPullup"] = true;
    if (b.irqGlitch & pinBit(g)) p["irqGlitch"] = true;
    JsonArray users = p["users"].to<JsonArray>();
    for (const PinUse& u : uses)
      if (u.gpio == g) writeUsers(users, u);
  }

  JsonArray conflicts = out["conflicts"].to<JsonArray>();
  for (const PinConflict& c : findPinConflicts(b, uses)) {
    JsonObject o = conflicts.add<JsonObject>();
    o["gpio"] = c.gpio;
    o["reason"] = c.reason;
    JsonArray users = o["users"].to<JsonArray>();
    for (const PinUse* u : c.users) writeUsers(users, *u);
  }
}

}  // namespace BrewControl
