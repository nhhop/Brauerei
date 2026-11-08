#pragma once

// Helpers shared by the two display layouts: DisplayPages (round glass, one page
// per item) and DisplayWide (1024 x 600 overview with detail sheets). Dashboard
// id resolution, value formatting and the ownership rules of the controllers
// are the same on every board.

#ifdef BREWCTL_HAS_DISPLAY

#include <ArduinoJson.h>
#include <SensActCtrl.h>
#include <lvgl.h>

#include <cmath>
#include <cstring>
#include <string>

#include "../SensorChannels.h"

namespace BrewControl {
namespace dispcommon {

using SensActCtrl::Actuator;
using SensActCtrl::Controller;
using SensActCtrl::Registry;
using SensActCtrl::Sensor;

inline const lv_color_t kDim = lv_color_hex(0x9AA0A6);
inline const lv_color_t kOff = lv_color_hex(0x303030);
inline const lv_color_t kAlert = lv_color_hex(0xEF5350);
inline const lv_color_t kEstopBg = lv_color_hex(0xB71C1C);

// "67.5" -> "67,5": the UI is German. One decimal below a resolution of 1.
inline void formatValue(char* buf, size_t cap, float v, float resolution) {
  if (!std::isfinite(v)) {
    snprintf(buf, cap, "--");
    return;
  }
  snprintf(buf, cap, "%.*f", resolution >= 1.0f ? 0 : 1, v);
  for (char* c = buf; *c; ++c)
    if (*c == '.') *c = ',';
}

// Only touch the label if the text changed - every set invalidates its area,
// and redrawing a big value twice a second for nothing costs loop time.
inline void setText(lv_obj_t* label, const char* text) {
  if (label && strcmp(lv_label_get_text(label), text) != 0)
    lv_label_set_text(label, text);
}

// Dashboard sensor ids are a sensor id, "sensorId.channelKey" or a key list
// "sensorId.key1,key2". Returns the sensor and sets *channel (-1: several
// channels on one page - all of them for a bare id, see keyList() for a list).
inline Sensor* resolveSensor(const Registry& reg, const std::string& id, int* channel) {
  if (Sensor* s = reg.findSensor(id.c_str())) {
    *channel = s->channelCount() == 1 ? 0 : -1;
    return s;
  }
  const size_t dot = id.rfind('.');
  if (dot == std::string::npos) return nullptr;
  Sensor* s = reg.findSensor(id.substr(0, dot).c_str());
  if (!s) return nullptr;
  const char* key = id.c_str() + dot + 1;
  if (strchr(key, ',')) {
    // A key list stays on the dashboard while any of its channels exists.
    for (size_t i = 0; i < s->channelCount(); ++i) {
      if (keyInList(key, s->channel(i).key)) {
        *channel = -1;
        return s;
      }
    }
    return nullptr;
  }
  for (size_t i = 0; i < s->channelCount(); ++i) {
    if (strcmp(s->channel(i).key, key) == 0) {
      *channel = static_cast<int>(i);
      return s;
    }
  }
  return nullptr;
}

// The key list of a dashboard sensor id ("gyro.pitch,roll" -> "pitch,roll"),
// or nullptr when the id shows a single channel or all of them.
inline const char* keyList(const std::string& id) {
  const size_t dot = id.rfind('.');
  if (dot == std::string::npos || id.find(',', dot) == std::string::npos) return nullptr;
  return id.c_str() + dot + 1;
}

inline size_t itemCount(const Registry& reg) {
  return reg.sensors().size() + reg.actuators().size() + reg.controllers().size();
}

// A controller's params name its sensor and the actuator(s) it drives.
inline bool controllerParams(const Controller& c, JsonDocument& doc) {
  char buf[512];
  if (c.paramsJson(buf, sizeof(buf)) == 0) return false;
  return deserializeJson(doc, buf) == DeserializationError::Ok;
}

// Mirrors controllerOwnerOf() in web/src/ownership.ts.
inline const Controller* controllerOwnerOf(const Registry& reg, const char* id) {
  for (const Controller* c : reg.controllers()) {
    JsonDocument doc;
    if (!controllerParams(*c, doc)) continue;
    for (const char* key : {"actuator", "heatActuator", "coolActuator"}) {
      const char* a = doc[key] | "";
      if (strcmp(a, id) == 0) return c;
    }
  }
  return nullptr;
}

inline const char* displayName(const Registry& reg, const char* id) {
  const char* label = reg.label(id);
  return *label ? label : id;
}

inline float valueToFraction(float v, float lo, float hi) {
  if (!(hi > lo) || !std::isfinite(v)) return 0;
  return std::fmin(std::fmax((v - lo) / (hi - lo), 0.0f), 1.0f);
}

// "#rrggbb" as stored by the web UI's appearance settings.
inline lv_color_t parseColor(const String& hex, uint32_t fallback) {
  if (hex.length() != 7 || hex[0] != '#') return lv_color_hex(fallback);
  return lv_color_hex(strtoul(hex.c_str() + 1, nullptr, 16));
}

// Share of an actuator's range, as the web UI's ControllerCard shows it.
inline bool outputPercent(const Registry& reg, const char* id, int* pct) {
  const Actuator* a = *id ? reg.findActuator(id) : nullptr;
  if (!a) return false;
  const auto meta = a->meta();
  if (!(meta.max > meta.min)) return false;
  *pct = static_cast<int>(std::lround(
      valueToFraction(a->state(), meta.min, meta.max) * 100));
  return true;
}

inline void setLocked(lv_obj_t* obj, bool locked) {
  if (!obj) return;
  if (locked)
    lv_obj_add_state(obj, LV_STATE_DISABLED);
  else
    lv_obj_clear_state(obj, LV_STATE_DISABLED);
}

}  // namespace dispcommon
}  // namespace BrewControl

#endif  // BREWCTL_HAS_DISPLAY
