#include "PushService.h"

#include <Preferences.h>
#include <WiFi.h>
#include <time.h>

namespace BrewControl {
namespace {

struct ScopedLock {
  SemaphoreHandle_t m;
  explicit ScopedLock(SemaphoreHandle_t s) : m(s) {
    if (m) xSemaphoreTakeRecursive(m, portMAX_DELAY);
  }
  ~ScopedLock() { if (m) xSemaphoreGiveRecursive(m); }
  ScopedLock(const ScopedLock&) = delete;
  ScopedLock& operator=(const ScopedLock&) = delete;
};

// The bootstrap page doubles as the VAPID subject: RFC 8292 wants a contact the
// push service can reach, and this keeps a private mail address out of the
// firmware image.
constexpr char kVapidSubject[] = "https://nhhop.github.io/Brauerei/push/";
constexpr time_t kClockValid   = 1600000000;  // ~2020-09, same guard LogStore uses

// NVS keys (15 chars max), namespace "brewctrl" — shared with WiFi and auth.
constexpr char kKeyPub[]  = "pushPub";
constexpr char kKeyPriv[] = "pushPriv";

String subKey(size_t i) { return String("pushS") + String((int)i); }

// "https://fcm.googleapis.com/fcm/send/xyz" -> "fcm.googleapis.com", so the UI
// can tell two browsers apart without ever showing the endpoint itself.
String endpointHost(const std::string& endpoint) {
  const size_t start = endpoint.find("://");
  if (start == std::string::npos) return "";
  const size_t from = start + 3;
  const size_t end = endpoint.find('/', from);
  const std::string host =
      endpoint.substr(from, end == std::string::npos ? std::string::npos : end - from);
  return String(host.c_str());
}

}  // namespace

PushService::PushService() { mutex_ = xSemaphoreCreateRecursiveMutex(); }

void PushService::begin(const String& hostname) {
  hostname_ = hostname;
  load_();
  applyConfig_();
}

void PushService::load_() {
  ScopedLock lk(mutex_);
  Preferences prefs;
  prefs.begin("brewctrl", true);
  vapidPub_  = prefs.getString(kKeyPub, "").c_str();
  vapidPriv_ = prefs.getString(kKeyPriv, "").c_str();
  subs_.clear();
  for (size_t i = 0; i < kMaxSubs; ++i) {
    const String raw = prefs.getString(subKey(i).c_str(), "");
    if (raw.isEmpty()) continue;
    JsonDocument doc;
    if (deserializeJson(doc, raw)) continue;
    Sub s;
    s.endpoint = doc["endpoint"] | "";
    s.p256dh   = doc["p256dh"] | "";
    s.auth     = doc["auth"] | "";
    s.addedAt  = doc["addedAt"] | 0;
    if (!s.endpoint.empty()) subs_.push_back(s);
  }
  prefs.end();
  // Half a keypair can only ever produce 403s — treat it as unconfigured.
  if (vapidPub_.empty() || vapidPriv_.empty()) {
    vapidPub_.clear();
    vapidPriv_.clear();
    subs_.clear();
  }
}

void PushService::persist_() const {
  Preferences prefs;
  prefs.begin("brewctrl", false);
  if (vapidPub_.empty()) {
    prefs.remove(kKeyPub);
    prefs.remove(kKeyPriv);
  } else {
    prefs.putString(kKeyPub, vapidPub_.c_str());
    prefs.putString(kKeyPriv, vapidPriv_.c_str());
  }
  for (size_t i = 0; i < kMaxSubs; ++i) {
    const String key = subKey(i);
    if (i >= subs_.size()) { prefs.remove(key.c_str()); continue; }
    JsonDocument doc;
    doc["endpoint"] = subs_[i].endpoint;
    doc["p256dh"]   = subs_[i].p256dh;
    doc["auth"]     = subs_[i].auth;
    doc["addedAt"]  = subs_[i].addedAt;
    String out;
    serializeJson(doc, out);
    prefs.putString(key.c_str(), out);
  }
  prefs.end();
}

void PushService::applyConfig_() {
  ScopedLock lk(mutex_);
  if (initialized_) {
    push_.deinit();
    initialized_ = false;
  }
  if (vapidPub_.empty() || subs_.empty()) return;

  WebPushVapidConfig vapid;
  vapid.subject          = kVapidSubject;
  vapid.publicKeyBase64  = vapidPub_;
  vapid.privateKeyBase64 = vapidPriv_;

  WebPushConfig cfg;
  // The library defaults to PSRAM, which esp32dev and lolin_s2_mini do not
  // have. Not `Internal` though: that maps to MALLOC_CAP_INTERNAL, which means
  // "not PSRAM" and therefore includes IRAM — and IRAM only allows 32-bit
  // accesses. Once DRAM got tight on the esp32dev the queue item landed there,
  // and constructing the std::string members of PushMessage byte-wise panicked
  // with a LoadStoreError. `Any` is MALLOC_CAP_DEFAULT, which is
  // byte-addressable and on a board without PSRAM is internal memory anyway.
  cfg.queueMemory = WebPushQueueMemory::Any;
  cfg.queueLength = 8;  // 4 alerts per WebUI::tick, times a couple of subscriptions
  // 4096 (the library default) does not survive a TLS handshake; upstream's own
  // example uses 16 KB. 12 KB is enough here and leaves the heap alone.
  cfg.worker.stackSizeBytes = 12288;
  cfg.worker.priority = 1;  // below AsyncTCP and the Arduino loop
  cfg.networkValidator = []() { return WiFi.status() == WL_CONNECTED; };

  initialized_ = push_.init(vapid, cfg);
  if (!initialized_) lastError_ = "Push-Dienst konnte nicht starten";
}

void PushService::tick() {
  if (configDirty_) {
    configDirty_ = false;
    applyConfig_();
  }
  if (testPending_) {
    testPending_ = false;
    ScopedLock lk(mutex_);
    // Same guard as send(): without it a test on a service that failed to
    // start would call into an uninitialised queue.
    if (!initialized_) return;
    for (const Sub& s : subs_)
      sendTo_(s, "BrewControl",
              "Testmeldung — Benachrichtigungen sind eingerichtet.", "test");
  }
}

void PushService::describe_(const AlarmStore::Alert& a, String& title, String& body) {
  const String name = a.name[0] ? String(a.name) : String(a.src);
  if (strcmp(a.kind, "program") == 0) {
    if (strcmp(a.detail, "awaiting") == 0) {
      title = "Schritt bestätigen";
      body  = name + " wartet auf die Freigabe.";
    } else {
      title = "Programm fertig";
      body  = name + " ist durchgelaufen.";
    }
  } else if (strcmp(a.kind, "fault") == 0) {
    title = a.cleared ? "Störung behoben" : "Störung";
    body  = a.cleared ? name + " meldet wieder normal."
                      : name + ": " + (a.detail[0] ? a.detail : "Fehler");
  } else if (strcmp(a.kind, "autotune") == 0) {
    title = "AutoTune fertig";
    body  = name + " hat neue Regelparameter.";
  } else if (strcmp(a.kind, "timer") == 0) {
    title = "Timer abgelaufen";
    body  = name + " ist fertig.";
  } else {  // threshold
    title = a.cleared ? "Alarm beendet" : "Alarm";
    body  = name;
    if (a.hasV) body += " (" + String(a.v, 1) + ")";
  }
}

void PushService::send(const AlarmStore::Alert& a) {
  ScopedLock lk(mutex_);
  if (!initialized_ || subs_.empty()) return;
  // A VAPID JWT carries an expiry, so it needs a real clock. Alerts from the
  // first seconds after boot are dropped here on purpose — they stay visible in
  // the alert center.
  if (time(nullptr) < kClockValid) return;

  String title, body;
  describe_(a, title, body);
  // Tagged by source, so a repeat from the same sensor replaces the previous
  // notification instead of stacking up.
  for (const Sub& s : subs_) sendTo_(s, title, body, String(a.src));
}

void PushService::sendTo_(const Sub& s, const String& title, const String& body,
                          const String& tag) {
  WebPushSubscription sub;
  sub.endpoint = s.endpoint;
  sub.p256dh   = s.p256dh;
  sub.auth     = s.auth;

  PushPayload payload;
  payload.title = title.c_str();
  payload.body  = body.c_str();
  payload.tag   = tag.c_str();
  // Rebuilt on every push and never stored with the subscription: the device may
  // have been renamed or readdressed since the browser subscribed. The literal
  // IP rather than <hostname>.local because Android does not resolve mDNS
  // reliably, and reaching a phone is the whole point of this feature.
  payload.data["url"] = String("http://") + WiFi.localIP().toString() + "/";
  payload.hasData = true;

  const WebPushEnqueueResult r = push_.send(sub, payload, nullptr);
  if (!r.queued()) lastError_ = r.message ? r.message : "Senden fehlgeschlagen";
}

String PushService::serialize() const {
  ScopedLock lk(mutex_);
  JsonDocument doc;
  doc["configured"]       = !vapidPub_.empty() && !subs_.empty();
  doc["publicKey"]        = vapidPub_;
  doc["maxSubscriptions"] = (uint32_t)kMaxSubs;
  doc["lastError"]        = lastError_;
  JsonArray arr = doc["subscriptions"].to<JsonArray>();
  for (size_t i = 0; i < subs_.size(); ++i) {
    JsonObject o = arr.add<JsonObject>();
    o["id"]      = (uint32_t)i;
    o["host"]    = endpointHost(subs_[i].endpoint);
    o["addedAt"] = (uint32_t)subs_[i].addedAt;
  }
  String out;
  serializeJson(doc, out);
  return out;
}

String PushService::serializeKeypair() const {
  ScopedLock lk(mutex_);
  JsonDocument doc;
  doc["publicKey"]  = vapidPub_;
  doc["privateKey"] = vapidPriv_;
  String out;
  serializeJson(doc, out);
  return out;
}

bool PushService::setSubscription(const JsonObject& j) {
  const char* pub      = j["publicKey"]  | "";
  const char* priv     = j["privateKey"] | "";
  const char* endpoint = j["endpoint"]   | "";
  const char* p256dh   = j["p256dh"]     | "";
  const char* auth     = j["auth"]       | "";
  if (!*pub || !*endpoint || !*p256dh || !*auth) return false;
  if (strncmp(endpoint, "https://", 8) != 0) return false;

  ScopedLock lk(mutex_);
  // A browser that subscribed against the key we handed it sends no private
  // half back — it never had one, and only the public half is needed to
  // subscribe. Keep ours and just add the subscription. Demanding the private
  // key here is what used to make a second browser look like a key change, and
  // a key change drops every subscription.
  const bool sameKey = (vapidPub_ == pub);
  if (!sameKey) {
    // A key we don't know is only usable with its private half.
    if (!*priv) return false;
    // Everything stored belongs to the old keypair and would answer 403.
    subs_.clear();
    vapidPub_  = pub;
    vapidPriv_ = priv;
  }
  Sub s;
  s.endpoint = endpoint;
  s.p256dh   = p256dh;
  s.auth     = auth;
  s.addedAt  = time(nullptr);

  bool replaced = false;
  for (Sub& existing : subs_) {
    if (existing.endpoint == s.endpoint) { existing = s; replaced = true; break; }
  }
  if (!replaced) {
    // Full: drop the oldest rather than refuse — the browser in front of the
    // user right now is the one that matters.
    if (subs_.size() >= kMaxSubs) subs_.erase(subs_.begin());
    subs_.push_back(s);
  }
  lastError_ = "";
  persist_();
  configDirty_ = true;
  return true;
}

bool PushService::removeSubscription(const char* id) {
  char* end = nullptr;
  const long idx = strtol(id, &end, 10);
  if (end == id || idx < 0) return false;
  ScopedLock lk(mutex_);
  if ((size_t)idx >= subs_.size()) return false;
  subs_.erase(subs_.begin() + idx);
  persist_();
  configDirty_ = true;
  return true;
}

void PushService::reset() {
  ScopedLock lk(mutex_);
  vapidPub_.clear();
  vapidPriv_.clear();
  subs_.clear();
  lastError_ = "";
  persist_();
  configDirty_ = true;
}

}  // namespace BrewControl
