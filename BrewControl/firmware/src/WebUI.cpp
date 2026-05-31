#include "WebUI.h"

#include <ArduinoJson.h>
#include <AsyncJson.h>
#include <Preferences.h>
#include <functional>
#include <math.h>
#include <memory>

namespace BrewControl {
namespace {

constexpr size_t kSnapshotCap = 4096;
constexpr uint32_t kRebootDelayMs = 500;

std::unique_ptr<char[]> makeSnapshot(SensActCtrl::Registry& reg, size_t* outLen) {
  auto buf = std::unique_ptr<char[]>(new (std::nothrow) char[kSnapshotCap]);
  if (!buf) { *outLen = 0; return buf; }
  *outLen = SensActCtrl::serializeRegistry(reg, buf.get(), kSnapshotCap);
  return buf;
}

// Matches POST <prefix>* requests and delivers the body in a single call.
// Used for write and create routes where the URL contains a path param or
// the body must be parsed. For small API payloads (< kSnapshotCap) the body
// always arrives in one chunk, so we reject multi-chunk deliveries (413).
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
    if (index == 0 && len == total)
      cb_(req, data, len);
    else if (index == 0)
      req->send(413, "text/plain", "body too large");
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
  void handleRequest(AsyncWebServerRequest* req) override { cb_(req); }
  bool isRequestHandlerTrivial() const override { return false; }

 private:
  String prefix_;
  Cb cb_;
};

}  // namespace

WebUI::WebUI(SensActCtrl::Registry& reg, fs::FS& fs, DynamicItems& items,
             DashboardStore& store, uint16_t port)
    : reg_(reg), fs_(fs), items_(items), store_(store), server_(port), events_("/api/events") {}

void WebUI::begin() {
  // ── Snapshot ─────────────────────────────────────────────────────────────
  server_.on("/api/snapshot", HTTP_GET, [this](AsyncWebServerRequest* req) {
    size_t n = 0;
    auto buf = makeSnapshot(reg_, &n);
    if (!buf) { req->send(503, "text/plain", "OOM"); return; }
    auto* resp = req->beginResponseStream("application/json", n);
    resp->write(reinterpret_cast<const uint8_t*>(buf.get()), n);
    req->send(resp);
  });

  events_.onConnect([this](AsyncEventSourceClient* c) { sendSnapshotTo_(c); });
  server_.addHandler(&events_);

  // ── Delete (prefix, no body) ──────────────────────────────────────────────
  // Registered before AsyncCallbackJsonWebHandler to prevent startsWith
  // collision: "/api/actuators" matches "/api/actuators/heater" internally.
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
        float v = doc["v"] | NAN;
        if (isnan(v)) { req->send(400, "text/plain", "missing v"); return; }
        a->write(v);
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

  // ── Create (AsyncCallbackJsonWebHandler — registered last so prefix
  //    handlers above take priority for sub-paths like /api/actuators/:id) ──
  server_.addHandler(new AsyncCallbackJsonWebHandler("/api/sensors",
      [this](AsyncWebServerRequest* req, JsonVariant& json) {
        auto r = items_.addSensor(json.as<JsonObject>(), reg_);
        if (!r.ok) { req->send(400, "text/plain", r.error); return; }
        items_.saveToSD(fs_);
        pushSnapshot_();
        req->send(204);
      }));

  server_.addHandler(new AsyncCallbackJsonWebHandler("/api/actuators",
      [this](AsyncWebServerRequest* req, JsonVariant& json) {
        auto r = items_.addActuator(json.as<JsonObject>(), reg_);
        if (!r.ok) { req->send(400, "text/plain", r.error); return; }
        items_.saveToSD(fs_);
        pushSnapshot_();
        req->send(204);
      }));

  server_.addHandler(new AsyncCallbackJsonWebHandler("/api/controllers",
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

  // DELETE /api/dashboards/:id — registered before AsyncCallbackJsonWebHandler
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

  // POST /api/dashboards/:id — update (BodyPrefixHandler, before create handler)
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

  // POST /api/dashboards — create (registered last so prefix handlers above win)
  server_.addHandler(new AsyncCallbackJsonWebHandler("/api/dashboards",
      [this](AsyncWebServerRequest* req, JsonVariant& json) {
        String id = store_.add(json.as<JsonObject>());
        store_.saveToSD(fs_);
        req->send(201, "application/json", "{\"id\":\"" + id + "\"}");
      }));

  server_.serveStatic("/", fs_, "/")
      .setDefaultFile("index.html")
      .setCacheControl("max-age=600");

  // SPA fallback: serve index.html for unknown GET paths so client-side routes work
  server_.onNotFound([this](AsyncWebServerRequest* req) {
    if (req->method() == HTTP_GET && !req->url().startsWith("/api/")) {
      req->send(fs_, "/index.html", "text/html");
    } else {
      req->send(404, "text/plain", "Not Found");
    }
  });

  server_.begin();
}

void WebUI::tick() {
  uint32_t now = millis();
  if (rebootAtMs_ != 0 && now >= rebootAtMs_) ESP.restart();
  if (now - lastPushMs_ >= 1000) {
    lastPushMs_ = now;
    pushSnapshot_();
  }
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
