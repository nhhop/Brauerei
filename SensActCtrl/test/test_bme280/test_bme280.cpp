#include <unity.h>
#include "sensors/BME280Sensor.h"
using namespace SensActCtrl;

// Hooks defined by the native stub in BME280Sensor.cpp.
namespace SensActCtrlTest {
extern bool     bme280Present;
extern uint32_t bme280NowMs;
}  // namespace SensActCtrlTest

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

static bool anyValid(const BME280Sensor& s) {
    for (size_t i = 0; i < s.channelCount(); ++i)
        if (s.channel(i).reading.valid) return true;
    return false;
}

void test_present_device_reports_valid() {
    BME280Sensor sensor("amb", 0x76);
    sensor.begin();
    sensor.tick();
    TEST_ASSERT_TRUE(anyValid(sensor));
    TEST_ASSERT_FLOAT_WITHIN(0.01f, 25.0f, sensor.channel(0).reading.value);
}

void test_no_device_readings_stay_invalid() {
    SensActCtrlTest::bme280Present = false;
    BME280Sensor sensor("amb", 0x76);
    sensor.begin();
    sensor.tick();
    TEST_ASSERT_FALSE(anyValid(sensor));
}

void test_device_plugged_in_later_starts_after_retry_interval() {
    SensActCtrlTest::bme280Present = false;
    BME280Sensor sensor("amb", 0x76);
    sensor.begin();
    sensor.tick();
    SensActCtrlTest::bme280Present = true;
    SensActCtrlTest::bme280NowMs += 1000;
    sensor.tick();
    TEST_ASSERT_FALSE(anyValid(sensor));
    SensActCtrlTest::bme280NowMs += 5000;
    sensor.tick();
    TEST_ASSERT_TRUE(anyValid(sensor));
}

void test_device_pulled_makes_readings_invalid_then_recovers() {
    BME280Sensor sensor("amb", 0x76);
    sensor.begin();
    sensor.tick();
    TEST_ASSERT_TRUE(anyValid(sensor));

    SensActCtrlTest::bme280Present = false;
    SensActCtrlTest::bme280NowMs += 100;
    sensor.tick();
    TEST_ASSERT_FALSE(anyValid(sensor));

    SensActCtrlTest::bme280Present = true;
    SensActCtrlTest::bme280NowMs += 10000;
    sensor.tick();
    TEST_ASSERT_TRUE(anyValid(sensor));
}

void setUp() {
    SensActCtrlTest::bme280Present = true;
    SensActCtrlTest::bme280NowMs   = 0;
}
void tearDown() {}

int main(int, char**) {
    UNITY_BEGIN();
    RUN_TEST(test_caller_bus_leaves_it_alone);
    RUN_TEST(test_caller_bus_default_address);
    RUN_TEST(test_present_device_reports_valid);
    RUN_TEST(test_no_device_readings_stay_invalid);
    RUN_TEST(test_device_plugged_in_later_starts_after_retry_interval);
    RUN_TEST(test_device_pulled_makes_readings_invalid_then_recovers);
    return UNITY_END();
}
