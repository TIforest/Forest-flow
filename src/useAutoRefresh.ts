import { useEffect, useRef } from 'react';

// Poll only visible pages, resume immediately on focus/reconnection and never
// overlap requests. The latest callback keeps local form drafts untouched.
export function useAutoRefresh(
  refresh: () => Promise<unknown>,
  enabled = true,
) {
  const callback = useRef(refresh);
  callback.current = refresh;
  useEffect(() => {
    if (!enabled) return;
    let stopped = false,
      running = false;
    let timer: ReturnType<typeof setTimeout>;
    async function tick() {
      if (stopped || running) return;
      clearTimeout(timer);
      running = true;
      try {
        if (document.visibilityState !== 'hidden' && navigator.onLine)
          await callback.current();
      } catch {
        // Keep the last successful data during a temporary connection failure.
      } finally {
        running = false;
        if (!stopped) timer = setTimeout(tick, 5000);
      }
    }
    timer = setTimeout(tick, 5000);
    document.addEventListener('visibilitychange', tick);
    window.addEventListener('focus', tick);
    window.addEventListener('online', tick);
    return () => {
      stopped = true;
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', tick);
      window.removeEventListener('focus', tick);
      window.removeEventListener('online', tick);
    };
  }, [enabled]);
}
