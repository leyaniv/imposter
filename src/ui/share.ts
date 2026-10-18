import { he } from '../i18n/he';

export type ShareResult = 'shared' | 'copied' | 'cancelled' | 'failed';

/** הכתובת של המשחק, בלי מסלול או פרמטרים */
function gameUrl(): string {
  return new URL('./', location.href).href;
}

/**
 * שיתוף דרך תפריט השיתוף של הטלפון (וואטסאפ וכו').
 * בדפדפן בלי תפריט שיתוף, מעתיקים את הקישור.
 */
export async function shareGame(): Promise<ShareResult> {
  const url = gameUrl();
  if (navigator.share) {
    try {
      await navigator.share({ title: he.appName, text: he.home.shareText, url });
      return 'shared';
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return 'cancelled';
      // ממשיכים להעתקה
    }
  }
  try {
    await navigator.clipboard.writeText(`${he.home.shareText}\n${url}`);
    return 'copied';
  } catch {
    return 'failed';
  }
}
