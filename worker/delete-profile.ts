import {
  reply,
  ADMIN_OBJECT,
  ADMIN_TENANT,
  type AuthEnv,
  type Account,
} from './auth';
import { DELETED_USER_ID } from '../src/types';
export async function deleteProfileRoute(
  r: Request,
  env: AuthEnv,
  actor: Account,
) {
  if (!['GET', 'POST'].includes(r.method))
    return reply({ error: 'Método inválido.' }, 405);
  let body: Record<string, unknown> = {};
  if (r.method === 'POST') {
    const raw = await r.text();
    if (raw.length > 4000)
      return reply({ error: 'Solicitação muito grande.' }, 413);
    body = JSON.parse(raw);
  }
  const id =
    r.method === 'GET'
      ? new URL(r.url).searchParams.get('user_id')
      : body?.user_id;
  if (typeof id !== 'string' || !id || id.length > 150)
    return reply({ error: 'Perfil inválido.' }, 400);
  const target = await env.DB.prepare(
    'SELECT u.id,u.name,u.is_admin,i.email,i.tenant_id,i.object_id FROM users u LEFT JOIN corporate_identities i ON i.user_id=u.id WHERE u.id=?',
  )
    .bind(id)
    .first<{
      id: string;
      name: string;
      is_admin: number;
      email: string | null;
      tenant_id: string | null;
      object_id: string | null;
    }>();
  if (!target) return reply({ error: 'Perfil não encontrado.' }, 404);
  if (
    target.is_admin ||
    id === actor.id ||
    id === DELETED_USER_ID ||
    (target.tenant_id === ADMIN_TENANT && target.object_id === ADMIN_OBJECT)
  )
    return reply(
      {
        error:
          'O administrador principal e a identificação de usuários excluídos não podem ser excluídos.',
      },
      409,
    );
  if (r.method === 'GET') {
    const counts = await env.DB.prepare(
      `SELECT
   (SELECT count(*) FROM tasks t WHERE t.assignee_id=? OR t.created_by=? OR EXISTS(SELECT 1 FROM task_assignees a WHERE a.task_id=t.id AND a.user_id=?)) tasks,
   (SELECT count(*) FROM comments WHERE author_id=?) comments,
   (SELECT count(*) FROM events WHERE actor_id=?) events`,
    )
      .bind(id, id, id, id, id)
      .first();
    return reply({
      id: target.id,
      name: target.name,
      email: target.email,
      ...counts,
    });
  }
  if (body.confirm !== true || body.confirm_name !== target.name)
    return reply(
      { error: 'Digite o nome completo exibido para confirmar a exclusão.' },
      400,
    );
  // The same guard runs inside every statement of the atomic batch, preventing stale actions
  // from touching a profile that was linked to the administrator in the meantime.
  const guard = `EXISTS(SELECT 1 FROM users protected WHERE protected.id=? AND protected.name=? AND protected.is_admin=0 AND protected.id!=? AND protected.id!=? AND NOT EXISTS(SELECT 1 FROM corporate_identities ci WHERE ci.user_id=protected.id AND ci.tenant_id=? AND ci.object_id=?))`;
  const guardArgs = [
    id,
    target.name,
    actor.id,
    DELETED_USER_ID,
    ADMIN_TENANT,
    ADMIN_OBJECT,
  ];
  const stmt = (sql: string, ...args: unknown[]) =>
    env.DB.prepare(sql + ' AND ' + guard).bind(...args, ...guardArgs);
  const d = DELETED_USER_ID;
  const statements = [
    env.DB.prepare(
      `INSERT OR IGNORE INTO users(id,name,role,job,color,access_status,is_admin,onboarding_required) SELECT ?,'Usuário excluído','member','Registro histórico','#7d9a96','merged',0,1 WHERE ` +
        guard,
    ).bind(d, ...guardArgs),
    // Coalesce anonymized participants without violating the unique (task,user) key.
    stmt(
      'DELETE FROM task_assignees WHERE user_id=? AND (EXISTS(SELECT 1 FROM tasks t WHERE t.id=task_assignees.task_id AND t.assignee_id=?) OR EXISTS(SELECT 1 FROM task_assignees a WHERE a.task_id=task_assignees.task_id AND a.user_id=?))',
      id,
      d,
      d,
    ),
    stmt('UPDATE task_assignees SET user_id=? WHERE user_id=?', d, id),
    stmt(
      'DELETE FROM task_assignees WHERE user_id=? AND task_id IN(SELECT id FROM tasks WHERE assignee_id=?)',
      d,
      id,
    ),
    stmt(
      'UPDATE tasks SET assignee_id=CASE WHEN assignee_id=? THEN ? ELSE assignee_id END,created_by=CASE WHEN created_by=? THEN ? ELSE created_by END WHERE (assignee_id=? OR created_by=?)',
      id,
      d,
      id,
      d,
      id,
      id,
    ),
    stmt('UPDATE comments SET author_id=? WHERE author_id=?', d, id),
    stmt('UPDATE events SET actor_id=? WHERE actor_id=?', d, id),
    stmt('UPDATE task_weeks SET added_by=? WHERE added_by=?', d, id),
    stmt('UPDATE task_imports SET actor_id=? WHERE actor_id=?', d, id),
    stmt('UPDATE admin_audit SET actor_id=? WHERE actor_id=?', d, id),
    stmt('UPDATE access_requests SET reviewed_by=? WHERE reviewed_by=?', d, id),
    ...[
      'corporate_sessions',
      'corporate_identities',
      'workspace_memberships',
      'access_requests',
      'accounts',
      'sessions',
      'invites',
    ].map((table) => stmt('DELETE FROM ' + table + ' WHERE user_id=?', id)),
    stmt('DELETE FROM team_sessions WHERE profile_id=?', id),
    env.DB.prepare(
      'INSERT INTO admin_audit(id,actor_id,action,details) SELECT ?,?,?,? WHERE ' +
        guard,
    ).bind(
      crypto.randomUUID(),
      actor.id,
      'delete_profile',
      JSON.stringify({ user_id: id, history: 'preserved_as_deleted_user' }),
      ...guardArgs,
    ),
    stmt('DELETE FROM users WHERE id=?', id),
  ];
  const result = await env.DB.batch(statements);
  return result[result.length - 1].meta.changes
    ? reply({ ok: true })
    : reply(
        {
          error:
            'O perfil mudou durante a confirmação. Atualize a lista e confira novamente.',
        },
        409,
      );
}
