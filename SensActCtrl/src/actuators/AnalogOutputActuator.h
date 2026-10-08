#pragma once
#include "../core/Actuator.h"
#include "../core/ActuatorMeta.h"
#include "../core/DacOutput.h"
#include "../core/Quantity.h"
#include "../core/ValueKind.h"
#include <stdint.h>

namespace SensActCtrl {

class AnalogOutputActuator : public Actuator {
public:
    enum class Mode : uint8_t { Pwm, Dac };

    AnalogOutputActuator(const char* id, int pin, Mode mode = Mode::Pwm);

    // Drives a channel of an external DAC (e.g. MCP4728) instead of a GPIO.
    // `out` must outlive the actuator. tick() re-sends the output every
    // kRefreshMs: an unplugged chip comes back with its power-on values, and
    // without a write nobody would notice. A failed write() shows up in
    // fault() and clears itself with the next successful one.
    AnalogOutputActuator(const char* id, DacOutput& out);

    static constexpr uint32_t kRefreshMs = 1000;

    const char*  id()    const override { return id_; }
    ActuatorMeta meta()  const override;
    void         begin()       override;
    void         end()         override;
    void         tick()        override;
    void         write(float value) override;
    float        target() const override { return state_; }
    const char*  fault()  const override { return dacFault_ ? "DAC antwortet nicht" : nullptr; }

    // Ties advertised meta AND value→duty range together. Call before begin().
    // Default: Quantity::DutyCycle, "", 0..1, res 0.01.
    void setRange(Quantity q, const char* unit, float min, float max, float resolution);

    // PWM-only config — call before begin(). Defaults: 5000 Hz / 12 bit.
    void setFrequency(uint32_t hz);
    void setResolutionBits(uint8_t bits);

    // Public for native tests (mirrors AnalogInputSensor::rawToValue).
    uint32_t valueToRaw(float v) const;
    uint32_t rawMax()            const;

protected:
    void applyEnabled(bool e) override;

private:
    void applyOutput();

    const char* id_;
    int         pin_;
    Mode        mode_;
    DacOutput*  ext_         = nullptr;  // external DAC channel; pin_/mode_ unused then
    bool        dacFault_    = false;
    uint32_t    lastWriteMs_ = 0;        // last write to ext_, for the refresh

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

#ifndef ARDUINO
// Test hooks: native builds have no real LEDC peripheral to inspect.
uint8_t analogOutputActuatorLedcDetachCallCountForTest();
uint32_t analogOutputActuatorLastRawForTest();
// Native builds have no wall clock — set the value millis() returns.
void analogOutputActuatorSetMillisForTest(uint32_t ms);
#endif

}  // namespace SensActCtrl
