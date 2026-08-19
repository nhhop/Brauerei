#pragma once

#include <stddef.h>
#include <functional>

namespace SensActCtrl {

// Transport abstraction. A concrete transport (MQTT, ESP-Now, webhook, ...)
// moves null-terminated text payloads between SensActCtrl nodes.
//
// Contract:
//   - publish(topic, payload, retained) sends a single message. retained means
//     "broker should hand this to late subscribers"; transports without a
//     retain concept may ignore the flag. Returns false on transport error
//     (e.g. not connected, send buffer full).
//   - subscribe(topic, cb) registers a persistent subscription. The transport
//     is responsible for re-subscribing on reconnect — callers register once
//     and forget. Returns false if the subscription couldn't be queued.
//   - tick() is called from Registry-adjacent loop code; drives reconnect
//     backoff, polls incoming messages, etc.
//   - connected() reflects link state. RemotePublisher consults it to know
//     when to re-emit retained meta after a reconnect.
class ITransport {
 public:
  using MessageCallback =
      std::function<void(const char* topic, const char* payload, size_t length)>;

  virtual ~ITransport() = default;

  virtual bool publish(const char* topic, const char* payload, bool retained) = 0;
  virtual bool subscribe(const char* topic, MessageCallback callback) = 0;
  // Removes a subscription registered via subscribe(). Default no-op — not
  // all transports need it; RemotePublisher::detach() calls it to drop stale
  // callbacks (e.g. one capturing a since-deleted Actuator*) before they can
  // fire again. Returns false if no matching subscription existed.
  virtual bool unsubscribe(const char* topic) { (void)topic; return false; }
  virtual void tick() = 0;
  virtual bool connected() const = 0;
};

}  // namespace SensActCtrl
