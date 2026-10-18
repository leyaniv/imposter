// Service worker של המתחזה. נוצר בזמן build מתוך הקובץ הזה (ראו vite.config.ts).
// שומר את כל קבצי המשחק במכשיר, כך שאחרי הפתיחה הראשונה הוא עובד גם בלי אינטרנט.
// כשעולה גרסה חדשה, הקובץ משתנה, הדפדפן מוריד אותו ברקע, והגרסה החדשה נטענת בפתיחה הבאה.

const CACHE = 'imposter-__VERSION__';
const ASSETS = __ASSETS__;

// שרתים מסוימים שולחים Vary: Origin, וסקריפטים מסוג module נשלחים עם Origin,
// כך שבלי ignoreVary הם לא היו נמצאים במטמון כשאין אינטרנט. הקבצים סטטיים, אז זה בטוח.
const MATCH = { ignoreVary: true };

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(ASSETS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('imposter-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;

  // ניווט לכל כתובת באתר מקבל את index.html מהמטמון
  if (request.mode === 'navigate') {
    event.respondWith(
      caches.match(new URL('index.html', self.location).href, MATCH).then((cached) => cached || fetch(request)),
    );
    return;
  }

  event.respondWith(caches.match(request, MATCH).then((cached) => cached || fetch(request)));
});
