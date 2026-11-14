/**
 * מה שהטלפון זוכר על מצב "כל אחד בטלפון שלו", ב-localStorage:
 * השם (לפעם הבאה), והחדרים שהטלפון בהם, כל אחד עם הטוקן שאיתו חוזרים אליו אחרי ריענון או מהמסך הראשי.
 */
import { ROOM_IDLE_MS } from './protocol';

const NAME_KEY = 'imposter:name';
/** החדרים לפי קוד */
const ROOMS_KEY = 'imposter:rooms';
/** גרסה קודמת: חדר אחד בלבד. נקרא פעם אחת ועובר ל-ROOMS_KEY */
const LEGACY_SESSION_KEY = 'imposter:online';

export interface Session {
  code: string;
  /** נוצר בטלפון לפני ההצטרפות, ומזהה את השחקן בחדר */
  token: string;
  /** השרת אישר את ההצטרפות (welcome). עד אז, אחרי ניתוק שולחים שוב join עם אותו טוקן */
  joined: boolean;
  /** מתי הטלפון קיבל מהחדר מצב לאחרונה. חדר שלא נראה זמן רב כנראה כבר נמחק בשרת */
  seenAt?: number;
}

export type Rooms = Record<string, Session>;

/** הטלפון ראה את החדר בזמן האחרון, אז הוא כנראה עדיין קיים בשרת (שמוחק חדר אחרי ROOM_IDLE_MS בלי שינוי) */
function fresh(session: Session, now: number): boolean {
  return session.seenAt !== undefined && now - session.seenAt < ROOM_IDLE_MS;
}

function validSession(value: unknown): Session | null {
  if (typeof value !== 'object' || value === null) return null;
  const { code, token, joined, seenAt } = value as Record<string, unknown>;
  if (typeof code !== 'string' || typeof token !== 'string') return null;
  return { code, token, joined: !!joined, ...(typeof seenAt === 'number' && { seenAt }) };
}

/**
 * החדרים השמורים. legacy: החדר היחיד מהגרסה הקודמת, אם יש.
 * חדרים ישנים נמחקים כאן, כדי שהרשימה לא תגדל בלי סוף. חדר בלי seenAt נשאר (הצטרפות שעוד לא הושלמה)
 */
export function parseRooms(raw: unknown, legacy: unknown, now: number): Rooms {
  const rooms: Rooms = {};
  const legacySession = validSession(legacy);
  // בלי seenAt: עדיין חוזרים אליו בקישור או בריענון, אבל לא מציעים אותו במסך הראשי, כי אין דרך לדעת אם הוא עדיין קיים
  if (legacySession) rooms[legacySession.code] = legacySession;
  if (typeof raw === 'object' && raw !== null) {
    for (const value of Object.values(raw)) {
      const session = validSession(value);
      if (session) rooms[session.code] = session;
    }
  }
  for (const [code, session] of Object.entries(rooms)) {
    if (session.seenAt !== undefined && !fresh(session, now)) delete rooms[code];
  }
  return rooms;
}

/** החדר שהטלפון היה בו לאחרונה, אם הוא כנראה עדיין קיים. בשביל "חזרה לחדר" במסך הראשי */
export function latestRoom(rooms: Rooms, now: number): Session | null {
  const open = Object.values(rooms).filter((session) => session.joined && fresh(session, now));
  return open.sort((a, b) => b.seenAt! - a.seenAt!)[0] ?? null;
}

function readJson(key: string): unknown {
  try {
    return JSON.parse(localStorage.getItem(key) ?? 'null');
  } catch {
    return null;
  }
}

function loadRooms(): Rooms {
  return parseRooms(readJson(ROOMS_KEY), readJson(LEGACY_SESSION_KEY), Date.now());
}

function saveRooms(rooms: Rooms) {
  try {
    localStorage.setItem(ROOMS_KEY, JSON.stringify(rooms));
    localStorage.removeItem(LEGACY_SESSION_KEY);
  } catch {
    // בלי אחסון, ריענון יחזיר למסך ההצטרפות
  }
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
  return loadRooms()[code] ?? null;
}

export function saveSession(session: Session) {
  saveRooms({ ...loadRooms(), [session.code]: session });
}

/** החדר שלח מצב: מעדכנים מתי נראה לאחרונה. לכל היותר פעם בדקה, כדי לא לכתוב בכל הודעה */
export function touchSession(code: string, now = Date.now()) {
  const session = loadSession(code);
  if (!session?.joined || (session.seenAt !== undefined && now - session.seenAt < 60_000)) return;
  saveSession({ ...session, seenAt: now });
}

/** החדר שהטלפון היה בו לאחרונה ועדיין פתוח, אם יש */
export function loadLatestRoom(): Session | null {
  return latestRoom(loadRooms(), Date.now());
}

/** שוכח את החדר הזה. חדרים אחרים ששמורים בטלפון נשארים */
export function clearSession(code: string) {
  const rooms = loadRooms();
  if (!(code in rooms)) return;
  delete rooms[code];
  saveRooms(rooms);
}

const MODE_KEY = 'imposter:mode';
const SECRET_VOTE_KEY = 'imposter:secretVote';

/** המצב האחרון שנבחר במסך "משחק חדש" בטלפון הזה. בלי בחירה קודמת: טלפון לכל שחקן */
export function loadMode(): 'local' | 'online' {
  try {
    return localStorage.getItem(MODE_KEY) === 'local' ? 'local' : 'online';
  } catch {
    return 'online';
  }
}

export function saveMode(mode: 'local' | 'online') {
  try {
    localStorage.setItem(MODE_KEY, mode);
  } catch {
    // לא קריטי: בפעם הבאה יתחיל מ"טלפון לכל שחקן"
  }
}

/** "הצבעה חשאית" היא הגדרה של חדר מקוון בלבד, אז היא נשמרת כאן ולא בהגדרות של המשחק המקומי */
export function loadSecretVote(): boolean {
  try {
    return localStorage.getItem(SECRET_VOTE_KEY) === '1';
  } catch {
    return false;
  }
}

export function saveSecretVote(secretVote: boolean) {
  try {
    if (secretVote) localStorage.setItem(SECRET_VOTE_KEY, '1');
    else localStorage.removeItem(SECRET_VOTE_KEY);
  } catch {
    // לא קריטי
  }
}
