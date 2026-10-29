import { DELETED_USER_ID } from '../src/types';
import { onboardingRoute } from './onboarding';
import type { User, Task, Status } from '../src/types';
import { authRoute, getActor, getAccount, type AuthEnv } from './auth';
import { adminRoute } from './admin';
import { importRoute, type ImportEnv } from './imports';
interface Env extends AuthEnv, ImportEnv {}
const json = (data: unknown, status = 200) =>
  Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
const date = /^\d{4}-\d{2}-\d{2}$/;
function validDate(value: unknown): value is string {
  if (typeof value !== 'string' || !date.test(value)) return false;
  const parsed = new Date(value + 'T12:00:00Z');
  return (
    Number.isFinite(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value
  );
}
// The primary assignee stays in tasks.assignee_id; extra members live in task_assignees.
const taskColumns =
  'tasks.*, (SELECT group_concat(user_id) FROM task_assignees WHERE task_id=tasks.id) AS extra_assignees';
function hydrate(row: Task & { extra_assignees?: string | null }): Task {
  const { extra_assignees, ...task } = row;
  return {
    ...task,
    assignee_ids: [
      task.assignee_id,
      ...(extra_assignees || '')
        .split(',')
        .filter((id) => id && id !== task.assignee_id),
    ],
  };
}
function parseAssignees(ids: unknown, single: unknown): string[] | null {
  const list = ids === undefined ? [single] : ids;
  if (
    !Array.isArray(list) ||
    !list.length ||
    list.length > 20 ||
    list.some((id) => typeof id !== 'string' || !id)
  )
    return null;
  return [...new Set(list as string[])];
}
async function usersExist(db: D1Database, ids: string[], workspace: string) {
  if (!ids.length) return true;
  const row = await db
    .prepare(
      `SELECT count(*) AS n FROM users u JOIN workspace_memberships m ON m.user_id=u.id WHERE m.workspace_id=? AND u.access_status!='merged' AND u.id IN (${ids.map(() => '?').join(',')})`,
    )
    .bind(workspace, ...ids)
    .first<{ n: number }>();
  return row?.n === ids.length;
}
const sameSet = (a: string[], b: string[]) =>
  a.length === b.length && a.every((id) => b.includes(id));
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (!url.pathname.startsWith('/api/'))
      return new Response('Not found', { status: 404 });
    if (
      !['GET', 'HEAD'].includes(request.method) &&
      request.headers.get('Origin') !== url.origin
    )
      return json({ error: 'Origem inválida.' }, 403);
    try {
      const onboarding = await onboardingRoute(request, env);
      if (onboarding) return onboarding;
      const auth = await authRoute(request, env);
      if (auth) return auth;
      const admin = await adminRoute(request, env);
      if (admin) return admin;
      const account = await getAccount(request, env);
      if (!account)
        return json(
          { error: 'Sua sessão foi encerrada. Entre novamente.' },
          401,
        );
      const actor = await getActor(request, env);
      if (!actor)
        return json(
          {
            error:
              'Acesso ao setor não autorizado. Atualize seus espaços de trabalho.',
          },
          403,
        );
      const imported = await importRoute(request, env, actor);
      if (imported) return imported;
      const isAssignee = (task: Task) => task.assignee_ids.includes(actor.id);
      const canSee = (task: Task) =>
        !task.restricted || actor.role === 'coordinator' || isAssignee(task);
      if (url.pathname === '/api/users' && request.method === 'GET') {
        return json(
          (
            await env.DB.prepare(
              "SELECT u.id,u.name,u.job,u.color,u.registration_email,m.role FROM users u JOIN workspace_memberships m ON m.user_id=u.id WHERE m.workspace_id=? AND u.access_status!='merged' ORDER BY u.name",
            )
              .bind(actor.workspace_id)
              .all()
          ).results,
        );
      }
      if (url.pathname.startsWith('/api/users') && request.method !== 'GET')
        return json(
          { error: 'Gerencie os acessos pelo painel de administrador.' },
          403,
        );
      if (url.pathname === '/api/tasks' && request.method === 'GET') {
        if (!validDate(url.searchParams.get('week')))
          return json({ error: 'Semana inválida.' }, 400);
        const tasks = await env.DB.prepare(
          `SELECT ${taskColumns} FROM tasks JOIN task_weeks ON task_weeks.task_id=tasks.id WHERE tasks.workspace_id=? AND task_weeks.week = ? AND deleted_at IS NULL ORDER BY created_at DESC`,
        )
          .bind(actor.workspace_id, url.searchParams.get('week'))
          .all<Task>();
        return json(tasks.results.map(hydrate).filter(canSee));
      }
      if (url.pathname === '/api/tasks' && request.method === 'POST') {
        const b = (await request.json()) as Record<string, unknown>;
        if (!b || typeof b !== 'object')
          return json({ error: 'Dados inválidos.' }, 400);
        const assignees = parseAssignees(b.assignee_ids, b.assignee_id);
        if (
          actor.role !== 'coordinator' &&
          (assignees?.length !== 1 || assignees[0] !== actor.id)
        )
          return json(
            { error: 'Você pode criar atividades apenas para si mesmo.' },
            403,
          );
        if (
          typeof b.title !== 'string' ||
          !b.title.trim() ||
          b.title.length > 180 ||
          !assignees ||
          !validDate(b.week) ||
          (b.due_date && !validDate(b.due_date)) ||
          !['normal', 'high'].includes(String(b.priority)) ||
          typeof b.description !== 'string' ||
          b.description.length > 5000 ||
          typeof b.restricted !== 'boolean'
        )
          return json({ error: 'Confira os campos da atividade.' }, 400);
        if (!(await usersExist(env.DB, assignees, actor.workspace_id)))
          return json({ error: 'Responsável inválido.' }, 400);
        const id = crypto.randomUUID();
        await env.DB.batch([
          env.DB.prepare(
            'INSERT INTO tasks (id,title,description,assignee_id,created_by,week,due_date,priority,restricted,workspace_id) VALUES (?,?,?,?,?,?,?,?,?,?)',
          ).bind(
            id,
            b.title.trim(),
            b.description,
            assignees[0],
            actor.id,
            b.week,
            b.due_date || null,
            b.priority,
            b.restricted ? 1 : 0,
            actor.workspace_id,
          ),
          env.DB.prepare(
            'INSERT INTO events (id,task_id,actor_id,message) VALUES (?,?,?,?)',
          ).bind(crypto.randomUUID(), id, actor.id, 'Atividade criada'),
          env.DB.prepare(
            'INSERT INTO task_weeks(task_id,week,added_by) VALUES (?,?,?)',
          ).bind(id, b.week, actor.id),
          ...assignees
            .slice(1)
            .map((userId) =>
              env.DB.prepare(
                'INSERT INTO task_assignees(task_id,user_id) VALUES (?,?)',
              ).bind(id, userId),
            ),
        ]);
        return json({ id }, 201);
      }
      if (url.pathname === '/api/weeks/carry' && request.method === 'POST') {
        if (actor.role !== 'coordinator')
          return json(
            { error: 'Somente a coordenação pode planejar a continuidade.' },
            403,
          );
        const b = (await request.json()) as {
          week: string;
          task_ids: string[];
        };
        if (
          !b ||
          !validDate(b.week) ||
          new Date(b.week + 'T12:00:00').getDay() !== 0 ||
          !Array.isArray(b.task_ids) ||
          !b.task_ids.length ||
          b.task_ids.length > 100 ||
          b.task_ids.some((id) => typeof id !== 'string')
        )
          return json(
            { error: 'Selecione tarefas e uma semana iniciada no domingo.' },
            400,
          );
        const unique = [...new Set(b.task_ids)];
        const statements: D1PreparedStatement[] = [];
        for (const id of unique) {
          const t = await env.DB.prepare(
            'SELECT * FROM tasks WHERE id=? AND workspace_id=? AND deleted_at IS NULL',
          )
            .bind(id, actor.workspace_id)
            .first<Task>();
          if (!t || t.status === 'done' || b.week <= t.week)
            return json(
              {
                error:
                  'Selecione somente atividades não concluídas para uma semana posterior à original.',
              },
              400,
            );
          statements.push(
            env.DB.prepare(
              'INSERT INTO events(id,task_id,actor_id,message) SELECT ?,?,?,? WHERE NOT EXISTS(SELECT 1 FROM task_weeks WHERE task_id=? AND week=?)',
            ).bind(
              crypto.randomUUID(),
              id,
              actor.id,
              `Incluída no planejamento da semana ${b.week}. Prazo original preservado.`,
              id,
              b.week,
            ),
          );
          statements.push(
            env.DB.prepare(
              'INSERT OR IGNORE INTO task_weeks(task_id,week,added_by) VALUES (?,?,?)',
            ).bind(id, b.week, actor.id),
          );
        }
        await env.DB.batch(statements);
        return json({ ok: true });
      }
      const match = url.pathname.match(
        /^\/api\/tasks\/([^/]+)(\/events|\/comments|\/checklist)?$/,
      );
      if (match) {
        const row = await env.DB.prepare(
          `SELECT ${taskColumns} FROM tasks WHERE id = ? AND workspace_id=? AND deleted_at IS NULL`,
        )
          .bind(match[1], actor.workspace_id)
          .first<Task>();
        const task = row && hydrate(row);
        if (!task || !canSee(task))
          return json({ error: 'Atividade não encontrada.' }, 404);
        if (!match[2] && request.method === 'DELETE') {
          if (
            actor.role !== 'coordinator' &&
            (task.created_by !== actor.id ||
              !sameSet(task.assignee_ids, [actor.id]))
          )
            return json(
              {
                error:
                  'Você pode excluir apenas atividades que criou para si mesmo.',
              },
              403,
            );
          await env.DB.batch([
            env.DB.prepare('UPDATE tasks SET deleted_at = ? WHERE id = ?').bind(
              new Date().toISOString(),
              task.id,
            ),
            env.DB.prepare(
              'INSERT INTO events (id,task_id,actor_id,message) VALUES (?,?,?,?)',
            ).bind(
              crypto.randomUUID(),
              task.id,
              actor.id,
              'Atividade excluída',
            ),
          ]);
          return json({ ok: true });
        }
        if (match[2] === '/checklist') {
          const items = JSON.parse(
            (task as Task & { checklist: string }).checklist || '[]',
          ) as { id: string; text: string; done: boolean }[];
          if (request.method === 'GET') return json(items);
          if (request.method === 'PATCH') {
            if (actor.role !== 'coordinator' && !isAssignee(task))
              return json(
                {
                  error:
                    'Somente o responsável ou a coordenação pode atualizar as etapas.',
                },
                403,
              );
            const b = (await request.json()) as { id: string; done: boolean };
            if (
              !b ||
              typeof b.done !== 'boolean' ||
              !items.some((i) => i.id === b.id)
            )
              return json({ error: 'Etapa inválida.' }, 400);
            // JSON path updates preserve concurrent changes to other checklist items.
            const index = items.findIndex((i) => i.id === b.id);
            await env.DB.batch([
              env.DB.prepare(
                'UPDATE tasks SET checklist=json_set(checklist,?,json(?)) WHERE id=?',
              ).bind('$[' + index + '].done', JSON.stringify(b.done), task.id),
              env.DB.prepare(
                'INSERT INTO events(id,task_id,actor_id,message) VALUES (?,?,?,?)',
              ).bind(
                crypto.randomUUID(),
                task.id,
                actor.id,
                (b.done ? 'Etapa concluída: ' : 'Etapa reaberta: ') +
                  items[index].text,
              ),
            ]);
            return json({ ok: true });
          }
        }
        if (match[2] === '/comments') {
          if (request.method === 'GET')
            return json(
              (
                await env.DB.prepare(
                  'SELECT comments.*,users.name FROM comments JOIN users ON users.id=comments.author_id WHERE task_id=? ORDER BY comments.rowid',
                )
                  .bind(task.id)
                  .all()
              ).results,
            );
          if (request.method === 'POST') {
            const b = (await request.json()) as { body: string };
            if (
              !b ||
              typeof b.body !== 'string' ||
              !b.body.trim() ||
              b.body.length > 3000
            )
              return json(
                { error: 'Escreva um comentário de até 3.000 caracteres.' },
                400,
              );
            await env.DB.prepare(
              'INSERT INTO comments(id,task_id,author_id,body) VALUES (?,?,?,?)',
            )
              .bind(crypto.randomUUID(), task.id, actor.id, b.body.trim())
              .run();
            return json({ ok: true }, 201);
          }
        }
        if (match[2] === '/events' && request.method === 'GET')
          return json(
            (
              await env.DB.prepare(
                'SELECT events.*, users.name FROM events JOIN users ON users.id = events.actor_id WHERE task_id = ? ORDER BY events.rowid DESC',
              )
                .bind(task.id)
                .all()
            ).results,
          );
        if (!match[2] && request.method === 'PATCH') {
          if (actor.role !== 'coordinator' && !isAssignee(task))
            return json(
              { error: 'Você só pode atualizar suas atividades.' },
              403,
            );
          const b = (await request.json()) as {
            status?: Status;
            block_reason?: string;
            details?: {
              title: string;
              description: string;
              assignee_id?: string;
              assignee_ids?: string[];
              due_date: string;
              priority: string;
              restricted: boolean;
            };
          };
          if (!b || typeof b !== 'object')
            return json({ error: 'Dados inválidos.' }, 400);
          const nextStatus = b.status ?? task.status;
          const nextReason = b.block_reason ?? task.block_reason;
          if (
            !['progress', 'blocked', 'done'].includes(nextStatus) ||
            (b.block_reason !== undefined &&
              typeof b.block_reason !== 'string') ||
            (b.block_reason?.length || 0) > 1000 ||
            (nextStatus === 'blocked' && !nextReason?.trim())
          )
            return json(
              { error: 'Informe um status válido e o motivo do bloqueio.' },
              400,
            );
          const d = b.details;
          const nextAssignees = d
            ? parseAssignees(d.assignee_ids, d.assignee_id)
            : null;
          if (d) {
            if (actor.role !== 'coordinator' && task.created_by !== actor.id)
              return json(
                {
                  error:
                    'Você pode editar detalhes somente das atividades que criou.',
                },
                403,
              );
            if (
              typeof d.title !== 'string' ||
              !d.title.trim() ||
              d.title.length > 180 ||
              typeof d.description !== 'string' ||
              d.description.length > 5000 ||
              !nextAssignees ||
              typeof d.due_date !== 'string' ||
              (d.due_date && !validDate(d.due_date)) ||
              !['normal', 'high'].includes(d.priority) ||
              typeof d.restricted !== 'boolean'
            )
              return json({ error: 'Confira os detalhes da atividade.' }, 400);
            if (
              actor.role !== 'coordinator' &&
              (!sameSet(nextAssignees, task.assignee_ids) ||
                d.priority !== task.priority ||
                d.due_date !== (task.due_date || '') ||
                Number(d.restricted) !== task.restricted)
            )
              return json(
                {
                  error:
                    'Somente a coordenação altera responsável, prazo, prioridade e visibilidade.',
                },
                403,
              );
            if (
              (nextAssignees.includes(DELETED_USER_ID) &&
                !task.assignee_ids.includes(DELETED_USER_ID)) ||
              !(await usersExist(
                env.DB,
                nextAssignees.filter((id) => id !== DELETED_USER_ID),
                actor.workspace_id,
              ))
            )
              return json({ error: 'Responsável inválido.' }, 400);
          }
          const statements = [
            env.DB.prepare(
              'UPDATE tasks SET status = ?, block_reason = ?, completed_at = ? WHERE id = ?',
            ).bind(
              nextStatus,
              nextStatus === 'blocked' ? nextReason.trim() : '',
              nextStatus === 'done'
                ? task.status === 'done'
                  ? (task as Task & { completed_at: string }).completed_at
                  : new Date().toISOString()
                : null,
              task.id,
            ),
          ];
          if (
            nextStatus !== task.status ||
            (nextStatus === 'blocked' && nextReason !== task.block_reason)
          )
            statements.push(
              env.DB.prepare(
                'INSERT INTO events (id,task_id,actor_id,message) VALUES (?,?,?,?)',
              ).bind(
                crypto.randomUUID(),
                task.id,
                actor.id,
                `Status: ${nextStatus}${nextStatus === 'blocked' ? ' · ' + nextReason : ''}`,
              ),
            );
          if (d && nextAssignees) {
            const { assignee_id: _, assignee_ids: __, ...fields } = d;
            const changed = Object.entries(fields).filter(
              ([key, value]) =>
                String(value) !==
                  String(
                    (task as unknown as Record<string, unknown>)[key] ?? '',
                  ) &&
                !(key === 'restricted' && Number(value) === task.restricted),
            );
            // Order matters: the first selected member becomes the primary assignee.
            const assigneesChanged =
              nextAssignees.join() !== task.assignee_ids.join();
            if (assigneesChanged) {
              const names = (
                await env.DB.prepare(
                  `SELECT id,name FROM users WHERE id IN (${[...new Set([...task.assignee_ids, ...nextAssignees])].map(() => '?').join(',')})`,
                )
                  .bind(...new Set([...task.assignee_ids, ...nextAssignees]))
                  .all<{ id: string; name: string }>()
              ).results;
              const label = (ids: string[]) =>
                ids
                  .map((id) => names.find((u) => u.id === id)?.name || id)
                  .join(', ');
              changed.push([
                'responsáveis',
                `${label(task.assignee_ids)} → ${label(nextAssignees)}`,
              ]);
              statements.push(
                env.DB.prepare(
                  'DELETE FROM task_assignees WHERE task_id=?',
                ).bind(task.id),
                ...nextAssignees
                  .slice(1)
                  .map((userId) =>
                    env.DB.prepare(
                      'INSERT INTO task_assignees(task_id,user_id) VALUES (?,?)',
                    ).bind(task.id, userId),
                  ),
              );
            }
            if (changed.length) {
              statements.push(
                env.DB.prepare(
                  'UPDATE tasks SET title=?,description=?,assignee_id=?,due_date=?,priority=?,restricted=? WHERE id=?',
                ).bind(
                  d.title.trim(),
                  d.description,
                  nextAssignees[0],
                  d.due_date || null,
                  d.priority,
                  d.restricted ? 1 : 0,
                  task.id,
                ),
              );
              // Prazo changes are not logged; the history shows only the other fields.
              const logged = changed.filter(([key]) => key !== 'due_date');
              if (logged.length)
                statements.push(
                  env.DB.prepare(
                    'INSERT INTO events(id,task_id,actor_id,message) VALUES (?,?,?,?)',
                  ).bind(
                    crypto.randomUUID(),
                    task.id,
                    actor.id,
                    'Detalhes alterados: ' +
                      logged
                        .map(([key, value]) =>
                          key === 'responsáveis'
                            ? `${key}: ${String(value)}`
                            : `${key}: ${String((task as unknown as Record<string, unknown>)[key] ?? '')} → ${String(value)}`,
                        )
                        .join('; '),
                  ),
                );
            }
          }
          await env.DB.batch(statements);
          return json({ ok: true });
        }
      }
      return json({ error: 'Rota não encontrada.' }, 404);
    } catch (error) {
      if (error instanceof SyntaxError)
        return json({ error: 'Dados inválidos.' }, 400);
      console.error(error);
      return json({ error: 'Não foi possível processar a solicitação.' }, 500);
    }
  },
} satisfies ExportedHandler<Env>;
