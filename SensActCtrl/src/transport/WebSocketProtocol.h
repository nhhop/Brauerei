#pragma once

#include <stddef.h>
#include <stdint.h>
#include <cstring>
#include <string>

namespace SensActCtrl {
namespace websocket {

// Wire format of WebSocketTransport — one WebSocket text frame per message:
//   Data:             'D' <topic> '\n' <payload>
//   Retained-Request: 'R'
// The topic ends at the first '\n'; the payload may contain further '\n'.
// Free of any socket library so it can be unit-tested natively.

constexpr char kFrameData = 'D';
constexpr char kFrameRetainedRequest = 'R';

enum class FrameType { Invalid, Data, RetainedRequest };

struct Frame {
  FrameType type = FrameType::Invalid;
  std::string topic;
  std::string payload;
};

// Returns an empty string if the topic can't be framed (empty, or contains
// the '\n' separator).
inline std::string encodeData(const char* topic, const char* payload) {
  if (!topic || topic[0] == '\0' || std::strchr(topic, '\n')) return {};
  if (!payload) payload = "";
  std::string out;
  out.reserve(2 + std::strlen(topic) + std::strlen(payload));
  out += kFrameData;
  out += topic;
  out += '\n';
  out += payload;
  return out;
}

inline Frame decodeFrame(const char* data, size_t length) {
  Frame f;
  if (!data || length == 0) return f;
  if (data[0] == kFrameRetainedRequest) {
    if (length == 1) f.type = FrameType::RetainedRequest;
    return f;
  }
  if (data[0] != kFrameData) return f;
  const char* nl = static_cast<const char*>(std::memchr(data + 1, '\n', length - 1));
  if (!nl || nl == data + 1) return f;  // no separator, or empty topic
  f.type = FrameType::Data;
  f.topic.assign(data + 1, nl);
  f.payload.assign(nl + 1, data + length);
  return f;
}

// Device segment of a remote topic (<prefix>/<device>/<kind>/<id>[/...]): the
// segment right before the first "/sensor/", "/actuator/" or "/controller/".
// Empty if the topic has none.
inline std::string deviceOfTopic(const std::string& topic) {
  static const char* const kKinds[] = {"/sensor/", "/actuator/", "/controller/"};
  size_t pos = std::string::npos;
  for (const char* kind : kKinds) {
    const size_t p = topic.find(kind);
    if (p < pos) pos = p;
  }
  if (pos == std::string::npos) return {};
  const size_t slash = topic.rfind('/', pos == 0 ? 0 : pos - 1);
  const size_t start = (slash == std::string::npos || slash >= pos) ? 0 : slash + 1;
  return topic.substr(start, pos - start);
}

// True for command topics (".../set", ".../tune") — the ones addressed to
// exactly one device.
inline bool isCommandTopic(const std::string& topic) {
  auto endsWith = [&](const char* suffix) {
    const size_t n = std::strlen(suffix);
    return topic.size() >= n && topic.compare(topic.size() - n, n, suffix) == 0;
  };
  return endsWith("/set") || endsWith("/tune");
}

struct Url {
  std::string host;
  uint16_t port = 80;
  std::string path = "/";
};

// Parses "ws://host[:port][/path]". Only plain ws:// — there is no TLS
// support, so wss:// (and anything else) is rejected.
inline bool parseUrl(const char* url, Url& out) {
  static constexpr char kScheme[] = "ws://";
  if (!url || std::strncmp(url, kScheme, sizeof(kScheme) - 1) != 0) return false;
  const char* p = url + sizeof(kScheme) - 1;

  const char* hostEnd = p;
  while (*hostEnd && *hostEnd != ':' && *hostEnd != '/') ++hostEnd;
  if (hostEnd == p) return false;

  Url u;
  u.host.assign(p, hostEnd);
  p = hostEnd;

  if (*p == ':') {
    ++p;
    uint32_t port = 0;
    const char* digits = p;
    while (*p >= '0' && *p <= '9') {
      port = port * 10 + static_cast<uint32_t>(*p - '0');
      if (port > 65535) return false;
      ++p;
    }
    if (p == digits || port == 0) return false;
    if (*p && *p != '/') return false;
    u.port = static_cast<uint16_t>(port);
  }

  if (*p == '/') u.path = p;
  out = u;
  return true;
}

}  // namespace websocket
}  // namespace SensActCtrl
