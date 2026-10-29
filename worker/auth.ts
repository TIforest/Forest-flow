import * as oauth from 'oauth4webapi';
import type { User } from '../src/types';
export interface AuthEnv {
  DB: D1Database;
  ENTRA_TENANT_ID?: string;
  ENTRA_CLIENT_ID?: string;
  ENTRA_CLIENT_SECRET?: string;
  ENTRA_REDIRECT_URI?: string;
  ALLOWED_EMAIL_DOMAIN?: string;
}
export type Account = User & {
  is_admin: number;
  onboarding_required: number;
  access_status: string;
  email: string;
};
export type Actor = Account & { workspace_id: string };
export const local = (r: Request) =>
  ['localhost', '127.0.0.1'].includes(new URL(r.url).hostname);
export const digest = async (s: string) =>
  Array.from(
    new Uint8Array(
      await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)),
    ),
    (n) => n.toString(16).padStart(2, '0'),
  ).join('');
const random = () => oauth.generateRandomState();
const SESSION_MS = 8 * 3600000,
  IDLE_MS = 10 * 60000;
// Bootstrap is pinned to the directory object, never a mutable email or the first person to sign in.
export const ADMIN_TENANT = '0275c0a9-897a-4be2-8fa3-ec49e3be273d';
export const ADMIN_OBJECT = '6d12cf3c-b505-4a3e-8257-b7ee7a01eee2';
const value = (r: Request, name: string) =>
  r.headers
    .get('Cookie')
    ?.split(';')
    .map((s) => s.trim())
    .find((s) => s.startsWith(name + '='))
    ?.slice(name.length + 1) || '';
const cookie = (r: Request, name: string, v: string, age: number) =>
  `${name}=${v}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${age}${local(r) ? '' : '; Secure'}`;
export const reply = (data: unknown, status = 200) =>
  Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
function redirect(r: Request, path: string, cookies: string[] = []) {
  const headers = new Headers({
    Location: path,
    'Cache-Control': 'no-store',
    'Referrer-Policy': 'no-referrer',
  });
  cookies.forEach((c) => headers.append('Set-Cookie', c));
  return new Response(null, { status: 302, headers });
}
export async function getAccount(
  r: Request,
  env: AuthEnv,
  touch = true,
): Promise<Account | null> {
  const raw = value(r, 'forest_corporate');
  if (!/^[\w-]{40,128}$/.test(raw)) return null;
  const hash = await digest(raw),
    now = Date.now();
  const row = await env.DB.prepare(
    `SELECT u.*,i.email,s.last_seen_at FROM corporate_sessions s JOIN users u ON u.id=s.user_id JOIN corporate_identities i ON i.user_id=u.id WHERE s.token_hash=? AND s.expires_at>?`,
  )
    .bind(hash, now)
    .first<Account & { last_seen_at: number }>();
  if (!row) return null;
  if (row.last_seen_at < now - IDLE_MS || row.access_status === 'merged') {
    await env.DB.prepare('DELETE FROM corporate_sessions WHERE token_hash=?')
      .bind(hash)
      .run();
    return null;
  }
  if (touch && row.last_seen_at < now - 30000)
    await env.DB.prepare(
      'UPDATE corporate_sessions SET last_seen_at=? WHERE token_hash=?',
    )
      .bind(now, hash)
      .run();
  return row;
}
export async function listWorkspaces(env: AuthEnv, user: Account) {
  return (
    await env.DB.prepare(
      user.is_admin
        ? `SELECT w.*, 'coordinator' AS role FROM workspaces w WHERE active=1 ORDER BY name`
        : `SELECT w.*,m.role FROM workspaces w JOIN workspace_memberships m ON m.workspace_id=w.id WHERE active=1 AND m.user_id=? ORDER BY name`,
    )
      .bind(...(user.is_admin ? [] : [user.id]))
      .all()
  ).results;
}
export async function getActor(
  r: Request,
  env: AuthEnv,
): Promise<Actor | null> {
  const user = await getAccount(r, env);
  if (
    !user ||
    user.access_status !== 'active' ||
    (!user.is_admin && user.onboarding_required)
  )
    return null;
  const id = r.headers.get('X-Workspace-Id');
  if (!id) return null;
  const w = await env.DB.prepare(
    `SELECT w.id,m.role FROM workspaces w LEFT JOIN workspace_memberships m ON m.workspace_id=w.id AND m.user_id=? WHERE w.id=? AND w.active=1`,
  )
    .bind(user.id, id)
    .first<{ id: string; role: 'member' | 'coordinator' | null }>();
  if (!w || (!user.is_admin && !w.role)) return null;
  return {
    ...user,
    role: user.is_admin ? 'coordinator' : w.role!,
    workspace_id: w.id,
  };
}
export async function authRoute(
  r: Request,
  env: AuthEnv,
): Promise<Response | null> {
  const url = new URL(r.url),
    path = url.pathname;
  if (!path.startsWith('/api/auth/')) return null;
  if (path === '/api/auth/config' && r.method === 'GET')
    return reply({
      provider: 'microsoft',
      registrationEnabled: false,
      sharedLogin: false,
    });
  if (path === '/api/auth/me' && r.method === 'GET') {
    const user = await getAccount(r, env, false);
    if (!user)
      return reply({ error: 'Entre com a Microsoft para continuar.' }, 401);
    return reply({
      authenticated: true,
      user,
      pendingRequests: user.is_admin
        ? (
            await env.DB.prepare(
              "SELECT count(*) n FROM access_requests a JOIN users u ON u.id=a.user_id WHERE a.status='submitted' AND u.access_status='pending'",
            ).first<{ n: number }>()
          )?.n || 0
        : 0,
      onboarding:
        user.access_status === 'pending'
          ? await env.DB.prepare(
              'SELECT name,job,department,unit,notes,status,submitted_at,review_note FROM access_requests WHERE user_id=?',
            )
              .bind(user.id)
              .first()
          : null,
      workspaces:
        user.access_status === 'active' ? await listWorkspaces(env, user) : [],
    });
  }
  if (path === '/api/auth/logout' && r.method === 'POST') {
    await env.DB.prepare('DELETE FROM corporate_sessions WHERE token_hash=?')
      .bind(await digest(value(r, 'forest_corporate')))
      .run();
    const response = reply({ ok: true });
    response.headers.append('Set-Cookie', cookie(r, 'forest_corporate', '', 0));
    return response;
  }
  if (
    !['/api/auth/microsoft/start', '/api/auth/microsoft/callback'].includes(
      path,
    ) ||
    r.method !== 'GET'
  )
    return reply(
      {
        error:
          'Use o login Microsoft. O login compartilhado e a seleção de perfis foram desativados.',
      },
      410,
    );
  if (
    !env.ENTRA_TENANT_ID ||
    !env.ENTRA_CLIENT_ID ||
    !env.ENTRA_CLIENT_SECRET ||
    !env.ENTRA_REDIRECT_URI
  )
    return reply(
      { error: 'O login Microsoft ainda não foi configurado no servidor.' },
      503,
    );
  const callback = new URL(env.ENTRA_REDIRECT_URI);
  if (callback.origin !== url.origin)
    return reply(
      {
        error: `Abra o aplicativo em ${callback.origin} para entrar com a Microsoft.`,
      },
      400,
    );
  const issuer = `https://login.microsoftonline.com/${env.ENTRA_TENANT_ID}/v2.0`;
  const as: oauth.AuthorizationServer = {
    issuer,
    authorization_endpoint: `https://login.microsoftonline.com/${env.ENTRA_TENANT_ID}/oauth2/v2.0/authorize`,
    token_endpoint: `https://login.microsoftonline.com/${env.ENTRA_TENANT_ID}/oauth2/v2.0/token`,
    jwks_uri: `https://login.microsoftonline.com/${env.ENTRA_TENANT_ID}/discovery/v2.0/keys`,
  };
  const client: oauth.Client = {
    client_id: env.ENTRA_CLIENT_ID,
    id_token_signed_response_alg: 'RS256',
  };
  if (path.endsWith('/start')) {
    const state = random(),
      browser = random(),
      nonce = oauth.generateRandomNonce(),
      verifier = oauth.generateRandomCodeVerifier();
    const bucket = await digest(
      (r.headers.get('CF-Connecting-IP') || 'local') +
        ':oidc:' +
        Math.floor(Date.now() / 600000),
    );
    const limited = await env.DB.prepare(
      'INSERT INTO auth_limits VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1 RETURNING count',
    )
      .bind(bucket, Date.now() + 600000)
      .first<{ count: number }>();
    if ((limited?.count || 0) > 40)
      return reply(
        { error: 'Muitas tentativas. Aguarde alguns minutos.' },
        429,
      );
    await env.DB.batch([
      env.DB.prepare('DELETE FROM oauth_transactions WHERE expires_at<?').bind(
        Date.now(),
      ),
      env.DB.prepare('DELETE FROM auth_limits WHERE expires_at<?').bind(
        Date.now(),
      ),
      env.DB.prepare('INSERT INTO oauth_transactions VALUES(?,?,?,?,?)').bind(
        await digest(state),
        await digest(browser),
        nonce,
        verifier,
        Date.now() + 600000,
      ),
    ]);
    const destination = new URL(as.authorization_endpoint!);
    destination.search = new URLSearchParams({
      client_id: client.client_id,
      redirect_uri: env.ENTRA_REDIRECT_URI,
      response_type: 'code',
      response_mode: 'query',
      scope: 'openid profile email User.Read',
      state,
      nonce,
      code_challenge: await oauth.calculatePKCECodeChallenge(verifier),
      code_challenge_method: 'S256',
      prompt: 'select_account',
    }).toString();
    return redirect(r, destination.href, [
      cookie(r, 'forest_oauth', browser, 600),
    ]);
  }
  let stage = 'correlation';
  let correlated = false;
  try {
    const state = url.searchParams.get('state') || '',
      browser = value(r, 'forest_oauth');
    if (!/^[\w-]{40,128}$/.test(state) || !/^[\w-]{40,128}$/.test(browser))
      throw new Error('correlation');
    // DELETE RETURNING consumes the browser-bound transaction atomically, including error responses.
    const txn = await env.DB.prepare(
      'DELETE FROM oauth_transactions WHERE state_hash=? AND browser_hash=? AND expires_at>? RETURNING nonce,verifier',
    )
      .bind(await digest(state), await digest(browser), Date.now())
      .first<{ nonce: string; verifier: string }>();
    if (!txn) throw new Error('correlation');
    correlated = true;
    stage = 'authorization';
    const params = oauth.validateAuthResponse(as, client, url, state);
    stage = 'token_exchange';
    const response = await oauth.authorizationCodeGrantRequest(
      as,
      client,
      oauth.ClientSecretPost(env.ENTRA_CLIENT_SECRET),
      params,
      env.ENTRA_REDIRECT_URI,
      txn.verifier,
    );
    stage = 'token_validation';
    const tokens = await oauth.processAuthorizationCodeResponse(
      as,
      client,
      response,
      { expectedNonce: txn.nonce, requireIdToken: true },
    );
    stage = 'signature';
    await oauth.validateApplicationLevelSignature(as, response);
    stage = 'tenant';
    const claims = oauth.getValidatedIdTokenClaims(tokens)!;
    if (
      claims.tid !== env.ENTRA_TENANT_ID ||
      typeof claims.oid !== 'string' ||
      !/^[0-9a-f-]{36}$/i.test(claims.oid)
    )
      throw new Error('organization');
    // Only directory members whose identity provider belongs to this tenant may enter.
    stage = 'identity_provider';
    const allowedIdp = [
      issuer,
      `https://sts.windows.net/${env.ENTRA_TENANT_ID}/`,
    ];
    if (claims.idp !== undefined && !allowedIdp.includes(String(claims.idp)))
      throw new Error('organization');
    stage = 'directory';
    const profileResponse = await fetch(
      'https://graph.microsoft.com/v1.0/me?$select=id,displayName,mail,userPrincipalName,userType,jobTitle',
      {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
        signal: AbortSignal.timeout(15000),
      },
    );
    if (!profileResponse.ok)
      throw new Error('directory_' + profileResponse.status);
    const profile = (await profileResponse.json()) as {
      id: string;
      displayName: string;
      mail: string | null;
      userPrincipalName: string;
      userType: string;
      jobTitle: string | null;
    };
    stage = 'directory_policy';
    const email = (
      profile.mail ||
      profile.userPrincipalName ||
      ''
    ).toLowerCase();
    if (
      profile.id !== claims.oid ||
      profile.userType !== 'Member' ||
      profile.userPrincipalName.toLowerCase().includes('#ext#') ||
      !email.endsWith('@' + (env.ALLOWED_EMAIL_DOMAIN || 'forest.ind.br'))
    )
      throw new Error('organization');
    stage = 'identity';
    let identity = await env.DB.prepare(
      'SELECT user_id FROM corporate_identities WHERE tenant_id=? AND object_id=?',
    )
      .bind(env.ENTRA_TENANT_ID, claims.oid)
      .first<{ user_id: string }>();
    const bootstrap =
      env.ENTRA_TENANT_ID === ADMIN_TENANT && claims.oid === ADMIN_OBJECT;
    if (!identity) {
      const id = crypto.randomUUID();
      try {
        await env.DB.batch([
          env.DB.prepare(
            `INSERT INTO users(id,name,role,job,color,access_status,is_admin) VALUES(?,?,'member',?,'#c1b4ee',?,?)`,
          ).bind(
            id,
            profile.displayName || email,
            profile.jobTitle || 'Colaborador',
            bootstrap ? 'active' : 'pending',
            bootstrap ? 1 : 0,
          ),
          env.DB.prepare(
            'INSERT INTO corporate_identities VALUES(?,?,?,?,?)',
          ).bind(
            env.ENTRA_TENANT_ID,
            claims.oid,
            id,
            email,
            profile.displayName || email,
          ),
        ]);
      } catch {
        identity = await env.DB.prepare(
          'SELECT user_id FROM corporate_identities WHERE tenant_id=? AND object_id=?',
        )
          .bind(env.ENTRA_TENANT_ID, claims.oid)
          .first<{ user_id: string }>();
        if (!identity) throw new Error('identity');
      }
      identity ||= { user_id: id };
    }
    await env.DB.prepare(
      'UPDATE corporate_identities SET email=?,display_name=? WHERE user_id=?',
    )
      .bind(email, profile.displayName || email, identity.user_id)
      .run();
    stage = 'session';
    const raw = random(),
      now = Date.now();
    await env.DB.batch([
      env.DB.prepare(
        'DELETE FROM corporate_sessions WHERE expires_at<? OR last_seen_at<?',
      ).bind(now, now - IDLE_MS),
      env.DB.prepare('INSERT INTO corporate_sessions VALUES(?,?,?,?)').bind(
        await digest(raw),
        identity.user_id,
        now + SESSION_MS,
        now,
      ),
    ]);
    return redirect(r, '/?login=success', [
      cookie(r, 'forest_oauth', '', 0),
      cookie(r, 'forest_corporate', raw, SESSION_MS / 1000),
      cookie(r, 'forest_session', '', 0),
    ]);
  } catch (error) {
    // Persist only allowlisted protocol metadata. Never serialize the error/cause or URL.
    const ref = crypto.randomUUID();
    const protocol = error as {
      code?: unknown;
      error?: unknown;
      error_description?: unknown;
    };
    const safe = (v: unknown) =>
      typeof v === 'string' && /^[a-zA-Z0-9_]{1,80}$/.test(v) ? v : '';
    const errorCode =
      safe(protocol.code) ||
      (error instanceof Error &&
      [
        'correlation',
        'organization',
        'identity',
        'directory_400',
        'directory_401',
        'directory_403',
        'directory_429',
      ].includes(error.message)
        ? error.message
        : 'unexpected');
    const aadsts =
      typeof protocol.error_description === 'string'
        ? protocol.error_description.match(/AADSTS[0-9]{3,12}/)?.[0]
        : undefined;
    const provider = aadsts || safe(protocol.error) || null;
    console.warn('Microsoft sign-in rejected', {
      ref,
      stage,
      errorCode,
      provider,
    });
    if (correlated) {
      try {
        await env.DB.batch([
          env.DB.prepare(
            'INSERT INTO auth_login_failures(id,stage,error_code,provider_code) VALUES(?,?,?,?)',
          ).bind(ref, stage, errorCode, provider),
          env.DB.prepare(
            "DELETE FROM auth_login_failures WHERE created_at < datetime('now','-7 days') OR id NOT IN(SELECT id FROM auth_login_failures ORDER BY rowid DESC LIMIT 500)",
          ),
        ]);
      } catch {
        console.warn('Login diagnostic could not be saved', { ref });
      }
    }
    const reason =
      stage === 'correlation'
        ? 'session'
        : stage === 'authorization'
          ? 'authorization'
          : provider === 'AADSTS7000215' || provider === 'AADSTS7000222'
            ? 'configuration'
            : ['tenant', 'identity_provider', 'directory_policy'].includes(
                  stage,
                )
              ? 'account'
              : 'server';
    return redirect(r, '/?login=failed&reason=' + reason + '&ref=' + ref, [
      cookie(r, 'forest_oauth', '', 0),
    ]);
  }
}
export async function inviteUser() {
  return reply(
    {
      error:
        'O acesso agora é liberado pelo administrador após o login Microsoft.',
    },
    410,
  );
}
