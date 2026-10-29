import { DeleteProfileDialog } from './DeleteProfileDialog';
import { AccessReview } from './AccessReview';
import type { AccessRequest } from './OnboardingForm';
import { useEffect, useState } from 'react';
import type { Workspace, CorporateUser } from './AuthGate';
type Person = CorporateUser & {
  object_id: string | null;
  tenant_id: string | null;
  display_name: string | null;
  registration_email: string | null;
};
type Membership = {
  user_id: string;
  workspace_id: string;
  role: 'member' | 'coordinator';
};
type State = {
  requests: AccessRequest[];
  users: Person[];
  workspaces: Workspace[];
  memberships: Membership[];
  audit: {
    id: string;
    name: string;
    action: string;
    details: string;
    created_at: string;
  }[];
};
export function AdminPanel({ onChange }: { onChange: () => Promise<void> }) {
  const [deleting, setDeleting] = useState<string | null>(null);
  const [state, setState] = useState<State | null>(null),
    [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
    [busy, setBusy] = useState(false);
  const [name, setName] = useState(''),
    [person, setPerson] = useState(''),
    [workspace, setWorkspace] = useState(''),
    [role, setRole] = useState('member'),
    [source, setSource] = useState(''),
    [target, setTarget] = useState(''),
    [confirm, setConfirm] = useState(false);
  async function load() {
    const r = await fetch('/api/admin/state');
    const d = (await r.json()) as State & { error?: string };
    if (!r.ok) throw new Error(d.error);
    setState(d);
  }
  useEffect(() => {
    void load().catch((e) => setError(e.message));
    const timer = setInterval(() => void load().catch(() => undefined), 30000);
    return () => clearInterval(timer);
  }, []);
  async function save(path: string, body: unknown) {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const r = await fetch('/api/admin/' + path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const d = (await r.json()) as { error?: string };
      if (!r.ok) throw new Error(d.error);
      await load();
      await onChange();
      setNotice('Alteração salva.');
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="admin-panel">
      {deleting && (
        <DeleteProfileDialog
          key={deleting}
          userId={deleting}
          close={() => setDeleting(null)}
          onDeleted={async () => {
            await load();
            await onChange();
            setNotice(
              'Perfil excluído. Atividades e históricos preservados como Usuário excluído.',
            );
          }}
        />
      )}
      <div className="page-heading">
        <div>
          <h1>Administração</h1>
          <p>
            Libere os acessos e organize os espaços de trabalho da Forest Paper.
          </p>
        </div>
      </div>
      {error && (
        <div className="error" role="alert">
          {error}
        </div>
      )}
      {notice && <p role="status">{notice}</p>}
      {!state ? (
        <p>Carregando…</p>
      ) : (
        <fieldset disabled={busy} className="admin-sections">
          <section>
            <div className="admin-row">
              <h2>
                Solicitações de acesso ·{' '}
                {
                  state.requests.filter(
                    (r) =>
                      r.status === 'submitted' && r.access_status === 'pending',
                  ).length
                }
              </h2>
              <button
                className="secondary"
                onClick={() => void load().catch((e) => setError(e.message))}
              >
                Atualizar solicitações
              </button>
            </div>
            <p>
              Confira os dados informados e a conta Microsoft. Ao aprovar,
              escolha o setor e a função que serão autorizados.
            </p>
            {state.requests.length ? (
              state.requests.map((r) => (
                <AccessReview
                  key={r.user_id + ':' + r.submitted_at + ':' + r.status}
                  request={r}
                  workspaces={state.workspaces}
                  save={save}
                />
              ))
            ) : (
              <p>Nenhum formulário recebido ainda.</p>
            )}
          </section>
          <section>
            <h2>Setores</h2>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void save('workspace', { name }).then((ok) => {
                  if (ok) setName('');
                });
              }}
            >
              <label>
                Nome do novo setor
                <input
                  required
                  maxLength={120}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex.: Financeiro"
                />
              </label>
              <button className="primary">Criar setor</button>
            </form>
            {state.workspaces.map((w) => (
              <div className="admin-row" key={w.id}>
                <strong>{w.name}</strong>
                <span>{w.active ? 'Ativo' : 'Desativado'}</span>
                <button
                  className="secondary"
                  onClick={() =>
                    void save('workspace', {
                      id: w.id,
                      name: w.name,
                      active: !w.active,
                    })
                  }
                >
                  {w.active ? 'Desativar' : 'Reativar'}
                </button>
              </div>
            ))}
            <small>
              Desativar um setor suspende o acesso ao quadro e preserva suas
              atividades e seus vínculos.
            </small>
          </section>
          <section>
            <h2>Pessoas e liberação de acesso</h2>
            <p>
              Novas pessoas preenchem o formulário após o primeiro login
              Microsoft. Liberar o acesso e associar a um setor são etapas
              separadas.
            </p>
            <div className="admin-table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Pessoa</th>
                    <th>Identidade Microsoft</th>
                    <th>Acesso</th>
                    <th>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {state.users.map((u) => (
                    <tr key={u.id}>
                      <td>
                        <strong>{u.name}</strong>
                        <br />
                        <small>{u.job}</small>
                      </td>
                      <td>
                        {u.email || 'Perfil histórico — aguardando vínculo'}
                        {u.object_id && (
                          <details>
                            <summary>Identificação estável</summary>
                            <small>{u.object_id}</small>
                          </details>
                        )}
                      </td>
                      <td>
                        {u.is_admin
                          ? 'Administrador'
                          : {
                              pending: 'Aguardando liberação',
                              active: 'Liberado',
                              blocked: 'Bloqueado',
                            }[u.access_status] || u.access_status}
                      </td>
                      <td>
                        {u.object_id && !u.is_admin && (
                          <>
                            <button
                              className="secondary"
                              disabled={u.access_status === 'pending'}
                              title={
                                u.access_status === 'pending'
                                  ? 'Analise o formulário em Solicitações de acesso'
                                  : undefined
                              }
                              onClick={() =>
                                void save('access', {
                                  user_id: u.id,
                                  status: u.onboarding_required
                                    ? 'pending'
                                    : 'active',
                                })
                              }
                            >
                              {u.onboarding_required &&
                              u.access_status === 'blocked'
                                ? 'Reabrir cadastro'
                                : 'Liberar'}
                            </button>
                            <button
                              className="secondary"
                              onClick={() =>
                                void save('access', {
                                  user_id: u.id,
                                  status: 'blocked',
                                })
                              }
                            >
                              Bloquear
                            </button>
                          </>
                        )}
                        {!u.is_admin && (
                          <button
                            className="danger-button"
                            aria-label={'Excluir perfil de ' + u.name}
                            onClick={() => setDeleting(u.id)}
                          >
                            Excluir perfil
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
          <section>
            <h2>Participação nos setores</h2>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void save('membership', {
                  user_id: person,
                  workspace_id: workspace,
                  role,
                });
              }}
            >
              <label>
                Pessoa
                <select
                  required
                  value={person}
                  onChange={(e) => setPerson(e.target.value)}
                >
                  <option value="">Selecione</option>
                  {state.users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                      {!u.object_id ? ' (perfil histórico)' : ''}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Setor
                <select
                  required
                  value={workspace}
                  onChange={(e) => setWorkspace(e.target.value)}
                >
                  <option value="">Selecione</option>
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
                Função
                <select value={role} onChange={(e) => setRole(e.target.value)}>
                  <option value="member">Membro</option>
                  <option value="coordinator">Coordenador</option>
                </select>
              </label>
              <button className="primary">Salvar participação</button>
            </form>
            {state.memberships.map((m) => (
              <div className="admin-row" key={m.user_id + m.workspace_id}>
                <span>
                  {state.users.find((u) => u.id === m.user_id)?.name} ·{' '}
                  {state.workspaces.find((w) => w.id === m.workspace_id)?.name}
                </span>
                <strong>
                  {m.role === 'coordinator' ? 'Coordenador' : 'Membro'}
                </strong>
                <button
                  className="secondary"
                  onClick={() =>
                    void save('membership', { ...m, role: 'remove' })
                  }
                >
                  Remover do setor
                </button>
              </div>
            ))}
          </section>
          <section>
            <h2>Vincular perfis antigos</h2>
            <p>
              Confira a pessoa e o identificador Microsoft antes de confirmar.
              As tarefas, os responsáveis e os históricos do perfil antigo serão
              preservados. O vínculo mantém as participações do perfil
              histórico; revise as funções acima.
            </p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void save('link', {
                  source_id: source,
                  target_id: target,
                  confirm,
                }).then((ok) => {
                  if (ok) {
                    setSource('');
                    setTarget('');
                    setConfirm(false);
                  }
                });
              }}
            >
              <label>
                Conta Microsoft autenticada
                <select
                  required
                  value={source}
                  onChange={(e) => {
                    setSource(e.target.value);
                    setConfirm(false);
                  }}
                >
                  <option value="">Selecione</option>
                  {state.users
                    .filter((u) => u.object_id)
                    .map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.display_name} — {u.email}
                      </option>
                    ))}
                </select>
              </label>
              {source && (
                <small>
                  Object ID:{' '}
                  {state.users.find((u) => u.id === source)?.object_id}
                </small>
              )}
              <label>
                Perfil histórico que pertence à pessoa
                <select
                  required
                  value={target}
                  onChange={(e) => {
                    setTarget(e.target.value);
                    setConfirm(false);
                  }}
                >
                  <option value="">Selecione</option>
                  {state.users
                    .filter((u) => !u.object_id)
                    .map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name} — cadastro antigo:{' '}
                        {u.registration_email || 'sem e-mail'}
                      </option>
                    ))}
                </select>
              </label>
              <label className="check">
                <input
                  type="checkbox"
                  required
                  checked={confirm}
                  onChange={(e) => setConfirm(e.target.checked)}
                />
                Conferi a identidade e confirmo que os dois registros pertencem
                à mesma pessoa.
              </label>
              <button className="primary" disabled={!confirm}>
                Confirmar vínculo
              </button>
            </form>
          </section>
          <section>
            <h2>Histórico administrativo</h2>
            {state.audit.length ? (
              state.audit.map((a) => (
                <details key={a.id}>
                  <summary>
                    {a.created_at} · {a.name} ·{' '}
                    {{
                      access: 'Alteração de acesso',
                      membership: 'Participação no setor',
                      workspace: 'Alteração de setor',
                      link: 'Vínculo de identidade',
                      review: 'Análise de solicitação',
                      delete_profile: 'Exclusão de perfil',
                    }[a.action] || a.action}
                  </summary>
                  <pre>{a.details}</pre>
                </details>
              ))
            ) : (
              <p>Nenhuma alteração registrada.</p>
            )}
          </section>
        </fieldset>
      )}
    </main>
  );
}
