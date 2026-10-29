import { useEffect, useRef, useState } from 'react';
import { X, Search } from 'lucide-react';
import type { AdminState, AdminSave } from './admin-model';
type Candidate = { id: string; name: string; email: string };
export function AddSectorMember({
  state,
  save,
  close,
}: {
  state: AdminState;
  save: AdminSave;
  close: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [query, setQuery] = useState(''),
    [users, setUsers] = useState<Candidate[]>([]),
    [person, setPerson] = useState(''),
    [workspace, setWorkspace] = useState(
      state.workspaces.find((w) => w.active)?.id || '',
    ),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(false),
    [error, setError] = useState('');
  useEffect(() => {
    dialog.current?.showModal();
    return () => dialog.current?.close();
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    setUsers([]);
    setPerson('');
    setError('');
    if (query.trim().length < 2) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const timer = setTimeout(() => {
      void fetch('/api/admin/candidates?q=' + encodeURIComponent(query), {
        signal: controller.signal,
      })
        .then(async (r) => {
          const d = (await r.json()) as { error?: string; users: Candidate[] };
          if (!r.ok)
            throw new Error(d.error || 'Não foi possível buscar pessoas.');
          return d.users as Candidate[];
        })
        .then((data) => {
          if (!controller.signal.aborted) setUsers(data);
        })
        .catch((e) => {
          if (!controller.signal.aborted) setError(e.message);
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    }, 300);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);
  const enrolled = (id: string) =>
    state.memberships.some(
      (m) => m.user_id === id && m.workspace_id === workspace,
    );
  return (
    <dialog
      ref={dialog}
      className="admin-history-dialog"
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) close();
      }}
    >
      <div className="admin-dialog-title">
        <h2>Adicionar integrante</h2>
        <button
          className="icon-button"
          aria-label="Fechar inclusão de integrante"
          disabled={busy}
          onClick={close}
        >
          <X size={20} />
        </button>
      </div>
      <p className="admin-muted">
        Busque uma pessoa já aprovada. A inclusão autoriza apenas o acesso como
        membro ao setor escolhido.
      </p>
      <form
        className="admin-form"
        onSubmit={(e) => {
          e.preventDefault();
          if (busy || !person || enrolled(person)) return;
          setBusy(true);
          void save('membership', {
            user_id: person,
            workspace_id: workspace,
            role: 'member',
          })
            .then((ok) => {
              if (ok) close();
            })
            .finally(() => setBusy(false));
        }}
      >
        <fieldset disabled={busy} className="onboarding-fields">
          <label>
            Setor
            <select
              required
              value={workspace}
              onChange={(e) => {
                setWorkspace(e.target.value);
                setPerson('');
              }}
            >
              {state.workspaces
                .filter((w) => w.active)
                .map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
            </select>
          </label>
          <label>
            <Search size={14} /> Nome ou e-mail
            <input
              autoFocus
              value={query}
              maxLength={120}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Digite pelo menos 2 caracteres"
            />
          </label>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <label>
            Pessoa
            <select
              required
              value={person}
              onChange={(e) => setPerson(e.target.value)}
            >
              <option value="">
                {loading ? 'Buscando…' : 'Selecione uma pessoa'}
              </option>
              {users.map((u) => (
                <option key={u.id} value={u.id} disabled={enrolled(u.id)}>
                  {u.name} · {u.email}
                  {enrolled(u.id) ? ' · Já é integrante' : ''}
                </option>
              ))}
            </select>
          </label>
          {!loading && query.trim().length >= 2 && !users.length && !error && (
            <p role="status">Nenhuma pessoa aprovada encontrada.</p>
          )}
          <button
            type="submit"
            className="primary"
            disabled={!person || !workspace || enrolled(person) || busy}
          >
            {busy ? 'Adicionando…' : 'Adicionar como membro'}
          </button>
        </fieldset>
      </form>
    </dialog>
  );
}
