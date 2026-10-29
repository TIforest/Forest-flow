import { getAccount, reply, digest, type AuthEnv } from './auth';
import { allowedPushEndpoint, decode, pushRequest } from './web-push';
export interface NotificationEnv extends AuthEnv {
  VAPID_PUBLIC_KEY?: string;
  VAPID_PRIVATE_KEY?: string;
}
// Alias n is the notification and u its recipient. Apply on reads AND delivery.
const visible = `u.access_status IN ('active','pending')
 AND (n.reminder_date IS NULL OR EXISTS(SELECT 1 FROM tasks reminder WHERE reminder.id=n.task_id AND reminder.status!='done' AND reminder.due_date=n.reminder_due_date AND (reminder.assignee_id=u.id OR EXISTS(SELECT 1 FROM task_assignees ra WHERE ra.task_id=reminder.id AND ra.user_id=u.id)))) AND (
 (n.kind='access_request' AND u.access_status='active' AND u.is_admin=1) OR
 (n.kind='access_review') OR (n.kind='test' AND u.access_status='active') OR
 (n.task_id IS NOT NULL AND u.access_status='active' AND (u.is_admin=1 OR u.onboarding_required=0)
  AND EXISTS(SELECT 1 FROM tasks t JOIN workspaces w ON w.id=t.workspace_id
   WHERE t.id=n.task_id AND t.deleted_at IS NULL AND w.active=1 AND
   (u.is_admin=1 OR EXISTS(SELECT 1 FROM workspace_memberships m WHERE m.user_id=u.id AND m.workspace_id=w.id AND
    (t.restricted=0 OR m.role='coordinator' OR t.assignee_id=u.id OR EXISTS(SELECT 1 FROM task_assignees a WHERE a.task_id=t.id AND a.user_id=u.id)))))))`;
export function taskNotices(
  db: D1Database,
  recipients: string[],
  actor: string,
  task: string,
  workspace: string,
  title: string,
  kind = 'assignment',
) {
  return [...new Set(recipients)]
    .filter((id) => id !== actor)
    .map((id) =>
      db
        .prepare(
          'INSERT INTO notifications(id,user_id,kind,title,body,workspace_id,task_id) VALUES(?,?,?,?,?,?,?)',
        )
        .bind(
          crypto.randomUUID(),
          id,
          kind,
          kind === 'assignment'
            ? 'Atividade atribuída a você'
            : kind === 'comment'
              ? 'Novo comentário'
              : 'Atividade atualizada',
          title.slice(0, 180),
          workspace,
          task,
        ),
    );
}
export async function notificationsRoute(
  r: Request,
  env: NotificationEnv,
): Promise<Response | null> {
  const url = new URL(r.url);
  if (!url.pathname.startsWith('/api/notifications')) return null;
  const user = await getAccount(r, env, false);
  if (!user) return reply({ error: 'Entre com a Microsoft.' }, 401);
  if (!['active', 'pending'].includes(user.access_status))
    return reply({ error: 'Acesso não autorizado.' }, 403);
  if (url.pathname === '/api/notifications/item' && r.method === 'GET') {
    const item = await env.DB.prepare(
      `SELECT n.*,t.week FROM notifications n JOIN users u ON u.id=n.user_id LEFT JOIN tasks t ON t.id=n.task_id WHERE n.id=? AND n.user_id=? AND ${visible}`,
    )
      .bind(url.searchParams.get('id') || '', user.id)
      .first();
    return item
      ? reply(item)
      : reply(
          {
            error:
              'Esta notificação não está mais disponível ou seu acesso mudou.',
          },
          404,
        );
  }
  if (url.pathname === '/api/notifications/test-status' && r.method === 'GET') {
    const row = await env.DB.prepare(
      `SELECT d.sent,d.attempts,d.last_error FROM notification_deliveries d JOIN notifications n ON n.id=d.notification_id WHERE n.id=? AND n.user_id=? AND n.kind='test'`,
    )
      .bind(url.searchParams.get('id') || '', user.id)
      .first();
    return row ? reply(row) : reply({ error: 'Teste não encontrado.' }, 404);
  }
  if (url.pathname === '/api/notifications' && r.method === 'GET') {
    const [rows, count] = await Promise.all([
      env.DB.prepare(
        `SELECT n.*,t.week FROM notifications n JOIN users u ON u.id=n.user_id LEFT JOIN tasks t ON t.id=n.task_id WHERE n.user_id=? AND n.read_at IS NULL AND ${visible} ORDER BY n.rowid DESC LIMIT 100`,
      )
        .bind(user.id)
        .all(),
      env.DB.prepare(
        `SELECT count(*) n FROM notifications n JOIN users u ON u.id=n.user_id WHERE n.user_id=? AND n.read_at IS NULL AND ${visible}`,
      )
        .bind(user.id)
        .first<{ n: number }>(),
    ]);
    return reply({
      notifications: rows.results,
      unread: count?.n || 0,
      publicKey: env.VAPID_PUBLIC_KEY || null,
    });
  }
  if (r.method !== 'POST') return reply({ error: 'Rota inválida.' }, 404);
  const raw = await r.text();
  if (raw.length > 8000) return reply({ error: 'Dados muito grandes.' }, 413);
  const b = JSON.parse(raw);
  if (url.pathname === '/api/notifications/test') {
    if (user.access_status !== 'active' || typeof b?.endpoint !== 'string')
      return reply(
        { error: 'Ative os avisos neste navegador antes do teste.' },
        400,
      );
    const subscription = await env.DB.prepare(
      'SELECT id FROM push_subscriptions WHERE id=? AND user_id=?',
    )
      .bind(await digest(b.endpoint), user.id)
      .first<{ id: string }>();
    if (!subscription)
      return reply(
        {
          error: 'Este navegador não está inscrito. Ative os avisos novamente.',
        },
        409,
      );
    const id = crypto.randomUUID();
    const result = await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO notifications(id,user_id,kind,title,body) SELECT ?,?,'test','Teste de notificação','Este aviso foi solicitado por você para testar o navegador.' WHERE NOT EXISTS(SELECT 1 FROM notifications WHERE user_id=? AND kind='test' AND created_at>datetime('now','-30 seconds'))`,
      ).bind(id, user.id, user.id),
      env.DB.prepare(
        'INSERT INTO notification_deliveries(notification_id,subscription_id) SELECT ?,? WHERE EXISTS(SELECT 1 FROM notifications WHERE id=?)',
      ).bind(id, subscription.id, id),
    ]);
    return result[0].meta.changes
      ? reply({ id }, 201)
      : reply({ error: 'Aguarde 30 segundos antes de testar novamente.' }, 429);
  }
  if (url.pathname === '/api/notifications/read') {
    if (!b || (b.id !== undefined && typeof b.id !== 'string'))
      return reply({ error: 'Notificação inválida.' }, 400);
    await env.DB.prepare(
      'UPDATE notifications SET read_at=CURRENT_TIMESTAMP WHERE user_id=? AND read_at IS NULL' +
        (b.id ? ' AND id=?' : ''),
    )
      .bind(user.id, ...(b.id ? [b.id] : []))
      .run();
    return reply({ ok: true });
  }
  if (url.pathname === '/api/notifications/subscribe') {
    if (user.access_status !== 'active')
      return reply(
        {
          error:
            'Aguarde a aprovação do cadastro para ativar avisos neste navegador.',
        },
        403,
      );
    if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY)
      return reply(
        { error: 'Envio de notificações ainda não configurado.' },
        503,
      );
    if (
      !b ||
      typeof b.endpoint !== 'string' ||
      !allowedPushEndpoint(b.endpoint) ||
      typeof b.keys?.p256dh !== 'string' ||
      typeof b.keys?.auth !== 'string' ||
      b.keys.p256dh.length > 100 ||
      b.keys.auth.length > 30
    )
      return reply({ error: 'Inscrição de navegador inválida.' }, 400);
    try {
      const key = decode(b.keys.p256dh);
      if (
        key.length !== 65 ||
        key[0] !== 4 ||
        decode(b.keys.auth).length !== 16
      )
        throw 0;
      await crypto.subtle.importKey(
        'raw',
        key as BufferSource,
        { name: 'ECDH', namedCurve: 'P-256' },
        false,
        [],
      );
    } catch {
      return reply({ error: 'Chaves de navegador inválidas.' }, 400);
    }
    const hash = await digest(b.endpoint);
    const token =
      r.headers
        .get('Cookie')
        ?.split(';')
        .map((s) => s.trim())
        .find((s) => s.startsWith('forest_corporate='))
        ?.slice(17) || '';
    await env.DB.prepare(
      `INSERT INTO push_subscriptions(id,user_id,endpoint,p256dh,auth,session_hash) VALUES(?,?,?,?,?,?)
      ON CONFLICT(id) DO UPDATE SET user_id=excluded.user_id,p256dh=excluded.p256dh,auth=excluded.auth,session_hash=excluded.session_hash,created_at=CASE WHEN push_subscriptions.user_id!=excluded.user_id THEN CURRENT_TIMESTAMP ELSE push_subscriptions.created_at END`,
    )
      .bind(
        hash,
        user.id,
        b.endpoint,
        b.keys.p256dh,
        b.keys.auth,
        await digest(token),
      )
      .run();
    return reply({ ok: true });
  }
  if (url.pathname === '/api/notifications/unsubscribe') {
    if (typeof b?.endpoint !== 'string')
      return reply({ error: 'Inscrição inválida.' }, 400);
    await env.DB.prepare(
      'DELETE FROM push_subscriptions WHERE user_id=? AND id=?',
    )
      .bind(user.id, await digest(b.endpoint))
      .run();
    return reply({ ok: true });
  }
  return reply({ error: 'Rota inválida.' }, 404);
}
export async function deliverNotifications(env: NotificationEnv) {
  if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY) return;
  await env.DB.prepare(
    `INSERT OR IGNORE INTO notification_deliveries(notification_id,subscription_id)
    SELECT n.id,s.id FROM notifications n JOIN push_subscriptions s ON s.user_id=n.user_id
    WHERE n.kind!='test' AND n.read_at IS NULL AND n.created_at>=s.created_at AND n.created_at>datetime('now','-1 day')`,
  ).run();
  const rows = await env.DB.prepare(
    `SELECT d.notification_id,d.subscription_id,s.endpoint,s.p256dh,s.auth,n.kind
    FROM notification_deliveries d JOIN notifications n ON n.id=d.notification_id JOIN users u ON u.id=n.user_id
    JOIN push_subscriptions s ON s.id=d.subscription_id AND s.user_id=n.user_id
    WHERE d.sent=0 AND d.attempts<5 AND d.next_attempt<=? AND d.lease_until<? AND n.read_at IS NULL AND n.created_at>=s.created_at AND n.created_at>datetime('now','-1 day') AND ${visible} ORDER BY n.rowid LIMIT 20`,
  )
    .bind(Date.now(), Date.now())
    .all<{
      notification_id: string;
      subscription_id: string;
      endpoint: string;
      p256dh: string;
      auth: string;
      kind: string;
    }>();
  for (let i = 0; i < rows.results.length; i += 5)
    await Promise.all(
      rows.results.slice(i, i + 5).map(async (row) => {
        const claim = await env.DB.prepare(
          `UPDATE notification_deliveries SET lease_until=?,attempts=attempts+1 WHERE notification_id=? AND subscription_id=? AND sent=0 AND lease_until<? AND next_attempt<=? AND attempts<5 AND EXISTS(SELECT 1 FROM notifications n JOIN users u ON u.id=n.user_id JOIN push_subscriptions s ON s.user_id=n.user_id WHERE n.id=notification_deliveries.notification_id AND s.id=notification_deliveries.subscription_id AND n.read_at IS NULL AND ${visible}) RETURNING attempts`,
        )
          .bind(
            Date.now() + 60000,
            row.notification_id,
            row.subscription_id,
            Date.now(),
            Date.now(),
          )
          .first<{ attempts: number }>();
        if (!claim) return;
        let phase = 'prepare';
        try {
          const details = await pushRequest(
            row,
            {
              id: row.notification_id,
              title: 'Forest Flow',
              body:
                row.kind === 'access_request'
                  ? 'Há uma solicitação de entrada para analisar.'
                  : row.kind === 'assignment'
                    ? 'Uma atividade foi atribuída a você.'
                    : row.kind === 'comment'
                      ? 'Há um novo comentário em uma atividade acompanhada por você.'
                      : row.kind === 'status'
                        ? 'O status de uma atividade acompanhada por você foi alterado.'
                        : row.kind === 'deadline_soon'
                          ? 'Uma atividade sob sua responsabilidade está próxima do prazo.'
                          : row.kind === 'deadline_overdue'
                            ? 'Uma atividade sob sua responsabilidade está atrasada.'
                            : row.kind === 'test'
                              ? 'Teste de notificação enviado pelo Forest Flow.'
                              : 'Há uma atualização para você no Forest Flow.',
            },
            {
              publicKey: env.VAPID_PUBLIC_KEY!,
              privateKey: env.VAPID_PRIVATE_KEY!,
            },
          );
          phase = 'transport';
          const response = await fetch(row.endpoint, {
            method: 'POST',
            headers: details.headers,
            body: details.body as BodyInit,
            // Workers support only manual/follow; manual also prevents sending
            // the encrypted payload and VAPID credentials to a redirect target.
            redirect: 'manual',
            signal: AbortSignal.timeout(5000),
          });
          if ([404, 410].includes(response.status)) {
            await env.DB.prepare('DELETE FROM push_subscriptions WHERE id=?')
              .bind(row.subscription_id)
              .run();
            return;
          }
          if (!response.ok) {
            phase = 'provider_http_' + response.status;
            throw new Error('Push unavailable');
          }
          await env.DB.prepare(
            'UPDATE notification_deliveries SET sent=1,lease_until=0,last_error=NULL WHERE notification_id=? AND subscription_id=?',
          )
            .bind(row.notification_id, row.subscription_id)
            .run();
        } catch (error) {
          const name =
            error instanceof Error &&
            [
              'TimeoutError',
              'AbortError',
              'TypeError',
              'DataError',
              'NotSupportedError',
              'OperationError',
              'InvalidAccessError',
              'InvalidCharacterError',
            ].includes(error.name)
              ? error.name
              : 'Error';
          await env.DB.prepare(
            'UPDATE notification_deliveries SET lease_until=0,next_attempt=?,last_error=? WHERE notification_id=? AND subscription_id=?',
          )
            .bind(
              Date.now() + 60000 * 2 ** claim.attempts,
              phase + ':' + name,
              row.notification_id,
              row.subscription_id,
            )
            .run();
        }
      }),
    );
}
