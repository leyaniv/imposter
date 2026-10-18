export type Phase = 'home' | 'rules' | 'scores' | 'setup' | 'pass' | 'reveal' | 'start' | 'roundEnd';

/** שלבים שיש בהם סבב פעיל */
export const ROUND_PHASES: readonly Phase[] = ['pass', 'reveal', 'start', 'roundEnd'];

export interface Player {
  /** קבוע לשחקן, גם כשמשנים את הסדר או מוחקים שחקנים אחרים */
  id: string;
  /** ריק = יוצג כ"שחקן N" */
  name: string;
}

export interface Settings {
  /** לפי סדר הישיבה, עם כיוון השעון */
  players: Player[];
  /** ריק = כל הקטגוריות */
  categories: string[];
  imposterCount: 1 | 2;
  imposterNeverStarts: boolean;
  /** כולם (כולל המתחזה) רואים מאיזו קטגוריה המילה */
  showCategory: boolean;
}

export interface WordEntry {
  category: string;
  word: string;
  hints: string[];
}

export type Winner = 'crew' | 'imposters';

/** משוב של השחקנים על המילה של הסבב */
export type WordProblem = 'unknown_word' | 'hint_too_strong';

export type WinReason =
  /** כל המתחזים הודחו ואף אחד מהם לא ניחש את המילה */
  | 'allCaught'
  /** נשארו מתחזים כמו שחקנים רגילים, או יותר */
  | 'outnumbered'
  /** מתחזה שהודח ניחש נכון את המילה */
  | 'lastGuess'
  | 'freeGuessRight'
  | 'freeGuessWrong'
  /** השחקנים סימנו בעצמם מי ניצח בסוף הסבב */
  | 'manual';

export interface Round {
  /** לפי סדר הישיבה, עם כיוון השעון */
  players: Player[];
  imposterIds: string[];
  word: string;
  category: string;
  /** imposterId -> רמז */
  hints: Record<string, string>;
  /** מי השחקן הבא שצריך לראות את התפקיד שלו */
  revealIndex: number;
  startIndex: number;
  /** הקטגוריה גלויה לכולם בסבב הזה (נקבע לפי ההגדרות כשהסבב מתחיל) */
  showCategory?: boolean;
  /** אנימציית ההגרלה של מי מתחיל כבר הוצגה */
  starterAnnounced?: boolean;
  /** מי הודח בהצבעה, לפי הסדר */
  eliminatedIds: string[];
  /** מי הודח עכשיו. הטלפון מציג אם זה המתחזה, עד שממשיכים */
  revealedId?: string;
  /** המתחזה שהודח עכשיו עוד צריך לנחש את המילה (ניחוש אחרון) */
  guessPending?: boolean;
  winner?: Winner;
  winReason?: WinReason;
  /** כבר דיווחו על בעיה במילה בסבב הזה (באמצע או בסוף) */
  wordReported?: boolean;
}

export interface AppState {
  phase: Phase;
  settings: Settings;
  round?: Round;
  usedWords: string[];
  /** ניקוד מצטבר לאורך הערב: playerId -> נקודות. מתאפס כשמוסיפים או מסירים שחקן */
  scores: Record<string, number>;
}
