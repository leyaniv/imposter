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
  return shareLink(he.home.shareText, gameUrl());
}

/** הקישור לחדר במצב "כל אחד בטלפון שלו" */
export function roomUrl(code: string): string {
  return `${gameUrl()}?room=${code}`;
}

export async function shareRoom(code: string): Promise<ShareResult> {
  return shareLink(he.online.lobby.shareText, roomUrl(code));
}

async function shareLink(text: string, url: string): Promise<ShareResult> {
  if (navigator.share) {
    try {
      await navigator.share({ title: he.appName, text, url });
      return 'shared';
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return 'cancelled';
      // ממשיכים להעתקה
    }
  }
  try {
    await navigator.clipboard.writeText(`${text}\n${url}`);
    return 'copied';
  } catch {
    return 'failed';
  }
}
