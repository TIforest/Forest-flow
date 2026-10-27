import type { User } from '../src/types';
import type { ImportTask, ImportPreview } from '../src/import-types';
import { parsePlanning } from './planning-parser';
export interface ImportEnv {
  DB: D1Database;
}
const reply = (data: unknown, status = 200) =>
  Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
const validDate = (s: unknown): s is string =>
  typeof s === 'string' &&
  /^\d{4}-\d{2}-\d{2}$/.test(s) &&
  Number.isFinite(new Date(s + 'T12:00:00Z').getTime()) &&
  new Date(s + 'T12:00:00Z').toISOString().slice(0, 10) === s;
const validWeek = (s: unknown): s is string =>
  validDate(s) && new Date(s + 'T12:00:00Z').getUTCDay() === 0;
const string = (s: unknown, max: number, required = false) =>
  typeof s === 'string' && s.length <= max && (!required || !!s.trim());
export function validTask(
  t: ImportTask,
  ids: Set<string>,
  allowUnassigned = false,
) {
  return (
    t &&
    string(t.title, 180, true) &&
    string(t.description, 5000) &&
    string(t.responsible_name, 100) &&
    ((allowUnassigned && t.assignee_id === null) ||
      (typeof t.assignee_id === 'string' && ids.has(t.assignee_id))) &&
    (t.due_date === null || validDate(t.due_date)) &&
    ['normal', 'high'].includes(t.priority) &&
    ['progress', 'blocked', 'done'].includes(t.status) &&
    string(t.block_reason, 1000) &&
    (t.status !== 'blocked' || !!t.block_reason.trim()) &&
    Array.isArray(t.checklist) &&
    t.checklist.length <= 30 &&
    t.checklist.every((i) => string(i, 300, true))
  );
}
export async function importRoute(
  request: Request,
  env: ImportEnv,
  actor: User,
): Promise<Response | null> {
  const path = new URL(request.url).pathname;
  if (!['/api/imports/preview', '/api/imports/commit'].includes(path))
    return null;
  if (actor.role !== 'coordinator')
    return reply(
      { error: 'Somente a coordenação pode importar atividades.' },
      403,
    );
  if (request.method !== 'POST')
    return reply({ error: 'Método inválido.' }, 405);
  const raw = await request.text();
  if (raw.length > 250000)
    return reply({ error: 'Importação muito grande.' }, 413);
  const b = JSON.parse(raw);
  if (!b || !validWeek(b.week))
    return reply({ error: 'Escolha uma semana iniciada no domingo.' }, 400);
  const users = (
    await env.DB.prepare(
      'SELECT id,name,role,job,color FROM users ORDER BY name',
    ).all<User>()
  ).results;
  if (path.endsWith('/preview')) {
    if (!string(b.text, 20000, true))
      return reply({ error: 'Cole um texto de até 20.000 caracteres.' }, 400);
    let preview: ImportPreview;
    try {
      preview = parsePlanning(b.text, users);
    } catch (e) {
      return reply({ error: (e as Error).message }, 400);
    }
    const existing = (
      await env.DB.prepare(
        'SELECT title,assignee_id FROM tasks JOIN task_weeks ON task_weeks.task_id=tasks.id WHERE task_weeks.week=? AND deleted_at IS NULL',
      )
        .bind(b.week)
        .all<{ title: string; assignee_id: string }>()
    ).results;
    const normalize = (s: string) =>
      s
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();
    const duplicates = preview.tasks
      .map((t, i) =>
        existing.some(
          (e) =>
            e.assignee_id === t.assignee_id &&
            normalize(e.title) === normalize(t.title),
        )
          ? i
          : -1,
      )
      .filter((i) => i >= 0);
    return reply({ ...preview, duplicates, importId: crypto.randomUUID() });
  }
  if (
    typeof b.importId !== 'string' ||
    !/^[a-f0-9-]{36}$/i.test(b.importId) ||
    !Array.isArray(b.tasks) ||
    !b.tasks.length ||
    b.tasks.length > 50 ||
    !b.tasks.every((t: ImportTask) =>
      validTask(t, new Set(users.map((u) => u.id))),
    )
  )
    return reply(
      {
        error:
          'Revise títulos, responsáveis, prazos e motivos de bloqueio antes de criar.',
      },
      400,
    );
  const tasks = (b.tasks as ImportTask[]).map((t) => ({
    title: t.title.trim(),
    description: t.description,
    assignee_id: t.assignee_id,
    due_date: t.due_date,
    priority: t.priority,
    status: t.status,
    block_reason: t.status === 'blocked' ? t.block_reason.trim() : '',
    checklist: t.checklist.map((text) => text.trim()),
  }));
  const hash = Array.from(
    new Uint8Array(
      await crypto.subtle.digest(
        'SHA-256',
        new TextEncoder().encode(JSON.stringify({ week: b.week, tasks })),
      ),
    ),
  )
    .map((n) => n.toString(16).padStart(2, '0'))
    .join('');
  const replay = async () => {
    const previous = await env.DB.prepare(
      'SELECT actor_id,payload_hash,task_count FROM task_imports WHERE id=?',
    )
      .bind(b.importId)
      .first<{ actor_id: string; payload_hash: string; task_count: number }>();
    return previous
      ? previous.actor_id === actor.id && previous.payload_hash === hash
        ? reply({ count: previous.task_count, replayed: true })
        : reply(
            {
              error:
                'Este lote já foi criado com outros dados. Inicie outra importação.',
            },
            409,
          )
      : null;
  };
  const previous = await replay();
  if (previous) return previous;
  const statements = [
    env.DB.prepare(
      'INSERT INTO task_imports(id,actor_id,payload_hash,task_count) VALUES (?,?,?,?)',
    ).bind(b.importId, actor.id, hash, tasks.length),
  ];
  for (const t of tasks) {
    const id = crypto.randomUUID();
    statements.push(
      env.DB.prepare(
        'INSERT INTO tasks(id,title,description,assignee_id,created_by,week,due_date,priority,status,block_reason,completed_at,checklist) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)',
      ).bind(
        id,
        t.title,
        t.description,
        t.assignee_id,
        actor.id,
        b.week,
        t.due_date,
        t.priority,
        t.status,
        t.block_reason,
        t.status === 'done' ? new Date().toISOString() : null,
        JSON.stringify(
          t.checklist.map((text) => ({
            id: crypto.randomUUID(),
            text,
            done: false,
          })),
        ),
      ),
      env.DB.prepare(
        'INSERT INTO task_weeks(task_id,week,added_by) VALUES (?,?,?)',
      ).bind(id, b.week, actor.id),
      env.DB.prepare(
        'INSERT INTO events(id,task_id,actor_id,message) VALUES (?,?,?,?)',
      ).bind(
        crypto.randomUUID(),
        id,
        actor.id,
        'Atividade criada por importação de texto, após revisão',
      ),
    );
  }
  try {
    await env.DB.batch(statements);
  } catch (e) {
    const concurrent = await replay();
    if (concurrent) return concurrent;
    throw e;
  }
  return reply({ count: tasks.length }, 201);
}
