#include "IntervalActuator.h"

#if defined(ARDUINO)
  #include <Arduino.h>
#else
  static uint32_t g_mockMillis = 0;
  static uint32_t millis() { return g_mockMillis; }
  namespace SensActCtrl {
    void intervalActuatorSetMillisForTest(uint32_t ms) { g_mockMillis = ms; }
  }
#endif

namespace SensActCtrl {

IntervalActuator::IntervalActuator(Actuator& inner, uint32_t onSec, uint32_t periodSec)
    : inner_(inner) {
  setInterval(onSec, periodSec);
}

void IntervalActuator::setInterval(uint32_t onSec, uint32_t periodSec) {
  periodSec_ = periodSec > 0 ? periodSec : 1;
  onSec_ = onSec > periodSec_ ? periodSec_ : onSec;
}

void IntervalActuator::tick() {
  const uint32_t now = millis();
  if (!hasTicked_) {
    cycleStartMs_ = now;
    hasTicked_ = true;
  }

  const uint32_t periodMs = periodSec_ * 1000UL;
  const uint32_t onMs = onSec_ * 1000UL;
  const uint32_t elapsed = (now - cycleStartMs_) % periodMs;
  const bool nowOnPhase = elapsed < onMs;

  if (nowOnPhase != onPhase_) {
    onPhase_ = nowOnPhase;
    inner_.write(onPhase_ ? target_ : inner_.meta().min);
  }

  inner_.tick();
}

void IntervalActuator::setEnabled(bool e) {
  const bool was = inner_.enabled();
  inner_.setEnabled(e);
  if (!e || was || onSec_ == 0) return;
  // Switched back on: restart the cycle so the user gets an immediate
  // on-window instead of waiting out the remainder of an off-window.
  cycleStartMs_ = millis();
  hasTicked_ = true;
  onPhase_ = true;
  inner_.write(target_);
}

void IntervalActuator::write(float v) {
  target_ = v;
  if (onPhase_) inner_.write(v);
}

}  // namespace SensActCtrl
