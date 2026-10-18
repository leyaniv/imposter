/**
 * רושם את ה-service worker, רק בגרסת ה-build.
 * בפיתוח הוא היה מגיש קבצים ישנים מהמטמון ומבלבל.
 * עובד רק ב-HTTPS או ב-localhost.
 */
export function registerServiceWorker() {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {
      // בלי service worker המשחק עדיין עובד, רק לא בלי אינטרנט
    });
  });
}
