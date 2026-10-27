import { useEffect, useState } from 'react';
import type { User } from './types';
import { Brand } from './Brand';
import { tilt, untilt, useAmbientPause } from './motion';
type Session = { authenticated?: boolean; user?: User | null; error?: string };
// A sessão só é reaproveitada dentro da mesma aba: fechar a aba exige novo login.
const TAB_KEY = 'forest-flow-tab';
const IDLE_MS = 10 * 60000;
const IDLE_NOTICE =
  'Você foi desconectado após 10 minutos sem atividade. Entre de novo para continuar.';
function tabOpen() {
  try {
    return sessionStorage.getItem(TAB_KEY) === '1';
  } catch {
    return false;
  }
}
function markTab(open: boolean) {
  try {
    if (open) sessionStorage.setItem(TAB_KEY, '1');
    else sessionStorage.removeItem(TAB_KEY);
  } catch {
    /* armazenamento indisponível: a sessão não será reaproveitada */
  }
}
export function AuthGate({
  children,
}: {
  children: (
    user: User,
    logout: () => Promise<void>,
    switchProfile: () => Promise<void>,
  ) => React.ReactNode;
}) {
  const [user, setUser] = useState<User | null>(null);
  const [authenticated, setAuthenticated] = useState(false);
  const [profiles, setProfiles] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  useAmbientPause();
  async function applySession(session: Session) {
    setAuthenticated(!!session.authenticated);
    setUser(session.user || null);
    if (session.authenticated && !session.user) {
      const response = await fetch('/api/auth/profiles');
      const data = (await response.json()) as {
        profiles: User[];
        error?: string;
      };
      if (!response.ok)
        throw new Error(data.error || 'Não foi possível carregar os perfis.');
      setProfiles(data.profiles);
    }
  }
  useEffect(() => {
    if (tabOpen())
      fetch('/api/auth/me')
        .then((r) => r.json() as Promise<Session>)
        .then((session) => {
          if (session.authenticated) return applySession(session);
          markTab(false);
          if ((session as { reason?: string }).reason === 'expired')
            setNotice(IDLE_NOTICE);
        })
        .catch(() => setError('Não foi possível conectar ao servidor.'))
        .finally(() => setLoading(false));
    else setLoading(false);
    const expired = () => {
      markTab(false);
      setUser(null);
      setAuthenticated(false);
      setNotice('Sua sessão foi encerrada. Entre de novo para continuar.');
    };
    addEventListener('forest-session-expired', expired);
    return () => removeEventListener('forest-session-expired', expired);
  }, []);
  // Sem atividade por 10 minutos, encerra a sessão e volta ao login com aviso.
  useEffect(() => {
    if (!authenticated) return;
    let last = Date.now();
    const touch = () => {
      last = Date.now();
    };
    const events = ['pointerdown', 'keydown', 'wheel', 'touchstart'];
    for (const name of events) addEventListener(name, touch, { passive: true });
    const check = () => {
      if (Date.now() - last < IDLE_MS) return;
      clearInterval(timer);
      void post('logout').catch(() => undefined);
      markTab(false);
      setUser(null);
      setAuthenticated(false);
      setError('');
      setNotice(IDLE_NOTICE);
    };
    const timer = setInterval(check, 15000);
    const onVisible = () => {
      if (!document.hidden) check();
    };
    addEventListener('visibilitychange', onVisible);
    return () => {
      for (const name of events) removeEventListener(name, touch);
      removeEventListener('visibilitychange', onVisible);
      clearInterval(timer);
    };
  }, [authenticated]);
  async function post(path: string, body: unknown = {}) {
    const response = await fetch('/api/auth/' + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = (await response.json()) as Session;
    if (!response.ok)
      throw new Error(data.error || 'Não foi possível concluir.');
    return data;
  }
  async function logout() {
    await post('logout');
    markTab(false);
    setUser(null);
    setAuthenticated(false);
    setError('');
    setNotice('');
  }
  async function switchProfile() {
    await applySession(await post('profile', { profileId: null }));
  }
  async function chooseProfile(profileId: string) {
    setBusy(true);
    setError('');
    try {
      await applySession(await post('profile', { profileId }));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await applySession(await post('login', { email, password }));
      markTab(true);
      setNotice('');
      setPassword('');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (loading)
    return (
      <div className="auth-shell">
        <p className="auth-status" role="status">
          Conectando ao Forest Flow…
        </p>
      </div>
    );
  if (user) return children(user, logout, switchProfile);
  return (
    <div className={'auth-shell' + (authenticated ? ' is-lit' : '')}>
      <div className="ambient" aria-hidden="true">
        <i />
        <i />
      </div>
      <div className="lamp" aria-hidden="true">
        <i className="lamp-cord" />
        <i className="lamp-shade" />
        <i className="lamp-bulb" />
        <i className="lamp-glow" />
      </div>
      <div className={'auth-card' + (authenticated ? ' profile-card' : '')}>
        <div className="brand">
          <Brand />
        </div>
        <h1>
          {authenticated ? 'Quem está usando?' : 'Acesso da equipe de TI'}
        </h1>
        <p>
          {authenticated
            ? 'Selecione seu perfil para acompanhar suas atividades.'
            : 'Entre com a senha compartilhada da equipe.'}
        </p>
        {notice && !authenticated && (
          <div className="auth-notice" role="status">
            {notice}
          </div>
        )}
        {error && (
          <div className="error" role="alert">
            {error}
          </div>
        )}
        {authenticated ? (
          <>
            <div className="profile-grid">
              {profiles.map((profile, index) => (
                <button
                  type="button"
                  className="profile-option"
                  key={profile.id}
                  disabled={busy}
                  style={{ '--i': index } as React.CSSProperties}
                  onPointerMove={tilt}
                  onPointerLeave={untilt}
                  onClick={() => void chooseProfile(profile.id)}
                >
                  <span
                    className="profile-avatar"
                    style={{ backgroundColor: profile.color }}
                  >
                    {profile.name.slice(0, 1)}
                  </span>
                  <strong>{profile.name}</strong>
                  <small>{profile.job}</small>
                  {profile.role === 'coordinator' && <small>Coordenação</small>}
                </button>
              ))}
            </div>
            {!profiles.length && (
              <p>
                Nenhum perfil cadastrado. Solicite a configuração da equipe.
              </p>
            )}
            <small className="auth-help">
              O histórico registra o perfil selecionado. Todos com o acesso da
              equipe podem escolher qualquer perfil.
            </small>
            <button
              className="auth-link"
              onClick={() => void logout().catch((e) => setError(e.message))}
            >
              Sair da conta da equipe
            </button>
          </>
        ) : (
          <form onSubmit={submit}>
            <label>
              E-mail da equipe
              <input
                type="email"
                required
                maxLength={254}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="username"
              />
            </label>
            <label>
              Senha
              <input
                type="password"
                required
                minLength={8}
                maxLength={128}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
            <button
              className="primary"
              disabled={busy}
              data-busy={busy || undefined}
            >
              {busy ? 'Entrando…' : 'Entrar'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
