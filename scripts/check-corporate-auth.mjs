import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { build } from 'esbuild';
import { SignJWT, generateKeyPair, exportJWK } from 'jose';
import {
  readdirSync,
  readFileSync,
  mkdtempSync,
  rmSync,
  rmdirSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
const temporary = mkdtempSync(join(tmpdir(), 'forest-auth-check-'));
const bundle = join(temporary, 'worker.mjs');
await build({
  stdin: {
    contents: `export {default} from './worker/index.ts'; export {ADMIN_OBJECT,ADMIN_TENANT} from './worker/auth.ts'; export {deliverNotifications} from './worker/notifications.ts';`,
    resolveDir: process.cwd(),
  },
  bundle: true,
  platform: 'node',
  format: 'esm',
  outfile: bundle,
  logLevel: 'silent',
});
const {
  default: worker,
  ADMIN_OBJECT,
  ADMIN_TENANT,
  deliverNotifications,
} = await import(pathToFileURL(bundle));
const sqlite = new DatabaseSync(':memory:');
const files = readdirSync('migrations')
  .filter((f) => f.endsWith('.sql'))
  .sort();
for (const f of files.filter((f) => parseInt(f, 10) < 11))
  sqlite.exec(readFileSync(join('migrations', f), 'utf8'));
sqlite.exec(`INSERT INTO users(id,name,role,job,color,registration_email) VALUES('legacy','Perfil histórico','coordinator','TI','#c1b4ee','bruno.rech@forest.ind.br');
INSERT INTO tasks(id,title,assignee_id,created_by,week,priority,status,checklist) VALUES('historical-task','Preservar histórico','legacy','legacy','2026-10-25','normal','progress','[{"id":"stage","text":"Etapa","done":false}]');
INSERT INTO task_weeks(task_id,week,added_by) VALUES('historical-task','2026-10-25','legacy'),('historical-task','2026-11-01','legacy');
INSERT INTO comments(id,task_id,author_id,body) VALUES('old-comment','historical-task','legacy','Comentário antigo');
INSERT INTO events(id,task_id,actor_id,message) VALUES('old-event','historical-task','legacy','Histórico antigo');`);
const snapshot = () =>
  JSON.stringify(
    ['tasks', 'events', 'comments', 'task_weeks', 'task_assignees'].map((t) =>
      sqlite
        .prepare('SELECT * FROM ' + t)
        .all()
        .map(({ workspace_id, title_key, ...row }) => row),
    ),
  );
const before = snapshot();
sqlite.exec(readFileSync('migrations/0011_corporate_identity.sql', 'utf8'));
for (const f of files.filter((f) => parseInt(f, 10) > 11))
  sqlite.exec(readFileSync(join('migrations', f), 'utf8'));
assert.equal(snapshot(), before);
assert.equal(
  sqlite.prepare('SELECT workspace_id FROM tasks').get().workspace_id,
  'ti',
);
class Statement {
  constructor(sql, args = []) {
    this.sql = sql;
    this.args = args;
  }
  bind(...args) {
    return new Statement(this.sql, args);
  }
  async first(column) {
    const row = sqlite.prepare(this.sql).get(...this.args) || null;
    return column ? (row?.[column] ?? null) : row;
  }
  async all() {
    return {
      results: sqlite.prepare(this.sql).all(...this.args),
      success: true,
    };
  }
  async run() {
    return { success: true, meta: sqlite.prepare(this.sql).run(...this.args) };
  }
}
const DB = {
  prepare: (sql) => new Statement(sql),
  async batch(statements) {
    sqlite.exec('BEGIN');
    try {
      const rows = [];
      for (const s of statements) rows.push(await s.run());
      sqlite.exec('COMMIT');
      return rows;
    } catch (e) {
      sqlite.exec('ROLLBACK');
      throw e;
    }
  },
};
const env = {
  DB,
  ENTRA_TENANT_ID: ADMIN_TENANT,
  ENTRA_CLIENT_ID: '98042fb3-4213-4b41-88fd-9587d2726d29',
  ENTRA_CLIENT_SECRET: 'test-only-secret',
  ENTRA_REDIRECT_URI: 'http://localhost:5180/api/auth/microsoft/callback',
};
const origin = 'http://localhost:5180';
const hash = (s) => createHash('sha256').update(s).digest('hex');
const { privateKey, publicKey } = await generateKeyPair('RS256');
const jwk = await exportJWK(publicKey);
jwk.kid = 'test-key';
jwk.alg = 'RS256';
jwk.use = 'sig';
let claims = {},
  profile = {},
  tokenNonce = '',
  tamper = false;
const originalFetch = globalThis.fetch;
const photoBytes = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a5QAAAABJRU5ErkJggg==',
  'base64',
);
let photoMode = 'valid';
let pushCalls = 0,
  pushStatus = 201;
globalThis.fetch = async (input, init) => {
  const url = String(input);
  if (url.startsWith('https://fcm.googleapis.com/fcm/send/')) {
    assert.equal(
      init.redirect,
      'manual',
      'Cloudflare Workers does not support redirect:error',
    );
    pushCalls++;
    return new Response(null, { status: pushStatus });
  }
  if (url === 'https://graph.microsoft.com/v1.0/me/photos/96x96/$value') {
    assert.equal(init.headers.Authorization, 'Bearer test-access-token');
    if (photoMode === 'missing') return new Response(null, { status: 404 });
    if (photoMode === 'failure') return new Response(null, { status: 503 });
    if (photoMode === 'html') return new Response('<svg onload="alert(1)"/>');
    if (photoMode === 'oversized') return new Response(new Uint8Array(65537));
    return new Response(photoBytes, {
      headers: { 'Content-Type': 'image/png' },
    });
  }
  if (url.endsWith('/keys')) return Response.json({ keys: [jwk] });
  if (url.endsWith('/token')) {
    if (claims.test_token_error)
      return Response.json(
        {
          error: 'invalid_client',
          error_description:
            'AADSTS7000215: Invalid secret. PRIVATE_SENTINEL_NEVER_LOG',
        },
        { status: 401 },
      );
    assert.equal(
      new URLSearchParams(init.body).get('client_secret'),
      'test-only-secret',
    );
    assert.ok(new URLSearchParams(init.body).get('code_verifier'));
    const now = Math.floor(Date.now() / 1000);
    let jwt = await new SignJWT({
      tid: ADMIN_TENANT,
      oid: profile.id,
      nonce: tokenNonce,
      iss: `https://login.microsoftonline.com/${ADMIN_TENANT}/v2.0`,
      aud: env.ENTRA_CLIENT_ID,
      sub: 'test-sub',
      iat: now,
      exp: now + 300,
      ...claims,
    })
      .setProtectedHeader({ alg: 'RS256', kid: 'test-key' })
      .sign(privateKey);
    if (tamper) jwt = jwt.slice(0, -10) + 'AAAAAAAAAA';
    return Response.json({
      access_token: 'test-access-token',
      token_type: 'Bearer',
      expires_in: 300,
      id_token: jwt,
    });
  }
  if (url.startsWith('https://graph.microsoft.com/v1.0/me?'))
    return Response.json(profile);
  throw new Error('Unexpected network call ' + url);
};
async function call(
  path,
  { method = 'GET', cookie = '', workspace = 'ti', body, extra = {} } = {},
) {
  const headers = {
    Origin: origin,
    'Content-Type': 'application/json',
    'X-Workspace-Id': workspace,
    ...extra,
  };
  if (cookie) headers.Cookie = cookie;
  const r = await worker.fetch(
    new Request(origin + path, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
    env,
  );
  let data;
  try {
    data = await r.clone().json();
  } catch {}
  return { r, status: r.status, data };
}
async function begin() {
  const result = await call('/api/auth/microsoft/start');
  assert.equal(result.status, 302);
  const location = new URL(result.r.headers.get('Location'));
  tokenNonce = location.searchParams.get('nonce');
  assert.equal(location.searchParams.get('code_challenge_method'), 'S256');
  assert.equal(location.pathname, `/${ADMIN_TENANT}/oauth2/v2.0/authorize`);
  return {
    state: location.searchParams.get('state'),
    cookie: result.r.headers.get('Set-Cookie').split(';')[0],
  };
}
async function login(oid, email, options = {}) {
  profile = {
    id: oid,
    displayName: 'Pessoa ' + oid,
    mail: email,
    userPrincipalName: email,
    userType: 'Member',
    jobTitle: 'Analista',
    ...options.profile,
  };
  claims = options.claims || {};
  tamper = !!options.tamper;
  const started = await begin();
  const result = await call(
    '/api/auth/microsoft/callback?state=' + started.state + '&code=test-code',
    { cookie: started.cookie },
  );
  if (options.reject) {
    assert.ok(
      result.r.headers.get('Location').startsWith('/?login=failed&reason='),
    );
    assert.equal(
      result.r.headers.get('Set-Cookie').includes('forest_corporate='),
      false,
    );
    return;
  }
  assert.equal(result.r.headers.get('Location'), '/?login=success');
  const match = result.r.headers
    .get('Set-Cookie')
    .match(/forest_corporate=([^; ,]+)/);
  assert.ok(match);
  const replay = await call(
    '/api/auth/microsoft/callback?state=' + started.state + '&code=test-code',
    { cookie: started.cookie },
  );
  assert.ok(
    replay.r.headers
      .get('Location')
      .startsWith('/?login=failed&reason=session'),
  );
  return 'forest_corporate=' + match[1];
}
try {
  const memberOid = '11111111-1111-4111-8111-111111111111';
  for (const options of [
    { claims: { tid: 'wrong-tenant' } },
    { claims: { aud: 'other-app' } },
    { claims: { iss: 'https://attacker.invalid' } },
    { claims: { nonce: 'bad' } },
    { claims: { exp: 1 } },
    { tamper: true },
    { profile: { userType: 'Guest' } },
    { claims: { idp: 'live.com' } },
    { profile: { id: 'different-oid' }, claims: { oid: memberOid } },
  ])
    await login(memberOid, 'person@forest.ind.br', {
      ...options,
      reject: true,
    });
  await login(memberOid, 'person@forest.ind.br', {
    claims: { test_token_error: true },
    reject: true,
  });
  const diagnostic = sqlite
    .prepare('SELECT * FROM auth_login_failures ORDER BY rowid DESC LIMIT 1')
    .get();
  assert.equal(diagnostic.stage, 'token_validation');
  assert.equal(diagnostic.provider_code, 'AADSTS7000215');
  assert.ok(
    !JSON.stringify(
      sqlite.prepare('SELECT * FROM auth_login_failures').all(),
    ).includes('PRIVATE_SENTINEL_NEVER_LOG'),
  );
  const started = await begin();
  const wrongBrowser = await call(
    '/api/auth/microsoft/callback?state=' + started.state + '&code=x',
    { cookie: 'forest_oauth=' + 'a'.repeat(43) },
  );
  assert.ok(
    wrongBrowser.r.headers
      .get('Location')
      .startsWith('/?login=failed&reason=session'),
  );
  const admin = await login(ADMIN_OBJECT, 'bruno.rech@forest.ind.br');
  let me = await call('/api/auth/me', { cookie: admin });
  assert.equal(me.data.user.is_admin, 1);
  assert.notEqual(me.data.user.id, 'legacy');
  const adminId = me.data.user.id;
  const expectedPhoto =
    'data:image/png;base64,' + photoBytes.toString('base64');
  assert.equal(me.data.user.microsoft_photo, expectedPhoto);
  for (const mode of ['failure', 'html', 'oversized']) {
    photoMode = mode;
    await login(ADMIN_OBJECT, 'bruno.rech@forest.ind.br');
    assert.equal(
      (await call('/api/auth/me', { cookie: admin })).data.user.microsoft_photo,
      expectedPhoto,
    );
  }
  photoMode = 'missing';
  await login(ADMIN_OBJECT, 'bruno.rech@forest.ind.br');
  assert.equal(
    (await call('/api/auth/me', { cookie: admin })).data.user.microsoft_photo,
    null,
  );
  photoMode = 'valid';
  await login(ADMIN_OBJECT, 'bruno.rech@forest.ind.br');
  assert.equal(
    (
      await call('/api/auth/login', {
        method: 'POST',
        body: { email: 'ti@forest.ind.br', password: 'oldpassword' },
      })
    ).status,
    410,
  );
  assert.equal(
    (
      await call('/api/auth/profile', {
        method: 'POST',
        cookie: admin,
        body: { profileId: 'legacy' },
      })
    ).status,
    410,
  );
  const spoof = await login(memberOid, 'bruno.rech@forest.ind.br');
  me = await call('/api/auth/me', { cookie: spoof });
  assert.equal(me.data.user.is_admin, 0);
  assert.equal(me.data.user.access_status, 'pending');
  const memberId = me.data.user.id;
  assert.equal(
    (await call('/api/tasks?week=2026-10-25', { cookie: spoof })).status,
    403,
  );
  assert.equal((await call('/api/admin/state', { cookie: spoof })).status, 403);
  const post = (path, body, cookie = admin, workspace = 'ti') =>
    call('/api/' + path, { method: 'POST', cookie, workspace, body });

  assert.equal(
    (await post('admin/access', { user_id: memberId, status: 'active' }))
      .status,
    409,
  );
  const form = {
    name: 'Pessoa de teste revisada',
    job: 'Analista',
    department: 'Financeiro',
    unit: 'Unidade 1',
    notes: 'Pedido de acesso ao planejamento',
    is_admin: 1,
    role: 'coordinator',
    user_id: adminId,
  };
  assert.equal((await post('auth/onboarding', form, '')).status, 401);
  assert.equal(
    (await post('auth/onboarding', { ...form, name: '' }, spoof)).status,
    400,
  );
  assert.equal((await post('auth/onboarding', form, spoof)).status, 201);
  assert.equal(
    (
      await call('/api/notifications', { cookie: admin })
    ).data.notifications.filter((n) => n.kind === 'access_request').length,
    1,
  );
  assert.equal(
    (
      await call('/api/notifications', { cookie: spoof })
    ).data.notifications.some((n) => n.kind === 'access_request'),
    false,
  );
  me = await call('/api/auth/me', { cookie: spoof });
  assert.equal(me.data.user.access_status, 'pending');
  assert.equal(me.data.user.is_admin, 0);
  assert.equal(me.data.onboarding.name, form.name);
  assert.equal(
    sqlite
      .prepare('SELECT count(*) n FROM workspace_memberships WHERE user_id=?')
      .get(memberId).n,
    0,
  );
  assert.equal((await post('auth/onboarding', form, spoof)).status, 409);
  assert.equal(
    (
      await post(
        'admin/review',
        {
          user_id: memberId,
          decision: 'approve',
          workspace_id: 'ti',
          role: 'coordinator',
          note: '',
        },
        spoof,
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await post('admin/review', {
        user_id: memberId,
        decision: 'reject',
        note: '',
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await post('admin/review', {
        user_id: memberId,
        decision: 'reject',
        note: 'Confira seu cargo',
      })
    ).status,
    200,
  );
  me = await call('/api/auth/me', { cookie: spoof });
  assert.equal(me.data.onboarding.review_note, 'Confira seu cargo');
  assert.equal(me.data.onboarding.status, 'rejected');
  assert.equal((await post('auth/onboarding', form, spoof)).status, 201);
  assert.equal(
    (
      await post('admin/review', {
        user_id: memberId,
        decision: 'approve',
        workspace_id: 'missing',
        role: 'member',
        note: '',
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await post('admin/review', {
        user_id: memberId,
        decision: 'approve',
        workspace_id: 'ti',
        role: 'member',
        note: 'Dados conferidos',
      })
    ).status,
    200,
  );
  me = await call('/api/auth/me', { cookie: spoof });
  assert.equal(me.data.user.access_status, 'active');
  assert.equal(me.data.user.name, form.name);
  assert.equal(me.data.user.job, form.job);
  assert.equal(me.data.user.is_admin, 0);
  assert.equal(me.data.user.onboarding_required, 0);
  assert.equal(me.data.workspaces[0].role, 'member');
  assert.equal(
    (
      await post('admin/review', {
        user_id: memberId,
        decision: 'reject',
        note: 'Decisão atrasada',
      })
    ).status,
    409,
  );
  assert.equal((await post('auth/onboarding', form, spoof)).status, 403);
  assert.equal(
    (
      await post('admin/membership', {
        user_id: memberId,
        workspace_id: 'ti',
        role: 'remove',
      })
    ).status,
    200,
  );
  assert.equal(
    (await post('admin/workspace', { name: 'Financeiro' })).status,
    200,
  );
  let state = (await call('/api/admin/state', { cookie: admin })).data;
  const finance = state.workspaces.find((w) => w.name === 'Financeiro').id;
  assert.equal(
    (
      await post('admin/membership', {
        user_id: memberId,
        workspace_id: finance,
        role: 'coordinator',
      })
    ).status,
    200,
  );
  assert.equal(
    (await call('/api/tasks?week=2026-10-25', { cookie: spoof })).status,
    403,
  );
  const task = {
    title: 'Tarefa Financeiro',
    description: '',
    assignee_id: memberId,
    week: '2026-10-25',
    due_date: '2026-11-02',
    priority: 'normal',
    restricted: false,
  };
  // Administration is scoped on the server, including requests made manually.
  {
    sqlite.exec(`INSERT INTO users(id,name,role,job,color,access_status,onboarding_required) VALUES
      ('scope-member','Integrante Escopo','member','Cargo global','#c1b4ee','active',0),
      ('scope-outsider','Externo Escopo','member','RH','#c1b4ee','active',0),
      ('scope-pending','Pendente Escopo','member','RH','#c1b4ee','pending',1);
      INSERT INTO corporate_identities VALUES
      ('${ADMIN_TENANT}','b101abca-1111-4111-8111-111111111111','scope-member','scope.member@forest.ind.br','Integrante Escopo'),
      ('${ADMIN_TENANT}','scope-outsider','scope-outsider','scope.outsider@forest.ind.br','Externo Escopo'),
      ('${ADMIN_TENANT}','scope-pending','scope-pending','scope.pending@forest.ind.br','Pendente Escopo');
      INSERT INTO workspace_memberships VALUES('ti','scope-member','member'),('ti','scope-outsider','member');`);
    let limited = await call('/api/admin/state', { cookie: spoof });
    assert.equal(limited.status, 200);
    assert.equal(limited.data.scope, 'sector');
    assert.deepEqual(
      limited.data.workspaces.map((w) => w.id),
      [finance],
    );
    assert.deepEqual(
      limited.data.users.map((u) => u.id),
      [memberId],
    );
    assert.deepEqual(limited.data.requests, []);
    for (const path of [
      'workspace',
      'review',
      'access',
      'link',
      'administrator',
      'profile-deletion',
    ]) {
      assert.equal(
        (
          await post(
            'admin/' + path,
            {
              user_id: 'scope-member',
              workspace_id: finance,
              is_admin: true,
              confirm: true,
            },
            spoof,
          )
        ).status,
        403,
        path,
      );
    }
    assert.equal(
      (
        await call('/api/admin/profile-deletion?user_id=scope-outsider', {
          cookie: spoof,
        })
      ).status,
      403,
    );
    assert.equal(
      (
        await post(
          'admin/membership',
          { user_id: 'scope-member', workspace_id: 'ti', role: 'remove' },
          spoof,
        )
      ).status,
      403,
    );
    assert.equal(
      (
        await post(
          'admin/membership',
          {
            user_id: 'scope-member',
            workspace_id: finance,
            role: 'coordinator',
          },
          spoof,
        )
      ).status,
      403,
    );
    assert.equal(
      (
        await post(
          'admin/membership',
          { user_id: memberId, workspace_id: finance, role: 'remove' },
          spoof,
        )
      ).status,
      403,
    );
    assert.equal(
      (
        await post(
          'admin/membership',
          { user_id: 'scope-pending', workspace_id: finance, role: 'member' },
          spoof,
        )
      ).status,
      409,
    );
    const candidates = await call('/api/admin/candidates?q=Escopo', {
      cookie: spoof,
    });
    assert.equal(candidates.status, 200);
    assert.equal(candidates.data.users.length, 2);
    assert.deepEqual(Object.keys(candidates.data.users[0]).sort(), [
      'email',
      'id',
      'name',
    ]);
    assert.equal(
      (await call('/api/admin/candidates?q=%25%25', { cookie: spoof })).data
        .users.length,
      0,
    );
    assert.equal(
      (
        await post(
          'admin/membership',
          { user_id: 'scope-member', workspace_id: finance, role: 'member' },
          spoof,
        )
      ).status,
      200,
    );
    assert.equal(
      (
        await post(
          'admin/member-profile',
          {
            user_id: 'scope-member',
            workspace_id: finance,
            job: 'Analista financeiro',
          },
          spoof,
        )
      ).status,
      200,
    );
    assert.equal(
      sqlite.prepare("SELECT job FROM users WHERE id='scope-member'").get().job,
      'Cargo global',
    );
    assert.equal(
      (
        await call('/api/users', { cookie: spoof, workspace: finance })
      ).data.find((u) => u.id === 'scope-member').job,
      'Analista financeiro',
    );
    assert.equal(
      (await call('/api/users', { cookie: admin, workspace: 'ti' })).data.find(
        (u) => u.id === 'scope-member',
      ).job,
      'Cargo global',
    );
    assert.equal(
      (
        await post(
          'admin/member-profile',
          { user_id: 'scope-outsider', workspace_id: 'ti', job: 'Indevido' },
          spoof,
        )
      ).status,
      403,
    );
    limited = (await call('/api/admin/state', { cookie: spoof })).data;
    assert.ok(!limited.users.some((u) => u.id === 'scope-outsider'));
    assert.ok(limited.memberships.every((m) => m.workspace_id === finance));
    assert.ok(limited.audit.length >= 2);
    assert.ok(
      limited.audit.every(
        (a) => JSON.parse(a.details).workspace_id === finance,
      ),
    );
    assert.equal(
      (
        await post(
          'admin/membership',
          { user_id: 'scope-member', workspace_id: finance, role: 'remove' },
          spoof,
        )
      ).status,
      200,
    );
    assert.ok(
      sqlite
        .prepare(
          "SELECT user_id FROM workspace_memberships WHERE user_id='scope-member' AND workspace_id='ti'",
        )
        .get(),
    );
    assert.equal(
      sqlite
        .prepare(
          "SELECT count(*) n FROM workspace_member_profiles WHERE user_id='scope-member'",
        )
        .get().n,
      0,
    );
    assert.equal(
      (
        await post('admin/administrator', {
          user_id: 'scope-pending',
          is_admin: true,
          confirm: true,
        })
      ).status,
      409,
    );
    assert.equal(
      (
        await post('admin/administrator', {
          user_id: 'scope-member',
          is_admin: true,
        })
      ).status,
      400,
    );
    assert.equal(
      (
        await post('admin/administrator', {
          user_id: 'scope-member',
          is_admin: true,
          confirm: true,
        })
      ).status,
      200,
    );
    assert.equal(
      sqlite.prepare("SELECT is_admin FROM users WHERE id='scope-member'").get()
        .is_admin,
      1,
    );
    assert.equal(
      (
        await post('admin/administrator', {
          user_id: adminId,
          is_admin: false,
          confirm: true,
        })
      ).status,
      409,
    );
    // A delegated administrator is global without changing their sector roles.
    const delegated = await login(
      'b101abca-1111-4111-8111-111111111111',
      'scope.member@forest.ind.br',
    );
    assert.equal(
      (await call('/api/admin/state', { cookie: delegated })).data.scope,
      'global',
    );
    assert.equal(
      (
        await post(
          'admin/administrator',
          { user_id: adminId, is_admin: false, confirm: true },
          delegated,
        )
      ).status,
      409,
    );
    assert.equal(
      (
        await post(
          'admin/administrator',
          { user_id: 'scope-member', is_admin: false, confirm: true },
          delegated,
        )
      ).status,
      409,
    );
    assert.equal(
      (
        await post('admin/administrator', {
          user_id: 'scope-member',
          is_admin: false,
          confirm: true,
        })
      ).status,
      200,
    );
    assert.equal(
      (await call('/api/admin/state', { cookie: delegated })).status,
      403,
    );
    assert.ok(
      sqlite
        .prepare(
          "SELECT user_id FROM workspace_memberships WHERE user_id='scope-member' AND workspace_id='ti'",
        )
        .get(),
    );
    // A coordinator can administer several authorized sectors, then loses it immediately.
    await post('admin/membership', {
      user_id: memberId,
      workspace_id: 'ti',
      role: 'coordinator',
    });
    assert.equal(
      (await call('/api/admin/state', { cookie: spoof })).data.workspaces
        .length,
      2,
    );
    await post('admin/membership', {
      user_id: memberId,
      workspace_id: 'ti',
      role: 'remove',
    });
    await post('admin/membership', {
      user_id: memberId,
      workspace_id: finance,
      role: 'member',
    });
    assert.equal(
      (await call('/api/admin/state', { cookie: spoof })).status,
      403,
    );
    assert.equal(
      (
        await post(
          'admin/membership',
          { user_id: 'scope-member', workspace_id: finance, role: 'member' },
          spoof,
        )
      ).status,
      403,
    );
    await post('admin/membership', {
      user_id: memberId,
      workspace_id: finance,
      role: 'coordinator',
    });
  }
  const created = await post('tasks', task, spoof, finance);
  assert.equal(created.status, 201, JSON.stringify(created.data));
  const taskId = created.data.id;
  // Notification recipients, visibility, read isolation and queued delivery.
  {
    assert.equal((await call('/api/notifications')).status, 401);
    assert.equal(
      sqlite
        .prepare('SELECT count(*) n FROM notifications WHERE task_id=?')
        .get(taskId).n,
      0,
      'Do not notify self-assignment',
    );
    const noticeTask = await post(
      'tasks',
      { ...task, title: 'Teste de notificação privada', restricted: true },
      admin,
      finance,
    );
    assert.equal(noticeTask.status, 201);
    let feed = (await call('/api/notifications', { cookie: spoof })).data;
    const notice = feed.notifications.find(
      (n) => n.task_id === noticeTask.data.id,
    );
    assert.ok(notice);
    assert.equal(notice.kind, 'assignment');
    assert.ok(
      !(
        await call('/api/notifications', { cookie: admin })
      ).data.notifications.some((n) => n.id === notice.id),
      'Admin inbox only shows own notifications',
    );
    await post('notifications/read', { id: notice.id }, admin);
    assert.equal(
      sqlite
        .prepare('SELECT read_at FROM notifications WHERE id=?')
        .get(notice.id).read_at,
      null,
    );
    await post(
      'tasks/' + noticeTask.data.id + '/comments',
      { body: 'Comentário de teste' },
      admin,
      finance,
    );
    assert.ok(
      (
        await call('/api/notifications', { cookie: spoof })
      ).data.notifications.some(
        (n) => n.task_id === noticeTask.data.id && n.kind === 'comment',
      ),
    );
    const pair = await crypto.subtle.generateKey(
      { name: 'ECDH', namedCurve: 'P-256' },
      true,
      ['deriveBits'],
    );
    const sub = {
      endpoint: 'https://fcm.googleapis.com/fcm/send/test-only',
      keys: {
        p256dh: Buffer.from(
          await crypto.subtle.exportKey('raw', pair.publicKey),
        ).toString('base64url'),
        auth: Buffer.alloc(16, 1).toString('base64url'),
      },
    };
    assert.equal(
      (await post('notifications/subscribe', sub, spoof)).status,
      503,
    );
    const v = await crypto.subtle.generateKey(
      { name: 'ECDSA', namedCurve: 'P-256' },
      true,
      ['sign', 'verify'],
    );
    const vj = await crypto.subtle.exportKey('jwk', v.privateKey);
    env.VAPID_PRIVATE_KEY = vj.d;
    env.VAPID_PUBLIC_KEY = Buffer.from(
      await crypto.subtle.exportKey('raw', v.publicKey),
    ).toString('base64url');
    assert.equal(
      (
        await post(
          'notifications/subscribe',
          { ...sub, endpoint: 'https://localhost/private' },
          spoof,
        )
      ).status,
      400,
    );
    assert.equal(
      (await post('notifications/subscribe', sub, spoof)).status,
      200,
    );
    const diagnostic = await post(
      'notifications/test',
      { endpoint: sub.endpoint },
      spoof,
    );
    assert.equal(diagnostic.status, 201);
    assert.equal(
      (await post('notifications/test', { endpoint: sub.endpoint }, spoof))
        .status,
      429,
    );
    assert.equal(
      (
        await call('/api/notifications/test-status?id=' + diagnostic.data.id, {
          cookie: admin,
        })
      ).status,
      404,
    );
    assert.equal(
      (
        await call('/api/notifications/test-status?id=' + diagnostic.data.id, {
          cookie: spoof,
        })
      ).data.attempts,
      0,
    );
    // Remove membership: neither inbox nor delivery may reveal the private task.
    await post('admin/membership', {
      user_id: memberId,
      workspace_id: finance,
      role: 'remove',
    });
    assert.ok(
      !(
        await call('/api/notifications', { cookie: spoof })
      ).data.notifications.some((n) => n.task_id === noticeTask.data.id),
    );
    const beforePush = pushCalls;
    await deliverNotifications(env);
    assert.equal(
      sqlite
        .prepare(
          'SELECT count(*) n FROM notification_deliveries d JOIN notifications n ON n.id=d.notification_id WHERE n.task_id=? AND d.sent=1',
        )
        .get(noticeTask.data.id).n,
      0,
    );
    await post('admin/membership', {
      user_id: memberId,
      workspace_id: finance,
      role: 'coordinator',
    });
    // Ensure eligibility by timestamp, independent of test execution speed.
    sqlite
      .prepare(
        "UPDATE push_subscriptions SET created_at=datetime('now','-1 hour')",
      )
      .run();
    await deliverNotifications(env);
    assert.ok(pushCalls > beforePush);
    const afterPush = pushCalls;
    await deliverNotifications(env);
    assert.equal(pushCalls, afterPush, 'Delivered pushes are not repeated');
    await post('notifications/read', { id: notice.id }, spoof);
    assert.ok(
      sqlite
        .prepare('SELECT read_at FROM notifications WHERE id=?')
        .get(notice.id).read_at,
    );
    assert.ok(
      !(
        await call('/api/notifications', { cookie: spoof })
      ).data.notifications.some((n) => n.id === notice.id),
      'Read notices disappear from inbox',
    );
    assert.equal(
      (await call('/api/notifications/item?id=' + notice.id, { cookie: spoof }))
        .data.task_id,
      noticeTask.data.id,
      'Old browser notification still resolves its target',
    );
    assert.equal(
      (await call('/api/notifications/item?id=' + notice.id, { cookie: admin }))
        .status,
      404,
      'Administrator cannot open another person notification',
    );
    await post(
      'tasks/' + noticeTask.data.id + '/comments',
      { body: 'Teste de nova tentativa' },
      admin,
      finance,
    );
    pushStatus = 503;
    await deliverNotifications(env);
    assert.equal(
      sqlite
        .prepare(
          'SELECT last_error FROM notification_deliveries WHERE sent=0 AND attempts>0 LIMIT 1',
        )
        .get().last_error,
      'provider_http_503:Error',
    );
    const failedCalls = pushCalls;
    await deliverNotifications(env);
    assert.equal(pushCalls, failedCalls, 'Respect retry backoff');
    sqlite
      .prepare('UPDATE notification_deliveries SET next_attempt=0 WHERE sent=0')
      .run();
    pushStatus = 410;
    await deliverNotifications(env);
    pushStatus = 201;
    assert.equal(
      sqlite.prepare('SELECT count(*) n FROM push_subscriptions').get().n,
      0,
      'Expired subscriptions removed',
    );
    await post('notifications/subscribe', sub, spoof);
    await post('notifications/unsubscribe', { endpoint: sub.endpoint }, spoof);
    assert.equal(
      sqlite.prepare('SELECT count(*) n FROM push_subscriptions').get().n,
      0,
    );
    delete env.VAPID_PUBLIC_KEY;
    delete env.VAPID_PRIVATE_KEY;
    sqlite
      .prepare('DELETE FROM events WHERE task_id=?')
      .run(noticeTask.data.id);
    sqlite
      .prepare('DELETE FROM comments WHERE task_id=?')
      .run(noticeTask.data.id);
    sqlite
      .prepare('DELETE FROM task_weeks WHERE task_id=?')
      .run(noticeTask.data.id);
    sqlite.prepare('DELETE FROM tasks WHERE id=?').run(noticeTask.data.id);
  }
  {
    for (const title of [
      'Tarefa Financeiro',
      '  TAREFA   FINANCEIRO  ',
      'Táréfa Financeiro',
    ]) {
      assert.equal(
        (
          await post(
            'tasks',
            { ...task, title, week: '2026-11-01' },
            spoof,
            finance,
          )
        ).status,
        409,
      );
    }
    // The unique index also rejects writes bypassing the preflight check.
    assert.throws(
      () =>
        sqlite
          .prepare(
            "INSERT INTO tasks(id,title,title_key,assignee_id,created_by,week,workspace_id,priority) VALUES('race-test','Tarefa Financeiro','tarefa financeiro',?,?,?,?,'normal')",
          )
          .run(memberId, memberId, '2026-11-01', finance),
      /UNIQUE/,
    );
    const other = await post(
      'tasks',
      { ...task, title: 'Nome exclusivo para edição' },
      spoof,
      finance,
    );
    assert.equal(other.status, 201);
    assert.equal(
      (
        await post(
          'imports/commit',
          {
            week: task.week,
            importId: crypto.randomUUID(),
            tasks: [
              {
                ...task,
                title: 'TÁREFA FINANCEIRO',
                responsible_name: '',
                status: 'progress',
                block_reason: '',
                checklist: [],
              },
            ],
          },
          spoof,
          finance,
        )
      ).status,
      409,
    );
    const preview = await post(
      'imports/preview',
      {
        week: '2026-11-01',
        text: `👤 ${me.data.user.name}\n- Tarefa Financeiro\n- Nova tarefa única\n- NOVA TAREFA ÚNICA`,
      },
      spoof,
      finance,
    );
    assert.equal(preview.status, 200);
    assert.deepEqual(preview.data.duplicates, [0, 2]);
    assert.equal(
      (
        await call('/api/tasks/' + other.data.id, {
          method: 'PATCH',
          cookie: spoof,
          workspace: finance,
          body: { details: { ...task, title: 'Tarefa Financeiro' } },
        })
      ).status,
      409,
    );
    assert.equal(
      sqlite.prepare('SELECT title FROM tasks WHERE id=?').get(other.data.id)
        .title,
      'Nome exclusivo para edição',
    );
    sqlite.prepare('DELETE FROM events WHERE task_id=?').run(other.data.id);
    sqlite.prepare('DELETE FROM task_weeks WHERE task_id=?').run(other.data.id);
    sqlite.prepare('DELETE FROM tasks WHERE id=?').run(other.data.id);
  }
  assert.equal(
    (
      await call('/api/tasks?week=2026-10-25', {
        cookie: spoof,
        workspace: finance,
      })
    ).data.length,
    1,
  );
  assert.equal(
    (await call('/api/tasks/' + taskId + '/events', { cookie: admin })).status,
    404,
  );
  for (const suffix of ['', '/events', '/comments', '/checklist'])
    assert.equal(
      (
        await call('/api/tasks/historical-task' + suffix, {
          cookie: spoof,
          workspace: finance,
        })
      ).status,
      404,
    );
  assert.equal(
    (
      await call('/api/tasks/historical-task', {
        cookie: spoof,
        workspace: finance,
        method: 'PATCH',
        body: { status: 'done' },
      })
    ).status,
    404,
  );
  assert.equal(
    (
      await call('/api/tasks/historical-task', {
        cookie: spoof,
        workspace: finance,
        method: 'DELETE',
      })
    ).status,
    404,
  );
  assert.equal(
    (await post('tasks', { ...task, assignee_id: 'legacy' }, spoof, finance))
      .status,
    400,
  );
  assert.equal(
    (
      await post(
        'weeks/carry',
        { week: '2026-11-01', task_ids: ['historical-task'] },
        spoof,
        finance,
      )
    ).status,
    400,
  );
  assert.equal(
    (
      await post(
        'admin/access',
        { user_id: adminId, status: 'blocked' },
        spoof,
        finance,
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await call('/api/users/' + memberId, {
        method: 'PATCH',
        cookie: spoof,
        workspace: finance,
        body: { role: 'coordinator' },
      })
    ).status,
    403,
  );
  const preview = await post(
    'imports/preview',
    {
      week: '2026-10-25',
      text: '👤 Perfil histórico\n- Tarefa não pode ser atribuída à TI',
    },
    spoof,
    finance,
  );
  assert.equal(preview.status, 200);
  assert.equal(preview.data.tasks[0].assignee_id, null);
  const importId = crypto.randomUUID(),
    importTask = {
      title: 'Importação Financeiro',
      description: '',
      assignee_id: memberId,
      responsible_name: 'Pessoa',
      due_date: '2026-11-02',
      priority: 'normal',
      status: 'progress',
      block_reason: '',
      checklist: ['Etapa'],
      extra_assignee_ids: [],
    };
  const imported = await post(
    'imports/commit',
    { week: '2026-10-25', importId, tasks: [importTask] },
    spoof,
    finance,
  );
  assert.equal(imported.status, 201, JSON.stringify(imported.data));
  assert.equal(
    (
      await post(
        'imports/commit',
        { week: '2026-10-25', importId, tasks: [importTask] },
        spoof,
        finance,
      )
    ).data.replayed,
    true,
  );
  assert.equal(
    sqlite
      .prepare('SELECT workspace_id FROM tasks WHERE title=?')
      .get(importTask.title).workspace_id,
    finance,
  );
  const importedTask = sqlite
    .prepare('SELECT id FROM tasks WHERE title=?')
    .get(importTask.title).id;
  assert.equal(
    (
      await call('/api/tasks/' + importedTask + '/checklist', {
        cookie: spoof,
        workspace: finance,
      })
    ).data[0].text,
    'Etapa',
  );
  await post('admin/membership', {
    user_id: memberId,
    workspace_id: finance,
    role: 'member',
  });
  assert.equal(
    (
      await post(
        'imports/preview',
        { week: '2026-10-25', text: 'teste' },
        spoof,
        finance,
      )
    ).status,
    403,
  );
  await post('admin/membership', {
    user_id: memberId,
    workspace_id: finance,
    role: 'remove',
  });
  assert.equal(
    (
      await call('/api/tasks?week=2026-10-25', {
        cookie: spoof,
        workspace: finance,
      })
    ).status,
    403,
  );
  await post('admin/access', { user_id: memberId, status: 'blocked' });
  assert.equal((await call('/api/auth/me', { cookie: spoof })).status, 401);
  // Explicit legacy linking preserves every historical foreign key and never matches by email.
  const third = await login(
    '22222222-2222-4222-8222-222222222222',
    'legacy@forest.ind.br',
  );
  const thirdId = (await call('/api/auth/me', { cookie: third })).data.user.id;
  assert.equal(
    (
      await post(
        'auth/onboarding',
        { ...form, name: 'Perfil histórico conferido' },
        third,
      )
    ).status,
    201,
  );
  assert.equal(
    (
      await post('admin/link', {
        source_id: thirdId,
        target_id: 'legacy',
        confirm: true,
      })
    ).status,
    200,
  );
  assert.equal(
    (await call('/api/auth/me', { cookie: third })).data.user.id,
    'legacy',
  );
  assert.equal(
    sqlite
      .prepare('SELECT assignee_id FROM tasks WHERE id=?')
      .get('historical-task').assignee_id,
    'legacy',
  );
  assert.equal(
    sqlite.prepare('SELECT body FROM comments WHERE id=?').get('old-comment')
      .body,
    'Comentário antigo',
  );
  assert.equal(
    sqlite
      .prepare('SELECT count(*) AS n FROM task_weeks WHERE task_id=?')
      .get('historical-task').n,
    2,
  );
  assert.equal(
    (await post('admin/access', { user_id: adminId, status: 'blocked' }))
      .status,
    409,
  );
  await post('admin/workspace', {
    id: finance,
    name: 'Financeiro',
    active: false,
  });
  assert.equal(
    (
      await call('/api/tasks?week=2026-10-25', {
        cookie: admin,
        workspace: finance,
      })
    ).status,
    403,
  );
  assert.equal(
    sqlite.prepare('SELECT count(*) AS n FROM admin_audit').get().n >= 8,
    true,
  );

  {
    // Permanent deletion must preserve every historical FK and remove all login/profile rows.
    const deleted = 'system-deleted-user';
    sqlite
      .prepare(
        'INSERT INTO accounts(user_id,email,salt,password_hash) VALUES(?,?,?,?)',
      )
      .run('legacy', 'old@example.invalid', 'test', 'test');
    sqlite
      .prepare('INSERT INTO sessions VALUES(?,?,?)')
      .run('old-session', 'legacy', Date.now() + 60000);
    sqlite
      .prepare('INSERT INTO invites VALUES(?,?,?,?)')
      .run('old-invite', 'legacy', 'old@example.invalid', Date.now() + 60000);
    sqlite
      .prepare(
        'INSERT INTO team_sessions(token_hash,profile_id,expires_at,last_seen_at) VALUES(?,?,?,?)',
      )
      .run('old-shared', 'legacy', Date.now() + 60000, Date.now());
    sqlite
      .prepare(
        'INSERT INTO task_imports(id,actor_id,payload_hash,task_count) VALUES(?,?,?,?)',
      )
      .run('old-import', 'legacy', 'test', 1);
    sqlite
      .prepare(
        'INSERT INTO admin_audit(id,actor_id,action,details) VALUES(?,?,?,?)',
      )
      .run('old-audit', 'legacy', 'test', '{}');
    sqlite
      .prepare(
        "INSERT INTO access_requests(user_id,name,job,department,status,reviewed_by) VALUES(?,?,?,?,'approved',?)",
      )
      .run(adminId, 'Administrador', 'TI', 'TI', 'legacy');
    for (const [id, primary, extras] of [
      ['delete-both', 'legacy', [memberId]],
      ['delete-extras', adminId, ['legacy', memberId]],
      ['delete-primary', memberId, ['legacy', adminId]],
    ]) {
      sqlite
        .prepare(
          "INSERT INTO tasks(id,title,assignee_id,created_by,week,priority,status,workspace_id) VALUES(?,?,?,?,'2026-10-25','normal','progress','ti')",
        )
        .run(id, id, primary, 'legacy');
      for (const extra of extras)
        sqlite.prepare('INSERT INTO task_assignees VALUES(?,?)').run(id, extra);
    }
    const counts = () =>
      ['tasks', 'comments', 'events', 'task_weeks', 'task_imports'].map(
        (t) => sqlite.prepare('SELECT count(*) n FROM ' + t).get().n,
      );
    const preserved = counts();
    assert.equal(
      (
        await post(
          'admin/profile-deletion',
          {
            user_id: 'legacy',
            confirm: true,
            confirm_name: 'Perfil histórico',
          },
          spoof,
        )
      ).status,
      401,
    );
    assert.equal(
      (
        await post('admin/profile-deletion', {
          user_id: adminId,
          confirm: true,
          confirm_name: me.data.user.name,
        })
      ).status,
      409,
    );
    const preview = (
      await call('/api/admin/profile-deletion?user_id=legacy', {
        cookie: admin,
      })
    ).data;
    assert.equal(preview.name, 'Perfil histórico');
    assert.ok(preview.tasks >= 4);
    assert.equal(preview.comments, 1);
    assert.equal(
      (
        await post('admin/profile-deletion', {
          user_id: 'legacy',
          confirm: true,
          confirm_name: 'Nome errado',
        })
      ).status,
      400,
    );
    assert.ok(sqlite.prepare('SELECT id FROM users WHERE id=?').get('legacy'));
    sqlite.exec(
      'CREATE TABLE future_reference(user_id TEXT REFERENCES users(id))',
    );
    sqlite.prepare('INSERT INTO future_reference VALUES(?)').run('legacy');
    assert.equal(
      (
        await post('admin/profile-deletion', {
          user_id: 'legacy',
          confirm: true,
          confirm_name: preview.name,
        })
      ).status,
      500,
    );
    assert.equal(
      sqlite
        .prepare('SELECT assignee_id FROM tasks WHERE id=?')
        .get('historical-task').assignee_id,
      'legacy',
    );
    assert.ok(
      sqlite
        .prepare('SELECT user_id FROM corporate_identities WHERE user_id=?')
        .get('legacy'),
    );
    sqlite.exec('DROP TABLE future_reference');
    assert.equal(
      (
        await post('admin/profile-deletion', {
          user_id: 'legacy',
          confirm: true,
          confirm_name: preview.name,
        })
      ).status,
      200,
    );
    assert.equal(
      sqlite.prepare('SELECT id FROM users WHERE id=?').get('legacy'),
      undefined,
    );
    for (const table of [
      'corporate_sessions',
      'corporate_identities',
      'workspace_memberships',
      'access_requests',
      'accounts',
      'sessions',
      'invites',
    ])
      assert.equal(
        sqlite
          .prepare('SELECT count(*) n FROM ' + table + ' WHERE user_id=?')
          .get('legacy').n,
        0,
      );
    assert.equal(
      sqlite
        .prepare('SELECT count(*) n FROM team_sessions WHERE profile_id=?')
        .get('legacy').n,
      0,
    );
    assert.equal(
      sqlite
        .prepare('SELECT assignee_id FROM tasks WHERE id=?')
        .get('historical-task').assignee_id,
      deleted,
    );
    assert.equal(
      sqlite
        .prepare('SELECT author_id FROM comments WHERE id=?')
        .get('old-comment').author_id,
      deleted,
    );
    assert.equal(
      sqlite.prepare('SELECT actor_id FROM events WHERE id=?').get('old-event')
        .actor_id,
      deleted,
    );
    assert.equal(
      sqlite
        .prepare('SELECT reviewed_by FROM access_requests WHERE user_id=?')
        .get(adminId).reviewed_by,
      deleted,
    );
    assert.equal((await call('/api/auth/me', { cookie: third })).status, 401);
    assert.equal(
      (await call('/api/tasks/historical-task/comments', { cookie: admin }))
        .data[0].name,
      'Usuário excluído',
    );
    assert.equal(
      (await call('/api/admin/state', { cookie: admin })).data.users.some(
        (u) => u.id === deleted,
      ),
      false,
    );
    const memberName = sqlite
      .prepare('SELECT name FROM users WHERE id=?')
      .get(memberId).name;
    assert.equal(
      (
        await post('admin/profile-deletion', {
          user_id: memberId,
          confirm: true,
          confirm_name: memberName,
        })
      ).status,
      200,
    );
    assert.deepEqual(counts(), preserved);
    assert.equal(
      sqlite
        .prepare('SELECT count(*) n FROM task_assignees WHERE task_id=?')
        .get('delete-both').n,
      0,
    );
    assert.equal(
      sqlite
        .prepare('SELECT user_id FROM task_assignees WHERE task_id=?')
        .get('delete-extras').user_id,
      deleted,
    );
    assert.deepEqual(
      sqlite
        .prepare('SELECT user_id FROM task_assignees WHERE task_id=?')
        .all('delete-primary')
        .map((r) => r.user_id),
      [adminId],
    );
    assert.equal(
      (
        await post('admin/profile-deletion', {
          user_id: deleted,
          confirm: true,
          confirm_name: 'Usuário excluído',
        })
      ).status,
      409,
    );
    assert.equal(
      (
        await post('admin/profile-deletion', {
          user_id: memberId,
          confirm: true,
          confirm_name: memberName,
        })
      ).status,
      404,
    );
    assert.equal(
      (await post('tasks', { ...task, assignee_id: deleted })).status,
      400,
    );
    const details = {
      title: 'Preservar histórico',
      description: 'Descrição revisada',
      assignee_ids: [deleted],
      due_date: '',
      priority: 'normal',
      restricted: false,
    };
    assert.equal(
      (
        await call('/api/tasks/historical-task', {
          method: 'PATCH',
          cookie: admin,
          body: { details },
        })
      ).status,
      200,
    );
    // A new Microsoft login creates a fresh pending account, without recovering the deleted authorization.
    const again = await login(memberOid, 'person@forest.ind.br');
    const recreated = (await call('/api/auth/me', { cookie: again })).data;
    assert.notEqual(recreated.user.id, memberId);
    assert.equal(recreated.user.access_status, 'pending');
    assert.equal(recreated.workspaces.length, 0);
  }
  const session = sqlite
    .prepare(
      'SELECT token_hash,last_seen_at FROM corporate_sessions WHERE user_id=?',
    )
    .get(adminId);
  sqlite
    .prepare('UPDATE corporate_sessions SET last_seen_at=? WHERE token_hash=?')
    .run(Date.now() - 600001, session.token_hash);
  assert.equal((await call('/api/auth/me', { cookie: admin })).status, 401);
  assert.equal(
    (
      await call('/api/auth/microsoft/start', {
        extra: { Origin: 'https://attacker.invalid' },
        method: 'POST',
        body: {},
      })
    ).status,
    403,
  );

  assert.equal(sqlite.prepare('PRAGMA foreign_key_check').all().length, 0);
  console.log(
    'OK: migração preserva dados; OIDC com assinatura real, nonce/PKCE/state e consumo único; rejeita tenant/audience/issuer/nonce/assinatura/prazo/convidados inválidos; administrador fixado por oid+tid; login antigo desativado; setores isolados em tarefas/importação/históricos; coordenação por setor; revogação imediata; vínculo histórico explícito; formulário sem autoautorização; correção e reenvio; aprovação administrativa com setor e função; auditoria; exclusão real de perfis preservando históricos e participantes; inatividade.',
  );
} finally {
  globalThis.fetch = originalFetch;
  sqlite.close();
  rmSync(bundle);
  rmdirSync(temporary);
}
