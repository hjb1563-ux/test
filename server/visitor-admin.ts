import 'server-only';
import { PROJECT_URL } from './visitor-rpc';
import { seoulDate } from './visitor-core';

type Env = Record<string, string | undefined>;
export type VisitorStatistics = { date: string; total: number; today: number; last7: number; last30: number; refreshedAt: string };
export class AdminFailure extends Error {
  constructor(public status: number) { super('admin-request-unavailable'); }
}
export const adminCookieName = (env: Env) => env.NODE_ENV === 'development' ? 'bath-admin-local' : '__Host-bath-admin';
export function adminConfigured(env: Env) {
  try {
    const origin = new URL(env.VISITOR_ADMIN_ORIGIN ?? '');
    const local = env.NODE_ENV === 'development' && ['localhost', '127.0.0.1', '[::1]'].includes(origin.hostname);
    const ids = (env.VISITOR_ADMIN_USER_IDS ?? '').split(',').map(id => id.trim());
    return env.VISITOR_ADMIN_ENABLED === 'true' && origin.origin === env.VISITOR_ADMIN_ORIGIN &&
      (origin.protocol === 'https:' || local && origin.protocol === 'http:') && env.SUPABASE_URL === PROJECT_URL &&
      /^sb_publishable_[A-Za-z0-9_-]+$/.test(env.SUPABASE_PUBLISHABLE_KEY ?? '') &&
      ids.length > 0 && ids.every(id => /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(id));
  } catch { return false; }
}
export const adminReply = (status: number, data: unknown) => Response.json(data, { status, headers: {
  'Cache-Control': 'private, no-store, max-age=0', Vary: 'Cookie', 'X-Content-Type-Options': 'nosniff',
} });

// Bounded per-instance load shedding. Supabase Auth limits still apply; no IP/email stored here.
export function createAdminGate(limit: number, clock = () => Date.now()) {
  let start = clock(), count = 0;
  return () => { const now = clock(); if (now - start >= 60000) { start = now; count = 0; } return ++count <= limit; };
}
const loginGate = createAdminGate(10), readGate = createAdminGate(120);

function sessionToken(cookie: string | null, env: Env) {
  const prefix = adminCookieName(env) + '=';
  const tokens = cookie?.split(';').map(item => item.trim()).filter(item => item.startsWith(prefix));
  const token = tokens?.length === 1 ? tokens[0].slice(prefix.length) : '';
  return /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token) && token.length <= 8192 ? token : null;
}
function setSession(response: Response, token: string, age: number, env: Env) {
  response.headers.set('Set-Cookie', `${adminCookieName(env)}=${token}; Path=/; Max-Age=${age}; HttpOnly; SameSite=Strict${env.NODE_ENV === 'development' && env.VISITOR_ADMIN_ORIGIN?.startsWith('http:') ? '' : '; Secure'}`);
  return response;
}
export function createVisitorAdmin(options: { env: Env; request?: typeof fetch; now?: () => Date; loginGate?: () => boolean; readGate?: () => boolean }) {
  const { env } = options, request = options.request ?? fetch, now = options.now ?? (() => new Date());
  function originAllowed(req: Request, write = false) {
    if (!adminConfigured(env)) throw new AdminFailure(503);
    if (new URL(req.url).origin !== env.VISITOR_ADMIN_ORIGIN || req.headers.get('sec-fetch-site') === 'cross-site' ||
      req.headers.has('origin') && req.headers.get('origin') !== env.VISITOR_ADMIN_ORIGIN ||
      write && (req.headers.get('origin') !== env.VISITOR_ADMIN_ORIGIN || req.headers.get('x-bath-admin') !== '1')) throw new AdminFailure(403);
  }
  async function auth(path: string, init: RequestInit) {
    try {
      return await request(PROJECT_URL + '/auth/v1/' + path, { ...init, cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(5000),
        headers: { apikey: env.SUPABASE_PUBLISHABLE_KEY!, ...init.headers } });
    } catch { throw new AdminFailure(503); }
  }
  async function verify(token: string) {
    const response = await auth('user', { method: 'GET', headers: { Authorization: `Bearer ${token}` } });
    if (!response.ok) throw new AdminFailure(response.status === 401 || response.status === 403 ? 401 : 503);
    let user;
    try { user = await response.json(); } catch { throw new AdminFailure(503); }
    // Identity comes only from Auth's verified response, never decoded JWT/user_metadata.
    if (!user || user.is_anonymous !== false || !user.email_confirmed_at || typeof user.id !== 'string' ||
      !(env.VISITOR_ADMIN_USER_IDS ?? '').split(',').map(id => id.trim().toLowerCase()).includes(user.id.toLowerCase())) throw new AdminFailure(403);
    return { id: user.id as string };
  }
  async function authorize(req: Request) {
    originAllowed(req);
    if (!(options.readGate ?? readGate)()) throw new AdminFailure(429);
    const token = sessionToken(req.headers.get('cookie'), env);
    if (!token) throw new AdminFailure(401);
    return verify(token);
  }
  async function summary(): Promise<VisitorStatistics> {
    if (env.SUPABASE_URL !== PROJECT_URL || !/^sb_secret_[A-Za-z0-9_-]+$/.test(env.SUPABASE_SECRET_KEY ?? '')) throw new AdminFailure(503);
    const date = seoulDate(now());
    try {
      const response = await request(PROJECT_URL + '/rest/v1/rpc/bath_visitor_summary?p_day=' + date, {
        method: 'GET', headers: { apikey: env.SUPABASE_SECRET_KEY! }, cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(5000),
      });
      if (!response.ok) throw new Error('unavailable');
      const data = await response.json();
      if (data?.date !== date || !['total','today','last7','last30'].every(key => Number.isSafeInteger(data[key]) && data[key] >= 0) ||
        !(data.total >= data.last30 && data.last30 >= data.last7 && data.last7 >= data.today) ||
        typeof data.refreshedAt !== 'string' || !Number.isFinite(Date.parse(data.refreshedAt)) ||
        seoulDate(new Date(data.refreshedAt)) !== date || Math.abs(Date.parse(data.refreshedAt) - now().getTime()) > 60000) throw new Error('invalid');
      // Strict output projection: extra upstream fields must never escape.
      return { date, total: data.total, today: data.today, last7: data.last7, last30: data.last30, refreshedAt: data.refreshedAt };
    } catch { throw new AdminFailure(503); }
  }
  async function protect(work: () => Promise<Response>) {
    try { return await work(); } catch (error) { return adminReply(error instanceof AdminFailure ? error.status : 503, { available: false }); }
  }
  return {
    authorize,
    // Server-only reuse by the invitation/recovery flow; never exposed as a route.
    assertOrigin: originAllowed,
    verifyIdentity: verify,
    get: (req: Request) => protect(async () => { await authorize(req); return adminReply(200, { available: true, ...await summary() }); }),
    login: (req: Request) => protect(async () => {
      originAllowed(req, true);
      if (!(options.loginGate ?? loginGate)()) throw new AdminFailure(429);
      if (req.headers.get('content-type')?.split(';')[0] !== 'application/json') throw new AdminFailure(400);
      // Bound streamed bodies as well as Content-Length before parsing credentials.
      const reader = req.body?.getReader(); if (!reader) throw new AdminFailure(400);
      let length = 0; const chunks: Uint8Array[] = [];
      const deadline = setTimeout(() => { void reader.cancel(); }, 3000);
      try { for (;;) { const { done, value } = await reader.read(); if (done) break; length += value.byteLength; if (length > 4096) throw new AdminFailure(400); chunks.push(value); } }
      finally { clearTimeout(deadline); void reader.cancel().catch(() => {}); }
      let body;
      try { body = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { throw new AdminFailure(400); }
      if (typeof body?.email !== 'string' || typeof body?.password !== 'string' || body.email.length > 254 || body.password.length < 1 || body.password.length > 1024) throw new AdminFailure(400);
      const response = await auth('token?grant_type=password', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: body.email.trim(), password: body.password }) });
      if (!response.ok) throw new AdminFailure(response.status === 429 ? 429 : response.status >= 500 ? 503 : 401);
      const session = await response.json();
      const token = session.access_token;
      if (typeof token !== 'string' || !sessionToken(`${adminCookieName(env)}=${token}`, env) || !Number.isFinite(session.expires_in) || session.expires_in < 1) throw new AdminFailure(503);
      await verify(token);
      // No refresh token persisted, no custom JWT issuer, no account creation.
      return setSession(adminReply(200, { available: true }), token, Math.min(3600, Math.floor(session.expires_in)), env);
    }),
    logout: (req: Request) => protect(async () => {
      originAllowed(req, true);
      const token = sessionToken(req.headers.get('cookie'), env);
      if (token) { try { await auth('logout', { method: 'POST', headers: { Authorization: `Bearer ${token}` } }); } catch { /* Local cookie must still be cleared. */ } }
      return setSession(adminReply(200, { available: true }), '', 0, env);
    }),
    publicTotal: (req: Request) => protect(async () => {
      // Independent public API switch. No effect on collection or admin authorization.
      if (env.VISITOR_PUBLIC_TOTAL_ENABLED !== 'true') return adminReply(404, { available: false });
      const origin = env.VISITOR_COUNTER_ORIGIN;
      if (!origin || new URL(origin).protocol !== 'https:' || new URL(origin).origin !== origin || new URL(req.url).origin !== origin ||
        req.headers.get('sec-fetch-site') === 'cross-site' || req.headers.has('origin') && req.headers.get('origin') !== origin) throw new AdminFailure(403);
      if (!(options.readGate ?? readGate)()) throw new AdminFailure(429);
      return adminReply(200, { available: true, total: (await summary()).total });
    }),
  };
}
