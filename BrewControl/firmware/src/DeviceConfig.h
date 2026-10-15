#pragma once

#include <ArduinoJson.h>

#include <cstdint>
#include <cstdio>
#include <cstring>
#include <string>
#include <vector>

namespace BrewControl {

// Peripheral devices: chips on a bus that offer capabilities to items — an
// MCP4728 offers four DAC channels, a PCF8575 sixteen digital pins. Items reference a channel in a pin field
// as "<device id>:<channel>" (PinMap.h parsePinRef) instead of a GPIO number.
// Header-only and Arduino-free like BusConfig.h; the drivers live in
// DynamicItems.cpp.
//
// What a type offers is static, from this table — pin checks, GET /api/pins
// and GET /api/peripherals read it without a running driver.

// The capability a device type offers, on `count` channels.
struct DeviceCap {
  const char* cap;                  // "dac", "gpio"
  uint8_t count;
  uint16_t rawMax;                  // dac: full scale; gpio: 1
  const char* const* channelNames;  // `count` names
  bool inputsPullup = false;        // gpio: inputs always have a pull-up
};

struct DeviceType {
  const char* type;
  const char* bus;  // bus type it sits on (BusConfig.h kBusTypes)
  uint8_t addrFirst;
  uint8_t addrLast;
  uint8_t addrDefault;
  DeviceCap provides;
};

inline constexpr const char* kMcp4728Channels[] = {"A", "B", "C", "D"};
inline constexpr const char* kPcf8575Channels[] = {
    "P00", "P01", "P02", "P03", "P04", "P05", "P06", "P07",
    "P10", "P11", "P12", "P13", "P14", "P15", "P16", "P17"};

// PCF8575: quasi-bidirectional pins (0 sinks hard, 1 is a weak pull-up that
// doubles as input), so its inputs always have a pull-up. On the Waveshare
// board 0x20 is the onboard TCA9554 (reserved address of i2c-board).
inline constexpr DeviceType kDeviceTypes[] = {
    {"mcp4728", "i2c", 0x60, 0x67, 0x60, {"dac", 4, 4095, kMcp4728Channels}},
    {"pcf8575", "i2c", 0x20, 0x27, 0x20, {"gpio", 16, 1, kPcf8575Channels, true}},
};

inline const DeviceType* findDeviceType(const char* type) {
  for (const DeviceType& t : kDeviceTypes)
    if (strcmp(t.type, type) == 0) return &t;
  return nullptr;
}

struct DeviceDef {
  std::string id;
  std::string label;
  const DeviceType* type = nullptr;
  std::string bus;  // bus id
  uint8_t address = 0;
};

// "mcp4728-i2c-board-60": type, bus id and address (hex). One address per
// bus, so the id is unique; it changes with bus or address (allowed only
// while unused).
inline std::string deviceIdFor(const DeviceType& t, const std::string& bus, uint8_t address) {
  char hex[3];
  snprintf(hex, sizeof(hex), "%02x", address);
  return std::string(t.type) + "-" + bus + "-" + hex;
}

// Parses a device definition as stored and as POST/PUT /api/peripherals send
// it: {"type":"mcp4728","bus":"i2c-board","address":96,"label":"..."}. The id
// is derived, a given "id" is ignored; "address" defaults to the type's
// factory address. Whether the bus exists is checked by the caller.
inline bool parseDeviceDef(JsonObjectConst in, DeviceDef& out, std::string& err) {
  const DeviceType* t = findDeviceType(in["type"] | "");
  if (!t) { err = "unknown device type"; return false; }
  DeviceDef d;
  d.type = t;
  d.bus = in["bus"] | "";
  if (d.bus.empty()) { err = "missing bus"; return false; }
  if (!in["address"].isNull()) {
    const int a = in["address"].is<int>() ? in["address"].as<int>() : -1;
    if (a < t->addrFirst || a > t->addrLast) {
      char msg[48];
      snprintf(msg, sizeof(msg), "address must be 0x%02x..0x%02x", t->addrFirst, t->addrLast);
      err = msg;
      return false;
    }
    d.address = static_cast<uint8_t>(a);
  } else {
    d.address = t->addrDefault;
  }
  d.label = in["label"] | "";
  if (d.label.size() > 32) { err = "label too long"; return false; }
  d.id = deviceIdFor(*t, d.bus, d.address);
  out = d;
  return true;
}

// The stored form (see parseDeviceDef).
inline void writeDeviceDef(const DeviceDef& d, JsonObject out) {
  out["id"] = d.id;
  out["type"] = d.type->type;
  if (!d.label.empty()) out["label"] = d.label;
  out["bus"] = d.bus;
  out["address"] = d.address;
}

inline const DeviceDef* findDeviceDef(const std::vector<DeviceDef>& devices,
                                      const std::string& id) {
  for (const DeviceDef& d : devices)
    if (d.id == id) return &d;
  return nullptr;
}

// Ids of the devices on bus busId — they count as users of the bus, which
// may then neither go nor change its pins.
inline std::vector<std::string> devicesOnBus(const std::vector<DeviceDef>& devices,
                                             const std::string& busId) {
  std::vector<std::string> out;
  for (const DeviceDef& d : devices)
    if (d.bus == busId) out.push_back(d.id);
  return out;
}

}  // namespace BrewControl
