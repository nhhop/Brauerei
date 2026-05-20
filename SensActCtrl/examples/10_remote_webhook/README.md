# 10 — remote_webhook

Same demo shape as `08_remote_mqtt` and `09_remote_espnow`, but transported
over plain HTTP webhooks. Each node runs a tiny `WebServer` on a chosen port
and POSTs publishes to the peer's URL. No broker, no ESP-Now channel — both
ESP32s just need to be reachable on the same LAN.

Wire format is identical to MQTT/ESP-Now (same topic strings, same JSON
payloads); the URL path carries the topic, the body carries the payload.

## Build

```powershell
pio ci examples/10_remote_webhook/publisher --lib . --board esp32dev
pio ci examples/10_remote_webhook/consumer  --lib . --board esp32dev
```

## Run

1. Edit `kWifiSsid`/`kWifiPass` and the peer URLs in both sketches so each
   side points at the other's `http://<ip>:8080`.
2. Flash `publisher.ino` (DS18B20 on GPIO4, SSR on GPIO16).
3. Flash `consumer.ino` (no peripherals).
4. Open Serial on both — consumer's `T_remote` should track the publisher's
   `T` within ~1 s after each side boots.

## Endpoints

Each node exposes:

| Method | Path        | Purpose                                              |
|--------|-------------|------------------------------------------------------|
| POST   | `/<topic>`  | Receive a publish from the peer; body = payload      |
| GET    | `/<topic>`  | Return the last cached retained payload (or 404)     |

Examples:

```bash
# Inspect the publisher's last retained meta:
curl http://<publisher-ip>:8080/sensactctrl/node-a/sensor/mash_temp/meta

# Inject a tune update into the consumer's PID:
curl -X POST http://<consumer-ip>:8080/sensactctrl/node-b/controller/mash_ctrl/tune \
     -H 'Content-Type: application/json' \
     -d '{"Kp":3.0,"Ki":0.05,"Kd":0.0,"setpoint":65}'
```

## Retain emulation

Subscribes (e.g. `RemoteSensor::begin()`) enqueue a one-shot GET against the
peer's `/<topic>` for both the state and meta topics. `tick()` drains the
queue: on success the response body is dispatched into the local subscriber
exactly as if it had arrived via POST. This gives late subscribers a quick
path to current meta + state — analogous to MQTT's retained messages and to
ESP-Now's `RetainedRequest` broadcast.

## Limits

- `HTTPClient::POST` is blocking; publish latency depends on the peer's
  response time. Cadence is fine for brewing-rate state (~1 Hz) but not for
  high-frequency telemetry.
- `WebServer` (sync) is fine for this load; if you stack many simultaneous
  publishers/consumers on one node, swap in `ESPAsyncWebServer` instead.
- No reconnect logic in the transport — `connected()` reflects WiFi only.
  Recovering from a peer being offline happens naturally (the next
  publish/GET succeeds once it's back).
