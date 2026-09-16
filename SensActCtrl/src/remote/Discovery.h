#pragma once

#include <stddef.h>
#include <stdint.h>
#include <mutex>
#include <string>
#include <vector>

#include "transport/ITransport.h"

namespace SensActCtrl {
namespace remote {

// Discovery protocol — lets a consumer find the items a RemotePublisher
// exposes without knowing device id or prefix up front. Request/response over
// any ITransport; the topics are fixed (prefix-independent) on purpose:
//
//   Request  sensactctrl/discover             {"reply":"sensactctrl/discover/<scanner>","rid":7}
//   Response <reply topic>, one per item/channel
//            {"rid":7,"d":"node-a","p":"brewcontrol","k":"sensor","id":"mash_temp",
//             "ch":"","q":"Temperature","u":"°C"}
//
// Neither is retained. One response per item keeps every message small enough
// for the 250-byte ESP-Now packet limit. `rid` is echoed so a scanner can drop
// late answers to an earlier scan. Controllers are not listed (no remote
// controller proxy exists).
constexpr const char* kDiscoverRequestTopic = "sensactctrl/discover";

inline std::string discoverReplyTopic(const char* scannerId) {
  return std::string(kDiscoverRequestTopic) + "/" + scannerId;
}

struct DiscoveredItem {
  std::string device;
  std::string prefix;
  std::string kind;        // "sensor" | "actuator"
  std::string id;
  std::string channelKey;  // "" for flat single-channel sensors / actuators
  std::string quantity;
  std::string unit;
};

size_t serializeDiscoverRequest(const char* replyTopic, uint32_t rid,
                                char* buf, size_t cap);
bool parseDiscoverRequest(const char* json, std::string& replyTopic, uint32_t& rid);
size_t serializeDiscoverResponse(uint32_t rid, const DiscoveredItem& item,
                                 char* buf, size_t cap);
bool parseDiscoverResponse(const char* json, uint32_t& rid, DiscoveredItem& out);

}  // namespace remote

// Consumer side of the discovery protocol. Thread-safe: requestScan() and
// status()/takeResults() may be called from another task (e.g. an HTTP
// handler) than tick() and the transport callbacks. The request itself is
// only ever published from tick(), so the transport is never touched from a
// foreign task.
//
// Lifecycle: begin() once, tick(nowMs) from loop(). requestScan() arms a scan
// that tick() starts; it runs for kWindowMs, then status() reports Done until
// takeResults() hands the list over (or it goes stale after kResultTtlMs).
class DiscoveryScanner {
 public:
  enum class Status { Idle, Running, Done };

  static constexpr uint32_t kWindowMs = 3000;
  static constexpr uint32_t kResultTtlMs = 30000;

  // ownDeviceId names the reply topic and filters out answers from this very
  // device (a broker loops our own publisher's response back to us).
  DiscoveryScanner(ITransport& transport, const char* ownDeviceId);

  void begin();
  void tick(uint32_t nowMs);

  // No-op while a scan is already running or its results are waiting.
  void requestScan();
  Status status() const;
  // Returns the collected items and resets to Idle. Empty unless Done.
  std::vector<remote::DiscoveredItem> takeResults();

 private:
  void onResponse(const char* payload);

  ITransport* transport_;
  std::string ownDeviceId_;
  std::string replyTopic_;

  mutable std::mutex mutex_;
  Status status_ = Status::Idle;
  bool pending_ = false;
  uint32_t rid_ = 0;
  uint32_t startMs_ = 0;
  std::vector<remote::DiscoveredItem> items_;
};

}  // namespace SensActCtrl
