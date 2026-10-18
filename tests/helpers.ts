import type { Rng } from '../src/game/random';
import type { WordEntry } from '../src/game/types';

/** mulberry32: אקראיות דטרמיניסטית לבדיקות */
export function seededRng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 2 ** 32;
  };
}

export const testBank: WordEntry[] = [
  { category: 'אוכל', word: 'פיצה', hints: ['איטליה', 'משולש', 'משלוח'] },
  { category: 'אוכל', word: 'סושי', hints: ['יפן', 'מקלות', 'אצות'] },
  { category: 'מקומות', word: 'קולנוע', hints: ['פופקורן', 'כרטיס', 'מסך'] },
];
