import { SignJWT } from 'jose';
export const decode = (s: string) =>
  Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) =>
    c.charCodeAt(0),
  );
export const encode = (b: Uint8Array) =>
  btoa(String.fromCharCode(...b))
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
const concat = (...arrays: Uint8Array[]) => {
  const b = new Uint8Array(arrays.reduce((n, a) => n + a.length, 0));
  let i = 0;
  for (const a of arrays) {
    b.set(a, i);
    i += a.length;
  }
  return b;
};
const utf = (s: string) => new TextEncoder().encode(s);
async function hkdf(
  ikm: Uint8Array,
  salt: Uint8Array,
  info: Uint8Array,
  length: number,
) {
  const key = await crypto.subtle.importKey(
    'raw',
    ikm as BufferSource,
    'HKDF',
    false,
    ['deriveBits'],
  );
  return new Uint8Array(
    await crypto.subtle.deriveBits(
      {
        name: 'HKDF',
        hash: 'SHA-256',
        salt: salt as BufferSource,
        info: info as BufferSource,
      },
      key,
      length * 8,
    ),
  );
}
export function allowedPushEndpoint(value: string) {
  try {
    const u = new URL(value);
    return (
      u.protocol === 'https:' &&
      !u.port &&
      !u.username &&
      !u.password &&
      !u.hash &&
      value.length < 4096 &&
      (u.hostname === 'fcm.googleapis.com' ||
        u.hostname === 'updates.push.services.mozilla.com' ||
        u.hostname.endsWith('.notify.windows.com') ||
        u.hostname === 'web.push.apple.com' ||
        u.hostname.endsWith('.push.apple.com'))
    );
  } catch {
    return false;
  }
}
export async function pushRequest(
  subscription: { endpoint: string; p256dh: string; auth: string },
  payload: unknown,
  keys: { publicKey: string; privateKey: string },
) {
  if (!allowedPushEndpoint(subscription.endpoint))
    throw new Error('Invalid push endpoint');
  const ua = decode(subscription.p256dh),
    auth = decode(subscription.auth);
  if (ua.length !== 65 || ua[0] !== 4 || auth.length !== 16)
    throw new Error('Invalid subscription keys');
  const pair = await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveBits'],
  );
  const pub = new Uint8Array(
    await crypto.subtle.exportKey('raw', pair.publicKey),
  );
  const receiver = await crypto.subtle.importKey(
    'raw',
    ua as BufferSource,
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    [],
  );
  const secret = new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: 'ECDH', public: receiver },
      pair.privateKey,
      256,
    ),
  );
  const ikm = await hkdf(
    secret,
    auth,
    concat(utf('WebPush: info\0'), ua, pub),
    32,
  );
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const cek = await hkdf(ikm, salt, utf('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdf(ikm, salt, utf('Content-Encoding: nonce\0'), 12);
  const key = await crypto.subtle.importKey(
    'raw',
    cek as BufferSource,
    'AES-GCM',
    false,
    ['encrypt'],
  );
  const plain = concat(utf(JSON.stringify(payload)), new Uint8Array([2]));
  if (plain.length > 3000) throw new Error('Push payload too large');
  const encrypted = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: nonce as BufferSource },
      key,
      plain as BufferSource,
    ),
  );
  const vapid = decode(keys.publicKey);
  const signing = await crypto.subtle.importKey(
    'jwk',
    {
      kty: 'EC',
      crv: 'P-256',
      x: encode(vapid.slice(1, 33)),
      y: encode(vapid.slice(33)),
      d: keys.privateKey,
    },
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign'],
  );
  const jwt = await new SignJWT({ sub: 'mailto:ti@forest.ind.br' })
    .setProtectedHeader({ alg: 'ES256', typ: 'JWT' })
    .setAudience(new URL(subscription.endpoint).origin)
    .setExpirationTime(Math.floor(Date.now() / 1000) + 3600)
    .sign(signing);
  return {
    headers: {
      Authorization: `vapid t=${jwt}, k=${keys.publicKey}`,
      'Content-Type': 'application/octet-stream',
      'Content-Encoding': 'aes128gcm',
      TTL: '86400',
      Urgency: 'normal',
    },
    body: concat(
      salt,
      new Uint8Array([0, 0, 16, 0, pub.length]),
      pub,
      encrypted,
    ),
  };
}
