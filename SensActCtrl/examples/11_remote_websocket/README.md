# 11 — remote_websocket

Same demo shape as `08_remote_mqtt`, `09_remote_espnow` and
`10_remote_webhook`, but transported over one persistent WebSocket
connection per publisher. No broker, no per-publish HTTP request.

**Roles:** the consumer is the hub and runs the WebSocket server; the
publisher is a client and dials out to it. The hub never needs to know the
publisher's address, and several publishers can connect to the same hub.
Data flows both ways over the connection — state/meta towards the hub,
`/set` commands back to the publisher.

Wire format of the payloads is identical to MQTT/ESP-Now/Webhook (same topic
strings, same JSON payloads). Each message is one WebSocket text frame:

| Frame                 | Meaning                                   |
|-----------------------|-------------------------------------------|
| `D<topic>\n<payload>` | Data                                      |
| `R`                   | Retained-Request: "send your retained cache" |

## Build

Depends on `links2004/WebSockets` (pulled in via the library's
`library.json`). The library needs C++17 (`pio ci` defaults to gnu++11).

```powershell
pio ci examples/11_remote_websocket/publisher --lib . --board esp32dev -O "build_flags=-std=gnu++17 -DWEBSOCKETS_TCP_TIMEOUT=1000" -O "build_unflags=-std=gnu++11"
pio ci examples/11_remote_websocket/consumer  --lib . --board esp32dev -O "build_flags=-std=gnu++17 -DWEBSOCKETS_TCP_TIMEOUT=1000" -O "build_unflags=-std=gnu++11"
```

## Run

1. Edit `kWifiSsid`/`kWifiPass` in both sketches and point the publisher's
   `kServerUrl` at the consumer's `ws://<ip>:8081`.
2. Flash `consumer.ino` (no peripherals).
3. Flash `publisher.ino` (DS18B20 on GPIO4, SSR on GPIO16).
4. Open Serial on both — the consumer shows `clients=1` and its `T_remote`
   tracks the publisher's `T` within ~1 s after the connection is up.

## Retain emulation

Both sides cache their retained payloads. Whoever has subscriptions sends a
Retained-Request on every new connection and after `subscribe()` (coalesced
to one per `tick()`); the other side answers with its whole retained cache.
A `RemoteSensor` created on the hub while the publisher is already connected
therefore gets meta + state immediately — analogous to MQTT's retained
messages and to ESP-Now's `RetainedRequest` broadcast.

## Limits

- **Blocking connect:** while the hub is unreachable, the publisher's TCP
  connect blocks `tick()` for up to `WEBSOCKETS_TCP_TIMEOUT` (library default
  5000 ms), once every 5 s. Lower it via build flag as shown above.
- **Hostnames:** a `.local` hostname in the URL is resolved on every connect
  attempt, which can block as well — prefer an IP address.
- **Clients per hub:** at most `WEBSOCKETS_SERVER_CLIENT_MAX` (library
  default 5).
- **No relaying:** the hub doesn't forward one publisher's messages to
  another publisher — it is not a broker.
- **No authentication, no TLS** (`wss://` is rejected): anyone on the LAN can
  connect to the hub.
