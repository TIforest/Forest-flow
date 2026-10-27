import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
const base = 'http://127.0.0.1:5173';
let session = '';
const taskIds = [];
let userId;
async function call(path, method = 'GET', body, actor) {
  const r = await fetch(`${base}/api/${path}`, {
    method,
    headers: {
      Origin: base,
      'Content-Type': 'application/json',
      ...(actor
        ? { 'X-Demo-User': actor }
        : session
          ? { Cookie: session }
          : {}),
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
  const email = `test-${randomBytes(6).toString('hex')}@forest.ind.br`;
  const member = await call(
    'users',
    'POST',
    {
      name: 'Teste temporário de colaboração',
      job: 'Testes locais',
      role: 'member',
      color: '#2869bc',
      registration_email: email,
    },
    'coord',
  );
  assert.equal(member.status, 201);
  userId = member.data.id;
  const password = randomBytes(18).toString('hex');
  const activated = await call('auth/register', 'POST', {
    email,
    password,
    name: 'Teste temporário de colaboração',
    job: 'Testes locais',
  });
  assert.equal(activated.status, 200);
  assert.equal(activated.data.user.id, userId);
  session = activated.cookie;
  assert.ok(session);
  assert.equal((await call('auth/me')).data.user.id, userId);
  assert.equal(
    (
      await call('auth/login', 'POST', {
        email,
        password: 'wrong-password-12345',
      })
    ).status,
    401,
  );
  const login = await call('auth/login', 'POST', { email, password });
  assert.equal(login.status, 200);
  session = login.cookie;
  const body = {
    title: 'Teste temporário de continuidade',
    description: 'Descrição original',
    assignee_id: userId,
    week: '2099-01-04',
    due_date: '2099-01-07',
    priority: 'normal',
    restricted: true,
  };
  const task = await call('tasks', 'POST', body);
  assert.equal(task.status, 201);
  const id = task.data.id;
  taskIds.push(id);
  assert.equal(
    (await call(`tasks/${id}/comments`, 'POST', { body: 'Avanço registrado.' }))
      .status,
    201,
  );
  assert.equal(
    (await call(`tasks/${id}/comments`)).data[0].body,
    'Avanço registrado.',
  );
  assert.equal(
    (await call(`tasks/${id}/comments`, 'GET', undefined, 'bruno')).status,
    404,
  );
  assert.equal(
    (await call(`tasks/${id}/comments`, 'POST', { body: ' ' })).status,
    400,
  );
  assert.equal(
    (
      await call(`tasks/${id}`, 'PATCH', {
        details: {
          ...body,
          title: 'Título editado',
          description: 'Nova descrição',
        },
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await call(`tasks/${id}`, 'PATCH', {
        details: { ...body, assignee_id: 'bruno' },
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await call(`tasks/${id}`, 'PATCH', {
        details: { ...body, due_date: '2099-01-08' },
      })
    ).status,
    403,
  );
  assert.equal(
    (await call('weeks/carry', 'POST', { task_ids: [id], week: '2099-01-11' }))
      .status,
    403,
  );
  assert.equal(
    (
      await call(
        'weeks/carry',
        'POST',
        { task_ids: [id], week: '2099-01-11' },
        'coord',
      )
    ).status,
    200,
  );
  assert.equal(
    (
      await call(
        'weeks/carry',
        'POST',
        { task_ids: [id], week: '2099-01-11' },
        'coord',
      )
    ).status,
    200,
  );
  const original = (await call('tasks?week=2099-01-04')).data.find(
    (t) => t.id === id,
  );
  const next = (await call('tasks?week=2099-01-11')).data.filter(
    (t) => t.id === id,
  );
  assert.equal(next.length, 1);
  assert.equal(original.due_date, next[0].due_date);
  assert.equal(next[0].week, '2099-01-04');
  assert.equal(original.title, 'Título editado');
  assert.equal(
    (await call(`tasks/${id}/events`)).data.filter((e) =>
      e.message.startsWith('Incluída no planejamento'),
    ).length,
    1,
  );
  assert.equal(
    (
      await call(
        `tasks/${id}`,
        'PATCH',
        {
          details: {
            ...body,
            title: 'Edição da coordenação',
            assignee_id: 'bruno',
            priority: 'high',
          },
        },
        'coord',
      )
    ).status,
    200,
  );
  assert.equal((await call(`tasks/${id}/comments`)).status, 404);
  assert.equal((await call('auth/logout', 'POST')).status, 200);
  assert.equal((await call('auth/me')).status, 401);
  console.log(
    'Colaboração e autenticação passaram: cadastro direto, senha, sessão, logout, comentários privados, edição, prazo preservado e continuidade sem duplicação.',
  );
} finally {
  if (userId && /^[a-f0-9-]{36}$/.test(userId)) {
    let sql = '';
    for (const id of taskIds)
      if (/^[a-f0-9-]{36}$/.test(id))
        sql += `DELETE FROM comments WHERE task_id='${id}';DELETE FROM task_weeks WHERE task_id='${id}';DELETE FROM events WHERE task_id='${id}';DELETE FROM tasks WHERE id='${id}';`;
    sql += `DELETE FROM registrations WHERE email=(SELECT email FROM accounts WHERE user_id='${userId}');DELETE FROM email_preview WHERE email=(SELECT email FROM accounts WHERE user_id='${userId}');DELETE FROM invites WHERE user_id='${userId}';DELETE FROM sessions WHERE user_id='${userId}';DELETE FROM accounts WHERE user_id='${userId}';DELETE FROM users WHERE id='${userId}';`;
    execFileSync(
      process.execPath,
      [
        'node_modules/wrangler/bin/wrangler.js',
        'd1',
        'execute',
        'DB',
        '--local',
        '--command',
        sql,
      ],
      { stdio: 'pipe' },
    );
    console.log('Cadastros e registros temporários de teste removidos.');
  }
}
