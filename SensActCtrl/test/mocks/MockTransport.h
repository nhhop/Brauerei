#pragma once

#include <map>
#include <string>
#include <utility>
#include <vector>

#include "transport/ITransport.h"

namespace SensActCtrl {
namespace test {

// In-memory transport for unit tests. Always "connected". Subscriptions
// match topics by exact string equality (no MQTT wildcards). When a publish
// with retained=true happens, the payload is cached per topic and replayed
// to any later subscriber — mirrors how a real broker hands retained
// messages to late joiners, which RemoteSensor relies on for meta exchange.
class MockTransport : public ITransport {
 public:
  struct Sent {
    std::string topic;
    std::string payload;
    bool retained;
  };

  bool publish(const char* topic, const char* payload, bool retained) override {
    Sent s{topic, payload, retained};
    published.push_back(s);
    if (retained) retained_[s.topic] = s.payload;
    for (auto& sub : subs_) {
      if (sub.first == s.topic) {
        sub.second(s.topic.c_str(), s.payload.c_str(), s.payload.size());
      }
    }
    return true;
  }

  bool subscribe(const char* topic, MessageCallback callback) override {
    subs_.emplace_back(std::string(topic), callback);
    auto it = retained_.find(topic);
    if (it != retained_.end()) {
      callback(it->first.c_str(), it->second.c_str(), it->second.size());
    }
    return true;
  }

  void tick() override {}
  bool connected() const override { return true; }

  void clear() { published.clear(); }

  // Last payload published to `topic`, or empty string if none.
  std::string lastPayload(const char* topic) const {
    for (auto it = published.rbegin(); it != published.rend(); ++it) {
      if (it->topic == topic) return it->payload;
    }
    return {};
  }

  std::vector<Sent> published;

 private:
  std::vector<std::pair<std::string, MessageCallback>> subs_;
  std::map<std::string, std::string> retained_;
};

}  // namespace test
}  // namespace SensActCtrl
