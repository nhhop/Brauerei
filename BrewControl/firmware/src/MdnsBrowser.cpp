#include "MdnsBrowser.h"

#ifdef ARDUINO

#include <mdns.h>

namespace BrewControl {

namespace {

// TXT lookup on one result; returns nullptr when the key is absent.
const char* txtValue(const mdns_result_t* r, const char* key) {
  for (size_t i = 0; i < r->txt_count; ++i) {
    if (strcmp(r->txt[i].key, key) == 0) return r->txt[i].value;
  }
  return nullptr;
}

}  // namespace

MdnsBrowser::~MdnsBrowser() {
  // Only reached on a shutdown path; a search still running would leak.
  if (search_) mdns_query_async_delete(search_);
}

void MdnsBrowser::abandonSearch() {
  std::lock_guard<std::mutex> lock(mutex_);
  abandoned_ = true;
}

void MdnsBrowser::requestScan() {
  std::lock_guard<std::mutex> lock(mutex_);
  if (status_ == Status::Idle) pending_ = true;
}

MdnsBrowser::Status MdnsBrowser::status() const {
  std::lock_guard<std::mutex> lock(mutex_);
  return pending_ ? Status::Running : status_;
}

std::vector<DiscoveredPeer> MdnsBrowser::takeResults() {
  std::lock_guard<std::mutex> lock(mutex_);
  if (status_ != Status::Done) return {};
  status_ = Status::Idle;
  std::vector<DiscoveredPeer> out = std::move(peers_);
  peers_.clear();
  return out;
}

void MdnsBrowser::tick(uint32_t nowMs) {
  bool start = false;
  {
    std::lock_guard<std::mutex> lock(mutex_);
    if (abandoned_) {
      // The responder was torn down under us; the search object went with it.
      // Drop it without deleting and fall back to Idle, so the next poll from
      // the UI simply starts a fresh scan.
      abandoned_ = false;
      search_ = nullptr;
      peers_.clear();
      pending_ = false;
      status_ = Status::Idle;
    }
    if (pending_ && search_ == nullptr) {
      pending_ = false;
      peers_.clear();
      startMs_ = nowMs;
      status_ = Status::Running;
      start = true;
    } else if (status_ == Status::Done && nowMs - startMs_ >= kWindowMs + kResultTtlMs) {
      // Nobody picked the results up (UI closed) — don't serve them later.
      peers_.clear();
      status_ = Status::Idle;
    }
  }

  if (start) {
    // MDNS_TYPE_PTR = the service browse. The query runs for kWindowMs on its
    // own; we only poll it below.
    search_ = mdns_query_async_new(nullptr, kServiceType, kServiceProto, MDNS_TYPE_PTR,
                                   kWindowMs, kMaxResults, nullptr);
    if (search_ == nullptr) {
      // mDNS not up (no WiFi yet) or out of memory — report an empty result
      // rather than leaving the caller polling forever.
      std::lock_guard<std::mutex> lock(mutex_);
      status_ = Status::Done;
    }
    return;
  }

  if (search_ == nullptr) return;
  // timeout 0: never blocks, just asks whether the search has finished.
  mdns_result_t* results = nullptr;
  if (!mdns_query_async_get_results(search_, 0, &results)) return;

  for (const mdns_result_t* r = results; r != nullptr; r = r->next) {
    if (r->hostname == nullptr) continue;
    DiscoveredPeer p;
    p.hostname = r->hostname;
    if (r->addr != nullptr) {
      for (const mdns_ip_addr_t* a = r->addr; a != nullptr; a = a->next) {
        if (a->addr.type == ESP_IPADDR_TYPE_V4) {
          p.ip = IPAddress(a->addr.u_addr.ip4.addr).toString().c_str();
          break;
        }
      }
    }
    if (const char* v = txtValue(r, "dev")) p.device = v;
    if (const char* v = txtValue(r, "prefix")) p.prefix = v;
    if (const char* v = txtValue(r, "ws")) p.wsPort = static_cast<uint16_t>(atoi(v));

    std::lock_guard<std::mutex> lock(mutex_);
    // One board answers once per interface — keep the first hit per hostname.
    bool dup = false;
    for (const auto& e : peers_) {
      if (strcasecmp(e.hostname.c_str(), p.hostname.c_str()) == 0) { dup = true; break; }
    }
    if (!dup) peers_.push_back(std::move(p));
  }
  mdns_query_results_free(results);
  mdns_query_async_delete(search_);
  search_ = nullptr;

  std::lock_guard<std::mutex> lock(mutex_);
  status_ = Status::Done;  // startMs_ stays the scan start — it drives the TTL
}

}  // namespace BrewControl

#endif  // ARDUINO
