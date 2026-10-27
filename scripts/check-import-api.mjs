import assert from 'node:assert/strict';
import { importDueDate } from '../worker/planning-parser.ts';
import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
const base = process.env.TEST_BASE_URL || 'http://127.0.0.1:5184';
const coord = 'import-coord-' + randomUUID(),
  member = 'import-member-' + randomUUID(),
  other = 'import-other-' + randomUUID(),
  importId = randomUUID(),
  week = '2099-01-04';
const sql = (command) =>
  JSON.parse(
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
async function call(path, method = 'GET', body, actor = coord) {
  const r = await fetch(base + '/api/' + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Origin: base,
      'X-Demo-User': actor,
      Connection: 'close',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: r.status, data: await r.json() };
}
const task = {
  title: 'Teste importação ' + importId,
  description: 'Descrição',
  assignee_id: member,
  responsible_name: 'Teste',
  due_date: '2099-01-09',
  priority: 'normal',
  status: 'progress',
  block_reason: '',
  checklist: ['Etapa um', 'Etapa dois'],
};
sql(
  `INSERT INTO users(id,name,role,job,color) VALUES ('${coord}','Teste Coord','coordinator','TI','#245940'),('${member}','Teste Membro','member','TI','#245940'),('${other}','Teste Outro','member','TI','#245940');`,
);
try {
  const preview = await call('imports/preview', 'POST', {
    week,
    text: '👤 Teste Membro\n- ' + task.title + '\n  - Etapa um\n  - Etapa dois',
  });
  assert.equal(preview.status, 200, JSON.stringify(preview.data));
  assert.equal(preview.data.tasks.length, 1);
  assert.equal(
    preview.data.tasks[0].due_date,
    importDueDate(),
    'Prazo é hoje +7 dias, independente da semana selecionada',
  );
  assert.equal(preview.data.tasks[0].assignee_id, member);
  assert.deepEqual(preview.data.tasks[0].checklist, task.checklist);
  assert.equal(
    (await call('tasks?week=' + week)).data.filter(
      (t) => t.created_by === coord,
    ).length,
    0,
    'Prévia não deve gravar tarefas',
  );
  assert.equal(
    (await call('imports/preview', 'POST', { week, text: 'Teste' }, member))
      .status,
    403,
  );
  assert.equal(
    (
      await call(
        'imports/commit',
        'POST',
        { week, importId, tasks: [task] },
        member,
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await call('imports/commit', 'POST', {
        week: '2099-01-05',
        importId,
        tasks: [task],
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await call('imports/commit', 'POST', {
        week,
        importId,
        tasks: [{ ...task, assignee_id: null }],
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await call('imports/commit', 'POST', {
        week,
        importId,
        tasks: [{ ...task, status: 'blocked' }],
      })
    ).status,
    400,
  );
  const results = await Promise.all([
    call('imports/commit', 'POST', { week, importId, tasks: [task] }),
    call('imports/commit', 'POST', { week, importId, tasks: [task] }),
  ]);
  assert.ok(
    results.every((r) => [200, 201].includes(r.status)),
    JSON.stringify(results),
  );
  assert.equal(
    (
      await call('imports/commit', 'POST', {
        week,
        importId,
        tasks: [{ ...task, title: 'Changed' }],
      })
    ).status,
    409,
  );
  const tasks = (await call('tasks?week=' + week)).data.filter(
    (t) => t.title === task.title,
  );
  assert.equal(tasks.length, 1);
  assert.equal(tasks[0].due_date, task.due_date);
  const id = tasks[0].id;
  const items = (await call(`tasks/${id}/checklist`)).data;
  assert.equal(items.length, 2);
  assert.equal(
    (
      await call(
        `tasks/${id}/checklist`,
        'PATCH',
        { id: items[0].id, done: true },
        other,
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await call(
        `tasks/${id}/checklist`,
        'PATCH',
        { id: 'invalid', done: true },
        member,
      )
    ).status,
    400,
  );
  assert.equal(
    (
      await call(
        `tasks/${id}/checklist`,
        'PATCH',
        { id: items[0].id, done: true },
        member,
      )
    ).status,
    200,
  );
  assert.equal((await call(`tasks/${id}/checklist`)).data[0].done, true);
  assert.equal((await call(`tasks/${id}/checklist`)).data[1].done, false);
  await call(`tasks/${id}`, 'PATCH', {
    details: {
      title: task.title,
      description: task.description,
      assignee_id: member,
      due_date: task.due_date,
      priority: 'normal',
      restricted: true,
    },
  });
  assert.equal(
    (await call(`tasks/${id}/checklist`, 'GET', undefined, other)).status,
    404,
  );
  const duplicate = await call('imports/preview', 'POST', {
    week,
    text: '👤 Teste Membro\n- ' + task.title,
  });
  assert.equal(duplicate.status, 200);
  assert.deepEqual(duplicate.data.duplicates, [0]);
  console.log(
    'OK: permissões, lote atômico, confirmação concorrente sem duplicação, checklist e visibilidade.',
  );
} finally {
  sql(
    `DELETE FROM events WHERE task_id IN (SELECT id FROM tasks WHERE created_by='${coord}'); DELETE FROM task_weeks WHERE added_by='${coord}'; DELETE FROM tasks WHERE created_by='${coord}'; DELETE FROM task_imports WHERE actor_id='${coord}'; DELETE FROM users WHERE id IN ('${coord}','${member}','${other}');`,
  );
}
