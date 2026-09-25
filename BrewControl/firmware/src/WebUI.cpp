#include "WebUI.h"

#include <ArduinoJson.h>
#include <HTTPClient.h>
#include <Preferences.h>
#include <Update.h>
#include <WiFi.h>
#include <functional>
#include <math.h>
#include <memory>
#include <time.h>
#ifdef BREWCTL_USE_LITTLEFS
#include <LittleFS.h>
#endif

#include "BoardPins.h"
#include "Hostname.h"
#include "SdLock.h"
#include "version.h"

namespace BrewControl {
namespace {

constexpr size_t kSnapshotCap = 4160;
constexpr uint32_t kRebootDelayMs = 500;

// Timeout for the outbound pairing calls (see WebUI::runPendingPairing_).
// Deliberately short: it runs from loopTask, so every second of it is a second
// in which sensors are not sampled and controllers do not update.
constexpr uint16_t kPairTimeoutMs = 2000;

// Upper bound for a buffered request body (see collectBody). Sized for the
// largest realistic payload, the backup bundle: the whole /config tree as one
// JSON document. Allocated only for bodies that actually span several chunks,
// and only for as long as the request lives.
constexpr size_t kMaxBodyBytes = 16384;

// Where a UI package upload is extracted. Normally a staging dir swapped in
// only after a complete extraction, so a failed upload leaves the running UI
// intact. BREWCTL_ASSETS_IN_PLACE is for boards whose data partition cannot
// hold the old and the new bundle at once (the 256 KB partition of
// partitions_4mb_littlefs.csv): /www is cleared first and overwritten
// directly — a failed upload then leaves no UI (kRecoveryPageHtml takes over).
// It is about partition size, not LittleFS: a board with a larger data
// partition keeps the staged swap.
#ifdef BREWCTL_ASSETS_IN_PLACE
constexpr char kAssetTarget[] = "/www";
#else
constexpr char kAssetTarget[] = "/www.new";
#endif

// Flash usage around a UI package upload — the small LittleFS data partition
// is the usual reason such an upload fails.
void logFsUsage(const char* when) {
#ifdef BREWCTL_USE_LITTLEFS
  Serial.printf("asset upload %s: LittleFS %u/%u bytes used\n", when,
                (unsigned)LittleFS.usedBytes(), (unsigned)LittleFS.totalBytes());
#else
  (void)when;
#endif
}

#ifdef BREWCTL_USE_LITTLEFS
// esp_littlefs panics (IntegerDivideByZero in lfs_alloc) instead of returning
// an error when a write finds no free block, rebooting mid-request. So check
// before opening each archived file that it fits, with headroom for block
// rounding, CTZ skip-list pointers and a metadata block.
bool littleFsHasRoomFor(uint32_t fileSize) {
  constexpr size_t kBlock = 4096;
  size_t freeBytes = LittleFS.totalBytes() - LittleFS.usedBytes();
  return freeBytes >= fileSize + fileSize / 64 + 2 * kBlock;
}
#endif

std::unique_ptr<char[]> makeSnapshot(SensActCtrl::Registry& reg, bool estop,
                                     size_t* outLen) {
  auto buf = std::unique_ptr<char[]>(new (std::nothrow) char[kSnapshotCap]);
  if (!buf) { *outLen = 0; return buf; }
  size_t n = SensActCtrl::serializeRegistry(reg, buf.get(), kSnapshotCap);
  // serializeRegistry returns 0 when the registry doesn't fit kSnapshotCap
  // (buf is then untouched). Signal failure to every caller the same way as OOM
  // instead of handing back a zero-length / garbage buffer.
  if (n == 0) { *outLen = 0; return nullptr; }
  // Append serverTime if NTP is synced (epoch > year 2000)
  time_t now = time(nullptr);
  if (now > 946684800L && n >= 2) {
    char suffix[40];
    int slen = snprintf(suffix, sizeof(suffix), ",\"serverTime\":%ld}", (long)now);
    if (slen > 0 && n - 1 + (size_t)slen + 1 <= kSnapshotCap) {
      memcpy(buf.get() + n - 1, suffix, slen + 1);  // overwrites closing '}'
      n = n - 1 + slen;
    }
  }
  // Always emitted, unlike serverTime: a safety state must not be ambiguous
  // between "off" and "this firmware doesn't report it".
  if (n >= 2) {
    const char* suffix = estop ? ",\"estop\":true}" : ",\"estop\":false}";
    size_t slen = strlen(suffix);
    if (n - 1 + slen + 1 <= kSnapshotCap) {
      memcpy(buf.get() + n - 1, suffix, slen + 1);  // overwrites closing '}'
      n = n - 1 + slen;
    }
  }
  *outLen = n;
  return buf;
}

// Collects a request body that TCP delivered in more than one chunk.
//
// ESPAsyncWebServer hands the body to handleBody() segment by segment; anything
// larger than one TCP segment (~1.4 KB including headers) therefore arrives in
// pieces. Single-chunk bodies — the common case for the small API payloads —
// are passed straight through without a copy; larger ones accumulate in
// request->_tempObject, which the request destructor frees (same mechanism the
// library's own AsyncCallbackJsonWebHandler uses).
//
// Returns the complete body once the last chunk arrived, `nullptr` while more
// are pending or on error (the error response has been sent then). The body is
// always `total` bytes long.
const uint8_t* collectBody(AsyncWebServerRequest* req, uint8_t* data, size_t len,
                           size_t index, size_t total) {
  if (index == 0 && len == total) return data;  // single chunk — no copy
  if (index == 0) {
    if (total > kMaxBodyBytes) {
      req->send(413, "text/plain", "body too large");
      return nullptr;
    }
    req->_tempObject = malloc(total);
    if (req->_tempObject == nullptr) {
      req->send(500, "text/plain", "out of memory");
      return nullptr;
    }
  }
  if (req->_tempObject == nullptr) return nullptr;  // rejected on the first chunk
  memcpy(static_cast<uint8_t*>(req->_tempObject) + index, data, len);
  if (index + len < total) return nullptr;          // more to come
  return static_cast<const uint8_t*>(req->_tempObject);
}

// Access gate for the write side of the API.
//
// Set once from WebUI::begin(); there is exactly one WebUI per device. Kept as
// a file-static rather than a WebUI member so the generic handler classes
// below can consult it without threading it through every one of their ~30
// construction sites.
AuthService* g_auth = nullptr;

// Session token out of the Cookie header, empty when absent.
String sessionCookie(AsyncWebServerRequest* req) {
  const AsyncWebHeader* h = req->getHeader("Cookie");
  if (h == nullptr) return String();
  const String& c = h->value();
  // Only match at the start of the header or right behind a separator, so a
  // cookie named e.g. "xbcsid" can't be mistaken for ours.
  int i = c.indexOf("bcsid=");
  while (i > 0 && c[i - 1] != ' ' && c[i - 1] != ';') i = c.indexOf("bcsid=", i + 1);
  if (i < 0) return String();
  const int start = i + 6;
  int end = c.indexOf(';', start);
  if (end < 0) end = c.length();
  return c.substring(start, end);
}

String sessionCookieHeader(const String& token) {
  // No Secure flag — the UI is served over plain HTTP and a Secure cookie
  // would never be sent back. Revisit if the device ever serves TLS.
  return "bcsid=" + token + "; Path=/; HttpOnly; SameSite=Strict; Max-Age=604800";
}

String clearedCookieHeader() {
  return "bcsid=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0";
}

// True when the request may write. With no password configured this is always
// true and the whole feature is invisible.
bool isAuthenticated(AsyncWebServerRequest* req) {
  if (g_auth == nullptr || !g_auth->isConfigured()) return true;
  return g_auth->checkSession(sessionCookie(req));
}

// Gate for mutating routes: sends the 401 itself and returns false when the
// caller must stop. /api/auth/* is exempt — those handlers enforce their own
// rules, and gating them would make logging in impossible.
bool requireAuth(AsyncWebServerRequest* req) {
  if (req->url().startsWith("/api/auth/")) return true;
  if (isAuthenticated(req)) return true;
  req->send(401, "text/plain", "authentication required");
  return false;
}

// Self-contained login page, served instead of the SPA for GET requests when
// auth_.isUiProtected() is on and the caller has no session (see the
// addMiddleware() gate near serveStatic() in begin()). Embedded rather than
// a file under /www: it must stay reachable independent of the SPA bundle
// (e.g. mid asset-upload), and the LittleFS boards only have a 256 KB data
// partition to spend on the app itself.
const char kLockedPageHtml[] = R"HTML(<!doctype html>
<html lang="de"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>BrewControl gesperrt</title>
<style>
:root{color-scheme:light dark}
body{font-family:system-ui,sans-serif;display:flex;min-height:100vh;margin:0;
  align-items:center;justify-content:center;background:#12161c;color:#e6e8eb}
form{background:#1b212b;padding:2rem;border-radius:12px;width:min(90vw,320px);
  box-shadow:0 8px 24px rgba(0,0,0,.4)}
h1{font-size:1.1rem;margin:0 0 1rem}
input{width:100%;box-sizing:border-box;padding:.6rem .7rem;border-radius:8px;
  border:1px solid #333c48;background:#12161c;color:inherit;margin-bottom:.75rem;
  font-size:1rem}
button{width:100%;padding:.6rem;border:0;border-radius:8px;background:#3b82f6;
  color:#fff;font-size:1rem;cursor:pointer}
button:disabled{opacity:.6;cursor:default}
#err{color:#f87171;font-size:.85rem;min-height:1.2em;margin-top:.5rem}
</style></head>
<body>
<form id="f">
<h1>&#128274; BrewControl gesperrt</h1>
<input type="password" id="pw" placeholder="Ger&#228;tepasswort" autofocus autocomplete="current-password">
<button type="submit">Anmelden</button>
<div id="err"></div>
</form>
<script>
document.getElementById('f').addEventListener('submit', async function (e) {
  e.preventDefault();
  var btn = e.target.querySelector('button');
  var err = document.getElementById('err');
  btn.disabled = true; err.textContent = '';
  try {
    var r = await fetch('/api/auth/login', {
      method: 'POST', headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({password: document.getElementById('pw').value}),
    });
    if (r.ok) { location.reload(); return; }
    err.textContent = r.status === 409 ? 'Kein Passwort konfiguriert.' : 'Falsches Passwort.';
  } catch (e) {
    err.textContent = 'Verbindung fehlgeschlagen.';
  }
  btn.disabled = false;
});
</script>
</body></html>
)HTML";

// Served instead of the SPA when /www holds no index.html — e.g. after a
// failed in-place UI upload (BREWCTL_ASSETS_IN_PLACE). Embedded for the same
// reason as kLockedPageHtml: it must work without any file under /www, so the
// UI package can be re-uploaded from a browser without USB.
const char kRecoveryPageHtml[] = R"HTML(<!doctype html>
<html lang="de"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>BrewControl &#8211; UI fehlt</title>
<style>
:root{color-scheme:light dark}
body{font-family:system-ui,sans-serif;display:flex;min-height:100vh;margin:0;
  align-items:center;justify-content:center;background:#12161c;color:#e6e8eb}
form{background:#1b212b;padding:2rem;border-radius:12px;width:min(90vw,360px);
  box-shadow:0 8px 24px rgba(0,0,0,.4)}
h1{font-size:1.1rem;margin:0 0 .5rem}
p{font-size:.9rem;color:#9aa4b2;margin:0 0 1rem}
input{width:100%;box-sizing:border-box;padding:.6rem .7rem;border-radius:8px;
  border:1px solid #333c48;background:#12161c;color:inherit;margin-bottom:.75rem;
  font-size:1rem}
button{width:100%;padding:.6rem;border:0;border-radius:8px;background:#3b82f6;
  color:#fff;font-size:1rem;cursor:pointer}
button:disabled{opacity:.6;cursor:default}
#msg{font-size:.85rem;min-height:1.2em;margin-top:.5rem;word-break:break-word}
</style></head>
<body>
<form id="f">
<h1>BrewControl &#8211; Web-UI fehlt</h1>
<p>Keine UI-Dateien auf dem Ger&#228;t (z.&#160;B. nach einem abgebrochenen Update). Die API l&#228;uft weiter. UI-Paket (.tar) erneut hochladen:</p>
<input type="file" id="file" accept=".tar" required>
<input type="password" id="pw" placeholder="Ger&#228;tepasswort (falls gesetzt)" autocomplete="current-password">
<button type="submit">Hochladen</button>
<div id="msg"></div>
</form>
<script>
document.getElementById('f').addEventListener('submit', async function (e) {
  e.preventDefault();
  var btn = e.target.querySelector('button');
  var msg = document.getElementById('msg');
  var pw = document.getElementById('pw').value;
  btn.disabled = true; msg.style.color = ''; msg.textContent = 'Lädt hoch …';
  try {
    if (pw) {
      await fetch('/api/auth/login', {
        method: 'POST', headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({password: pw}),
      });
    }
    var fd = new FormData();
    fd.append('f', document.getElementById('file').files[0]);
    var r = await fetch('/api/update/assets', {method: 'POST', body: fd});
    if (r.ok) { msg.textContent = 'Fertig, lade neu …'; setTimeout(function () { location.reload(); }, 1500); return; }
    msg.style.color = '#f87171';
    msg.textContent = r.status === 401 ? 'Anmeldung erforderlich (Passwort).' : 'Fehler ' + r.status + ': ' + await r.text();
  } catch (e) {
    msg.style.color = '#f87171';
    msg.textContent = 'Verbindung fehlgeschlagen.';
  }
  btn.disabled = false;
});
</script>
</body></html>
)HTML";

// Matches POST <prefix>* requests and delivers the body in a single call.
// Used for write and create routes where the URL contains a path param or
// the body must be parsed. Bodies spanning several TCP segments are collected
// first (see collectBody); only bodies above kMaxBodyBytes are rejected (413).
class BodyPrefixHandler : public AsyncWebHandler {
 public:
  using Cb = std::function<void(AsyncWebServerRequest*, const uint8_t*, size_t)>;
  BodyPrefixHandler(const char* prefix, Cb cb)
      : prefix_(prefix), cb_(std::move(cb)) {}

  bool canHandle(AsyncWebServerRequest* req) const override {
    return req->method() == HTTP_POST && req->url().startsWith(prefix_);
  }
  void handleRequest(AsyncWebServerRequest*) override {}
  void handleBody(AsyncWebServerRequest* req, uint8_t* data, size_t len,
                  size_t index, size_t total) override {
    if (const uint8_t* body = collectBody(req, data, len, index, total)) {
      if (!requireAuth(req)) return;
      cb_(req, body, total);
    }
  }
  bool isRequestHandlerTrivial() const override { return false; }

 private:
  String prefix_;
  Cb cb_;
};

// Matches GET <prefix>* requests where the URL carries a path param.
class GetPrefixHandler : public AsyncWebHandler {
 public:
  using Cb = std::function<void(AsyncWebServerRequest*)>;
  GetPrefixHandler(const char* prefix, Cb cb)
      : prefix_(prefix), cb_(std::move(cb)) {}

  bool canHandle(AsyncWebServerRequest* req) const override {
    return req->method() == HTTP_GET && req->url().startsWith(prefix_);
  }
  void handleRequest(AsyncWebServerRequest* req) override { cb_(req); }
  bool isRequestHandlerTrivial() const override { return false; }

 private:
  String prefix_;
  Cb cb_;
};

// Matches PUT <prefix>* requests and delivers the parsed JSON body; the URL
// carries the item id. Same body collection and auth as BodyPrefixHandler.
class PutJsonPrefixHandler : public AsyncWebHandler {
 public:
  using Cb = std::function<void(AsyncWebServerRequest*, JsonVariant&)>;
  PutJsonPrefixHandler(const char* prefix, Cb cb)
      : prefix_(prefix), cb_(std::move(cb)) {}

  bool canHandle(AsyncWebServerRequest* req) const override {
    return req->method() == HTTP_PUT && req->url().startsWith(prefix_);
  }
  void handleRequest(AsyncWebServerRequest* req) override {
    if (req->contentLength() == 0) req->send(400, "text/plain", "missing body");
  }
  void handleBody(AsyncWebServerRequest* req, uint8_t* data, size_t len,
                  size_t index, size_t total) override {
    const uint8_t* body = collectBody(req, data, len, index, total);
    if (body == nullptr) return;
    if (!requireAuth(req)) return;
    JsonDocument doc;
    if (deserializeJson(doc, body, total) != DeserializationError::Ok ||
        !doc.is<JsonObject>()) {
      req->send(400, "text/plain", "invalid JSON");
      return;
    }
    JsonVariant json = doc.as<JsonVariant>();
    cb_(req, json);
  }
  bool isRequestHandlerTrivial() const override { return false; }

 private:
  String prefix_;
  Cb cb_;
};

// Matches DELETE <prefix>* requests (no body).
class DeletePrefixHandler : public AsyncWebHandler {
 public:
  using Cb = std::function<void(AsyncWebServerRequest*)>;
  DeletePrefixHandler(const char* prefix, Cb cb)
      : prefix_(prefix), cb_(std::move(cb)) {}

  bool canHandle(AsyncWebServerRequest* req) const override {
    return req->method() == HTTP_DELETE && req->url().startsWith(prefix_);
  }
  void handleRequest(AsyncWebServerRequest* req) override {
    if (!requireAuth(req)) return;
    cb_(req);
  }
  bool isRequestHandlerTrivial() const override { return false; }

 private:
  String prefix_;
  Cb cb_;
};

// Matches exactly <path> (no sub-paths) and only POST: parses the JSON body
// (collected first if it spans several TCP segments) and hands a JsonVariant to
// the callback. Every other method gets a
// 405. Replaces AsyncCallbackJsonWebHandler, whose default method set is
// GET|POST|PUT|PATCH and whose prefix URI matcher made e.g. GET /api/sensors
// fall into the create handler and answer "400 missing id".
class PostJsonHandler : public AsyncWebHandler {
 public:
  using Cb = std::function<void(AsyncWebServerRequest*, JsonVariant&)>;
  PostJsonHandler(const char* path, Cb cb)
      : path_(path), cb_(std::move(cb)) {}

  bool canHandle(AsyncWebServerRequest* req) const override {
    return req->url() == path_;
  }
  void handleRequest(AsyncWebServerRequest* req) override {
    if (req->method() != HTTP_POST)
      req->send(405, "text/plain", "method not allowed");
    else if (req->contentLength() == 0)
      req->send(400, "text/plain", "missing body");
  }
  void handleBody(AsyncWebServerRequest* req, uint8_t* data, size_t len,
                  size_t index, size_t total) override {
    if (req->method() != HTTP_POST) return;  // handleRequest sends the 405
    const uint8_t* body = collectBody(req, data, len, index, total);
    if (body == nullptr) return;
    if (!requireAuth(req)) return;
    JsonDocument doc;
    if (deserializeJson(doc, body, total) != DeserializationError::Ok) {
      req->send(400, "text/plain", "invalid JSON");
      return;
    }
    JsonVariant json = doc.as<JsonVariant>();
    cb_(req, json);
  }
  bool isRequestHandlerTrivial() const override { return false; }

 private:
  String path_;
  Cb cb_;
};

// "#rrggbb" — the shape openapi.yaml promises for theme colors.
bool isHexColor(const char* s) {
  if (strlen(s) != 7 || s[0] != '#') return false;
  for (int i = 1; i < 7; ++i) if (!isxdigit(static_cast<unsigned char>(s[i]))) return false;
  return true;
}

// Re-serializes a store's JSON array without the given runtime keys. With
// resetProgramState, a program is also put back to idle at step 0.
String definitionsOnly(const String& json, std::initializer_list<const char*> drop,
                       bool resetProgramState = false) {
  JsonDocument doc;
  if (deserializeJson(doc, json) != DeserializationError::Ok) return "[]";
  for (JsonObject o : doc.as<JsonArray>()) {
    for (const char* k : drop) o.remove(k);
    if (resetProgramState) {
      o["status"] = "idle";
      o["currentStep"] = 0;
      o["reachedStep"] = 0;
    }
  }
  String out;
  serializeJson(doc, out);
  return out;
}

}  // namespace

WebUI::WebUI(SensActCtrl::Registry& reg, fs::FS& fs, DynamicItems& items,
             DashboardStore& store, SettingsStore& settings,
             FirmwareUpdater& updater, LogStore& logs, ProgramRunner& programs,
             TimerStore& timers, AlarmStore& alarms, ProfileStore& profiles,
             MqttService& mqtt, WebhookService& webhook,
             WebSocketService& websocket, EspNowPublishService& espnow,
             RemoteDiscovery& discovery, MdnsBrowser& peers, PushService& push,
             uint16_t port)
    : reg_(reg), fs_(fs), items_(items), store_(store), settings_(settings),
      updater_(updater), logs_(logs), programs_(programs), timers_(timers),
      alarms_(alarms), profiles_(profiles), mqtt_(mqtt), webhook_(webhook),
      websocket_(websocket), espnow_(espnow), discovery_(discovery), peers_(peers),
      push_(push),
      server_(port),
      events_("/api/events") {}

void WebUI::begin() {
  // Before the first snapshot can be served: a latched stop must already be
  // back in force when the UI (or a controller's first tick) sees the device.
  loadEstop_();

  // ── Snapshot ─────────────────────────────────────────────────────────────
  server_.on("/api/snapshot", HTTP_GET, [this](AsyncWebServerRequest* req) {
    size_t n = 0;
    auto buf = makeSnapshot(reg_, estop_, &n);
    if (!buf) { req->send(503, "text/plain", "snapshot unavailable"); return; }
    auto* resp = req->beginResponseStream("application/json", n);
    resp->write(reinterpret_cast<const uint8_t*>(buf.get()), n);
    req->send(resp);
  });

  events_.onConnect([this](AsyncEventSourceClient* c) { sendSnapshotTo_(c); });
  server_.addHandler(&events_);

  // ── Access control (optional) ─────────────────────────────────────────────
  // With no password configured every gate is a no-op and the API behaves
  // exactly as it did before this feature. Reads stay open either way; only
  // mutating routes are gated, plus GET /api/backup (it carries the MQTT
  // password). See requireAuth above. auth_.isUiProtected() is a further,
  // separately-toggled step that also gates reads and the UI itself — see
  // the addMiddleware() gate near serveStatic() below.
  auth_.begin();
  g_auth = &auth_;

  server_.on("/api/auth/status", HTTP_GET, [this](AsyncWebServerRequest* req) {
    String out = "{\"enabled\":";
    out += auth_.isConfigured() ? "true" : "false";
    out += ",\"authenticated\":";
    out += isAuthenticated(req) ? "true" : "false";
    out += ",\"uiProtected\":";
    out += auth_.isUiProtected() ? "true" : "false";
    out += "}";
    req->send(200, "application/json", out);
  });

  server_.addHandler(new PostJsonHandler("/api/auth/login",
      [this](AsyncWebServerRequest* req, JsonVariant& json) {
        if (!json.is<JsonObject>()) { req->send(400, "text/plain", "invalid JSON"); return; }
        if (!auth_.isConfigured()) { req->send(409, "text/plain", "no password configured"); return; }
        const char* pw = json["password"] | "";
        if (!auth_.verifyPassword(pw)) { req->send(401, "text/plain", "wrong password"); return; }
        AsyncWebServerResponse* resp = req->beginResponse(204);
        resp->addHeader("Set-Cookie", sessionCookieHeader(auth_.issueSession()));
        req->send(resp);
      }));

  // No body — a PostJsonHandler would answer "400 missing body".
  server_.on("/api/auth/logout", HTTP_POST, [this](AsyncWebServerRequest* req) {
    auth_.revokeSession(sessionCookie(req));
    AsyncWebServerResponse* resp = req->beginResponse(204);
    resp->addHeader("Set-Cookie", clearedCookieHeader());
    req->send(resp);
  });

  // Set, change or — with an empty "password" — clear the device password.
  // Clearing turns the protection off; there is no separate enable flag.
  server_.addHandler(new PostJsonHandler("/api/auth/password",
      [this](AsyncWebServerRequest* req, JsonVariant& json) {
        if (!json.is<JsonObject>()) { req->send(400, "text/plain", "invalid JSON"); return; }
        // Once a password exists, knowing it is not enough — the caller must
        // also hold a session, so a password sniffed off the wire can't be
        // replayed into a takeover from a fresh client.
        if (auth_.isConfigured() && !isAuthenticated(req)) {
          req->send(401, "text/plain", "authentication required");
          return;
        }
        const char* current = json["currentPassword"] | "";
        const char* next = json["password"] | "";
        if (!auth_.setPassword(current, next)) {
          req->send(403, "text/plain", "wrong current password");
          return;
        }
        // setPassword revoked every session including this caller's; hand out
        // a fresh one so a password change doesn't log the user out.
        AsyncWebServerResponse* resp = req->beginResponse(204);
        resp->addHeader("Set-Cookie", auth_.isConfigured()
                                          ? sessionCookieHeader(auth_.issueSession())
                                          : clearedCookieHeader());
        req->send(resp);
      }));

  server_.on("/api/auth/revoke-all", HTTP_POST, [this](AsyncWebServerRequest* req) {
    if (!isAuthenticated(req)) { req->send(401, "text/plain", "authentication required"); return; }
    auth_.revokeAll();
    AsyncWebServerResponse* resp = req->beginResponse(204);
    resp->addHeader("Set-Cookie", clearedCookieHeader());
    req->send(resp);
  });

  // Turns the UI-lock step on/off. Requires an existing session, same as
  // changing the password — knowing it once isn't enough on its own.
  server_.addHandler(new PostJsonHandler("/api/auth/ui-protection",
      [this](AsyncWebServerRequest* req, JsonVariant& json) {
        if (!json.is<JsonObject>()) { req->send(400, "text/plain", "invalid JSON"); return; }
        if (!auth_.isConfigured()) { req->send(409, "text/plain", "no password configured"); return; }
        if (!isAuthenticated(req)) { req->send(401, "text/plain", "authentication required"); return; }
        auth_.setUiProtected(json["enabled"] | false);
        req->send(204);
      }));

  // ── Delete (prefix, no body) ──────────────────────────────────────────────
  server_.addHandler(new DeletePrefixHandler("/api/sensors/",
      [this](AsyncWebServerRequest* req) {
        String id = req->url().substring(strlen("/api/sensors/"));
        // DELETE /api/sensors/:id/calibration[?channel=key] — back to identity
        if (id.endsWith("/calibration")) {
          id.remove(id.length() - strlen("/calibration"));
          const String channel = req->hasParam("channel") ? req->getParam("channel")->value() : String();
          auto r = items_.clearCalibration(id.c_str(), req->hasParam("channel") ? channel.c_str() : nullptr);
          if (!r.ok) { req->send(strcmp(r.error, "sensor not found") == 0 ? 404 : 400, "text/plain", r.error); return; }
          items_.saveToSD(fs_);
          pushSnapshot_();
          req->send(204);
          return;
        }
        auto r = items_.removeSensor(id.c_str(), reg_);
        if (!r.ok) { req->send(405, "text/plain", r.error); return; }
        items_.saveToSD(fs_);
        pushSnapshot_();
        req->send(204);
      }));

  server_.addHandler(new DeletePrefixHandler("/api/actuators/",
      [this](AsyncWebServerRequest* req) {
        String id = req->url().substring(strlen("/api/actuators/"));
        auto r = items_.removeActuator(id.c_str(), reg_);
        if (!r.ok) { req->send(405, "text/plain", r.error); return; }
        items_.saveToSD(fs_);
        pushSnapshot_();
        req->send(204);
      }));

  server_.addHandler(new DeletePrefixHandler("/api/controllers/",
      [this](AsyncWebServerRequest* req) {
        String id = req->url().substring(strlen("/api/controllers/"));
        auto r = items_.removeController(id.c_str(), reg_);
        if (!r.ok) { req->send(405, "text/plain", r.error); return; }
        items_.saveToSD(fs_);
        pushSnapshot_();
        req->send(204);
      }));

  // ── Sensor calibration ────────────────────────────────────────────────────
  // GET /api/sensors/:id/calibration — live raw + calibrated value per channel
  server_.addHandler(new GetPrefixHandler("/api/sensors/",
      [this](AsyncWebServerRequest* req) {
        const String url = req->url();
        if (!url.endsWith("/calibration")) { req->send(404); return; }
        String path = url.substring(strlen("/api/sensors/"));
        String id   = path.substring(0, path.length() - strlen("/calibration"));
        JsonDocument doc;
        auto r = items_.getCalibration(id.c_str(), doc);
        if (!r.ok) { req->send(404, "text/plain", r.error); return; }
        String out;
        serializeJson(doc, out);
        req->send(200, "application/json", out);
      }));

  // ── Reset sensor accumulated state (e.g. YF-S201 volume) ──────────────────
  // ── POST /api/sensors/:id/calibration — set a channel's calibration ───────
  server_.addHandler(new BodyPrefixHandler("/api/sensors/",
      [this](AsyncWebServerRequest* req, const uint8_t* data, size_t len) {
        const String url = req->url();
        if (url.endsWith("/label")) {
          JsonDocument doc;
          if (deserializeJson(doc, data, len) != DeserializationError::Ok || !doc.is<JsonObject>()) {
            req->send(400, "text/plain", "invalid JSON");
            return;
          }
          String path = url.substring(strlen("/api/sensors/"));
          String id   = path.substring(0, path.length() - strlen("/label"));
          auto r = items_.setSensorLabel(id.c_str(), reg_, doc["label"] | "");
          if (!r.ok) { req->send(404, "text/plain", r.error); return; }
          items_.saveToSD(fs_);
          pushSnapshot_();
          req->send(204);
          return;
        }
        if (url.endsWith("/calibration")) {
          JsonDocument doc;
          if (deserializeJson(doc, data, len) != DeserializationError::Ok || !doc.is<JsonObject>()) {
            req->send(400, "text/plain", "invalid JSON");
            return;
          }
          String path = url.substring(strlen("/api/sensors/"));
          String id   = path.substring(0, path.length() - strlen("/calibration"));
          auto r = items_.calibrateSensor(id.c_str(), doc.as<JsonObjectConst>());
          if (!r.ok) { req->send(strcmp(r.error, "sensor not found") == 0 ? 404 : 400, "text/plain", r.error); return; }
          items_.saveToSD(fs_);
          pushSnapshot_();
          req->send(204);
          return;
        }
        if (!url.endsWith("/reset")) {
          req->send(405, "text/plain", "method not allowed");
          return;
        }
        String path = url.substring(strlen("/api/sensors/"));
        String id   = path.substring(0, path.length() - strlen("/reset"));
        auto r = items_.resetSensor(id.c_str());
        if (!r.ok) { req->send(400, "text/plain", r.error); return; }
        pushSnapshot_();
        req->send(204);
      }));

  // ── Write actuator (prefix, body) ────────────────────────────────────────
  server_.addHandler(new BodyPrefixHandler("/api/actuators/",
      [this](AsyncWebServerRequest* req, const uint8_t* data, size_t len) {
        const String url = req->url();
        JsonDocument doc;
        if (deserializeJson(doc, data, len) != DeserializationError::Ok) {
          req->send(400, "text/plain", "invalid JSON");
          return;
        }
        if (url.endsWith("/label")) {
          if (!doc.is<JsonObject>()) { req->send(400, "text/plain", "invalid JSON"); return; }
          String path = url.substring(strlen("/api/actuators/"));
          String id   = path.substring(0, path.length() - strlen("/label"));
          auto r = items_.setActuatorLabel(id.c_str(), reg_, doc["label"] | "");
          if (!r.ok) { req->send(404, "text/plain", r.error); return; }
          items_.saveToSD(fs_);
          pushSnapshot_();
          req->send(204);
          return;
        }
        String id = url.substring(strlen("/api/actuators/"));
        auto* a = reg_.findActuator(id.c_str());
        if (!a) { req->send(404); return; }
        bool hasEnabled = !doc["enabled"].isNull();
        bool hasV = !doc["v"].isNull();
        bool hasInterval = doc["interval"].is<JsonObject>();
        if (!hasV && !hasEnabled && !hasInterval) { req->send(400, "text/plain", "missing v"); return; }
        if (hasEnabled) a->setEnabled(doc["enabled"].as<bool>());
        if (hasInterval) {
          JsonObject iv = doc["interval"];
          uint32_t onSec = iv["onSec"] | 0u;
          uint32_t periodSec = iv["periodSec"] | 0u;
          if (periodSec == 0 || onSec > periodSec) {
            req->send(400, "text/plain", "invalid interval");
            return;
          }
          a->setInterval(onSec, periodSec);
        }
        if (hasV) a->write(doc["v"].as<float>());
        pushSnapshot_();
        req->send(204);
      }));

  // ── Emergency stop ────────────────────────────────────────────────────────
  // Disables every actuator (setEnabled(false) holds the hardware output
  // inactive without forgetting its target, see Actuator.h) and every
  // controller, and pauses every running program/timer — so neither a later
  // program step nor a controller that kept computing can drive an actuator
  // the moment it is re-enabled individually.
  //
  // The stop latches: estop_ is persisted, and loadEstop_() applies it again
  // on the next boot. Like a mechanical E-stop it stays engaged until it is
  // released deliberately via DELETE /api/estop. Deliberately unauthenticated
  // — stopping must work from a locked UI; releasing must not.
  server_.on("/api/estop", HTTP_POST, [this](AsyncWebServerRequest* req) {
    for (auto* a : reg_.actuators()) a->setEnabled(false);
    for (auto* c : reg_.controllers()) c->setEnabled(false);
    programs_.pauseAllRunning(reg_);
    programs_.saveToSD(fs_);
    timers_.pauseAllRunning();
    timers_.saveToSD(fs_);
    estop_ = true;
    saveEstop_();
    pushSnapshot_();
    req->send(204);
  });

  // Releases the latch without turning anything back on: actuators,
  // controllers, programs and timers stay where the stop left them and are
  // re-enabled one by one through the normal controls. After an emergency
  // stop, coming back up is a deliberate act, not a side effect of
  // acknowledging it.
  server_.on("/api/estop", HTTP_DELETE, [this](AsyncWebServerRequest* req) {
    if (!requireAuth(req)) return;
    estop_ = false;
    saveEstop_();
    pushSnapshot_();
    req->send(204);
  });

  // ── Write controller setpoint / params (prefix, body) ────────────────────
  server_.addHandler(new BodyPrefixHandler("/api/controllers/",
      [this](AsyncWebServerRequest* req, const uint8_t* data, size_t len) {
        JsonDocument doc;
        if (deserializeJson(doc, data, len) != DeserializationError::Ok) {
          req->send(400, "text/plain", "invalid JSON");
          return;
        }
        String url = req->url();
        bool isSp = url.endsWith("/setpoint");
        bool isPr = url.endsWith("/params");
        bool isLabel = url.endsWith("/label");
        if (!isSp && !isPr && !isLabel) { req->send(404); return; }
        if (isLabel) {
          String path = url.substring(strlen("/api/controllers/"));
          String id   = path.substring(0, path.length() - strlen("/label"));
          auto r = items_.setControllerLabel(id.c_str(), reg_, doc["label"] | "");
          if (!r.ok) { req->send(404, "text/plain", r.error); return; }
          items_.saveToSD(fs_);
          pushSnapshot_();
          req->send(204);
          return;
        }
        int cut = isSp ? strlen("/setpoint") : strlen("/params");
        String id = url.substring(strlen("/api/controllers/"), url.length() - cut);
        auto* c = reg_.findController(id.c_str());
        if (!c) { req->send(404); return; }
        if (isSp) {
          float v = doc["v"] | NAN;
          if (isnan(v)) { req->send(400, "text/plain", "missing v"); return; }
          c->setSetpoint(v);
        } else {
          String raw;
          serializeJson(doc, raw);
          if (!c->setParamsJson(raw.c_str())) {
            req->send(400, "text/plain", "params rejected");
            return;
          }
        }
        pushSnapshot_();
        req->send(204);
      }));

  // ── Create ────────────────────────────────────────────────────────────────
  server_.addHandler(new PostJsonHandler("/api/sensors",
      [this](AsyncWebServerRequest* req, JsonVariant& json) {
        auto r = items_.addSensor(json.as<JsonObject>(), reg_);
        if (!r.ok) { req->send(r.conflict ? 409 : 400, "text/plain", r.error); return; }
        items_.saveToSD(fs_);
        pushSnapshot_();
        req->send(204);
      }));

  server_.addHandler(new PostJsonHandler("/api/actuators",
      [this](AsyncWebServerRequest* req, JsonVariant& json) {
        auto r = items_.addActuator(json.as<JsonObject>(), reg_);
        if (!r.ok) { req->send(r.conflict ? 409 : 400, "text/plain", r.error); return; }
        // A latched stop must not be bypassed by a fresh item's default.
        if (estop_) {
          if (auto* a = reg_.findActuator(json["id"] | "")) a->setEnabled(false);
        }
        items_.saveToSD(fs_);
        pushSnapshot_();
        req->send(204);
      }));

  server_.addHandler(new PostJsonHandler("/api/controllers",
      [this](AsyncWebServerRequest* req, JsonVariant& json) {
        auto r = items_.addController(json.as<JsonObject>(), reg_);
        if (!r.ok) { req->send(400, "text/plain", r.error); return; }
        if (estop_) {
          if (auto* c = reg_.findController(json["id"] | "")) c->setEnabled(false);
        }
        items_.saveToSD(fs_);
        pushSnapshot_();
        req->send(204);
      }));

  // ── Replace (edit) — full config, the id may change ──────────────────────
  // Atomic from the client's view: a rejected config leaves the old item as
  // it was (DynamicItems::replace*).
  auto replaced = [this](AsyncWebServerRequest* req, const DynamicItems::Result& r,
                         JsonVariant& json, bool isController) {
    if (!r.ok) {
      const int status = strcmp(r.error, "not a dynamic item") == 0 ? 404
                         : r.conflict                               ? 409
                                                                    : 400;
      req->send(status, "text/plain", r.error);
      return;
    }
    // A latched stop must not be bypassed by the rebuilt item's default.
    if (estop_) {
      const char* id = json["id"] | "";
      if (isController) {
        if (auto* c = reg_.findController(id)) c->setEnabled(false);
      } else if (auto* a = reg_.findActuator(id)) {
        a->setEnabled(false);
      }
    }
    items_.saveToSD(fs_);
    pushSnapshot_();
    req->send(204);
  };

  server_.addHandler(new PutJsonPrefixHandler("/api/sensors/",
      [this, replaced](AsyncWebServerRequest* req, JsonVariant& json) {
        const String id = req->url().substring(strlen("/api/sensors/"));
        replaced(req, items_.replaceSensor(id.c_str(), json.as<JsonObject>(), reg_), json, false);
      }));

  server_.addHandler(new PutJsonPrefixHandler("/api/actuators/",
      [this, replaced](AsyncWebServerRequest* req, JsonVariant& json) {
        const String id = req->url().substring(strlen("/api/actuators/"));
        replaced(req, items_.replaceActuator(id.c_str(), json.as<JsonObject>(), reg_), json, false);
      }));

  server_.addHandler(new PutJsonPrefixHandler("/api/controllers/",
      [this, replaced](AsyncWebServerRequest* req, JsonVariant& json) {
        const String id = req->url().substring(strlen("/api/controllers/"));
        replaced(req, items_.replaceController(id.c_str(), json.as<JsonObject>(), reg_), json, true);
      }));

  // ── Admin ─────────────────────────────────────────────────────────────────
  server_.on("/api/admin/wifi-reset", HTTP_POST,
             [this](AsyncWebServerRequest* req) {
               if (!requireAuth(req)) return;
               Preferences prefs;
               prefs.begin("brewctrl", false);
               prefs.clear();
               prefs.end();
               rebootAtMs_ = millis() + kRebootDelayMs;
               req->send(204);
             });

  // ── Network ─────────────────────────────────────────────────────────────────
  // GET /api/network       — current STA status + configured hostname (JSON)
  // GET /api/network/scan  — async scan: 202 while running, 200 + JSON when done
  // One GetPrefixHandler dispatches both: "/api/network" is a BackwardCompatible
  // match (^uri(/.*)?$), so a bare server_.on would also swallow the sub-path.
  // The scan briefly takes the radio off-channel; the WiFi watchdog in loop()
  // (main.cpp) reconnects if it drops the live STA link so we can't lock out.
  server_.addHandler(new GetPrefixHandler("/api/network",
      [this](AsyncWebServerRequest* req) {
        if (req->url().endsWith("/scan")) {
          int n = WiFi.scanComplete();
          if (n == WIFI_SCAN_RUNNING) { req->send(202, "application/json", "[]"); return; }
          if (n < 0) {  // no scan yet or previous failed — kick off a fresh one.
            // async, hidden=false, passive=false, 100 ms/channel: short dwell
            // minimises disruption of the live STA connection during the scan.
            WiFi.scanNetworks(/*async=*/true, /*hidden=*/false, /*passive=*/false, 100);
            req->send(202, "application/json", "[]");
            return;
          }
          JsonDocument doc;
          JsonArray arr = doc.to<JsonArray>();
          for (int i = 0; i < n; ++i) {
            JsonObject o = arr.add<JsonObject>();
            o["ssid"] = WiFi.SSID(i);
            o["rssi"] = WiFi.RSSI(i);
            o["open"] = WiFi.encryptionType(i) == WIFI_AUTH_OPEN;
          }
          WiFi.scanDelete();
          String out;
          serializeJson(doc, out);
          req->send(200, "application/json", out);
          return;
        }
        Preferences prefs;
        prefs.begin("brewctrl", true);
        String host = prefs.getString("hostname", "brewcontrol");
        prefs.end();
        JsonDocument doc;
        doc["connected"] = WiFi.status() == WL_CONNECTED;
        doc["ssid"] = WiFi.SSID();
        doc["ip"] = WiFi.localIP().toString();
        doc["rssi"] = WiFi.RSSI();
        doc["mac"] = WiFi.macAddress();
        doc["hostname"] = host;
        String out;
        serializeJson(doc, out);
        req->send(200, "application/json", out);
      }));

  // POST /api/network — change WiFi credentials and/or hostname, then reboot.
  // Body: {"ssid","password"} to switch network, {"hostname"} to rename, or both.
  // Both only take effect on the next boot (main.cpp reads NVS), so we reboot.
  server_.addHandler(new PostJsonHandler("/api/network",
      [this](AsyncWebServerRequest* req, JsonVariant& json) {
        if (!json.is<JsonObject>()) { req->send(400, "text/plain", "invalid JSON"); return; }
        JsonObject o = json.as<JsonObject>();
        const bool hasSsid = o["ssid"].is<const char*>();
        const bool hasHost = o["hostname"].is<const char*>();
        if (!hasSsid && !hasHost) { req->send(400, "text/plain", "nothing to change"); return; }
        String ssid, password, hostname;
        if (hasSsid) {
          ssid = o["ssid"].as<const char*>();
          password = o["password"] | "";
          if (ssid.isEmpty()) { req->send(400, "text/plain", "missing ssid"); return; }
        }
        if (hasHost) {
          hostname = o["hostname"].as<const char*>();
          hostname.toLowerCase();
          if (!validHostname(hostname)) { req->send(400, "text/plain", "invalid hostname"); return; }
        }
        Preferences prefs;
        prefs.begin("brewctrl", false);
        if (hasSsid) { prefs.putString("ssid", ssid); prefs.putString("password", password); }
        if (hasHost) { prefs.putString("hostname", hostname); }
        prefs.end();
        req->send(204);
        rebootAtMs_ = millis() + kRebootDelayMs;
      }));

  // ── Bus scan ──────────────────────────────────────────────────────────────
  server_.on("/api/bus/scan", HTTP_GET, [this](AsyncWebServerRequest* req) {
    if (!req->hasParam("type") || !req->hasParam("pin")) {
      req->send(400, "text/plain", "missing type or pin");
      return;
    }
    if (req->getParam("type")->value() != "onewire") {
      req->send(400, "text/plain", "unsupported bus type");
      return;
    }
    int pin = req->getParam("pin")->value().toInt();

    uint8_t addrs[8][8] = {};
    uint8_t n = items_.scanOneWireBus(pin, addrs, 8);

    JsonDocument doc;
    doc["type"] = "onewire";
    doc["pin"] = pin;
    JsonArray devs = doc["devices"].to<JsonArray>();
    for (uint8_t i = 0; i < n; ++i) {
      char hex[17] = {};
      for (uint8_t b = 0; b < 8; ++b) snprintf(hex + 2 * b, 3, "%02x", addrs[i][b]);
      JsonObject d = devs.add<JsonObject>();
      d["index"] = i;
      d["address"] = hex;
    }
    String out;
    serializeJson(doc, out);
    req->send(200, "application/json", out);
  });

  // ── Remote discovery ──────────────────────────────────────────────────────
  // GET /api/remote/discover?transport=mqtt|espnow|websocket — same async shape as
  // /api/network/scan: the first call arms a scan (202), 202 while it runs
  // (~3 s window), then 200 + the collected items once, after which the next
  // call starts a fresh scan. The request itself goes out from loop()
  // (RemoteDiscovery::tick), never from this async_tcp handler.
  server_.on("/api/remote/discover", HTTP_GET, [this](AsyncWebServerRequest* req) {
    if (!req->hasParam("transport")) { req->send(400, "text/plain", "missing transport"); return; }
    const String transport = req->getParam("transport")->value();
    if (transport != "mqtt" && transport != "espnow" && transport != "websocket") {
      req->send(400, "text/plain", "unsupported transport");
      return;
    }
    SensActCtrl::DiscoveryScanner* scanner = discovery_.scanner(transport);
    if (!scanner) { req->send(409, "text/plain", transport + " not available"); return; }

    using Status = SensActCtrl::DiscoveryScanner::Status;
    if (scanner->status() != Status::Done) {
      scanner->requestScan();  // no-op while one is already running
      req->send(202, "application/json", "{}");
      return;
    }
    const auto found = scanner->takeResults();
    JsonDocument doc;
    doc["transport"] = transport;
    JsonArray arr = doc["items"].to<JsonArray>();
    for (const auto& it : found) {
      JsonObject o = arr.add<JsonObject>();
      o["device"] = it.device;
      o["prefix"] = it.prefix;
      o["kind"] = it.kind;
      o["id"] = it.id;
      o["channel_key"] = it.channelKey;
      o["quantity"] = it.quantity;
      o["unit"] = it.unit;
    }
    String out;
    serializeJson(doc, out);
    req->send(200, "application/json", out);
  });

  // GET /api/remote/peers — async mDNS browse for other boards on the LAN.
  // Same 202-poll contract as the discovery above, and for the same reason:
  // the query itself is issued and collected from loop() (MdnsBrowser::tick).
  // Whether a board is already in use is not reported here — the UI knows that
  // from GET /api/config, which it fetches for the scan anyway. This board is
  // never in the list: the ESP32 responder does not answer its own queries.
  server_.on("/api/remote/peers", HTTP_GET, [this](AsyncWebServerRequest* req) {
    using Status = MdnsBrowser::Status;
    if (peers_.status() != Status::Done) {
      peers_.requestScan();  // no-op while one is already running
      req->send(202, "application/json", "{}");
      return;
    }
    const auto found = peers_.takeResults();
    JsonDocument doc;
    JsonArray arr = doc["peers"].to<JsonArray>();
    for (const auto& p : found) {
      JsonObject o = arr.add<JsonObject>();
      o["hostname"] = p.hostname;
      o["ip"] = p.ip;
      o["device"] = p.device;
      o["prefix"] = p.prefix;
      o["ws_port"] = p.wsPort;
    }
    String out;
    serializeJson(doc, out);
    req->send(200, "application/json", out);
  });

  // GET /api/remote/pair — outcome of the last POST below. Registered before
  // it because PostJsonHandler matches the path for every method.
  server_.on("/api/remote/pair", HTTP_GET, [this](AsyncWebServerRequest* req) {
    String out;
    {
      std::lock_guard<std::mutex> lock(pairMutex_);
      JsonDocument doc;
      doc["state"] = pairBusy_ ? "running" : (pairDone_ ? "done" : "idle");
      doc["host"] = pairHost_;
      if (pairDone_) {
        doc["code"] = pairCode_;
        doc["message"] = pairMessage_;
      }
      serializeJson(doc, out);
    }
    req->send(200, "application/json", out);
  });

  // POST /api/remote/pair — {"host":"<board>.local"[,"password":"…"]}
  // Hands this device's hub URL to another board so that it dials in by
  // itself. We drive that board's own POST /api/settings, which already
  // validates the URL, persists it and reboots — hence no new endpoint on the
  // receiving side, and hence the target's password when it has one.
  //
  // Answers 202: the HTTP round trip is synchronous and therefore runs from
  // tick(), never from this async_tcp handler. Poll GET for the result.
  server_.addHandler(new PostJsonHandler("/api/remote/pair",
      [this](AsyncWebServerRequest* req, JsonVariant& json) {
        if (!json.is<JsonObject>()) { req->send(400, "text/plain", "invalid JSON"); return; }
        JsonObject o = json.as<JsonObject>();
        const char* host = o["host"] | "";
        if (!host[0]) { req->send(400, "text/plain", "missing host"); return; }
        if (!settings_.websocketHubEnabled()) {
          // No hub means no URL to hand out — the leaf would have nowhere to go.
          req->send(409, "text/plain", "websocket hub not enabled");
          return;
        }
        {
          std::lock_guard<std::mutex> lock(pairMutex_);
          if (pairBusy_) { req->send(409, "text/plain", "pairing already running"); return; }
          pairHost_ = host;
          pairPassword_ = o["password"] | "";
          pairCode_ = 0;
          pairMessage_ = "";
          pairDone_ = false;
          pairArmed_ = true;
          pairBusy_ = true;
        }
        req->send(202, "application/json", "{}");
      }));

  // ── Config (original cfgJson for all dynamic items — used by edit UI) ────
  server_.on("/api/config", HTTP_GET, [this](AsyncWebServerRequest* req) {
    req->send(200, "application/json", items_.serializeConfig());
  });

  // ── Pins (board table + occupancy, PinMap.h) ─────────────────────────────
  server_.on("/api/pins", HTTP_GET, [this](AsyncWebServerRequest* req) {
    JsonDocument doc;
    writePinsJson(currentBoard(), BREWCTL_VARIANT, items_.pinUses(), doc.to<JsonObject>());
    String out;
    serializeJson(doc, out);
    req->send(200, "application/json", out);
  });

  // ── Dashboards ────────────────────────────────────────────────────────────
  server_.on("/api/dashboards", HTTP_GET, [this](AsyncWebServerRequest* req) {
    req->send(200, "application/json", store_.serialize());
  });

  // DELETE /api/dashboards/:id
  server_.addHandler(new DeletePrefixHandler("/api/dashboards/",
      [this](AsyncWebServerRequest* req) {
        String id = req->url().substring(strlen("/api/dashboards/"));
        if (!store_.remove(id.c_str())) {
          req->send(404, "text/plain", "not found");
          return;
        }
        store_.saveToSD(fs_);
        req->send(204);
      }));

  // POST /api/dashboards/:id           — update (BodyPrefixHandler)
  // POST /api/dashboards/:id/move      — {"direction":"left"|"right"}
  server_.addHandler(new BodyPrefixHandler("/api/dashboards/",
      [this](AsyncWebServerRequest* req, const uint8_t* data, size_t len) {
        JsonDocument doc;
        if (deserializeJson(doc, data, len) != DeserializationError::Ok) {
          req->send(400, "text/plain", "invalid JSON");
          return;
        }
        String tail = req->url().substring(strlen("/api/dashboards/"));
        if (tail.endsWith("/move")) {
          String id = tail.substring(0, tail.length() - strlen("/move"));
          const char* dir = doc["direction"] | "";
          int d;
          if (strcmp(dir, "left") == 0) d = -1;
          else if (strcmp(dir, "right") == 0) d = 1;
          else { req->send(400, "text/plain", "invalid direction"); return; }
          if (!store_.move(id.c_str(), d)) {
            req->send(404, "text/plain", "not found");
            return;
          }
          store_.saveToSD(fs_);
          req->send(204);
          return;
        }
        if (!store_.update(tail.c_str(), doc.as<JsonObject>())) {
          req->send(404, "text/plain", "not found");
          return;
        }
        store_.saveToSD(fs_);
        req->send(204);
      }));

  // POST /api/dashboards — create
  server_.addHandler(new PostJsonHandler("/api/dashboards",
      [this](AsyncWebServerRequest* req, JsonVariant& json) {
        String id = store_.add(json.as<JsonObject>());
        store_.saveToSD(fs_);
        req->send(201, "application/json", "{\"id\":\"" + id + "\"}");
      }));

  // ── Data logs ───────────────────────────────────────────────────────────────
  // GET /api/logs/:id/data|download[?session=<start>] — session CSV
  // GET /api/logs/:id/sessions                        — session list (JSON)
  // Registered BEFORE the bare "/api/logs" GET: AsyncCallbackWebHandler matches
  // "/api/logs" as a prefix of "/api/logs/…", so it would otherwise swallow
  // these sub-paths. The prefix handler ignores the bare URL (no trailing '/').
  server_.addHandler(new GetPrefixHandler("/api/logs/",
      [this](AsyncWebServerRequest* req) {
        String tail = req->url().substring(strlen("/api/logs/"));
        int slash = tail.indexOf('/');
        if (slash < 0) { req->send(404); return; }
        String id   = tail.substring(0, slash);
        String verb = tail.substring(slash + 1);
        if (verb == "sessions") {
          req->send(200, "application/json", logs_.serializeSessions(id.c_str()));
          return;
        }
        bool download = (verb == "download");
        if (verb != "data" && !download) { req->send(404); return; }
        time_t start = 0;
        if (req->hasParam("session"))
          start = (time_t)atol(req->getParam("session")->value().c_str());
        String path = logs_.sessionPath(id.c_str(), start);
        bool exists = false;
        { SdLock lock; exists = !path.isEmpty() && fs_.exists(path); }
        if (!exists) {
          req->send(404, "text/plain", "no data");
          return;
        }
        req->send(fs_, path, "text/csv", download);
      }));

  server_.on("/api/logs", HTTP_GET, [this](AsyncWebServerRequest* req) {
    req->send(200, "application/json", logs_.serialize());
  });

  // DELETE /api/logs/:id                    — remove log config
  // DELETE /api/logs/:id/sessions/<start>   — delete one archived session
  server_.addHandler(new DeletePrefixHandler("/api/logs/",
      [this](AsyncWebServerRequest* req) {
        String tail = req->url().substring(strlen("/api/logs/"));
        int sp = tail.indexOf("/sessions/");
        if (sp >= 0) {
          String id = tail.substring(0, sp);
          time_t start = (time_t)atol(tail.substring(sp + strlen("/sessions/")).c_str());
          if (!logs_.deleteSession(id.c_str(), start, fs_)) {
            req->send(404, "text/plain", "not found or active");
            return;
          }
          req->send(204);
          return;
        }
        if (!logs_.remove(tail.c_str())) {
          req->send(404, "text/plain", "not found");
          return;
        }
        logs_.saveToSD(fs_);
        req->send(204);
      }));

  // POST /api/logs/:id           — update config (resets session)
  // POST /api/logs/:id/enable    — {"enabled":bool} toggle logging
  // POST /api/logs/:id/clear     — close current session, start a fresh one
  server_.addHandler(new BodyPrefixHandler("/api/logs/",
      [this](AsyncWebServerRequest* req, const uint8_t* data, size_t len) {
        JsonDocument doc;
        if (deserializeJson(doc, data, len) != DeserializationError::Ok) {
          req->send(400, "text/plain", "invalid JSON");
          return;
        }
        String tail = req->url().substring(strlen("/api/logs/"));
        if (tail.endsWith("/enable")) {
          String id = tail.substring(0, tail.length() - strlen("/enable"));
          bool en = doc["enabled"] | true;
          if (!logs_.setEnabled(id.c_str(), en)) { req->send(404); return; }
          logs_.saveToSD(fs_);
          req->send(204);
          return;
        }
        if (tail.endsWith("/clear")) {
          String id = tail.substring(0, tail.length() - strlen("/clear"));
          if (!logs_.clear(id.c_str())) { req->send(404); return; }
          req->send(204);
          return;
        }
        if (!logs_.update(tail.c_str(), doc.as<JsonObject>())) {
          req->send(404, "text/plain", "not found");
          return;
        }
        logs_.saveToSD(fs_);
        req->send(204);
      }));

  // POST /api/logs — create
  server_.addHandler(new PostJsonHandler("/api/logs",
      [this](AsyncWebServerRequest* req, JsonVariant& json) {
        String id = logs_.add(json.as<JsonObject>());
        logs_.saveToSD(fs_);
        req->send(201, "application/json", "{\"id\":\"" + id + "\"}");
      }));

  // ── Setpoint programs ───────────────────────────────────────────────────────
  server_.on("/api/programs", HTTP_GET, [this](AsyncWebServerRequest* req) {
    req->send(200, "application/json", programs_.serialize());
  });

  // DELETE /api/programs/:id — remove a program
  server_.addHandler(new DeletePrefixHandler("/api/programs/",
      [this](AsyncWebServerRequest* req) {
        String id = req->url().substring(strlen("/api/programs/"));
        if (!programs_.remove(id.c_str())) {
          req->send(404, "text/plain", "not found");
          return;
        }
        programs_.saveToSD(fs_);
        req->send(204);
      }));

  // POST /api/programs/:id           — update definition (resets to idle)
  // POST /api/programs/:id/control   — {"action":"start"|"pause"|…}
  server_.addHandler(new BodyPrefixHandler("/api/programs/",
      [this](AsyncWebServerRequest* req, const uint8_t* data, size_t len) {
        JsonDocument doc;
        if (deserializeJson(doc, data, len) != DeserializationError::Ok) {
          req->send(400, "text/plain", "invalid JSON");
          return;
        }
        String tail = req->url().substring(strlen("/api/programs/"));
        if (tail.endsWith("/control")) {
          String id = tail.substring(0, tail.length() - strlen("/control"));
          const char* action = doc["action"] | "";
          auto r = programs_.control(id.c_str(), action, reg_);
          if (!r.ok) {
            bool notFound = strcmp(r.error, "not found") == 0;
            req->send(notFound ? 404 : 400, "text/plain", r.error);
            return;
          }
          programs_.saveToSD(fs_);
          pushSnapshot_();  // setpoint changed → reflect immediately
          req->send(204);
          return;
        }
        if (!programs_.update(tail.c_str(), doc.as<JsonObject>())) {
          req->send(404, "text/plain", "not found or invalid");
          return;
        }
        programs_.saveToSD(fs_);
        req->send(204);
      }));

  // POST /api/programs — create
  server_.addHandler(new PostJsonHandler("/api/programs",
      [this](AsyncWebServerRequest* req, JsonVariant& json) {
        String id = programs_.add(json.as<JsonObject>());
        if (id.isEmpty()) {
          req->send(400, "text/plain", "invalid program");
          return;
        }
        programs_.saveToSD(fs_);
        req->send(201, "application/json", "{\"id\":\"" + id + "\"}");
      }));

  // ── Timers ───────────────────────────────────────────────────────────────────
  server_.on("/api/timers", HTTP_GET, [this](AsyncWebServerRequest* req) {
    req->send(200, "application/json", timers_.serialize());
  });

  // DELETE /api/timers/:id — remove a timer
  server_.addHandler(new DeletePrefixHandler("/api/timers/",
      [this](AsyncWebServerRequest* req) {
        String id = req->url().substring(strlen("/api/timers/"));
        if (!timers_.remove(id.c_str())) {
          req->send(404, "text/plain", "not found");
          return;
        }
        timers_.saveToSD(fs_);
        req->send(204);
      }));

  // POST /api/timers/:id           — update definition (resets to idle)
  // POST /api/timers/:id/control   — {"action":"start"|"pause"|…}
  server_.addHandler(new BodyPrefixHandler("/api/timers/",
      [this](AsyncWebServerRequest* req, const uint8_t* data, size_t len) {
        JsonDocument doc;
        if (deserializeJson(doc, data, len) != DeserializationError::Ok) {
          req->send(400, "text/plain", "invalid JSON");
          return;
        }
        String tail = req->url().substring(strlen("/api/timers/"));
        if (tail.endsWith("/control")) {
          String id = tail.substring(0, tail.length() - strlen("/control"));
          const char* action = doc["action"] | "";
          auto r = timers_.control(id.c_str(), action);
          if (!r.ok) {
            bool notFound = strcmp(r.error, "not found") == 0;
            req->send(notFound ? 404 : 400, "text/plain", r.error);
            return;
          }
          timers_.saveToSD(fs_);
          req->send(204);
          return;
        }
        if (!timers_.update(tail.c_str(), doc.as<JsonObject>())) {
          req->send(404, "text/plain", "not found or invalid");
          return;
        }
        timers_.saveToSD(fs_);
        req->send(204);
      }));

  // POST /api/timers — create
  server_.addHandler(new PostJsonHandler("/api/timers",
      [this](AsyncWebServerRequest* req, JsonVariant& json) {
        String id = timers_.add(json.as<JsonObject>());
        if (id.isEmpty()) {
          req->send(400, "text/plain", "invalid timer");
          return;
        }
        timers_.saveToSD(fs_);
        req->send(201, "application/json", "{\"id\":\"" + id + "\"}");
      }));

  // ── Web Push ────────────────────────────────────────────────────────────────
  // Setup runs through a hosted bootstrap page because subscribing needs a
  // secure context (see PushService.h). Nothing here touches the registry.

  // POST /api/push/test and /api/push/reset are registered before the bare
  // /api/push GET, so BackwardCompatible matching can't swallow them. Both are
  // body-less, so they need the auth gate by hand.
  server_.on("/api/push/test", HTTP_POST, [this](AsyncWebServerRequest* req) {
    if (!requireAuth(req)) return;
    push_.requestTest();  // actually sent from PushService::tick, off this task
    req->send(204);
  });

  server_.on("/api/push/reset", HTTP_POST, [this](AsyncWebServerRequest* req) {
    if (!requireAuth(req)) return;
    push_.reset();
    req->send(204);
  });

  // GET /api/push/keypair — the full VAPID pair. The one read besides
  // /api/backup that needs the gate: the SPA passes this on to the bootstrap
  // page so a device that has no key yet can join the existing subscription
  // instead of forcing a new keypair on everyone. Registered before the bare
  // /api/push GET so BackwardCompatible matching can't swallow it.
  server_.on("/api/push/keypair", HTTP_GET, [this](AsyncWebServerRequest* req) {
    if (!requireAuth(req)) return;
    req->send(200, "application/json", push_.serializeKeypair());
  });

  // GET /api/push — status, public key and the subscription list. Open like
  // every other read: it carries no private key and no endpoint URL.
  server_.on("/api/push", HTTP_GET, [this](AsyncWebServerRequest* req) {
    req->send(200, "application/json", push_.serialize());
  });

  // DELETE /api/push/subscription/:id — id is the slot index from GET /api/push
  server_.addHandler(new DeletePrefixHandler("/api/push/subscription/",
      [this](AsyncWebServerRequest* req) {
        String id = req->url().substring(strlen("/api/push/subscription/"));
        if (!push_.removeSubscription(id.c_str())) {
          req->send(404, "text/plain", "not found");
          return;
        }
        req->send(204);
      }));

  // POST /api/push/subscription — {publicKey, privateKey, endpoint, p256dh, auth},
  // handed over by the bootstrap page through the SPA.
  server_.addHandler(new PostJsonHandler("/api/push/subscription",
      [this](AsyncWebServerRequest* req, JsonVariant& json) {
        if (!json.is<JsonObject>()) {
          req->send(400, "text/plain", "invalid JSON");
          return;
        }
        if (!push_.setSubscription(json.as<JsonObject>())) {
          req->send(400, "text/plain", "invalid subscription");
          return;
        }
        req->send(204);
      }));

  // ── Alarms & alerts ─────────────────────────────────────────────────────────
  // Rules are persisted config; the alert history is a RAM ring pushed as the
  // "alert" SSE event. Nothing here touches the registry, so no snapshot push.

  // POST /api/alerts/clear — registered before the GET so the bare
  // /api/alerts route (BackwardCompatible matching) can't swallow it.
  // Body-less, so it needs the auth gate by hand.
  server_.on("/api/alerts/clear", HTTP_POST, [this](AsyncWebServerRequest* req) {
    if (!requireAuth(req)) return;
    alarms_.clearAlerts();
    req->send(204);
  });

  // GET /api/alerts[?since=<seq>] — full ring, or only what came after <seq>.
  // The catch-up path for a reconnected client and for pushes the event source
  // dropped.
  server_.on("/api/alerts", HTTP_GET, [this](AsyncWebServerRequest* req) {
    uint32_t since = 0;
    if (const AsyncWebParameter* p = req->getParam("since"))
      since = (uint32_t)strtoul(p->value().c_str(), nullptr, 10);
    req->send(200, "application/json", alarms_.serializeAlerts(since));
  });

  server_.on("/api/alarms", HTTP_GET, [this](AsyncWebServerRequest* req) {
    req->send(200, "application/json", alarms_.serialize());
  });

  // DELETE /api/alarms/:id — remove a rule
  server_.addHandler(new DeletePrefixHandler("/api/alarms/",
      [this](AsyncWebServerRequest* req) {
        String id = req->url().substring(strlen("/api/alarms/"));
        if (!alarms_.remove(id.c_str())) {
          req->send(404, "text/plain", "not found");
          return;
        }
        alarms_.saveToSD(fs_);
        req->send(204);
      }));

  // POST /api/alarms/:id          — update definition (resets the latch)
  // POST /api/alarms/:id/enable   — {"enabled":bool}
  server_.addHandler(new BodyPrefixHandler("/api/alarms/",
      [this](AsyncWebServerRequest* req, const uint8_t* data, size_t len) {
        JsonDocument doc;
        if (deserializeJson(doc, data, len) != DeserializationError::Ok) {
          req->send(400, "text/plain", "invalid JSON");
          return;
        }
        String tail = req->url().substring(strlen("/api/alarms/"));
        if (tail.endsWith("/enable")) {
          String id = tail.substring(0, tail.length() - strlen("/enable"));
          if (!alarms_.setEnabled(id.c_str(), doc["enabled"] | false)) {
            req->send(404, "text/plain", "not found");
            return;
          }
          alarms_.saveToSD(fs_);
          req->send(204);
          return;
        }
        if (!alarms_.update(tail.c_str(), doc.as<JsonObject>())) {
          req->send(404, "text/plain", "not found or invalid");
          return;
        }
        alarms_.saveToSD(fs_);
        req->send(204);
      }));

  // POST /api/alarms — create
  server_.addHandler(new PostJsonHandler("/api/alarms",
      [this](AsyncWebServerRequest* req, JsonVariant& json) {
        String id = alarms_.add(json.as<JsonObject>());
        if (id.isEmpty()) {
          req->send(400, "text/plain", "invalid alarm");
          return;
        }
        alarms_.saveToSD(fs_);
        req->send(201, "application/json", "{\"id\":\"" + id + "\"}");
      }));

  // ── Profile library ─────────────────────────────────────────────────────────
  // Reusable step templates, grouped into categories. Applying a profile to a
  // program copies its steps (see the web UI) — nothing here touches the
  // registry, so no snapshot push.
  server_.on("/api/profiles", HTTP_GET, [this](AsyncWebServerRequest* req) {
    req->send(200, "application/json", profiles_.serialize());
  });

  // DELETE /api/profiles/:id
  server_.addHandler(new DeletePrefixHandler("/api/profiles/",
      [this](AsyncWebServerRequest* req) {
        String id = req->url().substring(strlen("/api/profiles/"));
        if (!profiles_.removeProfile(id.c_str())) {
          req->send(404, "text/plain", "not found");
          return;
        }
        profiles_.saveToSD(fs_);
        req->send(204);
      }));

  // POST /api/profiles/:id — update
  server_.addHandler(new BodyPrefixHandler("/api/profiles/",
      [this](AsyncWebServerRequest* req, const uint8_t* data, size_t len) {
        JsonDocument doc;
        if (deserializeJson(doc, data, len) != DeserializationError::Ok) {
          req->send(400, "text/plain", "invalid JSON");
          return;
        }
        String id = req->url().substring(strlen("/api/profiles/"));
        if (!profiles_.updateProfile(id.c_str(), doc.as<JsonObject>())) {
          req->send(404, "text/plain", "not found or invalid");
          return;
        }
        profiles_.saveToSD(fs_);
        req->send(204);
      }));

  // POST /api/profiles — create
  server_.addHandler(new PostJsonHandler("/api/profiles",
      [this](AsyncWebServerRequest* req, JsonVariant& json) {
        String id = profiles_.addProfile(json.as<JsonObject>());
        if (id.isEmpty()) {
          req->send(400, "text/plain", "invalid profile");
          return;
        }
        profiles_.saveToSD(fs_);
        req->send(201, "application/json", "{\"id\":\"" + id + "\"}");
      }));

  // Categories live on their own path stem so that neither the
  // /api/profiles/ prefix handlers above nor a profile id can shadow them.
  // No GET — the categories ride along in GET /api/profiles.

  // DELETE /api/profile-categories/:id — also removes the profiles in it
  server_.addHandler(new DeletePrefixHandler("/api/profile-categories/",
      [this](AsyncWebServerRequest* req) {
        String id = req->url().substring(strlen("/api/profile-categories/"));
        if (!profiles_.removeCategory(id.c_str())) {
          req->send(404, "text/plain", "not found");
          return;
        }
        profiles_.saveToSD(fs_);
        req->send(204);
      }));

  // POST /api/profile-categories/:id — rename
  server_.addHandler(new BodyPrefixHandler("/api/profile-categories/",
      [this](AsyncWebServerRequest* req, const uint8_t* data, size_t len) {
        JsonDocument doc;
        if (deserializeJson(doc, data, len) != DeserializationError::Ok) {
          req->send(400, "text/plain", "invalid JSON");
          return;
        }
        String id = req->url().substring(strlen("/api/profile-categories/"));
        if (!profiles_.updateCategory(id.c_str(), doc.as<JsonObject>())) {
          req->send(404, "text/plain", "not found or invalid");
          return;
        }
        profiles_.saveToSD(fs_);
        req->send(204);
      }));

  // POST /api/profile-categories — create
  server_.addHandler(new PostJsonHandler("/api/profile-categories",
      [this](AsyncWebServerRequest* req, JsonVariant& json) {
        String id = profiles_.addCategory(json.as<JsonObject>());
        if (id.isEmpty()) {
          req->send(400, "text/plain", "invalid category");
          return;
        }
        profiles_.saveToSD(fs_);
        req->send(201, "application/json", "{\"id\":\"" + id + "\"}");
      }));

  // ── Settings ──────────────────────────────────────────────────────────────
  server_.on("/api/settings", HTTP_GET, [this](AsyncWebServerRequest* req) {
    // Splice in live (non-persisted) state the settings store itself
    // doesn't know about — whether the configured MQTT broker is actually
    // reachable right now, not just what was last saved.
    JsonDocument doc;
    deserializeJson(doc, settings_.serialize());
    doc["mqtt"]["connected"] = mqtt_.connected();
    doc["mqtt"]["error"] = mqtt_.lastErrorMessage();
    doc["webhook"]["connected"] = webhook_.publishConnected();
    doc["webhook"]["error"] = webhook_.publishLastErrorMessage();
    doc["websocket"]["connected"] = websocket_.publishConnected();
    doc["websocket"]["error"] = websocket_.publishLastErrorMessage();
    doc["websocket"]["hubClients"] = websocket_.hubClientCount();
    doc["espnow"]["connected"] = espnow_.connected();
    doc["espnow"]["error"] = espnow_.lastErrorMessage();
    // mqtt.password is write-only: never echo the stored secret. Report only
    // whether one is set; POST /api/settings treats "" as "keep unchanged".
    doc["mqtt"]["passwordSet"] = settings_.mqttPassword().length() > 0;
    doc["mqtt"]["password"] = "";
    String out;
    serializeJson(doc, out);
    req->send(200, "application/json", out);
  });

  // POST /api/settings — must be BEFORE serveStatic (pattern from rest of file)
  server_.addHandler(new PostJsonHandler("/api/settings",
      [this](AsyncWebServerRequest* req, JsonVariant& json) {
        if (!json.is<JsonObject>()) { req->send(400, "text/plain", "invalid JSON"); return; }
        JsonObject obj = json.as<JsonObject>();
        // Validate enum fields before storing
        JsonObject theme = obj["theme"].as<JsonObject>();
        if (!theme.isNull()) {
          if (const char* m = theme["mode"]) {
            if (strcmp(m,"light")!=0 && strcmp(m,"dark")!=0 && strcmp(m,"system")!=0) {
              req->send(400, "text/plain", "invalid mode"); return;
            }
          }
          if (const char* b = theme["background"]) {
            if (strcmp(b,"neutral")!=0 && strcmp(b,"warm")!=0 && strcmp(b,"cool")!=0) {
              req->send(400, "text/plain", "invalid background"); return;
            }
          }
          if (const char* s = theme["secondary"]) {
            if (!isHexColor(s)) {
              req->send(400, "text/plain", "invalid secondary"); return;
            }
          }
          if (const char* a = theme["accent"]) {
            if (!isHexColor(a)) {
              req->send(400, "text/plain", "invalid accent"); return;
            }
          }
        }
        JsonObject fw = obj["firmware"].as<JsonObject>();
        if (!fw.isNull()) {
          if (const char* c = fw["channel"]) {
            if (strcmp(c,"stable")!=0 && strcmp(c,"preview")!=0) {
              req->send(400, "text/plain", "invalid channel"); return;
            }
          }
        }
        JsonObject t = obj["time"].as<JsonObject>();
        if (!t.isNull()) {
          if (t["utcOffsetSec"].is<int>()) {
            int32_t v = t["utcOffsetSec"].as<int32_t>();
            if (v < -43200 || v > 50400) { req->send(400, "text/plain", "invalid utcOffsetSec"); return; }
          }
          if (t["dstOffsetSec"].is<int>()) {
            int32_t v = t["dstOffsetSec"].as<int32_t>();
            if (v < 0 || v > 7200) { req->send(400, "text/plain", "invalid dstOffsetSec"); return; }
          }
          if (const char* f = t["timeFormat"]) {
            if (strcmp(f,"24h")!=0 && strcmp(f,"12h")!=0) { req->send(400, "text/plain", "invalid timeFormat"); return; }
          }
          if (const char* f = t["dateFormat"]) {
            if (strcmp(f,"DD.MM.YYYY")!=0 && strcmp(f,"MM/DD/YYYY")!=0 && strcmp(f,"YYYY-MM-DD")!=0) {
              req->send(400, "text/plain", "invalid dateFormat"); return;
            }
          }
        }
        JsonObject mqtt = obj["mqtt"].as<JsonObject>();
        if (!mqtt.isNull()) {
          if (const char* m = mqtt["mode"]) {
            if (strcmp(m,"external")!=0 && strcmp(m,"embedded")!=0) {
              req->send(400, "text/plain", "invalid mqtt mode"); return;
            }
#ifndef BREWCTL_HAS_EMBEDDED_MQTT_BROKER
            if (strcmp(m,"embedded")==0) {
              req->send(400, "text/plain", "embedded broker not supported on this board"); return;
            }
#endif
          }
          if (mqtt["port"].is<int>()) {
            int32_t p = mqtt["port"].as<int32_t>();
            if (p < 1 || p > 65535) { req->send(400, "text/plain", "invalid mqtt port"); return; }
          }
          if (const char* tp = mqtt["topicPrefix"]) {
            if (strchr(tp, '/')) {
              req->send(400, "text/plain", "invalid mqtt topicPrefix"); return;
            }
          }
          if (const char* cid = mqtt["clientId"]) {
            if (strchr(cid, '/')) {
              req->send(400, "text/plain", "invalid mqtt clientId"); return;
            }
          }
        }
        JsonObject webhook = obj["webhook"].as<JsonObject>();
        if (!webhook.isNull()) {
          if (webhook["listenPort"].is<int>()) {
            int32_t p = webhook["listenPort"].as<int32_t>();
            if (p < 1 || p > 65535) { req->send(400, "text/plain", "invalid webhook listenPort"); return; }
          }
          if (const char* tp = webhook["topicPrefix"]) {
            if (strchr(tp, '/')) {
              req->send(400, "text/plain", "invalid webhook topicPrefix"); return;
            }
          }
          if (const char* cid = webhook["clientId"]) {
            if (strchr(cid, '/')) {
              req->send(400, "text/plain", "invalid webhook clientId"); return;
            }
          }
        }
        JsonObject websocket = obj["websocket"].as<JsonObject>();
        if (!websocket.isNull()) {
          if (websocket["hubPort"].is<int>()) {
            int32_t p = websocket["hubPort"].as<int32_t>();
            if (p < 1 || p > 65535) { req->send(400, "text/plain", "invalid websocket hubPort"); return; }
          }
          if (const char* url = websocket["hubUrl"]) {
            if (*url && strncmp(url, "ws://", 5) != 0) {
              req->send(400, "text/plain", "invalid websocket hubUrl"); return;
            }
          }
          if (const char* tp = websocket["topicPrefix"]) {
            if (strchr(tp, '/')) {
              req->send(400, "text/plain", "invalid websocket topicPrefix"); return;
            }
          }
          if (const char* cid = websocket["clientId"]) {
            if (strchr(cid, '/')) {
              req->send(400, "text/plain", "invalid websocket clientId"); return;
            }
          }
        }
        JsonObject espnow = obj["espnow"].as<JsonObject>();
        if (!espnow.isNull()) {
          if (const char* tp = espnow["topicPrefix"]) {
            if (strchr(tp, '/')) {
              req->send(400, "text/plain", "invalid espnow topicPrefix"); return;
            }
          }
          if (const char* cid = espnow["clientId"]) {
            if (strchr(cid, '/')) {
              req->send(400, "text/plain", "invalid espnow clientId"); return;
            }
          }
        }
        JsonObject display = obj["display"].as<JsonObject>();
        if (!display.isNull()) {
          for (const char* key : {"dimAfterSec", "offAfterSec"}) {
            if (display[key].isNull()) continue;
            const int32_t v = display[key].is<int>() ? display[key].as<int32_t>() : -1;
            if (v < 0 || v > 86400) {
              req->send(400, "text/plain", String("invalid display ") + key); return;
            }
          }
          for (const char* key : {"brightness", "dimPercent"}) {
            if (display[key].isNull()) continue;
            const int32_t v = display[key].is<int>() ? display[key].as<int32_t>() : 0;
            if (v < 1 || v > 100) {
              req->send(400, "text/plain", String("invalid display ") + key); return;
            }
          }
        }
        settings_.update(obj);
        settings_.saveToSD(fs_);
        if (!t.isNull()) {
          configTime(settings_.utcOffsetSec(), settings_.dstOffsetSec(),
                     settings_.ntpServer().c_str());
        }
        req->send(204);
        // MQTT/webhook/WebSocket/ESP-NOW's actual publish connection (and
        // the WebSocket hub server) is only (re-)established at boot from
        // SettingsStore — reboot so a saved change takes effect immediately,
        // same as the WiFi/hostname settings on /api/network.
        if (!mqtt.isNull() || !webhook.isNull() || !websocket.isNull() || !espnow.isNull())
          rebootAtMs_ = millis() + kRebootDelayMs;
      }));

  // ── Firmware update ────────────────────────────────────────────────────────
  server_.on("/api/update/status", HTTP_GET, [this](AsyncWebServerRequest* req) {
    req->send(200, "application/json", updater_.statusJson());
  });

  server_.addHandler(new BodyPrefixHandler("/api/update/check",
      [this](AsyncWebServerRequest* req, const uint8_t* data, size_t len) {
        String channel;
        if (len) {
          JsonDocument doc;
          if (deserializeJson(doc, data, len) == DeserializationError::Ok)
            channel = doc["channel"] | "";
        }
        updater_.requestCheck(channel);
        req->send(202);
      }));

  server_.addHandler(new BodyPrefixHandler("/api/update/install",
      [this](AsyncWebServerRequest* req, const uint8_t* data, size_t len) {
        String channel;
        if (len) {
          JsonDocument doc;
          if (deserializeJson(doc, data, len) == DeserializationError::Ok)
            channel = doc["channel"] | "";
        }
        updater_.requestInstall(channel);
        req->send(202);
      }));

  // Multipart firmware (.bin) upload → flash. The final response is sent from
  // the upload callback (handleRequest fires with empty body otherwise).
  server_.on("/api/update/firmware", HTTP_POST,
      [](AsyncWebServerRequest* req) { /* response sent in upload cb */ },
      [this](AsyncWebServerRequest* req, const String& filename, size_t index,
             uint8_t* data, size_t len, bool final) {
        if (index == 0) {
          uploadUnauthorized_ = !requireAuth(req);
          if (uploadUnauthorized_) return;
          if (!Update.begin(UPDATE_SIZE_UNKNOWN, U_FLASH)) {
            req->send(500, "text/plain", Update.errorString());
            return;
          }
        }
        if (uploadUnauthorized_) return;
        if (len) Update.write(data, len);
        if (final) {
          if (Update.end(true)) {
            req->send(200, "text/plain", "ok");
            rebootAtMs_ = millis() + 500;
          } else {
            req->send(500, "text/plain", Update.errorString());
          }
        }
      });

  // Multipart UI package (.tar) upload → extract to kAssetTarget; for the
  // staged /www.new, swap on loopTask afterwards.
  server_.on("/api/update/assets", HTTP_POST,
      [](AsyncWebServerRequest* req) { /* response sent in upload cb */ },
      [this](AsyncWebServerRequest* req, const String& filename, size_t index,
             uint8_t* data, size_t len, bool final) {
        if (index == 0) {
          uploadUnauthorized_ = !requireAuth(req);
          if (uploadUnauthorized_) return;
          assetSink_.reset(new SdTarSink(fs_, kAssetTarget));
          TarExtractor::OpenCb open = assetSink_->openCb();
          assetNoSpace_ = "";
#ifdef BREWCTL_USE_LITTLEFS
          open = [this, open](const std::string& path, uint32_t size) {
            if (!littleFsHasRoomFor(size)) {
              assetNoSpace_ = "not enough space (" + String(path.c_str()) + ", " +
                              String(size) + " bytes)";
              return false;
            }
            return open(path, size);
          };
#endif
#ifdef BREWCTL_ASSETS_IN_PLACE
          // index.html is what makes /www count as a UI (see onNotFound). Hold
          // it back under a .part name until the whole package is extracted,
          // so an aborted upload — also a dropped connection that never
          // reaches `final` — ends on the recovery page, not on a broken UI.
          open = [open](const std::string& path, uint32_t size) {
            bool isIndex = path == "index.html" || path == "./index.html" ||
                           path == "index.html.gz" || path == "./index.html.gz";
            return open(isIndex ? path + ".part" : path, size);
          };
#endif
          assetTar_.reset(new TarExtractor(open,
                                           assetSink_->writeCb(),
                                           assetSink_->closeCb()));
          // Recursive: plain rmdir() silently no-ops on a non-empty dir, so a
          // previous failed/partial extraction would otherwise leave stale
          // files behind for this run to write into (FILE_WRITE appends
          // rather than truncates on this platform). /www.new is cleared in
          // place mode too: leftovers of an earlier staged attempt eat space.
          removeRecursive_("/www.new");
#ifdef BREWCTL_ASSETS_IN_PLACE
          removeRecursive_("/www");
#endif
          SdLock lock;
          fs_.mkdir(kAssetTarget);
          logFsUsage("start");
        }
        if (uploadUnauthorized_) return;
        if (len && assetTar_) assetTar_->feed(data, len);
        if (final) {
          logFsUsage("end");
          bool ok = assetTar_ && !assetTar_->hasError();
          String err;
          if (!ok) {
            if (assetNoSpace_.length()) {
              err = assetNoSpace_;
            } else {
              err = assetTar_ ? assetTar_->errorMsg() : "no data received";
              if (assetSink_) err += " (" + assetSink_->lastPath() + ")";
            }
            Serial.printf("asset upload failed: %s\n", err.c_str());
          }
          assetTar_.reset();
          assetSink_.reset();
#ifdef BREWCTL_ASSETS_IN_PLACE
          if (ok) {
            {
              SdLock lock;
              for (const char* f : {"/www/index.html", "/www/index.html.gz"}) {
                String part = String(f) + ".part";
                if (fs_.exists(part)) fs_.rename(part, f);
              }
            }
            req->send(200, "text/plain", "ok");
          }
#else
          if (ok) { assetSwapPending_ = true; req->send(200, "text/plain", "ok"); }
#endif
          else { req->send(500, "text/plain", "extract failed: " + err); }
        }
      });

  // ── Backup & Restore ───────────────────────────────────────────────────────
  // GET: bundle the /config stores into one downloadable JSON file.
  server_.on("/api/backup", HTTP_GET, [this](AsyncWebServerRequest* req) {
    // The only gated read: the bundle embeds settings_.serialize(), which —
    // unlike GET /api/settings — carries the MQTT password in the clear.
    if (!requireAuth(req)) return;
    String out = "{\"type\":\"brewcontrol-backup\",\"version\":1,"
                 "\"firmwareVersion\":\"";
    out += BREWCTL_VERSION;
    out += "\",\"variant\":\"";
    out += BREWCTL_VARIANT;
    out += "\",\"registry\":";
    out += items_.serializeConfig();
    out += ",\"dashboards\":";
    out += store_.serialize();
    out += ",\"settings\":";
    out += settings_.serialize();
    out += ",\"profiles\":";
    out += profiles_.serialize();
    // Definitions only: runtime state is stripped, so a restore — possibly onto
    // another device — never resumes a running program or a log session whose
    // CSV is not part of the bundle.
    out += ",\"logs\":";
    out += definitionsOnly(logs_.serialize(), {"session"});
    out += ",\"programs\":";
    out += definitionsOnly(programs_.serialize(),
                           {"stepRemainingSec", "stepStartedEpoch", "elapsedAtPauseSec"},
                           /*resetProgramState=*/true);
    out += ",\"alarms\":";
    out += definitionsOnly(alarms_.serialize(), {"active", "since", "resolved"});
    out += "}";
    AsyncWebServerResponse* resp = req->beginResponse(200, "application/json", out);
    resp->addHeader("Content-Disposition",
                    "attachment; filename=\"brewcontrol-backup.json\"");
    req->send(resp);
  });

  // POST: validate a backup bundle, overwrite the /config files, reboot.
  server_.addHandler(new PostJsonHandler("/api/backup",
      [this](AsyncWebServerRequest* req, JsonVariant& json) {
        if (!json.is<JsonObject>()) { req->send(400, "text/plain", "invalid JSON"); return; }
        JsonObject o = json.as<JsonObject>();
        if (strcmp(o["type"] | "", "brewcontrol-backup") != 0) {
          req->send(400, "text/plain", "not a brewcontrol backup"); return;
        }
        if ((o["version"] | 0) != 1) {
          req->send(400, "text/plain", "unsupported backup version"); return;
        }
        if (!o["registry"].is<JsonObject>())   { req->send(400, "text/plain", "missing registry");   return; }
        if (!o["dashboards"].is<JsonArray>())  { req->send(400, "text/plain", "missing dashboards");  return; }
        if (!o["settings"].is<JsonObject>())   { req->send(400, "text/plain", "missing settings");    return; }
        // Optional: bundles written before the profile library have no
        // "profiles" section and must stay importable.
        const bool hasProfiles = !o["profiles"].isNull();
        if (hasProfiles && !o["profiles"].is<JsonObject>()) {
          req->send(400, "text/plain", "invalid profiles"); return;
        }

        // Same for logs/programs/alarms, added later.
        for (const char* k : {"logs", "programs", "alarms"}) {
          if (!o[k].isNull() && !o[k].is<JsonArray>()) {
            req->send(400, "text/plain", String("invalid ") + k); return;
          }
        }

        // Validation passed — only now touch the filesystem.
        if (!writeSection_("/config/registry.json",   o["registry"]) ||
            !writeSection_("/config/dashboards.json",  o["dashboards"]) ||
            !writeSection_("/config/settings.json",    o["settings"]) ||
            (hasProfiles && !writeSection_("/config/profiles.json", o["profiles"])) ||
            (!o["logs"].isNull()     && !writeSection_("/config/logs.json",     o["logs"])) ||
            (!o["programs"].isNull() && !writeSection_("/config/programs.json", o["programs"])) ||
            (!o["alarms"].isNull()   && !writeSection_("/config/alarms.json",   o["alarms"]))) {
          req->send(500, "text/plain",
                    "write failed — config may be partially restored, re-import to recover");
          return;
        }
        req->send(200, "text/plain", "ok");
        rebootAtMs_ = millis() + kRebootDelayMs;
      }));

  // ── SD file manager ─────────────────────────────────────────────────────────
  // GET /api/files (list) and GET /api/files/download run the same handler,
  // dispatched by url(). Registered as exact matches (not a prefix) so that
  // GET /api/files/mkdir and GET /api/files/rename fall through to their
  // POST-only PostJsonHandlers and get a 405 instead of landing here.
  auto filesGet =
      [this](AsyncWebServerRequest* req) {
        if (!req->hasParam("path")) { req->send(400, "text/plain", "missing path"); return; }
        String path = req->getParam("path")->value();
        bool download = req->url() == "/api/files/download";
        if (!validFilePath_(path, /*forMutation=*/false, req)) return;

        if (download) {
          bool exists = false, isDir = false;
          {
            SdLock lock;
            File f = fs_.open(path);
            exists = (bool)f;
            isDir = exists && f.isDirectory();
            if (f) f.close();
          }
          if (!exists || isDir) { req->send(404, "text/plain", "not found"); return; }
          req->send(fs_, path, "application/octet-stream", /*download=*/true);
          return;
        }

        JsonDocument doc;
        doc["path"] = path;
        JsonArray arr = doc["entries"].to<JsonArray>();
        bool ok = false;
        {
          SdLock lock;
          File dir = fs_.open(path);
          if (dir && dir.isDirectory()) {
            ok = true;
            File e = dir.openNextFile();
            while (e) {
              JsonObject o = arr.add<JsonObject>();
              o["name"] = e.name();
              o["dir"] = e.isDirectory();
              o["size"] = (uint32_t)e.size();
              e.close();
              e = dir.openNextFile();
            }
          }
          if (dir) dir.close();
        }
        if (!ok) { req->send(404, "text/plain", "not a directory"); return; }
        String out;
        serializeJson(doc, out);
        req->send(200, "application/json", out);
      };
  server_.on(AsyncURIMatcher::exact("/api/files"), HTTP_GET, filesGet);
  server_.on(AsyncURIMatcher::exact("/api/files/download"), HTTP_GET, filesGet);

  // DELETE /api/files?path=<path> — file, or directory removed recursively.
  server_.on("/api/files", HTTP_DELETE, [this](AsyncWebServerRequest* req) {
    if (!requireAuth(req)) return;
    if (!req->hasParam("path")) { req->send(400, "text/plain", "missing path"); return; }
    String path = req->getParam("path")->value();
    if (!validFilePath_(path, /*forMutation=*/true, req)) return;
    if (path == "/") { req->send(400, "text/plain", "cannot delete root"); return; }
    bool exists = false;
    { SdLock lock; exists = fs_.exists(path); }
    if (!exists) { req->send(404, "text/plain", "not found"); return; }
    removeRecursive_(path.c_str());
    req->send(204);
  });

  // POST /api/files/mkdir {"path":"/foo/bar"} — creates one new level; parent
  // must already exist (mirrors DynamicItems::saveToSD's mkdir("/config")).
  server_.addHandler(new PostJsonHandler("/api/files/mkdir",
      [this](AsyncWebServerRequest* req, JsonVariant& json) {
        if (!json["path"].is<const char*>()) { req->send(400, "text/plain", "missing path"); return; }
        String path = json["path"].as<const char*>();
        if (!validFilePath_(path, /*forMutation=*/true, req)) return;
        bool ok;
        { SdLock lock; ok = fs_.mkdir(path); }
        if (!ok) { req->send(500, "text/plain", "mkdir failed"); return; }
        req->send(204);
      }));

  // POST /api/files/rename {"from":"...","to":"..."} — file or directory.
  server_.addHandler(new PostJsonHandler("/api/files/rename",
      [this](AsyncWebServerRequest* req, JsonVariant& json) {
        if (!json["from"].is<const char*>() || !json["to"].is<const char*>()) {
          req->send(400, "text/plain", "missing from/to");
          return;
        }
        String from = json["from"].as<const char*>();
        String to = json["to"].as<const char*>();
        if (!validFilePath_(from, /*forMutation=*/true, req)) return;
        if (!validFilePath_(to, /*forMutation=*/true, req)) return;
        bool fromExists = false, toExists = false;
        { SdLock lock; fromExists = fs_.exists(from); toExists = fs_.exists(to); }
        if (!fromExists) { req->send(404, "text/plain", "not found"); return; }
        if (toExists) { req->send(409, "text/plain", "destination exists"); return; }
        bool ok;
        { SdLock lock; ok = fs_.rename(from, to); }
        if (!ok) { req->send(500, "text/plain", "rename failed"); return; }
        req->send(204);
      }));

  // Multipart upload → /api/files/upload?path=<dir>, field name "f" (same
  // response-from-onUpload pattern as /api/update/firmware and
  // /api/update/assets above).
  server_.on("/api/files/upload", HTTP_POST,
      [](AsyncWebServerRequest* req) { /* response sent in upload cb */ },
      [this](AsyncWebServerRequest* req, const String& filename, size_t index,
             uint8_t* data, size_t len, bool final) {
        if (index == 0) {
          fileUploadRejected_ = false;
          if (!requireAuth(req)) { fileUploadRejected_ = true; return; }
          String dir = req->hasParam("path") ? req->getParam("path")->value() : "";
          if (!validFilePath_(dir, /*forMutation=*/true, req)) { fileUploadRejected_ = true; return; }
          bool nameOk = !filename.isEmpty() && filename.indexOf('/') < 0 && filename != "..";
          bool dirExists = false;
          {
            SdLock lock;
            File d = fs_.open(dir);
            dirExists = d && d.isDirectory();
            if (d) d.close();
          }
          if (!nameOk || !dirExists) {
            req->send(400, "text/plain", "invalid filename or directory");
            fileUploadRejected_ = true;
            return;
          }
          fileUploadPath_ = dir + "/" + filename;
          SdLock lock;
          fileUpload_ = fs_.open(fileUploadPath_, FILE_WRITE);
          if (!fileUpload_) {
            req->send(500, "text/plain", "open failed");
            fileUploadRejected_ = true;
            return;
          }
        }
        if (fileUploadRejected_) return;
        if (len) {
          SdLock lock;
          if (fileUpload_.write(data, len) != len) {
            fileUpload_.close();
            fs_.remove(fileUploadPath_);
            req->send(500, "text/plain", "write failed — partial file removed");
            fileUploadRejected_ = true;
            return;
          }
        }
        if (final) {
          { SdLock lock; fileUpload_.close(); }
          req->send(200, "text/plain", "ok");
        }
      });

  server_.serveStatic("/", fs_, "/www")
      .setDefaultFile("index.html")
      .setCacheControl("max-age=600");

  // SPA fallback: serve index.html for unknown GET paths so client-side routes work
  // Only navigation-style paths get the SPA/recovery page; anything with a file
  // extension (/assets/x.js, /favicon.ico) is an asset request and answers 404 —
  // otherwise an SD hiccup would hand HTML to a <script> tag.
  server_.onNotFound([this](AsyncWebServerRequest* req) {
    const String url = req->url();
    const bool isAsset = url.indexOf('.', url.lastIndexOf('/')) >= 0;
    if (req->method() == HTTP_GET && !url.startsWith("/api/") && !isAsset) {
      bool haveUi;
      {
        SdLock lock;
        haveUi = fs_.exists("/www/index.html") || fs_.exists("/www/index.html.gz");
      }
      if (haveUi) req->send(fs_, "/www/index.html", "text/html");
      else req->send(200, "text/html", kRecoveryPageHtml);
    } else {
      req->send(404, "text/plain", "Not Found");
    }
  });

  // UI-lock gate: when auth_.isUiProtected() is on, this runs before every
  // request reaches its handler — static file, SPA fallback or API route
  // alike (server-level middleware sits in front of the whole dispatch, see
  // ESPAsyncWebServer's AsyncWebServerRequest::_runMiddlewareChain) — so it
  // covers reads too, not just the mutating routes requireAuth() already
  // gates. /api/auth/* stays exempt so logging in remains possible.
  server_.addMiddleware([this](AsyncWebServerRequest* req, ArMiddlewareNext next) {
    if (!auth_.isUiProtected() || req->url().startsWith("/api/auth/") || isAuthenticated(req)) {
      next();
      return;
    }
    if (req->method() == HTTP_GET && !req->url().startsWith("/api/")) {
      req->send(200, "text/html", kLockedPageHtml);
    } else {
      req->send(401, "text/plain", "authentication required");
    }
  });

  server_.begin();
}

// Drives another board's POST /api/settings so it connects to our hub. Runs
// from tick(), i.e. loopTask: HTTPClient is synchronous, and blocking the
// async_tcp task would freeze every request and the SSE stream for the length
// of the round trip. loopTask pays instead, bounded by kPairTimeoutMs, and
// only for this one user-triggered action.
void WebUI::runPendingPairing_() {
  String host, password;
  {
    std::lock_guard<std::mutex> lock(pairMutex_);
    if (!pairArmed_) return;
    // Consume the job but keep pairBusy_ set: it is what makes a second POST
    // answer 409 and GET report "running" while we are on the network below.
    pairArmed_ = false;
    host = pairHost_;
    password = pairPassword_;
    pairPassword_ = "";
  }

  Preferences prefs;
  prefs.begin("brewctrl", true);
  const String ownHost = prefs.getString("hostname", "brewcontrol");
  prefs.end();

  // Our hub, addressed by mDNS name rather than by IP: the leaf stores this
  // string permanently, and a DHCP lease change must not break it.
  const String hubUrl =
      "ws://" + ownHost + ".local:" + String(settings_.websocketHubPort());

  int code = 0;
  String message;

  // A protected board only accepts the settings write with a session cookie,
  // so log in first when a password came with the request.
  String cookie;
  bool loginFailed = false;
  if (!password.isEmpty()) {
    WiFiClient client;
    HTTPClient http;
    http.setConnectTimeout(kPairTimeoutMs);
    http.setTimeout(kPairTimeoutMs);
    if (!http.begin(client, "http://" + host + "/api/auth/login")) {
      code = 502;
      message = "Board " + host + " nicht erreichbar";
      loginFailed = true;
    } else {
      const char* wanted[] = {"Set-Cookie"};
      http.collectHeaders(wanted, 1);
      http.addHeader("Content-Type", "application/json");
      const int login = http.POST("{\"password\":\"" + password + "\"}");
      if (login == 200 || login == 204) {
        const String setCookie = http.header("Set-Cookie");
        const int at = setCookie.indexOf("bcsid=");
        if (at >= 0) {
          int semi = setCookie.indexOf(';', at);
          if (semi < 0) semi = setCookie.length();
          cookie = setCookie.substring(at, semi);
        }
      } else {
        code = login == 401 ? 401 : (login > 0 ? login : 502);
        message = login == 401 ? "Falsches Passwort" : "Anmeldung fehlgeschlagen";
        loginFailed = true;
      }
      http.end();
    }
  }

  if (!loginFailed) {
    WiFiClient client;
    HTTPClient http;
    http.setConnectTimeout(kPairTimeoutMs);
    http.setTimeout(kPairTimeoutMs);
    if (!http.begin(client, "http://" + host + "/api/settings")) {
      code = 502;
      message = "Board " + host + " nicht erreichbar";
    } else {
      http.addHeader("Content-Type", "application/json");
      if (!cookie.isEmpty()) http.addHeader("Cookie", cookie);
      const int res = http.POST(
          "{\"websocket\":{\"publishEnabled\":true,\"hubUrl\":\"" + hubUrl + "\"}}");
      http.end();
      if (res == 200 || res == 204) {
        code = 200;
        message = "Board gekoppelt, es startet jetzt neu";
      } else if (res == 401) {
        code = 401;
        message = "Board " + host + " ist passwortgeschützt";
      } else if (res > 0) {
        code = res;
        message = "Board antwortete mit HTTP " + String(res);
      } else {
        code = 502;
        message = "Board " + host + " nicht erreichbar";
      }
    }
  }

  std::lock_guard<std::mutex> lock(pairMutex_);
  pairCode_ = code;
  pairMessage_ = message;
  pairDone_ = true;
  pairBusy_ = false;
}

void WebUI::tick() {
  if (assetSwapPending_) {
    assetSwapPending_ = false;
    swapAssets_();
  }
  uint32_t now = millis();
  if (rebootAtMs_ != 0 && now >= rebootAtMs_) ESP.restart();
  runPendingPairing_();
  logs_.tick(reg_, fs_, time(nullptr), now);
  programs_.tick(reg_, fs_, time(nullptr));
  timers_.tick(reg_, programs_, fs_, time(nullptr));

  // Alarm evaluation is deliberately gated to 1 Hz: it resolves every rule and
  // calls paramsJson() on every controller, which at loop rate (~5 ms) would
  // burn a lot of loopTask for a threshold that cannot be acted on faster
  // anyway. Debounce inside the store works on millis(), not on tick count.
  if (now - lastAlarmMs_ >= 1000) {
    lastAlarmMs_ = now;
    alarms_.tick(reg_, time(nullptr), now);
  }
  // Drain new alerts here rather than sending from inside the store: raise_
  // can run on the AsyncTCP task (program control), and the bound keeps a
  // burst from monopolising loopTask. AsyncEventSource drops silently when a
  // client's queue is full — GET /api/alerts?since=<seq> is the repair path.
  String alertJson;
  for (int i = 0; i < 4 && alarms_.takePending(alertJson); ++i)
    events_.send(alertJson.c_str(), "alert", millis());
  // Same outbox, own cursor: Web Push reaches a phone with the dashboard
  // closed, which is precisely when the SSE stream above has no listener.
  AlarmStore::Alert alert;
  for (int i = 0; i < 4 && alarms_.takePendingPush(alert); ++i) push_.send(alert);
  if (now - lastPushMs_ >= 1000) {
    lastPushMs_ = now;
    pushSnapshot_();
  }
}

void WebUI::swapAssets_() {
  // Remove /www then rename /www.new → /www (loopTask context).
  removeRecursive_("/www");
  SdLock lock;
  if (!fs_.rename("/www.new", "/www")) {
    Serial.println(F("asset swap FAILED — rename /www.new -> /www did not succeed, UI may be unreachable"));
  }
}

void WebUI::removeRecursive_(const char* path) {
  SdLock lock;
  std::function<void(const char*)> rm = [&](const char* p) {
    File dir = fs_.open(p);
    if (!dir) return;
    if (!dir.isDirectory()) { dir.close(); fs_.remove(p); return; }
    File e = dir.openNextFile();
    while (e) {
      String child = String(p) + "/" + e.name();
      bool d = e.isDirectory(); e.close();
      if (d) rm(child.c_str()); else fs_.remove(child);
      e = dir.openNextFile();
    }
    dir.close();
    fs_.rmdir(p);
  };
  rm(path);
}

bool WebUI::writeSection_(const char* path, JsonVariantConst v) {
  SdLock lock;
  fs_.mkdir("/config");
  File f = fs_.open(path, FILE_WRITE);
  if (!f) return false;
  size_t written = serializeJson(v, f);
  f.close();
  return written > 0;
}

bool WebUI::validFilePath_(String& path, bool forMutation, AsyncWebServerRequest* req) {
  if (path.isEmpty() || path[0] != '/') {
    req->send(400, "text/plain", "path must be absolute");
    return false;
  }
  int start = 0;
  while (start < (int)path.length()) {
    int slash = path.indexOf('/', start + 1);
    int end = slash < 0 ? path.length() : slash;
    String seg = path.substring(start + 1, end);
    if (seg == "..") {
      req->send(400, "text/plain", "path traversal");
      return false;
    }
    start = end;
  }
  if (path.length() > 1 && path.endsWith("/")) path.remove(path.length() - 1);
  if (forMutation &&
      (path == "/www" || path.startsWith("/www/") ||
       path == "/www.new" || path.startsWith("/www.new/"))) {
    req->send(403, "text/plain", "protected path (UI files)");
    return false;
  }
  return true;
}

void WebUI::loadEstop_() {
  JsonDocument doc;
  bool ok = false;
  {  // Lock scoped to the read alone, per SdLock's contract.
    SdLock sdLock;
    File f = fs_.open("/config/estop.json");
    if (!f) return;  // never stopped, or no filesystem — both mean "not latched"
    ok = deserializeJson(doc, f) == DeserializationError::Ok;
    f.close();
  }
  if (!ok || !(doc["active"] | false)) return;

  estop_ = true;
  // Re-apply what POST /api/estop did to the hardware. Programs and timers
  // need no second pass: their paused state was persisted by the stop itself.
  for (auto* a : reg_.actuators()) a->setEnabled(false);
  for (auto* c : reg_.controllers()) c->setEnabled(false);
  Serial.println(F("emergency stop still latched — actuators and controllers held off"));
}

void WebUI::saveEstop_() const {
  // Runs on the AsyncTCP task while loopTask logs to the same card.
  SdLock sdLock;
  File f = fs_.open("/config/estop.json", FILE_WRITE);
  if (!f) return;
  JsonDocument doc;
  doc["active"] = estop_;
  serializeJson(doc, f);
  f.close();
}

void WebUI::pushSnapshot_() {
  size_t n = 0;
  auto buf = makeSnapshot(reg_, estop_, &n);
  if (!buf) return;
  events_.send(buf.get(), "snapshot", millis());
}

void WebUI::sendSnapshotTo_(AsyncEventSourceClient* c) {
  size_t n = 0;
  auto buf = makeSnapshot(reg_, estop_, &n);
  if (!buf) return;
  c->send(buf.get(), "snapshot", millis());
}

}  // namespace BrewControl
