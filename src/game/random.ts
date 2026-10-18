/** מחזיר מספר בטווח [0, 1) */
export type Rng = () => number;

export const cryptoRng: Rng = () => {
  const buffer = new Uint32Array(1);
  crypto.getRandomValues(buffer);
  return buffer[0] / 2 ** 32;
};

export function randomInt(max: number, rng: Rng): number {
  return Math.floor(rng() * max);
}

export function pickOne<T>(items: readonly T[], rng: Rng): T {
  if (items.length === 0) throw new Error('pickOne: empty list');
  return items[randomInt(items.length, rng)];
}

/** Fisher-Yates. מחזיר מערך חדש. */
export function shuffle<T>(items: readonly T[], rng: Rng): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = randomInt(i + 1, rng);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
