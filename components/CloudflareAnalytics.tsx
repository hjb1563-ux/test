'use client';

import { useEffect, useState } from 'react';
import Script from 'next/script';
import { analyticsLocationToken, CLOUDFLARE_BEACON_SRC, type AnalyticsTokens } from '../data/cloudflare-analytics';

export default function CloudflareAnalytics({ tokens, spa = false }: { tokens: AnalyticsTokens; spa?: boolean }) {
  const [token,setToken] = useState<string | null>(null);
  useEffect(() => { setToken(analyticsLocationToken(tokens, window.location.href, document.referrer)); },[tokens]);
  if (!token) return null;
  return <Script id="bath-cloudflare-web-analytics" src={CLOUDFLARE_BEACON_SRC}
    type="module" strategy="lazyOnload" referrerPolicy="origin"
    data-cf-beacon={JSON.stringify({token,spa})} />;
}
