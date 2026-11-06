'use client';

import { useEffect, useState } from 'react';
import Script from 'next/script';
import { analyticsLocationAllowed, CLOUDFLARE_BEACON_SRC } from '../data/cloudflare-analytics';

export default function CloudflareAnalytics({ token, spa = false }: { token: string; spa?: boolean }) {
  const [allowed,setAllowed] = useState(false);
  useEffect(() => { setAllowed(analyticsLocationAllowed(window.location.href, document.referrer)); },[]);
  if (!allowed) return null;
  return <Script id="bath-cloudflare-web-analytics" src={CLOUDFLARE_BEACON_SRC}
    type="module" strategy="lazyOnload" referrerPolicy="origin"
    data-cf-beacon={JSON.stringify({token,spa})} />;
}
