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
// A pin's role is not predefined — the first item that picks a free pin owns
// it. Items of the same shareable kind may join (several DS18B20 on one
// OneWire pin, MAX31865 sharing SCK/MISO/MOSI); anything else is a conflict.

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
};

enum class Share : uint8_t { None, OneWire, Spi };

struct PinUse {
  std::string item;
  const char* key;  // config key, a string literal
  int gpio;
  Share share;
  bool output;
  bool rmt;         // occupies an RMT TX channel
};

struct PinCheck {
  bool ok = true;
  int status = 200;  // 400 invalid pin, 409 pin taken / no RMT channel left
  std::string error;
  std::vector<std::string> warnings;  // risky pins, for the UI to confirm
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

inline const char* pinClassName(PinClass c) {
  switch (c) {
    case PinClass::Forbidden: return "forbidden";
    case PinClass::Reserved:  return "reserved";
    case PinClass::Risky:     return "risky";
    default:                  return "free";
  }
}

// Appends the GPIOs one item config occupies. Keys mirror
// DynamicItems::add{Sensor,Actuator}NoBegin; types without pins (I2C, remote,
// MQTT, controllers) add nothing.
inline void collectPins(JsonObjectConst cfg, std::vector<PinUse>& out) {
  const char* type = cfg["type"] | "";
  const char* id   = cfg["id"]   | "";
  auto add = [&](const char* key, Share share, bool output, bool rmt = false) {
    if (!cfg[key].is<int>()) return;
    const int gpio = cfg[key].as<int>();
    if (gpio < 0) return;
    out.push_back({id, key, gpio, share, output, rmt});
  };
  auto is = [&](const char* t) { return strcmp(type, t) == 0; };

  if (is("DS18B20")) {
    add("pin", Share::OneWire, false);
  } else if (is("MAX31865")) {
    add("cs", Share::None, true);
    add("clk", Share::Spi, true);
    add("miso", Share::Spi, false);
    add("mosi", Share::Spi, true);
  } else if (is("YF-S201") || is("DigitalInput") || is("AnalogInput")) {
    add("pin", Share::None, false);
  } else if (is("HCSR04")) {
    add("trig", Share::None, true);
    add("echo", Share::None, false);
  } else if (is("HX711")) {
    add("dout", Share::None, false);
    add("sck", Share::None, true);
  } else if (is("DigitalOutput") || is("PulseOutput") || is("AnalogOutput")) {
    add("pin", Share::None, true);
  } else if (is("IDS1") || is("IDS2")) {
    add("pin_white", Share::None, true);
    add("pin_yellow", Share::None, true, /*rmt=*/true);
    add("pin_interrupt", Share::None, false);
  }
}

inline bool pinsCompatible(const PinUse& a, const PinUse& b) {
  return a.share != Share::None && a.share == b.share;
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

// Checks a new or replacing item config against the board and the pins
// already in use. replaceId names the item being replaced, whose own pins do
// not count as taken.
inline PinCheck checkItemPins(const Board& b, const std::vector<PinUse>& uses,
                              JsonObjectConst cfg, const char* replaceId = "") {
  PinCheck r;
  auto fail = [&](int status, const std::string& msg) {
    r.ok = false;
    r.status = status;
    r.error = msg;
    return r;
  };
  const std::string replace = replaceId ? replaceId : "";

  std::vector<PinUse> mine;
  collectPins(cfg, mine);

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
      if (mine[j].gpio == u.gpio && !pinsCompatible(mine[j], u))
        return fail(400, g + " used twice (" + mine[j].key + ", " + u.key + ")");
    }
    for (const PinUse& e : uses) {
      if (e.item == replace || e.gpio != u.gpio || pinsCompatible(e, u)) continue;
      return fail(409, g + " already used by " + e.item + " (" + e.key + ")");
    }
    if (cls == PinClass::Risky) {
      bool dup = false;
      for (size_t j = 0; j < i; ++j) dup |= (mine[j].gpio == u.gpio);
      if (!dup) r.warnings.push_back(g + ": " + note);
    }
  }

  const char* type = cfg["type"] | "";
  if (strcmp(type, "AnalogOutput") == 0 && strcmp(cfg["mode"] | "", "dac") == 0) {
    const int pin = cfg["pin"] | -1;
    if (!(b.dac & pinBit(pin)))
      return fail(400, b.dac ? "GPIO " + std::to_string(pin) + " has no DAC"
                             : std::string("this board has no DAC"));
  }

  bool needsRmt = false;
  for (const PinUse& u : mine) needsRmt |= u.rmt;
  if (needsRmt && rmtItems(uses, replace) >= b.rmtTx)
    return fail(409, "no free RMT channel (" + std::to_string(b.rmtTx) + " in use)");

  return r;
}

// Conflicts already present in a loaded config: two incompatible items on one
// GPIO, or an item on a pin the board reserves or forbids (reason is shown in
// the UI as is). Risky pins are not conflicts — the pin list shows them.
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
    }
    for (size_t j = 0; j < i; ++j) {
      const PinUse& e = uses[j];
      if (e.gpio != u.gpio || pinsCompatible(e, u)) continue;
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

  auto writeUsers = [](JsonArray arr, const PinUse& u) {
    JsonObject o = arr.add<JsonObject>();
    o["id"] = u.item;
    o["key"] = u.key;
    if (u.share == Share::OneWire) o["share"] = "onewire";
    if (u.share == Share::Spi) o["share"] = "spi";
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
