#pragma once

#include <ArduinoJson.h>
#include <FS.h>
#include <string>
#include <vector>

namespace BrewControl {

// Stores the profile library: reusable step templates ("Maischeplan",
// "Gaerverlauf") that fill a setpoint program's steps without retyping them.
//
// A profile is a named list of steps with the exact same shape as a program's
// steps { name?, setpoint, holdSec, confirm } — applying a profile copies the
// steps into a program instance, it never references the profile. Unlike a
// program a profile has no controller and no runtime state; the controller is
// bound on the program.
//
// Profiles are grouped into user-defined categories; the category is mandatory,
// so removing one also removes the profiles it holds.
//
// Persists categories and profiles to /config/profiles.json.
class ProfileStore {
 public:
  void loadFromSD(fs::FS& sd);
  void saveToSD(fs::FS& sd) const;

  // Serializes the whole library as {"categories":[...],"profiles":[...]}.
  String serialize() const;

  // Creates a category from cfg {name}. Returns the generated id, or "" if the
  // name is missing.
  String addCategory(const JsonObject& cfg);

  // Renames a category. Returns false if id not found or the name is empty.
  bool updateCategory(const char* id, const JsonObject& cfg);

  // Removes a category and every profile in it. False if id not found.
  bool removeCategory(const char* id);

  // Creates a profile from cfg {name, category, steps:[{name?,setpoint,
  // holdSec,confirm?}]}. Returns the generated id, or "" if the config is
  // invalid (no name, unknown category or no valid steps).
  String addProfile(const JsonObject& cfg);

  // Replaces an existing profile. False if id not found or the config is
  // invalid.
  bool updateProfile(const char* id, const JsonObject& cfg);

  // Removes a profile. False if id not found.
  bool removeProfile(const char* id);

 private:
  struct Category {
    std::string id;
    std::string name;
  };

  // Mirrors ProgramRunner::Step — same wire shape (ProgramStep in the OpenAPI
  // spec), kept separate because the runner's struct is private and carries
  // runtime state.
  struct Step {
    std::string name;          // optional, cosmetic
    float       setpoint = 0;
    uint32_t    holdSec  = 0;
    bool        confirm  = false;
  };

  struct Profile {
    std::string id;
    std::string name;
    std::string category;      // Category::id, mandatory
    std::vector<Step> steps;
  };

  std::vector<Category> categories_;
  std::vector<Profile>  profiles_;

  bool hasCategory_(const char* id) const;

  static String generateId();
  // Fills name/category/steps from cfg; returns false if the result is invalid
  // (no name, unknown category or no valid steps). Not static: needs the
  // category list for the reference check.
  bool fillFromJson(Profile& p, const JsonObject& cfg) const;
};

}  // namespace BrewControl
