import { useEffect, useRef, useState } from 'react';
type Comment = { id: string; name: string; body: string; created_at: string };
export function Comments({
  taskId,
  api,
}: {
  taskId: string;
  api: <T = unknown>(path: string, options?: RequestInit) => Promise<T>;
}) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [body, setBody] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    let alive = true;
    api<Comment[]>(`tasks/${taskId}/comments`)
      .then((c) => {
        if (alive) setComments(c);
      })
      .catch((e) => {
        if (alive) setError(e.message);
      });
    return () => {
      alive = false;
    };
  }, [taskId]);
  async function post() {
    if (busy || !body.trim()) return;
    setBusy(true);
    setError('');
    try {
      await api(`tasks/${taskId}/comments`, {
        method: 'POST',
        body: JSON.stringify({ body }),
      });
      setComments(await api<Comment[]>(`tasks/${taskId}/comments`));
      setBody('');
      input.current?.focus();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="comments" aria-label="Comentários">
      <h3>Comentários</h3>
      {comments.length ? (
        comments.map((c) => (
          <article key={c.id}>
            <strong>{c.name}</strong>
            <small>
              {new Date(c.created_at.replace(' ', 'T') + 'Z').toLocaleString(
                'pt-BR',
              )}
            </small>
            <p>{c.body}</p>
          </article>
        ))
      ) : (
        <p className="muted">Compartilhe avanços e dúvidas desta atividade.</p>
      )}
      <label>
        Novo comentário
        <textarea
          ref={input}
          rows={3}
          maxLength={3000}
          value={body}
          placeholder="Escreva uma atualização…"
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => {
            if (
              e.key === 'Enter' &&
              !e.shiftKey &&
              !e.nativeEvent.isComposing
            ) {
              e.preventDefault();
              e.stopPropagation();
              if (!e.repeat) void post();
            }
          }}
        />
      </label>
      <small>Enter envia · Shift + Enter cria uma nova linha</small>
      <button
        className="secondary"
        type="button"
        disabled={busy || !body.trim()}
        onClick={() => void post()}
      >
        {busy ? 'Enviando…' : 'Enviar comentário'}
      </button>
      {error && (
        <div className="error" role="alert">
          {error}
        </div>
      )}
    </section>
  );
}
