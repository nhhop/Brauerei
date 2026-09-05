// BrewControl/firmware/src/AuthService.h
#pragma once

#include <Arduino.h>

namespace BrewControl {

// Optional access protection for the write side of the API.
//
// "Optional" without a separate flag: isConfigured() is the single source of
// truth. No password set — the default, and the state of every device that
// existed before this feature — means every gate is a no-op and the device
// behaves exactly as it did before. Turning protection on is setting a
// password; turning it off is clearing it.
//
// Credentials live in Preferences("brewctrl"), the same NVS namespace as the
// WiFi credentials. That keeps them out of GET /api/settings, out of the
// backup bundle and off the SD card, and it makes the existing BOOT-button
// factory reset (main.cpp: prefs.clear()) double as the "forgot password"
// recovery path at no extra cost.
//
// Sessions are RAM-only, so a reboot logs everyone out. Persisting them would
// need epoch time instead of millis() (which restarts at 0 on every boot) and
// therefore a synced clock; a fresh login costs seconds, and the device
// reboots on every settings save anyway.
//
// Threat model: without TLS the password crosses the LAN in the clear on
// login. This protects against stray clicks, guests and whatever else finds
// the API on the network — not against an active attacker on the same LAN.
class AuthService {
 public:
  static constexpr size_t kMaxSessions = 4;
  static constexpr size_t kTokenChars = 32;  // 16 random bytes, hex

  // Loads salt+hash from NVS. Call once before begin() of the web server.
  void begin();

  bool isConfigured() const { return hashHex_.length() == 64; }

  // Sets, changes or (with an empty newPassword) clears the password.
  // Returns false when one is already configured and `current` doesn't match.
  // Clearing or changing the password revokes every session.
  bool setPassword(const String& current, const String& newPassword);

  bool verifyPassword(const String& password) const;

  // Issues a session token. Evicts the oldest entry when the table is full.
  String issueSession();

  // True when the token names a live session; refreshes its sliding expiry.
  bool checkSession(const String& token);

  void revokeSession(const String& token);
  void revokeAll();

 private:
  struct Session {
    char token[kTokenChars + 1];
    uint32_t expiresAtMs;
  };

  void persist_() const;

  String saltHex_;
  String hashHex_;
  Session sessions_[kMaxSessions] = {};
};

}  // namespace BrewControl
