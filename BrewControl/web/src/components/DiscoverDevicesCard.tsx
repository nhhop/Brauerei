import { useRef, useState } from 'preact/hooks';
import { Cpu, Gauge, Search, Zap } from 'lucide-preact';
import type { ConfigSnapshot, DiscoveredItem, DiscoveredPeer } from '../types';
import { discoverPeers, discoverRemote, getConfig, pairPeer, scanOneWireBus } from '../api';
import { btnSecondary, inp } from '../ui';
import { SettingsCard } from './SettingsCard';
import { Spinner } from './Spinner';
import type { ItemPrefill } from '../itemTypes';

// Asks every source at once what is out there — the remote transports, the
// OneWire buses of the already-configured DS18B20 sensors, and (via mDNS) other
// boards on the LAN. Results expand the card in place (same shape as the WLAN
// scan in NetworkPage); a hit opens the add dialog prefilled.
//
// Boards and items are two stages: a board found via mDNS is not yet talking to
// us, so it gets a "Koppeln" button that hands it our hub URL. It reboots,
// connects, and its items then show up under WebSocket on the next scan.

type Transport = 'mqtt' | 'espnow' | 'websocket';
const TRANSPORT_LABEL: Record<Transport, string> = {
  mqtt: 'MQTT', espnow: 'ESP-NOW', websocket: 'WebSocket',
};

interface FoundItem {
  key: string;
  label: string;   // mono identifier
  meta: string;
  kind: 'sensor' | 'actuator';
  known: boolean;
  prefill: ItemPrefill;
}

interface FoundGroup { key: string; title: string; items: FoundItem[] }

// A board found via mDNS. `paired` is derived from our own config, not reported
// by the firmware: an existing websocket item already names that device.
interface PeerRow extends DiscoveredPeer { paired: boolean }

const remoteKey = (transport: string, device: string, remoteId: string, channelKey: string) =>
  `${transport}|${device}|${remoteId}|${channelKey}`;

// What is already configured — so a hit can be marked instead of silently
// offering a duplicate.
function buildKnown(cfg: ConfigSnapshot) {
  const remote = new Set<string>();
  // Devices we already pull over the WebSocket hub — used to mark a found board
  // as paired without asking the firmware about it.
  const wsDevices = new Set<string>();
  for (const c of [...cfg.sensors, ...cfg.actuators]) {
    if (c.type !== 'Remote') continue;
    remote.add(remoteKey(String(c.transport ?? 'mqtt'), String(c.device ?? ''),
      String(c.remote_id ?? ''), String(c.channel_key ?? '')));
    if (c.transport === 'websocket') wsDevices.add(String(c.device ?? ''));
  }
  // A DS18B20 without an address claims the single device on its bus.
  const dsAddr = new Set<string>();
  const dsFlatPins = new Set<number>();
  for (const c of cfg.sensors) {
    if (c.type !== 'DS18B20') continue;
    const pin = Number(c.pin);
    const addr = String(c.address ?? '');
    if (addr) dsAddr.add(`${pin}|${addr}`); else dsFlatPins.add(pin);
  }
  return { remote, wsDevices, dsAddr, dsFlatPins };
}

export function DiscoverDevicesCard({ onPick }: {
  onPick: (p: ItemPrefill) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [scanned, setScanned] = useState(false);
  const [groups, setGroups] = useState<FoundGroup[]>([]);
  const [peers, setPeers] = useState<PeerRow[]>([]);
  const [notes, setNotes] = useState<string[]>([]);
  // Host whose password the target board asked for (401), plus the input value.
  const [askHost, setAskHost] = useState<string | null>(null);
  const [askPw, setAskPw] = useState('');
  const [pairing, setPairing] = useState<string | null>(null);
  const runId = useRef(0);

  async function runScan() {
    const my = ++runId.current;
    const mine = () => runId.current === my;
    const push = (g: FoundGroup) => { if (mine() && g.items.length) setGroups((p) => [...p, g]); };
    const note = (s: string) => { if (mine()) setNotes((p) => [...p, s]); };

    setBusy(true); setGroups([]); setPeers([]); setNotes([]);
    setAskHost(null); setAskPw('');

    let cfg: ConfigSnapshot | null = null;
    try {
      cfg = await getConfig();
    } catch {
      note('Konfiguration nicht lesbar — OneWire-Busse werden übersprungen, '
        + 'bereits angelegte Geräte sind nicht markiert.');
    }
    const known = cfg ? buildKnown(cfg) : null;

    // Transports and the mDNS browse poll independently (1 Hz each, ~16 s worst
    // case); the OneWire pins run as one sequential chain because /api/bus/scan
    // walks the bus inside the async handler. Each source renders as it lands.
    await Promise.allSettled([
      scanTransport('mqtt'),
      scanTransport('espnow'),
      scanTransport('websocket'),
      scanPeers(),
      scanOneWire(),
    ]);
    if (mine()) { setBusy(false); setScanned(true); }

    async function scanTransport(transport: Transport) {
      let items: DiscoveredItem[];
      try {
        items = await discoverRemote(transport);
      } catch (e) {
        // 409 = transport not enabled on this device; nothing to report.
        if (/^Error: 409\b/.test(String(e))) return;
        note(`${TRANSPORT_LABEL[transport]}: ${String(e).replace(/^Error: /, '')}`);
        return;
      }
      const byDevice = new Map<string, DiscoveredItem[]>();
      for (const it of items) {
        const list = byDevice.get(it.device) ?? [];
        list.push(it);
        byDevice.set(it.device, list);
      }
      for (const [device, list] of byDevice) {
        push({
          key: `${transport}|${device}`,
          title: `${TRANSPORT_LABEL[transport]} · ${device}`,
          items: list.map((it) => ({
            key: `${transport}|${it.prefix}|${it.id}|${it.channel_key}`,
            label: it.channel_key ? `${it.id}/${it.channel_key}` : it.id,
            meta: [it.quantity !== 'None' ? it.quantity : '', it.unit].filter(Boolean).join(' · '),
            kind: it.kind,
            known: known?.remote.has(remoteKey(transport, it.device, it.id, it.channel_key)) ?? false,
            prefill: {
              role: it.kind, type: 'Remote', transport, device: it.device,
              remoteId: it.id, prefix: it.prefix, channelKey: it.channel_key,
              id: it.channel_key ? `${it.id}_${it.channel_key}` : it.id,
            },
          })),
        });
      }
    }

    async function scanPeers() {
      let found: DiscoveredPeer[];
      try {
        found = await discoverPeers();
      } catch (e) {
        note(`Netzwerk-Suche: ${String(e).replace(/^Error: /, '')}`);
        return;
      }
      if (!mine()) return;
      setPeers(found.map((p) => ({
        ...p,
        paired: known?.wsDevices.has(p.device) ?? false,
      })));
    }

    async function scanOneWire() {
      if (!cfg) return;
      const pins = [...new Set(cfg.sensors
        .filter((c) => c.type === 'DS18B20')
        .map((c) => Number(c.pin))
        .filter(Number.isInteger))];
      for (const pin of pins) {
        if (!mine()) return;
        let devices;
        try {
          devices = (await scanOneWireBus(pin)).devices;
        } catch (e) {
          note(`OneWire GPIO ${pin}: ${String(e).replace(/^Error: /, '')}`);
          continue;
        }
        push({
          key: `onewire|${pin}`,
          title: `OneWire GPIO ${pin}`,
          items: devices.map((d) => ({
            key: `onewire|${pin}|${d.address}`,
            label: d.address.match(/.{2}/g)!.join(':'),
            meta: 'Temperatur · °C',
            kind: 'sensor' as const,
            known: (known?.dsAddr.has(`${pin}|${d.address}`) ?? false)
              || ((known?.dsFlatPins.has(pin) ?? false) && devices!.length === 1),
            prefill: {
              role: 'sensor' as const, type: 'DS18B20' as const, pin,
              address: d.address, id: `ds18b20_${d.address.slice(-4)}`,
            },
          })),
        });
      }
    }
  }

  // Hands our hub URL to `p` so it dials in. Addressed by IP — it is right
  // there in the mDNS answer and needs no second name resolution; the URL the
  // board *stores* is our .local name, which is what survives a DHCP change.
  async function pair(p: PeerRow, password?: string) {
    setPairing(p.hostname);
    try {
      const r = await pairPeer(p.ip || `${p.hostname}.local`, password);
      if (r.code === 401) { setAskHost(p.hostname); setAskPw(''); return; }
      setAskHost(null);
      setNotes((n) => [...n, `${p.hostname}: ${r.message ?? `HTTP ${r.code ?? '?'}`}`]);
      if (r.code === 200) {
        setPeers((ps) => ps.map((e) => (e.hostname === p.hostname ? { ...e, paired: true } : e)));
      }
    } catch (e) {
      setNotes((n) => [...n, `${p.hostname}: ${String(e).replace(/^Error: /, '')}`]);
    } finally {
      setPairing(null);
    }
  }

  const showBody = busy || scanned || notes.length > 0;

  return (
    <SettingsCard icon={Search} title="Geräte suchen"
      desc="Sucht Boards im Netz, fragt MQTT, ESP-NOW und WebSocket ab und scannt die bekannten OneWire-Busse."
      control={
        <button type="button" onClick={() => void runScan()} disabled={busy} class={btnSecondary}>
          {busy ? <><Spinner size={14} class="mr-1.5 -mt-0.5" />Suche…</> : 'Suchen'}
        </button>
      }>
      {showBody && (
        <div class="space-y-3">
          {peers.length > 0 && (
            <div>
              <div class="px-2 text-xs text-muted">Boards im Netz</div>
              <div class="-mx-2 mt-1 space-y-1">
                {peers.map((p) => (
                  <div key={p.hostname}>
                    <div class="flex w-full items-center gap-3 rounded-md px-2 py-2 text-sm">
                      <Cpu size={20} class="shrink-0 text-muted" />
                      <span class="min-w-0 flex-1">
                        <span class="block truncate font-mono text-xs font-medium text-fg">
                          {p.hostname}.local
                        </span>
                        <span class="block text-xs text-muted">
                          {[p.ip, p.device, p.ws_port > 0 ? 'eigener Hub' : '']
                            .filter(Boolean).join(' · ')}
                        </span>
                      </span>
                      {p.paired ? (
                        <span class="shrink-0 text-xs text-faint">gekoppelt</span>
                      ) : (
                        <button type="button" class={btnSecondary} disabled={pairing !== null}
                          onClick={() => void pair(p)}>
                          {pairing === p.hostname
                            ? <><Spinner size={14} class="mr-1.5 -mt-0.5" />Koppeln…</>
                            : 'Koppeln'}
                        </button>
                      )}
                    </div>
                    {askHost === p.hostname && (
                      <div class="flex items-center gap-2 px-2 pb-2">
                        <input type="password" value={askPw} class={inp}
                          placeholder="Passwort dieses Boards"
                          onInput={(e) => setAskPw((e.target as HTMLInputElement).value)} />
                        <button type="button" class={btnSecondary} disabled={pairing !== null}
                          onClick={() => void pair(p, askPw)}>Koppeln</button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {groups.map((g) => (
            <div key={g.key}>
              <div class="px-2 text-xs text-muted">{g.title}</div>
              <div class="-mx-2 mt-1 space-y-1">
                {g.items.map((it) => {
                  const Icon = it.kind === 'sensor' ? Gauge : Zap;
                  return (
                    <button key={it.key} type="button" onClick={() => onPick(it.prefill)}
                      class="flex w-full items-center gap-3 rounded-md px-2 py-2 text-left text-sm transition-colors hover:bg-subtle-hover active:bg-subtle-pressed">
                      <Icon size={20} class="shrink-0 text-muted" />
                      <span class="min-w-0 flex-1">
                        <span class="block truncate font-mono text-xs font-medium text-fg">{it.label}</span>
                        <span class="block text-xs text-muted">
                          {it.kind === 'sensor' ? 'Sensor' : 'Aktor'}{it.meta && ` · ${it.meta}`}
                        </span>
                      </span>
                      {it.known && <span class="shrink-0 text-xs text-faint">bereits angelegt</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          {scanned && !busy && groups.length === 0 && peers.length === 0 && (
            <p class="text-sm text-caution">
              Nichts gefunden — Remote-Geräte müssen per MQTT, ESP-NOW oder WebSocket
              veröffentlichen (gleicher Broker bzw. Kanal, aktuelle Firmware). Boards im
              Netz erscheinen nur, wenn sie per mDNS erreichbar sind; für WebSocket muss
              hier zusätzlich der Hub aktiv sein (Einstellungen → Konnektivität →
              WebSocket). OneWire-Busse werden nur an bereits konfigurierten Pins
              durchsucht — für einen neuen Pin über „+ Hinzufügen“ einen DS18B20 anlegen
              und dort scannen.
            </p>
          )}

          {notes.map((n) => <p key={n} class="text-sm text-caution">{n}</p>)}
        </div>
      )}
    </SettingsCard>
  );
}
