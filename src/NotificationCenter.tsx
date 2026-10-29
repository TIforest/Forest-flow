import { useEffect, useRef, useState } from 'react';
import { Bell, X, CheckCheck } from 'lucide-react';
import { useAutoRefresh } from './useAutoRefresh';
type Notice = {
  id: string;
  kind: string;
  title: string;
  body: string;
  workspace_id: string | null;
  task_id: string | null;
  week: string | null;
  created_at: string;
  read_at: string | null;
};
type Feed = {
  notifications: Notice[];
  unread: number;
  publicKey: string | null;
};
async function request<T = Feed>(path: string, body?: unknown) {
  const r = await fetch(
    '/api/notifications' + path,
    body === undefined
      ? {}
      : {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        },
  );
  const data = (await r.json()) as T & { error?: string };
  if (!r.ok)
    throw new Error(data.error || 'Não foi possível carregar as notificações.');
  return data;
}
function bytes(value: string) {
  return Uint8Array.from(
    atob(value.replace(/-/g, '+').replace(/_/g, '/')),
    (c) => c.charCodeAt(0),
  );
}
export function NotificationCenter({
  userId,
  active,
}: {
  userId: string;
  active: boolean;
}) {
  const [feed, setFeed] = useState<Feed | null>(null),
    [open, setOpen] = useState(false),
    [busy, setBusy] = useState(false),
    [enabled, setEnabled] = useState(false),
    [error, setError] = useState('');
  const dialog = useRef<HTMLDialogElement>(null),
    handled = useRef(false);
  const feedVersion = useRef(0);
  const supported =
    typeof Notification !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    isSecureContext;
  const preference = 'forest-push-' + userId;
  async function load() {
    const version = ++feedVersion.current;
    const data = await request('');
    if (version === feedVersion.current) setFeed(data);
  }
  async function subscribe(publicKey: string) {
    const registration = await navigator.serviceWorker.register(
      '/notifications-sw.js',
      { scope: '/' },
    );
    await navigator.serviceWorker.ready;
    const subscription =
      (await registration.pushManager.getSubscription()) ||
      (await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: bytes(publicKey),
      }));
    await request('/subscribe', subscription.toJSON());
    setEnabled(true);
  }
  useEffect(() => {
    let alive = true;
    void request('')
      .then(async (data) => {
        if (!alive) return;
        setFeed(data);
        if (
          active &&
          supported &&
          Notification.permission === 'granted' &&
          localStorage.getItem(preference) === 'enabled' &&
          data.publicKey
        )
          await subscribe(data.publicKey);
      })
      .catch((e) => {
        if (alive) setError(e.message);
      });
    return () => {
      alive = false;
    };
  }, [userId, active]);
  useAutoRefresh(load);
  useEffect(() => {
    if (open) dialog.current?.showModal();
    else dialog.current?.close();
  }, [open]);
  async function visit(n: Notice) {
    setBusy(true);
    setError('');
    try {
      await request('/read', { id: n.id });
      ++feedVersion.current;
      setFeed((current) =>
        current
          ? {
              ...current,
              notifications: current.notifications.filter(
                (item) => item.id !== n.id,
              ),
              unread: Math.max(0, current.unread - (n.read_at ? 0 : 1)),
            }
          : current,
      );
      sessionStorage.removeItem('forest-notification-open');
      if (n.kind === 'test') {
        const query = new URLSearchParams(location.search);
        query.delete('notification');
        history.replaceState(
          null,
          '',
          location.pathname + (query.size ? '?' + query : ''),
        );
        setOpen(true);
        return;
      }
      const url = new URL('/', location.origin);
      if (n.task_id && n.workspace_id && n.week) {
        url.searchParams.set('workspace', n.workspace_id);
        url.searchParams.set('week', n.week);
        url.searchParams.set('task', n.task_id);
      } else if (n.kind === 'access_request')
        url.searchParams.set('administration', 'requests');
      location.assign(url.pathname + url.search);
    } catch (e) {
      setOpen(true);
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    const id =
      new URLSearchParams(location.search).get('notification') ||
      sessionStorage.getItem('forest-notification-open');
    if (!id || !feed || handled.current) return;
    handled.current = true;
    void request<Notice>('/item?id=' + encodeURIComponent(id))
      .then(visit)
      .catch((e) => {
        sessionStorage.removeItem('forest-notification-open');
        setOpen(true);
        setError(e.message);
        history.replaceState(null, '', location.pathname);
      });
  }, [feed]);
  async function toggle() {
    setBusy(true);
    setError('');
    try {
      if (!supported)
        throw new Error(
          'Este navegador não oferece Web Push. Você pode consultar os avisos nesta central.',
        );
      if (enabled) {
        const registration = await navigator.serviceWorker.getRegistration('/');
        const subscription = await registration?.pushManager.getSubscription();
        if (subscription) {
          await request('/unsubscribe', { endpoint: subscription.endpoint });
          await subscription.unsubscribe();
        }
        localStorage.setItem(preference, 'disabled');
        setEnabled(false);
      } else {
        if (!feed?.publicKey)
          throw new Error('O envio de avisos ainda não está configurado.');
        const permission = await Notification.requestPermission();
        if (permission !== 'granted')
          throw new Error(
            'Avisos não permitidos. Você pode liberá-los nas configurações deste site no navegador.',
          );
        await subscribe(feed.publicKey);
        localStorage.setItem(preference, 'enabled');
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="notification-center">
      <button
        className="notification-bell secondary"
        aria-label={`Notificações${feed?.unread ? ', ' + feed.unread + ' não lidas' : ''}`}
        onClick={() => {
          setOpen(true);
          void load().catch((e) => setError(e.message));
        }}
      >
        <Bell size={19} />
        {!!feed?.unread && (
          <span>{feed.unread > 99 ? '99+' : feed.unread}</span>
        )}
      </button>
      <dialog
        ref={dialog}
        className="notification-dialog"
        onCancel={() => setOpen(false)}
      >
        <header>
          <h2>Notificações</h2>
          <button
            className="icon-button"
            aria-label="Fechar notificações"
            onClick={() => setOpen(false)}
          >
            <X size={20} />
          </button>
        </header>
        <p className="muted">
          Atividades atribuídas, prazos, comentários, mudanças de status e
          atualizações do seu acesso.
        </p>
        {!supported && (
          <p className="muted">
            Os avisos do sistema não estão disponíveis neste navegador. A
            central continua funcionando.
          </p>
        )}
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <button
          className="text-button notification-read-all"
          disabled={!feed?.unread || busy}
          onClick={() => {
            setBusy(true);
            void request('/read', {})
              .then(load)
              .catch((e) => setError(e.message))
              .finally(() => setBusy(false));
          }}
        >
          <CheckCheck size={16} /> Marcar todas como lidas
        </button>
        <div className="notification-items">
          {feed?.notifications.length ? (
            feed.notifications.map((n) => (
              <button
                key={n.id}
                disabled={busy}
                className={
                  'notification-item' + (!n.read_at ? ' is-unread' : '')
                }
                onClick={() => void visit(n)}
              >
                <strong>{n.title}</strong>
                <span>{n.body}</span>
                <small>
                  {new Date(
                    n.created_at.replace(' ', 'T') + 'Z',
                  ).toLocaleString('pt-BR')}
                </small>
              </button>
            ))
          ) : (
            <p className="muted" role="status">
              Nenhuma notificação no momento.
            </p>
          )}
        </div>
        <footer className="notification-preferences">
          {active && (
            <button
              className={
                enabled ? 'text-button notification-disable' : 'secondary'
              }
              disabled={busy || !supported}
              onClick={() => void toggle()}
            >
              {busy
                ? 'Configurando…'
                : enabled
                  ? 'Desativar avisos neste navegador'
                  : 'Ativar avisos neste navegador'}
            </button>
          )}
        </footer>
      </dialog>
    </div>
  );
}
