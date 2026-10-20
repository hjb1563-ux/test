import 'server-only';
import { createVisitorProcessor, visitorReply } from './visitor-core';
import { createVisitorRpc, PROJECT_URL } from './visitor-rpc';
export { seoulDate, signVisitor, readVisitor, VISITOR_COOKIE } from './visitor-core';
type Env = Record<string, string | undefined>;
export function visitorCounterEnabled(env: Env) {
  if (env.NODE_ENV !== 'production' || env.VERCEL_ENV !== 'production' || env.VISITOR_COUNTER_ENABLED !== 'true') return false;
  try {
    const origin = new URL(env.VISITOR_COUNTER_ORIGIN ?? '');
    return origin.protocol === 'https:' && origin.origin === env.VISITOR_COUNTER_ORIGIN &&
      !['localhost', '127.0.0.1', '[::1]'].includes(origin.hostname) && env.SUPABASE_URL === PROJECT_URL &&
      /^sb_secret_[A-Za-z0-9_-]+$/.test(env.SUPABASE_SECRET_KEY ?? '') && (env.VISITOR_COOKIE_SECRET?.length ?? 0) >= 32;
  } catch { return false; }
}

export function createVisitorHandlers(options: { env: Env; request?: typeof fetch; now?: () => Date; randomId?: () => string }) {
  const { env } = options;
  const processor = () => createVisitorProcessor({ origin: env.VISITOR_COUNTER_ORIGIN!, cookieSecret: env.VISITOR_COOKIE_SECRET!,
    rpc: createVisitorRpc({ secretKey: env.SUPABASE_SECRET_KEY!, cookieSecret: env.VISITOR_COOKIE_SECRET!, request: options.request }),
    now: options.now, randomId: options.randomId,
  });
  return {
    async get(req: Request) {
      if (!visitorCounterEnabled(env)) return visitorReply(503, { available: false });
      return processor().get(req);
    },
    async post(req: Request) {
      if (!visitorCounterEnabled(env)) return visitorReply(403, { available: false });
      return processor().post(req);
    },
  };
}
