// SensActCtrl — Sensor/Actuator/Controller library for ESP32.
// Umbrella header: include this in sketches to pull in the public API.
#pragma once

#include "core/Reading.h"
#include "core/ValueKind.h"
#include "core/Quantity.h"
#include "core/SensorMeta.h"
#include "core/ActuatorMeta.h"
#include "core/Sensor.h"
#include "core/Actuator.h"
#include "core/Controller.h"
#include "core/Registry.h"
#include "core/RegistrySnapshot.h"

#include "controllers/TwoPointController.h"
#include "controllers/PIDController.h"

#include "actuators/DigitalOutputActuator.h"
#include "actuators/PulseOutputActuator.h"

#include "sensors/DigitalInputSensor.h"
#include "sensors/AnalogInputSensor.h"
#include "sensors/PulseCounterSensor.h"
#include "sensors/DS18B20Sensor.h"
#include "sensors/BME280Sensor.h"
#include "sensors/MAX31865Sensor.h"

#include "transport/ITransport.h"
#include "transport/MqttTransport.h"
#include "transport/EspNowTransport.h"
#include "transport/WebhookTransport.h"

#include "remote/RemoteSensor.h"
#include "remote/RemoteActuator.h"
#include "remote/RemotePublisher.h"
