#pragma once

#ifdef ARDUINO

#include <memory>
#include <IdsCooker.h>
#include "core/Actuator.h"
#include "core/ActuatorMeta.h"

namespace SensActCtrl {

// Wraps IdsCooker (IDS1/IDS2 induction cooker) as a SensActCtrl Actuator.
// write(0.0-1.0) sets power; tick() drives Update() at <=2 Hz to avoid
// blocking the loop for the ~246 ms sendCommand() call.
// fault() returns the cooker's error string when errorCode != 0, else nullptr.
class IdsActuator : public Actuator {
 public:
  IdsActuator(const char* id, IdsType type,
              uint8_t pinWhite, uint8_t pinYellow, uint8_t pinInterrupt);

  const char*  id()    const override { return id_; }
  ActuatorMeta meta()  const override;

  void        begin() override;
  void        end()   override {}
  void        tick()  override;
  void        write(float v) override;
  float       state() const override { return state_; }
  const char* fault() const override;

 private:
  const char*                id_;
  IdsType                    type_;
  std::unique_ptr<IdsCooker> cooker_;
  int                        power_      = 0;
  float                      state_      = 0.0f;
  unsigned long              nextTickMs_ = 0;
  static constexpr unsigned long kIntervalMs = 500;
};

}  // namespace SensActCtrl

#endif  // ARDUINO
