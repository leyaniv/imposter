import { useEffect } from 'react';

/**
 * שומר שהמסך לא ייכבה כל עוד active.
 * עובד רק ב-HTTPS או ב-localhost. בכתובת IP מקומית עם HTTP פשוט לא קורה כלום.
 */
export function useWakeLock(active: boolean) {
  useEffect(() => {
    if (!active || !('wakeLock' in navigator)) return;

    let sentinel: WakeLockSentinel | null = null;
    let cancelled = false;

    const acquire = async () => {
      if (sentinel && !sentinel.released) return;
      try {
        const lock = await navigator.wakeLock.request('screen');
        if (cancelled) await lock.release();
        else sentinel = lock;
      } catch {
        // הדפדפן סירב (חיסכון בסוללה, לשונית ברקע וכו'). לא קריטי.
      }
    };

    // הנעילה משתחררת אוטומטית כשהדף מוסתר, אז מבקשים שוב כשחוזרים
    const onVisibility = () => document.visibilityState === 'visible' && acquire();

    acquire();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisibility);
      sentinel?.release().catch(() => {});
    };
  }, [active]);
}
