import 'server-only';
import { createHmac } from 'node:crypto';
import type { VisitorRpc } from './visitor-core';
export const VISITOR_PROJECT_REF = 'istsrambmbzuemkgutgh';
export const PROJECT_URL = 'https://istsrambmbzuemkgutgh.supabase.co';
export function visitorHash(secret: string, day: string, visitor: string) {
  return createHmac('sha256', secret).update(`day:${day}:${visitor}`).digest('hex');
}
export function createVisitorRpc(options: { secretKey: string; cookieSecret: string; request?: typeof fetch }): VisitorRpc {
  const request = options.request ?? fetch;
  return async (name, day, visitor) => {
    const query = visitor === undefined ? '?p_day=' + encodeURIComponent(day) : '';
    const result = await request(`${PROJECT_URL}/rest/v1/rpc/${name}${query}`, {
      method: visitor === undefined ? 'GET' : 'POST', redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(5000),
      headers: { apikey: options.secretKey, ...(visitor === undefined ? {} : { 'Content-Type': 'application/json' }) },
      ...(visitor === undefined ? {} : { body: JSON.stringify({ p_day: day, p_hash: visitorHash(options.cookieSecret, day, visitor) }) }),
    });
    if (result.status === 429) throw new Error('rate-limit');
    if (!result.ok) throw new Error('unavailable');
    const row = await result.json();
    if (row?.date !== day || !Number.isSafeInteger(row?.count) || row.count < 0) throw new Error('unavailable');
    return { date: day, count: row.count };
  };
}
