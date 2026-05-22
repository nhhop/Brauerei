#ifdef ARDUINO

#include "IdsActuator.h"
#include "core/Quantity.h"
#include "core/ValueKind.h"
#include <Arduino.h>

namespace SensActCtrl {

IdsActuator::IdsActuator(const char* id, IdsType type,
                         uint8_t pinWhite, uint8_t pinYellow, uint8_t pinInterrupt)
    : id_(id),
      type_(type),
      cooker_(new IdsCooker(type, pinWhite, pinYellow, pinInterrupt)) {}

ActuatorMeta IdsActuator::meta() const {
  float res = (type_ == IdsType::IDS1) ? 0.1f : 0.2f;
  return ActuatorMeta{ValueKind::Continuous, Quantity::DutyCycle, "", 0.0f, 1.0f, res};
}

void IdsActuator::begin() {
  cooker_->Init();
  nextTickMs_ = millis();
}

void IdsActuator::write(float v) {
  if (v < 0.0f) v = 0.0f;
  if (v > 1.0f) v = 1.0f;
  state_  = v;
  power_  = static_cast<int>(v * 100.0f + 0.5f);
}

void IdsActuator::tick() {
  unsigned long now = millis();
  if (now >= nextTickMs_) {
    cooker_->Update(power_);
    nextTickMs_ = now + kIntervalMs;
  }
}

const char* IdsActuator::fault() const {
  if (cooker_->getErrorCode() == 0) return nullptr;
  return cooker_->getError().c_str();
}

}  // namespace SensActCtrl

#endif  // ARDUINO
