#pragma once

#include <stdint.h>
#include <atomic>
#include <map>
#include <mutex>
#include <string>
#include <utility>
#include <vector>

#include "transport/EspNowPeerTable.h"
#include "transport/ITransport.h"

namespace SensActCtrl {

// ESP-Now transport. Connection-less 2.4 GHz broadcast — no broker, no
// WiFi association needed. Same wire format as MqttTransport (topic strings
// + JSON payloads) so payloads can be inspected uniformly across both
// transports.
//
// Wire framing (one ESP-Now packet, max 250 B total):
//   Data:             [0x01][u8 topic_len][topic chars][payload chars]
//   Retained-Request: [0x02]
//
// Retain emulation: publish(topic, payload, retained=true) caches the
// payload locally. On subscribe() (throttled to once per ~1 s across all
// subscriptions) the transport broadcasts a Retained-Request, prompting
// other nodes to re-broadcast their cached retained payloads. This gives
// late subscribers a quick path to the current meta + state without
// waiting for the next periodic publish. A subscribe() that lands inside
// the throttle window is not dropped — it's deferred and sent from tick()
// once the window elapses, so a burst of subscribe() calls (e.g. at boot)
// never permanently loses a subscriber's chance at retained data.
//
// Peer model: broadcast (FF:FF:FF:FF:FF:FF) for everything retained — meta,
// state, Retained-Requests — so any number of consumers on the same WiFi
// channel keeps seeing it. Non-retained publishes (commands such as an
// actuator's /set) go unicast when the target is known: the transport learns
// the sender MAC of every packet on a subscribed topic and addresses a
// command to whoever published its parent topic (see EspNowPeerTable).
// Unicast gets ESP-Now's link-level ACK + retries; a failed delivery shows
// up in lastErrorMessage(). Unknown target → broadcast, as before. The wire
// format is identical either way, so receivers need no changes.
class EspNowTransport : public ITransport {
 public:
  // channel: WiFi channel 1..13. Must match across all peers.
  explicit EspNowTransport(uint8_t channel = 1);
  ~EspNowTransport() override;

  bool publish(const char* topic, const char* payload, bool retained) override;
  bool subscribe(const char* topic, MessageCallback callback) override;
  void tick() override;
  bool connected() const override { return initialized_; }
  // Covers both init failure (connected() == false) and the last send-level
  // failure while initialized (e.g. a packet silently dropped for exceeding
  // the 250-byte ESP-NOW limit) — the latter doesn't affect connected(), but
  // is otherwise invisible to callers. Empty once a send succeeds again.
  const char* lastErrorMessage() const override;

  // Called from the static ESP-Now receive / send callbacks. Public so the
  // static bridges can reach them; not part of the user-facing API.
  void dispatchIncoming(const uint8_t* mac, const uint8_t* data, int length);
  void onSendStatus(const uint8_t* mac, bool delivered);

 private:
  bool initEspNow_();
  bool sendRaw_(const uint8_t* data, size_t len, const uint8_t* dest);
  bool sendDataPacket_(const char* topic, const char* payload,
                       const uint8_t* dest);
  // Registers `mac` as ESP-Now peer if needed (evicting the LRU one).
  // Returns false if the peer couldn't be added — caller falls back to broadcast.
  bool ensurePeer_(const EspNowPeerTable::Mac& mac);
  void sendRetainedRequest_();
  void handleRetainedRequest_();
  // Broadcasts a Retained-Request if the throttle window has elapsed,
  // otherwise marks one as pending so tick() sends it once it has.
  void requestRetained_();

  static constexpr uint32_t kRetainedRequestThrottleMs = 1000;

  uint8_t channel_;
  bool initialized_ = false;
  uint32_t lastRetainedRequestMs_ = 0;
  bool retainedRequestPending_ = false;
  std::vector<std::pair<std::string, MessageCallback>> subs_;
  std::map<std::string, std::string> retained_;
  std::string lastErrorMsg_;

  uint8_t peerChannel_ = 0;  // 0 = ride the STA channel
  std::mutex peersMutex_;    // learn() runs on the WiFi task, publish() on loop
  EspNowPeerTable peers_;
  // Latest unicast delivery report from the send callback (WiFi task):
  // 0 = none, else kDelivered/kFailed flag | 48-bit MAC. Folded into
  // deliveryErrorMsg_ by tick().
  static constexpr uint64_t kDelivered = 1ULL << 62;
  static constexpr uint64_t kFailed = 1ULL << 63;
  std::atomic<uint64_t> deliveryReport_{0};
  // Kept apart from lastErrorMsg_ (cleared by every successful send, which
  // periodic broadcasts would do within a second) — only a later successful
  // unicast delivery clears it.
  std::string deliveryErrorMsg_;
};

}  // namespace SensActCtrl
