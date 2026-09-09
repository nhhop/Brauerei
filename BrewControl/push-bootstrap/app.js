// Subscribes this browser to Web Push on behalf of a BrewControl device and
// hands the result back to it.
//
// Why this page exists at all: pushManager.subscribe() and
// serviceWorker.register() are only available in a secure context, and the
// firmware serves plain http on the local network. This page runs on https,
// does the subscribing, and returns the subscription through a top-level
// redirect — https -> http is allowed for navigation, unlike a fetch.
//
// One VAPID keypair per installation, kept in this origin's localStorage and
// handed to every device that asks. A browser holds exactly one subscription
// per service-worker scope, bound to one applicationServerKey, so a key per
// device would need one static scope folder per device. A device that already
// knows a key passes it as ?k= — that is what makes this survive cleared
// browser data as long as one device is left standing.

const KEY_STORAGE = 'brewcontrol-vapid';

const statusEl = document.getElementById('status');
const detailEl = document.getElementById('detail');
const buttonEl = document.getElementById('go');
const iosEl = document.getElementById('ios-hint');

function show(state, text, detail) {
  statusEl.textContent = text;
  statusEl.className = 'status ' + state;
  detailEl.textContent = detail || '';
}

// ── base64url ───────────────────────────────────────────────────────────────

function toB64Url(bytes) {
  let s = '';
  for (const b of new Uint8Array(bytes)) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromB64Url(s) {
  const pad = s.replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(pad + '='.repeat((4 - (pad.length % 4)) % 4));
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

// ── return target ───────────────────────────────────────────────────────────

// Without this the page would be an open redirector: anyone could link to it
// with ?back=https://evil.example and bounce visitors off a github.io URL.
// Only plain-http addresses on the local network are accepted, which is the
// only thing a BrewControl device can ever be.
function validateBack(raw) {
  let url;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== 'http:') return null;
  const h = url.hostname;
  const isLocalName = !h.includes('.') || h.endsWith('.local');
  const isPrivateIp =
    /^10\./.test(h) ||
    /^192\.168\./.test(h) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(h) ||
    /^127\./.test(h);
  return isLocalName || isPrivateIp ? url : null;
}

// ── VAPID keypair ───────────────────────────────────────────────────────────

async function generateKeypair() {
  const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' },
                                               true, ['sign', 'verify']);
  // 'raw' on a P-256 public key is the 65-byte uncompressed point that
  // applicationServerKey wants; the JWK private 'd' is already base64url.
  const pub = await crypto.subtle.exportKey('raw', pair.publicKey);
  const jwk = await crypto.subtle.exportKey('jwk', pair.privateKey);
  return { publicKey: toB64Url(pub), privateKey: jwk.d };
}

function loadStoredKeypair() {
  try {
    const raw = localStorage.getItem(KEY_STORAGE);
    if (!raw) return null;
    const kp = JSON.parse(raw);
    return kp && kp.publicKey && kp.privateKey ? kp : null;
  } catch {
    return null;  // private mode, blocked storage — fall through to generating
  }
}

function storeKeypair(kp) {
  try {
    localStorage.setItem(KEY_STORAGE, JSON.stringify(kp));
  } catch {
    // Non-fatal: the device stores the pair too and passes it back as ?k=.
  }
}

// The device is the anchor: once it knows a key, every browser subscribes
// against that one, so all devices of an installation are served by the same
// subscription. Only the public half is needed to subscribe — signing happens
// on the device, which already holds the private half. Handing back a fresh
// pair instead would make the device drop every subscription it has, since a
// changed key invalidates them all.
//
// This browser's stored pair is used when it is the same key (then we can pass
// the private half along too, which costs nothing), and as the seed when the
// device has no key at all.
async function resolveKeypair(deviceKey) {
  const stored = loadStoredKeypair();
  if (deviceKey) {
    if (stored && stored.publicKey === deviceKey) return stored;
    return { publicKey: deviceKey, privateKey: null };
  }
  if (stored) return stored;
  const fresh = await generateKeypair();
  storeKeypair(fresh);
  return fresh;
}

// ── subscription ────────────────────────────────────────────────────────────

async function subscribe(keypair) {
  const reg = await navigator.serviceWorker.register('sw.js');
  await navigator.serviceWorker.ready;

  let sub = await reg.pushManager.getSubscription();
  if (sub) {
    // An existing subscription is welded to the key it was created with; if
    // that is not the key we are about to hand out, it has to go.
    const existing = sub.options && sub.options.applicationServerKey
      ? toB64Url(sub.options.applicationServerKey)
      : null;
    if (existing !== keypair.publicKey) {
      await sub.unsubscribe();
      sub = null;
    }
  }
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: fromB64Url(keypair.publicKey),
    });
  }
  const json = sub.toJSON();
  return { endpoint: sub.endpoint, p256dh: json.keys.p256dh, auth: json.keys.auth };
}

// ── flow ────────────────────────────────────────────────────────────────────

const params = new URLSearchParams(location.search);
const back = validateBack(params.get('back') || '');
const deviceKey = params.get('k') || null;

// iOS only delivers push to a page installed on the home screen, and there is
// no way to do that for the user — it has to be said out loud.
const isIos = /iP(hone|ad|od)/.test(navigator.userAgent);
if (isIos && !window.navigator.standalone) iosEl.hidden = false;

async function run() {
  buttonEl.disabled = true;
  show('busy', 'Wird eingerichtet …');
  try {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      throw new Error('Dieser Browser unterstützt keine Web-Benachrichtigungen.');
    }
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      throw new Error('Benachrichtigungen wurden abgelehnt. In den Browser-Einstellungen '
                      + 'für diese Seite wieder erlauben, dann erneut versuchen.');
    }

    const keypair = await resolveKeypair(deviceKey);
    const sub = await subscribe(keypair);

    const payload = {
      publicKey: keypair.publicKey,
      // Empty when the device supplied the key: it keeps the half it has.
      privateKey: keypair.privateKey || '',
      endpoint: sub.endpoint,
      p256dh: sub.p256dh,
      auth: sub.auth,
    };
    const encoded = toB64Url(new TextEncoder().encode(JSON.stringify(payload)));

    show('ok', 'Fertig — zurück zum Gerät …');
    back.hash = 'push=' + encoded;
    location.href = back.toString();
  } catch (err) {
    buttonEl.disabled = false;
    show('error', 'Das hat nicht geklappt', err && err.message ? err.message : String(err));
  }
}

if (!back) {
  buttonEl.hidden = true;
  show('error', 'Diese Seite direkt aufzurufen bringt nichts',
       'Sie wird vom BrewControl-Gerät aus geöffnet: Einstellungen → '
       + 'Benachrichtigungen → „Auf diesem Gerät aktivieren".');
} else {
  show('idle', 'Benachrichtigungen für ' + back.hostname,
       'Der Browser fragt gleich um Erlaubnis. Danach geht es automatisch zurück '
       + 'zum Gerät.');
  buttonEl.addEventListener('click', run);
}
