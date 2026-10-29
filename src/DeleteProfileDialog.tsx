import { useEffect, useState } from 'react';
type Info = {
  id: string;
  name: string;
  email: string | null;
  tasks: number;
  comments: number;
  events: number;
};
export function DeleteProfileDialog({
  userId,
  close,
  onDeleted,
}: {
  userId: string;
  close: () => void;
  onDeleted: () => Promise<void>;
}) {
  const [info, setInfo] = useState<Info | null>(null),
    [typed, setTyped] = useState(''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    void fetch(
      '/api/admin/profile-deletion?user_id=' + encodeURIComponent(userId),
      { signal: controller.signal },
    )
      .then(async (r) => {
        const data = (await r.json()) as Info & { error?: string };
        if (!r.ok) throw new Error(data.error);
        setInfo(data);
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.message);
      });
    return () => controller.abort();
  }, [userId]);
  async function remove(e: React.FormEvent) {
    e.preventDefault();
    if (!info || busy || typed !== info.name) return;
    setBusy(true);
    setError('');
    try {
      const r = await fetch('/api/admin/profile-deletion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: info.id,
          confirm: true,
          confirm_name: typed,
        }),
      });
      const data = (await r.json()) as { error?: string };
      if (!r.ok)
        throw new Error(data.error || 'Não foi possível excluir o perfil.');
      await onDeleted();
      close();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="delete-profile-backdrop">
      <section
        className="auth-card delete-profile-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-profile-title"
        onKeyDown={(e) => {
          if (e.key === 'Escape' && !busy) close();
          if (e.key === 'Tab') {
            const controls = Array.from(
              e.currentTarget.querySelectorAll<HTMLElement>(
                'button:not([disabled]),input:not([disabled])',
              ),
            );
            const first = controls[0],
              last = controls[controls.length - 1];
            if (e.shiftKey && document.activeElement === first) {
              e.preventDefault();
              last?.focus();
            } else if (!e.shiftKey && document.activeElement === last) {
              e.preventDefault();
              first?.focus();
            }
          }
        }}
      >
        <h2 id="delete-profile-title">Excluir perfil permanentemente</h2>
        {error && (
          <div className="error" role="alert">
            {error}
          </div>
        )}
        {info ? (
          <>
            <p>
              O cadastro de <strong>{info.name}</strong>
              {info.email ? ' (' + info.email + ')' : ''} será removido, junto
              com suas sessões, participação nos setores e vínculo Microsoft.
            </p>
            <p>
              Serão preservadas{' '}
              <strong>
                {info.tasks} {info.tasks === 1 ? 'atividade' : 'atividades'},{' '}
                {info.comments}{' '}
                {info.comments === 1 ? 'comentário' : 'comentários'} e{' '}
                {info.events}{' '}
                {info.events === 1
                  ? 'registro de histórico'
                  : 'registros de histórico'}
              </strong>
              . A identificação da pessoa nesses dados será substituída por{' '}
              <strong>Usuário excluído</strong>.
            </p>
            <p>
              Esta exclusão não pode ser desfeita pelo aplicativo. Se a pessoa
              entrar novamente com a Microsoft, precisará de um novo cadastro e
              aprovação.
            </p>
            <form onSubmit={remove}>
              <label>
                Digite o nome completo para confirmar:{' '}
                <strong>{info.name}</strong>
                <input
                  autoFocus
                  required
                  autoComplete="off"
                  value={typed}
                  onChange={(e) => setTyped(e.target.value)}
                  disabled={busy}
                />
              </label>
              <div className="delete-profile-actions">
                <button
                  type="button"
                  className="secondary"
                  disabled={busy}
                  onClick={close}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="danger-button"
                  disabled={busy || typed !== info.name}
                >
                  {busy ? 'Excluindo…' : 'Excluir definitivamente'}
                </button>
              </div>
            </form>
          </>
        ) : (
          <>
            <p role="status">Conferindo os vínculos do perfil…</p>
            <button className="secondary" onClick={close}>
              Cancelar
            </button>
          </>
        )}
      </section>
    </div>
  );
}
