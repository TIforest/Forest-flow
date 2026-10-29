// Calendar days in the business timezone, independent of DST and browser zone.
export function deadlineAlert(
  due: string | null,
  status: string,
  now = new Date(),
) {
  if (!due || status === 'done') return null;
  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
  const days = Math.round(
    (Date.parse(due + 'T00:00:00Z') - Date.parse(today + 'T00:00:00Z')) /
      86400000,
  );
  if (!Number.isFinite(days) || days > 2) return null;
  if (days < 0)
    return {
      kind: 'overdue',
      text: `${-days} ${days === -1 ? 'dia' : 'dias'} em atraso`,
    };
  return {
    kind: 'soon',
    text:
      days === 0
        ? 'Vence hoje'
        : days === 1
          ? 'Vence amanhã'
          : 'Vence em 2 dias',
  };
}
