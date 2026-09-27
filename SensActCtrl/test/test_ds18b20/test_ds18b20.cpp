#include <unity.h>
#include "sensors/DS18B20Sensor.h"
using namespace SensActCtrl;

// Same definition as the native shim in DS18B20Sensor.cpp, so the test can own
// a bus the way BrewControl's PeripheralRegistry does.
class OneWire { public: OneWire() {} explicit OneWire(int) {} };

// ── Caller-owned bus ─────────────────────────────────────────────────────────

void test_sensors_on_caller_bus_leave_it_alone() {
    // Heap-allocated: a sensor that wrongly owned the bus would delete it and
    // the delete below would be a double free.
    OneWire* bus = new OneWire(4);
    const uint8_t addr[8] = {0x28, 0xff, 0x19, 0xc6, 0xa1, 0x16, 0x05, 0xd3};
    {
        DS18B20Sensor first("HLT", *bus);
        DS18B20Sensor second("MLT", *bus, addr);
        first.begin();
        second.begin();
        first.tick();
        second.tick();
        TEST_ASSERT_EQUAL_STRING("HLT", first.id());
        TEST_ASSERT_EQUAL_UINT32(750, first.conversionTimeMs());
    }
    delete bus;
}

void test_caller_bus_resolution_sets_conversion_time() {
    OneWire bus(4);
    DS18B20Sensor s("HLT", bus, /*resolutionBits=*/10);
    TEST_ASSERT_EQUAL_UINT32(188, s.conversionTimeMs());
    TEST_ASSERT_EQUAL(Quantity::Temperature, s.channel(0).meta.quantity);
}

int main(int, char**) {
    UNITY_BEGIN();
    RUN_TEST(test_sensors_on_caller_bus_leave_it_alone);
    RUN_TEST(test_caller_bus_resolution_sets_conversion_time);
    return UNITY_END();
}
