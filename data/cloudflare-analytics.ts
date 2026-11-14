export const CLOUDFLARE_BEACON_SRC = 'https://static.cloudflareinsights.com/beacon.min.js';
export const ANALYTICS_HOSTNAME = 'test-beta-ten-79.vercel.app';
export const ANALYTICS_TOKEN_ENV = {
  [ANALYTICS_HOSTNAME]: 'CLOUDFLARE_WEB_ANALYTICS_TOKEN',
  'bathdesigner.vercel.app': 'CLOUDFLARE_WEB_ANALYTICS_TOKEN_BATHDESIGNER',
} as const;
export type AnalyticsTokens = Partial<Record<keyof typeof ANALYTICS_TOKEN_ENV, string>>;
const publicPaths = new Set(['/', '/design', '/result', '/guide', '/guide/glossary',
  ...['demolition','layout','waterproofing','tile','basin','toilet','furniture','bathtub','ceiling','faucet','drainage','ventilation','lighting','accessories','grout','threshold','checklist'].map(slug=>'/guide/'+slug)]);

// Read only public site configuration, never API keys or application data.
export function cloudflareSiteToken(env: Record<string,string|undefined>, hostname: string = ANALYTICS_HOSTNAME) {
  const key = Object.hasOwn(ANALYTICS_TOKEN_ENV, hostname)
    ? ANALYTICS_TOKEN_ENV[hostname as keyof typeof ANALYTICS_TOKEN_ENV] : null;
  const token = key ? env[key] : undefined;
  return env.NODE_ENV === 'production' && env.VERCEL_ENV === 'production' &&
    typeof token === 'string' && /^[a-f0-9]{32}$/i.test(token) ? token : null;
}

export function analyticsLocationAllowed(href: string, referrer = '') {
  try {
    const url = new URL(href);
    if (url.protocol !== 'https:' || !Object.hasOwn(ANALYTICS_TOKEN_ENV, url.hostname) || url.port) return false;
    // Public entry paths are literals; never accept customer IDs as route names.
    const path = url.pathname;
    if (!publicPaths.has(path)) return false;
    if (referrer) {
      const from = new URL(referrer);
      // Avoid reporting admin/auth URLs even as same-site referrers.
      if (from.origin === url.origin && !publicPaths.has(from.pathname)) return false;
    }
    return true;
  } catch { return false; }
}

// Only validated public beacon tokens cross the server/client boundary.
export function cloudflareSiteTokens(env: Record<string, string | undefined>): AnalyticsTokens {
  const tokens: AnalyticsTokens = {};
  for (const hostname of Object.keys(ANALYTICS_TOKEN_ENV) as (keyof typeof ANALYTICS_TOKEN_ENV)[]) {
    const token = cloudflareSiteToken(env, hostname);
    if (token) tokens[hostname] = token;
  }
  return tokens;
}

export function analyticsLocationToken(tokens: AnalyticsTokens, href: string, referrer = '') {
  if (!analyticsLocationAllowed(href, referrer)) return null;
  const hostname = new URL(href).hostname as keyof typeof ANALYTICS_TOKEN_ENV;
  const token = tokens[hostname];
  return typeof token === 'string' && /^[a-f0-9]{32}$/i.test(token) ? token : null;
}
