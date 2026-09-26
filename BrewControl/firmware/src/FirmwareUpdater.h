#pragma once

#include <Arduino.h>
#include <FS.h>
#include <HTTPClient.h>
#include <WiFiClientSecure.h>

#include "SettingsStore.h"

namespace BrewControl {

// Orchestrates firmware/UI updates. Network checks and pulls block, so they are
// driven from the loopTask via tick(): HTTP routes only set request flags and
// return 202. Browser uploads (handled directly in WebUI) bypass this class and
// drive Update/TarExtractor from the AsyncTCP task chunk-by-chunk.
class FirmwareUpdater {
 public:
  enum class State {
    Idle, Checking, UpdateAvailable, NoUpdate, Downloading, Flashing, Success, Error
  };

  FirmwareUpdater(fs::FS& fs, SettingsStore& settings);

  void begin();  // record current version, seed auto-check timer
  void tick();   // process queued requests + daily auto-check; call every loop()

  // Boot-time recovery path: if `path` exists on SD, flash it, delete it, and
  // reboot into the new firmware. Returns false if no image is present (boot
  // continues normally). Runs before WiFi so it works without a network.
  bool flashFromSdImage(const char* path = "/firmware.bin");

  // Update mode: a release install does not run in normal operation. The
  // request is stored in NVS and the device reboots; setup() calls this right
  // after WiFi is up, before the web server, MQTT, the registry and the other
  // services take their share of the heap. Two TLS downloads from GitHub need
  // ~50 KB with two ~17 KB contiguous blocks (fixed 16 KB mbedTLS buffers in
  // the prebuilt core), which the S2 does not reliably have at runtime. On
  // success it reboots into the new firmware; on failure it stores the error
  // for begin() and returns, and the boot continues normally. One attempt per
  // request — a crash mid-install must not become a boot loop.
  void runPendingInstall();

  // Called from WebUI HTTP handlers (AsyncTCP task) — only set flags.
  void requestCheck(const String& channel);
  void requestInstall(const String& channel);

  // Serialized status for GET /api/update/status.
  String statusJson() const;

  // Name (same as `resetReason` in the status) of the last reset if nobody asked
  // for it — panic, watchdog, brownout — else nullptr.
  static const char* unexpectedResetReason();

 private:
  void doCheck(const String& channel);
  void doInstall(const String& channel);
  // Streams an HTTP(S) GET body to `sink`, updating progress_. Follows
  // redirects, sets User-Agent + setInsecure. `onConnected` runs once the
  // final response is 200, before the first byte reaches `sink`. Returns false
  // on any HTTP/IO error (reason in netError_).
  bool streamDownload(const String& url,
                      std::function<bool(const uint8_t*, size_t)> sink,
                      std::function<void()> onConnected = nullptr);
  bool streamBody_(HTTPClient& http, std::function<bool(const uint8_t*, size_t)>& sink);
  // Parses the releases JSON for `channel` into tag/fwUrl/tarUrl/notes.
  bool fetchReleaseMeta(const String& channel, String& tag, String& fwUrl,
                        String& tarUrl, String& notes);
  static const char* stateName(State s);
  // Records why the last HTTP request failed, with the heap at that moment —
  // a TLS handshake needs a large contiguous block, the usual failure on the
  // S2. Appended to error_ so GET /api/update/status says what went wrong.
  void noteNetError_(int code, WiFiClientSecure& client, const String& url);

  fs::FS& fs_;
  SettingsStore& settings_;

  State state_ = State::Idle;
  String currentVersion_;
  String variant_;
  String availVersion_;
  String availNotes_;
  String error_;
  String netError_;
  uint8_t progress_ = 0;

  bool pendingCheck_ = false;
  bool pendingInstall_ = false;
  String pendingChannel_;

  uint32_t lastAutoCheckMs_ = 0;
  bool firstAutoCheckDone_ = false;
};

}  // namespace BrewControl
