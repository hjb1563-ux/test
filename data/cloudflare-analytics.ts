export const CLOUDFLARE_BEACON_SRC = 'https://static.cloudflareinsights.com/beacon.min.js';
export const ANALYTICS_HOSTNAME = 'test-beta-ten-79.vercel.app';
const publicPaths = new Set(['/', '/design', '/result', '/guide', '/guide/glossary',
  ...['demolition','layout','waterproofing','tile','basin','toilet','furniture','bathtub','ceiling','faucet','drainage','ventilation','lighting','accessories','grout','threshold','checklist'].map(slug=>'/guide/'+slug)]);

// Read only public site configuration, never API keys or application data.
export function cloudflareSiteToken(env: Record<string,string|undefined>) {
  const token = env.CLOUDFLARE_WEB_ANALYTICS_TOKEN;
  return env.NODE_ENV === 'production' && env.VERCEL_ENV === 'production' &&
    typeof token === 'string' && /^[a-f0-9]{32}$/i.test(token) ? token : null;
}

export function analyticsLocationAllowed(href: string, referrer = '') {
  try {
    const url = new URL(href);
    if (url.protocol !== 'https:' || url.hostname !== ANALYTICS_HOSTNAME || url.port) return false;
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
