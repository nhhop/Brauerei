// BrewControl/firmware/src/AuthService.cpp
#include "AuthService.h"

#include <Preferences.h>
#include <esp_system.h>
#include <mbedtls/md.h>

namespace BrewControl {
namespace {

constexpr uint32_t kSessionTtlMs = 7UL * 24 * 60 * 60 * 1000;  // 7 days

// Iterated salted SHA-256. A single round would make a flash dump trivially
// brute-forceable; the point isn't to stop someone with physical access (they
// can reflash anyway) but to keep a password the user reuses elsewhere out of
// reach if a backup or a dumped image ever leaks. 10k rounds cost a few tens
// of milliseconds on the hardware SHA unit — paid once per login.
constexpr int kHashRounds = 10000;

String toHex(const uint8_t* bytes, size_t n) {
  static const char kDigits[] = "0123456789abcdef";
  String out;
  out.reserve(n * 2);
  for (size_t i = 0; i < n; ++i) {
    out += kDigits[bytes[i] >> 4];
    out += kDigits[bytes[i] & 0x0f];
  }
  return out;
}

String randomHex(size_t bytes) {
  uint8_t buf[32];
  if (bytes > sizeof(buf)) bytes = sizeof(buf);
  for (size_t i = 0; i < bytes; ++i) buf[i] = (uint8_t)(esp_random() & 0xff);
  return toHex(buf, bytes);
}

String hashPassword(const String& saltHex, const String& password) {
  const mbedtls_md_info_t* info = mbedtls_md_info_from_type(MBEDTLS_MD_SHA256);
  if (info == nullptr) return String();
  uint8_t in[32], out[32];
  const String seed = saltHex + password;
  mbedtls_md(info, (const uint8_t*)seed.c_str(), seed.length(), out);
  for (int i = 1; i < kHashRounds; ++i) {
    memcpy(in, out, sizeof(in));
    mbedtls_md(info, in, sizeof(in), out);
  }
  return toHex(out, sizeof(out));
}

// Length-independent, data-independent compare — a plain == on the hash would
// leak how many leading characters a guess got right.
bool constantTimeEquals(const String& a, const String& b) {
  if (a.length() != b.length()) return false;
  uint8_t diff = 0;
  for (size_t i = 0; i < a.length(); ++i) diff |= (uint8_t)(a[i] ^ b[i]);
  return diff == 0;
}

}  // namespace

void AuthService::begin() {
  Preferences prefs;
  prefs.begin("brewctrl", true);
  saltHex_ = prefs.getString("authSalt", "");
  hashHex_ = prefs.getString("authHash", "");
  prefs.end();
  // A half-written pair (salt without hash or vice versa) would leave the
  // device permanently unlockable — treat it as unconfigured.
  if (saltHex_.isEmpty() || hashHex_.length() != 64) {
    saltHex_ = "";
    hashHex_ = "";
  }
}

void AuthService::persist_() const {
  Preferences prefs;
  prefs.begin("brewctrl", false);
  if (hashHex_.isEmpty()) {
    prefs.remove("authSalt");
    prefs.remove("authHash");
  } else {
    prefs.putString("authSalt", saltHex_);
    prefs.putString("authHash", hashHex_);
  }
  prefs.end();
}

bool AuthService::setPassword(const String& current, const String& newPassword) {
  if (isConfigured() && !verifyPassword(current)) return false;
  if (newPassword.isEmpty()) {
    saltHex_ = "";
    hashHex_ = "";
  } else {
    saltHex_ = randomHex(16);
    hashHex_ = hashPassword(saltHex_, newPassword);
    if (hashHex_.isEmpty()) { saltHex_ = ""; return false; }  // no SHA-256
  }
  persist_();
  // Changing or clearing the password invalidates every existing login.
  revokeAll();
  return true;
}

bool AuthService::verifyPassword(const String& password) const {
  if (!isConfigured()) return false;
  return constantTimeEquals(hashHex_, hashPassword(saltHex_, password));
}

String AuthService::issueSession() {
  const String token = randomHex(kTokenChars / 2);
  const uint32_t now = millis();

  size_t slot = 0;
  int32_t oldest = 0;
  for (size_t i = 0; i < kMaxSessions; ++i) {
    if (sessions_[i].token[0] == '\0') { slot = i; break; }
    // Signed difference keeps the comparison correct across the millis() wrap.
    const int32_t remaining = (int32_t)(sessions_[i].expiresAtMs - now);
    if (i == 0 || remaining < oldest) { oldest = remaining; slot = i; }
  }

  strncpy(sessions_[slot].token, token.c_str(), kTokenChars);
  sessions_[slot].token[kTokenChars] = '\0';
  sessions_[slot].expiresAtMs = now + kSessionTtlMs;
  return token;
}

bool AuthService::checkSession(const String& token) {
  if (token.length() != kTokenChars) return false;
  const uint32_t now = millis();
  for (size_t i = 0; i < kMaxSessions; ++i) {
    if (sessions_[i].token[0] == '\0') continue;
    if ((int32_t)(sessions_[i].expiresAtMs - now) < 0) {  // expired
      sessions_[i].token[0] = '\0';
      continue;
    }
    if (constantTimeEquals(token, String(sessions_[i].token))) {
      sessions_[i].expiresAtMs = now + kSessionTtlMs;  // sliding expiry
      return true;
    }
  }
  return false;
}

void AuthService::revokeSession(const String& token) {
  for (size_t i = 0; i < kMaxSessions; ++i)
    if (sessions_[i].token[0] != '\0' && token == sessions_[i].token)
      sessions_[i].token[0] = '\0';
}

void AuthService::revokeAll() {
  for (size_t i = 0; i < kMaxSessions; ++i) sessions_[i].token[0] = '\0';
}

}  // namespace BrewControl
