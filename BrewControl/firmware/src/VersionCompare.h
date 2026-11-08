#pragma once

#include <cctype>
#include <cstdlib>
#include <string>
#include <vector>

// Orders firmware versions for FirmwareUpdater: release tags (v0.9.0,
// v0.9.0-rc.1, semver precedence incl. pre-release identifiers) and local
// builds, which carry `git describe --tags --dirty` output
// (v0.8.0-3-gabc1234-dirty: 3 commits past v0.8.0, newer than the tag but
// older than any later release). Header-only so the native tests can use it.
namespace BrewControl {

namespace detail {

struct Version {
  long num[3] = {0, 0, 0};
  std::string pre;    // pre-release identifiers, empty for a release
  long commits = 0;   // git describe: commits past the tag
};

inline bool allDigits(const std::string& s) {
  if (s.empty()) return false;
  for (char c : s) if (!std::isdigit(static_cast<unsigned char>(c))) return false;
  return true;
}

inline bool parseVersion(std::string s, Version& v) {
  const std::string dirty = "-dirty";
  if (s.size() > dirty.size() && s.compare(s.size() - dirty.size(), dirty.size(), dirty) == 0)
    s.resize(s.size() - dirty.size());

  // Trailing "-<commits>-g<hash>" from git describe.
  const size_t g = s.rfind("-g");
  if (g != std::string::npos && g > 0) {
    const size_t dash = s.rfind('-', g - 1);
    if (dash != std::string::npos && allDigits(s.substr(dash + 1, g - dash - 1))) {
      v.commits = std::strtol(s.c_str() + dash + 1, nullptr, 10);
      s.resize(dash);
    }
  }

  if (s.empty() || (s[0] != 'v' && s[0] != 'V')) return false;
  const char* p = s.c_str() + 1;
  for (int i = 0; i < 3; ++i) {
    if (!std::isdigit(static_cast<unsigned char>(*p))) return false;
    char* end = nullptr;
    v.num[i] = std::strtol(p, &end, 10);
    p = end;
    if (i < 2) {
      if (*p != '.') return false;
      ++p;
    }
  }
  if (*p == '-') v.pre = p + 1;
  else if (*p != '\0') return false;
  return true;
}

// Semver rule 11: identifiers left to right, numeric ones numerically and
// below alphanumeric ones, a shorter list first when all else is equal.
inline std::vector<std::string> splitDots(const std::string& s) {
  std::vector<std::string> out;
  size_t start = 0;
  for (size_t dot; (dot = s.find('.', start)) != std::string::npos; start = dot + 1)
    out.push_back(s.substr(start, dot - start));
  out.push_back(s.substr(start));
  return out;
}

inline int comparePre(const std::string& a, const std::string& b) {
  if (a.empty() || b.empty()) return a.empty() - b.empty();  // release > pre-release
  const std::vector<std::string> x = splitDots(a), y = splitDots(b);
  for (size_t i = 0; i < x.size() && i < y.size(); ++i) {
    const bool xn = allDigits(x[i]), yn = allDigits(y[i]);
    if (xn != yn) return xn ? -1 : 1;
    if (xn) {
      const long xv = std::strtol(x[i].c_str(), nullptr, 10);
      const long yv = std::strtol(y[i].c_str(), nullptr, 10);
      if (xv != yv) return xv < yv ? -1 : 1;
    } else if (x[i] != y[i]) {
      return x[i] < y[i] ? -1 : 1;
    }
  }
  return (x.size() > y.size()) - (x.size() < y.size());
}

}  // namespace detail

// True only when both parse and `a` sorts before `b`. Anything unparseable
// (a bare commit hash from `git describe --always`) yields false.
inline bool isOlderVersion(const std::string& a, const std::string& b) {
  detail::Version va, vb;
  if (!detail::parseVersion(a, va) || !detail::parseVersion(b, vb)) return false;
  for (int i = 0; i < 3; ++i)
    if (va.num[i] != vb.num[i]) return va.num[i] < vb.num[i];
  const int pre = detail::comparePre(va.pre, vb.pre);
  if (pre != 0) return pre < 0;
  return va.commits < vb.commits;
}

}  // namespace BrewControl
