import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { execFileSync } from 'node:child_process';
const base = process.env.TEST_BASE_URL || 'http://127.0.0.1:5182';
const email = `signup-test-${randomBytes(6).toString('hex')}@forest.ind.br`;
const password = randomBytes(20).toString('hex');
let userId;
const reservedId = 'test-reserved-' + randomBytes(8).toString('hex');
const reservedEmail = reservedId + '@forest.ind.br';
function sql(command) {
  return execFileSync(
    process.execPath,
    [
      'node_modules/wrangler/bin/wrangler.js',
      'd1',
      'execute',
      'DB',
      '--local',
      '--command',
      command,
    ],
    { stdio: 'pipe', encoding: 'utf8' },
  );
}
async function call(path, body, cookie) {
  const r = await fetch(base + '/api/auth/' + path, {
    method: body === undefined ? 'GET' : 'POST',
    headers: {
      Origin: base,
      'Content-Type': 'application/json',
      Connection: 'close',
      'CF-Connecting-IP': 'signup-test-' + email,
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return {
    status: r.status,
    data: await r.json(),
    cookie: r.headers.get('Set-Cookie')?.split(';')[0],
  };
}
try {
  const config = await call('config');
  assert.equal(config.data.registrationEnabled, true);
  assert.equal(config.data.confirmationRequired, false);
  const draft = {
    email,
    password,
    name: 'Teste temporário do cadastro direto',
    job: 'Teste local',
    role: 'coordinator',
  };
  assert.equal(
    (await call('register', { ...draft, email: 'someone@example.com' })).status,
    400,
  );
  assert.equal(
    (await call('register', { ...draft, password: 'curta' })).status,
    400,
  );
  const registered = await call('register', draft);
  assert.equal(registered.status, 200);
  assert.ok(registered.cookie);
  userId = registered.data.user.id;
  assert.equal(registered.data.user.role, 'member');
  assert.ok(!JSON.stringify(registered.data).includes(password));
  assert.equal(
    (await call('me', undefined, registered.cookie)).data.user.id,
    userId,
  );
  assert.equal(
    (await call('register', { ...draft, password: 'other-password-123456' }))
      .status,
    409,
  );
  assert.equal((await call('login', { email, password })).status, 200);
  assert.equal(
    (await call('login', { email, password: 'other-password-123456' })).status,
    401,
  );
  assert.equal((await call('logout', {}, registered.cookie)).status, 200);
  assert.equal((await call('me', undefined, registered.cookie)).status, 401);
  for (const route of ['resend', 'verify', 'setup', 'activate'])
    assert.equal((await call(route, {})).status, 410);
  sql(
    `INSERT INTO users(id,name,role,job,color,registration_email) VALUES ('${reservedId}','Teste reservado','coordinator','Teste','#7751b5','${reservedEmail}');`,
  );
  assert.equal(
    (await call('register', { ...draft, email: reservedEmail })).status,
    403,
  );
  console.log(
    'Cadastro direto passou: acesso imediato, login, senha protegida, duplicidade, sessão, perfil de colaborador e fluxos antigos desativados. Sem serviço de envio.',
  );
} finally {
  let cleanup = `DELETE FROM users WHERE id='${reservedId}';`;
  if (userId && /^[a-f0-9-]{36}$/.test(userId))
    cleanup += `DELETE FROM sessions WHERE user_id='${userId}';DELETE FROM accounts WHERE user_id='${userId}';DELETE FROM users WHERE id='${userId}';`;
  sql(cleanup);
}
