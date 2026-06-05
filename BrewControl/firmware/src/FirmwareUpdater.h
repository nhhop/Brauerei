#pragma once

#include <Arduino.h>
#include <FS.h>

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

  // Called from WebUI HTTP handlers (AsyncTCP task) — only set flags.
  void requestCheck(const String& channel);
  void requestInstall(const String& channel);

  // Serialized status for GET /api/update/status.
  String statusJson() const;

 private:
  void doCheck(const String& channel);
  void doInstall(const String& channel);
  // Streams an HTTP(S) GET body to `sink`, updating progress_. Follows
  // redirects, sets User-Agent + setInsecure. Returns false on any HTTP/IO error.
  bool streamDownload(const String& url,
                      std::function<bool(const uint8_t*, size_t)> sink);
  // Parses the releases JSON for `channel` into tag/fwUrl/tarUrl/notes.
  bool fetchReleaseMeta(const String& channel, String& tag, String& fwUrl,
                        String& tarUrl, String& notes);
  static const char* stateName(State s);

  fs::FS& fs_;
  SettingsStore& settings_;

  State state_ = State::Idle;
  String currentVersion_;
  String variant_;
  String availVersion_;
  String availNotes_;
  String error_;
  uint8_t progress_ = 0;

  bool pendingCheck_ = false;
  bool pendingInstall_ = false;
  String pendingChannel_;

  uint32_t lastAutoCheckMs_ = 0;
  bool firstAutoCheckDone_ = false;
};

}  // namespace BrewControl
