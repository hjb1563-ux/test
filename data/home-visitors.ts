// Cookie bootstrap and registration share an origin-scoped Web Lock across tabs.
export function createHomeVisitorLoader() {
  // This is only an HTTP optimization, never the authoritative counter/dedup store.
  let registeredDay: string | undefined;
  return async function loadHomeVisitors(request: typeof fetch, locks?: LockManager): Promise<{ date: string; count: number } | null> {
  if (!locks?.request) return null; // No unreliable storage-event lock fallback.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    return await locks.request('bath-home-visitor-cookie', { mode: 'exclusive', signal: controller.signal }, async () => {
      const call = async (url: string, method: string) => {
        const response = await request(url, { method, credentials: 'same-origin', cache: 'no-store', redirect: 'error', signal: controller.signal,
          ...(method === 'POST' ? { headers: { 'X-Bath-Visit': '1' } } : {}) });
        if (!response.ok) throw new Error('unavailable');
        const result = await response.json();
        if (result.available !== true || !/^\d{4}-\d{2}-\d{2}$/.test(result.date) || !Number.isSafeInteger(result.count) || result.count < 0) throw new Error('unavailable');
        return { date: result.date as string, count: result.count as number };
      };
      const today = await call('/api/visitors', 'GET');
      if (registeredDay === today.date) return today;
      const registered = await call('/api/visitors/visit', 'POST');
      registeredDay = registered.date;
      return registered;
    });
  } catch { return null; } finally { clearTimeout(timer); }
  };
}
export const loadHomeVisitors = createHomeVisitorLoader();
