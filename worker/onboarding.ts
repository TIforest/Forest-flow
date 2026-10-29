import { getAccount, reply, type AuthEnv } from './auth';
export async function onboardingRoute(
  r: Request,
  env: AuthEnv,
): Promise<Response | null> {
  if (new URL(r.url).pathname !== '/api/auth/onboarding') return null;
  const user = await getAccount(r, env);
  if (!user)
    return reply(
      { error: 'Entre com a Microsoft para preencher seu cadastro.' },
      401,
    );
  if (user.access_status !== 'pending' || user.is_admin)
    return reply(
      {
        error:
          'Seu acesso não está aguardando cadastro. Solicite alterações ao administrador.',
      },
      403,
    );
  if (r.method !== 'POST') return reply({ error: 'Método inválido.' }, 405);
  const raw = await r.text();
  if (raw.length > 8000)
    return reply({ error: 'Formulário muito grande.' }, 413);
  const b = JSON.parse(raw) as Record<string, unknown>;
  const valid = (v: unknown, max: number, required = true): v is string =>
    typeof v === 'string' && v.length <= max && (!required || !!v.trim());
  if (
    !b ||
    !valid(b.name, 100) ||
    !valid(b.job, 120) ||
    !valid(b.department, 120) ||
    !valid(b.unit ?? '', 120, false) ||
    !valid(b.notes ?? '', 1000, false)
  )
    return reply(
      { error: 'Preencha nome, cargo e setor. Confira os limites dos campos.' },
      400,
    );
  const result = await env.DB.prepare(
    `INSERT INTO access_requests(user_id,name,job,department,unit,notes)
 SELECT ?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM users WHERE id=? AND access_status='pending' AND is_admin=0)
 ON CONFLICT(user_id) DO UPDATE SET name=excluded.name,job=excluded.job,department=excluded.department,unit=excluded.unit,notes=excluded.notes,status='submitted',submitted_at=CURRENT_TIMESTAMP,reviewed_at=NULL,reviewed_by=NULL,review_note='',decision_id=NULL WHERE access_requests.status='rejected'`,
  )
    .bind(
      user.id,
      b.name.trim(),
      b.job.trim(),
      b.department.trim(),
      String(b.unit ?? '').trim(),
      String(b.notes ?? '').trim(),
      user.id,
    )
    .run();
  if (!result.meta.changes)
    return reply(
      {
        error:
          'Sua solicitação já foi enviada ou seu acesso mudou. Atualize a página para conferir.',
      },
      409,
    );
  return reply({ ok: true }, 201);
}
