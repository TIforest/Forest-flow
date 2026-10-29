import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { taskTitleKey } from './task-title';
import { statuses, type User } from './types';
import type { ImportTask, ImportPreview } from './import-types';
type Draft = ImportTask & { selected: boolean; duplicate: boolean };
type Preview = ImportPreview & { importId: string; duplicates: number[] };
export function ImportTasks({
  week,
  users,
  api,
  close,
  created,
}: {
  week: string;
  users: User[];
  api: <T = unknown>(path: string, options?: RequestInit) => Promise<T>;
  close: () => void;
  created: (count: number) => Promise<void>;
}) {
  const [text, setText] = useState('');
  const [drafts, setDrafts] = useState<Draft[] | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [importId, setImportId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(false);
  const lock = useRef(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const dialog = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement;
    heading.current?.focus();
    return () => previous?.focus();
  }, []);
  const selected = drafts?.filter((t) => t.selected) || [];
  const repeatedTitles =
    new Set(selected.map((t) => taskTitleKey(t.title))).size !==
    selected.length;
  function update(index: number, patch: Partial<Draft>) {
    setDrafts((current) =>
      current!.map((t, i) => (i === index ? { ...t, ...patch } : t)),
    );
  }
  async function analyze() {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError('');
    try {
      const data = await api<Preview>('imports/preview', {
        method: 'POST',
        body: JSON.stringify({ week, text }),
      });
      setImportId(data.importId);
      setWarnings(data.warnings);
      setDrafts(
        data.tasks.map((t, i) => ({
          ...t,
          selected: !data.duplicates.includes(i),
          duplicate: data.duplicates.includes(i),
        })),
      );
      setRetry(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  async function commit() {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError('');
    try {
      const result = await api<{ count: number }>('imports/commit', {
        method: 'POST',
        body: JSON.stringify({
          week,
          importId,
          tasks: selected.map((t) => ({
            ...t,
            checklist: t.checklist.filter((s) => s.trim()),
          })),
        }),
      });
      await created(result.count);
    } catch (e) {
      setError((e as Error).message);
      setRetry(
        !(e as Error).message.includes(
          'Já existe uma atividade com esse título',
        ),
      );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  function trap(e: React.KeyboardEvent) {
    if (e.key === 'Escape' && !busy) {
      close();
      return;
    }
    if (e.key !== 'Tab') return;
    const nodes = dialog.current?.querySelectorAll<HTMLElement>(
      'button:not(:disabled),input:not(:disabled),textarea:not(:disabled),select:not(:disabled),[tabindex="0"]',
    );
    if (!nodes?.length) return;
    const first = nodes[0],
      last = nodes[nodes.length - 1];
    if (
      e.shiftKey &&
      (document.activeElement === first ||
        document.activeElement === heading.current)
    ) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }
  return (
    <div className="import-backdrop">
      <div
        className="import-dialog"
        ref={dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="import-heading"
        onKeyDown={trap}
      >
        <header className="import-header">
          <div>
            <h2 id="import-heading" tabIndex={-1} ref={heading}>
              Importar atividades
            </h2>
            <p>
              Semana de{' '}
              {new Date(week + 'T12:00:00').toLocaleDateString('pt-BR')} ·
              revise antes de criar.
            </p>
          </div>
          <button
            type="button"
            className="icon-button"
            aria-label="Fechar importação"
            disabled={busy}
            onClick={close}
          >
            <X />
          </button>
        </header>
        <div className="import-body">
          {!drafts ? (
            <>
              <label>
                Texto do planejamento
                <textarea
                  autoFocus
                  rows={14}
                  maxLength={20000}
                  value={text}
                  disabled={busy}
                  onChange={(e) => setText(e.target.value)}
                  placeholder={
                    '👤 Gustavo\n- Compra da impressora\n  - Enviar lista para Mayara\n\n👤 Eduardo\n- Métricas TOTVS'
                  }
                />
              </label>
              <small>
                {text.length.toLocaleString('pt-BR')} / 20.000 caracteres · até
                50 cartões por análise.
              </small>
              <p className="muted">
                Aceita listas do Teams, nomes como cabeçalho, listas numeradas e
                linhas como “Eduardo: Enviar relatórios”. Sem marcadores, use
                uma atividade por linha. Subtópicos recuados viram checklist.
                Datas explícitas, como “para o dia 09/11”, preenchem o prazo.
                Expressões como “junto com Tonello” adicionam membros
                cadastrados. Sem prazo explícito, mantém 7 dias. Revise os
                campos antes de confirmar. Não utiliza serviços externos. Os
                cartões só serão salvos após sua confirmação.
              </p>
            </>
          ) : (
            <>
              <p>
                <strong>
                  {selected.length} de {drafts.length} cartões selecionados
                </strong>{' '}
                · Edite os campos e desmarque o que não deseja importar.
              </p>
              {repeatedTitles && (
                <p className="import-warning" role="alert">
                  Há títulos repetidos entre os cartões selecionados. Altere os
                  títulos ou desmarque os repetidos.
                </p>
              )}
              {warnings.length > 0 && (
                <div className="import-warning" role="status">
                  <strong>Pontos para revisar</strong>
                  <ul>
                    {warnings.map((w, i) => (
                      <li key={i}>{w}</li>
                    ))}
                  </ul>
                </div>
              )}
              {!drafts.length && (
                <p>
                  Nenhuma tarefa identificada. Volte ao texto e inclua
                  atividades e responsáveis.
                </p>
              )}
              {drafts.map((t, i) => (
                <article
                  className={'import-task' + (!t.selected ? ' unselected' : '')}
                  key={i}
                >
                  <label className="import-select">
                    <input
                      type="checkbox"
                      checked={t.selected}
                      disabled={busy || retry}
                      onChange={(e) =>
                        update(i, { selected: e.target.checked })
                      }
                    />
                    Incluir cartão {i + 1}
                  </label>
                  {t.duplicate && (
                    <p className="import-warning">
                      Título repetido no setor ou neste lote, independentemente
                      da semana e do responsável. Desmarcado para revisão;
                      altere o título antes de incluir.
                    </p>
                  )}
                  {!t.assignee_id && (
                    <p className="import-warning">
                      Escolha um responsável
                      {t.responsible_name ? ': ' + t.responsible_name : ''}.
                    </p>
                  )}
                  <fieldset disabled={busy || !t.selected || retry}>
                    <label>
                      Título
                      <input
                        required
                        maxLength={180}
                        value={t.title}
                        onChange={(e) => update(i, { title: e.target.value })}
                      />
                    </label>
                    <div className="import-fields">
                      <label>
                        Responsável
                        <select
                          required
                          value={t.assignee_id || ''}
                          onChange={(e) =>
                            update(i, {
                              assignee_id: e.target.value || null,
                              extra_assignee_ids: (
                                t.extra_assignee_ids || []
                              ).filter((id) => id !== e.target.value),
                            })
                          }
                        >
                          <option value="">Selecione…</option>
                          {users.map((u) => (
                            <option value={u.id} key={u.id}>
                              {u.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        Prazo
                        <input
                          type="date"
                          value={t.due_date || ''}
                          onChange={(e) =>
                            update(i, { due_date: e.target.value || null })
                          }
                        />
                      </label>
                      <label>
                        Prioridade
                        <select
                          value={t.priority}
                          onChange={(e) =>
                            update(i, {
                              priority: e.target.value as Draft['priority'],
                            })
                          }
                        >
                          <option value="normal">Normal</option>
                          <option value="high">Alta</option>
                        </select>
                      </label>
                      <label>
                        Status
                        <select
                          value={t.status}
                          onChange={(e) =>
                            update(i, {
                              status: e.target.value as Draft['status'],
                            })
                          }
                        >
                          {Object.entries(statuses).map(([id, name]) => (
                            <option key={id} value={id}>
                              {name}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                    {t.assignee_id && users.length > 1 && (
                      <div className="assignee-picker">
                        <span className="assignee-picker-label">
                          Também responsáveis
                        </span>
                        <div className="assignee-options">
                          {users
                            .filter((u) => u.id !== t.assignee_id)
                            .map((u) => {
                              const extras = t.extra_assignee_ids || [];
                              const checked = extras.includes(u.id);
                              return (
                                <label
                                  key={u.id}
                                  className={`assignee-option ${checked ? 'is-selected' : ''}`}
                                >
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={(e) =>
                                      update(i, {
                                        extra_assignee_ids: e.target.checked
                                          ? [...extras, u.id]
                                          : extras.filter((id) => id !== u.id),
                                      })
                                    }
                                  />
                                  {u.name}
                                </label>
                              );
                            })}
                        </div>
                      </div>
                    )}
                    {t.status === 'blocked' && (
                      <label>
                        Motivo do bloqueio
                        <textarea
                          required
                          maxLength={1000}
                          value={t.block_reason}
                          onChange={(e) =>
                            update(i, { block_reason: e.target.value })
                          }
                        />
                      </label>
                    )}
                    <label>
                      Descrição
                      <textarea
                        rows={2}
                        maxLength={5000}
                        value={t.description}
                        onChange={(e) =>
                          update(i, { description: e.target.value })
                        }
                      />
                    </label>
                  </fieldset>
                </article>
              ))}
            </>
          )}
          {error && (
            <div className="error" role="alert">
              {error}
            </div>
          )}
          {retry && (
            <p>
              Os dados foram mantidos para repetir a confirmação sem duplicar
              cartões. Para editar novamente, clique em “Editar prévia”.
            </p>
          )}
        </div>
        <footer className="import-footer">
          {drafts ? (
            <>
              <button
                className="secondary"
                disabled={busy}
                onClick={() => {
                  setDrafts(null);
                  setRetry(false);
                  setError('');
                }}
              >
                Voltar ao texto
              </button>
              {retry && (
                <button
                  className="secondary"
                  disabled={busy}
                  onClick={() => {
                    setRetry(false);
                  }}
                >
                  Editar prévia
                </button>
              )}
              <button
                className="primary"
                data-busy={busy || undefined}
                disabled={
                  busy ||
                  repeatedTitles ||
                  !selected.length ||
                  selected.some(
                    (t) =>
                      !t.title.trim() ||
                      !t.assignee_id ||
                      (t.status === 'blocked' && !t.block_reason.trim()) ||
                      t.checklist.filter((s) => s.trim()).length > 30 ||
                      t.checklist.some((s) => s.length > 300),
                  )
                }
                onClick={() => {
                  setDrafts((d) =>
                    d!.map((t) => ({
                      ...t,
                      checklist: t.checklist.filter((s) => s.trim()),
                    })),
                  );
                  void commit();
                }}
              >
                {busy
                  ? 'Criando cartões…'
                  : `Confirmar e criar ${selected.length} cartões`}
              </button>
            </>
          ) : (
            <button
              className="primary"
              disabled={busy || !text.trim()}
              data-busy={busy || undefined}
              onClick={() => void analyze()}
            >
              {busy ? 'Preparando cartões…' : 'Preparar cartões'}
            </button>
          )}
        </footer>
      </div>
    </div>
  );
}
