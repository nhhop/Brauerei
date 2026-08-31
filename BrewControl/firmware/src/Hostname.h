#pragma once

#include <Arduino.h>

namespace BrewControl {

// mDNS / DHCP hostname rules: 1–32 chars, lowercase alnum and hyphen, no
// leading/trailing hyphen. Caller lowercases before validating. Shared by
// WebUI (POST /api/network) and WiFiSetupPortal (POST /api/connect).
inline bool validHostname(const String& h) {
  if (h.isEmpty() || h.length() > 32) return false;
  if (h[0] == '-' || h[h.length() - 1] == '-') return false;
  for (size_t i = 0; i < h.length(); ++i) {
    const char c = h[i];
    if (!((c >= 'a' && c <= 'z') || (c >= '0' && c <= '9') || c == '-')) return false;
  }
  return true;
}

}  // namespace BrewControl
