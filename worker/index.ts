import type { User, Task, Status } from '../src/types';
import { authRoute, getActor, inviteUser, type AuthEnv } from './auth';
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
      const auth = await authRoute(request, env);
      if (auth) return auth;
      const actor = await getActor(request, env);
      if (!actor) return json({ error: 'Entre para continuar.' }, 401);
      const imported = await importRoute(request, env, actor);
      if (imported) return imported;
      const canSee = (task: Task) =>
        !task.restricted ||
        actor.role === 'coordinator' ||
        task.assignee_id === actor.id;
      if (url.pathname === '/api/users' && request.method === 'GET') {
        return json(
          (await env.DB.prepare('SELECT * FROM users ORDER BY name').all())
            .results,
        );
      }
      const userMatch = url.pathname.match(/^\/api\/users\/([^/]+)$/);
      const invitation = url.pathname.match(/^\/api\/users\/([^/]+)\/invite$/);
      if (invitation && request.method === 'POST')
        return inviteUser(request, env, actor, invitation[1]);
      if (
        (url.pathname === '/api/users' && request.method === 'POST') ||
        (userMatch && request.method === 'PATCH')
      ) {
        if (actor.role !== 'coordinator')
          return json(
            { error: 'Somente a coordenação pode gerenciar integrantes.' },
            403,
          );
        const b = (await request.json()) as Record<string, unknown>;
        if (
          !b ||
          typeof b.name !== 'string' ||
          !b.name.trim() ||
          b.name.length > 100 ||
          typeof b.job !== 'string' ||
          !b.job.trim() ||
          b.job.length > 120 ||
          !['coordinator', 'member'].includes(String(b.role)) ||
          typeof b.color !== 'string' ||
          !/^#[0-9a-fA-F]{6}$/.test(b.color)
        )
          return json(
            { error: 'Informe nome, cargo, perfil e uma cor válida.' },
            400,
          );
        const id = userMatch?.[1] || crypto.randomUUID();
        const current = userMatch
          ? await env.DB.prepare(
              'SELECT registration_email FROM users WHERE id=?',
            )
              .bind(id)
              .first<{ registration_email: string | null }>()
          : null;
        const registrationEmail =
          b.registration_email === undefined
            ? current?.registration_email || null
            : typeof b.registration_email === 'string'
              ? b.registration_email.trim().toLowerCase() || null
              : null;
        if (
          registrationEmail &&
          (!/^[^\s@]+@forest\.ind\.br$/.test(registrationEmail) ||
            registrationEmail.length > 254)
        )
          return json(
            { error: 'Informe um e-mail corporativo @forest.ind.br.' },
            400,
          );
        const existingAccount = await env.DB.prepare(
          'SELECT email FROM accounts WHERE user_id=?',
        )
          .bind(id)
          .first<{ email: string }>();
        if (existingAccount && registrationEmail !== existingAccount.email)
          return json(
            {
              error:
                'O e-mail deste acesso já foi confirmado e não pode ser alterado aqui.',
            },
            409,
          );
        if (
          registrationEmail &&
          (await env.DB.prepare(
            'SELECT id FROM users WHERE registration_email=? AND id!=?',
          )
            .bind(registrationEmail, id)
            .first())
        )
          return json(
            { error: 'Este e-mail já está vinculado a outro integrante.' },
            409,
          );
        if (userMatch) {
          if (id === actor.id && b.role !== 'coordinator')
            return json(
              {
                error:
                  'Você não pode remover seu próprio perfil de coordenador.',
              },
              409,
            );
          const result = await env.DB.prepare(
            'UPDATE users SET name = ?, job = ?, role = ?, color = ?, registration_email=? WHERE id = ?',
          )
            .bind(
              b.name.trim(),
              b.job.trim(),
              b.role,
              b.color.toLowerCase(),
              registrationEmail,
              id,
            )
            .run();
          if (!result.meta.changes)
            return json({ error: 'Integrante não encontrado.' }, 404);
        } else {
          await env.DB.prepare(
            'INSERT INTO users (id,name,job,role,color,registration_email) VALUES (?,?,?,?,?,?)',
          )
            .bind(
              id,
              b.name.trim(),
              b.job.trim(),
              b.role,
              b.color.toLowerCase(),
              registrationEmail,
            )
            .run();
        }
        return json(
          await env.DB.prepare('SELECT * FROM users WHERE id = ?')
            .bind(id)
            .first(),
          userMatch ? 200 : 201,
        );
      }
      if (url.pathname === '/api/tasks' && request.method === 'GET') {
        if (!validDate(url.searchParams.get('week')))
          return json({ error: 'Semana inválida.' }, 400);
        const tasks = await env.DB.prepare(
          'SELECT tasks.* FROM tasks JOIN task_weeks ON task_weeks.task_id=tasks.id WHERE task_weeks.week = ? AND deleted_at IS NULL ORDER BY created_at DESC',
        )
          .bind(url.searchParams.get('week'))
          .all<Task>();
        return json(tasks.results.filter(canSee));
      }
      if (url.pathname === '/api/tasks' && request.method === 'POST') {
        const b = (await request.json()) as Record<string, unknown>;
        if (!b || typeof b !== 'object')
          return json({ error: 'Dados inválidos.' }, 400);
        if (actor.role !== 'coordinator' && b.assignee_id !== actor.id)
          return json(
            { error: 'Você pode criar atividades apenas para si mesmo.' },
            403,
          );
        if (
          typeof b.title !== 'string' ||
          !b.title.trim() ||
          b.title.length > 180 ||
          typeof b.assignee_id !== 'string' ||
          !validDate(b.week) ||
          (b.due_date && !validDate(b.due_date)) ||
          !['normal', 'high'].includes(String(b.priority)) ||
          typeof b.description !== 'string' ||
          b.description.length > 5000 ||
          typeof b.restricted !== 'boolean'
        )
          return json({ error: 'Confira os campos da atividade.' }, 400);
        if (
          !(await env.DB.prepare('SELECT id FROM users WHERE id = ?')
            .bind(b.assignee_id)
            .first())
        )
          return json({ error: 'Responsável inválido.' }, 400);
        const id = crypto.randomUUID();
        await env.DB.batch([
          env.DB.prepare(
            'INSERT INTO tasks (id,title,description,assignee_id,created_by,week,due_date,priority,restricted) VALUES (?,?,?,?,?,?,?,?,?)',
          ).bind(
            id,
            b.title.trim(),
            b.description,
            b.assignee_id,
            actor.id,
            b.week,
            b.due_date || null,
            b.priority,
            b.restricted ? 1 : 0,
          ),
          env.DB.prepare(
            'INSERT INTO events (id,task_id,actor_id,message) VALUES (?,?,?,?)',
          ).bind(crypto.randomUUID(), id, actor.id, 'Atividade criada'),
          env.DB.prepare(
            'INSERT INTO task_weeks(task_id,week,added_by) VALUES (?,?,?)',
          ).bind(id, b.week, actor.id),
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
            'SELECT * FROM tasks WHERE id=? AND deleted_at IS NULL',
          )
            .bind(id)
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
        const task = await env.DB.prepare(
          'SELECT * FROM tasks WHERE id = ? AND deleted_at IS NULL',
        )
          .bind(match[1])
          .first<Task>();
        if (!task || !canSee(task))
          return json({ error: 'Atividade não encontrada.' }, 404);
        if (!match[2] && request.method === 'DELETE') {
          if (
            actor.role !== 'coordinator' &&
            (task.created_by !== actor.id || task.assignee_id !== actor.id)
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
            if (actor.role !== 'coordinator' && task.assignee_id !== actor.id)
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
          if (actor.role !== 'coordinator' && task.assignee_id !== actor.id)
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
              assignee_id: string;
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
              typeof d.assignee_id !== 'string' ||
              typeof d.due_date !== 'string' ||
              (d.due_date && !validDate(d.due_date)) ||
              !['normal', 'high'].includes(d.priority) ||
              typeof d.restricted !== 'boolean'
            )
              return json({ error: 'Confira os detalhes da atividade.' }, 400);
            if (
              actor.role !== 'coordinator' &&
              (d.assignee_id !== task.assignee_id ||
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
              !(await env.DB.prepare('SELECT id FROM users WHERE id=?')
                .bind(d.assignee_id)
                .first())
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
          if (d) {
            const changed = Object.entries(d).filter(
              ([key, value]) =>
                String(value) !==
                  String(
                    (task as unknown as Record<string, unknown>)[key] ?? '',
                  ) &&
                !(key === 'restricted' && Number(value) === task.restricted),
            );
            if (changed.length) {
              statements.push(
                env.DB.prepare(
                  'UPDATE tasks SET title=?,description=?,assignee_id=?,due_date=?,priority=?,restricted=? WHERE id=?',
                ).bind(
                  d.title.trim(),
                  d.description,
                  d.assignee_id,
                  d.due_date || null,
                  d.priority,
                  d.restricted ? 1 : 0,
                  task.id,
                ),
              );
              statements.push(
                env.DB.prepare(
                  'INSERT INTO events(id,task_id,actor_id,message) VALUES (?,?,?,?)',
                ).bind(
                  crypto.randomUUID(),
                  task.id,
                  actor.id,
                  'Detalhes alterados: ' +
                    changed
                      .map(
                        ([key, value]) =>
                          `${key}: ${String((task as unknown as Record<string, unknown>)[key] ?? '')} → ${String(value)}`,
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
