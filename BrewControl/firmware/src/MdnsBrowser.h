#pragma once

#ifdef ARDUINO

#include <Arduino.h>

#include <mutex>
#include <string>
#include <vector>

// Keep mdns.h out of consumer headers (it drags in the whole IDF component).
struct mdns_search_once_s;

namespace BrewControl {

// The service every board announces (main.cpp startMDNS) and this browser
// looks for. Advertised on port 80 — the HTTP API is what a peer actually
// talks to; the WebSocket hub port travels in the "ws" TXT record.
constexpr const char* kServiceType = "_sensactctrl";
constexpr const char* kServiceProto = "_tcp";

// One board found on the LAN via _sensactctrl._tcp.
struct DiscoveredPeer {
  std::string hostname;   // as mDNS reports it, without the ".local" suffix
  std::string ip;         // first IPv4 address
  std::string device;     // TXT "dev" — device id this board publishes under
  std::string prefix;     // TXT "prefix" — its topic prefix
  uint16_t wsPort = 0;    // TXT "ws" — its WebSocket hub port, 0 = not a hub
  bool self = false;      // this very board (reported, not hidden)
};

// Browses _sensactctrl._tcp, backing GET /api/remote/peers.
//
// Same state machine and 202-poll contract as SensActCtrl::DiscoveryScanner,
// for the same reason: the HTTP handler runs on the async_tcp task and may
// only arm a scan and pick results up, while the query itself is issued and
// collected from loop(). Deliberately the asynchronous mDNS API —
// MDNS.queryService() blocks the caller for the whole search window, which
// would stall sensor and controller ticks.
//
// Lifecycle: begin() once WiFi is up, tick(nowMs) from loop(). requestScan()
// arms a scan; it runs for kWindowMs, then status() reports Done until
// takeResults() hands the list over (or it goes stale after kResultTtlMs).
class MdnsBrowser {
 public:
  enum class Status { Idle, Running, Done };

  static constexpr uint32_t kWindowMs = 3000;
  static constexpr uint32_t kResultTtlMs = 30000;
  // Plenty for a brewery; caps what one answer burst can allocate.
  static constexpr size_t kMaxResults = 16;

  ~MdnsBrowser();

  // ownHostname marks our own entry as self instead of dropping it, so the UI
  // can grey it out rather than leaving the user wondering where it went.
  void begin(const String& ownHostname);
  void tick(uint32_t nowMs);

  // Must be called right before MDNS.end() — from whichever task restarts the
  // responder, which for us is the WiFi event task on every STA_GOT_IP.
  // mdns_free() also releases outstanding search objects, so ours must not be
  // touched or deleted afterwards; tick() drops the pointer instead. Worst
  // case, if a future IDF keeps searches across mdns_free(), this leaks one
  // small object per reconnect-during-scan instead of crashing.
  void abandonSearch();

  // No-op while a scan is already running or its results are waiting.
  void requestScan();
  Status status() const;
  // Returns the collected peers and resets to Idle. Empty unless Done.
  std::vector<DiscoveredPeer> takeResults();

 private:
  std::string ownHostname_;

  mutable std::mutex mutex_;
  Status status_ = Status::Idle;
  bool pending_ = false;
  bool abandoned_ = false;
  uint32_t startMs_ = 0;
  std::vector<DiscoveredPeer> peers_;

  // Created and polled only from tick() (loop task); abandonSearch() can make
  // tick() drop it, which is why it is read under the lock there too.
  mdns_search_once_s* search_ = nullptr;
};

}  // namespace BrewControl

#endif  // ARDUINO
