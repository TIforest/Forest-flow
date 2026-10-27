import { useEffect, useState } from 'react';
import type { Task } from './types';
export function Continuity({
  tasks,
  targetWeek,
  label,
  api,
  refresh,
}: {
  tasks: Task[];
  targetWeek: string;
  label: string;
  api: <T = unknown>(path: string, options?: RequestInit) => Promise<T>;
  refresh: () => Promise<void>;
}) {
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const available = tasks.filter((t) => t.status !== 'done');
  useEffect(() => {
    setSelected([]);
    setNotice('');
    setError('');
  }, [targetWeek]);
  async function carry() {
    setBusy(true);
    setError('');
    try {
      await api('weeks/carry', {
        method: 'POST',
        body: JSON.stringify({ task_ids: selected, week: targetWeek }),
      });
      await refresh();
      setNotice(
        'Planejamento atualizado. A tarefa e o prazo original foram preservados.',
      );
      setSelected([]);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="continuity">
      <h3>{label}</h3>
      <p>
        Selecione as atividades que continuam na semana de{' '}
        {new Date(targetWeek + 'T12:00:00').toLocaleDateString('pt-BR')}. A
        tarefa também permanece no histórico das semanas anteriores.
      </p>
      {available.length ? (
        <>
          <div className="carry-list">
            {available.map((t) => (
              <label key={t.id}>
                <input
                  type="checkbox"
                  disabled={busy}
                  checked={selected.includes(t.id)}
                  onChange={(e) =>
                    setSelected((current) =>
                      e.target.checked
                        ? [...current, t.id]
                        : current.filter((id) => id !== t.id),
                    )
                  }
                />
                <span>{t.title}</span>
              </label>
            ))}
          </div>
          <button
            className="primary"
            disabled={busy || !selected.length}
            onClick={() => void carry()}
          >
            {busy
              ? 'Atualizando…'
              : `Incluir selecionadas (${selected.length})`}
          </button>
        </>
      ) : (
        <p>Nenhuma atividade em aberto nesta semana.</p>
      )}
      {notice && <p role="status">{notice}</p>}
      {error && (
        <div className="error" role="alert">
          {error}
        </div>
      )}
    </div>
  );
}
