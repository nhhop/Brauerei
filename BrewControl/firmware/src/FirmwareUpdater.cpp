#include "FirmwareUpdater.h"

#include <ArduinoJson.h>
#include <HTTPClient.h>
#include <Update.h>
#include <WiFiClientSecure.h>

#include "SdTarSink.h"
#include "TarExtractor.h"
#include "version.h"

namespace BrewControl {
namespace {
constexpr char kApiHost[] = "https://api.github.com";
constexpr char kRepo[] = BREWCTL_GITHUB_REPO;  // "owner/repo", from build flag
constexpr char kUserAgent[] = "BrewControl-OTA";
constexpr uint32_t kAutoCheckIntervalMs = 24UL * 60UL * 60UL * 1000UL;  // daily
constexpr char kAssetsLive[] = "/www";
constexpr char kAssetsStaging[] = "/www.new";

void removeRecursive(fs::FS& fs, const char* path) {
  File dir = fs.open(path);
  if (!dir) return;
  if (!dir.isDirectory()) { dir.close(); fs.remove(path); return; }
  File e = dir.openNextFile();
  while (e) {
    String child = String(path) + "/" + e.name();
    bool isDir = e.isDirectory();
    e.close();
    if (isDir) removeRecursive(fs, child.c_str());
    else fs.remove(child);
    e = dir.openNextFile();
  }
  dir.close();
  fs.rmdir(path);
}
}  // namespace

FirmwareUpdater::FirmwareUpdater(fs::FS& fs, SettingsStore& settings)
    : fs_(fs), settings_(settings) {}

void FirmwareUpdater::begin() {
  currentVersion_ = BREWCTL_VERSION;
  variant_ = BREWCTL_VARIANT;
  lastAutoCheckMs_ = millis();
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
    pendingInstall_ = false;
    doInstall(pendingChannel_);
    return;
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

bool FirmwareUpdater::streamDownload(
    const String& url, std::function<bool(const uint8_t*, size_t)> sink) {
  WiFiClientSecure client;
  client.setInsecure();
  HTTPClient http;
  http.setFollowRedirects(HTTPC_STRICT_FOLLOW_REDIRECTS);
  if (!http.begin(client, url)) return false;
  http.addHeader("User-Agent", kUserAgent);
  int code = http.GET();
  if (code != HTTP_CODE_OK) { http.end(); return false; }
  int total = http.getSize();
  int got = 0;
  WiFiClient* stream = http.getStreamPtr();
  uint8_t buf[1024];
  while (http.connected() && (total < 0 || got < total)) {
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
  return total < 0 || got >= total;
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
  if (!http.begin(client, url)) return false;
  http.addHeader("User-Agent", kUserAgent);
  http.addHeader("Accept", "application/vnd.github+json");
  int code = http.GET();
  if (code != HTTP_CODE_OK) { http.end(); return false; }

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
  if (err) return false;

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
  String tag, fwUrl, tarUrl, notes;
  if (!fetchReleaseMeta(channel, tag, fwUrl, tarUrl, notes)) {
    error_ = "check failed";
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
  progress_ = 0;
  String tag, fwUrl, tarUrl, notes;
  if (!fetchReleaseMeta(channel, tag, fwUrl, tarUrl, notes) || fwUrl.length() == 0) {
    error_ = "no installable release";
    state_ = State::Error;
    return;
  }

  // 1) UI assets (non-fatal if absent): extract webui.tar → /www.new, swap.
  if (tarUrl.length() > 0) {
    state_ = State::Downloading;
    progress_ = 0;
    removeRecursive(fs_, kAssetsStaging);
    fs_.mkdir(kAssetsStaging);
    SdTarSink sink(fs_, kAssetsStaging);
    TarExtractor ex(sink.openCb(), sink.writeCb(), sink.closeCb());
    bool ok = streamDownload(tarUrl, [&ex](const uint8_t* d, size_t n) {
      return ex.feed(d, n);
    });
    if (!ok || ex.hasError()) {
      error_ = "asset download/extract failed";
      state_ = State::Error;
      return;
    }
    removeRecursive(fs_, kAssetsLive);
    fs_.rename(kAssetsStaging, kAssetsLive);
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
