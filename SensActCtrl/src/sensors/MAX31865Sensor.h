#pragma once

#include <stdint.h>
#include "core/Sensor.h"

// Forward decl — keeps Adafruit_MAX31865.h out of the umbrella include
// for sketches that don't use this sensor.
class Adafruit_MAX31865;

namespace SensActCtrl {

// MAX31865 SPI RTD interface for PT100 or PT1000 probes.
//
// Reads synchronously in tick() (~1 ms SPI transaction). No state machine
// needed (unlike DS18B20 which has a 750 ms async conversion window).
//
// Hardware-SPI: pass only csPin; CLK/MISO/MOSI use ESP32 VSPI defaults.
// Software-SPI: pass all four pins.
//
// Native (non-Arduino) builds: begin() and tick() are no-ops;
// channel(0).reading returns {0, 0, false}. No hardware test possible without real chip.
class MAX31865Sensor : public Sensor {
 public:
  enum class Wires   : uint8_t { Two = 2, Three = 3, Four = 4 };
  enum class RtdType : uint8_t { PT100, PT1000 };

  // Hardware-SPI constructor
  MAX31865Sensor(const char* id, int csPin,
                 Wires wires, RtdType rtd, float rref);

  // Software-SPI constructor
  MAX31865Sensor(const char* id, int csPin, int clkPin, int misoPin, int mosiPin,
                 Wires wires, RtdType rtd, float rref);

  ~MAX31865Sensor() override;

  const char* id()            const override { return id_; }
  size_t  channelCount()      const override { return 1; }
  Channel channel(size_t)     const override;
  void        begin()         override;
  void        tick()          override;

 private:
  const char*      id_;
  int              csPin_;
  int              clkPin_  = -1;
  int              misoPin_ = -1;
  int              mosiPin_ = -1;
  Wires            wires_;
  RtdType          rtd_;
  float            rref_;
  Adafruit_MAX31865* max_ = nullptr;
  Reading          last_{};
};

}  // namespace SensActCtrl
