/**
 * מה שהטלפון זוכר על מצב "כל אחד בטלפון שלו", ב-localStorage:
 * השם (לפעם הבאה), והחדר הנוכחי עם הטוקן שאיתו חוזרים אליו אחרי ריענון.
 */

const NAME_KEY = 'imposter:name';
const SESSION_KEY = 'imposter:online';

export interface Session {
  code: string;
  /** נוצר בטלפון לפני ההצטרפות, ומזהה את השחקן בחדר */
  token: string;
  /** השרת אישר את ההצטרפות (welcome). עד אז, אחרי ניתוק שולחים שוב join עם אותו טוקן */
  joined: boolean;
}

export function loadName(): string {
  try {
    return localStorage.getItem(NAME_KEY) ?? '';
  } catch {
    return '';
  }
}

export function saveName(name: string) {
  try {
    localStorage.setItem(NAME_KEY, name);
  } catch {
    // גלישה פרטית או אחסון חסום: פשוט לא נזכור את השם
  }
}

export function loadSession(code: string): Session | null {
  try {
    const session = JSON.parse(localStorage.getItem(SESSION_KEY) ?? 'null') as Session | null;
    return session?.code === code && typeof session.token === 'string' ? { ...session, joined: !!session.joined } : null;
  } catch {
    return null;
  }
}

export function saveSession(session: Session) {
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch {
    // בלי אחסון, ריענון יחזיר למסך ההצטרפות
  }
}

/** שוכח את החדר הזה. חדר אחר ששמור בטלפון לא נמחק */
export function clearSession(code: string) {
  try {
    if (loadSession(code)) localStorage.removeItem(SESSION_KEY);
  } catch {
    // לא קריטי
  }
}
