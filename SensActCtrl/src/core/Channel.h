#pragma once
#include "Reading.h"
#include "SensorMeta.h"

namespace SensActCtrl {

// One named measurement from a Sensor. key="" means the channel's serialised
// ID equals the sensor's id(). A non-empty key like "rate" causes the
// serialiser to build the composite ID "sensorid.rate".
struct Channel {
  const char* key;
  SensorMeta  meta;
  Reading     reading;
};

}  // namespace SensActCtrl
