#include "AnalogOutputActuator.h"
#include <string.h>

#if defined(ARDUINO)
  #include <Arduino.h>
  // dacWrite is only available on the original ESP32 (GPIO 25/26 DAC).
  // ESP32-S2 and ESP32-S3 have no DAC peripheral.
  #if defined(CONFIG_IDF_TARGET_ESP32)
    #define SENSACTCTRL_HAS_DAC 1
  #endif
#else
  #include <stdint.h>
  // Native test stubs — Arduino ESP32 Core 2.x signatures.
  static double ledcSetup(uint8_t, double, uint8_t) { return 0.0; }
  static void   ledcAttachPin(uint8_t, uint8_t) {}
  static void   ledcWrite(uint8_t, uint32_t)    {}
  static void   dacWrite(uint8_t, uint8_t)      {}
  #define SENSACTCTRL_HAS_DAC 1  // stubs cover it in native builds
#endif

namespace SensActCtrl {

uint8_t AnalogOutputActuator::nextChannel_ = 0;

AnalogOutputActuator::AnalogOutputActuator(const char* id, int pin, Mode mode)
    : id_(id), pin_(pin), mode_(mode) {}

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
    const uint32_t raw = valueToRaw(value);
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

void AnalogOutputActuator::begin() {
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
}

}  // namespace SensActCtrl
