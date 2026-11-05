import 'server-only';
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
export const VISITOR_COOKIE = '__Host-bath-visitor';
export type VisitorMetric = { date: string; count: number };
export type VisitorRpc = (name: 'bath_visitor_today' | 'bath_visitor_register', day: string, visitor?: string) => Promise<VisitorMetric>;
const headers = { 'Cache-Control': 'private, no-store', 'Vary': 'Cookie', 'X-Content-Type-Options': 'nosniff' };
export const visitorReply = (status: number, data: unknown) => Response.json(data, { status, headers });
export function seoulDate(now: Date) { return new Date(now.getTime() + 9 * 3600000).toISOString().slice(0, 10); }
const mac = (secret: string, value: string) => createHmac('sha256', secret).update(value).digest('hex');
export const COOKIE_TTL_SECONDS = 30 * 24 * 3600;
const validMac = (value: string, signature: string, secret: string) => timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(mac(secret, value), 'hex'));
function cookieToken(cookie: string | null) {
  const values = cookie?.split(';').map(v => v.trim()).filter(v => v.startsWith(VISITOR_COOKIE + '='));
  return values?.length === 1 ? values[0].slice(VISITOR_COOKIE.length + 1) : null;
}
export function signVisitor(id: string, secret: string, now = new Date()) {
  const issued = Math.floor(now.getTime() / 1000);
  if (!/^[a-f0-9]{64}$/.test(id) || !Number.isSafeInteger(issued) || issued < 0) throw new Error('invalid-cookie-input');
  const payload = 'v2.' + id + '.' + issued;
  return payload + '.' + mac(secret, 'cookie:' + payload);
}
export function readVisitor(cookie: string | null, secret: string, now = new Date()): string | null {
  const token = cookieToken(cookie);
  if (!token || !/^v2\.[a-f0-9]{64}\.(0|[1-9][0-9]{0,12})\.[a-f0-9]{64}$/.test(token)) return null;
  const [, id, time, signature] = token.split('.'), issued = Number(time), current = Math.floor(now.getTime() / 1000);
  if (!Number.isSafeInteger(current) || !Number.isSafeInteger(issued) || issued > current || current - issued >= COOKIE_TTL_SECONDS) return null;
  return validMac('cookie:v2.' + id + '.' + time, signature, secret) ? id : null;
}
// Legacy cookies cannot prove age and are rejected; GET issues a fresh identity.
// Per-instance load shedding only, not a distributed limit. No IP addresses are stored.
export function createVisitorRequestGate(clock = () => Date.now()) {
  let start = clock(), total = 0;
  const visitors = new Map<string, number>();
  return (id: string | null) => {
    const now = clock();
    if (now - start >= 60000) { start = now; total = 0; visitors.clear(); }
    if (total >= 300) return false;
    total++;
    if (!id) return true;
    const count = visitors.get(id) ?? 0;
    if (count >= 60) return false;
    visitors.set(id, count + 1); // No more than 300 keys per minute.
    return true;
  };
}
const instanceGate = createVisitorRequestGate();
const throttled = () => { const r = visitorReply(429, { available: false }); r.headers.set('Retry-After', '60'); return r; };
async function emptyBody(req: Request) {
  const length = req.headers.get('content-length');
  if (length !== null && length !== '0') return false;
  if (!req.body) return true;
  // Next.js can expose an empty POST as a stream. Do not buffer arbitrary input.
  const reader = req.body.getReader();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      (async () => { for (;;) { const { done, value } = await reader.read(); if (done) return true; if (value.byteLength) return false; } })(),
      new Promise<false>(resolve => { timer = setTimeout(() => resolve(false), 1000); }),
    ]);
  } catch { return false; } finally { clearTimeout(timer); void reader.cancel().catch(() => {}); }
}

// Internal processing only. Public routes must enter through visitors.ts.
export function createVisitorProcessor(options: { origin: string; cookieSecret: string; rpc: VisitorRpc; now?: () => Date; randomId?: () => string; requestGate?: (id: string | null) => boolean }) {
  if (new URL(options.origin).protocol !== 'https:') throw new Error('invalid-origin');
  const reply = visitorReply, rpc = options.rpc, gate = options.requestGate ?? instanceGate;
  function allowed(req: Request, write: boolean) {
    if (new URL(req.url).origin !== options.origin) return false;
    if (req.headers.get('sec-fetch-site') === 'cross-site') return false;
    if (req.headers.has('origin') && req.headers.get('origin') !== options.origin) return false;
    if (write && (req.headers.get('origin') !== options.origin || req.headers.get('x-bath-visit') !== '1')) return false;
    return !/bot|crawler|spider|headless|preview|facebookexternalhit|slurp/i.test(req.headers.get('user-agent') ?? '');
  }
  return {
    async get(req: Request) {
      const now = (options.now ?? (() => new Date()))();
      const existing = readVisitor(req.headers.get('cookie'), options.cookieSecret, now);
      if (!gate(existing)) return throttled();
      if (!allowed(req, false)) return reply(503, { available: false });
      try {
        const day = seoulDate(now);
        const response = reply(200, { available: true, ...await rpc('bath_visitor_today', day) });
        if (!existing) {
          const id = (options.randomId ?? (() => randomBytes(32).toString('hex')))();
          response.headers.set('Set-Cookie', `${VISITOR_COOKIE}=${signVisitor(id, options.cookieSecret, now)}; Path=/; Max-Age=2592000; HttpOnly; Secure; SameSite=Lax`);
        }
        return response;
      } catch { return reply(503, { available: false }); }
    },
    async post(req: Request) {
      const now = (options.now ?? (() => new Date()))();
      const id = readVisitor(req.headers.get('cookie'), options.cookieSecret, now);
      if (!gate(id)) return throttled();
      if (!allowed(req, true)) return reply(403, { available: false });
      if (!await emptyBody(req)) return reply(400, { available: false });
      if (!id) return reply(428, { available: false }); // Bootstrap never increments; cookies-disabled clients do not inflate.
      try {
        const day = seoulDate(now);
        return reply(200, { available: true, ...await rpc('bath_visitor_register', day, id) });
      } catch (error) { return reply(error instanceof Error && error.message === 'rate-limit' ? 429 : 503, { available: false }); }
    },
  };
}
