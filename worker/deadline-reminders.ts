import type { AuthEnv } from './auth';
export async function enqueueDeadlineReminders(env: AuthEnv, now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);
  const part = (name: string) => parts.find((p) => p.type === name)!.value;
  if (Number(part('hour')) < 8) return;
  const today = part('year') + '-' + part('month') + '-' + part('day');
  const horizon = new Date(Date.parse(today + 'T00:00:00Z') + 2 * 86400000)
    .toISOString()
    .slice(0, 10);
  await env.DB.batch([
    env.DB.prepare(
      `WITH recipients AS (
      SELECT id task_id,assignee_id user_id FROM tasks WHERE deleted_at IS NULL AND status!='done' AND due_date<=?
      UNION SELECT a.task_id,a.user_id FROM task_assignees a JOIN tasks t ON t.id=a.task_id WHERE t.deleted_at IS NULL AND t.status!='done' AND t.due_date<=?
    ) INSERT OR IGNORE INTO notifications(id,user_id,kind,title,body,workspace_id,task_id,reminder_date,reminder_due_date)
    SELECT lower(hex(randomblob(16))),u.id,
      CASE WHEN t.due_date<? THEN 'deadline_overdue' ELSE 'deadline_soon' END,
      CASE WHEN t.due_date<? THEN 'Atividade atrasada' ELSE 'Prazo de atividade se aproximando' END,
      t.title || ' · ' || CASE WHEN t.due_date<? THEN cast(cast(julianday(?)-julianday(t.due_date) AS INTEGER) AS TEXT) || CASE WHEN cast(julianday(?)-julianday(t.due_date) AS INTEGER)=1 THEN ' dia em atraso' ELSE ' dias em atraso' END
        WHEN t.due_date=? THEN 'Vence hoje' WHEN t.due_date=date(?,'+1 day') THEN 'Vence amanhã' ELSE 'Vence em 2 dias' END,
      t.workspace_id,t.id,?,t.due_date
    FROM recipients r JOIN tasks t ON t.id=r.task_id JOIN users u ON u.id=r.user_id JOIN workspaces w ON w.id=t.workspace_id
    WHERE w.active=1 AND u.access_status='active' AND t.due_date IS NOT NULL AND date(t.due_date)=t.due_date
      AND (u.is_admin=1 OR (u.onboarding_required=0 AND EXISTS(SELECT 1 FROM workspace_memberships m WHERE m.workspace_id=t.workspace_id AND m.user_id=u.id)))`,
    ).bind(
      horizon,
      horizon,
      today,
      today,
      today,
      today,
      today,
      today,
      today,
      today,
    ),
    // Replace yesterday's outstanding reminder rather than piling up old alerts.
    env.DB.prepare(
      `UPDATE notifications SET read_at=CURRENT_TIMESTAMP WHERE reminder_date<? AND read_at IS NULL
      AND EXISTS(SELECT 1 FROM notifications newer WHERE newer.user_id=notifications.user_id AND newer.task_id=notifications.task_id AND newer.reminder_date=?)`,
    ).bind(today, today),
  ]);
}
