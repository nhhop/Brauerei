#pragma once

#include <cstddef>
#include <memory>
#include <string>
#include <utility>
#include <vector>

namespace SensActCtrl {
class DacOutput;
class GpioPort;
}

namespace BrewControl {

// Hardware that several items use at once: a OneWire pin carrying several
// DS18B20, SPI lines shared by several MAX31865. Header-only and Arduino-free
// so the lifecycle runs in the native tests; the concrete buses live in
// DynamicItems.cpp.
//
// id() names the instance: the id of its bus definition (BusConfig.h), which
// starts with its type ("onewire-4", "spi-18-19-23"), so two types can never
// collide on one id. A peripheral device (DeviceConfig.h) is a Peripheral
// too, with its device id; it holds a Ref on its bus, so the bus outlives it.
//
// Capabilities are asked for without RTTI: dac(ch) is nullptr unless the
// peripheral offers a DAC channel ch, gpio() unless it offers digital pins.
class Peripheral {
 public:
  virtual ~Peripheral() = default;
  virtual const char* type() const = 0;
  virtual void begin() {}  // on the first user, before it is handed out
  virtual void end() {}    // after the last user is gone, before delete
  virtual SensActCtrl::DacOutput* dac(int /*ch*/) { return nullptr; }
  virtual SensActCtrl::GpioPort* gpio() { return nullptr; }
  const std::string& id() const { return id_; }

 private:
  friend class PeripheralRegistry;
  std::string id_;
};

// Creates a peripheral on its first user and tears it down with its last.
// Users hold a Ref; every live Ref (copies included) counts as one user, so
// dropping the Ref is all an item has to do when it goes away.
//
// Not thread-safe on purpose: in BrewControl all item mutations, and with them
// every acquire and every Ref release, run under the RegistryLock
// (RegistryLock.h). Must outlive every Ref it handed out.
class PeripheralRegistry {
  struct Slot {
    std::unique_ptr<Peripheral> p;
    size_t users = 0;
  };

 public:
  class Ref {
   public:
    Ref() = default;
    Ref(const Ref& o) : reg_(o.reg_), slot_(o.slot_) {
      if (slot_) ++slot_->users;
    }
    Ref(Ref&& o) noexcept : reg_(o.reg_), slot_(o.slot_) { o.slot_ = nullptr; }
    Ref& operator=(Ref o) noexcept {
      std::swap(reg_, o.reg_);
      std::swap(slot_, o.slot_);
      return *this;
    }
    ~Ref() { reset(); }

    void reset() {
      if (slot_) reg_->release(slot_);
      slot_ = nullptr;
    }
    explicit operator bool() const { return slot_ != nullptr; }
    Peripheral* get() const { return slot_ ? slot_->p.get() : nullptr; }
    // The id prefix fixes the type, so the caller knows what it acquired.
    template <typename T>
    T& as() const { return static_cast<T&>(*slot_->p); }

   private:
    friend class PeripheralRegistry;
    Ref(PeripheralRegistry* reg, Slot* slot) : reg_(reg), slot_(slot) { ++slot_->users; }
    PeripheralRegistry* reg_ = nullptr;
    Slot* slot_ = nullptr;
  };

  PeripheralRegistry() = default;
  PeripheralRegistry(const PeripheralRegistry&) = delete;
  PeripheralRegistry& operator=(const PeripheralRegistry&) = delete;

  // The peripheral with this id, created as T(args...) and begun if it does
  // not exist yet.
  template <typename T, typename... Args>
  Ref acquire(const std::string& id, Args&&... args) {
    for (auto& s : slots_)
      if (s->p->id() == id) return Ref(this, s.get());
    auto s = std::make_unique<Slot>();
    s->p = std::make_unique<T>(std::forward<Args>(args)...);
    s->p->id_ = id;
    s->p->begin();
    slots_.push_back(std::move(s));
    return Ref(this, slots_.back().get());
  }

  Peripheral* find(const std::string& id) const {
    for (const auto& s : slots_)
      if (s->p->id() == id) return s->p.get();
    return nullptr;
  }

  // Number of users of id; 0 means it does not exist.
  size_t users(const std::string& id) const {
    for (const auto& s : slots_)
      if (s->p->id() == id) return s->users;
    return 0;
  }

  size_t size() const { return slots_.size(); }

 private:
  void release(Slot* slot) {
    if (--slot->users) return;
    slot->p->end();
    // Out of the vector first, deleted after: a peripheral that holds a Ref
    // on another one (a device on its bus) releases it from its destructor,
    // which must not run while slots_ is in the middle of an erase.
    std::unique_ptr<Slot> dead;
    for (auto it = slots_.begin(); it != slots_.end(); ++it) {
      if (it->get() == slot) {
        dead = std::move(*it);
        slots_.erase(it);
        break;
      }
    }
  }

  std::vector<std::unique_ptr<Slot>> slots_;
};

}  // namespace BrewControl
