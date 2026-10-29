import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { build } from 'esbuild';
import { readFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
const bundle = await build({
  stdin: {
    contents:
      "export {enqueueDeadlineReminders} from './worker/deadline-reminders.ts';export {notificationsRoute} from './worker/notifications.ts';",
    resolveDir: process.cwd(),
  },
  bundle: true,
  platform: 'node',
  format: 'esm',
  write: false,
});
const { enqueueDeadlineReminders, notificationsRoute } = await import(
  'data:text/javascript;base64,' +
    Buffer.from(bundle.outputFiles[0].text).toString('base64')
);
const sqlite = new DatabaseSync(':memory:');
for (const file of readdirSync('migrations')
  .filter((f) => f.endsWith('.sql'))
  .sort())
  sqlite.exec(readFileSync('migrations/' + file, 'utf8'));
class Statement {
  constructor(sql, args = []) {
    this.sql = sql;
    this.args = args;
  }
  bind(...args) {
    return new Statement(this.sql, args);
  }
  async run() {
    return { success: true, meta: sqlite.prepare(this.sql).run(...this.args) };
  }
  async all() {
    return { results: sqlite.prepare(this.sql).all(...this.args) };
  }
  async first() {
    return sqlite.prepare(this.sql).get(...this.args) || null;
  }
}
const DB = {
  prepare: (sql) => new Statement(sql),
  batch: async (statements) => {
    sqlite.exec('BEGIN');
    try {
      const rows = statements.map((s) => ({
        success: true,
        meta: sqlite.prepare(s.sql).run(...s.args),
      }));
      sqlite.exec('COMMIT');
      return rows;
    } catch (e) {
      sqlite.exec('ROLLBACK');
      throw e;
    }
  },
};
const env = { DB };
try {
  sqlite.exec(
    "INSERT INTO workspaces VALUES('d-ti','TI',1),('d-rh','RH',1),('d-off','Inativo',0);",
  );
  for (const [id, status, required, admin] of [
    ['owner', 'active', 0, 0],
    ['second', 'active', 0, 0],
    ['coord', 'active', 0, 0],
    ['outsider', 'active', 0, 0],
    ['blocked', 'blocked', 0, 0],
    ['pending', 'pending', 1, 0],
    ['admin', 'active', 0, 1],
  ]) {
    sqlite
      .prepare(
        "INSERT INTO users(id,name,role,job,color,access_status,onboarding_required,is_admin) VALUES(?,?,'member','Teste','#123456',?,?,?)",
      )
      .run(id, id, status, required, admin);
  }
  for (const id of ['owner', 'second', 'coord', 'blocked', 'pending'])
    sqlite
      .prepare('INSERT INTO workspace_memberships VALUES(?,?,?)')
      .run('d-ti', id, id === 'coord' ? 'coordinator' : 'member');
  sqlite
    .prepare(
      "INSERT INTO workspace_memberships VALUES('d-rh','outsider','member')",
    )
    .run();
  const cases = [
    ['far', '2026-11-01'],
    ['soon', '2026-10-31'],
    ['tomorrow', '2026-10-30'],
    ['today', '2026-10-29'],
    ['late', '2026-10-28'],
    ['multi', '2026-10-24'],
    ['done', '2026-10-28'],
    ['deleted', '2026-10-28'],
    ['no-date', null],
    ['off', '2026-10-28'],
    ['pending', '2026-10-28'],
    ['blocked', '2026-10-28'],
    ['removed', '2026-10-28'],
    ['admin-task', '2026-10-28'],
  ];
  for (const [id, due] of cases) {
    const assignee =
      id === 'admin-task'
        ? 'admin'
        : id === 'removed'
          ? 'outsider'
          : ['pending', 'blocked'].includes(id)
            ? id
            : 'owner';
    sqlite
      .prepare(
        "INSERT INTO tasks(id,title,assignee_id,created_by,week,due_date,priority,status,workspace_id,deleted_at) VALUES(?,?,?,'coord','2026-10-25',?,'normal',?,?,?)",
      )
      .run(
        id,
        id,
        assignee,
        due,
        id === 'done' ? 'done' : 'progress',
        id === 'off' ? 'd-off' : 'd-ti',
        id === 'deleted' ? '2026-10-29' : null,
      );
  }
  for (const id of ['owner', 'second', 'blocked', 'outsider'])
    sqlite.prepare("INSERT INTO task_assignees VALUES('multi',?)").run(id);
  const count = () =>
    sqlite.prepare('SELECT count(*) n FROM notifications').get().n;
  await enqueueDeadlineReminders(env, new Date('2026-10-29T10:59:00Z'));
  assert.equal(count(), 0, 'Before 08:00 in Sao Paulo');
  await enqueueDeadlineReminders(env, new Date('2026-10-29T11:00:00Z'));
  assert.equal(count(), 7);
  assert.equal(
    sqlite.prepare("SELECT body FROM notifications WHERE task_id='late'").get()
      .body,
    'late · 1 dia em atraso',
  );
  assert.equal(
    sqlite
      .prepare("SELECT body FROM notifications WHERE task_id='multi' LIMIT 1")
      .get().body,
    'multi · 5 dias em atraso',
  );
  for (const [id, text] of [
    ['today', 'Vence hoje'],
    ['tomorrow', 'Vence amanhã'],
    ['soon', 'Vence em 2 dias'],
  ])
    assert.ok(
      sqlite
        .prepare('SELECT body FROM notifications WHERE task_id=?')
        .get(id)
        .body.endsWith(text),
    );
  assert.equal(
    sqlite
      .prepare("SELECT count(*) n FROM notifications WHERE user_id='coord'")
      .get().n,
    0,
    'Do not notify unassigned coordinators',
  );
  sqlite
    .prepare(
      "UPDATE notifications SET read_at=CURRENT_TIMESTAMP WHERE task_id='late'",
    )
    .run();
  await Promise.all([
    enqueueDeadlineReminders(env, new Date('2026-10-29T15:00:00Z')),
    enqueueDeadlineReminders(env, new Date('2026-10-29T15:00:00Z')),
  ]);
  assert.equal(count(), 7, 'No repeated reminders, even after reading');
  await enqueueDeadlineReminders(env, new Date('2026-10-30T11:00:00Z'));
  assert.equal(count(), 15);
  assert.equal(
    sqlite
      .prepare('SELECT count(*) n FROM notifications WHERE read_at IS NULL')
      .get().n,
    8,
    'Yesterday reminders replaced',
  );
  const raw = 'a'.repeat(43);
  sqlite
    .prepare(
      "INSERT INTO corporate_identities VALUES('test','owner-oid','owner','owner@example.invalid','owner')",
    )
    .run();
  sqlite
    .prepare('INSERT INTO corporate_sessions VALUES(?,?,?,?)')
    .run(
      createHash('sha256').update(raw).digest('hex'),
      'owner',
      Date.now() + 3600000,
      Date.now(),
    );
  const feed = async () => {
    const r = await notificationsRoute(
      new Request('http://localhost/api/notifications', {
        headers: { Cookie: 'forest_corporate=' + raw },
      }),
      env,
    );
    assert.equal(r.status, 200);
    return r.json();
  };
  let data = await feed();
  assert.ok(data.notifications.some((n) => n.task_id === 'soon'));
  sqlite
    .prepare("UPDATE tasks SET due_date='2026-12-01' WHERE id='soon'")
    .run();
  sqlite.prepare("UPDATE tasks SET status='done' WHERE id='today'").run();
  sqlite
    .prepare("UPDATE tasks SET assignee_id='second' WHERE id='tomorrow'")
    .run();
  data = await feed();
  for (const id of ['soon', 'today', 'tomorrow'])
    assert.ok(
      !data.notifications.some((n) => n.task_id === id),
      'Suppress outdated reminder: ' + id,
    );
  sqlite.prepare("UPDATE workspaces SET active=0 WHERE id='d-ti'").run();
  assert.equal((await feed()).notifications.length, 0);
  assert.equal(sqlite.prepare('PRAGMA foreign_key_check').all().length, 0);
  console.log(
    'OK: Sao Paulo 08:00; deadlines and overdue day counts; all assignees; membership/status filtering; once per day; read deduplication; daily renewal; stale reminders suppressed.',
  );
} finally {
  sqlite.close();
}
