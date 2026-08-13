#include "EnableGuardActuator.h"

namespace SensActCtrl {

void EnableGuardActuator::write(float v) {
  target_ = v;
  inner_.write(enabled_ ? v : inner_.meta().min);
}

void EnableGuardActuator::setEnabled(bool e) {
  if (e == enabled_) return;
  enabled_ = e;
  inner_.write(enabled_ ? target_ : inner_.meta().min);
}

}  // namespace SensActCtrl
