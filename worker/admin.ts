import { deleteProfileRoute } from './delete-profile';
import { getAccount, reply, type AuthEnv, type Account } from './auth';
const text = (v: unknown, max = 120): v is string =>
  typeof v === 'string' && !!v.trim() && v.length <= max;
export async function adminRoute(
  r: Request,
  env: AuthEnv,
): Promise<Response | null> {
  const path = new URL(r.url).pathname;
  if (!path.startsWith('/api/admin/')) return null;
  const actor = await getAccount(r, env);
  if (!actor) return reply({ error: 'Entre com a Microsoft.' }, 401);
  if (!actor.is_admin || actor.access_status !== 'active')
    return reply(
      { error: 'Somente o administrador pode gerenciar setores e acessos.' },
      403,
    );
  if (path === '/api/admin/profile-deletion')
    return deleteProfileRoute(r, env, actor);
  if (path === '/api/admin/state' && r.method === 'GET') {
    const [users, workspaces, memberships, audit, requests] = await Promise.all(
      [
        env.DB.prepare(
          `SELECT u.id,u.name,u.job,u.color,u.access_status,u.is_admin,u.onboarding_required,u.registration_email,i.email,i.tenant_id,i.object_id,i.display_name FROM users u LEFT JOIN corporate_identities i ON i.user_id=u.id WHERE u.access_status!='merged' ORDER BY u.name`,
        ).all(),
        env.DB.prepare('SELECT * FROM workspaces ORDER BY name').all(),
        env.DB.prepare('SELECT * FROM workspace_memberships').all(),
        env.DB.prepare(
          'SELECT a.*,u.name FROM admin_audit a JOIN users u ON u.id=a.actor_id ORDER BY a.rowid DESC LIMIT 50',
        ).all(),
        env.DB.prepare(
          "SELECT a.*,i.email,i.display_name,u.access_status FROM access_requests a JOIN corporate_identities i ON i.user_id=a.user_id JOIN users u ON u.id=a.user_id WHERE u.access_status!='merged' ORDER BY CASE a.status WHEN 'submitted' THEN 0 ELSE 1 END,a.submitted_at DESC",
        ).all(),
      ],
    );
    return reply({
      requests: requests.results,
      users: users.results,
      workspaces: workspaces.results,
      memberships: memberships.results,
      audit: audit.results,
    });
  }
  if (r.method !== 'POST') return reply({ error: 'Rota inválida.' }, 404);
  const raw = await r.text();
  if (raw.length > 12000)
    return reply({ error: 'Solicitação muito grande.' }, 413);
  const b = JSON.parse(raw) as Record<string, unknown>;
  if (!b || typeof b !== 'object')
    return reply({ error: 'Dados inválidos.' }, 400);
  const statements: D1PreparedStatement[] = [];
  let action = '',
    details = '';
  if (path === '/api/admin/review') {
    if (
      !text(b.user_id) ||
      !['approve', 'reject'].includes(String(b.decision)) ||
      typeof b.note !== 'string' ||
      b.note.length > 1000
    )
      return reply({ error: 'Revise os dados da decisão.' }, 400);
    if (b.decision === 'reject' && !b.note.trim())
      return reply({ error: 'Informe o motivo para orientar a pessoa.' }, 400);
    const pending = await env.DB.prepare(
      "SELECT a.* FROM access_requests a JOIN users u ON u.id=a.user_id WHERE a.user_id=? AND a.status='submitted' AND u.access_status='pending' AND u.is_admin=0",
    )
      .bind(b.user_id)
      .first<{ name: string; job: string }>();
    if (!pending)
      return reply(
        {
          error: 'Esta solicitação já foi analisada ou o acesso foi alterado.',
        },
        409,
      );
    if (b.decision === 'approve') {
      if (
        !text(b.workspace_id) ||
        !['member', 'coordinator'].includes(String(b.role))
      )
        return reply({ error: 'Escolha o setor autorizado e a função.' }, 400);
      const workspace = await env.DB.prepare(
        'SELECT id FROM workspaces WHERE id=? AND active=1',
      )
        .bind(b.workspace_id)
        .first();
      if (!workspace) return reply({ error: 'Escolha um setor ativo.' }, 400);
    }
    const decision = crypto.randomUUID();
    const guard =
      'EXISTS(SELECT 1 FROM access_requests WHERE user_id=? AND decision_id=?)';
    const review = [
      env.DB.prepare(
        "UPDATE access_requests SET status=?,reviewed_by=?,reviewed_at=CURRENT_TIMESTAMP,review_note=?,decision_id=? WHERE user_id=? AND status='submitted' AND EXISTS(SELECT 1 FROM users WHERE id=? AND access_status='pending')",
      ).bind(
        b.decision === 'approve' ? 'approved' : 'rejected',
        actor.id,
        b.note.trim(),
        decision,
        b.user_id,
        b.user_id,
      ),
    ];
    if (b.decision === 'approve')
      review.push(
        env.DB.prepare(
          'DELETE FROM workspace_memberships WHERE user_id=? AND ' + guard,
        ).bind(b.user_id, b.user_id, decision),
        env.DB.prepare(
          "UPDATE users SET name=?,job=?,access_status='active',onboarding_required=0 WHERE id=? AND " +
            guard,
        ).bind(pending.name, pending.job, b.user_id, b.user_id, decision),
        env.DB.prepare(
          'INSERT INTO workspace_memberships(workspace_id,user_id,role) SELECT ?,?,? WHERE ' +
            guard +
            ' ON CONFLICT(workspace_id,user_id) DO UPDATE SET role=excluded.role',
        ).bind(b.workspace_id, b.user_id, b.role, b.user_id, decision),
      );
    review.push(
      env.DB.prepare(
        'INSERT INTO admin_audit(id,actor_id,action,details) SELECT ?,?,?,? WHERE ' +
          guard,
      ).bind(
        crypto.randomUUID(),
        actor.id,
        'review',
        JSON.stringify({
          user_id: b.user_id,
          decision: b.decision,
          workspace_id: b.decision === 'approve' ? b.workspace_id : null,
          role: b.decision === 'approve' ? b.role : null,
          note: b.note.trim(),
        }),
        b.user_id,
        decision,
      ),
    );
    const result = await env.DB.batch(review);
    return result[0].meta.changes
      ? reply({ ok: true })
      : reply(
          { error: 'A solicitação mudou durante a análise. Atualize a lista.' },
          409,
        );
  } else if (path === '/api/admin/workspace') {
    if (
      !text(b.name) ||
      (b.active !== undefined && typeof b.active !== 'boolean') ||
      (b.id !== undefined && !text(b.id))
    )
      return reply({ error: 'Informe o nome do setor.' }, 400);
    const id = (b.id as string) || crypto.randomUUID();
    if (
      b.id &&
      !(await env.DB.prepare('SELECT id FROM workspaces WHERE id=?')
        .bind(id)
        .first())
    )
      return reply({ error: 'Setor não encontrado.' }, 404);
    statements.push(
      env.DB.prepare(
        'INSERT INTO workspaces(id,name,active) VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,active=excluded.active',
      ).bind(id, b.name.trim(), b.active === false ? 0 : 1),
    );
    action = 'workspace';
    details = JSON.stringify({ id, name: b.name, active: b.active !== false });
  } else if (path === '/api/admin/access') {
    if (
      !text(b.user_id) ||
      !['active', 'blocked', 'pending'].includes(String(b.status))
    )
      return reply({ error: 'Acesso inválido.' }, 400);
    const target = await env.DB.prepare(
      'SELECT u.*,i.object_id FROM users u LEFT JOIN corporate_identities i ON i.user_id=u.id WHERE u.id=?',
    )
      .bind(b.user_id)
      .first<Account & { object_id: string | null }>();
    if (!target || !target.object_id || target.access_status === 'merged')
      return reply(
        {
          error:
            'A pessoa precisa fazer o primeiro login Microsoft antes da liberação.',
        },
        400,
      );
    if (target.is_admin)
      return reply(
        { error: 'O acesso do administrador principal não pode ser alterado.' },
        409,
      );
    if (
      b.status === 'active' &&
      target.onboarding_required === 1 &&
      !(await env.DB.prepare(
        "SELECT user_id FROM access_requests WHERE user_id=? AND status='approved'",
      )
        .bind(b.user_id)
        .first())
    )
      return reply(
        {
          error:
            'A pessoa precisa enviar o formulário e ter a solicitação aprovada na seção Solicitações de acesso.',
        },
        409,
      );
    statements.push(
      env.DB.prepare('UPDATE users SET access_status=? WHERE id=?').bind(
        b.status,
        b.user_id,
      ),
    );
    if (b.status !== 'active')
      statements.push(
        env.DB.prepare('DELETE FROM corporate_sessions WHERE user_id=?').bind(
          b.user_id,
        ),
      );
    action = 'access';
    details = JSON.stringify({ user_id: b.user_id, status: b.status });
  } else if (path === '/api/admin/membership') {
    if (
      !text(b.user_id) ||
      !text(b.workspace_id) ||
      !['member', 'coordinator', 'remove'].includes(String(b.role))
    )
      return reply({ error: 'Escolha pessoa, setor e função.' }, 400);
    const user = await env.DB.prepare(
      `SELECT id FROM users WHERE id=? AND access_status!='merged'`,
    )
      .bind(b.user_id)
      .first();
    const workspace = await env.DB.prepare(
      'SELECT id FROM workspaces WHERE id=?',
    )
      .bind(b.workspace_id)
      .first();
    if (!user || !workspace)
      return reply({ error: 'Pessoa ou setor não encontrado.' }, 404);
    statements.push(
      b.role === 'remove'
        ? env.DB.prepare(
            'DELETE FROM workspace_memberships WHERE user_id=? AND workspace_id=?',
          ).bind(b.user_id, b.workspace_id)
        : env.DB.prepare(
            'INSERT INTO workspace_memberships VALUES(?,?,?) ON CONFLICT(workspace_id,user_id) DO UPDATE SET role=excluded.role',
          ).bind(b.workspace_id, b.user_id, b.role),
    );
    action = 'membership';
    details = JSON.stringify(b);
  } else if (path === '/api/admin/link') {
    if (
      !text(b.source_id) ||
      !text(b.target_id) ||
      b.source_id === b.target_id ||
      b.confirm !== true
    )
      return reply(
        { error: 'Confirme a identidade e o perfil histórico escolhido.' },
        400,
      );
    const source = await env.DB.prepare(
      'SELECT u.*,i.object_id FROM users u JOIN corporate_identities i ON i.user_id=u.id WHERE u.id=?',
    )
      .bind(b.source_id)
      .first<Account & { object_id: string }>();
    const target = await env.DB.prepare(
      `SELECT u.id FROM users u LEFT JOIN corporate_identities i ON i.user_id=u.id WHERE u.id=? AND i.user_id IS NULL AND u.access_status!='merged' AND u.is_admin=0`,
    )
      .bind(b.target_id)
      .first();
    if (!source || !target)
      return reply(
        {
          error:
            'Escolha uma identidade Microsoft e um perfil antigo ainda não vinculado.',
        },
        409,
      );
    if (
      await env.DB.prepare(
        'SELECT user_id FROM access_requests WHERE user_id=?',
      )
        .bind(b.target_id)
        .first()
    )
      return reply(
        {
          error:
            'O perfil de destino já possui uma solicitação. Revise os cadastros antes de vincular.',
        },
        409,
      );
    const hasTasks = await env.DB.prepare(
      'SELECT id FROM tasks WHERE assignee_id=? OR created_by=? UNION SELECT task_id AS id FROM task_assignees WHERE user_id=? LIMIT 1',
    )
      .bind(b.source_id, b.source_id, b.source_id)
      .first();
    if (hasTasks)
      return reply(
        {
          error:
            'O novo perfil já possui atividades. A vinculação exige revisão manual para preservar os dois históricos.',
        },
        409,
      );
    statements.push(
      env.DB.prepare(
        'UPDATE access_requests SET user_id=? WHERE user_id=?',
      ).bind(b.target_id, b.source_id),
      env.DB.prepare(
        'UPDATE corporate_identities SET user_id=? WHERE user_id=?',
      ).bind(b.target_id, b.source_id),
      env.DB.prepare(
        'UPDATE corporate_sessions SET user_id=? WHERE user_id=?',
      ).bind(b.target_id, b.source_id),
      env.DB.prepare(
        'UPDATE users SET access_status=?,is_admin=?,onboarding_required=? WHERE id=?',
      ).bind(
        source.access_status,
        source.is_admin,
        source.onboarding_required,
        b.target_id,
      ),
      env.DB.prepare(
        `UPDATE users SET access_status='merged',is_admin=0 WHERE id=?`,
      ).bind(b.source_id),
      env.DB.prepare('DELETE FROM workspace_memberships WHERE user_id=?').bind(
        b.source_id,
      ),
    );
    action = 'link';
    details = JSON.stringify({
      source_id: b.source_id,
      target_id: b.target_id,
      object_id: source.object_id,
    });
  } else return reply({ error: 'Rota não encontrada.' }, 404);
  statements.push(
    env.DB.prepare(
      'INSERT INTO admin_audit(id,actor_id,action,details) VALUES(?,?,?,?)',
    ).bind(crypto.randomUUID(), actor.id, action, details),
  );
  await env.DB.batch(statements);
  return reply({ ok: true });
}
