/**
 * ההודעות בין הטלפונים לשרת במצב "כל אחד בטלפון שלו".
 * הקובץ משותף ללקוח (src/online) ולשרת (worker), ולכן בלי תלות בדפדפן או ב-Cloudflare.
 */

/** עולה בכל שינוי לא תואם בהודעות. טלפון עם גרסה אחרת מקבל outdated ומתבקש לטעון מחדש */
export const PROTOCOL_VERSION = 1;

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

export type ClientMessage =
  /**
   * הטוקן נוצר בטלפון ונשמר בו לפני השליחה. אם החיבור נפל לפני התשובה, שולחים שוב את אותה הודעה,
   * והשרת מזהה לפי הטוקן שהשחקן כבר בחדר במקום ליצור אותו פעמיים
   */
  | { type: 'room:join'; name: string; token: string; version: number }
  | { type: 'room:rejoin'; token: string; version: number }
  | { type: 'room:leave' }
  | { type: 'lobby:reorder'; playerIds: string[] }
  | { type: 'lobby:kick'; playerId: string };

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
  | 'bad_message';

export interface PublicPlayer {
  id: string;
  name: string;
  connected: boolean;
}

/** מה שכל טלפון רואה. נשלח מחדש אחרי כל שינוי */
export interface RoomState {
  code: string;
  hostId: string | null;
  /** לפי סדר הישיבה, עם כיוון השעון */
  players: PublicPlayer[];
  /** המזהה של הטלפון הזה */
  you: string;
}

export type LeftReason = 'left' | 'kicked' | 'closed';

export type ServerMessage =
  | { type: 'state'; state: RoomState }
  /** ההצטרפות הצליחה. מעכשיו חוזרים עם room:rejoin */
  | { type: 'welcome' }
  | { type: 'error'; code: ErrorCode }
  /** הטלפון כבר לא בחדר. החיבור נסגר מיד אחרי ההודעה */
  | { type: 'left'; reason: LeftReason };
