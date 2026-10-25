import { describe, expect, it } from 'vitest';
import bank from '../src/data/words.he.json';
import {
  assignHints,
  countFreshWords,
  listCategories,
  pickWord,
  stripNiqqud,
  toggleCategory,
  wordsInCategories,
} from '../src/game/words';
import { seededRng, testBank } from './helpers';

describe('pickWord', () => {
  it('only picks from the selected categories', () => {
    for (let seed = 0; seed < 50; seed++) {
      const { entry } = pickWord(testBank, ['מקומות'], [], seededRng(seed));
      expect(entry.word).toBe('קולנוע');
    }
  });

  it('skips used words and records the new one', () => {
    const { entry, usedWords } = pickWord(testBank, ['אוכל'], ['פיצה'], seededRng(0));
    expect(entry.word).toBe('סושי');
    expect(usedWords).toEqual(['פיצה', 'סושי']);
  });

  it('starts over when every word in the categories was used', () => {
    const { usedWords } = pickWord(testBank, ['אוכל'], ['פיצה', 'סושי', 'קולנוע'], seededRng(0));
    expect(usedWords).toContain('קולנוע');
    expect(usedWords.filter((w) => w === 'פיצה' || w === 'סושי')).toHaveLength(1);
  });
});

describe('stripNiqqud', () => {
  it('removes vowel points and dagesh but keeps letters, spaces and maqaf', () => {
    expect(stripNiqqud('מַפְתֵּחַ')).toBe('מפתח');
    expect(stripNiqqud('שֶׁקַע')).toBe('שקע');
    expect(stripNiqqud('רב־קו מוֹנֶה')).toBe('רב־קו מונה');
  });
});

describe('wordsInCategories', () => {
  it('falls back to the whole bank when no selected category exists', () => {
    expect(wordsInCategories(testBank, ['קטגוריה שנמחקה'])).toBe(testBank);
    const { entry } = pickWord(testBank, ['קטגוריה שנמחקה'], [], seededRng(0));
    expect(testBank).toContain(entry);
  });
});

describe('countFreshWords', () => {
  it('counts unused words in the selected categories only', () => {
    expect(countFreshWords(testBank, [], [])).toBe(3);
    expect(countFreshWords(testBank, ['אוכל'], ['פיצה', 'קולנוע'])).toBe(1);
  });
});

describe('toggleCategory', () => {
  const all = ['א', 'ב', 'ג'];

  it('turns one category off when all were selected', () => {
    expect(toggleCategory(all, [], 'ב')).toEqual(['א', 'ג']);
  });

  it('goes back to "all" (empty list) when every category is selected again', () => {
    expect(toggleCategory(all, ['א', 'ג'], 'ב')).toEqual([]);
  });

  it('keeps the categories in the same order as the bank', () => {
    expect(toggleCategory(all, ['ג'], 'א')).toEqual(['א', 'ג']);
  });

  it('does not allow removing the last category', () => {
    expect(toggleCategory(all, ['ב'], 'ב')).toEqual(['ב']);
  });
});

describe('assignHints', () => {
  it('reuses hints when there are more imposters than hints', () => {
    const hints = assignHints({ category: 'x', word: 'y', hints: ['a'] }, ['p1', 'p2'], seededRng(0));
    expect(hints).toEqual({ p1: 'a', p2: 'a' });
  });
});

/**
 * צורות שאפשר לקרוא בכמה משמעויות כשאין ניקוד.
 * אסור שמילה או רמז יהיו בדיוק אחת מהן בלי ניקוד: או שמנקדים, או שמחליפים / מוסיפים הקשר.
 * מצאתם עוד צורה כזאת? הוסיפו אותה כאן (ראו src/data/AGENTS.md).
 */
const AMBIGUOUS_UNPOINTED = [
  'חום', 'ספר', 'בירה', 'אחות', 'שבעה', 'מנצח', 'אבל', 'שנה', 'ברך', 'נהג', 'מסור',
  'מפתח', 'מטען', 'מראה', 'המראה', 'קניון', 'צלם', 'אגרוף', 'נחש', 'הודו', 'מלון',
  'ביצה', 'קרח', 'קצר', 'חלה', 'לבה', 'קצב', 'השאלה', 'נורה', 'שקע', 'דופק', 'רחבה',
  'מדבר', 'שלט', 'מבצע', 'ישיבה', 'חברות', 'גלישה', 'הפוך', 'קבלה', 'הקפה', 'שכבה', 'מונה',
  'שמן', 'אות', 'אף', 'פרות', 'הרים',
];

/**
 * רמזים שמופיעים בתוך המילה הסודית רק כצירוף מקרים של אותיות, בלי קשר למשמעות.
 * רמז שהוא באמת חלק מהמילה (סל בכדורסל, אבל בניחום אבלים) חזק מדי: מחליפים אותו, ולא מוסיפים אותו כאן.
 */
const HINT_INSIDE_WORD_BY_CHANCE = ['מילקשייק: קש', 'גלישת גלים: ים'];

describe('words.he.json', () => {
  it('has no ambiguous word or hint without niqqud', () => {
    const ambiguous = new Set(AMBIGUOUS_UNPOINTED);
    const offenders = bank.flatMap((entry) =>
      [entry.word, ...entry.hints].filter((text) => ambiguous.has(text)).map((text) => `${entry.word}: ${text}`),
    );
    expect(offenders).toEqual([]);
  });

  it('has unique words, three hints each, and no hint that repeats the word (ignoring niqqud)', () => {
    const words = bank.map((e) => stripNiqqud(e.word));
    expect(new Set(words).size).toBe(words.length);
    for (const entry of bank) {
      const word = stripNiqqud(entry.word);
      expect(entry.hints, entry.word).toHaveLength(3);
      expect(new Set(entry.hints).size, entry.word).toBe(3);
      for (const hint of entry.hints) expect(stripNiqqud(hint).includes(word), `${entry.word}: ${hint}`).toBe(false);
    }
  });

  it('has no hint that is part of the word (ignoring niqqud)', () => {
    const byChance = new Set(HINT_INSIDE_WORD_BY_CHANCE);
    const offenders = bank.flatMap((entry) =>
      entry.hints
        .filter((hint) => stripNiqqud(entry.word).includes(stripNiqqud(hint)))
        .map((hint) => `${entry.word}: ${hint}`)
        .filter((pair) => !byChance.has(pair)),
    );
    expect(offenders).toEqual([]);
  });

  it('covers 12 categories with at least 300 words and 20 per category', () => {
    const categories = listCategories(bank);
    expect(categories).toHaveLength(12);
    expect(bank.length).toBeGreaterThanOrEqual(300);
    for (const category of categories) {
      expect(bank.filter((e) => e.category === category).length, category).toBeGreaterThanOrEqual(20);
    }
  });
});
