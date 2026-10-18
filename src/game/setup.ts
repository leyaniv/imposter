import { randomInt, shuffle, type Rng } from './random';
import type { Player, Round, Settings, WordEntry } from './types';
import { assignHints, pickWord } from './words';

export const MIN_PLAYERS = 3;
export const MAX_PLAYERS = 12;
export const MIN_PLAYERS_FOR_TWO_IMPOSTERS = 7;

export function maxImposters(playerCount: number): 1 | 2 {
  return playerCount >= MIN_PLAYERS_FOR_TWO_IMPOSTERS ? 2 : 1;
}

/** מזהה לשחקן חדש: p ואחריו מספר גדול מכל מספר שכבר בשימוש */
export function nextPlayerId(players: readonly Player[]): string {
  const max = players.reduce((acc, player) => {
    const n = Number(/^p(\d+)$/.exec(player.id)?.[1] ?? 0);
    return Math.max(acc, n);
  }, 0);
  return `p${max + 1}`;
}

export function addPlayer(players: readonly Player[], name = ''): Player[] {
  return [...players, { id: nextPlayerId(players), name }];
}

/** שחקנים בלי שם, למשל לברירת המחדל */
export function blankPlayers(count: number): Player[] {
  let players: Player[] = [];
  for (let i = 0; i < count; i++) players = addPlayer(players);
  return players;
}

/** מזיז שחקן ממקום למקום בסדר הישיבה */
export function movePlayer(players: readonly Player[], from: number, to: number): Player[] {
  const result = [...players];
  const [moved] = result.splice(from, 1);
  result.splice(to, 0, moved);
  return result;
}

/** שמות שמופיעים יותר מפעם אחת (בלי רווחים מסביב ובלי הבדל בין אותיות גדולות לקטנות) */
export function duplicateNames(players: readonly Player[]): string[] {
  const seen = new Map<string, string>();
  const duplicates = new Set<string>();
  for (const { name } of players) {
    const trimmed = name.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) duplicates.add(seen.get(key)!);
    else seen.set(key, trimmed);
  }
  return [...duplicates];
}

export function createPlayers(settings: Settings): Player[] {
  return settings.players.map(({ id, name }) => ({ id, name: name.trim() }));
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
      eliminatedIds: [],
    },
    usedWords: picked.usedWords,
  };
}
