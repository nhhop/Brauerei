# Firmware-Update (OTA, Browser-Upload, Server-Pull) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Drei Wege, Firmware/UI auf ein BrewControl-Gerät zu bringen — Browser-Upload (`.bin`/`.tar`), GitHub-Release-Pull (Firmware + UI), und täglicher Auto-Check mit Badge.

**Architecture:** Zwei neue Firmware-Module — `TarExtractor` (pure-C++, host-getestet, streaming USTAR-Parser mit Callback-Sink) und `FirmwareUpdater` (State-Machine, GitHub-Client, treibt blockierende Downloads auf dem loopTask). Neue `/api/update/*`-Routen in der bestehenden `WebUI`. Versions-/Varianten-ID kommt aus Build-Flags (`BREWCTL_VERSION` = git-Tag, `BREWCTL_VARIANT` = `${PIOENV}`). UI wird künftig aus `/www` auf der SD serviert (atomarer Swap). Preact-Seite `/settings/firmware`. GitHub-Action baut pro Env `firmware-<env>.bin` + eine `webui.tar`.

**Tech Stack:** PlatformIO/Arduino-ESP32 (C++17), ESPAsyncWebServer, `Update.h`, `WiFiClientSecure` + `HTTPClient`, ArduinoJson v7, Unity (native tests); Preact + TypeScript + Tailwind (Vite); GitHub Actions.

**Referenz-Spec:** [docs/superpowers/specs/2026-06-03-firmware-update-design.md](../specs/2026-06-03-firmware-update-design.md)

---

## File Structure

**Neu (Firmware):**
- `BrewControl/firmware/lib/TarExtractor/TarExtractor.h` / `.cpp` — pure-C++ USTAR-Parser (kein Arduino-Include → nativ kompilierbar).
- `BrewControl/firmware/test/test_tar_extractor/test_tar_extractor.cpp` — Unity-Test (native env).
- `BrewControl/firmware/src/SdTarSink.h` — `fs::FS`-Glue: baut die TarExtractor-Callbacks, die nach SD schreiben.
- `BrewControl/firmware/src/FirmwareUpdater.h` / `.cpp` — Orchestrator (State-Machine, GitHub-Client, Download/Flash auf loopTask).
- `BrewControl/firmware/src/version.h` — Fallback-Defaults für `BREWCTL_VERSION`/`BREWCTL_VARIANT`.
- `BrewControl/firmware/version_flags.py` — PlatformIO pre-build script: injiziert die Build-Flags.

**Modifiziert (Firmware):**
- `BrewControl/firmware/platformio.ini` — `extra_scripts`, `[env:native]`, optional Partition.
- `BrewControl/firmware/src/SettingsStore.h` / `.cpp` — `firmware`-Sektion (channel/autoCheck) + Getter.
- `BrewControl/firmware/src/WebUI.h` / `.cpp` — `FirmwareUpdater&`-Ref, `/api/update/*`-Routen, Upload-Handler, Serve-Root → `/www`.
- `BrewControl/firmware/src/main.cpp` — `FirmwareUpdater` instanziieren + `tick()`.

**Neu (Web):**
- `BrewControl/web/src/pages/FirmwarePage.tsx` — Update-Seite.

**Modifiziert (Web):**
- `BrewControl/web/src/types.ts` — `UpdateStatus`, `AppSettings.firmware`.
- `BrewControl/web/src/api.ts` — Update-API-Funktionen.
- `BrewControl/web/src/app.tsx` — Route `/settings/firmware`.
- `BrewControl/web/src/pages/SettingsIndex.tsx` — Kachel + Badge.

**Neu (CI/Doku):**
- `.github/workflows/release.yml` — Matrix-Build + Release-Assets.
- `BrewControl/README.md` — Release-Prozess, `/www`-Deploy, USB-Brick-Rettung, Partition-Caveat.

---

## Phase 1 — Versions-/Varianten-Infrastruktur

### Task 1: Build-Flag-Injektion + Fallback-Header

**Files:**
- Create: `BrewControl/firmware/version_flags.py`
- Create: `BrewControl/firmware/src/version.h`
- Modify: `BrewControl/firmware/platformio.ini` (`[common]`)

- [ ] **Step 1: Pre-build-Script schreiben**

Create `BrewControl/firmware/version_flags.py`:

```python
# Injects BREWCTL_VERSION (= git tag) and BREWCTL_VARIANT (= PlatformIO env name)
# as compile-time string macros. In CI, BREWCTL_VERSION_OVERRIDE (set from the
# release tag) takes precedence over `git describe`.
Import("env")  # noqa: F821  (provided by PlatformIO/SCons)
import os
import subprocess


def git_describe():
    try:
        out = subprocess.check_output(
            ["git", "describe", "--tags", "--always", "--dirty"],
            cwd=env["PROJECT_DIR"],
            stderr=subprocess.DEVNULL,
        )
        return out.decode().strip()
    except Exception:
        return "v0.0.0-dev"


version = os.environ.get("BREWCTL_VERSION_OVERRIDE") or git_describe()
variant = env["PIOENV"]

env.Append(CPPDEFINES=[
    ("BREWCTL_VERSION", env.StringifyMacro(version)),
    ("BREWCTL_VARIANT", env.StringifyMacro(variant)),
])
print("BrewControl build: version=%s variant=%s" % (version, variant))
```

- [ ] **Step 2: Fallback-Header schreiben**

Create `BrewControl/firmware/src/version.h`:

```cpp
#pragma once

// Normally provided as compile-time macros by version_flags.py. These defaults
// only apply if the build is invoked without the pre-build script.
#ifndef BREWCTL_VERSION
#define BREWCTL_VERSION "v0.0.0-dev"
#endif

#ifndef BREWCTL_VARIANT
#define BREWCTL_VARIANT "unknown"
#endif
```

- [ ] **Step 3: Script im `[common]`-Abschnitt registrieren**

In `BrewControl/firmware/platformio.ini`, add to the `[common]` section (after `build_unflags`):

```ini
extra_scripts = pre:version_flags.py
```

Each `[env:*]` already inherits `[common]` indirectly only via explicit `${common.*}` refs, so also add `extra_scripts = ${common.extra_scripts}` to **each** env block (`esp32dev`, `lolin_s2_mini`, `lilygo_t_display_s3_amoled`).

- [ ] **Step 4: Compile-smoke + Flag-Sichtprüfung**

Run (PowerShell):
```powershell
cd BrewControl\firmware
pio run -e esp32dev
```
Expected: build succeeds; console prints `BrewControl build: version=... variant=esp32dev`.

- [ ] **Step 5: Commit**

```bash
git add BrewControl/firmware/version_flags.py BrewControl/firmware/src/version.h BrewControl/firmware/platformio.ini
git commit -m "feat(fw): inject BREWCTL_VERSION + BREWCTL_VARIANT build flags"
```

---

## Phase 2 — TarExtractor (host-getestet)

### Task 2: TarExtractor — pure-C++ USTAR-Parser mit Unity-Test

**Files:**
- Create: `BrewControl/firmware/lib/TarExtractor/TarExtractor.h`
- Create: `BrewControl/firmware/lib/TarExtractor/TarExtractor.cpp`
- Create: `BrewControl/firmware/test/test_tar_extractor/test_tar_extractor.cpp`
- Modify: `BrewControl/firmware/platformio.ini` (add `[env:native]`)

- [ ] **Step 1: Header schreiben**

Create `BrewControl/firmware/lib/TarExtractor/TarExtractor.h`:

```cpp
#pragma once

#include <cstddef>
#include <cstdint>
#include <functional>
#include <string>

namespace BrewControl {

// Streaming USTAR (tar) parser. Feed bytes in arbitrary chunk sizes; for each
// regular file the extractor calls onOpen(path, size), then onWrite(...) zero
// or more times, then onClose(). Directory entries and unsupported entry types
// are skipped. All filesystem coupling lives in the callbacks, so the parser is
// host-testable with an in-memory sink. On malformed input it latches an error
// (hasError()) and feed() returns false.
class TarExtractor {
 public:
  using OpenCb = std::function<bool(const std::string& path, uint32_t size)>;
  using WriteCb = std::function<bool(const uint8_t* data, size_t len)>;
  using CloseCb = std::function<bool()>;

  TarExtractor(OpenCb onOpen, WriteCb onWrite, CloseCb onClose);

  // Feed one chunk. Returns false once an error has been latched.
  bool feed(const uint8_t* data, size_t len);

  bool hasError() const { return error_; }
  const char* errorMsg() const { return errorMsg_; }

 private:
  bool fail(const char* msg);

  OpenCb onOpen_;
  WriteCb onWrite_;
  CloseCb onClose_;

  uint8_t header_[512];
  size_t headerFill_ = 0;  // bytes accumulated into header_
  bool inData_ = false;    // currently streaming file data / padding
  uint32_t remaining_ = 0;  // file bytes still to deliver to onWrite_
  uint32_t skip_ = 0;       // bytes to discard (padding or unsupported entry)
  bool error_ = false;
  const char* errorMsg_ = "";
};

}  // namespace BrewControl
```

- [ ] **Step 2: Implementierung schreiben**

Create `BrewControl/firmware/lib/TarExtractor/TarExtractor.cpp`:

```cpp
#include "TarExtractor.h"

#include <cstring>

namespace BrewControl {
namespace {

// Parses a NUL/space-terminated octal field (tar stores sizes in octal ASCII).
uint32_t parseOctal(const uint8_t* field, size_t len) {
  uint32_t v = 0;
  for (size_t i = 0; i < len; ++i) {
    char c = static_cast<char>(field[i]);
    if (c < '0' || c > '7') break;  // stops at the space/NUL terminator
    v = (v << 3) + static_cast<uint32_t>(c - '0');
  }
  return v;
}

size_t fieldLen(const uint8_t* field, size_t maxLen) {
  size_t n = 0;
  while (n < maxLen && field[n] != '\0') ++n;
  return n;
}

bool isZeroBlock(const uint8_t* b) {
  for (size_t i = 0; i < 512; ++i)
    if (b[i] != 0) return false;
  return true;
}

}  // namespace

TarExtractor::TarExtractor(OpenCb onOpen, WriteCb onWrite, CloseCb onClose)
    : onOpen_(std::move(onOpen)),
      onWrite_(std::move(onWrite)),
      onClose_(std::move(onClose)) {}

bool TarExtractor::fail(const char* msg) {
  error_ = true;
  errorMsg_ = msg;
  return false;
}

bool TarExtractor::feed(const uint8_t* data, size_t len) {
  if (error_) return false;
  size_t i = 0;
  while (i < len) {
    if (inData_) {
      if (remaining_ > 0) {
        size_t take = len - i;
        if (take > remaining_) take = remaining_;
        if (!onWrite_(data + i, take)) return fail("write failed");
        i += take;
        remaining_ -= take;
        if (remaining_ == 0) {
          if (!onClose_()) return fail("close failed");
        }
        continue;
      }
      if (skip_ > 0) {
        size_t take = len - i;
        if (take > skip_) take = skip_;
        i += take;
        skip_ -= take;
      }
      if (remaining_ == 0 && skip_ == 0) inData_ = false;
      continue;
    }

    // Accumulate a full 512-byte header block.
    size_t need = 512 - headerFill_;
    size_t take = len - i;
    if (take > need) take = need;
    memcpy(header_ + headerFill_, data + i, take);
    headerFill_ += take;
    i += take;
    if (headerFill_ < 512) break;  // need more bytes for a complete header
    headerFill_ = 0;

    if (isZeroBlock(header_)) continue;  // end-of-archive marker block

    char typeflag = static_cast<char>(header_[156]);
    uint32_t size = parseOctal(header_ + 124, 12);
    uint32_t pad = (size % 512) ? (512 - (size % 512)) : 0;

    if (typeflag == '5') {  // directory — sinks create dirs lazily, nothing to do
      continue;
    }
    if (typeflag != '0' && typeflag != '\0') {  // symlink/hardlink/etc — skip
      skip_ = size + pad;
      remaining_ = 0;
      inData_ = (skip_ > 0);
      continue;
    }

    // Regular file. Build "<prefix>/<name>" (ustar long-name support).
    std::string name(reinterpret_cast<const char*>(header_),
                     fieldLen(header_, 100));
    size_t prefixLen = fieldLen(header_ + 345, 155);
    if (prefixLen > 0) {
      std::string prefix(reinterpret_cast<const char*>(header_ + 345), prefixLen);
      name = prefix + "/" + name;
    }

    if (!onOpen_(name, size)) return fail("open failed");
    remaining_ = size;
    skip_ = pad;
    inData_ = true;
    if (size == 0) {
      if (!onClose_()) return fail("close failed");
      if (skip_ == 0) inData_ = false;
    }
  }
  return true;
}

}  // namespace BrewControl
```

- [ ] **Step 3: Unity-Test schreiben**

Create `BrewControl/firmware/test/test_tar_extractor/test_tar_extractor.cpp`:

```cpp
#include <unity.h>

#include <map>
#include <string>
#include <vector>

#include "TarExtractor.h"

using BrewControl::TarExtractor;

namespace {

// Appends one ustar file entry (512-byte header + data padded to 512) to `out`.
void appendEntry(std::vector<uint8_t>& out, const std::string& name,
                 const std::string& data) {
  uint8_t hdr[512] = {};
  memcpy(hdr, name.c_str(), name.size());        // name @ 0
  // size @ 124, 11 octal digits + NUL
  char oct[12];
  snprintf(oct, sizeof(oct), "%011o", static_cast<unsigned>(data.size()));
  memcpy(hdr + 124, oct, 11);
  hdr[156] = '0';                                 // typeflag = regular file
  memcpy(hdr + 257, "ustar", 5);                  // magic
  out.insert(out.end(), hdr, hdr + 512);
  out.insert(out.end(), data.begin(), data.end());
  size_t pad = (data.size() % 512) ? (512 - data.size() % 512) : 0;
  out.insert(out.end(), pad, 0);
}

// Builds the extractor with an in-memory sink backed by `files`.
struct MemSink {
  std::map<std::string, std::string> files;
  std::string current;
};

TarExtractor makeExtractor(MemSink& sink) {
  return TarExtractor(
      [&sink](const std::string& path, uint32_t) {
        sink.current = path;
        sink.files[path] = "";
        return true;
      },
      [&sink](const uint8_t* d, size_t n) {
        sink.files[sink.current].append(reinterpret_cast<const char*>(d), n);
        return true;
      },
      [&sink]() {
        sink.current.clear();
        return true;
      });
}

}  // namespace

void test_single_file() {
  std::vector<uint8_t> tar;
  appendEntry(tar, "index.html.gz", "hello-world");
  MemSink sink;
  auto ex = makeExtractor(sink);
  TEST_ASSERT_TRUE(ex.feed(tar.data(), tar.size()));
  TEST_ASSERT_FALSE(ex.hasError());
  TEST_ASSERT_EQUAL_size_t(1, sink.files.size());
  TEST_ASSERT_EQUAL_STRING("hello-world", sink.files["index.html.gz"].c_str());
}

void test_subdir_and_multiple_files() {
  std::vector<uint8_t> tar;
  appendEntry(tar, "index.html.gz", "root");
  appendEntry(tar, "assets/app.js.gz", "javascript-bytes");
  appendEntry(tar, "assets/app.css.gz", "css");
  MemSink sink;
  auto ex = makeExtractor(sink);
  TEST_ASSERT_TRUE(ex.feed(tar.data(), tar.size()));
  TEST_ASSERT_EQUAL_size_t(3, sink.files.size());
  TEST_ASSERT_EQUAL_STRING("javascript-bytes",
                           sink.files["assets/app.js.gz"].c_str());
  TEST_ASSERT_EQUAL_STRING("css", sink.files["assets/app.css.gz"].c_str());
}

void test_chunked_one_byte_at_a_time() {
  std::vector<uint8_t> tar;
  appendEntry(tar, "assets/big.js.gz", std::string(1000, 'x'));
  MemSink sink;
  auto ex = makeExtractor(sink);
  for (size_t i = 0; i < tar.size(); ++i) {
    uint8_t b = tar[i];
    TEST_ASSERT_TRUE(ex.feed(&b, 1));
  }
  TEST_ASSERT_FALSE(ex.hasError());
  TEST_ASSERT_EQUAL_size_t(1000, sink.files["assets/big.js.gz"].size());
}

void test_empty_file() {
  std::vector<uint8_t> tar;
  appendEntry(tar, "empty", "");
  MemSink sink;
  auto ex = makeExtractor(sink);
  TEST_ASSERT_TRUE(ex.feed(tar.data(), tar.size()));
  TEST_ASSERT_EQUAL_size_t(1, sink.files.size());
  TEST_ASSERT_EQUAL_STRING("", sink.files["empty"].c_str());
}

int main(int, char**) {
  UNITY_BEGIN();
  RUN_TEST(test_single_file);
  RUN_TEST(test_subdir_and_multiple_files);
  RUN_TEST(test_chunked_one_byte_at_a_time);
  RUN_TEST(test_empty_file);
  return UNITY_END();
}
```

- [ ] **Step 4: Native-Test-Env hinzufügen**

In `BrewControl/firmware/platformio.ini`, append a new env block (tar parser is pure C++; `test_build_src = no` keeps Arduino `src/` out of the native build, and the `lib/TarExtractor` library is auto-linked because the test includes its header):

```ini
[env:native]
platform = native
test_framework = unity
test_build_src = no
build_flags =
  -std=gnu++17
  -DUNIT_TEST
build_unflags = -std=gnu++11
```

- [ ] **Step 5: Test laufen lassen (zuerst rot erwartet, falls Impl-Bug, dann grün)**

Run (PowerShell):
```powershell
cd BrewControl\firmware
pio test -e native -f test_tar_extractor
```
Expected: `4 Tests 0 Failures 0 Ignored OK`.

- [ ] **Step 6: Commit**

```bash
git add BrewControl/firmware/lib/TarExtractor BrewControl/firmware/test/test_tar_extractor BrewControl/firmware/platformio.ini
git commit -m "feat(fw): streaming TarExtractor with native unit tests"
```

### Task 3: SdTarSink — fs::FS-Glue

**Files:**
- Create: `BrewControl/firmware/src/SdTarSink.h`

- [ ] **Step 1: Sink schreiben**

Create `BrewControl/firmware/src/SdTarSink.h`:

```cpp
#pragma once

#include <Arduino.h>
#include <FS.h>

#include "TarExtractor.h"

namespace BrewControl {

// Produces TarExtractor callbacks that write each archived file into `fs` under
// `basePath`, creating intermediate directories as needed. One file is open at
// a time. Construct one SdTarSink per extraction run.
class SdTarSink {
 public:
  SdTarSink(fs::FS& fs, const char* basePath) : fs_(fs), base_(basePath) {}

  TarExtractor::OpenCb openCb() {
    return [this](const std::string& path, uint32_t) {
      String full = base_ + "/" + String(path.c_str());
      ensureParentDirs(full);
      if (cur_) cur_.close();
      cur_ = fs_.open(full, FILE_WRITE);
      return static_cast<bool>(cur_);
    };
  }

  TarExtractor::WriteCb writeCb() {
    return [this](const uint8_t* data, size_t len) {
      if (!cur_) return false;
      return cur_.write(data, len) == len;
    };
  }

  TarExtractor::CloseCb closeCb() {
    return [this]() {
      if (cur_) cur_.close();
      return true;
    };
  }

 private:
  void ensureParentDirs(const String& fullPath) {
    int slash = fullPath.indexOf('/', 1);
    while (slash > 0) {
      fs_.mkdir(fullPath.substring(0, slash));
      slash = fullPath.indexOf('/', slash + 1);
    }
  }

  fs::FS& fs_;
  String base_;
  File cur_;
};

}  // namespace BrewControl
```

- [ ] **Step 2: Compile-smoke (über einen temporären Include in main.cpp oder erst in Task 6 verifiziert)**

This header is header-only and is exercised by the build in Task 6 (asset upload). To verify isolation now, run:
```powershell
cd BrewControl\firmware
pio run -e esp32dev
```
Expected: build still succeeds (header not yet included anywhere → no effect; the real check is Task 6).

- [ ] **Step 3: Commit**

```bash
git add BrewControl/firmware/src/SdTarSink.h
git commit -m "feat(fw): SdTarSink — TarExtractor callbacks writing to fs::FS"
```

---

## Phase 3 — SettingsStore: firmware-Sektion

### Task 4: channel + autoCheck persistieren

**Files:**
- Modify: `BrewControl/firmware/src/SettingsStore.h`
- Modify: `BrewControl/firmware/src/SettingsStore.cpp`

- [ ] **Step 1: Header um Felder + Getter erweitern**

In `BrewControl/firmware/src/SettingsStore.h`, add the private fields and public getters:

```cpp
class SettingsStore {
 public:
  void loadFromSD(fs::FS& sd);
  void saveToSD(fs::FS& sd) const;
  String serialize() const;
  void update(const JsonObject& patch);

  // Firmware-update preferences.
  const String& firmwareChannel() const { return fwChannel_; }   // "stable" | "preview"
  bool firmwareAutoCheck() const { return fwAutoCheck_; }

 private:
  String mode_       = "system";
  String accent_     = "#d97706";
  String background_ = "neutral";
  String fwChannel_   = "stable";
  bool   fwAutoCheck_ = true;
};
```

- [ ] **Step 2: load/serialize/update erweitern**

In `BrewControl/firmware/src/SettingsStore.cpp`, extend the three methods. In `loadFromSD`, after the theme block (before the final `}`):

```cpp
  JsonObject fw = doc["firmware"].as<JsonObject>();
  if (!fw.isNull()) {
    if (const char* c = fw["channel"]) fwChannel_ = c;
    if (fw["autoCheck"].is<bool>())    fwAutoCheck_ = fw["autoCheck"].as<bool>();
  }
```

In `serialize`, before `String out;`:

```cpp
  JsonObject fw = doc["firmware"].to<JsonObject>();
  fw["channel"]   = fwChannel_.c_str();
  fw["autoCheck"] = fwAutoCheck_;
```

In `update`, after the theme block (it currently `return`s early when theme is null — change that):

```cpp
void SettingsStore::update(const JsonObject& patch) {
  JsonObject theme = patch["theme"].as<JsonObject>();
  if (!theme.isNull()) {
    if (const char* m = theme["mode"])       mode_       = m;
    if (const char* a = theme["accent"])     accent_     = a;
    if (const char* b = theme["background"]) background_ = b;
  }
  JsonObject fw = patch["firmware"].as<JsonObject>();
  if (!fw.isNull()) {
    if (const char* c = fw["channel"])  fwChannel_   = c;
    if (fw["autoCheck"].is<bool>())     fwAutoCheck_ = fw["autoCheck"].as<bool>();
  }
}
```

- [ ] **Step 3: Validierung im Settings-POST-Handler ergänzen**

In `BrewControl/firmware/src/WebUI.cpp`, inside the `/api/settings` `AsyncCallbackJsonWebHandler` (the block validating `theme`), add a `firmware.channel` enum check before `settings_.update(obj);`:

```cpp
        JsonObject fw = obj["firmware"].as<JsonObject>();
        if (!fw.isNull()) {
          if (const char* c = fw["channel"]) {
            if (strcmp(c,"stable")!=0 && strcmp(c,"preview")!=0) {
              req->send(400, "text/plain", "invalid channel"); return;
            }
          }
        }
```

- [ ] **Step 4: Compile-smoke**

```powershell
cd BrewControl\firmware
pio run -e esp32dev
```
Expected: build succeeds.

- [ ] **Step 5: Commit**

```bash
git add BrewControl/firmware/src/SettingsStore.h BrewControl/firmware/src/SettingsStore.cpp BrewControl/firmware/src/WebUI.cpp
git commit -m "feat(fw): persist firmware channel + autoCheck in SettingsStore"
```

---

## Phase 4 — FirmwareUpdater (Check + Download/Flash auf loopTask)

### Task 5: FirmwareUpdater-Klasse

**Files:**
- Create: `BrewControl/firmware/src/FirmwareUpdater.h`
- Create: `BrewControl/firmware/src/FirmwareUpdater.cpp`

- [ ] **Step 1: Header schreiben**

Create `BrewControl/firmware/src/FirmwareUpdater.h`:

```cpp
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
```

- [ ] **Step 2: Implementierung schreiben**

Create `BrewControl/firmware/src/FirmwareUpdater.cpp`:

```cpp
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
```

- [ ] **Step 3: `BREWCTL_GITHUB_REPO` als Build-Flag setzen**

In `BrewControl/firmware/platformio.ini` `[common]` `build_flags`, add the repo constant:

```ini
build_flags =
  -std=gnu++17
  -DBREWCTL_GITHUB_REPO=\"nhhop/Brauerei\"
```

(Keep the existing `-std=gnu++17`; add the second line. The repo must be **public** before the first release — see README task.)

- [ ] **Step 4: Compile-smoke**

```powershell
cd BrewControl\firmware
pio run -e esp32dev
```
Expected: build succeeds. Note the `Flash: x%` line — needed for Task 12 (partition check).

- [ ] **Step 5: Commit**

```bash
git add BrewControl/firmware/src/FirmwareUpdater.h BrewControl/firmware/src/FirmwareUpdater.cpp BrewControl/firmware/platformio.ini
git commit -m "feat(fw): FirmwareUpdater — GitHub check + pull/flash on loopTask"
```

---

## Phase 5 — WebUI-Routen + Serve-Root + main.cpp-Wireup

### Task 6: Update-Routen, Upload-Handler, /www-Serve

**Files:**
- Modify: `BrewControl/firmware/src/WebUI.h`
- Modify: `BrewControl/firmware/src/WebUI.cpp`
- Modify: `BrewControl/firmware/src/main.cpp`

- [ ] **Step 1: WebUI-Konstruktor um FirmwareUpdater erweitern**

In `BrewControl/firmware/src/WebUI.h`: add the include and constructor param + member.

```cpp
#include "FirmwareUpdater.h"
```
Change the constructor signature and add the member:
```cpp
  WebUI(SensActCtrl::Registry& reg, fs::FS& fs, DynamicItems& items,
        DashboardStore& store, SettingsStore& settings, FirmwareUpdater& updater,
        uint16_t port = 80);
```
```cpp
  FirmwareUpdater& updater_;
```
(Place `updater_` next to the other refs.)

- [ ] **Step 2: Konstruktor-Definition anpassen**

In `BrewControl/firmware/src/WebUI.cpp`, update the constructor initializer list:

```cpp
WebUI::WebUI(SensActCtrl::Registry& reg, fs::FS& fs, DynamicItems& items,
             DashboardStore& store, SettingsStore& settings,
             FirmwareUpdater& updater, uint16_t port)
    : reg_(reg), fs_(fs), items_(items), store_(store), settings_(settings),
      updater_(updater), server_(port), events_("/api/events") {}
```

- [ ] **Step 3: Update-Routen registrieren**

In `BrewControl/firmware/src/WebUI.cpp` `begin()`, **before** the `serveStatic` line, add:

```cpp
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

  // Multipart UI package (.tar) upload → extract to /www.new, swap.
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
          fs_.rmdir("/www.new");
          fs_.mkdir("/www.new");
        }
        if (len && assetTar_) assetTar_->feed(data, len);
        if (final) {
          bool ok = assetTar_ && !assetTar_->hasError();
          assetTar_.reset();
          assetSink_.reset();
          if (ok) {
            // swap live ← staging
            req->send(200, "text/plain", "ok");
          } else {
            req->send(500, "text/plain", "extract failed");
          }
        }
      });
```

> **Note on `Include`s:** add `#include <Update.h>`, `#include "SdTarSink.h"`, `#include "TarExtractor.h"`, and `#include <memory>` to the top of `WebUI.cpp`.

- [ ] **Step 4: Asset-Swap + Member für Upload-State**

The `.tar` upload needs `/www.new → /www` swap after success. Recursive delete + rename in the AsyncTCP callback risks watchdog on large trees; instead set a flag and let `tick()` do the swap on the loopTask. In `WebUI.h`, add members:

```cpp
#include <memory>
#include "SdTarSink.h"
#include "TarExtractor.h"
```
```cpp
  std::unique_ptr<SdTarSink> assetSink_;
  std::unique_ptr<TarExtractor> assetTar_;
  bool assetSwapPending_ = false;
```
In the `.tar` `final` branch (Step 3), replace the success path with:
```cpp
          if (ok) { assetSwapPending_ = true; req->send(200, "text/plain", "ok"); }
```
In `WebUI.cpp` `tick()`, at the top of the function add:
```cpp
  if (assetSwapPending_) {
    assetSwapPending_ = false;
    // reuse FirmwareUpdater's swap by exposing a helper, or inline here:
    swapAssets_();
  }
```
Add a private method `void swapAssets_();` to `WebUI.h` and define it in `WebUI.cpp`:
```cpp
void WebUI::swapAssets_() {
  // remove /www then rename /www.new → /www (loopTask context)
  std::function<void(const char*)> rm = [&](const char* path) {
    File dir = fs_.open(path);
    if (!dir) return;
    if (!dir.isDirectory()) { dir.close(); fs_.remove(path); return; }
    File e = dir.openNextFile();
    while (e) {
      String child = String(path) + "/" + e.name();
      bool d = e.isDirectory(); e.close();
      if (d) rm(child.c_str()); else fs_.remove(child);
      e = dir.openNextFile();
    }
    dir.close();
    fs_.rmdir(path);
  };
  rm("/www");
  fs_.rename("/www.new", "/www");
}
```

- [ ] **Step 5: Serve-Root auf /www umstellen**

In `BrewControl/firmware/src/WebUI.cpp`, change the static-serve + SPA fallback to use `/www`:

```cpp
  server_.serveStatic("/", fs_, "/www")
      .setDefaultFile("index.html")
      .setCacheControl("max-age=600");

  server_.onNotFound([this](AsyncWebServerRequest* req) {
    if (req->method() == HTTP_GET && !req->url().startsWith("/api/")) {
      req->send(fs_, "/www/index.html", "text/html");
    } else {
      req->send(404, "text/plain", "Not Found");
    }
  });
```

- [ ] **Step 6: main.cpp — FirmwareUpdater instanziieren + verdrahten**

In `BrewControl/firmware/src/main.cpp`:
- add `#include "FirmwareUpdater.h"`
- declare the global after `settingsStore`:
```cpp
BrewControl::FirmwareUpdater firmwareUpdater(SD, settingsStore);
```
- update the `WebUI webUI(...)` construction to pass it:
```cpp
WebUI webUI(registry, SD, dynamicItems, dashboardStore, settingsStore, firmwareUpdater);
```
- in `setup()`, after `webUI.begin();`, add `firmwareUpdater.begin();`
- in `loop()`, add `firmwareUpdater.tick();` after `webUI.tick();`

- [ ] **Step 7: Compile-smoke (alle Boards)**

```powershell
cd BrewControl\firmware
pio run -e esp32dev
pio run -e lolin_s2_mini
pio run -e lilygo_t_display_s3_amoled
```
Expected: all three succeed.

- [ ] **Step 8: Commit**

```bash
git add BrewControl/firmware/src/WebUI.h BrewControl/firmware/src/WebUI.cpp BrewControl/firmware/src/main.cpp
git commit -m "feat(fw): /api/update routes, .bin/.tar upload, serve UI from /www"
```

### Task 7: Hardware-Verifikation der Upload- und Pull-Pfade

> Kein Unit-Test möglich (Hardware + Netz). Diese Task ist eine manuelle E2E-Checkliste auf realem Board (esp32dev oder LilyGo S3). Voraussetzung: ein **Test-Release** auf GitHub (s. Task 10) existiert bereits, oder wird parallel angelegt.

- [ ] **Step 1: Flashen + SD mit /www bestücken**

```powershell
cd BrewControl\web
pnpm build
Get-ChildItem .\dist -Recurse -Include *.js,*.css,*.html | ForEach-Object { & gzip -k9 -- $_.FullName }
# Auf SD-Karte: dist/* nach D:\www\ kopieren (NICHT mehr nach Root!)
New-Item -ItemType Directory -Force D:\www | Out-Null
Copy-Item -Recurse -Force .\dist\* D:\www\
cd ..\firmware
pio run -e esp32dev -t upload
```

- [ ] **Step 2: Status-Endpoint prüfen**

Run: `curl http://<ip>/api/update/status`
Expected: JSON mit `"currentVersion"`, `"variant":"esp32dev"`, `"state":"idle"`.

- [ ] **Step 3: Browser-Upload Firmware**

Build a second `.bin` (e.g. bump a Serial print), then:
Run: `curl -F "f=@.pio/build/esp32dev/firmware.bin" http://<ip>/api/update/firmware`
Expected: `ok`; device reboots; `/api/update/status` shows the new version.

- [ ] **Step 4: Browser-Upload Assets**

```powershell
cd BrewControl\web\dist
tar -cf ..\webui.tar *
curl -F "f=@..\webui.tar" http://<ip>/api/update/assets
```
Expected: `ok`; reload UI → assets served from `/www`; stale hashed assets gone.

- [ ] **Step 5: GitHub-Check + Install**

Run: `curl -X POST http://<ip>/api/update/check -d '{"channel":"stable"}'` then poll `curl http://<ip>/api/update/status`.
Expected: `state:"updateAvailable"` (or `noUpdate` if same version), `available.version` = release tag.
Then: `curl -X POST http://<ip>/api/update/install` → poll status → `downloading`→`flashing`→`success`→reboot.

- [ ] **Step 6: Negativ — falsche Variante**

On a board whose variant has no matching asset in the test release: check → `state:"noUpdate"`, `available.notes` contains "Kein Image für Variante …".

- [ ] **Step 7: Commit (nur Notizen, falls Fixes nötig waren)**

If fixes were needed during E2E, commit them with `fix(fw): ...`. Otherwise no commit.

---

## Phase 6 — Web-UI

### Task 8: Types + API

**Files:**
- Modify: `BrewControl/web/src/types.ts`
- Modify: `BrewControl/web/src/api.ts`

- [ ] **Step 1: Typen ergänzen**

In `BrewControl/web/src/types.ts`, extend `AppSettings` and add `UpdateStatus`:

```ts
export interface FirmwareSettings {
  channel: 'stable' | 'preview';
  autoCheck: boolean;
}

export interface AppSettings {
  theme: ThemeSettings;
  firmware?: FirmwareSettings;
}

export type UpdateState =
  | 'idle' | 'checking' | 'updateAvailable' | 'noUpdate'
  | 'downloading' | 'flashing' | 'success' | 'error';

export interface UpdateStatus {
  state: UpdateState;
  currentVersion: string;
  variant: string;
  channel: 'stable' | 'preview';
  autoCheck: boolean;
  progress: number;
  error: string;
  available: { version: string; notes: string } | null;
}
```

- [ ] **Step 2: API-Funktionen ergänzen**

In `BrewControl/web/src/api.ts`, add (import `UpdateStatus` in the top type import list):

```ts
export async function getUpdateStatus(): Promise<UpdateStatus> {
  const r = await fetch('/api/update/status');
  if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
  return (await r.json()) as UpdateStatus;
}

export function checkUpdate(channel: 'stable' | 'preview'): Promise<void> {
  return postJson('/api/update/check', { channel });
}

export function installUpdate(channel: 'stable' | 'preview'): Promise<void> {
  return postJson('/api/update/install', { channel });
}

function uploadFile(url: string, file: File, onProgress: (pct: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const form = new FormData();
    form.append('f', file);
    const xhr = new XMLHttpRequest();
    xhr.open('POST', url);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300
      ? resolve() : reject(new Error(`${xhr.status} ${xhr.responseText}`)));
    xhr.onerror = () => reject(new Error('network error'));
    xhr.send(form);
  });
}

export function uploadFirmware(file: File, onProgress: (pct: number) => void): Promise<void> {
  return uploadFile('/api/update/firmware', file, onProgress);
}

export function uploadAssets(file: File, onProgress: (pct: number) => void): Promise<void> {
  return uploadFile('/api/update/assets', file, onProgress);
}
```

- [ ] **Step 3: Typecheck**

```powershell
cd BrewControl\web
pnpm typecheck
```
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add BrewControl/web/src/types.ts BrewControl/web/src/api.ts
git commit -m "feat(web): update API client + types"
```

### Task 9: FirmwarePage + Routing + Settings-Kachel

**Files:**
- Create: `BrewControl/web/src/pages/FirmwarePage.tsx`
- Modify: `BrewControl/web/src/app.tsx`
- Modify: `BrewControl/web/src/pages/SettingsIndex.tsx`

- [ ] **Step 1: FirmwarePage schreiben**

Create `BrewControl/web/src/pages/FirmwarePage.tsx`:

```tsx
import { useEffect, useState, useRef } from 'preact/hooks';
import type { UpdateStatus } from '../types';
import {
  getUpdateStatus, checkUpdate, installUpdate,
  uploadFirmware, uploadAssets, updateSettings,
} from '../api';
import { ConfirmModal } from '../components/ConfirmModal';

export function FirmwarePage(_: { path?: string }) {
  const [st, setSt] = useState<UpdateStatus | null>(null);
  const [confirmInstall, setConfirmInstall] = useState(false);
  const [fwPct, setFwPct] = useState<number | null>(null);
  const [tarPct, setTarPct] = useState<number | null>(null);
  const poll = useRef<number | null>(null);

  const refresh = () => getUpdateStatus().then(setSt).catch(() => {});

  useEffect(() => {
    refresh();
    poll.current = window.setInterval(refresh, 1500);
    return () => { if (poll.current) clearInterval(poll.current); };
  }, []);

  if (!st) return <div class="min-h-screen bg-bg p-6 text-fg">Lädt…</div>;

  const busy = ['checking', 'downloading', 'flashing'].includes(st.state);
  const channel = st.channel;

  const setChannel = (c: 'stable' | 'preview') =>
    updateSettings({ firmware: { channel: c, autoCheck: st.autoCheck } }).then(refresh);
  const setAuto = (a: boolean) =>
    updateSettings({ firmware: { channel, autoCheck: a } }).then(refresh);

  return (
    <div class="min-h-screen bg-bg p-4 text-fg md:p-6">
      <header class="flex items-center gap-3">
        <a href="/settings" class="text-lg leading-none text-faint hover:text-fg">←</a>
        <h1 class="text-xl font-medium tracking-tight">Firmware-Update</h1>
      </header>

      <div class="mt-4 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm">
        ⚠ Nicht während eines laufenden Brauvorgangs aktualisieren — das Gerät startet neu.
      </div>

      <section class="mt-6 rounded-lg border border-border bg-surface p-4">
        <div class="text-sm text-muted">Aktuelle Version</div>
        <div class="font-mono">{st.currentVersion} · {st.variant}</div>
      </section>

      <section class="mt-4 rounded-lg border border-border bg-surface p-4 space-y-3">
        <div class="font-medium">Server-Update (GitHub)</div>
        <div class="flex gap-2">
          {(['stable', 'preview'] as const).map((c) => (
            <button key={c} onClick={() => setChannel(c)} disabled={busy}
              class={`rounded-md px-3 py-1.5 text-sm ${channel === c
                ? 'bg-fg text-bg' : 'bg-fg/5 text-fg hover:bg-fg/10'}`}>
              {c}
            </button>
          ))}
        </div>
        <label class="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={st.autoCheck}
            onChange={(e) => setAuto((e.target as HTMLInputElement).checked)} />
          Täglich automatisch auf Updates prüfen
        </label>

        <button onClick={() => checkUpdate(channel).then(refresh)} disabled={busy}
          class="rounded-md bg-fg/5 px-3 py-1.5 text-sm font-medium hover:bg-fg/10 disabled:opacity-50">
          {st.state === 'checking' ? 'Prüfe…' : 'Auf Updates prüfen'}
        </button>

        {st.available && (
          <div class="rounded-md bg-fg/5 p-3 text-sm">
            <div>Verfügbar: <span class="font-mono">{st.available.version}</span></div>
            {st.available.notes && <pre class="mt-1 whitespace-pre-wrap text-xs text-muted">{st.available.notes}</pre>}
            {st.state === 'updateAvailable' && (
              <button onClick={() => setConfirmInstall(true)}
                class="mt-2 rounded-md bg-fg px-3 py-1.5 text-sm font-medium text-bg">
                Installieren
              </button>
            )}
          </div>
        )}

        {(st.state === 'downloading' || st.state === 'flashing') && (
          <ProgressBar label={st.state === 'downloading' ? 'Lade…' : 'Flashe…'} pct={st.progress} />
        )}
        {st.state === 'error' && <div class="text-sm text-red-500">Fehler: {st.error}</div>}
      </section>

      <section class="mt-4 rounded-lg border border-border bg-surface p-4 space-y-4">
        <div class="font-medium">Manueller Upload</div>
        <FileUpload label="Firmware (.bin)" accept=".bin" pct={fwPct}
          onPick={(f) => { setFwPct(0); uploadFirmware(f, setFwPct).then(() => setFwPct(100)).catch(() => setFwPct(null)); }} />
        <FileUpload label="UI-Paket (.tar)" accept=".tar" pct={tarPct}
          onPick={(f) => { setTarPct(0); uploadAssets(f, setTarPct).then(() => setTarPct(100)).catch(() => setTarPct(null)); }} />
      </section>

      <ConfirmModal open={confirmInstall} title="Update installieren?"
        confirmLabel="Installieren" cancelLabel="Abbrechen" destructive
        onCancel={() => setConfirmInstall(false)}
        onConfirm={() => { setConfirmInstall(false); installUpdate(channel).then(refresh); }}>
        Firmware <span class="font-mono">{st.available?.version}</span> wird geflasht und das Gerät startet neu.
      </ConfirmModal>
    </div>
  );
}

function ProgressBar({ label, pct }: { label: string; pct: number }) {
  return (
    <div>
      <div class="text-xs text-muted">{label} {pct}%</div>
      <div class="mt-1 h-2 rounded bg-fg/10">
        <div class="h-2 rounded bg-fg" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function FileUpload({ label, accept, pct, onPick }: {
  label: string; accept: string; pct: number | null; onPick: (f: File) => void;
}) {
  return (
    <div>
      <label class="text-sm">{label}</label>
      <input type="file" accept={accept} class="mt-1 block w-full text-sm"
        onChange={(e) => {
          const f = (e.target as HTMLInputElement).files?.[0];
          if (f) onPick(f);
        }} />
      {pct !== null && <ProgressBar label="Upload" pct={pct} />}
    </div>
  );
}
```

- [ ] **Step 2: Route registrieren**

In `BrewControl/web/src/app.tsx`: import and add the route inside `<Router>`:
```tsx
import { FirmwarePage } from './pages/FirmwarePage';
```
```tsx
      <FirmwarePage path="/settings/firmware" />
```

- [ ] **Step 3: Settings-Kachel + Badge**

In `BrewControl/web/src/pages/SettingsIndex.tsx`, make it poll the update status for a badge and add the tile. Replace the component body:

```tsx
import { useEffect, useState } from 'preact/hooks';
import { getUpdateStatus } from '../api';

export function SettingsIndex(_: { path?: string }) {
  const [updateAvail, setUpdateAvail] = useState(false);
  useEffect(() => {
    getUpdateStatus().then((s) => setUpdateAvail(s.state === 'updateAvailable')).catch(() => {});
  }, []);
  return (
    <div class="min-h-screen bg-bg p-4 text-fg md:p-6">
      <header class="flex items-center gap-3">
        <a href="/" class="text-lg leading-none text-faint hover:text-fg">←</a>
        <h1 class="text-xl font-medium tracking-tight">Einstellungen</h1>
      </header>
      <div class="mt-6 space-y-2">
        <a href="/settings/appearance"
          class="flex items-center justify-between rounded-lg border border-border bg-surface px-4 py-3 hover:bg-fg/5">
          <div>
            <div class="font-medium">Darstellung</div>
            <div class="text-xs text-muted">Modus, Akzentfarbe, Hintergrund</div>
          </div>
          <span class="text-faint">›</span>
        </a>
        <a href="/settings/devices"
          class="flex items-center justify-between rounded-lg border border-border bg-surface px-4 py-3 hover:bg-fg/5">
          <div>
            <div class="font-medium">Geräte</div>
            <div class="text-xs text-muted">Sensoren, Regler, Aktoren verwalten</div>
          </div>
          <span class="text-faint">›</span>
        </a>
        <a href="/settings/firmware"
          class="flex items-center justify-between rounded-lg border border-border bg-surface px-4 py-3 hover:bg-fg/5">
          <div>
            <div class="font-medium">
              Firmware-Update
              {updateAvail && <span class="ml-2 rounded-full bg-amber-500 px-2 py-0.5 text-xs text-white">Update verfügbar</span>}
            </div>
            <div class="text-xs text-muted">Version, Kanal, Upload</div>
          </div>
          <span class="text-faint">›</span>
        </a>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Typecheck + Build**

```powershell
cd BrewControl\web
pnpm typecheck
pnpm build
```
Expected: typecheck clean, `dist/` produced.

- [ ] **Step 5: UI gegen Gerät verifizieren (Dev-Proxy)**

```powershell
pnpm dev
```
Open `http://localhost:5173/settings/firmware` → page renders version, channel toggle works (persists via `/api/settings`), "Auf Updates prüfen" populates available version, file pickers show progress.

- [ ] **Step 6: Commit**

```bash
git add BrewControl/web/src/pages/FirmwarePage.tsx BrewControl/web/src/app.tsx BrewControl/web/src/pages/SettingsIndex.tsx
git commit -m "feat(web): firmware update page, route, settings tile + badge"
```

---

## Phase 7 — CI + Doku

### Task 10: GitHub-Action — Release-Build

**Files:**
- Create: `.github/workflows/release.yml`

- [ ] **Step 1: Workflow schreiben**

Create `.github/workflows/release.yml`:

```yaml
name: Release

on:
  push:
    tags: ['v*']

jobs:
  firmware:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        env: [esp32dev, lolin_s2_mini, lilygo_t_display_s3_amoled]
    steps:
      - uses: actions/checkout@v4
        with: { fetch-depth: 0 }   # tags needed for git describe (fallback)
      - uses: actions/setup-python@v5
        with: { python-version: '3.12' }
      - run: pip install platformio
      - name: Build ${{ matrix.env }}
        working-directory: BrewControl/firmware
        env:
          BREWCTL_VERSION_OVERRIDE: ${{ github.ref_name }}
        run: pio run -e ${{ matrix.env }}
      - name: Rename artifact
        working-directory: BrewControl/firmware
        run: cp .pio/build/${{ matrix.env }}/firmware.bin firmware-${{ matrix.env }}.bin
      - uses: softprops/action-gh-release@v2
        with:
          files: BrewControl/firmware/firmware-${{ matrix.env }}.bin

  webui:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with: { version: 10 }
      - uses: actions/setup-node@v4
        with: { node-version: '22', cache: 'pnpm', cache-dependency-path: BrewControl/web/pnpm-lock.yaml }
      - name: Build web
        working-directory: BrewControl/web
        run: |
          pnpm install --frozen-lockfile
          pnpm build
          find dist -type f \( -name '*.js' -o -name '*.css' -o -name '*.html' \) -exec gzip -k9 {} +
          tar -C dist -cf ../webui.tar .
      - uses: softprops/action-gh-release@v2
        with:
          files: BrewControl/webui.tar
```

- [ ] **Step 2: Verifikation (Test-Tag)**

Push a throwaway tag and confirm the release gets all assets:
```bash
git tag v0.0.1-test && git push origin v0.0.1-test
```
Expected: GitHub Release `v0.0.1-test` with `firmware-esp32dev.bin`, `firmware-lolin_s2_mini.bin`, `firmware-lilygo_t_display_s3_amoled.bin`, `webui.tar`. Delete the test tag/release afterwards.

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/release.yml
git commit -m "ci: build firmware matrix + webui.tar on tag push"
```

### Task 11: README — Release-Prozess, /www-Deploy, Brick-Rettung

**Files:**
- Modify: `BrewControl/README.md`

- [ ] **Step 1: Abschnitt ergänzen**

Append to `BrewControl/README.md` a "Firmware-Update" section documenting:

```markdown
## Firmware-Update

Drei Wege:
- **Server-Pull (GitHub):** `/settings/firmware` → Kanal (stable/preview) wählen →
  „Auf Updates prüfen" → „Installieren". Zieht `firmware-<variant>.bin` + `webui.tar`
  aus dem passenden Release. Repo `nhhop/Brauerei` muss **public** sein.
- **Browser-Upload:** dieselbe Seite — `.bin` (Firmware) bzw. `.tar` (UI-Paket).
- **USB (Brick-Rettung):** Bootet das Gerät nach einem fehlerhaften Flash nicht mehr,
  ist die WebUI weg → per Kabel `pio run -e <env> -t upload` neu flashen.

### UI liegt jetzt unter /www
Die SPA wird aus `/www` auf der SD-Karte serviert (vorher SD-Root). Beim Deploy:
`Copy-Item -Recurse -Force .\dist\* D:\www\`. Bestehende Karten: Assets nach `/www`
verschieben, oder einmal ein `webui.tar` über die UI einspielen (legt `/www` an).

### Release erstellen
`git tag vX.Y.Z && git push origin vX.Y.Z` → die GitHub-Action baut alle Board-
Varianten und hängt `firmware-<env>.bin` + `webui.tar` ans Release. Stable = normales
Release, Preview = als „Pre-release" markieren.

### Partition-Caveat
OTA braucht zwei App-Slots (Default-Partition hat das). Reicht der App-Slot nach
TLS-Zuwachs nicht (`pio run` zeigt Flash > ~95 %), in `platformio.ini`
`board_build.partitions = min_spiffs.csv` setzen — der **erste** Layout-Wechsel muss
dann **einmalig per USB** geflasht werden (OTA kann das Layout nicht ändern).
```

- [ ] **Step 2: Commit**

```bash
git add BrewControl/README.md
git commit -m "docs: firmware-update usage, /www deploy, brick recovery"
```

---

## Phase 8 — Partition-Verifikation

### Task 12: Flash-Größe prüfen, ggf. Partition anpassen

**Files:**
- (conditional) Modify: `BrewControl/firmware/platformio.ini`

- [ ] **Step 1: Flash-Nutzung aller Envs messen**

```powershell
cd BrewControl\firmware
pio run -e esp32dev
pio run -e lolin_s2_mini
pio run -e lilygo_t_display_s3_amoled
```
Note each `Flash: X%` line. The relevant constraint is the **app-partition** fit: with the default OTA partition the app slot is ~1.31 MB on 4 MB boards.

- [ ] **Step 2: Entscheidung**

- If all envs report Flash well under the slot (e.g. < 85 %): **no change** — close this task.
- If esp32dev/S2 (4 MB) approaches the limit: add to each affected `[env:*]`:
  ```ini
  board_build.partitions = min_spiffs.csv
  ```
  (≈1.9 MB app slots; SPIFFS unused since assets live on SD.) Re-run `pio run` to confirm headroom. Document in README that this layout change needs a one-time USB flash.

- [ ] **Step 3: Commit (only if changed)**

```bash
git add BrewControl/firmware/platformio.ini
git commit -m "build(fw): widen app partition for OTA headroom"
```

---

## Phase 9 — Doku-Abschluss

### Task 13: PLAN.md / SESSION.md aktualisieren

**Files:**
- Modify: `BrewControl/PLAN.md` (OTA Future-Work-Eintrag → erledigt)
- Modify: `BrewControl/SESSION.md` (Session-Eintrag)
- Modify: `PLAN.md` (Root, Welle-3-OTA-Eintrag → erledigt)

- [ ] **Step 1: PLAN/SESSION fortschreiben**

In `BrewControl/PLAN.md` mark the OTA Future-Work bullet as done (analog zum erledigten WiFi-Reset-Eintrag). In root `PLAN.md` Welle 3 den OTA-Punkt als erledigt markieren mit Verweis auf die Spec. In `BrewControl/SESSION.md` einen datierten Eintrag (2026-06-03) mit Kurz-Zusammenfassung, betroffenen Dateien und E2E-Ergebnis ergänzen.

- [ ] **Step 2: Commit**

```bash
git add BrewControl/PLAN.md BrewControl/SESSION.md PLAN.md
git commit -m "docs: mark OTA firmware-update done, session log 2026-06-03"
```

---

## Self-Review-Ergebnis (vom Plan-Autor)

- **Spec-Coverage:** Browser-Upload .bin (Task 6/7), UI-Assets .tar (Task 6/7), GitHub-Pull (Task 5/7), Auto-Check täglich (Task 5), Varianten-Modell (Task 1/5), `webui.tar`-Singular (Task 5/10), setInsecure (Task 5), atomarer /www-Swap (Task 6), Channel/AutoCheck-Persistenz (Task 4), CI-Matrix (Task 10), Partition-Caveat (Task 11/12), Brick-Rettung-Doku (Task 11) — alle abgedeckt.
- **Abweichung von der Spec, bewusst:** Die Spec ließ offen, *wo* die Assets liegen; der Plan legt den Serve-Root auf `/www`, weil ein echter atomarer Swap einen wechselbaren Unterordner braucht (Spec sagte „atomar via Rename"). Erfordert SD-Migration — in README dokumentiert.
- **Offene Out-of-Scope-Punkte (unverändert):** TLS-Pinning, API-Auth, Code-Signing, OTA-Rollback — in der Spec als Härtungs-Schritte; **nicht** Teil dieses Plans.
- **Typ-Konsistenz:** `requestCheck`/`requestInstall`/`statusJson`/`firmwareChannel`/`firmwareAutoCheck`, `TarExtractor::OpenCb/WriteCb/CloseCb`, `UpdateStatus`/`FirmwareSettings` über alle Tasks identisch verwendet.
- **Bekannte Risiken für die Umsetzung:** (a) `Update.write` braucht `uint8_t*` non-const — im Pull-Pfad via `const_cast` gelöst, im Upload-Pfad ist `data` bereits non-const. (b) GitHub-Releases-JSON-Filter auf das Array (preview) muss elementweise greifen — bei Problemen `per_page` klein halten + Filter prüfen. (c) Rekursives Löschen großer `/www`-Bäume läuft bewusst auf dem loopTask (Swap), nicht im AsyncTCP-Callback.
```
