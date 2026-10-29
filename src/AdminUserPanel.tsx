import { useState } from 'react';
import { AvatarPhoto } from './AvatarPhoto';
import {
  X,
  Plus,
  LockKeyhole,
  UnlockKeyhole,
  Trash2,
  ChevronDown,
  History,
  Link2,
  UserRound,
} from 'lucide-react';
import type { AdminPerson, AdminSave, AdminState } from './admin-model';
import { initials, statusLabels, personStatus } from './admin-model';
function AdministratorAccess({
  person,
  actorId,
  save,
}: {
  person: AdminPerson;
  actorId: string;
  save: AdminSave;
}) {
  const [value, setValue] = useState(!!person.is_admin),
    [confirm, setConfirm] = useState(false);
  if (
    !person.object_id ||
    person.access_status !== 'active' ||
    person.onboarding_required
  )
    return null;
  const protectedAccount = !!person.protected_admin || person.id === actorId;
  return (
    <form
      className="admin-form admin-advanced"
      onSubmit={(e) => {
        e.preventDefault();
        if (!confirm || value === !!person.is_admin) return;
        void save('administrator', {
          user_id: person.id,
          is_admin: value,
          confirm: true,
        }).then((ok) => {
          if (ok) setConfirm(false);
        });
      }}
    >
      <label>
        Papel no sistema
        <select
          aria-label="Papel no sistema"
          disabled={protectedAccount}
          value={value ? 'administrator' : 'user'}
          onChange={(e) => {
            setValue(e.target.value === 'administrator');
            setConfirm(false);
          }}
        >
          <option value="user">Usuário — permissões por setor</option>
          <option value="administrator">Administrador do sistema</option>
        </select>
      </label>
      <p className="admin-muted">
        {protectedAccount
          ? 'Seu próprio acesso e o administrador principal estão protegidos.'
          : 'Administradores gerenciam todos os setores, solicitações, acessos e outros administradores.'}
      </p>
      {value !== !!person.is_admin && (
        <>
          <label className="admin-check">
            <input
              type="checkbox"
              checked={confirm}
              onChange={(e) => setConfirm(e.target.checked)}
            />
            <span>
              {value
                ? 'Confirmo conceder acesso administrativo a todo o Forest Flow.'
                : 'Confirmo retirar o acesso administrativo global. As participações nos setores serão mantidas.'}
            </span>
          </label>
          <button className="primary admin-full-button" disabled={!confirm}>
            Confirmar papel no sistema
          </button>
        </>
      )}
    </form>
  );
}
function SectorJob({
  person,
  workspaceId,
  job,
  save,
}: {
  person: AdminPerson;
  workspaceId: string;
  job: string;
  save: AdminSave;
}) {
  const [value, setValue] = useState(job);
  return (
    <form
      className="admin-form admin-advanced"
      onSubmit={(e) => {
        e.preventDefault();
        void save('member-profile', {
          user_id: person.id,
          workspace_id: workspaceId,
          job: value,
        });
      }}
    >
      <label>
        Cargo neste setor
        <input
          value={value}
          maxLength={120}
          placeholder={person.job}
          onChange={(e) => setValue(e.target.value)}
        />
      </label>
      <small className="admin-muted">
        Altera apenas este setor. Em branco, utiliza o cargo do perfil.
      </small>
      <button className="secondary admin-full-button" disabled={value === job}>
        Salvar cargo no setor
      </button>
    </form>
  );
}
function LegacyLink({
  person,
  state,
  save,
}: {
  person: AdminPerson;
  state: AdminState;
  save: AdminSave;
}) {
  const [source, setSource] = useState(person.object_id ? person.id : ''),
    [target, setTarget] = useState(person.object_id ? '' : person.id),
    [confirm, setConfirm] = useState(false);
  return (
    <form
      className="admin-form admin-link-form"
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
      <h4>
        <Link2 size={15} /> Vincular perfil antigo
      </h4>
      <p>
        Confira a identidade Microsoft. As tarefas e históricos do perfil antigo
        serão preservados.
      </p>
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
          <option value="">Selecione a conta</option>
          {state.users
            .filter((u) => u.object_id)
            .map((u) => (
              <option key={u.id} value={u.id}>
                {u.display_name || u.name} — {u.email}
              </option>
            ))}
        </select>
      </label>
      {source && (
        <small className="admin-object-id">
          Object ID: {state.users.find((u) => u.id === source)?.object_id}
        </small>
      )}
      <label>
        Perfil histórico da mesma pessoa
        <select
          required
          value={target}
          onChange={(e) => {
            setTarget(e.target.value);
            setConfirm(false);
          }}
        >
          <option value="">Selecione o perfil</option>
          {state.users
            .filter((u) => !u.object_id)
            .map((u) => (
              <option key={u.id} value={u.id}>
                {u.name} — {u.registration_email || 'sem e-mail antigo'}
              </option>
            ))}
        </select>
      </label>
      <label className="admin-check">
        <input
          required
          type="checkbox"
          checked={confirm}
          onChange={(e) => setConfirm(e.target.checked)}
        />
        <span>Conferi que os dois registros pertencem à mesma pessoa.</span>
      </label>
      <small>
        O vínculo mantém as participações do perfil histórico. Revise as funções
        após vincular.
      </small>
      <button className="secondary" disabled={!confirm}>
        Confirmar vínculo
      </button>
    </form>
  );
}
export function AdminUserPanel({
  person,
  globalAdmin,
  actorId,
  state,
  busy,
  save,
  close,
  onDelete,
  onHistory,
  onReview,
}: {
  person: AdminPerson;
  globalAdmin: boolean;
  actorId: string;
  state: AdminState;
  busy: boolean;
  save: AdminSave;
  close: () => void;
  onDelete: () => void;
  onHistory: () => void;
  onReview: () => void;
}) {
  const memberships = state.memberships.filter((m) => m.user_id === person.id);
  const [selected, setSelected] = useState(
      () => memberships[0]?.workspace_id || '',
    ),
    [role, setRole] = useState<'member' | 'coordinator'>(
      () => memberships[0]?.role || 'member',
    ),
    [adding, setAdding] = useState(false);
  const membership = memberships.find((m) => m.workspace_id === selected),
    workspace = state.workspaces.find((w) => w.id === selected);
  const dirty = !!selected && (!membership || membership.role !== role);
  const available = state.workspaces.filter(
    (w) => w.active && !memberships.some((m) => m.workspace_id === w.id),
  );
  const choose = (id: string) => {
    setSelected(id);
    setRole(memberships.find((m) => m.workspace_id === id)?.role || 'member');
  };
  const active = person.access_status === 'active';
  const canManageMember =
    globalAdmin ||
    (!person.is_admin &&
      membership?.role !== 'coordinator' &&
      person.id !== actorId);
  return (
    <aside
      className="admin-user-panel"
      aria-label={'Gerenciar acesso de ' + person.name}
    >
      <header>
        <h2>Gerenciar acesso</h2>
        <button
          className="icon-button"
          aria-label="Fechar gerenciamento de acesso"
          disabled={busy}
          onClick={close}
        >
          <X size={20} />
        </button>
      </header>
      <div className="admin-user-panel-body">
        <div className="admin-person-identity">
          <span
            className="admin-avatar admin-avatar-large"
            style={{ '--person-color': person.color } as React.CSSProperties}
          >
            <AvatarPhoto user={person} fallback={initials(person.name)} />
          </span>
          <div>
            <h3>{person.name}</h3>
            <p>
              {person.email ||
                person.registration_email ||
                'E-mail ainda não vinculado'}
            </p>
            <small>
              {person.object_id ? (
                <>
                  <span className="admin-microsoft" aria-hidden="true">
                    <i />
                    <i />
                    <i />
                    <i />
                  </span>{' '}
                  Conta corporativa
                </>
              ) : (
                <>
                  <UserRound size={14} /> Perfil histórico
                </>
              )}
            </small>
          </div>
        </div>
        <p className="admin-profile-job">{person.job}</p>
        <fieldset disabled={busy} className="admin-panel-controls">
          <form
            className="admin-form"
            onSubmit={(e) => {
              e.preventDefault();
              if (!selected || !dirty) return;
              void save('membership', {
                user_id: person.id,
                workspace_id: selected,
                role,
              }).then((ok) => {
                if (ok) setAdding(false);
              });
            }}
          >
            <label className="admin-field-title">Setores autorizados</label>
            <div className="admin-sector-chips">
              {memberships.map((m) => {
                const w = state.workspaces.find((w) => w.id === m.workspace_id);
                return (
                  <button
                    type="button"
                    key={m.workspace_id}
                    className={
                      'admin-sector-chip' +
                      (selected === m.workspace_id ? ' is-selected' : '')
                    }
                    onClick={() => {
                      choose(m.workspace_id);
                      setAdding(false);
                    }}
                    title={w?.name + (w?.active ? '' : ' (desativado)')}
                  >
                    {w?.name || 'Setor desativado'}
                  </button>
                );
              })}
              {!memberships.length && (
                <small className="admin-muted">Nenhum setor associado.</small>
              )}
              {available.length > 0 && (
                <button
                  className="admin-add-sector"
                  type="button"
                  onClick={() => setAdding(!adding)}
                  aria-expanded={adding}
                >
                  <Plus size={14} />
                  Adicionar setor
                </button>
              )}
            </div>
            {(adding || !memberships.length) && available.length > 0 && (
              <label>
                Adicionar ao setor
                <select
                  required
                  value={membership ? '' : selected}
                  onChange={(e) => choose(e.target.value)}
                >
                  <option value="">Selecione o setor</option>
                  {available.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {selected && (
              <>
                <label>
                  Função {workspace ? 'em ' + workspace.name : 'no setor'}
                  <select
                    value={role}
                    disabled={!globalAdmin}
                    onChange={(e) =>
                      setRole(e.target.value as 'member' | 'coordinator')
                    }
                  >
                    <option value="member">Membro</option>
                    <option value="coordinator">Coordenador</option>
                  </select>
                </label>
                {workspace && !workspace.active && (
                  <p className="admin-inline-hint">
                    Este setor está desativado. Reative-o na aba Setores para
                    permitir o acesso.
                  </p>
                )}
              </>
            )}
            <div className="admin-access-state">
              <span>Acesso ao aplicativo</span>
              <span className={'admin-status ' + personStatus(person)}>
                <i />
                {statusLabels[personStatus(person)] || 'Sem acesso'}
              </span>
            </div>
            <p className="admin-muted admin-permission-note">
              {person.is_admin
                ? 'Administradores gerenciam todos os setores. A participação acima também permite atribuir atividades a eles.'
                : 'As permissões valem somente para os setores autorizados. O cargo informado não concede coordenação.'}
            </p>
            <button
              type="submit"
              className="primary admin-full-button"
              disabled={
                !canManageMember || !dirty || (!!workspace && !workspace.active)
              }
            >
              Salvar alterações
            </button>
            {membership && canManageMember && (
              <button
                type="button"
                className="text-button admin-remove-sector"
                onClick={() =>
                  void save('membership', {
                    ...membership,
                    role: 'remove',
                  }).then((ok) => {
                    if (ok) {
                      const next = memberships.find(
                        (m) => m.workspace_id !== membership.workspace_id,
                      );
                      choose(next?.workspace_id || '');
                    }
                  })
                }
              >
                Remover deste setor
              </button>
            )}
          </form>
          {membership && canManageMember && workspace?.active === 1 && (
            <SectorJob
              key={person.id + membership.workspace_id}
              person={person}
              workspaceId={membership.workspace_id}
              job={membership.sector_job || ''}
              save={save}
            />
          )}
          {!canManageMember && (
            <p className="admin-muted">
              Alterações de coordenadores e administradores são exclusivas dos
              administradores do sistema.
            </p>
          )}
          {globalAdmin && (
            <AdministratorAccess
              key={person.id + person.is_admin}
              person={person}
              actorId={actorId}
              save={save}
            />
          )}
          {globalAdmin &&
            person.object_id &&
            !person.is_admin &&
            (person.access_status === 'pending' ? (
              <button
                className="secondary admin-full-button"
                onClick={onReview}
              >
                Ver solicitação de acesso
              </button>
            ) : (
              <button
                className="secondary admin-full-button"
                onClick={() =>
                  void save('access', {
                    user_id: person.id,
                    status: active
                      ? 'blocked'
                      : person.onboarding_required
                        ? 'pending'
                        : 'active',
                  })
                }
              >
                {active ? (
                  <LockKeyhole size={16} />
                ) : (
                  <UnlockKeyhole size={16} />
                )}{' '}
                {active
                  ? 'Bloquear acesso'
                  : person.onboarding_required
                    ? 'Reabrir cadastro'
                    : 'Liberar acesso'}
              </button>
            ))}
          <details className="admin-advanced">
            <summary>
              Opções avançadas <ChevronDown size={15} />
            </summary>
            <div className="admin-advanced-content">
              {globalAdmin && person.object_id && (
                <dl className="admin-identity-details">
                  <dt>Nome na Microsoft</dt>
                  <dd>{person.display_name}</dd>
                  <dt>Identificação estável</dt>
                  <dd>{person.object_id}</dd>
                </dl>
              )}
              {globalAdmin &&
                person.object_id &&
                !person.is_admin &&
                person.access_status === 'pending' && (
                  <button
                    className="secondary admin-full-button"
                    type="button"
                    onClick={() =>
                      void save('access', {
                        user_id: person.id,
                        status: 'blocked',
                      })
                    }
                  >
                    <LockKeyhole size={15} /> Bloquear este cadastro
                  </button>
                )}
              {globalAdmin && (
                <LegacyLink person={person} state={state} save={save} />
              )}
              <button className="text-button" onClick={onHistory}>
                <History size={15} /> Histórico desta pessoa
              </button>
            </div>
          </details>
          {globalAdmin && !person.is_admin && (
            <div className="admin-delete-area">
              <button className="admin-delete-link" onClick={onDelete}>
                <Trash2 size={16} />
                Excluir perfil
              </button>
              <small>Atividades e históricos serão preservados.</small>
            </div>
          )}
        </fieldset>
      </div>
    </aside>
  );
}
