#pragma once

#include <math.h>
#include <stdint.h>

#include "core/Sensor.h"

// Forward decl to keep TwoWire out of the umbrella header.
class TwoWire;

namespace SensActCtrl {

// Common base of the power-management (charger) ICs found on battery boards
// (SY6970Sensor, AXP2101Sensor): what the battery and the USB input are doing,
// the same first three channels whatever the chip, plus one chip-specific one:
//   channel(0): battery voltage "V"   (key="vbat") -- invalid without a cell
//   channel(1): USB/VBUS voltage "V"  (key="vbus") -- 0 when unplugged
//   channel(2): charging, Binary      (key="charging") -- 1 while the chip
//               pre- or fast-charges, 0 when idle or done
//   channel(3): chip-specific, see extraKey()/extraMeta() (e.g. "soc" in %,
//               "ichg" in A) -- invalid where the chip does not deliver it
//
// The chip is read at most once per kReadIntervalMs (the charger ADCs convert
// about once a second). Without a device all channels stay invalid; a failed
// connect is retried from tick() every kRetryIntervalMs, and a chip that stops
// answering the address probe goes invalid again -- same scheme as ImuSensor.
class PmuSensor : public Sensor {
 public:
  const char* id()                const override { return id_; }
  size_t      channelCount()      const override { return 4; }
  Channel     channel(size_t idx) const override;

  void begin() override;
  void tick()  override;

 protected:
  // One reading of the chip. NaN = not delivered.
  struct Sample {
    float vbatV          = NAN;
    float vbusV          = NAN;
    bool  charging       = false;
    bool  batteryPresent = true;
    float extra          = NAN;  // value of channel(3)
  };

  // bus == nullptr: the default Wire. A caller-owned bus must outlive this
  // sensor.
  PmuSensor(const char* id, TwoWire* bus, uint8_t i2cAddress)
      : id_(id), address_(i2cAddress), bus_(bus) {}

  // Brings the chip up (identify, start its ADC). Called from begin() and
  // then every kRetryIntervalMs until it succeeds.
  virtual bool connectDevice() = 0;
  // false = the read failed (all channels go invalid until the next good one).
  virtual bool readDevice(Sample& s) = 0;
  virtual const char*       extraKey()  const = 0;
  virtual const SensorMeta& extraMeta() const = 0;

  uint8_t  address() const { return address_; }
#if defined(ARDUINO)
  TwoWire& wire() const;  // the caller's bus or the default Wire
#else
  // Native builds have no chip: drivers forward to these, which play back
  // the SensActCtrlTest::pmu* hooks defined in PmuSensor.cpp.
  static bool stubConnect();
  static bool stubRead(Sample& s);
#endif

 private:
  static constexpr uint32_t kRetryIntervalMs = 5000;
  static constexpr uint32_t kReadIntervalMs  = 1000;

  bool connect();
  bool devicePresent() const;
  void invalidate();

  const char* id_;
  uint8_t     address_;
  TwoWire*    bus_;
  bool        begun_       = false;
  bool        initialized_ = false;
  bool        readOnce_    = false;
  uint32_t    nextRetryMs_ = 0;
  uint32_t    lastReadMs_  = 0;

  Reading vbat_{};
  Reading vbus_{};
  Reading charging_{};
  Reading extra_{};
};

}  // namespace SensActCtrl
