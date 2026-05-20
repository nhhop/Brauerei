# 09 — remote_espnow

Same demo shape as `08_remote_mqtt` but transported over ESP-Now: no WiFi
association, no MQTT broker, two ESP32s talk directly over 2.4 GHz
broadcast on a shared channel.

Wire format is identical to MQTT (same topic strings, same JSON payloads),
so the same `RemoteSensor` / `RemotePublisher` code works unchanged — only
the transport object is different.

## Build

```powershell
pio ci examples/09_remote_espnow/publisher --lib . --board esp32dev
pio ci examples/09_remote_espnow/consumer  --lib . --board esp32dev
```

## Run

1. Make sure both ESP32s use the same channel (default 1).
2. Flash `publisher.ino` (DS18B20 on GPIO4, SSR on GPIO16).
3. Flash `consumer.ino` (no peripherals).
4. Open Serial on both — consumer's `T_remote` should track the publisher's
   `T` within ~1 s after each side boots.

## Retain emulation

`RemoteSensor` / `RemoteActuator` on the consumer trigger a one-shot
`RetainedRequest` broadcast on the first subscribe. The publisher
responds by re-broadcasting its cached meta + state, so the consumer sees
units/range and last value immediately rather than waiting for the next
periodic publish.

## Packet budget

ESP-Now caps at 250 B per send. With our framing
(`[0x01][topic_len][topic][payload]`) and typical topics ~40 B + meta
JSON ~100 B, we're well inside the budget. If your topics grow longer,
keep meta payloads compact.
