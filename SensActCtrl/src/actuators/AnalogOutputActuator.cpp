#include "AnalogOutputActuator.h"
#include <string.h>

#if defined(ARDUINO)
  #include <Arduino.h>
  #include <soc/soc_caps.h>
  // dacWrite needs an on-chip DAC: ESP32 (GPIO 25/26) and ESP32-S2 (GPIO 17/18).
  // ESP32-S3 has none.
  #if defined(SOC_DAC_SUPPORTED)
    #define SENSACTCTRL_HAS_DAC 1
  #endif
#else
  #include <stdint.h>
  // Native test stubs — Arduino ESP32 Core 2.x signatures.
  static double ledcSetup(uint8_t, double, uint8_t) { return 0.0; }
  static void   ledcAttachPin(uint8_t, uint8_t) {}
  static uint8_t ledcDetachPinCallCount_ = 0;
  static void   ledcDetachPin(uint8_t)          { ++ledcDetachPinCallCount_; }
  static uint32_t lastRawWritten_ = 0;
  static void   ledcWrite(uint8_t, uint32_t raw) { lastRawWritten_ = raw; }
  static void   dacWrite(uint8_t, uint8_t raw)   { lastRawWritten_ = raw; }
  static uint32_t mockMillis_ = 0;
  static uint32_t millis() { return mockMillis_; }
  #define SENSACTCTRL_HAS_DAC 1  // stubs cover it in native builds
#endif

namespace SensActCtrl {

uint8_t AnalogOutputActuator::nextChannel_ = 0;

AnalogOutputActuator::AnalogOutputActuator(const char* id, int pin, Mode mode)
    : id_(id), pin_(pin), mode_(mode) {}

AnalogOutputActuator::AnalogOutputActuator(const char* id, DacOutput& out)
    : id_(id), pin_(-1), mode_(Mode::Dac), ext_(&out) {}

void AnalogOutputActuator::setRange(Quantity q, const char* unit,
                                     float min, float max, float resolution) {
    quantity_   = q;
    strncpy(unit_, unit ? unit : "", 15);
    unit_[15]   = '\0';
    valueMin_   = min;
    valueMax_   = max;
    resolution_ = resolution;
}

void AnalogOutputActuator::setFrequency(uint32_t hz)  { freq_    = hz;   }
void AnalogOutputActuator::setResolutionBits(uint8_t b){ resBits_ = b;    }

ActuatorMeta AnalogOutputActuator::meta() const {
    return ActuatorMeta{ValueKind::Continuous, quantity_, unit_,
                        valueMin_, valueMax_, resolution_};
}

uint32_t AnalogOutputActuator::rawMax() const {
    if (ext_) return ext_->rawMax();
    return (mode_ == Mode::Dac) ? 255u : ((1u << resBits_) - 1u);
}

uint32_t AnalogOutputActuator::valueToRaw(float v) const {
    if (v < valueMin_) v = valueMin_;
    if (v > valueMax_) v = valueMax_;
    const float span = valueMax_ - valueMin_;
    if (span <= 0.0f) return 0;
    const float t = (v - valueMin_) / span;
    return static_cast<uint32_t>(t * static_cast<float>(rawMax()));
}

void AnalogOutputActuator::write(float value) {
    if (value < valueMin_) value = valueMin_;
    if (value > valueMax_) value = valueMax_;
    state_ = value;
    applyOutput();
}

void AnalogOutputActuator::applyEnabled(bool /*e*/) {
    applyOutput();
}

void AnalogOutputActuator::applyOutput() {
    // Single choke point: while disabled the peripheral is driven to the
    // range minimum, but state_ keeps the commanded value for the re-enable.
    const uint32_t raw = valueToRaw(enabled_ ? state_ : valueMin_);
    if (ext_) {
        dacFault_ = !ext_->write(static_cast<uint16_t>(raw));
        lastWriteMs_ = millis();
        return;
    }
    if (mode_ == Mode::Dac) {
#if defined(SENSACTCTRL_HAS_DAC)
        dacWrite(static_cast<uint8_t>(pin_), static_cast<uint8_t>(raw));
#else
        ledcWrite(channel_, raw);
#endif
    } else {
        ledcWrite(channel_, raw);
    }
}

void AnalogOutputActuator::tick() {
    if (ext_ && millis() - lastWriteMs_ >= kRefreshMs) applyOutput();
}

void AnalogOutputActuator::begin() {
    if (ext_) {
        write(valueMin_);
        return;
    }
#if !defined(SENSACTCTRL_HAS_DAC)
    if (mode_ == Mode::Dac) mode_ = Mode::Pwm;
#endif
    if (mode_ == Mode::Pwm) {
        channel_ = nextChannel_++;
        ledcSetup(channel_, static_cast<double>(freq_), resBits_);
        ledcAttachPin(static_cast<uint8_t>(pin_), channel_);
    }
    write(valueMin_);
}

void AnalogOutputActuator::end() {
    write(valueMin_);
    if (ext_) return;
    // Dac mode drives the pin via the DAC peripheral directly (no GPIO
    // matrix routing), so there's nothing to detach there.
    if (mode_ == Mode::Pwm) {
        ledcDetachPin(static_cast<uint8_t>(pin_));
    }
}

#ifndef ARDUINO
uint8_t analogOutputActuatorLedcDetachCallCountForTest() {
    return ledcDetachPinCallCount_;
}

uint32_t analogOutputActuatorLastRawForTest() {
    return lastRawWritten_;
}

void analogOutputActuatorSetMillisForTest(uint32_t ms) {
    mockMillis_ = ms;
}
#endif

}  // namespace SensActCtrl
