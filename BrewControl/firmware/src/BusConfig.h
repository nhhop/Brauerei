#pragma once

#include <ArduinoJson.h>

#include <cstdint>
#include <cstring>
#include <initializer_list>
#include <string>
#include <vector>

#include "I2cAddressMap.h"
#include "PinMap.h"

namespace BrewControl {

// Buses as centrally defined objects: a OneWire pin, SPI lines, an I2C pair.
// Items on a bus (DS18B20, MAX31865, BME280, IMUs) reference it by id
// ("bus": "onewire-4") instead of repeating its pins. Header-only and
// Arduino-free so validation and the migration of old configs run in the
// native tests; the drivers live in DynamicItems.cpp.

constexpr size_t kMaxBusPins = 3;

// One row per bus type. CAN (tx/rx on the one TWAI controller) and RS485
// (tx/rx/de on a UART) slot in here as further rows once an item type uses
// them.
struct BusType {
  const char* type;
  const char* pins[kMaxBusPins];
  uint8_t pinCount;
  uint8_t outputMask;  // bit n set: pins[n] is driven by the ESP32
  uint8_t max;         // buses of this type the chip supports, 0 = no limit
};

inline constexpr BusType kBusTypes[] = {
    {"onewire", {"pin"}, 1, 0b1, 0},
    {"spi", {"clk", "miso", "mosi"}, 3, 0b101, 0},
    {"i2c", {"sda", "scl"}, 2, 0b11, 2},  // two controllers: Wire and Wire1
};

inline const BusType* findBusType(const char* type) {
  for (const BusType& t : kBusTypes)
    if (strcmp(t.type, type) == 0) return &t;
  return nullptr;
}

// The bus type an item type sits on, nullptr for items without a bus.
inline const char* itemBusType(const char* itemType) {
  if (strcmp(itemType, "DS18B20") == 0) return "onewire";
  if (strcmp(itemType, "MAX31865") == 0) return "spi";
  if (strcmp(itemType, "BME280") == 0 || findImuType(itemType)) return "i2c";
  return nullptr;
}

// A bus the board wires itself (LilyGo: the I2C bus of RTC, touch and PMU).
// Comes from the board table (BoardPins.h); never stored, never editable.
struct FixedBus {
  const char* id;
  const char* type;
  int pins[kMaxBusPins];
  const char* note;
  const AddrDef* reserved;  // addresses its onboard devices answer on
  size_t reservedCount;
};

struct BusDef {
  std::string id;
  std::string label;
  const BusType* type = nullptr;
  int pins[kMaxBusPins] = {-1, -1, -1};
  // I2C controller: 0 = Wire, 1 = Wire1. Chosen once when the bus is added,
  // so it never moves while items run on it.
  int port = -1;
  bool fixed = false;
  const char* note = "";
  const AddrDef* reserved = nullptr;
  size_t reservedCount = 0;
};

// "onewire-4", "spi-18-19-23", "i2c-4-5". Pins are exclusive to one bus, so
// the id is unique when the bus is added. It is only the starting value: a bus
// keeps its id when its pins change, so items and devices never need rewriting.
inline std::string busIdFor(const BusType& t, const int pins[]) {
  std::string id = t.type;
  for (uint8_t i = 0; i < t.pinCount; ++i) id += "-" + std::to_string(pins[i]);
  return id;
}

inline BusDef busFromFixed(const FixedBus& f) {
  BusDef d;
  d.id = f.id;
  d.type = findBusType(f.type);
  for (size_t i = 0; i < kMaxBusPins; ++i) d.pins[i] = f.pins[i];
  if (strcmp(f.type, "i2c") == 0) d.port = 0;
  d.fixed = true;
  d.note = f.note;
  d.reserved = f.reserved;
  d.reservedCount = f.reservedCount;
  return d;
}

// Parses a bus definition as stored and as POST/PUT /api/buses send it:
// {"type":"i2c","sda":4,"scl":5,"label":"...","port":1}. The id is derived
// from type and pins, a given "id" is ignored. "id" and "port" are only read
// back from storage (fromStorage); DynamicItems assigns the port.
inline bool parseBusDef(JsonObjectConst in, BusDef& out, std::string& err,
                        bool fromStorage = false) {
  const BusType* t = findBusType(in["type"] | "");
  if (!t) { err = "unknown bus type"; return false; }
  BusDef d;
  d.type = t;
  for (uint8_t i = 0; i < t->pinCount; ++i) {
    const char* key = t->pins[i];
    if (!in[key].is<int>() || in[key].as<int>() < 0) {
      err = std::string("missing ") + key;
      return false;
    }
    d.pins[i] = in[key].as<int>();
    for (uint8_t j = 0; j < i; ++j) {
      if (d.pins[j] == d.pins[i]) {
        err = std::string(t->pins[j]) + " and " + key + " must differ";
        return false;
      }
    }
  }
  d.label = in["label"] | "";
  if (d.label.size() > 32) { err = "label too long"; return false; }
  if (!in["port"].isNull()) {
    const int port = in["port"] | -1;
    if (strcmp(t->type, "i2c") != 0 || (port != 0 && port != 1)) {
      err = "invalid port";
      return false;
    }
    d.port = port;
  }
  const char* storedId = in["id"] | "";
  d.id = fromStorage && storedId[0] ? storedId : busIdFor(*t, d.pins);
  out = d;
  return true;
}

// The stored form (see parseBusDef). Fixed buses are never stored.
inline void writeBusDef(const BusDef& d, JsonObject out) {
  out["id"] = d.id;
  out["type"] = d.type->type;
  if (!d.label.empty()) out["label"] = d.label;
  for (uint8_t i = 0; i < d.type->pinCount; ++i) out[d.type->pins[i]] = d.pins[i];
  if (d.port >= 0) out["port"] = d.port;
}

// The GPIOs a bus occupies, with the bus as their user. A fixed bus adds
// nothing: the board table already marks its pins Reserved.
inline void busPinUses(const BusDef& d, std::vector<PinUse>& out) {
  if (d.fixed) return;
  for (uint8_t i = 0; i < d.type->pinCount; ++i) {
    const bool output = (d.type->outputMask >> i) & 1;
    out.push_back({d.id, d.type->pins[i], d.pins[i], true, output, false, false, false, false});
  }
}

inline const BusDef* findBusDef(const std::vector<BusDef>& buses, const std::string& id) {
  for (const BusDef& d : buses)
    if (d.id == id) return &d;
  return nullptr;
}

inline size_t busesOfType(const std::vector<BusDef>& buses, const char* type) {
  size_t n = 0;
  for (const BusDef& d : buses) n += strcmp(d.type->type, type) == 0;
  return n;
}

// Lowest I2C controller no bus in buses uses (other than exceptId), -1 if
// both are taken.
inline int freeI2cPort(const std::vector<BusDef>& buses, const std::string& exceptId = "") {
  for (int port = 0; port < 2; ++port) {
    bool taken = false;
    for (const BusDef& d : buses) taken |= (d.id != exceptId && d.port == port);
    if (!taken) return port;
  }
  return -1;
}

// Rewrites an item config from before buses were configurable — DS18B20
// "pin", MAX31865 "clk"/"miso"/"mosi", BME280/GY521 on the board's implicit
// I2C bus — to a "bus" reference, adding a bus with these pins to buses if
// none exists yet. Returns true if cfg changed. Incomplete legacy pins (clk
// without miso) are left alone, so creating the item reports them.
inline bool normalizeLegacyItem(JsonObject cfg, std::vector<BusDef>& buses, const Board& b) {
  if (!cfg["bus"].isNull()) return false;
  const char* type = cfg["type"] | "";
  auto use = [&](const char* busType, std::initializer_list<int> pinList) {
    const BusType* t = findBusType(busType);
    int pins[kMaxBusPins] = {-1, -1, -1};
    size_t i = 0;
    for (int p : pinList) pins[i++] = p;
    const std::string id = busIdFor(*t, pins);
    if (!findBusDef(buses, id)) {
      BusDef d;
      d.id = id;
      d.type = t;
      for (size_t k = 0; k < kMaxBusPins; ++k) d.pins[k] = pins[k];
      if (strcmp(busType, "i2c") == 0) d.port = freeI2cPort(buses);
      buses.push_back(d);
    }
    cfg["bus"] = id;
  };
  auto pin = [&](const char* key) { return cfg[key].is<int>() ? cfg[key].as<int>() : -1; };

  if (strcmp(type, "DS18B20") == 0) {
    if (pin("pin") < 0) return false;
    use("onewire", {pin("pin")});
    cfg.remove("pin");
    return true;
  }
  if (strcmp(type, "MAX31865") == 0) {
    if (pin("clk") < 0 || pin("miso") < 0 || pin("mosi") < 0) return false;
    use("spi", {pin("clk"), pin("miso"), pin("mosi")});
    cfg.remove("clk");
    cfg.remove("miso");
    cfg.remove("mosi");
    return true;
  }
  if (strcmp(type, "BME280") == 0 || strcmp(type, "GY521") == 0) {
    for (const BusDef& d : buses) {
      if (d.fixed && strcmp(d.type->type, "i2c") == 0) {
        cfg["bus"] = d.id;
        return true;
      }
    }
    use("i2c", {b.i2cSda, b.i2cScl});
    return true;
  }
  return false;
}

}  // namespace BrewControl
