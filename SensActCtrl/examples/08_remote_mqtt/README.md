# 08 — remote_mqtt

Two-node demo of the Phase-2 transport layer. Publisher owns a DS18B20 +
heater on `node-a`; consumer runs a PID controller on `node-b` that reads
the remote temperature and drives the remote heater. The consumer's
controller is itself published, so it can be retuned over MQTT.

## Build

```powershell
pio ci examples/08_remote_mqtt/publisher --lib . --board esp32dev
pio ci examples/08_remote_mqtt/consumer  --lib . --board esp32dev
```

## Run

1. Edit `kWifiSsid`/`kWifiPass`/`kMqttHost` in both sketches.
2. Flash `publisher.ino` onto one ESP32 (DS18B20 on GPIO4, SSR on GPIO16).
3. Flash `consumer.ino` onto a second ESP32 (no peripherals needed).
4. Start any MQTT broker (`mosquitto` works) reachable from both.

## Verify

```bash
mosquitto_sub -t 'sensactctrl/#' -v
```

- `sensactctrl/node-a/sensor/mash_temp/meta` (retained, on first publish)
- `sensactctrl/node-a/sensor/mash_temp` updates every second
- `sensactctrl/node-a/actuator/heater` reflects the consumer's setpoint
- `sensactctrl/node-b/controller/mash_ctrl/meta` (retained) shows current PID params

Retune the PID at runtime:

```bash
mosquitto_pub -t sensactctrl/node-b/controller/mash_ctrl/tune \
              -m '{"Kp":3.0,"Ki":0.05,"Kd":0.0,"setpoint":65}'
```

The consumer applies the new params and republishes `/meta` so any other
subscriber sees the update.
