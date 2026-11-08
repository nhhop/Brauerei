#pragma once

#include <stddef.h>
#include <functional>
#include <string>
#include <vector>

namespace SensActCtrl {

// Transport abstraction. A concrete transport (MQTT, ESP-Now, webhook, ...)
// moves null-terminated text payloads between SensActCtrl nodes.
//
// Contract:
//   - publish(topic, payload, retained) sends a single message. retained means
//     "broker should hand this to late subscribers"; transports without a
//     retain concept may ignore the flag. Returns false on transport error
//     (e.g. not connected, send buffer full).
//   - subscribe(topic, cb, owner) registers a persistent subscription. The
//     transport is responsible for re-subscribing on reconnect — callers
//     register once and forget. Returns false if the subscription couldn't
//     be queued. `owner` only tags it for unsubscribe().
//   - tick() is called from Registry-adjacent loop code; drives reconnect
//     backoff, polls incoming messages, etc.
//   - connected() reflects link state. RemotePublisher consults it to know
//     when to re-emit retained meta after a reconnect.
class ITransport {
 public:
  using MessageCallback =
      std::function<void(const char* topic, const char* payload, size_t length)>;

  // One entry of a transport's subscriber list.
  struct Subscription {
    std::string topic;
    MessageCallback callback;
    const void* owner;
  };

  virtual ~ITransport() = default;

  virtual bool publish(const char* topic, const char* payload, bool retained) = 0;
  virtual bool subscribe(const char* topic, MessageCallback callback,
                         const void* owner = nullptr) = 0;
  // Removes subscriptions registered via subscribe(): those of `owner` on
  // `topic`, or every one on `topic` when owner is nullptr. Anything whose
  // callback captures `this` must call it before it dies — the next message
  // would otherwise run into freed memory. Pass the owner when another
  // object may listen on the same topic (two proxies of one remote sensor,
  // two fields of one zigbee2mqtt topic). Default no-op for transports that
  // never dispatch. Returns false if no matching subscription existed.
  virtual bool unsubscribe(const char* topic, const void* owner = nullptr) {
    (void)topic; (void)owner;
    return false;
  }
  // Asks the publishers to send their retained messages again, for a
  // subscriber that knows it missed one (RemoteSensor/RemoteActuator: state
  // arrives, meta never did). Only a lossy transport needs it — ESP-NOW
  // broadcasts have no retry, while a broker keeps retained messages and TCP
  // loses none. Default no-op.
  virtual void requestRetained() {}
  virtual void tick() = 0;
  virtual bool connected() const = 0;

  // Human-readable reason for the current disconnected state (empty string
  // when connected or when the transport has nothing more specific to say
  // than connected()==false). Default empty — only transports with a
  // meaningful failure reason (e.g. MqttTransport translating PubSubClient's
  // numeric state) need to override this.
  virtual const char* lastErrorMessage() const { return ""; }

 protected:
  // unsubscribe() for the transports' subscriber lists. `stillUsed` tells a
  // broker-backed transport whether to keep the broker-side subscription.
  static bool eraseSubscriptions(std::vector<Subscription>& subs, const char* topic,
                                 const void* owner, bool* stillUsed = nullptr) {
    bool found = false;
    bool used = false;
    for (auto it = subs.begin(); it != subs.end();) {
      if (it->topic != topic) {
        ++it;
      } else if (owner == nullptr || it->owner == owner) {
        it = subs.erase(it);
        found = true;
      } else {
        used = true;
        ++it;
      }
    }
    if (stillUsed) *stillUsed = used;
    return found;
  }
};

}  // namespace SensActCtrl
