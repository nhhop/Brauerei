#pragma once
#include "../core/Sensor.h"
#include "../core/Channel.h"
#include "../core/SensorMeta.h"
#include "../core/Quantity.h"
#include "../core/ValueKind.h"
#include "../core/Reading.h"
#include <stdint.h>

namespace SensActCtrl {

// Non-blocking HX711 24-bit ADC driver (bit-bang, no external library).
// tick() reads only when DOUT is LOW (conversion ready) — no busy-wait.
// tare() stores current raw as offset; setScale() sets g-per-count ratio.
class HX711LoadCellSensor : public Sensor {
public:
    HX711LoadCellSensor(const char* id, int doutPin, int sckPin);

    const char* id()          const override { return id_; }
    size_t      channelCount()const override { return 1; }
    Channel     channel(size_t idx) const override;
    void        begin() override;
    void        tick()  override;

    // Calibration helpers — call before begin() or at runtime.
    void setScale(float gPerCount);   // grams per raw count (default 1.0)
    void setOffset(int32_t offset);   // raw value that maps to 0 g (default 0)

    // Set offset to last captured raw (call after tick() has a valid reading).
    void tare();

    // Public for native tests.
    float rawToMass(int32_t raw) const;

#ifndef ARDUINO
    // Inject a "conversion ready" raw value for testing tick() without hardware.
    void injectRawForTest(int32_t raw);
#endif

private:
    const char* id_;
    int         doutPin_;
    int         sckPin_;

    float   scale_  = 1.0f;
    int32_t offset_ = 0;
    int32_t lastRaw_= 0;

    Reading reading_;

#ifndef ARDUINO
    bool    injected_   = false;
    int32_t injectedRaw_= 0;
#endif

    int32_t readRaw();
};

}  // namespace SensActCtrl
