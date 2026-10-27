import assert from 'node:assert/strict';
const base = 'http://127.0.0.1:5173';
async function call(path, actor = 'coord', method = 'GET', body) {
  const response = await fetch(`${base}/api/${path}`, {
    method,
    headers: {
      Origin: base,
      'X-Demo-User': actor,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: response.status, data: await response.json() };
}
const body = {
  title: 'Verificação automatizada de permissões',
  description: 'Registro de teste local.',
  assignee_id: 'bruno',
  week: '2099-01-05',
  due_date: '',
  priority: 'normal',
  restricted: true,
};
assert.equal((await call('users', 'unknown')).status, 401);
assert.equal(
  (await call('tasks', 'bruno', 'POST', { ...body, assignee_id: 'ana' }))
    .status,
  403,
);
const selfCreated = await call('tasks', 'bruno', 'POST', {
  ...body,
  title: 'Atividade criada pelo próprio colaborador',
});
assert.equal(selfCreated.status, 201);
const selfTask = (await call('tasks?week=2099-01-05', 'bruno')).data.find(
  (t) => t.id === selfCreated.data.id,
);
assert.equal(selfTask.assignee_id, 'bruno');
assert.equal(selfTask.created_by, 'bruno');
assert.equal(selfTask.status, 'progress');
assert.ok(
  (await call('tasks?week=2099-01-05', 'coord')).data.some(
    (t) => t.id === selfCreated.data.id,
  ),
);
assert.equal(
  (await call(`tasks/${selfCreated.data.id}/events`, 'bruno')).data[0].actor_id,
  'bruno',
);
assert.equal(
  (await call('tasks', 'coord', 'POST', { ...body, due_date: '2026-99-99' }))
    .status,
  400,
);
const created = await call('tasks', 'coord', 'POST', body);
assert.equal(created.status, 201);
const id = created.data.id;
assert.equal(
  (await call('tasks?week=2099-01-05', 'ana')).data.some((t) => t.id === id),
  false,
);
assert.equal((await call(`tasks/${id}/events`, 'ana')).status, 404);
assert.equal(
  (await call('tasks?week=2099-01-05', 'bruno')).data.some((t) => t.id === id),
  true,
);
assert.equal(
  (await call('tasks?week=2099-01-05', 'coord')).data.some((t) => t.id === id),
  true,
);
assert.equal(
  (await call(`tasks/${id}`, 'bruno', 'PATCH', { status: 'blocked' })).status,
  400,
);
assert.equal(
  (
    await call(`tasks/${id}`, 'bruno', 'PATCH', {
      status: 'blocked',
      block_reason: 'Aguardando aprovação',
    })
  ).status,
  200,
);
assert.equal(
  (await call(`tasks/${id}`, 'bruno', 'PATCH', { status: 'done' })).status,
  200,
);
assert.equal((await call(`tasks/${id}/events`, 'bruno')).data.length, 3);
const shared = (await call('tasks?week=2026-10-25', 'coord')).data.find(
  (t) => t.assignee_id === 'bruno' && !t.restricted,
);
assert.ok(shared);
assert.equal(
  (await call(`tasks/${shared.id}`, 'ana', 'PATCH', { status: 'done' })).status,
  403,
);
assert.equal(
  (
    await fetch(`${base}/api/tasks/${id}`, {
      method: 'PATCH',
      headers: {
        Origin: 'https://example.com',
        'X-Demo-User': 'bruno',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ status: 'done' }),
    })
  ).status,
  403,
);
assert.equal((await call(`tasks/${id}`, 'bruno', 'DELETE')).status, 403);
assert.equal(
  (await call(`tasks/${selfCreated.data.id}`, 'ana', 'DELETE')).status,
  404,
);
assert.equal(
  (await call(`tasks/${selfCreated.data.id}`, 'bruno', 'DELETE')).status,
  200,
);
assert.ok(
  !(await call('tasks?week=2099-01-05', 'bruno')).data.some(
    (t) => t.id === selfCreated.data.id,
  ),
);
assert.equal(
  (
    await call(`tasks/${selfCreated.data.id}`, 'bruno', 'PATCH', {
      status: 'progress',
    })
  ).status,
  404,
);
assert.equal((await call(`tasks/${id}`, 'coord', 'DELETE')).status, 200);
console.log(
  'Verificações de API passaram: criação, validação, restrição, permissões, status, histórico e origem.',
);
console.log(
  'O registro de teste foi isolado na semana 2099-01-05 do D1 local.',
);
