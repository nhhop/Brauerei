#include "WebUI.h"

#include <ArduinoJson.h>
#include <Preferences.h>
#include <Update.h>
#include <WiFi.h>
#include <functional>
#include <math.h>
#include <memory>
#include <time.h>

#include "Hostname.h"
#include "SdLock.h"
#include "version.h"

namespace BrewControl {
namespace {

constexpr size_t kSnapshotCap = 4160;
constexpr uint32_t kRebootDelayMs = 500;

// Upper bound for a buffered request body (see collectBody). Sized for the
// largest realistic payload, the backup bundle: the whole /config tree as one
// JSON document. Allocated only for bodies that actually span several chunks,
// and only for as long as the request lives.
constexpr size_t kMaxBodyBytes = 16384;

std::unique_ptr<char[]> makeSnapshot(SensActCtrl::Registry& reg, size_t* outLen) {
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
    if (const uint8_t* body = collectBody(req, data, len, index, total))
      cb_(req, body, total);
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

// Matches DELETE <prefix>* requests (no body).
class DeletePrefixHandler : public AsyncWebHandler {
 public:
  using Cb = std::function<void(AsyncWebServerRequest*)>;
  DeletePrefixHandler(const char* prefix, Cb cb)
      : prefix_(prefix), cb_(std::move(cb)) {}

  bool canHandle(AsyncWebServerRequest* req) const override {
    return req->method() == HTTP_DELETE && req->url().startsWith(prefix_);
  }
  void handleRequest(AsyncWebServerRequest* req) override { cb_(req); }
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

}  // namespace

WebUI::WebUI(SensActCtrl::Registry& reg, fs::FS& fs, DynamicItems& items,
             DashboardStore& store, SettingsStore& settings,
             FirmwareUpdater& updater, LogStore& logs, ProgramRunner& programs,
             ProfileStore& profiles, MqttService& mqtt, WebhookService& webhook,
             EspNowPublishService& espnow, uint16_t port)
    : reg_(reg), fs_(fs), items_(items), store_(store), settings_(settings),
      updater_(updater), logs_(logs), programs_(programs), profiles_(profiles),
      mqtt_(mqtt), webhook_(webhook), espnow_(espnow),
      server_(port), events_("/api/events") {}

void WebUI::begin() {
  // ── Snapshot ─────────────────────────────────────────────────────────────
  server_.on("/api/snapshot", HTTP_GET, [this](AsyncWebServerRequest* req) {
    size_t n = 0;
    auto buf = makeSnapshot(reg_, &n);
    if (!buf) { req->send(503, "text/plain", "snapshot unavailable"); return; }
    auto* resp = req->beginResponseStream("application/json", n);
    resp->write(reinterpret_cast<const uint8_t*>(buf.get()), n);
    req->send(resp);
  });

  events_.onConnect([this](AsyncEventSourceClient* c) { sendSnapshotTo_(c); });
  server_.addHandler(&events_);

  // ── Delete (prefix, no body) ──────────────────────────────────────────────
  server_.addHandler(new DeletePrefixHandler("/api/sensors/",
      [this](AsyncWebServerRequest* req) {
        String id = req->url().substring(strlen("/api/sensors/"));
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

  // ── Reset sensor accumulated state (e.g. YF-S201 volume) ──────────────────
  server_.addHandler(new BodyPrefixHandler("/api/sensors/",
      [this](AsyncWebServerRequest* req, const uint8_t*, size_t) {
        const String url = req->url();
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
        JsonDocument doc;
        if (deserializeJson(doc, data, len) != DeserializationError::Ok) {
          req->send(400, "text/plain", "invalid JSON");
          return;
        }
        String id = req->url().substring(strlen("/api/actuators/"));
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
        if (!isSp && !isPr) { req->send(404); return; }
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
        if (!r.ok) { req->send(400, "text/plain", r.error); return; }
        items_.saveToSD(fs_);
        pushSnapshot_();
        req->send(204);
      }));

  server_.addHandler(new PostJsonHandler("/api/actuators",
      [this](AsyncWebServerRequest* req, JsonVariant& json) {
        auto r = items_.addActuator(json.as<JsonObject>(), reg_);
        if (!r.ok) { req->send(400, "text/plain", r.error); return; }
        items_.saveToSD(fs_);
        pushSnapshot_();
        req->send(204);
      }));

  server_.addHandler(new PostJsonHandler("/api/controllers",
      [this](AsyncWebServerRequest* req, JsonVariant& json) {
        auto r = items_.addController(json.as<JsonObject>(), reg_);
        if (!r.ok) { req->send(400, "text/plain", r.error); return; }
        items_.saveToSD(fs_);
        pushSnapshot_();
        req->send(204);
      }));

  // ── Admin ─────────────────────────────────────────────────────────────────
  server_.on("/api/admin/wifi-reset", HTTP_POST,
             [this](AsyncWebServerRequest* req) {
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

  // ── Config (original cfgJson for all dynamic items — used by edit UI) ────
  server_.on("/api/config", HTTP_GET, [this](AsyncWebServerRequest* req) {
    req->send(200, "application/json", items_.serializeConfig());
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

  // POST /api/dashboards/:id — update (BodyPrefixHandler)
  server_.addHandler(new BodyPrefixHandler("/api/dashboards/",
      [this](AsyncWebServerRequest* req, const uint8_t* data, size_t len) {
        JsonDocument doc;
        if (deserializeJson(doc, data, len) != DeserializationError::Ok) {
          req->send(400, "text/plain", "invalid JSON");
          return;
        }
        String id = req->url().substring(strlen("/api/dashboards/"));
        if (!store_.update(id.c_str(), doc.as<JsonObject>())) {
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
          if (const char* a = theme["accent"]) {
            if (strlen(a) != 7 || a[0] != '#') {
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
        settings_.update(obj);
        settings_.saveToSD(fs_);
        if (!t.isNull()) {
          configTime(settings_.utcOffsetSec(), settings_.dstOffsetSec(),
                     settings_.ntpServer().c_str());
        }
        req->send(204);
        // MQTT/webhook/ESP-NOW's actual publish connection is only
        // (re-)established at boot from SettingsStore — reboot so a saved
        // change takes effect immediately, same as the WiFi/hostname
        // settings on /api/network.
        if (!mqtt.isNull() || !webhook.isNull() || !espnow.isNull())
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
          if (!Update.begin(UPDATE_SIZE_UNKNOWN, U_FLASH)) {
            req->send(500, "text/plain", Update.errorString());
            return;
          }
        }
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

  // Multipart UI package (.tar) upload → extract to /www.new, swap on loopTask.
  server_.on("/api/update/assets", HTTP_POST,
      [](AsyncWebServerRequest* req) { /* response sent in upload cb */ },
      [this](AsyncWebServerRequest* req, const String& filename, size_t index,
             uint8_t* data, size_t len, bool final) {
        if (index == 0) {
          assetSink_.reset(new SdTarSink(fs_, "/www.new"));
          assetTar_.reset(new TarExtractor(assetSink_->openCb(),
                                           assetSink_->writeCb(),
                                           assetSink_->closeCb()));
          // Clear staging dir.
          SdLock lock;
          fs_.rmdir("/www.new");
          fs_.mkdir("/www.new");
        }
        if (len && assetTar_) assetTar_->feed(data, len);
        if (final) {
          bool ok = assetTar_ && !assetTar_->hasError();
          assetTar_.reset();
          assetSink_.reset();
          if (ok) { assetSwapPending_ = true; req->send(200, "text/plain", "ok"); }
          else { req->send(500, "text/plain", "extract failed"); }
        }
      });

  // ── Backup & Restore ───────────────────────────────────────────────────────
  // GET: bundle the /config stores into one downloadable JSON file.
  server_.on("/api/backup", HTTP_GET, [this](AsyncWebServerRequest* req) {
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

        // Validation passed — only now touch the filesystem.
        if (!writeSection_("/config/registry.json",   o["registry"]) ||
            !writeSection_("/config/dashboards.json",  o["dashboards"]) ||
            !writeSection_("/config/settings.json",    o["settings"]) ||
            (hasProfiles && !writeSection_("/config/profiles.json", o["profiles"]))) {
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
  server_.onNotFound([this](AsyncWebServerRequest* req) {
    if (req->method() == HTTP_GET && !req->url().startsWith("/api/")) {
      req->send(fs_, "/www/index.html", "text/html");
    } else {
      req->send(404, "text/plain", "Not Found");
    }
  });

  server_.begin();
}

void WebUI::tick() {
  if (assetSwapPending_) {
    assetSwapPending_ = false;
    swapAssets_();
  }
  uint32_t now = millis();
  if (rebootAtMs_ != 0 && now >= rebootAtMs_) ESP.restart();
  logs_.tick(reg_, fs_, time(nullptr), now);
  programs_.tick(reg_, fs_, time(nullptr));
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

void WebUI::pushSnapshot_() {
  size_t n = 0;
  auto buf = makeSnapshot(reg_, &n);
  if (!buf) return;
  events_.send(buf.get(), "snapshot", millis());
}

void WebUI::sendSnapshotTo_(AsyncEventSourceClient* c) {
  size_t n = 0;
  auto buf = makeSnapshot(reg_, &n);
  if (!buf) return;
  c->send(buf.get(), "snapshot", millis());
}

}  // namespace BrewControl
