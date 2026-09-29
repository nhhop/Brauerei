#include <unity.h>
#include "sensors/BME280Sensor.h"
using namespace SensActCtrl;

// Same definition as the native shim in BME280Sensor.cpp, so the test can own
// a bus the way BrewControl's PeripheralRegistry does.
class TwoWire { public: TwoWire() {} };

void test_caller_bus_leaves_it_alone() {
    // Heap-allocated and freed after the sensor: BME280Sensor never owns the
    // bus, so the delete below must be the only one.
    TwoWire* bus = new TwoWire();
    {
        BME280Sensor sensor("amb", *bus, 0x77);
        sensor.begin();
        sensor.tick();
        TEST_ASSERT_EQUAL_STRING("amb", sensor.id());
        TEST_ASSERT_EQUAL(3, sensor.channelCount());
    }
    delete bus;
}

void test_caller_bus_default_address() {
    TwoWire bus;
    BME280Sensor sensor("amb", bus);
    TEST_ASSERT_EQUAL(Quantity::Temperature, sensor.channel(0).meta.quantity);
    TEST_ASSERT_EQUAL(Quantity::Humidity, sensor.channel(1).meta.quantity);
    TEST_ASSERT_EQUAL(Quantity::Pressure, sensor.channel(2).meta.quantity);
}

int main(int, char**) {
    UNITY_BEGIN();
    RUN_TEST(test_caller_bus_leaves_it_alone);
    RUN_TEST(test_caller_bus_default_address);
    return UNITY_END();
}
