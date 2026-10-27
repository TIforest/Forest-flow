import assert from 'node:assert/strict';
import { randomBytes, pbkdf2Sync } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
const base = process.env.TEST_BASE_URL || 'http://127.0.0.1:5183';
const password = randomBytes(4).toString('hex'),
  salt = randomBytes(32).toString('hex');
const hash = pbkdf2Sync(password, salt, 100000, 32, 'sha256').toString('hex');
function sql(command) {
  return JSON.parse(
    execFileSync(
      process.execPath,
      [
        resolve('node_modules/wrangler/bin/wrangler.js'),
        'd1',
        'execute',
        'DB',
        '--local',
        '--json',
        '--command',
        command,
      ],
      { encoding: 'utf8' },
    ),
  );
}
let cookie = '';
async function request(path, method = 'GET', body) {
  const response = await fetch(base + path, {
    method,
    headers: {
      Origin: base,
      Connection: 'close',
      ...(cookie ? { Cookie: cookie } : {}),
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (response.headers.get('set-cookie'))
    cookie = response.headers.get('set-cookie').split(';')[0];
  return { status: response.status, body: await response.json() };
}
const existing = sql('SELECT count(*) AS n FROM team_credentials;')[0]
  .results[0].n;
assert.equal(
  existing,
  0,
  'Use um banco local sem credencial compartilhada para este teste.',
);
sql(
  `INSERT INTO team_credentials VALUES ('ti@forest.ind.br','${salt}','${hash}');`,
);
sql(
  "INSERT INTO users(id,name,role,job,color) VALUES ('shared-test-member','Teste colaborador','member','TI','#2869bc'),('shared-test-coord','Teste coordenador','coordinator','TI','#245940');",
);
try {
  assert.equal(
    (
      await request('/api/auth/login', 'POST', {
        email: 'ti@forest.ind.br',
        password: password.slice(0, 7),
      })
    ).status,
    400,
  );
  assert.equal((await request('/api/auth/profiles')).status, 401);
  assert.equal(
    (await request('/api/auth/profile', 'POST', { profileId: 'coord' })).status,
    401,
  );
  assert.equal(
    (
      await request('/api/auth/register', 'POST', {
        email: 'another@forest.ind.br',
        password,
      })
    ).status,
    410,
  );
  assert.equal(
    (
      await request('/api/auth/login', 'POST', {
        email: 'other@forest.ind.br',
        password,
      })
    ).status,
    401,
  );
  assert.equal(
    (
      await request('/api/auth/login', 'POST', {
        email: 'ti@forest.ind.br',
        password: 'incorrect-password',
      })
    ).status,
    401,
  );
  const login = await request('/api/auth/login', 'POST', {
    email: 'ti@forest.ind.br',
    password,
  });
  assert.equal(login.status, 200);
  assert.equal(login.body.user, null);
  assert.equal((await request('/api/users')).status, 401);
  const profiles = (await request('/api/auth/profiles')).body.profiles;
  assert.ok(profiles.length);
  assert.equal(
    (await request('/api/auth/profile', 'POST', { profileId: 'nonexistent' }))
      .status,
    400,
  );
  for (const profile of profiles.slice(0, 3)) {
    assert.equal(
      (await request('/api/auth/profile', 'POST', { profileId: profile.id }))
        .body.user.id,
      profile.id,
    );
    assert.equal((await request('/api/auth/me')).body.user.id, profile.id);
    assert.equal((await request('/api/users')).status, 200);
  }
  assert.equal(
    (await request('/api/auth/profile', 'POST', { profileId: null })).body.user,
    null,
  );
  assert.equal((await request('/api/users')).status, 401);
  await request('/api/auth/logout', 'POST', {});
  assert.equal((await request('/api/auth/me')).status, 401);
  console.log(
    'OK: login único, bloqueio sem perfil, seleção, troca, cadastro desativado e logout.',
  );
} finally {
  sql(
    `DELETE FROM team_sessions; DELETE FROM users WHERE id IN ('shared-test-member','shared-test-coord'); DELETE FROM team_credentials WHERE password_hash='${hash}';`,
  );
}
