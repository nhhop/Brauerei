#include "DynamicItems.h"

#include <OneWire.h>
#include <Wire.h>

#include <algorithm>

#include "BoardPins.h"
#include "SdLock.h"
#include "SensorChannels.h"
#include "WebhookService.h"

using namespace SensActCtrl;

namespace BrewControl {

// ── Buses (PeripheralRegistry) ────────────────────────────────────────────

namespace {

// One OneWire driver per bus, shared by every DS18B20 on it.
class OneWireBus : public Peripheral {
 public:
  explicit OneWireBus(int pin) : ow(pin) {}
  const char* type() const override { return "onewire"; }
  OneWire ow;
};

// SCK/MISO/MOSI shared by MAX31865 in software-SPI mode. Only bookkeeping so
// far: each MAX31865 still drives the lines itself, from these pins.
class SpiBus : public Peripheral {
 public:
  SpiBus(int clk, int miso, int mosi) : clk(clk), miso(miso), mosi(mosi) {}
  const char* type() const override { return "spi"; }
  const int clk, miso, mosi;
};

// One of the chip's two I2C controllers (Wire or Wire1) on the bus's pins.
class I2cBus : public Peripheral {
 public:
  // keepRunning: a fixed bus also carries onboard devices (LilyGo: the
  // display's touch), so losing its last item must not stop the controller.
  I2cBus(TwoWire& wire, int sda, int scl, bool keepRunning)
      : wire(wire), keepRunning_(keepRunning) {
    wire.begin(sda, scl);
    // Without pull-ups/a device, a transaction to a missing address would
    // otherwise block far longer than this per probed address.
    wire.setTimeOut(50);
  }
  const char* type() const override { return "i2c"; }
  void end() override {
    if (!keepRunning_) wire.end();
  }
  TwoWire& wire;

 private:
  const bool keepRunning_;
};

}  // namespace

DynamicItems::DynamicItems() : buses_(currentFixedBuses()) {}

// ── Buses ─────────────────────────────────────────────────────────────────

PeripheralRegistry::Ref DynamicItems::acquireBus(const BusDef& d) {
  const char* t = d.type->type;
  if (strcmp(t, "onewire") == 0) return peripherals_.acquire<OneWireBus>(d.id, d.pins[0]);
  if (strcmp(t, "spi") == 0)
    return peripherals_.acquire<SpiBus>(d.id, d.pins[0], d.pins[1], d.pins[2]);
  TwoWire& wire = d.port == 1 ? Wire1 : Wire;
  return peripherals_.acquire<I2cBus>(d.id, wire, d.pins[0], d.pins[1], d.fixed);
}

const BusDef* DynamicItems::findBus(const char* id) const {
  return findBusDef(buses_, id);
}

std::vector<std::string> DynamicItems::busUsers(const std::string& id) const {
  std::vector<std::string> out;
  for (const auto& e : sensors_) {
    JsonDocument doc;
    if (deserializeJson(doc, e->cfgJson) == DeserializationError::Ok &&
        id == (doc["bus"] | ""))
      out.push_back(e->id);
  }
  return out;
}

DynamicItems::Result DynamicItems::busFail(const std::string& msg, bool conflict) {
  busError_ = msg;
  return {false, busError_.c_str(), conflict};
}

namespace {
std::string joined(const std::vector<std::string>& v) {
  std::string s;
  for (const auto& x : v) s += (s.empty() ? "" : ", ") + x;
  return s;
}
}  // namespace

DynamicItems::Result DynamicItems::addBus(const JsonObject& def, std::string& newId) {
  BusDef d;
  std::string err;
  if (!parseBusDef(def, d, err)) return busFail(err, false);
  if (findBus(d.id.c_str())) return busFail("bus " + d.id + " already exists", true);
  if (d.type->max && busesOfType(buses_, d.type->type) >= d.type->max)
    return busFail("no free " + std::string(d.type->type) + " controller (" +
                       std::to_string(d.type->max) + " in use)", true);
  std::vector<PinUse> mine;
  busPinUses(d, mine);
  const PinCheck c = checkPinUses(currentBoard(), pinUses(), mine);
  if (!c.ok) return busFail(c.error, c.status == 409);
  d.port = strcmp(d.type->type, "i2c") == 0 ? freeI2cPort(buses_) : -1;
  newId = d.id;
  buses_.push_back(d);
  return {true};
}

DynamicItems::Result DynamicItems::updateBus(const char* id, const JsonObject& def,
                                             std::string& newId) {
  BusDef* old = nullptr;
  for (BusDef& b : buses_) if (b.id == id) old = &b;
  if (!old) return busFail("bus not found", false);
  if (old->fixed) return busFail("bus " + old->id + " is wired by the board", true);
  BusDef d;
  std::string err;
  if (!parseBusDef(def, d, err)) return busFail(err, false);
  if (d.type != old->type) return busFail("bus type cannot change", false);
  if (d.id != old->id) {
    const std::vector<std::string> users = busUsers(old->id);
    if (!users.empty()) return busFail("bus " + old->id + " is used by " + joined(users), true);
    if (findBus(d.id.c_str())) return busFail("bus " + d.id + " already exists", true);
    std::vector<PinUse> mine;
    busPinUses(d, mine);
    const PinCheck c = checkPinUses(currentBoard(), pinUses(), mine, old->id.c_str());
    if (!c.ok) return busFail(c.error, c.status == 409);
  }
  d.port = old->port;
  *old = d;
  newId = d.id;
  return {true};
}

DynamicItems::Result DynamicItems::removeBus(const char* id) {
  for (auto it = buses_.begin(); it != buses_.end(); ++it) {
    if (it->id != id) continue;
    if (it->fixed) return busFail("bus " + it->id + " is wired by the board", true);
    const std::vector<std::string> users = busUsers(it->id);
    if (!users.empty()) return busFail("bus " + it->id + " is used by " + joined(users), true);
    buses_.erase(it);
    return {true};
  }
  return busFail("bus not found", false);
}

void DynamicItems::writeBuses(JsonObject out) const {
  JsonArray arr = out["buses"].to<JsonArray>();
  for (const BusDef& d : buses_) {
    JsonObject o = arr.add<JsonObject>();
    writeBusDef(d, o);
    if (d.fixed) {
      o["fixed"] = true;
      o["note"] = d.note;
      JsonArray res = o["reserved"].to<JsonArray>();
      for (size_t i = 0; i < d.reservedCount; ++i) {
        char hex[6];
        snprintf(hex, sizeof(hex), "0x%02x", d.reserved[i].addr);
        JsonObject r = res.add<JsonObject>();
        r["address"] = hex;
        r["note"] = d.reserved[i].note;
      }
    }
    JsonArray users = o["users"].to<JsonArray>();
    for (const std::string& u : busUsers(d.id)) users.add(u);
  }
  JsonArray types = out["types"].to<JsonArray>();
  for (const BusType& t : kBusTypes) {
    JsonObject o = types.add<JsonObject>();
    o["type"] = t.type;
    JsonArray pins = o["pins"].to<JsonArray>();
    for (uint8_t i = 0; i < t.pinCount; ++i) pins.add(t.pins[i]);
    if (t.max) o["max"] = t.max;
  }
}

DynamicItems::Result DynamicItems::scanBus(const char* id, JsonObject out) {
  const BusDef* d = findBus(id);
  if (!d) return busFail("bus not found", false);
  const char* t = d->type->type;
  if (strcmp(t, "spi") == 0) return busFail("spi buses cannot be scanned", false);
  out["bus"] = d->id;
  out["type"] = t;
  JsonArray devs = out["devices"].to<JsonArray>();
  // A Ref for the scan's duration: the bus of running items is reused, an
  // unused one is started just for the scan and stopped again afterwards.
  const PeripheralRegistry::Ref bus = acquireBus(*d);
  if (strcmp(t, "onewire") == 0) {
    uint8_t addrs[8][8] = {};
    const uint8_t n = DS18B20Sensor::scanBus(bus.as<OneWireBus>().ow, addrs, 8);
    for (uint8_t i = 0; i < n; ++i) {
      char hex[17] = {};
      for (uint8_t b = 0; b < 8; ++b) snprintf(hex + 2 * b, 3, "%02x", addrs[i][b]);
      JsonObject o = devs.add<JsonObject>();
      o["index"] = i;
      o["address"] = hex;
    }
  } else {
    TwoWire& wire = bus.as<I2cBus>().wire;
    uint8_t i = 0;
    for (int addr = 1; addr < 128 && i < 16; ++addr) {
      wire.beginTransmission(addr);
      if (wire.endTransmission() != 0) continue;
      char hex[6];
      snprintf(hex, sizeof(hex), "0x%02x", addr);
      JsonObject o = devs.add<JsonObject>();
      o["index"] = i++;
      o["address"] = hex;
    }
  }
  return {true};
}

// ── Remote transport resolution ──────────────────────────────────────────

DynamicItems::Result DynamicItems::resolveRemoteTransport(const JsonObject& cfg,
                                                           ITransport** out) {
  const char* transportType = cfg["transport"] | "mqtt";
  if (strcmp(transportType, "webhook") == 0) {
    if (!webhookService_) return {false, "webhook not available"};
    int listenPort = cfg["listen_port"] | -1;
    if (listenPort < 1 || listenPort > 65535) return {false, "missing/invalid listen_port"};
    const char* peerUrl = cfg["peer_url"] | "";
    if (!peerUrl[0]) return {false, "missing peer_url"};
    *out = &webhookService_->getOrCreate(static_cast<uint16_t>(listenPort), peerUrl);
    return {true};
  }
  if (strcmp(transportType, "mqtt") == 0) {
    if (!mqttTransport_) return {false, "mqtt not available"};
    *out = mqttTransport_;
    return {true};
  }
  if (strcmp(transportType, "websocket") == 0) {
    if (!webSocketHubTransport_) return {false, "websocket hub not enabled"};
    *out = webSocketHubTransport_;
    return {true};
  }
  if (strcmp(transportType, "espnow") == 0) {
    if (!espNowTransport_) return {false, "espnow not available"};
    *out = espNowTransport_;
    return {true};
  }
  return {false, "unknown remote transport"};
}

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

  // The bus the item references; MAX31865 without one uses hardware SPI.
  const BusDef* bus = nullptr;
  if (const char* busType = itemBusType(type)) {
    const char* busId = cfg["bus"] | "";
    if (busId[0]) {
      bus = findBus(busId);
      if (!bus) return {false, "unknown bus"};
      if (strcmp(bus->type->type, busType) != 0) return {false, "bus has the wrong type"};
    } else if (strcmp(type, "MAX31865") != 0) {
      return {false, "missing bus"};
    }
  }

  if (strcmp(type, "DS18B20") == 0) {
    const char* addrHex = cfg["address"] | "";
    uint8_t addr[8] = {};
    if (addrHex[0] && !parseHexAddress(addrHex, addr)) return {false, "invalid address"};
    e->bus = acquireBus(*bus);
    OneWire& ow = e->bus.as<OneWireBus>().ow;
    if (addrHex[0]) {
      e->ptr = std::make_unique<DS18B20Sensor>(e->id.c_str(), ow, addr);
    } else {
      e->ptr = std::make_unique<DS18B20Sensor>(e->id.c_str(), ow);
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

    // Only an incomplete legacy config gets here with clk (normalizeLegacyItem
    // moves complete ones onto a bus); the lines belong to the bus now.
    if (!cfg["clk"].isNull()) return {false, "clk/miso/mosi belong to an spi bus"};
    if (bus) {
      e->bus = acquireBus(*bus);
      const SpiBus& spi = e->bus.as<SpiBus>();
      e->ptr = std::make_unique<MAX31865Sensor>(
          e->id.c_str(), cs, spi.clk, spi.miso, spi.mosi, wiresEnum, rtd, rref);
    } else {
      e->ptr = std::make_unique<MAX31865Sensor>(
          e->id.c_str(), cs, wiresEnum, rtd, rref);
    }
  } else if (strcmp(type, "BME280") == 0) {
    uint8_t addr = static_cast<uint8_t>(cfg["address"] | 0x76);
    e->bus = acquireBus(*bus);
    e->ptr = std::make_unique<BME280Sensor>(e->id.c_str(), e->bus.as<I2cBus>().wire, addr);
  } else if (strcmp(type, "GY521") == 0) {
    uint8_t addr = static_cast<uint8_t>(cfg["address"] | 0x68);
    uint16_t    mask;
    const char* err = nullptr;
    // Absent → pitch only, the one angle a GY521 had before it had channels.
    if (!parseChannelMask(cfg, kGy521Channels, kGy521ChannelCount,
                          GY521TiltSensor::kChannelPitch, mask, err))
      return {false, err};
    e->bus = acquireBus(*bus);
    auto sensor = std::make_unique<GY521TiltSensor>(e->id.c_str(), e->bus.as<I2cBus>().wire, addr);
    sensor->setChannelMask(mask);
    e->ptr = std::move(sensor);
  } else if (strcmp(type, "YF-S201") == 0) {
    int pin = cfg["pin"] | -1;
    if (pin < 0) return {false, "missing pin"};
    float cal = cfg["calibration"] | YF_S201Sensor::kHzPerLiterPerMin;
    if (cal <= 0.0f) return {false, "invalid calibration"};
    static const char* const kKeys[] = {"rate", "volume"};
    uint16_t    mask;
    const char* err = nullptr;
    if (!parseChannelMask(cfg, kKeys, 2, 3, mask, err)) return {false, err};
    // A non-default legacy `calibration` is applied as a gain by the
    // calibration wrapper below; the sensor itself stays at its default.
    auto sensor = std::make_unique<YF_S201Sensor>(e->id.c_str(), pin);
    sensor->setChannelMask(mask);
    YF_S201Sensor* rawPtr = sensor.get();
    e->ptr = std::move(sensor);
    if (mask & YF_S201Sensor::kChannelVolume)
      e->resetFn = [rawPtr]() { rawPtr->resetVolume(); };
  } else if (strcmp(type, "HCSR04") == 0) {
    int trig = cfg["trig"] | -1;
    int echo = cfg["echo"] | -1;
    if (trig < 0) return {false, "missing trig"};
    if (echo < 0) return {false, "missing echo"};
    static const char* const kKeys[] = {"distance", "derived"};
    uint16_t    mask;
    const char* err = nullptr;
    if (!parseChannelMask(cfg, kKeys, 2, 3, mask, err)) return {false, err};
    if ((mask & HCSR04Sensor::kChannelDerived) && cfg["factor"].isNull() &&
        !cfg["channels"].isNull())
      return {false, "derived channel needs factor"};
    auto sensor = std::make_unique<HCSR04Sensor>(e->id.c_str(), trig, echo);
    sensor->setChannelMask(mask);
    if (!cfg["factor"].isNull()) {
      float       factor = cfg["factor"].as<float>();
      float       offset = cfg["offset"] | 0.0f;
      const char* unit   = cfg["unit"]   | "";
      sensor->setScale(factor, offset, unit);
    }
    e->ptr = std::move(sensor);
  } else if (strcmp(type, "HX711") == 0) {
    int dout = cfg["dout"] | -1;
    int sck  = cfg["sck"]  | -1;
    if (dout < 0) return {false, "missing dout"};
    if (sck  < 0) return {false, "missing sck"};
    // Scale and tare live in the calibration wrapper (raw = counts); a legacy
    // `scale` becomes its gain below.
    if (!cfg["scale"].isNull() && cfg["scale"].as<float>() <= 0.0f)
      return {false, "invalid scale"};
    e->ptr = std::make_unique<HX711LoadCellSensor>(e->id.c_str(), dout, sck);
  } else if (strcmp(type, "DigitalInput") == 0) {
    int pin = cfg["pin"] | -1;
    if (pin < 0) return {false, "missing pin"};
    bool pullup       = cfg["pullup"]      | false;
    bool invert       = cfg["invert"]      | false;
    uint32_t debounce = cfg["debounce_ms"] | 0u;
    e->ptr = std::make_unique<DigitalInputSensor>(
        e->id.c_str(), pin, pullup, invert, debounce);
  } else if (strcmp(type, "AnalogInput") == 0) {
    int pin = cfg["pin"] | -1;
    if (pin < 0) return {false, "missing pin"};
    if (cfg["value_min"].isNull() || cfg["value_max"].isNull())
      return {false, "missing value_min/value_max"};
    float vmin = cfg["value_min"].as<float>();
    float vmax = cfg["value_max"].as<float>();
    if (vmin >= vmax) return {false, "value_min must be < value_max"};
    int smoothing = cfg["smoothing"] | 1;
    if (smoothing < 1 || smoothing > 32) return {false, "invalid smoothing"};
    static const char* const kCal[] = {"cal_raw1", "cal_value1", "cal_raw2", "cal_value2"};
    int calKeys = 0;
    for (const char* k : kCal) if (!cfg[k].isNull()) ++calKeys;
    if (calKeys != 0 && calKeys != 4) return {false, "calibration needs cal_raw1/cal_value1/cal_raw2/cal_value2"};

    if (calKeys == 4 && cfg["cal_raw1"].as<int>() == cfg["cal_raw2"].as<int>())
      return {false, "cal_raw1 must differ from cal_raw2"};

    auto sensor = std::make_unique<AnalogInputSensor>(e->id.c_str(), pin);
    sensor->setMeta(Quantity::Custom, cfg["unit"] | "", vmin, vmax,
                    cfg["resolution"] | 0.01f);
    // Full-scale ADC range onto the display range, so the card shows values of
    // the right magnitude instead of raw counts. Legacy cal_* points are
    // applied on top of this by the calibration wrapper below.
    sensor->setCalibration(0, 4095, vmin, vmax);
    sensor->setSmoothing(static_cast<uint8_t>(smoothing));
    e->ptr = std::move(sensor);
  } else if (strcmp(type, "Voltage") == 0) {
    int pin = cfg["pin"] | -1;
    if (pin < 0) return {false, "missing pin"};
    float r1 = cfg["r1"] | -1.0f;
    float r2 = cfg["r2"] | 0.0f;
    if (r1 < 0 || r2 <= 0) return {false, "invalid r1/r2"};
    int smoothing = cfg["smoothing"] | 16;
    if (smoothing < 1 || smoothing > 32) return {false, "invalid smoothing"};
    auto sensor = std::make_unique<VoltageSensor>(e->id.c_str(), pin, r1, r2);
    sensor->setSmoothing(static_cast<uint8_t>(smoothing));
    sensor->setResolution(cfg["resolution"] | 0.01f);
    e->ptr = std::move(sensor);
  } else if (strcmp(type, "MqttGeneric") == 0) {
    if (!mqttTransport_) return {false, "mqtt not available"};
    const char* topic = cfg["topic"] | "";
    if (!topic[0]) return {false, "missing topic"};
    e->ptr = std::make_unique<MqttGenericSensor>(
        e->id.c_str(), *mqttTransport_, topic, Quantity::Custom,
        cfg["unit"] | "", cfg["value_min"] | 0.0f, cfg["value_max"] | 100.0f,
        cfg["resolution"] | 0.1f, cfg["json_field"] | "");
  } else if (strcmp(type, "Remote") == 0) {
    const char* device = cfg["device"] | "";
    const char* remoteId = cfg["remote_id"] | "";
    if (!device[0]) return {false, "missing device"};
    if (!remoteId[0]) return {false, "missing remote_id"};
    ITransport* transport = nullptr;
    Result tr = resolveRemoteTransport(cfg, &transport);
    if (!tr.ok) return tr;
    auto sensor = std::make_unique<RemoteSensor>(
        *transport, device, remoteId, cfg["channel_key"] | "");
    sensor->setLocalId(e->id.c_str());
    sensor->setPrefix(cfg["prefix"] | "sensactctrl");
    e->ptr = std::move(sensor);
  } else {
    return {false, "unknown sensor type"};
  }

  // Every sensor goes through a CalibratedSensor (identity until calibrated),
  // so calibrating never needs a re-create.
  e->innerPtr = std::move(e->ptr);
  auto wrapper = std::make_unique<CalibratedSensor>(*e->innerPtr);
  e->cal = wrapper.get();
  e->ptr = std::move(wrapper);

  // Legacy per-sensor calibration keys → calibration (they are dropped from the
  // stored config by syncCalibrationConfig below).
  bool migrate = false;
  if (strcmp(type, "HX711") == 0 && !cfg["scale"].isNull()) {
    e->cal->setCalibration(0, 0.0f, 0.0f, cfg["scale"].as<float>());
    migrate = true;
  } else if (strcmp(type, "YF-S201") == 0 && !cfg["calibration"].isNull()) {
    // rate and volume both scale with 1/calibration; the sensor runs at its default.
    const float gain = YF_S201Sensor::kHzPerLiterPerMin / cfg["calibration"].as<float>();
    for (const char* key : {"rate", "volume"}) {
      int idx = e->cal->indexOfKey(key);
      if (idx >= 0) e->cal->setCalibration(idx, 0.0f, 0.0f, gain);
    }
    migrate = true;
  } else if (strcmp(type, "AnalogInput") == 0 && !cfg["cal_raw1"].isNull()) {
    // The sensor maps the full ADC range 0..4095 onto value_min..value_max;
    // express the two legacy (ADC count → value) points in that mapped value.
    const float vmin = cfg["value_min"].as<float>();
    const float span = cfg["value_max"].as<float>() - vmin;
    auto mapped = [&](float counts) { return vmin + counts / 4095.0f * span; };
    e->cal->calibrateTwoPoint(0, mapped(cfg["cal_raw1"].as<float>()), cfg["cal_value1"].as<float>(),
                              mapped(cfg["cal_raw2"].as<float>()), cfg["cal_value2"].as<float>());
    migrate = true;
  }
  JsonArrayConst saved = cfg["calibrations"].as<JsonArrayConst>();
  for (JsonObjectConst o : saved) {
    int idx = e->cal->indexOfKey(o["channel"] | "");
    if (idx < 0) continue;
    // No "mode" key means the linear form — that is every entry written before
    // polynomial calibration existed.
    if (strcmp(o["mode"] | "", "poly") == 0) {
      // Only the support points are persisted; the fit is recomputed here. A
      // rejected fit leaves the channel at identity, which is what a corrupt
      // config should do.
      float raw[CalibratedSensor::kMaxPoints], val[CalibratedSensor::kMaxPoints];
      size_t k = 0;
      for (JsonObjectConst p : o["points"].as<JsonArrayConst>()) {
        if (k >= CalibratedSensor::kMaxPoints) break;
        raw[k] = p["raw"] | 0.0f;
        val[k] = p["value"] | 0.0f;
        ++k;
      }
      e->cal->calibratePoly(idx, raw, val, k, static_cast<uint8_t>(o["degree"] | 0));
    } else {
      e->cal->setCalibration(idx, o["raw_ref"] | 0.0f, o["value_ref"] | 0.0f,
                             o["gain"] | 1.0f);
    }
  }
  if (migrate || !saved.isNull()) syncCalibrationConfig(*e);

  reg.add(e->ptr.get());
  const char* label = cfg["label"] | "";
  if (label[0]) reg.setLabel(id, label);
  sensors_.push_back(std::move(e));
  return {true};
}

void DynamicItems::syncCalibrationConfig(SensorEntry& e) {
  JsonDocument doc;
  if (deserializeJson(doc, e.cfgJson) != DeserializationError::Ok) return;
  const char* type = doc["type"] | "";
  if (strcmp(type, "HX711") == 0) doc.remove("scale");
  if (strcmp(type, "YF-S201") == 0) doc.remove("calibration");
  if (strcmp(type, "AnalogInput") == 0) {
    doc.remove("cal_raw1"); doc.remove("cal_value1");
    doc.remove("cal_raw2"); doc.remove("cal_value2");
  }
  doc.remove("calibrations");
  JsonArray arr;
  const size_t n = e.cal->channelCount();
  for (size_t i = 0; i < n && i < CalibratedSensor::kMaxChannels; ++i) {
    const CalibratedSensor::Calibration c = e.cal->calibration(i);
    if (!c.active) continue;
    if (arr.isNull()) arr = doc["calibrations"].to<JsonArray>();
    JsonObject o = arr.add<JsonObject>();
    o["channel"] = e.cal->channel(i).key;
    // Either the linear triple or the polynomial points — never both.
    if (c.degree > 0) {
      o["mode"]   = "poly";
      o["degree"] = c.degree;
      JsonArray pts = o["points"].to<JsonArray>();
      for (size_t k = 0; k < c.pointCount; ++k) {
        JsonObject p = pts.add<JsonObject>();
        p["raw"]   = c.points[k][0];
        p["value"] = c.points[k][1];
      }
    } else {
      o["raw_ref"]   = c.rawRef;
      o["value_ref"] = c.valRef;
      o["gain"]      = c.gain;
    }
  }
  e.cfgJson.clear();
  serializeJson(doc, e.cfgJson);
}

DynamicItems::SensorEntry* DynamicItems::findSensorEntry(const char* id) {
  for (auto& e : sensors_) if (e->id == id) return e.get();
  return nullptr;
}

const DynamicItems::SensorEntry* DynamicItems::findSensorEntry(const char* id) const {
  for (auto& e : sensors_) if (e->id == id) return e.get();
  return nullptr;
}

static const char* calibrationError(CalibratedSensor::Result r) {
  switch (r) {
    case CalibratedSensor::Result::BadChannel:      return "unknown channel";
    case CalibratedSensor::Result::NotCalibratable: return "channel does not support this calibration";
    case CalibratedSensor::Result::InvalidPoints:   return "invalid calibration points";
    default:                                        return "";
  }
}

DynamicItems::Result DynamicItems::getCalibration(const char* id,
                                                  JsonDocument& out) const {
  const SensorEntry* e = findSensorEntry(id);
  if (!e) return {false, "sensor not found"};
  JsonArray channels = out["channels"].to<JsonArray>();
  const size_t n = e->cal->channelCount();
  for (size_t i = 0; i < n; ++i) {
    const Channel ch = e->cal->channel(i);
    const CalibratedSensor::Calibration c = e->cal->calibration(i);
    const ValueKind kind = ch.meta.kind;
    JsonObject o = channels.add<JsonObject>();
    o["key"]   = ch.key;
    o["unit"]  = ch.meta.unit;
    o["valid"] = ch.reading.valid;
    o["raw"]   = e->cal->rawValue(i);
    o["value"] = ch.reading.value;
    o["calibrated"] = c.active;
    if (c.active) {
      o["mode"] = c.degree > 0 ? "poly" : "linear";
      if (c.degree > 0) {
        o["degree"] = c.degree;
        JsonArray pts = o["points"].to<JsonArray>();
        for (size_t k = 0; k < c.pointCount; ++k) {
          JsonObject p = pts.add<JsonObject>();
          p["raw"]   = c.points[k][0];
          p["value"] = c.points[k][1];
        }
      } else {
        o["raw_ref"]   = c.rawRef;
        o["value_ref"] = c.valRef;
        o["gain"]      = c.gain;
      }
    }
    // Which modes make sense for this channel (see CalibratedSensor).
    JsonArray modes = o["modes"].to<JsonArray>();
    if (i < CalibratedSensor::kMaxChannels) {
      if (kind == ValueKind::Continuous) {
        modes.add("offset"); modes.add("twopoint"); modes.add("poly");
      }
      if (kind == ValueKind::Continuous || kind == ValueKind::Cumulative) modes.add("gain");
    }
  }
  return {true};
}

DynamicItems::Result DynamicItems::calibrateSensor(const char* id,
                                                   const JsonObjectConst& body) {
  SensorEntry* e = findSensorEntry(id);
  if (!e) return {false, "sensor not found"};
  const int idx = e->cal->indexOfKey(body["channel"] | "");
  if (idx < 0) return {false, "unknown channel"};
  const char* mode = body["mode"] | "";
  const bool isOffset   = strcmp(mode, "offset") == 0;
  const bool isGain     = strcmp(mode, "gain") == 0;
  const bool isTwoPoint = strcmp(mode, "twopoint") == 0;
  const bool isPoly     = strcmp(mode, "poly") == 0;
  if (!isOffset && !isGain && !isTwoPoint && !isPoly) return {false, "invalid mode"};

  JsonArrayConst pts = body["points"].as<JsonArrayConst>();
  if (pts.isNull()) return {false, "wrong number of points"};
  uint8_t degree = 0;
  if (isPoly) {
    degree = static_cast<uint8_t>(body["degree"] | 0);
    if (degree < 1 || degree > CalibratedSensor::kMaxDegree)
      return {false, "degree must be 1..3"};
    if (pts.size() < static_cast<size_t>(degree) + 1u)
      return {false, "need at least degree+1 points"};
    if (pts.size() > CalibratedSensor::kMaxPoints) return {false, "too many points"};
  } else if (pts.size() != (isTwoPoint ? 2u : 1u)) {
    return {false, "wrong number of points"};
  }

  float raw[CalibratedSensor::kMaxPoints], val[CalibratedSensor::kMaxPoints];
  size_t k = 0, live = 0;
  for (JsonObjectConst p : pts) {
    if (k >= CalibratedSensor::kMaxPoints) break;
    if (p["value"].isNull()) return {false, "missing value"};
    // No raw given → the reading the sensor shows right now.
    if (p["raw"].isNull()) { raw[k] = e->cal->rawValue(idx); ++live; }
    else                   { raw[k] = p["raw"].as<float>(); }
    val[k] = p["value"].as<float>();
    ++k;
  }
  // Two points taken from the same live reading would be identical, which makes
  // the fit singular — only one point may leave "raw" out.
  if (live > 1) return {false, "only one point may omit raw"};

  CalibratedSensor::Result r =
      isPoly      ? e->cal->calibratePoly(idx, raw, val, k, degree)
      : isTwoPoint ? e->cal->calibrateTwoPoint(idx, raw[0], val[0], raw[1], val[1])
      : isOffset   ? e->cal->calibrateOffset(idx, raw[0], val[0])
                   : e->cal->calibrateGain(idx, raw[0], val[0]);
  if (r != CalibratedSensor::Result::Ok) return {false, calibrationError(r)};
  syncCalibrationConfig(*e);
  return {true};
}

DynamicItems::Result DynamicItems::clearCalibration(const char* id,
                                                    const char* channelKey) {
  SensorEntry* e = findSensorEntry(id);
  if (!e) return {false, "sensor not found"};
  if (channelKey) {
    const int idx = e->cal->indexOfKey(channelKey);
    if (idx < 0) return {false, "unknown channel"};
    e->cal->clear(idx);
  } else {
    for (size_t i = 0; i < CalibratedSensor::kMaxChannels; ++i) e->cal->clear(i);
  }
  syncCalibrationConfig(*e);
  return {true};
}

DynamicItems::Result DynamicItems::addSensor(const JsonObject& cfg,
                                              Registry& reg) {
  Result pins = checkPins(cfg, "");
  if (!pins.ok) return pins;
  Result addr = checkI2cAddress(cfg, "");
  if (!addr.ok) return addr;
  return addSensorUnchecked(cfg, reg);
}

DynamicItems::Result DynamicItems::addSensorUnchecked(const JsonObject& cfg,
                                                       Registry& reg) {
  auto r = addSensorNoBegin(cfg, reg);
  if (r.ok && initialized_) {
    sensors_.back()->ptr->begin();
    for (auto& cb : onSensorAdded_) if (cb) cb(*sensors_.back()->ptr);
  }
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
    bool invert = cfg["invert"] | false;
    auto* a = new DigitalOutputActuator(e->id.c_str(), pin, mode, /*activeHigh=*/!invert);
    if (mode == DigitalOutputActuator::Mode::TimeProportional)
      a->setPeriodMs(cfg["period_ms"] | 2000u);
    e->ptr.reset(a);
  } else if (strcmp(type, "PulseOutput") == 0) {
    int pin = cfg["pin"] | -1;
    if (pin < 0) return {false, "missing pin"};
    bool invert = cfg["invert"] | false;
    e->ptr = std::make_unique<PulseOutputActuator>(
        e->id.c_str(), pin,
        cfg["pulse_width_ms"] | 50u,
        cfg["gap_ms"] | 50u,
        /*activeHigh=*/!invert);
  } else if (strcmp(type, "IDS1") == 0 || strcmp(type, "IDS2") == 0) {
    int pinW = cfg["pin_white"]     | -1;
    int pinY = cfg["pin_yellow"]    | -1;
    int pinI = cfg["pin_interrupt"] | -1;
    if (pinW < 0 || pinY < 0 || pinI < 0)
      return {false, "missing pin_white / pin_yellow / pin_interrupt"};
    auto itype = strcmp(type, "IDS1") == 0 ? IdsType::IDS1 : IdsType::IDS2;
    e->ptr = std::make_unique<IdsActuator>(
        e->id.c_str(), itype,
        static_cast<uint8_t>(pinW),
        static_cast<uint8_t>(pinY),
        static_cast<uint8_t>(pinI));
  } else if (strcmp(type, "AnalogOutput") == 0) {
    int pin = cfg["pin"] | -1;
    if (pin < 0) return {false, "missing pin"};
    const char* modeStr = cfg["mode"] | "pwm";
    auto mode = strcmp(modeStr, "dac") == 0
                    ? AnalogOutputActuator::Mode::Dac
                    : AnalogOutputActuator::Mode::Pwm;
    auto* a = new AnalogOutputActuator(e->id.c_str(), pin, mode);
    if (!cfg["freq"].isNull())
      a->setFrequency(cfg["freq"] | 5000u);
    if (!cfg["resolution_bits"].isNull())
      a->setResolutionBits(static_cast<uint8_t>(cfg["resolution_bits"] | 12));
    if (!cfg["unit"].isNull() || !cfg["value_min"].isNull() || !cfg["value_max"].isNull())
      a->setRange(Quantity::Custom,
                  cfg["unit"] | "",
                  cfg["value_min"] | 0.0f,
                  cfg["value_max"] | 1.0f,
                  cfg["resolution"] | 0.01f);
    e->ptr.reset(a);
  } else if (strcmp(type, "MqttGeneric") == 0) {
    if (!mqttTransport_) return {false, "mqtt not available"};
    const char* topic = cfg["topic"] | "";
    if (!topic[0]) return {false, "missing topic"};
    bool retained = cfg["retained"] | false;
    const char* kindStr = cfg["kind"] | "Binary";
    if (strcmp(kindStr, "Continuous") == 0) {
      const char* tmpl = cfg["payload_template"] | "";
      if (!tmpl[0]) return {false, "missing payload_template"};
      e->ptr = std::make_unique<MqttGenericActuator>(
          e->id.c_str(), *mqttTransport_, topic, tmpl,
          cfg["value_min"] | 0.0f, cfg["value_max"] | 1.0f,
          cfg["resolution"] | 0.01f, cfg["unit"] | "", retained);
    } else {
      e->ptr = std::make_unique<MqttGenericActuator>(
          e->id.c_str(), *mqttTransport_, topic,
          cfg["on_payload"] | "ON", cfg["off_payload"] | "OFF", retained);
    }
  } else if (strcmp(type, "Remote") == 0) {
    const char* device = cfg["device"] | "";
    const char* remoteId = cfg["remote_id"] | "";
    if (!device[0]) return {false, "missing device"};
    if (!remoteId[0]) return {false, "missing remote_id"};
    ITransport* transport = nullptr;
    Result tr = resolveRemoteTransport(cfg, &transport);
    if (!tr.ok) return tr;
    auto actuator = std::make_unique<RemoteActuator>(*transport, device, remoteId);
    actuator->setLocalId(e->id.c_str());
    actuator->setPrefix(cfg["prefix"] | "sensactctrl");
    e->ptr = std::move(actuator);
  } else {
    return {false, "unknown actuator type"};
  }

  // Opt-in duty-cycle scheduling — any actuator kind. The master switch is
  // no decorator; every Actuator carries it, so this is the only layer.
  if (!cfg["interval_period_sec"].isNull()) {
    uint32_t onSec = cfg["interval_on_sec"] | 0u;
    uint32_t periodSec = cfg["interval_period_sec"] | 0u;
    if (periodSec == 0 || onSec > periodSec) return {false, "invalid interval"};
    auto* iv = new IntervalActuator(*e->ptr, onSec, periodSec);
    e->innerPtr = std::move(e->ptr);
    e->ptr.reset(iv);
  }

  reg.add(e->ptr.get());
  const char* label = cfg["label"] | "";
  if (label[0]) reg.setLabel(id, label);
  actuators_.push_back(std::move(e));
  return {true};
}

DynamicItems::Result DynamicItems::addActuator(const JsonObject& cfg,
                                                Registry& reg) {
  Result pins = checkPins(cfg, "");
  if (!pins.ok) return pins;
  return addActuatorUnchecked(cfg, reg);
}

DynamicItems::Result DynamicItems::addActuatorUnchecked(const JsonObject& cfg,
                                                         Registry& reg) {
  auto r = addActuatorNoBegin(cfg, reg);
  if (r.ok && initialized_) {
    actuators_.back()->ptr->begin();
    for (auto& cb : onActuatorAdded_) if (cb) cb(*actuators_.back()->ptr);
  }
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

  Controller* built = nullptr;

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

    e->sensorId   = sId;
    e->actuatorId = aId;
    built = ctrl;
  } else if (strcmp(type, "TwoPoint") == 0) {
    const char* sId = cfg["sensor"]   | "";
    const char* aId = cfg["actuator"] | "";
    if (!sId[0]) return {false, "missing sensor"};
    if (!aId[0]) return {false, "missing actuator"};
    auto* s = reg.findSensor(sId);
    auto* a = reg.findActuator(aId);
    if (!s) return {false, "sensor not found"};
    if (!a) return {false, "actuator not found"};
    float hystLow  = cfg["hyst_low"]  | -0.5f;
    float hystHigh = cfg["hyst_high"] | 0.5f;
    bool  inverted = cfg["inverted"]  | false;
    auto* ctrl = new TwoPointController(e->id.c_str(), *s, *a);
    ctrl->setHysteresis(hystLow, hystHigh);
    ctrl->setInverted(inverted);
    e->sensorId   = sId;
    e->actuatorId = aId;
    built = ctrl;
  } else if (strcmp(type, "DualStage") == 0) {
    const char* sId = cfg["sensor"]        | "";
    const char* hId = cfg["heat_actuator"] | "";
    const char* cId = cfg["cool_actuator"] | "";
    if (!sId[0]) return {false, "missing sensor"};
    if (!hId[0] && !cId[0]) return {false, "missing actuator"};
    auto* s = reg.findSensor(sId);
    if (!s) return {false, "sensor not found"};
    Actuator* h = nullptr;
    Actuator* cl = nullptr;
    if (hId[0]) { h = reg.findActuator(hId); if (!h) return {false, "heat actuator not found"}; }
    if (cId[0]) { cl = reg.findActuator(cId); if (!cl) return {false, "cool actuator not found"}; }

    auto* ctrl = new DualStageController(e->id.c_str(), *s, h, cl);
    ctrl->setDifferentials(cfg["heat_diff"] | 0.5f, cfg["cool_diff"] | 0.5f);
    ctrl->setCoolCycleLimits(cfg["cool_min_on_ms"]  | 0u,
                             cfg["cool_min_off_ms"] | 0u);
    ctrl->setChangeoverMs(cfg["changeover_ms"] | 0u);

    e->sensorId       = sId;
    e->actuatorId     = hId;
    e->coolActuatorId = cId;
    built = ctrl;
  } else if (strcmp(type, "SplitRangePID") == 0) {
    const char* sId = cfg["sensor"]        | "";
    const char* hId = cfg["heat_actuator"] | "";
    const char* cId = cfg["cool_actuator"] | "";
    if (!sId[0]) return {false, "missing sensor"};
    if (!hId[0] && !cId[0]) return {false, "missing actuator"};
    auto* s = reg.findSensor(sId);
    if (!s) return {false, "sensor not found"};
    Actuator* h = nullptr;
    Actuator* cl = nullptr;
    if (hId[0]) { h = reg.findActuator(hId); if (!h) return {false, "heat actuator not found"}; }
    if (cId[0]) { cl = reg.findActuator(cId); if (!cl) return {false, "cool actuator not found"}; }

    auto* ctrl = new SplitRangePIDController(e->id.c_str(), *s, h, cl);
    ctrl->setTunings(cfg["Kp"] | 2.0f, cfg["Ki"] | 0.1f, cfg["Kd"] | 0.0f);
    ctrl->setDeadband(cfg["deadband"] | 0.05f);
    ctrl->setChangeoverMs(cfg["changeover_ms"] | 0u);

    e->sensorId       = sId;
    e->actuatorId     = hId;
    e->coolActuatorId = cId;
    built = ctrl;
  } else {
    return {false, "unknown controller type"};
  }

  std::unique_ptr<Controller> concrete(built);
  concrete->setRange(cfg["range_min"] | 0.0f, cfg["range_max"] | 0.0f);
  float maxRate = cfg["max_rate_per_sec"] | 0.0f;
  if (maxRate > 0.0f) {
    auto* rl = new RateLimitedController(*concrete, maxRate);
    e->innerPtr = std::move(concrete);
    e->ptr.reset(rl);
  } else {
    e->ptr = std::move(concrete);
  }
  e->ptr->setSetpoint(cfg["setpoint"] | 0.0f);  // first call ⇒ snaps instantly

  reg.add(e->ptr.get());
  const char* label = cfg["label"] | "";
  if (label[0]) reg.setLabel(id, label);
  controllers_.push_back(std::move(e));
  return {true};
}

DynamicItems::Result DynamicItems::addController(const JsonObject& cfg,
                                                  Registry& reg) {
  auto r = addControllerNoBegin(cfg, reg);
  if (r.ok && initialized_) {
    controllers_.back()->ptr->begin();
    for (auto& cb : onControllerAdded_) if (cb) cb(*controllers_.back()->ptr);
  }
  return r;
}

// ── Remove ────────────────────────────────────────────────────────────────

DynamicItems::Result DynamicItems::removeSensor(const char* id, Registry& reg) {
  for (auto& e : controllers_) {
    // sensorId may name a channel ("tank.derived") of the sensor being removed.
    const size_t n = strlen(id);
    if (e->sensorId == id ||
        (e->sensorId.compare(0, n, id) == 0 && e->sensorId.size() > n &&
         e->sensorId[n] == '.'))
      return {false, "sensor is referenced by a controller"};
  }
  for (auto it = sensors_.begin(); it != sensors_.end(); ++it) {
    if ((*it)->id == id) {
      reg.remove((*it)->ptr.get());
      (*it)->ptr->end();
      for (auto& cb : onSensorRemoving_) if (cb) cb(*(*it)->ptr);
      sensors_.erase(it);
      return {true};
    }
  }
  return {false, "not a dynamic item"};
}

bool DynamicItems::drivenByController(const char* actuatorId) const {
  for (const auto& e : controllers_)
    if (e->actuatorId == actuatorId || e->coolActuatorId == actuatorId) return true;
  return false;
}

bool DynamicItems::syncTunedParams() {
  // Relative: the stored value went through a float→JSON→float round trip.
  auto same = [](float a, float b) {
    return fabsf(a - b) <= 1e-5f * std::max(fabsf(a), fabsf(b)) + 1e-9f;
  };
  bool changed = false;
  for (auto& e : controllers_) {
    JsonDocument cfg;
    if (deserializeJson(cfg, e->cfgJson) != DeserializationError::Ok) continue;
    const char* type = cfg["type"] | "";
    Controller* c = e->innerPtr ? e->innerPtr.get() : e->ptr.get();

    // Each helper writes the live value under its config key when it differs
    // from what is stored; the defaults are those of addControllerNoBegin.
    bool dirty = false;
    auto syncF = [&](const char* key, float live, float def) {
      if (same(live, cfg[key] | def)) return;
      cfg[key] = live;
      dirty = true;
    };
    auto syncU = [&](const char* key, uint32_t live, uint32_t def) {
      if (live == (cfg[key] | def)) return;
      cfg[key] = live;
      dirty = true;
    };

    if (strcmp(type, "PID") == 0) {
      auto* p = static_cast<PIDController*>(c);
      syncF("Kp", p->kp(), 2.0f);
      syncF("Ki", p->ki(), 0.1f);
      syncF("Kd", p->kd(), 0.0f);
    } else if (strcmp(type, "SplitRangePID") == 0) {
      auto* p = static_cast<SplitRangePIDController*>(c);
      syncF("Kp", p->kp(), 2.0f);
      syncF("Ki", p->ki(), 0.1f);
      syncF("Kd", p->kd(), 0.0f);
      syncF("deadband", p->deadband(), 0.05f);
      syncU("changeover_ms", p->changeoverMs(), 0u);
    } else if (strcmp(type, "TwoPoint") == 0) {
      auto* p = static_cast<TwoPointController*>(c);
      syncF("hyst_low", p->hysteresisLow(), -0.5f);
      syncF("hyst_high", p->hysteresisHigh(), 0.5f);
      if (p->inverted() != (cfg["inverted"] | false)) {
        cfg["inverted"] = p->inverted();
        dirty = true;
      }
    } else if (strcmp(type, "DualStage") == 0) {
      auto* p = static_cast<DualStageController*>(c);
      syncF("heat_diff", p->heatDiff(), 0.5f);
      syncF("cool_diff", p->coolDiff(), 0.5f);
      syncU("cool_min_on_ms", p->coolMinOnMs(), 0u);
      syncU("cool_min_off_ms", p->coolMinOffMs(), 0u);
      syncU("changeover_ms", p->changeoverMs(), 0u);
    } else {
      continue;
    }
    // The rate limit wraps the controller only while it is set.
    if (e->innerPtr) {
      syncF("max_rate_per_sec",
            static_cast<RateLimitedController*>(e->ptr.get())->maxRatePerSec(), 0.0f);
    }

    if (!dirty) continue;
    e->cfgJson.clear();
    serializeJson(cfg, e->cfgJson);
    Serial.printf("[controllers] %s: tuned parameters saved\n", e->id.c_str());
    changed = true;
  }
  return changed;
}

DynamicItems::Result DynamicItems::removeActuator(const char* id,
                                                   Registry& reg) {
  if (drivenByController(id)) return {false, "actuator is referenced by a controller"};
  for (auto it = actuators_.begin(); it != actuators_.end(); ++it) {
    if ((*it)->id == id) {
      reg.remove((*it)->ptr.get());
      (*it)->ptr->end();
      for (auto& cb : onActuatorRemoving_) if (cb) cb(*(*it)->ptr);
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
      for (auto& cb : onControllerRemoving_) if (cb) cb(*(*it)->ptr);
      controllers_.erase(it);
      return {true};
    }
  }
  return {false, "not a dynamic item"};
}

// ── Replace ───────────────────────────────────────────────────────────────

namespace {
// Shared by replace{Sensor,Actuator,Controller}: remove the old entry, add the
// new one, recreate the old one from its saved config if that fails, and move
// the resulting entry back to the old position so the list order is stable.
template <typename Vec, typename Remove, typename Add>
DynamicItems::Result replaceEntry(Vec& vec, const std::string& oldId,
                                  const JsonObject& cfg, Registry& reg,
                                  Remove remove, Add add) {
  size_t pos = 0;
  while (pos < vec.size() && vec[pos]->id != oldId) ++pos;
  if (pos == vec.size()) return {false, "not a dynamic item"};
  const char* newId = cfg["id"] | "";
  if (!newId[0]) return {false, "missing id"};
  if (oldId != newId &&
      (reg.findSensor(newId) || reg.findActuator(newId) || reg.findController(newId)))
    return {false, "id already in use"};

  const std::string oldCfg = vec[pos]->cfgJson;
  DynamicItems::Result removed = remove(oldId.c_str());
  if (!removed.ok) {
    removed.conflict = true;  // still referenced by a controller
    return removed;
  }
  DynamicItems::Result added = add(cfg);
  if (!added.ok) {
    JsonDocument doc;
    deserializeJson(doc, oldCfg);
    if (!add(doc.as<JsonObject>()).ok) {
      Serial.printf("[items] replacing %s failed (%s) and its old config could not be restored\n",
                    oldId.c_str(), added.error);
      return added;
    }
  }
  std::rotate(vec.begin() + pos, vec.end() - 1, vec.end());
  return added;
}
}  // namespace

DynamicItems::Result DynamicItems::replaceSensor(const char* oldId,
                                                 const JsonObject& cfg,
                                                 Registry& reg) {
  const std::string id = oldId;
  const SensorEntry* old = findSensorEntry(id.c_str());
  if (!old) return {false, "not a dynamic item"};
  Result pins = checkPins(cfg, id.c_str());
  if (!pins.ok) return pins;
  Result addr = checkI2cAddress(cfg, id.c_str());
  if (!addr.ok) return addr;
  // Holding the old sensor's bus across the swap keeps it from being torn
  // down and rebuilt when the new config — or the restored old one — sits on
  // the same bus. A bus left without users goes when this Ref does.
  const PeripheralRegistry::Ref held = old->bus;
  return replaceEntry(
      sensors_, id, cfg, reg,
      [&](const char* i) { return removeSensor(i, reg); },
      [&](const JsonObject& c) { return addSensorUnchecked(c, reg); });
}

DynamicItems::Result DynamicItems::replaceActuator(const char* oldId,
                                                   const JsonObject& cfg,
                                                   Registry& reg) {
  const std::string id = oldId;
  bool found = false;
  for (auto& e : actuators_) found |= (e->id == id);
  if (!found) return {false, "not a dynamic item"};
  Result pins = checkPins(cfg, id.c_str());
  if (!pins.ok) return pins;
  return replaceEntry(
      actuators_, id, cfg, reg,
      [&](const char* i) { return removeActuator(i, reg); },
      [&](const JsonObject& c) { return addActuatorUnchecked(c, reg); });
}

DynamicItems::Result DynamicItems::replaceController(const char* oldId,
                                                     const JsonObject& cfg,
                                                     Registry& reg) {
  return replaceEntry(
      controllers_, oldId, cfg, reg,
      [&](const char* i) { return removeController(i, reg); },
      [&](const JsonObject& c) { return addController(c, reg); });
}

// ── Pins ──────────────────────────────────────────────────────────────────

std::vector<PinUse> DynamicItems::pinUses() const {
  std::vector<PinUse> uses;
  for (const BusDef& d : buses_) busPinUses(d, uses);
  auto collect = [&](const std::string& json) {
    JsonDocument doc;
    if (deserializeJson(doc, json) == DeserializationError::Ok)
      collectPins(doc.as<JsonObjectConst>(), uses);
  };
  for (const auto& e : sensors_) collect(e->cfgJson);
  for (const auto& e : actuators_) collect(e->cfgJson);
  if (wakePin_ >= 0) uses.push_back(wakePinUse(wakePin_, wakePullup_));
  return uses;
}

DynamicItems::Result DynamicItems::checkPins(const JsonObject& cfg,
                                             const char* replaceId) {
  const PinCheck c = checkItemPins(currentBoard(), pinUses(), cfg, replaceId);
  if (c.ok) return {true};
  pinError_ = c.error;
  return {false, pinError_.c_str(), c.status == 409};
}

// ── I2C address ───────────────────────────────────────────────────────────

std::vector<AddressUse> DynamicItems::addressUses() const {
  std::vector<AddressUse> uses;
  for (const auto& e : sensors_) {
    JsonDocument doc;
    if (deserializeJson(doc, e->cfgJson) == DeserializationError::Ok)
      collectAddresses(doc.as<JsonObjectConst>(), uses);
  }
  return uses;
}

DynamicItems::Result DynamicItems::checkI2cAddress(const JsonObject& cfg,
                                                    const char* replaceId) {
  // An unknown bus is reported by addSensorNoBegin; only a fixed bus has
  // reserved addresses.
  const BusDef* bus = findBus(cfg["bus"] | "");
  const AddrDef* reserved = bus ? bus->reserved : nullptr;
  const size_t n = bus ? bus->reservedCount : 0;
  const AddressCheck c = checkItemAddress(reserved, n, addressUses(), cfg, replaceId);
  if (c.ok) return {true};
  i2cAddressError_ = c.error;
  return {false, i2cAddressError_.c_str(), c.status == 409};
}

void DynamicItems::acquireBoardI2cBus() {
  for (const BusDef& d : buses_) {
    if (d.fixed && strcmp(d.type->type, "i2c") == 0) boardI2cBus_ = acquireBus(d);
  }
}

// ── Label ─────────────────────────────────────────────────────────────────
// Unlike an id change (delete+recreate, blocked while a controller
// references the item — see removeSensor/removeActuator above), a label
// only updates Registry metadata, so it works regardless of controller
// wiring. label == "" clears it.

namespace {
void rewriteCfgLabel(std::string& cfgJson, const char* label) {
  JsonDocument doc;
  if (deserializeJson(doc, cfgJson) != DeserializationError::Ok) return;
  if (label && label[0]) doc["label"] = label;
  else doc.remove("label");
  cfgJson.clear();
  serializeJson(doc, cfgJson);
}
}  // namespace

DynamicItems::Result DynamicItems::setSensorLabel(const char* id, Registry& reg,
                                                   const char* label) {
  SensorEntry* e = findSensorEntry(id);
  if (!e) return {false, "not a dynamic item"};
  reg.setLabel(id, label);
  rewriteCfgLabel(e->cfgJson, label);
  return {true};
}

DynamicItems::Result DynamicItems::setActuatorLabel(const char* id, Registry& reg,
                                                     const char* label) {
  for (auto& e : actuators_) {
    if (e->id == id) {
      reg.setLabel(id, label);
      rewriteCfgLabel(e->cfgJson, label);
      return {true};
    }
  }
  return {false, "not a dynamic item"};
}

DynamicItems::Result DynamicItems::setControllerLabel(const char* id, Registry& reg,
                                                       const char* label) {
  for (auto& e : controllers_) {
    if (e->id == id) {
      reg.setLabel(id, label);
      rewriteCfgLabel(e->cfgJson, label);
      return {true};
    }
  }
  return {false, "not a dynamic item"};
}

// ── Persistence ───────────────────────────────────────────────────────────

namespace {
// The angle of these GY521s moved from "<id>" to "<id>.pitch"
// (normalizeLegacyGy521): rewrite "sensor/<id>" in the stores that keep sensor
// refs. Runs before those stores load (main.cpp). Dashboards stay as they are:
// there "sensor/<id>" means the whole sensor, which still resolves; controllers
// take the bare id and read channel 0, which is pitch.
void migrateGy521Refs(fs::FS& sd, const std::vector<std::string>& ids) {
  static const char* const kFiles[] = {"/config/logs.json", "/config/alarms.json",
                                       "/config/programs.json", "/config/profiles.json"};
  for (const char* path : kFiles) {
    SdLock sdLock;
    File f = sd.open(path);
    if (!f) continue;
    JsonDocument doc;
    const bool ok = deserializeJson(doc, f) == DeserializationError::Ok;
    f.close();
    if (!ok) continue;
    const bool logs = strcmp(path, "/config/logs.json") == 0;
    bool changed = false;
    for (const std::string& id : ids) {
      const std::string from = "sensor/" + id;
      const std::string to   = from + ".pitch";
      changed |= logs ? renameLogRefs(doc.as<JsonArray>(), from.c_str(), to.c_str())
                      : renameRefs(doc.as<JsonVariant>(), from.c_str(), to.c_str());
    }
    if (!changed) continue;
    f = sd.open(path, FILE_WRITE);
    if (!f) continue;
    serializeJson(doc, f);
    f.close();
    Serial.printf("[items] GY521 pitch refs rewritten in %s\n", path);
  }
}
}  // namespace

void DynamicItems::loadFromSD(fs::FS& sd, Registry& reg) {
  JsonDocument doc;
  {
    SdLock sdLock;
    File f = sd.open("/config/registry.json");
    if (!f) return;
    const bool ok = deserializeJson(doc, f) == DeserializationError::Ok;
    f.close();
    if (!ok) return;
  }

  for (JsonObject def : doc["buses"].as<JsonArray>()) {
    BusDef d;
    std::string err;
    if (!parseBusDef(def, d, err) || findBus(d.id.c_str())) {
      Serial.printf("[buses] skipping bus %s (%s)\n", (const char*)(def["id"] | "?"),
                    err.empty() ? "duplicate" : err.c_str());
      continue;
    }
    if (strcmp(d.type->type, "i2c") == 0) {
      bool taken = false;
      for (const BusDef& b : buses_) taken |= (b.port == d.port);
      if (d.port < 0 || taken) d.port = freeI2cPort(buses_);
      if (d.port < 0) {
        Serial.printf("[buses] skipping bus %s (no free I2C controller)\n", d.id.c_str());
        continue;
      }
    }
    buses_.push_back(d);
  }

  bool migrated = false;
  std::vector<std::string> gy521Migrated;
  for (JsonObject cfg : doc["sensors"].as<JsonArray>()) {
    migrated |= normalizeLegacyItem(cfg, buses_, currentBoard());
    if (normalizeLegacyGy521(cfg)) gy521Migrated.push_back(cfg["id"] | "");
    addSensorNoBegin(cfg, reg);
  }
  for (JsonObject cfg : doc["actuators"].as<JsonArray>())
    addActuatorNoBegin(cfg, reg);
  for (JsonObject cfg : doc["controllers"].as<JsonArray>())
    addControllerNoBegin(cfg, reg);

  // Stored conflicts still load (dropping e.g. a heater silently would be
  // worse); they are reported here and in GET /api/pins.
  const std::vector<PinUse> uses = pinUses();
  for (const PinConflict& c : findPinConflicts(currentBoard(), uses)) {
    std::string who;
    for (const PinUse* u : c.users) who += " " + u->item + "." + u->key;
    Serial.printf("[pins] GPIO %d conflict (%s):%s\n", c.gpio, c.reason.c_str(), who.c_str());
  }

  if (migrated) Serial.println("[buses] moved items from before bus definitions onto buses");
  // The refs first, the registry last: a crash in between leaves the GY521
  // unmigrated, and the next boot repeats the (idempotent) rename.
  if (!gy521Migrated.empty()) {
    for (const std::string& id : gy521Migrated)
      Serial.printf("[items] GY521 %s: angle is now %s.pitch\n", id.c_str(), id.c_str());
    migrateGy521Refs(sd, gy521Migrated);
  }
  if (migrated || !gy521Migrated.empty()) saveToSD(sd);
}

std::string DynamicItems::storedBusesJson() const {
  JsonDocument doc;
  JsonArray arr = doc.to<JsonArray>();
  for (const BusDef& d : buses_)
    if (!d.fixed) writeBusDef(d, arr.add<JsonObject>());
  std::string out;
  serializeJson(doc, out);
  return out;
}

void DynamicItems::saveToSD(fs::FS& sd) const {
  SdLock sdLock;
  sd.mkdir("/config");
  File f = sd.open("/config/registry.json", FILE_WRITE);
  if (!f) return;

  f.print("{\"buses\":");
  f.print(storedBusesJson().c_str());
  f.print(",\"sensors\":[");
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

// ── Config serialization ──────────────────────────────────────────────────────

String DynamicItems::serializeConfig() const {
  String out = "{\"buses\":";
  out += storedBusesJson().c_str();
  out += ",\"sensors\":[";
  for (size_t i = 0; i < sensors_.size(); ++i) {
    if (i) out += ',';
    out += sensors_[i]->cfgJson.c_str();
  }
  out += "],\"actuators\":[";
  for (size_t i = 0; i < actuators_.size(); ++i) {
    if (i) out += ',';
    out += actuators_[i]->cfgJson.c_str();
  }
  out += "],\"controllers\":[";
  for (size_t i = 0; i < controllers_.size(); ++i) {
    if (i) out += ',';
    out += controllers_[i]->cfgJson.c_str();
  }
  out += "]}";
  return out;
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
