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

/**
 * טעינה מחדש לגרסה החדשה ביותר.
 * ה-service worker מגיש את הגרסה השמורה, אז קודם מבקשים ממנו לבדוק עדכון ומחכים (קצת) שהחדש ייכנס.
 */
export async function reloadToLatest() {
  try {
    const registration = await navigator.serviceWorker?.getRegistration();
    if (registration) {
      const changed = new Promise((resolve) => navigator.serviceWorker.addEventListener('controllerchange', resolve, { once: true }));
      await registration.update();
      if (registration.installing || registration.waiting) {
        await Promise.race([changed, new Promise((resolve) => setTimeout(resolve, 5000))]);
      }
    }
  } catch {
    // בלי service worker, טעינה רגילה כבר מביאה את הגרסה החדשה
  }
  location.reload();
}
