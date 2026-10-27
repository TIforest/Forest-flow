import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  LayoutDashboard,
  Users,
  CalendarDays,
  Plus,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  Search,
  X,
  LockKeyhole,
  CheckCircle2,
  Clock3,
  CircleAlert,
  SlidersHorizontal,
  Inbox,
  ArrowLeftRight,
  LogOut,
} from 'lucide-react';
import { statuses, type User, type Task, type Status } from './types';
import './styles.css';
import { Members } from './Members';
import { AuthGate } from './AuthGate';
import { Continuity } from './Continuity';
import { Comments } from './Comments';
import { ImportTasks } from './ImportTasks';
import { Checklist } from './Checklist';
import { Brand } from './Brand';
import { spotlight, useAmbientPause, useCountUp } from './motion';

function Count({ value }: { value: number }) {
  return <>{useCountUp(value)}</>;
}

function sunday(value = new Date()) {
  const d = new Date(value);
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() - d.getDay());
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function shift(value: string, days: number) {
  const d = new Date(value + 'T12:00:00');
  d.setDate(d.getDate() + days);
  return sunday(d);
}
function display(value: string) {
  return new Date(value + 'T12:00:00').toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
  });
}
const icons = {
  progress: Clock3,
  blocked: CircleAlert,
  done: CheckCircle2,
};
const memberColors: Record<string, [string, string]> = {
  coord: ['#7751b5', '#f0eafa'],
  bruno: ['#2869bc', '#eaf2ff'],
  ana: ['#b35c27', '#fff0e4'],
  lucas: ['#008578', '#e2f5f1'],
};
function memberStyle(id: string, user?: User): React.CSSProperties {
  const palette: [string, string][] = Object.values(memberColors);
  const hash = Array.from(id).reduce((sum, c) => sum + c.charCodeAt(0), 0);
  const [fallback] = memberColors[id] || palette[hash % palette.length];
  const color = user?.color || fallback;
  const soft = `${color}18`;
  return {
    '--member-color': color,
    '--member-soft': soft,
  } as React.CSSProperties;
}
function App({
  signedIn,
  logout,
  switchProfile,
}: {
  signedIn: User;
  logout: () => Promise<void>;
  switchProfile: () => Promise<void>;
}) {
  const identity = signedIn.id;
  const [users, setUsers] = useState<User[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [previous, setPrevious] = useState<Task[]>([]);
  const [week, setWeek] = useState(sunday());
  const [view, setView] = useState('team');
  const [search, setSearch] = useState('');
  const [person, setPerson] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Task | 'new' | null>(null);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [notice, setNotice] = useState('');
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<Status | null>(null);
  const [moveBusy, setMoveBusy] = useState(false);
  const [initialStatus, setInitialStatus] = useState<Status | undefined>();
  const [settled, setSettled] = useState(false);
  const [pulse, setPulse] = useState<Status | null>(null);
  const [keyboardMove, setKeyboardMove] = useState(false);
  const suppressClick = useRef(false);
  const moving = useRef(false);
  const context = useRef('');
  context.current = `${identity}:${week}`;
  const actor = users.find((u) => u.id === identity) || signedIn;
  const coordinator = actor?.role === 'coordinator';
  useAmbientPause();
  const colorFor = (id: string) =>
    memberStyle(
      id,
      users.find((u) => u.id === id),
    );
  async function api<T = unknown>(
    path: string,
    options: RequestInit = {},
  ): Promise<T> {
    const res = await fetch('/api/' + path, {
      ...options,
      headers: { 'Content-Type': 'application/json' },
    });
    const body = await res.json();
    if (res.status === 401)
      dispatchEvent(new CustomEvent('forest-session-expired'));
    if (!res.ok)
      throw new Error(
        (body as { error?: string }).error || 'Erro na solicitação.',
      );
    return body as T;
  }
  async function refresh() {
    const [current, last] = await Promise.all([
      api<Task[]>(`tasks?week=${week}`),
      api<Task[]>(`tasks?week=${shift(week, -7)}`),
    ]);
    setTasks(current);
    setPrevious(last);
  }
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    setTasks([]);
    setPrevious([]);
    setEditing(null);
    setDraggedId(null);
    setDropTarget(null);
    setInitialStatus(undefined);
    Promise.all([
      api<User[]>('users'),
      api<Task[]>(`tasks?week=${week}`),
      api<Task[]>(`tasks?week=${shift(week, -7)}`),
    ])
      .then(([u, t, p]) => {
        if (active) {
          setUsers(u);
          setTasks(t);
          setPrevious(p);
        }
      })
      .catch((e) => {
        if (active) setError(e.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [identity, week]);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(''), 4000);
    return () => clearTimeout(timer);
  }, [notice]);
  // A entrada escalonada dos cartões só acontece na montagem de cada tela;
  // depois disso, atualizações de dados não a repetem.
  useEffect(() => {
    setSettled(false);
    if (loading) return;
    const timer = setTimeout(() => setSettled(true), 1100);
    return () => clearTimeout(timer);
  }, [loading, view]);
  useEffect(() => {
    if (!pulse) return;
    const timer = setTimeout(() => setPulse(null), 900);
    return () => clearTimeout(timer);
  }, [pulse]);
  const visible = tasks.filter(
    (t) =>
      (view !== 'mine' || t.assignee_id === identity) &&
      (!person || t.assignee_id === person) &&
      t.title.toLocaleLowerCase().includes(search.toLocaleLowerCase()),
  );
  const done = visible.filter((t) => t.status === 'done').length;
  const blocked = visible.filter((t) => t.status === 'blocked').length;
  const name = (id: string) => users.find((u) => u.id === id)?.name || id;
  const canMove = (task: Task) =>
    !saving && !moveBusy && (coordinator || task.assignee_id === identity);
  function stopDragging() {
    setDraggedId(null);
    setDropTarget(null);
    setKeyboardMove(false);
  }
  async function moveTask(task: Task, status: Status) {
    stopDragging();
    if (!canMove(task) || moving.current || task.status === status) return;
    if (status === 'blocked') {
      setInitialStatus('blocked');
      setEditing(task);
      return;
    }
    const originalContext = context.current;
    moving.current = true;
    setMoveBusy(true);
    setError('');
    try {
      await api(`tasks/${task.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      if (context.current !== originalContext) return;
      setTasks((current) =>
        current.map((t) =>
          t.id === task.id ? { ...t, status, block_reason: '' } : t,
        ),
      );
      setNotice(`Atividade movida para ${statuses[status]}.`);
      setPulse(status);
    } catch (e) {
      if (context.current === originalContext) setError((e as Error).message);
    } finally {
      moving.current = false;
      setMoveBusy(false);
    }
  }
  function card(task: Task, index = 0) {
    return (
      <button
        className={`task ${draggedId === task.id ? 'is-dragging' : ''}`}
        draggable={view !== 'meeting' && canMove(task)}
        aria-label={`${task.title}${canMove(task) && view !== 'meeting' ? '. Para mover pelo teclado, pressione espaço, escolha a coluna com as setas e confirme com Enter.' : ''}`}
        onDragStart={(e) => {
          if (!canMove(task)) {
            e.preventDefault();
            return;
          }
          e.dataTransfer.setData('text/plain', task.id);
          e.dataTransfer.effectAllowed = 'move';
          suppressClick.current = true;
          setDraggedId(task.id);
          setDropTarget(null);
        }}
        onDragEnd={() => {
          stopDragging();
          setTimeout(() => {
            suppressClick.current = false;
          }, 0);
        }}
        onKeyDown={(e) => {
          if (!canMove(task) || view === 'meeting') return;
          const columns = Object.keys(statuses) as Status[];
          if (e.key === ' ' && !draggedId) {
            e.preventDefault();
            setKeyboardMove(true);
            setDraggedId(task.id);
            setDropTarget(task.status);
            setNotice(
              'Use as setas para escolher a coluna, Enter para mover ou Escape para cancelar.',
            );
          } else if (
            draggedId === task.id &&
            ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)
          ) {
            e.preventDefault();
            const offset = ['ArrowRight', 'ArrowDown'].includes(e.key) ? 1 : -1;
            const target =
              columns[
                (columns.indexOf(dropTarget || task.status) +
                  offset +
                  columns.length) %
                  columns.length
              ];
            setDropTarget(target);
            setNotice(`Destino: ${statuses[target]}. Enter para confirmar.`);
          } else if (draggedId === task.id && e.key === 'Enter') {
            e.preventDefault();
            void moveTask(task, dropTarget || task.status);
          } else if (draggedId === task.id && e.key === 'Escape') {
            e.preventDefault();
            stopDragging();
            setNotice('Movimentação cancelada.');
          }
        }}
        style={
          { ...colorFor(task.assignee_id), '--i': index } as React.CSSProperties
        }
        key={task.id}
        onClick={() => {
          if (!suppressClick.current && !draggedId && !moveBusy) {
            setInitialStatus(undefined);
            setEditing(task);
          }
        }}
      >
        <div className="task-top">
          {task.priority === 'high' && (
            <span className="priority high">Alta prioridade</span>
          )}
          {!!task.restricted && <LockKeyhole size={14} aria-label="Restrita" />}
          <ArrowUpRight size={15} />
        </div>
        <h3>{task.title}</h3>
        {task.description && <p>{task.description}</p>}
        {task.status === 'blocked' && (
          <div className="block-note">{task.block_reason}</div>
        )}
        <div className="task-footer">
          <span className="person">
            <span className="avatar small">
              {name(task.assignee_id).slice(0, 1)}
            </span>
            {name(task.assignee_id).split(' ·')[0]}
          </span>
          <span>{task.due_date ? display(task.due_date) : 'Sem prazo'}</span>
        </div>
      </button>
    );
  }
  const navItems: [string, string, typeof Users][] = [
    ['mine', 'Minha semana', LayoutDashboard],
    ['team', 'Equipe', Users],
    ['meeting', 'Reunião semanal', CalendarDays],
    ...(coordinator
      ? ([['members', 'Integrantes', Users]] as [
          string,
          string,
          typeof Users,
        ][])
      : []),
  ];
  const navIndex = Math.max(
    0,
    navItems.findIndex(([id]) => id === view),
  );
  return (
    <div className="app-shell" style={colorFor(identity)}>
      <div className="ambient" aria-hidden="true">
        <i />
        <i />
      </div>
      <aside className="sidebar">
        <a className="brand" href="/" aria-label="Forest Flow início">
          <Brand />
        </a>
        <div className="workspace">
          <span className="workspace-icon">TI</span>
          <div>
            <strong>Tecnologia da Informação</strong>
            <small>Espaço de trabalho</small>
          </div>
        </div>
        <nav
          aria-label="Seções"
          style={{ '--nav-index': navIndex } as React.CSSProperties}
        >
          <span className="nav-indicator" aria-hidden="true" />
          {navItems.map(([id, label, I]) => (
            <button
              key={id}
              className={view === id ? 'active' : ''}
              aria-current={view === id ? 'page' : undefined}
              onClick={() => {
                setView(id);
                setPerson('');
              }}
            >
              <I size={19} />
              {label}
              {id === 'team' && (
                <span className="nav-count">{users.length}</span>
              )}
            </button>
          ))}
        </nav>
        <div className="profile">
          <span className="avatar member-avatar" style={colorFor(identity)}>
            {actor?.name.slice(0, 1) || 'C'}
          </span>
          <div>
            <strong>{actor?.name || 'Carregando…'}</strong>
            <small>{actor?.job}</small>
          </div>
          <div className="profile-actions">
            <button
              type="button"
              title="Trocar perfil"
              onClick={() =>
                void switchProfile().catch((e) => setError(e.message))
              }
            >
              <ArrowLeftRight size={15} />
              <span>Trocar perfil</span>
            </button>
            <button
              type="button"
              title="Sair"
              onClick={() => void logout().catch((e) => setError(e.message))}
            >
              <LogOut size={15} />
              <span>Sair</span>
            </button>
          </div>
        </div>
      </aside>
      <main>
        <div className="content">
          <div className="page-heading">
            <div>
              <h1>
                {view === 'mine'
                  ? 'Minha semana'
                  : view === 'members' && coordinator
                    ? 'Gestão da equipe'
                    : view === 'meeting'
                      ? 'Reunião semanal'
                      : 'Semana da equipe'}
              </h1>
              <p>
                {view === 'members' && coordinator
                  ? 'As pessoas que fazem as entregas acontecerem.'
                  : view === 'meeting'
                    ? 'Conecte as entregas da última semana aos próximos passos.'
                    : view === 'mine'
                      ? 'As atividades sob sua responsabilidade nesta semana.'
                      : 'Tudo que a equipe está fazendo nesta semana.'}
              </p>
            </div>
            {coordinator && view !== 'members' && (
              <button className="secondary" onClick={() => setImporting(true)}>
                Importar texto
              </button>
            )}
            {actor && view !== 'members' && (
              <button className="primary" onClick={() => setEditing('new')}>
                <Plus size={18} />
                Nova atividade
              </button>
            )}
          </div>
          <div className="week-row">
            <div className="week-picker">
              <button
                aria-label="Semana anterior"
                onClick={() => setWeek(shift(week, -7))}
              >
                <ChevronLeft size={17} />
              </button>
              <CalendarDays size={16} />
              <strong>Semana de {display(week)}</strong>
              <button
                aria-label="Próxima semana"
                onClick={() => setWeek(shift(week, 7))}
              >
                <ChevronRight size={17} />
              </button>
            </div>
            {week !== sunday() && (
              <button className="text-button" onClick={() => setWeek(sunday())}>
                Voltar à semana atual
              </button>
            )}
          </div>
          {view === 'members' && coordinator ? (
            <Members
              users={users}
              actorId={identity}
              api={api}
              refresh={async () => setUsers(await api<User[]>('users'))}
            />
          ) : (
            <>
              <div className="stats" onPointerMove={spotlight}>
                {(
                  [
                    [
                      visible.length,
                      'Atividades da semana',
                      LayoutDashboard,
                      'all',
                    ],
                    [
                      visible.filter((t) => t.status === 'progress').length,
                      'Em andamento',
                      Clock3,
                      'progress',
                    ],
                    [done, 'Concluídas', CheckCircle2, 'done'],
                    [blocked, 'Precisam de atenção', CircleAlert, 'blocked'],
                  ] as [number, string, typeof Users, string][]
                ).map(([n, label, I, tone]) => (
                  <div
                    className={`stat ${tone} ${n > 0 ? 'is-on' : ''}`}
                    key={label}
                  >
                    <span className="stat-icon">
                      <I size={18} />
                    </span>
                    <div>
                      <span>{label}</span>
                      <strong>
                        <Count value={n} />
                      </strong>
                    </div>
                  </div>
                ))}
              </div>
              {error && (
                <div role="alert" className="error">
                  {error}
                </div>
              )}
              {loading ? (
                <div className="loading" aria-busy="true" role="status">
                  <span className="sr-only">Carregando as atividades…</span>
                  <span>
                    <i />
                    <i />
                  </span>
                  <span>
                    <i />
                  </span>
                  <span>
                    <i />
                  </span>
                </div>
              ) : view === 'meeting' ? (
                <div className={`meeting ${settled ? 'is-settled' : ''}`}>
                  <section>
                    <div className="section-title">
                      <h2>Semana anterior</h2>
                      <span>{display(shift(week, -7))}</span>
                    </div>
                    <p className="muted">
                      {previous.filter((t) => t.status === 'done').length}{' '}
                      concluídas ·{' '}
                      {previous.filter((t) => t.status !== 'done').length}{' '}
                      pendentes
                    </p>
                    {previous.length ? (
                      previous.map((t, i) => card(t, i))
                    ) : (
                      <div className="empty">
                        <Inbox size={22} />
                        Sem atividades registradas nessa semana.
                      </div>
                    )}
                    {coordinator && (
                      <Continuity
                        tasks={previous}
                        targetWeek={week}
                        label="Continuar atividades nesta semana"
                        api={api}
                        refresh={refresh}
                      />
                    )}
                  </section>
                  <section>
                    <div className="section-title">
                      <h2>Compromissos desta semana</h2>
                      <span>{tasks.length} atividades</span>
                    </div>
                    {users.map((u) => (
                      <div className="member-group" key={u.id}>
                        <div className="member-title" style={colorFor(u.id)}>
                          <span className="avatar small">{u.name[0]}</span>
                          <strong>{u.name}</strong>
                          <span>
                            {tasks.filter((t) => t.assignee_id === u.id).length}
                          </span>
                        </div>
                        {tasks
                          .filter((t) => t.assignee_id === u.id)
                          .map((t, i) => card(t, i))}
                      </div>
                    ))}
                    {coordinator && (
                      <Continuity
                        tasks={tasks}
                        targetWeek={shift(week, 7)}
                        label="Preparar próxima semana"
                        api={api}
                        refresh={refresh}
                      />
                    )}
                  </section>
                </div>
              ) : (
                <>
                  <div className="board-toolbar">
                    <div>
                      <h2>Quadro de atividades</h2>
                      <span className="muted">
                        {visible.length} atividades · {done} concluídas
                      </span>
                    </div>
                    <div className="filters">
                      <label className="search">
                        <Search size={16} />
                        <input
                          placeholder="Buscar atividade…"
                          aria-label="Buscar atividade"
                          value={search}
                          onChange={(e) => setSearch(e.target.value)}
                        />
                      </label>
                      {view === 'team' && (
                        <label className="filter">
                          <SlidersHorizontal size={16} />
                          <select
                            aria-label="Filtrar por responsável"
                            value={person}
                            onChange={(e) => setPerson(e.target.value)}
                          >
                            <option value="">Toda a equipe</option>
                            {users.map((u) => (
                              <option key={u.id} value={u.id}>
                                {u.name}
                              </option>
                            ))}
                          </select>
                        </label>
                      )}
                    </div>
                  </div>
                  {view === 'team' && (
                    <div
                      className="member-legend"
                      aria-label="Cores dos responsáveis"
                    >
                      <span>Responsáveis</span>
                      {users.map((u) => (
                        <button
                          key={u.id}
                          style={colorFor(u.id)}
                          className={`member-chip ${person === u.id ? 'selected' : ''}`}
                          aria-pressed={person === u.id}
                          onClick={() => setPerson(person === u.id ? '' : u.id)}
                        >
                          <span className="member-dot" />
                          {u.name.split(' ·')[0]}
                        </button>
                      ))}
                    </div>
                  )}
                  <div className={`board ${settled ? 'is-settled' : ''}`}>
                    {(Object.keys(statuses) as Status[]).map((status) => {
                      const I = icons[status];
                      const group = visible.filter((t) => t.status === status);
                      return (
                        <section
                          className={`column ${status} ${draggedId ? 'drop-ready' : ''} ${dropTarget === status ? 'drop-target' : ''} ${pulse === status ? 'is-pulse' : ''}`}
                          key={status}
                          aria-label={`Coluna ${statuses[status]}`}
                          onDragOver={(e) => {
                            if (draggedId && !moveBusy) {
                              e.preventDefault();
                              e.dataTransfer.dropEffect = 'move';
                              setDropTarget(status);
                            }
                          }}
                          onDragLeave={(e) => {
                            if (
                              !e.currentTarget.contains(
                                e.relatedTarget as Node | null,
                              )
                            )
                              setDropTarget(null);
                          }}
                          onDrop={(e) => {
                            e.preventDefault();
                            const task = tasks.find(
                              (t) =>
                                t.id === draggedId &&
                                t.id === e.dataTransfer.getData('text/plain'),
                            );
                            if (task) void moveTask(task, status);
                            else stopDragging();
                          }}
                        >
                          <div className="column-title">
                            <I size={16} />
                            <h2>{statuses[status]}</h2>
                            <span>{group.length}</span>
                          </div>
                          {draggedId && (
                            <div className="drop-instruction">
                              {dropTarget === status
                                ? `${keyboardMove ? 'Enter' : 'Solte'} para ${status === 'blocked' ? 'informar o bloqueio' : 'mover para ' + statuses[status]}`
                                : keyboardMove
                                  ? 'Setas escolhem a coluna · Escape cancela'
                                  : 'Arraste a atividade para esta coluna'}
                            </div>
                          )}
                          <div className="column-body">
                            {group.map((t, i) => card(t, i))}
                            {!group.length && (
                              <div className="empty">
                                <I size={22} />
                                {status === 'done'
                                  ? 'As entregas concluídas aparecem aqui.'
                                  : status === 'blocked'
                                    ? 'Nada travado. Bom sinal.'
                                    : 'Nenhuma atividade por aqui.'}
                              </div>
                            )}
                            {actor && status === 'progress' && (
                              <button
                                className="add-card"
                                onClick={() => setEditing('new')}
                              >
                                <Plus size={15} />
                                Adicionar atividade
                              </button>
                            )}
                          </div>
                        </section>
                      );
                    })}
                  </div>
                </>
              )}
            </>
          )}
          <footer className="page-footer">
            <span>Forest Flow · Tecnologia da Informação</span>
            <span>Planejamento e acompanhamento semanal</span>
          </footer>
        </div>
      </main>
      {notice && (
        <div className="toast" role="status">
          <CheckCircle2 size={17} />
          {notice}
        </div>
      )}
      {importing && coordinator && (
        <ImportTasks
          key={week}
          week={week}
          users={users}
          api={api}
          close={() => setImporting(false)}
          created={async (count) => {
            await refresh();
            setImporting(false);
            setNotice(`${count} atividades importadas.`);
          }}
        />
      )}
      {editing && (
        <TaskPanel
          key={editing === 'new' ? 'new' : editing.id}
          task={editing}
          initialStatus={initialStatus}
          actor={actor}
          users={users}
          week={editing === 'new' ? sunday() : week}
          saving={saving}
          close={() => setEditing(null)}
          api={api}
          remove={async () => {
            if (editing === 'new') return;
            setSaving(true);
            try {
              await api(`tasks/${editing.id}`, { method: 'DELETE' });
              setTasks((current) => current.filter((t) => t.id !== editing.id));
              setPrevious((current) =>
                current.filter((t) => t.id !== editing.id),
              );
              setEditing(null);
              setNotice('Atividade excluída.');
            } finally {
              setSaving(false);
            }
          }}
          save={async (data, another) => {
            setSaving(true);
            try {
              await api(editing === 'new' ? 'tasks' : `tasks/${editing.id}`, {
                method: editing === 'new' ? 'POST' : 'PATCH',
                body: JSON.stringify(data),
              });
              if (editing === 'new' && week !== sunday()) setWeek(sunday());
              else await refresh();
              setNotice(
                editing === 'new'
                  ? 'Atividade criada e delegada.'
                  : 'Atividade atualizada.',
              );
              if (!another) setEditing(null);
              return true;
            } catch (e) {
              throw e;
            } finally {
              setSaving(false);
            }
          }}
        />
      )}
    </div>
  );
}
type Event = { id: string; message: string; name: string; created_at: string };
function TaskPanel({
  task,
  initialStatus,
  actor,
  users,
  week,
  saving,
  close,
  save,
  api,
  remove,
}: {
  task: Task | 'new';
  initialStatus?: Status;
  actor: User | undefined;
  users: User[];
  week: string;
  saving: boolean;
  close: () => void;
  save: (data: unknown, another: boolean) => Promise<boolean>;
  api: <T = unknown>(path: string, options?: RequestInit) => Promise<T>;
  remove: () => Promise<void>;
}) {
  const isNew = task === 'new';
  const [title, setTitle] = useState(isNew ? '' : task.title);
  const [assignee, setAssignee] = useState(
    isNew ? (actor?.role === 'member' ? actor.id : '') : task.assignee_id,
  );
  const [due, setDue] = useState(isNew ? '' : task.due_date || '');
  const [priority, setPriority] = useState(isNew ? 'normal' : task.priority);
  const [description, setDescription] = useState(isNew ? '' : task.description);
  const [restricted, setRestricted] = useState(
    isNew ? false : !!task.restricted,
  );
  const [status, setStatus] = useState<Status>(
    isNew ? 'progress' : initialStatus || task.status,
  );
  const [reason, setReason] = useState(isNew ? '' : task.block_reason);
  const [details, setDetails] = useState(!isNew);
  const [error, setError] = useState('');
  const [events, setEvents] = useState<Event[]>([]);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const submitting = useRef(false);
  const titleRef = useRef<HTMLInputElement>(null);
  const blockReasonRef = useRef<HTMLTextAreaElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const canEdit =
    actor?.role === 'coordinator' ||
    (isNew ? !!actor : task.assignee_id === actor?.id);
  const canEditDetails =
    isNew ||
    actor?.role === 'coordinator' ||
    (!isNew && task.created_by === actor?.id && task.assignee_id === actor?.id);
  const canManageDetails = isNew || actor?.role === 'coordinator';
  const canDelete =
    !isNew &&
    (actor?.role === 'coordinator' ||
      (task.created_by === actor?.id && task.assignee_id === actor?.id));
  useEffect(() => {
    if (isNew) titleRef.current?.focus();
    else if (initialStatus === 'blocked') {
      blockReasonRef.current?.focus({ preventScroll: true });
      blockReasonRef.current?.scrollIntoView({ block: 'center' });
    } else dialogRef.current?.focus();
    if (!isNew)
      api<Event[]>(`tasks/${task.id}/events`)
        .then(setEvents)
        .catch((e) => setError(e.message));
  }, []);
  async function submit(another: boolean) {
    if (saving || submitting.current || confirmDelete || !canEdit) return;
    submitting.current = true;
    setError('');
    try {
      await save(
        isNew
          ? {
              title,
              assignee_id: assignee,
              due_date: due,
              priority,
              description,
              restricted,
              week,
            }
          : {
              status,
              block_reason: reason,
              ...(canEditDetails
                ? {
                    details: {
                      title,
                      description,
                      assignee_id: assignee,
                      due_date: due,
                      priority,
                      restricted,
                    },
                  }
                : {}),
            },
        another,
      );
      if (another) {
        setTitle('');
        setDescription('');
        titleRef.current?.focus();
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      submitting.current = false;
    }
  }
  return (
    <div
      className="overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !saving) close();
      }}
    >
      <div
        className="panel"
        data-status={isNew ? 'new' : status}
        role="dialog"
        aria-modal="true"
        aria-labelledby="panel-title"
        tabIndex={-1}
        ref={dialogRef}
        onKeyDown={(e) => {
          if (e.key === 'Escape' && !saving) close();
          if (e.key === 'Tab') {
            const items = dialogRef.current?.querySelectorAll<HTMLElement>(
              'button:not(:disabled),input,select,textarea,summary',
            );
            if (items?.length) {
              const first = items[0],
                last = items[items.length - 1];
              if (e.shiftKey && document.activeElement === first) {
                e.preventDefault();
                last.focus();
              } else if (!e.shiftKey && document.activeElement === last) {
                e.preventDefault();
                first.focus();
              }
            }
          }
        }}
      >
        <div className="panel-header">
          <div>
            <h2 id="panel-title">{isNew ? 'Nova atividade' : task.title}</h2>
            <p>
              {isNew
                ? 'Entra na semana atual, na coluna Em andamento.'
                : `${statuses[task.status]} · semana de ${display(task.week)}`}
            </p>
          </div>
          <button
            className="icon-button"
            aria-label="Fechar"
            disabled={saving}
            onClick={close}
          >
            <X size={20} />
          </button>
        </div>
        <form
          onKeyDown={(e) => {
            const target = e.target as HTMLElement;
            if (
              e.key === 'Enter' &&
              !e.shiftKey &&
              !e.nativeEvent.isComposing &&
              (target.tagName === 'TEXTAREA' ||
                (target instanceof HTMLInputElement &&
                  ['text', 'date'].includes(target.type)))
            ) {
              e.preventDefault();
              if (!e.repeat && !saving && !confirmDelete)
                e.currentTarget.requestSubmit();
            }
          }}
          onSubmit={(e) => {
            e.preventDefault();
            void submit(false);
          }}
        >
          <div className="panel-fields">
            <label>
              Atividade <span>*</span>
              <input
                ref={titleRef}
                required
                maxLength={180}
                value={title}
                readOnly={!canEditDetails}
                placeholder="O que precisa ser feito?"
                onChange={(e) => setTitle(e.target.value)}
              />
            </label>
            <label>
              Responsável <span>*</span>
              <select
                required
                value={assignee}
                disabled={actor?.role !== 'coordinator'}
                onChange={(e) => setAssignee(e.target.value)}
              >
                <option value="">Selecione uma pessoa</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
              {isNew && actor?.role === 'member' && (
                <small className="self-task-hint">
                  A atividade será atribuída a você. A coordenação pode delegar
                  para outras pessoas.
                </small>
              )}
            </label>
            <div className="field-row">
              <label>
                Prazo
                <input
                  type="date"
                  value={due}
                  readOnly={!canManageDetails}
                  onChange={(e) => setDue(e.target.value)}
                />
              </label>
              <label>
                Prioridade
                <select
                  value={priority}
                  disabled={!canManageDetails}
                  onChange={(e) =>
                    setPriority(e.target.value as 'normal' | 'high')
                  }
                >
                  <option value="normal">Normal</option>
                  <option value="high">Alta</option>
                </select>
              </label>
            </div>
            <div className="week-hint">
              <CalendarDays size={17} />
              Planejamento da semana de {display(isNew ? week : task.week)}
            </div>
            {isNew && (
              <button
                className="text-button details-button"
                type="button"
                onClick={() => setDetails(!details)}
              >
                <Plus size={16} />
                {details ? 'Ocultar detalhes' : 'Adicionar detalhes'}
              </button>
            )}
            {details && (
              <>
                <label>
                  Descrição
                  <textarea
                    rows={4}
                    value={description}
                    readOnly={!canEditDetails}
                    maxLength={5000}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Contexto e orientações para a execução…"
                  />
                </label>
                <label className="checkbox">
                  <input
                    type="checkbox"
                    checked={restricted}
                    disabled={!canManageDetails}
                    onChange={(e) => setRestricted(e.target.checked)}
                  />
                  <span>
                    <strong>Atividade restrita</strong>
                    <small>
                      Visível apenas para coordenação e responsável.
                    </small>
                  </span>
                </label>
              </>
            )}
            {!isNew && (
              <>
                <label>
                  Status
                  <select
                    value={status}
                    disabled={!canEdit}
                    onChange={(e) => setStatus(e.target.value as Status)}
                  >
                    {Object.entries(statuses).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                  </select>
                </label>
                {status === 'blocked' && (
                  <label>
                    Motivo do bloqueio <span>*</span>
                    <textarea
                      ref={blockReasonRef}
                      required
                      maxLength={1000}
                      value={reason}
                      readOnly={!canEdit}
                      onChange={(e) => setReason(e.target.value)}
                    />
                  </label>
                )}
                {!canEdit && (
                  <p className="muted">
                    Você pode acompanhar esta atividade. A atualização é feita
                    pelo responsável ou coordenador.
                  </p>
                )}
                <Checklist taskId={task.id} canEdit={canEdit} api={api} />
                <div className="history">
                  <h3>Histórico</h3>
                  {events.length ? (
                    events.map((e) => (
                      <div key={e.id}>
                        <strong>{e.name}</strong>
                        <p>
                          {e.message.replace(
                            /Status: (progress|blocked|done)/,
                            (_, s: Status) => `Status: ${statuses[s]}`,
                          )}
                        </p>
                        <small>{e.created_at}</small>
                      </div>
                    ))
                  ) : (
                    <p className="muted">Sem alterações registradas.</p>
                  )}
                </div>
                <Comments taskId={task.id} api={api} />
              </>
            )}
            {error && (
              <div role="alert" className="error">
                {error}
              </div>
            )}
          </div>
          <div className="panel-actions">
            {canDelete && !confirmDelete && (
              <button
                className="delete-task"
                type="button"
                disabled={saving}
                onClick={() => {
                  setConfirmDelete(true);
                  setError('');
                }}
              >
                Excluir tarefa
              </button>
            )}
            {confirmDelete ? (
              <div
                className="delete-confirm"
                role="group"
                aria-label="Confirmar exclusão"
              >
                <strong>Excluir esta tarefa?</strong>
                <p>
                  Ela será removida do quadro. Seu histórico será preservado no
                  banco.
                </p>
                <div>
                  <button
                    type="button"
                    className="secondary"
                    disabled={saving}
                    onClick={() => setConfirmDelete(false)}
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    className="delete-task confirm"
                    disabled={saving}
                    data-busy={saving || undefined}
                    onClick={async () => {
                      if (submitting.current) return;
                      submitting.current = true;
                      try {
                        await remove();
                      } catch (e) {
                        setError((e as Error).message);
                      } finally {
                        submitting.current = false;
                      }
                    }}
                  >
                    {saving ? 'Excluindo…' : 'Confirmar exclusão'}
                  </button>
                </div>
              </div>
            ) : (
              <>
                {isNew && (
                  <button
                    disabled={saving}
                    type="button"
                    className="secondary"
                    onClick={(e) => {
                      if (e.currentTarget.form?.reportValidity()) {
                        e.preventDefault();
                        void submit(true);
                      }
                    }}
                  >
                    Criar e adicionar outra
                  </button>
                )}
                {canEdit && (
                  <button
                    disabled={saving}
                    data-busy={saving || undefined}
                    className="primary"
                    type="submit"
                  >
                    {saving
                      ? 'Salvando…'
                      : isNew
                        ? 'Criar atividade'
                        : 'Salvar alteração'}
                  </button>
                )}
              </>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AuthGate>
      {(user, logout, switchProfile) => (
        <App
          key={user.id}
          signedIn={user}
          logout={logout}
          switchProfile={switchProfile}
        />
      )}
    </AuthGate>
  </React.StrictMode>,
);
