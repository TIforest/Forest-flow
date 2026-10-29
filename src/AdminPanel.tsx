import { useEffect, useRef, useState } from 'react';
import { AvatarPhoto } from './AvatarPhoto';
import { useAutoRefresh } from './useAutoRefresh';
import {
  LayoutDashboard,
  Users,
  CalendarDays,
  Settings2,
  RefreshCw,
  History,
  Search,
  ArrowRight,
  Plus,
  X,
  LogOut,
  Inbox,
  Building2,
  ShieldCheck,
  Pencil,
  ChevronRight,
  ChevronDown,
} from 'lucide-react';
import type { CorporateUser, Workspace } from './AuthGate';
import { Brand } from './Brand';
import { DeleteProfileDialog } from './DeleteProfileDialog';
import { AccessReview } from './AccessReview';
import { AdminUserPanel } from './AdminUserPanel';
import { AdminHistory } from './AdminHistory';
import { AddSectorMember } from './AddSectorMember';
import {
  initials,
  personStatus,
  statusLabels,
  type AdminState,
  type AdminPerson,
  type BoardView,
} from './admin-model';
import './admin.css';
type Tab = 'users' | 'requests' | 'workspaces';
const shortWorkspace = (name: string) =>
  name === 'Tecnologia da Informação' ? 'TI' : name;
const normalize = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
export function AdminPanel({
  user,
  workspaces,
  currentWorkspace,
  onWorkspaceChange,
  onExit,
  onLogout,
  onChange,
}: {
  user: CorporateUser;
  workspaces: Workspace[];
  currentWorkspace?: Workspace;
  onWorkspaceChange: (id: string) => void;
  onExit: (view: BoardView) => void;
  onLogout: () => Promise<void>;
  onChange: () => Promise<void>;
}) {
  const [state, setState] = useState<AdminState | null>(null),
    [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
    [busy, setBusy] = useState(false),
    [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState<Tab>(() =>
      user.is_admin &&
      new URLSearchParams(location.search).get('administration') === 'requests'
        ? 'requests'
        : 'users',
    ),
    [query, setQuery] = useState(''),
    [sector, setSector] = useState(''),
    [status, setStatus] = useState(''),
    [selected, setSelected] = useState<string | null>(null),
    [deleting, setDeleting] = useState<string | null>(null),
    [history, setHistory] = useState<string | null | false>(false);
  const [requestFilter, setRequestFilter] = useState('submitted'),
    [newSector, setNewSector] = useState(false),
    [sectorName, setSectorName] = useState(''),
    [editingSector, setEditingSector] = useState<string | null>(null),
    [editName, setEditName] = useState('');
  const inFlight = useRef(false),
    sequence = useRef(0);
  const [addingMember, setAddingMember] = useState(false);
  const globalAdmin = user.is_admin === 1;
  async function load() {
    const n = ++sequence.current;
    const r = await fetch('/api/admin/state');
    const data = (await r.json()) as AdminState & { error?: string };
    if (!r.ok) {
      if (r.status === 401)
        dispatchEvent(new CustomEvent('forest-session-expired'));
      throw new Error(
        data.error || 'Não foi possível carregar a administração.',
      );
    }
    if (n === sequence.current) setState(data);
  }
  useEffect(() => {
    let active = true;
    void load().catch((e) => {
      if (active) setError(e.message);
    });
    return () => {
      active = false;
      ++sequence.current;
    };
  }, []);
  useAutoRefresh(async () => {
    if (!inFlight.current) await load();
  });
  useEffect(() => {
    if (state && selected && !state.users.some((u) => u.id === selected))
      setSelected(null);
  }, [state, selected]);
  async function refresh() {
    setRefreshing(true);
    setError('');
    try {
      await load();
      await onChange();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setRefreshing(false);
    }
  }
  async function save(path: string, body: unknown) {
    if (inFlight.current) return false;
    inFlight.current = true;
    setBusy(true);
    setError('');
    setNotice('');
    let saved = false;
    try {
      const r = await fetch('/api/admin/' + path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = (await r.json()) as { error?: string };
      if (!r.ok)
        throw new Error(data.error || 'Não foi possível salvar a alteração.');
      saved = true;
      await load();
      await onChange();
      setNotice(
        path === 'review'
          ? 'Análise da solicitação salva.'
          : 'Alteração salva.',
      );
      return true;
    } catch (e) {
      setError(
        saved
          ? 'A alteração foi salva, mas a lista não pôde ser atualizada. Clique em Atualizar.'
          : (e as Error).message,
      );
      return saved;
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }
  const pending =
    state?.requests.filter(
      (r) => r.status === 'submitted' && r.access_status === 'pending',
    ) || [];
  const current = state?.users.find((u) => u.id === selected);
  const rows =
    state?.users.filter((u) => {
      const text = normalize(
        [
          u.name,
          u.email || '',
          u.registration_email || '',
          u.job,
          ...state.memberships
            .filter(
              (m) =>
                m.user_id === u.id && (!sector || m.workspace_id === sector),
            )
            .map((m) => m.sector_job || ''),
        ].join(' '),
      );
      return (
        (!query || text.includes(normalize(query))) &&
        (!sector ||
          state.memberships.some(
            (m) => m.user_id === u.id && m.workspace_id === sector,
          )) &&
        (!status || personStatus(u) === status)
      );
    }) || [];
  const switchTab = (next: Tab) => {
    setTab(next);
    setSelected(null);
    setNotice('');
  };
  const viewRequests = () => {
    switchTab('requests');
    setRequestFilter('submitted');
  };
  const tabs: [Tab, string, number][] = (
    [
      ['users', 'Usuários', state?.users.length || 0],
      ['requests', 'Solicitações', pending.length],
      ['workspaces', 'Setores', state?.workspaces.length || 0],
    ] as [Tab, string, number][]
  ).filter(([id]) => globalAdmin || id === 'users');
  const tableRole = (u: AdminPerson) => {
    if (u.is_admin) return 'Administrador';
    const list = state!.memberships.filter(
      (m) => m.user_id === u.id && (!sector || m.workspace_id === sector),
    );
    if (!list.length) return 'Não definido';
    const roles = new Set(list.map((m) => m.role));
    return roles.size > 1
      ? 'Por setor'
      : list[0].role === 'coordinator'
        ? 'Coordenador'
        : 'Membro';
  };
  return (
    <div className="admin-shell">
      <aside className="sidebar admin-sidebar">
        <a
          className="brand"
          href="/"
          onClick={(e) => {
            e.preventDefault();
            onExit('team');
          }}
          aria-label="Forest Flow início"
        >
          <Brand />
        </a>
        <label className="admin-workspace-picker">
          <span className="sr-only">Espaço de trabalho</span>
          <select
            aria-label="Espaço de trabalho"
            value={currentWorkspace?.id || ''}
            onChange={(e) => onWorkspaceChange(e.target.value)}
          >
            <option value="" disabled>
              Selecione um setor
            </option>
            {workspaces.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
          <ChevronDown size={15} />
        </label>
        <nav aria-label="Seções">
          <button onClick={() => onExit('mine')}>
            <LayoutDashboard size={19} />
            Minha semana
          </button>
          <button onClick={() => onExit('team')}>
            <Users size={19} />
            Equipe
          </button>
          <button onClick={() => onExit('meeting')}>
            <CalendarDays size={19} />
            Reunião semanal
          </button>
          <span className="admin-nav-divider" />
          <button
            className="active"
            aria-current="page"
            onClick={() => switchTab('users')}
          >
            <Settings2 size={19} />
            Administração
          </button>
        </nav>
        <div className="profile">
          <span
            className="admin-avatar"
            style={{ '--person-color': user.color } as React.CSSProperties}
          >
            <AvatarPhoto user={user} fallback={initials(user.name)} />
          </span>
          <div>
            <strong>{user.name}</strong>
            <small>
              {state?.memberships.find(
                (m) =>
                  m.user_id === user.id &&
                  m.workspace_id === currentWorkspace?.id,
              )?.sector_job ||
                user.job ||
                'Cargo não informado'}
            </small>
          </div>
          <div className="profile-actions">
            <button
              onClick={() => void onLogout().catch((e) => setError(e.message))}
            >
              <LogOut size={14} />
              Sair
            </button>
          </div>
        </div>
      </aside>
      <main className="admin-main">
        <div className="admin-topline">
          <span>
            Administração <i>/</i>{' '}
            {tab === 'users'
              ? 'Usuários'
              : tab === 'requests'
                ? 'Solicitações'
                : 'Setores'}
          </span>
          <button
            className="text-button admin-history-trigger"
            onClick={() => setHistory(null)}
          >
            <History size={16} />
            Histórico
          </button>
        </div>
        <header className="admin-heading">
          <div>
            <h1>Usuários e acessos</h1>
            <p>
              {globalAdmin
                ? 'Gerencie pessoas, setores e permissões.'
                : 'Gerencie os integrantes dos setores que você coordena.'}
            </p>
          </div>
          <button
            className="secondary"
            disabled={refreshing || busy}
            onClick={() => void refresh()}
          >
            <RefreshCw
              size={16}
              className={refreshing ? 'admin-spinning' : ''}
            />
            {refreshing ? 'Atualizando…' : 'Atualizar'}
          </button>
        </header>
        <div className="admin-tabs" role="tablist" aria-label="Administração">
          {tabs.map(([id, label, count]) => (
            <button
              key={id}
              role="tab"
              id={'admin-tab-' + id}
              aria-selected={tab === id}
              aria-controls={'admin-content-' + id}
              tabIndex={tab === id ? 0 : -1}
              className={tab === id ? 'is-active' : ''}
              onClick={() => switchTab(id)}
              onKeyDown={(e) => {
                if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key))
                  return;
                e.preventDefault();
                const idx = tabs.findIndex(([t]) => t === id);
                const next =
                  e.key === 'Home'
                    ? tabs[0][0]
                    : e.key === 'End'
                      ? tabs[tabs.length - 1][0]
                      : tabs[
                          (idx +
                            (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) %
                            tabs.length
                        ][0];
                switchTab(next);
                document.getElementById('admin-tab-' + next)?.focus();
              }}
            >
              {label}
              <span className={id === 'requests' && count ? 'has-pending' : ''}>
                {count}
              </span>
            </button>
          ))}
        </div>
        {error && (
          <div className="error admin-feedback" role="alert">
            {error}
            <button
              className="icon-button"
              aria-label="Fechar aviso de erro"
              onClick={() => setError('')}
            >
              <X size={16} />
            </button>
          </div>
        )}
        {notice && (
          <div className="admin-notice" role="status">
            <ShieldCheck size={16} />
            {notice}
            <button
              className="icon-button"
              aria-label="Fechar confirmação"
              onClick={() => setNotice('')}
            >
              <X size={16} />
            </button>
          </div>
        )}
        {!state ? (
          <div className="admin-empty" role="status">
            <RefreshCw size={24} />
            <strong>Carregando administração…</strong>
          </div>
        ) : (
          <section
            role="tabpanel"
            id={'admin-content-' + tab}
            aria-labelledby={'admin-tab-' + tab}
          >
            {tab === 'users' && (
              <div
                className={
                  'admin-users-layout' + (current ? ' has-selection' : '')
                }
              >
                <div className="admin-user-list">
                  {pending.length > 0 && (
                    <div className="admin-pending-banner">
                      <span>
                        <Inbox size={19} />
                        <strong>
                          {pending.length}{' '}
                          {pending.length === 1
                            ? 'solicitação aguarda'
                            : 'solicitações aguardam'}{' '}
                          sua análise
                        </strong>
                      </span>
                      <button onClick={viewRequests}>
                        Revisar solicitações <ArrowRight size={17} />
                      </button>
                    </div>
                  )}
                  <button
                    className="secondary"
                    onClick={() => setAddingMember(true)}
                  >
                    <Plus size={16} /> Adicionar integrante
                  </button>
                  <div className="admin-table-toolbar">
                    <label className="admin-search">
                      <Search size={18} />
                      <input
                        aria-label="Buscar usuários"
                        placeholder="Buscar por nome, e-mail ou cargo…"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                      />
                      {query && (
                        <button
                          className="icon-button"
                          aria-label="Limpar busca"
                          onClick={() => setQuery('')}
                        >
                          <X size={14} />
                        </button>
                      )}
                    </label>
                    <select
                      aria-label="Filtrar usuários por setor"
                      value={sector}
                      onChange={(e) => setSector(e.target.value)}
                    >
                      <option value="">Todos os setores</option>
                      {state.workspaces.map((w) => (
                        <option key={w.id} value={w.id}>
                          {w.name}
                          {w.active ? '' : ' (desativado)'}
                        </option>
                      ))}
                    </select>
                    <select
                      aria-label="Filtrar usuários por status"
                      value={status}
                      onChange={(e) => setStatus(e.target.value)}
                    >
                      <option value="">Todos os status</option>
                      {Object.entries(statusLabels).map(([id, label]) => (
                        <option key={id} value={id}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="admin-users-table-wrap">
                    <table className="admin-users-table">
                      <thead>
                        <tr>
                          <th>Pessoa</th>
                          <th>Setor</th>
                          <th>Função</th>
                          <th>Status</th>
                          <th>
                            <span className="sr-only">Ações</span>
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((u) => {
                          const memberships = state.memberships.filter(
                            (m) => m.user_id === u.id,
                          );
                          const statusKey = personStatus(u);
                          const localJob = (
                            sector
                              ? memberships.find(
                                  (m) => m.workspace_id === sector,
                                )
                              : memberships.length === 1
                                ? memberships[0]
                                : undefined
                          )?.sector_job;
                          return (
                            <tr
                              key={u.id}
                              className={selected === u.id ? 'is-selected' : ''}
                            >
                              <td>
                                <div className="admin-table-person">
                                  <span
                                    className="admin-avatar"
                                    style={
                                      {
                                        '--person-color': u.color,
                                      } as React.CSSProperties
                                    }
                                  >
                                    <AvatarPhoto
                                      user={u}
                                      fallback={initials(u.name)}
                                    />
                                  </span>
                                  <div>
                                    <strong>{u.name}</strong>
                                    <small>{localJob || u.job}</small>
                                  </div>
                                </div>
                              </td>
                              <td>
                                <div className="admin-table-sectors">
                                  {memberships.slice(0, 2).map((m) => (
                                    <span
                                      key={m.workspace_id}
                                      className="admin-tag"
                                      title={
                                        state.workspaces.find(
                                          (w) => w.id === m.workspace_id,
                                        )?.name
                                      }
                                    >
                                      {shortWorkspace(
                                        state.workspaces.find(
                                          (w) => w.id === m.workspace_id,
                                        )?.name || 'Setor desativado',
                                      )}
                                    </span>
                                  ))}
                                  {memberships.length > 2 && (
                                    <span
                                      className="admin-tag"
                                      title={memberships
                                        .slice(2)
                                        .map(
                                          (m) =>
                                            state.workspaces.find(
                                              (w) => w.id === m.workspace_id,
                                            )?.name,
                                        )
                                        .join(', ')}
                                    >
                                      +{memberships.length - 2}
                                    </span>
                                  )}
                                  {!memberships.length && (
                                    <span className="admin-muted">
                                      Sem setor
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td>{tableRole(u)}</td>
                              <td>
                                <span className={'admin-status ' + statusKey}>
                                  <i />
                                  {statusLabels[statusKey] || u.access_status}
                                </span>
                              </td>
                              <td>
                                <button
                                  className="admin-manage"
                                  aria-label={'Gerenciar acesso de ' + u.name}
                                  aria-expanded={selected === u.id}
                                  onClick={() => setSelected(u.id)}
                                >
                                  Gerenciar
                                  <ChevronRight size={14} />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    {!rows.length && (
                      <div className="admin-empty">
                        <Users size={28} />
                        <strong>
                          {query || sector || status
                            ? 'Nenhum usuário encontrado'
                            : 'Nenhum perfil cadastrado'}
                        </strong>
                        <p>
                          {query || sector || status
                            ? 'Ajuste a busca ou os filtros para encontrar uma pessoa.'
                            : 'Novos colaboradores aparecerão depois do primeiro login Microsoft.'}
                        </p>
                        {!!(query || sector || status) && (
                          <button
                            className="secondary"
                            onClick={() => {
                              setQuery('');
                              setSector('');
                              setStatus('');
                            }}
                          >
                            Limpar filtros
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                  <p className="admin-table-footer">
                    Mostrando {rows.length} de {state.users.length}{' '}
                    {state.users.length === 1 ? 'usuário' : 'usuários'}
                  </p>
                </div>
                {current && (
                  <>
                    <button
                      className="admin-user-scrim"
                      aria-label="Fechar painel de usuário"
                      onClick={() => !busy && setSelected(null)}
                    />
                    <AdminUserPanel
                      key={current.id}
                      person={current}
                      globalAdmin={globalAdmin}
                      actorId={user.id}
                      state={state}
                      busy={busy}
                      save={save}
                      close={() => setSelected(null)}
                      onDelete={() => setDeleting(current.id)}
                      onHistory={() => setHistory(current.id)}
                      onReview={viewRequests}
                    />
                  </>
                )}
              </div>
            )}
            {tab === 'requests' && (
              <div className="admin-requests-content">
                <div className="admin-section-heading">
                  <div>
                    <h2>Solicitações de acesso</h2>
                    <p>
                      Confira os dados e escolha o setor e a função antes de
                      aprovar.
                    </p>
                  </div>
                  <select
                    aria-label="Filtrar solicitações"
                    value={requestFilter}
                    onChange={(e) => setRequestFilter(e.target.value)}
                  >
                    <option value="submitted">Aguardando análise</option>
                    <option value="approved">Aprovadas</option>
                    <option value="rejected">Correção solicitada</option>
                    <option value="all">Todas as solicitações</option>
                  </select>
                </div>
                <fieldset disabled={busy} className="admin-request-list">
                  {state.requests
                    .filter(
                      (r) =>
                        requestFilter === 'all' ||
                        (r.status === requestFilter &&
                          (requestFilter !== 'submitted' ||
                            r.access_status === 'pending')),
                    )
                    .map((r) => (
                      <AccessReview
                        key={r.user_id + ':' + r.submitted_at + ':' + r.status}
                        request={r}
                        workspaces={state.workspaces}
                        save={save}
                      />
                    ))}
                  {!state.requests.some(
                    (r) =>
                      requestFilter === 'all' ||
                      (r.status === requestFilter &&
                        (requestFilter !== 'submitted' ||
                          r.access_status === 'pending')),
                  ) && (
                    <div className="admin-empty">
                      <Inbox size={30} />
                      <strong>
                        {requestFilter === 'submitted'
                          ? 'Nenhuma solicitação aguardando análise'
                          : 'Nenhuma solicitação neste filtro'}
                      </strong>
                      <p>
                        Os cadastros enviados pelos colaboradores aparecem aqui.
                      </p>
                    </div>
                  )}
                </fieldset>
              </div>
            )}
            {tab === 'workspaces' && (
              <div className="admin-workspaces-content">
                <div className="admin-section-heading">
                  <div>
                    <h2>Espaços de trabalho</h2>
                    <p>
                      Organize os setores e acompanhe quem participa de cada
                      equipe.
                    </p>
                  </div>
                  <button
                    className="primary"
                    onClick={() => setNewSector(!newSector)}
                  >
                    <Plus size={17} />
                    Novo setor
                  </button>
                </div>
                {newSector && (
                  <form
                    className="admin-new-sector admin-form"
                    onSubmit={(e) => {
                      e.preventDefault();
                      void save('workspace', { name: sectorName }).then(
                        (ok) => {
                          if (ok) {
                            setSectorName('');
                            setNewSector(false);
                          }
                        },
                      );
                    }}
                  >
                    <label>
                      Nome do novo setor
                      <input
                        autoFocus
                        required
                        maxLength={120}
                        value={sectorName}
                        onChange={(e) => setSectorName(e.target.value)}
                        placeholder="Ex.: Financeiro"
                        disabled={busy}
                      />
                    </label>
                    <button
                      className="secondary"
                      type="button"
                      disabled={busy}
                      onClick={() => setNewSector(false)}
                    >
                      Cancelar
                    </button>
                    <button className="primary" disabled={busy}>
                      Criar setor
                    </button>
                  </form>
                )}
                <div className="admin-workspace-grid">
                  {state.workspaces.map((w) => {
                    const members = state.memberships.filter(
                      (m) => m.workspace_id === w.id,
                    );
                    return (
                      <article
                        key={w.id}
                        className={
                          'admin-workspace-card' +
                          (!w.active ? ' is-inactive' : '')
                        }
                      >
                        <div className="admin-workspace-card-top">
                          <span className="admin-workspace-icon">
                            <Building2 size={22} />
                          </span>
                          <span
                            className={
                              'admin-status ' +
                              (w.active ? 'active' : 'blocked')
                            }
                          >
                            <i />
                            {w.active ? 'Ativo' : 'Desativado'}
                          </span>
                        </div>
                        {editingSector === w.id ? (
                          <form
                            className="admin-form admin-rename"
                            onSubmit={(e) => {
                              e.preventDefault();
                              void save('workspace', {
                                id: w.id,
                                name: editName,
                                active: !!w.active,
                              }).then((ok) => {
                                if (ok) setEditingSector(null);
                              });
                            }}
                          >
                            <label>
                              Nome do setor
                              <input
                                autoFocus
                                required
                                maxLength={120}
                                value={editName}
                                onChange={(e) => setEditName(e.target.value)}
                              />
                            </label>
                            <div>
                              <button
                                className="secondary"
                                type="button"
                                disabled={busy}
                                onClick={() => setEditingSector(null)}
                              >
                                Cancelar
                              </button>
                              <button className="primary" disabled={busy}>
                                Salvar nome
                              </button>
                            </div>
                          </form>
                        ) : (
                          <div className="admin-workspace-name">
                            <h3>{w.name}</h3>
                            <button
                              className="icon-button"
                              disabled={busy}
                              aria-label={'Renomear setor ' + w.name}
                              onClick={() => {
                                setEditingSector(w.id);
                                setEditName(w.name);
                              }}
                            >
                              <Pencil size={15} />
                            </button>
                          </div>
                        )}
                        <p>
                          {members.length}{' '}
                          {members.length === 1
                            ? 'perfil vinculado'
                            : 'perfis vinculados'}{' '}
                          <span>·</span>{' '}
                          {
                            members.filter((m) => m.role === 'coordinator')
                              .length
                          }{' '}
                          na coordenação
                        </p>
                        <div className="admin-workspace-card-actions">
                          <button
                            className="text-button"
                            onClick={() => {
                              setSector(w.id);
                              setQuery('');
                              setStatus('');
                              switchTab('users');
                            }}
                          >
                            Gerenciar pessoas
                            <ArrowRight size={14} />
                          </button>
                          <button
                            className="text-button"
                            disabled={busy}
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
                      </article>
                    );
                  })}
                </div>
                <p className="admin-section-help">
                  Desativar um setor suspende o acesso ao quadro e preserva
                  atividades, históricos e participações.
                </p>
              </div>
            )}
          </section>
        )}
      </main>
      {addingMember && state && (
        <AddSectorMember
          state={state}
          save={save}
          close={() => setAddingMember(false)}
        />
      )}
      {deleting && (
        <DeleteProfileDialog
          key={deleting}
          userId={deleting}
          close={() => setDeleting(null)}
          onDeleted={async () => {
            await load();
            await onChange();
            setSelected(null);
            setNotice(
              'Perfil excluído. Atividades e históricos preservados como Usuário excluído.',
            );
          }}
        />
      )}
      {history !== false && state && (
        <AdminHistory
          state={state}
          person={
            typeof history === 'string'
              ? state.users.find((u) => u.id === history) || null
              : null
          }
          close={() => setHistory(false)}
        />
      )}
    </div>
  );
}
