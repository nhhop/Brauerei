#pragma once

#include <ArduinoJson.h>

#include <cstdint>
#include <cstring>
#include <string>
#include <vector>

namespace BrewControl {

// I2C address bookkeeping for dynamic items: which addresses the board
// itself already answers on (onboard RTC/Touch/PMU on the LilyGo) and which
// ones the configured items occupy. Header-only and Arduino-free so the
// checks run in the native tests. Deliberately separate from PinMap.h — the
// address space and the GPIO space are orthogonal checks, same reasoning as
// keeping PeripheralRegistry.h apart from PinMap.h.
//
// Addresses are per bus: two items may use the same address on different
// buses, never on the same one.

struct AddrDef {
  uint8_t addr;
  const char* note;
};

struct AddressUse {
  std::string item;
  std::string bus;
  uint8_t addr;
};

struct AddressCheck {
  bool ok = true;
  int status = 200;  // 409: reserved by the board, or already used
  std::string error;
};

inline bool addressReserved(const AddrDef* reserved, size_t count, uint8_t addr,
                            const char** note = nullptr) {
  for (size_t i = 0; i < count; ++i) {
    if (reserved[i].addr == addr) {
      if (note) *note = reserved[i].note;
      return true;
    }
  }
  return false;
}

// Appends the I2C address a BME280/GY521 config occupies (default per type
// if "address" is absent). Other item types add nothing.
inline void collectAddresses(JsonObjectConst cfg, std::vector<AddressUse>& out) {
  const char* type = cfg["type"] | "";
  const char* id   = cfg["id"]   | "";
  const char* bus  = cfg["bus"]  | "";
  if (strcmp(type, "BME280") == 0) {
    out.push_back({id, bus, static_cast<uint8_t>(cfg["address"] | 0x76)});
  } else if (strcmp(type, "GY521") == 0) {
    out.push_back({id, bus, static_cast<uint8_t>(cfg["address"] | 0x68)});
  }
}

// Checks a new or replacing item config against the reserved addresses of its
// bus (onboard devices of a fixed bus) and the addresses already in use on
// that bus. replaceId names the item being replaced, whose own address does
// not count as taken.
inline AddressCheck checkItemAddress(const AddrDef* reserved, size_t reservedCount,
                                     const std::vector<AddressUse>& uses,
                                     JsonObjectConst cfg, const char* replaceId = "") {
  AddressCheck r;
  auto fail = [&](const std::string& msg) {
    r.ok = false;
    r.status = 409;
    r.error = msg;
    return r;
  };
  const std::string replace = replaceId ? replaceId : "";

  std::vector<AddressUse> mine;
  collectAddresses(cfg, mine);
  if (mine.empty()) return r;
  const AddressUse& u = mine[0];

  char hex[6];
  snprintf(hex, sizeof(hex), "0x%02x", u.addr);

  const char* note = "";
  if (addressReserved(reserved, reservedCount, u.addr, &note))
    return fail(std::string(hex) + " is reserved on bus " + u.bus + " (" + note + ")");

  for (const AddressUse& e : uses) {
    if (e.item == replace || e.bus != u.bus || e.addr != u.addr) continue;
    return fail(std::string(hex) + " already used by " + e.item);
  }
  return r;
}

}  // namespace BrewControl
