import { defaultSettings, initialState, normalizeSettings } from './reducer';
import { blankPlayers } from './setup';
import {
  ROUND_PHASES,
  type AppState,
  type Phase,
  type Player,
  type Round,
  type Settings,
  type WinReason,
} from './types';

/**
 * להעלות כשמבנה המצב השמור משתנה בצורה שלא תואמת לאחור, ולהוסיף המרה מהגרסה הקודמת.
 * 2: רשימת שחקנים עם מזהים קבועים (במקום playerCount ו-names), הדחות וניקוד.
 */
export const STATE_VERSION = 2;

const PHASES: readonly Phase[] = ['home', 'rules', 'scores', 'setup', ...ROUND_PHASES];
const WIN_REASONS: readonly WinReason[] = [
  'allCaught',
  'outnumbered',
  'lastGuess',
  'freeGuessRight',
  'freeGuessWrong',
  'manual',
];

export function serialize(state: AppState): unknown {
  return { version: STATE_VERSION, state };
}

/**
 * הופך מצב שמור (שאולי ישן או פגום) למצב תקין.
 * מצב מגרסה 1 מומר, וכל מה שלא עובר בדיקה נזרק ומוחלף בברירת מחדל.
 */
export function rehydrate(raw: unknown): AppState {
  if (!isObject(raw) || !isObject(raw.state)) return initialState;
  if (raw.version !== STATE_VERSION && raw.version !== 1) return initialState;
  const saved = raw.state;

  const settings = readSettings(saved.settings);
  const usedWords = isStringArray(saved.usedWords) ? saved.usedWords : [];
  const round = readRound(saved.round);

  let phase: Phase = PHASES.includes(saved.phase as Phase) ? (saved.phase as Phase) : 'home';
  if (ROUND_PHASES.includes(phase) && !round) phase = 'home';
  // אחרי ריענון לא מציגים מיד תפקיד למי שמחזיק את הטלפון
  if (phase === 'reveal') phase = 'pass';

  return {
    phase,
    settings,
    round: ROUND_PHASES.includes(phase) ? round : undefined,
    usedWords,
    scores: readScores(saved.scores),
  };
}

function readSettings(value: unknown): Settings {
  if (!isObject(value)) return defaultSettings;
  return normalizeSettings({
    players: readPlayers(value),
    categories: isStringArray(value.categories) ? value.categories : defaultSettings.categories,
    imposterCount: value.imposterCount === 2 ? 2 : 1,
    imposterNeverStarts:
      typeof value.imposterNeverStarts === 'boolean' ? value.imposterNeverStarts : defaultSettings.imposterNeverStarts,
    showCategory: typeof value.showCategory === 'boolean' ? value.showCategory : defaultSettings.showCategory,
  });
}

/** גרסה 2 שומרת players. גרסה 1 שמרה playerCount ו-names, והמזהים שלה היו p1, p2... לפי הסדר */
function readPlayers(settings: Record<string, unknown>): Player[] {
  if (isPlayerList(settings.players)) return settings.players.map(({ id, name }) => ({ id, name }));

  const count = isFiniteNumber(settings.playerCount)
    ? Math.round(settings.playerCount)
    : defaultSettings.players.length;
  const names = isStringArray(settings.names) ? settings.names : [];
  return blankPlayers(Math.max(1, Math.min(count, 50))).map((player, i) => ({ ...player, name: names[i] ?? '' }));
}

function readRound(value: unknown): Round | undefined {
  if (!isObject(value)) return undefined;
  const { players, imposterIds, word, category, hints, revealIndex, startIndex } = value;
  if (!isPlayerList(players) || players.length === 0) return undefined;
  const ids = players.map((player) => player.id);
  if (!isStringArray(imposterIds) || imposterIds.length === 0 || !imposterIds.every((id) => ids.includes(id))) {
    return undefined;
  }
  if (!isObject(hints) || !imposterIds.every((id) => typeof hints[id] === 'string')) return undefined;
  if (
    typeof word !== 'string' ||
    typeof category !== 'string' ||
    !isIndex(revealIndex, players.length + 1) ||
    !isIndex(startIndex, players.length)
  ) {
    return undefined;
  }

  const round = value as unknown as Round;
  // גרסה 1 לא שמרה הדחות
  const eliminatedIds = isStringArray(value.eliminatedIds) ? value.eliminatedIds.filter((id) => ids.includes(id)) : [];
  const revealedId =
    typeof value.revealedId === 'string' && eliminatedIds.includes(value.revealedId) ? value.revealedId : undefined;
  const winner = value.winner === 'crew' || value.winner === 'imposters' ? value.winner : undefined;
  const winReason = winner && WIN_REASONS.includes(value.winReason as WinReason) ? (value.winReason as WinReason) : undefined;

  return {
    ...round,
    eliminatedIds,
    revealedId,
    guessPending:
      value.guessPending === true && !!revealedId && imposterIds.includes(revealedId) && !winner ? true : undefined,
    winner,
    winReason: winner ? (winReason ?? 'manual') : undefined,
    wordReported: value.wordReported === true ? true : undefined,
  };
}

function readScores(value: unknown): Record<string, number> {
  if (!isObject(value)) return {};
  return Object.fromEntries(Object.entries(value).filter((entry): entry is [string, number] => isFiniteNumber(entry[1])));
}

function isPlayerList(value: unknown): value is Player[] {
  if (!Array.isArray(value)) return false;
  if (!value.every((p) => isObject(p) && typeof p.id === 'string' && p.id !== '' && typeof p.name === 'string')) {
    return false;
  }
  return new Set(value.map((p: Player) => p.id)).size === value.length;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isIndex(value: unknown, length: number): boolean {
  return Number.isInteger(value) && (value as number) >= 0 && (value as number) < length;
}
