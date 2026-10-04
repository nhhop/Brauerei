#pragma once

#include <ArduinoJson.h>

// ArduinoJson filter for the GitHub releases JSON (FirmwareUpdater::fetchReleaseMeta).
// An object filter drops a whole array, so the list (preview channel) needs
// filter[0], which applies to every element; a single release (stable channel,
// /releases/latest) needs the plain object.
namespace BrewControl {

inline void makeReleaseFilter(JsonDocument& filter, bool list) {
  JsonObject f = list ? filter[0].to<JsonObject>() : filter.to<JsonObject>();
  f["tag_name"] = true;
  f["prerelease"] = true;
  f["body"] = true;
  f["assets"][0]["name"] = true;
  f["assets"][0]["browser_download_url"] = true;
}

}  // namespace BrewControl
