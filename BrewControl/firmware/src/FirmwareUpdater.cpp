#include "FirmwareUpdater.h"

#include <ArduinoJson.h>
#include <HTTPClient.h>
#include <Preferences.h>
#include <Update.h>
#include <WiFiClientSecure.h>
#include <esp_system.h>

#include "AssetInstall.h"
#include "SdLock.h"
#include "SdTarSink.h"
#include "TarExtractor.h"
#include "version.h"

namespace BrewControl {
namespace {
constexpr char kApiHost[] = "https://api.github.com";
constexpr char kRepo[] = BREWCTL_GITHUB_REPO;  // "owner/repo", from build flag
constexpr char kUserAgent[] = "BrewControl-OTA";
constexpr uint32_t kAutoCheckIntervalMs = 24UL * 60UL * 60UL * 1000UL;  // daily
// Update mode hand-over across the reboot (see runPendingInstall()).
constexpr char kNvsNamespace[] = "brewctrl";
constexpr char kNvsPendingInstall[] = "ota_install";  // channel to install from
constexpr char kNvsInstallError[] = "ota_error";      // why the last one failed

const char* resetReasonName(esp_reset_reason_t r) {
  switch (r) {
    case ESP_RST_POWERON: return "power_on";
    case ESP_RST_EXT: return "external";
    case ESP_RST_SW: return "sw";
    case ESP_RST_PANIC: return "panic";
    case ESP_RST_INT_WDT: return "int_wdt";
    case ESP_RST_TASK_WDT: return "task_wdt";
    case ESP_RST_WDT: return "wdt";
    case ESP_RST_DEEPSLEEP: return "deep_sleep";
    case ESP_RST_BROWNOUT: return "brownout";
    case ESP_RST_SDIO: return "sdio";
    default: return "unknown";
  }
}
}  // namespace

FirmwareUpdater::FirmwareUpdater(fs::FS& fs, SettingsStore& settings)
    : fs_(fs), settings_(settings) {}

void FirmwareUpdater::begin() {
  currentVersion_ = BREWCTL_VERSION;
  variant_ = BREWCTL_VARIANT;
  lastAutoCheckMs_ = millis();
  // A failed install in update mode left its reason behind. Showing it keeps
  // state_ off Idle, so the boot-time auto-check does not overwrite it.
  Preferences prefs;
  prefs.begin(kNvsNamespace, false);
  const String err = prefs.getString(kNvsInstallError, "");
  if (err.length()) prefs.remove(kNvsInstallError);
  prefs.end();
  if (err.length()) {
    error_ = err;
    state_ = State::Error;
  }
}

void FirmwareUpdater::runPendingInstall() {
  Preferences prefs;
  prefs.begin(kNvsNamespace, false);
  const String channel = prefs.getString(kNvsPendingInstall, "");
  if (channel.length()) prefs.remove(kNvsPendingInstall);
  prefs.end();
  if (channel.isEmpty()) return;

  currentVersion_ = BREWCTL_VERSION;
  variant_ = BREWCTL_VARIANT;
  Serial.printf("update mode: installing from channel %s (heap %u free / %u max block)\n",
                channel.c_str(), (unsigned)ESP.getFreeHeap(), (unsigned)ESP.getMaxAllocHeap());
  doInstall(channel);  // reboots on success
  Serial.printf("update mode: install failed: %s\n", error_.c_str());
  prefs.begin(kNvsNamespace, false);
  prefs.putString(kNvsInstallError, error_);
  prefs.end();
}

const char* FirmwareUpdater::stateName(State s) {
  switch (s) {
    case State::Idle: return "idle";
    case State::Checking: return "checking";
    case State::UpdateAvailable: return "updateAvailable";
    case State::NoUpdate: return "noUpdate";
    case State::Downloading: return "downloading";
    case State::Flashing: return "flashing";
    case State::Success: return "success";
    case State::Error: return "error";
  }
  return "idle";
}

void FirmwareUpdater::requestCheck(const String& channel) {
  pendingChannel_ = channel.length() ? channel : settings_.firmwareChannel();
  pendingCheck_ = true;
}

void FirmwareUpdater::requestInstall(const String& channel) {
  pendingChannel_ = channel.length() ? channel : settings_.firmwareChannel();
  pendingInstall_ = true;
}

void FirmwareUpdater::tick() {
  if (pendingInstall_) {
    // Not installed here: see runPendingInstall(). The 202 is already out.
    pendingInstall_ = false;
    Preferences prefs;
    prefs.begin(kNvsNamespace, false);
    prefs.putString(kNvsPendingInstall, pendingChannel_);
    prefs.end();
    Serial.println(F("install requested — rebooting into update mode"));
    delay(200);
    ESP.restart();
  }
  if (pendingCheck_) {
    pendingCheck_ = false;
    doCheck(pendingChannel_);
    return;
  }
  // Daily auto-check (only when enabled and idle).
  if (settings_.firmwareAutoCheck() && state_ == State::Idle) {
    bool due = !firstAutoCheckDone_ ||
               (millis() - lastAutoCheckMs_ >= kAutoCheckIntervalMs);
    if (due) {
      firstAutoCheckDone_ = true;
      lastAutoCheckMs_ = millis();
      doCheck(settings_.firmwareChannel());
    }
  }
}

void FirmwareUpdater::noteNetError_(int code, WiFiClientSecure& client, const String& url) {
  const int h0 = url.indexOf("//") + 2;
  netError_ = url.substring(h0, url.indexOf('/', h0)) + ": " +
              (code < 0 ? HTTPClient::errorToString(code) : String("HTTP ") + code) +
              ", heap " + ESP.getFreeHeap() + " free / " + ESP.getMaxAllocHeap() +
              " max block";
  char tls[80];
  if (client.lastError(tls, sizeof(tls)) != 0) netError_ += String(", TLS: ") + tls;
}

bool FirmwareUpdater::streamDownload(
    const String& url, std::function<bool(const uint8_t*, size_t)> sink,
    std::function<void()> onConnected) {
  // Release assets answer with a redirect to another host. HTTPClient's own
  // redirect handling keeps the first TLS session open while it handshakes
  // with the second (setURL() sets _canReuse), so two sessions' mbedTLS
  // buffers are live at once — on the S2 (~68 KB heap, 32 KB largest block)
  // that ends in "SSL - Memory allocation failed". So follow redirects by
  // hand, with the previous client fully torn down before the next connect.
  String target = url;
  for (int hop = 0; hop < 5; ++hop) {
    WiFiClientSecure client;
    client.setInsecure();
    HTTPClient http;
    http.setFollowRedirects(HTTPC_DISABLE_FOLLOW_REDIRECTS);
    const char* keys[] = {"Location"};
    http.collectHeaders(keys, 1);
    if (!http.begin(client, target)) { noteNetError_(HTTPC_ERROR_CONNECTION_REFUSED, client, target); return false; }
    http.addHeader("User-Agent", kUserAgent);
    int code = http.GET();
    if (code == HTTP_CODE_MOVED_PERMANENTLY || code == HTTP_CODE_FOUND ||
        code == HTTP_CODE_TEMPORARY_REDIRECT || code == HTTP_CODE_PERMANENT_REDIRECT) {
      target = http.header("Location");
      http.end();
      if (target.isEmpty()) { netError_ = String("HTTP ") + code + " without Location"; return false; }
      continue;
    }
    if (code != HTTP_CODE_OK) { noteNetError_(code, client, target); http.end(); return false; }
    if (onConnected) onConnected();
    return streamBody_(http, sink);
  }
  netError_ = "too many redirects";
  return false;
}

bool FirmwareUpdater::streamBody_(HTTPClient& http,
                                  std::function<bool(const uint8_t*, size_t)>& sink) {
  int total = http.getSize();
  int got = 0;
  WiFiClient* stream = http.getStreamPtr();
  uint8_t buf[1024];
  while (http.connected() && (total < 0 || got < total)) {
    feedLoopWDT();  // runs on loopTask; a full image takes longer than its WDT
    size_t avail = stream->available();
    if (avail) {
      int n = stream->readBytes(buf, avail > sizeof(buf) ? sizeof(buf) : avail);
      if (n <= 0) break;
      if (!sink(buf, static_cast<size_t>(n))) { http.end(); return false; }
      got += n;
      if (total > 0) progress_ = static_cast<uint8_t>((got * 100L) / total);
    } else {
      delay(1);
    }
  }
  http.end();
  if (total >= 0 && got < total) {
    netError_ = String("connection lost after ") + got + " of " + total + " bytes";
    return false;
  }
  return true;
}

bool FirmwareUpdater::fetchReleaseMeta(const String& channel, String& tag,
                                       String& fwUrl, String& tarUrl,
                                       String& notes) {
  WiFiClientSecure client;
  client.setInsecure();
  HTTPClient http;
  http.setFollowRedirects(HTTPC_STRICT_FOLLOW_REDIRECTS);
  String url = String(kApiHost) + "/repos/" + kRepo + "/releases" +
               (channel == "stable" ? String("/latest") : String("?per_page=10"));
  if (!http.begin(client, url)) { noteNetError_(HTTPC_ERROR_CONNECTION_REFUSED, client, url); return false; }
  http.addHeader("User-Agent", kUserAgent);
  http.addHeader("Accept", "application/vnd.github+json");
  int code = http.GET();
  if (code != HTTP_CODE_OK) { noteNetError_(code, client, url); http.end(); return false; }

  // Filter to keep only the fields we need (releases JSON is large).
  JsonDocument filter;
  filter["tag_name"] = true;
  filter["prerelease"] = true;
  filter["body"] = true;
  filter["assets"][0]["name"] = true;
  filter["assets"][0]["browser_download_url"] = true;
  // For the array form, the same filter applies element-wise.
  JsonDocument doc;
  DeserializationError err = deserializeJson(
      doc, http.getStream(), DeserializationOption::Filter(filter));
  http.end();
  if (err) { netError_ = String("release JSON: ") + err.c_str(); return false; }

  JsonObject rel;
  if (channel == "stable") {
    rel = doc.as<JsonObject>();
  } else {
    for (JsonObject r : doc.as<JsonArray>()) {
      if (r["prerelease"].as<bool>()) { rel = r; break; }
    }
    if (rel.isNull() && doc.as<JsonArray>().size() > 0)
      rel = doc[0].as<JsonObject>();  // fall back to newest overall
  }
  if (rel.isNull()) return false;

  tag = rel["tag_name"] | "";
  notes = rel["body"] | "";
  if (notes.length() > 500) notes = notes.substring(0, 500);

  String wantFw = String("firmware-") + variant_ + ".bin";
  for (JsonObject a : rel["assets"].as<JsonArray>()) {
    String name = a["name"] | "";
    String dl = a["browser_download_url"] | "";
    if (name == wantFw) fwUrl = dl;
    else if (name == "webui.tar") tarUrl = dl;
  }
  return tag.length() > 0;
}

void FirmwareUpdater::doCheck(const String& channel) {
  state_ = State::Checking;
  error_ = "";
  netError_ = "";
  String tag, fwUrl, tarUrl, notes;
  if (!fetchReleaseMeta(channel, tag, fwUrl, tarUrl, notes)) {
    error_ = "check failed";
    if (netError_.length()) error_ += " (" + netError_ + ")";
    state_ = State::Error;
    return;
  }
  if (fwUrl.length() == 0) {
    availVersion_ = tag;
    availNotes_ = String("Kein Image für Variante ") + variant_;
    state_ = State::NoUpdate;
    return;
  }
  availVersion_ = tag;
  availNotes_ = notes;
  state_ = (tag != currentVersion_) ? State::UpdateAvailable : State::NoUpdate;
}

void FirmwareUpdater::doInstall(const String& channel) {
  state_ = State::Checking;
  error_ = "";
  netError_ = "";
  progress_ = 0;
  String tag, fwUrl, tarUrl, notes;
  if (!fetchReleaseMeta(channel, tag, fwUrl, tarUrl, notes) || fwUrl.length() == 0) {
    error_ = "no installable release";
    if (netError_.length()) error_ += " (" + netError_ + ")";
    state_ = State::Error;
    return;
  }

  // 1) UI assets (non-fatal if absent): extract webui.tar the same way as a
  //    manual upload (AssetInstall.h) — staged + swap, or in place on the
  //    boards with the small data partition. A failure stops here, before the
  //    firmware is touched.
  if (tarUrl.length() > 0) {
    state_ = State::Downloading;
    progress_ = 0;
    String noSpace;
    SdTarSink sink(fs_, AssetInstall::kTarget);
    TarExtractor ex(AssetInstall::wrapOpen(sink.openCb(), noSpace), sink.writeCb(),
                    sink.closeCb());
    // prepare() only once the download is actually answering: in place it
    // clears /www, and a network failure must not cost the running UI.
    bool ok = streamDownload(
        tarUrl, [&ex](const uint8_t* d, size_t n) { return ex.feed(d, n); },
        [this]() { AssetInstall::prepare(fs_); });
    if (!ok || ex.hasError()) {
      error_ = noSpace.length() ? noSpace : String("asset download/extract failed");
      if (!noSpace.length() && netError_.length()) error_ += " (" + netError_ + ")";
      state_ = State::Error;
      return;
    }
#ifdef BREWCTL_ASSETS_IN_PLACE
    AssetInstall::finish(fs_);
#else
    AssetInstall::removeRecursive(fs_, "/www");
    {
      SdLock lock;
      fs_.rename("/www.new", "/www");
    }
#endif
  }

  // 2) Firmware: stream firmware.bin → Update (flash).
  state_ = State::Flashing;
  progress_ = 0;
  // Content-Length unknown up front for Update.begin; use UPDATE_SIZE_UNKNOWN.
  if (!Update.begin(UPDATE_SIZE_UNKNOWN, U_FLASH)) {
    error_ = "Update.begin failed";
    state_ = State::Error;
    return;
  }
  bool ok = streamDownload(fwUrl, [](const uint8_t* d, size_t n) {
    return Update.write(const_cast<uint8_t*>(d), n) == n;
  });
  if (!ok || !Update.end(true)) {
    error_ = Update.errorString();
    if (!ok && netError_.length()) error_ += " (" + netError_ + ")";
    state_ = State::Error;
    return;
  }
  state_ = State::Success;
  delay(500);
  ESP.restart();
}

bool FirmwareUpdater::flashFromSdImage(const char* path) {
  if (!fs_.exists(path)) return false;
  File f = fs_.open(path, FILE_READ);
  if (!f) return false;
  size_t size = f.size();
  if (size == 0) { f.close(); fs_.remove(path); return false; }

  Serial.printf("SD firmware image %s (%u bytes) — flashing\n",
                path, static_cast<unsigned>(size));
  if (!Update.begin(size, U_FLASH)) {
    Serial.printf("SD flash: Update.begin failed: %s\n", Update.errorString());
    f.close();
    return false;
  }

  uint8_t buf[1024];
  size_t written = 0;
  while (f.available()) {
    size_t n = f.read(buf, sizeof(buf));
    if (n == 0) break;
    if (Update.write(buf, n) != n) {
      Serial.printf("SD flash: Update.write failed: %s\n", Update.errorString());
      Update.abort();
      f.close();
      return false;
    }
    written += n;
  }
  f.close();

  if (written != size || !Update.end(true)) {
    Serial.printf("SD flash failed (%u/%u bytes): %s\n",
                  static_cast<unsigned>(written), static_cast<unsigned>(size),
                  Update.errorString());
    return false;
  }

  // Delete the image so we don't reflash it on every boot. If deletion fails,
  // skip the reboot to avoid a reflash loop — the new firmware is already the
  // boot target and will run on the next ordinary restart.
  fs_.remove(path);
  if (fs_.exists(path)) {
    Serial.println(F("SD flash: WARNING could not delete image — skipping reboot"));
    return false;
  }

  Serial.println(F("SD firmware flashed — rebooting"));
  delay(500);
  ESP.restart();
  return true;  // unreachable
}

String FirmwareUpdater::statusJson() const {
  JsonDocument doc;
  doc["state"] = stateName(state_);
  doc["currentVersion"] = currentVersion_;
  doc["variant"] = variant_;
  doc["resetReason"] = resetReasonName(esp_reset_reason());
  doc["channel"] = settings_.firmwareChannel();
  doc["autoCheck"] = settings_.firmwareAutoCheck();
  doc["progress"] = progress_;
  doc["error"] = error_;
  if (state_ == State::UpdateAvailable || state_ == State::NoUpdate) {
    JsonObject av = doc["available"].to<JsonObject>();
    av["version"] = availVersion_;
    av["notes"] = availNotes_;
  } else {
    doc["available"] = nullptr;
  }
  String out;
  serializeJson(doc, out);
  return out;
}

}  // namespace BrewControl
