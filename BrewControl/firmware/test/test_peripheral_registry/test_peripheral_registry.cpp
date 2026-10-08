#include <unity.h>

#include <memory>
#include <string>
#include <vector>

#include "PeripheralRegistry.h"

using namespace BrewControl;

namespace {

// Stands in for a OneWire bus: counts begin()/end() of every instance.
struct Counts {
  int created = 0;
  int begun = 0;
  int ended = 0;
};

class FakeBus : public Peripheral {
 public:
  FakeBus(Counts& c, int pin) : pin(pin), c_(c) { ++c_.created; }
  const char* type() const override { return "onewire"; }
  void begin() override { ++c_.begun; }
  void end() override { ++c_.ended; }
  const int pin;

 private:
  Counts& c_;
};

std::string busId(int pin) { return "onewire:" + std::to_string(pin); }

// An item as DynamicItems keeps it: the entry holds the Ref, so erasing the
// entry releases the bus.
struct Item {
  std::string id;
  PeripheralRegistry::Ref bus;
};
using Items = std::vector<std::unique_ptr<Item>>;

Counts c;
PeripheralRegistry* reg = nullptr;

Item* addDs18b20(Items& items, const std::string& id, int pin) {
  auto e = std::make_unique<Item>();
  e->id = id;
  e->bus = reg->acquire<FakeBus>(busId(pin), c, pin);
  items.push_back(std::move(e));
  return items.back().get();
}

void remove(Items& items, const std::string& id) {
  for (auto it = items.begin(); it != items.end(); ++it) {
    if ((*it)->id == id) {
      items.erase(it);
      return;
    }
  }
}

}  // namespace

void setUp() {
  c = Counts{};
  reg = new PeripheralRegistry();
}
void tearDown() { delete reg; }

void test_two_sensors_share_one_bus() {
  Items items;
  Item* a = addDs18b20(items, "HLT", 4);
  Item* b = addDs18b20(items, "MLT", 4);
  TEST_ASSERT_EQUAL(1, c.created);
  TEST_ASSERT_EQUAL(1, c.begun);
  TEST_ASSERT_EQUAL(1u, reg->size());
  TEST_ASSERT_EQUAL(2u, reg->users(busId(4)));
  TEST_ASSERT_EQUAL_PTR(a->bus.get(), b->bus.get());
  TEST_ASSERT_EQUAL(4, a->bus.as<FakeBus>().pin);
  TEST_ASSERT_EQUAL_STRING("onewire:4", a->bus.get()->id().c_str());
}

void test_removing_first_keeps_bus() {
  Items items;
  addDs18b20(items, "HLT", 4);
  addDs18b20(items, "MLT", 4);
  remove(items, "HLT");
  TEST_ASSERT_EQUAL(0, c.ended);
  TEST_ASSERT_NOT_NULL(reg->find(busId(4)));
  TEST_ASSERT_EQUAL(1u, reg->users(busId(4)));
}

void test_removing_last_tears_bus_down() {
  Items items;
  addDs18b20(items, "HLT", 4);
  addDs18b20(items, "MLT", 4);
  remove(items, "HLT");
  remove(items, "MLT");
  TEST_ASSERT_EQUAL(1, c.ended);
  TEST_ASSERT_NULL(reg->find(busId(4)));
  TEST_ASSERT_EQUAL(0u, reg->users(busId(4)));
  TEST_ASSERT_EQUAL(0u, reg->size());
}

void test_bus_comes_back_after_teardown() {
  Items items;
  addDs18b20(items, "HLT", 4);
  remove(items, "HLT");
  addDs18b20(items, "HLT", 4);
  TEST_ASSERT_EQUAL(2, c.created);
  TEST_ASSERT_EQUAL(2, c.begun);
  TEST_ASSERT_EQUAL(1, c.ended);
  TEST_ASSERT_EQUAL(1u, reg->users(busId(4)));
}

void test_different_pins_are_different_buses() {
  Items items;
  Item* a = addDs18b20(items, "HLT", 4);
  Item* b = addDs18b20(items, "MLT", 5);
  TEST_ASSERT_EQUAL(2u, reg->size());
  TEST_ASSERT_TRUE(a->bus.get() != b->bus.get());
  remove(items, "HLT");
  TEST_ASSERT_NULL(reg->find(busId(4)));
  TEST_ASSERT_NOT_NULL(reg->find(busId(5)));
}

// DynamicItems::replaceSensor holds a copy of the old entry's Ref across the
// remove/add of replaceEntry. A sole user replaced on the same pin keeps the
// very same bus instance, without end()/begin().
void test_replace_on_same_pin_keeps_bus() {
  Items items;
  addDs18b20(items, "HLT", 4);
  Peripheral* before = reg->find(busId(4));
  {
    const PeripheralRegistry::Ref held = items[0]->bus;
    remove(items, "HLT");
    TEST_ASSERT_EQUAL(1u, reg->users(busId(4)));
    addDs18b20(items, "Sud", 4);
  }
  TEST_ASSERT_EQUAL_PTR(before, reg->find(busId(4)));
  TEST_ASSERT_EQUAL(1, c.created);
  TEST_ASSERT_EQUAL(1, c.begun);
  TEST_ASSERT_EQUAL(0, c.ended);
  TEST_ASSERT_EQUAL(1u, reg->users(busId(4)));
}

// The new config fails after it acquired its bus (its temporary entry is
// dropped), then the old item is restored from its config.
void test_failed_replace_and_restore_keeps_bus() {
  Items items;
  addDs18b20(items, "HLT", 4);
  Peripheral* before = reg->find(busId(4));
  {
    const PeripheralRegistry::Ref held = items[0]->bus;
    remove(items, "HLT");
    {
      Item failed;
      failed.bus = reg->acquire<FakeBus>(busId(4), c, 4);
      TEST_ASSERT_EQUAL(2u, reg->users(busId(4)));
    }
    addDs18b20(items, "HLT", 4);  // restore
  }
  TEST_ASSERT_EQUAL_PTR(before, reg->find(busId(4)));
  TEST_ASSERT_EQUAL(1, c.begun);
  TEST_ASSERT_EQUAL(0, c.ended);
  TEST_ASSERT_EQUAL(1u, reg->users(busId(4)));
}

// A replace that moves the sensor to another pin: the old bus goes once the
// held Ref does, the new one stays.
void test_replace_to_other_pin_moves_bus() {
  Items items;
  addDs18b20(items, "HLT", 4);
  {
    const PeripheralRegistry::Ref held = items[0]->bus;
    remove(items, "HLT");
    addDs18b20(items, "HLT", 5);
    TEST_ASSERT_NOT_NULL(reg->find(busId(4)));
  }
  TEST_ASSERT_NULL(reg->find(busId(4)));
  TEST_ASSERT_EQUAL(1u, reg->users(busId(5)));
  TEST_ASSERT_EQUAL(1, c.ended);
}

// Replacing one of two sharing sensors never gets near zero users.
void test_replace_shared_sensor_keeps_bus() {
  Items items;
  addDs18b20(items, "HLT", 4);
  addDs18b20(items, "MLT", 4);
  {
    const PeripheralRegistry::Ref held = items[0]->bus;
    remove(items, "HLT");
    addDs18b20(items, "HLT2", 4);
  }
  TEST_ASSERT_EQUAL(0, c.ended);
  TEST_ASSERT_EQUAL(2u, reg->users(busId(4)));
}

void test_ref_copy_move_and_reset_count() {
  PeripheralRegistry::Ref a = reg->acquire<FakeBus>(busId(4), c, 4);
  PeripheralRegistry::Ref b = a;
  TEST_ASSERT_EQUAL(2u, reg->users(busId(4)));
  PeripheralRegistry::Ref m = std::move(b);
  TEST_ASSERT_FALSE(static_cast<bool>(b));
  TEST_ASSERT_EQUAL(2u, reg->users(busId(4)));
  a = a;  // self-assignment
  TEST_ASSERT_EQUAL(2u, reg->users(busId(4)));
  a = PeripheralRegistry::Ref();
  TEST_ASSERT_EQUAL(1u, reg->users(busId(4)));
  m.reset();
  TEST_ASSERT_NULL(reg->find(busId(4)));
  TEST_ASSERT_EQUAL(1, c.ended);
}

// A device on a bus (Mcp4728Device in DynamicItems.cpp): it holds a Ref on
// its bus, items hold Refs on the device.
class FakeDevice : public Peripheral {
 public:
  FakeDevice(Counts& c, PeripheralRegistry::Ref bus) : bus(std::move(bus)), c_(c) { ++c_.created; }
  ~FakeDevice() override { ++c_.ended; }
  const char* type() const override { return "mcp4728"; }
  PeripheralRegistry::Ref bus;

 private:
  Counts& c_;
};

void test_device_keeps_its_bus_until_last_user_goes() {
  Counts dev;
  PeripheralRegistry::Ref a = reg->acquire<FakeDevice>(
      "mcp4728-onewire:4-60", dev, reg->acquire<FakeBus>(busId(4), c, 4));
  PeripheralRegistry::Ref b = reg->acquire<FakeDevice>(
      "mcp4728-onewire:4-60", dev, reg->acquire<FakeBus>(busId(4), c, 4));
  TEST_ASSERT_EQUAL(1, dev.created);
  TEST_ASSERT_EQUAL(1u, reg->users(busId(4)));  // the device, not its items
  TEST_ASSERT_EQUAL(2u, reg->users("mcp4728-onewire:4-60"));

  a.reset();
  TEST_ASSERT_EQUAL(0, dev.ended);
  TEST_ASSERT_EQUAL(0, c.ended);

  // The device goes, and with it the last user of the bus: a nested release
  // from the device's destructor.
  b.reset();
  TEST_ASSERT_EQUAL(1, dev.ended);
  TEST_ASSERT_EQUAL(1, c.ended);
  TEST_ASSERT_EQUAL(0u, reg->size());
}

void test_bus_used_by_item_survives_device() {
  Items items;
  addDs18b20(items, "HLT", 4);
  {
    Counts dev;
    PeripheralRegistry::Ref d = reg->acquire<FakeDevice>(
        "mcp4728-onewire:4-60", dev, reg->acquire<FakeBus>(busId(4), c, 4));
    TEST_ASSERT_EQUAL(2u, reg->users(busId(4)));
  }
  TEST_ASSERT_EQUAL(0, c.ended);
  TEST_ASSERT_EQUAL(1u, reg->users(busId(4)));
  TEST_ASSERT_EQUAL(1u, reg->size());
}

void test_dac_is_null_by_default() {
  PeripheralRegistry::Ref a = reg->acquire<FakeBus>(busId(4), c, 4);
  TEST_ASSERT_NULL(a.get()->dac(0));
}

int main(int, char**) {
  UNITY_BEGIN();
  RUN_TEST(test_two_sensors_share_one_bus);
  RUN_TEST(test_removing_first_keeps_bus);
  RUN_TEST(test_removing_last_tears_bus_down);
  RUN_TEST(test_bus_comes_back_after_teardown);
  RUN_TEST(test_different_pins_are_different_buses);
  RUN_TEST(test_replace_on_same_pin_keeps_bus);
  RUN_TEST(test_failed_replace_and_restore_keeps_bus);
  RUN_TEST(test_replace_to_other_pin_moves_bus);
  RUN_TEST(test_replace_shared_sensor_keeps_bus);
  RUN_TEST(test_ref_copy_move_and_reset_count);
  RUN_TEST(test_device_keeps_its_bus_until_last_user_goes);
  RUN_TEST(test_bus_used_by_item_survives_device);
  RUN_TEST(test_dac_is_null_by_default);
  return UNITY_END();
}
