#include "WebhookService.h"

#ifdef ARDUINO

namespace BrewControl {

SensActCtrl::ITransport& WebhookService::getOrCreate(uint16_t listenPort,
                                                     const char* peerBaseUrl) {
  const std::string peer = peerBaseUrl ? peerBaseUrl : "";
  for (auto& e : transports_) {
    if (e->port == listenPort && e->peerUrl == peer) return *e->transport;
  }
  auto e = std::make_unique<Entry>();
  e->port = listenPort;
  e->peerUrl = peer;
  e->transport = std::make_unique<SensActCtrl::WebhookTransport>(listenPort, peerBaseUrl);
  auto& ref = *e->transport;
  transports_.push_back(std::move(e));
  return ref;
}

void WebhookService::tick() {
  for (auto& e : transports_) e->transport->tick();
}

}  // namespace BrewControl

#endif  // ARDUINO
