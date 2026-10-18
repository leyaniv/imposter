import { randomInt, shuffle, type Rng } from './random';
import type { Player, Round, Settings, WordEntry } from './types';
import { assignHints, pickWord } from './words';

export const MIN_PLAYERS = 3;
export const MAX_PLAYERS = 12;
export const MIN_PLAYERS_FOR_TWO_IMPOSTERS = 7;

export function maxImposters(playerCount: number): 1 | 2 {
  return playerCount >= MIN_PLAYERS_FOR_TWO_IMPOSTERS ? 2 : 1;
}

export function createPlayers(settings: Settings): Player[] {
  return Array.from({ length: settings.playerCount }, (_, i) => ({
    id: `p${i + 1}`,
    name: (settings.names[i] ?? '').trim(),
  }));
}

export function chooseImposters(players: readonly Player[], count: number, rng: Rng): string[] {
  return shuffle(players, rng)
    .slice(0, count)
    .map((player) => player.id);
}

/** מחזיר את האינדקס של מי שמתחיל */
export function chooseStarter(
  players: readonly Player[],
  imposterIds: readonly string[],
  imposterNeverStarts: boolean,
  rng: Rng,
): number {
  const candidates = players
    .map((player, index) => ({ player, index }))
    .filter(({ player }) => !imposterNeverStarts || !imposterIds.includes(player.id));
  return candidates[randomInt(candidates.length, rng)].index;
}

export function createRound(
  settings: Settings,
  bank: readonly WordEntry[],
  usedWords: readonly string[],
  rng: Rng,
): { round: Round; usedWords: string[] } {
  const players = createPlayers(settings);
  const imposterCount = Math.min(settings.imposterCount, maxImposters(players.length));
  const imposterIds = chooseImposters(players, imposterCount, rng);
  const picked = pickWord(bank, settings.categories, usedWords, rng);

  return {
    round: {
      players,
      imposterIds,
      word: picked.entry.word,
      category: picked.entry.category,
      hints: assignHints(picked.entry, imposterIds, rng),
      revealIndex: 0,
      startIndex: chooseStarter(players, imposterIds, settings.imposterNeverStarts, rng),
      showCategory: settings.showCategory,
    },
    usedWords: picked.usedWords,
  };
}
