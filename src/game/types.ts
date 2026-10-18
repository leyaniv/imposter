export type Phase = 'home' | 'rules' | 'setup' | 'pass' | 'reveal' | 'start' | 'roundEnd';

/** שלבים שיש בהם סבב פעיל */
export const ROUND_PHASES: readonly Phase[] = ['pass', 'reveal', 'start', 'roundEnd'];

export interface Player {
  id: string;
  /** ריק = יוצג כ"שחקן N" */
  name: string;
}

export interface Settings {
  playerCount: number;
  /** לפי סדר הישיבה, עם כיוון השעון */
  names: string[];
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
}

export interface AppState {
  phase: Phase;
  settings: Settings;
  round?: Round;
  usedWords: string[];
}
