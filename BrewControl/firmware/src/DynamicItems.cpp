#include "DynamicItems.h"

using namespace SensActCtrl;

namespace BrewControl {

// ── Sensor ────────────────────────────────────────────────────────────────

DynamicItems::Result DynamicItems::addSensorNoBegin(const JsonObject& cfg,
                                                     Registry& reg) {
  const char* type = cfg["type"] | "";
  const char* id   = cfg["id"]   | "";
  if (!id[0]) return {false, "missing id"};
  if (reg.findSensor(id) || reg.findActuator(id) || reg.findController(id))
    return {false, "id already in use"};

  auto e = std::make_unique<SensorEntry>();
  e->id = id;
  serializeJson(cfg, e->cfgJson);

  if (strcmp(type, "DS18B20") == 0) {
    int pin = cfg["pin"] | -1;
    if (pin < 0) return {false, "missing pin"};
    const char* addrHex = cfg["address"] | "";
    if (addrHex[0]) {
      uint8_t addr[8] = {};
      if (!parseHexAddress(addrHex, addr)) return {false, "invalid address"};
      e->ptr = std::make_unique<DS18B20Sensor>(e->id.c_str(), getOrCreateBus(pin), addr);
    } else {
      e->ptr = std::make_unique<DS18B20Sensor>(e->id.c_str(), pin);
    }
  } else if (strcmp(type, "MAX31865") == 0) {
    int cs = cfg["cs"] | -1;
    if (cs < 0) return {false, "missing cs"};

    int wires = cfg["wires"] | 2;
    if (wires < 2 || wires > 4) return {false, "invalid wires (2/3/4)"};

    const char* rtdStr = cfg["rtd"] | "PT100";
    auto rtd = strcmp(rtdStr, "PT1000") == 0
                   ? MAX31865Sensor::RtdType::PT1000
                   : MAX31865Sensor::RtdType::PT100;

    float defaultRref = (rtd == MAX31865Sensor::RtdType::PT100) ? 430.0f : 4300.0f;
    float rref = cfg["rref"] | defaultRref;
    if (rref <= 0) return {false, "invalid rref"};

    auto wiresEnum = wires == 3 ? MAX31865Sensor::Wires::Three
                   : wires == 4 ? MAX31865Sensor::Wires::Four
                                : MAX31865Sensor::Wires::Two;

    int clk = cfg["clk"] | -1;
    if (clk >= 0) {
      int miso = cfg["miso"] | -1;
      int mosi = cfg["mosi"] | -1;
      if (miso < 0 || mosi < 0) return {false, "clk set but miso/mosi missing"};
      e->ptr = std::make_unique<MAX31865Sensor>(
          e->id.c_str(), cs, clk, miso, mosi, wiresEnum, rtd, rref);
    } else {
      e->ptr = std::make_unique<MAX31865Sensor>(
          e->id.c_str(), cs, wiresEnum, rtd, rref);
    }
  } else if (strcmp(type, "BME280") == 0) {
    uint8_t addr = static_cast<uint8_t>(cfg["address"] | 0x76);
    e->ptr = std::make_unique<BME280Sensor>(e->id.c_str(), addr);
  } else if (strcmp(type, "YF-S201") == 0) {
    int pin = cfg["pin"] | -1;
    if (pin < 0) return {false, "missing pin"};
    float cal = cfg["calibration"] | YF_S201Sensor::kHzPerLiterPerMin;
    if (cal <= 0.0f) return {false, "invalid calibration"};
    auto sensor = std::make_unique<YF_S201Sensor>(e->id.c_str(), pin);
    if (cal != YF_S201Sensor::kHzPerLiterPerMin) sensor->setCalibration(cal);
    YF_S201Sensor* rawPtr = sensor.get();
    e->ptr = std::move(sensor);
    e->resetFn = [rawPtr]() { rawPtr->resetVolume(); };
  } else {
    return {false, "unknown sensor type"};
  }

  reg.add(e->ptr.get());
  sensors_.push_back(std::move(e));
  return {true};
}

DynamicItems::Result DynamicItems::addSensor(const JsonObject& cfg,
                                              Registry& reg) {
  auto r = addSensorNoBegin(cfg, reg);
  if (r.ok && initialized_) sensors_.back()->ptr->begin();
  return r;
}

DynamicItems::Result DynamicItems::resetSensor(const char* id) {
  for (auto& e : sensors_) {
    if (e->id == id) {
      if (!e->resetFn) return {false, "sensor does not support reset"};
      e->resetFn();
      return {true};
    }
  }
  return {false, "sensor not found"};
}

// ── Actuator ──────────────────────────────────────────────────────────────

DynamicItems::Result DynamicItems::addActuatorNoBegin(const JsonObject& cfg,
                                                       Registry& reg) {
  const char* type = cfg["type"] | "";
  const char* id   = cfg["id"]   | "";
  if (!id[0]) return {false, "missing id"};
  if (reg.findSensor(id) || reg.findActuator(id) || reg.findController(id))
    return {false, "id already in use"};

  auto e = std::make_unique<ActuatorEntry>();
  e->id = id;
  serializeJson(cfg, e->cfgJson);

  if (strcmp(type, "DigitalOutput") == 0) {
    int pin = cfg["pin"] | -1;
    if (pin < 0) return {false, "missing pin"};
    const char* modeStr = cfg["mode"] | "Binary";
    auto mode = strcmp(modeStr, "TimeProportional") == 0
                    ? DigitalOutputActuator::Mode::TimeProportional
                    : DigitalOutputActuator::Mode::Binary;
    auto* a = new DigitalOutputActuator(e->id.c_str(), pin, mode);
    if (mode == DigitalOutputActuator::Mode::TimeProportional)
      a->setPeriodMs(cfg["period_ms"] | 2000u);
    e->ptr.reset(a);
  } else {
    return {false, "unknown actuator type"};
  }

  reg.add(e->ptr.get());
  actuators_.push_back(std::move(e));
  return {true};
}

DynamicItems::Result DynamicItems::addActuator(const JsonObject& cfg,
                                                Registry& reg) {
  auto r = addActuatorNoBegin(cfg, reg);
  if (r.ok && initialized_) actuators_.back()->ptr->begin();
  return r;
}

// ── Controller ────────────────────────────────────────────────────────────

DynamicItems::Result DynamicItems::addControllerNoBegin(const JsonObject& cfg,
                                                         Registry& reg) {
  const char* type = cfg["type"] | "";
  const char* id   = cfg["id"]   | "";
  if (!id[0]) return {false, "missing id"};
  if (reg.findSensor(id) || reg.findActuator(id) || reg.findController(id))
    return {false, "id already in use"};

  auto e = std::make_unique<CtrlEntry>();
  e->id = id;
  serializeJson(cfg, e->cfgJson);

  if (strcmp(type, "PID") == 0) {
    const char* sId = cfg["sensor"]   | "";
    const char* aId = cfg["actuator"] | "";
    if (!sId[0]) return {false, "missing sensor"};
    if (!aId[0]) return {false, "missing actuator"};
    auto* s = reg.findSensor(sId);
    auto* a = reg.findActuator(aId);
    if (!s) return {false, "sensor not found"};
    if (!a) return {false, "actuator not found"};

    float minOut = cfg["min"] | 0.0f;
    float maxOut = cfg["max"] | 1.0f;
    auto* ctrl = new PIDController(e->id.c_str(), *s, *a, minOut, maxOut);
    ctrl->setTunings(cfg["Kp"] | 2.0f, cfg["Ki"] | 0.1f, cfg["Kd"] | 0.0f);
    ctrl->setSetpoint(cfg["setpoint"] | 0.0f);

    e->sensorId   = sId;
    e->actuatorId = aId;
    e->ptr.reset(ctrl);
  } else {
    return {false, "unknown controller type"};
  }

  reg.add(e->ptr.get());
  controllers_.push_back(std::move(e));
  return {true};
}

DynamicItems::Result DynamicItems::addController(const JsonObject& cfg,
                                                  Registry& reg) {
  auto r = addControllerNoBegin(cfg, reg);
  if (r.ok && initialized_) controllers_.back()->ptr->begin();
  return r;
}

// ── Remove ────────────────────────────────────────────────────────────────

DynamicItems::Result DynamicItems::removeSensor(const char* id, Registry& reg) {
  for (auto& e : controllers_) {
    if (e->sensorId == id)
      return {false, "sensor is referenced by a controller"};
  }
  for (auto it = sensors_.begin(); it != sensors_.end(); ++it) {
    if ((*it)->id == id) {
      reg.remove((*it)->ptr.get());
      sensors_.erase(it);
      return {true};
    }
  }
  return {false, "not a dynamic item"};
}

DynamicItems::Result DynamicItems::removeActuator(const char* id,
                                                   Registry& reg) {
  for (auto& e : controllers_) {
    if (e->actuatorId == id)
      return {false, "actuator is referenced by a controller"};
  }
  for (auto it = actuators_.begin(); it != actuators_.end(); ++it) {
    if ((*it)->id == id) {
      reg.remove((*it)->ptr.get());
      actuators_.erase(it);
      return {true};
    }
  }
  return {false, "not a dynamic item"};
}

DynamicItems::Result DynamicItems::removeController(const char* id,
                                                     Registry& reg) {
  for (auto it = controllers_.begin(); it != controllers_.end(); ++it) {
    if ((*it)->id == id) {
      reg.remove((*it)->ptr.get());
      controllers_.erase(it);
      return {true};
    }
  }
  return {false, "not a dynamic item"};
}

// ── Persistence ───────────────────────────────────────────────────────────

void DynamicItems::loadFromSD(fs::FS& sd, Registry& reg) {
  File f = sd.open("/config/registry.json");
  if (!f) return;

  JsonDocument doc;
  if (deserializeJson(doc, f) != DeserializationError::Ok) {
    f.close();
    return;
  }
  f.close();

  for (JsonObject cfg : doc["sensors"].as<JsonArray>())
    addSensorNoBegin(cfg, reg);
  for (JsonObject cfg : doc["actuators"].as<JsonArray>())
    addActuatorNoBegin(cfg, reg);
  for (JsonObject cfg : doc["controllers"].as<JsonArray>())
    addControllerNoBegin(cfg, reg);
}

void DynamicItems::saveToSD(fs::FS& sd) const {
  sd.mkdir("/config");
  File f = sd.open("/config/registry.json", FILE_WRITE);
  if (!f) return;

  f.print("{\"sensors\":[");
  for (size_t i = 0; i < sensors_.size(); ++i) {
    if (i) f.print(",");
    f.print(sensors_[i]->cfgJson.c_str());
  }
  f.print("],\"actuators\":[");
  for (size_t i = 0; i < actuators_.size(); ++i) {
    if (i) f.print(",");
    f.print(actuators_[i]->cfgJson.c_str());
  }
  f.print("],\"controllers\":[");
  for (size_t i = 0; i < controllers_.size(); ++i) {
    if (i) f.print(",");
    f.print(controllers_[i]->cfgJson.c_str());
  }
  f.print("]}");
  f.close();
}

// ── Bus helpers ───────────────────────────────────────────────────────────────

OneWire& DynamicItems::getOrCreateBus(int pin) {
  for (auto& e : onewireBuses_)
    if (e.pin == pin) return *e.ow;
  onewireBuses_.push_back({pin, std::make_unique<OneWire>(pin)});
  return *onewireBuses_.back().ow;
}

bool DynamicItems::parseHexAddress(const char* hex, uint8_t out[8]) {
  if (strlen(hex) != 16) return false;
  for (int i = 0; i < 8; ++i) {
    char h[3] = {hex[2 * i], hex[2 * i + 1], 0};
    char* end;
    out[i] = static_cast<uint8_t>(strtol(h, &end, 16));
    if (end != h + 2) return false;
  }
  return true;
}

}  // namespace BrewControl
