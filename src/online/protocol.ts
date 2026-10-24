/**
 * ההודעות בין הטלפונים לשרת במצב "כל אחד בטלפון שלו".
 * הקובץ משותף ללקוח (src/online) ולשרת (worker), ולכן בלי תלות בדפדפן או ב-Cloudflare.
 */

/**
 * עולה בכל שינוי לא תואם בהודעות. טלפון עם גרסה אחרת מקבל outdated ומתבקש לטעון מחדש.
 * 2: הגדרות, סבבים וחשיפת תפקידים.
 */
export const PROTOCOL_VERSION = 2;

export const CODE_LENGTH = 6;
/** כמו באורך השם במסך ההגדרות */
export const MAX_NAME_LENGTH = 16;
export const MIN_TOKEN_LENGTH = 16;
export const MAX_TOKEN_LENGTH = 64;

/** "482731" -> "482 731" */
export function formatCode(code: string): string {
  return `${code.slice(0, 3)} ${code.slice(3)}`;
}

export function isRoomCode(value: string): boolean {
  return new RegExp(`^\\d{${CODE_LENGTH}}$`).test(value);
}

/** ההגדרות של החדר. כמו Settings של הטלפון האחד, בלי רשימת השחקנים (היא החדר עצמו) */
export interface RoomSettings {
  /** ריק = כל הקטגוריות */
  categories: string[];
  imposterCount: 1 | 2;
  imposterNeverStarts: boolean;
  showCategory: boolean;
}

export type ClientMessage =
  /**
   * הטוקן נוצר בטלפון ונשמר בו לפני השליחה. אם החיבור נפל לפני התשובה, שולחים שוב את אותה הודעה,
   * והשרת מזהה לפי הטוקן שהשחקן כבר בחדר במקום ליצור אותו פעמיים
   */
  | { type: 'room:join'; name: string; token: string; version: number }
  | { type: 'room:rejoin'; token: string; version: number }
  | { type: 'room:leave' }
  | { type: 'lobby:reorder'; playerIds: string[] }
  | { type: 'lobby:kick'; playerId: string }
  | { type: 'lobby:settings'; settings: RoomSettings }
  | { type: 'game:start' }
  | { type: 'role:seen' }
  | { type: 'reveal:skip' }
  | { type: 'round:end' }
  | { type: 'round:next' }
  | { type: 'round:lobby' };

export type ErrorCode =
  /** הטלפון עם גרסה ישנה (או חדשה) מדי */
  | 'outdated'
  | 'room_not_found'
  | 'room_full'
  | 'name_required'
  | 'name_taken'
  /** הטוקן לא מוכר: השחקן יצא, הוצא, או שהחדר נמחק */
  | 'bad_token'
  | 'not_joined'
  | 'not_host'
  | 'bad_order'
  | 'bad_message'
  /** הפעולה לא מתאימה לשלב הנוכחי (למשל התחלה באמצע סבב) */
  | 'wrong_phase'
  | 'not_enough_players';

export interface PublicPlayer {
  id: string;
  name: string;
  connected: boolean;
}

/**
 * lobby: מצטרפים ובוחרים הגדרות. reveal: כל אחד רואה את התפקיד שלו.
 * play: מדברים לפי התור (ההצבעה עוד בעל-פה). roundEnd: המילה והמתחזים נחשפים
 */
export type RoomPhase = 'lobby' | 'reveal' | 'play' | 'roundEnd';

/** התפקיד של הטלפון הזה בסבב. רק הוא מקבל אותו */
export type Role = { kind: 'crew'; word: string } | { kind: 'imposter'; hint: string };

export interface RoundState {
  /** עולה בכל סבב, כדי לדעת שזה סבב חדש */
  number: number;
  /** מי בסבב, לפי סדר הישיבה כשהסבב התחיל. עם השמות, כי מי שיצא באמצע כבר לא ברשימת החדר */
  players: { id: string; name: string }[];
  starterId: string;
  /** מי כבר ראה את התפקיד שלו */
  seenIds: string[];
  /** מי יצא מהחדר באמצע הסבב */
  leftIds: string[];
  /** כמה מתחזים יש. ידוע לכולם, כמו בטלפון האחד */
  imposterCount: number;
  /** null = הטלפון הזה לא בסבב (הצטרף באמצע) */
  role: Role | null;
  /** רק כשההגדרה "כולם יודעים את הקטגוריה" פעילה */
  category?: string;
  /** רק בסוף הסבב: הכול נחשף */
  reveal?: {
    word: string;
    category: string;
    imposters: { id: string; hint: string }[];
    /** הסבב נגמר כי מתחזה יצא מהחדר */
    imposterLeft: boolean;
  };
}

/** מה שכל טלפון רואה. נשלח מחדש אחרי כל שינוי */
export interface RoomState {
  code: string;
  hostId: string | null;
  /** לפי סדר הישיבה, עם כיוון השעון */
  players: PublicPlayer[];
  /** המזהה של הטלפון הזה */
  you: string;
  phase: RoomPhase;
  settings: RoomSettings;
  round?: RoundState;
}

export type LeftReason = 'left' | 'kicked' | 'closed';

export type ServerMessage =
  | { type: 'state'; state: RoomState }
  /** ההצטרפות הצליחה. מעכשיו חוזרים עם room:rejoin */
  | { type: 'welcome' }
  | { type: 'error'; code: ErrorCode }
  /** הטלפון כבר לא בחדר. החיבור נסגר מיד אחרי ההודעה */
  | { type: 'left'; reason: LeftReason };
