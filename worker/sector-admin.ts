import { reply, type Account, type AuthEnv } from './auth';

// Used both to filter reads and inside writes: a stale screen cannot retain
// management rights after its coordinator membership has been revoked.
const managed = `SELECT w.id FROM workspaces w JOIN workspace_memberships m ON m.workspace_id=w.id
  JOIN users a ON a.id=m.user_id WHERE m.user_id=? AND m.role='coordinator'
  AND w.active=1 AND a.access_status='active' AND a.onboarding_required=0`;
const authority = `EXISTS(SELECT 1 FROM users a WHERE a.id=? AND a.access_status='active' AND
  (a.is_admin=1 OR (a.onboarding_required=0 AND EXISTS(SELECT 1 FROM workspace_memberships am
  JOIN workspaces aw ON aw.id=am.workspace_id WHERE am.user_id=a.id AND am.workspace_id=?
  AND am.role='coordinator' AND aw.active=1))))`;

export async function sectorAdminRoute(
  r: Request,
  env: AuthEnv,
  actor: Account,
): Promise<Response | null> {
  const url = new URL(r.url),
    path = url.pathname;
  if (!actor.is_admin) {
    const sectors = await env.DB.prepare(managed).bind(actor.id).all();
    if (!sectors.results.length)
      return reply(
        { error: 'Você não possui coordenação de um setor ativo.' },
        403,
      );
    if (path === '/api/admin/state' && r.method === 'GET') {
      const [users, workspaces, memberships, audit] = await Promise.all([
        env.DB.prepare(
          `SELECT DISTINCT u.id,u.name,u.job,u.color,u.microsoft_photo,u.access_status,u.is_admin,u.onboarding_required,
          NULL AS registration_email,i.email,NULL AS tenant_id,i.object_id,i.display_name
          FROM users u JOIN workspace_memberships m ON m.user_id=u.id LEFT JOIN corporate_identities i ON i.user_id=u.id
          WHERE u.access_status!='merged' AND m.workspace_id IN (${managed}) ORDER BY u.name`,
        )
          .bind(actor.id)
          .all(),
        env.DB.prepare(
          `SELECT * FROM workspaces WHERE id IN (${managed}) ORDER BY name`,
        )
          .bind(actor.id)
          .all(),
        env.DB.prepare(
          `SELECT m.*,p.job AS sector_job FROM workspace_memberships m LEFT JOIN workspace_member_profiles p
          ON p.workspace_id=m.workspace_id AND p.user_id=m.user_id WHERE m.workspace_id IN (${managed})`,
        )
          .bind(actor.id)
          .all(),
        env.DB.prepare(
          `SELECT a.*,u.name FROM admin_audit a JOIN users u ON u.id=a.actor_id
          WHERE a.action IN ('membership','member-profile') AND json_extract(a.details,'$.workspace_id') IN (${managed})
          ORDER BY a.rowid DESC LIMIT 50`,
        )
          .bind(actor.id)
          .all(),
      ]);
      return reply({
        scope: 'sector',
        users: users.results,
        workspaces: workspaces.results,
        memberships: memberships.results,
        audit: audit.results,
        requests: [],
      });
    }
  }
  if (path === '/api/admin/candidates' && r.method === 'GET') {
    const query = url.searchParams.get('q')?.trim() || '';
    if (query.length < 2 || query.length > 120) return reply({ users: [] });
    const result = await env.DB.prepare(
      `SELECT u.id,u.name,i.email FROM users u JOIN corporate_identities i ON i.user_id=u.id
      WHERE u.access_status='active' AND u.onboarding_required=0 AND (?=1 OR u.is_admin=0) AND (u.name LIKE ? ESCAPE '\\' OR i.email LIKE ? ESCAPE '\\') ORDER BY u.name LIMIT 20`,
    )
      .bind(
        actor.is_admin,
        ...Array(2).fill('%' + query.replace(/[\\%_]/g, '\\$&') + '%'),
      )
      .all();
    return reply({ users: result.results });
  }
  if (actor.is_admin && path !== '/api/admin/member-profile') return null;
  if (
    !['/api/admin/membership', '/api/admin/member-profile'].includes(path) ||
    r.method !== 'POST'
  )
    return reply(
      { error: 'Esta operação é exclusiva dos administradores do sistema.' },
      403,
    );
  const raw = await r.text();
  if (raw.length > 12000)
    return reply({ error: 'Solicitação muito grande.' }, 413);
  const b = JSON.parse(raw) as Record<string, unknown>;
  if (
    !b ||
    typeof b.user_id !== 'string' ||
    typeof b.workspace_id !== 'string' ||
    !b.user_id ||
    !b.workspace_id
  )
    return reply({ error: 'Escolha pessoa e setor.' }, 400);
  const canManage = await env.DB.prepare(`SELECT 1 WHERE ${authority}`)
    .bind(actor.id, b.workspace_id)
    .first();
  if (!canManage)
    return reply({ error: 'Você não pode gerenciar este setor.' }, 403);
  const target = await env.DB.prepare(
    `SELECT u.*,m.role AS sector_role FROM users u
    LEFT JOIN workspace_memberships m ON m.user_id=u.id AND m.workspace_id=? WHERE u.id=? AND u.access_status!='merged'`,
  )
    .bind(b.workspace_id, b.user_id)
    .first<Account & { sector_role: string | null }>();
  if (!target) return reply({ error: 'Pessoa não encontrada.' }, 404);
  if (
    !actor.is_admin &&
    (target.sector_role === 'coordinator' ||
      target.is_admin ||
      target.id === actor.id)
  )
    return reply(
      {
        error:
          'Somente um administrador pode alterar coordenadores e administradores.',
      },
      403,
    );
  const validTarget = `EXISTS(SELECT 1 FROM users t WHERE t.id=? AND t.access_status!='merged'
    AND (?=1 OR (t.is_admin=0 AND t.id!=? AND NOT EXISTS(SELECT 1 FROM workspace_memberships tm
      WHERE tm.user_id=t.id AND tm.workspace_id=? AND tm.role='coordinator'))))`;
  const guard = `${authority} AND ${validTarget}`;
  const args = [
    actor.id,
    b.workspace_id,
    b.user_id,
    actor.is_admin,
    actor.id,
    b.workspace_id,
  ];
  let write: D1PreparedStatement;
  if (path.endsWith('member-profile')) {
    if (!target.sector_role || typeof b.job !== 'string' || b.job.length > 120)
      return reply(
        {
          error:
            'Informe um cargo de até 120 caracteres para um integrante do setor.',
        },
        400,
      );
    write = env.DB.prepare(
      `INSERT INTO workspace_member_profiles(workspace_id,user_id,job)
      SELECT ?,?,? WHERE ${guard} AND EXISTS(SELECT 1 FROM workspace_memberships WHERE user_id=? AND workspace_id=?)
      ON CONFLICT(workspace_id,user_id) DO UPDATE SET job=excluded.job`,
    ).bind(
      b.workspace_id,
      b.user_id,
      b.job.trim(),
      ...args,
      b.user_id,
      b.workspace_id,
    );
  } else {
    if (!['member', 'remove'].includes(String(b.role)))
      return reply(
        { error: 'Somente administradores podem definir coordenadores.' },
        403,
      );
    if (
      b.role !== 'remove' &&
      (target.access_status !== 'active' ||
        target.onboarding_required ||
        !(await env.DB.prepare(
          'SELECT user_id FROM corporate_identities WHERE user_id=?',
        )
          .bind(b.user_id)
          .first()))
    )
      return reply(
        {
          error: 'Somente pessoas com cadastro aprovado podem ser adicionadas.',
        },
        409,
      );
    write =
      b.role === 'remove'
        ? env.DB.prepare(
            `DELETE FROM workspace_memberships WHERE user_id=? AND workspace_id=? AND ${guard}`,
          ).bind(b.user_id, b.workspace_id, ...args)
        : env.DB.prepare(
            `INSERT INTO workspace_memberships(workspace_id,user_id,role) SELECT ?,?,'member' WHERE ${guard}
        AND EXISTS(SELECT 1 FROM users t JOIN corporate_identities i ON i.user_id=t.id WHERE t.id=? AND t.access_status='active' AND t.onboarding_required=0)
        ON CONFLICT(workspace_id,user_id) DO UPDATE SET role=excluded.role`,
          ).bind(b.workspace_id, b.user_id, ...args, b.user_id);
  }
  const result = await env.DB.batch([
    write,
    env.DB.prepare(
      `INSERT INTO admin_audit(id,actor_id,action,details) SELECT ?,?,?,? WHERE changes()>0`,
    ).bind(
      crypto.randomUUID(),
      actor.id,
      path.endsWith('member-profile') ? 'member-profile' : 'membership',
      JSON.stringify({
        user_id: b.user_id,
        workspace_id: b.workspace_id,
        ...(path.endsWith('member-profile')
          ? { job: String(b.job).trim() }
          : { role: b.role }),
      }),
    ),
  ]);
  return result[0].meta.changes
    ? reply({ ok: true })
    : reply(
        { error: 'O acesso ou a participação mudou. Atualize a lista.' },
        409,
      );
}
