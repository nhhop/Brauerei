#include "WebhookService.h"

#ifdef ARDUINO

namespace BrewControl {

using SensActCtrl::Actuator;
using SensActCtrl::Controller;
using SensActCtrl::RemotePublisher;
using SensActCtrl::Sensor;

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
  if (publisher_) publisher_->tick();
}

void WebhookService::beginPublish(SettingsStore& settings, const String& fallbackClientId) {
  if (!settings.webhookEnabled()) return;

  publishTransport_ = &getOrCreate(settings.webhookListenPort(), settings.webhookPeerUrl().c_str());

  const String clientId = settings.webhookClientId().isEmpty()
                               ? fallbackClientId
                               : settings.webhookClientId();
  publisher_ = std::make_unique<RemotePublisher>(*publishTransport_, clientId.c_str());
  publisher_->setPrefix(settings.webhookTopicPrefix().c_str());
}

void WebhookService::attachExistingPublish(SensActCtrl::Registry& registry, DynamicItems& items) {
  if (!publisher_) return;

  // Boot snapshot: attach whatever the registry holds right now.
  for (auto* s : registry.sensors())     publisher_->attach(*s);
  for (auto* a : registry.actuators())   publisher_->attach(*a);
  for (auto* c : registry.controllers()) publisher_->attach(*c);
  publisher_->begin();

  // Live tracking: mirror future add/remove via DynamicItems.
  items.setOnSensorAdded([this](Sensor& s) {
    if (publisher_) { publisher_->attach(s); publisher_->begin(); }
  });
  items.setOnSensorRemoving([this](Sensor& s) {
    if (publisher_) publisher_->detach(s);
  });
  items.setOnActuatorAdded([this](Actuator& a) {
    if (publisher_) { publisher_->attach(a); publisher_->begin(); }
  });
  items.setOnActuatorRemoving([this](Actuator& a) {
    if (publisher_) publisher_->detach(a);
  });
  items.setOnControllerAdded([this](Controller& c) {
    if (publisher_) { publisher_->attach(c); publisher_->begin(); }
  });
  items.setOnControllerRemoving([this](Controller& c) {
    if (publisher_) publisher_->detach(c);
  });
}

}  // namespace BrewControl

#endif  // ARDUINO
