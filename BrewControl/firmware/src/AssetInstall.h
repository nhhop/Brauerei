#pragma once

#include <Arduino.h>
#include <FS.h>
#ifdef BREWCTL_USE_LITTLEFS
#include <LittleFS.h>
#endif

#include "SdLock.h"
#include "TarExtractor.h"

// Extracting a UI package (webui.tar) into /www — shared by the manual upload
// (POST /api/update/assets, WebUI.cpp) and the release install
// (FirmwareUpdater::doInstall), so both handle the small LittleFS partition
// the same way. Usage: prepare(), extract into kTarget through wrapOpen(),
// then finish() on success.
namespace BrewControl {
namespace AssetInstall {

// Normally a staging dir swapped in only after a complete extraction, so a
// failed install leaves the running UI intact. BREWCTL_ASSETS_IN_PLACE is for
// boards whose data partition cannot hold the old and the new bundle at once
// (the 256 KB partition of partitions_4mb_littlefs.csv): /www is cleared first
// and overwritten directly — a failure then leaves no UI (kRecoveryPageHtml in
// WebUI.cpp takes over). It is about partition size, not LittleFS: a board
// with a larger data partition keeps the staged swap.
#ifdef BREWCTL_ASSETS_IN_PLACE
constexpr char kTarget[] = "/www";
#else
constexpr char kTarget[] = "/www.new";
#endif

inline void removeRecursive(fs::FS& fs, const char* path) {
  SdLock lock;
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

#ifdef BREWCTL_USE_LITTLEFS
// esp_littlefs panics (IntegerDivideByZero in lfs_alloc) instead of returning
// an error when a write finds no free block, rebooting mid-request. So check
// before opening each archived file that it fits, with headroom for block
// rounding, CTZ skip-list pointers and a metadata block.
inline bool littleFsHasRoomFor(uint32_t fileSize) {
  constexpr size_t kBlock = 4096;
  size_t freeBytes = LittleFS.totalBytes() - LittleFS.usedBytes();
  return freeBytes >= fileSize + fileSize / 64 + 2 * kBlock;
}
#endif

// Recursive removal: plain rmdir() silently no-ops on a non-empty dir, so a
// previous failed/partial extraction would otherwise leave stale files behind
// for this run to write into (FILE_WRITE appends rather than truncates on this
// platform). /www.new is cleared in place mode too: leftovers of an earlier
// staged attempt eat space.
inline void prepare(fs::FS& fs) {
  removeRecursive(fs, "/www.new");
#ifdef BREWCTL_ASSETS_IN_PLACE
  removeRecursive(fs, "/www");
#endif
  SdLock lock;
  fs.mkdir(kTarget);
}

// Wraps the sink's open callback. On LittleFS it refuses a file that would not
// fit and reports it in `noSpace` (which must outlive the extraction). In place
// it holds index.html back under a .part name until finish(): index.html is
// what makes /www count as a UI (see onNotFound in WebUI.cpp), so an aborted
// install — also a dropped connection — ends on the recovery page, not on a
// broken UI.
inline TarExtractor::OpenCb wrapOpen(TarExtractor::OpenCb open, String& noSpace) {
  noSpace = "";
#ifdef BREWCTL_USE_LITTLEFS
  open = [open, &noSpace](const std::string& path, uint32_t size) {
    if (!littleFsHasRoomFor(size)) {
      noSpace = "not enough space (" + String(path.c_str()) + ", " + String(size) +
                " bytes)";
      return false;
    }
    return open(path, size);
  };
#endif
#ifdef BREWCTL_ASSETS_IN_PLACE
  open = [open](const std::string& path, uint32_t size) {
    bool isIndex = path == "index.html" || path == "./index.html" ||
                   path == "index.html.gz" || path == "./index.html.gz";
    return open(isIndex ? path + ".part" : path, size);
  };
#endif
  return open;
}

// After a complete extraction. In place: release the held-back index.html.
// Staged: nothing here — the caller swaps /www.new in, from loopTask.
inline void finish(fs::FS& fs) {
#ifdef BREWCTL_ASSETS_IN_PLACE
  SdLock lock;
  for (const char* f : {"/www/index.html", "/www/index.html.gz"}) {
    String part = String(f) + ".part";
    if (fs.exists(part)) fs.rename(part, f);
  }
#else
  (void)fs;
#endif
}

}  // namespace AssetInstall
}  // namespace BrewControl
