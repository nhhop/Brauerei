#pragma once

#ifdef ARDUINO

#include <memory>
#include <string>
#include <transport/ITransport.h>
#include <transport/WebhookTransport.h>
#include <vector>

namespace BrewControl {

// Owns WebhookTransport instances for Remote (webhook) sensors/actuators.
// Unlike MqttService, there's no broker/settings to manage — each transport
// is just a local HTTP server + a peer URL, always available, no boot-time
// enable/disable. DynamicItems calls getOrCreate() while wiring up a
// "Remote" item with transport:"webhook"; items that share a (listenPort,
// peerBaseUrl) pair (same remote node) reuse the same transport instead of
// opening a second server on the same port.
class WebhookService {
 public:
  SensActCtrl::ITransport& getOrCreate(uint16_t listenPort, const char* peerBaseUrl);

  // Must be called every loop() iteration — WebhookTransport's WebServer
  // only pumps incoming requests (and drains queued retained-pulls) inside
  // tick(), there's no async/interrupt path like ESPAsyncWebServer.
  void tick();

 private:
  struct Entry {
    uint16_t port;
    std::string peerUrl;
    std::unique_ptr<SensActCtrl::WebhookTransport> transport;
  };
  std::vector<std::unique_ptr<Entry>> transports_;
};

}  // namespace BrewControl

#endif  // ARDUINO
