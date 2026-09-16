#include "Discovery.h"

#include <ArduinoJson.h>

namespace SensActCtrl {
namespace remote {

size_t serializeDiscoverRequest(const char* replyTopic, uint32_t rid,
                                char* buf, size_t cap) {
  JsonDocument doc;
  doc["reply"] = replyTopic;
  doc["rid"] = rid;
  if (measureJson(doc) >= cap) return 0;  // truncated output is not valid JSON
  return serializeJson(doc, buf, cap);
}

bool parseDiscoverRequest(const char* json, std::string& replyTopic, uint32_t& rid) {
  JsonDocument doc;
  if (deserializeJson(doc, json)) return false;
  const char* reply = doc["reply"] | "";
  if (!reply[0]) return false;
  replyTopic = reply;
  rid = doc["rid"] | 0u;
  return true;
}

size_t serializeDiscoverResponse(uint32_t rid, const DiscoveredItem& item,
                                 char* buf, size_t cap) {
  JsonDocument doc;
  doc["rid"] = rid;
  doc["d"] = item.device;
  doc["p"] = item.prefix;
  doc["k"] = item.kind;
  doc["id"] = item.id;
  doc["ch"] = item.channelKey;
  doc["q"] = item.quantity;
  doc["u"] = item.unit;
  if (measureJson(doc) >= cap) return 0;  // truncated output is not valid JSON
  return serializeJson(doc, buf, cap);
}

bool parseDiscoverResponse(const char* json, uint32_t& rid, DiscoveredItem& out) {
  JsonDocument doc;
  if (deserializeJson(doc, json)) return false;
  const char* device = doc["d"] | "";
  const char* id = doc["id"] | "";
  const char* kind = doc["k"] | "";
  if (!device[0] || !id[0] || !kind[0]) return false;
  rid = doc["rid"] | 0u;
  out.device = device;
  out.prefix = doc["p"] | "";
  out.kind = kind;
  out.id = id;
  out.channelKey = doc["ch"] | "";
  out.quantity = doc["q"] | "";
  out.unit = doc["u"] | "";
  return true;
}

}  // namespace remote

DiscoveryScanner::DiscoveryScanner(ITransport& transport, const char* ownDeviceId)
    : transport_(&transport),
      ownDeviceId_(ownDeviceId),
      replyTopic_(remote::discoverReplyTopic(ownDeviceId)) {}

void DiscoveryScanner::begin() {
  transport_->subscribe(replyTopic_.c_str(),
      [this](const char*, const char* p, size_t) { onResponse(p); });
}

void DiscoveryScanner::requestScan() {
  std::lock_guard<std::mutex> lock(mutex_);
  if (status_ == Status::Idle) pending_ = true;
}

DiscoveryScanner::Status DiscoveryScanner::status() const {
  std::lock_guard<std::mutex> lock(mutex_);
  return pending_ ? Status::Running : status_;
}

std::vector<remote::DiscoveredItem> DiscoveryScanner::takeResults() {
  std::lock_guard<std::mutex> lock(mutex_);
  if (status_ != Status::Done) return {};
  status_ = Status::Idle;
  std::vector<remote::DiscoveredItem> out = std::move(items_);
  items_.clear();
  return out;
}

void DiscoveryScanner::tick(uint32_t nowMs) {
  uint32_t rid = 0;
  {
    std::lock_guard<std::mutex> lock(mutex_);
    if (pending_) {
      pending_ = false;
      rid = ++rid_;
      items_.clear();
      startMs_ = nowMs;
      status_ = Status::Running;
    } else if (status_ == Status::Running && nowMs - startMs_ >= kWindowMs) {
      status_ = Status::Done;
    } else if (status_ == Status::Done && nowMs - startMs_ >= kWindowMs + kResultTtlMs) {
      // Nobody picked the results up (UI closed) — don't serve them later.
      items_.clear();
      status_ = Status::Idle;
    }
  }
  if (rid == 0) return;
  // Published outside the lock: a broker may loop the request straight back
  // into a local responder, and its answer into onResponse().
  char buf[128];
  if (remote::serializeDiscoverRequest(replyTopic_.c_str(), rid, buf, sizeof(buf)) == 0) return;
  transport_->publish(remote::kDiscoverRequestTopic, buf, /*retained=*/false);
}

void DiscoveryScanner::onResponse(const char* payload) {
  uint32_t rid = 0;
  remote::DiscoveredItem item;
  if (!remote::parseDiscoverResponse(payload, rid, item)) return;
  if (item.device == ownDeviceId_) return;

  std::lock_guard<std::mutex> lock(mutex_);
  if (status_ != Status::Running || rid != rid_) return;
  for (const auto& e : items_) {
    if (e.device == item.device && e.prefix == item.prefix && e.kind == item.kind &&
        e.id == item.id && e.channelKey == item.channelKey) {
      return;
    }
  }
  items_.push_back(std::move(item));
}

}  // namespace SensActCtrl
