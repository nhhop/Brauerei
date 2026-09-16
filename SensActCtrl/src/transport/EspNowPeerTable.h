#pragma once

#include <stddef.h>
#include <stdint.h>
#include <array>
#include <cstring>
#include <map>
#include <string>
#include <vector>

namespace SensActCtrl {

// Bookkeeping behind EspNowTransport's unicast path. Pure (no ESP-IDF calls)
// so it's unit-testable natively; the transport serializes access.
//
// learn(): remembers which MAC last sent a packet on a topic.
// macForPublish(): a command topic is answered by whoever publishes its
//   parent topic — ".../actuator/pump/set" goes to the sender of
//   ".../actuator/pump" (the state a RemoteActuator already subscribes to).
// usePeer(): LRU of registered ESP-Now unicast peers. ESP-Now caps the peer
//   list (20 incl. the broadcast peer), so the least recently used one is
//   evicted once `capacity` is exceeded.
class EspNowPeerTable {
 public:
  using Mac = std::array<uint8_t, 6>;

  struct PeerUse {
    bool isNew = false;    // caller must esp_now_add_peer()
    bool evict = false;    // caller must esp_now_del_peer(evicted)
    Mac evicted{};
  };

  explicit EspNowPeerTable(size_t capacity = 16) : capacity_(capacity) {}

  void learn(const std::string& topic, const uint8_t* mac) {
    Mac m;
    std::memcpy(m.data(), mac, 6);
    senders_[topic] = m;
  }

  bool macForPublish(const std::string& topic, Mac& out) const {
    const size_t slash = topic.rfind('/');
    if (slash == std::string::npos || slash == 0) return false;
    auto it = senders_.find(topic.substr(0, slash));
    if (it == senders_.end()) return false;
    out = it->second;
    return true;
  }

  PeerUse usePeer(const Mac& mac) {
    PeerUse r;
    for (auto it = peers_.begin(); it != peers_.end(); ++it) {
      if (*it == mac) {
        peers_.erase(it);
        peers_.push_back(mac);
        return r;
      }
    }
    r.isNew = true;
    peers_.push_back(mac);
    if (peers_.size() > capacity_) {
      r.evict = true;
      r.evicted = peers_.front();
      peers_.erase(peers_.begin());
    }
    return r;
  }

  // Drops a peer the caller failed to register, so it's retried next time.
  void forgetPeer(const Mac& mac) {
    for (auto it = peers_.begin(); it != peers_.end(); ++it) {
      if (*it == mac) {
        peers_.erase(it);
        return;
      }
    }
  }

  size_t peerCount() const { return peers_.size(); }

 private:
  size_t capacity_;
  std::map<std::string, Mac> senders_;
  std::vector<Mac> peers_;  // front = least recently used
};

}  // namespace SensActCtrl
