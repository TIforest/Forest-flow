import { OnboardingForm, type AccessRequest } from './OnboardingForm';
import { useEffect, useState } from 'react';
import type { User } from './types';
import { Brand } from './Brand';
import { AdminPanel } from './AdminPanel';
export type Workspace = {
  id: string;
  name: string;
  role: 'member' | 'coordinator';
  active: number;
};
export type CorporateUser = User & {
  email: string;
  is_admin: number;
  onboarding_required: number;
  access_status: string;
};
type Session = {
  pendingRequests?: number;
  onboarding?: AccessRequest | null;
  authenticated?: boolean;
  user?: CorporateUser;
  workspaces?: Workspace[];
  error?: string;
};
// A sessão só é reaproveitada dentro da mesma aba: fechar a aba exige entrar
// de novo (pela Microsoft, sem senha quando a conta já está conectada).
const TAB_KEY = 'forest-flow-tab';
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
    /* sem armazenamento a sessão não é reaproveitada */
  }
}
export function AuthGate({
  children,
}: {
  children: (
    user: CorporateUser,
    logout: () => Promise<void>,
    workspace: Workspace,
  ) => React.ReactNode;
}) {
  const [session, setSession] = useState<Session>({}),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
    [selected, setSelected] = useState(''),
    [admin, setAdmin] = useState(false),
    // Voltando da Microsoft: a luminária já entra acesa enquanto carrega.
    [returning] = useState(
      () => new URLSearchParams(location.search).get('login') === 'success',
    );
  async function load() {
    const r = await fetch('/api/auth/me');
    const data = (await r.json()) as Session;
    if (r.ok) {
      setSession(data);
      setSelected((id) =>
        data.workspaces?.some((w) => w.id === id)
          ? id
          : data.workspaces?.[0]?.id || '',
      );
    } else if (r.status === 401) setSession({});
    else throw new Error(data.error || 'Falha ao carregar seu acesso.');
  }
  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    markTab(false);
    setSession({});
    setAdmin(false);
    setSelected('');
    setNotice('');
  }
  useEffect(() => {
    const query = new URLSearchParams(location.search);
    if (query.get('login') === 'failed') {
      const messages: Record<string, string> = {
        session:
          'A tentativa de login expirou ou perdeu o vínculo com este navegador. Clique em Entrar com a Microsoft e conclua o acesso na mesma aba.',
        authorization:
          'A Microsoft não autorizou a entrada. Pode ser necessário o consentimento do administrador do Entra ID para este aplicativo.',
        configuration:
          'A Microsoft recusou a configuração do aplicativo. O administrador precisa conferir o segredo do cliente e sua validade.',
        account:
          'A conta retornada pela Microsoft não atende à política de acesso corporativo da Forest Paper. A identidade será conferida pelo administrador.',
        server:
          'Não foi possível concluir a validação do login no servidor. A falha foi registrada para diagnóstico.',
      };
      const ref = query.get('ref') || '';
      setError(
        (messages[query.get('reason') || ''] ||
          'Não foi possível concluir o login Microsoft. Tente novamente.') +
          (/^[0-9a-f-]{36}$/.test(ref) ? ' Referência: ' + ref : ''),
      );
    }
    const fresh = query.get('login') === 'success';
    if (query.has('login')) {
      query.delete('login');
      query.delete('reason');
      query.delete('ref');
      history.replaceState(
        null,
        '',
        location.pathname + (query.size ? '?' + query : '') + location.hash,
      );
    }
    if (fresh) markTab(true);
    if (fresh || tabOpen())
      void load()
        .catch((e) => setError(e.message))
        .finally(() => setLoading(false));
    else setLoading(false);
    const expired = () => {
      markTab(false);
      setSession({});
      setNotice('Sua sessão foi encerrada. Entre novamente.');
    };
    addEventListener('forest-session-expired', expired);
    return () => removeEventListener('forest-session-expired', expired);
  }, []);
  useEffect(() => {
    if (!session.authenticated) return;
    let last = Date.now();
    const touch = () => {
      last = Date.now();
    };
    const events = ['pointerdown', 'keydown', 'wheel', 'touchstart'];
    events.forEach((e) => addEventListener(e, touch, { passive: true }));
    const timer = setInterval(() => {
      if (Date.now() - last >= 600000) {
        void logout();
        setNotice(
          'Você foi desconectado após 10 minutos sem atividade. Entre de novo para continuar.',
        );
      }
    }, 15000);
    // Refresh permissions even when a workspace is open: revoked access must leave the screen.
    const permissions = setInterval(
      () => void load().catch(() => undefined),
      60000,
    );
    return () => {
      clearInterval(timer);
      clearInterval(permissions);
      events.forEach((e) => removeEventListener(e, touch));
    };
  }, [session.authenticated]);
  const lamp = (
    <div className="lamp" aria-hidden="true">
      <i className="lamp-cord" />
      <i className="lamp-shade" />
      <i className="lamp-bulb" />
      <i className="lamp-glow" />
    </div>
  );
  if (loading)
    return (
      <div className={'auth-shell' + (returning ? ' is-lit' : '')}>
        {lamp}
        <p className="auth-status" role="status">
          Conectando ao Forest Flow…
        </p>
      </div>
    );
  const user = session.user,
    workspace = session.workspaces?.find((w) => w.id === selected);
  if (user && user.access_status === 'pending' && !user.is_admin)
    return (
      <OnboardingForm
        key={user.id}
        user={user}
        request={session.onboarding || null}
        onChange={load}
        logout={logout}
      />
    );
  if (user && user.access_status === 'active')
    return (
      <>
        <div className="corporate-bar">
          <span>
            <strong>{user.name}</strong> · {user.email}
          </span>
          <label>
            Setor{' '}
            <select
              aria-label="Espaço de trabalho"
              value={selected}
              onChange={(e) => {
                setSelected(e.target.value);
                setAdmin(false);
              }}
            >
              <option value="" disabled>
                Sem setor definido
              </option>
              {session.workspaces?.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
          </label>
          <span>
            {user.is_admin
              ? 'Administrador'
              : workspace?.role === 'coordinator'
                ? 'Coordenador'
                : 'Membro'}
          </span>
          {user.is_admin === 1 && (
            <button className="secondary" onClick={() => setAdmin(!admin)}>
              {admin ? 'Voltar ao quadro' : 'Administração'}
              {!admin &&
                !!session.pendingRequests &&
                ` (${session.pendingRequests})`}
            </button>
          )}
          <button className="secondary" onClick={() => void logout()}>
            Sair
          </button>
        </div>
        {admin && user.is_admin === 1 ? (
          <AdminPanel onChange={load} />
        ) : workspace ? (
          children({ ...user, role: workspace.role }, logout, workspace)
        ) : (
          <div className="auth-shell">
            <div className="auth-card">
              <h1>Sem setor definido</h1>
              <p>
                Seu acesso está liberado, mas você ainda não participa de um
                espaço de trabalho. Solicite a associação ao administrador.
              </p>
              {user.is_admin === 1 && (
                <button className="primary" onClick={() => setAdmin(true)}>
                  Gerenciar setores
                </button>
              )}
            </div>
          </div>
        )}
      </>
    );
  return (
    <div className={'auth-shell' + (user ? ' is-lit' : '')}>
      <div className="ambient" aria-hidden="true">
        <i />
        <i />
      </div>
      {lamp}
      <div className="auth-card">
        <div className="brand">
          <Brand />
        </div>
        <h1>{user ? 'Acesso aguardando liberação' : 'Entre no Forest Flow'}</h1>
        <p>
          {user
            ? user.access_status === 'blocked'
              ? 'Seu acesso foi removido ou bloqueado. Entre em contato com o administrador.'
              : `Olá, ${user.name}. Seu login Microsoft foi confirmado. O administrador precisa liberar seu acesso e associar você a um setor.`
            : 'Use sua conta corporativa da Forest Paper.'}
        </p>
        {notice && !user && (
          <div className="auth-notice" role="status">
            {notice}
          </div>
        )}
        {error && (
          <div className="error" role="alert">
            {error}
          </div>
        )}
        {user ? (
          <>
            <p>{user.email}</p>
            <button
              className="primary"
              onClick={() => void load().catch((e) => setError(e.message))}
            >
              Verificar liberação
            </button>
            <button className="auth-link" onClick={() => void logout()}>
              Sair
            </button>
          </>
        ) : (
          <a
            className="primary microsoft-login"
            href="/api/auth/microsoft/start"
            onClick={() => markTab(true)}
          >
            <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
              <path fill="#f25022" d="M0 0h9v9H0z" />
              <path fill="#7fba00" d="M11 0h9v9h-9z" />
              <path fill="#00a4ef" d="M0 11h9v9H0z" />
              <path fill="#ffb900" d="M11 11h9v9h-9z" />
            </svg>
            Entrar com a Microsoft
          </a>
        )}
      </div>
    </div>
  );
}
