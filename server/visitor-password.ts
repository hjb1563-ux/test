import 'server-only';
import { randomBytes, createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { AdminFailure, adminReply, createAdminGate, createVisitorAdmin } from './visitor-admin';
import { PROJECT_URL } from './visitor-rpc';

type Env = Record<string, string | undefined>;
const passwordGate = createAdminGate(5), recoveryGate = createAdminGate(3);

async function jsonBody(req: Request) {
  if (req.headers.get('content-type')?.split(';')[0] !== 'application/json' || !req.body) throw new AdminFailure(400);
  const reader = req.body.getReader(), chunks: Uint8Array[] = [];
  let length = 0, expired = false;
  const timer = setTimeout(() => { expired = true; void reader.cancel().catch(() => {}); }, 3000);
  try {
    for (;;) { const { done, value } = await reader.read(); if (done) break; length += value.byteLength; if (length > 4096) throw new AdminFailure(400); chunks.push(value); }
    if (expired) throw new AdminFailure(400);
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch { throw new AdminFailure(400); }
  finally { clearTimeout(timer); void reader.cancel().catch(() => {}); }
}

export function createVisitorPasswordHandlers(options: { env: Env; request?: typeof fetch; passwordGate?: () => boolean; recoveryGate?: () => boolean }) {
  const { env } = options, request = options.request ?? fetch;
  const admin = createVisitorAdmin({ env, request });
  async function call(path: string, init: RequestInit, privileged = false) {
    try {
      return await request(PROJECT_URL + '/auth/v1/' + path, { ...init, redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(5000),
        headers: { apikey: privileged ? env.SUPABASE_SECRET_KEY! : env.SUPABASE_PUBLISHABLE_KEY!, ...init.headers } });
    } catch { throw new AdminFailure(503); }
  }
  async function protect(work: () => Promise<Response>) {
    try { return await work(); } catch (e) { return adminReply(e instanceof AdminFailure ? e.status : 503, { available: false }); }
  }
  const cookieName = 'bath-admin-recovery';
  const sign = (value: string) => createHmac('sha256', env.SUPABASE_SECRET_KEY ?? '').update('bath-recovery:' + value).digest('base64url');
  const cookie = (value: string, age: number) => cookieName + '=' + value + '; Path=/api/admin/password; HttpOnly; SameSite=Lax; Max-Age=' + age + (env.VISITOR_ADMIN_ORIGIN?.startsWith('https://') ? '; Secure' : '');
  function verifierFor(req: Request) {
    if (!env.SUPABASE_SECRET_KEY) throw new AdminFailure(503);
    const matches = (req.headers.get('cookie') ?? '').split(';').map(x => x.trim()).filter(x => x.startsWith(cookieName + '='));
    if (matches.length !== 1) throw new AdminFailure(401);
    const parts = matches[0].slice(cookieName.length + 1).split('.');
    const [verifier, issued, signature] = parts, value = verifier + '.' + issued;
    if (parts.length !== 3 || !/^[A-Za-z0-9_-]{43}$/.test(verifier) || !/^\d{13}$/.test(issued) || !/^[A-Za-z0-9_-]{43}$/.test(signature)) throw new AdminFailure(401);
    if (!timingSafeEqual(Buffer.from(signature), Buffer.from(sign(value))) || Date.now() - Number(issued) > 900000 || Number(issued) > Date.now()) throw new AdminFailure(401);
    return verifier;
  }
  return {
    setup: (req: Request) => protect(async () => {
      admin.assertOrigin(req, true);
      if (!(options.passwordGate ?? passwordGate)()) throw new AdminFailure(429);
      const body = await jsonBody(req);
      // A PKCE code needs a signed, short-lived verifier from OUR recovery request.
      const pkce = typeof body?.code === 'string';
      if (!body || Object.keys(body).some(k => !(pkce ? ['code','password','confirmation'] : ['tokenHash','type','password','confirmation']).includes(k)) ||
        (pkce ? !/^[A-Za-z0-9_-]{16,512}$/.test(body.code) : (!['invite','recovery'].includes(body.type) || typeof body.tokenHash !== 'string' || !/^[a-f0-9]{56,128}$/i.test(body.tokenHash))) ||
        typeof body.password !== 'string' || body.password.length < 12 || body.password.length > 1024 || body.password !== body.confirmation) throw new AdminFailure(400);
      const verified = pkce
        ? await call('token?grant_type=pkce', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ auth_code: body.code, code_verifier: verifierFor(req) }) })
        : await call('verify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token_hash: body.tokenHash, type: body.type }) });
      if (!verified.ok) throw new AdminFailure(verified.status === 429 ? 429 : verified.status >= 500 ? 503 : 401);
      const session = await verified.json();
      let token = session.access_token;
      if (typeof token !== 'string' || token.length > 8192 || !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token)) throw new AdminFailure(503);
      try {
        const user = await admin.verifyIdentity(token);
        if (session.user?.id !== user.id) throw new AdminFailure(403);
        const updated = await call('user', { method: 'PUT', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ password: body.password }) });
        if (!updated.ok) throw new AdminFailure(updated.status === 429 ? 429 : updated.status >= 500 ? 503 : 400);
        const result = await updated.json();
        if (result.id !== user.id) throw new AdminFailure(503);
        // Never return/persist Auth tokens, set an admin cookie, or grant access here.
        const response = adminReply(200, { available: true });
        if (pkce) response.headers.set('Set-Cookie', cookie('', 0));
        return response;
      } finally { token = ''; }
    }),
    recover: (req: Request) => protect(async () => {
      admin.assertOrigin(req, true);
      if (!(options.recoveryGate ?? recoveryGate)()) throw new AdminFailure(429);
      const body = await jsonBody(req);
      if (!body || Object.keys(body).some(k => k !== 'email') || typeof body.email !== 'string' || body.email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)) throw new AdminFailure(400);
      if (!/^sb_secret_[A-Za-z0-9_-]+$/.test(env.SUPABASE_SECRET_KEY ?? '')) throw new AdminFailure(503);
      let target: string | undefined;
      // Only existing allowlisted IDs: no user search, signup, invite or permission grant.
      for (const id of (env.VISITOR_ADMIN_USER_IDS ?? '').split(',').map(id => id.trim())) {
        const response = await call('admin/users/' + id, { method: 'GET' }, true);
        if (!response.ok) throw new AdminFailure(503);
        const user = await response.json();
        if (user.id === id && user.is_anonymous === false && user.email_confirmed_at && typeof user.email === 'string' &&
          user.email.toLowerCase() === body.email.trim().toLowerCase()) target = user.email;
      }
      const verifier = randomBytes(32).toString('base64url');
      const challenge = createHash('sha256').update(verifier).digest('base64url');
      if (target) {
        const redirect = env.VISITOR_ADMIN_ORIGIN + '/admin/setup-password';
        try {
          await call('recover?redirect_to=' + encodeURIComponent(redirect), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: target, code_challenge: challenge, code_challenge_method: 's256' }) });
        } catch { /* Generic response must not reveal email membership via provider errors. */ }
      }
      // Same response for unmatched email: do not expose account membership.
      const response = adminReply(200, { available: true });
      const value = verifier + '.' + Date.now();
      response.headers.set('Set-Cookie', cookie(value + '.' + sign(value), 900));
      return response;
    }),
  };
}
