import { useEffect, useState } from 'react';
import type { ChecklistItem } from './import-types';
export function Checklist({
  taskId,
  canEdit,
  api,
}: {
  taskId: string;
  canEdit: boolean;
  api: <T = unknown>(path: string, options?: RequestInit) => Promise<T>;
}) {
  const [items, setItems] = useState<ChecklistItem[]>([]),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    api<ChecklistItem[]>(`tasks/${taskId}/checklist`)
      .then((data) => {
        if (active) setItems(data);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [taskId]);
  async function toggle(item: ChecklistItem) {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await api(`tasks/${taskId}/checklist`, {
        method: 'PATCH',
        body: JSON.stringify({ id: item.id, done: !item.done }),
      });
      setItems(await api<ChecklistItem[]>(`tasks/${taskId}/checklist`));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (!items.length && !error) return null;
  return (
    <section className="task-checklist" aria-label="Checklist">
      <h3>
        Checklist{' '}
        <small>
          {items.filter((i) => i.done).length}/{items.length}
        </small>
      </h3>
      {items.map((item) => (
        <label key={item.id} className={item.done ? 'checked' : ''}>
          <input
            type="checkbox"
            checked={item.done}
            disabled={!canEdit || busy}
            onChange={() => void toggle(item)}
          />
          <span>{item.text}</span>
        </label>
      ))}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
