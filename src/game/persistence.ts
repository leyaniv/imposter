import { defaultSettings, initialState, normalizeSettings } from './reducer';
import { ROUND_PHASES, type AppState, type Phase, type Round, type Settings } from './types';

/** להעלות כשמבנה המצב השמור משתנה בצורה שלא תואמת לאחור */
export const STATE_VERSION = 1;

const PHASES: readonly Phase[] = ['home', 'rules', 'setup', ...ROUND_PHASES];

export function serialize(state: AppState): unknown {
  return { version: STATE_VERSION, state };
}

/**
 * הופך מצב שמור (שאולי ישן או פגום) למצב תקין.
 * כל מה שלא עובר בדיקה נזרק ומוחלף בברירת מחדל.
 */
export function rehydrate(raw: unknown): AppState {
  if (!isObject(raw) || raw.version !== STATE_VERSION || !isObject(raw.state)) return initialState;
  const saved = raw.state;

  const settings = readSettings(saved.settings);
  const usedWords = isStringArray(saved.usedWords) ? saved.usedWords : [];
  const round = isRound(saved.round) ? saved.round : undefined;

  let phase: Phase = PHASES.includes(saved.phase as Phase) ? (saved.phase as Phase) : 'home';
  if (ROUND_PHASES.includes(phase) && !round) phase = 'home';
  // אחרי ריענון לא מציגים מיד תפקיד למי שמחזיק את הטלפון
  if (phase === 'reveal') phase = 'pass';

  return {
    phase,
    settings,
    round: ROUND_PHASES.includes(phase) ? round : undefined,
    usedWords,
  };
}

function readSettings(value: unknown): Settings {
  if (!isObject(value)) return defaultSettings;
  return normalizeSettings({
    playerCount: isFiniteNumber(value.playerCount) ? value.playerCount : defaultSettings.playerCount,
    names: isStringArray(value.names) ? value.names : defaultSettings.names,
    categories: isStringArray(value.categories) ? value.categories : defaultSettings.categories,
    imposterCount: value.imposterCount === 2 ? 2 : 1,
    imposterNeverStarts:
      typeof value.imposterNeverStarts === 'boolean' ? value.imposterNeverStarts : defaultSettings.imposterNeverStarts,
    showCategory: typeof value.showCategory === 'boolean' ? value.showCategory : defaultSettings.showCategory,
  });
}

function isRound(value: unknown): value is Round {
  if (!isObject(value)) return false;
  const { players, imposterIds, word, category, hints, revealIndex, startIndex } = value;
  if (!Array.isArray(players) || players.length === 0) return false;
  if (!players.every((p) => isObject(p) && typeof p.id === 'string' && typeof p.name === 'string')) return false;
  if (!isStringArray(imposterIds) || imposterIds.length === 0) return false;
  if (!isObject(hints) || !imposterIds.every((id) => typeof hints[id] === 'string')) return false;
  return (
    typeof word === 'string' &&
    typeof category === 'string' &&
    isIndex(revealIndex, players.length + 1) &&
    isIndex(startIndex, players.length)
  );
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
