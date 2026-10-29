import { useRef, useState } from 'react';
import { Plus, Pencil, Users, CheckCircle2 } from 'lucide-react';
import type { User } from './types';

// Sugestões que leem bem sobre o fundo petróleo e se distinguem entre si.
const colors = [
  '#4f9cf0',
  '#e07a5f',
  '#2fb59c',
  '#8f74d9',
  '#e85d8a',
  '#8fbf3f',
  '#e2a63a',
  '#5b8fa8',
];
type Draft = Pick<User, 'name' | 'job' | 'role' | 'color'> & {
  registration_email: string;
};
const empty: Draft = {
  name: '',
  job: '',
  role: 'member',
  color: colors[0],
  registration_email: '',
};
export function Members({
  users,
  actorId,
  api,
  refresh,
}: {
  users: User[];
  actorId: string;
  api: <T = unknown>(path: string, options?: RequestInit) => Promise<T>;
  refresh: () => Promise<void>;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(empty);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const formRef = useRef<HTMLFormElement>(null);
  function open(user?: User) {
    setSelected(user?.id || 'new');
    setDraft(
      user
        ? {
            name: user.name,
            job: user.job,
            role: user.role,
            color: user.color,
            registration_email: user.registration_email || '',
          }
        : { ...empty, color: colors[users.length % colors.length] },
    );
    setError('');
    setNotice('');
    setTimeout(() => {
      formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      formRef.current?.querySelector('input')?.focus({ preventScroll: true });
    }, 0);
  }
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await api(selected === 'new' ? 'users' : `users/${selected}`, {
        method: selected === 'new' ? 'POST' : 'PATCH',
        body: JSON.stringify(draft),
      });
      await refresh();
      setSelected(null);
      setNotice(
        selected === 'new'
          ? 'Integrante cadastrado. Já está disponível para receber atividades.'
          : 'Cadastro atualizado.',
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="members-area">
      <div className="members-heading">
        <div>
          <h2>Integrantes da TI</h2>
          <p>
            {users.length} integrantes ·{' '}
            {users.filter((u) => u.role === 'coordinator').length} na
            coordenação
          </p>
        </div>
        <button className="primary" disabled={busy} onClick={() => open()}>
          <Plus size={18} />
          Novo integrante
        </button>
      </div>
      <p className="members-explainer">
        Defina quem faz parte da equipe e quem pode delegar atividades. A cor
        identifica cada pessoa nos cartões do quadro.
      </p>
      {notice && (
        <div className="member-success" role="status">
          <CheckCircle2 size={18} />
          {notice}
        </div>
      )}
      {selected && (
        <form
          className="member-form"
          ref={formRef}
          onSubmit={submit}
          aria-label={
            selected === 'new' ? 'Cadastrar integrante' : 'Editar integrante'
          }
        >
          <h2>
            {selected === 'new' ? 'Cadastrar integrante' : 'Editar integrante'}
          </h2>
          <fieldset disabled={busy}>
            <div className="member-form-grid">
              <label>
                Nome completo <span>*</span>
                <input
                  required
                  maxLength={100}
                  value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                  placeholder="Nome do integrante"
                />
              </label>
              <label>
                Cargo <span>*</span>
                <input
                  required
                  maxLength={120}
                  value={draft.job}
                  onChange={(e) => setDraft({ ...draft, job: e.target.value })}
                  placeholder="Ex.: Analista de infraestrutura"
                />
              </label>
              <label>
                Perfil de acesso <span>*</span>
                <select
                  disabled={selected === actorId}
                  value={draft.role}
                  onChange={(e) =>
                    setDraft({ ...draft, role: e.target.value as User['role'] })
                  }
                >
                  <option value="member">Colaborador</option>
                  <option value="coordinator">Coordenador</option>
                </select>
                <small>
                  {selected === actorId
                    ? 'Você mantém seu perfil de coordenador.'
                    : draft.role === 'coordinator'
                      ? 'Gerencia integrantes e delega atividades.'
                      : 'Consulta a equipe e atualiza as próprias atividades.'}
                </small>
              </label>
              <div>
                <label htmlFor="member-color">
                  Cor de destaque <span>*</span>
                </label>
                <div className="color-picker">
                  <input
                    id="member-color"
                    type="color"
                    value={draft.color}
                    onChange={(e) =>
                      setDraft({ ...draft, color: e.target.value })
                    }
                  />
                  <span>{draft.color.toUpperCase()}</span>
                  <span
                    className="color-preview"
                    style={{ background: draft.color }}
                  >
                    {draft.name.slice(0, 1).toUpperCase() || 'TI'}
                  </span>
                </div>
                <div className="color-swatches" aria-label="Sugestões de cores">
                  {colors.map((color) => (
                    <button
                      key={color}
                      type="button"
                      style={{ background: color }}
                      aria-label={`Usar cor ${color}`}
                      aria-pressed={color === draft.color}
                      onClick={() => setDraft({ ...draft, color })}
                    />
                  ))}
                </div>
              </div>
            </div>
          </fieldset>
          {error && (
            <div className="error" role="alert">
              {error}
            </div>
          )}
          <div className="member-form-actions">
            <button
              className="secondary"
              type="button"
              disabled={busy}
              onClick={() => setSelected(null)}
            >
              Cancelar
            </button>
            <button
              className="primary"
              disabled={busy}
              data-busy={busy || undefined}
            >
              {busy
                ? 'Salvando…'
                : selected === 'new'
                  ? 'Cadastrar integrante'
                  : 'Salvar alterações'}
            </button>
          </div>
        </form>
      )}
      <div className="member-list">
        {users.map((user) => (
          <article className="member-record" key={user.id}>
            <span
              className="member-record-avatar"
              style={{ background: user.color }}
            >
              <AvatarPhoto
                user={user}
                fallback={user.name.slice(0, 1).toUpperCase()}
              />
            </span>
            <div className="member-record-info">
              <h3>
                {user.name}
                {user.id === actorId && <small>Você</small>}
              </h3>
              <p>{user.job}</p>
            </div>
            <span className={`role-badge ${user.role}`}>
              {user.role === 'coordinator' ? 'Coordenador' : 'Colaborador'}
            </span>

            <button
              className="secondary"
              disabled={busy}
              onClick={() => open(user)}
              aria-label={`Editar ${user.name}`}
            >
              <Pencil size={14} />
              <span>Editar</span>
            </button>
          </article>
        ))}
      </div>
      <div className="members-footnote">
        <Users size={18} />
        <p>
          O integrante se cadastra com e-mail e senha. Somente a coordenação
          gerencia perfis e permissões.
        </p>
      </div>
    </section>
  );
}
import { AvatarPhoto } from './AvatarPhoto';
