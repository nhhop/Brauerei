#pragma once
#include "../core/Actuator.h"
#include "../core/ActuatorMeta.h"
#include "../core/Quantity.h"
#include "../core/ValueKind.h"
#include <stdint.h>

namespace SensActCtrl {

class AnalogOutputActuator : public Actuator {
public:
    enum class Mode : uint8_t { Pwm, Dac };

    AnalogOutputActuator(const char* id, int pin, Mode mode = Mode::Pwm);

    const char*  id()    const override { return id_; }
    ActuatorMeta meta()  const override;
    void         begin()       override;
    void         end()         override;
    void         tick()        override {}
    void         write(float value) override;
    float        state() const override { return state_; }

    // Ties advertised meta AND value→duty range together. Call before begin().
    // Default: Quantity::DutyCycle, "", 0..1, res 0.01.
    void setRange(Quantity q, const char* unit, float min, float max, float resolution);

    // PWM-only config — call before begin(). Defaults: 5000 Hz / 12 bit.
    void setFrequency(uint32_t hz);
    void setResolutionBits(uint8_t bits);

    // Public for native tests (mirrors AnalogInputSensor::rawToValue).
    uint32_t valueToRaw(float v) const;
    uint32_t rawMax()            const;

private:
    const char* id_;
    int         pin_;
    Mode        mode_;

    uint32_t freq_       = 5000;
    uint8_t  resBits_    = 12;
    uint8_t  channel_    = 0;

    Quantity quantity_   = Quantity::DutyCycle;
    char     unit_[16]   = "";
    float    valueMin_   = 0.0f;
    float    valueMax_   = 1.0f;
    float    resolution_ = 0.01f;

    float    state_      = 0.0f;

    static uint8_t nextChannel_;
};

}  // namespace SensActCtrl
