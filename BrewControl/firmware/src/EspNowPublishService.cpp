#include "EspNowPublishService.h"

#ifdef ARDUINO

namespace BrewControl {

using SensActCtrl::Actuator;
using SensActCtrl::Controller;
using SensActCtrl::RemotePublisher;
using SensActCtrl::Sensor;

void EspNowPublishService::begin(SensActCtrl::ITransport& transport, SettingsStore& settings,
                                  const String& fallbackClientId) {
  if (!settings.espnowEnabled()) return;

  transport_ = &transport;
  const String clientId = settings.espnowClientId().isEmpty()
                               ? fallbackClientId
                               : settings.espnowClientId();
  publisher_ = std::make_unique<RemotePublisher>(*transport_, clientId.c_str());
  publisher_->setPrefix(settings.espnowTopicPrefix().c_str());
}

void EspNowPublishService::attachExisting(SensActCtrl::Registry& registry, DynamicItems& items) {
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

void EspNowPublishService::tick() {
  if (publisher_) publisher_->tick();
}

}  // namespace BrewControl

#endif  // ARDUINO
