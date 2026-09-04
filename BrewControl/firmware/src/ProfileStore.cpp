#include "ProfileStore.h"

#include <math.h>

#include "SdLock.h"

namespace BrewControl {

// ── Persistence ───────────────────────────────────────────────────────────────

void ProfileStore::loadFromSD(fs::FS& sd) {
  SdLock sdLock;
  File f = sd.open("/config/profiles.json");
  if (!f) return;
  JsonDocument doc;
  if (deserializeJson(doc, f) != DeserializationError::Ok) { f.close(); return; }
  f.close();

  for (JsonObject obj : doc["categories"].as<JsonArray>()) {
    Category c;
    c.id   = obj["id"]   | "";
    c.name = obj["name"] | "";
    if (c.id.empty() || c.name.empty()) continue;
    categories_.push_back(std::move(c));
  }
  // After the categories: fillFromJson rejects profiles pointing at an unknown
  // category.
  for (JsonObject obj : doc["profiles"].as<JsonArray>()) {
    Profile p;
    p.id = obj["id"] | "";
    if (p.id.empty()) continue;
    if (!fillFromJson(p, obj)) continue;
    profiles_.push_back(std::move(p));
  }
}

void ProfileStore::saveToSD(fs::FS& sd) const {
  SdLock sdLock;
  sd.mkdir("/config");
  File f = sd.open("/config/profiles.json", FILE_WRITE);
  if (!f) return;
  f.print(serialize());
  f.close();
}

// ── Serialization ─────────────────────────────────────────────────────────────

String ProfileStore::serialize() const {
  JsonDocument doc;
  JsonArray cats = doc["categories"].to<JsonArray>();
  for (const auto& c : categories_) {
    JsonObject obj = cats.add<JsonObject>();
    obj["id"]   = c.id.c_str();
    obj["name"] = c.name.c_str();
  }
  JsonArray profs = doc["profiles"].to<JsonArray>();
  for (const auto& p : profiles_) {
    JsonObject obj = profs.add<JsonObject>();
    obj["id"]       = p.id.c_str();
    obj["name"]     = p.name.c_str();
    obj["category"] = p.category.c_str();
    JsonArray steps = obj["steps"].to<JsonArray>();
    for (const auto& s : p.steps) {
      JsonObject so = steps.add<JsonObject>();
      if (!s.name.empty()) so["name"] = s.name.c_str();
      so["setpoint"] = s.setpoint;
      so["holdSec"]  = s.holdSec;
      if (s.confirm) so["confirm"] = true;
    }
  }
  String out;
  serializeJson(doc, out);
  return out;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

String ProfileStore::generateId() {
  char buf[7];
  snprintf(buf, sizeof(buf), "%06lx", (unsigned long)(random(0x1000000)));
  return String(buf);
}

bool ProfileStore::hasCategory_(const char* id) const {
  for (const auto& c : categories_) {
    if (c.id == id) return true;
  }
  return false;
}

bool ProfileStore::fillFromJson(Profile& p, const JsonObject& cfg) const {
  p.name     = cfg["name"]     | "";
  p.category = cfg["category"] | "";
  p.steps.clear();
  for (JsonObject s : cfg["steps"].as<JsonArray>()) {
    if (!s["setpoint"].is<float>()) continue;
    const float sp = s["setpoint"].as<float>();
    if (!isfinite(sp)) continue;
    Step st;
    st.name     = s["name"]    | "";
    st.setpoint = sp;
    st.holdSec  = s["holdSec"] | 0;
    st.confirm  = s["confirm"] | false;
    p.steps.push_back(std::move(st));
  }
  return !p.name.empty() && hasCategory_(p.category.c_str()) && !p.steps.empty();
}

// ── Categories ────────────────────────────────────────────────────────────────

String ProfileStore::addCategory(const JsonObject& cfg) {
  Category c;
  c.name = cfg["name"] | "";
  if (c.name.empty()) return String();
  c.id = generateId().c_str();
  String id = c.id.c_str();
  categories_.push_back(std::move(c));
  return id;
}

bool ProfileStore::updateCategory(const char* id, const JsonObject& cfg) {
  const char* name = cfg["name"] | "";
  if (name[0] == '\0') return false;
  for (auto& c : categories_) {
    if (c.id == id) { c.name = name; return true; }
  }
  return false;
}

bool ProfileStore::removeCategory(const char* id) {
  for (auto it = categories_.begin(); it != categories_.end(); ++it) {
    if (it->id != id) continue;
    categories_.erase(it);
    // Cascade: the category is mandatory, so its profiles would be orphans.
    for (auto p = profiles_.begin(); p != profiles_.end();) {
      p = (p->category == id) ? profiles_.erase(p) : p + 1;
    }
    return true;
  }
  return false;
}

// ── Profiles ──────────────────────────────────────────────────────────────────

String ProfileStore::addProfile(const JsonObject& cfg) {
  Profile p;
  if (!fillFromJson(p, cfg)) return String();
  p.id = generateId().c_str();
  String id = p.id.c_str();
  profiles_.push_back(std::move(p));
  return id;
}

bool ProfileStore::updateProfile(const char* id, const JsonObject& cfg) {
  for (auto& p : profiles_) {
    if (p.id != id) continue;
    Profile tmp;                       // validate before overwriting
    if (!fillFromJson(tmp, cfg)) return false;
    p.name     = std::move(tmp.name);
    p.category = std::move(tmp.category);
    p.steps    = std::move(tmp.steps);
    return true;
  }
  return false;
}

bool ProfileStore::removeProfile(const char* id) {
  for (auto it = profiles_.begin(); it != profiles_.end(); ++it) {
    if (it->id == id) { profiles_.erase(it); return true; }
  }
  return false;
}

}  // namespace BrewControl
