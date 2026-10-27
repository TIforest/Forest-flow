import type { User } from '../src/types';
export interface AuthEnv {
  ALLOWED_EMAIL_DOMAIN?: string;
  DB: D1Database;
  LOCAL_DEMO?: string;
}
const fields = 'users.id, users.name, users.role, users.job, users.color';
// Limite absoluto da sessão e limite de inatividade (qualquer chamada renova).
const SESSION_MS = 8 * 3600000;
const IDLE_MS = 10 * 60000;
type SessionRow = {
  token_hash: string;
  profile_id: string | null;
  last_seen_at: number;
};
export const local = (request: Request) =>
  ['127.0.0.1', 'localhost'].includes(new URL(request.url).hostname);
const hex = (data: ArrayBuffer) =>
  [...new Uint8Array(data)]
    .map((n) => n.toString(16).padStart(2, '0'))
    .join('');
const token = () => hex(crypto.getRandomValues(new Uint8Array(32)).buffer);
const digest = async (s: string) =>
  hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)));
async function passwordHash(password: string, salt: string) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  return hex(
    await crypto.subtle.deriveBits(
      {
        name: 'PBKDF2',
        salt: new TextEncoder().encode(salt),
        iterations: 100000,
        hash: 'SHA-256',
      },
      key,
      256,
    ),
  );
}
function equal(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
const cookieValue = (request: Request) =>
  request.headers
    .get('Cookie')
    ?.match(/(?:^|;\s*)forest_session=([a-f0-9]{64})(?:;|$)/)?.[1];
const cookie = (request: Request, value: string, age: number) =>
  `forest_session=${value}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${age}${local(request) ? '' : '; Secure'}`;
const reply = (
  data: unknown,
  status = 200,
  headers: Record<string, string> = {},
) =>
  Response.json(data, {
    status,
    headers: { 'Cache-Control': 'no-store', ...headers },
  });
// Sessão viva: dentro do prazo absoluto e usada nos últimos IDLE_MS.
// Sessões paradas são removidas; o uso recente é registrado a cada 30 s.
async function liveSession(
  request: Request,
  env: AuthEnv,
): Promise<SessionRow | null> {
  const value = cookieValue(request);
  if (!value) return null;
  const hash = await digest(value);
  const now = Date.now();
  const row = await env.DB.prepare(
    'SELECT token_hash,profile_id,last_seen_at FROM team_sessions WHERE token_hash=? AND expires_at>?',
  )
    .bind(hash, now)
    .first<SessionRow>();
  if (!row) return null;
  if (row.last_seen_at < now - IDLE_MS) {
    await env.DB.prepare('DELETE FROM team_sessions WHERE token_hash=?')
      .bind(hash)
      .run();
    return null;
  }
  if (row.last_seen_at < now - 30000)
    await env.DB.prepare(
      'UPDATE team_sessions SET last_seen_at=? WHERE token_hash=?',
    )
      .bind(now, hash)
      .run();
  return row;
}
export async function getActor(
  request: Request,
  env: AuthEnv,
): Promise<User | null> {
  if (cookieValue(request)) {
    const session = await liveSession(request, env);
    if (!session?.profile_id) return null;
    return env.DB.prepare(`SELECT ${fields} FROM users WHERE id=?`)
      .bind(session.profile_id)
      .first<User>();
  }
  if (local(request) && env.LOCAL_DEMO === 'true')
    return env.DB.prepare(`SELECT ${fields} FROM users WHERE id=?`)
      .bind(request.headers.get('X-Demo-User') || '')
      .first<User>();
  return null;
}
async function sessionResponse(request: Request, env: AuthEnv) {
  const value = token();
  const now = Date.now();
  await env.DB.batch([
    env.DB.prepare(
      'DELETE FROM team_sessions WHERE expires_at<? OR last_seen_at<?',
    ).bind(now, now - IDLE_MS),
    env.DB.prepare(
      'INSERT INTO team_sessions(token_hash,expires_at,last_seen_at) VALUES (?,?,?)',
    ).bind(await digest(value), now + SESSION_MS, now),
  ]);
  return reply({ authenticated: true, user: null }, 200, {
    'Set-Cookie': cookie(request, value, SESSION_MS / 1000),
  });
}
const teamSession = liveSession;
const expired = (request: Request) =>
  cookieValue(request)
    ? reply(
        {
          error: 'Sua sessão foi encerrada por inatividade. Entre de novo.',
          reason: 'expired',
        },
        401,
      )
    : reply({ error: 'Entre para continuar.' }, 401);
export async function authRoute(
  request: Request,
  env: AuthEnv,
): Promise<Response | null> {
  const path = new URL(request.url).pathname;
  if (!path.startsWith('/api/auth/')) return null;
  if (path === '/api/auth/config' && request.method === 'GET')
    return reply({
      registrationEnabled: false,
      sharedLogin: true,
      sharedEmail: 'ti@forest.ind.br',
      confirmationRequired: false,
      allowedDomain: env.ALLOWED_EMAIL_DOMAIN || 'forest.ind.br',
    });
  if (path === '/api/auth/me' && request.method === 'GET') {
    const session = await teamSession(request, env);
    return session
      ? reply({ authenticated: true, user: await getActor(request, env) })
      : expired(request);
  }
  if (path === '/api/auth/profiles' && request.method === 'GET') {
    if (!(await teamSession(request, env))) return expired(request);
    const profiles = await env.DB.prepare(
      'SELECT ' + fields + ' FROM users ORDER BY name',
    ).all();
    return reply({ profiles: profiles.results });
  }
  if (path === '/api/auth/profile' && request.method === 'POST') {
    const session = await teamSession(request, env);
    if (!session) return expired(request);
    const body = (await request.json()) as { profileId?: unknown };
    const user =
      typeof body.profileId === 'string'
        ? await env.DB.prepare('SELECT ' + fields + ' FROM users WHERE id=?')
            .bind(body.profileId)
            .first<User>()
        : null;
    if (body.profileId !== null && !user)
      return reply({ error: 'Perfil inválido.' }, 400);
    const value = token();
    await env.DB.batch([
      env.DB.prepare('DELETE FROM team_sessions WHERE token_hash=?').bind(
        session.token_hash,
      ),
      env.DB.prepare(
        'INSERT INTO team_sessions(token_hash,profile_id,expires_at,last_seen_at) VALUES (?,?,?,?)',
      ).bind(
        await digest(value),
        user?.id || null,
        Date.now() + SESSION_MS,
        Date.now(),
      ),
    ]);
    return reply({ authenticated: true, user }, 200, {
      'Set-Cookie': cookie(request, value, SESSION_MS / 1000),
    });
  }
  if (path === '/api/auth/logout' && request.method === 'POST') {
    const value = cookieValue(request);
    if (value)
      await env.DB.prepare('DELETE FROM team_sessions WHERE token_hash=?')
        .bind(await digest(value))
        .run();
    return reply({ ok: true }, 200, { 'Set-Cookie': cookie(request, '', 0) });
  }
  if (request.method !== 'POST')
    return reply({ error: 'Rota não encontrada.' }, 404);
  // Atomic counters limit expensive password verification and token attempts.
  const ip = request.headers.get('CF-Connecting-IP') || 'local';
  const bucket = await digest(ip + ':' + Math.floor(Date.now() / 900000));
  await env.DB.prepare('DELETE FROM auth_limits WHERE expires_at < ?')
    .bind(Date.now())
    .run();
  const limit = await env.DB.prepare(
    'INSERT INTO auth_limits VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1 RETURNING count',
  )
    .bind(bucket, Date.now() + 900000)
    .first<{ count: number }>();
  if ((limit?.count || 0) > 30)
    return reply({ error: 'Muitas tentativas. Aguarde 15 minutos.' }, 429);
  const b = (await request.json()) as Record<string, unknown>;
  if (!b || typeof b !== 'object')
    return reply({ error: 'Dados inválidos.' }, 400);
  if (path !== '/api/auth/login')
    return reply(
      {
        error: 'O cadastro individual foi desativado. Use o acesso da equipe.',
      },
      410,
    );
  const email = typeof b.email === 'string' ? b.email.trim().toLowerCase() : '';
  const password = typeof b.password === 'string' ? b.password : '';
  if (
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
    email.length > 254 ||
    password.length < 8 ||
    password.length > 128
  )
    return reply(
      { error: 'Informe um e-mail válido e uma senha de 8 a 128 caracteres.' },
      400,
    );
  if (path === '/api/auth/login') {
    const account = await env.DB.prepare(
      'SELECT * FROM team_credentials WHERE email=?',
    )
      .bind(email)
      .first<{
        user_id: string;
        salt: string;
        password_hash: string;
        email_verified_at: string | null;
      }>();
    const hash = await passwordHash(
      password,
      account?.salt || 'invalid-account-dummy-salt',
    );
    if (
      email !== 'ti@forest.ind.br' ||
      !account ||
      !equal(hash, account.password_hash)
    )
      return reply({ error: 'E-mail ou senha incorretos.' }, 401);
    return sessionResponse(request, env);
  }
  return reply({ error: 'Rota não encontrada.' }, 404);
}
export async function inviteUser(
  request: Request,
  env: AuthEnv,
  actor: User,
  userId: string,
) {
  return reply(
    {
      error:
        'Os convites foram substituídos pelo cadastro direto com e-mail e senha.',
    },
    410,
  );
}
