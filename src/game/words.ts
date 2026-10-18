import { pickOne, shuffle, type Rng } from './random';
import type { WordEntry } from './types';

/**
 * מסיר ניקוד וטעמים, כדי להשוות מילים בלי קשר לניקוד.
 * משאיר מקף (U+05BE) וסימני פיסוק עבריים אחרים.
 */
export function stripNiqqud(text: string): string {
  return text.replace(/[֑-ׇֽֿׁׂׅׄ]/g, '');
}

export function listCategories(bank: readonly WordEntry[]): string[] {
  return [...new Set(bank.map((entry) => entry.category))];
}

/**
 * המילים בקטגוריות שנבחרו. רשימה ריקה = כל הקטגוריות.
 * אם אף קטגוריה שנבחרה לא קיימת במאגר (למשל אחרי שינוי שם), חוזרים לכל המאגר.
 */
export function wordsInCategories(bank: readonly WordEntry[], categories: readonly string[]): readonly WordEntry[] {
  if (categories.length === 0) return bank;
  const filtered = bank.filter((entry) => categories.includes(entry.category));
  return filtered.length > 0 ? filtered : bank;
}

/** כמה מילים בקטגוריות שנבחרו עוד לא יצאו */
export function countFreshWords(
  bank: readonly WordEntry[],
  categories: readonly string[],
  usedWords: readonly string[],
): number {
  return wordsInCategories(bank, categories).filter((entry) => !usedWords.includes(entry.word)).length;
}

/**
 * מסמן או מבטל קטגוריה. רשימה ריקה = כל הקטגוריות.
 * אי אפשר לבטל את הקטגוריה האחרונה שנשארה.
 */
export function toggleCategory(all: readonly string[], selected: readonly string[], category: string): string[] {
  const current = selected.length === 0 ? [...all] : selected.filter((c) => all.includes(c));
  const next = current.includes(category) ? current.filter((c) => c !== category) : [...current, category];
  if (next.length === 0) return [...selected];
  return next.length === all.length ? [] : all.filter((c) => next.includes(c));
}

/**
 * בוחר מילה מהקטגוריות שנבחרו שעוד לא יצאה.
 * אם כל המילים בקטגוריות האלה כבר יצאו, מתחילים מחדש ומחזירים usedWords מאופס.
 */
export function pickWord(
  bank: readonly WordEntry[],
  categories: readonly string[],
  usedWords: readonly string[],
  rng: Rng,
): { entry: WordEntry; usedWords: string[] } {
  const inCategories = wordsInCategories(bank, categories);
  if (inCategories.length === 0) throw new Error('pickWord: empty word bank');

  const fresh = inCategories.filter((entry) => !usedWords.includes(entry.word));
  if (fresh.length > 0) {
    const entry = pickOne(fresh, rng);
    return { entry, usedWords: [...usedWords, entry.word] };
  }

  const recycled = new Set(inCategories.map((entry) => entry.word));
  const entry = pickOne(inCategories, rng);
  return { entry, usedWords: [...usedWords.filter((word) => !recycled.has(word)), entry.word] };
}

/** רמז שונה לכל מתחזה, כל עוד יש מספיק רמזים */
export function assignHints(entry: WordEntry, imposterIds: readonly string[], rng: Rng): Record<string, string> {
  const hints = shuffle(entry.hints, rng);
  return Object.fromEntries(imposterIds.map((id, i) => [id, hints[i % hints.length]]));
}
