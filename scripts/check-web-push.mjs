import assert from 'node:assert/strict';
import { build } from 'esbuild';
import {
  createECDH,
  generateKeyPairSync,
  randomBytes,
  hkdfSync,
  createDecipheriv,
} from 'node:crypto';
import { importJWK, jwtVerify } from 'jose';
const result = await build({
  entryPoints: ['worker/web-push.ts'],
  bundle: true,
  platform: 'node',
  format: 'esm',
  write: false,
});
const { pushRequest, allowedPushEndpoint } = await import(
  'data:text/javascript;base64,' +
    Buffer.from(result.outputFiles[0].text).toString('base64')
);
const receiver = createECDH('prime256v1');
receiver.generateKeys();
const ua = receiver.getPublicKey(),
  auth = randomBytes(16);
const vapid = generateKeyPairSync('ec', {
  namedCurve: 'prime256v1',
}).privateKey.export({ format: 'jwk' });
const publicKey = Buffer.concat([
  Buffer.from([4]),
  Buffer.from(vapid.x, 'base64url'),
  Buffer.from(vapid.y, 'base64url'),
]).toString('base64url');
const endpoint = 'https://fcm.googleapis.com/fcm/send/test-only';
const payload = {
  id: 'test-only',
  title: 'Forest Flow',
  body: 'Nova atividade',
};
const details = await pushRequest(
  {
    endpoint,
    p256dh: ua.toString('base64url'),
    auth: auth.toString('base64url'),
  },
  payload,
  { publicKey, privateKey: vapid.d },
);
const body = Buffer.from(details.body),
  salt = body.subarray(0, 16),
  server = body.subarray(21, 21 + body[20]);
assert.equal(body.readUInt32BE(16), 4096);
assert.equal(server.length, 65);
const secret = receiver.computeSecret(server);
const ikm = hkdfSync(
  'sha256',
  secret,
  auth,
  Buffer.concat([Buffer.from('WebPush: info\0'), ua, server]),
  32,
);
const cek = hkdfSync(
  'sha256',
  ikm,
  salt,
  Buffer.from('Content-Encoding: aes128gcm\0'),
  16,
);
const nonce = hkdfSync(
  'sha256',
  ikm,
  salt,
  Buffer.from('Content-Encoding: nonce\0'),
  12,
);
const encrypted = body.subarray(21 + body[20]);
const decipher = createDecipheriv('aes-128-gcm', cek, nonce);
decipher.setAuthTag(encrypted.subarray(-16));
const plaintext = Buffer.concat([
  decipher.update(encrypted.subarray(0, -16)),
  decipher.final(),
]);
assert.equal(plaintext.at(-1), 2);
assert.deepEqual(JSON.parse(plaintext.subarray(0, -1)), payload);
const jwt = details.headers.Authorization.match(/^vapid t=(.*), k=/)[1];
const key = await importJWK(
  { kty: 'EC', crv: 'P-256', x: vapid.x, y: vapid.y },
  'ES256',
);
const verified = await jwtVerify(jwt, key, {
  audience: new URL(endpoint).origin,
  algorithms: ['ES256'],
});
assert.equal(verified.payload.sub, 'mailto:ti@forest.ind.br');
for (const url of [
  'http://fcm.googleapis.com/a',
  'https://localhost/a',
  'https://fcm.googleapis.com.evil.test/a',
  'https://evil.test/a',
  'https://fcm.googleapis.com@evil.test/a',
  'https://fcm.googleapis.com:8443/a',
])
  assert.equal(allowedPushEndpoint(url), false, url);
console.log(
  'OK: Web Push RFC 8291 decrypted independently; VAPID signature/audience verified; unsafe endpoints rejected.',
);
