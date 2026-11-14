/**
 * ההודעות בין הטלפונים לשרת במצב "כל אחד בטלפון שלו".
 * הקובץ משותף ללקוח (src/online) ולשרת (worker), ולכן בלי תלות בדפדפן או ב-Cloudflare.
 */
import type { ScoredVote } from '../game/types';

export type { ScoredVote };

/**
 * עולה בכל שינוי לא תואם בהודעות. טלפון עם גרסה אחרת מקבל outdated ומתבקש לטעון מחדש.
 * 2: הגדרות, סבבים וחשיפת תפקידים.
 * 3: הצבעות, ניחושים, ניצחון וניקוד.
 * 4: העברת אירוח, בחירת מחליף ביציאה, שינוי סדר באמצע סבב.
 * 5: המארח יכול לסגור את החדר (כשהוא עובר למשחק מקומי).
 * 6: ניקוד לפי מי שצדק בהצבעות, ומי שפתח הצבעה לא יכול לשנות את הקול שלו.
 * 7: התור הנוכחי, שבעל התור או המארח מקדמים.
 * 8: מי לא במסך (הדף מוסתר), כדי שכולם יראו למי לקרוא.
 * 9: חזרה למקום של שחקן מנותק מטלפון אחר (claim), עם אישור של מישהו בחדר כשצריך.
 *    ספירה לאחור עד שהאירוח עובר ממארח מנותק (hostGone), ו"אני אארח" לפני שהזמן נגמר.
 */
export const PROTOCOL_VERSION = 9;

export const CODE_LENGTH = 6;
/** חדר בלי שום שינוי כל כך הרבה זמן נמחק בשרת. הטלפון לא מציע לחזור לחדר שלא ראה מאז */
export const ROOM_IDLE_MS = 2 * 60 * 60 * 1000;
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
  /** בהצבעה רואים רק כמה הצביעו, והקולות נחשפים בסוף. אחרת כל קול גלוי מיד, כמו הרמת ידיים */
  secretVote: boolean;
}

export type ClientMessage =
  /**
   * הטוקן נוצר בטלפון ונשמר בו לפני השליחה. אם החיבור נפל לפני התשובה, שולחים שוב את אותה הודעה,
   * והשרת מזהה לפי הטוקן שהשחקן כבר בחדר במקום ליצור אותו פעמיים
   */
  | { type: 'room:join'; name: string; token: string; version: number }
  | { type: 'room:rejoin'; token: string; version: number }
  /**
   * "זה המקום שלי": אחרי שהשרת ענה claimable, הטלפון לוקח את המקום של השחקן המנותק עם השם הזה,
   * עם טוקן חדש. בלובי עם מקום מנותק זה מיידי. אחרת מחכים שמישהו בחדר יאשר (claim:answer)
   */
  | { type: 'room:claim'; name: string; token: string; version: number }
  /** תשובה של שחקן בחדר לבקשה לחזור למקום של מישהו (RoomState.claims) */
  | { type: 'claim:answer'; claimId: string; approve: boolean }
  /** newHostId: רק כשהמארח יוצא, מי יחליף אותו */
  | { type: 'room:leave'; newHostId?: string }
  | { type: 'host:transfer'; playerId: string }
  /** המארח מנותק כבר זמן מה (HostGone.takeoverIn נגמר): השחקן הזה לוקח את האירוח בלי לחכות */
  | { type: 'host:takeover' }
  /** המארח סוגר את החדר: כולם מנותקים והחדר נמחק */
  | { type: 'room:close' }
  | { type: 'lobby:reorder'; playerIds: string[] }
  | { type: 'lobby:kick'; playerId: string }
  | { type: 'lobby:settings'; settings: RoomSettings }
  | { type: 'game:start' }
  | { type: 'role:seen' }
  | { type: 'reveal:skip' }
  /**
   * בעל התור או המארח מקדמים את התור. turn הוא מספר התור שהטלפון ראה (TurnState.number):
   * אם התור כבר זז (מישהו אחר לחץ באותו רגע), הלחיצה לא עושה כלום, כדי שהתור לא ידלג על שחקן
   */
  | { type: 'turn:next'; turn: number }
  | { type: 'round:end' }
  | { type: 'round:next' }
  | { type: 'round:lobby' }
  | { type: 'vote:start'; targetId: string }
  | { type: 'vote:cast'; yes: boolean }
  | { type: 'vote:cancel' }
  | { type: 'vote:close' }
  | { type: 'reveal:continue' }
  | { type: 'guess:start' }
  | { type: 'guess:cancel' }
  | { type: 'guess:mark'; correct: boolean }
  | { type: 'scores:reset' }
  /** הדף הוסתר (לשונית אחרת, אפליקציה אחרת) או חזר. לא משנה את החדר, רק מה שאחרים רואים */
  | { type: 'presence'; away: boolean };

export type ErrorCode =
  /** הטלפון עם גרסה ישנה (או חדשה) מדי */
  | 'outdated'
  | 'room_not_found'
  | 'room_full'
  | 'name_required'
  | 'name_taken'
  /** מישהו בחדר לא אישר את החזרה למקום */
  | 'claim_rejected'
  /** הטוקן לא מוכר: השחקן יצא, הוצא, או שהחדר נמחק */
  | 'bad_token'
  | 'not_joined'
  | 'not_host'
  | 'bad_order'
  | 'bad_message'
  /** הפעולה לא מתאימה לשלב הנוכחי (למשל התחלה באמצע סבב) */
  | 'wrong_phase'
  | 'not_enough_players'
  /** כבר יש הצבעה או ניחוש פתוחים, או שמחכים ל"ממשיכים" אחרי הדחה */
  | 'busy'
  /** השחקן הודח או יצא, או שהוא הנאשם */
  | 'not_allowed';

export interface PublicPlayer {
  id: string;
  name: string;
  /** יש לטלפון חיבור פתוח. מנותק לא נספר בהצבעה, ומארח מנותק מאבד את האירוח אחרי זמן */
  connected: boolean;
  /** מחובר, אבל הדף מוסתר: לשונית אחרת או אפליקציה אחרת. נספר בהצבעה כרגיל */
  away: boolean;
}

/**
 * lobby: מצטרפים ובוחרים הגדרות. reveal: כל אחד רואה את התפקיד שלו.
 * play: מדברים לפי התור (ההצבעה עוד בעל-פה). roundEnd: המילה והמתחזים נחשפים
 */
export type RoomPhase = 'lobby' | 'reveal' | 'play' | 'roundEnd';

/** התפקיד של הטלפון הזה בסבב. רק הוא מקבל אותו */
export type Role = { kind: 'crew'; word: string } | { kind: 'imposter'; hint: string };

export type Winner = 'crew' | 'imposters';
export type WinReason = 'allCaught' | 'outnumbered' | 'lastGuess' | 'freeGuessRight' | 'freeGuessWrong';

/** הצבעה פתוחה */
export interface VoteState {
  /** עולה בכל הצבעה, כדי לדעת שזו הצבעה חדשה (בשביל צליל ורטט) */
  id: number;
  targetId: string;
  startedBy: string;
  /** מי רשאי להצביע: כל מי שבמשחק חוץ מהנאשם */
  voterIds: string[];
  /** כמה כבר הצביעו */
  votedCount: number;
  /** רק בהצבעה גלויה: מה כל אחד הצביע עד עכשיו */
  votes?: Record<string, boolean>;
  /** הקול של הטלפון הזה, אם כבר הצביע. גם בהצבעה חשאית */
  myVote?: boolean;
}

/** התוצאה של ההצבעה האחרונה. נשארת עד ההצבעה הבאה, או עד שהתור זז */
export interface VoteResult {
  id: number;
  targetId: string;
  yes: number;
  no: number;
  /** מה כל אחד הצביע (גם בהצבעה חשאית, אחרי שנסגרה). מי שלא הצביע לא מופיע ונספר נגד */
  votes: Record<string, boolean>;
  eliminated: boolean;
}

/** מי מדבר עכשיו בשלב הדיבור */
export interface TurnState {
  playerId: string;
  /** עולה בכל קידום. הלחיצה על "קידום התור" שולחת אותו, כדי ששתי לחיצות ביחד יקדמו רק פעם אחת */
  number: number;
}

export interface RoundState {
  /** עולה בכל סבב, כדי לדעת שזה סבב חדש */
  number: number;
  /** מי בסבב, לפי סדר הישיבה כשהסבב התחיל. עם השמות, כי מי שיצא באמצע כבר לא ברשימת החדר */
  players: { id: string; name: string }[];
  starterId: string;
  turn: TurnState;
  /** מי כבר ראה את התפקיד שלו */
  seenIds: string[];
  /** מי יצא מהחדר באמצע הסבב (הם גם ב-eliminatedIds) */
  leftIds: string[];
  /** מי כבר לא במשחק: הודחו בהצבעה או יצאו */
  eliminatedIds: string[];
  /** מתחזים שהודחו (וכבר נחשפו לכולם) */
  caughtIds: string[];
  /** ההדחה האחרונה, עד שלוחצים "ממשיכים". imposter גלוי לכולם ממילא */
  revealed?: { playerId: string; imposter: boolean };
  /** המתחזה שהודח עכשיו מנחש את המילה, והשחקנים מסמנים */
  guessPending: boolean;
  vote?: VoteState;
  lastVote?: VoteResult;
  /** ניחוש חופשי פתוח: מישהו לחץ "המתחזה מנחש" */
  freeGuess?: { startedBy: string };
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
    /** אין מנצח כשהמארח סיים את הסבב בעצמו, או כשמתחזה יצא */
    winner?: Winner;
    winReason?: WinReason;
    /** כמה נקודות כל אחד קיבל בסבב הזה (סך הכול). ריק כשאין מנצח */
    points: Record<string, number>;
    /** איך חושב הניקוד: ההצבעות שהדיחו מישהו, והנקודות על סוף הסבב. רק כשיש מנצח */
    scoring?: { votes: ScoredVote[]; win: Record<string, number> };
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
  /** ניקוד מצטבר בחדר: playerId -> נקודות */
  scores: Record<string, number>;
  /** בקשות של טלפון אחר לחזור למקום של שחקן, שמחכות לאישור. השחקן עצמו לא רואה בקשה על המקום שלו */
  claims?: SeatClaim[];
  /** המארח מנותק. חסר כשהוא מחובר (גם אם הדף שלו מוסתר) */
  hostGone?: HostGone;
}

/**
 * כמה זמן נשאר, מהרגע שהמצב נשלח. הטלפון מתרגם לשעה לפי השעון שלו, כדי שהפרש שעונים לא ישנה את הספירה.
 * nextHostId: מי יקבל את האירוח כשהזמן ייגמר. null אם אין אף שחקן מחובר אחר
 */
export interface HostGone {
  handoverIn: number;
  /** מתי אפשר ללחוץ "אני אארח" (0: כבר עכשיו) */
  takeoverIn: number;
  nextHostId: string | null;
}

/** טלפון שמבקש לחזור למקום של playerId */
export interface SeatClaim {
  id: string;
  playerId: string;
}

/** closed: החדר נמחק אחרי זמן בלי פעילות. hostClosed: המארח סגר אותו */
export type LeftReason = 'left' | 'kicked' | 'closed' | 'hostClosed';

export type ServerMessage =
  | { type: 'state'; state: RoomState }
  /** ההצטרפות הצליחה. מעכשיו חוזרים עם room:rejoin */
  | { type: 'welcome' }
  /**
   * תשובה ל-room:join עם שם של שחקן שלא מחובר (או שהדף שלו מוסתר): אולי זה הוא, מטלפון אחר.
   * approval: מישהו בחדר יצטרך לאשר. waiting: הבקשה נשלחה ומחכים לאישור
   */
  | { type: 'claimable'; name: string; approval: boolean }
  | { type: 'claim:waiting' }
  | { type: 'error'; code: ErrorCode }
  /** הטלפון כבר לא בחדר. החיבור נסגר מיד אחרי ההודעה */
  | { type: 'left'; reason: LeftReason };
